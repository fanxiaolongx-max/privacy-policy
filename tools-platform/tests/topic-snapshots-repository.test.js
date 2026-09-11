const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'topic-snapshots-'));
process.env.TOOLS_DATA_DIR = path.join(sandbox, 'data');
process.env.TOOLS_REPORT_DATA_DIR = path.join(sandbox, 'report-data');

const appDb = require('../backend/models/app-db');
const repo = require('../backend/models/topic-snapshots-repository');
const { runWithTenant } = require('../backend/models/tenant-context');

function makeNetCareSnapshot(capturedAt = '2026-08-01T09:00:00.000Z') {
    return {
        schema: 'uivf12-topic-snapshot', version: 1, platform: 'netcare',
        capturedAt, exportedAt: '2026-08-01T10:00:00.000Z', scope: { regionCode: 'CN' },
        settings: { eos: { targets: { product: 90, version: 80 }, plans: { product: { 'Customer A|||wireless|||P1|||P1': 3 }, version: { 'Customer A|||wireless|||P1|||V1': 2 } } } },
        data: {
            certificate: [{ need_reduce_cnt: 10, reduced_cnt: 6 }],
            eosProduct: [{ customer_name: 'Customer A', product_line_name: 'wireless', product_name: 'P1', incorporation_total_nes: 10, incorporated_nes: 4, to_be_incorporated_nes: 6 }],
            eosVersion: [{ customer_name: 'Customer A', product_line_name: 'wireless', product_name: 'P1', software_version: 'V1', incorporation_total_nes: 8, incorporated_nes: 2, to_be_incorporated_nes: 5 }],
            change: { currentYear: 2026, previousYear: 2025, currentMonth: 8, rows: [{ scope: 'TOTAL', year: 2026, month: 8, task_count: 120, rollback_count: 2, high_core_total_count: 3, operation_success_rate: 0.99 }, { scope: 'TOTAL', year: 2025, month: 8, task_count: 100 }] },
            interception: { currentYear: 2026, previousYear: 2025, currentMonth: 8, rows: [{ scope: 'TOTAL', year: 2026, month: 8, interception_cnt: 10, commands_interception_cnt: 6, graphical_interception_cnt: 4 }, { scope: 'TOTAL', year: 2025, month: 8, interception_cnt: 8 }] },
            sr: { currentYear: 2026, previousYear: 2025, currentMonth: 8, summary: [{ scope: 'TOTAL', period: 'currentYtd', sr_total: 50, sr_frt: 0.9, unclose_sr_cnt: 5, overdue_sr_cnt: 2 }, { scope: 'TOTAL', period: 'previousYtd', sr_total: 40 }], monthly: [{ year: 2026, month: 8, sr_total: 10 }] }
        }
    };
}

function makeDataFabSnapshot() {
    return {
        schema: 'uivf12-topic-snapshot', version: 1, platform: 'datafab',
        capturedAt: '2026-09-02T09:00:00.000Z', exportedAt: '2026-09-02T10:00:00.000Z',
        scope: { region: 'China' }, settings: { year: 2026, month: 9, targets: { returnRate: 95, recordRate: 25 } },
        data: { months: [{ month: 9, required: 10, returned: 8, pending: 2, returnRate: 80, recorded: 2, recordRate: 20 }], detail: [{ id: 1 }], detailsByMonth: { 8: [{ id: 2 }], 9: [{ id: 1 }, { id: 3 }] } }
    };
}

test('topic snapshots persist full JSON, deduplicate imports and remain tenant isolated', async t => {
    t.after(async () => { await appDb.closeDatabase(); fs.rmSync(sandbox, { recursive: true, force: true }); });

    const first = await repo.saveSnapshot(makeNetCareSnapshot());
    assert.equal(first.created, true);
    assert.equal(first.item.summary.totalRows, 10);
    assert.equal(first.item.period, '2026-08');
    assert.deepEqual(first.item.summary.topics.certificate, { total: 10, reduced: 6, pending: 4, completionRate: 60 });
    assert.equal(first.item.summary.topics.eosProduct.annualPlan, 3);
    assert.equal(first.item.summary.topics.eosProduct.noPlan, 3);
    assert.equal(first.item.summary.topics.eosProduct.plannedRate, 70);
    assert.equal(first.item.summary.topics.change.yoyRate, 20);
    assert.equal(first.item.summary.topics.interception.total, 10);
    assert.equal(first.item.summary.topics.sr.frtRate, 90);

    const duplicate = await repo.saveSnapshot(makeNetCareSnapshot());
    assert.equal(duplicate.created, false);
    assert.equal(duplicate.item.id, first.item.id);
    assert.equal((await repo.listSnapshots()).total, 1);

    const datafab = await repo.saveSnapshot(makeDataFabSnapshot());
    assert.equal(datafab.item.summary.metrics.rawRows, 3);
    assert.equal(datafab.item.summary.topics.return.returnRate, 80);
    assert.equal(datafab.item.summary.topics.filing.recordRate, 20);
    const detail = await repo.getSnapshot(datafab.item.id);
    assert.deepEqual(detail.snapshot.data.detailsByMonth['9'], [{ id: 1 }, { id: 3 }]);
    assert.equal((await repo.getLatestSnapshot('datafab')).id, datafab.item.id);
    assert.deepEqual((await repo.getSeries()).map(item => item.platform), ['netcare', 'datafab']);

    await runWithTenant('second', async () => {
        assert.equal((await repo.listSnapshots()).total, 0);
        await repo.saveSnapshot(makeNetCareSnapshot('2026-09-03T09:00:00.000Z'));
        assert.equal((await repo.listSnapshots()).total, 1);
    });
    assert.equal((await repo.listSnapshots()).total, 2);
    assert.equal(await repo.deleteSnapshot(first.item.id), true);
    assert.equal(await repo.getSnapshot(first.item.id), null);
});

test('topic snapshots reject malformed payloads', async () => {
    await assert.rejects(() => repo.saveSnapshot({ schema: 'wrong' }), /不支持的专题快照格式/);
    await assert.rejects(() => repo.getLatestSnapshot('unknown'), /netcare/);
});
