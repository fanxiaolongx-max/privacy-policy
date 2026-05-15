/**
 * uivf12/save.js - 脚本保存模块
 * 负责：当前工作台生成结果保存到服务端脚本仓库（支持 NetCare 三区阵列）
 */

async function saveCurrentScript() {
    const codeUIV = document.getElementById('codeOutput').value;
    const codeConsole = document.getElementById('consoleOutput').value;
    const url = document.getElementById('requestUrl').value.trim();
    if (!codeUIV || !codeConsole) { alert('⚠️ 请先生成脚本后再保存！'); return; }

    const parsedPayloadObj = window.UIVWorkbench.getParsedPayload();
    const rawJson = parsedPayloadObj ? JSON.stringify(parsedPayloadObj, null, 4) : document.getElementById('jsonInput').value.trim();
    const originalFileName = document.getElementById('fileName').value.trim() || 'PBI_自动抓取';
    const configOptions = {
        useGlobalVars: document.getElementById('useGlobalVars').checked,
        isPagination: document.getElementById('isPagination').checked,
        forceSumData: document.getElementById('forceSumData').checked,
        autoFetchCPC: document.getElementById('autoFetchCPC').checked,
        autoRuntimeMonth: document.getElementById('autoRuntimeMonth').checked,
        autoNetCareTriplicate: document.getElementById('autoNetCareTriplicate') ? document.getElementById('autoNetCareTriplicate').checked : false
    };

    const baseName = window.UIVWorkbench.getCurrentTitle() || originalFileName;
    const isNetCare = url.toLowerCase().includes('netcare');
    let itemsToSave = [];

    if (isNetCare && configOptions.autoNetCareTriplicate) {
        let urlObj;
        try { urlObj = new URL(url); } catch (e) {}
        if (urlObj && urlObj.pathname) {
            const path = urlObj.pathname + urlObj.search;
            const regions = [
                { cat: 'NetCare中国', domain: 'https://netcare.huawei.com',    suffix: '-CN' },
                { cat: 'NetCare中东', domain: 'https://netcare-ae.gts.huawei.com', suffix: '-AE' },
                { cat: 'NetCare德国', domain: 'https://netcare-de.gts.huawei.com', suffix: '-DE' }
            ];
            regions.forEach(r => {
                const newUrl = r.domain + path;
                itemsToSave.push({
                    name: baseName + r.suffix,
                    code: codeUIV.split(url).join(newUrl),
                    consoleCode: codeConsole.split(url).join(newUrl),
                    category: r.cat, url: newUrl,
                    payload: rawJson, originalFileName, configOptions
                });
            });
        } else {
            itemsToSave.push({ name: baseName, code: codeUIV, consoleCode: codeConsole, category: window.UIVWorkbench.autoDetectCategory(url), url, payload: rawJson, originalFileName, configOptions });
        }
    } else {
        itemsToSave.push({ name: baseName, code: codeUIV, consoleCode: codeConsole, category: window.UIVWorkbench.autoDetectCategory(url), url, payload: rawJson, originalFileName, configOptions });
    }

    // 冲突检查
    const { scripts: existingScripts } = await API.get('/api/uiv/scripts');
    const conflicts = itemsToSave.filter(item => existingScripts.some(s => s.name === item.name));
    if (conflicts.length > 0) {
        const msg = conflicts.length > 1
            ? `发现 ${conflicts.length} 个同名脚本（含裂变分发区域），是否一键覆盖更新？`
            : `已存在名为 [${conflicts[0].name}] 的脚本，是否覆盖更新？`;
        if (!confirm(msg)) return;
    }

    try {
        await API.post('/api/uiv/scripts', { items: itemsToSave });
        await window.UIVSidebar.loadSavedScripts();
        showToast(itemsToSave.length > 1 ? `✅ ${itemsToSave.length} 个脚本已分发至三大区！` : '✅ 脚本已保存至仓库！');
        API.logHistory('uiv', '保存脚本', itemsToSave.map(i => i.name).join(', '));

        const btn = document.getElementById('saveBtn');
        const oldText = btn.innerText;
        btn.innerText = itemsToSave.length > 1 ? '✅ 阵列已分发' : '✅ 已保存';
        setTimeout(() => btn.innerText = oldText, 2000);
    } catch (e) {
        showToast('❌ 保存失败，请检查服务连接', 'error');
    }
}

window.UIVSave = { saveCurrentScript };
