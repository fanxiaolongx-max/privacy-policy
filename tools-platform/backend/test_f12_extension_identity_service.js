const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f12-extension-identity-test-'));
process.env.F12_EXTENSION_IDENTITIES_FILE = path.join(testDir, 'identities.json');
process.on('exit', () => fs.rmSync(testDir, { recursive: true, force: true }));

const service = require('./models/f12-extension-identity-service');

function main() {
    const first = service.getOrCreateIdentity('题库与答题助手');
    const repeated = service.getOrCreateIdentity('题库与答题助手');
    const other = service.getOrCreateIdentity('另一个扩展');

    assert.strictEqual(first.manifestKey, repeated.manifestKey, '同名扩展必须永久复用同一 Manifest Key');
    assert.notStrictEqual(first.manifestKey, other.manifestKey, '不同扩展必须使用不同 Manifest Key');
    assert.strictEqual(service.isValidManifestKey(first.manifestKey), true);
    assert.doesNotThrow(() => crypto.createPublicKey({
        key: Buffer.from(first.manifestKey, 'base64'),
        format: 'der',
        type: 'spki'
    }));
    assert.ok(fs.existsSync(process.env.F12_EXTENSION_IDENTITIES_FILE), '扩展身份必须持久化到服务器文件');
    console.log('F12 extension identity service tests passed');
}

main();
