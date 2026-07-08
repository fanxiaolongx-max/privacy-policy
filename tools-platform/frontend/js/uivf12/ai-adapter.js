/**
 * uivf12/ai-adapter.js
 * 独立的 AI 网站适配器入口。不会调用或改写现有 generateScript()。
 */
(function () {
    let latestAnalysis = null;
    let analyzeLogs = [];
    let keywordMatches = [];
    let keywordTimer = null;

    function el(id) {
        return document.getElementById(id);
    }

    function open() {
        el('uivAiAdapterOverlay').style.display = 'flex';
        el('uivAiAdapterStatus').textContent = '';
        resetAnalyzeLog('等待开始分析。');
        if (!el('uivAiUrl').value) el('uivAiUrl').value = el('requestUrl').value || '';
        if (!el('uivAiOpenUrl').value && window.__uivAiAdapterCurrent && window.__uivAiAdapterCurrent.openUrl) {
            el('uivAiOpenUrl').value = window.__uivAiAdapterCurrent.openUrl;
        }
        if (!el('uivAiBody').value) el('uivAiBody').value = el('jsonInput').value || '{}';
    }

    function close() {
        el('uivAiAdapterOverlay').style.display = 'none';
        closeKeywordChoice();
    }

    async function parseFetch() {
        try {
            const source = el('uivAiFetchSource').value.trim();
            if (!source) throw new Error('请先粘贴 Copy as fetch 内容');
            setStatus('正在安全解析 fetch 请求…', 'busy');
            el('uivAiParseFetchBtn').disabled = true;
            const result = await API.post('/api/uiv-ai-adapter/parse-fetch', { source });
            const parsed = result.parsed || {};
            el('uivAiUrl').value = parsed.url || '';
            el('uivAiMethod').value = parsed.method || 'POST';
            el('uivAiHeaders').value = JSON.stringify(parsed.headers || {}, null, 4);
            el('uivAiBody').value = JSON.stringify(parsed.requestBody || {}, null, 4);
            el('uivAiCredentials').value = parsed.credentials || 'include';
            const sensitive = result.sensitiveHeaderNames || [];
            el('uivAiFetchSummary').innerHTML = `
                <b>已解析：</b>${escapeHtml(parsed.method)} · ${escapeHtml(parsed.url)}
                · ${Object.keys(parsed.headers || {}).length} 个请求头
                ${sensitive.length ? `<br><span class="warn">发现敏感请求头：${sensitive.map(escapeHtml).join('、')}，发送给 AI 前会脱敏。</span>` : ''}`;
            setStatus('fetch 已解析。粘贴响应后即可让 AI 分析。', 'ok');
        } catch (error) {
            setStatus(error.message || 'Copy as fetch 解析失败', 'error');
        } finally {
            el('uivAiParseFetchBtn').disabled = false;
        }
    }

    function parseJson(id, label, fallback) {
        const raw = el(id).value.trim();
        if (!raw && fallback !== undefined) return fallback;
        try {
            return JSON.parse(raw);
        } catch (error) {
            throw new Error(formatJsonParseError(label, raw, error));
        }
    }

    function formatJsonParseError(label, raw, error) {
        const message = error && error.message ? error.message : 'JSON 解析失败';
        const positionMatch = message.match(/position\s+(\d+)/i);
        const position = positionMatch ? Number(positionMatch[1]) : -1;
        let location = '';
        let snippet = '';
        if (Number.isFinite(position) && position >= 0) {
            const before = raw.slice(0, position);
            const line = before.split('\n').length;
            const column = before.length - before.lastIndexOf('\n');
            location = `，大约在第 ${line} 行第 ${column} 列`;
            const start = Math.max(0, position - 70);
            const end = Math.min(raw.length, position + 90);
            snippet = `\n附近内容：${raw.slice(start, end).replace(/\s+/g, ' ').trim()}`;
        }
        return `${label}不是合法 JSON${location}。${message}${snippet}`;
    }

    function normalizeOptionalUrl(raw, label) {
        const value = String(raw || '').trim();
        if (!value) return '';
        try {
            const parsed = new URL(value);
            if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('protocol');
            return parsed.toString();
        } catch (error) {
            throw new Error(`${label}不是合法 HTTP/HTTPS URL`);
        }
    }

    function requestInput() {
        const method = el('uivAiMethod').value;
        const keyword = el('uivAiResponseKeyword').value.trim();
        if (keyword) ensureKeywordFocus();
        return {
            url: el('uivAiUrl').value.trim(),
            openUrl: normalizeOptionalUrl(el('uivAiOpenUrl').value, '抓取前打开页面 URL'),
            method,
            credentials: el('uivAiCredentials').value,
            headers: parseJson('uivAiHeaders', '请求头', {}),
            requestBody: method === 'GET' ? parseJson('uivAiBody', '请求负载', {}) : parseJson('uivAiBody', '请求负载'),
            responseSample: parseJson('uivAiResponse', '响应样本'),
            secondResponseSample: parseJson('uivAiSecondResponse', '第二页响应样本', null),
            responseFocusKeyword: keyword,
            responseFocusPath: el('uivAiResponseFocusPath').value.trim(),
            authHint: {
                strategy: el('uivAiAuthStrategy').value,
                sourceKey: el('uivAiAuthSourceKey').value.trim(),
                header: el('uivAiAuthHeader').value.trim(),
                prefix: el('uivAiAuthPrefix').value
            }
        };
    }

    function setStatus(message, type) {
        const node = el('uivAiAdapterStatus');
        node.textContent = message || '';
        node.className = `uiv-ai-status ${type || ''}`;
    }

    function resetAnalyzeLog(message) {
        analyzeLogs = [];
        renderAnalyzeLog();
        if (message) addAnalyzeLog(message, 'info');
    }

    function addAnalyzeLog(message, type) {
        const last = analyzeLogs[analyzeLogs.length - 1];
        if (last && last.message === message && last.type === (type || 'info')) return;
        analyzeLogs.push({
            message,
            type: type || 'info',
            time: new Date().toLocaleTimeString('zh-CN', { hour12: false })
        });
        if (analyzeLogs.length > 12) analyzeLogs = analyzeLogs.slice(-12);
        renderAnalyzeLog();
    }

    function renderAnalyzeLog() {
        const node = el('uivAiAdapterLog');
        if (!node) return;
        node.innerHTML = analyzeLogs.map(item => (
            `<div class="${escapeHtml(item.type)}"><span>${escapeHtml(item.time)}</span>${escapeHtml(item.message)}</div>`
        )).join('');
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[char]));
    }

    function pathToString(path) {
        return (path || []).map(item => String(item)).join('.');
    }

    function getAtPath(value, path) {
        if (!path) return value;
        return String(path).replace(/^\$\.?/, '').replace(/\[(\d+)\]/g, '.$1')
            .split('.')
            .filter(Boolean)
            .reduce((current, key) => current == null ? undefined : current[key], value);
    }

    function valuePreview(value) {
        try {
            return JSON.stringify(value, null, 2).slice(0, 800);
        } catch (error) {
            return String(value).slice(0, 800);
        }
    }

    function nearestArrayAncestor(ancestors) {
        for (let index = ancestors.length - 1; index >= 0; index--) {
            if (ancestors[index].type === 'array') return ancestors[index].path;
        }
        return null;
    }

    function addKeywordMatch(matches, match) {
        const key = `${match.focusPath}::${match.matchPath}`;
        if (matches.some(item => `${item.focusPath}::${item.matchPath}` === key)) return;
        matches.push(match);
    }

    function findKeywordMatches(value, keyword) {
        const needle = String(keyword || '').trim().toLowerCase();
        if (!needle) return [];
        const matches = [];
        const maxMatches = 80;
        function visit(current, path, ancestors) {
            if (matches.length >= maxMatches) return;
            if (Array.isArray(current)) {
                current.slice(0, 500).forEach((child, index) => {
                    visit(child, path.concat(index), ancestors.concat([{ path, type: 'array' }]));
                });
                return;
            }
            if (current && typeof current === 'object') {
                Object.entries(current).slice(0, 1000).forEach(([key, child]) => {
                    if (matches.length >= maxMatches) return;
                    const childPath = path.concat(key);
                    const keyHit = key.toLowerCase().includes(needle);
                    if (keyHit) {
                        const childIsGroup = child && typeof child === 'object';
                        const focusPath = childIsGroup ? childPath : (nearestArrayAncestor(ancestors) || path);
                        addKeywordMatch(matches, {
                            matchType: '字段名',
                            matchText: key,
                            matchPath: pathToString(childPath),
                            focusPath: pathToString(focusPath),
                            preview: valuePreview(getAtPath(value, pathToString(focusPath)))
                        });
                    }
                    visit(child, childPath, ancestors.concat([{ path, type: 'object' }]));
                });
                return;
            }
            const text = String(current ?? '');
            if (text && text.toLowerCase().includes(needle)) {
                const arrayPath = nearestArrayAncestor(ancestors);
                const focusPath = arrayPath || path.slice(0, -1);
                addKeywordMatch(matches, {
                    matchType: '字段值',
                    matchText: text.slice(0, 120),
                    matchPath: pathToString(path),
                    focusPath: pathToString(focusPath),
                    preview: valuePreview(getAtPath(value, pathToString(focusPath)))
                });
            }
        }
        visit(value, [], []);
        return matches;
    }

    function setKeywordSummary(message, type) {
        const node = el('uivAiKeywordSummary');
        node.textContent = message || '';
        node.className = `uiv-ai-keyword-summary ${type || ''}`;
    }

    function clearKeywordFocus() {
        keywordMatches = [];
        el('uivAiResponseFocusPath').value = '';
    }

    function evaluateKeywordFocus(options = {}) {
        const keyword = el('uivAiResponseKeyword').value.trim();
        clearKeywordFocus();
        closeKeywordChoice();
        if (!keyword) {
            setKeywordSummary('不填写关键词时，AI 会分析完整响应样本。', '');
            return;
        }
        let responseJson;
        try {
            responseJson = parseJson('uivAiResponse', '响应样本');
        } catch (error) {
            setKeywordSummary('请先粘贴合法响应 JSON，才能查找关键词。', 'error');
            return;
        }
        keywordMatches = findKeywordMatches(responseJson, keyword);
        if (!keywordMatches.length) {
            setKeywordSummary(`响应样本中未找到关键词“${keyword}”。`, 'error');
            return;
        }
        if (keywordMatches.length === 1) {
            selectKeywordMatch(0, { silent: true });
            return;
        }
        setKeywordSummary(`找到 ${keywordMatches.length} 处关键词“${keyword}”，请选择要抓取的数据片段。`, 'warn');
        if (options.showChoice !== false) showKeywordChoice();
    }

    function ensureKeywordFocus() {
        const keyword = el('uivAiResponseKeyword').value.trim();
        if (!keyword) return;
        if (el('uivAiResponseFocusPath').value.trim()) return;
        evaluateKeywordFocus({ showChoice: true });
        if (!el('uivAiResponseFocusPath').value.trim()) {
            throw new Error('请先选择关键词所在的数据片段，再进行 AI 分析。');
        }
    }

    function selectKeywordMatch(index, options = {}) {
        const match = keywordMatches[index];
        if (!match) return;
        el('uivAiResponseFocusPath').value = match.focusPath;
        setKeywordSummary(`已聚焦：${match.focusPath || '(根节点)'}；命中位置：${match.matchPath || '(根节点)'}`, 'ok');
        if (!options.silent) closeKeywordChoice();
    }

    function showKeywordChoice() {
        const list = el('uivAiKeywordChoiceList');
        list.innerHTML = keywordMatches.map((match, index) => `
            <button class="uiv-ai-choice-item" onclick="UIVAIAdapter.selectKeywordMatch(${index})">
                <div><b>${escapeHtml(match.matchType)}</b>：${escapeHtml(match.matchText)}</div>
                <div>命中位置：<code>${escapeHtml(match.matchPath || '(根节点)')}</code></div>
                <div>聚焦片段：<code>${escapeHtml(match.focusPath || '(根节点)')}</code></div>
                <pre>${escapeHtml(match.preview)}</pre>
            </button>
        `).join('');
        el('uivAiKeywordChoiceOverlay').style.display = 'flex';
    }

    function closeKeywordChoice() {
        const node = el('uivAiKeywordChoiceOverlay');
        if (node) node.style.display = 'none';
    }

    function scheduleKeywordEvaluation() {
        clearTimeout(keywordTimer);
        keywordTimer = setTimeout(() => evaluateKeywordFocus({ showChoice: true }), 350);
    }

    async function analyze() {
        try {
            resetAnalyzeLog();
            addAnalyzeLog('开始本地校验输入 JSON。');
            setStatus('正在校验输入 JSON…', 'busy');
            el('uivAiAnalyzeBtn').disabled = true;
            const input = requestInput();
            addAnalyzeLog('本地校验通过，准备发送到后端分析。', 'ok');
            setStatus('已发送到后端，正在抽样、脱敏并调用 AI…', 'busy');
            const result = await API.post('/api/uiv-ai-adapter/analyze', input);
            (result.logs || []).forEach(item => addAnalyzeLog(item.message || String(item), item.type || 'info'));
            addAnalyzeLog('后端分析完成，正在渲染结果。', 'ok');
            latestAnalysis = { input, ...result };
            const validation = result.validation || {};
            const adapter = result.adapter || {};
            const sensitive = result.sanitized && result.sanitized.sensitiveHeaderNames || [];
            const focus = result.responseFocus || null;
            const sampled = (result.sampleInfo || [])
                .filter(item => item && item.truncated)
                .map(item => `${escapeHtml(item.label)} ${item.originalChars} → ${item.sampledChars} 字符`);
            el('uivAiAdapterPreview').innerHTML = `
                <div><b>请求：</b>${escapeHtml(adapter.request.method)} · ${escapeHtml(adapter.request.bodyType)}</div>
                ${input.openUrl ? `<div><b>抓取前打开：</b>${escapeHtml(input.openUrl)}</div>` : ''}
                <div><b>认证：</b>${escapeHtml(adapter.auth.strategy)}${adapter.auth.sourceKey ? ` / ${escapeHtml(adapter.auth.sourceKey)}` : ''}</div>
                <div><b>分页：</b>${escapeHtml(adapter.pagination.type)}${adapter.pagination.requestPath ? ` / ${escapeHtml(adapter.pagination.requestPath)}` : ''}</div>
                <div><b>数据路径：</b>${escapeHtml(adapter.response.rowsPath || '(根数组)')}</div>
                <div><b>样本验证：</b>${validation.rowCount || 0} 行，${(validation.fields || []).length} 个字段</div>
                ${focus ? `<div class="note"><b>关键词聚焦：</b>${escapeHtml(focus.keyword || '')} / ${escapeHtml(focus.path || '(根节点)')}</div>` : ''}
                ${sampled.length ? `<div class="note"><b>已自动抽样：</b>${sampled.join('；')}</div>` : ''}
                ${sensitive.length ? `<div class="warn"><b>敏感请求头已脱敏：</b>${sensitive.map(escapeHtml).join('、')}</div>` : ''}
                ${(adapter.notes || []).map(note => `<div class="note">• ${escapeHtml(note)}</div>`).join('')}
                <details><summary>预览前 5 行</summary><pre>${escapeHtml(JSON.stringify(validation.previewRows || [], null, 2))}</pre></details>`;
            el('uivAiGenerateBtn').disabled = false;
            setStatus('分析与样本验证通过，可以生成脚本。', 'ok');
        } catch (error) {
            latestAnalysis = null;
            el('uivAiGenerateBtn').disabled = true;
            if (error.body && Array.isArray(error.body.logs)) {
                error.body.logs.forEach(item => addAnalyzeLog(item.message || String(item), item.type || 'info'));
            }
            if (error.body && error.body.stage) addAnalyzeLog(`后端阶段失败：${error.body.stage}`, 'error');
            addAnalyzeLog(error.message || 'AI 分析失败', 'error');
            setStatus(error.message || 'AI 分析失败', 'error');
        } finally {
            el('uivAiAnalyzeBtn').disabled = false;
        }
    }

    function js(value) {
        return JSON.stringify(value);
    }

    function buildRuntimeCore(state) {
        const { input, adapter } = state;
        const fileName = (el('uivAiFileName').value.trim() || 'AI_适配抓取_Latest').replace(/\.csv$/i, '') + '.csv';
        const safeHeaders = {};
        const sensitiveNames = new Set((state.sanitized && state.sanitized.sensitiveHeaderNames || []).map(name => name.toLowerCase()));
        const forbiddenNames = new Set(['host', 'content-length', 'origin', 'referer', 'connection', 'accept-encoding', 'user-agent']);
        Object.entries(input.headers || {}).forEach(([key, value]) => {
            if (!sensitiveNames.has(key.toLowerCase()) && !forbiddenNames.has(key.toLowerCase())) safeHeaders[key] = value;
        });

        return `
        const requestUrl = ${js(input.url)};
        const adapter = ${js(adapter)};
        const basePayload = ${js(input.requestBody || {})};
        const fetchHeaders = ${js(safeHeaders)};
        const maxPages = 200;

        function normalizePath(path) {
            return String(path || "").replace(/^\\$\\.?/, "").replace(/\\[(\\d+)\\]/g, ".$1");
        }
        function getAtPath(value, path) {
            if (!path) return value;
            return normalizePath(path).split(".").filter(Boolean).reduce((current, key) => current == null ? undefined : current[key], value);
        }
        function setAtPath(value, path, nextValue) {
            const keys = normalizePath(path).split(".").filter(Boolean);
            if (!keys.length) return;
            let current = value;
            keys.slice(0, -1).forEach(key => {
                if (!current[key] || typeof current[key] !== "object") current[key] = {};
                current = current[key];
            });
            current[keys[keys.length - 1]] = nextValue;
        }
        function normalizeCell(value) {
            if (value === null || value === undefined) return "";
            return typeof value === "object" ? JSON.stringify(value) : value;
        }

        if (adapter.auth.strategy === "localStorage" || adapter.auth.strategy === "sessionStorage") {
            const storage = adapter.auth.strategy === "localStorage" ? localStorage : sessionStorage;
            const token = storage.getItem(adapter.auth.sourceKey) || "";
            if (!token) throw new Error("未在 " + adapter.auth.strategy + " 找到认证字段：" + adapter.auth.sourceKey);
            fetchHeaders[adapter.auth.header] = adapter.auth.prefix + token;
        }

        const allRows = [];
        let cursor = Number(adapter.pagination.start || 1);
        for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
            const payload = JSON.parse(JSON.stringify(basePayload));
            let pageUrl = requestUrl;
            if (adapter.pagination.type !== "none") {
                if (adapter.request.method === "GET") {
                    const parsed = new URL(pageUrl, location.href);
                    parsed.searchParams.set(adapter.pagination.requestPath, String(cursor));
                    pageUrl = parsed.toString();
                } else {
                    setAtPath(payload, adapter.pagination.requestPath, cursor);
                }
            }
            const options = {
                method: adapter.request.method,
                headers: fetchHeaders,
                credentials: adapter.request.credentials
            };
            if (adapter.request.method !== "GET" && adapter.request.bodyType === "json") {
                options.body = JSON.stringify(payload);
            }
            const response = await fetch(pageUrl, options);
            if (!response.ok) throw new Error("HTTP " + response.status + " " + response.statusText);
            const data = await response.json();
            const rows = getAtPath(data, adapter.response.rowsPath);
            if (!Array.isArray(rows)) throw new Error("响应路径未提取到数组：" + (adapter.response.rowsPath || "(根节点)"));
            if (!rows.length) break;
            allRows.push(...rows);

            if (adapter.pagination.type === "none") break;
            const total = adapter.response.totalPath ? Number(getAtPath(data, adapter.response.totalPath)) : NaN;
            if (Number.isFinite(total) && allRows.length >= total) break;
            const configuredPageSize = adapter.pagination.pageSizePath
                ? Number(getAtPath(payload, adapter.pagination.pageSizePath))
                : NaN;
            if (Number.isFinite(configuredPageSize) && configuredPageSize > 0 && rows.length < configuredPageSize) break;
            cursor += Number(adapter.pagination.step || 1);
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        if (!allRows.length) throw new Error("没有提取到可导出的数据");

        const headers = [];
        allRows.forEach(row => {
            if (row && typeof row === "object" && !Array.isArray(row)) {
                Object.keys(row).forEach(key => { if (!headers.includes(key)) headers.push(key); });
            }
        });
        if (!headers.length) throw new Error("数据行不是 JSON 对象，无法生成表头");
        let csvContent = String.fromCharCode(0xFEFF) + headers.map(header => '"' + String(header).replace(/"/g, '""') + '"').join(",") + String.fromCharCode(10);
        allRows.forEach(row => {
            csvContent += headers.map(header => '"' + String(normalizeCell(row[header])).replace(/"/g, '""') + '"').join(",") + String.fromCharCode(10);
        });
        let finalOutputName = ${js(fileName)};
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = finalOutputName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return "✅ AI 适配抓取成功：" + allRows.length + " 条";`;
    }

    function generate() {
        if (!latestAnalysis) {
            setStatus('请先完成 AI 分析。', 'error');
            return;
        }
        const core = buildRuntimeCore(latestAnalysis);
        const uivCode = `return (async function() { try {${core}\n        } catch (error) { return "❌ 报错: " + error.message; } })();`;
        const consoleCode = `(async function() { try { const result = await (async function() {${core}\n        })(); console.log(result); } catch (error) { console.error("❌ AI 适配抓取失败:", error); } })();`;
        const title = (el('uivAiFileName').value.trim() || 'AI_适配抓取').replace(/\.csv$/i, '');
        const openUrl = latestAnalysis.input.openUrl || '';

        el('requestUrl').value = latestAnalysis.input.url;
        el('jsonInput').value = JSON.stringify(latestAnalysis.input.requestBody || {}, null, 4);
        el('fileName').value = title;
        el('codeOutput').value = uivCode;
        el('consoleOutput').value = consoleCode;
        const triplicate = el('autoNetCareTriplicate');
        if (triplicate) triplicate.checked = false;
        window.UIVWorkbench.setParsedPayload(latestAnalysis.input.requestBody || {});
        window.UIVWorkbench.setCurrentTitle(title, title);
        window.__uivAiAdapterCurrent = {
            generatorType: 'ai-adapter',
            adapterConfig: latestAnalysis.adapter,
            openUrl,
            loginProbeConfig: {
                strategy: latestAnalysis.adapter.auth.strategy,
                sourceKey: latestAnalysis.adapter.auth.sourceKey
            }
        };
        close();
        showToast('✅ AI 适配脚本已生成，请先单脚本验证后再加入批量仓库。', 'success');
    }

    function initKeywordInputs() {
        const keywordInput = el('uivAiResponseKeyword');
        const responseInput = el('uivAiResponse');
        if (keywordInput) keywordInput.addEventListener('input', scheduleKeywordEvaluation);
        if (responseInput) responseInput.addEventListener('input', () => {
            if (el('uivAiResponseKeyword').value.trim()) scheduleKeywordEvaluation();
        });
    }

    initKeywordInputs();

    window.UIVAIAdapter = {
        open,
        close,
        parseFetch,
        analyze,
        generate,
        selectKeywordMatch,
        closeKeywordChoice
    };
})();
