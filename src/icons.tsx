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

/** Refresh / re-run (circular arrows). */
export function IconRefresh(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </Svg>
  );
}

/** AI assistant (a sparkle). */
export function IconSparkles(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5 10.2 7.7 12 3z" />
      <path d="M18.5 15l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" />
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

/** Chevron pointing up. */
export function IconChevronUp(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <polyline points="18 15 12 9 6 15" />
    </Svg>
  );
}

/** Chevron pointing down. */
export function IconChevronDown(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <polyline points="6 9 12 15 18 9" />
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

/** Copy (two stacked sheets). */
export function IconCopy(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <rect x="9" y="9" width="12" height="12" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Svg>
  );
}

/** Paste (a clipboard). */
export function IconClipboard(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </Svg>
  );
}

/** Split horizontally — side-by-side panes, so a vertical divider. */
export function IconSplitH(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="12" y1="3" x2="12" y2="21" />
    </Svg>
  );
}

/** Split vertically — stacked panes, so a horizontal divider. */
export function IconSplitV(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </Svg>
  );
}

/** Remote control (two-way exchange). */
export function IconRemote(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <polyline points="16 3 20 7 16 11" />
      <line x1="20" y1="7" x2="4" y2="7" />
      <polyline points="8 13 4 17 8 21" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </Svg>
  );
}

/** Add / new (a plus). */
export function IconPlus(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </Svg>
  );
}

/** Close / failure (a cross). */
export function IconX(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </Svg>
  );
}

/** Success (a checkmark). */
export function IconCheck(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <polyline points="20 6 9 17 4 12" />
    </Svg>
  );
}

/** Rename / edit (a pencil). */
export function IconPencil(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
    </Svg>
  );
}

/** Search (a magnifier). */
export function IconSearch(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.5" y2="16.5" />
    </Svg>
  );
}

/** Still running (a filled play triangle). */
export function IconPlay(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <polygon points="7 4 20 12 7 20 7 4" fill="currentColor" />
    </Svg>
  );
}

/** Send / go (an arrow to the right). */
export function IconArrowRight(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <line x1="4" y1="12" x2="19" y2="12" />
      <polyline points="13 6 19 12 13 18" />
    </Svg>
  );
}

/** Stop a running job (a filled square). */
export function IconStop(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <rect x="6" y="6" width="12" height="12" rx="1.5" ry="1.5" fill="currentColor" />
    </Svg>
  );
}

/** Import from disk (arrow into a tray). */
export function IconDownload(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </Svg>
  );
}

/** Enter / submit (a return arrow). */
export function IconEnter(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <polyline points="9 10 4 15 9 20" />
      <path d="M20 4v7a4 4 0 0 1-4 4H4" />
    </Svg>
  );
}

/** Warning (a bang in a triangle). */
export function IconWarning(p: IconProps): JSX.Element {
  return (
    <Svg size={p.size}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
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
