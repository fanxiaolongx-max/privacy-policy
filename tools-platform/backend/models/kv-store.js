const { run, get } = require('./app-db');

let ready = false;
async function initKV() {
    if (ready) return;
    await run('CREATE TABLE IF NOT EXISTS sys_dictionaries (category TEXT, key TEXT, value TEXT, PRIMARY KEY(category, key))');
    ready = true;
}

async function readKV(category, key, defaultVal) {
    await initKV();
    const row = await get('SELECT value FROM sys_dictionaries WHERE category = ? AND key = ?', [category, key]);
    if (!row) return defaultVal;
    try {
        return JSON.parse(row.value);
    } catch {
        return defaultVal;
    }
}

async function writeKV(category, key, val) {
    await initKV();
    await run('INSERT OR REPLACE INTO sys_dictionaries (category, key, value) VALUES (?, ?, ?)', [category, key, JSON.stringify(val)]);
}

module.exports = { readKV, writeKV };