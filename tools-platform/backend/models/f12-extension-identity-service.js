const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./store');

const IDENTITY_FILE = process.env.F12_EXTENSION_IDENTITIES_FILE
    || path.join(DATA_DIR, 'f12-extension-identities.json');

function normalizeProductId(value) {
    const productId = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 120);
    if (!productId) throw new Error('productId 不能为空');
    return productId;
}

function identityKey(productId) {
    return crypto.createHash('sha256').update(normalizeProductId(productId)).digest('hex');
}

function readRegistry() {
    if (!fs.existsSync(IDENTITY_FILE)) return { version: 1, identities: {} };
    const parsed = JSON.parse(fs.readFileSync(IDENTITY_FILE, 'utf8'));
    if (!parsed || parsed.version !== 1 || !parsed.identities || typeof parsed.identities !== 'object') {
        throw new Error('F12 扩展身份文件格式无效');
    }
    return parsed;
}

function writeRegistry(registry) {
    fs.mkdirSync(path.dirname(IDENTITY_FILE), { recursive: true });
    const tempFile = `${IDENTITY_FILE}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(registry, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tempFile, IDENTITY_FILE);
    try { fs.chmodSync(IDENTITY_FILE, 0o600); } catch (_error) {}
}

function isValidManifestKey(value) {
    try {
        const key = Buffer.from(String(value || ''), 'base64');
        if (key.length < 128) return false;
        crypto.createPublicKey({ key, format: 'der', type: 'spki' });
        return true;
    } catch (_error) {
        return false;
    }
}

function generateManifestKey() {
    const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    return publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
}

function getOrCreateIdentity(productId) {
    const safeProductId = normalizeProductId(productId);
    const key = identityKey(safeProductId);
    const registry = readRegistry();
    const existing = registry.identities[key];
    if (existing) {
        if (existing.productId !== safeProductId || !isValidManifestKey(existing.manifestKey)) {
            throw new Error('已保存的扩展身份记录无效，已拒绝自动更换 Manifest Key');
        }
        return existing;
    }

    const identity = {
        productId: safeProductId,
        manifestKey: generateManifestKey(),
        createdAt: new Date().toISOString()
    };
    registry.identities[key] = identity;
    writeRegistry(registry);
    return identity;
}

module.exports = {
    IDENTITY_FILE,
    getOrCreateIdentity,
    identityKey,
    isValidManifestKey,
    normalizeProductId
};
