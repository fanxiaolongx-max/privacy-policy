const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const JSZip = require('jszip');

const ROOT_DIR = path.resolve(__dirname, '../..');
const BACKUP_DIR = path.join(ROOT_DIR, 'backend/backups');
const RESTORE_TMP_DIR = path.join(ROOT_DIR, 'backend/tmp/restores');
const BACKUP_VERSION = 1;

const DATA_TARGETS = [
    { id: 'backend_data', relPath: 'backend/data' },
    { id: 'root_data', relPath: 'data' }
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
        const absPath = path.join(ROOT_DIR, target.relPath);
        return {
            id: target.id,
            path: target.relPath,
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
    return 'manual';
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
        const absPath = path.join(ROOT_DIR, target.relPath);
        if (fs.existsSync(absPath)) {
            addPathToZip(zip, absPath, target.relPath);
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
            const src = path.join(extractDir, target.relPath);
            const dest = path.join(ROOT_DIR, target.relPath);
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

module.exports = {
    BACKUP_DIR,
    DATA_TARGETS,
    createBackup,
    listBackups,
    getBackupPath,
    restoreFromZip
};
