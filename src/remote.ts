import { invoke } from "@tauri-apps/api/core";

export type RemoteDevice = {
  id: string;
  name: string;
  created: number;
  lastSeen: number | null;
  /** Live connections of this device right now. */
  connections: number;
};

export type RemoteInfo = {
  running: boolean;
  port: number;
  ip: string;
  /** LAN URL (same network), without pairing secret. */
  url: string;
  /** LAN URL carrying the one-time pairing secret (QR code), while open. */
  pairUrl: string | null;
  /** Public cross-network URL via cloudflared, once it's up. */
  publicUrl: string | null;
  publicPairUrl: string | null;
  /** Seconds left on the current pairing code (null = none open). */
  pairingExpiresIn: number | null;
  tunnelRequested: boolean;
  /** Whether `cloudflared` is installed. */
  tunnelAvailable: boolean;
  /** Number of remote clients currently connected. */
  clients: number;
  devices: RemoteDevice[];
  serverName: string;
};

export const remoteStart = (port: number, tunnel: boolean) =>
  invoke<RemoteInfo>("remote_start", { port, tunnel });

export const remoteStop = () => invoke<RemoteInfo>("remote_stop");

export const remoteStatus = () => invoke<RemoteInfo>("remote_status");

/** Open a fresh pairing QR code (to add another device). */
export const remoteNewPairing = () => invoke<RemoteInfo>("remote_new_pairing");

/** Forget a paired device and cut its live connections. */
export const remoteRevokeDevice = (id: string) =>
  invoke<RemoteInfo>("remote_revoke_device", { id });

/** Point remote clients at a pty: one connection (`conn`) or the default for
 *  new connections. */
export const remoteSetTarget = (ptyId: number | null, conn: number | null = null) =>
  invoke("remote_set_target", { ptyId, conn });

/** A terminal remote clients can switch to (one pane). */
export type RemoteTab = { id: number; title: string };

/** Publish the list of panes remote clients can switch between. */
export const remoteSetTabs = (tabs: RemoteTab[]) =>
  invoke("remote_set_tabs", { tabs });

/** Download + install cloudflared (for cross-network tunnels). */
export const remoteInstallCloudflared = () =>
  invoke<void>("remote_install_cloudflared");

// --- Lume ↔ Lume (client side) ---

export type RemotePeer = { serverId: string; serverName: string; url: string };

export const remoteClientPeers = () => invoke<RemotePeer[]>("remote_client_peers");

export const remoteClientForget = (serverId: string) =>
  invoke<void>("remote_client_forget", { serverId });

/** Show another terminal of the remote Lume in pane session `id`. */
export const remoteClientSwitch = (id: number, target: number) =>
  invoke<boolean>("remote_client_switch", { id, target });

export const remoteClientNewTab = (id: number) =>
  invoke<boolean>("remote_client_new_tab", { id });

/** `remote-client:tabs` event: the terminals offered by a remote Lume. */
export type RemoteClientTabs = {
  id: number;
  serverName: string;
  items: RemoteTab[];
  active: number | null;
};
