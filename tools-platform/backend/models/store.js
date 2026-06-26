const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.TOOLS_DATA_DIR || path.join(__dirname, '../data');

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

module.exports = { ensureDataDir, DATA_DIR };
