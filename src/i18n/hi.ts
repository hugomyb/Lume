import type { Dict } from "../i18n";

export const hi: Dict = {
  // --- Settings: nav + general ---
  "settings.title": "सेटिंग्स",
  "settings.close": "बंद करें (Esc)",
  "nav.appearance": "रूप",
  "nav.shell": "Shell",
  "nav.notifications": "सूचनाएँ",
  "nav.remote": "Remote",
  "nav.keys": "शॉर्टकट",
  "nav.general": "सामान्य",
  "nav.about": "परिचय",

  // --- Appearance ---
  "appearance.font": "फ़ॉन्ट",
  "appearance.import": "आयात करें",
  "appearance.importTitle": ".ttf/.otf/.woff आयात करें",
  "appearance.fontHint":
    "प्रॉम्प्ट आइकनों के लिए (Powerlevel10k, starship…), एक <strong>Nerd Font</strong> चुनें — जैसे <code>MesloLGS NF</code>।",
  "appearance.fontCurrent": "(वर्तमान)",
  "appearance.fontImported": "आयातित",
  "appearance.fontSystem": "सिस्टम (monospace)",
  "appearance.size": "आकार",
  "appearance.cursorBlink": "ब्लिंक करता कर्सर",
  "appearance.cursorStyle": "कर्सर शैली",
  "cursor.block": "ब्लॉक",
  "cursor.bar": "बार",
  "cursor.underline": "रेखांकित",
  "appearance.scrollback": "स्क्रॉलबैक (पंक्तियाँ)",
  "appearance.theme": "थीम",
  "appearance.ansi": "ANSI रंग (16)",
  "appearance.reset": "रूप रीसेट करें",

  // --- Shell ---
  "shell.program": "प्रोग्राम",
  "shell.programPlaceholder": "$SHELL (डिफ़ॉल्ट)",
  "shell.args": "आर्ग्युमेंट्स",
  "shell.argsPlaceholder": "जैसे -l",
  "shell.note": "<strong>नए</strong> टर्मिनलों पर लागू होता है।",

  // --- Notifications ---
  "notif.enable": "लंबी कमांड पर सूचित करें",
  "notif.minDuration": "न्यूनतम अवधि (सेकंड)",
  "notif.sound": "सूचना ध्वनि",
  "notif.note":
    "जब कोई कमांड इस अवधि से अधिक चलती है <strong>और Lume फ़ोकस में नहीं होता</strong>, तब एक सिस्टम सूचना दिखाई देती है।",

  // --- Keys ---
  "keys.hint":
    "किसी शॉर्टकट पर क्लिक करें, फिर इच्छित संयोजन दबाएँ (रद्द करने के लिए <kbd>Esc</kbd>)।",
  "keys.reset": "शॉर्टकट रीसेट करें",
  "keys.recording": "कोई की दबाएँ…",
  "keys.fixed": "स्थिर शॉर्टकट",

  // --- General ---
  "general.language": "भाषा",
  "general.backup": "सेटिंग्स बैकअप",
  "general.exportImport": "पूरी कॉन्फ़िग निर्यात / आयात करें",
  "general.export": "निर्यात करें",
  "general.import": "आयात करें",
  "general.exported": "सेटिंग्स निर्यात की गईं ✓",
  "general.exportFailed": "निर्यात विफल",
  "general.imported": "सेटिंग्स आयात की गईं ✓",
  "general.importFailed": "अमान्य फ़ाइल",

  // --- About ---
  "about.version": "संस्करण",
  "about.updates": "अपडेट",
  "about.check": "जाँचें",
  "about.checking": "जाँच हो रही है…",
  "about.uptodate": "Lume अद्यतित है ✓",
  "about.checkError": "जाँच नहीं हो सकी (ऑफ़लाइन, या कोई रिलीज़ नहीं)।",
  "about.available": "<strong>Lume {version}</strong> उपलब्ध है।",
  "about.installRestart": "इंस्टॉल करें और पुनः आरंभ करें",
  "about.downloading": "डाउनलोड हो रहा है… {percent}%",
  "about.updateNote":
    "अपडेट हस्ताक्षरित होते हैं और स्वचालित रूप से इंस्टॉल होते हैं (AppImage बिल्ड)। आरंभ पर स्वतः जाँच।",

  // --- Toolbar (tab bar) ---
  "toolbar.fileTree": "फ़ाइल ट्री",
  "toolbar.layouts": "लेआउट प्रीसेट",
  "toolbar.blocks": "ब्लॉक (Ctrl+B)",
  "toolbar.workflows": "Workflows (Ctrl+Shift+R)",
  "toolbar.ssh": "SSH (Ctrl+Shift+S)",
  "toolbar.settings": "सेटिंग्स (Ctrl+,)",
  "toolbar.newTab": "नया (Ctrl+Shift+T)",
  "toolbar.closeTab": "बंद करें (Ctrl+Shift+W)",
  "toolbar.prevTabs": "पिछले टैब",
  "toolbar.nextTabs": "अगले टैब",
  "toolbar.remoteActive": "रिमोट नियंत्रण सक्रिय — प्रबंधित करने के लिए क्लिक करें",

  // --- Layouts popup ---
  "layouts.title": "एक लेआउट लागू करें",
  "layouts.single": "एकल",
  "layouts.twoCols": "2 कॉलम",
  "layouts.twoRows": "2 पंक्तियाँ",
  "layouts.grid": "2×2 ग्रिड",
  "layouts.mainSide": "मुख्य + 2",
  "layouts.tripleCol": "3 कॉलम",
  "layouts.note":
    "सक्रिय टर्मिनल पहले स्लॉट में रखा जाता है। टैब के अन्य shell बंद कर दिए जाते हैं।",

  // --- Pane context menu ---
  "pane.copy": "⧉ कॉपी करें (Ctrl+Shift+C)",
  "pane.paste": "⎘ पेस्ट करें (Ctrl+Shift+V)",
  "pane.splitH": "⬌ क्षैतिज विभाजन",
  "pane.splitV": "⬍ ऊर्ध्वाधर विभाजन",
  "pane.remote": "⇆ दूरस्थ नियंत्रण करें",
  "pane.newTab": "+ नया टैब",
  "pane.close": "× यह पेन बंद करें",
  "pane.closeTab": " (टैब बंद कर देता है)",

  // --- Tab context menu ---
  "tab.rename": "✎ नाम बदलें (डबल-क्लिक)",
  "tab.splitH": "⬌ क्षैतिज विभाजन (Ctrl+Shift+D)",
  "tab.splitV": "⬍ ऊर्ध्वाधर विभाजन (Ctrl+Shift+E)",
  "tab.newTab": "+ नया टैब (Ctrl+Shift+T)",
  "tab.close": "× यह टैब बंद करें",
  "tab.panes": " ({n} पेन)",

  // --- File tree ---
  "ft.hidden": "छिपी फ़ाइलें",
  "ft.refresh": "रिफ़्रेश करें",
  "ft.close": "बंद करें",
  "ft.unknownDir": "अज्ञात निर्देशिका",
  "ft.denied": "पहुँच अस्वीकृत",
  "ft.empty": "खाली",
  "ftctx.cd": "फ़ोल्डर खोलें",
  "ftctx.ls": "सूची (ls -la)",
  "ftctx.editor": "एडिटर में खोलें",
  "ftctx.cat": "देखें (cat)",
  "ftctx.nano": "संपादित करें (nano)",
  "ftctx.openEditor": "खोलें ($EDITOR)",
  "ftctx.copyPath": "पथ कॉपी करें",
  "ftctx.insertPath": "पथ डालें",

  // --- Update banner ---
  "update.available": "<strong>Lume {version}</strong> उपलब्ध है",
  "update.failed": "विफल, पुनः प्रयास करें",
  "update.install": "इंस्टॉल करें और पुनः आरंभ करें",
  "update.later": "बाद में",
  "update.downloading": "डाउनलोड हो रहा है… {percent}%",

  // --- Remote dialog ---
  "remote.title": "रिमोट नियंत्रण",
  "remote.connected": "{n} डिवाइस जुड़े",
  "remote.active": "सक्रिय — कोई कनेक्शन नहीं",
  "remote.creatingTunnel": "सार्वजनिक टनल बनाई जा रही है… (कुछ सेकंड)",
  "remote.starting": "आरंभ हो रहा है…",
  "remote.scanPublic": "कहीं से भी QR स्कैन करें या URL खोलें:",
  "remote.scanLan": "वही लोकल नेटवर्क — QR स्कैन करें या URL खोलें:",
  "remote.copy": "कॉपी करें",
  "remote.installHint":
    "लोकल नेटवर्क के बाहर से नियंत्रण करने के लिए <code>cloudflared</code> इंस्टॉल करें।",
  "remote.warn": "⚠️ इस लिंक वाला कोई भी व्यक्ति इस टर्मिनल को नियंत्रित कर सकता है।",
  "remote.installBtn": "टनल इंस्टॉल करें और सक्षम करें",
  "remote.installing": "इंस्टॉल हो रहा है…",
  "remote.stop": "रिमोट नियंत्रण रोकें",

  // --- Terminal search ---
  "search.placeholder": "खोजें…",
  "search.next": "अगला",
  "search.prev": "पिछला",
  "search.close": "बंद करें",

  // --- Blocks panel ---
  "blocks.title": "ब्लॉक",
  "blocks.empty": "अभी तक कोई कमांड ब्लॉक नहीं।",
  "blocks.setupTitle": "कमांड ब्लॉक सक्षम करें",
  "blocks.copyCmd": "कमांड कॉपी करें",
  "blocks.copyOutput": "आउटपुट कॉपी करें",
  "blocks.rerun": "पुनः चलाएँ",
  "blocks.remove": "हटाएँ",
  "blocks.explain": "समझाएँ (AI)",

  // --- Terminal search (button titles with shortcuts) ---
  "search.prevTitle": "पिछला (Shift+Enter)",
  "search.nextTitle": "अगला (Enter)",
  "search.closeTitle": "बंद करें (Esc)",
  "term.copyBlock": "कमांड + उसका आउटपुट कॉपी करें",

  // --- Notifications (banner bodies) ---
  "notif.cmdDone": "✓ कमांड पूर्ण हुई",
  "notif.cmdFailed": "✗ विफल (exit {code})",

  // --- AI explain seed prompt ---
  "ai.seedHeader": "यह एक टर्मिनल ब्लॉक है:",
  "ai.seedCommand": "कमांड: ",
  "ai.seedOutput": "आउटपुट:",
  "ai.seedExitCode": "एग्जिट कोड: ",
  "ai.seedAsk": "संक्षेप में बताएँ कि क्या हो रहा है।",

  // --- Command palette (AI) ---
  "cmd.placeholder": "इसके लिए कमांड बनाएँ…",
  "cmd.escCancel": "रद्द करने के लिए Esc",
  "cmd.noCli":
    "<code>{cmd}</code> PATH में नहीं मिला — सेटिंग्स › AI में एक प्रदाता कॉन्फ़िगर करें।",
  "cmd.noProvider":
    "कोई AI प्रदाता कॉन्फ़िगर नहीं है — सेटिंग्स › AI में एक सेट करें।",
  "cmd.cancel": "रद्द करें",
  "cmd.insertHint": "टर्मिनल में डालने के लिए <kbd>Enter</kbd>",
  "cmd.generateHint": "बनाने के लिए <kbd>Enter</kbd>",
  "cmd.reformulate": "पुनः लिखें",
  "cmd.insert": "डालें",
  "cmd.unknownError": "अज्ञात त्रुटि",
  "cmd.retry": "पुनः प्रयास करें",

  // --- Workflows palette ---
  "wf.searchPlaceholder": "एक workflow खोजें…",
  "wf.empty": "कोई workflow नहीं। <code>~/.config/lume/workflows/*.yaml</code>",
  "wf.navHint": "<kbd>↑</kbd><kbd>↓</kbd> नेविगेट करें · <kbd>Enter</kbd> चुनें",
  "wf.back": "वापस",
  "wf.preview": "पूर्वावलोकन",
  "wf.toComplete": "पूरा करना है: {fields}",
  "wf.insertHint": "टर्मिनल में डालने के लिए <kbd>Enter</kbd>",
  "wf.insert": "डालें",

  // --- SSH palette ---
  "ssh.placeholder": "SSH होस्ट या user@server…",
  "ssh.noMatch": "कोई मेल खाता होस्ट नहीं।",
  "ssh.noHosts":
    "<code>~/.ssh/config</code> में कोई होस्ट नहीं। सीधे जुड़ने के लिए कोई <code>user@server</code> टाइप करें।",
  "ssh.connectTo": "इससे जुड़ें",
  "ssh.directConnection": "सीधा कनेक्शन",
  "ssh.navHint":
    "<kbd>↑</kbd><kbd>↓</kbd> नेविगेट करें · <kbd>Enter</kbd> जुड़ें (नया टैब)",

  // --- Blocks panel (extended) ---
  "blocks.aiThinking": "{provider} सोच रहा है…",
  "blocks.aiError": "त्रुटि",
  "blocks.aiClose": "बंद करें",
  "blocks.followupPlaceholder": "अनुवर्ती प्रश्न…",
  "blocks.followupWait": "कृपया प्रतीक्षा करें…",
  "blocks.send": "भेजें (Enter)",
  "blocks.emptyIntro":
    "एक <strong>ब्लॉक</strong> = एक कमांड + उसका आउटपुट + उसका एग्जिट कोड।",
  "blocks.emptyActive": "अभी तक कोई कमांड नहीं — एक चलाएँ और वह यहाँ दिखाई देगी।",
  "blocks.emptyHistory":
    "जैसे ही आपका shell OSC 133 मार्कर उत्सर्जित करेगा, इतिहास यहाँ दिखाई देगा।",
  "blocks.loading": "लोड हो रहा है…",
  "blocks.addLinePre": "यह पंक्ति इसमें जोड़ें",
  "blocks.addLinePost": "फिर एक नया shell खोलें:",
  "blocks.copy": "कॉपी करें",
  "blocks.detected":
    "पता चला: <code>{shell}</code>। PTY <code>LUME_TERM=1</code> निर्यात करता है — स्रोत केवल Lume के अंदर ही सक्रिय होता है।",
  "blocks.shellUnknown": "अज्ञात shell",
  "blocks.help": "यह क्या है?",
  "blocks.helpIntro":
    "प्रत्येक पंक्ति = एक निष्पादित कमांड + उसका परिणाम। Lume सीमाओं का पता OSC 133 (आपके shell द्वारा उत्सर्जित मार्कर) के माध्यम से लगाता है।",
  "blocks.exitOk": "exit 0",
  "blocks.exitErr": "exit ≠ 0",
  "blocks.exitRunning": "चल रहा है",
  "blocks.helpKeys":
    'क्लिक → टर्मिनल में प्रॉम्प्ट तक स्क्रॉल करें।<br/>राइट-क्लिक → कॉपी, डालें, समझाएँ।<br/><kbd>Ctrl</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> → नेविगेट करें, टर्मिनल में डालने के लिए <kbd>↩</kbd>।<br/><span style="color: var(--accent)">✨</span> → AI व्याख्या।',
  "blocks.resize": "आकार बदलने के लिए खींचें",
  "blocks.filterPlaceholder": "ब्लॉक फ़िल्टर करें…",
  "blocks.searchClose": "बंद करें (Esc)",
  "blocks.hide": "छिपाएँ (Ctrl+B)",
  "blocks.clickScroll": "क्लिक → प्रॉम्प्ट तक स्क्रॉल करें",
  "blocks.promptNotTracked": "(प्रॉम्प्ट पंक्ति ट्रैक नहीं हुई)",
  "blocks.rightClickActions": "राइट-क्लिक → कॉपी, डालें, समझाएँ…",
  "blocks.promptNoCommand": "(बिना कमांड का प्रॉम्प्ट)",
  "blocks.outputCopied": "आउटपुट कॉपी हुआ ✓",
  "blocks.commandCopied": "कमांड कॉपी हुई ✓",
  "blocks.outputCaptured": "आउटपुट कैप्चर हुआ — कॉपी करने के लिए Shift+Click",
  "blocks.aiNoCli": "{provider} CLI PATH में नहीं मिला",
  "blocks.aiBlockNotDone": "ब्लॉक पूर्ण होना चाहिए",
  "blocks.aiNoCommand": "समझाने के लिए कोई कमांड नहीं",
  "blocks.cancel": "रद्द करें",
  "blocks.aiFixError": "{provider} से यह त्रुटि ठीक करें",
  "blocks.aiExplainBlock": "{provider} से यह ब्लॉक समझाएँ",
  "blocks.insertTerminal": "टर्मिनल में डालें",
  "blocks.gotoCommand": "टर्मिनल में कमांड पर जाएँ",
  "blocks.explainClaude": "✨ {provider} से समझाएँ",
  "blocks.closeAiPanel": "{provider} पैनल बंद करें",
  "blocks.removeBlock": "यह ब्लॉक हटाएँ",

  // --- Keybindings (configurable actions) ---
  "keys.action.newTab": "नया टैब",
  "keys.action.closeTab": "पेन / टैब बंद करें",
  "keys.action.nextTab": "अगला टैब",
  "keys.action.prevTab": "पिछला टैब",
  "keys.action.splitH": "क्षैतिज विभाजन",
  "keys.action.splitV": "ऊर्ध्वाधर विभाजन",
  "keys.action.togglePanel": "ब्लॉक साइडबार",
  "keys.action.search": "ब्लॉक फ़िल्टर करें",
  "keys.action.termSearch": "टर्मिनल में खोजें",
  "keys.action.paletteAI": "AI पैलेट",
  "keys.action.workflows": "Workflows",
  "keys.action.ssh": "SSH",
  "keys.action.copy": "कॉपी करें",
  "keys.action.paste": "पेस्ट करें",
  "keys.action.settings": "सेटिंग्स",

  // --- Keybindings (fixed shortcuts) ---
  "keys.fixed.goToTab": "टैब N पर जाएँ",
  "keys.fixed.zoom": "टेक्स्ट ज़ूम (आकार +/-)",
  "keys.fixed.zoomReset": "डिफ़ॉल्ट टेक्स्ट आकार",
  "keys.fixed.navPanes": "पेन के बीच नेविगेट करें (लूप)",
  "keys.fixed.navBlocks": "ब्लॉक नेविगेट करें",

  // --- Theme colors ---
  "color.background": "पृष्ठभूमि",
  "color.foreground": "टेक्स्ट",
  "color.accent": "एक्सेंट",
  "color.cursor": "कर्सर",
  "color.selection": "चयन",

  // --- Pane ---
  "pane.dragMove": "इस पेन को खिसकाने के लिए खींचें",
  "pane.swap": "अदला-बदली करें",
  "pane.moveHere": "यहाँ ले जाएँ",

  // --- Autocomplete footer ---
  "ac.complete": "<kbd>Tab</kbd> पूरा करें",
  "ac.navigate": "<kbd>↑</kbd><kbd>↓</kbd> नेविगेट करें",
  "ac.close": "<kbd>Esc</kbd> बंद करें",

  // --- AI provider settings ---
  "nav.ai": "AI",
  "ai.provider": "प्रदाता",
  "ai.custom": "कस्टम (CLI)",
  "ai.model": "मॉडल",
  "ai.modelHint": "डिफ़ॉल्ट",
  "ai.status": "स्थिति",
  "ai.detected": "✓ {cmd} का पता चला",
  "ai.notFound": "✗ {cmd} PATH में नहीं मिला",
  "ai.apiKey": "API कुंजी",
  "ai.command": "कमांड",
  "ai.args": "तर्क",
  "ai.keyEnv": "API कुंजी एनवायरनमेंट वेरिएबल",
  "ai.claudeNote": "<code>claude</code> CLI (Claude Code) का उपयोग करता है। प्रमाणीकरण के लिए एक बार <code>claude login</code> चलाएँ।",
  "ai.codexNote": "<code>codex</code> CLI (OpenAI) का उपयोग करता है। <code>codex login</code> से प्रमाणित करें, या ऊपर एक API कुंजी सेट करें (<code>OPENAI_API_KEY</code> के रूप में इंजेक्ट की जाती है)।",
  "ai.customNote": "कोई भी CLI जो एक prompt लेती है और उत्तर को stdout पर प्रिंट करती है। तर्कों में जहाँ prompt जाना चाहिए वहाँ <code>{prompt}</code> रखें।",
  "ai.keysNote": "API कुंजियाँ स्थानीय रूप से <code>~/.config/lume/config.toml</code> में संग्रहीत होती हैं और सेटिंग्स निर्यात से बाहर रखी जाती हैं।",
  "ai.customApi": "OpenAI-संगत API",
  "ai.baseUrl": "बेस URL",
  "ai.configured": "✓ कॉन्फ़िगर किया गया",
  "ai.missingKey": "✗ API कुंजी आवश्यक है",
  "ai.openaiNote": "OpenAI API का उपयोग करता है। <code>platform.openai.com</code> पर एक कुंजी बनाएँ।",
  "ai.deepseekNote": "DeepSeek API का उपयोग करता है (OpenAI-संगत)। कुंजी <code>platform.deepseek.com</code> पर।",
  "ai.apiNote": "कोई भी OpenAI-संगत एंडपॉइंट (Ollama, Groq, OpenRouter…)। बेस URL, कुंजी और मॉडल सेट करें।",
};
