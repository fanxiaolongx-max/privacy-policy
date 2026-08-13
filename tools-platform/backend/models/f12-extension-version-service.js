const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./store');
const identityService = require('./f12-extension-identity-service');
const packer = require('../builtin-tools/f12-to-extension/packer-core');

const VERSION_FILE = process.env.F12_EXTENSION_VERSIONS_FILE
    || path.join(DATA_DIR, 'f12-extension-versions.json');
const DEFAULT_BASELINE = '1.0.0';

function emptyRegistry() {
    return { version: 1, products: {} };
}

function readRegistry() {
    if (!fs.existsSync(VERSION_FILE)) return emptyRegistry();
    const parsed = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
    if (!parsed || parsed.version !== 1 || !parsed.products || typeof parsed.products !== 'object') {
        throw new Error('F12 扩展版本台账格式无效');
    }
    return parsed;
}

function writeRegistry(registry) {
    fs.mkdirSync(path.dirname(VERSION_FILE), { recursive: true });
    const tempFile = `${VERSION_FILE}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(registry, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tempFile, VERSION_FILE);
    try { fs.chmodSync(VERSION_FILE, 0o600); } catch (_error) {}
}

function compareVersions(left, right) {
    const leftParts = String(left).split('.').map(Number);
    const rightParts = String(right).split('.').map(Number);
    const length = Math.max(leftParts.length, rightParts.length);
    for (let index = 0; index < length; index++) {
        const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
        if (difference !== 0) return difference;
    }
    return 0;
}

function getRecord(registry, productId) {
    const safeProductId = identityService.normalizeProductId(productId);
    const key = identityService.identityKey(safeProductId);
    const existing = registry.products[key];
    if (existing && existing.productId !== safeProductId) {
        throw new Error('扩展版本台账中的产品标识不匹配');
    }
    return {
        key,
        safeProductId,
        record: existing || {
            productId: safeProductId,
            currentVersion: DEFAULT_BASELINE,
            downloadCount: 0,
            createdAt: new Date().toISOString()
        }
    };
}

function applyLegacyVersion(record, legacyVersion) {
    if (!packer.isValidVersion(legacyVersion)) return false;
    try {
        packer.incrementVersion(legacyVersion);
    } catch (_error) {
        return false;
    }
    if (compareVersions(legacyVersion, record.currentVersion) <= 0) return false;
    record.currentVersion = String(legacyVersion);
    record.migratedFromBrowserAt = new Date().toISOString();
    return true;
}

function versionInfo(record, options = {}) {
    return {
        productId: record.productId,
        previousVersion: record.currentVersion,
        nextVersion: packer.incrementVersion(record.currentVersion),
        hasSavedVersion: record.currentVersion !== DEFAULT_BASELINE || Number(record.downloadCount) > 0,
        downloadCount: Number(record.downloadCount) || 0,
        storage: 'server',
        ...options
    };
}

function previewVersion(productId, { legacyVersion } = {}) {
    const registry = readRegistry();
    const { key, record } = getRecord(registry, productId);
    const existed = Boolean(registry.products[key]);
    const migrated = applyLegacyVersion(record, legacyVersion);
    if (!existed || migrated) {
        record.updatedAt = new Date().toISOString();
        registry.products[key] = record;
        writeRegistry(registry);
    }
    return versionInfo(record, { migrated });
}

function reserveNextVersion(productId, { legacyVersion } = {}) {
    const registry = readRegistry();
    const { key, record } = getRecord(registry, productId);
    applyLegacyVersion(record, legacyVersion);
    const previousVersion = record.currentVersion;
    const allocatedVersion = packer.incrementVersion(previousVersion);
    record.currentVersion = allocatedVersion;
    record.downloadCount = (Number(record.downloadCount) || 0) + 1;
    record.updatedAt = new Date().toISOString();
    record.lastReservedAt = record.updatedAt;
    registry.products[key] = record;
    writeRegistry(registry);
    return versionInfo(record, { previousVersion, allocatedVersion });
}

module.exports = {
    VERSION_FILE,
    DEFAULT_BASELINE,
    compareVersions,
    previewVersion,
    reserveNextVersion
};
