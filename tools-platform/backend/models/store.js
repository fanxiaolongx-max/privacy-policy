const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.TOOLS_DATA_DIR || path.join(__dirname, '../data');

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

function readJSON(filename, fallback) {
    ensureDataDir();
    const filePath = path.isAbsolute(filename) ? filename : path.join(DATA_DIR, filename);
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
    readJSON
};
