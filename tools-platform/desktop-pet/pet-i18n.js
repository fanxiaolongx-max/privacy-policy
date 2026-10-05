// Localized desktop UI. Conversation messages and diagnostic payloads are never translated.
(function () {
    const translations = {
    "✦ 哈基米桌宠": "✦ Hajimi desktop pet",
    "✦ 哈基米桌宠设置": "✦ Hajimi pet settings",
    "哈基米桌宠设置": "Hajimi pet settings",
    "关闭设置": "Close settings",
    "体型缩放": "Size",
    "捏捏音量": "Sound volume",
    "开启头顶趣味气泡": "Speech bubbles",
    "打字与任务起舞动效 (全局敲键盘)": "Animate while typing",
    "macOS 系统全局键盘权限": "macOS keyboard access",
    "去授权": "Allow",
    "需要「辅助功能」授权才能在其他应用打字时感知按键喵": "Enable Accessibility to react to typing in other apps, meow.",
    "重置屏幕坐标 (右下角)": "Reset position (bottom right)",
    "本次隐藏桌宠 (下次启动恢复)": "Hide until next launch",
    "永久隐藏 (切换为无桌宠模式)": "Disable desktop pet",
    "永久隐藏后，可在系统右下角托盘随时恢复开启": "Enable again from the system tray menu.",
    "Gemini 哈基米": "Gemini Hajimi",
    "Gemini 哈基米设置": "Gemini Hajimi settings",
    "关闭菜单": "Close menu",
    "小黄鸭 (挤压音)": "Duck squeak",
    "静音": "Mute",
    "5小时额度 (常用)": "5-hour quota",
    "每周总额度": "Weekly quota",
    "双额度交替轮播": "Alternate quotas",
    "自动跟随 (工作吹茶/空闲站立)": "Auto (work / idle)",
    "疯狂码字 (打字敲键盘)": "Typing",
    "吹茶品茗 (工作中)": "Tea time (working)",
    "端庄站立 (经典待机)": "Standing (idle)",
    "跪姿萌爪 (开心元气)": "Happy paws",
    "悬空拎起 (呆萌被提)": "Being carried",
    "跌坐揉头 (摔倒哭哭)": "Taking a tumble",
    "摸头眯眼 (害羞享受)": "Head pats",
    "跟随反重力启动和退出": "Follow start and exit",
    "仅跟随反重力启动": "Follow start only",
    "自己手动启动，自动检测": "Manual start, auto detect",
    "填 0 表示不自动关闭": "0 keeps it open",
    "大小": "Size",
    "音效": "Sound",
    "音量": "Volume",
    "配额": "Quota",
    "状态": "State",
    "跟随反重力": "Antigravity",
    "气泡": "Bubbles",
    "打字工友": "Typing buddy",
    "重力下落": "Gravity",
    "对话消耗": "Token usage",
    "自动关闭": "Close after",
    "秒": "sec",
    "✕ 退出桌宠": "✕ Exit pet",
    "别捏啦，猫耳和肉垫要被你捏扁了喵！(>w<)": "Careful with my ears and paws, meow! (>w<)",
    "呀！捏我干嘛，再捏我就要吐泡泡了喵~": "Eek! Keep squishing and I will blow bubbles, meow~",
    "呼噜呼噜… 捏得好舒服，猫生圆满了喵~ (≧∇≦)ﾉ": "Purr… These cuddles make my day! (≧∇≦)ﾉ",
    "弹力十足吧！这可是纯天然无添加的猫猫脂肪喵！": "So squishy! All-natural kitty fluff, meow!",
    "Q 弹 Q 弹~ 再按一下，我就要原地起飞了喵！": "Boing boing~ One more squeeze and I will take off!",
    "嗷呜！手感是不是超棒？小鱼干准备好了吗喵~": "Soft, right? Got any fish treats for me, meow~?",
    "捏一次消耗 0.1 焦耳，主人快敲代码补充能量喵！": "Each squeeze costs 0.1 joules. Code to recharge me!",
    "今天也是被主人宠幸（捏脸）的一天喵~ ✦": "Another lovely day of cheek squishes, meow~ ✦",
    "我是你的 Gemini 哈基米！今天也要元气满满写代码喵~ ✦": "Your Gemini Hajimi is here! Let's code, meow~ ✦",
    "有 Bug 别慌，反重力引擎会保佑你的喵~ (=^･ω･^=)": "Bug trouble? Antigravity has your back! (=^･ω･^=)",
    "呼噜呼噜… 摸摸头，代码一遍过，测试全绿喵！": "Purr… Head pats for green tests, meow!",
    "今天主人敲代码速度好快！哈基米我都快眼花了喵~": "You are coding so fast I can barely keep up!",
    "你写的那几千行代码，我一口气就看完了喵~ 厉害吧！": "I read all your code in one go. Impressed, meow?",
    "主人主人辛苦啦~ 记得多喝水休息一下眼睛喵~": "Great work~ Drink some water and rest your eyes!",
    "好舒服喵~ 记得多给我备两桶小鱼干！": "So comfy, meow~ Bring extra fish treats!",
    "休息一下吧，反重力引擎帮你盯好屏幕了喵~": "Take a break. Antigravity will watch the screen!",
    "代码没有 Bug，只是有独特的个性！": "The code has no bugs, just a unique personality!",
    "反重力编译中… 正在将咖啡因转化为可用代码！": "Antigravity compiling… Turning caffeine into code!",
    "✦ 宇宙算力全开！今天的哈基米超凶的！": "✦ Cosmic compute at full power! Fearless Hajimi!",
    "Git commit: \"又改了一堆玄学代码\" (嘘)": "Git commit: \"More mysterious fixes\" (shh)",
    "正在向宇宙发射好运光波… 编译一次通过！": "Sending lucky cosmic rays… Build on the first try!",
    "只要我不看报错，报错就相当于不存在喵！": "If I can't see the errors, they don't exist, meow!",
    "键盘敲得啪啪响，年终奖金蹭蹭涨喵~": "Clickety-clack! May your bonus grow, meow~",
    "✦ 纯净桌宠模式": "✦ Companion mode",
    "反重力未开启 · 待机陪伴中 ✦": "Antigravity offline · Keeping you company ✦",
    "✦ Gemini 周配额": "✦ Gemini weekly quota",
    "✦ Gemini 5小时配额": "✦ Gemini 5-hour quota",
    "反重力全速运转中 ✦": "Antigravity at full speed ✦",
    "离线缓存额度 · 待机中 ✦": "Cached quota · Standing by ✦",
    "呜哇... 屁股摔得好痛痛 QAQ": "Ouch… That landing hurt! QAQ",
    "呜呜呜... 谁把人家扔下来的？！": "Waaah… Who dropped me?!",
    "晕乎乎... 头顶冒小星星了 @o@": "Dizzy… Seeing little stars! @o@",
    "哎哟... 下次要接住我嘛~ 哼！": "Oww… Catch me next time, please~!",
    "呼噜呼噜… 最喜欢主人摸摸啦~ (ฅ^ω^ฅ)": "Purr… I love your head pats~ (ฅ^ω^ฅ)",
    "蹭蹭~ 主人的手好暖和呀 ✦": "Nuzzle~ Your hands are so warm ✦",
    "脸颊都要被主人揉圆了啦… > <": "My cheeks are getting rounder… > <",
    "摸摸头，今天写代码 Bug 全部退散喵！": "Head pats to chase all your bugs away, meow!",
    "唔姆… 好舒服，猫猫不想努力了喵~ (//∇//)": "Mmm… So comfy, I just want to nap~ (//∇//)",
    "最喜欢被主人温柔摸头了喵~ 💖": "Gentle head pats are my favorite, meow~ 💖",
    "✦ 正在思考与敲代码...": "✦ Thinking and coding…",
    "持续工作中喵~ (ฅ^ω^ฅ)": "Still working, meow~ (ฅ^ω^ฅ)",
    "✦ 主人，本次一共消耗:": "✦ Total usage this turn:",
    "待机中": "Standing by",
    "✦ 反重力引擎启动，悬停就绪喵~": "✦ Antigravity on! Ready to hover, meow~",
    "我就呆在这里看你敲代码喵~ ✦": "I'll stay here and watch you code, meow~ ✦",
    "浮空守护中… 屏幕视野超棒喵~ (ฅ^ω^ฅ)": "Hovering guard… What a view! (ฅ^ω^ฅ)",
    "反重力小猫咪随时待命 ✦": "Antigravity kitty at your service ✦",
    "主人敲键盘好快！我也来帮忙敲两行！啪啪啪~ ✦": "You're typing so fast! Let me help! Tap tap~ ✦",
    "啪啪啪… 正在给主人的代码施加“无 Bug 魔法”喵！(ฅ^ω^ฅ)": "Tap tap… Casting bug-free magic on your code! (ฅ^ω^ฅ)",
    "键盘要敲冒烟啦！这就是传说中的手速吗？！(🔥)": "Your keyboard is on fire! Such speed! (🔥)",
    "Git push origin master --force… (嘘，开玩笑的喵！)": "Git push origin master --force… (Just kidding, meow!)",
    "Ctrl+C，Ctrl+V… 熟练得让人心疼喵！( >w< )": "Ctrl+C, Ctrl+V… You've mastered it! ( >w< )",
    "呼噜呼噜… 反重力引擎已将咖啡因转化为可用代码！": "Purr… Antigravity turned caffeine into working code!",
    "⚡ 结对编程模式启动！今天的产出翻倍喵！": "⚡ Pair programming on! Double the progress, meow!",
    "主人尽管敲，报错有反重力引擎顶着喵！": "Keep typing! Antigravity will handle the errors!",
    "✦ 反重力已连接！主人今天想写点什么代码喵？": "✦ Antigravity connected! What shall we code today?",
    "✦ 反重力已退出，进入待机摸鱼模式~ (ฅ^ω^ฅ)": "✦ Antigravity exited. Time to relax~ (ฅ^ω^ฅ)",
    "✦ 主人，我在这里喵！(ฅ^ω^ฅ)": "✦ I'm right here, meow! (ฅ^ω^ฅ)",
    "✦ 反重力已退出，桌宠同步退出喵~ 拜拜！": "✦ Antigravity exited. Kitty signing off~ Bye!",
    "哈基米 · 桌面智能伴侣": "Hajimi · Desktop companion",
    "平台智能客服已连线 · 随时为你效劳喵~": "Platform assistant connected · At your service, meow~",
    "清空并开启新对话": "Clear and start a new chat",
    "关闭对话框 (点击桌宠可重新打开)": "Close chat (click the pet to reopen)",
    "伴侣待命模式 · 平台工具就绪": "Companion standing by · Tools ready",
    "主人好呀喵！(ฅ'ω'ฅ) 我是你的桌面专属看板娘": "Hello, meow! (ฅ'ω'ฅ) I'm your desktop companion",
    "「哈基米」": "Hajimi",
    "！": "!",
    "我已经接通了 Tools Platform 后台智能客服引擎。你可以随时向我询问：": "I'm connected to the Tools Platform assistant. Ask me about:",
    "• 平台系统工具使用说明与自动化技巧": "• Platform tools and automation tips",
    "• 今日任务、告警中心与数据运维状态": "• Today's tasks, alerts, and operations",
    "• 或者是任何你想聊的话题与编程伴写哦喵~": "• Anything you'd like to chat or code about, meow~",
    "哈基米正在思考组织语言喵… 💭": "Hajimi is thinking, meow… 💭",
    "今日告警速报": "Today's alerts",
    "常用工具导航": "Platform tools",
    "摸鱼元气充能": "Cheer me up",
    "自定义工具指引": "Custom tools",
    "请帮我检查一下当前平台的告警中心，最近有无未处理的异常告警？": "Please check the platform alert center for recent unresolved alerts.",
    "请介绍一下平台支持哪些核心运维工具和系统功能？": "What core operations tools and features does the platform offer?",
    "哈基米，我写代码好累呀，来给我讲个猫咪小故事或者卖个萌鼓励我一下吧喵~": "Hajimi, I'm tired of coding. Tell me a kitty story or cheer me up, meow~",
    "请告诉我如何使用平台的新增自定义系统工具？": "How do I use the platform's custom tools?",
    "向哈基米提问或闲聊… (Enter发送)": "Ask Hajimi anything… (Enter to send)",
    "按 Enter 发送，Shift+Enter 换行": "Enter to send, Shift+Enter for a new line",
    "发送": "Send",
    "已复制 ✅": "Copied ✅",
    "自动复制受限，请在下方手动全选复制喵~": "Copy unavailable. Select and copy the report below, meow~",
    "已同步": "Synced",
    "📅 周额度:": "📅 Weekly quota:",
    "正常在线": "Online",
    "独立伴侣模式 · 平台工具就绪": "Companion mode · Tools ready",
    "哈基米收到啦喵~": "Got it, meow~",
    "AI 回复出错": "AI reply failed",
    "网络连接失败": "Network connection failed",
    "呜呜，连接平台 AI 服务时出现了一点小状况喵：": "Oops, connecting to the AI service hit a snag, meow:",
    "点击查看服务器原始请求与返回详情": "View request and response details",
    "(点击查看原始请求/返回 🔍)": "(View request / response 🔍)",
    "📡 平台服务端交互诊断报告": "📡 Service diagnostic report",
    "📋 复制诊断报告": "📋 Copy diagnostic report",
    "记忆已清空，开启全新的畅聊会话喵！(ฅ'ω'ฅ) 主人请尽管吩咐~": "A fresh chat is ready, meow! (ฅ'ω'ฅ) What can I do for you?"
};
    Object.assign(translations, {
        '✦ 哈基米 · 桌面智能客服伴侣': '✦ Hajimi · Desktop AI companion',
        '服务响应异常': 'Service response error',
        'AI服务交互异常': 'AI service error',
        '【客户端请求】': '[Client request]',
        '【服务端返回】': '[Server response]'
    });
    const originals = new Map(Object.entries(translations).map(([zh, en]) => [en.trim(), zh]));
    let language = 'zh-CN';
    function t(text) { return language === 'en-US' ? (translations[text] || text) : text; }
    function translateValue(value, write) {
        const trimmed = value.trim();
        const source = Object.hasOwn(translations, trimmed) ? trimmed : originals.get(trimmed);
        if (!source) return;
        const next = value.replace(trimmed, t(source));
        if (value !== next) write(next);
    }
    function apply(root = document) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
            const parent = node.parentElement;
            if (!parent || parent.closest('script, style, pre, code')) continue;
            if (parent.closest('.msg-row') && !parent.closest('[data-pet-ui]')) continue;
            translateValue(node.nodeValue, value => { node.nodeValue = value; });
        }
        root.querySelectorAll('[title], [placeholder], [alt], [data-prompt]').forEach(el => {
            if (el.closest('.msg-row') && !el.closest('[data-pet-ui]')) return;
            for (const key of ['title', 'placeholder', 'alt', 'data-prompt']) {
                if (el.hasAttribute(key)) translateValue(el.getAttribute(key), value => el.setAttribute(key, value));
            }
        });
    }
    function setLanguage(value) {
        if (!['zh-CN', 'en-US'].includes(value)) return;
        language = value;
        document.documentElement.lang = language;
        apply();
        window.dispatchEvent(new CustomEvent('pet:languagechange', { detail: { language } }));
    }
    window.PetI18n = { t, apply, setLanguage, getLanguage: () => language };
    let revision = 0;
    try {
        const ipc = require('electron').ipcRenderer;
        ipc.on('pet-language-change', (_event, value) => { revision++; setLanguage(value); });
        const initialRevision = revision;
        ipc.invoke('pet-get-language').then(value => {
            if (revision === initialRevision) setLanguage(value);
        }).catch(() => {});
    } catch (_) {}
    document.addEventListener('DOMContentLoaded', () => {
        apply();
        new MutationObserver(() => apply()).observe(document.body, {
            subtree: true, childList: true, characterData: true,
            attributes: true, attributeFilter: ['title', 'placeholder', 'alt', 'data-prompt']
        });
    });
})();
