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

async function initSection(secId, mode, title, rawData, themeColor, baseName = '') {
    const RECT_P = SLAUpload.RECT_PRIORITY_COLS, RISK_P = SLAUpload.RISK_PRIORITY_COLS, SPEC_P = SLAUpload.SPECIAL_PRIORITY_COLS;
    let allHeadersSet = new Set();
    rawData.forEach(row => Object.keys(row).forEach(k => allHeadersSet.add(k)));
    const allHeaders = Array.from(allHeadersSet);
    const validHeaders = allHeaders.filter(col => rawData.some(row => row[col] !== undefined && row[col] !== null && row[col].toString().trim() !== ''));

    if (mode === 'rectification' && !validHeaders.includes('task_status')) { alert(`区块 [${title}] 未找到 task_status，跳过渲染。`); return; }
    if (mode === 'risk' && !(validHeaders.includes('风险状态') || validHeaders.includes('risk_status'))) { alert(`区块 [${title}] 未找到风险状态，跳过渲染。`); return; }
    if (mode === 'special' && !(validHeaders.includes('状态-Status') || validHeaders.includes('task_status_en') || validHeaders.includes('task_status') || validHeaders.includes('task_status_cn'))) { alert(`区块 [${title}] 未找到状态列，跳过渲染。`); return; }

    const targetPriorityCols = mode === 'rectification' ? RECT_P : (mode === 'risk' ? RISK_P : (mode === 'special' ? SPEC_P : []));
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
        customMetrics: []
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
    state.globalData = rawData.map(row => {
        let _slaDays = 999999, _slaText = '-', _slaCleanText = '-', _rowClass = '';
        if (mode === 'rectification') {
            const status = row['task_status'] ? row['task_status'].toString().trim() : '';
            if (status === 'Checking') {
                const ct = row['task_create_time'];
                if (ct) {
                    const cd = new Date(ct.toString().replace(/-/g, '/'));
                    if (!isNaN(cd)) {
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
                    const dl = new Date(ret.toString().replace(/-/g, '/'));
                    if (!isNaN(dl)) {
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
                    const cd = new Date(ctStr.replace(/-/g, '/'));
                    if (!isNaN(cd)) {
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
                    const dl = new Date(ecStr.replace(/-/g, '/'));
                    if (!isNaN(dl)) {
                        _slaDays = Math.ceil((dl - now) / 86400000);
                        const base = `剩余 ${_slaDays} 天`; _slaText = base; _slaCleanText = base;
                        if (_slaDays <= 10) { _rowClass = 'danger-row'; _slaText = `<span class="badge">Open紧急</span> ${_slaText}`; }
                        else if (_slaDays < 30) { _rowClass = 'warning-row'; _slaText = `<span class="badge badge-risk">Open提醒</span> ${_slaText}`; }
                    } else { _slaText = '<span style="color:red">解析失败</span>'; }
                }
            } else if (status === 'Risk Suspended') {
                const ssStr = getCompatibleVal(row, ['期望关闭时间-挂起', 'suspend_due_date']);
                if (ssStr) {
                    const dl = new Date(ssStr.replace(/-/g, '/'));
                    if (!isNaN(dl)) {
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
                    const cd = new Date(ctStr.replace(/-/g, '/'));
                    if (!isNaN(cd)) {
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
                    const dl = new Date(ecStr.replace(/-/g, '/'));
                    if (!isNaN(dl)) {
                        _slaDays = Math.ceil((dl - now) / 86400000);
                        const base = `剩余 ${_slaDays} 天`; _slaText = base; _slaCleanText = base;
                        if (_slaDays <= 10) { _rowClass = 'danger-row'; _slaText = `<span class="badge">处理紧急</span> ${_slaText}`; }
                        else if (_slaDays < 30) { _rowClass = 'warning-row'; _slaText = `<span class="badge badge-special">处理提醒</span> ${_slaText}`; }
                    } else { _slaText = '<span style="color:red">解析失败</span>'; }
                }
            }
        }
        if (_slaText.includes('解析失败')) _slaDays = -999999;
        const cleanValuesArr = Object.values(row).map(v => v != null ? v.toString().replace(/[\r\n]+/g, ' ') : '');
        return { ...row, _slaDays, _slaText, _slaCleanText, _rowClass, _rawStringForSearch: cleanValuesArr.join('|||').toLowerCase() };
    });
}

function buildDOM(secId, title, themeColor) {
    const html = `
    <div class="section-card" id="section-${secId}">
        <div class="section-header">
            <h3 class="section-title" style="color:${themeColor}">
                ${title} <span style="font-size:12px;color:#888;font-weight:normal;" id="row-count-badge-${secId}"></span>
            </h3>
        </div>
        <div class="dashboard-panel" id="dashboard-${secId}" style="display:none;"></div>
        <div class="toolbar" id="toolbar-${secId}">
            <div class="filter-group">
                <button class="filter-btn active" data-sec="${secId}" data-filter="all">全部数据</button>
                ${AppState[secId].mode !== 'other' ? `<button class="filter-btn" data-sec="${secId}" data-filter="focus">🔥 重点关注</button>
                <button class="filter-btn" data-sec="${secId}" data-filter="danger">🔴 紧急</button>
                <button class="filter-btn" data-sec="${secId}" data-filter="warning">🟠 提醒</button>` : ''}
            </div>
            <div class="search-container">
                <input type="text" id="search-${secId}" class="search-box" placeholder="🔍 当前表内搜索...">
                <button id="settings-btn-${secId}" class="action-btn settings-btn">⚙️ 列设置 ▼</button>
                <button id="copy-btn-${secId}" class="action-btn copy-btn">📋 提取去重 ▼</button>
                <button id="metrics-btn-${secId}" class="action-btn metrics-btn">🎯 指标 ▼</button>
                <button id="export-btn-${secId}" class="action-btn export-btn">📥 导出</button>
                <div id="column-picker-${secId}" class="dropdown-menu" style="right:250px;width:220px;">
                    <div class="picker-header">
                        <input type="text" id="p-search-${secId}" class="picker-search" placeholder="过滤列名...">
                        <div class="picker-actions">
                            <button id="p-all-${secId}" class="picker-action-btn">全选</button>
                            <button id="p-none-${secId}" class="picker-action-btn">清空</button>
                        </div>
                    </div>
                    <div id="p-list-${secId}" class="picker-list"></div>
                </div>
                <div id="copy-picker-${secId}" class="dropdown-menu" style="right:170px;width:240px;border-color:#ffb74d;">
                    <div class="picker-header" style="background:#fff8e1;border-bottom:1px solid #ffe0b2;">
                        <div style="color:#e65100;font-size:12px;font-weight:bold;margin-bottom:6px;">点选列名进行去重提取：</div>
                        <input type="text" id="c-search-${secId}" class="picker-search" placeholder="🔍 搜索提取列名..." style="border-color:#ffb74d;">
                    </div>
                    <div id="c-list-${secId}" class="picker-list" style="padding:0;"></div>
                </div>
                <div id="metrics-picker-${secId}" class="dropdown-menu" style="right:80px;width:340px;padding:12px;border-color:#9c27b0;max-height:450px;overflow-y:auto;">
                    <div style="font-weight:bold;color:#8e44ad;font-size:12px;margin-bottom:8px;border-bottom:1px solid #f3e5f5;padding-bottom:5px;">📌 配置顶部悬浮指标推送规则：</div>
                    
                    <div style="margin-bottom:8px; display:flex; gap:10px; font-size:12px;">
                        <label><input type="radio" name="m-type-${secId}" value="extract" checked onclick="document.getElementById('m-extract-config-${secId}').style.display='block'; document.getElementById('m-count-config-${secId}').style.display='none';"> 提取单行数值</label>
                        <label><input type="radio" name="m-type-${secId}" value="count" onclick="document.getElementById('m-extract-config-${secId}').style.display='none'; document.getElementById('m-count-config-${secId}').style.display='block';"> 统计满足次数</label>
                        <label><input type="radio" name="m-type-${secId}" value="ratio" onclick="document.getElementById('m-extract-config-${secId}').style.display='none'; document.getElementById('m-count-config-${secId}').style.display='block';"> 统计占比</label>
                    </div>

                    <!-- 提取模式 -->
                    <div id="m-extract-config-${secId}">
                        <select id="m-colx-${secId}" class="picker-search" style="margin-bottom:6px;cursor:pointer;"><option value="">1. 当此列(X)...</option></select>
                        <input type="text" id="m-valy-${secId}" class="picker-search" placeholder="2. 包含内容(Y) (支持[空]/[非空])" style="margin-bottom:6px;">
                        <select id="m-colz-${secId}" class="picker-search" style="margin-bottom:6px;cursor:pointer;"><option value="">3. 则提取该行此列(Z)的值</option></select>
                    </div>

                    <!-- 统计模式/占比模式 -->
                    <div id="m-count-config-${secId}" style="display:none;">
                        <select id="m-c-colx-${secId}" class="picker-search" style="margin-bottom:6px;cursor:pointer;"><option value="">1. 筛选条件列(X)... (选填)</option></select>
                        <input type="text" id="m-c-valy-${secId}" class="picker-search" placeholder="2. 筛选X列含内容(Y) (支持[空]/[非空])" style="margin-bottom:6px;">
                        <select id="m-c-colz-${secId}" class="picker-search" style="margin-bottom:6px;cursor:pointer;"><option value="">3. 目标统计列(Z)</option></select>
                        <input type="text" id="m-c-valk-${secId}" class="picker-search" placeholder="4. Z列含关键字(K) (支持[空]/[非空])" style="margin-bottom:6px;">
                    </div>

                    <div id="m-label-container-${secId}" style="display:flex;gap:6px;margin-bottom:8px;">
                        <input type="text" id="m-label-${secId}" class="picker-search" placeholder="指标展示名称" style="margin-bottom:0;flex:1;">
                        <select id="m-color-${secId}" class="picker-search" style="margin-bottom:0;width:80px;cursor:pointer;">
                            <option value="">颜色</option><option value="success">绿(好)</option>
                            <option value="danger">红(危)</option><option value="warn">黄(警)</option>
                        </select>
                    </div>
                    
                    <div style="display:flex;gap:6px;margin-bottom:8px;">
                        <select id="m-parent-${secId}" class="picker-search" style="margin-bottom:0;flex:1;cursor:pointer;" onchange="document.getElementById('m-cat-${secId}').style.display = this.value ? 'block' : 'none'; document.getElementById('m-label-container-${secId}').style.display = this.value ? 'none' : 'flex';">
                            <option value="">作为主指标独立展示</option>
                        </select>
                        <select id="m-cat-${secId}" class="picker-search" style="margin-bottom:0;width:90px;cursor:pointer;display:none;">
                            <option value="">选择分类</option>
                        </select>
                    </div>

                    <button id="add-metric-btn-${secId}" style="width:100%;padding:6px;background:#8e44ad;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">➕ 保存规则</button>
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
