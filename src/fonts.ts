import { invoke } from "@tauri-apps/api/core";
import { createSignal } from "solid-js";

export type CustomFont = {
  family: string;
  fileName: string;
  dataB64: string;
};

/** Monospace families installed on the system (via fontconfig). */
export function listSystemFonts(): Promise<string[]> {
  return invoke<string[]>("list_system_fonts");
}

// Families of imported (custom) fonts, reactive so the settings dropdown updates
// when one is imported.
const [customFamilies, setCustomFamilies] = createSignal<string[]>([]);
export { customFamilies };

const registered = new Set<string>();

function b64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function registerFontFace(family: string, data: ArrayBuffer) {
  if (registered.has(family)) return;
  try {
    const face = new FontFace(family, data);
    await face.load();
    document.fonts.add(face);
    registered.add(family);
  } catch (e) {
    console.error("[lume] font register failed", family, e);
  }
}

/** Register all previously-imported fonts (called once at startup) so a saved
 *  custom `fontFamily` actually renders. */
export async function loadCustomFonts(): Promise<string[]> {
  let fonts: CustomFont[] = [];
  try {
    fonts = await invoke<CustomFont[]>("list_custom_fonts");
  } catch {
    return customFamilies();
  }
  for (const f of fonts) {
    await registerFontFace(f.family, b64ToArrayBuffer(f.dataB64));
  }
  setCustomFamilies(fonts.map((f) => f.family));
  return customFamilies();
}

/** Import a font file, register it, and return its family name. */
export async function importFontFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(
      ...bytes.subarray(i, Math.min(i + chunk, bytes.length))
    );
  }
  const family = await invoke<string>("import_font", {
    fileName: file.name,
    dataB64: btoa(bin),
  });
  await registerFontFace(family, buf);
  if (!customFamilies().includes(family)) {
    setCustomFamilies([...customFamilies(), family].sort());
  }
  return family;
}
