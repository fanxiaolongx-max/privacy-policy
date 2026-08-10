/**
 * 全局悬浮 AI 客服助手组件
 * 封装在 IIFE 中，避免污染全局变量
 */
(function () {
    // 注入 CSS 样式
    const style = document.createElement('style');
    style.innerHTML = `
        /* AI Assistant 样式定义 */
        .ai-fab {
            position: fixed;
            bottom: 40px;
            right: 40px;
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background: transparent;
            border: 1px solid rgba(126,151,222,0.58);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow:
                0 8px 22px rgba(13,18,46,0.16),
                0 0 0 1px rgba(20,31,82,0.18),
                0 0 20px rgba(104,118,255,0.14),
                inset 0 0 0 1px rgba(236,245,255,0.12);
            cursor: pointer;
            z-index: 100000;
            transition: transform 0.22s cubic-bezier(.2,.8,.2,1), box-shadow 0.22s, border-color 0.22s;
            user-select: none;
            touch-action: none;
            isolation: isolate;
            outline: none;
            -webkit-tap-highlight-color: transparent;
        }
        .ai-fab::before {
            content: "";
            position: absolute;
            inset: -5px;
            z-index: -1;
            border-radius: inherit;
            background: radial-gradient(circle, rgba(118,138,255,0.18), rgba(97,232,255,0.05) 52%, transparent 72%);
            opacity: 0.72;
            transition: opacity 0.22s, transform 0.22s;
            pointer-events: none;
        }
        .ai-fab-particles {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            display: block;
            border-radius: inherit;
            pointer-events: none;
        }
        .ai-fab:hover {
            transform: translateY(-2px) scale(1.06);
            border-color: rgba(211,225,255,0.56);
            box-shadow:
                0 12px 30px rgba(13,18,46,0.22),
                0 0 0 1px rgba(20,31,82,0.2),
                0 0 28px rgba(104,150,255,0.24),
                inset 0 0 0 1px rgba(236,245,255,0.2);
        }
        .ai-fab:hover::before,
        .ai-fab:focus-visible::before {
            opacity: 1;
            transform: scale(1.08);
        }
        .ai-fab:focus-visible {
            box-shadow:
                0 14px 34px rgba(13,18,46,0.3),
                0 0 0 3px rgba(255,255,255,0.72),
                0 0 0 6px rgba(103,121,255,0.36);
        }
        .ai-fab.dragging {
            transform: scale(1.04);
            box-shadow: 0 10px 28px rgba(0,0,0,0.34);
            cursor: grabbing;
        }
        .ai-panel {
            position: fixed;
            bottom: 110px;
            right: 40px;
            width: 420px;
            height: min(640px, calc(100vh - 140px));
            background: #f7f9fd !important;
            color: #334155 !important;
            border-radius: 20px;
            border: 1px solid rgba(148,163,184,0.34);
            box-shadow:
                0 28px 80px rgba(15,23,42,0.30),
                0 8px 24px rgba(15,23,42,0.14),
                inset 0 1px 0 rgba(255,255,255,0.9);
            z-index: 100000;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transform: translateY(20px) scale(0.95);
            opacity: 0;
            pointer-events: none;
            transition: width 0.28s cubic-bezier(.2,.8,.2,1), height 0.28s cubic-bezier(.2,.8,.2,1), inset 0.28s cubic-bezier(.2,.8,.2,1), border-radius 0.28s, transform 0.28s, opacity 0.2s;
            transform-origin: bottom right;
        }
        .ai-panel.open {
            transform: translateY(0) scale(1);
            opacity: 1;
            pointer-events: auto;
        }
        .ai-panel.expanded {
            width: min(760px, calc(100vw - 80px));
            height: min(820px, calc(100vh - 80px));
            max-width: none;
            max-height: none;
            bottom: 40px;
        }
        .ai-panel.fullscreen {
            inset: 0;
            width: 100vw;
            height: 100vh;
            max-width: none;
            max-height: none;
            border: 0;
            border-radius: 0;
            transform-origin: center;
        }
        body.ai-chat-fullscreen {
            overflow: hidden !important;
        }
        .ai-header {
            min-height: 68px;
            box-sizing: border-box;
            background:
                radial-gradient(circle at 18% 0%, rgba(129,140,248,0.36), transparent 34%),
                linear-gradient(135deg, #25356f 0%, #4d3f91 58%, #684598 100%);
            color: #fff;
            padding: 12px 16px 12px 18px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex: 0 0 auto;
        }
        .ai-brand {
            display: flex;
            align-items: center;
            gap: 11px;
            min-width: 0;
        }
        .ai-brand-mark {
            width: 34px;
            height: 34px;
            border-radius: 11px;
            display: grid;
            place-items: center;
            overflow: hidden;
            background: #fff;
            border: 1px solid rgba(255,255,255,0.72);
            box-shadow: 0 4px 12px rgba(20,27,67,0.2);
        }
        .ai-brand-mark img { width:100%; height:100%; display:block; object-fit:cover; }
        .ai-brand-copy { min-width: 0; }
        .ai-brand-title {
            font-size: 15px;
            line-height: 1.2;
            font-weight: 700;
            letter-spacing: 0.01em;
        }
        .ai-brand-subtitle {
            margin-top: 3px;
            font-size: 10px;
            line-height: 1.2;
            color: rgba(237,242,255,0.72);
            font-weight: 500;
            white-space: nowrap;
        }
        .ai-header-actions {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .ai-action-btn {
            background: rgba(255,255,255,0.11);
            border: 1px solid rgba(255,255,255,0.12);
            color: #fff !important;
            width: 32px;
            height: 32px;
            padding: 0;
            border-radius: 10px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.18s, transform 0.18s, border-color 0.18s;
        }
        .ai-action-btn:hover {
            background: rgba(255,255,255,0.22);
            border-color: rgba(255,255,255,0.3);
            transform: translateY(-1px);
        }
        .ai-action-btn svg {
            width: 16px;
            height: 16px;
            pointer-events: none;
        }
        .ai-action-btn.ai-close {
            background: rgba(255,255,255,0.17);
        }
        .ai-chat-body {
            flex: 1;
            min-height: 0;
            padding: 22px;
            overflow-y: auto;
            background:
                radial-gradient(circle at 15% 0%, rgba(99,102,241,0.055), transparent 34%),
                linear-gradient(180deg, #f7f9fd 0%, #f2f5fa 100%);
            display: flex;
            flex-direction: column;
            gap: 16px;
            scroll-behavior: smooth;
        }
        .ai-msg {
            max-width: 88%;
            padding: 13px 16px;
            border-radius: 16px;
            font-size: 14px;
            line-height: 1.6;
            word-wrap: break-word;
        }
        .ai-msg.user {
            background: linear-gradient(135deg, #556ee6, #7259c8);
            color: #fff;
            align-self: flex-end;
            border-bottom-right-radius: 6px;
            box-shadow: 0 8px 20px rgba(85,110,230,0.2);
        }
        .ai-msg.ai {
            background: #fff;
            color: #243247;
            align-self: flex-start;
            border-bottom-left-radius: 6px;
            box-shadow: 0 8px 24px rgba(30,41,59,0.07);
            border: 1px solid #e6eaf2;
        }
        .ai-panel.fullscreen .ai-chat-body {
            padding-left: max(28px, calc((100vw - 1080px) / 2));
            padding-right: max(28px, calc((100vw - 1080px) / 2));
        }
        .ai-panel.fullscreen .ai-msg { max-width: min(82%, 880px); }
        .ai-msg p { margin: 0 0 8px 0; }
        .ai-msg p:last-child { margin: 0; }
        .ai-msg ul, .ai-msg ol {
            margin: 0 0 8px 0;
            padding-left: 20px;
        }
        .ai-msg li { margin-bottom: 4px; }
        .ai-msg pre {
            background: rgba(226,232,240,0.72);
            padding: 8px;
            border-radius: 6px;
            overflow-x: auto;
            font-size: 13px;
        }
        .ai-msg code {
            background: rgba(226,232,240,0.76);
            padding: 2px 4px;
            border-radius: 4px;
            color: #ef4444;
            font-family: monospace;
        }
        .ai-msg h1, .ai-msg h2, .ai-msg h3, .ai-msg h4 {
            margin: 16px 0 8px;
            color: #1f2d44;
            line-height: 1.35;
        }
        .ai-msg h1:first-child, .ai-msg h2:first-child, .ai-msg h3:first-child, .ai-msg h4:first-child { margin-top: 0; }
        .ai-msg h1 { font-size: 18px; }
        .ai-msg h2 { font-size: 16px; }
        .ai-msg h3 { font-size: 15px; }
        .ai-msg h4 { font-size: 14px; }
        .ai-msg blockquote {
            margin: 10px 0;
            padding: 8px 11px;
            border-left: 3px solid #8492ec;
            border-radius: 0 8px 8px 0;
            background: #f5f7ff;
            color: #58657b;
        }
        .ai-table-wrap {
            width: 100%;
            margin: 12px 0 14px;
            overflow-x: auto;
            border: 1px solid #e1e6ef;
            border-radius: 12px;
            background: #fff;
            box-shadow: 0 5px 18px rgba(30,41,59,0.055);
            scrollbar-width: thin;
        }
        .ai-markdown-table {
            width: 100%;
            min-width: 520px;
            border-collapse: separate;
            border-spacing: 0;
            font-size: 12px;
            line-height: 1.45;
        }
        .ai-markdown-table th {
            position: sticky;
            top: 0;
            z-index: 1;
            padding: 10px 12px;
            border-bottom: 1px solid #dce2ed;
            background: linear-gradient(180deg, #f5f7ff, #eef1fa);
            color: #36415a;
            font-weight: 700;
            white-space: nowrap;
        }
        .ai-markdown-table td {
            padding: 10px 12px;
            border-bottom: 1px solid #edf0f5;
            color: #46536a;
            vertical-align: top;
        }
        .ai-markdown-table tbody tr:last-child td { border-bottom: 0; }
        .ai-markdown-table tbody tr:nth-child(even) td { background: #fafbfe; }
        .ai-markdown-table tbody tr:hover td { background: #f2f5ff; }
        .ai-markdown-table .align-center { text-align: center; }
        .ai-markdown-table .align-right { text-align: right; }
        .ai-markdown-table td.numeric { font-variant-numeric: tabular-nums; white-space: nowrap; }
        .ai-panel:not(.expanded):not(.fullscreen) .ai-msg.ai:has(.ai-markdown-table) { max-width: 96%; }
        .ai-token-usage {
            font-size: 11px;
            color: #94a3b8;
            margin-top: 8px;
            text-align: right;
            border-top: 1px dashed #e2e8f0;
            padding-top: 6px;
        }
        .ai-grounding {
            margin-top: 9px;
            padding-top: 8px;
            border-top: 1px dashed rgba(148,163,184,0.48);
            color: #64748b;
            font-size: 11px;
            line-height: 1.45;
        }
        .ai-grounding-title {
            color: #475569;
            font-weight: 600;
            margin-bottom: 3px;
        }
        .ai-grounding-item {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .ai-grounding-graph {
            width: 100%;
            margin: 0 0 4px;
            padding: 4px 7px;
            border: 1px solid #dfe5f3;
            border-radius: 8px;
            background: #f7f8fd;
            color: #5663b4;
            font: inherit;
            text-align: left;
            cursor: pointer;
            transition: border-color 0.16s, background 0.16s, color 0.16s;
        }
        .ai-grounding-graph:hover {
            border-color: #bfc8ee;
            background: #eef1ff;
            color: #4653a4;
        }
        .ai-input-area {
            display: flex;
            padding: 14px 16px 16px;
            background: #fff;
            border-top: 1px solid #e7ebf2;
            gap: 10px;
            align-items: center;
        }
        .ai-input {
            flex: 1;
            height: 46px;
            box-sizing: border-box;
            padding: 12px 17px;
            border: 1px solid #d9dfeb;
            border-radius: 14px;
            outline: none;
            font-size: 14px;
            transition: all 0.2s;
            background: #f7f9fc;
            color: #1e293b !important;
        }
        .ai-input::placeholder {
            color: #94a3b8 !important;
        }
        .ai-input:focus {
            border-color: #7585e8;
            background: #fff;
            box-shadow: 0 0 0 4px rgba(102,126,234,0.11);
        }
        .ai-send-btn {
            background: #667eea;
            color: #fff;
            border: none;
            width: 46px;
            height: 46px;
            flex: 0 0 46px;
            border-radius: 14px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            box-shadow: 0 7px 18px rgba(102,126,234,0.28);
        }
        .ai-send-btn:hover {
            background: #5a6fd6;
            transform: scale(1.05);
        }
        .ai-typing {
            font-size: 12px;
            color: #94a3b8;
            font-style: italic;
            align-self: flex-start;
            margin-top: -8px;
            display: none;
            padding: 0 16px;
        }
        .ai-suggestions {
            display: grid;
            grid-auto-flow: column;
            grid-template-rows: repeat(2, 28px);
            grid-auto-columns: 138px;
            column-gap: 8px;
            row-gap: 8px;
            padding: 12px 16px 14px;
            background: #fff;
            border-top: 1px solid #edf0f5;
            height: 82px;
            max-height: 82px;
            overflow-x: auto;
            overflow-y: hidden;
            align-content: start;
            flex: 0 0 auto;
            scrollbar-width: thin;
            overscroll-behavior-x: contain;
            -webkit-overflow-scrolling: touch;
            opacity: 1;
            transition: max-height 0.22s ease, height 0.22s ease, padding 0.22s ease, opacity 0.16s ease, border-color 0.16s;
        }
        .ai-suggestions.is-collapsed {
            height: 0;
            max-height: 0;
            padding-top: 0;
            padding-bottom: 0;
            opacity: 0;
            overflow: hidden;
            border-top-color: transparent;
            pointer-events: none;
        }
        .ai-suggestion-chip {
            width: 100%;
            max-width: none;
            min-width: 0;
            border: 1px solid #dfe4f4;
            background: #f6f7fc;
            color: #5865b8;
            border-radius: 999px;
            padding: 7px 10px;
            font-size: 12px;
            line-height: 1.2;
            height: 28px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            cursor: pointer;
        }
        .ai-panel:not(.expanded) .ai-suggestion-chip {
            max-width: none;
        }
        .ai-panel.expanded .ai-suggestions {
            grid-auto-columns: 168px;
        }
        .ai-panel.fullscreen .ai-suggestions,
        .ai-panel.fullscreen .ai-input-area {
            padding-left: max(24px, calc((100vw - 1040px) / 2));
            padding-right: max(24px, calc((100vw - 1040px) / 2));
        }
        .ai-suggestions:empty {
            display: none;
        }
        .ai-suggestion-chip:hover {
            background: rgba(238,242,255,0.92);
            border-color: #aebcff;
        }
        .ai-history-panel {
            display: none;
            background: #fff;
            border-bottom: 1px solid #e7ebf2;
            max-height: 210px;
            overflow-y: auto;
            padding: 10px 14px;
        }
        .ai-history-panel.open {
            display: block;
        }
        .ai-history-item {
            border: 1px solid rgba(148,163,184,0.32);
            border-radius: 10px;
            padding: 9px 10px;
            margin-bottom: 8px;
            cursor: pointer;
            background: rgba(248,250,252,0.72);
        }
        .ai-history-item:hover {
            border-color: #aebcff;
            background: rgba(245,247,255,0.9);
        }
        .ai-history-title {
            font-size: 12px;
            color: #334155;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .ai-history-meta {
            font-size: 11px;
            color: #94a3b8;
            margin-top: 4px;
        }
        @media (max-width: 520px) {
            .ai-fab {
                right: 18px;
                bottom: 20px;
                width: 60px;
                height: 60px;
            }
            .ai-panel,
            .ai-panel.expanded {
                right: 12px;
                bottom: 92px;
                width: calc(100vw - 24px);
                height: min(70vh, 550px);
                max-width: none;
            }
            .ai-panel.fullscreen {
                inset: 0;
                width: 100vw;
                height: 100vh;
                border-radius: 0;
            }
            .ai-brand-subtitle { display: none; }
            .ai-header { padding-left: 12px; padding-right: 10px; }
            .ai-header-actions { gap: 4px; }
        }
        @media (prefers-reduced-motion: reduce) {
            .ai-fab,
            .ai-fab::before,
            .ai-panel {
                transition-duration: 0.01ms !important;
            }
        }
    `;
    document.head.appendChild(style);

    const AI_TEXT = {
        zh: {
            open: '打开智能客服助手', title: '智能客服助手', subtitle: '项目知识 · 数据分析 · 运营建议',
            graph: '知识与指标图谱', history: '历史问答', expand: '放大窗口', restore: '恢复默认大小',
            fullscreen: '全屏聊天', exitFullscreen: '退出全屏', close: '关闭', send: '发送消息',
            welcome: '👋 你好！我是您的专属智能助手，正在为您加载页面上下文...', thinking: 'AI 正在思考...',
            placeholder: '向 AI 提问有关本页面的内容...', graphLoadFailed: '知识图谱组件加载失败',
            historyLoading: '正在加载历史问答...', historyEmpty: '暂无历史问答', unnamed: '未命名对话',
            messages: '条', historyFailed: '历史问答加载失败：', historyRestoreFailed: '历史问答恢复失败：',
            initPrompt: '你好，请用简短的话总结一下这个页面的核心功能以及如何使用它。',
            connectFailed: '连接 AI 服务失败：', error: '错误：', answerBasis: '本次回答依据',
            openGraph: '打开知识关系图谱', cache: '知识缓存', hitChunks: n => `命中 ${n} 个片段`, cacheMiss: '本次未命中',
            files: '文件', chunks: '片段', latestMonth: '最新月份', storedData: '入库数据', data: '数据', unknownFile: '未知文件',
            current: '本次', total: '累计', approxCost: n => `(约${n}毛)`, totalCost: n => `(总计${n}毛)`
        },
        en: {
            open: 'Open AI Support Assistant', title: 'AI Support Assistant', subtitle: 'Project knowledge · Data analysis · Operations',
            graph: 'Knowledge & Metrics Graph', history: 'Chat history', expand: 'Expand window', restore: 'Restore default size',
            fullscreen: 'Full-screen chat', exitFullscreen: 'Exit full screen', close: 'Close', send: 'Send message',
            welcome: '👋 Hi! I’m your AI assistant. Loading the current page context…', thinking: 'AI is thinking…',
            placeholder: 'Ask AI about this page or the project…', graphLoadFailed: 'Failed to load the knowledge graph',
            historyLoading: 'Loading chat history…', historyEmpty: 'No chat history yet', unnamed: 'Untitled conversation',
            messages: 'messages', historyFailed: 'Failed to load chat history: ', historyRestoreFailed: 'Failed to restore chat history: ',
            initPrompt: 'Please briefly summarize the core purpose of this page and how to use it.',
            connectFailed: 'Could not connect to the AI service: ', error: 'Error: ', answerBasis: 'Sources for this answer',
            openGraph: 'Open knowledge graph', cache: 'Knowledge cache', hitChunks: n => `${n} matching chunks`, cacheMiss: 'No match this time',
            files: 'files', chunks: 'chunks', latestMonth: 'latest month', storedData: 'Stored data', data: 'Data', unknownFile: 'Unknown file',
            current: 'This reply', total: 'Total', approxCost: n => `(approx. ${n} mao)`, totalCost: n => `(total ${n} mao)`
        }
    };
    function getAiLang() {
        const raw = window.ToolsI18n?.getLanguage?.() || localStorage.getItem('tools_lang') || document.documentElement.lang || 'zh-CN';
        return String(raw).toLowerCase().startsWith('en') ? 'en' : 'zh';
    }
    function aiT(key, ...args) {
        const value = AI_TEXT[getAiLang()][key] ?? AI_TEXT.zh[key] ?? key;
        return typeof value === 'function' ? value(...args) : value;
    }

    // 创建 DOM
    const fab = document.createElement('div');
    fab.className = 'ai-fab';
    fab.setAttribute('role', 'button');
    fab.setAttribute('tabindex', '0');
    fab.setAttribute('aria-label', '打开智能客服助手');
    fab.setAttribute('aria-expanded', 'false');
    fab.setAttribute('title', '智能客服助手');
    fab.innerHTML = '<canvas class="ai-fab-particles" aria-hidden="true"></canvas>';
    document.body.appendChild(fab);

    const panel = document.createElement('div');
    panel.className = 'ai-panel';
    panel.innerHTML = `
        <div class="ai-header">
            <div class="ai-brand">
                <div class="ai-brand-mark" aria-hidden="true"><img src="/assets/ai-assistant-spark-50.gif?v=20260809-01" alt=""></div>
                <div class="ai-brand-copy">
                    <div class="ai-brand-title">智能客服助手</div>
                    <div class="ai-brand-subtitle">项目知识 · 数据分析 · 运营建议</div>
                </div>
            </div>
            <div class="ai-header-actions">
                <button class="ai-action-btn ai-knowledge-graph" type="button" title="知识与指标图谱" aria-label="知识与指标图谱">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="7" r="2.2"/><circle cx="8" cy="18" r="2.2"/><circle cx="17" cy="17" r="2.2"/><path d="M8 7l7.8-.1M7 8l1 7.8M10 17.8l4.8-.5M17.7 9.2l-.5 5.6M8 7.5l7.5 7.8"/></svg>
                </button>
                <button class="ai-action-btn ai-history" type="button" title="历史问答" aria-label="历史问答">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>
                </button>
                <button class="ai-action-btn ai-expand" type="button" title="放大窗口" aria-label="放大窗口" aria-pressed="false">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 5V3h12v12h-2"/></svg>
                </button>
                <button class="ai-action-btn ai-fullscreen" type="button" title="全屏聊天" aria-label="全屏聊天" aria-pressed="false">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>
                </button>
                <button class="ai-action-btn ai-close" type="button" title="关闭" aria-label="关闭">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
                </button>
            </div>
        </div>
        <div class="ai-history-panel" id="aiHistoryPanel"></div>
        <div class="ai-chat-body" id="aiChatBody">
            <div class="ai-msg ai" id="aiInitialMessage">👋 你好！我是您的专属智能助手，正在为您加载页面上下文...</div>
            <div class="ai-typing" id="aiTyping">AI 正在思考...</div>
        </div>
        <div class="ai-suggestions" id="aiSuggestions"></div>
        <div class="ai-input-area">
            <input type="text" class="ai-input" id="aiInput" placeholder="向 AI 提问有关本页面的内容...">
            <button class="ai-send-btn" id="aiSendBtn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </button>
        </div>
    `;
    document.body.appendChild(panel);

    const chatBody = document.getElementById('aiChatBody');
    const input = document.getElementById('aiInput');
    const sendBtn = document.getElementById('aiSendBtn');
    const typing = document.getElementById('aiTyping');
    const suggestionsEl = document.getElementById('aiSuggestions');
    const historyPanel = document.getElementById('aiHistoryPanel');
    const expandBtn = panel.querySelector('.ai-expand');
    const fullscreenBtn = panel.querySelector('.ai-fullscreen');
    const initialMessage = panel.querySelector('#aiInitialMessage');

    function setActionText(element, text) {
        element?.setAttribute('title', text);
        element?.setAttribute('aria-label', text);
    }
    function applyAiLanguage() {
        setActionText(fab, aiT('open'));
        panel.querySelector('.ai-brand-title').textContent = aiT('title');
        panel.querySelector('.ai-brand-subtitle').textContent = aiT('subtitle');
        setActionText(panel.querySelector('.ai-knowledge-graph'), aiT('graph'));
        setActionText(panel.querySelector('.ai-history'), aiT('history'));
        setActionText(expandBtn, panel.classList.contains('expanded') ? aiT('restore') : aiT('expand'));
        setActionText(fullscreenBtn, panel.classList.contains('fullscreen') ? aiT('exitFullscreen') : aiT('fullscreen'));
        setActionText(panel.querySelector('.ai-close'), aiT('close'));
        setActionText(sendBtn, aiT('send'));
        input.placeholder = aiT('placeholder');
        typing.textContent = aiT('thinking');
        if (isFirstOpen && initialMessage) initialMessage.textContent = aiT('welcome');
    }
    
    let isFirstOpen = true;
    let messages = [];
    let currentSessionId = null;
    let cumulativeTokens = 0;
    let cumulativeCost = 0;
    let knowledgeGraphLoader = null;
    const particleFab = createParticleFab(fab);
    function openKnowledgeGraph() {
        if (window.openToolsKnowledgeGraph) {
            window.openToolsKnowledgeGraph().catch(error => appendMessage(`⚠️ ${error.message}`, 'ai'));
            return;
        }
        if (window.AIKnowledgeGraph?.open) {
            window.AIKnowledgeGraph.open();
            return;
        }
        if (!knowledgeGraphLoader) {
            knowledgeGraphLoader = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = '/js/shared/ai-knowledge-graph.js?v=20260810-sidebar1';
                script.onload = resolve;
                script.onerror = () => reject(new Error(aiT('graphLoadFailed')));
                document.body.appendChild(script);
            });
        }
        knowledgeGraphLoader
            .then(() => window.AIKnowledgeGraph?.open?.())
            .catch(error => appendMessage(`⚠️ ${error.message}`, 'ai'));
    }

    function createParticleFab(root) {
        const canvas = root.querySelector('.ai-fab-particles');
        const ctx = canvas.getContext('2d', { alpha: true });
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        const pointCount = 180;
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        const points = Array.from({ length: pointCount }, (_, index) => {
            const y = 1 - (index / (pointCount - 1)) * 2;
            const radius = Math.sqrt(Math.max(0, 1 - y * y));
            const angle = goldenAngle * index;
            const hash = (index * 73) % 97;
            return {
                x: Math.cos(angle) * radius,
                y,
                z: Math.sin(angle) * radius,
                size: 0.52 + (hash / 97) * 0.74,
                phase: (hash / 97) * Math.PI * 2
            };
        });
        let width = 0;
        let height = 0;
        let dpr = 1;
        let raf = 0;
        let lastPaint = 0;
        let startTime = performance.now();
        let hoverAmount = 0;
        let hoverTarget = 0;
        let pulse = 0;

        function resize() {
            const rect = root.getBoundingClientRect();
            const nextDpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
            const nextWidth = Math.max(1, Math.round(rect.width * nextDpr));
            const nextHeight = Math.max(1, Math.round(rect.height * nextDpr));
            if (canvas.width === nextWidth && canvas.height === nextHeight && dpr === nextDpr) return;
            dpr = nextDpr;
            width = rect.width;
            height = rect.height;
            canvas.width = nextWidth;
            canvas.height = nextHeight;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        function draw(now) {
            resize();
            ctx.clearRect(0, 0, width, height);
            const cx = width / 2;
            const cy = height / 2 - 0.5;
            const elapsed = (now - startTime) / 1000;
            hoverAmount += (hoverTarget - hoverAmount) * 0.14;
            pulse *= 0.92;
            const speed = 0.28 + hoverAmount * 1.92;
            const rotation = elapsed * speed;
            const tilt = -0.32 + Math.sin(elapsed * 0.22) * 0.07;
            const cosR = Math.cos(rotation);
            const sinR = Math.sin(rotation);
            const cosT = Math.cos(tilt);
            const sinT = Math.sin(tilt);
            const orbRadius = Math.min(width, height) * (0.31 + pulse * 0.015);
            const projected = [];

            const glow = ctx.createRadialGradient(cx - orbRadius * 0.2, cy - orbRadius * 0.24, 0, cx, cy, orbRadius * 1.35);
            glow.addColorStop(0, `rgba(211, 245, 255, ${0.13 + hoverAmount * 0.05})`);
            glow.addColorStop(0.42, `rgba(100, 126, 255, ${0.1 + hoverAmount * 0.05})`);
            glow.addColorStop(1, 'rgba(50, 48, 143, 0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(cx, cy, orbRadius * 1.36, 0, Math.PI * 2);
            ctx.fill();

            for (let index = 0; index < points.length; index += 1) {
                const point = points[index];
                const wave = 1 + Math.sin(point.phase + elapsed * 1.15) * (0.035 + hoverAmount * 0.016);
                const x1 = (point.x * cosR + point.z * sinR) * wave;
                const z1 = (-point.x * sinR + point.z * cosR) * wave;
                const y1 = point.y * wave;
                const y2 = y1 * cosT - z1 * sinT;
                const z2 = y1 * sinT + z1 * cosT;
                const perspective = 0.84 + (z2 + 1) * 0.13;
                projected.push({
                    x: cx + x1 * orbRadius * perspective,
                    y: cy + y2 * orbRadius * perspective,
                    z: z2,
                    size: point.size * perspective
                });
            }

            projected.sort((a, b) => a.z - b.z);
            for (let index = 0; index < projected.length; index += 1) {
                const point = projected[index];
                const depth = (point.z + 1) / 2;
                const radius = point.size * (1.18 + depth * 0.72 + hoverAmount * 0.12);
                ctx.fillStyle = `rgba(22, 34, 92, ${0.22 + depth * 0.28})`;
                ctx.beginPath();
                ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
                ctx.fill();
            }
            for (let index = 0; index < projected.length; index += 1) {
                const point = projected[index];
                const depth = (point.z + 1) / 2;
                const warm = Math.max(0, depth - 0.68) / 0.32;
                const alpha = 0.2 + depth * 0.68;
                const red = Math.round(104 + depth * 88 + warm * 30);
                const green = Math.round(130 + depth * 94 + warm * 14);
                const blue = Math.round(255 - warm * 38);
                const radius = point.size * (0.72 + depth * 0.62 + hoverAmount * 0.12);
                ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
                ctx.beginPath();
                ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
                ctx.fill();
            }

            const core = ctx.createRadialGradient(cx - 1.5, cy - 2, 0, cx, cy, orbRadius * 0.58);
            core.addColorStop(0, `rgba(244, 252, 255, ${0.72 + hoverAmount * 0.12})`);
            core.addColorStop(0.18, 'rgba(139, 229, 255, 0.2)');
            core.addColorStop(1, 'rgba(91, 72, 220, 0)');
            ctx.fillStyle = core;
            ctx.beginPath();
            ctx.arc(cx, cy, orbRadius * 0.6, 0, Math.PI * 2);
            ctx.fill();
        }

        function loop(now) {
            raf = 0;
            if (document.hidden) return;
            if (now - lastPaint >= 1000 / 30) {
                draw(now);
                lastPaint = now;
            }
            raf = window.requestAnimationFrame(loop);
        }

        function start() {
            if (raf || document.hidden) return;
            if (reducedMotion.matches) {
                draw(performance.now());
                return;
            }
            raf = window.requestAnimationFrame(loop);
        }

        function stop() {
            if (raf) window.cancelAnimationFrame(raf);
            raf = 0;
        }

        root.addEventListener('pointerenter', () => {
            hoverTarget = 1;
        });
        root.addEventListener('pointerleave', () => {
            hoverTarget = 0;
        });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) stop();
            else start();
        });
        reducedMotion.addEventListener?.('change', () => {
            stop();
            startTime = performance.now();
            start();
        });
        window.addEventListener('resize', resize, { passive: true });
        start();

        return {
            pulse() {
                pulse = 1;
                if (reducedMotion.matches) draw(performance.now());
            }
        };
    }

    function getFabRectData() {
        const rect = fab.getBoundingClientRect();
        return {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height
        };
    }

    function notifyFabPosition() {
        window.dispatchEvent(new CustomEvent('tools:ai-fab-position', {
            detail: { rect: getFabRectData() }
        }));
    }

    function openOrClosePanel() {
        panel.classList.toggle('open');
        fab.setAttribute('aria-expanded', panel.classList.contains('open') ? 'true' : 'false');
        if (panel.classList.contains('open')) {
            if (isFirstOpen) {
                isFirstOpen = false;
                initChat();
            }
            loadSuggestions();
            setTimeout(() => input.focus(), 300);
        }
    }
    
    fab.onclick = () => {
        particleFab.pulse();
        openOrClosePanel();
    };

    fab.onkeydown = (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        particleFab.pulse();
        openOrClosePanel();
    };
    
    panel.querySelector('.ai-close').onclick = () => {
        panel.classList.remove('open');
        panel.classList.remove('fullscreen');
        document.body.classList.remove('ai-chat-fullscreen');
        fullscreenBtn.setAttribute('aria-pressed', 'false');
        setActionText(fullscreenBtn, aiT('fullscreen'));
        fab.setAttribute('aria-expanded', 'false');
        fab.focus();
    };
    expandBtn.onclick = () => {
        const expanded = panel.classList.toggle('expanded');
        expandBtn.setAttribute('aria-pressed', expanded ? 'true' : 'false');
        setActionText(expandBtn, expanded ? aiT('restore') : aiT('expand'));
    };
    fullscreenBtn.onclick = () => {
        const fullscreen = panel.classList.toggle('fullscreen');
        document.body.classList.toggle('ai-chat-fullscreen', fullscreen);
        fullscreenBtn.setAttribute('aria-pressed', fullscreen ? 'true' : 'false');
        setActionText(fullscreenBtn, fullscreen ? aiT('exitFullscreen') : aiT('fullscreen'));
        setTimeout(() => input.focus(), 120);
    };
    panel.querySelector('.ai-knowledge-graph').onclick = openKnowledgeGraph;
    panel.querySelector('.ai-history').onclick = async () => {
        historyPanel.classList.toggle('open');
        if (historyPanel.classList.contains('open')) {
            await loadHistorySessions();
        }
    };
    
    window.addEventListener('resize', () => {
        notifyFabPosition();
    }, { passive: true });

    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || !panel.classList.contains('fullscreen')) return;
        panel.classList.remove('fullscreen');
        document.body.classList.remove('ai-chat-fullscreen');
        fullscreenBtn.setAttribute('aria-pressed', 'false');
        setActionText(fullscreenBtn, aiT('fullscreen'));
        input.focus();
    });
    
    setTimeout(notifyFabPosition, 0);
    window.addEventListener('tools:languagechange', applyAiLanguage);
    applyAiLanguage();

    function renderMarkdownLike(text) {
        const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
        const blocks = [];

        function inline(value) {
            const codeTokens = [];
            let source = String(value || '').replace(/`([^`]+)`/g, (_match, code) => {
                const token = `\u0000CODE${codeTokens.length}\u0000`;
                codeTokens.push(`<code>${escapeHtml(code)}</code>`);
                return token;
            });
            source = escapeHtml(source)
                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                .replace(/__([^_]+)__/g, '<strong>$1</strong>')
                .replace(/~~([^~]+)~~/g, '<del>$1</del>');
            codeTokens.forEach((html, index) => {
                source = source.replace(`\u0000CODE${index}\u0000`, html);
            });
            return source;
        }

        function splitTableRow(line) {
            let source = String(line || '').trim();
            if (source.startsWith('|')) source = source.slice(1);
            if (source.endsWith('|')) source = source.slice(0, -1);
            const cells = [];
            let current = '';
            let escaped = false;
            for (const char of source) {
                if (escaped) {
                    current += char;
                    escaped = false;
                } else if (char === '\\') {
                    escaped = true;
                } else if (char === '|') {
                    cells.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            cells.push(current.trim());
            return cells;
        }

        function tableAlignment(cell) {
            const value = String(cell || '').trim();
            if (/^:-{3,}:$/.test(value)) return 'align-center';
            if (/^-{3,}:$/.test(value)) return 'align-right';
            return 'align-left';
        }

        function isTableSeparator(line) {
            const cells = splitTableRow(line);
            return cells.length > 1 && cells.every(cell => /^:?-{3,}:?$/.test(cell));
        }

        function isSpecialStart(index) {
            const line = lines[index] || '';
            return /^```/.test(line.trim())
                || /^#{1,4}\s+/.test(line)
                || /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line)
                || /^\s*>\s?/.test(line)
                || (line.includes('|') && isTableSeparator(lines[index + 1] || ''));
        }

        let index = 0;
        while (index < lines.length) {
            const line = lines[index];
            if (!line.trim()) { index += 1; continue; }

            if (/^```/.test(line.trim())) {
                const language = line.trim().slice(3).trim();
                const code = [];
                index += 1;
                while (index < lines.length && !/^```/.test(lines[index].trim())) code.push(lines[index++]);
                if (index < lines.length) index += 1;
                blocks.push(`<pre data-language="${escapeHtml(language)}"><code>${escapeHtml(code.join('\n'))}</code></pre>`);
                continue;
            }

            if (line.includes('|') && isTableSeparator(lines[index + 1] || '')) {
                const headers = splitTableRow(line);
                const alignments = splitTableRow(lines[index + 1]).map(tableAlignment);
                const rows = [];
                index += 2;
                while (index < lines.length && lines[index].trim() && lines[index].includes('|')) {
                    const cells = splitTableRow(lines[index]);
                    while (cells.length < headers.length) cells.push('');
                    rows.push(cells.slice(0, headers.length));
                    index += 1;
                }
                const head = headers.map((cell, cellIndex) => `<th scope="col" class="${alignments[cellIndex] || 'align-left'}">${inline(cell)}</th>`).join('');
                const body = rows.map(row => `<tr>${row.map((cell, cellIndex) => {
                    const numeric = /^[-+]?\d[\d,.]*(?:%|分|条|个)?$/.test(cell.trim()) ? ' numeric' : '';
                    return `<td class="${alignments[cellIndex] || 'align-left'}${numeric}">${inline(cell)}</td>`;
                }).join('')}</tr>`).join('');
                blocks.push(`<div class="ai-table-wrap" role="region" aria-label="AI 分析表格" tabindex="0"><table class="ai-markdown-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`);
                continue;
            }

            const heading = line.match(/^(#{1,4})\s+(.+)$/);
            if (heading) {
                const level = heading[1].length;
                blocks.push(`<h${level}>${inline(heading[2])}</h${level}>`);
                index += 1;
                continue;
            }

            if (/^\s*[-*+]\s+/.test(line)) {
                const items = [];
                while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
                    items.push(lines[index].replace(/^\s*[-*+]\s+/, ''));
                    index += 1;
                }
                blocks.push(`<ul>${items.map(item => `<li>${inline(item)}</li>`).join('')}</ul>`);
                continue;
            }

            if (/^\s*\d+[.)]\s+/.test(line)) {
                const items = [];
                while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index])) {
                    items.push(lines[index].replace(/^\s*\d+[.)]\s+/, ''));
                    index += 1;
                }
                blocks.push(`<ol>${items.map(item => `<li>${inline(item)}</li>`).join('')}</ol>`);
                continue;
            }

            if (/^\s*>\s?/.test(line)) {
                const quote = [];
                while (index < lines.length && /^\s*>\s?/.test(lines[index])) quote.push(lines[index++].replace(/^\s*>\s?/, ''));
                blocks.push(`<blockquote>${quote.map(inline).join('<br>')}</blockquote>`);
                continue;
            }

            const paragraph = [line.trim()];
            index += 1;
            while (index < lines.length && lines[index].trim() && !isSpecialStart(index)) paragraph.push(lines[index++].trim());
            blocks.push(`<p>${paragraph.map(inline).join('<br>')}</p>`);
        }
        return blocks.join('');
    }

    function escapeHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderGrounding(grounding) {
        if (!grounding || typeof grounding !== 'object') return '';
        const items = [];
        let cacheHtml = '';
        const knowledgeCache = grounding.knowledgeCache;
        if (knowledgeCache) {
            const hitText = knowledgeCache.state === 'hit'
                ? aiT('hitChunks', Number(knowledgeCache.hitCount) || 0)
                : aiT('cacheMiss');
            cacheHtml = `<button type="button" class="ai-grounding-graph" data-open-knowledge-graph="true" title="${escapeHtml(aiT('openGraph'))}">🧠 ${escapeHtml(aiT('cache'))}: ${escapeHtml(hitText)} · ${Number(knowledgeCache.documentCount) || 0} ${escapeHtml(aiT('files'))} / ${Number(knowledgeCache.chunkCount) || 0} ${escapeHtml(aiT('chunks'))}</button>`;
        }
        const dataSource = grounding.dataSource;
        if (dataSource) {
            if (dataSource.available) {
                const month = dataSource.month ? (getAiLang() === 'en' ? `Month ${dataSource.month}` : `${dataSource.month}月`) : aiT('latestMonth');
                const snapshot = dataSource.snapshotId ? ` · ${dataSource.snapshotId}` : '';
                const createdAt = dataSource.createdAt ? ` · ${dataSource.createdAt}` : '';
                items.push(`📊 ${aiT('storedData')}: ${month}${snapshot}${createdAt}`);
            } else if (dataSource.reason) {
                items.push(`📊 ${aiT('data')}: ${dataSource.reason}`);
            }
        }
        const sources = Array.isArray(grounding.knowledgeSources) ? grounding.knowledgeSources : [];
        sources.slice(0, 4).forEach(source => {
            const line = source.startLine ? `:${source.startLine}` : '';
            items.push(`📄 ${source.path || aiT('unknownFile')}${line}`);
        });
        if (!items.length && !cacheHtml) return '';
        return `<div class="ai-grounding"><div class="ai-grounding-title">${escapeHtml(aiT('answerBasis'))}</div>${cacheHtml}${items.map(item => `<div class="ai-grounding-item" title="${escapeHtml(item)}">${escapeHtml(item)}</div>`).join('')}</div>`;
    }

    function appendMessage(text, role, tokens = 0, cost = 0, grounding = null) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'ai-msg ' + role;
        
        let contentHtml = renderMarkdownLike(text);
        if (role === 'ai' && tokens > 0) {
            cumulativeTokens += tokens;
            cumulativeCost += cost;
            const fmtCost = cost > 0 ? aiT('approxCost', cost.toFixed(4)) : '';
            const fmtTotal = cumulativeCost > 0 ? aiT('totalCost', cumulativeCost.toFixed(3)) : '';
            contentHtml += `<div class="ai-token-usage">${aiT('current')}: ${tokens} ${fmtCost} | ${aiT('total')}: ${cumulativeTokens} ${fmtTotal}</div>`;
        }
        if (role === 'ai') contentHtml += renderGrounding(grounding);
        
        msgDiv.innerHTML = contentHtml;
        chatBody.insertBefore(msgDiv, typing);
        chatBody.scrollTop = chatBody.scrollHeight;
    }

    chatBody.addEventListener('click', event => {
        if (event.target.closest('[data-open-knowledge-graph]')) openKnowledgeGraph();
    });

    function getPageContext() {
        const pageTitle = document.title;
        let context = '';
        // 优先抓取页面核心区域
        const contentEl = document.querySelector('.page-content');
        if (contentEl) {
            context = contentEl.innerText;
        } else {
            // 如果没有 page-content 类，退化抓取全部 body
            context = document.body.innerText;
        }
        return { pageTitle, context };
    }

    function getPagePath() {
        return window.location.pathname || '/';
    }

    function getAuthHeaders() {
        const token = localStorage.getItem('tools_token') || sessionStorage.getItem('tools_token');
        return {
            'Content-Type': 'application/json',
            'Authorization': token ? ('Bearer ' + token) : ''
        };
    }

    async function loadSuggestions() {
        try {
            const token = localStorage.getItem('tools_token') || sessionStorage.getItem('tools_token');
            const res = await fetch(`/api/ai/suggestions?pagePath=${encodeURIComponent(getPagePath())}&limit=8`, {
                headers: { 'Authorization': token ? ('Bearer ' + token) : '' }
            });
            const data = await res.json();
            const items = (Array.isArray(data.items) ? data.items : [])
                .filter(item => !/^\[object\s+\w+Event\]$/i.test(String(item.question || '').trim()));
            suggestionsEl.innerHTML = items.map(item => {
                const q = escapeHtml(item.question || '');
                return `<button class="ai-suggestion-chip" title="${q}" data-question="${q}">${q}</button>`;
            }).join('');
            suggestionsEl.querySelectorAll('.ai-suggestion-chip').forEach(btn => {
                btn.onclick = () => sendMessage(btn.getAttribute('data-question') || '');
            });
        } catch (e) {
            suggestionsEl.innerHTML = '';
        }
    }

    async function loadHistorySessions() {
        historyPanel.innerHTML = `<div class="ai-history-meta">${escapeHtml(aiT('historyLoading'))}</div>`;
        try {
            const token = localStorage.getItem('tools_token') || sessionStorage.getItem('tools_token');
            const res = await fetch(`/api/ai/sessions?pagePath=${encodeURIComponent(getPagePath())}&limit=20`, {
                headers: { 'Authorization': token ? ('Bearer ' + token) : '' }
            });
            const data = await res.json();
            const items = Array.isArray(data.items) ? data.items : [];
            if (!items.length) {
                historyPanel.innerHTML = `<div class="ai-history-meta">${escapeHtml(aiT('historyEmpty'))}</div>`;
                return;
            }
            historyPanel.innerHTML = items.map(item => {
                const title = escapeHtml(item.last_question || aiT('unnamed'));
                const meta = escapeHtml(`${item.updated_at || ''} · ${item.message_count || 0} ${aiT('messages')}`);
                return `
                    <div class="ai-history-item" data-session-id="${item.id}">
                        <div class="ai-history-title">${title}</div>
                        <div class="ai-history-meta">${meta}</div>
                    </div>
                `;
            }).join('');
            historyPanel.querySelectorAll('.ai-history-item').forEach(item => {
                item.onclick = () => restoreHistorySession(item.getAttribute('data-session-id'));
            });
        } catch (e) {
            historyPanel.innerHTML = `<div class="ai-history-meta">${escapeHtml(aiT('historyFailed') + e.message)}</div>`;
        }
    }

    async function restoreHistorySession(sessionId) {
        if (!sessionId) return;
        try {
            const token = localStorage.getItem('tools_token') || sessionStorage.getItem('tools_token');
            const res = await fetch(`/api/ai/sessions/${encodeURIComponent(sessionId)}/messages`, {
                headers: { 'Authorization': token ? ('Bearer ' + token) : '' }
            });
            const data = await res.json();
            const items = Array.isArray(data.items) ? data.items : [];
            currentSessionId = sessionId;
            messages = items.map(item => ({
                role: item.role === 'model' ? 'model' : 'user',
                content: item.content || ''
            }));
            cumulativeTokens = 0;
            cumulativeCost = 0;
            Array.from(chatBody.querySelectorAll('.ai-msg')).forEach(node => node.remove());
            items.forEach(item => appendMessage(
                item.content || '',
                item.role === 'model' ? 'ai' : 'user',
                item.role === 'model' ? Number(item.tokens) || 0 : 0,
                item.role === 'model' ? Number(item.cost) || 0 : 0
            ));
            historyPanel.classList.remove('open');
        } catch (e) {
            appendMessage(`⚠️ ${aiT('historyRestoreFailed')}${e.message}`, 'ai');
        }
    }

    async function initChat() {
        typing.style.display = 'block';
        chatBody.scrollTop = chatBody.scrollHeight;

        const { pageTitle, context } = getPageContext();

        // 隐式发送初始消息，要求总结
        messages.push({ role: 'user', content: aiT('initPrompt') });
        
        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ messages, context, pageTitle, pagePath: getPagePath(), uiLanguage: getAiLang(), persist: false })
            });
            const data = await res.json();
            
            if (data.error) throw new Error(data.error);
            
            messages.push({ role: 'model', content: data.reply });
            
            // 替换掉第一条加载提示消息
            let contentHtml = renderMarkdownLike(data.reply);
            if (data.tokens > 0) {
                cumulativeTokens += data.tokens;
                cumulativeCost += data.cost || 0;
                const fmtCost = (data.cost || 0) > 0 ? aiT('approxCost', data.cost.toFixed(4)) : '';
                const fmtTotal = cumulativeCost > 0 ? aiT('totalCost', cumulativeCost.toFixed(3)) : '';
                contentHtml += `<div class="ai-token-usage">${aiT('current')}: ${data.tokens} ${fmtCost} | ${aiT('total')}: ${cumulativeTokens} ${fmtTotal}</div>`;
            }
            contentHtml += renderGrounding(data.grounding);
            chatBody.children[0].innerHTML = contentHtml;
            chatBody.scrollTop = chatBody.scrollHeight;
        } catch (e) {
            chatBody.children[0].textContent = `⚠️ ${aiT('connectFailed')}${e.message}`;
        } finally {
            typing.style.display = 'none';
        }
    }

    async function sendMessage(presetText) {
        const text = String(presetText || input.value || '').trim();
        if (!text) return;

        suggestionsEl.classList.add('is-collapsed');
        
        appendMessage(text, 'user');
        input.value = '';
        messages.push({ role: 'user', content: text });
        
        typing.style.display = 'block';
        chatBody.scrollTop = chatBody.scrollHeight;
        
        const { pageTitle, context } = getPageContext();

        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    messages,
                    context,
                    pageTitle,
                    pagePath: getPagePath(),
                    uiLanguage: getAiLang(),
                    sessionId: currentSessionId
                })
            });
            const data = await res.json();
            
            if (data.error) throw new Error(data.error);
            
            if (data.sessionId) currentSessionId = data.sessionId;
            messages.push({ role: 'model', content: data.reply });
            appendMessage(data.reply, 'ai', data.tokens || 0, data.cost || 0, data.grounding);
            loadSuggestions();
        } catch (e) {
            const last = messages[messages.length - 1];
            if (last && last.role === 'user' && last.content === text) {
                messages.pop();
            }
            appendMessage(`⚠️ ${aiT('error')}${e.message}`, 'ai');
        } finally {
            typing.style.display = 'none';
            input.focus();
        }
    }

    sendBtn.onclick = () => sendMessage();
    input.addEventListener('input', () => {
        if (input.value.trim()) suggestionsEl.classList.add('is-collapsed');
    });
    input.onkeydown = (event) => {
        if (event.key !== 'Enter' || event.isComposing) return;
        event.preventDefault();
        sendMessage();
    };

})();
