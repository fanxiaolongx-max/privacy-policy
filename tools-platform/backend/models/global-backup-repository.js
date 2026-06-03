const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

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

function listBackups() {
    ensureDir(BACKUP_DIR);
    return fs.readdirSync(BACKUP_DIR)
        .filter(name => name.endsWith('.zip'))
        .map(name => {
            const filePath = path.join(BACKUP_DIR, name);
            const stat = fs.statSync(filePath);
            return {
                name,
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

function execFileAsync(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        execFile(command, args, options, (error, stdout, stderr) => {
            if (error) {
                error.message = `${error.message}${stderr ? `\n${stderr}` : ''}`;
                return reject(error);
            }
            resolve({ stdout, stderr });
        });
    });
}

async function createBackup(options = {}) {
    ensureDir(BACKUP_DIR);
    const reason = options.reason || 'manual';
    const filename = `tools-platform-backup_${timestampForFile()}_${safeName(reason)}.zip`;
    const outputPath = path.join(BACKUP_DIR, filename);
    const manifest = getManifest(reason);
    const manifestDir = path.join(BACKUP_DIR, `.tmp_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`);
    const manifestPath = path.join(manifestDir, 'manifest.json');
    ensureDir(manifestDir);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    try {
        const targetPaths = DATA_TARGETS
            .map(target => target.relPath)
            .filter(relPath => fs.existsSync(path.join(ROOT_DIR, relPath)));
        if (targetPaths.length) {
            await execFileAsync('/usr/bin/zip', ['-r', '-q', outputPath, ...targetPaths], { cwd: ROOT_DIR });
        }
        await execFileAsync('/usr/bin/zip', ['-j', '-q', outputPath, manifestPath], { cwd: ROOT_DIR });
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
    } finally {
        fs.rmSync(manifestDir, { recursive: true, force: true });
    }
}

async function extractBackup(zipPath) {
    ensureDir(RESTORE_TMP_DIR);
    const extractId = `restore_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const extractDir = path.join(RESTORE_TMP_DIR, extractId);
    ensureDir(extractDir);

    await execFileAsync('/usr/bin/unzip', ['-q', zipPath, '-d', extractDir], { cwd: ROOT_DIR });

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

function copyDirRecursive(src, dest) {
    if (!fs.existsSync(src)) return;
    fs.rmSync(dest, { recursive: true, force: true });
    fs.mkdirSync(dest, { recursive: true });
    fs.cpSync(src, dest, { recursive: true, force: true });
}

async function restoreFromZip(zipPath, options = {}) {
    const safetyBackup = options.skipSafetyBackup ? null : await createBackup({ reason: 'pre-restore' });
    const { extractDir, manifest } = await extractBackup(zipPath);
    try {
        DATA_TARGETS.forEach(target => {
            const src = path.join(extractDir, target.relPath);
            const dest = path.join(ROOT_DIR, target.relPath);
            if (fs.existsSync(src)) copyDirRecursive(src, dest);
        });
        return {
            success: true,
            restoredAt: new Date().toISOString(),
            manifest,
            safetyBackup,
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
