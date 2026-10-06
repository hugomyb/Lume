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
    // Explicit override (tests, portable setups) — honoured on every OS, unlike
    // XDG_CONFIG_HOME which Windows ignores.
    if let Some(dir) = std::env::var_os("LUME_CONFIG_DIR") {
        if !dir.is_empty() {
            return Some(PathBuf::from(dir));
        }
    }
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

/// Turn a display name into a safe on-disk file stem (ascii slug), falling
/// back to `fallback` when nothing ascii-alphanumeric is left.
pub fn slugify(name: &str, fallback: &str) -> String {
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
        fallback.to_string()
    } else if is_windows_reserved(slug) {
        // `con.yaml`, `nul.yaml`… are device names on Windows.
        format!("{slug}-{fallback}")
    } else {
        slug.to_string()
    }
}

fn is_windows_reserved(stem: &str) -> bool {
    matches!(stem, "con" | "prn" | "aux" | "nul")
        || ((stem.starts_with("com") || stem.starts_with("lpt"))
            && stem.len() == 4
            && stem.as_bytes()[3].is_ascii_digit())
}

/// A file name coming from the frontend must be a bare `*.yaml`/`*.yml` name
/// inside one of our own dirs — no separators, no traversal.
pub fn validate_yaml_name(source: &str) -> Result<(), String> {
    let lower = source.to_ascii_lowercase();
    let ok_ext = lower.ends_with(".yaml") || lower.ends_with(".yml");
    if source.is_empty()
        || !ok_ext
        || source.contains('/')
        || source.contains('\\')
        || source.contains("..")
    {
        return Err(format!("invalid file name: {source}"));
    }
    Ok(())
}

/// Expand a leading `~` (alone or followed by a separator) to the home dir.
pub fn expand_tilde(path: &str) -> String {
    if path == "~" || path.starts_with("~/") || path.starts_with("~\\") {
        if let Some(home) = home_dir() {
            return format!("{}{}", home.display(), &path[1..]);
        }
    }
    path.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugs_avoid_windows_device_names() {
        assert_eq!(slugify("CON", "workspace"), "con-workspace");
        assert_eq!(slugify("com1", "workspace"), "com1-workspace");
        assert_eq!(slugify("console", "workspace"), "console");
        assert_eq!(slugify("PALR", "workspace"), "palr");
    }

    #[test]
    fn yaml_names_accept_any_extension_case() {
        assert!(validate_yaml_name("Work.YAML").is_ok());
        assert!(validate_yaml_name("x.Yml").is_ok());
        assert!(validate_yaml_name("x.txt").is_err());
    }
}
