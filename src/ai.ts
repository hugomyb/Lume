import { invoke } from "@tauri-apps/api/core";
import { t } from "./i18n";

/** Marker the backend puts on errors it wants translated — see `err()` in
 *  `src-tauri/src/ai.rs`. Payload is `<key>` or `<key>|<arg>`. */
const ERR_PREFIX = "lume.err:";

/** Render a backend AI error in the UI language. Messages Lume raises itself
 *  arrive as i18n keys (the backend has no idea what language the UI is in);
 *  everything else — a provider's own stderr, an HTTP status — is its own text
 *  already and is shown as-is. */
export function aiErrorText(message: string): string {
  // `String(e)` on a rejected invoke() gives "Error: <message>".
  const raw = message.replace(/^Error:\s*/, "");
  if (!raw.startsWith(ERR_PREFIX)) return message;
  const body = raw.slice(ERR_PREFIX.length);
  const sep = body.indexOf("|");
  const key = sep === -1 ? body : body.slice(0, sep);
  const arg = sep === -1 ? null : body.slice(sep + 1);
  return t(`aiErr.${key}`, arg === null ? undefined : { arg });
}

export type AiStatus = {
  available: boolean;
  path: string | null;
  /** Active provider id ("claude" | "codex" | "custom"). */
  provider: string;
  /** CLI command the active provider resolves to. */
  command: string;
};

export type AiStreamStatus = "streaming" | "done" | "error";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type AiState = {
  status: AiStreamStatus;
  response: string;
  requestId: number | null;
  error: string | null;
  history: ChatMessage[]; // previous completed turns, excluding the streaming one
};

export type AiChunkEvent = {
  requestId: number;
  delta: string;
};

export type AiDoneEvent = {
  requestId: number;
};

export type AiErrorEvent = {
  requestId: number;
  message: string;
};

export function aiStatus(): Promise<AiStatus> {
  return invoke<AiStatus>("ai_status");
}

/** Whether a given CLI command resolves in PATH (live check for Settings). */
export function aiProbe(command: string): Promise<boolean> {
  return invoke<boolean>("ai_probe", { command });
}

/** One subscription limit window as the Claude CLI reports it. */
export type PlanWindow = {
  label: string;
  percentUsed: number;
  resets: string;
};

/** Subscription limit windows. Empty for providers that don't report them —
 *  and for the Claude CLI when `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`
 *  blocks the lookup it needs. Free to call: no model request. */
export function aiPlanUsage(): Promise<PlanWindow[]> {
  return invoke<PlanWindow[]>("ai_plan_usage");
}

/** The model a provider would use by default (for the Settings placeholder). */
export function aiDefaultModel(provider: string): Promise<string | null> {
  return invoke<string | null>("ai_default_model", { provider });
}

/** Opt-in extra context for "explain this block". */
export type BlockContext = {
  cwd?: string | null;
  branch?: string | null;
  previous?: { command: string; output: string | null; exitCode: number | null } | null;
};

export function aiExplainBlock(args: {
  command: string;
  output: string | null;
  exitCode: number;
  context?: BlockContext | null;
}): Promise<number> {
  return invoke<number>("ai_explain_block", { ...args, context: args.context ?? null });
}

export function aiChat(messages: ChatMessage[]): Promise<number> {
  return invoke<number>("ai_chat", { messages });
}

export function aiCancel(requestId: number): Promise<void> {
  return invoke<void>("ai_cancel", { requestId });
}
