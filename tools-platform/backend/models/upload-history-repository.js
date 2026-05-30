const { readJSON, writeJSON } = require('./store');
const { run, get, all } = require('./app-db');

const HISTORY_FILE = 'upload_history.json';
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

            const row = await get('SELECT COUNT(1) AS count FROM upload_history');
            if (row && row.count > 0) return;

            const history = readJSON(HISTORY_FILE, []);
            if (!Array.isArray(history) || history.length === 0) return;

            await run('BEGIN TRANSACTION');
            try {
                for (const item of history) {
                    await run(
                        `INSERT OR REPLACE INTO upload_history (id, tool, action, detail, time)
                         VALUES (?, ?, ?, ?, ?)`,
                        [item.id, item.tool, item.action, item.detail || '', item.time]
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

function readHistoryFromJson() {
    const history = readJSON(HISTORY_FILE, []);
    return Array.isArray(history) ? history : [];
}

function writeHistoryToJson(history) {
    const trimmed = history.slice(0, MAX_HISTORY);
    writeJSON(HISTORY_FILE, trimmed);
    return trimmed;
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

function listFromJson({ tool, limit = 50 } = {}) {
    const history = readHistoryFromJson();
    const parsedLimit = Number.parseInt(limit, 10);
    const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 50;
    const filtered = tool ? history.filter(item => item.tool === tool) : history;

    return {
        items: filtered.slice(0, safeLimit),
        hasData: filtered.length > 0,
        source: 'json'
    };
}

async function listHistory({ tool, limit = 50, mode = 'auto' } = {}) {
    const normalizedMode = String(mode || 'auto').toLowerCase();

    if (normalizedMode === 'json') {
        const result = listFromJson({ tool, limit });
        return {
            items: result.items,
            source: result.source
        };
    }

    if (normalizedMode === 'sqlite' || normalizedMode === 'db') {
        return {
            items: await listFromDb({ tool, limit }),
            source: 'sqlite'
        };
    }

    try {
        const dbItems = await listFromDb({ tool, limit });
        if (dbItems && dbItems.length > 0) {
            return { items: dbItems, source: 'sqlite' };
        }
    } catch (err) {}

    const jsonResult = listFromJson({ tool, limit });
    if (jsonResult.hasData) {
        return {
            items: jsonResult.items,
            source: jsonResult.source
        };
    }

    return {
        items: await listFromDb({ tool, limit }),
        source: 'sqlite'
    };
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

    const history = readHistoryFromJson();
    history.unshift(item);
    writeHistoryToJson(history);

    try {
        await appendToDb(item);
    } catch (err) {
        console.error('[upload-history] SQLite dual-write failed:', err.message);
    }

    return item;
}

async function clearHistory({ tool } = {}) {
    const history = readHistoryFromJson();
    const nextHistory = tool ? history.filter(item => item.tool !== tool) : [];
    writeHistoryToJson(nextHistory);

    try {
        await deleteFromDb(tool);
    } catch (err) {
        console.error('[upload-history] SQLite delete sync failed:', err.message);
    }
}

module.exports = {
    MAX_HISTORY,
    ensureReady,
    listHistory,
    addHistory,
    clearHistory
};
