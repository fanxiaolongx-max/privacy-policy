(function () {
    'use strict';

    const metric = (key, label, unit, description, decimals = 0) => ({ key, label, unit, description, decimals });
    const TOPICS = {
        'netcare-certificate': {
            label: 'NetCare · 证书风险', platform: 'netcare', path: 'certificate',
            metrics: [metric('total', '需消减', '个', '当期证书风险中需要消减的网元数'), metric('reduced', '已消减', '个', '已完成证书风险消减的网元数'), metric('pending', '待消减', '个', '需消减减去已消减'), metric('completionRate', '完成率', '%', '已消减 ÷ 需消减', 1)]
        },
        'netcare-eos-product': {
            label: 'NetCare · EOS 产品收编', platform: 'netcare', path: 'eosProduct',
            metrics: [metric('quantity', '总量', '个', '紧急 EOS 产品纳入收编口径的总量'), metric('incorporated', '已收编', '个', '已完成收编的产品数'), metric('pending', '待收编', '个', '源数据中待收编数量'), metric('annualPlan', '今年计划', '个', '用户录入且不超过待收编量的计划数'), metric('noPlan', '无计划', '个', '待收编减去今年计划'), metric('currentRate', '当前收编率', '%', '已收编 ÷ 总量', 1), metric('plannedRate', '计划后收编率', '%', '（已收编+今年计划）÷ 总量', 1)]
        },
        'netcare-eos-version': {
            label: 'NetCare · EOS 版本收编', platform: 'netcare', path: 'eosVersion',
            metrics: [metric('quantity', '总量', '个', '高风险 EOS 版本纳入收编口径的总量'), metric('incorporated', '已收编', '个', '已完成收编的版本数'), metric('pending', '待收编', '个', '源数据中待收编数量'), metric('annualPlan', '今年计划', '个', '用户录入且不超过待收编量的计划数'), metric('noPlan', '无计划', '个', '待收编减去今年计划'), metric('currentRate', '当前收编率', '%', '已收编 ÷ 总量', 1), metric('plannedRate', '计划后收编率', '%', '（已收编+今年计划）÷ 总量', 1)]
        },
        'netcare-change': {
            label: 'NetCare · 变更数量', platform: 'netcare', path: 'change',
            metrics: [metric('taskCount', '本年累计变更', '次', '截至快照月份的 TOTAL 变更任务数'), metric('priorTaskCount', '上年同期', '次', '上年相同月份范围内的 TOTAL 变更任务数'), metric('yoyRate', '同比变化', '%', '（本年累计-上年同期）÷ 上年同期', 1), metric('operationSuccessRate', '操作成功率', '%', '按任务数加权的本年累计操作成功率', 1), metric('rollbackCount', '回退数', '次', '本年累计回退数'), metric('highRiskCount', '高危核心', '次', '本年累计高危核心操作数')]
        },
        'netcare-interception': {
            label: 'NetCare · 高危拦截', platform: 'netcare', path: 'interception',
            metrics: [metric('total', '本年累计拦截', '次', '截至快照月份的 TOTAL 高危拦截数'), metric('priorTotal', '上年同期', '次', '上年相同月份范围的 TOTAL 拦截数'), metric('yoyRate', '同比变化', '%', '（本年累计-上年同期）÷ 上年同期', 1), metric('commandCount', '命令行拦截', '次', '本年累计命令行拦截数'), metric('graphicalCount', '图形化拦截', '次', '本年累计图形化拦截数')]
        },
        'netcare-sr': {
            label: 'NetCare · SR 问题单', platform: 'netcare', path: 'sr',
            metrics: [metric('total', '本年累计 SR', '单', '当年年初至快照月份的 TOTAL SR 数'), metric('priorTotal', '上年同期', '单', '上年相同时间范围的 TOTAL SR 数'), metric('yoyRate', '同比变化', '%', '（本年累计-上年同期）÷ 上年同期', 1), metric('frtRate', 'FRT', '%', '本年累计 SR FRT 达成率', 1), metric('openCount', '未关闭', '单', '本年累计口径中的未关闭 SR'), metric('overdueCount', '逾期', '单', '本年累计口径中的逾期 SR'), metric('majorCount', 'Major', '单', '本年累计 Major SR'), metric('criticalCount', 'Critical', '单', '本年累计 Critical SR')]
        },
        'datafab-return': {
            label: 'DataFab · 日志回传', platform: 'datafab', path: 'return',
            metrics: [metric('returnRate', '日志回传率', '%', '已回传 ÷ 需回传操作量', 1), metric('required', '需回传', '笔', '所选范围与剔除规则下的需回传操作量'), metric('returned', '已回传', '笔', '已完成日志回传的操作量'), metric('pending', '待回传', '笔', '需回传减去已回传'), metric('targetRate', '回传目标', '%', '快照导出时配置的回传率目标', 1)]
        },
        'datafab-filing': {
            label: 'DataFab · 日志备案', platform: 'datafab', path: 'filing',
            metrics: [metric('recordRate', '日志备案率', '%', '备案量 ÷ 需回传操作量', 1), metric('recorded', '备案量', '笔', '有备案原因的操作数'), metric('required', '需回传', '笔', '备案率所使用的分母'), metric('limitRate', '备案上限', '%', '快照导出时配置的备案率上限', 1), metric('rawRows', '原始明细', '条', '快照中保存的全部月度原始明细行数')]
        }
    };

    const state = { items: [], total: 0, topicKey: 'netcare-eos-product', metricKey: 'pending' };
    const elements = {};
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const formatTime = value => { const date = new Date(value || ''); return Number.isNaN(date.getTime()) ? '--' : date.toLocaleString('zh-CN', { hour12: false }); };
    const topic = () => TOPICS[state.topicKey];
    const selectedMetric = () => topic().metrics.find(item => item.key === state.metricKey) || topic().metrics[0];
    const topicData = item => item?.summary?.topics?.[topic().path];
    const topicItems = () => state.items.filter(item => item.platform === topic().platform && topicData(item)).sort((a, b) => String(b.capturedAt).localeCompare(String(a.capturedAt)));
    const metricValue = (item, definition = selectedMetric()) => Number(topicData(item)?.[definition.key]);

    function formatMetric(value, definition) {
        if (!Number.isFinite(Number(value))) return '--';
        return `${Number(value).toLocaleString('zh-CN', { minimumFractionDigits: definition.decimals, maximumFractionDigits: definition.decimals })}${definition.unit || ''}`;
    }

    function renderTopicControls() {
        const groups = { netcare: [], datafab: [] };
        Object.entries(TOPICS).forEach(([key, item]) => groups[item.platform].push(`<option value="${key}"${key === state.topicKey ? ' selected' : ''}>${escapeHtml(item.label.replace(/^\w+\s·\s/, ''))}</option>`));
        elements.topicFilter.innerHTML = `<optgroup label="NetCare">${groups.netcare.join('')}</optgroup><optgroup label="DataFab">${groups.datafab.join('')}</optgroup>`;
        elements.metricFilter.innerHTML = topic().metrics.map(item => `<option value="${item.key}"${item.key === state.metricKey ? ' selected' : ''}>${escapeHtml(item.label)}</option>`).join('');
    }

    function updateStats() {
        elements.totalCount.textContent = state.total;
        elements.netcareCount.textContent = state.items.filter(item => item.platform === 'netcare').length;
        elements.datafabCount.textContent = state.items.filter(item => item.platform === 'datafab').length;
        const latest = state.items[0]; elements.latestTime.textContent = latest ? formatTime(latest.capturedAt) : '--';
    }

    function renderKpis() {
        const items = topicItems(); const latest = items[0]; const previous = items[1];
        elements.analysisTitle.textContent = topic().label; elements.metricDefinition.textContent = selectedMetric().description;
        elements.topicKpis.innerHTML = topic().metrics.map(definition => {
            const value = metricValue(latest, definition); const prior = metricValue(previous, definition); const delta = value - prior;
            const comparison = Number.isFinite(prior) ? `较上次 ${delta > 0 ? '+' : ''}${formatMetric(delta, definition)}` : '暂无上一份快照';
            const tone = Number.isFinite(prior) ? (delta > 0 ? 'positive' : delta < 0 ? 'negative' : '') : '';
            return `<article><span>${escapeHtml(definition.label)}</span><strong>${escapeHtml(formatMetric(value, definition))}</strong><small class="${tone}">${escapeHtml(comparison)}</small></article>`;
        }).join('');
    }

    function renderChart() {
        const items = topicItems().slice().reverse(); const definition = selectedMetric();
        const plotted = items.map(item => ({ item, value: metricValue(item, definition) })).filter(point => Number.isFinite(point.value));
        if (!plotted.length) { elements.trendChart.innerHTML = '<div class="topic-chart-empty">该专题还没有可用的历史快照</div>'; return; }
        const width = 1100; const height = 260; const pad = { left: 62, right: 24, top: 24, bottom: 42 };
        const values = plotted.map(point => point.value); let min = Math.min(0, ...values); let max = Math.max(0, ...values); if (min === max) max += 1;
        const x = index => pad.left + (plotted.length === 1 ? (width - pad.left - pad.right) / 2 : index * (width - pad.left - pad.right) / (plotted.length - 1));
        const y = value => pad.top + (max - value) / (max - min) * (height - pad.top - pad.bottom);
        const points = plotted.map((point, index) => `${x(index)},${y(point.value)}`).join(' ');
        const grid = [0, .25, .5, .75, 1].map(ratio => { const value = min + (max - min) * ratio; const gy = y(value); return `<line x1="${pad.left}" y1="${gy}" x2="${width - pad.right}" y2="${gy}" stroke="#dfe3ed" stroke-dasharray="4 5"/><text x="8" y="${gy + 4}" fill="#8c94a8" font-size="11">${escapeHtml(formatMetric(value, definition))}</text>`; }).join('');
        const dots = plotted.map((point, index) => `<g><circle cx="${x(index)}" cy="${y(point.value)}" r="5" fill="${point.item.platform === 'datafab' ? '#2377e8' : '#6d35f2'}"><title>${escapeHtml(formatTime(point.item.capturedAt))} · ${escapeHtml(formatMetric(point.value, definition))}</title></circle><text x="${x(index)}" y="${height - 16}" text-anchor="middle" fill="#8c94a8" font-size="10">${escapeHtml(String(point.item.capturedAt || '').slice(5, 10))}</text></g>`).join('');
        elements.trendChart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img"><title>${escapeHtml(topic().label)} · ${escapeHtml(definition.label)}</title>${grid}<polyline points="${points}" fill="none" stroke="${topic().platform === 'datafab' ? '#2377e8' : '#6d35f2'}" stroke-width="3" stroke-linejoin="round"/>${dots}</svg>`;
    }

    function renderTable() {
        const items = topicItems(); const definition = selectedMetric(); elements.metricColumnTitle.textContent = definition.label; elements.emptyState.hidden = items.length > 0;
        elements.historyBody.innerHTML = items.map(item => `<tr><td>${escapeHtml(formatTime(item.capturedAt))}</td><td><span class="topic-platform ${escapeHtml(item.platform)}">${item.platform === 'datafab' ? 'DataFab' : 'NetCare'}</span></td><td>${escapeHtml(item.period || '--')}</td><td>${escapeHtml(formatMetric(metricValue(item, definition), definition))}</td><td>${escapeHtml(formatTime(item.importedAt))}</td><td><div class="topic-row-actions"><button data-action="view" data-id="${escapeHtml(item.id)}">查看</button><button data-action="download" data-id="${escapeHtml(item.id)}">下载</button><button class="danger" data-action="delete" data-id="${escapeHtml(item.id)}">删除</button></div></td></tr>`).join('');
    }

    function renderAnalysis() { renderKpis(); renderChart(); renderTable(); }

    async function loadData() {
        elements.loadStatus.textContent = '正在读取…';
        try {
            const result = await API.get('/api/topic-snapshots?limit=200');
            state.items = Array.isArray(result.items) ? result.items : []; state.total = Number(result.total) || state.items.length;
            updateStats(); renderAnalysis(); elements.loadStatus.textContent = `已读取 ${state.items.length} 份快照`;
        } catch (error) { elements.loadStatus.textContent = `读取失败：${error.message}`; elements.trendChart.innerHTML = '<div class="topic-chart-empty">暂时无法读取趋势数据</div>'; }
    }

    async function getFullSnapshot(id) { return (await API.get(`/api/topic-snapshots/${encodeURIComponent(id)}`)).item; }
    async function handleTableAction(event) {
        const button = event.target.closest('button[data-action]'); if (!button) return; const { action, id } = button.dataset; button.disabled = true;
        try {
            if (action === 'delete') { if (!window.confirm('确定删除这份历史快照？删除后无法在分析页回顾。')) return; await API.delete(`/api/topic-snapshots/${encodeURIComponent(id)}`); await loadData(); return; }
            const item = await getFullSnapshot(id);
            if (action === 'view') { elements.detailTitle.textContent = `${item.platform === 'datafab' ? 'DataFab' : 'NetCare'} · ${formatTime(item.capturedAt)}`; elements.detailJson.textContent = JSON.stringify(item.snapshot, null, 2); elements.detailModal.hidden = false; }
            else { const blob = new Blob([JSON.stringify(item.snapshot, null, 2)], { type: 'application/json;charset=utf-8' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${item.platform}_topic_${String(item.capturedAt).replace(/[-:T.Z]/g, '').slice(0, 14)}.json`; link.click(); URL.revokeObjectURL(link.href); }
        } catch (error) { window.alert(`操作失败：${error.message}`); } finally { button.disabled = false; }
    }

    document.addEventListener('DOMContentLoaded', () => {
        ['totalCount', 'netcareCount', 'datafabCount', 'latestTime', 'refreshButton', 'topicFilter', 'metricFilter', 'analysisTitle', 'metricDefinition', 'topicKpis', 'trendChart', 'metricColumnTitle', 'loadStatus', 'historyBody', 'emptyState', 'detailModal', 'detailTitle', 'detailJson', 'closeDetail'].forEach(id => { elements[id] = document.getElementById(id); });
        renderTopicControls(); elements.refreshButton.addEventListener('click', loadData);
        elements.topicFilter.addEventListener('change', event => { state.topicKey = event.target.value; state.metricKey = topic().metrics[0].key; renderTopicControls(); renderAnalysis(); });
        elements.metricFilter.addEventListener('change', event => { state.metricKey = event.target.value; renderAnalysis(); });
        elements.historyBody.addEventListener('click', handleTableAction); elements.closeDetail.addEventListener('click', () => { elements.detailModal.hidden = true; });
        elements.detailModal.addEventListener('click', event => { if (event.target === elements.detailModal) elements.detailModal.hidden = true; }); loadData();
    });
}());
