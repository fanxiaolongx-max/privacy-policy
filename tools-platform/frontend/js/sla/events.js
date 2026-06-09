/**
 * sla/events.js - 工具条事件绑定：列设置、去重提取、指标配置
 */

function bindEvents(secId) {
    const wrapper = document.getElementById(`section-${secId}`);
    const state = AppState[secId];

    wrapper.querySelector(`#search-${secId}`).addEventListener('input', () => updateView(secId));
    wrapper.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            wrapper.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active'); state.currentFilter = this.dataset.filter; updateView(secId);
        });
    });

    const elevateZ = (targetPicker) => {
        document.querySelectorAll('.section-card').forEach(c => c.style.zIndex = '1');
        wrapper.style.zIndex = '100';
        wrapper.querySelectorAll('.dropdown-menu').forEach(m => { if (m !== targetPicker) m.classList.remove('show'); });
        targetPicker.classList.toggle('show');
    };

    // 列设置
    const sBtn = wrapper.querySelector(`#settings-btn-${secId}`);
    const cPicker = wrapper.querySelector(`#column-picker-${secId}`);
    sBtn.addEventListener('click', e => { e.stopPropagation(); elevateZ(cPicker); if (cPicker.classList.contains('show')) renderColPicker(secId); });
    wrapper.querySelector(`#p-search-${secId}`).addEventListener('input', function() {
        const term = this.value.trim().toLowerCase();
        cPicker.querySelectorAll('.column-item').forEach(item => { item.style.display = item.dataset.colName.includes(term) ? 'flex' : 'none'; });
    });
    wrapper.querySelector(`#p-all-${secId}`).addEventListener('click', () => {
        cPicker.querySelectorAll('.column-item').forEach(item => {
            if (item.style.display !== 'none') { const cb = item.querySelector('input[type="checkbox"]'); if (!cb.checked) { cb.checked = true; if (!state.visibleHeaders.includes(cb.value)) state.visibleHeaders.push(cb.value); } }
        });
        state.visibleHeaders = state.orderedHeaders.filter(c => state.visibleHeaders.includes(c)); SLAPrefs.savePrefs(secId); updateView(secId);
    });
    wrapper.querySelector(`#p-none-${secId}`).addEventListener('click', () => {
        cPicker.querySelectorAll('.column-item').forEach(item => {
            if (item.style.display !== 'none') { const cb = item.querySelector('input[type="checkbox"]'); if (cb.checked) { cb.checked = false; state.visibleHeaders = state.visibleHeaders.filter(c => c !== cb.value); } }
        });
        SLAPrefs.savePrefs(secId); updateView(secId);
    });

    // 去重提取
    const cpBtn = wrapper.querySelector(`#copy-btn-${secId}`);
    const cpPicker = wrapper.querySelector(`#copy-picker-${secId}`);
    cpBtn.addEventListener('click', e => { e.stopPropagation(); elevateZ(cpPicker); if (cpPicker.classList.contains('show')) renderCopyMenu(secId); });
    wrapper.querySelector(`#c-search-${secId}`).addEventListener('input', function() {
        const term = this.value.trim().toLowerCase();
        cpPicker.querySelectorAll('.copy-list-item').forEach(item => { item.style.display = item.dataset.colName.includes(term) ? 'flex' : 'none'; });
        cpPicker.querySelectorAll('.copy-list-sep').forEach(sep => { sep.style.display = term ? 'none' : 'block'; });
    });

    // 指标
    const mBtn = wrapper.querySelector(`#metrics-btn-${secId}`);
    const mPicker = wrapper.querySelector(`#metrics-picker-${secId}`);
    mBtn.addEventListener('click', e => {
        e.stopPropagation(); elevateZ(mPicker);
        if (mPicker.classList.contains('show')) { populateMetricSelects(secId); renderMetricList(secId); }
    });
    wrapper.querySelector(`#add-metric-btn-${secId}`).addEventListener('click', () => addMetricRule(secId));

    wrapper.querySelector(`#export-btn-${secId}`).addEventListener('click', () => exportData(secId));
    updateMetricRuleSummary(secId);
}

function renderColPicker(secId) {
    const state = AppState[secId];
    const list = document.getElementById(`p-list-${secId}`);
    list.innerHTML = '';
    state.orderedHeaders.forEach(col => {
        const label = document.createElement('label'); label.className = 'column-item'; label.dataset.colName = col.toLowerCase();
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = state.visibleHeaders.includes(col); cb.value = col;
        cb.addEventListener('change', e => {
            if (e.target.checked) { if (!state.visibleHeaders.includes(col)) state.visibleHeaders.push(col); }
            else { state.visibleHeaders = state.visibleHeaders.filter(c => c !== col); }
            state.visibleHeaders = state.orderedHeaders.filter(c => state.visibleHeaders.includes(c));
            SLAPrefs.savePrefs(secId); updateView(secId);
        });
        const span = document.createElement('span'); span.textContent = col; span.title = col;
        label.appendChild(cb); label.appendChild(span); list.appendChild(label);
    });
}

function renderCopyMenu(secId) {
    const state = AppState[secId];
    const list = document.getElementById(`c-list-${secId}`);
    list.innerHTML = '';
    const regex = /owner|handler|责任|处理|负责|分配|派发|人|名/i;
    const candidateCols = state.orderedHeaders.filter(h => regex.test(h));
    const otherCols = state.orderedHeaders.filter(h => !regex.test(h));
    candidateCols.forEach(col => {
        const item = document.createElement('div');
        item.className = 'column-item copy-list-item'; item.style.cssText = 'padding:8px 15px;cursor:pointer;'; item.dataset.colName = col.toLowerCase();
        item.innerHTML = `<span style="color:#e65100;font-weight:bold;">⭐ ${escapeHTML(col)}</span>`;
        item.addEventListener('click', () => { executeCopy(secId, col); document.getElementById(`copy-picker-${secId}`).classList.remove('show'); });
        list.appendChild(item);
    });
    if (candidateCols.length > 0 && otherCols.length > 0) {
        const sep = document.createElement('div'); sep.className = 'copy-list-sep'; sep.style.cssText = 'height:1px;background:#ffe0b2;margin:4px 0;'; list.appendChild(sep);
    }
    otherCols.forEach(col => {
        const item = document.createElement('div');
        item.className = 'column-item copy-list-item'; item.style.cssText = 'padding:8px 15px;cursor:pointer;'; item.dataset.colName = col.toLowerCase();
        item.innerHTML = `<span style="color:#666;">📄 ${escapeHTML(col)}</span>`;
        item.addEventListener('click', () => { executeCopy(secId, col); document.getElementById(`copy-picker-${secId}`).classList.remove('show'); });
        list.appendChild(item);
    });
    const si = document.getElementById(`c-search-${secId}`); if (si) si.value = '';
}

function executeCopy(secId, colName) {
    const data = AppState[secId].currentDisplayData;
    if (!data || !data.length) { alert('当前无数据！'); return; }
    const arr = data.map(r => r[colName]).filter(v => v !== undefined && v !== null && v.toString().trim() !== '');
    const unique = [...new Set(arr)];
    if (!unique.length) { alert('无有效数据！'); return; }
    const text = unique.join(', ');
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => alert(`✅ 提取成功 (${unique.length}条)：\n${text}`)).catch(() => fallbackCopy(text));
    } else { fallbackCopy(text); }
}
function fallbackCopy(text) {
    const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); alert(`✅ 提取成功：\n${text}`); } catch (e) { alert('复制失败'); }
    document.body.removeChild(t);
}

function exportData(secId) {
    const state = AppState[secId];
    if (!state.currentDisplayData.length) return;
    const arr = state.currentDisplayData.map(row => {
        const n = {};
        if (state.mode !== 'other') n['预警状态'] = row._slaCleanText;
        state.visibleHeaders.forEach(h => n[h] = row[h] !== undefined ? row[h] : '');
        return n;
    });
    const ws = XLSX.utils.json_to_sheet(arr); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, `Export_${state.mode}_${new Date().getTime()}.xlsx`);
    API.logHistory('sla', '导出数据', `${state.title} ${arr.length}行`);
}

// ── 指标配置 ──────────────────────────────────────────────

function populateMetricSelects(secId) {
    const state = AppState[secId];
    let htmlX = '<option value="">1. 当此列(X)...</option>';
    let htmlZ = '<option value="">3. 则提取该行此列(Z)的值</option>';
    let htmlCX = '<option value="">1. 筛选条件列(X)... (选填)</option>';
    let htmlCZ = '<option value="">3. 目标统计列(Z)</option>';
    
    state.orderedHeaders.forEach(h => {
        const hSafe = escapeHTML(h);
        htmlX += `<option value="${hSafe}">${hSafe}</option>`;
        htmlZ += `<option value="${hSafe}">${hSafe}</option>`;
        htmlCX += `<option value="${hSafe}">${hSafe}</option>`;
        htmlCZ += `<option value="${hSafe}">${hSafe}</option>`;
    });
    
    document.getElementById(`m-colx-${secId}`).innerHTML = htmlX;
    document.getElementById(`m-colz-${secId}`).innerHTML = htmlZ;
    const ccolx = document.getElementById(`m-c-colx-${secId}`); if (ccolx) ccolx.innerHTML = htmlCX;
    const ccolz = document.getElementById(`m-c-colz-${secId}`); if (ccolz) ccolz.innerHTML = htmlCZ;

    // Populate Parents
    let parentHtml = '<option value="">作为主指标独立展示</option>';
    Object.keys(AppState).forEach(sId => {
        const s = AppState[sId];
        if (s.customMetrics) {
            s.customMetrics.forEach(r => {
                const titleStr = s.title || sId;
                const parentLabel = getMetricRuleDisplayLabel(r);
                parentHtml += `<option value="${sId}|${r.id}">作为 [${escapeHTML(parentLabel)}] 的子指标 (归属表: ${escapeHTML(titleStr)})</option>`;
            });
        }
    });
    const parentSel = document.getElementById(`m-parent-${secId}`);
    if (parentSel) {
        parentSel.innerHTML = parentHtml;
        parentSel.value = '';
        const catSel = document.getElementById(`m-cat-${secId}`);
        if (catSel) catSel.style.display = 'none';
    }

    // Populate Categories
    const cats = window.GlobalCategories || ['TE', 'ORG', 'ET', 'VDF'];
    let catHtml = '<option value="">选择分类</option>';
    cats.forEach(c => { catHtml += `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`; });
    const catSel = document.getElementById(`m-cat-${secId}`);
    if (catSel) catSel.innerHTML = catHtml;
}

function addMetricRule(secId) {
    const typeEl = document.querySelector(`input[name="m-type-${secId}"]:checked`);
    const type = typeEl ? typeEl.value : 'extract';
    
    let colX, valY, colZ, valK;
    if (type === 'extract') {
        colX = document.getElementById(`m-colx-${secId}`).value;
        valY = document.getElementById(`m-valy-${secId}`).value.trim();
        colZ = document.getElementById(`m-colz-${secId}`).value;
        valK = '';
        if (!colX || !valY || !colZ) { alert('请将提取模式的 X/Y/Z 列填写完整！'); return; }
    } else {
        const cx = document.getElementById(`m-c-colx-${secId}`);
        const cy = document.getElementById(`m-c-valy-${secId}`);
        const cz = document.getElementById(`m-c-colz-${secId}`);
        const ck = document.getElementById(`m-c-valk-${secId}`);
        colX = cx ? cx.value : '';
        valY = cy ? cy.value.trim() : '';
        colZ = cz ? cz.value : '';
        valK = ck ? ck.value.trim() : '';
        if (!colZ || !valK) { alert('请将统计/占比模式的 Z/K 填写完整！'); return; }
    }

    let label = document.getElementById(`m-label-${secId}`).value.trim();
    const color = document.getElementById(`m-color-${secId}`).value;
    const parentVal = document.getElementById(`m-parent-${secId}`) ? document.getElementById(`m-parent-${secId}`).value : '';
    const category = document.getElementById(`m-cat-${secId}`) ? document.getElementById(`m-cat-${secId}`).value : '';

    if (parentVal && !category) { alert('作为子指标时必须选择分类！'); return; }
    if (!parentVal && !label) { alert('请输入主指标名称！'); return; }

    if (parentVal && !label) {
        const [parentSecId, parentRuleId] = parentVal.split('|');
        const parentState = AppState[parentSecId];
        if (parentState) {
            const parent = parentState.customMetrics.find(r => r.id === parentRuleId);
            if (parent) {
                label = getMetricRuleDisplayLabel(parent); // inherit parent's label
            }
        }
    }

    const rule = {
        id: 'm_' + new Date().getTime(),
        type, colX, valY, colZ, valK, label, color,
        sourceSecId: secId
    };

    if (parentVal) {
        const [parentSecId, parentRuleId] = parentVal.split('|');
        const parentState = AppState[parentSecId];
        if (parentState) {
            const parent = parentState.customMetrics.find(r => r.id === parentRuleId);
            if (parent) {
                if (!parent.subMetrics) parent.subMetrics = [];
                rule.category = category;
                rule.label = getMetricRuleDisplayLabel(rule, parent);
                parent.subMetrics.push(rule);
                SLAPrefs.savePrefs(parentSecId);
                if (parentSecId !== secId) {
                    renderMetricList(parentSecId);
                }
            }
        }
    } else {
        AppState[secId].customMetrics.push(rule);
        SLAPrefs.savePrefs(secId);
    }

    renderMetricList(secId); evaluateAllMetrics(); updateAllMetricRuleSummaries();
    if (window.refreshSLAHighlightViews) window.refreshSLAHighlightViews(Object.keys(AppState || {}));
    document.getElementById(`m-label-${secId}`).value = '';
    const cy = document.getElementById(`m-c-valy-${secId}`); if(cy) cy.value = '';
    const ck = document.getElementById(`m-c-valk-${secId}`); if(ck) ck.value = '';
}

window.deleteMetricRule = function(secId, ruleId) {
    AppState[secId].customMetrics = AppState[secId].customMetrics.filter(r => r.id !== ruleId);
    SLAPrefs.savePrefs(secId); renderMetricList(secId); evaluateAllMetrics(); updateAllMetricRuleSummaries();
    if (window.refreshSLAHighlightViews) window.refreshSLAHighlightViews(Object.keys(AppState || {}));
};

window.deleteSubMetricRule = function(secId, parentRuleId, subIndex) {
    const parent = AppState[secId].customMetrics.find(r => r.id === parentRuleId);
    if (parent && parent.subMetrics) {
        parent.subMetrics.splice(subIndex, 1);
        SLAPrefs.savePrefs(secId); renderMetricList(secId); evaluateAllMetrics(); updateAllMetricRuleSummaries();
        if (window.refreshSLAHighlightViews) window.refreshSLAHighlightViews(Object.keys(AppState || {}));
        if (document.getElementById('metric-rules-modal')?.style.display === 'flex') renderAllMetricRules();
    }
};

function getMetricRuleDisplayLabel(rule, parentRule) {
    const candidates = [
        rule && rule.label,
        parentRule && parentRule.label,
        rule && rule.metricLabel,
        rule && rule.name,
        rule && rule.colZ,
        parentRule && parentRule.colZ,
        '未命名指标'
    ];
    const found = candidates.find(item => item !== undefined && item !== null && String(item).trim() && String(item).trim() !== 'undefined');
    return String(found || '未命名指标').trim();
}

const SLA_PREF_TITLE_MAP = {
    rectification: '整改详单合集',
    risk: '常规风险合集',
    special: 'CPT专项风险合集',
    sr: 'SR详单分析',
    vulnerability: '漏洞预警详单'
};

let cachedMetricRulePrefs = null;
let cachedMetricRuleConfig = null;
let latestMetricRuleRecords = [];
let editingMetricRuleRecord = null;
const expandedMetricRuleGroups = new Set();

function normalizeMetricPrefSecId(prefKey) {
    return String(prefKey || '').replace(/^sla_prefs_/, '');
}

function getSectionDisplayTitle(secId, prefKey) {
    const state = AppState && AppState[secId];
    if (state && state.title) return state.title;
    const normalized = normalizeMetricPrefSecId(secId || prefKey);
    if (SLA_PREF_TITLE_MAP[normalized]) return SLA_PREF_TITLE_MAP[normalized];
    if (String(normalized).startsWith('other_')) return `独立表规则 (${normalized})`;
    return normalized || prefKey || '未知表';
}

function describeMetricRule(rule) {
    if (!rule) return '';
    if (rule.type === 'count') {
        return `COUNT ${rule.colX ? `[${escapeHTML(rule.colX)}] 包含 '${escapeHTML(rule.valY)}' 且 ` : ''}[${escapeHTML(rule.colZ)}] 包含 '${escapeHTML(rule.valK)}'`;
    }
    if (rule.type === 'ratio') {
        return `RATIO [${escapeHTML(rule.colZ)}] 包含 '${escapeHTML(rule.valK)}' / ${rule.colX ? `[${escapeHTML(rule.colX)}] 包含 '${escapeHTML(rule.valY)}'` : '总行数'}`;
    }
    return `SHOW [${escapeHTML(rule.colZ)}]`;
}

function describeMetricCondition(rule) {
    if (!rule) return '-';
    if (rule.type === 'count' || rule.type === 'ratio') {
        if (!rule.colX || !rule.valY) return '全量行';
        return `[${escapeHTML(rule.colX)}] 包含 '${escapeHTML(rule.valY)}'`;
    }
    return `[${escapeHTML(rule.colX)}] 包含 '${escapeHTML(rule.valY)}'`;
}

function getMetricRuleSearchText(record) {
    return [
        record.label,
        record.parentMetricName,
        record.subMetricName,
        record.category,
        record.tableTitle,
        record.parentTitle,
        record.sourceTitle,
        record.prefKey,
        record.rule && record.rule.colX,
        record.rule && record.rule.valY,
        record.rule && record.rule.colZ,
        record.rule && record.rule.valK
    ].filter(Boolean).join(' ').toLowerCase();
}

function makeMetricRuleRecord(base) {
    const rule = base.rule || {};
    const parentRule = base.parentRule || null;
    const sourceSecId = rule.sourceSecId || base.sourceSecId || base.parentSecId;
    const isCrossTable = Boolean(sourceSecId && base.parentSecId && sourceSecId !== base.parentSecId);
    const parentMetricName = getMetricRuleDisplayLabel(parentRule || rule);
    const subMetricName = base.kind === 'sub'
        ? getMetricRuleDisplayLabel(rule, parentRule)
        : '-';
    const record = {
        ...base,
        sourceSecId,
        isCrossTable,
        tableTitle: getSectionDisplayTitle(sourceSecId, base.prefKey),
        parentTitle: getSectionDisplayTitle(base.parentSecId, base.prefKey),
        sourceTitle: getSectionDisplayTitle(sourceSecId, base.prefKey),
        parentMetricName,
        subMetricName,
        label: base.kind === 'sub' ? subMetricName : parentMetricName,
        conditionText: describeMetricCondition(rule),
        resultText: describeMetricRule(rule),
        relationText: base.kind === 'sub'
            ? `挂载到 ${getSectionDisplayTitle(base.parentSecId, base.prefKey)} / ${parentMetricName}`
            : '主指标独立展示',
        category: base.kind === 'sub' ? (rule.category || '未分类') : '-',
        typeText: rule.type === 'count' ? '统计' : (rule.type === 'ratio' ? '占比' : '提取')
    };
    record.searchText = getMetricRuleSearchText(record);
    return record;
}

function renderMetricRuleLineage(record) {
    if (record.kind === 'main') {
        return `
            <div class="metric-rule-lineage root">
                <span class="metric-line-node root-dot"></span>
                <span class="metric-line-text"><b>主指标</b><br>${escapeHTML(record.parentTitle)}</span>
            </div>
        `;
    }
    const isCross = record.isCrossTable;
    return `
        <div class="metric-rule-lineage ${isCross ? 'cross' : 'child'}">
            <span class="metric-line-branch">${isCross ? '↳' : '└'}</span>
            <span class="metric-line-text">
                <b>${isCross ? '跨表挂载' : '本表挂载'}</b><br>
                <span title="${escapeHTML(record.sourceTitle)}">${escapeHTML(record.sourceTitle)}</span>
                <span class="metric-line-arrow">→</span>
                <span title="${escapeHTML(record.parentTitle)}">${escapeHTML(record.parentTitle)}</span>
            </span>
        </div>
    `;
}

function getMetricRuleGroupKey(record) {
    return `${record.origin}|${record.parentSecId || record.prefKey}|${record.parentRuleId}`;
}

function collectCurrentMetricRuleRecords() {
    const records = [];
    Object.keys(AppState || {}).forEach(secId => {
        const state = AppState[secId];
        (state.customMetrics || []).forEach(rule => {
            records.push(makeMetricRuleRecord({
                kind: 'main',
                origin: '当前导入',
                secId,
                sourceSecId: secId,
                parentSecId: secId,
                parentRuleId: rule.id,
                rule
            }));
            (rule.subMetrics || []).forEach((sm, subIndex) => {
                records.push(makeMetricRuleRecord({
                    kind: 'sub',
                    origin: '当前导入',
                    secId,
                    parentSecId: secId,
                    parentRuleId: rule.id,
                    subIndex,
                    parentRule: rule,
                    rule: sm
                }));
            });
        });
    });
    return records;
}

function collectSavedMetricRuleRecords(prefs) {
    const records = [];
    Object.keys(prefs || {}).forEach(prefKey => {
        const pref = prefs[prefKey] || {};
        const secId = normalizeMetricPrefSecId(prefKey);
        (pref.customMetrics || []).forEach(rule => {
            records.push(makeMetricRuleRecord({
                kind: 'main',
                origin: '已保存配置',
                secId,
                sourceSecId: secId,
                parentSecId: secId,
                parentRuleId: rule.id,
                prefKey,
                rule
            }));
            (rule.subMetrics || []).forEach((sm, subIndex) => {
                records.push(makeMetricRuleRecord({
                    kind: 'sub',
                    origin: '已保存配置',
                    secId,
                    parentSecId: secId,
                    parentRuleId: rule.id,
                    subIndex,
                    parentRule: rule,
                    prefKey,
                    rule: sm
                }));
            });
        });
    });
    return records;
}

function collectMetricRuleRecords() {
    const merged = new Map();
    collectSavedMetricRuleRecords(cachedMetricRulePrefs || {}).forEach(record => {
        const key = `${record.parentSecId}|${record.parentRuleId}|${record.kind}|${record.subIndex ?? 'main'}|${record.sourceSecId}`;
        merged.set(key, record);
    });
    collectCurrentMetricRuleRecords().forEach(record => {
        const key = `${record.parentSecId}|${record.parentRuleId}|${record.kind}|${record.subIndex ?? 'main'}|${record.sourceSecId}`;
        merged.set(key, record);
    });
    return [...merged.values()];
}

function getInboundSubMetricRecords(secId) {
    return collectMetricRuleRecords().filter(record => (
        record.kind === 'sub'
        && record.sourceSecId === secId
        && record.parentSecId !== secId
    ));
}

function updateMetricRuleSummary(secId) {
    const badge = document.getElementById(`rule-summary-badge-${secId}`);
    const state = AppState && AppState[secId];
    if (!badge || !state) return;
    
    const mainRules = state.customMetrics || [];
    const subCount = mainRules.reduce((sum, rule) => sum + ((rule.subMetrics || []).length), 0);
    
    const crossSubRecords = getInboundSubMetricRecords(secId);
    const crossSubCount = crossSubRecords.length;

    let detail = mainRules.length
        ? mainRules.map(rule => `${getMetricRuleDisplayLabel(rule)}：${(rule.subMetrics || []).length} 个子指标`).join('\n')
        : '当前表暂无主指标规则';

    if (crossSubCount > 0) {
        detail += `\n\n📌 包含跨表子指标：${crossSubCount} 个`;
        crossSubRecords.forEach(r => {
            detail += `\n- [${r.category}] ${r.subMetricName} (归属: ${r.parentTitle})`;
        });
    }

    if (crossSubCount > 0) {
        badge.innerHTML = `主${mainRules.length} / 子${subCount} <span style="color:#ff9800; font-weight:bold; margin-left:4px;">+跨表子${crossSubCount}</span>`;
    } else {
        badge.textContent = `主${mainRules.length} / 子${subCount}`;
    }

    badge.title = detail;
    badge.classList.toggle('empty', mainRules.length === 0 && subCount === 0 && crossSubCount === 0);
}

function updateAllMetricRuleSummaries() {
    Object.keys(AppState || {}).forEach(secId => updateMetricRuleSummary(secId));
}

function renderMetricRuleCard(record, options = {}) {
    const editBtn = options.allowEdit && record.kind === 'sub'
        ? `<button onclick="openMetricRuleEditorById('${record.parentSecId}', '${record.parentRuleId}', ${record.subIndex})" style="border:none; background:none; color:#1976d2; cursor:pointer;">✎ 修改</button>`
        : '';
    const deleteBtn = record.kind === 'sub' && options.allowDelete
        ? `<button onclick="deleteSubMetricRule('${record.parentSecId}', '${record.parentRuleId}', ${record.subIndex}); renderMetricList('${record.sourceSecId}'); if (document.getElementById('metric-rules-modal')?.style.display === 'flex') renderAllMetricRules();" style="border:none; background:none; color:#d32f2f; cursor:pointer;">✖ 删除</button>`
        : '';
    
    let sourceNote = `<span style="color:#d32f2f;font-weight:bold;">(跨表挂载至: ${escapeHTML(record.parentTitle)})</span>`;
    return `
        <div style="font-size:11px; color:#555; background: #fafafa; padding: 6px; padding-right: 80px; margin-bottom: 4px; border-radius: 4px; position: relative;">
            <div style="position:absolute; right:6px; top:6px; display:flex; gap:6px;">
                ${editBtn}
                ${deleteBtn}
            </div>
            <b>[${escapeHTML(record.category || '未分类')}] ${escapeHTML(record.subMetricName)}</b> ${sourceNote}: <br/>${record.conditionText} ➔ ${record.resultText}
        </div>
    `;
}

async function refreshMetricRulePrefsCache() {
    try {
        const mode = API.getSourceMode('sla_data');
        const query = mode === 'auto' ? '' : `?mode=${encodeURIComponent(mode)}`;
        const data = await API.get(`/api/sla/config${query}`);
        cachedMetricRuleConfig = data || {};
        cachedMetricRulePrefs = data && data.prefs ? data.prefs : {};
        if (window.renderSLASourcePanel) window.renderSLASourcePanel();
    } catch (e) {
        console.warn('[SLA Metric Rules] 读取已保存规则失败，仅展示当前导入规则', e);
        cachedMetricRuleConfig = {};
        cachedMetricRulePrefs = {};
    }
}

window.refreshMetricRulePrefsCache = refreshMetricRulePrefsCache;
window.getCachedMetricRulePrefs = function() {
    return cachedMetricRulePrefs || {};
};

function highlightMetricRuleSection(secId) {
    const section = document.getElementById(`section-${secId}`);
    const metricBtn = document.getElementById(`metrics-btn-${secId}`);
    if (!section) return false;

    closeMetricRulesModal();
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    section.classList.add('metric-rule-jump-highlight');
    if (metricBtn) {
        metricBtn.classList.add('metric-rule-button-highlight');
        setTimeout(() => {
            populateMetricSelects(secId);
            renderMetricList(secId);
            metricBtn.click();
        }, 450);
    }
    setTimeout(() => {
        section.classList.remove('metric-rule-jump-highlight');
        if (metricBtn) metricBtn.classList.remove('metric-rule-button-highlight');
    }, 2600);
    return true;
}

window.jumpToMetricRuleTable = function(secId, title) {
    if (highlightMetricRuleSection(secId)) return;
    const safeTitle = title || getSectionDisplayTitle(secId);
    showToast(`当前页面还未导入「${safeTitle}」，请先导入对应表格后再跳转。`, 'warning');
};

function getMetricRuleFieldCandidates(record) {
    const state = AppState && AppState[record.sourceSecId];
    if (state && state.orderedHeaders) return state.orderedHeaders;
    const pref = cachedMetricRulePrefs && cachedMetricRulePrefs[record.prefKey];
    if (pref) {
        return pref.orderedHeaders || pref.visibleHeaders || Object.keys(pref.columnWidths || {});
    }
    return [];
}

function getMetricRuleMainOptions(record) {
    return collectMetricRuleRecords()
        .filter(item => item.kind === 'main' && item.origin === record.origin)
        .filter(item => !(record.kind === 'main' && item.parentRuleId === record.parentRuleId && item.parentSecId === record.parentSecId))
        .map(item => ({
            value: item.origin === '当前导入'
                ? `current|${item.parentSecId}|${item.parentRuleId}`
                : `saved|${item.prefKey}|${item.parentRuleId}`,
            label: `${item.parentTitle} / ${item.parentMetricName}`
        }));
}

function findCurrentRuleRef(record) {
    const state = AppState && AppState[record.parentSecId];
    if (!state) return null;
    const parent = (state.customMetrics || []).find(rule => rule.id === record.parentRuleId);
    if (!parent) return null;
    return {
        origin: 'current',
        state,
        parent,
        rule: record.kind === 'sub' ? (parent.subMetrics || [])[record.subIndex] : parent
    };
}

function findSavedRuleRef(record) {
    const pref = cachedMetricRulePrefs && cachedMetricRulePrefs[record.prefKey];
    if (!pref) return null;
    const parent = (pref.customMetrics || []).find(rule => rule.id === record.parentRuleId);
    if (!parent) return null;
    return {
        origin: 'saved',
        pref,
        parent,
        rule: record.kind === 'sub' ? (parent.subMetrics || [])[record.subIndex] : parent
    };
}

function findMetricRuleRef(record) {
    return record.origin === '当前导入' ? findCurrentRuleRef(record) : findSavedRuleRef(record);
}

function renderMetricRuleEditorPreview() {
    const type = document.getElementById('metric-rule-edit-type')?.value || 'extract';
    const colX = document.getElementById('metric-rule-edit-colx')?.value || '';
    const valY = document.getElementById('metric-rule-edit-valy')?.value || '';
    const colZ = document.getElementById('metric-rule-edit-colz')?.value || '';
    const valK = document.getElementById('metric-rule-edit-valk')?.value || '';
    const category = document.getElementById('metric-rule-edit-category')?.value || '';
    const parentSel = document.getElementById('metric-rule-edit-parent');
    const parentText = parentSel && parentSel.selectedOptions[0] ? parentSel.selectedOptions[0].textContent : '主指标独立展示';
    const rule = { type, colX, valY, colZ, valK };
    const preview = document.getElementById('metric-rule-edit-preview');
    if (!preview) return;
    preview.innerHTML = `
        <div><b>规则预览</b>：IF ${describeMetricCondition(rule)} ➔ ${describeMetricRule(rule)}</div>
        <div><b>归属预览</b>：${editingMetricRuleRecord?.kind === 'sub' ? `[${escapeHTML(category || '未分类')}] 挂载到 ${escapeHTML(parentText)}` : '主指标独立展示'}</div>
    `;
}

window.refreshMetricRuleEditorMode = function() {
    const type = document.getElementById('metric-rule-edit-type')?.value || 'extract';
    document.querySelectorAll('.metric-rule-edit-stat-only').forEach(el => {
        el.style.display = type === 'extract' ? 'none' : 'flex';
    });
    renderMetricRuleEditorPreview();
};

window.openMetricRuleEditorById = function(secId, ruleId, subIndex = -1) {
    const allRecords = collectMetricRuleRecords();
    const record = allRecords.find(r => 
        r.origin === '当前导入' && 
        r.parentSecId === secId && 
        r.parentRuleId === ruleId &&
        (subIndex === -1 ? r.kind === 'main' : (r.kind === 'sub' && r.subIndex === subIndex))
    );
    if (!record) {
        showToast('未找到对应的指标配置。', 'warning');
        return;
    }
    if (typeof latestMetricRuleRecords === 'undefined') window.latestMetricRuleRecords = [];
    const index = latestMetricRuleRecords.push(record) - 1;
    openMetricRuleEditor(index);
};

window.openMetricRuleEditor = function(index) {
    const record = latestMetricRuleRecords[index];
    if (!record) return;
    const ref = findMetricRuleRef(record);
    if (!ref || !ref.rule) {
        showToast('未找到这条规则的可编辑配置，请刷新后重试。', 'warning');
        return;
    }
    editingMetricRuleRecord = record;
    const rule = ref.rule;
    const modal = document.getElementById('metric-rule-edit-modal');
    if (!modal) return;

    document.getElementById('metric-rule-edit-index').value = String(index);
    document.getElementById('metric-rule-edit-label').value = getMetricRuleDisplayLabel(rule, ref.parent);
    document.getElementById('metric-rule-edit-type').value = rule.type || 'extract';
    const candidates = Array.from(new Set([
        ...getMetricRuleFieldCandidates(record),
        rule.colX,
        rule.colZ
    ].filter(Boolean)));
    
    const fieldOptionsHtml = '<option value="">(空/不指定列)</option>' + candidates
        .map(col => `<option value="${escapeHTML(col)}">${escapeHTML(col)}</option>`).join('');

    document.getElementById('metric-rule-edit-colx').innerHTML = fieldOptionsHtml;
    document.getElementById('metric-rule-edit-colz').innerHTML = fieldOptionsHtml;

    document.getElementById('metric-rule-edit-colx').value = rule.colX || '';
    document.getElementById('metric-rule-edit-colz').value = rule.colZ || '';
    document.getElementById('metric-rule-edit-valy').value = rule.valY || '';
    document.getElementById('metric-rule-edit-valk').value = rule.valK || '';

    const cats = window.GlobalCategories || ['TE', 'ORG', 'ET', 'VDF'];
    document.getElementById('metric-rule-edit-category').innerHTML = cats
        .map(cat => `<option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>`).join('');
    document.getElementById('metric-rule-edit-category').value = rule.category || record.category || cats[0] || '';

    const parentOptions = getMetricRuleMainOptions(record);
    document.getElementById('metric-rule-edit-parent').innerHTML = parentOptions.length
        ? parentOptions.map(item => `<option value="${escapeHTML(item.value)}">${escapeHTML(item.label)}</option>`).join('')
        : '<option value="">无可用主指标</option>';
    const currentParentValue = record.origin === '当前导入'
        ? `current|${record.parentSecId}|${record.parentRuleId}`
        : `saved|${record.prefKey}|${record.parentRuleId}`;
    if (record.kind === 'sub') document.getElementById('metric-rule-edit-parent').value = currentParentValue;

    document.querySelectorAll('.metric-rule-edit-sub-only').forEach(el => {
        el.style.display = record.kind === 'sub' ? 'flex' : 'none';
    });
    document.getElementById('metric-rule-edit-subtitle').textContent = `${record.origin} · ${record.parentTitle} · ${record.kind === 'sub' ? '子指标' : '主指标'}`;
    ['metric-rule-edit-label', 'metric-rule-edit-colx', 'metric-rule-edit-valy', 'metric-rule-edit-colz', 'metric-rule-edit-valk', 'metric-rule-edit-category', 'metric-rule-edit-parent']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.oninput = renderMetricRuleEditorPreview;
            if (el) el.onchange = id === 'metric-rule-edit-type' ? refreshMetricRuleEditorMode : renderMetricRuleEditorPreview;
        });
    refreshMetricRuleEditorMode();
    modal.style.display = 'flex';
};

window.closeMetricRuleEditor = function() {
    const modal = document.getElementById('metric-rule-edit-modal');
    if (modal) modal.style.display = 'none';
    editingMetricRuleRecord = null;
};

async function persistSavedMetricRuleConfig() {
    const payload = {
        targets: cachedMetricRuleConfig && cachedMetricRuleConfig.targets ? cachedMetricRuleConfig.targets : null,
        prefs: cachedMetricRulePrefs || {}
    };
    await API.post('/api/sla/config', payload);
    await refreshMetricRulePrefsCache();
}

function moveSubMetricRule(record, ref, newParentValue) {
    if (record.kind !== 'sub' || !newParentValue) return [];
    const changedSecIds = new Set();
    if (record.origin === '当前导入') {
        const [, newSecId, newRuleId] = newParentValue.split('|');
        if (newSecId === record.parentSecId && newRuleId === record.parentRuleId) return [];
        const oldParent = ref.parent;
        const rule = ref.rule;
        const newParent = AppState[newSecId]?.customMetrics?.find(item => item.id === newRuleId);
        if (!newParent) {
            throw new Error('未找到新的挂载主指标');
        }
        oldParent.subMetrics.splice(record.subIndex, 1);
        if (!newParent.subMetrics) newParent.subMetrics = [];
        newParent.subMetrics.push(rule);
        changedSecIds.add(record.parentSecId);
        changedSecIds.add(newSecId);
        return [...changedSecIds];
    }

    const [, newPrefKey, newRuleId] = newParentValue.split('|');
    if (newPrefKey === record.prefKey && newRuleId === record.parentRuleId) return [];
    const rule = ref.rule;
    const newPref = cachedMetricRulePrefs[newPrefKey];
    const newParent = newPref?.customMetrics?.find(item => item.id === newRuleId);
    if (!newParent) {
        throw new Error('未找到新的挂载主指标');
    }
    ref.parent.subMetrics.splice(record.subIndex, 1);
    if (!newParent.subMetrics) newParent.subMetrics = [];
    newParent.subMetrics.push(rule);
    return [];
}

window.saveMetricRuleEditor = async function() {
    if (!editingMetricRuleRecord) return;
    const record = editingMetricRuleRecord;
    const ref = findMetricRuleRef(record);
    if (!ref || !ref.rule) {
        showToast('保存失败：规则已不存在，请刷新后重试。', 'error');
        return;
    }

    const type = document.getElementById('metric-rule-edit-type').value;
    const colX = document.getElementById('metric-rule-edit-colx').value.trim();
    const valY = document.getElementById('metric-rule-edit-valy').value.trim();
    const colZ = document.getElementById('metric-rule-edit-colz').value.trim();
    const valK = document.getElementById('metric-rule-edit-valk').value.trim();
    const label = document.getElementById('metric-rule-edit-label').value.trim();

    if (!label) { showToast('请填写指标名称。', 'warning'); return; }
    if (!colZ) { showToast('请填写展示/统计列 Z。', 'warning'); return; }
    if (type === 'extract' && (!colX || !valY)) { showToast('提取模式需要填写条件列 X 和条件值 Y。', 'warning'); return; }
    if (type !== 'extract' && !valK) { showToast('统计/占比模式需要填写统计值 K。', 'warning'); return; }

    const rule = ref.rule;
    rule.type = type;
    rule.colX = colX;
    rule.valY = valY;
    rule.colZ = colZ;
    rule.valK = type === 'extract' ? '' : valK;
    rule.label = label;
    if (record.kind === 'sub') {
        rule.category = document.getElementById('metric-rule-edit-category').value || rule.category || '未分类';
    }

    try {
        const changedSecIds = moveSubMetricRule(record, ref, document.getElementById('metric-rule-edit-parent').value);
        if (record.origin === '当前导入') {
            const secIds = changedSecIds.length ? changedSecIds : [record.parentSecId];
            for (const secId of secIds) {
                if (AppState[secId]) {
                    await SLAPrefs.savePrefs(secId);
                    renderMetricList(secId);
                }
            }
            evaluateAllMetrics();
            updateAllMetricRuleSummaries();
            if (window.refreshSLAHighlightViews) window.refreshSLAHighlightViews(Object.keys(AppState || {}));
        } else {
            await persistSavedMetricRuleConfig();
        }
        closeMetricRuleEditor();
        await refreshMetricRulePrefsCache();
        renderAllMetricRules();
        showToast('指标规则已保存。');
    } catch (e) {
        console.error('[SLA Metric Rules] 保存规则失败:', e);
        showToast(`保存失败：${e.message || e}`, 'error');
    }
};

window.deleteMetricRuleFromOverview = async function(index) {
    const record = latestMetricRuleRecords[index];
    if (!record) return;
    const ref = findMetricRuleRef(record);
    if (!ref || !ref.rule) {
        showToast('未找到这条规则，请刷新后重试。', 'warning');
        return;
    }

    const ruleName = record.kind === 'main'
        ? record.parentMetricName
        : `[${record.category}] ${record.subMetricName}`;
    const extra = record.kind === 'main'
        ? '主指标下的子指标也会一起删除。'
        : '仅删除这一条子指标挂载。';
    if (!confirm(`确认删除规则「${ruleName}」吗？\n${extra}`)) return;

    try {
        if (record.origin === '当前导入') {
            const state = AppState[record.parentSecId];
            if (!state) throw new Error('当前页面未找到对应表格状态');
            if (record.kind === 'main') {
                state.customMetrics = (state.customMetrics || []).filter(rule => rule.id !== record.parentRuleId);
            } else {
                const parent = (state.customMetrics || []).find(rule => rule.id === record.parentRuleId);
                if (!parent || !parent.subMetrics) throw new Error('未找到对应子指标');
                parent.subMetrics.splice(record.subIndex, 1);
            }
            await SLAPrefs.savePrefs(record.parentSecId);
            renderMetricList(record.parentSecId);
            evaluateAllMetrics();
            updateAllMetricRuleSummaries();
            if (window.refreshSLAHighlightViews) window.refreshSLAHighlightViews(Object.keys(AppState || {}));
        } else {
            const pref = cachedMetricRulePrefs && cachedMetricRulePrefs[record.prefKey];
            if (!pref) throw new Error('未找到已保存配置');
            if (record.kind === 'main') {
                pref.customMetrics = (pref.customMetrics || []).filter(rule => rule.id !== record.parentRuleId);
            } else {
                const parent = (pref.customMetrics || []).find(rule => rule.id === record.parentRuleId);
                if (!parent || !parent.subMetrics) throw new Error('未找到对应子指标');
                parent.subMetrics.splice(record.subIndex, 1);
            }
            await persistSavedMetricRuleConfig();
        }
        await refreshMetricRulePrefsCache();
        renderAllMetricRules();
        showToast('指标规则已删除。');
    } catch (e) {
        console.error('[SLA Metric Rules] 删除规则失败:', e);
        showToast(`删除失败：${e.message || e}`, 'error');
    }
};

window.openMetricRulesModal = async function() {
    const modal = document.getElementById('metric-rules-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    const search = document.getElementById('metric-rules-search');
    if (search) search.value = '';
    const crossOnly = document.getElementById('metric-rules-cross-only');
    if (crossOnly) crossOnly.checked = false;
    const list = document.getElementById('metric-rules-modal-list');
    if (list) list.innerHTML = '<div class="metric-rules-empty">正在读取已保存的指标规则...</div>';
    await refreshMetricRulePrefsCache();
    renderAllMetricRules();
};

window.closeMetricRulesModal = function() {
    const modal = document.getElementById('metric-rules-modal');
    if (modal) modal.style.display = 'none';
};

window.toggleMetricRuleGroup = function(groupKey) {
    let isExpanding = false;
    if (expandedMetricRuleGroups.has(groupKey)) {
        expandedMetricRuleGroups.delete(groupKey);
    } else {
        expandedMetricRuleGroups.add(groupKey);
        isExpanding = true;
    }
    renderAllMetricRules(isExpanding ? groupKey : null);
};

window.renderAllMetricRules = function(justExpandedGroupKey = null) {
    const list = document.getElementById('metric-rules-modal-list');
    if (!list) return;
    const wrap = list.querySelector('.metric-rules-table-wrap');
    const savedScrollTop = wrap ? wrap.scrollTop : 0;
    const term = (document.getElementById('metric-rules-search')?.value || '').trim().toLowerCase();
    const crossOnly = Boolean(document.getElementById('metric-rules-cross-only')?.checked);
    const allFilteredRecords = collectMetricRuleRecords().filter(record => {
        if (crossOnly && !record.isCrossTable) return false;
        if (!term) return true;
        return (record.searchText || '').includes(term);
    });

    if (!allFilteredRecords.length) {
        list.innerHTML = '<div class="metric-rules-empty">暂无匹配的指标规则。未导入表格时也会读取服务器已保存配置；如果这里为空，说明当前还没有保存过自定义指标规则。</div>';
        return;
    }

    allFilteredRecords.sort((a, b) => (
        `${a.parentTitle}|${a.parentMetricName}|${a.kind}|${a.category}`.localeCompare(`${b.parentTitle}|${b.parentMetricName}|${b.kind}|${b.category}`, 'zh-CN')
    ));

    const allRecords = collectMetricRuleRecords();
    const currentCount = allRecords.filter(r => r.origin === '当前导入').length;
    const savedCount = allRecords.filter(r => r.origin === '已保存配置').length;
    const crossCount = allRecords.filter(r => r.isCrossTable).length;
    const grouped = new Map();
    allFilteredRecords.forEach(record => {
        const groupKey = getMetricRuleGroupKey(record);
        if (!grouped.has(groupKey)) grouped.set(groupKey, { main: null, subs: [] });
        const bucket = grouped.get(groupKey);
        if (record.kind === 'main') bucket.main = record;
        else bucket.subs.push(record);
    });

    const baseRecords = collectMetricRuleRecords();
    grouped.forEach((bucket, groupKey) => {
        if (bucket.main) return;
        const fallback = baseRecords.find(record => record.kind === 'main' && getMetricRuleGroupKey(record) === groupKey);
        if (fallback) bucket.main = fallback;
    });

    latestMetricRuleRecords = [];
    const rowParts = [];
    grouped.forEach((bucket, groupKey) => {
        if (!bucket.main) return;
        const mainRecord = bucket.main;
        const matchedSubCount = bucket.subs.length;
        const totalSubCount = baseRecords.filter(record => record.kind === 'sub' && getMetricRuleGroupKey(record) === groupKey).length;
        const shouldAutoExpand = Boolean(term && matchedSubCount > 0 && !mainRecord.searchText.includes(term));
        const isExpanded = expandedMetricRuleGroups.has(groupKey) || shouldAutoExpand;
        const mainIndex = latestMetricRuleRecords.push(mainRecord) - 1;
        const mainActionHtml = `
            <div class="metric-rule-actions">
                <button class="metric-rule-view-btn" onclick="jumpToMetricRuleTable('${mainRecord.sourceSecId}', '${escapeHTML(mainRecord.sourceTitle)}')">查看</button>
                <button class="metric-rule-edit-btn" onclick="openMetricRuleEditor(${mainIndex})">修改</button>
                <button class="metric-rule-mini-danger" onclick="deleteMetricRuleFromOverview(${mainIndex})">删除</button>
            </div>
        `;
        rowParts.push(`
            <tr class="metric-rule-main-row ${totalSubCount ? 'has-children' : ''}">
                <td>
                    <div class="metric-rule-tree-head">
                        ${totalSubCount ? `<button class="metric-rule-expand-btn ${isExpanded ? 'expanded' : ''}" onclick="toggleMetricRuleGroup('${escapeHTML(groupKey)}')" title="${isExpanded ? '收起子指标' : '展开子指标'}">${isExpanded ? '▾' : '▸'}</button>` : '<span class="metric-rule-expand-placeholder"></span>'}
                        ${renderMetricRuleLineage(mainRecord)}
                    </div>
                </td>
                <td title="${escapeHTML(mainRecord.tableTitle)}">${escapeHTML(mainRecord.tableTitle)}</td>
                <td><span class="metric-rule-badge ${mainRecord.origin === '当前导入' ? 'main' : 'saved'}">${escapeHTML(mainRecord.origin)}</span></td>
                <td><span class="metric-rule-badge main">主指标</span>${totalSubCount ? `<span class="metric-rule-child-count">${matchedSubCount === totalSubCount ? totalSubCount : `${matchedSubCount}/${totalSubCount}`} 子</span>` : ''}</td>
                <td title="${escapeHTML(mainRecord.parentMetricName)}"><strong>${escapeHTML(mainRecord.parentMetricName)}</strong></td>
                <td><span class="metric-rule-muted">折叠于主指标</span></td>
                <td><span class="metric-rule-type">${escapeHTML(mainRecord.typeText)}</span></td>
                <td title="${escapeHTML(mainRecord.conditionText)}">${mainRecord.conditionText}</td>
                <td title="${escapeHTML(mainRecord.resultText)}">${mainRecord.resultText}</td>
                <td title="${escapeHTML(mainRecord.relationText)}">${escapeHTML(mainRecord.relationText)}</td>
                <td>${mainActionHtml}</td>
            </tr>
        `);
        if (!isExpanded) return;
        bucket.subs.forEach(record => {
            const index = latestMetricRuleRecords.push(record) - 1;
            const actionHtml = `
                <div class="metric-rule-actions">
                    <button class="metric-rule-view-btn" onclick="jumpToMetricRuleTable('${record.sourceSecId}', '${escapeHTML(record.sourceTitle)}')">查看</button>
                    <button class="metric-rule-edit-btn" onclick="openMetricRuleEditor(${index})">修改</button>
                    <button class="metric-rule-mini-danger" onclick="deleteMetricRuleFromOverview(${index})">删除</button>
                </div>
            `;
            rowParts.push(`
                <tr class="metric-rule-child-row ${record.isCrossTable ? 'metric-rule-cross-row' : ''} ${groupKey === justExpandedGroupKey ? 'metric-rule-just-expanded' : ''}">
                    <td>${renderMetricRuleLineage(record)}</td>
                    <td title="${escapeHTML(record.tableTitle)}">${escapeHTML(record.tableTitle)}</td>
                    <td><span class="metric-rule-badge ${record.origin === '当前导入' ? 'main' : 'saved'}">${escapeHTML(record.origin)}</span></td>
                    <td><span class="metric-rule-badge sub">${record.isCrossTable ? '跨表子指标' : '子指标'}</span></td>
                    <td title="${escapeHTML(record.parentMetricName)}"><strong>${escapeHTML(record.parentMetricName)}</strong></td>
                    <td title="${escapeHTML(record.subMetricName)}"><span class="metric-rule-category">[${escapeHTML(record.category)}]</span>${escapeHTML(record.subMetricName)}</td>
                    <td><span class="metric-rule-type">${escapeHTML(record.typeText)}</span></td>
                    <td title="${escapeHTML(record.conditionText)}">${record.conditionText}</td>
                    <td title="${escapeHTML(record.resultText)}">${record.resultText}</td>
                    <td title="${escapeHTML(record.relationText)}">${escapeHTML(record.relationText)}</td>
                    <td>${actionHtml}</td>
                </tr>
            `);
        });
    });

    const rows = rowParts.join('');

    list.innerHTML = `
        <div class="metric-rules-summary">
            <span>当前显示 <b>${latestMetricRuleRecords.length}</b> 条</span>
            <span>当前导入 <b>${currentCount}</b> 条</span>
            <span>已保存配置 <b>${savedCount}</b> 条</span>
            <span>跨表规则 <b>${crossCount}</b> 条</span>
            <span class="metric-rule-muted">未导入表格时仍会读取服务器保存规则</span>
        </div>
        <div class="metric-rules-table-wrap">
            <table class="metric-rules-table">
                <thead>
                    <tr>
                        <th>关系链路</th>
                        <th>规则识别表格/前缀</th>
                        <th>来源</th>
                        <th>规则类型</th>
                        <th>主指标名称</th>
                        <th>子指标名称</th>
                        <th>模式</th>
                        <th>条件 IF</th>
                        <th>展示/统计 THEN</th>
                        <th>归属/挂载关系</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;

    if (savedScrollTop > 0) {
        const newWrap = list.querySelector('.metric-rules-table-wrap');
        if (newWrap) newWrap.scrollTop = savedScrollTop;
    }
};

function renderMetricList(secId) {
    const state = AppState[secId];
    const list = document.getElementById(`m-list-${secId}`);
    const inboundRecords = getInboundSubMetricRecords(secId);
    if (!state.customMetrics.length && !inboundRecords.length) { list.innerHTML = '<div style="color:#aaa;font-size:12px;text-align:center;">尚无推送规则</div>'; return; }
    
    let html = '';
    state.customMetrics.forEach(r => {
        let subHtml = '';
        if (r.subMetrics && r.subMetrics.length > 0) {
            subHtml = `<div style="margin-top:6px; padding-left: 10px; border-left: 2px solid #e1bee7;">`;
            r.subMetrics.forEach((sm, idx) => {
                let sourceNote = (sm.sourceSecId && sm.sourceSecId !== secId) 
                    ? `<span style="color:#d32f2f;font-weight:bold;">(跨表数据源: ${escapeHTML(AppState[sm.sourceSecId]?.title || sm.sourceSecId)})</span> ` 
                    : '';
                const smLabel = getMetricRuleDisplayLabel(sm, r);
                let smDesc = describeMetricRule(sm);
                
                subHtml += `
                <div style="font-size:11px; color:#555; background: #fafafa; padding: 6px; padding-right: 80px; margin-bottom: 4px; border-radius: 4px; position: relative;">
                    <div style="position:absolute; right:6px; top:6px; display:flex; gap:6px;">
                        <button onclick="openMetricRuleEditorById('${secId}', '${r.id}', ${idx})" style="border:none; background:none; color:#1976d2; cursor:pointer;">✎ 修改</button>
                        <button onclick="deleteSubMetricRule('${secId}', '${r.id}', ${idx})" style="border:none; background:none; color:#d32f2f; cursor:pointer;">✖ 删除</button>
                    </div>
                    <b>[${escapeHTML(sm.category || '未分类')}] ${escapeHTML(smLabel)}</b> ${sourceNote}: <br/>${smDesc}
                </div>`;
            });
            subHtml += `</div>`;
        }

        let rDesc = '';
        rDesc = describeMetricRule(r).replace(' ➔ ', ' <br>➔ ');

        html += `
        <div class="rule-config-item" style="border-bottom: 1px dashed #eee; padding-bottom: 8px; margin-bottom: 8px;">
            <div style="display:flex; justify-content: space-between; align-items: center;">
                <div style="font-weight:bold;color:#4a90e2;font-size:13px;">[${escapeHTML(getMetricRuleDisplayLabel(r))}]</div>
                <div>
                    <button class="action-btn" onclick="openMetricRuleEditorById('${secId}', '${r.id}')" style="font-size:11px; padding:2px 6px; background:#e3f2fd; color:#1565c0; margin-right:6px;">✎ 修改</button>
                    <button class="action-btn" onclick="deleteMetricRule('${secId}', '${r.id}')" style="font-size:11px; padding:2px 6px; background:#ffebee; color:#c62828;">✖ 删除</button>
                </div>
            </div>
            <div style="font-size:11px;color:#666;margin-top:4px;">${rDesc}</div>
            ${subHtml}
        </div>`;
    });
    if (inboundRecords.length) {
        html += `
            <div style="margin-top: 10px; padding: 8px; border: 1px dashed #ccc; border-radius: 8px; background: #fafafa;">
                <div style="margin-bottom: 7px; color: #1976d2; font-size: 12px; font-weight: bold;">🔁 本表作为跨表子指标数据源</div>
                ${inboundRecords.map(record => renderMetricRuleCard(record, { allowEdit: true, allowDelete: true })).join('')}
            </div>
        `;
    }
    list.innerHTML = html;
    updateMetricRuleSummary(secId);
}

document.addEventListener('click', e => {
    document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
        const secId = menu.id.split('-').pop();
        const b1 = document.getElementById(`settings-btn-${secId}`);
        const b2 = document.getElementById(`copy-btn-${secId}`);
        const b3 = document.getElementById(`metrics-btn-${secId}`);
        if (!menu.contains(e.target) && e.target !== b1 && e.target !== b2 && e.target !== b3) {
            menu.classList.remove('show');
            const sec = document.getElementById(`section-${secId}`);
            if (sec) sec.style.zIndex = '1';
        }
    });
});

window.SLAEvents = { bindEvents };
window.bindEvents = bindEvents;
