import {
  createEffect,
  createResource,
  createSignal,
  For,
  onCleanup,
  Show,
  type Accessor,
} from "solid-js";
import type { Block } from "./blocks";
import { stripAnsi } from "./blocks";
import type { AiState } from "./ai";
import { getShellSetupHint } from "./shellSetup";
import MarkdownRender from "./markdown";

function BlockAiPanel(props: {
  ai: Accessor<AiState>;
  onDismiss: () => void;
  onFollowUp: (q: string) => void;
}) {
  const [draft, setDraft] = createSignal("");

  const ai = () => props.ai();
  const canAsk = () => ai().status !== "streaming";

  const submit = () => {
    const q = draft().trim();
    if (!q || !canAsk()) return;
    props.onFollowUp(q);
    setDraft("");
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div
      class="block-ai-panel"
      classList={{
        streaming: ai().status === "streaming",
        error: ai().status === "error",
      }}
    >
      <div class="block-ai-header">
        <span class="block-ai-label">
          {ai().status === "streaming"
            ? "Claude réfléchit…"
            : ai().status === "error"
            ? "Erreur"
            : "Claude"}
        </span>
        <button class="block-ai-dismiss" title="Fermer" onClick={props.onDismiss}>
          ×
        </button>
      </div>
      <Show when={ai().status === "error"}>
        <div class="block-ai-error">{ai().error}</div>
      </Show>
      <Show when={ai().status !== "error"}>
        <div class="block-ai-conversation">
          <For each={ai().history}>
            {(msg) => (
              <Show when={msg.role === "assistant" || msg.role === "user"}>
                <Show when={msg.role === "user"}>
                  <div class="block-ai-user">{msg.content}</div>
                </Show>
                <Show when={msg.role === "assistant"}>
                  <div class="block-ai-response">
                    <MarkdownRender text={msg.content} />
                  </div>
                </Show>
              </Show>
            )}
          </For>
          <Show when={ai().status === "streaming"}>
            <div class="block-ai-response">
              <MarkdownRender text={ai().response} streaming={true} />
            </div>
          </Show>
        </div>
        <div class="block-ai-followup">
          <input
            type="text"
            class="block-ai-followup-input"
            placeholder={
              canAsk() ? "Question de suivi…" : "Patiente…"
            }
            value={draft()}
            onInput={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={onKeyDown}
            disabled={!canAsk()}
          />
          <button
            class="block-ai-followup-send"
            disabled={!canAsk() || !draft().trim()}
            onClick={submit}
            title="Envoyer (Enter)"
          >
            →
          </button>
        </div>
      </Show>
    </div>
  );
}

type Props = {
  blocks: () => Block[];
  totalBlocks: () => number;
  selectedBlockId: () => number | null;
  navMode: () => boolean;
  visible: () => boolean;
  onToggle: () => void;
  width: () => number;
  onResize: (w: number) => void;
  searchOpen: () => boolean;
  searchQuery: () => string;
  onSearchChange: (q: string) => void;
  onSearchClose: () => void;
  onSearchEnterNav: (andInsert: boolean) => void;
  aiAvailable: () => boolean;
  onExplain: (blockId: number) => void;
  onCancelAi: (blockId: number) => void;
  onDismissAi: (blockId: number) => void;
  onFollowUp: (blockId: number, question: string) => void;
  onRemoveBlock: (blockId: number) => void;
  onInsertBlock: (blockId: number) => void;
  onScrollToBlock: (blockId: number) => void;
};

const MIN_WIDTH = 240;
const MAX_WIDTH = 900;

function formatCommand(cmd: string | null): string {
  if (!cmd) return "(prompt)";
  const trimmed = cmd.trim();
  if (trimmed.length > 80) return trimmed.slice(0, 77) + "…";
  return trimmed;
}

function formatExitCode(b: Block): string {
  if (b.status === "pending") return "…";
  if (b.status === "running") return "▶";
  if (b.exitCode === 0) return "✓";
  return String(b.exitCode ?? "?");
}

function formatDuration(b: Block): string | null {
  if (b.status !== "done" || b.finishedAt === null) return null;
  const ms = b.finishedAt - b.startedAt;
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m${rem.toString().padStart(2, "0")}`;
}

function exitClass(b: Block): string {
  if (b.status === "done" && b.exitCode === 0) return "exit-ok";
  if (b.status === "done") return "exit-err";
  return "exit-pending";
}

function EmptyState() {
  const [hint] = createResource(getShellSetupHint);
  const [copied, setCopied] = createSignal(false);

  const copy = async (line: string) => {
    try {
      await navigator.clipboard.writeText(line);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div class="blocks-empty">
      <p class="blocks-empty-intro">
        Un <strong>bloc</strong> = une commande + sa sortie + son code retour.
        L'historique apparaîtra ici dès que ton shell émet les markers OSC 133.
      </p>
      <Show when={hint()} fallback={<p class="muted">Chargement…</p>}>
        {(h) => (
          <>
            <p>
              Ajoute cette ligne à <code>{h().rcFile}</code> puis ouvre un
              nouveau shell :
            </p>
            <div class="setup-code">
              <code>{h().sourceLine}</code>
              <button
                class="copy-btn"
                title="Copier"
                onClick={() => copy(h().sourceLine)}
              >
                {copied() ? "✓" : "⎘"}
              </button>
            </div>
            <p class="muted">
              Détecté : <code>{h().shell || "shell inconnu"}</code>. Le PTY
              exporte <code>LUME_TERM=1</code> — le source ne s'active que dans
              Lume.
            </p>
          </>
        )}
      </Show>
    </div>
  );
}

function HelpPopover() {
  const [open, setOpen] = createSignal(false);
  return (
    <div class="help-popover-container">
      <button
        class="blocks-panel-help"
        title="C'est quoi ?"
        onClick={() => setOpen(!open())}
      >
        ?
      </button>
      <Show when={open()}>
        <div class="help-popover" onClick={() => setOpen(false)}>
          <p>
            Chaque ligne = une commande exécutée + son résultat. Lume détecte
            les bornes via OSC 133 (markers émis par ton shell).
          </p>
          <ul>
            <li>
              <span class="block-exit exit-ok">✓</span> exit 0
            </li>
            <li>
              <span class="block-exit exit-err">1</span> exit ≠ 0
            </li>
            <li>
              <span class="block-exit exit-pending">▶</span> en cours
            </li>
          </ul>
          <p class="muted">
            Click → scroll au prompt dans le terminal.
            <br />
            Right-click → copier, insérer, expliquer.
            <br />
            <kbd>Ctrl</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> → naviguer, <kbd>↩</kbd>{" "}
            pour insérer dans le terminal.
            <br />
            <span style={{ color: "var(--accent)" }}>✨</span> → explication
            Claude.
          </p>
        </div>
      </Show>
    </div>
  );
}

type ContextMenuState = { x: number; y: number; blockId: number };

export default function BlocksPanel(props: Props) {
  const [copiedId, setCopiedId] = createSignal<number | null>(null);
  const [copyKind, setCopyKind] = createSignal<"command" | "output" | null>(null);
  const [ctxMenu, setCtxMenu] = createSignal<ContextMenuState | null>(null);
  const blockRefs = new Map<number, HTMLElement>();

  createEffect(() => {
    const id = props.selectedBlockId();
    if (id === null) return;
    const el = blockRefs.get(id);
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });

  let searchInputRef: HTMLInputElement | undefined;
  createEffect(() => {
    if (props.searchOpen()) {
      queueMicrotask(() => searchInputRef?.focus());
    }
  });

  const onSearchKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      props.onSearchClose();
    } else if (e.key === "ArrowDown" || e.key === "Enter") {
      e.preventDefault();
      props.onSearchEnterNav(e.key === "Enter");
    }
  };

  const openContextMenu = (e: MouseEvent, blockId: number) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, blockId });
  };

  const closeContextMenu = () => setCtxMenu(null);

  const ctxBlock = () => {
    const m = ctxMenu();
    if (!m) return null;
    return props.blocks().find((b) => b.id === m.blockId) ?? null;
  };

  const ctxCopy = async (text: string, kind: "command" | "output") => {
    const m = ctxMenu();
    if (!m) return;
    try {
      await navigator.clipboard.writeText(text);
      flashCopied(m.blockId, kind);
    } catch (err) {
      console.error(err);
    }
    closeContextMenu();
  };

  // Global handlers to dismiss the context menu. NOTE: Solid's createEffect
  // does NOT accept a returned cleanup function — we have to use onCleanup
  // explicitly, which is tied to this effect's reactive scope and runs before
  // the next iteration or on disposal.
  createEffect(() => {
    if (!ctxMenu()) return;
    const onAnyClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest(".block-context-menu")) closeContextMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeContextMenu();
    };
    window.addEventListener("mousedown", onAnyClick);
    window.addEventListener("keydown", onKey);
    onCleanup(() => {
      window.removeEventListener("mousedown", onAnyClick);
      window.removeEventListener("keydown", onKey);
    });
  });

  let dragStartX = 0;
  let dragStartW = 0;
  const onDragMove = (e: MouseEvent) => {
    const dx = dragStartX - e.clientX;
    const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, dragStartW + dx));
    props.onResize(next);
  };
  const onDragEnd = () => {
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    window.removeEventListener("mousemove", onDragMove);
    window.removeEventListener("mouseup", onDragEnd);
  };
  const onResizeDragStart = (e: MouseEvent) => {
    e.preventDefault();
    dragStartX = e.clientX;
    dragStartW = props.width();
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragEnd);
  };

  const flashCopied = (id: number, kind: "command" | "output") => {
    setCopiedId(id);
    setCopyKind(kind);
    setTimeout(() => {
      if (copiedId() === id) {
        setCopiedId(null);
        setCopyKind(null);
      }
    }, 1500);
  };

  const onClickBlock = (_e: MouseEvent, b: Block) => {
    // Click = scroll xterm to this block, with a visual flash on the prompt.
    // Copy actions live in the right-click context menu.
    if (b.markerId !== null) props.onScrollToBlock(b.id);
  };

  const aiButtonTitle = (b: Block) => {
    if (!props.aiAvailable()) return "Claude CLI introuvable (claude login)";
    if (b.status !== "done") return "Le bloc doit être terminé";
    if (!b.command) return "Pas de commande à expliquer";
    if (b.ai?.status === "streaming") return "Annuler";
    if (b.exitCode !== 0 && b.ai === null) return "Fixer cette erreur avec Claude";
    return "Explique ce bloc avec Claude";
  };

  const isErrorSuggestion = (b: Block) =>
    b.status === "done" &&
    b.exitCode !== 0 &&
    b.exitCode !== null &&
    b.ai === null &&
    props.aiAvailable();

  return (
    <Show when={props.visible()}>
      <aside
        class="blocks-panel"
        classList={{ "nav-mode": props.navMode() }}
        style={{ width: `${props.width()}px` }}
      >
        <div
          class="blocks-panel-resize"
          title="Glisser pour redimensionner"
          onMouseDown={onResizeDragStart}
          onDblClick={() => props.onResize(360)}
        />
        <Show when={props.searchOpen()}>
          <div class="blocks-search">
            <span class="blocks-search-icon">⌕</span>
            <input
              ref={searchInputRef}
              class="blocks-search-input"
              type="text"
              placeholder="Filtrer les blocs…"
              value={props.searchQuery()}
              onInput={(e) => props.onSearchChange(e.currentTarget.value)}
              onKeyDown={onSearchKeyDown}
            />
            <span class="blocks-search-count">
              {props.blocks().length} / {props.totalBlocks()}
            </span>
            <button
              class="blocks-search-close"
              title="Fermer (Esc)"
              onClick={() => props.onSearchClose()}
            >
              ×
            </button>
          </div>
        </Show>
        <div class="blocks-panel-header">
          <span class="blocks-panel-title">Blocs</span>
          <div class="blocks-panel-actions">
            <HelpPopover />
            <button
              class="blocks-panel-toggle"
              title="Masquer (Ctrl+B)"
              onClick={props.onToggle}
            >
              ›
            </button>
          </div>
        </div>
        <div class="blocks-list">
          <For each={props.blocks()} fallback={<EmptyState />}>
            {(b) => (
              <div
                class="block-row"
                classList={{
                  "has-ai": b.ai !== null,
                  "nav-selected": props.selectedBlockId() === b.id,
                }}
                ref={(el) => blockRefs.set(b.id, el)}
              >
                <div
                  class="block-item"
                  classList={{
                    active: b.status === "running",
                    copied: copiedId() === b.id,
                    disabled: !b.command,
                    "ai-streaming": b.ai?.status === "streaming",
                  }}
                  title={
                    b.command
                      ? `${b.command}\n\n${
                          b.markerId !== null
                            ? "Click → scroll au prompt"
                            : "(ligne du prompt non trackée)"
                        }\nRight-click → copier, insérer, expliquer…`
                      : "(prompt sans commande)"
                  }
                  onClick={(e) => onClickBlock(e, b)}
                  onContextMenu={(e) => openContextMenu(e, b.id)}
                >
                  <span class={`block-exit ${exitClass(b)}`}>
                    {formatExitCode(b)}
                  </span>
                  <span class="block-command">
                    {copiedId() === b.id
                      ? copyKind() === "output"
                        ? "Sortie copiée ✓"
                        : "Commande copiée ✓"
                      : formatCommand(b.command)}
                  </span>
                  <Show when={b.output && b.status === "done"}>
                    <span
                      class="block-output-hint"
                      title="Sortie capturée — Shift+Click pour la copier"
                    >
                      ⤓
                    </span>
                  </Show>
                  <button
                    class="block-ai-trigger"
                    classList={{
                      active: b.ai !== null,
                      streaming: b.ai?.status === "streaming",
                      "error-suggest": isErrorSuggestion(b),
                    }}
                    title={aiButtonTitle(b)}
                    disabled={
                      !props.aiAvailable() ||
                      b.status !== "done" ||
                      !b.command
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      if (b.ai?.status === "streaming") {
                        props.onCancelAi(b.id);
                      } else {
                        props.onExplain(b.id);
                      }
                    }}
                  >
                    {b.ai?.status === "streaming" ? "■" : "✨"}
                  </button>
                  <Show when={formatDuration(b)}>
                    {(d) => <span class="block-duration">{d()}</span>}
                  </Show>
                </div>
                <Show when={b.ai}>
                  {(ai) => (
                    <BlockAiPanel
                      ai={ai}
                      onDismiss={() => props.onDismissAi(b.id)}
                      onFollowUp={(q) => props.onFollowUp(b.id, q)}
                    />
                  )}
                </Show>
              </div>
            )}
          </For>
        </div>
        <Show when={ctxMenu()}>
          {(menu) => {
            const b = ctxBlock();
            if (!b) return null;
            const m = menu();
            return (
              <div
                class="block-context-menu"
                style={{ left: `${m.x}px`, top: `${m.y}px` }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  class="ctx-item"
                  disabled={!b.command}
                  onClick={() => b.command && ctxCopy(b.command, "command")}
                >
                  Copier la commande
                </button>
                <button
                  class="ctx-item"
                  disabled={!b.output}
                  onClick={() =>
                    b.output && ctxCopy(stripAnsi(b.output), "output")
                  }
                >
                  Copier la sortie
                </button>
                <button
                  class="ctx-item"
                  disabled={!b.command}
                  onClick={() => {
                    props.onInsertBlock(b.id);
                    closeContextMenu();
                  }}
                >
                  Insérer dans le terminal
                </button>
                <button
                  class="ctx-item"
                  disabled={b.markerId === null}
                  onClick={() => {
                    props.onScrollToBlock(b.id);
                    closeContextMenu();
                  }}
                >
                  Aller à la commande dans le terminal
                </button>
                <div class="ctx-sep" />
                <button
                  class="ctx-item"
                  disabled={
                    !props.aiAvailable() ||
                    b.status !== "done" ||
                    !b.command ||
                    b.ai !== null
                  }
                  onClick={() => {
                    props.onExplain(b.id);
                    closeContextMenu();
                  }}
                >
                  ✨ Explique avec Claude
                </button>
                <Show when={b.ai !== null}>
                  <button
                    class="ctx-item"
                    onClick={() => {
                      props.onDismissAi(b.id);
                      closeContextMenu();
                    }}
                  >
                    Fermer le panneau Claude
                  </button>
                </Show>
                <div class="ctx-sep" />
                <button
                  class="ctx-item danger"
                  onClick={() => {
                    props.onRemoveBlock(b.id);
                    closeContextMenu();
                  }}
                >
                  Supprimer ce bloc
                </button>
              </div>
            );
          }}
        </Show>
      </aside>
    </Show>
  );
}
