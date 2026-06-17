// js/app.js
import * as store from './store.js';
import * as editor from './editor.js';

const deck = document.getElementById('deck');
const deckWrapper = document.getElementById('deckWrapper');
const thumbDeck = document.getElementById('thumbDeck');
const thumbZoom = document.getElementById('thumbZoom');
const thumbZoomLabel = document.getElementById('thumbZoomLabel');
const mainZoomLabel = document.getElementById('mainZoomLabel');
const statusText = document.getElementById('statusText');

let activeSlideIndex = store.getActiveSlideIndex();
let saveTimer = null;
let thumbTimer = null;
let currentEditorScale = 1.0;

function setStatus(text) {
    statusText.textContent = text;
}

function getSlideWraps() {
    return Array.from(deck.querySelectorAll('.slide-wrap'));
}

function renumberSlides() {
    getSlideWraps().forEach((wrap, index) => {
        const num = wrap.querySelector('.slide-num');
        if (num) num.textContent = String(index + 1);
    });
}

function renderThumbnails() {
    const wraps = getSlideWraps();
    thumbDeck.innerHTML = '';
    wraps.forEach((wrap, index) => {
        const item = document.createElement('div');
        item.className = `thumb-item ${index === activeSlideIndex ? 'active' : ''}`;
        
        const numSpan = document.createElement('span');
        numSpan.className = 'thumb-num';
        numSpan.textContent = String(index + 1);
        
        const shell = document.createElement('div');
        shell.className = 'thumb-shell';
        
        const slide = wrap.querySelector('.slide');
        shell.appendChild(editor.scrubClone(slide.cloneNode(true)));
        
        item.appendChild(numSpan);
        item.appendChild(shell);
        
        item.addEventListener('click', () => setActiveSlide(index));
        thumbDeck.appendChild(item);
    });
}

function scheduleThumbnails() {
    clearTimeout(thumbTimer);
    thumbTimer = setTimeout(renderThumbnails, 300);
}

function setActiveSlide(index) {
    const wraps = getSlideWraps();
    if (!wraps.length) return;
    activeSlideIndex = Math.max(0, Math.min(index, wraps.length - 1));
    wraps.forEach((wrap, i) => wrap.classList.toggle('is-active', i === activeSlideIndex));
    store.saveActiveSlideIndex(activeSlideIndex);
    renderThumbnails();
}

function saveDeck() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        store.saveState(deck.innerHTML);
        setStatus('已自动保存');
    }, 500);
}

function applyThumbZoom(value) {
    const scale = Number(value) / 100;
    document.documentElement.style.setProperty('--thumb-scale', String(scale));
    thumbZoomLabel.textContent = `${value}%`;
    store.saveThumbZoom(value);
    
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        // Thumbnail width is 480 * scale
        // Add 32px for #thumbDeck padding (p-4 = 16px * 2)
        // Add 32px for .thumb-item padding (16px * 2)
        // Add 12px for gap
        // Add 20px for .thumb-num min-width
        // Add 14px extra buffer for custom-scrollbar and borders
        // Total extra width = 32 + 32 + 12 + 20 + 14 = 110
        const newWidth = Math.max(180, 480 * scale + 110);
        sidebar.style.width = `${newWidth}px`;
    }
}

function applyEditorZoom(scale) {
    currentEditorScale = scale;
    document.documentElement.style.setProperty('--editor-scale', String(scale));
    mainZoomLabel.textContent = `${Math.round(scale * 100)}%`;
}

function bootstrap() {
    const savedHtml = store.loadState();
    if (savedHtml) {
        deck.innerHTML = savedHtml;
    }
    
    renumberSlides();
    setActiveSlide(activeSlideIndex);
    
    const savedZoom = store.getThumbZoom();
    thumbZoom.value = savedZoom;
    applyThumbZoom(savedZoom);
    
    setTimeout(() => {
        document.getElementById('zoomFitBtn')?.click();
    }, 100);
}

// Event Listeners
deck.addEventListener('input', () => {
    setStatus('正在保存...');
    saveDeck();
    scheduleThumbnails();
});

deck.addEventListener('paste', event => {
    const items = Array.from(event.clipboardData && event.clipboardData.items || []);
    const imageItem = items.find(item => item.type.startsWith('image/'));
    if (!imageItem) return;
    const target = event.target.closest('.qr, .slide-pad, .slide');
    if (!target) return;
    event.preventDefault();
    const file = imageItem.getAsFile();
    const reader = new FileReader();
    reader.onload = () => {
        if (event.target.closest('.qr')) {
            const qr = event.target.closest('.qr').querySelector('.qr-box');
            qr.style.background = `url("${reader.result}") center / cover no-repeat`;
            qr.innerHTML = '';
        } else {
            const img = document.createElement('img');
            img.src = reader.result;
            img.style.maxWidth = '180px';
            img.style.maxHeight = '120px';
            img.style.objectFit = 'contain';
            img.style.position = 'absolute';
            img.style.left = '210px';
            img.style.top = '130px';
            target.appendChild(img);
        }
        saveDeck();
        scheduleThumbnails();
    };
    reader.readAsDataURL(file);
});

thumbZoom.addEventListener('input', e => applyThumbZoom(e.target.value));

document.getElementById('addCaseBtn').addEventListener('click', () => {
    const template = document.getElementById('caseSlideTemplate');
    if (!template) return;
    deck.appendChild(template.content.firstElementChild.cloneNode(true));
    renumberSlides();
    setActiveSlide(getSlideWraps().length - 1);
    saveDeck();
});

document.getElementById('exportPdfBtn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="ph ph-spinner animate-spin"></i> 导出中...';
    
    const success = await editor.exportPdf(deck, setStatus);
    
    btn.disabled = false;
    btn.innerHTML = originalHtml;
    setStatus(success ? 'PDF 已导出' : '导出失败');
});

document.getElementById('exportJsonBtn').addEventListener('click', () => {
    const payload = {
        version: 3,
        exportedAt: new Date().toISOString(),
        html: deck.innerHTML
    };
    editor.downloadBlob(`安全大会模板_${new Date().toISOString().slice(0, 10)}.json`, new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }));
});

document.getElementById('importJsonInput').addEventListener('change', async event => {
    const file = event.target.files && event.target.files[0];
    if (file) {
        try {
            const payload = JSON.parse(await file.text());
            if (!payload || !payload.html) throw new Error('JSON 数据无效');
            deck.innerHTML = payload.html;
            renumberSlides();
            setActiveSlide(0);
            saveDeck();
            setStatus('导入完成');
        } catch(e) {
            alert(`导入失败: ${e.message}`);
        }
    }
    event.target.value = '';
});

document.getElementById('resetBtn').addEventListener('click', () => {
    if (confirm('确认恢复默认模板？当前编辑的内容将被清空。')) {
        store.clearState();
        location.reload();
    }
});

document.getElementById('zoomOutBtn').addEventListener('click', () => {
    if (currentEditorScale > 0.5) applyEditorZoom(currentEditorScale - 0.25);
});
document.getElementById('zoomInBtn').addEventListener('click', () => {
    if (currentEditorScale < 3.0) applyEditorZoom(currentEditorScale + 0.25);
});
document.getElementById('zoomFitBtn').addEventListener('click', () => {
    const w = deckWrapper.clientWidth - 80;
    const h = deckWrapper.clientHeight - 80;
    const scale = Math.max(0.5, Math.min(w / 480, h / 360));
    applyEditorZoom(scale);
});

// --- Global Content Deletion Feature ---
const deleteBtn = document.createElement('button');
deleteBtn.innerHTML = '<i class="ph-bold ph-trash"></i>';
deleteBtn.className = 'absolute hidden z-50 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg flex items-center justify-center cursor-pointer transition-transform hover:scale-110 active:scale-95';
document.body.appendChild(deleteBtn);

let currentDeleteTarget = null;
const deletableSelectors = ['.editable', '.rule-box', 'tr', 'li', '.box', '.qr', '.sticky-note', '.speaker', '.cover-banner', '.cover-photo', '.cover-copy', '.footer', 'img', '.agenda-table', '.case-layout', '.case-cells div', '.case-labels div'];

deck.addEventListener('mouseover', (e) => {
    const target = e.target.closest(deletableSelectors.join(', '));
    if (!target) return;
    
    currentDeleteTarget = target;
    const rect = target.getBoundingClientRect();
    
    deleteBtn.style.top = `${rect.top - 12}px`;
    deleteBtn.style.left = `${rect.right - 12}px`;
    deleteBtn.classList.remove('hidden');
});

deleteBtn.addEventListener('mouseover', () => {
    deleteBtn.classList.remove('hidden');
});

document.addEventListener('mousemove', (e) => {
    if (!currentDeleteTarget) return;
    const targetRect = currentDeleteTarget.getBoundingClientRect();
    const btnRect = deleteBtn.getBoundingClientRect();
    
    const pad = 16;
    const isHoveringTarget = e.clientX >= targetRect.left - pad && e.clientX <= targetRect.right + pad && e.clientY >= targetRect.top - pad && e.clientY <= targetRect.bottom + pad;
    const isHoveringBtn = e.clientX >= btnRect.left - pad && e.clientX <= btnRect.right + pad && e.clientY >= btnRect.top - pad && e.clientY <= btnRect.bottom + pad;
    
    if (!isHoveringTarget && !isHoveringBtn) {
        deleteBtn.classList.add('hidden');
        currentDeleteTarget = null;
    }
});

deleteBtn.addEventListener('click', () => {
    if (currentDeleteTarget) {
        currentDeleteTarget.remove();
        deleteBtn.classList.add('hidden');
        currentDeleteTarget = null;
        saveDeck();
        scheduleThumbnails();
    }
});

// --- AI Copilot Feature ---
const toggleAiBtn = document.getElementById('toggleAiBtn');
const aiSidebar = document.getElementById('aiSidebar');
const closeAiBtn = document.getElementById('closeAiBtn');
const aiChatWindow = document.getElementById('aiChatWindow');
const aiInput = document.getElementById('aiInput');
const aiSendBtn = document.getElementById('aiSendBtn');
const aiSettingsBtn = document.getElementById('aiSettingsBtn');
const aiSettingsPanel = document.getElementById('aiSettingsPanel');
const aiRulesInput = document.getElementById('aiRulesInput');
const saveAiRulesBtn = document.getElementById('saveAiRulesBtn');

let aiMessages = [];

function toggleAi() {
    aiSidebar.classList.toggle('translate-x-full');
}

if (toggleAiBtn) toggleAiBtn.addEventListener('click', toggleAi);
if (closeAiBtn) closeAiBtn.addEventListener('click', toggleAi);

if (aiSettingsBtn) {
    aiSettingsBtn.addEventListener('click', () => {
        aiSettingsPanel.classList.toggle('hidden');
    });
    aiRulesInput.value = localStorage.getItem('ppt_copilot_rules') || '';
    saveAiRulesBtn.addEventListener('click', () => {
        localStorage.setItem('ppt_copilot_rules', aiRulesInput.value.trim());
        aiSettingsPanel.classList.add('hidden');
    });
}

function appendAiMessage(role, text) {
    const div = document.createElement('div');
    div.className = "flex items-start space-x-2 mt-4";
    if (role === 'user') {
        div.innerHTML = `
            <div class="flex-1"></div>
            <div class="bg-purple-600 text-white rounded-lg rounded-tr-none p-3 max-w-[85%] leading-relaxed shadow-sm text-[13px]">
                ${text.replace(/\n/g, '<br>')}
            </div>
            <div class="w-8 h-8 rounded bg-zinc-800 text-zinc-400 flex items-center justify-center shrink-0">
                <i class="ph-fill ph-user"></i>
            </div>
        `;
    } else {
        div.innerHTML = `
            <div class="w-8 h-8 rounded bg-purple-600/20 text-purple-400 flex items-center justify-center shrink-0">
                <i class="ph-fill ph-robot"></i>
            </div>
            <div class="bg-zinc-800 text-zinc-200 rounded-lg rounded-tl-none p-3 max-w-[85%] leading-relaxed shadow-sm border border-zinc-700/50 text-[13px]">
                ${text.replace(/\n/g, '<br>')}
            </div>
        `;
    }
    aiChatWindow.appendChild(div);
    aiChatWindow.scrollTop = aiChatWindow.scrollHeight;
}

async function sendAiMessage() {
    const text = aiInput.value.trim();
    if (!text) return;
    
    aiInput.value = '';
    appendAiMessage('user', text);
    aiMessages.push({ role: 'user', content: text });
    
    const loadingId = 'ai-loading-' + Date.now();
    const loadDiv = document.createElement('div');
    loadDiv.id = loadingId;
    loadDiv.className = "flex items-start space-x-2 mt-4 opacity-50";
    loadDiv.innerHTML = `<div class="w-8 h-8 rounded bg-purple-600/20 text-purple-400 flex items-center justify-center shrink-0"><i class="ph-fill ph-robot animate-pulse"></i></div><div class="bg-zinc-800 text-zinc-200 rounded-lg rounded-tl-none p-3 text-xs">正在思考并生成代码...</div>`;
    aiChatWindow.appendChild(loadDiv);
    aiChatWindow.scrollTop = aiChatWindow.scrollHeight;

    try {
        const deckSlides = deck.querySelectorAll('.slide-wrap');
        const coverTpl = deckSlides[0] ? deckSlides[0].outerHTML : '';
        const ruleTpl = deckSlides[1] ? deckSlides[1].outerHTML : '';
        const agendaTpl = deckSlides[2] ? deckSlides[2].outerHTML : '';
        const caseTpl = document.getElementById('caseSlideTemplate') ? document.getElementById('caseSlideTemplate').innerHTML : '';
        
        const customRules = localStorage.getItem('ppt_copilot_rules') || '';
        const rulesBlock = customRules ? `\n【用户专属 PPT 制作规范（必须严格遵守）】\n${customRules}\n\n` : '';
        
        const templates = `${rulesBlock}[封面模板示例]\n${coverTpl}\n\n[规则模板示例]\n${ruleTpl}\n\n[议程模板示例]\n${agendaTpl}\n\n[案例模板示例]\n${caseTpl}`;

        const tokenMatch = document.cookie.match(/(^|;)\s*jwt_token=([^;]+)/);
        const token = tokenMatch ? tokenMatch[2] : localStorage.getItem('tools_token');

        const res = await fetch('/api/ai/ppt-copilot', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? 'Bearer ' + token : ''
            },
            body: JSON.stringify({
                messages: aiMessages,
                templates: templates
            })
        });
        
        const el = document.getElementById(loadingId);
        if (el) el.remove();
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || '请求失败');
        }
        
        const data = await res.json();
        let reply = data.reply || '';
        aiMessages.push({ role: 'model', content: reply });
        
        let htmlContent = reply;
        const htmlMatch = reply.match(/```html\n([\s\S]*?)```/i) || reply.match(/```\n([\s\S]*?)```/i);
        if (htmlMatch) {
            htmlContent = htmlMatch[1];
        }
        
        if (htmlContent.includes('class="slide-wrap"') || htmlContent.includes("class='slide-wrap'")) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlContent;
            
            const generatedWraps = tempDiv.querySelectorAll('.slide-wrap');
            if (generatedWraps.length > 0) {
                generatedWraps.forEach(wrap => {
                    wrap.classList.remove('is-active');
                    deck.appendChild(wrap);
                });
                
                renumberSlides();
                saveDeck();
                scheduleThumbnails();
                
                appendAiMessage('model', '✨ **幻灯片生成完毕！** 我已经为您添加到了画布末尾，请在左侧预览。');
            } else {
                appendAiMessage('model', reply);
            }
        } else {
            appendAiMessage('model', reply);
        }
        
    } catch (error) {
        const el = document.getElementById(loadingId);
        if (el) el.remove();
        appendAiMessage('model', `⚠️ 发生错误: ${error.message}`);
        aiMessages.pop();
    }
}

if (aiSendBtn) aiSendBtn.addEventListener('click', sendAiMessage);
if (aiInput) aiInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendAiMessage();
    }
});

// Start app
bootstrap();
