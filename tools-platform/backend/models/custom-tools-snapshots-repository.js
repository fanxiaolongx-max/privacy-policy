const { run, get, all } = require('./app-db');

const MAX_SNAPSHOTS_PER_TOOL = 100;

let initPromise = null;

async function ensureReady() {
    if (!initPromise) {
        initPromise = (async () => {
            await run(`
                CREATE TABLE IF NOT EXISTS custom_tools_snapshots (
                    id TEXT PRIMARY KEY,
                    tool_slug TEXT NOT NULL,
                    name TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    summary_json TEXT,
                    payload_json TEXT NOT NULL,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await run(`
                CREATE INDEX IF NOT EXISTS idx_custom_tools_snapshots_slug
                ON custom_tools_snapshots(tool_slug, timestamp DESC)
            `);
        })().catch(err => {
            initPromise = null;
            throw err;
        });
    }
    return initPromise;
}

function parseSummary(summaryJson) {
    if (!summaryJson) return {};
    try {
        return JSON.parse(summaryJson);
    } catch (_) {
        return {};
    }
}

function parsePayload(payloadJson) {
    if (!payloadJson) return {};
    try {
        return JSON.parse(payloadJson);
    } catch (_) {
        return {};
    }
}

async function listSnapshots(toolSlug, options = {}) {
    await ensureReady();
    const slug = String(toolSlug || '').trim();
    if (!slug) return [];

    const includePayload = options.includePayload === true;
    let query = `
        SELECT id, tool_slug, name, timestamp, summary_json, updated_at
        ${includePayload ? ', payload_json' : ''}
        FROM custom_tools_snapshots
        WHERE tool_slug = ?
        ORDER BY timestamp DESC, id DESC
    `;
    const rows = await all(query, [slug]);
    return rows.map(row => {
        const item = {
            id: row.id,
            toolSlug: row.tool_slug,
            name: row.name,
            timestamp: row.timestamp,
            summary: parseSummary(row.summary_json),
            updatedAt: row.updated_at
        };
        if (includePayload) {
            item.payload = parsePayload(row.payload_json);
        }
        return item;
    });
}

async function getSnapshot(toolSlug, id) {
    await ensureReady();
    const slug = String(toolSlug || '').trim();
    const snapId = String(id || '').trim();
    if (!slug || !snapId) return null;

    const row = await get(`
        SELECT id, tool_slug, name, timestamp, summary_json, payload_json, updated_at
        FROM custom_tools_snapshots
        WHERE tool_slug = ? AND id = ?
    `, [slug, snapId]);

    if (!row) return null;

    return {
        id: row.id,
        toolSlug: row.tool_slug,
        name: row.name,
        timestamp: row.timestamp,
        summary: parseSummary(row.summary_json),
        payload: parsePayload(row.payload_json),
        updatedAt: row.updated_at
    };
}

async function addSnapshot(toolSlug, data = {}) {
    await ensureReady();
    const slug = String(toolSlug || '').trim();
    if (!slug) throw new Error('toolSlug is required');

    const id = data.id || `snap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const name = String(data.name || '').trim() || `快照 ${new Date().toLocaleString('zh-CN')}`;
    const timestamp = data.timestamp || new Date().toISOString();
    const summaryJson = JSON.stringify(data.summary || {});
    const payloadJson = JSON.stringify(data.payload || {});

    await run(`
        INSERT INTO custom_tools_snapshots (id, tool_slug, name, timestamp, summary_json, payload_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            timestamp = excluded.timestamp,
            summary_json = excluded.summary_json,
            payload_json = excluded.payload_json,
            updated_at = CURRENT_TIMESTAMP
    `, [id, slug, name, timestamp, summaryJson, payloadJson]);

    // Trim old snapshots if exceeds MAX
    await run(`
        DELETE FROM custom_tools_snapshots
        WHERE tool_slug = ? AND id NOT IN (
            SELECT id
            FROM custom_tools_snapshots
            WHERE tool_slug = ?
            ORDER BY timestamp DESC, id DESC
            LIMIT ?
        )
    `, [slug, slug, MAX_SNAPSHOTS_PER_TOOL]);

    return {
        id,
        toolSlug: slug,
        name,
        timestamp,
        summary: data.summary || {},
        updatedAt: new Date().toISOString()
    };
}

async function updateSnapshotName(toolSlug, id, newName) {
    await ensureReady();
    const slug = String(toolSlug || '').trim();
    const snapId = String(id || '').trim();
    const name = String(newName || '').trim();
    if (!slug || !snapId || !name) throw new Error('Invalid arguments for updateSnapshotName');

    const res = await run(`
        UPDATE custom_tools_snapshots
        SET name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE tool_slug = ? AND id = ?
    `, [name, slug, snapId]);

    if (res.changes === 0) return null;

    return getSnapshot(slug, snapId);
}

async function deleteSnapshot(toolSlug, id) {
    await ensureReady();
    const slug = String(toolSlug || '').trim();
    const snapId = String(id || '').trim();
    if (!slug || !snapId) return false;

    const res = await run(`
        DELETE FROM custom_tools_snapshots
        WHERE tool_slug = ? AND id = ?
    `, [slug, snapId]);

    return res.changes > 0;
}

module.exports = {
    ensureReady,
    listSnapshots,
    getSnapshot,
    addSnapshot,
    updateSnapshotName,
    deleteSnapshot
};
