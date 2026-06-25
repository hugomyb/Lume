import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Show,
} from "solid-js";
import {
  effectiveArgs,
  fillCommand,
  listWorkflows,
  placeholderNames,
  type Workflow,
} from "./workflows";

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

  let searchRef: HTMLInputElement | undefined;
  let firstArgRef: HTMLInputElement | undefined;

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
            when={selected()}
            fallback={
              <>
                <div class="palette-header">
                  <span class="palette-prompt">⚡</span>
                  <input
                    ref={searchRef}
                    class="palette-input"
                    type="text"
                    placeholder="Chercher un workflow…"
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
                      <div class="wf-empty">
                        Aucun workflow.{" "}
                        <code>~/.config/lume/workflows/*.yaml</code>
                      </div>
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
                                {(t) => <span class="wf-tag">{t}</span>}
                              </For>
                            </div>
                          </Show>
                        </div>
                      )}
                    </For>
                  </Show>
                </div>
                <div class="palette-footer">
                  <span class="palette-hint">
                    <kbd>↑</kbd>
                    <kbd>↓</kbd> naviguer · <kbd>Enter</kbd> choisir
                  </span>
                </div>
              </>
            }
          >
            {/* Fill stage */}
            <div class="palette-header">
              <button class="wf-back" onClick={backToList} title="Retour">
                ‹
              </button>
              <span class="wf-fill-title">{selected()!.name}</span>
              <span class="palette-shortcut">Esc</span>
            </div>

            <Show when={selected()!.description}>
              <div class="wf-fill-desc">{selected()!.description}</div>
            </Show>

            <div class="wf-args">
              <For each={effectiveArgs(selected()!)}>
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
              <span class="wf-preview-label">Aperçu</span>
              <code>{preview()}</code>
            </div>

            <div class="palette-footer">
              <span class="palette-hint">
                <Show
                  when={missing().length === 0}
                  fallback={<>À compléter : {missing().join(", ")}</>}
                >
                  <kbd>Enter</kbd> pour insérer dans le terminal
                </Show>
              </span>
              <div class="palette-actions">
                <button class="palette-btn ghost" onClick={backToList}>
                  Retour
                </button>
                <button class="palette-btn primary" onClick={insert}>
                  Insérer
                </button>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}
