const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'f12-license-pagination-'));
process.env.F12_LICENSE_REGISTRY_FILE = path.join(sandbox, 'registry.json');
const registry = require('../backend/models/f12-license-registry');
const packerPage = fs.readFileSync(path.join(__dirname, '..', 'backend', 'builtin-tools', 'f12-to-extension', 'index.html'), 'utf8');

function add(productId, label, month) {
    return registry.createRecord({
        productId,
        label,
        month,
        notBefore: Date.now(),
        expiresAt: Date.now() + 86400000,
        token: `${productId}-${label}-${month}`
    });
}

test('F12 License records support extension filtering, search and paging', t => {
    t.after(() => fs.rmSync(sandbox, { recursive: true, force: true }));
    add('扩展甲', '设备 A', '2026-09');
    add('扩展甲', '设备 B', '2026-10');
    add('扩展乙', '测试对象', '2026-09');

    const firstPage = registry.queryRecords({ productId: '扩展甲', page: 1, pageSize: 1 });
    assert.equal(firstPage.total, 2);
    assert.equal(firstPage.totalPages, 2);
    assert.equal(firstPage.items.length, 1);
    assert.deepEqual(firstPage.products, ['扩展甲', '扩展乙']);

    const secondPage = registry.queryRecords({ productId: '扩展甲', page: 2, pageSize: 1 });
    assert.equal(secondPage.page, 2);
    assert.notEqual(firstPage.items[0].licenseId, secondPage.items[0].licenseId);

    const searched = registry.queryRecords({ q: '测试对象', pageSize: 10 });
    assert.equal(searched.total, 1);
    assert.equal(searched.items[0].productId, '扩展乙');
});

test('F12 packer License manager exposes extension filtering and page controls', () => {
    for (const id of ['licenseProductFilter', 'licensePageSize', 'licensePrevPage', 'licenseNextPage', 'licensePageInfo']) {
        assert.match(packerPage, new RegExp(`id="${id}"`));
    }
    assert.match(packerPage, /params\.set\('productId', licenseManagerState\.productId\)/);
    assert.match(packerPage, /pageSize: String\(licenseManagerState\.pageSize\)/);
    assert.match(packerPage, /Object\.values\(BUILTIN_SCRIPTS\)\.map\(script => script\.name\)/);
    assert.match(packerPage, /serverScripts\.map\(script => script\.name\)/);
});

test('F12 packer automatically loads a script when its selection changes', () => {
    assert.match(packerPage, /getElementById\('builtinScriptSelect'\)\.addEventListener\('change'/);
    assert.match(packerPage, /await loadSelectedScript\(event\.target\.value\)/);
    assert.doesNotMatch(packerPage, /id="loadBuiltinBtn"/);
});
