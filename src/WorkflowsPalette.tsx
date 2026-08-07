import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Show,
} from "solid-js";
import {
  deleteWorkflow,
  effectiveArgs,
  fillCommand,
  listWorkflows,
  placeholderNames,
  saveWorkflow,
  type Workflow,
} from "./workflows";
import { t } from "./i18n";

type Props = {
  open: () => boolean;
  onClose: () => void;
  onInsert: (command: string) => void;
};

export default function WorkflowsPalette(props: Props) {
  const [workflows, setWorkflows] = createSignal<Workflow[]>([]);
  const [error, setError] = createSignal<string | null>(null);
  const [query, setQuery] = createSignal("");
  const [index, setIndex] = createSignal(0);
  const [selected, setSelected] = createSignal<Workflow | null>(null);
  const [values, setValues] = createSignal<Record<string, string>>({});
  // Editor stage: null = closed, { source: null } = new, { source } = editing.
  const [editing, setEditing] = createSignal<{ source: string | null } | null>(
    null
  );
  const [edName, setEdName] = createSignal("");
  const [edDesc, setEdDesc] = createSignal("");
  const [edCommand, setEdCommand] = createSignal("");
  const [edTags, setEdTags] = createSignal("");
  // Per-placeholder description/default, kept by name so retyping the command
  // doesn't lose what was already entered.
  const [edArgMeta, setEdArgMeta] = createSignal<
    Record<string, { description: string; default_value: string }>
  >({});
  // Two-step delete: first click arms this (per source), second click deletes.
  const [confirmDelete, setConfirmDelete] = createSignal<string | null>(null);
  let confirmTimer: ReturnType<typeof setTimeout> | undefined;

  let searchRef: HTMLInputElement | undefined;
  let firstArgRef: HTMLInputElement | undefined;
  let edNameRef: HTMLInputElement | undefined;

  const filtered = createMemo(() => {
    const q = query().trim().toLowerCase();
    const list = workflows();
    if (!q) return list;
    return list.filter((w) => {
      const hay = [
        w.name,
        w.description ?? "",
        w.command,
        w.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  });

  // Load (and reload) whenever the palette opens, so new YAML files show up.
  createEffect(() => {
    if (!props.open()) return;
    setQuery("");
    setIndex(0);
    setSelected(null);
    setEditing(null);
    setConfirmDelete(null);
    setError(null);
    listWorkflows()
      .then((ws) => setWorkflows(ws))
      .catch((e) => setError(String(e)));
    queueMicrotask(() => searchRef?.focus());
  });

  // Keep the highlighted index in range as the filter narrows.
  createEffect(() => {
    const n = filtered().length;
    if (index() >= n) setIndex(Math.max(0, n - 1));
  });

  const openWorkflow = (w: Workflow) => {
    const init: Record<string, string> = {};
    for (const a of effectiveArgs(w)) {
      init[a.name] = a.default_value ?? "";
    }
    setValues(init);
    setSelected(w);
    queueMicrotask(() => firstArgRef?.focus());
  };

  const backToList = () => {
    setSelected(null);
    queueMicrotask(() => searchRef?.focus());
  };

  // --- Editor (create / edit / delete) ---

  const openEditor = (w: Workflow | null) => {
    setEdName(w?.name ?? "");
    setEdDesc(w?.description ?? "");
    setEdCommand(w?.command ?? "");
    setEdTags(w?.tags.join(", ") ?? "");
    const meta: Record<string, { description: string; default_value: string }> =
      {};
    for (const a of w?.arguments ?? []) {
      meta[a.name] = {
        description: a.description ?? "",
        default_value: a.default_value ?? "",
      };
    }
    setEdArgMeta(meta);
    setError(null);
    setEditing({ source: w?.source ?? null });
    queueMicrotask(() => edNameRef?.focus());
  };

  const closeEditor = () => {
    setEditing(null);
    queueMicrotask(() => searchRef?.focus());
  };

  /** Placeholder names of the command being edited, in order of appearance. */
  const editorArgs = createMemo(() => placeholderNames(edCommand()));

  const canSave = createMemo(
    () => edName().trim() !== "" && edCommand().trim() !== ""
  );

  const saveEdit = async () => {
    if (!canSave()) return;
    const args = editorArgs().map((n) => {
      const meta = edArgMeta()[n];
      return {
        name: n,
        description: meta?.description.trim() || null,
        default_value: meta?.default_value ?? "",
      };
    });
    try {
      await saveWorkflow({
        name: edName().trim(),
        command: edCommand().trim(),
        description: edDesc().trim() || null,
        tags: edTags()
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        arguments: args,
        source: editing()?.source ?? null,
      });
      setEditing(null);
      setWorkflows(await listWorkflows());
      queueMicrotask(() => searchRef?.focus());
    } catch (e) {
      setError(String(e));
    }
  };

  const removeWorkflow = async (w: Workflow) => {
    if (confirmDelete() !== w.source) {
      setConfirmDelete(w.source);
      if (confirmTimer) clearTimeout(confirmTimer);
      confirmTimer = setTimeout(() => setConfirmDelete(null), 2500);
      return;
    }
    if (confirmTimer) clearTimeout(confirmTimer);
    setConfirmDelete(null);
    try {
      await deleteWorkflow(w.source);
      setWorkflows(await listWorkflows());
    } catch (e) {
      setError(String(e));
    }
  };

  const onEditKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeEditor();
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void saveEdit();
    }
  };

  const preview = createMemo(() => {
    const w = selected();
    if (!w) return "";
    return fillCommand(w.command, values());
  });

  const missing = createMemo(() => {
    const w = selected();
    if (!w) return [] as string[];
    // Placeholders still present in the preview are unfilled.
    return placeholderNames(preview());
  });

  const insert = () => {
    const cmd = preview();
    if (!cmd) return;
    props.onInsert(cmd);
    props.onClose();
  };

  const onListKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      props.onClose();
      return;
    }
    const n = filtered().length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (n) setIndex((i) => (i + 1) % n);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (n) setIndex((i) => (i - 1 + n) % n);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const w = filtered()[index()];
      if (w) openWorkflow(w);
    }
  };

  const onFillKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      backToList();
    } else if (e.key === "Enter") {
      e.preventDefault();
      insert();
    }
  };

  return (
    <Show when={props.open()}>
      <div class="palette-overlay" onClick={() => props.onClose()}>
        <div
          class="palette workflows-palette"
          onClick={(e) => e.stopPropagation()}
        >
          <Show
            when={editing()}
            fallback={
          <Show
            when={selected()}
            fallback={
              <>
                <div class="palette-header">
                  <span class="palette-prompt">⚡</span>
                  <input
                    ref={searchRef}
                    class="palette-input"
                    type="text"
                    placeholder={t("wf.searchPlaceholder")}
                    value={query()}
                    onInput={(e) => {
                      setQuery(e.currentTarget.value);
                      setIndex(0);
                    }}
                    onKeyDown={onListKeyDown}
                  />
                  <span class="palette-shortcut">Esc</span>
                </div>

                <Show when={error()}>
                  <div class="palette-warning">{error()}</div>
                </Show>

                <div class="wf-list">
                  <Show
                    when={filtered().length}
                    fallback={
                      <div class="wf-empty" innerHTML={t("wf.empty")} />
                    }
                  >
                    <For each={filtered()}>
                      {(w, i) => (
                        <div
                          class="wf-item"
                          classList={{ selected: i() === index() }}
                          onMouseEnter={() => setIndex(i())}
                          onClick={() => openWorkflow(w)}
                        >
                          <div class="wf-item-main">
                            <span class="wf-item-name">{w.name}</span>
                            <Show when={w.description}>
                              <span class="wf-item-desc">{w.description}</span>
                            </Show>
                          </div>
                          <code class="wf-item-cmd">{w.command}</code>
                          <Show when={w.tags.length}>
                            <div class="wf-item-tags">
                              <For each={w.tags}>
                                {(tag) => <span class="wf-tag">{tag}</span>}
                              </For>
                            </div>
                          </Show>
                          <div class="wf-item-actions">
                            <button
                              class="wf-item-action"
                              title={t("wf.edit")}
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditor(w);
                              }}
                            >
                              ✎
                            </button>
                            <button
                              class="wf-item-action danger"
                              classList={{
                                confirm: confirmDelete() === w.source,
                              }}
                              title={t("wf.delete")}
                              onClick={(e) => {
                                e.stopPropagation();
                                void removeWorkflow(w);
                              }}
                            >
                              {confirmDelete() === w.source
                                ? t("wf.confirmDelete")
                                : "✕"}
                            </button>
                          </div>
                        </div>
                      )}
                    </For>
                  </Show>
                </div>
                <div class="palette-footer">
                  <span class="palette-hint" innerHTML={t("wf.navHint")} />
                  <div class="palette-actions">
                    <button
                      class="palette-btn primary"
                      onClick={() => openEditor(null)}
                    >
                      + {t("wf.new")}
                    </button>
                  </div>
                </div>
              </>
            }
          >
            {(wf) => (
              <>
                {/* Fill stage */}
                <div class="palette-header">
                  <button class="wf-back" onClick={backToList} title={t("wf.back")}>
                    ‹
                  </button>
                  <span class="wf-fill-title">{wf().name}</span>
                  <span class="palette-shortcut">Esc</span>
                </div>

                <Show when={wf().description}>
                  <div class="wf-fill-desc">{wf().description}</div>
                </Show>

                <div class="wf-args">
                  <For each={effectiveArgs(wf())}>
                    {(arg, i) => (
                      <label class="wf-arg">
                        <span class="wf-arg-name">{arg.name}</span>
                        <Show when={arg.description}>
                          <span class="wf-arg-desc">{arg.description}</span>
                        </Show>
                        <input
                          ref={(el) => {
                            if (i() === 0) firstArgRef = el;
                          }}
                          class="wf-arg-input"
                          type="text"
                          value={values()[arg.name] ?? ""}
                          placeholder={arg.default_value ?? ""}
                          onInput={(e) =>
                            setValues((v) => ({
                              ...v,
                              [arg.name]: e.currentTarget.value,
                            }))
                          }
                          onKeyDown={onFillKeyDown}
                        />
                      </label>
                    )}
                  </For>
                </div>

                <div class="wf-preview">
                  <span class="wf-preview-label">{t("wf.preview")}</span>
                  <code>{preview()}</code>
                </div>

                <div class="palette-footer">
                  <span class="palette-hint">
                    <Show
                      when={missing().length === 0}
                      fallback={<>{t("wf.toComplete", { fields: missing().join(", ") })}</>}
                    >
                      <span innerHTML={t("wf.insertHint")} />
                    </Show>
                  </span>
                  <div class="palette-actions">
                    <button class="palette-btn ghost" onClick={backToList}>
                      {t("wf.back")}
                    </button>
                    <button class="palette-btn primary" onClick={insert}>
                      {t("wf.insert")}
                    </button>
                  </div>
                </div>
              </>
            )}
          </Show>
            }
          >
            {(ed) => (
              <>
                {/* Editor stage (create / edit) */}
                <div class="palette-header">
                  <button
                    class="wf-back"
                    onClick={closeEditor}
                    title={t("wf.back")}
                  >
                    ‹
                  </button>
                  <span class="wf-fill-title">
                    {ed().source ? t("wf.editTitle") : t("wf.newTitle")}
                  </span>
                  <span class="palette-shortcut">Esc</span>
                </div>

                <Show when={error()}>
                  <div class="palette-warning">{error()}</div>
                </Show>

                <div class="wf-args">
                  <label class="wf-arg">
                    <span class="wf-arg-name">{t("wf.fName")}</span>
                    <input
                      ref={edNameRef}
                      class="wf-arg-input"
                      type="text"
                      value={edName()}
                      placeholder={t("wf.fNamePh")}
                      onInput={(e) => setEdName(e.currentTarget.value)}
                      onKeyDown={onEditKeyDown}
                    />
                  </label>
                  <label class="wf-arg">
                    <span class="wf-arg-name">{t("wf.fDesc")}</span>
                    <input
                      class="wf-arg-input"
                      type="text"
                      value={edDesc()}
                      onInput={(e) => setEdDesc(e.currentTarget.value)}
                      onKeyDown={onEditKeyDown}
                    />
                  </label>
                  <label class="wf-arg">
                    <span class="wf-arg-name">{t("wf.fCommand")}</span>
                    <span
                      class="wf-arg-desc"
                      innerHTML={t("wf.fCommandHint")}
                    />
                    <textarea
                      class="wf-arg-input wf-edit-cmd"
                      rows={3}
                      value={edCommand()}
                      onInput={(e) => setEdCommand(e.currentTarget.value)}
                      onKeyDown={onEditKeyDown}
                    />
                  </label>
                  <label class="wf-arg">
                    <span class="wf-arg-name">{t("wf.fTags")}</span>
                    <input
                      class="wf-arg-input"
                      type="text"
                      value={edTags()}
                      placeholder={t("wf.fTagsPh")}
                      onInput={(e) => setEdTags(e.currentTarget.value)}
                      onKeyDown={onEditKeyDown}
                    />
                  </label>
                  <Show when={editorArgs().length}>
                    <div class="wf-edit-args">
                      <span class="wf-arg-name">{t("wf.fArgs")}</span>
                      <span class="wf-arg-desc">{t("wf.fArgsHint")}</span>
                      <For each={editorArgs()}>
                        {(argName) => (
                          <div class="wf-edit-arg-row">
                            <code class="wf-edit-arg-name">{argName}</code>
                            <input
                              class="wf-arg-input"
                              type="text"
                              placeholder={t("wf.argDescPh")}
                              value={edArgMeta()[argName]?.description ?? ""}
                              onInput={(e) =>
                                setEdArgMeta((m) => ({
                                  ...m,
                                  [argName]: {
                                    description: e.currentTarget.value,
                                    default_value:
                                      m[argName]?.default_value ?? "",
                                  },
                                }))
                              }
                              onKeyDown={onEditKeyDown}
                            />
                            <input
                              class="wf-arg-input"
                              type="text"
                              placeholder={t("wf.argDefaultPh")}
                              value={edArgMeta()[argName]?.default_value ?? ""}
                              onInput={(e) =>
                                setEdArgMeta((m) => ({
                                  ...m,
                                  [argName]: {
                                    description: m[argName]?.description ?? "",
                                    default_value: e.currentTarget.value,
                                  },
                                }))
                              }
                              onKeyDown={onEditKeyDown}
                            />
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>

                <div class="palette-footer">
                  <span class="palette-hint" innerHTML={t("wf.saveHint")} />
                  <div class="palette-actions">
                    <button class="palette-btn ghost" onClick={closeEditor}>
                      {t("wf.cancel")}
                    </button>
                    <button
                      class="palette-btn primary"
                      disabled={!canSave()}
                      onClick={() => void saveEdit()}
                    >
                      {t("wf.save")}
                    </button>
                  </div>
                </div>
              </>
            )}
          </Show>
        </div>
      </div>
    </Show>
  );
}
