const { run, get, all } = require('./app-db');

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

async function listCategories(options = {}) {
    const items = await listFromDb(options);
    return { items, source: 'sqlite' };
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

    return [];
}

async function deleteCategory(name) {
    const categories = [].filter(item => item !== name);
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
    const normalized = categories;

    await syncJsonCategoriesToDb(normalized);

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
