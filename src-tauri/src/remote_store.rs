//! Persistent remote-control identities, under `<config>/remote/` (0600):
//!  - `server.json`  — this Lume's stable id, so paired clients recognise it
//!    even when its address changes (new tunnel URL, new LAN IP);
//!  - `devices.json` — devices allowed to drive this Lume (server side);
//!  - `peers.json`   — other Lumes this one has paired with (client side).
//!
//! Keys are stored like ssh keys: plaintext, owner-only file.

use std::path::PathBuf;
use std::sync::OnceLock;

use parking_lot::Mutex;
use serde::{de::DeserializeOwned, Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Device {
    pub id: String,
    pub name: String,
    /// Base64 device key.
    pub key: String,
    /// ms since the epoch.
    pub created: i64,
    #[serde(default)]
    pub last_seen: Option<i64>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Peer {
    pub server_id: String,
    pub server_name: String,
    pub device_id: String,
    /// Base64 device key.
    pub key: String,
    /// Last URL used (fragment stripped).
    pub url: String,
}

#[derive(Serialize, Deserialize)]
struct ServerIdentity {
    id: String,
}

fn lock() -> &'static Mutex<()> {
    static L: OnceLock<Mutex<()>> = OnceLock::new();
    L.get_or_init(|| Mutex::new(()))
}

fn dir() -> Option<PathBuf> {
    crate::paths::config_dir().map(|d| d.join("remote"))
}

fn read_json<T: DeserializeOwned + Default>(name: &str) -> T {
    dir()
        .and_then(|d| std::fs::read_to_string(d.join(name)).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_json<T: Serialize>(name: &str, value: &T) -> Result<(), String> {
    let d = dir().ok_or("no config directory")?;
    std::fs::create_dir_all(&d).map_err(|e| e.to_string())?;
    let body = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    crate::config::write_atomic(&d.join(name), &body).map_err(|e| e.to_string())
}

pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// This Lume's stable server id (created on first use).
pub fn server_id() -> String {
    let _g = lock().lock();
    let existing: Option<ServerIdentity> = dir()
        .and_then(|d| std::fs::read_to_string(d.join("server.json")).ok())
        .and_then(|s| serde_json::from_str(&s).ok());
    if let Some(s) = existing {
        return s.id;
    }
    let id = crate::remote_proto::new_device_id();
    let _ = write_json("server.json", &ServerIdentity { id: id.clone() });
    id
}

/// Human name of this machine, shown to clients during pairing.
pub fn host_name() -> String {
    let from_env = std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("COMPUTERNAME"))
        .ok()
        .filter(|s| !s.trim().is_empty());
    if let Some(h) = from_env {
        return h.trim().to_string();
    }
    #[cfg(unix)]
    {
        if let Ok(h) = std::fs::read_to_string("/etc/hostname") {
            if !h.trim().is_empty() {
                return h.trim().to_string();
            }
        }
        if let Ok(out) = std::process::Command::new("hostname").output() {
            let h = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !h.is_empty() {
                return h;
            }
        }
    }
    "Lume".to_string()
}

pub fn devices() -> Vec<Device> {
    let _g = lock().lock();
    read_json("devices.json")
}

pub fn find_device(id: &str) -> Option<Device> {
    devices().into_iter().find(|d| d.id == id)
}

pub fn add_device(device: Device) -> Result<(), String> {
    let _g = lock().lock();
    let mut all: Vec<Device> = read_json("devices.json");
    all.retain(|d| d.id != device.id);
    all.push(device);
    write_json("devices.json", &all)
}

pub fn remove_device(id: &str) -> Result<(), String> {
    let _g = lock().lock();
    let mut all: Vec<Device> = read_json("devices.json");
    all.retain(|d| d.id != id);
    write_json("devices.json", &all)
}

pub fn touch_device(id: &str) {
    let _g = lock().lock();
    let mut all: Vec<Device> = read_json("devices.json");
    if let Some(d) = all.iter_mut().find(|d| d.id == id) {
        d.last_seen = Some(now_ms());
        let _ = write_json("devices.json", &all);
    }
}

pub fn peers() -> Vec<Peer> {
    let _g = lock().lock();
    read_json("peers.json")
}

pub fn save_peer(peer: Peer) -> Result<(), String> {
    let _g = lock().lock();
    let mut all: Vec<Peer> = read_json("peers.json");
    all.retain(|p| p.server_id != peer.server_id);
    all.push(peer);
    write_json("peers.json", &all)
}

pub fn remove_peer(server_id: &str) -> Result<(), String> {
    let _g = lock().lock();
    let mut all: Vec<Peer> = read_json("peers.json");
    all.retain(|p| p.server_id != server_id);
    write_json("peers.json", &all)
}
