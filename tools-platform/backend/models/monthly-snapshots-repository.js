const { run, get, all } = require('./app-db');

let initPromise = null;

async function ensureReady() {
    if (!initPromise) {
        initPromise = (async () => {
            await run(`
                CREATE TABLE IF NOT EXISTS monthly_report_snapshots (
                    id TEXT PRIMARY KEY,
                    tool_key TEXT NOT NULL,
                    topic_key TEXT DEFAULT '',
                    month TEXT NOT NULL,
                    name TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    summary_json TEXT,
                    payload_json TEXT NOT NULL
                )
            `);
            await run(`
                CREATE INDEX IF NOT EXISTS idx_monthly_report_snapshots_lookup
                ON monthly_report_snapshots(tool_key, topic_key, month, updated_at DESC)
            `);
        })().catch(err => {
            initPromise = null;
            throw err;
        });
    }
    return initPromise;
}

function parseJson(str, fallback = {}) {
    if (!str) return fallback;
    try {
        return JSON.parse(str);
    } catch (_) {
        return fallback;
    }
}

async function listSnapshots({ toolKey, topicKey, month, includePayload = false } = {}) {
    await ensureReady();
    const conditions = [];
    const params = [];

    if (toolKey) {
        conditions.push('tool_key = ?');
        params.push(String(toolKey).trim());
    }
    if (topicKey !== undefined && topicKey !== null && topicKey !== '') {
        conditions.push('topic_key = ?');
        params.push(String(topicKey).trim());
    }
    if (month) {
        conditions.push('month = ?');
        params.push(String(month).trim());
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
        SELECT id, tool_key, topic_key, month, name, created_at, updated_at, summary_json
        ${includePayload ? ', payload_json' : ''}
        FROM monthly_report_snapshots
        ${whereClause}
        ORDER BY month DESC, updated_at DESC, id DESC
    `;

    const rows = await all(query, params);
    return rows.map(row => {
        const item = {
            id: row.id,
            toolKey: row.tool_key,
            topicKey: row.topic_key,
            month: row.month,
            name: row.name,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            summary: parseJson(row.summary_json, {})
        };
        if (includePayload) {
            item.payload = parseJson(row.payload_json, null);
        }
        return item;
    });
}

async function getSnapshot(id) {
    await ensureReady();
    const snapId = String(id || '').trim();
    if (!snapId) return null;

    const row = await get(`
        SELECT id, tool_key, topic_key, month, name, created_at, updated_at, summary_json, payload_json
        FROM monthly_report_snapshots
        WHERE id = ?
    `, [snapId]);

    if (!row) return null;

    return {
        id: row.id,
        toolKey: row.tool_key,
        topicKey: row.topic_key,
        month: row.month,
        name: row.name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        summary: parseJson(row.summary_json, {}),
        payload: parseJson(row.payload_json, null)
    };
}

async function saveSnapshot({ id, toolKey, topicKey = '', month, name, summary = {}, payload = {} }) {
    await ensureReady();
    const tKey = String(toolKey || '').trim();
    if (!tKey) throw new Error('toolKey 不能为空');
    const mStr = String(month || '').trim() || '当月';
    const snapId = String(id || '').trim() || `snap_${tKey}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const snapName = String(name || '').trim() || `${mStr} 月报快照 (${new Date().toLocaleTimeString('zh-CN')})`;

    const summaryJson = JSON.stringify(summary || {});
    const payloadJson = JSON.stringify(payload || {});

    await run(`
        INSERT INTO monthly_report_snapshots (
            id, tool_key, topic_key, month, name, created_at, updated_at, summary_json, payload_json
        )
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            tool_key = excluded.tool_key,
            topic_key = excluded.topic_key,
            month = excluded.month,
            name = excluded.name,
            updated_at = CURRENT_TIMESTAMP,
            summary_json = excluded.summary_json,
            payload_json = excluded.payload_json
    `, [snapId, tKey, String(topicKey || '').trim(), mStr, snapName, summaryJson, payloadJson]);

    return getSnapshot(snapId);
}

async function renameSnapshot(id, newName) {
    await ensureReady();
    const snapId = String(id || '').trim();
    const name = String(newName || '').trim();
    if (!snapId || !name) throw new Error('快照ID和新名称不能为空');

    const result = await run(`
        UPDATE monthly_report_snapshots
        SET name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [name, snapId]);

    if (!result || result.changes === 0) return null;
    return getSnapshot(snapId);
}

async function deleteSnapshot(id) {
    await ensureReady();
    const snapId = String(id || '').trim();
    if (!snapId) return false;

    const result = await run(`
        DELETE FROM monthly_report_snapshots
        WHERE id = ?
    `, [snapId]);

    return Boolean(result && result.changes > 0);
}

module.exports = {
    ensureReady,
    listSnapshots,
    getSnapshot,
    saveSnapshot,
    renameSnapshot,
    deleteSnapshot
};
