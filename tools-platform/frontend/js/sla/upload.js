/**
 * sla/upload.js - 文件上传与解析引擎
 * 完整移植原版：XLSX 解析、智能分流（整改/常规/专项/其他）、版本标识注入
 */

const RECT_PRIORITY_COLS    = ['task_status', 'task_create_time', 'rectify_plan_end_time'];
const RISK_PRIORITY_COLS    = ['风险状态', 'risk_status', '创单时间', 'create_time', '期望关闭时间', 'ticket_close_due_date', '期望关闭时间-挂起'];
const SPECIAL_PRIORITY_COLS = ['状态-Status', 'task_status_en', 'task_status', 'task_status_cn', '创建日期-Create Date', 'create_time', '要求完成日期-Required Completion Date', 'required_completion_time', 'plan_complete_date'];

function generateSchemaHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash = hash & hash; }
    return Math.abs(hash).toString(36);
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
    const titleMap = { rectification: '🔧 整改监控', risk: '⚠️ 常规风险监控', special: '🛠️ 专项风险监控' };
    const colorMap = { rectification: '#1976d2', risk: '#7b1fa2', special: '#00796b' };
    await window.SLASection.initSection(forceMode, forceMode, titleMap[forceMode], rawData, colorMap[forceMode]);
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
        others: {}
    };

    files.forEach(file => {
        const name = file.name;
        if (name.startsWith('PBI_自动抓取-整改详单_整改_Latest')) { groups.rectification.files.push(file); }
        else if (name.startsWith('PBI_自动抓取-CPT风险详表_Latest')) { groups.special.files.push(file); }
        else if (name.startsWith('PBI_自动抓取-风险详单_Latest')) { groups.risk.files.push(file); }
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
    if (groups.risk.files.length)          groups.risk.data          = await readFiles(groups.risk.files);
    if (groups.special.files.length)       groups.special.data       = await readFiles(groups.special.files);
    for (const key in groups.others)       groups.others[key].data   = await readFiles(groups.others[key].files);

    document.getElementById('main-wrapper').innerHTML = '';
    let navHtml = `<h3 style="margin-top:0;color:#2e7d32;font-size:16px;">📊 批量导入成功 (共解析 ${files.length} 个文件)</h3><div class="nav-pills">`;

    const initPromises = [];
    for (const key of ['rectification', 'risk', 'special']) {
        const g = groups[key];
        if (g.data.length > 0) {
            navHtml += `<a href="javascript:void(0);" onclick="document.getElementById('section-${key}').scrollIntoView({behavior:'smooth'})" class="nav-pill" style="border-color:${g.color};color:${g.color}">${g.title} (${g.data.length}行)</a>`;
            initPromises.push(window.SLASection.initSection(key, g.mode, g.title, g.data, g.color));
        }
    }
    Object.values(groups.others).forEach(o => {
        if (o.data.length > 0) {
            navHtml += `<a href="javascript:void(0);" onclick="document.getElementById('section-${o.id}').scrollIntoView({behavior:'smooth'})" class="nav-pill">${o.title} (${o.data.length}行)</a>`;
            initPromises.push(window.SLASection.initSection(o.id, o.mode, o.title, o.data, o.color, o.baseName));
        }
    });

    navHtml += '</div>';
    document.getElementById('summary-nav-area').innerHTML = navHtml;
    document.getElementById('summary-nav-area').style.display = 'block';
    
    // 等待所有表格的预加载和DOM构建完成
    await Promise.all(initPromises);
    
    API.logHistory('sla', '批量导入', `${files.length} 个文件`);
    e.target.value = '';
    
    // 所有表格渲染完后，触发快照抓取 (稍微等一下让浏览器重绘)
    setTimeout(() => captureAndUploadSnapshot(files.map(f => f.name)), 300);
}

async function captureAndUploadSnapshot(fileNames) {
    const snapshot = {
        timestamp: new Date().toISOString(),
        files: fileNames,
        summary: [], 
        topMetrics: [],
        expiringTickets: []
    };

    // 提取在本月底+5天内需要处理的单子
    const now = new Date();
    const targetDate = new Date(now.getFullYear(), now.getMonth() + 1, 5, 23, 59, 59);
    const targetDays = Math.ceil((targetDate - now) / 86400000);
    const collectionsToPush = ['rectification', 'risk', 'special'];

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

    try {
        await API.post('/api/sla/snapshot', snapshot);
        showToast('✅ 预警结果已生成历史快照并存档');
    } catch (e) {
        console.error('Snapshot upload failed', e);
    }
}

window.SLAUpload = { handleBatchUpload, handleSpecificUpload, readFiles, generateSchemaHash, RECT_PRIORITY_COLS, RISK_PRIORITY_COLS, SPECIAL_PRIORITY_COLS };
