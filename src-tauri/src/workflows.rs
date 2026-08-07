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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, alias = "default", skip_serializing_if = "Option::is_none")]
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

/// Lume's `workflows` dir under the per-user config directory.
fn workflows_dir() -> Option<PathBuf> {
    crate::paths::config_dir().map(|d| d.join("workflows"))
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

/// What gets written to disk: the Workflow fields minus the runtime-only
/// `source`, with empty optionals omitted so the YAML stays clean.
#[derive(Serialize)]
struct WorkflowFileBody {
    name: String,
    command: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    description: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    tags: Vec<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    arguments: Vec<WorkflowArg>,
}

/// Turn a workflow name into a safe on-disk file stem (ascii slug).
fn slugify(name: &str) -> String {
    let mut out = String::new();
    let mut prev_dash = true; // swallow leading dashes
    for c in name.chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c.to_ascii_lowercase());
            prev_dash = false;
        } else if !prev_dash {
            out.push('-');
            prev_dash = true;
        }
    }
    let slug = out.trim_end_matches('-');
    if slug.is_empty() {
        "workflow".to_string()
    } else {
        slug.to_string()
    }
}

/// A source filename coming from the frontend must be a bare `*.yaml`/`*.yml`
/// name inside our own dir — no separators, no traversal.
fn validate_source(source: &str) -> Result<(), String> {
    let ok_ext = source.ends_with(".yaml") || source.ends_with(".yml");
    if source.is_empty()
        || !ok_ext
        || source.contains('/')
        || source.contains('\\')
        || source.contains("..")
    {
        return Err(format!("invalid workflow file name: {source}"));
    }
    Ok(())
}

/// Create or update a workflow YAML file. `source` is the existing filename
/// when editing; when absent (new workflow) a fresh name is derived from the
/// workflow's name, never overwriting an existing file. Returns the filename.
#[tauri::command]
pub fn save_workflow(
    name: String,
    command: String,
    description: Option<String>,
    tags: Vec<String>,
    arguments: Vec<WorkflowArg>,
    source: Option<String>,
) -> Result<String, String> {
    let name = name.trim().to_string();
    let command = command.trim().to_string();
    if name.is_empty() || command.is_empty() {
        return Err("name and command are required".to_string());
    }

    let dir = workflows_dir().ok_or("no config directory")?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let file_name = match source {
        Some(s) => {
            validate_source(&s)?;
            s
        }
        None => {
            let slug = slugify(&name);
            let mut candidate = format!("{slug}.yaml");
            let mut n = 2;
            while dir.join(&candidate).exists() {
                candidate = format!("{slug}-{n}.yaml");
                n += 1;
            }
            candidate
        }
    };

    let body = WorkflowFileBody {
        name,
        command,
        description: description
            .map(|d| d.trim().to_string())
            .filter(|d| !d.is_empty()),
        tags: tags
            .into_iter()
            .map(|t| t.trim().to_string())
            .filter(|t| !t.is_empty())
            .collect(),
        arguments: arguments
            .into_iter()
            .filter(|a| !a.name.trim().is_empty())
            .map(|a| WorkflowArg {
                name: a.name.trim().to_string(),
                description: a
                    .description
                    .map(|d| d.trim().to_string())
                    .filter(|d| !d.is_empty()),
                default_value: a.default_value,
            })
            .collect(),
    };
    let yaml = serde_yaml::to_string(&body).map_err(|e| e.to_string())?;
    std::fs::write(dir.join(&file_name), yaml).map_err(|e| e.to_string())?;
    Ok(file_name)
}

#[tauri::command]
pub fn delete_workflow(source: String) -> Result<(), String> {
    validate_source(&source)?;
    let dir = workflows_dir().ok_or("no config directory")?;
    std::fs::remove_file(dir.join(&source)).map_err(|e| e.to_string())
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
    fn slugify_names() {
        assert_eq!(slugify("Git: commit all"), "git-commit-all");
        assert_eq!(slugify("  éàç!!  "), "workflow");
        assert_eq!(slugify(""), "workflow");
        assert_eq!(slugify("---"), "workflow");
        assert_eq!(slugify("Docker Logs 2"), "docker-logs-2");
    }

    #[test]
    fn source_validation() {
        assert!(validate_source("ok.yaml").is_ok());
        assert!(validate_source("ok.yml").is_ok());
        assert!(validate_source("no-ext").is_err());
        assert!(validate_source("../evil.yaml").is_err());
        assert!(validate_source("a/b.yaml").is_err());
        assert!(validate_source("a\\b.yaml").is_err());
        assert!(validate_source("").is_err());
    }

    #[test]
    fn file_body_roundtrips() {
        let body = WorkflowFileBody {
            name: "X".into(),
            command: "ls {{p}}".into(),
            description: None,
            tags: vec![],
            arguments: vec![WorkflowArg {
                name: "p".into(),
                description: None,
                default_value: Some(".".into()),
            }],
        };
        let yaml = serde_yaml::to_string(&body).unwrap();
        // Empty optionals are omitted from the file.
        assert!(!yaml.contains("description"));
        assert!(!yaml.contains("tags"));
        let parsed: Workflow = serde_yaml::from_str(&yaml).unwrap();
        assert_eq!(parsed.name, "X");
        assert_eq!(parsed.command, "ls {{p}}");
        assert_eq!(parsed.arguments[0].default_value.as_deref(), Some("."));
    }

    #[test]
    fn default_alias_works() {
        let wf: Workflow =
            serde_yaml::from_str("name: x\ncommand: ls {{p}}\narguments:\n  - name: p\n    default: \".\"").unwrap();
        assert_eq!(wf.arguments[0].default_value.as_deref(), Some("."));
    }
}
