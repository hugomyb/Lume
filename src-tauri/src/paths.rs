//! Cross-platform user paths.
//!
//! Lume stores its config, fonts and shell-integration scripts under a single
//! per-user directory. On Unix that's `$XDG_CONFIG_HOME/lume` (or
//! `~/.config/lume`); on Windows it's `%APPDATA%\lume`.

use std::path::PathBuf;

/// The user's home directory (`$HOME` on Unix, `%USERPROFILE%` on Windows).
pub fn home_dir() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        return std::env::var_os("USERPROFILE")
            .or_else(|| std::env::var_os("HOME"))
            .map(PathBuf::from);
    }
    #[cfg(not(windows))]
    {
        std::env::var_os("HOME").map(PathBuf::from)
    }
}

/// Lume's per-user config directory.
///  - Unix:    `$XDG_CONFIG_HOME/lume` or `~/.config/lume`
///  - Windows: `%APPDATA%\lume`
pub fn config_dir() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        return std::env::var_os("APPDATA")
            .map(PathBuf::from)
            .or_else(|| home_dir().map(|h| h.join("AppData").join("Roaming")))
            .map(|base| base.join("lume"));
    }
    #[cfg(not(windows))]
    {
        if let Some(xdg) = std::env::var_os("XDG_CONFIG_HOME") {
            if !xdg.is_empty() {
                return Some(PathBuf::from(xdg).join("lume"));
            }
        }
        home_dir().map(|h| h.join(".config").join("lume"))
    }
}
