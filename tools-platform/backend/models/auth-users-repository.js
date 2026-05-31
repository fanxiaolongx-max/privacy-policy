const { readJSON, writeJSON } = require('./store');
const { run, get, all } = require('./app-db');
const { hashPassword } = require('../middleware/auth');

const USERS_FILE = 'users.json';
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
            if (row && row.count > 0) return;

            const users = readJSON(USERS_FILE, {});
            const usernames = Object.keys(users);
            if (usernames.length === 0) {
                const admin = getInitialAdmin();
                await run(
                    `INSERT OR IGNORE INTO auth_users (username, role, password_hash) VALUES (?, ?, ?)`,
                    [admin.username, admin.role, hashPassword(admin.password)]
                );
                console.warn(
                    `[auth-users] Initialized default admin "${admin.username}". Set INITIAL_ADMIN_USERNAME and INITIAL_ADMIN_PASSWORD to override it.`
                );
                return;
            }

            await run('BEGIN TRANSACTION');
            try {
                for (const username of usernames) {
                    await run(
                        `INSERT OR IGNORE INTO auth_users (username, role, password_hash) VALUES (?, ?, ?)`,
                        [username, users[username].role, users[username].passwordHash]
                    );
                }
                await run('COMMIT');
            } catch (err) {
                await run('ROLLBACK').catch(() => {});
                throw err;
            }
        })().catch(err => {
            initPromise = null;
            throw err;
        });
    }
    return initPromise;
}

function readUsersFromJson() {
    return readJSON(USERS_FILE, {});
}

function writeUsersToJson(users) {
    writeJSON(USERS_FILE, users);
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

async function listUsers({ mode = 'auto' } = {}) {
    const normalizedMode = String(mode || 'auto').toLowerCase();

    if (normalizedMode === 'json') {
        return {
            items: readUsersFromJson(),
            source: 'json'
        };
    }

    if (normalizedMode === 'sqlite' || normalizedMode === 'db') {
        return {
            items: await listFromDb(),
            source: 'sqlite'
        };
    }

    // --- AUTO MODE PRIORITY: SQLITE ---
    try {
        const dbRes = await listFromDb();
        if (dbRes && (Array.isArray(dbRes) ? dbRes.length > 0 : Object.keys(dbRes).length > 0)) {
            return { items: dbRes, source: 'sqlite' };
        }
    } catch (err) {}

    const jsonUsers = readUsersFromJson();
    if (Object.keys(jsonUsers).length > 0) {
        return {
            items: jsonUsers,
            source: 'json'
        };
    }

    return {
        items: await listFromDb(),
        source: 'sqlite'
    };
}

async function getUser(username) {
    const jsonUsers = readUsersFromJson();
    if (jsonUsers[username]) {
        return jsonUsers[username];
    }
    await ensureReady();
    const row = await get('SELECT role, password_hash FROM auth_users WHERE username = ?', [username]);
    if (row) {
        return { role: row.role, passwordHash: row.password_hash };
    }
    return null;
}

async function saveUser(username, role, passwordHash) {
    const users = readUsersFromJson();
    users[username] = { role, passwordHash };
    writeUsersToJson(users);

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
    const users = readUsersFromJson();
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
