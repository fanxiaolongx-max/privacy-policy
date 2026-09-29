const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const request = require('supertest');

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'tools-platform-sla-copied-'));
process.env.TOOLS_DATA_DIR = path.join(sandbox, 'data');
process.env.TOOLS_REPORT_DATA_DIR = path.join(sandbox, 'report-data');

const appDb = require('../backend/models/app-db');
const copiedFieldsRepo = require('../backend/models/sla-copied-fields-repository');
const configChangeMonitor = require('../backend/models/config-change-monitor');
const auditLogRepo = require('../backend/models/audit-log-repository');

configChangeMonitor.recordSlaConfigChange = () => {};
auditLogRepo.addAuditLog = async () => {};

const app = express();
app.use(express.json());
app.use('/api/sla', require('../backend/routes/sla'));

test('SLA copied fields repository records and orders frequent fields', async t => {
    t.after(async () => {
        await appDb.closeDatabase();
        fs.rmSync(sandbox, { recursive: true, force: true });
    });

    // 1. Initial state is empty
    const initial = await copiedFieldsRepo.getCopiedFieldStats('rectification');
    assert.deepEqual(initial.frequentFields, []);

    // 2. Record copies
    await copiedFieldsRepo.recordFieldCopy('rectification', 'task_id');
    await copiedFieldsRepo.recordFieldCopy('rectification', 'task_status');
    await copiedFieldsRepo.recordFieldCopy('rectification', 'task_id'); // task_id count = 2

    const afterRect = await copiedFieldsRepo.getCopiedFieldStats('rectification');
    assert.equal(afterRect.frequentFields[0], 'task_id');
    assert.equal(afterRect.fieldCounts['task_id'], 2);
    assert.equal(afterRect.fieldCounts['task_status'], 1);

    // 3. API POST /api/sla/copied-fields
    const postRes = await request(app)
        .post('/api/sla/copied-fields')
        .send({ tableType: 'risk', fieldName: 'risk_id' });
    assert.equal(postRes.status, 200);
    assert.equal(postRes.body.record.fieldName, 'risk_id');
    assert.equal(postRes.body.record.copyCount, 1);

    // 4. API GET /api/sla/copied-fields?tableType=risk
    const getRes = await request(app)
        .get('/api/sla/copied-fields?tableType=risk');
    assert.equal(getRes.status, 200);
    assert.deepEqual(getRes.body.frequentFields, ['risk_id']);

    // 5. Config export contains copiedFields
    const configRes = await request(app).get('/api/sla/config');
    assert.equal(configRes.status, 200);
    assert.ok(Array.isArray(configRes.body.copiedFields));
    assert.ok(configRes.body.copiedFields.some(r => r.fieldName === 'task_id'));

    // 6. Delete
    const delRes = await request(app)
        .delete('/api/sla/copied-fields')
        .send({ tableType: 'risk', fieldName: 'risk_id' });
    assert.equal(delRes.status, 200);
    const afterDel = await copiedFieldsRepo.getCopiedFieldStats('risk');
    assert.deepEqual(afterDel.frequentFields, []);
});
