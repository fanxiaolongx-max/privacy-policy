const { readJSON, writeJSON } = require('./store');
const { run, get, all } = require('./app-db');

const CATEGORIES_FILE = 'sla_categories.json';
const DEFAULT_CATEGORIES = ['TE', 'ORG', 'ET', 'VDF'];

let initPromise = null;

function normalizeCategories(categories) {
    if (!Array.isArray(categories)) return [];
    return [...new Set(categories.map(item => String(item || '').trim()).filter(Boolean))];
}

function readCategoriesFromJson() {
    const data = readJSON(CATEGORIES_FILE, DEFAULT_CATEGORIES);
    const normalized = normalizeCategories(data);
    return normalized.length > 0 ? normalized : [...DEFAULT_CATEGORIES];
}

function writeCategoriesToJson(categories) {
    const normalized = normalizeCategories(categories);
    writeJSON(CATEGORIES_FILE, normalized);
    return normalized;
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

            const categories = readCategoriesFromJson();
            for (const name of categories) {
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

async function listCategories({ mode = 'auto' } = {}) {
    const normalizedMode = String(mode || 'auto').toLowerCase();
    if (normalizedMode === 'json') {
        return { items: readCategoriesFromJson(), source: 'json' };
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

    const jsonCategories = readCategoriesFromJson();
    if (jsonCategories.length > 0) {
        return { items: jsonCategories, source: 'json' };
    }

    return { items: await listFromDb(), source: 'sqlite' };
}

async function replaceCategoriesInDb(categories) {
    await ensureReady();
    await run('DELETE FROM sla_categories');
    for (const name of categories) {
        await run('INSERT INTO sla_categories (name) VALUES (?)', [name]);
    }
}

async function replaceCategories(categories) {
    const normalized = writeCategoriesToJson(categories);
    try {
        await replaceCategoriesInDb(normalized);
    } catch (err) {
        console.error('[sla-categories] SQLite replace sync failed:', err.message);
    }
    return normalized;
}

module.exports = {
    DEFAULT_CATEGORIES,
    ensureReady,
    listCategories,
    replaceCategories
};
