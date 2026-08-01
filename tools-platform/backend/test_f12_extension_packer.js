const assert = require('assert');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const packer = require('./builtin-tools/f12-to-extension/packer-core');

const toolDir = path.join(__dirname, 'builtin-tools/f12-to-extension');
const defaultCode = fs.readFileSync(path.join(toolDir, 'default-f12.js'), 'utf8');

function baseOptions(overrides = {}) {
    return {
        name: 'SV/CFC 满意度监控',
        version: '1.0.0',
        description: '监控脚本',
        matches: 'https://w3.huawei.com/*',
        world: 'MAIN',
        includePopup: true,
        runAt: 'document_idle',
        allFrames: false,
        optionalPermissions: [],
        code: defaultCode,
        ...overrides
    };
}

function testDefaultCompatibility() {
    const result = packer.buildPackage(baseOptions());
    assert.deepStrictEqual(result.manifest.permissions, ['storage', 'activeTab', 'scripting']);
    assert.deepStrictEqual(result.manifest.host_permissions, ['https://w3.huawei.com/*']);
    assert.deepStrictEqual(result.manifest.content_scripts, [{
        matches: ['https://w3.huawei.com/*'],
        js: ['content.js'],
        run_at: 'document_idle',
        world: 'MAIN'
    }]);
    assert.strictEqual(result.files['content.js'], defaultCode, '默认脚本必须原样写入');
    assert.ok(result.files['popup.js'].includes('source: "EXTENSION_POPUP"'));
    assert.ok(defaultCode.includes('event.data?.source === "EXTENSION_POPUP"'));
    new Function(result.files['popup.js']);
    new Function(result.files['background.js']);
}

function testAdvancedOptionsAreOptIn() {
    const result = packer.buildPackage(baseOptions({
        matches: 'https://one.example/*\nhttps://two.example/*',
        runAt: 'document_start',
        allFrames: true,
        optionalPermissions: ['downloads', 'cookies', 'downloads']
    }));
    assert.deepStrictEqual(result.manifest.host_permissions, [
        'https://one.example/*',
        'https://two.example/*'
    ]);
    assert.strictEqual(result.manifest.content_scripts[0].run_at, 'document_start');
    assert.strictEqual(result.manifest.content_scripts[0].all_frames, true);
    assert.deepStrictEqual(result.manifest.permissions, [
        'storage', 'activeTab', 'scripting', 'downloads', 'cookies'
    ]);
}

function testValidationAndDiagnostics() {
    assert.strictEqual(packer.isValidVersion('1.0.0'), true);
    assert.strictEqual(packer.isValidVersion('1.01'), false);
    assert.strictEqual(packer.isValidMatchPattern('<all_urls>'), true);
    assert.strictEqual(packer.isValidMatchPattern('https://*.example.com/*'), true);
    assert.strictEqual(packer.isValidMatchPattern('https://*.example.com:8443/*'), true);
    assert.strictEqual(packer.isValidMatchPattern('file:///foo*'), true);
    assert.strictEqual(packer.isValidMatchPattern('ftp://example.com/*'), false);

    const invalid = packer.validateOptions(baseOptions({
        version: 'v1',
        matches: 'not-a-pattern',
        code: 'await fetch("/api")'
    }));
    assert.ok(invalid.errors.some(message => message.includes('版本号')));
    assert.ok(invalid.errors.some(message => message.includes('匹配网址')));
    assert.ok(invalid.errors.some(message => message.includes('content.js')));

    const diagnostics = packer.analyzeCode('copy($0); GM_setValue("x", 1); chrome.downloads.download({});');
    assert.ok(diagnostics.warnings.some(message => message.includes('DevTools')));
    assert.ok(diagnostics.warnings.some(message => message.includes('油猴')));
    assert.ok(diagnostics.suggestions.some(message => message.includes('downloads')));
}

function testGeneratedMarkupIsEscaped() {
    const result = packer.buildPackage(baseOptions({ name: '<img src=x onerror=alert(1)>' }));
    assert.ok(!result.files['popup.html'].includes('<img src=x'));
    assert.ok(result.files['popup.html'].includes('&lt;img'));
}

async function testZipRoundTrip() {
    const generated = packer.buildPackage(baseOptions());
    const zip = new JSZip();
    Object.entries(generated.files).forEach(([name, content]) => zip.file(name, content));
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    const reopened = await JSZip.loadAsync(buffer);
    const manifest = JSON.parse(await reopened.file('manifest.json').async('string'));
    const content = await reopened.file('content.js').async('string');
    assert.strictEqual(manifest.content_scripts[0].world, 'MAIN');
    assert.strictEqual(content, defaultCode, 'ZIP 往返后默认脚本必须保持不变');
    ['popup.html', 'popup.css', 'popup.js', 'background.js'].forEach(file => {
        assert.ok(reopened.file(file), `ZIP 应包含 ${file}`);
    });
}

async function main() {
    testDefaultCompatibility();
    testAdvancedOptionsAreOptIn();
    testValidationAndDiagnostics();
    testGeneratedMarkupIsEscaped();
    await testZipRoundTrip();
    console.log('F12 extension packer tests passed');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
