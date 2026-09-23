const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const request = require('supertest');

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'tools-platform-sla-targets-'));
process.env.TOOLS_DATA_DIR = path.join(sandbox, 'data');
process.env.TOOLS_REPORT_DATA_DIR = path.join(sandbox, 'report-data');

const appDb = require('../backend/models/app-db');
const targetsRepo = require('../backend/models/sla-targets-repository');
const configChangeMonitor = require('../backend/models/config-change-monitor');
const auditLogRepo = require('../backend/models/audit-log-repository');

// This test only checks the replacement boundary; avoid unrelated audit and AI work.
configChangeMonitor.recordSlaConfigChange = () => {};
auditLogRepo.addAuditLog = async () => {};

const app = express();
app.use(express.json());
app.use('/api/sla', require('../backend/routes/sla'));

test('bulk target replacement requires confirmation of the current configuration', async t => {
    t.after(async () => {
        await appDb.closeDatabase();
        fs.rmSync(sandbox, { recursive: true, force: true });
    });

    const existing = Object.fromEntries(Array.from({ length: 58 }, (_, i) => [
        `target_${i}`,
        { label: `Metric ${i}`, type: 'gte', weight: 1 }
    ]));
    await targetsRepo.replaceTargets(existing);

    const proposed = { test_target: { label: 'Test Target', type: 'gte', 5: 100 } };
    const rejected = await request(app).put('/api/sla/targets').send(proposed);
    assert.equal(rejected.status, 409);
    assert.equal(rejected.body.code, 'SLA_TARGETS_BULK_REPLACE_CONFIRM_REQUIRED');
    assert.equal(rejected.body.beforeCount, 58);
    assert.equal(rejected.body.afterCount, 1);
    assert.equal((await targetsRepo.getTargets()).items.test_target, undefined);
    assert.equal(Object.keys((await targetsRepo.getTargets()).items).length, 58);

    const staleConfirmation = await request(app)
        .put('/api/sla/targets')
        .set('x-sla-targets-replace-confirm', 'stale-configuration')
        .send(proposed);
    assert.equal(staleConfirmation.status, 409);
    assert.equal(Object.keys((await targetsRepo.getTargets()).items).length, 58);

    const confirmed = await request(app)
        .put('/api/sla/targets')
        .set('x-sla-targets-replace-confirm', rejected.body.beforeHash)
        .send(proposed);
    assert.equal(confirmed.status, 200);
    assert.deepEqual((await targetsRepo.getTargets()).items, proposed);
});
