/**
 * sla/upload.js - 文件上传与解析引擎
 * 完整移植原版：XLSX 解析、智能分流（整改/常规/专项/其他）、版本标识注入
 */

const RECT_PRIORITY_COLS    = ['task_status', 'task_create_time', 'rectify_plan_end_time'];
const RISK_PRIORITY_COLS    = ['风险状态', 'risk_status', '创单时间', 'create_time', '期望关闭时间', 'ticket_close_due_date', '期望关闭时间-挂起'];
const SPECIAL_PRIORITY_COLS = ['状态-Status', 'task_status_en', 'task_status', 'task_status_cn', '创建日期-Create Date', 'create_time', '要求完成日期-Required Completion Date', 'required_completion_time', 'plan_complete_date'];
const SR_PRIORITY_COLS      = ['hw_sev_name', 'urgency', 'sr_status_name', 'open_date', 'exp_close_date', 'act_close_date', 'overdue', 'sr_num', 'sr_id', 'customer_name', 'country_name_cn', 'repoffice_name_cn'];
const VULN_PRIORITY_COLS    = ['task_status', 'create_time', 'task_create_time', 'vuln_id', 'vulnerability_id', '漏洞编号', '漏洞名称', 'vulnerability_name', 'customer_name', 'network_name'];
const SLA_WORKSPACE_CACHE_KEY = 'sla_last_import_workspace_v1';

function buildCachedSectionNav(sections, summaryTitle) {
    if (!sections || sections.length <= 1) return '';
    let navHtml = `<h3 style="margin-top:0;color:#2e7d32;font-size:16px;">${escapeHTML(summaryTitle || `📊 已恢复上次导入数据`)}</h3><div class="nav-pills">`;
    sections.forEach(section => {
        const count = Array.isArray(section.data) ? section.data.length : 0;
        navHtml += `<a href="javascript:void(0);" onclick="document.getElementById('section-${section.secId}').scrollIntoView({behavior:'smooth'})" class="nav-pill" style="border-color:${section.themeColor || '#555'};color:${section.themeColor || '#555'}">${escapeHTML(section.title)} (${count}行)</a>`;
    });
    navHtml += '</div>';
    return navHtml;
}

function persistWorkspaceCache(sections, meta = {}) {
    if (!Array.isArray(sections) || !sections.length) return;
    const payload = {
        version: 1,
        savedAt: new Date().toISOString(),
        meta,
        sections: sections.map(section => ({
            secId: section.secId,
            mode: section.mode,
            title: section.title,
            themeColor: section.themeColor,
            baseName: section.baseName || '',
            data: Array.isArray(section.data) ? section.data : []
        }))
    };
    try {
        localStorage.setItem(SLA_WORKSPACE_CACHE_KEY, JSON.stringify(payload));
        logSLAUploadStep('已缓存本次导入工作区', {
            sections: payload.sections.length,
            rows: payload.sections.reduce((sum, section) => sum + section.data.length, 0)
        });
    } catch (err) {
        logSLAUploadError('缓存导入工作区', err, { rows: payload.sections.reduce((sum, section) => sum + section.data.length, 0) });
        if (typeof showToast === 'function') showToast('⚠️ 本次表格较大，浏览器本地缓存空间不足，切换页面后可能需要重新导入', 'warning');
    }
}

function resetRuntimeWorkspace() {
    if (window.AppState) {
        Object.keys(window.AppState).forEach(key => { delete window.AppState[key]; });
    }
    window.GlobalMetrics = {};
}

async function restoreCachedWorkspace() {
    if (window.AppState && Object.keys(window.AppState).length > 0) return false;
    let payload = null;
    try {
        payload = JSON.parse(localStorage.getItem(SLA_WORKSPACE_CACHE_KEY) || 'null');
    } catch (err) {
        localStorage.removeItem(SLA_WORKSPACE_CACHE_KEY);
        return false;
    }
    const sections = payload && Array.isArray(payload.sections) ? payload.sections.filter(s => s && s.secId && Array.isArray(s.data) && s.data.length) : [];
    if (!sections.length || !window.SLASection || typeof window.SLASection.initSection !== 'function') return false;

    const mainWrapper = document.getElementById('main-wrapper');
    const summaryNav = document.getElementById('summary-nav-area');
    if (mainWrapper) mainWrapper.innerHTML = '<div class="loading-text">⏳ 正在恢复上次导入的数据...</div>';
    if (summaryNav) summaryNav.style.display = 'none';

    try {
        if (mainWrapper) mainWrapper.innerHTML = '';
        const initPromises = sections.map(section =>
            window.SLASection.initSection(section.secId, section.mode, section.title, section.data, section.themeColor || '#555', section.baseName || '')
        );
        if (summaryNav) {
            const navHtml = buildCachedSectionNav(sections, payload.meta && payload.meta.summaryTitle);
            summaryNav.innerHTML = navHtml;
            summaryNav.style.display = navHtml ? 'block' : 'none';
        }
        await Promise.all(initPromises);
        logSLAUploadStep('已恢复上次导入工作区', {
            savedAt: payload.savedAt,
            sections: sections.length,
            rows: sections.reduce((sum, section) => sum + section.data.length, 0)
        });
        if (typeof showToast === 'function') showToast('✅ 已恢复上次导入的数据');
        return true;
    } catch (err) {
        logSLAUploadError('恢复上次导入工作区', err);
        if (mainWrapper) {
            mainWrapper.innerHTML = '<div style="text-align:center;color:#999;padding:50px 0;border:2px dashed #ddd;border-radius:10px;">上次导入数据恢复失败，请重新导入文件。</div>';
        }
        return false;
    }
}

function generateSchemaHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash = hash & hash; }
    return Math.abs(hash).toString(36);
}

function getJSONBytes(value) {
    try {
        return new Blob([JSON.stringify(value)]).size;
    } catch (e) {
        return 0;
    }
}

function isSLACompressionSupported() {
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

async function buildCompressedSnapshotBody(snapshot, algorithm = 'gzip') {
    const snapshotText = JSON.stringify(snapshot);
    const compressedSnapshot = await compressTextToTransportField(snapshotText, algorithm);
    return {
        transport: {
            compression: `${algorithm}+base64`,
            payload: 'snapshot',
            originalBytes: compressedSnapshot.originalBytes,
            compressedBytes: compressedSnapshot.compressedBytes
        },
        compressedSnapshot
    };
}

function logSLAUploadStep(step, detail) {
    const prefix = '%c[SLA Upload]';
    const style = 'color:#0ea5e9;font-weight:700;';
    if (detail === undefined) {
        console.info(prefix, style, step);
        return;
    }
    console.info(prefix, style, step, detail);
}

function logSLAUploadError(step, error, detail) {
    const prefix = '%c[SLA Upload]';
    const style = 'color:#ef4444;font-weight:700;';
    console.error(prefix, style, `${step} failed`, detail || '', error);
}

async function readFiles(files) {
    const promises = files.map(file => new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false });
                let suffix = '';
                const latestIdx = file.name.lastIndexOf('Latest');
                if (latestIdx !== -1) {
                    suffix = file.name.substring(latestIdx + 6).replace(/\.[^/.]+$/, '').trim();
                } else {
                    suffix = file.name.replace(/\.[^/.]+$/, '').trim();
                }
                jsonData.forEach(row => { row['版本标识'] = suffix ? suffix : '主版本(Base)'; });
                resolve(jsonData);
            } catch (err) { resolve([]); }
        };
        reader.readAsArrayBuffer(file);
    }));
    const results = await Promise.all(promises);
    return results.reduce((a, b) => a.concat(b), []);
}

async function handleSpecificUpload(e, forceMode) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    document.getElementById('main-wrapper').innerHTML = '<div class="loading-text">⏳ 正在解析表格数据，请稍候...</div>';
    document.getElementById('summary-nav-area').style.display = 'none';
    const rawData = await readFiles(files);
    if (!rawData.length) { alert('读取失败或为空表！'); document.getElementById('main-wrapper').innerHTML = ''; return; }
    document.getElementById('main-wrapper').innerHTML = '';
    resetRuntimeWorkspace();
    const titleMap = { rectification: '🔧 整改监控', risk: '⚠️ 常规风险监控', special: '🛠️ 专项风险监控', sr: '📞 SR详单分析', vulnerability: '🧯 漏洞预警分析' };
    const colorMap = { rectification: '#1976d2', risk: '#7b1fa2', special: '#00796b', sr: '#d9480f', vulnerability: '#c2410c' };
    await window.SLASection.initSection(forceMode, forceMode, titleMap[forceMode], rawData, colorMap[forceMode]);
    persistWorkspaceCache([{
        secId: forceMode,
        mode: forceMode,
        title: titleMap[forceMode],
        data: rawData,
        themeColor: colorMap[forceMode],
        baseName: ''
    }], { type: 'specific', summaryTitle: `📊 已缓存 ${titleMap[forceMode]}`, files: files.map(f => f.name) });
    API.logHistory('sla', `导入${titleMap[forceMode]}`, `${files.length} 个文件`);
    e.target.value = '';

    // 触发快照抓取
    setTimeout(() => captureAndUploadSnapshot(files.map(f => f.name)), 300);
}

async function handleBatchUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    document.getElementById('main-wrapper').innerHTML = '<div class="loading-text">⏳ 正在启动智能分拣引擎分析全部文件...</div>';

    const groups = {
        rectification: { files: [], data: [], title: '🔧 整改详单合集', mode: 'rectification', color: '#1976d2' },
        risk:          { files: [], data: [], title: '⚠️ 常规风险合集', mode: 'risk', color: '#7b1fa2' },
        special:       { files: [], data: [], title: '🛠️ CPT专项风险合集', mode: 'special', color: '#00796b' },
        sr:            { files: [], data: [], title: '📞 SR详单分析', mode: 'sr', color: '#d9480f' },
        vulnerability: { files: [], data: [], title: '🧯 漏洞预警详单', mode: 'vulnerability', color: '#c2410c' },
        others: {}
    };

    files.forEach(file => {
        const name = file.name;
        if (name.startsWith('PBI_自动抓取-整改详单_整改_Latest')) { groups.rectification.files.push(file); }
        else if (name.startsWith('PBI_自动抓取-CPT风险详表_Latest')) { groups.special.files.push(file); }
        else if (name.startsWith('PBI_自动抓取-风险详单_Latest')) { groups.risk.files.push(file); }
        else if (name.startsWith('PBI_自动抓取-详单-SR_Latest')) { groups.sr.files.push(file); }
        else if (name.startsWith('PBI_自动抓取-详单漏洞_漏洞预警_Latest')) { groups.vulnerability.files.push(file); }
        else {
            let baseName = name;
            const match = name.match(/(.*?Latest)/i);
            if (match) { baseName = match[1]; }
            else { baseName = name.replace(/\.[a-zA-Z0-9]+$/, '').replace(/\s*\(\d+\)$/, ''); }
            if (!groups.others[baseName]) {
                groups.others[baseName] = {
                    id: 'other_' + generateSchemaHash(baseName),
                    files: [], data: [], title: `📁 独立表: ${baseName}`,
                    mode: 'other', color: '#555', baseName
                };
            }
            groups.others[baseName].files.push(file);
        }
    });

    if (groups.rectification.files.length) groups.rectification.data = await readFiles(groups.rectification.files);
    if (groups.special.files.length)       groups.special.data       = await readFiles(groups.special.files);
    if (groups.risk.files.length)          groups.risk.data          = await readFiles(groups.risk.files);
    if (groups.sr.files.length)            groups.sr.data            = await readFiles(groups.sr.files);
    if (groups.vulnerability.files.length) groups.vulnerability.data = await readFiles(groups.vulnerability.files);
    for (const key in groups.others)       groups.others[key].data   = await readFiles(groups.others[key].files);

    document.getElementById('main-wrapper').innerHTML = '';
    resetRuntimeWorkspace();
    let navHtml = `<h3 style="margin-top:0;color:#2e7d32;font-size:16px;">📊 批量导入成功 (共解析 ${files.length} 个文件)</h3><div class="nav-pills">`;

    const initPromises = [];
    const cacheSections = [];
    for (const key of ['rectification', 'special', 'risk', 'sr', 'vulnerability']) {
        const g = groups[key];
        if (g.data.length > 0) {
            navHtml += `<a href="javascript:void(0);" onclick="document.getElementById('section-${key}').scrollIntoView({behavior:'smooth'})" class="nav-pill" style="border-color:${g.color};color:${g.color}">${g.title} (${g.data.length}行)</a>`;
            initPromises.push(window.SLASection.initSection(key, g.mode, g.title, g.data, g.color));
            cacheSections.push({ secId: key, mode: g.mode, title: g.title, data: g.data, themeColor: g.color, baseName: '' });
        }
    }
    Object.values(groups.others).forEach(o => {
        if (o.data.length > 0) {
            navHtml += `<a href="javascript:void(0);" onclick="document.getElementById('section-${o.id}').scrollIntoView({behavior:'smooth'})" class="nav-pill">${o.title} (${o.data.length}行)</a>`;
            initPromises.push(window.SLASection.initSection(o.id, o.mode, o.title, o.data, o.color, o.baseName));
            cacheSections.push({ secId: o.id, mode: o.mode, title: o.title, data: o.data, themeColor: o.color, baseName: o.baseName });
        }
    });

    navHtml += '</div>';
    document.getElementById('summary-nav-area').innerHTML = navHtml;
    document.getElementById('summary-nav-area').style.display = 'block';
    
    // 等待所有表格的预加载和DOM构建完成
    await Promise.all(initPromises);
    persistWorkspaceCache(cacheSections, { type: 'batch', summaryTitle: `📊 批量导入成功 (共解析 ${files.length} 个文件)`, files: files.map(f => f.name) });
    
    API.logHistory('sla', '批量导入', `${files.length} 个文件`);
    e.target.value = '';
    
    // 所有表格渲染完后，触发快照抓取 (稍微等一下让浏览器重绘)
    setTimeout(() => captureAndUploadSnapshot(files.map(f => f.name)), 300);
}

async function captureAndUploadSnapshot(fileNames) {
    const snapshot = {
        timestamp: new Date().toISOString(),
        files: fileNames,
        selectedTargetMonth: window.SLATargetMonth && window.SLATargetMonth.get ? window.SLATargetMonth.get() : (new Date().getMonth() + 1),
        summary: [], 
        topMetrics: [],
        expiringTickets: []
    };

    // 提取在本月底+5天内需要处理的单子
    const now = new Date();
    const targetDate = new Date(now.getFullYear(), now.getMonth() + 1, 5, 23, 59, 59);
    const targetDays = Math.ceil((targetDate - now) / 86400000);
    const collectionsToPush = ['rectification', 'risk', 'special', 'sr', 'vulnerability'];

    collectionsToPush.forEach(secId => {
        if (window.AppState && window.AppState[secId]) {
            const data = window.AppState[secId].globalData || [];
            console.log(`Checking collection: ${secId}, total rows: ${data.length}`);
            data.forEach(row => {
                if (row._slaDays !== undefined && row._slaDays !== 999999 && row._slaDays !== -999999) {
                    if (row._slaDays <= targetDays) {
                        snapshot.expiringTickets.push({
                            collection: secId,
                            title: window.AppState[secId].title,
                            _slaCleanText: row._slaCleanText,
                            _slaDays: row._slaDays,
                            data: row
                        });
                    }
                }
            });
            console.log(`Found ${snapshot.expiringTickets.length} expiring tickets so far.`);
        }
    });
    const collectionOrder = ['rectification', 'special', 'risk', 'sr', 'vulnerability'];
    snapshot.expiringTickets.sort((a, b) => {
        const rankA = collectionOrder.indexOf(String(a && a.collection || ''));
        const rankB = collectionOrder.indexOf(String(b && b.collection || ''));
        const safeRankA = rankA === -1 ? 999 : rankA;
        const safeRankB = rankB === -1 ? 999 : rankB;
        if (safeRankA !== safeRankB) return safeRankA - safeRankB;
        const collectionDiff = String(a && a.collection || '').localeCompare(String(b && b.collection || ''), 'zh-CN');
        if (collectionDiff !== 0) return collectionDiff;
        const daysA = Number(a && a._slaDays);
        const daysB = Number(b && b._slaDays);
        const safeA = Number.isFinite(daysA) ? daysA : 999999;
        const safeB = Number.isFinite(daysB) ? daysB : 999999;
        if (safeA !== safeB) return safeA - safeB;
        return String(a && a.title || '').localeCompare(String(b && b.title || ''), 'zh-CN');
    });

    // 提取各个基础表格面板的数据
    document.querySelectorAll('.dashboard-panel').forEach(panel => {
        if (panel.style.display === 'none') return;
        const header = panel.previousElementSibling;
        const secTitle = header ? header.querySelector('.section-title').innerText.replace(/\s*\(展示.*\)/, '').trim() : '未知区块';
        const metrics = [];
        panel.querySelectorAll('.metric-card, .metric-total-wrapper').forEach(card => {
            const title = card.querySelector('.metric-title')?.innerText || '';
            const value = card.querySelector('.metric-value')?.innerText || '';
            let status = '';
            if (value.includes('✅') || value.includes('⚠️')) {
                // 如果有附加状态(如"达标/落后")
                const b = card.querySelector('b') || card.querySelector('div:nth-child(2)');
                if (b) status = b.innerText.trim();
            }
            if (title && value) metrics.push({ title: title.replace('🌟 ', ''), value: value.replace(/\n/g, ' ').trim(), status });
        });
        if (metrics.length) {
            snapshot.summary.push({ section: secTitle, metrics });
        }
    });

    // 提取顶部自定义数据舱（从DOM提取，以获取当月的 gap 和 warn 状态）
    const stickyBar = document.getElementById('sticky-bar-content');
    if (stickyBar) {
        stickyBar.querySelectorAll('.info-item').forEach(item => {
            const labelEl = item.querySelector('.info-label');
            const valueEl = item.querySelector('.info-value');
            const gapEl = item.querySelector('.metric-gap');
            if (labelEl && valueEl) {
                const label = labelEl.innerText.replace(':', '').trim();
                const value = valueEl.innerText.trim();
                const gap = gapEl ? gapEl.innerText.trim() : '';
                const isWarn = item.classList.contains('metric-warn-highlight') || valueEl.classList.contains('danger');
                
                // 提取原来的颜色
                let color = '#4fc3f7';
                if (valueEl.classList.contains('success')) color = '#81c784';
                if (valueEl.classList.contains('warn')) color = '#ffb74d';
                if (valueEl.classList.contains('danger')) color = '#ef5350';
                
                // 提取 sub-metrics
                const subMetrics = [];
                const subList = item.querySelector('.sub-metrics-list');
                if (subList) {
                    subList.querySelectorAll('span').forEach(subSpan => {
                        const txt = subSpan.innerText.trim();
                        const parts = txt.split(':');
                        if (parts.length >= 2) {
                            subMetrics.push({ category: parts[0].trim(), value: parts[1].trim() });
                        }
                    });
                }
                
                snapshot.topMetrics.push({ label, value, gap, isWarn, color, subMetrics });
            }
        });
    }

    const snapshotStats = {
        requestBytes: getJSONBytes(snapshot),
        files: snapshot.files.length,
        summaryCount: snapshot.summary.length,
        topMetricCount: snapshot.topMetrics.length,
        expiringTicketCount: snapshot.expiringTickets.length
    };

    try {
        logSLAUploadStep('开始上传历史快照', snapshotStats);
        await API.post('/api/sla/snapshot', snapshot);
        logSLAUploadStep('历史快照上传成功', snapshotStats);
        showToast('✅ 预警结果已生成历史快照并存档');
    } catch (e) {
        logSLAUploadError('普通历史快照上传链路', e, snapshotStats);
        console.error('Snapshot upload failed', e);

        if (!isSLACompressionSupported()) {
            showToast('❌ 历史快照上传失败，当前浏览器不支持压缩重试', 'error');
            return;
        }

        try {
            logSLAUploadStep('普通快照上传失败，开始构建 gzip 压缩重试请求');
            const compressedBody = await buildCompressedSnapshotBody(snapshot, 'gzip');
            const compressedStats = {
                requestBytes: getJSONBytes(compressedBody),
                originalBytes: compressedBody.transport.originalBytes,
                compressedBytes: compressedBody.transport.compressedBytes,
                files: snapshot.files.length,
                expiringTicketCount: snapshot.expiringTickets.length
            };
            logSLAUploadStep('gzip 压缩快照请求已构建', compressedStats);

            await API.post('/api/sla/snapshot', compressedBody);
            logSLAUploadStep('gzip 压缩快照重试成功', compressedStats);
            showToast('✅ 预警结果已通过压缩重试生成历史快照并存档');
        } catch (retryError) {
            logSLAUploadError('gzip 压缩快照重试链路', retryError, {
                files: snapshot.files.length,
                expiringTicketCount: snapshot.expiringTickets.length
            });
            showToast('❌ 历史快照上传失败，压缩重试也未成功', 'error');
        }
    }
}

window.SLAUpload = { handleBatchUpload, handleSpecificUpload, readFiles, generateSchemaHash, restoreCachedWorkspace, RECT_PRIORITY_COLS, RISK_PRIORITY_COLS, SPECIAL_PRIORITY_COLS, SR_PRIORITY_COLS, VULN_PRIORITY_COLS };
