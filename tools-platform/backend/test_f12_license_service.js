const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f12-license-test-'));
process.env.F12_LICENSE_REGISTRY_FILE = path.join(testDir, 'registry.json');
process.on('exit', () => fs.rmSync(testDir, { recursive: true, force: true }));
const service = require('./models/f12-license-service');
const registry = require('./models/f12-license-registry');
const packer = require('./builtin-tools/f12-to-extension/packer-core');

function decodeBase64Url(value) {
    return Uint8Array.from(Buffer.from(value, 'base64url'));
}

async function main() {
    const productId = '题库与答题助手';
    const issued = service.issueMonthlyLicense({ productId });
    assert.ok(issued.token.startsWith('F12L1.'));
    assert.ok(issued.payload.licenseId, '新版 License 必须包含唯一 ID');
    assert.strictEqual(issued.payload.productId, productId);
    assert.strictEqual(registry.getRecord(issued.payload.licenseId).productId, productId);
    assert.strictEqual(service.verifyLicenseToken(issued.token, { productId }).valid, true);
    assert.strictEqual(service.verifyLicenseToken(issued.token, { productId: '其他扩展' }).valid, false);
    assert.deepStrictEqual(service.getPublicKeyJwk(), issued.publicKeyJwk, '打包配置公钥必须与签发公钥一致');
    registry.setStatus(issued.payload.licenseId, 'revoked', { reason: 'test revoke' });
    assert.strictEqual(registry.checkPayload(issued.payload).valid, false, '单把 License 必须可以撤销');
    assert.strictEqual(registry.checkPayload(issued.payload).reasonCode, 'REVOKED');
    registry.setStatus(issued.payload.licenseId, 'active');
    assert.strictEqual(registry.checkPayload(issued.payload).valid, true, '撤销后必须可以恢复');

    const parts = issued.token.split('.');
    const webKey = await crypto.webcrypto.subtle.importKey(
        'jwk', issued.publicKeyJwk,
        { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']
    );
    const browserCompatible = await crypto.webcrypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' }, webKey,
        decodeBase64Url(parts[2]), new TextEncoder().encode(parts[1])
    );
    assert.strictEqual(browserCompatible, true, 'License 签名必须可由浏览器 Web Crypto 验证');

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    assert.strictEqual(service.verifyLicenseToken(issued.token, { productId, now: payload.expiresAt }).valid, false);

    const attestationPayload = {
        version: 1,
        productId,
        nonce: 'test-nonce-1234567890',
        tokenDigest: 'digest',
        checkedAt: Date.now(),
        valid: true
    };
    const attestation = service.signValidationAttestation(attestationPayload);
    const attestationParts = attestation.split('.');
    assert.strictEqual(attestationParts[0], 'F12T1');
    const attestationCompatible = await crypto.webcrypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' }, webKey,
        decodeBase64Url(attestationParts[2]), new TextEncoder().encode(attestationParts[1])
    );
    assert.strictEqual(attestationCompatible, true, '可信时间证明必须可由扩展内置公钥验证');
    const relabeledAttestation = `F12L1.${attestationParts[1]}.${attestationParts[2]}`;
    assert.strictEqual(
        service.verifyLicenseToken(relabeledAttestation, { productId }).valid,
        false,
        '时间证明不得通过替换前缀冒充 License'
    );

    const generated = packer.buildPackage({
        name: productId,
        version: '1.0.0',
        description: 'License package test',
        matches: 'https://ilearning.huawei.com/*',
        world: 'MAIN',
        includePopup: true,
        manualLaunch: true,
        code: 'console.log("licensed");',
        license: {
            enabled: true,
            productId,
            validationUrl: 'https://tools.example.com/api/public/f12-license/validate',
            publicKeyJwk: issued.publicKeyJwk
        }
    });
    const packageText = Object.values(generated.files).join('\n');
    assert.ok(!packageText.includes(issued.token), '月度 License 不得预置在扩展包中');
    assert.ok(!packageText.includes('PRIVATE KEY'), '扩展包不得包含平台签名私钥');
    assert.strictEqual(generated.manifest.content_scripts, undefined, '授权前不得自动注入脚本');
    console.log('F12 monthly license service tests passed');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
