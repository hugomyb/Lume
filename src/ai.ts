import { invoke } from "@tauri-apps/api/core";

export type AiStatus = {
  available: boolean;
  path: string | null;
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
