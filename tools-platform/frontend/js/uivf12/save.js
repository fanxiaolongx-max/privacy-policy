/**
 * uivf12/save.js - 脚本保存模块
 * 负责：当前工作台生成结果保存到服务端脚本仓库（支持 NetCare 三区阵列）
 */

function getScriptPayloadBytes(item) {
    try {
        return new Blob([JSON.stringify(item)]).size;
    } catch (e) {
        return 0;
    }
}

function isCompressionSupported() {
    return typeof CompressionStream !== 'undefined' && typeof TextEncoder !== 'undefined';
}

function bytesToBase64(bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

async function compressTextToTransportField(text, algorithm = 'gzip') {
    const normalizedText = typeof text === 'string' ? text : '';
    const inputBytes = new TextEncoder().encode(normalizedText);
    const stream = new Blob([inputBytes]).stream().pipeThrough(new CompressionStream(algorithm));
    const compressedBuffer = await new Response(stream).arrayBuffer();
    const compressedBytes = new Uint8Array(compressedBuffer);
    return {
        encoding: `${algorithm}+base64`,
        originalBytes: inputBytes.byteLength,
        compressedBytes: compressedBytes.byteLength,
        data: bytesToBase64(compressedBytes)
    };
}

async function buildCompressedSaveBody(items, algorithm = 'gzip') {
    const compressedItems = [];

    for (const item of items) {
        const compressedFields = {
            code: await compressTextToTransportField(item.code || '', algorithm),
            consoleCode: await compressTextToTransportField(item.consoleCode || '', algorithm),
            payload: await compressTextToTransportField(item.payload || '', algorithm)
        };

        compressedItems.push({
            ...item,
            code: undefined,
            consoleCode: undefined,
            payload: undefined,
            compressedFields
        });
    }

    const sanitizedItems = compressedItems.map(item => {
        const next = { ...item };
        delete next.code;
        delete next.consoleCode;
        delete next.payload;
        return next;
    });

    return {
        transport: {
            compression: `${algorithm}+base64`,
            itemCount: sanitizedItems.length
        },
        items: sanitizedItems
    };
}

function summarizeCompressedItems(body) {
    const items = Array.isArray(body && body.items) ? body.items : [];
    return items.map(item => ({
        name: item.name,
        category: item.category,
        codeBytes: item.compressedFields && item.compressedFields.code ? `${item.compressedFields.code.originalBytes} -> ${item.compressedFields.code.compressedBytes}` : '-',
        consoleBytes: item.compressedFields && item.compressedFields.consoleCode ? `${item.compressedFields.consoleCode.originalBytes} -> ${item.compressedFields.consoleCode.compressedBytes}` : '-',
        payloadBytes: item.compressedFields && item.compressedFields.payload ? `${item.compressedFields.payload.originalBytes} -> ${item.compressedFields.payload.compressedBytes}` : '-'
    }));
}

function logSaveStep(step, detail) {
    const prefix = '%c[UIVF12 Save]';
    const style = 'color:#22c55e;font-weight:700;';
    if (detail === undefined) {
        console.info(prefix, style, step);
        return;
    }
    console.info(prefix, style, step, detail);
}

function logSaveError(step, error, detail) {
    const prefix = '%c[UIVF12 Save]';
    const style = 'color:#ef4444;font-weight:700;';
    console.error(prefix, style, `${step} failed`, detail || '', error);
}

async function saveCurrentScript() {
    const codeUIV = document.getElementById('codeOutput').value;
    const codeConsole = document.getElementById('consoleOutput').value;
    const url = document.getElementById('requestUrl').value.trim();
    if (!codeUIV || !codeConsole) { alert('⚠️ 请先生成脚本后再保存！'); return; }

    logSaveStep('开始保存脚本到侧边栏', {
        url,
        codeUIVBytes: new Blob([codeUIV]).size,
        codeConsoleBytes: new Blob([codeConsole]).size
    });

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

    logSaveStep('已生成待保存脚本对象', {
        count: itemsToSave.length,
        items: itemsToSave.map(item => ({
            name: item.name,
            category: item.category,
            url: item.url,
            bytes: getScriptPayloadBytes(item)
        }))
    });

    // 冲突检查
    let existingScripts = [];
    try {
        logSaveStep('开始执行重名冲突检查');
        const resp = await API.get('/api/uiv/scripts');
        existingScripts = resp.scripts || [];
        logSaveStep('重名冲突检查所需仓库已加载', {
            existingScriptCount: existingScripts.length
        });
    } catch (error) {
        logSaveError('加载现有脚本仓库', error);
        throw error;
    }

    const conflicts = itemsToSave.filter(item => existingScripts.some(s => s.name === item.name));
    logSaveStep('冲突检查结果', {
        conflictCount: conflicts.length,
        conflictNames: conflicts.map(item => item.name)
    });

    if (conflicts.length > 0) {
        const msg = conflicts.length > 1
            ? `发现 ${conflicts.length} 个同名脚本（含裂变分发区域），是否一键覆盖更新？`
            : `已存在名为 [${conflicts[0].name}] 的脚本，是否覆盖更新？`;
        if (!confirm(msg)) return;
    }

    try {
        logSaveStep('开始提交保存请求', {
            requestBytes: new Blob([JSON.stringify({ items: itemsToSave })]).size
        });
        const saveResult = await API.post('/api/uiv/scripts', { items: itemsToSave });
        logSaveStep('保存请求完成', saveResult);

        logSaveStep('开始刷新侧边栏脚本仓库');
        await window.UIVSidebar.loadSavedScripts({ reason: 'saveCurrentScript', savedItems: itemsToSave.map(i => i.name) });
        logSaveStep('侧边栏刷新完成', {
            savedNames: itemsToSave.map(i => i.name)
        });

        showToast(itemsToSave.length > 1 ? `✅ ${itemsToSave.length} 个脚本已分发至三大区！` : '✅ 脚本已保存至仓库！');
        API.logHistory('uiv', '保存脚本', itemsToSave.map(i => i.name).join(', '));
        logSaveStep('历史记录已异步触发', {
            names: itemsToSave.map(i => i.name)
        });

        const btn = document.getElementById('saveBtn');
        const oldText = btn.innerText;
        btn.innerText = itemsToSave.length > 1 ? '✅ 阵列已分发' : '✅ 已保存';
        setTimeout(() => btn.innerText = oldText, 2000);
    } catch (e) {
        logSaveError('普通保存链路', e, {
            names: itemsToSave.map(i => i.name)
        });

        if (!isCompressionSupported()) {
            showToast('❌ 保存失败，且当前浏览器不支持压缩重试', 'error');
            return;
        }

        try {
            logSaveStep('普通保存失败，开始构建 gzip 压缩重试请求');
            const compressedBody = await buildCompressedSaveBody(itemsToSave, 'gzip');
            logSaveStep('gzip 压缩请求已构建', {
                requestBytes: new Blob([JSON.stringify(compressedBody)]).size,
                items: summarizeCompressedItems(compressedBody)
            });

            const retryResult = await API.post('/api/uiv/scripts', compressedBody);
            logSaveStep('gzip 压缩重试成功', retryResult);

            logSaveStep('开始刷新侧边栏脚本仓库', {
                reason: 'saveCurrentScript-compressed-retry'
            });
            await window.UIVSidebar.loadSavedScripts({ reason: 'saveCurrentScript-compressed-retry', savedItems: itemsToSave.map(i => i.name) });
            logSaveStep('压缩重试后的侧边栏刷新完成', {
                savedNames: itemsToSave.map(i => i.name)
            });

            showToast(itemsToSave.length > 1 ? `✅ ${itemsToSave.length} 个脚本已通过压缩重试保存！` : '✅ 脚本已通过压缩重试保存！');
            API.logHistory('uiv', '保存脚本(压缩重试)', itemsToSave.map(i => i.name).join(', '));
        } catch (retryError) {
            logSaveError('gzip 压缩重试链路', retryError, {
                names: itemsToSave.map(i => i.name)
            });
            showToast('❌ 保存失败，压缩重试也未成功', 'error');
        }
    }
}

window.UIVSave = { saveCurrentScript };
