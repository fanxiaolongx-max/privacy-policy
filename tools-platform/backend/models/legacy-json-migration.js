const fs = require('fs');
const path = require('path');

const { DATA_DIR, readJSON } = require('./store');
const { run, get, all } = require('./app-db');
const { readKV, writeKV } = require('./kv-store');

const uploadHistoryRepo = require('./upload-history-repository');
const uivCategoriesRepo = require('./uiv-categories-repository');
const uivScriptsRepo = require('./uiv-scripts-repository');
const slaCategoriesRepo = require('./sla-categories-repository');
const slaGroupsRepo = require('./sla-groups-repository');
const slaSnapshotsRepo = require('./sla-snapshots-repository');
const slaTargetsRepo = require('./sla-targets-repository');
const slaPrefsRepo = require('./sla-prefs-repository');
const authUsersRepo = require('./auth-users-repository');
const authSessionsRepo = require('./auth-sessions-repository');
const frtSnapshotsRepo = require('./frt-snapshots-repository');

let lastMigrationReport = {
    status: 'not-run',
    startedAt: null,
    finishedAt: null,
    hasLegacyJson: false,
    migratedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    steps: []
};

function legacyFileExists(filename) {
    return fs.existsSync(path.join(DATA_DIR, filename));
}

function legacyJson(filename, fallback) {
    return readJSON(filename, fallback);
}

function hasItems(value) {
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.keys(value).length > 0;
    return false;
}

async function tableCount(tableName, whereClause = '', params = []) {
    const row = await get(`SELECT COUNT(1) AS count FROM ${tableName} ${whereClause}`, params);
    return row ? Number(row.count || 0) : 0;
}

async function tableHasAllKeys(tableName, columnName, keys) {
    const wanted = Array.from(new Set((keys || []).map(String).filter(Boolean)));
    if (!wanted.length) return false;
    const placeholders = wanted.map(() => '?').join(',');
    const rows = await all(`SELECT ${columnName} AS item_key FROM ${tableName} WHERE ${columnName} IN (${placeholders})`, wanted);
    return rows.length >= wanted.length;
}

async function kvExists(category, key) {
    const sentinel = { __missing: true };
    const value = await readKV(category, key, sentinel);
    return value !== sentinel;
}

async function readExistingKV(category, key, fallback) {
    return readKV(category, key, fallback);
}

function itemCount(value) {
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === 'object') return Object.keys(value).length;
    return value === undefined || value === null ? 0 : 1;
}

function hasMeaningfulKvValue(key, existing, incoming) {
    if (!hasItems(incoming)) return true;
    if (key === 'ai_settings') {
        return Boolean(existing && existing.apiKey);
    }
    return itemCount(existing) >= itemCount(incoming);
}

function redactValue(key, value) {
    const name = String(key || '').toLowerCase();
    if (name.includes('password') || name.includes('hash')) return '[已脱敏]';
    if (name.includes('token') || name.includes('apikey') || name === 'api_key' || name === 'key') {
        if (value && typeof value === 'object') return value;
        const text = String(value || '');
        if (!text) return '';
        return text.length > 8 ? `${text.slice(0, 4)}****${text.slice(-4)}` : '********';
    }
    return value;
}

function redactKey(key) {
    const text = String(key || '');
    const lower = text.toLowerCase();
    if (lower.includes('token')) {
        return text.length > 8 ? `${text.slice(0, 4)}****${text.slice(-4)}` : '********';
    }
    if (/^[0-9a-f]{32,}$/i.test(text)) {
        return `${text.slice(0, 4)}****${text.slice(-4)}`;
    }
    return text;
}

function sanitizePreview(value, depth = 0) {
    if (depth > 4) return '[已截断]';
    if (Array.isArray(value)) return value.slice(0, 3).map(item => sanitizePreview(item, depth + 1));
    if (value && typeof value === 'object') {
        const out = {};
        for (const [key, child] of Object.entries(value).slice(0, 12)) {
            out[redactKey(key)] = sanitizePreview(redactValue(key, child), depth + 1);
        }
        return out;
    }
    if (typeof value === 'string' && value.length > 180) return `${value.slice(0, 180)}...`;
    return value;
}

function previewLegacyJson(filename, fallback) {
    if (!legacyFileExists(filename)) return null;
    return sanitizePreview(legacyJson(filename, fallback));
}

function legacyCount(filename, fallback) {
    if (!legacyFileExists(filename)) return 0;
    const value = legacyJson(filename, fallback);
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === 'object') return Object.keys(value).length;
    return value === undefined || value === null ? 0 : 1;
}

function statusLabel(status) {
    if (status === 'success') return '成功';
    if (status === 'failed') return '失败';
    return '跳过';
}

async function runStep(step, migrated) {
    const startedAt = new Date().toISOString();
    const legacyPresent = legacyFileExists(step.sourceFile);
    const sourceCount = legacyCount(step.sourceFile, step.fallback);
    const beforeCount = await step.targetCount().catch(() => null);
    const record = {
        key: step.key,
        label: step.label,
        sourceFile: step.sourceFile,
        target: step.target,
        status: 'skipped',
        statusLabel: statusLabel('skipped'),
        legacyPresent,
        sourceCount,
        beforeCount,
        afterCount: beforeCount,
        migratedCount: 0,
        message: legacyPresent ? 'SQLite/KV 已有数据，或旧 JSON 为空，未覆盖现有数据。' : '未发现旧 JSON 文件。',
        sample: previewLegacyJson(step.sourceFile, step.fallback),
        startedAt,
        finishedAt: null
    };

    try {
        const result = await step.run();
        const afterCount = await step.targetCount().catch(() => null);
        record.afterCount = afterCount;
        if (result) {
            record.status = 'success';
            record.statusLabel = statusLabel('success');
            record.migratedCount = sourceCount;
            record.message = '已从旧 JSON 自动迁移到 SQLite/KV。';
            migrated.push(result);
        }
    } catch (err) {
        record.status = 'failed';
        record.statusLabel = statusLabel('failed');
        record.message = err.message || '迁移失败';
        record.error = {
            name: err.name || 'Error',
            message: err.message || String(err)
        };
    }

    record.finishedAt = new Date().toISOString();
    return record;
}

async function migrateKvFile(filename, key, defaultValue) {
    if (!legacyFileExists(filename)) return null;
    const value = legacyJson(filename, defaultValue);
    if (!hasItems(value)) return null;
    const existing = await readExistingKV('sys', key, defaultValue);
    if (await kvExists('sys', key) && hasMeaningfulKvValue(key, existing, value)) return null;
    await writeKV('sys', key, value);
    return `sys/${key}`;
}

async function migrateUploadHistory() {
    const items = legacyJson('upload_history.json', []);
    if (!legacyFileExists('upload_history.json') || !Array.isArray(items) || !items.length) return null;
    await uploadHistoryRepo.ensureReady();
    if (await tableHasAllKeys('upload_history', 'id', items.map(item => item && item.id))) return null;

    for (const item of items) {
        if (!item || !item.id || !item.tool || !item.action || !item.time) continue;
        await run(
            `INSERT OR REPLACE INTO upload_history (id, tool, action, detail, time)
             VALUES (?, ?, ?, ?, ?)`,
            [String(item.id), String(item.tool), String(item.action), String(item.detail || ''), String(item.time)]
        );
    }
    return `upload_history:${items.length}`;
}

async function migrateUivCategories() {
    const items = legacyJson('uiv_categories.json', []);
    if (!legacyFileExists('uiv_categories.json') || !Array.isArray(items) || !items.length) return null;
    await uivCategoriesRepo.ensureReady();
    if (await tableCount('uiv_categories', 'WHERE is_default = 0') > 0) return null;
    await uivCategoriesRepo.replaceCategories(items);
    return `uiv_categories:${items.length}`;
}

async function migrateUivScripts() {
    const items = legacyJson('uiv_scripts.json', []);
    if (!legacyFileExists('uiv_scripts.json') || !Array.isArray(items) || !items.length) return null;
    await uivScriptsRepo.ensureReady();
    if (await tableHasAllKeys('uiv_scripts', 'id', items.map(item => item && item.id))) return null;
    await uivScriptsRepo.replaceAllScripts(items);
    return `uiv_scripts:${items.length}`;
}

async function migrateSlaCategories() {
    const items = legacyJson('sla_categories.json', []);
    if (!legacyFileExists('sla_categories.json') || !Array.isArray(items) || !items.length) return null;
    await slaCategoriesRepo.ensureReady();
    if (await tableCount('sla_categories') > slaCategoriesRepo.DEFAULT_CATEGORIES.length) return null;
    await slaCategoriesRepo.replaceCategories(items);
    return `sla_categories:${items.length}`;
}

async function migrateSlaGroups() {
    const items = legacyJson('sla_groups.json', []);
    if (!legacyFileExists('sla_groups.json') || !Array.isArray(items) || !items.length) return null;
    await slaGroupsRepo.ensureReady();
    if (await tableHasAllKeys('sla_groups', 'group_key', items.map(item => item && item.id))) return null;
    await slaGroupsRepo.replaceGroups(items);
    return `sla_groups:${items.length}`;
}

async function migrateSlaTargets() {
    const items = legacyJson('sla_targets.json', {});
    if (!legacyFileExists('sla_targets.json') || !hasItems(items)) return null;
    await slaTargetsRepo.ensureReady();
    if (await tableHasAllKeys('sla_targets', 'target_key', Object.keys(items))) return null;
    await slaTargetsRepo.replaceTargets(items);
    return `sla_targets:${Object.keys(items).length}`;
}

async function migrateSlaPrefs() {
    const items = legacyJson('sla_prefs.json', {});
    if (!legacyFileExists('sla_prefs.json') || !hasItems(items)) return null;
    await slaPrefsRepo.ensureReady();
    const prefKeys = Object.keys(items).filter(key => key !== 'i18nMap');
    if (prefKeys.length) {
        const placeholders = prefKeys.map(() => '?').join(',');
        const rows = await all(`SELECT pref_key FROM sla_prefs WHERE pref_key IN (${placeholders})`, prefKeys);
        if (rows.length >= prefKeys.length) return null;
    } else if (await tableCount('sla_prefs') > 0 || await tableCount('sys_dictionaries', "WHERE category = 'i18n'") > 0) {
        return null;
    }
    await slaPrefsRepo.replacePrefs(items);
    return `sla_prefs:${Object.keys(items).length}`;
}

async function migrateSlaSnapshots() {
    const items = legacyJson('sla_snapshots.json', []);
    if (!legacyFileExists('sla_snapshots.json') || !Array.isArray(items) || !items.length) return null;
    await slaSnapshotsRepo.ensureReady();
    if (await tableHasAllKeys('sla_snapshots', 'id', items.map(item => item && item.id))) return null;
    await slaSnapshotsRepo.replaceSnapshots(items);
    return `sla_snapshots:${items.length}`;
}

async function migrateFrtSnapshots() {
    const items = legacyJson('frt_snapshots.json', []);
    if (!legacyFileExists('frt_snapshots.json') || !Array.isArray(items) || !items.length) return null;
    await frtSnapshotsRepo.ensureReady();
    if (await tableHasAllKeys('frt_snapshots', 'id', items.map(item => item && item.id))) return null;

    for (const item of items) {
        if (!item || !item.id) continue;
        await run(
            `INSERT OR REPLACE INTO frt_snapshots (id, timestamp, month, payload_json, updated_at)
             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [String(item.id), String(item.timestamp || ''), String(item.month || ''), JSON.stringify(item)]
        );
    }
    return `frt_snapshots:${items.length}`;
}

async function migrateAuthUsers() {
    const items = legacyJson('users.json', {});
    if (!legacyFileExists('users.json') || !hasItems(items)) return null;
    await authUsersRepo.ensureReady();
    const existingCount = await tableCount('auth_users');
    if (existingCount > Object.keys(items).length && await tableHasAllKeys('auth_users', 'username', Object.keys(items))) return null;

    for (const [username, user] of Object.entries(items)) {
        if (!username || !user || !user.passwordHash) continue;
        await authUsersRepo.saveUser(username, user.role || 'user', user.passwordHash);
    }
    return `auth_users:${Object.keys(items).length}`;
}

async function migrateAuthSessions() {
    const items = legacyJson('sessions.json', {});
    if (!legacyFileExists('sessions.json') || !hasItems(items)) return null;
    await authSessionsRepo.ensureReady();
    if (await tableHasAllKeys('auth_sessions', 'token', Object.keys(items))) return null;

    for (const [token, session] of Object.entries(items)) {
        const user = session && session.user ? session.user : {};
        if (!token || !user.username || !user.role || !session.expiresAt) continue;
        await authSessionsRepo.saveSession(token, user.username, user.role, session.expiresAt);
    }
    return `auth_sessions:${Object.keys(items).length}`;
}

async function runStartupLegacyJsonMigration() {
    const migrated = [];
    const startedAt = new Date().toISOString();
    const steps = [
        {
            key: 'ai_settings',
            label: 'AI 助手设置',
            sourceFile: 'ai_settings.json',
            target: 'sys_kv_store/sys/ai_settings',
            fallback: {},
            run: () => migrateKvFile('ai_settings.json', 'ai_settings', {}),
            targetCount: async () => await kvExists('sys', 'ai_settings') ? 1 : 0
        },
        {
            key: 'custom_tools',
            label: '自定义工具注册表',
            sourceFile: 'custom_tools.json',
            target: 'sys_kv_store/sys/custom_tools',
            fallback: [],
            run: () => migrateKvFile('custom_tools.json', 'custom_tools', []),
            targetCount: async () => await kvExists('sys', 'custom_tools') ? 1 : 0
        },
        {
            key: 'nav_settings',
            label: '导航设置',
            sourceFile: 'nav_settings.json',
            target: 'sys_kv_store/sys/nav_settings',
            fallback: {},
            run: () => migrateKvFile('nav_settings.json', 'nav_settings', {}),
            targetCount: async () => await kvExists('sys', 'nav_settings') ? 1 : 0
        },
        {
            key: 'custom_report_templates',
            label: '自定义报表模板',
            sourceFile: 'custom_report_templates.json',
            target: 'sys_kv_store/sys/custom_report_templates',
            fallback: {},
            run: () => migrateKvFile('custom_report_templates.json', 'custom_report_templates', {}),
            targetCount: async () => await kvExists('sys', 'custom_report_templates') ? 1 : 0
        },
        {
            key: 'upload_history',
            label: '上传/操作历史',
            sourceFile: 'upload_history.json',
            target: 'upload_history',
            fallback: [],
            run: migrateUploadHistory,
            targetCount: () => tableCount('upload_history')
        },
        {
            key: 'uiv_categories',
            label: 'UIV 分类',
            sourceFile: 'uiv_categories.json',
            target: 'uiv_categories',
            fallback: [],
            run: migrateUivCategories,
            targetCount: () => tableCount('uiv_categories')
        },
        {
            key: 'uiv_scripts',
            label: 'UIV 脚本仓库',
            sourceFile: 'uiv_scripts.json',
            target: 'uiv_scripts',
            fallback: [],
            run: migrateUivScripts,
            targetCount: () => tableCount('uiv_scripts')
        },
        {
            key: 'sla_categories',
            label: 'SLA 分类',
            sourceFile: 'sla_categories.json',
            target: 'sla_categories',
            fallback: [],
            run: migrateSlaCategories,
            targetCount: () => tableCount('sla_categories')
        },
        {
            key: 'sla_groups',
            label: 'SLA 指标分组',
            sourceFile: 'sla_groups.json',
            target: 'sla_groups/sla_group_items',
            fallback: [],
            run: migrateSlaGroups,
            targetCount: () => tableCount('sla_groups')
        },
        {
            key: 'sla_targets',
            label: 'SLA 目标配置',
            sourceFile: 'sla_targets.json',
            target: 'sla_targets',
            fallback: {},
            run: migrateSlaTargets,
            targetCount: () => tableCount('sla_targets')
        },
        {
            key: 'sla_prefs',
            label: 'SLA 偏好与规则',
            sourceFile: 'sla_prefs.json',
            target: 'sla_prefs/sys_dictionaries',
            fallback: {},
            run: migrateSlaPrefs,
            targetCount: async () => (await tableCount('sla_prefs')) + (await tableCount('sys_dictionaries', "WHERE category = 'i18n'"))
        },
        {
            key: 'sla_snapshots',
            label: 'SLA 快照',
            sourceFile: 'sla_snapshots.json',
            target: 'sla_snapshots',
            fallback: [],
            run: migrateSlaSnapshots,
            targetCount: () => tableCount('sla_snapshots')
        },
        {
            key: 'frt_snapshots',
            label: 'FRT 快照',
            sourceFile: 'frt_snapshots.json',
            target: 'frt_snapshots',
            fallback: [],
            run: migrateFrtSnapshots,
            targetCount: () => tableCount('frt_snapshots')
        },
        {
            key: 'auth_users',
            label: '用户账号',
            sourceFile: 'users.json',
            target: 'auth_users',
            fallback: {},
            run: migrateAuthUsers,
            targetCount: () => tableCount('auth_users')
        },
        {
            key: 'auth_sessions',
            label: '登录会话',
            sourceFile: 'sessions.json',
            target: 'auth_sessions',
            fallback: {},
            run: migrateAuthSessions,
            targetCount: () => tableCount('auth_sessions')
        }
    ];

    const records = [];
    for (const step of steps) {
        records.push(await runStep(step, migrated));
    }

    const failedCount = records.filter(item => item.status === 'failed').length;
    const migratedCount = records.filter(item => item.status === 'success').length;
    const skippedCount = records.filter(item => item.status === 'skipped').length;
    const hasLegacyJson = records.some(item => item.legacyPresent);

    if (failedCount === 0 && hasLegacyJson) {
        try {
            const JSZip = require('jszip');
            const zip = new JSZip();
            const filesToDelete = [];
            let addedToZip = false;

            for (const record of records) {
                if (record.legacyPresent && record.sourceFile) {
                    const filePath = path.join(DATA_DIR, record.sourceFile);
                    if (fs.existsSync(filePath)) {
                        const content = fs.readFileSync(filePath);
                        zip.file(record.sourceFile, content);
                        filesToDelete.push(filePath);
                        addedToZip = true;
                    }
                }
            }

            if (addedToZip) {
                const ts = new Date().toISOString().replace(/[:.]/g, '-');
                const zipPath = path.join(DATA_DIR, `legacy_json_backup_${ts}.zip`);
                const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
                fs.writeFileSync(zipPath, content);
                console.log(`[legacy-json-migration] created backup zip: ${zipPath}`);

                for (const filePath of filesToDelete) {
                    fs.unlinkSync(filePath);
                    console.log(`[legacy-json-migration] deleted old json: ${filePath}`);
                }
            }
        } catch (e) {
            console.error('[legacy-json-migration] failed to zip and delete old json files:', e);
        }
    }

    lastMigrationReport = {
        status: failedCount ? 'failed' : (migratedCount ? 'success' : 'skipped'),
        startedAt,
        finishedAt: new Date().toISOString(),
        hasLegacyJson,
        migratedCount,
        failedCount,
        skippedCount,
        steps: records
    };

    if (migrated.length) {
        console.log(`[legacy-json-migration] migrated ${migrated.join(', ')}`);
    }
    return migrated;
}

function getLastMigrationReport() {
    return lastMigrationReport;
}

module.exports = {
    runStartupLegacyJsonMigration,
    getLastMigrationReport
};
