const { run, get, all } = require('./app-db');

const MAX_HISTORY = 200;

let initPromise = null;

function buildHistoryItem({ tool, action, detail = '' }) {
    return {
        id: Date.now().toString(36),
        tool,
        action,
        detail,
        time: new Date().toISOString()
    };
}

async function ensureReady() {
    if (!initPromise) {
        initPromise = (async () => {
            await run(`
                CREATE TABLE IF NOT EXISTS upload_history (
                    id TEXT PRIMARY KEY,
                    tool TEXT NOT NULL,
                    action TEXT NOT NULL,
                    detail TEXT NOT NULL DEFAULT '',
                    time TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
        })().catch(err => {
            initPromise = null;
            throw err;
        });
    }

    return initPromise;
}

async function listFromDb({ tool, limit = 50 } = {}) {
    await ensureReady();
    const parsedLimit = Number.parseInt(limit, 10);
    const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 50;

    const sql = tool
        ? `SELECT id, tool, action, detail, time
           FROM upload_history
           WHERE tool = ?
           ORDER BY time DESC, rowid DESC
           LIMIT ?`
        : `SELECT id, tool, action, detail, time
           FROM upload_history
           ORDER BY time DESC, rowid DESC
           LIMIT ?`;

    return tool ? all(sql, [tool, safeLimit]) : all(sql, [safeLimit]);
}

async function listHistory({ tool, limit = 50 } = {}) {
    const dbItems = await listFromDb({ tool, limit });
    return { items: dbItems, source: 'sqlite' };
}

async function trimDbToMaxHistory() {
    await run(`
        DELETE FROM upload_history
        WHERE id NOT IN (
            SELECT id
            FROM upload_history
            ORDER BY time DESC, rowid DESC
            LIMIT ?
        )
    `, [MAX_HISTORY]);
}

async function appendToDb(item) {
    await ensureReady();
    await run(
        `INSERT OR REPLACE INTO upload_history (id, tool, action, detail, time)
         VALUES (?, ?, ?, ?, ?)`,
        [item.id, item.tool, item.action, item.detail || '', item.time]
    );
    await trimDbToMaxHistory();
}

async function deleteFromDb(tool) {
    await ensureReady();
    if (tool) {
        await run('DELETE FROM upload_history WHERE tool = ?', [tool]);
    } else {
        await run('DELETE FROM upload_history');
    }
}

async function addHistory({ tool, action, detail = '' }) {
    const item = buildHistoryItem({ tool, action, detail });
    await appendToDb(item);
    return item;
}

async function clearHistory({ tool } = {}) {
    await deleteFromDb(tool);
}

module.exports = {
    MAX_HISTORY,
    ensureReady,
    listHistory,
    addHistory,
    clearHistory
};
