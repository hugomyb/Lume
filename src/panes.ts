import type { Block } from "./blocks";

export type LeafData = {
  id: number;
  ptyId: number | null;
  blocks: Block[];
  nextBlockId: number;
  selectedBlockId: number | null;
  /** Text to write to the PTY once it spawns (e.g. `ssh host\n` for a leaf
   *  opened from the SSH manager). Cleared after it's sent. */
  pendingInput: string | null;
  /** Last-known working directory (OSC 7). Persisted so the pane reopens in the
   *  same place after a Lume restart. Also used as the spawn cwd on restore. */
  cwd: string | null;
};

export type TreeNode =
  | { type: "leaf"; leafId: number }
  | {
      type: "split";
      id: number;
      direction: "row" | "column";
      ratio: number;
      children: [TreeNode, TreeNode];
    };

let nextLeafId = 0;
let nextSplitId = 0;

export function makeLeaf(): LeafData {
  return {
    id: nextLeafId++,
    ptyId: null,
    blocks: [],
    nextBlockId: 0,
    selectedBlockId: null,
    pendingInput: null,
    cwd: null,
  };
}

/** Build a leaf with a specific id (used when restoring a persisted session). */
export function makeLeafWithId(id: number, cwd: string | null): LeafData {
  return {
    id,
    ptyId: null,
    blocks: [],
    nextBlockId: 0,
    selectedBlockId: null,
    pendingInput: null,
    cwd,
  };
}

/** Current id counters, for persisting the session. */
export function paneCounters(): { nextLeafId: number; nextSplitId: number } {
  return { nextLeafId, nextSplitId };
}

/** Advance the id counters so freshly-created leaves/splits never collide with
 *  ids restored from a persisted session. */
export function seedPaneCounters(leafId: number, splitId: number) {
  if (Number.isFinite(leafId) && leafId > nextLeafId) nextLeafId = leafId;
  if (Number.isFinite(splitId) && splitId > nextSplitId) nextSplitId = splitId;
}

export function makeSplit(
  direction: "row" | "column",
  a: TreeNode,
  b: TreeNode,
  ratio = 0.5
): TreeNode {
  return {
    type: "split",
    id: nextSplitId++,
    direction,
    ratio,
    children: [a, b],
  };
}

/** All leafIds in tree, in left-to-right depth-first order. */
export function leafIds(node: TreeNode): number[] {
  if (node.type === "leaf") return [node.leafId];
  return [...leafIds(node.children[0]), ...leafIds(node.children[1])];
}

/** Returns a new tree where `leafId` is replaced by a fresh split containing
 *  the original leaf and a new leaf (whose id is `newLeafId`). */
export function splitAt(
  node: TreeNode,
  leafId: number,
  direction: "row" | "column",
  newLeafId: number
): TreeNode {
  if (node.type === "leaf") {
    if (node.leafId !== leafId) return node;
    return makeSplit(
      direction,
      { type: "leaf", leafId },
      { type: "leaf", leafId: newLeafId }
    );
  }
  return {
    ...node,
    children: [
      splitAt(node.children[0], leafId, direction, newLeafId),
      splitAt(node.children[1], leafId, direction, newLeafId),
    ] as [TreeNode, TreeNode],
  };
}

/** Returns a new tree with `leafId` removed; its sibling is promoted up.
 *  Returns null if the tree is reduced to nothing (caller should keep a
 *  single empty leaf in that case). */
export function removeLeaf(node: TreeNode, leafId: number): TreeNode | null {
  if (node.type === "leaf") return node.leafId === leafId ? null : node;
  const a = removeLeaf(node.children[0], leafId);
  const b = removeLeaf(node.children[1], leafId);
  if (a === null) return b;
  if (b === null) return a;
  return { ...node, children: [a, b] };
}

/** Find the neighbour leaf when moving from `fromId` in a direction.
 *  Walks up the tree until a split in the matching axis is found, then
 *  descends into the sibling subtree on the correct edge. */
export function neighbourLeaf(
  node: TreeNode,
  fromId: number,
  direction: "left" | "right" | "up" | "down"
): number | null {
  // Build a path of parents from root to the leaf.
  const path: { node: Extract<TreeNode, { type: "split" }>; childIndex: 0 | 1 }[] = [];
  function walk(n: TreeNode): boolean {
    if (n.type === "leaf") return n.leafId === fromId;
    if (walk(n.children[0])) {
      path.unshift({ node: n, childIndex: 0 });
      return true;
    }
    if (walk(n.children[1])) {
      path.unshift({ node: n, childIndex: 1 });
      return true;
    }
    return false;
  }
  if (!walk(node)) return null;

  const wantAxis: "row" | "column" =
    direction === "left" || direction === "right" ? "row" : "column";
  const wantSide: 0 | 1 = direction === "left" || direction === "up" ? 0 : 1;

  // Walk up until we find a split on the right axis where we can step sideways.
  for (let i = 0; i < path.length; i++) {
    const { node: split, childIndex } = path[i];
    if (split.direction !== wantAxis) continue;
    // We need to step from our child slot to the *other* slot, only if our
    // slot is on the opposite side of the requested direction.
    if (childIndex === wantSide) continue;
    const sibling = split.children[wantSide];
    // Descend to the leaf nearest the original pane (= adjacent edge).
    return descendNearest(sibling, wantSide === 0 ? 1 : 0, wantAxis);
  }
  return null;
}

/** Descend a subtree, always picking the child on `edge` for splits along
 *  `wantAxis`, and the first leaf otherwise. */
function descendNearest(
  node: TreeNode,
  edge: 0 | 1,
  wantAxis: "row" | "column"
): number {
  if (node.type === "leaf") return node.leafId;
  if (node.direction === wantAxis) {
    return descendNearest(node.children[edge], edge, wantAxis);
  }
  return descendNearest(node.children[0], edge, wantAxis);
}

/** Update a split's ratio. */
export function setSplitRatio(
  node: TreeNode,
  splitId: number,
  ratio: number
): TreeNode {
  if (node.type === "leaf") return node;
  if (node.id === splitId) {
    return { ...node, ratio: Math.max(0.1, Math.min(0.9, ratio)) };
  }
  return {
    ...node,
    children: [
      setSplitRatio(node.children[0], splitId, ratio),
      setSplitRatio(node.children[1], splitId, ratio),
    ] as [TreeNode, TreeNode],
  };
}
