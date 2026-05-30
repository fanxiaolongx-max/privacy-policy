const express = require('express');
const router = express.Router();

const uploadHistoryRepo = require('../models/upload-history-repository');
const uivCategoriesRepo = require('../models/uiv-categories-repository');
const uivScriptsRepo = require('../models/uiv-scripts-repository');
const slaCategoriesRepo = require('../models/sla-categories-repository');
const slaGroupsRepo = require('../models/sla-groups-repository');
const slaSnapshotsRepo = require('../models/sla-snapshots-repository');
const slaTargetsRepo = require('../models/sla-targets-repository');
const slaPrefsRepo = require('../models/sla-prefs-repository');
const authUsersRepo = require('../models/auth-users-repository');
const authSessionsRepo = require('../models/auth-sessions-repository');

function sortObjectKeysDeep(value) {
    if (Array.isArray(value)) return value.map(sortObjectKeysDeep);
    if (value && typeof value === 'object') {
        const out = {};
        for (const key of Object.keys(value).sort()) {
            out[key] = sortObjectKeysDeep(value[key]);
        }
        return out;
    }
    return value;
}

function countItems(value) {
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === 'object') return Object.keys(value).length;
    return null;
}

function summarizeDiff(jsonValue, sqliteValue) {
    const jsonText = JSON.stringify(sortObjectKeysDeep(jsonValue));
    const sqliteText = JSON.stringify(sortObjectKeysDeep(sqliteValue));
    if (jsonText === sqliteText) return null;

    const maxLen = Math.min(jsonText.length, sqliteText.length);
    let idx = 0;
    while (idx < maxLen && jsonText[idx] === sqliteText[idx]) idx++;

    return {
        firstDiffIndex: idx,
        jsonExcerpt: jsonText.slice(Math.max(0, idx - 40), idx + 100),
        sqliteExcerpt: sqliteText.slice(Math.max(0, idx - 40), idx + 100)
    };
}

router.get('/status', async (req, res) => {
    try {
        const checks = [
            {
                key: 'upload_history',
                label: 'Upload History',
                scope: 'homepage history / upload logs',
                writeStrategy: 'json+sqlite',
                getJson: async () => (await uploadHistoryRepo.listHistory({ mode: 'json', limit: 1000 })).items,
                getSqlite: async () => (await uploadHistoryRepo.listHistory({ mode: 'sqlite', limit: 1000 })).items,
                getAuto: async () => uploadHistoryRepo.listHistory({ mode: 'auto', limit: 1000 })
            },
            {
                key: 'uiv_categories',
                label: 'UIV Categories',
                scope: 'uiv repository',
                writeStrategy: 'json+sqlite',
                getJson: async () => (await uivCategoriesRepo.listCategories({ mode: 'json' })).items,
                getSqlite: async () => (await uivCategoriesRepo.listCategories({ mode: 'sqlite' })).items,
                getAuto: async () => uivCategoriesRepo.listCategories({ mode: 'auto' })
            },
            {
                key: 'uiv_scripts',
                label: 'UIV Scripts',
                scope: 'uiv repository',
                writeStrategy: 'json+sqlite',
                getJson: async () => (await uivScriptsRepo.listScripts({ mode: 'json' })).items,
                getSqlite: async () => (await uivScriptsRepo.listScripts({ mode: 'sqlite' })).items,
                getAuto: async () => uivScriptsRepo.listScripts({ mode: 'auto' })
            },
            {
                key: 'sla_categories',
                label: 'SLA Categories',
                scope: 'sla workspace',
                writeStrategy: 'json+sqlite',
                getJson: async () => (await slaCategoriesRepo.listCategories({ mode: 'json' })).items,
                getSqlite: async () => (await slaCategoriesRepo.listCategories({ mode: 'sqlite' })).items,
                getAuto: async () => slaCategoriesRepo.listCategories({ mode: 'auto' })
            },
            {
                key: 'sla_groups',
                label: 'SLA Groups',
                scope: 'sla workspace',
                writeStrategy: 'json+sqlite',
                getJson: async () => (await slaGroupsRepo.listGroups({ mode: 'json' })).items,
                getSqlite: async () => (await slaGroupsRepo.listGroups({ mode: 'sqlite' })).items,
                getAuto: async () => slaGroupsRepo.listGroups({ mode: 'auto' })
            },
            {
                key: 'sla_snapshots',
                label: 'SLA Snapshots',
                scope: 'sla history',
                writeStrategy: 'json+sqlite',
                getJson: async () => (await slaSnapshotsRepo.listSnapshots({ mode: 'json' })).items,
                getSqlite: async () => (await slaSnapshotsRepo.listSnapshots({ mode: 'sqlite' })).items,
                getAuto: async () => slaSnapshotsRepo.listSnapshots({ mode: 'auto' })
            },
            {
                key: 'sla_targets',
                label: 'SLA Targets',
                scope: 'sla workspace',
                writeStrategy: 'json+sqlite',
                getJson: async () => (await slaTargetsRepo.getTargets({ mode: 'json' })).items,
                getSqlite: async () => (await slaTargetsRepo.getTargets({ mode: 'sqlite' })).items,
                getAuto: async () => slaTargetsRepo.getTargets({ mode: 'auto' })
            },
            {
                key: 'sla_prefs',
                label: 'SLA Prefs',
                scope: 'sla workspace',
                writeStrategy: 'json+sqlite',
                getJson: async () => (await slaPrefsRepo.getPrefsObject({ mode: 'json' })).items,
                getSqlite: async () => (await slaPrefsRepo.getPrefsObject({ mode: 'sqlite' })).items,
                getAuto: async () => slaPrefsRepo.getPrefsObject({ mode: 'auto' })
            },
            {
                key: 'auth_users',
                label: 'Auth Users',
                scope: 'system accounts',
                writeStrategy: 'json+sqlite',
                getJson: async () => (await authUsersRepo.listUsers({ mode: 'json' })).items,
                getSqlite: async () => (await authUsersRepo.listUsers({ mode: 'sqlite' })).items,
                getAuto: async () => authUsersRepo.listUsers({ mode: 'auto' })
            },
            {
                key: 'auth_sessions',
                label: 'Auth Sessions',
                scope: 'system auth',
                writeStrategy: 'json+sqlite',
                getJson: async () => (await authSessionsRepo.listSessions({ mode: 'json' })).items,
                getSqlite: async () => (await authSessionsRepo.listSessions({ mode: 'sqlite' })).items,
                getAuto: async () => authSessionsRepo.listSessions({ mode: 'auto' })
            }
        ];

        const tables = [];
        for (const check of checks) {
            const jsonValue = await check.getJson();
            const sqliteValue = await check.getSqlite();
            const autoResult = await check.getAuto();
            const diff = summarizeDiff(jsonValue, sqliteValue);
            tables.push({
                key: check.key,
                label: check.label,
                scope: check.scope,
                writeStrategy: check.writeStrategy,
                autoSource: autoResult.source,
                jsonCount: countItems(jsonValue),
                sqliteCount: countItems(sqliteValue),
                parity: diff ? 'mismatch' : 'match',
                diff
            });
        }

        const matchCount = tables.filter(t => t.parity === 'match').length;
        res.setHeader('X-Data-Source', 'runtime');
        res.json({
            checkedAt: new Date().toISOString(),
            summary: {
                totalTables: tables.length,
                matchedTables: matchCount,
                mismatchedTables: tables.length - matchCount
            },
            tables
        });
    } catch (err) {
        console.error('[GET /api/storage/status] failed:', err);
        res.status(500).json({ error: '读取存储状态失败' });
    }
});

module.exports = router;
