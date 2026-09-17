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

    const state = { items: [], total: 0, topicKey: 'netcare-eos-product', metricKey: 'pending', detailRows: [], detailColumns: [], detailPage: 1, detailPageSize: 50, detailSortColumn: '', detailSortAscending: true, detailFilter: '', eosMonthlyReport: null, eosMonthlySnapshot: null, fixedCopyDefaults: new Map() };
    const elements = {};
    const DETAIL_LABELS = { customer_name: '客户', product_line_name: '产品线', product_line_map: '产品线', product_name: '产品', software_version: '版本', task_id: '任务单号', need_reduce_cnt: '需消减', reduced_cnt: '已消减', incorporation_total_nes: '数量', incorporated_nes: '已收编', to_be_incorporated_nes: '待收编', current_phase_name: '阶段', scope: '范围', year: '年份', month: '月份', task_count: '变更任务数', operation_success_rate: '操作成功率', rollback_count: '回退数', high_core_total_count: '高危核心', interception_cnt: '拦截数', commands_interception_cnt: '命令行拦截', graphical_interception_cnt: '图形化拦截', period: '期间', sr_total: 'SR 数', sr_frt: 'FRT', unclose_sr_cnt: '未关闭', overdue_sr_cnt: '逾期', minor_sr_cnt: 'Minor', major_sr_cnt: 'Major', critical_sr_cnt: 'Critical' };
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
        elements.historyBody.innerHTML = items.map(item => `<tr><td>${escapeHtml(formatTime(item.capturedAt))}</td><td><span class="topic-platform ${escapeHtml(item.platform)}">${item.platform === 'datafab' ? 'DataFab' : 'NetCare'}</span></td><td>${escapeHtml(item.period || '--')}</td><td>${escapeHtml(formatMetric(metricValue(item, definition), definition))}</td><td>${escapeHtml(formatTime(item.importedAt))}</td><td><div class="topic-row-actions"><button data-action="view" data-id="${escapeHtml(item.id)}">详表</button><button data-action="download" data-id="${escapeHtml(item.id)}">下载 JSON</button><button class="danger" data-action="delete" data-id="${escapeHtml(item.id)}">删除</button></div></td></tr>`).join('');
    }

    function detailRows(snapshot) {
        const data = snapshot?.data || {};
        if (topic().platform === 'netcare') {
            const source = data[topic().path];
            if (topic().path === 'sr') return [...(data.sr?.summary || []).map(row => ({ rowType: '汇总', ...row })), ...(data.sr?.monthly || []).map(row => ({ rowType: '月度', ...row }))];
            return Array.isArray(source) ? source : Array.isArray(source?.rows) ? source.rows : [];
        }
        const byMonth = data.detailsByMonth && typeof data.detailsByMonth === 'object' ? data.detailsByMonth : {};
        const rows = Object.entries(byMonth).flatMap(([month, values]) => (Array.isArray(values) ? values : []).map(row => ({ month, ...row })));
        return rows.length ? rows : (Array.isArray(data.detail) ? data.detail : []).map(row => ({ month: snapshot.settings?.month || '', ...row }));
    }

    function detailColumns(rows) {
        const keys = []; rows.forEach(row => Object.keys(row || {}).forEach(key => { if (!keys.includes(key) && !['id'].includes(key)) keys.push(key); }));
        return keys;
    }

    function detailValue(value, key) {
        if (value === null || value === undefined || value === '') return '--';
        if (['operation_success_rate', 'sr_frt'].includes(key)) return `${(Number(value) <= 1 ? Number(value) * 100 : Number(value)).toFixed(1)}%`;
        return typeof value === 'object' ? JSON.stringify(value) : String(value);
    }

    function renderDetailTable() {
        const rows = state.detailRows.filter(row => !state.detailFilter || state.detailColumns.some(key => detailValue(row[key], key).toLowerCase().includes(state.detailFilter)));
        const column = state.detailSortColumn;
        rows.sort((a, b) => { if (!column) return 0; const av = detailValue(a[column], column), bv = detailValue(b[column], column); const an = Number(av.replace(/[% ,]/g, '')), bn = Number(bv.replace(/[% ,]/g, '')); const result = Number.isFinite(an) && Number.isFinite(bn) ? an - bn : av.localeCompare(bv, 'zh-CN'); return state.detailSortAscending ? result : -result; });
        const pageCount = Math.max(1, Math.ceil(rows.length / state.detailPageSize)); state.detailPage = Math.min(pageCount, Math.max(1, state.detailPage)); const start = (state.detailPage - 1) * state.detailPageSize; const pageRows = rows.slice(start, start + state.detailPageSize);
        elements.detailSummary.textContent = `${topic().label} · 共 ${state.detailRows.length} 条明细 · 筛选后 ${rows.length} 条 · 第 ${state.detailPage}/${pageCount} 页`;
        elements.detailTable.innerHTML = state.detailRows.length ? `<table><thead><tr>${state.detailColumns.map(key => `<th>${escapeHtml(DETAIL_LABELS[key] || key)}</th>`).join('')}</tr></thead><tbody>${pageRows.map(row => `<tr>${state.detailColumns.map(key => `<td title="${escapeHtml(detailValue(row[key], key))}">${escapeHtml(detailValue(row[key], key))}</td>`).join('')}</tr>`).join('')}</tbody></table><div class="topic-detail-pager"><button data-detail-page="prev" ${state.detailPage <= 1 ? 'disabled' : ''}>上一页</button><b>${state.detailPage} / ${pageCount}</b><button data-detail-page="next" ${state.detailPage >= pageCount ? 'disabled' : ''}>下一页</button><span>显示 ${rows.length ? start + 1 : 0}–${Math.min(rows.length, start + state.detailPageSize)} / ${rows.length}</span></div>` : '<div class="topic-detail-empty">该专题没有可展示的明细数据</div>';
        elements.detailSortColumn.innerHTML = state.detailColumns.map(key => `<option value="${escapeHtml(key)}" ${key === state.detailSortColumn ? 'selected' : ''}>${escapeHtml(DETAIL_LABELS[key] || key)}</option>`).join('');
        elements.detailJson.hidden = true; elements.detailTable.hidden = false; elements.viewRaw.textContent = '原始 JSON';
    }
    function renderDetail(snapshot) {
        state.detailRows = detailRows(snapshot); state.detailColumns = detailColumns(state.detailRows); state.detailPage = 1; state.detailFilter = ''; state.detailSortColumn = state.detailColumns[0] || ''; state.detailSortAscending = true; elements.detailSearch.value = ''; elements.detailTools.hidden = false; elements.detailSortDirection.textContent = '升序'; renderDetailTable();
        elements.detailModal.hidden = false;
    }

    function downloadDetailTable(snapshot) {
        const rows = detailRows(snapshot); const columns = detailColumns(rows); const csv = [columns.map(key => DETAIL_LABELS[key] || key), ...rows.map(row => columns.map(key => detailValue(row[key], key)))].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
        const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })); link.download = `${snapshot.platform}_${topic().path}_detail.csv`; link.click(); URL.revokeObjectURL(link.href);
    }

    function renderAnalysis() { renderKpis(); renderChart(); renderTable(); }

    function renderMonthlySection(section, label) {
        const { total, accounts, priorities } = section;
        const pct = value => `${Number(value || 0).toFixed(1)}%`;
        const target = total.targetRate > 0 ? `收编目标 ${pct(total.targetRate)}，当前距离目标 ${pct(Math.max(0, total.targetRate - total.currentRate))}` : '快照中未设置收编目标';
        const cells = metric => `<td>${metric.quantity}</td><td>${metric.incorporated}</td><td>${pct(metric.currentRate)}</td><td>${metric.pending}</td><td>${metric.annualPlan}</td><td>${metric.noPlan}</td><td>${pct(metric.plannedRate)}</td>`;
        const rows = accounts.map(item => `<tr><th scope="row">${escapeHtml(item.customer)}</th>${cells(item)}</tr>`).join('');
        const priorityText = priorities.length ? priorities.map(item => `${escapeHtml(item.customer)} · ${escapeHtml(item.label)}（${item.noPlan}）`).join('；') : '暂无无计划重点项';
        return `<section class="topic-monthly-section"><h3>➤ 紧急 EOS ${label}收编进展</h3><div class="topic-monthly-copy"><p><strong>【总体进展】</strong>已收编 ${total.incorporated} / ${total.quantity}，当前收编率 ${pct(total.currentRate)}；${target}。完成已录入今年计划 ${total.annualPlan} 后，预计收编率 ${pct(total.plannedRate)}。</p><p><strong>【核心风险】</strong>待收编 ${total.pending}，其中 ${total.noPlan} 尚无今年计划。</p><p><strong>【重点推进】</strong>${priorityText}。</p></div><p class="topic-monthly-intro">${label} EOS 分客户进展如下：</p><div class="topic-table-wrap topic-report-table-wrap"><table class="topic-monthly-table"><thead><tr><th rowspan="3">客户</th><th colspan="7">紧急 EOS · ${label}</th></tr><tr><th rowspan="2">总量</th><th rowspan="2">已收编</th><th rowspan="2">当前收编率</th><th colspan="3">待收编</th><th rowspan="2">计划后收编率</th></tr><tr><th>小计</th><th>今年计划</th><th>无计划</th></tr></thead><tbody>${rows}<tr class="topic-monthly-total"><th scope="row">合计</th>${cells(total)}</tr></tbody></table></div><p class="topic-report-caption">（表 ${label === '产品' ? 1 : 2}：${label} EOS 收编进展）</p></section>`;
    }

    const MONTHLY_COPY_SELECTOR = '.topic-report-title, .topic-report-objective, .topic-report-heading, .topic-monthly-section h3, .topic-monthly-section .topic-monthly-copy p, .topic-monthly-section .topic-monthly-intro, .topic-monthly-footnote';
    const FIXED_COPY_SELECTOR = '.topic-fixed-head h3, .topic-fixed-head p, .topic-fixed-block h4, .topic-fixed-steps, .topic-fixed-block .topic-monthly-copy p, .topic-fixed-block .topic-monthly-intro, .topic-fixed-footnote';
    let editingBlock = null;
    let editingRange = null;

    function copyStorageKey(scope) {
        let tenant = 'default';
        try { tenant = localStorage.getItem('tools_tenant_id') || tenant; } catch (_) { /* storage may be disabled */ }
        return `topic-eos:monthly-copy:v1:${tenant}:${scope === 'fixed' ? 'fixed' : `month:${state.eosMonthlyReport?.month || ''}`}`;
    }

    function readCopyPreferences(scope) {
        try {
            const value = JSON.parse(localStorage.getItem(copyStorageKey(scope)) || '{}');
            return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        } catch (_) { return {}; }
    }

    function sanitizeCopyHtml(html) {
        const parsed = new DOMParser().parseFromString(`<div>${String(html || '').slice(0, 10000)}</div>`, 'text/html');
        const result = document.createElement('div');
        const safeColor = value => /^#[0-9a-f]{6}$/i.test(value || '') || /^rgba?\([\d\s.,%]+\)$/i.test(value || '') ? value : '';
        function copyNode(source, target) {
            if (source.nodeType === Node.TEXT_NODE) { target.appendChild(document.createTextNode(source.textContent)); return; }
            if (source.nodeType !== Node.ELEMENT_NODE) return;
            const tag = source.tagName.toLowerCase();
            if (['script', 'style', 'svg', 'iframe', 'object'].includes(tag)) return;
            if (tag === 'br') { target.appendChild(document.createElement('br')); return; }
            let destination = target;
            if (tag === 'b' || tag === 'strong' || source.style.fontWeight === 'bold' || Number(source.style.fontWeight) >= 600) {
                const bold = document.createElement('strong'); destination.appendChild(bold); destination = bold;
            }
            const color = safeColor(tag === 'font' ? source.getAttribute('color') : source.style.color);
            if (color) { const span = document.createElement('span'); span.style.color = color; destination.appendChild(span); destination = span; }
            Array.from(source.childNodes).forEach(child => copyNode(child, destination));
            if (tag === 'div' || tag === 'p') target.appendChild(document.createElement('br'));
        }
        Array.from(parsed.body.firstElementChild?.childNodes || []).forEach(node => copyNode(node, result));
        return result.innerHTML.replace(/(?:<br>)+$/i, '');
    }

    function setCopyStatus(message) { elements.eosCopyStatus.textContent = message; }

    function saveCopy(block) {
        const scope = block.dataset.eosCopyScope;
        const preferences = readCopyPreferences(scope);
        preferences[block.dataset.eosCopyKey] = sanitizeCopyHtml(block.innerHTML);
        try { localStorage.setItem(copyStorageKey(scope), JSON.stringify(preferences)); setCopyStatus('已自动保存'); }
        catch (_) { setCopyStatus('浏览器未能保存偏好，本次修改仅在当前页面有效'); }
    }

    function activateCopy(root, selector, scope) {
        const preferences = readCopyPreferences(scope);
        root.querySelectorAll(selector).forEach((block, index) => {
            const key = `copy-${index}`;
            if (scope === 'fixed' && !state.fixedCopyDefaults.has(key)) state.fixedCopyDefaults.set(key, block.innerHTML);
            if (typeof preferences[key] === 'string') block.innerHTML = sanitizeCopyHtml(preferences[key]);
            block.contentEditable = 'true'; block.spellcheck = false;
            block.classList.add('topic-editable'); block.dataset.eosCopyKey = key; block.dataset.eosCopyScope = scope;
            block.title = '点击修改，修改后自动保存';
            block.addEventListener('input', () => saveCopy(block));
            block.addEventListener('blur', () => { const clean = sanitizeCopyHtml(block.innerHTML); if (block.innerHTML !== clean) block.innerHTML = clean; });
            block.addEventListener('paste', event => {
                event.preventDefault();
                document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
            });
            block.addEventListener('drop', event => event.preventDefault());
        });
    }

    function hideTextToolbar() { elements.eosTextToolbar.hidden = true; editingBlock = null; editingRange = null; }

    function updateToolbarActiveStates() {
        if (!elements.eosTextToolbar || elements.eosTextToolbar.hidden) return;
        const boldBtn = elements.eosTextToolbar.querySelector('button[data-eos-format="bold"]');
        let isBold = false;
        try {
            isBold = document.queryCommandState('bold');
        } catch (_) {}
        if (!isBold && editingRange) {
            const container = editingRange.commonAncestorContainer;
            const el = container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement;
            if (el) {
                const weight = window.getComputedStyle(el).fontWeight;
                isBold = el.closest('strong, b') !== null || Number.parseInt(weight, 10) >= 600 || weight === 'bold';
            }
        }
        if (boldBtn) {
            boldBtn.classList.toggle('is-active', Boolean(isBold));
            boldBtn.setAttribute('aria-pressed', Boolean(isBold) ? 'true' : 'false');
            boldBtn.title = isBold ? '已加粗（点击取消加粗）' : '加粗';
        }

        let currentColor = '';
        try {
            currentColor = document.queryCommandValue('foreColor') || '';
        } catch (_) {}
        if (!currentColor && editingRange) {
            const container = editingRange.commonAncestorContainer;
            const el = container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement;
            if (el) currentColor = window.getComputedStyle(el).color;
        }
        const hex = excelReportColor(currentColor, '').toLowerCase();
        elements.eosTextToolbar.querySelectorAll('button[data-eos-color]').forEach(btn => {
            const btnColor = btn.dataset.eosColor.toLowerCase();
            const btnHex = excelReportColor(btnColor, '').toLowerCase();
            const matches = hex && btnHex && hex === btnHex;
            btn.classList.toggle('is-active', Boolean(matches));
        });
    }

    function rememberTextSelection() {
        const selection = window.getSelection();
        if (!selection?.rangeCount || selection.isCollapsed) { hideTextToolbar(); return; }
        const anchor = selection.anchorNode?.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection.anchorNode?.parentElement;
        const focus = selection.focusNode?.nodeType === Node.ELEMENT_NODE ? selection.focusNode : selection.focusNode?.parentElement;
        const block = anchor?.closest?.('.topic-report-sheet .topic-editable');
        if (!block || focus?.closest?.('.topic-report-sheet .topic-editable') !== block) { hideTextToolbar(); return; }
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (!rect.width && !rect.height) { hideTextToolbar(); return; }
        editingBlock = block; editingRange = range.cloneRange();
        elements.eosTextToolbar.hidden = false;
        elements.eosTextToolbar.style.top = `${Math.max(8, rect.top - elements.eosTextToolbar.offsetHeight - 8)}px`;
        elements.eosTextToolbar.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - elements.eosTextToolbar.offsetWidth - 8))}px`;
        updateToolbarActiveStates();
    }

    function applyTextFormat(command, value) {
        if (!editingBlock?.isConnected || !editingRange || editingRange.collapsed) return;
        editingBlock.focus();
        const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(editingRange);
        if (command === 'foreColor') document.execCommand('styleWithCSS', false, true);
        document.execCommand(command, false, value || null);
        saveCopy(editingBlock);
        rememberTextSelection();
    }

    const THEME_STORAGE_KEY = 'topic_analysis_theme';

    function initTheme() {
        let saved = 'light';
        try { saved = localStorage.getItem(THEME_STORAGE_KEY) || 'light'; } catch (_) {}
        setTheme(saved, false);
    }

    function setTheme(theme, save = true) {
        const active = theme === 'dark' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', active);
        if (elements.themeToggleIcon && elements.themeToggleText && elements.themeToggleButton) {
            if (active === 'dark') {
                elements.themeToggleIcon.textContent = '🌙';
                elements.themeToggleText.textContent = '深色模式';
                elements.themeToggleButton.title = '当前为深色模式，点击切换至浅色模式';
            } else {
                elements.themeToggleIcon.textContent = '☀️';
                elements.themeToggleText.textContent = '浅色模式';
                elements.themeToggleButton.title = '当前为浅色模式，点击切换至深色模式';
            }
        }
        if (save) {
            try { localStorage.setItem(THEME_STORAGE_KEY, active); } catch (_) {}
        }
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        setTheme(current === 'dark' ? 'light' : 'dark', true);
    }

    const firstNumber = (row, keys) => {
        for (const key of keys) {
            const val = row?.[key];
            if (val !== undefined && val !== null && val !== '') {
                const n = Number(val);
                if (!Number.isNaN(n)) return n;
            }
        }
        return 0;
    };

    const aliases = { 'NILE ON LINE (NOL)': 'Etisalat Misr' };
    const customerName = row => aliases[String(row?.customer_name || '').trim()] || String(row?.customer_name || '').trim() || '未分类客户';

    function excelReportColor(value, fallback = 'FF0F172A') {
        const color = String(value || '').trim();
        const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
        if (hex) {
            const digits = hex[1].length === 3 ? [...hex[1]].map(letter => letter + letter).join('') : hex[1];
            return (digits.length === 8 ? digits : `FF${digits}`).toUpperCase();
        }
        const rgb = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        if (rgb) return `FF${rgb.slice(1, 4).map(part => Math.min(255, Number(part)).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
        return fallback;
    }

    function reportExcelRichText(block) {
        const computed = getComputedStyle(block);
        const base = { bold: Number.parseInt(computed.fontWeight, 10) >= 600, color: computed.color };
        const size = Math.max(9, Math.round(Number.parseFloat(computed.fontSize) * 0.75));
        const runs = [];
        const visit = (node, format) => {
            if (node.nodeType === Node.TEXT_NODE) {
                if (node.textContent) runs.push({ text: node.textContent, font: { name: 'Microsoft YaHei', size, bold: format.bold, color: { argb: excelReportColor(format.color) } } });
                return;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            const tag = node.tagName.toLowerCase();
            if (tag === 'br') { runs.push({ text: '\n', font: { name: 'Microsoft YaHei', size } }); return; }
            const next = { ...format };
            if (tag === 'b' || tag === 'strong') next.bold = true;
            if (node.style?.color) next.color = node.style.color;
            if (tag === 'font' && node.getAttribute('color')) next.color = node.getAttribute('color');
            Array.from(node.childNodes).forEach(child => visit(child, next));
            if (tag === 'div' || tag === 'p') runs.push({ text: '\n', font: { name: 'Microsoft YaHei', size } });
        };
        Array.from(block.childNodes).forEach(node => visit(node, base));
        return runs.length ? { richText: runs } : block.textContent;
    }

    async function downloadExcelWorkbook(workbook, filename) {
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function appendMonthlyWorksheet(workbook) {
        const sheet = elements.eosReportSheet || document.getElementById('eosReportSheet');
        if (!sheet) return;
        const worksheet = workbook.addWorksheet('EOS收编进展月报', {
            pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
        });
        const columns = 12;
        for (let c = 1; c <= columns; c++) worksheet.getColumn(c).width = c === 1 ? 16 : 12;
        const border = {
            top: { style: 'thin', color: { argb: 'FF94A3B8' } },
            left: { style: 'thin', color: { argb: 'FF94A3B8' } },
            bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
            right: { style: 'thin', color: { argb: 'FF94A3B8' } }
        };
        let rowNumber = 1;

        const appendCopy = block => {
            const row = worksheet.getRow(rowNumber++);
            worksheet.mergeCells(row.number, 1, row.number, columns);
            const cell = row.getCell(1);
            const computed = getComputedStyle(block);
            cell.value = reportExcelRichText(block);
            const isTitle = block.classList.contains('topic-report-title');
            const isSectionHeading = block.tagName === 'H3' || block.classList.contains('topic-report-heading') || block.tagName === 'H4';
            const isObjective = block.classList.contains('topic-report-objective');
            cell.alignment = {
                vertical: 'middle',
                horizontal: isTitle ? 'center' : 'left',
                wrapText: true
            };
            cell.font = {
                name: 'Microsoft YaHei',
                size: Math.max(9, Math.round(Number.parseFloat(computed.fontSize) * 0.75)),
                bold: Number.parseInt(computed.fontWeight, 10) >= 600,
                color: { argb: excelReportColor(computed.color) }
            };
            if (isTitle) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCEEF4' } };
                row.height = 38;
            } else if (isSectionHeading) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                row.height = 25;
                cell.border = { bottom: border.bottom };
            } else if (isObjective) {
                row.height = 24;
                cell.border = { bottom: border.bottom };
            } else {
                row.height = Math.max(20, Math.ceil(block.getBoundingClientRect().height * 0.75) + 3);
            }
        };

        const appendCaption = block => {
            const row = worksheet.getRow(rowNumber++);
            worksheet.mergeCells(row.number, 1, row.number, columns);
            const cell = row.getCell(1);
            cell.value = block.textContent.trim();
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.font = { name: 'Microsoft YaHei', size: 9, color: { argb: 'FF64748B' } };
            row.height = 20;
        };

        const appendTable = table => {
            const rows = Array.from(table.rows);
            const grid = [];
            rows.forEach(sourceRow => {
                const rowIndex = grid.length;
                grid[rowIndex] = grid[rowIndex] || [];
                let cIndex = 1;
                const currentRow = worksheet.getRow(rowNumber);
                const isHeader = sourceRow.parentElement?.tagName === 'THEAD';
                const isTotal = sourceRow.classList.contains('topic-monthly-total');
                Array.from(sourceRow.cells).forEach(cell => {
                    while (grid[rowIndex][cIndex]) cIndex++;
                    const rowSpan = cell.rowSpan || 1;
                    const colSpan = cell.colSpan || 1;
                    if (rowSpan > 1 || colSpan > 1) {
                        worksheet.mergeCells(rowNumber, cIndex, rowNumber + rowSpan - 1, cIndex + colSpan - 1);
                    }
                    for (let r = 0; r < rowSpan; r++) {
                        grid[rowIndex + r] = grid[rowIndex + r] || [];
                        for (let c = 0; c < colSpan; c++) {
                            grid[rowIndex + r][cIndex + c] = true;
                        }
                    }
                    const xlCell = currentRow.getCell(cIndex);
                    const text = cell.textContent.trim();
                    const isPercent = /^[\d.]+%$/.test(text);
                    const isNumeric = /^-?\d+(?:,\d+)*(?:\.\d+)?$/.test(text);
                    xlCell.value = isPercent ? text : (isNumeric ? Number(text.replace(/,/g, '')) : text);
                    const isComplete = cell.classList.contains('topic-fixed-complete');
                    xlCell.font = {
                        name: 'Microsoft YaHei',
                        size: isHeader ? 10 : 9,
                        bold: isHeader || isTotal || cell.tagName === 'TH' || isComplete,
                        color: { argb: isComplete ? 'FF087443' : 'FF0F172A' }
                    };
                    xlCell.alignment = {
                        horizontal: cell.tagName === 'TH' && !cell.getAttribute('scope') ? 'center' : (isNumeric || isPercent ? 'right' : 'center'),
                        vertical: 'middle',
                        wrapText: true
                    };
                    xlCell.border = border;
                    if (isHeader || isTotal) {
                        xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F1F5' } };
                    }
                    cIndex += colSpan;
                });
                currentRow.height = isHeader ? 26 : 22;
                rowNumber++;
            });
            rowNumber++;
        };

        const appendNode = node => {
            if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
            if (node.classList?.contains('topic-report-caption')) {
                appendCaption(node);
            } else if (node.tagName === 'TABLE') {
                appendTable(node);
            } else if (
                node.classList?.contains('topic-report-title') ||
                node.classList?.contains('topic-report-objective') ||
                node.classList?.contains('topic-report-heading') ||
                node.classList?.contains('topic-monthly-intro') ||
                node.classList?.contains('topic-monthly-source') ||
                node.classList?.contains('topic-fixed-steps') ||
                node.classList?.contains('topic-fixed-footnote') ||
                node.classList?.contains('topic-monthly-footnote') ||
                (node.parentElement?.classList?.contains('topic-monthly-copy') && node.tagName === 'P') ||
                (node.tagName === 'H3' && node.closest('.topic-report-sheet')) ||
                (node.tagName === 'H4' && node.closest('.topic-report-sheet'))
            ) {
                appendCopy(node);
            } else {
                Array.from(node.children || []).forEach(appendNode);
            }
        };

        Array.from(sheet.children).forEach(appendNode);
        worksheet.pageSetup.printArea = `A1:L${Math.max(1, rowNumber - 1)}`;
        return worksheet;
    }

    function appendAnalysisWorksheet(workbook, snapshot) {
        const worksheet = workbook.addWorksheet('多维度统计分析', {
            views: [{ state: 'frozen', ySplit: 1 }]
        });
        const borderThin = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
        const borderHeader = {
            top: { style: 'thin', color: { argb: 'FF94A3B8' } },
            left: { style: 'thin', color: { argb: 'FF94A3B8' } },
            bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
            right: { style: 'thin', color: { argb: 'FF94A3B8' } }
        };

        const prodRows = Array.isArray(snapshot?.data?.eosProduct) ? snapshot.data.eosProduct : [];
        const verRows = Array.isArray(snapshot?.data?.eosVersion) ? snapshot.data.eosVersion : [];
        const plans = snapshot?.settings?.eos?.plans || {};

        const parseProdRow = row => {
            const cust = customerName(row);
            const line = String(row.product_line_name || row.product_line_map || '其他');
            const prod = String(row.product_name || '未命名产品');
            const phase = String(row.current_phase_name || '未指定');
            const qty = firstNumber(row, ['incorporation_total_nes', 'annual_storage', 'capacities', 'current_inventory']);
            const normal = firstNumber(row, ['before_urgent_incorporated_nes_dtl', 'incorporated_nes']);
            const deact = firstNumber(row, ['deactivated_nes']);
            const inc = qty > 0 ? Math.min(qty, normal + deact) : normal;
            const pend = firstNumber(row, ['to_be_incorporated_nes']);
            const planKey = [cust, line, prod, prod].join('|||');
            const plan = Math.min(pend, Math.max(0, Math.floor(Number(plans?.product?.[planKey]) || 0)));
            const noplan = Math.max(0, pend - plan);
            return { customer: cust, line, product: prod, phase, quantity: qty, incorporated: inc, pending: pend, deactivated: deact, annualPlan: plan, noPlan: noplan };
        };

        const parseVerRow = row => {
            const cust = customerName(row);
            const line = String(row.product_line_name || row.product_line_map || '其他');
            const prod = String(row.product_name || '未命名产品');
            const ver = String(row.software_version || row.version_name || prod);
            const phase = String(row.current_phase_name || '未指定');
            const qty = firstNumber(row, ['incorporation_total_nes', 'annual_storage', 'capacities', 'current_inventory']);
            const normal = firstNumber(row, ['nc_urgent_incorp_complet_rate_dtl', 'incorporated_nes']);
            const deact = firstNumber(row, ['deactivated_nes']);
            const inc = qty > 0 ? Math.min(qty, normal + deact) : normal;
            const pend = firstNumber(row, ['to_be_incorporated_nes']);
            const planKey = [cust, line, prod, ver].join('|||');
            const plan = Math.min(pend, Math.max(0, Math.floor(Number(plans?.version?.[planKey]) || 0)));
            const noplan = Math.max(0, pend - plan);
            return { customer: cust, line, product: prod, version: ver, phase, quantity: qty, incorporated: inc, pending: pend, deactivated: deact, annualPlan: plan, noPlan: noplan };
        };

        const parsedProds = prodRows.map(parseProdRow);
        const parsedVers = verRows.map(parseVerRow);

        let rowNum = 1;

        const writeSectionTitle = (title, cols) => {
            const row = worksheet.getRow(rowNum);
            worksheet.mergeCells(rowNum, 1, rowNum, cols);
            row.height = 26;
            const cell = row.getCell(1);
            cell.value = title;
            cell.font = { name: 'Microsoft YaHei', size: 11, bold: true, color: { argb: 'FF1D4ED8' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
            cell.border = { bottom: { style: 'thin', color: { argb: 'FF93C5FD' } } };
            rowNum++;
        };

        const writeHeaders = (headers, colWidths = []) => {
            const row = worksheet.getRow(rowNum);
            row.height = 24;
            headers.forEach((h, idx) => {
                const c = row.getCell(idx + 1);
                c.value = h;
                c.font = { name: 'Microsoft YaHei', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
                c.alignment = { vertical: 'middle', horizontal: 'center' };
                c.border = borderHeader;
                if (colWidths[idx]) {
                    const col = worksheet.getColumn(idx + 1);
                    col.width = Math.max(col.width || 0, colWidths[idx]);
                }
            });
            rowNum++;
        };

        const writeDataRow = (values, alignMap = [], isTotal = false) => {
            const row = worksheet.getRow(rowNum);
            row.height = isTotal ? 23 : 21;
            values.forEach((v, idx) => {
                const c = row.getCell(idx + 1);
                c.value = v;
                c.font = { name: 'Microsoft YaHei', size: 9, bold: isTotal, color: { argb: 'FF0F172A' } };
                c.border = isTotal ? { top: { style: 'double', color: { argb: 'FF94A3B8' } }, bottom: { style: 'thin', color: { argb: 'FF94A3B8' } } } : borderThin;
                if (isTotal) {
                    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                }
                const align = alignMap[idx] || (typeof v === 'number' ? 'right' : 'center');
                c.alignment = { vertical: 'middle', horizontal: align };
            });
            rowNum++;
        };

        // Table 1: 产品收编 · 分客户与产品线分析
        writeSectionTitle('表 1：产品收编 · 分客户与产品线多维分析', 11);
        const t1Headers = ['序号', '客户', '产品线', '产品种类数', '网元总量', '已收编网元', '当前收编率', '待收编网元', '今年计划', '无计划', '计划后收编率'];
        const t1Widths = [8, 16, 16, 12, 12, 12, 13, 12, 12, 12, 13];
        writeHeaders(t1Headers, t1Widths);

        const prodCustLineMap = new Map();
        parsedProds.forEach(p => {
            const k = `${p.customer}|||${p.line}`;
            if (!prodCustLineMap.has(k)) prodCustLineMap.set(k, { customer: p.customer, line: p.line, prods: new Set(), qty: 0, inc: 0, pend: 0, plan: 0, noplan: 0 });
            const item = prodCustLineMap.get(k);
            item.prods.add(p.product);
            item.qty += p.quantity;
            item.inc += p.incorporated;
            item.pend += p.pending;
            item.plan += p.annualPlan;
            item.noplan += p.noPlan;
        });

        const t1Items = [...prodCustLineMap.values()].sort((a, b) => a.customer.localeCompare(b.customer, 'zh-CN') || a.line.localeCompare(b.line, 'zh-CN'));
        const t1Total = { qty: 0, inc: 0, pend: 0, plan: 0, noplan: 0 };
        t1Items.forEach((item, idx) => {
            t1Total.qty += item.qty;
            t1Total.inc += item.inc;
            t1Total.pend += item.pend;
            t1Total.plan += item.plan;
            t1Total.noplan += item.noplan;
            const curRate = item.qty ? `${(item.inc / item.qty * 100).toFixed(1)}%` : '0.0%';
            const planRate = item.qty ? `${(Math.min(item.qty, item.inc + item.plan) / item.qty * 100).toFixed(1)}%` : '0.0%';
            writeDataRow([idx + 1, item.customer, item.line, item.prods.size, item.qty, item.inc, curRate, item.pend, item.plan, item.noplan, planRate],
                ['center', 'left', 'left', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right']);
        });
        const t1CurRate = t1Total.qty ? `${(t1Total.inc / t1Total.qty * 100).toFixed(1)}%` : '0.0%';
        const t1PlanRate = t1Total.qty ? `${(Math.min(t1Total.qty, t1Total.inc + t1Total.plan) / t1Total.qty * 100).toFixed(1)}%` : '0.0%';
        writeDataRow(['合计', '—', '—', new Set(parsedProds.map(p => p.product)).size, t1Total.qty, t1Total.inc, t1CurRate, t1Total.pend, t1Total.plan, t1Total.noplan, t1PlanRate],
            ['center', 'center', 'center', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right'], true);
        rowNum++;

        // Table 2: 产品收编 · 重点待收编产品 TOP 10
        writeSectionTitle('表 2：产品收编 · 重点待收编产品排行 TOP 10', 10);
        const t2Headers = ['排名', '产品名称', '产品线', '涉及客户', '网元总量', '已收编网元', '待收编网元', '今年计划', '无计划', '当前收编率'];
        const t2Widths = [8, 22, 16, 20, 12, 12, 12, 12, 12, 13];
        writeHeaders(t2Headers, t2Widths);

        const prodMap = new Map();
        parsedProds.forEach(p => {
            if (!prodMap.has(p.product)) prodMap.set(p.product, { product: p.product, line: p.line, custs: new Set(), qty: 0, inc: 0, pend: 0, plan: 0, noplan: 0 });
            const item = prodMap.get(p.product);
            item.custs.add(p.customer);
            item.qty += p.quantity;
            item.inc += p.incorporated;
            item.pend += p.pending;
            item.plan += p.annualPlan;
            item.noplan += p.noPlan;
        });

        const t2Items = [...prodMap.values()].sort((a, b) => b.noplan - a.noplan || b.pend - a.pend).slice(0, 10);
        t2Items.forEach((item, idx) => {
            const curRate = item.qty ? `${(item.inc / item.qty * 100).toFixed(1)}%` : '0.0%';
            writeDataRow([idx + 1, item.product, item.line, [...item.custs].join('、'), item.qty, item.inc, item.pend, item.plan, item.noplan, curRate],
                ['center', 'left', 'left', 'left', 'right', 'right', 'right', 'right', 'right', 'right']);
        });
        rowNum++;

        // Table 3: 版本收编 · 分客户与产品线分析
        writeSectionTitle('表 3：版本收编 · 分客户与产品线多维分析', 11);
        const t3Headers = ['序号', '客户', '产品线', '版本数量', '网元总量', '已收编网元', '当前收编率', '待收编网元', '今年计划', '无计划', '计划后收编率'];
        writeHeaders(t3Headers, t1Widths);

        const verCustLineMap = new Map();
        parsedVers.forEach(v => {
            const k = `${v.customer}|||${v.line}`;
            if (!verCustLineMap.has(k)) verCustLineMap.set(k, { customer: v.customer, line: v.line, vers: new Set(), qty: 0, inc: 0, pend: 0, plan: 0, noplan: 0 });
            const item = verCustLineMap.get(k);
            item.vers.add(v.version);
            item.qty += v.quantity;
            item.inc += v.incorporated;
            item.pend += v.pending;
            item.plan += v.annualPlan;
            item.noplan += v.noPlan;
        });

        const t3Items = [...verCustLineMap.values()].sort((a, b) => a.customer.localeCompare(b.customer, 'zh-CN') || a.line.localeCompare(b.line, 'zh-CN'));
        const t3Total = { qty: 0, inc: 0, pend: 0, plan: 0, noplan: 0 };
        t3Items.forEach((item, idx) => {
            t3Total.qty += item.qty;
            t3Total.inc += item.inc;
            t3Total.pend += item.pend;
            t3Total.plan += item.plan;
            t3Total.noplan += item.noplan;
            const curRate = item.qty ? `${(item.inc / item.qty * 100).toFixed(1)}%` : '0.0%';
            const planRate = item.qty ? `${(Math.min(item.qty, item.inc + item.plan) / item.qty * 100).toFixed(1)}%` : '0.0%';
            writeDataRow([idx + 1, item.customer, item.line, item.vers.size, item.qty, item.inc, curRate, item.pend, item.plan, item.noplan, planRate],
                ['center', 'left', 'left', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right']);
        });
        const t3CurRate = t3Total.qty ? `${(t3Total.inc / t3Total.qty * 100).toFixed(1)}%` : '0.0%';
        const t3PlanRate = t3Total.qty ? `${(Math.min(t3Total.qty, t3Total.inc + t3Total.plan) / t3Total.qty * 100).toFixed(1)}%` : '0.0%';
        writeDataRow(['合计', '—', '—', new Set(parsedVers.map(v => v.version)).size, t3Total.qty, t3Total.inc, t3CurRate, t3Total.pend, t3Total.plan, t3Total.noplan, t3PlanRate],
            ['center', 'center', 'center', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right'], true);
        rowNum++;

        // Table 4: 版本收编 · 高风险无计划版本 TOP 10
        writeSectionTitle('表 4：版本收编 · 高风险无计划版本排行 TOP 10', 11);
        const t4Headers = ['排名', '软件版本', '所属产品', '产品线', '涉及客户', '网元总量', '已收编网元', '待收编网元', '今年计划', '无计划', '当前收编率'];
        const t4Widths = [8, 24, 20, 16, 18, 12, 12, 12, 12, 12, 13];
        writeHeaders(t4Headers, t4Widths);

        const verMap = new Map();
        parsedVers.forEach(v => {
            const k = `${v.product}|||${v.version}`;
            if (!verMap.has(k)) verMap.set(k, { version: v.version, product: v.product, line: v.line, custs: new Set(), qty: 0, inc: 0, pend: 0, plan: 0, noplan: 0 });
            const item = verMap.get(k);
            item.custs.add(v.customer);
            item.qty += v.quantity;
            item.inc += v.incorporated;
            item.pend += v.pending;
            item.plan += v.annualPlan;
            item.noplan += v.noPlan;
        });

        const t4Items = [...verMap.values()].sort((a, b) => b.noplan - a.noplan || b.pend - a.pend).slice(0, 10);
        t4Items.forEach((item, idx) => {
            const curRate = item.qty ? `${(item.inc / item.qty * 100).toFixed(1)}%` : '0.0%';
            writeDataRow([idx + 1, item.version, item.product, item.line, [...item.custs].join('、'), item.qty, item.inc, item.pend, item.plan, item.noplan, curRate],
                ['center', 'left', 'left', 'left', 'left', 'right', 'right', 'right', 'right', 'right', 'right']);
        });
        rowNum++;

        // Table 5: 阶段分布统计
        writeSectionTitle('表 5：EOS 收编与处置阶段分布统计', 5);
        const t5Headers = ['处置阶段', '产品涉及网元', '产品网元占比', '版本涉及网元', '版本网元占比'];
        const t5Widths = [18, 14, 14, 14, 14];
        writeHeaders(t5Headers, t5Widths);

        const phases = new Set([...parsedProds.map(p => p.phase), ...parsedVers.map(v => v.phase)]);
        const totalP = parsedProds.reduce((s, p) => s + p.quantity, 0);
        const totalV = parsedVers.reduce((s, v) => s + v.quantity, 0);
        [...phases].forEach(ph => {
            const pQty = parsedProds.filter(p => p.phase === ph).reduce((s, p) => s + p.quantity, 0);
            const vQty = parsedVers.filter(v => v.phase === ph).reduce((s, v) => s + v.quantity, 0);
            const pPct = totalP ? `${(pQty / totalP * 100).toFixed(1)}%` : '0.0%';
            const vPct = totalV ? `${(vQty / totalV * 100).toFixed(1)}%` : '0.0%';
            writeDataRow([ph, pQty, pPct, vQty, vPct], ['left', 'right', 'right', 'right', 'right']);
        });
        writeDataRow(['合计', totalP, '100.0%', totalV, '100.0%'], ['center', 'right', 'right', 'right', 'right'], true);

        return worksheet;
    }

    function appendProductDetailWorksheet(workbook, snapshot) {
        const worksheet = workbook.addWorksheet('产品收编详表', {
            views: [{ state: 'frozen', ySplit: 1 }]
        });
        const headers = ['序号', '客户', '产品线', '产品名称', '当前阶段', '网元总量', '已收编网元', '待收编网元', '已退网网元', '今年计划', '无计划', '当前收编率', '计划后收编率'];
        const widths = [8, 16, 16, 22, 14, 12, 12, 12, 12, 12, 12, 13, 13];
        const borderHeader = {
            top: { style: 'thin', color: { argb: 'FF94A3B8' } },
            left: { style: 'thin', color: { argb: 'FF94A3B8' } },
            bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
            right: { style: 'thin', color: { argb: 'FF94A3B8' } }
        };
        const borderThin = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        const headRow = worksheet.getRow(1);
        headRow.height = 26;
        headers.forEach((h, idx) => {
            const cell = headRow.getCell(idx + 1);
            cell.value = h;
            cell.font = { name: 'Microsoft YaHei', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F1F5' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = borderHeader;
            worksheet.getColumn(idx + 1).width = widths[idx];
        });

        const rows = Array.isArray(snapshot?.data?.eosProduct) ? snapshot.data.eosProduct : [];
        const plans = snapshot?.settings?.eos?.plans || {};

        rows.forEach((r, idx) => {
            const cust = customerName(r);
            const line = String(r.product_line_name || r.product_line_map || '其他');
            const prod = String(r.product_name || '未命名产品');
            const phase = String(r.current_phase_name || '未指定');
            const qty = firstNumber(r, ['incorporation_total_nes', 'annual_storage', 'capacities', 'current_inventory']);
            const normal = firstNumber(r, ['before_urgent_incorporated_nes_dtl', 'incorporated_nes']);
            const deact = firstNumber(r, ['deactivated_nes']);
            const inc = qty > 0 ? Math.min(qty, normal + deact) : normal;
            const pend = firstNumber(r, ['to_be_incorporated_nes']);
            const planKey = [cust, line, prod, prod].join('|||');
            const plan = Math.min(pend, Math.max(0, Math.floor(Number(plans?.product?.[planKey]) || 0)));
            const noplan = Math.max(0, pend - plan);
            const curRate = qty ? `${(inc / qty * 100).toFixed(1)}%` : '0.0%';
            const planRate = qty ? `${(Math.min(qty, inc + plan) / qty * 100).toFixed(1)}%` : '0.0%';

            const row = worksheet.getRow(idx + 2);
            row.height = 21;
            const vals = [idx + 1, cust, line, prod, phase, qty, inc, pend, deact, plan, noplan, curRate, planRate];
            vals.forEach((v, cIdx) => {
                const cell = row.getCell(cIdx + 1);
                cell.value = v;
                cell.font = { name: 'Microsoft YaHei', size: 9, color: { argb: 'FF0F172A' } };
                cell.border = borderThin;
                cell.alignment = {
                    vertical: 'middle',
                    horizontal: [0, 1, 2, 3, 4].includes(cIdx) ? ([0].includes(cIdx) ? 'center' : 'left') : 'right'
                };
            });
        });

        worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
        return worksheet;
    }

    function appendVersionDetailWorksheet(workbook, snapshot) {
        const worksheet = workbook.addWorksheet('版本收编详表', {
            views: [{ state: 'frozen', ySplit: 1 }]
        });
        const headers = ['序号', '客户', '产品线', '产品名称', '软件版本', '当前阶段', '网元总量', '已收编网元', '待收编网元', '已退网网元', '今年计划', '无计划', '当前收编率', '计划后收编率'];
        const widths = [8, 16, 16, 20, 24, 14, 12, 12, 12, 12, 12, 12, 13, 13];
        const borderHeader = {
            top: { style: 'thin', color: { argb: 'FF94A3B8' } },
            left: { style: 'thin', color: { argb: 'FF94A3B8' } },
            bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
            right: { style: 'thin', color: { argb: 'FF94A3B8' } }
        };
        const borderThin = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        const headRow = worksheet.getRow(1);
        headRow.height = 26;
        headers.forEach((h, idx) => {
            const cell = headRow.getCell(idx + 1);
            cell.value = h;
            cell.font = { name: 'Microsoft YaHei', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F1F5' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = borderHeader;
            worksheet.getColumn(idx + 1).width = widths[idx];
        });

        const rows = Array.isArray(snapshot?.data?.eosVersion) ? snapshot.data.eosVersion : [];
        const plans = snapshot?.settings?.eos?.plans || {};

        rows.forEach((r, idx) => {
            const cust = customerName(r);
            const line = String(r.product_line_name || r.product_line_map || '其他');
            const prod = String(r.product_name || '未命名产品');
            const ver = String(r.software_version || r.version_name || prod);
            const phase = String(r.current_phase_name || '未指定');
            const qty = firstNumber(r, ['incorporation_total_nes', 'annual_storage', 'capacities', 'current_inventory']);
            const normal = firstNumber(r, ['nc_urgent_incorp_complet_rate_dtl', 'incorporated_nes']);
            const deact = firstNumber(r, ['deactivated_nes']);
            const inc = qty > 0 ? Math.min(qty, normal + deact) : normal;
            const pend = firstNumber(r, ['to_be_incorporated_nes']);
            const planKey = [cust, line, prod, ver].join('|||');
            const plan = Math.min(pend, Math.max(0, Math.floor(Number(plans?.version?.[planKey]) || 0)));
            const noplan = Math.max(0, pend - plan);
            const curRate = qty ? `${(inc / qty * 100).toFixed(1)}%` : '0.0%';
            const planRate = qty ? `${(Math.min(qty, inc + plan) / qty * 100).toFixed(1)}%` : '0.0%';

            const row = worksheet.getRow(idx + 2);
            row.height = 21;
            const vals = [idx + 1, cust, line, prod, ver, phase, qty, inc, pend, deact, plan, noplan, curRate, planRate];
            vals.forEach((v, cIdx) => {
                const cell = row.getCell(cIdx + 1);
                cell.value = v;
                cell.font = { name: 'Microsoft YaHei', size: 9, color: { argb: 'FF0F172A' } };
                cell.border = borderThin;
                cell.alignment = {
                    vertical: 'middle',
                    horizontal: [0, 1, 2, 3, 4, 5].includes(cIdx) ? ([0].includes(cIdx) ? 'center' : 'left') : 'right'
                };
            });
        });

        worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
        return worksheet;
    }

    async function exportMonthlyPng() {
        if (!state.eosMonthlyReport) {
            alert('当前暂无月报数据可供导出。');
            return;
        }
        if (typeof html2canvas !== 'function') {
            alert('图片导出组件（html2canvas）未加载，请刷新页面后重试。');
            return;
        }
        const sheet = elements.eosReportSheet || document.getElementById('eosReportSheet');
        if (!sheet) return;
        hideTextToolbar();
        if (document.activeElement && document.activeElement.classList?.contains('topic-editable')) {
            document.activeElement.blur();
        }
        const button = elements.eosDownloadPng;
        const originalText = button.textContent;
        button.classList.add('is-loading');
        button.textContent = '正在生成 PNG...';

        const currentTheme = document.documentElement.getAttribute('data-theme');
        if (currentTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'light');
        }
        try {
            await new Promise(resolve => setTimeout(resolve, 50));
            const canvas = await html2canvas(sheet, {
                backgroundColor: '#ffffff',
                scale: 2,
                useCORS: true,
                logging: false
            });
            const month = state.eosMonthlyReport.month || '当期';
            const link = document.createElement('a');
            link.download = `EOS产品与版本收编月报_${month}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error('月报 PNG 导出失败:', error);
            alert(`月报 PNG 导出失败：${error.message}`);
        } finally {
            if (currentTheme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
            }
            button.classList.remove('is-loading');
            button.textContent = originalText;
        }
    }

    async function exportMonthlyExcel() {
        if (!state.eosMonthlyReport) {
            alert('当前暂无月报数据可供导出。');
            return;
        }
        if (typeof ExcelJS === 'undefined') {
            alert('Excel 导出组件（ExcelJS）未加载，请刷新页面后重试。');
            return;
        }
        const button = elements.eosDownloadExcel;
        const originalText = button.textContent;
        button.classList.add('is-loading');
        button.textContent = '正在生成 Excel...';
        try {
            let snapshot = state.eosMonthlySnapshot;
            if (!snapshot && state.eosMonthlyReport?.snapshot?.id) {
                const item = await getFullSnapshot(state.eosMonthlyReport.snapshot.id);
                snapshot = item?.snapshot;
                state.eosMonthlySnapshot = snapshot;
            }
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'NetCare · EOS 进展月报';
            workbook.created = new Date();

            appendMonthlyWorksheet(workbook);
            appendAnalysisWorksheet(workbook, snapshot);
            appendProductDetailWorksheet(workbook, snapshot);
            appendVersionDetailWorksheet(workbook, snapshot);

            const month = state.eosMonthlyReport.month || '当期';
            await downloadExcelWorkbook(workbook, `EOS产品与版本收编月报_${month}.xlsx`);
        } catch (error) {
            console.error('月报 Excel 导出失败:', error);
            alert(`月报 Excel 导出失败：${error.message}`);
        } finally {
            button.classList.remove('is-loading');
            button.textContent = originalText;
        }
    }

    function renderEosMonthlyReport(report) {
        elements.eosMonthlyReport.innerHTML = `<h3 class="topic-report-title">EOS 产品与版本收编进展月报（${escapeHtml(report.month)}）</h3><p class="topic-report-objective">总体目标：加快紧急 EOS 产品与版本收编，优先推进无计划网元的升级、退网或收编方案。</p><p class="topic-report-heading">简要进展：</p>` + renderMonthlySection(report.product, '产品') + renderMonthlySection(report.version, '版本') + '<p class="topic-monthly-footnote">口径：已退网网元计入已收编；无计划 = 待收编 − 今年计划；计划后收编率 =（已收编 + 今年计划）÷ 总量。计划后数值以完成已录入计划为前提，不代表已完成。</p>';
        activateCopy(elements.eosMonthlyReport, MONTHLY_COPY_SELECTOR, 'monthly');
    }

    async function loadMonthlyReport(month = '') {
        elements.eosMonthlyReport.textContent = '正在生成月报…';
        state.eosMonthlySnapshot = null;
        try {
            const result = await API.get(`/api/topic-snapshots/eos-monthly-report${month ? `?month=${encodeURIComponent(month)}` : ''}`);
            elements.eosMonthlyMonth.innerHTML = (result.months || []).map(value => `<option value="${escapeHtml(value)}"${result.report?.month === value ? ' selected' : ''}>${escapeHtml(value)}</option>`).join('');
            if (!result.report) {
                state.eosMonthlyReport = null;
                elements.eosCopyResetMonth.disabled = true;
                if (elements.eosDownloadPng) elements.eosDownloadPng.disabled = true;
                if (elements.eosDownloadExcel) elements.eosDownloadExcel.disabled = true;
                elements.eosMonthlySource.textContent = '';
                elements.eosMonthlyReport.textContent = '暂无该月的 NetCare EOS 产品与版本快照。';
                return;
            }
            const report = result.report;
            state.eosMonthlyReport = report;
            elements.eosCopyResetMonth.disabled = false;
            if (elements.eosDownloadPng) elements.eosDownloadPng.disabled = false;
            if (elements.eosDownloadExcel) elements.eosDownloadExcel.disabled = false;
            elements.eosMonthlySource.textContent = `数据月份 ${report.month} · 数据时间 ${formatTime(report.snapshot.capturedAt)} · 导入时间 ${formatTime(report.snapshot.importedAt)}${report.snapshot.name ? ` · ${report.snapshot.name}` : ''}`;
            renderEosMonthlyReport(report);
        } catch (error) {
            state.eosMonthlyReport = null;
            elements.eosCopyResetMonth.disabled = true;
            if (elements.eosDownloadPng) elements.eosDownloadPng.disabled = true;
            if (elements.eosDownloadExcel) elements.eosDownloadExcel.disabled = true;
            elements.eosMonthlyReport.textContent = `月报生成失败：${error.message}`;
        }
    }

    async function loadData() {
        elements.loadStatus.textContent = '正在读取…';
        try {
            const result = await API.get('/api/topic-snapshots?limit=200');
            state.items = Array.isArray(result.items) ? result.items : []; state.total = Number(result.total) || state.items.length;
            updateStats(); renderAnalysis(); elements.loadStatus.textContent = `已读取 ${state.items.length} 份快照`;
        } catch (error) { elements.loadStatus.textContent = `读取失败：${error.message}`; elements.trendChart.innerHTML = '<div class="topic-chart-empty">暂时无法读取趋势数据</div>'; }
        await loadMonthlyReport(elements.eosMonthlyMonth.value);
    }

    async function getFullSnapshot(id) { return (await API.get(`/api/topic-snapshots/${encodeURIComponent(id)}`)).item; }
    async function handleTableAction(event) {
        const button = event.target.closest('button[data-action]'); if (!button) return; const { action, id } = button.dataset; button.disabled = true;
        try {
            if (action === 'delete') { if (!window.confirm('确定删除这份历史快照？删除后无法在分析页回顾。')) return; await API.delete(`/api/topic-snapshots/${encodeURIComponent(id)}`); await loadData(); return; }
            const item = await getFullSnapshot(id);
            if (action === 'view') { state.detailSnapshot = item; elements.detailTitle.textContent = `${item.platform === 'datafab' ? 'DataFab' : 'NetCare'} · ${formatTime(item.capturedAt)}`; renderDetail(item.snapshot); }
            else { const blob = new Blob([JSON.stringify(item.snapshot, null, 2)], { type: 'application/json;charset=utf-8' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${item.platform}_topic_${String(item.capturedAt).replace(/[-:T.Z]/g, '').slice(0, 14)}.json`; link.click(); URL.revokeObjectURL(link.href); }
        } catch (error) { window.alert(`操作失败：${error.message}`); } finally { button.disabled = false; }
    }

    document.addEventListener('DOMContentLoaded', () => {
        ['totalCount', 'netcareCount', 'datafabCount', 'latestTime', 'themeToggleButton', 'themeToggleIcon', 'themeToggleText', 'refreshButton', 'topicFilter', 'metricFilter', 'analysisTitle', 'metricDefinition', 'topicKpis', 'trendChart', 'metricColumnTitle', 'loadStatus', 'historyBody', 'emptyState', 'eosMonthlyMonth', 'eosMonthlySource', 'eosMonthlyReport', 'eosCopyResetMonth', 'eosCopyResetFixed', 'eosDownloadPng', 'eosDownloadExcel', 'eosReportSheet', 'eosCopyStatus', 'eosTextToolbar', 'detailModal', 'detailTitle', 'detailSummary', 'detailTable', 'detailJson', 'downloadDetail', 'viewRaw', 'toggleDetailFullscreen', 'detailTools', 'detailSearch', 'detailPageSize', 'detailSortColumn', 'detailSortDirection', 'closeDetail'].forEach(id => { elements[id] = document.getElementById(id); });
        initTheme();
        if (elements.themeToggleButton) elements.themeToggleButton.addEventListener('click', toggleTheme);
        if (elements.eosDownloadPng) elements.eosDownloadPng.addEventListener('click', exportMonthlyPng);
        if (elements.eosDownloadExcel) elements.eosDownloadExcel.addEventListener('click', exportMonthlyExcel);
        activateCopy(document.querySelector('.topic-fixed-progress'), FIXED_COPY_SELECTOR, 'fixed');
        document.addEventListener('selectionchange', rememberTextSelection);
        document.addEventListener('mousedown', event => { if (!event.target.closest('.topic-report-sheet .topic-editable, #eosTextToolbar')) hideTextToolbar(); });
        elements.eosTextToolbar.addEventListener('mousedown', event => event.preventDefault());
        elements.eosTextToolbar.addEventListener('click', event => {
            const button = event.target.closest('button'); if (!button) return;
            if (button.dataset.eosFormat === 'bold') applyTextFormat('bold');
            else if (button.dataset.eosColor) applyTextFormat('foreColor', button.dataset.eosColor);
        });
        elements.eosCopyResetMonth.addEventListener('click', () => {
            if (!state.eosMonthlyReport) return;
            try { localStorage.removeItem(copyStorageKey('monthly')); } catch (_) { setCopyStatus('浏览器未能清除偏好'); return; }
            renderEosMonthlyReport(state.eosMonthlyReport); hideTextToolbar(); setCopyStatus('已恢复本月自动文案');
        });
        elements.eosCopyResetFixed.addEventListener('click', () => {
            try { localStorage.removeItem(copyStorageKey('fixed')); } catch (_) { setCopyStatus('浏览器未能清除偏好'); return; }
            document.querySelectorAll('.topic-fixed-progress .topic-editable').forEach(block => { block.innerHTML = state.fixedCopyDefaults.get(block.dataset.eosCopyKey) || ''; });
            hideTextToolbar(); setCopyStatus('已恢复固定文案');
        });
        elements.eosMonthlyMonth.addEventListener('change', event => loadMonthlyReport(event.target.value));
        renderTopicControls(); elements.refreshButton.addEventListener('click', loadData);
        elements.topicFilter.addEventListener('change', event => { state.topicKey = event.target.value; state.metricKey = topic().metrics[0].key; renderTopicControls(); renderAnalysis(); });
        elements.metricFilter.addEventListener('change', event => { state.metricKey = event.target.value; renderAnalysis(); });
        elements.historyBody.addEventListener('click', handleTableAction); elements.downloadDetail.addEventListener('click', () => { if (state.detailSnapshot) downloadDetailTable(state.detailSnapshot.snapshot); }); elements.viewRaw.addEventListener('click', () => { if (!state.detailSnapshot) return; const showingRaw = !elements.detailJson.hidden; elements.detailJson.textContent = JSON.stringify(state.detailSnapshot.snapshot, null, 2); elements.detailJson.hidden = showingRaw; elements.detailTable.hidden = !showingRaw; elements.detailTools.hidden = !showingRaw; elements.viewRaw.textContent = showingRaw ? '原始 JSON' : '返回详表'; }); elements.detailSearch.addEventListener('input', event => { state.detailFilter = event.target.value.trim().toLowerCase(); state.detailPage = 1; renderDetailTable(); }); elements.detailPageSize.addEventListener('change', event => { state.detailPageSize = Number(event.target.value) || 50; state.detailPage = 1; renderDetailTable(); }); elements.detailSortColumn.addEventListener('change', event => { state.detailSortColumn = event.target.value; state.detailPage = 1; renderDetailTable(); }); elements.detailSortDirection.addEventListener('click', () => { state.detailSortAscending = !state.detailSortAscending; elements.detailSortDirection.textContent = state.detailSortAscending ? '升序' : '降序'; renderDetailTable(); }); elements.detailTable.addEventListener('click', event => { const button = event.target.closest('[data-detail-page]'); if (!button) return; state.detailPage += button.dataset.detailPage === 'next' ? 1 : -1; renderDetailTable(); }); elements.toggleDetailFullscreen.addEventListener('click', () => { elements.detailModal.classList.toggle('is-fullscreen'); elements.toggleDetailFullscreen.textContent = elements.detailModal.classList.contains('is-fullscreen') ? '退出全屏' : '全屏'; }); elements.closeDetail.addEventListener('click', () => { elements.detailModal.classList.remove('is-fullscreen'); elements.toggleDetailFullscreen.textContent = '全屏'; elements.detailModal.hidden = true; });
        elements.detailModal.addEventListener('click', event => { if (event.target === elements.detailModal) elements.detailModal.hidden = true; }); loadData();
    });
}());
