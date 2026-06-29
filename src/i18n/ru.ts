import type { Dict } from "../i18n";

export const ru: Dict = {
  // --- Settings: nav + general ---
  "settings.title": "Настройки",
  "settings.close": "Закрыть (Esc)",
  "nav.appearance": "Внешний вид",
  "nav.shell": "Shell",
  "nav.notifications": "Уведомления",
  "nav.remote": "Удалённый доступ",
  "nav.keys": "Сочетания клавиш",
  "nav.general": "Общие",
  "nav.about": "О программе",

  // --- Appearance ---
  "appearance.font": "Шрифт",
  "appearance.import": "Импорт",
  "appearance.importTitle": "Импортировать .ttf/.otf/.woff",
  "appearance.fontHint":
    "Для иконок в приглашении (Powerlevel10k, starship…) выберите <strong>Nerd Font</strong> — например, <code>MesloLGS NF</code>.",
  "appearance.fontCurrent": "(текущий)",
  "appearance.fontImported": "Импортированные",
  "appearance.fontSystem": "Системный (моноширинный)",
  "appearance.size": "Размер",
  "appearance.cursorBlink": "Мигающий курсор",
  "appearance.cursorStyle": "Стиль курсора",
  "cursor.block": "Блок",
  "cursor.bar": "Линия",
  "cursor.underline": "Подчёркивание",
  "appearance.scrollback": "Буфер прокрутки (строк)",
  "appearance.theme": "Тема",
  "appearance.customTheme": "Свой",
  "appearance.ansi": "Цвета ANSI (16)",
  "appearance.reset": "Сбросить внешний вид",

  // --- Shell ---
  "shell.program": "Программа",
  "shell.programPlaceholder": "$SHELL (по умолчанию)",
  "shell.args": "Аргументы",
  "shell.argsPlaceholder": "например, -l",
  "shell.note": "Применяется к <strong>новым</strong> терминалам.",

  // --- Notifications ---
  "notif.enable": "Уведомлять о долгих командах",
  "notif.minDuration": "Минимальная длительность (с)",
  "notif.sound": "Звук уведомления",
  "notif.note":
    "Системное уведомление появляется, когда команда превышает эту длительность <strong>и окно Lume неактивно</strong>.",

  // --- Keys ---
  "keys.hint":
    "Нажмите на сочетание, затем введите нужную комбинацию (<kbd>Esc</kbd> для отмены).",
  "keys.reset": "Сбросить сочетания клавиш",
  "keys.recording": "Нажмите клавишу…",
  "keys.fixed": "Фиксированные сочетания",

  // --- General ---
  "general.language": "Язык",
  "general.backup": "Резервная копия настроек",
  "general.exportImport": "Экспорт / импорт всей конфигурации",
  "general.export": "Экспорт",
  "general.import": "Импорт",
  "general.exported": "Настройки экспортированы ✓",
  "general.exportFailed": "Не удалось экспортировать",
  "general.imported": "Настройки импортированы ✓",
  "general.importFailed": "Недопустимый файл",

  // --- About ---
  "about.version": "Версия",
  "about.updates": "Обновления",
  "about.check": "Проверить",
  "about.checking": "Проверка…",
  "about.uptodate": "Lume обновлена до последней версии ✓",
  "about.checkError": "Не удалось проверить (нет сети или нет релиза).",
  "about.available": "Доступна <strong>Lume {version}</strong>.",
  "about.installRestart": "Установить и перезапустить",
  "about.downloading": "Загрузка… {percent}%",
  "about.updateNote":
    "Обновления подписаны и устанавливаются автоматически (сборка AppImage). Автопроверка при запуске.",

  // --- Toolbar (tab bar) ---
  "toolbar.fileTree": "Дерево файлов",
  "toolbar.layouts": "Шаблоны раскладок",
  "toolbar.blocks": "Блоки (Ctrl+B)",
  "toolbar.workflows": "Workflows (Ctrl+Shift+R)",
  "toolbar.ssh": "SSH (Ctrl+Shift+S)",
  "toolbar.settings": "Настройки (Ctrl+,)",
  "toolbar.newTab": "Новая (Ctrl+Shift+T)",
  "toolbar.closeTab": "Закрыть (Ctrl+Shift+W)",
  "toolbar.prevTabs": "Предыдущие вкладки",
  "toolbar.nextTabs": "Следующие вкладки",
  "toolbar.remoteActive": "Удалённое управление активно — нажмите для управления",

  // --- Layouts popup ---
  "layouts.title": "Применить раскладку",
  "layouts.single": "Одна",
  "layouts.twoCols": "2 столбца",
  "layouts.twoRows": "2 строки",
  "layouts.grid": "Сетка 2×2",
  "layouts.mainSide": "Главная + 2",
  "layouts.tripleCol": "3 столбца",
  "layouts.note":
    "Активный терминал остаётся в первом слоте. Остальные shell-сессии вкладки закрываются.",

  // --- Pane context menu ---
  "pane.copy": "⧉ Копировать (Ctrl+Shift+C)",
  "pane.paste": "⎘ Вставить (Ctrl+Shift+V)",
  "pane.splitH": "⬌ Разделить по горизонтали",
  "pane.splitV": "⬍ Разделить по вертикали",
  "pane.remote": "⇆ Управлять удалённо",
  "pane.newTab": "+ Новая вкладка",
  "pane.close": "× Закрыть эту панель",
  "pane.closeTab": " (закрывает вкладку)",

  // --- Tab context menu ---
  "tab.rename": "✎ Переименовать (двойной клик)",
  "tab.splitH": "⬌ Разделить по горизонтали (Ctrl+Shift+D)",
  "tab.splitV": "⬍ Разделить по вертикали (Ctrl+Shift+E)",
  "tab.newTab": "+ Новая вкладка (Ctrl+Shift+T)",
  "tab.close": "× Закрыть эту вкладку",
  "tab.panes": " ({n} панелей)",

  // --- File tree ---
  "ft.hidden": "Скрытые файлы",
  "ft.refresh": "Обновить",
  "ft.close": "Закрыть",
  "ft.unknownDir": "Неизвестный каталог",
  "ft.denied": "доступ запрещён",
  "ft.empty": "пусто",
  "ft.cmdNote":
    "Команды контекстного меню выполняются в активном терминале. <code>{path}</code> заменяется на путь к элементу.",
  "ft.dirList": "Показать папку",
  "ft.dirOpen": "Открыть папку в редакторе",
  "ft.fileView": "Просмотреть файл",
  "ft.fileEdit": "Редактировать файл",
  "ft.fileOpen": "Открыть файл в редакторе",
  "ft.resetCmds": "Сбросить команды",
  "ftctx.cd": "Открыть папку",
  "ftctx.ls": "Показать",
  "ftctx.editor": "Открыть в редакторе",
  "ftctx.cat": "Просмотреть",
  "ftctx.nano": "Редактировать",
  "ftctx.openEditor": "Открыть в редакторе",
  "ftctx.copyPath": "Копировать путь",
  "ftctx.insertPath": "Вставить путь",

  // --- Update banner ---
  "update.available": "Доступна <strong>Lume {version}</strong>",
  "update.failed": "ошибка, повторить",
  "update.install": "Установить и перезапустить",
  "update.later": "Позже",
  "update.downloading": "Загрузка… {percent}%",

  // --- Remote dialog ---
  "remote.title": "Удалённое управление",
  "remote.connected": "Подключено устройств: {n}",
  "remote.active": "Активно — нет подключений",
  "remote.creatingTunnel": "Создание публичного туннеля… (несколько секунд)",
  "remote.starting": "Запуск…",
  "remote.scanPublic": "Отсканируйте QR или откройте URL откуда угодно:",
  "remote.scanLan": "Та же локальная сеть — отсканируйте QR или откройте URL:",
  "remote.copy": "Копировать",
  "remote.installHint":
    "Установите <code>cloudflared</code>, чтобы управлять извне локальной сети.",
  "remote.warn": "⚠️ Любой, у кого есть эта ссылка, сможет управлять этим терминалом.",
  "remote.installBtn": "Установить и включить туннель",
  "remote.installing": "Установка…",
  "remote.stop": "Остановить удалённое управление",

  // --- Terminal search ---
  "search.placeholder": "Поиск…",
  "search.next": "Далее",
  "search.prev": "Назад",
  "search.close": "Закрыть",

  // --- Blocks panel ---
  "blocks.title": "Блоки",
  "blocks.empty": "Пока нет блоков команд.",
  "blocks.setupTitle": "Включить блоки команд",
  "blocks.copyCmd": "Копировать команду",
  "blocks.copyOutput": "Копировать вывод",
  "blocks.rerun": "Запустить снова",
  "blocks.remove": "Удалить",
  "blocks.explain": "Объяснить (ИИ)",

  // --- Terminal search (button titles with shortcuts) ---
  "search.prevTitle": "Назад (Shift+Enter)",
  "search.nextTitle": "Далее (Enter)",
  "search.closeTitle": "Закрыть (Esc)",
  "term.copyBlock": "Копировать команду + её вывод",

  // --- Notifications (banner bodies) ---
  "notif.cmdDone": "✓ Команда завершена",
  "notif.cmdFailed": "✗ Ошибка (код {code})",

  // --- AI explain seed prompt ---
  "ai.seedHeader": "Вот блок терминала:",
  "ai.seedCommand": "Команда: ",
  "ai.seedOutput": "Вывод:",
  "ai.seedExitCode": "Код возврата: ",
  "ai.seedAsk": "Кратко объясните, что происходит.",

  // --- Command palette (AI) ---
  "cmd.placeholder": "Сгенерировать команду для…",
  "cmd.escCancel": "Esc для отмены",
  "cmd.noCli":
    "<code>{cmd}</code> не найден в PATH — настройте провайдера в Настройки › ИИ.",
  "cmd.noProvider":
    "Провайдер ИИ не настроен — настройте его в Настройки › ИИ.",
  "cmd.cancel": "Отмена",
  "cmd.insertHint": "<kbd>Enter</kbd> чтобы вставить в терминал",
  "cmd.generateHint": "<kbd>Enter</kbd> чтобы сгенерировать",
  "cmd.reformulate": "Переформулировать",
  "cmd.insert": "Вставить",
  "cmd.unknownError": "Неизвестная ошибка",
  "cmd.retry": "Повторить",

  // --- Workflows palette ---
  "wf.searchPlaceholder": "Найти workflow…",
  "wf.empty": "Нет workflow. <code>~/.config/lume/workflows/*.yaml</code>",
  "wf.navHint": "<kbd>↑</kbd><kbd>↓</kbd> перемещение · <kbd>Enter</kbd> выбрать",
  "wf.back": "Назад",
  "wf.preview": "Предпросмотр",
  "wf.toComplete": "Нужно заполнить: {fields}",
  "wf.insertHint": "<kbd>Enter</kbd> чтобы вставить в терминал",
  "wf.insert": "Вставить",

  // --- SSH palette ---
  "ssh.placeholder": "SSH-хост или user@server…",
  "ssh.noMatch": "Подходящих хостов нет.",
  "ssh.noHosts":
    "Нет хостов в <code>~/.ssh/config</code>. Введите <code>user@server</code> для прямого подключения.",
  "ssh.connectTo": "Подключиться к",
  "ssh.directConnection": "прямое подключение",
  "ssh.navHint":
    "<kbd>↑</kbd><kbd>↓</kbd> перемещение · <kbd>Enter</kbd> подключиться (новая вкладка)",

  // --- Blocks panel (extended) ---
  "blocks.aiThinking": "{provider} думает…",
  "blocks.aiError": "Ошибка",
  "blocks.aiClose": "Закрыть",
  "blocks.followupPlaceholder": "Уточняющий вопрос…",
  "blocks.followupWait": "Подождите…",
  "blocks.send": "Отправить (Enter)",
  "blocks.emptyIntro":
    "<strong>Блок</strong> = команда + её вывод + её код возврата.",
  "blocks.emptyActive": "Пока нет команд — запустите одну, и она появится здесь.",
  "blocks.emptyHistory":
    "История появится здесь, как только ваш shell начнёт выдавать маркеры OSC 133.",
  "blocks.loading": "Загрузка…",
  "blocks.addLinePre": "Добавьте эту строку в",
  "blocks.addLinePost": "затем откройте новый shell:",
  "blocks.copy": "Копировать",
  "blocks.detected":
    "Обнаружено: <code>{shell}</code>. PTY экспортирует <code>LUME_TERM=1</code> — источник активируется только внутри Lume.",
  "blocks.shellUnknown": "неизвестный shell",
  "blocks.help": "Что это?",
  "blocks.helpIntro":
    "Каждая строка = выполненная команда + её результат. Lume определяет границы через OSC 133 (маркеры, выдаваемые вашим shell).",
  "blocks.exitOk": "exit 0",
  "blocks.exitErr": "exit ≠ 0",
  "blocks.exitRunning": "выполняется",
  "blocks.helpKeys":
    'Клик → прокрутка к приглашению в терминале.<br/>Правый клик → копировать, вставить, объяснить.<br/><kbd>Ctrl</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> → перемещение, <kbd>↩</kbd> чтобы вставить в терминал.<br/><span style="color: var(--accent)">✨</span> → объяснение от ИИ.',
  "blocks.resize": "Потяните, чтобы изменить размер",
  "blocks.filterPlaceholder": "Фильтр блоков…",
  "blocks.searchClose": "Закрыть (Esc)",
  "blocks.hide": "Скрыть (Ctrl+B)",
  "blocks.clickScroll": "Клик → прокрутка к приглашению",
  "blocks.promptNotTracked": "(строка приглашения не отслеживается)",
  "blocks.rightClickActions": "Правый клик → копировать, вставить, объяснить…",
  "blocks.promptNoCommand": "(приглашение без команды)",
  "blocks.outputCopied": "Вывод скопирован ✓",
  "blocks.commandCopied": "Команда скопирована ✓",
  "blocks.outputCaptured": "Вывод захвачен — Shift+Click, чтобы скопировать его",
  "blocks.aiNoCli": "{provider} CLI не найден в PATH",
  "blocks.aiBlockNotDone": "Блок должен быть завершён",
  "blocks.aiNoCommand": "Нет команды для объяснения",
  "blocks.cancel": "Отмена",
  "blocks.aiFixError": "Исправить эту ошибку с помощью {provider}",
  "blocks.aiExplainBlock": "Объяснить этот блок с помощью {provider}",
  "blocks.insertTerminal": "Вставить в терминал",
  "blocks.gotoCommand": "Перейти к команде в терминале",
  "blocks.explainClaude": "✨ Объяснить с помощью {provider}",
  "blocks.closeAiPanel": "Закрыть панель {provider}",
  "blocks.removeBlock": "Удалить этот блок",

  // --- Keybindings (configurable actions) ---
  "keys.action.newTab": "Новая вкладка",
  "keys.action.closeTab": "Закрыть панель / вкладку",
  "keys.action.nextTab": "Следующая вкладка",
  "keys.action.prevTab": "Предыдущая вкладка",
  "keys.action.splitH": "Разделить по горизонтали",
  "keys.action.splitV": "Разделить по вертикали",
  "keys.action.togglePanel": "Боковая панель блоков",
  "keys.action.search": "Фильтр блоков",
  "keys.action.termSearch": "Поиск в терминале",
  "keys.action.paletteAI": "Палитра ИИ",
  "keys.action.workflows": "Workflows",
  "keys.action.ssh": "SSH",
  "keys.action.copy": "Копировать",
  "keys.action.paste": "Вставить",
  "keys.action.settings": "Настройки",

  // --- Keybindings (fixed shortcuts) ---
  "keys.fixed.goToTab": "Перейти к вкладке N",
  "keys.fixed.zoom": "Масштаб текста (размер +/-)",
  "keys.fixed.zoomReset": "Размер текста по умолчанию",
  "keys.fixed.navPanes": "Перемещение между панелями (по кругу)",
  "keys.fixed.navBlocks": "Перемещение по блокам",

  // --- Theme colors ---
  "color.background": "Фон",
  "color.foreground": "Текст",
  "color.accent": "Акцент",
  "color.cursor": "Курсор",
  "color.selection": "Выделение",

  // --- Pane ---
  "pane.dragMove": "Потяните, чтобы переместить эту панель",
  "pane.swap": "Поменять местами",
  "pane.moveHere": "Переместить сюда",

  // --- Autocomplete footer ---
  "ac.complete": "<kbd>Tab</kbd> дополнить",
  "ac.navigate": "<kbd>↑</kbd><kbd>↓</kbd> перемещение",
  "ac.close": "<kbd>Esc</kbd> закрыть",

  // --- AI provider settings ---
  "nav.ai": "ИИ",
  "nav.fileTree": "Дерево файлов",
  "ai.provider": "Провайдер",
  "ai.custom": "Пользовательский (CLI)",
  "ai.model": "Модель",
  "ai.modelHint": "по умолчанию",
  "ai.status": "Статус",
  "ai.detected": "✓ {cmd} обнаружен",
  "ai.notFound": "✗ {cmd} не найден в PATH",
  "ai.recheck": "Перепроверить",
  "ai.apiKey": "Ключ API",
  "ai.command": "Команда",
  "ai.args": "Аргументы",
  "ai.keyEnv": "Переменная окружения для ключа API",
  "ai.claudeNote": "Использует CLI <code>claude</code> (Claude Code). Выполните <code>claude login</code> один раз для аутентификации.",
  "ai.codexNote": "Использует CLI <code>codex</code> (OpenAI). Аутентифицируйтесь с помощью <code>codex login</code> или задайте ключ API выше (внедряется как <code>OPENAI_API_KEY</code>).",
  "ai.customNote": "Любой CLI, который принимает prompt и выводит ответ в stdout. Поместите <code>{prompt}</code> в аргументы там, где должен быть prompt.",
  "ai.keysNote": "Ключи API хранятся локально в <code>~/.config/lume/config.toml</code> и исключаются из экспорта настроек.",
  "ai.customApi": "API, совместимый с OpenAI",
  "ai.baseUrl": "Базовый URL",
  "ai.configured": "✓ настроено",
  "ai.missingKey": "✗ требуется ключ API",
  "ai.openaiNote": "Использует API OpenAI. Создайте ключ на <code>platform.openai.com</code>.",
  "ai.deepseekNote": "Использует API DeepSeek (совместимый с OpenAI). Ключ на <code>platform.deepseek.com</code>.",
  "ai.apiNote": "Любая конечная точка, совместимая с OpenAI (Ollama, Groq, OpenRouter…). Укажите базовый URL, ключ и модель.",
};
