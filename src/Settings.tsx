import { createEffect, createResource, createSignal, For, Show } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";
import {
  DEFAULT_CONFIG,
  DEFAULT_THEME,
  type Config,
  type CursorStyle,
  type Theme,
} from "./config";
import { customFamilies, importFontFile, listSystemFonts } from "./fonts";
import { THEME_PRESETS } from "./themes";
import {
  ACTIONS,
  comboToLabel,
  resolveBindings,
  type ActionId,
} from "./keybindings";

type Props = {
  open: () => boolean;
  onClose: () => void;
  config: Config;
  setConfig: SetStoreFunction<Config>;
  /** Called after every change so the parent can persist (debounced). */
  onChange: () => void;
  /** Action currently waiting for a key combo (or null). */
  recording: () => ActionId | null;
  onStartRecord: (id: ActionId) => void;
  onResetBindings: () => void;
};

type Section = "appearance" | "shell" | "keys";

const MAIN_COLORS: { key: keyof Theme; label: string }[] = [
  { key: "background", label: "Fond" },
  { key: "foreground", label: "Texte" },
  { key: "accent", label: "Accent" },
  { key: "cursor", label: "Curseur" },
  { key: "selection", label: "Sélection" },
];

const ANSI_COLORS: { key: keyof Theme; label: string }[] = [
  { key: "black", label: "black" },
  { key: "red", label: "red" },
  { key: "green", label: "green" },
  { key: "yellow", label: "yellow" },
  { key: "blue", label: "blue" },
  { key: "magenta", label: "magenta" },
  { key: "cyan", label: "cyan" },
  { key: "white", label: "white" },
  { key: "brightBlack", label: "br. black" },
  { key: "brightRed", label: "br. red" },
  { key: "brightGreen", label: "br. green" },
  { key: "brightYellow", label: "br. yellow" },
  { key: "brightBlue", label: "br. blue" },
  { key: "brightMagenta", label: "br. magenta" },
  { key: "brightCyan", label: "br. cyan" },
  { key: "brightWhite", label: "br. white" },
];

// Non-remappable shortcuts (layout-special), shown for reference only.
const FIXED_SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "Ctrl + 1…9", label: "Aller à l'onglet N" },
  { keys: "Ctrl + / -", label: "Zoom du texte (taille +/-)" },
  { keys: "Ctrl + 0", label: "Taille du texte par défaut" },
  { keys: "Alt + ←↑↓→", label: "Naviguer entre panes (boucle)" },
  { keys: "Ctrl + ↑/↓", label: "Naviguer dans les blocs" },
];

export default function Settings(props: Props) {
  const [section, setSection] = createSignal<Section>("appearance");
  const [ansiOpen, setAnsiOpen] = createSignal(false);

  const a = () => props.config.appearance;
  const bindings = () => resolveBindings(props.config.keybindings);

  const setAppearance = <K extends keyof Config["appearance"]>(
    key: K,
    value: Config["appearance"][K]
  ) => {
    props.setConfig("appearance", key, value);
    props.onChange();
  };
  const setTheme = (key: keyof Theme, value: string) => {
    props.setConfig("appearance", "theme", key, value);
    props.onChange();
  };
  const applyPreset = (theme: Theme) => {
    // Clone so later per-color edits don't mutate the shared preset object.
    props.setConfig("appearance", "theme", { ...theme });
    props.onChange();
  };
  const resetAppearance = () => {
    props.setConfig("appearance", {
      ...DEFAULT_CONFIG.appearance,
      theme: { ...DEFAULT_THEME },
    });
    props.onChange();
  };

  // Font picking: list system monospace fonts when the panel is open.
  const [systemFonts] = createResource(
    () => props.open(),
    (open) => (open ? listSystemFonts() : Promise.resolve<string[]>([]))
  );
  const primaryFamily = () =>
    a().fontFamily.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
  const knownFamilies = () => [...customFamilies(), ...(systemFonts() ?? [])];

  // The <select> loses its selection when async options (system fonts) arrive
  // and the "(actuelle)" fallback option is removed — Solid won't re-apply the
  // value since it didn't change. Re-apply it whenever the options or value
  // change so the current font stays selected after a restart.
  let fontSelectRef: HTMLSelectElement | undefined;
  createEffect(() => {
    const value = primaryFamily();
    systemFonts();
    customFamilies();
    if (fontSelectRef) fontSelectRef.value = value;
  });
  const pickFont = (family: string) => {
    setAppearance("fontFamily", `"${family}", monospace`);
  };
  const onImportFont = async (e: { currentTarget: HTMLInputElement }) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (!file) return;
    try {
      pickFont(await importFontFile(file));
    } catch (err) {
      console.error("import font", err);
    }
  };

  return (
    <Show when={props.open()}>
      <div class="settings-overlay" onClick={() => props.onClose()}>
        <div class="settings-panel" onClick={(e) => e.stopPropagation()}>
          <div class="settings-sidebar">
            <div class="settings-title">Réglages</div>
            <button
              class="settings-nav"
              classList={{ active: section() === "appearance" }}
              onClick={() => setSection("appearance")}
            >
              🎨 Apparence
            </button>
            <button
              class="settings-nav"
              classList={{ active: section() === "shell" }}
              onClick={() => setSection("shell")}
            >
              ❯ Shell
            </button>
            <button
              class="settings-nav"
              classList={{ active: section() === "keys" }}
              onClick={() => setSection("keys")}
            >
              ⌨ Raccourcis
            </button>
            <div class="settings-sidebar-spacer" />
            <button class="settings-close" onClick={() => props.onClose()}>
              Fermer (Esc)
            </button>
          </div>

          <div class="settings-content">
            <Show when={section() === "appearance"}>
              <div class="settings-section">
                <div class="settings-row">
                  <span class="settings-label">Police</span>
                  <div class="settings-font-controls">
                    <select
                      ref={fontSelectRef}
                      class="settings-input"
                      value={primaryFamily()}
                      onChange={(e) => pickFont(e.currentTarget.value)}
                    >
                      <Show when={!knownFamilies().includes(primaryFamily())}>
                        <option value={primaryFamily()}>
                          {primaryFamily()} (actuelle)
                        </option>
                      </Show>
                      <Show when={customFamilies().length}>
                        <optgroup label="Importées">
                          <For each={customFamilies()}>
                            {(f) => (
                              <option value={f} style={{ "font-family": `"${f}"` }}>
                                {f}
                              </option>
                            )}
                          </For>
                        </optgroup>
                      </Show>
                      <optgroup label="Système (monospace)">
                        <For each={systemFonts() ?? []}>
                          {(f) => (
                            <option value={f} style={{ "font-family": `"${f}"` }}>
                              {f}
                            </option>
                          )}
                        </For>
                      </optgroup>
                    </select>
                    <label class="settings-import-btn" title="Importer un .ttf/.otf/.woff">
                      ⬇ Importer
                      <input
                        type="file"
                        accept=".ttf,.otf,.woff,.woff2"
                        style={{ display: "none" }}
                        onChange={onImportFont}
                      />
                    </label>
                  </div>
                </div>

                <div
                  class="settings-font-preview"
                  style={{
                    "font-family": a().fontFamily,
                    "font-size": `${a().fontSize}px`,
                  }}
                >
                  The quick brown fox · 0O1lI · {"=> != >= () [] {} && |"}
                </div>
                <p class="settings-note">
                  Pour les icônes du prompt (Powerlevel10k, starship…), choisis
                  une <strong>Nerd Font</strong> — ex&nbsp;: <code>MesloLGS NF</code>.
                </p>

                <label class="settings-row">
                  <span class="settings-label">Taille</span>
                  <input
                    class="settings-input narrow"
                    type="number"
                    min="8"
                    max="40"
                    value={a().fontSize}
                    onInput={(e) =>
                      setAppearance(
                        "fontSize",
                        Math.max(
                          8,
                          Math.min(40, Number(e.currentTarget.value) || 14)
                        )
                      )
                    }
                  />
                </label>

                <label class="settings-row">
                  <span class="settings-label">Curseur clignotant</span>
                  <input
                    type="checkbox"
                    checked={a().cursorBlink}
                    onChange={(e) =>
                      setAppearance("cursorBlink", e.currentTarget.checked)
                    }
                  />
                </label>

                <label class="settings-row">
                  <span class="settings-label">Style du curseur</span>
                  <select
                    class="settings-input narrow"
                    value={a().cursorStyle}
                    onChange={(e) =>
                      setAppearance(
                        "cursorStyle",
                        e.currentTarget.value as CursorStyle
                      )
                    }
                  >
                    <option value="block">Bloc</option>
                    <option value="bar">Barre</option>
                    <option value="underline">Souligné</option>
                  </select>
                </label>

                <label class="settings-row">
                  <span class="settings-label">Scrollback (lignes)</span>
                  <input
                    class="settings-input narrow"
                    type="number"
                    min="100"
                    max="100000"
                    step="500"
                    value={a().scrollback}
                    onInput={(e) =>
                      setAppearance(
                        "scrollback",
                        Math.max(100, Number(e.currentTarget.value) || 5000)
                      )
                    }
                  />
                </label>

                <div class="settings-subtitle">Thème</div>
                <div class="settings-presets">
                  <For each={THEME_PRESETS}>
                    {(p) => (
                      <button
                        class="settings-preset"
                        onClick={() => applyPreset(p.theme)}
                      >
                        <span
                          class="settings-preset-swatch"
                          style={{
                            background: p.theme.background,
                            "border-color": p.theme.accent,
                          }}
                        >
                          <span style={{ color: p.theme.foreground }}>Aa</span>
                        </span>
                        {p.name}
                      </button>
                    )}
                  </For>
                </div>

                <div class="settings-colors">
                  <For each={MAIN_COLORS}>
                    {(c) => (
                      <label class="settings-color">
                        <input
                          type="color"
                          value={a().theme[c.key]}
                          onInput={(e) =>
                            setTheme(c.key, e.currentTarget.value)
                          }
                        />
                        <span>{c.label}</span>
                      </label>
                    )}
                  </For>
                </div>

                <button
                  class="settings-collapse"
                  onClick={() => setAnsiOpen(!ansiOpen())}
                >
                  {ansiOpen() ? "▾" : "▸"} Couleurs ANSI (16)
                </button>
                <Show when={ansiOpen()}>
                  <div class="settings-colors ansi">
                    <For each={ANSI_COLORS}>
                      {(c) => (
                        <label class="settings-color">
                          <input
                            type="color"
                            value={a().theme[c.key]}
                            onInput={(e) =>
                              setTheme(c.key, e.currentTarget.value)
                            }
                          />
                          <span>{c.label}</span>
                        </label>
                      )}
                    </For>
                  </div>
                </Show>

                <button class="settings-reset" onClick={resetAppearance}>
                  Réinitialiser l'apparence
                </button>
              </div>
            </Show>

            <Show when={section() === "shell"}>
              <div class="settings-section">
                <label class="settings-row">
                  <span class="settings-label">Programme</span>
                  <input
                    class="settings-input"
                    type="text"
                    placeholder="$SHELL (défaut)"
                    value={props.config.shell.program ?? ""}
                    onInput={(e) => {
                      const v = e.currentTarget.value.trim();
                      props.setConfig("shell", "program", v || null);
                      props.onChange();
                    }}
                  />
                </label>
                <label class="settings-row">
                  <span class="settings-label">Arguments</span>
                  <input
                    class="settings-input"
                    type="text"
                    placeholder="ex : -l"
                    value={props.config.shell.args.join(" ")}
                    onInput={(e) => {
                      const args = e.currentTarget.value
                        .split(/\s+/)
                        .filter(Boolean);
                      props.setConfig("shell", "args", args);
                      props.onChange();
                    }}
                  />
                </label>
                <p class="settings-note">
                  S'applique aux <strong>nouveaux</strong> terminaux.
                </p>
              </div>
            </Show>

            <Show when={section() === "keys"}>
              <div class="settings-section">
                <p class="settings-note">
                  Clique sur un raccourci puis appuie sur la combinaison voulue
                  (<kbd>Échap</kbd> pour annuler).
                </p>
                <div class="settings-keys">
                  <For each={ACTIONS}>
                    {(action) => (
                      <div class="settings-key-row">
                        <span class="settings-key-label">{action.label}</span>
                        <button
                          class="settings-key-bind"
                          classList={{
                            recording: props.recording() === action.id,
                          }}
                          onClick={() => props.onStartRecord(action.id)}
                        >
                          {props.recording() === action.id
                            ? "Appuie sur une touche…"
                            : comboToLabel(bindings()[action.id])}
                        </button>
                      </div>
                    )}
                  </For>
                </div>

                <button class="settings-reset" onClick={props.onResetBindings}>
                  Réinitialiser les raccourcis
                </button>

                <div class="settings-subtitle">Raccourcis fixes</div>
                <div class="settings-keys">
                  <For each={FIXED_SHORTCUTS}>
                    {(k) => (
                      <div class="settings-key-row">
                        <span class="settings-key-label">{k.label}</span>
                        <kbd class="settings-key-combo">{k.keys}</kbd>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
