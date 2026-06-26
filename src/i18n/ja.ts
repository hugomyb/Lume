import type { Dict } from "../i18n";

export const ja: Dict = {
  // --- Settings: nav + general ---
  "settings.title": "設定",
  "settings.close": "閉じる (Esc)",
  "nav.appearance": "外観",
  "nav.shell": "シェル",
  "nav.notifications": "通知",
  "nav.remote": "リモート",
  "nav.keys": "ショートカット",
  "nav.general": "一般",
  "nav.about": "情報",

  // --- Appearance ---
  "appearance.font": "フォント",
  "appearance.import": "インポート",
  "appearance.importTitle": ".ttf/.otf/.woff をインポート",
  "appearance.fontHint":
    "プロンプトのアイコン (Powerlevel10k、starship…) には <strong>Nerd Font</strong> を選択してください — 例: <code>MesloLGS NF</code>。",
  "appearance.fontCurrent": "(現在)",
  "appearance.fontImported": "インポート済み",
  "appearance.fontSystem": "システム (等幅)",
  "appearance.size": "サイズ",
  "appearance.cursorBlink": "カーソルを点滅",
  "appearance.cursorStyle": "カーソルのスタイル",
  "cursor.block": "ブロック",
  "cursor.bar": "バー",
  "cursor.underline": "下線",
  "appearance.scrollback": "スクロールバック (行)",
  "appearance.theme": "テーマ",
  "appearance.ansi": "ANSI カラー (16)",
  "appearance.reset": "外観をリセット",

  // --- Shell ---
  "shell.program": "プログラム",
  "shell.programPlaceholder": "$SHELL (デフォルト)",
  "shell.args": "引数",
  "shell.argsPlaceholder": "例: -l",
  "shell.note": "<strong>新しい</strong>ターミナルに適用されます。",

  // --- Notifications ---
  "notif.enable": "長いコマンドを通知",
  "notif.minDuration": "最小時間 (秒)",
  "notif.sound": "通知音",
  "notif.note":
    "コマンドがこの時間を超え、<strong>かつ Lume が前面にない場合</strong>にシステム通知が表示されます。",

  // --- Keys ---
  "keys.hint":
    "ショートカットをクリックして、目的のキーの組み合わせを押してください (<kbd>Esc</kbd> でキャンセル)。",
  "keys.reset": "ショートカットをリセット",
  "keys.recording": "キーを押してください…",
  "keys.fixed": "固定ショートカット",

  // --- General ---
  "general.language": "言語",
  "general.backup": "設定のバックアップ",
  "general.exportImport": "設定全体をエクスポート / インポート",
  "general.export": "エクスポート",
  "general.import": "インポート",
  "general.exported": "設定をエクスポートしました ✓",
  "general.exportFailed": "エクスポートに失敗しました",
  "general.imported": "設定をインポートしました ✓",
  "general.importFailed": "無効なファイルです",

  // --- About ---
  "about.version": "バージョン",
  "about.updates": "アップデート",
  "about.check": "確認",
  "about.checking": "確認中…",
  "about.uptodate": "Lume は最新です ✓",
  "about.checkError": "確認できませんでした (オフライン、またはリリースがありません)。",
  "about.available": "<strong>Lume {version}</strong> が利用可能です。",
  "about.installRestart": "インストールして再起動",
  "about.downloading": "ダウンロード中… {percent}%",
  "about.updateNote":
    "アップデートは署名され、自動的にインストールされます (AppImage ビルド)。起動時に自動確認します。",

  // --- Toolbar (tab bar) ---
  "toolbar.fileTree": "ファイルツリー",
  "toolbar.layouts": "レイアウトプリセット",
  "toolbar.blocks": "ブロック (Ctrl+B)",
  "toolbar.workflows": "Workflows (Ctrl+Shift+R)",
  "toolbar.ssh": "SSH (Ctrl+Shift+S)",
  "toolbar.settings": "設定 (Ctrl+,)",
  "toolbar.newTab": "新規 (Ctrl+Shift+T)",
  "toolbar.closeTab": "閉じる (Ctrl+Shift+W)",
  "toolbar.prevTabs": "前のタブ",
  "toolbar.nextTabs": "次のタブ",
  "toolbar.remoteActive": "リモート操作が有効 — クリックして管理",

  // --- Layouts popup ---
  "layouts.title": "レイアウトを適用",
  "layouts.single": "シングル",
  "layouts.twoCols": "2 カラム",
  "layouts.twoRows": "2 行",
  "layouts.grid": "2×2 グリッド",
  "layouts.mainSide": "メイン + 2",
  "layouts.tripleCol": "3 カラム",
  "layouts.note":
    "アクティブなターミナルが最初のスロットに保持されます。タブの他のシェルは閉じられます。",

  // --- Pane context menu ---
  "pane.copy": "⧉ コピー (Ctrl+Shift+C)",
  "pane.paste": "⎘ 貼り付け (Ctrl+Shift+V)",
  "pane.splitH": "⬌ 水平に分割",
  "pane.splitV": "⬍ 垂直に分割",
  "pane.remote": "⇆ リモート操作",
  "pane.newTab": "+ 新しいタブ",
  "pane.close": "× このペインを閉じる",
  "pane.closeTab": " (タブを閉じます)",

  // --- Tab context menu ---
  "tab.rename": "✎ 名前を変更 (ダブルクリック)",
  "tab.splitH": "⬌ 水平に分割 (Ctrl+Shift+D)",
  "tab.splitV": "⬍ 垂直に分割 (Ctrl+Shift+E)",
  "tab.newTab": "+ 新しいタブ (Ctrl+Shift+T)",
  "tab.close": "× このタブを閉じる",
  "tab.panes": " ({n} ペイン)",

  // --- File tree ---
  "ft.hidden": "隠しファイル",
  "ft.refresh": "更新",
  "ft.close": "閉じる",
  "ft.unknownDir": "不明なディレクトリ",
  "ft.denied": "アクセスが拒否されました",
  "ft.empty": "空",
  "ftctx.cd": "フォルダを開く",
  "ftctx.ls": "一覧 (ls -la)",
  "ftctx.editor": "エディタで開く",
  "ftctx.cat": "表示 (cat)",
  "ftctx.nano": "編集 (nano)",
  "ftctx.openEditor": "開く ($EDITOR)",
  "ftctx.copyPath": "パスをコピー",
  "ftctx.insertPath": "パスを挿入",

  // --- Update banner ---
  "update.available": "<strong>Lume {version}</strong> が利用可能です",
  "update.failed": "失敗しました。再試行",
  "update.install": "インストールして再起動",
  "update.later": "後で",
  "update.downloading": "ダウンロード中… {percent}%",

  // --- Remote dialog ---
  "remote.title": "リモート操作",
  "remote.connected": "{n} 台のデバイスが接続中",
  "remote.active": "有効 — 接続なし",
  "remote.creatingTunnel": "公開トンネルを作成中… (数秒)",
  "remote.starting": "起動中…",
  "remote.scanPublic": "QR をスキャンするか、どこからでも URL を開いてください:",
  "remote.scanLan": "同じローカルネットワーク — QR をスキャンするか URL を開いてください:",
  "remote.copy": "コピー",
  "remote.installHint":
    "ローカルネットワークの外から操作するには <code>cloudflared</code> をインストールしてください。",
  "remote.warn": "⚠️ このリンクを知っている人は誰でもこのターミナルを操作できます。",
  "remote.installBtn": "インストールしてトンネルを有効化",
  "remote.installing": "インストール中…",
  "remote.stop": "リモート操作を停止",

  // --- Terminal search ---
  "search.placeholder": "検索…",
  "search.next": "次へ",
  "search.prev": "前へ",
  "search.close": "閉じる",

  // --- Blocks panel ---
  "blocks.title": "ブロック",
  "blocks.empty": "まだコマンドブロックはありません。",
  "blocks.setupTitle": "コマンドブロックを有効化",
  "blocks.copyCmd": "コマンドをコピー",
  "blocks.copyOutput": "出力をコピー",
  "blocks.rerun": "再実行",
  "blocks.remove": "削除",
  "blocks.explain": "説明 (AI)",

  // --- Terminal search (button titles with shortcuts) ---
  "search.prevTitle": "前へ (Shift+Enter)",
  "search.nextTitle": "次へ (Enter)",
  "search.closeTitle": "閉じる (Esc)",
  "term.copyBlock": "コマンドと出力をコピー",

  // --- Notifications (banner bodies) ---
  "notif.cmdDone": "✓ コマンドが完了しました",
  "notif.cmdFailed": "✗ 失敗 (exit {code})",

  // --- AI explain seed prompt ---
  "ai.seedHeader": "ターミナルのブロックです:",
  "ai.seedCommand": "コマンド: ",
  "ai.seedOutput": "出力:",
  "ai.seedExitCode": "終了コード: ",
  "ai.seedAsk": "何が起きているか簡潔に説明してください。",

  // --- Command palette (AI) ---
  "cmd.placeholder": "コマンドを生成…",
  "cmd.escCancel": "Esc でキャンセル",
  "cmd.noCli":
    "Claude CLI が見つかりません。ターミナルで <code>claude login</code> を実行してから Lume を再起動してください。",
  "cmd.cancel": "キャンセル",
  "cmd.insertHint": "<kbd>Enter</kbd> でターミナルに挿入",
  "cmd.generateHint": "<kbd>Enter</kbd> で生成",
  "cmd.reformulate": "言い換え",
  "cmd.insert": "挿入",
  "cmd.unknownError": "不明なエラー",
  "cmd.retry": "再試行",

  // --- Workflows palette ---
  "wf.searchPlaceholder": "Workflow を検索…",
  "wf.empty": "Workflow がありません。<code>~/.config/lume/workflows/*.yaml</code>",
  "wf.navHint": "<kbd>↑</kbd><kbd>↓</kbd> 移動 · <kbd>Enter</kbd> 選択",
  "wf.back": "戻る",
  "wf.preview": "プレビュー",
  "wf.toComplete": "入力が必要: {fields}",
  "wf.insertHint": "<kbd>Enter</kbd> でターミナルに挿入",
  "wf.insert": "挿入",

  // --- SSH palette ---
  "ssh.placeholder": "SSH ホストまたは user@server…",
  "ssh.noMatch": "一致するホストがありません。",
  "ssh.noHosts":
    "<code>~/.ssh/config</code> にホストがありません。<code>user@server</code> を入力すると直接接続できます。",
  "ssh.connectTo": "接続先",
  "ssh.directConnection": "直接接続",
  "ssh.navHint":
    "<kbd>↑</kbd><kbd>↓</kbd> 移動 · <kbd>Enter</kbd> 接続 (新しいタブ)",

  // --- Blocks panel (extended) ---
  "blocks.aiThinking": "Claude が考えています…",
  "blocks.aiError": "エラー",
  "blocks.aiClose": "閉じる",
  "blocks.followupPlaceholder": "追加の質問…",
  "blocks.followupWait": "お待ちください…",
  "blocks.send": "送信 (Enter)",
  "blocks.emptyIntro":
    "<strong>ブロック</strong> = コマンド + 出力 + 終了コード。",
  "blocks.emptyActive": "まだコマンドがありません — 実行するとここに表示されます。",
  "blocks.emptyHistory":
    "シェルが OSC 133 マーカーを出力すると、履歴がここに表示されます。",
  "blocks.loading": "読み込み中…",
  "blocks.addLinePre": "この行を追加先",
  "blocks.addLinePost": "してから新しいシェルを開いてください:",
  "blocks.copy": "コピー",
  "blocks.detected":
    "検出: <code>{shell}</code>。PTY は <code>LUME_TERM=1</code> をエクスポートします — source は Lume 内でのみ有効になります。",
  "blocks.shellUnknown": "不明なシェル",
  "blocks.help": "これは何ですか?",
  "blocks.helpIntro":
    "各行 = 実行したコマンド + その結果。Lume は OSC 133 (シェルが出力するマーカー) で境界を検出します。",
  "blocks.exitOk": "exit 0",
  "blocks.exitErr": "exit ≠ 0",
  "blocks.exitRunning": "実行中",
  "blocks.helpKeys":
    'クリック → ターミナルのプロンプトへスクロール。<br/>右クリック → コピー、挿入、説明。<br/><kbd>Ctrl</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> → 移動、<kbd>↩</kbd> でターミナルに挿入。<br/><span style="color: var(--accent)">✨</span> → Claude による説明。',
  "blocks.resize": "ドラッグでサイズ変更",
  "blocks.filterPlaceholder": "ブロックを絞り込み…",
  "blocks.searchClose": "閉じる (Esc)",
  "blocks.hide": "非表示 (Ctrl+B)",
  "blocks.clickScroll": "クリック → プロンプトへスクロール",
  "blocks.promptNotTracked": "(プロンプト行は追跡されていません)",
  "blocks.rightClickActions": "右クリック → コピー、挿入、説明…",
  "blocks.promptNoCommand": "(コマンドなしのプロンプト)",
  "blocks.outputCopied": "出力をコピーしました ✓",
  "blocks.commandCopied": "コマンドをコピーしました ✓",
  "blocks.outputCaptured": "出力をキャプチャしました — Shift+クリックでコピー",
  "blocks.aiNoCli": "Claude CLI が見つかりません (claude login)",
  "blocks.aiBlockNotDone": "ブロックが完了している必要があります",
  "blocks.aiNoCommand": "説明するコマンドがありません",
  "blocks.cancel": "キャンセル",
  "blocks.aiFixError": "Claude でこのエラーを修正",
  "blocks.aiExplainBlock": "Claude でこのブロックを説明",
  "blocks.insertTerminal": "ターミナルに挿入",
  "blocks.gotoCommand": "ターミナルのコマンドへ移動",
  "blocks.explainClaude": "✨ Claude で説明",
  "blocks.closeAiPanel": "Claude パネルを閉じる",
  "blocks.removeBlock": "このブロックを削除",

  // --- Keybindings (configurable actions) ---
  "keys.action.newTab": "新しいタブ",
  "keys.action.closeTab": "ペイン / タブを閉じる",
  "keys.action.nextTab": "次のタブ",
  "keys.action.prevTab": "前のタブ",
  "keys.action.splitH": "水平に分割",
  "keys.action.splitV": "垂直に分割",
  "keys.action.togglePanel": "ブロックのサイドバー",
  "keys.action.search": "ブロックを絞り込み",
  "keys.action.termSearch": "ターミナル内を検索",
  "keys.action.paletteAI": "AI パレット",
  "keys.action.workflows": "Workflows",
  "keys.action.ssh": "SSH",
  "keys.action.copy": "コピー",
  "keys.action.paste": "貼り付け",
  "keys.action.settings": "設定",

  // --- Keybindings (fixed shortcuts) ---
  "keys.fixed.goToTab": "タブ N へ移動",
  "keys.fixed.zoom": "テキストのズーム (サイズ +/-)",
  "keys.fixed.zoomReset": "デフォルトのテキストサイズ",
  "keys.fixed.navPanes": "ペイン間を移動 (ループ)",
  "keys.fixed.navBlocks": "ブロック間を移動",

  // --- Theme colors ---
  "color.background": "背景",
  "color.foreground": "テキスト",
  "color.accent": "アクセント",
  "color.cursor": "カーソル",
  "color.selection": "選択範囲",

  // --- Pane ---
  "pane.dragMove": "ドラッグしてこのペインを移動",
  "pane.swap": "入れ替え",
  "pane.moveHere": "ここに移動",

  // --- Autocomplete footer ---
  "ac.complete": "<kbd>Tab</kbd> 補完",
  "ac.navigate": "<kbd>↑</kbd><kbd>↓</kbd> 移動",
  "ac.close": "<kbd>Esc</kbd> 閉じる",
};
