const { run, get, all } = require('./platform-db');
const { DEFAULT_TENANT_ID } = require('./tenant-context');

let initPromise = null;

async function ensureReady() {
    if (!initPromise) {
        initPromise = (async () => {
            await run(`
                CREATE TABLE IF NOT EXISTS auth_sessions (
                    token TEXT PRIMARY KEY,
                    username TEXT NOT NULL,
                    role TEXT NOT NULL,
                    expires_at INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            try { await run(`ALTER TABLE auth_sessions ADD COLUMN active_tenant_id TEXT NOT NULL DEFAULT '${DEFAULT_TENANT_ID}'`); } catch (_) {}

            const row = await get('SELECT COUNT(1) AS count FROM auth_sessions');
            if (row && row.count > 0) return;

        })().catch(err => {
            initPromise = null;
            throw err;
        });
    }
    return initPromise;
}

async function listFromDb() {
    await ensureReady();
    const rows = await all('SELECT token, username, role, expires_at, active_tenant_id FROM auth_sessions');
    const result = {};
    for (const row of rows) {
        result[row.token] = {
            user: { username: row.username, role: row.role, tenantId: row.active_tenant_id || DEFAULT_TENANT_ID },
            expiresAt: row.expires_at
        };
    }
    return result;
}

async function listSessions() {
    const items = await listFromDb();
    return { items, source: 'sqlite' };
}

async function getSession(token) {
    await ensureReady();
    const row = await get('SELECT username, role, expires_at, active_tenant_id FROM auth_sessions WHERE token = ?', [token]);
    if (row) {
        return {
            user: { username: row.username, role: row.role, tenantId: row.active_tenant_id || DEFAULT_TENANT_ID },
            expiresAt: row.expires_at
        };
    }
    return null;
}

async function saveSession(token, username, role, expiresAt, tenantId = DEFAULT_TENANT_ID) {

    try {
        await ensureReady();
        await run(
            `INSERT OR REPLACE INTO auth_sessions (token, username, role, expires_at, active_tenant_id) VALUES (?, ?, ?, ?, ?)`,
            [token, username, role, expiresAt, tenantId]
        );
    } catch (err) {
        console.error('[auth-sessions] SQLite dual-write failed:', err.message);
    }
}

async function setActiveTenant(token, tenantId) {
    await ensureReady();
    const result = await run('UPDATE auth_sessions SET active_tenant_id=? WHERE token=?', [tenantId, token]);
    return result.changes > 0;
}

async function deleteSession(token) {
    
    try {
        await ensureReady();
        await run('DELETE FROM auth_sessions WHERE token = ?', [token]);
    } catch (err) {
        console.error('[auth-sessions] SQLite delete sync failed:', err.message);
    }
}

module.exports = {
    ensureReady,
    listSessions,
    getSession,
    saveSession,
    setActiveTenant,
    deleteSession
};
