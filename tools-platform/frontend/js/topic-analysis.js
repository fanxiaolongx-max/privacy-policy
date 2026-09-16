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

    const state = { items: [], total: 0, topicKey: 'netcare-eos-product', metricKey: 'pending', detailRows: [], detailColumns: [], detailPage: 1, detailPageSize: 50, detailSortColumn: '', detailSortAscending: true, detailFilter: '', eosMonthlyReport: null, fixedCopyDefaults: new Map() };
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

    function renderEosMonthlyReport(report) {
        elements.eosMonthlyReport.innerHTML = `<h3 class="topic-report-title">EOS 产品与版本收编进展月报（${escapeHtml(report.month)}）</h3><p class="topic-report-objective">总体目标：加快紧急 EOS 产品与版本收编，优先推进无计划网元的升级、退网或收编方案。</p><p class="topic-report-heading">简要进展：</p>` + renderMonthlySection(report.product, '产品') + renderMonthlySection(report.version, '版本') + '<p class="topic-monthly-footnote">口径：已退网网元计入已收编；无计划 = 待收编 − 今年计划；计划后收编率 =（已收编 + 今年计划）÷ 总量。计划后数值以完成已录入计划为前提，不代表已完成。</p>';
        activateCopy(elements.eosMonthlyReport, MONTHLY_COPY_SELECTOR, 'monthly');
    }

    async function loadMonthlyReport(month = '') {
        elements.eosMonthlyReport.textContent = '正在生成月报…';
        try {
            const result = await API.get(`/api/topic-snapshots/eos-monthly-report${month ? `?month=${encodeURIComponent(month)}` : ''}`);
            elements.eosMonthlyMonth.innerHTML = (result.months || []).map(value => `<option value="${escapeHtml(value)}"${result.report?.month === value ? ' selected' : ''}>${escapeHtml(value)}</option>`).join('');
            if (!result.report) { state.eosMonthlyReport = null; elements.eosCopyResetMonth.disabled = true; elements.eosMonthlySource.textContent = ''; elements.eosMonthlyReport.textContent = '暂无该月的 NetCare EOS 产品与版本快照。'; return; }
            const report = result.report; state.eosMonthlyReport = report;
            elements.eosCopyResetMonth.disabled = false;
            elements.eosMonthlySource.textContent = `数据月份 ${report.month} · 数据时间 ${formatTime(report.snapshot.capturedAt)} · 导入时间 ${formatTime(report.snapshot.importedAt)}${report.snapshot.name ? ` · ${report.snapshot.name}` : ''}`;
            renderEosMonthlyReport(report);
        } catch (error) { state.eosMonthlyReport = null; elements.eosCopyResetMonth.disabled = true; elements.eosMonthlyReport.textContent = `月报生成失败：${error.message}`; }
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
        ['totalCount', 'netcareCount', 'datafabCount', 'latestTime', 'refreshButton', 'topicFilter', 'metricFilter', 'analysisTitle', 'metricDefinition', 'topicKpis', 'trendChart', 'metricColumnTitle', 'loadStatus', 'historyBody', 'emptyState', 'eosMonthlyMonth', 'eosMonthlySource', 'eosMonthlyReport', 'eosCopyResetMonth', 'eosCopyResetFixed', 'eosCopyStatus', 'eosTextToolbar', 'detailModal', 'detailTitle', 'detailSummary', 'detailTable', 'detailJson', 'downloadDetail', 'viewRaw', 'toggleDetailFullscreen', 'detailTools', 'detailSearch', 'detailPageSize', 'detailSortColumn', 'detailSortDirection', 'closeDetail'].forEach(id => { elements[id] = document.getElementById(id); });
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
