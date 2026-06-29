import type { Dict } from "../i18n";

export const pt: Dict = {
  // --- Settings: nav + general ---
  "settings.title": "Configurações",
  "settings.close": "Fechar (Esc)",
  "nav.appearance": "Aparência",
  "nav.shell": "Shell",
  "nav.notifications": "Notificações",
  "nav.remote": "Remoto",
  "nav.keys": "Atalhos",
  "nav.general": "Geral",
  "nav.about": "Sobre",

  // --- Appearance ---
  "appearance.font": "Fonte",
  "appearance.import": "Importar",
  "appearance.importTitle": "Importar um .ttf/.otf/.woff",
  "appearance.fontHint":
    "Para os ícones do prompt (Powerlevel10k, starship…), escolha uma <strong>Nerd Font</strong> — por exemplo <code>MesloLGS NF</code>.",
  "appearance.fontCurrent": "(atual)",
  "appearance.fontImported": "Importadas",
  "appearance.fontSystem": "Sistema (monoespaçada)",
  "appearance.size": "Tamanho",
  "appearance.cursorBlink": "Cursor piscante",
  "appearance.cursorStyle": "Estilo do cursor",
  "cursor.block": "Bloco",
  "cursor.bar": "Barra",
  "cursor.underline": "Sublinhado",
  "appearance.scrollback": "Histórico de rolagem (linhas)",
  "appearance.theme": "Tema",
  "appearance.ansi": "Cores ANSI (16)",
  "appearance.reset": "Redefinir aparência",

  // --- Shell ---
  "shell.program": "Programa",
  "shell.programPlaceholder": "$SHELL (padrão)",
  "shell.args": "Argumentos",
  "shell.argsPlaceholder": "ex.: -l",
  "shell.note": "Aplica-se aos <strong>novos</strong> terminais.",

  // --- Notifications ---
  "notif.enable": "Notificar comandos longos",
  "notif.minDuration": "Duração mínima (s)",
  "notif.sound": "Som de notificação",
  "notif.note":
    "Uma notificação do sistema aparece quando um comando ultrapassa esta duração <strong>e o Lume não está em foco</strong>.",

  // --- Keys ---
  "keys.hint":
    "Clique em um atalho e pressione a combinação desejada (<kbd>Esc</kbd> para cancelar).",
  "keys.reset": "Redefinir atalhos",
  "keys.recording": "Pressione uma tecla…",
  "keys.fixed": "Atalhos fixos",

  // --- General ---
  "general.language": "Idioma",
  "general.backup": "Backup das configurações",
  "general.exportImport": "Exportar / importar toda a configuração",
  "general.export": "Exportar",
  "general.import": "Importar",
  "general.exported": "Configurações exportadas ✓",
  "general.exportFailed": "Falha na exportação",
  "general.imported": "Configurações importadas ✓",
  "general.importFailed": "Arquivo inválido",

  // --- About ---
  "about.version": "Versão",
  "about.updates": "Atualizações",
  "about.check": "Verificar",
  "about.checking": "Verificando…",
  "about.uptodate": "O Lume está atualizado ✓",
  "about.checkError": "Não foi possível verificar (offline ou sem release).",
  "about.available": "<strong>Lume {version}</strong> está disponível.",
  "about.installRestart": "Instalar e reiniciar",
  "about.downloading": "Baixando… {percent}%",
  "about.updateNote":
    "As atualizações são assinadas e instaladas automaticamente (build AppImage). Verificação automática ao iniciar.",

  // --- Toolbar (tab bar) ---
  "toolbar.fileTree": "Árvore de arquivos",
  "toolbar.layouts": "Layouts predefinidos",
  "toolbar.blocks": "Blocos (Ctrl+B)",
  "toolbar.workflows": "Workflows (Ctrl+Shift+R)",
  "toolbar.ssh": "SSH (Ctrl+Shift+S)",
  "toolbar.settings": "Configurações (Ctrl+,)",
  "toolbar.newTab": "Nova (Ctrl+Shift+T)",
  "toolbar.closeTab": "Fechar (Ctrl+Shift+W)",
  "toolbar.prevTabs": "Abas anteriores",
  "toolbar.nextTabs": "Próximas abas",
  "toolbar.remoteActive": "Controle remoto ativo — clique para gerenciar",

  // --- Layouts popup ---
  "layouts.title": "Aplicar um layout",
  "layouts.single": "Único",
  "layouts.twoCols": "2 colunas",
  "layouts.twoRows": "2 linhas",
  "layouts.grid": "Grade 2×2",
  "layouts.mainSide": "Principal + 2",
  "layouts.tripleCol": "3 colunas",
  "layouts.note":
    "O terminal ativo é mantido no primeiro slot. Os outros shells da aba são fechados.",

  // --- Pane context menu ---
  "pane.copy": "⧉ Copiar (Ctrl+Shift+C)",
  "pane.paste": "⎘ Colar (Ctrl+Shift+V)",
  "pane.splitH": "⬌ Dividir horizontalmente",
  "pane.splitV": "⬍ Dividir verticalmente",
  "pane.remote": "⇆ Controlar remotamente",
  "pane.newTab": "+ Nova aba",
  "pane.close": "× Fechar este painel",
  "pane.closeTab": " (fecha a aba)",

  // --- Tab context menu ---
  "tab.rename": "✎ Renomear (clique duplo)",
  "tab.splitH": "⬌ Dividir horizontalmente (Ctrl+Shift+D)",
  "tab.splitV": "⬍ Dividir verticalmente (Ctrl+Shift+E)",
  "tab.newTab": "+ Nova aba (Ctrl+Shift+T)",
  "tab.close": "× Fechar esta aba",
  "tab.panes": " ({n} painéis)",

  // --- File tree ---
  "ft.hidden": "Arquivos ocultos",
  "ft.refresh": "Atualizar",
  "ft.close": "Fechar",
  "ft.unknownDir": "Diretório desconhecido",
  "ft.denied": "acesso negado",
  "ft.empty": "vazio",
  "ftctx.cd": "Abrir pasta",
  "ftctx.ls": "Listar (ls -la)",
  "ftctx.editor": "Abrir no editor",
  "ftctx.cat": "Ver (cat)",
  "ftctx.nano": "Editar (nano)",
  "ftctx.openEditor": "Abrir ($EDITOR)",
  "ftctx.copyPath": "Copiar caminho",
  "ftctx.insertPath": "Inserir caminho",

  // --- Update banner ---
  "update.available": "<strong>Lume {version}</strong> está disponível",
  "update.failed": "falhou, tente novamente",
  "update.install": "Instalar e reiniciar",
  "update.later": "Mais tarde",
  "update.downloading": "Baixando… {percent}%",

  // --- Remote dialog ---
  "remote.title": "Controle remoto",
  "remote.connected": "{n} dispositivo(s) conectado(s)",
  "remote.active": "Ativo — nenhuma conexão",
  "remote.creatingTunnel": "Criando túnel público… (alguns segundos)",
  "remote.starting": "Iniciando…",
  "remote.scanPublic": "Escaneie o QR ou abra a URL de qualquer lugar:",
  "remote.scanLan": "Mesma rede local — escaneie o QR ou abra a URL:",
  "remote.copy": "Copiar",
  "remote.installHint":
    "Instale o <code>cloudflared</code> para controlar fora da rede local.",
  "remote.warn": "⚠️ Qualquer pessoa com este link pode controlar este terminal.",
  "remote.installBtn": "Instalar e ativar o túnel",
  "remote.installing": "Instalando…",
  "remote.stop": "Parar controle remoto",

  // --- Terminal search ---
  "search.placeholder": "Buscar…",
  "search.next": "Próximo",
  "search.prev": "Anterior",
  "search.close": "Fechar",

  // --- Blocks panel ---
  "blocks.title": "Blocos",
  "blocks.empty": "Nenhum bloco de comando ainda.",
  "blocks.setupTitle": "Ativar blocos de comando",
  "blocks.copyCmd": "Copiar comando",
  "blocks.copyOutput": "Copiar saída",
  "blocks.rerun": "Executar de novo",
  "blocks.remove": "Remover",
  "blocks.explain": "Explicar (IA)",

  // --- Terminal search (button titles with shortcuts) ---
  "search.prevTitle": "Anterior (Shift+Enter)",
  "search.nextTitle": "Próximo (Enter)",
  "search.closeTitle": "Fechar (Esc)",
  "term.copyBlock": "Copiar o comando + sua saída",

  // --- Notifications (banner bodies) ---
  "notif.cmdDone": "✓ Comando concluído",
  "notif.cmdFailed": "✗ Falhou (saída {code})",

  // --- AI explain seed prompt ---
  "ai.seedHeader": "Aqui está um bloco de terminal:",
  "ai.seedCommand": "Comando: ",
  "ai.seedOutput": "Saída:",
  "ai.seedExitCode": "Código de saída: ",
  "ai.seedAsk": "Explique brevemente o que está acontecendo.",

  // --- Command palette (AI) ---
  "cmd.placeholder": "Gerar um comando para…",
  "cmd.escCancel": "Esc para cancelar",
  "cmd.noCli":
    "<code>{cmd}</code> não encontrado no PATH — configure um provedor em Configurações › IA.",
  "cmd.noProvider":
    "Nenhum provedor de IA configurado — configure um em Configurações › IA.",
  "cmd.cancel": "Cancelar",
  "cmd.insertHint": "<kbd>Enter</kbd> para inserir no terminal",
  "cmd.generateHint": "<kbd>Enter</kbd> para gerar",
  "cmd.reformulate": "Reformular",
  "cmd.insert": "Inserir",
  "cmd.unknownError": "Erro desconhecido",
  "cmd.retry": "Tentar novamente",

  // --- Workflows palette ---
  "wf.searchPlaceholder": "Buscar um workflow…",
  "wf.empty": "Nenhum workflow. <code>~/.config/lume/workflows/*.yaml</code>",
  "wf.navHint": "<kbd>↑</kbd><kbd>↓</kbd> navegar · <kbd>Enter</kbd> escolher",
  "wf.back": "Voltar",
  "wf.preview": "Pré-visualização",
  "wf.toComplete": "A preencher: {fields}",
  "wf.insertHint": "<kbd>Enter</kbd> para inserir no terminal",
  "wf.insert": "Inserir",

  // --- SSH palette ---
  "ssh.placeholder": "Host SSH ou usuário@servidor…",
  "ssh.noMatch": "Nenhum host corresponde.",
  "ssh.noHosts":
    "Nenhum host em <code>~/.ssh/config</code>. Digite um <code>usuário@servidor</code> para conectar diretamente.",
  "ssh.connectTo": "Conectar a",
  "ssh.directConnection": "conexão direta",
  "ssh.navHint":
    "<kbd>↑</kbd><kbd>↓</kbd> navegar · <kbd>Enter</kbd> conectar (nova aba)",

  // --- Blocks panel (extended) ---
  "blocks.aiThinking": "{provider} está pensando…",
  "blocks.aiError": "Erro",
  "blocks.aiClose": "Fechar",
  "blocks.followupPlaceholder": "Pergunta de acompanhamento…",
  "blocks.followupWait": "Aguarde…",
  "blocks.send": "Enviar (Enter)",
  "blocks.emptyIntro":
    "Um <strong>bloco</strong> = um comando + sua saída + seu código de saída.",
  "blocks.emptyActive":
    "Nenhum comando ainda — execute um e ele aparecerá aqui.",
  "blocks.emptyHistory":
    "O histórico aparecerá aqui assim que seu shell emitir os marcadores OSC 133.",
  "blocks.loading": "Carregando…",
  "blocks.addLinePre": "Adicione esta linha a",
  "blocks.addLinePost": "e abra um novo shell:",
  "blocks.copy": "Copiar",
  "blocks.detected":
    "Detectado: <code>{shell}</code>. O PTY exporta <code>LUME_TERM=1</code> — o source só é ativado dentro do Lume.",
  "blocks.shellUnknown": "shell desconhecido",
  "blocks.help": "O que é isto?",
  "blocks.helpIntro":
    "Cada linha = um comando executado + seu resultado. O Lume detecta os limites via OSC 133 (marcadores emitidos pelo seu shell).",
  "blocks.exitOk": "saída 0",
  "blocks.exitErr": "saída ≠ 0",
  "blocks.exitRunning": "em execução",
  "blocks.helpKeys":
    'Clique → role até o prompt no terminal.<br/>Clique direito → copiar, inserir, explicar.<br/><kbd>Ctrl</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> → navegar, <kbd>↩</kbd> para inserir no terminal.<br/><span style="color: var(--accent)">✨</span> → explicação da IA.',
  "blocks.resize": "Arraste para redimensionar",
  "blocks.filterPlaceholder": "Filtrar blocos…",
  "blocks.searchClose": "Fechar (Esc)",
  "blocks.hide": "Ocultar (Ctrl+B)",
  "blocks.clickScroll": "Clique → role até o prompt",
  "blocks.promptNotTracked": "(linha do prompt não rastreada)",
  "blocks.rightClickActions": "Clique direito → copiar, inserir, explicar…",
  "blocks.promptNoCommand": "(prompt sem comando)",
  "blocks.outputCopied": "Saída copiada ✓",
  "blocks.commandCopied": "Comando copiado ✓",
  "blocks.outputCaptured": "Saída capturada — Shift+Clique para copiá-la",
  "blocks.aiNoCli": "CLI do {provider} não encontrado no PATH",
  "blocks.aiBlockNotDone": "O bloco precisa estar concluído",
  "blocks.aiNoCommand": "Nenhum comando para explicar",
  "blocks.cancel": "Cancelar",
  "blocks.aiFixError": "Corrigir este erro com o {provider}",
  "blocks.aiExplainBlock": "Explicar este bloco com o {provider}",
  "blocks.insertTerminal": "Inserir no terminal",
  "blocks.gotoCommand": "Ir para o comando no terminal",
  "blocks.explainClaude": "✨ Explicar com o {provider}",
  "blocks.closeAiPanel": "Fechar o painel do {provider}",
  "blocks.removeBlock": "Remover este bloco",

  // --- Keybindings (configurable actions) ---
  "keys.action.newTab": "Nova aba",
  "keys.action.closeTab": "Fechar painel / aba",
  "keys.action.nextTab": "Próxima aba",
  "keys.action.prevTab": "Aba anterior",
  "keys.action.splitH": "Dividir horizontalmente",
  "keys.action.splitV": "Dividir verticalmente",
  "keys.action.togglePanel": "Barra lateral de blocos",
  "keys.action.search": "Filtrar blocos",
  "keys.action.termSearch": "Buscar no terminal",
  "keys.action.paletteAI": "Paleta de IA",
  "keys.action.workflows": "Workflows",
  "keys.action.ssh": "SSH",
  "keys.action.copy": "Copiar",
  "keys.action.paste": "Colar",
  "keys.action.settings": "Configurações",

  // --- Keybindings (fixed shortcuts) ---
  "keys.fixed.goToTab": "Ir para a aba N",
  "keys.fixed.zoom": "Zoom do texto (tamanho +/-)",
  "keys.fixed.zoomReset": "Tamanho do texto padrão",
  "keys.fixed.navPanes": "Navegar entre painéis (em loop)",
  "keys.fixed.navBlocks": "Navegar pelos blocos",

  // --- Theme colors ---
  "color.background": "Fundo",
  "color.foreground": "Texto",
  "color.accent": "Destaque",
  "color.cursor": "Cursor",
  "color.selection": "Seleção",

  // --- Pane ---
  "pane.dragMove": "Arraste para mover este painel",
  "pane.swap": "Trocar",
  "pane.moveHere": "Mover para cá",

  // --- Autocomplete footer ---
  "ac.complete": "<kbd>Tab</kbd> completar",
  "ac.navigate": "<kbd>↑</kbd><kbd>↓</kbd> navegar",
  "ac.close": "<kbd>Esc</kbd> fechar",

  // --- AI provider settings ---
  "nav.ai": "IA",
  "ai.provider": "Provedor",
  "ai.custom": "Personalizado (CLI)",
  "ai.model": "Modelo",
  "ai.modelHint": "padrão",
  "ai.status": "Estado",
  "ai.detected": "✓ {cmd} detectado",
  "ai.notFound": "✗ {cmd} não encontrado no PATH",
  "ai.recheck": "Verificar de novo",
  "ai.apiKey": "Chave de API",
  "ai.command": "Comando",
  "ai.args": "Argumentos",
  "ai.keyEnv": "Variável de ambiente da chave de API",
  "ai.claudeNote": "Usa a CLI <code>claude</code> (Claude Code). Execute <code>claude login</code> uma vez para autenticar.",
  "ai.codexNote": "Usa a CLI <code>codex</code> (OpenAI). Autentique com <code>codex login</code> ou defina uma chave de API acima (injetada como <code>OPENAI_API_KEY</code>).",
  "ai.customNote": "Qualquer CLI que receba um prompt e imprima a resposta no stdout. Coloque <code>{prompt}</code> nos argumentos onde o prompt deve ir.",
  "ai.keysNote": "As chaves de API são armazenadas localmente em <code>~/.config/lume/config.toml</code> e são excluídas da exportação das configurações.",
  "ai.customApi": "API compatível com OpenAI",
  "ai.baseUrl": "URL base",
  "ai.configured": "✓ configurado",
  "ai.missingKey": "✗ chave de API necessária",
  "ai.openaiNote": "Usa a API da OpenAI. Crie uma chave em <code>platform.openai.com</code>.",
  "ai.deepseekNote": "Usa a API da DeepSeek (compatível com OpenAI). Chave em <code>platform.deepseek.com</code>.",
  "ai.apiNote": "Qualquer endpoint compatível com OpenAI (Ollama, Groq, OpenRouter…). Defina a URL base, a chave e o modelo.",
};
