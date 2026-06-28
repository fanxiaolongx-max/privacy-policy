/**
 * sla/section.js - 表格区块初始化、数据预处理、DOM 渲染
 */

const AppState = {};
window.GlobalMetrics = {};
window.GlobalTargets = {};

// 初始化 GlobalTargets（从服务端加载）
async function initGlobalTargets() {
    try {
        const mode = API.getSourceMode('sla_data');
        const query = mode === 'auto' ? '' : `?mode=${encodeURIComponent(mode)}`;
        window.GlobalTargets = await API.get(`/api/sla/targets${query}`);
        if (window.renderSLASourcePanel) window.renderSLASourcePanel();
    } catch (e) {}
}

function escapeHTML(str) {
    return typeof str === 'string' ? str.replace(/[&<>'"]/g, tag => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'": '&#39;','"':'&quot;'}[tag]||tag)) : str;
}
function getCompatibleVal(row, keys) {
    for (const key of keys) { if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key].toString().trim(); }
    return '';
}
window.escapeHTML = escapeHTML;
window.getCompatibleVal = getCompatibleVal;

// Priority cols and hash fn are accessed via SLAUpload.*

function parseFlexibleDate(value) {
    if (value === undefined || value === null || value === '') return null;
    if (value instanceof Date && !isNaN(value)) return value;
    const raw = String(value).trim();
    if (!raw) return null;
    const normalized = raw
        .replace(/\u00a0/g, ' ')
        .replace(/\./g, '/')
        .replace(/-/g, '/')
        .replace('T', ' ')
        .replace(/Z$/, '');
    const date = new Date(normalized);
    return isNaN(date) ? null : date;
}

function shouldInspectDateCell(columnName, value) {
    const col = String(columnName || '').toLowerCase();
    const raw = String(value || '').trim();
    if (!raw) return false;
    if (/month|year|月份|年度|年份/.test(col)) return false;
    const dateColumn = /(date|time|日期|时间|创建|创单|期望|要求完成|关闭|完成|create|open|close|due|end|completion|plan|start|survey)/i.test(col);
    const concreteDateValue = (
        /\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}/.test(raw) ||
        /\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(raw) ||
        /\d{4}-\d{1,2}-\d{1,2}T\d{1,2}:\d{1,2}/.test(raw)
    );
    return dateColumn && concreteDateValue;
}

function recordDateParseIssue(state, rowIndex, columnName, value, usage) {
    if (!state || value === undefined || value === null || value === '') return;
    if (!state.dateParseIssues) state.dateParseIssues = [];
    if (!state._dateParseIssueKeys) state._dateParseIssueKeys = new Set();
    const raw = String(value).trim();
    if (!raw) return;
    const key = `${rowIndex}@@${raw}`;
    if (state._dateParseIssueKeys.has(key)) return;
    state._dateParseIssueKeys.add(key);
    state.dateParseIssues.push({
        rowNumber: rowIndex + 2,
        column: columnName,
        value: raw,
        usage: usage || '疑似日期字段'
    });
}

function parseDateForSLA(state, rowIndex, columnName, value, usage) {
    const date = parseFlexibleDate(value);
    if (!date) recordDateParseIssue(state, rowIndex, columnName, value, usage);
    return date;
}

function inspectDateLikeCells(state, row, rowIndex) {
    Object.entries(row || {}).forEach(([column, value]) => {
        if (shouldInspectDateCell(column, value) && !parseFlexibleDate(value)) {
            recordDateParseIssue(state, rowIndex, column, value, '疑似日期字段');
        }
    });
}

function buildDateParseWarningHTML(secId) {
    const state = AppState[secId];
    const issues = (state && state.dateParseIssues) || [];
    if (!issues.length) return '';
    const examples = issues.slice(0, 3).map(i => `${escapeHTML(i.column)}=${escapeHTML(i.value)}`).join('；');
    const detail = issues.slice(0, 50).map(i =>
        `<div class="date-warning-row">第 ${i.rowNumber} 行 · ${escapeHTML(i.column)} · ${escapeHTML(i.usage)}<br><code>${escapeHTML(i.value)}</code></div>`
    ).join('');
    const more = issues.length > 50 ? `<div class="date-warning-more">仅展示前 50 条，剩余 ${issues.length - 50} 条请优先检查原始表日期格式。</div>` : '';
    return `
        <div class="date-parse-warning" id="date-warning-${secId}">
            <span class="date-warning-icon">⚠️</span>
            <span><b>发现 ${issues.length} 个日期值未能解析</b>，这些单元格可能影响 SLA/超期判断。建议格式：2026/05/02 19:03 或 2026-05-02 19:03。</span>
            <span class="date-warning-example">示例：${examples}</span>
            <span class="date-warning-help">悬停查看明细</span>
            <div class="date-warning-tooltip">${detail}${more}</div>
        </div>`;
}

function getSRStatus(row) {
    return getCompatibleVal(row, ['sr_status_name']).trim();
}

function isSRClosedStatus(statusText) {
    const status = String(statusText || '').toLowerCase();
    return ['closed', 'resolved', 'canceled', 'cancelled'].some(token => status.includes(token));
}

function isSRPendingStatus(statusText) {
    const status = String(statusText || '').toLowerCase();
    return ['pending', 'suspend', 'suspended', 'hold', '挂起'].some(token => status.includes(token));
}

function getSRSeverity(row) {
    const sev = getCompatibleVal(row, ['hw_sev_name', 'urgency']).toLowerCase();
    if (sev.includes('critical') || sev.includes('schedule action') || sev.includes('immediate action')) return 'critical';
    if (sev.includes('major')) return 'major';
    if (sev.includes('minor')) return 'minor';
    return 'normal';
}

function formatSRDuration(hours) {
    const absHours = Math.abs(Math.ceil(hours || 0));
    if (absHours <= 48) {
        return `${absHours} 小时`;
    }

    const days = Math.ceil(absHours / 24);
    if (days < 7) {
        return `${days} 天`;
    }

    if (days < 30) {
        const weeks = Math.floor(days / 7);
        const remainDays = days % 7;
        return remainDays > 0 ? `${weeks}周${remainDays}天` : `${weeks}周`;
    }

    const months = Math.floor(days / 30);
    const remainDays = days % 30;
    return remainDays > 0 ? `${months}月${remainDays}天` : `${months}月`;
}

async function initSection(secId, mode, title, rawData, themeColor, baseName = '', sourceFiles = []) {
    const RECT_P = SLAUpload.RECT_PRIORITY_COLS, RISK_P = SLAUpload.RISK_PRIORITY_COLS, SPEC_P = SLAUpload.SPECIAL_PRIORITY_COLS, SR_P = SLAUpload.SR_PRIORITY_COLS, VULN_P = SLAUpload.VULN_PRIORITY_COLS;
    let allHeadersSet = new Set();
    rawData.forEach(row => Object.keys(row).forEach(k => allHeadersSet.add(k)));
    const allHeaders = Array.from(allHeadersSet);
    const validHeaders = allHeaders.filter(col => rawData.some(row => row[col] !== undefined && row[col] !== null && row[col].toString().trim() !== ''));

    if (mode === 'rectification' && !validHeaders.includes('task_status')) { alert(`区块 [${title}] 未找到 task_status，跳过渲染。`); return; }
    if (mode === 'risk' && !(validHeaders.includes('风险状态') || validHeaders.includes('risk_status'))) { alert(`区块 [${title}] 未找到风险状态，跳过渲染。`); return; }
    if (mode === 'special' && !(validHeaders.includes('状态-Status') || validHeaders.includes('task_status_en') || validHeaders.includes('task_status') || validHeaders.includes('task_status_cn'))) { alert(`区块 [${title}] 未找到状态列，跳过渲染。`); return; }
    if (mode === 'sr' && !validHeaders.includes('sr_status_name')) { alert(`区块 [${title}] 未找到 sr_status_name，跳过渲染。`); return; }
    if (mode === 'vulnerability' && !validHeaders.includes('task_status')) { alert(`区块 [${title}] 未找到 task_status，跳过渲染。`); return; }
    if (mode === 'vulnerability' && !validHeaders.includes('create_time')) { alert(`区块 [${title}] 未找到 create_time，跳过渲染。`); return; }

    const targetPriorityCols = mode === 'rectification' ? RECT_P : (mode === 'risk' ? RISK_P : (mode === 'special' ? SPEC_P : (mode === 'sr' ? SR_P : (mode === 'vulnerability' ? VULN_P : []))));
    const foundPriorityCols = targetPriorityCols.filter(col => validHeaders.includes(col));
    const otherCols = validHeaders.filter(col => !targetPriorityCols.includes(col));
    if (validHeaders.includes('版本标识') && !foundPriorityCols.includes('版本标识')) {
        foundPriorityCols.unshift('版本标识');
        const idx = otherCols.indexOf('版本标识'); if (idx > -1) otherCols.splice(idx, 1);
    }
    const orderedHeadersLocal = [...foundPriorityCols, ...otherCols];
    const schemaHashStr = (mode === 'other' && baseName) ? 'sla_prefs_other_' + SLAUpload.generateSchemaHash(baseName) : 'sla_prefs_' + mode + '_' + SLAUpload.generateSchemaHash(orderedHeadersLocal.slice().sort().join('|'));

    AppState[secId] = {
        mode, title, schemaHash: schemaHashStr,
        orderedHeaders: orderedHeadersLocal, visibleHeaders: [...orderedHeadersLocal],
        globalData: [], currentDisplayData: [],
        sortKey: null, sortAsc: true, currentFilter: 'all',
        columnWidths: {}, isDraggingColumn: false, draggedHeaderName: null,
        customMetrics: [],
        sourceFiles: Array.from(new Set((Array.isArray(sourceFiles) ? sourceFiles : []).filter(Boolean).map(String)))
    };

    await SLAPrefs.loadPrefs(secId);
    preprocessData(secId, rawData);
    buildDOM(secId, title, themeColor);
    bindEvents(secId);
    updateView(secId);
    evaluateAllMetrics();
}

function preprocessData(secId, rawData) {
    const state = AppState[secId];
    const now = new Date();
    const mode = state.mode;
    state.dateParseIssues = [];
    state._dateParseIssueKeys = new Set();
    state.globalData = rawData.map((row, rowIndex) => {
        let _slaDays = 999999, _slaText = '-', _slaCleanText = '-', _rowClass = '';
        inspectDateLikeCells(state, row, rowIndex);
        if (mode === 'rectification') {
            const status = row['task_status'] ? row['task_status'].toString().trim() : '';
            if (status === 'Checking') {
                const ct = row['task_create_time'];
                if (ct) {
                    const cd = parseDateForSLA(state, rowIndex, 'task_create_time', ct, 'Checking 建单时间');
                    if (cd) {
                        const dl = new Date(cd); dl.setDate(dl.getDate() + 30);
                        _slaDays = Math.ceil((dl - now) / 86400000);
                        const base = `剩余 ${_slaDays} 天`; _slaText = base; _slaCleanText = base;
                        if (_slaDays <= 10) { _rowClass = 'danger-row'; _slaText = `<span class="badge">Checking紧急</span> ${_slaText}`; _slaCleanText = `Checking紧急 (${base})`; }
                        else if (_slaDays < 30) { _rowClass = 'warning-row'; _slaText = `<span class="badge">Checking提醒</span> ${_slaText}`; _slaCleanText = `Checking提醒 (${base})`; }
                    } else { _slaText = '<span style="color:red">解析失败</span>'; }
                }
            } else if (status === 'Rectification Implementation') {
                const ret = row['rectify_plan_end_time'];
                if (ret) {
                    const dl = parseDateForSLA(state, rowIndex, 'rectify_plan_end_time', ret, '整改期望完成时间');
                    if (dl) {
                        _slaDays = Math.ceil((dl - now) / 86400000);
                        const base = `剩余 ${_slaDays} 天`; _slaText = base; _slaCleanText = base;
                        if (_slaDays <= 10) { _rowClass = 'danger-row'; _slaText = `<span class="badge">整改紧急</span> ${_slaText}`; _slaCleanText = `整改紧急 (${base})`; }
                        else if (_slaDays < 82) { _rowClass = 'warning-row'; _slaText = `<span class="badge">整改提醒</span> ${_slaText}`; _slaCleanText = `整改提醒 (${base})`; }
                    } else { _slaText = '<span style="color:red">解析失败</span>'; }
                }
            }
        } else if (mode === 'risk') {
            const status = getCompatibleVal(row, ['风险状态', 'risk_status']);
            if (status === 'Risk Confirming') {
                const ctStr = getCompatibleVal(row, ['创单时间', 'create_time_new', 'create_time']);
                if (ctStr) {
                    const cd = parseDateForSLA(state, rowIndex, '创单时间/create_time', ctStr, '风险确认创单时间');
                    if (cd) {
                        const dl = new Date(cd); dl.setDate(dl.getDate() + 30);
                        _slaDays = Math.ceil((dl - now) / 86400000);
                        const base = `剩余 ${_slaDays} 天`; _slaText = base; _slaCleanText = base;
                        if (_slaDays <= 10) { _rowClass = 'danger-row'; _slaText = `<span class="badge">Confirm紧急</span> ${_slaText}`; _slaCleanText = `Confirm紧急 (${base})`; }
                        else if (_slaDays < 30) { _rowClass = 'warning-row'; _slaText = `<span class="badge badge-risk">Confirm提醒</span> ${_slaText}`; _slaCleanText = `Confirm提醒 (${base})`; }
                    } else { _slaText = '<span style="color:red">解析失败</span>'; }
                }
            } else if (status === 'Risk Open') {
                const ecStr = getCompatibleVal(row, ['期望关闭时间', 'ticket_close_due_date', 'due_time']);
                if (ecStr) {
                    const dl = parseDateForSLA(state, rowIndex, '期望关闭时间/ticket_close_due_date', ecStr, '风险期望关闭时间');
                    if (dl) {
                        _slaDays = Math.ceil((dl - now) / 86400000);
                        const base = `剩余 ${_slaDays} 天`; _slaText = base; _slaCleanText = base;
                        if (_slaDays <= 10) { _rowClass = 'danger-row'; _slaText = `<span class="badge">Open紧急</span> ${_slaText}`; }
                        else if (_slaDays < 30) { _rowClass = 'warning-row'; _slaText = `<span class="badge badge-risk">Open提醒</span> ${_slaText}`; }
                    } else { _slaText = '<span style="color:red">解析失败</span>'; }
                }
            } else if (status === 'Risk Suspended') {
                const ssStr = getCompatibleVal(row, ['期望关闭时间-挂起', 'suspend_due_date']);
                if (ssStr) {
                    const dl = parseDateForSLA(state, rowIndex, '期望关闭时间-挂起/suspend_due_date', ssStr, '挂起期望关闭时间');
                    if (dl) {
                        _slaDays = Math.ceil((dl - now) / 86400000);
                        const base = `剩余 ${_slaDays} 天`; _slaText = base; _slaCleanText = base;
                        if (_slaDays <= 10) { _rowClass = 'danger-row'; _slaText = `<span class="badge">Suspend紧急</span> ${_slaText}`; }
                        else if (_slaDays < 30) { _rowClass = 'warning-row'; _slaText = `<span class="badge badge-risk">Suspend提醒</span> ${_slaText}`; }
                    } else { _slaText = '<span style="color:red">解析失败</span>'; }
                }
            }
        } else if (mode === 'special') {
            const status = getCompatibleVal(row, ['状态-Status', 'task_status_en', 'task_status', 'task_status_cn']);
            if (['待确认','草稿','Draft','To Be Confirmed'].includes(status)) {
                const ctStr = getCompatibleVal(row, ['创建日期-Create Date', 'create_time']);
                if (ctStr) {
                    const cd = parseDateForSLA(state, rowIndex, '创建日期-Create Date/create_time', ctStr, '专项风险创建日期');
                    if (cd) {
                        const dl = new Date(cd); dl.setDate(dl.getDate() + 30);
                        _slaDays = Math.ceil((dl - now) / 86400000);
                        const base = `剩余 ${_slaDays} 天`; _slaText = base; _slaCleanText = base;
                        if (_slaDays <= 10) { _rowClass = 'danger-row'; _slaText = `<span class="badge">确认紧急</span> ${_slaText}`; }
                        else if (_slaDays < 30) { _rowClass = 'warning-row'; _slaText = `<span class="badge badge-special">确认提醒</span> ${_slaText}`; }
                    } else { _slaText = '<span style="color:red">解析失败</span>'; }
                }
            } else if (['处理中','评审中','Processing','Reviewing'].includes(status)) {
                const ecStr = getCompatibleVal(row, ['要求完成日期-Required Completion Date', 'required_completion_time', 'plan_complete_date']);
                if (ecStr) {
                    const dl = parseDateForSLA(state, rowIndex, '要求完成日期/required_completion_time', ecStr, '专项风险要求完成日期');
                    if (dl) {
                        _slaDays = Math.ceil((dl - now) / 86400000);
                        const base = `剩余 ${_slaDays} 天`; _slaText = base; _slaCleanText = base;
                        if (_slaDays <= 10) { _rowClass = 'danger-row'; _slaText = `<span class="badge">处理紧急</span> ${_slaText}`; }
                        else if (_slaDays < 30) { _rowClass = 'warning-row'; _slaText = `<span class="badge badge-special">处理提醒</span> ${_slaText}`; }
                    } else { _slaText = '<span style="color:red">解析失败</span>'; }
                }
            }
        } else if (mode === 'vulnerability') {
            const status = getCompatibleVal(row, ['task_status']);
            const activeStatuses = ['Checking', 'Communication Dept', 'Communication Customer'];
            if (activeStatuses.includes(status)) {
                const ctStr = getCompatibleVal(row, ['create_time', 'task_create_time']);
                if (ctStr) {
                    const cd = parseDateForSLA(state, rowIndex, 'create_time/task_create_time', ctStr, '漏洞建单时间');
                    if (cd) {
                        const dl = new Date(cd);
                        dl.setDate(dl.getDate() + 30);
                        _slaDays = Math.ceil((dl - now) / 86400000);
                        const base = `剩余 ${_slaDays} 天`;
                        _slaText = base;
                        _slaCleanText = base;
                        if (_slaDays <= 10) {
                            _rowClass = 'danger-row';
                            _slaText = `<span class="badge">漏洞紧急</span> ${status} / ${base}`;
                            _slaCleanText = `漏洞紧急 (${status}, ${base})`;
                        } else if (_slaDays < 30) {
                            _rowClass = 'warning-row';
                            _slaText = `<span class="badge badge-risk">漏洞提醒</span> ${status} / ${base}`;
                            _slaCleanText = `漏洞提醒 (${status}, ${base})`;
                        } else {
                            _slaText = `${status} / ${base}`;
                            _slaCleanText = _slaText;
                        }
                    } else {
                        _slaText = '<span style="color:red">create_time 解析失败</span>';
                    }
                } else {
                    _slaText = '<span style="color:red">缺少 create_time</span>';
                }
            }
        } else if (mode === 'sr') {
            const status = getSRStatus(row);
            const overdueFlag = getCompatibleVal(row, ['overdue']).toLowerCase();
            const severity = getSRSeverity(row);
            const openDateRaw = getCompatibleVal(row, ['open_date']);
            const expCloseDateRaw = getCompatibleVal(row, ['exp_close_date']);
            const susExpCloseDateRaw = getCompatibleVal(row, ['sus_exp_close_date', '期望关闭时间-挂起']);
            const actCloseDateRaw = getCompatibleVal(row, ['act_close_date']);
            const openDate = openDateRaw ? parseDateForSLA(state, rowIndex, 'open_date', openDateRaw, 'SR 开单时间') : null;
            const expCloseDate = expCloseDateRaw ? parseDateForSLA(state, rowIndex, 'exp_close_date', expCloseDateRaw, 'SR 期望关单时间') : null;
            const susExpCloseDate = susExpCloseDateRaw ? parseDateForSLA(state, rowIndex, 'sus_exp_close_date', susExpCloseDateRaw, '挂起后期望关单时间') : null;
            const actCloseDate = actCloseDateRaw ? parseDateForSLA(state, rowIndex, 'act_close_date', actCloseDateRaw, 'SR 实际关单时间') : null;
            const isClosed = isSRClosedStatus(status);
            const isPending = isSRPendingStatus(status);

            if (isPending) {
                _slaDays = 999998;
                _slaText = `<span class="badge badge-special">挂起忽略</span> ${status || 'Pending'}`;
                _slaCleanText = `挂起忽略 (${status || 'Pending'})`;
            } else if (isClosed) {
                const isOverdueByStandard = (actCloseDate && expCloseDate && actCloseDate > expCloseDate) || overdueFlag === 'y';
                
                if (isOverdueByStandard) {
                    if (susExpCloseDate) {
                        if (actCloseDate && actCloseDate <= susExpCloseDate) {
                            _slaDays = 999997;
                            _slaText = `<span class="badge badge-special" style="background:#0288d1;color:white;border:none;">挂起后未超期</span> ${status || 'Closed'}`;
                            _slaCleanText = `挂起后未超期 (${status || 'Closed'})`;
                        } else {
                            const overdueHours = (actCloseDate && susExpCloseDate) ? Math.ceil((actCloseDate - susExpCloseDate) / 3600000) : 0;
                            _slaDays = -1;
                            _rowClass = 'danger-row';
                            const overdueText = overdueHours > 0 ? formatSRDuration(overdueHours) : '已触发挂起超期';
                            _slaText = `<span class="badge" style="background:#d32f2f;color:white;border:none;">挂起后超期</span> ${overdueHours > 0 ? `已超 ${overdueText}` : overdueText}`;
                            _slaCleanText = `挂起后超期 (${overdueText})`;
                        }
                    } else {
                        const overdueHours = (actCloseDate && expCloseDate) ? Math.ceil((actCloseDate - expCloseDate) / 3600000) : 0;
                        _slaDays = -1;
                        _rowClass = 'danger-row';
                        const overdueText = overdueHours > 0 ? formatSRDuration(overdueHours) : '已触发上游超期标识';
                        _slaText = `<span class="badge">历史超期</span> ${overdueHours > 0 ? `已超 ${overdueText}` : overdueText}`;
                        _slaCleanText = `历史超期 (${overdueText})`;
                    }
                } else {
                    _slaDays = 999997;
                    _slaText = `<span class="badge badge-special">已关单</span> ${status || 'Closed'}`;
                    _slaCleanText = `已关单 (${status || 'Closed'})`;
                }
            } else if (openDate && expCloseDate) {
                const effectiveExpCloseDate = susExpCloseDate || expCloseDate;
                const totalMs = effectiveExpCloseDate - openDate;
                const consumedMs = now - openDate;
                const remainingMs = effectiveExpCloseDate - now;
                const remainingHours = Math.ceil(remainingMs / 3600000);
                const remainingDays = Math.ceil(remainingMs / 86400000);
                const consumeRate = totalMs > 0 ? (consumedMs / totalMs) * 100 : 100;
                _slaDays = remainingDays;

                row._srStatus = status;
                row._srSeverity = severity;
                row._srConsumeRate = Number.isFinite(consumeRate) ? +consumeRate.toFixed(2) : null;
                row._srRemainingHours = remainingHours;
                row._srRemainingDays = remainingDays;

                if (remainingMs < 0 || overdueFlag === 'y') {
                    _rowClass = 'danger-row';
                    const overdueText = formatSRDuration(Math.abs(remainingHours));
                    _slaText = `<span class="badge">SR超期</span> 已超 ${overdueText}`;
                    _slaCleanText = `SR超期 (${overdueText})`;
                } else if (severity === 'critical') {
                    if (consumeRate > 85 || remainingHours < 12) {
                        _rowClass = 'danger-row';
                        const remainText = formatSRDuration(remainingHours);
                        _slaText = `<span class="badge">Critical高危</span> 剩余 ${remainText} / 消耗 ${consumeRate.toFixed(0)}%`;
                        _slaCleanText = `Critical高危 (${remainText}, ${consumeRate.toFixed(0)}%)`;
                    } else if (consumeRate > 70 && remainingHours < 48) {
                        _rowClass = 'warning-row';
                        const remainText = formatSRDuration(remainingHours);
                        _slaText = `<span class="badge badge-risk">Critical预警</span> 剩余 ${remainText} / 消耗 ${consumeRate.toFixed(0)}%`;
                        _slaCleanText = `Critical预警 (${remainText}, ${consumeRate.toFixed(0)}%)`;
                    } else {
                        const remainText = formatSRDuration(remainingHours);
                        _slaText = `剩余 ${remainText} / 消耗 ${consumeRate.toFixed(0)}%`;
                        _slaCleanText = _slaText;
                    }
                } else {
                    if (consumeRate > 95) {
                        _rowClass = 'danger-row';
                        const remainText = formatSRDuration(remainingHours);
                        _slaText = `<span class="badge">SR高危</span> 剩余 ${remainText} / 消耗 ${consumeRate.toFixed(0)}%`;
                        _slaCleanText = `SR高危 (${remainText}, ${consumeRate.toFixed(0)}%)`;
                    } else if (consumeRate > 80) {
                        _rowClass = 'warning-row';
                        const remainText = formatSRDuration(remainingHours);
                        _slaText = `<span class="badge badge-risk">SR预警</span> 剩余 ${remainText} / 消耗 ${consumeRate.toFixed(0)}%`;
                        _slaCleanText = `SR预警 (${remainText}, ${consumeRate.toFixed(0)}%)`;
                    } else {
                        const remainText = formatSRDuration(remainingHours);
                        _slaText = `剩余 ${remainText} / 消耗 ${consumeRate.toFixed(0)}%`;
                        _slaCleanText = _slaText;
                    }
                }
            } else {
                _slaText = '<span style="color:#ff9800">缺少SLA关键时间</span>';
                _slaCleanText = '缺少SLA关键时间';
                _slaDays = 999996;
            }
        }
        if (_slaText.includes('解析失败')) _slaDays = -999999;
        const cleanValuesArr = Object.values(row).map(v => v != null ? v.toString().replace(/[\r\n]+/g, ' ') : '');
        return { ...row, _slaDays, _slaText, _slaCleanText, _rowClass, _rawStringForSearch: cleanValuesArr.join('|||').toLowerCase() };
    });
    delete state._dateParseIssueKeys;
}

function buildDOM(secId, title, themeColor) {
    const tt = window.SLAT || ((key) => key);
    const sourceFiles = (AppState[secId] && Array.isArray(AppState[secId].sourceFiles)) ? AppState[secId].sourceFiles : [];
    const sourceFileText = sourceFiles.join('；');
    const sourceFileHtml = sourceFiles.length
        ? `<span class="section-source-files" title="${escapeHTML(sourceFileText)}">导入文件：${escapeHTML(sourceFileText)}</span>`
        : '';
    const html = `
    <div class="section-card" id="section-${secId}">
        <div class="section-header">
            <h3 class="section-title" style="color:${themeColor}">
                ${title} <span style="font-size:12px;color:#888;font-weight:normal;" id="row-count-badge-${secId}"></span>
                ${sourceFileHtml}
                <span class="rule-summary-badge" id="rule-summary-badge-${secId}" title="${tt('sla.section.noRulesTitle')}">${tt('sla.section.ruleSummary', { main: 0, sub: 0 })}</span>
            </h3>
        </div>
        <div class="dashboard-panel" id="dashboard-${secId}" style="display:none;"></div>
        ${buildDateParseWarningHTML(secId)}
        <div class="toolbar" id="toolbar-${secId}">
            <div class="filter-group">
                <button class="filter-btn active" data-sec="${secId}" data-filter="all">${tt('sla.section.all')}</button>
                ${AppState[secId].mode !== 'other' ? `<button class="filter-btn" data-sec="${secId}" data-filter="focus">${tt('sla.section.focus')}</button>
                <button class="filter-btn" data-sec="${secId}" data-filter="danger">${tt('sla.section.danger')}</button>
                <button class="filter-btn" data-sec="${secId}" data-filter="warning">${tt('sla.section.warning')}</button>` : ''}
            </div>
            <div class="search-container">
                <input type="text" id="search-${secId}" class="search-box" placeholder="${tt('sla.section.searchPh')}">
                <button id="settings-btn-${secId}" class="action-btn settings-btn">${tt('sla.section.columns')}</button>
                <button id="copy-btn-${secId}" class="action-btn copy-btn">${tt('sla.section.copyUnique')}</button>
                <button id="metrics-btn-${secId}" class="action-btn metrics-btn">${tt('sla.section.metrics')}</button>
                <button id="export-btn-${secId}" class="action-btn export-btn">${tt('sla.section.export')}</button>
                <div id="column-picker-${secId}" class="dropdown-menu" style="right:250px;width:220px;">
                    <div class="picker-header">
                        <input type="text" id="p-search-${secId}" class="picker-search" placeholder="${tt('sla.section.filterColumnsPh')}">
                        <div class="picker-actions">
                            <button id="p-all-${secId}" class="picker-action-btn">${tt('sla.section.selectAll')}</button>
                            <button id="p-none-${secId}" class="picker-action-btn">${tt('sla.section.clear')}</button>
                        </div>
                    </div>
                    <div id="p-list-${secId}" class="picker-list"></div>
                </div>
                <div id="copy-picker-${secId}" class="dropdown-menu" style="right:170px;width:240px;border-color:#ffb74d;">
                    <div class="picker-header" style="background:#fff8e1;border-bottom:1px solid #ffe0b2;">
                        <div style="color:#e65100;font-size:12px;font-weight:bold;margin-bottom:6px;">${tt('sla.section.copyHint')}</div>
                        <input type="text" id="c-search-${secId}" class="picker-search" placeholder="${tt('sla.section.copySearchPh')}" style="border-color:#ffb74d;">
                    </div>
                    <div id="c-list-${secId}" class="picker-list" style="padding:0;"></div>
                </div>
                <div id="metrics-picker-${secId}" class="dropdown-menu" style="right:80px;width:340px;padding:12px;border-color:#9c27b0;max-height:450px;overflow-y:auto;">
                    <div style="font-weight:bold;color:#8e44ad;font-size:12px;margin-bottom:8px;border-bottom:1px solid #f3e5f5;padding-bottom:5px;">${tt('sla.section.metricHint')}</div>
                    
                    <div style="margin-bottom:8px; display:flex; gap:10px; font-size:12px;">
                        <label><input type="radio" name="m-type-${secId}" value="extract" checked onclick="document.getElementById('m-extract-config-${secId}').style.display='block'; document.getElementById('m-count-config-${secId}').style.display='none';"> ${tt('sla.section.extractOne')}</label>
                        <label><input type="radio" name="m-type-${secId}" value="count" onclick="document.getElementById('m-extract-config-${secId}').style.display='none'; document.getElementById('m-count-config-${secId}').style.display='block';"> ${tt('sla.section.countTimes')}</label>
                        <label><input type="radio" name="m-type-${secId}" value="ratio" onclick="document.getElementById('m-extract-config-${secId}').style.display='none'; document.getElementById('m-count-config-${secId}').style.display='block';"> ${tt('sla.section.countRatio')}</label>
                    </div>

                    <!-- 提取模式 -->
                    <div id="m-extract-config-${secId}">
                        <select id="m-colx-${secId}" class="picker-search" style="margin-bottom:6px;cursor:pointer;"><option value="">${tt('sla.section.colXOption')}</option></select>
                        <input type="text" id="m-valy-${secId}" class="picker-search" placeholder="${tt('sla.section.valYPh')}" style="margin-bottom:6px;">
                        <select id="m-colz-${secId}" class="picker-search" style="margin-bottom:6px;cursor:pointer;"><option value="">${tt('sla.section.colZOption')}</option></select>
                    </div>

                    <!-- 统计模式/占比模式 -->
                    <div id="m-count-config-${secId}" style="display:none;">
                        <select id="m-c-colx-${secId}" class="picker-search" style="margin-bottom:6px;cursor:pointer;"><option value="">${tt('sla.section.countXOption')}</option></select>
                        <input type="text" id="m-c-valy-${secId}" class="picker-search" placeholder="${tt('sla.section.countYPh')}" style="margin-bottom:6px;">
                        <select id="m-c-colz-${secId}" class="picker-search" style="margin-bottom:6px;cursor:pointer;"><option value="">${tt('sla.section.countZOption')}</option></select>
                        <input type="text" id="m-c-valk-${secId}" class="picker-search" placeholder="${tt('sla.section.countKPh')}" style="margin-bottom:6px;">
                    </div>

                    <div id="m-label-container-${secId}" style="display:flex;gap:6px;margin-bottom:8px;">
                        <input type="text" id="m-label-${secId}" class="picker-search" placeholder="${tt('sla.section.metricNamePh')}" style="margin-bottom:0;flex:1;">
                        <select id="m-color-${secId}" class="picker-search" style="margin-bottom:0;width:80px;cursor:pointer;">
                            <option value="">${tt('sla.section.color')}</option><option value="success">${tt('sla.section.green')}</option>
                            <option value="danger">${tt('sla.section.red')}</option><option value="warn">${tt('sla.section.yellow')}</option>
                        </select>
                    </div>
                    
                    <div style="display:flex;gap:6px;margin-bottom:8px;">
                        <select id="m-parent-${secId}" class="picker-search" style="margin-bottom:0;flex:1;cursor:pointer;" onchange="document.getElementById('m-cat-${secId}').style.display = this.value ? 'block' : 'none'; document.getElementById('m-label-container-${secId}').style.display = this.value ? 'none' : 'flex';">
                            <option value="">${tt('sla.section.mainMetric')}</option>
                        </select>
                        <select id="m-cat-${secId}" class="picker-search" style="margin-bottom:0;width:90px;cursor:pointer;display:none;">
                            <option value="">${tt('sla.section.chooseCategory')}</option>
                        </select>
                    </div>

                    <button id="add-metric-btn-${secId}" style="width:100%;padding:6px;background:#8e44ad;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">${tt('sla.section.saveRule')}</button>
                    <div id="m-list-${secId}" style="margin-top:10px;border-top:1px dashed #eee;padding-top:8px;"></div>
                </div>
            </div>
        </div>
        <div id="table-container-${secId}" class="table-wrapper"></div>
    </div>`;
    document.getElementById('main-wrapper').insertAdjacentHTML('beforeend', html);
}

window.SLASection = { initSection, preprocessData, buildDOM, AppState, initGlobalTargets };
window.AppState = AppState;
