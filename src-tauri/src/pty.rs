use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::thread;

use anyhow::{anyhow, Context, Result};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use parking_lot::Mutex;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Serialize;
use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::broadcast;

use crate::config::{Config, ShellConfig};
use crate::osc::{BlockEvent, OscEvent, OscParser};

pub struct PtySession {
    /// Behind its own lock (not the sessions map's): writes block when the
    /// foreground process stops reading stdin, and must not freeze every
    /// other session — or the UI — behind the global map lock.
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    backend: Backend,
    cwd: Arc<Mutex<Option<String>>>,
    /// Raw terminal output, fanned out to remote-control subscribers.
    output_tx: broadcast::Sender<Vec<u8>>,
    /// Recent raw output (capped ring) so a remote client that (re)connects can
    /// reconstruct the current screen + scrollback instead of seeing a blank one.
    replay: Arc<Mutex<Vec<u8>>>,
    /// Total passthrough bytes ever emitted (absolute stream offset). Lets a
    /// consumer that resyncs from a snapshot of another consumer's state (the
    /// native grid rebuilding from xterm's serialized buffer) line the two
    /// streams up byte-exactly. Updated under the `replay` lock.
    total_out: Arc<Mutex<u64>>,
}

/// What a session's bytes are written to / resized through.
enum Backend {
    /// A local shell on a pseudo-terminal.
    Local {
        master: Box<dyn portable_pty::MasterPty + Send>,
        /// Signals the child on pty_kill: closing the master fd only delivers
        /// the kernel's SIGHUP, which processes are free to ignore — those
        /// would otherwise outlive their tab (and pin their reaper thread).
        killer: Box<dyn portable_pty::ChildKiller + Send + Sync>,
    },
    /// A terminal of another Lume, reached over its remote-control channel
    /// (see remote_client.rs). Input and resizes go through `ctl`.
    Remote {
        ctl: tokio::sync::mpsc::UnboundedSender<RemoteCtl>,
    },
}

/// Commands for a remote session's connection task.
pub enum RemoteCtl {
    Input(Vec<u8>),
    Resize(u16, u16),
    Close,
}

impl Backend {
    fn resize(&self, rows: u16, cols: u16) -> Result<(), String> {
        match self {
            Backend::Local { master, .. } => master
                .resize(PtySize {
                    rows,
                    cols,
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|e| e.to_string()),
            Backend::Remote { ctl } => {
                let _ = ctl.send(RemoteCtl::Resize(rows, cols));
                Ok(())
            }
        }
    }

    fn kill(&mut self) {
        match self {
            Backend::Local { master, killer } => {
                // The job running in the tab (npm run dev, a watcher…) is its
                // own process group, and SIGHUP to the shell doesn't reliably
                // reach it: tools such as nodemon survive it and are left
                // orphaned, still holding their port. Read the foreground
                // group BEFORE the shell goes away.
                #[cfg(unix)]
                let job = master.process_group_leader();
                #[cfg(not(unix))]
                let _ = &master;
                let _ = killer.kill();
                #[cfg(unix)]
                if let Some(pgid) = job {
                    terminate_process_group(pgid);
                }
            }
            Backend::Remote { ctl } => {
                let _ = ctl.send(RemoteCtl::Close);
            }
        }
    }
}

/// Hang up a process group like a closing terminal does, then insist:
/// SIGTERM after 1 s and SIGKILL after 3 s for whatever ignored the hangup.
/// Background jobs started with `nohup … &` aren't in the foreground group
/// and are left alone, as in other terminals.
#[cfg(unix)]
fn terminate_process_group(pgid: libc::pid_t) {
    if pgid <= 1 {
        return;
    }
    let alive = move || unsafe { libc::killpg(pgid, 0) } == 0;
    unsafe {
        libc::killpg(pgid, libc::SIGHUP);
    }
    thread::spawn(move || {
        thread::sleep(std::time::Duration::from_secs(1));
        if !alive() {
            return;
        }
        unsafe {
            libc::killpg(pgid, libc::SIGTERM);
        }
        thread::sleep(std::time::Duration::from_secs(2));
        if alive() {
            unsafe {
                libc::killpg(pgid, libc::SIGKILL);
            }
        }
    });
}

/// `Write` end of a remote session: bytes become `RemoteCtl::Input` messages.
struct RemoteWriter(tokio::sync::mpsc::UnboundedSender<RemoteCtl>);

impl Write for RemoteWriter {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        self.0
            .send(RemoteCtl::Input(buf.to_vec()))
            .map_err(|_| std::io::Error::from(std::io::ErrorKind::BrokenPipe))?;
        Ok(buf.len())
    }
    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

/// Where a session's terminal output goes: the replay ring + remote-control
/// fan-out (and the native grid, which subscribes to it), then the pane's
/// point-to-point channel to xterm.
#[derive(Clone)]
pub struct OutputSink {
    replay: Arc<Mutex<Vec<u8>>>,
    total_out: Arc<Mutex<u64>>,
    output_tx: broadcast::Sender<Vec<u8>>,
    on_output: Channel<InvokeResponseBody>,
}

impl OutputSink {
    /// Returns false once the pane's channel is gone (pane closed).
    pub fn push(&self, bytes: Vec<u8>) -> bool {
        if bytes.is_empty() {
            return true;
        }
        // Record into the capped replay buffer and fan out to remote clients
        // under the same lock, so a remote attach gets a clean snapshot/live
        // boundary.
        {
            let mut rb = self.replay.lock();
            rb.extend_from_slice(&bytes);
            let len = rb.len();
            if len > MAX_REPLAY {
                rb.drain(..len - MAX_REPLAY);
            }
            *self.total_out.lock() += bytes.len() as u64;
            if self.output_tx.receiver_count() > 0 {
                let _ = self.output_tx.send(bytes.clone());
            }
        }
        // Point-to-point channel with a raw (non-base64, non-JSON) payload:
        // small chunks — the interactive case — are eval'd directly into the
        // pane's callback, without the event system's per-webview broadcast
        // that every other pane would have to filter out in JS.
        self.on_output.send(InvokeResponseBody::Raw(bytes)).is_ok()
    }
}

/// Cap on the per-session replay buffer (enough to rebuild the screen + recent
/// scrollback on reattach).
const MAX_REPLAY: usize = 256 * 1024;

impl PtyManager {
    /// Attach a remote client: snapshot the replay buffer AND subscribe to live
    /// output under the replay lock, so the boundary is clean (no gap/dup). The
    /// client replays the snapshot to reconstruct the current screen. The `u64`
    /// is the absolute stream offset of the snapshot's END (= total bytes ever
    /// emitted at that point).
    pub fn attach(&self, id: u64) -> Option<(Vec<u8>, u64, broadcast::Receiver<Vec<u8>>)> {
        let sessions = self.sessions.lock();
        let s = sessions.get(&id)?;
        let rb = s.replay.lock();
        let snapshot = rb.clone();
        let offset = *s.total_out.lock();
        let rx = s.output_tx.subscribe();
        drop(rb);
        Some((snapshot, offset, rx))
    }

    /// Write raw bytes to a session. Returns false if the id is unknown.
    pub fn write_bytes(&self, id: u64, bytes: &[u8]) -> bool {
        let writer = match self.sessions.lock().get(&id) {
            Some(s) => s.writer.clone(),
            None => return false,
        };
        let mut w = writer.lock();
        let _ = w.write_all(bytes);
        let _ = w.flush();
        true
    }

    /// Resize a session's PTY (used when a remote client drives the size).
    pub fn resize_pty(&self, id: u64, rows: u16, cols: u16) {
        if let Some(s) = self.sessions.lock().get(&id) {
            let _ = s.backend.resize(rows, cols);
        }
    }

    /// Register a remote (Lume ↔ Lume) session: input/resize/kill go through
    /// `ctl`, output is pushed by the caller into the returned sink. Returns
    /// the new session id.
    pub fn register_remote(
        &self,
        ctl: tokio::sync::mpsc::UnboundedSender<RemoteCtl>,
        on_output: Channel<InvokeResponseBody>,
    ) -> (u64, OutputSink) {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (output_tx, _) = broadcast::channel::<Vec<u8>>(128);
        let sink = OutputSink {
            replay: Arc::new(Mutex::new(Vec::new())),
            total_out: Arc::new(Mutex::new(0)),
            output_tx: output_tx.clone(),
            on_output,
        };
        self.sessions.lock().insert(
            id,
            PtySession {
                writer: Arc::new(Mutex::new(Box::new(RemoteWriter(ctl.clone())))),
                backend: Backend::Remote { ctl },
                cwd: Arc::new(Mutex::new(None)),
                output_tx,
                replay: sink.replay.clone(),
                total_out: sink.total_out.clone(),
            },
        );
        (id, sink)
    }

    /// Terminate every session (app exit): each tab's shell and its
    /// foreground job, so nothing a tab started outlives Lume.
    pub fn kill_all(&self) {
        let sessions: Vec<PtySession> = self.sessions.lock().drain().map(|(_, s)| s).collect();
        for mut s in sessions {
            s.backend.kill();
        }
    }

    /// Drop a session from the table (its backend has ended).
    pub fn remove(&self, id: u64) -> bool {
        self.sessions.lock().remove(&id).is_some()
    }
}

#[derive(Default)]
pub struct PtyManager {
    sessions: Mutex<HashMap<u64, PtySession>>,
    next_id: AtomicU64,
}

impl PtyManager {
    pub fn new() -> Self {
        Self::default()
    }
}

#[derive(Serialize, Clone)]
struct PtyExitEvent {
    id: u64,
}


#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PtyCwdEvent {
    id: u64,
    cwd: String,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
struct AliasItem {
    name: String,
    value: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PtyAliasesEvent {
    id: u64,
    items: Vec<AliasItem>,
}

fn resolve_shell(cfg: &ShellConfig) -> (String, Vec<String>) {
    let program = cfg.program.clone().unwrap_or_else(default_shell);
    (program, cfg.args.clone())
}

#[cfg(windows)]
fn default_shell() -> String {
    // PowerShell ships on every supported Windows and gives a far nicer terminal
    // experience than cmd.exe.
    "powershell.exe".to_string()
}

#[cfg(not(windows))]
fn default_shell() -> String {
    std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
}

#[tauri::command]
pub fn pty_spawn(
    app: AppHandle,
    pty_state: State<'_, Arc<PtyManager>>,
    cfg_state: State<'_, Arc<Mutex<Config>>>,
    rows: u16,
    cols: u16,
    cwd: Option<String>,
    on_output: Channel<InvokeResponseBody>,
) -> Result<u64, String> {
    spawn_impl(app, pty_state, cfg_state, rows, cols, cwd, on_output).map_err(|e| e.to_string())
}

fn spawn_impl(
    app: AppHandle,
    pty_state: State<'_, Arc<PtyManager>>,
    cfg_state: State<'_, Arc<Mutex<Config>>>,
    rows: u16,
    cols: u16,
    init_cwd: Option<String>,
    on_output: Channel<InvokeResponseBody>,
) -> Result<u64> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .context("openpty")?;

    let (program, args) = resolve_shell(&cfg_state.lock().shell);
    let mut cmd = CommandBuilder::new(program);
    for arg in args {
        cmd.arg(arg);
    }
    // Prefer a restored cwd (session persistence) when it still exists, else
    // default to $HOME so shells open in the user's home dir rather than wherever
    // the Tauri process was launched from (src-tauri/ in dev, / when packaged).
    let spawn_cwd = init_cwd
        .filter(|c| !c.is_empty())
        .map(std::path::PathBuf::from)
        .filter(|p| p.is_dir())
        .or_else(crate::paths::home_dir)
        .or_else(|| std::env::current_dir().ok());
    if let Some(ref cwd) = spawn_cwd {
        cmd.cwd(cwd);
    }
    // String form for the session cwd tracker and the initial cwd event, so the
    // file tree and path autocomplete have a starting directory immediately —
    // even before the shell's OSC 7 fires, or when shell integration isn't set
    // up (notably on Windows/PowerShell).
    let init_cwd_str = spawn_cwd.map(|p| p.display().to_string());
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    cmd.env("LUME_TERM", "1");
    // Strip AppImage env pollution (PYTHONHOME/PYTHONPATH, mount paths) so tools
    // and hooks run inside the terminal aren't broken by the bundle.
    crate::env_fix::sanitize_pty(&mut cmd);
    // macOS: a GUI-launched app inherits launchd's minimal PATH
    // (/usr/bin:/bin:/usr/sbin:/sbin), and everything that builds the real one
    // — /etc/zprofile's path_helper, the `brew shellenv` line Homebrew puts in
    // ~/.zprofile — is read by LOGIN shells only. We spawn an interactive,
    // non-login shell, so without this there is no brew/node/pyenv in the
    // terminal. user_path() resolves it once from a login+interactive shell.
    // Not applied elsewhere: Linux desktop sessions already export a usable
    // PATH, and paying for a shell round-trip there would be pure latency.
    if cfg!(target_os = "macos") {
        cmd.env("PATH", crate::env_fix::user_path());
    }

    let mut child = pair.slave.spawn_command(cmd).context("spawn shell")?;
    let killer = child.clone_killer();
    drop(pair.slave);

    let writer = Arc::new(Mutex::new(pair.master.take_writer().context("take_writer")?));
    let mut reader = pair.master.try_clone_reader().context("clone_reader")?;

    let id = pty_state.next_id.fetch_add(1, Ordering::Relaxed);

    let cwd = Arc::new(Mutex::new(init_cwd_str.clone()));
    let cwd_for_reader = cwd.clone();

    // Fan-out of raw output to remote-control subscribers. The receiver held
    // here is dropped immediately; subscribers are created on demand.
    // Capacity is deliberately small: the ring RETAINS its last N values until
    // overwritten (2048 × 64 KiB reads ≈ 128 MiB parked per pane after a burst);
    // 128 absorbs consumer latency, and the 256 KiB replay buffer already
    // covers reconnect/resync.
    let (output_tx, _) = broadcast::channel::<Vec<u8>>(128);
    let sink = OutputSink {
        replay: Arc::new(Mutex::new(Vec::<u8>::new())),
        total_out: Arc::new(Mutex::new(0u64)),
        output_tx: output_tx.clone(),
        on_output,
    };

    pty_state.sessions.lock().insert(
        id,
        PtySession {
            writer,
            backend: Backend::Local {
                master: pair.master,
                killer,
            },
            cwd,
            output_tx,
            replay: sink.replay.clone(),
            total_out: sink.total_out.clone(),
        },
    );

    // Seed the frontend with the initial cwd right away (buffered on the JS side
    // until the pty id is known), so the file tree / autocomplete work without
    // waiting on shell integration.
    if let Some(ref c) = init_cwd_str {
        let _ = app.emit("pty:cwd", PtyCwdEvent { id, cwd: c.clone() });
    }

    {
        let app = app.clone();
        thread::spawn(move || {
            const MAX_CAPTURE: usize = 1024 * 1024; // 1 MiB
            // Large read buffer: under heavy output (cat, builds, `yes`) the
            // kernel delivers more bytes per read, so we emit far fewer Tauri
            // events (each event costs a base64 encode + IPC hop) for the same
            // throughput — the dominant CPU cost of a terminal.
            let mut buf = [0u8; 65536];
            let mut parser = OscParser::new();
            let mut capturing = false;
            let mut output_buf: Vec<u8> = Vec::new();

            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let chunk = &buf[..n];
                        let result = parser.feed(chunk);

                        let mut cur = 0usize;
                        for timed in result.events.iter() {
                            // Capture any preceding bytes that belong to the current output.
                            if capturing {
                                let segment = &result.passthrough[cur..timed.passthrough_idx];
                                append_capped(&mut output_buf, segment, MAX_CAPTURE);
                            }
                            cur = timed.passthrough_idx;

                            match timed.event.clone() {
                                OscEvent::OutputStart => {
                                    capturing = true;
                                    output_buf.clear();
                                    let _ = app.emit(
                                        "pty:block",
                                        BlockEvent::from_osc(id, OscEvent::OutputStart),
                                    );
                                }
                                OscEvent::OutputEnd { exit_code } => {
                                    let mut block = BlockEvent::from_osc(
                                        id,
                                        OscEvent::OutputEnd { exit_code },
                                    );
                                    if !output_buf.is_empty() {
                                        block.output_b64 = Some(B64.encode(&output_buf));
                                    }
                                    let _ = app.emit("pty:block", block);
                                    capturing = false;
                                    output_buf.clear();
                                }
                                OscEvent::Cwd(path) => {
                                    *cwd_for_reader.lock() = Some(path.clone());
                                    let _ = app.emit(
                                        "pty:cwd",
                                        PtyCwdEvent { id, cwd: path },
                                    );
                                }
                                OscEvent::Aliases(b64) => {
                                    if let Some(items) = decode_aliases(&b64) {
                                        let _ = app.emit(
                                            "pty:aliases",
                                            PtyAliasesEvent { id, items },
                                        );
                                    }
                                }
                                other => {
                                    let _ = app.emit(
                                        "pty:block",
                                        BlockEvent::from_osc(id, other),
                                    );
                                }
                            }
                        }

                        // Tail bytes after the last event.
                        if capturing {
                            let tail = &result.passthrough[cur..];
                            append_capped(&mut output_buf, tail, MAX_CAPTURE);
                        }

                        // Reads that were pure OSC metadata (e.g. prompt markers)
                        // leave no passthrough — push() skips them.
                        if !sink.push(result.passthrough) {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
        });
    }

    {
        let app = app.clone();
        let manager = pty_state.inner().clone();
        thread::spawn(move || {
            let _ = child.wait();
            manager.sessions.lock().remove(&id);
            let _ = app.emit("pty:exit", PtyExitEvent { id });
        });
    }

    Ok(id)
}

#[tauri::command]
pub async fn pty_write(
    state: State<'_, Arc<PtyManager>>,
    id: u64,
    data_b64: String,
) -> Result<(), String> {
    let bytes = B64
        .decode(data_b64.as_bytes())
        .map_err(|e| format!("invalid base64: {e}"))?;
    let writer = state
        .sessions
        .lock()
        .get(&id)
        .map(|s| s.writer.clone())
        .ok_or_else(|| format!("unknown pty {id}"))?;
    // Off the main thread: a paste larger than the kernel's tty input buffer
    // blocks until the foreground process reads — the UI must not wait on it.
    tauri::async_runtime::spawn_blocking(move || {
        let mut w = writer.lock();
        w.write_all(&bytes).map_err(|e| e.to_string())?;
        w.flush().map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn pty_resize(
    state: State<'_, Arc<PtyManager>>,
    id: u64,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    let sessions = state.sessions.lock();
    let session = sessions
        .get(&id)
        .ok_or_else(|| format!("unknown pty {id}"))?;
    session.backend.resize(rows, cols)
}

#[tauri::command]
pub fn pty_kill(state: State<'_, Arc<PtyManager>>, id: u64) -> Result<(), String> {
    let mut session = state
        .sessions
        .lock()
        .remove(&id)
        .ok_or_else(|| format!("unknown pty {id}"))?;
    // Signal the child explicitly — SIGHUP-ignoring processes must not
    // survive their tab. This also lets the reaper thread's wait() return.
    // (A remote session closes its connection instead.)
    session.backend.kill();
    Ok(())
}

/// Read the last-known cwd for a session. Tracked via OSC 7 emitted by the
/// shell hook. Returns the directory Lume was launched from until the shell
/// emits its first marker.
pub fn pty_cwd(state: &Arc<PtyManager>, id: u64) -> Option<String> {
    state
        .sessions
        .lock()
        .get(&id)
        .and_then(|s| s.cwd.lock().clone())
}

/// Decode the OSC 7733 alias payload: base64 of newline-separated `name\tvalue`
/// rows. Returns None if the base64 or UTF-8 is invalid.
fn decode_aliases(b64: &str) -> Option<Vec<AliasItem>> {
    let bytes = B64.decode(b64.as_bytes()).ok()?;
    let text = String::from_utf8(bytes).ok()?;
    let items: Vec<AliasItem> = text
        .lines()
        .filter_map(|line| {
            let line = line.trim_end_matches('\r');
            if line.is_empty() {
                return None;
            }
            let (name, value) = match line.split_once('\t') {
                Some((n, v)) => (n.trim(), v),
                None => (line.trim(), ""),
            };
            if name.is_empty() {
                return None;
            }
            Some(AliasItem {
                name: name.to_string(),
                value: value.to_string(),
            })
        })
        .collect();
    if items.is_empty() {
        None
    } else {
        Some(items)
    }
}

fn append_capped(dst: &mut Vec<u8>, src: &[u8], cap: usize) {
    if dst.len() >= cap {
        return;
    }
    let remaining = cap - dst.len();
    let n = src.len().min(remaining);
    dst.extend_from_slice(&src[..n]);
}

#[allow(dead_code)]
fn _assert_send_sync() {
    fn check<T: Send + Sync>() {}
    check::<PtyManager>();
    let _ = anyhow!("");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decode_aliases_parses_name_tab_value() {
        let raw = "gst\tgit status\ngco\tgit checkout\n";
        let b64 = B64.encode(raw);
        let items = decode_aliases(&b64).unwrap();
        assert_eq!(
            items,
            vec![
                AliasItem {
                    name: "gst".into(),
                    value: "git status".into()
                },
                AliasItem {
                    name: "gco".into(),
                    value: "git checkout".into()
                },
            ]
        );
    }

    #[test]
    fn decode_aliases_skips_blank_and_nameless_rows() {
        let raw = "\n\tno-name\nll\tls -l\n";
        let b64 = B64.encode(raw);
        let items = decode_aliases(&b64).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].name, "ll");
    }

    #[test]
    fn decode_aliases_rejects_invalid_base64() {
        assert!(decode_aliases("not valid base64!!!").is_none());
    }
}
