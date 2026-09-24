'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tools-market-sources-'));
process.env.TOOLS_DATA_DIR = dataDir;
const market = require('../backend/models/custom-tools-market-service');
const { runWithTenant } = require('../backend/models/tenant-context');
const { closeDatabase } = require('../backend/models/app-db');

test('market settings isolate tenants and disabled sources cause no requests', async () => {
    const server = http.createServer((request, response) => {
        response.setHeader('content-type', 'application/json');
        const slug = 'shared-tool';
        const tool = {
            id: `official/${slug}`, slug, releaseVersion: '1.0.0', tool: { name: request.url.startsWith('/one/') ? 'First' : 'Second' },
            package: { url: 'packages/shared-tool.zip', size: 10, sha256: 'a'.repeat(64), directoryFingerprint: 'b'.repeat(64),
                files: [{ path: '.tool-manifest.json', sha256: 'c'.repeat(64) }, { path: 'index.html', sha256: 'd'.repeat(64) }] }
        };
        response.end(JSON.stringify({ catalogVersion: 1, publisher: 'intranet', tools: [tool] }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}/one/catalog.json`;
    const secondUrl = `http://127.0.0.1:${server.address().port}/two/catalog.json`;
    try {
        await runWithTenant('alpha', async () => {
            const saved = await market.saveMarketSettings({ githubEnabled: false, sources: [{ name: '内网', url, enabled: true }, { name: '备用', url: secondUrl, enabled: true }] });
            assert.equal(saved.sources.length, 2);
            const loaded = await market.loadEnabledCatalogs({ force: true });
            assert.equal(loaded.sources[0].enabled, false);
            assert.equal(loaded.sources[1].error, null);
            assert.equal(loaded.tools.length, 1);
            assert.equal(loaded.tools[0].tool.name, 'First');
            assert.equal(loaded.tools[0].sourceId, saved.sources[0].id);
            await market.saveMarketSettings({ githubEnabled: false, sources: saved.sources.map(source => ({ ...source, enabled: false })) });
            const disabled = await market.previewMarket({ force: true });
            assert.equal(disabled.sources.every(source => source.enabled === false), true);
            assert.deepEqual(disabled.tools, []);
            await assert.rejects(market.saveMarketSettings({ githubEnabled: false, sources: [{ name: 'bad', url: 'http://user:secret@127.0.0.1/catalog.json' }] }), /账号密码/);
        });
        await runWithTenant('beta', async () => {
            const settings = await market.getMarketSettings();
            assert.equal(settings.githubEnabled, true);
            assert.deepEqual(settings.sources, []);
        });
    } finally {
        await new Promise(resolve => server.close(resolve));
        await closeDatabase();
        fs.rmSync(dataDir, { recursive: true, force: true });
    }
});
