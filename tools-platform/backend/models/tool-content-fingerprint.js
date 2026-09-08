'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MANIFEST_NAME = '.tool-manifest.json';
const TEXT_EXTENSIONS = new Set([
    '.css', '.csv', '.html', '.js', '.json', '.md', '.mjs', '.py', '.svg', '.txt', '.xml'
]);

function stableJson(value) {
    if (Array.isArray(value)) return value.map(stableJson);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableJson(value[key])]));
}

function canonicalContent(relativePath, content) {
    const extension = path.extname(relativePath).toLowerCase();
    if (relativePath === MANIFEST_NAME) {
        const manifest = JSON.parse(content.toString('utf8'));
        delete manifest.builtIn;
        delete manifest.system;
        delete manifest.market;
        return Buffer.from(JSON.stringify(stableJson(manifest)), 'utf8');
    }
    if (!TEXT_EXTENSIONS.has(extension)) return content;
    return Buffer.from(content.toString('utf8').replace(/\r\n?/g, '\n'), 'utf8');
}

function fingerprintFiles(rootDir, files) {
    const hash = crypto.createHash('sha256');
    const resolvedRoot = path.resolve(rootDir);
    for (const relativePath of [...files].sort()) {
        const absolutePath = path.resolve(rootDir, relativePath);
        if (!absolutePath.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error(`Unsafe tool path: ${relativePath}`);
        hash.update(relativePath);
        hash.update('\0');
        hash.update(canonicalContent(relativePath, fs.readFileSync(absolutePath)));
        hash.update('\0');
    }
    return hash.digest('hex');
}

module.exports = { canonicalContent, fingerprintFiles };
