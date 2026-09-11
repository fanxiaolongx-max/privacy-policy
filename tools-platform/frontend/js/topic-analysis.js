(function () {
    'use strict';

    const state = { items: [], platform: '' };
    const elements = {};

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    }

    function formatTime(value) {
        const date = new Date(value || '');
        return Number.isNaN(date.getTime()) ? '--' : date.toLocaleString('zh-CN', { hour12: false });
    }

    function metricTotal(item) {
        return Number(item?.summary?.totalRows) || 0;
    }

    function updateStats() {
        elements.totalCount.textContent = state.items.length;
        elements.netcareCount.textContent = state.items.filter(item => item.platform === 'netcare').length;
        elements.datafabCount.textContent = state.items.filter(item => item.platform === 'datafab').length;
        const latest = state.items.slice().sort((a, b) => String(b.capturedAt).localeCompare(String(a.capturedAt)))[0];
        elements.latestTime.textContent = latest ? formatTime(latest.capturedAt) : '--';
    }

    function renderChart() {
        const items = state.items.filter(item => !state.platform || item.platform === state.platform).slice().reverse();
        if (!items.length) { elements.trendChart.innerHTML = '<div class="topic-chart-empty">导入快照后，这里将生成历史趋势</div>'; return; }
        const width = 1100; const height = 260; const pad = { left: 48, right: 24, top: 24, bottom: 42 };
        const values = items.map(metricTotal); const max = Math.max(1, ...values);
        const x = index => pad.left + (items.length === 1 ? (width - pad.left - pad.right) / 2 : index * (width - pad.left - pad.right) / (items.length - 1));
        const y = value => height - pad.bottom - value / max * (height - pad.top - pad.bottom);
        const points = values.map((value, index) => `${x(index)},${y(value)}`).join(' ');
        const grid = [0, .25, .5, .75, 1].map(ratio => { const gy = y(max * ratio); return `<line x1="${pad.left}" y1="${gy}" x2="${width - pad.right}" y2="${gy}" stroke="#dfe3ed" stroke-dasharray="4 5"/><text x="8" y="${gy + 4}" fill="#8c94a8" font-size="11">${Math.round(max * ratio)}</text>`; }).join('');
        const dots = items.map((item, index) => `<g><circle cx="${x(index)}" cy="${y(values[index])}" r="5" fill="${item.platform === 'datafab' ? '#2377e8' : '#6d35f2'}"><title>${escapeHtml(item.platform)} · ${escapeHtml(formatTime(item.capturedAt))} · ${values[index]} 条</title></circle><text x="${x(index)}" y="${height - 16}" text-anchor="middle" fill="#8c94a8" font-size="10">${escapeHtml(String(item.capturedAt || '').slice(5, 10))}</text></g>`).join('');
        elements.trendChart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img">${grid}<polyline points="${points}" fill="none" stroke="#6d35f2" stroke-width="3" stroke-linejoin="round"/>${dots}</svg>`;
    }

    function renderTable() {
        const items = state.items.filter(item => !state.platform || item.platform === state.platform);
        elements.emptyState.hidden = items.length > 0;
        elements.historyBody.innerHTML = items.map(item => `<tr>
            <td>${escapeHtml(formatTime(item.capturedAt))}</td>
            <td><span class="topic-platform ${escapeHtml(item.platform)}">${item.platform === 'datafab' ? 'DataFab' : 'NetCare'}</span></td>
            <td>${escapeHtml(item.period || '--')}</td><td>${metricTotal(item).toLocaleString('zh-CN')} 条</td>
            <td>${escapeHtml(formatTime(item.importedAt))}</td>
            <td><div class="topic-row-actions"><button data-action="view" data-id="${escapeHtml(item.id)}">查看</button><button data-action="download" data-id="${escapeHtml(item.id)}">下载</button><button class="danger" data-action="delete" data-id="${escapeHtml(item.id)}">删除</button></div></td>
        </tr>`).join('');
    }

    async function loadData() {
        elements.loadStatus.textContent = '正在读取…';
        try {
            const result = await API.get('/api/topic-snapshots?limit=200');
            state.items = Array.isArray(result.items) ? result.items : [];
            updateStats(); renderChart(); renderTable();
            elements.loadStatus.textContent = `已读取 ${state.items.length} 份快照`;
        } catch (error) {
            elements.loadStatus.textContent = `读取失败：${error.message}`;
            elements.trendChart.innerHTML = '<div class="topic-chart-empty">暂时无法读取趋势数据</div>';
        }
    }

    async function getFullSnapshot(id) {
        const result = await API.get(`/api/topic-snapshots/${encodeURIComponent(id)}`);
        return result.item;
    }

    async function handleTableAction(event) {
        const button = event.target.closest('button[data-action]'); if (!button) return;
        const { action, id } = button.dataset; button.disabled = true;
        try {
            if (action === 'delete') {
                if (!window.confirm('确定删除这份历史快照？删除后无法在分析页回顾。')) return;
                await API.delete(`/api/topic-snapshots/${encodeURIComponent(id)}`); await loadData(); return;
            }
            const item = await getFullSnapshot(id);
            if (action === 'view') {
                elements.detailTitle.textContent = `${item.platform === 'datafab' ? 'DataFab' : 'NetCare'} · ${formatTime(item.capturedAt)}`;
                elements.detailJson.textContent = JSON.stringify(item.snapshot, null, 2); elements.detailModal.hidden = false;
            } else if (action === 'download') {
                const blob = new Blob([JSON.stringify(item.snapshot, null, 2)], { type: 'application/json;charset=utf-8' });
                const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${item.platform}_topic_${String(item.capturedAt).replace(/[-:T.Z]/g, '').slice(0, 14)}.json`; link.click(); URL.revokeObjectURL(link.href);
            }
        } catch (error) { window.alert(`操作失败：${error.message}`); }
        finally { button.disabled = false; }
    }

    document.addEventListener('DOMContentLoaded', () => {
        ['totalCount', 'netcareCount', 'datafabCount', 'latestTime', 'refreshButton', 'platformFilter', 'trendChart', 'loadStatus', 'historyBody', 'emptyState', 'detailModal', 'detailTitle', 'detailJson', 'closeDetail'].forEach(id => { elements[id] = document.getElementById(id); });
        elements.refreshButton.addEventListener('click', loadData);
        elements.platformFilter.addEventListener('change', event => { state.platform = event.target.value; renderChart(); renderTable(); });
        elements.historyBody.addEventListener('click', handleTableAction);
        elements.closeDetail.addEventListener('click', () => { elements.detailModal.hidden = true; });
        elements.detailModal.addEventListener('click', event => { if (event.target === elements.detailModal) elements.detailModal.hidden = true; });
        loadData();
    });
}());
