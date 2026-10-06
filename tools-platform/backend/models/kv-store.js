const { run, get, getDatabase } = require('./app-db');

// Readiness belongs to a connection: initializing one tenant must not skip another.
const initializations = new WeakMap();
async function initKV() {
    const connection = getDatabase();
    if (!initializations.has(connection)) {
        const pending = run('CREATE TABLE IF NOT EXISTS sys_kv_store (category TEXT, key TEXT, value TEXT, PRIMARY KEY(category, key))');
        initializations.set(connection, pending);
        pending.catch(() => initializations.delete(connection));
    }
    await initializations.get(connection);
}

async function readKV(category, key, defaultVal) {
    await initKV();
    const row = await get('SELECT value FROM sys_kv_store WHERE category = ? AND key = ?', [category, key]);
    if (!row) return defaultVal;
    try {
        return JSON.parse(row.value);
    } catch {
        return defaultVal;
    }
}

async function writeKV(category, key, val) {
    await initKV();
    await run('INSERT OR REPLACE INTO sys_kv_store (category, key, value) VALUES (?, ?, ?)', [category, key, JSON.stringify(val)]);
}

async function deleteKV(category, key) {
    await initKV();
    await run('DELETE FROM sys_kv_store WHERE category = ? AND key = ?', [category, key]);
}

module.exports = { readKV, writeKV, deleteKV };
