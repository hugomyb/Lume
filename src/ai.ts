import { invoke } from "@tauri-apps/api/core";

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

/** The model a provider would use by default (for the Settings placeholder). */
export function aiDefaultModel(provider: string): Promise<string | null> {
  return invoke<string | null>("ai_default_model", { provider });
}

export function aiExplainBlock(args: {
  command: string;
  output: string | null;
  exitCode: number;
}): Promise<number> {
  return invoke<number>("ai_explain_block", args);
}

export function aiChat(messages: ChatMessage[]): Promise<number> {
  return invoke<number>("ai_chat", { messages });
}

export function aiCancel(requestId: number): Promise<void> {
  return invoke<void>("ai_cancel", { requestId });
}
