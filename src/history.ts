import { invoke } from "@tauri-apps/api/core";

/** One run of a command, with the context it ran in (history.jsonl). */
export type HistoryEntry = {
  cmd: string;
  cwd?: string | null;
  exit?: number | null;
  /** Start time, ms since the epoch. */
  ts: number;
  /** Duration, ms. */
  dur?: number | null;
  branch?: string | null;
};

/** A deduplicated search result: the newest matching run + how many runs. */
export type HistoryHit = HistoryEntry & { count: number };

export function historyAppend(entry: HistoryEntry): Promise<void> {
  return invoke("history_append", { entry });
}

/** Free text + filters: `failed`, `ok`, `here`, `cwd:…`/`project:…`,
 *  `branch:…`. `cwd` is the active pane's directory (for `here`). */
export function historySearch(
  query: string,
  cwd: string | null,
  limit = 200
): Promise<HistoryHit[]> {
  return invoke<HistoryHit[]>("history_search", { query, cwd, limit });
}

export function historyClear(): Promise<void> {
  return invoke("history_clear");
}

export type GitInfo = { branch: string; detached: boolean };

/** Current git branch of a directory (null outside a repo). Reads .git/HEAD —
 *  no git process. */
export function gitInfo(cwd: string): Promise<GitInfo | null> {
  return invoke<GitInfo | null>("git_info", { cwd });
}

/** "2 min", "3 h", "yesterday"… — compact relative time for list rows. */
export function relativeTime(
  ts: number,
  tr: (k: string, p?: Record<string, string | number>) => string,
  now = Date.now()
): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return tr("time.justNow");
  const m = Math.round(s / 60);
  if (m < 60) return tr("time.minutes", { n: m });
  const h = Math.round(m / 60);
  if (h < 24) return tr("time.hours", { n: h });
  const d = Math.round(h / 24);
  if (d === 1) return tr("time.yesterday");
  if (d < 30) return tr("time.days", { n: d });
  return new Date(ts).toLocaleDateString();
}

/** "850 ms", "12 s", "3 min 4 s". */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m} min ${r} s` : `${m} min`;
}

/** `path` relative to `home` ("" = home itself), or null when outside it.
 *  Windows-safe: OSC 7 reports `C:/Users/me/…` while the home dir API says
 *  `C:\Users\me`, and Windows paths ignore case. */
export function homeRelative(path: string, home: string): string | null {
  if (!home) return null;
  const win = /^[a-zA-Z]:[\\/]/.test(home);
  const norm = (p: string) => {
    const n = p.replace(/\\/g, "/").replace(/\/+$/, "");
    return win ? n.toLowerCase() : n;
  };
  const p = norm(path);
  const h = norm(home);
  if (p === h) return "";
  if (p.startsWith(h + "/")) return path.replace(/\\/g, "/").replace(/\/+$/, "").slice(h.length + 1);
  return null;
}
