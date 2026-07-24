//! Self-update capability probe.

/// Whether the in-app updater may download and install updates itself.
///
/// On Arch/Manjaro the AUR package (`lume-bin`) repackages the .deb into a
/// pacman-owned install: Tauri's updater would download the .deb artifact and
/// try to install it through pkexec — failing (no dpkg) or stomping on a
/// pacman-managed tree. When a pacman package owns the running binary, updates
/// belong to the package manager (`yay -Syu`): the banner still announces the
/// release but must not self-install.
#[tauri::command]
pub fn self_update_supported() -> bool {
    #[cfg(target_os = "linux")]
    {
        let Ok(exe) = std::env::current_exe() else {
            return true;
        };
        // `pacman -Qqo <path>` exits 0 iff a package owns the file. Missing
        // pacman (Debian, Fedora…) errors out → self-update stays on.
        if let Ok(status) = std::process::Command::new("pacman")
            .arg("-Qqo")
            .arg(&exe)
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
        {
            return !status.success();
        }
    }
    true
}
