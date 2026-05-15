/**
 * sla/metrics.js - 顶部数据舱：指标推送、预警呼吸灯、目标配置弹窗
 */

function evaluateAllMetrics() {
    window.GlobalMetrics = {};
    Object.keys(AppState).forEach(secId => {
        const state = AppState[secId];
        if (!state.customMetrics || !state.customMetrics.length) return;
        state.customMetrics.forEach(rule => {
            let matchedValue = '--';
            for (let i = 0; i < state.globalData.length; i++) {
                const row = state.globalData[i];
                const cellValX = row[rule.colX];
                if (cellValX !== undefined && cellValX !== null && cellValX.toString().includes(rule.valY)) {
                    matchedValue = row[rule.colZ] !== undefined && row[rule.colZ] !== null ? row[rule.colZ] : '--';
                    break;
                }
            }
            if (rule.label.includes('率') && matchedValue !== '--') {
                const strVal = matchedValue.toString().trim();
                const isPercent = strVal.endsWith('%');
                const num = parseFloat(strVal);
                if (!isNaN(num)) matchedValue = isPercent ? Math.round(num) + '%' : Math.round(num * 100) + '%';
            }
            window.GlobalMetrics[`${secId}_${rule.id}`] = { label: rule.label, value: matchedValue, color: rule.color };
        });
    });
    renderTopStickyBar();
}

function renderTopStickyBar() {
    const content = document.getElementById('sticky-bar-content');
    const btnExpand = document.getElementById('btn-expand-metrics');
    const btnTarget = document.getElementById('btn-target-config');
    const keys = Object.keys(window.GlobalMetrics);
    const cm = new Date().getMonth() + 1;
    if (!keys.length) {
        content.innerHTML = '<span style="color:#888;">(当前未配置指标，请在下方独立表格中点击"🎯 指标"添加)</span>';
        btnExpand.style.display = 'none'; btnTarget.style.display = 'none'; return;
    }
    btnExpand.style.display = 'inline-block'; btnTarget.style.display = 'inline-block';
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
        html += `<div class="info-group"><div class="info-item ${highlightClass}">
            <span class="info-label">${escapeHTML(m.label)}:</span>
            <span class="info-value ${colorClass}">${escapeHTML(String(m.value))}</span>${gapHtml}
        </div></div>`;
    });
    content.innerHTML = html;
}

// ── 预警目标弹窗 ──────────────────────────────────────────

window.openTargetModal = function() {
    const modalList = document.getElementById('target-modal-list');
    const keys = Object.keys(window.GlobalMetrics);
    if (!keys.length) {
        modalList.innerHTML = '<div style="text-align:center;padding:30px;color:#888;font-size:16px;">请先在下方独立表格中点击"🎯 指标"，添加推送规则后，再来配置预警。</div>';
    } else {
        modalList.innerHTML = keys.map(k => {
            const m = window.GlobalMetrics[k];
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
                    <span>🏷️ ${escapeHTML(m.label)}</span>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <select class="condition-select" data-key="${k}">
                            <option value="gte" ${targets.type === 'gte' || !targets.type ? 'selected' : ''}>≥ (越大越好)</option>
                            <option value="lte" ${targets.type === 'lte' ? 'selected' : ''}>≤ (越小越好)</option>
                        </select>
                        <span style="color:#666;font-weight:normal;font-size:13px;">实时当前值: <b style="color:#4a90e2;font-size:16px;">${escapeHTML(String(m.value))}</b></span>
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
    let newTargets = {};
    Object.keys(window.GlobalMetrics).forEach(k => { newTargets[k] = {}; });
    selects.forEach(sel => { const k = sel.getAttribute('data-key'); if (newTargets[k]) newTargets[k].type = sel.value; });
    inputs.forEach(input => {
        const k = input.getAttribute('data-key'), m = input.getAttribute('data-month'), val = input.value.trim();
        if (val !== '') newTargets[k][m] = parseFloat(val);
    });
    window.GlobalTargets = newTargets;
    try {
        await API.put('/api/sla/targets', window.GlobalTargets);
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
