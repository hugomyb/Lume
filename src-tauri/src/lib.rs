use std::sync::Arc;

mod ai;
mod complete;
mod config;
mod osc;
mod pty;
mod shell;
mod workflows;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let cfg = Arc::new(config::load());
    let pty_manager = Arc::new(pty::PtyManager::new());
    let ai_manager = Arc::new(ai::AiManager::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(cfg)
        .manage(pty_manager)
        .manage(ai_manager)
        .invoke_handler(tauri::generate_handler![
            config::get_config,
            shell::get_shell_setup_hint,
            complete::fs_complete,
            workflows::list_workflows,
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
