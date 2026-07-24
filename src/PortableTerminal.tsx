import { createEffect, onCleanup, Show } from "solid-js";
import Terminal from "./Terminal";
import { placeholderMap, placeholderVer } from "./PaneNode";
import type { Appearance } from "./config";
import type { LeafData } from "./panes";
import type { PtyBlock } from "./blocks";
import { t } from "./i18n";

type Props = {
  leaf: LeafData;
  appearance: Appearance;
  active: () => boolean;
  onSpawned: (ptyId: number) => void;
  onExit: () => void;
  onBlock: (ev: PtyBlock) => void;
  onCwd: (cwd: string) => void;
  onSelectionReady: (getSelection: () => string) => void;
  onSearchReady: (openSearch: () => void) => void;
  onCopyBlock: (markerId: number) => void;
  canCopyMarker: (markerId: number) => boolean;
  onFocusReady: (focus: () => void) => void;
  onScrollReady: (
    scrollTo: (startMarkerId: number, endMarkerIdHint: number | null) => void
  ) => void;
  onBlockLine: (markerId: number) => void;
  onRefreshReady: (refresh: () => void) => void;
  onActivate: () => void;
  /** Focus-follows-mouse setting: hovering the pane activates it. */
  focusFollowsMouse: () => boolean;
  onContextMenu: (x: number, y: number) => void;
  onPaneDragStart: (leafId: number) => void;
  onPaneDragEnd: () => void;
  /** Whether the tab has more than one pane (grip is useless otherwise). */
  multiPane: () => boolean;
};

/** Renders a Terminal in a wrapper div that lives at the top level of the
 *  tab body. The wrapper is **positioned via CSS** (top/left/width/height
 *  inline styles) to overlay the leaf's placeholder card. When the tree
 *  restructures, the placeholder changes — a ResizeObserver re-computes the
 *  position. Terminal stays mounted, xterm state and PTY both preserved. */
export default function PortableTerminal(props: Props) {
  let wrapperRef: HTMLDivElement | undefined;
  let observer: ResizeObserver | undefined;
  let rafPending = 0;
  let refreshFn: (() => void) | null = null;

  const updatePosition = () => {
    if (!wrapperRef) return;
    const placeholder = placeholderMap.get(props.leaf.id);
    if (!placeholder) {
      wrapperRef.style.display = "none";
      return;
    }
    const parent = wrapperRef.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    const phRect = placeholder.getBoundingClientRect();
    if (phRect.width <= 0 || phRect.height <= 0) {
      wrapperRef.style.display = "none";
      return;
    }
    wrapperRef.style.display = "";
    wrapperRef.style.top = `${phRect.top - parentRect.top}px`;
    wrapperRef.style.left = `${phRect.left - parentRect.left}px`;
    wrapperRef.style.width = `${phRect.width}px`;
    wrapperRef.style.height = `${phRect.height}px`;
  };

  const scheduleUpdate = () => {
    if (rafPending) return;
    rafPending = requestAnimationFrame(() => {
      rafPending = 0;
      updatePosition();
      // Kick xterm so it picks up the new size and repaints. Without this
      // the WebGL canvas can stay at its old dimensions.
      refreshFn?.();
    });
  };

  createEffect(() => {
    placeholderVer(); // track structural changes
    scheduleUpdate();
    observer?.disconnect();
    const placeholder = placeholderMap.get(props.leaf.id);
    if (placeholder) {
      observer = new ResizeObserver(scheduleUpdate);
      observer.observe(placeholder);
    }
  });

  // Window resize also moves placeholders even when their own size doesn't
  // change (e.g., sidebar drag shrinks the whole .terminals area).
  const onWindowResize = () => scheduleUpdate();
  window.addEventListener("resize", onWindowResize);

  onCleanup(() => {
    observer?.disconnect();
    window.removeEventListener("resize", onWindowResize);
    if (rafPending) cancelAnimationFrame(rafPending);
  });

  return (
    <div
      ref={wrapperRef}
      class="terminal-portal-host"
      classList={{ "pane-active": props.active() }}
      onMouseDown={props.onActivate}
      onMouseEnter={(e) => {
        // No button held: don't steal focus mid selection-drag / split-resize.
        if (props.focusFollowsMouse() && e.buttons === 0 && !props.active())
          props.onActivate();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        props.onActivate();
        props.onContextMenu(e.clientX, e.clientY);
      }}
    >
      <Show when={props.multiPane()}>
        <div
          class="pane-grip"
          draggable={true}
          title={t("pane.dragMove")}
          onMouseDown={(e) => {
            // Don't trigger pane activation onto the underlying terminal-portal-host
            e.stopPropagation();
          }}
          onDragStart={(e) => {
            if (!e.dataTransfer) return;
            e.dataTransfer.setData("text/lume-pane", String(props.leaf.id));
            e.dataTransfer.effectAllowed = "move";
            props.onPaneDragStart(props.leaf.id);
          }}
          onDragEnd={() => props.onPaneDragEnd()}
        >
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
            <circle cx="3" cy="3" r="1" />
            <circle cx="9" cy="3" r="1" />
            <circle cx="3" cy="6" r="1" />
            <circle cx="9" cy="6" r="1" />
            <circle cx="3" cy="9" r="1" />
            <circle cx="9" cy="9" r="1" />
          </svg>
        </div>
      </Show>
      <Terminal
        active={props.active}
        appearance={props.appearance}
        initialCwd={props.leaf.cwd}
        onSpawned={props.onSpawned}
        onExit={props.onExit}
        onBlock={props.onBlock}
        onCwd={props.onCwd}
        onSelectionReady={props.onSelectionReady}
        onSearchReady={props.onSearchReady}
        onCopyBlock={props.onCopyBlock}
        canCopyMarker={props.canCopyMarker}
        onFocusReady={props.onFocusReady}
        onScrollReady={props.onScrollReady}
        onBlockLine={props.onBlockLine}
        onRefreshReady={(refresh) => {
          refreshFn = refresh;
          props.onRefreshReady(refresh);
        }}
      />
    </div>
  );
}
