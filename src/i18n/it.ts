import type { Dict } from "../i18n";

export const it: Dict = {
  // --- Settings: nav + general ---
  "settings.title": "Impostazioni",
  "settings.close": "Chiudi (Esc)",
  "nav.appearance": "Aspetto",
  "nav.shell": "Shell",
  "nav.notifications": "Notifiche",
  "nav.remote": "Remote",
  "nav.keys": "Scorciatoie",
  "nav.general": "Generale",
  "nav.about": "Informazioni",

  // --- Appearance ---
  "appearance.font": "Carattere",
  "appearance.import": "Importa",
  "appearance.importTitle": "Importa un .ttf/.otf/.woff",
  "appearance.fontHint":
    "Per le icone del prompt (Powerlevel10k, starship…), scegli un <strong>Nerd Font</strong> — es. <code>MesloLGS NF</code>.",
  "appearance.fontCurrent": "(attuale)",
  "appearance.fontImported": "Importati",
  "appearance.fontSystem": "Sistema (monospazio)",
  "appearance.size": "Dimensione",
  "appearance.cursorBlink": "Cursore lampeggiante",
  "appearance.cursorStyle": "Stile del cursore",
  "cursor.block": "Blocco",
  "cursor.bar": "Barra",
  "cursor.underline": "Sottolineato",
  "appearance.scrollback": "Scrollback (righe)",
  "appearance.theme": "Tema",
  "appearance.ansi": "Colori ANSI (16)",
  "appearance.reset": "Ripristina aspetto",

  // --- Shell ---
  "shell.program": "Programma",
  "shell.programPlaceholder": "$SHELL (predefinito)",
  "shell.args": "Argomenti",
  "shell.argsPlaceholder": "es. -l",
  "shell.note": "Si applica ai <strong>nuovi</strong> terminali.",

  // --- Notifications ---
  "notif.enable": "Notifica i comandi lunghi",
  "notif.minDuration": "Durata minima (s)",
  "notif.sound": "Suono della notifica",
  "notif.note":
    "Una notifica di sistema appare quando un comando supera questa durata <strong>e Lume non è in primo piano</strong>.",

  // --- Keys ---
  "keys.hint":
    "Clicca una scorciatoia poi premi la combinazione desiderata (<kbd>Esc</kbd> per annullare).",
  "keys.reset": "Ripristina scorciatoie",
  "keys.recording": "Premi un tasto…",
  "keys.fixed": "Scorciatoie fisse",

  // --- General ---
  "general.language": "Lingua",
  "general.backup": "Backup delle impostazioni",
  "general.exportImport": "Esporta / importa l'intera configurazione",
  "general.export": "Esporta",
  "general.import": "Importa",
  "general.exported": "Impostazioni esportate ✓",
  "general.exportFailed": "Esportazione non riuscita",
  "general.imported": "Impostazioni importate ✓",
  "general.importFailed": "File non valido",

  // --- About ---
  "about.version": "Versione",
  "about.updates": "Aggiornamenti",
  "about.check": "Verifica",
  "about.checking": "Verifica in corso…",
  "about.uptodate": "Lume è aggiornato ✓",
  "about.checkError": "Impossibile verificare (offline o nessuna release).",
  "about.available": "<strong>Lume {version}</strong> è disponibile.",
  "about.installRestart": "Installa e riavvia",
  "about.downloading": "Download… {percent}%",
  "about.updateNote":
    "Gli aggiornamenti sono firmati e installati automaticamente (build AppImage). Verifica automatica all'avvio.",

  // --- Toolbar (tab bar) ---
  "toolbar.fileTree": "Albero dei file",
  "toolbar.layouts": "Layout predefiniti",
  "toolbar.blocks": "Blocchi (Ctrl+B)",
  "toolbar.workflows": "Workflows (Ctrl+Shift+R)",
  "toolbar.ssh": "SSH (Ctrl+Shift+S)",
  "toolbar.settings": "Impostazioni (Ctrl+,)",
  "toolbar.newTab": "Nuova (Ctrl+Shift+T)",
  "toolbar.closeTab": "Chiudi (Ctrl+Shift+W)",
  "toolbar.prevTabs": "Schede precedenti",
  "toolbar.nextTabs": "Schede successive",
  "toolbar.remoteActive": "Controllo remoto attivo — clicca per gestire",

  // --- Layouts popup ---
  "layouts.title": "Applica un layout",
  "layouts.single": "Singolo",
  "layouts.twoCols": "2 colonne",
  "layouts.twoRows": "2 righe",
  "layouts.grid": "Griglia 2×2",
  "layouts.mainSide": "Principale + 2",
  "layouts.tripleCol": "3 colonne",
  "layouts.note":
    "Il terminale attivo viene mantenuto nel primo slot. Le altre shell della scheda vengono chiuse.",

  // --- Pane context menu ---
  "pane.copy": "⧉ Copia (Ctrl+Shift+C)",
  "pane.paste": "⎘ Incolla (Ctrl+Shift+V)",
  "pane.splitH": "⬌ Dividi orizzontalmente",
  "pane.splitV": "⬍ Dividi verticalmente",
  "pane.remote": "⇆ Controlla da remoto",
  "pane.newTab": "+ Nuova scheda",
  "pane.close": "× Chiudi questo pannello",
  "pane.closeTab": " (chiude la scheda)",

  // --- Tab context menu ---
  "tab.rename": "✎ Rinomina (doppio clic)",
  "tab.splitH": "⬌ Dividi orizzontalmente (Ctrl+Shift+D)",
  "tab.splitV": "⬍ Dividi verticalmente (Ctrl+Shift+E)",
  "tab.newTab": "+ Nuova scheda (Ctrl+Shift+T)",
  "tab.close": "× Chiudi questa scheda",
  "tab.panes": " ({n} pannelli)",

  // --- File tree ---
  "ft.hidden": "File nascosti",
  "ft.refresh": "Aggiorna",
  "ft.close": "Chiudi",
  "ft.unknownDir": "Cartella sconosciuta",
  "ft.denied": "accesso negato",
  "ft.empty": "vuota",
  "ftctx.cd": "Apri cartella",
  "ftctx.ls": "Elenca (ls -la)",
  "ftctx.editor": "Apri nell'editor",
  "ftctx.cat": "Visualizza (cat)",
  "ftctx.nano": "Modifica (nano)",
  "ftctx.openEditor": "Apri ($EDITOR)",
  "ftctx.copyPath": "Copia percorso",
  "ftctx.insertPath": "Inserisci percorso",

  // --- Update banner ---
  "update.available": "<strong>Lume {version}</strong> è disponibile",
  "update.failed": "non riuscito, riprova",
  "update.install": "Installa e riavvia",
  "update.later": "Più tardi",
  "update.downloading": "Download… {percent}%",

  // --- Remote dialog ---
  "remote.title": "Controllo remoto",
  "remote.connected": "{n} dispositivo/i connesso/i",
  "remote.active": "Attivo — nessuna connessione",
  "remote.creatingTunnel": "Creazione del tunnel pubblico… (qualche secondo)",
  "remote.starting": "Avvio…",
  "remote.scanPublic": "Scansiona il QR o apri l'URL da qualsiasi luogo:",
  "remote.scanLan": "Stessa rete locale — scansiona il QR o apri l'URL:",
  "remote.copy": "Copia",
  "remote.installHint":
    "Installa <code>cloudflared</code> per controllare dall'esterno della rete locale.",
  "remote.warn": "⚠️ Chiunque abbia questo link può controllare questo terminale.",
  "remote.installBtn": "Installa e abilita il tunnel",
  "remote.installing": "Installazione…",
  "remote.stop": "Interrompi il controllo remoto",

  // --- Terminal search ---
  "search.placeholder": "Cerca…",
  "search.next": "Successivo",
  "search.prev": "Precedente",
  "search.close": "Chiudi",

  // --- Blocks panel ---
  "blocks.title": "Blocchi",
  "blocks.empty": "Ancora nessun blocco di comandi.",
  "blocks.setupTitle": "Abilita i blocchi di comandi",
  "blocks.copyCmd": "Copia comando",
  "blocks.copyOutput": "Copia output",
  "blocks.rerun": "Riesegui",
  "blocks.remove": "Rimuovi",
  "blocks.explain": "Spiega (IA)",

  // --- Terminal search (button titles with shortcuts) ---
  "search.prevTitle": "Precedente (Shift+Enter)",
  "search.nextTitle": "Successivo (Enter)",
  "search.closeTitle": "Chiudi (Esc)",
  "term.copyBlock": "Copia il comando + il suo output",

  // --- Notifications (banner bodies) ---
  "notif.cmdDone": "✓ Comando completato",
  "notif.cmdFailed": "✗ Non riuscito (exit {code})",

  // --- AI explain seed prompt ---
  "ai.seedHeader": "Ecco un blocco di terminale:",
  "ai.seedCommand": "Comando: ",
  "ai.seedOutput": "Output:",
  "ai.seedExitCode": "Codice di uscita: ",
  "ai.seedAsk": "Spiega brevemente cosa sta succedendo.",

  // --- Command palette (AI) ---
  "cmd.placeholder": "Genera un comando per…",
  "cmd.escCancel": "Esc per annullare",
  "cmd.noCli":
    "<code>{cmd}</code> non trovato nel PATH — configura un provider in Impostazioni › IA.",
  "cmd.noProvider":
    "Nessun provider IA configurato — configurane uno in Impostazioni › IA.",
  "cmd.cancel": "Annulla",
  "cmd.insertHint": "<kbd>Enter</kbd> per inserire nel terminale",
  "cmd.generateHint": "<kbd>Enter</kbd> per generare",
  "cmd.reformulate": "Riformula",
  "cmd.insert": "Inserisci",
  "cmd.unknownError": "Errore sconosciuto",
  "cmd.retry": "Riprova",

  // --- Workflows palette ---
  "wf.searchPlaceholder": "Cerca un workflow…",
  "wf.empty": "Nessun workflow. <code>~/.config/lume/workflows/*.yaml</code>",
  "wf.navHint": "<kbd>↑</kbd><kbd>↓</kbd> naviga · <kbd>Enter</kbd> scegli",
  "wf.back": "Indietro",
  "wf.preview": "Anteprima",
  "wf.toComplete": "Da completare: {fields}",
  "wf.insertHint": "<kbd>Enter</kbd> per inserire nel terminale",
  "wf.insert": "Inserisci",

  // --- SSH palette ---
  "ssh.placeholder": "Host SSH o utente@server…",
  "ssh.noMatch": "Nessun host corrispondente.",
  "ssh.noHosts":
    "Nessun host in <code>~/.ssh/config</code>. Digita un <code>user@server</code> per connetterti direttamente.",
  "ssh.connectTo": "Connetti a",
  "ssh.directConnection": "connessione diretta",
  "ssh.navHint":
    "<kbd>↑</kbd><kbd>↓</kbd> naviga · <kbd>Enter</kbd> connetti (nuova scheda)",

  // --- Blocks panel (extended) ---
  "blocks.aiThinking": "{provider} sta pensando…",
  "blocks.aiError": "Errore",
  "blocks.aiClose": "Chiudi",
  "blocks.followupPlaceholder": "Domanda di approfondimento…",
  "blocks.followupWait": "Attendi…",
  "blocks.send": "Invia (Enter)",
  "blocks.emptyIntro":
    "Un <strong>blocco</strong> = un comando + il suo output + il suo codice di uscita.",
  "blocks.emptyActive": "Ancora nessun comando — eseguine uno e apparirà qui.",
  "blocks.emptyHistory":
    "La cronologia apparirà qui non appena la tua shell emette i marker OSC 133.",
  "blocks.loading": "Caricamento…",
  "blocks.addLinePre": "Aggiungi questa riga a",
  "blocks.addLinePost": "poi apri una nuova shell:",
  "blocks.copy": "Copia",
  "blocks.detected":
    "Rilevato: <code>{shell}</code>. Il PTY esporta <code>LUME_TERM=1</code> — il source si attiva solo dentro Lume.",
  "blocks.shellUnknown": "shell sconosciuta",
  "blocks.help": "Cos'è questo?",
  "blocks.helpIntro":
    "Ogni riga = un comando eseguito + il suo risultato. Lume rileva i confini tramite OSC 133 (marker emessi dalla tua shell).",
  "blocks.exitOk": "exit 0",
  "blocks.exitErr": "exit ≠ 0",
  "blocks.exitRunning": "in esecuzione",
  "blocks.helpKeys":
    'Clic → scorri fino al prompt nel terminale.<br/>Clic destro → copia, inserisci, spiega.<br/><kbd>Ctrl</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> → naviga, <kbd>↩</kbd> per inserire nel terminale.<br/><span style="color: var(--accent)">✨</span> → spiegazione di IA.',
  "blocks.resize": "Trascina per ridimensionare",
  "blocks.filterPlaceholder": "Filtra i blocchi…",
  "blocks.searchClose": "Chiudi (Esc)",
  "blocks.hide": "Nascondi (Ctrl+B)",
  "blocks.clickScroll": "Clic → scorri fino al prompt",
  "blocks.promptNotTracked": "(riga del prompt non tracciata)",
  "blocks.rightClickActions": "Clic destro → copia, inserisci, spiega…",
  "blocks.promptNoCommand": "(prompt senza comando)",
  "blocks.outputCopied": "Output copiato ✓",
  "blocks.commandCopied": "Comando copiato ✓",
  "blocks.outputCaptured": "Output catturato — Shift+Clic per copiarlo",
  "blocks.aiNoCli": "CLI di {provider} non trovato nel PATH",
  "blocks.aiBlockNotDone": "Il blocco deve essere completato",
  "blocks.aiNoCommand": "Nessun comando da spiegare",
  "blocks.cancel": "Annulla",
  "blocks.aiFixError": "Correggi questo errore con {provider}",
  "blocks.aiExplainBlock": "Spiega questo blocco con {provider}",
  "blocks.insertTerminal": "Inserisci nel terminale",
  "blocks.gotoCommand": "Vai al comando nel terminale",
  "blocks.explainClaude": "✨ Spiega con {provider}",
  "blocks.closeAiPanel": "Chiudi il pannello di {provider}",
  "blocks.removeBlock": "Rimuovi questo blocco",

  // --- Keybindings (configurable actions) ---
  "keys.action.newTab": "Nuova scheda",
  "keys.action.closeTab": "Chiudi pannello / scheda",
  "keys.action.nextTab": "Scheda successiva",
  "keys.action.prevTab": "Scheda precedente",
  "keys.action.splitH": "Dividi orizzontalmente",
  "keys.action.splitV": "Dividi verticalmente",
  "keys.action.togglePanel": "Barra laterale dei blocchi",
  "keys.action.search": "Filtra i blocchi",
  "keys.action.termSearch": "Cerca nel terminale",
  "keys.action.paletteAI": "Palette IA",
  "keys.action.workflows": "Workflows",
  "keys.action.ssh": "SSH",
  "keys.action.copy": "Copia",
  "keys.action.paste": "Incolla",
  "keys.action.settings": "Impostazioni",

  // --- Keybindings (fixed shortcuts) ---
  "keys.fixed.goToTab": "Vai alla scheda N",
  "keys.fixed.zoom": "Zoom del testo (dimensione +/-)",
  "keys.fixed.zoomReset": "Dimensione testo predefinita",
  "keys.fixed.navPanes": "Naviga tra i pannelli (ciclo)",
  "keys.fixed.navBlocks": "Naviga tra i blocchi",

  // --- Theme colors ---
  "color.background": "Sfondo",
  "color.foreground": "Testo",
  "color.accent": "Accento",
  "color.cursor": "Cursore",
  "color.selection": "Selezione",

  // --- Pane ---
  "pane.dragMove": "Trascina per spostare questo pannello",
  "pane.swap": "Scambia",
  "pane.moveHere": "Sposta qui",

  // --- Autocomplete footer ---
  "ac.complete": "<kbd>Tab</kbd> completa",
  "ac.navigate": "<kbd>↑</kbd><kbd>↓</kbd> naviga",
  "ac.close": "<kbd>Esc</kbd> chiudi",

  // --- AI provider settings ---
  "nav.ai": "IA",
  "ai.provider": "Provider",
  "ai.custom": "Personalizzato (CLI)",
  "ai.model": "Modello",
  "ai.modelHint": "predefinito",
  "ai.status": "Stato",
  "ai.detected": "✓ {cmd} rilevato",
  "ai.notFound": "✗ {cmd} non trovato nel PATH",
  "ai.apiKey": "Chiave API",
  "ai.command": "Comando",
  "ai.args": "Argomenti",
  "ai.keyEnv": "Variabile d'ambiente della chiave API",
  "ai.claudeNote": "Usa la CLI <code>claude</code> (Claude Code). Esegui <code>claude login</code> una volta per autenticarti.",
  "ai.codexNote": "Usa la CLI <code>codex</code> (OpenAI). Autenticati con <code>codex login</code> oppure imposta una chiave API qui sopra (iniettata come <code>OPENAI_API_KEY</code>).",
  "ai.customNote": "Qualsiasi CLI che riceve un prompt e stampa la risposta su stdout. Inserisci <code>{prompt}</code> negli argomenti dove deve andare il prompt.",
  "ai.keysNote": "Le chiavi API sono memorizzate localmente in <code>~/.config/lume/config.toml</code> e sono escluse dall'esportazione delle impostazioni.",
  "ai.customApi": "API compatibile con OpenAI",
  "ai.baseUrl": "URL di base",
  "ai.configured": "✓ configurato",
  "ai.missingKey": "✗ chiave API richiesta",
  "ai.openaiNote": "Usa l'API di OpenAI. Crea una chiave su <code>platform.openai.com</code>.",
  "ai.deepseekNote": "Usa l'API di DeepSeek (compatibile con OpenAI). Chiave su <code>platform.deepseek.com</code>.",
  "ai.apiNote": "Qualsiasi endpoint compatibile con OpenAI (Ollama, Groq, OpenRouter…). Imposta URL di base, chiave e modello.",
};
