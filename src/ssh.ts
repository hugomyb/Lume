import { invoke } from "@tauri-apps/api/core";

export type SshHost = {
  name: string;
  hostName?: string | null;
  user?: string | null;
  port?: string | null;
  proxyJump?: string | null;
};

export function listSshHosts(): Promise<SshHost[]> {
  return invoke<SshHost[]>("list_ssh_hosts");
}

export function sshTools(): Promise<{ mosh: boolean }> {
  return invoke<{ mosh: boolean }>("ssh_tools");
}

/** Human-readable target line, e.g. `deploy@10.0.0.1:2222`. */
export function hostTarget(h: SshHost): string {
  const base = h.hostName ?? h.name;
  const withUser = h.user ? `${h.user}@${base}` : base;
  return h.port ? `${withUser}:${h.port}` : withUser;
}

/** How to open a session on a host. `tmux` re-attaches a persistent remote
 *  session (`lume`) that survives disconnections; `mosh` survives network
 *  changes and sleep (when installed on both ends). */
export type SshPrefs = { tmux?: boolean; mosh?: boolean };

const POSIX_SAFE = /^[A-Za-z0-9_@%+=:,./-]+$/;
const quote = (s: string) =>
  POSIX_SAFE.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;

/** The shell command that connects to a host alias (or a raw target). ssh
 *  resolves HostName/User/Port/ProxyJump… from ~/.ssh/config given the alias. */
export function sshCommand(
  target: string,
  prefs: SshPrefs = {},
  tmuxSession = "lume"
): string {
  const t = quote(target);
  // ssh joins its arguments with spaces and the REMOTE shell re-splits them:
  // keep the session name to characters that need no quoting at all.
  const session = tmuxSession.replace(/[^A-Za-z0-9_.-]/g, "") || "lume";
  const tmux = `tmux new -A -s ${session}`;
  if (prefs.mosh) return prefs.tmux ? `mosh ${t} -- ${tmux}` : `mosh ${t}`;
  return prefs.tmux ? `ssh -t ${t} ${tmux}` : `ssh ${t}`;
}

/** Does this command line open a remote session (ssh / mosh)? */
export function isRemoteSessionCommand(cmd: string | null | undefined): boolean {
  return /^\s*(?:ssh|mosh|autossh)\s/.test(cmd ?? "");
}

// --- Per-viewer conveniences: favorites, recents, per-host prefs ---

const FAV_KEY = "lume.ssh.favorites";
const RECENT_KEY = "lume.ssh.recent";
const PREFS_KEY = "lume.ssh.prefs";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function sshFavorites(): string[] {
  return readJson<string[]>(FAV_KEY, []);
}
export function toggleSshFavorite(name: string): string[] {
  const cur = sshFavorites();
  const next = cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name];
  writeJson(FAV_KEY, next);
  return next;
}

/** Most recent first, capped. */
export function sshRecents(): string[] {
  return readJson<string[]>(RECENT_KEY, []);
}
export function pushSshRecent(name: string) {
  writeJson(RECENT_KEY, [name, ...sshRecents().filter((n) => n !== name)].slice(0, 8));
}

export function sshPrefs(): Record<string, SshPrefs> {
  return readJson<Record<string, SshPrefs>>(PREFS_KEY, {});
}
export function setSshPrefs(name: string, prefs: SshPrefs): Record<string, SshPrefs> {
  const all = sshPrefs();
  all[name] = prefs;
  writeJson(PREFS_KEY, all);
  return all;
}
