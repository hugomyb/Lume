//! Font management for the settings UI:
//!  - `list_system_fonts`: monospace families installed on the system (fontconfig).
//!  - `import_font` / `list_custom_fonts`: user-imported font files stored in
//!    `~/.config/lume/fonts/`, returned as base64 so the frontend can register
//!    them with the FontFace API (works without an asset-protocol scope).

use std::path::PathBuf;
use std::sync::OnceLock;

use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use serde::Serialize;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CustomFont {
    pub family: String,
    pub file_name: String,
    pub data_b64: String,
}

fn fonts_dir() -> Option<PathBuf> {
    crate::paths::config_dir().map(|d| d.join("fonts"))
}

/// Monospace font families available on the system. Uses `fc-list` when present
/// (Linux, and macOS if fontconfig is installed); otherwise falls back to a
/// curated list of monospace families that ship with the OS. Users can always
/// import their own font files on top of this.
#[tauri::command]
pub fn list_system_fonts() -> Vec<String> {
    let families = fc_list_families();
    if !families.is_empty() {
        return families;
    }
    // macOS has no fontconfig, so `fc-list` finds nothing and the picker used to
    // fall straight through to the six curated names below — a user who had
    // installed JetBrains Mono or Fira Code simply could not see it. Read the
    // font directories instead. Cached: this parses every installed face, and
    // the set only changes when the user installs a font (a restart picks it up).
    if cfg!(target_os = "macos") {
        static CACHE: OnceLock<Vec<String>> = OnceLock::new();
        let scanned = CACHE.get_or_init(|| {
            let mut found = scan_font_families(&macos_font_dirs());
            // Keep the curated names as a floor: a few system faces ship as
            // .dfont (which ttf-parser won't read) or live outside these dirs.
            for f in fallback_monospace_families() {
                if !found.iter().any(|s| s.eq_ignore_ascii_case(&f)) {
                    found.push(f);
                }
            }
            found.sort_by_key(|s| s.to_lowercase());
            found
        });
        if !scanned.is_empty() {
            return scanned.clone();
        }
    }
    fallback_monospace_families()
}

/// Where macOS keeps fonts, system-wide then per-user.
fn macos_font_dirs() -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = [
        "/System/Library/Fonts",
        "/System/Library/Fonts/Supplemental",
        "/Library/Fonts",
    ]
    .iter()
    .map(PathBuf::from)
    .collect();
    if let Some(home) = crate::paths::home_dir() {
        dirs.push(home.join("Library").join("Fonts"));
    }
    dirs
}

/// Monospace family names read out of the font files in `dirs`.
///
/// Takes the directories as an argument rather than hardcoding them so the
/// logic is exercisable on any platform (see tests) — it is only *called* on
/// macOS, but keeping it platform-agnostic means it still compiles and is
/// type-checked everywhere else.
fn scan_font_families(dirs: &[PathBuf]) -> Vec<String> {
    let mut families: Vec<String> = Vec::new();
    for dir in dirs {
        collect_families(dir, 0, &mut families);
    }
    families.sort_by_key(|s| s.to_lowercase());
    families
}

/// Walk `dir` for font files, appending each new monospace family to `out`.
///
/// Recursive: macOS keeps its system fonts flat, but `~/Library/Fonts` and
/// every Linux font tree nest them. Depth-bounded so a symlink loop cannot
/// send this walking the whole disk.
fn collect_families(dir: &std::path::Path, depth: usize, out: &mut Vec<String>) {
    const MAX_DEPTH: usize = 4;
    let Ok(rd) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in rd.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if depth < MAX_DEPTH {
                collect_families(&path, depth + 1, out);
            }
            continue;
        }
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if !matches!(ext.as_str(), "ttf" | "otf" | "ttc") {
            continue;
        }
        let Ok(bytes) = std::fs::read(&path) else {
            continue;
        };
        // Face 0 is enough: a collection's faces share the family, and we only
        // need to know whether the family is fixed-pitch.
        let Ok(face) = ttf_parser::Face::parse(&bytes, 0) else {
            continue;
        };
        if !face.is_monospaced() {
            continue;
        }
        let file_name = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();
        let family = family_from_font(&bytes, &file_name);
        if !family.trim().is_empty() && !out.iter().any(|s| s.eq_ignore_ascii_case(&family)) {
            out.push(family);
        }
    }
}

/// Query `fc-list` for monospace families. Empty when `fc-list` is unavailable.
fn fc_list_families() -> Vec<String> {
    let Ok(out) = std::process::Command::new("fc-list")
        .args([":spacing=100", "family"])
        .output()
    else {
        return Vec::new();
    };
    let text = String::from_utf8_lossy(&out.stdout);
    let mut families: Vec<String> = text
        .lines()
        .flat_map(|line| {
            // A line may list several comma-separated localized names; the first
            // is the canonical family.
            line.split(',').next().map(|s| s.trim().to_string())
        })
        .filter(|s| !s.is_empty())
        .collect();
    families.sort_by_key(|s| s.to_lowercase());
    families.dedup();
    families
}

/// Common monospace families shipped with the OS, used when `fc-list` is absent.
#[cfg(target_os = "windows")]
fn fallback_monospace_families() -> Vec<String> {
    [
        "Cascadia Code",
        "Cascadia Mono",
        "Consolas",
        "Courier New",
        "Lucida Console",
        "Lucida Sans Typewriter",
    ]
    .iter()
    .map(|s| s.to_string())
    .collect()
}

#[cfg(target_os = "macos")]
fn fallback_monospace_families() -> Vec<String> {
    [
        "SF Mono",
        "Menlo",
        "Monaco",
        "Andale Mono",
        "Courier New",
        "PT Mono",
    ]
    .iter()
    .map(|s| s.to_string())
    .collect()
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn fallback_monospace_families() -> Vec<String> {
    Vec::new()
}

/// Read the typographic family name out of a font file, falling back to the
/// file stem.
fn family_from_font(bytes: &[u8], file_name: &str) -> String {
    let stem = std::path::Path::new(file_name)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(file_name)
        .to_string();
    let Ok(face) = ttf_parser::Face::parse(bytes, 0) else {
        return stem;
    };
    // Prefer typographic family (16), then family (1); prefer Unicode names.
    let mut family: Option<String> = None;
    for name in face.names() {
        if name.name_id == 16 || name.name_id == 1 {
            if let Some(s) = name.to_string() {
                let is_better = name.name_id == 16 || family.is_none();
                if is_better && !s.trim().is_empty() {
                    family = Some(s);
                    if name.name_id == 16 {
                        break;
                    }
                }
            }
        }
    }
    family.unwrap_or(stem)
}

/// Save an imported font file and return its family name.
#[tauri::command]
pub fn import_font(file_name: String, data_b64: String) -> Result<String, String> {
    let bytes = B64
        .decode(data_b64.as_bytes())
        .map_err(|e| format!("invalid base64: {e}"))?;
    let dir = fonts_dir().ok_or_else(|| "HOME not set".to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    // Keep only the basename to avoid path traversal.
    let safe = std::path::Path::new(&file_name)
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or_else(|| "bad file name".to_string())?;
    std::fs::write(dir.join(safe), &bytes).map_err(|e| e.to_string())?;
    Ok(family_from_font(&bytes, safe))
}

/// All imported fonts with their bytes (base64) so the frontend can register
/// them at startup.
#[tauri::command]
pub fn list_custom_fonts() -> Vec<CustomFont> {
    let Some(dir) = fonts_dir() else {
        return Vec::new();
    };
    let Ok(rd) = std::fs::read_dir(&dir) else {
        return Vec::new();
    };
    let mut out = Vec::new();
    for entry in rd.flatten() {
        let path = entry.path();
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if !matches!(ext.as_str(), "ttf" | "otf" | "woff" | "woff2") {
            continue;
        }
        let Ok(bytes) = std::fs::read(&path) else {
            continue;
        };
        let file_name = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();
        out.push(CustomFont {
            family: family_from_font(&bytes, &file_name),
            file_name,
            data_b64: B64.encode(&bytes),
        });
    }
    out.sort_by_key(|f| f.family.to_lowercase());
    out
}

/// Delete an imported font file by its file name.
#[tauri::command]
pub fn remove_custom_font(file_name: String) -> Result<(), String> {
    let dir = fonts_dir().ok_or_else(|| "HOME not set".to_string())?;
    let safe = std::path::Path::new(&file_name)
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or_else(|| "bad file name".to_string())?;
    let path = dir.join(safe);
    if path.exists() {
        std::fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The scanner is only wired up on macOS, but it is plain std + ttf-parser,
    /// so it runs anywhere there are font files — which is what makes it
    /// testable at all. Skips itself on a machine with no system fonts.
    #[test]
    fn scans_monospace_families_from_font_files() {
        let dirs: Vec<PathBuf> = ["/usr/share/fonts", "/Library/Fonts"]
            .iter()
            .map(PathBuf::from)
            .filter(|p| p.exists())
            .collect();
        if dirs.is_empty() {
            return;
        }
        let found = scan_font_families(&dirs);
        // Any machine with a font tree has at least one monospace face; an
        // empty result here means the walk itself is broken (it was, once: a
        // non-recursive read_dir found nothing under /usr/share/fonts, and
        // this test passed vacuously because it tolerated the empty case).
        assert!(!found.is_empty(), "scanner found no monospace family");
        // Sorted case-insensitively, and deduped case-insensitively.
        let lower: Vec<String> = found.iter().map(|s| s.to_lowercase()).collect();
        let mut sorted = lower.clone();
        sorted.sort();
        assert_eq!(lower, sorted, "families must come back sorted");
        let mut uniq = sorted.clone();
        uniq.dedup();
        assert_eq!(sorted.len(), uniq.len(), "families must be deduped");
        // Proportional faces must have been filtered out by is_monospaced().
        assert!(
            !found.iter().any(|f| f.eq_ignore_ascii_case("DejaVu Sans")),
            "proportional family leaked into the monospace list: {found:?}"
        );
    }
}
