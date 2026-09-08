'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const market = require('./models/custom-tools-market-service');
const { fingerprintFiles } = require('./models/tool-content-fingerprint');

function writeManifest(root, slug, extra = {}) {
    const dir = path.join(root, slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), '<html>local</html>');
    fs.writeFileSync(path.join(dir, '.tool-manifest.json'), `${JSON.stringify({
        version: 1,
        tool: { slug, name: slug, updatedAt: '2026-09-01T00:00:00.000Z' },
        ...extra
    })}\n`);
    return dir;
}

function catalogTool(slug, overrides = {}) {
    return {
        id: `official/${slug}`,
        slug,
        releaseVersion: '1.2.0',
        releasedAt: '2026-09-08T00:00:00.000Z',
        minPlatformVersion: '1.0.0',
        changelog: '',
        tool: { slug, name: slug },
        package: {
            url: `https://raw.githubusercontent.com/example/repo/tool-market/packages/${slug}.zip`,
            size: 10,
            sha256: 'a'.repeat(64),
            directoryFingerprint: 'b'.repeat(64),
            files: [
                { path: '.tool-manifest.json', size: 2, sha256: 'c'.repeat(64) },
                { path: 'index.html', size: 8, sha256: 'd'.repeat(64) }
            ]
        },
        ...overrides
    };
}

function run() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tools-market-test-'));
    const previousKey = process.env.TOOLS_MARKET_PUBLIC_KEY;
    const previousRequired = process.env.TOOLS_MARKET_REQUIRE_SIGNATURE;
    try {
        const missing = market.compareCatalogTool(catalogTool('missing'), { targetDir: root, platformVersion: '1.0.209' });
        assert.strictEqual(missing.status, 'missing');
        assert.strictEqual(missing.recommended, true);

        writeManifest(root, 'manual');
        const manual = market.compareCatalogTool(catalogTool('manual'), { targetDir: root, platformVersion: '1.0.209' });
        assert.strictEqual(manual.status, 'conflict');
        assert.strictEqual(manual.recommended, false);

        writeManifest(root, 'managed', {
            builtIn: true,
            system: { managedBy: 'tools-platform', fingerprint: 'old', files: ['index.html'] }
        });
        const update = market.compareCatalogTool(catalogTool('managed'), { targetDir: root, platformVersion: '1.0.209' });
        assert.strictEqual(update.status, 'update');

        const bundledDir = writeManifest(root, 'line-ending-bundled', {
            builtIn: true,
            system: { managedBy: 'tools-platform', fingerprint: 'legacy-windows-fingerprint', files: ['index.html'] }
        });
        fs.writeFileSync(path.join(bundledDir, 'index.html'), '<html>\r\nlocal\r\n</html>\r\n');
        const bundledFingerprint = fingerprintFiles(bundledDir, ['.tool-manifest.json', 'index.html']);
        const bundled = market.compareCatalogTool(catalogTool('line-ending-bundled', {
            package: {
                ...catalogTool('line-ending-bundled').package,
                directoryFingerprint: bundledFingerprint
            }
        }), { targetDir: root, platformVersion: '1.0.209' });
        assert.strictEqual(bundled.status, 'unchanged', 'legacy bundled fingerprints should be recomputed canonically');

        writeManifest(root, 'current', {
            builtIn: true,
            system: { managedBy: 'tools-platform', fingerprint: 'b'.repeat(64), files: ['index.html'] },
            market: { id: 'official/current', releaseVersion: '1.2.0', files: [] }
        });
        const current = market.compareCatalogTool(catalogTool('current'), { targetDir: root, platformVersion: '1.0.209' });
        assert.strictEqual(current.status, 'unchanged');

        const incompatible = market.compareCatalogTool(catalogTool('future', { minPlatformVersion: '2.0.0' }), { targetDir: root, platformVersion: '1.0.209' });
        assert.strictEqual(incompatible.status, 'incompatible');
        assert.strictEqual(market.versionAtLeast('1.0.209', '1.0.180'), true);
        assert.strictEqual(market.versionAtLeast('1.0.179', '1.0.180'), false);

        const validated = market.validateCatalog({ catalogVersion: 1, tools: [catalogTool('valid')] }, 'https://raw.githubusercontent.com/example/repo/tool-market/catalog.json');
        assert.strictEqual(validated.tools.length, 1);
        assert.throws(() => market.validateCatalog({ catalogVersion: 1, tools: [catalogTool('valid'), catalogTool('valid')] }, 'https://example.com/catalog.json'));

        const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
        process.env.TOOLS_MARKET_PUBLIC_KEY = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
        process.env.TOOLS_MARKET_REQUIRE_SIGNATURE = '1';
        const raw = { catalogVersion: 1, publisher: 'test', generatedAt: '2026-09-08T00:00:00.000Z', tools: [] };
        const signature = crypto.sign(null, Buffer.from(JSON.stringify(raw)), privateKey).toString('base64');
        assert.strictEqual(market.verifyCatalogSignature({ ...raw, signature: { algorithm: 'Ed25519', keyId: 'test', value: signature } }).state, 'verified');
        assert.throws(() => market.verifyCatalogSignature({ ...raw, publisher: 'tampered', signature: { algorithm: 'Ed25519', keyId: 'test', value: signature } }));
    } finally {
        if (previousKey === undefined) delete process.env.TOOLS_MARKET_PUBLIC_KEY; else process.env.TOOLS_MARKET_PUBLIC_KEY = previousKey;
        if (previousRequired === undefined) delete process.env.TOOLS_MARKET_REQUIRE_SIGNATURE; else process.env.TOOLS_MARKET_REQUIRE_SIGNATURE = previousRequired;
        fs.rmSync(root, { recursive: true, force: true });
    }
}

run();
