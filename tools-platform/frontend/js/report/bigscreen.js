(function () {
    const state = {
        trends: [],
        latest: null,
        snapshots: [],
        owners: [],
        ownerDraft: [],
        pendingOwnerAvatar: '',
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
        const metricLabels = [...new Set(metrics.map(item => item.metric_label || '未命名指标'))];
        const failingLabels = [...new Set(failing.map(item => item.metric_label || '未命名指标'))];
        return {
            total: metrics.length,
            failing: failing.length,
            pass,
            passRate: metrics.length ? pass / metrics.length * 100 : 0,
            metricTotal: metricLabels.length,
            metricFailing: failingLabels.length,
            metricPassing: Math.max(metricLabels.length - failingLabels.length, 0),
            metricPassRate: metricLabels.length ? (metricLabels.length - failingLabels.length) / metricLabels.length * 100 : 0
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
        const raw = parseRaw(latest.raw_data_json);
        const expiringCount = Array.isArray(raw.expiringTickets) ? raw.expiringTickets.length : 0;
        const specialCount = Array.isArray(raw.specialMetricAlerts) ? raw.specialMetricAlerts.length : 0;
        const score = num(latest.total_score ?? lastTrend.total_score, 0);
        const rate = num(lastTrend.compliance_rate, stats.passRate);
        const failingByMetric = groupFailingMetrics();
        const failingByCat = groupFailingCustomers();
        const topMetric = failingByMetric[0];
        const maxFailingMetricCount = failingByMetric.length ? Math.max(...failingByMetric.map(item => item.count)) : 0;
        const maxFailingCatCount = failingByCat.length ? Math.max(...failingByCat.map(item => item.count)) : 0;

        const kpis = [
            {
                label: '未达标明细',
                value: stats.metricFailing,
                side: `总 ${stats.metricTotal} 个`,
                foot: `整体指标 ${stats.metricTotal} 个 · 已达标 ${stats.metricPassing} 个`,
                meter: stats.metricTotal ? stats.metricFailing / stats.metricTotal * 100 : 0,
                tone: stats.metricFailing ? 'bad' : 'good'
            },
            {
                label: '受影响客户群',
                value: failingByCat.length,
                side: failingByCat[0] ? failingByCat[0].cat : '暂无风险',
                foot: failingByCat[0] ? `最多 ${failingByCat[0].count} 项未达标` : '客户群全部稳定',
                meter: maxFailingCatCount ? failingByCat[0].count / maxFailingCatCount * 100 : 0,
                tone: failingByCat.length ? 'bad' : 'good'
            },
            {
                label: '最大短板指标',
                value: topMetric ? topMetric.count : 0,
                side: topMetric ? topMetric.label : '无短板',
                foot: topMetric ? `涉及 ${topMetric.count} 个客户群` : '当前无未达标指标',
                meter: maxFailingMetricCount ? topMetric.count / maxFailingMetricCount * 100 : 0,
                tone: topMetric ? 'bad' : 'good'
            },
            {
                label: '辅助状态',
                value: `${fmt(rate, 0)}%`,
                side: `总分 ${fmt(score, 1)}`,
                foot: `预警 ${expiringCount + specialCount} · 快照 ${latest.snapshot_id || '-'}`,
                meter: rate,
                tone: rate >= 95 ? 'good' : (rate >= 85 ? 'warn' : 'bad')
            }
        ];

        $('kpiRow').innerHTML = kpis.map(item => `
            <div class="kpi">
                <div class="kpi-label">${escapeHTML(item.label)}</div>
                <div class="kpi-main">
                    <div class="kpi-value ${item.tone || ''}">${escapeHTML(item.value)}</div>
                    <div class="kpi-side" title="${escapeHTML(item.side || '')}">${escapeHTML(item.side || '')}</div>
                </div>
                <div class="kpi-meter" style="--meter:${Math.max(0, Math.min(100, num(item.meter, 0)))}%;"><span></span></div>
                <div class="kpi-foot">${escapeHTML(item.foot)}</div>
            </div>
        `).join('');
    }

    function groupFailingCustomers() {
        const metrics = Array.isArray(state.latest && state.latest.metrics) ? state.latest.metrics : [];
        const grouped = {};
        metrics.filter(item => Number(item.is_failing) === 1).forEach(item => {
            const cat = item.cat_name || '-';
            if (!grouped[cat]) grouped[cat] = { cat, count: 0, metrics: [] };
            grouped[cat].count += 1;
            grouped[cat].metrics.push(item.metric_label || '未命名指标');
        });
        return Object.values(grouped).sort((a, b) => b.count - a.count || a.cat.localeCompare(b.cat));
    }

    function renderRankList() {
        const rows = getCustomerScoreRows();
        if (!rows.length) {
            $('rankList').style.gridTemplateColumns = '';
            $('rankList').style.gridTemplateRows = '';
            $('rankList').innerHTML = '<div class="empty">当前无未达标客户群</div>';
            if ($('rankSummary')) $('rankSummary').textContent = '当前客户群整体稳定，暂无需要突出跟进的未达标客户群。';
            return;
        }
        $('rankList').style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
        $('rankList').style.gridTemplateRows = 'repeat(2, minmax(0, 1fr))';
        $('rankList').innerHTML = rows.slice(0, 4).map((item, index) => {
            const metricText = item.metrics.length
                ? `${item.metrics.slice(0, 5).join('、')}${item.metrics.length > 5 ? ' 等' : ''}`
                : '当前无未达标指标';
            return `
            <div class="rank-row">
                <div class="rank-no">${index + 1}</div>
                <div>
                    <div class="row-name" title="${escapeHTML(item.cat)}">${escapeHTML(item.cat)}</div>
                    <div class="row-meta rank-marquee" title="${escapeHTML(item.metrics.join('、'))}">
                        <span class="rank-marquee-text">${escapeHTML(metricText)}　　${escapeHTML(metricText)}</span>
                    </div>
                </div>
                <div class="rank-score">${fmt(item.score, 1)}<span class="rank-score-label">分</span></div>
            </div>
        `;
        }).join('');
        renderRankSummary(rows);
    }

    function getCustomerScoreRows() {
        const failingRows = groupFailingCustomers();
        const failingMap = {};
        failingRows.forEach(item => { failingMap[item.cat] = item.metrics || []; });
        const catScores = Array.isArray(state.latest && state.latest.cat_scores) ? state.latest.cat_scores : [];
        return [...catScores]
            .map(item => ({
                cat: item.cat_name || '-',
                score: num(item.final_score, 0),
                baseScore: num(item.base_score, 0),
                manualScore: num(item.manual_score, 0),
                metrics: failingMap[item.cat_name] || []
            }))
            .sort((a, b) => b.score - a.score || a.cat.localeCompare(b.cat));
    }

    function renderRankSummary(rows) {
        if (!rows.length) return;
        const first = rows[0];
        const last = rows[rows.length - 1];
        const riskLeader = [...rows].sort((a, b) => b.metrics.length - a.metrics.length || a.score - b.score)[0];
        $('rankSummary').innerHTML = `
            当前排名第 <strong>1</strong> 的客户群为 <strong>${escapeHTML(first.cat)}</strong>，
            得分 <strong class="good">${fmt(first.score, 1)}</strong>；
            倒数第 <strong>${rows.length}</strong> 为 <strong>${escapeHTML(last.cat)}</strong>，
            得分 <strong class="bad">${fmt(last.score, 1)}</strong>。
            ${riskLeader && riskLeader.metrics.length ? `未达标项最集中在 <strong>${escapeHTML(riskLeader.cat)}</strong>（<strong class="bad">${riskLeader.metrics.length}</strong> 项）。` : ''}
        `;
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
                    values: [],
                    rows: []
                };
            }
            grouped[label].count += 1;
            grouped[label].cats.push(item.cat_name || '-');
            grouped[label].values.push(item.raw_val || item.num_val || '-');
            grouped[label].rows.push(item);
        });
        return Object.values(grouped).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    }

    function parseMetricNumber(value) {
        const raw = String(value ?? '').replace(/,/g, '');
        const match = raw.match(/-?\d+(?:\.\d+)?/);
        if (!match) return null;
        const parsed = Number(match[0]);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function failSeverityScore(row) {
        const completion = Number(row && row.completion_ratio);
        if (Number.isFinite(completion)) {
            return Math.max(0, 1 - completion);
        }

        const gap = parseMetricNumber(row && row.gap);
        if (gap !== null) return Math.abs(gap);

        const rawVal = parseMetricNumber(row && (row.raw_val ?? row.num_val));
        const targetVal = parseMetricNumber(row && row.target_val);
        if (rawVal === null || targetVal === null) return 0;

        const base = Math.max(Math.abs(targetVal), 1);
        const targetText = String(row.target_val || '');
        if (targetText.includes('≤') || targetText.includes('<=')) {
            return Math.max(0, (rawVal - targetVal) / base);
        }
        return Math.max(0, (targetVal - rawVal) / base);
    }

    function severityClass(row, maxScore) {
        const score = failSeverityScore(row);
        if (score <= 0) return 'severity-low';
        if (maxScore > 0 && score >= maxScore * 0.72) return 'severity-high';
        if (maxScore > 0 && score >= maxScore * 0.36) return 'severity-mid';
        if (score >= 0.2) return 'severity-high';
        if (score >= 0.06) return 'severity-mid';
        return 'severity-low';
    }

    function renderWeakList() {
        const rows = groupFailingMetrics();
        if (!rows.length) {
            $('weakList').innerHTML = '<div class="empty">当前最新快照无未达标项</div>';
            return;
        }
        const loopRows = rows.length > 4 ? rows.concat(rows) : rows;
        $('weakList').innerHTML = `
            <div class="weak-scroll-track" style="${rows.length > 4 ? '' : 'animation:none;'}">
                ${loopRows.map(item => `
            <div class="weak-row risk-card">
                <div class="risk-main">
                    <div class="risk-metric-title">
                        <div class="row-name" title="${escapeHTML(item.label)}">${escapeHTML(item.label)}</div>
                        <span class="risk-count-badge" title="未达标客户群数">${item.count}</span>
                    </div>
                    <div class="risk-detail">
                        <div class="row-meta">目标 ${escapeHTML(item.target)}</div>
                        <div class="risk-cats">
                            ${(() => {
                                const sortedRows = [...item.rows].sort((a, b) => failSeverityScore(b) - failSeverityScore(a));
                                const maxScore = sortedRows.length ? failSeverityScore(sortedRows[0]) : 0;
                                return sortedRows.map(row => `
                                <span class="cat-chip ${severityClass(row, maxScore)}" title="${escapeHTML(row.cat_name || '-')} | 实测 ${escapeHTML(row.raw_val ?? row.num_val ?? '-')} | 目标 ${escapeHTML(row.target_val || '-')} | 偏离强度 ${fmt(failSeverityScore(row) * 100, 1)}">
                                    ${escapeHTML(row.cat_name || '-')}：${escapeHTML(row.raw_val ?? row.num_val ?? '-')}
                                </span>
                                `).join('');
                            })()}
                        </div>
                    </div>
                </div>
                ${renderOwnerBlock(item)}
            </div>
                `).join('')}
            </div>
        `;
    }

    function ownerKey(cat, metric = '') {
        return `${String(cat || '').trim()}@@${String(metric || '').trim()}`;
    }

    function ownerMap() {
        const map = {};
        (state.owners || []).forEach(item => {
            map[ownerKey(item.cat_name, item.metric_label)] = item;
        });
        return map;
    }

    function resolveOwnerForMetric(item) {
        const map = ownerMap();
        const sortedRows = [...(item.rows || [])].sort((a, b) => failSeverityScore(b) - failSeverityScore(a));
        for (const row of sortedRows) {
            const exact = map[ownerKey(row.cat_name, item.label)];
            if (exact) return exact;
            const catDefault = map[ownerKey(row.cat_name, '')];
            if (catDefault) return catDefault;
        }
        return null;
    }

    function isImageAvatar(value) {
        return /^https?:\/\//i.test(String(value || '')) || /^data:image\//i.test(String(value || ''));
    }

    function avatarMarkup(owner, className = 'owner-avatar') {
        const avatar = String(owner && owner.avatar || '').trim();
        const name = String(owner && owner.owner_name || '').trim();
        if (avatar && isImageAvatar(avatar)) {
            return `<span class="${className}"><img src="${escapeHTML(avatar)}" alt=""></span>`;
        }
        const label = avatar || name.slice(0, 1) || '责';
        return `<span class="${className}">${escapeHTML(label.slice(0, 2))}</span>`;
    }

    function renderOwnerBlock(item) {
        const owner = resolveOwnerForMetric(item);
        if (!owner) {
            return `
                <div class="risk-owner" title="责任人待配置">
                    <span class="owner-avatar">责</span>
                    <span class="owner-name">待配置</span>
                </div>
            `;
        }
        const title = owner.metric_label
            ? `${owner.cat_name} / ${owner.metric_label}`
            : `${owner.cat_name} 默认责任人`;
        return `
            <div class="risk-owner" title="${escapeHTML(title)}">
                ${avatarMarkup(owner)}
                <span class="owner-name">${escapeHTML(owner.owner_name)}</span>
            </div>
        `;
    }

    function renderMetricList() {
        const metrics = Array.isArray(state.latest && state.latest.metrics) ? state.latest.metrics : [];
        if (!metrics.length) {
            $('metricList').innerHTML = '<div class="empty">暂无指标明细数据</div>';
            return;
        }
        const passRows = metrics
            .filter(item => Number(item.is_failing) !== 1)
            .sort((a, b) => String(a.metric_label || '').localeCompare(String(b.metric_label || '')));
        if (!passRows.length) {
            $('metricList').innerHTML = '<div class="empty">暂无已达标指标</div>';
            return;
        }
        const loopRows = passRows.length > 6 ? passRows.concat(passRows) : passRows;
        $('metricList').innerHTML = `
            <div class="pass-ticker">
                <div class="pass-track" style="${passRows.length > 6 ? '' : 'animation:none;'}">
                    ${loopRows.map(item => `
                        <div class="pass-item">
                            <span class="pass-check">✓</span>
                            <span class="pass-text">
                                <strong title="${escapeHTML(item.metric_label)}">${escapeHTML(item.metric_label || '-')}</strong>
                                <span>${escapeHTML(item.cat_name || '-')} · 实测 ${escapeHTML(item.raw_val ?? item.num_val ?? '-')} · 目标 ${escapeHTML(item.target_val || '-')}</span>
                            </span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    function getOwnerOptions() {
        const metrics = Array.isArray(state.latest && state.latest.metrics) ? state.latest.metrics : [];
        const cats = [...new Set(metrics.map(item => item.cat_name).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        const metricLabels = [...new Set(metrics.map(item => item.metric_label).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        return { cats, metricLabels };
    }

    function renderOwnerOptions() {
        const { cats, metricLabels } = getOwnerOptions();
        const catSelect = $('ownerCatSelect');
        const metricSelect = $('ownerMetricSelect');
        if (catSelect) {
            catSelect.innerHTML = cats.map(cat => `<option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>`).join('');
        }
        if (metricSelect) {
            metricSelect.innerHTML = [
                '<option value="">客户群默认</option>',
                ...metricLabels.map(label => `<option value="${escapeHTML(label)}">${escapeHTML(label)}</option>`)
            ].join('');
        }
    }

    function renderOwnerRows() {
        const tbody = $('ownerRows');
        if (!tbody) return;
        if (!state.ownerDraft.length) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#8ea8c5;padding:22px;">暂无责任人配置</td></tr>';
            return;
        }
        tbody.innerHTML = state.ownerDraft.map((item, index) => `
            <tr>
                <td>${avatarMarkup(item, 'owner-mini-avatar')}</td>
                <td>${escapeHTML(item.cat_name)}</td>
                <td>${escapeHTML(item.metric_label || '客户群默认')}</td>
                <td>${escapeHTML(item.owner_name)}</td>
                <td><span class="owner-delete" onclick="BigscreenOwners.remove(${index})">删除</span></td>
            </tr>
        `).join('');
    }

    function resetOwnerAvatarPicker() {
        state.pendingOwnerAvatar = '';
        const input = $('ownerAvatarInput');
        const preview = $('ownerAvatarPreview');
        const label = $('ownerAvatarLabel');
        if (input) input.value = '';
        if (preview) preview.innerHTML = '图';
        if (label) label.textContent = '上传头像图片';
    }

    function resizeAvatarFile(file) {
        return new Promise((resolve, reject) => {
            if (!file || !file.type || !file.type.startsWith('image/')) {
                reject(new Error('请选择图片文件'));
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const size = 96;
                    const canvas = document.createElement('canvas');
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, size, size);
                    const scale = Math.max(size / img.width, size / img.height);
                    const w = img.width * scale;
                    const h = img.height * scale;
                    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
                    resolve(canvas.toDataURL('image/png'));
                };
                img.onerror = () => reject(new Error('头像图片读取失败'));
                img.src = reader.result;
            };
            reader.onerror = () => reject(new Error('头像图片读取失败'));
            reader.readAsDataURL(file);
        });
    }

    async function handleOwnerAvatarChange(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) {
            resetOwnerAvatarPicker();
            return;
        }
        try {
            const dataUrl = await resizeAvatarFile(file);
            state.pendingOwnerAvatar = dataUrl;
            const preview = $('ownerAvatarPreview');
            const label = $('ownerAvatarLabel');
            if (preview) preview.innerHTML = `<img src="${escapeHTML(dataUrl)}" alt="">`;
            if (label) label.textContent = file.name;
        } catch (error) {
            resetOwnerAvatarPicker();
            if (window.showToast) window.showToast(error.message, 'error');
        }
    }

    function openOwnerModal() {
        state.ownerDraft = (state.owners || []).map(item => ({ ...item }));
        resetOwnerAvatarPicker();
        renderOwnerOptions();
        renderOwnerRows();
        const modal = $('ownerModal');
        if (modal) {
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
        }
    }

    function closeOwnerModal() {
        const modal = $('ownerModal');
        if (modal) {
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
        }
    }

    function addOwnerDraft() {
        const cat = $('ownerCatSelect') ? $('ownerCatSelect').value : '';
        const metric = $('ownerMetricSelect') ? $('ownerMetricSelect').value : '';
        const name = $('ownerNameInput') ? $('ownerNameInput').value.trim() : '';
        const avatar = state.pendingOwnerAvatar || '';
        if (!cat || !name) {
            if (window.showToast) window.showToast('请先选择客户群并填写责任人名字', 'error');
            return;
        }
        const next = { cat_name: cat, metric_label: metric, owner_name: name, avatar };
        const idx = state.ownerDraft.findIndex(item => item.cat_name === cat && (item.metric_label || '') === metric);
        if (idx >= 0) state.ownerDraft[idx] = next;
        else state.ownerDraft.push(next);
        if ($('ownerNameInput')) $('ownerNameInput').value = '';
        resetOwnerAvatarPicker();
        renderOwnerRows();
    }

    function removeOwnerDraft(index) {
        state.ownerDraft.splice(index, 1);
        renderOwnerRows();
    }

    async function saveOwners() {
        try {
            await window.API.post('/api/db/config/bigscreen_owners', { items: state.ownerDraft });
            state.owners = state.ownerDraft.map(item => ({ ...item }));
            closeOwnerModal();
            renderWeakList();
            if (window.showToast) window.showToast(`责任人配置已保存，共 ${state.ownerDraft.length} 条`);
        } catch (error) {
            console.error('[bigscreen] save owners failed:', error);
            if (window.showToast) window.showToast(`保存失败: ${error.message}`, 'error');
        }
    }

    function chartTextColor() {
        return '#b7cbe0';
    }

    function renderTrendChart() {
        const dom = $('trendChart');
        if (!dom || !window.echarts) return;
        const trends = state.trends || [];
        if (!state.charts.trend) state.charts.trend = echarts.init(dom);
        const chartHeight = dom.clientHeight || 220;
        const splitNumber = chartHeight < 210 ? 3 : (chartHeight < 280 ? 4 : 5);
        const dates = trends.map(item => item.date);
        const rates = trends.map(item => fmt(item.compliance_rate, 1));
        const failing = trends.map(item => num(item.metrics_failing, 0));

        state.charts.trend.setOption({
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis' },
            legend: {
                top: 6,
                textStyle: { color: chartTextColor() },
                data: ['未达标项', '达标率']
            },
            grid: { left: 42, right: 54, top: 54, bottom: 34 },
            xAxis: {
                type: 'category',
                data: dates,
                axisLine: { lineStyle: { color: 'rgba(183,203,224,0.34)' } },
                axisLabel: { color: chartTextColor(), fontSize: 11 }
            },
            yAxis: [
                {
                    type: 'value',
                    min: 0,
                    max: 100,
                    splitNumber,
                    axisLabel: { color: chartTextColor(), formatter: '{value}%', fontSize: 10, margin: 6 },
                    splitLine: { lineStyle: { color: 'rgba(120,190,255,0.12)' } }
                },
                {
                    type: 'value',
                    min: 0,
                    splitNumber,
                    axisLabel: { color: chartTextColor(), fontSize: 10, margin: 8 },
                    splitLine: { show: false }
                }
            ],
            series: [
                {
                    name: '未达标项',
                    type: 'bar',
                    yAxisIndex: 1,
                    data: failing,
                    barMaxWidth: 22,
                    itemStyle: { color: 'rgba(255,93,115,0.8)' }
                },
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
                }
            ]
        }, true);
    }

    function renderRiskChart() {
        const dom = $('riskChart');
        if (!dom || !window.echarts) return;
        if (!state.charts.risk) state.charts.risk = echarts.init(dom);
        const weakRows = groupFailingMetrics();
        const rows = weakRows.slice(0, 8).reverse();

        state.charts.risk.setOption({
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            grid: { left: 176, right: 92, top: 18, bottom: 28 },
            xAxis: {
                type: 'value',
                minInterval: 1,
                axisLabel: { color: chartTextColor() },
                splitLine: { lineStyle: { color: 'rgba(120,190,255,0.12)' } }
            },
            yAxis: {
                type: 'category',
                data: rows.length ? rows.map(item => item.label) : ['无风险项'],
                axisLabel: {
                    color: chartTextColor(),
                    overflow: 'truncate',
                    width: 166,
                    align: 'right',
                    margin: 10
                },
                axisLine: { lineStyle: { color: 'rgba(183,203,224,0.34)' } }
            },
            series: [{
                name: '未达标客户群数',
                type: 'bar',
                data: rows.length ? rows.map(item => item.count) : [0],
                barMaxWidth: 12,
                label: { show: true, position: 'right', color: '#ffd5db' },
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                        { offset: 0, color: 'rgba(255,93,115,0.55)' },
                        { offset: 1, color: 'rgba(255,200,87,0.9)' }
                    ])
                }
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
            const [monthlyData, snapshots, owners] = await Promise.all([
                window.API.get(state.monthlyPath),
                window.API.get('/api/db/snapshots'),
                window.API.get('/api/db/config/bigscreen_owners').then(data => (
                    Array.isArray(data && data.items) ? data.items : []
                )).catch(error => {
                    console.warn('[bigscreen] owners config unavailable:', error.message);
                    return [];
                })
            ]);
            state.trends = Array.isArray(monthlyData && monthlyData.trends) ? monthlyData.trends : [];
            state.latest = monthlyData ? monthlyData.latest_snapshot : null;
            state.snapshots = Array.isArray(snapshots) ? snapshots : [];
            state.owners = Array.isArray(owners) ? owners : [];
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
        if ($('ownerConfigBtn')) $('ownerConfigBtn').addEventListener('click', openOwnerModal);
        if ($('ownerAvatarInput')) $('ownerAvatarInput').addEventListener('change', handleOwnerAvatarChange);
        window.addEventListener('resize', () => {
            Object.values(state.charts).forEach(chart => chart && chart.resize && chart.resize());
        });
    }

    window.BigscreenOwners = {
        open: openOwnerModal,
        close: closeOwnerModal,
        add: addOwnerDraft,
        remove: removeOwnerDraft,
        save: saveOwners
    };

    document.addEventListener('DOMContentLoaded', () => {
        initControls();
        loadBigscreenData();
        setInterval(loadBigscreenData, 5 * 60 * 1000);
    });
})();
