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

// NOTE: do NOT set WEBKIT_DISABLE_DMABUF_RENDERER unconditionally. v1.0.2
// shipped it as a supposed NVIDIA stutter workaround, and it turned out to be a
// ~3× rendering regression: without DMABUF, WebKitGTK loses zero-copy sharing of
// xterm's WebGL canvas and falls back to a far more expensive compositing path
// (measured 78% vs 29% WebProcess CPU during a selection drag, on both NVIDIA
// and Intel). So it is only disabled on the graphics stacks where the DMABUF
// path is known to render nothing at all — see below.

/// DRM drivers for virtual/emulated GPUs whose buffer formats WebKitGTK's
/// accelerated renderer can't share, leaving the window blank (issue #27:
/// VMware SVGA3D via `vmwgfx` on a Rocky Linux 10 VM). Real GPU drivers
/// (i915, amdgpu, nouveau, nvidia-drm, …) are deliberately absent: on those
/// DMABUF works and is 3× cheaper.
///
/// `virtio_gpu` is NOT listed — virgl/venus setups do render correctly, and
/// blanket-disabling DMABUF there would penalise every QEMU/GNOME Boxes user.
#[cfg(target_os = "linux")]
const BLANK_RENDER_DRM_DRIVERS: &[&str] = &[
    "vmwgfx",    // VMware SVGA3D
    "vboxvideo", // VirtualBox
    "qxl",       // SPICE
    "cirrus",    // legacy QEMU
    "bochs-drm", // QEMU stdvga
    "bochs",     // same, renamed in newer kernels
    "simpledrm", // firmware framebuffer, no acceleration at all
    "vkms",      // virtual/headless
];

/// The DRM drivers bound on this machine, one entry per `/sys/class/drm/cardN`.
/// Empty when the directory is unreadable or holds no card (container, no GPU).
#[cfg(target_os = "linux")]
fn drm_drivers() -> Vec<String> {
    let Ok(entries) = std::fs::read_dir("/sys/class/drm") else {
        return vec![];
    };
    let mut drivers = vec![];
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        // `card0` yes, `card0-DVI-I-1` (a connector) no.
        if !name.starts_with("card") || name.contains('-') {
            continue;
        }
        // …/cardN/device/driver is a symlink into the driver's bus directory.
        if let Ok(target) = std::fs::read_link(entry.path().join("device/driver")) {
            if let Some(driver) = target.file_name() {
                drivers.push(driver.to_string_lossy().into_owned());
            }
        }
    }
    drivers
}

/// Whether WebKitGTK's DMABUF renderer is expected to paint nothing here.
/// True only when *every* GPU on the box is a known-blank virtual one (a VM
/// with a passed-through card keeps the fast path), or when there is no
/// render node at all and Mesa therefore falls back to llvmpipe.
#[cfg(target_os = "linux")]
fn dmabuf_renders_blank() -> Option<&'static str> {
    if std::env::var("LIBGL_ALWAYS_SOFTWARE").is_ok_and(|v| v == "1" || v == "true") {
        return Some("LIBGL_ALWAYS_SOFTWARE is set");
    }
    let drivers = drm_drivers();
    if drivers.is_empty() {
        // No DRM card exposed at all: without a render node Mesa falls back to
        // the llvmpipe rasteriser, which has no DMABUF to share.
        let has_render_node = std::fs::read_dir("/dev/dri").is_ok_and(|nodes| {
            nodes
                .flatten()
                .any(|n| n.file_name().to_string_lossy().starts_with("renderD"))
        });
        return (!has_render_node).then_some("no DRM render node");
    }
    drivers_all_blank(&drivers).then_some("virtual GPU driver")
}

/// True when every bound driver is a known-blank one. A VM with a real card
/// passed through has at least one good driver and keeps the DMABUF fast path.
#[cfg(target_os = "linux")]
fn drivers_all_blank(drivers: &[String]) -> bool {
    !drivers.is_empty()
        && drivers
            .iter()
            .all(|d| BLANK_RENDER_DRM_DRIVERS.contains(&d.as_str()))
}

/// Disable WebKitGTK's DMABUF renderer when — and only when — this machine's
/// graphics stack is one that renders a blank window with it (issue #27).
/// Must run before the WebView is created. Skipped if the variable is already
/// set, or if `LUME_KEEP_DMABUF=1` forces the fast path back on: an explicit
/// user choice always wins over the heuristic.
#[cfg(target_os = "linux")]
pub fn disable_dmabuf_if_blank_renderer() {
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_some()
        || std::env::var_os("LUME_KEEP_DMABUF").is_some()
    {
        return;
    }
    if let Some(reason) = dmabuf_renders_blank() {
        eprintln!(
            "lume: {reason} — disabling WebKitGTK's DMABUF renderer so the \
             window isn't blank (export LUME_KEEP_DMABUF=1 to keep it on)"
        );
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }
}

/// On Windows, stop a spawned console program (the AI CLI, cloudflared, …) from
/// flashing up its own console window. No-op on other platforms.
pub fn no_window(cmd: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(windows))]
    {
        let _ = cmd;
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
    c.arg(flags).arg("printf '__LUME_P_<%s>_END__' \"$PATH\"");
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

    #[cfg(target_os = "linux")]
    #[test]
    fn dmabuf_kill_switch_only_targets_virtual_gpus() {
        let d = |names: &[&str]| names.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        // Issue #27: a VMware VM, SVGA3D only → blank window, disable DMABUF.
        assert!(drivers_all_blank(&d(&["vmwgfx"])));
        assert!(drivers_all_blank(&d(&["qxl", "bochs-drm"])));
        // Real hardware — never touch it, DMABUF is the fast path.
        assert!(!drivers_all_blank(&d(&["i915"])));
        assert!(!drivers_all_blank(&d(&["amdgpu", "nvidia-drm"])));
        assert!(!drivers_all_blank(&d(&["virtio_gpu"])));
        // A virtual display next to a real GPU (evdi + i915, DisplayLink) and
        // a passed-through card in a VM both keep DMABUF.
        assert!(!drivers_all_blank(&d(&["evdi", "i915"])));
        assert!(!drivers_all_blank(&d(&["vmwgfx", "nvidia-drm"])));
        // Unknown/unreadable → no opinion, leave the default alone.
        assert!(!drivers_all_blank(&[]));
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
