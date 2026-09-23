const { run, get, all, getDbPath } = require('./app-db');

const initPromises = new Map();

async function ensureReady() {
    const key = getDbPath();
    if (!initPromises.has(key)) {
        const task = (async () => {
            await run(`
                CREATE TABLE IF NOT EXISTS operation_incentive_snapshots (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    period TEXT DEFAULT '',
                    source_file TEXT DEFAULT '',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    summary_json TEXT,
                    payload_json TEXT NOT NULL
                )
            `);
            await run(`
                CREATE INDEX IF NOT EXISTS idx_operation_incentive_snapshots_lookup
                ON operation_incentive_snapshots(period DESC, updated_at DESC)
            `);
        })().catch(err => {
            initPromises.delete(key);
            throw err;
        });
        initPromises.set(key, task);
    }
    return initPromises.get(key);
}

function parseJson(str, fallback = {}) {
    if (!str) return fallback;
    try {
        return JSON.parse(str);
    } catch (_) {
        return fallback;
    }
}
async function listSnapshots({ search, period, startDate, endDate, includePayload = false, full = false } = {}) {
    await ensureReady();
    const conditions = [];
    const params = [];
    const withPayload = Boolean(includePayload || full);
    if (search) {
        const query = `%${String(search).trim()}%`;
        conditions.push('(title LIKE ? OR period LIKE ? OR source_file LIKE ? OR id LIKE ?)');
        params.push(query, query, query, query);
    }
    if (period) {
        conditions.push('period LIKE ?');
        params.push(`%${String(period).trim()}%`);
    }
    if (startDate) {
        conditions.push('period >= ?');
        params.push(String(startDate).trim());
    }
    if (endDate) {
        conditions.push('period <= ?');
        params.push(String(endDate).trim());
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
        SELECT id, title, period, source_file, created_at, updated_at, summary_json
        ${withPayload ? ', payload_json' : ''}
        FROM operation_incentive_snapshots
        ${whereClause}
        ORDER BY period DESC, updated_at DESC, id DESC
    `;

    const rows = await all(query, params);
    return rows.map(row => {
        const item = {
            id: row.id,
            title: row.title,
            period: row.period,
            sourceFile: row.source_file,
            source_file: row.source_file,
            createdAt: row.created_at,
            created_at: row.created_at,
            updatedAt: row.updated_at,
            updated_at: row.updated_at,
            summary: parseJson(row.summary_json, {})
        };
        if (withPayload) {
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
        SELECT id, title, period, source_file, created_at, updated_at, summary_json, payload_json
        FROM operation_incentive_snapshots
        WHERE id = ?
    `, [snapId]);

    if (!row) return null;

    return {
        id: row.id,
        title: row.title,
        period: row.period,
        sourceFile: row.source_file,
        source_file: row.source_file,
        createdAt: row.created_at,
        created_at: row.created_at,
        updatedAt: row.updated_at,
        updated_at: row.updated_at,
        summary: parseJson(row.summary_json, {}),
        payload: parseJson(row.payload_json, null)
    };
}

async function saveSnapshot({ id, title, period, sourceFile, summary = {}, payload = {} }) {
    await ensureReady();
    const periodStr = String(period || '').trim() || new Date().toISOString().slice(0, 7);
    const snapId = String(id || '').trim() || `inc_${periodStr.replace(/[^0-9a-zA-Z]/g, '')}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const snapTitle = String(title || '').trim() || `${periodStr} 操作激励核算快照`;
    const sourceFileName = String(sourceFile || payload?.sourceFileName || '').trim();

    const summaryJson = JSON.stringify(summary || {});
    const payloadJson = JSON.stringify(payload || {});

    await run(`
        INSERT INTO operation_incentive_snapshots (
            id, title, period, source_file, created_at, updated_at, summary_json, payload_json
        ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            period = excluded.period,
            source_file = excluded.source_file,
            summary_json = excluded.summary_json,
            payload_json = excluded.payload_json,
            updated_at = CURRENT_TIMESTAMP
    `, [snapId, snapTitle, periodStr, sourceFileName, summaryJson, payloadJson]);

    return getSnapshot(snapId);
}

async function renameSnapshot(id, newTitle) {
    await ensureReady();
    const snapId = String(id || '').trim();
    const title = String(newTitle || '').trim();
    if (!snapId || !title) return null;

    await run(`
        UPDATE operation_incentive_snapshots
        SET title = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [title, snapId]);

    return getSnapshot(snapId);
}

async function deleteSnapshot(id) {
    await ensureReady();
    const snapId = String(id || '').trim();
    if (!snapId) return false;

    const result = await run(`
        DELETE FROM operation_incentive_snapshots
        WHERE id = ?
    `, [snapId]);

    return (result?.changes || 0) > 0;
}

function extractNameFromFullname(raw, id) {
    if (!raw) return '';
    const str = String(raw).trim();
    if (!str) return '';
    if (id) {
        const normId = String(id).trim().toLowerCase();
        const parts = str.split(/\s+/).filter(Boolean);
        const filtered = parts.filter(p => p.toLowerCase() !== normId && (!normId.startsWith('u') || p.toLowerCase() !== normId.slice(1)));
        if (filtered.length > 0) return filtered.join(' ');
    }
    const m = str.match(/^([^\s(/]+)/);
    return m ? m[1] : str;
}

async function extractRoster() {
    await ensureReady();
    const snapshots = await listSnapshots({ includePayload: true });
    const rosterMap = new Map();

    for (const snap of snapshots) {
        try {
            const period = snap.period || '';
            const title = snap.title || '';
            const sourceLabel = `操作激励快照: ${period || title}`;
            const rawRows = Array.isArray(snap.payload?.rawRows) ? snap.payload.rawRows : [];

            if (rawRows.length > 0) {
                for (const r of rawRows) {
                    const rawId = String(
                        r.__person || r.complete_operator || r['方案实施人工号'] || 
                        r['操作人工号'] || r.solution_develop_name || r['操作人'] || 
                        r.operator || r.account || r.staffId || r.id || ''
                    ).trim();
                    if (!rawId) continue;

                    let parsedId = rawId;
                    let parsedName = String(r.__name || r.name || r['方案实施人姓名'] || r['操作人姓名'] || '').trim();

                    const m1 = rawId.match(/^(.*?)\s*[(（]([A-Za-z0-9_-]+)[)）]$/);
                    if (m1) {
                        if (!parsedName) parsedName = m1[1].trim();
                        parsedId = m1[2].trim();
                    } else {
                        const m2 = rawId.match(/^([A-Za-z0-9_-]+)\s*[(（](.*?)[)）]$/);
                        if (m2) {
                            parsedId = m2[1].trim();
                            if (!parsedName) parsedName = m2[2].trim();
                        }
                    }

                    if (!parsedName) {
                        const full = r.full_name || r['方案实施人'] || r['操作人'] || r.fme_fullname;
                        parsedName = extractNameFromFullname(full, parsedId);
                    }

                    const bu = String(r.__bu || r.bu || r.BU || r.BU1 || r['部门'] || r.department || '').trim();
                    const customerGroup = String(
                        r.__customer || r.customer || r.customer_office || r['客户名称'] || 
                        r['客户'] || r['客户群'] || r.customerGroup || r.customerName || ''
                    ).trim();
                    const role = String(
                        r.__role || r.role || r['角色'] || r['实施人角色'] || 
                        (r.__fmePerson ? 'FME' : '') || r['方案实施人属性'] || r['人员属性'] || 'FME'
                    ).trim();

                    const key = parsedId ? parsedId.toLowerCase() : (parsedName ? parsedName.toLowerCase() : '');
                    if (!key) continue;

                    if (!rosterMap.has(key)) {
                        rosterMap.set(key, {
                            id: parsedId || parsedName,
                            staffId: parsedId || '',
                            name: parsedName || parsedId,
                            bu,
                            businessUnit: bu,
                            customerGroup,
                            role,
                            source: 'incentive',
                            sourceType: 'incentive',
                            snapshotTitle: title,
                            snapshotTitles: title ? [title] : [],
                            snapshotPeriod: period
                        });
                    } else {
                        const existing = rosterMap.get(key);
                        if (!existing.name && parsedName) existing.name = parsedName;
                        if (!existing.staffId && parsedId) existing.staffId = parsedId;
                        if (!existing.bu && bu) { existing.bu = bu; existing.businessUnit = bu; }
                        if (!existing.customerGroup && customerGroup) existing.customerGroup = customerGroup;
                        if ((!existing.role || existing.role === 'STAFF') && role) existing.role = role;
                        if (title && !existing.snapshotTitles.includes(title)) existing.snapshotTitles.push(title);
                    }
                }
            } else if (Array.isArray(snap.summary?.topPeople)) {
                for (const p of snap.summary.topPeople) {
                    const rawPerson = String(p.person || p.account || p.name || '').trim();
                    if (!rawPerson) continue;

                    let parsedId = rawPerson;
                    let parsedName = String(p.name || '').trim();
                    const m1 = rawPerson.match(/^(.*?)\s*[(（]([A-Za-z0-9_-]+)[)）]$/);
                    if (m1) {
                        if (!parsedName) parsedName = m1[1].trim();
                        parsedId = m1[2].trim();
                    }

                    const bu = String(p.bu || '').trim();
                    const customerGroup = String(p.customerGroup || p.customer || p.customer_office || p.group || '').trim();
                    const role = String(p.role || 'FME').trim();
                    const key = parsedId ? parsedId.toLowerCase() : (parsedName ? parsedName.toLowerCase() : '');
                    if (!key) continue;

                    if (!rosterMap.has(key)) {
                        rosterMap.set(key, {
                            id: parsedId || parsedName,
                            staffId: parsedId || '',
                            name: parsedName || parsedId,
                            bu,
                            businessUnit: bu,
                            customerGroup,
                            role,
                            source: 'incentive',
                            sourceType: 'incentive',
                            snapshotTitle: title,
                            snapshotTitles: title ? [title] : [],
                            snapshotPeriod: period
                        });
                    } else {
                        const existing = rosterMap.get(key);
                        if (!existing.name && parsedName) existing.name = parsedName;
                        if (!existing.staffId && parsedId) existing.staffId = parsedId;
                        if (!existing.bu && bu) { existing.bu = bu; existing.businessUnit = bu; }
                        if (!existing.customerGroup && customerGroup) existing.customerGroup = customerGroup;
                        if ((!existing.role || existing.role === 'STAFF') && role) existing.role = role;
                        if (title && !existing.snapshotTitles.includes(title)) existing.snapshotTitles.push(title);
                    }
                }
            }
        } catch (err) {
            console.warn('[operation-incentive-snapshots] extractRoster error in snapshot:', snap?.id, err?.message);
        }
    }

    return [...rosterMap.values()].sort((a, b) => (a.id || '').localeCompare(b.id || ''));
}

module.exports = {
    ensureReady,
    listSnapshots,
    getSnapshot,
    saveSnapshot,
    renameSnapshot,
    deleteSnapshot,
    extractRoster
};
