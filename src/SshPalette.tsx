import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import {
  hostTarget,
  listSshHosts,
  pushSshRecent,
  setSshPrefs,
  sshFavorites,
  sshPrefs,
  sshRecents,
  sshTools,
  toggleSshFavorite,
  type SshHost,
  type SshPrefs,
} from "./ssh";
import { IconEnter, IconSsh } from "./icons";
import { t } from "./i18n";

type Props = {
  open: () => boolean;
  onClose: () => void;
  /** Connect to a host alias (or raw `user@host`) with its session options. */
  onConnect: (target: string, prefs: SshPrefs) => void;
  /** Settings: tmux on for hosts the user never toggled. */
  tmuxDefault?: () => boolean;
};

type Row =
  | { kind: "host"; host: SshHost }
  | { kind: "adhoc"; target: string };

export default function SshPalette(props: Props) {
  const [hosts, setHosts] = createSignal<SshHost[]>([]);
  const [query, setQuery] = createSignal("");
  const [index, setIndex] = createSignal(0);
  const [loaded, setLoaded] = createSignal(false);
  const [favorites, setFavorites] = createSignal<string[]>([]);
  const [recents, setRecents] = createSignal<string[]>([]);
  const [prefs, setPrefs] = createSignal<Record<string, SshPrefs>>({});
  const [hasMosh, setHasMosh] = createSignal(false);

  let searchRef: HTMLInputElement | undefined;

  /** Favorites first, then recently used, then the config order. */
  const ordered = createMemo(() => {
    const fav = favorites();
    const rec = recents();
    const rank = (h: SshHost) => {
      const f = fav.indexOf(h.name);
      if (f !== -1) return f;
      const r = rec.indexOf(h.name);
      if (r !== -1) return 1000 + r;
      return 2000;
    };
    return hosts()
      .map((h, i) => ({ h, i }))
      .sort((a, b) => rank(a.h) - rank(b.h) || a.i - b.i)
      .map((x) => x.h);
  });

  const filtered = createMemo(() => {
    const q = query().trim().toLowerCase();
    const list = ordered();
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
    setFavorites(sshFavorites());
    setRecents(sshRecents());
    setPrefs(sshPrefs());
    listSshHosts()
      .then((hs) => setHosts(hs))
      .catch(() => setHosts([]))
      .finally(() => setLoaded(true));
    sshTools()
      .then((tl) => setHasMosh(tl.mosh))
      .catch(() => setHasMosh(false));
    queueMicrotask(() => searchRef?.focus());
  });

  createEffect(() => {
    const n = rows().length;
    if (index() >= n) setIndex(Math.max(0, n - 1));
  });

  const rowName = (row: Row) => (row.kind === "host" ? row.host.name : row.target);

  const connect = (row: Row) => {
    const target = rowName(row);
    pushSshRecent(target);
    props.onConnect(target, effective(target));
    props.onClose();
  };

  /** A host's options, with the settings' tmux default when unset. */
  const effective = (name: string): SshPrefs => {
    const p = prefs()[name] ?? {};
    return { ...p, tmux: p.tmux ?? !!props.tmuxDefault?.() };
  };
  const togglePref = (name: string, key: keyof SshPrefs) => {
    const cur = prefs()[name] ?? {};
    setPrefs({ ...setSshPrefs(name, { ...cur, [key]: !effective(name)[key] }) });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      props.onClose();
      return;
    }
    const n = rows().length;
    const row = rows()[index()];
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (n) setIndex((i) => (i + 1) % n);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (n) setIndex((i) => (i - 1 + n) % n);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (row) connect(row);
    } else if (row && e.altKey && !e.ctrlKey) {
      // Alt+F favorite, Alt+T tmux, Alt+M mosh — on the selected host.
      // e.code, not e.key: on macOS Option+F types "ƒ" (Option+T "†"…).
      const k = e.code === "KeyF" ? "f" : e.code === "KeyT" ? "t" : e.code === "KeyM" ? "m" : "";
      const name = rowName(row);
      if (k === "f" && row.kind === "host") {
        e.preventDefault();
        setFavorites(toggleSshFavorite(name));
      } else if (k === "t") {
        e.preventDefault();
        togglePref(name, "tmux");
      } else if (k === "m" && hasMosh()) {
        e.preventDefault();
        togglePref(name, "mosh");
      }
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
            <span class="palette-prompt">
              <IconSsh size={14} />
            </span>
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
                {(row, i) => {
                  const name = () => rowName(row);
                  const p = () => effective(name());
                  return (
                    <div
                      class="ssh-item"
                      classList={{ selected: i() === index() }}
                      onMouseEnter={() => setIndex(i())}
                      onClick={() => connect(row)}
                    >
                      <Show when={row.kind === "host"}>
                        <button
                          class="ssh-star"
                          classList={{ on: favorites().includes(name()) }}
                          title={t("ssh.favorite")}
                          onClick={(e) => {
                            e.stopPropagation();
                            setFavorites(toggleSshFavorite(name()));
                          }}
                        >
                          {favorites().includes(name()) ? "★" : "☆"}
                        </button>
                      </Show>
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
                            <Show when={(row as { host: SshHost }).host.proxyJump}>
                              {" "}
                              {t("ssh.via", { host: (row as { host: SshHost }).host.proxyJump! })}
                            </Show>
                          </span>
                        </div>
                      </Show>
                      <div class="ssh-opts">
                        <button
                          class="ssh-opt"
                          classList={{ on: !!p().tmux }}
                          title={t("ssh.tmuxTitle")}
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePref(name(), "tmux");
                          }}
                        >
                          tmux
                        </button>
                        <Show when={hasMosh()}>
                          <button
                            class="ssh-opt"
                            classList={{ on: !!p().mosh }}
                            title={t("ssh.moshTitle")}
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePref(name(), "mosh");
                            }}
                          >
                            mosh
                          </button>
                        </Show>
                      </div>
                      <span class="ssh-item-go">
                        <IconEnter size={13} />
                      </span>
                    </div>
                  );
                }}
              </For>
            </Show>
          </div>

          <div class="palette-footer">
            <span class="palette-hint" innerHTML={t("ssh.navHint2")} />
          </div>
        </div>
      </div>
    </Show>
  );
}
