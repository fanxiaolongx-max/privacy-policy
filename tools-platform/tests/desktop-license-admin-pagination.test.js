const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'frontend/pages/desktop-license-admin.html'), 'utf8');
const route = fs.readFileSync(path.join(root, 'backend/routes/desktop-license-admin.js'), 'utf8');

test('EXE License admin hides archived records by default and fetches them on demand', () => {
    assert.match(html, /id="showArchived" type="checkbox">/);
    assert.doesNotMatch(html, /id="showArchived"[^>]*checked/);
    assert.match(html, /includeArchived=\$\{\$\('showArchived'\)\.checked\?'1':'0'\}/);
    assert.match(html, /\$\('showArchived'\)\.onchange=\(\)=>load\(true\)/);
    assert.match(route, /req\.query\.includeArchived === '1'/);
});

test('EXE License admin paginates and visually de-emphasizes archived cards', () => {
    assert.match(html, /id="pageSize"/);
    assert.match(html, /id="prevPage"/);
    assert.match(html, /id="nextPage"/);
    assert.match(html, /filtered\.slice\(start,start\+pageSize\)/);
    assert.match(html, /\.card\.is-archived\{opacity:\.5/);
    assert.match(html, /classList\.toggle\('is-archived'/);
});

test('EXE License admin inline script remains valid JavaScript', () => {
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    assert.ok(script, 'inline script should exist');
    assert.doesNotThrow(() => new Function(script));
});
