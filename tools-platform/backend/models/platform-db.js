const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { BASE_DATA_DIR } = require('./tenant-context');

fs.mkdirSync(BASE_DATA_DIR, { recursive: true });
const DB_PATH = path.join(BASE_DATA_DIR, 'tools.db');
const db = new sqlite3.Database(DB_PATH);
db.serialize(() => {
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');
});

function run(sql, params = []) {
    return new Promise((resolve, reject) => db.run(sql, params, function (error) {
        error ? reject(error) : resolve({ lastID: this.lastID, changes: this.changes });
    }));
}
function get(sql, params = []) {
    return new Promise((resolve, reject) => db.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));
}
function all(sql, params = []) {
    return new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
}
function closeDatabase() {
    return new Promise((resolve, reject) => db.close(error => error && error.code !== 'SQLITE_MISUSE' ? reject(error) : resolve()));
}

module.exports = { DB_PATH, all, closeDatabase, db, get, run };
