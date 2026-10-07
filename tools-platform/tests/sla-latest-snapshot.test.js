const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const request = require('supertest');
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'sla-latest-snapshot-'));
process.env.TOOLS_DATA_DIR = path.join(sandbox, 'data');
process.env.TOOLS_REPORT_DATA_DIR = path.join(sandbox, 'report');
const db = require('../backend/models/app-db');
const repo = require('../backend/models/sla-snapshots-repository');
const { runWithTenant } = require('../backend/models/tenant-context');
const app = express();
app.use((req, _res, next) => runWithTenant(req.get('x-test-tenant') || 'default', next));
app.use('/api/sla', require('../backend/routes/sla'));

test('latest snapshot API returns only the newest tenant snapshot, including a valid empty snapshot', async t => {
    t.after(async () => { await db.closeDatabase(); fs.rmSync(sandbox, { recursive: true, force: true }); });
    const empty = await request(app).get('/api/sla/snapshots/latest');
    assert.equal(empty.status, 200); assert.equal(empty.body.snapshot, null);
    await repo.addSnapshot({ id: 'older', timestamp: '2026-10-01T10:00:00Z', expiringTickets: [{ data: { ticket_id: 'default' } }] });
    await repo.addSnapshot({ id: 'latest', timestamp: '2026-10-07T10:00:00Z', expiringTickets: [] });
    const latest = await request(app).get('/api/sla/snapshots/latest');
    assert.equal(latest.status, 200); assert.equal(latest.body.snapshot.id, 'latest');
    assert.deepEqual(latest.body.snapshot.expiringTickets, []);
    assert.equal(latest.headers['cache-control'], 'no-store');
    const isolated = await request(app).get('/api/sla/snapshots/latest').set('x-test-tenant', 'acme');
    assert.equal(isolated.status, 200); assert.equal(isolated.body.snapshot, null);
    await runWithTenant('acme', () => db.run(`INSERT INTO sla_snapshots (id, timestamp, payload_json) VALUES (?, ?, ?)`,
        ['acme', '2026-10-08T10:00:00Z', JSON.stringify({ id: 'acme', timestamp: '2026-10-08T10:00:00Z', expiringTickets: [] })]));
    assert.equal((await request(app).get('/api/sla/snapshots/latest').set('x-test-tenant', 'acme')).body.snapshot.id, 'acme');
    assert.equal((await request(app).get('/api/sla/snapshots/latest')).body.snapshot.id, 'latest');
});
