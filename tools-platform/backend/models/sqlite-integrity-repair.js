const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const { DATA_DIR, ensureDataDir } = require('./store');
const { REPORT_DATA_DIR, ensureReportDataDir } = require('./report-store');

function timestampForFile() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

function quoteSqlString(value) {
    return `'${String(value).replace(/'/g, "''")}'`;
}

function closeDb(db) {
    return new Promise((resolve, reject) => {
        db.close(err => err ? reject(err) : resolve());
    });
}

async function withDatabase(dbPath, fn) {
    const db = await new Promise((resolve, reject) => {
        const handle = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, err => {
            if (err) return reject(err);
            resolve(handle);
        });
    });

    try {
        return await fn(db);
    } finally {
        await closeDb(db).catch(() => {});
    }
}

function all(db, sql) {
    return new Promise((resolve, reject) => {
        db.all(sql, (err, rows) => err ? reject(err) : resolve(rows));
    });
}

function exec(db, sql) {
    return new Promise((resolve, reject) => {
        db.exec(sql, err => err ? reject(err) : resolve());
    });
}

async function integrityCheck(dbPath) {
    const rows = await withDatabase(dbPath, db => all(db, 'PRAGMA integrity_check'));
    const messages = rows
        .map(row => row.integrity_check || row[Object.keys(row)[0]])
        .filter(Boolean);
    return {
        ok: messages.length === 1 && messages[0] === 'ok',
        messages
    };
}

async function vacuumInto(sourcePath, targetPath) {
    await withDatabase(sourcePath, db => exec(db, `VACUUM INTO ${quoteSqlString(targetPath)}`));
}

async function repairSqliteFile({ label, dbPath }) {
    if (!fs.existsSync(dbPath)) {
        return { label, dbPath, status: 'missing' };
    }

    const stat = fs.statSync(dbPath);
    if (!stat.isFile() || stat.size === 0) {
        return { label, dbPath, status: 'skipped-empty' };
    }

    const before = await integrityCheck(dbPath);
    if (before.ok) {
        return { label, dbPath, status: 'ok' };
    }

    const backupDir = path.join(path.dirname(dbPath), 'backups');
    fs.mkdirSync(backupDir, { recursive: true });

    const stamp = timestampForFile();
    const base = path.basename(dbPath, '.db');
    const backupPath = path.join(backupDir, `${base}-before-auto-repair-${stamp}.db`);
    const repairedPath = path.join(backupDir, `${base}-auto-repaired-${stamp}.db`);

    fs.copyFileSync(dbPath, backupPath);
    if (fs.existsSync(repairedPath)) fs.unlinkSync(repairedPath);

    await vacuumInto(dbPath, repairedPath);
    const repaired = await integrityCheck(repairedPath);
    if (!repaired.ok) {
        return {
            label,
            dbPath,
            status: 'repair-failed',
            backupPath,
            repairedPath,
            before: before.messages,
            repaired: repaired.messages
        };
    }

    fs.copyFileSync(repairedPath, dbPath);
    const after = await integrityCheck(dbPath);
    if (!after.ok) {
        return {
            label,
            dbPath,
            status: 'replace-failed',
            backupPath,
            repairedPath,
            before: before.messages,
            after: after.messages
        };
    }

    return {
        label,
        dbPath,
        status: 'repaired',
        backupPath,
        repairedPath,
        before: before.messages
    };
}

async function repairStartupDatabases() {
    ensureDataDir();
    ensureReportDataDir();

    const databases = [
        { label: 'tools', dbPath: path.join(DATA_DIR, 'tools.db') },
        { label: 'requirements', dbPath: path.join(DATA_DIR, 'requirements.db') },
        { label: 'report', dbPath: path.join(REPORT_DATA_DIR, 'report.db') }
    ];

    const results = [];
    for (const item of databases) {
        try {
            const result = await repairSqliteFile(item);
            results.push(result);
            if (result.status === 'repaired') {
                console.warn(`[sqlite-repair] ${item.label} database repaired. backup=${result.backupPath}`);
            } else if (result.status && result.status.endsWith('failed')) {
                console.error(`[sqlite-repair] ${item.label} database repair failed: ${JSON.stringify(result)}`);
            }
        } catch (err) {
            const result = {
                ...item,
                status: 'error',
                error: err.message || String(err)
            };
            results.push(result);
            console.error(`[sqlite-repair] ${item.label} database check failed:`, err);
        }
    }

    return results;
}

module.exports = {
    repairStartupDatabases,
    repairSqliteFile,
    integrityCheck
};
