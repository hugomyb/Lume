import { invoke } from "@tauri-apps/api/core";

/** A pane of a workspace layout, or a split of two (or more) sub-layouts. */
export type WsNode =
  | { split: "row" | "column"; ratio?: number; children: WsNode[] }
  | { cwd?: string | null; command?: string | null };

export type WsTab = { title?: string | null; layout: WsNode };

export type Workspace = {
  name: string;
  description?: string | null;
  tabs: WsTab[];
  /** File name under ~/.config/lume/workspaces (empty for a new one). */
  source?: string;
};

export function listWorkspaces(): Promise<Workspace[]> {
  return invoke<Workspace[]>("list_workspaces");
}

/** Create (no source) or overwrite (source) a workspace. Resolves to its file name. */
export function saveWorkspace(
  workspace: Workspace,
  source: string | null = null
): Promise<string> {
  return invoke<string>("save_workspace", {
    workspace: { ...workspace, source: "" },
    source,
  });
}

export function deleteWorkspace(source: string): Promise<void> {
  return invoke("delete_workspace", { source });
}

export function workspaceFilePath(source: string): Promise<string> {
  return invoke<string>("workspace_file_path", { source });
}

export function expandPath(path: string): Promise<string> {
  return invoke<string>("expand_path", { path });
}

export function isSplit(
  n: WsNode
): n is { split: "row" | "column"; ratio?: number; children: WsNode[] } {
  return "split" in n && Array.isArray((n as { children?: unknown }).children);
}

/** Every pane of a layout, in order. */
export function wsPanes(n: WsNode): { cwd?: string | null; command?: string | null }[] {
  if (isSplit(n)) return n.children.flatMap(wsPanes);
  return [n];
}

/** Startup commands of a whole workspace (to show what "open and run" does). */
export function wsCommands(ws: Workspace): string[] {
  return ws.tabs
    .flatMap((t) => wsPanes(t.layout))
    .map((p) => (p.command ?? "").trim())
    .filter(Boolean);
}
