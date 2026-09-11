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
        settings: { eos: { targets: { product: 90 } } },
        data: {
            certificate: [{ id: 1 }], eosProduct: [{ pending: 5 }, { pending: 2 }], eosVersion: [{ pending: 3 }],
            change: { rows: [{ id: 'c1' }] }, interception: { rows: [{ id: 'i1' }, { id: 'i2' }] },
            sr: { currentYear: 2026, currentMonth: 8, summary: [{ id: 's1' }], monthly: [{ id: 'm1' }] }
        }
    };
}

function makeDataFabSnapshot() {
    return {
        schema: 'uivf12-topic-snapshot', version: 1, platform: 'datafab',
        capturedAt: '2026-09-02T09:00:00.000Z', exportedAt: '2026-09-02T10:00:00.000Z',
        scope: { region: 'China' }, settings: { year: 2026, month: 9 },
        data: { months: [{ month: 9, required: 10, returned: 8 }], detail: [{ id: 1 }], detailsByMonth: { 8: [{ id: 2 }], 9: [{ id: 1 }, { id: 3 }] } }
    };
}

test('topic snapshots persist full JSON, deduplicate imports and remain tenant isolated', async t => {
    t.after(async () => { await appDb.closeDatabase(); fs.rmSync(sandbox, { recursive: true, force: true }); });

    const first = await repo.saveSnapshot(makeNetCareSnapshot());
    assert.equal(first.created, true);
    assert.equal(first.item.summary.totalRows, 9);
    assert.equal(first.item.period, '2026-08');

    const duplicate = await repo.saveSnapshot(makeNetCareSnapshot());
    assert.equal(duplicate.created, false);
    assert.equal(duplicate.item.id, first.item.id);
    assert.equal((await repo.listSnapshots()).total, 1);

    const datafab = await repo.saveSnapshot(makeDataFabSnapshot());
    assert.equal(datafab.item.summary.metrics.rawRows, 3);
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
