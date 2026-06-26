// Remappable app shortcuts. Combos are normalized on the produced key (e.key)
// so letter bindings follow the keyboard layout's labels (Ctrl+Shift+W is the
// key labelled W on AZERTY too). Layout-special keys (number row, zoom +/-,
// arrows) are handled separately and aren't remappable.

export type ActionId =
  | "newTab"
  | "closeTab"
  | "nextTab"
  | "prevTab"
  | "splitH"
  | "splitV"
  | "togglePanel"
  | "search"
  | "termSearch"
  | "paletteAI"
  | "workflows"
  | "ssh"
  | "copy"
  | "paste"
  | "settings";

export type ActionDef = { id: ActionId; label: string; default: string };

// `label` is the i18n key (resolved via t() at render); kept on the def so the
// id ↔ label mapping lives in one place.
export const ACTIONS: ActionDef[] = [
  { id: "newTab", label: "keys.action.newTab", default: "Ctrl+Shift+t" },
  { id: "closeTab", label: "keys.action.closeTab", default: "Ctrl+Shift+w" },
  { id: "nextTab", label: "keys.action.nextTab", default: "Ctrl+Tab" },
  { id: "prevTab", label: "keys.action.prevTab", default: "Ctrl+Shift+Tab" },
  { id: "splitH", label: "keys.action.splitH", default: "Ctrl+Shift+d" },
  { id: "splitV", label: "keys.action.splitV", default: "Ctrl+Shift+e" },
  { id: "togglePanel", label: "keys.action.togglePanel", default: "Ctrl+b" },
  { id: "search", label: "keys.action.search", default: "Ctrl+f" },
  { id: "termSearch", label: "keys.action.termSearch", default: "Ctrl+Shift+f" },
  { id: "paletteAI", label: "keys.action.paletteAI", default: "Ctrl+Shift+p" },
  { id: "workflows", label: "keys.action.workflows", default: "Ctrl+Shift+r" },
  { id: "ssh", label: "keys.action.ssh", default: "Ctrl+Shift+s" },
  { id: "copy", label: "keys.action.copy", default: "Ctrl+Shift+c" },
  { id: "paste", label: "keys.action.paste", default: "Ctrl+Shift+v" },
  { id: "settings", label: "keys.action.settings", default: "Ctrl+," },
];

const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta"]);

/** Canonical combo string for an event, or null for a lone modifier press. */
export function eventToCombo(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null;
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Meta");
  let key = e.key;
  if (key === " ") key = "Space";
  else if (key.length === 1) key = key.toLowerCase();
  parts.push(key);
  return parts.join("+");
}

/** Pretty label for a combo, e.g. "Ctrl+Shift+t" → "Ctrl + Shift + T". */
export function comboToLabel(combo: string): string {
  if (!combo) return "—";
  return combo
    .split("+")
    .map((p) => (p.length === 1 ? p.toUpperCase() : p))
    .join(" + ");
}

export function defaultBindings(): Record<ActionId, string> {
  const out = {} as Record<ActionId, string>;
  for (const a of ACTIONS) out[a.id] = a.default;
  return out;
}

/** Effective bindings = defaults overridden by stored config. An empty stored
 *  value means "unbound" (kept as-is so the user can clear a shortcut). */
export function resolveBindings(
  stored: Record<string, string> | undefined
): Record<ActionId, string> {
  const out = defaultBindings();
  if (stored) {
    for (const a of ACTIONS) {
      const v = stored[a.id];
      if (v !== undefined) out[a.id] = v;
    }
  }
  return out;
}

/** Reverse map combo → action, for dispatch. */
export function comboToAction(
  bindings: Record<ActionId, string>
): Record<string, ActionId> {
  const map: Record<string, ActionId> = {};
  for (const a of ACTIONS) {
    const combo = bindings[a.id];
    if (combo) map[combo] = a.id;
  }
  return map;
}
