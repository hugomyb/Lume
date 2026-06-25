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
    /// Action id → key combo overrides for the remappable shortcuts. Missing
    /// entries fall back to the frontend defaults.
    pub keybindings: std::collections::HashMap<String, String>,
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

pub fn config_path() -> Option<PathBuf> {
    std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".config/lume/config.toml"))
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
