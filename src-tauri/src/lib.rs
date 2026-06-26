use std::sync::Arc;

use parking_lot::Mutex;

mod ai;
mod complete;
mod config;
mod fonts;
mod notify;
mod osc;
mod pty;
mod remote;
mod shell;
mod ssh;
mod workflows;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let cfg = Arc::new(Mutex::new(config::load()));
    let pty_manager = Arc::new(pty::PtyManager::new());
    let ai_manager = Arc::new(ai::AiManager::new());
    let remote_state = Arc::new(remote::RemoteState::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(cfg)
        .manage(pty_manager)
        .manage(ai_manager)
        .manage(remote_state)
        .invoke_handler(tauri::generate_handler![
            config::get_config,
            config::save_config,
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
            remote::remote_start,
            remote::remote_stop,
            remote::remote_status,
            remote::remote_set_target,
            remote::remote_install_cloudflared,
            pty::pty_spawn,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill,
            ai::ai_status,
            ai::ai_explain_block,
            ai::ai_generate_command,
            ai::ai_chat,
            ai::ai_cancel,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
