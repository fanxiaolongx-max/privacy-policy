/**
 * uivf12/datafab-analysis.js
 * 生成可嵌入 F12 浮窗的 DataFab 日志回传专题运行时。
 * 运行时通过 Function#toString 内联到复制脚本，不依赖目标站点加载本文件。
 */
(function () {
    'use strict';

    function installDataFabAnalysisRuntime(root, options) {
        if (!root || window.location.hostname !== 'datafab-pro.gtsdata.huawei.com') return null;

        const ENDPOINT = 'https://datafab-pro.gtsdata.huawei.com/DataFabKernelCn/v1/answer/';
        const CONFIG = Object.assign({
            tenantId: 'aca54d00-e984-47c1-979e-fd63c5ede8d6',
            boardId: '7mUadaY3lsOTEAiGsBAsU8', pageId: 'pagelwhmsuan', tableId: 'knAO6m1TYE6rYy8fypwDP0',
            summaryComponentId: '6he6iRp0HPhzQNM0t1wHyq', detailComponentId: '5oAEjRYA8t4uFOxoGbiv34',
            region: '北部非洲地区部', office: '埃及代表处', country: 'Egypt'
        }, options && options.config || {});
        const SETTINGS_KEY = 'uivf12-datafab-log-analysis-v1';
        const PRODUCT_LINES = [
            { key: '光', labelZh: '光业务', labelEn: 'Optical' },
            { key: '无线', labelZh: '无线', labelEn: 'Wireless' },
            { key: '云核', labelZh: '云核心网', labelEn: 'Cloud Core' },
            { key: '数通', labelZh: '数据通信', labelEn: 'Data Communication' },
            { key: 'ICT', labelZh: 'ICT服务与软件', labelEn: 'ICT Services & Software' }
        ];
        let settings = { language: 'zh', year: new Date().getFullYear(), month: new Date().getMonth() + 1, excludeIct: true, excludePendingScore: true, targets: { returnRate: 95, recordRate: 25 } };
        try { settings = Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); settings.excludeIct = settings.excludeIct !== false; settings.excludePendingScore = settings.excludePendingScore !== false; settings.targets = Object.assign({ returnRate: 95, recordRate: 25 }, settings.targets || {}); } catch (error) {}
        let active = false; let loading = false; let destroyed = false; let loadToken = 0; let dashboardData = null; let activeTopic = 'return'; let detailPage = 1; let detailPageSize = 50;
        function tr(zh, en) { return settings.language === 'en' ? en : zh; }
        function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (error) {} }
        function escapeHtml(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
        function num(value) { const parsed = Number(String(value == null ? '' : value).replace(/[% ,]/g, '')); return Number.isFinite(parsed) ? parsed : 0; }
        function rate(value) { const parsed = num(value); return Math.abs(parsed) <= 1.2 && parsed !== 0 ? parsed * 100 : parsed; }
        function fmt(value, digits) { return Number.isFinite(Number(value)) ? Number(value).toLocaleString(settings.language === 'en' ? 'en-US' : 'zh-CN', { maximumFractionDigits: digits == null ? 0 : digits }) : '—'; }
        function fmtRate(value) { return Number.isFinite(Number(value)) ? fmt(value, 1) + '%' : '—'; }
        function smartValue(cell, name) {
            if (cell == null || typeof cell !== 'object') return cell;
            if (cell.formula !== undefined && cell.formula !== null && cell.formula !== '') return cell.formula;
            const isRate = /率|比|rate|ratio|%/i.test(name || '');
            if (isRate && cell.average !== undefined && cell.average !== '') return cell.average;
            if (!isRate && cell.summing !== undefined && cell.summing !== '') return cell.summing;
            if (cell.average !== undefined && cell.average !== '') return cell.average;
            if (cell.summing !== undefined && cell.summing !== '') return cell.summing;
            return '';
        }
        function extractRows(payload) {
            if (payload && Array.isArray(payload.data) && payload.data[0] && Array.isArray(payload.data[0].data)) return payload.data[0].data;
            if (payload && payload.data && !Array.isArray(payload.data)) {
                for (const key of ['data', 'rows', 'list', 'items', 'records']) if (Array.isArray(payload.data[key])) return payload.data[key];
            }
            for (const key of ['rows', 'list', 'items', 'records']) if (payload && Array.isArray(payload[key])) return payload[key];
            return [];
        }
        function extractSummary(payload) {
            const candidates = [];
            if (payload && payload.totalsData && payload.totalsData.columns) candidates.push(payload.totalsData.columns);
            if (payload && payload.sumData) candidates.push(payload.sumData.columns || payload.sumData);
            if (payload && payload.data && !Array.isArray(payload.data)) {
                if (payload.data.totalsData && payload.data.totalsData.columns) candidates.push(payload.data.totalsData.columns);
                if (payload.data.sumData) candidates.push(payload.data.sumData.columns || payload.data.sumData);
            }
            if (payload && Array.isArray(payload.data)) payload.data.forEach(item => {
                if (item && item.totalsData && item.totalsData.columns) candidates.push(item.totalsData.columns);
                if (item && item.sumData) candidates.push(item.sumData.columns || item.sumData);
            });
            const merged = {};
            candidates.forEach(candidate => Object.keys(candidate || {}).forEach(key => {
                const incoming = candidate[key]; const existing = merged[key];
                if (existing === undefined || (incoming && incoming.formula !== undefined && (!existing || existing.formula === undefined))) merged[key] = incoming;
            }));
            return merged;
        }
        function extractAggFields(payload) {
            const output = []; const seen = new Set();
            (function scan(value) {
                if (!value || typeof value !== 'object') return;
                if (Array.isArray(value)) { value.forEach(scan); return; }
                if (value.formulaId && value.displayName && !seen.has(value.displayName)) { seen.add(value.displayName); output.push({ columnName: value.displayName, aggType: 'formula' }); }
                Object.values(value).forEach(scan);
            })(payload);
            return output;
        }
        function readMetric(summary, rows, aliases, asRate) {
            const sources = [summary].concat(rows || []); const normalizedAliases = aliases.map(alias => alias.replace(/\s/g, '').toLowerCase());
            for (const source of sources) {
                const keys = Object.keys(source || {}); let key = keys.find(item => normalizedAliases.includes(item.replace(/\s/g, '').toLowerCase()));
                if (!key) key = keys.find(item => normalizedAliases.some(alias => item.replace(/\s/g, '').toLowerCase().includes(alias)));
                if (key) { const value = smartValue(source[key], key); if (value !== '' && value != null) return asRate ? rate(value) : num(value); }
            }
            return 0;
        }
        function getCookie(name) { const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)')); return match ? decodeURIComponent(match[1]) : ''; }
        function headers() {
            return { accept: 'application/json, text/plain, */*', 'content-type': 'application/json;charset=UTF-8', 'x-xsrf-token': getCookie('XSRF-TOKEN') || getCookie('NETLIVE-XSRF-TOKEN'), 'x-requested-with': 'XMLHttpRequest', tenantId: CONFIG.tenantId, 'project-id': CONFIG.tenantId, 'SESSION-AFFINITY-KEY': CONFIG.boardId, language: settings.language === 'en' ? 'en_US' : 'zh_CN' };
        }
        async function post(path, body) {
            const response = await fetch(ENDPOINT + path, { method: 'POST', credentials: 'include', headers: headers(), body: JSON.stringify(body) });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const payload = await response.json();
            if (payload && (payload.status === 9999 || String(payload.errorCode) === '9999')) throw new Error(tr('登录状态已失效', 'Session has expired'));
            return payload;
        }
        function filters(year, month) {
            const definitions = [
                ['region_name_cn', [CONFIG.region]], ['rep_name_cn', [CONFIG.office]], ['operate_level', ['High', 'Fatal', 'Medium']],
                ['planstart_month_fm', [String(month).padStart(2, '0')]], ['planstart_year_fm', [String(year)]], ['customer_office_country', [CONFIG.country]]
            ];
            return definitions.map(item => ({ table: CONFIG.tableId, column: item[0], values: item[1], componentUrl: 'select/select', isControlled: false, clickType: 'self', rangeFilter: 0 }));
        }
        function totalsParams() {
            const names = ['业务比对日志回传完成量', '需回传操作量', '业务比对日志回传率', '备案量', '备案率'];
            PRODUCT_LINES.forEach(line => names.push(line.key + '_已回传', line.key + '_需回传', line.key + '_回传率'));
            const measures = names.map(name => ({ name, columnType: 'BYFORMULA' }));
            return { rows: [], columns: [{ dimensionColumns: [], measureColumns: measures }, { dimensionColumns: ['地区部'], measureColumns: measures }] };
        }
        function basePayload(componentId, year, month, chartType) {
            const component = { id: componentId, maskType: 'MASK', params: filters(year, month), maxRows: 1000, pageNum: 1, pageSize: chartType === 'table' ? 100 : 50, calStatistic: true, refreshCache: false, requestTime: Date.now(), componentId: chartType === 'table' ? 'component_e345fflwaa3r7k_qa' : 'component_674ad386lwa9ca1d_qa', chartType, calculateSumData: chartType !== 'table' };
            if (chartType !== 'table') { component.crossTableType = 'GRID'; component.totalsParams = totalsParams(); }
            return { srcTenantId: CONFIG.tenantId, boardId: CONFIG.boardId, behavior: 'VIEW', boardName: '', pageName: '17_CN_业务比对报告看板_CO', pageId: CONFIG.pageId, answerParamList: [component] };
        }
        function normalizeMonth(payload, year, month) {
            const rows = extractRows(payload); const summary = extractSummary(payload);
            const grossRequired = readMetric(summary, rows, ['需回传操作量'], false);
            const grossReturned = readMetric(summary, rows, ['业务比对日志回传完成量'], false);
            const recorded = readMetric(summary, rows, ['备案量'], false);
            const productLines = PRODUCT_LINES.map(line => {
                const total = readMetric(summary, rows, [line.key + '_需回传'], false); const done = readMetric(summary, rows, [line.key + '_已回传'], false);
                return { key: line.key, label: tr(line.labelZh, line.labelEn), required: total, returned: done, rate: readMetric(summary, rows, [line.key + '_回传率'], true) || (total ? done / total * 100 : 0), pending: Math.max(0, total - done) };
            });
            const ict = productLines.find(line => line.key === 'ICT') || { required: 0, returned: 0 }; const required = Math.max(0, grossRequired - (settings.excludeIct ? ict.required : 0)); const returned = Math.max(0, grossReturned - (settings.excludeIct ? ict.returned : 0));
            const returnRate = required ? returned / required * 100 : 0; const recordRate = required ? recorded / required * 100 : 0;
            return { year, month, label: String(month).padStart(2, '0'), required, returned, returnRate, pending: Math.max(0, required - returned), recorded, recordRate, grossRequired, grossReturned, excludedIctRequired: settings.excludeIct ? ict.required : 0, excludedIctReturned: settings.excludeIct ? ict.returned : 0, productLines, sourceRows: rows };
        }
        async function fetchMonthSummary(year, month) {
            const request = basePayload(CONFIG.summaryComponentId, year, month, 'crossTable');
            const answer = await post('getAnswers', request); let summaryPayload = answer;
            const aggFields = extractAggFields(answer); const component = request.answerParamList[0];
            const sumRequest = { id: CONFIG.summaryComponentId, srcTenantId: CONFIG.tenantId, behavior: 'VIEW', boardId: CONFIG.boardId, maxRows: 1000, pageNum: 1, pageSize: 50, calStatistic: true, params: component.params, chartType: 'table', answerSource: 2 };
            if (aggFields.length) sumRequest.aggFields = aggFields;
            try { summaryPayload = await post('getValueTableSumData', sumRequest); } catch (error) { console.warn('[DataFab Analysis] formula summary fallback:', error.message); }
            const normalized = normalizeMonth(summaryPayload, year, month);
            if (!normalized.required && !normalized.returned && !normalized.recorded) return normalizeMonth(answer, year, month);
            return normalized;
        }
        async function fetchDetail(year, month) {
            const request = basePayload(CONFIG.detailComponentId, year, month, 'table'); const component = request.answerParamList[0]; const rows = [];
            let previousPageSignature = '';
            for (let page = 1; page <= 5000; page++) {
                component.pageNum = page; component.requestTime = Date.now();
                const payload = await post('getAnswers', request); const pageRows = extractRows(payload);
                const pageSignature = pageRows.length ? pageRows.length + ':' + JSON.stringify(pageRows[0]) + ':' + JSON.stringify(pageRows[pageRows.length - 1]) : '';
                if (page > 1 && pageSignature && pageSignature === previousPageSignature) break;
                rows.push(...pageRows); previousPageSignature = pageSignature;
                if (pageRows.length < component.pageSize) break;
            }
            return rows;
        }
        function isPendingScoreStatus(value) {
            const compact = String(value || '').toLowerCase().replace(/[\s_\-\/（）()]/g, '');
            return compact === '待评分' || compact === 'pendingrating' || compact === 'pendingscore' || compact === 'awaitingrating';
        }
        function productLineMatches(value, line) {
            const compact = String(value || '').toLowerCase().replace(/[\s_\-\/&+（）()]/g, '');
            return [line.key, line.labelZh, line.labelEn].some(label => compact.includes(String(label).toLowerCase().replace(/[\s_\-\/&+（）()]/g, '')));
        }
        function applyDetailScope(summary, detailRows) {
            const rows = (detailRows || []).map(filingRow); if (!rows.length) return Object.assign(summary, { excludedPendingScore: 0, excludedPendingRecorded: 0, excludedIctRecorded: 0 });
            const ictRows = settings.excludeIct ? rows.filter(row => isExcludedIctLine(row.productLine)) : [];
            const pendingRows = settings.excludePendingScore ? rows.filter(row => (!settings.excludeIct || !isExcludedIctLine(row.productLine)) && isPendingScoreStatus(row.status)) : [];
            const hasReason = row => String(row.reason || '').trim() !== ''; const completed = row => /^(?:已完成|完成|completed|done)$/i.test(String(row.status || '').trim());
            const excludedIctRecorded = ictRows.filter(hasReason).length; const excludedPendingRecorded = pendingRows.filter(hasReason).length; const excludedPendingReturned = pendingRows.filter(completed).length;
            const required = Math.max(0, summary.required - pendingRows.length); const returned = Math.max(0, summary.returned - excludedPendingReturned); const recorded = Math.max(0, summary.recorded - excludedIctRecorded - excludedPendingRecorded);
            const productLines = summary.productLines.map(line => { const excluded = pendingRows.filter(row => productLineMatches(row.productLine, line)); const lineRequired = Math.max(0, line.required - excluded.length); const lineReturned = Math.max(0, line.returned - excluded.filter(completed).length); return Object.assign({}, line, { required: lineRequired, returned: lineReturned, pending: Math.max(0, lineRequired - lineReturned), rate: lineRequired ? lineReturned / lineRequired * 100 : 0 }); });
            return Object.assign({}, summary, { required, returned, recorded, returnRate: required ? returned / required * 100 : 0, recordRate: required ? recorded / required * 100 : 0, pending: Math.max(0, required - returned), productLines, excludedPendingScore: pendingRows.length, excludedPendingRecorded, excludedIctRecorded });
        }
        function deltaClass(good) { return good ? 'df-good' : 'df-bad'; }
        function kpi(label, value, meta, tone) { return '<article class="df-kpi ' + (tone || '') + '"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong><small>' + escapeHtml(meta || '') + '</small></article>'; }
        function lineChart(months, field, target, lowerIsBetter) {
            const width = 620; const height = 210; const left = 42; const right = 18; const top = 24; const bottom = 34; const maxY = 100; const points = months.map((item, index) => ({ x: left + (months.length === 1 ? 0 : index * (width - left - right) / (months.length - 1)), y: top + (maxY - Math.max(0, Math.min(maxY, item[field]))) / maxY * (height - top - bottom), value: item[field], label: item.label }));
            const targetY = top + (maxY - target) / maxY * (height - top - bottom); const path = points.map((point, index) => (index ? 'L' : 'M') + point.x.toFixed(1) + ' ' + point.y.toFixed(1)).join(' ');
            const grid = [0, 25, 50, 75, 100].map(value => { const y = top + (100 - value) / 100 * (height - top - bottom); return '<line x1="' + left + '" y1="' + y + '" x2="' + (width - right) + '" y2="' + y + '"/><text x="' + (left - 7) + '" y="' + (y + 3) + '" text-anchor="end">' + value + '%</text>'; }).join('');
            const marks = points.map(point => '<circle cx="' + point.x + '" cy="' + point.y + '" r="3.5"/><text class="df-chart-value" x="' + point.x + '" y="' + (point.y - 8) + '" text-anchor="middle">' + fmtRate(point.value) + '</text><text x="' + point.x + '" y="' + (height - 12) + '" text-anchor="middle">' + point.label + '</text>').join('');
            return '<svg class="df-chart-svg" viewBox="0 0 ' + width + ' ' + height + '" role="img"><g class="df-grid">' + grid + '</g><line class="df-target-line" x1="' + left + '" y1="' + targetY + '" x2="' + (width - right) + '" y2="' + targetY + '"/><text class="df-target-label" x="' + (width - right) + '" y="' + (targetY - 5) + '" text-anchor="end">' + escapeHtml(tr(lowerIsBetter ? '上限 ' : '目标 ', lowerIsBetter ? 'Limit ' : 'Target ') + fmtRate(target)) + '</text><path class="df-line" d="' + path + '"/><g class="df-marks">' + marks + '</g></svg>';
        }
        function volumeChart(months, field, secondaryField) {
            const width = 620; const height = 210; const left = 42; const right = 18; const top = 24; const bottom = 34; const maxValue = Math.max(1, ...months.map(item => Math.max(item[field] || 0, item[secondaryField] || 0))); const groupWidth = (width - left - right) / Math.max(1, months.length); const barWidth = Math.min(18, groupWidth * .28);
            const bars = months.map((item, index) => { const x = left + index * groupWidth + groupWidth / 2; const primaryHeight = (item[field] || 0) / maxValue * (height - top - bottom); const secondaryHeight = (item[secondaryField] || 0) / maxValue * (height - top - bottom); return '<rect class="df-bar-context" x="' + (x - barWidth - 1) + '" y="' + (height - bottom - secondaryHeight) + '" width="' + barWidth + '" height="' + secondaryHeight + '"/><rect class="df-bar-focus" x="' + (x + 1) + '" y="' + (height - bottom - primaryHeight) + '" width="' + barWidth + '" height="' + primaryHeight + '"/><text class="df-chart-value" x="' + (x + barWidth / 2 + 1) + '" y="' + Math.max(13, height - bottom - primaryHeight - 5) + '" text-anchor="middle">' + fmt(item[field]) + '</text><text x="' + x + '" y="' + (height - 12) + '" text-anchor="middle">' + item.label + '</text>'; }).join('');
            return '<svg class="df-chart-svg" viewBox="0 0 ' + width + ' ' + height + '" role="img"><line class="df-axis" x1="' + left + '" y1="' + (height - bottom) + '" x2="' + (width - right) + '" y2="' + (height - bottom) + '"/><g class="df-bars">' + bars + '</g></svg>';
        }
        function chartCard(title, subtitle, chart, legend) { return '<section class="df-card"><header><div><strong>' + escapeHtml(title) + '</strong><small>' + escapeHtml(subtitle) + '</small></div>' + (legend || '') + '</header><div class="df-chart">' + chart + '</div></section>'; }
        function summaryText(current, previous, topic) {
            const isReturn = topic === 'return'; const value = isReturn ? current.returnRate : current.recordRate; const prior = previous ? (isReturn ? previous.returnRate : previous.recordRate) : null; const target = isReturn ? settings.targets.returnRate : settings.targets.recordRate; const good = isReturn ? value >= target : value <= target; const movement = previous ? value - prior : 0;
            const ictNote = settings.excludeIct ? (settings.language === 'en' ? ' The scope excludes <b>' + fmt(current.excludedIctRequired) + '</b> ICT Services & Software operations.' : '口径已剔除 ICT服务与软件 <b>' + fmt(current.excludedIctRequired) + '</b> 笔。') : '';
            const pendingNote = settings.excludePendingScore ? (settings.language === 'en' ? ' It also excludes <b>' + fmt(current.excludedPendingScore) + '</b> pending-rating tasks.' : '同时剔除评分任务状态为“待评分”的 <b>' + fmt(current.excludedPendingScore) + '</b> 笔。') : '';
            const scopeNote = ictNote + pendingNote;
            if (settings.language === 'en') return (isReturn ? 'Log return' : 'Log filing') + ' is <b>' + fmtRate(value) + '</b> in ' + current.year + '-' + current.label + ', ' + (good ? 'within target' : 'outside target') + '. ' + (previous ? 'Month over month: <b>' + (movement >= 0 ? '+' : '') + fmt(movement, 1) + ' pp</b>. ' : '') + (isReturn ? '<b>' + fmt(current.pending) + '</b> operations remain.' : '<b>' + fmt(current.recorded) + '</b> filings were recorded.') + scopeNote;
            return current.year + '年' + current.label + '月' + (isReturn ? '日志回传率' : '日志回传备案率') + '为 <b>' + fmtRate(value) + '</b>，' + (good ? '符合目标要求' : '尚未满足目标要求') + '。' + (previous ? '环比 <b>' + (movement >= 0 ? '+' : '') + fmt(movement, 1) + ' 个百分点</b>；' : '') + (isReturn ? '仍有 <b>' + fmt(current.pending) + '</b> 笔操作待回传。' : '本月备案 <b>' + fmt(current.recorded) + '</b> 笔。') + scopeNote;
        }
        function productLineSection(current) {
            const lines = current.productLines.filter(item => (!settings.excludeIct || item.key !== 'ICT') && (item.required || item.returned)).sort((a, b) => a.rate - b.rate || b.required - a.required);
            if (!lines.length) return '<section class="df-card"><div class="df-empty">' + tr('当前响应未返回产品线公式数据', 'No product-line formula data in this response') + '</div></section>';
            const max = Math.max(1, ...lines.map(item => item.required));
            return '<section class="df-card"><header><div><strong>' + tr('产品线回传表现', 'Return Performance by Product Line') + '</strong><small>' + tr('按回传率升序，优先识别低完成率和大缺口', 'Lowest rate first to expose gaps') + '</small></div></header><div class="df-rank-list">' + lines.map(item => '<div class="df-rank"><span>' + escapeHtml(item.label) + '</span><div><i style="width:' + (item.required / max * 100) + '%"></i><em style="width:' + (item.returned / max * 100) + '%"></em></div><b class="' + deltaClass(item.rate >= settings.targets.returnRate) + '">' + fmtRate(item.rate) + '</b><small>' + fmt(item.returned) + '/' + fmt(item.required) + ' · ' + tr('缺口 ', 'Gap ') + fmt(item.pending) + '</small></div>').join('') + '</div></section>';
        }
        function rowField(row, aliases) {
            const keys = Object.keys(row || {}); const normalized = value => String(value || '').toLowerCase().replace(/[\s_\-\/()（）.]/g, ''); const aliasKeys = aliases.map(normalized);
            let key = aliasKeys.map(alias => keys.find(item => normalized(item) === alias)).find(Boolean);
            if (!key) key = aliasKeys.map(alias => keys.find(item => alias.length > 2 && normalized(item).includes(alias))).find(Boolean);
            return key ? smartValue(row[key], key) : '';
        }
        function filingRow(row) {
            return {
                taskNo: rowField(row, ['任务单号', '实施任务单号', '操作单号', '作业单号', 'task_id', 'task_no', 'task_number', 'ticket_id', 'operation_id', 'operation_no', 'operate_id']),
                bu: rowField(row, ['BU', 'bu_name', 'BU名称', '业务单元']),
                customer: rowField(row, ['客户名', 'network_name', 'top_cust_category_cn_name', 'lst_cust_class_cn_name']),
                family: rowField(row, ['产品族', '产品族名称', 'product_family', 'product_family_name', 'product_class']),
                product: rowField(row, ['产品', '产品名称', 'product', 'product_name']),
                productLine: rowField(row, ['产品线', '产品线名称', 'product_line', 'product_line_name']),
                operator: rowField(row, ['操作人', '操作人员', '处理人', 'operator', 'operator_name', 'handler', 'handler_name']),
                status: rowField(row, ['评分任务状态', '回传状态', 'task_status', 'status']),
                returnStatus: rowField(row, ['业务比对日志回传状态', '日志回传状态', '是否已回传', '是否回传', '回传状态', 'log_return_status', 'return_status', 'is_returned', 'returned_flag']),
                reason: rowField(row, ['备案原因', '备案原因说明', 'filing_reason', 'record_reason', 'recording_reason']),
                remark: rowField(row, ['备案备注', '备注', '备注说明', 'remark', 'remarks', 'note', 'notes'])
            };
        }
        function isExcludedIctLine(value) {
            const compact = String(value || '').toLowerCase().replace(/[\s_\-\/&+（）()]/g, '');
            return compact === 'ict' || compact.includes('ict服务与软件') || compact.includes('ictservicesandsoftware') || compact.includes('ictservicessoftware');
        }
        function isReturnedStatus(value) {
            if (typeof value === 'boolean') return value;
            if (typeof value === 'number') return value > 0;
            const compact = String(value == null ? '' : value).toLowerCase().replace(/[\s_\-\/&+（）()]/g, '');
            if (!compact || /^(?:0|否|no|false)$/.test(compact) || compact.includes('未回传') || compact.includes('待回传') || compact.includes('notreturned') || compact.includes('pendingreturn')) return false;
            return /^(?:1|是|yes|true)$/.test(compact) || compact.includes('已回传') || compact.includes('回传完成') || compact.includes('returned') || compact.includes('completed') || compact.includes('success');
        }
        function analyzeFilingRows(rows) {
            const dimensions = { bu: new Map(), customer: new Map(), family: new Map(), product: new Map() }; const reasons = new Map(); const operators = new Map(); const detail = [];
            const scopedRows = (rows || []).map(filingRow).filter(row => (!settings.excludeIct || !isExcludedIctLine(row.productLine)) && (!settings.excludePendingScore || !isPendingScoreStatus(row.status)));
            const hasExplicitReturnStatus = scopedRows.some(row => String(row.returnStatus == null ? '' : row.returnStatus).trim() !== '');
            scopedRows.forEach(row => {
                const hasReason = String(row.reason || '').trim() !== ''; const hasRemark = String(row.remark || '').trim() !== ''; detail.push(Object.assign({ hasReason, hasRemark }, row));
                Object.keys(dimensions).forEach(dimension => { const label = String(row[dimension] || tr('未标注', 'Unspecified')).trim(); const item = dimensions[dimension].get(label) || { label, total: 0, filed: 0, noted: 0 }; item.total++; if (hasReason) item.filed++; if (hasRemark) item.noted++; dimensions[dimension].set(label, item); });
                const operator = String(row.operator || tr('未标注', 'Unspecified')).trim(); const operatorItem = operators.get(operator) || { label: operator, count: 0, returned: 0, bus: new Map(), customers: new Map(), productLines: new Map() };
                if (hasReason || !hasExplicitReturnStatus || isReturnedStatus(row.returnStatus)) operatorItem.returned++;
                if (hasReason) {
                    const reason = String(row.reason).trim(); reasons.set(reason, (reasons.get(reason) || 0) + 1);
                    operatorItem.count++;
                    const bu = String(row.bu || tr('未标注', 'Unspecified')).trim(); const customer = String(row.customer || tr('未标注', 'Unspecified')).trim(); const productLine = String(row.productLine || tr('未标注', 'Unspecified')).trim(); operatorItem.bus.set(bu, (operatorItem.bus.get(bu) || 0) + 1); operatorItem.customers.set(customer, (operatorItem.customers.get(customer) || 0) + 1); operatorItem.productLines.set(productLine, (operatorItem.productLines.get(productLine) || 0) + 1);
                }
                operators.set(operator, operatorItem);
            });
            const ranked = map => Array.from(map.values()).map(item => Object.assign(item, { rate: item.total ? item.filed / item.total * 100 : 0, pending: item.total - item.filed })).sort((a, b) => b.filed - a.filed || b.total - a.total || a.label.localeCompare(b.label));
            const total = detail.length; const filed = detail.filter(row => row.hasReason).length; const noted = detail.filter(row => row.hasRemark).length;
            const rankedLabels = (map, limit) => { const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); return (limit ? entries.slice(0, limit) : entries).map(entry => entry[0]).join(' / '); };
            const operatorRanking = Array.from(operators.values()).filter(item => item.count > 0).map(item => ({ label: item.label, count: item.count, returned: item.returned, filingRate: item.returned ? item.count / item.returned * 100 : 0, share: filed ? item.count / filed * 100 : 0, bu: rankedLabels(item.bus, 3), customer: rankedLabels(item.customers, 3), productLine: rankedLabels(item.productLines) })).sort((a, b) => b.count - a.count || b.filingRate - a.filingRate || a.label.localeCompare(b.label));
            return { total, filed, noted, missing: total - filed, rate: total ? filed / total * 100 : 0, dimensions: { bu: ranked(dimensions.bu), customer: ranked(dimensions.customer), family: ranked(dimensions.family), product: ranked(dimensions.product) }, reasons: Array.from(reasons, entry => ({ label: entry[0], count: entry[1], share: filed ? entry[1] / filed * 100 : 0 })).sort((a, b) => b.count - a.count), operators: operatorRanking, detail };
        }
        function filingReminderSummary(insight, current) {
            const top = (insight.operators || []).slice(0, 3); const limit = settings.targets.recordRate; const period = current ? current.year + '-' + current.label : '';
            if (!top.length) return { risk: false, text: settings.language === 'en' ? period + ': no operator filing records with a filing reason; no frequent-filer reminder is required.' : period + '暂无已填写备案原因的操作人记录，无需发送高频备案提醒。' };
            const topCount = top.reduce((sum, item) => sum + item.count, 0); const topShare = insight.filed ? topCount / insight.filed * 100 : 0; const risks = top.filter(item => item.filingRate > limit);
            if (settings.language === 'en') {
                const ranking = top.map(item => item.label + ' ' + fmt(item.count) + ' (' + fmtRate(item.filingRate) + ')').join('; ');
                const scope = top.map(item => item.label + ' [BU: ' + item.bu + '; customer: ' + item.customer + '; product line: ' + item.productLine + ']').join('; ');
                const action = risks.length ? 'Priority reminder: ' + risks.map(item => item.label + ' is ' + fmt(item.filingRate - limit, 1) + ' pp above the ' + fmtRate(limit) + ' limit').join('; ') + '. Please review the filing reasons and reduce avoidable filings.' : 'All Top ' + top.length + ' personal filing rates are within the ' + fmtRate(limit) + ' limit; continue monitoring filing quality and trend.';
                return { risk: risks.length > 0, text: period + ' recorded ' + fmt(insight.filed) + ' filings. Top ' + top.length + ': ' + ranking + ', accounting for ' + fmtRate(topShare) + ' of all filings. Follow-up scope: ' + scope + '. ' + action };
            }
            const ranking = top.map(item => item.label + ' ' + fmt(item.count) + '笔（个人备案率' + fmtRate(item.filingRate) + '）').join('；');
            const scope = top.map(item => item.label + '【BU：' + item.bu + '；客户：' + item.customer + '；产品线：' + item.productLine + '】').join('；');
            const action = risks.length ? '需重点提醒：' + risks.map(item => item.label + '高于' + fmtRate(limit) + '备案上限' + fmt(item.filingRate - limit, 1) + '个百分点').join('；') + '，请优先复盘备案原因并减少可避免备案。' : 'Top ' + top.length + '人个人备案率均未超过' + fmtRate(limit) + '上限，请继续关注备案质量和趋势。';
            return { risk: risks.length > 0, text: period + '共备案' + fmt(insight.filed) + '笔，Top ' + top.length + '高频备案人员为：' + ranking + '，合计占全部备案' + fmtRate(topShare) + '。请重点跟进：' + scope + '。' + action };
        }
        function filingReminderBrief(rows, current) {
            const report = filingReminderSummary(analyzeFilingRows(rows), current);
            return '<section class="df-operator-brief ' + (report.risk ? 'risk' : '') + '"><div><strong>' + tr('高频备案人员提醒摘要', 'Frequent Filer Reminder') + '</strong><p class="df-operator-brief-text">' + escapeHtml(report.text) + '</p></div><button type="button" data-df-copy-brief>' + tr('复制摘要', 'Copy Summary') + '</button></section>';
        }
        function filingDimensionCard(title, items) {
            const visible = items.slice(0, 8); const max = Math.max(1, ...visible.map(item => item.filed)); return '<section class="df-card"><header><div><strong>' + escapeHtml(title) + '</strong><small>' + tr('按备案数量从高到低，显示前 8 项', 'Top 8 by filing count, highest first') + '</small></div></header><div class="df-insight-list">' + (visible.length ? visible.map(item => '<div class="df-insight-row"><span title="' + escapeHtml(item.label) + '">' + escapeHtml(item.label) + '</span><div><i style="width:' + (item.filed / max * 100) + '%"></i></div><b>' + fmt(item.filed) + '</b><small>' + tr('占比 ', 'Share ') + fmtRate(item.rate) + ' · ' + tr('基数 ', 'Base ') + fmt(item.total) + '</small></div>').join('') : '<div class="df-empty">' + tr('暂无可分析数据', 'No data to analyze') + '</div>') + '</div></section>';
        }
        function filingOperatorCard(items) {
            const visible = items.slice(0, 10); const max = Math.max(1, ...visible.map(item => item.count));
            return '<section class="df-card df-wide"><header><div><strong>' + tr('高频备案操作人', 'Frequent Filing Operators') + '</strong><small>' + tr('个人备案率 = 备案数量 ÷ 该操作人已回传数量；产品线按备案量降序合并展示', 'Personal filing rate = filings / returned operations; product lines are combined by filing volume') + '</small></div></header><div class="df-operator-list">' + (visible.length ? visible.map(item => '<div class="df-operator-row"><b title="' + escapeHtml(item.label) + '">' + escapeHtml(item.label) + '</b><span><em>BU</em>' + escapeHtml(item.bu) + '</span><span><em>' + tr('客户', 'Customer') + '</em>' + escapeHtml(item.customer) + '</span><span title="' + escapeHtml(item.productLine) + '"><em>' + tr('产品线', 'Product Line') + '</em>' + escapeHtml(item.productLine) + '</span><div><i style="width:' + (item.count / max * 100) + '%"></i></div><strong title="' + tr('备案数量 / 已回传数量', 'Filings / returned operations') + '">' + fmt(item.count) + ' / ' + fmt(item.returned) + '</strong><small class="df-operator-rate ' + (item.filingRate > settings.targets.recordRate ? 'bad' : 'good') + '" title="' + tr('占该操作人所有已回传数量的比例', 'Share of all returned operations by this operator') + '">' + tr('个人备案率 ', 'Personal filing rate ') + fmtRate(item.filingRate) + '</small></div>').join('') : '<div class="df-empty">' + tr('暂无可识别的备案操作人', 'No filing operators identified') + '</div>') + '</div></section>';
        }
        function filingInsightsSection(rows) {
            const insight = analyzeFilingRows(rows); const topBu = insight.dimensions.bu[0]; const topCustomer = insight.dimensions.customer[0]; const topOperator = insight.operators[0]; const reasonMax = Math.max(1, ...insight.reasons.map(item => item.count)); const explained = insight.detail.filter(row => row.hasReason || row.hasRemark);
            const summary = settings.language === 'en'
                ? 'Detail-based filing coverage is <b>' + fmtRate(insight.rate) + '</b> (' + fmt(insight.filed) + '/' + fmt(insight.total) + '), with <b>' + fmt(insight.missing) + '</b> rows missing a filing reason and <b>' + fmt(insight.noted) + '</b> containing notes.' + (topBu ? ' Highest filing volume BU: <b>' + escapeHtml(topBu.label) + '</b> (' + fmt(topBu.filed) + ').' : '') + (topCustomer ? ' Highest filing volume customer: <b>' + escapeHtml(topCustomer.label) + '</b> (' + fmt(topCustomer.filed) + ').' : '') + (topOperator ? ' Most frequent filing operator: <b>' + escapeHtml(topOperator.label) + '</b> (' + fmt(topOperator.count) + ').' : '')
                : '明细口径备案覆盖率为 <b>' + fmtRate(insight.rate) + '</b>（' + fmt(insight.filed) + '/' + fmt(insight.total) + '），其中 <b>' + fmt(insight.missing) + '</b> 条缺少备案原因，<b>' + fmt(insight.noted) + '</b> 条填写备注。' + (topBu ? '备案量最高 BU：<b>' + escapeHtml(topBu.label) + '</b>（' + fmt(topBu.filed) + ' 条）。' : '') + (topCustomer ? '备案量最高客户：<b>' + escapeHtml(topCustomer.label) + '</b>（' + fmt(topCustomer.filed) + ' 条）。' : '') + (topOperator ? '高频备案操作人为 <b>' + escapeHtml(topOperator.label) + '</b>（' + fmt(topOperator.count) + ' 条）。' : '');
            const reasonChart = '<section class="df-card"><header><div><strong>' + tr('备案原因分布', 'Filing Reason Distribution') + '</strong><small>' + tr('按原因数量排序，占比分母为已填备案原因数', 'Ranked by count; share is among rows with a reason') + '</small></div></header><div class="df-reason-list">' + (insight.reasons.length ? insight.reasons.slice(0, 10).map(item => '<div class="df-reason-row"><span title="' + escapeHtml(item.label) + '">' + escapeHtml(item.label) + '</span><div><i style="width:' + (item.count / reasonMax * 100) + '%"></i></div><b>' + fmt(item.count) + '</b><small>' + fmtRate(item.share) + '</small></div>').join('') : '<div class="df-empty">' + tr('暂无备案原因', 'No filing reasons') + '</div>') + '</div></section>';
            const detail = '<section class="df-card"><header><div><strong>' + tr('备案原因与备注明细', 'Filing Reasons & Notes') + '</strong><small>' + tr('聚焦有备案原因或备注的记录，用于跟进核查', 'Rows with a filing reason or note for operational follow-up') + '</small></div><span class="df-count">' + fmt(explained.length) + tr(' 条', ' rows') + '</span></header><div class="df-table-wrap df-filing-detail"><table><thead><tr><th>' + tr('任务单号', 'Task No.') + '</th><th>' + tr('操作人', 'Operator') + '</th><th>BU</th><th>' + tr('客户名', 'Customer') + '</th><th>' + tr('产品族', 'Product Family') + '</th><th>' + tr('产品', 'Product') + '</th><th>' + tr('产品线', 'Product Line') + '</th><th>' + tr('状态', 'Status') + '</th><th>' + tr('备案原因', 'Filing Reason') + '</th><th>' + tr('备注', 'Notes') + '</th></tr></thead><tbody>' + explained.map(row => '<tr><td>' + escapeHtml(row.taskNo) + '</td><td>' + escapeHtml(row.operator) + '</td><td>' + escapeHtml(row.bu) + '</td><td>' + escapeHtml(row.customer) + '</td><td>' + escapeHtml(row.family) + '</td><td>' + escapeHtml(row.product) + '</td><td>' + escapeHtml(row.productLine) + '</td><td>' + escapeHtml(row.status) + '</td><td class="df-wrap-cell">' + escapeHtml(row.reason) + '</td><td class="df-wrap-cell">' + escapeHtml(row.remark) + '</td></tr>').join('') + '</tbody></table></div></section>';
            return '<div class="df-summary">' + summary + '</div><div class="df-filing-grid">' + filingDimensionCard(tr('BU 备案覆盖', 'Filing Coverage by BU'), insight.dimensions.bu) + filingDimensionCard(tr('客户备案覆盖', 'Filing Coverage by Customer'), insight.dimensions.customer) + filingDimensionCard(tr('产品族备案覆盖', 'Filing Coverage by Product Family'), insight.dimensions.family) + filingDimensionCard(tr('产品备案覆盖', 'Filing Coverage by Product'), insight.dimensions.product) + reasonChart + filingOperatorCard(insight.operators) + '</div>' + detail;
        }
        function xlsxXml(value) { return String(value == null ? '' : value).slice(0, 32000).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]); }
        function xlsxColumn(index) { let name = ''; for (let value = index + 1; value; value = Math.floor((value - 1) / 26)) name = String.fromCharCode(65 + (value - 1) % 26) + name; return name; }
        function xlsxCell(spec, row, column) {
            const cell = spec && typeof spec === 'object' && Object.prototype.hasOwnProperty.call(spec, 'v') ? spec : { v: spec }; const ref = xlsxColumn(column) + row; const style = cell.s ? ' s="' + cell.s + '"' : '';
            if (typeof cell.v === 'number' && Number.isFinite(cell.v)) return '<c r="' + ref + '"' + style + '><v>' + cell.v + '</v></c>';
            return '<c r="' + ref + '" t="inlineStr"' + style + '><is><t xml:space="preserve">' + xlsxXml(cell.v) + '</t></is></c>';
        }
        function buildXlsxSheet(rows, options) {
            const columnCount = Math.max(1, ...rows.map(row => row.length)); const rowCount = Math.max(1, rows.length); const widths = options.widths || [];
            const columns = widths.map((width, index) => '<col min="' + (index + 1) + '" max="' + (index + 1) + '" width="' + width + '" customWidth="1"/>').join('');
            const sheetRows = rows.map((row, index) => '<row r="' + (index + 1) + '">' + row.map((cell, column) => xlsxCell(cell, index + 1, column)).join('') + '</row>').join('');
            const merges = (options.merges || []).length ? '<mergeCells count="' + options.merges.length + '">' + options.merges.map(ref => '<mergeCell ref="' + ref + '"/>').join('') + '</mergeCells>' : '';
            const views = options.freezeRows ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="' + options.freezeRows + '" topLeftCell="A' + (options.freezeRows + 1) + '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
            return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:' + xlsxColumn(columnCount - 1) + rowCount + '"/>' + views + '<sheetFormatPr defaultRowHeight="18"/>' + (columns ? '<cols>' + columns + '</cols>' : '') + '<sheetData>' + sheetRows + '</sheetData>' + (options.autoFilter ? '<autoFilter ref="' + options.autoFilter + '"/>' : '') + merges + '<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>';
        }
        function xlsxCrc32(bytes) { let crc = 0xffffffff; for (let index = 0; index < bytes.length; index++) { crc ^= bytes[index]; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; }
        function xlsxU16(value) { return new Uint8Array([value & 255, value >>> 8 & 255]); }
        function xlsxU32(value) { return new Uint8Array([value & 255, value >>> 8 & 255, value >>> 16 & 255, value >>> 24 & 255]); }
        function xlsxJoin(parts) { const size = parts.reduce((total, part) => total + part.length, 0); const output = new Uint8Array(size); let offset = 0; parts.forEach(part => { output.set(part, offset); offset += part.length; }); return output; }
        function createXlsxZip(files) {
            const encoder = new TextEncoder(); const localParts = []; const centralParts = []; let offset = 0;
            Object.entries(files).forEach(entry => { const name = encoder.encode(entry[0]); const data = encoder.encode(entry[1]); const crc = xlsxCrc32(data); const flags = 0x0800; const local = xlsxJoin([xlsxU32(0x04034b50), xlsxU16(20), xlsxU16(flags), xlsxU16(0), xlsxU16(0), xlsxU16(0), xlsxU32(crc), xlsxU32(data.length), xlsxU32(data.length), xlsxU16(name.length), xlsxU16(0), name, data]); const central = xlsxJoin([xlsxU32(0x02014b50), xlsxU16(20), xlsxU16(20), xlsxU16(flags), xlsxU16(0), xlsxU16(0), xlsxU16(0), xlsxU32(crc), xlsxU32(data.length), xlsxU32(data.length), xlsxU16(name.length), xlsxU16(0), xlsxU16(0), xlsxU16(0), xlsxU16(0), xlsxU32(0), xlsxU32(offset), name]); localParts.push(local); centralParts.push(central); offset += local.length; });
            const central = xlsxJoin(centralParts); return xlsxJoin(localParts.concat([central, xlsxJoin([xlsxU32(0x06054b50), xlsxU16(0), xlsxU16(0), xlsxU16(centralParts.length), xlsxU16(centralParts.length), xlsxU32(central.length), xlsxU32(offset), xlsxU16(0)])]));
        }
        function xlsxWidths(rows) {
            const count = Math.max(1, ...rows.map(row => row.length)); const widths = [];
            for (let column = 0; column < count; column++) { let max = 8; rows.slice(0, 1002).forEach(row => { const cell = row[column]; const value = cell && typeof cell === 'object' && Object.prototype.hasOwnProperty.call(cell, 'v') ? cell.v : cell; max = Math.max(max, String(value == null ? '' : value).length + 2); }); widths.push(Math.min(42, max)); }
            return widths;
        }
        function exportWorkbook() {
            if (!dashboardData) return; const cell = (v, s) => ({ v, s }); const months = dashboardData.months; const selected = months.find(item => item.month === settings.month) || months[months.length - 1];
            const scopeLabel = [settings.excludeIct ? tr('已剔除 ICT服务与软件', 'ICT Services & Software excluded') : tr('包含 ICT服务与软件', 'ICT Services & Software included'), settings.excludePendingScore ? tr('已剔除待评分任务', 'Pending-rating tasks excluded') : tr('包含待评分任务', 'Pending-rating tasks included')].join(' / ');
            const overview = [[cell(tr('DataFab 日志回传分析', 'DataFab Log Analysis'), 1)], [cell(tr('生成时间：', 'Generated: ') + new Date().toLocaleString(), 3)], [cell(tr('范围：', 'Scope: ') + CONFIG.region + ' / ' + CONFIG.office + ' / High·Fatal·Medium / ' + scopeLabel + ', ' + tr('回传目标 ≥ ', 'Return target ≥ ') + settings.targets.returnRate + '%, ' + tr('备案上限 ≤ ', 'Filing limit ≤ ') + settings.targets.recordRate + '%', 3)], [], [cell(tr('月份', 'Month'), 2), cell(tr('需回传操作量', 'Required'), 2), cell(tr('已回传', 'Returned'), 2), cell(tr('回传率', 'Return Rate'), 2), cell(tr('待回传', 'Pending'), 2), cell(tr('备案量', 'Filed'), 2), cell(tr('备案率', 'Filing Rate'), 2), cell(tr('剔除ICT需回传', 'Excluded ICT Required'), 2), cell(tr('剔除待评分数', 'Excluded Pending Rating'), 2)]];
            months.forEach(item => overview.push([item.year + '-' + item.label, item.required, item.returned, cell(item.returnRate / 100, 4), item.pending, item.recorded, cell(item.recordRate / 100, 4), item.excludedIctRequired, item.excludedPendingScore].map(value => value && value.v !== undefined ? value : cell(value, 3))));
            const productLines = [[cell(tr('产品线回传分析', 'Product Line Return Analysis'), 1)], [cell(selected.year + '-' + selected.label + ' · ' + tr('回传目标 ≥ ', 'Return target ≥ ') + settings.targets.returnRate + '%', 3)], [cell(tr('产品线', 'Product Line'), 2), cell(tr('需回传', 'Required'), 2), cell(tr('已回传', 'Returned'), 2), cell(tr('待回传', 'Pending'), 2), cell(tr('回传率', 'Return Rate'), 2)]];
            selected.productLines.filter(item => !settings.excludeIct || item.key !== 'ICT').forEach(item => productLines.push([cell(item.label, 3), cell(item.required, 3), cell(item.returned, 3), cell(item.pending, 3), cell(item.rate / 100, 4)]));
            const filing = analyzeFilingRows(dashboardData.detail); const filingRows = [[cell(tr('备案多维分析', 'Multidimensional Filing Analysis'), 1)], [cell(selected.year + '-' + selected.label + ' · ' + scopeLabel + ' · ' + tr('备案口径：备案原因非空；个人备案率=操作人备案数量/已回传数量', 'Filed means filing reason is populated; personal filing rate = operator filings / returned operations'), 3)], [cell(tr('分析维度', 'Dimension'), 2), cell(tr('维度值', 'Value'), 2), cell(tr('归属BU', 'Related BU'), 2), cell(tr('客户名', 'Customer'), 2), cell(tr('涉及产品线', 'Related Product Lines'), 2), cell(tr('基数', 'Base'), 2), cell(tr('备案数量', 'Filing Count'), 2), cell(tr('未备案', 'Missing'), 2), cell(tr('备案占比/覆盖率', 'Filing Share/Coverage'), 2), cell(tr('已回传数量', 'Returned Count'), 2), cell(tr('个人备案率', 'Personal Filing Rate'), 2), cell(tr('有备注', 'With Notes'), 2)]];
            [['BU', filing.dimensions.bu], [tr('客户', 'Customer'), filing.dimensions.customer], [tr('产品族', 'Product Family'), filing.dimensions.family], [tr('产品', 'Product'), filing.dimensions.product]].forEach(group => group[1].forEach(item => filingRows.push([cell(group[0], 3), cell(item.label, 3), cell('', 3), cell('', 3), cell('', 3), cell(item.total, 3), cell(item.filed, 3), cell(item.pending, 3), cell(item.rate / 100, 4), cell('', 3), cell('', 3), cell(item.noted, 3)])));
            filing.operators.forEach(item => filingRows.push([cell(tr('高频操作人', 'Frequent Operator'), 3), cell(item.label, 3), cell(item.bu, 3), cell(item.customer, 3), cell(item.productLine, 3), cell(filing.filed, 3), cell(item.count, 3), cell('', 3), cell(item.share / 100, 4), cell(item.returned, 3), cell(item.filingRate / 100, 4), cell('', 3)]));
            const filingDetail = [[cell(tr('备案原因与备注明细', 'Filing Reasons & Notes'), 1)], [cell(selected.year + '-' + selected.label + ' · ' + scopeLabel, 3)], [cell(tr('任务单号', 'Task No.'), 2), cell(tr('操作人', 'Operator'), 2), cell('BU', 2), cell(tr('客户名', 'Customer'), 2), cell(tr('产品族', 'Product Family'), 2), cell(tr('产品', 'Product'), 2), cell(tr('产品线', 'Product Line'), 2), cell(tr('状态', 'Status'), 2), cell(tr('备案原因', 'Filing Reason'), 2), cell(tr('备注', 'Notes'), 2)]];
            filing.detail.forEach(row => filingDetail.push([row.taskNo, row.operator, row.bu, row.customer, row.family, row.product, row.productLine, row.status, row.reason, row.remark].map(value => cell(value, 3))));
            const keys = detailColumns(dashboardData.detail); const raw = [[cell(tr('业务比对原始明细', 'Raw Operation Detail'), 1)], [cell(selected.year + '-' + selected.label + ' · ' + CONFIG.region + ' / ' + CONFIG.office + ' · ' + dashboardData.detail.length + tr(' 条', ' rows'), 3)], keys.map(key => cell(key, 2))];
            dashboardData.detail.forEach(row => raw.push(keys.map(key => { const value = smartValue(row[key], key); return cell(value, 3); })));
            const sheets = [{ name: tr('专题概览', 'Overview'), rows: overview, headerRow: 5 }, { name: tr('产品线分析', 'Product Lines'), rows: productLines, headerRow: 3 }, { name: tr('备案多维分析', 'Filing Analysis'), rows: filingRows, headerRow: 3 }, { name: tr('备案原因备注', 'Filing Reasons'), rows: filingDetail, headerRow: 3 }, { name: tr('原始明细', 'Raw Detail'), rows: raw, headerRow: 3 }];
            const styleRelId = sheets.length + 1; const files = { '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((sheet, index) => '<Override PartName="/xl/worksheets/sheet' + (index + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>', '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>', 'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map((sheet, index) => '<sheet name="' + xlsxXml(sheet.name) + '" sheetId="' + (index + 1) + '" r:id="rId' + (index + 1) + '"/>').join('') + '</sheets></workbook>', 'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((sheet, index) => '<Relationship Id="rId' + (index + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (index + 1) + '.xml"/>').join('') + '<Relationship Id="rId' + styleRelId + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>', 'xl/styles.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="10"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="16"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Arial"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1D4ED8"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFD1D5DB"/></left><right style="thin"><color rgb="FFD1D5DB"/></right><top style="thin"><color rgb="FFD1D5DB"/></top><bottom style="thin"><color rgb="FFD1D5DB"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="10" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' };
            sheets.forEach((sheet, index) => { const lastColumn = xlsxColumn(Math.max(0, Math.max(...sheet.rows.map(row => row.length)) - 1)); files['xl/worksheets/sheet' + (index + 1) + '.xml'] = buildXlsxSheet(sheet.rows, { widths: xlsxWidths(sheet.rows), merges: ['A1:' + lastColumn + '1', 'A2:' + lastColumn + '2'], freezeRows: sheet.headerRow, autoFilter: 'A' + sheet.headerRow + ':' + lastColumn + sheet.rows.length }); });
            const blob = new Blob([createXlsxZip(files)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = (settings.language === 'en' ? 'DataFab_Log_Analysis_' : 'DataFab日志回传分析_') + settings.year + String(settings.month).padStart(2, '0') + '.xlsx'; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1200);
        }
        function detailColumns(rows) {
            const preferred = ['BU', '客户名', 'network_name', 'top_cust_category_cn_name', 'lst_cust_class_cn_name', '客户群', '操作人', '产品线', 'product_line_name', '产品族', 'product_family_name', '产品', 'product_name', '备案原因', '备案备注', '备注', '评分任务状态', '操作级别', 'operate_level', '计划开始时间']; const keys = [];
            preferred.forEach(key => { if (rows.some(row => Object.prototype.hasOwnProperty.call(row, key)) && !keys.includes(key)) keys.push(key); });
            rows.forEach(row => Object.keys(row || {}).forEach(key => { if (!keys.includes(key)) keys.push(key); }));
            return keys;
        }
        function detailTable(rows) {
            if (!rows.length) return '<section class="df-card"><div class="df-empty">' + tr('所选月份暂无明细', 'No detail rows for selected month') + '</div></section>';
            const keys = detailColumns(rows); const pageCount = Math.max(1, Math.ceil(rows.length / detailPageSize)); detailPage = Math.min(pageCount, Math.max(1, detailPage)); const start = (detailPage - 1) * detailPageSize; const pageRows = rows.slice(start, start + detailPageSize);
            return '<section class="df-card"><header><div><strong>' + tr('当月业务比对原始明细', 'Monthly Raw Operation Detail') + '</strong><small>' + tr('全部 ', 'All ') + keys.length + tr(' 列 · 自动分页展示全部数据 · 原始明细仍保留 ICT和待评分记录', ' columns · all rows paginated · raw ICT and pending-rating rows retained') + '</small></div><span class="df-count">' + fmt(rows.length) + tr(' 条', ' rows') + '</span></header><div class="df-table-wrap"><table><thead><tr>' + keys.map(key => '<th>' + escapeHtml(key) + '</th>').join('') + '</tr></thead><tbody>' + pageRows.map(row => '<tr>' + keys.map(key => '<td title="' + escapeHtml(smartValue(row[key], key)) + '">' + escapeHtml(smartValue(row[key], key)) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div><div class="df-pager"><span>' + tr('每页', 'Rows') + ' <select data-df-page-size><option value="25"' + (detailPageSize === 25 ? ' selected' : '') + '>25</option><option value="50"' + (detailPageSize === 50 ? ' selected' : '') + '>50</option><option value="100"' + (detailPageSize === 100 ? ' selected' : '') + '>100</option></select></span><button data-df-page="prev"' + (detailPage <= 1 ? ' disabled' : '') + '>' + tr('上一页', 'Previous') + '</button><b>' + detailPage + ' / ' + pageCount + '</b><button data-df-page="next"' + (detailPage >= pageCount ? ' disabled' : '') + '>' + tr('下一页', 'Next') + '</button><span>' + tr('当前 ', 'Showing ') + (start + 1) + '–' + Math.min(rows.length, start + detailPageSize) + ' / ' + rows.length + '</span></div></section>';
        }
        function renderDashboard() {
            if (!dashboardData) return;
            const months = dashboardData.months; const current = months.find(item => item.month === settings.month) || months[months.length - 1]; const currentIndex = months.indexOf(current); const previous = currentIndex > 0 ? months[currentIndex - 1] : null; const isReturn = activeTopic === 'return'; const target = isReturn ? settings.targets.returnRate : settings.targets.recordRate; const value = isReturn ? current.returnRate : current.recordRate; const good = isReturn ? value >= target : value <= target; const movement = previous ? value - (isReturn ? previous.returnRate : previous.recordRate) : null;
            const cards = isReturn
                ? kpi(tr('日志回传率', 'Log Return Rate'), fmtRate(current.returnRate), tr('目标 ≥ ', 'Target ≥ ') + fmtRate(target), good ? 'good' : 'bad') + kpi(tr('需回传操作量', 'Required Operations'), fmt(current.required), current.year + '-' + current.label) + kpi(tr('已回传', 'Returned'), fmt(current.returned), tr('完成量', 'Completed')) + kpi(tr('待回传缺口', 'Pending Gap'), fmt(current.pending), previous ? tr('环比 ', 'MoM ') + (movement >= 0 ? '+' : '') + fmt(movement, 1) + ' pp' : '')
                : kpi(tr('日志备案率', 'Log Filing Rate'), fmtRate(current.recordRate), tr('上限 ≤ ', 'Limit ≤ ') + fmtRate(target), good ? 'good' : 'bad') + kpi(tr('备案量', 'Filed Operations'), fmt(current.recorded), current.year + '-' + current.label) + kpi(tr('需回传操作量', 'Required Operations'), fmt(current.required), tr('备案率分母', 'Filing-rate denominator')) + kpi(tr('距上限', 'Distance to Limit'), (value - target >= 0 ? '+' : '') + fmt(value - target, 1) + ' pp', value <= target ? tr('低于上限', 'Below limit') : tr('超过上限', 'Above limit'), good ? 'good' : 'bad');
            const rateField = isReturn ? 'returnRate' : 'recordRate'; const volumeField = isReturn ? 'returned' : 'recorded';
            content.innerHTML = '<div class="df-summary ' + (good ? 'good' : 'bad') + '">' + summaryText(current, previous, activeTopic) + '</div><div class="df-kpis">' + cards + '</div><div class="df-chart-grid">' + chartCard(isReturn ? tr('月度回传率', 'Monthly Return Rate') : tr('月度备案率', 'Monthly Filing Rate'), settings.year + tr(' 年 · 百分比与目标线', ' · rate and target'), lineChart(months, rateField, target, !isReturn)) + chartCard(isReturn ? tr('月度回传量 / 需回传量', 'Returned / Required by Month') : tr('月度备案量 / 需回传量', 'Filed / Required by Month'), tr('实心为专题数量，浅色为需回传总量', 'Solid is topic volume; open is required total'), volumeChart(months, volumeField, 'required'), '<span class="df-legend"><i></i>' + (isReturn ? tr('已回传', 'Returned') : tr('备案量', 'Filed')) + '<i class="context"></i>' + tr('需回传', 'Required') + '</span>') + '</div>' + (isReturn ? productLineSection(current) : '<section class="df-card"><header><div><strong>' + tr('回传与备案关系', 'Return and Filing Relationship') + '</strong><small>' + tr('同一需回传操作量口径下的月度对照', 'Monthly comparison on the same required-operation base') + '</small></div></header><div class="df-table-wrap"><table><thead><tr><th>' + tr('月份', 'Month') + '</th><th>' + tr('需回传', 'Required') + '</th><th>' + tr('已回传', 'Returned') + '</th><th>' + tr('回传率', 'Return Rate') + '</th><th>' + tr('备案量', 'Filed') + '</th><th>' + tr('备案率', 'Filing Rate') + '</th></tr></thead><tbody>' + months.map(item => '<tr><td>' + item.year + '-' + item.label + '</td><td>' + fmt(item.required) + '</td><td>' + fmt(item.returned) + '</td><td>' + fmtRate(item.returnRate) + '</td><td>' + fmt(item.recorded) + '</td><td>' + fmtRate(item.recordRate) + '</td></tr>').join('') + '</tbody></table></div></section>') + (!isReturn ? filingInsightsSection(dashboardData.detail) : '') + detailTable(dashboardData.detail);
            if (!isReturn) {
                const chartGrid = content.querySelector('.df-chart-grid'); if (chartGrid) chartGrid.insertAdjacentHTML('beforebegin', filingReminderBrief(dashboardData.detail, current));
                const copyBrief = content.querySelector('[data-df-copy-brief]'); if (copyBrief) copyBrief.addEventListener('click', async event => {
                    const text = content.querySelector('.df-operator-brief-text').textContent.trim(); const control = event.currentTarget;
                    try {
                        if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
                        else { const textarea = document.createElement('textarea'); textarea.value = text; textarea.style.position = 'fixed'; textarea.style.opacity = '0'; document.body.appendChild(textarea); textarea.select(); document.execCommand('copy'); textarea.remove(); }
                        control.textContent = tr('已复制', 'Copied'); setTimeout(() => { if (control.isConnected) control.textContent = tr('复制摘要', 'Copy Summary'); }, 1400);
                    } catch (error) { control.textContent = tr('请手动复制', 'Copy manually'); }
                });
            }
            content.querySelectorAll('[data-df-page]').forEach(control => control.addEventListener('click', event => { detailPage += event.currentTarget.dataset.dfPage === 'next' ? 1 : -1; renderDashboard(); }));
            const pageSizeControl = content.querySelector('[data-df-page-size]'); if (pageSizeControl) pageSizeControl.addEventListener('change', event => { detailPageSize = Number(event.target.value) || 50; detailPage = 1; renderDashboard(); });
        }
        async function loadDashboard() {
            if (loading) return; loading = true; const token = ++loadToken; refresh.disabled = true; exportButton.disabled = true; yearSelect.disabled = true; monthSelect.disabled = true; scopeControl.disabled = true; pendingControl.disabled = true; content.innerHTML = '<div class="df-loading">' + tr('正在获取各月公式汇总与明细，并校正剔除口径…', 'Loading monthly summaries and detail to reconcile exclusion scope…') + '</div>';
            try {
                const now = new Date(); const lastMonth = settings.year === now.getFullYear() ? now.getMonth() + 1 : 12; const months = []; let detail = [];
                if (settings.month > lastMonth) { settings.month = lastMonth; monthSelect.value = String(lastMonth); }
                for (let month = 1; month <= lastMonth; month++) {
                    if (destroyed || token !== loadToken) return;
                    status.textContent = tr('正在获取并校正月度汇总与明细 ', 'Loading and reconciling monthly summary and detail ') + settings.year + '-' + String(month).padStart(2, '0') + ' (' + month + '/' + lastMonth + ')';
                    try { const result = await Promise.all([fetchMonthSummary(settings.year, month), fetchDetail(settings.year, month)]); months.push(applyDetailScope(result[0], result[1])); if (month === settings.month) detail = result[1]; }
                    catch (error) { throw new Error(settings.year + '-' + String(month).padStart(2, '0') + ' · ' + (error.message || error)); }
                }
                if (destroyed || token !== loadToken) return;
                dashboardData = { months, detail }; detailPage = 1; status.textContent = tr('范围：', 'Scope: ') + CONFIG.region + ' / ' + CONFIG.office + ' / High·Fatal·Medium · ' + (settings.excludeIct ? tr('已剔除 ICT服务与软件', 'ICT Services & Software excluded') + ' · ' : '') + (settings.excludePendingScore ? tr('已剔除待评分任务', 'Pending-rating tasks excluded') + ' · ' : '') + tr('更新于 ', 'Updated ') + new Date().toLocaleString(); renderDashboard(); saveSettings();
            } catch (error) {
                content.innerHTML = '<div class="df-error">' + tr('专题获取失败：', 'Failed to load insights: ') + escapeHtml(error.message || error) + '<br>' + tr('请确认 DataFab 登录状态后重试。', 'Confirm your DataFab session and retry.') + '</div>'; status.textContent = tr('获取失败', 'Load failed');
            } finally { loading = false; refresh.disabled = false; exportButton.disabled = !dashboardData; yearSelect.disabled = false; monthSelect.disabled = false; scopeControl.disabled = false; pendingControl.disabled = false; }
        }

        const style = document.createElement('style');
        style.textContent = '.body.df-active{display:flex;flex-direction:column;overflow:hidden}.df-mode{display:none;min-height:0;flex:1;flex-direction:column;margin-top:11px;border:1px solid rgba(96,165,250,.25);border-radius:11px;overflow:hidden;background:#07111f}.df-mode.active{display:flex}.df-head-button{width:auto!important;padding:0 9px!important;font-size:10px!important}.df-head-button.active{border-color:#60a5fa!important;background:#1d4ed8!important;color:#fff!important}.df-toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-bottom:1px solid rgba(148,163,184,.16);background:#0f172a}.df-tabs,.df-actions{display:flex;align-items:center;gap:5px;flex-wrap:wrap}.df-tab,.df-control{height:28px;padding:0 9px;border:1px solid rgba(148,163,184,.28);border-radius:7px;background:#1e293b;color:#cbd5e1;font-size:9px;font-weight:800;cursor:pointer}.df-tab.active{border-color:#60a5fa;background:#1d4ed8;color:#fff}.df-control:disabled{opacity:.5}.df-export{border-color:rgba(74,222,128,.45);background:#166534;color:#dcfce7}.df-actions select,.df-actions input[type=number]{height:28px;border:1px solid rgba(148,163,184,.28);border-radius:7px;background:#111827;color:#e2e8f0;font-size:9px}.df-actions input[type=number]{width:54px;padding:0 5px;text-align:right}.df-scope-toggle{display:flex;align-items:center;gap:4px;height:28px;padding:0 7px;border:1px solid rgba(251,191,36,.3);border-radius:7px;background:rgba(120,53,15,.2);color:#fde68a;font-size:8px;white-space:nowrap}.df-scope-toggle input{accent-color:#f59e0b}.df-status{padding:6px 10px;border-bottom:1px solid rgba(148,163,184,.12);color:#64748b;font-size:8px}.df-content{min-height:0;flex:1;overflow:auto;padding:10px}.df-summary{margin-bottom:9px;padding:10px 12px;border-left:3px solid #60a5fa;border-radius:7px;background:rgba(30,64,175,.14);color:#cbd5e1;font-size:9px;line-height:1.65}.df-summary b{color:#dbeafe}.df-summary.good{border-left-color:#22c55e}.df-summary.bad{border-left-color:#f59e0b}.df-kpis{display:grid;grid-template-columns:repeat(4,minmax(110px,1fr));gap:7px;margin-bottom:9px}.df-kpi{min-height:76px;padding:9px;border:1px solid rgba(148,163,184,.18);border-radius:9px;background:#111827}.df-kpi span,.df-kpi small{display:block;color:#94a3b8;font-size:8px}.df-kpi strong{display:block;margin:6px 0 3px;color:#f8fafc;font-size:18px}.df-kpi.good strong,.df-good{color:#86efac!important}.df-kpi.bad strong,.df-bad{color:#fbbf24!important}.df-chart-grid,.df-filing-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.df-wide{grid-column:1/-1}.df-card{margin-bottom:9px;border:1px solid rgba(148,163,184,.18);border-radius:9px;overflow:hidden;background:#0f172a}.df-card>header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px;border-bottom:1px solid rgba(148,163,184,.14)}.df-card header strong,.df-card header small{display:block}.df-card header strong{color:#e2e8f0;font-size:10px}.df-card header small{margin-top:2px;color:#64748b;font-size:7px}.df-chart{padding:4px 7px}.df-chart-svg{display:block;width:100%;height:auto;max-height:225px}.df-chart-svg text{fill:#64748b;font:7px Arial,sans-serif}.df-grid line{stroke:rgba(148,163,184,.14)}.df-axis{stroke:#475569}.df-line{fill:none;stroke:#60a5fa;stroke-width:2.3}.df-marks circle{fill:#0f172a;stroke:#93c5fd;stroke-width:2}.df-chart-svg .df-chart-value{fill:#cbd5e1;font-weight:700}.df-target-line{stroke:#f59e0b;stroke-width:1.2;stroke-dasharray:5 4}.df-chart-svg .df-target-label{fill:#fbbf24;font-weight:700}.df-bar-context{fill:#334155;stroke:#64748b}.df-bar-focus{fill:#3b82f6}.df-legend{display:flex;align-items:center;gap:4px;color:#94a3b8;font-size:7px}.df-legend i{width:8px;height:8px;background:#3b82f6}.df-legend i.context{margin-left:5px;background:#334155;border:1px solid #64748b}.df-rank-list{padding:5px 10px 9px}.df-rank{display:grid;grid-template-columns:110px minmax(100px,1fr) 55px 130px;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(148,163,184,.1);color:#cbd5e1;font-size:8px}.df-rank>div{position:relative;height:9px;border-radius:5px;background:#1e293b;overflow:hidden}.df-rank i,.df-rank em{position:absolute;inset:0 auto 0 0}.df-rank i{background:#334155}.df-rank em{background:#3b82f6}.df-rank small{color:#64748b}.df-insight-list,.df-reason-list,.df-operator-list{padding:5px 10px 9px}.df-insight-row,.df-reason-row{display:grid;grid-template-columns:minmax(75px,120px) minmax(70px,1fr) 45px 100px;align-items:center;gap:7px;padding:6px 0;border-bottom:1px solid rgba(148,163,184,.1);color:#cbd5e1;font-size:8px}.df-reason-row{grid-template-columns:minmax(100px,1.5fr) minmax(70px,1fr) 35px 42px}.df-insight-row>span,.df-reason-row>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.df-insight-row>div,.df-reason-row>div{height:8px;border-radius:5px;background:#1e293b;overflow:hidden}.df-insight-row i,.df-reason-row i{display:block;height:100%;background:#3b82f6}.df-reason-row i{background:#f59e0b}.df-insight-row small,.df-reason-row small{color:#64748b}.df-operator-row{display:grid;grid-template-columns:minmax(90px,130px) minmax(100px,1fr) minmax(130px,1.4fr) minmax(80px,1fr) 35px 42px;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid rgba(148,163,184,.1);color:#cbd5e1;font-size:8px}.df-operator-row>b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e2e8f0}.df-operator-row>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.df-operator-row em{margin-right:5px;color:#64748b;font-style:normal}.df-operator-row>div{height:8px;border-radius:5px;background:#1e293b;overflow:hidden}.df-operator-row i{display:block;height:100%;background:#8b5cf6}.df-operator-row small{color:#94a3b8}.df-table-wrap{max-height:440px;overflow:auto;scrollbar-gutter:stable}.df-table-wrap table{width:max-content;min-width:100%;border-collapse:collapse;font-size:8px}.df-table-wrap th,.df-table-wrap td{max-width:320px;padding:6px 7px;border-right:1px solid rgba(148,163,184,.12);border-bottom:1px solid rgba(148,163,184,.12);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center}.df-table-wrap th{position:sticky;top:0;z-index:2;background:#172033;color:#bae6fd}.df-table-wrap td{color:#cbd5e1}.df-table-wrap .df-wrap-cell{min-width:180px;max-width:360px;white-space:normal;text-align:left;line-height:1.45}.df-filing-detail{max-height:520px}.df-count{color:#60a5fa;font-size:8px}.df-pager{display:flex;align-items:center;justify-content:flex-end;gap:7px;padding:8px 10px;color:#64748b;font-size:8px}.df-pager button,.df-pager select{height:25px;border:1px solid rgba(148,163,184,.25);border-radius:6px;background:#1e293b;color:#cbd5e1;font-size:8px}.df-pager button{padding:0 8px;cursor:pointer}.df-pager button:disabled{opacity:.4;cursor:not-allowed}.df-pager select{padding:0 4px}.df-pager b{color:#cbd5e1}.df-loading,.df-error,.df-empty{padding:38px 12px;text-align:center;color:#94a3b8;font-size:10px}.df-error{color:#fca5a5}@media(max-width:850px){.df-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.df-chart-grid,.df-filing-grid{grid-template-columns:1fr}.df-toolbar{align-items:flex-start;flex-direction:column}.df-rank{grid-template-columns:80px minmax(80px,1fr) 48px}.df-rank small{grid-column:2/-1}.df-insight-row{grid-template-columns:75px minmax(60px,1fr) 42px}.df-insight-row small{grid-column:2/-1}.df-operator-row{grid-template-columns:80px 1fr 35px 42px}.df-operator-row>span{grid-column:2/-1}.df-pager{justify-content:flex-start;flex-wrap:wrap}}';
        style.textContent += '.df-operator-row{grid-template-columns:minmax(90px,130px) minmax(90px,.8fr) minmax(120px,1.15fr) minmax(120px,1.15fr) minmax(65px,.7fr) 58px 112px}.df-operator-row>strong{text-align:center;color:#e2e8f0}.df-operator-rate{padding:4px 6px;border-radius:6px;text-align:center;font-weight:800;white-space:nowrap}.df-operator-rate.good{color:#86efac;background:rgba(22,101,52,.25)}.df-operator-rate.bad{color:#fecaca;background:rgba(153,27,27,.38);box-shadow:inset 0 0 0 1px rgba(248,113,113,.35)}@media(max-width:850px){.df-operator-row{grid-template-columns:80px 1fr 58px 112px}}';
        style.textContent += '.df-operator-brief{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:9px;padding:11px 12px;border:1px solid rgba(59,130,246,.3);border-left:3px solid #3b82f6;border-radius:9px;background:linear-gradient(135deg,rgba(30,64,175,.18),rgba(15,23,42,.88))}.df-operator-brief.risk{border-color:rgba(248,113,113,.34);border-left-color:#ef4444;background:linear-gradient(135deg,rgba(127,29,29,.2),rgba(15,23,42,.9))}.df-operator-brief>div{min-width:0}.df-operator-brief strong{color:#dbeafe;font-size:10px}.df-operator-brief.risk strong{color:#fecaca}.df-operator-brief p{margin:5px 0 0;color:#cbd5e1;font-size:9px;line-height:1.7}.df-operator-brief button{flex:0 0 auto;padding:5px 9px;border:1px solid rgba(96,165,250,.4);border-radius:6px;background:#1e3a8a;color:#dbeafe;font-size:8px;font-weight:800;cursor:pointer}.df-operator-brief.risk button{border-color:rgba(248,113,113,.45);background:#7f1d1d;color:#fee2e2}@media(max-width:850px){.df-operator-brief{flex-direction:column}.df-operator-brief button{align-self:flex-end}}';
        root.appendChild(style);
        const headActions = root.querySelector('.head-actions'); const body = root.querySelector('.body'); const notice = root.querySelector('.notice'); const captureStatus = root.querySelector('.status'); const captureActions = root.querySelector('.actions'); const results = root.querySelector('.results');
        const button = document.createElement('button'); button.className = 'fullscreen df-head-button'; button.type = 'button'; button.textContent = tr('DataFab 专题', 'DataFab Insights'); headActions.insertBefore(button, headActions.firstChild);
        const mode = document.createElement('section'); mode.className = 'df-mode';
        mode.innerHTML = '<div class="df-toolbar"><div class="df-tabs"><button class="df-tab active" data-df-topic="return">' + tr('日志回传', 'Log Return') + '</button><button class="df-tab" data-df-topic="record">' + tr('日志回传备案', 'Log Filing') + '</button></div><div class="df-actions"><select class="df-year" title="' + tr('分析年份', 'Analysis year') + '"></select><select class="df-month" title="' + tr('明细月份', 'Detail month') + '"></select><label class="df-scope-toggle" title="' + tr('默认从需回传、已回传和备案分析口径中剔除', 'Excluded from required, returned and filing-analysis scope by default') + '"><input class="df-exclude-ict" type="checkbox"' + (settings.excludeIct ? ' checked' : '') + '><span class="df-scope-label">' + tr('剔除 ICT服务与软件', 'Exclude ICT Services & Software') + '</span></label><label class="df-scope-toggle" title="' + tr('默认从所有汇总、趋势和备案分析中剔除', 'Excluded from all totals, trends and filing analysis by default') + '"><input class="df-exclude-pending" type="checkbox"' + (settings.excludePendingScore ? ' checked' : '') + '><span class="df-pending-label">' + tr('剔除待评分', 'Exclude Pending Rating') + '</span></label><label><span class="df-return-target-label">' + tr('回传目标', 'Return target') + '</span> <input class="df-target" data-target="returnRate" type="number" min="0" max="100" step="0.1" value="' + settings.targets.returnRate + '">%</label><label><span class="df-record-target-label">' + tr('备案上限', 'Filing limit') + '</span> <input class="df-target" data-target="recordRate" type="number" min="0" max="100" step="0.1" value="' + settings.targets.recordRate + '">%</label><button class="df-control df-language">' + (settings.language === 'en' ? '中' : 'EN') + '</button><button class="df-control df-export" disabled>' + tr('导出 Excel', 'Export Excel') + '</button><button class="df-control df-refresh">' + tr('刷新专题', 'Refresh') + '</button></div></div><div class="df-status">' + tr('专题尚未加载', 'Insights not loaded') + '</div><div class="df-content"><div class="df-empty">' + tr('进入专题后自动获取数据', 'Data loads when insights open') + '</div></div>';
        body.appendChild(mode);
        const content = mode.querySelector('.df-content'); const status = mode.querySelector('.df-status'); const refresh = mode.querySelector('.df-refresh'); const exportButton = mode.querySelector('.df-export'); const yearSelect = mode.querySelector('.df-year'); const monthSelect = mode.querySelector('.df-month'); const scopeControl = mode.querySelector('.df-exclude-ict'); const pendingControl = mode.querySelector('.df-exclude-pending');
        const thisYear = new Date().getFullYear(); for (let year = thisYear; year >= thisYear - 3; year--) yearSelect.insertAdjacentHTML('beforeend', '<option value="' + year + '">' + year + '</option>'); yearSelect.value = String(settings.year);
        for (let month = 1; month <= 12; month++) monthSelect.insertAdjacentHTML('beforeend', '<option value="' + month + '">' + tr(month + '月', new Date(2000, month - 1, 1).toLocaleString('en', { month: 'short' })) + '</option>'); monthSelect.value = String(settings.month);
        function setMode(next) {
            active = next; button.classList.toggle('active', active); body.classList.toggle('df-active', active); mode.classList.toggle('active', active); button.textContent = active ? tr('返回 CSV', 'Back to CSV') : tr('DataFab 专题', 'DataFab Insights');
            [notice, captureStatus, captureActions, results].forEach(element => { if (!element) return; if (active) { element.dataset.dfDisplay = element.style.display || ''; element.style.display = 'none'; } else { element.style.display = element.dataset.dfDisplay || ''; delete element.dataset.dfDisplay; } });
            if (active && !dashboardData && !loading) loadDashboard();
        }
        button.addEventListener('click', () => { if (!active && options && typeof options.isCaptureActive === 'function' && options.isCaptureActive()) { status.textContent = tr('CSV 正在抓取，请稍后再进入专题。', 'CSV capture is running. Try again later.'); return; } setMode(!active); });
        mode.querySelectorAll('[data-df-topic]').forEach(tab => tab.addEventListener('click', event => { activeTopic = event.currentTarget.dataset.dfTopic; mode.querySelectorAll('[data-df-topic]').forEach(item => item.classList.toggle('active', item === event.currentTarget)); renderDashboard(); }));
        yearSelect.addEventListener('change', () => { settings.year = Number(yearSelect.value); dashboardData = null; saveSettings(); loadDashboard(); });
        monthSelect.addEventListener('change', () => { settings.month = Number(monthSelect.value); dashboardData = null; saveSettings(); loadDashboard(); });
        scopeControl.addEventListener('change', () => { settings.excludeIct = scopeControl.checked; dashboardData = null; saveSettings(); loadDashboard(); });
        pendingControl.addEventListener('change', () => { settings.excludePendingScore = pendingControl.checked; dashboardData = null; saveSettings(); loadDashboard(); });
        mode.querySelectorAll('.df-target').forEach(input => input.addEventListener('change', event => { settings.targets[event.target.dataset.target] = Math.max(0, Math.min(100, num(event.target.value))); saveSettings(); renderDashboard(); }));
        mode.querySelector('.df-language').addEventListener('click', event => {
            settings.language = settings.language === 'en' ? 'zh' : 'en'; saveSettings();
            event.currentTarget.textContent = settings.language === 'en' ? '中' : 'EN'; refresh.textContent = tr('刷新专题', 'Refresh'); exportButton.textContent = tr('导出 Excel', 'Export Excel');
            mode.querySelector('[data-df-topic="return"]').textContent = tr('日志回传', 'Log Return'); mode.querySelector('[data-df-topic="record"]').textContent = tr('日志回传备案', 'Log Filing');
            mode.querySelector('.df-return-target-label').textContent = tr('回传目标', 'Return target'); mode.querySelector('.df-record-target-label').textContent = tr('备案上限', 'Filing limit');
            mode.querySelector('.df-scope-label').textContent = tr('剔除 ICT服务与软件', 'Exclude ICT Services & Software');
            mode.querySelector('.df-pending-label').textContent = tr('剔除待评分', 'Exclude Pending Rating');
            [...monthSelect.options].forEach((option, index) => { option.textContent = tr((index + 1) + '月', new Date(2000, index, 1).toLocaleString('en', { month: 'short' })); });
            button.textContent = active ? tr('返回 CSV', 'Back to CSV') : tr('DataFab 专题', 'DataFab Insights'); renderDashboard();
        });
        exportButton.addEventListener('click', exportWorkbook);
        refresh.addEventListener('click', () => { dashboardData = null; loadDashboard(); });
        return { showCsv: function () { if (active) setMode(false); }, isLoading: function () { return loading; }, destroy: function () { destroyed = true; loadToken++; style.remove(); mode.remove(); button.remove(); } };
    }

    window.UIVDataFabAnalysis = {
        getRuntimeSource() { return `(${installDataFabAnalysisRuntime.toString()})`; }
    };
})();
