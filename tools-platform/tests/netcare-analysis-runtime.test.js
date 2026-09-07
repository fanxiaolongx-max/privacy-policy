const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const runtimePath = path.join(projectRoot, 'frontend/js/uivf12/netcare-analysis.js');
const pagePath = path.join(projectRoot, 'frontend/pages/uivf12.html');

test('NetCare EOS runtime stays self-contained when embedded in the floating script', () => {
    const source = fs.readFileSync(runtimePath, 'utf8');
    const context = { window: {} };
    vm.runInNewContext(source, context);

    const runtimeSource = context.window.UIVNetCareAnalysis.getRuntimeSource();
    assert.doesNotThrow(() => new vm.Script(runtimeSource));
    assert.match(runtimeSource, /uivf12-netcare-eos-settings-v1/);
    assert.match(runtimeSource, /数量由大到小/);
    assert.match(runtimeSource, /收编率由低到高/);
    assert.match(runtimeSource, /uivf12-netcare-language-v1/);
    assert.match(runtimeSource, /class="nc-language"/);
    assert.match(runtimeSource, /EOS Product & Version Progress/);
});

test('NetCare EOS planning UI keeps its calculation and input constraints', () => {
    const source = fs.readFileSync(runtimePath, 'utf8');

    assert.match(source, /Math\.min\(item\.pending, saved\)/);
    assert.match(source, /item\.noPlan = Math\.max\(0, item\.pending - item\.annualPlan\)/);
    assert.match(source, /Math\.min\(item\.pending, Math\.max\(0, Math\.floor/);
    assert.match(source, /metric\.incorporated \+ \(includePlan \? metric\.annualPlan : 0\)/);
    assert.match(source, /今年计划完成数量/);
    assert.match(source, /今年预计达成收编率/);
    assert.doesNotMatch(source, /距目标/);
    assert.doesNotMatch(source, /达标 \+/);
    assert.match(source, /const visibleItems = items; const columnCount = isProduct \? 11 : 12/);
    assert.match(source, /显示全部数据/);
    assert.match(source, /renderOriginalEosTable\(productRows, versionRows\)/);
    assert.match(source, /产品 Top N/);
    assert.match(source, /版本 Top N/);
    assert.match(source, /data-eos-top-type="' \+ type \+ '" data-eos-top-step="-1"/);
    assert.match(source, /class="nc-top-n-input"/);
    assert.match(source, /topN: \{ product: 3, version: 3 \}/);
    assert.match(source, /legacyTopN/);
    assert.match(source, /topPendingGroups/);
    assert.match(source, /pendingItemsByCustomer/);
    assert.match(source, /entry\[1\] \/ group\.pending/);
    assert.match(source, /kind === 'child' \? topPendingCell\(bucket\.product, 'product'\)/);
    assert.match(source, /const isCustomer = style === 10/);
    assert.match(source, /right\.pending - left\.pending/);
    assert.match(source, /eosPendingTotal\(right\[1\]\) - eosPendingTotal\(left\[1\]\)/);
    assert.match(source, /data-plan-action="minus"/);
    assert.match(source, /data-plan-action="plus"/);
    assert.match(source, /data-plan-action="half"/);
    assert.match(source, /data-plan-action="all"/);
    assert.match(source, /data-plan-action="clear"/);
    assert.match(source, /Math\.ceil\(item\.pending \/ 2\)/);
    assert.match(source, /lineLabel \+ ' · ' \+ item\.label/);
    assert.match(source, /function renderEosBrief/);
    assert.match(source, /metric\.incorporated \+ topPending/);
    assert.match(source, /Product Incorporation Brief/);
    assert.match(source, /Version Incorporation Brief/);
    assert.match(source, /data-bulk-action="all"/);
    assert.match(source, /data-bulk-action="topn"/);
    assert.match(source, /slice\(0, eosSettings\.topN\[type\]\)/);
    assert.match(source, /填各客户 Top /);
    assert.match(source, /data-bulk-action="clear"/);
    assert.match(source, /eosSettings\.plans\[type\] = \{\}/);
    assert.match(source, /function mergedEosRow/);
    assert.match(source, /function aggregateEosItems/);
    assert.match(source, /class="nc-collapse-button"/);
    assert.match(source, /nc-readonly-plan/);
    assert.match(source, /saved\.collapsed/);
    assert.match(source, /class="nc-export-button"/);
    assert.match(source, /function exportEosWorkbook/);
    assert.match(source, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
    assert.match(source, /xl\/worksheets\/sheet4\.xml/);
    assert.match(source, /EOS收编分析_/);
    assert.match(source, /浅黄色为用户录入的今年计划/);
    assert.match(source, /包含全部数据/);
    assert.match(source, /No Plan is calculated as Pending minus Planned This Year/);
    assert.match(source, /autoFilter: 'A3:L'/);
    assert.match(source, /merges: \['A1:O1'/);
    assert.match(source, /'<\/sheetData>' \+ filter \+ merges/);
    assert.match(source, /<sz val="8"\/>/);
    assert.match(source, /const topStyle = style === 3 \? 12 : style === 9 \? 13 : 11/);
    assert.match(source, /horizontal="center" vertical="center"/);
    assert.match(source, /CHANGE_BU_OPTIONS = \['NIS', 'CS', 'AMS', 'NIS-ITS', 'Software', 'SEC', '专业服务', 'PS', 'NRO', '工程服务'\]/);
    assert.match(source, /bu: selectedBus/);
    assert.match(source, /class="nc-bu-apply"/);
    assert.match(source, /loadChangeData\(token, changeBuSelection\)/);
    assert.match(source, /dashboardCache\[3\] = result/);
    assert.match(source, /uivf12-netcare-change-bu-v1/);
    assert.match(source, /各范围年度同期对比/);
    assert.match(source, /总体季度同比与环比/);
    assert.match(source, /月度变更量同期趋势/);
    assert.match(source, /\[\[changeCards\[0\], annualChart\], \[changeCards\[1\], quarterChart\], \[changeCards\[2\], monthlyChart\]\]/);
    assert.match(source, /各范围证书清理进展/);
    assert.match(source, /重点产品线消减进展 Top 6/);
    assert.match(source, /\[\[certCards\[0\], progressChart\], \[certCards\[1\], productChart\]\]/);
    assert.match(source, /总体各类拦截年度同期/);
    assert.match(source, /总体拦截量季度同比与环比/);
    assert.match(source, /本年高危拦截月度构成/);
    assert.match(source, /showValues: false/);
    assert.match(source, /op_ex_sr_problem_overview_statistics/);
    assert.match(source, /data-view="sr"/);
    assert.match(source, /SR_TYPE_NAMES/);
    assert.match(source, /function normalizeSrRow/);
    assert.match(source, /function aggregateSrRows/);
    assert.match(source, /function renderSr/);
    assert.match(source, /年度同期与 BG 对比/);
    assert.match(source, /完整季度同比/);
    assert.match(source, /月度 SR 明细/);
    assert.match(source, /uivf12-netcare-sr-types-v1/);
    assert.match(source, /sr_type_name: selectedSrTypes\.length \? selectedSrTypes : SR_TYPE_NAMES/);
    assert.match(source, /bu_name: \[\]/);
    assert.match(source, /data-sr-type=/);
    assert.match(source, /loadSrData\(token, srTypeSelection\)/);
    assert.match(source, /dashboardCache\[5\] = result/);
    assert.match(source, /SR 数量变化总览/);
    assert.match(source, /年度 SR 数量同比/);
    assert.match(source, /季度 SR 数量同比 \/ 环比/);
    assert.match(source, /月度 SR 数量详表/);
    assert.match(source, /function renderVolumeChange/);
    assert.match(source, /function renderSrBarChart/);
    assert.match(source, /function renderSrLineChart/);
    assert.match(source, /grid\.className = 'nc-sr-analysis-grid'/);
    assert.match(source, /月度 SR 趋势/);
});

test('NetCare EOS Top N is calculated independently for each customer', () => {
    const source = fs.readFileSync(runtimePath, 'utf8');
    const start = source.indexOf('function emptyEosMetric');
    const end = source.indexOf('function briefGap', start);
    assert.ok(start > 0 && end > start);
    const helpers = vm.runInNewContext(`(() => {
        const eosSettings = { topN: { product: 2, version: 1 }, plans: { product: {}, version: {} } };
        const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
        const tr = (zh, en) => zh;
        ${source.slice(start, end)}
        return { emptyEosMetric, addEosMetric, topPendingGroups };
    })()`);
    const metric = helpers.emptyEosMetric();
    [
        { customer: 'A', pendingLabel: 'Line 1 · P1', pending: 9 },
        { customer: 'A', pendingLabel: 'Line 2 · P2', pending: 7 },
        { customer: 'A', pendingLabel: 'Line 3 · P3', pending: 3 },
        { customer: 'B', pendingLabel: 'Line 4 · P4', pending: 8 },
        { customer: 'B', pendingLabel: 'Line 5 · P5', pending: 2 }
    ].forEach(item => helpers.addEosMetric(metric, item));
    const groups = helpers.topPendingGroups(metric, 'product');
    assert.equal(groups.length, 2);
    assert.deepEqual(Array.from(groups[0].items, item => item[1]), [9, 7]);
    assert.deepEqual(Array.from(groups[1].items, item => item[1]), [8, 2]);
    assert.equal(groups[0].pending, 19);
    assert.equal(groups[1].pending, 10);
    const versionGroups = helpers.topPendingGroups(metric, 'version');
    assert.deepEqual(Array.from(versionGroups[0].items, item => item[1]), [9]);
    assert.deepEqual(Array.from(versionGroups[1].items, item => item[1]), [8]);
});

test('NetCare EOS No Plan follows Pending minus Planned for product and version', () => {
    const source = fs.readFileSync(runtimePath, 'utf8');
    const start = source.indexOf('function buildEosItems');
    const end = source.indexOf('function buildEos(', start);
    assert.ok(start > 0 && end > start);
    const helpers = vm.runInNewContext(`(() => {
        const eosSettings = { plans: { product: {}, version: {} } };
        const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
        const tr = (zh, en) => zh;
        const normalizeCustomer = value => String(value || '未知');
        const customerBG = () => 'CNBG';
        const eosItemLabel = (row, type) => type === 'product' ? row.product_name : row.software_version;
        const eosItemKey = (row, type) => [row.customer_name, row.product_name, eosItemLabel(row, type)].join('|');
        const firstNumber = (row, keys) => keys.reduce((result, key) => result || num(row[key]), 0);
        const eosIncorporated = row => num(row.incorporated_nes);
        ${source.slice(start, end)}
        return { buildEosItems, eosSettings };
    })()`);
    const row = { customer_name: 'A', product_line_name: 'Line', product_name: 'P1', software_version: 'V1', incorporation_total_nes: 10, incorporated_nes: 5, to_be_incorporated_nes: 5 };
    const productKey = 'A|P1|P1'; const versionKey = 'A|P1|V1';
    helpers.eosSettings.plans.product[productKey] = 2;
    helpers.eosSettings.plans.version[versionKey] = 4;
    assert.equal(helpers.buildEosItems([row], 'product')[0].noPlan, 3);
    assert.equal(helpers.buildEosItems([row], 'version')[0].noPlan, 1);
});

test('NetCare SR metrics preserve source fields and weight ratio metrics', () => {
    const source = fs.readFileSync(runtimePath, 'utf8');
    const start = source.indexOf('function normalizeSrRow');
    const end = source.indexOf('async function postInterception', start);
    assert.ok(start > 0 && end > start);
    const helpers = vm.runInNewContext(`(() => { const num = value => Number.isFinite(Number(value)) ? Number(value) : 0; ${source.slice(start, end)} return { normalizeSrRow, aggregateSrRows }; })()`);
    const sample = {
        sr_total: 6764, sr_frt: 0.9952, unclose_sr_cnt: 456, overdue_sr_cnt: 58, minor_sr_cnt: 3876, major_sr_cnt: 2262, critical_sr_cnt: 132,
        authed_rate: 0.3756, auth_out_warranty_rate: 0.1633, e2e_report_to_resolve_dura: '10.46',
        statResults: { authed_cnt: 637, sn_auth_cnt: 1696, auth_out_warranty_cnt: 104, sr_frt_c: 3539, sr_frt_d: 3556, report_to_resolve_dura: 69554.04, e2e_sr_total: 6648 }
    };
    const row = helpers.normalizeSrRow(sample, { scope: 'TOTAL' });
    assert.equal(row.sr_total, 6764);
    assert.equal(row.e2e_report_to_resolve_dura, 10.46);
    const aggregate = helpers.aggregateSrRows([row, row]);
    assert.equal(aggregate.sr_total, 13528);
    assert.ok(Math.abs(aggregate.sr_frt - 3539 / 3556) < 1e-10);
    assert.ok(Math.abs(aggregate.authed_rate - 637 / 1696) < 1e-10);
    assert.ok(Math.abs(aggregate.e2e_report_to_resolve_dura - 69554.04 / 6648) < 1e-10);
});

test('UIVF12 page cache-busts the enhanced NetCare runtime', () => {
    const html = fs.readFileSync(pagePath, 'utf8');
    assert.match(html, /netcare-analysis\.js\?v=20260907-19/);
});
