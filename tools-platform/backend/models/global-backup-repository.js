const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const JSZip = require('jszip');

const { DATA_DIR } = require('./store');
const { REPORT_DATA_DIR } = require('./report-store');
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

const REPORT_OWNED_FILES = ['report.db', 'report.db-wal', 'report.db-shm'];
const HAS_SPLIT_REPORT_DATA = path.resolve(REPORT_DATA_DIR) !== path.resolve(DATA_DIR);
const DATA_TARGETS = [
    {
        id: 'primary_data',
        absPath: DATA_DIR,
        relPath: process.env.TOOLS_DATA_DIR ? 'data' : 'backend/data',
        excludeTopLevel: ['images', ...(HAS_SPLIT_REPORT_DATA ? REPORT_OWNED_FILES : [])]
    }
];

if (HAS_SPLIT_REPORT_DATA) {
    DATA_TARGETS.push({
        id: 'report_data',
        absPath: REPORT_DATA_DIR,
        relPath: 'data（不含 images）',
        includeTopLevel: REPORT_OWNED_FILES
    });
}

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function safeName(name) {
    return String(name || '').replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function timestampForFile() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

function reportProgress(options, stage, message, detail = null, level = 'info') {
    if (!options || typeof options.onProgress !== 'function') return;
    try {
        options.onProgress({ stage, message, detail, level, timestamp: new Date().toISOString() });
    } catch (err) {
        console.warn('[GLOBAL BACKUP] Progress reporter failed:', err.message);
    }
}

function countFilesAndBytes(dir, options = {}) {
    const result = { files: 0, bytes: 0 };
    if (!fs.existsSync(dir)) return result;
    const excludedNames = new Set(options.excludeNames || []);
    const includedNames = options.includeNames ? new Set(options.includeNames) : null;
    const stack = [dir];
    while (stack.length) {
        const current = stack.pop();
        const entries = fs.readdirSync(current, { withFileTypes: true });
        entries.forEach(entry => {
            const fullPath = path.join(current, entry.name);
            const relative = path.relative(dir, fullPath);
            const topLevelName = relative.split(path.sep)[0];
            if (excludedNames.has(topLevelName)) return;
            if (includedNames && !includedNames.has(topLevelName)) return;
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
            relPath: target.relPath || target.id,
            excluded: target.excludeTopLevel || [],
            included: target.includeTopLevel || null,
            exists: fs.existsSync(absPath),
            ...countFilesAndBytes(absPath, {
                excludeNames: target.excludeTopLevel || [],
                includeNames: target.includeTopLevel || null
            })
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

function isTargetPathExcluded(target, absPath) {
    const excluded = new Set(target.excludeTopLevel || []);
    const included = target.includeTopLevel ? new Set(target.includeTopLevel) : null;
    if (!excluded.size && !included) return false;
    const relative = path.relative(target.absPath, absPath);
    if (!relative || relative.startsWith('..')) return false;
    const topLevelName = relative.split(path.sep)[0];
    if (excluded.has(topLevelName)) return true;
    return !!(included && !included.has(topLevelName));
}

function addPathToZip(zip, absPath, relPath, target) {
    if (!fs.existsSync(absPath)) return;
    if (isTargetPathExcluded(target, absPath)) return;
    const stat = fs.statSync(absPath);
    if (stat.isDirectory()) {
        const entries = fs.readdirSync(absPath, { withFileTypes: true });
        entries.forEach(entry => {
            addPathToZip(zip, path.join(absPath, entry.name), path.join(relPath, entry.name), target);
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
            addPathToZip(zip, absPath, target.id, target);
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
    const externalMetricsRepo = require('./external-metrics-repository');
    const requirementsRoute = require('../routes/requirements');
    const results = [];
    results.push(await closeSqliteDatabase('tools.db', appDb.closeDatabase));
    results.push(await closeSqliteDatabase('report.db', reportRoute.closeDatabase));
    results.push(await closeSqliteDatabase('external metrics report.db', externalMetricsRepo.closeDatabase));
    results.push(await closeSqliteDatabase('requirements.db', requirementsRoute.closeDatabase));
    return results;
}

async function createBackup(options = {}) {
    ensureDir(BACKUP_DIR);
    const reason = options.reason || 'manual';
    const filename = `tools-platform-backup_${timestampForFile()}_${safeName(reason)}.zip`;
    const outputPath = path.join(BACKUP_DIR, filename);
    reportProgress(options, 'scan', '正在扫描备份数据目录');
    const manifest = getManifest(reason);
    reportProgress(options, 'manifest', `已生成清单：${manifest.totalFiles} 个文件，${manifest.totalBytes} 字节`, {
        targets: manifest.targets.map(item => ({ id: item.id, files: item.files, bytes: item.bytes }))
    });

    try {
        reportProgress(options, 'compress', '正在压缩备份数据');
        await writeZip(outputPath, manifest);
        const stat = fs.statSync(outputPath);
        reportProgress(options, 'backup-ready', `备份包生成完成：${filename}`, { size: stat.size }, 'success');
        return {
            name: filename,
            size: stat.size,
            createdAt: stat.birthtime.toISOString(),
            modifiedAt: stat.mtime.toISOString(),
            manifest
        };
    } catch (err) {
        fs.rmSync(outputPath, { force: true });
        reportProgress(options, 'backup-error', `备份生成失败：${err.message}`, null, 'error');
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

function removeRestoreDirBestEffort(extractDir, options = {}) {
    if (!extractDir || !fs.existsSync(extractDir)) return true;
    try {
        fs.rmSync(extractDir, {
            recursive: true,
            force: true,
            maxRetries: 8,
            retryDelay: 150
        });
        return true;
    } catch (err) {
        console.warn(`[GLOBAL BACKUP] Restore data completed, but temporary directory cleanup was delayed: ${extractDir}`, err.message);
        if (options.scheduleRetry !== false) {
            const retryTimer = setTimeout(() => {
                removeRestoreDirBestEffort(extractDir, { scheduleRetry: false });
            }, 2000);
            if (retryTimer.unref) retryTimer.unref();
        }
        return false;
    }
}

async function extractBackup(zipPath) {
    ensureDir(RESTORE_TMP_DIR);
    const extractId = `restore_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const extractDir = path.join(RESTORE_TMP_DIR, extractId);
    ensureDir(extractDir);

    try {
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
    } catch (err) {
        removeRestoreDirBestEffort(extractDir);
        throw err;
    }
}

function syncDirRecursive(src, dest, options = {}) {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dest, { recursive: true });
    const excludedNames = new Set(options.excludeNames || []);
    const srcEntries = fs.readdirSync(src, { withFileTypes: true })
        .filter(entry => !excludedNames.has(entry.name));
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
        if (excludedNames.has(entry.name)) return;
        if (srcNames.has(entry.name)) return;
        const extraPath = path.join(dest, entry.name);
        try {
            fs.rmSync(extraPath, { recursive: true, force: true });
        } catch (err) {
            throw normalizeRestoreError(err, extraPath);
        }
    });
}

function syncOwnedFiles(src, dest, fileNames) {
    ensureDir(dest);
    fileNames.forEach(name => {
        const srcPath = path.join(src, name);
        const destPath = path.join(dest, name);
        try {
            if (fs.existsSync(srcPath) && fs.statSync(srcPath).isFile()) {
                fs.copyFileSync(srcPath, destPath);
            } else if (fs.existsSync(destPath)) {
                fs.rmSync(destPath, { force: true });
            }
        } catch (err) {
            throw normalizeRestoreError(err, destPath);
        }
    });
}

async function restoreFromZip(zipPath, options = {}) {
    reportProgress(options, 'restore-start', '开始恢复备份', { source: path.basename(zipPath) });
    reportProgress(options, 'safety-backup', '正在生成恢复前安全备份');
    const safetyBackup = options.skipSafetyBackup ? null : await createBackup({
        reason: 'pre-restore',
        onProgress: options.onProgress
    });
    reportProgress(options, 'extract', '正在校验并解压备份包');
    const { extractDir, manifest } = await extractBackup(zipPath);
    reportProgress(options, 'manifest-verified', `备份清单校验通过（版本 ${manifest.version}）`, {
        targets: (manifest.targets || []).map(item => item.id)
    }, 'success');
    reportProgress(options, 'database-close', '正在安全关闭 SQLite 数据库连接');
    const closedDatabases = await closeRuntimeDatabases();
    reportProgress(options, 'database-closed', 'SQLite 数据库连接已关闭', { closedDatabases }, 'success');
    try {
        const restoredTargets = [];
        const missingTargets = [];
        const primarySrc = path.join(extractDir, 'primary_data');
        const reportSrc = path.join(extractDir, 'report_data');
        const hasPrimary = fs.existsSync(primarySrc);
        const hasReport = fs.existsSync(reportSrc);
        const manifestPrimary = (manifest.targets || []).find(target => target.id === 'primary_data') || {};
        const packageUsesUnifiedData = manifestPrimary.relPath === 'data';

        if (hasPrimary) {
            reportProgress(options, 'primary-restore', '正在恢复主业务数据 primary_data');
            const primaryExcludes = new Set(['images']);
            if (HAS_SPLIT_REPORT_DATA || hasReport || !packageUsesUnifiedData) {
                REPORT_OWNED_FILES.forEach(name => primaryExcludes.add(name));
            }
            syncDirRecursive(primarySrc, DATA_DIR, { excludeNames: Array.from(primaryExcludes) });
            restoredTargets.push('primary_data');
            reportProgress(options, 'primary-restored', '主业务数据恢复完成', null, 'success');
        } else {
            missingTargets.push('primary_data');
            reportProgress(options, 'primary-missing', '备份包缺少 primary_data，已保留现有主数据', null, 'warn');
        }

        if (hasReport) {
            reportProgress(options, 'report-restore', '正在恢复报表数据库 report_data/report.db');
            syncOwnedFiles(reportSrc, REPORT_DATA_DIR, REPORT_OWNED_FILES);
            restoredTargets.push('report_data');
            reportProgress(options, 'report-restored', '报表数据库恢复完成', null, 'success');
        } else if (HAS_SPLIT_REPORT_DATA && packageUsesUnifiedData && hasPrimary) {
            // Windows backups store report.db inside primary_data. Split it back
            // into the dedicated report directory when restoring on Mac/PM2.
            syncOwnedFiles(primarySrc, REPORT_DATA_DIR, REPORT_OWNED_FILES);
            restoredTargets.push('report_data:from-primary_data');
            reportProgress(options, 'report-remapped', '已将 Windows 统一目录中的报表库映射到独立报表目录', null, 'success');
        } else if (HAS_SPLIT_REPORT_DATA || !packageUsesUnifiedData) {
            // Old Mac backups did not contain report_data. Preserve the current
            // report database and make the partial restore explicit.
            missingTargets.push('report_data');
            reportProgress(options, 'report-missing', '备份包缺少可用报表库，已保留现有报表数据', null, 'warn');
        }
        reportProgress(options, 'restore-complete', '全部数据恢复步骤已完成，等待服务重启', {
            restoredTargets,
            missingTargets
        }, missingTargets.length ? 'warn' : 'success');
        return {
            success: true,
            restoredAt: new Date().toISOString(),
            manifest,
            safetyBackup,
            closedDatabases,
            restoredTargets,
            missingTargets,
            partialRestore: missingTargets.length > 0,
            needsRestart: true
        };
    } finally {
        // Cleanup is secondary to a successful restore. Windows Defender or
        // indexing can briefly hold extracted files and cause ENOTEMPTY/EPERM.
        // Retry without turning a completed restore into a failed operation.
        const cleaned = removeRestoreDirBestEffort(extractDir);
        reportProgress(options, 'cleanup', cleaned ? '临时解压目录清理完成' : '临时目录正在后台延迟清理', null, cleaned ? 'success' : 'warn');
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
