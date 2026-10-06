const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'platform-identity-'));
process.env.TOOLS_DATA_DIR = path.join(sandbox, 'data');
process.env.TOOLS_REPORT_DATA_DIR = path.join(sandbox, 'reports');
const repo = require('../backend/models/nav-settings-repository');
const { runWithTenant } = require('../backend/models/tenant-context');
const appDb = require('../backend/models/app-db');
const pool = require('../backend/models/tenant-sqlite-pool');

test('platform names are isolated by tenant and survive older clients and navigation resets', async t => {
    t.after(async () => {
        await appDb.closeDatabase();
        await pool.closeAll();
        fs.rmSync(sandbox, { recursive: true, force: true });
    });
    assert.equal((await repo.getSettings()).platformName, 'Tools Platform');
    await repo.saveSettings({ platformName: '  埃及运营平台  ' });
    await repo.saveSettings({ primaryIds: ['home'] });
    assert.equal((await repo.getSettings()).platformName, '埃及运营平台');
    assert.equal(repo.mergeDefaultSettingsPreservingCustomTools(await repo.getSettings()).platformName, '埃及运营平台');
    await runWithTenant('brand-other', async () => {
        assert.equal((await repo.getSettings()).platformName, 'Tools Platform');
        await repo.saveSettings({ platformName: 'Other Operations' });
    });
    assert.equal((await repo.getSettings()).platformName, '埃及运营平台');
    await repo.saveSettings({ platformName: '' });
    assert.equal((await repo.getSettings()).platformName, 'Tools Platform');
    assert.equal((await runWithTenant('brand-other', () => repo.getSettings())).platformName, 'Other Operations');
});

test('legacy, invalid, blank and oversized names have stable defaults and limits', () => {
    for (const platformName of [undefined, null, {}, '   ', '\n\t']) {
        assert.equal(repo.normalizeSettings({ platformName }).platformName, 'Tools Platform');
    }
    assert.equal(repo.normalizeSettings({ platformName: 'A\nB\u007f' }).platformName, 'AB');
    assert.equal(repo.normalizeSettings({ platformName: 'a'.repeat(100) }).platformName.length, 80);
});

const source = fs.readFileSync(path.join(__dirname, '../frontend/js/shared/navbar.js'), 'utf8');
function fixture() {
    const nodes = [{}, {}], images = new Map([['navBrandLogo', {}], ['homeHeroLogo', {}]]);
    const document = {
        title: 'Tools Platform - 工具中台',
        querySelectorAll: () => nodes,
        getElementById: id => images.get(id),
        querySelector: () => ({})
    };
    const context = { document, navState: { settings: { platformName: '运营 <中心>' } }, MutationObserver: class { observe() {} } };
    vm.createContext(context);
    vm.runInContext(source.slice(source.indexOf('let platformTitleOriginal'), source.indexOf('function getAllNavItems()')), context);
    return { context, document, nodes, images };
}

test('branding updates safe text and titles, preserves page names and handles language changes and reverting', () => {
    const { context, document, nodes, images } = fixture();
    context.applyPlatformIdentity();
    assert.equal(nodes[0].textContent, '运营 <中心>');
    assert.equal(images.get('homeHeroLogo').alt, '运营 <中心>');
    assert.equal(document.title, '运营 <中心> - 工具中台');
    document.title = 'Reports - Tools Platform';
    context.applyPlatformTitle();
    assert.equal(document.title, 'Reports - 运营 <中心>');
    context.navState.settings.platformName = 'Tools Platform';
    context.applyPlatformIdentity();
    assert.equal(document.title, 'Reports - Tools Platform');
    context.navState.settings.platformName = 'Another';
    context.applyPlatformIdentity();
    assert.equal(document.title, 'Reports - Another');
    document.title = 'Standalone report';
    context.applyPlatformTitle();
    assert.equal(document.title, 'Standalone report');
});

test('failed name saves keep the prior branding and release the save button', async () => {
    const { context, document } = fixture();
    const controls = {
        platformNameInput: { value: 'New Name' }, platformNameSaveBtn: { disabled: false }, platformNameSaveStatus: {}
    };
    document.getElementById = id => controls[id];
    Object.assign(context, {
        window: {}, clearTimeout, navT: key => key, getAuthHeaderForNav: () => ({}),
        fetch: async () => ({ ok: false, status: 403, json: async () => ({ error: 'Admin required' }) })
    });
    const start = source.indexOf('window.savePlatformName =');
    vm.runInContext(source.slice(start, source.indexOf('window.handleLogoFileSelect =', start)), context);
    await context.window.savePlatformName();
    assert.equal(context.navState.settings.platformName, '运营 <中心>');
    assert.equal(controls.platformNameSaveBtn.disabled, false);
    assert.match(controls.platformNameSaveStatus.textContent, /Admin required/);
});

test('successful name save applies canonical server value and keeps other settings', async () => {
    const { context, document } = fixture();
    const controls = {
        platformNameInput: { value: '  New Name  ' }, platformNameSaveBtn: { disabled: false }, platformNameSaveStatus: {}
    };
    const originalGet = document.getElementById;
    document.getElementById = id => controls[id] || originalGet(id);
    let payload, cached = false, applied = false;
    context.navState.settings.primaryIds = ['home'];
    Object.assign(context, {
        window: {}, clearTimeout, navT: key => key, getAuthHeaderForNav: () => ({}),
        normalizeNavSettings: data => data,
        writeNavigationBootstrapCache: () => { cached = true; },
        renderNavLinksFromState: () => { applied = true; context.applyPlatformIdentity(); },
        fetch: async (_url, options) => {
            payload = JSON.parse(options.body);
            return { ok: true, json: async () => payload };
        }
    });
    const start = source.indexOf('window.savePlatformName =');
    vm.runInContext(source.slice(start, source.indexOf('window.handleLogoFileSelect =', start)), context);
    await context.window.savePlatformName();
    assert.equal(payload.platformName, 'New Name');
    assert.deepEqual(payload.primaryIds, ['home']);
    assert.equal(document.title, 'New Name - 工具中台');
    assert.equal(controls.platformNameInput.value, 'New Name');
    assert.ok(cached && applied);
    assert.equal(controls.platformNameSaveBtn.disabled, false);
});
