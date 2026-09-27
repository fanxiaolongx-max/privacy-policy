const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recent-nav-'));
process.env.TOOLS_DATA_DIR = dataDir;
process.env.TOOLS_REPORT_DATA_DIR = path.join(dataDir, 'reports');

const { runWithTenant } = require('../backend/models/tenant-context');
const { closeDatabase } = require('../backend/models/app-db');
const repo = require('../backend/models/recent-nav-repository');

test('recent tools are ordered, capped, and isolated by account and tenant', async () => {
    try {
        await runWithTenant('default', async () => {
            for (let index = 0; index < 18; index += 1) {
                await repo.recordRecent('alice', `tool-${index}`);
            }
            assert.equal((await repo.listRecent('alice')).length, 16);
            assert.equal((await repo.listRecent('alice'))[0], 'tool-17');
            await repo.recordRecent('alice', 'tool-3');
            assert.equal((await repo.listRecent('alice'))[0], 'tool-3');
            assert.deepEqual(await repo.listRecent('bob'), []);
        });
        await runWithTenant('other', async () => {
            assert.deepEqual(await repo.listRecent('alice'), []);
            await repo.recordRecent('alice', 'other-tool');
        });
        assert.equal((await runWithTenant('default', () => repo.listRecent('alice')))[0], 'tool-3');
    } finally {
        await closeDatabase();
        fs.rmSync(dataDir, { recursive: true, force: true });
    }
});
