use std::path::Path;

use serde::Serialize;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ShellSetupHint {
    pub shell: String,
    pub script_path: String,
    pub source_line: String,
    pub rc_file: String,
}

#[tauri::command]
pub fn get_shell_setup_hint() -> ShellSetupHint {
    let shell_path = std::env::var("SHELL").unwrap_or_default();
    let shell_name = shell_path
        .rsplit('/')
        .next()
        .unwrap_or("")
        .to_string();

    // CARGO_MANIFEST_DIR is src-tauri/ at compile time. Repo root is its parent.
    let manifest = Path::new(env!("CARGO_MANIFEST_DIR"));
    let repo_root = manifest.parent().unwrap_or(manifest);

    let (script_name, rc_file, source_template): (&str, &str, fn(&str) -> String) =
        match shell_name.as_str() {
            "bash" => (
                "lume-shell-init.bash",
                "~/.bashrc",
                |p| format!(r#"[[ -n "$LUME_TERM" ]] && source "{}""#, p),
            ),
            "fish" => (
                "lume-shell-init.fish",
                "~/.config/fish/config.fish",
                |p| format!(r#"test -n "$LUME_TERM"; and source "{}""#, p),
            ),
            _ => (
                "lume-shell-init.zsh",
                "~/.zshrc",
                |p| format!(r#"[[ -n "$LUME_TERM" ]] && source "{}""#, p),
            ),
        };

    let script_path = repo_root
        .join("scripts")
        .join(script_name)
        .display()
        .to_string();

    let source_line = source_template(&script_path);

    ShellSetupHint {
        shell: shell_name,
        script_path,
        source_line,
        rc_file: rc_file.to_string(),
    }
}
