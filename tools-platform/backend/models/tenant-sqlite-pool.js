const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { ensureTenantDirs, getDataDir, getReportDataDir, getTenantId } = require('./tenant-context');

const pools = new Map();

function databasePath(filename, scope = 'data') {
    const tenantId = getTenantId();
    ensureTenantDirs(tenantId);
    const root = scope === 'report' ? getReportDataDir(tenantId) : getDataDir(tenantId);
    return path.join(root, filename);
}

function getConnection(filename, scope = 'data') {
    const filePath = databasePath(filename, scope);
    if (!pools.has(filePath)) pools.set(filePath, new sqlite3.Database(filePath));
    return pools.get(filePath);
}

function createDatabaseProxy(filename, scope = 'data') {
    return new Proxy({}, {
        get(_target, property) {
            const connection = getConnection(filename, scope);
            const value = connection[property];
            return typeof value === 'function' ? value.bind(connection) : value;
        }
    });
}

async function closeAll() {
    const connections = [...pools.values()];
    pools.clear();
    await closeConnections(connections);
}

async function closeConnections(connections) {
    await Promise.all(connections.map(connection => new Promise((resolve, reject) => {
        connection.close(error => error && error.code !== 'SQLITE_MISUSE' ? reject(error) : resolve());
    })));
}

async function closeTenant(tenantId) {
    const tenantRoot = path.resolve(getDataDir(tenantId));
    const matching = [...pools.entries()].filter(([filePath]) => {
        const resolved = path.resolve(filePath);
        return resolved === tenantRoot || resolved.startsWith(`${tenantRoot}${path.sep}`);
    });
    matching.forEach(([filePath]) => pools.delete(filePath));
    await closeConnections(matching.map(([, connection]) => connection));
}

module.exports = { closeAll, closeTenant, createDatabaseProxy, databasePath, getConnection };
