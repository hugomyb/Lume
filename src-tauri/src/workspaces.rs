//! Workspaces: named, reopenable sets of tabs — each with its pane layout,
//! working directories and optional startup commands. Stored as one YAML file
//! per workspace so they can be hand-edited, shared and versioned:
//!
//! ```yaml
//! name: PALR
//! tabs:
//!   - title: Dev
//!     layout:
//!       split: row
//!       ratio: 0.5
//!       children:
//!         - cwd: ~/Projects/palr
//!           command: php artisan serve
//!         - cwd: ~/Projects/palr
//!           command: npm run dev
//!   - title: Queue
//!     layout:
//!       cwd: ~/Projects/palr
//!       command: php artisan queue:work
//! ```
//!
//! Commands are never run on Lume's own session restore — only when the user
//! explicitly opens a workspace "with its commands".

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum WsNode {
    Split {
        /// "row" (side by side) or "column" (stacked).
        split: String,
        #[serde(default = "half")]
        ratio: f64,
        children: Vec<WsNode>,
    },
    Pane {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        cwd: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        command: Option<String>,
    },
}

fn half() -> f64 {
    0.5
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WsTab {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    pub layout: WsNode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub tabs: Vec<WsTab>,
    /// Source filename, filled after parse (never read from / written to YAML).
    #[serde(skip_deserializing, default, skip_serializing_if = "String::is_empty")]
    pub source: String,
}

fn workspaces_dir() -> Option<PathBuf> {
    crate::paths::config_dir().map(|d| d.join("workspaces"))
}

#[tauri::command]
pub fn list_workspaces() -> Vec<Workspace> {
    let Some(dir) = workspaces_dir() else {
        return Vec::new();
    };
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
            if let Ok(mut ws) = serde_yaml::from_str::<Workspace>(&content) {
                if ws.name.trim().is_empty() || ws.tabs.is_empty() {
                    continue;
                }
                ws.source = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();
                out.push(ws);
            }
        }
    }
    out.sort_by_key(|w| w.name.to_lowercase());
    out
}

/// Create (`source` = None) or overwrite (`source` = existing file) a
/// workspace. A new one never clobbers an existing file. Returns the filename.
#[tauri::command]
pub fn save_workspace(workspace: Workspace, source: Option<String>) -> Result<String, String> {
    let name = workspace.name.trim().to_string();
    if name.is_empty() {
        return Err("name is required".into());
    }
    if workspace.tabs.is_empty() {
        return Err("a workspace needs at least one tab".into());
    }
    let dir = workspaces_dir().ok_or("no config directory")?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let file_name = match source {
        Some(s) => {
            crate::paths::validate_yaml_name(&s)?;
            s
        }
        None => {
            let slug = crate::paths::slugify(&name, "workspace");
            let mut candidate = format!("{slug}.yaml");
            let mut n = 2;
            while dir.join(&candidate).exists() {
                candidate = format!("{slug}-{n}.yaml");
                n += 1;
            }
            candidate
        }
    };
    let body = Workspace {
        name,
        description: workspace
            .description
            .map(|d| d.trim().to_string())
            .filter(|d| !d.is_empty()),
        tabs: workspace.tabs,
        source: String::new(),
    };
    let yaml = serde_yaml::to_string(&body).map_err(|e| e.to_string())?;
    std::fs::write(dir.join(&file_name), yaml).map_err(|e| e.to_string())?;
    Ok(file_name)
}

#[tauri::command]
pub fn delete_workspace(source: String) -> Result<(), String> {
    crate::paths::validate_yaml_name(&source)?;
    let dir = workspaces_dir().ok_or("no config directory")?;
    std::fs::remove_file(dir.join(&source)).map_err(|e| e.to_string())
}

/// Absolute path of a workspace file (to open it in the user's editor).
#[tauri::command]
pub fn workspace_file_path(source: String) -> Result<String, String> {
    crate::paths::validate_yaml_name(&source)?;
    let dir = workspaces_dir().ok_or("no config directory")?;
    Ok(dir.join(source).display().to_string())
}

/// Open the workspaces folder in the system file manager (created if needed).
#[tauri::command]
pub fn open_workspaces_dir(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let dir = workspaces_dir().ok_or("no config directory")?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    app.opener()
        .open_path(dir.display().to_string(), None::<&str>)
        .map_err(|e| e.to_string())
}

/// Expand `~` in a path coming from a workspace file, for the PTY spawn cwd.
#[tauri::command]
pub fn expand_path(path: String) -> String {
    crate::paths::expand_tilde(&path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_nested_layout() {
        let yaml = r#"
name: PALR
tabs:
  - title: Dev
    layout:
      split: row
      ratio: 0.6
      children:
        - cwd: ~/p
          command: php artisan serve
        - split: column
          children:
            - cwd: ~/p
            - {}
  - layout:
      cwd: /tmp
"#;
        let ws: Workspace = serde_yaml::from_str(yaml).unwrap();
        assert_eq!(ws.tabs.len(), 2);
        match &ws.tabs[0].layout {
            WsNode::Split {
                split,
                ratio,
                children,
            } => {
                assert_eq!(split, "row");
                assert!((ratio - 0.6).abs() < 1e-9);
                assert_eq!(
                    children[0],
                    WsNode::Pane {
                        cwd: Some("~/p".into()),
                        command: Some("php artisan serve".into())
                    }
                );
                match &children[1] {
                    WsNode::Split {
                        ratio, children, ..
                    } => {
                        assert!((ratio - 0.5).abs() < 1e-9);
                        assert_eq!(
                            children[1],
                            WsNode::Pane {
                                cwd: None,
                                command: None
                            }
                        );
                    }
                    other => panic!("expected split, got {other:?}"),
                }
            }
            other => panic!("expected split, got {other:?}"),
        }
        assert_eq!(ws.tabs[1].title, None);
    }

    #[test]
    fn roundtrips_without_source() {
        let ws = Workspace {
            name: "x".into(),
            description: None,
            tabs: vec![WsTab {
                title: Some("t".into()),
                layout: WsNode::Pane {
                    cwd: Some("/a".into()),
                    command: None,
                },
            }],
            source: "x.yaml".into(),
        };
        let mut copy = ws.clone();
        copy.source = String::new();
        let yaml = serde_yaml::to_string(&copy).unwrap();
        assert!(!yaml.contains("source"));
        assert!(!yaml.contains("command"));
        let back: Workspace = serde_yaml::from_str(&yaml).unwrap();
        assert_eq!(back.tabs, ws.tabs);
    }
}
