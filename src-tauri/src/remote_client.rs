//! Lume ↔ Lume: open a terminal of *another* Lume in a local pane, over that
//! Lume's remote-control channel (same end-to-end encrypted protocol as the
//! phone page — see remote_proto.rs).
//!
//! The connection is registered in the PtyManager as a remote session, so the
//! pane, the native grid and pty_write/resize/kill work exactly as for a local
//! shell. Pairing happens once (paste the QR code's link, which carries the
//! one-time secret); afterwards the peer is remembered by its server id, so a
//! new address — a new tunnel URL, a new LAN IP — reconnects without
//! re-pairing. A dropped connection (Wi-Fi change, sleep) is retried with
//! backoff in place; the server replays the screen on reconnect.

use std::sync::Arc;
use std::time::{Duration, Instant};

use futures_util::{SinkExt, StreamExt};
use serde::Serialize;
use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::mpsc;
use tokio_tungstenite::{connect_async, tungstenite::Message, MaybeTlsStream, WebSocketStream};

use crate::pty::{OutputSink, PtyManager, RemoteCtl};
use crate::remote_proto as proto;
use crate::remote_store as store;

type Ws = WebSocketStream<MaybeTlsStream<tokio::net::TcpStream>>;

/// Errors surfaced to the UI are i18n keys (optionally `key: detail`).
const ERR_URL: &str = "remoteClient.err.url";
const ERR_CONNECT: &str = "remoteClient.err.connect";
const ERR_PROTOCOL: &str = "remoteClient.err.protocol";
const ERR_NOT_PAIRED: &str = "remoteClient.err.notPaired";
const ERR_PAIRING: &str = "remoteClient.err.pairing";
const ERR_REVOKED: &str = "remoteClient.err.revoked";

const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
const PING_EVERY: Duration = Duration::from_secs(15);
/// No frame at all for this long (pongs included) = the link is dead.
const DEAD_AFTER: Duration = Duration::from_secs(45);
const MAX_BACKOFF: Duration = Duration::from_secs(30);

#[derive(Clone, Debug, PartialEq)]
struct Target {
    ws_url: String,
    /// The http(s) base URL, without the pairing fragment.
    http_url: String,
    pair: Option<[u8; proto::KEY_LEN]>,
}

/// Accepts what the remote dialog shows: `http://192.168.1.10:4530/#p=…`,
/// `https://x.trycloudflare.com/`, or a bare `host:port`.
fn parse_target(input: &str) -> Result<Target, String> {
    let input = input.trim();
    if input.is_empty() {
        return Err(ERR_URL.into());
    }
    let with_scheme = if input.contains("://") {
        input.to_string()
    } else {
        format!("http://{input}")
    };
    let mut u = url::Url::parse(&with_scheme).map_err(|_| ERR_URL.to_string())?;
    let pair = match u.fragment() {
        Some(f) => f
            .split('&')
            .find_map(|kv| kv.strip_prefix("p="))
            .and_then(proto::unb64url)
            .and_then(|v| proto::to_array::<{ proto::KEY_LEN }>(&v)),
        None => None,
    };
    u.set_fragment(None);
    u.set_query(None);
    let ws_scheme = match u.scheme() {
        "http" | "ws" => "ws",
        "https" | "wss" => "wss",
        _ => return Err(ERR_URL.into()),
    };
    if u.host_str().is_none() {
        return Err(ERR_URL.into());
    }
    u.set_path("/");
    let http_scheme = if ws_scheme == "wss" { "https" } else { "http" };
    let mut http = u.clone();
    let _ = http.set_scheme(http_scheme);
    let mut ws = u;
    let _ = ws.set_scheme(ws_scheme);
    ws.set_path("/ws");
    Ok(Target {
        ws_url: ws.to_string(),
        http_url: http.to_string(),
        pair,
    })
}

struct Session {
    ws: Ws,
    tx: proto::Half,
    rx: proto::Half,
    server_name: String,
}

async fn next_json(ws: &mut Ws) -> Option<serde_json::Value> {
    loop {
        match ws.next().await? {
            Ok(Message::Text(t)) => return serde_json::from_str(t.as_str()).ok(),
            Ok(Message::Ping(_)) | Ok(Message::Pong(_)) => continue,
            _ => return None,
        }
    }
}

fn denied_reason(v: &serde_json::Value) -> Option<&str> {
    (v.get("t")?.as_str()? == "denied")
        .then(|| v.get("reason").and_then(|r| r.as_str()).unwrap_or(""))
}

/// Connect, pair if the target carries a pairing secret, then authenticate.
async fn open_session(target: &Target, device_name: &str) -> Result<Session, String> {
    let (mut ws, _) = tokio::time::timeout(CONNECT_TIMEOUT, connect_async(target.ws_url.as_str()))
        .await
        .map_err(|_| format!("{ERR_CONNECT}: timeout"))?
        .map_err(|e| format!("{ERR_CONNECT}: {e}"))?;

    let hello = next_json(&mut ws).await.ok_or(ERR_PROTOCOL)?;
    if hello.get("t").and_then(|t| t.as_str()) != Some("server") {
        return Err(ERR_PROTOCOL.into());
    }
    let server_id = hello
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or(ERR_PROTOCOL)?
        .to_string();
    let server_name = hello
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("Lume")
        .to_string();

    let known = store::peers()
        .into_iter()
        .find(|p| p.server_id == server_id);
    let peer = match (target.pair, known) {
        (Some(secret), _) => {
            let device_id = proto::new_device_id();
            let key = proto::random::<{ proto::KEY_LEN }>();
            ws.send(Message::Text(
                proto::pair_request(&secret, &device_id, &key, device_name).into(),
            ))
            .await
            .map_err(|e| format!("{ERR_CONNECT}: {e}"))?;
            let reply = next_json(&mut ws).await.ok_or(ERR_PROTOCOL)?;
            if denied_reason(&reply).is_some() {
                return Err(ERR_PAIRING.into());
            }
            if reply.get("t").and_then(|t| t.as_str()) != Some("paired") {
                return Err(ERR_PROTOCOL.into());
            }
            let peer = store::Peer {
                server_id: server_id.clone(),
                server_name: server_name.clone(),
                device_id,
                key: proto::b64(&key),
                url: target.http_url.clone(),
            };
            store::save_peer(peer.clone())?;
            peer
        }
        (None, Some(mut p)) => {
            // Remember the newest address/name of a known peer.
            if p.url != target.http_url || p.server_name != server_name {
                p.url = target.http_url.clone();
                p.server_name = server_name.clone();
                let _ = store::save_peer(p.clone());
            }
            p
        }
        (None, None) => return Err(ERR_NOT_PAIRED.into()),
    };

    let key = proto::unb64(&peer.key)
        .and_then(|k| proto::to_array::<{ proto::KEY_LEN }>(&k))
        .ok_or(ERR_PROTOCOL)?;
    let nc = proto::random::<{ proto::NONCE_LEN }>();
    let hello = serde_json::json!({ "t": "hello", "id": peer.device_id, "nc": proto::b64(&nc) });
    ws.send(Message::Text(hello.to_string().into()))
        .await
        .map_err(|e| format!("{ERR_CONNECT}: {e}"))?;
    let reply = next_json(&mut ws).await.ok_or(ERR_PROTOCOL)?;
    if let Some(reason) = denied_reason(&reply) {
        if reason == "unknown" {
            let _ = store::remove_peer(&server_id);
            return Err(ERR_REVOKED.into());
        }
        return Err(ERR_PROTOCOL.into());
    }
    let ns = reply
        .get("ns")
        .and_then(|v| v.as_str())
        .and_then(proto::unb64)
        .filter(|v| v.len() == proto::NONCE_LEN)
        .ok_or(ERR_PROTOCOL)?;
    let session = proto::session_key(&key, &nc, &ns);
    let mut tx = proto::Half::new(session, proto::CLIENT_TO_SERVER);
    let rx = proto::Half::new(session, proto::SERVER_TO_CLIENT);
    ws.send(Message::Binary(tx.seal(&proto::READY).into()))
        .await
        .map_err(|e| format!("{ERR_CONNECT}: {e}"))?;
    Ok(Session {
        ws,
        tx,
        rx,
        server_name,
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteConnectInfo {
    pub id: u64,
    pub server_name: String,
    /// The address without the pairing secret — what to persist.
    pub url: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RemoteTabsEvent {
    id: u64,
    server_name: String,
    items: serde_json::Value,
    active: serde_json::Value,
}

fn device_name() -> String {
    format!("Lume — {}", store::host_name())
}

#[tauri::command]
pub async fn remote_client_connect(
    app: AppHandle,
    pty: State<'_, Arc<PtyManager>>,
    url: String,
    rows: u16,
    cols: u16,
    on_output: Channel<InvokeResponseBody>,
) -> Result<RemoteConnectInfo, String> {
    let target = parse_target(&url)?;
    let session = open_session(&target, &device_name()).await?;
    let server_name = session.server_name.clone();
    let (ctl_tx, ctl_rx) = mpsc::unbounded_channel();
    let (id, sink) = pty.register_remote(ctl_tx, on_output);
    let manager = pty.inner().clone();
    // Reconnects reuse the stored pairing — never the one-time secret again.
    let target = Target {
        pair: None,
        ..target
    };
    let clean_url = target.http_url.clone();
    tauri::async_runtime::spawn(run(
        app,
        manager,
        id,
        sink,
        session,
        ctl_rx,
        target,
        (rows, cols),
    ));
    Ok(RemoteConnectInfo {
        id,
        server_name,
        url: clean_url,
    })
}

/// Show another terminal of the remote Lume in this pane.
#[tauri::command]
pub fn remote_client_switch(pty: State<'_, Arc<PtyManager>>, id: u64, target: u64) -> bool {
    let mut msg = vec![0x00u8, 0x03u8];
    msg.extend_from_slice(target.to_string().as_bytes());
    pty.write_bytes(id, &msg)
}

/// Ask the remote Lume for a new terminal (shown in this pane once ready).
#[tauri::command]
pub fn remote_client_new_tab(pty: State<'_, Arc<PtyManager>>, id: u64) -> bool {
    pty.write_bytes(id, &[0x00u8, 0x04u8])
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PeerInfo {
    pub server_id: String,
    pub server_name: String,
    pub url: String,
}

/// Lumes this one is paired with (for "reconnect to…").
#[tauri::command]
pub fn remote_client_peers() -> Vec<PeerInfo> {
    store::peers()
        .into_iter()
        .map(|p| PeerInfo {
            server_id: p.server_id,
            server_name: p.server_name,
            url: p.url,
        })
        .collect()
}

#[tauri::command]
pub fn remote_client_forget(server_id: String) -> Result<(), String> {
    store::remove_peer(&server_id)
}

enum Outcome {
    /// The pane was closed / killed: stop for good.
    Closed,
    /// The link dropped: try to reconnect.
    Lost,
}

fn sealed_resize(rows: u16, cols: u16) -> Vec<u8> {
    let mut m = vec![0x00u8, 0x01u8];
    m.extend_from_slice(format!("{cols}x{rows}").as_bytes());
    m
}

#[allow(clippy::too_many_arguments)]
async fn run(
    app: AppHandle,
    manager: Arc<PtyManager>,
    id: u64,
    sink: OutputSink,
    mut session: Session,
    mut ctl_rx: mpsc::UnboundedReceiver<RemoteCtl>,
    target: Target,
    mut size: (u16, u16),
) {
    let mut reset_on_first_tabs = false;
    loop {
        let outcome = pump(
            &app,
            id,
            &sink,
            &mut session,
            &mut ctl_rx,
            &mut size,
            reset_on_first_tabs,
        )
        .await;
        if matches!(outcome, Outcome::Closed) {
            break;
        }
        // The pane prints a (localized) status line for these.
        let _ = app.emit(
            "remote-client:status",
            serde_json::json!({ "id": id, "status": "lost" }),
        );
        let mut delay = Duration::from_secs(1);
        let reconnected = loop {
            tokio::select! {
                _ = tokio::time::sleep(delay) => {}
                c = ctl_rx.recv() => match c {
                    None | Some(RemoteCtl::Close) => break None,
                    Some(RemoteCtl::Resize(r, c)) => { size = (r, c); continue; }
                    Some(RemoteCtl::Input(_)) => continue, // typed while offline: dropped
                }
            }
            match open_session(&target, &device_name()).await {
                Ok(s) => break Some(s),
                Err(e) if e == ERR_REVOKED || e == ERR_NOT_PAIRED => {
                    let _ = app.emit(
                        "remote-client:status",
                        serde_json::json!({ "id": id, "status": "revoked" }),
                    );
                    break None;
                }
                Err(_) => delay = (delay * 2).min(MAX_BACKOFF),
            }
        };
        match reconnected {
            Some(s) => {
                let _ = app.emit(
                    "remote-client:status",
                    serde_json::json!({ "id": id, "status": "back" }),
                );
                session = s;
                // The server replays the screen: start from a clean one.
                reset_on_first_tabs = true;
            }
            None => break,
        }
    }
    if manager.remove(id) {
        let _ = app.emit("pty:exit", serde_json::json!({ "id": id }));
    }
}

async fn pump(
    app: &AppHandle,
    id: u64,
    sink: &OutputSink,
    s: &mut Session,
    ctl_rx: &mut mpsc::UnboundedReceiver<RemoteCtl>,
    size: &mut (u16, u16),
    mut reset_on_first_tabs: bool,
) -> Outcome {
    let resize = s.tx.seal(&sealed_resize(size.0, size.1));
    if s.ws.send(Message::Binary(resize.into())).await.is_err() {
        return Outcome::Lost;
    }
    let mut last_active: Option<serde_json::Value> = None;
    let mut last_rx = Instant::now();
    let mut ping = tokio::time::interval(PING_EVERY);
    ping.tick().await;
    loop {
        tokio::select! {
            msg = s.ws.next() => {
                let Some(Ok(msg)) = msg else { return Outcome::Lost };
                last_rx = Instant::now();
                let boxed = match msg {
                    Message::Binary(b) => b,
                    Message::Close(_) => return Outcome::Lost,
                    _ => continue,
                };
                let Some(plain) = s.rx.open(&boxed) else { return Outcome::Lost };
                match plain.first() {
                    Some(b'B') => {
                        if !sink.push(plain[1..].to_vec()) {
                            return Outcome::Closed;
                        }
                    }
                    Some(b'T') => {
                        let Ok(v) = serde_json::from_slice::<serde_json::Value>(&plain[1..]) else { continue };
                        if v.get("t").and_then(|t| t.as_str()) != Some("tabs") {
                            continue;
                        }
                        let active = v.get("active").cloned().unwrap_or(serde_json::Value::Null);
                        // Another remote terminal is coming (or the same one,
                        // replayed after a reconnect): reset the screen first.
                        if reset_on_first_tabs || last_active.as_ref().is_some_and(|a| *a != active) {
                            sink.push(b"\x1bc".to_vec());
                            reset_on_first_tabs = false;
                        }
                        last_active = Some(active.clone());
                        let _ = app.emit("remote-client:tabs", RemoteTabsEvent {
                            id,
                            server_name: s.server_name.clone(),
                            items: v.get("items").cloned().unwrap_or(serde_json::Value::Array(vec![])),
                            active,
                        });
                    }
                    _ => {}
                }
            }
            c = ctl_rx.recv() => {
                let frame = match c {
                    None | Some(RemoteCtl::Close) => {
                        let _ = s.ws.close(None).await;
                        return Outcome::Closed;
                    }
                    Some(RemoteCtl::Input(bytes)) => bytes,
                    Some(RemoteCtl::Resize(r, c)) => {
                        *size = (r, c);
                        sealed_resize(r, c)
                    }
                };
                let boxed = s.tx.seal(&frame);
                if s.ws.send(Message::Binary(boxed.into())).await.is_err() {
                    return Outcome::Lost;
                }
            }
            _ = ping.tick() => {
                if last_rx.elapsed() > DEAD_AFTER {
                    return Outcome::Lost;
                }
                if s.ws.send(Message::Ping(Vec::new().into())).await.is_err() {
                    return Outcome::Lost;
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_targets() {
        let secret = [7u8; 32];
        let t = parse_target(&format!(
            "http://192.168.1.10:4530/#p={}",
            proto::b64url(&secret)
        ))
        .unwrap();
        assert_eq!(t.ws_url, "ws://192.168.1.10:4530/ws");
        assert_eq!(t.http_url, "http://192.168.1.10:4530/");
        assert_eq!(t.pair, Some(secret));

        let t = parse_target("https://abc.trycloudflare.com/?x=1").unwrap();
        assert_eq!(t.ws_url, "wss://abc.trycloudflare.com/ws");
        assert_eq!(t.http_url, "https://abc.trycloudflare.com/");
        assert_eq!(t.pair, None);

        let t = parse_target("  10.0.0.2:4530 ").unwrap();
        assert_eq!(t.ws_url, "ws://10.0.0.2:4530/ws");

        assert!(parse_target("").is_err());
        assert!(parse_target("ftp://x/").is_err());
        // A malformed secret is ignored (treated as "already paired").
        assert_eq!(parse_target("http://h:1/#p=short").unwrap().pair, None);
    }

    /// One serial test: it points LUME_CONFIG_DIR at a temp dir for the
    /// stores, which is process-global.
    #[test]
    fn pairs_authenticates_and_revokes_end_to_end() {
        let cfg = std::env::temp_dir().join(format!("lume_remote_e2e_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&cfg);
        // LUME_CONFIG_DIR, not XDG_CONFIG_HOME: Windows ignores the latter and
        // the test would write into the developer's real remote stores.
        std::env::set_var("LUME_CONFIG_DIR", &cfg);

        tauri::async_runtime::block_on(async {
            let srv = crate::remote::TestServer::start();
            srv.tabs_tx.send_replace(vec![crate::remote::TabInfo {
                id: 42,
                title: "shell".into(),
            }]);
            let base = format!("http://127.0.0.1:{}/", srv.port);
            let pair_url = format!("{base}#p={}", proto::b64url(&srv.secret));

            // Unknown device, no pairing secret → refused.
            let err = open_session(&parse_target(&base).unwrap(), "t")
                .await
                .err()
                .unwrap();
            assert_eq!(err, ERR_NOT_PAIRED);

            // Pair, then the channel works: first sealed frame is the tab list.
            let mut s = open_session(&parse_target(&pair_url).unwrap(), "laptop")
                .await
                .unwrap();
            assert_eq!(s.server_name, "test-host");
            let first = loop {
                match s.ws.next().await.unwrap().unwrap() {
                    Message::Binary(b) => break s.rx.open(&b).expect("server frame opens"),
                    _ => continue,
                }
            };
            assert_eq!(first[0], b'T');
            let v: serde_json::Value = serde_json::from_slice(&first[1..]).unwrap();
            assert_eq!(v["t"], "tabs");
            assert_eq!(v["items"][0]["id"], 42);
            assert!(srv
                .events
                .lock()
                .iter()
                .any(|(e, v)| e == "remote:paired" && v["name"] == "laptop"));

            // New-tab request reaches the desktop, tagged with the connection.
            let nt = s.tx.seal(&[0x00, 0x04]);
            s.ws.send(Message::Binary(nt.into())).await.unwrap();
            for _ in 0..50 {
                if srv.events.lock().iter().any(|(e, _)| e == "remote:new-tab") {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
            assert!(srv
                .events
                .lock()
                .iter()
                .any(|(e, v)| e == "remote:new-tab" && v["conn"].is_u64()));

            // The pairing code is single-use.
            let err = open_session(&parse_target(&pair_url).unwrap(), "x")
                .await
                .err()
                .unwrap();
            assert_eq!(err, ERR_PAIRING);

            // Known peer: reconnects with no secret (any address of that server).
            let mut s2 = open_session(
                &parse_target(&format!("localhost:{}", srv.port)).unwrap(),
                "x",
            )
            .await
            .unwrap();
            assert!(store::peers()[0].url.contains("localhost"));

            // A forged frame kills the connection.
            s2.ws
                .send(Message::Binary(vec![0u8; 40].into()))
                .await
                .unwrap();
            let closed = tokio::time::timeout(Duration::from_secs(3), async {
                loop {
                    match s2.ws.next().await {
                        None | Some(Err(_)) | Some(Ok(Message::Close(_))) => break,
                        _ => continue,
                    }
                }
            })
            .await;
            assert!(
                closed.is_ok(),
                "server must drop a connection sending garbage"
            );

            // Revocation: live connection is cut, and the next hello is denied.
            let device = store::devices()[0].id.clone();
            srv.kill_device(&device);
            store::remove_device(&device).unwrap();
            let cut = tokio::time::timeout(Duration::from_secs(3), async {
                loop {
                    match s.ws.next().await {
                        None | Some(Err(_)) | Some(Ok(Message::Close(_))) => break,
                        _ => continue,
                    }
                }
            })
            .await;
            assert!(cut.is_ok(), "revoked device must be disconnected");
            let err = open_session(&parse_target(&base).unwrap(), "x")
                .await
                .err()
                .unwrap();
            assert_eq!(err, ERR_REVOKED);
            assert!(store::peers().is_empty(), "a revoked peer is forgotten");
        });
        let _ = std::fs::remove_dir_all(&cfg);
    }
}
