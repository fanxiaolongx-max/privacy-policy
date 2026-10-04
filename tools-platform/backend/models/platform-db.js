const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { BASE_DATA_DIR } = require('./tenant-context');
const { initializeSqliteConnection } = require('./sqlite-connection-initializer');

fs.mkdirSync(BASE_DATA_DIR, { recursive: true });
const DB_PATH = path.join(BASE_DATA_DIR, 'tools.db');
const db = new sqlite3.Database(DB_PATH);
db.configure('busyTimeout', 5000);
const ready = initializeSqliteConnection(db);

async function run(sql, params = []) {
    await ready;
    return new Promise((resolve, reject) => db.run(sql, params, function (error) {
        error ? reject(error) : resolve({ lastID: this.lastID, changes: this.changes });
    }));
}
async function get(sql, params = []) {
    await ready;
    return new Promise((resolve, reject) => db.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));
}
async function all(sql, params = []) {
    await ready;
    return new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
}
async function closeDatabase() {
    await Promise.allSettled([ready]);
    return new Promise((resolve, reject) => db.close(error => error && error.code !== 'SQLITE_MISUSE' ? reject(error) : resolve()));
}

module.exports = { DB_PATH, all, closeDatabase, db, get, run };
