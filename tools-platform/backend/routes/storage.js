const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const express = require('express');
const router = express.Router();

const { DATA_DIR, readJSON } = require('../models/store');
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

function legacyJsonExists(filename) {
    return fs.existsSync(path.join(DATA_DIR, filename));
}

function readLegacyJson(filename, fallback) {
    return readJSON(filename, fallback);
}

function listTopLevelJsonFiles() {
    if (!fs.existsSync(DATA_DIR)) return [];
    return fs.readdirSync(DATA_DIR, { withFileTypes: true })
        .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
        .map(entry => {
            const absPath = path.join(DATA_DIR, entry.name);
            const stat = fs.statSync(absPath);
            return {
                name: entry.name,
                path: absPath,
                bytes: stat.size,
                modifiedAt: stat.mtime.toISOString()
            };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
}

function timestampForFile() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

router.get('/status', async (req, res) => {
    try {
        const checks = [
            {
                key: 'upload_history',
                label: 'Upload History',
                scope: 'homepage history / upload logs',
                writeStrategy: 'sqlite-only',
                jsonFile: 'upload_history.json',
                getJson: async () => readLegacyJson('upload_history.json', []),
                getSqlite: async () => (await uploadHistoryRepo.listHistory({ mode: 'sqlite', limit: 1000 })).items,
                getAuto: async () => uploadHistoryRepo.listHistory({ mode: 'auto', limit: 1000 })
            },
            {
                key: 'uiv_categories',
                label: 'UIV Categories',
                scope: 'uiv repository',
                writeStrategy: 'sqlite-only',
                jsonFile: 'uiv_categories.json',
                getJson: async () => readLegacyJson('uiv_categories.json', []),
                getSqlite: async () => (await uivCategoriesRepo.listCategories({ mode: 'sqlite' })).items,
                getAuto: async () => uivCategoriesRepo.listCategories({ mode: 'auto' })
            },
            {
                key: 'uiv_scripts',
                label: 'UIV Scripts',
                scope: 'uiv repository',
                writeStrategy: 'sqlite-only',
                alignByStableKey: true,
                jsonFile: 'uiv_scripts.json',
                getJson: async () => readLegacyJson('uiv_scripts.json', []),
                getSqlite: async () => (await uivScriptsRepo.listScripts({ mode: 'sqlite' })).items,
                getAuto: async () => uivScriptsRepo.listScripts({ mode: 'auto' })
            },
            {
                key: 'sla_categories',
                label: 'SLA Categories',
                scope: 'sla workspace',
                writeStrategy: 'sqlite-only',
                jsonFile: 'sla_categories.json',
                getJson: async () => readLegacyJson('sla_categories.json', []),
                getSqlite: async () => (await slaCategoriesRepo.listCategories({ mode: 'sqlite' })).items,
                getAuto: async () => slaCategoriesRepo.listCategories({ mode: 'auto' })
            },
            {
                key: 'sla_groups',
                label: 'SLA Groups',
                scope: 'sla workspace',
                writeStrategy: 'sqlite-only',
                jsonFile: 'sla_groups.json',
                getJson: async () => readLegacyJson('sla_groups.json', []),
                getSqlite: async () => (await slaGroupsRepo.listGroups({ mode: 'sqlite' })).items,
                getAuto: async () => slaGroupsRepo.listGroups({ mode: 'auto' })
            },
            {
                key: 'sla_snapshots',
                label: 'SLA Snapshots',
                scope: 'sla history',
                writeStrategy: 'sqlite-only',
                jsonFile: 'sla_snapshots.json',
                getJson: async () => readLegacyJson('sla_snapshots.json', []),
                getSqlite: async () => (await slaSnapshotsRepo.listSnapshots({ mode: 'sqlite' })).items,
                getAuto: async () => slaSnapshotsRepo.listSnapshots({ mode: 'auto' })
            },
            {
                key: 'sla_targets',
                label: 'SLA Targets',
                scope: 'sla workspace',
                writeStrategy: 'sqlite-only',
                jsonFile: 'sla_targets.json',
                getJson: async () => readLegacyJson('sla_targets.json', {}),
                getSqlite: async () => (await slaTargetsRepo.getTargets({ mode: 'sqlite' })).items,
                getAuto: async () => slaTargetsRepo.getTargets({ mode: 'auto' })
            },
            {
                key: 'sla_prefs',
                label: 'SLA Prefs',
                scope: 'sla workspace',
                writeStrategy: 'sqlite-only',
                jsonFile: 'sla_prefs.json',
                getJson: async () => readLegacyJson('sla_prefs.json', {}),
                getSqlite: async () => (await slaPrefsRepo.getPrefsObject({ mode: 'sqlite' })).items,
                getAuto: async () => slaPrefsRepo.getPrefsObject({ mode: 'auto' })
            },
            {
                key: 'auth_users',
                label: 'Auth Users',
                scope: 'system accounts',
                writeStrategy: 'sqlite-only',
                jsonFile: 'users.json',
                getJson: async () => readLegacyJson('users.json', {}),
                getSqlite: async () => (await authUsersRepo.listUsers({ mode: 'sqlite' })).items,
                getAuto: async () => authUsersRepo.listUsers({ mode: 'auto' })
            },
            {
                key: 'auth_sessions',
                label: 'Auth Sessions',
                scope: 'system auth',
                writeStrategy: 'sqlite-only',
                jsonFile: 'sessions.json',
                getJson: async () => readLegacyJson('sessions.json', {}),
                getSqlite: async () => (await authSessionsRepo.listSessions({ mode: 'sqlite' })).items,
                getAuto: async () => authSessionsRepo.listSessions({ mode: 'auto' })
            }
        ];

        const tables = [];
        for (const check of checks) {
            const jsonValue = await check.getJson();
            const sqliteValue = await check.getSqlite();
            const autoResult = await check.getAuto();
            const jsonExists = check.jsonFile ? legacyJsonExists(check.jsonFile) : true;
            const { diff, orderDiff } = summarizeAlignedDiff(jsonValue, sqliteValue, {
                alignByStableKey: !!check.alignByStableKey
            });
            const parity = !jsonExists ? 'json-disabled' : (diff ? 'mismatch' : 'match');
            tables.push({
                key: check.key,
                label: check.label,
                scope: check.scope,
                writeStrategy: check.writeStrategy,
                jsonFile: check.jsonFile,
                legacyJsonPresent: jsonExists,
                autoSource: autoResult.source,
                jsonCount: countItems(jsonValue),
                sqliteCount: countItems(sqliteValue),
                parity,
                orderDiff: parity === 'mismatch' ? orderDiff : null,
                diff: parity === 'mismatch' ? diff : null
            });
        }

        const matchCount = tables.filter(t => t.parity === 'match').length;
        const disabledCount = tables.filter(t => t.parity === 'json-disabled').length;
        const mismatchCount = tables.filter(t => t.parity === 'mismatch').length;
        res.setHeader('X-Data-Source', 'runtime');
        res.json({
            checkedAt: new Date().toISOString(),
            summary: {
                totalTables: tables.length,
                matchedTables: matchCount,
                disabledJsonTables: disabledCount,
                mismatchedTables: mismatchCount
            },
            tables
        });
    } catch (err) {
        console.error('[GET /api/storage/status] failed:', err);
        res.status(500).json({ error: '读取存储状态失败' });
    }
});

router.post('/cleanup-json', async (req, res) => {
    try {
        const files = listTopLevelJsonFiles();
        if (!files.length) {
            return res.json({
                success: true,
                deletedCount: 0,
                deletedFiles: [],
                backupFile: null,
                dataDir: DATA_DIR,
                message: '未发现可清理的 JSON 文件。'
            });
        }

        const zip = new JSZip();
        const manifest = {
            type: 'tools-platform-json-cleanup-backup',
            createdAt: new Date().toISOString(),
            dataDir: DATA_DIR,
            files: files.map(file => ({
                name: file.name,
                bytes: file.bytes,
                modifiedAt: file.modifiedAt
            }))
        };

        zip.file('manifest.json', JSON.stringify(manifest, null, 2));
        for (const file of files) {
            zip.file(file.name, fs.readFileSync(file.path));
        }

        const backupName = `legacy_json_cleanup_${timestampForFile()}.zip`;
        const backupPath = path.join(DATA_DIR, backupName);
        const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
        fs.writeFileSync(backupPath, content);

        const deletedFiles = [];
        for (const file of files) {
            fs.unlinkSync(file.path);
            deletedFiles.push(file.name);
        }

        console.log(`[storage] cleaned ${deletedFiles.length} legacy json files; backup=${backupPath}`);
        res.json({
            success: true,
            deletedCount: deletedFiles.length,
            deletedFiles,
            backupFile: backupName,
            backupPath,
            dataDir: DATA_DIR,
            message: `已备份并删除 ${deletedFiles.length} 个 JSON 文件。`
        });
    } catch (err) {
        console.error('[POST /api/storage/cleanup-json] failed:', err);
        res.status(500).json({ error: '清理 JSON 文件失败' });
    }
});

module.exports = router;
