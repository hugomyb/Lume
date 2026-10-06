//! Rich command history: one JSON object per executed command, appended to
//! `history.jsonl` in Lume's config dir. Unlike the shell's HISTFILE it keeps
//! the context a command ran in — cwd, exit code, duration, git branch — so
//! the palette can answer "what was that failing composer command in PALR?".
//!
//! A plain append-only file (no SQLite): appends are one `write`, a search is
//! a linear scan of a few MB at most, and the file stays greppable. It is
//! compacted to the newest `KEEP_LINES` entries once it grows past
//! `MAX_BYTES`.

use std::io::Write;
use std::path::PathBuf;
use std::sync::OnceLock;

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};

const FILE_NAME: &str = "history.jsonl";
/// Compact once the file passes this size…
const MAX_BYTES: u64 = 4 * 1024 * 1024;
/// …down to this many newest entries.
const KEEP_LINES: usize = 20_000;
/// Commands longer than this are not worth recalling (pasted scripts).
const MAX_CMD_LEN: usize = 2000;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub cmd: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exit: Option<i32>,
    /// Start time, ms since the epoch.
    pub ts: i64,
    /// Duration in ms.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dur: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub branch: Option<String>,
}

/// A deduplicated search result: the most recent run of a command line that
/// matched, plus how many matching runs there were.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HistoryHit {
    #[serde(flatten)]
    pub entry: HistoryEntry,
    pub count: u32,
}

fn lock() -> &'static Mutex<()> {
    static L: OnceLock<Mutex<()>> = OnceLock::new();
    L.get_or_init(|| Mutex::new(()))
}

fn history_path() -> Option<PathBuf> {
    crate::paths::config_dir().map(|d| d.join(FILE_NAME))
}

#[tauri::command]
pub fn history_append(
    config: tauri::State<'_, std::sync::Arc<Mutex<crate::config::Config>>>,
    entry: HistoryEntry,
) -> Result<(), String> {
    let settings = config.lock().history.clone();
    if !settings.enabled || is_ignored(&entry.cmd, &settings.ignore) {
        return Ok(());
    }
    let Some(path) = history_path() else {
        return Ok(());
    };
    append_to(&path, entry)
}

/// Does `cmd` match one of the user's "never record" patterns?
fn is_ignored(cmd: &str, patterns: &[String]) -> bool {
    let c = cmd.trim().to_lowercase();
    patterns.iter().any(|p| {
        let p = p.trim().to_lowercase();
        !p.is_empty() && crate::ssh::glob_match(&p, &c)
    })
}

fn append_to(path: &std::path::Path, mut entry: HistoryEntry) -> Result<(), String> {
    // Leading space = "don't record me", the HISTCONTROL=ignorespace convention.
    if entry.cmd.starts_with(' ') {
        return Ok(());
    }
    entry.cmd = entry.cmd.trim().to_string();
    if entry.cmd.is_empty() || entry.cmd.len() > MAX_CMD_LEN {
        return Ok(());
    }
    let line = serde_json::to_string(&entry).map_err(|e| e.to_string())?;
    let _g = lock().lock();
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let mut f = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|e| e.to_string())?;
    f.write_all(format!("{line}\n").as_bytes())
        .map_err(|e| e.to_string())?;
    drop(f);
    if std::fs::metadata(path).map(|m| m.len()).unwrap_or(0) > MAX_BYTES {
        compact(path);
    }
    Ok(())
}

/// Rewrite the file keeping only the newest `KEEP_LINES` lines. Called with
/// the lock held. Written to a temp file then renamed, so a crash mid-way
/// never truncates the history.
fn compact(path: &std::path::Path) {
    let Ok(content) = std::fs::read_to_string(path) else {
        return;
    };
    let lines: Vec<&str> = content.lines().filter(|l| !l.trim().is_empty()).collect();
    if lines.len() <= KEEP_LINES {
        return;
    }
    let kept = lines[lines.len() - KEEP_LINES..].join("\n") + "\n";
    let tmp = path.with_extension("jsonl.tmp");
    if std::fs::write(&tmp, kept).is_ok() {
        let _ = std::fs::rename(&tmp, path);
    }
}

#[tauri::command]
pub fn history_clear() -> Result<(), String> {
    let Some(path) = history_path() else {
        return Ok(());
    };
    let _g = lock().lock();
    match std::fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

/// Search the history. `query` is free text plus optional filters:
///  - `failed` / `failed:true` — non-zero exit;  `ok` / `failed:false` — exit 0
///  - `here` — ran in `cwd` (the active pane's directory)
///  - `cwd:<text>` / `dir:<text>` / `project:<text>` — cwd contains text
///  - `branch:<text>` — git branch contains text
/// Every remaining word must appear in the command (case-insensitive).
/// Results are deduplicated by command line, newest first.
#[tauri::command]
pub fn history_search(query: String, cwd: Option<String>, limit: Option<usize>) -> Vec<HistoryHit> {
    let Some(path) = history_path() else {
        return Vec::new();
    };
    let content = {
        let _g = lock().lock();
        std::fs::read_to_string(&path).unwrap_or_default()
    };
    search_in(
        &content,
        &query,
        cwd.as_deref(),
        limit.unwrap_or(200).min(1000),
    )
}

#[derive(Default, Debug)]
struct Filters {
    terms: Vec<String>,
    failed: Option<bool>,
    here: bool,
    cwd: Vec<String>,
    branch: Vec<String>,
}

fn parse_query(query: &str) -> Filters {
    let mut f = Filters::default();
    for word in query.split_whitespace() {
        let lower = word.to_lowercase();
        match lower.as_str() {
            "failed" | "failed:true" | "failed:yes" | "fail" => f.failed = Some(true),
            "ok" | "failed:false" | "failed:no" | "success" => f.failed = Some(false),
            "here" => f.here = true,
            _ => {
                if let Some((key, val)) = lower.split_once(':') {
                    if !val.is_empty() {
                        match key {
                            "cwd" | "dir" | "project" | "in" => {
                                f.cwd.push(val.to_string());
                                continue;
                            }
                            "branch" | "br" => {
                                f.branch.push(val.to_string());
                                continue;
                            }
                            _ => {}
                        }
                    }
                }
                f.terms.push(lower);
            }
        }
    }
    f
}

/// Same directory? On Windows the cwd arrives as `C:/x` (OSC 7) or `C:\x`
/// (spawn), in any letter case.
fn same_dir(a: &str, b: &str) -> bool {
    let norm = |p: &str| {
        let n = p.replace('\\', "/");
        let n = n.trim_end_matches('/').to_string();
        if cfg!(windows) {
            n.to_lowercase()
        } else {
            n
        }
    };
    norm(a) == norm(b)
}

fn matches(e: &HistoryEntry, f: &Filters, here: Option<&str>) -> bool {
    match f.failed {
        Some(true) if !matches!(e.exit, Some(c) if c != 0) => return false,
        Some(false) if e.exit != Some(0) => return false,
        _ => {}
    }
    if f.here {
        match (here, e.cwd.as_deref()) {
            (Some(h), Some(c)) if same_dir(h, c) => {}
            _ => return false,
        }
    }
    if !f.cwd.is_empty() {
        let c = e.cwd.as_deref().unwrap_or("").to_lowercase();
        if !f.cwd.iter().all(|v| c.contains(v.as_str())) {
            return false;
        }
    }
    if !f.branch.is_empty() {
        let b = e.branch.as_deref().unwrap_or("").to_lowercase();
        if !f.branch.iter().all(|v| b.contains(v.as_str())) {
            return false;
        }
    }
    if !f.terms.is_empty() {
        let cmd = e.cmd.to_lowercase();
        if !f.terms.iter().all(|t| cmd.contains(t.as_str())) {
            return false;
        }
    }
    true
}

fn search_in(content: &str, query: &str, here: Option<&str>, limit: usize) -> Vec<HistoryHit> {
    let f = parse_query(query);
    let mut out: Vec<HistoryHit> = Vec::new();
    let mut index: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    // Newest lines are at the end: walk backwards so the first hit for a
    // command line is its most recent run.
    for line in content.lines().rev() {
        if line.trim().is_empty() {
            continue;
        }
        let Ok(e) = serde_json::from_str::<HistoryEntry>(line) else {
            continue;
        };
        if !matches(&e, &f, here) {
            continue;
        }
        if let Some(&i) = index.get(&e.cmd) {
            out[i].count += 1;
            continue;
        }
        if out.len() >= limit {
            // Still count runs of already-listed commands, but no new rows.
            continue;
        }
        index.insert(e.cmd.clone(), out.len());
        out.push(HistoryHit { entry: e, count: 1 });
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(cmd: &str, cwd: &str, exit: i32, ts: i64, branch: Option<&str>) -> String {
        serde_json::to_string(&HistoryEntry {
            cmd: cmd.into(),
            cwd: Some(cwd.into()),
            exit: Some(exit),
            ts,
            dur: Some(10),
            branch: branch.map(Into::into),
        })
        .unwrap()
    }

    fn sample() -> String {
        [
            entry("php artisan migrate", "/p/palr", 0, 1, Some("main")),
            entry("composer install", "/p/palr", 1, 2, Some("feat/x")),
            entry("git status", "/p/lume", 0, 3, Some("main")),
            entry("php artisan migrate", "/p/palr", 0, 4, Some("main")),
            "not json".into(),
            entry("composer update", "/p/other", 2, 5, None),
        ]
        .join("\n")
    }

    #[test]
    fn dedupes_newest_first_with_counts() {
        let hits = search_in(&sample(), "", None, 50);
        let cmds: Vec<&str> = hits.iter().map(|h| h.entry.cmd.as_str()).collect();
        assert_eq!(
            cmds,
            vec![
                "composer update",
                "php artisan migrate",
                "git status",
                "composer install"
            ]
        );
        let migrate = &hits[1];
        assert_eq!(migrate.count, 2);
        assert_eq!(migrate.entry.ts, 4);
    }

    #[test]
    fn filters_by_terms_status_cwd_branch_here() {
        let s = sample();
        let names = |q: &str, here: Option<&str>| -> Vec<String> {
            search_in(&s, q, here, 50)
                .into_iter()
                .map(|h| h.entry.cmd)
                .collect()
        };
        assert_eq!(names("artisan", None), vec!["php artisan migrate"]);
        assert_eq!(
            names("failed composer", None),
            vec!["composer update", "composer install"]
        );
        assert_eq!(
            names("failed:true project:palr", None),
            vec!["composer install"]
        );
        assert_eq!(
            names("ok branch:main", None),
            vec!["php artisan migrate", "git status"]
        );
        assert_eq!(names("here", Some("/p/lume")), vec!["git status"]);
        assert!(names("here", None).is_empty());
        assert_eq!(names("COMPOSER INSTALL", None), vec!["composer install"]);
    }

    #[test]
    fn append_skips_space_prefixed_and_compacts() {
        let dir = std::env::temp_dir().join(format!("lume_hist_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let path = dir.join(FILE_NAME);
        let mk = |cmd: &str| HistoryEntry {
            cmd: cmd.into(),
            cwd: None,
            exit: Some(0),
            ts: 1,
            dur: None,
            branch: None,
        };
        append_to(&path, mk(" secret --token x")).unwrap();
        append_to(&path, mk("  ")).unwrap();
        append_to(&path, mk("ls -la")).unwrap();
        let content = std::fs::read_to_string(&path).unwrap();
        assert_eq!(content.lines().count(), 1);
        assert!(content.contains("ls -la"));

        // Compaction keeps the newest KEEP_LINES lines.
        let many: String = (0..KEEP_LINES + 10)
            .map(|i| format!("{{\"cmd\":\"c{i}\",\"ts\":{i}}}\n"))
            .collect();
        std::fs::write(&path, many).unwrap();
        compact(&path);
        let content = std::fs::read_to_string(&path).unwrap();
        assert_eq!(content.lines().count(), KEEP_LINES);
        assert!(content
            .lines()
            .last()
            .unwrap()
            .contains(&format!("c{}", KEEP_LINES + 9)));
        assert!(!content.contains("\"c9\""));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn ignore_patterns_match_case_insensitively() {
        let pats = crate::config::default_history_ignore();
        assert!(is_ignored("export GITHUB_TOKEN=abc", &pats));
        assert!(is_ignored("mysql -u root --password=x", &pats));
        assert!(is_ignored("curl -H 'X-Api-Key: 1'", &["*api-key*".into()]));
        assert!(!is_ignored("git status", &pats));
        assert!(!is_ignored("ls", &["".into()]));
        assert!(is_ignored("ssh prod", &["ssh *".into()]));
    }
}
