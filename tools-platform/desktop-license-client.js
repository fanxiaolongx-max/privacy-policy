const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const TOKEN_PREFIX = 'DSKL1';
const ATTESTATION_PREFIX = 'DSKT1';

function decode(value) {
    return Buffer.from(String(value || ''), 'base64url');
}

function digest(token) {
    return crypto.createHash('sha256').update(String(token || '')).digest('base64url');
}

function createDesktopLicenseClient({ configPath, statePath, publicStatusPath }) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const publicKey = crypto.createPublicKey({ key: config.publicKeyJwk, format: 'jwk' });

    function readState() {
        try {
            return fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {};
        } catch (_) {
            return {};
        }
    }

    function writeJson(file, value, secret = false) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
        fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: secret ? 0o600 : 0o644 });
        fs.renameSync(temp, file);
        if (secret) try { fs.chmodSync(file, 0o600); } catch (_) {}
    }

    function verifySigned(value, prefix) {
        const parts = String(value || '').trim().split('.');
        if (parts.length !== 3 || parts[0] !== prefix) return { valid: false, reasonCode: 'INVALID_FORMAT' };
        try {
            const valid = crypto.verify('sha256', Buffer.from(parts[1]), {
                key: publicKey,
                dsaEncoding: 'ieee-p1363'
            }, decode(parts[2]));
            if (!valid) return { valid: false, reasonCode: 'INVALID_SIGNATURE' };
            return { valid: true, payload: JSON.parse(decode(parts[1]).toString('utf8')) };
        } catch (_) {
            return { valid: false, reasonCode: 'VERIFICATION_FAILED' };
        }
    }

    function inspectToken(token) {
        const checked = verifySigned(token, TOKEN_PREFIX);
        if (!checked.valid) return checked;
        const payload = checked.payload;
        if (!payload || payload.version !== 1 || payload.productId !== config.productId
            || !payload.licenseId || !Number.isFinite(payload.issuedAt)) {
            return { valid: false, reasonCode: 'PRODUCT_MISMATCH' };
        }
        const hasEmbeddedValidity = payload.notBefore !== undefined || payload.expiresAt !== undefined;
        if (hasEmbeddedValidity && (!Number.isFinite(payload.notBefore)
            || !Number.isFinite(payload.expiresAt) || payload.expiresAt <= payload.notBefore)) {
            return { valid: false, reasonCode: 'INVALID_FORMAT' };
        }
        return { ...checked, locallyVerifiable: hasEmbeddedValidity };
    }

    function verifyAttestation(attestation, token, expectedNonce) {
        const checked = verifySigned(attestation, ATTESTATION_PREFIX);
        if (!checked.valid) return checked;
        const payload = checked.payload || {};
        if (payload.version !== 1 || payload.productId !== config.productId) return { valid: false, reasonCode: 'PRODUCT_MISMATCH' };
        if (expectedNonce && payload.nonce !== expectedNonce) return { valid: false, reasonCode: 'NONCE_MISMATCH' };
        if (payload.tokenDigest !== digest(token)) return { valid: false, reasonCode: 'TOKEN_MISMATCH' };
        if (!Number.isFinite(payload.checkedAt) || !Number.isFinite(payload.attestationExpiresAt)
            || !Number.isFinite(payload.offlineUntil) || !Number.isFinite(payload.expiresAt)) {
            return { valid: false, reasonCode: 'INVALID_FORMAT' };
        }
        return payload.valid ? { valid: true, payload } : { valid: false, reasonCode: payload.reasonCode || 'VERIFICATION_FAILED', payload };
    }

    function toPublicStatus(result) {
        return {
            enabled: true,
            valid: Boolean(result && result.valid),
            licenseId: result && result.licenseId || null,
            expiresAt: result && Number(result.expiresAt) || 0,
            trustedNow: result && Number(result.trustedNow) || Date.now(),
            online: Boolean(result && result.online),
            reasonCode: result && result.reasonCode || null,
            updatedAt: new Date().toISOString()
        };
    }

    function publish(result) {
        writeJson(publicStatusPath, toPublicStatus(result));
        return result;
    }

    async function online(token) {
        const nonce = crypto.randomBytes(18).toString('base64url');
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 7000);
        try {
            const response = await fetch(config.validationUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, productId: config.productId, nonce }),
                cache: 'no-store',
                signal: controller.signal
            });
            const body = await response.json().catch(() => ({}));
            if (!response.ok || !body.attestation) throw new Error(body.error || 'ONLINE_UNAVAILABLE');
            const checked = verifyAttestation(body.attestation, token, nonce);
            const localCheckedAt = Date.now();
            if (!checked.valid) {
                // 已通过服务器签名的失效/过期结果必须覆盖旧的成功缓存，
                // 否则攻击者可在撤销后断网，重新利用之前的离线凭证。
                if (checked.payload) {
                    writeJson(statePath, {
                        token,
                        attestation: body.attestation,
                        localCheckedAt,
                        lastObservedLocalTime: localCheckedAt,
                        lastTrustedTime: checked.payload.checkedAt
                    }, true);
                }
                return publish({ valid: false, reasonCode: checked.reasonCode, online: true });
            }
            const state = {
                token,
                attestation: body.attestation,
                localCheckedAt,
                lastObservedLocalTime: localCheckedAt,
                lastTrustedTime: checked.payload.checkedAt
            };
            writeJson(statePath, state, true);
            return publish({
                valid: true,
                licenseId: checked.payload.licenseId,
                expiresAt: checked.payload.expiresAt,
                trustedNow: checked.payload.checkedAt,
                online: true
            });
        } finally {
            clearTimeout(timer);
        }
    }

    function offlineAttestation(token) {
        const state = readState();
        if (!state.attestation || state.token !== token) return publish({ valid: false, reasonCode: 'ONLINE_REQUIRED' });
        const checked = verifyAttestation(state.attestation, token);
        if (!checked.valid) return publish({ valid: false, reasonCode: checked.reasonCode });
        const localNow = Date.now();
        const floor = Math.max(Number(state.localCheckedAt) || 0, Number(state.lastObservedLocalTime) || 0);
        if (localNow < floor - 120000) return publish({ valid: false, reasonCode: 'CLOCK_ROLLBACK' });
        const elapsed = Math.max(0, localNow - (Number(state.localCheckedAt) || localNow));
        const trustedNow = Number(checked.payload.checkedAt) + elapsed;
        if (trustedNow >= checked.payload.expiresAt) return publish({ valid: false, reasonCode: 'EXPIRED', trustedNow });
        if (trustedNow >= checked.payload.offlineUntil) return publish({ valid: false, reasonCode: 'ONLINE_REQUIRED', trustedNow });
        state.lastObservedLocalTime = Math.max(floor, localNow);
        writeJson(statePath, state, true);
        return publish({
            valid: true,
            licenseId: checked.payload.licenseId,
            expiresAt: checked.payload.expiresAt,
            trustedNow,
            online: false
        });
    }

    function offlineSignedToken(token, tokenPayload) {
        const state = readState();
        const localNow = Date.now();
        const sameTokenState = state.token === token ? state : {};
        const floor = Math.max(
            Number(sameTokenState.lastObservedLocalTime) || 0,
            Number(sameTokenState.lastTrustedTime) || 0
        );
        if (localNow < floor - 120000) {
            return publish({ valid: false, reasonCode: 'CLOCK_ROLLBACK', trustedNow: floor });
        }

        // 如果这把密钥曾收到服务器签名的撤销/归档结果，断网后也不回退到本地成功。
        if (sameTokenState.attestation) {
            const serverState = verifyAttestation(sameTokenState.attestation, token);
            if (!serverState.valid && serverState.payload) {
                return publish({
                    valid: false,
                    reasonCode: serverState.reasonCode,
                    trustedNow: Math.max(localNow, floor)
                });
            }
        }

        let trustedNow = Math.max(localNow, floor);
        if (sameTokenState.attestation && Number.isFinite(sameTokenState.localCheckedAt)) {
            const serverState = verifyAttestation(sameTokenState.attestation, token);
            if (serverState.valid) {
                trustedNow = Math.max(
                    trustedNow,
                    Number(serverState.payload.checkedAt)
                        + Math.max(0, localNow - Number(sameTokenState.localCheckedAt))
                );
            }
        }
        if (trustedNow < Number(tokenPayload.notBefore)) {
            return publish({ valid: false, reasonCode: 'NOT_YET_VALID', trustedNow });
        }
        if (trustedNow >= Number(tokenPayload.expiresAt)) {
            return publish({ valid: false, reasonCode: 'EXPIRED', trustedNow });
        }

        writeJson(statePath, {
            ...sameTokenState,
            token,
            lastObservedLocalTime: localNow,
            lastTrustedTime: trustedNow
        }, true);
        return publish({
            valid: true,
            licenseId: tokenPayload.licenseId,
            expiresAt: tokenPayload.expiresAt,
            trustedNow,
            online: false,
            localSignature: true
        });
    }

    async function validate(token, { requireOnline = false } = {}) {
        const inspected = inspectToken(token);
        if (!inspected.valid) return publish({ valid: false, reasonCode: inspected.reasonCode });
        try {
            return await online(token);
        } catch (_) {
            if (inspected.locallyVerifiable) return offlineSignedToken(token, inspected.payload);
            return requireOnline
                ? publish({ valid: false, reasonCode: 'ONLINE_REQUIRED' })
                : offlineAttestation(token);
        }
    }

    async function validateStored() {
        const state = readState();
        if (!state.token) return publish({ valid: false, reasonCode: 'LICENSE_REQUIRED' });
        return validate(state.token);
    }

    return { config, readState, validate, validateStored };
}

module.exports = { createDesktopLicenseClient };
