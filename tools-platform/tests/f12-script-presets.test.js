const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'f12-script-presets-'));
process.env.TOOLS_DATA_DIR = path.join(sandbox, 'data');
process.env.TOOLS_REPORT_DATA_DIR = path.join(sandbox, 'report-data');

const appDb = require('../backend/models/app-db');
const repository = require('../backend/models/f12-script-presets-repository');
const { runWithTenant } = require('../backend/models/tenant-context');

function sample(overrides = {}) {
    return {
        name: '新建工单助手',
        description: '从页面提取工单信息',
        matches: 'https://example.com/*',
        world: 'MAIN',
        includePopup: true,
        manualLaunch: true,
        runAt: 'document_idle',
        allFrames: false,
        optionalPermissions: ['downloads', 'downloads', 'not-allowed'],
        code: 'console.log("saved preset");',
        ...overrides
    };
}

test('F12 server script presets persist per tenant and can be updated', async t => {
    t.after(async () => {
        await appDb.closeDatabase();
        fs.rmSync(sandbox, { recursive: true, force: true });
    });

    const created = await repository.savePreset(sample());
    assert.ok(created.id);
    assert.deepEqual(created.optionalPermissions, ['downloads']);
    assert.deepEqual((await repository.listPresets()).map(item => item.name), ['新建工单助手']);

    const updated = await repository.savePreset(sample({
        name: '新建工单助手 Pro',
        code: 'console.log("updated preset");'
    }), created.id);
    assert.equal(updated.id, created.id);
    assert.equal(updated.code, 'console.log("updated preset");');

    await runWithTenant('tenant-b', async () => {
        assert.deepEqual(await repository.listPresets(), []);
        const tenantPreset = await repository.savePreset(sample({ name: '租户 B 脚本' }));
        assert.equal((await repository.listPresets())[0].id, tenantPreset.id);
    });

    assert.deepEqual((await repository.listPresets()).map(item => item.name), ['新建工单助手 Pro']);
    await assert.rejects(() => repository.savePreset(sample({ name: '', code: '' })), /脚本名称不能为空/);
});
