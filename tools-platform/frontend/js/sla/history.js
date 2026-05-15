async function openHistoryModal() {
    const modal = document.getElementById('history-modal');
    if(modal) modal.style.display = 'flex';
    const list = document.getElementById('history-modal-list');
    if(list) list.innerHTML = '<div class="loading-text">正在加载...</div>';
    try {
        const data = await API.get('/api/sla/snapshots');
        renderHistory(data);
    } catch(e) {
        if(list) list.innerHTML = '<div style="color:red;padding:20px;">加载失败：' + e.message + '</div>';
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
        list.innerHTML = '<div style="padding:40px;text-align:center;color:#666;">暂无历史快照记录。请先使用上方按钮导入表格数据以生成。</div>';
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
                <th class="sticky-col" style="min-width: 140px;">🕒 导入时间</th>
                <th>源表数</th>
                ${metricHeaders.map(h => `<th>${h}</th>`).join('')}
                <th class="summary-col">📊 汇总数据</th>
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
                        cellSubHtml += `<div style="margin-bottom:2px;">${escapeHTML(sm.category)}: <b style="color:#e65100">${escapeHTML(String(sm.value))}</b></div>`;
                    });
                    cellSubHtml += `</div>`;
                }

                if (m.isWarn) {
                    const gapText = m.gap ? `<span class="snap-gap">${m.gap}</span>` : '';
                    metricColsHtml += `<td class="warn-cell" style="vertical-align:top;"><span class="snap-value-warn">${m.value}</span>${gapText}${cellSubHtml}</td>`;
                } else {
                    const safeColor = m.color && m.color.includes('#') ? m.color : '#333';
                    metricColsHtml += `<td style="vertical-align:top;"><span class="snap-value-normal" style="color:${safeColor}; font-weight:bold;">${m.value}</span>${cellSubHtml}</td>`;
                }
            } else {
                metricColsHtml += `<td style="color:#ccc; vertical-align:top;">--</td>`;
            }
        });

        // 区块汇总渲染
        let summaryHtml = '';
        if(item.summary && item.summary.length) {
            item.summary.forEach(sec => {
                let secText = `<strong style="color:#555;">${sec.section.replace(/\s*合集/, '')}</strong>: `;
                sec.metrics.forEach(m => {
                    const statusColor = (m.status || '').includes('达标') ? '#388e3c' : ((m.status || '').includes('落后') ? '#d32f2f' : '#888');
                    secText += `<span style="margin-right:6px;">${m.title} <strong style="color:#333">${m.value}</strong> <span style="color:${statusColor}">${m.status || ''}</span></span>`;
                });
                summaryHtml += `<div style="margin-bottom:4px; font-size:11px; background:#f5f5f5; padding:3px 6px; border-radius:4px;">${secText}</div>`;
            });
        }

        html += `
            <tr>
                <td class="sticky-col-td" style="color:#1976d2; font-weight:bold;">${d}</td>
                <td><span style="background:#e3f2fd; padding:2px 6px; border-radius:10px; color:#1565c0;">${item.files.length}</span></td>
                ${metricColsHtml}
                <td class="summary-col">${summaryHtml}</td>
            </tr>
        `;
    });
    
    html += `</tbody></table></div>`;
    list.innerHTML = html;
}

window.openHistoryModal = openHistoryModal;
window.closeHistoryModal = closeHistoryModal;
