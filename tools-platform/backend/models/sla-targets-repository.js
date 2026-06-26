const { run, get, all } = require('./app-db');


let initPromise = null;

function normalizeTargets(items) {
    return items && typeof items === 'object' && !Array.isArray(items) ? items : {};
}

async function replaceTargetsInDbRaw(items) {
    const normalized = normalizeTargets(items);
    await run('BEGIN TRANSACTION');
    try {
        await run('DELETE FROM sla_targets');
        for (const [targetKey, payload] of Object.entries(normalized)) {
            const autoFill = payload.autoFill === undefined ? null : (payload.autoFill ? 1 : 0);
            const isPercent = payload.isPercent === undefined ? null : (payload.isPercent ? 1 : 0);
            const exceedBy = payload.exceedBy === undefined ? null : payload.exceedBy;
            const bonus = payload.bonus === undefined ? null : payload.bonus;
            const weight = payload.weight === undefined ? null : payload.weight;
            const type = payload.type === undefined ? null : payload.type;
            const label = payload.label === undefined ? null : payload.label;
            
            const extraConfig = {};
            for (const [k, v] of Object.entries(payload || {})) {
                if (!['label', 'type', 'weight', 'autoFill', 'isPercent', 'exceedBy', 'bonus'].includes(k)) {
                    extraConfig[k] = v;
                }
            }

            await run(
                `INSERT OR REPLACE INTO sla_targets (
                    target_key, label, target_type, weight, 
                    auto_fill, is_percent, exceed_by, bonus, 
                    extra_config_json, updated_at
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [
                    targetKey,
                    label,
                    type,
                    weight,
                    autoFill,
                    isPercent,
                    exceedBy,
                    bonus,
                    JSON.stringify(extraConfig)
                ]
            );
        }
        await run('COMMIT');
    } catch (e) {
        await run('ROLLBACK');
        throw e;
    }
}

async function ensureReady() {
    if (!initPromise) {
        initPromise = (async () => {
            const tableInfo = await all('PRAGMA table_info(sla_targets)');
            
            await run(`
                CREATE TABLE IF NOT EXISTS sla_targets (
                    target_key TEXT PRIMARY KEY,
                    label TEXT,
                    target_type TEXT,
                    weight REAL,
                    auto_fill INTEGER,
                    is_percent INTEGER,
                    exceed_by NUMERIC,
                    bonus NUMERIC,
                    extra_config_json TEXT NOT NULL,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

        })().catch(err => {
            initPromise = null;
            throw err;
        });
    }

    return initPromise;
}

async function readFromDb() {
    await ensureReady();
    const rows = await all(`
        SELECT *
        FROM sla_targets
        ORDER BY target_key ASC
    `);
    const out = {};
    rows.forEach(row => {
        const base = {};
        if (row.label !== null) base.label = row.label;
        if (row.target_type !== null) base.type = row.target_type;
        if (row.weight !== null) base.weight = row.weight;
        if (row.auto_fill !== null) base.autoFill = row.auto_fill === 1;
        if (row.is_percent !== null) base.isPercent = row.is_percent === 1;
        if (row.exceed_by !== null) base.exceedBy = row.exceed_by;
        if (row.bonus !== null) base.bonus = row.bonus;

        const extra = JSON.parse(row.extra_config_json || '{}');
        
        out[row.target_key] = { ...extra, ...base };
    });
    return out;
}

async function getTargets() {
    return { items: await readFromDb(), source: 'sqlite' };
}

async function replaceTargets(items) {
    const normalized = items || {};
    await ensureReady();
    await replaceTargetsInDbRaw(normalized);
    return normalized;
}

module.exports = {
    ensureReady,
    getTargets,
    replaceTargets
};
