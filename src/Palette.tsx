import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
  untrack,
  type JSX,
} from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  aiCancel,
  aiErrorText,
  type AiChunkEvent,
  type AiDoneEvent,
  type AiErrorEvent,
} from "./ai";
import {
  formatDuration,
  homeRelative,
  historySearch,
  relativeTime,
  type HistoryHit,
} from "./history";
import { IconEnter, IconSparkles } from "./icons";
import { t, tHtml } from "./i18n";

/** Ask the palette for one line of text, then hand it to `onSubmit`. */
export type PromptRequest = {
  kind: "prompt";
  title: string;
  placeholder?: string;
  initial?: string;
  onSubmit: (value: string) => void | Promise<void>;
};

/** Replace the palette's query (e.g. jump to the "!" history mode). */
export type QueryRequest = { kind: "query"; value: string };

export type PaletteItem = {
  id: string;
  /** Section label shown on the row ("Panes", "SSH"…). */
  group: string;
  title: string;
  subtitle?: string;
  /** Extra text matched by the search but not displayed. */
  keywords?: string;
  /** Shortcut label, shown right-aligned. */
  hint?: string;
  icon?: JSX.Element;
  danger?: boolean;
  /** Opens a sub-list instead of running something (themes, all hosts…).
   *  A search from the top level still reaches these nested items. */
  children?: () => PaletteItem[];
  /** Enter. Returning a PromptRequest keeps the palette open for input. */
  run?: () =>
    | void
    | PromptRequest
    | QueryRequest
    | Promise<void | PromptRequest | QueryRequest>;
  /** Shift+Enter, when the action has a variant (e.g. open without commands). */
  altRun?: () => void | Promise<void>;
  altHint?: string;
};

type Mode = "actions" | "history" | "ai";
type AiStage = "input" | "streaming" | "ready" | "error";

type Props = {
  open: () => boolean;
  /** Prefix the palette opens with ("" actions, "!" history, "?" AI). */
  initialQuery: () => string;
  onClose: () => void;
  items: () => PaletteItem[];
  aiAvailable: () => boolean;
  /** CLI command the active AI provider resolves to (for the "not found" hint). */
  aiCommand?: () => string;
  ptyId: () => number | null;
  /** Active pane's cwd (for the `here` history filter and the rows). */
  cwd: () => string | null;
  home: () => string;
  /** Insert a command at the prompt (`execute` = also press Enter). */
  onInsert: (cmd: string, execute: boolean) => void;
};

function cleanResponse(s: string): string {
  // Strip surrounding whitespace, leading $ prompts, and triple-fence noise
  // in case the model didn't fully follow instructions.
  let out = s.trim();
  out = out.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```\s*$/, "");
  out = out.replace(/^\$\s+/, "");
  return out.trim();
}

/** Subsequence fuzzy score (higher = better), or -1 when `q` doesn't match.
 *  Rewards matches at word starts and runs of consecutive characters. */
export function fuzzyScore(q: string, text: string): number {
  if (!q) return 0;
  const s = text.toLowerCase();
  const needle = q.toLowerCase();
  // A plain substring always wins over a scattered match.
  const sub = s.indexOf(needle);
  if (sub !== -1) return 1000 - sub + (sub === 0 || /\W/.test(s[sub - 1]) ? 200 : 0);
  let score = 0;
  let si = 0;
  let run = 0;
  for (const ch of needle) {
    if (ch === " ") continue;
    const found = s.indexOf(ch, si);
    if (found === -1) return -1;
    const wordStart = found === 0 || /[\s:/._-]/.test(s[found - 1]);
    run = found === si ? run + 1 : 0;
    score += 1 + (wordStart ? 8 : 0) + run * 3 - Math.min(found - si, 10) * 0.2;
    si = found + 1;
  }
  return score;
}

/** Score of one entry for a query: every word must match. A word found in
 *  the title ranks first; in the subtitle/keywords next; a scattered match
 *  only counts on the title and only when it lands mostly on word starts
 *  ("sh" → "Split horizontally") — loose matches over long text are noise. */
function entryScore(q: string, title: string, rest: string): number {
  const tl = title.toLowerCase();
  const rl = rest.toLowerCase();
  let total = 0;
  for (const w of q.toLowerCase().split(/\s+/).filter(Boolean)) {
    let i = tl.indexOf(w);
    if (i !== -1) {
      total += 1000 - i + (i === 0 || /\W/.test(tl[i - 1]) ? 300 : 0);
      continue;
    }
    i = rl.indexOf(w);
    if (i !== -1) {
      total += 400 + (i === 0 || /\W/.test(rl[i - 1]) ? 100 : 0);
      continue;
    }
    const f = fuzzyScore(w, title);
    if (w.length >= 2 && f >= w.length * 6) {
      total += f;
      continue;
    }
    return -1;
  }
  return total;
}

/** Submenu title as a breadcrumb segment: "All SSH hosts (7)…" → "All SSH hosts". */
const crumb = (title: string) => title.replace(/\s*\(\d+\)/, "").replace(/…$/, "");

/** A palette row: the item plus where it lives (submenu path, section). */
type Entry = { it: PaletteItem; path: string[]; group: string };
/** `key` is stable across recomputes (section + item id), so rows keep
 *  their DOM nodes — see the `rowKeys` comment. */
type Row = { key: string; header: string } | { key: string; entry: Entry; idx: number };

const RECENT_KEY = "lume.palette.recent";
function loadRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function pushRecent(id: string) {
  try {
    const next = [id, ...loadRecent().filter((x) => x !== id)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

function flatten(items: PaletteItem[], path: string[] = [], group?: string): Entry[] {
  return items.flatMap((it) => {
    const g = group ?? it.group;
    const self: Entry = { it, path, group: g };
    const kids = it.children ? flatten(it.children(), [...path, it.title], g) : [];
    return [self, ...kids];
  });
}

export default function Palette(props: Props) {
  const [query, setQuery] = createSignal("");
  const [index, setIndex] = createSignal(0);
  const [prompt, setPrompt] = createSignal<PromptRequest | null>(null);
  /** Open submenus, outermost first. */
  const [stack, setStack] = createSignal<PaletteItem[]>([]);
  const [recent, setRecent] = createSignal<string[]>([]);
  const [promptValue, setPromptValue] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  // History mode
  const [hits, setHits] = createSignal<HistoryHit[]>([]);
  // AI mode
  const [aiStage, setAiStage] = createSignal<AiStage>("input");
  const [aiResponse, setAiResponse] = createSignal("");
  const [aiError, setAiError] = createSignal<string | null>(null);
  const [requestId, setRequestId] = createSignal<number | null>(null);

  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;

  const mode = (): Mode => {
    const q = query();
    if (q.startsWith("?")) return "ai";
    if (q.startsWith("!")) return "history";
    return "actions";
  };
  const body = () => query().replace(/^[?!]\s*/, "");

  const reset = () => {
    setQuery("");
    setIndex(0);
    setStack([]);
    setPrompt(null);
    setPromptValue("");
    setBusy(false);
    setError(null);
    setHits([]);
    setAiStage("input");
    setAiResponse("");
    setAiError(null);
    setRequestId(null);
  };

  createEffect(() => {
    if (!props.open()) {
      const id = untrack(requestId);
      if (id !== null && untrack(aiStage) === "streaming") aiCancel(id).catch(() => {});
      reset();
      return;
    }
    setQuery(untrack(props.initialQuery));
    setRecent(loadRecent());
    queueMicrotask(() => {
      inputRef?.focus();
      const len = inputRef?.value.length ?? 0;
      inputRef?.setSelectionRange(len, len);
    });
  });

  // --- Actions: sections, submenus, recents ---
  const levelItems = () => {
    const st = stack();
    const top = st[st.length - 1];
    return top?.children ? top.children() : props.items();
  };

  const rows = createMemo<Row[]>(() => {
    if (mode() !== "actions") return [];
    const q = body().trim();
    const atTop = stack().length === 0;
    let entries: Entry[];
    if (!q) {
      entries = levelItems().map((it) => ({ it, path: [], group: it.group }));
    } else {
      entries = flatten(levelItems())
        .map((e) => ({
          e,
          // Nested items match on their own text only — not on the
          // submenu or section they sit in (that would list every host for
          // "ssh", every theme for "theme"…).
          score: entryScore(
            q,
            e.it.title,
            `${e.it.subtitle ?? ""} ${e.it.keywords ?? ""} ${e.path.length ? "" : e.group}`
          ),
        }))
        .filter((x) => x.score >= 0)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.e);
    }
    // Group into sections, in order of first appearance (= best score first
    // when searching).
    const order: string[] = [];
    const bySection = new Map<string, Entry[]>();
    for (const e of entries) {
      if (!bySection.has(e.group)) {
        bySection.set(e.group, []);
        order.push(e.group);
      }
      bySection.get(e.group)!.push(e);
    }
    const out: Row[] = [];
    let idx = 0;
    if (atTop && !q && recent().length) {
      const all = flatten(props.items());
      const recents = recent()
        .map((id) => all.find((e) => e.it.id === id))
        .filter((e): e is Entry => !!e && !e.it.children);
      if (recents.length) {
        out.push({ key: "h:recent", header: t("palette.groupRecent") });
        for (const e of recents) out.push({ key: `r:${e.it.id}`, entry: e, idx: idx++ });
      }
    }
    for (const g of order) {
      // Inside a submenu the section header would just repeat the crumb.
      if (atTop || order.length > 1) out.push({ key: `h:${g}`, header: g });
      for (const e of bySection.get(g)!)
        out.push({ key: `i:${g}:${e.path.join("/")}:${e.it.id}`, entry: e, idx: idx++ });
    }
    return out;
  });
  // The item list is recomputed whenever something it shows changes — the
  // remote status is polled every 2 s, tabs/cwds move… — and every recompute
  // builds fresh row objects. Iterating those directly made <For> rebuild
  // every row: the list emptied for a frame and its scroll snapped back to
  // the top mid-navigation. Iterate the stable keys instead and read each
  // row's content reactively: existing rows keep their DOM node.
  const rowKeys = createMemo(
    () => rows().map((r) => r.key),
    [] as string[],
    { equals: (a, b) => a.length === b.length && a.every((k, i) => k === b[i]) }
  );
  const rowByKey = createMemo(() => new Map(rows().map((r) => [r.key, r] as const)));
  const selectable = createMemo(() =>
    rows().flatMap((r) => ("entry" in r ? [r.entry] : []))
  );
  /** "Generate a command for: …" row, offered for any free text. */
  const offerAi = () => mode() === "actions" && stack().length === 0 && body().trim().length > 2;
  const actionRowCount = () => selectable().length + (offerAi() ? 1 : 0);

  const enterSubmenu = (it: PaletteItem) => {
    setStack((st) => [...st, it]);
    setQuery("");
    setIndex(0);
    queueMicrotask(() => inputRef?.focus());
  };
  const leaveSubmenu = () => {
    setStack((st) => st.slice(0, -1));
    setQuery("");
    setIndex(0);
  };

  // --- History (debounced search in Rust) ---
  let histTimer: ReturnType<typeof setTimeout> | undefined;
  let histSeq = 0;
  createEffect(() => {
    if (!props.open() || mode() !== "history") return;
    const q = body();
    const cwd = props.cwd();
    clearTimeout(histTimer);
    const seq = ++histSeq;
    histTimer = setTimeout(() => {
      historySearch(q, cwd, 200)
        .then((r) => {
          if (seq === histSeq) setHits(r);
        })
        .catch(() => setHits([]));
    }, 70);
  });
  onCleanup(() => clearTimeout(histTimer));

  const rowCount = () =>
    mode() === "history" ? hits().length : mode() === "actions" ? actionRowCount() : 0;

  createEffect(() => {
    const n = rowCount();
    if (index() >= n) setIndex(Math.max(0, n - 1));
  });
  // Keep the selected row visible while navigating with the keyboard.
  createEffect(() => {
    const i = index();
    queueMicrotask(() =>
      listRef
        ?.querySelector<HTMLElement>(`[data-row="${i}"]`)
        ?.scrollIntoView({ block: "nearest" })
    );
  });

  const close = () => props.onClose();

  const runItem = async (it: PaletteItem, alt: boolean) => {
    if (busy()) return;
    setError(null);
    if (it.children) {
      enterSubmenu(it);
      return;
    }
    if (!it.run) return;
    pushRecent(it.id);
    try {
      if (alt && it.altRun) {
        await it.altRun();
        close();
        return;
      }
      setBusy(true);
      const r = await it.run!();
      setBusy(false);
      if (r && r.kind === "query") {
        setQuery(r.value);
        setIndex(0);
        queueMicrotask(() => {
          inputRef?.focus();
          const len = inputRef?.value.length ?? 0;
          inputRef?.setSelectionRange(len, len);
        });
        return;
      }
      if (r && r.kind === "prompt") {
        const pr = r;
        setPrompt(pr);
        setPromptValue(pr.initial ?? "");
        queueMicrotask(() => {
          inputRef?.focus();
          inputRef?.select();
        });
        return;
      }
      close();
    } catch (e) {
      setBusy(false);
      setError(String(e));
    }
  };

  const submitPrompt = async () => {
    const pr = prompt();
    if (!pr || busy()) return;
    const v = promptValue().trim();
    if (!v) return;
    setBusy(true);
    setError(null);
    try {
      await pr.onSubmit(v);
      close();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  // --- AI generation ---
  const startGenerate = async (text: string) => {
    const q = text.trim();
    if (!q || !props.aiAvailable()) return;
    setAiStage("streaming");
    setAiResponse("");
    setAiError(null);
    try {
      const id = await invoke<number>("ai_generate_command", {
        query: q,
        ptyId: props.ptyId(),
      });
      setRequestId(id);
    } catch (e) {
      setAiStage("error");
      setAiError(aiErrorText(String(e)));
    }
  };
  const cancelStreaming = async () => {
    const id = requestId();
    if (id !== null) {
      try {
        await aiCancel(id);
      } catch {}
    }
    setAiStage("input");
    setRequestId(null);
  };
  const insertAi = (execute: boolean) => {
    const cmd = cleanResponse(aiResponse());
    if (!cmd) return;
    props.onInsert(cmd, execute);
    close();
  };

  let unlisten: UnlistenFn[] = [];
  void (async () => {
    unlisten.push(
      await listen<AiChunkEvent>("ai:chunk", (e) => {
        if (e.payload.requestId !== untrack(requestId)) return;
        setAiResponse((r) => r + e.payload.delta);
      }),
      await listen<AiDoneEvent>("ai:done", (e) => {
        if (e.payload.requestId !== untrack(requestId)) return;
        setAiStage("ready");
      }),
      await listen<AiErrorEvent>("ai:error", (e) => {
        if (e.payload.requestId !== untrack(requestId)) return;
        setAiStage("error");
        setAiError(aiErrorText(e.payload.message));
      })
    );
  })();
  onCleanup(() => unlisten.forEach((u) => u()));

  const activate = (i: number, alt: boolean) => {
    if (mode() === "history") {
      const h = hits()[i];
      if (!h) return;
      props.onInsert(h.cmd, alt);
      close();
      return;
    }
    if (mode() === "actions") {
      const list = selectable();
      if (i < list.length) void runItem(list[i].it, alt);
      else if (offerAi()) {
        const text = body();
        setQuery(`? ${text}`);
        void startGenerate(text);
      }
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      if (prompt()) {
        setPrompt(null);
        setError(null);
        queueMicrotask(() => inputRef?.focus());
        return;
      }
      if (mode() === "ai" && aiStage() === "streaming") {
        void cancelStreaming();
        return;
      }
      if (stack().length && mode() === "actions") {
        leaveSubmenu();
        return;
      }
      close();
      return;
    }
    if (prompt()) {
      if (e.key === "Enter") {
        e.preventDefault();
        void submitPrompt();
      }
      return;
    }
    if (mode() === "ai") {
      if (e.key === "Enter") {
        e.preventDefault();
        const s = aiStage();
        if (s === "input") void startGenerate(body());
        else if (s === "ready") insertAi(e.shiftKey);
        else if (s === "error") {
          setAiStage("input");
          setAiError(null);
        }
      }
      return;
    }
    const n = rowCount();
    if (e.key === "Backspace" && !query() && stack().length) {
      e.preventDefault();
      leaveSubmenu();
      return;
    }
    if (e.key === "ArrowRight" && mode() === "actions") {
      const it = selectable()[index()]?.it;
      if (it?.children && (inputRef?.selectionStart ?? 0) >= query().length) {
        e.preventDefault();
        enterSubmenu(it);
        return;
      }
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (n) setIndex((i) => (i + 1) % n);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (n) setIndex((i) => (i - 1 + n) % n);
    } else if (e.key === "PageDown") {
      e.preventDefault();
      if (n) setIndex((i) => Math.min(n - 1, i + 8));
    } else if (e.key === "PageUp") {
      e.preventDefault();
      if (n) setIndex((i) => Math.max(0, i - 8));
    } else if (e.key === "Enter") {
      e.preventDefault();
      activate(index(), e.shiftKey);
    }
  };

  const shortPath = (p: string | null | undefined) => {
    if (!p) return "";
    const rel = homeRelative(p, props.home());
    return rel === null ? p : rel === "" ? "~" : "~/" + rel;
  };

  const placeholder = () => {
    const pr = prompt();
    if (pr) return pr.placeholder ?? "";
    if (mode() === "ai") return t("palette.aiPlaceholder");
    if (mode() === "history") return t("palette.historyPlaceholder");
    return t("palette.placeholder");
  };

  return (
    <Show when={props.open()}>
      <div class="palette-overlay" onClick={close}>
        <div class="palette command-palette" onClick={(e) => e.stopPropagation()}>
          <Show when={prompt()}>
            <div class="cp-prompt-title">{prompt()!.title}</div>
          </Show>
          <div class="palette-header">
            <span class="palette-prompt">
              <Show
                when={!prompt() && mode() === "ai"}
                fallback={<span class="cp-sigil">{prompt() ? "›" : mode() === "history" ? "!" : ">"}</span>}
              >
                <IconSparkles size={14} />
              </Show>
            </span>
            <input
              ref={inputRef}
              class="palette-input"
              type="text"
              spellcheck={false}
              autocomplete="off"
              placeholder={placeholder()}
              value={prompt() ? promptValue() : query()}
              onInput={(e) => {
                if (prompt()) {
                  setPromptValue(e.currentTarget.value);
                } else {
                  setQuery(e.currentTarget.value);
                  setIndex(0);
                  setError(null);
                  if (mode() === "ai" && aiStage() !== "streaming") setAiStage("input");
                }
              }}
              onKeyDown={onKeyDown}
              disabled={busy() || (mode() === "ai" && aiStage() === "streaming")}
            />
            <span class="palette-shortcut">Esc</span>
          </div>

          <Show when={error()}>
            <div class="palette-response error">{error()}</div>
          </Show>

          {/* --- Prompt (text input requested by an action) --- */}
          <Show when={prompt()}>
            <div class="palette-footer">
              <span class="palette-hint" innerHTML={t("palette.promptHint")} />
            </div>
          </Show>

          {/* --- Actions --- */}
          <Show when={!prompt() && mode() === "actions"}>
            <Show when={stack().length}>
              <div class="cp-crumb">
                <button onClick={() => { setStack([]); setQuery(""); setIndex(0); }}>
                  {t("palette.crumbAll")}
                </button>
                <For each={stack()}>
                  {(it, i) => (
                    <>
                      <span>›</span>
                      <Show when={i() === stack().length - 1} fallback={<span>{crumb(it.title)}</span>}>
                        <b>{crumb(it.title)}</b>
                      </Show>
                    </>
                  )}
                </For>
              </div>
            </Show>
            <div class="cp-list" ref={listRef}>
              <For each={rowKeys()}>
                {(key) => {
                  const row = () => rowByKey().get(key);
                  const item = () => {
                    const r = row();
                    return r && "entry" in r ? r : null;
                  };
                  return key.startsWith("h:") ? (
                    <div class="cp-section">
                      {(() => {
                        const r = row();
                        return r && "header" in r ? r.header : "";
                      })()}
                    </div>
                  ) : (
                    <Show when={item()}>
                      {(r) => (
                        <div
                          class="cp-item"
                          data-row={r().idx}
                          classList={{
                            selected: r().idx === index(),
                            danger: !!r().entry.it.danger,
                          }}
                          onMouseMove={() => r().idx !== index() && setIndex(r().idx)}
                          onClick={(e) => void runItem(r().entry.it, e.shiftKey)}
                        >
                          <span class="cp-icon">{r().entry.it.icon}</span>
                          <div class="cp-main">
                            <span class="cp-title">
                              <Show when={r().entry.path.length}>
                                <span class="cp-path">
                                  {r().entry.path.map(crumb).join(" › ")} ›{" "}
                                </span>
                              </Show>
                              {r().entry.it.title}
                            </span>
                            <Show when={r().entry.it.subtitle}>
                              <span class="cp-sub">{r().entry.it.subtitle}</span>
                            </Show>
                          </div>
                          <Show when={r().idx === index() && r().entry.it.altHint}>
                            <span class="cp-alt">⇧↵ {r().entry.it.altHint}</span>
                          </Show>
                          <Show when={r().entry.it.hint}>
                            <kbd class="cp-kbd">{r().entry.it.hint}</kbd>
                          </Show>
                          <Show when={r().entry.it.children}>
                            <span class="cp-more">›</span>
                          </Show>
                        </div>
                      )}
                    </Show>
                  );
                }}
              </For>
              <Show when={offerAi()}>
                <div class="cp-section">{t("palette.groupAi")}</div>
                <div
                  class="cp-item cp-ai-row"
                  data-row={selectable().length}
                  classList={{ selected: index() === selectable().length }}
                  onMouseMove={() => setIndex(selectable().length)}
                  onClick={() => activate(selectable().length, false)}
                >
                  <span class="cp-icon">
                    <IconSparkles size={13} />
                  </span>
                  <div class="cp-main">
                    <span class="cp-title">{t("palette.aiGenerate", { q: body().trim() })}</span>
                  </div>
                </div>
              </Show>
              <Show when={actionRowCount() === 0}>
                <div class="ssh-empty">{t("palette.noMatch")}</div>
              </Show>
            </div>
            <div class="palette-footer">
              <span
                class="palette-hint"
                innerHTML={stack().length ? t("palette.subHint") : t("palette.hint")}
              />
            </div>
          </Show>

          {/* --- History --- */}
          <Show when={!prompt() && mode() === "history"}>
            <div class="cp-list" ref={listRef}>
              <For each={hits()}>
                {(h, i) => (
                  <div
                    class="cp-item cp-hist"
                    data-row={i()}
                    classList={{ selected: i() === index() }}
                    onMouseMove={() => i() !== index() && setIndex(i())}
                    onClick={(e) => activate(i(), e.shiftKey)}
                  >
                    <span
                      class="cp-exit"
                      classList={{
                        ok: h.exit === 0,
                        fail: h.exit != null && h.exit !== 0,
                      }}
                      title={h.exit != null ? t("palette.exitCode", { code: h.exit }) : ""}
                    >
                      {h.exit == null ? "·" : h.exit === 0 ? "✓" : h.exit}
                    </span>
                    <div class="cp-main">
                      <code class="cp-cmd">{h.cmd}</code>
                      <span class="cp-sub">
                        {[
                          shortPath(h.cwd),
                          h.branch ? `⎇ ${h.branch}` : "",
                          relativeTime(h.ts, t),
                          h.dur != null ? formatDuration(h.dur) : "",
                          h.count > 1 ? `×${h.count}` : "",
                        ]
                          .filter(Boolean)
                          .join("  ·  ")}
                      </span>
                    </div>
                    <Show when={i() === index()}>
                      <span class="cp-go">
                        <IconEnter size={13} />
                      </span>
                    </Show>
                  </div>
                )}
              </For>
              <Show when={hits().length === 0}>
                <div class="ssh-empty">{t("palette.historyEmpty")}</div>
              </Show>
            </div>
            <div class="palette-footer">
              <span class="palette-hint" innerHTML={t("palette.historyHint")} />
            </div>
          </Show>

          {/* --- AI --- */}
          <Show when={!prompt() && mode() === "ai"}>
            <Show when={!props.aiAvailable()}>
              <div
                class="palette-warning"
                innerHTML={
                  props.aiCommand?.()
                    ? tHtml("cmd.noCli", { cmd: props.aiCommand!() })
                    : t("cmd.noProvider")
                }
              />
            </Show>
            <Show when={aiStage() === "streaming"}>
              <div class="palette-response streaming">
                <code>{cleanResponse(aiResponse()) || "…"}</code>
                <span class="ai-cursor" />
              </div>
              <div class="palette-footer">
                <button class="palette-btn ghost" onClick={cancelStreaming}>
                  {t("cmd.cancel")}
                </button>
              </div>
            </Show>
            <Show when={aiStage() === "ready"}>
              <div class="palette-response ready">
                <code>{cleanResponse(aiResponse())}</code>
              </div>
              <div class="palette-footer">
                <span class="palette-hint" innerHTML={t("palette.aiInsertHint")} />
                <div class="palette-actions">
                  <button class="palette-btn ghost" onClick={() => setAiStage("input")}>
                    {t("cmd.reformulate")}
                  </button>
                  <button class="palette-btn primary" onClick={() => insertAi(false)}>
                    {t("cmd.insert")}
                  </button>
                </div>
              </div>
            </Show>
            <Show when={aiStage() === "error"}>
              <div class="palette-response error">
                {aiError() ?? t("cmd.unknownError")}
              </div>
              <div class="palette-footer">
                <button class="palette-btn ghost" onClick={() => setAiStage("input")}>
                  {t("cmd.retry")}
                </button>
              </div>
            </Show>
            <Show when={aiStage() === "input" && props.aiAvailable()}>
              <div class="palette-footer">
                <span class="palette-hint" innerHTML={t("cmd.generateHint")} />
              </div>
            </Show>
          </Show>
        </div>
      </div>
    </Show>
  );
}
