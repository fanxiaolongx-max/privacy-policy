const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-license-client-test-'));
process.env.TOOLS_DATA_DIR = temp;
process.env.DESKTOP_LICENSE_SIGNING_KEY_FILE = path.join(temp, 'signing-key.json');
process.env.DESKTOP_LICENSE_REGISTRY_FILE = path.join(temp, 'registry.json');

const authority = require('./models/desktop-license-authority');
const registry = require('./models/desktop-license-registry');
const { createDesktopLicenseClient } = require('../desktop-license-client');

(async () => {
    const issued = authority.issue({ label: '客户端测试', days: 30 });
    const server = http.createServer((req, res) => {
        let raw = '';
        req.on('data', chunk => { raw += chunk; });
        req.on('end', () => {
            const input = JSON.parse(raw || '{}');
            const verified = authority.verifyToken(input.token);
            const checked = verified.valid
                ? registry.checkPayload(verified.payload, Date.now(), input.token)
                : verified;
            const record = checked.record || null;
            const now = Date.now();
            const payload = {
                version: 1,
                productId: registry.PRODUCT_ID,
                licenseId: verified.payload && verified.payload.licenseId || null,
                nonce: input.nonce,
                tokenDigest: crypto.createHash('sha256').update(input.token).digest('base64url'),
                checkedAt: now,
                attestationExpiresAt: now + 600000,
                offlineUntil: checked.valid ? Math.min(record.expiresAt, now + 86400000) : now,
                expiresAt: record ? record.expiresAt : 0,
                valid: checked.valid,
                reasonCode: checked.reasonCode || null
            };
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, attestation: authority.signAttestation(payload) }));
        });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const configPath = path.join(temp, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({
        version: 1,
        productId: registry.PRODUCT_ID,
        validationUrl: `http://127.0.0.1:${port}/validate`,
        publicKeyJwk: authority.getPublicKeyJwk()
    }));
    const client = createDesktopLicenseClient({
        configPath,
        statePath: path.join(temp, 'client-state.json'),
        publicStatusPath: path.join(temp, 'public-status.json')
    });

    const first = await client.validate(issued.token, { requireOnline: true });
    assert.strictEqual(first.valid, true);
    assert.strictEqual(first.online, true);

    const renewed = registry.renew(issued.payload.licenseId, { days: 90 });
    const afterRenewal = await client.validateStored();
    assert.strictEqual(afterRenewal.valid, true);
    assert.strictEqual(afterRenewal.expiresAt, renewed.expiresAt);

    registry.setStatus(issued.payload.licenseId, 'revoked', '测试');
    const revoked = await client.validateStored();
    assert.strictEqual(revoked.valid, false);
    assert.strictEqual(revoked.reasonCode, 'REVOKED');

    await new Promise(resolve => server.close(resolve));
    const revokedOffline = await client.validateStored();
    assert.strictEqual(revokedOffline.valid, false, '签名失效结果必须覆盖旧离线成功缓存');
    assert.strictEqual(revokedOffline.reasonCode, 'REVOKED');

    registry.setStatus(issued.payload.licenseId, 'active');
    await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
    assert.strictEqual((await client.validateStored()).valid, true);
    await new Promise(resolve => server.close(resolve));
    const offline = await client.validateStored();
    assert.strictEqual(offline.valid, true);
    assert.strictEqual(offline.online, false);
    console.log('Desktop License client tests passed.');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
