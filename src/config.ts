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

export type Appearance = {
  fontFamily: string;
  fontSize: number;
  theme: Theme;
};

export type ShellConfig = {
  program: string | null;
  args: string[];
};

export type Config = {
  appearance: Appearance;
  shell: ShellConfig;
};

export function loadConfig(): Promise<Config> {
  return invoke<Config>("get_config");
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
