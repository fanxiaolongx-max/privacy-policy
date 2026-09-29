const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const packer = require('../backend/builtin-tools/f12-to-extension/packer-core');

const toolDir = path.join(__dirname, '../backend/builtin-tools/f12-to-extension');

test('overseas salary calculator template appears as a complete built-in template in F12 extension packer', async () => {
    const html = fs.readFileSync(path.join(toolDir, 'index.html'), 'utf8');
    assert.equal((html.match(/<option value="overseas-salary-calculator"/g) || []).length, 1);
    assert.equal(packer.BUILTIN_TEMPLATES['overseas-salary-calculator'].isFullExtension, true);

    const zip = await JSZip.loadAsync(fs.readFileSync(path.join(toolDir, 'overseas-salary-calculator.template.zip')));
    const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
    assert.equal(manifest.manifest_version, 3);
    assert.equal(manifest.default_locale, 'zh_CN');
    assert.equal(manifest.action.default_popup, 'popup.html');
    for (const file of [
        'popup.html',
        'popup.js',
        'popup.css',
        'background.js',
        'icons/icon128.png',
        'icons/icon48.png',
        'icons/icon32.png',
        'icons/icon16.png',
        '_locales/zh_CN/messages.json',
        '_locales/en/messages.json'
    ]) {
        assert.ok(zip.file(file), `Salary calculator template is missing ${file}`);
    }

    const zhMessages = JSON.parse(await zip.file('_locales/zh_CN/messages.json').async('string'));
    const enMessages = JSON.parse(await zip.file('_locales/en/messages.json').async('string'));
    assert.equal(zhMessages.appName.message, '驻外薪资换汇计算器');
    assert.equal(enMessages.appName.message, 'Overseas Salary Currency Calculator');

    const updatedStore = packer.transformChromeCaptureManifest(manifest, {
        name: '驻外薪资换汇计算器',
        version: '1.0.1',
        description: '专为驻外员工打造的薪资换汇与盈亏核算工具',
        packageTarget: 'store'
    });
    assert.equal(updatedStore.version, '1.0.1');
    assert.equal(updatedStore.key, undefined, 'Store package must not contain manifest.key');
    assert.equal(updatedStore.name, '__MSG_appName__', 'Store package must preserve i18n name placeholder');
    assert.equal(updatedStore.default_locale, 'zh_CN');

    const updatedLocal = packer.transformChromeCaptureManifest(manifest, {
        name: '驻外薪资换汇计算器',
        version: '1.0.1',
        description: '专为驻外员工打造的薪资换汇与盈亏核算工具',
        packageTarget: 'local',
        extensionKey: 'test-local-key'
    });
    assert.equal(updatedLocal.key, 'test-local-key');
    assert.equal(updatedLocal.name, '__MSG_appName__');
});

test('overseas salary calculator popup supports bilingual Chinese and English translation', async () => {
    const zip = await JSZip.loadAsync(fs.readFileSync(path.join(toolDir, 'overseas-salary-calculator.template.zip')));
    const popupHtml = await zip.file('popup.html').async('string');
    assert.ok(popupHtml.includes('id="btn-lang"'), 'Popup must include language toggle button');
    assert.ok(popupHtml.includes('data-i18n="appTitle"'), 'Popup must have data-i18n hooks');

    const popupJs = await zip.file('popup.js').async('string');
    assert.ok(popupJs.includes('const I18N = {'), 'Popup script must define I18N dictionary');
    assert.ok(popupJs.includes('preferredLang'), 'Popup must persist language preference');
    assert.ok(popupJs.includes('Overseas Salary Calculator'), 'English translations must be present');
    assert.ok(popupJs.includes('handleLangToggle'), 'Language toggle event handler must be present');
});
