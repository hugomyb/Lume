use std::sync::Arc;

use parking_lot::Mutex;

mod ai;
mod complete;
mod config;
mod env_fix;
mod fonts;
mod notify;
mod osc;
mod paths;
mod pty;
mod remote;
mod shell;
mod ssh;
mod update;
mod workflows;
#[cfg(target_os = "linux")]
mod native_grid;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Native grid vs Wayland: on GDK's Wayland backend, WebKitGTK composites
    // the page through a wl_subsurface that ALWAYS stacks above the parent
    // surface — cairo painted on the toplevel (our grid) can never show
    // through, whatever the offset (verified empirically; DMABUF/compositing
    // kill-switches change nothing). Under XWayland everything works, so:
    // on a Wayland session with X available, pick the x11 backend up-front.
    // An explicit user GDK_BACKEND is honored; pure-Wayland setups without
    // XWayland keep the wayland backend and the grid declines to attach
    // (native_grid.rs), letting the xterm.js fallback paint instead.
    #[cfg(target_os = "linux")]
    if std::env::var_os("GDK_BACKEND").is_none()
        && std::env::var_os("WAYLAND_DISPLAY").is_some()
        && std::env::var_os("DISPLAY").is_some()
    {
        std::env::set_var("GDK_BACKEND", "x11");
    }

    let cfg = Arc::new(Mutex::new(config::load()));
    // Make sure the shell-integration scripts exist on disk from the first
    // launch, so the rc/$PROFILE snippet always dot-sources a real file.
    shell::ensure_integration_scripts();
    let pty_manager = Arc::new(pty::PtyManager::new());
    let ai_manager = Arc::new(ai::AiManager::new());
    let remote_state = Arc::new(remote::RemoteState::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(cfg)
        .manage(pty_manager)
        .manage(ai_manager)
        .manage(remote_state)
        .invoke_handler(tauri::generate_handler![
            #[cfg(target_os = "linux")]
            native_grid::native_grid_attach,
            #[cfg(target_os = "linux")]
            native_grid::native_grid_update,
            #[cfg(target_os = "linux")]
            native_grid::native_grid_set_visible,
            #[cfg(target_os = "linux")]
            native_grid::native_grid_set_offset,
            #[cfg(target_os = "linux")]
            native_grid::native_grid_set_dim,
            #[cfg(target_os = "linux")]
            native_grid::native_grid_detach,
            #[cfg(target_os = "linux")]
            native_grid::native_grid_set_holes,
            #[cfg(target_os = "linux")]
            native_grid::native_grid_set_focused,
            #[cfg(target_os = "linux")]
            native_grid::native_grid_set_selection,
            #[cfg(target_os = "linux")]
            native_grid::native_grid_set_overlay_rects,
            config::get_config,
            config::save_config,
            config::export_config,
            config::import_config,
            shell::get_shell_setup_hint,
            complete::fs_complete,
            complete::read_dir,
            workflows::list_workflows,
            ssh::list_ssh_hosts,
            fonts::list_system_fonts,
            fonts::import_font,
            fonts::list_custom_fonts,
            fonts::remove_custom_font,
            notify::notify,
            update::self_update_supported,
            remote::remote_start,
            remote::remote_stop,
            remote::remote_status,
            remote::remote_set_target,
            remote::remote_set_tabs,
            remote::remote_install_cloudflared,
            pty::pty_spawn,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill,
            ai::ai_status,
            ai::ai_probe,
            ai::ai_default_model,
            ai::ai_explain_block,
            ai::ai_generate_command,
            ai::ai_chat,
            ai::ai_cancel,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
