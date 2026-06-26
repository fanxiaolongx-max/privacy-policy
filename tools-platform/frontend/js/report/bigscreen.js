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
        const raw = parseRaw(latest.raw_data_json);

        const tickets = Array.isArray(raw.expiringTickets) ? raw.expiringTickets : [];
        const alerts = Array.isArray(raw.specialMetricAlerts) ? raw.specialMetricAlerts : [];

        const groups = [
            { id: 'vulnerability', title: '漏洞预警', icon: '🧯', items: tickets.filter(t => t.collection === 'vulnerability'), type: 'ticket' },
            { id: 'rectification', title: '整改预警', icon: '🛠️', items: tickets.filter(t => t.collection === 'rectification'), type: 'ticket' },
            { id: 'risk_sr', title: '风险/专项/工单预警', icon: '📞', items: tickets.filter(t => ['risk', 'special', 'sr'].includes(t.collection)), type: 'ticket' },
            { id: 'metric_alerts', title: '全局指标告警', icon: '🚨', items: alerts, type: 'alert' }
        ];

        $('kpiRow').innerHTML = groups.map(group => {
            let slidesHtml = '';

            if (group.items.length === 0) {
                slidesHtml = `<div class="kpi-empty">✅ 当前无${group.title.replace('预警', '').replace('告警', '')}</div>`;
            } else {
                const slideDivs = group.items.map(item => {
                    if (group.type === 'ticket') {
                        const tId = item.data?.task_id || item.data?.sr_num || item.data?.precaution_id || item.title || 'Unknown';
                        const net = item.data?.network_name || item.data?.network_cust_name || item.data?.customer_name_cn || '全局';
                        let statusText = item._slaCleanText || item.data?.task_status || item._srStatus || '处理中';
                        let badgeClass = 'safe';
                        if (statusText.includes('紧急') || statusText.includes('严重') || statusText.includes('超期')) {
                            badgeClass = 'danger';
                        } else if (statusText.includes('预警') || statusText.includes('剩余')) {
                            badgeClass = 'warning';
                        }

                        return `
                            <div class="kpi-slide-item">
                                <div class="kpi-slide-row1">
                                    <div class="kpi-ticket-id" title="${escapeHTML(tId)}">${escapeHTML(tId)}</div>
                                    <div class="kpi-status-badge ${badgeClass}">${escapeHTML(statusText)}</div>
                                </div>
                                <div class="kpi-slide-row2">
                                    <div class="kpi-network" title="${escapeHTML(net)}">${escapeHTML(net)}</div>
                                </div>
                            </div>
                        `;
                    } else {
                        // Alert
                        const label = item.metricLabel || item.metric_label || '未知指标';
                        const val = item.globalValue || item.global_val || '-';
                        const target = item.targetValue || item.target_val || '-';
                        const gap = item.gap ? `差距 ${item.gap}` : '不达标';

                        return `
                            <div class="kpi-slide-item">
                                <div class="kpi-slide-row1">
                                    <div class="kpi-metric-val" title="${escapeHTML(label)}">${escapeHTML(label)}: ${escapeHTML(val)}</div>
                                    <div class="kpi-status-badge danger">${escapeHTML(gap)}</div>
                                </div>
                                <div class="kpi-slide-row2">
                                    <div class="kpi-network">目标: ${escapeHTML(target)}</div>
                                </div>
                            </div>
                        `;
                    }
                });

                // For seamless looping, append a copy of the first slide at the end if count > 1
                const renderedSlides = slideDivs.join('');
                slidesHtml = slideDivs.length > 1 ? renderedSlides + slideDivs[0] : renderedSlides;
            }

            return `
                <div class="kpi">
                    <div class="kpi-title">
                        <span class="kpi-title-icon">${group.icon}</span>
                        ${escapeHTML(group.title)} <span style="font-size: 14px; opacity: 0.8; margin-left: 4px;">(${group.items.length})</span>
                    </div>
                    <div class="kpi-slider-wrap">
                        <div class="kpi-slider" data-count="${group.items.length}" data-current="0" style="transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);">
                            ${slidesHtml}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        initKpiCarousel();
    }

    let kpiRotationInterval = null;
    function initKpiCarousel() {
        if (kpiRotationInterval) clearInterval(kpiRotationInterval);

        kpiRotationInterval = setInterval(() => {
            const sliders = document.querySelectorAll('.kpi-slider[data-count]');
            sliders.forEach(slider => {
                const count = parseInt(slider.getAttribute('data-count'), 10);
                if (count <= 1) return;

                let current = parseInt(slider.getAttribute('data-current') || '0', 10);

                if (current === count) {
                    slider.style.transition = 'none';
                    slider.style.transform = `translateY(0)`;
                    slider.setAttribute('data-current', '0');
                    void slider.offsetHeight;
                    slider.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
                    current = 0;
                }

                current++;
                slider.setAttribute('data-current', current);
                slider.style.transform = `translateY(-${current * 100}%)`;
            });
        }, 3500);
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
            第 <strong>${rows.length}</strong> 为 <strong>${escapeHTML(last.cat)}</strong>，
            得分 <strong class="bad">${fmt(last.score, 1)}</strong>。
            ${riskLeader && riskLeader.metrics.length ? `未达标项最集中在 <strong>${escapeHTML(riskLeader.cat)}</strong>（<strong class="bad">${riskLeader.metrics.length}</strong> 项）。` : ''}
        `;
    }

    function getMetricSortIndex(label) {
        if (!state.metricOrder) return 9999;
        const idx = state.metricOrder.indexOf(label);
        return idx >= 0 ? idx : 9999;
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
        return Object.values(grouped).sort((a, b) => {
            return getMetricSortIndex(a.label) - getMetricSortIndex(b.label) || b.count - a.count || a.label.localeCompare(b.label);
        });
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

    function resolveOwnersForMetric(item) {
        const map = ownerMap();
        const sortedRows = [...(item.rows || [])].sort((a, b) => failSeverityScore(b) - failSeverityScore(a));
        const ownersMap = new Map();

        for (const row of sortedRows) {
            let owner = map[ownerKey(row.cat_name, item.label)];
            if (!owner) owner = map[ownerKey(row.cat_name, '')];
            if (owner) {
                const key = owner.owner_name + '|' + (owner.emp_id || '');
                if (!ownersMap.has(key)) {
                    ownersMap.set(key, { ...owner, managedCats: new Set([row.cat_name]) });
                } else {
                    ownersMap.get(key).managedCats.add(row.cat_name);
                }
            }
        }

        if (ownersMap.size === 0) {
            let owner = map[ownerKey('整体', item.label)] || map[ownerKey('', item.label)] || map[ownerKey('全局', item.label)];
            if (owner) {
                const key = owner.owner_name + '|' + (owner.emp_id || '');
                ownersMap.set(key, { ...owner, managedCats: new Set(['整体/全局']) });
            }
        }

        if (ownersMap.size === 0) {
            (state.owners || []).forEach(o => {
                if (!o.owner_name) return;
                const key = o.owner_name + '|' + (o.emp_id || '');
                if (!ownersMap.has(key)) {
                    ownersMap.set(key, { ...o, managedCats: new Set(['未配置(默认轮播)']) });
                }
            });
        }

        return Array.from(ownersMap.values());
    }

    let ownerRotationInterval = null;

    function initOwnerRotation() {
        if (ownerRotationInterval) clearInterval(ownerRotationInterval);

        ownerRotationInterval = setInterval(() => {
            const sliders = document.querySelectorAll('.owner-slider[data-count]');
            sliders.forEach(slider => {
                const count = parseInt(slider.getAttribute('data-count'), 10);
                if (count <= 1) return;

                let current = parseInt(slider.getAttribute('data-current') || '0', 10);

                if (current === count) {
                    slider.style.transition = 'none';
                    slider.style.transform = `translateY(0)`;
                    current = 0;
                    void slider.offsetHeight;
                    slider.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
                }

                current++;
                slider.setAttribute('data-current', current);
                slider.style.transform = `translateY(-${current * 100}%)`;

                updateChipHighlights(slider, count, current);
            });
        }, 3000);
    }

    function updateChipHighlights(slider, count, current) {
        const realIdx = current % count;
        const activeItem = slider.children[realIdx];
        if (!activeItem) return;

        const catNames = (activeItem.getAttribute('data-cats') || '').split(',');
        const card = slider.closest('.risk-card');
        if (!card) return;

        const chips = card.querySelectorAll('.cat-chip');
        chips.forEach(chip => {
            const chipCat = chip.getAttribute('data-cat');
            if (catNames.includes(chipCat)) {
                chip.classList.add('active-highlight');
                chip.classList.remove('dimmed');
            } else {
                chip.classList.remove('active-highlight');
                chip.classList.add('dimmed');
            }
        });
    }

    function renderWeakList() {
        const rows = groupFailingMetrics();
        const countDom = $('failingMetricsCount');

        if (!rows.length) {
            if (countDom) countDom.textContent = '';
            $('weakList').innerHTML = '<div class="empty">当前最新快照无未达标项</div>';
            return;
        }

        if (countDom) {
            const distinctFailingMetrics = rows.length;
            const totalFailingRows = rows.reduce((acc, r) => acc + (r.rows ? r.rows.length : r.count), 0);
            countDom.textContent = `(总计未达标指标: ${distinctFailingMetrics}个 | 客户群明细数: ${totalFailingRows}条)`;
        }

        const loopRows = rows.length > 4 ? rows.concat(rows) : rows;
        const rowCount = Math.ceil(loopRows.length / 2);
        const duration = Math.max(8, rowCount * 6); // 6s per row for steady readable speed, min 8s
        $('weakList').innerHTML = `
            <div class="weak-scroll-track" style="${rows.length > 4 ? `animation: weakScroll ${duration}s linear infinite;` : 'animation:none;'}">
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
                                <span class="cat-chip ${severityClass(row, maxScore)}" data-cat="${escapeHTML(row.cat_name || '-')}" title="${escapeHTML(row.cat_name || '-')} | 实测 ${escapeHTML(row.raw_val ?? row.num_val ?? '-')} | 目标 ${escapeHTML(row.target_val || '-')} | 偏离强度 ${fmt(failSeverityScore(row) * 100, 1)}">
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

        const sliders = document.querySelectorAll('.owner-slider[data-count]');
        sliders.forEach(slider => {
            const count = parseInt(slider.getAttribute('data-count'), 10);
            if (count > 1) {
                updateChipHighlights(slider, count, 0);
            }
        });

        initOwnerRotation();
    }

    function renderManualAdjustStrip() {
        const strip = $('manualItemsStrip');
        if (!strip) return;

        const prefs = state.globalConfig && state.globalConfig.prefs ? state.globalConfig.prefs : {};
        const latest = state.latest || {};
        const raw = parseRaw(latest.raw_data_json);
        const manualItems = Array.isArray(raw.manualAdjustItems) ? raw.manualAdjustItems : (Array.isArray(prefs.manualAdjustItems) ? prefs.manualAdjustItems : []);
        const manualAdjustData = raw.manualAdjustData || {};

        const activeItems = [];
        Object.keys(manualAdjustData).forEach(cat => {
            const catData = manualAdjustData[cat];
            Object.keys(catData).forEach(idx => {
                const count = parseInt(catData[idx], 10) || 0;
                if (count > 0 && manualItems[idx] && !manualItems[idx].deleted) {
                    const itemDef = manualItems[idx];
                    const unit = parseFloat(itemDef.unit) || 0;
                    activeItems.push({
                        cat: cat,
                        name: itemDef.name || '未命名配置',
                        type: itemDef.type || '扣分',
                        count: count,
                        totalScore: count * unit
                    });
                }
            });
        });

        if (!activeItems.length) {
            strip.innerHTML = '<div style="color:#6e8ca8; font-size:12px;">当前最新快照无客户群产生额外加减分</div>';
            return;
        }

        const itemsHtml = activeItems.map(item => {
            const isAdd = item.type === '加分';
            const sign = isAdd ? '+' : '-';
            return `
                <div class="manual-item">
                    <span class="manual-item-type ${item.type}">${escapeHTML(item.type)}</span>
                    <span class="manual-item-name" style="color:var(--cyan); margin-right: 8px;">[${escapeHTML(item.cat)}]</span>
                    <span class="manual-item-name">${escapeHTML(item.name)}</span>
                    <span class="manual-item-desc">(${item.count}次，共 ${sign}${item.totalScore}分)</span>
                </div>
            `;
        }).join('');

        strip.innerHTML = `
            <div class="manual-track" data-count="${activeItems.length}" data-current="0">
                ${itemsHtml}
                ${itemsHtml}
            </div>
        `;

        initManualRotation();
    }

    let manualRotationInterval = null;

    function initManualRotation() {
        if (manualRotationInterval) clearInterval(manualRotationInterval);

        manualRotationInterval = setInterval(() => {
            const sliders = document.querySelectorAll('.manual-track[data-count]');
            sliders.forEach(slider => {
                const count = parseInt(slider.getAttribute('data-count'), 10);
                if (count <= 1) return;

                let current = parseInt(slider.getAttribute('data-current') || '0', 10);

                if (current === count) {
                    slider.style.transition = 'none';
                    slider.style.transform = `translateY(0)`;
                    current = 0;
                    void slider.offsetHeight;
                    slider.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
                }

                current++;
                slider.setAttribute('data-current', current);
                slider.style.transform = `translateY(-${current * 100}%)`;
            });
        }, 4000); // Wait 4 seconds per item
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
        const owners = resolveOwnersForMetric(item);
        if (!owners.length) {
            return `
                <div class="risk-owner" title="责任人待配置">
                    <div class="owner-slider">
                        <div class="owner-slide-item">
                            <span class="owner-avatar">责</span>
                            <span class="owner-name">待配置</span>
                        </div>
                    </div>
                </div>
            `;
        }

        const tooltip = owners.map(o => `${o.owner_name} (${o.emp_id || '无工号'}) - ${o.cat_name}`).join('\\n');

        if (owners.length === 1) {
            const owner = owners[0];
            const empIdHtml = owner.emp_id ? `<span class="owner-empid">${escapeHTML(owner.emp_id)}</span>` : '';
            return `
                <div class="risk-owner" title="${escapeHTML(tooltip)}">
                    <div class="owner-slider">
                        <div class="owner-slide-item">
                            ${avatarMarkup(owner)}
                            <span class="owner-name">${escapeHTML(owner.owner_name)}</span>
                            ${empIdHtml}
                        </div>
                    </div>
                </div>
            `;
        }

        const maxN = Math.min(owners.length, 10);
        const displayOwners = owners.slice(0, maxN);
        const sliderItems = [...displayOwners, displayOwners[0]];

        return `
            <div class="risk-owner" title="${escapeHTML(tooltip)}">
                <div class="owner-slider" data-count="${maxN}" data-current="0" style="transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);">
                    ${sliderItems.map(owner => {
            const empIdHtml = owner.emp_id ? `<span class="owner-empid">${escapeHTML(owner.emp_id)}</span>` : '';
            const cats = Array.from(owner.managedCats || []).join(',');
            return `
                            <div class="owner-slide-item" data-cats="${escapeHTML(cats)}">
                                ${avatarMarkup(owner)}
                                <span class="owner-name">${escapeHTML(owner.owner_name)}</span>
                                ${empIdHtml}
                            </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;
    }

    function renderMetricList() {
        const metrics = Array.isArray(state.latest && state.latest.metrics) ? state.latest.metrics : [];
        const countDom = $('passingMetricsCount');

        if (!metrics.length) {
            if (countDom) countDom.textContent = '';
            $('metricList').innerHTML = '<div class="empty">暂无指标明细数据</div>';
            return;
        }
        const passRows = metrics
            .filter(item => Number(item.is_failing) !== 1)
            .sort((a, b) => {
                const labelA = String(a.metric_label || '');
                const labelB = String(b.metric_label || '');
                return getMetricSortIndex(labelA) - getMetricSortIndex(labelB) || labelA.localeCompare(labelB);
            });

        if (countDom) {
            if (passRows.length > 0) {
                const distinctPassingMetrics = new Set(passRows.map(m => m.metric_label)).size;
                const totalPassingRows = passRows.length;
                countDom.textContent = `(总计达标指标: ${distinctPassingMetrics}个 | 客户群明细数: ${totalPassingRows}条)`;
            } else {
                countDom.textContent = '';
            }
        }

        if (!passRows.length) {
            $('metricList').innerHTML = '<div class="empty">暂无已达标指标</div>';
            return;
        }
        const loopRows = passRows.length > 6 ? passRows.concat(passRows) : passRows;
        const rowCount = Math.ceil(loopRows.length / 2);
        const duration = Math.max(8, rowCount * 5); // 5s per row (slightly faster as items are smaller, but visually consistent)
        $('metricList').innerHTML = `
            <div class="pass-track" style="${passRows.length > 6 ? `animation: passScroll ${duration}s linear infinite;` : 'animation:none;'}">
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

        const catsList = cats.filter(c => c !== '整体' && c !== '全局');
        if (catSelect) {
            catSelect.innerHTML = [
                '<option value="整体">整体 / 全局</option>',
                ...catsList.map(cat => `<option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>`)
            ].join('');
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
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#8ea8c5;padding:22px;">暂无责任人配置</td></tr>';
            return;
        }
        tbody.innerHTML = state.ownerDraft.map((item, index) => `
            <tr>
                <td>${avatarMarkup(item, 'owner-mini-avatar')}</td>
                <td>${escapeHTML(item.cat_name)}</td>
                <td>${escapeHTML(item.metric_label || '客户群默认')}</td>
                <td>${escapeHTML(item.owner_name)}</td>
                <td>${escapeHTML(item.emp_id || '-')}</td>
                <td>
                    <span class="owner-edit" onclick="BigscreenOwners.edit(${index})" style="color:var(--cyan);cursor:pointer;margin-right:8px;">编辑</span>
                    <span class="owner-delete" onclick="BigscreenOwners.remove(${index})">删除</span>
                </td>
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

    let editingOwnerIndex = -1;

    function openOwnerModal() {
        state.ownerDraft = (state.owners || []).map(item => ({ ...item }));
        editingOwnerIndex = -1;
        if ($('btnAddOwner')) $('btnAddOwner').textContent = '添加';
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

    function editOwnerDraft(index) {
        editingOwnerIndex = index;
        const item = state.ownerDraft[index];
        if ($('ownerCatSelect')) $('ownerCatSelect').value = item.cat_name;
        if ($('ownerMetricSelect')) $('ownerMetricSelect').value = item.metric_label || '';
        if ($('ownerNameInput')) $('ownerNameInput').value = item.owner_name;
        if ($('ownerEmpIdInput')) $('ownerEmpIdInput').value = item.emp_id || '';
        if (item.avatar) {
            state.pendingOwnerAvatar = item.avatar;
            if ($('ownerAvatarPreview')) $('ownerAvatarPreview').innerHTML = `<img src="${escapeHTML(item.avatar)}" alt="">`;
            if ($('ownerAvatarLabel')) $('ownerAvatarLabel').textContent = '已选择头像';
        } else {
            resetOwnerAvatarPicker();
        }
        if ($('btnAddOwner')) $('btnAddOwner').textContent = '更新并保存';
    }

    function addOwnerDraft() {
        const cat = $('ownerCatSelect') ? $('ownerCatSelect').value : '';
        const metric = $('ownerMetricSelect') ? $('ownerMetricSelect').value : '';
        const name = $('ownerNameInput') ? $('ownerNameInput').value.trim() : '';
        const empId = $('ownerEmpIdInput') ? $('ownerEmpIdInput').value.trim() : '';
        const avatar = state.pendingOwnerAvatar || '';
        if (!cat || !name) {
            if (window.showToast) window.showToast('请先选择客户群并填写责任人名字', 'error');
            return;
        }
        const next = { cat_name: cat, metric_label: metric, owner_name: name, emp_id: empId, avatar };

        if (editingOwnerIndex >= 0) {
            state.ownerDraft[editingOwnerIndex] = next;
            editingOwnerIndex = -1;
            if ($('btnAddOwner')) $('btnAddOwner').textContent = '添加';
        } else {
            const idx = state.ownerDraft.findIndex(item => item.cat_name === cat && (item.metric_label || '') === metric);
            if (idx >= 0) state.ownerDraft[idx] = next;
            else state.ownerDraft.push(next);
        }

        if ($('ownerNameInput')) $('ownerNameInput').value = '';
        if ($('ownerEmpIdInput')) $('ownerEmpIdInput').value = '';
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

    let metricsCarouselInterval = null;

    function startMetricsCarousel(count) {
        if (metricsCarouselInterval) clearInterval(metricsCarouselInterval);
        if (count <= 1) return;

        let currentIndex = 0;
        metricsCarouselInterval = setInterval(() => {
            const carousel = $('failingMetricsCarousel');
            if (!carousel) {
                clearInterval(metricsCarouselInterval);
                return;
            }
            const slides = carousel.querySelectorAll('.carousel-slide');
            if (!slides.length) return;

            const prevIndex = currentIndex;
            currentIndex = (currentIndex + 1) % count;

            slides.forEach((slide, i) => {
                slide.classList.remove('active', 'prev');
                if (i === currentIndex) slide.classList.add('active');
                if (i === prevIndex) slide.classList.add('prev');
            });
        }, 5000);
    }

    function renderRiskChart() {
        const dom = $('riskChart');
        if (!dom || !window.echarts) return;
        if (!state.charts.risk) state.charts.risk = echarts.init(dom);
        const failingByCat = groupFailingCustomers();
        const data = failingByCat.slice(0, 7).map(item => ({
            name: item.cat,
            value: item.count
        }));

        const option = {
            tooltip: {
                trigger: 'item',
                backgroundColor: 'rgba(15,23,42,0.9)',
                borderColor: '#4a5b7d',
                textStyle: { color: '#e2e8f0' }
            },
            series: [{
                type: 'pie',
                radius: ['45%', '75%'],
                center: ['50%', '50%'],
                avoidLabelOverlap: true,
                itemStyle: {
                    borderRadius: 4,
                    borderColor: 'rgba(15,23,42,0.8)',
                    borderWidth: 2
                },
                label: {
                    show: true,
                    formatter: '{b}\n{c}项',
                    color: '#9fb9d4',
                    fontSize: 11,
                    lineHeight: 14
                },
                labelLine: { length: 8, length2: 8, lineStyle: { color: '#4a5b7d' } },
                data: data.length ? data : [{ name: '无风险', value: 0 }]
            }],
            color: ['#ff5d73', '#ff8fa0', '#f59e0b', '#fbbf24', '#38bdf8', '#7dd3fc', '#818cf8']
        };
        state.charts.risk.setOption(option);
    }

    function renderFailingMetricsCarousel() {
        const carousel = $('failingMetricsCarousel');
        if (!carousel) return;

        const latest = state.latest || {};
        const prevMetrics = latest.previous_metrics || [];
        const trends = state.trends || [];
        const prevTrend = trends.length > 1 ? trends[trends.length - 2] : null;
        const currTrend = trends.length > 0 ? trends[trends.length - 1] : null;

        let dateStr = '';
        if (currTrend && currTrend.date && prevTrend && prevTrend.date) {
            dateStr = `(区间: ${prevTrend.date} 至 ${currTrend.date})`;
        } else if (prevTrend && prevTrend.date) {
            dateStr = `(上次采集: ${prevTrend.date})`;
        } else if (currTrend && currTrend.date) {
            dateStr = `(本次采集: ${currTrend.date})`;
        }

        const metrics = Array.isArray(latest.metrics) ? latest.metrics : [];
        const failing = metrics.filter(item => Number(item.is_failing) === 1);

        if (!failing.length) {
            carousel.innerHTML = '<div class="empty">当前无未达标指标</div>';
            return;
        }

        const grouped = {};
        failing.forEach(item => {
            const label = item.metric_label || '未命名指标';
            if (!grouped[label]) grouped[label] = { label, rows: [] };
            grouped[label].rows.push(item);
        });
        const metricGroups = Object.values(grouped).sort((a, b) => {
            return getMetricSortIndex(a.label) - getMetricSortIndex(b.label) || b.rows.length - a.rows.length || a.label.localeCompare(b.label);
        });

        const parseNumberVal = (val) => {
            if (val === null || val === undefined) return null;
            if (typeof val === 'number') return val;
            const match = String(val).match(/-?\d+(\.\d+)?/);
            return match ? parseFloat(match[0]) : null;
        };

        const getPrevValue = (catName, metricLabel) => {
            const prev = prevMetrics.find(p => p.cat_name === catName && p.metric_label === metricLabel);
            return prev ? parseNumberVal(prev.num_val ?? prev.raw_val) : null;
        };

        const firstSlide = `
            <div class="carousel-slide active" data-index="0">
                <div class="carousel-metric-name">短板集中度 (按客户群)</div>
                <div id="riskChart" class="chart" style="flex:1;"></div>
            </div>
        `;

        const MAX_LINES_PER_SLIDE = 7;
        const slidesData = [];
        let currentSlideGroups = [];
        let currentSlideLines = 0;

        for (const group of metricGroups) {
            const groupLines = 1.5 + group.rows.length;
            if (currentSlideGroups.length === 0) {
                currentSlideGroups.push(group);
                currentSlideLines += groupLines;
            } else if (currentSlideLines + groupLines <= MAX_LINES_PER_SLIDE) {
                currentSlideGroups.push(group);
                currentSlideLines += groupLines;
            } else {
                slidesData.push(currentSlideGroups);
                currentSlideGroups = [group];
                currentSlideLines = groupLines;
            }
        }
        if (currentSlideGroups.length > 0) {
            slidesData.push(currentSlideGroups);
        }

        const slidesHtml = slidesData.map((groupsInSlide, slideIdx) => {
            const index = slideIdx + 1;

            return `
                <div class="carousel-slide" data-index="${index}" style="display:flex; flex-direction:column; gap:16px;">
                    ${groupsInSlide.map(group => {
                const sortedRows = [...group.rows].sort((a, b) => failSeverityScore(b) - failSeverityScore(a));
                const isSingle = groupsInSlide.length === 1;

                return `
                            <div style="display:flex; flex-direction:column; gap:6px; ${isSingle ? 'flex:1; overflow:hidden;' : ''}">
                                <div class="carousel-metric-name" style="display:flex; justify-content:space-between; align-items:flex-end; flex-shrink:0;">
                                    <div>
                                        ${escapeHTML(group.label)} 
                                        <span style="font-size:12px;color:#9fb9d4;font-weight:normal;margin-left:6px;">${escapeHTML(dateStr)}</span>
                                    </div>
                                    <div style="font-size:12px;color:#9fb9d4;font-weight:normal;padding-right:4px;">变化量</div>
                                </div>
                                <div class="carousel-metric-details" style="${isSingle ? '' : 'flex:none; overflow-y:visible;'}">
                                    ${sortedRows.map(row => {
                    const curVal = parseNumberVal(row.num_val ?? row.raw_val);
                    const prevVal = getPrevValue(row.cat_name, row.metric_label);
                    let diffHtml = '<span class="carousel-cat-diff flat">-</span>';

                    if (prevVal !== null && curVal !== null) {
                        const diff = curVal - prevVal;
                        if (Math.abs(diff) > 0.001) {
                            if (diff > 0) {
                                diffHtml = '<span class="carousel-cat-diff up">↑ ' + fmt(Math.abs(diff), 1) + '</span>';
                            } else if (diff < 0) {
                                diffHtml = '<span class="carousel-cat-diff down">↓ ' + fmt(Math.abs(diff), 1) + '</span>';
                            }
                        }
                    }

                    const isZero = curVal === 0;

                    return `
                                            <div class="carousel-cat-row ${isZero ? 'zero-alert' : ''}">
                                                <div class="carousel-cat-name" title="${escapeHTML(row.cat_name)}">${escapeHTML(row.cat_name)}</div>
                                                <div class="carousel-cat-vals">
                                                    目标: ${escapeHTML(row.target_val)} | 当前: <strong class="${isZero ? 'text-red' : ''}">${escapeHTML(row.raw_val ?? row.num_val)}</strong>
                                                </div>
                                                <div>${diffHtml}</div>
                                            </div>
                                        `;
                }).join('')}
                                </div>
                            </div>
                        `;
            }).join('')}
                </div>
            `;
        }).join('');

        carousel.innerHTML = firstSlide + slidesHtml;
        renderRiskChart();
        startMetricsCarousel(slidesData.length + 1);
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
        renderFailingMetricsCarousel();
        renderManualAdjustStrip();
        renderSourceStrip();
    }

    async function loadBigscreenData() {
        setLoading(true);
        try {
            const range = getCurrentRange();
            state.monthlyPath = `/api/db/monthly_report_data${range.query}`;
            const [monthlyData, snapshots, owners, globalConfig] = await Promise.all([
                window.API.get(state.monthlyPath),
                window.API.get('/api/db/snapshots'),
                window.API.get('/api/db/config/bigscreen_owners').then(data => (
                    Array.isArray(data && data.items) ? data.items : []
                )).catch(error => {
                    console.warn('[bigscreen] owners config unavailable:', error.message);
                    return [];
                }),
                window.API.get('/api/sla/config').catch(() => ({}))
            ]);
            state.globalConfig = globalConfig || {};
            state.trends = Array.isArray(monthlyData && monthlyData.trends) ? monthlyData.trends : [];
            state.latest = monthlyData ? monthlyData.latest_snapshot : null;

            if (state.latest && state.latest.raw_data_json) {
                try {
                    const raw = typeof state.latest.raw_data_json === 'string'
                        ? JSON.parse(state.latest.raw_data_json)
                        : state.latest.raw_data_json;

                    if (raw && Array.isArray(raw.specialMetricAlerts)) {
                        if (!state.latest.metrics) state.latest.metrics = [];
                        raw.specialMetricAlerts.forEach(alert => {
                            const label = alert.metric_label || alert.metricLabel;
                            const exists = state.latest.metrics.some(m => m.metric_label === label && m.cat_name === '整体');
                            if (!exists) {
                                state.latest.metrics.push({
                                    cat_name: '整体',
                                    metric_label: label,
                                    target_val: alert.target_val || alert.targetValue || '-',
                                    raw_val: alert.global_val || alert.globalValue || '-',
                                    num_val: parseFloat(alert.global_val || alert.globalValue) || 0,
                                    is_failing: 1,
                                    is_special_alert: true
                                });
                            }
                        });
                    }

                    // Extract order from the original DB returned metrics list (which reflects report dashboard order)
                    if (state.latest && Array.isArray(state.latest.metrics)) {
                        const uniqueOrder = [];
                        state.latest.metrics.forEach(m => {
                            if (m.is_special_alert) return; // Skip special alerts for the first pass
                            const lbl = m.metric_label || '未命名指标';
                            if (!uniqueOrder.includes(lbl)) uniqueOrder.push(lbl);
                        });

                        // Weave special alerts into the correct relative position using topMetrics as a guide
                        if (raw && Array.isArray(raw.topMetrics)) {
                            const topOrder = raw.topMetrics.map(m => m.label || m.metricLabel);
                            const specialLabels = [...new Set(state.latest.metrics.filter(m => m.is_special_alert).map(m => m.metric_label || '未命名指标'))];

                            specialLabels.forEach(lbl => {
                                const topIdx = topOrder.indexOf(lbl);
                                if (topIdx >= 0) {
                                    let insertAfterIdx = -1;
                                    for (let i = topIdx - 1; i >= 0; i--) {
                                        const prevLbl = topOrder[i];
                                        const prevInUnique = uniqueOrder.indexOf(prevLbl);
                                        if (prevInUnique >= 0) {
                                            insertAfterIdx = prevInUnique;
                                            break;
                                        }
                                    }
                                    uniqueOrder.splice(insertAfterIdx + 1, 0, lbl);
                                } else {
                                    uniqueOrder.push(lbl);
                                }
                            });
                        } else {
                            const specialLabels = [...new Set(state.latest.metrics.filter(m => m.is_special_alert).map(m => m.metric_label || '未命名指标'))];
                            uniqueOrder.push(...specialLabels);
                        }

                        state.metricOrder = uniqueOrder;
                    }
                } catch (e) {
                    console.warn('[bigscreen] parse special metrics failed:', e);
                }
            }

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
        add: addOwnerDraft,
        remove: removeOwnerDraft,
        edit: editOwnerDraft,
        save: saveOwners,
        open: openOwnerModal,
        close: closeOwnerModal
    };

    window.editContactInfo = async function () {
        const dom = $('contactInfoText');
        const currentText = dom ? dom.textContent : '';
        const newText = prompt('配置联系方式信息：', currentText);

        if (newText !== null) {
            const val = newText.trim() || '如果对看板数据有疑问或者建议，请联系xxxx';
            if (dom) dom.textContent = val;

            try {
                await window.API.post('/api/db/config/bigscreen_contact_info', { text: val });
                if (window.showToast) window.showToast('联系信息已保存');
            } catch (err) {
                console.error('保存联系信息失败', err);
                if (window.showToast) window.showToast('保存失败: ' + err.message, 'error');
            }
        }
    };

    window.toggleFullScreen = function () {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log(`Error attempting to enable fullscreen: ${err.message}`);
                if (window.showToast) window.showToast('无法全屏: ' + err.message, 'error');
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        window.API.get('/api/db/config/bigscreen_contact_info').then(res => {
            if (res && res.text) {
                const dom = $('contactInfoText');
                if (dom) dom.textContent = res.text;
            }
        }).catch(err => console.error('Failed to load contact info', err));

        initControls();
        loadBigscreenData();
        setInterval(loadBigscreenData, 5 * 60 * 1000);
    });
})();
