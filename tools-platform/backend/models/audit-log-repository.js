const { run, all } = require('./app-db');

const MAX_AUDIT_ROWS = 5000;

let initPromise = null;

function buildId(prefix = 'audit') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function ensureReady() {
    if (!initPromise) {
        initPromise = (async () => {
            await run(`
                CREATE TABLE IF NOT EXISTS audit_log (
                    id TEXT PRIMARY KEY,
                    scope TEXT NOT NULL,
                    action TEXT NOT NULL,
                    actor TEXT DEFAULT '',
                    source TEXT DEFAULT '',
                    summary_json TEXT NOT NULL DEFAULT '{}',
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

async function trimAuditLog() {
    await run(`
        DELETE FROM audit_log
        WHERE id NOT IN (
            SELECT id
            FROM audit_log
            ORDER BY created_at DESC, rowid DESC
            LIMIT ?
        )
    `, [MAX_AUDIT_ROWS]);
}

async function addAuditLog({ scope, action, actor = '', source = '', summary = {} }) {
    await ensureReady();
    const item = {
        id: buildId(),
        scope: scope || 'system',
        action: action || 'unknown',
        actor: actor || '',
        source: source || '',
        summary
    };
    await run(
        `INSERT INTO audit_log (id, scope, action, actor, source, summary_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            item.id,
            item.scope,
            item.action,
            item.actor,
            item.source,
            JSON.stringify(item.summary || {})
        ]
    );
    await trimAuditLog();
    return item;
}

async function listAuditLog({ scope, limit = 100 } = {}) {
    await ensureReady();
    const parsedLimit = Number.parseInt(limit, 10);
    const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 500) : 100;
    const rows = scope
        ? await all(
            `SELECT id, scope, action, actor, source, summary_json, created_at
             FROM audit_log
             WHERE scope = ?
             ORDER BY created_at DESC, rowid DESC
             LIMIT ?`,
            [scope, safeLimit]
        )
        : await all(
            `SELECT id, scope, action, actor, source, summary_json, created_at
             FROM audit_log
             ORDER BY created_at DESC, rowid DESC
             LIMIT ?`,
            [safeLimit]
        );

    return rows.map(row => ({
        ...row,
        summary: JSON.parse(row.summary_json || '{}'),
        summary_json: undefined
    }));
}

module.exports = {
    ensureReady,
    addAuditLog,
    listAuditLog
};
