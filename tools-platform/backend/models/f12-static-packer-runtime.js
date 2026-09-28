(function () {
    'use strict';

    const $ = id => document.getElementById(id);
    let catalog = { builtins: [], saved: [] };
    let selected = null;

    function status(message, tone = '') {
        const node = $('status');
        node.textContent = message;
        node.className = 'status ' + tone;
    }

    function fillSelect() {
        const select = $('preset');
        for (const [label, items, prefix] of [
            ['系统内置脚本', catalog.builtins, 'builtin'],
            ['发布时保存的脚本', catalog.saved, 'saved']
        ]) {
            const group = document.createElement('optgroup');
            group.label = label;
            for (const item of items) {
                const option = document.createElement('option');
                option.value = prefix + ':' + (prefix === 'builtin' ? item.id : item.id);
                option.textContent = item.name;
                group.appendChild(option);
            }
            select.appendChild(group);
        }
    }

    function applyPreset() {
        const key = $('preset').value;
        const [kind, id] = key.split(':');
        selected = kind === 'builtin'
            ? catalog.builtins.find(item => item.id === id)
            : kind === 'saved' ? catalog.saved.find(item => item.id === id) : null;
        if (!selected) {
            for (const id of ['name', 'description', 'matches', 'code']) $(id).value = '';
            $('code').readOnly = false;
            $('code').placeholder = '// 粘贴或选择脚本';
            status('新脚本：填写配置和代码后即可打包。');
            return;
        }
        $('name').value = selected.name || '';
        $('description').value = selected.description || '';
        $('matches').value = selected.matches || '';
        $('world').value = selected.world || 'MAIN';
        $('runAt').value = selected.runAt || 'document_idle';
        $('popup').checked = selected.includePopup !== false;
        $('manual').checked = selected.manualLaunch === true;
        $('allFrames').checked = selected.allFrames === true;
        $('code').value = selected.code || '';
        const permissions = new Set(selected.optionalPermissions || []);
        for (const option of $('permissions').options) option.selected = permissions.has(option.value);
        $('code').readOnly = Boolean(selected.isFullExtension);
        $('code').placeholder = selected.isFullExtension
            ? '完整扩展工程随快照提供；此模板不使用 content.js 编辑框。'
            : '// 粘贴或选择脚本';
        status(selected.isFullExtension
            ? '已载入完整扩展模板。打包时会更新 Manifest 和关闭 License 校验。'
            : '已载入脚本，可修改后打包。');
    }

    function collectOptions() {
        return {
            name: $('name').value.trim(),
            version: $('version').value.trim(),
            description: $('description').value.trim(),
            matches: $('matches').value,
            world: $('world').value,
            runAt: $('runAt').value,
            packageTarget: $('target').value,
            includePopup: $('popup').checked,
            manualLaunch: $('manual').checked,
            allFrames: $('allFrames').checked,
            optionalPermissions: [...$('permissions').selectedOptions].map(option => option.value),
            code: $('code').value,
            license: { enabled: false }
        };
    }

    async function chromeTemplate() {
        const isPpoTraffic = selected?.id === 'ppo-traffic-autofill';
        const base64 = isPpoTraffic ? catalog.ppoTemplateBase64 : catalog.templateBase64;
        if (base64) return JSZip.loadAsync(base64, { base64: true });
        const response = await fetch(isPpoTraffic ? window.TP_F12_PPO_TEMPLATE_URL : window.TP_F12_TEMPLATE_URL, { cache: 'no-store' });
        if (!response.ok) throw new Error('扩展模板读取失败：HTTP ' + response.status);
        return JSZip.loadAsync(await response.arrayBuffer());
    }

    async function createZip(options) {
        if (selected && selected.isFullExtension) {
            const zip = await chromeTemplate();
            const manifestFile = zip.file('manifest.json');
            if (!manifestFile) throw new Error('扩展模板缺少 manifest.json');
            const manifest = JSON.parse(await manifestFile.async('string'));
            const updated = F12ExtensionPacker.transformChromeCaptureManifest(manifest, options);
            zip.file('manifest.json', JSON.stringify(updated, null, 2));
            if (selected.id === 'chrome-capture-pro') {
                zip.file('license-config.json', JSON.stringify({ enabled: false, productId: options.name, validationUrl: '', publicKeyJwk: null }, null, 2));
            }
            return zip;
        }
        const generated = F12ExtensionPacker.buildPackage(options);
        const zip = new JSZip();
        for (const [filename, content] of Object.entries(generated.files)) zip.file(filename, content);
        return zip;
    }

    async function pack() {
        const button = $('pack');
        if (button.disabled) return;
        button.disabled = true;
        try {
            if (!window.JSZip || !window.F12ExtensionPacker) throw new Error('打包组件未加载');
            const options = collectOptions();
            const check = F12ExtensionPacker.validateOptions(options);
            if (check.errors.length) throw new Error(check.errors.join('\n'));
            status(check.warnings.concat(check.suggestions).join('\n') || '正在生成扩展包…');
            const zip = await createZip(options);
            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const slug = options.name.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'extension';
            link.href = url;
            link.download = `extension-${slug}-v${options.version}-${options.packageTarget}.zip`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 60000);
            status(`已生成 ${link.download}（${Math.ceil(blob.size / 1024)} KB）`, 'ok');
        } catch (error) {
            status('打包失败：' + error.message, 'error');
        } finally {
            button.disabled = false;
        }
    }

    async function start() {
        try {
            if (window.TP_F12_DATA) catalog = window.TP_F12_DATA;
            else {
                const response = await fetch(window.TP_F12_DATA_URL, { cache: 'no-store' });
                if (!response.ok) throw new Error('脚本数据读取失败：HTTP ' + response.status);
                catalog = await response.json();
            }
            fillSelect();
            $('preset').addEventListener('change', applyPreset);
            $('pack').addEventListener('click', pack);
            if (catalog.builtins.length) {
                $('preset').value = 'builtin:' + catalog.builtins[0].id;
                applyPreset();
            } else status('没有已发布脚本，可手动粘贴代码。');
        } catch (error) {
            status(error.message, 'error');
        }
    }

    start();
})();
