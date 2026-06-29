import type { Dict } from "../i18n";

export const ko: Dict = {
  // --- Settings: nav + general ---
  "settings.title": "설정",
  "settings.close": "닫기 (Esc)",
  "nav.appearance": "모양",
  "nav.shell": "셸",
  "nav.notifications": "알림",
  "nav.remote": "원격",
  "nav.keys": "단축키",
  "nav.general": "일반",
  "nav.about": "정보",

  // --- Appearance ---
  "appearance.font": "글꼴",
  "appearance.import": "가져오기",
  "appearance.importTitle": ".ttf/.otf/.woff 가져오기",
  "appearance.fontHint":
    "프롬프트 아이콘(Powerlevel10k, starship…)을 표시하려면 <strong>Nerd Font</strong>를 선택하세요 — 예: <code>MesloLGS NF</code>.",
  "appearance.fontCurrent": "(현재)",
  "appearance.fontImported": "가져온 글꼴",
  "appearance.fontSystem": "시스템 (고정폭)",
  "appearance.size": "크기",
  "appearance.cursorBlink": "커서 깜빡임",
  "appearance.cursorStyle": "커서 스타일",
  "cursor.block": "블록",
  "cursor.bar": "막대",
  "cursor.underline": "밑줄",
  "appearance.scrollback": "스크롤백 (줄)",
  "appearance.theme": "테마",
  "appearance.customTheme": "사용자 지정",
  "appearance.ansi": "ANSI 색상 (16)",
  "appearance.reset": "모양 초기화",

  // --- Shell ---
  "shell.program": "프로그램",
  "shell.programPlaceholder": "$SHELL (기본값)",
  "shell.args": "인수",
  "shell.argsPlaceholder": "예: -l",
  "shell.note": "<strong>새</strong> 터미널에 적용됩니다.",

  // --- Notifications ---
  "notif.enable": "긴 명령에 알림",
  "notif.minDuration": "최소 지속 시간 (초)",
  "notif.sound": "알림 소리",
  "notif.note":
    "명령이 이 시간을 초과하고 <strong>Lume이 포커스되지 않은 경우</strong> 시스템 알림이 표시됩니다.",

  // --- Keys ---
  "keys.hint":
    "단축키를 클릭한 다음 원하는 조합을 누르세요 (취소하려면 <kbd>Esc</kbd>).",
  "keys.reset": "단축키 초기화",
  "keys.recording": "키를 누르세요…",
  "keys.fixed": "고정 단축키",

  // --- General ---
  "general.language": "언어",
  "general.backup": "설정 백업",
  "general.exportImport": "전체 구성 내보내기 / 가져오기",
  "general.export": "내보내기",
  "general.import": "가져오기",
  "general.exported": "설정을 내보냈습니다 ✓",
  "general.exportFailed": "내보내기 실패",
  "general.imported": "설정을 가져왔습니다 ✓",
  "general.importFailed": "잘못된 파일",

  // --- About ---
  "about.version": "버전",
  "about.updates": "업데이트",
  "about.check": "확인",
  "about.checking": "확인 중…",
  "about.uptodate": "Lume이 최신 버전입니다 ✓",
  "about.checkError": "확인할 수 없습니다 (오프라인이거나 릴리스가 없습니다).",
  "about.available": "<strong>Lume {version}</strong>을(를) 사용할 수 있습니다.",
  "about.installRestart": "설치 후 다시 시작",
  "about.downloading": "다운로드 중… {percent}%",
  "about.updateNote":
    "업데이트는 서명되어 자동으로 설치됩니다 (AppImage 빌드). 시작 시 자동 확인.",

  // --- Toolbar (tab bar) ---
  "toolbar.fileTree": "파일 트리",
  "toolbar.layouts": "레이아웃 프리셋",
  "toolbar.blocks": "블록 (Ctrl+B)",
  "toolbar.workflows": "Workflows (Ctrl+Shift+R)",
  "toolbar.ssh": "SSH (Ctrl+Shift+S)",
  "toolbar.settings": "설정 (Ctrl+,)",
  "toolbar.newTab": "새 탭 (Ctrl+Shift+T)",
  "toolbar.closeTab": "닫기 (Ctrl+Shift+W)",
  "toolbar.prevTabs": "이전 탭",
  "toolbar.nextTabs": "다음 탭",
  "toolbar.remoteActive": "원격 제어 활성화됨 — 클릭하여 관리",

  // --- Layouts popup ---
  "layouts.title": "레이아웃 적용",
  "layouts.single": "단일",
  "layouts.twoCols": "2열",
  "layouts.twoRows": "2행",
  "layouts.grid": "2×2 그리드",
  "layouts.mainSide": "메인 + 2",
  "layouts.tripleCol": "3열",
  "layouts.note":
    "활성 터미널은 첫 번째 슬롯에 유지됩니다. 탭의 다른 셸은 닫힙니다.",

  // --- Pane context menu ---
  "pane.copy": "⧉ 복사 (Ctrl+Shift+C)",
  "pane.paste": "⎘ 붙여넣기 (Ctrl+Shift+V)",
  "pane.splitH": "⬌ 가로로 분할",
  "pane.splitV": "⬍ 세로로 분할",
  "pane.remote": "⇆ 원격으로 제어",
  "pane.newTab": "+ 새 탭",
  "pane.close": "× 이 창 닫기",
  "pane.closeTab": " (탭을 닫습니다)",

  // --- Tab context menu ---
  "tab.rename": "✎ 이름 변경 (더블 클릭)",
  "tab.splitH": "⬌ 가로로 분할 (Ctrl+Shift+D)",
  "tab.splitV": "⬍ 세로로 분할 (Ctrl+Shift+E)",
  "tab.newTab": "+ 새 탭 (Ctrl+Shift+T)",
  "tab.close": "× 이 탭 닫기",
  "tab.panes": " ({n}개 창)",

  // --- File tree ---
  "ft.hidden": "숨김 파일",
  "ft.refresh": "새로 고침",
  "ft.close": "닫기",
  "ft.unknownDir": "알 수 없는 디렉터리",
  "ft.denied": "접근 거부됨",
  "ft.empty": "비어 있음",
  "ft.cmdNote":
    "컨텍스트 메뉴 명령은 활성 터미널에서 실행됩니다. <code>{path}</code>는 항목의 경로로 바뀝니다.",
  "ft.dirList": "폴더 나열",
  "ft.dirOpen": "편집기에서 폴더 열기",
  "ft.fileView": "파일 보기",
  "ft.fileEdit": "파일 편집",
  "ft.fileOpen": "편집기에서 파일 열기",
  "ft.resetCmds": "명령 초기화",
  "ftctx.cd": "폴더 열기",
  "ftctx.ls": "나열",
  "ftctx.editor": "편집기에서 열기",
  "ftctx.cat": "보기",
  "ftctx.nano": "편집",
  "ftctx.openEditor": "편집기에서 열기",
  "ftctx.copyPath": "경로 복사",
  "ftctx.insertPath": "경로 삽입",

  // --- Update banner ---
  "update.available": "<strong>Lume {version}</strong>을(를) 사용할 수 있습니다",
  "update.failed": "실패, 다시 시도",
  "update.install": "설치 후 다시 시작",
  "update.later": "나중에",
  "update.downloading": "다운로드 중… {percent}%",

  // --- Remote dialog ---
  "remote.title": "원격 제어",
  "remote.connected": "{n}대 연결됨",
  "remote.active": "활성 — 연결 없음",
  "remote.creatingTunnel": "공개 터널 생성 중… (몇 초 소요)",
  "remote.starting": "시작 중…",
  "remote.scanPublic": "어디서든 QR을 스캔하거나 URL을 여세요:",
  "remote.scanLan": "동일한 로컬 네트워크 — QR을 스캔하거나 URL을 여세요:",
  "remote.copy": "복사",
  "remote.installHint":
    "로컬 네트워크 외부에서 제어하려면 <code>cloudflared</code>를 설치하세요.",
  "remote.warn": "⚠️ 이 링크가 있는 사람은 누구나 이 터미널을 조작할 수 있습니다.",
  "remote.installBtn": "터널 설치 및 활성화",
  "remote.installing": "설치 중…",
  "remote.stop": "원격 제어 중지",

  // --- Terminal search ---
  "search.placeholder": "검색…",
  "search.next": "다음",
  "search.prev": "이전",
  "search.close": "닫기",

  // --- Blocks panel ---
  "blocks.title": "블록",
  "blocks.empty": "아직 명령 블록이 없습니다.",
  "blocks.setupTitle": "명령 블록 활성화",
  "blocks.copyCmd": "명령 복사",
  "blocks.copyOutput": "출력 복사",
  "blocks.rerun": "다시 실행",
  "blocks.remove": "제거",
  "blocks.explain": "설명 (AI)",

  // --- Terminal search (button titles with shortcuts) ---
  "search.prevTitle": "이전 (Shift+Enter)",
  "search.nextTitle": "다음 (Enter)",
  "search.closeTitle": "닫기 (Esc)",
  "term.copyBlock": "명령 + 출력 복사",

  // --- Notifications (banner bodies) ---
  "notif.cmdDone": "✓ 명령 완료",
  "notif.cmdFailed": "✗ 실패 (종료 {code})",

  // --- AI explain seed prompt ---
  "ai.seedHeader": "다음은 터미널 블록입니다:",
  "ai.seedCommand": "명령: ",
  "ai.seedOutput": "출력:",
  "ai.seedExitCode": "종료 코드: ",
  "ai.seedAsk": "무슨 일이 일어나고 있는지 간단히 설명하세요.",

  // --- Command palette (AI) ---
  "cmd.placeholder": "다음에 대한 명령 생성…",
  "cmd.escCancel": "취소하려면 Esc",
  "cmd.noCli":
    "PATH에서 <code>{cmd}</code>을(를) 찾을 수 없습니다 — 설정 › AI에서 공급자를 구성하세요.",
  "cmd.noProvider":
    "구성된 AI 공급자가 없습니다 — 설정 › AI에서 하나를 설정하세요.",
  "cmd.cancel": "취소",
  "cmd.insertHint": "터미널에 삽입하려면 <kbd>Enter</kbd>",
  "cmd.generateHint": "생성하려면 <kbd>Enter</kbd>",
  "cmd.reformulate": "다시 표현",
  "cmd.insert": "삽입",
  "cmd.unknownError": "알 수 없는 오류",
  "cmd.retry": "다시 시도",

  // --- Workflows palette ---
  "wf.searchPlaceholder": "Workflow 검색…",
  "wf.empty": "Workflow가 없습니다. <code>~/.config/lume/workflows/*.yaml</code>",
  "wf.navHint": "<kbd>↑</kbd><kbd>↓</kbd> 이동 · <kbd>Enter</kbd> 선택",
  "wf.back": "뒤로",
  "wf.preview": "미리 보기",
  "wf.toComplete": "입력 필요: {fields}",
  "wf.insertHint": "터미널에 삽입하려면 <kbd>Enter</kbd>",
  "wf.insert": "삽입",

  // --- SSH palette ---
  "ssh.placeholder": "SSH 호스트 또는 user@server…",
  "ssh.noMatch": "일치하는 호스트가 없습니다.",
  "ssh.noHosts":
    "<code>~/.ssh/config</code>에 호스트가 없습니다. <code>user@server</code>를 입력하면 직접 연결할 수 있습니다.",
  "ssh.connectTo": "연결",
  "ssh.directConnection": "직접 연결",
  "ssh.navHint":
    "<kbd>↑</kbd><kbd>↓</kbd> 이동 · <kbd>Enter</kbd> 연결 (새 탭)",

  // --- Blocks panel (extended) ---
  "blocks.aiThinking": "{provider}이 생각 중…",
  "blocks.aiError": "오류",
  "blocks.aiClose": "닫기",
  "blocks.followupPlaceholder": "추가 질문…",
  "blocks.followupWait": "잠시 기다려 주세요…",
  "blocks.send": "보내기 (Enter)",
  "blocks.emptyIntro":
    "<strong>블록</strong> = 명령 + 출력 + 종료 코드.",
  "blocks.emptyActive": "아직 명령이 없습니다 — 하나 실행하면 여기에 나타납니다.",
  "blocks.emptyHistory":
    "셸이 OSC 133 마커를 내보내면 기록이 여기에 표시됩니다.",
  "blocks.loading": "불러오는 중…",
  "blocks.addLinePre": "이 줄을 추가할 위치:",
  "blocks.addLinePost": "그런 다음 새 셸을 여세요:",
  "blocks.copy": "복사",
  "blocks.detected":
    "감지됨: <code>{shell}</code>. PTY가 <code>LUME_TERM=1</code>을 내보냅니다 — 소스는 Lume 내부에서만 활성화됩니다.",
  "blocks.shellUnknown": "알 수 없는 셸",
  "blocks.help": "이게 뭔가요?",
  "blocks.helpIntro":
    "각 줄 = 실행된 명령 + 결과. Lume은 OSC 133(셸이 내보내는 마커)을 통해 경계를 감지합니다.",
  "blocks.exitOk": "exit 0",
  "blocks.exitErr": "exit ≠ 0",
  "blocks.exitRunning": "실행 중",
  "blocks.helpKeys":
    '클릭 → 터미널의 프롬프트로 스크롤.<br/>오른쪽 클릭 → 복사, 삽입, 설명.<br/><kbd>Ctrl</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> → 이동, 터미널에 삽입하려면 <kbd>↩</kbd>.<br/><span style="color: var(--accent)">✨</span> → AI 설명.',
  "blocks.resize": "드래그하여 크기 조절",
  "blocks.filterPlaceholder": "블록 필터…",
  "blocks.searchClose": "닫기 (Esc)",
  "blocks.hide": "숨기기 (Ctrl+B)",
  "blocks.clickScroll": "클릭 → 프롬프트로 스크롤",
  "blocks.promptNotTracked": "(프롬프트 줄이 추적되지 않음)",
  "blocks.rightClickActions": "오른쪽 클릭 → 복사, 삽입, 설명…",
  "blocks.promptNoCommand": "(명령 없는 프롬프트)",
  "blocks.outputCopied": "출력이 복사되었습니다 ✓",
  "blocks.commandCopied": "명령이 복사되었습니다 ✓",
  "blocks.outputCaptured": "출력이 캡처되었습니다 — 복사하려면 Shift+Click",
  "blocks.aiNoCli": "PATH에서 {provider} CLI를 찾을 수 없습니다",
  "blocks.aiBlockNotDone": "블록이 완료되어야 합니다",
  "blocks.aiNoCommand": "설명할 명령이 없습니다",
  "blocks.cancel": "취소",
  "blocks.aiFixError": "{provider}으로 이 오류 고치기",
  "blocks.aiExplainBlock": "{provider}으로 이 블록 설명하기",
  "blocks.insertTerminal": "터미널에 삽입",
  "blocks.gotoCommand": "터미널의 명령으로 이동",
  "blocks.explainClaude": "✨ {provider}으로 설명",
  "blocks.closeAiPanel": "{provider} 패널 닫기",
  "blocks.removeBlock": "이 블록 제거",

  // --- Keybindings (configurable actions) ---
  "keys.action.newTab": "새 탭",
  "keys.action.closeTab": "창 / 탭 닫기",
  "keys.action.nextTab": "다음 탭",
  "keys.action.prevTab": "이전 탭",
  "keys.action.splitH": "가로로 분할",
  "keys.action.splitV": "세로로 분할",
  "keys.action.togglePanel": "블록 사이드바",
  "keys.action.search": "블록 필터",
  "keys.action.termSearch": "터미널에서 검색",
  "keys.action.paletteAI": "AI 팔레트",
  "keys.action.workflows": "Workflows",
  "keys.action.ssh": "SSH",
  "keys.action.copy": "복사",
  "keys.action.paste": "붙여넣기",
  "keys.action.settings": "설정",

  // --- Keybindings (fixed shortcuts) ---
  "keys.fixed.goToTab": "N번 탭으로 이동",
  "keys.fixed.zoom": "텍스트 확대/축소 (크기 +/-)",
  "keys.fixed.zoomReset": "기본 텍스트 크기",
  "keys.fixed.navPanes": "창 사이 이동 (순환)",
  "keys.fixed.navBlocks": "블록 이동",

  // --- Theme colors ---
  "color.background": "배경",
  "color.foreground": "텍스트",
  "color.accent": "강조색",
  "color.cursor": "커서",
  "color.selection": "선택 영역",

  // --- Pane ---
  "pane.dragMove": "드래그하여 이 창 이동",
  "pane.swap": "교체",
  "pane.moveHere": "여기로 이동",

  // --- Autocomplete footer ---
  "ac.complete": "<kbd>Tab</kbd> 완성",
  "ac.navigate": "<kbd>↑</kbd><kbd>↓</kbd> 이동",
  "ac.close": "<kbd>Esc</kbd> 닫기",

  // --- AI provider settings ---
  "nav.ai": "AI",
  "nav.fileTree": "파일 트리",
  "ai.provider": "공급자",
  "ai.custom": "사용자 지정 (CLI)",
  "ai.model": "모델",
  "ai.modelHint": "기본값",
  "ai.status": "상태",
  "ai.detected": "✓ {cmd} 감지됨",
  "ai.notFound": "✗ PATH에서 {cmd}를 찾을 수 없음",
  "ai.recheck": "다시 확인",
  "ai.apiKey": "API 키",
  "ai.command": "명령",
  "ai.args": "인수",
  "ai.keyEnv": "API 키 환경 변수",
  "ai.claudeNote": "<code>claude</code> CLI(Claude Code)를 사용합니다. 인증하려면 <code>claude login</code>을 한 번 실행하세요.",
  "ai.codexNote": "<code>codex</code> CLI(OpenAI)를 사용합니다. <code>codex login</code>으로 인증하거나 위에서 API 키를 설정하세요(<code>OPENAI_API_KEY</code>로 주입됨).",
  "ai.customNote": "prompt를 받아 답변을 stdout으로 출력하는 모든 CLI. prompt가 들어갈 위치에 인수에서 <code>{prompt}</code>를 넣으세요.",
  "ai.keysNote": "API 키는 <code>~/.config/lume/config.toml</code>에 로컬로 저장되며 설정 내보내기에서 제외됩니다.",
  "ai.customApi": "OpenAI 호환 API",
  "ai.baseUrl": "기본 URL",
  "ai.configured": "✓ 구성됨",
  "ai.missingKey": "✗ API 키가 필요합니다",
  "ai.openaiNote": "OpenAI API를 사용합니다. <code>platform.openai.com</code>에서 키를 생성하세요.",
  "ai.deepseekNote": "DeepSeek API를 사용합니다(OpenAI 호환). 키는 <code>platform.deepseek.com</code>에서 발급받으세요.",
  "ai.apiNote": "모든 OpenAI 호환 엔드포인트(Ollama, Groq, OpenRouter…). 기본 URL, 키, 모델을 설정하세요.",
};
