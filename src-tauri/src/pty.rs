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
use tauri::{AppHandle, Emitter, State};

use crate::config::{Config, ShellConfig};
use crate::osc::{BlockEvent, OscEvent, OscParser};

pub struct PtySession {
    writer: Box<dyn Write + Send>,
    master: Box<dyn portable_pty::MasterPty + Send>,
    cwd: Arc<Mutex<Option<String>>>,
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
struct PtyOutputEvent {
    id: u64,
    data_b64: String,
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
    let program = cfg.program.clone().unwrap_or_else(|| {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
    });
    (program, cfg.args.clone())
}

#[tauri::command]
pub fn pty_spawn(
    app: AppHandle,
    pty_state: State<'_, Arc<PtyManager>>,
    cfg_state: State<'_, Arc<Mutex<Config>>>,
    rows: u16,
    cols: u16,
    cwd: Option<String>,
) -> Result<u64, String> {
    spawn_impl(app, pty_state, cfg_state, rows, cols, cwd).map_err(|e| e.to_string())
}

fn spawn_impl(
    app: AppHandle,
    pty_state: State<'_, Arc<PtyManager>>,
    cfg_state: State<'_, Arc<Mutex<Config>>>,
    rows: u16,
    cols: u16,
    init_cwd: Option<String>,
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
    let cwd = init_cwd
        .filter(|c| !c.is_empty())
        .map(std::path::PathBuf::from)
        .filter(|p| p.is_dir())
        .or_else(|| std::env::var("HOME").ok().map(std::path::PathBuf::from))
        .or_else(|| std::env::current_dir().ok());
    if let Some(cwd) = cwd {
        cmd.cwd(cwd);
    }
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    cmd.env("LUME_TERM", "1");

    let mut child = pair.slave.spawn_command(cmd).context("spawn shell")?;
    drop(pair.slave);

    let writer = pair.master.take_writer().context("take_writer")?;
    let mut reader = pair.master.try_clone_reader().context("clone_reader")?;

    let id = pty_state.next_id.fetch_add(1, Ordering::Relaxed);

    let cwd = Arc::new(Mutex::new(std::env::current_dir().ok().map(|p| p.display().to_string())));
    let cwd_for_reader = cwd.clone();

    pty_state.sessions.lock().insert(
        id,
        PtySession {
            writer,
            master: pair.master,
            cwd,
        },
    );

    {
        let app = app.clone();
        thread::spawn(move || {
            const MAX_CAPTURE: usize = 1024 * 1024; // 1 MiB
            let mut buf = [0u8; 8192];
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

                        let payload = PtyOutputEvent {
                            id,
                            data_b64: B64.encode(&result.passthrough),
                        };
                        if app.emit("pty:output", payload).is_err() {
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
pub fn pty_write(
    state: State<'_, Arc<PtyManager>>,
    id: u64,
    data_b64: String,
) -> Result<(), String> {
    let bytes = B64
        .decode(data_b64.as_bytes())
        .map_err(|e| format!("invalid base64: {e}"))?;
    let mut sessions = state.sessions.lock();
    let session = sessions
        .get_mut(&id)
        .ok_or_else(|| format!("unknown pty {id}"))?;
    session
        .writer
        .write_all(&bytes)
        .map_err(|e| e.to_string())?;
    session.writer.flush().map_err(|e| e.to_string())?;
    Ok(())
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
    session
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pty_kill(state: State<'_, Arc<PtyManager>>, id: u64) -> Result<(), String> {
    state
        .sessions
        .lock()
        .remove(&id)
        .ok_or_else(|| format!("unknown pty {id}"))
        .map(|_| ())
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
