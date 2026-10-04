const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { initializeSqliteConnection } = require('../backend/models/sqlite-connection-initializer');

const projectRoot = path.join(__dirname, '..');

function mockConnection(walError) {
    let walAttempts = 0;
    const sqlCalls = [];
    return {
        sqlCalls,
        get walAttempts() { return walAttempts; },
        serialize(callback) { callback(); },
        run(sql, callback) {
            sqlCalls.push(sql);
            const error = sql.includes('journal_mode') ? walError(++walAttempts) : null;
            setImmediate(() => callback(error));
        }
    };
}

function withFreshDatabase(script) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tools-startup-sqlite-'));
    try {
        const result = spawnSync(process.execPath, ['-e', script], {
            cwd: projectRoot,
            env: { ...process.env, TOOLS_DATA_DIR: directory, TOOLS_REPORT_DATA_DIR: directory },
            encoding: 'utf8',
            timeout: 15000
        });
        assert.ifError(result.error);
        assert.equal(result.status, 0, result.stderr || result.stdout);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
}

test('fresh business and platform connections initialize the same database without uncaught WAL errors', () => {
    for (let attempt = 0; attempt < 12; attempt++) {
        withFreshDatabase(`
            const assert = require('node:assert/strict');
            const app = require('./backend/models/app-db');
            app.getDatabase();
            const platform = require('./backend/models/platform-db');
            (async () => {
                assert.notEqual(app.getDatabase(), platform.db);
                await Promise.all([
                    app.run('CREATE TABLE startup_business(id INTEGER PRIMARY KEY)'),
                    platform.run('CREATE TABLE startup_control(id INTEGER PRIMARY KEY)')
                ]);
                await Promise.all([
                    app.run('INSERT INTO startup_business VALUES (1)'),
                    platform.run('INSERT INTO startup_control VALUES (2)')
                ]);
                assert.equal((await app.get('PRAGMA journal_mode')).journal_mode, 'wal');
                assert.equal((await platform.get('PRAGMA journal_mode')).journal_mode, 'wal');
                assert.equal((await app.get('PRAGMA foreign_keys')).foreign_keys, 1);
                assert.equal((await platform.get('PRAGMA foreign_keys')).foreign_keys, 1);
                assert.equal((await app.get('SELECT id FROM startup_control')).id, 2);
                await Promise.all([app.closeDatabase(), platform.closeDatabase()]);
            })().catch(error => { console.error(error); process.exitCode = 1; });
        `);
    }
});

test('raw handles enforce foreign keys for writes queued immediately after opening', () => {
    for (const moduleName of ['app-db', 'platform-db']) {
        withFreshDatabase(`
            const assert = require('node:assert/strict');
            const owner = require('./backend/models/${moduleName}');
            const db = owner.getDatabase ? owner.getDatabase() : owner.db;
            const run = sql => new Promise((resolve, reject) => db.run(sql, error => error ? reject(error) : resolve()));
            const create = new Promise((resolve, reject) => db.exec(
                'CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(parent_id INTEGER REFERENCES parent(id));',
                error => error ? reject(error) : resolve()
            ));
            (async () => {
                await create;
                await assert.rejects(run('INSERT INTO child VALUES (999)'), error => error.code === 'SQLITE_CONSTRAINT');
                await owner.closeDatabase();
            })().catch(error => { console.error(error); process.exitCode = 1; });
        `);
    }
});

test('connections can close immediately during initialization without a retry using a closed handle', () => {
    withFreshDatabase(`
        const app = require('./backend/models/app-db');
        app.getDatabase();
        const platform = require('./backend/models/platform-db');
        Promise.all([app.closeTenant('default'), platform.closeDatabase()])
            .catch(error => { console.error(error); process.exitCode = 1; });
    `);
});

test('WAL initialization retries only transient SQLITE_BUSY and retains synchronous foreign-key setup', async () => {
    const connection = mockConnection(attempt => attempt < 3 ? { code: 'SQLITE_BUSY' } : null);
    const ready = initializeSqliteConnection(connection);
    assert.deepEqual(connection.sqlCalls, [
        'PRAGMA busy_timeout = 5000', 'PRAGMA foreign_keys = ON', 'PRAGMA journal_mode = WAL'
    ]);
    await ready;
    assert.equal(connection.walAttempts, 3);
});

test('WAL initialization propagates non-BUSY errors without retrying', async () => {
    const failure = Object.assign(new Error('Read-only database'), { code: 'SQLITE_READONLY' });
    const connection = mockConnection(() => failure);
    await assert.rejects(initializeSqliteConnection(connection), error => error === failure);
    assert.equal(connection.walAttempts, 1);
});

test('WAL initialization has a bounded retry count and propagates exhausted SQLITE_BUSY', async () => {
    const failure = Object.assign(new Error('Database remains locked'), { code: 'SQLITE_BUSY' });
    const connection = mockConnection(() => failure);
    await assert.rejects(initializeSqliteConnection(connection), error => error === failure);
    assert.equal(connection.walAttempts, 5);
});
