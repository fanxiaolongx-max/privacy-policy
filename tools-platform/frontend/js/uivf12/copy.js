/**
 * uivf12/copy.js - 复制功能模块
 * 负责：代码复制到剪贴板、批量阵列打包生成
 */

const UIV_BATCH_SPEED_KEY = 'uivf12_batch_speed';
const UIV_BATCH_SPEEDS = [1, 2, 4];

function copyCodeText(textAreaId, btnId, typeName) {
    const codeEl = document.getElementById(textAreaId);
    if (!codeEl || !codeEl.value) { alert(UIVT('uiv.copy.noCode')); return; }
    codeEl.select();
    document.execCommand('copy');
    const btn = document.getElementById(btnId);
    const oldText = btn.innerText;
    btn.innerText = UIVT('uiv.copy.successButton');
    setTimeout(() => btn.innerText = oldText, 2000);
    showToast(UIVT('uiv.copy.toast', { type: typeName }));
}

function copyFromMemory(codeStr, typeName) {
    const t = document.createElement('textarea');
    t.value = codeStr;
    document.body.appendChild(t);
    t.select();
    document.execCommand('copy');
    document.body.removeChild(t);
    showToast(UIVT('uiv.copy.memoryToast', { type: typeName }));
}

async function copyAllConsoleScripts() {
    try {
        const { scripts } = await API.get('/api/uiv/scripts');
        buildAndCopyMasterScript(scripts, UIVT('uiv.copy.allGroup'));
    } catch (e) {
        showToast(UIVT('uiv.copy.fetchFail'), 'error');
    }
}

async function copyAllUivScripts() {
    try {
        const { scripts } = await API.get('/api/uiv/scripts');
        buildAndCopyUivBatchMacro(scripts, UIVT('uiv.copy.allGroup'), getUivBatchSpeed());
    } catch (e) {
        showToast(UIVT('uiv.copy.fetchFail'), 'error');
    }
}

function getUivBatchSpeed() {
    const raw = Number(localStorage.getItem(UIV_BATCH_SPEED_KEY) || '1');
    return UIV_BATCH_SPEEDS.includes(raw) ? raw : 1;
}

function getUivCooldownMs(speed = getUivBatchSpeed()) {
    return Math.max(750, Math.round(3000 / speed));
}

function updateUivBatchSpeedButton() {
    const btn = document.querySelector('.btn-batch-speed');
    if (!btn) return;
    const speed = getUivBatchSpeed();
    const seconds = getUivCooldownMs(speed) / 1000;
    btn.textContent = speed + 'x';
    btn.title = UIVT('uiv.repo.batchSpeedTitle', { speed, seconds });
}

function cycleUivBatchSpeed() {
    const current = getUivBatchSpeed();
    const next = UIV_BATCH_SPEEDS[(UIV_BATCH_SPEEDS.indexOf(current) + 1) % UIV_BATCH_SPEEDS.length];
    localStorage.setItem(UIV_BATCH_SPEED_KEY, String(next));
    updateUivBatchSpeedButton();
    showToast(UIVT('uiv.repo.batchSpeedToast', { speed: next, seconds: getUivCooldownMs(next) / 1000 }), 'success');
}

function registerUivAutoImportBridge(autoImport) {
    if (!autoImport || !autoImport.sessionId || !autoImport.token) return;
    window.__uivf12AutoImportBridgeSessions = window.__uivf12AutoImportBridgeSessions || {};
    window.__uivf12AutoImportBridgeSessions[autoImport.sessionId] = autoImport;
    window.__uivf12AutoImportBridgeNameCounts = window.__uivf12AutoImportBridgeNameCounts || {};
    if (window.__uivf12AutoImportBridgeBound) return;
    window.__uivf12AutoImportBridgeBound = true;
    function rowsFromTable(table) {
        const headers = Array.isArray(table && table.headers) ? table.headers : [];
        const values = Array.isArray(table && table.values) ? table.values : [];
        if (!headers.length || !values.length) return [];
        return values
            .filter(row => Array.isArray(row) && row.some(value => String(value || '').trim() !== ''))
            .map(row => {
                const obj = {};
                headers.forEach((header, index) => {
                    obj[String(header || ('列' + (index + 1))).trim() || ('列' + (index + 1))] = row[index] !== undefined ? row[index] : '';
                });
                return obj;
            });
    }
    function uniquifyUploadName(sessionId, name) {
        const baseName = String(name || 'uivf12_capture.csv');
        const key = `${sessionId}::${baseName}`;
        const count = window.__uivf12AutoImportBridgeNameCounts[key] || 0;
        window.__uivf12AutoImportBridgeNameCounts[key] = count + 1;
        if (count === 0) return baseName;
        const dot = baseName.lastIndexOf('.');
        if (dot > 0 && dot > baseName.lastIndexOf('/')) {
            return `${baseName.slice(0, dot)} (${count})${baseName.slice(dot)}`;
        }
        return `${baseName} (${count})`;
    }
    function makeBridgeUploadId() {
        const bytes = new Uint8Array(8);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    }
    function chunkRows(rows, maxRows = 12, maxBytes = 22000) {
        const chunks = [];
        let current = [];
        let currentBytes = 0;
        rows.forEach(row => {
            const rowBytes = (() => { try { return JSON.stringify(row).length; } catch (e) { return 1024; } })();
            if (current.length && (current.length >= maxRows || currentBytes + rowBytes > maxBytes)) {
                chunks.push(current);
                current = [];
                currentBytes = 0;
            }
            current.push(row);
            currentBytes += rowBytes;
        });
        if (current.length) chunks.push(current);
        return chunks;
    }
    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async function postJsonWithRetry(url, payload, options = {}) {
        const attempts = options.attempts || 3;
        let lastError = null;
        for (let attempt = 0; attempt < attempts; attempt++) {
            try {
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await res.json().catch(() => ({}));
                if (res.ok) return result;
                lastError = new Error(`HTTP ${res.status}: ${result.error || res.statusText || 'upload failed'}`);
                if (![408, 429, 500, 502, 503, 504].includes(res.status)) throw lastError;
            } catch (error) {
                lastError = error;
            }
            if (attempt < attempts - 1) await wait(700 * (attempt + 1));
        }
        throw lastError || new Error('upload failed');
    }
    async function postDatasetRows(session, uploadName, rows, meta) {
        const chunks = chunkRows(rows);
        const clientUploadId = makeBridgeUploadId();
        let latestResult = null;
        for (let index = 0; index < chunks.length; index++) {
            try {
                latestResult = await postJsonWithRetry(session.uploadUrl, {
                    name: uploadName,
                    rows: chunks[index],
                    append: true,
                    clientUploadId,
                    chunkIndex: index,
                    chunkCount: chunks.length,
                    origin: meta.origin || '',
                    groupName: session.groupName || meta.groupName || ''
                });
            } catch (error) {
                throw new Error(`${error && error.message ? error.message : 'upload failed'} (chunk ${index + 1}/${chunks.length})`);
            }
        }
        return latestResult || {};
    }
    window.addEventListener('message', async event => {
        const data = event.data || {};
        if (!data || data.type !== 'uivf12-auto-import-dataset') return;
        const sessions = window.__uivf12AutoImportBridgeSessions || {};
        const session = sessions[data.sessionId];
        if (!session || session.token !== data.token) return;

        const reply = payload => {
            try {
                if (event.source && typeof event.source.postMessage === 'function') {
                    event.source.postMessage(Object.assign({
                        type: 'uivf12-auto-import-ack',
                        requestId: data.requestId,
                        sessionId: data.sessionId
                    }, payload), event.origin || '*');
                }
            } catch (e) {}
        };

        try {
            const rows = data.table ? rowsFromTable(data.table) : (Array.isArray(data.rows) ? data.rows : []);
            if (!rows.length) throw new Error('缺少结构化 rows 数据');
            const uploadName = uniquifyUploadName(data.sessionId, data.name);
            const result = await postDatasetRows(session, uploadName, rows, {
                origin: data.origin || event.origin || '',
                groupName: data.groupName || ''
            });
            reply({ ok: true, result });
        } catch (error) {
            console.warn('[UIVF12 Auto Import Bridge] upload failed:', data.name, error);
            reply({
                ok: false,
                error: error.message || '自动导入桥接上传失败',
                detail: {
                    name: data.name || '',
                    rowCount: data.table && Array.isArray(data.table.values) ? data.table.values.length : (Array.isArray(data.rows) ? data.rows.length : 0),
                    headerCount: data.table && Array.isArray(data.table.headers) ? data.table.headers.length : 0,
                    approxBytes: (() => { try { return JSON.stringify(data.table || data.rows || []).length; } catch (e) { return 0; } })()
                }
            });
        }
    });
}

function getUivOpenUrl(rawUrl) {
    try {
        const parsed = new URL(rawUrl || '');
        return `${parsed.origin}/`;
    } catch (e) {
        return '';
    }
}

function extractUrlFromCode(code) {
    const text = String(code || '');
    const commentMatch = text.match(/URL:\s*(https?:\/\/[^\s]+)/);
    if (commentMatch) return commentMatch[1];
    const fetchMatch = text.match(/fetch\("([^"]+)"/);
    if (fetchMatch) return fetchMatch[1];
    return '';
}

function resolveUivScriptUrl(script) {
    return script.url || extractUrlFromCode(script.code) || extractUrlFromCode(script.consoleCode);
}

function buildLoginProbeScript(rawUrl) {
    const lowerUrl = String(rawUrl || '').toLowerCase();
    if (lowerUrl.includes('datafab')) {
        return `return (function () {
            const cookie = String(document.cookie || "");
            const ok = cookie.indexOf("XSRF-TOKEN=") !== -1 || cookie.indexOf("NETLIVE-XSRF-TOKEN=") !== -1;
            return JSON.stringify({
                ok,
                reason: ok ? "ok" : "xsrf_cookie_missing",
                cookieLen: cookie.length,
                host: location.host,
                href: location.href
            });
        })();`;
    }
    if (lowerUrl.includes('netcare')) {
        return `return (function () {
            const cfg = localStorage.getItem("globalConfig") || "";
            const cookie = String(document.cookie || "");
            let token = "";
            const match = cfg.match(/[A-Fa-f0-9]{64}/);
            if (match) token = match[0];
            if (!token) {
                try {
                    const parsed = JSON.parse(cfg || "{}");
                    const config = Array.isArray(parsed) ? (parsed[0] || {}) : parsed;
                    token = config.csrfToken || (config.configData && config.configData.csrfToken) || "";
                } catch (e) {}
            }
            const hasToken = String(token || "").length >= 16;
            const hasCookie = cookie.length > 20;
            return JSON.stringify({
                ok: hasToken && hasCookie,
                reason: hasToken && hasCookie ? "ok" : (!hasToken ? "csrf_missing" : "cookie_missing"),
                hasToken,
                tokenLen: token ? String(token).length : 0,
                globalConfigLen: cfg.length,
                cookieLen: cookie.length,
                host: location.host,
                href: location.href
            });
        })();`;
    }
    return `return (function () {
        const cookie = String(document.cookie || "");
        const ok = Boolean(cookie || localStorage.length > 0);
        return JSON.stringify({
            ok,
            reason: ok ? "ok" : "no_cookie_or_localstorage",
            cookieLen: cookie.length,
            localStorageLen: localStorage.length,
            host: location.host,
            href: location.href
        });
    })();`;
}

function buildLoginProbeStatusScript(loginVar, siteUrl) {
    return `return (function () {
        const raw = ${'${' + loginVar + '}'};
        let parsed = {};
        try {
            parsed = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
        } catch (e) {
            parsed = { ok: raw === 'true', reason: 'parse_failed', raw: String(raw || '') };
        }
        const ok = parsed.ok === true || parsed.ok === 'true' || raw === 'true';
        const reason = parsed.reason || (ok ? 'ok' : 'unknown');
        try {
            const bag = window.name ? JSON.parse(window.name) : {};
            const logs = Array.isArray(bag.uivf12LoginProbeLogs) ? bag.uivf12LoginProbeLogs : [];
            logs.push({ at: new Date().toISOString(), ok, reason, site: ${JSON.stringify(siteUrl || '')}, detail: parsed });
            bag.uivf12LoginProbeLogs = logs.slice(-80);
            window.name = JSON.stringify(bag);
        } catch (e) {}
        return ok ? 'true' : 'false';
    })();`;
}

function buildAppendPanelLogScript(loginVar, siteUrl) {
    return `return (function () {
        const raw = ${'${' + loginVar + '}'} || '';
        let parsed = {};
        try {
            parsed = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
        } catch (e) {
            parsed = { ok: raw === 'true', reason: 'parse_failed', raw: String(raw || '') };
        }
        const ok = parsed.ok === true || parsed.ok === 'true' || raw === 'true';
        const reason = parsed.reason || (ok ? 'ok' : 'unknown');
        const msg = '登录探测 ${String(siteUrl || '').replace(/'/g, "\\'")} -> ' + (ok ? 'OK' : 'WAIT') +
            ' · reason=' + reason +
            ' · tokenLen=' + (parsed.tokenLen || 0) +
            ' · globalConfigLen=' + (parsed.globalConfigLen || 0) +
            ' · cookieLen=' + (parsed.cookieLen || 0) +
            ' · host=' + (parsed.host || location.host);
        const target = document.getElementById('uivf12-batch-log-scroll');
        if (target) {
            const line = document.createElement('div');
            line.style.cssText = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fde68a;';
            line.textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false }) + ' ' + msg;
            target.appendChild(line);
            while (target.children.length > 100) target.removeChild(target.firstChild);
            target.scrollTop = target.scrollHeight;
        }
        return msg;
    })();`;
}

function buildNetcareGlobalConfigCompatScript() {
    return `return (function () {
        try {
            const raw = localStorage.getItem('globalConfig') || '';
            const parsed = JSON.parse(raw || '{}');
            if (Array.isArray(parsed) && parsed[0] && typeof parsed[0] === 'object') {
                localStorage.setItem('globalConfig', JSON.stringify(parsed[0]));
                return 'globalConfig-array-normalized';
            }
            return 'globalConfig-ok';
        } catch (e) {
            return 'globalConfig-parse-skip:' + (e && e.message ? e.message : e);
        }
    })();`;
}

function groupUivScriptsByOpenUrl(scripts) {
    const groups = [];
    const groupMap = new Map();
    scripts.forEach(script => {
        if (!groupMap.has(script.openUrl)) {
            const group = {
                openUrl: script.openUrl,
                loginProbe: buildLoginProbeScript(script.url),
                scripts: []
            };
            groupMap.set(script.openUrl, group);
            groups.push(group);
        }
        groupMap.get(script.openUrl).scripts.push(script);
    });
    return groups;
}

function sampleUivScriptsPerSite(scripts, perSite = 2) {
    const prepared = scripts
        .map((script, index) => {
            const resolvedUrl = resolveUivScriptUrl(script);
            return {
                script,
                index,
                openUrl: getUivOpenUrl(resolvedUrl)
            };
        })
        .filter(item => item.openUrl && (item.script.code || item.script.consoleCode));
    const map = new Map();
    prepared.forEach(item => {
        if (!map.has(item.openUrl)) map.set(item.openUrl, []);
        map.get(item.openUrl).push(item);
    });
    const sampled = [];
    map.forEach(items => {
        const pool = [...items];
        for (let i = 0; i < perSite && pool.length; i++) {
            const pickIndex = Math.floor(Math.random() * pool.length);
            sampled.push(pool.splice(pickIndex, 1)[0].script);
        }
    });
    return sampled;
}

function buildUivProgressPanelScript(state) {
    return `(() => {
        const state = ${JSON.stringify(state)};
        const controlKey = 'uivf12BatchControl';
        function readWindowState() {
            try {
                const parsed = window.name ? JSON.parse(window.name) : {};
                return parsed && typeof parsed === 'object' ? parsed : {};
            } catch (e) {
                return { __uivf12OriginalWindowName: window.name || '' };
            }
        }
        function readControl() {
            const bag = readWindowState();
            return bag[controlKey] || {};
        }
        function writeControl(nextControl) {
            const bag = readWindowState();
            bag[controlKey] = Object.assign({}, bag[controlKey] || {}, nextControl);
            window.name = JSON.stringify(bag);
        }
        let auraStyle = document.getElementById('uivf12-control-aura-style');
        if (!auraStyle) {
            auraStyle = document.createElement('style');
            auraStyle.id = 'uivf12-control-aura-style';
            auraStyle.textContent = '@keyframes uivf12AuraPulse{0%,100%{opacity:.55;box-shadow:inset 0 0 28px rgba(34,211,238,.34),inset 0 0 78px rgba(59,130,246,.18)}50%{opacity:.95;box-shadow:inset 0 0 42px rgba(103,232,249,.55),inset 0 0 118px rgba(139,92,246,.24)}}@keyframes uivf12Scan{0%{transform:translateY(-120%)}100%{transform:translateY(120vh)}}';
            document.documentElement.appendChild(auraStyle);
        }
        let aura = document.getElementById('uivf12-control-aura');
        if (!aura) {
            aura = document.createElement('div');
            aura.id = 'uivf12-control-aura';
            document.documentElement.appendChild(aura);
        }
        aura.style.cssText = [
            'position:fixed',
            'inset:0',
            'z-index:2147483645',
            'pointer-events:none',
            'border:2px solid rgba(103,232,249,.44)',
            'box-shadow:inset 0 0 34px rgba(34,211,238,.42),inset 0 0 96px rgba(59,130,246,.2)',
            'animation:uivf12AuraPulse 2.4s ease-in-out infinite',
            'box-sizing:border-box'
        ].join(';');
        let scan = document.getElementById('uivf12-control-scanline');
        if (!scan) {
            scan = document.createElement('div');
            scan.id = 'uivf12-control-scanline';
            document.documentElement.appendChild(scan);
        }
        scan.style.cssText = [
            'position:fixed',
            'left:0',
            'right:0',
            'top:0',
            'height:90px',
            'z-index:2147483646',
            'pointer-events:none',
            'background:linear-gradient(180deg,rgba(103,232,249,0),rgba(103,232,249,.16),rgba(103,232,249,0))',
            'animation:uivf12Scan 4.8s linear infinite'
        ].join(';');
        let controlHint = document.getElementById('uivf12-control-hint');
        if (!controlHint) {
            controlHint = document.createElement('div');
            controlHint.id = 'uivf12-control-hint';
            document.documentElement.appendChild(controlHint);
        }
        controlHint.style.cssText = [
            'position:fixed',
            'left:18px',
            'bottom:18px',
            'z-index:2147483647',
            'pointer-events:none',
            'font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
            'font-size:11px',
            'line-height:1.5',
            'color:#cffafe',
            'background:rgba(6,18,32,.78)',
            'border:1px solid rgba(103,232,249,.32)',
            'box-shadow:0 10px 32px rgba(8,47,73,.28)',
            'border-radius:10px',
            'padding:8px 10px',
            'backdrop-filter:blur(10px)'
        ].join(';');
        controlHint.innerHTML = 'UIVF12 CONTROL ACTIVE<br><span style="color:#93c5fd;">页面自动化接管中 · 右下角面板显示进度</span>';
        const control = readControl();
        const pct = (done, total) => total ? Math.round((done / total) * 100) : 0;
        const clampLogs = Array.isArray(state.logs) ? state.logs.slice(-80) : [];
        let panel = document.getElementById('uivf12-batch-progress-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'uivf12-batch-progress-panel';
            document.documentElement.appendChild(panel);
        }
        const positionStyles = control.x !== undefined && control.y !== undefined
            ? ['left:' + control.x + 'px', 'top:' + control.y + 'px']
            : ['right:18px', 'bottom:18px'];
        panel.style.cssText = [
            'position:fixed',
            positionStyles.join(';'),
            'width:' + Math.max(320, Math.min(720, control.width || 390)) + 'px',
            control.height ? 'height:' + Math.max(260, Math.min(760, control.height)) + 'px' : '',
            'min-width:320px',
            'min-height:260px',
            'max-width:calc(100vw - 36px)',
            'max-height:calc(100vh - 36px)',
            'z-index:2147483647',
            'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif',
            'color:#e5f7ff',
            'background:linear-gradient(145deg,rgba(6,18,32,.96),rgba(8,47,73,.94))',
            'border:1px solid rgba(56,189,248,.38)',
            'box-shadow:0 18px 60px rgba(8,47,73,.38), inset 0 0 0 1px rgba(255,255,255,.05)',
            'border-radius:14px',
            'padding:14px',
            'backdrop-filter:blur(12px)',
            'box-sizing:border-box',
            'resize:both',
            'overflow:hidden'
        ].join(';');
        const bar = (done, total, accent) => {
            const value = pct(done, total);
            return '<div style="height:8px;background:rgba(148,163,184,.18);border-radius:999px;overflow:hidden;border:1px solid rgba(148,163,184,.16);">' +
                '<div style="height:100%;width:' + value + '%;background:' + accent + ';box-shadow:0 0 18px rgba(34,211,238,.42);transition:width .35s ease;"></div>' +
            '</div>';
        };
        const siteRows = state.sites.map(site => {
            const active = site.status === 'running';
            const done = site.status === 'done';
            const statusText = done ? '完成' : (active ? '执行中' : (site.status === 'waiting' ? '待登录' : '等待'));
            const color = done ? '#34d399' : (active ? '#38bdf8' : (site.status === 'waiting' ? '#fbbf24' : '#94a3b8'));
            return '<div style="padding:10px 0;border-top:1px solid rgba(148,163,184,.14);">' +
                '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:7px;">' +
                    '<div style="min-width:0;font-size:12px;font-weight:700;color:#e0f2fe;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + site.label + '</div>' +
                    '<div style="font-size:11px;color:' + color + ';white-space:nowrap;">' + statusText + ' · ' + site.done + '/' + site.total + '</div>' +
                '</div>' +
                bar(site.done, site.total, done ? 'linear-gradient(90deg,#22c55e,#86efac)' : 'linear-gradient(90deg,#0ea5e9,#22d3ee)') +
            '</div>';
        }).join('');
        const logRows = clampLogs.map(log => '<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + log + '</div>').join('');
        panel.innerHTML =
            '<div id="uivf12-batch-panel-handle" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;cursor:move;user-select:none;">' +
                '<div>' +
                    '<div style="font-size:14px;font-weight:800;letter-spacing:.2px;color:#f8fafc;">UIVF12 批量阵列控制台</div>' +
                    '<div style="font-size:10px;color:#93c5fd;margin-top:2px;">' + state.groupName + ' · 可拖动 / 可缩放</div>' +
                '</div>' +
                '<div style="display:flex;align-items:center;gap:8px;">' +
                    '<div style="font-size:11px;color:#67e8f9;border:1px solid rgba(103,232,249,.28);border-radius:999px;padding:4px 8px;background:rgba(8,145,178,.14);">' + state.phase + '</div>' +
                '</div>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px;">' +
                '<div style="font-size:28px;line-height:1;font-weight:900;color:#ffffff;">' + pct(state.done, state.total) + '%</div>' +
                '<div style="font-size:12px;color:#bae6fd;">总进度 ' + state.done + '/' + state.total + '</div>' +
            '</div>' +
            bar(state.done, state.total, 'linear-gradient(90deg,#06b6d4,#3b82f6,#8b5cf6)') +
            '<div style="margin-top:10px;">' + siteRows + '</div>' +
            '<div style="margin-top:10px;border-top:1px solid rgba(148,163,184,.16);padding-top:9px;">' +
                '<div style="font-size:10px;color:#7dd3fc;text-transform:uppercase;letter-spacing:.12em;margin-bottom:5px;">Live Log</div>' +
                '<div id="uivf12-batch-log-scroll" style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10px;line-height:1.55;color:#cbd5e1;height:96px;overflow-y:auto;overflow-x:hidden;padding-right:4px;">' + logRows + '</div>' +
            '</div>';
        const handle = panel.querySelector('#uivf12-batch-panel-handle');
        if (handle && !panel.__uivf12DragBound) {
            panel.__uivf12DragBound = true;
            const dragStart = function (event) {
                if (event.button !== 0) return;
                if (event.target && event.target.closest && event.target.closest('#uivf12-batch-log-scroll')) return;
                if (event.target && ['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
                const rect = panel.getBoundingClientRect();
                const nearResizeCorner = event.clientX > rect.right - 24 && event.clientY > rect.bottom - 24;
                if (nearResizeCorner) return;
                const startX = event.clientX;
                const startY = event.clientY;
                const offsetX = startX - rect.left;
                const offsetY = startY - rect.top;
                function move(moveEvent) {
                    const maxX = window.innerWidth - Math.min(panel.offsetWidth, window.innerWidth);
                    const maxY = window.innerHeight - Math.min(panel.offsetHeight, window.innerHeight);
                    const x = Math.max(0, Math.min(maxX, moveEvent.clientX - offsetX));
                    const y = Math.max(0, Math.min(maxY, moveEvent.clientY - offsetY));
                    panel.style.left = x + 'px';
                    panel.style.top = y + 'px';
                    panel.style.right = 'auto';
                    panel.style.bottom = 'auto';
                    writeControl({ x, y, width: panel.offsetWidth, height: panel.offsetHeight });
                }
                function up() {
                    writeControl({ width: panel.offsetWidth, height: panel.offsetHeight });
                    window.removeEventListener('mousemove', move);
                    window.removeEventListener('mouseup', up);
                }
                window.addEventListener('mousemove', move);
                window.addEventListener('mouseup', up);
                event.preventDefault();
            };
            handle.addEventListener('mousedown', dragStart);
            panel.addEventListener('mousedown', dragStart);
            if (window.ResizeObserver) {
                panel.__uivf12ResizeObserver = new ResizeObserver(function () {
                    const rect = panel.getBoundingClientRect();
                    writeControl({ x: rect.left, y: rect.top, width: panel.offsetWidth, height: panel.offsetHeight });
                });
                panel.__uivf12ResizeObserver.observe(panel);
            }
        }
        panel.onmouseup = function () {
            const rect = panel.getBoundingClientRect();
            writeControl({ x: rect.left, y: rect.top, width: panel.offsetWidth, height: panel.offsetHeight });
        };
        const logScroll = panel.querySelector('#uivf12-batch-log-scroll');
        if (logScroll) logScroll.scrollTop = logScroll.scrollHeight;
        return 'panel-updated';
    })();`;
}

function buildUivCompletionDialogScript(summary) {
    return `(() => {
        const summary = ${JSON.stringify(summary)};
        function readWindowState() {
            try {
                const parsed = window.name ? JSON.parse(window.name) : {};
                return parsed && typeof parsed === 'object' ? parsed : {};
            } catch (e) {
                return {};
            }
        }
        const actualFiles = (readWindowState().uivf12Downloads || []).filter(Boolean);
        const importedFiles = (readWindowState().uivf12AutoImportDatasets || []).filter(Boolean);
        const failedImports = (readWindowState().uivf12AutoImportFailures || []).filter(Boolean);
        const noDownloadTasks = (readWindowState().uivf12NoDownloadTasks || []).filter(Boolean);
        const hasActualFiles = actualFiles.length > 0;
        const hasImportedFiles = importedFiles.length > 0;
        const hasFailedImports = failedImports.length > 0;
        const hasNoDownloadTasks = noDownloadTasks.length > 0;
        const importUrl = summary.autoImport && summary.autoImport.slaUrl ? summary.autoImport.slaUrl : '';
        function buildImportUrl(month) {
            if (!importUrl) return '';
            try {
                const url = new URL(importUrl, window.location.origin);
                const normalized = parseInt(month, 10);
                if (normalized >= 1 && normalized <= 12) url.searchParams.set('targetMonth', String(normalized));
                else url.searchParams.delete('targetMonth');
                return url.href;
            } catch (e) {
                return importUrl;
            }
        }
        const monthOptions = ['<option value="">SLA默认月份</option>'].concat(Array.from({ length: 12 }, (_, index) => {
            const month = index + 1;
            return '<option value="' + month + '">' + month + '月</option>';
        })).join('');
        const old = document.getElementById('uivf12-completion-dialog');
        if (old) old.remove();
        const overlay = document.createElement('div');
        overlay.id = 'uivf12-completion-dialog';
        overlay.style.cssText = [
            'position:fixed',
            'inset:0',
            'z-index:2147483647',
            'display:grid',
            'place-items:center',
            'background:rgba(2,6,23,.58)',
            'backdrop-filter:blur(8px)',
            'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif',
            'color:#e2e8f0',
            'padding:20px'
        ].join(';');
        const fileRows = actualFiles.map((name, index) =>
            '<div style="display:grid;grid-template-columns:46px minmax(0,1fr);gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid rgba(148,163,184,.14);font-size:13px;line-height:1.45;">' +
                '<span style="color:#67e8f9;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-weight:800;">#' + String(index + 1).padStart(2, '0') + '</span>' +
                '<span style="word-break:break-all;white-space:normal;color:#f8fafc;font-weight:650;">' + String(name).replace(/[<>&]/g, ch => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[ch])) + '</span>' +
            '</div>'
        ).join('');
        const escapeHtml = value => String(value === undefined || value === null ? '' : value).replace(/[<>&]/g, ch => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[ch]));
        const failedRows = failedImports.map(item => {
            const detail = item && typeof item.detail === 'object' ? item.detail : {};
            const detailLines = [
                ['时间', item.at || ''],
                ['行数', detail.rowCount],
                ['字段数', detail.headerCount],
                ['桥接负载约', detail.approxBytes ? (detail.approxBytes + ' bytes') : ''],
                ['桥接错误', detail.bridgeError],
                ['Fetch 错误', detail.fetchError],
                ['完整信息', detail.message || detail.error || item.reason || '']
            ].filter(pair => pair[1] !== undefined && pair[1] !== null && String(pair[1]) !== '');
            const detailHtml = detailLines.map(pair =>
                '<div style="display:grid;grid-template-columns:82px minmax(0,1fr);gap:8px;padding:2px 0;">' +
                    '<span style="color:#fda4af;">' + escapeHtml(pair[0]) + '</span>' +
                    '<span style="color:#fecaca;word-break:break-all;">' + escapeHtml(pair[1]) + '</span>' +
                '</div>'
            ).join('');
            return '<details style="padding:8px 0;border-bottom:1px solid rgba(251,113,133,.14);font-size:12px;line-height:1.45;">' +
                '<summary style="cursor:pointer;color:#fecaca;font-weight:750;word-break:break-all;">' + escapeHtml(item.name || item) +
                    '<span style="margin-left:8px;color:#fda4af;font-weight:600;">' + escapeHtml(item.reason || '自动导入失败') + '</span>' +
                '</summary>' +
                '<div style="margin-top:6px;padding:8px;border-radius:8px;background:rgba(127,29,29,.16);font-size:11px;">' + detailHtml + '</div>' +
            '</details>';
        }).join('');
        const noDownloadRows = noDownloadTasks.map(item => {
            const fetchRows = Array.isArray(item.recentFetch) ? item.recentFetch : [];
            const fetchHtml = fetchRows.length
                ? '<div style="margin-top:6px;border-top:1px solid rgba(251,191,36,.18);padding-top:6px;">' +
                    '<div style="color:#fde68a;font-weight:800;margin-bottom:4px;">最近 Fetch 诊断</div>' +
                    fetchRows.map(fetchItem => {
                        const status = fetchItem.status !== undefined && fetchItem.status !== '' ? fetchItem.status : '-';
                        const ok = fetchItem.ok !== undefined && fetchItem.ok !== '' ? fetchItem.ok : '-';
                        const contentType = fetchItem.contentType || '-';
                        const err = fetchItem.error ? (' · ' + fetchItem.error) : '';
                        const duration = fetchItem.durationMs !== undefined && fetchItem.durationMs !== '' ? (' · ' + fetchItem.durationMs + 'ms') : '';
                        return '<div style="padding:4px 0;border-top:1px dashed rgba(251,191,36,.12);">' +
                            '<div style="color:#fef3c7;word-break:break-all;">' + escapeHtml(fetchItem.url || '-') + '</div>' +
                            '<div style="color:#fde68a;">status=' + escapeHtml(status) + ' · ok=' + escapeHtml(ok) + ' · type=' + escapeHtml(contentType) + duration + escapeHtml(err) + '</div>' +
                        '</div>';
                    }).join('') +
                '</div>'
                : '';
            const lines = [
                ['时间', item.at || ''],
                ['该脚本前后下载数', String(item.before || 0) + ' -> ' + String(item.after || 0)],
                ['该脚本前后导入数', String(item.beforeImports || 0) + ' -> ' + String(item.afterImports || 0)],
                ['脚本返回', item.result || ''],
                ['审计结论', item.auditResult || '']
            ].filter(pair => pair[1] !== undefined && pair[1] !== null && String(pair[1]) !== '');
            const detailHtml = lines.map(pair =>
                '<div style="display:grid;grid-template-columns:82px minmax(0,1fr);gap:8px;padding:2px 0;">' +
                    '<span style="color:#fde68a;">' + escapeHtml(pair[0]) + '</span>' +
                    '<span style="color:#fef3c7;word-break:break-all;">' + escapeHtml(pair[1]) + '</span>' +
                '</div>'
            ).join('') + fetchHtml;
            return '<details style="padding:8px 0;border-bottom:1px solid rgba(251,191,36,.14);font-size:12px;line-height:1.45;">' +
                '<summary style="cursor:pointer;color:#fde68a;font-weight:750;word-break:break-all;">' + escapeHtml(item.name || '未命名脚本') + '</summary>' +
                '<div style="margin-top:6px;padding:8px;border-radius:8px;background:rgba(146,64,14,.16);font-size:11px;">' + detailHtml + '</div>' +
            '</details>';
        }).join('');
        overlay.innerHTML =
            '<div style="width:min(720px,100%);max-height:calc(100vh - 40px);overflow:hidden;background:rgba(15,23,42,.96);border:1px solid rgba(56,189,248,.38);border-radius:16px;box-shadow:0 24px 90px rgba(0,0,0,.45);">' +
                '<div style="padding:20px 22px 14px;border-bottom:1px solid rgba(148,163,184,.16);display:flex;justify-content:space-between;gap:16px;align-items:flex-start;">' +
                    '<div>' +
                        '<div style="font-size:20px;font-weight:900;color:#f8fafc;">UIVF12 批量抓取完成</div>' +
                        '<div style="font-size:12px;color:#93c5fd;margin-top:4px;">' + summary.groupName + ' · ' + summary.finishedAt + '</div>' +
                    '</div>' +
                    '<button type="button" id="uivf12-completion-close" style="border:0;background:transparent;color:#94a3b8;font-size:24px;cursor:pointer;line-height:1;">×</button>' +
                '</div>' +
                '<div style="padding:18px 22px;">' +
                    '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px;">' +
                        '<div style="border:1px solid rgba(103,232,249,.18);border-radius:10px;padding:10px;background:rgba(8,47,73,.28);"><div style="font-size:10px;color:#7dd3fc;text-transform:uppercase;">脚本任务</div><div style="font-size:22px;font-weight:900;">' + summary.taskCount + '</div></div>' +
                        '<div style="border:1px solid rgba(103,232,249,.18);border-radius:10px;padding:10px;background:rgba(8,47,73,.28);"><div style="font-size:10px;color:#7dd3fc;text-transform:uppercase;">实际文件</div><div style="font-size:22px;font-weight:900;">' + (hasActualFiles ? actualFiles.length : '未检测') + '</div></div>' +
                        '<div style="border:1px solid rgba(103,232,249,.18);border-radius:10px;padding:10px;background:rgba(8,47,73,.28);"><div style="font-size:10px;color:#7dd3fc;text-transform:uppercase;">自动导入</div><div style="font-size:22px;font-weight:900;">' + (hasImportedFiles ? importedFiles.length : '未暂存') + '</div></div>' +
                    '</div>' +
                    '<div style="font-size:12px;color:#cbd5e1;margin-bottom:10px;">文件会继续下载到浏览器默认下载目录；自动导入只上传浏览器端解析后的结构化 rows，不上传原始 CSV 文件。</div>' +
                    (importUrl && hasImportedFiles ? '<div id="uivf12-import-open-hint" style="margin-bottom:12px;padding:10px;border:1px solid rgba(34,197,94,.28);border-radius:10px;background:rgba(22,101,52,.16);font-size:12px;color:#bbf7d0;line-height:1.55;">' +
                        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
                            '<span>即将在新标签页打开数据导入页面并执行智能分流合并，当前抓取结果页会保留。</span>' +
                            '<label style="display:inline-flex;align-items:center;gap:5px;color:#d1fae5;">目标月份<select id="uivf12-import-target-month" style="height:24px;border-radius:6px;border:1px solid rgba(103,232,249,.34);background:rgba(15,23,42,.78);color:#e0f2fe;font-size:12px;">' + monthOptions + '</select></label>' +
                            '<a id="uivf12-import-open-link" href="' + buildImportUrl('').replace(/"/g, '&quot;') + '" target="_blank" rel="noopener" style="color:#67e8f9;font-weight:800;">立即打开</a>' +
                        '</div>' +
                        '<div style="margin-top:4px;color:#fde68a;">如果浏览器拦截了自动打开新标签页，请点击上方“立即打开”。</div></div>' : '') +
                    (hasFailedImports ? '<div style="margin-bottom:12px;padding:10px 14px;border:1px solid rgba(251,113,133,.3);border-radius:10px;background:rgba(127,29,29,.18);"><div style="font-size:12px;color:#fecaca;font-weight:850;margin-bottom:6px;">以下文件下载成功，但自动导入失败</div>' + failedRows + '</div>' : '') +
                    (hasNoDownloadTasks ? '<div style="margin-bottom:12px;padding:10px 14px;border:1px solid rgba(251,191,36,.3);border-radius:10px;background:rgba(146,64,14,.16);"><div style="font-size:12px;color:#fde68a;font-weight:850;margin-bottom:6px;">以下脚本已执行，但未检测到下载文件</div>' + noDownloadRows + '</div>' : '') +
                    '<div style="max-height:320px;overflow:auto;border:1px solid rgba(148,163,184,.16);border-radius:10px;padding:4px 14px;background:rgba(2,6,23,.34);">' + (fileRows || '<div style="padding:14px;color:#94a3b8;font-size:13px;">未检测到本次下载文件名。若浏览器或扩展绕过页面下载事件，文件数量将不显示。</div>') + '</div>' +
                '</div>' +
            '</div>';
        overlay.querySelector('#uivf12-completion-close').onclick = () => overlay.remove();
        overlay.addEventListener('click', event => { if (event.target === overlay) overlay.remove(); });
        document.documentElement.appendChild(overlay);
        if (importUrl && hasImportedFiles) {
            const monthSelect = overlay.querySelector('#uivf12-import-target-month');
            const openLink = overlay.querySelector('#uivf12-import-open-link');
            const syncImportLink = function () {
                const nextUrl = buildImportUrl(monthSelect ? monthSelect.value : '');
                if (openLink && nextUrl) openLink.href = nextUrl;
                return nextUrl;
            };
            if (monthSelect) monthSelect.addEventListener('change', syncImportLink);
            syncImportLink();
            setTimeout(function () {
                const opened = window.open(syncImportLink(), '_blank', 'noopener');
                if (!opened) {
                    const hint = overlay.querySelector('#uivf12-import-open-hint');
                    if (hint) {
                        hint.style.borderColor = 'rgba(251,191,36,.42)';
                        hint.style.background = 'rgba(146,64,14,.18)';
                    }
                }
            }, 1800);
        }
        return 'completion-shown';
    })();`;
}

function buildUivDownloadRecorderScript(options = {}) {
    return `(() => {
        const reset = ${options.reset ? 'true' : 'false'};
        const autoImport = ${JSON.stringify(options.autoImport || null)};
        function readWindowState() {
            try {
                const parsed = window.name ? JSON.parse(window.name) : {};
                return parsed && typeof parsed === 'object' ? parsed : {};
            } catch (e) {
                return {};
            }
        }
        function writeWindowState(nextState) {
            window.name = JSON.stringify(nextState);
        }
        function recordDownloadName(name) {
            if (!name) return;
            const bag = readWindowState();
            const list = Array.isArray(bag.uivf12Downloads) ? bag.uivf12Downloads : [];
            list.push(String(name));
            bag.uivf12Downloads = list;
            writeWindowState(bag);
        }
        function recordAutoImportName(name) {
            if (!name) return;
            const bag = readWindowState();
            const list = Array.isArray(bag.uivf12AutoImportDatasets) ? bag.uivf12AutoImportDatasets : [];
            list.push(String(name));
            bag.uivf12AutoImportDatasets = list;
            writeWindowState(bag);
        }
        function recordAutoImportFailure(name, reason) {
            if (!name) return;
            const bag = readWindowState();
            const list = Array.isArray(bag.uivf12AutoImportFailures) ? bag.uivf12AutoImportFailures : [];
            const detail = reason && typeof reason === 'object' ? reason : { message: reason };
            const message = detail.message || detail.error || '自动导入失败';
            const signature = String(name) + '::' + String(message);
            if (list.some(item => item && item.signature === signature)) return;
            list.push({
                name: String(name),
                reason: String(message).slice(0, 260),
                signature,
                detail,
                at: new Date().toISOString()
            });
            bag.uivf12AutoImportFailures = list;
            writeWindowState(bag);
        }
        function rememberFetchDiagnostic(info) {
            try {
                const bag = readWindowState();
                const list = Array.isArray(bag.uivf12FetchDiagnostics) ? bag.uivf12FetchDiagnostics : [];
                list.push(Object.assign({ at: new Date().toISOString() }, info || {}));
                bag.uivf12FetchDiagnostics = list.slice(-40);
                writeWindowState(bag);
            } catch (e) {}
        }
        function hasRecentDirectCapture(name) {
            if (!name) return false;
            const captures = window.__uivf12RecentDirectCaptures || {};
            return Date.now() - (captures[String(name)] || 0) < 5000;
        }
        function markRecentDirectCapture(name) {
            if (!name) return;
            window.__uivf12RecentDirectCaptures = window.__uivf12RecentDirectCaptures || {};
            window.__uivf12RecentDirectCaptures[String(name)] = Date.now();
        }
        function parseCsv(text) {
            const table = parseCsvTable(text);
            return tableToRows(table);
        }
        function parseCsvTable(text) {
            const normalized = String(text || '').replace(/^\\uFEFF/, '');
            const rows = [];
            let row = [];
            let field = '';
            let inQuotes = false;
            for (let i = 0; i < normalized.length; i++) {
                const ch = normalized[i];
                const next = normalized[i + 1];
                if (inQuotes) {
                    if (ch === '"' && next === '"') {
                        field += '"';
                        i++;
                    } else if (ch === '"') {
                        inQuotes = false;
                    } else {
                        field += ch;
                    }
                } else if (ch === '"') {
                    inQuotes = true;
                } else if (ch === ',') {
                    row.push(field);
                    field = '';
                } else if (ch === '\\n') {
                    row.push(field);
                    rows.push(row);
                    row = [];
                    field = '';
                } else if (ch !== '\\r') {
                    field += ch;
                }
            }
            if (field !== '' || row.length) {
                row.push(field);
                rows.push(row);
            }
            return {
                headers: (rows.shift() || []).map(h => String(h || '').trim()),
                values: rows.filter(values => values.some(v => String(v || '').trim() !== ''))
            };
        }
        function tableToRows(table) {
            const headers = Array.isArray(table && table.headers) ? table.headers : [];
            const values = Array.isArray(table && table.values) ? table.values : [];
            return values.map(row => {
                const obj = {};
                headers.forEach((header, index) => {
                    obj[header || ('列' + (index + 1))] = row[index] !== undefined ? row[index] : '';
                });
                return obj;
            });
        }
        async function uploadBlob(name, blob) {
            if (!autoImport || !autoImport.uploadUrl || !blob || !name) return;
            if (hasRecentDirectCapture(name)) return;
            try {
                if (!window.__uivf12AutoImport) window.__uivf12AutoImport = { pending: [] };
                const pending = blob.text().then(function (text) {
                    const table = parseCsvTable(text);
                    if (!table.values.length) throw new Error('empty rows');
                    return uploadDataset(name, table);
                }).then(function (result) {
                    if (!result) throw new Error('upload failed');
                    recordAutoImportName(result.dataset && result.dataset.name ? result.dataset.name : name);
                    return result;
                }).catch(function (err) {
                    console.warn('[UIVF12 Auto Import] upload failed:', name, err);
                    recordAutoImportFailure(name, err && err.__uivDetail ? err.__uivDetail : { message: err && err.message ? err.message : 'Blob 自动导入失败' });
                    return null;
                });
                window.__uivf12AutoImport.pending.push(pending);
            } catch (err) {
                console.warn('[UIVF12 Auto Import] upload init failed:', name, err);
            }
        }
        async function uploadCsvText(name, csvText) {
            if (!autoImport || !autoImport.uploadUrl || !name) return null;
            try {
                const table = parseCsvTable(csvText);
                if (!table.values.length) throw new Error('empty rows');
                const result = await uploadDataset(name, table);
                if (!result) throw new Error('upload failed');
                markRecentDirectCapture(name);
                recordAutoImportName(result.dataset && result.dataset.name ? result.dataset.name : name);
                return result;
            } catch (err) {
                console.warn('[UIVF12 Auto Import] direct dataset upload failed:', name, err);
                recordAutoImportFailure(name, err && err.__uivDetail ? err.__uivDetail : { message: err && err.message ? err.message : '直接自动导入失败' });
                return null;
            }
        }
        function uploadViaBridge(name, table) {
            return new Promise(resolve => {
                if (!window.opener || window.opener.closed || !autoImport.bridgeOrigin) {
                    resolve(null);
                    return;
                }
                const requestId = Date.now().toString(36) + Math.random().toString(36).slice(2);
                const timer = setTimeout(function () {
                    window.removeEventListener('message', onMessage);
                    resolve(null);
                }, 60000);
                function onMessage(event) {
                    const data = event.data || {};
                    if (!data || data.type !== 'uivf12-auto-import-ack' || data.requestId !== requestId) return;
                    clearTimeout(timer);
                    window.removeEventListener('message', onMessage);
                    if (data.ok) {
                        resolve({ ok: true, result: data.result || { ok: true } });
                    } else {
                        resolve({ ok: false, error: data.error || 'bridge upload failed', detail: data.detail || null });
                    }
                }
                window.addEventListener('message', onMessage);
                try {
                    window.opener.postMessage({
                        type: 'uivf12-auto-import-dataset',
                        requestId,
                        sessionId: autoImport.sessionId,
                        token: autoImport.token,
                        name: String(name),
                        table,
                        origin: location.origin,
                        groupName: autoImport.groupName || ''
                    }, autoImport.bridgeOrigin);
                } catch (error) {
                    clearTimeout(timer);
                    window.removeEventListener('message', onMessage);
                    resolve(null);
                }
            });
        }
        async function uploadDataset(name, table) {
            const bridgeResult = await uploadViaBridge(name, table);
            if (bridgeResult && bridgeResult.ok) return bridgeResult.result;
            const rows = tableToRows(table);
            try {
                const res = await fetch(autoImport.uploadUrl, {
                    method: 'POST',
                    mode: 'cors',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                        name: String(name),
                        rows,
                        origin: location.origin,
                        groupName: autoImport.groupName || ''
                    })
                });
                const result = await res.json().catch(function () { return {}; });
                if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + (result.error || 'upload failed'));
                return result;
            } catch (err) {
                console.warn('[UIVF12 Auto Import] fetch upload failed:', name, err);
                const detail = {
                    message: bridgeResult && bridgeResult.error ? bridgeResult.error : (err && err.message ? err.message : 'upload failed'),
                    bridgeError: bridgeResult && bridgeResult.error ? bridgeResult.error : '',
                    fetchError: err && err.message ? err.message : '',
                    rowCount: table && Array.isArray(table.values) ? table.values.length : rows.length,
                    headerCount: table && Array.isArray(table.headers) ? table.headers.length : 0,
                    approxBytes: (() => { try { return JSON.stringify(table || {}).length; } catch (e) { return 0; } })()
                };
                const wrapped = new Error(detail.message);
                wrapped.__uivDetail = detail;
                throw wrapped;
            }
        }
        function handleDownloadLink(link) {
            if (!link || !link.download || link.__uivf12DownloadHandled) return;
            link.__uivf12DownloadHandled = true;
            recordDownloadName(link.download);
            const blob = window.__uivf12ObjectUrlBlobs && window.__uivf12ObjectUrlBlobs.get(link.href);
            if (blob) uploadBlob(link.download, blob);
            setTimeout(function () {
                try { delete link.__uivf12DownloadHandled; } catch (e) {}
            }, 1000);
        }
        const bag = readWindowState();
        if (reset) {
            bag.uivf12Downloads = [];
            bag.uivf12AutoImportDatasets = [];
            bag.uivf12AutoImportFailures = [];
            bag.uivf12NoDownloadTasks = [];
            writeWindowState(bag);
        }
        if (!window.__uivf12DownloadRecorderBound) {
            window.__uivf12DownloadRecorderBound = true;
            window.__uivf12ObjectUrlBlobs = window.__uivf12ObjectUrlBlobs || new Map();
            window.__uivf12AutoImportCapture = uploadCsvText;
            const originalCreateObjectURL = URL.createObjectURL;
            URL.createObjectURL = function (value) {
                const url = originalCreateObjectURL.apply(URL, arguments);
                try {
                    if (value instanceof Blob) window.__uivf12ObjectUrlBlobs.set(url, value);
                } catch (e) {}
                return url;
            };
            const originalClick = HTMLAnchorElement.prototype.click;
            HTMLAnchorElement.prototype.click = function () {
                try {
                    handleDownloadLink(this);
                } catch (e) {}
                return originalClick.apply(this, arguments);
            };
            document.addEventListener('click', function (event) {
                try {
                    const link = event.target && event.target.closest ? event.target.closest('a[download]') : null;
                    handleDownloadLink(link);
                } catch (e) {}
            }, true);
            const originalFetch = window.fetch;
            if (typeof originalFetch === 'function') {
                window.fetch = async function () {
                    const started = Date.now();
                    const requestUrl = (() => {
                        try {
                            const input = arguments[0];
                            return typeof input === 'string' ? input : (input && input.url ? input.url : String(input || ''));
                        } catch (e) {
                            return '';
                        }
                    })();
                    try {
                        const response = await originalFetch.apply(this, arguments);
                        try {
                            const contentType = response.headers && response.headers.get ? response.headers.get('content-type') : '';
                            rememberFetchDiagnostic({
                                url: requestUrl,
                                status: response.status,
                                ok: response.ok,
                                redirected: response.redirected,
                                contentType: contentType || '',
                                durationMs: Date.now() - started
                            });
                        } catch (e) {}
                        return response;
                    } catch (error) {
                        rememberFetchDiagnostic({
                            url: requestUrl,
                            status: 'FETCH_ERROR',
                            ok: false,
                            error: error && error.message ? error.message : String(error),
                            durationMs: Date.now() - started
                        });
                        throw error;
                    }
                };
            }
        }
        window.__uivf12AutoImportCapture = uploadCsvText;
        return 'download-recorder-ready';
    })();`;
}

function injectUivAutoImportCapture(code) {
    const source = String(code || '');
    if (source.includes('__uivf12AutoImportCapture')) return source;
    const injection = 'if (window.__uivf12AutoImportCapture) await window.__uivf12AutoImportCapture(finalOutputName, csvContent);\n            ';
    const blobPattern = /const\s+blob\s*=\s*new\s+Blob\s*\(\s*\[\s*csvContent\s*\]\s*,\s*\{\s*type\s*:\s*(['"])text\/csv;charset=utf-8;\1\s*\}\s*\)\s*;/g;
    if (blobPattern.test(source)) {
        return source.replace(blobPattern, injection + '$&');
    }
    const linkPattern = /const\s+link\s*=\s*document\.createElement\s*\(\s*(['"])a\1\s*\)\s*;/;
    if (linkPattern.test(source)) {
        return source.replace(linkPattern, injection + '$&');
    }
    return source;
}

function buildUivAutoImportFlushScript() {
    return `return (async function () {
        try {
            const bridge = window.__uivf12AutoImport;
            const pending = bridge && Array.isArray(bridge.pending) ? bridge.pending.splice(0) : [];
            if (pending.length) await Promise.allSettled(pending);
            return 'auto-import-flushed:' + pending.length;
        } catch (error) {
            return 'auto-import-flush-failed:' + error.message;
        }
    })();`;
}

function buildUivCaptureCountScript() {
    return `return (function () {
        try {
            const parsed = window.name ? JSON.parse(window.name) : {};
            return JSON.stringify({
                downloads: Array.isArray(parsed.uivf12Downloads) ? parsed.uivf12Downloads.length : 0,
                imports: Array.isArray(parsed.uivf12AutoImportDatasets) ? parsed.uivf12AutoImportDatasets.length : 0
            });
        } catch (error) {
            return '{"downloads":0,"imports":0}';
        }
    })();`;
}

function buildUivTaskDownloadAuditScript(taskName, beforeVar, resultVar) {
    return `return (function () {
        function readWindowState() {
            try {
                const parsed = window.name ? JSON.parse(window.name) : {};
                return parsed && typeof parsed === 'object' ? parsed : {};
            } catch (e) {
                return {};
            }
        }
        function parseCounts(raw) {
            try {
                const parsed = JSON.parse(String(raw || '{}'));
                return {
                    downloads: Number.isFinite(Number(parsed.downloads)) ? Number(parsed.downloads) : 0,
                    imports: Number.isFinite(Number(parsed.imports)) ? Number(parsed.imports) : 0
                };
            } catch (e) {
                const fallback = parseInt(String(raw || '0'), 10);
                return { downloads: Number.isFinite(fallback) ? fallback : 0, imports: 0 };
            }
        }
        const before = parseCounts('${' + beforeVar + '}');
        const bag = readWindowState();
        const downloads = Array.isArray(bag.uivf12Downloads) ? bag.uivf12Downloads : [];
        const imports = Array.isArray(bag.uivf12AutoImportDatasets) ? bag.uivf12AutoImportDatasets : [];
        const fetchDiagnostics = Array.isArray(bag.uivf12FetchDiagnostics) ? bag.uivf12FetchDiagnostics : [];
        const after = { downloads: downloads.length, imports: imports.length };
        const downloadDelta = after.downloads - before.downloads;
        const importDelta = after.imports - before.imports;
        if (downloadDelta <= 0 && importDelta <= 0) {
            const list = Array.isArray(bag.uivf12NoDownloadTasks) ? bag.uivf12NoDownloadTasks : [];
            const scriptResult = String('${' + resultVar + '}' || '');
            const recentFetch = fetchDiagnostics.slice(-5).map(item => ({
                url: item && item.url ? String(item.url).slice(0, 260) : '',
                status: item && item.status !== undefined ? item.status : '',
                ok: item && item.ok !== undefined ? item.ok : '',
                redirected: item && item.redirected !== undefined ? item.redirected : '',
                contentType: item && item.contentType ? String(item.contentType).slice(0, 120) : '',
                error: item && item.error ? String(item.error).slice(0, 260) : '',
                durationMs: item && item.durationMs !== undefined ? item.durationMs : '',
                at: item && item.at ? item.at : ''
            }));
            list.push({
                name: ${JSON.stringify(taskName)},
                before: before.downloads,
                after: after.downloads,
                beforeImports: before.imports,
                afterImports: after.imports,
                result: scriptResult || '未检测到下载或自动导入数量增加',
                auditResult: '未检测到下载或自动导入数量增加',
                recentFetch,
                at: new Date().toISOString()
            });
            bag.uivf12NoDownloadTasks = list;
            window.name = JSON.stringify(bag);
            return 'no-download';
        }
        return 'captured:download+' + Math.max(0, downloadDelta) + ',import+' + Math.max(0, importDelta);
    })();`;
}

function buildUivBatchMacro(scriptsToRun, groupName, options = {}) {
    if (scriptsToRun.length === 0) {
        throw new Error(UIVT('uiv.copy.emptyGroup'));
    }

    const speed = UIV_BATCH_SPEEDS.includes(Number(options.speed)) ? Number(options.speed) : getUivBatchSpeed();
    const cooldownMs = getUivCooldownMs(speed);
    const autoImportSessionId = options.autoImportSessionId || makeRunnerId();
    const autoImportToken = options.autoImportToken || makeRunnerId();
    const autoImport = {
        sessionId: autoImportSessionId,
        token: autoImportToken,
        groupName,
        uploadUrl: `${window.location.origin}/api/uiv-auto-import/${autoImportSessionId}/datasets?token=${autoImportToken}`,
        slaUrl: `${window.location.origin}/sla?uivImportSession=${autoImportSessionId}&uivImportToken=${autoImportToken}&autoImport=1`,
        bridgeOrigin: window.location.origin
    };
    const commands = [];
    const usableScripts = scriptsToRun
        .map((script, index) => {
            const resolvedUrl = resolveUivScriptUrl(script);
            return {
                index,
                name: script.name || `Task ${index + 1}`,
                url: resolvedUrl,
                openUrl: getUivOpenUrl(resolvedUrl),
                code: injectUivAutoImportCapture(script.code || '')
            };
        })
        .filter(script => script.openUrl && script.code);

    if (usableScripts.length === 0) {
        throw new Error(UIVT('uiv.copy.noUivBatch'));
    }

    const groupedScripts = groupUivScriptsByOpenUrl(usableScripts);
    const siteStates = groupedScripts.map((group, index) => ({
        label: `${index + 1}. ${group.openUrl}`,
        total: group.scripts.length,
        done: 0,
        status: 'pending'
    }));
    const panelLogs = [];

    function pushPanelCommand(phase, description) {
        if (description) {
            const stamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
            panelLogs.push(`${stamp} ${description}`);
        }
        commands.push({
            Command: 'executeScript',
            Target: buildUivProgressPanelScript({
                groupName,
                phase,
                total: usableScripts.length,
                done: runIndex,
                sites: siteStates,
                logs: panelLogs
            }),
            Value: '',
            Description: 'Render UIVF12 floating progress panel.'
        });
    }

    commands.push({
        Command: 'echo',
        Target: `UIVF12 ${groupName} UI.Vision batch started. Total executable tasks: ${usableScripts.length}. Sites: ${groupedScripts.length}. Speed: ${speed}x. Cooldown: ${cooldownMs}ms`,
        Value: '',
        Description: ''
    }, {
        Command: 'executeScript',
        Target: buildUivDownloadRecorderScript({ reset: true, autoImport }),
        Value: '',
        Description: 'Reset and install UIVF12 download recorder and auto-import bridge.'
    }, {
        Command: 'store',
        Target: '900',
        Value: '!TIMEOUT_WAIT',
        Description: 'Allow long-running capture scripts to finish before UI.Vision marks the command as disconnected.'
    }, {
        Command: 'store',
        Target: '25',
        Value: '!TIMEOUT_PAGELOAD',
        Description: 'Keep site open checks tolerant; enterprise pages may keep loading background resources for minutes.'
    }, {
        Command: 'echo',
        Target: 'Preflight: XModules optional. This batch will not block if XModules are absent or disabled.',
        Value: '',
        Description: ''
    }, {
        Command: 'echo',
        Target: '如未安装或未启用 XModules，将继续执行抓取，文件按浏览器默认规则下载到默认下载目录。',
        Value: '',
        Description: ''
    }, {
        Command: 'echo',
        Target: 'Mac/Windows/Linux 均跳过阻断式本地命令探针，避免因平台命令差异导致批量任务失败。',
        Value: '',
        Description: ''
    });

    let runIndex = 0;
    groupedScripts.forEach((group, groupIndex) => {
        const groupProgress = `${groupIndex + 1}/${groupedScripts.length}`;
        const loginVar = `uivLoginOk_site_${groupIndex + 1}`;
        const loginStatusVar = `uivLoginStatus_site_${groupIndex + 1}`;
        const loginDetailVar = `uivLoginDetail_site_${groupIndex + 1}`;
        const compatVar = `uivLoginCompat_site_${groupIndex + 1}`;
        const isNetcareSite = String(group.openUrl || '').toLowerCase().includes('netcare');
        const siteWarmupMs = String(group.openUrl || '').toLowerCase().includes('netcare') ? 10000 : 5000;
        siteStates[groupIndex].status = 'running';
        if (groupIndex > 0) {
            pushPanelCommand('切换站点', `准备打开 ${group.openUrl}`);
        }
        commands.push(
            { Command: 'echo', Target: `[Site ${groupProgress}] Open ${group.openUrl} and run ${group.scripts.length} task(s)`, Value: '', Description: '' },
            { Command: 'store', Target: 'true', Value: '!ERRORIGNORE', Description: 'Do not fail the batch if a site keeps loading beyond UI.Vision page-load timeout.' },
            { Command: 'open', Target: group.openUrl, Value: '', Description: '' },
            { Command: 'pause', Target: String(siteWarmupMs), Value: '', Description: 'Give the site shell time to initialize even if the load event is noisy.' },
            { Command: 'store', Target: 'false', Value: '!ERRORIGNORE', Description: 'Resume strict error handling after tolerant site open.' },
            { Command: 'executeScript', Target: buildUivDownloadRecorderScript({ autoImport }), Value: '', Description: 'Install UIVF12 download recorder on the current site.' }
        );
        if (isNetcareSite) {
            commands.push(
                { Command: 'executeScript', Target: buildNetcareGlobalConfigCompatScript(), Value: compatVar, Description: 'Normalize NetCare globalConfig for legacy scripts.' },
                { Command: 'echo', Target: `[Site ${groupProgress}] NetCare globalConfig compat: ${'${' + compatVar + '}'}`, Value: '', Description: '' }
            );
        }
        pushPanelCommand('检测登录', `${group.openUrl} 页面已打开，开始检测登录态`);
        commands.push(
            { Command: 'executeScript', Target: group.loginProbe, Value: loginVar, Description: 'Check whether the current platform already has a login token.' },
            { Command: 'executeScript', Target: buildLoginProbeStatusScript(loginVar, group.openUrl), Value: loginStatusVar, Description: 'Normalize login probe result.' },
            { Command: 'executeScript', Target: buildAppendPanelLogScript(loginVar, group.openUrl), Value: loginDetailVar, Description: 'Append login probe detail to floating panel.' },
            { Command: 'echo', Target: `[Site ${groupProgress}] Login probe: ${'${' + loginDetailVar + '}'}`, Value: '', Description: '' },
            { Command: 'while_v2', Target: '${' + loginStatusVar + '} != "true"', Value: '', Description: '' },
            { Command: 'executeScript', Target: `alert("UIVF12 批量任务等待登录：${group.openUrl}\\n\\n该站点共有 ${group.scripts.length} 个任务等待执行。请在当前页面完成登录。UI.Vision 会每 10 秒自动检测一次，检测到登录后继续执行。"); return "waiting-login";`, Value: '', Description: '' },
            { Command: 'pause', Target: '10000', Value: '', Description: '' },
            { Command: 'executeScript', Target: group.loginProbe, Value: loginVar, Description: 'Re-check login token.' },
            { Command: 'executeScript', Target: buildLoginProbeStatusScript(loginVar, group.openUrl), Value: loginStatusVar, Description: 'Normalize login probe result.' },
            { Command: 'executeScript', Target: buildAppendPanelLogScript(loginVar, group.openUrl), Value: loginDetailVar, Description: 'Append login probe detail to floating panel.' },
            { Command: 'echo', Target: `[Site ${groupProgress}] Login probe: ${'${' + loginDetailVar + '}'}`, Value: '', Description: '' },
            { Command: 'endWhile', Target: '', Value: '', Description: '' },
            { Command: 'echo', Target: `[Site ${groupProgress}] Login detected for ${group.openUrl}`, Value: '', Description: '' }
        );
        pushPanelCommand('站点执行中', `${group.openUrl} 已登录，开始执行 ${group.scripts.length} 个任务`);

        group.scripts.forEach(script => {
            const nextRunIndex = runIndex + 1;
            const progress = `${nextRunIndex}/${usableScripts.length}`;
            const resultVar = `uivResult_${nextRunIndex}`;
            const beforeCaptureVar = `uivCaptureBefore_${nextRunIndex}`;
            const auditVar = `uivDownloadAudit_${nextRunIndex}`;
            pushPanelCommand('任务执行中', `开始 ${script.name}`);
            commands.push(
                { Command: 'echo', Target: `[${progress}] Run ${script.name}`, Value: '', Description: '' },
                { Command: 'executeScript', Target: buildUivCaptureCountScript(), Value: beforeCaptureVar, Description: `Record capture count before: ${script.name}` },
                { Command: 'executeScript', Target: script.code, Value: resultVar, Description: `Run UIVF12 script: ${script.name}` },
                { Command: 'pause', Target: '500', Value: '', Description: 'Let download click/import state settle before auditing.' },
                { Command: 'executeScript', Target: buildUivAutoImportFlushScript(), Value: '', Description: 'Wait for UIVF12 auto-import file upload.' },
                { Command: 'executeScript', Target: buildUivTaskDownloadAuditScript(script.name, beforeCaptureVar, resultVar), Value: auditVar, Description: `Audit download result: ${script.name}` },
                { Command: 'echo', Target: `[${progress}] ${script.name} result: ${'${' + resultVar + '}'}`, Value: '', Description: '' },
                { Command: 'echo', Target: `[${progress}] ${script.name} download audit: ${'${' + auditVar + '}'}`, Value: '', Description: '' },
                { Command: 'pause', Target: String(cooldownMs), Value: '', Description: `Cooldown adjusted by UIVF12 speed ${speed}x.` }
            );
            runIndex = nextRunIndex;
            siteStates[groupIndex].done += 1;
            pushPanelCommand('任务完成', `完成 ${script.name}`);
        });
        siteStates[groupIndex].status = 'done';
        pushPanelCommand('站点完成', `${group.openUrl} 站点任务完成`);
    });

    commands.push({
        Command: 'echo',
        Target: `UIVF12 ${groupName} UI.Vision batch finished.`,
        Value: '',
        Description: ''
    });
    pushPanelCommand('全部完成', '全部站点任务完成');
    commands.push({
        Command: 'executeScript',
        Target: buildUivAutoImportFlushScript(),
        Value: '',
        Description: 'Final wait for UIVF12 auto-import uploads.'
    }, {
        Command: 'executeScript',
        Target: buildUivCompletionDialogScript({
            groupName,
            taskCount: usableScripts.length,
            finishedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
            autoImport
        }),
        Value: '',
        Description: 'Show UIVF12 completion summary dialog.'
    });

    return {
        Name: `UIVF12_${groupName}_Batch_UIV_${new Date().toISOString().slice(0, 10)}`,
        CreationDate: new Date().toISOString(),
        Commands: commands
    };
}

function buildAndCopyUivBatchMacro(scriptsToRun, groupName, speed = getUivBatchSpeed()) {
    let macro;
    try {
        macro = buildUivBatchMacro(scriptsToRun, groupName, { speed });
    } catch (error) {
        alert(error.message || UIVT('uiv.copy.emptyGroup'));
        return;
    }

    copyFromMemory(JSON.stringify(macro, null, 2), UIVT('uiv.copy.batchTypeUiv', { group: groupName }));
}

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

async function buildUivRunPayload(macro) {
    const origin = window.location.origin;
    const macroJson = JSON.stringify(macro);
    if (typeof CompressionStream === 'undefined') {
        return { macro, origin };
    }

    const stream = new Blob([macroJson], { type: 'application/json' })
        .stream()
        .pipeThrough(new CompressionStream('gzip'));
    const compressed = await new Response(stream).arrayBuffer();
    return {
        compressedMacro: {
            encoding: 'gzip-base64',
            originalBytes: new Blob([macroJson]).size,
            compressedBytes: compressed.byteLength,
            data: arrayBufferToBase64(compressed)
        },
        origin
    };
}

function makeRunnerId() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function openUivRunnerDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('uivf12-direct-runner', 1);
        request.onupgradeneeded = event => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('runs')) {
                db.createObjectStore('runs', { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('无法打开本地 IndexedDB'));
    });
}

async function saveLocalUivRun(runId, macro) {
    const db = await openUivRunnerDb();
    const payload = {
        id: runId,
        macro,
        origin: window.location.origin,
        createdAt: new Date().toISOString()
    };
    await new Promise((resolve, reject) => {
        const tx = db.transaction('runs', 'readwrite');
        tx.objectStore('runs').put(payload);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error('写入本地 IndexedDB 失败'));
        tx.onabort = () => reject(tx.error || new Error('写入本地 IndexedDB 已中止'));
    });
    db.close();
}

async function openLocalUivRunner(macro) {
    const runId = makeRunnerId();
    await saveLocalUivRun(runId, macro);
    const runnerUrl = `${window.location.origin}/pages/uivision-runner-local.html#${runId}`;
    const opened = window.open(runnerUrl, '_blank');
    if (!opened) {
        showToast('⚠️ 浏览器拦截了启动页弹窗，请允许本站弹窗后重试。', 'error');
    }
    return runnerUrl;
}

async function runAllUivScriptsDirect() {
    try {
        const { scripts } = await API.get('/api/uiv/scripts');
        const speed = getUivBatchSpeed();
        const autoImportSessionId = makeRunnerId();
        const autoImportToken = makeRunnerId();
        const autoImport = {
            sessionId: autoImportSessionId,
            token: autoImportToken,
            groupName: UIVT('uiv.copy.allGroup'),
            uploadUrl: `${window.location.origin}/api/uiv-auto-import/${autoImportSessionId}/datasets?token=${autoImportToken}`
        };
        registerUivAutoImportBridge(autoImport);
        const macro = buildUivBatchMacro(scripts, UIVT('uiv.copy.allGroup'), { speed, autoImportSessionId, autoImportToken });
        const runnerUrl = await openLocalUivRunner(macro);
        showToast('✅ 已打开 UI.Vision 批量阵列启动页：当前浏览器', 'success');
        console.info('[UIVF12 Direct Run]', { mode: 'local-runner', url: runnerUrl, commands: macro.Commands.length, speed });
    } catch (error) {
        showToast(`❌ 直接运行失败：${error.message}`, 'error');
        showUiVisionSetupDialog({ error: error.message });
        console.error('[UIVF12 Direct Run] failed', error);
    }
}

async function runTestUivScriptsDirect() {
    try {
        const { scripts } = await API.get('/api/uiv/scripts');
        const sampledScripts = sampleUivScriptsPerSite(scripts, 2);
        if (!sampledScripts.length) throw new Error(UIVT('uiv.copy.noUivBatch'));
        const speed = getUivBatchSpeed();
        const autoImportSessionId = makeRunnerId();
        const autoImportToken = makeRunnerId();
        const autoImport = {
            sessionId: autoImportSessionId,
            token: autoImportToken,
            groupName: '测试批脚本-每站点2个',
            uploadUrl: `${window.location.origin}/api/uiv-auto-import/${autoImportSessionId}/datasets?token=${autoImportToken}`
        };
        registerUivAutoImportBridge(autoImport);
        const macro = buildUivBatchMacro(sampledScripts, '测试批脚本-每站点2个', { speed, autoImportSessionId, autoImportToken });
        const runnerUrl = await openLocalUivRunner(macro);
        showToast(`✅ 已打开 UI.Vision 测试批脚本：${sampledScripts.length} 个任务`, 'success');
        console.info('[UIVF12 Direct Test Run]', { mode: 'local-runner', url: runnerUrl, commands: macro.Commands.length, speed, scripts: sampledScripts.map(s => s.name) });
    } catch (error) {
        showToast(`❌ 测试批脚本启动失败：${error.message}`, 'error');
        showUiVisionSetupDialog({ error: error.message });
        console.error('[UIVF12 Direct Test Run] failed', error);
    }
}

function showUiVisionSetupDialog(detail = {}) {
    const old = document.getElementById('uivision-setup-dialog');
    if (old) old.remove();
    const overlay = document.createElement('div');
    overlay.id = 'uivision-setup-dialog';
    overlay.style.cssText = [
        'position:fixed',
        'inset:0',
        'z-index:2147483000',
        'display:grid',
        'place-items:center',
        'background:rgba(2,6,23,.66)',
        'backdrop-filter:blur(8px)',
        'padding:20px'
    ].join(';');
    overlay.innerHTML = `
        <div style="width:min(560px,100%);background:#0f172a;border:1px solid rgba(96,165,250,.35);border-radius:14px;box-shadow:0 24px 80px rgba(0,0,0,.38);padding:22px;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px;">
                <div>
                    <div style="font-size:18px;font-weight:800;color:#f8fafc;">需要启用 UI.Vision 环境</div>
                    <div style="font-size:12px;color:#93c5fd;margin-top:4px;">直接运行依赖浏览器插件接管 embedded macro。</div>
                </div>
                <button type="button" onclick="document.getElementById('uivision-setup-dialog').remove()" style="border:0;background:transparent;color:#94a3b8;font-size:22px;cursor:pointer;line-height:1;">×</button>
            </div>
            ${detail.error ? `<div style="font-size:12px;color:#fecaca;background:rgba(239,68,68,.12);border:1px solid rgba(248,113,113,.25);border-radius:8px;padding:9px 10px;margin-bottom:12px;">${String(detail.error).replace(/[<>&]/g, s => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[s]))}</div>` : ''}
            <ol style="margin:0;padding-left:20px;color:#cbd5e1;font-size:13px;line-height:1.75;">
                <li>安装或启用浏览器插件：<a href="https://ui.vision/" target="_blank" rel="noopener" style="color:#67e8f9;font-weight:700;">https://ui.vision/</a></li>
                <li>打开 UI.Vision 插件设置，开启 <b>Allow Command Line</b>。</li>
                <li>开启 <b>Run embedded macros from public websites</b>，并把 <b>${window.location.origin}</b> 加入白名单。</li>
                <li>如需下载后自动移动到指定目录，再在插件设置里安装并启用 <b>XModules</b>；没装也能继续下载到浏览器默认下载目录。</li>
                <li>设置完成后回到本页面，再点一次“🚀 运行批脚本”。</li>
            </ol>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px;">
                <a href="https://ui.vision/" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;justify-content:center;padding:9px 13px;border-radius:8px;background:#2563eb;color:white;text-decoration:none;font-size:13px;font-weight:700;">打开安装页面</a>
                <button type="button" onclick="document.getElementById('uivision-setup-dialog').remove()" style="padding:9px 13px;border-radius:8px;border:1px solid #334155;background:#111827;color:#cbd5e1;cursor:pointer;font-size:13px;">我知道了</button>
            </div>
        </div>
    `;
    overlay.addEventListener('click', event => {
        if (event.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
}

function buildAndCopyMasterScript(scriptsToRun, groupName) {
    if (scriptsToRun.length === 0) { alert(UIVT('uiv.copy.emptyGroup')); return; }

    const taskMeta = scriptsToRun.map((script, index) => {
        let origin = '';
        try {
            origin = new URL(script.url || '').origin;
        } catch (e) {}
        return {
            index,
            name: script.name || `Task ${index + 1}`,
            url: script.url || '',
            origin
        };
    });

    let masterCode = `(async function() {\n    const allTasks = ${JSON.stringify(taskMeta, null, 4)};\n    const currentOrigin = window.location.origin;\n    const runnableTasks = allTasks.filter(task => task.origin && task.origin === currentOrigin);\n    const skippedTasks = allTasks.filter(task => !task.origin || task.origin !== currentOrigin);\n    const originSummary = allTasks.reduce((acc, task) => {\n        const key = task.origin || "未识别URL";\n        acc[key] = (acc[key] || 0) + 1;\n        return acc;\n    }, {});\n\n    console.log("%c🚦 [批量调度·${groupName}] 当前页面: " + currentOrigin, "font-size: 14px; font-weight: bold; color: #38bdf8; background: #0f172a; padding: 6px 10px; border-radius: 6px;");\n    console.table(originSummary);\n\n    if (runnableTasks.length === 0) {\n        console.warn("⏸️ [批量调度·${groupName}] 当前页面没有可执行任务，已暂停。请打开上表中的对应站点后，再把这段脚本粘贴到那个页面的控制台执行。");\n        console.table(allTasks.map(task => ({ name: task.name, origin: task.origin || "未识别URL", url: task.url })));\n        return;\n    }\n\n    console.log("%c🚀 [批量调度·${groupName}] 阵列启动！当前站点匹配 " + runnableTasks.length + " 个任务；另有 " + skippedTasks.length + " 个非当前站点任务已自动跳过。", "font-size: 16px; font-weight: bold; color: #00d2d3; background: #222f3e; padding: 8px 12px; border-radius: 6px; border-left: 5px solid #00d2d3;");\n    if (skippedTasks.length > 0) console.table(skippedTasks.map(task => ({ name: task.name, origin: task.origin || "未识别URL", url: task.url })));\n\n    let completedCount = 0;\n\n`;

    scriptsToRun.forEach((script, index) => {
        const rawName = script.name || `Task ${index + 1}`;
        const safeCommentName = rawName.replace(/[\r\n]+/g, ' ');
        const safeNameLiteral = JSON.stringify(rawName);
        masterCode += `    if (runnableTasks.some(task => task.index === ${index})) {\n        const currentTaskNo = ++completedCount;\n        // ========================================================\n        // 📦 队列 [${index + 1}/${scriptsToRun.length}]: ${safeCommentName}\n        // ========================================================\n        console.log("%c\\n▶️ [调度进度: " + currentTaskNo + "/" + runnableTasks.length + "] 开始注入执行: " + ${safeNameLiteral}, "font-size: 14px; font-weight: bold; color: #feca57; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);")\n\n`;

        let cCode = script.consoleCode || '';
        if (!cCode) masterCode += `        console.error("⚠️ [警告] 该脚本缺少控制台版本的代码，自动跳过！");\n`;
        else {
            cCode = cCode.trim();
            masterCode += (cCode.startsWith('(async') ? `        await ${cCode}\n` : `        ${cCode}\n`);
        }

        masterCode += `\n        if (completedCount < runnableTasks.length) {\n            let delay_${index} = Math.floor(Math.random() * 3000) + 3000;\n            console.log("%c⏳ [调度防刷机制] 正在执行系统冷却... 随机阻断 " + (delay_${index}/1000).toFixed(1) + " 秒...", "color: #95a5a6; font-style: italic; font-size: 12px;");\n            await new Promise(r => setTimeout(r, delay_${index}));\n        }\n    }\n\n`;
    });

    masterCode += `\n    console.log("%c\\n🎉 [批量调度·${groupName}] 当前站点 " + runnableTasks.length + " 个任务执行完毕！如需执行其他站点任务，请打开对应站点后重新粘贴本脚本。", "font-size: 16px; font-weight: bold; color: #1dd1a1; background: #222f3e; padding: 8px 12px; border-radius: 6px; border-left: 5px solid #1dd1a1;");\n})();`;

    copyFromMemory(masterCode, UIVT('uiv.copy.batchType', { group: groupName }));
}

window.UIVCopy = {
    copyCodeText,
    copyFromMemory,
    copyAllConsoleScripts,
    copyAllUivScripts,
    runAllUivScriptsDirect,
    runTestUivScriptsDirect,
    cycleUivBatchSpeed,
    updateUivBatchSpeedButton,
    buildAndCopyMasterScript,
    buildAndCopyUivBatchMacro,
    buildUivBatchMacro
};
window.UIVBatch = window.UIVCopy; // alias

document.addEventListener('DOMContentLoaded', updateUivBatchSpeedButton);
