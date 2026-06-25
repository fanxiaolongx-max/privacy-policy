(function () {
    const state = {
        trends: [],
        latest: null,
        snapshots: [],
        charts: {},
        monthlyPath: '/api/db/monthly_report_data'
    };

    function $(id) {
        return document.getElementById(id);
    }

    function escapeHTML(value) {
        return String(value ?? '').replace(/[&<>'"]/g, tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag));
    }

    function num(value, fallback = 0) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function fmt(value, digits = 1) {
        const n = num(value, 0);
        return n.toFixed(digits);
    }

    function fmtDate(date = new Date()) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function parseRaw(raw) {
        if (!raw) return {};
        if (typeof raw === 'object') return raw;
        try {
            return JSON.parse(raw);
        } catch (e) {
            return {};
        }
    }

    function getCurrentRange() {
        const range = $('rangeSelect') ? $('rangeSelect').value : '30';
        const params = new URLSearchParams();
        if (range === 'all') return { range, query: '' };

        let start = $('startDate') ? $('startDate').value : '';
        let end = $('endDate') ? $('endDate').value : '';

        if (range !== 'custom') {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - parseInt(range, 10));
            start = fmtDate(startDate);
            end = fmtDate(endDate);
            if ($('startDate')) $('startDate').value = start;
            if ($('endDate')) $('endDate').value = end;
        }

        if (start && end) {
            params.set('startDate', start);
            params.set('endDate', end);
        }
        return { range, start, end, query: params.toString() ? `?${params.toString()}` : '' };
    }

    function setLoading(loading) {
        const btn = $('refreshBtn');
        if (!btn) return;
        btn.disabled = loading;
        btn.textContent = loading ? '加载中' : '刷新';
    }

    function metricSummary(latest) {
        const metrics = Array.isArray(latest && latest.metrics) ? latest.metrics : [];
        const failing = metrics.filter(item => Number(item.is_failing) === 1);
        const pass = Math.max(metrics.length - failing.length, 0);
        return {
            total: metrics.length,
            failing: failing.length,
            pass,
            passRate: metrics.length ? pass / metrics.length * 100 : 0
        };
    }

    function scoreTone(score) {
        if (score >= 95) return 'good';
        if (score >= 85) return 'warn';
        return 'bad';
    }

    function renderKpis() {
        const latest = state.latest || {};
        const trends = state.trends || [];
        const lastTrend = trends[trends.length - 1] || {};
        const stats = metricSummary(latest);
        const catScores = Array.isArray(latest.cat_scores) ? latest.cat_scores : [];
        const raw = parseRaw(latest.raw_data_json);
        const expiringCount = Array.isArray(raw.expiringTickets) ? raw.expiringTickets.length : 0;
        const specialCount = Array.isArray(raw.specialMetricAlerts) ? raw.specialMetricAlerts.length : 0;
        const score = num(latest.total_score ?? lastTrend.total_score, 0);
        const rate = num(lastTrend.compliance_rate, stats.passRate);
        const minScore = catScores.length ? Math.min(...catScores.map(item => num(item.final_score, 0))) : 0;

        const kpis = [
            { label: '综合总分', value: fmt(score, 1), foot: `目标月: ${latest.month || lastTrend.month || '-'}`, tone: scoreTone(score) },
            { label: '整体达标率', value: `${fmt(rate, 1)}%`, foot: `${stats.pass}/${stats.total} 项指标达标`, tone: rate >= 95 ? 'good' : (rate >= 85 ? 'warn' : 'bad') },
            { label: '未达标项', value: stats.failing, foot: '最新快照指标明细', tone: stats.failing ? 'bad' : 'good' },
            { label: '客户群数量', value: catScores.length, foot: `最低得分 ${fmt(minScore, 1)}`, tone: minScore >= 85 ? 'good' : 'warn' },
            { label: '历史快照', value: state.snapshots.length || trends.length, foot: `${trends.length} 份纳入当前趋势`, tone: 'good' },
            { label: '预警信号', value: expiringCount + specialCount, foot: `临期 ${expiringCount} / 特殊 ${specialCount}`, tone: expiringCount + specialCount ? 'warn' : 'good' }
        ];

        $('kpiRow').innerHTML = kpis.map(item => `
            <div class="kpi">
                <div class="kpi-label">${escapeHTML(item.label)}</div>
                <div class="kpi-value ${item.tone || ''}">${escapeHTML(item.value)}</div>
                <div class="kpi-foot">${escapeHTML(item.foot)}</div>
            </div>
        `).join('');
    }

    function renderRankList() {
        const catScores = Array.isArray(state.latest && state.latest.cat_scores) ? state.latest.cat_scores : [];
        if (!catScores.length) {
            $('rankList').innerHTML = '<div class="empty">暂无客户群得分数据</div>';
            return;
        }
        const rows = [...catScores]
            .sort((a, b) => num(b.final_score) - num(a.final_score))
            .slice(0, 10);
        $('rankList').innerHTML = rows.map((item, index) => `
            <div class="rank-row">
                <div class="rank-no">${index + 1}</div>
                <div>
                    <div class="row-name" title="${escapeHTML(item.cat_name)}">${escapeHTML(item.cat_name)}</div>
                    <div class="row-meta">基准 ${fmt(item.base_score, 1)} · 调整 ${fmt(item.manual_score, 1)}</div>
                </div>
                <div class="rank-score">${fmt(item.final_score, 1)}</div>
            </div>
        `).join('');
    }

    function groupFailingMetrics() {
        const metrics = Array.isArray(state.latest && state.latest.metrics) ? state.latest.metrics : [];
        const grouped = {};
        metrics.filter(item => Number(item.is_failing) === 1).forEach(item => {
            const label = item.metric_label || '未命名指标';
            if (!grouped[label]) {
                grouped[label] = {
                    label,
                    target: item.target_val || '-',
                    count: 0,
                    cats: [],
                    values: []
                };
            }
            grouped[label].count += 1;
            grouped[label].cats.push(item.cat_name || '-');
            grouped[label].values.push(item.raw_val || item.num_val || '-');
        });
        return Object.values(grouped).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    }

    function renderWeakList() {
        const rows = groupFailingMetrics().slice(0, 10);
        if (!rows.length) {
            $('weakList').innerHTML = '<div class="empty">当前最新快照无未达标项</div>';
            return;
        }
        $('weakList').innerHTML = rows.map(item => `
            <div class="weak-row">
                <div>
                    <div class="row-name" title="${escapeHTML(item.label)}">${escapeHTML(item.label)}</div>
                    <div class="row-meta">目标 ${escapeHTML(item.target)} · ${escapeHTML(item.cats.slice(0, 4).join('、'))}${item.cats.length > 4 ? ' 等' : ''}</div>
                </div>
                <div class="weak-count">${item.count}</div>
            </div>
        `).join('');
    }

    function renderMetricList() {
        const metrics = Array.isArray(state.latest && state.latest.metrics) ? state.latest.metrics : [];
        if (!metrics.length) {
            $('metricList').innerHTML = '<div class="empty">暂无指标明细数据</div>';
            return;
        }
        const rows = [...metrics]
            .sort((a, b) => Number(b.is_failing) - Number(a.is_failing) || num(a.earned_score, 999) - num(b.earned_score, 999))
            .slice(0, 12);
        $('metricList').innerHTML = rows.map(item => `
            <div class="metric-row">
                <div>
                    <div class="row-name" title="${escapeHTML(item.metric_label)}">${escapeHTML(item.metric_label)}</div>
                    <div class="row-meta">${escapeHTML(item.cat_name || '-')}</div>
                </div>
                <div class="row-meta">实测 ${escapeHTML(item.raw_val ?? item.num_val ?? '-')}</div>
                <div class="row-meta">目标 ${escapeHTML(item.target_val || '-')}</div>
                <div><span class="pill ${Number(item.is_failing) === 1 ? 'bad' : ''}">${Number(item.is_failing) === 1 ? '风险' : '达标'}</span></div>
            </div>
        `).join('');
    }

    function chartTextColor() {
        return '#b7cbe0';
    }

    function renderTrendChart() {
        const dom = $('trendChart');
        if (!dom || !window.echarts) return;
        const trends = state.trends || [];
        if (!state.charts.trend) state.charts.trend = echarts.init(dom);
        const dates = trends.map(item => item.date);
        const rates = trends.map(item => fmt(item.compliance_rate, 1));
        const scores = trends.map(item => fmt(item.total_score, 1));
        const failing = trends.map(item => num(item.metrics_failing, 0));

        state.charts.trend.setOption({
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis' },
            legend: {
                top: 6,
                textStyle: { color: chartTextColor() },
                data: ['达标率', '综合总分', '未达标项']
            },
            grid: { left: 46, right: 48, top: 58, bottom: 36 },
            xAxis: {
                type: 'category',
                data: dates,
                axisLine: { lineStyle: { color: 'rgba(183,203,224,0.34)' } },
                axisLabel: { color: chartTextColor() }
            },
            yAxis: [
                {
                    type: 'value',
                    min: 0,
                    max: 100,
                    axisLabel: { color: chartTextColor(), formatter: '{value}%' },
                    splitLine: { lineStyle: { color: 'rgba(120,190,255,0.12)' } }
                },
                {
                    type: 'value',
                    min: 0,
                    axisLabel: { color: chartTextColor() },
                    splitLine: { show: false }
                }
            ],
            series: [
                {
                    name: '达标率',
                    type: 'line',
                    smooth: true,
                    data: rates,
                    symbolSize: 7,
                    lineStyle: { width: 3, color: '#39d5ff' },
                    itemStyle: { color: '#39d5ff' },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(57,213,255,0.28)' },
                            { offset: 1, color: 'rgba(57,213,255,0.02)' }
                        ])
                    }
                },
                {
                    name: '综合总分',
                    type: 'line',
                    smooth: true,
                    data: scores,
                    symbolSize: 6,
                    lineStyle: { width: 2, color: '#38e6a3' },
                    itemStyle: { color: '#38e6a3' }
                },
                {
                    name: '未达标项',
                    type: 'bar',
                    yAxisIndex: 1,
                    data: failing,
                    barMaxWidth: 20,
                    itemStyle: { color: 'rgba(255,93,115,0.72)' }
                }
            ]
        }, true);
    }

    function renderRiskChart() {
        const dom = $('riskChart');
        if (!dom || !window.echarts) return;
        if (!state.charts.risk) state.charts.risk = echarts.init(dom);
        const weakRows = groupFailingMetrics();
        const data = weakRows.length
            ? weakRows.slice(0, 8).map(item => ({ name: item.label, value: item.count }))
            : [{ name: '无风险项', value: 1 }];

        state.charts.risk.setOption({
            backgroundColor: 'transparent',
            tooltip: { trigger: 'item' },
            legend: {
                type: 'scroll',
                orient: 'vertical',
                right: 0,
                top: 8,
                bottom: 8,
                width: 110,
                textStyle: { color: chartTextColor(), fontSize: 11 }
            },
            series: [{
                name: '风险分布',
                type: 'pie',
                radius: ['46%', '72%'],
                center: ['38%', '50%'],
                avoidLabelOverlap: true,
                label: { color: '#e8f7ff', formatter: '{b}\n{c}' },
                labelLine: { lineStyle: { color: 'rgba(183,203,224,0.45)' } },
                itemStyle: {
                    borderColor: '#07111f',
                    borderWidth: 2
                },
                color: ['#ff5d73', '#ffc857', '#39d5ff', '#38e6a3', '#7aa7ff', '#f1895c', '#8bd7ca', '#c6e477'],
                data
            }]
        }, true);
    }

    function renderSourceStrip() {
        const trendMeta = window.API.getLastDataSourceMeta(state.monthlyPath) || window.API.getLastDataSourceMeta('/api/db/monthly_report_data') || {};
        const snapshotsMeta = window.API.getLastDataSourceMeta('/api/db/snapshots') || {};
        const now = new Date().toLocaleString('zh-CN', { hour12: false });
        $('sourceStrip').innerHTML = `
            <span>趋势来源: ${escapeHTML(trendMeta.primary || '-')}</span>
            <span>快照来源: ${escapeHTML(snapshotsMeta.primary || '-')}</span>
            <span>最新刷新: ${escapeHTML(now)}</span>
            <span>数据口径: 月报趋势 + 报表看板入库快照</span>
        `;
    }

    function renderSubtitle() {
        const trends = state.trends || [];
        const latest = state.latest || {};
        if (!trends.length) {
            $('bigscreenSubtitle').textContent = '当前筛选范围内暂无入库数据。';
            $('bigscreenStatus').textContent = 'NO DATA';
            return;
        }
        const start = trends[0].date;
        const end = trends[trends.length - 1].date;
        $('bigscreenSubtitle').textContent = `分析周期 ${start} 至 ${end}，最新快照 ${latest.snapshot_id || '-'}，目标月份 ${latest.month || '-'}`;
        $('bigscreenStatus').textContent = 'REPORT.DB LIVE';
    }

    function renderEmptyPage(message) {
        $('kpiRow').innerHTML = '';
        ['rankList', 'weakList', 'metricList'].forEach(id => {
            $(id).innerHTML = `<div class="empty">${escapeHTML(message)}</div>`;
        });
        Object.values(state.charts).forEach(chart => chart && chart.clear && chart.clear());
        renderSubtitle();
        renderSourceStrip();
    }

    function renderAll() {
        if (!state.trends.length || !state.latest) {
            renderEmptyPage('暂无可展示数据，请先在报表看板完成入库。');
            return;
        }
        renderSubtitle();
        renderKpis();
        renderRankList();
        renderWeakList();
        renderMetricList();
        renderTrendChart();
        renderRiskChart();
        renderSourceStrip();
    }

    async function loadBigscreenData() {
        setLoading(true);
        try {
            const range = getCurrentRange();
            state.monthlyPath = `/api/db/monthly_report_data${range.query}`;
            const [monthlyData, snapshots] = await Promise.all([
                window.API.get(state.monthlyPath),
                window.API.get('/api/db/snapshots')
            ]);
            state.trends = Array.isArray(monthlyData && monthlyData.trends) ? monthlyData.trends : [];
            state.latest = monthlyData ? monthlyData.latest_snapshot : null;
            state.snapshots = Array.isArray(snapshots) ? snapshots : [];
            renderAll();
        } catch (error) {
            console.error('[bigscreen] load failed:', error);
            if (window.showToast) window.showToast(`大屏数据加载失败: ${error.message}`, 'error');
            renderEmptyPage(`加载失败: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }

    function initControls() {
        const rangeSelect = $('rangeSelect');
        const startInput = $('startDate');
        const endInput = $('endDate');
        if (rangeSelect) {
            rangeSelect.addEventListener('change', () => {
                const custom = rangeSelect.value === 'custom';
                if (!custom) loadBigscreenData();
                if (startInput) startInput.disabled = !custom;
                if (endInput) endInput.disabled = !custom;
            });
        }
        if (startInput) startInput.disabled = true;
        if (endInput) endInput.disabled = true;
        if ($('refreshBtn')) $('refreshBtn').addEventListener('click', loadBigscreenData);
        window.addEventListener('resize', () => {
            Object.values(state.charts).forEach(chart => chart && chart.resize && chart.resize());
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        initControls();
        loadBigscreenData();
        setInterval(loadBigscreenData, 5 * 60 * 1000);
    });
})();
