import { invoke } from "@tauri-apps/api/core";

export type Theme = {
  background: string;
  foreground: string;
  cursor: string;
  selection: string;
  accent: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
};

export type CursorStyle = "block" | "bar" | "underline";

export type Appearance = {
  fontFamily: string;
  fontSize: number;
  cursorBlink: boolean;
  cursorStyle: CursorStyle;
  scrollback: number;
  theme: Theme;
};

export type ShellConfig = {
  program: string | null;
  args: string[];
};

export type NotificationsConfig = {
  /** Fire a desktop notification when a long command finishes unfocused. */
  enabled: boolean;
  /** Minimum command duration (seconds) before notifying. */
  minDurationSec: number;
  /** Play a sound with the notification. */
  sound: boolean;
};

export type AiConfig = {
  /** Active provider id: "claude" | "codex" | "custom". */
  provider: string;
  /** Optional model override for Claude (empty = default). */
  claudeModel: string;
  /** Optional model override for Codex (empty = default). */
  codexModel: string;
  /** API key for Codex, injected as OPENAI_API_KEY (optional). */
  codexApiKey: string;
  /** Custom CLI provider. */
  customCommand: string;
  customArgs: string[];
  customApiKey: string;
  customKeyEnv: string;
  /** API (OpenAI-compatible) providers. */
  openaiApiKey: string;
  openaiModel: string;
  deepseekApiKey: string;
  deepseekModel: string;
  apiBaseUrl: string;
  apiApiKey: string;
  apiModel: string;
};

export type Config = {
  appearance: Appearance;
  shell: ShellConfig;
  notifications: NotificationsConfig;
  ai: AiConfig;
  /** UI language code ("en", "fr", …). */
  language: string;
  /** Action id → key combo overrides for remappable shortcuts. */
  keybindings: Record<string, string>;
};

export function loadConfig(): Promise<Config> {
  return invoke<Config>("get_config");
}

export function saveConfig(config: Config): Promise<void> {
  return invoke<void>("save_config", { config });
}

export const DEFAULT_THEME: Theme = {
  background: "#0e1014",
  foreground: "#e6e6e6",
  cursor: "#e6e6e6",
  selection: "#3a4150",
  accent: "#4ea1ff",
  black: "#2c303a",
  red: "#ff5c8d",
  green: "#56d364",
  yellow: "#e3b341",
  blue: "#4ea1ff",
  magenta: "#c678dd",
  cyan: "#56b6c2",
  white: "#c0c4ce",
  brightBlack: "#525866",
  brightRed: "#ff7ba0",
  brightGreen: "#7ce081",
  brightYellow: "#f0c674",
  brightBlue: "#73b5ff",
  brightMagenta: "#d49eea",
  brightCyan: "#7fc8d3",
  brightWhite: "#e6e9f0",
};

export const DEFAULT_CONFIG: Config = {
  appearance: {
    fontFamily:
      'Menlo, "DejaVu Sans Mono", "Liberation Mono", Consolas, monospace',
    fontSize: 14,
    cursorBlink: true,
    cursorStyle: "block",
    scrollback: 5000,
    theme: DEFAULT_THEME,
  },
  shell: { program: null, args: [] },
  notifications: { enabled: true, minDurationSec: 10, sound: true },
  ai: {
    provider: "claude",
    claudeModel: "",
    codexModel: "",
    codexApiKey: "",
    customCommand: "",
    customArgs: ["{prompt}"],
    customApiKey: "",
    customKeyEnv: "",
    openaiApiKey: "",
    openaiModel: "",
    deepseekApiKey: "",
    deepseekModel: "",
    apiBaseUrl: "",
    apiApiKey: "",
    apiModel: "",
  },
  language: "en",
  keybindings: {},
};

export function exportConfig(config: Config, path: string): Promise<void> {
  return invoke<void>("export_config", { path, config });
}

export function importConfig(path: string): Promise<Config> {
  return invoke<Config>("import_config", { path });
}

import type { ITheme } from "@xterm/xterm";

export function toXtermTheme(t: Theme): ITheme {
  return {
    background: t.background,
    foreground: t.foreground,
    cursor: t.cursor,
    cursorAccent: t.background,
    selectionBackground: t.selection,
    black: t.black,
    red: t.red,
    green: t.green,
    yellow: t.yellow,
    blue: t.blue,
    magenta: t.magenta,
    cyan: t.cyan,
    white: t.white,
    brightBlack: t.brightBlack,
    brightRed: t.brightRed,
    brightGreen: t.brightGreen,
    brightYellow: t.brightYellow,
    brightBlue: t.brightBlue,
    brightMagenta: t.brightMagenta,
    brightCyan: t.brightCyan,
    brightWhite: t.brightWhite,
  };
}
