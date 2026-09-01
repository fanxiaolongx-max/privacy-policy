const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const router = require('../backend/routes/chat-history');
const builtinSync = require('../backend/models/builtin-tools-sync');

function routeLayer(routePath, method) {
    return router.stack.find(layer => layer.route
        && layer.route.path === routePath
        && layer.route.methods[method]);
}

test('shared chat mutations keep imports and deletion admin-only', () => {
    const importLayer = routeLayer('/import', 'post');
    const deleteLayer = routeLayer('/sources/:sourceId', 'delete');
    const settingsLayer = routeLayer('/settings', 'put');
    const favoriteLayer = routeLayer('/favorites/:stableKey', 'put');
    assert.ok(importLayer);
    assert.ok(deleteLayer);
    assert.ok(importLayer.route.stack.some(layer => layer.handle.name === 'requireAdmin'));
    assert.ok(deleteLayer.route.stack.some(layer => layer.handle.name === 'requireAdmin'));
    assert.equal(settingsLayer.route.stack.some(layer => layer.handle.name === 'requireAdmin'), false);
    assert.equal(favoriteLayer.route.stack.some(layer => layer.handle.name === 'requireAdmin'), false);

    const serverSource = fs.readFileSync(path.join(__dirname, '../backend/server.js'), 'utf8');
    const personalException = serverSource.match(/\^\\\/chat-history.*?return next\(\)/s)?.[0] || '';
    assert.match(personalException, /settings/);
    assert.match(personalException, /favorites/);
    assert.doesNotMatch(personalException, /import/);
    assert.doesNotMatch(personalException, /sources/);
});

test('chat history center is a valid bundled platform-only HTML tool', () => {
    const sourceDir = path.join(__dirname, '../backend/builtin-tools');
    const bundled = builtinSync.listBundledTools(sourceDir).find(item => item.slug === 'chat-history-center');
    assert.ok(bundled);
    assert.equal(bundled.manifest.tool.publicAccess, false);
    assert.ok(bundled.files.includes('index.html'));
    assert.ok(bundled.files.includes('chat-viewer.js'));
    const html = fs.readFileSync(path.join(sourceDir, 'chat-history-center/index.html'), 'utf8');
    assert.match(html, /webkitdirectory/);
    const js = fs.readFileSync(path.join(sourceDir, 'chat-history-center/chat-viewer.js'), 'utf8');
    assert.match(js, /window\.location\.protocol === 'file:'/);
    assert.match(js, /webkitRelativePath/);
});
