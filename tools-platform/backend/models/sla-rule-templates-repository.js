const { run, get } = require('./app-db');

let initPromise = null;

async function ensureReady() {
    if (!initPromise) {
        initPromise = run(`
            CREATE TABLE IF NOT EXISTS sla_rule_templates (
                template_key TEXT PRIMARY KEY,
                template_text TEXT NOT NULL DEFAULT '',
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `).catch(err => {
            initPromise = null;
            throw err;
        });
    }
    return initPromise;
}

async function getTemplate(templateKey) {
    await ensureReady();
    const row = await get(
        'SELECT template_key, template_text, updated_at FROM sla_rule_templates WHERE template_key = ?',
        [templateKey]
    );
    return row ? {
        key: row.template_key,
        text: row.template_text || '',
        updatedAt: row.updated_at
    } : {
        key: templateKey,
        text: '',
        updatedAt: null
    };
}

async function saveTemplate(templateKey, templateText) {
    await ensureReady();
    const text = String(templateText || '');
    await run(
        `INSERT INTO sla_rule_templates (template_key, template_text, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(template_key) DO UPDATE SET
            template_text = excluded.template_text,
            updated_at = CURRENT_TIMESTAMP`,
        [templateKey, text]
    );
    return getTemplate(templateKey);
}

module.exports = {
    getTemplate,
    saveTemplate
};
