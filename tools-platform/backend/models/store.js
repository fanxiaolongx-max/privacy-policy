const fs = require('fs');
const path = require('path');

const { BASE_DATA_DIR, getDataDir } = require('./tenant-context');
const DATA_DIR = BASE_DATA_DIR;

function ensureDataDir(tenantId) {
    const dataDir = getDataDir(tenantId);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    return dataDir;
}

function readJSON(filename, fallback) {
    ensureDataDir();
    const filePath = path.isAbsolute(filename) ? filename : path.join(getDataDir(), filename);
    try {
        if (!fs.existsSync(filePath)) return fallback;
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
        console.error(`[store] Failed to read JSON ${filename}:`, err.message);
        return fallback;
    }
}

module.exports = {
    ensureDataDir,
    DATA_DIR,
    getDataDir,
    readJSON
};
