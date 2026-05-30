const { readJSON, writeJSON } = require('./store');
const { run, get, all } = require('./app-db');

const CATS_FILE = 'uiv_categories.json';
const DEFAULT_CATEGORIES = ['DataFab', 'NetCare中国', 'NetCare中东', 'NetCare德国', '默认分类'];

let initPromise = null;

async function ensureReady() {
    if (!initPromise) {
        initPromise = (async () => {
            await run(`
                CREATE TABLE IF NOT EXISTS uiv_categories (
                    name TEXT PRIMARY KEY,
                    is_default INTEGER NOT NULL DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            const row = await get('SELECT COUNT(1) AS count FROM uiv_categories');
            if (row && row.count > 0) return;

            const jsonCategories = readCategoriesFromJson();
            const allCategories = [...DEFAULT_CATEGORIES, ...jsonCategories];

            await run('BEGIN TRANSACTION');
            try {
                for (const name of allCategories) {
                    await run(
                        `INSERT OR IGNORE INTO uiv_categories (name, is_default)
                         VALUES (?, ?)`,
                        [name, DEFAULT_CATEGORIES.includes(name) ? 1 : 0]
                    );
                }
                await run('COMMIT');
            } catch (err) {
                await run('ROLLBACK').catch(() => {});
                throw err;
            }
        })().catch(err => {
            initPromise = null;
            throw err;
        });
    }

    return initPromise;
}

function normalizeCategories(categories) {
    if (!Array.isArray(categories)) return [];
    return [...new Set(
        categories
            .map(item => String(item || '').trim())
            .filter(Boolean)
            .filter(name => !DEFAULT_CATEGORIES.includes(name))
    )];
}

function readCategoriesFromJson() {
    return normalizeCategories(readJSON(CATS_FILE, []));
}

function writeCategoriesToJson(categories) {
    const normalized = normalizeCategories(categories);
    writeJSON(CATS_FILE, normalized);
    return normalized;
}

async function listFromDb() {
    await ensureReady();
    const rows = await all(`
        SELECT name, is_default
        FROM uiv_categories
        ORDER BY is_default DESC, rowid ASC
    `);

    const defaults = rows.filter(row => row.is_default).map(row => row.name);
    const customs = rows.filter(row => !row.is_default).map(row => row.name);
    const orderedDefaults = DEFAULT_CATEGORIES.filter(name => defaults.includes(name));
    return [...orderedDefaults, ...customs];
}

async function listCategories({ mode = 'auto' } = {}) {
    const normalizedMode = String(mode || 'auto').toLowerCase();

    if (normalizedMode === 'json') {
        return {
            items: [...DEFAULT_CATEGORIES, ...readCategoriesFromJson()],
            source: 'json'
        };
    }

    if (normalizedMode === 'sqlite' || normalizedMode === 'db') {
        return {
            items: await listFromDb(),
            source: 'sqlite'
        };
    }

    // --- AUTO MODE PRIORITY: SQLITE ---
    try {
        const dbRes = await listFromDb();
        if (dbRes && (Array.isArray(dbRes) ? dbRes.length > 0 : Object.keys(dbRes).length > 0)) {
            return { items: dbRes, source: 'sqlite' };
        }
    } catch (err) {}

    const jsonCategories = readCategoriesFromJson();
    if (jsonCategories.length > 0) {
        return {
            items: [...DEFAULT_CATEGORIES, ...jsonCategories],
            source: 'json'
        };
    }

    return {
        items: await listFromDb(),
        source: 'sqlite'
    };
}

async function syncJsonCategoriesToDb(categories) {
    await ensureReady();
    await run('BEGIN TRANSACTION');
    try {
        await run('DELETE FROM uiv_categories WHERE is_default = 0');
        for (const name of categories) {
            await run(
                `INSERT OR REPLACE INTO uiv_categories (name, is_default)
                 VALUES (?, 0)`,
                [name]
            );
        }
        for (const name of DEFAULT_CATEGORIES) {
            await run(
                `INSERT OR IGNORE INTO uiv_categories (name, is_default)
                 VALUES (?, 1)`,
                [name]
            );
        }
        await run('COMMIT');
    } catch (err) {
        await run('ROLLBACK').catch(() => {});
        throw err;
    }
}

async function addCategory(name) {
    const trimmedName = String(name || '').trim();
    const categories = readCategoriesFromJson();
    if (!trimmedName) {
        return categories;
    }

    if (!DEFAULT_CATEGORIES.includes(trimmedName) && !categories.includes(trimmedName)) {
        categories.push(trimmedName);
        writeCategoriesToJson(categories);

        try {
            await ensureReady();
            await run(
                `INSERT OR REPLACE INTO uiv_categories (name, is_default)
                 VALUES (?, 0)`,
                [trimmedName]
            );
        } catch (err) {
            console.error('[uiv-categories] SQLite dual-write failed:', err.message);
        }
    }

    return readCategoriesFromJson();
}

async function deleteCategory(name) {
    const categories = readCategoriesFromJson().filter(item => item !== name);
    writeCategoriesToJson(categories);

    try {
        await ensureReady();
        await run('DELETE FROM uiv_categories WHERE name = ? AND is_default = 0', [name]);
    } catch (err) {
        console.error('[uiv-categories] SQLite delete sync failed:', err.message);
    }

    return categories;
}

async function replaceCategories(categories) {
    const normalized = writeCategoriesToJson(categories);

    try {
        await syncJsonCategoriesToDb(normalized);
    } catch (err) {
        console.error('[uiv-categories] SQLite replace sync failed:', err.message);
    }

    return normalized;
}

module.exports = {
    DEFAULT_CATEGORIES,
    ensureReady,
    listCategories,
    addCategory,
    deleteCategory,
    replaceCategories
};
