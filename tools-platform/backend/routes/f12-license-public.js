const express = require('express');
const crypto = require('crypto');
const licenseService = require('../models/f12-license-service');
const licenseRegistry = require('../models/f12-license-registry');
const trustedTimeService = require('../models/f12-trusted-time-service');

const router = express.Router();
const OFFLINE_GRACE_MS = 24 * 60 * 60 * 1000;
const ATTESTATION_TTL_MS = 5 * 60 * 1000;
const requestBuckets = new Map();

function allowRequest(ip) {
    const now = Date.now();
    const key = String(ip || 'unknown');
    const current = requestBuckets.get(key);
    if (!current || now - current.startedAt >= 60 * 1000) {
        requestBuckets.set(key, { startedAt: now, count: 1 });
        return true;
    }
    current.count += 1;
    return current.count <= 60;
}

router.post('/validate', async (req, res) => {
    if (!allowRequest(req.ip)) return res.status(429).json({ error: '请求过于频繁，请稍后重试' });
    try {
        const token = String(req.body && req.body.token || '').trim();
        const productId = licenseService.normalizeProductId(req.body && req.body.productId);
        const nonce = String(req.body && req.body.nonce || '').trim();
        if (!/^[-_A-Za-z0-9]{16,128}$/.test(nonce)) return res.status(400).json({ error: 'nonce 无效' });
        if (!token || token.length > 8192) return res.status(400).json({ error: 'License 密钥无效' });

        const trustedTime = await trustedTimeService.getTrustedTime();
        let verification = licenseService.verifyLicenseToken(token, {
            productId,
            now: trustedTime.now
        });
        if (verification.valid) {
            const registryCheck = licenseRegistry.checkPayload(verification.payload);
            if (!registryCheck.valid) {
                verification = {
                    valid: false,
                    reasonCode: registryCheck.reasonCode,
                    payload: verification.payload
                };
            }
        }
        const tokenExpiresAt = verification.payload && Number(verification.payload.expiresAt) || 0;
        const payload = {
            version: 1,
            productId,
            nonce,
            tokenDigest: crypto.createHash('sha256').update(token).digest('base64url'),
            checkedAt: trustedTime.now,
            attestationExpiresAt: trustedTime.now + ATTESTATION_TTL_MS,
            offlineUntil: verification.valid
                ? Math.min(tokenExpiresAt, trustedTime.now + OFFLINE_GRACE_MS)
                : trustedTime.now,
            tokenExpiresAt,
            valid: verification.valid,
            reasonCode: verification.reasonCode || null
        };
        const attestation = licenseService.signValidationAttestation(payload);
        res.setHeader('Cache-Control', 'no-store');
        res.json({
            success: true,
            attestation,
            timeSource: trustedTime.source,
            timeSampleCount: trustedTime.sampleCount
        });
    } catch (error) {
        console.warn('[f12-license] public validation failed:', error.message || error);
        res.status(400).json({ error: error.message || 'License 在线校验失败' });
    }
});

module.exports = router;
