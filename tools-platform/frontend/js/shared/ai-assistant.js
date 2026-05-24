/**
 * 全局悬浮 AI 客服助手组件
 * 封装在 IIFE 中，避免污染全局变量
 */
(function () {
    // 注入 marked.js (用于解析 Markdown)
    const markedScript = document.createElement('script');
    markedScript.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
    document.head.appendChild(markedScript);

    // 注入 CSS 样式
    const style = document.createElement('style');
    style.innerHTML = `
        /* AI Assistant 样式定义 */
        .ai-fab {
            position: fixed;
            bottom: 40px;
            right: 40px;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.25);
            cursor: pointer;
            z-index: 100000;
            transition: transform 0.3s, box-shadow 0.3s;
        }
        .ai-fab:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 20px rgba(0,0,0,0.3);
        }
        .ai-panel {
            position: fixed;
            bottom: 110px;
            right: 40px;
            width: 360px;
            height: 550px;
            background: #fff !important;
            color: #334155 !important;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
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
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
            background: #f8fafc;
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
            background: #667eea;
            color: #fff;
            align-self: flex-end;
            border-bottom-right-radius: 4px;
        }
        .ai-msg.ai {
            background: #fff;
            color: #334155;
            align-self: flex-start;
            border-bottom-left-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            border: 1px solid #e2e8f0;
        }
        .ai-msg p { margin: 0 0 8px 0; }
        .ai-msg p:last-child { margin: 0; }
        .ai-msg ul, .ai-msg ol {
            margin: 0 0 8px 0;
            padding-left: 20px;
        }
        .ai-msg li { margin-bottom: 4px; }
        .ai-msg pre {
            background: #f1f5f9;
            padding: 8px;
            border-radius: 6px;
            overflow-x: auto;
            font-size: 13px;
        }
        .ai-msg code {
            background: #f1f5f9;
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
            padding: 16px;
            background: #fff;
            border-top: 1px solid #e2e8f0;
            gap: 10px;
            align-items: center;
        }
        .ai-input {
            flex: 1;
            padding: 12px 16px;
            border: 1px solid #cbd5e1;
            border-radius: 24px;
            outline: none;
            font-size: 14px;
            transition: all 0.2s;
            background: #f1f5f9;
            color: #1e293b !important;
        }
        .ai-input::placeholder {
            color: #94a3b8 !important;
        }
        .ai-input:focus {
            border-color: #667eea;
            background: #fff;
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
    `;
    document.head.appendChild(style);

    // 创建 DOM
    const fab = document.createElement('div');
    fab.className = 'ai-fab';
    fab.innerHTML = '✨';
    document.body.appendChild(fab);

    const panel = document.createElement('div');
    panel.className = 'ai-panel';
    panel.innerHTML = `
        <div class="ai-header">
            <div>🤖 智能客服助手</div>
            <div style="display:flex; gap:8px;">
                <button class="ai-action-btn ai-expand" title="最大化/还原">⤢</button>
                <button class="ai-action-btn ai-close" title="关闭">×</button>
            </div>
        </div>
        <div class="ai-chat-body" id="aiChatBody">
            <div class="ai-msg ai">👋 你好！我是您的专属智能助手，正在为您加载页面上下文...</div>
            <div class="ai-typing" id="aiTyping">AI 正在思考...</div>
        </div>
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
    
    let isFirstOpen = true;
    let messages = [];
    let cumulativeTokens = 0;
    let cumulativeCost = 0;
    
    // 打开/关闭面板
    fab.onclick = () => {
        panel.classList.toggle('open');
        if (panel.classList.contains('open')) {
            if (isFirstOpen) {
                isFirstOpen = false;
                initChat();
            }
            setTimeout(() => input.focus(), 300);
        }
    };
    
    panel.querySelector('.ai-close').onclick = () => panel.classList.remove('open');
    panel.querySelector('.ai-expand').onclick = () => panel.classList.toggle('expanded');

    function renderMarkdownLike(text) {
        if (typeof marked !== 'undefined') {
            return marked.parse(text);
        }
        let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/`(.*?)`/g, '<code style="background:#f1f5f9;padding:2px 4px;border-radius:4px;color:#ef4444;">$1</code>');
        html = html.replace(/\n/g, '<br/>');
        return html;
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

    async function initChat() {
        typing.style.display = 'block';
        chatBody.scrollTop = chatBody.scrollHeight;

        const { pageTitle, context } = getPageContext();

        // 隐式发送初始消息，要求总结
        messages.push({ role: 'user', content: '你好，请用简短的话总结一下这个页面的核心功能以及如何使用它。' });
        
        try {
            const token = localStorage.getItem('tools_token') || sessionStorage.getItem('tools_token');
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': token ? ('Bearer ' + token) : ''
                },
                body: JSON.stringify({ messages, context, pageTitle })
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

    async function sendMessage() {
        const text = input.value.trim();
        if (!text) return;
        
        appendMessage(text, 'user');
        input.value = '';
        messages.push({ role: 'user', content: text });
        
        typing.style.display = 'block';
        chatBody.scrollTop = chatBody.scrollHeight;
        
        const { pageTitle, context } = getPageContext();

        try {
            const token = localStorage.getItem('tools_token') || sessionStorage.getItem('tools_token');
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': token ? ('Bearer ' + token) : ''
                },
                body: JSON.stringify({ messages, context, pageTitle })
            });
            const data = await res.json();
            
            if (data.error) throw new Error(data.error);
            
            messages.push({ role: 'model', content: data.reply });
            appendMessage(data.reply, 'ai', data.tokens || 0, data.cost || 0);
        } catch (e) {
            appendMessage('⚠️ 错误: ' + e.message, 'ai');
        } finally {
            typing.style.display = 'none';
            input.focus();
        }
    }

    sendBtn.onclick = sendMessage;
    input.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };

})();
