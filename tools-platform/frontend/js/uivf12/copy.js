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
    btn.textContent = speed + 'x';
    btn.title = `当前 ${speed} 倍速：脚本间隔约 ${getUivCooldownMs(speed) / 1000} 秒。点击切换 1x / 2x / 4x。`;
}

function cycleUivBatchSpeed() {
    const current = getUivBatchSpeed();
    const next = UIV_BATCH_SPEEDS[(UIV_BATCH_SPEEDS.indexOf(current) + 1) % UIV_BATCH_SPEEDS.length];
    localStorage.setItem(UIV_BATCH_SPEED_KEY, String(next));
    updateUivBatchSpeedButton();
    showToast(`UI.Vision 批量速度已切换为 ${next}x，脚本间隔约 ${getUivCooldownMs(next) / 1000} 秒`, 'success');
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

function inferUivDownloadFiles(scriptCode) {
    const code = String(scriptCode || '');
    const outputMatch = code.match(/let\s+finalOutputName\s*=\s*"([^"]+)"/);
    const baseName = outputMatch ? outputMatch[1] : '';
    if (!baseName) return [];
    const hasRuntimeMonth = code.includes('runConfigs = [') && code.includes('currentYear') && code.includes('prevYear');
    if (!hasRuntimeMonth) return [baseName];

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth() + 1;
    const pad = n => String(n).padStart(2, '0');
    return [
        baseName.replace('.csv', `_${currentYear}年${pad(currentMonth)}月.csv`),
        baseName.replace('.csv', `_${prevYear}年${pad(prevMonth)}月.csv`)
    ];
}

function buildLoginProbeScript(rawUrl) {
    const lowerUrl = String(rawUrl || '').toLowerCase();
    if (lowerUrl.includes('datafab')) {
        return 'return (document.cookie.indexOf("XSRF-TOKEN=") !== -1 || document.cookie.indexOf("NETLIVE-XSRF-TOKEN=") !== -1) ? "true" : "false";';
    }
    if (lowerUrl.includes('netcare')) {
        return 'return localStorage.getItem("globalConfig") ? "true" : "false";';
    }
    return 'return (document.cookie || localStorage.length > 0) ? "true" : "false";';
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
        const fileRows = summary.files.map((name, index) =>
            '<div style="display:flex;gap:10px;align-items:flex-start;padding:7px 0;border-bottom:1px solid rgba(148,163,184,.12);">' +
                '<span style="color:#67e8f9;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;width:34px;">#' + String(index + 1).padStart(2, '0') + '</span>' +
                '<span style="word-break:break-all;color:#f8fafc;">' + String(name).replace(/[<>&]/g, ch => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[ch])) + '</span>' +
            '</div>'
        ).join('');
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
                        '<div style="border:1px solid rgba(103,232,249,.18);border-radius:10px;padding:10px;background:rgba(8,47,73,.28);"><div style="font-size:10px;color:#7dd3fc;text-transform:uppercase;">预计文件</div><div style="font-size:22px;font-weight:900;">' + summary.fileCount + '</div></div>' +
                        '<div style="border:1px solid rgba(103,232,249,.18);border-radius:10px;padding:10px;background:rgba(8,47,73,.28);"><div style="font-size:10px;color:#7dd3fc;text-transform:uppercase;">下载位置</div><div style="font-size:12px;font-weight:800;color:#fef3c7;margin-top:7px;">浏览器默认下载目录</div></div>' +
                    '</div>' +
                    '<div style="font-size:12px;color:#cbd5e1;margin-bottom:10px;">实际路径取决于本机浏览器下载设置。网页无法读取真实本机下载路径；未启用 XModules 时通常是 Downloads 文件夹。</div>' +
                    '<div style="max-height:280px;overflow:auto;border:1px solid rgba(148,163,184,.16);border-radius:10px;padding:4px 12px;background:rgba(2,6,23,.34);">' + (fileRows || '<div style="padding:12px;color:#94a3b8;">未识别到文件名</div>') + '</div>' +
                '</div>' +
            '</div>';
        overlay.querySelector('#uivf12-completion-close').onclick = () => overlay.remove();
        overlay.addEventListener('click', event => { if (event.target === overlay) overlay.remove(); });
        document.documentElement.appendChild(overlay);
        return 'completion-shown';
    })();`;
}

function buildUivBatchMacro(scriptsToRun, groupName, options = {}) {
    if (scriptsToRun.length === 0) {
        throw new Error(UIVT('uiv.copy.emptyGroup'));
    }

    const speed = UIV_BATCH_SPEEDS.includes(Number(options.speed)) ? Number(options.speed) : getUivBatchSpeed();
    const cooldownMs = getUivCooldownMs(speed);
    const commands = [];
    const usableScripts = scriptsToRun
        .map((script, index) => {
            const resolvedUrl = resolveUivScriptUrl(script);
            return {
                index,
                name: script.name || `Task ${index + 1}`,
                url: resolvedUrl,
                openUrl: getUivOpenUrl(resolvedUrl),
                code: script.code || '',
                downloadFiles: inferUivDownloadFiles(script.code || '')
            };
        })
        .filter(script => script.openUrl && script.code);

    if (usableScripts.length === 0) {
        throw new Error(UIVT('uiv.copy.noUivBatch'));
    }

    const groupedScripts = groupUivScriptsByOpenUrl(usableScripts);
    const downloadFiles = usableScripts.flatMap(script => script.downloadFiles || []);
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
        Command: 'store',
        Target: '900',
        Value: '!TIMEOUT_WAIT',
        Description: 'Allow long-running capture scripts to finish before UI.Vision marks the command as disconnected.'
    }, {
        Command: 'store',
        Target: '120',
        Value: '!TIMEOUT_PAGELOAD',
        Description: 'Allow slower enterprise pages to load before continuing.'
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
        siteStates[groupIndex].status = 'running';
        if (groupIndex > 0) {
            pushPanelCommand('切换站点', `准备打开 ${group.openUrl}`);
        }
        commands.push(
            { Command: 'echo', Target: `[Site ${groupProgress}] Open ${group.openUrl} and run ${group.scripts.length} task(s)`, Value: '', Description: '' },
            { Command: 'open', Target: group.openUrl, Value: '', Description: '' },
            { Command: 'waitForPageToLoad', Target: '30000', Value: '', Description: '' },
            { Command: 'pause', Target: '3000', Value: '', Description: '' }
        );
        pushPanelCommand('检测登录', `${group.openUrl} 页面已打开，开始检测登录态`);
        commands.push(
            { Command: 'executeScript', Target: group.loginProbe, Value: loginVar, Description: 'Check whether the current platform already has a login token.' },
            { Command: 'while_v2', Target: '${' + loginVar + '} != "true"', Value: '', Description: '' },
            { Command: 'executeScript', Target: `alert("UIVF12 批量任务等待登录：${group.openUrl}\\n\\n该站点共有 ${group.scripts.length} 个任务等待执行。请在当前页面完成登录。UI.Vision 会每 10 秒自动检测一次，检测到登录后继续执行。"); return "waiting-login";`, Value: '', Description: '' },
            { Command: 'pause', Target: '10000', Value: '', Description: '' },
            { Command: 'executeScript', Target: group.loginProbe, Value: loginVar, Description: 'Re-check login token.' },
            { Command: 'endWhile', Target: '', Value: '', Description: '' },
            { Command: 'echo', Target: `[Site ${groupProgress}] Login detected for ${group.openUrl}`, Value: '', Description: '' }
        );
        pushPanelCommand('站点执行中', `${group.openUrl} 已登录，开始执行 ${group.scripts.length} 个任务`);

        group.scripts.forEach(script => {
            const nextRunIndex = runIndex + 1;
            const progress = `${nextRunIndex}/${usableScripts.length}`;
            const resultVar = `uivResult_${nextRunIndex}`;
            pushPanelCommand('任务执行中', `开始 ${script.name}`);
            commands.push(
                { Command: 'echo', Target: `[${progress}] Run ${script.name}`, Value: '', Description: '' },
                { Command: 'executeScript', Target: script.code, Value: resultVar, Description: `Run UIVF12 script: ${script.name}` },
                { Command: 'echo', Target: `[${progress}] ${script.name} result: ${'${' + resultVar + '}'}`, Value: '', Description: '' },
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
        Target: buildUivCompletionDialogScript({
            groupName,
            taskCount: usableScripts.length,
            fileCount: downloadFiles.length,
            files: downloadFiles,
            finishedAt: new Date().toLocaleString('zh-CN', { hour12: false })
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
    const opened = window.open(runnerUrl, '_blank', 'noopener');
    if (!opened) {
        showToast('⚠️ 浏览器拦截了启动页弹窗，请允许本站弹窗后重试。', 'error');
    }
    return runnerUrl;
}

async function runAllUivScriptsDirect() {
    try {
        const { scripts } = await API.get('/api/uiv/scripts');
        const speed = getUivBatchSpeed();
        const macro = buildUivBatchMacro(scripts, UIVT('uiv.copy.allGroup'), { speed });
        const runnerUrl = await openLocalUivRunner(macro);
        showToast('✅ 已打开 UI.Vision 批量阵列启动页：当前浏览器', 'success');
        console.info('[UIVF12 Direct Run]', { mode: 'local-runner', url: runnerUrl, commands: macro.Commands.length, speed });
    } catch (error) {
        showToast(`❌ 直接运行失败：${error.message}`, 'error');
        showUiVisionSetupDialog({ error: error.message });
        console.error('[UIVF12 Direct Run] failed', error);
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
    cycleUivBatchSpeed,
    updateUivBatchSpeedButton,
    buildAndCopyMasterScript,
    buildAndCopyUivBatchMacro,
    buildUivBatchMacro
};
window.UIVBatch = window.UIVCopy; // alias

document.addEventListener('DOMContentLoaded', updateUivBatchSpeedButton);
