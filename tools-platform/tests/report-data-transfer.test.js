const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'tools-report-transfer-'));
process.env.TOOLS_DATA_DIR = path.join(sandbox, 'data');
process.env.TOOLS_REPORT_DATA_DIR = path.join(sandbox, 'report');

const appDb = require('../backend/models/app-db');
const tenantPool = require('../backend/models/tenant-sqlite-pool');
const transfer = require('../backend/models/report-data-transfer-repository');
const { getReportDataDir, runWithTenant } = require('../backend/models/tenant-context');

function runReport(sql, params = []) {
    const db = tenantPool.getConnection('report.db', 'report');
    return new Promise((resolve, reject) => db.run(sql, params, function onRun(error) {
        error ? reject(error) : resolve({ changes: this.changes, lastID: this.lastID });
    }));
}

function allReport(sql, params = []) {
    const db = tenantPool.getConnection('report.db', 'report');
    return new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
}

async function seedSnapshot({ id, month, marker }) {
    await transfer.restoreRows({
        slaSnapshots: [{ id, timestamp: `2026-0${month}-01T00:00:00.000Z`, payload_json: JSON.stringify({ id, marker }) }],
        reportSnapshots: [{ snapshot_id: id, month, created_at: `2026-0${month}-01 00:00:00`, stored_at: `2026-0${month}-01 00:01:00`, standard_total_score: 100, raw_data_json: JSON.stringify({ marker }) }],
        reportCategoryScores: [{ snapshot_id: id, month, cat_name: marker, base_score: 80, manual_score: 1, final_score: 81 }],
        reportMetricData: [{ snapshot_id: id, month, cat_name: marker, metric_label: 'metric', weight: 10, target_val: '1', raw_val: marker, num_val: month, is_failing: 0, gap: '', earned_score: 10, proportional_scoring: 0, completion_ratio: 1 }]
    }, 'merge');
}

test('report packages merge different periods and replace matching snapshot-month records', async t => {
    t.after(async () => {
        await tenantPool.closeAll();
        await appDb.closeDatabase();
        fs.rmSync(sandbox, { recursive: true, force: true });
    });

    let packageBuffer;
    await runWithTenant('site-a', async () => {
        await seedSnapshot({ id: 'snapshot-a', month: 1, marker: 'from-a' });
        const imagesDir = path.join(getReportDataDir(), 'images');
        fs.mkdirSync(imagesDir, { recursive: true });
        fs.writeFileSync(path.join(imagesDir, 'snapshot-a_1.png'), 'image-a');
        await runReport("UPDATE ReportSnapshots SET image_path='/api/db/images/snapshot-a_1.png' WHERE snapshot_id='snapshot-a'");
        packageBuffer = (await transfer.createBackupPackage()).buffer;
    });

    await runWithTenant('site-b', async () => {
        await seedSnapshot({ id: 'snapshot-b', month: 2, marker: 'keep-b' });
        await seedSnapshot({ id: 'snapshot-a', month: 1, marker: 'old-a' });

        const merged = await transfer.restoreBackupPackage(packageBuffer, { mode: 'merge' });
        assert.equal(merged.mode, 'merge');
        assert.equal(merged.counts.attachments, 1);
        assert.equal(fs.readFileSync(path.join(getReportDataDir(), 'images', 'snapshot-a_1.png'), 'utf8'), 'image-a');

        const reports = await allReport('SELECT snapshot_id, month, raw_data_json FROM ReportSnapshots ORDER BY snapshot_id');
        assert.equal(reports.length, 2);
        assert.deepEqual(reports.map(row => row.snapshot_id), ['snapshot-a', 'snapshot-b']);
        assert.equal(JSON.parse(reports[0].raw_data_json).marker, 'from-a');
        assert.equal((await appDb.all('SELECT id FROM sla_snapshots ORDER BY id')).length, 2);

        const replaced = await transfer.restoreBackupPackage(packageBuffer, { mode: 'replace' });
        assert.equal(replaced.mode, 'replace');
        assert.deepEqual((await allReport('SELECT snapshot_id FROM ReportSnapshots')).map(row => row.snapshot_id), ['snapshot-a']);
        assert.deepEqual((await appDb.all('SELECT id FROM sla_snapshots')).map(row => row.id), ['snapshot-a']);
    });
});

test('report backup validation rejects a modified data payload', async () => {
    const invalid = {
        slaSnapshots: [],
        reportSnapshots: [],
        reportCategoryScores: [],
        reportMetricData: [{ snapshot_id: '', month: 1 }]
    };
    assert.throws(() => transfer.validateData(invalid), /快照 ID 无效/);
});
