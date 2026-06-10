let latestSLAHistorySnapshots = [];
let latestSLAHistoryI18nMap = {};
let latestSLAHistoryMetricFormatMap = {};

function getHistorySecIdFromPrefKey(prefKey) {
    const normalized = String(prefKey || '');
    if (normalized.startsWith('sla_prefs_other_')) return normalized.replace('sla_prefs_', '');
    if (normalized.startsWith('sla_prefs_rectification')) return 'rectification';
    if (normalized.startsWith('sla_prefs_risk')) return 'risk';
    if (normalized.startsWith('sla_prefs_special')) return 'special';
    if (normalized.startsWith('sla_prefs_sr')) return 'sr';
    if (normalized.startsWith('sla_prefs_vulnerability')) return 'vulnerability';
    return normalized.replace('sla_prefs_', '');
}

function buildHistoryMetricFormatMap(configData) {
    const targets = (configData && configData.targets) || {};
    const prefs = (configData && configData.prefs) || {};
    const out = {};
    Object.values(targets).forEach(target => {
        if (target && target.label && target.isPercent !== undefined) out[target.label] = { isPercent: target.isPercent };
    });
    Object.entries(prefs).forEach(([prefKey, pref]) => {
        if (!pref || !Array.isArray(pref.customMetrics)) return;
        const secId = getHistorySecIdFromPrefKey(prefKey);
        pref.customMetrics.forEach(rule => {
            const target = targets[`${secId}_${rule.id}`];
            if (rule.label && target && target.isPercent !== undefined) out[rule.label] = { isPercent: target.isPercent };
            (rule.subMetrics || []).forEach(sm => {
                const subTarget = targets[`${secId}_${sm.id}`] || target;
                const label = sm.label || rule.label || sm.category;
                if (label && subTarget && subTarget.isPercent !== undefined) out[label] = { isPercent: subTarget.isPercent };
            });
        });
    });
    return out;
}

function getHistoryMetricLabel(label) {
    const raw = String(label || '').trim();
    if (!raw) return raw;
    const lang = window.ToolsI18n ? window.ToolsI18n.getLanguage() : 'zh-CN';
    if (lang !== 'en-US') return raw;
    return latestSLAHistoryI18nMap[raw] || raw;
}

function getHistoryStatusLabel(status) {
    const raw = String(status || '').trim();
    if (!raw) return raw;
    const lang = window.ToolsI18n ? window.ToolsI18n.getLanguage() : 'zh-CN';
    if (lang !== 'en-US') return raw;
    const statusMap = {
        '达标': 'Met',
        '落后': 'Behind',
        '超标': 'Exceeded',
        '预警': 'Warning'
    };
    return statusMap[raw] || raw;
}

function getHistoryMetricValue(label, value) {
    const format = latestSLAHistoryMetricFormatMap[String(label || '').trim()];
    const raw = String(value ?? '').trim();
    if (format && format.isPercent === false && raw.endsWith('%')) return raw.replace(/%$/, '');
    return String(value ?? '');
}

async function openHistoryModal() {
    const modal = document.getElementById('history-modal');
    if(modal) modal.style.display = 'flex';
    const list = document.getElementById('history-modal-list');
    if(list) list.innerHTML = `<div class="loading-text">${SLAT('sla.history.loadingShort')}</div>`;
    try {
        const mode = API.getSourceMode('sla_data');
        const query = mode === 'auto' ? '' : `?mode=${encodeURIComponent(mode)}`;
        const [data, configData] = await Promise.all([
            API.get(`/api/sla/snapshots${query}`),
            API.get(`/api/sla/config${query}`).catch(() => null)
        ]);
        latestSLAHistorySnapshots = Array.isArray(data) ? data : [];
        latestSLAHistoryI18nMap = (configData && configData.prefs && configData.prefs.i18nMap) || {};
        latestSLAHistoryMetricFormatMap = buildHistoryMetricFormatMap(configData);
        if (window.renderSLASourcePanel) window.renderSLASourcePanel();
        renderHistory(latestSLAHistorySnapshots);
    } catch(e) {
        if (window.renderSLASourcePanel) window.renderSLASourcePanel();
        if(list) list.innerHTML = `<div style="color:red;padding:20px;">${SLAT('sla.history.loadFail', { message: e.message })}</div>`;
    }
}

function closeHistoryModal() {
    const modal = document.getElementById('history-modal');
    if(modal) modal.style.display = 'none';
}

function renderHistory(data) {
    const list = document.getElementById('history-modal-list');
    if(!list) return;
    
    if(!data || !data.length) {
        list.innerHTML = `<div style="padding:40px;text-align:center;color:#666;">${SLAT('sla.history.empty')}</div>`;
        return;
    }

    // 1. 收集所有出现过的核心指标名称作为表头
    const metricKeys = new Set();
    data.forEach(item => {
        if (item.topMetrics) {
            item.topMetrics.forEach(m => metricKeys.add(m.label));
        }
    });
    const metricHeaders = Array.from(metricKeys);

    let html = `
    <style>
        .history-table-wrapper { overflow: auto; max-width: 100%; height: 100%; border-radius: 4px; position: relative; }
        .history-table { width: max-content; min-width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
        .history-table th { background: #f1f3f4; padding: 10px; text-align: left; border-bottom: 2px solid #ccc; border-right: 1px solid #ddd; position: sticky; top: 0; z-index: 10; font-weight: bold; white-space: nowrap; }
        .history-table td { padding: 8px 10px; border-bottom: 1px solid #eee; border-right: 1px solid #eee; vertical-align: middle; white-space: nowrap; }
        .history-table tr:hover td { background: #f9f9f9; }
        .history-table td.warn-cell { background: #ffebee; border-left: 2px solid #ef5350; }
        .snap-gap { display: block; font-size: 10px; color: #d32f2f; font-weight: bold; margin-top: 2px; }
        .snap-value-normal { color: #555; }
        .snap-value-warn { color: #d32f2f; font-weight: bold; font-size: 14px; }
        .sticky-col { left: 0; position: sticky; background: #e0e0e0 !important; z-index: 20 !important; box-shadow: 2px 0 5px rgba(0,0,0,0.1); border-right: 2px solid #ccc !important; }
        .sticky-col-td { left: 0; position: sticky; background: #fafafa !important; z-index: 11 !important; box-shadow: 2px 0 5px rgba(0,0,0,0.05); border-right: 2px solid #ccc !important; }
        .history-table tr:hover td.sticky-col-td { background: #f0f0f0 !important; }
        .summary-col { min-width: 350px; white-space: normal !important; word-wrap: break-word; }
    </style>
    <div class="history-table-wrapper">
    <table class="history-table">
        <thead>
            <tr>
                <th class="sticky-col" style="min-width: 140px;">${SLAT('sla.history.importTime')}</th>
                <th>${SLAT('sla.history.sourceTables')}</th>
                ${metricHeaders.map(h => `<th title="${escapeHTML(h)}">${escapeHTML(getHistoryMetricLabel(h))}</th>`).join('')}
                <th class="summary-col">${SLAT('sla.history.summary')}</th>
            </tr>
        </thead>
        <tbody>
    `;

    data.forEach(item => {
        const d = new Date(item.timestamp).toLocaleString('zh-CN', { hour12: false });
        
        // 构建当前行的指标 map
        const mMap = {};
        if (item.topMetrics) {
            item.topMetrics.forEach(m => {
                mMap[m.label] = m;
            });
        }

        let metricColsHtml = '';
        metricHeaders.forEach(h => {
            const m = mMap[h];
            if (m) {
                let cellSubHtml = '';
                if (m.subMetrics && m.subMetrics.length > 0) {
                    cellSubHtml = `<div style="margin-top:4px; font-size:10px; color:#666; border-top:1px solid #e0e0e0; padding-top:2px;">`;
                    m.subMetrics.forEach(sm => {
                        const categoryLabel = getHistoryMetricLabel(sm.category);
                        cellSubHtml += `<div style="margin-bottom:2px;" title="${escapeHTML(sm.category)}">${escapeHTML(categoryLabel)}: <b style="color:#e65100">${escapeHTML(String(sm.value))}</b></div>`;
                    });
                    cellSubHtml += `</div>`;
                }

                if (m.isWarn) {
                    const gapText = m.gap ? `<span class="snap-gap">${m.gap}</span>` : '';
                    metricColsHtml += `<td class="warn-cell" style="vertical-align:top;"><span class="snap-value-warn">${escapeHTML(getHistoryMetricValue(h, m.value))}</span>${gapText}${cellSubHtml}</td>`;
                } else {
                    const safeColor = m.color && m.color.includes('#') ? m.color : '#333';
                    metricColsHtml += `<td style="vertical-align:top;"><span class="snap-value-normal" style="color:${safeColor}; font-weight:bold;">${escapeHTML(getHistoryMetricValue(h, m.value))}</span>${cellSubHtml}</td>`;
                }
            } else {
                metricColsHtml += `<td style="color:#ccc; vertical-align:top;">--</td>`;
            }
        });

        // 区块汇总渲染
        let summaryHtml = '';
        if(item.summary && item.summary.length) {
            item.summary.forEach(sec => {
                let secText = `<strong style="color:#555;">${escapeHTML(sec.section.replace(/\s*合集/, ''))}</strong>: `;
                sec.metrics.forEach(m => {
                    const statusColor = (m.status || '').includes('达标') ? '#388e3c' : ((m.status || '').includes('落后') ? '#d32f2f' : '#888');
                    const metricTitle = getHistoryMetricLabel(m.title);
                    const statusLabel = getHistoryStatusLabel(m.status);
                    secText += `<span style="margin-right:6px;" title="${escapeHTML(m.title)}">${escapeHTML(metricTitle)} <strong style="color:#333">${escapeHTML(getHistoryMetricValue(m.title, m.value))}</strong> <span style="color:${statusColor}">${escapeHTML(statusLabel)}</span></span>`;
                });
                summaryHtml += `<div style="margin-bottom:4px; font-size:11px; background:#f5f5f5; padding:3px 6px; border-radius:4px;">${secText}</div>`;
            });
        }

        html += `
            <tr>
                <td class="sticky-col-td" style="color:#1976d2; font-weight:bold;">
                    ${d}
                    <button onclick="deleteHistorySnapshot('${item.id}')" style="margin-left:8px; padding:2px 6px; font-size:10px; background:#fff; border:1px solid #ffcdd2; color:#d32f2f; border-radius:4px; cursor:pointer;" title="${SLAT('sla.history.deleteTitle')}" onmouseover="this.style.background='#ffebee'" onmouseout="this.style.background='#fff'">${SLAT('sla.history.delete')}</button>
                </td>
                <td><span style="background:#e3f2fd; padding:2px 6px; border-radius:10px; color:#1565c0;">${item.files.length}</span></td>
                ${metricColsHtml}
                <td class="summary-col">${summaryHtml}</td>
            </tr>
        `;
    });
    
    html += `</tbody></table></div>`;
    list.innerHTML = html;
}

window.deleteHistorySnapshot = async function(id) {
    if (!confirm(SLAT('sla.history.confirmDelete'))) return;
    try {
        await API.delete('/api/sla/snapshots/' + encodeURIComponent(id));
        showToast(SLAT('sla.history.deleted'));
        // 重新加载快照列表
        openHistoryModal();
    } catch(e) {
        showToast(SLAT('sla.history.deleteFail', { message: e.message }), 'error');
    }
};

window.openHistoryModal = openHistoryModal;
window.closeHistoryModal = closeHistoryModal;

window.addEventListener('tools:languagechange', () => {
    const modal = document.getElementById('history-modal');
    if (modal && modal.style.display === 'flex' && Array.isArray(latestSLAHistorySnapshots)) {
        renderHistory(latestSLAHistorySnapshots);
    }
});
