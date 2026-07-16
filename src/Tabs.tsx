import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { createStore, reconcile, unwrap } from "solid-js/store";
import BlocksPanel from "./BlocksPanel";
import PaneNode from "./PaneNode";
import PortableTerminal from "./PortableTerminal";
import {
  loadConfig,
  saveConfig,
  DEFAULT_CONFIG,
  type Config,
} from "./config";
import Settings from "./Settings";
import type { Block, PtyBlock } from "./blocks";
import { b64ToString, stripAnsi } from "./blocks";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  aiCancel,
  aiChat,
  aiExplainBlock,
  aiStatus,
  type AiChunkEvent,
  type AiDoneEvent,
  type AiErrorEvent,
  type AiStatus,
  type ChatMessage,
} from "./ai";
import { invoke } from "@tauri-apps/api/core";
import CommandPalette from "./CommandPalette";
import WorkflowsPalette from "./WorkflowsPalette";
import SshPalette from "./SshPalette";
import { sshCommand } from "./ssh";
import { loadCustomFonts } from "./fonts";
import { copyText, pasteText } from "./clipboard";
import {
  remoteInstallCloudflared,
  remoteSetTabs,
  remoteSetTarget,
  remoteStart,
  remoteStatus,
  remoteStop,
  type RemoteInfo,
} from "./remote";
import FileTree from "./FileTree";
import RemoteDialog from "./RemoteDialog";
import UpdateBanner from "./UpdateBanner";
import { setLocale, t } from "./i18n";
import {
  IconBlocks,
  IconChevronLeft,
  IconChevronRight,
  IconFolder,
  IconLayouts,
  IconSettings,
  IconSmartphone,
  IconSsh,
  IconWorkflow,
} from "./icons";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { homeDir } from "@tauri-apps/api/path";
import {
  ACTIONS,
  comboToAction,
  eventToCombo,
  resolveBindings,
  type ActionId,
} from "./keybindings";
import {
  leafIds,
  makeLeaf,
  makeLeafWithId,
  makeSplit,
  paneCounters,
  removeLeaf,
  seedPaneCounters,
  setSplitRatio,
  splitAt,
  type LeafData,
  type TreeNode,
} from "./panes";
import { recordCommand } from "./suggestions";

type TabState = {
  id: number;
  title: string;
  tree: TreeNode;
  leaves: Record<number, LeafData>;
  activeLeafId: number;
  /** When set, OSC 7 cwd updates don't rewrite the tab title — used for SSH
   *  tabs whose title is the host (the local shell's cwd is irrelevant, and the
   *  remote shell won't emit OSC 7). */
  lockTitle?: boolean;
};

let nextTabId = 0;

const MAX_PANES_PER_TAB = 4;
/** Cap on command blocks kept per pane — bounds memory on long-lived sessions. */
const MAX_BLOCKS_PER_LEAF = 1000;

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6) || "000000", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
/** Mix two hex colors: t=0 → a, t=1 → b. */
function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

// Drive the whole app chrome from the active theme so light themes look
// consistent (tab bar, sidebar, settings, borders, dimmed text), not just the
// terminal. `--*-rgb` feed the rgba() tints across the CSS.
function applyCssVars(cfg: Config) {
  const t = cfg.appearance.theme;
  const root = document.documentElement.style;
  const { background: bg, foreground: fg, accent } = t;
  root.setProperty("--bg", bg);
  root.setProperty("--fg", fg);
  root.setProperty("--accent", accent);
  root.setProperty("--bg-soft", mix(bg, fg, 0.06));
  root.setProperty("--border", mix(bg, fg, 0.16));
  root.setProperty("--fg-dim", mix(fg, bg, 0.42));
  root.setProperty("--accent-rgb", hexToRgb(accent).join(", "));
  // Hover/overlay: light overlay on dark themes, dark overlay on light ones.
  root.setProperty(
    "--hover-rgb",
    luminance(bg) < 0.5 ? "255, 255, 255" : "0, 0, 0"
  );
}

type PersistedLeaf = { id: number; cwd: string | null };
type PersistedTab = {
  id: number;
  title: string;
  lockTitle: boolean;
  tree: TreeNode;
  activeLeafId: number;
  leaves: PersistedLeaf[];
};
type PersistedSession = {
  version: number;
  activeId: number;
  nextLeafId: number;
  nextSplitId: number;
  nextTabId: number;
  tabs: PersistedTab[];
};

const SESSION_KEY = "lume.session.v2";

/** Rebuild the full tab/pane state from a persisted session, or null if there's
 *  nothing valid to restore. Restores tree structure (split ratios, layout),
 *  titles, manual-rename lock, and each pane's last cwd. */
function loadSession(): { tabs: TabState[]; activeId: number } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PersistedSession;
    if (!data || !Array.isArray(data.tabs) || data.tabs.length === 0) return null;

    seedPaneCounters(data.nextLeafId ?? 0, data.nextSplitId ?? 0);
    if (Number.isFinite(data.nextTabId)) nextTabId = data.nextTabId;

    const tabs: TabState[] = [];
    for (const pt of data.tabs) {
      if (!pt || !pt.tree) continue;
      const ids = leafIds(pt.tree);
      if (ids.length === 0) continue;
      const cwdById = new Map(
        (pt.leaves ?? []).map((l) => [l.id, l.cwd ?? null] as const)
      );
      const leaves: Record<number, LeafData> = {};
      for (const lid of ids) {
        leaves[lid] = makeLeafWithId(lid, cwdById.get(lid) ?? null);
      }
      tabs.push({
        id: pt.id,
        title: pt.title || "Shell",
        lockTitle: !!pt.lockTitle,
        tree: pt.tree,
        leaves,
        activeLeafId: ids.includes(pt.activeLeafId) ? pt.activeLeafId : ids[0],
      });
    }
    if (tabs.length === 0) return null;

    // Make sure new tab ids won't collide with restored ones.
    const maxTabId = tabs.reduce((m, t) => Math.max(m, t.id), 0);
    if (nextTabId <= maxTabId) nextTabId = maxTabId + 1;

    const activeId = tabs.some((t) => t.id === data.activeId)
      ? data.activeId
      : tabs[0].id;
    return { tabs, activeId };
  } catch {
    return null;
  }
}

// User home dir (to abbreviate cwd → ~ in tab titles), resolved once at load.
let _userHome = "";
const userHome = () => _userHome;
homeDir()
  .then((h) => (_userHome = h.replace(/\/$/, "")))
  .catch(() => {});

function makeEmptyTab(): TabState {
  const leaf = makeLeaf();
  return {
    id: nextTabId++,
    title: "Shell",
    tree: { type: "leaf", leafId: leaf.id },
    leaves: { [leaf.id]: leaf },
    activeLeafId: leaf.id,
  };
}

export default function Tabs() {
  const [config, setConfig] = createStore<Config>(
    JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as Config
  );
  const [configReady, setConfigReady] = createSignal(false);
  loadConfig()
    .then((c) => setConfig(reconcile(c)))
    .catch((e) => console.error("load config", e))
    .finally(() => setConfigReady(true));

  let cfgSaveTimer: ReturnType<typeof setTimeout> | null = null;
  const persistConfig = () => {
    if (cfgSaveTimer) clearTimeout(cfgSaveTimer);
    cfgSaveTimer = setTimeout(() => {
      saveConfig(unwrap(config)).catch((e) => console.error("save config", e));
    }, 400);
  };

  const adjustFontSize = (delta: number) => {
    const next = Math.max(
      8,
      Math.min(40, config.appearance.fontSize + delta)
    );
    setConfig("appearance", "fontSize", next);
    persistConfig();
  };
  const resetFontSize = () => {
    setConfig("appearance", "fontSize", DEFAULT_CONFIG.appearance.fontSize);
    persistConfig();
  };

  const [settingsOpen, setSettingsOpen] = createSignal(false);
  // Action currently being rebound in Settings (waiting for a key combo).
  const [recordingAction, setRecordingAction] = createSignal<ActionId | null>(
    null
  );
  const [ai, { refetch: refetchAi }] = createResource<AiStatus>(aiStatus);
  // Human-facing name of the active AI provider (for the blocks panel / labels).
  const aiProviderLabel = () => {
    const p = ai()?.provider;
    return p === "codex" ? "Codex" : p === "custom" ? "AI" : "Claude";
  };

  const restored = loadSession();
  const initialTabs: TabState[] = restored?.tabs ?? [makeEmptyTab()];
  const [tabs, setTabs] = createStore<TabState[]>(initialTabs);
  const [activeId, setActiveId] = createSignal(
    restored?.activeId ?? initialTabs[0].id
  );
  const [panelVisible, setPanelVisible] = createSignal(
    localStorage.getItem("lume.panelVisible") !== "0"
  );
  createEffect(() => {
    try {
      localStorage.setItem("lume.panelVisible", panelVisible() ? "1" : "0");
    } catch {}
  });
  // Left file-tree sidebar (shows the active pane's cwd tree).
  const [fileTreeVisible, setFileTreeVisible] = createSignal(
    localStorage.getItem("lume.fileTreeVisible") === "1"
  );
  createEffect(() => {
    try {
      localStorage.setItem(
        "lume.fileTreeVisible",
        fileTreeVisible() ? "1" : "0"
      );
    } catch {}
  });
  const ftWidthRaw = Number(localStorage.getItem("lume.fileTreeWidth"));
  const [fileTreeWidth, setFileTreeWidth] = createSignal(
    Number.isFinite(ftWidthRaw) && ftWidthRaw >= 180 ? ftWidthRaw : 240
  );
  createEffect(() => {
    const w = fileTreeWidth();
    try {
      if (w) localStorage.setItem("lume.fileTreeWidth", String(w));
    } catch {}
  });
  const [paletteOpen, setPaletteOpen] = createSignal(false);
  const [workflowsOpen, setWorkflowsOpen] = createSignal(false);
  const [sshOpen, setSshOpen] = createSignal(false);
  const [blockNavMode, setBlockNavMode] = createSignal(false);
  // True once any OSC 133 block event has been seen (this session or a past
  // one, persisted). Confirms shell integration works → the blocks panel drops
  // its setup instructions for a neutral empty state.
  const [oscSeen, setOscSeen] = createSignal(
    localStorage.getItem("lume.osc133Seen") === "1"
  );
  const markOscSeen = () => {
    if (oscSeen()) return;
    setOscSeen(true);
    try {
      localStorage.setItem("lume.osc133Seen", "1");
    } catch {}
  };
  const [searchOpen, setSearchOpen] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [tabCtxMenu, setTabCtxMenu] = createSignal<
    { x: number; y: number; tabId: number } | null
  >(null);
  /** Set while the user is dragging a tab. Pane components use this to show
   *  a transparent drop-catcher overlay above their xterm so the drop event
   *  isn't swallowed by xterm's own handlers. */
  const [draggingTabId, setDraggingTabId] = createSignal<number | null>(null);

  // Tab strip horizontal scroll state → drives the left/right "hidden tabs"
  // chevron indicators (the native scrollbar is hidden as it overlaps tabs).
  let tabListRef: HTMLDivElement | undefined;
  const [tabScroll, setTabScroll] = createSignal({ left: false, right: false });
  const updateTabScroll = () => {
    const el = tabListRef;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    const cur = tabScroll();
    if (cur.left !== left || cur.right !== right) setTabScroll({ left, right });
  };
  const scrollTabs = (dir: -1 | 1) =>
    tabListRef?.scrollBy({ left: dir * 220, behavior: "smooth" });
  // Recompute indicators when the tab set changes (rAF so layout has settled).
  createEffect(() => {
    tabs.length;
    requestAnimationFrame(updateTabScroll);
  });
  onMount(() => {
    const onResize = () => updateTabScroll();
    window.addEventListener("resize", onResize);
    onCleanup(() => window.removeEventListener("resize", onResize));
    requestAnimationFrame(updateTabScroll);
  });

  /** Set while the user is dragging a pane grip. Drives the swap-target
   *  overlay on every other pane in the same tab. */
  const [draggingPaneLeafId, setDraggingPaneLeafId] = createSignal<
    number | null
  >(null);
  /** Hover state during a tab-on-tab reorder drag: which tab we're over and
   *  whether the cursor is on the left or right half. Drives the insertion
   *  indicator and the final drop index. */
  const [reorderHover, setReorderHover] = createSignal<
    { idx: number; side: "before" | "after" } | null
  >(null);
  const [paneCtxMenu, setPaneCtxMenu] = createSignal<
    { x: number; y: number; leafId: number } | null
  >(null);
  /** Tab being renamed inline (double-click), with its draft title. */
  const [editingTabId, setEditingTabId] = createSignal<number | null>(null);
  const [editingTitle, setEditingTitle] = createSignal("");
  const [layoutsOpen, setLayoutsOpen] = createSignal(false);

  // Native grid (Linux): terminal pixels are painted by a native layer above
  // the webview, so DOM overlays that can cover a pane must make the grids
  // yield. Broadcast "some app-level overlay is open" to the Terminals.
  createEffect(() => {
    const open =
      settingsOpen() ||
      paletteOpen() ||
      workflowsOpen() ||
      sshOpen() ||
      layoutsOpen() ||
      // Tab/pane drags paint drop zones and swap targets across the panes:
      // yield the whole grid layer for the duration of the drag.
      draggingTabId() !== null ||
      draggingPaneLeafId() !== null ||
      remoteDialogOpen();
    document.body.classList.toggle("lume-overlay-open", open);
    window.dispatchEvent(new Event("lume-overlay-change"));
  });

  // Window resizes re-layout every pane continuously: same treatment as a
  // split drag — yield the grids until the size settles.
  {
    let resizeSettle: ReturnType<typeof setTimeout> | undefined;
    const onWinResize = () => {
      document.body.classList.add("lume-split-drag");
      window.dispatchEvent(new Event("lume-overlay-change"));
      if (resizeSettle) clearTimeout(resizeSettle);
      resizeSettle = setTimeout(() => {
        document.body.classList.remove("lume-split-drag");
        window.dispatchEvent(new Event("lume-overlay-change"));
      }, 250);
    };
    window.addEventListener("resize", onWinResize);
    onCleanup(() => {
      window.removeEventListener("resize", onWinResize);
      if (resizeSettle) clearTimeout(resizeSettle);
    });
  }

  // Native grid (Linux): small DOM affordances that pop up OVER a pane (drag
  // grip, per-block copy button, context menus, block flash) must stay
  // visible above the native layer. Report their on-screen rects so the grid
  // leaves those pixels unpainted — generic: add the class of any future
  // pane-covering affordance to the selector.
  if (navigator.userAgent.includes("Linux")) {
    const OVERLAY_SEL =
      ".pane-grip, .lume-block-copy, .block-context-menu, .tab-context-menu, .pane-context-menu, .lume-block-flash";
    let lastRects = "";
    let overlayRaf = 0;
    const syncOverlayRects = () => {
      if (overlayRaf) return;
      overlayRaf = requestAnimationFrame(() => {
        overlayRaf = 0;
        const rects: number[][] = [];
        document.querySelectorAll<HTMLElement>(OVERLAY_SEL).forEach((el) => {
          const cs = getComputedStyle(el);
          if (
            cs.display === "none" ||
            cs.visibility === "hidden" ||
            parseFloat(cs.opacity) < 0.05
          )
            return;
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0)
            rects.push([
              Math.floor(r.left),
              Math.floor(r.top),
              Math.ceil(r.width),
              Math.ceil(r.height),
            ]);
        });
        const key = JSON.stringify(rects);
        if (key !== lastRects) {
          lastRects = key;
          invoke("native_grid_set_overlay_rects", { rects }).catch(() => {});
        }
      });
    };
    document.addEventListener("mousemove", syncOverlayRects, {
      passive: true,
    });
    document.addEventListener("mousedown", syncOverlayRects, true);
    document.addEventListener("mouseup", syncOverlayRects, true);
    // Safety net for non-mouse triggers (keyboard-opened menus, animations).
    const overlayPoll = setInterval(syncOverlayRects, 300);
    onCleanup(() => {
      document.removeEventListener("mousemove", syncOverlayRects);
      document.removeEventListener("mousedown", syncOverlayRects, true);
      document.removeEventListener("mouseup", syncOverlayRects, true);
      clearInterval(overlayPoll);
      if (overlayRaf) cancelAnimationFrame(overlayRaf);
    });
  }
  const [toast, setToast] = createSignal<string | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  const flashToast = (msg: string) => {
    setToast(msg);
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => setToast(null), 2200);
  };

  const tabPaneCount = (tabId: number): number => {
    const tab = tabs.find((t) => t.id === tabId);
    return tab ? leafIds(tab.tree).length : 0;
  };

  const canSplitTab = (tabId: number): boolean => {
    return tabPaneCount(tabId) < MAX_PANES_PER_TAB;
  };

  const isActiveTabId = (id: number) => activeId() === id;
  const tabIndex = (id: number) => tabs.findIndex((t) => t.id === id);
  const activeTab = () => tabs.find((t) => t.id === activeId());
  const activeLeaf = (): LeafData | null => {
    const t = activeTab();
    if (!t) return null;
    return t.leaves[t.activeLeafId] ?? null;
  };

  // A "real" block is one that ran an actual command. Bare prompts (Enter on an
  // empty line → command "" / null) are noise and never shown or navigated.
  const hasCommand = (b: Block) => (b.command ?? "").trim() !== "";

  const visibleBlocks = createMemo(() => {
    const leaf = activeLeaf();
    if (!leaf) return [];
    const real = leaf.blocks.filter(hasCommand);
    const q = searchQuery().trim().toLowerCase();
    if (!q) return real;
    return real.filter((b) => (b.command ?? "").toLowerCase().includes(q));
  });

  const initialWidth = (() => {
    const raw = Number(localStorage.getItem("lume.panelWidth"));
    return Number.isFinite(raw) && raw >= 240 && raw <= 900 ? raw : 360;
  })();
  const [panelWidth, setPanelWidth] = createSignal(initialWidth);
  let widthSaveTimer: ReturnType<typeof setTimeout> | null = null;
  createEffect(() => {
    const w = panelWidth();
    if (widthSaveTimer) clearTimeout(widthSaveTimer);
    widthSaveTimer = setTimeout(() => {
      localStorage.setItem("lume.panelWidth", String(w));
      widthSaveTimer = null;
    }, 250);
  });

  // Find a block by (tabIdx, leafId, blockIdx) given a streaming ai requestId.
  const findBlockByRequest = (
    requestId: number
  ): { tabIdx: number; leafId: number; blockIdx: number } | null => {
    for (let i = 0; i < tabs.length; i++) {
      const leaves = tabs[i].leaves;
      for (const key of Object.keys(leaves)) {
        const leafId = Number(key);
        const blocks = leaves[leafId].blocks;
        for (let j = 0; j < blocks.length; j++) {
          if (blocks[j].ai?.requestId === requestId) {
            return { tabIdx: i, leafId, blockIdx: j };
          }
        }
      }
    }
    return null;
  };

  const explainBlock = async (
    tabId: number,
    leafId: number,
    blockId: number
  ) => {
    const tIdx = tabIndex(tabId);
    if (tIdx === -1) return;
    const leaf = tabs[tIdx].leaves[leafId];
    if (!leaf) return;
    const bIdx = leaf.blocks.findIndex((b) => b.id === blockId);
    if (bIdx === -1) return;
    const block = leaf.blocks[bIdx];
    if (!block.command) return;

    const existing = block.ai;
    if (
      existing &&
      existing.status === "streaming" &&
      existing.requestId !== null
    ) {
      try {
        await aiCancel(existing.requestId);
      } catch {}
    }

    setTabs(tIdx, "leaves", leafId, "blocks", bIdx, "ai", {
      status: "streaming",
      response: "",
      requestId: null,
      error: null,
      history: [],
    });

    try {
      const requestId = await aiExplainBlock({
        command: block.command,
        output: block.output,
        exitCode: block.exitCode ?? 0,
      });
      setTabs(tIdx, "leaves", leafId, "blocks", bIdx, "ai", "requestId", requestId);
    } catch (e) {
      setTabs(tIdx, "leaves", leafId, "blocks", bIdx, "ai", {
        status: "error",
        error: String(e),
      });
    }
  };

  const followUpBlock = async (
    tabId: number,
    leafId: number,
    blockId: number,
    question: string
  ) => {
    if (!question.trim()) return;
    const tIdx = tabIndex(tabId);
    if (tIdx === -1) return;
    const leaf = tabs[tIdx].leaves[leafId];
    if (!leaf) return;
    const bIdx = leaf.blocks.findIndex((b) => b.id === blockId);
    if (bIdx === -1) return;
    const block = leaf.blocks[bIdx];
    const existingAi = block.ai;
    if (!existingAi || existingAi.status === "streaming") return;

    const seed: ChatMessage = {
      role: "user",
      content: [
        t("ai.seedHeader"),
        `${t("ai.seedCommand")}${block.command ?? ""}`,
        block.output ? `${t("ai.seedOutput")}\n${block.output}` : "",
        `${t("ai.seedExitCode")}${block.exitCode ?? 0}`,
        "",
        t("ai.seedAsk"),
      ]
        .filter(Boolean)
        .join("\n"),
    };

    const history: ChatMessage[] = [...existingAi.history];
    if (
      existingAi.status === "done" &&
      existingAi.response.trim() &&
      (history.length === 0 ||
        history[history.length - 1].role !== "assistant" ||
        history[history.length - 1].content !== existingAi.response)
    ) {
      history.push({ role: "assistant", content: existingAi.response });
    }

    const messages: ChatMessage[] = [
      seed,
      ...history,
      { role: "user", content: question.trim() },
    ];

    setTabs(tIdx, "leaves", leafId, "blocks", bIdx, "ai", {
      status: "streaming",
      response: "",
      requestId: null,
      error: null,
      history: [...history, { role: "user", content: question.trim() }],
    });

    try {
      const requestId = await aiChat(messages);
      setTabs(tIdx, "leaves", leafId, "blocks", bIdx, "ai", "requestId", requestId);
    } catch (e) {
      setTabs(tIdx, "leaves", leafId, "blocks", bIdx, "ai", {
        status: "error",
        error: String(e),
      });
    }
  };

  const cancelBlockAi = async (
    tabId: number,
    leafId: number,
    blockId: number
  ) => {
    const tIdx = tabIndex(tabId);
    if (tIdx === -1) return;
    const leaf = tabs[tIdx].leaves[leafId];
    if (!leaf) return;
    const bIdx = leaf.blocks.findIndex((b) => b.id === blockId);
    if (bIdx === -1) return;
    const ai = leaf.blocks[bIdx].ai;
    if (ai?.requestId !== null && ai?.requestId !== undefined) {
      try {
        await aiCancel(ai.requestId);
      } catch {}
    }
    setTabs(tIdx, "leaves", leafId, "blocks", bIdx, "ai", null);
  };

  // Per-leaf focus/scroll/refresh callbacks, registered by each Terminal on mount.
  const leafFocusFns = new Map<number, () => void>();
  const leafSelectionFns = new Map<number, () => string>();
  const leafSearchFns = new Map<number, () => void>();

  // Desktop notification when a long command finishes while Lume is in the
  // background. Run-start time is tracked per leaf (output start → output end).
  // Uses the Tauri notification plugin (the Web Notification API is unreliable
  // under WebKitGTK). Toggle + threshold live in config.notifications.
  const commandRunStart = new Map<number, number>();

  // `document.hasFocus()` is unreliable under WebKitGTK, so track focus from
  // Tauri's native window events (driven by the window manager), with DOM
  // focus/blur as a backup.
  let windowFocused = true;
  window.addEventListener("focus", () => (windowFocused = true));
  window.addEventListener("blur", () => (windowFocused = false));
  void getCurrentWindow()
    .onFocusChanged(({ payload }) => (windowFocused = payload))
    .catch(() => {});

  // Send via our own Rust `notify` command (the bundled plugin's Linux path
  // silently fails — it runs notify-rust's blocking show() inside tokio).
  const sendNotify = (title: string, body: string) =>
    invoke("notify", {
      title,
      body,
      sound: config.notifications.sound,
    }).catch((e) => console.error("[notif] send failed", e));

  // Manual test from devtools: `__lumeTestNotif()`. Waits 3s so you can click
  // another window first — GNOME may suppress banners from the *focused* app,
  // which is exactly the real (unfocused) scenario.
  let testNotifN = 0;
  (window as unknown as { __lumeTestNotif: () => void }).__lumeTestNotif =
    async () => {
      testNotifN++;
      console.info(
        "[notif] clique une AUTRE fenêtre maintenant — envoi dans 3s…"
      );
      await new Promise((r) => setTimeout(r, 3000));
      try {
        await invoke("notify", {
          title: `🔔 Test Lume #${testNotifN}`,
          body: `Notification n°${testNotifN} — ${new Date().toLocaleTimeString()}`,
          sound: config.notifications.sound,
        });
        console.info("[notif] invoke resolved OK (no error from Rust)");
      } catch (e) {
        console.error("[notif] invoke REJECTED:", e);
      }
    };

  const notifyCommandDone = (
    command: string | null,
    exitCode: number | null,
    durationMs: number
  ) => {
    if (!config.notifications.enabled) return;
    const thresholdMs =
      Math.max(0, config.notifications.minDurationSec ?? 10) * 1000;
    if (durationMs < thresholdMs || windowFocused) return;
    const ok = exitCode === 0 || exitCode === null;
    // Include the finish time so two identical commands still each banner
    // (GNOME coalesces notifications with identical content).
    void sendNotify(
      ok ? t("notif.cmdDone") : t("notif.cmdFailed", { code: exitCode ?? "?" }),
      `${(command ?? "").slice(0, 100)} · ${Math.round(
        durationMs / 1000
      )}s · ${new Date().toLocaleTimeString()}`
    );
  };
  const leafScrollFns = new Map<
    number,
    (startMarkerId: number, endMarkerIdHint: number | null) => void
  >();
  const leafRefreshFns = new Map<number, () => void>();

  // Register imported custom fonts at startup so a saved custom `fontFamily`
  // renders; re-fit terminals once they're available (font metrics change).
  loadCustomFonts()
    .then((fams) => {
      if (!fams.length) return;
      requestAnimationFrame(() => {
        for (const fn of leafRefreshFns.values()) fn();
      });
    })
    .catch(() => {});

  const focusActiveTerminal = () => {
    const leaf = activeLeaf();
    if (!leaf) return;
    leafFocusFns.get(leaf.id)?.();
  };

  const attachMarkerToLatestBlock = (leafId: number, markerId: number) => {
    // Find the tab that owns this leaf.
    for (let i = 0; i < tabs.length; i++) {
      const leaf = tabs[i].leaves[leafId];
      if (!leaf) continue;
      for (let j = 0; j < leaf.blocks.length; j++) {
        if (leaf.blocks[j].markerId === null) {
          setTabs(i, "leaves", leafId, "blocks", j, "markerId", markerId);
          return;
        }
      }
      return;
    }
  };

  const scrollToBlock = (blockId: number) => {
    const tab = activeTab();
    if (!tab) return;
    const leaf = activeLeaf();
    if (!leaf) return;
    const blocks = leaf.blocks;
    const idx = blocks.findIndex((b) => b.id === blockId);
    if (idx === -1) return;
    const block = blocks[idx];
    if (block.markerId === null) return;

    let nextMarkerId: number | null = null;
    for (let j = idx + 1; j < blocks.length; j++) {
      if (blocks[j].markerId !== null) {
        nextMarkerId = blocks[j].markerId;
        break;
      }
    }
    leafScrollFns.get(leaf.id)?.(block.markerId, nextMarkerId);
  };

  const ptyWriteText = (ptyId: number, text: string) => {
    const bytes = new TextEncoder().encode(text);
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode(
        ...bytes.subarray(i, Math.min(i + chunk, bytes.length))
      );
    }
    invoke("pty_write", { id: ptyId, dataB64: btoa(bin) }).catch(console.error);
  };

  /** Open a new tab whose freshly-spawned shell immediately runs `command`
   *  (written once the PTY exists, via the leaf's pendingInput). */
  const openCommandInNewTab = (title: string, command: string) => {
    const leaf = makeLeaf();
    leaf.pendingInput = command.endsWith("\n") ? command : command + "\n";
    const tab: TabState = {
      id: nextTabId++,
      title,
      tree: { type: "leaf", leafId: leaf.id },
      leaves: { [leaf.id]: leaf },
      activeLeafId: leaf.id,
      lockTitle: true,
    };
    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
  };

  // Apply the UI language from config (reactive — switching re-renders).
  createEffect(() => setLocale(config.language || "en"));
  // Re-check AI availability when the active provider changes (claude → codex →
  // custom), so the palette/blocks enable/disable for the newly selected CLI.
  createEffect(() => {
    config.ai?.provider;
    config.ai?.customCommand;
    refetchAi();
  });

  // Publish the tab list to remote clients so the phone can switch terminals.
  // The phone picks its own target (decoupled from the desktop's focus); the
  // initial target is set when remote control starts.
  createEffect(() => {
    const list = tabs
      .map((t) => ({ id: t.leaves[t.activeLeafId]?.ptyId, title: t.title }))
      .filter((t): t is { id: number; title: string } => typeof t.id === "number");
    void remoteSetTabs(list).catch(() => {});
  });
  // When the phone taps "+", switch the remote to the new tab once its pty
  // spawns (a freshly-created leaf has ptyId === null for a moment).
  const [remoteFocusTabId, setRemoteFocusTabId] = createSignal<number | null>(
    null
  );
  createEffect(() => {
    const tid = remoteFocusTabId();
    if (tid === null) return;
    const tab = tabs.find((t) => t.id === tid);
    const pid = tab?.leaves[tab.activeLeafId]?.ptyId;
    if (typeof pid === "number") {
      void remoteSetTarget(pid).catch(() => {});
      setRemoteFocusTabId(null);
    }
  });

  // Remote-control dialog (opened from the pane context menu, not Settings).
  const [remoteDialogOpen, setRemoteDialogOpen] = createSignal(false);
  const [remoteInfo, setRemoteInfo] = createSignal<RemoteInfo | null>(null);
  let remotePollTimer: ReturnType<typeof setInterval> | undefined;
  const stopRemotePoll = () => {
    if (remotePollTimer) clearInterval(remotePollTimer);
    remotePollTimer = undefined;
  };
  // Live refresh of the connected-clients count + tunnel URL while running.
  const refreshRemote = async () => {
    try {
      const s = await remoteStatus();
      setRemoteInfo(s);
      if (!s.running) stopRemotePoll();
    } catch {
      stopRemotePoll();
    }
  };
  const startRemoteControl = async () => {
    try {
      const status = await remoteStatus();
      const port = Number(localStorage.getItem("lume.remotePort")) || 4530;
      const info = status.running
        ? status
        : await remoteStart(port, status.tunnelAvailable);
      setRemoteInfo(info);
      void remoteSetTarget(activeLeaf()?.ptyId ?? null);
      setRemoteDialogOpen(true);
      if (!remotePollTimer) remotePollTimer = setInterval(refreshRemote, 2000);
    } catch (e) {
      console.error("remote start", e);
    }
  };
  const stopRemoteControl = async () => {
    stopRemotePoll();
    try {
      setRemoteInfo(await remoteStop());
    } catch (e) {
      console.error("remote stop", e);
    }
    setRemoteDialogOpen(false);
  };
  // Install cloudflared then re-arm the remote with a public tunnel.
  const [remoteInstalling, setRemoteInstalling] = createSignal(false);
  const enableTunnel = async () => {
    if (remoteInstalling()) return;
    setRemoteInstalling(true);
    try {
      await remoteInstallCloudflared();
      await remoteStop();
      const port = Number(localStorage.getItem("lume.remotePort")) || 4530;
      const info = await remoteStart(port, true);
      setRemoteInfo(info);
      void remoteSetTarget(activeLeaf()?.ptyId ?? null);
      if (!remotePollTimer) remotePollTimer = setInterval(refreshRemote, 2000);
    } catch (e) {
      console.error("install cloudflared", e);
    } finally {
      setRemoteInstalling(false);
    }
  };
  onCleanup(stopRemotePoll);

  const insertIntoActiveTerminal = async (text: string) => {
    const leaf = activeLeaf();
    if (!leaf || leaf.ptyId === null) return;
    const bytes = new TextEncoder().encode(text);
    const chunk = 0x8000;
    let bin = "";
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode(
        ...bytes.subarray(i, Math.min(i + chunk, bytes.length))
      );
    }
    const dataB64 = btoa(bin);
    try {
      await invoke("pty_write", { id: leaf.ptyId, dataB64 });
      focusActiveTerminal();
    } catch (e) {
      console.error("pty_write failed", e);
    }
  };

  const navigateBlocks = (delta: number) => {
    const tab = activeTab();
    const leaf = activeLeaf();
    if (!tab || !leaf) return;
    const blocks = visibleBlocks();
    if (blocks.length === 0) return;
    const tIdx = tabIndex(tab.id);
    if (tIdx === -1) return;
    if (!panelVisible()) setPanelVisible(true);

    const currentIdx =
      leaf.selectedBlockId !== null
        ? blocks.findIndex((b) => b.id === leaf.selectedBlockId)
        : -1;
    let nextIdx: number;
    if (currentIdx === -1) {
      nextIdx = delta < 0 ? blocks.length - 1 : 0;
    } else {
      nextIdx = Math.max(0, Math.min(blocks.length - 1, currentIdx + delta));
    }
    setTabs(tIdx, "leaves", leaf.id, "selectedBlockId", blocks[nextIdx].id);
  };

  const exitNavMode = (refocusTerminal: boolean) => {
    if (!blockNavMode()) return;
    setBlockNavMode(false);
    const tab = activeTab();
    const leaf = activeLeaf();
    if (tab && leaf) {
      const tIdx = tabIndex(tab.id);
      if (tIdx !== -1)
        setTabs(tIdx, "leaves", leaf.id, "selectedBlockId", null);
    }
    if (refocusTerminal) focusActiveTerminal();
  };

  const insertSelectedBlock = async () => {
    const leaf = activeLeaf();
    if (!leaf || leaf.selectedBlockId === null) return;
    const block = leaf.blocks.find((b) => b.id === leaf.selectedBlockId);
    if (!block?.command) return;
    await insertIntoActiveTerminal(block.command);
    exitNavMode(true);
  };

  const dismissBlockAi = (tabId: number, leafId: number, blockId: number) => {
    const tIdx = tabIndex(tabId);
    if (tIdx === -1) return;
    const leaf = tabs[tIdx].leaves[leafId];
    if (!leaf) return;
    const bIdx = leaf.blocks.findIndex((b) => b.id === blockId);
    if (bIdx === -1) return;
    setTabs(tIdx, "leaves", leafId, "blocks", bIdx, "ai", null);
  };

  const removeBlock = (tabId: number, leafId: number, blockId: number) => {
    const tIdx = tabIndex(tabId);
    if (tIdx === -1) return;
    const leaf = tabs[tIdx].leaves[leafId];
    if (!leaf) return;
    setTabs(tIdx, "leaves", leafId, "blocks", (b) =>
      b.filter((bl) => bl.id !== blockId)
    );
    if (tabs[tIdx].leaves[leafId].selectedBlockId === blockId) {
      setTabs(tIdx, "leaves", leafId, "selectedBlockId", null);
    }
  };

  const addTab = () => {
    const tab = makeEmptyTab();
    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
  };
  // Same as addTab, but flags the new tab so the remote (phone) follows it.
  const addTabFromRemote = () => {
    const tab = makeEmptyTab();
    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
    setRemoteFocusTabId(tab.id);
  };

  // --- Inline tab rename ---

  const startRename = (tabId: number) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;
    setEditingTitle(tab.title);
    setEditingTabId(tabId);
  };

  const commitRename = () => {
    const id = editingTabId();
    if (id === null) return;
    const idx = tabIndex(id);
    const title = editingTitle().trim();
    if (idx !== -1 && title) {
      setTabs(idx, "title", title);
      // Manual rename wins: stop auto-renaming this tab from its cwd.
      setTabs(idx, "lockTitle", true);
    }
    setEditingTabId(null);
  };

  const cancelRename = () => setEditingTabId(null);

  const closeTab = (id: number) => {
    const tab = tabs.find((t) => t.id === id);
    if (tab) {
      // Clean up callback registries for all leaves in this tab.
      for (const key of Object.keys(tab.leaves)) {
        const leafId = Number(key);
        leafFocusFns.delete(leafId);
        leafScrollFns.delete(leafId);
        leafRefreshFns.delete(leafId);
        leafSelectionFns.delete(leafId);
        leafSearchFns.delete(leafId);
      }
    }
    if (tabs.length === 1) {
      // Closing the last terminal quits Lume, like a native terminal
      // (Ctrl+D / `exit` / the tab's × button all funnel here).
      getCurrentWindow().close();
      return;
    }
    const wasActive = activeId() === id;
    const remaining = tabs.filter((t) => t.id !== id);
    setTabs(remaining);
    if (wasActive) {
      setActiveId(remaining[remaining.length - 1].id);
    }
  };

  // --- Pane operations ---

  const focusLeaf = (leafId: number) => {
    const tab = activeTab();
    if (!tab) return;
    const tIdx = tabIndex(tab.id);
    if (tIdx === -1) return;
    setTabs(tIdx, "activeLeafId", leafId);
    leafFocusFns.get(leafId)?.();
  };

  const splitActivePane = (direction: "row" | "column") => {
    const tab = activeTab();
    if (!tab) return;
    if (!canSplitTab(tab.id)) {
      flashToast(`Max ${MAX_PANES_PER_TAB} panes par tab`);
      return;
    }
    const tIdx = tabIndex(tab.id);
    const newLeaf = makeLeaf();
    const newTree = splitAt(
      tab.tree,
      tab.activeLeafId,
      direction,
      newLeaf.id
    );
    setTabs(tIdx, "tree", newTree);
    setTabs(tIdx, "leaves", newLeaf.id, newLeaf);
    setTabs(tIdx, "activeLeafId", newLeaf.id);
  };

  const closeActivePane = () => {
    const tab = activeTab();
    if (!tab) return;
    const ids = leafIds(tab.tree);
    if (ids.length === 1) {
      // Only one pane → behave like closing the tab.
      closeTab(tab.id);
      return;
    }
    const tIdx = tabIndex(tab.id);
    const toClose = tab.activeLeafId;
    const newTree = removeLeaf(tab.tree, toClose);
    if (!newTree) return;

    const remaining: Record<number, LeafData> = {};
    for (const key of Object.keys(tab.leaves)) {
      const lid = Number(key);
      if (lid !== toClose) remaining[lid] = tab.leaves[lid];
    }
    setTabs(tIdx, "tree", newTree);
    setTabs(tIdx, "leaves", remaining);
    const newIds = leafIds(newTree);
    setTabs(tIdx, "activeLeafId", newIds[0]);
    leafFocusFns.delete(toClose);
    leafScrollFns.delete(toClose);
    leafRefreshFns.delete(toClose);
    leafSelectionFns.delete(toClose);
    leafSearchFns.delete(toClose);
  };

  type LayoutKind =
    | "single"
    | "sideBySide"
    | "stacked"
    | "grid2x2"
    | "mainPlusSide"
    | "tripleColumn";

  const applyLayout = (kind: LayoutKind) => {
    const tab = activeTab();
    if (!tab) return;
    const tIdx = tabIndex(tab.id);
    if (tIdx === -1) return;

    // The active leaf is reused as the first slot. With the top-level
    // Terminal pool, its xterm + PTY survive the tree restructure
    // automatically — the PortableTerminal stays mounted and its DOM moves
    // into the new card via createEffect.
    const keeperId = tab.activeLeafId;
    const keeper = tab.leaves[keeperId];
    if (!keeper) return;

    const newLeaves: Record<number, LeafData> = { [keeperId]: keeper };
    const keeperRef: TreeNode = { type: "leaf", leafId: keeperId };
    const mkLeaf = () => {
      const l = makeLeaf();
      newLeaves[l.id] = l;
      return { type: "leaf" as const, leafId: l.id };
    };

    let newTree: TreeNode;
    switch (kind) {
      case "single":
        newTree = keeperRef;
        break;
      case "sideBySide":
        newTree = makeSplit("row", keeperRef, mkLeaf());
        break;
      case "stacked":
        newTree = makeSplit("column", keeperRef, mkLeaf());
        break;
      case "grid2x2": {
        const top = makeSplit("row", keeperRef, mkLeaf());
        const bot = makeSplit("row", mkLeaf(), mkLeaf());
        newTree = makeSplit("column", top, bot);
        break;
      }
      case "mainPlusSide": {
        // Main at ~66%, side (column with 2 stacked) at ~34%.
        const side = makeSplit("column", mkLeaf(), mkLeaf(), 0.5);
        newTree = makeSplit("row", keeperRef, side, 0.66);
        break;
      }
      case "tripleColumn": {
        // Three equal columns: outer split 1/3, inner split 0.5.
        const right = makeSplit("row", mkLeaf(), mkLeaf(), 0.5);
        newTree = makeSplit("row", keeperRef, right, 1 / 3);
        break;
      }
    }

    // Cleanup callback maps for the leaves we're dropping (everything except
    // the keeper).
    for (const key of Object.keys(tab.leaves)) {
      const oldId = Number(key);
      if (oldId === keeperId) continue;
      leafFocusFns.delete(oldId);
      leafScrollFns.delete(oldId);
      leafRefreshFns.delete(oldId);
      leafSelectionFns.delete(oldId);
      leafSearchFns.delete(oldId);
    }

    setTabs(tIdx, "tree", newTree);
    setTabs(tIdx, "leaves", newLeaves);
    setTabs(tIdx, "activeLeafId", keeperId);
  };

  const closePaneById = (leafId: number) => {
    // Find the tab containing this leaf.
    for (let i = 0; i < tabs.length; i++) {
      if (!tabs[i].leaves[leafId]) continue;
      const tab = tabs[i];
      setActiveId(tab.id);
      setTabs(i, "activeLeafId", leafId);
      closeActivePane();
      return;
    }
  };

  const copyFromPane = async (leafId: number) => {
    const text = leafSelectionFns.get(leafId)?.() ?? "";
    if (!text) return;
    await copyText(text);
  };

  const copyActiveSelection = () => {
    const leaf = activeLeaf();
    if (leaf) copyFromPane(leaf.id);
  };

  /** Whether the block at this marker has a command worth a copy button. */
  const canCopyMarker = (leafId: number, markerId: number): boolean => {
    const tab = tabs.find((t) => t.leaves[leafId]);
    const block = tab?.leaves[leafId].blocks.find((b) => b.markerId === markerId);
    return !!block?.command && block.command.trim() !== "";
  };

  /** Copy a block's command + output (clicked via the in-terminal overlay). */
  const copyBlockByMarker = async (leafId: number, markerId: number) => {
    const tab = tabs.find((t) => t.leaves[leafId]);
    if (!tab) return;
    const block = tab.leaves[leafId].blocks.find((b) => b.markerId === markerId);
    if (!block) return;
    const parts: string[] = [];
    if (block.command) parts.push(stripAnsi(block.command).trimEnd());
    if (block.output) parts.push(stripAnsi(block.output).trimEnd());
    const text = parts.join("\n");
    if (!text) return;
    await copyText(text);
  };

  const pasteIntoPane = async (leafId: number) => {
    const tab = tabs.find((t) => t.leaves[leafId]);
    if (!tab) return;
    const leaf = tab.leaves[leafId];
    if (leaf.ptyId === null) return;
    const text = await pasteText();
    if (!text) return;
    const bytes = new TextEncoder().encode(text);
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode(
        ...bytes.subarray(i, Math.min(i + chunk, bytes.length))
      );
    }
    await invoke("pty_write", { id: leaf.ptyId, dataB64: btoa(bin) }).catch(
      (e) => console.error("paste write failed", e)
    );
  };

  // Dismiss pane context menu on click outside / escape.
  createEffect(() => {
    if (!paneCtxMenu()) return;
    const onAnyClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest(".pane-context-menu")) setPaneCtxMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPaneCtxMenu(null);
    };
    window.addEventListener("mousedown", onAnyClick);
    window.addEventListener("keydown", onKey);
    onCleanup(() => {
      window.removeEventListener("mousedown", onAnyClick);
      window.removeEventListener("keydown", onKey);
    });
  });

  // Dismiss layouts popup on click outside.
  createEffect(() => {
    if (!layoutsOpen()) return;
    const onAnyClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest(".layouts-popup") && !t.closest(".layouts-toggle")) {
        setLayoutsOpen(false);
      }
    };
    window.addEventListener("mousedown", onAnyClick);
    onCleanup(() => {
      window.removeEventListener("mousedown", onAnyClick);
    });
  });

  // Cyclic pane navigation: any arrow steps through panes in tree order and
  // wraps around. Right/Down go forward, Left/Up backward — so you can hop
  // through every pane with a single arrow, even ones that are below/above.
  const navigatePane = (direction: "left" | "right" | "up" | "down") => {
    const tab = activeTab();
    if (!tab) return;
    const ids = leafIds(tab.tree);
    if (ids.length < 2) return;
    const idx = ids.indexOf(tab.activeLeafId);
    if (idx === -1) return;
    const forward = direction === "right" || direction === "down";
    const next = forward
      ? (idx + 1) % ids.length
      : (idx - 1 + ids.length) % ids.length;
    focusLeaf(ids[next]);
  };

  const resizeSplit = (splitId: number, ratio: number) => {
    const tab = activeTab();
    if (!tab) return;
    const tIdx = tabIndex(tab.id);
    if (tIdx === -1) return;
    setTabs(tIdx, "tree", setSplitRatio(tab.tree, splitId, ratio));
  };

  /** Split a specific tab (not necessarily the active one — useful from the
   *  tab context menu). The new pane is appended next to the tab's currently
   *  active leaf. */
  const splitTab = (tabId: number, direction: "row" | "column") => {
    const tIdx = tabIndex(tabId);
    if (tIdx === -1) return;
    if (!canSplitTab(tabId)) {
      flashToast(`Max ${MAX_PANES_PER_TAB} panes par tab`);
      return;
    }
    const tab = tabs[tIdx];
    setActiveId(tabId);
    const newLeaf = makeLeaf();
    const newTree = splitAt(tab.tree, tab.activeLeafId, direction, newLeaf.id);
    setTabs(tIdx, "tree", newTree);
    setTabs(tIdx, "leaves", newLeaf.id, newLeaf);
    setTabs(tIdx, "activeLeafId", newLeaf.id);
  };

  /** Drop a tab onto a leaf: split the destination leaf in the given
   *  direction with a fresh empty pane on the chosen side. We don't move the
   *  source tab's content — preserving its shell state. The destination gets
   *  a new shell next to the existing pane. */
  const handleTabDropOnLeaf = (
    destLeafId: number,
    _fromTabId: number,
    direction: "row" | "column",
    side: "before" | "after"
  ) => {
    // Find which tab contains the destination leaf.
    let destTabIdx = -1;
    for (let i = 0; i < tabs.length; i++) {
      if (tabs[i].leaves[destLeafId]) {
        destTabIdx = i;
        break;
      }
    }
    if (destTabIdx === -1) return;
    if (!canSplitTab(tabs[destTabIdx].id)) {
      flashToast(`Max ${MAX_PANES_PER_TAB} panes par tab`);
      return;
    }
    setActiveId(tabs[destTabIdx].id);
    const newLeaf = makeLeaf();
    // splitAt always puts the new leaf on the "after" side. If the user wants
    // the new pane on the "before" side we patch the tree afterwards by
    // swapping the children of the created split.
    let newTree = splitAt(
      tabs[destTabIdx].tree,
      destLeafId,
      direction,
      newLeaf.id
    );
    if (side === "before") {
      newTree = swapSplitChildrenContaining(newTree, newLeaf.id);
    }
    setTabs(destTabIdx, "tree", newTree);
    setTabs(destTabIdx, "leaves", newLeaf.id, newLeaf);
    setTabs(destTabIdx, "activeLeafId", newLeaf.id);
  };

  /** Swap two leaves' positions in the tree. Tree references swap; the
   *  leaves Record and PortableTerminal instances stay put, so xterm state +
   *  PTYs are preserved. LeafView's sync() picks up the new leafId at each
   *  position and re-registers the placeholder. */
  function swapLeavesInTree(
    node: TreeNode,
    a: number,
    b: number
  ): TreeNode {
    if (node.type === "leaf") {
      if (node.leafId === a) return { ...node, leafId: b };
      if (node.leafId === b) return { ...node, leafId: a };
      return node;
    }
    return {
      ...node,
      children: [
        swapLeavesInTree(node.children[0], a, b),
        swapLeavesInTree(node.children[1], a, b),
      ] as [TreeNode, TreeNode],
    };
  }

  const handlePaneSwap = (fromLeafId: number, toLeafId: number) => {
    if (fromLeafId === toLeafId) return;
    let tabIdx = -1;
    for (let i = 0; i < tabs.length; i++) {
      if (tabs[i].leaves[fromLeafId] && tabs[i].leaves[toLeafId]) {
        tabIdx = i;
        break;
      }
    }
    if (tabIdx === -1) return;
    const tree = swapLeavesInTree(tabs[tabIdx].tree, fromLeafId, toLeafId);
    setTabs(tabIdx, "tree", tree);
  };

  /** Move a dragged pane to an edge of the target leaf: pull it out of its
   *  current spot and re-insert it as a fresh split sibling of the target on
   *  the chosen side. Both leaves stay in the `leaves` Record and their
   *  PortableTerminal instances are untouched, so xterm + PTY survive — only
   *  the tree (and thus the CSS-positioned cards) restructures. */
  const handlePaneMove = (
    fromLeafId: number,
    toLeafId: number,
    direction: "row" | "column",
    side: "before" | "after"
  ) => {
    if (fromLeafId === toLeafId) return;
    let tabIdx = -1;
    for (let i = 0; i < tabs.length; i++) {
      if (tabs[i].leaves[fromLeafId] && tabs[i].leaves[toLeafId]) {
        tabIdx = i;
        break;
      }
    }
    if (tabIdx === -1) return;
    // 1. Detach the dragged leaf (its sibling is promoted in its place).
    const without = removeLeaf(tabs[tabIdx].tree, fromLeafId);
    if (!without) return;
    // 2. Split the target, re-using the existing dragged leaf as the new child.
    //    splitAt always appends on the "after" side; flip for "before".
    let newTree = splitAt(without, toLeafId, direction, fromLeafId);
    if (side === "before") {
      newTree = swapSplitChildrenContaining(newTree, fromLeafId);
    }
    setTabs(tabIdx, "tree", newTree);
    setTabs(tabIdx, "activeLeafId", fromLeafId);
  };

  /** Walk the tree and swap children of the split that *directly* contains
   *  the given leafId as one of its leaf children. */
  function swapSplitChildrenContaining(node: TreeNode, leafId: number): TreeNode {
    if (node.type === "leaf") return node;
    const [a, b] = node.children;
    const directlyContains =
      (a.type === "leaf" && a.leafId === leafId) ||
      (b.type === "leaf" && b.leafId === leafId);
    if (directlyContains) {
      return { ...node, children: [b, a] };
    }
    return {
      ...node,
      children: [
        swapSplitChildrenContaining(a, leafId),
        swapSplitChildrenContaining(b, leafId),
      ] as [TreeNode, TreeNode],
    };
  }

  /** Reorder a tab. `overIdx` is the index of the tab the cursor was over,
   *  `side` indicates whether to drop before or after it. */
  const reorderTabs = (
    fromId: number,
    overIdx: number,
    side: "before" | "after"
  ) => {
    const fromIdx = tabIndex(fromId);
    if (fromIdx === -1) return;
    const intended = side === "after" ? overIdx + 1 : overIdx;
    // If the dragged tab was before the drop position, removing it shifts the
    // target index left by 1.
    const target = fromIdx < intended ? intended - 1 : intended;
    if (target === fromIdx) return;
    const next = [...tabs];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(Math.max(0, Math.min(next.length, target)), 0, moved);
    setTabs(next);
    // Solid's For moves DOM nodes to their new positions; xterm's WebGL
    // canvas can lose its painted content during the detach/reattach. Force
    // a refit + refresh on the active tab so it repaints immediately instead
    // of waiting for the next user interaction.
    const active = activeTab();
    if (active) {
      requestAnimationFrame(() => {
        for (const key of Object.keys(active.leaves)) {
          leafRefreshFns.get(Number(key))?.();
        }
      });
    }
  };

  // Dismiss the tab context menu on click outside / escape.
  createEffect(() => {
    if (!tabCtxMenu()) return;
    const onAnyClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest(".tab-context-menu")) setTabCtxMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTabCtxMenu(null);
    };
    window.addEventListener("mousedown", onAnyClick);
    window.addEventListener("keydown", onKey);
    onCleanup(() => {
      window.removeEventListener("mousedown", onAnyClick);
      window.removeEventListener("keydown", onKey);
    });
  });

  // --- Block events from leaf terminals ---

  const handleBlock = (tabId: number, leafId: number, ev: PtyBlock) => {
    const tIdx = tabIndex(tabId);
    if (tIdx === -1) return;
    const leaf = tabs[tIdx].leaves[leafId];
    if (!leaf) return;
    // Any block event means OSC 133 markers are flowing → integration works.
    markOscSeen();
    switch (ev.kind) {
      case "promptStart": {
        const blockId = leaf.nextBlockId;
        const newBlock: Block = {
          id: blockId,
          command: null,
          output: null,
          startedAt: Date.now(),
          finishedAt: null,
          exitCode: null,
          status: "pending",
          ai: null,
          markerId: null,
        };
        setTabs(tIdx, "leaves", leafId, "nextBlockId", blockId + 1);
        // Keep only the most recent blocks so a long-lived session doesn't grow
        // memory without bound (each block can hold up to ~1 MiB of captured
        // output). Older blocks scroll out of xterm's scrollback anyway.
        setTabs(tIdx, "leaves", leafId, "blocks", (b) => {
          const next = [...b, newBlock];
          return next.length > MAX_BLOCKS_PER_LEAF
            ? next.slice(next.length - MAX_BLOCKS_PER_LEAF)
            : next;
        });
        break;
      }
      case "commandLine": {
        const blocks = leaf.blocks;
        if (blocks.length === 0) return;
        const lastIdx = blocks.length - 1;
        setTabs(
          tIdx,
          "leaves",
          leafId,
          "blocks",
          lastIdx,
          "command",
          ev.command ?? ""
        );
        // Feed the frecency store that powers autocomplete history suggestions.
        if (ev.command) recordCommand(ev.command);
        break;
      }
      case "outputStart": {
        const blocks = leaf.blocks;
        if (blocks.length === 0) return;
        const lastIdx = blocks.length - 1;
        setTabs(tIdx, "leaves", leafId, "blocks", lastIdx, "status", "running");
        commandRunStart.set(leafId, Date.now());
        break;
      }
      case "outputEnd": {
        const blocks = leaf.blocks;
        if (blocks.length === 0) return;
        const lastIdx = blocks.length - 1;
        const output = ev.outputB64 ? b64ToString(ev.outputB64) : null;
        setTabs(tIdx, "leaves", leafId, "blocks", lastIdx, {
          status: "done",
          finishedAt: Date.now(),
          exitCode: ev.exitCode,
          output,
        });
        const runStart = commandRunStart.get(leafId);
        commandRunStart.delete(leafId);
        if (runStart) {
          notifyCommandDone(
            tabs[tIdx].leaves[leafId].blocks[lastIdx]?.command ?? null,
            ev.exitCode,
            Date.now() - runStart
          );
        }
        break;
      }
      case "promptEnd":
        break;
    }
  };

  const handleCwd = (tabId: number, leafId: number, cwd: string) => {
    const tIdx = tabIndex(tabId);
    if (tIdx === -1) return;
    // Always record each pane's cwd so the session can be restored to it.
    if (tabs[tIdx].leaves[leafId]) {
      setTabs(tIdx, "leaves", leafId, "cwd", cwd);
    }
    // SSH tabs keep their host as title — don't overwrite with the local cwd.
    if (tabs[tIdx].lockTitle) return;
    // Only update the tab title when this is the active leaf of the tab.
    if (tabs[tIdx].activeLeafId !== leafId) return;
    const home = userHome();
    let label = cwd;
    if (home && cwd === home) label = "~";
    else if (home && cwd.startsWith(home + "/"))
      label = "~/" + cwd.slice(home.length + 1);
    const basename = label.split("/").filter(Boolean).pop() || label;
    setTabs(tIdx, "title", basename);
  };

  const closeSearch = (refocusTerminal: boolean) => {
    setSearchOpen(false);
    setSearchQuery("");
    if (refocusTerminal) focusActiveTerminal();
  };

  // --- Remappable shortcuts ---

  const cycleTab = (dir: number) => {
    if (tabs.length < 2) return;
    const idx = tabIndex(activeId());
    if (idx === -1) return;
    setActiveId(tabs[(idx + dir + tabs.length) % tabs.length].id);
  };

  // Each action does its own preventDefault so a no-op (e.g. search with no
  // blocks) still flows through to the terminal.
  const actionHandlers: Record<ActionId, (e: KeyboardEvent) => void> = {
    newTab: (e) => {
      e.preventDefault();
      addTab();
    },
    closeTab: (e) => {
      e.preventDefault();
      closeActivePane();
    },
    nextTab: (e) => {
      e.preventDefault();
      cycleTab(1);
    },
    prevTab: (e) => {
      e.preventDefault();
      cycleTab(-1);
    },
    splitH: (e) => {
      e.preventDefault();
      splitActivePane("row");
    },
    splitV: (e) => {
      e.preventDefault();
      splitActivePane("column");
    },
    togglePanel: (e) => {
      e.preventDefault();
      setPanelVisible(!panelVisible());
    },
    search: (e) => {
      const leaf = activeLeaf();
      if (!leaf || leaf.blocks.length === 0) return;
      e.preventDefault();
      if (!panelVisible()) setPanelVisible(true);
      setSearchOpen(true);
    },
    termSearch: (e) => {
      const leaf = activeLeaf();
      if (!leaf) return;
      e.preventDefault();
      leafSearchFns.get(leaf.id)?.();
    },
    paletteAI: (e) => {
      e.preventDefault();
      setPaletteOpen(true);
    },
    workflows: (e) => {
      e.preventDefault();
      setWorkflowsOpen(true);
    },
    ssh: (e) => {
      e.preventDefault();
      setSshOpen(true);
    },
    copy: (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      copyActiveSelection();
    },
    paste: (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const leaf = activeLeaf();
      if (leaf) pasteIntoPane(leaf.id);
    },
    settings: (e) => {
      e.preventDefault();
      setSettingsOpen(true);
    },
  };

  const reverseBindings = createMemo(() =>
    comboToAction(resolveBindings(config.keybindings))
  );

  /** Assign a combo to an action, clearing it from any other action first. */
  const applyBinding = (id: ActionId, combo: string) => {
    for (const a of ACTIONS) {
      if (a.id !== id && reverseBindings()[combo] === a.id) {
        setConfig("keybindings", a.id, "");
      }
    }
    setConfig("keybindings", id, combo);
    persistConfig();
  };

  const resetBindings = () => {
    setConfig("keybindings", {});
    persistConfig();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    // While the settings modal is open it captures the keyboard. If a shortcut
    // is being rebound, the next combo is recorded; otherwise Esc closes it and
    // everything else flows through to its inputs (no app shortcuts fire).
    if (settingsOpen()) {
      const rec = recordingAction();
      if (rec) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.key === "Escape") {
          setRecordingAction(null);
        } else if (!["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
          // Require a real modifier so we can't bind a bare key (which would
          // hijack normal typing).
          if (e.ctrlKey || e.altKey || e.metaKey) {
            const combo = eventToCombo(e);
            if (combo) {
              applyBinding(rec, combo);
              setRecordingAction(null);
            }
          }
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSettingsOpen(false);
      }
      return;
    }

    const target = e.target as HTMLElement | null;
    const inField =
      !!target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable);
    // All the shortcuts Lume handles that need to bypass xterm even when its
    // helper textarea has focus. Anything not on this list flows through to
    // the terminal normally (so the shell's own Ctrl+C / Ctrl+R / etc still
    // work).
    const combo = eventToCombo(e);
    const isBound = !!(combo && reverseBindings()[combo]);
    // Layout-special keys that aren't remappable but must still bypass xterm.
    const isSpecial =
      (e.altKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        e.key.startsWith("Arrow")) ||
      (e.ctrlKey &&
        !e.shiftKey &&
        /^(?:Digit|Numpad)[0-9]$/.test(e.code)) ||
      (e.ctrlKey && (e.key === "+" || e.key === "=" || e.key === "-")) ||
      (e.ctrlKey &&
        !e.shiftKey &&
        (e.key === "ArrowUp" || e.key === "ArrowDown"));
    const isOurShortcut = isBound || isSpecial;
    if (inField && !isOurShortcut) {
      return;
    }

    if (blockNavMode()) {
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        navigateBlocks(e.key === "ArrowUp" ? -1 : 1);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        insertSelectedBlock();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        exitNavMode(true);
        return;
      }
      exitNavMode(false);
    }

    // Alt+arrows navigate between panes (works without Ctrl). We
    // stopImmediatePropagation so xterm doesn't also receive the key (some
    // shells interpret Alt+arrow as word-jump, which is annoying when the user
    // wanted to focus a sibling pane).
    if (e.altKey && !e.ctrlKey && !e.shiftKey) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopImmediatePropagation();
        navigatePane("left");
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopImmediatePropagation();
        navigatePane("right");
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopImmediatePropagation();
        navigatePane("up");
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopImmediatePropagation();
        navigatePane("down");
        return;
      }
    }

    // Remappable app shortcuts, dispatched from the keybindings config.
    if (combo) {
      const action = reverseBindings()[combo];
      if (action) {
        actionHandlers[action](e);
        return;
      }
    }

    if (!e.ctrlKey) return;

    // Go to tab N — matched on the PHYSICAL key (e.code) so it works on AZERTY
    // and other layouts where the number row needs Shift for digits.
    const tabDigit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
    if (!e.shiftKey && tabDigit) {
      e.preventDefault();
      const i = Number(tabDigit[1]) - 1;
      if (i < tabs.length) setActiveId(tabs[i].id);
      return;
    }

    // Zoom text size. Reset on the physical 0 key; +/-/= for in/out. Digit keys
    // were already handled above (so Ctrl+6 on AZERTY = tab 6, not zoom).
    // stopImmediatePropagation so xterm doesn't forward the key to the shell.
    if (e.code === "Digit0" || e.code === "Numpad0") {
      e.preventDefault();
      e.stopImmediatePropagation();
      resetFontSize();
      return;
    }
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      e.stopImmediatePropagation();
      adjustFontSize(1);
      return;
    }
    if (e.key === "-") {
      e.preventDefault();
      e.stopImmediatePropagation();
      adjustFontSize(-1);
      return;
    }

    if (!e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      const leaf = activeLeaf();
      if (!leaf || leaf.blocks.length === 0) return;
      e.preventDefault();
      setBlockNavMode(true);
      navigateBlocks(e.key === "ArrowUp" ? -1 : 1);
      return;
    }
  };

  let unlistenAiChunk: UnlistenFn | undefined;
  let unlistenAiDone: UnlistenFn | undefined;
  let unlistenAiError: UnlistenFn | undefined;
  let unlistenRemoteNewTab: UnlistenFn | undefined;

  onMount(async () => {
    window.addEventListener("keydown", onKeyDown, true);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown, true));
    // Registered before the awaits below so it keeps a valid reactive owner
    // (past the first `await` the owner is gone). The unlisten vars it closes
    // over are populated by the awaits and set by the time cleanup runs.
    onCleanup(() => {
      unlistenAiChunk?.();
      unlistenAiDone?.();
      unlistenAiError?.();
      unlistenRemoteNewTab?.();
    });

    unlistenRemoteNewTab = await listen("remote:new-tab", () =>
      addTabFromRemote()
    );

    unlistenAiChunk = await listen<AiChunkEvent>("ai:chunk", (e) => {
      const loc = findBlockByRequest(e.payload.requestId);
      if (!loc) return;
      setTabs(
        loc.tabIdx,
        "leaves",
        loc.leafId,
        "blocks",
        loc.blockIdx,
        "ai",
        "response",
        (r) => (r ?? "") + e.payload.delta
      );
    });

    unlistenAiDone = await listen<AiDoneEvent>("ai:done", (e) => {
      const loc = findBlockByRequest(e.payload.requestId);
      if (!loc) return;
      const block = tabs[loc.tabIdx].leaves[loc.leafId].blocks[loc.blockIdx];
      const ai = block.ai;
      if (ai && ai.response.trim()) {
        const last = ai.history[ai.history.length - 1];
        const alreadyThere =
          last?.role === "assistant" && last?.content === ai.response;
        if (!alreadyThere) {
          const next: ChatMessage = {
            role: "assistant",
            content: ai.response,
          };
          setTabs(
            loc.tabIdx,
            "leaves",
            loc.leafId,
            "blocks",
            loc.blockIdx,
            "ai",
            "history",
            (h) => [...(h ?? []), next]
          );
        }
      }
      setTabs(
        loc.tabIdx,
        "leaves",
        loc.leafId,
        "blocks",
        loc.blockIdx,
        "ai",
        "status",
        "done"
      );
    });

    unlistenAiError = await listen<AiErrorEvent>("ai:error", (e) => {
      const loc = findBlockByRequest(e.payload.requestId);
      if (!loc) return;
      setTabs(loc.tabIdx, "leaves", loc.leafId, "blocks", loc.blockIdx, "ai", {
        status: "error",
        error: e.payload.message,
      });
    });
  });

  createEffect(() => applyCssVars(config));

  // When the active tab changes, force every leaf in the now-visible tab to
  // refit + refresh. xterm's WebGL canvas doesn't paint while display:none, so
  // without an explicit refresh the panes stay blank until the user clicks
  // them (which triggers our focus/active effect).
  createEffect(() => {
    const id = activeId();
    requestAnimationFrame(() => {
      const tab = tabs.find((t) => t.id === id);
      if (!tab) return;
      for (const key of Object.keys(tab.leaves)) {
        const leafId = Number(key);
        leafRefreshFns.get(leafId)?.();
      }
    });
  });

  const serializeSession = (): PersistedSession => {
    const { nextLeafId, nextSplitId } = paneCounters();
    return {
      version: 2,
      activeId: activeId(),
      nextLeafId,
      nextSplitId,
      nextTabId,
      tabs: tabs.map((t) => ({
        id: t.id,
        title: t.title,
        lockTitle: !!t.lockTitle,
        tree: t.tree,
        activeLeafId: t.activeLeafId,
        leaves: leafIds(t.tree).map((lid) => ({
          id: lid,
          cwd: t.leaves[lid]?.cwd ?? null,
        })),
      })),
    };
  };

  // Persist the whole session (tabs, titles, manual-rename lock, tree/layout,
  // per-pane cwd) on any change, debounced. Building the snapshot here reads all
  // the relevant store fields, so the effect re-runs whenever they change.
  let sessionSaveTimer: ReturnType<typeof setTimeout> | null = null;
  createEffect(() => {
    const json = JSON.stringify(serializeSession());
    if (sessionSaveTimer) clearTimeout(sessionSaveTimer);
    sessionSaveTimer = setTimeout(() => {
      sessionSaveTimer = null;
      try {
        localStorage.setItem(SESSION_KEY, json);
      } catch {}
    }, 400);
  });

  // Belt-and-suspenders: flush the latest session synchronously when the window
  // is closing, in case a change happened within the debounce window.
  const saveSessionNow = () => {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(serializeSession()));
    } catch {}
  };
  window.addEventListener("beforeunload", saveSessionNow);
  onCleanup(() => window.removeEventListener("beforeunload", saveSessionNow));

  return (
    <Show
      when={configReady()}
      fallback={<div class="loading">Chargement de la configuration…</div>}
    >
      <div class="app-shell">
          <UpdateBanner />
          <div class="tab-bar">
            <div class="tab-lead">
              <button
                class="tab-action"
                title={t("toolbar.fileTree")}
                classList={{ active: fileTreeVisible() }}
                onClick={() => setFileTreeVisible(!fileTreeVisible())}
              >
                <IconFolder />
              </button>
            </div>
            <div class="tab-list-wrap">
              <Show when={tabScroll().left}>
                <button
                  class="tab-scroll-btn left"
                  title={t("toolbar.prevTabs")}
                  onClick={() => scrollTabs(-1)}
                >
                  <IconChevronLeft size={14} />
                </button>
              </Show>
              <div
                class="tab-list"
                ref={tabListRef}
                onScroll={updateTabScroll}
                onWheel={(e) => {
                  if (e.deltaY !== 0 && tabListRef)
                    tabListRef.scrollLeft += e.deltaY;
                }}
              >
            <For each={tabs}>
              {(tab, idx) => (
                <div
                  class="tab"
                  classList={{
                    active: isActiveTabId(tab.id),
                    dragging: draggingTabId() === tab.id,
                    "drop-before":
                      reorderHover()?.idx === idx() &&
                      reorderHover()?.side === "before",
                    "drop-after":
                      reorderHover()?.idx === idx() &&
                      reorderHover()?.side === "after",
                  }}
                  draggable={editingTabId() !== tab.id}
                  onClick={() => setActiveId(tab.id)}
                  onDblClick={() => startRename(tab.id)}
                  onAuxClick={(e) => {
                    // Middle-click closes the tab.
                    if (e.button === 1) {
                      e.preventDefault();
                      closeTab(tab.id);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setTabCtxMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
                  }}
                  onDragStart={(e) => {
                    e.dataTransfer?.setData("text/lume-tab", String(tab.id));
                    if (e.dataTransfer) e.dataTransfer.effectAllowed = "copyMove";
                    setDraggingTabId(tab.id);
                  }}
                  onDragEnd={() => {
                    setDraggingTabId(null);
                    setReorderHover(null);
                  }}
                  onDragOver={(e) => {
                    if (!e.dataTransfer?.types.includes("text/lume-tab"))
                      return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    const rect = (
                      e.currentTarget as HTMLElement
                    ).getBoundingClientRect();
                    const side: "before" | "after" =
                      e.clientX < rect.left + rect.width / 2
                        ? "before"
                        : "after";
                    const cur = reorderHover();
                    if (!cur || cur.idx !== idx() || cur.side !== side)
                      setReorderHover({ idx: idx(), side });
                  }}
                  onDragLeave={(e) => {
                    const next = e.relatedTarget as Node | null;
                    if (
                      next &&
                      (e.currentTarget as HTMLElement).contains(next)
                    )
                      return;
                    if (reorderHover()?.idx === idx()) setReorderHover(null);
                  }}
                  onDrop={(e) => {
                    const raw = e.dataTransfer?.getData("text/lume-tab");
                    if (!raw) return;
                    e.preventDefault();
                    const fromId = Number(raw);
                    const hover = reorderHover();
                    const rect = (
                      e.currentTarget as HTMLElement
                    ).getBoundingClientRect();
                    const side: "before" | "after" =
                      hover?.idx === idx()
                        ? hover.side
                        : e.clientX < rect.left + rect.width / 2
                        ? "before"
                        : "after";
                    reorderTabs(fromId, idx(), side);
                    setDraggingTabId(null);
                    setReorderHover(null);
                  }}
                >
                  <span class="tab-index">{idx() + 1}</span>
                  <Show
                    when={editingTabId() === tab.id}
                    fallback={<span class="tab-title">{tab.title}</span>}
                  >
                    <input
                      class="tab-title-input"
                      value={editingTitle()}
                      ref={(el) =>
                        queueMicrotask(() => {
                          el.focus();
                          el.select();
                        })
                      }
                      draggable={false}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      onDblClick={(e) => e.stopPropagation()}
                      onInput={(e) => setEditingTitle(e.currentTarget.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitRename();
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          cancelRename();
                        }
                      }}
                    />
                  </Show>
                  <Show when={leafIds(tab.tree).length > 1}>
                    <span
                      class="tab-panes-badge"
                      title={`${leafIds(tab.tree).length} panes`}
                    >
                      ⊞ {leafIds(tab.tree).length}
                    </span>
                  </Show>
                  <button
                    class="tab-close"
                    title={t("toolbar.closeTab")}
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
            </For>
            <button
              class="tab-new"
              title={t("toolbar.newTab")}
              onClick={addTab}
            >
              +
            </button>
              </div>
              <Show when={tabScroll().right}>
                <button
                  class="tab-scroll-btn right"
                  title={t("toolbar.nextTabs")}
                  onClick={() => scrollTabs(1)}
                >
                  <IconChevronRight size={14} />
                </button>
              </Show>
            </div>
            <div class="tab-actions">
              <Show when={remoteInfo()?.running}>
                <button
                  class="remote-indicator"
                  classList={{ connected: (remoteInfo()?.clients ?? 0) > 0 }}
                  title={t("toolbar.remoteActive")}
                  onClick={() => setRemoteDialogOpen(true)}
                >
                  <IconSmartphone size={15} />
                  <span class="remote-indicator-dot" />
                  <Show when={(remoteInfo()?.clients ?? 0) > 0}>
                    <span class="remote-indicator-count">
                      {remoteInfo()!.clients}
                    </span>
                  </Show>
                </button>
                <span class="tab-actions-sep" />
              </Show>
              <button
                class="tab-action layouts-toggle"
                title={t("toolbar.layouts")}
                classList={{ active: layoutsOpen() }}
                onClick={(e) => {
                  e.stopPropagation();
                  setLayoutsOpen(!layoutsOpen());
                }}
              >
                <IconLayouts />
              </button>
              <button
                class="tab-action"
                title={t("toolbar.blocks")}
                classList={{ active: panelVisible() }}
                onClick={() => setPanelVisible(!panelVisible())}
              >
                <IconBlocks />
              </button>
              <span class="tab-actions-sep" />
              <button
                class="tab-action"
                title={t("toolbar.workflows")}
                onClick={() => setWorkflowsOpen(true)}
              >
                <IconWorkflow />
              </button>
              <button
                class="tab-action"
                title={t("toolbar.ssh")}
                onClick={() => setSshOpen(true)}
              >
                <IconSsh />
              </button>
              <span class="tab-actions-sep" />
              <button
                class="tab-action"
                title={t("toolbar.settings")}
                onClick={() => setSettingsOpen(true)}
              >
                <IconSettings />
              </button>
            </div>
            <Show when={layoutsOpen()}>
              <div class="layouts-popup" onClick={(e) => e.stopPropagation()}>
                <div class="layouts-popup-title">{t("layouts.title")}</div>
                <div class="layouts-grid">
                  <button
                    class="layout-preset"
                    onClick={() => {
                      applyLayout("single");
                      setLayoutsOpen(false);
                    }}
                  >
                    <div class="layout-preview single" />
                    <span>{t("layouts.single")}</span>
                  </button>
                  <button
                    class="layout-preset"
                    onClick={() => {
                      applyLayout("sideBySide");
                      setLayoutsOpen(false);
                    }}
                  >
                    <div class="layout-preview side-by-side" />
                    <span>{t("layouts.twoCols")}</span>
                  </button>
                  <button
                    class="layout-preset"
                    onClick={() => {
                      applyLayout("stacked");
                      setLayoutsOpen(false);
                    }}
                  >
                    <div class="layout-preview stacked" />
                    <span>{t("layouts.twoRows")}</span>
                  </button>
                  <button
                    class="layout-preset"
                    onClick={() => {
                      applyLayout("grid2x2");
                      setLayoutsOpen(false);
                    }}
                  >
                    <div class="layout-preview grid-2x2" />
                    <span>{t("layouts.grid")}</span>
                  </button>
                  <button
                    class="layout-preset"
                    onClick={() => {
                      applyLayout("mainPlusSide");
                      setLayoutsOpen(false);
                    }}
                  >
                    <div class="layout-preview main-side" />
                    <span>{t("layouts.mainSide")}</span>
                  </button>
                  <button
                    class="layout-preset"
                    onClick={() => {
                      applyLayout("tripleColumn");
                      setLayoutsOpen(false);
                    }}
                  >
                    <div class="layout-preview triple-col" />
                    <span>{t("layouts.tripleCol")}</span>
                  </button>
                </div>
                <p class="layouts-popup-note">{t("layouts.note")}</p>
              </div>
            </Show>
          </div>
          <Show when={toast()}>
            <div class="lume-toast">{toast()}</div>
          </Show>
          <Show when={paneCtxMenu()}>
            {(menu) => {
              const m = menu();
              const tab = tabs.find((t) => t.leaves[m.leafId]);
              if (!tab) return null;
              const paneCount = leafIds(tab.tree).length;
              return (
                <div
                  class="pane-context-menu"
                  style={{ left: `${m.x}px`, top: `${m.y}px` }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    class="ctx-item"
                    onClick={() => {
                      copyFromPane(m.leafId);
                      setPaneCtxMenu(null);
                    }}
                  >
                    {t("pane.copy")}
                  </button>
                  <button
                    class="ctx-item"
                    onClick={() => {
                      pasteIntoPane(m.leafId);
                      setPaneCtxMenu(null);
                    }}
                  >
                    {t("pane.paste")}
                  </button>
                  <div class="ctx-sep" />
                  <button
                    class="ctx-item"
                    onClick={() => {
                      // Activate this leaf then split it.
                      const tIdx = tabIndex(tab.id);
                      setActiveId(tab.id);
                      setTabs(tIdx, "activeLeafId", m.leafId);
                      splitActivePane("row");
                      setPaneCtxMenu(null);
                    }}
                  >
                    {t("pane.splitH")}
                  </button>
                  <button
                    class="ctx-item"
                    onClick={() => {
                      const tIdx = tabIndex(tab.id);
                      setActiveId(tab.id);
                      setTabs(tIdx, "activeLeafId", m.leafId);
                      splitActivePane("column");
                      setPaneCtxMenu(null);
                    }}
                  >
                    {t("pane.splitV")}
                  </button>
                  <div class="ctx-sep" />
                  <button
                    class="ctx-item"
                    onClick={() => {
                      const tIdx = tabIndex(tab.id);
                      setActiveId(tab.id);
                      setTabs(tIdx, "activeLeafId", m.leafId);
                      startRemoteControl();
                      setPaneCtxMenu(null);
                    }}
                  >
                    {t("pane.remote")}
                  </button>
                  <div class="ctx-sep" />
                  <button
                    class="ctx-item"
                    onClick={() => {
                      addTab();
                      setPaneCtxMenu(null);
                    }}
                  >
                    {t("pane.newTab")}
                  </button>
                  <div class="ctx-sep" />
                  <button
                    class="ctx-item danger"
                    onClick={() => {
                      closePaneById(m.leafId);
                      setPaneCtxMenu(null);
                    }}
                  >
                    {t("pane.close")}
                    <Show when={paneCount === 1}>{t("pane.closeTab")}</Show>
                  </button>
                </div>
              );
            }}
          </Show>
          <Show when={tabCtxMenu()}>
            {(menu) => {
              const m = menu();
              const tab = tabs.find((t) => t.id === m.tabId);
              const paneCount = tab ? leafIds(tab.tree).length : 1;
              return (
                <div
                  class="tab-context-menu"
                  style={{ left: `${m.x}px`, top: `${m.y}px` }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    class="ctx-item"
                    onClick={() => {
                      startRename(m.tabId);
                      setTabCtxMenu(null);
                    }}
                  >
                    {t("tab.rename")}
                  </button>
                  <div class="ctx-sep" />
                  <button
                    class="ctx-item"
                    onClick={() => {
                      splitTab(m.tabId, "row");
                      setTabCtxMenu(null);
                    }}
                  >
                    {t("tab.splitH")}
                  </button>
                  <button
                    class="ctx-item"
                    onClick={() => {
                      splitTab(m.tabId, "column");
                      setTabCtxMenu(null);
                    }}
                  >
                    {t("tab.splitV")}
                  </button>
                  <div class="ctx-sep" />
                  <button
                    class="ctx-item"
                    onClick={() => {
                      addTab();
                      setTabCtxMenu(null);
                    }}
                  >
                    {t("tab.newTab")}
                  </button>
                  <div class="ctx-sep" />
                  <button
                    class="ctx-item danger"
                    onClick={() => {
                      closeTab(m.tabId);
                      setTabCtxMenu(null);
                    }}
                  >
                    {t("tab.close")}
                    <Show when={paneCount > 1}>{t("tab.panes", { n: paneCount })}</Show>
                  </button>
                </div>
              );
            }}
          </Show>
          <div class="body">
            <FileTree
              visible={fileTreeVisible}
              width={fileTreeWidth}
              onResize={setFileTreeWidth}
              onToggle={() => setFileTreeVisible(false)}
              cwd={() => activeLeaf()?.cwd ?? null}
              onRun={(command) => insertIntoActiveTerminal(command + "\n")}
              onInsert={(text) => insertIntoActiveTerminal(text)}
              onCopy={(text) => copyText(text)}
              commands={() => config.fileTree}
            />
            <div class="terminals">
              <For each={tabs}>
                {(tab) => (
                  <div
                    class="terminal-slot"
                    style={{ display: isActiveTabId(tab.id) ? "flex" : "none" }}
                  >
                    <PaneNode
                      node={tab.tree}
                      leaves={tab.leaves}
                      activeLeafId={tab.activeLeafId}
                      isDraggingTab={() => draggingTabId() !== null}
                      draggingPaneLeafId={draggingPaneLeafId}
                      callbacks={{
                        onActivate: (leafId) => focusLeaf(leafId),
                        onResize: resizeSplit,
                        onDropTab: handleTabDropOnLeaf,
                        onContextMenu: (leafId, x, y) =>
                          setPaneCtxMenu({ x, y, leafId }),
                        onSwapPane: handlePaneSwap,
                        onMovePane: handlePaneMove,
                      }}
                    />
                    {/* Terminal pool: rendered once per leaf at this level
                        so layout/structure changes don't unmount xterm. Each
                        PortableTerminal moves its DOM into the matching
                        .pane-leaf card via a createEffect. */}
                    <div class="terminal-pool" aria-hidden="true">
                      <For each={Object.keys(tab.leaves).map(Number)}>
                        {(leafId) => {
                          const leafAcc = () => tab.leaves[leafId];
                          return (
                            <Show when={leafAcc()}>
                              <PortableTerminal
                                leaf={leafAcc()}
                                appearance={config.appearance}
                                active={() =>
                                  isActiveTabId(tab.id) &&
                                  tab.activeLeafId === leafId
                                }
                                onSpawned={(ptyId) => {
                                  const idx = tabIndex(tab.id);
                                  if (idx === -1) return;
                                  setTabs(
                                    idx,
                                    "leaves",
                                    leafId,
                                    "ptyId",
                                    ptyId
                                  );
                                  // Run any queued command (e.g. ssh from the
                                  // SSH manager) now that the PTY exists.
                                  const pending =
                                    tabs[idx].leaves[leafId]?.pendingInput;
                                  if (pending) {
                                    setTabs(
                                      idx,
                                      "leaves",
                                      leafId,
                                      "pendingInput",
                                      null
                                    );
                                    ptyWriteText(ptyId, pending);
                                  }
                                }}
                                onExit={() => {
                                  const idx = tabIndex(tab.id);
                                  if (idx === -1) return;
                                  if (tab.activeLeafId === leafId)
                                    closeActivePane();
                                }}
                                onBlock={(ev) =>
                                  handleBlock(tab.id, leafId, ev)
                                }
                                onCwd={(cwd) =>
                                  handleCwd(tab.id, leafId, cwd)
                                }
                                onSelectionReady={(getSel) =>
                                  leafSelectionFns.set(leafId, getSel)
                                }
                                onSearchReady={(openSearch) =>
                                  leafSearchFns.set(leafId, openSearch)
                                }
                                onCopyBlock={(markerId) =>
                                  copyBlockByMarker(leafId, markerId)
                                }
                                canCopyMarker={(markerId) =>
                                  canCopyMarker(leafId, markerId)
                                }
                                onFocusReady={(focus) =>
                                  leafFocusFns.set(leafId, focus)
                                }
                                onScrollReady={(scrollTo) =>
                                  leafScrollFns.set(leafId, scrollTo)
                                }
                                onBlockLine={(markerId) =>
                                  attachMarkerToLatestBlock(
                                    leafId,
                                    markerId
                                  )
                                }
                                onRefreshReady={(refresh) =>
                                  leafRefreshFns.set(leafId, refresh)
                                }
                                onActivate={() => focusLeaf(leafId)}
                                onContextMenu={(x, y) =>
                                  setPaneCtxMenu({ x, y, leafId })
                                }
                                onPaneDragStart={(id) =>
                                  setDraggingPaneLeafId(id)
                                }
                                onPaneDragEnd={() =>
                                  setDraggingPaneLeafId(null)
                                }
                                multiPane={() =>
                                  Object.keys(tab.leaves).length > 1
                                }
                              />
                            </Show>
                          );
                        }}
                      </For>
                    </div>
                  </div>
                )}
              </For>
            </div>
            <CommandPalette
              open={paletteOpen}
              onClose={() => setPaletteOpen(false)}
              aiAvailable={() => ai()?.available ?? false}
              aiCommand={() => ai()?.command ?? ""}
              ptyId={() => activeLeaf()?.ptyId ?? null}
              onInsert={async (cmd) => {
                await insertIntoActiveTerminal(cmd);
                setPaletteOpen(false);
              }}
            />
            <WorkflowsPalette
              open={workflowsOpen}
              onClose={() => {
                setWorkflowsOpen(false);
                focusActiveTerminal();
              }}
              onInsert={(cmd) => insertIntoActiveTerminal(cmd)}
            />
            <Settings
              open={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              config={config}
              setConfig={setConfig}
              onChange={persistConfig}
              recording={recordingAction}
              onStartRecord={setRecordingAction}
              onResetBindings={resetBindings}
            />
            <SshPalette
              open={sshOpen}
              onClose={() => setSshOpen(false)}
              onConnect={(target) => {
                const title = target.includes("@")
                  ? target.split("@").pop() || target
                  : target;
                openCommandInNewTab(title, sshCommand(target));
              }}
            />
            <BlocksPanel
              blocks={visibleBlocks}
              totalBlocks={() =>
                activeLeaf()?.blocks.filter(hasCommand).length ?? 0
              }
              integrationActive={oscSeen}
              selectedBlockId={() => activeLeaf()?.selectedBlockId ?? null}
              navMode={blockNavMode}
              visible={panelVisible}
              onToggle={() => setPanelVisible(false)}
              width={panelWidth}
              onResize={setPanelWidth}
              searchOpen={searchOpen}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSearchClose={() => closeSearch(true)}
              onSearchEnterNav={(andInsert) => {
                setBlockNavMode(true);
                navigateBlocks(1);
                if (andInsert) insertSelectedBlock();
              }}
              aiAvailable={() => ai()?.available ?? false}
              aiProvider={aiProviderLabel}
              onExplain={(blockId) => {
                const t = activeTab();
                const l = activeLeaf();
                if (t && l) explainBlock(t.id, l.id, blockId);
              }}
              onCancelAi={(blockId) => {
                const t = activeTab();
                const l = activeLeaf();
                if (t && l) cancelBlockAi(t.id, l.id, blockId);
              }}
              onDismissAi={(blockId) => {
                const t = activeTab();
                const l = activeLeaf();
                if (t && l) dismissBlockAi(t.id, l.id, blockId);
              }}
              onFollowUp={(blockId, question) => {
                const t = activeTab();
                const l = activeLeaf();
                if (t && l) followUpBlock(t.id, l.id, blockId, question);
              }}
              onRemoveBlock={(blockId) => {
                const t = activeTab();
                const l = activeLeaf();
                if (t && l) removeBlock(t.id, l.id, blockId);
              }}
              onInsertBlock={(blockId) => {
                const l = activeLeaf();
                if (!l) return;
                const b = l.blocks.find((bl) => bl.id === blockId);
                if (b?.command) insertIntoActiveTerminal(b.command);
              }}
              onScrollToBlock={scrollToBlock}
            />
            <RemoteDialog
              open={remoteDialogOpen}
              info={remoteInfo}
              installing={remoteInstalling}
              onEnableTunnel={enableTunnel}
              onStop={stopRemoteControl}
              onClose={() => setRemoteDialogOpen(false)}
            />
          </div>
        </div>
    </Show>
  );
}
