//! Remote control: a small HTTP + WebSocket server that mirrors and lets you
//! drive the *active* pane from another device (phone, laptop) on the LAN.
//!
//! Security model: opt-in (off by default), bound to the LAN, gated by a random
//! token that's part of the URL. The token is regenerated on each start.

use std::net::TcpListener as StdTcpListener;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State as AxState,
    },
    http::StatusCode,
    response::{Html, IntoResponse, Response},
    routing::get,
    Router,
};
use futures_util::{SinkExt, StreamExt};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tauri::State;
use tokio::sync::{broadcast, mpsc, oneshot, watch};

use crate::pty::{pty_cwd, PtyManager};

pub struct RemoteState {
    inner: Mutex<RemoteInner>,
    /// The pty id the remote clients are bridged to (the app's active pane).
    target_tx: watch::Sender<Option<u64>>,
    /// Number of currently-connected remote clients.
    clients: Arc<AtomicUsize>,
}

struct RemoteInner {
    running: bool,
    port: u16,
    token: String,
    shutdown: Option<oneshot::Sender<()>>,
    /// cloudflared quick-tunnel child (cross-network public URL).
    tunnel_child: Option<std::process::Child>,
    /// Public https URL (with token) once the tunnel is up; None until then.
    public_url: Arc<Mutex<Option<String>>>,
    tunnel_requested: bool,
}

impl RemoteState {
    pub fn new() -> Self {
        let (target_tx, _rx) = watch::channel(None);
        Self {
            inner: Mutex::new(RemoteInner {
                running: false,
                port: 0,
                token: String::new(),
                shutdown: None,
                tunnel_child: None,
                public_url: Arc::new(Mutex::new(None)),
                tunnel_requested: false,
            }),
            target_tx,
            clients: Arc::new(AtomicUsize::new(0)),
        }
    }
}

#[derive(Clone)]
struct AppState {
    token: String,
    pty: Arc<PtyManager>,
    target_tx: watch::Sender<Option<u64>>,
    clients: Arc<AtomicUsize>,
}

/// Increments the live-client count for the lifetime of a connection.
struct ClientGuard(Arc<AtomicUsize>);
impl ClientGuard {
    fn new(c: Arc<AtomicUsize>) -> Self {
        c.fetch_add(1, Ordering::Relaxed);
        ClientGuard(c)
    }
}
impl Drop for ClientGuard {
    fn drop(&mut self) {
        self.0.fetch_sub(1, Ordering::Relaxed);
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteInfo {
    pub running: bool,
    pub port: u16,
    pub token: String,
    pub ip: String,
    /// LAN URL (same network).
    pub url: String,
    /// Public cross-network URL via cloudflared, once it's up.
    pub public_url: Option<String>,
    /// Whether a tunnel was requested for this session.
    pub tunnel_requested: bool,
    /// Whether `cloudflared` is installed (so the UI can offer cross-network).
    pub tunnel_available: bool,
    /// Number of remote clients currently connected.
    pub clients: usize,
}

fn info(inner: &RemoteInner, clients: usize) -> RemoteInfo {
    let ip = local_ip().unwrap_or_else(|| "127.0.0.1".to_string());
    let url = if inner.running {
        format!("http://{}:{}/?t={}", ip, inner.port, inner.token)
    } else {
        String::new()
    };
    RemoteInfo {
        running: inner.running,
        port: inner.port,
        token: inner.token.clone(),
        ip,
        url,
        public_url: inner.public_url.lock().clone(),
        tunnel_requested: inner.tunnel_requested,
        tunnel_available: cloudflared_available(),
        clients,
    }
}

/// Platform binary name.
fn exe_name() -> &'static str {
    if cfg!(windows) {
        "cloudflared.exe"
    } else {
        "cloudflared"
    }
}

/// Lume-owned install directory for the bundled cloudflared, per OS.
fn lume_bin_dir() -> Option<String> {
    if cfg!(windows) {
        std::env::var("LOCALAPPDATA")
            .ok()
            .map(|d| format!("{d}\\lume\\bin"))
    } else if cfg!(target_os = "macos") {
        std::env::var("HOME")
            .ok()
            .map(|h| format!("{h}/Library/Application Support/lume/bin"))
    } else {
        std::env::var("HOME")
            .ok()
            .map(|h| format!("{h}/.local/share/lume/bin"))
    }
}

/// Resolve the `cloudflared` binary. The GUI process's PATH can be minimal, so
/// check well-known install locations before falling back to a PATH lookup.
fn cloudflared_bin() -> String {
    let name = exe_name();
    if let Some(dir) = lume_bin_dir() {
        let p = format!("{dir}/{name}");
        if std::path::Path::new(&p).is_file() {
            return p;
        }
    }
    if let Ok(home) = std::env::var("HOME") {
        let p = format!("{home}/.local/bin/{name}");
        if std::path::Path::new(&p).is_file() {
            return p;
        }
    }
    for d in ["/usr/local/bin", "/usr/bin", "/opt/homebrew/bin"] {
        let p = format!("{d}/{name}");
        if std::path::Path::new(&p).is_file() {
            return p;
        }
    }
    name.to_string()
}

/// Is `cloudflared` available (on PATH or a known location)?
fn cloudflared_available() -> bool {
    std::process::Command::new(cloudflared_bin())
        .arg("--version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Spawn a cloudflared quick tunnel pointing at the local server. A reader
/// thread scans its output for the public trycloudflare URL and stores it
/// (with the token appended). Returns the child for later kill, or None if
/// cloudflared isn't available / failed to start.
fn start_tunnel(
    port: u16,
    token: String,
    public_url: Arc<Mutex<Option<String>>>,
) -> Option<std::process::Child> {
    use std::io::{BufRead, BufReader};
    use std::process::{Command, Stdio};

    let mut child = Command::new(cloudflared_bin())
        .args([
            "tunnel",
            "--no-autoupdate",
            "--url",
            &format!("http://127.0.0.1:{port}"),
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .ok()?;

    // cloudflared prints the URL to stderr; read both streams to be safe.
    let mut readers: Vec<Box<dyn std::io::Read + Send>> = Vec::new();
    if let Some(out) = child.stdout.take() {
        readers.push(Box::new(out));
    }
    if let Some(err) = child.stderr.take() {
        readers.push(Box::new(err));
    }
    // The URL is captured as soon as cloudflared prints it, but the tunnel
    // isn't reachable until a few seconds later (QUIC connection registers).
    // Publishing the URL too early causes Cloudflare error 1033. So we hold the
    // captured URL in `pending` and only publish it once a "registered tunnel
    // connection" log line appears (with an 8s fallback for log wording drift).
    let pending: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));
    for r in readers {
        let public_url = public_url.clone();
        let pending = pending.clone();
        let token = token.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(r);
            // Keep reading to the end — if we stop draining cloudflared's pipe
            // it blocks/dies on its next write and the tunnel drops.
            for line in reader.lines().map_while(Result::ok) {
                if pending.lock().is_none() {
                    if let Some(base) = extract_trycloudflare(&line) {
                        *pending.lock() = Some(format!("{base}/?t={token}"));
                    }
                }
                let low = line.to_lowercase();
                if low.contains("registered tunnel connection")
                    || low.contains("connection registered")
                    || low.contains("registered tunnel")
                {
                    if let Some(u) = pending.lock().clone() {
                        let mut pu = public_url.lock();
                        if pu.is_none() {
                            *pu = Some(u);
                        }
                    }
                }
            }
        });
    }
    // Fallback: publish after a delay in case the "registered" wording changes.
    {
        let public_url = public_url.clone();
        let pending = pending.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_secs(8));
            if let Some(u) = pending.lock().clone() {
                let mut pu = public_url.lock();
                if pu.is_none() {
                    *pu = Some(u);
                }
            }
        });
    }
    Some(child)
}

/// Extract a `https://*.trycloudflare.com` base URL from a cloudflared log line.
fn extract_trycloudflare(line: &str) -> Option<String> {
    let pos = line.find("https://")?;
    let rest = &line[pos..];
    let end = rest
        .find(|c: char| c.is_whitespace())
        .unwrap_or(rest.len());
    let base = &rest[..end];
    if base.contains(".trycloudflare.com") {
        Some(base.to_string())
    } else {
        None
    }
}

fn gen_token() -> String {
    const CHARS: &[u8] =
        b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let mut buf = [0u8; 24];
    getrandom::fill(&mut buf).expect("getrandom");
    buf.iter()
        .map(|b| CHARS[(*b as usize) % CHARS.len()] as char)
        .collect()
}

/// Best-effort LAN IP: open a UDP socket "to" a public address (no packets are
/// actually sent) and read which local interface the OS picked.
fn local_ip() -> Option<String> {
    let sock = std::net::UdpSocket::bind("0.0.0.0:0").ok()?;
    sock.connect("8.8.8.8:80").ok()?;
    sock.local_addr().ok().map(|a| a.ip().to_string())
}

#[tauri::command]
pub fn remote_status(remote: State<'_, Arc<RemoteState>>) -> RemoteInfo {
    info(&remote.inner.lock(), remote.clients.load(Ordering::Relaxed))
}

/// Download + install the `cloudflared` binary into a Lume-owned location so
/// cross-network tunnels work without the user touching a terminal. Picks the
/// right asset for the current OS + architecture.
#[tauri::command]
pub fn remote_install_cloudflared() -> Result<(), String> {
    const BASE: &str =
        "https://github.com/cloudflare/cloudflared/releases/latest/download";

    let arch = match std::env::consts::ARCH {
        "x86_64" => "amd64",
        "aarch64" => "arm64",
        "arm" => "arm",
        "x86" => "386",
        other => return Err(format!("Architecture non supportée : {other}")),
    };

    let dir = lume_bin_dir().ok_or("Dossier d'installation introuvable.")?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let dest = format!("{dir}/{}", exe_name());

    match std::env::consts::OS {
        "linux" => {
            let url = format!("{BASE}/cloudflared-linux-{arch}");
            if !download(&url, &dest) {
                return Err("Échec du téléchargement (curl ou wget requis).".into());
            }
            chmod_exec(&dest)?;
        }
        "windows" => {
            let url = format!("{BASE}/cloudflared-windows-{arch}.exe");
            if !download(&url, &dest) {
                return Err("Échec du téléchargement.".into());
            }
        }
        "macos" => {
            // Darwin assets ship as a .tgz containing the `cloudflared` binary.
            let tgz = format!("{dir}/cloudflared.tgz");
            let url = format!("{BASE}/cloudflared-darwin-{arch}.tgz");
            if !download(&url, &tgz) {
                return Err("Échec du téléchargement.".into());
            }
            let ok = std::process::Command::new("tar")
                .args(["-xzf", &tgz, "-C", &dir])
                .status()
                .map(|s| s.success())
                .unwrap_or(false);
            let _ = std::fs::remove_file(&tgz);
            if !ok {
                return Err("Extraction de l'archive échouée.".into());
            }
            chmod_exec(&dest)?;
        }
        other => return Err(format!("OS non supporté : {other}")),
    }

    if !cloudflared_available() {
        return Err("Binaire installé mais non exécutable.".to_string());
    }
    Ok(())
}

fn chmod_exec(path: &str) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755))
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(unix))]
    let _ = path;
    Ok(())
}

fn download(url: &str, dest: &str) -> bool {
    use std::process::{Command, Stdio};
    let run = |cmd: &mut Command| {
        cmd.stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    };
    // curl / wget on unix; PowerShell on Windows.
    if run(Command::new("curl").args(["-fsSL", url, "-o", dest])) {
        return true;
    }
    if run(Command::new("wget").args(["-q", url, "-O", dest])) {
        return true;
    }
    #[cfg(windows)]
    {
        return run(Command::new("powershell").args([
            "-NoProfile",
            "-Command",
            &format!("Invoke-WebRequest -Uri '{url}' -OutFile '{dest}'"),
        ]));
    }
    #[allow(unreachable_code)]
    false
}

/// Point the remote clients at a pty (the app's active pane). Cheap — just
/// updates a watch value read by live WebSocket bridges.
#[tauri::command]
pub fn remote_set_target(remote: State<'_, Arc<RemoteState>>, pty_id: Option<u64>) {
    let _ = remote.target_tx.send_replace(pty_id);
}

#[tauri::command]
pub fn remote_stop(remote: State<'_, Arc<RemoteState>>) -> RemoteInfo {
    let mut inner = remote.inner.lock();
    if let Some(tx) = inner.shutdown.take() {
        let _ = tx.send(());
    }
    if let Some(mut child) = inner.tunnel_child.take() {
        let _ = child.kill();
    }
    *inner.public_url.lock() = None;
    inner.running = false;
    inner.tunnel_requested = false;
    info(&inner, remote.clients.load(Ordering::Relaxed))
}

#[tauri::command]
pub fn remote_start(
    remote: State<'_, Arc<RemoteState>>,
    pty: State<'_, Arc<PtyManager>>,
    port: u16,
    tunnel: bool,
) -> Result<RemoteInfo, String> {
    let mut inner = remote.inner.lock();
    if inner.running {
        return Ok(info(&inner, remote.clients.load(Ordering::Relaxed)));
    }
    remote.clients.store(0, Ordering::Relaxed);

    // If the preferred port is taken (e.g. a leftover Lume instance still owns
    // it), fall back to any free port instead of failing — the actual port is
    // reported back and used to build the share URL.
    let std_listener = StdTcpListener::bind(("0.0.0.0", port))
        .or_else(|_| StdTcpListener::bind(("0.0.0.0", 0)))
        .map_err(|e| format!("bind: {e}"))?;
    std_listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let actual_port = std_listener.local_addr().map_err(|e| e.to_string())?.port();

    let token = gen_token();
    let state = AppState {
        token: token.clone(),
        pty: pty.inner().clone(),
        target_tx: remote.target_tx.clone(),
        clients: remote.clients.clone(),
    };
    let app = Router::new()
        .route("/", get(index))
        .route("/ws", get(ws_handler))
        .with_state(state);

    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
    tauri::async_runtime::spawn(async move {
        let listener = match tokio::net::TcpListener::from_std(std_listener) {
            Ok(l) => l,
            Err(_) => return,
        };
        let _ = axum::serve(listener, app)
            .with_graceful_shutdown(async move {
                let _ = shutdown_rx.await;
            })
            .await;
    });

    inner.running = true;
    inner.port = actual_port;
    inner.token = token.clone();
    inner.shutdown = Some(shutdown_tx);
    inner.tunnel_requested = tunnel;
    *inner.public_url.lock() = None;
    inner.tunnel_child = None;
    if tunnel {
        let public_url = inner.public_url.clone();
        inner.tunnel_child = start_tunnel(actual_port, token, public_url);
    }
    Ok(info(&inner, remote.clients.load(Ordering::Relaxed)))
}

#[derive(Deserialize)]
struct TokenQuery {
    t: Option<String>,
}

fn token_ok(q: &TokenQuery, st: &AppState) -> bool {
    q.t.as_deref() == Some(st.token.as_str())
}

async fn index(Query(q): Query<TokenQuery>, AxState(st): AxState<AppState>) -> Response {
    if !token_ok(&q, &st) {
        return (StatusCode::UNAUTHORIZED, "Jeton invalide").into_response();
    }
    Html(INDEX_HTML).into_response()
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(q): Query<TokenQuery>,
    AxState(st): AxState<AppState>,
) -> Response {
    if !token_ok(&q, &st) {
        return (StatusCode::UNAUTHORIZED, "bad token").into_response();
    }
    ws.on_upgrade(move |socket| bridge(socket, st))
}

async fn bridge(socket: WebSocket, st: AppState) {
    let _guard = ClientGuard::new(st.clients.clone());
    let (sender, receiver) = socket.split();
    // Side channel for server→client control frames (completion listings),
    // produced by the input task and forwarded as Text frames by the output task.
    let (ctrl_tx, ctrl_rx) = mpsc::channel::<String>(16);
    let mut out = tokio::spawn(output_task(sender, st.clone(), ctrl_rx));
    let mut inp = tokio::spawn(input_task(receiver, st, ctrl_tx));
    // When either direction ends (client disconnects, pty closed), stop both.
    tokio::select! {
        _ = &mut out => inp.abort(),
        _ = &mut inp => out.abort(),
    }
}

/// pty output → websocket. Re-subscribes when the active pane (target) changes.
async fn output_task(
    mut sender: futures_util::stream::SplitSink<WebSocket, Message>,
    st: AppState,
    mut ctrl_rx: mpsc::Receiver<String>,
) {
    let mut trx = st.target_tx.subscribe();
    loop {
        let target = *trx.borrow_and_update();
        match target.and_then(|id| st.pty.attach(id)) {
            Some((snapshot, mut rx)) => {
                // Replay the current screen + recent scrollback so a (re)connecting
                // client doesn't see a blank terminal.
                if !snapshot.is_empty()
                    && sender.send(Message::Binary(snapshot.into())).await.is_err()
                {
                    return;
                }
                loop {
                tokio::select! {
                    msg = rx.recv() => match msg {
                        Ok(bytes) => {
                            if sender.send(Message::Binary(bytes.into())).await.is_err() {
                                return;
                            }
                        }
                        Err(broadcast::error::RecvError::Lagged(_)) => continue,
                        Err(broadcast::error::RecvError::Closed) => break,
                    },
                    ctl = ctrl_rx.recv() => {
                        if let Some(txt) = ctl {
                            // Text frame = control (PTY output is always Binary).
                            if sender.send(Message::Text(txt.into())).await.is_err() {
                                return;
                            }
                        }
                    },
                    ch = trx.changed() => {
                        if ch.is_err() {
                            return;
                        }
                        break; // re-evaluate the target on the outer loop
                    }
                }
                }
            },
            None => {
                // No target (or it vanished): wait for the active pane to change.
                if trx.changed().await.is_err() {
                    return;
                }
            }
        }
    }
}

/// Handle one client→server message. A 2-byte sentinel (NUL, SOH) — which
/// typed input can't produce as a chunk — marks a resize control "<cols>x<rows>";
/// everything else is raw terminal input. Works for both Text and Binary frames.
fn handle_input(st: &AppState, id: u64, data: &[u8]) {
    if let Some(rest) = data.strip_prefix(&[0x00u8, 0x01u8]) {
        if let Ok(s) = std::str::from_utf8(rest) {
            if let Some((c, r)) = s.split_once('x') {
                if let (Ok(cols), Ok(rows)) =
                    (c.parse::<u16>(), r.parse::<u16>())
                {
                    st.pty.resize_pty(id, rows, cols);
                    return;
                }
            }
        }
    }
    st.pty.write_bytes(id, data);
}

/// websocket → pty input (resize + completion control messages + raw input).
async fn input_task(
    mut receiver: futures_util::stream::SplitStream<WebSocket>,
    st: AppState,
    ctrl_tx: mpsc::Sender<String>,
) {
    let trx = st.target_tx.subscribe();
    while let Some(Ok(msg)) = receiver.next().await {
        let Some(id) = *trx.borrow() else { continue };
        let bytes: Vec<u8> = match msg {
            Message::Text(t) => t.as_str().as_bytes().to_vec(),
            Message::Binary(b) => b.as_ref().to_vec(),
            Message::Close(_) => break,
            _ => continue,
        };
        // Completion request: NUL,STX + the word being typed → reply with a
        // directory listing for the target pane's cwd (off-thread, best-effort).
        if let Some(tok) = bytes.strip_prefix(&[0x00u8, 0x02u8]) {
            let token = String::from_utf8_lossy(tok).into_owned();
            let cwd = pty_cwd(&st.pty, id);
            let tx = ctrl_tx.clone();
            tokio::task::spawn_blocking(move || {
                let _ = tx.try_send(build_listing_json(cwd.as_deref(), &token));
            });
            continue;
        }
        handle_input(&st, id, &bytes);
    }
}

/// JSON listing of the cwd entries matching `token`'s directory + prefix.
/// Shape: `{"t":"ls","items":[["name",isDir], …]}` (dirs first, capped).
fn build_listing_json(cwd: Option<&str>, token: &str) -> String {
    let items = list_entries(cwd, token);
    let arr: Vec<serde_json::Value> = items
        .into_iter()
        .map(|(n, d)| serde_json::json!([n, d]))
        .collect();
    serde_json::json!({ "t": "ls", "items": arr }).to_string()
}

fn list_entries(cwd: Option<&str>, token: &str) -> Vec<(String, bool)> {
    let cwd = match cwd {
        Some(c) if !c.is_empty() => c,
        _ => return vec![],
    };
    // Expand a leading ~ to $HOME.
    let token = match token.strip_prefix('~') {
        Some(rest) => match std::env::var("HOME") {
            Ok(h) => format!("{h}{rest}"),
            Err(_) => token.to_string(),
        },
        None => token.to_string(),
    };
    // Split into the directory to list and the name prefix to match.
    let (dir_part, prefix) = if token.ends_with('/') {
        (token.trim_end_matches('/').to_string(), String::new())
    } else {
        match token.rsplit_once('/') {
            Some((d, p)) => (d.to_string(), p.to_string()),
            None => (String::new(), token.clone()),
        }
    };
    let dir_path = {
        let p = std::path::Path::new(&dir_part);
        if dir_part.is_empty() {
            std::path::PathBuf::from(cwd)
        } else if p.is_absolute() {
            p.to_path_buf()
        } else {
            std::path::Path::new(cwd).join(p)
        }
    };
    let Ok(rd) = std::fs::read_dir(&dir_path) else {
        return vec![];
    };
    let show_hidden = prefix.starts_with('.');
    let mut out: Vec<(String, bool)> = Vec::new();
    for e in rd.flatten() {
        let name = e.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') && !show_hidden {
            continue;
        }
        // Case-sensitive prefix so the client can append the exact remainder.
        if !prefix.is_empty() && !name.starts_with(&prefix) {
            continue;
        }
        let is_dir = e.file_type().map(|t| t.is_dir()).unwrap_or(false);
        out.push((name, is_dir));
        if out.len() >= 200 {
            break;
        }
    }
    // Directories first, then case-insensitive alphabetical.
    out.sort_by(|a, b| {
        b.1.cmp(&a.1)
            .then_with(|| a.0.to_lowercase().cmp(&b.0.to_lowercase()))
    });
    out.truncate(60);
    out
}

const INDEX_HTML: &str = r##"<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<title>Lume Remote</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.min.css"/>
<style>
  html,body{margin:0;height:100%;background:#0e1014;overflow:hidden;font:13px system-ui,sans-serif}
  #app{position:fixed;left:0;top:0;right:0;display:flex;flex-direction:column;overflow:hidden}
  #bar{flex:0 0 30px;display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;color:#fff;background:#1b2330;padding:0 10px}
  #msg{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #dc{background:#3a2330;color:#ff9bb0;border:1px solid #6b3347;border-radius:5px;padding:3px 9px;font-size:12px}
  #term{flex:1 1 auto;min-height:0;padding:2px;overflow:hidden}
  .xterm{height:100%}
  #assist{flex:0 0 auto;background:#141a24;border-top:1px solid #232c3a}
  #chips{display:flex;gap:6px;overflow-x:auto;padding:5px 6px;white-space:nowrap;-webkit-overflow-scrolling:touch}
  #chips:empty{display:none}
  .chip{flex:0 0 auto;background:#1f2937;color:#cbd5e1;border:1px solid #2b3647;border-radius:6px;padding:5px 9px;font-size:13px;font-family:ui-monospace,monospace}
  .chip.d{color:#8ab4ff;border-color:#33405a}
  #keys{display:flex;gap:5px;overflow-x:auto;padding:5px 6px;white-space:nowrap;-webkit-overflow-scrolling:touch}
  .key{flex:0 0 auto;background:#222b39;color:#e6e6e6;border:1px solid #2f3a4c;border-radius:6px;padding:7px 11px;font-size:13px;min-width:30px;text-align:center;user-select:none;-webkit-user-select:none}
  .key:active{background:#2d3a4d}
  .key.on{background:#2b6cff;border-color:#2b6cff;color:#fff}
  #overlay{display:none;position:fixed;inset:0;z-index:50;background:rgba(8,10,14,0.93);align-items:center;justify-content:center;padding:26px}
  #overlay .box{max-width:330px;text-align:center;color:#e6e6e6}
  #ov-icon{font-size:42px;margin-bottom:10px}
  #ov-title{font-size:19px;font-weight:600;margin-bottom:6px}
  #ov-sub{font-size:13px;color:#9aa4b2;margin-bottom:20px;line-height:1.45}
  #reconnect{background:#101a2b;color:#e8f2ff;border:1px solid #4ea1ff;border-radius:10px;padding:12px 26px;font-size:15px;font-weight:600;letter-spacing:.02em;box-shadow:0 0 0 1px rgba(78,161,255,.25), 0 0 20px rgba(78,161,255,.45), inset 0 0 14px rgba(78,161,255,.12);animation:rcGlow 2.4s ease-in-out infinite;transition:background .15s}
  #reconnect:active{background:#16243a;animation:none;box-shadow:0 0 0 1px rgba(78,161,255,.55), 0 0 30px rgba(78,161,255,.7), inset 0 0 16px rgba(78,161,255,.2)}
  @keyframes rcGlow{0%,100%{box-shadow:0 0 0 1px rgba(78,161,255,.22), 0 0 14px rgba(78,161,255,.32), inset 0 0 12px rgba(78,161,255,.10)}50%{box-shadow:0 0 0 1px rgba(78,161,255,.4), 0 0 28px rgba(78,161,255,.62), inset 0 0 16px rgba(78,161,255,.16)}}
</style>
</head>
<body>
<div id="app">
  <div id="bar"><span id="msg">Connexion…</span><button id="dc" style="display:none">Déconnecter</button></div>
  <div id="term"></div>
  <div id="assist"><div id="chips"></div><div id="keys"></div></div>
</div>
<div id="overlay"><div class="box"><div id="ov-icon">⚠️</div><div id="ov-title">Connexion perdue</div><div id="ov-sub"></div><button id="reconnect">Reconnecter</button></div></div>
<script src="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/lib/xterm.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/lib/addon-fit.min.js"></script>
<script>
(function(){
  var $=function(id){return document.getElementById(id);};
  var token = new URLSearchParams(location.search).get('t') || '';
  var msg=$('msg'), dc=$('dc'), termEl=$('term'), app=$('app'), chipsEl=$('chips'), keysEl=$('keys');
  var closedByUser=false;
  var small = Math.min(window.innerWidth, window.innerHeight) < 480;
  var term = new Terminal({ cursorBlink:true, fontSize: small?12:14, fontFamily:'ui-monospace,monospace', scrollback:2000, theme:{background:'#0e1014',foreground:'#e6e6e6'} });
  var fit = new FitAddon.FitAddon();
  term.loadAddon(fit); term.open(termEl);
  var proto = location.protocol === 'https:' ? 'wss' : 'ws';
  var ws;

  // --- line tracking (best-effort, for path completion) ---
  var curLine='';
  function track(s){
    if(s.indexOf('\x1b')>=0) return;            // escape seq (arrows...) — skip
    for(var i=0;i<s.length;i++){
      var code=s.charCodeAt(i);
      if(code===13||code===10){ curLine=''; }                       // Enter
      else if(code===127||code===8){ curLine=curLine.slice(0,-1); } // backspace
      else if(code===3||code===21){ curLine=''; }                   // ^C / ^U
      else if(code>=32){ curLine+=s[i]; }
    }
  }
  function curToken(){ if(curLine.indexOf(' ')<0) return null; var p=curLine.split(/\s+/); return p[p.length-1]; }

  // --- send helper (used by keyboard + buttons) ---
  function send(s){ if(ws.readyState===1) ws.send(s); track(s); scheduleComplete(); }

  // --- completion chips ---
  var ct; function scheduleComplete(){ clearTimeout(ct); ct=setTimeout(reqComplete,140); }
  function reqComplete(){ var t=curToken(); if(t===null){ chipsEl.innerHTML=''; return; } if(ws.readyState===1) ws.send(String.fromCharCode(0,2)+t); }
  function renderChips(items){
    chipsEl.innerHTML='';
    var t=curToken(); var base = t===null?'':t.split('/').pop();
    items.forEach(function(it){
      var name=it[0], isDir=it[1];
      var c=document.createElement('div'); c.className='chip'+(isDir?' d':''); c.textContent=name+(isDir?'/':'');
      bindTap(c, function(){
        var suffix = name.indexOf(base)===0 ? name.slice(base.length) : name;
        suffix = suffix.replace(/ /g,'\\ ');
        if(isDir) suffix += '/';
        send(suffix); term.focus();
      });
      chipsEl.appendChild(c);
    });
  }

  // --- extra keys (Termux-style) ---
  var ctrlPending=false, ctrlBtn=null;
  var KEYS=[['Esc','\x1b'],['Tab','\t'],['Ctrl','CTRL'],['←','\x1b[D'],['↑','\x1b[A'],['↓','\x1b[B'],['→','\x1b[C'],['Home','\x1b[H'],['End','\x1b[F'],['|','|'],['~','~'],['/','/'],['-','-'],['_','_'],['^C','\x03'],['^L','\x0c'],['^D','\x04']];
  // Trigger on a tap, but let a horizontal drag scroll the row. touchstart/move
  // stay passive (so native scroll works); only a no-move touchend fires the
  // action (and preventDefault keeps the keyboard open). `touched` blocks the
  // synthesized mouse events that follow a touch.
  function bindTap(el, fn){
    var sx=0, sy=0, moved=false, touched=false;
    el.addEventListener('touchstart', function(e){ touched=true; var t=e.touches[0]; sx=t.clientX; sy=t.clientY; moved=false; }, {passive:true});
    el.addEventListener('touchmove', function(e){ var t=e.touches[0]; if(Math.abs(t.clientX-sx)>8 || Math.abs(t.clientY-sy)>8) moved=true; }, {passive:true});
    el.addEventListener('touchend', function(e){ if(!moved){ e.preventDefault(); fn(); } }, {passive:false});
    el.addEventListener('mousedown', function(e){ if(touched) return; e.preventDefault(); fn(); });
  }
  KEYS.forEach(function(k){
    var b=document.createElement('div'); b.className='key'; b.textContent=k[0];
    if(k[1]==='CTRL'){ ctrlBtn=b; bindTap(b,function(){ ctrlPending=!ctrlPending; b.classList.toggle('on',ctrlPending); }); }
    else bindTap(b,function(){ send(k[1]); term.focus(); });
    keysEl.appendChild(b);
  });

  term.onData(function(d){
    if(ctrlPending && d.length===1){
      var code=d.toUpperCase().charCodeAt(0);
      if(code>=64 && code<=95) d=String.fromCharCode(code & 0x1f);
      ctrlPending=false; if(ctrlBtn) ctrlBtn.classList.remove('on');
    }
    send(d);
  });

  // Swipe horizontally on the terminal to move the cursor (←/→); vertical swipes
  // still scroll the scrollback. Decide the axis on the first move, then lock it.
  (function(){
    var x0=0,y0=0,lastX=0,mode=0,STEP=16;   // mode: 0=undecided,1=horizontal,2=vertical
    termEl.addEventListener('touchstart',function(e){ if(e.touches.length!==1) return; var t=e.touches[0]; x0=t.clientX; y0=t.clientY; lastX=t.clientX; mode=0; },{passive:true});
    termEl.addEventListener('touchmove',function(e){
      if(e.touches.length!==1) return;
      var t=e.touches[0], dx=t.clientX-x0, dy=t.clientY-y0;
      if(mode===0){ if(Math.abs(dx)>10 && Math.abs(dx)>Math.abs(dy)*1.3){ mode=1; lastX=t.clientX; } else if(Math.abs(dy)>10){ mode=2; } }
      if(mode===1){
        e.preventDefault();
        var d=t.clientX-lastX;
        while(d>=STEP){ if(ws.readyState===1) ws.send('\x1b[C'); lastX+=STEP; d-=STEP; }
        while(d<=-STEP){ if(ws.readyState===1) ws.send('\x1b[D'); lastX-=STEP; d+=STEP; }
      }
    },{passive:false});
  })();

  var overlay=$('overlay'), ovTitle=$('ov-title'), ovSub=$('ov-sub'), ovIcon=$('ov-icon');
  function showOverlay(byUser){
    ovIcon.textContent = byUser ? '🔌' : '⚠️';
    ovTitle.textContent = byUser ? 'Déconnecté' : 'Connexion perdue';
    ovSub.textContent = byUser ? "Tu es déconnecté du terminal distant." : "Le tunnel ou le réseau s'est interrompu.";
    overlay.style.display='flex';
  }
  function hideOverlay(){ overlay.style.display='none'; }
  function connect(){
    closedByUser=false; hideOverlay(); msg.textContent='Connexion…';
    try{ term.reset(); }catch(e){}   // clear so the server's replay rebuilds cleanly
    curLine='';
    ws = new WebSocket(proto + '://' + location.host + '/ws?t=' + encodeURIComponent(token));
    ws.binaryType = 'arraybuffer';
    ws.onmessage = function(e){
      if(typeof e.data === 'string'){
        try{ var m=JSON.parse(e.data); if(m && m.t==='ls'){ renderChips(m.items||[]); return; } }catch(_){}
        term.write(e.data); return;
      }
      term.write(new Uint8Array(e.data));
    };
    ws.onopen = function(){ msg.textContent='● Connecté'; dc.style.display=''; layout(); term.focus(); };
    ws.onclose = function(){ msg.textContent = closedByUser ? 'Déconnecté' : 'Connexion perdue'; dc.style.display='none'; showOverlay(closedByUser); };
    ws.onerror = function(){ msg.textContent='Erreur de connexion'; };
  }
  dc.onclick = function(){ closedByUser = true; if(ws) ws.close(); };
  $('reconnect').onclick = function(){ connect(); };
  connect();

  function sendResize(){ if(ws.readyState===1) ws.send(String.fromCharCode(0,1)+term.cols+'x'+term.rows); }
  function layout(){
    var vv=window.visualViewport;
    var h = vv?vv.height:window.innerHeight, top = vv?vv.offsetTop:0;
    app.style.height=h+'px'; app.style.transform='translateY('+top+'px)';
    try{fit.fit();}catch(e){} sendResize();
  }
  var rt; function relayout(){ clearTimeout(rt); rt=setTimeout(layout,100); }
  window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', relayout);
  if (window.visualViewport){ window.visualViewport.addEventListener('resize', relayout); window.visualViewport.addEventListener('scroll', relayout); }
  window.addEventListener('load', layout);
  setTimeout(layout, 300);
})();
</script>
</body>
</html>"##;

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn list_entries_filters_orders_and_descends() {
        let base = std::env::temp_dir().join("lume_remote_le_test");
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(base.join("src")).unwrap();
        fs::create_dir_all(base.join("scripts")).unwrap();
        fs::write(base.join("setup.txt"), b"x").unwrap();
        fs::write(base.join("readme.md"), b"x").unwrap();
        fs::write(base.join(".hidden"), b"x").unwrap();
        fs::write(base.join("src").join("main.rs"), b"x").unwrap();
        let cwd = base.to_string_lossy().to_string();

        // prefix "s" → src, scripts (dirs first), then setup.txt; not readme.md
        let items = list_entries(Some(&cwd), "s");
        let names: Vec<&str> = items.iter().map(|(n, _)| n.as_str()).collect();
        assert!(names.contains(&"src") && names.contains(&"scripts") && names.contains(&"setup.txt"));
        assert!(!names.contains(&"readme.md"));
        assert!(items[0].1 && items[1].1, "directories should sort first");

        // hidden files only when the prefix starts with '.'
        assert!(!list_entries(Some(&cwd), "").iter().any(|(n, _)| n == ".hidden"));
        assert!(list_entries(Some(&cwd), ".").iter().any(|(n, _)| n == ".hidden"));

        // trailing slash descends into the sub-directory
        assert!(list_entries(Some(&cwd), "src/").iter().any(|(n, _)| n == "main.rs"));

        // no cwd → empty
        assert!(list_entries(None, "x").is_empty());

        let _ = fs::remove_dir_all(&base);
    }
}
