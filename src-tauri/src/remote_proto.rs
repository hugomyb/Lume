//! Remote-control wire protocol (v2): end-to-end encryption between a paired
//! device and this Lume, so neither the LAN (plain `http://`) nor the tunnel
//! provider (cloudflared terminates TLS) ever sees terminal traffic.
//!
//! Handshake, all JSON text frames:
//!  1. server → `{"t":"server","v":2,"id":<server id>,"name":<host name>}`
//!  2. optional pairing: client → `{"t":"pair","n":<nonce>,"box":<sealed>}`,
//!     sealed with the one-time pairing secret carried in the QR code's URL
//!     *fragment* (never sent over the network). The payload registers the
//!     device: `{"id","key","name"}`. Server → `{"t":"paired"}`.
//!  3. client → `{"t":"hello","id":<device id>,"nc":<24 random bytes>}`;
//!     server → `{"t":"challenge","ns":<24 random bytes>}` (or `denied`).
//!  4. Both derive `session = SHA-512(device key ‖ nc ‖ ns)[..32]`; from here
//!     every frame is a binary NaCl secretbox (XSalsa20-Poly1305, the format
//!     tweetnacl produces) under that key, with implicit per-direction counter
//!     nonces. The client's first sealed frame is `[0, 5]` ("ready") — the
//!     server only starts streaming once it opens, which proves the device
//!     holds its key.
//!
//! Inside the channel, server → client frames are `b'T' + JSON` (control) or
//! `b'B' + bytes` (terminal output); client → server frames are raw input with
//! the historical in-band sentinels (resize, completion, tab switch, new tab).

use base64::{
    engine::general_purpose::{STANDARD as B64, URL_SAFE_NO_PAD as B64URL},
    Engine as _,
};
use crypto_secretbox::{
    aead::{Aead, KeyInit},
    Key, Nonce, XSalsa20Poly1305,
};
use sha2::{Digest, Sha512};

pub const KEY_LEN: usize = 32;
pub const NONCE_LEN: usize = 24;

/// Direction byte mixed into the counter nonces, so the two directions never
/// reuse a nonce under the shared session key.
pub const CLIENT_TO_SERVER: u8 = 0;
pub const SERVER_TO_CLIENT: u8 = 1;

/// Client's first sealed frame.
pub const READY: [u8; 2] = [0x00, 0x05];

pub fn random<const N: usize>() -> [u8; N] {
    let mut buf = [0u8; N];
    getrandom::fill(&mut buf).expect("getrandom");
    buf
}

pub fn seal(key: &[u8; KEY_LEN], nonce: &[u8; NONCE_LEN], msg: &[u8]) -> Vec<u8> {
    XSalsa20Poly1305::new(Key::from_slice(key))
        .encrypt(Nonce::from_slice(nonce), msg)
        .expect("secretbox encrypt")
}

pub fn open(key: &[u8; KEY_LEN], nonce: &[u8; NONCE_LEN], boxed: &[u8]) -> Option<Vec<u8>> {
    XSalsa20Poly1305::new(Key::from_slice(key))
        .decrypt(Nonce::from_slice(nonce), boxed)
        .ok()
}

pub fn session_key(device_key: &[u8; KEY_LEN], nc: &[u8], ns: &[u8]) -> [u8; KEY_LEN] {
    let mut h = Sha512::new();
    h.update(device_key);
    h.update(nc);
    h.update(ns);
    let digest = h.finalize();
    let mut out = [0u8; KEY_LEN];
    out.copy_from_slice(&digest[..KEY_LEN]);
    out
}

fn counter_nonce(dir: u8, ctr: u64) -> [u8; NONCE_LEN] {
    let mut n = [0u8; NONCE_LEN];
    n[0] = dir;
    n[16..].copy_from_slice(&ctr.to_be_bytes());
    n
}

/// One direction of an established channel. Frames must be opened in the
/// order they were sealed — WebSocket guarantees it — and a replayed,
/// dropped or reordered frame fails to open.
pub struct Half {
    key: [u8; KEY_LEN],
    dir: u8,
    ctr: u64,
}

impl Half {
    pub fn new(key: [u8; KEY_LEN], dir: u8) -> Self {
        Self { key, dir, ctr: 0 }
    }

    pub fn seal(&mut self, msg: &[u8]) -> Vec<u8> {
        let out = seal(&self.key, &counter_nonce(self.dir, self.ctr), msg);
        self.ctr += 1;
        out
    }

    pub fn open(&mut self, boxed: &[u8]) -> Option<Vec<u8>> {
        let out = open(&self.key, &counter_nonce(self.dir, self.ctr), boxed)?;
        self.ctr += 1;
        Some(out)
    }
}

pub fn b64(bytes: &[u8]) -> String {
    B64.encode(bytes)
}

pub fn unb64(s: &str) -> Option<Vec<u8>> {
    B64.decode(s.as_bytes()).ok()
}

pub fn b64url(bytes: &[u8]) -> String {
    B64URL.encode(bytes)
}

pub fn unb64url(s: &str) -> Option<Vec<u8>> {
    B64URL.decode(s.trim_end_matches('=').as_bytes()).ok()
}

pub fn to_array<const N: usize>(v: &[u8]) -> Option<[u8; N]> {
    v.try_into().ok()
}

/// Sealed pairing request (client side): registers `device_id`/`device_key`
/// under the pairing secret. Returns the JSON text frame.
pub fn pair_request(
    secret: &[u8; KEY_LEN],
    device_id: &str,
    device_key: &[u8; KEY_LEN],
    name: &str,
) -> String {
    let nonce = random::<NONCE_LEN>();
    let payload = serde_json::json!({ "id": device_id, "key": b64(device_key), "name": name });
    let boxed = seal(secret, &nonce, payload.to_string().as_bytes());
    serde_json::json!({ "t": "pair", "n": b64(&nonce), "box": b64(&boxed) }).to_string()
}

/// Decoded pairing payload (server side).
pub struct PairPayload {
    pub id: String,
    pub key: [u8; KEY_LEN],
    pub name: String,
}

pub fn open_pair_request(secret: &[u8; KEY_LEN], msg: &serde_json::Value) -> Option<PairPayload> {
    let nonce = to_array::<NONCE_LEN>(&unb64(msg.get("n")?.as_str()?)?)?;
    let boxed = unb64(msg.get("box")?.as_str()?)?;
    let plain = open(secret, &nonce, &boxed)?;
    let v: serde_json::Value = serde_json::from_slice(&plain).ok()?;
    let id = v.get("id")?.as_str()?.trim().to_string();
    let key = to_array::<KEY_LEN>(&unb64(v.get("key")?.as_str()?)?)?;
    let name: String = v
        .get("name")
        .and_then(|n| n.as_str())
        .unwrap_or("")
        .chars()
        .filter(|c| !c.is_control())
        .take(60)
        .collect();
    if id.is_empty() || id.len() > 64 || !id.bytes().all(|b| b.is_ascii_alphanumeric()) {
        return None;
    }
    Some(PairPayload { id, key, name })
}

/// Random device id (hex) for a new pairing.
pub fn new_device_id() -> String {
    random::<12>().iter().map(|b| format!("{b:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Same inputs as tweetnacl:
    /// `nacl.secretbox("hello lume", nonce=[100..124), key=[0..32))`.
    #[test]
    fn secretbox_matches_tweetnacl() {
        let key: [u8; 32] = core::array::from_fn(|i| i as u8);
        let nonce: [u8; 24] = core::array::from_fn(|i| 100 + i as u8);
        let boxed = seal(&key, &nonce, b"hello lume");
        let hex: String = boxed.iter().map(|b| format!("{b:02x}")).collect();
        assert_eq!(hex, "2e1e9005f3cb184279966922cdbfbce26adcf5a55596a29cdd98");
        assert_eq!(open(&key, &nonce, &boxed).unwrap(), b"hello lume");
    }

    #[test]
    fn sha512_matches_tweetnacl_hash() {
        let d = Sha512::digest(b"abc");
        let hex: String = d[..16].iter().map(|b| format!("{b:02x}")).collect();
        assert_eq!(hex, "ddaf35a193617abacc417349ae204131");
    }

    #[test]
    fn channel_halves_roundtrip_and_reject_replay() {
        let k = random::<32>();
        let mut tx = Half::new(k, CLIENT_TO_SERVER);
        let mut rx = Half::new(k, CLIENT_TO_SERVER);
        let a = tx.seal(b"one");
        let b = tx.seal(b"two");
        assert_eq!(rx.open(&a).unwrap(), b"one");
        // Replaying frame `a` at position 2 fails (wrong counter nonce).
        let mut rx2 = Half::new(k, CLIENT_TO_SERVER);
        rx2.open(&a).unwrap();
        assert!(rx2.open(&a).is_none());
        assert_eq!(rx.open(&b).unwrap(), b"two");
        // The other direction can't open client frames.
        let mut wrong = Half::new(k, SERVER_TO_CLIENT);
        assert!(wrong.open(&tx.seal(b"x")).is_none());
    }

    #[test]
    fn pairing_roundtrip_and_tamper() {
        let secret = random::<32>();
        let dk = random::<32>();
        let req = pair_request(&secret, "abc123", &dk, "Pixel\u{7}");
        let v: serde_json::Value = serde_json::from_str(&req).unwrap();
        let p = open_pair_request(&secret, &v).unwrap();
        assert_eq!(p.id, "abc123");
        assert_eq!(p.key, dk);
        assert_eq!(p.name, "Pixel");
        assert!(open_pair_request(&random::<32>(), &v).is_none());
        // Ids are restricted to alphanumerics.
        let bad = pair_request(&secret, "../x", &dk, "n");
        assert!(open_pair_request(&secret, &serde_json::from_str(&bad).unwrap()).is_none());
    }

    #[test]
    fn session_keys_differ_per_nonce() {
        let k = random::<32>();
        assert_ne!(
            session_key(&k, &[1; 24], &[2; 24]),
            session_key(&k, &[1; 24], &[3; 24])
        );
        assert_eq!(
            session_key(&k, &[1; 24], &[2; 24]),
            session_key(&k, &[1; 24], &[2; 24])
        );
    }

    #[test]
    fn b64url_roundtrip() {
        let s = random::<32>();
        assert_eq!(unb64url(&b64url(&s)).unwrap(), s);
    }
}
