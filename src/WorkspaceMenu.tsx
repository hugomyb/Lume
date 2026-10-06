import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { wsCommands, wsPanes, type Workspace } from "./workspaces";
import { IconPencil, IconPlay, IconRefresh, IconWorkspace, IconX } from "./icons";
import { t } from "./i18n";

/** Dropdown under the tab bar's ▾ button: open a saved workspace in one
 *  click, save the current tabs as one, and manage the existing ones. */
export default function WorkspaceMenu(props: {
  open: () => boolean;
  /** Rect of the ▾ button, to anchor the dropdown under it. */
  anchor: () => DOMRect | null;
  workspaces: () => Workspace[];
  onClose: () => void;
  onOpen: (ws: Workspace, withCommands: boolean) => void;
  onSave: (name: string, scope: "tab" | "all") => Promise<void>;
  tabCount: () => number;
  /** Name of the workspace a save would replace (same name), if any. */
  existingName: (name: string) => string | null;
  onUpdate: (ws: Workspace) => Promise<void>;
  onEdit: (ws: Workspace) => void;
  onDelete: (ws: Workspace) => Promise<void>;
}) {
  const [saving, setSaving] = createSignal(false);
  const [name, setName] = createSignal("");
  const [scope, setScope] = createSignal<"tab" | "all">("tab");
  const [error, setError] = createSignal<string | null>(null);
  const [confirmDelete, setConfirmDelete] = createSignal<string | null>(null);
  const [flash, setFlash] = createSignal<string | null>(null);
  let inputRef: HTMLInputElement | undefined;
  let menuRef: HTMLDivElement | undefined;

  createEffect(() => {
    if (!props.open()) {
      setSaving(false);
      setName("");
      setScope("tab");
      setError(null);
      setConfirmDelete(null);
      return;
    }
    // Close on outside click / Escape (capture: the terminal swallows Esc).
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (!el.closest(".ws-menu") && !el.closest(".tab-ws-toggle")) props.onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      if (saving()) setSaving(false);
      else props.onClose();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    onCleanup(() => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    });
  });

  const position = () => {
    const r = props.anchor();
    const width = 340;
    if (!r) return { left: "8px", top: "36px" };
    const left = Math.max(8, Math.min(r.left - 8, window.innerWidth - width - 8));
    return { left: `${left}px`, top: `${r.bottom + 4}px` };
  };

  const startSave = () => {
    setSaving(true);
    setError(null);
    queueMicrotask(() => inputRef?.focus());
  };

  const submitSave = async () => {
    const n = name().trim();
    if (!n) return;
    try {
      await props.onSave(n, props.tabCount() > 1 ? scope() : "tab");
      setSaving(false);
      setName("");
      setFlash(n);
      setTimeout(() => setFlash(null), 1500);
    } catch (e) {
      setError(String(e));
    }
  };

  const summary = (ws: Workspace) => {
    const panes = ws.tabs.reduce((n, tab) => n + wsPanes(tab.layout).length, 0);
    const cmds = wsCommands(ws);
    const parts = [t("wsMenu.tabs", { n: ws.tabs.length })];
    if (panes > ws.tabs.length) parts.push(t("wsMenu.panes", { n: panes }));
    if (cmds.length) parts.push(cmds.join(" · "));
    return parts.join("  ·  ");
  };

  return (
    <Show when={props.open()}>
      <div class="ws-menu" ref={menuRef} style={position()} onMouseDown={(e) => e.stopPropagation()}>
        <div class="ws-menu-title">{t("wsMenu.title")}</div>

        <Show
          when={props.workspaces().length > 0}
          fallback={<p class="ws-menu-empty">{t("wsMenu.empty")}</p>}
        >
          <div class="ws-menu-list">
            <For each={props.workspaces()}>
              {(ws) => {
                const hasCmds = () => wsCommands(ws).length > 0;
                return (
                  <div
                    class="ws-menu-item"
                    classList={{ flash: flash() === ws.name }}
                    title={t("wsMenu.openTitle")}
                    onClick={() => {
                      props.onOpen(ws, true);
                      props.onClose();
                    }}
                  >
                    <span class="ws-menu-icon">
                      <IconWorkspace size={14} />
                    </span>
                    <div class="ws-menu-main">
                      <span class="ws-menu-name">{ws.name}</span>
                      <span class="ws-menu-sub">{summary(ws)}</span>
                    </div>
                    <div class="ws-menu-actions" onClick={(e) => e.stopPropagation()}>
                      <Show when={hasCmds()}>
                        <button
                          class="ws-menu-btn"
                          title={t("wsMenu.openNoCmd")}
                          onClick={() => {
                            props.onOpen(ws, false);
                            props.onClose();
                          }}
                        >
                          <span class="ws-menu-nocmd">
                            <IconPlay size={10} />
                          </span>
                        </button>
                      </Show>
                      <button
                        class="ws-menu-btn"
                        title={t("wsMenu.update")}
                        onClick={async () => {
                          await props.onUpdate(ws);
                          setFlash(ws.name);
                          setTimeout(() => setFlash(null), 1500);
                        }}
                      >
                        <IconRefresh size={12} />
                      </button>
                      <button
                        class="ws-menu-btn"
                        title={t("wsMenu.edit")}
                        onClick={() => {
                          props.onEdit(ws);
                          props.onClose();
                        }}
                      >
                        <IconPencil size={12} />
                      </button>
                      <button
                        class="ws-menu-btn danger"
                        classList={{ confirm: confirmDelete() === ws.source }}
                        title={confirmDelete() === ws.source ? t("wsMenu.deleteConfirm") : t("wsMenu.delete")}
                        onMouseLeave={() => confirmDelete() === ws.source && setConfirmDelete(null)}
                        onClick={async () => {
                          if (confirmDelete() !== ws.source) {
                            setConfirmDelete(ws.source ?? null);
                            return;
                          }
                          setConfirmDelete(null);
                          await props.onDelete(ws);
                        }}
                      >
                        <Show when={confirmDelete() === ws.source} fallback={<IconX size={12} />}>
                          <span class="ws-menu-confirm">{t("wsMenu.deleteShort")}</span>
                        </Show>
                      </button>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>

        <div class="ws-menu-sep" />
        <Show
          when={saving()}
          fallback={
            <button class="ws-menu-save" onClick={startSave}>
              + {t("wsMenu.save")}
            </button>
          }
        >
          <div class="ws-menu-form">
            <input
              ref={inputRef}
              class="ws-menu-input"
              placeholder={t("palette.wsNamePlaceholder")}
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submitSave();
                }
              }}
            />
            <button class="ws-menu-primary" disabled={!name().trim()} onClick={() => void submitSave()}>
              {t("wsMenu.saveBtn")}
            </button>
          </div>
          <Show when={props.tabCount() > 1}>
            <div class="ws-menu-scope">
              <button
                classList={{ on: scope() === "tab" }}
                onClick={() => {
                  setScope("tab");
                  inputRef?.focus();
                }}
              >
                {t("wsMenu.scopeTab")}
              </button>
              <button
                classList={{ on: scope() === "all" }}
                onClick={() => {
                  setScope("all");
                  inputRef?.focus();
                }}
              >
                {t("wsMenu.scopeAll", { n: props.tabCount() })}
              </button>
            </div>
          </Show>
          <Show
            when={props.existingName(name())}
            fallback={<p class="ws-menu-hint">{t("wsMenu.saveHint")}</p>}
          >
            {(existing) => (
              <p class="ws-menu-hint warn">{t("wsMenu.replaces", { name: existing() })}</p>
            )}
          </Show>
          <Show when={error()}>
            <p class="ws-menu-error">{error()}</p>
          </Show>
        </Show>
      </div>
    </Show>
  );
}
