const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const PRESERVED_FILES = [
    'desktop-license-registry.json',
    'desktop-license-signing-key.json',
    'f12-license-registry.json',
    'f12-license-signing-key.json',
    'f12-extension-identities.json',
    'f12-extension-versions.json'
];

function isAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (_) {
        return false;
    }
}

function waitForExit(pid, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
        const started = Date.now();
        const timer = setInterval(() => {
            if (!isAlive(pid)) {
                clearInterval(timer);
                resolve();
            } else if (Date.now() - started > timeoutMs) {
                clearInterval(timer);
                reject(new Error('等待主程序退出超时'));
            }
        }, 25);
    });
}

function assertSafeDirectory(target) {
    const resolved = path.resolve(target);
    if (!path.isAbsolute(resolved) || resolved === path.parse(resolved).root || resolved.length < 8) {
        throw new Error(`拒绝操作不安全的目录：${resolved}`);
    }
    return resolved;
}

function moveDirectory(source, destination) {
    if (!fs.existsSync(source)) return false;
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.renameSync(source, destination);
    return true;
}

function copyPreservedFiles(archiveDataDir, dataDir) {
    for (const filename of PRESERVED_FILES) {
        const source = path.join(archiveDataDir, filename);
        if (!fs.existsSync(source)) continue;
        fs.copyFileSync(source, path.join(dataDir, filename));
    }
}

function createAdminDatabase(dataDir, admin) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(path.join(dataDir, 'tools.db'));
        db.serialize(() => {
            db.run(`CREATE TABLE auth_users (
                username TEXT PRIMARY KEY,
                role TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            db.run(
                'INSERT INTO auth_users (username, role, password_hash) VALUES (?, ?, ?)',
                [admin.username, 'admin', admin.passwordHash]
            );
        });
        db.close(error => error ? reject(error) : resolve());
    });
}

async function run(planPath) {
    const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    const dataDir = assertSafeDirectory(plan.dataDir);
    const reportDataDir = assertSafeDirectory(plan.reportDataDir);
    const archiveDir = assertSafeDirectory(plan.archiveDir);
    const logPath = path.join(path.dirname(planPath), `reset-${path.basename(archiveDir)}.log`);
    await waitForExit(Number(plan.parentPid));

    const sameDataDir = dataDir === reportDataDir;
    const archivedDataDir = path.join(archiveDir, 'primary-data');
    const archivedReportDir = path.join(archiveDir, 'report-data');
    let primaryMoved = false;
    let reportMoved = false;
    try {
        fs.mkdirSync(archiveDir, { recursive: true });
        primaryMoved = moveDirectory(dataDir, archivedDataDir);
        if (!sameDataDir) reportMoved = moveDirectory(reportDataDir, archivedReportDir);
        fs.mkdirSync(dataDir, { recursive: true });
        if (!sameDataDir) fs.mkdirSync(reportDataDir, { recursive: true });
        copyPreservedFiles(archivedDataDir, dataDir);
        await createAdminDatabase(dataDir, plan.admin);
        fs.writeFileSync(logPath, `Factory reset completed at ${new Date().toISOString()}\n`, 'utf8');
        fs.rmSync(planPath, { force: true });
    } catch (error) {
        fs.writeFileSync(logPath, `Factory reset failed at ${new Date().toISOString()}\n${error.stack || error.message}\n`, 'utf8');
        try {
            if (primaryMoved) {
                fs.rmSync(dataDir, { recursive: true, force: true });
                moveDirectory(archivedDataDir, dataDir);
            }
            if (reportMoved) {
                fs.rmSync(reportDataDir, { recursive: true, force: true });
                moveDirectory(archivedReportDir, reportDataDir);
            }
        } catch (rollbackError) {
            fs.appendFileSync(logPath, `Rollback failed:\n${rollbackError.stack || rollbackError.message}\n`, 'utf8');
        }
        try {
            fs.renameSync(planPath, `${planPath}.failed.json`);
        } catch (_) {
            // The diagnostic log and existing plan remain available for manual recovery.
        }
        throw error;
    }
}

if (require.main === module) {
    run(process.argv[2]).catch(() => { process.exitCode = 1; });
}

module.exports = { PRESERVED_FILES, assertSafeDirectory, createAdminDatabase, run };
