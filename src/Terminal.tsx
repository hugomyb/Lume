import {
  createEffect,
  createSignal,
  getOwner,
  onCleanup,
  onMount,
  runWithOwner,
  Show,
} from "solid-js";
import { Portal } from "solid-js/web";
import {
  Terminal as XTerm,
  type IDisposable,
  type IMarker,
} from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import "@xterm/xterm/css/xterm.css";
import { type Appearance, toXtermTheme } from "./config";
import { t } from "./i18n";
import type { PtyBlock } from "./blocks";
import Autocomplete, { type AcPosition } from "./Autocomplete";
import {
  aliasSuggestions,
  commandSuggestions,
  historySuggestions,
  mergeSuggestions,
  pathSuggestions,
  recordAliases,
  type AliasItem,
  type Suggestion,
} from "./suggestions";

type PtyOutput = { id: number; data_b64: string };
type PtyExit = { id: number };

type TerminalProps = {
  active: () => boolean;
  appearance: Appearance;
  /** Directory to spawn the shell in (session restore). Falls back to $HOME. */
  initialCwd?: string | null;
  onExit?: () => void;
  onBlock?: (event: PtyBlock) => void;
  onSpawned?: (ptyId: number) => void;
  onFocusReady?: (focus: () => void) => void;
  onScrollReady?: (
    scrollTo: (startMarkerId: number, endMarkerIdHint: number | null) => void
  ) => void;
  /** Called for each detected prompt marker (OSC 133;A). `markerId` is an
   * opaque handle: Lume stores it on the corresponding Block, and later passes
   * it back through `onScrollReady` to ask the Terminal to scroll. The handle
   * is necessary because xterm trims old scrollback rows and their absolute
   * indices shift — only an `IMarker` survives that. */
  onBlockLine?: (markerId: number) => void;
  /** Called when the shell emits OSC 7 with a new working directory. */
  onCwd?: (cwd: string) => void;
  /** Exposes a getter for the terminal's current text selection (for copy). */
  onSelectionReady?: (getSelection: () => string) => void;
  /** Exposes a fn that opens the in-terminal scrollback search bar. */
  onSearchReady?: (openSearch: () => void) => void;
  /** Fired when the per-block copy button is clicked, with the block's opaque
   *  marker id (see `onBlockLine`). */
  onCopyBlock?: (markerId: number) => void;
  /** Whether a block (by marker id) has a command worth copying — the hover
   *  copy button is suppressed otherwise (e.g. the bare prompt of a fresh
   *  terminal). */
  canCopyMarker?: (markerId: number) => boolean;
  /** Exposes a function that triggers fit() + refresh() — used by the parent
   * when a tab becomes visible (display:none → display:flex). xterm's WebGL
   * canvas doesn't paint while hidden, so we need an explicit kick after the
   * container is re-laid out. */
  onRefreshReady?: (refresh: () => void) => void;
};

// Optional autocomplete tracing. Enable from the devtools console with:
//   localStorage.setItem("lume.debugAutocomplete", "1")  (then reload)
const AC_DEBUG = (() => {
  try {
    return localStorage.getItem("lume.debugAutocomplete") === "1";
  } catch {
    return false;
  }
})();
const acLog = (...args: unknown[]) => {
  if (AC_DEBUG) console.debug("[lume-ac]", ...args);
};

// Appended after the user's font so xterm — which has weak built-in glyph
// fallback — can still find icons/symbols missing from the chosen font (e.g.
// Powerline/Nerd glyphs, or the dashed arrows ⇡⇣ P10k uses). Only the fonts
// actually installed take effect; the rest are ignored by the browser.
const FONT_FALLBACKS =
  '"Symbols Nerd Font Mono", "Symbols Nerd Font", "MesloLGS NF", "Noto Sans Symbols2", "Noto Sans Symbols", "Noto Color Emoji", "DejaVu Sans Mono", "Unifont CSUR", "Unifont Sample", "Unifont", monospace';

function withFallbacks(family: string): string {
  return family ? `${family}, ${FONT_FALLBACKS}` : FONT_FALLBACKS;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(
      ...bytes.subarray(i, Math.min(i + chunk, bytes.length))
    );
  }
  return btoa(bin);
}

export default function Terminal(props: TerminalProps) {
  let containerRef: HTMLDivElement | undefined;
  let term: XTerm | undefined;
  let fit: FitAddon | undefined;
  let ptyId: number | undefined;
  let unlistenOutput: UnlistenFn | undefined;
  let unlistenExit: UnlistenFn | undefined;
  let unlistenBlock: UnlistenFn | undefined;
  let unlistenCwd: UnlistenFn | undefined;
  let unlistenAliases: UnlistenFn | undefined;
  const encoder = new TextEncoder();
  // Markers indexed by an opaque id we hand to Tabs. The id is sequential and
  // stable for the lifetime of the session; the underlying IMarker tracks the
  // actual buffer row through scrollback evictions.
  const markers = new Map<number, IMarker>();
  let nextMarkerId = 0;
  // Assigned inside onMount; let the render/top-level effect reach the popup
  // controls that live in onMount's scope.
  let closeAcRef: (() => void) | null = null;
  let acceptAcRef: (() => void) | null = null;

  // --- Scrollback search state ---
  let searchAddon: SearchAddon | undefined;
  let searchInputRef: HTMLInputElement | undefined;
  const [searchOpen, setSearchOpen] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [searchResults, setSearchResults] = createSignal({ index: 0, count: 0 });
  const [searchPos, setSearchPos] = createSignal({ top: 0, right: 0 });

  const runSearch = (forward: boolean) => {
    if (!searchAddon) return;
    const q = searchQuery();
    if (!q) {
      searchAddon.clearDecorations();
      setSearchResults({ index: 0, count: 0 });
      return;
    }
    const th = props.appearance.theme;
    const opts = {
      caseSensitive: false,
      decorations: {
        matchBackground: th.selection,
        matchBorder: th.selection,
        matchOverviewRuler: th.accent,
        activeMatchBackground: th.accent,
        activeMatchBorder: th.accent,
        activeMatchColorOverviewRuler: th.accent,
      },
    };
    if (forward) searchAddon.findNext(q, opts);
    else searchAddon.findPrevious(q, opts);
  };

  const openSearchBar = () => {
    if (containerRef) {
      const r = containerRef.getBoundingClientRect();
      setSearchPos({
        top: Math.max(8, r.top + 8),
        right: Math.max(8, window.innerWidth - r.right + 12),
      });
    }
    const sel = term?.getSelection();
    if (sel && !sel.includes("\n")) setSearchQuery(sel);
    setSearchOpen(true);
    queueMicrotask(() => {
      searchInputRef?.focus();
      searchInputRef?.select();
      if (searchQuery()) runSearch(true);
    });
  };

  const closeSearchBar = () => {
    setSearchOpen(false);
    searchAddon?.clearDecorations();
    term?.focus();
  };

  // --- Inline autocomplete state ---
  const [acItems, setAcItems] = createSignal<Suggestion[]>([]);
  const [acIndex, setAcIndex] = createSignal(0);
  const [acOpen, setAcOpen] = createSignal(false);
  const [acPos, setAcPos] = createSignal<AcPosition>({
    x: 0,
    y: 0,
    above: false,
    maxWidth: 360,
  });
  // Absolute buffer row/col where the editable command line begins. `null`
  // means "not at a prompt" → no suggestions. It's set two ways:
  //   - precisely by the OSC 133;B handler (prompt end), when the shell emits it;
  //   - prompt-agnostically on the first keystroke after a prompt (works with
  //     dynamic prompts like Powerlevel10k/starship that never emit B), reading
  //     the cursor position the shell left at the start of the command line.
  let anchorRow: number | null = null;
  let anchorCol = 0;
  // Armed on OSC 133;A (new prompt incoming); the next onData captures the
  // anchor from the cursor, then disarms.
  let awaitingFirstInput = false;
  let currentCwd = "";
  // Input we last dismissed with Esc; suppresses reopening until it changes.
  let dismissedInput: string | null = null;
  // True once the user types a printable char at the current prompt. Line
  // rewrites that aren't typing (history recall via ↑/↓, shell echo, output)
  // may refresh an already-open popup but must never pop it open on their own —
  // otherwise recalling a completable command steals the arrow keys.
  let typedSincePrompt = false;
  // Monotonic counter to discard stale async path-completion responses.
  let acReqSeq = 0;
  let acRaf = 0;

  // onMount below is async; past the first `await` Solid's reactive owner is
  // gone, so an onCleanup() registered there is "outside a root" and never
  // runs (leaking listeners/observers). Capture the owner now and re-enter it
  // to register cleanups that actually dispose on unmount.
  const owner = getOwner();
  const addCleanup = (fn: () => void) =>
    owner ? runWithOwner(owner, () => onCleanup(fn)) : onCleanup(fn);

  onMount(async () => {
    if (!containerRef) return;

    term = new XTerm({
      fontFamily: withFallbacks(props.appearance.fontFamily),
      fontSize: props.appearance.fontSize,
      cursorBlink: props.appearance.cursorBlink,
      cursorStyle: props.appearance.cursorStyle,
      allowProposedApi: true,
      scrollback: props.appearance.scrollback,
      // Disable smooth scrolling — it's a noticeable lag tax on WebKit2GTK.
      smoothScrollDuration: 0,
      theme: toXtermTheme(props.appearance.theme),
    });
    fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef);

    // xterm on Linux re-extracts the ENTIRE selection text on every mousemove
    // of a drag (twice, via the `selectionText` getter) and mirrors it into its
    // hidden textarea (`value` + `select()`), just to keep the X11 PRIMARY
    // selection live for middle-click paste. That's O(selected rows) work at
    // mouse-event rate — measured 45% WebProcess CPU for a ~45-row drag vs 12%
    // for a 1-row one. Middle-click paste only needs PRIMARY to be correct once
    // the drag ENDS, so: strip the per-move sync (refresh(false)) and replay a
    // single genuine refresh(true) on mouseup.
    {
      const selSvc = (
        term as unknown as {
          _core?: { _selectionService?: { refresh: (linux?: boolean) => void } };
        }
      )._core?._selectionService;
      if (selSvc) {
        const origRefresh = selSvc.refresh.bind(selSvc);
        selSvc.refresh = () => origRefresh(false);
        const syncPrimaryOnMouseUp = (e: MouseEvent) => {
          if (e.button === 0 && term?.hasSelection()) origRefresh(true);
        };
        // Document-level: the drag can end outside the terminal (or window).
        document.addEventListener("mouseup", syncPrimaryOnMouseUp);
        addCleanup(() =>
          document.removeEventListener("mouseup", syncPrimaryOnMouseUp)
        );
      }
    }
    // The WebGL renderer is fast but has glyph-rendering gaps (some Nerd Font /
    // icon glyphs render as tofu where the DOM renderer would fall back fine).
    // Allow disabling it: `localStorage.setItem("lume.noWebgl","1")` + reload.
    const useWebgl = (() => {
      try {
        return localStorage.getItem("lume.noWebgl") !== "1";
      } catch {
        return true;
      }
    })();
    if (useWebgl) {
      try {
        const webgl = new WebglAddon();
        webgl.onContextLoss(() => {
          console.warn("[lume] WebGL context lost, disposing addon");
          webgl.dispose();
        });
        term.loadAddon(webgl);
      } catch (e) {
        console.warn("[lume] WebGL addon failed, falling back to DOM renderer", e);
      }
    }

    // Clickable links: Ctrl/Cmd+click opens URLs externally (via the OS), like
    // VS Code's terminal — a plain click stays available for text selection.
    term.loadAddon(
      new WebLinksAddon((event, uri) => {
        if (event.ctrlKey || event.metaKey) openUrl(uri).catch(console.error);
      })
    );

    // Scrollback search.
    searchAddon = new SearchAddon();
    term.loadAddon(searchAddon);
    searchAddon.onDidChangeResults((r) =>
      setSearchResults({ index: (r?.resultIndex ?? -1) + 1, count: r?.resultCount ?? 0 })
    );
    // Wait one frame so flex layout has time to compute the container's real
    // size — otherwise fit() reads 0x0 (or the default 80x24) and we spawn
    // the shell at the wrong dimensions.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve())
    );
    if (containerRef) {
      const rect = containerRef.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        try {
          fit.fit();
        } catch {}
      }
    }

    // --- Autocomplete helpers (defined before the OSC handler so it can call
    // them; only ever invoked once PTY data starts flowing) ---

    // Force xterm to repaint its viewport. The WebGL canvas only redraws on
    // terminal changes, so when an overlay appears/disappears the compositor can
    // leave the canvas blank until the next draw — this kicks one explicitly.
    const requestRepaint = () => {
      requestAnimationFrame(() => {
        try {
          if (term) term.refresh(0, term.rows - 1);
        } catch {
          /* ignore */
        }
      });
    };

    const closeAutocomplete = () => {
      const wasOpen = acOpen();
      if (wasOpen) setAcOpen(false);
      if (acItems().length) setAcItems([]);
      setAcIndex(0);
      if (wasOpen) requestRepaint();
    };

    const cellSize = (): { w: number; h: number } => {
      const cell = (
        term as unknown as {
          _core?: {
            _renderService?: {
              dimensions?: { css?: { cell?: { width?: number; height?: number } } };
            };
          };
        }
      )._core?._renderService?.dimensions?.css?.cell;
      if (cell?.width && cell?.height) return { w: cell.width, h: cell.height };
      const w = containerRef ? containerRef.clientWidth / (term?.cols || 80) : 8;
      const h = containerRef ? containerRef.clientHeight / (term?.rows || 24) : 16;
      return { w, h };
    };

    // Read the command line the user is typing: the buffer text from the anchor
    // to the cursor. `atEnd` is false when the cursor sits left of the typed
    // text's end (mid-line edit) — we only complete when appending is safe.
    const readInput = (): { text: string; atEnd: boolean } | null => {
      if (!term || anchorRow === null) return null;
      const buf = term.buffer.active;
      const curRow = buf.baseY + buf.cursorY;
      const curCol = buf.cursorX;
      // V1 handles single-row command lines (the overwhelming majority).
      if (curRow !== anchorRow || curCol < anchorCol) return null;
      const line = buf.getLine(curRow);
      if (!line) return null;
      const text = line.translateToString(false, anchorCol, curCol);
      // "At end" = no command-line text immediately right of the cursor. We only
      // inspect the single cell at the cursor (NOT the whole trimmed line):
      // a space/empty cell is fine — it's trailing input or padding before a
      // right-aligned prompt (Powerlevel10k's RPROMPT lives on this same row).
      // A non-space means the cursor is mid-line (left-arrow edit), where a
      // suffix-append would be wrong, so we suppress suggestions.
      const nextChars = line.getCell(curCol)?.getChars() ?? "";
      const atEnd = nextChars === "" || nextChars === " ";
      return { text, atEnd };
    };

    const positionFor = (count: number): AcPosition => {
      const fallback: AcPosition = { x: 0, y: 0, above: false, maxWidth: 360 };
      if (!term || !containerRef) return fallback;
      const buf = term.buffer.active;
      const rowInView = buf.baseY + buf.cursorY - buf.viewportY;
      const { w, h } = cellSize();
      const rect = containerRef.getBoundingClientRect();
      const x = Math.max(
        8,
        Math.min(rect.left + anchorCol * w, window.innerWidth - 240)
      );
      const lineTop = rect.top + rowInView * h;
      const belowY = lineTop + h;
      const estHeight = Math.min(count, 8) * 26 + 30;
      const above =
        belowY + estHeight > window.innerHeight - 8 && lineTop - estHeight > 8;
      const maxWidth = Math.max(220, Math.min(560, window.innerWidth - x - 12));
      return { x, y: above ? lineTop : belowY, above, maxWidth };
    };

    const showSuggestions = (items: Suggestion[]) => {
      if (items.length === 0) {
        closeAutocomplete();
        return;
      }
      acLog("show", items.length, items.map((s) => s.value));
      const wasOpen = acOpen();
      const prevSel = wasOpen ? acItems()[acIndex()]?.value : undefined;
      setAcItems(items);
      const found = prevSel ? items.findIndex((s) => s.value === prevSel) : -1;
      setAcIndex(found >= 0 ? found : 0);
      setAcPos(positionFor(items.length));
      if (!wasOpen) {
        setAcOpen(true);
        requestRepaint();
      }
    };

    const recompute = () => {
      const r = readInput();
      acLog("recompute", { anchor: anchorRow, cwd: currentCwd, result: r });
      if (!r || !r.atEnd || r.text.trim().length === 0) {
        closeAutocomplete();
        return;
      }
      // Only a genuine keystroke may OPEN the popup. A closed popup stays closed
      // when the line changes for any other reason (history recall, output) so
      // arrow-key history navigation isn't hijacked.
      if (!acOpen() && !typedSincePrompt) return;
      const input = r.text;
      if (dismissedInput !== null) {
        if (input === dismissedInput) return;
        dismissedInput = null;
      }
      const firstToken = /\s/.test(input) ? "" : input;
      // Synchronous sources render instantly; the async path source augments.
      showSuggestions(
        mergeSuggestions(input, [
          historySuggestions(input),
          aliasSuggestions(firstToken),
          commandSuggestions(firstToken),
        ])
      );
      const req = ++acReqSeq;
      pathSuggestions(input, currentCwd)
        .then((paths) => {
          if (req !== acReqSeq || dismissedInput === input) return;
          const latest = readInput();
          if (!latest || latest.text !== input || !latest.atEnd) return;
          showSuggestions(
            mergeSuggestions(input, [
              historySuggestions(input),
              aliasSuggestions(firstToken),
              paths,
              commandSuggestions(firstToken),
            ])
          );
        })
        .catch(() => {});
    };

    const scheduleRecompute = () => {
      if (acRaf) return;
      acRaf = requestAnimationFrame(() => {
        acRaf = 0;
        try {
          recompute();
        } catch (err) {
          acLog("recompute error", err);
          closeAutocomplete();
        }
      });
    };

    const acceptCurrent = () => {
      const it = acItems()[acIndex()];
      const r = readInput();
      closeAutocomplete();
      if (!it || !r || !it.value.startsWith(r.text)) return;
      const suffix = it.value.slice(r.text.length);
      if (suffix && ptyId !== undefined) {
        const bytes = encoder.encode(suffix);
        invoke("pty_write", { id: ptyId, dataB64: bytesToB64(bytes) }).catch(
          console.error
        );
      }
    };

    const dismissAutocomplete = () => {
      const r = readInput();
      dismissedInput = r ? r.text : "";
      closeAutocomplete();
    };

    // OSC 133 handler: fires synchronously when xterm processes an OSC 133
    // marker. We forward 133;A (prompt start) and 133;B (prompt end) from Rust;
    // the rest are stripped there.
    //   - A: register an IMarker on the prompt row so xterm follows it through
    //     scrollback trimming (block click→scroll); also invalidate the stale
    //     autocomplete anchor since a new prompt is incoming.
    //   - B: record the cursor position as the command-line anchor.
    term.parser.registerOscHandler(133, (data: string): boolean => {
      if (!term) return true;
      const kind = data.split(";")[0];
      acLog("OSC 133;" + kind);
      if (kind === "A") {
        anchorRow = null;
        awaitingFirstInput = true;
        typedSincePrompt = false;
        closeAutocomplete();
        const buf = term.buffer.active;
        // Cursor mid-line? Most shells will emit a CR/LF before drawing the
        // prompt, so the prompt lands one row below the current cursor row.
        const bump = buf.cursorX > 0 ? 1 : 0;
        const marker = term.registerMarker(bump);
        if (marker) {
          const id = nextMarkerId++;
          markers.set(id, marker);
          marker.onDispose(() => markers.delete(id));
          props.onBlockLine?.(id);
        }
      } else if (kind === "B") {
        const buf = term.buffer.active;
        anchorRow = buf.baseY + buf.cursorY;
        anchorCol = buf.cursorX;
        awaitingFirstInput = false;
        dismissedInput = null;
        scheduleRecompute();
      }
      return true;
    });

    // Register listeners BEFORE spawning the PTY so we don't miss the shell's
    // initial output (banner, first prompt). The Rust reader thread starts
    // as soon as the PTY is spawned, and on a busy event loop the listener
    // registration after the await could miss those early bytes.
    const pendingOutput: PtyOutput[] = [];
    const pendingBlocks: PtyBlock[] = [];
    const pendingCwd: { id: number; cwd: string }[] = [];

    unlistenOutput = await listen<PtyOutput>("pty:output", (e) => {
      if (ptyId === undefined) {
        pendingOutput.push(e.payload);
        return;
      }
      if (e.payload.id !== ptyId) return;
      term?.write(b64ToBytes(e.payload.data_b64));
    });

    unlistenExit = await listen<PtyExit>("pty:exit", (e) => {
      if (e.payload.id !== ptyId) return;
      term?.write("\r\n\x1b[2m[process exited]\x1b[0m\r\n");
      props.onExit?.();
    });

    unlistenBlock = await listen<PtyBlock>("pty:block", (e) => {
      if (ptyId === undefined) {
        pendingBlocks.push(e.payload);
        return;
      }
      if (e.payload.id !== ptyId) return;
      // The command line is submitted (output starting) or a new prompt is
      // starting — either way the autocomplete anchor is no longer valid.
      if (e.payload.kind === "outputStart" || e.payload.kind === "promptStart") {
        anchorRow = null;
        closeAutocomplete();
      }
      props.onBlock?.(e.payload);
    });

    unlistenCwd = await listen<{ id: number; cwd: string }>("pty:cwd", (e) => {
      if (ptyId === undefined) {
        pendingCwd.push(e.payload);
        return;
      }
      if (e.payload.id !== ptyId) return;
      currentCwd = e.payload.cwd;
      props.onCwd?.(e.payload.cwd);
    });

    // Aliases are user-global and pushed once per shell at startup; record them
    // whenever they arrive (no ptyId gate — every pane reports the same set).
    unlistenAliases = await listen<{ id: number; items: AliasItem[] }>(
      "pty:aliases",
      (e) => {
        if (e.payload.items?.length) recordAliases(e.payload.items);
      }
    );

    const { cols, rows } = term;
    ptyId = await invoke<number>("pty_spawn", {
      rows,
      cols,
      cwd: props.initialCwd ?? null,
    });
    props.onSpawned?.(ptyId);
    props.onFocusReady?.(() => term?.focus());
    props.onSelectionReady?.(() => term?.getSelection() ?? "");
    props.onSearchReady?.(openSearchBar);

    // Flush any events that arrived between listener registration and PTY id
    // being assigned.
    for (const p of pendingOutput) {
      if (p.id === ptyId) term?.write(b64ToBytes(p.data_b64));
    }
    pendingOutput.length = 0;
    for (const p of pendingBlocks) {
      if (p.id === ptyId) props.onBlock?.(p);
    }
    pendingBlocks.length = 0;
    for (const p of pendingCwd) {
      if (p.id === ptyId) {
        currentCwd = p.cwd;
        props.onCwd?.(p.cwd);
      }
    }
    pendingCwd.length = 0;
    props.onScrollReady?.((
      startMarkerId: number,
      endMarkerIdHint: number | null
    ) => {
      if (!term || !containerRef) return;

      const startMarker = markers.get(startMarkerId);
      if (!startMarker || startMarker.isDisposed) {
        console.warn(
          "[lume] scrollToBlock: start marker missing or disposed",
          startMarkerId
        );
        return;
      }
      const startLine = startMarker.line;

      // Resolve endLine from the next block's marker if we have one, else use
      // the current cursor position. Note: cursor's absolute buffer row is
      // `baseY + cursorY` (here baseY = ybase = where the cursor area starts).
      let endLine: number;
      if (endMarkerIdHint !== null) {
        const endMarker = markers.get(endMarkerIdHint);
        if (endMarker && !endMarker.isDisposed) {
          endLine = endMarker.line - 1;
        } else {
          const buf = term.buffer.active;
          endLine = buf.baseY + buf.cursorY - 1;
        }
      } else {
        const buf = term.buffer.active;
        endLine = buf.baseY + buf.cursorY - 1;
      }
      if (endLine < startLine) endLine = startLine;

      // Always scroll so the prompt lands a few rows below the top of the
      // viewport. scrollToLine updates `viewportY` (= ydisp), NOT `baseY`
      // (= ybase, which only moves when new content is written).
      const margin = 3;
      term.scrollToLine(Math.max(0, startLine - margin));

      const cell = (term as unknown as {
        _core?: {
          _renderService?: {
            dimensions?: { css?: { cell?: { height?: number } } };
          };
        };
      })._core?._renderService?.dimensions?.css?.cell;
      const fallback = containerRef.clientHeight / term.rows;
      const cellH = cell?.height ?? fallback;
      if (!cellH || cellH <= 0) return;

      // For positioning the overlay, the "top of what's visible" is
      // `viewportY`, NOT `baseY`. Using baseY here was the bug that produced
      // negative startVY values when the user wasn't sitting at the cursor.
      const viewTop = term.buffer.active.viewportY;
      const startVY = startLine - viewTop;
      const endVY = endLine - viewTop;
      const clampedStart = Math.max(0, startVY);
      const clampedEnd = Math.min(term.rows - 1, endVY);
      if (clampedEnd < 0 || clampedStart >= term.rows) return;

      const yPx = clampedStart * cellH;
      const heightPx = (clampedEnd - clampedStart + 1) * cellH;

      const overlay = document.createElement("div");
      overlay.className = "lume-block-flash";
      overlay.style.top = `${yPx}px`;
      overlay.style.height = `${heightPx}px`;
      containerRef.appendChild(overlay);
      setTimeout(() => overlay.remove(), 1500);
    });

    // Reclaim the host PTY size after a remote client resized the shared PTY.
    let lastSizeAssert = 0;
    const reassertHostSize = () => {
      if (ptyId === undefined || !term) return;
      const now = performance.now();
      if (now - lastSizeAssert < 250) return;
      lastSizeAssert = now;
      invoke("pty_resize", {
        id: ptyId,
        rows: term.rows,
        cols: term.cols,
      }).catch(() => {});
    };
    // Also when the user clicks back into this terminal.
    term.textarea?.addEventListener("focus", () => reassertHostSize());

    term.onData((data) => {
      // A remote-control client may have shrunk the shared PTY to its own
      // size. As soon as the host types again, reclaim the host's dimensions
      // so this terminal renders at full width (throttled).
      reassertHostSize();
      // First keystroke after a prompt: the cursor still sits at the start of
      // the command line (the keystroke hasn't echoed back yet), so this is the
      // anchor. Prompt-agnostic — the only fallback when OSC 133;B is absent.
      if (awaitingFirstInput && term) {
        const buf = term.buffer.active;
        anchorRow = buf.baseY + buf.cursorY;
        anchorCol = buf.cursorX;
        awaitingFirstInput = false;
        dismissedInput = null;
        acLog("anchor set on first input", { anchorRow, anchorCol });
      }
      // Distinguish real typing from control/navigation sequences so only a
      // keystroke can open the completion popup. Enter submits → reset for the
      // next prompt; printable insert → mark as typed.
      const code0 = data.charCodeAt(0);
      if (data === "\r" || data === "\n") {
        typedSincePrompt = false;
      } else if (!data.startsWith("\x1b") && code0 >= 0x20 && code0 !== 0x7f) {
        typedSincePrompt = true;
      }
      if (ptyId === undefined) return;
      const bytes = encoder.encode(data);
      invoke("pty_write", { id: ptyId, dataB64: bytesToB64(bytes) }).catch(
        console.error
      );
    });

    term.onResize(({ cols, rows }) => {
      if (ptyId === undefined) return;
      invoke("pty_resize", { id: ptyId, rows, cols }).catch(console.error);
    });

    // Recompute autocomplete after the buffer changes (shell echo, output) or
    // the cursor moves (arrow-key editing). A cheap no-op when not at a prompt.
    const acWriteSub: IDisposable = term.onWriteParsed(() => scheduleRecompute());
    const acCursorSub: IDisposable = term.onCursorMove(() => scheduleRecompute());
    addCleanup(() => {
      acWriteSub.dispose();
      acCursorSub.dispose();
      if (acRaf) cancelAnimationFrame(acRaf);
    });

    // Intercept navigation/accept keys only while the suggestion popup is open.
    // Otherwise every key flows through untouched — including a bare Tab, so the
    // shell's own completion still works when Lume has nothing to offer.
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== "keydown" || !acOpen()) return true;
      const len = acItems().length;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setAcIndex((i) => (i + 1) % len);
          return false;
        case "ArrowUp":
          e.preventDefault();
          setAcIndex((i) => (i - 1 + len) % len);
          return false;
        case "Tab":
          e.preventDefault();
          acceptCurrent();
          return false;
        case "ArrowRight": {
          const r = readInput();
          if (r && r.atEnd) {
            e.preventDefault();
            acceptCurrent();
            return false;
          }
          return true;
        }
        case "Escape":
          e.preventDefault();
          dismissAutocomplete();
          return false;
        case "Enter":
          // Let the command run; just drop the overlay and stale anchor.
          anchorRow = null;
          closeAutocomplete();
          return true;
        default:
          return true;
      }
    });

    // Expose the close fn so the top-level active() effect can drop the popup
    // when this pane is deactivated (createEffect can't be created here — we're
    // past `await`, so there's no reactive owner anymore).
    closeAcRef = closeAutocomplete;
    acceptAcRef = acceptCurrent;

    // --- Per-block copy button (hover affordance over the terminal) ---
    // Rendered as a raw DOM child of the host (like the flash overlay) so it
    // doesn't disturb the WebGL canvas; repositioned imperatively on hover.
    let copyBtnEl: HTMLButtonElement | undefined;
    let copyBtnMarkerId: number | null = null;
    let copyHideTimer: ReturnType<typeof setTimeout> | undefined;

    const clearCopyHide = () => {
      if (copyHideTimer) {
        clearTimeout(copyHideTimer);
        copyHideTimer = undefined;
      }
    };
    const hideCopyBtn = () => {
      clearCopyHide();
      if (copyBtnEl) copyBtnEl.style.display = "none";
      copyBtnMarkerId = null;
    };
    const scheduleHideCopyBtn = () => {
      clearCopyHide();
      copyHideTimer = setTimeout(hideCopyBtn, 160);
    };
    const ensureCopyBtn = () => {
      if (copyBtnEl || !containerRef) return;
      const btn = document.createElement("button");
      btn.className = "lume-block-copy";
      btn.title = t("term.copyBlock");
      btn.textContent = "⎘";
      btn.style.display = "none";
      btn.addEventListener("mouseenter", clearCopyHide);
      btn.addEventListener("mouseleave", scheduleHideCopyBtn);
      btn.addEventListener("mousedown", (e) => e.stopPropagation());
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (copyBtnMarkerId !== null) props.onCopyBlock?.(copyBtnMarkerId);
        btn.classList.add("copied");
        setTimeout(() => btn.classList.remove("copied"), 1000);
      });
      containerRef.appendChild(btn);
      copyBtnEl = btn;
    };

    // The block containing an absolute buffer row = the prompt marker with the
    // greatest line still at or above that row.
    const blockMarkerAtRow = (
      absRow: number
    ): { id: number; line: number } | null => {
      let best: { id: number; line: number } | null = null;
      for (const [id, marker] of markers) {
        if (marker.isDisposed) continue;
        const line = marker.line;
        if (line <= absRow && (!best || line > best.line)) {
          best = { id, line };
        }
      }
      return best;
    };

    const onHostMove = (e: MouseEvent) => {
      // Button held = selection drag in progress: a hover affordance is
      // pointless and this handler's layout reads would interleave with
      // xterm's per-frame selection redraws.
      if (e.buttons & 1) {
        hideCopyBtn();
        return;
      }
      if (!term || !containerRef || markers.size === 0) {
        hideCopyBtn();
        return;
      }
      const rect = containerRef.getBoundingClientRect();
      const { h: cellH } = cellSize();
      if (cellH <= 0) return;
      const viewTop = term.buffer.active.viewportY;
      const absRow = viewTop + Math.floor((e.clientY - rect.top) / cellH);
      const block = blockMarkerAtRow(absRow);
      // No block under the cursor, or the block has no command yet (bare prompt)
      // → no copy affordance.
      if (!block || !(props.canCopyMarker?.(block.id) ?? true)) {
        scheduleHideCopyBtn();
        return;
      }
      clearCopyHide();
      ensureCopyBtn();
      if (!copyBtnEl) return;
      copyBtnMarkerId = block.id;
      const top = (block.line - viewTop) * cellH + 2;
      copyBtnEl.style.top = `${Math.max(2, top)}px`;
      copyBtnEl.style.display = "";
    };

    containerRef.addEventListener("mousemove", onHostMove);
    containerRef.addEventListener("mouseleave", scheduleHideCopyBtn);
    const copyScrollSub = term.onScroll(() => hideCopyBtn());
    addCleanup(() => {
      containerRef?.removeEventListener("mousemove", onHostMove);
      containerRef?.removeEventListener("mouseleave", scheduleHideCopyBtn);
      copyScrollSub.dispose();
      clearCopyHide();
    });

    const refit = () => {
      if (!fit || !term || !containerRef) return;
      const rect = containerRef.getBoundingClientRect();
      // Skip when the container is hidden (display:none parent) — fit would
      // either error or shrink the terminal to 0x0 and break the renderer.
      if (rect.width <= 0 || rect.height <= 0) return;
      try {
        fit.fit();
      } catch {
        // ignore
      }
    };

    const refitAndRefresh = () => {
      refit();
      // Force xterm to re-render its viewport. Without this, the WebGL canvas
      // can stay blank after the container becomes visible again — the GPU
      // never received a draw call while we were display:none.
      try {
        if (term) term.refresh(0, term.rows - 1);
      } catch {}
    };

    props.onRefreshReady?.(refitAndRefresh);

    // rAF-throttle: drag-resizing the sidebar fires container resizes at
    // ~60 Hz. Coalesce to one fit per frame. We DO refit even when the pane
    // isn't the active one — because in a split layout, all panes within the
    // active tab are visible simultaneously and each needs its own fit when
    // its container shrinks/grows after a split.
    let rafPending = 0;
    const scheduleRefit = () => {
      if (rafPending) return;
      rafPending = requestAnimationFrame(() => {
        rafPending = 0;
        refit();
      });
    };
    const ro = new ResizeObserver(scheduleRefit);
    ro.observe(containerRef);
    addCleanup(() => {
      ro.disconnect();
      if (rafPending) cancelAnimationFrame(rafPending);
    });

    if (props.active()) term.focus();
  });

  // Live-apply appearance changes from Settings. Reading every field (incl. all
  // theme colors via toXtermTheme) up front registers the reactive deps even on
  // the first run before `term` exists, so later changes always re-run this.
  createEffect(() => {
    const a = props.appearance;
    const next = {
      fontFamily: withFallbacks(a.fontFamily),
      fontSize: a.fontSize,
      cursorBlink: a.cursorBlink,
      cursorStyle: a.cursorStyle,
      scrollback: a.scrollback,
      theme: toXtermTheme(a.theme),
    };
    if (!term) return;
    term.options.fontFamily = next.fontFamily;
    term.options.fontSize = next.fontSize;
    term.options.cursorBlink = next.cursorBlink;
    term.options.cursorStyle = next.cursorStyle;
    term.options.scrollback = next.scrollback;
    term.options.theme = next.theme;
    // Font metrics changed → refit + repaint.
    requestAnimationFrame(() => {
      if (!term || !fit || !containerRef) return;
      const rect = containerRef.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      try {
        fit.fit();
        term.refresh(0, term.rows - 1);
      } catch {}
    });
  });

  createEffect(() => {
    if (!props.active()) {
      closeAcRef?.();
      if (searchOpen()) closeSearchBar();
      return;
    }
    if (!term || !fit) return;
    // rAF (not microtask) so flex/display changes from the parent get laid
    // out before we measure the container. queueMicrotask runs before layout.
    requestAnimationFrame(() => {
      if (!term || !fit || !containerRef) return;
      try {
        const rect = containerRef.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          fit.fit();
          term.refresh(0, term.rows - 1);
        }
        term.focus();
      } catch {}
    });
  });

  onCleanup(() => {
    unlistenOutput?.();
    unlistenExit?.();
    unlistenBlock?.();
    unlistenCwd?.();
    unlistenAliases?.();
    markers.clear();
    if (ptyId !== undefined) {
      invoke("pty_kill", { id: ptyId }).catch(() => {});
    }
    term?.dispose();
  });

  return (
    <>
      {/* terminal-host stays pristine — xterm owns it exclusively, no Solid
          children, so the WebGL canvas is never disturbed. The popup floats in
          a Portal (document.body) and is positioned `fixed` at screen coords. */}
      <div ref={containerRef} class="terminal-host" />
      <Show when={acOpen()}>
        <Portal>
          <Autocomplete
            items={acItems}
            index={acIndex}
            pos={acPos}
            onHover={setAcIndex}
            onPick={(i) => {
              setAcIndex(i);
              acceptAcRef?.();
            }}
          />
        </Portal>
      </Show>
      <Show when={searchOpen()}>
        <Portal>
          <div
            class="term-search"
            style={{
              top: `${searchPos().top}px`,
              right: `${searchPos().right}px`,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <input
              ref={searchInputRef}
              class="term-search-input"
              type="text"
              placeholder={t("search.placeholder")}
              value={searchQuery()}
              onInput={(e) => {
                setSearchQuery(e.currentTarget.value);
                runSearch(true);
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  e.preventDefault();
                  runSearch(!e.shiftKey);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  closeSearchBar();
                }
              }}
            />
            <span class="term-search-count">
              {searchResults().count
                ? `${searchResults().index}/${searchResults().count}`
                : searchQuery()
                ? "0/0"
                : ""}
            </span>
            <button
              class="term-search-btn"
              title={t("search.prevTitle")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runSearch(false)}
            >
              ↑
            </button>
            <button
              class="term-search-btn"
              title={t("search.nextTitle")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runSearch(true)}
            >
              ↓
            </button>
            <button
              class="term-search-btn"
              title={t("search.closeTitle")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={closeSearchBar}
            >
              ✕
            </button>
          </div>
        </Portal>
      </Show>
    </>
  );
}
