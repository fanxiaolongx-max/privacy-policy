const crypto = require('crypto');
const { run, get, all } = require('./app-db');

const SNAPSHOT_SCHEMA = 'uivf12-topic-snapshot';
const SNAPSHOT_VERSION = 1;
const SUPPORTED_PLATFORMS = new Set(['netcare', 'datafab']);
const MAX_PAYLOAD_BYTES = 45 * 1024 * 1024;

function topicSnapshotError(message, status = 400, code = 'INVALID_TOPIC_SNAPSHOT') {
    const error = new Error(message);
    error.status = status;
    error.code = code;
    return error;
}

async function ensureReady() {
    // Deliberately idempotent: app-db resolves the active tenant at call time.
    await run(`
        CREATE TABLE IF NOT EXISTS topic_snapshots (
            id TEXT PRIMARY KEY,
            platform TEXT NOT NULL,
            name TEXT NOT NULL DEFAULT '',
            captured_at TEXT NOT NULL,
            exported_at TEXT NOT NULL,
            imported_at TEXT NOT NULL,
            content_hash TEXT NOT NULL,
            period_label TEXT NOT NULL DEFAULT '',
            summary_json TEXT NOT NULL DEFAULT '{}',
            payload_json TEXT NOT NULL,
            payload_bytes INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_topic_snapshots_platform_hash ON topic_snapshots(platform, content_hash)');
    await run('CREATE INDEX IF NOT EXISTS idx_topic_snapshots_captured ON topic_snapshots(platform, captured_at DESC)');
}

function validIsoTime(value, fallback) {
    const date = new Date(value || '');
    return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function normalizeSnapshot(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw topicSnapshotError('缺少专题快照数据');
    if (input.schema !== SNAPSHOT_SCHEMA || Number(input.version) !== SNAPSHOT_VERSION) throw topicSnapshotError('不支持的专题快照格式');
    const platform = String(input.platform || '').toLowerCase();
    if (!SUPPORTED_PLATFORMS.has(platform)) throw topicSnapshotError('不支持的专题平台');
    if (!input.data || typeof input.data !== 'object' || Array.isArray(input.data)) throw topicSnapshotError('专题快照缺少 data');
    if (platform === 'netcare') {
        const data = input.data;
        if (![data.certificate, data.eosProduct, data.eosVersion].every(Array.isArray)
            || !Array.isArray(data.change?.rows) || !Array.isArray(data.interception?.rows)
            || !Array.isArray(data.sr?.summary) || !Array.isArray(data.sr?.monthly)) {
            throw topicSnapshotError('NetCare 专题快照数据结构不完整');
        }
    } else if (!Array.isArray(input.data.months) || !Array.isArray(input.data.detail)) {
        throw topicSnapshotError('DataFab 专题快照数据结构不完整');
    }
    const now = new Date().toISOString();
    return {
        ...input,
        schema: SNAPSHOT_SCHEMA,
        version: SNAPSHOT_VERSION,
        platform,
        capturedAt: validIsoTime(input.capturedAt, validIsoTime(input.exportedAt, now)),
        exportedAt: validIsoTime(input.exportedAt, now),
        scope: input.scope && typeof input.scope === 'object' && !Array.isArray(input.scope) ? input.scope : {},
        settings: input.settings && typeof input.settings === 'object' && !Array.isArray(input.settings) ? input.settings : {}
    };
}

function rowCount(value) {
    return Array.isArray(value) ? value.length : 0;
}

function buildSummary(snapshot) {
    if (snapshot.platform === 'netcare') {
        const data = snapshot.data;
        const metrics = {
            certificates: rowCount(data.certificate),
            eosProductRows: rowCount(data.eosProduct),
            eosVersionRows: rowCount(data.eosVersion),
            changeRows: rowCount(data.change?.rows),
            interceptionRows: rowCount(data.interception?.rows),
            srSummaryRows: rowCount(data.sr?.summary),
            srMonthlyRows: rowCount(data.sr?.monthly)
        };
        const srYear = data.sr?.currentYear || snapshot.settings?.year || '';
        const srMonth = data.sr?.currentMonth || snapshot.settings?.month || '';
        return {
            period: srYear ? `${srYear}${srMonth ? `-${String(srMonth).padStart(2, '0')}` : ''}` : '',
            totalRows: Object.values(metrics).reduce((sum, value) => sum + value, 0),
            metrics
        };
    }

    const data = snapshot.data;
    const detailsByMonth = data.detailsByMonth && typeof data.detailsByMonth === 'object' ? data.detailsByMonth : {};
    const rawRows = Object.values(detailsByMonth).reduce((sum, rows) => sum + rowCount(rows), 0) || rowCount(data.detail);
    const month = Number(snapshot.settings?.month) || 0;
    const selected = data.months.find(item => Number(item?.month) === month) || {};
    const metrics = {
        monthlySummaries: rowCount(data.months),
        rawRows,
        selectedRequired: Number(selected.required ?? selected.needReturn ?? selected.shouldReturn ?? 0) || 0,
        selectedReturned: Number(selected.returned ?? selected.actualReturn ?? 0) || 0,
        selectedRecorded: Number(selected.recorded ?? selected.actualRecord ?? 0) || 0
    };
    const year = Number(snapshot.settings?.year) || '';
    return {
        period: year ? `${year}${month ? `-${String(month).padStart(2, '0')}` : ''}` : '',
        totalRows: metrics.monthlySummaries + metrics.rawRows,
        metrics
    };
}

function parseJson(value, fallback = {}) {
    try { return JSON.parse(value); } catch (_error) { return fallback; }
}

function metadataFromRow(row) {
    return {
        id: row.id,
        platform: row.platform,
        name: row.name || '',
        capturedAt: row.captured_at,
        exportedAt: row.exported_at,
        importedAt: row.imported_at,
        period: row.period_label || '',
        summary: parseJson(row.summary_json),
        payloadBytes: Number(row.payload_bytes) || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

async function saveSnapshot(input, options = {}) {
    await ensureReady();
    const snapshot = normalizeSnapshot(input);
    const payloadJson = JSON.stringify(snapshot);
    const payloadBytes = Buffer.byteLength(payloadJson, 'utf8');
    if (payloadBytes > MAX_PAYLOAD_BYTES) throw topicSnapshotError('专题快照超过 45MB 上限', 413, 'TOPIC_SNAPSHOT_TOO_LARGE');
    const stablePayload = JSON.stringify({ platform: snapshot.platform, capturedAt: snapshot.capturedAt, scope: snapshot.scope, settings: snapshot.settings, data: snapshot.data });
    const contentHash = crypto.createHash('sha256').update(stablePayload).digest('hex');
    const importedAt = new Date().toISOString();
    const summary = buildSummary(snapshot);
    const id = `topic_${Date.now().toString(36)}_${crypto.randomBytes(5).toString('hex')}`;
    const name = String(options.name || '').trim().slice(0, 120);
    const result = await run(
        `INSERT INTO topic_snapshots
            (id, platform, name, captured_at, exported_at, imported_at, content_hash, period_label, summary_json, payload_json, payload_bytes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(platform, content_hash) DO UPDATE SET
            name = CASE WHEN excluded.name <> '' THEN excluded.name ELSE topic_snapshots.name END,
            imported_at = excluded.imported_at,
            exported_at = excluded.exported_at,
            payload_json = excluded.payload_json,
            payload_bytes = excluded.payload_bytes,
            updated_at = CURRENT_TIMESTAMP`,
        [id, snapshot.platform, name, snapshot.capturedAt, snapshot.exportedAt, importedAt, contentHash, summary.period, JSON.stringify(summary), payloadJson, payloadBytes]
    );
    const row = await get('SELECT * FROM topic_snapshots WHERE platform = ? AND content_hash = ?', [snapshot.platform, contentHash]);
    return { item: metadataFromRow(row), created: result.changes > 0 && row.id === id };
}

async function listSnapshots(options = {}) {
    await ensureReady();
    const platform = String(options.platform || '').toLowerCase();
    if (platform && !SUPPORTED_PLATFORMS.has(platform)) throw topicSnapshotError('不支持的专题平台');
    const limit = Math.min(200, Math.max(1, Number(options.limit) || 50));
    const offset = Math.max(0, Number(options.offset) || 0);
    const where = platform ? 'WHERE platform = ?' : '';
    const params = platform ? [platform] : [];
    const [rows, count] = await Promise.all([
        all(`SELECT * FROM topic_snapshots ${where} ORDER BY captured_at DESC, imported_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]),
        get(`SELECT COUNT(1) AS count FROM topic_snapshots ${where}`, params)
    ]);
    return { items: rows.map(metadataFromRow), total: Number(count?.count) || 0, limit, offset };
}

async function getSnapshot(id) {
    await ensureReady();
    const row = await get('SELECT * FROM topic_snapshots WHERE id = ?', [String(id || '')]);
    return row ? { ...metadataFromRow(row), snapshot: parseJson(row.payload_json, null) } : null;
}

async function getLatestSnapshot(platform) {
    await ensureReady();
    const normalized = String(platform || '').toLowerCase();
    if (!SUPPORTED_PLATFORMS.has(normalized)) throw topicSnapshotError('请指定 netcare 或 datafab');
    const row = await get('SELECT * FROM topic_snapshots WHERE platform = ? ORDER BY captured_at DESC, imported_at DESC LIMIT 1', [normalized]);
    return row ? { ...metadataFromRow(row), snapshot: parseJson(row.payload_json, null) } : null;
}

async function getSeries(options = {}) {
    const result = await listSnapshots({ ...options, limit: Math.min(200, Math.max(1, Number(options.limit) || 200)), offset: 0 });
    return result.items.slice().sort((a, b) => String(a.capturedAt).localeCompare(String(b.capturedAt)));
}

async function deleteSnapshot(id) {
    await ensureReady();
    const result = await run('DELETE FROM topic_snapshots WHERE id = ?', [String(id || '')]);
    return result.changes > 0;
}

module.exports = {
    MAX_PAYLOAD_BYTES,
    SNAPSHOT_SCHEMA,
    SNAPSHOT_VERSION,
    SUPPORTED_PLATFORMS,
    buildSummary,
    deleteSnapshot,
    ensureReady,
    getLatestSnapshot,
    getSeries,
    getSnapshot,
    listSnapshots,
    normalizeSnapshot,
    saveSnapshot
};
