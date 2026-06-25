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
use tokio::sync::{broadcast, oneshot, watch};

use crate::pty::PtyManager;

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
    for r in readers {
        let public_url = public_url.clone();
        let token = token.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(r);
            // Keep reading to the end — if we stop draining cloudflared's pipe
            // it blocks/dies on its next write and the tunnel drops (error 1033).
            for line in reader.lines().map_while(Result::ok) {
                if public_url.lock().is_none() {
                    if let Some(pos) = line.find("https://") {
                        let rest = &line[pos..];
                        let end = rest
                            .find(|c: char| c.is_whitespace())
                            .unwrap_or(rest.len());
                        let base = &rest[..end];
                        if base.contains(".trycloudflare.com") {
                            *public_url.lock() = Some(format!("{base}/?t={token}"));
                        }
                    }
                }
            }
        });
    }
    Some(child)
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

    let std_listener =
        StdTcpListener::bind(("0.0.0.0", port)).map_err(|e| format!("bind {port}: {e}"))?;
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
    let mut out = tokio::spawn(output_task(sender, st.clone()));
    let mut inp = tokio::spawn(input_task(receiver, st));
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
) {
    let mut trx = st.target_tx.subscribe();
    loop {
        let target = *trx.borrow_and_update();
        match target.and_then(|id| st.pty.subscribe(id)) {
            Some(mut rx) => loop {
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
                    ch = trx.changed() => {
                        if ch.is_err() {
                            return;
                        }
                        break; // re-evaluate the target on the outer loop
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

/// websocket → pty input (and resize control messages).
async fn input_task(
    mut receiver: futures_util::stream::SplitStream<WebSocket>,
    st: AppState,
) {
    let trx = st.target_tx.subscribe();
    while let Some(Ok(msg)) = receiver.next().await {
        let Some(id) = *trx.borrow() else { continue };
        match msg {
            Message::Text(t) => handle_input(&st, id, t.as_str().as_bytes()),
            Message::Binary(b) => handle_input(&st, id, b.as_ref()),
            Message::Close(_) => break,
            _ => {}
        }
    }
}

const INDEX_HTML: &str = r##"<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<title>Lume Remote</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.min.css"/>
<style>
  html,body{margin:0;height:100%;background:#0e1014;overflow:hidden}
  #bar{position:absolute;top:0;left:0;right:0;height:30px;display:flex;align-items:center;justify-content:space-between;gap:8px;font:12px system-ui,sans-serif;color:#fff;background:#1b2330;padding:0 10px;z-index:10}
  #msg{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #dc{background:#3a2330;color:#ff9bb0;border:1px solid #6b3347;border-radius:5px;padding:3px 9px;font:12px system-ui;cursor:pointer}
  #term{position:absolute;top:30px;left:0;right:0;padding:2px}
  .xterm{height:100%}
</style>
</head>
<body>
<div id="bar"><span id="msg">Connexion…</span><button id="dc" style="display:none">Déconnecter</button></div>
<div id="term"></div>
<script src="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/lib/xterm.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/lib/addon-fit.min.js"></script>
<script>
(function(){
  var token = new URLSearchParams(location.search).get('t') || '';
  var msg = document.getElementById('msg');
  var dc = document.getElementById('dc');
  var termEl = document.getElementById('term');
  var closedByUser = false;
  var small = Math.min(window.innerWidth, window.innerHeight) < 480;
  var term = new Terminal({ cursorBlink:true, fontSize: small?12:14, fontFamily:'monospace', scrollback:2000, theme:{background:'#0e1014',foreground:'#e6e6e6'} });
  var fit = new FitAddon.FitAddon();
  term.loadAddon(fit);
  term.open(termEl);
  var proto = location.protocol === 'https:' ? 'wss' : 'ws';
  var ws = new WebSocket(proto + '://' + location.host + '/ws?t=' + encodeURIComponent(token));
  ws.binaryType = 'arraybuffer';
  function sendResize(){ if(ws.readyState===1) ws.send(String.fromCharCode(0,1)+term.cols+'x'+term.rows); }
  function layout(){ var vh=(window.visualViewport?window.visualViewport.height:window.innerHeight); termEl.style.height=Math.max(40,vh-30)+'px'; try{fit.fit();}catch(e){} sendResize(); }
  var rt; function relayout(){ clearTimeout(rt); rt=setTimeout(layout,100); }
  ws.onopen = function(){ msg.textContent='● Connecté'; dc.style.display=''; layout(); term.focus(); };
  ws.onclose = function(){ msg.textContent = closedByUser ? 'Déconnecté' : 'Connexion perdue'; dc.style.display='none'; };
  ws.onerror = function(){ msg.textContent='Erreur de connexion'; };
  ws.onmessage = function(e){
    if (typeof e.data === 'string') term.write(e.data);
    else term.write(new Uint8Array(e.data));
  };
  dc.onclick = function(){ closedByUser = true; ws.close(); };
  term.onData(function(d){ if(ws.readyState===1) ws.send(d); });
  window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', relayout);
  if (window.visualViewport){ window.visualViewport.addEventListener('resize', relayout); window.visualViewport.addEventListener('scroll', relayout); }
  window.addEventListener('load', layout);
  setTimeout(layout, 300);
})();
</script>
</body>
</html>"##;
