/**
 * sla/metrics.js - 顶部数据舱：指标推送、预警呼吸灯、目标配置弹窗
 */

function evaluateAllMetrics() {
    window.GlobalMetrics = {};
    Object.keys(AppState).forEach(secId => {
        const state = AppState[secId];
        if (!state.customMetrics || !state.customMetrics.length) return;
        state.customMetrics.forEach(rule => {
            const evalRule = (r, dataRows) => {
                const checkMatch = (cellVal, pattern) => {
                    const str = (cellVal !== undefined && cellVal !== null) ? cellVal.toString().trim() : '';
                    if (pattern === '[空]') return str === '';
                    if (pattern === '[非空]') return str !== '';
                    return str.includes(pattern);
                };

                if (r.type === 'count') {
                    let count = 0;
                    for (let i = 0; i < dataRows.length; i++) {
                        const row = dataRows[i];
                        let passX = true;
                        if (r.colX) passX = checkMatch(row[r.colX], r.valY);
                        if (passX && checkMatch(row[r.colZ], r.valK)) count++;
                    }
                    return count;
                } else if (r.type === 'ratio') {
                    let total = 0;
                    let matched = 0;
                    for (let i = 0; i < dataRows.length; i++) {
                        const row = dataRows[i];
                        let passX = true;
                        if (r.colX) passX = checkMatch(row[r.colX], r.valY);
                        if (passX) {
                            total++;
                            if (checkMatch(row[r.colZ], r.valK)) matched++;
                        }
                    }
                    return total > 0 ? Math.round((matched / total) * 100) + '%' : '0%';
                } else {
                    for (let i = 0; i < dataRows.length; i++) {
                        const row = dataRows[i];
                        if (checkMatch(row[r.colX], r.valY)) {
                            return row[r.colZ] !== undefined && row[r.colZ] !== null ? row[r.colZ] : '--';
                        }
                    }
                    return '--';
                }
            };

            let matchedValue = evalRule(rule, state.globalData);

            const ruleColZ = rule.colZ || '';
            const targetKey = `${secId}_${rule.id}`;
            const targetDef = window.GlobalTargets ? window.GlobalTargets[targetKey] : null;
            const isPercentFormat = targetDef && targetDef.isPercent !== undefined ? targetDef.isPercent : (rule.label.includes('率') || ruleColZ.includes('率'));
            
            if (isPercentFormat && matchedValue !== '--' && rule.type !== 'count' && rule.type !== 'ratio') {
                const strVal = matchedValue.toString().trim();
                const isPercent = strVal.endsWith('%');
                const num = parseFloat(strVal);
                if (!isNaN(num)) matchedValue = isPercent ? Math.round(num) + '%' : Math.round(num * 100) + '%';
            }
            
            const evaluatedSubMetrics = [];
            if (rule.subMetrics && rule.subMetrics.length > 0) {
                rule.subMetrics.forEach(sm => {
                    const sourceData = (sm.sourceSecId && AppState[sm.sourceSecId]) 
                                        ? AppState[sm.sourceSecId].globalData 
                                        : (sm.sourceSecId ? [] : state.globalData);
                    let smValue = evalRule(sm, sourceData);
                    
                    const effectiveLabel = sm.label || rule.label || '';
                    const effectiveColZ = sm.colZ || rule.colZ || '';
                    const smTargetKey = `${secId}_${sm.id}`;
                    const smTargetDef = window.GlobalTargets ? (window.GlobalTargets[smTargetKey] || window.GlobalTargets[targetKey]) : null;
                    const smIsPercentFormat = smTargetDef && smTargetDef.isPercent !== undefined ? smTargetDef.isPercent : (effectiveLabel.includes('率') || effectiveColZ.includes('率'));

                    if (smIsPercentFormat && smValue !== '--' && sm.type !== 'count' && sm.type !== 'ratio') {
                        const strVal = smValue.toString().trim();
                        const isPercent = strVal.endsWith('%');
                        const num = parseFloat(strVal);
                        if (!isNaN(num)) smValue = isPercent ? Math.round(num) + '%' : Math.round(num * 100) + '%';
                    }
                    evaluatedSubMetrics.push({ category: sm.category, value: smValue });
                });
            }

            window.GlobalMetrics[`${secId}_${rule.id}`] = { label: rule.label, value: matchedValue, color: rule.color, subMetrics: evaluatedSubMetrics };
        });
    });
    renderTopStickyBar();
}

const SLA_TARGET_MONTH_KEY = 'sla_target_month';

function getTargetMonthDefaultByDay(date = new Date()) {
    const currentMonth = date.getMonth() + 1;
    if (date.getDate() < 10) {
        return currentMonth === 1 ? 12 : currentMonth - 1;
    }
    return currentMonth;
}

function getTodayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getSLATargetMonth() {
    const sel = document.getElementById('slaTargetMonthSelect');
    if (sel && sel.dataset.ready === 'true' && sel.value) return parseInt(sel.value, 10);
    try {
        const saved = JSON.parse(localStorage.getItem(SLA_TARGET_MONTH_KEY) || '{}');
        const month = parseInt(saved.month, 10);
        if (saved.date === getTodayKey() && month >= 1 && month <= 12) return month;
    } catch (e) {}
    return getTargetMonthDefaultByDay();
}

function setSLATargetMonth(month) {
    const normalized = parseInt(month, 10);
    if (normalized >= 1 && normalized <= 12) {
        localStorage.setItem(SLA_TARGET_MONTH_KEY, JSON.stringify({
            month: normalized,
            date: getTodayKey()
        }));
    }
}

function initSLATargetMonthSelect() {
    const sel = document.getElementById('slaTargetMonthSelect');
    if (!sel) return;
    let html = '';
    for (let i = 1; i <= 12; i++) {
        html += `<option value="${i}">${i}月目标</option>`;
    }
    sel.innerHTML = html;
    sel.value = getSLATargetMonth();
    sel.dataset.ready = 'true';
    sel.addEventListener('change', () => {
        setSLATargetMonth(sel.value);
        renderTopStickyBar();
        if (window.AppState && typeof updateView === 'function') {
            Object.keys(window.AppState).forEach(secId => {
                if (window.AppState[secId] && window.AppState[secId].globalData && window.AppState[secId].globalData.length) {
                    updateView(secId);
                }
            });
        }
    });
}

function renderTopStickyBar() {
    const content = document.getElementById('sticky-bar-content');
    const btnExpand = document.getElementById('btn-expand-metrics');
    const btnTarget = document.getElementById('btn-target-config');
    const keys = Object.keys(window.GlobalMetrics);
    const cm = getSLATargetMonth();
    
    // Always show target config button so users can configure targets without importing files
    btnTarget.style.display = 'inline-block';
    
    if (!keys.length) {
        content.innerHTML = '<span style="color:#888;">(当前未导入数据，点击右侧"🎯 预警配置"可配置已知指标目标)</span>';
        btnExpand.style.display = 'none'; 
        return;
    }
    btnExpand.style.display = 'inline-block';
    let html = '';
    keys.forEach(k => {
        const m = window.GlobalMetrics[k];
        let isWarn = false, gapHtml = '';
        const targetMap = window.GlobalTargets[k];
        if (targetMap && targetMap[cm] !== undefined && targetMap[cm] !== '') {
            const targetVal = parseFloat(targetMap[cm]);
            const currentVal = parseFloat(String(m.value).replace(/[^0-9.-]/g, ''));
            const condition = targetMap.type || 'gte';
            if (!isNaN(currentVal) && !isNaN(targetVal)) {
                if (condition === 'gte' && currentVal < targetVal) {
                    isWarn = true;
                    const gap = +(targetVal - currentVal).toFixed(2);
                    const isPercent = String(m.value).includes('%');
                    gapHtml = `<span class="metric-gap">差 ${gap}${isPercent ? '%' : ''}</span>`;
                } else if (condition === 'lte' && currentVal > targetVal) {
                    isWarn = true;
                    const gap = +(currentVal - targetVal).toFixed(2);
                    const isPercent = String(m.value).includes('%');
                    gapHtml = `<span class="metric-gap">超 ${gap}${isPercent ? '%' : ''}</span>`;
                }
            }
        }
        const highlightClass = isWarn ? 'metric-warn-highlight' : '';
        const colorClass = isWarn ? 'danger' : m.color;

        let subHtml = '';
        if (m.subMetrics && m.subMetrics.length > 0) {
            subHtml = `<div class="sub-metrics-list" style="display:none; margin-top:4px; padding-top:4px; border-top:1px dashed rgba(255,255,255,0.2); font-size:11px;">`;
            const subItems = m.subMetrics.map(sm => {
                return `<span style="display:inline-block; margin-right:8px; white-space:nowrap; cursor:help;" title="${escapeHTML(m.label)} (${escapeHTML(sm.category)})">${escapeHTML(sm.category)}: <strong style="color:#ffb74d">${escapeHTML(String(sm.value))}</strong></span>`;
            });
            subHtml += subItems.join(' | ') + `</div>`;
        }

        const expandBtn = (m.subMetrics && m.subMetrics.length > 0) ? `<span onclick="this.parentNode.nextElementSibling.style.display = this.parentNode.nextElementSibling.style.display === 'none' ? 'block' : 'none'; this.innerHTML = this.innerHTML === '🔽' ? '🔼' : '🔽';" style="cursor:pointer; font-size:10px; margin-left:8px; background:rgba(255,255,255,0.1); padding:2px 4px; border-radius:4px;">🔽</span>` : '';

        html += `<div class="info-group"><div class="info-item ${highlightClass}" style="flex-direction:column; align-items:flex-start;">
            <div style="display:flex; align-items:center; width:100%;">
                <span class="info-label">${escapeHTML(m.label)}:</span>
                <span class="info-value ${colorClass}">${escapeHTML(String(m.value))}</span>${gapHtml}${expandBtn}
            </div>
            ${subHtml}
        </div></div>`;
    });
    content.innerHTML = html;
}

// ── 预警目标弹窗 ──────────────────────────────────────────

window.openTargetModal = async function() {
    const modalList = document.getElementById('target-modal-list');
    let targetKeys = Object.keys(window.GlobalMetrics);
    let labelMap = {};
    let currentValues = {};
    
    // If no metrics are currently loaded (e.g. no file imported), fetch all known custom metrics and manual targets
    if (targetKeys.length === 0) {
        modalList.innerHTML = '<div style="text-align:center;padding:30px;color:#888;">正在加载全网指标配置...</div>';
        try {
            const mode = API.getSourceMode('sla_data');
            const query = mode === 'auto' ? '' : `?mode=${encodeURIComponent(mode)}`;
            const configData = await API.get(`/api/sla/config${query}`);
            window.GlobalTargets = configData.targets || {};
            const prefs = configData.prefs || {};
            if (window.renderSLASourcePanel) window.renderSLASourcePanel();
            
            // Collect all custom metrics from prefs
            const knownLabels = {};
            Object.keys(prefs).forEach(schemaHash => {
                const pref = prefs[schemaHash];
                if (pref.customMetrics && pref.customMetrics.length > 0) {
                    let secId = '';
                    if (schemaHash.startsWith('sla_prefs_other_')) {
                        secId = schemaHash.replace('sla_prefs_', ''); // e.g. other_r7ivhq
                    } else if (schemaHash.startsWith('sla_prefs_rectification')) {
                        secId = 'rectification';
                    } else if (schemaHash.startsWith('sla_prefs_risk')) {
                        secId = 'risk';
                    } else if (schemaHash.startsWith('sla_prefs_special')) {
                        secId = 'special';
                    } else {
                        secId = schemaHash.replace('sla_prefs_', '');
                    }
                    
                    pref.customMetrics.forEach(cm => {
                        const targetKey = `${secId}_${cm.id}`;
                        knownLabels[cm.id] = cm.label;
                        labelMap[targetKey] = cm.label;
                        if (!targetKeys.includes(targetKey)) {
                            targetKeys.push(targetKey);
                        }
                    });
                }
            });
            
            // Also include anything already in GlobalTargets
            const existingTargetKeys = Object.keys(window.GlobalTargets);
            existingTargetKeys.forEach(k => {
                if (!targetKeys.includes(k)) {
                    targetKeys.push(k);
                }
                if (window.GlobalTargets[k].label) {
                    labelMap[k] = window.GlobalTargets[k].label;
                } else if (!labelMap[k]) {
                    // Try to guess the label from known custom metrics ids
                    let matchedLabel = k;
                    for (const cmId in knownLabels) {
                        if (k.endsWith(cmId)) {
                            matchedLabel = knownLabels[cmId];
                            break;
                        }
                    }
                    labelMap[k] = matchedLabel;
                }
            });
        } catch (e) {
            console.error("Failed to load config", e);
            if (window.renderSLASourcePanel) window.renderSLASourcePanel();
        }
    } else {
        targetKeys.forEach(k => {
            labelMap[k] = window.GlobalMetrics[k].label;
            currentValues[k] = window.GlobalMetrics[k].value;
        });
    }

    if (!targetKeys.length) {
        modalList.innerHTML = '<div style="text-align:center;padding:30px;color:#888;font-size:16px;">当前没有可配置的指标。<br><br><span style="font-size:13px;">请先在下方独立表格中点击"🎯 指标"添加自定义指标。</span></div>';
    } else {
        modalList.innerHTML = targetKeys.map(k => {
            const label = labelMap[k] || k;
            const currentVal = currentValues[k] !== undefined ? currentValues[k] : '--';
            const targets = window.GlobalTargets[k] || {};
            let inputsHtml = '';
            for (let i = 1; i <= 12; i++) {
                inputsHtml += `<div class="month-input-group">
                    <label>${i}月</label>
                    <input type="number" step="0.01" data-key="${k}" data-month="${i}" value="${targets[i] !== undefined ? targets[i] : ''}" placeholder="设定值">
                </div>`;
            }
            return `<div class="target-row">
                <div class="target-row-header">
                    <span>🏷️ ${escapeHTML(label)}</span>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <select class="condition-select" data-key="${k}">
                            <option value="gte" ${targets.type === 'gte' || !targets.type ? 'selected' : ''}>≥ (越大越好)</option>
                            <option value="lte" ${targets.type === 'lte' ? 'selected' : ''}>≤ (越小越好)</option>
                        </select>
                        <label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer;color:#555;">
                            <input type="checkbox" class="is-percent-checkbox" data-key="${k}" ${(targets.isPercent === true || (targets.isPercent === undefined && (label.includes('率') || k.includes('率')))) ? 'checked' : ''}>
                            百分比
                        </label>
                        <span style="color:#666;font-weight:normal;font-size:13px;">实时当前值: <b style="color:#4a90e2;font-size:16px;">${escapeHTML(String(currentVal))}</b></span>
                    </div>
                </div>
                <div class="target-months">${inputsHtml}</div>
            </div>`;
        }).join('');
    }
    document.getElementById('target-modal').style.display = 'flex';
};

window.closeTargetModal = function() { document.getElementById('target-modal').style.display = 'none'; };

window.saveTargets = async function() {
    const selects = document.querySelectorAll('.condition-select');
    const inputs = document.querySelectorAll('.month-input-group input');
    const checkboxes = document.querySelectorAll('.is-percent-checkbox');
    
    // We only update the targets that are currently shown in the modal, leaving others intact
    let newTargets = JSON.parse(JSON.stringify(window.GlobalTargets || {}));
    
    selects.forEach(sel => { 
        const k = sel.getAttribute('data-key'); 
        if (!newTargets[k]) newTargets[k] = {};
        newTargets[k].type = sel.value; 
    });
    
    checkboxes.forEach(cb => {
        const k = cb.getAttribute('data-key');
        if (!newTargets[k]) newTargets[k] = {};
        newTargets[k].isPercent = cb.checked;
    });
    
    inputs.forEach(input => {
        const k = input.getAttribute('data-key'), m = input.getAttribute('data-month'), val = input.value.trim();
        if (!newTargets[k]) newTargets[k] = {};
        if (val !== '') {
            newTargets[k][m] = parseFloat(val);
        } else {
            delete newTargets[k][m];
        }
    });
    
    window.GlobalTargets = newTargets;
    try {
        await API.put('/api/sla/targets', window.GlobalTargets);
        if (window.renderSLASourcePanel) {
            await SLASection.initGlobalTargets();
            window.renderSLASourcePanel();
        }
        showToast('✅ 预警目标已保存到服务端！');
        API.logHistory('sla', '保存预警目标');
    } catch (e) { showToast('❌ 保存失败', 'error'); }
    closeTargetModal();
    renderTopStickyBar();
};

// ── 顶部栏滚动动画 ────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    const content = document.getElementById('sticky-bar-content');
    const btn = document.getElementById('btn-expand-metrics');
    const bar = document.getElementById('global-sticky-bar');
    let stickyHovered = false, stickyExpanded = false, currentScroll = 0, scrollDirection = 1;
    content.addEventListener('mouseenter', () => stickyHovered = true);
    content.addEventListener('mouseleave', () => stickyHovered = false);
    content.addEventListener('touchstart', () => stickyHovered = true);
    content.addEventListener('touchend', () => stickyHovered = false);
    btn.addEventListener('click', () => {
        stickyExpanded = !stickyExpanded;
        if (stickyExpanded) { bar.classList.add('expanded'); btn.innerHTML = '🔼 收起单行'; content.scrollLeft = 0; }
        else { bar.classList.remove('expanded'); btn.innerHTML = '🔽 展开多行'; }
    });
    (function step() {
        if (!stickyHovered && !stickyExpanded && content.scrollWidth > content.clientWidth) {
            currentScroll += scrollDirection * 0.4;
            if (currentScroll <= 0) { currentScroll = 0; scrollDirection = 1; }
            else if (currentScroll >= content.scrollWidth - content.clientWidth) { currentScroll = content.scrollWidth - content.clientWidth; scrollDirection = -1; }
            content.scrollLeft = currentScroll;
        } else { currentScroll = content.scrollLeft; }
        requestAnimationFrame(step);
    })();
});

window.evaluateAllMetrics = evaluateAllMetrics;
window.SLAMetrics = { evaluateAllMetrics, renderTopStickyBar };
window.SLATargetMonth = { get: getSLATargetMonth, init: initSLATargetMonthSelect };
