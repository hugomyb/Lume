import { invoke } from "@tauri-apps/api/core";

/** A single inline-completion candidate. `value` is the *full* command line the
 *  accept would produce — it must always start with the current input, so
 *  accepting just appends `value.slice(input.length)` to the PTY (fish-style
 *  suffix completion). This keeps accept robust: we never clear or reflow the
 *  shell's line editor. */
export type SuggestionKind = "history" | "path" | "command" | "alias";

export type Suggestion = {
  value: string;
  display: string;
  hint: string;
  kind: SuggestionKind;
};

// ---------------------------------------------------------------------------
// Command history — a frecency-ranked store persisted to localStorage. Shared
// across every pane/tab so a command run anywhere can be re-suggested.
// ---------------------------------------------------------------------------

type HistEntry = { count: number; last: number };

const STORE_KEY = "lume.cmdHistory";
const MAX_HIST = 1000;

let store: Map<string, HistEntry> | null = null;

function load(): Map<string, HistEntry> {
  if (store) return store;
  store = new Map();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, HistEntry>;
      for (const [cmd, e] of Object.entries(obj)) {
        if (e && typeof e.count === "number" && typeof e.last === "number") {
          store.set(cmd, e);
        }
      }
    }
  } catch {
    // Corrupt store — start fresh.
  }
  return store;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function persist() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (!store) return;
    let entries = [...store.entries()];
    if (entries.length > MAX_HIST) {
      // Evict the least-recently-used overflow.
      entries.sort((a, b) => b[1].last - a[1].last);
      entries = entries.slice(0, MAX_HIST);
      store = new Map(entries);
    }
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(store)));
    } catch {
      // Quota or serialization error — drop this save, retry next time.
    }
  }, 500);
}

/** Record an executed command. Called once per command from the block stream. */
export function recordCommand(cmd: string) {
  const c = cmd.trim();
  if (!c || c.length > 500) return;
  const s = load();
  const now = Date.now();
  const e = s.get(c);
  if (e) {
    e.count += 1;
    e.last = now;
  } else {
    s.set(c, { count: 1, last: now });
  }
  persist();
}

function frecency(e: HistEntry, now: number): number {
  const day = 86_400_000;
  const age = now - e.last;
  let recency: number;
  if (age < day) recency = 4;
  else if (age < 7 * day) recency = 2;
  else if (age < 30 * day) recency = 1;
  else recency = 0.5;
  return e.count * recency;
}

/** Past commands that start with `input`, ranked by frecency. */
export function historySuggestions(input: string, limit = 6): Suggestion[] {
  const s = load();
  const now = Date.now();
  const matches: { cmd: string; score: number }[] = [];
  for (const [cmd, e] of s) {
    if (cmd === input || !cmd.startsWith(input)) continue;
    matches.push({ cmd, score: frecency(e, now) });
  }
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit).map((m) => ({
    value: m.cmd,
    display: m.cmd,
    hint: "history",
    kind: "history" as const,
  }));
}

// ---------------------------------------------------------------------------
// Built-in command names — completes the first token so suggestions feel alive
// before any history has accumulated.
// ---------------------------------------------------------------------------

const COMMON_COMMANDS = [
  "cd", "ls", "ll", "cat", "less", "tail", "head", "grep", "rg", "fd", "find",
  "git", "npm", "pnpm", "yarn", "bun", "npx", "cargo", "rustup", "go",
  "docker", "docker-compose", "kubectl", "helm", "terraform",
  "python", "python3", "pip", "pip3", "node", "deno",
  "make", "cmake", "curl", "wget", "ssh", "scp", "rsync", "tar", "zip", "unzip",
  "sed", "awk", "jq", "xargs", "echo", "printf", "export", "source", "alias",
  "mkdir", "rmdir", "rm", "cp", "mv", "ln", "touch", "chmod", "chown", "ps",
  "kill", "pkill", "top", "htop", "df", "du", "free", "systemctl", "journalctl",
  "vim", "nvim", "nano", "code", "tmux", "man", "which", "whereis", "sudo",
  "apt", "apt-get", "dnf", "pacman", "brew", "snap", "flatpak",
];

/** Common command names starting with `token` (first-token completion only). */
export function commandSuggestions(token: string, limit = 4): Suggestion[] {
  if (!token) return [];
  return COMMON_COMMANDS.filter((c) => c.startsWith(token) && c !== token)
    .slice(0, limit)
    .map((c) => ({ value: c, display: c, hint: "cmd", kind: "command" as const }));
}

// ---------------------------------------------------------------------------
// Shell aliases — pushed from the shell init script via OSC 7733 at startup.
// Same set for every pane of a given user, so we keep one global list.
// ---------------------------------------------------------------------------

export type AliasItem = { name: string; value: string };

let aliasStore: AliasItem[] = [];

export function recordAliases(items: AliasItem[]) {
  aliasStore = items;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/** Aliases whose name starts with `token` (first-token completion only). The
 *  hint shows the expansion so the user knows what the alias runs. */
export function aliasSuggestions(token: string, limit = 6): Suggestion[] {
  if (!token) return [];
  return aliasStore
    .filter((a) => a.name.startsWith(token) && a.name !== token)
    .slice(0, limit)
    .map((a) => ({
      value: a.name,
      display: a.name,
      hint: a.value ? truncate(a.value, 36) : "alias",
      kind: "alias" as const,
    }));
}

// ---------------------------------------------------------------------------
// Filesystem path completion (delegated to Rust).
// ---------------------------------------------------------------------------

type FsEntry = { name: string; isDir: boolean };

function fsComplete(cwd: string, token: string): Promise<FsEntry[]> {
  return invoke<FsEntry[]>("fs_complete", { cwd, token });
}

/** Complete the path-like token under the cursor against the filesystem. The
 *  first token is only completed when it already looks like a path (so plain
 *  command names don't get shadowed by same-named files in the cwd). */
export async function pathSuggestions(
  input: string,
  cwd: string,
  limit = 6
): Promise<Suggestion[]> {
  if (!cwd) return [];
  const token = input.match(/(\S*)$/)?.[1] ?? "";
  const prefix = input.slice(0, input.length - token.length);
  const isFirstToken = prefix.trim() === "";
  const looksLikePath =
    token.startsWith("./") ||
    token.startsWith("../") ||
    token.startsWith("/") ||
    token.startsWith("~") ||
    token.includes("/");
  if (isFirstToken && !looksLikePath) return [];

  let entries: FsEntry[];
  try {
    entries = await fsComplete(cwd, token);
  } catch {
    return [];
  }

  const slash = token.lastIndexOf("/");
  const dirPart = slash >= 0 ? token.slice(0, slash + 1) : "";
  return entries.slice(0, limit).map((e) => {
    const completed = dirPart + e.name + (e.isDir ? "/" : "");
    return {
      value: prefix + completed,
      display: completed,
      hint: e.isDir ? "dir" : "file",
      kind: "path" as const,
    };
  });
}

/** Merge suggestion lists, dropping duplicates by `value` and anything equal to
 *  the current input. Keeps the first occurrence (so caller controls priority
 *  via argument order). */
export function mergeSuggestions(
  input: string,
  lists: Suggestion[][],
  limit = 8
): Suggestion[] {
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const list of lists) {
    for (const s of list) {
      if (s.value === input || seen.has(s.value)) continue;
      if (!s.value.startsWith(input)) continue;
      seen.add(s.value);
      out.push(s);
      if (out.length >= limit) return out;
    }
  }
  return out;
}
