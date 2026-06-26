import type { Dict } from "../i18n";

export const tr: Dict = {
  // --- Settings: nav + general ---
  "settings.title": "Ayarlar",
  "settings.close": "Kapat (Esc)",
  "nav.appearance": "Görünüm",
  "nav.shell": "Shell",
  "nav.notifications": "Bildirimler",
  "nav.remote": "Remote",
  "nav.keys": "Kısayollar",
  "nav.general": "Genel",
  "nav.about": "Hakkında",

  // --- Appearance ---
  "appearance.font": "Yazı tipi",
  "appearance.import": "İçe aktar",
  "appearance.importTitle": "Bir .ttf/.otf/.woff içe aktar",
  "appearance.fontHint":
    "Prompt simgeleri için (Powerlevel10k, starship…) bir <strong>Nerd Font</strong> seç — örneğin <code>MesloLGS NF</code>.",
  "appearance.fontCurrent": "(geçerli)",
  "appearance.fontImported": "İçe aktarılan",
  "appearance.fontSystem": "Sistem (eş aralıklı)",
  "appearance.size": "Boyut",
  "appearance.cursorBlink": "Yanıp sönen imleç",
  "appearance.cursorStyle": "İmleç stili",
  "cursor.block": "Blok",
  "cursor.bar": "Çubuk",
  "cursor.underline": "Alt çizgi",
  "appearance.scrollback": "Geri kaydırma (satır)",
  "appearance.theme": "Tema",
  "appearance.ansi": "ANSI renkleri (16)",
  "appearance.reset": "Görünümü sıfırla",

  // --- Shell ---
  "shell.program": "Program",
  "shell.programPlaceholder": "$SHELL (varsayılan)",
  "shell.args": "Argümanlar",
  "shell.argsPlaceholder": "örn. -l",
  "shell.note": "<strong>Yeni</strong> terminallere uygulanır.",

  // --- Notifications ---
  "notif.enable": "Uzun komutlarda bildir",
  "notif.minDuration": "Minimum süre (sn)",
  "notif.sound": "Bildirim sesi",
  "notif.note":
    "Bir komut bu süreyi aştığında <strong>ve Lume odakta değilken</strong> bir sistem bildirimi gösterilir.",

  // --- Keys ---
  "keys.hint":
    "Bir kısayola tıklayın, ardından istediğiniz kombinasyona basın (iptal için <kbd>Esc</kbd>).",
  "keys.reset": "Kısayolları sıfırla",
  "keys.recording": "Bir tuşa basın…",
  "keys.fixed": "Sabit kısayollar",

  // --- General ---
  "general.language": "Dil",
  "general.backup": "Ayar yedeği",
  "general.exportImport": "Tüm yapılandırmayı dışa / içe aktar",
  "general.export": "Dışa aktar",
  "general.import": "İçe aktar",
  "general.exported": "Ayarlar dışa aktarıldı ✓",
  "general.exportFailed": "Dışa aktarma başarısız",
  "general.imported": "Ayarlar içe aktarıldı ✓",
  "general.importFailed": "Geçersiz dosya",

  // --- About ---
  "about.version": "Sürüm",
  "about.updates": "Güncellemeler",
  "about.check": "Denetle",
  "about.checking": "Denetleniyor…",
  "about.uptodate": "Lume güncel ✓",
  "about.checkError": "Denetlenemedi (çevrimdışı veya sürüm yok).",
  "about.available": "<strong>Lume {version}</strong> kullanılabilir.",
  "about.installRestart": "Kur ve yeniden başlat",
  "about.downloading": "İndiriliyor… %{percent}",
  "about.updateNote":
    "Güncellemeler imzalanır ve otomatik olarak kurulur (AppImage derlemesi). Başlangıçta otomatik denetim.",

  // --- Toolbar (tab bar) ---
  "toolbar.fileTree": "Dosya ağacı",
  "toolbar.layouts": "Yerleşim ön ayarları",
  "toolbar.blocks": "Bloklar (Ctrl+B)",
  "toolbar.workflows": "Workflows (Ctrl+Shift+R)",
  "toolbar.ssh": "SSH (Ctrl+Shift+S)",
  "toolbar.settings": "Ayarlar (Ctrl+,)",
  "toolbar.newTab": "Yeni (Ctrl+Shift+T)",
  "toolbar.closeTab": "Kapat (Ctrl+Shift+W)",
  "toolbar.prevTabs": "Önceki sekmeler",
  "toolbar.nextTabs": "Sonraki sekmeler",
  "toolbar.remoteActive": "Uzaktan kontrol etkin — yönetmek için tıklayın",

  // --- Layouts popup ---
  "layouts.title": "Bir yerleşim uygula",
  "layouts.single": "Tek",
  "layouts.twoCols": "2 sütun",
  "layouts.twoRows": "2 satır",
  "layouts.grid": "2×2 ızgara",
  "layouts.mainSide": "Ana + 2",
  "layouts.tripleCol": "3 sütun",
  "layouts.note":
    "Etkin terminal ilk yuvada tutulur. Sekmenin diğer shell'leri kapatılır.",

  // --- Pane context menu ---
  "pane.copy": "⧉ Kopyala (Ctrl+Shift+C)",
  "pane.paste": "⎘ Yapıştır (Ctrl+Shift+V)",
  "pane.splitH": "⬌ Yatay böl",
  "pane.splitV": "⬍ Dikey böl",
  "pane.remote": "⇆ Uzaktan kontrol et",
  "pane.newTab": "+ Yeni sekme",
  "pane.close": "× Bu bölmeyi kapat",
  "pane.closeTab": " (sekmeyi kapatır)",

  // --- Tab context menu ---
  "tab.rename": "✎ Yeniden adlandır (çift tıkla)",
  "tab.splitH": "⬌ Yatay böl (Ctrl+Shift+D)",
  "tab.splitV": "⬍ Dikey böl (Ctrl+Shift+E)",
  "tab.newTab": "+ Yeni sekme (Ctrl+Shift+T)",
  "tab.close": "× Bu sekmeyi kapat",
  "tab.panes": " ({n} bölme)",

  // --- File tree ---
  "ft.hidden": "Gizli dosyalar",
  "ft.refresh": "Yenile",
  "ft.close": "Kapat",
  "ft.unknownDir": "Bilinmeyen dizin",
  "ft.denied": "erişim reddedildi",
  "ft.empty": "boş",
  "ftctx.cd": "Klasörü aç",
  "ftctx.ls": "Listele (ls -la)",
  "ftctx.editor": "Düzenleyicide aç",
  "ftctx.cat": "Görüntüle (cat)",
  "ftctx.nano": "Düzenle (nano)",
  "ftctx.openEditor": "Aç ($EDITOR)",
  "ftctx.copyPath": "Yolu kopyala",
  "ftctx.insertPath": "Yolu ekle",

  // --- Update banner ---
  "update.available": "<strong>Lume {version}</strong> kullanılabilir",
  "update.failed": "başarısız, yeniden dene",
  "update.install": "Kur ve yeniden başlat",
  "update.later": "Sonra",
  "update.downloading": "İndiriliyor… %{percent}",

  // --- Remote dialog ---
  "remote.title": "Uzaktan kontrol",
  "remote.connected": "{n} cihaz bağlı",
  "remote.active": "Etkin — bağlantı yok",
  "remote.creatingTunnel": "Genel tünel oluşturuluyor… (birkaç saniye)",
  "remote.starting": "Başlatılıyor…",
  "remote.scanPublic": "QR'ı tarayın veya URL'yi her yerden açın:",
  "remote.scanLan": "Aynı yerel ağ — QR'ı tarayın veya URL'yi açın:",
  "remote.copy": "Kopyala",
  "remote.installHint":
    "Yerel ağ dışından kontrol etmek için <code>cloudflared</code> kurun.",
  "remote.warn": "⚠️ Bu bağlantıya sahip herkes bu terminali kontrol edebilir.",
  "remote.installBtn": "Tüneli kur ve etkinleştir",
  "remote.installing": "Kuruluyor…",
  "remote.stop": "Uzaktan kontrolü durdur",

  // --- Terminal search ---
  "search.placeholder": "Ara…",
  "search.next": "Sonraki",
  "search.prev": "Önceki",
  "search.close": "Kapat",

  // --- Blocks panel ---
  "blocks.title": "Bloklar",
  "blocks.empty": "Henüz komut bloğu yok.",
  "blocks.setupTitle": "Komut bloklarını etkinleştir",
  "blocks.copyCmd": "Komutu kopyala",
  "blocks.copyOutput": "Çıktıyı kopyala",
  "blocks.rerun": "Yeniden çalıştır",
  "blocks.remove": "Kaldır",
  "blocks.explain": "Açıkla (AI)",

  // --- Terminal search (button titles with shortcuts) ---
  "search.prevTitle": "Önceki (Shift+Enter)",
  "search.nextTitle": "Sonraki (Enter)",
  "search.closeTitle": "Kapat (Esc)",
  "term.copyBlock": "Komutu + çıktısını kopyala",

  // --- Notifications (banner bodies) ---
  "notif.cmdDone": "✓ Komut tamamlandı",
  "notif.cmdFailed": "✗ Başarısız (çıkış {code})",

  // --- AI explain seed prompt ---
  "ai.seedHeader": "İşte bir terminal bloğu:",
  "ai.seedCommand": "Komut: ",
  "ai.seedOutput": "Çıktı:",
  "ai.seedExitCode": "Çıkış kodu: ",
  "ai.seedAsk": "Ne olduğunu kısaca açıkla.",

  // --- Command palette (AI) ---
  "cmd.placeholder": "Şunun için bir komut üret…",
  "cmd.escCancel": "İptal için Esc",
  "cmd.noCli":
    "Claude CLI bulunamadı. Bir terminalde <code>claude login</code> çalıştırın, ardından Lume'u yeniden başlatın.",
  "cmd.cancel": "İptal",
  "cmd.insertHint": "Terminale eklemek için <kbd>Enter</kbd>",
  "cmd.generateHint": "Üretmek için <kbd>Enter</kbd>",
  "cmd.reformulate": "Yeniden ifade et",
  "cmd.insert": "Ekle",
  "cmd.unknownError": "Bilinmeyen hata",
  "cmd.retry": "Yeniden dene",

  // --- Workflows palette ---
  "wf.searchPlaceholder": "Bir workflow ara…",
  "wf.empty": "Workflow yok. <code>~/.config/lume/workflows/*.yaml</code>",
  "wf.navHint": "<kbd>↑</kbd><kbd>↓</kbd> gez · <kbd>Enter</kbd> seç",
  "wf.back": "Geri",
  "wf.preview": "Önizleme",
  "wf.toComplete": "Tamamlanacak: {fields}",
  "wf.insertHint": "Terminale eklemek için <kbd>Enter</kbd>",
  "wf.insert": "Ekle",

  // --- SSH palette ---
  "ssh.placeholder": "SSH sunucusu veya user@server…",
  "ssh.noMatch": "Eşleşen sunucu yok.",
  "ssh.noHosts":
    "<code>~/.ssh/config</code> içinde sunucu yok. Doğrudan bağlanmak için bir <code>user@server</code> yazın.",
  "ssh.connectTo": "Şuna bağlan",
  "ssh.directConnection": "doğrudan bağlantı",
  "ssh.navHint":
    "<kbd>↑</kbd><kbd>↓</kbd> gez · <kbd>Enter</kbd> bağlan (yeni sekme)",

  // --- Blocks panel (extended) ---
  "blocks.aiThinking": "Claude düşünüyor…",
  "blocks.aiError": "Hata",
  "blocks.aiClose": "Kapat",
  "blocks.followupPlaceholder": "Takip sorusu…",
  "blocks.followupWait": "Lütfen bekleyin…",
  "blocks.send": "Gönder (Enter)",
  "blocks.emptyIntro":
    "Bir <strong>blok</strong> = bir komut + çıktısı + çıkış kodu.",
  "blocks.emptyActive": "Henüz komut yok — birini çalıştırın, burada görünecek.",
  "blocks.emptyHistory":
    "Shell'iniz OSC 133 işaretlerini yaydığında geçmiş burada görünecek.",
  "blocks.loading": "Yükleniyor…",
  "blocks.addLinePre": "Bu satırı şuraya ekleyin:",
  "blocks.addLinePost": "ardından yeni bir shell açın:",
  "blocks.copy": "Kopyala",
  "blocks.detected":
    "Algılandı: <code>{shell}</code>. PTY <code>LUME_TERM=1</code> dışa aktarır — kaynak yalnızca Lume içinde etkinleşir.",
  "blocks.shellUnknown": "bilinmeyen shell",
  "blocks.help": "Bu nedir?",
  "blocks.helpIntro":
    "Her satır = çalıştırılan bir komut + sonucu. Lume sınırları OSC 133 ile algılar (shell'iniz tarafından yayılan işaretler).",
  "blocks.exitOk": "exit 0",
  "blocks.exitErr": "exit ≠ 0",
  "blocks.exitRunning": "çalışıyor",
  "blocks.helpKeys":
    'Tıkla → terminaldeki prompt\'a kaydır.<br/>Sağ tıkla → kopyala, ekle, açıkla.<br/><kbd>Ctrl</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> → gez, terminale eklemek için <kbd>↩</kbd>.<br/><span style="color: var(--accent)">✨</span> → Claude açıklaması.',
  "blocks.resize": "Yeniden boyutlandırmak için sürükle",
  "blocks.filterPlaceholder": "Blokları filtrele…",
  "blocks.searchClose": "Kapat (Esc)",
  "blocks.hide": "Gizle (Ctrl+B)",
  "blocks.clickScroll": "Tıkla → prompt'a kaydır",
  "blocks.promptNotTracked": "(prompt satırı izlenmiyor)",
  "blocks.rightClickActions": "Sağ tıkla → kopyala, ekle, açıkla…",
  "blocks.promptNoCommand": "(komutsuz prompt)",
  "blocks.outputCopied": "Çıktı kopyalandı ✓",
  "blocks.commandCopied": "Komut kopyalandı ✓",
  "blocks.outputCaptured": "Çıktı yakalandı — kopyalamak için Shift+Tık",
  "blocks.aiNoCli": "Claude CLI bulunamadı (claude login)",
  "blocks.aiBlockNotDone": "Blok tamamlanmış olmalı",
  "blocks.aiNoCommand": "Açıklanacak komut yok",
  "blocks.cancel": "İptal",
  "blocks.aiFixError": "Bu hatayı Claude ile düzelt",
  "blocks.aiExplainBlock": "Bu bloğu Claude ile açıkla",
  "blocks.insertTerminal": "Terminale ekle",
  "blocks.gotoCommand": "Terminaldeki komuta git",
  "blocks.explainClaude": "✨ Claude ile açıkla",
  "blocks.closeAiPanel": "Claude panelini kapat",
  "blocks.removeBlock": "Bu bloğu kaldır",

  // --- Keybindings (configurable actions) ---
  "keys.action.newTab": "Yeni sekme",
  "keys.action.closeTab": "Bölmeyi / sekmeyi kapat",
  "keys.action.nextTab": "Sonraki sekme",
  "keys.action.prevTab": "Önceki sekme",
  "keys.action.splitH": "Yatay böl",
  "keys.action.splitV": "Dikey böl",
  "keys.action.togglePanel": "Bloklar kenar çubuğu",
  "keys.action.search": "Blokları filtrele",
  "keys.action.termSearch": "Terminalde ara",
  "keys.action.paletteAI": "AI paleti",
  "keys.action.workflows": "Workflows",
  "keys.action.ssh": "SSH",
  "keys.action.copy": "Kopyala",
  "keys.action.paste": "Yapıştır",
  "keys.action.settings": "Ayarlar",

  // --- Keybindings (fixed shortcuts) ---
  "keys.fixed.goToTab": "N sekmesine git",
  "keys.fixed.zoom": "Metin yakınlaştırma (boyut +/-)",
  "keys.fixed.zoomReset": "Varsayılan metin boyutu",
  "keys.fixed.navPanes": "Bölmeler arasında gez (döngü)",
  "keys.fixed.navBlocks": "Bloklarda gez",

  // --- Theme colors ---
  "color.background": "Arka plan",
  "color.foreground": "Metin",
  "color.accent": "Vurgu",
  "color.cursor": "İmleç",
  "color.selection": "Seçim",

  // --- Pane ---
  "pane.dragMove": "Bu bölmeyi taşımak için sürükle",
  "pane.swap": "Değiştir",
  "pane.moveHere": "Buraya taşı",

  // --- Autocomplete footer ---
  "ac.complete": "<kbd>Tab</kbd> tamamla",
  "ac.navigate": "<kbd>↑</kbd><kbd>↓</kbd> gez",
  "ac.close": "<kbd>Esc</kbd> kapat",
};
