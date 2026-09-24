import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { IconWarning } from "./icons";
import { t, tHtml } from "./i18n";

/** A command still running in a pane about to be closed. */
export type RunningCommand = {
  leafId: number;
  command: string | null;
  startedAt: number;
};

/** What the pending confirmation is guarding. `leafId` is null for a whole
 *  tab (which may hold several panes, hence several running commands). */
export type CloseConfirmTarget = {
  kind: "tab" | "pane";
  tabId: number;
  leafId: number | null;
  commands: RunningCommand[];
};

const fmtElapsed = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

/** Confirmation asked before a close would kill a running command. Closing a
 *  pane kills its PTY, and the shell's children with it — so an interrupted
 *  build or deploy is silent data loss. Only ever shown when shell integration
 *  (OSC 133) actually reported a command as running. */
export default function CloseConfirm(props: {
  target: () => CloseConfirmTarget | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Re-render the elapsed times while the dialog sits open.
  const [now, setNow] = createSignal(Date.now());

  // Esc / Enter are handled by the app-level key handler in Tabs.tsx, which
  // already owns the window's capture phase for modals (the terminal keeps
  // focus behind the overlay and would otherwise get the keystroke).
  createEffect(() => {
    if (!props.target()) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    onCleanup(() => clearInterval(timer));
  });

  const commands = () => props.target()?.commands ?? [];

  return (
    <Show when={props.target()}>
      {(target) => (
        <div class="palette-overlay" onClick={() => props.onCancel()}>
          <div
            class="palette confirm-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="confirm-head">
              <span class="confirm-icon">
                <IconWarning size={16} />
              </span>
              <span class="confirm-title">
                {target().kind === "tab"
                  ? t("closeConfirm.titleTab")
                  : t("closeConfirm.titlePane")}
              </span>
            </div>

            <div class="confirm-body">
              <p class="confirm-text">
                {commands().length > 1
                  ? t("closeConfirm.bodyMany", { n: commands().length })
                  : t("closeConfirm.bodyOne")}
              </p>
              <ul class="confirm-cmds">
                <For each={commands()}>
                  {(c) => (
                    <li class="confirm-cmd">
                      <code>
                        {c.command?.trim() || t("closeConfirm.unnamed")}
                      </code>
                      <span class="confirm-elapsed">
                        {t("closeConfirm.elapsed", {
                          d: fmtElapsed(now() - c.startedAt),
                        })}
                      </span>
                    </li>
                  )}
                </For>
              </ul>
            </div>

            <div class="palette-footer">
              <span class="palette-hint" innerHTML={tHtml("closeConfirm.hint")} />
              <div class="palette-actions">
                <button class="palette-btn ghost" onClick={() => props.onCancel()}>
                  {t("closeConfirm.cancel")}
                </button>
                <button class="palette-btn danger" onClick={() => props.onConfirm()}>
                  {t("closeConfirm.confirm")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
}
