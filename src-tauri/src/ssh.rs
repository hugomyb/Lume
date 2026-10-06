//! SSH manager: parses `~/.ssh/config` (following `Include`s) into a list of
//! hosts the palette can browse. Connecting just opens a new terminal that runs
//! `ssh <host>`, so the local ssh client applies every option of the config
//! (IdentityFile, ProxyJump, forwards…) and handles auth/agent/known-hosts
//! exactly as usual — the fields parsed here are only for display.

use std::path::{Path, PathBuf};

use serde::Serialize;

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SshHost {
    /// The `Host` alias — what you'd type as `ssh <name>`.
    pub name: String,
    pub host_name: Option<String>,
    pub user: Option<String>,
    pub port: Option<String>,
    pub proxy_jump: Option<String>,
}

/// Maximum `Include` nesting (ssh itself caps recursion at 16).
const MAX_INCLUDE_DEPTH: usize = 8;

#[tauri::command]
pub fn list_ssh_hosts() -> Vec<SshHost> {
    let Some(home) = crate::paths::home_dir() else {
        return Vec::new();
    };
    let ssh_dir = home.join(".ssh");
    let mut hosts = Vec::new();
    parse_file(&ssh_dir.join("config"), &ssh_dir, 0, &mut hosts);
    hosts
}

/// Which optional remote-session helpers are installed locally.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshTools {
    pub mosh: bool,
}

#[tauri::command]
pub fn ssh_tools() -> SshTools {
    SshTools {
        mosh: which("mosh"),
    }
}

fn which(name: &str) -> bool {
    // macOS: a Finder-launched app gets launchd's minimal PATH, without
    // /opt/homebrew/bin — where mosh lives. Use the login-shell PATH the
    // terminal itself spawns with (see pty.rs).
    let path = if cfg!(target_os = "macos") {
        Some(std::ffi::OsString::from(crate::env_fix::user_path()))
    } else {
        std::env::var_os("PATH")
    };
    let Some(path) = path else {
        return false;
    };
    std::env::split_paths(&path).any(|dir| {
        let p = dir.join(name);
        p.is_file() || (cfg!(windows) && dir.join(format!("{name}.exe")).is_file())
    })
}

fn parse_file(path: &Path, ssh_dir: &Path, depth: usize, hosts: &mut Vec<SshHost>) {
    if depth > MAX_INCLUDE_DEPTH {
        return;
    }
    let Ok(content) = std::fs::read_to_string(path) else {
        return;
    };
    parse_into(&content, ssh_dir, depth, hosts);
}

fn parse_into(content: &str, ssh_dir: &Path, depth: usize, hosts: &mut Vec<SshHost>) {
    // Indices (into `hosts`) of the aliases declared by the current `Host`
    // line; subsequent options apply to all of them.
    let mut current: Vec<usize> = Vec::new();

    for raw in content.lines() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let (key, value) = split_kv(line);
        let key = key.to_ascii_lowercase();

        match key.as_str() {
            "host" => {
                current.clear();
                for alias in value.split_whitespace() {
                    // Skip negations and patterns — they aren't concrete hosts.
                    if alias.starts_with('!') || alias.contains('*') || alias.contains('?') {
                        continue;
                    }
                    // A host declared twice (across includes too) is one entry:
                    // like ssh, the first value obtained for an option wins.
                    let idx = match hosts.iter().position(|h| h.name == alias) {
                        Some(i) => i,
                        None => {
                            hosts.push(SshHost {
                                name: alias.to_string(),
                                host_name: None,
                                user: None,
                                port: None,
                                proxy_jump: None,
                            });
                            hosts.len() - 1
                        }
                    };
                    current.push(idx);
                }
            }
            // A Match block's options apply conditionally — never to a listed
            // alias as such.
            "match" => current.clear(),
            "include" => {
                for pattern in value.split_whitespace() {
                    for file in expand_include(pattern, ssh_dir) {
                        parse_file(&file, ssh_dir, depth + 1, hosts);
                    }
                }
            }
            _ if !current.is_empty() && !value.is_empty() => {
                for &i in &current {
                    let h = &mut hosts[i];
                    let slot = match key.as_str() {
                        "hostname" => &mut h.host_name,
                        "user" => &mut h.user,
                        "port" => &mut h.port,
                        "proxyjump" => &mut h.proxy_jump,
                        _ => continue,
                    };
                    if slot.is_none() {
                        *slot = Some(value.to_string());
                    }
                }
            }
            _ => {}
        }
    }
}

/// Resolve an `Include` argument to files: `~` expands to home, relative paths
/// are relative to `~/.ssh`, and `*`/`?` wildcards are allowed in the file
/// name (the common `config.d/*` form). Matches are sorted, as ssh does.
fn expand_include(pattern: &str, ssh_dir: &Path) -> Vec<PathBuf> {
    let expanded = crate::paths::expand_tilde(pattern);
    let p = Path::new(&expanded);
    let full = if p.is_absolute() {
        p.to_path_buf()
    } else {
        ssh_dir.join(p)
    };
    let Some(name) = full.file_name().and_then(|n| n.to_str()) else {
        return Vec::new();
    };
    if !name.contains('*') && !name.contains('?') {
        return vec![full];
    }
    let Some(parent) = full.parent() else {
        return Vec::new();
    };
    let mut out: Vec<PathBuf> = std::fs::read_dir(parent)
        .map(|rd| {
            rd.flatten()
                .filter(|e| e.file_type().map(|t| t.is_file()).unwrap_or(false))
                .filter(|e| glob_match(name, &e.file_name().to_string_lossy()))
                .map(|e| e.path())
                .collect()
        })
        .unwrap_or_default();
    out.sort();
    out
}

/// Minimal `*` / `?` wildcard matcher (no character classes).
pub(crate) fn glob_match(pattern: &str, name: &str) -> bool {
    let p: Vec<char> = pattern.chars().collect();
    let n: Vec<char> = name.chars().collect();
    let (mut pi, mut ni) = (0usize, 0usize);
    let (mut star, mut mark) = (None::<usize>, 0usize);
    while ni < n.len() {
        if pi < p.len() && (p[pi] == '?' || p[pi] == n[ni]) {
            pi += 1;
            ni += 1;
        } else if pi < p.len() && p[pi] == '*' {
            star = Some(pi);
            mark = ni;
            pi += 1;
        } else if let Some(s) = star {
            pi = s + 1;
            mark += 1;
            ni = mark;
        } else {
            return false;
        }
    }
    while pi < p.len() && p[pi] == '*' {
        pi += 1;
    }
    pi == p.len()
}

/// Split an ssh_config line into keyword and value. The separator is whitespace
/// and/or a single `=` (both forms are valid in ssh_config).
fn split_kv(line: &str) -> (&str, &str) {
    match line.find(|c: char| c.is_whitespace() || c == '=') {
        Some(idx) => {
            let key = &line[..idx];
            let value = line[idx..]
                .trim_start_matches(|c: char| c.is_whitespace() || c == '=')
                .trim();
            (key, value)
        }
        None => (line, ""),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(content: &str) -> Vec<SshHost> {
        let mut hosts = Vec::new();
        parse_into(content, Path::new("/nonexistent"), 0, &mut hosts);
        hosts
    }

    #[test]
    fn parses_hosts_and_options() {
        let cfg = "\
Host web prod-web
    HostName 10.0.0.1
    User deploy
    Port 2222
    ProxyJump bastion

# a comment
Host db
    HostName db.internal
";
        let hosts = parse(cfg);
        assert_eq!(hosts.len(), 3); // web, prod-web, db
        let web = hosts.iter().find(|h| h.name == "web").unwrap();
        assert_eq!(web.host_name.as_deref(), Some("10.0.0.1"));
        assert_eq!(web.user.as_deref(), Some("deploy"));
        assert_eq!(web.port.as_deref(), Some("2222"));
        assert_eq!(web.proxy_jump.as_deref(), Some("bastion"));
        // The second alias on the same Host line shares the options.
        let pw = hosts.iter().find(|h| h.name == "prod-web").unwrap();
        assert_eq!(pw.user.as_deref(), Some("deploy"));
        let db = hosts.iter().find(|h| h.name == "db").unwrap();
        assert_eq!(db.host_name.as_deref(), Some("db.internal"));
        assert!(db.user.is_none());
    }

    #[test]
    fn skips_wildcard_hosts() {
        let cfg = "Host *\n    User root\nHost real\n    HostName x\n";
        let hosts = parse(cfg);
        assert_eq!(hosts.len(), 1);
        assert_eq!(hosts[0].name, "real");
    }

    #[test]
    fn handles_equals_separator() {
        let cfg = "Host=gateway\nHostName=gw.example.com\n";
        let hosts = parse(cfg);
        assert_eq!(hosts.len(), 1);
        assert_eq!(hosts[0].name, "gateway");
        assert_eq!(hosts[0].host_name.as_deref(), Some("gw.example.com"));
    }

    #[test]
    fn first_value_wins_and_match_blocks_are_ignored() {
        let cfg = "\
Host a
    User first
Match host a
    User fromMatch
Host a
    User second
    Port 22
";
        let hosts = parse(cfg);
        assert_eq!(hosts.len(), 1);
        assert_eq!(hosts[0].user.as_deref(), Some("first"));
        assert_eq!(hosts[0].port.as_deref(), Some("22"));
    }

    #[test]
    fn follows_includes_with_globs() {
        let base = std::env::temp_dir().join(format!("lume_ssh_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&base);
        std::fs::create_dir_all(base.join("config.d")).unwrap();
        std::fs::write(
            base.join("config"),
            "Include config.d/*\nHost main\n    HostName m\n",
        )
        .unwrap();
        std::fs::write(base.join("config.d/10-work"), "Host work\n    User w\n").unwrap();
        std::fs::write(
            base.join("config.d/20-home"),
            "Host pi\n    HostName 192.168.1.20\n",
        )
        .unwrap();
        // Self-include must not loop forever.
        std::fs::write(base.join("config.d/30-loop"), "Include config.d/30-loop\n").unwrap();
        let mut hosts = Vec::new();
        parse_file(&base.join("config"), &base, 0, &mut hosts);
        let names: Vec<&str> = hosts.iter().map(|h| h.name.as_str()).collect();
        assert_eq!(names, vec!["work", "pi", "main"]);
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn glob_matching() {
        assert!(glob_match("*", "anything"));
        assert!(glob_match("*.conf", "a.conf"));
        assert!(!glob_match("*.conf", "a.conf.bak"));
        assert!(glob_match("h?st", "host"));
        assert!(!glob_match("h?st", "hst"));
        assert!(glob_match("a*b*c", "aXXbYYc"));
    }
}
