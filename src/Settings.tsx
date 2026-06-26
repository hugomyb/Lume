import { createEffect, createResource, createSignal, For, Show } from "solid-js";
import { reconcile, type SetStoreFunction } from "solid-js/store";
import { save, open } from "@tauri-apps/plugin-dialog";
import { LANGUAGES, t } from "./i18n";
import {
  DEFAULT_CONFIG,
  DEFAULT_THEME,
  exportConfig,
  importConfig,
  type Config,
  type CursorStyle,
  type Theme,
} from "./config";
import { customFamilies, importFontFile, listSystemFonts } from "./fonts";
import { THEME_PRESETS } from "./themes";
import { getVersion } from "@tauri-apps/api/app";
import { checkForUpdate, installUpdate, type Update } from "./updater";
import {
  IconAppearance,
  IconBell,
  IconInfo,
  IconKeyboard,
  IconSettings,
  IconSsh,
} from "./icons";
import {
  ACTIONS,
  comboToLabel,
  resolveBindings,
  type ActionId,
} from "./keybindings";

/** A small on/off pill switch, used in place of native checkboxes. */
function Toggle(props: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      class="settings-toggle"
      classList={{ on: props.checked }}
      disabled={props.disabled}
      onClick={() => props.onChange(!props.checked)}
    >
      <span class="settings-toggle-knob" />
    </button>
  );
}

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

type Section =
  | "appearance"
  | "shell"
  | "notifications"
  | "keys"
  | "general"
  | "about";

// Labels resolved via t(`color.${key}`); ANSI names below stay literal.
const MAIN_COLORS: { key: keyof Theme }[] = [
  { key: "background" },
  { key: "foreground" },
  { key: "accent" },
  { key: "cursor" },
  { key: "selection" },
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
const FIXED_SHORTCUTS: { keys: string; labelKey: string }[] = [
  { keys: "Ctrl + 1…9", labelKey: "keys.fixed.goToTab" },
  { keys: "Ctrl + / -", labelKey: "keys.fixed.zoom" },
  { keys: "Ctrl + 0", labelKey: "keys.fixed.zoomReset" },
  { keys: "Alt + ←↑↓→", labelKey: "keys.fixed.navPanes" },
  { keys: "Ctrl + ↑/↓", labelKey: "keys.fixed.navBlocks" },
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
  const setNotif = <K extends keyof Config["notifications"]>(
    key: K,
    value: Config["notifications"][K]
  ) => {
    props.setConfig("notifications", key, value);
    props.onChange();
  };

  // --- About / updates ---
  const [appVersion, setAppVersion] = createSignal("");
  getVersion().then(setAppVersion).catch(() => {});
  const [updateState, setUpdateState] = createSignal<
    "idle" | "checking" | "uptodate" | "available" | "installing" | "error"
  >("idle");
  const [foundUpdate, setFoundUpdate] = createSignal<Update | null>(null);
  const [updateProgress, setUpdateProgress] = createSignal(0);
  const checkUpdate = async () => {
    if (updateState() === "checking" || updateState() === "installing") return;
    setUpdateState("checking");
    try {
      const u = await checkForUpdate();
      if (u) {
        setFoundUpdate(u);
        setUpdateState("available");
      } else {
        setUpdateState("uptodate");
      }
    } catch {
      setUpdateState("error");
    }
  };
  const applyUpdate = async () => {
    const u = foundUpdate();
    if (!u) return;
    setUpdateState("installing");
    try {
      await installUpdate(u, setUpdateProgress); // relaunches on success
    } catch {
      setUpdateState("error");
    }
  };

  // --- Export / import settings ---
  const [backupMsg, setBackupMsg] = createSignal("");
  const doExport = async () => {
    try {
      const path = await save({
        defaultPath: "lume-settings.json",
        filters: [{ name: "Lume settings", extensions: ["json"] }],
      });
      if (!path) return;
      await exportConfig(props.config, path);
      setBackupMsg(t("general.exported"));
    } catch (e) {
      console.error("export", e);
      setBackupMsg(t("general.exportFailed"));
    }
  };
  const doImport = async () => {
    try {
      const picked = await open({
        multiple: false,
        filters: [{ name: "Lume settings", extensions: ["json", "toml"] }],
      });
      const path = Array.isArray(picked) ? picked[0] : picked;
      if (!path) return;
      const imported = await importConfig(path);
      props.setConfig(reconcile(imported));
      props.onChange();
      setBackupMsg(t("general.imported"));
    } catch (e) {
      console.error("import", e);
      setBackupMsg(t("general.importFailed"));
    }
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
            <div class="settings-title">{t("settings.title")}</div>
            <button
              class="settings-nav"
              classList={{ active: section() === "appearance" }}
              onClick={() => setSection("appearance")}
            >
              <IconAppearance size={15} />
              <span>{t("nav.appearance")}</span>
            </button>
            <button
              class="settings-nav"
              classList={{ active: section() === "shell" }}
              onClick={() => setSection("shell")}
            >
              <IconSsh size={15} />
              <span>{t("nav.shell")}</span>
            </button>
            <button
              class="settings-nav"
              classList={{ active: section() === "notifications" }}
              onClick={() => setSection("notifications")}
            >
              <IconBell size={15} />
              <span>{t("nav.notifications")}</span>
            </button>
            <button
              class="settings-nav"
              classList={{ active: section() === "keys" }}
              onClick={() => setSection("keys")}
            >
              <IconKeyboard size={15} />
              <span>{t("nav.keys")}</span>
            </button>
            <button
              class="settings-nav"
              classList={{ active: section() === "general" }}
              onClick={() => setSection("general")}
            >
              <IconSettings size={15} />
              <span>{t("nav.general")}</span>
            </button>
            <button
              class="settings-nav"
              classList={{ active: section() === "about" }}
              onClick={() => setSection("about")}
            >
              <IconInfo size={15} />
              <span>{t("nav.about")}</span>
            </button>
            <div class="settings-sidebar-spacer" />
            <button class="settings-close" onClick={() => props.onClose()}>
              {t("settings.close")}
            </button>
          </div>

          <div class="settings-content">
            <Show when={section() === "appearance"}>
              <div class="settings-section">
                <div class="settings-row">
                  <span class="settings-label">{t("appearance.font")}</span>
                  <div class="settings-font-controls">
                    <select
                      ref={fontSelectRef}
                      class="settings-input"
                      value={primaryFamily()}
                      onChange={(e) => pickFont(e.currentTarget.value)}
                    >
                      <Show when={!knownFamilies().includes(primaryFamily())}>
                        <option value={primaryFamily()}>
                          {primaryFamily()} {t("appearance.fontCurrent")}
                        </option>
                      </Show>
                      <Show when={customFamilies().length}>
                        <optgroup label={t("appearance.fontImported")}>
                          <For each={customFamilies()}>
                            {(f) => (
                              <option value={f} style={{ "font-family": `"${f}"` }}>
                                {f}
                              </option>
                            )}
                          </For>
                        </optgroup>
                      </Show>
                      <optgroup label={t("appearance.fontSystem")}>
                        <For each={systemFonts() ?? []}>
                          {(f) => (
                            <option value={f} style={{ "font-family": `"${f}"` }}>
                              {f}
                            </option>
                          )}
                        </For>
                      </optgroup>
                    </select>
                    <label class="settings-import-btn" title={t("appearance.importTitle")}>
                      ⬇ {t("appearance.import")}
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
                <p class="settings-note" innerHTML={t("appearance.fontHint")} />

                <label class="settings-row">
                  <span class="settings-label">{t("appearance.size")}</span>
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

                <div class="settings-row">
                  <span class="settings-label">{t("appearance.cursorBlink")}</span>
                  <Toggle
                    checked={a().cursorBlink}
                    onChange={(v) => setAppearance("cursorBlink", v)}
                  />
                </div>

                <label class="settings-row">
                  <span class="settings-label">{t("appearance.cursorStyle")}</span>
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
                    <option value="block">{t("cursor.block")}</option>
                    <option value="bar">{t("cursor.bar")}</option>
                    <option value="underline">{t("cursor.underline")}</option>
                  </select>
                </label>

                <label class="settings-row">
                  <span class="settings-label">{t("appearance.scrollback")}</span>
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

                <div class="settings-subtitle">{t("appearance.theme")}</div>
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
                        <span>{t(`color.${c.key}`)}</span>
                      </label>
                    )}
                  </For>
                </div>

                <button
                  class="settings-collapse"
                  onClick={() => setAnsiOpen(!ansiOpen())}
                >
                  {ansiOpen() ? "▾" : "▸"} {t("appearance.ansi")}
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
                  {t("appearance.reset")}
                </button>
              </div>
            </Show>

            <Show when={section() === "shell"}>
              <div class="settings-section">
                <label class="settings-row">
                  <span class="settings-label">{t("shell.program")}</span>
                  <input
                    class="settings-input"
                    type="text"
                    placeholder={t("shell.programPlaceholder")}
                    value={props.config.shell.program ?? ""}
                    onInput={(e) => {
                      const v = e.currentTarget.value.trim();
                      props.setConfig("shell", "program", v || null);
                      props.onChange();
                    }}
                  />
                </label>
                <label class="settings-row">
                  <span class="settings-label">{t("shell.args")}</span>
                  <input
                    class="settings-input"
                    type="text"
                    placeholder={t("shell.argsPlaceholder")}
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
                <p class="settings-note" innerHTML={t("shell.note")} />
              </div>
            </Show>

            <Show when={section() === "notifications"}>
              <div class="settings-section">
                <div class="settings-row">
                  <span class="settings-label">{t("notif.enable")}</span>
                  <Toggle
                    checked={props.config.notifications.enabled}
                    onChange={(v) => setNotif("enabled", v)}
                  />
                </div>
                <label class="settings-row">
                  <span class="settings-label">{t("notif.minDuration")}</span>
                  <input
                    class="settings-input narrow"
                    type="number"
                    min="1"
                    max="3600"
                    disabled={!props.config.notifications.enabled}
                    value={props.config.notifications.minDurationSec}
                    onInput={(e) =>
                      setNotif(
                        "minDurationSec",
                        Math.max(1, Number(e.currentTarget.value) || 10)
                      )
                    }
                  />
                </label>
                <div class="settings-row">
                  <span class="settings-label">{t("notif.sound")}</span>
                  <Toggle
                    checked={props.config.notifications.sound}
                    disabled={!props.config.notifications.enabled}
                    onChange={(v) => setNotif("sound", v)}
                  />
                </div>
                <p class="settings-note" innerHTML={t("notif.note")} />
              </div>
            </Show>


            <Show when={section() === "keys"}>
              <div class="settings-section">
                <p class="settings-note" innerHTML={t("keys.hint")} />
                <div class="settings-keys">
                  <For each={ACTIONS}>
                    {(action) => (
                      <div class="settings-key-row">
                        <span class="settings-key-label">{t(action.label)}</span>
                        <button
                          class="settings-key-bind"
                          classList={{
                            recording: props.recording() === action.id,
                          }}
                          onClick={() => props.onStartRecord(action.id)}
                        >
                          {props.recording() === action.id
                            ? t("keys.recording")
                            : comboToLabel(bindings()[action.id])}
                        </button>
                      </div>
                    )}
                  </For>
                </div>

                <button class="settings-reset" onClick={props.onResetBindings}>
                  {t("keys.reset")}
                </button>

                <div class="settings-subtitle">{t("keys.fixed")}</div>
                <div class="settings-keys">
                  <For each={FIXED_SHORTCUTS}>
                    {(k) => (
                      <div class="settings-key-row">
                        <span class="settings-key-label">{t(k.labelKey)}</span>
                        <kbd class="settings-key-combo">{k.keys}</kbd>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            <Show when={section() === "general"}>
              <div class="settings-section">
                <label class="settings-row">
                  <span class="settings-label">{t("general.language")}</span>
                  <select
                    class="settings-input narrow"
                    value={props.config.language || "en"}
                    onChange={(e) => {
                      props.setConfig("language", e.currentTarget.value);
                      props.onChange();
                    }}
                  >
                    <For each={LANGUAGES}>
                      {(lang) => (
                        <option value={lang.code}>{lang.label}</option>
                      )}
                    </For>
                  </select>
                </label>

                <div class="settings-subtitle">{t("general.backup")}</div>
                <div class="settings-row">
                  <span class="settings-label">{t("general.exportImport")}</span>
                  <div class="settings-backup-btns">
                    <button class="settings-import-btn" onClick={doExport}>
                      {t("general.export")}
                    </button>
                    <button class="settings-import-btn" onClick={doImport}>
                      {t("general.import")}
                    </button>
                  </div>
                </div>
                <Show when={backupMsg()}>
                  <p class="settings-note">{backupMsg()}</p>
                </Show>
              </div>
            </Show>

            <Show when={section() === "about"}>
              <div class="settings-section">
                <div class="settings-row">
                  <span class="settings-label">{t("about.version")}</span>
                  <span class="settings-value">{appVersion() || "—"}</span>
                </div>
                <div class="settings-row">
                  <span class="settings-label">{t("about.updates")}</span>
                  <button
                    class="settings-import-btn"
                    disabled={
                      updateState() === "checking" ||
                      updateState() === "installing"
                    }
                    onClick={() => checkUpdate()}
                  >
                    {updateState() === "checking"
                      ? t("about.checking")
                      : t("about.check")}
                  </button>
                </div>
                <Show when={updateState() === "uptodate"}>
                  <p class="settings-note">{t("about.uptodate")}</p>
                </Show>
                <Show when={updateState() === "error"}>
                  <p class="settings-note">{t("about.checkError")}</p>
                </Show>
                <Show when={updateState() === "available"}>
                  <div class="settings-update-box">
                    <p
                      class="settings-note"
                      innerHTML={t("about.available", {
                        version: foundUpdate()!.version,
                      })}
                    />
                    <button class="settings-import-btn" onClick={applyUpdate}>
                      {t("about.installRestart")}
                    </button>
                  </div>
                </Show>
                <Show when={updateState() === "installing"}>
                  <p class="settings-note">
                    {t("about.downloading", { percent: updateProgress() })}
                  </p>
                </Show>
                <p class="settings-note">{t("about.updateNote")}</p>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
