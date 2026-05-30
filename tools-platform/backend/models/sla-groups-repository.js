const { readJSON, writeJSON } = require('./store');
const { run, get, all } = require('./app-db');

const GROUPS_FILE = 'sla_groups.json';

let initPromise = null;

function normalizeGroups(groups) {
    return Array.isArray(groups) ? groups : [];
}

function readGroupsFromJson() {
    return normalizeGroups(readJSON(GROUPS_FILE, []));
}

function writeGroupsToJson(groups) {
    const normalized = normalizeGroups(groups);
    writeJSON(GROUPS_FILE, normalized);
    return normalized;
}

async function replaceGroupsInDbRaw(groups) {
    await run('DELETE FROM sla_group_items');
    await run('DELETE FROM sla_groups');
    for (let i = 0; i < groups.length; i++) {
        const groupObj = groups[i];
        const res = await run(
            `INSERT INTO sla_groups (group_key, name, sort_order, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
            [groupObj.id || `grp_${Date.now()}_${i}`, groupObj.name || '', i]
        );
        const groupId = res.lastID;
        const items = groupObj.metrics || [];
        for (let j = 0; j < items.length; j++) {
            await run(
                `INSERT INTO sla_group_items (group_id, item_name, item_sort_order) VALUES (?, ?, ?)`,
                [groupId, items[j], j]
            );
        }
    }
}

async function ensureReady() {
    if (!initPromise) {
        initPromise = (async () => {
            const tableInfo = await all('PRAGMA table_info(sla_groups)');
            const hasPayloadColumn = tableInfo.some(col => col.name === 'payload_json');

            if (hasPayloadColumn) {
                const existingRows = await all('SELECT id, sort_order, payload_json, updated_at FROM sla_groups');
                await run('PRAGMA foreign_keys=off');
                await run('DROP TABLE sla_groups');
                
                await run(`
                    CREATE TABLE sla_groups (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        group_key TEXT NOT NULL,
                        name TEXT NOT NULL,
                        sort_order INTEGER NOT NULL,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                
                await run(`
                    CREATE TABLE IF NOT EXISTS sla_group_items (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        group_id INTEGER NOT NULL,
                        item_name TEXT NOT NULL,
                        item_sort_order INTEGER NOT NULL,
                        FOREIGN KEY(group_id) REFERENCES sla_groups(id) ON DELETE CASCADE
                    )
                `);
                
                for (const row of existingRows) {
                    const groupObj = JSON.parse(row.payload_json || '{}');
                    await run(
                        `INSERT INTO sla_groups (id, group_key, name, sort_order, updated_at) VALUES (?, ?, ?, ?, ?)`,
                        [row.id, groupObj.id || `grp_migrated_${row.id}`, groupObj.name || '', row.sort_order, row.updated_at]
                    );
                    const items = groupObj.metrics || [];
                    for (let j = 0; j < items.length; j++) {
                        await run(
                            `INSERT INTO sla_group_items (group_id, item_name, item_sort_order) VALUES (?, ?, ?)`,
                            [row.id, items[j], j]
                        );
                    }
                }
                await run('PRAGMA foreign_keys=on');
            } else {
                // If it was already migrated but missing columns, we can drop and recreate
                const newTableInfo = await all('PRAGMA table_info(sla_groups)');
                if (!newTableInfo.some(col => col.name === 'group_key')) {
                     await run('DROP TABLE IF EXISTS sla_group_items');
                     await run('DROP TABLE IF EXISTS sla_groups');
                }
                await run(`
                    CREATE TABLE IF NOT EXISTS sla_groups (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        group_key TEXT NOT NULL,
                        name TEXT NOT NULL,
                        sort_order INTEGER NOT NULL,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                await run(`
                    CREATE TABLE IF NOT EXISTS sla_group_items (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        group_id INTEGER NOT NULL,
                        item_name TEXT NOT NULL,
                        item_sort_order INTEGER NOT NULL,
                        FOREIGN KEY(group_id) REFERENCES sla_groups(id) ON DELETE CASCADE
                    )
                `);
            }

            const row = await get('SELECT COUNT(1) AS count FROM sla_groups');
            if (row && row.count > 0) return;

            const groups = readGroupsFromJson();
            if (groups.length === 0) return;
            await replaceGroupsInDbRaw(groups);
        })().catch(err => {
            initPromise = null;
            throw err;
        });
    }

    return initPromise;
}

async function listFromDb() {
    await ensureReady();
    const groups = await all(`
        SELECT id, group_key, name, sort_order
        FROM sla_groups
        ORDER BY sort_order ASC, id ASC
    `);
    
    const items = await all(`
        SELECT group_id, item_name
        FROM sla_group_items
        ORDER BY item_sort_order ASC
    `);

    const itemMap = {};
    for (const item of items) {
        if (!itemMap[item.group_id]) itemMap[item.group_id] = [];
        itemMap[item.group_id].push(item.item_name);
    }

    return groups.map(g => ({
        id: g.group_key,
        name: g.name,
        metrics: itemMap[g.id] || []
    }));
}

async function listGroups({ mode = 'auto' } = {}) {
    const normalizedMode = String(mode || 'auto').toLowerCase();
    if (normalizedMode === 'json') {
        return { items: readGroupsFromJson(), source: 'json' };
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

    const jsonGroups = readGroupsFromJson();
    if (jsonGroups.length > 0) {
        return { items: jsonGroups, source: 'json' };
    }

    return { items: await listFromDb(), source: 'sqlite' };
}

async function replaceGroups(groups) {
    const normalized = writeGroupsToJson(groups);
    try {
        await ensureReady();
        await replaceGroupsInDbRaw(normalized);
    } catch (err) {
        console.error('[sla-groups] SQLite replace sync failed:', err.message);
    }
    return normalized;
}

module.exports = {
    ensureReady,
    listGroups,
    replaceGroups
};
