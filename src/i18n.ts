import { createSignal } from "solid-js";
import { es } from "./i18n/es";
import { de } from "./i18n/de";
import { it } from "./i18n/it";
import { pt } from "./i18n/pt";
import { nl } from "./i18n/nl";
import { tr } from "./i18n/tr";
import { ru } from "./i18n/ru";
import { ar } from "./i18n/ar";
import { hi } from "./i18n/hi";
import { zh } from "./i18n/zh";
import { ja } from "./i18n/ja";
import { ko } from "./i18n/ko";

/** Lightweight i18n: a reactive `t(key)` backed by per-language dictionaries.
 *  English is the source/default; missing keys fall back to English, then the
 *  key itself. Calling `t()` inside JSX is reactive — switching the language
 *  re-renders the UI. */

export type Dict = Record<string, string>;

export const LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "nl", label: "Nederlands" },
  { code: "tr", label: "Türkçe" },
  { code: "ru", label: "Русский" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
];

const en: Dict = {
  // --- Settings: nav + general ---
  "settings.title": "Settings",
  "settings.close": "Close (Esc)",
  "nav.appearance": "Appearance",
  "nav.shell": "Shell",
  "nav.notifications": "Notifications",
  "nav.remote": "Remote",
  "nav.ai": "AI",
  "nav.fileTree": "File tree",
  "nav.keys": "Shortcuts",
  "nav.general": "General",
  "nav.about": "About",

  // --- Appearance ---
  "appearance.font": "Font",
  "appearance.import": "Import",
  "appearance.importTitle": "Import a .ttf/.otf/.woff",
  "appearance.fontHint":
    "For prompt icons (Powerlevel10k, starship…), pick a <strong>Nerd Font</strong> — e.g. <code>MesloLGS NF</code>.",
  "appearance.fontCurrent": "(current)",
  "appearance.fontImported": "Imported",
  "appearance.fontSystem": "System (monospace)",
  "appearance.size": "Size",
  "appearance.cursorBlink": "Blinking cursor",
  "appearance.cursorStyle": "Cursor style",
  "cursor.block": "Block",
  "cursor.bar": "Bar",
  "cursor.underline": "Underline",
  "appearance.scrollback": "Scrollback (lines)",
  "appearance.theme": "Theme",
  "appearance.customTheme": "Custom",
  "appearance.ansi": "ANSI colors (16)",
  "appearance.reset": "Reset appearance",

  // --- Shell ---
  "shell.program": "Program",
  "shell.programPlaceholder": "$SHELL (default)",
  "shell.args": "Arguments",
  "shell.argsPlaceholder": "e.g. -l",
  "shell.note": "Applies to <strong>new</strong> terminals.",

  // --- Notifications ---
  "notif.enable": "Notify on long commands",
  "notif.minDuration": "Minimum duration (s)",
  "notif.sound": "Notification sound",
  "notif.note":
    "A system notification shows when a command exceeds this duration <strong>and Lume isn't focused</strong>.",

  // --- Keys ---
  "keys.hint":
    "Click a shortcut then press the desired combo (<kbd>Esc</kbd> to cancel).",
  "keys.reset": "Reset shortcuts",
  "keys.recording": "Press a key…",
  "keys.fixed": "Fixed shortcuts",

  // --- General ---
  "general.language": "Language",
  "general.focusFollowsMouse": "Focus pane on hover",
  "general.focusFollowsMouseNote":
    "Focus follows the mouse: hovering a split pane focuses it without clicking.",
  "general.backup": "Settings backup",
  "general.exportImport": "Export / import the whole config",
  "general.export": "Export",
  "general.import": "Import",
  "general.exported": "Settings exported ✓",
  "general.exportFailed": "Export failed",
  "general.imported": "Settings imported ✓",
  "general.importFailed": "Invalid file",

  // --- AI provider ---
  "ai.provider": "Provider",
  "ai.custom": "Custom (CLI)",
  "ai.model": "Model",
  "ai.modelHint": "default",
  "ai.status": "Status",
  "ai.detected": "✓ {cmd} detected",
  "ai.notFound": "✗ {cmd} not found in PATH",
  "ai.recheck": "Re-check",
  "ai.apiKey": "API key",
  "ai.command": "Command",
  "ai.args": "Arguments",
  "ai.keyEnv": "API key env var",
  "ai.claudeNote":
    "Uses the <code>claude</code> CLI (Claude Code). Run <code>claude login</code> once to authenticate.",
  "ai.codexNote":
    "Uses the <code>codex</code> CLI (OpenAI). Authenticate with <code>codex login</code>, or set an API key above (injected as <code>OPENAI_API_KEY</code>).",
  "ai.customNote":
    "Any CLI that takes a prompt and prints the answer to stdout. Put <code>{prompt}</code> in the arguments where the prompt should go.",
  "ai.keysNote":
    "API keys are stored locally in <code>~/.config/lume/config.toml</code> and are excluded from the settings export.",
  "ai.customApi": "OpenAI-compatible API",
  "ai.baseUrl": "Base URL",
  "ai.configured": "✓ configured",
  "ai.missingKey": "✗ API key required",
  "ai.openaiNote":
    "Uses the OpenAI API. Create a key at <code>platform.openai.com</code>.",
  "ai.deepseekNote":
    "Uses the DeepSeek API (OpenAI-compatible). Key at <code>platform.deepseek.com</code>.",
  "ai.apiNote":
    "Any OpenAI-compatible endpoint (Ollama, Groq, OpenRouter…). Set the base URL, key and model.",

  // --- About ---
  "about.version": "Version",
  "about.updates": "Updates",
  "about.check": "Check",
  "about.checking": "Checking…",
  "about.uptodate": "Lume is up to date ✓",
  "about.checkError": "Couldn't check (offline, or no release).",
  "about.available": "<strong>Lume {version}</strong> is available.",
  "about.installRestart": "Install and restart",
  "about.downloading": "Downloading… {percent}%",
  "about.updateNote":
    "Updates are signed and installed automatically (AppImage build). Auto-check at startup.",

  // --- Toolbar (tab bar) ---
  "toolbar.fileTree": "File tree",
  "toolbar.layouts": "Layout presets",
  "toolbar.blocks": "Blocks (Ctrl+B)",
  "toolbar.workflows": "Workflows (Ctrl+Shift+R)",
  "toolbar.ssh": "SSH (Ctrl+Shift+S)",
  "toolbar.settings": "Settings (Ctrl+,)",
  "toolbar.newTab": "New (Ctrl+Shift+T)",
  "toolbar.closeTab": "Close (Ctrl+Shift+W)",
  "toolbar.prevTabs": "Previous tabs",
  "toolbar.nextTabs": "Next tabs",
  "toolbar.remoteActive": "Remote control active — click to manage",

  // --- Layouts popup ---
  "layouts.title": "Apply a layout",
  "layouts.single": "Single",
  "layouts.twoCols": "2 columns",
  "layouts.twoRows": "2 rows",
  "layouts.grid": "2×2 grid",
  "layouts.mainSide": "Main + 2",
  "layouts.tripleCol": "3 columns",
  "layouts.note":
    "The active terminal is kept in the first slot. The tab's other shells are closed.",

  // --- Pane context menu ---
  "pane.copy": "⧉ Copy (Ctrl+Shift+C)",
  "pane.paste": "⎘ Paste (Ctrl+Shift+V)",
  "pane.splitH": "⬌ Split horizontally",
  "pane.splitV": "⬍ Split vertically",
  "pane.remote": "⇆ Control remotely",
  "pane.newTab": "+ New tab",
  "pane.close": "× Close this pane",
  "pane.closeTab": " (closes the tab)",

  // --- Tab context menu ---
  "tab.rename": "✎ Rename (double-click)",
  "tab.splitH": "⬌ Split horizontally (Ctrl+Shift+D)",
  "tab.splitV": "⬍ Split vertically (Ctrl+Shift+E)",
  "tab.newTab": "+ New tab (Ctrl+Shift+T)",
  "tab.close": "× Close this tab",
  "tab.panes": " ({n} panes)",

  // --- File tree ---
  "ft.hidden": "Hidden files",
  "ft.refresh": "Refresh",
  "ft.close": "Close",
  "ft.unknownDir": "Unknown directory",
  "ft.denied": "access denied",
  "ft.empty": "empty",
  "ft.cmdNote":
    "Context-menu commands run in the active terminal. <code>{path}</code> is replaced by the entry's path.",
  "ft.dirList": "List folder",
  "ft.dirOpen": "Open folder in editor",
  "ft.fileView": "View file",
  "ft.fileEdit": "Edit file",
  "ft.fileOpen": "Open file in editor",
  "ft.resetCmds": "Reset commands",
  "ftctx.cd": "Open folder",
  "ftctx.ls": "List",
  "ftctx.editor": "Open in editor",
  "ftctx.cat": "View",
  "ftctx.nano": "Edit",
  "ftctx.openEditor": "Open in editor",
  "ftctx.copyPath": "Copy path",
  "ftctx.insertPath": "Insert path",

  // --- Update banner ---
  "update.available": "<strong>Lume {version}</strong> is available",
  "update.failed": "failed, retry",
  "update.install": "Install and restart",
  "update.later": "Later",
  "update.downloading": "Downloading… {percent}%",

  // --- Remote dialog ---
  "remote.title": "Remote control",
  "remote.connected": "{n} device(s) connected",
  "remote.active": "Active — no connection",
  "remote.creatingTunnel": "Creating public tunnel… (a few seconds)",
  "remote.starting": "Starting…",
  "remote.scanPublic": "Scan the QR or open the URL from anywhere:",
  "remote.scanLan": "Same local network — scan the QR or open the URL:",
  "remote.copy": "Copy",
  "remote.installHint":
    "Install <code>cloudflared</code> to control from outside the local network.",
  "remote.warn": "⚠️ Anyone with this link can drive this terminal.",
  "remote.installBtn": "Install and enable the tunnel",
  "remote.installing": "Installing…",
  "remote.stop": "Stop remote control",

  // --- Terminal search ---
  "search.placeholder": "Search…",
  "search.next": "Next",
  "search.prev": "Previous",
  "search.close": "Close",

  // --- Blocks panel ---
  "blocks.title": "Blocks",
  "blocks.empty": "No command blocks yet.",
  "blocks.setupTitle": "Enable command blocks",
  "blocks.copyCmd": "Copy command",
  "blocks.copyOutput": "Copy output",
  "blocks.rerun": "Rerun",
  "blocks.remove": "Remove",
  "blocks.explain": "Explain (AI)",

  // --- Terminal search (button titles with shortcuts) ---
  "search.prevTitle": "Previous (Shift+Enter)",
  "search.nextTitle": "Next (Enter)",
  "search.closeTitle": "Close (Esc)",
  "term.copyBlock": "Copy the command + its output",

  // --- Notifications (banner bodies) ---
  "notif.cmdDone": "✓ Command finished",
  "notif.cmdFailed": "✗ Failed (exit {code})",

  // --- AI explain seed prompt ---
  "ai.seedHeader": "Here is a terminal block:",
  "ai.seedCommand": "Command: ",
  "ai.seedOutput": "Output:",
  "ai.seedExitCode": "Exit code: ",
  "ai.seedAsk": "Briefly explain what is happening.",

  // --- Command palette (AI) ---
  "cmd.placeholder": "Generate a command for…",
  "cmd.escCancel": "Esc to cancel",
  "cmd.noCli":
    "<code>{cmd}</code> not found in PATH — configure a provider in Settings › AI.",
  "cmd.noProvider":
    "No AI provider configured — set one up in Settings › AI.",
  "cmd.cancel": "Cancel",
  "cmd.insertHint": "<kbd>Enter</kbd> to insert into the terminal",
  "cmd.generateHint": "<kbd>Enter</kbd> to generate",
  "cmd.reformulate": "Rephrase",
  "cmd.insert": "Insert",
  "cmd.unknownError": "Unknown error",
  "cmd.retry": "Retry",

  // --- Workflows palette ---
  "wf.searchPlaceholder": "Search a workflow…",
  "wf.empty": "No workflow. <code>~/.config/lume/workflows/*.yaml</code>",
  "wf.navHint": "<kbd>↑</kbd><kbd>↓</kbd> navigate · <kbd>Enter</kbd> choose",
  "wf.back": "Back",
  "wf.preview": "Preview",
  "wf.toComplete": "To complete: {fields}",
  "wf.insertHint": "<kbd>Enter</kbd> to insert into the terminal",
  "wf.insert": "Insert",

  // --- SSH palette ---
  "ssh.placeholder": "SSH host or user@server…",
  "ssh.noMatch": "No matching host.",
  "ssh.noHosts":
    "No host in <code>~/.ssh/config</code>. Type a <code>user@server</code> to connect directly.",
  "ssh.connectTo": "Connect to",
  "ssh.directConnection": "direct connection",
  "ssh.navHint":
    "<kbd>↑</kbd><kbd>↓</kbd> navigate · <kbd>Enter</kbd> connect (new tab)",

  // --- Blocks panel (extended) ---
  "blocks.aiThinking": "{provider} is thinking…",
  "blocks.aiError": "Error",
  "blocks.aiClose": "Close",
  "blocks.followupPlaceholder": "Follow-up question…",
  "blocks.followupWait": "Please wait…",
  "blocks.send": "Send (Enter)",
  "blocks.emptyIntro":
    "A <strong>block</strong> = a command + its output + its exit code.",
  "blocks.emptyActive": "No command yet — run one and it will appear here.",
  "blocks.emptyHistory":
    "History will appear here once your shell emits OSC 133 markers.",
  "blocks.loading": "Loading…",
  "blocks.addLinePre": "Add this line to",
  "blocks.addLinePost": "then open a new shell:",
  "blocks.copy": "Copy",
  "blocks.detected":
    "Detected: <code>{shell}</code>. The PTY exports <code>LUME_TERM=1</code> — the source only activates inside Lume.",
  "blocks.shellUnknown": "unknown shell",
  "blocks.help": "What is this?",
  "blocks.helpIntro":
    "Each line = an executed command + its result. Lume detects the boundaries via OSC 133 (markers emitted by your shell).",
  "blocks.exitOk": "exit 0",
  "blocks.exitErr": "exit ≠ 0",
  "blocks.exitRunning": "running",
  "blocks.helpKeys":
    'Click → scroll to the prompt in the terminal.<br/>Right-click → copy, insert, explain.<br/><kbd>Ctrl</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> → navigate, <kbd>↩</kbd> to insert into the terminal.<br/><span style="color: var(--accent)">✨</span> → AI explanation.',
  "blocks.resize": "Drag to resize",
  "blocks.filterPlaceholder": "Filter blocks…",
  "blocks.searchClose": "Close (Esc)",
  "blocks.hide": "Hide (Ctrl+B)",
  "blocks.clickScroll": "Click → scroll to the prompt",
  "blocks.promptNotTracked": "(prompt line not tracked)",
  "blocks.rightClickActions": "Right-click → copy, insert, explain…",
  "blocks.promptNoCommand": "(prompt without command)",
  "blocks.outputCopied": "Output copied ✓",
  "blocks.commandCopied": "Command copied ✓",
  "blocks.outputCaptured": "Output captured — Shift+Click to copy it",
  "blocks.aiNoCli": "{provider} CLI not found in PATH",
  "blocks.aiBlockNotDone": "The block must be finished",
  "blocks.aiNoCommand": "No command to explain",
  "blocks.cancel": "Cancel",
  "blocks.aiFixError": "Fix this error with {provider}",
  "blocks.aiExplainBlock": "Explain this block with {provider}",
  "blocks.insertTerminal": "Insert into the terminal",
  "blocks.gotoCommand": "Go to the command in the terminal",
  "blocks.explainClaude": "✨ Explain with {provider}",
  "blocks.closeAiPanel": "Close the {provider} panel",
  "blocks.removeBlock": "Remove this block",

  // --- Keybindings (configurable actions) ---
  "keys.action.newTab": "New tab",
  "keys.action.closeTab": "Close pane / tab",
  "keys.action.nextTab": "Next tab",
  "keys.action.prevTab": "Previous tab",
  "keys.action.splitH": "Split horizontally",
  "keys.action.splitV": "Split vertically",
  "keys.action.togglePanel": "Blocks sidebar",
  "keys.action.search": "Filter blocks",
  "keys.action.termSearch": "Search in terminal",
  "keys.action.paletteAI": "AI palette",
  "keys.action.workflows": "Workflows",
  "keys.action.ssh": "SSH",
  "keys.action.copy": "Copy",
  "keys.action.paste": "Paste",
  "keys.action.settings": "Settings",

  // --- Keybindings (fixed shortcuts) ---
  "keys.fixed.goToTab": "Go to tab N",
  "keys.fixed.zoom": "Text zoom (size +/-)",
  "keys.fixed.zoomReset": "Default text size",
  "keys.fixed.navPanes": "Navigate between panes (loop)",
  "keys.fixed.navBlocks": "Navigate blocks",

  // --- Theme colors ---
  "color.background": "Background",
  "color.foreground": "Text",
  "color.accent": "Accent",
  "color.cursor": "Cursor",
  "color.selection": "Selection",

  // --- Pane ---
  "pane.dragMove": "Drag to move this pane",
  "pane.swap": "Swap",
  "pane.moveHere": "Move here",

  // --- Autocomplete footer ---
  "ac.complete": "<kbd>Tab</kbd> complete",
  "ac.navigate": "<kbd>↑</kbd><kbd>↓</kbd> navigate",
  "ac.close": "<kbd>Esc</kbd> close",
};

const fr: Dict = {
  "settings.title": "Réglages",
  "settings.close": "Fermer (Esc)",
  "nav.appearance": "Apparence",
  "nav.shell": "Shell",
  "nav.notifications": "Notifications",
  "nav.remote": "Remote",
  "nav.ai": "IA",
  "nav.fileTree": "Explorateur",
  "nav.keys": "Raccourcis",
  "nav.general": "Général",
  "nav.about": "À propos",

  "appearance.font": "Police",
  "appearance.import": "Importer",
  "appearance.importTitle": "Importer un .ttf/.otf/.woff",
  "appearance.fontHint":
    "Pour les icônes du prompt (Powerlevel10k, starship…), choisis une <strong>Nerd Font</strong> — ex&nbsp;: <code>MesloLGS NF</code>.",
  "appearance.fontCurrent": "(actuelle)",
  "appearance.fontImported": "Importées",
  "appearance.fontSystem": "Système (monospace)",
  "appearance.size": "Taille",
  "appearance.cursorBlink": "Curseur clignotant",
  "appearance.cursorStyle": "Style du curseur",
  "cursor.block": "Bloc",
  "cursor.bar": "Barre",
  "cursor.underline": "Souligné",
  "appearance.scrollback": "Scrollback (lignes)",
  "appearance.theme": "Thème",
  "appearance.customTheme": "Personnalisé",
  "appearance.ansi": "Couleurs ANSI (16)",
  "appearance.reset": "Réinitialiser l'apparence",

  "shell.program": "Programme",
  "shell.programPlaceholder": "$SHELL (défaut)",
  "shell.args": "Arguments",
  "shell.argsPlaceholder": "ex : -l",
  "shell.note": "S'applique aux <strong>nouveaux</strong> terminaux.",

  "notif.enable": "Notifier les commandes longues",
  "notif.minDuration": "Durée minimale (s)",
  "notif.sound": "Son de notification",
  "notif.note":
    "Une notification système s'affiche quand une commande dépasse cette durée <strong>et que Lume n'est pas au premier plan</strong>.",

  "keys.hint":
    "Clique sur un raccourci puis appuie sur la combinaison voulue (<kbd>Échap</kbd> pour annuler).",
  "keys.reset": "Réinitialiser les raccourcis",
  "keys.recording": "Appuie sur une touche…",
  "keys.fixed": "Raccourcis fixes",

  "general.language": "Langue",
  "general.focusFollowsMouse": "Focus du pane au survol",
  "general.focusFollowsMouseNote":
    "Le focus suit la souris : survoler un pane d'un split lui donne le focus sans cliquer.",
  "general.backup": "Sauvegarde des réglages",
  "general.exportImport": "Exporter / importer toute la config",
  "general.export": "Exporter",
  "general.import": "Importer",
  "general.exported": "Réglages exportés ✓",
  "general.exportFailed": "Échec de l'export",
  "general.imported": "Réglages importés ✓",
  "general.importFailed": "Fichier invalide",

  // --- AI provider ---
  "ai.provider": "Fournisseur",
  "ai.custom": "Personnalisé (CLI)",
  "ai.model": "Modèle",
  "ai.modelHint": "par défaut",
  "ai.status": "État",
  "ai.detected": "✓ {cmd} détecté",
  "ai.notFound": "✗ {cmd} introuvable dans le PATH",
  "ai.recheck": "Revérifier",
  "ai.apiKey": "Clé API",
  "ai.command": "Commande",
  "ai.args": "Arguments",
  "ai.keyEnv": "Variable d'env de la clé",
  "ai.claudeNote":
    "Utilise le CLI <code>claude</code> (Claude Code). Lance <code>claude login</code> une fois pour t'authentifier.",
  "ai.codexNote":
    "Utilise le CLI <code>codex</code> (OpenAI). Authentifie-toi avec <code>codex login</code>, ou renseigne une clé API ci-dessus (injectée comme <code>OPENAI_API_KEY</code>).",
  "ai.customNote":
    "N'importe quel CLI qui prend un prompt et écrit la réponse sur stdout. Place <code>{prompt}</code> dans les arguments à l'emplacement du prompt.",
  "ai.keysNote":
    "Les clés API sont stockées localement dans <code>~/.config/lume/config.toml</code> et exclues de l'export des réglages.",
  "ai.customApi": "API compatible OpenAI",
  "ai.baseUrl": "URL de base",
  "ai.configured": "✓ configuré",
  "ai.missingKey": "✗ clé API requise",
  "ai.openaiNote":
    "Utilise l'API OpenAI. Crée une clé sur <code>platform.openai.com</code>.",
  "ai.deepseekNote":
    "Utilise l'API DeepSeek (compatible OpenAI). Clé sur <code>platform.deepseek.com</code>.",
  "ai.apiNote":
    "N'importe quel endpoint compatible OpenAI (Ollama, Groq, OpenRouter…). Renseigne l'URL de base, la clé et le modèle.",

  "about.version": "Version",
  "about.updates": "Mises à jour",
  "about.check": "Vérifier",
  "about.checking": "Vérification…",
  "about.uptodate": "Lume est à jour ✓",
  "about.checkError": "Impossible de vérifier (hors-ligne, ou pas de release).",
  "about.available": "<strong>Lume {version}</strong> est disponible.",
  "about.installRestart": "Installer et redémarrer",
  "about.downloading": "Téléchargement… {percent}%",
  "about.updateNote":
    "Les mises à jour sont signées et installées automatiquement (build AppImage). Vérification auto au démarrage.",

  "toolbar.fileTree": "Arborescence de fichiers",
  "toolbar.layouts": "Layouts prédéfinis",
  "toolbar.blocks": "Blocs (Ctrl+B)",
  "toolbar.workflows": "Workflows (Ctrl+Shift+R)",
  "toolbar.ssh": "SSH (Ctrl+Shift+S)",
  "toolbar.settings": "Réglages (Ctrl+,)",
  "toolbar.newTab": "Nouveau (Ctrl+Shift+T)",
  "toolbar.closeTab": "Fermer (Ctrl+Shift+W)",
  "toolbar.prevTabs": "Onglets précédents",
  "toolbar.nextTabs": "Onglets suivants",
  "toolbar.remoteActive": "Contrôle à distance actif — cliquer pour gérer",

  "layouts.title": "Appliquer un layout",
  "layouts.single": "Simple",
  "layouts.twoCols": "2 colonnes",
  "layouts.twoRows": "2 lignes",
  "layouts.grid": "Grille 2×2",
  "layouts.mainSide": "Main + 2",
  "layouts.tripleCol": "3 colonnes",
  "layouts.note":
    "Le terminal actif est conservé en premier slot. Les autres shells du tab sont fermés.",

  "pane.copy": "⧉ Copier (Ctrl+Shift+C)",
  "pane.paste": "⎘ Coller (Ctrl+Shift+V)",
  "pane.splitH": "⬌ Split horizontal",
  "pane.splitV": "⬍ Split vertical",
  "pane.remote": "⇆ Contrôler à distance",
  "pane.newTab": "+ Nouveau tab",
  "pane.close": "× Fermer ce pane",
  "pane.closeTab": " (ferme le tab)",

  "tab.rename": "✎ Renommer (double-clic)",
  "tab.splitH": "⬌ Split horizontal (Ctrl+Shift+D)",
  "tab.splitV": "⬍ Split vertical (Ctrl+Shift+E)",
  "tab.newTab": "+ Nouveau tab (Ctrl+Shift+T)",
  "tab.close": "× Fermer ce tab",
  "tab.panes": " ({n} panes)",

  "ft.hidden": "Fichiers cachés",
  "ft.refresh": "Rafraîchir",
  "ft.close": "Fermer",
  "ft.unknownDir": "Dossier inconnu",
  "ft.denied": "accès refusé",
  "ft.empty": "vide",
  "ft.cmdNote":
    "Les commandes du menu contextuel sont exécutées dans le terminal actif. <code>{path}</code> est remplacé par le chemin de l'élément.",
  "ft.dirList": "Lister le dossier",
  "ft.dirOpen": "Ouvrir le dossier (éditeur)",
  "ft.fileView": "Afficher le fichier",
  "ft.fileEdit": "Éditer le fichier",
  "ft.fileOpen": "Ouvrir le fichier (éditeur)",
  "ft.resetCmds": "Réinitialiser les commandes",
  "ftctx.cd": "Aller dans le dossier",
  "ftctx.ls": "Lister",
  "ftctx.editor": "Ouvrir dans l'éditeur",
  "ftctx.cat": "Afficher",
  "ftctx.nano": "Éditer",
  "ftctx.openEditor": "Ouvrir dans l'éditeur",
  "ftctx.copyPath": "Copier le chemin",
  "ftctx.insertPath": "Insérer le chemin",

  "update.available": "<strong>Lume {version}</strong> est disponible",
  "update.failed": "échec, réessayer",
  "update.install": "Installer et redémarrer",
  "update.later": "Plus tard",
  "update.downloading": "Téléchargement… {percent}%",

  "remote.title": "Contrôle à distance",
  "remote.connected": "{n} appareil(s) connecté(s)",
  "remote.active": "Actif — aucune connexion",
  "remote.creatingTunnel": "Création du tunnel public… (quelques secondes)",
  "remote.starting": "Démarrage…",
  "remote.scanPublic": "Scanne le QR ou ouvre l'URL depuis n'importe où :",
  "remote.scanLan": "Même réseau local — scanne le QR ou ouvre l'URL :",
  "remote.copy": "Copier",
  "remote.installHint":
    "Installe <code>cloudflared</code> pour piloter hors du réseau local.",
  "remote.warn": "⚠️ Quiconque a ce lien peut piloter ce terminal.",
  "remote.installBtn": "Installer et activer le tunnel",
  "remote.installing": "Installation en cours…",
  "remote.stop": "Arrêter le contrôle à distance",

  "search.placeholder": "Rechercher…",
  "search.next": "Suivant",
  "search.prev": "Précédent",
  "search.close": "Fermer",

  "blocks.title": "Blocs",
  "blocks.empty": "Aucun bloc de commande pour l'instant.",
  "blocks.setupTitle": "Activer les blocs de commande",
  "blocks.copyCmd": "Copier la commande",
  "blocks.copyOutput": "Copier la sortie",
  "blocks.rerun": "Relancer",
  "blocks.remove": "Supprimer",
  "blocks.explain": "Expliquer (IA)",

  // --- Terminal search (button titles with shortcuts) ---
  "search.prevTitle": "Précédent (Maj+Entrée)",
  "search.nextTitle": "Suivant (Entrée)",
  "search.closeTitle": "Fermer (Échap)",
  "term.copyBlock": "Copier la commande + sa sortie",

  // --- Notifications (banner bodies) ---
  "notif.cmdDone": "✓ Commande terminée",
  "notif.cmdFailed": "✗ Échec (exit {code})",

  // --- AI explain seed prompt ---
  "ai.seedHeader": "Voici un bloc de terminal :",
  "ai.seedCommand": "Commande : ",
  "ai.seedOutput": "Sortie :",
  "ai.seedExitCode": "Code retour : ",
  "ai.seedAsk": "Explique brièvement ce qui se passe.",

  // --- Command palette (AI) ---
  "cmd.placeholder": "Génère une commande pour…",
  "cmd.escCancel": "Esc pour annuler",
  "cmd.noCli":
    "<code>{cmd}</code> introuvable dans le PATH — configure un fournisseur dans Réglages › IA.",
  "cmd.noProvider":
    "Aucun fournisseur IA configuré — configures-en un dans Réglages › IA.",
  "cmd.cancel": "Annuler",
  "cmd.insertHint": "<kbd>Enter</kbd> pour insérer dans le terminal",
  "cmd.generateHint": "<kbd>Enter</kbd> pour générer",
  "cmd.reformulate": "Reformuler",
  "cmd.insert": "Insérer",
  "cmd.unknownError": "Erreur inconnue",
  "cmd.retry": "Réessayer",

  // --- Workflows palette ---
  "wf.searchPlaceholder": "Chercher un workflow…",
  "wf.empty": "Aucun workflow. <code>~/.config/lume/workflows/*.yaml</code>",
  "wf.navHint": "<kbd>↑</kbd><kbd>↓</kbd> naviguer · <kbd>Enter</kbd> choisir",
  "wf.back": "Retour",
  "wf.preview": "Aperçu",
  "wf.toComplete": "À compléter : {fields}",
  "wf.insertHint": "<kbd>Enter</kbd> pour insérer dans le terminal",
  "wf.insert": "Insérer",

  // --- SSH palette ---
  "ssh.placeholder": "Host SSH ou user@serveur…",
  "ssh.noMatch": "Aucun host ne correspond.",
  "ssh.noHosts":
    "Aucun host dans <code>~/.ssh/config</code>. Tape un <code>user@serveur</code> pour t'y connecter directement.",
  "ssh.connectTo": "Se connecter à",
  "ssh.directConnection": "connexion directe",
  "ssh.navHint":
    "<kbd>↑</kbd><kbd>↓</kbd> naviguer · <kbd>Enter</kbd> se connecter (nouvel onglet)",

  // --- Blocks panel (extended) ---
  "blocks.aiThinking": "{provider} réfléchit…",
  "blocks.aiError": "Erreur",
  "blocks.aiClose": "Fermer",
  "blocks.followupPlaceholder": "Question de suivi…",
  "blocks.followupWait": "Patiente…",
  "blocks.send": "Envoyer (Entrée)",
  "blocks.emptyIntro":
    "Un <strong>bloc</strong> = une commande + sa sortie + son code retour.",
  "blocks.emptyActive":
    "Aucune commande pour l'instant — lances-en une et elle apparaîtra ici.",
  "blocks.emptyHistory":
    "L'historique apparaîtra ici dès que ton shell émet les markers OSC 133.",
  "blocks.loading": "Chargement…",
  "blocks.addLinePre": "Ajoute cette ligne à",
  "blocks.addLinePost": "puis ouvre un nouveau shell :",
  "blocks.copy": "Copier",
  "blocks.detected":
    "Détecté : <code>{shell}</code>. Le PTY exporte <code>LUME_TERM=1</code> — le source ne s'active que dans Lume.",
  "blocks.shellUnknown": "shell inconnu",
  "blocks.help": "C'est quoi ?",
  "blocks.helpIntro":
    "Chaque ligne = une commande exécutée + son résultat. Lume détecte les bornes via OSC 133 (markers émis par ton shell).",
  "blocks.exitOk": "exit 0",
  "blocks.exitErr": "exit ≠ 0",
  "blocks.exitRunning": "en cours",
  "blocks.helpKeys":
    'Click → scroll au prompt dans le terminal.<br/>Right-click → copier, insérer, expliquer.<br/><kbd>Ctrl</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> → naviguer, <kbd>↩</kbd> pour insérer dans le terminal.<br/><span style="color: var(--accent)">✨</span> → explication IA.',
  "blocks.resize": "Glisser pour redimensionner",
  "blocks.filterPlaceholder": "Filtrer les blocs…",
  "blocks.searchClose": "Fermer (Échap)",
  "blocks.hide": "Masquer (Ctrl+B)",
  "blocks.clickScroll": "Click → scroll au prompt",
  "blocks.promptNotTracked": "(ligne du prompt non trackée)",
  "blocks.rightClickActions": "Right-click → copier, insérer, expliquer…",
  "blocks.promptNoCommand": "(prompt sans commande)",
  "blocks.outputCopied": "Sortie copiée ✓",
  "blocks.commandCopied": "Commande copiée ✓",
  "blocks.outputCaptured": "Sortie capturée — Shift+Click pour la copier",
  "blocks.aiNoCli": "CLI {provider} introuvable dans le PATH",
  "blocks.aiBlockNotDone": "Le bloc doit être terminé",
  "blocks.aiNoCommand": "Pas de commande à expliquer",
  "blocks.cancel": "Annuler",
  "blocks.aiFixError": "Corriger cette erreur avec {provider}",
  "blocks.aiExplainBlock": "Expliquer ce bloc avec {provider}",
  "blocks.insertTerminal": "Insérer dans le terminal",
  "blocks.gotoCommand": "Aller à la commande dans le terminal",
  "blocks.explainClaude": "✨ Expliquer avec {provider}",
  "blocks.closeAiPanel": "Fermer le panneau {provider}",
  "blocks.removeBlock": "Supprimer ce bloc",

  // --- Keybindings (configurable actions) ---
  "keys.action.newTab": "Nouvel onglet",
  "keys.action.closeTab": "Fermer le pane / onglet",
  "keys.action.nextTab": "Onglet suivant",
  "keys.action.prevTab": "Onglet précédent",
  "keys.action.splitH": "Split horizontal",
  "keys.action.splitV": "Split vertical",
  "keys.action.togglePanel": "Sidebar blocs",
  "keys.action.search": "Filtrer les blocs",
  "keys.action.termSearch": "Rechercher dans le terminal",
  "keys.action.paletteAI": "Palette IA",
  "keys.action.workflows": "Workflows",
  "keys.action.ssh": "SSH",
  "keys.action.copy": "Copier",
  "keys.action.paste": "Coller",
  "keys.action.settings": "Réglages",

  // --- Keybindings (fixed shortcuts) ---
  "keys.fixed.goToTab": "Aller à l'onglet N",
  "keys.fixed.zoom": "Zoom du texte (taille +/-)",
  "keys.fixed.zoomReset": "Taille du texte par défaut",
  "keys.fixed.navPanes": "Naviguer entre panes (boucle)",
  "keys.fixed.navBlocks": "Naviguer dans les blocs",

  // --- Theme colors ---
  "color.background": "Fond",
  "color.foreground": "Texte",
  "color.accent": "Accent",
  "color.cursor": "Curseur",
  "color.selection": "Sélection",

  // --- Pane ---
  "pane.dragMove": "Glisser pour déplacer ce pane",
  "pane.swap": "Échanger",
  "pane.moveHere": "Déplacer ici",

  // --- Autocomplete footer ---
  "ac.complete": "<kbd>Tab</kbd> compléter",
  "ac.navigate": "<kbd>↑</kbd><kbd>↓</kbd> naviguer",
  "ac.close": "<kbd>Esc</kbd> fermer",
};

const dicts: Record<string, Dict> = {
  en,
  fr,
  es,
  de,
  it,
  pt,
  nl,
  tr,
  ru,
  ar,
  hi,
  zh,
  ja,
  ko,
};

const [locale, setLocaleSignal] = createSignal("en");
export { locale };

export function setLocale(code: string): void {
  setLocaleSignal(dicts[code] ? code : "en");
}

export function t(key: string, params?: Record<string, string | number>): string {
  const dict = dicts[locale()] ?? en;
  let s = dict[key] ?? en[key] ?? key;
  if (params) {
    for (const k in params) s = s.split(`{${k}}`).join(String(params[k]));
  }
  return s;
}
