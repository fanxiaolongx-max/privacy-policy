const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const JSZip = require('jszip');
const packer = require('../backend/builtin-tools/f12-to-extension/packer-core');

const toolDir = path.join(__dirname, '../backend/builtin-tools/f12-to-extension');

test('identical Chrome and Edge PPO packages appear as one complete built-in template', async () => {
    const html = fs.readFileSync(path.join(toolDir, 'index.html'), 'utf8');
    assert.equal((html.match(/<option value="ppo-traffic-autofill"/g) || []).length, 1);
    assert.equal(packer.BUILTIN_TEMPLATES['ppo-traffic-autofill'].isFullExtension, true);

    const zip = await JSZip.loadAsync(fs.readFileSync(path.join(toolDir, 'ppo-traffic-autofill.template.zip')));
    const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
    assert.deepEqual(manifest.content_scripts[0].js, ['utils.js', 'content.js']);
    for (const file of ['popup.html', 'popup.js', 'background.js', 'floating-ui.css', 'icons/icon128.png']) {
        assert.ok(zip.file(file), `PPO template is missing ${file}`);
    }
    assert.equal(zip.file('license-config.json'), null);

    const updated = packer.transformChromeCaptureManifest(manifest, {
        name: 'PPO 交通违章表单自动填表器', version: '1.0.14',
        description: 'PPO 表单辅助', packageTarget: 'store'
    });
    assert.equal(updated.version, '1.0.14');
    assert.deepEqual(updated.host_permissions, manifest.host_permissions);
    assert.equal(updated.key, undefined);
});
