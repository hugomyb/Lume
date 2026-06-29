import { invoke } from "@tauri-apps/api/core";

export type RemoteInfo = {
  running: boolean;
  port: number;
  token: string;
  ip: string;
  /** LAN URL (same network). */
  url: string;
  /** Public cross-network URL via cloudflared, once it's up. */
  publicUrl: string | null;
  tunnelRequested: boolean;
  /** Whether `cloudflared` is installed. */
  tunnelAvailable: boolean;
  /** Number of remote clients currently connected. */
  clients: number;
};

export const remoteStart = (port: number, tunnel: boolean) =>
  invoke<RemoteInfo>("remote_start", { port, tunnel });

export const remoteStop = () => invoke<RemoteInfo>("remote_stop");

export const remoteStatus = () => invoke<RemoteInfo>("remote_status");

/** Point remote clients at the active pane's pty (null = none). */
export const remoteSetTarget = (ptyId: number | null) =>
  invoke("remote_set_target", { ptyId });

/** A terminal the phone can switch to (a tab's active pane). */
export type RemoteTab = { id: number; title: string };

/** Publish the list of tabs the phone can switch between. */
export const remoteSetTabs = (tabs: RemoteTab[]) =>
  invoke("remote_set_tabs", { tabs });

/** Download + install cloudflared (for cross-network tunnels). */
export const remoteInstallCloudflared = () =>
  invoke<void>("remote_install_cloudflared");
