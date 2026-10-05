/**
 * uivf12/workbench.js - 中间工作台区域
 * 负责：JSON 解析/格式化、响应样本多表识别、关键词数据聚焦、自动检测分类、脚本生成入口
 */

let parsedPayloadObj = null;
let parsedResponseObj = null;
let discoveredTables = [];
let selectedFocusTableIndex = -1;
let currentScriptTitle = '';
let currentScriptTitleInputName = '';

function getEl(id) {
    const doc = typeof document !== 'undefined' ? document : (typeof window !== 'undefined' ? window.document : null);
    return doc ? doc.getElementById(id) : null;
}

function safeT(key, params) {
    if (typeof UIVT === 'function') return UIVT(key, params);
    if (window.UIVI18n?.t) return window.UIVI18n.t(key, params);
    return key;
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ──────────────────────────────────────────────────────────
// JSON 格式化 & 高亮预览
// ──────────────────────────────────────────────────────────
function syntaxHighlight(jsonStr) {
    let json = jsonStr.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/(\"(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*\"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        let cls = 'json-number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'json-key';
                if (/"(pageId|pageName|componentId|id|column|values|table|boardId|cpc|network_name_base|task_status|region_cn_name)"/.test(match))
                    cls = 'json-key json-important';
            } else { cls = 'json-string'; }
        } else if (/true|false/.test(match)) { cls = 'json-boolean'; }
        else if (/null/.test(match)) { cls = 'json-null'; }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}

function formatAndAnalyzeJSON() {
    const editor = getEl('jsonInput');
    const rawText = editor ? editor.value.trim() : '';
    const errorDiv = getEl('errorMsg');
    const viewer = getEl('payloadViewer');
    if (errorDiv) errorDiv.innerText = '';
    if (rawText) {
        try {
            const obj = JSON.parse(rawText);
            parsedPayloadObj = obj;
            const prettyJson = JSON.stringify(obj, null, 4);
            if (editor) editor.style.display = 'none';
            if (viewer) {
                viewer.style.display = 'block';
                viewer.innerHTML = syntaxHighlight(prettyJson);
                viewer.onclick = () => {
                    viewer.style.display = 'none';
                    editor.style.display = 'block';
                    editor.value = prettyJson;
                };
            }
        } catch (e) {
            if (errorDiv) errorDiv.innerText = safeT('uiv.workbench.badJson');
        }
    }

    // 同时格式化响应样本（如果已粘贴）
    const responseRawText = getEl('responseSampleInput')?.value.trim();
    if (responseRawText) {
        formatAndAnalyzeResponseSample();
    }
}

// ──────────────────────────────────────────────────────────
// 响应样本解析与多表智能识别 (Multi-Table Discovery)
// ──────────────────────────────────────────────────────────
function discoverResponseTables(obj) {
    if (!obj || typeof obj !== 'object') return [];
    const tables = [];

    // 模式 A: DataFab 多组件标准结构
    // 典型特征：obj.data 为数组，且其子项包含 metadata 或 data 数组
    if (obj && Array.isArray(obj.data) && obj.data.length > 0 &&
        obj.data.some(c => c && typeof c === 'object' && (Array.isArray(c.data) || Array.isArray(c.metadata)))) {
        obj.data.forEach((comp, idx) => {
            if (!comp || typeof comp !== 'object') return;
            const rows = Array.isArray(comp.data) ? comp.data : [];
            const meta = Array.isArray(comp.metadata) ? comp.metadata : [];
            const colNames = meta.map(m => m.displayName || m.column || m.origColumn || '').filter(Boolean);
            if (colNames.length === 0 && rows.length > 0 && rows[0] && typeof rows[0] === 'object') {
                colNames.push(...Object.keys(rows[0]));
            }
            const firstCol = colNames[0] || '';
            const firstRowSample = rows[0] && typeof rows[0] === 'object' ? rows[0] : null;
            const sampleVal = firstRowSample && firstCol ? String(firstRowSample[firstCol] ?? '') : '';

            let title = '';
            if (firstCol) {
                title = sampleVal ? `${firstCol} (${sampleVal})` : firstCol;
            } else if (comp.id) {
                title = `组件 ${comp.id.substring(0, 8)}`;
            } else {
                title = `表格 #${idx + 1}`;
            }

            tables.push({
                index: idx,
                componentIndex: idx,
                componentId: comp.id || '',
                path: `data[${idx}].data`,
                title,
                rowCount: rows.length,
                columns: colNames,
                metadata: meta,
                firstRow: firstRowSample,
                preview: firstRowSample ? JSON.stringify(firstRowSample, null, 2) : ''
            });
        });
        if (tables.length > 0) return tables;
    }

    // 模式 B: 通用 JSON 深度搜索包含对象数组的数据块
    const visited = new Set();
    function scanArrays(current, currentPath, depth = 0) {
        if (!current || typeof current !== 'object' || depth > 7) return;
        if (visited.has(current)) return;
        visited.add(current);

        if (Array.isArray(current)) {
            if (current.length > 0 && typeof current[0] === 'object' && current[0] !== null) {
                const sampleRow = current[0];
                const cols = Object.keys(sampleRow);
                const firstVal = cols.length ? String(sampleRow[cols[0]] ?? '') : '';
                tables.push({
                    index: tables.length,
                    componentIndex: null,
                    componentId: '',
                    path: currentPath,
                    title: `${currentPath}${firstVal ? ` (${firstVal})` : ''}`,
                    rowCount: current.length,
                    columns: cols,
                    metadata: [],
                    firstRow: sampleRow,
                    preview: JSON.stringify(sampleRow, null, 2)
                });
            }
            current.slice(0, 10).forEach((item, idx) => scanArrays(item, `${currentPath}[${idx}]`, depth + 1));
            return;
        }

        for (const [key, val] of Object.entries(current)) {
            const nextPath = currentPath ? `${currentPath}.${key}` : key;
            scanArrays(val, nextPath, depth + 1);
        }
    }

    scanArrays(obj, '');
    return tables;
}

function matchTableByKeyword(keyword) {
    const kw = String(keyword || '').trim().toLowerCase();
    if (!kw || !discoveredTables.length) return [];
    const scored = discoveredTables.map(table => {
        let score = 0;
        const titleStr = String(table.title || '').toLowerCase();
        if (titleStr.includes(kw)) score += 100;

        const pathStr = String(table.path || '').toLowerCase();
        if (pathStr.includes(kw)) score += 20;

        if (table.columns && table.columns.length) {
            for (const col of table.columns) {
                const colStr = String(col).toLowerCase();
                if (colStr === kw) score += 90;
                else if (colStr.includes(kw)) score += 60;
            }
        }

        if (table.metadata && table.metadata.length) {
            for (const m of table.metadata) {
                const mStr = JSON.stringify(m).toLowerCase();
                if (mStr.includes(kw)) { score += 50; break; }
            }
        }

        if (table.firstRow) {
            const rStr = JSON.stringify(table.firstRow).toLowerCase();
            if (rStr.includes(kw)) score += 70;
        }

        return { table, score };
    });

    return scored
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.table);
}

function renderResponseFocusUI() {
    const bar = getEl('responseFocusBar');
    const summary = getEl('responseFocusSummary');
    const countSpan = getEl('responseFocusTableCount');
    const selectedInfo = getEl('responseFocusSelectedInfo');
    const pathInput = getEl('responseFocusPath');
    const kwInput = getEl('responseFocusKeyword');
    if (!bar) return;

    if (!discoveredTables.length) {
        bar.style.display = 'none';
        if (selectedInfo) selectedInfo.style.display = 'none';
        return;
    }

    bar.style.display = 'flex';
    if (countSpan) countSpan.textContent = String(discoveredTables.length);

    const kw = kwInput ? kwInput.value.trim() : '';
    let selectedTable = null;

    if (selectedFocusTableIndex >= 0 && discoveredTables[selectedFocusTableIndex]) {
        selectedTable = discoveredTables[selectedFocusTableIndex];
    }

    if (selectedTable) {
        if (pathInput) pathInput.value = selectedTable.path;
        if (selectedInfo) {
            selectedInfo.style.display = 'flex';
            selectedInfo.innerHTML = `<span>✅ ${safeT('uiv.focus.selectedInfo', {
                name: selectedTable.title,
                path: selectedTable.path,
                count: selectedTable.rowCount
            })}</span>`;
        }
        if (summary) {
            summary.textContent = kw
                ? safeT('uiv.focus.keywordMatched', { keyword: kw, name: selectedTable.title, path: selectedTable.path })
                : safeT('uiv.focus.selectedInfo', { name: selectedTable.title, path: selectedTable.path, count: selectedTable.rowCount });
        }
    } else {
        if (pathInput) pathInput.value = '';
        if (selectedInfo) selectedInfo.style.display = 'none';
        if (summary) {
            if (kw) {
                summary.textContent = safeT('uiv.focus.keywordNone', { keyword: kw });
            } else if (discoveredTables.length === 1) {
                summary.textContent = safeT('uiv.focus.singleTable', {
                    name: discoveredTables[0].title,
                    count: discoveredTables[0].rowCount
                });
            } else {
                summary.textContent = safeT('uiv.focus.multipleTables', { count: discoveredTables.length });
            }
        }
    }
}

function formatAndAnalyzeResponseSample() {
    const editor = getEl('responseSampleInput');
    const viewer = getEl('responseSampleViewer');
    const rawText = editor ? editor.value.trim() : '';

    if (!rawText) {
        parsedResponseObj = null;
        discoveredTables = [];
        selectedFocusTableIndex = -1;
        if (viewer) { viewer.style.display = 'none'; viewer.innerHTML = ''; }
        if (editor) editor.style.display = 'block';
        renderResponseFocusUI();
        return;
    }

    try {
        const obj = JSON.parse(rawText);
        parsedResponseObj = obj;
        discoveredTables = discoverResponseTables(obj);

        const prettyJson = JSON.stringify(obj, null, 4);
        if (viewer && editor) {
            viewer.innerHTML = syntaxHighlight(prettyJson);
            viewer.onclick = () => {
                viewer.style.display = 'none';
                editor.style.display = 'block';
                editor.value = prettyJson;
            };
        }

        const kw = getEl('responseFocusKeyword')?.value.trim();
        const savedPath = getEl('responseFocusPath')?.value.trim();

        if (savedPath) {
            const foundIdx = discoveredTables.findIndex(t => t.path === savedPath);
            if (foundIdx !== -1) {
                selectedFocusTableIndex = foundIdx;
            }
        }

        if (selectedFocusTableIndex === -1 && kw) {
            const matches = matchTableByKeyword(kw);
            if (matches.length > 0) {
                selectedFocusTableIndex = matches[0].index;
            }
        }

        if (selectedFocusTableIndex === -1 && discoveredTables.length > 0) {
            selectedFocusTableIndex = 0;
        }

        renderResponseFocusUI();
    } catch (e) {
        console.warn('Response sample JSON parsing failed:', e.message);
        parsedResponseObj = null;
        discoveredTables = [];
        selectedFocusTableIndex = -1;
        renderResponseFocusUI();
    }
}

function openFocusChoiceModal() {
    if (!discoveredTables.length) {
        formatAndAnalyzeResponseSample();
        if (!discoveredTables.length) return;
    }
    const overlay = getEl('uivResponseChoiceOverlay');
    const list = getEl('uivResponseChoiceList');
    if (!overlay || !list) return;

    list.innerHTML = discoveredTables.map((table, idx) => {
        const isSelected = idx === selectedFocusTableIndex;
        const colsPreview = table.columns && table.columns.length
            ? table.columns.slice(0, 8).join(', ') + (table.columns.length > 8 ? '...' : '')
            : '';
        return `
            <button type="button" class="uiv-ai-choice-item ${isSelected ? 'selected' : ''}" onclick="UIVWorkbench.selectFocusTable(${idx})">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <b>[表 ${idx + 1}] ${escapeHtml(table.title)}</b>
                    <span style="font-size:11px; color:#38bdf8; background:rgba(56,189,248,0.12); padding:2px 8px; border-radius:4px; font-weight:600;">
                        ${table.rowCount} 行
                    </span>
                </div>
                <div style="margin-top:6px; font-size:12px; color:#94a3b8;">
                    路径：<code>${escapeHtml(table.path)}</code>
                    ${table.componentId ? `<span style="margin-left:10px;">ID: <code>${escapeHtml(table.componentId.substring(0, 12))}...</code></span>` : ''}
                </div>
                ${colsPreview ? `<div style="margin-top:4px; font-size:11px; color:#cbd5e1;">字段 (${table.columns.length}): ${escapeHtml(colsPreview)}</div>` : ''}
                ${table.preview ? `<pre style="margin-top:6px; font-size:11px; max-height:80px; overflow:hidden;">${escapeHtml(table.preview)}</pre>` : ''}
            </button>
        `;
    }).join('');

    overlay.style.display = 'flex';
}

function closeFocusChoiceModal() {
    const overlay = getEl('uivResponseChoiceOverlay');
    if (overlay) overlay.style.display = 'none';
}

function selectFocusTable(index) {
    if (index >= 0 && index < discoveredTables.length) {
        selectedFocusTableIndex = index;
        const table = discoveredTables[index];
        const pathInput = getEl('responseFocusPath');
        if (pathInput) pathInput.value = table.path;
    }
    closeFocusChoiceModal();
    renderResponseFocusUI();
}

function clearResponseFocus() {
    selectedFocusTableIndex = -1;
    const kwInput = getEl('responseFocusKeyword');
    if (kwInput) kwInput.value = '';
    const pathInput = getEl('responseFocusPath');
    if (pathInput) pathInput.value = '';
    renderResponseFocusUI();
}

function onResponseKeywordInput() {
    const kwInput = getEl('responseFocusKeyword');
    const kw = kwInput ? kwInput.value.trim() : '';
    if (!kw) {
        if (discoveredTables.length > 0) {
            selectedFocusTableIndex = 0;
            const pathInput = getEl('responseFocusPath');
            if (pathInput) pathInput.value = discoveredTables[0].path;
        }
        renderResponseFocusUI();
        return;
    }
    const matches = matchTableByKeyword(kw);
    if (matches.length > 0) {
        selectedFocusTableIndex = matches[0].index;
        const pathInput = getEl('responseFocusPath');
        if (pathInput) pathInput.value = matches[0].path;
    } else {
        selectedFocusTableIndex = -1;
        const pathInput = getEl('responseFocusPath');
        if (pathInput) pathInput.value = '';
    }
    renderResponseFocusUI();
}

function getResponseFocusConfig() {
    const rawResponse = getEl('responseSampleInput')?.value.trim();
    const keyword = getEl('responseFocusKeyword')?.value.trim() || '';
    const focusPath = getEl('responseFocusPath')?.value.trim() || '';
    if (!rawResponse && !keyword && !focusPath) return null;
    let selectedTable = null;
    if (selectedFocusTableIndex >= 0 && discoveredTables[selectedFocusTableIndex]) {
        selectedTable = discoveredTables[selectedFocusTableIndex];
    }
    return {
        keyword: keyword || null,
        path: focusPath || (selectedTable ? selectedTable.path : null),
        componentIndex: selectedTable ? selectedTable.componentIndex : null,
        componentId: selectedTable ? selectedTable.componentId : null,
        title: selectedTable ? selectedTable.title : null
    };
}

// ──────────────────────────────────────────────────────────
// 清空工作台
// ──────────────────────────────────────────────────────────
function clearAll() {
    window.UIVAINaming?.reset?.();
    window.__uivAiAdapterCurrent = null;
    const jsonInput = getEl('jsonInput');
    if (jsonInput) { jsonInput.value = ''; jsonInput.style.display = 'block'; }
    const payloadViewer = getEl('payloadViewer');
    if (payloadViewer) { payloadViewer.style.display = 'none'; payloadViewer.innerHTML = ''; }

    const respEditor = getEl('responseSampleInput');
    if (respEditor) { respEditor.value = ''; respEditor.style.display = 'block'; }
    const respViewer = getEl('responseSampleViewer');
    if (respViewer) { respViewer.style.display = 'none'; respViewer.innerHTML = ''; }
    clearResponseFocus();
    parsedResponseObj = null;
    discoveredTables = [];

    const codeOut = getEl('codeOutput');
    if (codeOut) codeOut.value = '';
    const consoleOut = getEl('consoleOutput');
    if (consoleOut) consoleOut.value = '';
    const fileNameEl = getEl('fileName');
    if (fileNameEl) fileNameEl.value = '';
    const errorDiv = getEl('errorMsg');
    if (errorDiv) errorDiv.innerText = '';
    parsedPayloadObj = null;
    currentScriptTitle = '';
    currentScriptTitleInputName = '';
}

// ──────────────────────────────────────────────────────────
// 回填脚本数据到工作台
// ──────────────────────────────────────────────────────────
function fillWorkbench(script) {
    window.__uivAiAdapterCurrent = script.generatorType === 'ai-adapter'
        ? {
            generatorType: script.generatorType,
            adapterConfig: script.adapterConfig || null,
            generationPlan: script.generationPlan || null,
            openUrl: script.openUrl || '',
            loginProbeConfig: script.loginProbeConfig || null
        }
        : null;
    const codeOut = getEl('codeOutput');
    if (codeOut) codeOut.value = script.code || '';
    const consoleOut = getEl('consoleOutput');
    if (consoleOut) consoleOut.value = script.consoleCode || '';
    if (script.url) {
        const reqUrl = getEl('requestUrl');
        if (reqUrl) reqUrl.value = script.url;
        window.UIVUrlAssist?.syncPreset(script.url);
    }
    const fileNameEl = getEl('fileName');
    if (fileNameEl) {
        if (script.originalFileName) fileNameEl.value = script.originalFileName;
        else fileNameEl.value = script.name.replace(/(_CN|_AE|_DE)$/, '');
    }
    currentScriptTitle = script.name ? script.name.replace(/(_CN|_AE|_DE)$/, '') : '';
    currentScriptTitleInputName = fileNameEl ? fileNameEl.value.trim() : '';

    if (script.payload) {
        const editor = getEl('jsonInput');
        if (editor) {
            editor.value = script.payload;
            editor.style.display = 'block';
        }
        const pViewer = getEl('payloadViewer');
        if (pViewer) pViewer.style.display = 'none';
        formatAndAnalyzeJSON();
    }

    const opts = script.configOptions || {};
    const ids = ['useGlobalVars', 'isPagination', 'forceSumData', 'autoFetchCPC', 'autoRuntimeMonth', 'autoNetCareTriplicate'];
    ids.forEach(id => {
        const el = getEl(id);
        if (el && opts[id] !== undefined) el.checked = opts[id];
    });

    const responseSample = script.responseSample || opts.responseSample || '';
    const responseKeyword = script.responseFocusKeyword || opts.responseFocusKeyword || '';
    const responsePath = script.responseFocusPath || opts.responseFocusPath || '';
    const respEditor = getEl('responseSampleInput');
    const respViewer = getEl('responseSampleViewer');
    const kwEl = getEl('responseFocusKeyword');
    const pathEl = getEl('responseFocusPath');

    if (respEditor) {
        respEditor.value = responseSample;
        respEditor.style.display = 'block';
    }
    if (respViewer) respViewer.style.display = 'none';
    if (kwEl) kwEl.value = responseKeyword;
    if (pathEl) pathEl.value = responsePath;

    if (responseSample) {
        formatAndAnalyzeResponseSample();
    } else {
        clearResponseFocus();
    }
}

// ──────────────────────────────────────────────────────────
// 辅助函数
// ──────────────────────────────────────────────────────────
function findKeyDeep(obj, key) {
    if (typeof obj !== 'object' || obj === null) return null;
    if (obj[key] !== undefined && typeof obj[key] === 'string') return obj[key];
    for (let k in obj) { const res = findKeyDeep(obj[k], key); if (res) return res; }
    return null;
}

function autoDetectCategory(text) {
    if (!text) return '默认分类';
    const lowerText = text.toLowerCase();
    if (lowerText.includes('datafab')) return 'DataFab';
    if (lowerText.includes('netcare.huawei.com') || lowerText.includes('netcare-cn') || lowerText.includes('.cn/')) return 'NetCare中国';
    if (lowerText.includes('netcare-ae') || lowerText.includes('.ae/')) return 'NetCare中东';
    if (lowerText.includes('netcare-de') || lowerText.includes('.de/')) return 'NetCare德国';
    return '默认分类';
}

// 绑定输入框监听
if (typeof document !== 'undefined') {
    const bindWorkbenchListeners = () => {
        const respInput = getEl('responseSampleInput');
        if (respInput && !respInput.__boundFocus && typeof respInput.addEventListener === 'function') {
            respInput.__boundFocus = true;
            let respTimer = null;
            respInput.addEventListener('input', () => {
                clearTimeout(respTimer);
                respTimer = setTimeout(() => formatAndAnalyzeResponseSample(), 300);
            });
        }
        const kwInput = getEl('responseFocusKeyword');
        if (kwInput && !kwInput.__boundFocus && typeof kwInput.addEventListener === 'function') {
            kwInput.__boundFocus = true;
            let kwTimer = null;
            kwInput.addEventListener('input', () => {
                clearTimeout(kwTimer);
                kwTimer = setTimeout(() => onResponseKeywordInput(), 200);
            });
        }
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindWorkbenchListeners);
    } else {
        bindWorkbenchListeners();
    }
}

// 暴露全局命名空间
window.UIVWorkbench = {
    formatAndAnalyzeJSON,
    formatAndAnalyzeResponseSample,
    clearAll,
    fillWorkbench,
    autoDetectCategory,
    findKeyDeep,
    discoverResponseTables,
    matchTableByKeyword,
    openFocusChoiceModal,
    closeFocusChoiceModal,
    selectFocusTable,
    clearResponseFocus,
    onResponseKeywordInput,
    getResponseFocusConfig,
    getParsedPayload: () => parsedPayloadObj,
    getParsedResponse: () => parsedResponseObj,
    getDiscoveredTables: () => discoveredTables,
    getCurrentTitle: () => currentScriptTitle,
    getCurrentTitleInputName: () => currentScriptTitleInputName,
    setCurrentTitle: (t, inputName) => {
        currentScriptTitle = t;
        currentScriptTitleInputName = inputName !== undefined
            ? String(inputName || '').trim()
            : (getEl('fileName')?.value.trim() || '');
    },
    setParsedPayload: p => { parsedPayloadObj = p; },
    setParsedResponse: r => { parsedResponseObj = r; }
};
