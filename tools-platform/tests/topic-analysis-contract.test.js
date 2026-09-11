const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const server = read('backend/server.js');
const routes = read('backend/routes/topic-snapshots.js');
const page = read('frontend/pages/topic-analysis.html');
const script = read('frontend/js/topic-analysis.js');
const navbar = read('frontend/js/shared/navbar.js');
const navRepository = read('backend/models/nav-settings-repository.js');

test('topic snapshot API and analysis page are wired', () => {
    assert.match(server, /app\.use\('\/api\/topic-snapshots', topicSnapshotsRoutes\)/);
    assert.match(server, /app\.get\('\/topic-analysis'/);
    assert.match(routes, /router\.get\('\/series'/);
    assert.match(routes, /router\.get\('\/latest'/);
    assert.match(routes, /router\.get\('\/:id'/);
    assert.match(routes, /router\.post\('\/'/);
    assert.match(page, /专题分析/);
    assert.match(page, /topic-analysis\.js\?v=20260911-02/);
    assert.match(script, /API\.get\('\/api\/topic-snapshots\?limit=200'\)/);
    assert.match(script, /API\.delete/);
    assert.match(script, /'netcare-eos-product'/);
    assert.match(script, /'datafab-return'/);
    assert.match(script, /'datafab-filing'/);
    assert.match(navbar, /id: 'topic-analysis'[\s\S]*defaultCategory: 'cat_mshv1h0m'/);
    assert.match(navbar, /'nav\.topicAnalysis': '专题分析'/);
    assert.match(navRepository, /'topic-analysis': 'cat_mshv1h0m'/);
});
