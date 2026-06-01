const { readJSON, writeJSON } = require('./store');
const { run, get, all } = require('./app-db');

const SNAPSHOTS_FILE = 'frt_snapshots.json';
const MAX_SNAPSHOTS = 50;

let initPromise = null;

function normalizeSnapshots(items) {
    return Array.isArray(items) ? items : [];
}

function readSnapshotsFromJson() {
    return normalizeSnapshots(readJSON(SNAPSHOTS_FILE, []));
}

function writeSnapshotsToJson(items) {
    const normalized = normalizeSnapshots(items).slice(0, MAX_SNAPSHOTS);
    writeJSON(SNAPSHOTS_FILE, normalized);
    return normalized;
}

async function replaceSnapshotsInDbRaw(items) {
    await run('DELETE FROM frt_snapshots');
    for (const item of items) {
        await run(
            `INSERT INTO frt_snapshots (id, timestamp, month, payload_json, updated_at)
             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
                item.id,
                item.timestamp || '',
                item.month || '',
                JSON.stringify(item)
            ]
        );
    }
}

async function ensureReady() {
    if (!initPromise) {
        initPromise = (async () => {
            await run(`
                CREATE TABLE IF NOT EXISTS frt_snapshots (
                    id TEXT PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    month TEXT,
                    payload_json TEXT NOT NULL,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            const row = await get('SELECT COUNT(1) AS count FROM frt_snapshots');
            if (row && row.count > 0) return;

            const snapshots = readSnapshotsFromJson();
            if (snapshots.length === 0) return;
            await replaceSnapshotsInDbRaw(snapshots);
        })().catch(err => {
            initPromise = null;
            throw err;
        });
    }

    return initPromise;
}

async function listFromDb() {
    await ensureReady();
    const rows = await all(`
        SELECT payload_json
        FROM frt_snapshots
        ORDER BY timestamp DESC, id DESC
    `);
    return rows.map(row => JSON.parse(row.payload_json));
}

async function listSnapshots({ mode = 'auto' } = {}) {
    const normalizedMode = String(mode || 'auto').toLowerCase();
    if (normalizedMode === 'json') {
        return { items: readSnapshotsFromJson(), source: 'json' };
    }
    if (normalizedMode === 'sqlite' || normalizedMode === 'db') {
        return { items: await listFromDb(), source: 'sqlite' };
    }

    try {
        const dbItems = await listFromDb();
        if (dbItems && dbItems.length > 0) {
            return { items: dbItems, source: 'sqlite' };
        }
    } catch (err) {}

    const jsonSnapshots = readSnapshotsFromJson();
    if (jsonSnapshots.length > 0) {
        return { items: jsonSnapshots, source: 'json' };
    }

    return { items: await listFromDb(), source: 'sqlite' };
}

async function upsertSnapshotInDb(item) {
    await ensureReady();
    await run(
        `INSERT INTO frt_snapshots (id, timestamp, month, payload_json, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET
            timestamp = excluded.timestamp,
            month = excluded.month,
            payload_json = excluded.payload_json,
            updated_at = CURRENT_TIMESTAMP`,
        [item.id, item.timestamp || '', item.month || '', JSON.stringify(item)]
    );
}

async function trimDbSnapshots() {
    await ensureReady();
    await run(`
        DELETE FROM frt_snapshots
        WHERE id NOT IN (
            SELECT id
            FROM frt_snapshots
            ORDER BY timestamp DESC, id DESC
            LIMIT ?
        )
    `, [MAX_SNAPSHOTS]);
}

async function addSnapshot(payload) {
    const snapshots = readSnapshotsFromJson();
    const item = { id: Date.now().toString(36), timestamp: new Date().toISOString(), ...payload };
    snapshots.unshift(item);
    writeSnapshotsToJson(snapshots);

    try {
        await upsertSnapshotInDb(item);
        await trimDbSnapshots();
    } catch (err) {
        console.error('[frt-snapshots] SQLite dual-write failed:', err.message);
    }

    return item;
}

async function deleteSnapshot(id) {
    const snapshots = writeSnapshotsToJson(readSnapshotsFromJson().filter(item => item.id !== id));
    try {
        await ensureReady();
        await run('DELETE FROM frt_snapshots WHERE id = ?', [id]);
    } catch (err) {
        console.error('[frt-snapshots] SQLite delete sync failed:', err.message);
    }
    return snapshots;
}

module.exports = {
    MAX_SNAPSHOTS,
    ensureReady,
    listSnapshots,
    addSnapshot,
    deleteSnapshot
};
