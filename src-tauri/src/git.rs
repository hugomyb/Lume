//! Lightweight git context: the current branch of a directory, read straight
//! from `.git/HEAD`. No `git` process is spawned — this runs on every cwd
//! change and after every command, so it has to cost microseconds, not the
//! tens of milliseconds a `git status` takes on a large repo.

use std::path::{Path, PathBuf};

use serde::Serialize;

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GitInfo {
    /// Branch name, or the short commit hash when HEAD is detached.
    pub branch: String,
    pub detached: bool,
}

#[tauri::command]
pub fn git_info(cwd: String) -> Option<GitInfo> {
    let git_dir = find_git_dir(Path::new(&cwd))?;
    let head = std::fs::read_to_string(git_dir.join("HEAD")).ok()?;
    parse_head(&head)
}

/// Walk up from `start` to the first directory holding a `.git` entry. A
/// `.git` *file* (worktrees, submodules) points at the real git dir with a
/// `gitdir: <path>` line, relative to the file's directory.
fn find_git_dir(start: &Path) -> Option<PathBuf> {
    for dir in start.ancestors() {
        let dot = dir.join(".git");
        let Ok(meta) = std::fs::metadata(&dot) else {
            continue;
        };
        if meta.is_dir() {
            return Some(dot);
        }
        if meta.is_file() {
            let content = std::fs::read_to_string(&dot).ok()?;
            let target = content
                .lines()
                .find_map(|l| l.strip_prefix("gitdir:"))?
                .trim();
            let p = Path::new(target);
            return Some(if p.is_absolute() {
                p.to_path_buf()
            } else {
                dir.join(p)
            });
        }
    }
    None
}

fn parse_head(head: &str) -> Option<GitInfo> {
    let head = head.trim();
    if let Some(r) = head.strip_prefix("ref:") {
        let r = r.trim();
        let branch = r.strip_prefix("refs/heads/").unwrap_or(r);
        if branch.is_empty() {
            return None;
        }
        return Some(GitInfo {
            branch: branch.to_string(),
            detached: false,
        });
    }
    if head.len() >= 7 && head.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Some(GitInfo {
            branch: head[..7].to_string(),
            detached: true,
        });
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn parses_branch_and_detached_heads() {
        assert_eq!(
            parse_head("ref: refs/heads/feat/login\n"),
            Some(GitInfo {
                branch: "feat/login".into(),
                detached: false
            })
        );
        assert_eq!(
            parse_head("3758353a1b2c3d4e5f60718293a4b5c6d7e8f901\n"),
            Some(GitInfo {
                branch: "3758353".into(),
                detached: true
            })
        );
        assert_eq!(parse_head("garbage"), None);
    }

    #[test]
    fn finds_repo_from_subdir_and_worktree_file() {
        let base = std::env::temp_dir().join(format!("lume_git_{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(base.join("repo/.git")).unwrap();
        fs::create_dir_all(base.join("repo/src/deep")).unwrap();
        fs::write(base.join("repo/.git/HEAD"), "ref: refs/heads/main\n").unwrap();
        let info = git_info(base.join("repo/src/deep").display().to_string()).unwrap();
        assert_eq!(info.branch, "main");

        // Worktree: `.git` file pointing at another git dir.
        fs::create_dir_all(base.join("wt")).unwrap();
        fs::create_dir_all(base.join("repo/.git/worktrees/wt")).unwrap();
        fs::write(
            base.join("repo/.git/worktrees/wt/HEAD"),
            "ref: refs/heads/hotfix\n",
        )
        .unwrap();
        fs::write(base.join("wt/.git"), "gitdir: ../repo/.git/worktrees/wt\n").unwrap();
        assert_eq!(
            git_info(base.join("wt").display().to_string())
                .unwrap()
                .branch,
            "hotfix"
        );

        assert!(git_info(
            std::env::temp_dir()
                .join("lume_definitely_not_a_repo_xyz")
                .display()
                .to_string()
        )
        .is_none());
        let _ = fs::remove_dir_all(&base);
    }
}
