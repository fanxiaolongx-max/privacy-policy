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
    state.orderedHeaders.forEach(h => { htmlX += `<option value="${escapeHTML(h)}">${escapeHTML(h)}</option>`; htmlZ += `<option value="${escapeHTML(h)}">${escapeHTML(h)}</option>`; });
    document.getElementById(`m-colx-${secId}`).innerHTML = htmlX;
    document.getElementById(`m-colz-${secId}`).innerHTML = htmlZ;
}

function addMetricRule(secId) {
    const colX = document.getElementById(`m-colx-${secId}`).value;
    const valY = document.getElementById(`m-valy-${secId}`).value.trim();
    const colZ = document.getElementById(`m-colz-${secId}`).value;
    const label = document.getElementById(`m-label-${secId}`).value.trim();
    const color = document.getElementById(`m-color-${secId}`).value;
    if (!colX || !valY || !colZ || !label) { alert('请将规则的 X/Y/Z 列及指标名称填写完整！'); return; }
    const ruleId = 'm_' + new Date().getTime();
    AppState[secId].customMetrics.push({ id: ruleId, colX, valY, colZ, label, color });
    SLAPrefs.savePrefs(secId); renderMetricList(secId); evaluateAllMetrics();
    document.getElementById(`m-valy-${secId}`).value = '';
    document.getElementById(`m-label-${secId}`).value = '';
}

window.deleteMetricRule = function(secId, ruleId) {
    AppState[secId].customMetrics = AppState[secId].customMetrics.filter(r => r.id !== ruleId);
    SLAPrefs.savePrefs(secId); renderMetricList(secId); evaluateAllMetrics();
};

window.deleteSubMetricRule = function(secId, parentRuleId, subIndex) {
    const parent = AppState[secId].customMetrics.find(r => r.id === parentRuleId);
    if (parent && parent.subMetrics) {
        parent.subMetrics.splice(subIndex, 1);
        SLAPrefs.savePrefs(secId); renderMetricList(secId); evaluateAllMetrics();
    }
};

window.showSubMetricForm = function(secId, ruleId) {
    const form = document.getElementById(`sub-metric-form-${secId}-${ruleId}`);
    if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
};

window.addSubMetricRule = function(secId, ruleId) {
    const cat = document.getElementById(`sm-cat-${secId}-${ruleId}`).value;
    const colX = document.getElementById(`sm-colx-${secId}-${ruleId}`).value;
    const valY = document.getElementById(`sm-valy-${secId}-${ruleId}`).value.trim();
    const colZ = document.getElementById(`sm-colz-${secId}-${ruleId}`).value;
    
    if (!cat || !colX || !valY || !colZ) { alert('请将子指标的分类及X/Y/Z填写完整！'); return; }
    
    const parent = AppState[secId].customMetrics.find(r => r.id === ruleId);
    if (parent) {
        if (!parent.subMetrics) parent.subMetrics = [];
        parent.subMetrics.push({ category: cat, colX, valY, colZ });
        SLAPrefs.savePrefs(secId); renderMetricList(secId); evaluateAllMetrics();
    }
};

function renderMetricList(secId) {
    const state = AppState[secId];
    const list = document.getElementById(`m-list-${secId}`);
    if (!state.customMetrics.length) { list.innerHTML = '<div style="color:#aaa;font-size:12px;text-align:center;">尚无推送规则</div>'; return; }
    
    let html = '';
    const cats = window.GlobalCategories || ['TE', 'ORG', 'ET', 'VDF'];
    const catOptions = cats.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');
    
    let colOptions = '<option value="">选择列...</option>';
    state.orderedHeaders.forEach(h => { colOptions += `<option value="${escapeHTML(h)}">${escapeHTML(h)}</option>`; });

    state.customMetrics.forEach(r => {
        let subHtml = '';
        if (r.subMetrics && r.subMetrics.length > 0) {
            subHtml = `<div style="margin-top:6px; padding-left: 10px; border-left: 2px solid #e1bee7;">`;
            r.subMetrics.forEach((sm, idx) => {
                subHtml += `
                <div style="font-size:11px; color:#555; background: #fafafa; padding: 4px; margin-bottom: 4px; border-radius: 4px; position: relative;">
                    <button onclick="deleteSubMetricRule('${secId}', '${r.id}', ${idx})" style="position:absolute; right:4px; top:4px; border:none; background:none; color:#d32f2f; cursor:pointer;">✖</button>
                    <b>[${escapeHTML(sm.category)}]</b>: IF [${escapeHTML(sm.colX)}] 包含 '${escapeHTML(sm.valY)}' ➔ SHOW [${escapeHTML(sm.colZ)}]
                </div>`;
            });
            subHtml += `</div>`;
        }

        html += `
        <div class="rule-config-item" style="border-bottom: 1px dashed #eee; padding-bottom: 8px; margin-bottom: 8px;">
            <div style="display:flex; justify-content: space-between; align-items: center;">
                <div style="font-weight:bold;color:#4a90e2;font-size:13px;">[${escapeHTML(r.label)}]</div>
                <div>
                    <button class="action-btn" onclick="showSubMetricForm('${secId}', '${r.id}')" style="font-size:11px; padding:2px 6px; background:#e1bee7; color:#6a1b9a;">➕ 子指标</button>
                    <button class="action-btn" onclick="deleteMetricRule('${secId}', '${r.id}')" style="font-size:11px; padding:2px 6px; background:#ffebee; color:#c62828;">✖</button>
                </div>
            </div>
            <div style="font-size:11px;color:#666;margin-top:4px;">IF [${escapeHTML(r.colX)}] 包含 '${escapeHTML(r.valY)}' <br>➔ SHOW [${escapeHTML(r.colZ)}]</div>
            ${subHtml}
            
            <div id="sub-metric-form-${secId}-${r.id}" style="display:none; background: #f3e5f5; padding: 8px; border-radius: 4px; margin-top: 8px;">
                <select id="sm-cat-${secId}-${r.id}" class="picker-search" style="margin-bottom:4px;"><option value="">选择分类</option>${catOptions}</select>
                <select id="sm-colx-${secId}-${r.id}" class="picker-search" style="margin-bottom:4px;">${colOptions}</select>
                <input type="text" id="sm-valy-${secId}-${r.id}" class="picker-search" placeholder="包含内容(Y)..." style="margin-bottom:4px;">
                <select id="sm-colz-${secId}-${r.id}" class="picker-search" style="margin-bottom:4px;">${colOptions}</select>
                <button onclick="addSubMetricRule('${secId}', '${r.id}')" style="width:100%; padding:4px; background:#6a1b9a; color:white; border:none; border-radius:4px; font-size:11px; cursor:pointer;">保存子指标</button>
            </div>
        </div>`;
    });
    list.innerHTML = html;
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
