use std::path::{Path, PathBuf};
use std::sync::Arc;

use anyhow::{Context, Result};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Config {
    pub appearance: AppearanceConfig,
    pub shell: ShellConfig,
    pub notifications: NotificationsConfig,
    pub ai: AiConfig,
    pub file_tree: FileTreeConfig,
    /// UI language code ("en", "fr", …). Defaults to English.
    #[serde(default = "default_language")]
    pub language: String,
    /// Action id → key combo overrides for the remappable shortcuts. Missing
    /// entries fall back to the frontend defaults.
    pub keybindings: std::collections::HashMap<String, String>,
}

fn default_language() -> String {
    "en".to_string()
}

/// AI provider configuration. The assistant is driven by a local CLI (like
/// `claude` today). `provider` selects which one; each known provider has a
/// fixed invocation resolved in `ai.rs`, plus an optional API key injected into
/// the child process environment. `custom` lets power users wire any CLI.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AiConfig {
    /// "claude" | "codex" | "custom" (CLI) | "openai" | "deepseek" | "api" (HTTP).
    pub provider: String,
    /// Optional model for Claude (e.g. "sonnet", "opus"); empty = provider default.
    pub claude_model: String,
    /// Optional model for Codex; empty = provider default.
    pub codex_model: String,
    /// API key for Codex, injected as `OPENAI_API_KEY` (optional — `codex
    /// login` also works).
    pub codex_api_key: String,
    /// Custom provider: executable resolved via PATH.
    pub custom_command: String,
    /// Custom provider arguments; a literal `{prompt}` token is replaced by the
    /// prompt (appended as a final arg if the token is absent).
    pub custom_args: Vec<String>,
    /// Optional API key for the custom provider.
    pub custom_api_key: String,
    /// Env var name that receives `custom_api_key` (e.g. "OPENAI_API_KEY").
    pub custom_key_env: String,
    // --- API (OpenAI-compatible) providers ---
    pub openai_api_key: String,
    pub openai_model: String,
    pub deepseek_api_key: String,
    pub deepseek_model: String,
    /// Generic OpenAI-compatible endpoint (Ollama, Groq, OpenRouter, …).
    pub api_base_url: String,
    pub api_api_key: String,
    pub api_model: String,
}

impl Default for AiConfig {
    fn default() -> Self {
        Self {
            provider: "claude".to_string(),
            claude_model: String::new(),
            codex_model: String::new(),
            codex_api_key: String::new(),
            custom_command: String::new(),
            custom_args: vec!["{prompt}".to_string()],
            custom_api_key: String::new(),
            custom_key_env: String::new(),
            openai_api_key: String::new(),
            openai_model: String::new(),
            deepseek_api_key: String::new(),
            deepseek_model: String::new(),
            api_base_url: String::new(),
            api_api_key: String::new(),
            api_model: String::new(),
        }
    }
}

impl AiConfig {
    /// A copy with every secret blanked — used before exporting the config so
    /// API keys never leak into a shared backup file.
    pub fn without_secrets(&self) -> Self {
        Self {
            codex_api_key: String::new(),
            custom_api_key: String::new(),
            openai_api_key: String::new(),
            deepseek_api_key: String::new(),
            api_api_key: String::new(),
            ..self.clone()
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct NotificationsConfig {
    /// Fire a desktop notification when a long command finishes unfocused.
    pub enabled: bool,
    /// Minimum command duration (seconds) before notifying.
    pub min_duration_sec: u32,
    /// Play a sound with the notification.
    pub sound: bool,
}

impl Default for NotificationsConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            min_duration_sec: 10,
            sound: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AppearanceConfig {
    pub font_family: String,
    pub font_size: u16,
    pub cursor_blink: bool,
    /// "block" | "bar" | "underline"
    pub cursor_style: String,
    pub scrollback: u32,
    pub theme: ThemeConfig,
}

impl Default for AppearanceConfig {
    fn default() -> Self {
        Self {
            font_family:
                r#"Menlo, "DejaVu Sans Mono", "Liberation Mono", Consolas, monospace"#
                    .to_string(),
            font_size: 14,
            cursor_blink: true,
            cursor_style: "block".to_string(),
            scrollback: 5000,
            theme: ThemeConfig::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct ThemeConfig {
    pub background: String,
    pub foreground: String,
    pub cursor: String,
    pub selection: String,
    pub accent: String,
    pub black: String,
    pub red: String,
    pub green: String,
    pub yellow: String,
    pub blue: String,
    pub magenta: String,
    pub cyan: String,
    pub white: String,
    pub bright_black: String,
    pub bright_red: String,
    pub bright_green: String,
    pub bright_yellow: String,
    pub bright_blue: String,
    pub bright_magenta: String,
    pub bright_cyan: String,
    pub bright_white: String,
}

impl Default for ThemeConfig {
    fn default() -> Self {
        Self {
            background: "#0e1014".into(),
            foreground: "#e6e6e6".into(),
            cursor: "#e6e6e6".into(),
            selection: "#3a4150".into(),
            accent: "#4ea1ff".into(),
            black: "#2c303a".into(),
            red: "#ff5c8d".into(),
            green: "#56d364".into(),
            yellow: "#e3b341".into(),
            blue: "#4ea1ff".into(),
            magenta: "#c678dd".into(),
            cyan: "#56b6c2".into(),
            white: "#c0c4ce".into(),
            bright_black: "#525866".into(),
            bright_red: "#ff7ba0".into(),
            bright_green: "#7ce081".into(),
            bright_yellow: "#f0c674".into(),
            bright_blue: "#73b5ff".into(),
            bright_magenta: "#d49eea".into(),
            bright_cyan: "#7fc8d3".into(),
            bright_white: "#e6e9f0".into(),
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct ShellConfig {
    pub program: Option<String>,
    pub args: Vec<String>,
}

/// Command templates run by the file-tree context menu. `{path}` is replaced
/// (POSIX-quoted) by the clicked entry's path before running in the terminal.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct FileTreeConfig {
    pub dir_list: String,
    pub dir_open: String,
    pub file_view: String,
    pub file_edit: String,
    pub file_open: String,
}

impl Default for FileTreeConfig {
    #[cfg(windows)]
    fn default() -> Self {
        Self {
            dir_list: "dir {path}".to_string(),
            dir_open: "explorer {path}".to_string(),
            file_view: "type {path}".to_string(),
            file_edit: "notepad {path}".to_string(),
            file_open: "notepad {path}".to_string(),
        }
    }

    #[cfg(not(windows))]
    fn default() -> Self {
        Self {
            dir_list: "ls -la {path}".to_string(),
            dir_open: "${EDITOR:-nano} {path}".to_string(),
            file_view: "cat {path}".to_string(),
            file_edit: "nano {path}".to_string(),
            file_open: "${EDITOR:-nano} {path}".to_string(),
        }
    }
}

pub fn config_path() -> Option<PathBuf> {
    crate::paths::config_dir().map(|d| d.join("config.toml"))
}

pub fn load() -> Config {
    let Some(path) = config_path() else {
        eprintln!("[lume] HOME not set — using defaults");
        return Config::default();
    };
    if !path.exists() {
        if let Err(e) = write_default(&path) {
            eprintln!(
                "[lume] could not create default config at {}: {e}",
                path.display()
            );
        } else {
            eprintln!("[lume] wrote default config to {}", path.display());
        }
        return Config::default();
    }
    match std::fs::read_to_string(&path) {
        Ok(s) => match toml::from_str::<Config>(&s) {
            Ok(c) => c,
            Err(e) => {
                eprintln!(
                    "[lume] config parse error in {}: {e} — using defaults",
                    path.display()
                );
                Config::default()
            }
        },
        Err(e) => {
            eprintln!("[lume] could not read {}: {e}", path.display());
            Config::default()
        }
    }
}

#[tauri::command]
pub fn get_config(state: State<'_, Arc<Mutex<Config>>>) -> Config {
    state.lock().clone()
}

/// Persist the config to disk and update the in-memory copy so newly-spawned
/// shells pick up shell changes without a restart.
#[tauri::command]
pub fn save_config(
    state: State<'_, Arc<Mutex<Config>>>,
    config: Config,
) -> Result<(), String> {
    let path = config_path().ok_or_else(|| "HOME not set".to_string())?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let body = toml::to_string_pretty(&config).map_err(|e| e.to_string())?;
    std::fs::write(&path, body).map_err(|e| e.to_string())?;
    *state.lock() = config;
    Ok(())
}

/// Export the given config to a file as pretty JSON (for backup / sharing).
#[tauri::command]
pub fn export_config(path: String, config: Config) -> Result<(), String> {
    // Never write API keys into a shared/backup file.
    let mut safe = config;
    safe.ai = safe.ai.without_secrets();
    let body = serde_json::to_string_pretty(&safe).map_err(|e| e.to_string())?;
    std::fs::write(&path, body).map_err(|e| e.to_string())
}

/// Read + parse a config file (our JSON export, or a raw `config.toml`).
/// Tolerant to missing fields — serde defaults fill them in.
#[tauri::command]
pub fn import_config(path: String) -> Result<Config, String> {
    let s = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str::<Config>(&s)
        .or_else(|_| toml::from_str::<Config>(&s))
        .map_err(|e| format!("invalid config file: {e}"))
}

fn write_default(path: &Path) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("create dir {}", parent.display()))?;
    }
    std::fs::write(path, DEFAULT_TOML).with_context(|| format!("write {}", path.display()))?;
    Ok(())
}

const DEFAULT_TOML: &str = r##"# Lume configuration
# Edit this file to customize Lume. Restart the app to apply changes.

[appearance]
fontFamily = "Menlo, \"DejaVu Sans Mono\", \"Liberation Mono\", Consolas, monospace"
fontSize = 14
cursorBlink = true
cursorStyle = "block"
scrollback = 5000

[appearance.theme]
background = "#0e1014"
foreground = "#e6e6e6"
cursor = "#e6e6e6"
selection = "#3a4150"
accent = "#4ea1ff"

black           = "#2c303a"
red             = "#ff5c8d"
green           = "#56d364"
yellow          = "#e3b341"
blue            = "#4ea1ff"
magenta         = "#c678dd"
cyan            = "#56b6c2"
white           = "#c0c4ce"

brightBlack     = "#525866"
brightRed       = "#ff7ba0"
brightGreen     = "#7ce081"
brightYellow    = "#f0c674"
brightBlue      = "#73b5ff"
brightMagenta   = "#d49eea"
brightCyan      = "#7fc8d3"
brightWhite     = "#e6e9f0"

[shell]
# program = "/bin/zsh"
# args = ["-l"]
"##;
