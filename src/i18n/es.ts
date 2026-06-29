import type { Dict } from "../i18n";

export const es: Dict = {
  // --- Settings: nav + general ---
  "settings.title": "Ajustes",
  "settings.close": "Cerrar (Esc)",
  "nav.appearance": "Apariencia",
  "nav.shell": "Shell",
  "nav.notifications": "Notificaciones",
  "nav.remote": "Remoto",
  "nav.keys": "Atajos",
  "nav.general": "General",
  "nav.about": "Acerca de",

  // --- Appearance ---
  "appearance.font": "Fuente",
  "appearance.import": "Importar",
  "appearance.importTitle": "Importar un .ttf/.otf/.woff",
  "appearance.fontHint":
    "Para los iconos del prompt (Powerlevel10k, starship…), elige una <strong>Nerd Font</strong> — p. ej. <code>MesloLGS NF</code>.",
  "appearance.fontCurrent": "(actual)",
  "appearance.fontImported": "Importadas",
  "appearance.fontSystem": "Sistema (monoespaciada)",
  "appearance.size": "Tamaño",
  "appearance.cursorBlink": "Cursor parpadeante",
  "appearance.cursorStyle": "Estilo del cursor",
  "cursor.block": "Bloque",
  "cursor.bar": "Barra",
  "cursor.underline": "Subrayado",
  "appearance.scrollback": "Historial (líneas)",
  "appearance.theme": "Tema",
  "appearance.ansi": "Colores ANSI (16)",
  "appearance.reset": "Restablecer apariencia",

  // --- Shell ---
  "shell.program": "Programa",
  "shell.programPlaceholder": "$SHELL (predeterminado)",
  "shell.args": "Argumentos",
  "shell.argsPlaceholder": "p. ej. -l",
  "shell.note": "Se aplica a las <strong>nuevas</strong> terminales.",

  // --- Notifications ---
  "notif.enable": "Notificar en comandos largos",
  "notif.minDuration": "Duración mínima (s)",
  "notif.sound": "Sonido de notificación",
  "notif.note":
    "Se muestra una notificación del sistema cuando un comando supera esta duración <strong>y Lume no está enfocado</strong>.",

  // --- Keys ---
  "keys.hint":
    "Haz clic en un atajo y pulsa la combinación deseada (<kbd>Esc</kbd> para cancelar).",
  "keys.reset": "Restablecer atajos",
  "keys.recording": "Pulsa una tecla…",
  "keys.fixed": "Atajos fijos",

  // --- General ---
  "general.language": "Idioma",
  "general.backup": "Copia de los ajustes",
  "general.exportImport": "Exportar / importar toda la configuración",
  "general.export": "Exportar",
  "general.import": "Importar",
  "general.exported": "Ajustes exportados ✓",
  "general.exportFailed": "Error al exportar",
  "general.imported": "Ajustes importados ✓",
  "general.importFailed": "Archivo no válido",

  // --- About ---
  "about.version": "Versión",
  "about.updates": "Actualizaciones",
  "about.check": "Comprobar",
  "about.checking": "Comprobando…",
  "about.uptodate": "Lume está actualizado ✓",
  "about.checkError": "No se pudo comprobar (sin conexión o sin versión).",
  "about.available": "<strong>Lume {version}</strong> está disponible.",
  "about.installRestart": "Instalar y reiniciar",
  "about.downloading": "Descargando… {percent}%",
  "about.updateNote":
    "Las actualizaciones se firman e instalan automáticamente (compilación AppImage). Comprobación automática al iniciar.",

  // --- Toolbar (tab bar) ---
  "toolbar.fileTree": "Árbol de archivos",
  "toolbar.layouts": "Diseños predefinidos",
  "toolbar.blocks": "Bloques (Ctrl+B)",
  "toolbar.workflows": "Workflows (Ctrl+Shift+R)",
  "toolbar.ssh": "SSH (Ctrl+Shift+S)",
  "toolbar.settings": "Ajustes (Ctrl+,)",
  "toolbar.newTab": "Nueva (Ctrl+Shift+T)",
  "toolbar.closeTab": "Cerrar (Ctrl+Shift+W)",
  "toolbar.prevTabs": "Pestañas anteriores",
  "toolbar.nextTabs": "Pestañas siguientes",
  "toolbar.remoteActive": "Control remoto activo — haz clic para gestionar",

  // --- Layouts popup ---
  "layouts.title": "Aplicar un diseño",
  "layouts.single": "Único",
  "layouts.twoCols": "2 columnas",
  "layouts.twoRows": "2 filas",
  "layouts.grid": "Cuadrícula 2×2",
  "layouts.mainSide": "Principal + 2",
  "layouts.tripleCol": "3 columnas",
  "layouts.note":
    "La terminal activa se mantiene en la primera posición. Los demás shells de la pestaña se cierran.",

  // --- Pane context menu ---
  "pane.copy": "⧉ Copiar (Ctrl+Shift+C)",
  "pane.paste": "⎘ Pegar (Ctrl+Shift+V)",
  "pane.splitH": "⬌ Dividir horizontalmente",
  "pane.splitV": "⬍ Dividir verticalmente",
  "pane.remote": "⇆ Controlar a distancia",
  "pane.newTab": "+ Nueva pestaña",
  "pane.close": "× Cerrar este panel",
  "pane.closeTab": " (cierra la pestaña)",

  // --- Tab context menu ---
  "tab.rename": "✎ Renombrar (doble clic)",
  "tab.splitH": "⬌ Dividir horizontalmente (Ctrl+Shift+D)",
  "tab.splitV": "⬍ Dividir verticalmente (Ctrl+Shift+E)",
  "tab.newTab": "+ Nueva pestaña (Ctrl+Shift+T)",
  "tab.close": "× Cerrar esta pestaña",
  "tab.panes": " ({n} paneles)",

  // --- File tree ---
  "ft.hidden": "Archivos ocultos",
  "ft.refresh": "Actualizar",
  "ft.close": "Cerrar",
  "ft.unknownDir": "Carpeta desconocida",
  "ft.denied": "acceso denegado",
  "ft.empty": "vacío",
  "ftctx.cd": "Abrir carpeta",
  "ftctx.ls": "Listar (ls -la)",
  "ftctx.editor": "Abrir en el editor",
  "ftctx.cat": "Ver (cat)",
  "ftctx.nano": "Editar (nano)",
  "ftctx.openEditor": "Abrir ($EDITOR)",
  "ftctx.copyPath": "Copiar ruta",
  "ftctx.insertPath": "Insertar ruta",

  // --- Update banner ---
  "update.available": "<strong>Lume {version}</strong> está disponible",
  "update.failed": "fallido, reintentar",
  "update.install": "Instalar y reiniciar",
  "update.later": "Más tarde",
  "update.downloading": "Descargando… {percent}%",

  // --- Remote dialog ---
  "remote.title": "Control remoto",
  "remote.connected": "{n} dispositivo(s) conectado(s)",
  "remote.active": "Activo — sin conexión",
  "remote.creatingTunnel": "Creando túnel público… (unos segundos)",
  "remote.starting": "Iniciando…",
  "remote.scanPublic": "Escanea el QR o abre la URL desde cualquier lugar:",
  "remote.scanLan": "Misma red local — escanea el QR o abre la URL:",
  "remote.copy": "Copiar",
  "remote.installHint":
    "Instala <code>cloudflared</code> para controlar fuera de la red local.",
  "remote.warn": "⚠️ Cualquiera con este enlace puede manejar esta terminal.",
  "remote.installBtn": "Instalar y activar el túnel",
  "remote.installing": "Instalando…",
  "remote.stop": "Detener el control remoto",

  // --- Terminal search ---
  "search.placeholder": "Buscar…",
  "search.next": "Siguiente",
  "search.prev": "Anterior",
  "search.close": "Cerrar",

  // --- Blocks panel ---
  "blocks.title": "Bloques",
  "blocks.empty": "Aún no hay bloques de comandos.",
  "blocks.setupTitle": "Activar los bloques de comandos",
  "blocks.copyCmd": "Copiar comando",
  "blocks.copyOutput": "Copiar salida",
  "blocks.rerun": "Reejecutar",
  "blocks.remove": "Eliminar",
  "blocks.explain": "Explicar (IA)",

  // --- Terminal search (button titles with shortcuts) ---
  "search.prevTitle": "Anterior (Shift+Enter)",
  "search.nextTitle": "Siguiente (Enter)",
  "search.closeTitle": "Cerrar (Esc)",
  "term.copyBlock": "Copiar el comando + su salida",

  // --- Notifications (banner bodies) ---
  "notif.cmdDone": "✓ Comando finalizado",
  "notif.cmdFailed": "✗ Fallido (salida {code})",

  // --- AI explain seed prompt ---
  "ai.seedHeader": "Aquí tienes un bloque de terminal:",
  "ai.seedCommand": "Comando: ",
  "ai.seedOutput": "Salida:",
  "ai.seedExitCode": "Código de salida: ",
  "ai.seedAsk": "Explica brevemente qué está pasando.",

  // --- Command palette (AI) ---
  "cmd.placeholder": "Genera un comando para…",
  "cmd.escCancel": "Esc para cancelar",
  "cmd.noCli":
    "<code>{cmd}</code> no se encontró en PATH — configura un proveedor en Ajustes › IA.",
  "cmd.noProvider":
    "Ningún proveedor de IA configurado — configura uno en Ajustes › IA.",
  "cmd.cancel": "Cancelar",
  "cmd.insertHint": "<kbd>Enter</kbd> para insertar en la terminal",
  "cmd.generateHint": "<kbd>Enter</kbd> para generar",
  "cmd.reformulate": "Reformular",
  "cmd.insert": "Insertar",
  "cmd.unknownError": "Error desconocido",
  "cmd.retry": "Reintentar",

  // --- Workflows palette ---
  "wf.searchPlaceholder": "Buscar un workflow…",
  "wf.empty": "Ningún workflow. <code>~/.config/lume/workflows/*.yaml</code>",
  "wf.navHint": "<kbd>↑</kbd><kbd>↓</kbd> navegar · <kbd>Enter</kbd> elegir",
  "wf.back": "Atrás",
  "wf.preview": "Vista previa",
  "wf.toComplete": "Por completar: {fields}",
  "wf.insertHint": "<kbd>Enter</kbd> para insertar en la terminal",
  "wf.insert": "Insertar",

  // --- SSH palette ---
  "ssh.placeholder": "Host SSH o usuario@servidor…",
  "ssh.noMatch": "Ningún host coincide.",
  "ssh.noHosts":
    "Ningún host en <code>~/.ssh/config</code>. Escribe un <code>user@server</code> para conectarte directamente.",
  "ssh.connectTo": "Conectar a",
  "ssh.directConnection": "conexión directa",
  "ssh.navHint":
    "<kbd>↑</kbd><kbd>↓</kbd> navegar · <kbd>Enter</kbd> conectar (nueva pestaña)",

  // --- Blocks panel (extended) ---
  "blocks.aiThinking": "{provider} está pensando…",
  "blocks.aiError": "Error",
  "blocks.aiClose": "Cerrar",
  "blocks.followupPlaceholder": "Pregunta de seguimiento…",
  "blocks.followupWait": "Espera…",
  "blocks.send": "Enviar (Enter)",
  "blocks.emptyIntro":
    "Un <strong>bloque</strong> = un comando + su salida + su código de salida.",
  "blocks.emptyActive": "Aún no hay comandos — ejecuta uno y aparecerá aquí.",
  "blocks.emptyHistory":
    "El historial aparecerá aquí en cuanto tu shell emita los marcadores OSC 133.",
  "blocks.loading": "Cargando…",
  "blocks.addLinePre": "Añade esta línea a",
  "blocks.addLinePost": "y luego abre un nuevo shell:",
  "blocks.copy": "Copiar",
  "blocks.detected":
    "Detectado: <code>{shell}</code>. El PTY exporta <code>LUME_TERM=1</code> — el source solo se activa dentro de Lume.",
  "blocks.shellUnknown": "shell desconocido",
  "blocks.help": "¿Qué es esto?",
  "blocks.helpIntro":
    "Cada línea = un comando ejecutado + su resultado. Lume detecta los límites mediante OSC 133 (marcadores emitidos por tu shell).",
  "blocks.exitOk": "exit 0",
  "blocks.exitErr": "exit ≠ 0",
  "blocks.exitRunning": "en ejecución",
  "blocks.helpKeys":
    'Clic → desplazarse al prompt en la terminal.<br/>Clic derecho → copiar, insertar, explicar.<br/><kbd>Ctrl</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> → navegar, <kbd>↩</kbd> para insertar en la terminal.<br/><span style="color: var(--accent)">✨</span> → explicación de IA.',
  "blocks.resize": "Arrastra para redimensionar",
  "blocks.filterPlaceholder": "Filtrar bloques…",
  "blocks.searchClose": "Cerrar (Esc)",
  "blocks.hide": "Ocultar (Ctrl+B)",
  "blocks.clickScroll": "Clic → desplazarse al prompt",
  "blocks.promptNotTracked": "(línea del prompt no rastreada)",
  "blocks.rightClickActions": "Clic derecho → copiar, insertar, explicar…",
  "blocks.promptNoCommand": "(prompt sin comando)",
  "blocks.outputCopied": "Salida copiada ✓",
  "blocks.commandCopied": "Comando copiado ✓",
  "blocks.outputCaptured": "Salida capturada — Shift+Clic para copiarla",
  "blocks.aiNoCli": "No se encontró el CLI de {provider} en el PATH",
  "blocks.aiBlockNotDone": "El bloque debe estar finalizado",
  "blocks.aiNoCommand": "No hay comando que explicar",
  "blocks.cancel": "Cancelar",
  "blocks.aiFixError": "Corregir este error con {provider}",
  "blocks.aiExplainBlock": "Explicar este bloque con {provider}",
  "blocks.insertTerminal": "Insertar en la terminal",
  "blocks.gotoCommand": "Ir al comando en la terminal",
  "blocks.explainClaude": "✨ Explicar con {provider}",
  "blocks.closeAiPanel": "Cerrar el panel de {provider}",
  "blocks.removeBlock": "Eliminar este bloque",

  // --- Keybindings (configurable actions) ---
  "keys.action.newTab": "Nueva pestaña",
  "keys.action.closeTab": "Cerrar panel / pestaña",
  "keys.action.nextTab": "Pestaña siguiente",
  "keys.action.prevTab": "Pestaña anterior",
  "keys.action.splitH": "Dividir horizontalmente",
  "keys.action.splitV": "Dividir verticalmente",
  "keys.action.togglePanel": "Barra lateral de bloques",
  "keys.action.search": "Filtrar bloques",
  "keys.action.termSearch": "Buscar en la terminal",
  "keys.action.paletteAI": "Paleta de IA",
  "keys.action.workflows": "Workflows",
  "keys.action.ssh": "SSH",
  "keys.action.copy": "Copiar",
  "keys.action.paste": "Pegar",
  "keys.action.settings": "Ajustes",

  // --- Keybindings (fixed shortcuts) ---
  "keys.fixed.goToTab": "Ir a la pestaña N",
  "keys.fixed.zoom": "Zoom del texto (tamaño +/-)",
  "keys.fixed.zoomReset": "Tamaño de texto predeterminado",
  "keys.fixed.navPanes": "Navegar entre paneles (en bucle)",
  "keys.fixed.navBlocks": "Navegar por los bloques",

  // --- Theme colors ---
  "color.background": "Fondo",
  "color.foreground": "Texto",
  "color.accent": "Acento",
  "color.cursor": "Cursor",
  "color.selection": "Selección",

  // --- Pane ---
  "pane.dragMove": "Arrastra para mover este panel",
  "pane.swap": "Intercambiar",
  "pane.moveHere": "Mover aquí",

  // --- Autocomplete footer ---
  "ac.complete": "<kbd>Tab</kbd> completar",
  "ac.navigate": "<kbd>↑</kbd><kbd>↓</kbd> navegar",
  "ac.close": "<kbd>Esc</kbd> cerrar",

  // --- AI provider settings ---
  "nav.ai": "IA",
  "ai.provider": "Proveedor",
  "ai.custom": "Personalizado (CLI)",
  "ai.model": "Modelo",
  "ai.modelHint": "predeterminado",
  "ai.status": "Estado",
  "ai.detected": "✓ {cmd} detectado",
  "ai.notFound": "✗ {cmd} no se encontró en PATH",
  "ai.apiKey": "Clave de API",
  "ai.command": "Comando",
  "ai.args": "Argumentos",
  "ai.keyEnv": "Variable de entorno de la clave de API",
  "ai.claudeNote": "Usa la CLI <code>claude</code> (Claude Code). Ejecuta <code>claude login</code> una vez para autenticarte.",
  "ai.codexNote": "Usa la CLI <code>codex</code> (OpenAI). Autentícate con <code>codex login</code>, o define una clave de API arriba (inyectada como <code>OPENAI_API_KEY</code>).",
  "ai.customNote": "Cualquier CLI que reciba un prompt e imprima la respuesta en stdout. Coloca <code>{prompt}</code> en los argumentos donde debe ir el prompt.",
  "ai.keysNote": "Las claves de API se almacenan localmente en <code>~/.config/lume/config.toml</code> y se excluyen de la exportación de ajustes.",
  "ai.customApi": "API compatible con OpenAI",
  "ai.baseUrl": "URL base",
  "ai.configured": "✓ configurado",
  "ai.missingKey": "✗ se requiere clave de API",
  "ai.openaiNote": "Usa la API de OpenAI. Crea una clave en <code>platform.openai.com</code>.",
  "ai.deepseekNote": "Usa la API de DeepSeek (compatible con OpenAI). Clave en <code>platform.deepseek.com</code>.",
  "ai.apiNote": "Cualquier endpoint compatible con OpenAI (Ollama, Groq, OpenRouter…). Define la URL base, la clave y el modelo.",
};
