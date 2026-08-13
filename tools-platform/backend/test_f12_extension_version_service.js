const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f12-version-service-'));
process.env.F12_EXTENSION_VERSIONS_FILE = path.join(tempDir, 'versions.json');
const service = require('./models/f12-extension-version-service');

try {
    const baseline = service.previewVersion('测试扩展');
    assert.strictEqual(baseline.previousVersion, '1.0.0');
    assert.strictEqual(baseline.nextVersion, '1.0.1');
    assert.strictEqual(baseline.storage, 'server');

    const migrated = service.previewVersion('测试扩展', { legacyVersion: '1.2.3' });
    assert.strictEqual(migrated.previousVersion, '1.2.3');
    assert.strictEqual(migrated.nextVersion, '1.2.4');
    assert.strictEqual(migrated.migrated, true);

    const reserved = service.reserveNextVersion('测试扩展');
    assert.strictEqual(reserved.previousVersion, '1.2.3');
    assert.strictEqual(reserved.allocatedVersion, '1.2.4');
    assert.strictEqual(reserved.nextVersion, '1.2.5');
    assert.strictEqual(reserved.downloadCount, 1);

    const persisted = service.previewVersion('测试扩展', { legacyVersion: '1.0.9' });
    assert.strictEqual(persisted.previousVersion, '1.2.4');
    assert.strictEqual(persisted.nextVersion, '1.2.5');

    assert.strictEqual(service.compareVersions('1.2', '1.2.0'), 0);
    assert.strictEqual(service.compareVersions('1.2.10', '1.2.9'), 1);

    const maxLegacyIgnored = service.previewVersion('另一个扩展', { legacyVersion: '65535.65535.65535' });
    assert.strictEqual(maxLegacyIgnored.previousVersion, '1.0.0');
    assert.strictEqual(maxLegacyIgnored.nextVersion, '1.0.1');
    console.log('✅ F12 extension server version service tests passed');
} finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
}
