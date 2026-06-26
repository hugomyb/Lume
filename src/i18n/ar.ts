import type { Dict } from "../i18n";

export const ar: Dict = {
  // --- Settings: nav + general ---
  "settings.title": "الإعدادات",
  "settings.close": "إغلاق (Esc)",
  "nav.appearance": "المظهر",
  "nav.shell": "Shell",
  "nav.notifications": "الإشعارات",
  "nav.remote": "Remote",
  "nav.keys": "الاختصارات",
  "nav.general": "عام",
  "nav.about": "حول",

  // --- Appearance ---
  "appearance.font": "الخط",
  "appearance.import": "استيراد",
  "appearance.importTitle": "استيراد ملف .ttf/.otf/.woff",
  "appearance.fontHint":
    "لأيقونات الموجِّه (Powerlevel10k، starship…)، اختر <strong>Nerd Font</strong> — مثل <code>MesloLGS NF</code>.",
  "appearance.fontCurrent": "(الحالي)",
  "appearance.fontImported": "المستوردة",
  "appearance.fontSystem": "النظام (أحادي المسافة)",
  "appearance.size": "الحجم",
  "appearance.cursorBlink": "مؤشر وامض",
  "appearance.cursorStyle": "نمط المؤشر",
  "cursor.block": "كتلة",
  "cursor.bar": "شريط",
  "cursor.underline": "خط سفلي",
  "appearance.scrollback": "سجل التمرير (أسطر)",
  "appearance.theme": "السمة",
  "appearance.ansi": "ألوان ANSI (16)",
  "appearance.reset": "إعادة تعيين المظهر",

  // --- Shell ---
  "shell.program": "البرنامج",
  "shell.programPlaceholder": "$SHELL (افتراضي)",
  "shell.args": "الوسائط",
  "shell.argsPlaceholder": "مثال: -l",
  "shell.note": "يُطبَّق على الطرفيات <strong>الجديدة</strong>.",

  // --- Notifications ---
  "notif.enable": "إشعار عند الأوامر الطويلة",
  "notif.minDuration": "أدنى مدة (ث)",
  "notif.sound": "صوت الإشعار",
  "notif.note":
    "يظهر إشعار نظام عندما يتجاوز أمرٌ هذه المدة <strong>ولا يكون Lume في المقدمة</strong>.",

  // --- Keys ---
  "keys.hint":
    "انقر على اختصار ثم اضغط التركيبة المطلوبة (<kbd>Esc</kbd> للإلغاء).",
  "keys.reset": "إعادة تعيين الاختصارات",
  "keys.recording": "اضغط مفتاحًا…",
  "keys.fixed": "اختصارات ثابتة",

  // --- General ---
  "general.language": "اللغة",
  "general.backup": "نسخة احتياطية للإعدادات",
  "general.exportImport": "تصدير / استيراد كامل الإعداد",
  "general.export": "تصدير",
  "general.import": "استيراد",
  "general.exported": "تم تصدير الإعدادات ✓",
  "general.exportFailed": "فشل التصدير",
  "general.imported": "تم استيراد الإعدادات ✓",
  "general.importFailed": "ملف غير صالح",

  // --- About ---
  "about.version": "الإصدار",
  "about.updates": "التحديثات",
  "about.check": "تحقّق",
  "about.checking": "جارٍ التحقق…",
  "about.uptodate": "Lume محدَّث ✓",
  "about.checkError": "تعذّر التحقق (غير متصل، أو لا يوجد إصدار).",
  "about.available": "<strong>Lume {version}</strong> متوفّر.",
  "about.installRestart": "تثبيت وإعادة تشغيل",
  "about.downloading": "جارٍ التنزيل… {percent}%",
  "about.updateNote":
    "تُوقَّع التحديثات وتُثبَّت تلقائيًا (بنية AppImage). تحقق تلقائي عند البدء.",

  // --- Toolbar (tab bar) ---
  "toolbar.fileTree": "شجرة الملفات",
  "toolbar.layouts": "تخطيطات جاهزة",
  "toolbar.blocks": "الكتل (Ctrl+B)",
  "toolbar.workflows": "Workflows (Ctrl+Shift+R)",
  "toolbar.ssh": "SSH (Ctrl+Shift+S)",
  "toolbar.settings": "الإعدادات (Ctrl+,)",
  "toolbar.newTab": "جديد (Ctrl+Shift+T)",
  "toolbar.closeTab": "إغلاق (Ctrl+Shift+W)",
  "toolbar.prevTabs": "علامات التبويب السابقة",
  "toolbar.nextTabs": "علامات التبويب التالية",
  "toolbar.remoteActive": "التحكم عن بُعد نشط — انقر للإدارة",

  // --- Layouts popup ---
  "layouts.title": "تطبيق تخطيط",
  "layouts.single": "مفرد",
  "layouts.twoCols": "عمودان",
  "layouts.twoRows": "صفّان",
  "layouts.grid": "شبكة 2×2",
  "layouts.mainSide": "رئيسي + 2",
  "layouts.tripleCol": "3 أعمدة",
  "layouts.note":
    "يبقى الطرفي النشط في الخانة الأولى. تُغلَق الأصداف الأخرى لعلامة التبويب.",

  // --- Pane context menu ---
  "pane.copy": "⧉ نسخ (Ctrl+Shift+C)",
  "pane.paste": "⎘ لصق (Ctrl+Shift+V)",
  "pane.splitH": "⬌ تقسيم أفقي",
  "pane.splitV": "⬍ تقسيم رأسي",
  "pane.remote": "⇆ تحكّم عن بُعد",
  "pane.newTab": "+ علامة تبويب جديدة",
  "pane.close": "× إغلاق هذا اللوح",
  "pane.closeTab": " (يُغلِق علامة التبويب)",

  // --- Tab context menu ---
  "tab.rename": "✎ إعادة تسمية (نقر مزدوج)",
  "tab.splitH": "⬌ تقسيم أفقي (Ctrl+Shift+D)",
  "tab.splitV": "⬍ تقسيم رأسي (Ctrl+Shift+E)",
  "tab.newTab": "+ علامة تبويب جديدة (Ctrl+Shift+T)",
  "tab.close": "× إغلاق علامة التبويب",
  "tab.panes": " ({n} ألواح)",

  // --- File tree ---
  "ft.hidden": "ملفات مخفية",
  "ft.refresh": "تحديث",
  "ft.close": "إغلاق",
  "ft.unknownDir": "مجلد غير معروف",
  "ft.denied": "تم رفض الوصول",
  "ft.empty": "فارغ",
  "ftctx.cd": "فتح المجلد",
  "ftctx.ls": "عرض القائمة (ls -la)",
  "ftctx.editor": "فتح في المحرّر",
  "ftctx.cat": "عرض (cat)",
  "ftctx.nano": "تحرير (nano)",
  "ftctx.openEditor": "فتح ($EDITOR)",
  "ftctx.copyPath": "نسخ المسار",
  "ftctx.insertPath": "إدراج المسار",

  // --- Update banner ---
  "update.available": "<strong>Lume {version}</strong> متوفّر",
  "update.failed": "فشل، أعد المحاولة",
  "update.install": "تثبيت وإعادة تشغيل",
  "update.later": "لاحقًا",
  "update.downloading": "جارٍ التنزيل… {percent}%",

  // --- Remote dialog ---
  "remote.title": "التحكم عن بُعد",
  "remote.connected": "{n} جهاز/أجهزة متصلة",
  "remote.active": "نشط — لا يوجد اتصال",
  "remote.creatingTunnel": "جارٍ إنشاء نفق عام… (بضع ثوانٍ)",
  "remote.starting": "جارٍ البدء…",
  "remote.scanPublic": "امسح رمز QR أو افتح الرابط من أي مكان:",
  "remote.scanLan": "نفس الشبكة المحلية — امسح رمز QR أو افتح الرابط:",
  "remote.copy": "نسخ",
  "remote.installHint":
    "ثبّت <code>cloudflared</code> للتحكم من خارج الشبكة المحلية.",
  "remote.warn": "⚠️ أي شخص لديه هذا الرابط يمكنه التحكم بهذا الطرفي.",
  "remote.installBtn": "تثبيت وتفعيل النفق",
  "remote.installing": "جارٍ التثبيت…",
  "remote.stop": "إيقاف التحكم عن بُعد",

  // --- Terminal search ---
  "search.placeholder": "بحث…",
  "search.next": "التالي",
  "search.prev": "السابق",
  "search.close": "إغلاق",

  // --- Blocks panel ---
  "blocks.title": "الكتل",
  "blocks.empty": "لا توجد كتل أوامر بعد.",
  "blocks.setupTitle": "تفعيل كتل الأوامر",
  "blocks.copyCmd": "نسخ الأمر",
  "blocks.copyOutput": "نسخ المخرجات",
  "blocks.rerun": "إعادة التشغيل",
  "blocks.remove": "إزالة",
  "blocks.explain": "اشرح (ذكاء اصطناعي)",

  // --- Terminal search (button titles with shortcuts) ---
  "search.prevTitle": "السابق (Shift+Enter)",
  "search.nextTitle": "التالي (Enter)",
  "search.closeTitle": "إغلاق (Esc)",
  "term.copyBlock": "نسخ الأمر + مخرجاته",

  // --- Notifications (banner bodies) ---
  "notif.cmdDone": "✓ انتهى الأمر",
  "notif.cmdFailed": "✗ فشل (خروج {code})",

  // --- AI explain seed prompt ---
  "ai.seedHeader": "إليك كتلة طرفية:",
  "ai.seedCommand": "الأمر: ",
  "ai.seedOutput": "المخرجات:",
  "ai.seedExitCode": "رمز الخروج: ",
  "ai.seedAsk": "اشرح باختصار ما يحدث.",

  // --- Command palette (AI) ---
  "cmd.placeholder": "أنشئ أمرًا لـ…",
  "cmd.escCancel": "Esc للإلغاء",
  "cmd.noCli":
    "تعذّر العثور على Claude CLI. شغّل <code>claude login</code> في طرفي ثم أعد تشغيل Lume.",
  "cmd.cancel": "إلغاء",
  "cmd.insertHint": "<kbd>Enter</kbd> للإدراج في الطرفي",
  "cmd.generateHint": "<kbd>Enter</kbd> للإنشاء",
  "cmd.reformulate": "إعادة الصياغة",
  "cmd.insert": "إدراج",
  "cmd.unknownError": "خطأ غير معروف",
  "cmd.retry": "إعادة المحاولة",

  // --- Workflows palette ---
  "wf.searchPlaceholder": "ابحث عن workflow…",
  "wf.empty": "لا يوجد workflow. <code>~/.config/lume/workflows/*.yaml</code>",
  "wf.navHint": "<kbd>↑</kbd><kbd>↓</kbd> للتنقل · <kbd>Enter</kbd> للاختيار",
  "wf.back": "رجوع",
  "wf.preview": "معاينة",
  "wf.toComplete": "للإكمال: {fields}",
  "wf.insertHint": "<kbd>Enter</kbd> للإدراج في الطرفي",
  "wf.insert": "إدراج",

  // --- SSH palette ---
  "ssh.placeholder": "مضيف SSH أو user@server…",
  "ssh.noMatch": "لا يوجد مضيف مطابق.",
  "ssh.noHosts":
    "لا يوجد مضيف في <code>~/.ssh/config</code>. اكتب <code>user@server</code> للاتصال مباشرة.",
  "ssh.connectTo": "الاتصال بـ",
  "ssh.directConnection": "اتصال مباشر",
  "ssh.navHint":
    "<kbd>↑</kbd><kbd>↓</kbd> للتنقل · <kbd>Enter</kbd> للاتصال (علامة تبويب جديدة)",

  // --- Blocks panel (extended) ---
  "blocks.aiThinking": "Claude يفكّر…",
  "blocks.aiError": "خطأ",
  "blocks.aiClose": "إغلاق",
  "blocks.followupPlaceholder": "سؤال متابعة…",
  "blocks.followupWait": "يُرجى الانتظار…",
  "blocks.send": "إرسال (Enter)",
  "blocks.emptyIntro":
    "<strong>الكتلة</strong> = أمر + مخرجاته + رمز خروجه.",
  "blocks.emptyActive": "لا يوجد أمر بعد — شغّل أمرًا وسيظهر هنا.",
  "blocks.emptyHistory":
    "سيظهر السجل هنا بمجرد أن يُصدِر صدفتك علامات OSC 133.",
  "blocks.loading": "جارٍ التحميل…",
  "blocks.addLinePre": "أضف هذا السطر إلى",
  "blocks.addLinePost": "ثم افتح صدفة جديدة:",
  "blocks.copy": "نسخ",
  "blocks.detected":
    "تم الاكتشاف: <code>{shell}</code>. يُصدِّر PTY المتغيّر <code>LUME_TERM=1</code> — لا يُفعَّل المصدر إلا داخل Lume.",
  "blocks.shellUnknown": "صدفة غير معروفة",
  "blocks.help": "ما هذا؟",
  "blocks.helpIntro":
    "كل سطر = أمر مُنفَّذ + نتيجته. يكتشف Lume الحدود عبر OSC 133 (علامات يُصدِرها صدفتك).",
  "blocks.exitOk": "exit 0",
  "blocks.exitErr": "exit ≠ 0",
  "blocks.exitRunning": "قيد التشغيل",
  "blocks.helpKeys":
    'نقر ← التمرير إلى الموجِّه في الطرفي.<br/>نقر يمين ← نسخ، إدراج، شرح.<br/><kbd>Ctrl</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> ← للتنقل، <kbd>↩</kbd> للإدراج في الطرفي.<br/><span style="color: var(--accent)">✨</span> ← شرح Claude.',
  "blocks.resize": "اسحب لتغيير الحجم",
  "blocks.filterPlaceholder": "تصفية الكتل…",
  "blocks.searchClose": "إغلاق (Esc)",
  "blocks.hide": "إخفاء (Ctrl+B)",
  "blocks.clickScroll": "نقر ← التمرير إلى الموجِّه",
  "blocks.promptNotTracked": "(سطر الموجِّه غير متتبَّع)",
  "blocks.rightClickActions": "نقر يمين ← نسخ، إدراج، شرح…",
  "blocks.promptNoCommand": "(موجِّه بدون أمر)",
  "blocks.outputCopied": "تم نسخ المخرجات ✓",
  "blocks.commandCopied": "تم نسخ الأمر ✓",
  "blocks.outputCaptured": "تم التقاط المخرجات — Shift+Click لنسخها",
  "blocks.aiNoCli": "تعذّر العثور على Claude CLI (claude login)",
  "blocks.aiBlockNotDone": "يجب أن تكون الكتلة منتهية",
  "blocks.aiNoCommand": "لا يوجد أمر لشرحه",
  "blocks.cancel": "إلغاء",
  "blocks.aiFixError": "أصلح هذا الخطأ باستخدام Claude",
  "blocks.aiExplainBlock": "اشرح هذه الكتلة باستخدام Claude",
  "blocks.insertTerminal": "إدراج في الطرفي",
  "blocks.gotoCommand": "الانتقال إلى الأمر في الطرفي",
  "blocks.explainClaude": "✨ اشرح باستخدام Claude",
  "blocks.closeAiPanel": "إغلاق لوحة Claude",
  "blocks.removeBlock": "إزالة هذه الكتلة",

  // --- Keybindings (configurable actions) ---
  "keys.action.newTab": "علامة تبويب جديدة",
  "keys.action.closeTab": "إغلاق اللوح / علامة التبويب",
  "keys.action.nextTab": "علامة التبويب التالية",
  "keys.action.prevTab": "علامة التبويب السابقة",
  "keys.action.splitH": "تقسيم أفقي",
  "keys.action.splitV": "تقسيم رأسي",
  "keys.action.togglePanel": "شريط الكتل الجانبي",
  "keys.action.search": "تصفية الكتل",
  "keys.action.termSearch": "البحث في الطرفي",
  "keys.action.paletteAI": "لوحة الذكاء الاصطناعي",
  "keys.action.workflows": "Workflows",
  "keys.action.ssh": "SSH",
  "keys.action.copy": "نسخ",
  "keys.action.paste": "لصق",
  "keys.action.settings": "الإعدادات",

  // --- Keybindings (fixed shortcuts) ---
  "keys.fixed.goToTab": "الانتقال إلى علامة التبويب N",
  "keys.fixed.zoom": "تكبير النص (الحجم +/-)",
  "keys.fixed.zoomReset": "حجم النص الافتراضي",
  "keys.fixed.navPanes": "التنقل بين الألواح (دورة)",
  "keys.fixed.navBlocks": "التنقل بين الكتل",

  // --- Theme colors ---
  "color.background": "الخلفية",
  "color.foreground": "النص",
  "color.accent": "اللون المميّز",
  "color.cursor": "المؤشر",
  "color.selection": "التحديد",

  // --- Pane ---
  "pane.dragMove": "اسحب لتحريك هذا اللوح",
  "pane.swap": "تبديل",
  "pane.moveHere": "نقل هنا",

  // --- Autocomplete footer ---
  "ac.complete": "<kbd>Tab</kbd> إكمال",
  "ac.navigate": "<kbd>↑</kbd><kbd>↓</kbd> تنقل",
  "ac.close": "<kbd>Esc</kbd> إغلاق",
};
