use notify_rust::Notification;
// `Hint`/`Timeout` only exist in notify-rust's XDG (Linux) backend.
#[cfg(all(unix, not(target_os = "macos")))]
use notify_rust::{Hint, Timeout};

/// Send a desktop notification reliably.
///
/// `tauri-plugin-notification` runs notify-rust's blocking `show()` *inside*
/// the tokio runtime on Linux and swallows the error (`let _ = ...`). zbus's
/// blocking client panics there ("Cannot start a runtime from within a
/// runtime"), so notifications silently never appear even though the JS
/// `sendNotification()` call resolves successfully. Running `show()` on a
/// dedicated OS thread (outside tokio) and joining it lets us surface the real
/// error back to the frontend.
#[tauri::command]
pub fn notify(
    title: String,
    body: String,
    icon: Option<String>,
    sound: Option<bool>,
) -> Result<(), String> {
    let handle = std::thread::spawn(move || -> Result<(), String> {
        let mut n = Notification::new();
        n.summary(&title).body(&body);

        // The XDG (Linux) backend supports app name, icon-by-name, the desktop-
        // entry hint and a custom sound; macOS/Windows show a plain title+body.
        #[cfg(all(unix, not(target_os = "macos")))]
        {
            n.appname("Lume")
                .icon(icon.as_deref().unwrap_or("utilities-terminal"))
                // Tells GNOME which app this is (matches com.lume.app.desktop),
                // so it shows a banner instead of dropping it to the tray.
                .hint(Hint::DesktopEntry("com.lume.app".to_string()))
                .timeout(Timeout::Milliseconds(6000));
            if sound.unwrap_or(false) {
                // Freedesktop sound name played by the daemon (libcanberra).
                n.sound_name("complete");
            }
        }
        #[cfg(not(all(unix, not(target_os = "macos"))))]
        {
            let _ = (&icon, &sound); // unused on macOS/Windows
        }

        n.show().map(|_| ()).map_err(|e| e.to_string())
    });
    match handle.join() {
        Ok(res) => {
            if let Err(ref e) = res {
                eprintln!("[notify] show failed: {e}");
            }
            res
        }
        Err(_) => Err("notify thread panicked".to_string()),
    }
}
