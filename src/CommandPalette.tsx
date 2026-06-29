import {
  createEffect,
  createSignal,
  onCleanup,
  Show,
  untrack,
} from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { aiCancel, type AiChunkEvent, type AiDoneEvent, type AiErrorEvent } from "./ai";
import { t } from "./i18n";

type Stage = "input" | "streaming" | "ready" | "error";

type Props = {
  open: () => boolean;
  onClose: () => void;
  aiAvailable: () => boolean;
  /** CLI command the active AI provider resolves to (for the "not found" hint). */
  aiCommand?: () => string;
  ptyId: () => number | null;
  onInsert: (cmd: string) => void;
};

function cleanResponse(s: string): string {
  // Strip surrounding whitespace, leading $ prompts, and triple-fence noise
  // in case the model didn't fully follow instructions.
  let out = s.trim();
  out = out.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```\s*$/, "");
  out = out.replace(/^\$\s+/, "");
  return out.trim();
}

export default function CommandPalette(props: Props) {
  const [query, setQuery] = createSignal("");
  const [stage, setStage] = createSignal<Stage>("input");
  const [response, setResponse] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [requestId, setRequestId] = createSignal<number | null>(null);

  let inputRef: HTMLInputElement | undefined;

  const reset = () => {
    setQuery("");
    setStage("input");
    setResponse("");
    setError(null);
    setRequestId(null);
  };

  const startGenerate = async () => {
    const q = query().trim();
    if (!q || !props.aiAvailable()) return;
    setStage("streaming");
    setResponse("");
    setError(null);
    try {
      const id = await invoke<number>("ai_generate_command", {
        query: q,
        ptyId: props.ptyId(),
      });
      setRequestId(id);
    } catch (e) {
      setStage("error");
      setError(String(e));
    }
  };

  const insertAndClose = () => {
    const cmd = cleanResponse(response());
    if (!cmd) return;
    props.onInsert(cmd);
    reset();
  };

  const cancelStreaming = async () => {
    const id = requestId();
    if (id !== null) {
      try {
        await aiCancel(id);
      } catch {}
    }
    setStage("input");
    setRequestId(null);
  };

  const close = () => {
    const id = requestId();
    if (id !== null && stage() === "streaming") {
      aiCancel(id).catch(() => {});
    }
    reset();
    props.onClose();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      const s = stage();
      if (s === "input") startGenerate();
      else if (s === "ready") insertAndClose();
      else if (s === "error") {
        setStage("input");
        setError(null);
      }
    }
  };

  let unlistenChunk: UnlistenFn | undefined;
  let unlistenDone: UnlistenFn | undefined;
  let unlistenError: UnlistenFn | undefined;

  createEffect(() => {
    if (!props.open()) {
      reset();
      return;
    }
    // Autofocus when opening.
    queueMicrotask(() => inputRef?.focus());
  });

  // Listen to AI streaming events globally and filter by our requestId.
  const setupListeners = async () => {
    unlistenChunk = await listen<AiChunkEvent>("ai:chunk", (e) => {
      if (e.payload.requestId !== untrack(requestId)) return;
      setResponse((r) => r + e.payload.delta);
    });
    unlistenDone = await listen<AiDoneEvent>("ai:done", (e) => {
      if (e.payload.requestId !== untrack(requestId)) return;
      setStage("ready");
    });
    unlistenError = await listen<AiErrorEvent>("ai:error", (e) => {
      if (e.payload.requestId !== untrack(requestId)) return;
      setStage("error");
      setError(e.payload.message);
    });
  };
  setupListeners();

  onCleanup(() => {
    unlistenChunk?.();
    unlistenDone?.();
    unlistenError?.();
  });

  return (
    <Show when={props.open()}>
      <div class="palette-overlay" onClick={close}>
        <div class="palette" onClick={(e) => e.stopPropagation()}>
          <div class="palette-header">
            <span class="palette-prompt">✨</span>
            <input
              ref={inputRef}
              class="palette-input"
              type="text"
              placeholder={t("cmd.placeholder")}
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
              onKeyDown={onKeyDown}
              disabled={stage() === "streaming"}
            />
            <span class="palette-shortcut">
              {stage() === "streaming" ? t("cmd.escCancel") : "Esc"}
            </span>
          </div>

          <Show when={!props.aiAvailable()}>
            <div
              class="palette-warning"
              innerHTML={
                props.aiCommand?.()
                  ? t("cmd.noCli", { cmd: props.aiCommand!() })
                  : t("cmd.noProvider")
              }
            />
          </Show>

          <Show when={stage() === "streaming"}>
            <div class="palette-response streaming">
              <code>{cleanResponse(response()) || "…"}</code>
              <span class="ai-cursor">▌</span>
            </div>
            <div class="palette-footer">
              <button class="palette-btn ghost" onClick={cancelStreaming}>
                {t("cmd.cancel")}
              </button>
            </div>
          </Show>

          <Show when={stage() === "ready"}>
            <div class="palette-response ready">
              <code>{cleanResponse(response())}</code>
            </div>
            <div class="palette-footer">
              <span class="palette-hint" innerHTML={t("cmd.insertHint")} />
              <div class="palette-actions">
                <button class="palette-btn ghost" onClick={() => setStage("input")}>
                  {t("cmd.reformulate")}
                </button>
                <button class="palette-btn primary" onClick={insertAndClose}>
                  {t("cmd.insert")}
                </button>
              </div>
            </div>
          </Show>

          <Show when={stage() === "error"}>
            <div class="palette-response error">
              {error() ?? t("cmd.unknownError")}
            </div>
            <div class="palette-footer">
              <button class="palette-btn ghost" onClick={() => setStage("input")}>
                {t("cmd.retry")}
              </button>
            </div>
          </Show>

          <Show when={stage() === "input" && props.aiAvailable()}>
            <div class="palette-footer">
              <span class="palette-hint" innerHTML={t("cmd.generateHint")} />
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}
