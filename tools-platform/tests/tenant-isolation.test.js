const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'tools-platform-tenant-'));
process.env.TOOLS_DATA_DIR = path.join(sandbox, 'data');
process.env.TOOLS_REPORT_DATA_DIR = path.join(sandbox, 'report-data');

const platformDb = require('../backend/models/platform-db');
const appDb = require('../backend/models/app-db');
const tenantPool = require('../backend/models/tenant-sqlite-pool');
const tenantsRepo = require('../backend/models/tenants-repository');
const sessionsRepo = require('../backend/models/auth-sessions-repository');
const scriptsRepo = require('../backend/models/uiv-scripts-repository');
const { getDataDir, getReportDataDir, runWithTenant } = require('../backend/models/tenant-context');

function proxyRun(db, sql, params = []) {
    return new Promise((resolve, reject) => db.run(sql, params, function onRun(error) {
        error ? reject(error) : resolve({ changes: this.changes, lastID: this.lastID });
    }));
}

function proxyGet(db, sql, params = []) {
    return new Promise((resolve, reject) => db.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));
}

test('tenant storage uses independent databases and directories without moving default data', async t => {
    t.after(async () => {
        await appDb.closeDatabase();
        await tenantPool.closeAll();
        await platformDb.closeDatabase();
        fs.rmSync(sandbox, { recursive: true, force: true });
    });

    await platformDb.run(`CREATE TABLE IF NOT EXISTS auth_users (
        username TEXT PRIMARY KEY, role TEXT NOT NULL, password_hash TEXT NOT NULL
    )`);
    await platformDb.run(`INSERT INTO auth_users (username, role, password_hash) VALUES ('admin', 'admin', 'test')`);
    await sessionsRepo.ensureReady();
    await appDb.run('CREATE TABLE isolated_business_data (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
    await scriptsRepo.replaceAllScripts([{ id: 'default-script', name: 'Default Script', category: 'test' }]);

    const defaultReport = tenantPool.createDatabaseProxy('report.db', 'report');
    await proxyRun(defaultReport, 'CREATE TABLE isolated_report_data (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
    await appDb.run("INSERT INTO isolated_business_data (value) VALUES ('default-only')");
    await proxyRun(defaultReport, "INSERT INTO isolated_report_data (value) VALUES ('default-report')");

    const progressEntries = [];
    const created = await tenantsRepo.createTenant({ id: 'acme', name: 'Acme' }, { onProgress: entry => progressEntries.push(entry) });
    assert.equal(created.id, 'acme');
    assert.deepEqual(progressEntries.map(entry => entry.stage), [
        'validate', 'validated', 'storage-staging', 'schema-tools', 'schema-requirements', 'schema-ai',
        'schema-report', 'directories', 'builtin-tools', 'storage-commit', 'storage-ready', 'registry',
        'scheduler', 'completed'
    ]);
    assert.equal(progressEntries.at(-1).percent, 100);
    assert.equal(getDataDir('default'), process.env.TOOLS_DATA_DIR);
    assert.equal(getReportDataDir('default'), process.env.TOOLS_REPORT_DATA_DIR);
    assert.notEqual(getDataDir('acme'), getDataDir('default'));
    assert.equal(getReportDataDir('acme'), getDataDir('acme'));

    await runWithTenant('acme', async () => {
        assert.deepEqual(await appDb.get('SELECT COUNT(*) AS count FROM isolated_business_data'), { count: 0 });
        assert.equal(await appDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name='auth_users'"), undefined);
        await appDb.run("INSERT INTO isolated_business_data (value) VALUES ('acme-only')");
        assert.deepEqual((await scriptsRepo.listScripts()).items, []);
        await scriptsRepo.replaceAllScripts([{ id: 'acme-script', name: 'Acme Script', category: 'test' }]);
        const tenantReport = tenantPool.createDatabaseProxy('report.db', 'report');
        assert.deepEqual(await proxyGet(tenantReport, 'SELECT COUNT(*) AS count FROM isolated_report_data'), { count: 0 });
        await proxyRun(tenantReport, "INSERT INTO isolated_report_data (value) VALUES ('acme-report')");
    });

    assert.deepEqual(await appDb.all('SELECT value FROM isolated_business_data ORDER BY id'), [{ value: 'default-only' }]);
    assert.deepEqual((await scriptsRepo.listScripts()).items.map(item => item.id), ['default-script']);
    assert.deepEqual(await proxyGet(defaultReport, 'SELECT COUNT(*) AS count FROM isolated_report_data'), { count: 1 });

    await runWithTenant('acme', async () => {
        assert.deepEqual(await appDb.all('SELECT value FROM isolated_business_data ORDER BY id'), [{ value: 'acme-only' }]);
        const tenantReport = tenantPool.createDatabaseProxy('report.db', 'report');
        assert.deepEqual(await proxyGet(tenantReport, 'SELECT COUNT(*) AS count FROM isolated_report_data'), { count: 1 });
    });
    await assert.rejects(() => tenantsRepo.canAccess('admin', 'admin', '../../default'), /租户标识无效/);
    await assert.rejects(() => tenantsRepo.updateTenant('bad/id', { name: 'bad' }), /租户标识无效/);
    await assert.rejects(() => tenantsRepo.createTenant({ id: 'default', name: 'Reserved' }), /保留租户标识/);

    await assert.rejects(() => tenantsRepo.deleteTenantPermanently('default'), /默认租户不能删除/);
    await assert.rejects(() => tenantsRepo.deleteTenantPermanently('acme'), /只能彻底删除已归档租户/);
    await tenantsRepo.archiveTenant('acme');
    assert.equal(await tenantsRepo.canAccess('admin', 'admin', 'acme'), false);
    assert.equal((await tenantsRepo.listManagedTenants()).find(item => item.id === 'acme')?.status, 'archived');
    await tenantsRepo.restoreTenant('acme');
    assert.equal(await tenantsRepo.canAccess('admin', 'admin', 'acme'), true);
    assert.equal(fs.existsSync(getDataDir('acme')), true);
    await tenantsRepo.archiveTenant('acme');
    await tenantsRepo.deleteTenantPermanently('acme');
    assert.equal(await tenantsRepo.getTenantById('acme'), undefined);
    assert.equal(fs.existsSync(getDataDir('acme')), false);
});
