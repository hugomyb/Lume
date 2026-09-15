import {
  createEffect,
  createResource,
  createSignal,
  For,
  Match,
  onCleanup,
  Show,
  Switch,
  type Accessor,
  type JSX,
} from "solid-js";
import {
  IconArrowRight,
  IconCheck,
  IconCopy,
  IconPlay,
  IconSearch,
  IconSparkles,
  IconStop,
  IconX,
} from "./icons";
import type { Block } from "./blocks";
import { stripAnsi } from "./blocks";
import type { AiState } from "./ai";
import { getShellSetupHint, installShellIntegration } from "./shellSetup";
import { copyText } from "./clipboard";
import MarkdownRender from "./markdown";
import { t, tHtml } from "./i18n";

function BlockAiPanel(props: {
  ai: Accessor<AiState>;
  provider: string;
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
            ? t("blocks.aiThinking", { provider: props.provider })
            : ai().status === "error"
            ? t("blocks.aiError")
            : props.provider}
        </span>
        <button class="block-ai-dismiss" title={t("blocks.aiClose")} onClick={props.onDismiss}>
          <IconX size={12} />
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
              canAsk() ? t("blocks.followupPlaceholder") : t("blocks.followupWait")
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
            title={t("blocks.send")}
          >
            <IconArrowRight size={14} />
          </button>
        </div>
      </Show>
    </div>
  );
}

type Props = {
  blocks: () => Block[];
  totalBlocks: () => number;
  /** True once OSC 133 markers have ever been seen — i.e. shell integration is
   *  working. Drives the empty state: setup instructions vs. a neutral hint. */
  integrationActive: () => boolean;
  /** Position of the pane whose blocks are shown, when the tab is split —
   *  the panel follows the FOCUSED pane, which surprises after a split
   *  (fresh pane → empty panel while history sits in the neighbour). */
  paneInfo?: () => { idx: number; total: number } | null;
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
  /** Display name of the active AI provider (Claude / Codex / AI). */
  aiProvider: () => string;
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

/** Exit badge content: an icon for the two symbolic states (still running /
 *  succeeded), the raw code for anything else. Switch, not plain ifs: the
 *  block mutates in place as the command progresses. */
function ExitCode(props: { b: Block }): JSX.Element {
  return (
    <Switch fallback={<>{String(props.b.exitCode ?? "?")}</>}>
      <Match when={props.b.status === "pending"}>…</Match>
      <Match when={props.b.status === "running"}>
        <IconPlay size={10} />
      </Match>
      <Match when={props.b.exitCode === 0}>
        <IconCheck size={12} />
      </Match>
    </Switch>
  );
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

function EmptyState(props: { active: () => boolean }) {
  // Only fetch the setup hint when integration isn't active yet.
  const [hint] = createResource(
    () => (props.active() ? false : true),
    getShellSetupHint
  );
  const [copied, setCopied] = createSignal(false);
  const [installing, setInstalling] = createSignal(false);
  const [installed, setInstalled] = createSignal<"done" | "already" | null>(
    null
  );
  const [installError, setInstallError] = createSignal("");

  const copy = async (line: string) => {
    try {
      await copyText(line);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error(e);
    }
  };

  const install = async () => {
    setInstalling(true);
    setInstallError("");
    try {
      const r = await installShellIntegration();
      setInstalled(r.already ? "already" : "done");
    } catch (e) {
      setInstallError(String(e));
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div class="blocks-empty">
      <p class="blocks-empty-intro" innerHTML={t("blocks.emptyIntro")} />
      <Show
        when={!props.active()}
        fallback={<p class="muted">{t("blocks.emptyActive")}</p>}
      >
        <p>{t("blocks.emptyHistory")}</p>
        <Show when={hint()} fallback={<p class="muted">{t("blocks.loading")}</p>}>
          {(h) => (
            <>
            <p>
              {t("blocks.addLinePre")} <code>{h().rcFile}</code>{" "}
              {t("blocks.addLinePost")}
            </p>
            <div class="setup-code">
              <code>{h().sourceLine}</code>
              <button
                class="copy-btn"
                title={t("blocks.copy")}
                onClick={() => copy(h().sourceLine)}
              >
                {copied() ? <IconCheck size={13} /> : <IconCopy size={13} />}
              </button>
            </div>
            <Show when={h().shell !== "powershell"}>
              <Show
                when={installed() === null}
                fallback={
                  <p class="blocks-install-done">
                    <IconCheck size={12} />{" "}
                    {t(
                      installed() === "done"
                        ? "blocks.installDone"
                        : "blocks.installAlready",
                      { rc: h().rcFile }
                    )}
                  </p>
                }
              >
                <button
                  class="blocks-install-btn"
                  disabled={installing()}
                  onClick={install}
                >
                  {t("blocks.installAuto", { rc: h().rcFile })}
                </button>
                <Show when={installError()}>
                  <p class="muted">{installError()}</p>
                </Show>
              </Show>
            </Show>
            <p
              class="muted"
              innerHTML={tHtml("blocks.detected", {
                shell: h().shell || t("blocks.shellUnknown"),
              })}
            />
            </>
          )}
        </Show>
      </Show>
    </div>
  );
}

function HelpPopover() {
  const [open, setOpen] = createSignal(false);
  // Escape must close the popover (capture phase, before the app-level
  // handlers grab the key for the terminal/panel).
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
    }
  };
  createEffect(() => {
    if (open()) document.addEventListener("keydown", onKey, true);
    else document.removeEventListener("keydown", onKey, true);
  });
  onCleanup(() => document.removeEventListener("keydown", onKey, true));
  return (
    <div class="help-popover-container">
      <button
        class="blocks-panel-help"
        title={t("blocks.help")}
        onClick={() => setOpen(!open())}
      >
        ?
      </button>
      <Show when={open()}>
        <div class="help-popover" onClick={() => setOpen(false)}>
          <p>{t("blocks.helpIntro")}</p>
          <ul>
            <li>
              <span class="block-exit exit-ok">
                <IconCheck size={12} />
              </span> {t("blocks.exitOk")}
            </li>
            <li>
              <span class="block-exit exit-err">1</span> {t("blocks.exitErr")}
            </li>
            <li>
              <span class="block-exit exit-pending">
                <IconPlay size={10} />
              </span> {t("blocks.exitRunning")}
            </li>
          </ul>
          <p class="muted" innerHTML={t("blocks.helpKeys")} />
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
      await copyText(text);
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
      const el = e.target as HTMLElement;
      if (!el.closest(".block-context-menu")) closeContextMenu();
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
    const provider = props.aiProvider();
    if (!props.aiAvailable()) return t("blocks.aiNoCli", { provider });
    if (b.status !== "done") return t("blocks.aiBlockNotDone");
    if (!b.command) return t("blocks.aiNoCommand");
    if (b.ai?.status === "streaming") return t("blocks.cancel");
    if (b.exitCode !== 0 && b.ai === null) return t("blocks.aiFixError", { provider });
    return t("blocks.aiExplainBlock", { provider });
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
          title={t("blocks.resize")}
          onMouseDown={onResizeDragStart}
          onDblClick={() => props.onResize(360)}
        />
        <Show when={props.searchOpen()}>
          <div class="blocks-search">
            <span class="blocks-search-icon">
              <IconSearch size={13} />
            </span>
            <input
              ref={searchInputRef}
              class="blocks-search-input"
              type="text"
              placeholder={t("blocks.filterPlaceholder")}
              value={props.searchQuery()}
              onInput={(e) => props.onSearchChange(e.currentTarget.value)}
              onKeyDown={onSearchKeyDown}
            />
            <span class="blocks-search-count">
              {props.blocks().length} / {props.totalBlocks()}
            </span>
            <button
              class="blocks-search-close"
              title={t("blocks.searchClose")}
              onClick={() => props.onSearchClose()}
            >
              <IconX size={13} />
            </button>
          </div>
        </Show>
        <div class="blocks-panel-header">
          <span class="blocks-panel-title">
            {t("blocks.title")}
            <Show when={props.paneInfo?.()}>
              {(p) => (
                <span class="blocks-pane-indicator">
                  {" · "}
                  {t("blocks.pane", { n: p().idx, total: p().total })}
                </span>
              )}
            </Show>
          </span>
          <div class="blocks-panel-actions">
            <HelpPopover />
            <button
              class="blocks-panel-toggle"
              title={t("blocks.hide")}
              onClick={props.onToggle}
            >
              ›
            </button>
          </div>
        </div>
        <div class="blocks-list">
          <For
            each={props.blocks()}
            fallback={<EmptyState active={props.integrationActive} />}
          >
            {(b) => (
              <div
                class="block-row"
                classList={{
                  "has-ai": b.ai !== null,
                  "nav-selected": props.selectedBlockId() === b.id,
                }}
                ref={(el) => {
                  const id = b.id;
                  blockRefs.set(id, el);
                  // Purge on row disposal (block removed, cap eviction, leaf
                  // switch) — the map would otherwise retain every detached
                  // row subtree for the whole session. Guarded by identity:
                  // ids restart at 0 per leaf, so a NEW row may have claimed
                  // this id before the old row's cleanup runs.
                  onCleanup(() => {
                    if (blockRefs.get(id) === el) blockRefs.delete(id);
                  });
                }}
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
                            ? t("blocks.clickScroll")
                            : t("blocks.promptNotTracked")
                        }\n${t("blocks.rightClickActions")}`
                      : t("blocks.promptNoCommand")
                  }
                  onClick={(e) => onClickBlock(e, b)}
                  onContextMenu={(e) => openContextMenu(e, b.id)}
                >
                  <span class={`block-exit ${exitClass(b)}`}>
                    <ExitCode b={b} />
                  </span>
                  <span class="block-command">
                    {copiedId() === b.id ? (
                      <>
                        <IconCheck size={12} />{" "}
                        {copyKind() === "output"
                          ? t("blocks.outputCopied")
                          : t("blocks.commandCopied")}
                      </>
                    ) : (
                      formatCommand(b.command)
                    )}
                  </span>
                  <Show when={b.output && b.status === "done"}>
                    <span
                      class="block-output-hint"
                      title={t("blocks.outputCaptured")}
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
                    {b.ai?.status === "streaming" ? (
                      <IconStop size={11} />
                    ) : (
                      <IconSparkles size={13} />
                    )}
                  </button>
                  <Show when={formatDuration(b)}>
                    {(d) => <span class="block-duration">{d()}</span>}
                  </Show>
                </div>
                <Show when={b.ai}>
                  {(ai) => (
                    <BlockAiPanel
                      ai={ai}
                      provider={props.aiProvider()}
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
                  {t("blocks.copyCmd")}
                </button>
                <button
                  class="ctx-item"
                  disabled={!b.output}
                  onClick={() =>
                    b.output && ctxCopy(stripAnsi(b.output), "output")
                  }
                >
                  {t("blocks.copyOutput")}
                </button>
                <button
                  class="ctx-item"
                  disabled={!b.command}
                  onClick={() => {
                    props.onInsertBlock(b.id);
                    closeContextMenu();
                  }}
                >
                  {t("blocks.insertTerminal")}
                </button>
                <button
                  class="ctx-item"
                  disabled={b.markerId === null}
                  onClick={() => {
                    props.onScrollToBlock(b.id);
                    closeContextMenu();
                  }}
                >
                  {t("blocks.gotoCommand")}
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
                  {t("blocks.explainClaude", { provider: props.aiProvider() })}
                </button>
                <Show when={b.ai !== null}>
                  <button
                    class="ctx-item"
                    onClick={() => {
                      props.onDismissAi(b.id);
                      closeContextMenu();
                    }}
                  >
                    {t("blocks.closeAiPanel", { provider: props.aiProvider() })}
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
                  {t("blocks.removeBlock")}
                </button>
              </div>
            );
          }}
        </Show>
      </aside>
    </Show>
  );
}
