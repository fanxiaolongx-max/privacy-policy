const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const globalBackupRepo = require('./global-backup-repository');

const ROOT_DIR = path.resolve(__dirname, '../..');
const RUNTIME_DIR = path.join(ROOT_DIR, 'backend/runtime');
const DOWNLOAD_DIR = path.join(ROOT_DIR, 'backend/tmp/remote-backups');
const SETTINGS_FILE = path.join(RUNTIME_DIR, 'remote_backup_sync_settings.json');
const STATE_FILE = path.join(RUNTIME_DIR, 'remote_backup_sync_state.json');

const DEFAULT_SETTINGS = {
    enabled: false,
    baseUrl: '',
    username: '',
    password: '',
    compareBeforeRestore: true,
    createRemoteBackupBeforePull: true,
    autoRestore: false
};

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function readJSON(filePath, fallback) {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
        return fallback;
    }
}

function writeJSON(filePath, data) {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function normalizeBaseUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return withProtocol.replace(/\/+$/, '');
}

function normalizeSettings(input = {}, previous = {}) {
    const base = { ...DEFAULT_SETTINGS, ...previous, ...input };
    return {
        enabled: Boolean(base.enabled),
        baseUrl: normalizeBaseUrl(base.baseUrl),
        username: String(base.username || '').trim(),
        password: String(base.password || ''),
        compareBeforeRestore: base.compareBeforeRestore !== false,
        createRemoteBackupBeforePull: base.createRemoteBackupBeforePull !== false,
        autoRestore: Boolean(base.autoRestore)
    };
}

function maskSecret(value) {
    const text = String(value || '');
    if (!text) return '';
    if (text.length <= 2) return '**';
    return `${text.slice(0, 1)}****${text.slice(-1)}`;
}

function getSettings() {
    return normalizeSettings(readJSON(SETTINGS_FILE, DEFAULT_SETTINGS));
}

function getPublicSettings() {
    const settings = getSettings();
    const state = getState();
    return {
        enabled: settings.enabled,
        baseUrl: settings.baseUrl,
        username: settings.username,
        compareBeforeRestore: settings.compareBeforeRestore,
        createRemoteBackupBeforePull: settings.createRemoteBackupBeforePull,
        autoRestore: settings.autoRestore,
        hasPassword: Boolean(settings.password),
        maskedPassword: maskSecret(settings.password),
        lastSync: state.lastSync || null,
        lastCheck: state.lastCheck || null,
        lastError: state.lastError || ''
    };
}

function saveSettings(payload = {}) {
    const current = getSettings();
    const nextPayload = { ...payload };
    if (payload.clearPassword) {
        nextPayload.password = '';
    } else if (!Object.prototype.hasOwnProperty.call(payload, 'password') || String(payload.password || '') === '') {
        nextPayload.password = current.password;
    }
    const normalized = normalizeSettings(nextPayload, current);
    writeJSON(SETTINGS_FILE, normalized);
    return getPublicSettings();
}

function getState() {
    return readJSON(STATE_FILE, {});
}

function saveState(patch) {
    const next = { ...getState(), ...patch, updatedAt: new Date().toISOString() };
    writeJSON(STATE_FILE, next);
    return next;
}

async function fetchWithTimeout(url, options = {}) {
    const timeoutMs = options.timeoutMs || 30000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

async function fetchJson(url, options = {}) {
    const res = await fetchWithTimeout(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}

function assertUsableSettings(settings) {
    if (!settings.enabled) throw new Error('远端备份同步未启用');
    if (!settings.baseUrl) throw new Error('请填写远端服务器域名');
    if (!settings.username || !settings.password) throw new Error('请填写远端服务器账号和密码');
}

async function loginRemote(settings) {
    const data = await fetchJson(`${settings.baseUrl}/api/auth/login`, {
        method: 'POST',
        timeoutMs: 20000,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: settings.username, password: settings.password })
    });
    if (!data.token) throw new Error('远端登录成功但未返回 token');
    return data.token;
}

async function createRemoteBackup(settings, token) {
    const reasonUser = settings.username ? `_by_${settings.username}` : '';
    const data = await fetchJson(`${settings.baseUrl}/api/global-backup/create`, {
        method: 'POST',
        timeoutMs: 120000,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason: `remote-sync-request${reasonUser}` })
    });
    return data;
}

function sortBackups(backups) {
    return (backups || []).slice().sort((a, b) => {
        const am = String(a.modifiedAt || a.createdAt || '');
        const bm = String(b.modifiedAt || b.createdAt || '');
        if (am !== bm) return bm.localeCompare(am);
        return String(b.name || '').localeCompare(String(a.name || ''));
    });
}

async function fetchRemoteLatestBackup(settings, token) {
    assertUsableSettings(settings);
    const data = await fetchJson(`${settings.baseUrl}/api/global-backup/list`, {
        timeoutMs: 20000,
        headers: { Authorization: `Bearer ${token}` }
    });
    const latest = sortBackups(data.backups || [])[0] || null;
    saveState({
        lastCheck: {
            checkedAt: new Date().toISOString(),
            baseUrl: settings.baseUrl,
            backupCount: Array.isArray(data.backups) ? data.backups.length : 0,
            latest
        },
        lastError: ''
    });
    return { latest, backups: data.backups || [] };
}

function isSameBackup(a, b) {
    return Boolean(a && b && a.name === b.name && a.modifiedAt === b.modifiedAt && Number(a.size || 0) === Number(b.size || 0));
}

function shouldSkipLatest(settings, latest, options = {}) {
    if (!latest) return { skip: true, reason: '远端没有可用备份' };
    const state = getState();
    const lastSync = state.lastSync || null;
    if (settings.compareBeforeRestore && isSameBackup(lastSync && lastSync.remoteBackup, latest)) {
        return { skip: true, reason: '远端备份未更新，已跳过恢复' };
    }
    // Even when comparison is disabled, keep a short guard to avoid restore -> restart -> restore loops.
    if (!settings.compareBeforeRestore && !options.force && isSameBackup(lastSync && lastSync.remoteBackup, latest)) {
        const lastAt = Date.parse((lastSync && lastSync.restoredAt) || 0);
        if (Number.isFinite(lastAt) && Date.now() - lastAt < 6 * 60 * 60 * 1000) {
            return { skip: true, reason: '同一备份刚刚恢复过，已防止启动循环' };
        }
    }
    return { skip: false, reason: '' };
}

async function downloadRemoteBackup(settings, token, backup) {
    ensureDir(DOWNLOAD_DIR);
    const safeName = String(backup.name || `remote_${Date.now()}.zip`).replace(/[^a-zA-Z0-9._-]+/g, '_');
    const outputPath = path.join(DOWNLOAD_DIR, `${Date.now()}_${crypto.randomBytes(3).toString('hex')}_${safeName}`);
    const res = await fetchWithTimeout(`${settings.baseUrl}/api/global-backup/download/${encodeURIComponent(backup.name)}`, {
        timeoutMs: 120000,
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `下载远端备份失败：HTTP ${res.status}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);
    return outputPath;
}

async function pullRemoteBackup(options = {}) {
    const settings = getSettings();
    assertUsableSettings(settings);
    const startupGuard = shouldSkipStartupSync();
    if (options.source === 'startup' && startupGuard.skip) {
        return { success: true, checkedOnly: true, restored: false, skipped: true, message: startupGuard.reason };
    }
    const token = await loginRemote(settings);
    let remoteCreatedBackup = null;
    if (settings.createRemoteBackupBeforePull && options.createRemoteBackupBeforePull !== false) {
        remoteCreatedBackup = await createRemoteBackup(settings, token);
        console.log(`[REMOTE BACKUP] Requested fresh backup on remote: ${remoteCreatedBackup.name || '-'}`);
    }
    const { latest, backups } = await fetchRemoteLatestBackup(settings, token);
    if (!latest) {
        return { success: true, checkedOnly: true, restored: false, message: '远端没有可用备份', backups, remoteCreatedBackup };
    }
    const skip = shouldSkipLatest(settings, latest, options);
    if (skip.skip && !options.force) {
        return { success: true, checkedOnly: true, restored: false, skipped: true, message: skip.reason, latest, backups, remoteCreatedBackup };
    }
    if (!options.restore) {
        return { success: true, checkedOnly: true, restored: false, latest, backups, remoteCreatedBackup, message: '已发现远端最新备份，未执行恢复' };
    }

    const filePath = await downloadRemoteBackup(settings, token, latest);
    try {
        const restoreResult = await globalBackupRepo.restoreFromZip(filePath, { reason: 'remote-sync' });
        const lastSync = {
            restoredAt: new Date().toISOString(),
            baseUrl: settings.baseUrl,
            remoteBackup: latest,
            safetyBackup: restoreResult.safetyBackup || null
        };
        saveState({ lastSync, lastError: '' });
        return {
            success: true,
            checkedOnly: false,
            restored: true,
            latest,
            backups,
            remoteCreatedBackup,
            lastSync,
            restoreResult,
            needsRestart: true
        };
    } finally {
        fs.rmSync(filePath, { force: true });
    }
}

function shouldSkipStartupSync() {
    const lastSync = getState().lastSync || null;
    if (!lastSync) return { skip: false, reason: '' };
    const lastAt = Date.parse(lastSync.restoredAt || 0);
    if (Number.isFinite(lastAt) && Date.now() - lastAt < 2 * 60 * 1000) {
        return { skip: true, reason: '刚刚完成远端恢复，已跳过本次启动同步以防止恢复循环' };
    }
    return { skip: false, reason: '' };
}

async function runStartupRemoteSync() {
    const settings = getSettings();
    if (!settings.enabled || !settings.autoRestore) {
        console.log('[REMOTE BACKUP] Startup sync skipped: disabled or auto-restore off.');
        return { skipped: true };
    }
    try {
        console.log(`[REMOTE BACKUP] Startup sync checking ${settings.baseUrl} ...`);
        const result = await pullRemoteBackup({ restore: true, force: false, source: 'startup' });
        if (result.restored) {
            console.log(`[REMOTE BACKUP] Restored remote backup ${result.latest?.name || '-'}; exiting for clean restart.`);
            setTimeout(() => process.exit(0), 800);
        } else {
            console.log(`[REMOTE BACKUP] ${result.message || 'No restore needed.'}`);
        }
        return result;
    } catch (err) {
        saveState({ lastError: err.message || String(err) });
        console.error('[REMOTE BACKUP] Startup sync failed:', err.message || err);
        return { success: false, error: err.message || String(err) };
    }
}

module.exports = {
    getSettings,
    getPublicSettings,
    saveSettings,
    getState,
    pullRemoteBackup,
    runStartupRemoteSync
};
