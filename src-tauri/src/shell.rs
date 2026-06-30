use serde::Serialize;

// Shell integration scripts are embedded in the binary so the app is fully
// self-contained — no dependency on the source checkout's location.
const ZSH_INIT: &str = include_str!("../../scripts/lume-shell-init.zsh");
const BASH_INIT: &str = include_str!("../../scripts/lume-shell-init.bash");
const FISH_INIT: &str = include_str!("../../scripts/lume-shell-init.fish");

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ShellSetupHint {
    pub shell: String,
    pub script_path: String,
    pub source_line: String,
    pub rc_file: String,
}

/// Lume's per-user config dir, where we drop the integration scripts so the
/// snippet the user pastes is portable across machines.
fn config_dir() -> String {
    crate::paths::config_dir()
        .map(|d| d.display().to_string())
        .unwrap_or_else(|| ".".to_string())
}

#[tauri::command]
pub fn get_shell_setup_hint() -> ShellSetupHint {
    let shell_path = std::env::var("SHELL").unwrap_or_default();
    let shell_name = shell_path.rsplit('/').next().unwrap_or("").to_string();

    let (script_name, content, rc_file, source_template): (
        &str,
        &str,
        &str,
        fn(&str) -> String,
    ) = match shell_name.as_str() {
        "bash" => (
            "lume-shell-init.bash",
            BASH_INIT,
            "~/.bashrc",
            |p| format!(r#"[[ -n "$LUME_TERM" ]] && source "{}""#, p),
        ),
        "fish" => (
            "lume-shell-init.fish",
            FISH_INIT,
            "~/.config/fish/config.fish",
            |p| format!(r#"test -n "$LUME_TERM"; and source "{}""#, p),
        ),
        _ => (
            "lume-shell-init.zsh",
            ZSH_INIT,
            "~/.zshrc",
            |p| format!(r#"[[ -n "$LUME_TERM" ]] && source "{}""#, p),
        ),
    };

    // Write (or refresh) the script to the per-user config dir.
    let dir = config_dir();
    let _ = std::fs::create_dir_all(&dir);
    let _ = std::fs::write(format!("{dir}/{script_name}"), content);

    // Use $HOME in the snippet so it's copy-pasteable on any machine.
    let portable_path = format!("$HOME/.config/lume/{script_name}");
    let source_line = source_template(&portable_path);

    ShellSetupHint {
        shell: shell_name,
        script_path: portable_path,
        source_line,
        rc_file: rc_file.to_string(),
    }
}
