const { readJSON, writeJSON } = require('./store');
const { run, get, all } = require('./app-db');
const { v4: uuidv4 } = require('uuid');

const SCRIPTS_FILE = 'uiv_scripts.json';

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

            const scripts = readScriptsFromJson();
            if (scripts.length === 0) return;
            await replaceScriptsInDbRaw(scripts);
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
    }
    return normalized;
}

function readScriptsFromJson() {
    const scripts = readJSON(SCRIPTS_FILE, []);
    return Array.isArray(scripts) ? scripts.map(normalizeScript) : [];
}

function writeScriptsToJson(scripts) {
    const normalized = Array.isArray(scripts) ? scripts.map(normalizeScript) : [];
    writeJSON(SCRIPTS_FILE, normalized);
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

async function listScripts({ mode = 'auto' } = {}) {
    const normalizedMode = String(mode || 'auto').toLowerCase();

    if (normalizedMode === 'json') {
        return {
            items: readScriptsFromJson(),
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

    const jsonScripts = readScriptsFromJson();
    if (jsonScripts.length > 0) {
        return {
            items: jsonScripts,
            source: 'json'
        };
    }

    return {
        items: await listFromDb(),
        source: 'sqlite'
    };
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
    let scripts = readScriptsFromJson();

    incoming.forEach(item => {
        const idx = scripts.findIndex(s => s.name === item.name);
        if (idx >= 0) {
            scripts[idx] = { ...scripts[idx], ...item };
        } else {
            scripts.push(item);
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
    const scripts = writeScriptsToJson(readScriptsFromJson().filter(script => script.id !== id));

    try {
        await ensureReady();
        await run('DELETE FROM uiv_scripts WHERE id = ?', [id]);
    } catch (err) {
        console.error('[uiv-scripts] SQLite delete sync failed:', err.message);
    }

    return scripts;
}

async function moveScriptCategory(id, category) {
    const scripts = readScriptsFromJson();
    const script = scripts.find(item => item.id === id);
    if (!script) return null;

    script.category = category;
    writeScriptsToJson(scripts);

    try {
        await upsertScriptInDb(script);
    } catch (err) {
        console.error('[uiv-scripts] SQLite category sync failed:', err.message);
    }

    return script;
}

async function deleteScriptsByCategory(category) {
    const scripts = writeScriptsToJson(readScriptsFromJson().filter(script => script.category !== category));

    try {
        await ensureReady();
        await run('DELETE FROM uiv_scripts WHERE category = ?', [category]);
    } catch (err) {
        console.error('[uiv-scripts] SQLite category delete sync failed:', err.message);
    }

    return scripts;
}

async function replaceAllScripts(scripts) {
    const normalized = writeScriptsToJson(scripts);

    try {
        await replaceScriptsInDb(normalized);
    } catch (err) {
        console.error('[uiv-scripts] SQLite replace sync failed:', err.message);
    }

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
