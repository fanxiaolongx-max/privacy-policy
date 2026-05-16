let snapshots = [];
let categories = [];
let globalConfig = { targets: {}, prefs: {} };
let labelToTargetMap = {};
let labelToTargetKeyMap = {};
let currentSnapshot = null;
let standardTotalScore = 0;

function escapeHTML(str) {
    return typeof str === 'string' ? str.replace(/[&<>'"]/g, tag => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'": '&#39;','"':'&quot;'}[tag]||tag)) : str;
}

async function initReport() {
    try {
        const [snapData, catData, configData] = await Promise.all([
            API.get('/api/sla/snapshots'),
            API.get('/api/sla/categories'),
            API.get('/api/sla/config')
        ]);
        
        snapshots = snapData || [];
        categories = catData || ['TE', 'ORG', 'ET', 'VDF'];
        globalConfig = configData || { targets: {}, prefs: {} };
        
        buildLabelTargetMap();
        
        // Populate month selector
        const monthSel = document.getElementById('target-month-select');
        let monthOptions = '';
        for (let i = 1; i <= 12; i++) {
            monthOptions += `<option value="${i}">${i}月份</option>`;
        }
        monthSel.innerHTML = monthOptions;
        
        const sel = document.getElementById('snapshot-select');
        if (!snapshots.length) {
            sel.innerHTML = '<option value="">暂无快照数据</option>';
            document.getElementById('report-content').innerHTML = '<div class="empty-state"><h3>暂无导入记录</h3><p>请先前往 SLA 监控台导入数据并生成预警快照。</p></div>';
            return;
        }
        
        sel.innerHTML = snapshots.map(s => {
            const d = new Date(s.timestamp);
            const tsStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
            const fileCount = s.files ? (Array.isArray(s.files) ? s.files.length : 1) : 0;
            return `<option value="${s.id}">${tsStr} (包含 ${fileCount} 个表格源)</option>`;
        }).join('');
        
        // Default to the first (latest) snapshot
        sel.value = snapshots[0].id;
        loadSelectedSnapshot();
    } catch (e) {
        showToast('加载报表数据失败', 'error');
        console.error(e);
        document.getElementById('report-content').innerHTML = '<div class="empty-state"><h3>加载失败</h3><p>请检查后端服务是否正常运行。</p></div>';
    }
}

function buildLabelTargetMap() {
    const { targets, prefs } = globalConfig;
    labelToTargetMap = {};
    labelToTargetKeyMap = {};
    
    if (prefs) {
        Object.keys(prefs).forEach(secId => {
            const pref = prefs[secId];
            const cleanSecId = secId.startsWith('sla_prefs_') ? secId.substring(10) : secId;
            
            if (pref.customMetrics) {
                pref.customMetrics.forEach(rule => {
                    const key = `${cleanSecId}_${rule.id}`;
                    if (targets && targets[key]) {
                        labelToTargetMap[rule.label] = targets[key];
                        labelToTargetKeyMap[rule.label] = key;
                    }
                });
            }
        });
    }
    
    // Map manual targets
    if (targets) {
        Object.keys(targets).forEach(k => {
            if (k.startsWith('manual_') && targets[k].label) {
                labelToTargetMap[targets[k].label] = targets[k];
                labelToTargetKeyMap[targets[k].label] = k;
            }
        });
    }
}

window.loadSelectedSnapshot = function() {
    const id = document.getElementById('snapshot-select').value;
    currentSnapshot = snapshots.find(s => s.id === id);
    if (currentSnapshot) {
        // Auto-select the month based on snapshot timestamp
        const snapMonth = new Date(currentSnapshot.timestamp).getMonth() + 1;
        document.getElementById('target-month-select').value = snapMonth;
        renderReport(currentSnapshot);
    }
};

window.renderCurrentSnapshot = function() {
    if (currentSnapshot) {
        renderReport(currentSnapshot);
    }
};

function parseNum(str) {
    if (str === undefined || str === null || str === '--') return NaN;
    const n = parseFloat(String(str).replace(/[^0-9.-]/g, ''));
    return isNaN(n) ? NaN : n;
}

function renderReport(snap) {
    const content = document.getElementById('report-content');
    const { topMetrics } = snap;
    const targetMonth = document.getElementById('target-month-select').value;
    
    let metricCols = [...(topMetrics || [])];
    
    // Auto inject manual metrics that are missing in current snapshot
    if (globalConfig.targets) {
        Object.keys(globalConfig.targets).forEach(k => {
            if (k.startsWith('manual_') && globalConfig.targets[k].label) {
                const label = globalConfig.targets[k].label;
                const exists = metricCols.find(m => m.label === label);
                if (!exists) {
                    metricCols.push({
                        id: `manual_m_${Date.now()}_${Math.random()}`,
                        colX: "手动指标",
                        valY: "总计",
                        colZ: "手动指标",
                        label: label,
                        value: '--',
                        subMetrics: [],
                        isManual: true
                    });
                } else {
                    exists.isManual = true;
                }
            }
        });
    }
    
    if (metricCols.length === 0) {
        content.innerHTML = '<div class="empty-state"><h3>该快照无维度数据</h3><p>请在此快照生成前，配置相关的统计指标。</p></div>';
        return;
    }

    // Prepare data structures
    const catData = {};
    categories.forEach(cat => {
        catData[cat] = {
            name: cat,
            earnedScore: 0,
            validWeightSum: 0,
            manualScore: 0,
            values: {} // key: metric label
        };
    });

    standardTotalScore = 0;

    // Populate values and calculate dynamic weighted score
    metricCols.forEach(m => {
        const targetData = labelToTargetMap[m.label];
        const weight = (targetData && targetData.weight !== undefined) ? parseFloat(targetData.weight) : 1;
        standardTotalScore += weight;
        
        const subs = m.subMetrics || [];
        subs.forEach(sm => {
            if (!catData[sm.category]) {
                // Auto register unknown category
                catData[sm.category] = { name: sm.category, earnedScore: 0, validWeightSum: 0, manualScore: 0, values: {} };
                if (!categories.includes(sm.category)) categories.push(sm.category);
            }
            const valNum = parseNum(sm.value);
            
            let isFailing = false;
            let gapStr = '';
            
            if (!isNaN(valNum)) {
                catData[sm.category].validWeightSum += weight;
                
                if (targetData && targetData[targetMonth] !== undefined && targetData[targetMonth] !== '') {
                    const targetNum = parseFloat(targetData[targetMonth]);
                    const condition = targetData.type || 'gte';
                    const isPercent = String(sm.value).includes('%');
                    
                    if (condition === 'gte' && valNum < targetNum) {
                        isFailing = true;
                        gapStr = +(targetNum - valNum).toFixed(2) + (isPercent ? '%' : '');
                    } else if (condition === 'lte' && valNum > targetNum) {
                        isFailing = true;
                        gapStr = +(valNum - targetNum).toFixed(2) + (isPercent ? '%' : '');
                    }
                }
                
                if (!isFailing) {
                    catData[sm.category].earnedScore += weight;
                }
            }
            
            catData[sm.category].values[m.label] = { raw: sm.value, num: valNum, isFailing: isFailing, gapStr: gapStr };
        });
    });

    // Generate Matrix Table
    let matrixHtml = `
        <div class="card">
            <h3 class="card-title"><span>🧩 客户群短板透视矩阵</span></h3>
            <div class="matrix-container">
            <table class="matrix-table">
                <thead>
                    <tr>
                        <th style="min-width:180px; text-align:left;">考核的指标名称</th>
                        <th style="min-width:60px;">权重</th>
                        <th style="min-width:100px;">${targetMonth}月目标值</th>
                        <th style="min-width:100px; background:#fff8e1; border-right:2px solid #ffe082; color:#ef6c00;">全局总体达标</th>
                        ${categories.map(cat => `<th>${escapeHTML(cat)}</th>`).join('')}
                        ${categories.map(cat => `<th style="background:#e8f5e9;">${escapeHTML(cat)}得分</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;
    
    metricCols.forEach(m => {
        let targetStr = '--';
        let isGlobalFailing = false;
        let globalGapStr = '';
        
        const targetData = labelToTargetMap[m.label];
        const weight = (targetData && targetData.weight !== undefined) ? parseFloat(targetData.weight) : 1;
        
        if (targetData && targetData[targetMonth] !== undefined && targetData[targetMonth] !== '') {
            const condition = targetData.type || 'gte';
            targetStr = (condition === 'gte' ? '≥ ' : '≤ ') + targetData[targetMonth];
            const isPercent = m.value && String(m.value).includes('%');
            if (isPercent) {
                targetStr += '%';
            }
            
            // Evaluate global value
            const globalValNum = parseNum(m.value);
            if (!isNaN(globalValNum)) {
                const targetNum = parseFloat(targetData[targetMonth]);
                if (condition === 'gte' && globalValNum < targetNum) {
                    isGlobalFailing = true;
                    globalGapStr = +(targetNum - globalValNum).toFixed(2) + (isPercent ? '%' : '');
                } else if (condition === 'lte' && globalValNum > targetNum) {
                    isGlobalFailing = true;
                    globalGapStr = +(globalValNum - targetNum).toFixed(2) + (isPercent ? '%' : '');
                }
            }
        }
        
        const globalDisplayClass = isGlobalFailing ? 'val-warn' : 'val-good';
        const globalTitleAttr = isGlobalFailing ? ` title="整体不达标，距离目标差 ${globalGapStr}"` : '';
        
        const editBtn = m.isManual ? `<span style="cursor:pointer; margin-left:6px; font-size:12px; color:#2e7d32; background:#e8f5e9; padding:2px 6px; border-radius:4px; border:1px solid #c8e6c9;" onclick="editManualMetric('${escapeHTML(m.label)}')">✏️ 填报</span>` : '';

        matrixHtml += `<tr>
            <td style="text-align:left; font-weight:600; color:#2c3e50;">
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <div style="display:flex; align-items:center;">
                        <span>${escapeHTML(m.label)}</span>
                        ${editBtn}
                    </div>
                </div>
            </td>
            <td style="color:#666; font-weight:bold; background:#fafafa;">${weight}</td>
            <td style="color:#0277bd; font-weight:bold; background:#f5f8fa;">${targetStr}</td>
            <td style="background:#fff8e1; border-right:2px solid #ffe082;"><span class="${globalDisplayClass}"${globalTitleAttr}>${escapeHTML(String(m.value || '--'))}</span></td>`;
            
        categories.forEach(cat => {
            const cell = catData[cat].values[m.label];
            if (!cell || cell.raw === '--') {
                matrixHtml += `<td class="val-none">--</td>`;
            } else {
                const displayClass = cell.isFailing ? 'val-warn' : 'val-good';
                const titleAttr = cell.isFailing ? ` title="不达标，距离目标差 ${cell.gapStr}"` : ` title="达标"`;
                matrixHtml += `<td><span class="${displayClass}"${titleAttr}>${escapeHTML(cell.raw)}</span></td>`;
            }
        });
        
        categories.forEach(cat => {
            const cell = catData[cat].values[m.label];
            if (!cell || cell.raw === '--') {
                matrixHtml += `<td class="val-none" style="background:#f1f8e9;">--</td>`;
            } else {
                const earned = cell.isFailing ? 0 : weight;
                const scoreColor = cell.isFailing ? '#d32f2f' : '#2e7d32';
                matrixHtml += `<td style="font-weight:bold; color:${scoreColor}; background:#f1f8e9;">${earned}</td>`;
            }
        });
        
        matrixHtml += `</tr>`;
    });
    
    matrixHtml += `
                </tbody>
            </table>
            </div>
            <div style="margin-top:12px; font-size:12px; color:#888;">
                * 自动打分逻辑：<strong>客户群总分 / 涉及到的指标有效权重之和 × 标准总分</strong>。若某客户群数据为空，则不计入该指标权重。
            </div>
        </div>
    `;

    // Generate Ranking Table
    let rankingHtml = `
        <div class="card">
            <h3 class="card-title" style="color:#0277bd;"><span>🏇 “赛马”排行</span> <span style="font-size:12px; font-weight:normal; color:#888; margin-left:10px;">(支持预留手动调整机制)</span></h3>
            <table class="ranking-table">
                <thead>
                    <tr>
                        <th style="width:60px;">排名</th>
                        <th style="text-align:left;">客户群</th>
                        <th>标准总分</th>
                        <th>系统得分</th>
                        <th>预留加减分 (手动)</th>
                        <th>最终得分</th>
                    </tr>
                </thead>
                <tbody id="ranking-tbody">
                </tbody>
            </table>
        </div>
    `;

    content.innerHTML = rankingHtml + matrixHtml;
    window._currentCatData = catData;
    renderRanking();
}

function renderRanking() {
    const catData = window._currentCatData;
    const cats = Object.keys(catData);
    
    // Calculate final scores
    cats.forEach(cat => {
        const d = catData[cat];
        const manualInput = document.getElementById(`manual-score-${cat}`);
        if (manualInput) {
            d.manualScore = parseFloat(manualInput.value) || 0;
        }
        
        let baseScore = 0;
        if (d.validWeightSum > 0) {
            baseScore = (d.earnedScore / d.validWeightSum) * standardTotalScore;
        }
        d.baseScore = +baseScore.toFixed(2);
        d.finalScore = +(d.baseScore + d.manualScore).toFixed(2);
    });
    
    // Sort
    const sortedCats = cats.sort((a, b) => catData[b].finalScore - catData[a].finalScore);
    
    const tbody = document.getElementById('ranking-tbody');
    if (!tbody) return;
    
    let html = '';
    sortedCats.forEach((cat, index) => {
        const d = catData[cat];
        let medal = `${index + 1}`;
        if (index === 0) medal = '<span class="rank-medal">🥇</span>';
        if (index === 1) medal = '<span class="rank-medal">🥈</span>';
        if (index === 2) medal = '<span class="rank-medal">🥉</span>';
        
        let scoreClass = 'score-badge';
        const ratio = d.validWeightSum > 0 ? (d.baseScore / standardTotalScore) : 0;
        
        if (ratio >= 0.95) scoreClass += ' success';
        else if (ratio < 0.8) scoreClass += ' danger';
        
        html += `
            <tr>
                <td style="font-weight:bold; color:#777;">${medal}</td>
                <td style="text-align:left;" class="cat-name">${escapeHTML(d.name)}</td>
                <td style="color:#666; font-weight:bold;">${standardTotalScore}</td>
                <td style="color:#2c3e50; font-weight:bold;">${d.baseScore} <div style="font-size:11px;color:#aaa;font-weight:normal;margin-top:2px;">(获权 ${d.earnedScore} / 满权 ${d.validWeightSum})</div></td>
                <td>
                    <input type="number" id="manual-score-${cat}" class="manual-score" value="${d.manualScore}" onchange="renderRanking()" placeholder="±0" step="0.5">
                </td>
                <td><span class="${scoreClass}">${d.finalScore}</span></td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

window.openWeightModal = function() {
    if (!currentSnapshot || !currentSnapshot.topMetrics) {
        showToast('请先加载一份快照', 'error');
        return;
    }
    
    const metricCols = currentSnapshot.topMetrics || [];
    const listEl = document.getElementById('weight-modal-list');
    
    let html = '';
    metricCols.forEach(m => {
        const targetData = labelToTargetMap[m.label];
        const weight = (targetData && targetData.weight !== undefined) ? parseFloat(targetData.weight) : 1;
        const key = labelToTargetKeyMap[m.label];
        
        if (!key) {
            html += `<div style="display:flex; justify-content:space-between; align-items:center; padding:8px; background:#f9f9f9; border-radius:6px; border:1px solid #eee;">
                <span style="font-weight:600; color:#555;">${escapeHTML(m.label)}</span>
                <span style="color:#aaa; font-size:12px;">(未在SLA配置监控目标)</span>
            </div>`;
        } else {
            html += `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:#f5f8fa; border-radius:6px; border:1px solid #e1e8ed;">
                <span style="font-weight:600; color:#2c3e50;">${escapeHTML(m.label)}</span>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:12px; color:#666;">权重:</span>
                    <input type="number" class="metric-weight-input" data-key="${key}" value="${weight}" step="0.1" min="0" style="width:70px; padding:6px; border:1px solid #ccc; border-radius:4px; text-align:center;">
                </div>
            </div>`;
        }
    });
    
    if (!html) {
        html = '<div style="color:#888; text-align:center; padding:20px;">当前快照无可配置的指标</div>';
    }
    
    listEl.innerHTML = html;
    document.getElementById('weight-modal').style.display = 'flex';
};

window.closeWeightModal = function() {
    document.getElementById('weight-modal').style.display = 'none';
};

window.saveWeights = async function() {
    try {
        const inputs = document.querySelectorAll('.metric-weight-input');
        let updatedTargets = { ...globalConfig.targets };
        
        inputs.forEach(input => {
            const key = input.getAttribute('data-key');
            const w = parseFloat(input.value) || 0;
            if (updatedTargets[key]) {
                updatedTargets[key].weight = w;
            }
        });
        
        await API.put('/api/sla/targets', updatedTargets);
        globalConfig.targets = updatedTargets;
        buildLabelTargetMap(); // Rebuild mapping with new weights
        
        showToast('权重配置已保存，正在重新计算...', 'success');
        closeWeightModal();
        
        renderCurrentSnapshot(); // Re-calculate everything
        
    } catch (e) {
        showToast('保存权重失败', 'error');
        console.error(e);
    }
};

window.openAddMetricModal = function() {
    if (!currentSnapshot) {
        showToast('请先加载一份快照', 'error');
        return;
    }
    
    const formEl = document.getElementById('add-metric-form');
    const targetMonth = document.getElementById('target-month-select').value;
    
    let html = `
        <div style="margin-bottom:12px;">
            <label style="display:block; font-size:12px; color:#666; margin-bottom:4px;">指标名称 <span style="color:red;">*</span></label>
            <input type="text" id="manual-metric-name" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box;" placeholder="例如: 客户拜访完成率">
        </div>
        
        <div style="display:flex; gap:10px; margin-bottom:12px;">
            <div style="flex:1;">
                <label style="display:block; font-size:12px; color:#666; margin-bottom:4px;">指标权重</label>
                <input type="number" id="manual-metric-weight" value="1" step="0.1" min="0" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box;">
            </div>
            <div style="flex:1;">
                <label style="display:block; font-size:12px; color:#666; margin-bottom:4px;">考核方式</label>
                <select id="manual-metric-type" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box;">
                    <option value="gte">≥ (达标需大于等于)</option>
                    <option value="lte">≤ (达标需小于等于)</option>
                </select>
            </div>
            <div style="flex:1;">
                <label style="display:block; font-size:12px; color:#666; margin-bottom:4px;">${targetMonth}月目标值</label>
                <input type="number" id="manual-metric-target" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box;" placeholder="目标数字">
            </div>
        </div>
        
        <div style="margin-bottom:16px; padding-bottom:12px; border-bottom:1px dashed #eee;">
            <label style="display:block; font-size:12px; color:#666; margin-bottom:4px;">全局总体数值 (总盘实际达成)</label>
            <input type="text" id="manual-metric-global" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box;" placeholder="例如: 85 或 85%">
        </div>
        
        <label style="display:block; font-size:12px; color:#666; margin-bottom:8px;">各客户群实际达成数值 (留空或填 -- 表示不考核该群)</label>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
    `;
    
    categories.forEach(cat => {
        html += `
            <div>
                <span style="font-size:12px; font-weight:bold; color:#2c3e50; display:inline-block; margin-bottom:2px;">${escapeHTML(cat)}</span>
                <input type="text" class="manual-cat-input" data-cat="${cat}" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box;" placeholder="实际数值 (可带%)">
            </div>
        `;
    });
    
    html += `</div>`;
    
    formEl.innerHTML = html;
    
    const modal = document.getElementById('add-metric-modal');
    modal.querySelector('h3').innerHTML = '➕ 手动增加指标';
    modal.style.display = 'flex';
};

window.editManualMetric = function(label) {
    if (!currentSnapshot) return;
    
    // Open modal to generate DOM
    openAddMetricModal();
    
    const modal = document.getElementById('add-metric-modal');
    modal.querySelector('h3').innerHTML = '✏️ 填报手动指标';
    
    const nameInput = document.getElementById('manual-metric-name');
    nameInput.value = label;
    nameInput.setAttribute('readonly', 'readonly');
    nameInput.style.backgroundColor = '#f0f0f0';
    
    // Fill target data
    const targetData = labelToTargetMap[label];
    if (targetData) {
        if (targetData.weight !== undefined) document.getElementById('manual-metric-weight').value = targetData.weight;
        if (targetData.type) document.getElementById('manual-metric-type').value = targetData.type;
        const targetMonth = document.getElementById('target-month-select').value;
        if (targetData[targetMonth] !== undefined) document.getElementById('manual-metric-target').value = targetData[targetMonth];
    }
    
    // Fill snapshot values if exist
    const existingMetric = (currentSnapshot.topMetrics || []).find(m => m.label === label);
    if (existingMetric) {
        if (existingMetric.value && existingMetric.value !== '--') {
            document.getElementById('manual-metric-global').value = existingMetric.value;
        }
        const subs = existingMetric.subMetrics || [];
        subs.forEach(sm => {
            const input = document.querySelector(`.manual-cat-input[data-cat="${sm.category}"]`);
            if (input && sm.value !== '--') {
                input.value = sm.value;
            }
        });
    }
};

window.closeAddMetricModal = function() {
    document.getElementById('add-metric-modal').style.display = 'none';
};

window.saveManualMetric = async function() {
    const name = document.getElementById('manual-metric-name').value.trim();
    if (!name) return showToast('请输入指标名称', 'error');
    
    const weight = parseFloat(document.getElementById('manual-metric-weight').value);
    const validWeight = isNaN(weight) ? 1 : weight;
    const type = document.getElementById('manual-metric-type').value;
    const targetVal = document.getElementById('manual-metric-target').value.trim();
    const globalVal = document.getElementById('manual-metric-global').value.trim() || '--';
    const targetMonth = document.getElementById('target-month-select').value;
    
    const subMetrics = [];
    document.querySelectorAll('.manual-cat-input').forEach(input => {
        const cat = input.getAttribute('data-cat');
        const val = input.value.trim() || '--';
        if (val !== '--') {
            subMetrics.push({ category: cat, value: val });
        }
    });
    
    const metricId = `manual_m_${Date.now()}`;
    const newMetric = {
        id: metricId,
        colX: "手动指标",
        valY: "总计",
        colZ: "手动指标",
        label: name,
        color: "",
        value: globalVal,
        subMetrics: subMetrics
    };
    
    let targetKey = labelToTargetKeyMap[name];
    if (!targetKey) {
        targetKey = `manual_target_${Date.now()}`;
    }
    
    let updatedTargets = { ...globalConfig.targets };
    if (!updatedTargets[targetKey]) {
        updatedTargets[targetKey] = {};
    }
    updatedTargets[targetKey].type = type;
    updatedTargets[targetKey].weight = validWeight;
    updatedTargets[targetKey].label = name;
    
    if (targetVal) {
        updatedTargets[targetKey][targetMonth] = targetVal;
    }
    
    try {
        await API.put('/api/sla/targets', updatedTargets);
        globalConfig.targets = updatedTargets;
        
        if (!currentSnapshot.topMetrics) currentSnapshot.topMetrics = [];
        
        const existingIdx = currentSnapshot.topMetrics.findIndex(m => m.label === name);
        if (existingIdx > -1) {
            newMetric.id = currentSnapshot.topMetrics[existingIdx].id; // preserve ID
            currentSnapshot.topMetrics[existingIdx] = newMetric;
        } else {
            currentSnapshot.topMetrics.push(newMetric);
        }
        
        await API.put(`/api/sla/snapshots/${currentSnapshot.id}`, currentSnapshot);
        
        buildLabelTargetMap();
        showToast('手动指标保存成功', 'success');
        closeAddMetricModal();
        renderCurrentSnapshot();
    } catch(e) {
        showToast('保存失败', 'error');
        console.error(e);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initReport();
});
