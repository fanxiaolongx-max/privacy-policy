const crypto = require('crypto');
const express = require('express');
const authority = require('../models/desktop-license-authority');
const registry = require('../models/desktop-license-registry');
const trustedTime = require('../models/f12-trusted-time-service');

const router = express.Router();
const OFFLINE_GRACE_MS = 24 * 60 * 60 * 1000;
const ATTESTATION_TTL_MS = 10 * 60 * 1000;
const rateBuckets = new Map();

function allow(ip) {
    const key = String(ip || 'unknown');
    const now = Date.now();
    const current = rateBuckets.get(key);
    if (!current || now - current.startedAt >= 60000) {
        rateBuckets.set(key, { startedAt: now, count: 1 });
        return true;
    }
    current.count += 1;
    return current.count <= 60;
}

router.post('/validate', async (req, res) => {
    if (!allow(req.ip)) return res.status(429).json({ error: '请求过于频繁' });
    try {
        const token = String(req.body && req.body.token || '').trim();
        const nonce = String(req.body && req.body.nonce || '').trim();
        const productId = String(req.body && req.body.productId || '').trim();
        if (!/^[-_A-Za-z0-9]{16,128}$/.test(nonce)) return res.status(400).json({ error: 'nonce 无效' });
        if (!token || token.length > 8192) return res.status(400).json({ error: 'License 无效' });

        const clock = await trustedTime.getTrustedTime();
        let verification = authority.verifyToken(token);
        if (verification.valid && productId !== registry.PRODUCT_ID) {
            verification = { valid: false, reasonCode: 'PRODUCT_MISMATCH', payload: verification.payload };
        }
        let record = null;
        if (verification.valid) {
            const checked = registry.checkPayload(verification.payload, clock.now, token);
            record = checked.record || null;
            if (!checked.valid) verification = { valid: false, reasonCode: checked.reasonCode, payload: verification.payload };
        }

        const expiresAt = record ? Number(record.expiresAt) : 0;
        const payload = {
            version: 1,
            productId: registry.PRODUCT_ID,
            licenseId: verification.payload && verification.payload.licenseId || null,
            nonce,
            tokenDigest: crypto.createHash('sha256').update(token).digest('base64url'),
            checkedAt: clock.now,
            attestationExpiresAt: clock.now + ATTESTATION_TTL_MS,
            offlineUntil: verification.valid ? Math.min(expiresAt, clock.now + OFFLINE_GRACE_MS) : clock.now,
            expiresAt,
            valid: verification.valid,
            reasonCode: verification.reasonCode || null
        };
        res.setHeader('Cache-Control', 'no-store');
        res.json({
            success: true,
            attestation: authority.signAttestation(payload),
            timeSource: clock.source,
            timeSampleCount: clock.sampleCount
        });
    } catch (error) {
        console.warn('[desktop-license] validation failed:', error.message || error);
        res.status(400).json({ error: error.message || 'EXE License 校验失败' });
    }
});

module.exports = router;
