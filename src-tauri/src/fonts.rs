//! Font management for the settings UI:
//!  - `list_system_fonts`: monospace families installed on the system (fontconfig).
//!  - `import_font` / `list_custom_fonts`: user-imported font files stored in
//!    `~/.config/lume/fonts/`, returned as base64 so the frontend can register
//!    them with the FontFace API (works without an asset-protocol scope).

use std::path::PathBuf;

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
    let base = std::env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".config")))?;
    Some(base.join("lume").join("fonts"))
}

/// Monospace font families available on the system, via `fc-list`.
#[tauri::command]
pub fn list_system_fonts() -> Vec<String> {
    let out = std::process::Command::new("fc-list")
        .args([":spacing=100", "family"])
        .output();
    let Ok(out) = out else {
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
