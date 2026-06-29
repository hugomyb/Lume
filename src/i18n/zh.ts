import type { Dict } from "../i18n";

export const zh: Dict = {
  // --- Settings: nav + general ---
  "settings.title": "设置",
  "settings.close": "关闭 (Esc)",
  "nav.appearance": "外观",
  "nav.shell": "Shell",
  "nav.notifications": "通知",
  "nav.remote": "Remote",
  "nav.keys": "快捷键",
  "nav.general": "通用",
  "nav.about": "关于",

  // --- Appearance ---
  "appearance.font": "字体",
  "appearance.import": "导入",
  "appearance.importTitle": "导入 .ttf/.otf/.woff",
  "appearance.fontHint":
    "若要显示提示符图标（Powerlevel10k、starship…），请选择 <strong>Nerd Font</strong> — 例如 <code>MesloLGS NF</code>。",
  "appearance.fontCurrent": "（当前）",
  "appearance.fontImported": "已导入",
  "appearance.fontSystem": "系统（等宽）",
  "appearance.size": "字号",
  "appearance.cursorBlink": "光标闪烁",
  "appearance.cursorStyle": "光标样式",
  "cursor.block": "方块",
  "cursor.bar": "竖线",
  "cursor.underline": "下划线",
  "appearance.scrollback": "回滚行数",
  "appearance.theme": "主题",
  "appearance.customTheme": "自定义",
  "appearance.ansi": "ANSI 颜色（16 色）",
  "appearance.reset": "重置外观",

  // --- Shell ---
  "shell.program": "程序",
  "shell.programPlaceholder": "$SHELL（默认）",
  "shell.args": "参数",
  "shell.argsPlaceholder": "例如 -l",
  "shell.note": "应用于<strong>新建</strong>终端。",

  // --- Notifications ---
  "notif.enable": "长命令完成时通知",
  "notif.minDuration": "最短时长（秒）",
  "notif.sound": "通知声音",
  "notif.note":
    "当命令运行超过此时长<strong>且 Lume 未处于焦点</strong>时，会显示系统通知。",

  // --- Keys ---
  "keys.hint":
    "点击某个快捷键，然后按下想要的组合键（按 <kbd>Esc</kbd> 取消）。",
  "keys.reset": "重置快捷键",
  "keys.recording": "请按键…",
  "keys.fixed": "固定快捷键",

  // --- General ---
  "general.language": "语言",
  "general.backup": "设置备份",
  "general.exportImport": "导出 / 导入整个配置",
  "general.export": "导出",
  "general.import": "导入",
  "general.exported": "设置已导出 ✓",
  "general.exportFailed": "导出失败",
  "general.imported": "设置已导入 ✓",
  "general.importFailed": "文件无效",

  // --- About ---
  "about.version": "版本",
  "about.updates": "更新",
  "about.check": "检查",
  "about.checking": "正在检查…",
  "about.uptodate": "Lume 已是最新版本 ✓",
  "about.checkError": "无法检查（离线，或没有可用版本）。",
  "about.available": "<strong>Lume {version}</strong> 现已可用。",
  "about.installRestart": "安装并重启",
  "about.downloading": "正在下载… {percent}%",
  "about.updateNote":
    "更新经过签名并自动安装（AppImage 构建）。启动时自动检查。",

  // --- Toolbar (tab bar) ---
  "toolbar.fileTree": "文件树",
  "toolbar.layouts": "布局预设",
  "toolbar.blocks": "区块 (Ctrl+B)",
  "toolbar.workflows": "Workflows (Ctrl+Shift+R)",
  "toolbar.ssh": "SSH (Ctrl+Shift+S)",
  "toolbar.settings": "设置 (Ctrl+,)",
  "toolbar.newTab": "新建 (Ctrl+Shift+T)",
  "toolbar.closeTab": "关闭 (Ctrl+Shift+W)",
  "toolbar.prevTabs": "上一批标签页",
  "toolbar.nextTabs": "下一批标签页",
  "toolbar.remoteActive": "远程控制已启用 — 点击进行管理",

  // --- Layouts popup ---
  "layouts.title": "应用布局",
  "layouts.single": "单个",
  "layouts.twoCols": "2 列",
  "layouts.twoRows": "2 行",
  "layouts.grid": "2×2 网格",
  "layouts.mainSide": "主面板 + 2",
  "layouts.tripleCol": "3 列",
  "layouts.note":
    "活动终端保留在第一个位置。该标签页的其他 shell 将被关闭。",

  // --- Pane context menu ---
  "pane.copy": "⧉ 复制 (Ctrl+Shift+C)",
  "pane.paste": "⎘ 粘贴 (Ctrl+Shift+V)",
  "pane.splitH": "⬌ 水平拆分",
  "pane.splitV": "⬍ 垂直拆分",
  "pane.remote": "⇆ 远程控制",
  "pane.newTab": "+ 新建标签页",
  "pane.close": "× 关闭此窗格",
  "pane.closeTab": "（关闭标签页）",

  // --- Tab context menu ---
  "tab.rename": "✎ 重命名（双击）",
  "tab.splitH": "⬌ 水平拆分 (Ctrl+Shift+D)",
  "tab.splitV": "⬍ 垂直拆分 (Ctrl+Shift+E)",
  "tab.newTab": "+ 新建标签页 (Ctrl+Shift+T)",
  "tab.close": "× 关闭此标签页",
  "tab.panes": " （{n} 个窗格）",

  // --- File tree ---
  "ft.hidden": "隐藏文件",
  "ft.refresh": "刷新",
  "ft.close": "关闭",
  "ft.unknownDir": "未知目录",
  "ft.denied": "访问被拒绝",
  "ft.empty": "空",
  "ft.cmdNote":
    "右键菜单命令在当前活动终端中执行。<code>{path}</code> 会被替换为该条目的路径。",
  "ft.dirList": "列出文件夹",
  "ft.dirOpen": "在编辑器中打开文件夹",
  "ft.fileView": "查看文件",
  "ft.fileEdit": "编辑文件",
  "ft.fileOpen": "在编辑器中打开文件",
  "ft.resetCmds": "重置命令",
  "ftctx.cd": "打开文件夹",
  "ftctx.ls": "列出",
  "ftctx.editor": "在编辑器中打开",
  "ftctx.cat": "查看",
  "ftctx.nano": "编辑",
  "ftctx.openEditor": "在编辑器中打开",
  "ftctx.copyPath": "复制路径",
  "ftctx.insertPath": "插入路径",

  // --- Update banner ---
  "update.available": "<strong>Lume {version}</strong> 现已可用",
  "update.failed": "失败，重试",
  "update.install": "安装并重启",
  "update.later": "稍后",
  "update.downloading": "正在下载… {percent}%",

  // --- Remote dialog ---
  "remote.title": "远程控制",
  "remote.connected": "已连接 {n} 台设备",
  "remote.active": "已启用 — 无连接",
  "remote.creatingTunnel": "正在创建公共隧道…（需要几秒）",
  "remote.starting": "正在启动…",
  "remote.scanPublic": "扫描二维码或在任意位置打开此网址：",
  "remote.scanLan": "同一局域网 — 扫描二维码或打开此网址：",
  "remote.copy": "复制",
  "remote.installHint":
    "安装 <code>cloudflared</code> 即可从局域网外进行控制。",
  "remote.warn": "⚠️ 任何拥有此链接的人都能操控此终端。",
  "remote.installBtn": "安装并启用隧道",
  "remote.installing": "正在安装…",
  "remote.stop": "停止远程控制",

  // --- Terminal search ---
  "search.placeholder": "搜索…",
  "search.next": "下一个",
  "search.prev": "上一个",
  "search.close": "关闭",

  // --- Blocks panel ---
  "blocks.title": "区块",
  "blocks.empty": "暂无命令区块。",
  "blocks.setupTitle": "启用命令区块",
  "blocks.copyCmd": "复制命令",
  "blocks.copyOutput": "复制输出",
  "blocks.rerun": "重新运行",
  "blocks.remove": "移除",
  "blocks.explain": "解释（AI）",

  // --- Terminal search (button titles with shortcuts) ---
  "search.prevTitle": "上一个 (Shift+Enter)",
  "search.nextTitle": "下一个 (Enter)",
  "search.closeTitle": "关闭 (Esc)",
  "term.copyBlock": "复制命令及其输出",

  // --- Notifications (banner bodies) ---
  "notif.cmdDone": "✓ 命令已完成",
  "notif.cmdFailed": "✗ 失败（退出码 {code}）",

  // --- AI explain seed prompt ---
  "ai.seedHeader": "这是一个终端区块：",
  "ai.seedCommand": "命令： ",
  "ai.seedOutput": "输出：",
  "ai.seedExitCode": "退出码： ",
  "ai.seedAsk": "请简要解释这里发生了什么。",

  // --- Command palette (AI) ---
  "cmd.placeholder": "为以下需求生成命令…",
  "cmd.escCancel": "按 Esc 取消",
  "cmd.noCli":
    "在 PATH 中未找到 <code>{cmd}</code> — 请在设置 › AI 中配置一个提供商。",
  "cmd.noProvider":
    "未配置 AI 提供商 — 请在设置 › AI 中设置一个。",
  "cmd.cancel": "取消",
  "cmd.insertHint": "<kbd>Enter</kbd> 插入到终端",
  "cmd.generateHint": "<kbd>Enter</kbd> 生成",
  "cmd.reformulate": "重新表述",
  "cmd.insert": "插入",
  "cmd.unknownError": "未知错误",
  "cmd.retry": "重试",

  // --- Workflows palette ---
  "wf.searchPlaceholder": "搜索 workflow…",
  "wf.empty": "没有 workflow。<code>~/.config/lume/workflows/*.yaml</code>",
  "wf.navHint": "<kbd>↑</kbd><kbd>↓</kbd> 导航 · <kbd>Enter</kbd> 选择",
  "wf.back": "返回",
  "wf.preview": "预览",
  "wf.toComplete": "待填写：{fields}",
  "wf.insertHint": "<kbd>Enter</kbd> 插入到终端",
  "wf.insert": "插入",

  // --- SSH palette ---
  "ssh.placeholder": "SSH 主机或 user@server…",
  "ssh.noMatch": "没有匹配的主机。",
  "ssh.noHosts":
    "<code>~/.ssh/config</code> 中没有主机。输入 <code>user@server</code> 即可直接连接。",
  "ssh.connectTo": "连接到",
  "ssh.directConnection": "直接连接",
  "ssh.navHint":
    "<kbd>↑</kbd><kbd>↓</kbd> 导航 · <kbd>Enter</kbd> 连接（新标签页）",

  // --- Blocks panel (extended) ---
  "blocks.aiThinking": "{provider} 正在思考…",
  "blocks.aiError": "错误",
  "blocks.aiClose": "关闭",
  "blocks.followupPlaceholder": "追问…",
  "blocks.followupWait": "请稍候…",
  "blocks.send": "发送 (Enter)",
  "blocks.emptyIntro":
    "一个<strong>区块</strong> = 一条命令 + 它的输出 + 它的退出码。",
  "blocks.emptyActive": "暂无命令 — 运行一条命令，它就会出现在这里。",
  "blocks.emptyHistory":
    "当你的 shell 发出 OSC 133 标记后，历史记录就会显示在这里。",
  "blocks.loading": "正在加载…",
  "blocks.addLinePre": "将此行添加到",
  "blocks.addLinePost": "然后打开一个新的 shell：",
  "blocks.copy": "复制",
  "blocks.detected":
    "已检测到：<code>{shell}</code>。PTY 会导出 <code>LUME_TERM=1</code> — 该源仅在 Lume 内部生效。",
  "blocks.shellUnknown": "未知 shell",
  "blocks.help": "这是什么？",
  "blocks.helpIntro":
    "每一行 = 一条已执行的命令 + 它的结果。Lume 通过 OSC 133（你的 shell 发出的标记）检测边界。",
  "blocks.exitOk": "exit 0",
  "blocks.exitErr": "exit ≠ 0",
  "blocks.exitRunning": "运行中",
  "blocks.helpKeys":
    '单击 → 滚动到终端中的提示符。<br/>右键单击 → 复制、插入、解释。<br/><kbd>Ctrl</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> → 导航，<kbd>↩</kbd> 插入到终端。<br/><span style="color: var(--accent)">✨</span> → AI 解释。',
  "blocks.resize": "拖动以调整大小",
  "blocks.filterPlaceholder": "筛选区块…",
  "blocks.searchClose": "关闭 (Esc)",
  "blocks.hide": "隐藏 (Ctrl+B)",
  "blocks.clickScroll": "单击 → 滚动到提示符",
  "blocks.promptNotTracked": "（提示符行未跟踪）",
  "blocks.rightClickActions": "右键单击 → 复制、插入、解释…",
  "blocks.promptNoCommand": "（提示符无命令）",
  "blocks.outputCopied": "输出已复制 ✓",
  "blocks.commandCopied": "命令已复制 ✓",
  "blocks.outputCaptured": "输出已捕获 — Shift+单击 即可复制",
  "blocks.aiNoCli": "在 PATH 中未找到 {provider} CLI",
  "blocks.aiBlockNotDone": "区块必须已完成",
  "blocks.aiNoCommand": "没有可解释的命令",
  "blocks.cancel": "取消",
  "blocks.aiFixError": "用 {provider} 修复此错误",
  "blocks.aiExplainBlock": "用 {provider} 解释此区块",
  "blocks.insertTerminal": "插入到终端",
  "blocks.gotoCommand": "跳转到终端中的命令",
  "blocks.explainClaude": "✨ 用 {provider} 解释",
  "blocks.closeAiPanel": "关闭 {provider} 面板",
  "blocks.removeBlock": "移除此区块",

  // --- Keybindings (configurable actions) ---
  "keys.action.newTab": "新建标签页",
  "keys.action.closeTab": "关闭窗格 / 标签页",
  "keys.action.nextTab": "下一个标签页",
  "keys.action.prevTab": "上一个标签页",
  "keys.action.splitH": "水平拆分",
  "keys.action.splitV": "垂直拆分",
  "keys.action.togglePanel": "区块侧边栏",
  "keys.action.search": "筛选区块",
  "keys.action.termSearch": "在终端中搜索",
  "keys.action.paletteAI": "AI 面板",
  "keys.action.workflows": "Workflows",
  "keys.action.ssh": "SSH",
  "keys.action.copy": "复制",
  "keys.action.paste": "粘贴",
  "keys.action.settings": "设置",

  // --- Keybindings (fixed shortcuts) ---
  "keys.fixed.goToTab": "跳转到第 N 个标签页",
  "keys.fixed.zoom": "文字缩放（字号 +/-）",
  "keys.fixed.zoomReset": "默认文字大小",
  "keys.fixed.navPanes": "在窗格间导航（循环）",
  "keys.fixed.navBlocks": "在区块间导航",

  // --- Theme colors ---
  "color.background": "背景",
  "color.foreground": "文字",
  "color.accent": "强调色",
  "color.cursor": "光标",
  "color.selection": "选区",

  // --- Pane ---
  "pane.dragMove": "拖动以移动此窗格",
  "pane.swap": "交换",
  "pane.moveHere": "移动到此处",

  // --- Autocomplete footer ---
  "ac.complete": "<kbd>Tab</kbd> 补全",
  "ac.navigate": "<kbd>↑</kbd><kbd>↓</kbd> 导航",
  "ac.close": "<kbd>Esc</kbd> 关闭",

  // --- AI provider settings ---
  "nav.ai": "AI",
  "nav.fileTree": "文件树",
  "ai.provider": "提供商",
  "ai.custom": "自定义 (CLI)",
  "ai.model": "模型",
  "ai.modelHint": "默认",
  "ai.status": "状态",
  "ai.detected": "✓ 已检测到 {cmd}",
  "ai.notFound": "✗ 在 PATH 中未找到 {cmd}",
  "ai.recheck": "重新检测",
  "ai.apiKey": "API 密钥",
  "ai.command": "命令",
  "ai.args": "参数",
  "ai.keyEnv": "API 密钥环境变量",
  "ai.claudeNote": "使用 <code>claude</code> CLI（Claude Code）。运行一次 <code>claude login</code> 以进行身份验证。",
  "ai.codexNote": "使用 <code>codex</code> CLI（OpenAI）。使用 <code>codex login</code> 进行身份验证，或在上方设置 API 密钥（作为 <code>OPENAI_API_KEY</code> 注入）。",
  "ai.customNote": "任何接受 prompt 并将答案打印到 stdout 的 CLI。在参数中应放置 prompt 的位置填入 <code>{prompt}</code>。",
  "ai.keysNote": "API 密钥存储在本地的 <code>~/.config/lume/config.toml</code> 中，并从设置导出中排除。",
  "ai.customApi": "OpenAI 兼容 API",
  "ai.baseUrl": "基础 URL",
  "ai.configured": "✓ 已配置",
  "ai.missingKey": "✗ 需要 API 密钥",
  "ai.openaiNote": "使用 OpenAI API。在 <code>platform.openai.com</code> 上创建密钥。",
  "ai.deepseekNote": "使用 DeepSeek API（OpenAI 兼容）。密钥在 <code>platform.deepseek.com</code>。",
  "ai.apiNote": "任何 OpenAI 兼容的端点（Ollama、Groq、OpenRouter…）。设置基础 URL、密钥和模型。",
};
