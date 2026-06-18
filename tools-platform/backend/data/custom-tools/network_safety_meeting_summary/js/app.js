// js/app.js
import * as store from './store.js';
import * as editor from './editor.js';

const deck = document.getElementById('deck');
const deckWrapper = document.getElementById('deckWrapper');
const thumbDeck = document.getElementById('thumbDeck');
const sidebar = document.getElementById('sidebar');
const aiSidebar = document.getElementById('aiSidebar');

function updateThumbScale() {
    if (!sidebar || !thumbDeck) return;
    const item = thumbDeck.querySelector('.thumb-item');
    const num = item?.querySelector('.thumb-num');
    const shell = item?.querySelector('.thumb-shell');
    if (!item || !num || !shell) return;

    const itemStyle = getComputedStyle(item);
    const shellStyle = getComputedStyle(shell);
    const availableWidth = item.clientWidth
        - parseFloat(itemStyle.paddingLeft)
        - parseFloat(itemStyle.paddingRight)
        - parseFloat(itemStyle.gap || '0')
        - num.getBoundingClientRect().width
        - parseFloat(shellStyle.borderLeftWidth)
        - parseFloat(shellStyle.borderRightWidth);
    const scale = Math.max(0.1, availableWidth / 480);
    document.documentElement.style.setProperty('--thumb-scale', scale);
}
const mainZoomLabel = document.getElementById('mainZoomLabel');
const statusText = document.getElementById('statusText');

let activeSlideIndex = store.getActiveSlideIndex();
let saveTimer = null;
let thumbTimer = null;
let currentEditorScale = 1.0;

// --- History Stack ---
let historyStack = [];
let historyIndex = -1;
const maxHistory = 50;

function pushHistory(html) {
    if (historyIndex >= 0 && historyStack[historyIndex] === html) return;
    historyStack = historyStack.slice(0, historyIndex + 1);
    historyStack.push(html);
    if (historyStack.length > maxHistory) historyStack.shift();
    historyIndex = historyStack.length - 1;
    updateUndoRedoBtns();
}

function updateUndoRedoBtns() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    if (undoBtn) undoBtn.disabled = historyIndex <= 0;
    if (redoBtn) redoBtn.disabled = historyIndex >= historyStack.length - 1;
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        deck.innerHTML = historyStack[historyIndex];
        renumberSlides();
        setActiveSlide(activeSlideIndex);
        store.saveState(deck.innerHTML);
        updateUndoRedoBtns();
    }
}

function redo() {
    if (historyIndex < historyStack.length - 1) {
        historyIndex++;
        deck.innerHTML = historyStack[historyIndex];
        renumberSlides();
        setActiveSlide(activeSlideIndex);
        store.saveState(deck.innerHTML);
        updateUndoRedoBtns();
    }
}

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

    updateThumbScale();

    if (window.Sortable && !thumbDeck.sortableInst) {
        thumbDeck.sortableInst = Sortable.create(thumbDeck, {
            animation: 150,
            onEnd: function (evt) {
                if (evt.oldIndex === evt.newIndex) return;
                const slides = getSlideWraps();
                const movedSlide = slides[evt.oldIndex];
                if (evt.newIndex >= slides.length) {
                    deck.appendChild(movedSlide);
                } else if (evt.newIndex < evt.oldIndex) {
                    deck.insertBefore(movedSlide, slides[evt.newIndex]);
                } else {
                    deck.insertBefore(movedSlide, slides[evt.newIndex].nextSibling);
                }
                
                if (activeSlideIndex === evt.oldIndex) {
                    activeSlideIndex = evt.newIndex;
                } else if (activeSlideIndex > evt.oldIndex && activeSlideIndex <= evt.newIndex) {
                    activeSlideIndex--;
                } else if (activeSlideIndex < evt.oldIndex && activeSlideIndex >= evt.newIndex) {
                    activeSlideIndex++;
                }
                renumberSlides();
                setActiveSlide(activeSlideIndex);
                saveDeck();
            }
        });
    }
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
        pushHistory(deck.innerHTML);
        setStatus('已自动保存');
    }, 500);
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
    pushHistory(deck.innerHTML);
    
    renumberSlides();
    setActiveSlide(activeSlideIndex);
    updateThumbScale();
    
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

// --- Toolbar Events ---
document.getElementById('undoBtn')?.addEventListener('click', undo);
document.getElementById('redoBtn')?.addEventListener('click', redo);

document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) redo(); else undo();
        e.preventDefault();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        redo();
        e.preventDefault();
    }
});

document.getElementById('duplicateSlideBtn')?.addEventListener('click', () => {
    const wraps = getSlideWraps();
    if (!wraps[activeSlideIndex]) return;
    const clone = wraps[activeSlideIndex].cloneNode(true);
    clone.classList.remove('is-active');
    wraps[activeSlideIndex].after(clone);
    renumberSlides();
    setActiveSlide(activeSlideIndex + 1);
    saveDeck();
});

document.getElementById('deleteSlideBtn')?.addEventListener('click', () => {
    const wraps = getSlideWraps();
    if (wraps.length <= 1) return alert('最后一页无法删除');
    if (confirm('确定要删除当前页吗？')) {
        wraps[activeSlideIndex].remove();
        renumberSlides();
        setActiveSlide(Math.max(0, activeSlideIndex - 1));
        saveDeck();
    }
});

document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', e => {
        const theme = e.currentTarget.dataset.theme;
        document.documentElement.setAttribute('data-theme', theme);
    });
});

document.getElementById('presentBtn')?.addEventListener('click', () => {
    document.body.classList.add('presentation-mode');
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
    }
});

document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        document.body.classList.remove('presentation-mode');
    }
});

document.addEventListener('keydown', e => {
    if (document.body.classList.contains('presentation-mode')) {
        if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
            const wraps = getSlideWraps();
            if (activeSlideIndex < wraps.length - 1) setActiveSlide(activeSlideIndex + 1);
            e.preventDefault();
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
            if (activeSlideIndex > 0) setActiveSlide(activeSlideIndex - 1);
            e.preventDefault();
        } else if (e.key === 'Escape') {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    }
});

// --- Rich Text Toolbar ---
const rtToolbar = document.getElementById('richTextToolbar');
document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const editable = container.nodeType === 3 ? container.parentElement.closest('.editable') : container.closest('.editable');
    
    if (editable && selection.toString().trim().length > 0) {
        const rect = range.getBoundingClientRect();
        rtToolbar.classList.remove('hidden');
        rtToolbar.style.top = `${rect.top - 40}px`;
        rtToolbar.style.left = `${rect.left + (rect.width / 2) - (rtToolbar.offsetWidth / 2)}px`;
    } else {
        if (rtToolbar && !rtToolbar.contains(container)) {
            rtToolbar.classList.add('hidden');
        }
    }
});

rtToolbar?.querySelectorAll('.rt-btn').forEach(btn => {
    btn.addEventListener('mousedown', e => {
        e.preventDefault(); // Keep selection
        document.execCommand(btn.dataset.command, false, null);
        saveDeck();
    });
});
rtToolbar?.querySelector('.rt-color')?.addEventListener('input', e => {
    document.execCommand(e.target.dataset.command, false, e.target.value);
    saveDeck();
});

// --- Media Upload (Click & Drag) ---
deck.addEventListener('click', e => {
    const target = e.target.closest('.qr-box, .cover-photo, .avatar');
    if (!target) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = ev => {
        const file = ev.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            target.style.background = `url("${reader.result}") center / cover no-repeat`;
            target.innerHTML = '';
            saveDeck();
            scheduleThumbnails();
        };
        reader.readAsDataURL(file);
    };
    input.click();
});

deck.addEventListener('dragover', e => {
    e.preventDefault();
    const target = e.target.closest('.qr-box, .cover-photo, .avatar, .slide-pad');
    if (target) target.style.opacity = '0.8';
});
deck.addEventListener('dragleave', e => {
    e.preventDefault();
    const target = e.target.closest('.qr-box, .cover-photo, .avatar, .slide-pad');
    if (target) target.style.opacity = '1';
});
deck.addEventListener('drop', e => {
    e.preventDefault();
    const target = e.target.closest('.qr-box, .cover-photo, .avatar, .slide-pad');
    if (!target) return;
    target.style.opacity = '1';
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
        if (target.classList.contains('slide-pad')) {
            const img = document.createElement('img');
            img.src = reader.result;
            img.style.maxWidth = '180px';
            img.style.maxHeight = '120px';
            img.style.objectFit = 'contain';
            img.style.position = 'absolute';
            img.style.left = '210px';
            img.style.top = '130px';
            target.appendChild(img);
        } else {
            target.style.background = `url("${reader.result}") center / cover no-repeat`;
            target.innerHTML = '';
        }
        saveDeck();
        scheduleThumbnails();
    };
    reader.readAsDataURL(file);
});


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

const closeAiBtn = document.getElementById('closeAiBtn');
const aiChatWindow = document.getElementById('aiChatWindow');
const aiInput = document.getElementById('aiInput');
const aiSendBtn = document.getElementById('aiSendBtn');
const aiSettingsBtn = document.getElementById('aiSettingsBtn');
const aiSettingsPanel = document.getElementById('aiSettingsPanel');
const aiRulesInput = document.getElementById('aiRulesInput');
const saveAiRulesBtn = document.getElementById('saveAiRulesBtn');

let aiMessages = [];
let aiReplacingSlide = false;

document.querySelectorAll('.ai-shortcut-btn').forEach(btn => {
    btn.addEventListener('click', e => {
        const action = e.currentTarget.dataset.action;
        const activeWrap = deck.querySelector('.slide-wrap.is-active');
        if (!activeWrap) return;
        
        let promptText = '';
        let displayMsg = '';
        const baseRule = '【非常重要】请严格保持原有的所有HTML结构、类名(class)和非文本元素完全不变！必须返回完整的 <div class="slide-wrap">...</div> 代码，并用 ```html 包裹。';
        
        if (action === 'polish') { promptText = '请帮我润色当前幻灯片页面的文本内容，使其更专业流畅。' + baseRule; displayMsg = '✨ 请帮我润色当前页面'; }
        if (action === 'translate_en') { promptText = '请将当前幻灯片页面的所有中文内容翻译为专业的英文。' + baseRule; displayMsg = '🌐 请将当前页面翻译为英文'; }
        if (action === 'translate_zh') { promptText = '请将当前幻灯片页面的所有英文内容翻译为中文。' + baseRule; displayMsg = '🇨🇳 请将当前页面翻译为中文'; }
        
        const htmlContext = activeWrap.outerHTML;
        
        aiReplacingSlide = true;
        sendAiMessage(promptText + '\n\n```html\n' + htmlContext + '\n```', displayMsg);
    });
});

function toggleAi() {
    if (aiSidebar.style.marginRight === '0px' || !aiSidebar.style.marginRight) {
        aiSidebar.style.marginRight = '-' + aiSidebar.offsetWidth + 'px';
    } else {
        aiSidebar.style.marginRight = '0px';
    }
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
        div.classList.add('justify-end');
        div.innerHTML = `
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

async function sendAiMessage(hiddenContent = null, displayMsg = null) {
    const text = hiddenContent || aiInput.value.trim();
    if (!text && !hiddenContent) return;
    
    aiInput.value = '';
    
    appendAiMessage('user', displayMsg || (hiddenContent ? '...' : text));
    aiMessages.push({ role: 'user', content: text });
    
    const loadingId = 'ai-loading-' + Date.now();
    const loadDiv = document.createElement('div');
    loadDiv.id = loadingId;
    loadDiv.className = "flex items-start space-x-2 mt-4 opacity-50";
    loadDiv.innerHTML = `<div class="w-8 h-8 rounded bg-purple-600/20 text-purple-400 flex items-center justify-center shrink-0"><i class="ph-fill ph-robot animate-pulse"></i></div><div class="bg-zinc-800 text-zinc-200 rounded-lg rounded-tl-none p-3 text-xs">正在生成...</div>`;
    aiChatWindow.appendChild(loadDiv);
    aiChatWindow.scrollTop = aiChatWindow.scrollHeight;

    try {
        const deckSlides = deck.querySelectorAll('.slide-wrap');
        const customRules = localStorage.getItem('ppt_copilot_rules') || '';
        const rulesBlock = customRules ? `\n【用户专属 PPT 制作规范（必须严格遵守）】\n${customRules}\n\n` : '';
        const templates = `${rulesBlock}使用这些示例模板的类名和结构，如果用户请求修改现有幻灯片，请返回替换后的完整 HTML 代码。`;

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
        
        loadDiv.remove();
        if (!res.ok) throw new Error('请求失败');
        
        const data = await res.json();
        let reply = data.reply || '';
        aiMessages.push({ role: 'model', content: reply });
        
        let htmlContent = reply;
        let originalReply = reply;
        const htmlMatch = reply.match(/```html\n([\s\S]*?)```/i) || reply.match(/```\n([\s\S]*?)```/i);
        
        if (htmlMatch) {
            htmlContent = htmlMatch[1];
            reply = reply.replace(htmlMatch[0], '').trim();
        } else {
            const startIdx = reply.indexOf('<div class="slide-wrap');
            if (startIdx !== -1) {
                htmlContent = reply.substring(startIdx);
                reply = reply.substring(0, startIdx).trim();
            }
        }
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        const generatedWraps = tempDiv.querySelectorAll('.slide-wrap');
        
        if (generatedWraps.length > 0) {
            if (aiReplacingSlide) {
                const activeWrap = deck.querySelector('.slide-wrap.is-active');
                if (activeWrap) {
                    const activeIndex = getSlideWraps().indexOf(activeWrap);
                    generatedWraps[0].classList.add('is-active');
                    activeWrap.after(generatedWraps[0]);
                    activeWrap.classList.remove('is-active');
                    setActiveSlide(activeIndex + 1);
                }
                aiReplacingSlide = false;
                appendAiMessage('model', '✨ **新页面已生成！** 已在当前页后方插入。' + (reply ? '<br><br>' + escapeHtml(reply) : ''));
            } else {
                generatedWraps.forEach(wrap => {
                    wrap.classList.remove('is-active');
                    deck.appendChild(wrap);
                });
                appendAiMessage('model', '✨ **幻灯片已添加至末尾。**' + (reply ? '<br><br>' + escapeHtml(reply) : ''));
            }
            renumberSlides();
            saveDeck();
            scheduleThumbnails();
        } else {
            aiReplacingSlide = false;
            appendAiMessage('model', escapeHtml(originalReply));
        }
    } catch (error) {
        const el = document.getElementById(loadingId);
        if (el) el.remove();
        appendAiMessage('model', `⚠️ 发生错误: ${error.message}`);
        aiMessages.pop();
    }
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .toString()
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

if (aiSendBtn) aiSendBtn.addEventListener('click', sendAiMessage);
if (aiInput) aiInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendAiMessage();
    }
});

function initResizers() {
    let isResizingLeft = false;
    let isResizingRight = false;
    const leftResizer = document.getElementById('leftResizer');
    const rightResizer = document.getElementById('rightResizer');

    if (leftResizer) {
        leftResizer.addEventListener('mousedown', (e) => {
            isResizingLeft = true;
            document.body.style.cursor = 'col-resize';
            // Disable transition for smoother dragging
            sidebar.style.transition = 'none';
            e.preventDefault();
        });
    }

    if (rightResizer) {
        rightResizer.addEventListener('mousedown', (e) => {
            isResizingRight = true;
            document.body.style.cursor = 'col-resize';
            aiSidebar.style.transition = 'none';
            e.preventDefault();
        });
    }

    window.addEventListener('mousemove', (e) => {
        if (isResizingLeft) {
            const newWidth = Math.max(150, Math.min(e.clientX, 800));
            sidebar.style.width = newWidth + 'px';
            updateThumbScale();
        }
        if (isResizingRight) {
            const newWidth = Math.max(300, Math.min(window.innerWidth - e.clientX, 1200));
            aiSidebar.style.width = newWidth + 'px';
            if (aiSidebar.style.marginRight !== '0px' && aiSidebar.style.marginRight !== '') {
                aiSidebar.style.marginRight = '-' + newWidth + 'px';
            }
        }
    });

    window.addEventListener('mouseup', () => {
        if (isResizingLeft || isResizingRight) {
            isResizingLeft = false;
            isResizingRight = false;
            document.body.style.cursor = '';
            // Restore transitions
            sidebar.style.transition = '';
            aiSidebar.style.transition = '';
            updateThumbScale();
        }
    });
}

initResizers();

// Start app
bootstrap();
