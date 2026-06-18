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

function getStableItemKey(item) {
    if (!item || typeof item !== 'object') return '';
    return String(item.id || item.key || item.name || item.title || '');
}

function alignArrayByStableKey(value) {
    if (!Array.isArray(value)) return value;
    if (!value.every(item => item && typeof item === 'object' && getStableItemKey(item))) {
        return value;
    }

    return [...value].sort((a, b) => {
        const aKey = getStableItemKey(a);
        const bKey = getStableItemKey(b);
        return aKey.localeCompare(bKey, undefined, { numeric: true });
    });
}

function summarizeOrderDiff(jsonValue, sqliteValue) {
    if (!Array.isArray(jsonValue) || !Array.isArray(sqliteValue)) return null;
    if (jsonValue.length !== sqliteValue.length) return null;
    if (!jsonValue.every(item => item && typeof item === 'object' && getStableItemKey(item))) return null;
    if (!sqliteValue.every(item => item && typeof item === 'object' && getStableItemKey(item))) return null;

    const jsonKeys = jsonValue.map(getStableItemKey);
    const sqliteKeys = sqliteValue.map(getStableItemKey);
    const sameOrder = jsonKeys.every((key, index) => key === sqliteKeys[index]);
    if (sameOrder) return null;

    const sameSet = [...jsonKeys].sort().join('\n') === [...sqliteKeys].sort().join('\n');
    if (!sameSet) return null;

    const firstIndex = jsonKeys.findIndex((key, index) => key !== sqliteKeys[index]);
    return {
        type: 'order-only',
        firstIndex,
        jsonKey: jsonKeys[firstIndex],
        sqliteKey: sqliteKeys[firstIndex],
        message: 'JSON 与 SQLite 内容一致，但列表顺序不同；已按稳定主键对齐后比较内容。'
    };
}

function getValueType(value) {
    if (Array.isArray(value)) return 'array';
    if (value === null) return 'null';
    return typeof value;
}

function previewValue(value, maxLen = 1200) {
    if (value === undefined) return 'undefined';
    const text = JSON.stringify(sortObjectKeysDeep(value), null, 2);
    if (text === undefined) return 'undefined';
    if (text.length <= maxLen) return text;
    return `${text.slice(0, maxLen)}\n...（已截断，完整长度 ${text.length} 字符）`;
}

function findFirstSemanticDiff(jsonValue, sqliteValue, path = '$') {
    if (Object.is(jsonValue, sqliteValue)) return null;

    const jsonType = getValueType(jsonValue);
    const sqliteType = getValueType(sqliteValue);
    if (jsonType !== sqliteType) {
        return {
            path,
            reason: `类型不同：JSON=${jsonType}，SQLite=${sqliteType}`,
            jsonPreview: previewValue(jsonValue),
            sqlitePreview: previewValue(sqliteValue)
        };
    }

    if (Array.isArray(jsonValue)) {
        if (jsonValue.length !== sqliteValue.length) {
            return {
                path,
                reason: `数组长度不同：JSON=${jsonValue.length}，SQLite=${sqliteValue.length}`,
                jsonPreview: previewValue(jsonValue),
                sqlitePreview: previewValue(sqliteValue)
            };
        }
        for (let i = 0; i < jsonValue.length; i++) {
            const childDiff = findFirstSemanticDiff(jsonValue[i], sqliteValue[i], `${path}[${i}]`);
            if (childDiff) return childDiff;
        }
        return null;
    }

    if (jsonValue && typeof jsonValue === 'object') {
        const jsonKeys = Object.keys(jsonValue).sort();
        const sqliteKeys = Object.keys(sqliteValue).sort();
        const allKeys = Array.from(new Set([...jsonKeys, ...sqliteKeys])).sort();
        const missingInSqlite = jsonKeys.find(key => !Object.prototype.hasOwnProperty.call(sqliteValue, key));
        const missingInJson = sqliteKeys.find(key => !Object.prototype.hasOwnProperty.call(jsonValue, key));
        if (missingInSqlite || missingInJson) {
            const key = missingInSqlite || missingInJson;
            return {
                path: `${path}.${key}`,
                reason: missingInSqlite ? 'SQLite 缺少该字段' : 'JSON 缺少该字段',
                jsonPreview: previewValue(jsonValue[key]),
                sqlitePreview: previewValue(sqliteValue[key])
            };
        }
        for (const key of allKeys) {
            const childDiff = findFirstSemanticDiff(jsonValue[key], sqliteValue[key], `${path}.${key}`);
            if (childDiff) return childDiff;
        }
        return null;
    }

    return {
        path,
        reason: '值不同',
        jsonPreview: previewValue(jsonValue),
        sqlitePreview: previewValue(sqliteValue)
    };
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
        jsonLength: jsonText.length,
        sqliteLength: sqliteText.length,
        jsonExcerpt: jsonText.slice(Math.max(0, idx - 80), idx + 180),
        sqliteExcerpt: sqliteText.slice(Math.max(0, idx - 80), idx + 180),
        semantic: findFirstSemanticDiff(jsonValue, sqliteValue)
    };
}

function summarizeAlignedDiff(jsonValue, sqliteValue, { alignByStableKey = false } = {}) {
    const orderDiff = alignByStableKey ? summarizeOrderDiff(jsonValue, sqliteValue) : null;
    const comparableJson = alignByStableKey ? alignArrayByStableKey(jsonValue) : jsonValue;
    const comparableSqlite = alignByStableKey ? alignArrayByStableKey(sqliteValue) : sqliteValue;
    const diff = summarizeDiff(comparableJson, comparableSqlite);
    if (!diff && orderDiff) {
        return { diff: null, orderDiff };
    }
    return { diff, orderDiff };
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
                alignByStableKey: true,
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
            const { diff, orderDiff } = summarizeAlignedDiff(jsonValue, sqliteValue, {
                alignByStableKey: !!check.alignByStableKey
            });
            tables.push({
                key: check.key,
                label: check.label,
                scope: check.scope,
                writeStrategy: check.writeStrategy,
                autoSource: autoResult.source,
                jsonCount: countItems(jsonValue),
                sqliteCount: countItems(sqliteValue),
                parity: diff ? 'mismatch' : 'match',
                orderDiff,
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
