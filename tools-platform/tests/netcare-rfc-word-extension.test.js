const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const packer = require('../backend/builtin-tools/f12-to-extension/packer-core');

const dir = path.join(__dirname, '../backend/builtin-tools/f12-to-extension');
const code = fs.readFileSync(path.join(dir, 'netcare-rfc-word.js'), 'utf8');
const options = {
    name: 'NetCare RFC 方案 Word 下载', version: '1.0.0', description: 'RFC Word downloader',
    matches: 'https://netcare-ae.gts.huawei.com/p/netcare/index.html*\nhttps://netcare.huawei.com/p/netcare/index.html*\nhttps://netcare-de.gts.huawei.com/p/netcare/index.html*\nhttps://*.kdp.gts.huawei.com/ows1/static/editor/IdpLiteView/PublishLiteView.html*',
    world: 'MAIN', allFrames: true, manualLaunch: false, includePopup: false,
    runAt: 'document_idle', license: { enabled: false }, code
};

test('RFC package restricts page injection and permits configured AI API origins without cookies', () => {
    const result = packer.buildPackage(options);
    const content = result.manifest.content_scripts[0];
    assert.equal(content.world, 'MAIN');
    assert.equal(content.all_frames, true);
    assert.equal(content.run_at, 'document_idle');
    assert.deepEqual(content.matches, options.matches.split('\n'));
    assert.deepEqual(result.manifest.host_permissions, [...content.matches, 'https://*.kdp.gts.huawei.com/ows1/static/editor/IdpLiteView/OwsPage.html*', 'https://*/*', 'http://localhost/*', 'http://127.0.0.1/*']);
    assert.ok(!result.manifest.permissions.includes('cookies'));
    assert.equal(result.files['content.js'], code);
    for (const change of [{ world: 'ISOLATED' }, { allFrames: false },
        { license: { enabled: true } }, { matches: 'https://netcare-ae.gts.huawei.com/*' }]) {
        assert.throws(() => packer.buildPackage({ ...options, ...change }), /NetCare RFC/);
    }
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    assert.match(html, /<option value="netcare-rfc-word">/);
    assert.match(html, /netcare-rfc-word\.js\?v=/);
});

function workerHarness(fileBytes = [0x50, 0x4b, 0x03, 0x04, 0x00], parentOrigin = 'https://netcare-ae.gts.huawei.com') {
    const messages = [], requests = [], saved = [], listeners = new Map();
    const parent = { postMessage: (message, target) => messages.push({ message, target }) };
    const window = {
        name: 'rfc-word-worker',
        addEventListener: (type, fn) => listeners.set(type, fn),
        removeEventListener: (type, fn) => { if (listeners.get(type) === fn) listeners.delete(type); },
        jQuery: { ajax: settings => {
            requests.push(settings.url);
            let fail;
            settings.beforeSend({ setRequestHeader: (name, value) => {
                assert.equal(name, 'X-CSRF-TOKEN');
                assert.equal(value, 'local-test-value');
            } });
            const api = {
                done: fn => { queueMicrotask(() => {
                    const url = new URL(settings.url);
                    fn(url.pathname.endsWith('addPublishToolTask')
                        ? { status: 'Success', returnValue: 'task-' + url.searchParams.get('owsId'), obj: 'Test Solution' }
                        : url.pathname.endsWith('getPublishToolStatus')
                            ? { status: '9', taskId: 'task-test', fileName: 'Test Solution', message: 'word发布成功' }
                            : { id: 'NC20261001000381' });
                }); return api; },
                fail: fn => { fail = fn; return api; },
                abort: () => fail?.({}, 'abort')
            };
            return api;
        } }
    };
    class XHR {
        open(method, url) { requests.push(url); assert.equal(method, 'GET'); }
        setRequestHeader(name, value) { assert.equal(name, 'X-CSRF-TOKEN'); assert.equal(value, 'local-test-value'); }
        send() { this.status = 200; this.response = new Blob([new Uint8Array(fileBytes)]); queueMicrotask(() => this.onload()); }
        abort() { this.onabort(); }
    }
    const location = new URL('https://de.kdp.gts.huawei.com/ows1/static/editor/IdpLiteView/PublishLiteView.html?id=NC20261001000381');
    location.ancestorOrigins = [parentOrigin];
    const context = { window, parent, location,
        URL: class extends URL { static createObjectURL() { return 'blob:test'; } static revokeObjectURL() {} },
        sessionStorage: { getItem: key => key === 'X-CSRF-TOKEN' ? 'local-test-value' : null },
        XMLHttpRequest: XHR, AbortController, Uint8Array, console,
        setInterval: () => 1, clearInterval: () => {}, setTimeout: () => 1, clearTimeout: () => {},
        document: { createElement: () => ({ click() { saved.push(this.download); }, remove() {} }), body: { append() {} } }
    };
    vm.runInNewContext(code, context);
    const receive = (message, origin = parentOrigin, source = parent) => listeners.get('message')?.({ origin, source, data: { channel: 'netcare-rfc-word-v1', ...message } });
    return { receive, messages, requests, saved, window, listeners };
}

test('export worker rejects unrelated origins/windows and exports only a validated Word response', async () => {
    const harness = workerHarness();
    const message = { type: 'run', job: 'job-test', order: 'NC20261001000381' };
    harness.receive(message, 'https://unrelated.example');
    harness.receive(message, undefined, {});
    harness.receive({ ...message, order: '../other' });
    assert.equal(harness.requests.length, 0);
    harness.receive(message);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(harness.requests.length, 4);
    const download = new URL(harness.requests[3]);
    assert.equal(download.searchParams.get('docId'), message.order);
    assert.equal(download.searchParams.get('taskId'), 'task-' + message.order);
    assert.equal(download.searchParams.get('fileName'), 'Test%20Solution');
    assert.deepEqual(harness.saved, ['NC20261001000381_Test Solution.docx']);
    assert.ok(harness.messages.some(item => item.message.type === 'done' && item.message.filename === harness.saved[0]));
    assert.ok(!JSON.stringify(harness.messages).includes('local-test-value'));
    harness.window.__rfcWordWorkerCleanup();
    assert.equal(harness.listeners.size, 0);
});

test('HTML/login responses must not be saved as Word files', async () => {
    const harness = workerHarness([0x3c, 0x68, 0x74, 0x6d, 0x6c]);
    harness.receive({ type: 'run', job: 'job-test', order: 'NC20261001000381' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(harness.saved.length, 0);
    assert.ok(harness.messages.some(item => item.message.type === 'error'));
});

test('native export dialogs do not initialize a worker or an extra floating panel', () => {
    vm.runInNewContext(code, {
        location: new URL('https://de.kdp.gts.huawei.com/ows1/static/editor/IdpLiteView/PublishLiteView.html?id=NC20261001000381'),
        window: { name: '' }, URL
    });
});

for (const parentOrigin of ['https://netcare.huawei.com', 'https://netcare-de.gts.huawei.com']) {
    test(`worker binds messages and responses to its actual parent ${parentOrigin}`, async () => {
        const harness = workerHarness(undefined, parentOrigin);
        const message = { type: 'run', job: 'other-site-test', order: 'NC20261001000381' };
        harness.receive(message, 'https://netcare-ae.gts.huawei.com');
        assert.equal(harness.requests.length, 0, 'another supported site must not control this worker');
        harness.receive(message);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(harness.saved.length, 1);
        assert.ok(harness.messages.every(item => item.target === parentOrigin));
        harness.window.__rfcWordWorkerCleanup();
    });
}

test('an unknown parent origin cannot initialize or control a worker', () => {
    const harness = workerHarness(undefined, 'https://netcare.huawei.com.unrelated.example');
    assert.equal(harness.listeners.size, 0);
    assert.equal(harness.messages.length, 0);
});

function batchHarness() {
    const context = { URL, location: new URL('https://unrelated.example'), window: {} };
    vm.runInNewContext(code, context);
    return context;
}

test('batch input normalizes separators, case and duplicates, and refuses invalid tokens', () => {
    const { parseNetcareRfcOrders: parse } = batchHarness();
    assert.deepEqual(Array.from(parse('nc20260921001984，NC20261005000019\nNC20260921001984; NC20261005100013、NC20260901100036')),
        ['NC20260921001984', 'NC20261005000019', 'NC20261005100013', 'NC20260901100036']);
    assert.throws(() => parse(''), /请输入/);
    assert.throws(() => parse('NC20260921001984 invalid'), /invalid/i);
});

test('batch serializes native UI preparation while independent transfers overlap up to the limit', async () => {
    const { executeNetcareRfcBatch: execute } = batchHarness();
    const gates = [], started = [], completed = [];
    let preparing = 0, exporting = 0, peak = 0;
    const controller = new AbortController();
    const operation = execute(['a', 'b', 'c', 'd'], 2, controller.signal,
        async order => {
            assert.equal(++preparing, 1);
            await new Promise(resolve => setImmediate(resolve));
            preparing--;
            if (order === 'c') throw new Error('no permission');
            return order;
        },
        (order, prepared) => {
            assert.equal(prepared, order);
            started.push(order);
            peak = Math.max(peak, ++exporting);
            return new Promise(resolve => gates.push(() => { exporting--; resolve(order); }));
        }, (order, result) => completed.push({ order, ...result }));
    while (gates.length < 2) await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(started, ['a', 'b']);
    gates.shift()();
    while (started.length < 3) await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(started, ['a', 'b', 'd']);
    gates.splice(0).forEach(resolve => resolve());
    const results = await operation;
    assert.equal(peak, 2);
    assert.deepEqual(Array.from(results, result => result.ok), [true, true, false, true]);
    assert.equal(completed.find(result => result.order === 'c').error, 'no permission');
});

test('stopping a batch prevents queued RFCs from being prepared', async () => {
    const { executeNetcareRfcBatch: execute } = batchHarness();
    const controller = new AbortController(), prepared = [];
    const results = await execute(['a', 'b', 'c'], 1, controller.signal,
        async order => { prepared.push(order); return order; },
        async () => { controller.abort(); throw new Error('stopped'); }, () => {});
    assert.deepEqual(prepared, ['a']);
    assert.ok(results.every(result => !result.ok));
});

test('worker accepts three distinct simultaneous RFCs and rejects a fourth', async () => {
    const harness = workerHarness();
    const orders = ['NC20260921001984', 'NC20261005000019', 'NC20261005100013', 'NC20260901100036'];
    orders.forEach((order, index) => harness.receive({ type: 'run', job: `batch-${index}`, order }));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(harness.saved.length, 3);
    assert.deepEqual(harness.saved.map(name => name.slice(0, 16)).sort(), orders.slice(0, 3).sort());
    assert.ok(harness.messages.some(({ message }) => message.job === 'batch-3' && message.type === 'error'));
    for (const order of orders.slice(0, 3)) {
        const urls = harness.requests.map(url => new URL(url)).filter(url => url.searchParams.get('docId') === order);
        assert.equal(urls.length, 2, 'status and download retain the same RFC');
        assert.ok(urls.every(url => url.searchParams.get('taskId') === 'task-' + order), 'each RFC keeps its own task ID');
    }
});


test('manual RFC package uses the standard start/stop popup while future KDP workers auto-inject', () => {
    const result = packer.buildPackage({ ...options, manualLaunch: true, includePopup: true });
    assert.equal(result.manifest.action.default_popup, 'popup.html');
    assert.equal(result.manifest.content_scripts.length, 5);
    assert.equal(result.manifest.content_scripts[1].world, "ISOLATED");
    assert.deepEqual(result.manifest.content_scripts[1].js, ["netcare-online-relay.js"]);
    assert.deepEqual(result.manifest.content_scripts[0].matches, [options.matches.split('\n')[3]]);
    assert.equal(result.manifest.content_scripts[0].all_frames, true);
    assert.equal(result.manifest.content_scripts[0].world, 'MAIN');
    assert.deepEqual(result.manifest.host_permissions, [...options.matches.split('\n'), 'https://*.kdp.gts.huawei.com/ows1/static/editor/IdpLiteView/OwsPage.html*', 'https://*/*', 'http://localhost/*', 'http://127.0.0.1/*']);
    assert.match(result.files['popup.html'], /id="startButton"/);
    assert.match(result.files['popup.html'], /id="stopButton"/);
    assert.doesNotMatch(result.files['popup.html'], /id="licensePanel"/);
    assert.match(result.files['popup.js'], /const MANUAL_LAUNCH = true;/);
    assert.doesNotThrow(() => new vm.Script(result.files['popup.js']));
    assert.doesNotThrow(() => new vm.Script(result.files['background.js']));
});

test('RFC popup start injects the script and stop sends the existing page control message', async () => {
    const result = packer.buildPackage({ ...options, manualLaunch: true });
    const elements = new Map(), injections = [];
    const element = id => {
        if (!elements.has(id)) elements.set(id, { value: 'zh', addEventListener(type, callback) { this[type] = callback; } });
        return elements.get(id);
    };
    const context = { console, URL, TextEncoder, TextDecoder, Uint8Array, atob, navigator: { language: "zh-CN" },
        document: { documentElement: {}, getElementById: element, querySelectorAll: () => [] },
        chrome: {
            storage: { local: { get: async () => ({}), set: async () => {} } },
            tabs: { query: async () => [{ id: 123 }] },
            scripting: { executeScript: async settings => { injections.push(settings); } }
        }
    };
    vm.runInNewContext(result.files['popup.js'], context);
    await new Promise(resolve => setImmediate(resolve));
    await element('startButton').click();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(Array.from(injections[0].files), ['netcare-online-relay.js']);
    assert.equal(injections[0].world, 'ISOLATED');
    assert.equal(injections[0].target.allFrames, false);
    assert.deepEqual(Array.from(injections[1].files), ['netcare-language.js','content.js']);
    assert.equal(injections[1].world, 'MAIN');
    await element('stopButton').click();
    await new Promise(resolve => setImmediate(resolve));
    const posted = [];
    context.window = { postMessage: message => posted.push(message) };
    injections[2].func(...injections[2].args);
    assert.equal(posted[0].source, 'EXTENSION_POPUP');
    assert.equal(posted[0].action, 'STOP');
});


test('local packaging preserves the RFC worker registration marker after obfuscation', () => {
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    const start = html.indexOf('    function obfuscateCode(code) {');
    const end = html.indexOf('    function showLicenseResult', start);
    const context = { window: { JavaScriptObfuscator: { obfuscate: () => ({ getObfuscatedCode: () => 'console.log("obfuscated");' }) } } };
    vm.runInNewContext(html.slice(start, end), context);
    const obfuscated = context.obfuscateCode(code);
    assert.match(obfuscated, /TP_NETCARE_RFC_WORD_V1/);
    const result = packer.buildPackage({ ...options, code: obfuscated, manualLaunch: true });
    assert.deepEqual(result.manifest.content_scripts[0].matches, [options.matches.split('\n')[3]]);
});


function onlineBackgroundHarness() {
    const result = packer.buildPackage({ ...options, manualLaunch: true });
    const callbacks = [], created = [];
    vm.runInNewContext(result.files['background.js'], {
        URL, console,
        chrome: { runtime: { onInstalled: { addListener() {} }, onMessage: { addListener: fn => callbacks.push(fn) } },
            tabs: { create: async settings => { created.push(settings); return { id: 456 }; } } }
    });
    return { receive: callbacks[0], created };
}

const onlineOrder = 'NC20261004000263';
const onlineUrl = `https://de.kdp.gts.huawei.com/ows1/static/editor/IdpLiteView/OwsPage.html?docId=${onlineOrder}&order_id=${onlineOrder}&type=NCReadOnly`;
const onlineSender = { tab: { id: 123 }, frameId: 0, url: 'https://netcare-ae.gts.huawei.com/p/netcare/index.html#/rfc' };

test('online relay background opens validated native solution URLs in background tabs without downloads/tabs permissions', async () => {
    const harness = onlineBackgroundHarness(), replies = [];
    assert.equal(harness.receive({ type: 'TP_RFC_OPEN_ONLINE', order: onlineOrder, url: onlineUrl }, onlineSender, result => replies.push(result)), true);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(harness.created[0].url, onlineUrl);
    assert.equal(harness.created[0].openerTabId, 123);
    assert.equal(harness.created[0].active, false);
    assert.equal(replies[0].ok, true);
    const pack = packer.buildPackage({ ...options, manualLaunch: true });
    assert.ok(!pack.manifest.permissions.includes('tabs'));
    assert.ok(!pack.manifest.permissions.includes('downloads'));
});

test('online background rejects unrelated senders, frames, hosts, paths and mismatched RFCs', () => {
    const harness = onlineBackgroundHarness();
    const message = { type: 'TP_RFC_OPEN_ONLINE', order: onlineOrder, url: onlineUrl };
    for (const [changed, sender] of [
        [message, { ...onlineSender, url: 'https://other.example/p/netcare/index.html' }],
        [message, { ...onlineSender, frameId: 1 }],
        [{ ...message, url: onlineUrl.replace('de.kdp.gts.huawei.com', 'de.kdp.gts.huawei.com.evil.example') }, onlineSender],
        [{ ...message, url: onlineUrl.replace('OwsPage.html', 'PublishLiteView.html') }, onlineSender],
        [{ ...message, order: 'NC20261005000019' }, onlineSender],
        [{ ...message, url: onlineUrl.replace('https:', 'http:') }, onlineSender]
    ]) {
        let reply;
        harness.receive(changed, sender, result => { reply = result; });
        assert.equal(reply.ok, false);
    }
    assert.equal(harness.created.length, 0);
});

test('isolated online relay accepts only requests from its own top page and returns independent results', async () => {
    const result = packer.buildPackage({ ...options, manualLaunch: true });
    let receive;
    const messages = [], requests = [];
    const window = { addEventListener: (_type, fn) => { receive = fn; }, postMessage: (message, origin) => messages.push({ message, origin }) };
    window.top = window;
    const origin = 'https://netcare.huawei.com';
    vm.runInNewContext(result.files['netcare-online-relay.js'], { window, location: { origin },
        chrome: { runtime: { sendMessage: async request => { requests.push(request); return { ok: true }; } } } });
    const data = { source: 'TP_RFC_OPEN_REQUEST', id: 'one', order: onlineOrder, url: onlineUrl };
    receive({ source: {}, origin, data });
    receive({ source: window, origin: 'https://other.example', data });
    assert.equal(requests.length, 0);
    receive({ source: window, origin, data });
    receive({ source: window, origin, data: { ...data, id: 'two' } });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(messages.filter(item=>item.message.source==='TP_RFC_OPEN_RESULT').map(item => item.message.id), ['one', 'two']);
    assert.ok(messages.filter(item=>item.message.source==='TP_RFC_OPEN_RESULT').every(item => item.origin === origin && item.message.ok));
});

test('clicking Start initializes online opening on an already-open page without declarative injection', async () => {
    const pack = packer.buildPackage({ ...options, manualLaunch: true });
    const background = onlineBackgroundHarness();
    const listeners = new Set(), messages = [], elements = new Map(), injections = [];
    const origin = new URL(onlineSender.url).origin;
    const window = {
        addEventListener: (_type, fn) => listeners.add(fn),
        removeEventListener: (_type, fn) => listeners.delete(fn),
        postMessage(message, target) {
            messages.push(message);
            for (const listener of [...listeners]) listener({ source: window, origin: target, data: message });
        }
    };
    window.top = window;
    const relayContext = { window, location: { origin }, chrome: { runtime: { sendMessage: message =>
        new Promise(resolve => background.receive(message, onlineSender, resolve)) } } };
    const element = id => {
        if (!elements.has(id)) elements.set(id, { addEventListener(type, callback) { this[type] = callback; } });
        return elements.get(id);
    };
    vm.runInNewContext(pack.files['popup.js'], {
        console, navigator: { language: 'zh-CN' }, document: { documentElement: {}, getElementById: element, querySelectorAll: () => [] },
        chrome: { storage: { local: { get: async () => ({}), set: async () => {} } }, tabs: { query: async () => [{ id: 123 }] },
            scripting: { executeScript: async settings => {
                injections.push(settings.files[0]);
                if (settings.files[0] === 'netcare-online-relay.js') vm.runInNewContext(pack.files[settings.files[0]], relayContext);
            } }
        }
    });
    assert.equal(listeners.size, 0, 'the already-open page has no automatically injected relay');
    await new Promise(resolve => setImmediate(resolve));
    await element('startButton').click();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(injections, ['netcare-online-relay.js', 'netcare-language.js']);
    for (const [index, order] of ['NC20260927000189', 'NC20260720002912'].entries()) {
        window.postMessage({ source: 'TP_RFC_OPEN_REQUEST', id: `open-${index}`, order,
            url: onlineUrl.replaceAll(onlineOrder, order) }, origin);
    }
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(background.created.length, 2, 'one actual tabs.create request per RFC');
    assert.deepEqual(background.created.map(item => new URL(item.url).searchParams.get('docId')), ['NC20260927000189', 'NC20260720002912']);
    assert.equal(messages.filter(message => message.source === 'TP_RFC_OPEN_RESULT' && message.ok).length, 2);
    await element('startButton').click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(listeners.size, 2, 'restarting replaces both relay listeners');
    window.postMessage({ source: 'TP_RFC_OPEN_REQUEST', id: 'after-restart', order: onlineOrder, url: onlineUrl }, origin);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(background.created.length, 3, 'restarting must not open duplicate tabs');
});

test('a synchronously invalidated extension relay returns an error instead of leaving requests to timeout', async () => {
    const pack = packer.buildPackage({ ...options, manualLaunch: true });
    let receive;
    const replies = [];
    const window = { addEventListener: (_type, fn) => { receive = fn; }, removeEventListener() {},
        postMessage: message => replies.push(message) };
    window.top = window;
    vm.runInNewContext(pack.files['netcare-online-relay.js'], { window, location: { origin: 'https://netcare.huawei.com' },
        chrome: { runtime: { sendMessage() { throw new Error('Extension context invalidated'); } } } });
    receive({ source: window, origin: 'https://netcare.huawei.com',
        data: { source: 'TP_RFC_OPEN_REQUEST', id: 'invalid-context', order: onlineOrder, url: onlineUrl } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(replies.at(-1).ok, false);
    assert.match(replies.at(-1).error, /启动脚本/);
});


test('ZIP bundle preserves UTF-8 filenames and bytes with valid CRC, including empty text', async () => {
    const context = { URL, URLSearchParams, TextEncoder, Uint8Array, DataView, Blob, location: new URL('https://unrelated.example'), window: {} };
    vm.runInNewContext(code, context);
    const zip = await context.createNetcareZip([
        { name: '3.2-FW Checklist CLI V1.txt', blob: new Blob(['commands\n']) },
        { name: '1.1-变更目的.txt', blob: new Blob(['\ufeff测试内容']) },
        { name: '4-empty.txt', blob: new Blob([]) }
    ]);
    const JSZip = require('../backend/node_modules/jszip');
    const loaded = await JSZip.loadAsync(Buffer.from(await zip.arrayBuffer()), { checkCRC32: true });
    assert.equal(await loaded.file('3.2-FW Checklist CLI V1.txt').async('string'), 'commands\n');
    assert.equal(await loaded.file('1.1-变更目的.txt').async('string'), '\ufeff测试内容');
    assert.equal(await loaded.file('4-empty.txt').async('string'), '');
});

test('catalogue covers collapsed chapter groups and file naming prevents collisions/path traversal', () => {
    const context = { URL, URLSearchParams, location: new URL('https://unrelated.example'), window: {} };
    vm.runInNewContext(code, context);
    const chapters = context.netcareTopicCatalogue([['number=topic1&catalognumber=1.1&title=Purpose'],
        ['number=topic2&catalognumber=3.2&title=Preparation', 'number=topic2&catalognumber=3.2&title=Preparation']]);
    assert.deepEqual(Array.from(chapters, item => item.number), ['1.1', '3.2']);
    const used = new Set();
    assert.equal(context.netcareUniqueFilename('3.2-file.txt', used), '3.2-file.txt');
    assert.equal(context.netcareUniqueFilename('3.2-file.txt', used), '3.2-file (2).txt');
    assert.ok(!context.netcareSafeFilename('../x/y.txt').includes('/'));
});

test('online filename bridge transfers only the current RFC filename, no credentials', async () => {
    const pack = packer.buildPackage({ ...options, manualLaunch: true });
    const stored = {}, messages = [];
    let receive;
    const window = { addEventListener: (_type, fn) => { receive = fn; }, removeEventListener() {}, postMessage: message => messages.push(message) };
    window.top = window;
    const context = { window, location: new URL(onlineUrl), URL,
        chrome: { storage: { local: { get: async keys => Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, stored[key]])) } } } };
    vm.runInNewContext(pack.files['netcare-collector-bridge.js'], context);
    stored['netcareWordName:' + onlineOrder] = onlineOrder + '_Word solution.docx';
    receive({ source: window, origin: context.location.origin, data: { source: 'TP_RFC_COLLECTOR_GET_NAME', order: onlineOrder } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(messages[0].filename, stored['netcareWordName:' + onlineOrder]);
    receive({ source: window, origin: context.location.origin, data: { source: 'TP_RFC_COLLECTOR_GET_NAME', order: 'NC20261005000019' } });
    assert.equal(messages.length, 1);
});


test('Word filename relay stores the exact downloaded name and rejects unrelated origins or paths', async () => {
    const pack = packer.buildPackage({ ...options, manualLaunch: true });
    let receive;
    const stored = {};
    const window = { addEventListener: (_type, fn) => { receive = fn; }, removeEventListener() {} }; window.top = window;
    const origin = 'https://netcare-ae.gts.huawei.com';
    vm.runInNewContext(pack.files['netcare-online-relay.js'], { window, location: { origin }, chrome: { storage: { local: { set: async values => Object.assign(stored, values) } } } });
    const data = { source: 'TP_RFC_WORD_FILENAME', order: onlineOrder, filename: onlineOrder + '_原生方案名.docx' };
    receive({ source: window, origin: 'https://unrelated.example', data });
    receive({ source: window, origin, data: { ...data, filename: '../bad.docx' } });
    assert.equal(Object.keys(stored).length, 0);
    receive({ source: window, origin, data });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(stored['netcareWordName:' + onlineOrder], data.filename);
});


test('default section template and exact-number preferences validate editable rows', () => {
    const context = { URL, URLSearchParams, location: new URL('https://unrelated.example'), window: {} };
    vm.runInNewContext(code, context);
    const settings = context.netcareDefaultSettings();
    assert.equal(settings.sections.length, 34);
    assert.equal(settings.attachmentsEnabled, false);
    assert.equal(settings.intervalMs, 1500);
    assert.ok(context.netcareSectionMatches(settings, '3.2', 'attachments'));
    assert.ok(!context.netcareSectionMatches(settings, '3.2.1', 'attachments'));
    const custom = context.netcareNormalizeSettings({ ...settings, textEnabled: true, intervalMs: 5,
        sections: [{ number: '9.2', title: 'Custom', text: true, attachments: false }] });
    assert.equal(custom.intervalMs, 1000);
    assert.equal(custom.sections[0].title, 'Custom');
    assert.throws(() => context.netcareNormalizeSettings({ ...settings, sections: [settings.sections[0], settings.sections[0]] }), /重复/);
    assert.throws(() => context.netcareNormalizeSettings({ ...settings, sections: [{number: 'x', title: 'bad'}] }), /序号/);
});

test('settings relay persists only bounded template fields and restores them across sites', async () => {
    const pack = packer.buildPackage({ ...options, manualLaunch: true }), stored = {}, messages = [];
    let receive;
    const window = { addEventListener: (_t, fn) => { receive = fn; }, removeEventListener() {}, postMessage: m => messages.push(m) }; window.top = window;
    const origin = 'https://netcare-de.gts.huawei.com';
    vm.runInNewContext(pack.files['netcare-online-relay.js'], { window, location: {origin}, chrome: { storage: { local: { set: async data => Object.assign(stored, data), get: async key => ({ [key]: stored[key] }) } } } });
    const value = { concurrency: 2, openOnline: false, attachmentsEnabled: true, textEnabled: true, intervalMs: 2000, sections: [{ number: '3.2', title: 'Preparation', attachments: true, text: true }], forbidden: 'must not persist' };
    receive({ source: window, origin: 'https://other.example', data: {source: 'TP_RFC_SETTINGS_SET', settings: value} });
    await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(stored, {});
    receive({ source: window, origin, data: {source: 'TP_RFC_SETTINGS_SET', settings: value} });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(stored.netcareExtractionSettings.forbidden, undefined);
    assert.equal(stored.netcareExtractionSettings.concurrency, 2); assert.equal(stored.netcareExtractionSettings.openOnline, false);
    assert.equal(messages.at(-1).saved, true);
    receive({ source: window, origin, data: {source: 'TP_RFC_SETTINGS_GET'} });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(messages.at(-1).settings.sections[0].number, '3.2');
    const count = Object.keys(stored).length;
    receive({ source: window, origin, data: {source: 'TP_RFC_SETTINGS_SET', settings: {...value, intervalMs: 0}} });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(Object.keys(stored).length, count); assert.equal(messages.at(-1).ok, false);
});

test('shared attachment throttle spaces read grants across tabs and rejects unrelated senders', async () => {
    const pack = packer.buildPackage({ ...options, manualLaunch: true }); const listeners=[]; const listener=(...args)=>listeners.forEach(fn=>fn(...args));
    const timers = [], replies = [];
    vm.runInNewContext(pack.files['background.js'], { URL, Promise, setTimeout: (fn, delay) => { timers.push({ fn, delay }); }, chrome: { runtime: { onInstalled: { addListener() {} }, onMessage: { addListener: fn => { listeners.push(fn); } } } } });
    const request = {type: 'TP_RFC_READ_SLOT', order: onlineOrder, intervalMs: 1500};
    const sender = {tab: {id: 1}, frameId: 0, url: onlineUrl};
    listener(request, sender, r => replies.push(r)); listener(request, {...sender,tab:{id:2}}, r=>replies.push(r));
    await new Promise(resolve=>setImmediate(resolve)); assert.equal(timers.length,1); assert.equal(replies.length,0); assert.equal(timers[0].delay,1500);
    timers[0].fn(); await new Promise(resolve=>setImmediate(resolve)); assert.equal(replies.length,1); assert.equal(timers.length,2);
    timers[1].fn(); await new Promise(resolve=>setImmediate(resolve)); assert.equal(replies.length,2);
    listener(request, {...sender,url:'https://unrelated.example/'}, r=>replies.push(r)); assert.equal(replies.at(-1).ok,false);
});


test('configuration export/import roundtrips global preferences and migrates earlier settings', () => {
    const context = { URL, URLSearchParams, location: new URL('https://unrelated.example'), window: {} };
    vm.runInNewContext(code, context);
    const settings = context.netcareDefaultSettings(); settings.concurrency = 2; settings.openOnline = false;
    const exported = context.netcareExportSettings(settings), restored = context.netcareImportSettings(exported);
    assert.equal(restored.concurrency, 2); assert.equal(restored.openOnline, false); assert.equal(restored.sections.length,34);
    delete settings.concurrency; delete settings.openOnline;
    const migrated = context.netcareNormalizeSettings(settings); assert.equal(migrated.concurrency,3); assert.equal(migrated.openOnline,true);
    assert.throws(()=>context.netcareImportSettings('{}'),/配置格式/);
    assert.throws(()=>context.netcareImportSettings(exported.replace('"version": 1','"version": 99')),/版本/);
    assert.throws(()=>context.netcareImportSettings(' '.repeat(2097153)),/2MB/);
    assert.throws(()=>context.netcareNormalizeSettings({...settings,concurrency:5}),/全局设置/);
});

test('AI prompts force required extraction while audit stays off until explicitly enabled', () => {
    const ctx={URL,URLSearchParams,location:new URL('https://unrelated.example'),window:{}}; vm.runInNewContext(code,ctx);
    const value=ctx.netcareDefaultSettings();value.sections=[{number:'3.2',title:'Preparation',text:false,attachments:false,textPrompt:'Check rollback',attachmentsPrompt:'Check commands'}];
    const off=ctx.netcareNormalizeSettings(value);assert.equal(off.aiAuditEnabled,false);assert.equal(off.sections[0].text,true);assert.equal(off.sections[0].attachments,true);
    const on=ctx.netcareNormalizeSettings({...value,aiAuditEnabled:true});assert.equal(on.textEnabled,true);assert.equal(on.attachmentsEnabled,true);
    const imported=ctx.netcareImportSettings(ctx.netcareExportSettings(on));assert.equal(imported.sections[0].textPrompt,'Check rollback');assert.ok(!ctx.netcareExportSettings({...on,key:'must-not-export'}).includes('must-not-export'));
});

test('audit cache expires old RFCs, remains bounded, and redacts credentials', () => {
    const ctx={URL,URLSearchParams,TextEncoder,location:new URL('https://unrelated.example'),window:{}};vm.runInNewContext(code,ctx);
    let data=JSON.stringify([{order:'old',created:Date.now()-86400001,items:[]}]);const storage={getItem:()=>data,setItem:(_k,v)=>{data=v;}};
    for(let n=0;n<6;n++)ctx.netcareCacheAudit(storage,'NC'+n,[{section:'1.1',kind:'text',filename:'x.txt',text:'password=hidden token="two words"\n-----BEGIN PRIVATE KEY-----secret-----END PRIVATE KEY-----'}],[]);
    const cached=JSON.parse(data);assert.equal(cached.length,5);assert.ok(!data.includes('hidden'));assert.ok(!data.includes('two words'));assert.ok(!data.includes('secret'));assert.ok(!data.includes('"old"'));
    assert.throws(()=>ctx.netcareCacheAudit(storage,'large',[{text:'x'.repeat(2100000)}],[]),/2MB/);
});

test('audit runner skips unsupported/missing/oversized evidence, continues on model errors, and obeys stop', async () => {
    const ctx={URL,URLSearchParams,location:new URL('https://unrelated.example'),window:{}};vm.runInNewContext(code,ctx);
    const settings=ctx.netcareNormalizeSettings({...ctx.netcareDefaultSettings(),aiAuditEnabled:true,sections:[{number:'3.2',title:'Preparation',textPrompt:'text rule',attachmentsPrompt:'attachment rule'}]});
    let calls=0;const items=[{section:'3.2',kind:'text',filename:'text.txt',text:'evidence'},{section:'3.2',kind:'attachments',filename:'x.docx',error:'TXT only'},{section:'3.2',kind:'attachments',filename:'large.txt',text:'x'.repeat(60001)},{section:'3.2',kind:'attachments',filename:'commands.txt',text:'commands'}];
    const r=await ctx.netcareRunAudits(items,settings,async()=>{calls++;if(calls===1)return{ok:true,report:{status:'pass',summary:'OK',findings:[]},model:'mock'};throw Error('HTTP 500');},new AbortController().signal,()=>{});
    assert.equal(calls,2);assert.deepEqual(Array.from(r,x=>x.status),['pass','needs_review','needs_review','needs_review']);
    const stopped=new AbortController();stopped.abort();await assert.rejects(ctx.netcareRunAudits(items,settings,()=>{},stopped.signal,()=>{}),/Stopped/);
});

test('RFC AI background adapts all four protocols, isolates keys and rejects untrusted audit senders', async () => {
    const pkg=packer.buildPackage({...options,manualLaunch:true});const callbacks=[],requests=[],stored={};
    const ctx={URL,Promise,AbortController,TextDecoder,setTimeout,clearTimeout,console,chrome:{runtime:{id:'test-extension',getURL:p=>'chrome-extension://test-extension/'+p,onInstalled:{addListener(){}},onMessage:{addListener:fn=>callbacks.push(fn)}},storage:{local:{get:async keys=>Object.fromEntries(keys.map(k=>[k,stored[k]]))}}},fetch:async(url,request)=>{
        requests.push({url,request});const text=JSON.stringify({status:'pass',summary:'OK',findings:[]});const protocol=stored.netcareAiModels[0].protocol;
        const data=protocol==='anthropic'?{content:[{type:'text',text}]}:protocol==='responses'?{output:[{content:[{type:'output_text',text}]}]}:protocol==='gemini'?{candidates:[{content:{parts:[{text}]}}]}:{choices:[{message:{content:text}}]};return new Response(JSON.stringify(data),{status:200});
    }};
    vm.runInNewContext(pkg.files['background.js'],ctx);const audit=callbacks[1],sender={id:'test-extension',tab:{id:1},frameId:0,url:onlineUrl};
    stored.netcareExtractionSettings={aiAuditEnabled:true,sections:[{number:'3.2',textPrompt:'Check configuration'}]};
    for(const protocol of ['openai','responses','anthropic','gemini']){
      stored.netcareAiModels=[{id:'one',url:'https://model.example/v1',model:'model-test',key:'secret-test-key',protocol}];stored.netcareAiSelectedModel='one';
      const response=await new Promise(reply=>audit({type:'TP_RFC_AI_AUDIT',id:crypto.randomUUID(),order:onlineOrder,section:'3.2',kind:'text',filename:'test.txt',text:'password=hidden evidence'},sender,reply));
      assert.equal(response.ok,true);assert.equal(response.report.status,'pass');const last=requests.at(-1);assert.equal(last.request.credentials,'omit');assert.ok(!last.request.body.includes('secret-test-key'));assert.ok(!last.request.body.includes('hidden'));assert.ok(last.request.body.includes('untrusted evidence'));assert.ok(!JSON.stringify(response).includes('secret-test-key'));
    }
    const before=requests.length;audit({type:'TP_RFC_AI_AUDIT',id:crypto.randomUUID(),order:onlineOrder}, {...sender,url:'https://other.example'},()=>{});await new Promise(r=>setImmediate(r));assert.equal(requests.length,before);
    assert.match(pkg.files['netcare-ai.html'],/type="password"/);assert.ok(!pkg.files['content.js'].includes('secret-test-key'));
});

test('Anthropic bearer and API-key modes send the requested header and preserve legacy defaults', () => {
    const pkg=packer.buildPackage({...options,manualLaunch:true});const ctx={URL,chrome:{runtime:{onInstalled:{addListener(){}},onMessage:{addListener(){}}}}};vm.runInNewContext(pkg.files['background.js'],ctx);
    const input={protocol:'anthropic',url:'https://model.example/v1',model:'test',key:'test-key'};
    const a=vm.runInNewContext('tpBuildModelRequest(model,"test")',Object.assign(ctx,{model:{...input,authMode:'bearer'}}));
    assert.equal(a.headers.Authorization,'Bearer test-key');assert.equal(a.headers['x-api-key'],undefined);
    const b=vm.runInNewContext('tpBuildModelRequest(model,"test")',Object.assign(ctx,{model:{...input,authMode:'api-key'}}));
    assert.equal(b.headers['x-api-key'],'test-key');assert.equal(b.headers.Authorization,undefined);
    const c=vm.runInNewContext('tpBuildModelRequest(model,"test")',Object.assign(ctx,{model:input}));assert.equal(c.headers['x-api-key'],'test-key');
});

test('connection test diagnostics include HTTP failure response and never expose the model key', async () => {
    const pkg=packer.buildPackage({...options,manualLaunch:true});const callbacks=[];
    const ctx={URL,AbortController,TextDecoder,setTimeout,clearTimeout,chrome:{runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,onInstalled:{addListener(){}},onMessage:{addListener:fn=>callbacks.push(fn)}},storage:{local:{get:async()=>({})}}},fetch:async()=>new Response(JSON.stringify({error:{message:'Rejected test-key',api_key:'test-key',code:'intranet_auth_failed'}}),{status:403})};
    vm.runInNewContext(pkg.files['background.js'],ctx);
    const response=await new Promise(reply=>callbacks[1]({type:'TP_RFC_AI_TEST',id:crypto.randomUUID(),model:{protocol:'anthropic',authMode:'bearer',url:'https://model.example/v1',model:'test',key:'test-key'}},{id:'test',url:'chrome-extension://test/netcare-ai.html',frameId:1,tab:{id:1}},reply));
    assert.equal(response.ok,false);assert.equal(response.diagnostics.httpStatus,403);assert.match(response.diagnostics.response,/intranet_auth_failed/);assert.ok(!JSON.stringify(response).includes('test-key'));assert.ok(response.diagnostics.elapsedMs>=0);
});

test('audit summaries serialize concurrent RFCs, reject other sites and redact displayed evidence', async () => {
    const pkg=packer.buildPackage({...options,manualLaunch:true});const callbacks=[],stored={};
    const ctx={URL,chrome:{runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,onInstalled:{addListener(){}},onMessage:{addListener:fn=>callbacks.push(fn)}},storage:{local:{get:async key=>({[key]:stored[key]}),set:async d=>Object.assign(stored,d)}}}};
    vm.runInNewContext(pkg.files['background.js'],ctx);const publish=callbacks[2];
    const send=order=>new Promise(reply=>publish({type:'TP_RFC_AUDIT_PUBLISH',order,record:{order,items:[{section:'1.1',kind:'text',filename:'1.1.txt',text:'password=hidden'}],reports:[{section:'1.1',kind:'text',filename:'1.1.txt',status:'fail',summary:'Missing scope',rule:'Check scope'}]}},{id:'test',frameId:0,tab:{id:1},url:onlineUrl.replaceAll(onlineOrder,order)},reply));
    const replies=await Promise.all([send(onlineOrder),send('NC20260903002788')]);assert.ok(replies.every(r=>r.ok));assert.equal(stored.netcareAuditSummaries.length,2);assert.ok(!JSON.stringify(stored).includes('hidden'));
    let rejected;publish({type:'TP_RFC_AUDIT_PUBLISH',order:onlineOrder,record:{}},{id:'test',frameId:0,tab:{id:1},url:'https://other.example'},r=>{rejected=r;});assert.equal(rejected.ok,false);
});

test('saved audit and draft test use identical authentication; audit 401 details reach reports without keys', async () => {
    const pkg=packer.buildPackage({...options,manualLaunch:true}),callbacks=[],requests=[];
    const model={id:'saved',name:'Intranet',protocol:'openai',url:'https://model.example/v1',model:'test-model',key:'private-test-key',authMode:'bearer'};
    const settings={aiAuditEnabled:true,sections:[{number:'3.4',title:'Test and Verification',textPrompt:'Check KPI tests'}]};
    const stored={netcareAiModels:[model],netcareAiSelectedModel:'saved',netcareExtractionSettings:settings};
    const ctx={URL,AbortController,TextDecoder,setTimeout,clearTimeout,chrome:{runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,onInstalled:{addListener(){}},onMessage:{addListener:fn=>callbacks.push(fn)}},storage:{local:{get:async()=>stored}}},fetch:async(url,request)=>{requests.push({url,request});return requests.length===1?new Response(JSON.stringify({choices:[{message:{content:'OK'}}]}),{status:200}):new Response(JSON.stringify({error:{code:'invalid_api_key',message:'Rejected private-test-key'}}),{status:401});}};
    vm.runInNewContext(pkg.files['background.js'],ctx);
    const send=(type,sender,data)=>new Promise(reply=>callbacks[1]({type,id:crypto.randomUUID(),...data},sender,reply));
    const tested=await send('TP_RFC_AI_TEST',{id:'test',url:'chrome-extension://test/netcare-ai.html',frameId:1,tab:{id:1}},{model});assert.equal(tested.ok,true);
    const failed=await send('TP_RFC_AI_AUDIT',{id:'test',url:onlineUrl,frameId:0,tab:{id:2}},{order:onlineOrder,section:'3.4',kind:'text',filename:'3.4.txt',text:'KPI service test'});
    assert.equal(failed.ok,false);assert.equal(failed.diagnostics.httpStatus,401);assert.equal(failed.diagnostics.configSource,'saved-audit-model');assert.match(failed.diagnostics.response,/invalid_api_key/);assert.ok(!JSON.stringify(failed).includes(model.key));
    assert.equal(requests[0].url,requests[1].url);assert.equal(requests[0].request.headers.Authorization,requests[1].request.headers.Authorization);
    const page={URL,URLSearchParams,location:new URL('https://unrelated.example'),window:{}};vm.runInNewContext(code,page);
    const reports=await page.netcareRunAudits([{section:'3.4',kind:'text',filename:'3.4.txt',text:'KPI service test'}],settings,async()=>failed,new AbortController().signal,()=>{});
    assert.equal(reports[0].status,'needs_review');assert.equal(reports[0].diagnostics.httpStatus,401);assert.match(reports[0].diagnostics.response,/invalid_api_key/);
});

test('full encrypted backup roundtrips model tokens, rules and retained evidence; bad passwords and tampering fail', async()=>{
    const backup=require('../backend/builtin-tools/f12-to-extension/netcare-backup')();
    const data={netcareAiModels:[{id:'m1',name:'AI',protocol:'openai',url:'https://model.example/v1',model:'test',key:'sensitive-backup-token'}],netcareAiSelectedModel:'m1',netcareAuditSummaries:[{order:onlineOrder,at:new Date().toISOString(),items:[{text:'sample evidence'}],reports:[]}],netcareExtractionSettings:{sections:[{number:'3.4',textPrompt:'KPI rule'}]}};
    const text=await backup.encrypt(data,'test-password-2026');assert.ok(!text.includes('sensitive-backup-token'));assert.ok(!text.includes('sample evidence'));assert.ok(!text.includes('KPI rule'));assert.deepEqual(await backup.decrypt(text,'test-password-2026'),data);
    await assert.rejects(backup.decrypt(text,'wrong-password'),/Wrong password/);const altered=JSON.parse(text);altered.ciphertext='AAAA'+altered.ciphertext.slice(4);await assert.rejects(backup.decrypt(JSON.stringify(altered),'test-password-2026'),/damaged/);
    assert.equal(backup.allowed('netcareAiModels'),true);assert.equal(backup.allowed('netcareWordName:'+onlineOrder),true);assert.equal(backup.allowed('Cookie'),false);
    assert.throws(()=>backup.validate({Cookie:'must not import'},()=>true,()=>{}),/fields/);
    const legacy=await backup.decrypt(JSON.stringify({format:'netcare-rfc-settings',version:1,settings:{sections:[]}}),'');assert.deepEqual(legacy,{netcareExtractionSettings:{sections:[]}});
    const pkg=packer.buildPackage({...options,manualLaunch:true});assert.ok(pkg.files['netcare-backup.html']);assert.ok(pkg.files['netcare-renderer.js'].includes('html2canvas'));assert.ok(pkg.manifest.content_scripts.some(c=>c.world==='MAIN'&&c.js.includes('netcare-renderer.js')));
    for(const [name,script]of Object.entries(pkg.files))if(name.endsWith('.js'))new vm.Script(script,{filename:name});
});

test('native evidence capture splits tall regions and refuses missing or oversized original elements',async()=>{
    const ctx={URL,URLSearchParams,location:new URL('https://unrelated.example'),window:{}};vm.runInNewContext(code,ctx);
    let draws=0;const element={isConnected:true,scrollWidth:1000,scrollHeight:3201,getBoundingClientRect:()=>({width:1000,height:3201}),ownerDocument:{createElement:()=>({getContext:()=>({drawImage:()=>draws++}),toBlob:fn=>fn(new Blob(['png']))})}};
    const images=await ctx.netcareCaptureEvidence(element,async()=>({width:1000,height:3201}),new AbortController().signal);assert.equal(images.length,3);assert.equal(draws,3);
    await assert.rejects(ctx.netcareCaptureEvidence(null,()=>{},new AbortController().signal),/Original region/);
    await assert.rejects(ctx.netcareCaptureEvidence({...element,scrollHeight:50000},()=>{},new AbortController().signal),/limit/);
});

test('Excel keeps five columns, merged RFC and chapter cells, full error details and literal spreadsheet content',async()=>{
    const ctx={URL,URLSearchParams,Blob,TextEncoder,location:new URL('https://unrelated.example'),window:{}};vm.runInNewContext(code,ctx);
    const records=[{order:onlineOrder,wordFilename:onlineOrder+'_方案.docx',items:[{section:'3.4',kind:'text',filename:'3.4-测试.txt',text:'=HYPERLINK("https://example.invalid") <literal>'}],reports:[{section:'3.4',sectionTitle:'Test',kind:'text',filename:'3.4-测试.txt',rule:'Check KPI',status:'fail',summary:'No thresholds'},{section:'3.4',kind:'attachments',filename:'3.4-检查.txt',status:'needs_review',summary:'HTTP 401',diagnostics:{httpStatus:401,response:'Invalid token'}}]}];
    const JSZip=require('../backend/node_modules/jszip');const workbook=await JSZip.loadAsync(await (await ctx.netcareAuditExcel(records)).arrayBuffer()),sheet=await workbook.file('xl/worksheets/sheet1.xml').async('string');
    assert.match(sheet,/mergeCell ref="A2:A3"/);assert.match(sheet,/mergeCell ref="B2:B3"/);assert.match(sheet,/&lt;literal&gt;/);assert.match(sheet,/inlineStr/);assert.ok(!sheet.includes('<f>'));assert.match(sheet,/Invalid token/);
});

test('materials ZIP preserves original Word/attachments in RFC folders and explicitly records missing originals',async()=>{
    const ctx={URL,URLSearchParams,Blob,TextEncoder,location:new URL('https://unrelated.example'),window:{}};vm.runInNewContext(code,ctx);
    const order=onlineOrder,record={order,wordFilename:order+'_方案.docx',items:[{section:'3.4',kind:'text',filename:'3.4-测试.txt',text:'cached text'}],reports:[{section:'3.4',kind:'text',filename:'3.4-测试.txt',status:'pass',summary:'OK'},{section:'3.4',kind:'attachments',filename:'3.4-附件.docx',status:'needs_review',summary:'TXT only'}]};
    const word=new Blob([new Uint8Array([80,75,0,9])]),attachment=new Blob([new Uint8Array([7,8,9])]);
    const files=[{order,name:record.wordFilename},{order,name:'3.4-附件.docx'}];
    const result=await ctx.netcareAuditMaterials([record],files,async f=>f.name===record.wordFilename?word:attachment);
    assert.equal(result.missing.length,0);assert.equal(result.reconstructed.length,1);
    const JSZip=require('../backend/node_modules/jszip'),zip=await JSZip.loadAsync(await (await ctx.createNetcareZip(result.entries)).arrayBuffer());assert.deepEqual(await zip.file(order+'/'+record.wordFilename).async('uint8array'),new Uint8Array([80,75,0,9]));assert.deepEqual(await zip.file(order+'/3.4-附件.docx').async('uint8array'),new Uint8Array([7,8,9]));assert.match(await zip.file(order+'/3.4-测试.txt').async('string'),/cached text/);assert.ok(zip.file('审计结果.xlsx'));assert.ok(zip.file('文本回填说明.txt'));
    const missing=await ctx.netcareAuditMaterials([record],[],async()=>{throw Error('must not fetch');});assert.equal(missing.missing.length,2);assert.ok(missing.entries.some(e=>e.name==='缺失材料清单.txt'));
});

test('artifact background rejects foreign sites and MAIN uploads before touching file storage',()=>{
    const pkg=packer.buildPackage({...options,manualLaunch:true}),callbacks=[];const ctx={URL,chrome:{runtime:{id:'test',onInstalled:{addListener(){}},onMessage:{addListener:fn=>callbacks.push(fn)}}}};vm.runInNewContext(pkg.files['background.js'],ctx);
    const send=(url,action)=>{let response;callbacks[3]({type:'TP_RFC_ARTIFACT_REQUEST',action,order:onlineOrder,fileId:crypto.randomUUID(),name:'x.docx',size:4},{id:'test',url,frameId:0,tab:{id:1}},r=>response=r);return response;};
    assert.equal(send('https://other.example','read').ok,false);assert.equal(send('https://netcare.huawei.com/p/netcare/index.html','begin').ok,false);assert.equal(send(onlineUrl,'read').ok,false);
    assert.ok(pkg.files['netcare-artifact-relay.js']);
});

test('language component renders UI labels without changing raw evidence or filenames', () => {
    const factory = require('../backend/builtin-tools/f12-to-extension/netcare-language');
    const nodes = ['RFC 单号 / RFC numbers', '通过 / Pass', '原文: token=test', '3.4-Test.txt'].map((data, i) => ({ data, get textContent(){return this.data;}, parentElement:{closest(selector){return i===2&&selector.includes('pre')?{}:i===3&&selector==='summary'?{}:null;}} }));
    const root = { ownerDocument:{createTreeWalker(){let i=0;return{nextNode(){return nodes[i++]||null;}};}},querySelectorAll(){return[];} };
    const previous=global.MutationObserver;global.MutationObserver=class{observe(){}disconnect(){}};
    try{const ui=factory(root,'zh');assert.equal(nodes[0].data,'RFC 单号');ui.set('en');assert.equal(nodes[0].data,'RFC numbers');assert.equal(nodes[1].data,'Pass');assert.equal(nodes[2].data,'原文: token=test');assert.equal(nodes[3].data,'3.4-Test.txt');ui.set('zh');assert.equal(nodes[1].data,'通过');ui.stop();}finally{global.MutationObserver=previous;}
});

test('online tab creation sends a second confirmation and accepts a validated online ready signal',async()=>{
    const result=packer.buildPackage({...options,includePopup:true,manualLaunch:true}),callbacks=[],sent=[],runtime={id:'fixture',onMessage:{addListener(f){callbacks.push(f);}},onInstalled:{addListener(){}}};
    const chrome={runtime,storage:{local:{get:async()=>({}),set:async()=>{}},onChanged:{addListener(){}}},tabs:{create:async()=>({id:31}),sendMessage:async(id,m)=>sent.push({id,m})}};
    vm.runInNewContext(result.files['background.js'],{chrome,URL,AbortController,setTimeout,clearTimeout,fetch:async()=>{},console});
    const url='https://de.kdp.gts.huawei.com/ows1/static/editor/IdpLiteView/OwsPage.html?docId=NC20260906000732&order_id=NC20260906000732';
    let reply;callbacks[0]({type:'TP_RFC_OPEN_ONLINE',id:'open-test',order:'NC20260906000732',url},{tab:{id:10},frameId:0,url:'https://netcare-ae.gts.huawei.com/p/netcare/index.html'},r=>reply=r);
    await new Promise(resolve=>setImmediate(resolve));assert.equal(reply.ok,true);assert.equal(sent[0].id,10);assert.equal(sent[0].m.id,'open-test');
    callbacks[0]({type:'TP_RFC_ONLINE_READY',order:'NC20260906000732'},{id:'fixture',tab:{id:31},frameId:0,url},()=>{});assert.equal(sent.length,2);
    callbacks[0]({type:'TP_RFC_ONLINE_READY',order:'NC20260906000732'},{id:'fixture',tab:{id:31},frameId:0,url:'https://evil.test/'},()=>{});assert.equal(sent.length,2);
});

test('binary cache rejects invalid snapshot and capacity requests before accessing IndexedDB',async()=>{
    const cache=require('../backend/builtin-tools/f12-to-extension/netcare-artifacts')(null);
    await assert.rejects(cache.saveSnapshot([]),/Invalid snapshot/);
    await assert.rejects(cache.saveSnapshot([{order:'bad',reports:[],items:[]}]),/Invalid snapshot/);
    await assert.rejects(cache.configure(10*1024*1024),/safe range/);
    await assert.rejects(cache.cleanup([42]),/Invalid snapshots/);
});
