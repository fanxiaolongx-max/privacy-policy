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
            width: 360px;
            height: 550px;
            background:
                linear-gradient(155deg, rgba(255,255,255,0.32), rgba(207,219,248,0.18)) !important;
            color: #334155 !important;
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,0.72);
            -webkit-backdrop-filter: blur(36px) saturate(1.55);
            backdrop-filter: blur(36px) saturate(1.55);
            box-shadow:
                0 18px 54px rgba(15,23,42,0.24),
                0 0 0 1px rgba(92,110,175,0.12),
                inset 0 1px 0 rgba(255,255,255,0.72);
            z-index: 100000;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transform: translateY(20px) scale(0.95);
            opacity: 0;
            pointer-events: none;
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            transform-origin: bottom right;
        }
        .ai-panel.open {
            transform: translateY(0) scale(1);
            opacity: 1;
            pointer-events: auto;
        }
        .ai-panel.expanded {
            width: 600px;
            height: 80vh;
            max-width: 90vw;
            max-height: 800px;
        }
        .ai-header {
            background: linear-gradient(135deg, rgba(82,103,218,0.66), rgba(110,59,153,0.58));
            -webkit-backdrop-filter: blur(18px) saturate(1.2);
            backdrop-filter: blur(18px) saturate(1.2);
            color: #fff;
            padding: 16px 20px;
            font-size: 16px;
            font-weight: 600;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .ai-action-btn {
            background: rgba(255,255,255,0.2);
            border: none;
            color: #fff !important;
            font-size: 16px;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        }
        .ai-action-btn:hover {
            background: rgba(255,255,255,0.3);
        }
        .ai-action-btn.ai-close {
            font-size: 20px;
            line-height: 1;
        }
        .ai-chat-body {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            background:
                linear-gradient(180deg, rgba(248,250,252,0.12), rgba(226,232,240,0.04));
            display: flex;
            flex-direction: column;
            gap: 16px;
            scroll-behavior: smooth;
        }
        .ai-msg {
            max-width: 85%;
            padding: 12px 16px;
            border-radius: 14px;
            font-size: 14px;
            line-height: 1.6;
            word-wrap: break-word;
        }
        .ai-msg.user {
            background: rgba(89,108,220,0.92);
            color: #fff;
            align-self: flex-end;
            border-bottom-right-radius: 4px;
        }
        .ai-msg.ai {
            background: rgba(255,255,255,0.84);
            color: #243247;
            align-self: flex-start;
            border-bottom-left-radius: 4px;
            box-shadow: 0 4px 14px rgba(30,41,59,0.08);
            border: 1px solid rgba(255,255,255,0.82);
        }
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
        .ai-token-usage {
            font-size: 11px;
            color: #94a3b8;
            margin-top: 8px;
            text-align: right;
            border-top: 1px dashed #e2e8f0;
            padding-top: 6px;
        }
        .ai-input-area {
            display: flex;
            padding: 12px 16px 16px;
            background: rgba(255,255,255,0.22);
            border-top: 1px solid rgba(148,163,184,0.24);
            -webkit-backdrop-filter: blur(16px);
            backdrop-filter: blur(16px);
            gap: 10px;
            align-items: center;
        }
        .ai-input {
            flex: 1;
            padding: 12px 16px;
            border: 1px solid rgba(148,163,184,0.54);
            border-radius: 24px;
            outline: none;
            font-size: 14px;
            transition: all 0.2s;
            background: rgba(248,250,252,0.84);
            color: #1e293b !important;
        }
        .ai-input::placeholder {
            color: #94a3b8 !important;
        }
        .ai-input:focus {
            border-color: #667eea;
            background: rgba(255,255,255,0.9);
            box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
        }
        .ai-send-btn {
            background: #667eea;
            color: #fff;
            border: none;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            box-shadow: 0 2px 6px rgba(102,126,234,0.3);
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
            padding: 10px 16px 22px;
            background: rgba(255,255,255,0.18);
            border-top: 1px solid rgba(148,163,184,0.22);
            height: 96px;
            overflow-x: auto;
            overflow-y: hidden;
            align-content: start;
            flex: 0 0 auto;
            scrollbar-width: thin;
            overscroll-behavior-x: contain;
            -webkit-overflow-scrolling: touch;
        }
        .ai-suggestion-chip {
            width: 100%;
            max-width: none;
            min-width: 0;
            border: 1px solid rgba(174,188,255,0.66);
            background: rgba(245,247,255,0.74);
            color: #4f5fbf;
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
        .ai-suggestions:empty {
            display: none;
        }
        .ai-suggestion-chip:hover {
            background: rgba(238,242,255,0.92);
            border-color: #aebcff;
        }
        .ai-history-panel {
            display: none;
            background: rgba(255,255,255,0.24);
            border-bottom: 1px solid rgba(148,163,184,0.24);
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
            <div>🤖 智能客服助手</div>
            <div style="display:flex; gap:8px;">
                <button class="ai-action-btn ai-history" title="历史问答">↺</button>
                <button class="ai-action-btn ai-expand" title="最大化/还原">⤢</button>
                <button class="ai-action-btn ai-close" title="关闭">×</button>
            </div>
        </div>
        <div class="ai-history-panel" id="aiHistoryPanel"></div>
        <div class="ai-chat-body" id="aiChatBody">
            <div class="ai-msg ai">👋 你好！我是您的专属智能助手，正在为您加载页面上下文...</div>
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
    
    let isFirstOpen = true;
    let messages = [];
    let currentSessionId = null;
    let cumulativeTokens = 0;
    let cumulativeCost = 0;
    const particleFab = createParticleFab(fab);

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
            hoverAmount += (hoverTarget - hoverAmount) * 0.08;
            pulse *= 0.92;
            const speed = 0.28 + hoverAmount * 0.46;
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
        fab.setAttribute('aria-expanded', 'false');
        fab.focus();
    };
    panel.querySelector('.ai-expand').onclick = () => {
        panel.classList.toggle('expanded');
    };
    panel.querySelector('.ai-history').onclick = async () => {
        historyPanel.classList.toggle('open');
        if (historyPanel.classList.contains('open')) {
            await loadHistorySessions();
        }
    };
    
    window.addEventListener('resize', () => {
        notifyFabPosition();
    }, { passive: true });
    
    setTimeout(notifyFabPosition, 0);

    function renderMarkdownLike(text) {
        if (typeof marked !== 'undefined' && marked && typeof marked.parse === 'function') {
            return marked.parse(text);
        }
        let html = escapeHtml(text);
        html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/`(.*?)`/g, '<code style="background:#f1f5f9;padding:2px 4px;border-radius:4px;color:#ef4444;">$1</code>');
        html = html.replace(/\n/g, '<br/>');
        return html;
    }

    function escapeHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function appendMessage(text, role, tokens = 0, cost = 0) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'ai-msg ' + role;
        
        let contentHtml = renderMarkdownLike(text);
        if (role === 'ai' && tokens > 0) {
            cumulativeTokens += tokens;
            cumulativeCost += cost;
            const fmtCost = cost > 0 ? `(约${cost.toFixed(4)}毛)` : '';
            const fmtTotal = cumulativeCost > 0 ? `(总计${cumulativeCost.toFixed(3)}毛)` : '';
            contentHtml += `<div class="ai-token-usage">本次: ${tokens} ${fmtCost} | 累计: ${cumulativeTokens} ${fmtTotal}</div>`;
        }
        
        msgDiv.innerHTML = contentHtml;
        chatBody.insertBefore(msgDiv, typing);
        chatBody.scrollTop = chatBody.scrollHeight;
    }

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
            const items = Array.isArray(data.items) ? data.items : [];
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
        historyPanel.innerHTML = '<div class="ai-history-meta">正在加载历史问答...</div>';
        try {
            const token = localStorage.getItem('tools_token') || sessionStorage.getItem('tools_token');
            const res = await fetch(`/api/ai/sessions?pagePath=${encodeURIComponent(getPagePath())}&limit=20`, {
                headers: { 'Authorization': token ? ('Bearer ' + token) : '' }
            });
            const data = await res.json();
            const items = Array.isArray(data.items) ? data.items : [];
            if (!items.length) {
                historyPanel.innerHTML = '<div class="ai-history-meta">暂无历史问答</div>';
                return;
            }
            historyPanel.innerHTML = items.map(item => {
                const title = escapeHtml(item.last_question || '未命名对话');
                const meta = escapeHtml(`${item.updated_at || ''} · ${item.message_count || 0} 条`);
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
            historyPanel.innerHTML = '<div class="ai-history-meta">历史问答加载失败：' + e.message + '</div>';
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
            appendMessage('⚠️ 历史问答恢复失败: ' + e.message, 'ai');
        }
    }

    async function initChat() {
        typing.style.display = 'block';
        chatBody.scrollTop = chatBody.scrollHeight;

        const { pageTitle, context } = getPageContext();

        // 隐式发送初始消息，要求总结
        messages.push({ role: 'user', content: '你好，请用简短的话总结一下这个页面的核心功能以及如何使用它。' });
        
        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ messages, context, pageTitle, pagePath: getPagePath(), persist: false })
            });
            const data = await res.json();
            
            if (data.error) throw new Error(data.error);
            
            messages.push({ role: 'model', content: data.reply });
            
            // 替换掉第一条加载提示消息
            let contentHtml = renderMarkdownLike(data.reply);
            if (data.tokens > 0) {
                cumulativeTokens += data.tokens;
                cumulativeCost += data.cost || 0;
                const fmtCost = (data.cost || 0) > 0 ? `(约${data.cost.toFixed(4)}毛)` : '';
                const fmtTotal = cumulativeCost > 0 ? `(总计${cumulativeCost.toFixed(3)}毛)` : '';
                contentHtml += `<div class="ai-token-usage">本次: ${data.tokens} ${fmtCost} | 累计: ${cumulativeTokens} ${fmtTotal}</div>`;
            }
            chatBody.children[0].innerHTML = contentHtml;
            chatBody.scrollTop = chatBody.scrollHeight;
        } catch (e) {
            chatBody.children[0].innerHTML = '⚠️ 连接 AI 服务失败: ' + e.message;
        } finally {
            typing.style.display = 'none';
        }
    }

    async function sendMessage(presetText) {
        const text = String(presetText || input.value || '').trim();
        if (!text) return;
        
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
                    sessionId: currentSessionId
                })
            });
            const data = await res.json();
            
            if (data.error) throw new Error(data.error);
            
            if (data.sessionId) currentSessionId = data.sessionId;
            messages.push({ role: 'model', content: data.reply });
            appendMessage(data.reply, 'ai', data.tokens || 0, data.cost || 0);
            loadSuggestions();
        } catch (e) {
            const last = messages[messages.length - 1];
            if (last && last.role === 'user' && last.content === text) {
                messages.pop();
            }
            appendMessage('⚠️ 错误: ' + e.message, 'ai');
        } finally {
            typing.style.display = 'none';
            input.focus();
        }
    }

    sendBtn.onclick = sendMessage;
    input.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };

})();
