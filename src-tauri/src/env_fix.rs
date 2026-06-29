//! Child-process environment hygiene.
//!
//! Two problems this solves, both hit when Lume runs from an AppImage and/or is
//! launched from the GUI (not a terminal):
//!
//! 1. **AppImage env pollution.** The AppImage runtime injects `PYTHONHOME` /
//!    `PYTHONPATH` and prepends its mount (`/tmp/.mount_Lume.XXXX/...`) to
//!    `PATH`, `LD_LIBRARY_PATH`, etc. These leak into every process Lume spawns
//!    (the terminal shell, the `claude` CLI, shell hooks) and break system
//!    binaries — e.g. `/usr/bin/python3` picks up the AppImage's `PYTHONHOME`
//!    and dies with `ModuleNotFoundError: No module named 'encodings'`.
//!
//! 2. **Missing PATH.** A GUI-launched app inherits a minimal PATH; the user's
//!    real PATH (npm/nvm/`~/.local/bin`) is set in their shell rc, which a plain
//!    `sh -c` never sources. So `claude` "isn't found" even though it works in a
//!    terminal. We recover the real PATH from a login+interactive shell.

use std::io::Read;
use std::process::{Command, Stdio};
use std::sync::OnceLock;
use std::time::{Duration, Instant};

/// Vars that belong solely to the AppImage's bundled Python and must be unset.
const OWN: &[&str] = &["PYTHONHOME", "PYTHONPATH", "PYTHONDONTWRITEBYTECODE"];

/// `:`-separated path lists: keep the user's entries, drop AppImage-mount ones.
const PATH_LISTS: &[&str] = &[
    "PATH",
    "LD_LIBRARY_PATH",
    "XDG_DATA_DIRS",
    "GST_PLUGIN_SYSTEM_PATH_1_0",
    "GST_PLUGIN_PATH",
    "GIO_EXTRA_MODULES",
    "GSETTINGS_SCHEMA_DIR",
    "GDK_PIXBUF_MODULE_FILE",
    "LD_PRELOAD",
    "PERLLIB",
    "PERL5LIB",
];

/// The AppImage mount root (`$APPDIR`), or `None` when not running packaged.
fn appimage_root() -> Option<String> {
    if let Ok(d) = std::env::var("APPDIR") {
        if !d.is_empty() {
            return Some(d.trim_end_matches('/').to_string());
        }
    }
    // Fallback: derive `/tmp/.mount_Lume.XXXX` from a polluted PYTHONHOME.
    if let Ok(h) = std::env::var("PYTHONHOME") {
        if let Some(i) = h.find("/.mount_") {
            let rest = &h[i..];
            let end = rest.find("/usr").unwrap_or(rest.len());
            return Some(format!("{}{}", &h[..i], &rest[..end]));
        }
    }
    None
}

fn strip_appimage_path(path: &str, root: &str) -> String {
    path.split(':')
        .filter(|p| !p.is_empty() && !p.starts_with(root))
        .collect::<Vec<_>>()
        .join(":")
}

/// `(vars_to_unset, vars_to_set)` to clean a child env. Empty when not packaged.
fn fixups() -> (Vec<&'static str>, Vec<(&'static str, String)>) {
    let Some(root) = appimage_root() else {
        return (vec![], vec![]);
    };
    let mut unset: Vec<&'static str> = vec![];
    let mut set: Vec<(&'static str, String)> = vec![];
    for &v in OWN {
        if std::env::var_os(v).is_some() {
            unset.push(v);
        }
    }
    for &v in PATH_LISTS {
        if let Ok(val) = std::env::var(v) {
            let kept = strip_appimage_path(&val, &root);
            if kept.is_empty() {
                unset.push(v);
            } else if kept != val {
                set.push((v, kept));
            }
        }
    }
    (unset, set)
}

/// Strip AppImage pollution from a `std::process::Command`'s environment.
pub fn sanitize(cmd: &mut Command) {
    let (unset, set) = fixups();
    for v in unset {
        cmd.env_remove(v);
    }
    for (k, val) in set {
        cmd.env(k, val);
    }
}

/// Strip AppImage pollution from a `portable_pty::CommandBuilder`.
pub fn sanitize_pty(cmd: &mut portable_pty::CommandBuilder) {
    let (unset, set) = fixups();
    for v in unset {
        cmd.env_remove(v);
    }
    for (k, val) in set {
        cmd.env(k, val);
    }
}

/// The user's PATH as resolved by their login+interactive shell, with AppImage
/// entries stripped. Computed once; falls back to the (cleaned) process PATH.
pub fn user_path() -> String {
    static CACHE: OnceLock<String> = OnceLock::new();
    CACHE.get_or_init(resolve_user_path).clone()
}

fn resolve_user_path() -> String {
    let proc_path = std::env::var("PATH").unwrap_or_default();
    let fallback = match appimage_root() {
        Some(root) => strip_appimage_path(&proc_path, &root),
        None => proc_path.clone(),
    };
    let shell = match std::env::var("SHELL") {
        Ok(s) if !s.is_empty() => s,
        _ => return fallback,
    };
    // Login + interactive so the rc files that add to PATH are sourced. Markers
    // isolate the value from any banner an rc file may print to stdout.
    let flags = if shell.ends_with("zsh") || shell.ends_with("bash") {
        "-lic"
    } else {
        "-lc"
    };
    let mut c = Command::new(&shell);
    c.arg(flags)
        .arg("printf '__LUME_P_<%s>_END__' \"$PATH\"");
    sanitize(&mut c); // don't let the AppImage mount taint the starting PATH
    let Some(out) = capture_with_timeout(c, 6) else {
        return fallback;
    };
    let resolved = out
        .split_once("__LUME_P_<")
        .and_then(|(_, rest)| rest.split_once(">_END__"))
        .map(|(p, _)| p.to_string());
    match resolved {
        Some(p) if p.split(':').any(|d| !d.is_empty()) => match appimage_root() {
            Some(root) => strip_appimage_path(&p, &root),
            None => p,
        },
        _ => fallback,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_only_appimage_entries() {
        let root = "/tmp/.mount_Lume.AEPbMmO";
        let path = "/tmp/.mount_Lume.AEPbMmO/usr/bin:/home/u/.local/bin:/usr/bin";
        assert_eq!(
            strip_appimage_path(path, root),
            "/home/u/.local/bin:/usr/bin"
        );
    }

    #[test]
    fn keeps_path_unchanged_without_mount() {
        let root = "/tmp/.mount_Lume.X";
        let path = "/home/u/.local/bin:/usr/bin";
        assert_eq!(strip_appimage_path(path, root), path);
    }
}

/// Run a command capturing stdout, killing it (returning None) after `secs`.
fn capture_with_timeout(mut cmd: Command, secs: u64) -> Option<String> {
    cmd.stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    let mut child = cmd.spawn().ok()?;
    let mut stdout = child.stdout.take()?;
    let reader = std::thread::spawn(move || {
        let mut s = String::new();
        let _ = stdout.read_to_string(&mut s);
        s
    });
    let start = Instant::now();
    let timed_out = loop {
        match child.try_wait() {
            Ok(Some(_)) => break false,
            Ok(None) => {
                if start.elapsed() > Duration::from_secs(secs) {
                    let _ = child.kill();
                    let _ = child.wait();
                    break true;
                }
                std::thread::sleep(Duration::from_millis(40));
            }
            Err(_) => break true,
        }
    };
    let s = reader.join().ok()?;
    if timed_out {
        None
    } else {
        Some(s)
    }
}
