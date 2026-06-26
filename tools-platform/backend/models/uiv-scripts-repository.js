const { run, get, all } = require('./app-db');
const { v4: uuidv4 } = require('uuid');


let initPromise = null;

async function replaceScriptsInDbRaw(scripts) {
    await run('BEGIN TRANSACTION');
    try {
        await run('DELETE FROM uiv_scripts');
        for (const script of scripts) {
            await run(
                `INSERT INTO uiv_scripts (id, name, category, url, payload_json, updated_at)
                 VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [
                    script.id,
                    script.name,
                    script.category || '',
                    script.url || '',
                    JSON.stringify(script)
                ]
            );
        }
        await run('COMMIT');
    } catch (err) {
        await run('ROLLBACK').catch(() => {});
        throw err;
    }
}

async function ensureReady() {
    if (!initPromise) {
        initPromise = (async () => {
            await run(`
                CREATE TABLE IF NOT EXISTS uiv_scripts (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    category TEXT,
                    url TEXT,
                    payload_json TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            const row = await get('SELECT COUNT(1) AS count FROM uiv_scripts');
            if (row && row.count > 0) return;

            
        })().catch(err => {
            initPromise = null;
            throw err;
        });
    }

    return initPromise;
}

function normalizeScript(item) {
    const normalized = { ...item };
    if (!normalized.id) {
        normalized.id = 'script_' + uuidv4().replace(/-/g, '').slice(0, 9);
        normalized.createdAt = new Date().toISOString();
        normalized.updatedAt = new Date().toISOString();
    }
    return normalized;
}

async function listFromDb() {
    await ensureReady();
    const rows = await all(`
        SELECT payload_json
        FROM uiv_scripts
        ORDER BY rowid ASC
    `);
    return rows.map(row => JSON.parse(row.payload_json));
}

async function listScripts(options = {}) {
    const items = await listFromDb(options);
    return { items, source: 'sqlite' };
}

async function upsertScriptInDb(script) {
    await ensureReady();
    await run(
        `INSERT INTO uiv_scripts (id, name, category, url, payload_json, updated_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            category = excluded.category,
            url = excluded.url,
            payload_json = excluded.payload_json,
            updated_at = CURRENT_TIMESTAMP`,
        [
            script.id,
            script.name,
            script.category || '',
            script.url || '',
            JSON.stringify(script)
        ]
    );
}

async function replaceScriptsInDb(scripts) {
    await ensureReady();
    await replaceScriptsInDbRaw(scripts);
}

async function saveScripts(items) {
    const incoming = Array.isArray(items) ? items.map(normalizeScript) : [];
    let scripts = [];

    incoming.forEach(item => {
        const idx = scripts.findIndex(s => s.name === item.name || s.id === item.id);
        const now = new Date().toISOString();
        if (idx >= 0) {
            scripts[idx] = { ...scripts[idx], ...item, updatedAt: now };
            if (!scripts[idx].createdAt) scripts[idx].createdAt = now;
        } else {
            scripts.push({ ...item, createdAt: item.createdAt || now, updatedAt: now });
        }
    });

    scripts = writeScriptsToJson(scripts);

    try {
        for (const item of incoming) {
            const latest = scripts.find(script => script.name === item.name) || item;
            await upsertScriptInDb(latest);
        }
    } catch (err) {
        console.error('[uiv-scripts] SQLite dual-write failed:', err.message);
    }

    return scripts;
}

async function deleteScriptById(id) {
    const normalized = [].filter(script => script.id !== id);

    try {
        await ensureReady();
        await run('DELETE FROM uiv_scripts WHERE id = ?', [id]);
    } catch (err) {
        console.error('[uiv-scripts] SQLite delete sync failed:', err.message);
    }

    return scripts;
}

async function moveScriptCategory(id, category) {
    
    const script = scripts.find(item => item.id === id);
    if (!script) return null;

    script.category = category;
    writeScriptsToJson(scripts);

    await upsertScriptInDb(script);

    return script;
}

async function deleteScriptsByCategory(category) {
    const normalized = [].filter(script => script.category !== category);

    try {
        await ensureReady();
        await run('DELETE FROM uiv_scripts WHERE category = ?', [category]);
    } catch (err) {
        console.error('[uiv-scripts] SQLite category delete sync failed:', err.message);
    }

    return scripts;
}

async function replaceAllScripts(scripts) {
    const normalized = scripts;

    await replaceScriptsInDb(normalized);

    return normalized;
}

module.exports = {
    ensureReady,
    listScripts,
    saveScripts,
    deleteScriptById,
    moveScriptCategory,
    deleteScriptsByCategory,
    replaceAllScripts
};
