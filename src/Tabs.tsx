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
import { createStore } from "solid-js/store";
import BlocksPanel from "./BlocksPanel";
import PaneNode from "./PaneNode";
import PortableTerminal from "./PortableTerminal";
import { loadConfig, type Config } from "./config";
import type { Block, PtyBlock } from "./blocks";
import { b64ToString } from "./blocks";
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
import {
  leafIds,
  makeLeaf,
  makeSplit,
  neighbourLeaf,
  removeLeaf,
  setSplitRatio,
  splitAt,
  type LeafData,
  type TreeNode,
} from "./panes";
import { recordCommand } from "./autocomplete";

type TabState = {
  id: number;
  title: string;
  tree: TreeNode;
  leaves: Record<number, LeafData>;
  activeLeafId: number;
};

let nextTabId = 0;

const MAX_PANES_PER_TAB = 4;

function applyCssVars(cfg: Config) {
  const t = cfg.appearance.theme;
  const root = document.documentElement.style;
  root.setProperty("--bg", t.background);
  root.setProperty("--fg", t.foreground);
  root.setProperty("--accent", t.accent);
}

type PersistedSession = {
  tabCount: number;
};

function loadSession(): PersistedSession {
  try {
    const raw = localStorage.getItem("lume.session");
    if (!raw) return { tabCount: 1 };
    const parsed = JSON.parse(raw) as Partial<PersistedSession>;
    const tabCount = Math.max(1, Math.min(20, parsed.tabCount ?? 1));
    return { tabCount };
  } catch {
    return { tabCount: 1 };
  }
}

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
  const [config] = createResource<Config>(loadConfig);
  const [ai] = createResource<AiStatus>(aiStatus);

  const session = loadSession();
  const initialTabs: TabState[] = Array.from(
    { length: session.tabCount },
    makeEmptyTab
  );
  const [tabs, setTabs] = createStore<TabState[]>(initialTabs);
  const [activeId, setActiveId] = createSignal(tabs[0].id);
  const [panelVisible, setPanelVisible] = createSignal(true);
  const [paletteOpen, setPaletteOpen] = createSignal(false);
  const [workflowsOpen, setWorkflowsOpen] = createSignal(false);
  const [blockNavMode, setBlockNavMode] = createSignal(false);
  const [searchOpen, setSearchOpen] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [tabCtxMenu, setTabCtxMenu] = createSignal<
    { x: number; y: number; tabId: number } | null
  >(null);
  /** Set while the user is dragging a tab. Pane components use this to show
   *  a transparent drop-catcher overlay above their xterm so the drop event
   *  isn't swallowed by xterm's own handlers. */
  const [draggingTabId, setDraggingTabId] = createSignal<number | null>(null);
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
  const [layoutsOpen, setLayoutsOpen] = createSignal(false);
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

  const visibleBlocks = createMemo(() => {
    const leaf = activeLeaf();
    if (!leaf) return [];
    const q = searchQuery().trim().toLowerCase();
    if (!q) return leaf.blocks;
    return leaf.blocks.filter((b) =>
      (b.command ?? "").toLowerCase().includes(q)
    );
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
        "Voici un bloc de terminal :",
        `Commande : ${block.command ?? ""}`,
        block.output ? `Sortie :\n${block.output}` : "",
        `Code retour : ${block.exitCode ?? 0}`,
        "",
        "Explique brièvement ce qui se passe.",
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
  const leafScrollFns = new Map<
    number,
    (startMarkerId: number, endMarkerIdHint: number | null) => void
  >();
  const leafRefreshFns = new Map<number, () => void>();

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

  const closeTab = (id: number) => {
    const tab = tabs.find((t) => t.id === id);
    if (tab) {
      // Clean up callback registries for all leaves in this tab.
      for (const key of Object.keys(tab.leaves)) {
        const leafId = Number(key);
        leafFocusFns.delete(leafId);
        leafScrollFns.delete(leafId);
        leafRefreshFns.delete(leafId);
      }
    }
    if (tabs.length === 1) {
      const newTab = makeEmptyTab();
      setTabs([newTab]);
      setActiveId(newTab.id);
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

  const pasteIntoPane = async (leafId: number) => {
    const tab = tabs.find((t) => t.leaves[leafId]);
    if (!tab) return;
    const leaf = tab.leaves[leafId];
    if (leaf.ptyId === null) return;
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      const bytes = new TextEncoder().encode(text);
      let bin = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode(
          ...bytes.subarray(i, Math.min(i + chunk, bytes.length))
        );
      }
      await invoke("pty_write", { id: leaf.ptyId, dataB64: btoa(bin) });
    } catch (e) {
      console.error("paste failed", e);
    }
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

  const navigatePane = (direction: "left" | "right" | "up" | "down") => {
    const tab = activeTab();
    if (!tab) return;
    const next = neighbourLeaf(tab.tree, tab.activeLeafId, direction);
    if (next === null) return;
    focusLeaf(next);
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
        setTabs(tIdx, "leaves", leafId, "blocks", (b) => [...b, newBlock]);
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
        break;
      }
      case "promptEnd":
        break;
    }
  };

  const handleCwd = (tabId: number, leafId: number, cwd: string) => {
    const tIdx = tabIndex(tabId);
    if (tIdx === -1) return;
    // Only update the tab title when this is the active leaf of the tab.
    if (tabs[tIdx].activeLeafId !== leafId) return;
    const home = "/home/hugo";
    let label = cwd;
    if (cwd === home) label = "~";
    else if (cwd.startsWith(home + "/"))
      label = "~/" + cwd.slice(home.length + 1);
    const basename = label.split("/").filter(Boolean).pop() || label;
    setTabs(tIdx, "title", basename);
  };

  const closeSearch = (refocusTerminal: boolean) => {
    setSearchOpen(false);
    setSearchQuery("");
    if (refocusTerminal) focusActiveTerminal();
  };

  const onKeyDown = (e: KeyboardEvent) => {
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
    const isOurShortcut = (() => {
      if (e.altKey && !e.ctrlKey && !e.shiftKey) {
        return (
          e.key === "ArrowLeft" ||
          e.key === "ArrowRight" ||
          e.key === "ArrowUp" ||
          e.key === "ArrowDown"
        );
      }
      if (!e.ctrlKey) return false;
      if (e.shiftKey) {
        const k = e.key.toLowerCase();
        return (
          k === "t" ||
          k === "w" ||
          k === "p" ||
          k === "d" ||
          k === "e" ||
          k === "r"
        );
      }
      // Ctrl (no Shift):
      if (e.key === "Tab") return true;
      if (e.key >= "1" && e.key <= "9") return true;
      const k = e.key.toLowerCase();
      if (k === "b" || k === "f") return true;
      if (e.key === "ArrowUp" || e.key === "ArrowDown") return true;
      return false;
    })();
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

    if (!e.ctrlKey) return;

    if (!e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      const leaf = activeLeaf();
      if (!leaf || leaf.blocks.length === 0) return;
      e.preventDefault();
      setBlockNavMode(true);
      navigateBlocks(e.key === "ArrowUp" ? -1 : 1);
      return;
    }

    if (!e.shiftKey && (e.key === "f" || e.key === "F")) {
      const leaf = activeLeaf();
      if (!leaf || leaf.blocks.length === 0) return;
      e.preventDefault();
      if (!panelVisible()) setPanelVisible(true);
      setSearchOpen(true);
      return;
    }

    // Splits — Ctrl+Shift+D = side-by-side (row), Ctrl+Shift+E = stacked (col)
    if (e.shiftKey && (e.key === "D" || e.key === "d")) {
      e.preventDefault();
      splitActivePane("row");
      return;
    }
    if (e.shiftKey && (e.key === "E" || e.key === "e")) {
      e.preventDefault();
      splitActivePane("column");
      return;
    }

    if (e.shiftKey && (e.key === "T" || e.key === "t")) {
      e.preventDefault();
      addTab();
    } else if (e.shiftKey && (e.key === "W" || e.key === "w")) {
      e.preventDefault();
      closeActivePane();
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (tabs.length < 2) return;
      const idx = tabIndex(activeId());
      if (idx === -1) return;
      const next = (idx + (e.shiftKey ? -1 : 1) + tabs.length) % tabs.length;
      setActiveId(tabs[next].id);
    } else if (!e.shiftKey && (e.key === "b" || e.key === "B")) {
      e.preventDefault();
      setPanelVisible(!panelVisible());
    } else if (e.shiftKey && (e.key === "P" || e.key === "p")) {
      e.preventDefault();
      setPaletteOpen(true);
    } else if (e.shiftKey && (e.key === "R" || e.key === "r")) {
      e.preventDefault();
      setWorkflowsOpen(true);
    } else if (e.key >= "1" && e.key <= "9") {
      const i = parseInt(e.key, 10) - 1;
      if (i < tabs.length) {
        e.preventDefault();
        setActiveId(tabs[i].id);
      }
    }
  };

  let unlistenAiChunk: UnlistenFn | undefined;
  let unlistenAiDone: UnlistenFn | undefined;
  let unlistenAiError: UnlistenFn | undefined;

  onMount(async () => {
    window.addEventListener("keydown", onKeyDown, true);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown, true));

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

    onCleanup(() => {
      unlistenAiChunk?.();
      unlistenAiDone?.();
      unlistenAiError?.();
    });
  });

  createEffect(() => {
    const c = config();
    if (c) applyCssVars(c);
  });

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

  createEffect(() => {
    const count = tabs.length;
    try {
      localStorage.setItem("lume.session", JSON.stringify({ tabCount: count }));
    } catch {}
  });

  return (
    <Show
      when={config()}
      fallback={<div class="loading">Chargement de la configuration…</div>}
    >
      {(cfg) => (
        <div class="app-shell">
          <div class="tab-bar">
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
                  draggable={true}
                  onClick={() => setActiveId(tab.id)}
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
                  title={`${tab.title}  (Ctrl+${idx() + 1})  ·  right-click pour split`}
                >
                  <span class="tab-index">{idx() + 1}</span>
                  <span class="tab-title">{tab.title}</span>
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
                    title="Fermer (Ctrl+Shift+W)"
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
              title="Nouveau (Ctrl+Shift+T)"
              onClick={addTab}
            >
              +
            </button>
            <div class="tab-bar-spacer" />
            <button
              class="workflows-toggle"
              title="Workflows (Ctrl+Shift+R)"
              onClick={() => setWorkflowsOpen(true)}
            >
              ⚡
            </button>
            <button
              class="layouts-toggle"
              title="Layouts prédéfinis"
              classList={{ active: layoutsOpen() }}
              onClick={(e) => {
                e.stopPropagation();
                setLayoutsOpen(!layoutsOpen());
              }}
            >
              ⊞
            </button>
            <Show when={layoutsOpen()}>
              <div class="layouts-popup" onClick={(e) => e.stopPropagation()}>
                <div class="layouts-popup-title">Appliquer un layout</div>
                <div class="layouts-grid">
                  <button
                    class="layout-preset"
                    onClick={() => {
                      applyLayout("single");
                      setLayoutsOpen(false);
                    }}
                  >
                    <div class="layout-preview single" />
                    <span>Simple</span>
                  </button>
                  <button
                    class="layout-preset"
                    onClick={() => {
                      applyLayout("sideBySide");
                      setLayoutsOpen(false);
                    }}
                  >
                    <div class="layout-preview side-by-side" />
                    <span>2 colonnes</span>
                  </button>
                  <button
                    class="layout-preset"
                    onClick={() => {
                      applyLayout("stacked");
                      setLayoutsOpen(false);
                    }}
                  >
                    <div class="layout-preview stacked" />
                    <span>2 lignes</span>
                  </button>
                  <button
                    class="layout-preset"
                    onClick={() => {
                      applyLayout("grid2x2");
                      setLayoutsOpen(false);
                    }}
                  >
                    <div class="layout-preview grid-2x2" />
                    <span>Grille 2×2</span>
                  </button>
                  <button
                    class="layout-preset"
                    onClick={() => {
                      applyLayout("mainPlusSide");
                      setLayoutsOpen(false);
                    }}
                  >
                    <div class="layout-preview main-side" />
                    <span>Main + 2</span>
                  </button>
                  <button
                    class="layout-preset"
                    onClick={() => {
                      applyLayout("tripleColumn");
                      setLayoutsOpen(false);
                    }}
                  >
                    <div class="layout-preview triple-col" />
                    <span>3 colonnes</span>
                  </button>
                </div>
                <p class="layouts-popup-note">
                  Le terminal actif est conservé en premier slot. Les autres
                  shells du tab sont fermés.
                </p>
              </div>
            </Show>
            <button
              class="panel-toggle"
              title="Blocs (Ctrl+B)"
              classList={{ active: panelVisible() }}
              onClick={() => setPanelVisible(!panelVisible())}
            >
              ⌘
            </button>
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
                      pasteIntoPane(m.leafId);
                      setPaneCtxMenu(null);
                    }}
                  >
                    ⎘ Coller
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
                    ⬌ Split horizontal
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
                    ⬍ Split vertical
                  </button>
                  <div class="ctx-sep" />
                  <button
                    class="ctx-item"
                    onClick={() => {
                      addTab();
                      setPaneCtxMenu(null);
                    }}
                  >
                    + Nouveau tab
                  </button>
                  <div class="ctx-sep" />
                  <button
                    class="ctx-item danger"
                    onClick={() => {
                      closePaneById(m.leafId);
                      setPaneCtxMenu(null);
                    }}
                  >
                    × Fermer ce pane
                    <Show when={paneCount === 1}> (ferme le tab)</Show>
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
                      splitTab(m.tabId, "row");
                      setTabCtxMenu(null);
                    }}
                  >
                    ⬌ Split horizontal (Ctrl+Shift+D)
                  </button>
                  <button
                    class="ctx-item"
                    onClick={() => {
                      splitTab(m.tabId, "column");
                      setTabCtxMenu(null);
                    }}
                  >
                    ⬍ Split vertical (Ctrl+Shift+E)
                  </button>
                  <div class="ctx-sep" />
                  <button
                    class="ctx-item"
                    onClick={() => {
                      addTab();
                      setTabCtxMenu(null);
                    }}
                  >
                    + Nouveau tab (Ctrl+Shift+T)
                  </button>
                  <Show when={paneCount > 1}>
                    <div class="ctx-sep" />
                    <button
                      class="ctx-item danger"
                      onClick={() => {
                        setActiveId(m.tabId);
                        closeActivePane();
                        setTabCtxMenu(null);
                      }}
                    >
                      × Fermer le pane actif ({paneCount} panes)
                    </button>
                  </Show>
                  <div class="ctx-sep" />
                  <button
                    class="ctx-item danger"
                    onClick={() => {
                      closeTab(m.tabId);
                      setTabCtxMenu(null);
                    }}
                  >
                    × Fermer ce tab
                    <Show when={paneCount > 1}> ({paneCount} panes)</Show>
                  </button>
                </div>
              );
            }}
          </Show>
          <div class="body">
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
                                appearance={cfg().appearance}
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
            <BlocksPanel
              blocks={visibleBlocks}
              totalBlocks={() => activeLeaf()?.blocks.length ?? 0}
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
          </div>
        </div>
      )}
    </Show>
  );
}
