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
import { b64ToString, b64ToStringAsync, isLargeB64, stripAnsi } from "./blocks";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  aiCancel,
  aiChat,
  aiErrorText,
  aiExplainBlock,
  aiStatus,
  type AiChunkEvent,
  type AiDoneEvent,
  type AiErrorEvent,
  type AiStatus,
  type BlockContext,
  type ChatMessage,
} from "./ai";
import { invoke } from "@tauri-apps/api/core";
import Palette, { type PaletteItem, type PromptRequest } from "./Palette";
import WorkflowsPalette from "./WorkflowsPalette";
import SshPalette from "./SshPalette";
import {
  isRemoteSessionCommand,
  listSshHosts,
  sshCommand,
  sshPrefs,
  sshFavorites,
  sshRecents,
  pushSshRecent,
  type SshHost,
  type SshPrefs,
} from "./ssh";
import { historyAppend, historyClear, gitInfo, homeRelative } from "./history";
import {
  deleteWorkspace,
  expandPath,
  isSplit,
  listWorkspaces,
  saveWorkspace,
  workspaceFilePath,
  wsCommands,
  type Workspace,
  type WsNode,
} from "./workspaces";
import { listWorkflows, type Workflow } from "./workflows";
import { THEME_PRESETS } from "./themes";
import { loadCustomFonts } from "./fonts";
import { copyText, pasteText } from "./clipboard";
import UsagePill, { UsageCard } from "./UsagePill";
import { listenUsage, refreshPlanUsage, resetPlanUsage, startPlanPolling } from "./usage";
import {
  remoteClientForget,
  remoteClientNewTab,
  remoteClientPeers,
  remoteClientSwitch,
  remoteInstallCloudflared,
  remoteNewPairing,
  remoteRevokeDevice,
  remoteSetTabs,
  remoteSetTarget,
  remoteStart,
  remoteStatus,
  remoteStop,
  type RemoteClientTabs,
  type RemoteInfo,
  type RemotePeer,
} from "./remote";
import FileTree from "./FileTree";
import CloseConfirm, {
  type CloseConfirmTarget,
  type RunningCommand,
} from "./CloseConfirm";
import RemoteDialog from "./RemoteDialog";
import WorkspaceMenu from "./WorkspaceMenu";
import UpdateBanner from "./UpdateBanner";
import { setLocale, t } from "./i18n";
import {
  IconBlocks,
  IconBranch,
  IconHistory,
  IconRefresh,
  IconSearch,
  IconSparkles,
  IconTheme,
  IconWorkspace,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconClipboard,
  IconCopy,
  IconFolder,
  IconLayouts,
  IconPencil,
  IconPlus,
  IconRemote,
  IconSettings,
  IconSmartphone,
  IconSplitH,
  IconSplitV,
  IconSsh,
  IconWorkflow,
  IconX,
} from "./icons";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { homeDir } from "@tauri-apps/api/path";
import {
  ACTIONS,
  comboToAction,
  comboToLabel,
  eventToCombo,
  modKey,
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

type PersistedLeaf = {
  id: number;
  cwd: string | null;
  remote?: { url: string; serverName?: string } | null;
};
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

/** Recent command blocks per pane, kept across restarts (BlocksPanel history,
 *  "explain" on yesterday's failure). Output is tail-truncated. */
const BLOCKS_KEY = "lume.blocks.v1";
const PERSIST_BLOCKS_PER_LEAF = 30;
const PERSIST_OUTPUT_CHARS = 4000;
type PersistedBlock = {
  c: string;
  o: string | null;
  s: number;
  f: number | null;
  x: number | null;
};

function loadPersistedBlocks(): Record<string, PersistedBlock[]> {
  try {
    const raw = localStorage.getItem(BLOCKS_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function restoreBlocks(list: PersistedBlock[] | undefined): Block[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((b) => b && typeof b.c === "string")
    .map((b, i) => ({
      id: i,
      command: b.c,
      output: b.o ?? null,
      startedAt: b.s,
      finishedAt: b.f ?? null,
      exitCode: b.x ?? null,
      status: "done" as const,
      ai: null,
      // No scrollback row in this new terminal to point at.
      markerId: -1,
    }));
}

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

    const persistedBlocks = loadPersistedBlocks();
    const tabs: TabState[] = [];
    for (const pt of data.tabs) {
      if (!pt || !pt.tree) continue;
      const ids = leafIds(pt.tree);
      if (ids.length === 0) continue;
      const byId = new Map((pt.leaves ?? []).map((l) => [l.id, l] as const));
      const leaves: Record<number, LeafData> = {};
      for (const lid of ids) {
        const pl = byId.get(lid);
        const leaf = makeLeafWithId(lid, pl?.cwd ?? null, pl?.remote ?? null);
        leaf.blocks = restoreBlocks(persistedBlocks[String(lid)]);
        leaf.nextBlockId = leaf.blocks.length;
        leaves[lid] = leaf;
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
  /** Prefix the palette opens with: "" actions, "!" history, "?" AI. */
  const [paletteInitial, setPaletteInitial] = createSignal("");
  const openPalette = (prefix = "") => {
    setPaletteInitial(prefix);
    setPaletteOpen(true);
  };
  /** Workflow to open directly in the workflows palette (from the palette). */
  const [workflowPreselect, setWorkflowPreselect] = createSignal<string | null>(null);
  // Which extra context "explain this block" sends — opt-in, remembered.
  const [aiContext, setAiContext] = createSignal<{ env: boolean; prev: boolean }>(
    (() => {
      try {
        const v = JSON.parse(localStorage.getItem("lume.ai.ctx") ?? "null");
        if (v && typeof v === "object") return { env: !!v.env, prev: !!v.prev };
      } catch {}
      return { env: false, prev: false };
    })()
  );
  createEffect(() => {
    try {
      localStorage.setItem("lume.ai.ctx", JSON.stringify(aiContext()));
    } catch {}
  });
  /** Terminals offered by the remote Lumes this one is a client of, keyed by
   *  the local session (pty) id of the pane showing them. */
  const [remoteClientTabs, setRemoteClientTabs] = createSignal<
    Record<number, RemoteClientTabs>
  >({});
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
  /** Workspaces dropdown (▾ next to the tab bar's +), anchored to its button. */
  const [wsMenuAnchor, setWsMenuAnchor] = createSignal<DOMRect | null>(null);
  const wsMenuOpen = () => wsMenuAnchor() !== null;

  // Native grid (Linux): terminal pixels are painted by a native layer above
  // the webview. The grid never yields to xterm anymore — DOM overlays stay
  // visible through per-element overlay rects (see OVERLAY_SEL below); this
  // effect resyncs those rects the instant a modal opens or closes, and
  // mirrors the modal backdrop veil onto the native layer (the DOM backdrop
  // sits under the grid's paint, so the grid dims its own pixels with the
  // same rgba(0,0,0,0.4) — the modal box itself is a hole, left undimmed).
  createEffect(() => {
    const backdropOpen =
      settingsOpen() ||
      paletteOpen() ||
      workflowsOpen() ||
      sshOpen() ||
      wsConfirm() !== null ||
      remoteDialogOpen();
    layoutsOpen();
    wsMenuOpen();
    draggingTabId();
    draggingPaneLeafId();
    // Context menus are overlay rects too: the native grid must learn their
    // geometry the instant they open/close, not on the next mousemove — the
    // grid is clipped out of reported rects, so a stale list means either a
    // repainted strip over a fresh menu or an unpainted hole after it closes.
    paneCtxMenu();
    tabCtxMenu();
    window.dispatchEvent(new Event("lume-overlay-sync"));
    invoke("native_grid_set_dim", { alpha: backdropOpen ? 0.4 : 0 }).catch(
      () => {}
    );
  });

  // Native grid (Linux): small DOM affordances that pop up OVER a pane (drag
  // grip, per-block copy button, context menus, block flash) must stay
  // visible above the native layer. Report their on-screen rects so the grid
  // leaves those pixels unpainted — generic: add the class of any future
  // pane-covering affordance to the selector.
  if (navigator.userAgent.includes("Linux")) {
    const OVERLAY_SEL =
      '.pane-grip, .lume-block-copy, .lume-block-flash, .lume-autocomplete, .lume-ghost, [class*="context-menu"], [class*="ctx-menu"], ' +
      // Full DOM overlays (modals, palettes, search bar, pane drop zones):
      // the grid paints around these rects instead of yielding to xterm.
      ".settings-panel, .palette, .layouts-popup, .remote-slideover, .term-search, .pane-drop-zone, .usage-card, .ssh-lost-bar, .lume-toast, .ws-menu";
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
          if (r.width > 0 && r.height > 0) {
            // Round the EDGES outward, not the size: a popup centred at a
            // fractional x (230.5) with floor(left) + ceil(width) stopped
            // half a pixel short, and the grid repainted its right/bottom
            // border. One extra pixel covers the anti-aliased edge too.
            const x0 = Math.floor(r.left) - 1;
            const y0 = Math.floor(r.top) - 1;
            const x1 = Math.ceil(r.right) + 1;
            const y1 = Math.ceil(r.bottom) + 1;
            rects.push([x0, y0, x1 - x0, y1 - y0]);
          }
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
    window.addEventListener("lume-overlay-sync", syncOverlayRects);
    document.addEventListener("mousedown", syncOverlayRects, true);
    document.addEventListener("mouseup", syncOverlayRects, true);
    // Every popup opens with an animation (slide / fade-in): a rect measured
    // on the opening frame is offset by the slide, and the grid painted over
    // the popup's bottom edge until the next mousemove or poll. Re-measure
    // once each animation or transition settles.
    document.addEventListener("animationend", syncOverlayRects, true);
    document.addEventListener("transitionend", syncOverlayRects, true);
    // Safety net for non-mouse triggers (keyboard-opened menus, animations).
    const overlayPoll = setInterval(syncOverlayRects, 300);
    onCleanup(() => {
      document.removeEventListener("mousemove", syncOverlayRects);
      window.removeEventListener("lume-overlay-sync", syncOverlayRects);
      document.removeEventListener("mousedown", syncOverlayRects, true);
      document.removeEventListener("mouseup", syncOverlayRects, true);
      document.removeEventListener("animationend", syncOverlayRects, true);
      document.removeEventListener("transitionend", syncOverlayRects, true);
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

  // Blocks and tabs can shift while an ai call is in flight (block removed,
  // MAX_BLOCKS_PER_LEAF eviction, tab reorder): indices captured before an
  // await go stale and would write the ai state onto a NEIGHBOUR block —
  // always re-resolve by id right before touching the store.
  const locateBlock = (tabId: number, leafId: number, blockId: number) => {
    const tIdx = tabIndex(tabId);
    if (tIdx === -1) return null;
    const leaf = tabs[tIdx].leaves[leafId];
    if (!leaf) return null;
    const bIdx = leaf.blocks.findIndex((b) => b.id === blockId);
    if (bIdx === -1) return null;
    return { tIdx, bIdx, block: leaf.blocks[bIdx] };
  };

  const explainBlock = async (
    tabId: number,
    leafId: number,
    blockId: number
  ) => {
    const loc = locateBlock(tabId, leafId, blockId);
    if (!loc) return;
    const block = loc.block;
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

    {
      const l = locateBlock(tabId, leafId, blockId);
      if (!l) return;
      setTabs(l.tIdx, "leaves", leafId, "blocks", l.bIdx, "ai", {
        status: "streaming",
        response: "",
        requestId: null,
        error: null,
        history: [],
      });
    }

    // Opt-in context (toggles at the bottom of the blocks panel).
    const ctx = aiContext();
    let context: BlockContext | null = null;
    if (ctx.env || ctx.prev) {
      const leaf = tabs[loc.tIdx]?.leaves[leafId];
      context = {};
      if (ctx.env && leaf) {
        context.cwd = leaf.remote ? null : leaf.cwd;
        context.branch = leaf.gitBranch ?? null;
      }
      if (ctx.prev && leaf) {
        const idx = leaf.blocks.findIndex((b) => b.id === blockId);
        for (let j = idx - 1; j >= 0; j--) {
          const p = leaf.blocks[j];
          if (hasCommand(p)) {
            context.previous = {
              command: p.command!,
              output: p.output ? p.output.slice(-4000) : null,
              exitCode: p.exitCode,
            };
            break;
          }
        }
      }
    }

    try {
      const requestId = await aiExplainBlock({
        command: block.command,
        output: block.output,
        exitCode: block.exitCode ?? 0,
        context,
      });
      const l = locateBlock(tabId, leafId, blockId);
      if (!l || !l.block.ai) {
        aiCancel(requestId).catch(() => {});
        return;
      }
      setTabs(l.tIdx, "leaves", leafId, "blocks", l.bIdx, "ai", "requestId", requestId);
    } catch (e) {
      const l = locateBlock(tabId, leafId, blockId);
      if (!l || !l.block.ai) return;
      setTabs(l.tIdx, "leaves", leafId, "blocks", l.bIdx, "ai", {
        status: "error",
        error: aiErrorText(String(e)),
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
    const loc = locateBlock(tabId, leafId, blockId);
    if (!loc) return;
    const block = loc.block;
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

    setTabs(loc.tIdx, "leaves", leafId, "blocks", loc.bIdx, "ai", {
      status: "streaming",
      response: "",
      requestId: null,
      error: null,
      history: [...history, { role: "user", content: question.trim() }],
    });

    try {
      const requestId = await aiChat(messages);
      const l = locateBlock(tabId, leafId, blockId);
      if (!l || !l.block.ai) {
        aiCancel(requestId).catch(() => {});
        return;
      }
      setTabs(l.tIdx, "leaves", leafId, "blocks", l.bIdx, "ai", "requestId", requestId);
    } catch (e) {
      const l = locateBlock(tabId, leafId, blockId);
      if (!l || !l.block.ai) return;
      setTabs(l.tIdx, "leaves", leafId, "blocks", l.bIdx, "ai", {
        status: "error",
        error: aiErrorText(String(e)),
      });
    }
  };

  const cancelBlockAi = async (
    tabId: number,
    leafId: number,
    blockId: number
  ) => {
    const loc = locateBlock(tabId, leafId, blockId);
    if (!loc) return;
    const ai = loc.block.ai;
    if (ai?.requestId !== null && ai?.requestId !== undefined) {
      try {
        await aiCancel(ai.requestId);
      } catch {}
    }
    const l = locateBlock(tabId, leafId, blockId);
    if (!l) return;
    setTabs(l.tIdx, "leaves", leafId, "blocks", l.bIdx, "ai", null);
  };

  // Per-leaf focus/scroll/refresh callbacks, registered by each Terminal on mount.
  const leafFocusFns = new Map<number, () => void>();
  const leafSelectionFns = new Map<number, () => string>();
  const leafPasteFns = new Map<number, (text: string) => void>();
  const leafAltScreenFns = new Map<number, () => boolean>();
  const leafSearchFns = new Map<number, () => void>();

  // Desktop notification when a long command finishes while Lume is in the
  // background. Run-start time is tracked per leaf (output start → output end).
  // Uses the Tauri notification plugin (the Web Notification API is unreliable
  // under WebKitGTK). Toggle + threshold live in config.notifications.
  const commandRunStart = new Map<number, number>();
  /** Where each pane's running command was launched (cwd + branch at 133;C):
   *  a `cd` or `git checkout` changes them before the command's 133;D. */
  const commandStartCtx = new Map<number, { cwd: string | null; branch: string | null }>();

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
          title: `Test Lume #${testNotifN}`,
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
    // "\r" is the Enter key on every platform; a bare "\n" reaches
    // PowerShell (through ConPTY) as Ctrl+Enter, which inserts a line.
    leaf.pendingInput = command.replace(/[\r\n]+$/, "") + "\r";
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
    // The usage pill follows the provider too: clear the old numbers before
    // asking the new one, so no stale ring survives the switch.
    resetPlanUsage();
    void refreshPlanUsage(0);
  });

  // When a remote client taps "+", point THAT connection at the new tab once
  // its pty spawns (a freshly-created leaf has ptyId === null for a moment).
  const [remoteFocus, setRemoteFocus] = createSignal<{
    tabId: number;
    conn: number | null;
  } | null>(null);
  createEffect(() => {
    const f = remoteFocus();
    if (f === null) return;
    const tab = tabs.find((t) => t.id === f.tabId);
    const pid = tab?.leaves[tab.activeLeafId]?.ptyId;
    if (typeof pid === "number") {
      void remoteSetTarget(pid, f.conn).catch(() => {});
      setRemoteFocus(null);
    }
  });

  // Pending "a command is still running" confirmation, null when none is up.
  const [closeConfirm, setCloseConfirm] =
    createSignal<CloseConfirmTarget | null>(null);

  // Remote-control dialog (opened from the pane context menu, not Settings).
  const [remoteDialogOpen, setRemoteDialogOpen] = createSignal(false);
  const [remoteInfo, setRemoteInfo] = createSignal<RemoteInfo | null>(null);
  let remotePollTimer: ReturnType<typeof setInterval> | undefined;
  const stopRemotePoll = () => {
    if (remotePollTimer) clearInterval(remotePollTimer);
    remotePollTimer = undefined;
  };

  // Publish the tab list to remote clients so the phone can switch terminals.
  // The phone picks its own target (decoupled from the desktop's focus); the
  // initial target is set when remote control starts. Gated on the server
  // actually running: every cd/title change re-runs this effect, and most
  // sessions never start the remote — don't cross the IPC for nothing. When
  // `running` flips true the effect re-runs and pushes the current list.
  createEffect(() => {
    if (!remoteInfo()?.running) return;
    // Every pane is reachable (not just each tab's focused one). Panes that
    // are themselves a client of another Lume are never re-shared.
    const list: { id: number; title: string }[] = [];
    for (const t of tabs) {
      const ids = leafIds(t.tree);
      ids.forEach((lid, i) => {
        const l = t.leaves[lid];
        if (!l || l.remote || typeof l.ptyId !== "number") return;
        list.push({
          id: l.ptyId,
          title: ids.length > 1 ? `${t.title} · ${i + 1}` : t.title,
        });
      });
    }
    void remoteSetTabs(list).catch(() => {});
  });
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
      const port = config.remote?.port || 4530;
      const info = status.running
        ? status
        : await remoteStart(port, status.tunnelAvailable && config.remote?.autoTunnel !== false);
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
      // Already installed (auto-tunnel turned off in settings): just restart
      // the share with the tunnel on.
      if (!remoteInfo()?.tunnelAvailable) await remoteInstallCloudflared();
      await remoteStop();
      const port = config.remote?.port || 4530;
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

  const insertIntoActiveTerminal = async (text: string, execute = false) => {
    const leaf = activeLeaf();
    if (!leaf || leaf.ptyId === null) return;
    // Interior newlines act as Enter in the PTY: a multi-line AI answer or a
    // hostile file name would execute on "insert". Flatten them — only the
    // explicit `execute` path sends the single trailing newline.
    const flat = text.replace(/[\r\n]+/g, " ");
    const payload = execute ? flat.trimEnd() + "\r" : flat;
    const bytes = new TextEncoder().encode(payload);
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
  // Same as addTab, but flags the new tab so the remote client that asked
  // for it follows it.
  const addTabFromRemote = (conn: number | null) => {
    const tab = makeEmptyTab();
    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
    setRemoteFocus({ tabId: tab.id, conn });
  };

  // --- Lume ↔ Lume: a pane showing a terminal of another Lume ---

  const openRemoteLume = (url: string, title?: string) => {
    const leaf = makeLeaf();
    leaf.remote = { url };
    const tab: TabState = {
      id: nextTabId++,
      title: title || t("remoteClient.tabTitle"),
      tree: { type: "leaf", leafId: leaf.id },
      leaves: { [leaf.id]: leaf },
      activeLeafId: leaf.id,
      lockTitle: true,
    };
    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
  };

  const onRemoteLeafConnected = (
    tabId: number,
    leafId: number,
    info: { serverName: string; url: string }
  ) => {
    const tIdx = tabIndex(tabId);
    if (tIdx === -1 || !tabs[tIdx].leaves[leafId]) return;
    // Persist the address WITHOUT the one-time pairing secret.
    setTabs(tIdx, "leaves", leafId, "remote", { url: info.url, serverName: info.serverName });
    if (leafIds(tabs[tIdx].tree).length === 1) setTabs(tIdx, "title", info.serverName);
  };

  // --- Workspaces ---

  const tildify = (p: string | null): string | null => {
    if (!p) return null;
    const rel = homeRelative(p, userHome());
    return rel === null ? p : rel === "" ? "~" : "~/" + rel;
  };

  /** Snapshot of the open tabs as a workspace: layouts, cwds, titles — and,
   *  as startup commands, whatever each pane is running right now (a dev
   *  server, a queue worker…), so "save" captures the usual setup. */
  /** What "save as workspace" captures: the active tab, or every tab. */
  type WsScope = "tab" | "all";
  const sessionToWorkspace = (name: string, scope: WsScope = "all"): Workspace => {
    const toWs = (node: TreeNode, tab: TabState): WsNode => {
      if (node.type === "leaf") {
        const l = tab.leaves[node.leafId];
        if (!l || l.remote) return {};
        const last = l.blocks[l.blocks.length - 1];
        const running =
          last?.status === "running" && (last.command ?? "").trim()
            ? last.command!.trim()
            : null;
        return { cwd: tildify(l.cwd), command: running };
      }
      return {
        split: node.direction,
        ratio: Math.round(node.ratio * 1000) / 1000,
        children: node.children.map((c) => toWs(c, tab)),
      };
    };
    return {
      name,
      tabs: (scope === "tab" ? tabs.filter((tab) => tab.id === activeId()) : tabs).map(
        (tab) => ({
          title: tab.lockTitle ? tab.title : null,
          layout: toWs(tab.tree, tab),
        })
      ),
    };
  };

  /** Open a workspace as new tabs. Startup commands only run when asked. */
  const openWorkspace = async (ws: Workspace, withCommands: boolean) => {
    const opened: TabState[] = [];
    for (const wt of ws.tabs) {
      const leaves: Record<number, LeafData> = {};
      let count = 0;
      let firstCwd: string | null = null;
      const build = async (node: WsNode): Promise<TreeNode | null> => {
        if (isSplit(node)) {
          const kids = node.children.filter(Boolean);
          if (kids.length === 0) return build({});
          if (kids.length === 1) return build(kids[0]);
          const first = await build(kids[0]);
          const rest =
            kids.length === 2
              ? await build(kids[1])
              : await build({ split: node.split, children: kids.slice(1) });
          if (!first) return rest;
          if (!rest) return first;
          const ratio =
            kids.length === 2 && typeof node.ratio === "number"
              ? Math.min(0.9, Math.max(0.1, node.ratio))
              : 1 / kids.length;
          return makeSplit(node.split === "column" ? "column" : "row", first, rest, ratio);
        }
        if (count >= MAX_PANES_PER_TAB) return null;
        count++;
        const leaf = makeLeaf();
        const cwd = node.cwd ? await expandPath(node.cwd).catch(() => node.cwd!) : null;
        leaf.cwd = cwd;
        firstCwd ??= cwd;
        const cmd = (node.command ?? "").trim();
        if (withCommands && cmd) leaf.pendingInput = cmd + "\r";
        leaves[leaf.id] = leaf;
        return { type: "leaf", leafId: leaf.id };
      };
      const tree = (await build(wt.layout)) ?? (await build({}))!;
      const ids = leafIds(tree);
      const fallbackTitle =
        (firstCwd ?? "").split(/[\\/]/).filter(Boolean).pop() || ws.name;
      opened.push({
        id: nextTabId++,
        title: wt.title || fallbackTitle,
        tree,
        leaves,
        activeLeafId: ids[0],
        lockTitle: !!wt.title,
      });
    }
    if (!opened.length) return;
    setTabs((prev) => [...prev, ...opened]);
    setActiveId(opened[0].id);
  };

  /** Default "open" of a workspace, per the settings: run its commands,
   *  ask first, or never run them. */
  const [wsConfirm, setWsConfirm] = createSignal<Workspace | null>(null);
  const openWorkspaceByPolicy = (ws: Workspace) => {
    const mode = config.workspaces?.runCommands ?? "always";
    if (mode === "never" || wsCommands(ws).length === 0) return void openWorkspace(ws, false);
    if (mode === "ask") return void setWsConfirm(ws);
    void openWorkspace(ws, true);
  };

  const posixQuote = (s: string) =>
    /^[A-Za-z0-9_@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;

  /** Open a file in the user's editor, in a new tab (file-tree edit command). */
  const editFileInNewTab = (title: string, path: string) => {
    const tpl = config.fileTree.fileEdit || "${EDITOR:-nano} {path}";
    // split/join, not replace(): a `$&` or `$'` in the path must stay literal.
    openCommandInNewTab(title, tpl.split("{path}").join(posixQuote(path)));
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

  // Raw close, no questions asked. Everything user-facing goes through the
  // guarded `closeTab` below.
  const closeTabNow = (id: number) => {
    const tab = tabs.find((t) => t.id === id);
    if (tab) {
      // Clean up callback registries for all leaves in this tab.
      for (const key of Object.keys(tab.leaves)) {
        const leafId = Number(key);
        leafFocusFns.delete(leafId);
        leafScrollFns.delete(leafId);
        leafRefreshFns.delete(leafId);
        leafSelectionFns.delete(leafId);
        leafPasteFns.delete(leafId);
        leafAltScreenFns.delete(leafId);
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

  const closeLeafNow = (tabId: number, toClose: number) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const ids = leafIds(tab.tree);
    if (ids.length === 1) {
      // Only one pane → behave like closing the tab.
      closeTabNow(tab.id);
      return;
    }
    const tIdx = tabIndex(tab.id);
    const newTree = removeLeaf(tab.tree, toClose);
    if (!newTree) return;

    const remaining: Record<number, LeafData> = {};
    for (const key of Object.keys(tab.leaves)) {
      const lid = Number(key);
      if (lid !== toClose) remaining[lid] = tab.leaves[lid];
    }
    setTabs(tIdx, "tree", newTree);
    setTabs(tIdx, "leaves", remaining);
    if (tab.activeLeafId === toClose) {
      const newIds = leafIds(newTree);
      setTabs(tIdx, "activeLeafId", newIds[0]);
    }
    leafFocusFns.delete(toClose);
    leafScrollFns.delete(toClose);
    leafRefreshFns.delete(toClose);
    leafSelectionFns.delete(toClose);
    leafPasteFns.delete(toClose);
    leafAltScreenFns.delete(toClose);
    leafSearchFns.delete(toClose);
  };

  // --- Close confirmation when a command is still running ---
  // Killing a pane kills its PTY, and the shell's children with it: an
  // interrupted build/deploy/ssh would vanish without a word. A pane counts as
  // busy when its last block is still `running` — set by OSC 133;C, cleared by
  // 133;D. Shells without shell integration never report it, so for them
  // closing stays as silent as before (nothing to detect with).
  const runningInLeaf = (
    tab: TabState,
    leafId: number
  ): RunningCommand | null => {
    const leaf = tab.leaves[leafId];
    if (!leaf) return null;
    const last = leaf.blocks[leaf.blocks.length - 1];
    if (!last || last.status !== "running") return null;
    return { leafId, command: last.command, startedAt: last.startedAt };
  };

  const closeTab = (id: number) => {
    const tab = tabs.find((t) => t.id === id);
    if (!tab) return;
    const busy = leafIds(tab.tree)
      .map((lid) => runningInLeaf(tab, lid))
      .filter((c): c is RunningCommand => c !== null);
    if (busy.length > 0) {
      setCloseConfirm({
        kind: "tab",
        tabId: id,
        leafId: null,
        commands: busy,
      });
      return;
    }
    closeTabNow(id);
  };

  const closeLeaf = (tabId: number, toClose: number) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const busy = runningInLeaf(tab, toClose);
    if (busy) {
      setCloseConfirm({
        // Last pane of the tab → this really closes the tab, say so.
        kind: leafIds(tab.tree).length === 1 ? "tab" : "pane",
        tabId,
        leafId: toClose,
        commands: [busy],
      });
      return;
    }
    closeLeafNow(tabId, toClose);
  };

  const confirmClose = () => {
    const target = closeConfirm();
    setCloseConfirm(null);
    if (!target) return;
    // The command may have finished — or the shell exited — while we asked.
    const tab = tabs.find((t) => t.id === target.tabId);
    if (!tab) return;
    if (target.leafId === null) closeTabNow(target.tabId);
    else if (tab.leaves[target.leafId]) closeLeafNow(target.tabId, target.leafId);
  };

  const closeActivePane = () => {
    const tab = activeTab();
    if (!tab) return;
    closeLeaf(tab.id, tab.activeLeafId);
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
      leafPasteFns.delete(oldId);
      leafAltScreenFns.delete(oldId);
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
    // Route through xterm's paste so the text gets proper terminal semantics:
    // \n → \r conversion and bracketed-paste wrapping when the app enabled it.
    // Writing the clipboard raw to the PTY loses multi-line pastes (bare LFs
    // are ignored by most raw-mode apps).
    const paste = leafPasteFns.get(leafId);
    if (paste) {
      paste(text);
      return;
    }
    ptyWriteText(leaf.ptyId, text.replace(/\r?\n/g, "\r"));
  };

  // Dismiss pane context menu on click outside / escape.
  createEffect(() => {
    if (!paneCtxMenu()) return;
    const onAnyClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest(".pane-context-menu")) setPaneCtxMenu(null);
    };
    // Capture phase: the terminal's own key handler forwards Escape to the
    // PTY and stops propagation, so a bubble-phase listener never sees it and
    // the menu stayed open.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        setPaneCtxMenu(null);
      }
    };
    window.addEventListener("mousedown", onAnyClick);
    window.addEventListener("keydown", onKey, true);
    onCleanup(() => {
      window.removeEventListener("mousedown", onAnyClick);
      window.removeEventListener("keydown", onKey, true);
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
    // Capture phase — see the pane menu above: the terminal swallows Escape.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        setTabCtxMenu(null);
      }
    };
    window.addEventListener("mousedown", onAnyClick);
    window.addEventListener("keydown", onKey, true);
    onCleanup(() => {
      window.removeEventListener("mousedown", onAnyClick);
      window.removeEventListener("keydown", onKey, true);
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
        // Re-stamp startedAt at execution: the block is created when the
        // PROMPT is shown, and the duration badge must not count the time the
        // user spent typing/thinking at it.
        setTabs(tIdx, "leaves", leafId, "blocks", lastIdx, {
          status: "running" as const,
          startedAt: Date.now(),
        });
        commandRunStart.set(leafId, Date.now());
        commandStartCtx.set(leafId, { cwd: leaf.cwd, branch: leaf.gitBranch ?? null });
        if (leaf.sshLost) setTabs(tIdx, "leaves", leafId, "sshLost", null);
        break;
      }
      case "outputEnd": {
        const blocks = leaf.blocks;
        if (blocks.length === 0) return;
        const lastIdx = blocks.length - 1;
        // Small captures (the common case) decode inline; large ones decode
        // asynchronously so the prompt's return doesn't hitch the input.
        const large = isLargeB64(ev.outputB64);
        const output = !large && ev.outputB64 ? b64ToString(ev.outputB64) : null;
        setTabs(tIdx, "leaves", leafId, "blocks", lastIdx, {
          status: "done",
          finishedAt: Date.now(),
          exitCode: ev.exitCode,
          output,
        });
        if (large) {
          const blockId = blocks[lastIdx].id;
          void b64ToStringAsync(ev.outputB64!).then((decoded) => {
            const l = locateBlock(tabId, leafId, blockId);
            if (l) {
              setTabs(l.tIdx, "leaves", leafId, "blocks", l.bIdx, "output", decoded);
            }
          });
        }
        // Rich history: the command + the context it ran in.
        {
          const l = tabs[tIdx].leaves[leafId];
          const b = l?.blocks[lastIdx];
          const cmd = (b?.command ?? "").trim();
          const startCtx = commandStartCtx.get(leafId);
          commandStartCtx.delete(leafId);
          if (l && b && cmd) {
            void historyAppend({
              cmd: b.command!,
              cwd: startCtx ? startCtx.cwd : l.cwd,
              exit: ev.exitCode,
              ts: b.startedAt,
              dur: Date.now() - b.startedAt,
              branch: startCtx ? startCtx.branch : l.gitBranch ?? null,
            }).catch(() => {});
            // An ssh/mosh session that dropped (ssh exits 255 on network
            // errors): offer to reconnect in place.
            if (ev.exitCode === 255 && isRemoteSessionCommand(cmd)) {
              setTabs(tIdx, "leaves", leafId, "sshLost", cmd);
            }
          }
          // The command may have switched branch (checkout, rebase…).
          refreshGit(tabId, leafId);
        }
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

  /** Re-read the git branch of a pane's cwd (cheap: reads .git/HEAD). */
  const refreshGit = (tabId: number, leafId: number) => {
    const tIdx = tabIndex(tabId);
    const cwd = tabs[tIdx]?.leaves[leafId]?.cwd;
    if (tIdx === -1 || !cwd || tabs[tIdx].leaves[leafId]?.remote) return;
    gitInfo(cwd)
      .then((g) => {
        const i = tabIndex(tabId);
        const l = tabs[i]?.leaves[leafId];
        if (!l || l.cwd !== cwd) return; // moved on meanwhile
        const branch = g?.branch ?? null;
        if (l.gitBranch !== branch) setTabs(i, "leaves", leafId, "gitBranch", branch);
      })
      .catch(() => {});
  };

  /** Branch shown on a tab: its active pane's — hidden while that pane runs
   *  an ssh session (the branch is the LOCAL one, misleading there). */
  const tabBranch = (tab: TabState): string | null => {
    if (config.behavior?.showGitBranch === false) return null;
    const l = tab.leaves[tab.activeLeafId];
    if (!l || l.remote || !l.gitBranch) return null;
    const last = l.blocks[l.blocks.length - 1];
    if (last?.status === "running" && isRemoteSessionCommand(last.command)) return null;
    return l.gitBranch;
  };

  const handleCwd = (tabId: number, leafId: number, cwd: string) => {
    const tIdx = tabIndex(tabId);
    if (tIdx === -1) return;
    // Always record each pane's cwd so the session can be restored to it.
    if (tabs[tIdx].leaves[leafId]) {
      setTabs(tIdx, "leaves", leafId, "cwd", cwd);
      refreshGit(tabId, leafId);
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
      openPalette("");
    },
    history: (e) => {
      e.preventDefault();
      openPalette("!");
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

  // --- Command palette: every action, workspace, host, workflow, theme… ---

  const [paletteData, setPaletteData] = createSignal<{
    workspaces: Workspace[];
    hosts: SshHost[];
    workflows: Workflow[];
    peers: RemotePeer[];
    sshPrefs: Record<string, SshPrefs>;
  }>({ workspaces: [], hosts: [], workflows: [], peers: [], sshPrefs: {} });
  const reloadPaletteData = () =>
    Promise.all([
      listWorkspaces().catch(() => [] as Workspace[]),
      listSshHosts().catch(() => [] as SshHost[]),
      listWorkflows().catch(() => [] as Workflow[]),
      remoteClientPeers().catch(() => [] as RemotePeer[]),
    ]).then(([workspaces, hosts, workflows, peers]) =>
      setPaletteData({ workspaces, hosts, workflows, peers, sshPrefs: sshPrefs() })
    );
  createEffect(() => {
    if (paletteOpen() || wsMenuOpen()) void reloadPaletteData();
  });

  const bindingLabel = (id: ActionId) => {
    const combo = resolveBindings(config.keybindings)[id];
    return combo ? comboToLabel(combo) : undefined;
  };

  /** A host's options, with the settings' tmux default for hosts the user
   *  never toggled. */
  const effectiveSshPrefs = (prefs: SshPrefs | undefined): SshPrefs => ({
    ...prefs,
    tmux: prefs?.tmux ?? !!config.ssh?.tmuxByDefault,
  });
  const connectSsh = (target: string, prefs: SshPrefs) => {
    const title = target.includes("@") ? target.split("@").pop() || target : target;
    pushSshRecent(target);
    openCommandInNewTab(
      title,
      sshCommand(target, effectiveSshPrefs(prefs), config.ssh?.tmuxSession || "lume")
    );
  };

  const confirmPrompt = (
    title: string,
    expected: string,
    action: () => Promise<void> | void
  ): PromptRequest => ({
    kind: "prompt",
    title,
    placeholder: expected,
    onSubmit: async (v) => {
      if (v.trim() !== expected) throw new Error(t("palette.confirmMismatch"));
      await action();
    },
  });

  /** An existing workspace with this name (saving again replaces it). */
  const workspaceNamed = (name: string) =>
    paletteData().workspaces.find(
      (w) => w.name.trim().toLowerCase() === name.trim().toLowerCase()
    );

  const workspaceOps = {
    save: async (name: string, scope: WsScope) => {
      const existing = workspaceNamed(name);
      await saveWorkspace(
        { ...sessionToWorkspace(name.trim(), scope), description: existing?.description },
        existing?.source ?? null
      );
      flashToast(t("palette.wsSaved", { name }));
      await reloadPaletteData();
    },
    /** Replace with the current state, keeping the workspace's scope: a
     *  one-tab workspace takes the active tab, a multi-tab one every tab. */
    update: async (ws: Workspace) => {
      await saveWorkspace(
        {
          ...sessionToWorkspace(ws.name, ws.tabs.length > 1 ? "all" : "tab"),
          description: ws.description,
        },
        ws.source ?? null
      );
      flashToast(t("palette.wsSaved", { name: ws.name }));
      void reloadPaletteData();
    },
    edit: async (ws: Workspace) =>
      editFileInNewTab(ws.name, await workspaceFilePath(ws.source!)),
    remove: async (ws: Workspace) => {
      await deleteWorkspace(ws.source!);
      void reloadPaletteData();
    },
  };

  const paletteItems = createMemo<PaletteItem[]>(() => {
    if (!paletteOpen()) return [];
    const d = paletteData();
    const G = {
      term: t("palette.groupTerminal"),
      ws: t("palette.groupWorkspace"),
      hist: t("palette.groupHistory"),
      ssh: "SSH",
      wf: t("palette.groupWorkflow"),
      remote: t("palette.groupRemote"),
      ai: t("palette.groupAi"),
      look: t("palette.groupAppearance"),
      lume: "Lume",
    };
    const items: PaletteItem[] = [];
    const add = (it: PaletteItem) => items.push(it);

    // --- Terminal ---
    add({ id: "newTab", group: G.term, title: t("keys.action.newTab"), hint: bindingLabel("newTab"), icon: <IconPlus size={13} />, run: () => addTab() });
    add({ id: "splitH", group: G.term, title: t("keys.action.splitH"), hint: bindingLabel("splitH"), icon: <IconSplitH size={13} />, run: () => splitActivePane("row") });
    add({ id: "splitV", group: G.term, title: t("keys.action.splitV"), hint: bindingLabel("splitV"), icon: <IconSplitV size={13} />, run: () => splitActivePane("column") });
    add({ id: "closePane", group: G.term, title: t("palette.closePane"), hint: bindingLabel("closeTab"), icon: <IconX size={13} />, run: () => closeActivePane() });
    const layouts: [LayoutKind, string][] = [
      ["single", "layouts.single"],
      ["sideBySide", "layouts.twoCols"],
      ["stacked", "layouts.twoRows"],
      ["grid2x2", "layouts.grid"],
      ["mainPlusSide", "layouts.mainSide"],
      ["tripleColumn", "layouts.tripleCol"],
    ];
    add({
      id: "layouts",
      group: G.term,
      title: t("palette.layoutMenu"),
      icon: <IconLayouts size={13} />,
      children: () =>
        layouts.map(([kind, key]) => ({
          id: `layout:${kind}`,
          group: G.term,
          title: t(key),
          icon: <IconLayouts size={13} />,
          run: () => applyLayout(kind),
        })),
    });
    add({
      id: "termSearch",
      group: G.term,
      title: t("keys.action.termSearch"),
      hint: bindingLabel("termSearch"),
      icon: <IconSearch size={13} />,
      run: () => {
        const l = activeLeaf();
        if (l) queueMicrotask(() => leafSearchFns.get(l.id)?.());
      },
    });

    // --- Workspaces: one row per workspace to open; management in a submenu ---
    for (const ws of d.workspaces) {
      const cmds = wsCommands(ws);
      add({
        id: `ws:${ws.source}`,
        group: G.ws,
        title: ws.name,
        subtitle:
          t("palette.wsTabs", { n: ws.tabs.length }) +
          (cmds.length ? `  ·  ${cmds.join("  ·  ")}` : ""),
        keywords: `${t("palette.wsOpenKw")} ${ws.description ?? ""}`,
        icon: <IconWorkspace size={13} />,
        run: () => openWorkspaceByPolicy(ws),
        altRun: cmds.length ? () => openWorkspace(ws, false) : undefined,
        altHint: cmds.length ? t("palette.wsNoCommands") : undefined,
      });
    }
    const savePrompt = (scope: WsScope, title: string): PromptRequest => ({
      kind: "prompt",
      title,
      placeholder: t("palette.wsNamePlaceholder"),
      onSubmit: (name) => workspaceOps.save(name, scope),
    });
    add({
      id: "ws:saveTab",
      group: G.ws,
      title: t("palette.wsSaveTab"),
      subtitle: t("palette.wsSaveSub"),
      icon: <IconPlus size={13} />,
      run: () => savePrompt("tab", t("palette.wsSaveTab")),
    });
    if (tabs.length > 1) {
      add({
        id: "ws:saveAll",
        group: G.ws,
        title: t("palette.wsSaveAll", { n: tabs.length }),
        icon: <IconPlus size={13} />,
        run: () => savePrompt("all", t("palette.wsSaveAll", { n: tabs.length })),
      });
    }
    if (d.workspaces.length) {
      add({
        id: "ws:manage",
        group: G.ws,
        title: t("palette.wsManage"),
        icon: <IconPencil size={13} />,
        children: () =>
          d.workspaces.map((ws) => ({
            id: `ws:m:${ws.source}`,
            group: G.ws,
            title: ws.name,
            icon: <IconWorkspace size={13} />,
            children: () => [
              { id: `ws:update:${ws.source}`, group: G.ws, title: t("palette.wsUpdateShort"), icon: <IconRefresh size={13} />, run: () => workspaceOps.update(ws) },
              { id: `ws:edit:${ws.source}`, group: G.ws, title: t("palette.wsEditShort"), icon: <IconPencil size={13} />, run: () => workspaceOps.edit(ws) },
              {
                id: `ws:delete:${ws.source}`,
                group: G.ws,
                title: t("palette.wsDeleteShort"),
                danger: true,
                icon: <IconX size={13} />,
                run: () =>
                  confirmPrompt(t("palette.wsDeleteConfirm", { name: ws.name }), ws.name, () =>
                    workspaceOps.remove(ws)
                  ),
              },
            ],
          })),
      });
    }

    // --- History ---
    add({ id: "hist", group: G.hist, title: t("palette.histSearch"), hint: bindingLabel("history"), icon: <IconHistory size={13} />, run: () => ({ kind: "query", value: "!" }) });
    add({ id: "hist:failed", group: G.hist, title: t("palette.histFailed"), icon: <IconHistory size={13} />, run: () => ({ kind: "query", value: "! failed " }) });
    add({ id: "hist:here", group: G.hist, title: t("palette.histHere"), icon: <IconHistory size={13} />, run: () => ({ kind: "query", value: "! here " }) });
    const branch = activeLeaf()?.gitBranch;
    if (branch) {
      add({ id: "hist:branch", group: G.hist, title: t("palette.histBranch", { branch }), icon: <IconBranch size={13} />, run: () => ({ kind: "query", value: `! branch:${branch} ` }) });
    }

    // --- SSH: favorites + recents up front, every host in a submenu ---
    const hostItem = (h: SshHost): PaletteItem => {
      const prefs = effectiveSshPrefs(d.sshPrefs[h.name]);
      return {
        id: `ssh:${h.name}`,
        group: G.ssh,
        title: h.name,
        subtitle: [
          h.user ? `${h.user}@${h.hostName ?? h.name}` : h.hostName ?? "",
          prefs.mosh ? "mosh" : "",
          prefs.tmux ? "tmux" : "",
        ]
          .filter(Boolean)
          .join("  ·  "),
        icon: <IconSsh size={13} />,
        run: () => connectSsh(h.name, prefs),
      };
    };
    const favs = sshFavorites();
    const recents = sshRecents();
    const quick = d.hosts
      .filter((h) => favs.includes(h.name) || recents.includes(h.name))
      .sort((a, b) => {
        const r = (h: SshHost) =>
          favs.includes(h.name) ? favs.indexOf(h.name) : 100 + recents.indexOf(h.name);
        return r(a) - r(b);
      })
      .slice(0, 4);
    for (const h of quick) add({ ...hostItem(h), id: `sshq:${h.name}` });
    if (d.hosts.length) {
      add({
        id: "ssh:all",
        group: G.ssh,
        title: t("palette.sshAll", { n: d.hosts.length }),
        icon: <IconSsh size={13} />,
        children: () => d.hosts.map(hostItem),
      });
    }
    add({ id: "ssh", group: G.ssh, title: t("palette.sshManager"), hint: bindingLabel("ssh"), icon: <IconSsh size={13} />, run: () => { setSshOpen(true); } });

    // --- Workflows ---
    if (d.workflows.length) {
      add({
        id: "wf:all",
        group: G.wf,
        title: t("palette.wfRun", { n: d.workflows.length }),
        icon: <IconWorkflow size={13} />,
        children: () =>
          d.workflows.map((w) => ({
            id: `wf:${w.source}`,
            group: G.wf,
            title: w.name,
            subtitle: w.command,
            keywords: `${w.description ?? ""} ${w.tags.join(" ")}`,
            icon: <IconWorkflow size={13} />,
            run: () => {
              setWorkflowPreselect(w.source);
              setWorkflowsOpen(true);
            },
          })),
      });
    }
    add({ id: "wf", group: G.wf, title: t("palette.workflows"), hint: bindingLabel("workflows"), icon: <IconWorkflow size={13} />, run: () => { setWorkflowPreselect(null); setWorkflowsOpen(true); } });

    // --- Remote: this Lume as a server, then as a client of other Lumes ---
    const running = !!remoteInfo()?.running;
    add({
      id: "remote",
      group: G.remote,
      title: running ? t("palette.remoteShow") : t("palette.remoteStart"),
      icon: <IconSmartphone size={13} />,
      run: () => {
        if (running) setRemoteDialogOpen(true);
        else void startRemoteControl();
      },
    });
    if (running) {
      add({ id: "remote:pair", group: G.remote, title: t("palette.remotePair"), icon: <IconSmartphone size={13} />, run: async () => { setRemoteInfo(await remoteNewPairing()); setRemoteDialogOpen(true); } });
      add({ id: "remote:stop", group: G.remote, title: t("remote.stop"), danger: true, icon: <IconX size={13} />, run: () => stopRemoteControl() });
    }
    // Terminals of the remote Lume shown in the active pane.
    const al = activeLeaf();
    const rt = al?.remote && al.ptyId !== null ? remoteClientTabs()[al.ptyId] : undefined;
    if (al && rt) {
      add({
        id: "lume:terminals",
        group: G.remote,
        title: t("palette.lumeTerminals", { name: rt.serverName }),
        icon: <IconRemote size={13} />,
        children: () => [
          ...rt.items
            .filter((it) => it.id !== rt.active)
            .map((it) => ({
              id: `lume:switch:${it.id}`,
              group: G.remote,
              title: t("palette.lumeSwitch", { title: it.title }),
              icon: <IconRemote size={13} />,
              run: () => void remoteClientSwitch(al.ptyId!, it.id),
            })),
          { id: "lume:newtab", group: G.remote, title: t("palette.lumeNewTab"), icon: <IconPlus size={13} />, run: () => void remoteClientNewTab(al.ptyId!) },
        ],
      });
    }
    for (const p of d.peers) {
      add({ id: `lume:peer:${p.serverId}`, group: G.remote, title: t("palette.lumeOpen", { name: p.serverName }), subtitle: p.url, icon: <IconRemote size={13} />, run: () => openRemoteLume(p.url, p.serverName) });
    }
    add({
      id: "lume:connect",
      group: G.remote,
      title: t("palette.lumeConnect"),
      subtitle: t("palette.lumeConnectSub"),
      icon: <IconRemote size={13} />,
      run: (): PromptRequest => ({
        kind: "prompt",
        title: t("palette.lumeConnect"),
        placeholder: "http://192.168.1.10:4530/#p=…",
        onSubmit: (url) => openRemoteLume(url),
      }),
    });

    // --- AI ---
    add({ id: "ai", group: G.ai, title: t("palette.aiAsk"), icon: <IconSparkles size={13} />, run: () => ({ kind: "query", value: "? " }) });

    // --- Appearance ---
    add({
      id: "themes",
      group: G.look,
      title: t("palette.themeMenu"),
      icon: <IconTheme size={13} />,
      children: () =>
        THEME_PRESETS.map((preset) => ({
          id: `theme:${preset.name}`,
          group: G.look,
          title: preset.name,
          icon: <IconTheme size={13} />,
          run: () => {
            setConfig("appearance", "theme", { ...preset.theme });
            persistConfig();
          },
        })),
    });
    add({ id: "fileTree", group: G.look, title: t("palette.toggleFileTree"), icon: <IconFolder size={13} />, run: () => { setFileTreeVisible(!fileTreeVisible()); } });
    add({ id: "blocks", group: G.look, title: t("keys.action.togglePanel"), hint: bindingLabel("togglePanel"), icon: <IconBlocks size={13} />, run: () => { setPanelVisible(!panelVisible()); } });

    // --- Lume ---
    add({ id: "settings", group: G.lume, title: t("keys.action.settings"), hint: bindingLabel("settings"), icon: <IconSettings size={13} />, run: () => { setSettingsOpen(true); } });
    add({
      id: "lume:forget",
      group: G.lume,
      title: t("palette.maintenance"),
      icon: <IconX size={13} />,
      children: () => [
        {
          id: "hist:clear",
          group: G.lume,
          title: t("palette.histClear"),
          danger: true,
          run: () =>
            confirmPrompt(t("palette.histClearConfirm"), t("palette.histClearWord"), async () => {
              await historyClear();
              flashToast(t("palette.histCleared"));
            }),
        },
        ...d.peers.map((p) => ({
          id: `lume:forget:${p.serverId}`,
          group: G.lume,
          title: t("palette.lumeForget", { name: p.serverName }),
          danger: true,
          run: () =>
            confirmPrompt(t("palette.lumeForgetConfirm", { name: p.serverName }), p.serverName, () =>
              remoteClientForget(p.serverId)
            ),
        })),
      ],
    });
    return items;
  });

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

    // The "a command is still running" confirmation is modal: it owns the
    // keyboard entirely, so no shortcut fires and nothing leaks to the shell
    // behind the overlay while the question is on screen.
    if (closeConfirm()) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === "Escape") setCloseConfirm(null);
      else if (e.key === "Enter") confirmClose();
      return;
    }

    // Same for the "run this workspace's commands?" question.
    const pendingWs = wsConfirm();
    if (pendingWs) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === "Escape") setWsConfirm(null);
      else if (e.key === "Enter") {
        setWsConfirm(null);
        void openWorkspace(pendingWs, !e.shiftKey);
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
      (modKey(e) &&
        !e.shiftKey &&
        /^(?:Digit|Numpad)[0-9]$/.test(e.code)) ||
      (modKey(e) && (e.key === "+" || e.key === "=" || e.key === "-")) ||
      (modKey(e) &&
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

    // Cmd on macOS, Ctrl elsewhere — the tab/zoom shortcuts below follow the
    // platform convention just like the remappable ones above.
    if (!modKey(e)) return;

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
      // A fullscreen app (nano, vim, htop…) owns the keyboard: let Ctrl+↑/↓
      // flow through to the terminal instead of hijacking it for block nav.
      if (leafAltScreenFns.get(leaf.id)?.()) return;
      e.preventDefault();
      setBlockNavMode(true);
      navigateBlocks(e.key === "ArrowUp" ? -1 : 1);
      return;
    }
  };

  let unlistenAiChunk: UnlistenFn | undefined;
  let unlistenAiDone: UnlistenFn | undefined;
  let unlistenAiError: UnlistenFn | undefined;
  let unlistenUsage: UnlistenFn | undefined;
  let unlistenRemoteNewTab: UnlistenFn | undefined;
  let unlistenRemotePaired: UnlistenFn | undefined;
  let unlistenRemoteClientTabs: UnlistenFn | undefined;

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
      unlistenUsage?.();
      unlistenRemoteNewTab?.();
      unlistenRemotePaired?.();
      unlistenRemoteClientTabs?.();
    });

    unlistenRemoteNewTab = await listen<{ conn?: number }>("remote:new-tab", (e) =>
      addTabFromRemote(typeof e.payload?.conn === "number" ? e.payload.conn : null)
    );
    unlistenRemotePaired = await listen<{ name?: string }>("remote:paired", (e) => {
      flashToast(t("remote.pairedToast", { name: e.payload?.name ?? "?" }));
      void refreshRemote();
    });
    unlistenRemoteClientTabs = await listen<RemoteClientTabs>("remote-client:tabs", (e) => {
      setRemoteClientTabs((m) => ({ ...m, [e.payload.id]: e.payload }));
    });

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

    unlistenUsage = await listenUsage();
    // The plan ring must be filled from launch, not from the first hover.
    onCleanup(startPlanPolling());

    unlistenAiError = await listen<AiErrorEvent>("ai:error", (e) => {
      const loc = findBlockByRequest(e.payload.requestId);
      if (!loc) return;
      setTabs(loc.tabIdx, "leaves", loc.leafId, "blocks", loc.blockIdx, "ai", {
        status: "error",
        error: aiErrorText(e.payload.message),
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
          remote: t.leaves[lid]?.remote ?? null,
        })),
      })),
    };
  };

  // Persist the whole session (tabs, titles, manual-rename lock, tree/layout,
  // per-pane cwd) on any change, debounced. Building the snapshot here reads all
  // the relevant store fields, so the effect re-runs whenever they change.
  let sessionSaveTimer: ReturnType<typeof setTimeout> | null = null;
  createEffect(() => {
    // The snapshot read is what tracks the deps; the JSON.stringify is
    // deferred to the flush — during a divider drag this effect re-runs per
    // mousemove, and stringifying the whole session each frame adds up.
    serializeSession();
    if (sessionSaveTimer) clearTimeout(sessionSaveTimer);
    sessionSaveTimer = setTimeout(() => {
      sessionSaveTimer = null;
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(serializeSession()));
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

  // Recent blocks per pane, saved separately (and less often) than the
  // session layout: they only change at command boundaries.
  const serializeBlocks = (): Record<string, PersistedBlock[]> => {
    const out: Record<string, PersistedBlock[]> = {};
    for (const tab of tabs) {
      for (const lid of leafIds(tab.tree)) {
        const l = tab.leaves[lid];
        if (!l || l.remote) continue;
        const done = l.blocks.filter((b) => hasCommand(b) && b.status === "done");
        if (!done.length) continue;
        out[String(lid)] = done.slice(-PERSIST_BLOCKS_PER_LEAF).map((b) => ({
          c: b.command!,
          o: b.output ? b.output.slice(-PERSIST_OUTPUT_CHARS) : null,
          s: b.startedAt,
          f: b.finishedAt,
          x: b.exitCode,
        }));
      }
    }
    return out;
  };
  const saveBlocksNow = () => {
    try {
      if (config.behavior?.persistBlocks === false) localStorage.removeItem(BLOCKS_KEY);
      else localStorage.setItem(BLOCKS_KEY, JSON.stringify(serializeBlocks()));
    } catch {}
  };
  let blocksSaveTimer: ReturnType<typeof setTimeout> | null = null;
  createEffect(() => {
    // Track block count + last status of every pane (not the outputs).
    config.behavior?.persistBlocks;
    for (const tab of tabs) {
      for (const key of Object.keys(tab.leaves)) {
        const l = tab.leaves[Number(key)];
        l.blocks.length;
        l.blocks[l.blocks.length - 1]?.status;
      }
    }
    if (blocksSaveTimer) clearTimeout(blocksSaveTimer);
    blocksSaveTimer = setTimeout(() => {
      blocksSaveTimer = null;
      saveBlocksNow();
    }, 1500);
  });
  window.addEventListener("beforeunload", saveBlocksNow);
  onCleanup(() => window.removeEventListener("beforeunload", saveBlocksNow));

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
              <div class="tab-list-scroll">
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
                    fallback={
                      <>
                        <Show when={tab.leaves[tab.activeLeafId]?.remote}>
                          <span class="tab-remote" title={t("remoteClient.tabHint")}>
                            <IconRemote size={11} />
                          </span>
                        </Show>
                        <span class="tab-title">{tab.title}</span>
                        <Show when={tabBranch(tab)}>
                          {(b) => (
                            <span class="tab-branch" title={t("tab.branch", { branch: b() })}>
                              ⎇ {b()}
                            </span>
                          )}
                        </Show>
                      </>
                    }
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
                      title={t("tab.panes", { n: leafIds(tab.tree).length })}
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
                    <IconX size={11} />
                  </button>
                </div>
              )}
            </For>

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
              {/* Outside the scrolling strip: always reachable, however
                  many tabs are open. */}
              <div class="tab-new-group">
            <button
              class="tab-new"
              title={t("toolbar.newTab")}
              onClick={addTab}
            >
              <IconPlus size={14} />
            </button>
            <button
              class="tab-ws-toggle"
              classList={{ active: wsMenuOpen() }}
              title={t("wsMenu.toggle")}
              onClick={(e) => {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setWsMenuAnchor(wsMenuOpen() ? null : r);
              }}
            >
              <IconChevronDown size={12} />
            </button>
              </div>
            </div>
            <div class="tab-actions">
              <UsagePill provider={() => ai()?.provider ?? ""} />
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
            <UsageCard provider={() => ai()?.provider ?? ""} />
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
                    <IconCopy />
                    {t("pane.copy")}
                  </button>
                  <button
                    class="ctx-item"
                    onClick={() => {
                      pasteIntoPane(m.leafId);
                      setPaneCtxMenu(null);
                    }}
                  >
                    <IconClipboard />
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
                    <IconSplitH />
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
                    <IconSplitV />
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
                    <IconRemote />
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
                    <IconPlus />
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
                    <IconX />
                    <span>
                      {paneCount === 1
                        ? t("pane.closeTabOnly")
                        : t("pane.close")}
                    </span>
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
                    <IconPencil />
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
                    <IconSplitH />
                    {t("tab.splitH")}
                  </button>
                  <button
                    class="ctx-item"
                    onClick={() => {
                      splitTab(m.tabId, "column");
                      setTabCtxMenu(null);
                    }}
                  >
                    <IconSplitV />
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
                    <IconPlus />
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
                    <IconX />
                    <span>
                      {t("tab.close")}
                      <Show when={paneCount > 1}>
                        {t("tab.panes", { n: paneCount })}
                      </Show>
                    </span>
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
              onRun={(command) => insertIntoActiveTerminal(command, true)}
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
                                  // The leaf may have been closed while
                                  // pty_spawn was in flight.
                                  if (idx === -1 || !tabs[idx].leaves[leafId])
                                    return;
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
                                  // Close this pane wherever it lives — like a
                                  // classic terminal, a pane whose shell exits
                                  // goes away even if it isn't focused.
                                  // Unguarded: the shell is already gone, and a
                                  // block left stuck on `running` (no 133;D on
                                  // the way out) must not strand the pane.
                                  // A Lume ↔ Lume pane stays open: its last
                                  // lines say why it ended (revoked, closed…).
                                  const idx = tabIndex(tab.id);
                                  if (tabs[idx]?.leaves[leafId]?.remote) {
                                    setTabs(idx, "leaves", leafId, "ptyId", null);
                                    return;
                                  }
                                  closeLeafNow(tab.id, leafId);
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
                                onPasteReady={(paste) =>
                                  leafPasteFns.set(leafId, paste)
                                }
                                onAltScreenReady={(isAlt) =>
                                  leafAltScreenFns.set(leafId, isAlt)
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
                                focusFollowsMouse={() =>
                                  config.behavior.focusFollowsMouse
                                }
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
                                onRemoteConnected={(info) =>
                                  onRemoteLeafConnected(tab.id, leafId, info)
                                }
                                onSshReconnect={() => {
                                  const idx = tabIndex(tab.id);
                                  const l = tabs[idx]?.leaves[leafId];
                                  if (!l?.sshLost || l.ptyId === null) return;
                                  const cmd = l.sshLost;
                                  setTabs(idx, "leaves", leafId, "sshLost", null);
                                  ptyWriteText(l.ptyId, cmd + "\r");
                                  leafFocusFns.get(leafId)?.();
                                }}
                                onSshDismiss={() => {
                                  const idx = tabIndex(tab.id);
                                  if (idx !== -1)
                                    setTabs(idx, "leaves", leafId, "sshLost", null);
                                }}
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
            <Palette
              open={paletteOpen}
              initialQuery={paletteInitial}
              onClose={() => {
                setPaletteOpen(false);
                focusActiveTerminal();
              }}
              items={paletteItems}
              aiAvailable={() => ai()?.available ?? false}
              aiCommand={() => ai()?.command ?? ""}
              ptyId={() => activeLeaf()?.ptyId ?? null}
              cwd={() => (activeLeaf()?.remote ? null : activeLeaf()?.cwd ?? null)}
              home={userHome}
              onInsert={(cmd, execute) => void insertIntoActiveTerminal(cmd, execute)}
            />
            <WorkflowsPalette
              open={workflowsOpen}
              preselect={workflowPreselect}
              onClose={() => {
                setWorkflowsOpen(false);
                setWorkflowPreselect(null);
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
              onConnect={(target, prefs) => connectSsh(target, prefs)}
              tmuxDefault={() => !!config.ssh?.tmuxByDefault}
            />
            <BlocksPanel
              blocks={visibleBlocks}
              totalBlocks={() =>
                activeLeaf()?.blocks.filter(hasCommand).length ?? 0
              }
              paneInfo={() => {
                const tab = activeTab();
                if (!tab) return null;
                const ids = leafIds(tab.tree);
                if (ids.length < 2) return null;
                return {
                  idx: ids.indexOf(tab.activeLeafId) + 1,
                  total: ids.length,
                };
              }}
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
              aiContext={aiContext}
              onAiContextChange={setAiContext}
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
              onNewPairing={async () => {
                try {
                  setRemoteInfo(await remoteNewPairing());
                } catch {}
              }}
              onRevoke={async (id) => {
                try {
                  setRemoteInfo(await remoteRevokeDevice(id));
                } catch (e) {
                  console.error("revoke", e);
                }
              }}
              onStop={stopRemoteControl}
              onClose={() => setRemoteDialogOpen(false)}
            />
            <Show when={wsConfirm()}>
              {(ws) => (
                <div class="palette-overlay" onClick={() => setWsConfirm(null)}>
                  <div
                    class="palette confirm-dialog"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div class="confirm-head">
                      <span class="confirm-icon">
                        <IconWorkspace size={16} />
                      </span>
                      <span class="confirm-title">{t("wsConfirm.title", { name: ws().name })}</span>
                    </div>
                    <div class="confirm-body">
                      <p class="confirm-text">{t("wsConfirm.body")}</p>
                      <ul class="confirm-cmds">
                        <For each={wsCommands(ws())}>
                          {(c) => (
                            <li class="confirm-cmd">
                              <code>{c}</code>
                            </li>
                          )}
                        </For>
                      </ul>
                    </div>
                    <div class="palette-footer">
                      <span class="palette-hint" innerHTML={t("wsConfirm.hint")} />
                      <div class="palette-actions">
                        <button
                          class="palette-btn ghost"
                          onClick={() => {
                            const w = ws();
                            setWsConfirm(null);
                            void openWorkspace(w, false);
                          }}
                        >
                          {t("wsConfirm.without")}
                        </button>
                        <button
                          class="palette-btn primary"
                          onClick={() => {
                            const w = ws();
                            setWsConfirm(null);
                            void openWorkspace(w, true);
                          }}
                        >
                          {t("wsConfirm.run")}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Show>
            <WorkspaceMenu
              open={wsMenuOpen}
              anchor={wsMenuAnchor}
              workspaces={() => paletteData().workspaces}
              onClose={() => setWsMenuAnchor(null)}
              onOpen={(ws, withCommands) =>
                withCommands ? openWorkspaceByPolicy(ws) : void openWorkspace(ws, false)
              }
              onSave={workspaceOps.save}
              tabCount={() => tabs.length}
              existingName={(name) => workspaceNamed(name)?.name ?? null}
              onUpdate={workspaceOps.update}
              onEdit={(ws) => void workspaceOps.edit(ws)}
              onDelete={workspaceOps.remove}
            />
            <CloseConfirm
              target={closeConfirm}
              onConfirm={confirmClose}
              onCancel={() => setCloseConfirm(null)}
            />
          </div>
        </div>
    </Show>
  );
}
