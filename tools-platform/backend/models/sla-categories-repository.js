const { run, get, all } = require('./app-db');

const DEFAULT_CATEGORIES = ['TE', 'ORG', 'ET', 'VDF'];

let initPromise = null;

function normalizeCategories(categories) {
    if (!Array.isArray(categories)) return [];
    return [...new Set(categories.map(item => String(item || '').trim()).filter(Boolean))];
}

async function ensureReady() {
    if (!initPromise) {
        initPromise = (async () => {
            await run(`
                CREATE TABLE IF NOT EXISTS sla_categories (
                    name TEXT PRIMARY KEY,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            const row = await get('SELECT COUNT(1) AS count FROM sla_categories');
            if (row && row.count > 0) return;

            
            for (const name of DEFAULT_CATEGORIES) {
                await run('INSERT OR IGNORE INTO sla_categories (name) VALUES (?)', [name]);
            }
        })().catch(err => {
            initPromise = null;
            throw err;
        });
    }

    return initPromise;
}

async function listFromDb() {
    await ensureReady();
    const rows = await all('SELECT name FROM sla_categories ORDER BY rowid ASC');
    return rows.map(row => row.name);
}

async function listCategories() {
    const items = await listFromDb();
    return { items, source: 'sqlite' };
}

async function replaceCategoriesInDb(categories) {
    await ensureReady();
    await run('DELETE FROM sla_categories');
    for (const name of categories) {
        await run('INSERT INTO sla_categories (name) VALUES (?)', [name]);
    }
}

async function replaceCategories(categories) {
    const normalized = categories;
    await replaceCategoriesInDb(normalized);
    return normalized;
}

module.exports = {
    DEFAULT_CATEGORIES,
    ensureReady,
    listCategories,
    replaceCategories
};
