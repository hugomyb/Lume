import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
import type { LeafData, TreeNode } from "./panes";
import { t } from "./i18n";

/** Shared registry of leaf placeholder DOM nodes. Filled by `LeafView` as
 *  cards mount/unmount; consumed by `TerminalPool` in Tabs to move Terminal
 *  DOM into the matching card.
 *
 *  The signal `placeholderVer` is bumped on every change so `createEffect`
 *  consumers re-run. We don't store a reactive Map (Solid doesn't proxy Map)
 *  — instead we use a plain Map plus a version counter. */
export const placeholderMap = new Map<number, HTMLDivElement>();
export const [placeholderVer, bumpPlaceholderVer] = createSignal(0);
const bump = () => bumpPlaceholderVer((v) => v + 1);

export type LeafCallbacks = {
  onActivate: (leafId: number) => void;
  onResize?: (splitId: number, ratio: number) => void;
  onDropTab?: (
    leafId: number,
    fromTabId: number,
    direction: "row" | "column",
    side: "before" | "after"
  ) => void;
  onContextMenu?: (leafId: number, x: number, y: number) => void;
  onSwapPane?: (fromLeafId: number, toLeafId: number) => void;
  /** Move a dragged pane to an edge of the target leaf, restructuring the tree
   *  (vs. onSwapPane which only exchanges positions). */
  onMovePane?: (
    fromLeafId: number,
    toLeafId: number,
    direction: "row" | "column",
    side: "before" | "after"
  ) => void;
};

type Props = {
  node: TreeNode;
  leaves: Record<number, LeafData>;
  activeLeafId: number;
  isDraggingTab: () => boolean;
  draggingPaneLeafId: () => number | null;
  callbacks: LeafCallbacks;
};

function startSplitDrag(
  e: MouseEvent,
  splitId: number,
  direction: "row" | "column",
  containerEl: HTMLElement | null,
  onResize: ((splitId: number, ratio: number) => void) | undefined
) {
  if (!containerEl || !onResize) return;
  e.preventDefault();
  const rect = containerEl.getBoundingClientRect();
  const onMove = (mv: MouseEvent) => {
    const ratio =
      direction === "row"
        ? (mv.clientX - rect.left) / rect.width
        : (mv.clientY - rect.top) / rect.height;
    onResize(splitId, ratio);
  };
  const onUp = () => {
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };
  document.body.style.cursor = direction === "row" ? "col-resize" : "row-resize";
  document.body.style.userSelect = "none";
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

export default function PaneNode(props: Props) {
  return (
    <Show
      when={props.node.type === "leaf"}
      fallback={<SplitView {...props} />}
    >
      <LeafView {...props} />
    </Show>
  );
}

type DropZone = "left" | "right" | "top" | "bottom" | "swap" | null;

function LeafView(props: Props) {
  // IMPORTANT: getters, not snapshots. In Solid, props are reactive but the
  // function body of a component runs ONCE. `const node = props.node` would
  // freeze the leaf id at creation time, so when the tree restructures and
  // PaneNode keeps this LeafView mounted (same Show branch), our placeholder
  // map / data-leaf-id / activation comparisons all stay on the stale id.
  const node = () => props.node as { type: "leaf"; leafId: number };
  const isActive = () => props.activeLeafId === node().leafId;

  let leafRef: HTMLDivElement | undefined;
  const [zone, setZone] = createSignal<DropZone>(null);

  // Track leafId changes so we update placeholderMap when the same LeafView
  // instance gets reused for a different leaf.
  //
  // IMPORTANT: do NOT delete the old id here when remapping. During a pane
  // swap, two LeafViews exchange leafIds simultaneously; if each one deletes
  // its old id, whichever runs last will wipe out the entry the other just
  // wrote. We only overwrite — orphan entries get reclaimed when the LeafView
  // now displaying that id runs its own sync().
  let registeredId: number | undefined;
  const sync = () => {
    if (!leafRef) return;
    const id = node().leafId;
    if (id === registeredId) return;
    placeholderMap.set(id, leafRef);
    registeredId = id;
    bump();
  };

  onMount(sync);
  onCleanup(() => {
    if (registeredId === undefined) return;
    // Only delete if we still own this entry. Another LeafView may have taken
    // over our id during a swap right before we unmounted.
    if (placeholderMap.get(registeredId) === leafRef) {
      placeholderMap.delete(registeredId);
      bump();
    }
  });

  // Re-run sync whenever leafId changes (without a remount).
  createEffect(() => {
    node().leafId;
    sync();
  });

  // `allowSwap` (pane drags only) reserves the central region of the card for a
  // swap; the surrounding band picks the nearest edge. Tab drags always split,
  // so they pass allowSwap=false and the whole card maps to an edge.
  function computeZone(e: DragEvent, allowSwap = false): DropZone {
    if (!leafRef) return null;
    const rect = leafRef.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;
    const dL = x / w;
    const dR = (w - x) / w;
    const dT = y / h;
    const dB = (h - y) / h;
    const min = Math.min(dL, dR, dT, dB);
    // > 0.30 from every edge → central 40%×40% box → swap.
    if (allowSwap && min > 0.3) return "swap";
    if (min === dL) return "left";
    if (min === dR) return "right";
    if (min === dT) return "top";
    return "bottom";
  }

  const isPaneDragFromOther = () => {
    const id = props.draggingPaneLeafId();
    return id !== null && id !== node().leafId;
  };
  const showCatcher = () => props.isDraggingTab() || isPaneDragFromOther();

  const onCatcherDrop = (e: DragEvent) => {
    e.preventDefault();
    const paneRaw = e.dataTransfer?.getData("text/lume-pane");
    if (paneRaw) {
      const fromLeafId = Number(paneRaw);
      const z = computeZone(e, true);
      setZone(null);
      if (!z || z === "swap") {
        props.callbacks.onSwapPane?.(fromLeafId, node().leafId);
      } else {
        const direction: "row" | "column" =
          z === "left" || z === "right" ? "row" : "column";
        const side: "before" | "after" =
          z === "left" || z === "top" ? "before" : "after";
        props.callbacks.onMovePane?.(fromLeafId, node().leafId, direction, side);
      }
      return;
    }
    const raw = e.dataTransfer?.getData("text/lume-tab");
    if (!raw) return;
    const fromTabId = Number(raw);
    const z = computeZone(e);
    setZone(null);
    if (!z || z === "swap") return;
    const direction: "row" | "column" =
      z === "left" || z === "right" ? "row" : "column";
    const side: "before" | "after" =
      z === "left" || z === "top" ? "before" : "after";
    props.callbacks.onDropTab?.(node().leafId, fromTabId, direction, side);
  };

  const dragTypes = (e: DragEvent) => {
    const types = e.dataTransfer?.types;
    return {
      tab: !!types?.includes("text/lume-tab"),
      pane: !!types?.includes("text/lume-pane"),
    };
  };

  return (
    <div
      ref={leafRef}
      class="pane-leaf"
      data-leaf-id={node().leafId}
      classList={{ "pane-active": isActive() }}
      onMouseDown={() => props.callbacks.onActivate(node().leafId)}
      onContextMenu={(e) => {
        e.preventDefault();
        props.callbacks.onActivate(node().leafId);
        props.callbacks.onContextMenu?.(node().leafId, e.clientX, e.clientY);
      }}
    >
      {/* Terminal DOM is portaled here from the top-level pool via JS. */}
      <Show when={showCatcher()}>
        <div
          class="pane-drop-catcher"
          onDragEnter={(e) => {
            const { tab, pane } = dragTypes(e);
            if (!tab && !pane) return;
            e.preventDefault();
            setZone(computeZone(e, pane));
          }}
          onDragOver={(e) => {
            const { tab, pane } = dragTypes(e);
            if (!tab && !pane) return;
            e.preventDefault();
            e.dataTransfer!.dropEffect = pane ? "move" : "copy";
            setZone(computeZone(e, pane));
          }}
          onDragLeave={(e) => {
            if (
              e.relatedTarget &&
              (e.currentTarget as HTMLElement).contains(
                e.relatedTarget as Node
              )
            )
              return;
            setZone(null);
          }}
          onDrop={onCatcherDrop}
        >
          <Show when={zone()}>
            <div class={`pane-drop-zone ${zone()}`}>
              <Show when={isPaneDragFromOther()}>
                <span class="pane-drop-label">
                  {zone() === "swap" ? t("pane.swap") : t("pane.moveHere")}
                </span>
              </Show>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

function SplitView(props: Props) {
  // Same Solid pitfall as LeafView: getter, not snapshot.
  const split = () => props.node as Extract<TreeNode, { type: "split" }>;
  let containerRef: HTMLDivElement | undefined;

  return (
    <div
      ref={containerRef}
      class="pane-split"
      classList={{
        row: split().direction === "row",
        column: split().direction === "column",
      }}
    >
      <div class="pane-child" style={{ flex: `${split().ratio} 1 0%` }}>
        <PaneNode
          node={split().children[0]}
          leaves={props.leaves}
          activeLeafId={props.activeLeafId}
          isDraggingTab={props.isDraggingTab}
          draggingPaneLeafId={props.draggingPaneLeafId}
          callbacks={props.callbacks}
        />
      </div>
      <div
        class="pane-divider"
        onMouseDown={(e) =>
          startSplitDrag(
            e,
            split().id,
            split().direction,
            containerRef ?? null,
            props.callbacks.onResize
          )
        }
      />
      <div class="pane-child" style={{ flex: `${1 - split().ratio} 1 0%` }}>
        <PaneNode
          node={split().children[1]}
          leaves={props.leaves}
          activeLeafId={props.activeLeafId}
          isDraggingTab={props.isDraggingTab}
          draggingPaneLeafId={props.draggingPaneLeafId}
          callbacks={props.callbacks}
        />
      </div>
    </div>
  );
}
