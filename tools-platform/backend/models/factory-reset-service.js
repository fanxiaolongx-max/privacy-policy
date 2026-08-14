const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { DATA_DIR } = require('./store');
const { REPORT_DATA_DIR } = require('./report-store');
const backupRepo = require('./global-backup-repository');
const usersRepo = require('./auth-users-repository');

const CONFIRMATION_TEXT = 'RESET';
const RESET_ROOT = path.resolve(DATA_DIR, '../factory-reset-archives');
const WORKER_PATH = path.join(__dirname, '../scripts/factory-reset-worker.js');

function timestampForFile() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

function writePrivateJson(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
}

async function prepareFactoryReset(options = {}) {
    if (String(options.confirmation || '').trim() !== CONFIRMATION_TEXT) {
        const error = new Error(`请输入 ${CONFIRMATION_TEXT} 确认彻底初始化`);
        error.statusCode = 400;
        throw error;
    }

    const username = String(options.actor || '').trim();
    const admin = await usersRepo.getUser(username);
    if (!admin || admin.role !== 'admin' || !admin.passwordHash) {
        const error = new Error('无法确认当前管理员身份，已取消初始化');
        error.statusCode = 403;
        throw error;
    }

    const backup = await backupRepo.createBackup({ reason: 'pre-factory-reset' });
    const archiveDir = path.join(RESET_ROOT, timestampForFile());
    const planPath = path.join(RESET_ROOT, `pending-${process.pid}-${Date.now()}.json`);
    writePrivateJson(planPath, {
        schemaVersion: 1,
        parentPid: process.pid,
        createdAt: new Date().toISOString(),
        dataDir: path.resolve(DATA_DIR),
        reportDataDir: path.resolve(REPORT_DATA_DIR),
        archiveDir,
        admin: { username, role: 'admin', passwordHash: admin.passwordHash }
    });

    const child = spawn(process.execPath, [WORKER_PATH, planPath], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
    });
    child.unref();

    return {
        success: true,
        backup: backup.name,
        archiveDir,
        needsRestart: true
    };
}

module.exports = { CONFIRMATION_TEXT, prepareFactoryReset };
