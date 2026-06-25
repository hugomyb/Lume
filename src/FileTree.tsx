import { createEffect, createSignal, For, on, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { invoke } from "@tauri-apps/api/core";
import { IconChevronRight, IconFile, IconFolder } from "./icons";

type FsEntry = { name: string; isDir: boolean };

const join = (dir: string, name: string) =>
  dir.endsWith("/") ? dir + name : dir + "/" + name;

/** POSIX single-quote a path so it survives spaces/special chars in the shell. */
const q = (p: string) => "'" + p.replace(/'/g, "'\\''") + "'";

type Ctx = {
  x: number;
  y: number;
  path: string;
  name: string;
  isDir: boolean;
};

/** One row of the tree. Directories load their children lazily on expand. */
function TreeRow(props: {
  path: string;
  name: string;
  isDir: boolean;
  depth: number;
  showHidden: () => boolean;
  onInsert: (path: string) => void;
  onRun: (command: string) => void;
  onContext: (c: Ctx) => void;
}) {
  const [open, setOpen] = createSignal(false);
  const [children, setChildren] = createSignal<FsEntry[] | null>(null);
  const [error, setError] = createSignal(false);

  const load = async () => {
    try {
      setChildren(
        await invoke<FsEntry[]>("read_dir", {
          path: props.path,
          showHidden: props.showHidden(),
        })
      );
      setError(false);
    } catch {
      setChildren([]);
      setError(true);
    }
  };

  const toggle = () => {
    if (!props.isDir) {
      props.onInsert(props.path);
      return;
    }
    const next = !open();
    setOpen(next);
    if (next && children() === null) load();
  };

  // Reload an already-open directory ONLY when the hidden-files toggle flips.
  // (Tracking children() here would loop: load() sets children → re-run → …)
  createEffect(
    on(
      props.showHidden,
      () => {
        if (open() && children() !== null) load();
      },
      { defer: true }
    )
  );

  const indent = `${props.depth * 12 + 6}px`;
  return (
    <div>
      <div
        class="ft-row"
        classList={{ dir: props.isDir }}
        style={{ "padding-left": indent }}
        onClick={toggle}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          props.onContext({
            x: e.clientX,
            y: e.clientY,
            path: props.path,
            name: props.name,
            isDir: props.isDir,
          });
        }}
      >
        <span class="ft-caret">
          <Show when={props.isDir}>
            <span class="ft-chevron" classList={{ open: open() }}>
              <IconChevronRight size={12} />
            </span>
          </Show>
        </span>
        <span class="ft-icon">
          {props.isDir ? <IconFolder size={14} /> : <IconFile size={14} />}
        </span>
        <span class="ft-name">{props.name}</span>
      </div>
      <Show when={props.isDir && open()}>
        <Show
          when={!error()}
          fallback={
            <div class="ft-note" style={{ "padding-left": indent }}>
              accès refusé
            </div>
          }
        >
          <For each={children() ?? []}>
            {(c) => (
              <TreeRow
                path={join(props.path, c.name)}
                name={c.name}
                isDir={c.isDir}
                depth={props.depth + 1}
                showHidden={props.showHidden}
                onInsert={props.onInsert}
                onRun={props.onRun}
                onContext={props.onContext}
              />
            )}
          </For>
          <Show when={children() !== null && children()!.length === 0}>
            <div class="ft-note" style={{ "padding-left": indent }}>
              vide
            </div>
          </Show>
        </Show>
      </Show>
    </div>
  );
}

/** Left sidebar showing the active pane's working-directory tree. Re-roots
 *  whenever the active pane's cwd changes (cd, pane switch). */
export default function FileTree(props: {
  cwd: () => string | null;
  visible: () => boolean;
  width: () => number;
  onResize: (w: number) => void;
  onToggle: () => void;
  /** Run a command in the active terminal. */
  onRun: (command: string) => void;
  /** Insert text into the active terminal (no execute). */
  onInsert: (text: string) => void;
  /** Copy text to the clipboard. */
  onCopy: (text: string) => void;
}) {
  // Hidden files (dotfiles) shown by default.
  const [showHidden, setShowHidden] = createSignal(true);
  const [root, setRoot] = createSignal<FsEntry[] | null>(null);
  const [refreshKey, setRefreshKey] = createSignal(0);
  const [ctx, setCtx] = createSignal<Ctx | null>(null);

  const loadRoot = async () => {
    const cwd = props.cwd();
    if (!cwd) {
      setRoot(null);
      return;
    }
    try {
      setRoot(
        await invoke<FsEntry[]>("read_dir", { path: cwd, showHidden: showHidden() })
      );
    } catch {
      setRoot([]);
    }
  };

  createEffect(() => {
    props.cwd();
    showHidden();
    refreshKey();
    loadRoot();
  });

  const label = () => {
    const cwd = props.cwd();
    if (!cwd) return "—";
    return cwd.replace(/\/$/, "").split("/").pop() || "/";
  };

  // Resize handle on the right edge.
  let startX = 0;
  let startW = 0;
  const onMove = (e: MouseEvent) =>
    props.onResize(Math.max(180, Math.min(600, startW + (e.clientX - startX))));
  const onUp = () => {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
  };
  const startResize = (e: MouseEvent) => {
    e.preventDefault();
    startX = e.clientX;
    startW = props.width();
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // Context-menu actions for the right-clicked entry.
  type Action = { label: string; run: (c: Ctx) => void } | "sep";
  const actionsFor = (c: Ctx): Action[] => {
    const common: Action[] = [
      "sep",
      { label: "Copier le chemin", run: (c) => props.onCopy(c.path) },
      { label: "Insérer le chemin", run: (c) => props.onInsert(q(c.path) + " ") },
    ];
    if (c.isDir) {
      return [
        { label: "Aller dans le dossier", run: (c) => props.onRun(`cd ${q(c.path)}`) },
        { label: "Lister (ls -la)", run: (c) => props.onRun(`ls -la ${q(c.path)}`) },
        { label: "Ouvrir dans l'éditeur", run: (c) => props.onRun(`\${EDITOR:-nano} ${q(c.path)}`) },
        ...common,
      ];
    }
    return [
      { label: "Afficher (cat)", run: (c) => props.onRun(`cat ${q(c.path)}`) },
      { label: "Éditer (nano)", run: (c) => props.onRun(`nano ${q(c.path)}`) },
      { label: "Ouvrir ($EDITOR)", run: (c) => props.onRun(`\${EDITOR:-nano} ${q(c.path)}`) },
      ...common,
    ];
  };

  return (
    <Show when={props.visible()}>
      <div class="file-tree-panel" style={{ width: `${props.width()}px` }}>
        <div class="file-tree-header">
          <span class="ft-title">{label()}</span>
          <div class="ft-header-actions">
            <button
              class="ft-btn"
              classList={{ active: showHidden() }}
              title="Fichiers cachés"
              onClick={() => setShowHidden(!showHidden())}
            >
              .*
            </button>
            <button
              class="ft-btn"
              title="Rafraîchir"
              onClick={() => setRefreshKey(refreshKey() + 1)}
            >
              ⟳
            </button>
            <button class="ft-btn" title="Fermer" onClick={() => props.onToggle()}>
              ×
            </button>
          </div>
        </div>
        <div class="file-tree-body">
          <Show
            when={props.cwd()}
            fallback={<div class="ft-note">Dossier inconnu</div>}
          >
            <For each={root() ?? []}>
              {(e) => (
                <TreeRow
                  path={join(props.cwd()!, e.name)}
                  name={e.name}
                  isDir={e.isDir}
                  depth={0}
                  showHidden={showHidden}
                  onInsert={props.onInsert}
                  onRun={props.onRun}
                  onContext={setCtx}
                />
              )}
            </For>
          </Show>
        </div>
        <div class="file-tree-resize" onMouseDown={startResize} />
      </div>

      <Show when={ctx()}>
        {(c) => (
          <Portal>
            <div class="ft-ctx-backdrop" onMouseDown={() => setCtx(null)} onContextMenu={(e) => { e.preventDefault(); setCtx(null); }} />
            <div
              class="ft-ctx-menu"
              style={{ left: `${c().x}px`, top: `${c().y}px` }}
            >
              <div class="ft-ctx-title">{c().name}</div>
              <For each={actionsFor(c())}>
                {(a) =>
                  a === "sep" ? (
                    <div class="ft-ctx-sep" />
                  ) : (
                    <button
                      class="ft-ctx-item"
                      onClick={() => {
                        a.run(c());
                        setCtx(null);
                      }}
                    >
                      {a.label}
                    </button>
                  )
                }
              </For>
            </div>
          </Portal>
        )}
      </Show>
    </Show>
  );
}
