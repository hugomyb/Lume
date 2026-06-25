//! Workflows: parameterized command templates stored as YAML files, browsable
//! from a palette. Format is Warp-compatible so files can be shared:
//!
//! ```yaml
//! name: "Git: commit all"
//! command: git add -A && git commit -m "{{message}}"
//! description: Stage everything and commit
//! tags: [git]
//! arguments:
//!   - name: message
//!     description: Commit message
//!     default_value: ""
//! ```
//!
//! Placeholders are `{{name}}`. The frontend fills them in before inserting the
//! command into the active terminal.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowArg {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default, alias = "default")]
    pub default_value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workflow {
    pub name: String,
    pub command: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub arguments: Vec<WorkflowArg>,
    /// Source filename, filled after parse (never read from the YAML).
    #[serde(skip_deserializing, default)]
    pub source: String,
}

/// `$XDG_CONFIG_HOME/lume/workflows` (falls back to `~/.config/lume/workflows`).
fn workflows_dir() -> Option<PathBuf> {
    let base = std::env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".config")))?;
    Some(base.join("lume").join("workflows"))
}

#[tauri::command]
pub fn list_workflows() -> Vec<Workflow> {
    let dir = match workflows_dir() {
        Some(d) => d,
        None => return Vec::new(),
    };

    // First run: create the directory and drop in a few starter workflows so
    // the palette isn't empty. We only seed when creating it fresh, never over
    // existing user files.
    if !dir.exists() {
        if std::fs::create_dir_all(&dir).is_ok() {
            seed_examples(&dir);
        }
    }

    let mut out = Vec::new();
    if let Ok(rd) = std::fs::read_dir(&dir) {
        for entry in rd.flatten() {
            let path = entry.path();
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_ascii_lowercase();
            if ext != "yaml" && ext != "yml" {
                continue;
            }
            let Ok(content) = std::fs::read_to_string(&path) else {
                continue;
            };
            // Skip malformed files rather than failing the whole list.
            if let Ok(mut wf) = serde_yaml::from_str::<Workflow>(&content) {
                if wf.name.trim().is_empty() || wf.command.trim().is_empty() {
                    continue;
                }
                wf.source = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();
                out.push(wf);
            }
        }
    }

    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    out
}

fn seed_examples(dir: &std::path::Path) {
    const EXAMPLES: &[(&str, &str)] = &[
        (
            "git-commit-all.yaml",
            r#"name: "Git: commit all"
command: git add -A && git commit -m "{{message}}"
description: Stage every change and commit with a message.
tags: [git]
arguments:
  - name: message
    description: Commit message
    default_value: ""
"#,
        ),
        (
            "docker-logs.yaml",
            r#"name: "Docker: follow logs"
command: docker logs -f --tail {{lines}} {{container}}
description: Tail and follow a container's logs.
tags: [docker]
arguments:
  - name: container
    description: Container name or id
    default_value: ""
  - name: lines
    description: Lines of history to show
    default_value: "100"
"#,
        ),
        (
            "find-largest-files.yaml",
            r#"name: "Find: largest files"
command: find {{path}} -type f -printf '%s\t%p\n' | sort -rn | head -n {{count}}
description: List the largest files under a directory.
tags: [files]
arguments:
  - name: path
    description: Directory to scan
    default_value: "."
  - name: count
    description: How many to show
    default_value: "20"
"#,
        ),
        (
            "grep-project.yaml",
            r#"name: "Search: grep in project"
command: grep -rn --color=always "{{pattern}}" {{path}}
description: Recursively search for a pattern.
tags: [search]
arguments:
  - name: pattern
    description: Text or regex to search for
    default_value: ""
  - name: path
    description: Where to search
    default_value: "."
"#,
        ),
    ];

    for (name, body) in EXAMPLES {
        let _ = std::fs::write(dir.join(name), body);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_workflow_yaml() {
        let yaml = r#"name: "Git: commit"
command: git commit -m "{{msg}}"
description: commit
tags: [git, vcs]
arguments:
  - name: msg
    description: message
    default_value: "wip"
"#;
        let wf: Workflow = serde_yaml::from_str(yaml).unwrap();
        assert_eq!(wf.name, "Git: commit");
        assert_eq!(wf.command, r#"git commit -m "{{msg}}""#);
        assert_eq!(wf.tags, vec!["git", "vcs"]);
        assert_eq!(wf.arguments.len(), 1);
        assert_eq!(wf.arguments[0].name, "msg");
        assert_eq!(wf.arguments[0].default_value.as_deref(), Some("wip"));
    }

    #[test]
    fn parses_minimal_workflow() {
        let wf: Workflow = serde_yaml::from_str("name: x\ncommand: ls").unwrap();
        assert_eq!(wf.name, "x");
        assert!(wf.arguments.is_empty());
        assert!(wf.tags.is_empty());
        assert!(wf.description.is_none());
    }

    #[test]
    fn default_alias_works() {
        let wf: Workflow =
            serde_yaml::from_str("name: x\ncommand: ls {{p}}\narguments:\n  - name: p\n    default: \".\"").unwrap();
        assert_eq!(wf.arguments[0].default_value.as_deref(), Some("."));
    }
}
