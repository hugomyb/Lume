use serde::Serialize;

// Shell integration scripts are embedded in the binary so the app is fully
// self-contained — no dependency on the source checkout's location.
#[cfg(not(windows))]
const ZSH_INIT: &str = include_str!("../../scripts/lume-shell-init.zsh");
#[cfg(not(windows))]
const BASH_INIT: &str = include_str!("../../scripts/lume-shell-init.bash");
#[cfg(not(windows))]
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

/// Write the shell-integration scripts to the config dir at startup, so the
/// line the user adds to their rc / `$PROFILE` always resolves to a real file —
/// even if they set it up before ever opening the Blocks panel (which otherwise
/// writes the script lazily). Called once on launch.
pub fn ensure_integration_scripts() {
    let dir = config_dir();
    let _ = std::fs::create_dir_all(&dir);
    #[cfg(windows)]
    {
        const PS_INIT: &str = include_str!("../../scripts/lume-shell-init.ps1");
        let _ = std::fs::write(format!("{dir}\\lume-shell-init.ps1"), PS_INIT);
    }
    #[cfg(not(windows))]
    {
        let _ = std::fs::write(format!("{dir}/lume-shell-init.zsh"), ZSH_INIT);
        let _ = std::fs::write(format!("{dir}/lume-shell-init.bash"), BASH_INIT);
        let _ = std::fs::write(format!("{dir}/lume-shell-init.fish"), FISH_INIT);
    }
}

#[tauri::command]
pub fn get_shell_setup_hint() -> ShellSetupHint {
    #[cfg(windows)]
    {
        powershell_hint()
    }
    #[cfg(not(windows))]
    {
        unix_hint()
    }
}

/// PowerShell shell-integration setup (Windows default shell).
#[cfg(windows)]
fn powershell_hint() -> ShellSetupHint {
    const PS_INIT: &str = include_str!("../../scripts/lume-shell-init.ps1");
    let dir = config_dir();
    let _ = std::fs::create_dir_all(&dir);
    let script_path = format!("{dir}\\lume-shell-init.ps1");
    let _ = std::fs::write(&script_path, PS_INIT);
    ShellSetupHint {
        shell: "powershell".to_string(),
        source_line: format!(r#"if ($env:LUME_TERM) {{ . "{script_path}" }}"#),
        script_path,
        rc_file: "$PROFILE".to_string(),
    }
}

#[cfg(not(windows))]
fn unix_hint() -> ShellSetupHint {
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
