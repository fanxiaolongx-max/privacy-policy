const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const JSZip = require('jszip');

const { DATA_DIR } = require('./store');
const { readKV, writeKV } = require('./kv-store');

const BACKUP_DIR = path.join(DATA_DIR, '../backups');
const RESTORE_TMP_DIR = path.join(DATA_DIR, '../tmp/restores');
const BACKUP_VERSION = 2; // bumped version for the new path structure
const SCHEDULE_KV_CATEGORY = 'global_backup';
const SCHEDULE_KV_KEY = 'auto_schedule';
const AUTO_BACKUP_REASON = 'scheduled-auto';
const DEFAULT_SCHEDULE_SETTINGS = {
    enabled: true,
    time: '02:00',
    retentionDays: 90,
    lastRunAt: null,
    lastSuccessAt: null,
    lastBackupName: '',
    lastError: ''
};

let schedulerTimer = null;
let schedulerRunning = false;

const DATA_TARGETS = [
    { id: 'primary_data', absPath: DATA_DIR }
];

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function safeName(name) {
    return String(name || '').replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function timestampForFile() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

function countFilesAndBytes(dir) {
    const result = { files: 0, bytes: 0 };
    if (!fs.existsSync(dir)) return result;
    const stack = [dir];
    while (stack.length) {
        const current = stack.pop();
        const entries = fs.readdirSync(current, { withFileTypes: true });
        entries.forEach(entry => {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(fullPath);
            } else if (entry.isFile()) {
                const stat = fs.statSync(fullPath);
                result.files += 1;
                result.bytes += stat.size;
            }
        });
    }
    return result;
}

function getManifest(reason = 'manual') {
    const targets = DATA_TARGETS.map(target => {
        const absPath = target.absPath;
        return {
            id: target.id,
            path: target.id,
            exists: fs.existsSync(absPath),
            ...countFilesAndBytes(absPath)
        };
    });
    return {
        type: 'tools-platform-global-backup',
        version: BACKUP_VERSION,
        createdAt: new Date().toISOString(),
        reason,
        targets,
        totalFiles: targets.reduce((sum, item) => sum + item.files, 0),
        totalBytes: targets.reduce((sum, item) => sum + item.bytes, 0)
    };
}

function getReasonFromBackupName(name) {
    const match = String(name || '').match(/^tools-platform-backup_[^_]+_(.+)\.zip$/);
    return match ? match[1] : '';
}

function getBackupTriggerType(reason) {
    if (String(reason || '').startsWith('remote-sync-request')) return 'remote-sync-request';
    if (String(reason || '').startsWith('pre-restore')) return 'pre-restore';
    if (String(reason || '').startsWith(AUTO_BACKUP_REASON)) return 'scheduled-auto';
    return 'manual';
}

function normalizeScheduleSettings(raw = {}) {
    const timeRaw = String(raw.time || DEFAULT_SCHEDULE_SETTINGS.time).trim();
    const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(timeRaw) ? timeRaw : DEFAULT_SCHEDULE_SETTINGS.time;
    const retentionDays = Math.max(1, Math.min(3650, parseInt(raw.retentionDays, 10) || DEFAULT_SCHEDULE_SETTINGS.retentionDays));
    return {
        ...DEFAULT_SCHEDULE_SETTINGS,
        ...raw,
        enabled: raw.enabled !== false,
        time,
        retentionDays,
        lastRunAt: raw.lastRunAt || null,
        lastSuccessAt: raw.lastSuccessAt || null,
        lastBackupName: raw.lastBackupName || '',
        lastError: raw.lastError || ''
    };
}

function listBackups() {
    ensureDir(BACKUP_DIR);
    return fs.readdirSync(BACKUP_DIR)
        .filter(name => name.endsWith('.zip'))
        .map(name => {
            const filePath = path.join(BACKUP_DIR, name);
            const stat = fs.statSync(filePath);
            const reason = getReasonFromBackupName(name);
            return {
                name,
                reason,
                triggerType: getBackupTriggerType(reason),
                size: stat.size,
                createdAt: stat.birthtime.toISOString(),
                modifiedAt: stat.mtime.toISOString()
            };
        })
        .filter(item => item.size > 0)
        .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

function getBackupPath(name) {
    const cleaned = safeName(name);
    const fullPath = path.join(BACKUP_DIR, cleaned);
    if (!fullPath.startsWith(BACKUP_DIR + path.sep)) {
        throw new Error('非法备份文件名');
    }
    if (!fs.existsSync(fullPath)) {
        const err = new Error('备份文件不存在');
        err.statusCode = 404;
        throw err;
    }
    return fullPath;
}

function toZipPath(relPath) {
    return relPath.split(path.sep).join('/');
}

function assertSafeZipEntryName(entryName) {
    const normalized = String(entryName || '').replace(/\\/g, '/');
    if (!normalized || normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
        throw new Error(`备份包包含非法路径：${entryName}`);
    }
    if (normalized.split('/').some(part => part === '..')) {
        throw new Error(`备份包包含目录穿越路径：${entryName}`);
    }
    return normalized;
}

function getSafeExtractPath(extractDir, entryName) {
    const safeName = assertSafeZipEntryName(entryName);
    const targetPath = path.resolve(extractDir, ...safeName.split('/'));
    const root = path.resolve(extractDir);
    if (targetPath !== root && !targetPath.startsWith(root + path.sep)) {
        throw new Error(`备份包包含非法解压路径：${entryName}`);
    }
    return targetPath;
}

function normalizeRestoreError(err, targetPath) {
    if (err && ['EPERM', 'EBUSY', 'EACCES'].includes(err.code)) {
        const friendly = new Error(`恢复失败：Windows 正在占用数据文件，无法写入 ${targetPath}。请先停止 tools-platform 服务后重试，或恢复成功后立即重启服务。原始错误：${err.message}`);
        friendly.code = err.code;
        return friendly;
    }
    return err;
}

function addPathToZip(zip, absPath, relPath) {
    if (!fs.existsSync(absPath)) return;
    const stat = fs.statSync(absPath);
    if (stat.isDirectory()) {
        const entries = fs.readdirSync(absPath, { withFileTypes: true });
        entries.forEach(entry => {
            addPathToZip(zip, path.join(absPath, entry.name), path.join(relPath, entry.name));
        });
        return;
    }
    if (stat.isFile()) {
        zip.file(toZipPath(relPath), fs.readFileSync(absPath));
    }
}

async function writeZip(outputPath, manifest) {
    const zip = new JSZip();
    DATA_TARGETS.forEach(target => {
        const absPath = target.absPath;
        if (fs.existsSync(absPath)) {
            addPathToZip(zip, absPath, target.id);
        }
    });
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    const content = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    });
    fs.writeFileSync(outputPath, content);
}

async function extractZip(zipPath, extractDir) {
    const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
    const entries = Object.values(zip.files);
    for (const entry of entries) {
        const targetPath = getSafeExtractPath(extractDir, entry.name);
        if (entry.dir) {
            ensureDir(targetPath);
        } else {
            ensureDir(path.dirname(targetPath));
            fs.writeFileSync(targetPath, await entry.async('nodebuffer'));
        }
    }
}

function closeSqliteDatabase(label, closeFn) {
    if (typeof closeFn !== 'function') return Promise.resolve({ label, skipped: true });
    return closeFn()
        .then(() => ({ label, closed: true }))
        .catch(err => {
            if (err && err.code === 'SQLITE_MISUSE') return { label, alreadyClosed: true };
            throw err;
        });
}

async function closeRuntimeDatabases() {
    const appDb = require('./app-db');
    const reportRoute = require('../routes/db');
    const requirementsRoute = require('../routes/requirements');
    const results = [];
    results.push(await closeSqliteDatabase('tools.db', appDb.closeDatabase));
    results.push(await closeSqliteDatabase('report.db', reportRoute.closeDatabase));
    results.push(await closeSqliteDatabase('requirements.db', requirementsRoute.closeDatabase));
    return results;
}

async function createBackup(options = {}) {
    ensureDir(BACKUP_DIR);
    const reason = options.reason || 'manual';
    const filename = `tools-platform-backup_${timestampForFile()}_${safeName(reason)}.zip`;
    const outputPath = path.join(BACKUP_DIR, filename);
    const manifest = getManifest(reason);

    try {
        await writeZip(outputPath, manifest);
        const stat = fs.statSync(outputPath);
        return {
            name: filename,
            size: stat.size,
            createdAt: stat.birthtime.toISOString(),
            modifiedAt: stat.mtime.toISOString(),
            manifest
        };
    } catch (err) {
        fs.rmSync(outputPath, { force: true });
        throw err;
    }
}

function pruneScheduledBackups(retentionDays = DEFAULT_SCHEDULE_SETTINGS.retentionDays) {
    ensureDir(BACKUP_DIR);
    const days = Math.max(1, Math.min(3650, parseInt(retentionDays, 10) || DEFAULT_SCHEDULE_SETTINGS.retentionDays));
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const removed = [];
    listBackups().forEach(item => {
        if (item.triggerType !== 'scheduled-auto') return;
        const modifiedAt = new Date(item.modifiedAt || item.createdAt).getTime();
        if (!Number.isFinite(modifiedAt) || modifiedAt >= cutoff) return;
        try {
            const filePath = getBackupPath(item.name);
            fs.rmSync(filePath, { force: true });
            removed.push(item.name);
        } catch (err) {
            console.warn('[GLOBAL BACKUP] Failed to prune scheduled backup:', item.name, err.message);
        }
    });
    return { retentionDays: days, removedCount: removed.length, removed };
}

async function getScheduleSettings() {
    return normalizeScheduleSettings(await readKV(SCHEDULE_KV_CATEGORY, SCHEDULE_KV_KEY, DEFAULT_SCHEDULE_SETTINGS));
}

async function saveScheduleSettings(nextSettings = {}) {
    const current = await getScheduleSettings();
    const normalized = normalizeScheduleSettings({ ...current, ...nextSettings });
    await writeKV(SCHEDULE_KV_CATEGORY, SCHEDULE_KV_KEY, normalized);
    scheduleNextAutoBackup(normalized);
    return getScheduleStatus(normalized);
}

function getNextRunAt(settings = normalizeScheduleSettings()) {
    const normalized = normalizeScheduleSettings(settings);
    const [hour, minute] = normalized.time.split(':').map(Number);
    const next = new Date();
    next.setHours(hour, minute, 0, 0);
    if (next.getTime() <= Date.now()) {
        next.setDate(next.getDate() + 1);
    }
    return next;
}

function getScheduleStatus(settings = normalizeScheduleSettings()) {
    const normalized = normalizeScheduleSettings(settings);
    return {
        ...normalized,
        nextRunAt: normalized.enabled ? getNextRunAt(normalized).toISOString() : null,
        running: schedulerRunning
    };
}

function clearAutoBackupTimer() {
    if (schedulerTimer) {
        clearTimeout(schedulerTimer);
        schedulerTimer = null;
    }
}

function scheduleNextAutoBackup(settings = normalizeScheduleSettings()) {
    clearAutoBackupTimer();
    const normalized = normalizeScheduleSettings(settings);
    if (!normalized.enabled) {
        console.log('[GLOBAL BACKUP] Scheduled backup disabled.');
        return;
    }
    const nextRunAt = getNextRunAt(normalized);
    const delay = Math.max(1000, nextRunAt.getTime() - Date.now());
    schedulerTimer = setTimeout(() => {
        runScheduledBackup({ source: 'timer' }).catch(err => {
            console.error('[GLOBAL BACKUP] Scheduled backup failed:', err);
        });
    }, delay);
    if (schedulerTimer.unref) schedulerTimer.unref();
    console.log(`[GLOBAL BACKUP] Next scheduled backup: ${nextRunAt.toLocaleString('zh-CN', { hour12: false })}`);
}

async function runScheduledBackup(options = {}) {
    if (schedulerRunning) {
        const settings = await getScheduleSettings();
        return { skipped: true, reason: 'already-running', schedule: getScheduleStatus(settings) };
    }
    schedulerRunning = true;
    const settings = await getScheduleSettings();
    const startedAt = new Date().toISOString();
    let nextSettings = { ...settings, lastRunAt: startedAt, lastError: '' };
    try {
        const backup = await createBackup({ reason: options.reason || AUTO_BACKUP_REASON });
        const cleanup = pruneScheduledBackups(settings.retentionDays);
        nextSettings = {
            ...nextSettings,
            lastSuccessAt: new Date().toISOString(),
            lastBackupName: backup.name,
            lastError: ''
        };
        await writeKV(SCHEDULE_KV_CATEGORY, SCHEDULE_KV_KEY, normalizeScheduleSettings(nextSettings));
        return { success: true, backup, cleanup, schedule: getScheduleStatus(nextSettings) };
    } catch (err) {
        nextSettings = { ...nextSettings, lastError: err.message || String(err) };
        await writeKV(SCHEDULE_KV_CATEGORY, SCHEDULE_KV_KEY, normalizeScheduleSettings(nextSettings));
        throw err;
    } finally {
        schedulerRunning = false;
        if (options.reschedule !== false) {
            scheduleNextAutoBackup(await getScheduleSettings());
        }
    }
}

async function startAutoBackupScheduler() {
    const settings = await getScheduleSettings();
    scheduleNextAutoBackup(settings);
    return getScheduleStatus(settings);
}

async function extractBackup(zipPath) {
    ensureDir(RESTORE_TMP_DIR);
    const extractId = `restore_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const extractDir = path.join(RESTORE_TMP_DIR, extractId);
    ensureDir(extractDir);

    await extractZip(zipPath, extractDir);

    const manifestPath = path.join(extractDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
        throw new Error('备份包缺少 manifest.json，已拒绝恢复。');
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest.type !== 'tools-platform-global-backup' || manifest.version !== BACKUP_VERSION) {
        throw new Error('备份包类型或版本不匹配，已拒绝恢复。');
    }
    return { extractDir, manifest };
}

function syncDirRecursive(src, dest) {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dest, { recursive: true });
    const srcEntries = fs.readdirSync(src, { withFileTypes: true });
    const srcNames = new Set(srcEntries.map(entry => entry.name));

    srcEntries.forEach(entry => {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        try {
            if (entry.isDirectory()) {
                syncDirRecursive(srcPath, destPath);
            } else if (entry.isFile()) {
                fs.copyFileSync(srcPath, destPath);
            }
        } catch (err) {
            throw normalizeRestoreError(err, destPath);
        }
    });

    if (!fs.existsSync(dest)) return;
    fs.readdirSync(dest, { withFileTypes: true }).forEach(entry => {
        if (srcNames.has(entry.name)) return;
        const extraPath = path.join(dest, entry.name);
        try {
            fs.rmSync(extraPath, { recursive: true, force: true });
        } catch (err) {
            throw normalizeRestoreError(err, extraPath);
        }
    });
}

async function restoreFromZip(zipPath, options = {}) {
    const safetyBackup = options.skipSafetyBackup ? null : await createBackup({ reason: 'pre-restore' });
    const { extractDir, manifest } = await extractBackup(zipPath);
    const closedDatabases = await closeRuntimeDatabases();
    try {
        DATA_TARGETS.forEach(target => {
            const src = path.join(extractDir, target.id);
            const dest = target.absPath;
            if (fs.existsSync(src)) syncDirRecursive(src, dest);
        });
        return {
            success: true,
            restoredAt: new Date().toISOString(),
            manifest,
            safetyBackup,
            closedDatabases,
            needsRestart: true
        };
    } finally {
        fs.rmSync(extractDir, { recursive: true, force: true });
    }
}

function deleteBackup(name) {
    const filePath = getBackupPath(name);
    fs.rmSync(filePath, { force: true });
    return { success: true, name };
}

module.exports = {
    BACKUP_DIR,
    DATA_TARGETS,
    createBackup,
    listBackups,
    getBackupPath,
    restoreFromZip,
    deleteBackup,
    getScheduleSettings,
    saveScheduleSettings,
    getScheduleStatus,
    runScheduledBackup,
    startAutoBackupScheduler,
    pruneScheduledBackups
};
