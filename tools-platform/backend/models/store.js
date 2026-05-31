/**
 * 数据存储模块 - 基于 JSON 文件的简单持久化
 * 所有数据存储在 backend/data/ 目录下
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');

function ensureDataDir() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getFilePath(filename) {
    return path.join(DATA_DIR, filename);
}

function readJSON(filename, defaultVal = null) {
    const fp = getFilePath(filename);
    try {
        if (!fs.existsSync(fp)) return defaultVal;
        return JSON.parse(fs.readFileSync(fp, 'utf-8'));
    } catch (e) {
        return defaultVal;
    }
}

function writeJSON(filename, data) {
    ensureDataDir();
    const fp = getFilePath(filename);
    fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
}

module.exports = { readJSON, writeJSON, ensureDataDir, DATA_DIR };
