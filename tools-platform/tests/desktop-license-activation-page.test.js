const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'frontend/pages/desktop-license-activation.html');
const html = fs.readFileSync(htmlPath, 'utf8');

test('License Activation Page: HTML markup contains complete bilingual elements and tools', () => {
    // Top bar & Language buttons
    assert.match(html, /id="lang-btn-zh"/);
    assert.match(html, /id="lang-btn-en"/);
    assert.match(html, /id="brand-tag"/);

    // Title & subtitle
    assert.match(html, /id="title"/);
    assert.match(html, /id="subtitle"/);

    // Input & Tools
    assert.match(html, /id="license-token"/);
    assert.match(html, /id="btn-paste"/);
    assert.match(html, /id="btn-clear"/);

    // Action buttons
    assert.match(html, /id="btn-activate"/);
    assert.match(html, /id="btn-quit"/);

    // Status box
    assert.match(html, /id="status-box"/);
    assert.match(html, /id="status-text"/);

    // Security feature pills
    assert.match(html, /id="pill-signature"/);
    assert.match(html, /id="pill-offline"/);
    assert.match(html, /id="pill-security"/);
    assert.match(html, /id="meta-note"/);
    assert.match(html, /id="shortcut-hints"/);
});

test('License Activation Page: Inline script is syntactically valid and executes with bilingual switching', () => {
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
    assert.ok(scriptMatch, 'Inline script must exist');
    const script = scriptMatch[1];

    // Mock DOM environment for testing
    const store = new Map();
    const storageMock = {
        getItem: (k) => store.get(k) || null,
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k)
    };

    const listeners = {};
    const dom = {
        title: '',
        documentElement: { lang: '' },
        body: { classList: { add: () => {}, remove: () => {} } },
        elements: {}
    };

    function createMockElement(id) {
        return {
            id,
            textContent: '',
            innerHTML: '',
            value: '',
            placeholder: '',
            className: '',
            dataset: {},
            classList: {
                toggle: function (cls, val) {
                    this[cls] = val;
                },
                add: function (cls) { this[cls] = true; },
                remove: function (cls) { this[cls] = false; }
            },
            addEventListener: function (evt, handler) {
                if (!listeners[id]) listeners[id] = {};
                listeners[id][evt] = handler;
            },
            focus: () => {}
        };
    }

    const elementIds = [
        'title', 'subtitle', 'brand-tag', 'input-label', 'license-token',
        'btn-paste-text', 'btn-clear-text', 'btn-activate-text', 'btn-quit-text',
        'pill-signature', 'pill-offline', 'pill-security', 'meta-note',
        'shortcut-hints', 'status-box', 'status-icon', 'status-text',
        'lang-btn-zh', 'lang-btn-en', 'btn-paste', 'btn-clear',
        'btn-activate', 'btn-quit'
    ];

    elementIds.forEach(id => {
        dom.elements[id] = createMockElement(id);
    });

    const windowListeners = {};
    let quitCalled = false;
    let activatedToken = null;

    const context = {
        console,
        document: {
            get title() { return dom.title; },
            set title(v) { dom.title = v; },
            documentElement: dom.documentElement,
            body: dom.body,
            getElementById: (id) => dom.elements[id] || createMockElement(id),
            activeElement: dom.elements['license-token']
        },
        window: {
            localStorage: storageMock,
            navigator: { language: 'zh-CN' },
            addEventListener: (evt, handler) => { windowListeners[evt] = handler; },
            DesktopLicense: {
                getState: async () => ({ valid: false, reasonCode: 'LICENSE_REQUIRED' }),
                activate: async (tok) => { activatedToken = tok; return { valid: true }; },
                quit: () => { quitCalled = true; },
                readClipboard: () => 'DSKL1.test.signature'
            }
        },
        localStorage: storageMock,
        navigator: { language: 'zh-CN' },
        setTimeout: (fn) => fn(),
        clearTimeout: () => {}
    };

    vm.createContext(context);
    assert.doesNotThrow(() => vm.runInContext(script, context), 'Script execution should succeed without errors');

    // 1. Initial Chinese mode check
    assert.equal(dom.documentElement.lang, 'zh-CN');
    assert.equal(dom.elements['title'].textContent, '首次运行授权激活');
    assert.equal(dom.elements['btn-activate-text'].textContent, '验证并启动（支持离线）');
    assert.match(dom.title, /Tools Platform - 软件授权激活/);

    // 2. Switch to English
    assert.ok(listeners['lang-btn-en'] && listeners['lang-btn-en']['click']);
    listeners['lang-btn-en']['click']();

    assert.equal(dom.documentElement.lang, 'en');
    assert.equal(dom.elements['title'].textContent, 'First-Run License Activation');
    assert.equal(dom.elements['btn-activate-text'].textContent, 'Verify & Launch (Offline Supported)');
    assert.equal(dom.elements['btn-quit-text'].textContent, 'Quit');
    assert.match(dom.elements['license-token'].placeholder, /Paste your complete license key/);
    assert.match(dom.title, /Tools Platform - License Activation/);
    assert.equal(storageMock.getItem('tools_license_lang'), 'en', 'Language preference should be saved in localStorage');

    // 3. Switch back to Chinese
    listeners['lang-btn-zh']['click']();
    assert.equal(dom.documentElement.lang, 'zh-CN');
    assert.equal(dom.elements['title'].textContent, '首次运行授权激活');
    assert.equal(storageMock.getItem('tools_license_lang'), 'zh');

    // 4. Test Clipboard Paste functionality
    assert.ok(listeners['btn-paste'] && listeners['btn-paste']['click']);
    listeners['btn-paste']['click']();
    assert.equal(dom.elements['license-token'].value, 'DSKL1.test.signature');

    // 5. Test Clear functionality
    assert.ok(listeners['btn-clear'] && listeners['btn-clear']['click']);
    listeners['btn-clear']['click']();
    assert.equal(dom.elements['license-token'].value, '');

    // 6. Test Quit button
    assert.ok(listeners['btn-quit'] && listeners['btn-quit']['click']);
    listeners['btn-quit']['click']();
    assert.equal(quitCalled, true, 'DesktopLicense.quit should be called on quit button click');
});

test('License Activation Page: Preload exposes readClipboard, getState, activate, and quit', () => {
    const preloadPath = path.join(root, 'desktop-license-preload.js');
    const preloadCode = fs.readFileSync(preloadPath, 'utf8');

    assert.match(preloadCode, /contextBridge\.exposeInMainWorld\('DesktopLicense'/);
    assert.match(preloadCode, /getState:/);
    assert.match(preloadCode, /activate:/);
    assert.match(preloadCode, /quit:/);
    assert.match(preloadCode, /readClipboard:/);
});
