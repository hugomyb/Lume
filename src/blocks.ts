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

/** Threshold above which decoding moves off the event handler: a captured
 *  1 MiB build log means an atob + 1M-iteration loop right when the prompt
 *  returns — a visible input hitch. (Requires `data:` in the CSP connect-src.) */
const ASYNC_DECODE_MIN = 64 * 1024;

export function isLargeB64(b64: string | null): b64 is string {
  return !!b64 && b64.length >= ASYNC_DECODE_MIN;
}

/** Decode a LARGE base64 chunk asynchronously: a data: URL fetch does the
 *  base64 work in the engine's loader instead of a JS loop on the main
 *  thread. Falls back to the sync path if fetch is unavailable/blocked. */
export async function b64ToStringAsync(b64: string): Promise<string> {
  try {
    const resp = await fetch(`data:application/octet-stream;base64,${b64}`);
    const buf = await resp.arrayBuffer();
    return new TextDecoder("utf-8", { fatal: false }).decode(buf);
  } catch {
    return b64ToString(b64);
  }
}
