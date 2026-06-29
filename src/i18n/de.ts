import type { Dict } from "../i18n";

export const de: Dict = {
  // --- Settings: nav + general ---
  "settings.title": "Einstellungen",
  "settings.close": "Schließen (Esc)",
  "nav.appearance": "Darstellung",
  "nav.shell": "Shell",
  "nav.notifications": "Benachrichtigungen",
  "nav.remote": "Remote",
  "nav.keys": "Tastenkürzel",
  "nav.general": "Allgemein",
  "nav.about": "Über",

  // --- Appearance ---
  "appearance.font": "Schriftart",
  "appearance.import": "Importieren",
  "appearance.importTitle": "Eine .ttf/.otf/.woff importieren",
  "appearance.fontHint":
    "Für Prompt-Symbole (Powerlevel10k, starship…) wähle eine <strong>Nerd Font</strong> — z. B. <code>MesloLGS NF</code>.",
  "appearance.fontCurrent": "(aktuell)",
  "appearance.fontImported": "Importiert",
  "appearance.fontSystem": "System (monospace)",
  "appearance.size": "Größe",
  "appearance.cursorBlink": "Blinkender Cursor",
  "appearance.cursorStyle": "Cursor-Stil",
  "cursor.block": "Block",
  "cursor.bar": "Balken",
  "cursor.underline": "Unterstrich",
  "appearance.scrollback": "Scrollback (Zeilen)",
  "appearance.theme": "Design",
  "appearance.ansi": "ANSI-Farben (16)",
  "appearance.reset": "Darstellung zurücksetzen",

  // --- Shell ---
  "shell.program": "Programm",
  "shell.programPlaceholder": "$SHELL (Standard)",
  "shell.args": "Argumente",
  "shell.argsPlaceholder": "z. B. -l",
  "shell.note": "Gilt für <strong>neue</strong> Terminals.",

  // --- Notifications ---
  "notif.enable": "Bei langen Befehlen benachrichtigen",
  "notif.minDuration": "Mindestdauer (s)",
  "notif.sound": "Benachrichtigungston",
  "notif.note":
    "Eine Systembenachrichtigung erscheint, wenn ein Befehl diese Dauer überschreitet <strong>und Lume nicht im Fokus ist</strong>.",

  // --- Keys ---
  "keys.hint":
    "Klicke auf ein Tastenkürzel und drücke die gewünschte Kombination (<kbd>Esc</kbd> zum Abbrechen).",
  "keys.reset": "Tastenkürzel zurücksetzen",
  "keys.recording": "Taste drücken…",
  "keys.fixed": "Feste Tastenkürzel",

  // --- General ---
  "general.language": "Sprache",
  "general.backup": "Einstellungen sichern",
  "general.exportImport": "Gesamte Konfiguration exportieren / importieren",
  "general.export": "Exportieren",
  "general.import": "Importieren",
  "general.exported": "Einstellungen exportiert ✓",
  "general.exportFailed": "Export fehlgeschlagen",
  "general.imported": "Einstellungen importiert ✓",
  "general.importFailed": "Ungültige Datei",

  // --- About ---
  "about.version": "Version",
  "about.updates": "Updates",
  "about.check": "Prüfen",
  "about.checking": "Wird geprüft…",
  "about.uptodate": "Lume ist aktuell ✓",
  "about.checkError": "Prüfung nicht möglich (offline oder kein Release).",
  "about.available": "<strong>Lume {version}</strong> ist verfügbar.",
  "about.installRestart": "Installieren und neu starten",
  "about.downloading": "Wird heruntergeladen… {percent}%",
  "about.updateNote":
    "Updates werden signiert und automatisch installiert (AppImage-Build). Automatische Prüfung beim Start.",

  // --- Toolbar (tab bar) ---
  "toolbar.fileTree": "Dateibaum",
  "toolbar.layouts": "Layout-Vorlagen",
  "toolbar.blocks": "Blöcke (Ctrl+B)",
  "toolbar.workflows": "Workflows (Ctrl+Shift+R)",
  "toolbar.ssh": "SSH (Ctrl+Shift+S)",
  "toolbar.settings": "Einstellungen (Ctrl+,)",
  "toolbar.newTab": "Neu (Ctrl+Shift+T)",
  "toolbar.closeTab": "Schließen (Ctrl+Shift+W)",
  "toolbar.prevTabs": "Vorherige Tabs",
  "toolbar.nextTabs": "Nächste Tabs",
  "toolbar.remoteActive": "Fernsteuerung aktiv — klicken zum Verwalten",

  // --- Layouts popup ---
  "layouts.title": "Layout anwenden",
  "layouts.single": "Einzeln",
  "layouts.twoCols": "2 Spalten",
  "layouts.twoRows": "2 Zeilen",
  "layouts.grid": "2×2-Raster",
  "layouts.mainSide": "Haupt + 2",
  "layouts.tripleCol": "3 Spalten",
  "layouts.note":
    "Das aktive Terminal bleibt im ersten Slot. Die übrigen Shells des Tabs werden geschlossen.",

  // --- Pane context menu ---
  "pane.copy": "⧉ Kopieren (Ctrl+Shift+C)",
  "pane.paste": "⎘ Einfügen (Ctrl+Shift+V)",
  "pane.splitH": "⬌ Horizontal teilen",
  "pane.splitV": "⬍ Vertikal teilen",
  "pane.remote": "⇆ Fernsteuern",
  "pane.newTab": "+ Neuer Tab",
  "pane.close": "× Diesen Bereich schließen",
  "pane.closeTab": " (schließt den Tab)",

  // --- Tab context menu ---
  "tab.rename": "✎ Umbenennen (Doppelklick)",
  "tab.splitH": "⬌ Horizontal teilen (Ctrl+Shift+D)",
  "tab.splitV": "⬍ Vertikal teilen (Ctrl+Shift+E)",
  "tab.newTab": "+ Neuer Tab (Ctrl+Shift+T)",
  "tab.close": "× Diesen Tab schließen",
  "tab.panes": " ({n} Bereiche)",

  // --- File tree ---
  "ft.hidden": "Versteckte Dateien",
  "ft.refresh": "Aktualisieren",
  "ft.close": "Schließen",
  "ft.unknownDir": "Unbekanntes Verzeichnis",
  "ft.denied": "Zugriff verweigert",
  "ft.empty": "leer",
  "ftctx.cd": "Ordner öffnen",
  "ftctx.ls": "Auflisten (ls -la)",
  "ftctx.editor": "Im Editor öffnen",
  "ftctx.cat": "Anzeigen (cat)",
  "ftctx.nano": "Bearbeiten (nano)",
  "ftctx.openEditor": "Öffnen ($EDITOR)",
  "ftctx.copyPath": "Pfad kopieren",
  "ftctx.insertPath": "Pfad einfügen",

  // --- Update banner ---
  "update.available": "<strong>Lume {version}</strong> ist verfügbar",
  "update.failed": "fehlgeschlagen, erneut versuchen",
  "update.install": "Installieren und neu starten",
  "update.later": "Später",
  "update.downloading": "Wird heruntergeladen… {percent}%",

  // --- Remote dialog ---
  "remote.title": "Fernsteuerung",
  "remote.connected": "{n} Gerät(e) verbunden",
  "remote.active": "Aktiv — keine Verbindung",
  "remote.creatingTunnel": "Öffentlicher Tunnel wird erstellt… (einige Sekunden)",
  "remote.starting": "Wird gestartet…",
  "remote.scanPublic": "Scanne den QR oder öffne die URL von überall:",
  "remote.scanLan": "Gleiches lokales Netzwerk — scanne den QR oder öffne die URL:",
  "remote.copy": "Kopieren",
  "remote.installHint":
    "Installiere <code>cloudflared</code>, um außerhalb des lokalen Netzwerks zu steuern.",
  "remote.warn": "⚠️ Jeder mit diesem Link kann dieses Terminal steuern.",
  "remote.installBtn": "Tunnel installieren und aktivieren",
  "remote.installing": "Wird installiert…",
  "remote.stop": "Fernsteuerung beenden",

  // --- Terminal search ---
  "search.placeholder": "Suchen…",
  "search.next": "Weiter",
  "search.prev": "Zurück",
  "search.close": "Schließen",

  // --- Blocks panel ---
  "blocks.title": "Blöcke",
  "blocks.empty": "Noch keine Befehlsblöcke.",
  "blocks.setupTitle": "Befehlsblöcke aktivieren",
  "blocks.copyCmd": "Befehl kopieren",
  "blocks.copyOutput": "Ausgabe kopieren",
  "blocks.rerun": "Erneut ausführen",
  "blocks.remove": "Entfernen",
  "blocks.explain": "Erklären (KI)",

  // --- Terminal search (button titles with shortcuts) ---
  "search.prevTitle": "Zurück (Shift+Enter)",
  "search.nextTitle": "Weiter (Enter)",
  "search.closeTitle": "Schließen (Esc)",
  "term.copyBlock": "Befehl + dessen Ausgabe kopieren",

  // --- Notifications (banner bodies) ---
  "notif.cmdDone": "✓ Befehl abgeschlossen",
  "notif.cmdFailed": "✗ Fehlgeschlagen (Exit {code})",

  // --- AI explain seed prompt ---
  "ai.seedHeader": "Hier ist ein Terminal-Block:",
  "ai.seedCommand": "Befehl: ",
  "ai.seedOutput": "Ausgabe:",
  "ai.seedExitCode": "Exit-Code: ",
  "ai.seedAsk": "Erkläre kurz, was hier passiert.",

  // --- Command palette (AI) ---
  "cmd.placeholder": "Einen Befehl generieren für…",
  "cmd.escCancel": "Esc zum Abbrechen",
  "cmd.noCli":
    "<code>{cmd}</code> nicht im PATH gefunden — richte einen Anbieter unter Einstellungen › KI ein.",
  "cmd.noProvider":
    "Kein KI-Anbieter konfiguriert — richte einen unter Einstellungen › KI ein.",
  "cmd.cancel": "Abbrechen",
  "cmd.insertHint": "<kbd>Enter</kbd> zum Einfügen ins Terminal",
  "cmd.generateHint": "<kbd>Enter</kbd> zum Generieren",
  "cmd.reformulate": "Umformulieren",
  "cmd.insert": "Einfügen",
  "cmd.unknownError": "Unbekannter Fehler",
  "cmd.retry": "Erneut versuchen",

  // --- Workflows palette ---
  "wf.searchPlaceholder": "Workflow suchen…",
  "wf.empty": "Kein Workflow. <code>~/.config/lume/workflows/*.yaml</code>",
  "wf.navHint": "<kbd>↑</kbd><kbd>↓</kbd> navigieren · <kbd>Enter</kbd> wählen",
  "wf.back": "Zurück",
  "wf.preview": "Vorschau",
  "wf.toComplete": "Auszufüllen: {fields}",
  "wf.insertHint": "<kbd>Enter</kbd> zum Einfügen ins Terminal",
  "wf.insert": "Einfügen",

  // --- SSH palette ---
  "ssh.placeholder": "SSH-Host oder user@server…",
  "ssh.noMatch": "Kein passender Host.",
  "ssh.noHosts":
    "Kein Host in <code>~/.ssh/config</code>. Gib einen <code>user@server</code> ein, um dich direkt zu verbinden.",
  "ssh.connectTo": "Verbinden mit",
  "ssh.directConnection": "direkte Verbindung",
  "ssh.navHint":
    "<kbd>↑</kbd><kbd>↓</kbd> navigieren · <kbd>Enter</kbd> verbinden (neuer Tab)",

  // --- Blocks panel (extended) ---
  "blocks.aiThinking": "{provider} denkt nach…",
  "blocks.aiError": "Fehler",
  "blocks.aiClose": "Schließen",
  "blocks.followupPlaceholder": "Anschlussfrage…",
  "blocks.followupWait": "Bitte warten…",
  "blocks.send": "Senden (Enter)",
  "blocks.emptyIntro":
    "Ein <strong>Block</strong> = ein Befehl + dessen Ausgabe + dessen Exit-Code.",
  "blocks.emptyActive":
    "Noch kein Befehl — führe einen aus und er erscheint hier.",
  "blocks.emptyHistory":
    "Der Verlauf erscheint hier, sobald deine Shell OSC 133-Marker ausgibt.",
  "blocks.loading": "Wird geladen…",
  "blocks.addLinePre": "Füge diese Zeile hinzu zu",
  "blocks.addLinePost": "und öffne dann eine neue Shell:",
  "blocks.copy": "Kopieren",
  "blocks.detected":
    "Erkannt: <code>{shell}</code>. Die PTY exportiert <code>LUME_TERM=1</code> — die Quelle wird nur in Lume aktiviert.",
  "blocks.shellUnknown": "unbekannte Shell",
  "blocks.help": "Was ist das?",
  "blocks.helpIntro":
    "Jede Zeile = ein ausgeführter Befehl + dessen Ergebnis. Lume erkennt die Grenzen über OSC 133 (von deiner Shell ausgegebene Marker).",
  "blocks.exitOk": "exit 0",
  "blocks.exitErr": "exit ≠ 0",
  "blocks.exitRunning": "läuft",
  "blocks.helpKeys":
    'Klick → zum Prompt im Terminal scrollen.<br/>Rechtsklick → kopieren, einfügen, erklären.<br/><kbd>Ctrl</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> → navigieren, <kbd>↩</kbd> zum Einfügen ins Terminal.<br/><span style="color: var(--accent)">✨</span> → KI-Erklärung.',
  "blocks.resize": "Ziehen zum Ändern der Größe",
  "blocks.filterPlaceholder": "Blöcke filtern…",
  "blocks.searchClose": "Schließen (Esc)",
  "blocks.hide": "Ausblenden (Ctrl+B)",
  "blocks.clickScroll": "Klick → zum Prompt scrollen",
  "blocks.promptNotTracked": "(Prompt-Zeile nicht erfasst)",
  "blocks.rightClickActions": "Rechtsklick → kopieren, einfügen, erklären…",
  "blocks.promptNoCommand": "(Prompt ohne Befehl)",
  "blocks.outputCopied": "Ausgabe kopiert ✓",
  "blocks.commandCopied": "Befehl kopiert ✓",
  "blocks.outputCaptured": "Ausgabe erfasst — Shift+Klick zum Kopieren",
  "blocks.aiNoCli": "{provider} CLI nicht im PATH gefunden",
  "blocks.aiBlockNotDone": "Der Block muss abgeschlossen sein",
  "blocks.aiNoCommand": "Kein Befehl zum Erklären",
  "blocks.cancel": "Abbrechen",
  "blocks.aiFixError": "Diesen Fehler mit {provider} beheben",
  "blocks.aiExplainBlock": "Diesen Block mit {provider} erklären",
  "blocks.insertTerminal": "Ins Terminal einfügen",
  "blocks.gotoCommand": "Zum Befehl im Terminal springen",
  "blocks.explainClaude": "✨ Mit {provider} erklären",
  "blocks.closeAiPanel": "{provider}-Panel schließen",
  "blocks.removeBlock": "Diesen Block entfernen",

  // --- Keybindings (configurable actions) ---
  "keys.action.newTab": "Neuer Tab",
  "keys.action.closeTab": "Bereich / Tab schließen",
  "keys.action.nextTab": "Nächster Tab",
  "keys.action.prevTab": "Vorheriger Tab",
  "keys.action.splitH": "Horizontal teilen",
  "keys.action.splitV": "Vertikal teilen",
  "keys.action.togglePanel": "Blöcke-Seitenleiste",
  "keys.action.search": "Blöcke filtern",
  "keys.action.termSearch": "Im Terminal suchen",
  "keys.action.paletteAI": "KI-Palette",
  "keys.action.workflows": "Workflows",
  "keys.action.ssh": "SSH",
  "keys.action.copy": "Kopieren",
  "keys.action.paste": "Einfügen",
  "keys.action.settings": "Einstellungen",

  // --- Keybindings (fixed shortcuts) ---
  "keys.fixed.goToTab": "Zu Tab N wechseln",
  "keys.fixed.zoom": "Textzoom (Größe +/-)",
  "keys.fixed.zoomReset": "Standard-Textgröße",
  "keys.fixed.navPanes": "Zwischen Bereichen navigieren (Schleife)",
  "keys.fixed.navBlocks": "Durch Blöcke navigieren",

  // --- Theme colors ---
  "color.background": "Hintergrund",
  "color.foreground": "Text",
  "color.accent": "Akzent",
  "color.cursor": "Cursor",
  "color.selection": "Auswahl",

  // --- Pane ---
  "pane.dragMove": "Ziehen, um diesen Bereich zu verschieben",
  "pane.swap": "Tauschen",
  "pane.moveHere": "Hierher verschieben",

  // --- Autocomplete footer ---
  "ac.complete": "<kbd>Tab</kbd> vervollständigen",
  "ac.navigate": "<kbd>↑</kbd><kbd>↓</kbd> navigieren",
  "ac.close": "<kbd>Esc</kbd> schließen",

  // --- AI provider settings ---
  "nav.ai": "KI",
  "ai.provider": "Anbieter",
  "ai.custom": "Benutzerdefiniert (CLI)",
  "ai.model": "Modell",
  "ai.modelHint": "Standard",
  "ai.status": "Status",
  "ai.detected": "✓ {cmd} erkannt",
  "ai.notFound": "✗ {cmd} nicht im PATH gefunden",
  "ai.apiKey": "API-Schlüssel",
  "ai.command": "Befehl",
  "ai.args": "Argumente",
  "ai.keyEnv": "Umgebungsvariable für API-Schlüssel",
  "ai.claudeNote": "Verwendet die <code>claude</code>-CLI (Claude Code). Führe einmalig <code>claude login</code> aus, um dich zu authentifizieren.",
  "ai.codexNote": "Verwendet die <code>codex</code>-CLI (OpenAI). Authentifiziere dich mit <code>codex login</code> oder lege oben einen API-Schlüssel fest (wird als <code>OPENAI_API_KEY</code> eingefügt).",
  "ai.customNote": "Jede CLI, die einen Prompt entgegennimmt und die Antwort auf stdout ausgibt. Setze <code>{prompt}</code> in die Argumente, wo der Prompt eingefügt werden soll.",
  "ai.keysNote": "API-Schlüssel werden lokal in <code>~/.config/lume/config.toml</code> gespeichert und vom Einstellungs-Export ausgeschlossen.",
  "ai.customApi": "OpenAI-kompatible API",
  "ai.baseUrl": "Basis-URL",
  "ai.configured": "✓ konfiguriert",
  "ai.missingKey": "✗ API-Schlüssel erforderlich",
  "ai.openaiNote": "Verwendet die OpenAI-API. Erstelle einen Schlüssel unter <code>platform.openai.com</code>.",
  "ai.deepseekNote": "Verwendet die DeepSeek-API (OpenAI-kompatibel). Schlüssel unter <code>platform.deepseek.com</code>.",
  "ai.apiNote": "Jeder OpenAI-kompatible Endpunkt (Ollama, Groq, OpenRouter…). Lege Basis-URL, Schlüssel und Modell fest.",
};
