const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { initializeBuiltinTools } = require('./builtin-tools-sync');
const {
    BASE_DATA_DIR,
    BASE_REPORT_DATA_DIR,
    DEFAULT_TENANT_ID,
    ensureTenantDirs,
    getDataDir,
    getReportDataDir
} = require('./tenant-context');

const GLOBAL_TABLES = new Set(['auth_users', 'auth_sessions', 'tenants', 'user_tenants']);

function all(db, sql, params = []) {
    return new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows || [])));
}
function exec(db, sql) {
    return new Promise((resolve, reject) => db.exec(sql, error => error ? reject(error) : resolve()));
}
function close(db) {
    return new Promise(resolve => db.close(() => resolve()));
}

async function cloneSchema(sourcePath, destinationPath, excludedTables = new Set()) {
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    if (!fs.existsSync(sourcePath)) {
        const empty = new sqlite3.Database(destinationPath);
        await close(empty);
        return;
    }
    const source = new sqlite3.Database(sourcePath, sqlite3.OPEN_READONLY);
    const destination = new sqlite3.Database(destinationPath);
    try {
        const rows = await all(source, `SELECT type, name, tbl_name, sql FROM sqlite_master
            WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
            ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END, name`);
        for (const row of rows) {
            if (excludedTables.has(row.name) || excludedTables.has(row.tbl_name)) continue;
            await exec(destination, row.sql);
        }
    } finally {
        await close(source);
        await close(destination);
    }
}

async function initializeTenantStorage(tenantId) {
    if (tenantId === DEFAULT_TENANT_ID) return ensureTenantDirs(tenantId);
    const dataDir = getDataDir(tenantId);
    const reportDir = getReportDataDir(tenantId);
    if (fs.existsSync(dataDir)) throw new Error(`租户存储目录已存在：${tenantId}`);
    fs.mkdirSync(path.dirname(dataDir), { recursive: true });
    const stagingDir = path.join(path.dirname(dataDir), `.creating-${tenantId}-${process.pid}-${Date.now()}`);
    try {
        fs.mkdirSync(stagingDir, { recursive: false });
        await cloneSchema(path.join(BASE_DATA_DIR, 'tools.db'), path.join(stagingDir, 'tools.db'), GLOBAL_TABLES);
        await cloneSchema(path.join(BASE_DATA_DIR, 'requirements.db'), path.join(stagingDir, 'requirements.db'));
        await cloneSchema(path.join(BASE_DATA_DIR, 'ai-knowledge.db'), path.join(stagingDir, 'ai-knowledge.db'));
        await cloneSchema(path.join(BASE_REPORT_DATA_DIR, 'report.db'), path.join(stagingDir, 'report.db'));
        fs.mkdirSync(path.join(stagingDir, 'images'), { recursive: true });
        fs.mkdirSync(path.join(stagingDir, 'custom-tools'), { recursive: true });
        initializeBuiltinTools({
            sourceDir: path.join(__dirname, '../builtin-tools'),
            targetDir: path.join(stagingDir, 'custom-tools'),
            stateFile: path.join(stagingDir, 'builtin-tools-sync-decisions.json'),
            backupRoot: path.join(stagingDir, 'backups', 'builtin-tools')
        });
        fs.renameSync(stagingDir, dataDir);
        return { dataDir, reportDir };
    } catch (error) {
        fs.rmSync(stagingDir, { recursive: true, force: true });
        throw error;
    }
}

module.exports = { GLOBAL_TABLES, cloneSchema, initializeTenantStorage };
