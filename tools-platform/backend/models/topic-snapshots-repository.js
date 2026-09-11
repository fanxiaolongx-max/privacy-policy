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
    const legacyRows = await all(`SELECT id, payload_json FROM topic_snapshots WHERE summary_json NOT LIKE '%"summaryVersion":2%'`);
    for (const row of legacyRows) {
        try {
            const snapshot = normalizeSnapshot(JSON.parse(row.payload_json));
            const summary = buildSummary(snapshot);
            await run('UPDATE topic_snapshots SET period_label = ?, summary_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [summary.period, JSON.stringify(summary), row.id]);
        } catch (error) {
            console.warn(`[topic-snapshots] Unable to upgrade summary for ${row.id}: ${error.message}`);
        }
    }
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

function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function ratePercent(value) {
    const parsed = number(value);
    return Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
}

function sumField(rows, field) {
    return (rows || []).reduce((sum, row) => sum + number(row?.[field]), 0);
}

function firstNumber(row, keys) {
    for (const key of keys) {
        const value = Number(row?.[key]);
        if (Number.isFinite(value)) return value;
    }
    return 0;
}

function buildEosTopic(rows, type, settings) {
    const grouped = new Map();
    const aliases = { 'NILE ON LINE (NOL)': 'Etisalat Misr' };
    for (const row of rows || []) {
        const customer = aliases[String(row?.customer_name || '').trim()] || String(row?.customer_name || '').trim() || '未分类客户';
        const productLine = String(row?.product_line_name || row?.product_line_map || '');
        const product = String(row?.product_name || '未命名产品');
        const label = type === 'product'
            ? String(row?.product_name || row?.product_code_name || row?.product_code || '未命名产品')
            : String(row?.software_version || row?.version_name || row?.product_name || '未命名版本');
        const key = [customer, productLine, type === 'product' ? String(row?.product_name || '') : product, label].join('|||');
        if (!grouped.has(key)) grouped.set(key, { quantity: 0, incorporated: 0, pending: 0 });
        const item = grouped.get(key);
        const quantity = firstNumber(row, ['incorporation_total_nes', 'annual_storage', 'capacities', 'current_inventory']);
        const normal = type === 'product'
            ? firstNumber(row, ['before_urgent_incorporated_nes_dtl', 'incorporated_nes'])
            : firstNumber(row, ['nc_urgent_incorp_complet_rate_dtl', 'incorporated_nes']);
        item.quantity += quantity;
        item.incorporated += quantity > 0 ? Math.min(quantity, normal + firstNumber(row, ['deactivated_nes'])) : normal;
        item.pending += firstNumber(row, ['to_be_incorporated_nes']);
    }
    const plans = settings?.eos?.plans?.[type] || {};
    const totals = [...grouped.entries()].reduce((result, [key, item]) => {
        const annualPlan = Math.min(item.pending, Math.max(0, Math.floor(number(plans[key]))));
        result.quantity += item.quantity; result.incorporated += item.incorporated; result.pending += item.pending;
        result.annualPlan += annualPlan; result.noPlan += Math.max(0, item.pending - annualPlan);
        return result;
    }, { quantity: 0, incorporated: 0, pending: 0, annualPlan: 0, noPlan: 0 });
    totals.currentRate = totals.quantity ? Math.min(totals.quantity, totals.incorporated) / totals.quantity * 100 : 0;
    totals.plannedRate = totals.quantity ? Math.min(totals.quantity, totals.incorporated + totals.annualPlan) / totals.quantity * 100 : 0;
    totals.targetRate = number(settings?.eos?.targets?.[type]);
    return totals;
}

function ytdRows(data, year) {
    return (data?.rows || []).filter(row => row?.scope === 'TOTAL' && number(row?.year) === number(year) && number(row?.month) <= number(data?.currentMonth));
}

function changeTopic(data) {
    const current = ytdRows(data, data?.currentYear); const previous = ytdRows(data, data?.previousYear);
    const taskCount = sumField(current, 'task_count'); const priorTaskCount = sumField(previous, 'task_count');
    const weightedBase = sumField(current, 'task_count');
    const operationSuccessRate = weightedBase
        ? current.reduce((sum, row) => sum + ratePercent(row?.operation_success_rate) * number(row?.task_count), 0) / weightedBase
        : 0;
    return { taskCount, priorTaskCount, yoyRate: priorTaskCount ? (taskCount - priorTaskCount) / priorTaskCount * 100 : 0, rollbackCount: sumField(current, 'rollback_count'), highRiskCount: sumField(current, 'high_core_total_count'), operationSuccessRate };
}

function interceptionTopic(data) {
    const current = ytdRows(data, data?.currentYear); const previous = ytdRows(data, data?.previousYear);
    const total = sumField(current, 'interception_cnt'); const priorTotal = sumField(previous, 'interception_cnt');
    return { total, priorTotal, yoyRate: priorTotal ? (total - priorTotal) / priorTotal * 100 : 0, commandCount: sumField(current, 'commands_interception_cnt'), graphicalCount: sumField(current, 'graphical_interception_cnt') };
}

function srTopic(data) {
    const current = (data?.summary || []).find(row => row?.scope === 'TOTAL' && row?.period === 'currentYtd') || {};
    const previous = (data?.summary || []).find(row => row?.scope === 'TOTAL' && row?.period === 'previousYtd') || {};
    const total = number(current.sr_total); const priorTotal = number(previous.sr_total);
    return {
        total, priorTotal, yoyRate: priorTotal ? (total - priorTotal) / priorTotal * 100 : 0,
        frtRate: ratePercent(current.sr_frt), openCount: number(current.unclose_sr_cnt), overdueCount: number(current.overdue_sr_cnt),
        minorCount: number(current.minor_sr_cnt), majorCount: number(current.major_sr_cnt), criticalCount: number(current.critical_sr_cnt)
    };
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
        const certificateTotal = sumField(data.certificate, 'need_reduce_cnt');
        const certificateReduced = sumField(data.certificate, 'reduced_cnt');
        return {
            summaryVersion: 2,
            period: srYear ? `${srYear}${srMonth ? `-${String(srMonth).padStart(2, '0')}` : ''}` : '',
            totalRows: Object.values(metrics).reduce((sum, value) => sum + value, 0),
            metrics,
            topics: {
                certificate: { total: certificateTotal, reduced: certificateReduced, pending: Math.max(0, certificateTotal - certificateReduced), completionRate: certificateTotal ? certificateReduced / certificateTotal * 100 : 0 },
                eosProduct: buildEosTopic(data.eosProduct, 'product', snapshot.settings),
                eosVersion: buildEosTopic(data.eosVersion, 'version', snapshot.settings),
                change: changeTopic(data.change),
                interception: interceptionTopic(data.interception),
                sr: srTopic(data.sr)
            }
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
        selectedRequired: number(selected.required ?? selected.needReturn ?? selected.shouldReturn),
        selectedReturned: number(selected.returned ?? selected.actualReturn),
        selectedRecorded: number(selected.recorded ?? selected.actualRecord)
    };
    const year = Number(snapshot.settings?.year) || '';
    return {
        summaryVersion: 2,
        period: year ? `${year}${month ? `-${String(month).padStart(2, '0')}` : ''}` : '',
        totalRows: metrics.monthlySummaries + metrics.rawRows,
        metrics,
        topics: {
            return: {
                required: metrics.selectedRequired, returned: metrics.selectedReturned,
                pending: number(selected.pending) || Math.max(0, metrics.selectedRequired - metrics.selectedReturned),
                returnRate: number(selected.returnRate) || (metrics.selectedRequired ? metrics.selectedReturned / metrics.selectedRequired * 100 : 0),
                targetRate: number(snapshot.settings?.targets?.returnRate)
            },
            filing: {
                required: metrics.selectedRequired, recorded: metrics.selectedRecorded,
                recordRate: number(selected.recordRate) || (metrics.selectedRequired ? metrics.selectedRecorded / metrics.selectedRequired * 100 : 0),
                limitRate: number(snapshot.settings?.targets?.recordRate), rawRows
            }
        }
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
            period_label = excluded.period_label,
            summary_json = excluded.summary_json,
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
