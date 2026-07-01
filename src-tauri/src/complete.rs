//! Filesystem completion for the terminal autocomplete.
//!
//! The frontend tracks the command line the user is typing and, for the token
//! under the cursor, asks us to list matching directory entries. We only do a
//! plain prefix match on a single directory level — the frontend rebuilds the
//! full completed token from `name` + the directory part it already had.

use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FsEntry {
    pub name: String,
    pub is_dir: bool,
}

/// Complete a path token against the filesystem.
///
/// `cwd` is the shell's current working directory (tracked via OSC 7). `token`
/// is the raw path fragment under the cursor, e.g. `src/Te`, `../`, `~/proj`.
/// Returns entries of the deepest existing directory whose name starts with the
/// trailing fragment. Directories sort first, then alphabetically.
#[tauri::command]
pub fn fs_complete(cwd: String, token: String) -> Vec<FsEntry> {
    complete_impl(&cwd, &token).unwrap_or_default()
}

/// List a directory's entries for the file-tree sidebar. Directories sort
/// first, then alphabetically (case-insensitive). Dotfiles are included only
/// when `show_hidden` is set.
#[tauri::command]
pub fn read_dir(path: String, show_hidden: bool) -> Result<Vec<FsEntry>, String> {
    let mut out = Vec::new();
    for entry in std::fs::read_dir(&path).map_err(|e| e.to_string())?.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') && !show_hidden {
            continue;
        }
        let is_dir = entry
            .file_type()
            .map(|t| t.is_dir() || (t.is_symlink() && entry.path().is_dir()))
            .unwrap_or(false);
        out.push(FsEntry { name, is_dir });
        if out.len() >= 5000 {
            break;
        }
    }
    out.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(out)
}

fn complete_impl(cwd: &str, token: &str) -> Option<Vec<FsEntry>> {
    // Split into the directory part (everything up to and including the last
    // path separator) and the prefix we match entries against. Accept '\' too
    // so Windows-style tokens complete.
    let (dir_part, prefix) = match token.rfind(['/', '\\']) {
        Some(i) => (&token[..=i], &token[i + 1..]),
        None => ("", token),
    };

    let base = resolve_dir(cwd, dir_part)?;

    let mut out = Vec::new();
    for entry in std::fs::read_dir(&base).ok()?.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        // Surface dotfiles only when the user explicitly typed a leading dot.
        if name.starts_with('.') && !prefix.starts_with('.') {
            continue;
        }
        if !name.starts_with(prefix) {
            continue;
        }
        let is_dir = entry
            .file_type()
            .map(|t| {
                // Resolve symlinks so linked directories also get a trailing '/'.
                t.is_dir() || (t.is_symlink() && entry.path().is_dir())
            })
            .unwrap_or(false);
        out.push(FsEntry { name, is_dir });
        if out.len() >= 500 {
            break;
        }
    }

    out.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    out.truncate(50);
    Some(out)
}

/// Resolve the directory part of a token to an absolute path, honouring `~`,
/// absolute paths, and paths relative to `cwd`.
fn resolve_dir(cwd: &str, dir_part: &str) -> Option<PathBuf> {
    if dir_part.is_empty() {
        return Some(PathBuf::from(cwd));
    }
    if dir_part == "~" || dir_part == "~/" || dir_part == "~\\" {
        return crate::paths::home_dir();
    }
    if let Some(rest) = dir_part
        .strip_prefix("~/")
        .or_else(|| dir_part.strip_prefix("~\\"))
    {
        return crate::paths::home_dir().map(|h| h.join(rest));
    }
    // `is_absolute` handles both `/foo` (Unix) and `C:\foo` (Windows).
    let p = Path::new(dir_part);
    if p.is_absolute() {
        return Some(p.to_path_buf());
    }
    Some(Path::new(cwd).join(dir_part))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_prefix_in_cwd() {
        let dir = std::env::temp_dir().join("lume_complete_test");
        let _ = std::fs::create_dir_all(dir.join("alpha_dir"));
        let _ = std::fs::write(dir.join("alpha_file.txt"), b"x");
        let _ = std::fs::write(dir.join("beta.txt"), b"x");

        let cwd = dir.to_string_lossy().to_string();
        let res = complete_impl(&cwd, "alph").unwrap();
        let names: Vec<&str> = res.iter().map(|e| e.name.as_str()).collect();
        assert!(names.contains(&"alpha_dir"));
        assert!(names.contains(&"alpha_file.txt"));
        assert!(!names.contains(&"beta.txt"));
        // Directories sort first.
        assert_eq!(res[0].name, "alpha_dir");
        assert!(res[0].is_dir);
    }

    #[test]
    fn hides_dotfiles_unless_dot_typed() {
        let dir = std::env::temp_dir().join("lume_complete_dot_test");
        let _ = std::fs::create_dir_all(&dir);
        let _ = std::fs::write(dir.join(".hidden"), b"x");
        let _ = std::fs::write(dir.join("visible"), b"x");

        let cwd = dir.to_string_lossy().to_string();
        let without_dot = complete_impl(&cwd, "").unwrap();
        assert!(without_dot.iter().all(|e| e.name != ".hidden"));
        let with_dot = complete_impl(&cwd, ".").unwrap();
        assert!(with_dot.iter().any(|e| e.name == ".hidden"));
    }
}
