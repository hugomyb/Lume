import {
  readText as tauriReadText,
  writeText as tauriWriteText,
} from "@tauri-apps/plugin-clipboard-manager";

// WebKitGTK's `navigator.clipboard.readText()` isn't reliable (and write can be
// gesture-gated), so go through Tauri's clipboard plugin with a web fallback.

export async function copyText(text: string): Promise<void> {
  try {
    await tauriWriteText(text);
  } catch (e) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      console.error("copy failed", e);
    }
  }
}

export async function pasteText(): Promise<string> {
  try {
    return (await tauriReadText()) ?? "";
  } catch (e) {
    try {
      return (await navigator.clipboard.readText()) ?? "";
    } catch {
      console.error("paste failed", e);
      return "";
    }
  }
}
