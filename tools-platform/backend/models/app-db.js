const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { ensureTenantDirs, getDataDir, getTenantId } = require('./tenant-context');
const { initializeSqliteConnection } = require('./sqlite-connection-initializer');

const connections = new Map();
const connectionReadiness = new WeakMap();

function getDbPath(tenantId = getTenantId()) {
    return path.join(getDataDir(tenantId), 'tools.db');
}

function getDatabase() {
    const tenantId = getTenantId();
    ensureTenantDirs(tenantId);
    const dbPath = getDbPath(tenantId);
    if (!connections.has(dbPath)) {
        const connection = new sqlite3.Database(dbPath);
        connection.configure('busyTimeout', 5000);
        connectionReadiness.set(connection, initializeSqliteConnection(connection));
        connections.set(dbPath, connection);
    }
    return connections.get(dbPath);
}

const db = new Proxy({}, {
    get(_target, property) {
        const value = getDatabase()[property];
        return typeof value === 'function' ? value.bind(getDatabase()) : value;
    }
});

async function run(sql, params = []) {
    const connection = getDatabase();
    await connectionReadiness.get(connection);
    return new Promise((resolve, reject) => connection.run(sql, params, function (error) {
        error ? reject(error) : resolve({ lastID: this.lastID, changes: this.changes });
    }));
}
async function get(sql, params = []) {
    const connection = getDatabase();
    await connectionReadiness.get(connection);
    return new Promise((resolve, reject) => connection.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));
}
async function all(sql, params = []) {
    const connection = getDatabase();
    await connectionReadiness.get(connection);
    return new Promise((resolve, reject) => connection.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
}
async function closeDatabase() {
    const entries = [...connections.entries()];
    connections.clear();
    await closeConnections(entries.map(([, connection]) => connection));
}

async function closeConnections(items) {
    await Promise.allSettled(items.map(connection => connectionReadiness.get(connection)));
    await Promise.all(items.map(connection => new Promise((resolve, reject) => {
        connection.close(error => error && error.code !== 'SQLITE_MISUSE' ? reject(error) : resolve());
    })));
}

async function closeTenant(tenantId) {
    const dbPath = getDbPath(tenantId);
    const connection = connections.get(dbPath);
    if (!connection) return;
    connections.delete(dbPath);
    await closeConnections([connection]);
}

module.exports = { all, closeDatabase, closeTenant, db, get, getDatabase, getDbPath, run };
