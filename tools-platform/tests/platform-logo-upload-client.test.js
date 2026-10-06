const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const script = fs.readFileSync(path.join(__dirname, '../frontend/js/shared/platform-logo-upload.js'), 'utf8');

function client() {
    let closed = false, canvas;
    const window = { createImageBitmap: async () => ({ width: 4096, height: 2048, close() { closed = true; } }) };
    const context = { drawImage() {}, imageSmoothingEnabled: false };
    const document = { createElement: () => canvas = { getContext: () => context, toBlob: callback => callback(new Blob(['png'], { type: 'image/png' })) } };
    vm.runInNewContext(script, { window, document, File, Blob });
    return { window, dimensions: () => [canvas.width, canvas.height], closed: () => closed };
}

test('WEBP upload is normalized to PNG and oversized dimensions scale proportionally', async () => {
    const app = client();
    const file = await app.window.PlatformLogoUpload.prepareFile(new File(['webp'], 'brand.webp', { type: 'image/webp' }));
    assert.equal(file.type, 'image/png'); assert.equal(file.name, 'brand.png');
    assert.deepEqual(app.dimensions(), [2048, 1024]); assert.equal(app.closed(), true);
});

test('invalid image formats, oversized uploads and corrupt images have clear error codes', async () => {
    const { window } = client();
    await assert.rejects(window.PlatformLogoUpload.prepareFile(new File(['x'], 'bad.txt', { type: 'text/plain' })), /LOGO_FORMAT/);
    await assert.rejects(window.PlatformLogoUpload.prepareFile({ type: 'image/png', size: 26 * 1024 * 1024 }), /LOGO_SIZE/);
    window.createImageBitmap = async () => { throw new Error('corrupt'); };
    await assert.rejects(window.PlatformLogoUpload.prepareFile(new File(['x'], 'bad.png', { type: 'image/png' })), /LOGO_DECODE/);
});
