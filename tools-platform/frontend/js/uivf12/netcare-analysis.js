/**
 * uivf12/netcare-analysis.js
 * 生成可嵌入 F12 浮窗的 NetCare 专题分析运行时。
 * 运行时通过 Function#toString 内联到复制脚本，不依赖目标站点加载本文件。
 */
(function () {
    'use strict';

    function installNetCareAnalysisRuntime(root, options) {
        if (!root || window.location.hostname !== 'netcare.huawei.com') return null;

        const CONFIG = {
            officeCode: '026921', regionCode: '026902', certificateYear: '2026',
            productIncorporationYear: '2025', pageSize: 100,
            cnbgCustomers: ['Telecom Egypt', 'Orange Egypt for Telecommunications', 'Etisalat Misr', 'Vodafone Egypt'],
            customerAliases: { 'NILE ON LINE (NOL)': 'Etisalat Misr' },
            targets: { product: 30, version: 80 }
        };
        const API_URLS = {
            certificate: 'https://netcare.huawei.com/adc-service/web/rest/v1/services/NetCareOperationCenter/cs_nc_operation_center_extend/op_ex_digital_certificate_l3_grid_get_list',
            eos: 'https://netcare.huawei.com/adc-service/web/rest/v1/services/NetCareOperationCenter/cs_nc_operation_center_extend/op_ex_eos_detail_get_list',
            change: 'https://netcare.huawei.com/adc-service/web/rest/v1/services/NetCareOperationCenter/cs_nc_operation_center_extend/op_ex_change_summary',
            highRiskInterception: 'https://netcare.huawei.com/adc-service/web/rest/v1/services/NetCareOperationCenter/cs_nc_operation_center_extend/op_ex_change_highrisk_commands_charts_statistics'
        };
        const SOURCE_PAGE = {
            certificate: '/NetCareOperationCenter/cs_nc_operation_center_extend/op_ex_digital_certificate_l3_grid',
            eos: '/NetCareOperationCenter/cs_nc_operation_center_extend/op_ex_eos_detail_grid'
        };
        const CERT_BODY = {
            version: CONFIG.certificateYear, metric: 'need_reduce_cnt', subnet_code: '', branch_code: '', resolution_name: '', incident_level: '',
            bg: 'CNBG,EBG', t1_operator: '', na_type: '', sr_type: '', end_date: '', start_date: '', network_id: '', office_code: CONFIG.officeCode,
            region_code: CONFIG.regionCode, product_line: '', country_code: '', network: '', customer_number: '', category_name: '', is_evolution: '',
            top_level: '', reduction_scenario: '2', risk_status: '', duetime_year: '', disposal_methods: '', task_id: '', snapshot_time: '',
            group_by: 'region_code,repoffice_code,bg'
        };
        const EOS_COMMON = {
            additional_flag: '', eos_year_flag: '', start: 0, limit: CONFIG.pageSize, bg: 'CNBG,EBG', region_code: CONFIG.regionCode,
            office_code: CONFIG.officeCode, country_code: '', network_id: '', customer_number: '', t1_operator: '', branch_code: '', subnet_code: '',
            product_line: '', product_area_code: '', product_family_code: '', product_code: '', na_type: '', risk_top_level: '', current_phase: '',
            contingency_plan_id: '', incorporation_type: '', annual_baseline: '', eos_year: '', delay_year_month: '', snapshot_time: '', kpi_type: ''
        };
        const PRODUCT_BODY = Object.assign({}, EOS_COMMON, {
            bordType: 'new_urgency_eos', data_type: 'urgency_eos', metric: 'before_urgent_incorporation_completion_rate',
            exclusion_recordal: 'after', incorporation_year: CONFIG.productIncorporationYear
        });
        const VERSION_BODY = Object.assign({}, EOS_COMMON, {
            bordType: '', data_type: 'high_risk_eos', metric: 'nc_urgent_incorporation_completion_rate', exclusion_recordal: '', incorporation_year: ''
        });

        const style = document.createElement('style');
        style.textContent = `
            .body.nc-active{display:flex;flex-direction:column;overflow:hidden}.nc-mode{display:none;min-height:0;flex:1;flex-direction:column;margin-top:11px;border:1px solid rgba(148,163,184,.2);border-radius:11px;overflow:hidden;background:rgba(2,6,23,.5)}
            .nc-mode.active{display:flex}.nc-head-button{width:auto!important;padding:0 9px!important;font-size:10px!important}.nc-head-button.active{border-color:#67e8f9!important;color:#fff!important;background:#0e7490!important}
            .nc-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 10px;border-bottom:1px solid rgba(148,163,184,.17);background:rgba(15,23,42,.85)}
            .nc-tabs{display:flex;gap:5px;overflow-x:auto}.nc-tab,.nc-refresh{flex:0 0 auto;padding:6px 9px;border:1px solid rgba(148,163,184,.25);border-radius:7px;background:#1e293b;color:#cbd5e1;font-size:9px;font-weight:800;cursor:pointer}.nc-tab.active{border-color:#67e8f9;background:#0e7490;color:#fff}.nc-refresh{border-color:rgba(74,222,128,.4);color:#bbf7d0}.nc-refresh:disabled{opacity:.5;cursor:not-allowed}
            .nc-status{padding:7px 10px;border-bottom:1px solid rgba(148,163,184,.12);color:#94a3b8;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nc-content{min-height:0;flex:1;overflow:auto;padding:10px}.nc-view{display:none}.nc-view.active{display:block}
            .nc-card{margin-bottom:10px;border:1px solid rgba(148,163,184,.2);border-radius:9px;overflow:hidden;background:rgba(15,23,42,.74)}.nc-card-title{display:flex;justify-content:space-between;gap:10px;padding:9px 10px;border-bottom:1px solid rgba(148,163,184,.16);color:#f8fafc;font-size:11px;font-weight:850}.nc-card-title small{color:#94a3b8;font-size:8px;font-weight:500}.nc-table-wrap{overflow:auto}.nc-table{width:max-content;min-width:100%;border-collapse:collapse;font-size:9px}.nc-table th,.nc-table td{padding:6px 7px;border-right:1px solid rgba(148,163,184,.13);border-bottom:1px solid rgba(148,163,184,.13);white-space:nowrap;text-align:center}.nc-table th{position:sticky;top:0;background:#172033;color:#bae6fd}.nc-table td{color:#cbd5e1}.nc-table .nc-name{text-align:left;font-weight:800}.nc-table .nc-child{padding-left:22px;color:#94a3b8;font-weight:500}.nc-table .nc-total td{background:rgba(14,116,144,.2);font-weight:850}.nc-table .nc-bg td{background:rgba(30,41,59,.75);font-weight:800}.nc-good{color:#86efac!important;font-weight:850}.nc-bad{color:#fca5a5!important;font-weight:850}.nc-muted{color:#64748b!important}.nc-target{color:#7dd3fc}.nc-note{padding:8px 10px;color:#64748b;font-size:8px;line-height:1.55}.nc-loading,.nc-error,.nc-empty{padding:36px 12px;text-align:center;color:#94a3b8;font-size:10px}.nc-error{color:#fca5a5}.nc-option{display:flex;align-items:center;gap:7px;margin-bottom:9px;padding:8px 10px;border:1px solid rgba(148,163,184,.2);border-radius:8px;background:rgba(15,23,42,.7);color:#cbd5e1;font-size:9px}.nc-option input{accent-color:#06b6d4}
        `;
        root.appendChild(style);

        const headActions = root.querySelector('.head-actions');
        const body = root.querySelector('.body');
        const notice = root.querySelector('.notice');
        const status = root.querySelector('.status');
        const actions = root.querySelector('.actions');
        const results = root.querySelector('.results');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'fullscreen nc-head-button';
        button.textContent = 'NetCare 专题';
        button.title = '打开 NetCare 专题分析';
        headActions.insertBefore(button, headActions.firstChild);

        const mode = document.createElement('section');
        mode.className = 'nc-mode';
        mode.innerHTML = `
            <div class="nc-toolbar">
                <div class="nc-tabs">
                    <button class="nc-tab active" data-view="eos">EOS 收编</button>
                    <button class="nc-tab" data-view="cert">证书清理</button>
                    <button class="nc-tab" data-view="change">变更数量</button>
                    <button class="nc-tab" data-view="interception">高危拦截</button>
                </div>
                <button class="nc-refresh" type="button">刷新专题</button>
            </div>
            <div class="nc-status">专题尚未加载</div>
            <div class="nc-content">
                <section class="nc-view active" data-view-panel="eos"><div class="nc-empty">进入专题后点击“刷新专题”获取数据</div></section>
                <section class="nc-view" data-view-panel="cert"></section>
                <section class="nc-view" data-view-panel="change"></section>
                <section class="nc-view" data-view-panel="interception"></section>
            </div>`;
        body.appendChild(mode);
        const refreshButton = mode.querySelector('.nc-refresh');
        const modeStatus = mode.querySelector('.nc-status');
        const views = {};
        mode.querySelectorAll('[data-view-panel]').forEach(view => { views[view.dataset.viewPanel] = view; });
        let active = false;
        let loaded = false;
        let loading = false;
        let destroyed = false;
        let interceptionDistinguishBG = false;

        function setMode(nextActive) {
            active = nextActive;
            button.classList.toggle('active', active);
            body.classList.toggle('nc-active', active);
            button.textContent = active ? '返回 CSV' : 'NetCare 专题';
            mode.classList.toggle('active', active);
            [notice, status, actions, results].forEach(element => {
                if (!element) return;
                if (active) { element.dataset.ncPreviousDisplay = element.style.display || ''; element.style.display = 'none'; }
                else { element.style.display = element.dataset.ncPreviousDisplay || ''; delete element.dataset.ncPreviousDisplay; }
            });
            if (active && !loaded && !loading) loadDashboard();
        }
        button.addEventListener('click', function () {
            if (!active && options && typeof options.isCaptureActive === 'function' && options.isCaptureActive()) {
                modeStatus.textContent = 'CSV 正在抓取，请完成后再进入 NetCare 专题。';
                return;
            }
            setMode(!active);
        });
        mode.querySelectorAll('.nc-tab').forEach(tab => {
            tab.addEventListener('click', function () {
                mode.querySelectorAll('.nc-tab').forEach(item => item.classList.toggle('active', item === tab));
                Object.keys(views).forEach(key => views[key].classList.toggle('active', key === tab.dataset.view));
            });
        });

        function escapeHtml(value) {
            return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
        }
        function num(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
        function firstNumber(row, fields) {
            for (const field of fields) {
                if (row[field] !== null && row[field] !== undefined && row[field] !== '') {
                    const parsed = Number(row[field]);
                    if (Number.isFinite(parsed)) return parsed;
                }
            }
            return 0;
        }
        function normalizeCustomer(value) { const name = String(value || '未知').trim(); return CONFIG.customerAliases[name] || name; }
        function customerBG(value) { return CONFIG.cnbgCustomers.includes(normalizeCustomer(value)) ? 'CNBG' : 'EBG'; }
        function pad2(value) { return String(value).padStart(2, '0'); }
        function findCsrfToken() {
            for (const storage of [localStorage, sessionStorage]) {
                for (const key of ['csrfToken', 'csrf-token', 'x-gde-csrf-token', 'X-GDE-CSRF-TOKEN']) {
                    const value = storage.getItem(key);
                    if (value && !/[{[]/.test(value)) return value.replace(/^"|"$/g, '');
                }
                for (let index = 0; index < storage.length; index++) {
                    const value = storage.getItem(storage.key(index));
                    if (!value) continue;
                    const match = value.match(/"csrfToken"\s*:\s*"([^"]+)"/i);
                    if (match) return match[1];
                    try {
                        const stack = [JSON.parse(value)];
                        while (stack.length) {
                            const item = stack.pop();
                            if (!item || typeof item !== 'object') continue;
                            if (item.csrfToken) return item.csrfToken;
                            stack.push(...(Array.isArray(item) ? item : Object.values(item)));
                        }
                    } catch (error) {}
                }
            }
            const meta = document.querySelector('meta[name="csrf-token"],meta[name="x-gde-csrf-token"]');
            return meta && meta.content || '';
        }
        async function postJson(url, sourcePage, payload, token, simpleHeaders) {
            const headers = { accept: 'application/json, text/plain, */*', 'content-type': 'application/json;charset=UTF-8', 'x-gde-csrf-token': token };
            if (simpleHeaders) headers['x-requested-with'] = 'XMLHttpRequest';
            else { headers['x-gde-src-page'] = sourcePage; headers['x-gde-target-app'] = 'NetCareOperationCenter'; }
            const response = await fetch(url, { method: 'POST', credentials: 'include', headers, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error('HTTP ' + response.status + ' ' + response.statusText);
            const json = await response.json();
            if (json.code && String(json.code) !== '0' && String(json.code) !== '200') throw new Error(json.message || '接口错误：' + json.code);
            return json;
        }
        async function loadAllPages(name, url, sourcePage, payload, token) {
            const limit = num(payload.limit) || CONFIG.pageSize;
            const first = await postJson(url, sourcePage, Object.assign({}, payload, { start: 0, limit }), token, false);
            const rows = [...(first.results || [])];
            const total = num(first.total);
            for (let start = limit; start < total; start += limit) {
                modeStatus.textContent = name + '：正在加载 ' + Math.min(rows.length, total) + '/' + total;
                const page = await postJson(url, sourcePage, Object.assign({}, payload, { start, limit }), token, false);
                rows.push(...(page.results || []));
            }
            return rows;
        }
        function monthRange(year, month) {
            const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
            return { start: year + '-' + pad2(month) + '-01', end: year + '-' + pad2(month) + '-' + pad2(last) };
        }
        async function postChangeSummary(year, month, scope, token) {
            const range = monthRange(year, month);
            const raw = await postJson(API_URLS.change, '', {
                bg: scope === 'TOTAL' ? [] : [scope], region: '', rep_office: '', product_line: [], network_id: [], bu: [], t1_operator: [],
                na_type: [], network_level: '', operate_level: [], wo_type: [], region_code: [CONFIG.regionCode], office_code: [CONFIG.officeCode],
                start_date: range.start, end_date: range.end, country_code: [], key_ne: []
            }, token, true);
            const data = raw.data || raw.result || raw;
            return { year, month, scope, task_count: num(data.task_count), rollback_count: num(data.rollback_count), operation_success_rate: num(data.operation_success_rate), high_core_total_count: num(data.high_core_total_count) };
        }
        async function runConcurrent(items, limit, worker) {
            const output = new Array(items.length); let next = 0;
            async function runner() { while (true) { const index = next++; if (index >= items.length) return; output[index] = await worker(items[index], index); } }
            await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner));
            return output;
        }
        async function loadChangeData(token) {
            const now = new Date(); const currentYear = now.getFullYear(); const previousYear = currentYear - 1; const jobs = [];
            for (const year of [previousYear, currentYear]) for (let month = 1; month <= 12; month++) for (const scope of ['TOTAL', 'CNBG', 'EBG']) jobs.push({ year, month, scope });
            let completed = 0;
            const rows = await runConcurrent(jobs, 6, async job => { const row = await postChangeSummary(job.year, job.month, job.scope, token); modeStatus.textContent = '变更数量：' + (++completed) + '/' + jobs.length; return row; });
            return { rows, currentYear, previousYear, currentMonth: now.getMonth() + 1 };
        }
        async function postInterception(year, scope, token) {
            const raw = await postJson(API_URLS.highRiskInterception, '', {
                bg: scope === 'TOTAL' ? [] : [scope], region_code: [CONFIG.regionCode], office_code: [CONFIG.officeCode], product_line: [],
                start_date: year + '-01-01', end_date: year + '-12-31', source_map: [], account: '', regionTotal: 1, group_by: 'period_month', kpi_type: 'interception'
            }, token, true);
            return (raw.results || raw.data && raw.data.results || []).map(row => ({
                year, scope, month: num(String(row.period_month || row.name || '').split('-')[1]),
                interception_cnt: num(row.interception_cnt), commands_interception_cnt: num(row.commands_interception_cnt), graphical_interception_cnt: num(row.graphical_interception_cnt)
            })).filter(row => row.month >= 1 && row.month <= 12);
        }
        async function loadInterceptionData(token) {
            const now = new Date(); const currentYear = now.getFullYear(); const previousYear = currentYear - 1; const jobs = [];
            for (const year of [previousYear, currentYear]) for (const scope of ['TOTAL', 'CNBG', 'EBG']) jobs.push({ year, scope });
            const groups = await Promise.all(jobs.map(job => postInterception(job.year, job.scope, token)));
            return { rows: groups.flat(), currentYear, previousYear, currentMonth: now.getMonth() + 1 };
        }
        function formatChange(current, base) {
            const delta = current - base; const sign = delta > 0 ? '+' : '';
            const rate = base ? ' (' + sign + ((delta / base) * 100).toFixed(1) + '%)' : (current ? ' (新增)' : ' (0%)');
            return sign + delta.toLocaleString('zh-CN') + rate;
        }
        function createEosBucket() { return { product: { quantity: 0, incorporated: 0, pending: 0, noPlan: 0 }, version: { quantity: 0, incorporated: 0, pending: 0 } }; }
        function eosIncorporated(row, type, quantity) {
            const normal = type === 'product' ? firstNumber(row, ['before_urgent_incorporated_nes_dtl', 'incorporated_nes']) : firstNumber(row, ['nc_urgent_incorp_complet_rate_dtl', 'incorporated_nes']);
            const total = normal + firstNumber(row, ['deactivated_nes']);
            return quantity > 0 ? Math.min(quantity, total) : total;
        }
        function addEos(bucket, row, type) {
            const target = bucket[type]; const quantity = firstNumber(row, ['incorporation_total_nes', 'annual_storage', 'capacities', 'current_inventory']);
            target.quantity += quantity; target.incorporated += eosIncorporated(row, type, quantity); target.pending += firstNumber(row, ['to_be_incorporated_nes']);
            if (type === 'product') target.noPlan += firstNumber(row, ['plan_to_be_developed_nes', 'planing_conting_plan_nes', 'planing_contingency_plan_nes']);
        }
        function buildEos(productRows, versionRows) {
            const data = { CNBG: createEosBucket(), EBG: createEosBucket(), TOTAL: createEosBucket(), customers: {} };
            CONFIG.cnbgCustomers.forEach(name => { data.customers[name] = createEosBucket(); });
            function consume(rows, type) { rows.forEach(row => { const customer = normalizeCustomer(row.customer_name); const bg = customerBG(customer); addEos(data.TOTAL, row, type); addEos(data[bg], row, type); if (bg === 'CNBG') { if (!data.customers[customer]) data.customers[customer] = createEosBucket(); addEos(data.customers[customer], row, type); } }); }
            consume(productRows, 'product'); consume(versionRows, 'version'); return data;
        }
        function eosRow(name, bucket, kind) {
            function rateCell(metric, target) { const value = metric.quantity ? metric.incorporated / metric.quantity * 100 : 0; return '<td class="' + (metric.quantity ? (value >= target ? 'nc-good' : 'nc-bad') : 'nc-muted') + '">' + (metric.quantity ? value.toFixed(0) + '%' : '-') + '</td>'; }
            return '<tr class="' + (kind === 'total' ? 'nc-total' : kind === 'bg' ? 'nc-bg' : '') + '"><td class="nc-name ' + (kind === 'child' ? 'nc-child' : '') + '">' + (kind === 'child' ? '└ ' : '') + escapeHtml(name) + '</td><td>' + bucket.product.quantity + '</td>' + rateCell(bucket.product, CONFIG.targets.product) + '<td>' + bucket.product.pending + '</td><td>' + bucket.product.noPlan + '</td><td>' + bucket.version.quantity + '</td>' + rateCell(bucket.version, CONFIG.targets.version) + '<td>' + bucket.version.pending + '</td></tr>';
        }
        function renderEos(productRows, versionRows) {
            const summary = buildEos(productRows, versionRows);
            const children = CONFIG.cnbgCustomers.filter(name => { const item = summary.customers[name]; return item.product.quantity || item.version.quantity || item.product.pending || item.version.pending; }).map(name => eosRow(name, summary.customers[name], 'child')).join('');
            const details = function (rows, type) { return rows.map(row => { const quantity = firstNumber(row, ['incorporation_total_nes', 'annual_storage', 'capacities', 'current_inventory']); const kind = type === '产品' ? 'product' : 'version'; return '<tr><td>' + type + '</td><td>' + escapeHtml(normalizeCustomer(row.customer_name)) + '</td><td>' + customerBG(row.customer_name) + '</td><td>' + escapeHtml(row.product_line_name || row.product_line_map || '') + '</td><td>' + escapeHtml(row.product_name || '') + '</td><td>' + escapeHtml(row.software_version || '') + '</td><td>' + quantity + '</td><td>' + eosIncorporated(row, kind, quantity) + '</td><td>' + num(row.to_be_incorporated_nes) + '</td><td>' + escapeHtml(row.current_phase_name || row.current_phase || '') + '</td></tr>'; }).join(''); };
            views.eos.innerHTML = '<div class="nc-card"><div class="nc-card-title"><span>EOS 产品及版本收编进展</span><small>产品 ' + productRows.length + ' · 版本 ' + versionRows.length + '</small></div><div class="nc-table-wrap"><table class="nc-table"><thead><tr><th rowspan="2">客户 / BG</th><th colspan="4">产品 <span class="nc-target">目标' + CONFIG.targets.product + '%</span></th><th colspan="3">版本 <span class="nc-target">目标' + CONFIG.targets.version + '%</span></th></tr><tr><th>数量</th><th>收编率</th><th>待收编</th><th>无计划</th><th>数量</th><th>收编率</th><th>待收编</th></tr></thead><tbody>' + eosRow('CNBG', summary.CNBG, 'bg') + children + eosRow('EBG', summary.EBG, 'bg') + eosRow('TOTAL', summary.TOTAL, 'total') + '</tbody></table></div><div class="nc-note">CNBG 展开四个运营商客户，其余归入 EBG；已退网网元计入已收编。</div></div><div class="nc-card"><div class="nc-card-title"><span>EOS 明细</span><small>' + (productRows.length + versionRows.length) + ' 条</small></div><div class="nc-table-wrap"><table class="nc-table"><thead><tr><th>类型</th><th>客户</th><th>BG</th><th>产品线</th><th>产品</th><th>版本</th><th>数量</th><th>已收编</th><th>待收编</th><th>阶段</th></tr></thead><tbody>' + details(productRows, '产品') + details(versionRows, '版本') + '</tbody></table></div></div>';
        }
        function certBucket() { return { total: 0, reduced: 0, products: {} }; }
        function renderCertificate(rows) {
            const products = new Set(); const summary = { CNBG: certBucket(), EBG: certBucket(), TOTAL: certBucket(), customers: {} };
            CONFIG.cnbgCustomers.forEach(name => { summary.customers[name] = certBucket(); });
            function add(bucket, row) { const product = row.product_line_map_name || row.product_line_name || '其他'; const total = num(row.need_reduce_cnt); products.add(product); bucket.products[product] = (bucket.products[product] || 0) + total; bucket.total += total; bucket.reduced += num(row.reduced_cnt); }
            rows.forEach(row => { const customer = normalizeCustomer(row.customer_name); const bg = customerBG(customer); add(summary.TOTAL, row); add(summary[bg], row); if (bg === 'CNBG') { if (!summary.customers[customer]) summary.customers[customer] = certBucket(); add(summary.customers[customer], row); } });
            const productList = [...products].sort((a, b) => a.localeCompare(b, 'zh-CN'));
            function rowHtml(name, bucket, kind) { const pct = bucket.total ? bucket.reduced / bucket.total * 100 : 0; return '<tr class="' + (kind === 'total' ? 'nc-total' : kind === 'bg' ? 'nc-bg' : '') + '"><td class="nc-name ' + (kind === 'child' ? 'nc-child' : '') + '">' + (kind === 'child' ? '└ ' : '') + escapeHtml(name) + '</td>' + productList.map(product => '<td>' + (bucket.products[product] || 0) + '</td>').join('') + '<td>' + bucket.total + '</td><td>' + bucket.reduced + '</td><td class="' + (bucket.total ? 'nc-good' : 'nc-muted') + '">' + (bucket.total ? pct.toFixed(0) + '%' : '-') + '</td></tr>'; }
            const children = CONFIG.cnbgCustomers.filter(name => summary.customers[name].total).map(name => rowHtml(name, summary.customers[name], 'child')).join('');
            const details = rows.map(row => '<tr><td>' + escapeHtml(normalizeCustomer(row.customer_name)) + '</td><td>' + customerBG(row.customer_name) + '</td><td>' + escapeHtml(row.product_line_map_name || row.product_line_name || '') + '</td><td>' + escapeHtml(row.product_name || '') + '</td><td>' + escapeHtml(row.task_id || '') + '</td><td>' + num(row.need_reduce_cnt) + '</td><td>' + num(row.reduced_cnt) + '</td></tr>').join('');
            views.cert.innerHTML = '<div class="nc-card"><div class="nc-card-title"><span>' + CONFIG.certificateYear + '年证书风险网元清理进展</span><small>' + rows.length + ' 条</small></div><div class="nc-table-wrap"><table class="nc-table"><thead><tr><th>客户 / BG</th>' + productList.map(product => '<th>' + escapeHtml(product) + '</th>').join('') + '<th>总量</th><th>已消减</th><th>完成率</th></tr></thead><tbody>' + rowHtml('CNBG', summary.CNBG, 'bg') + children + rowHtml('EBG', summary.EBG, 'bg') + rowHtml('TOTAL', summary.TOTAL, 'total') + '</tbody></table></div></div><div class="nc-card"><div class="nc-card-title"><span>证书明细</span><small>' + rows.length + ' 条</small></div><div class="nc-table-wrap"><table class="nc-table"><thead><tr><th>客户</th><th>BG</th><th>产品线</th><th>产品</th><th>Task</th><th>需消减</th><th>已消减</th></tr></thead><tbody>' + details + '</tbody></table></div></div>';
        }
        function renderChange(data) {
            const map = new Map(data.rows.map(row => [row.scope + '|' + row.year + '|' + row.month, row]));
            const scopes = [{ key: 'TOTAL', name: '总体' }, { key: 'CNBG', name: 'CNBG（运营商）' }, { key: 'EBG', name: 'EBG' }];
            const value = (scope, year, month) => num((map.get(scope + '|' + year + '|' + month) || {}).task_count);
            const sum = (scope, year, months) => months.reduce((total, month) => total + value(scope, year, month), 0);
            const ytd = Array.from({ length: data.currentMonth }, (_, index) => index + 1);
            const annual = scopes.map(scope => { const previousFull = sum(scope.key, data.previousYear, Array.from({ length: 12 }, (_, index) => index + 1)); const previousYtd = sum(scope.key, data.previousYear, ytd); const currentYtd = sum(scope.key, data.currentYear, ytd); return '<tr><td class="nc-name">' + scope.name + '</td><td>' + previousFull + '</td><td>' + previousYtd + '</td><td>' + currentYtd + '</td><td>' + formatChange(currentYtd, previousYtd) + '</td></tr>'; }).join('');
            const quarters = []; const completedQuarters = Math.floor((data.currentMonth - 1) / 3);
            scopes.forEach(scope => { for (let quarter = 1; quarter <= completedQuarters; quarter++) { const months = [quarter * 3 - 2, quarter * 3 - 1, quarter * 3]; const current = sum(scope.key, data.currentYear, months); const previous = sum(scope.key, data.previousYear, months); const previousQuarter = quarter === 1 ? sum(scope.key, data.previousYear, [10, 11, 12]) : sum(scope.key, data.currentYear, months.map(month => month - 3)); quarters.push('<tr><td class="nc-name">' + scope.name + '</td><td>Q' + quarter + '</td><td>' + previous + '</td><td>' + current + '</td><td>' + formatChange(current, previous) + '</td><td>' + previousQuarter + '</td><td>' + formatChange(current, previousQuarter) + '</td></tr>'); } });
            const details = []; for (const year of [data.currentYear, data.previousYear]) { const maxMonth = year === data.currentYear ? data.currentMonth : 12; for (let month = maxMonth; month >= 1; month--) { const total = map.get('TOTAL|' + year + '|' + month) || {}; details.push('<tr><td class="nc-name">' + year + '-' + pad2(month) + '</td><td>' + value('TOTAL', year, month) + '</td><td>' + value('CNBG', year, month) + '</td><td>' + value('EBG', year, month) + '</td><td>' + ((num(total.operation_success_rate) <= 1 ? num(total.operation_success_rate) * 100 : num(total.operation_success_rate)).toFixed(1)) + '%</td><td>' + num(total.rollback_count) + '</td><td>' + num(total.high_core_total_count) + '</td></tr>'); } }
            views.change.innerHTML = '<div class="nc-card"><div class="nc-card-title"><span>年度操作数量同比</span><small>截至 ' + data.currentYear + '-' + pad2(data.currentMonth) + '</small></div><div class="nc-table-wrap"><table class="nc-table"><thead><tr><th>范围</th><th>' + data.previousYear + '全年</th><th>' + data.previousYear + '同期</th><th>' + data.currentYear + '累计</th><th>同比</th></tr></thead><tbody>' + annual + '</tbody></table></div></div><div class="nc-card"><div class="nc-card-title"><span>季度同比 / 环比</span><small>仅完整季度</small></div><div class="nc-table-wrap"><table class="nc-table"><thead><tr><th>范围</th><th>季度</th><th>上年同期</th><th>本年</th><th>同比</th><th>上季度</th><th>环比</th></tr></thead><tbody>' + (quarters.join('') || '<tr><td colspan="7" class="nc-muted">暂无完整季度</td></tr>') + '</tbody></table></div></div><div class="nc-card"><div class="nc-card-title"><span>月度变更明细</span></div><div class="nc-table-wrap"><table class="nc-table"><thead><tr><th>月份</th><th>总体</th><th>CNBG</th><th>EBG</th><th>成功率</th><th>回退</th><th>高危核心</th></tr></thead><tbody>' + details.join('') + '</tbody></table></div></div>';
        }
        function renderInterception(data) {
            const map = new Map(data.rows.map(row => [row.scope + '|' + row.year + '|' + row.month, row]));
            const scopes = interceptionDistinguishBG ? [{ key: 'TOTAL', name: '总体' }, { key: 'CNBG', name: 'CNBG' }, { key: 'EBG', name: 'EBG' }] : [{ key: 'TOTAL', name: '总体' }];
            const metrics = [{ field: 'interception_cnt', name: '拦截总量' }, { field: 'commands_interception_cnt', name: '命令行拦截' }, { field: 'graphical_interception_cnt', name: '图形化拦截' }];
            const value = (scope, year, month, field) => num((map.get(scope + '|' + year + '|' + month) || {})[field]);
            const sum = (scope, year, months, field) => months.reduce((total, month) => total + value(scope, year, month, field), 0);
            const ytd = Array.from({ length: data.currentMonth }, (_, index) => index + 1); const full = Array.from({ length: 12 }, (_, index) => index + 1);
            const annual = []; scopes.forEach(scope => metrics.forEach(metric => { const previousFull = sum(scope.key, data.previousYear, full, metric.field); const previousYtd = sum(scope.key, data.previousYear, ytd, metric.field); const currentYtd = sum(scope.key, data.currentYear, ytd, metric.field); annual.push('<tr><td class="nc-name">' + scope.name + '</td><td class="nc-name">' + metric.name + '</td><td>' + previousFull + '</td><td>' + previousYtd + '</td><td>' + currentYtd + '</td><td>' + formatChange(currentYtd, previousYtd) + '</td></tr>'); }));
            const quarters = []; const completed = Math.floor((data.currentMonth - 1) / 3); scopes.forEach(scope => metrics.forEach(metric => { for (let quarter = 1; quarter <= completed; quarter++) { const months = [quarter * 3 - 2, quarter * 3 - 1, quarter * 3]; const current = sum(scope.key, data.currentYear, months, metric.field); const previous = sum(scope.key, data.previousYear, months, metric.field); const previousQuarter = quarter === 1 ? sum(scope.key, data.previousYear, [10, 11, 12], metric.field) : sum(scope.key, data.currentYear, months.map(month => month - 3), metric.field); quarters.push('<tr><td>' + scope.name + '</td><td>' + metric.name + '</td><td>Q' + quarter + '</td><td>' + previous + '</td><td>' + current + '</td><td>' + formatChange(current, previous) + '</td><td>' + previousQuarter + '</td><td>' + formatChange(current, previousQuarter) + '</td></tr>'); } }));
            const details = []; for (const year of [data.currentYear, data.previousYear]) { const maxMonth = year === data.currentYear ? data.currentMonth : 12; for (let month = maxMonth; month >= 1; month--) for (const scope of scopes) details.push('<tr><td>' + year + '-' + pad2(month) + '</td><td>' + scope.name + '</td><td>' + value(scope.key, year, month, 'interception_cnt') + '</td><td>' + value(scope.key, year, month, 'commands_interception_cnt') + '</td><td>' + value(scope.key, year, month, 'graphical_interception_cnt') + '</td></tr>'); }
            views.interception.innerHTML = '<label class="nc-option"><input class="nc-bg-toggle" type="checkbox" ' + (interceptionDistinguishBG ? 'checked' : '') + '> 区分 BG 统计</label><div class="nc-card"><div class="nc-card-title"><span>高危拦截年度同期同比</span><small>截至 ' + data.currentYear + '-' + pad2(data.currentMonth) + '</small></div><div class="nc-table-wrap"><table class="nc-table"><thead><tr><th>范围</th><th>指标</th><th>上年全年</th><th>上年同期</th><th>本年累计</th><th>同比</th></tr></thead><tbody>' + annual.join('') + '</tbody></table></div></div><div class="nc-card"><div class="nc-card-title"><span>季度同比 / 环比</span><small>仅完整季度</small></div><div class="nc-table-wrap"><table class="nc-table"><thead><tr><th>范围</th><th>指标</th><th>季度</th><th>上年同期</th><th>本年</th><th>同比</th><th>上季度</th><th>环比</th></tr></thead><tbody>' + (quarters.join('') || '<tr><td colspan="8" class="nc-muted">暂无完整季度</td></tr>') + '</tbody></table></div></div><div class="nc-card"><div class="nc-card-title"><span>高危拦截月度明细</span></div><div class="nc-table-wrap"><table class="nc-table"><thead><tr><th>月份</th><th>范围</th><th>总量</th><th>命令行</th><th>图形化</th></tr></thead><tbody>' + details.join('') + '</tbody></table></div></div>';
            views.interception.querySelector('.nc-bg-toggle').addEventListener('change', event => { interceptionDistinguishBG = event.target.checked; renderInterception(data); });
        }
        let cachedInterception = null;
        async function loadDashboard() {
            if (loading || destroyed) return;
            const token = findCsrfToken();
            if (!token) { modeStatus.textContent = '未找到 csrfToken，请刷新 NetCare 页面后重试。'; return; }
            loading = true; refreshButton.disabled = true; modeStatus.textContent = '正在获取证书、EOS、变更数量及高危拦截数据…';
            Object.values(views).forEach(view => { view.innerHTML = '<div class="nc-loading">正在加载专题数据…</div>'; });
            try {
                const result = await Promise.all([
                    loadAllPages('证书', API_URLS.certificate, SOURCE_PAGE.certificate, Object.assign({}, CERT_BODY, { limit: 50 }), token),
                    loadAllPages('产品 EOS', API_URLS.eos, SOURCE_PAGE.eos, PRODUCT_BODY, token),
                    loadAllPages('版本 EOS', API_URLS.eos, SOURCE_PAGE.eos, VERSION_BODY, token),
                    loadChangeData(token), loadInterceptionData(token)
                ]);
                if (destroyed) return;
                renderCertificate(result[0]); renderEos(result[1], result[2]); renderChange(result[3]); cachedInterception = result[4]; renderInterception(cachedInterception);
                loaded = true;
                modeStatus.textContent = '更新于 ' + new Date().toLocaleTimeString('zh-CN', { hour12: false }) + ' · 证书 ' + result[0].length + ' · 产品 ' + result[1].length + ' · 版本 ' + result[2].length + ' · 变更 ' + result[3].rows.length + ' · 拦截 ' + result[4].rows.length;
            } catch (error) {
                const message = escapeHtml(error && error.message || String(error));
                Object.values(views).forEach(view => { view.innerHTML = '<div class="nc-error">专题数据获取失败：' + message + '<br><br>请确认 NetCare 登录状态后重试。</div>'; });
                modeStatus.textContent = '专题获取失败';
                console.error('[UIVF12 NetCare Analysis]', error);
            } finally { loading = false; refreshButton.disabled = false; }
        }
        refreshButton.addEventListener('click', loadDashboard);
        return {
            showCsv: function () { if (active) setMode(false); },
            isLoading: function () { return loading; },
            destroy: function () { destroyed = true; style.remove(); mode.remove(); button.remove(); }
        };
    }

    window.UIVNetCareAnalysis = {
        getRuntimeSource() { return `(${installNetCareAnalysisRuntime.toString()})`; }
    };
})();
