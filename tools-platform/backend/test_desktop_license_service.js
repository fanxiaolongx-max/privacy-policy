const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-license-test-'));
process.env.TOOLS_DATA_DIR = temp;
process.env.DESKTOP_LICENSE_SIGNING_KEY_FILE = path.join(temp, 'signing-key.json');
process.env.DESKTOP_LICENSE_REGISTRY_FILE = path.join(temp, 'registry.json');

const authority = require('./models/desktop-license-authority');
const registry = require('./models/desktop-license-registry');

const issued = authority.issue({ label: '测试电脑', days: 30 });
assert.ok(issued.token.startsWith('DSKL1.'));
assert.strictEqual(authority.verifyToken(issued.token).valid, true);
assert.ok(Number.isFinite(issued.payload.notBefore));
assert.ok(issued.payload.expiresAt > issued.payload.notBefore);
assert.strictEqual(registry.checkPayload(issued.payload, Date.now(), issued.token).valid, true);

const originalExpiry = issued.record.expiresAt;
const renewed = authority.renew(issued.payload.licenseId, { days: 30 });
assert.ok(renewed.payload.expiresAt > originalExpiry);
assert.notStrictEqual(renewed.token, issued.token, '离线 License 续期必须重新签名新的到期时间');
assert.strictEqual(registry.checkPayload(issued.payload, Date.now(), issued.token).valid, true, '旧密钥应保留到原到期时间');
assert.strictEqual(registry.checkPayload(renewed.payload, Date.now(), renewed.token).valid, true);

registry.setStatus(issued.payload.licenseId, 'revoked', '测试失效');
assert.strictEqual(registry.checkPayload(renewed.payload, Date.now(), renewed.token).reasonCode, 'REVOKED');
registry.setStatus(issued.payload.licenseId, 'active');
assert.strictEqual(registry.checkPayload(renewed.payload, Date.now(), renewed.token).valid, true);

const attestation = authority.signAttestation({ version: 1, valid: true });
assert.ok(attestation.startsWith('DSKT1.'));
assert.ok(fs.existsSync(process.env.DESKTOP_LICENSE_SIGNING_KEY_FILE));
assert.strictEqual(fs.statSync(process.env.DESKTOP_LICENSE_SIGNING_KEY_FILE).mode & 0o777, 0o600);

console.log('Desktop License service tests passed.');
