const { run, get, all } = require('./app-db');

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
    const rows = await all('SELECT token, username, role, expires_at FROM auth_sessions');
    const result = {};
    for (const row of rows) {
        result[row.token] = {
            user: { username: row.username, role: row.role },
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
    const row = await get('SELECT username, role, expires_at FROM auth_sessions WHERE token = ?', [token]);
    if (row) {
        return {
            user: { username: row.username, role: row.role },
            expiresAt: row.expires_at
        };
    }
    return null;
}

async function saveSession(token, username, role, expiresAt) {

    try {
        await ensureReady();
        await run(
            `INSERT OR REPLACE INTO auth_sessions (token, username, role, expires_at) VALUES (?, ?, ?, ?)`,
            [token, username, role, expiresAt]
        );
    } catch (err) {
        console.error('[auth-sessions] SQLite dual-write failed:', err.message);
    }
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
    deleteSession
};
