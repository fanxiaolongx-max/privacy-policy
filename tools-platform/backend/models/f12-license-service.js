const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./store');
const licenseRegistry = require('./f12-license-registry');

const KEY_FILE = path.join(DATA_DIR, 'f12-license-signing-key.json');
const TOKEN_PREFIX = 'F12L1';
const ATTESTATION_PREFIX = 'F12T1';

function normalizeProductId(value) {
    const productId = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 120);
    if (!productId) throw new Error('productId 不能为空');
    return productId;
}

function normalizeMonth(value, now = new Date()) {
    const fallback = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const month = String(value || fallback).trim();
    if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month)) throw new Error('month 必须为 YYYY-MM');
    return month;
}

function getMonthWindow(month) {
    const [year, monthNumber] = month.split('-').map(Number);
    const notBefore = Date.UTC(year, monthNumber - 1, 1, 0, 0, 0, 0);
    const expiresAt = Date.UTC(year, monthNumber, 1, 0, 0, 0, 0);
    return { notBefore, expiresAt };
}

function writeKeyFile(record) {
    fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true });
    const tempFile = `${KEY_FILE}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(record, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tempFile, KEY_FILE);
    try { fs.chmodSync(KEY_FILE, 0o600); } catch (_err) {}
}

function ensureSigningKeys() {
    if (fs.existsSync(KEY_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
        if (parsed.privateKeyPem && parsed.publicKeyPem) return parsed;
        throw new Error('F12 License 签名密钥文件格式无效');
    }

    const pair = crypto.generateKeyPairSync('ec', {
        namedCurve: 'prime256v1',
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    const record = {
        algorithm: 'ECDSA_P256_SHA256',
        createdAt: new Date().toISOString(),
        publicKeyPem: pair.publicKey,
        privateKeyPem: pair.privateKey
    };
    writeKeyFile(record);
    return record;
}

function encodeBase64Url(value) {
    return Buffer.from(value).toString('base64url');
}

function issueMonthlyLicense({ productId, month, now = new Date(), label = '', renewedFrom = null }) {
    const safeProductId = normalizeProductId(productId);
    const safeMonth = normalizeMonth(month, now);
    const { notBefore, expiresAt } = getMonthWindow(safeMonth);
    const keys = ensureSigningKeys();
    const licenseId = crypto.randomUUID();
    const payload = {
        version: 1,
        licenseId,
        productId: safeProductId,
        month: safeMonth,
        notBefore,
        expiresAt
    };
    const payloadPart = encodeBase64Url(JSON.stringify(payload));
    const signature = crypto.sign('sha256', Buffer.from(payloadPart), {
        key: keys.privateKeyPem,
        dsaEncoding: 'ieee-p1363'
    }).toString('base64url');
    const publicKeyJwk = crypto.createPublicKey(keys.publicKeyPem).export({ format: 'jwk' });
    const token = `${TOKEN_PREFIX}.${payloadPart}.${signature}`;
    const record = licenseRegistry.createRecord({
        licenseId,
        productId: safeProductId,
        label,
        month: safeMonth,
        notBefore,
        expiresAt,
        token,
        renewedFrom
    });
    return {
        token,
        payload,
        record,
        publicKeyJwk,
        algorithm: 'ECDSA_P256_SHA256'
    };
}

function verifyLicenseToken(token, { productId, now = Date.now() } = {}) {
    const parts = String(token || '').trim().split('.');
    if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return { valid: false, reason: '格式无效', reasonCode: 'INVALID_FORMAT' };
    try {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        if (
            !payload
            || payload.version !== 1
            || typeof payload.productId !== 'string'
            || !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(String(payload.month || ''))
            || !Number.isFinite(payload.notBefore)
            || !Number.isFinite(payload.expiresAt)
            || payload.expiresAt <= payload.notBefore
        ) {
            return { valid: false, reason: '载荷无效', reasonCode: 'INVALID_FORMAT' };
        }
        const keys = ensureSigningKeys();
        const signatureValid = crypto.verify('sha256', Buffer.from(parts[1]), {
            key: keys.publicKeyPem,
            dsaEncoding: 'ieee-p1363'
        }, Buffer.from(parts[2], 'base64url'));
        if (!signatureValid) return { valid: false, reason: '签名无效', reasonCode: 'INVALID_SIGNATURE' };
        if (productId && payload.productId !== normalizeProductId(productId)) return { valid: false, reason: '产品不匹配', reasonCode: 'PRODUCT_MISMATCH', payload };
        if (Number(now) < payload.notBefore) return { valid: false, reason: '尚未生效', reasonCode: 'NOT_YET_VALID', payload };
        if (Number(now) >= payload.expiresAt) return { valid: false, reason: '已过期', reasonCode: 'EXPIRED', payload };
        return { valid: true, payload };
    } catch (error) {
        return { valid: false, reason: error.message || '校验失败', reasonCode: 'VERIFICATION_FAILED' };
    }
}

function signValidationAttestation(payload) {
    const keys = ensureSigningKeys();
    const payloadPart = encodeBase64Url(JSON.stringify(payload));
    const signature = crypto.sign('sha256', Buffer.from(payloadPart), {
        key: keys.privateKeyPem,
        dsaEncoding: 'ieee-p1363'
    }).toString('base64url');
    return `${ATTESTATION_PREFIX}.${payloadPart}.${signature}`;
}

module.exports = {
    ATTESTATION_PREFIX,
    KEY_FILE,
    TOKEN_PREFIX,
    ensureSigningKeys,
    getMonthWindow,
    issueMonthlyLicense,
    normalizeMonth,
    normalizeProductId,
    signValidationAttestation,
    verifyLicenseToken
};
