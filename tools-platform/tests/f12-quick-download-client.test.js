const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../frontend/js/shared/f12-quick-downloads.js'), 'utf8');

function client() {
    const listeners = new Map(), children = [], downloads = [], timers = [], revoked = [];
    const window = {
        addEventListener: (event, callback) => listeners.set(event, callback),
        removeEventListener: event => listeners.delete(event)
    };
    const document = {
        readyState: 'complete', getElementById: () => null,
        body: { append: child => children.push(child) },
        createElement: tag => ({ tag, contentWindow: {}, remove() { this.removed = true; }, click() { downloads.push(this.download); } })
    };
    const context = {
        window, document, location: { origin: 'http://intranet.test' }, localStorage: { getItem: () => null },
        URLSearchParams, Uint32Array, Blob, crypto: require('node:crypto').webcrypto,
        URL: { createObjectURL: () => 'blob:test', revokeObjectURL: url => revoked.push(url) },
        setTimeout: (callback, delay) => { const timer = { callback, delay }; timers.push(timer); return timer; },
        clearTimeout: timer => { timer.cancelled = true; }
    };
    vm.runInNewContext(source, context);
    return { api: window.ToolsF12QuickDownloads, listeners, children, downloads, timers, revoked };
}

function message(frame, overrides = {}) {
    return {
        origin: 'http://intranet.test', source: frame.contentWindow,
        data: { source: 'TP_F12_QUICK_PACK', requestId: new URL(frame.src, 'http://intranet.test').searchParams.get('requestId'),
            ok: true, blob: new Blob(['zip']), filename: 'extension-netcare-v1.0.1-local.zip' },
        ...overrides
    };
}

test('download accepts only its same-origin frame and request, then releases the frame and URL', async () => {
    const c = client();
    const promise = c.api.download({ scriptId: 'builtin:netcare-rfc-word', target: 'local' });
    const frame = c.children[0], receive = c.listeners.get('message');
    assert.equal(frame.hidden, true);
    assert.equal(new URL(frame.src, 'http://intranet.test').searchParams.get('scriptId'), 'netcare-rfc-word');
    receive(message(frame, { origin: 'https://other.test' }));
    receive(message(frame, { source: {} }));
    const wrong = message(frame); wrong.data.requestId = 'another-request'; receive(wrong);
    assert.deepEqual(c.downloads, []);
    assert.equal(frame.removed, undefined);
    receive(message(frame));
    await promise;
    assert.deepEqual(c.downloads, ['extension-netcare-v1.0.1-local.zip']);
    assert.equal(frame.removed, true);
    assert.equal(c.listeners.has('message'), false);
    assert.equal(c.timers.find(timer => timer.delay === 120000).cancelled, true);
    c.timers.find(timer => timer.delay === 60000).callback();
    assert.deepEqual(c.revoked, ['blob:test']);
});

test('failed, malformed and timed-out packages clean up without a download', async () => {
    for (const kind of ['failed', 'malformed', 'timeout']) {
        const c = client(), promise = c.api.download({ scriptId: 'server:library-one', target: 'store' });
        const rejection = assert.rejects(promise);
        const frame = c.children[0];
        if (kind === 'timeout') c.timers[0].callback();
        else {
            const event = message(frame);
            if (kind === 'failed') Object.assign(event.data, { ok: false, error: 'Forbidden' });
            else event.data.filename = '../../file.zip';
            c.listeners.get('message')(event);
        }
        await rejection;
        assert.equal(frame.removed, true);
        assert.deepEqual(c.downloads, []);
        assert.equal(c.listeners.has('message'), false);
    }
    const c = client();
    await assert.rejects(c.api.download({ scriptId: 'builtin:../../file', target: 'store' }));
    assert.equal(c.children.length, 0);
});
