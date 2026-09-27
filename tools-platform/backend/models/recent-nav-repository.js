const { run, all } = require('./app-db');

async function ensureTable() {
    await run(`CREATE TABLE IF NOT EXISTS recent_nav_tools (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        tool_id TEXT NOT NULL,
        UNIQUE(username, tool_id)
    )`);
}

async function listRecent(username) {
    await ensureTable();
    const rows = await all('SELECT tool_id FROM recent_nav_tools WHERE username = ? ORDER BY sequence DESC LIMIT 16', [username]);
    return rows.map(row => row.tool_id);
}

async function recordRecent(username, toolId) {
    await ensureTable();
    await run('INSERT OR REPLACE INTO recent_nav_tools (username, tool_id) VALUES (?, ?)', [username, toolId]);
    await run(`DELETE FROM recent_nav_tools WHERE username = ? AND sequence NOT IN (
        SELECT sequence FROM recent_nav_tools WHERE username = ? ORDER BY sequence DESC LIMIT 16
    )`, [username, username]);
    return listRecent(username);
}

module.exports = { listRecent, recordRecent };
