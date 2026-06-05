const { readJSON, writeJSON } = require('./store');
const { run, get, all } = require('./app-db');

const SNAPSHOTS_FILE = 'sla_snapshots.json';
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
    await run('DELETE FROM sla_snapshots');
    for (const item of items) {
        await run(
            `INSERT INTO sla_snapshots (id, timestamp, payload_json, updated_at)
             VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
            [
                item.id,
                item.timestamp || '',
                JSON.stringify(item)
            ]
        );
    }
}

async function ensureReady() {
    if (!initPromise) {
        initPromise = (async () => {
            await run(`
                CREATE TABLE IF NOT EXISTS sla_snapshots (
                    id TEXT PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            const row = await get('SELECT COUNT(1) AS count FROM sla_snapshots');
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
        FROM sla_snapshots
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
        `INSERT INTO sla_snapshots (id, timestamp, payload_json, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET
            timestamp = excluded.timestamp,
            payload_json = excluded.payload_json,
            updated_at = CURRENT_TIMESTAMP`,
        [item.id, item.timestamp || '', JSON.stringify(item)]
    );
}

async function trimDbSnapshots() {
    await ensureReady();
    await run(`
        DELETE FROM sla_snapshots
        WHERE id NOT IN (
            SELECT id
            FROM sla_snapshots
            ORDER BY timestamp DESC, id DESC
            LIMIT ?
        )
    `, [MAX_SNAPSHOTS]);
}

async function addSnapshot(payload) {
    const snapshots = readSnapshotsFromJson();
    const item = { id: Date.now().toString(36), ...payload };
    snapshots.unshift(item);
    writeSnapshotsToJson(snapshots);

    try {
        await upsertSnapshotInDb(item);
        await trimDbSnapshots();
    } catch (err) {
        console.error('[sla-snapshots] SQLite dual-write failed:', err.message);
    }

    return item;
}

async function deleteSnapshot(id) {
    const snapshots = writeSnapshotsToJson(readSnapshotsFromJson().filter(item => item.id !== id));
    try {
        await ensureReady();
        await run('DELETE FROM sla_snapshots WHERE id = ?', [id]);
    } catch (err) {
        console.error('[sla-snapshots] SQLite delete sync failed:', err.message);
    }
    return snapshots;
}

async function updateSnapshot(id, patch) {
    const snapshots = readSnapshotsFromJson();
    const idx = snapshots.findIndex(item => item.id === id);
    if (idx === -1) return null;

    snapshots[idx] = { ...snapshots[idx], ...patch };
    writeSnapshotsToJson(snapshots);

    try {
        await upsertSnapshotInDb(snapshots[idx]);
    } catch (err) {
        console.error('[sla-snapshots] SQLite update sync failed:', err.message);
    }

    return snapshots[idx];
}

async function replaceSnapshots(items) {
    const normalized = writeSnapshotsToJson(items);
    try {
        await ensureReady();
        await replaceSnapshotsInDbRaw(normalized);
    } catch (err) {
        console.error('[sla-snapshots] SQLite replace sync failed:', err.message);
    }
    return normalized;
}

function getSnapshotTime(item) {
    const time = Date.parse(item && item.timestamp);
    return Number.isFinite(time) ? time : 0;
}

function getSnapshotDateKey(item) {
    const time = getSnapshotTime(item);
    if (!time) return '';
    return new Date(time).toISOString().slice(0, 10);
}

async function cleanupRedundantDailySnapshots({ days = 30, dryRun = false } = {}) {
    const safeDays = Math.max(1, Math.min(3650, parseInt(days, 10) || 30));
    const cutoffTime = Date.now() - safeDays * 24 * 60 * 60 * 1000;
    const { items, source } = await listSnapshots({ mode: 'auto' });
    const snapshots = normalizeSnapshots(items);
    const latestByDate = new Map();

    snapshots.forEach(item => {
        const time = getSnapshotTime(item);
        if (!time || time < cutoffTime) return;
        const key = getSnapshotDateKey(item);
        const current = latestByDate.get(key);
        if (!current || getSnapshotTime(item) > getSnapshotTime(current)) {
            latestByDate.set(key, item);
        }
    });

    const keepIds = new Set(Array.from(latestByDate.values()).map(item => item.id));
    const removed = [];
    const kept = [];

    snapshots.forEach(item => {
        const time = getSnapshotTime(item);
        if (!time || time < cutoffTime || keepIds.has(item.id)) {
            kept.push(item);
        } else {
            removed.push({
                id: item.id,
                timestamp: item.timestamp,
                date: getSnapshotDateKey(item)
            });
        }
    });

    kept.sort((a, b) => getSnapshotTime(b) - getSnapshotTime(a) || String(b.id || '').localeCompare(String(a.id || '')));

    if (!dryRun && removed.length) {
        await replaceSnapshots(kept);
    }

    return {
        source,
        dryRun: Boolean(dryRun),
        days: safeDays,
        cutoff: new Date(cutoffTime).toISOString(),
        beforeCount: snapshots.length,
        afterCount: kept.length,
        removedCount: removed.length,
        keptDailyCount: latestByDate.size,
        removed
    };
}

module.exports = {
    MAX_SNAPSHOTS,
    ensureReady,
    listSnapshots,
    addSnapshot,
    deleteSnapshot,
    updateSnapshot,
    replaceSnapshots,
    cleanupRedundantDailySnapshots
};
