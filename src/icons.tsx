import type { JSX } from "solid-js";

// A coherent line-icon set (Feather-style: 24×24 grid, stroke = currentColor,
// width 2, round caps) so every toolbar button matches visually.

type IconProps = { size?: number };

function Svg(props: { size?: number; children: JSX.Element }): JSX.Element {
  return (
    <svg
      width={props.size ?? 16}
      height={props.size ?? 16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {props.children}
    </svg>
  );
}

/** Pane layout presets (a framed view split in two columns). */
export function IconLayouts(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="12" y1="3" x2="12" y2="21" />
    </Svg>
  );
}

/** Command blocks side panel (a list). */
export function IconBlocks(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <line x1="8" y1="6" x2="20" y2="6" />
      <line x1="8" y1="12" x2="20" y2="12" />
      <line x1="8" y1="18" x2="20" y2="18" />
      <line x1="4" y1="6" x2="4.01" y2="6" />
      <line x1="4" y1="12" x2="4.01" y2="12" />
      <line x1="4" y1="18" x2="4.01" y2="18" />
    </Svg>
  );
}

/** Workflows (a lightning bolt). */
export function IconWorkflow(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </Svg>
  );
}

/** SSH / remote shell (a terminal prompt). */
export function IconSsh(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </Svg>
  );
}

/** Folder (file-tree sidebar + directory rows). */
export function IconFolder(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </Svg>
  );
}

/** File (file-tree rows). */
export function IconFile(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </Svg>
  );
}

/** Appearance / theme (a droplet). */
export function IconAppearance(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    </Svg>
  );
}

/** Notifications (a bell). */
export function IconBell(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Svg>
  );
}

/** Remote device (a smartphone). */
export function IconSmartphone(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </Svg>
  );
}

/** Keyboard shortcuts. */
export function IconKeyboard(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <rect x="2" y="6" width="20" height="12" rx="2" ry="2" />
      <line x1="6" y1="10" x2="6.01" y2="10" />
      <line x1="10" y1="10" x2="10.01" y2="10" />
      <line x1="14" y1="10" x2="14.01" y2="10" />
      <line x1="18" y1="10" x2="18.01" y2="10" />
      <line x1="8" y1="14" x2="16" y2="14" />
    </Svg>
  );
}

/** Chevron pointing left. */
export function IconChevronLeft(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

/** Chevron pointing right. */
export function IconChevronRight(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <polyline points="9 18 15 12 9 6" />
    </Svg>
  );
}

/** Info / about (a circled i). */
export function IconInfo(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </Svg>
  );
}

/** Settings (a gear). */
export function IconSettings(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  );
}
