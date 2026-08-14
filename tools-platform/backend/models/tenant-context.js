const { AsyncLocalStorage } = require('async_hooks');
const fs = require('fs');
const path = require('path');

const DEFAULT_TENANT_ID = 'default';
const BASE_DATA_DIR = path.resolve(process.env.TOOLS_DATA_DIR || path.join(__dirname, '../data'));
const BASE_REPORT_DATA_DIR = path.resolve(process.env.TOOLS_REPORT_DATA_DIR
    || (process.env.TOOLS_DATA_DIR ? BASE_DATA_DIR : path.join(__dirname, '../../data')));
const TENANTS_ROOT = path.join(BASE_DATA_DIR, 'tenants');
const storage = new AsyncLocalStorage();

function normalizeTenantId(value) {
    const id = String(value || DEFAULT_TENANT_ID).trim().toLowerCase();
    return /^[a-z0-9][a-z0-9_-]{0,62}$/.test(id) ? id : DEFAULT_TENANT_ID;
}

function getTenantId() {
    return normalizeTenantId(storage.getStore()?.tenantId);
}

function runWithTenant(tenantId, callback) {
    return storage.run({ tenantId: normalizeTenantId(tenantId) }, callback);
}

function getDataDir(tenantId = getTenantId()) {
    const id = normalizeTenantId(tenantId);
    return id === DEFAULT_TENANT_ID ? BASE_DATA_DIR : path.join(TENANTS_ROOT, id);
}

function getReportDataDir(tenantId = getTenantId()) {
    const id = normalizeTenantId(tenantId);
    return id === DEFAULT_TENANT_ID ? BASE_REPORT_DATA_DIR : getDataDir(id);
}

function ensureTenantDirs(tenantId = getTenantId()) {
    const dataDir = getDataDir(tenantId);
    const reportDir = getReportDataDir(tenantId);
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(reportDir, { recursive: true });
    return { dataDir, reportDir };
}

function tenantMiddleware(req, _res, next) {
    runWithTenant(req.user?.tenantId || DEFAULT_TENANT_ID, next);
}

module.exports = {
    BASE_DATA_DIR,
    BASE_REPORT_DATA_DIR,
    DEFAULT_TENANT_ID,
    TENANTS_ROOT,
    ensureTenantDirs,
    getDataDir,
    getReportDataDir,
    getTenantId,
    normalizeTenantId,
    runWithTenant,
    tenantMiddleware
};
