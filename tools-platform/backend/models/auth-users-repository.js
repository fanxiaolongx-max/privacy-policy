const { run, get, all } = require('./app-db');
const { hashPassword } = require('../middleware/auth');

let initPromise = null;

function getInitialAdmin() {
    return {
        username: process.env.INITIAL_ADMIN_USERNAME || 'admin',
        password: process.env.INITIAL_ADMIN_PASSWORD || 'admin123',
        role: 'admin'
    };
}

async function ensureReady() {
    if (!initPromise) {
        initPromise = (async () => {
            await run(`
                CREATE TABLE IF NOT EXISTS auth_users (
                    username TEXT PRIMARY KEY,
                    role TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            const row = await get('SELECT COUNT(1) AS count FROM auth_users');
            if (row && row.count === 0) {
                const initial = getInitialAdmin();
                const hash = await hashPassword(initial.password);
                await run(
                    'INSERT INTO auth_users (username, role, password_hash) VALUES (?, ?, ?)',
                    [initial.username, initial.role, hash]
                );
            }
        })().catch(err => {
            initPromise = null;
            throw err;
        });
    }
    return initPromise;
}

async function listFromDb() {
    await ensureReady();
    const rows = await all('SELECT username, role, password_hash FROM auth_users ORDER BY created_at ASC');
    const result = {};
    for (const row of rows) {
        result[row.username] = {
            role: row.role,
            passwordHash: row.password_hash
        };
    }
    return result;
}

async function listUsers(options = {}) {
    const items = await listFromDb(options);
    return { items, source: 'sqlite' };
}

async function getUser(username) {
    await ensureReady();
    const row = await get('SELECT role, password_hash FROM auth_users WHERE username = ?', [username]);
    if (row) {
        return { role: row.role, passwordHash: row.password_hash };
    }
    return null;
}

async function saveUser(username, role, passwordHash) {
        try {
        await ensureReady();
        await run(
            `INSERT OR REPLACE INTO auth_users (username, role, password_hash) VALUES (?, ?, ?)`,
            [username, role, passwordHash]
        );
    } catch (err) {
        console.error('[auth-users] SQLite dual-write failed:', err.message);
    }
}

async function deleteUser(username) {
    
    if (users[username]) {
        delete users[username];
        writeUsersToJson(users);
    }

    try {
        await ensureReady();
        await run('DELETE FROM auth_users WHERE username = ?', [username]);
    } catch (err) {
        console.error('[auth-users] SQLite delete sync failed:', err.message);
    }
}

module.exports = {
    ensureReady,
    listUsers,
    getUser,
    saveUser,
    deleteUser
};
