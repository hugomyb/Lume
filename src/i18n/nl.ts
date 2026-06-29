import type { Dict } from "../i18n";

export const nl: Dict = {
  // --- Settings: nav + general ---
  "settings.title": "Instellingen",
  "settings.close": "Sluiten (Esc)",
  "nav.appearance": "Weergave",
  "nav.shell": "Shell",
  "nav.notifications": "Meldingen",
  "nav.remote": "Remote",
  "nav.keys": "Sneltoetsen",
  "nav.general": "Algemeen",
  "nav.about": "Over",

  // --- Appearance ---
  "appearance.font": "Lettertype",
  "appearance.import": "Importeren",
  "appearance.importTitle": "Een .ttf/.otf/.woff importeren",
  "appearance.fontHint":
    "Kies voor prompt-iconen (Powerlevel10k, starship…) een <strong>Nerd Font</strong> — bijv. <code>MesloLGS NF</code>.",
  "appearance.fontCurrent": "(huidig)",
  "appearance.fontImported": "Geïmporteerd",
  "appearance.fontSystem": "Systeem (monospace)",
  "appearance.size": "Grootte",
  "appearance.cursorBlink": "Knipperende cursor",
  "appearance.cursorStyle": "Cursorstijl",
  "cursor.block": "Blok",
  "cursor.bar": "Streep",
  "cursor.underline": "Onderstreping",
  "appearance.scrollback": "Scrollback (regels)",
  "appearance.theme": "Thema",
  "appearance.ansi": "ANSI-kleuren (16)",
  "appearance.reset": "Weergave herstellen",

  // --- Shell ---
  "shell.program": "Programma",
  "shell.programPlaceholder": "$SHELL (standaard)",
  "shell.args": "Argumenten",
  "shell.argsPlaceholder": "bijv. -l",
  "shell.note": "Geldt voor <strong>nieuwe</strong> terminals.",

  // --- Notifications ---
  "notif.enable": "Melden bij lange commando's",
  "notif.minDuration": "Minimale duur (s)",
  "notif.sound": "Meldingsgeluid",
  "notif.note":
    "Er verschijnt een systeemmelding wanneer een commando deze duur overschrijdt <strong>en Lume niet actief is</strong>.",

  // --- Keys ---
  "keys.hint":
    "Klik op een sneltoets en druk dan op de gewenste combinatie (<kbd>Esc</kbd> om te annuleren).",
  "keys.reset": "Sneltoetsen herstellen",
  "keys.recording": "Druk op een toets…",
  "keys.fixed": "Vaste sneltoetsen",

  // --- General ---
  "general.language": "Taal",
  "general.backup": "Back-up van instellingen",
  "general.exportImport": "De hele configuratie exporteren / importeren",
  "general.export": "Exporteren",
  "general.import": "Importeren",
  "general.exported": "Instellingen geëxporteerd ✓",
  "general.exportFailed": "Exporteren mislukt",
  "general.imported": "Instellingen geïmporteerd ✓",
  "general.importFailed": "Ongeldig bestand",

  // --- About ---
  "about.version": "Versie",
  "about.updates": "Updates",
  "about.check": "Controleren",
  "about.checking": "Controleren…",
  "about.uptodate": "Lume is up-to-date ✓",
  "about.checkError": "Controleren mislukt (offline of geen release).",
  "about.available": "<strong>Lume {version}</strong> is beschikbaar.",
  "about.installRestart": "Installeren en herstarten",
  "about.downloading": "Downloaden… {percent}%",
  "about.updateNote":
    "Updates worden ondertekend en automatisch geïnstalleerd (AppImage-build). Automatische controle bij het opstarten.",

  // --- Toolbar (tab bar) ---
  "toolbar.fileTree": "Bestandsstructuur",
  "toolbar.layouts": "Lay-outvoorinstellingen",
  "toolbar.blocks": "Blokken (Ctrl+B)",
  "toolbar.workflows": "Workflows (Ctrl+Shift+R)",
  "toolbar.ssh": "SSH (Ctrl+Shift+S)",
  "toolbar.settings": "Instellingen (Ctrl+,)",
  "toolbar.newTab": "Nieuw (Ctrl+Shift+T)",
  "toolbar.closeTab": "Sluiten (Ctrl+Shift+W)",
  "toolbar.prevTabs": "Vorige tabbladen",
  "toolbar.nextTabs": "Volgende tabbladen",
  "toolbar.remoteActive": "Bediening op afstand actief — klik om te beheren",

  // --- Layouts popup ---
  "layouts.title": "Een lay-out toepassen",
  "layouts.single": "Enkel",
  "layouts.twoCols": "2 kolommen",
  "layouts.twoRows": "2 rijen",
  "layouts.grid": "2×2-raster",
  "layouts.mainSide": "Hoofd + 2",
  "layouts.tripleCol": "3 kolommen",
  "layouts.note":
    "De actieve terminal blijft in de eerste positie staan. De andere shells van het tabblad worden gesloten.",

  // --- Pane context menu ---
  "pane.copy": "⧉ Kopiëren (Ctrl+Shift+C)",
  "pane.paste": "⎘ Plakken (Ctrl+Shift+V)",
  "pane.splitH": "⬌ Horizontaal splitsen",
  "pane.splitV": "⬍ Verticaal splitsen",
  "pane.remote": "⇆ Op afstand bedienen",
  "pane.newTab": "+ Nieuw tabblad",
  "pane.close": "× Dit deelvenster sluiten",
  "pane.closeTab": " (sluit het tabblad)",

  // --- Tab context menu ---
  "tab.rename": "✎ Hernoemen (dubbelklik)",
  "tab.splitH": "⬌ Horizontaal splitsen (Ctrl+Shift+D)",
  "tab.splitV": "⬍ Verticaal splitsen (Ctrl+Shift+E)",
  "tab.newTab": "+ Nieuw tabblad (Ctrl+Shift+T)",
  "tab.close": "× Dit tabblad sluiten",
  "tab.panes": " ({n} deelvensters)",

  // --- File tree ---
  "ft.hidden": "Verborgen bestanden",
  "ft.refresh": "Vernieuwen",
  "ft.close": "Sluiten",
  "ft.unknownDir": "Onbekende map",
  "ft.denied": "toegang geweigerd",
  "ft.empty": "leeg",
  "ftctx.cd": "Map openen",
  "ftctx.ls": "Lijst (ls -la)",
  "ftctx.editor": "Openen in editor",
  "ftctx.cat": "Weergeven (cat)",
  "ftctx.nano": "Bewerken (nano)",
  "ftctx.openEditor": "Openen ($EDITOR)",
  "ftctx.copyPath": "Pad kopiëren",
  "ftctx.insertPath": "Pad invoegen",

  // --- Update banner ---
  "update.available": "<strong>Lume {version}</strong> is beschikbaar",
  "update.failed": "mislukt, opnieuw",
  "update.install": "Installeren en herstarten",
  "update.later": "Later",
  "update.downloading": "Downloaden… {percent}%",

  // --- Remote dialog ---
  "remote.title": "Bediening op afstand",
  "remote.connected": "{n} apparaat/apparaten verbonden",
  "remote.active": "Actief — geen verbinding",
  "remote.creatingTunnel": "Openbare tunnel aanmaken… (een paar seconden)",
  "remote.starting": "Starten…",
  "remote.scanPublic": "Scan de QR of open de URL vanaf overal:",
  "remote.scanLan": "Zelfde lokale netwerk — scan de QR of open de URL:",
  "remote.copy": "Kopiëren",
  "remote.installHint":
    "Installeer <code>cloudflared</code> om buiten het lokale netwerk te bedienen.",
  "remote.warn": "⚠️ Iedereen met deze link kan deze terminal bedienen.",
  "remote.installBtn": "Tunnel installeren en inschakelen",
  "remote.installing": "Installeren…",
  "remote.stop": "Bediening op afstand stoppen",

  // --- Terminal search ---
  "search.placeholder": "Zoeken…",
  "search.next": "Volgende",
  "search.prev": "Vorige",
  "search.close": "Sluiten",

  // --- Blocks panel ---
  "blocks.title": "Blokken",
  "blocks.empty": "Nog geen commandoblokken.",
  "blocks.setupTitle": "Commandoblokken inschakelen",
  "blocks.copyCmd": "Commando kopiëren",
  "blocks.copyOutput": "Uitvoer kopiëren",
  "blocks.rerun": "Opnieuw uitvoeren",
  "blocks.remove": "Verwijderen",
  "blocks.explain": "Uitleggen (AI)",

  // --- Terminal search (button titles with shortcuts) ---
  "search.prevTitle": "Vorige (Shift+Enter)",
  "search.nextTitle": "Volgende (Enter)",
  "search.closeTitle": "Sluiten (Esc)",
  "term.copyBlock": "Het commando + de uitvoer kopiëren",

  // --- Notifications (banner bodies) ---
  "notif.cmdDone": "✓ Commando voltooid",
  "notif.cmdFailed": "✗ Mislukt (exit {code})",

  // --- AI explain seed prompt ---
  "ai.seedHeader": "Hier is een terminalblok:",
  "ai.seedCommand": "Commando: ",
  "ai.seedOutput": "Uitvoer:",
  "ai.seedExitCode": "Exitcode: ",
  "ai.seedAsk": "Leg kort uit wat er gebeurt.",

  // --- Command palette (AI) ---
  "cmd.placeholder": "Genereer een commando voor…",
  "cmd.escCancel": "Esc om te annuleren",
  "cmd.noCli":
    "<code>{cmd}</code> niet gevonden in PATH — stel een provider in via Instellingen › AI.",
  "cmd.noProvider":
    "Geen AI-provider geconfigureerd — stel er een in via Instellingen › AI.",
  "cmd.cancel": "Annuleren",
  "cmd.insertHint": "<kbd>Enter</kbd> om in te voegen in de terminal",
  "cmd.generateHint": "<kbd>Enter</kbd> om te genereren",
  "cmd.reformulate": "Herformuleren",
  "cmd.insert": "Invoegen",
  "cmd.unknownError": "Onbekende fout",
  "cmd.retry": "Opnieuw",

  // --- Workflows palette ---
  "wf.searchPlaceholder": "Zoek een workflow…",
  "wf.empty": "Geen workflow. <code>~/.config/lume/workflows/*.yaml</code>",
  "wf.navHint": "<kbd>↑</kbd><kbd>↓</kbd> navigeren · <kbd>Enter</kbd> kiezen",
  "wf.back": "Terug",
  "wf.preview": "Voorbeeld",
  "wf.toComplete": "In te vullen: {fields}",
  "wf.insertHint": "<kbd>Enter</kbd> om in te voegen in de terminal",
  "wf.insert": "Invoegen",

  // --- SSH palette ---
  "ssh.placeholder": "SSH-host of user@server…",
  "ssh.noMatch": "Geen overeenkomende host.",
  "ssh.noHosts":
    "Geen host in <code>~/.ssh/config</code>. Typ een <code>user@server</code> om direct te verbinden.",
  "ssh.connectTo": "Verbinden met",
  "ssh.directConnection": "directe verbinding",
  "ssh.navHint":
    "<kbd>↑</kbd><kbd>↓</kbd> navigeren · <kbd>Enter</kbd> verbinden (nieuw tabblad)",

  // --- Blocks panel (extended) ---
  "blocks.aiThinking": "{provider} denkt na…",
  "blocks.aiError": "Fout",
  "blocks.aiClose": "Sluiten",
  "blocks.followupPlaceholder": "Vervolgvraag…",
  "blocks.followupWait": "Even geduld…",
  "blocks.send": "Verzenden (Enter)",
  "blocks.emptyIntro":
    "Een <strong>blok</strong> = een commando + de uitvoer + de exitcode.",
  "blocks.emptyActive": "Nog geen commando — voer er een uit en het verschijnt hier.",
  "blocks.emptyHistory":
    "De geschiedenis verschijnt hier zodra je shell OSC 133-markeringen uitstuurt.",
  "blocks.loading": "Laden…",
  "blocks.addLinePre": "Voeg deze regel toe aan",
  "blocks.addLinePost": "open dan een nieuwe shell:",
  "blocks.copy": "Kopiëren",
  "blocks.detected":
    "Gedetecteerd: <code>{shell}</code>. De PTY exporteert <code>LUME_TERM=1</code> — de source wordt alleen geactiveerd binnen Lume.",
  "blocks.shellUnknown": "onbekende shell",
  "blocks.help": "Wat is dit?",
  "blocks.helpIntro":
    "Elke regel = een uitgevoerd commando + het resultaat. Lume detecteert de grenzen via OSC 133 (markeringen die je shell uitstuurt).",
  "blocks.exitOk": "exit 0",
  "blocks.exitErr": "exit ≠ 0",
  "blocks.exitRunning": "bezig",
  "blocks.helpKeys":
    'Klik → scroll naar de prompt in de terminal.<br/>Rechtsklik → kopiëren, invoegen, uitleggen.<br/><kbd>Ctrl</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> → navigeren, <kbd>↩</kbd> om in te voegen in de terminal.<br/><span style="color: var(--accent)">✨</span> → uitleg van AI.',
  "blocks.resize": "Sleep om formaat te wijzigen",
  "blocks.filterPlaceholder": "Blokken filteren…",
  "blocks.searchClose": "Sluiten (Esc)",
  "blocks.hide": "Verbergen (Ctrl+B)",
  "blocks.clickScroll": "Klik → scroll naar de prompt",
  "blocks.promptNotTracked": "(promptregel niet bijgehouden)",
  "blocks.rightClickActions": "Rechtsklik → kopiëren, invoegen, uitleggen…",
  "blocks.promptNoCommand": "(prompt zonder commando)",
  "blocks.outputCopied": "Uitvoer gekopieerd ✓",
  "blocks.commandCopied": "Commando gekopieerd ✓",
  "blocks.outputCaptured": "Uitvoer vastgelegd — Shift+Klik om te kopiëren",
  "blocks.aiNoCli": "{provider} CLI niet gevonden in PATH",
  "blocks.aiBlockNotDone": "Het blok moet voltooid zijn",
  "blocks.aiNoCommand": "Geen commando om uit te leggen",
  "blocks.cancel": "Annuleren",
  "blocks.aiFixError": "Deze fout oplossen met {provider}",
  "blocks.aiExplainBlock": "Dit blok uitleggen met {provider}",
  "blocks.insertTerminal": "Invoegen in de terminal",
  "blocks.gotoCommand": "Naar het commando in de terminal gaan",
  "blocks.explainClaude": "✨ Uitleggen met {provider}",
  "blocks.closeAiPanel": "Het {provider}-paneel sluiten",
  "blocks.removeBlock": "Dit blok verwijderen",

  // --- Keybindings (configurable actions) ---
  "keys.action.newTab": "Nieuw tabblad",
  "keys.action.closeTab": "Deelvenster / tabblad sluiten",
  "keys.action.nextTab": "Volgend tabblad",
  "keys.action.prevTab": "Vorig tabblad",
  "keys.action.splitH": "Horizontaal splitsen",
  "keys.action.splitV": "Verticaal splitsen",
  "keys.action.togglePanel": "Blokkenzijbalk",
  "keys.action.search": "Blokken filteren",
  "keys.action.termSearch": "Zoeken in terminal",
  "keys.action.paletteAI": "AI-palet",
  "keys.action.workflows": "Workflows",
  "keys.action.ssh": "SSH",
  "keys.action.copy": "Kopiëren",
  "keys.action.paste": "Plakken",
  "keys.action.settings": "Instellingen",

  // --- Keybindings (fixed shortcuts) ---
  "keys.fixed.goToTab": "Naar tabblad N gaan",
  "keys.fixed.zoom": "Tekst inzoomen (grootte +/-)",
  "keys.fixed.zoomReset": "Standaard tekstgrootte",
  "keys.fixed.navPanes": "Navigeren tussen deelvensters (lus)",
  "keys.fixed.navBlocks": "Navigeren door blokken",

  // --- Theme colors ---
  "color.background": "Achtergrond",
  "color.foreground": "Tekst",
  "color.accent": "Accent",
  "color.cursor": "Cursor",
  "color.selection": "Selectie",

  // --- Pane ---
  "pane.dragMove": "Sleep om dit deelvenster te verplaatsen",
  "pane.swap": "Wisselen",
  "pane.moveHere": "Hierheen verplaatsen",

  // --- Autocomplete footer ---
  "ac.complete": "<kbd>Tab</kbd> aanvullen",
  "ac.navigate": "<kbd>↑</kbd><kbd>↓</kbd> navigeren",
  "ac.close": "<kbd>Esc</kbd> sluiten",

  // --- AI provider settings ---
  "nav.ai": "AI",
  "ai.provider": "Provider",
  "ai.custom": "Aangepast (CLI)",
  "ai.model": "Model",
  "ai.modelHint": "standaard",
  "ai.status": "Status",
  "ai.detected": "✓ {cmd} gedetecteerd",
  "ai.notFound": "✗ {cmd} niet gevonden in PATH",
  "ai.recheck": "Opnieuw controleren",
  "ai.apiKey": "API-sleutel",
  "ai.command": "Opdracht",
  "ai.args": "Argumenten",
  "ai.keyEnv": "Omgevingsvariabele voor API-sleutel",
  "ai.claudeNote": "Gebruikt de <code>claude</code>-CLI (Claude Code). Voer eenmalig <code>claude login</code> uit om te authenticeren.",
  "ai.codexNote": "Gebruikt de <code>codex</code>-CLI (OpenAI). Authenticeer met <code>codex login</code> of stel hierboven een API-sleutel in (geïnjecteerd als <code>OPENAI_API_KEY</code>).",
  "ai.customNote": "Elke CLI die een prompt aanneemt en het antwoord naar stdout afdrukt. Plaats <code>{prompt}</code> in de argumenten waar de prompt moet komen.",
  "ai.keysNote": "API-sleutels worden lokaal opgeslagen in <code>~/.config/lume/config.toml</code> en worden uitgesloten van de export van instellingen.",
  "ai.customApi": "OpenAI-compatibele API",
  "ai.baseUrl": "Basis-URL",
  "ai.configured": "✓ geconfigureerd",
  "ai.missingKey": "✗ API-sleutel vereist",
  "ai.openaiNote": "Gebruikt de OpenAI-API. Maak een sleutel aan op <code>platform.openai.com</code>.",
  "ai.deepseekNote": "Gebruikt de DeepSeek-API (OpenAI-compatibel). Sleutel op <code>platform.deepseek.com</code>.",
  "ai.apiNote": "Elk OpenAI-compatibel eindpunt (Ollama, Groq, OpenRouter…). Stel de basis-URL, sleutel en het model in.",
};
