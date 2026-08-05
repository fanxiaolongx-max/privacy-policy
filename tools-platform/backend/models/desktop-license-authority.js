const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./store');
const registry = require('./desktop-license-registry');

const TOKEN_PREFIX = 'DSKL1';
const ATTESTATION_PREFIX = 'DSKT1';
const KEY_FILE = process.env.DESKTOP_LICENSE_SIGNING_KEY_FILE
    || path.join(DATA_DIR, 'desktop-license-signing-key.json');

function encode(value) {
    return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
}

function ensureSigningKeys() {
    if (fs.existsSync(KEY_FILE)) {
        const saved = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
        if (saved.privateKeyPem && saved.publicKeyPem) return saved;
    }
    const pair = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const saved = {
        algorithm: 'ECDSA_P256_SHA256',
        createdAt: new Date().toISOString(),
        privateKeyPem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }),
        publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' })
    };
    fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true });
    fs.writeFileSync(KEY_FILE, `${JSON.stringify(saved, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    try { fs.chmodSync(KEY_FILE, 0o600); } catch (_) {}
    return saved;
}

function getPublicKeyJwk() {
    return crypto.createPublicKey(ensureSigningKeys().publicKeyPem).export({ format: 'jwk' });
}

function sign(prefix, payload) {
    const payloadPart = encode(payload);
    const signature = crypto.sign('sha256', Buffer.from(payloadPart), {
        key: ensureSigningKeys().privateKeyPem,
        dsaEncoding: 'ieee-p1363'
    }).toString('base64url');
    return `${prefix}.${payloadPart}.${signature}`;
}

function verifyToken(token) {
    const parts = String(token || '').trim().split('.');
    if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return { valid: false, reasonCode: 'INVALID_FORMAT' };
    try {
        const signatureValid = crypto.verify('sha256', Buffer.from(parts[1]), {
            key: ensureSigningKeys().publicKeyPem,
            dsaEncoding: 'ieee-p1363'
        }, Buffer.from(parts[2], 'base64url'));
        if (!signatureValid) return { valid: false, reasonCode: 'INVALID_SIGNATURE' };
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        if (!payload || payload.version !== 1 || payload.productId !== registry.PRODUCT_ID
            || typeof payload.licenseId !== 'string' || !Number.isFinite(payload.issuedAt)) {
            return { valid: false, reasonCode: 'INVALID_FORMAT' };
        }
        return { valid: true, payload };
    } catch (_) {
        return { valid: false, reasonCode: 'VERIFICATION_FAILED' };
    }
}

function issue({ label, days = 30, expiresAt } = {}) {
    const issuedAt = Date.now();
    const notBefore = issuedAt - 60000;
    let finalExpiresAt = Number(expiresAt);
    if (!Number.isFinite(finalExpiresAt)) {
        const safeDays = Math.max(1, Math.min(3650, Number.parseInt(days, 10) || 30));
        finalExpiresAt = issuedAt + safeDays * 86400000;
    }
    if (finalExpiresAt <= issuedAt) throw new Error('到期时间必须晚于当前时间');
    const licenseId = crypto.randomUUID();
    const payload = { version: 1, licenseId, productId: registry.PRODUCT_ID, issuedAt };
    const token = sign(TOKEN_PREFIX, payload);
    const record = registry.createRecord({ licenseId, label, token, notBefore, expiresAt: finalExpiresAt });
    return { token, payload, record, publicKeyJwk: getPublicKeyJwk() };
}

function signAttestation(payload) {
    return sign(ATTESTATION_PREFIX, payload);
}

module.exports = {
    ATTESTATION_PREFIX,
    KEY_FILE,
    TOKEN_PREFIX,
    ensureSigningKeys,
    getPublicKeyJwk,
    issue,
    signAttestation,
    verifyToken
};
