import type { AiState } from "./ai";

export type BlockStatus = "pending" | "running" | "done";

export type Block = {
  id: number;
  command: string | null;
  output: string | null;
  startedAt: number;
  finishedAt: number | null;
  exitCode: number | null;
  status: BlockStatus;
  ai: AiState | null;
  /** Opaque marker id issued by the Terminal component when the prompt of
   * this block was processed by xterm (OSC 133;A). Used to ask xterm to
   * scroll to and flash the block later — even after scrollback eviction,
   * because the underlying `IMarker` tracks the row as the buffer shifts.
   * `null` until set; some shells/contexts may never set it. */
  markerId: number | null;
};

export type PtyBlock = {
  id: number;
  kind: "promptStart" | "promptEnd" | "outputStart" | "outputEnd" | "commandLine";
  exitCode: number | null;
  command: string | null;
  outputB64: string | null;
};

// Strip ANSI escape sequences (CSI/SGR + OSC) from a string for clean copy/paste.
export function stripAnsi(s: string): string {
  return s
    // OSC: ESC ] ... BEL or ESC ] ... ESC \
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "")
    // CSI: ESC [ ... letter (handles colors, cursor moves, etc.)
    .replace(/\x1b\[[\d;?]*[a-zA-Z]/g, "")
    // Lone ESC + char (simple escapes)
    .replace(/\x1b[()][\x20-\x7e]/g, "");
}

// Decode a base64 PTY chunk into a UTF-8 string (best-effort: any incomplete
// trailing UTF-8 sequence becomes a replacement char, but full chunks captured
// between OSC markers are nearly always complete).
export function b64ToString(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}
