import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { hostTarget, listSshHosts, type SshHost } from "./ssh";
import { t } from "./i18n";

type Props = {
  open: () => boolean;
  onClose: () => void;
  /** Connect to a host alias (or raw `user@host`). */
  onConnect: (target: string) => void;
};

type Row =
  | { kind: "host"; host: SshHost }
  | { kind: "adhoc"; target: string };

export default function SshPalette(props: Props) {
  const [hosts, setHosts] = createSignal<SshHost[]>([]);
  const [query, setQuery] = createSignal("");
  const [index, setIndex] = createSignal(0);
  const [loaded, setLoaded] = createSignal(false);

  let searchRef: HTMLInputElement | undefined;

  const filtered = createMemo(() => {
    const q = query().trim().toLowerCase();
    const list = hosts();
    if (!q) return list;
    return list.filter((h) =>
      [h.name, h.hostName ?? "", h.user ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  });

  // Rows = matching hosts, plus an ad-hoc connect option when the query looks
  // like a bare target that isn't already a known host.
  const rows = createMemo<Row[]>(() => {
    const hostRows: Row[] = filtered().map((h) => ({ kind: "host", host: h }));
    const q = query().trim();
    const isTarget = q.length > 0 && !/\s/.test(q);
    const known = hosts().some((h) => h.name === q);
    if (isTarget && !known) {
      hostRows.push({ kind: "adhoc", target: q });
    }
    return hostRows;
  });

  createEffect(() => {
    if (!props.open()) return;
    setQuery("");
    setIndex(0);
    listSshHosts()
      .then((hs) => setHosts(hs))
      .catch(() => setHosts([]))
      .finally(() => setLoaded(true));
    queueMicrotask(() => searchRef?.focus());
  });

  createEffect(() => {
    const n = rows().length;
    if (index() >= n) setIndex(Math.max(0, n - 1));
  });

  const connect = (row: Row) => {
    const target = row.kind === "host" ? row.host.name : row.target;
    props.onConnect(target);
    props.onClose();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      props.onClose();
      return;
    }
    const n = rows().length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (n) setIndex((i) => (i + 1) % n);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (n) setIndex((i) => (i - 1 + n) % n);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows()[index()];
      if (row) connect(row);
    }
  };

  return (
    <Show when={props.open()}>
      <div class="palette-overlay" onClick={() => props.onClose()}>
        <div
          class="palette ssh-palette"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="palette-header">
            <span class="palette-prompt">⇆</span>
            <input
              ref={searchRef}
              class="palette-input"
              type="text"
              placeholder={t("ssh.placeholder")}
              value={query()}
              onInput={(e) => {
                setQuery(e.currentTarget.value);
                setIndex(0);
              }}
              onKeyDown={onKeyDown}
            />
            <span class="palette-shortcut">Esc</span>
          </div>

          <div class="ssh-list">
            <Show
              when={rows().length}
              fallback={
                <div class="ssh-empty">
                  <Show
                    when={loaded() && hosts().length === 0}
                    fallback={<>{t("ssh.noMatch")}</>}
                  >
                    <span innerHTML={t("ssh.noHosts")} />
                  </Show>
                </div>
              }
            >
              <For each={rows()}>
                {(row, i) => (
                  <div
                    class="ssh-item"
                    classList={{ selected: i() === index() }}
                    onMouseEnter={() => setIndex(i())}
                    onClick={() => connect(row)}
                  >
                    <Show
                      when={row.kind === "host"}
                      fallback={
                        <div class="ssh-item-main">
                          <span class="ssh-item-name">
                            {t("ssh.connectTo")}{" "}
                            <code>{(row as { target: string }).target}</code>
                          </span>
                          <span class="ssh-item-sub">{t("ssh.directConnection")}</span>
                        </div>
                      }
                    >
                      <div class="ssh-item-main">
                        <span class="ssh-item-name">
                          {(row as { host: SshHost }).host.name}
                        </span>
                        <span class="ssh-item-sub">
                          {hostTarget((row as { host: SshHost }).host)}
                        </span>
                      </div>
                    </Show>
                    <span class="ssh-item-go">↵</span>
                  </div>
                )}
              </For>
            </Show>
          </div>

          <div class="palette-footer">
            <span class="palette-hint" innerHTML={t("ssh.navHint")} />
          </div>
        </div>
      </div>
    </Show>
  );
}
