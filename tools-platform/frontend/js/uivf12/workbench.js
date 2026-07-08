/**
 * uivf12/workbench.js - 中间工作台区域
 * 负责：JSON 解析/格式化、自动检测分类、脚本生成入口
 */

let parsedPayloadObj = null;
let currentScriptTitle = '';
let currentScriptTitleInputName = '';

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
    const rawText = document.getElementById('jsonInput').value.trim();
    const errorDiv = document.getElementById('errorMsg');
    const viewer = document.getElementById('payloadViewer');
    const editor = document.getElementById('jsonInput');
    errorDiv.innerText = '';
    if (!rawText) return;
    try {
        const obj = JSON.parse(rawText);
        parsedPayloadObj = obj;
        const prettyJson = JSON.stringify(obj, null, 4);
        editor.style.display = 'none';
        viewer.style.display = 'block';
        viewer.innerHTML = syntaxHighlight(prettyJson);
        viewer.onclick = () => {
            viewer.style.display = 'none';
            editor.style.display = 'block';
            editor.value = prettyJson;
        };
    } catch (e) {
        errorDiv.innerText = UIVT('uiv.workbench.badJson');
    }
}

function clearAll() {
    window.__uivAiAdapterCurrent = null;
    document.getElementById('jsonInput').value = '';
    document.getElementById('jsonInput').style.display = 'block';
    document.getElementById('payloadViewer').style.display = 'none';
    document.getElementById('payloadViewer').innerHTML = '';
    document.getElementById('codeOutput').value = '';
    document.getElementById('consoleOutput').value = '';
    document.getElementById('errorMsg').innerText = '';
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
            openUrl: script.openUrl || '',
            loginProbeConfig: script.loginProbeConfig || null
        }
        : null;
    document.getElementById('codeOutput').value = script.code || '';
    document.getElementById('consoleOutput').value = script.consoleCode || '';
    if (script.url) {
        document.getElementById('requestUrl').value = script.url;
        const preset = document.getElementById('urlPreset');
        const matched = Array.from(preset.options).find(opt => opt.value === script.url);
        preset.value = matched ? script.url : '';
    }
    if (script.originalFileName) document.getElementById('fileName').value = script.originalFileName;
    else document.getElementById('fileName').value = script.name.replace(/(_CN|_AE|_DE)$/, '');
    currentScriptTitle = script.name ? script.name.replace(/(_CN|_AE|_DE)$/, '') : '';
    currentScriptTitleInputName = document.getElementById('fileName').value.trim();

    if (script.payload) {
        const editor = document.getElementById('jsonInput');
        editor.value = script.payload;
        editor.style.display = 'block';
        document.getElementById('payloadViewer').style.display = 'none';
        formatAndAnalyzeJSON();
    }
    if (script.configOptions) {
        const opts = script.configOptions;
        const ids = ['useGlobalVars', 'isPagination', 'forceSumData', 'autoFetchCPC', 'autoRuntimeMonth', 'autoNetCareTriplicate'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el && opts[id] !== undefined) el.checked = opts[id];
        });
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

// 暴露
window.UIVWorkbench = {
    formatAndAnalyzeJSON, clearAll, fillWorkbench, autoDetectCategory,
    findKeyDeep,
    getParsedPayload: () => parsedPayloadObj,
    getCurrentTitle: () => currentScriptTitle,
    getCurrentTitleInputName: () => currentScriptTitleInputName,
    setCurrentTitle: (t, inputName) => {
        currentScriptTitle = t;
        currentScriptTitleInputName = inputName !== undefined
            ? String(inputName || '').trim()
            : document.getElementById('fileName').value.trim();
    },
    setParsedPayload: p => { parsedPayloadObj = p; }
};
