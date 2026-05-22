document.addEventListener('DOMContentLoaded', async () => {
    try {
        const [data, configData, catDataRes, groupData] = await Promise.all([
            window.API.get('/api/db/monthly_report_data'),
            window.API.get('/api/sla/config'),
            window.API.get('/api/sla/categories'),
            window.API.get('/api/sla/groups')
        ]);
        
        window._categories = catDataRes || ['TE', 'ORG', 'ET', 'VDF'];
        window._globalConfig = configData || { targets: {}, prefs: {} };
        window._metricGroups = groupData || [];
        
        let manualAdjustItems = [];
        if (configData && configData.prefs && configData.prefs.manualAdjustItems) {
            manualAdjustItems = configData.prefs.manualAdjustItems;
        } else {
            manualAdjustItems = [
                { type: '扣分', name: '人为事故 (含整改逾期、错认漏认)' },
                { type: '扣分', name: '恢复超60分钟事故 (华为原因)' },
                { type: '扣分', name: '严重投诉 (CXO/Operation Head级别)' },
                { type: '扣分', name: '严重违规 (瞒报、无方案/越权操作)' },
                { type: '扣分', name: '整改确认及执行逾期' },
                { type: '扣分', name: '不合格的关闭整改单 (审计发现)' },
                { type: '扣分', name: '未按要求完成整改 (含延期)' },
                { type: '扣分', name: '不规范风险处理 (月度审计)' },
                { type: '扣分', name: '风险确认/挂起/关闭逾期' },
                { type: '扣分', name: 'FME离职超10天未清理账号' },
                { type: '扣分', name: 'WFM无授权违规操作 (未发客户延期邮件)' },
                { type: '扣分', name: 'WFM操作回退 (代表处服务质量原因)' },
                { type: '扣分', name: '未按时完成回退复盘 (SLA:10天)' },
                { type: '扣分', name: 'ITR-FRT达不到98.5% (按月)' },
                { type: '加分', name: '跨产品逃生演练及Jam宣传' },
                { type: '加分', name: '邀约客户交流呈现服务价值' }
            ];
        }
        window._manualAdjustItems = manualAdjustItems;
        
        document.getElementById('loader').style.display = 'none';
        
        if (!data || !data.trends || data.trends.length === 0) {
            document.getElementById('report-date-range').innerText = '暂无数据';
            document.getElementById('report-content').style.display = 'block';
            document.getElementById('report-content').innerHTML = '<div style="text-align:center; padding:40px;">当前没有历史入库数据，无法生成月报。</div>';
            return;
        }

        document.getElementById('report-content').style.display = 'block';
        const exportBtnContainer = document.getElementById('export-actions');
        if (exportBtnContainer) exportBtnContainer.style.display = 'flex';

        const trends = data.trends;
        const latest = data.latest_snapshot;

        const startDate = trends[0].date;
        const endDate = trends[trends.length - 1].date;
        document.getElementById('report-date-range').innerText = `分析周期: ${startDate} 至 ${endDate} (共 ${trends.length} 份数据快照)`;
        document.getElementById('latest-snapshot-date').innerText = endDate;

        generateSummary(trends, latest);
        drawCharts(trends);
        renderRanking(latest);
        renderMatrix(latest);
        renderManualScores(latest);
        
        if (typeof renderFullSnapshot === 'function') {
            renderFullSnapshot(latest, window._categories, window._globalConfig, window._metricGroups, window._manualAdjustItems);
        }

    } catch (error) {
        console.error('Failed to load monthly data:', error);
        document.getElementById('loader').innerHTML = `<p style="color:red;">数据加载失败: ${error.message}</p>`;
    }
});

function generateSummary(trends, latest) {
    if (!latest.metrics || latest.metrics.length === 0) return;

    const failingByCat = {};
    const catTotalMetrics = {};
    const overallFailingSet = new Set();
    
    latest.metrics.forEach(m => {
        if (!catTotalMetrics[m.cat_name]) catTotalMetrics[m.cat_name] = 0;
        catTotalMetrics[m.cat_name]++;
        
        if (m.is_failing === 1) {
            overallFailingSet.add(m.metric_label);
            if (!failingByCat[m.cat_name]) failingByCat[m.cat_name] = [];
            failingByCat[m.cat_name].push(m.metric_label);
        }
    });
    
    let currentTrend = trends[trends.length - 1];
    
    const overallFailingArr = Array.from(overallFailingSet);
    let overallStr = '';
    if (overallFailingArr.length > 0) {
        overallStr = `整体上共有 <span class="summary-highlight">${overallFailingArr.length}</span> 项指标存在未达标情况，主要包含：${overallFailingArr.join('、')}。`;
    } else {
        overallStr = `整体上所有考核指标均 <span style="color:green; font-weight:bold;">100% 达标</span>。`;
    }

    const manualScoresArr = latest.cat_scores ? latest.cat_scores.filter(c => c.manual_score !== 0 && c.manual_score !== null) : [];
    let manualStr = '';
    
    let rawSnap = {};
    if (latest.raw_data_json) {
        try { rawSnap = JSON.parse(latest.raw_data_json); } catch(e){}
    }
    const snapAdjData = rawSnap.manualAdjustData || {};
    
    if (manualScoresArr.length > 0) {
        let details = manualScoresArr.map(c => {
            let action = c.manual_score > 0 ? `加 ${c.manual_score} 分` : `扣 ${Math.abs(c.manual_score)} 分`;
            
            let reasons = [];
            let catAdj = snapAdjData[c.cat_name] || {};
            if (window._manualAdjustItems) {
                window._manualAdjustItems.forEach((item, idx) => {
                    if (catAdj[idx] > 0) {
                        reasons.push(item.name);
                    }
                });
            }
            
            let reasonStr = reasons.length > 0 ? `，因为：${reasons.join('、')}` : '';
            return `${c.cat_name}（${action}${reasonStr}）`;
        }).join('；');
        manualStr = `额外加减分情况：${details}。`;
    }
    
    let summaryHtml = `
        <p>截至 <strong>${currentTrend.date}</strong>，${overallStr} ${manualStr}</p>
        <p>各客户群详细达标情况如下：</p>
        <ul style="padding-left:20px; line-height:1.8;">
    `;
    
    for (let catName in catTotalMetrics) {
        let failingList = failingByCat[catName] || [];
        if (failingList.length > 0) {
            summaryHtml += `<li>【<strong>${catName}</strong>】：共有 <span class="summary-highlight">${failingList.length}</span> 项未达标，主要包含：${failingList.join('、')}。</li>`;
        } else {
            summaryHtml += `<li>【<strong>${catName}</strong>】：各项指标 <span style="color:green; font-weight:bold;">全部达标</span>。</li>`;
        }
    }
    
    summaryHtml += `</ul>`;

    const expiringTickets = rawSnap.expiringTickets || [];
    if (expiringTickets.length > 0) {
        summaryHtml += `
        <div style="margin-top:15px; padding:12px; background-color:#fff3e0; border-left:4px solid #e65100; border-radius:4px;">
            <h4 style="margin:0 0 8px 0; color:#e65100; font-size:14px;">⚠️ 临期任务预警 (${expiringTickets.length}项)</h4>
            <ul style="padding-left:20px; margin:0; line-height:1.6; color:#c62828; font-size:13px;">
        `;
        expiringTickets.forEach(t => {
            const td = t.data || {};
            const id = td.task_id || td.risk_id || td.ticket_id || td['单号'] || td['问题风险编号'] || td['问题编号'] || '未知单号';
            const network = td.network_name || td['网络名称'] || td.network || '未知网络';
            summaryHtml += `<li><strong>[${t.title.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim()}]</strong> 单号: ${id} | 网络: ${network} | 状态: ${t._slaCleanText}</li>`;
        });
        summaryHtml += `</ul></div>`;
    }
    
    document.getElementById('summary-content').innerHTML = summaryHtml;
}

function drawCharts(trends) {
    const dates = trends.map(t => t.date);
    
    // Chart 1: Overall Trend
    const chartOverall = echarts.init(document.getElementById('chart-overall'));
    const overallRates = trends.map(t => t.compliance_rate !== undefined ? parseFloat(t.compliance_rate).toFixed(2) : 0);
    const totalMetrics = trends.map(t => t.metrics_total || 0);
    const passedMetrics = trends.map(t => (t.metrics_total || 0) - (t.metrics_failing || 0));
    
    chartOverall.setOption({
        title: { text: '整体达标率与指标数趋势', left: 'center', textStyle: { fontSize: 15, fontWeight: 'normal' } },
        tooltip: { trigger: 'axis', formatter: function(params) {
            let relVal = params[0].name;
            for (let i = 0, l = params.length; i < l; i++) {
                let unit = params[i].seriesName === '整体达标率' ? '%' : ' 项';
                relVal += '<br/>' + params[i].marker + params[i].seriesName + ': ' + params[i].value + unit;
            }
            return relVal;
        }},
        legend: { data: ['整体达标率', '达标指标数', '总考核指标数'], bottom: 0 },
        xAxis: { type: 'category', data: dates, boundaryGap: false },
        yAxis: [
            { 
                type: 'value', 
                min: 0, 
                max: 100,
                name: '达标率',
                axisLabel: { formatter: '{value}%' }
            },
            {
                type: 'value',
                name: '数量',
                min: 0,
                axisLabel: { formatter: '{value}项' },
                splitLine: { show: false }
            }
        ],
        grid: { left: '10%', right: '12%', bottom: '15%' },
        series: [
            {
                name: '整体达标率',
                data: overallRates,
                type: 'line',
                smooth: true,
                yAxisIndex: 0,
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(0, 40, 94, 0.3)' },
                        { offset: 1, color: 'rgba(0, 40, 94, 0.05)' }
                    ])
                },
                itemStyle: { color: '#00285e' },
                label: { show: true, position: 'top', formatter: '{c}%' }
            },
            {
                name: '总考核指标数',
                data: totalMetrics,
                type: 'line',
                smooth: true,
                yAxisIndex: 1,
                itemStyle: { color: '#9e9e9e' },
                lineStyle: { type: 'dashed' }
            },
            {
                name: '达标指标数',
                data: passedMetrics,
                type: 'line',
                smooth: true,
                yAxisIndex: 1,
                itemStyle: { color: '#2e7d32' },
                label: { show: true, position: 'bottom', formatter: '{c}项' }
            }
        ]
    });

    // Chart 2: Groups Trend
    const chartGroups = echarts.init(document.getElementById('chart-groups'));
    // Get all unique categories across all trends
    const allCatsSet = new Set();
    trends.forEach(t => {
        if(t.cat_scores) Object.keys(t.cat_scores).forEach(c => allCatsSet.add(c));
    });
    const allCats = Array.from(allCatsSet);
    
    const seriesData = allCats.map(cat => {
        return {
            name: cat,
            type: 'line',
            smooth: true,
            data: trends.map(t => {
                let score = (t.cat_scores && t.cat_scores[cat]) !== undefined ? t.cat_scores[cat] : null;
                return score !== null ? parseFloat(score).toFixed(2) : null;
            })
        };
    });

    chartGroups.setOption({
        title: { text: '各客户群达标情况趋势', left: 'center', textStyle: { fontSize: 15, fontWeight: 'normal' } },
        tooltip: { trigger: 'axis' },
        legend: { data: allCats, bottom: 0, type: 'scroll' },
        xAxis: { type: 'category', data: dates, boundaryGap: false },
        yAxis: { type: 'value', min: 'dataMin' },
        grid: { left: '10%', right: '5%', bottom: '15%' },
        series: seriesData
    });

    window.addEventListener('resize', () => {
        chartOverall.resize();
        chartGroups.resize();
    });
}

function renderRanking(latest) {
    if (!latest.cat_scores || latest.cat_scores.length === 0) return;
    
    let sorted = [...latest.cat_scores].sort((a, b) => b.final_score - a.final_score);
    let html = '';
    
    sorted.forEach((cat, index) => {
        let rankStr = index + 1;
        if (index === 0) rankStr = '🥇 1';
        if (index === 1) rankStr = '🥈 2';
        if (index === 2) rankStr = '🥉 3';

        let baseScore = cat.base_score ? cat.base_score.toFixed(2) : '0.00';
        let manualScore = cat.manual_score ? cat.manual_score.toFixed(2) : '0.00';
        let finalScore = cat.final_score ? cat.final_score.toFixed(2) : '0.00';
        
        let manualStyle = cat.manual_score < 0 ? 'color: red;' : (cat.manual_score > 0 ? 'color: green;' : 'color: #999;');
        let manualDisplay = cat.manual_score > 0 ? '+' + manualScore : manualScore;

        let rating = '良好';
        if (cat.final_score >= 95) rating = '<span style="color:green;font-weight:bold;">优秀</span>';
        else if (cat.final_score < 80) rating = '<span style="color:red;font-weight:bold;">警告</span>';

        html += `
            <tr>
                <td style="font-weight:bold; font-size:16px;">${rankStr}</td>
                <td style="font-weight:bold; color:#00285e;">${cat.cat_name}</td>
                <td>${baseScore}</td>
                <td style="${manualStyle}">${manualDisplay}</td>
                <td style="font-size:16px; font-weight:bold; color:#333;">${finalScore}</td>
                <td>${rating}</td>
            </tr>
        `;
    });
    
    document.querySelector('#ranking-table tbody').innerHTML = html;
}

function renderMatrix(latest) {
    if (!latest.metrics || latest.metrics.length === 0) return;

    // Filter failing metrics (is_failing === 1)
    const failingMetrics = latest.metrics.filter(m => m.is_failing === 1);
    
    if (failingMetrics.length === 0) {
        document.querySelector('#matrix-table tbody').innerHTML = '<tr><td colspan="3" style="text-align:center;color:#666;">恭喜，当前快照无任何未达标项！</td></tr>';
        return;
    }

    // Group by metric_label
    const metricGroups = {};
    failingMetrics.forEach(m => {
        if (!metricGroups[m.metric_label]) {
            metricGroups[m.metric_label] = {
                target_val: m.target_val,
                failures: []
            };
        }
        metricGroups[m.metric_label].failures.push({
            cat_name: m.cat_name,
            raw_val: m.raw_val
        });
    });

    let html = '';
    for (let label in metricGroups) {
        let group = metricGroups[label];
        let failuresHtml = group.failures.map(f => {
            return `<span style="display:inline-block; margin:2px 4px; padding:4px 8px; background:#ffebee; border:1px solid #ffcdd2; border-radius:4px; font-size:13px;">
                <strong>${f.cat_name}</strong>: ${f.raw_val}
            </span>`;
        }).join(' ');

        html += `
            <tr>
                <td style="font-weight:600; color:#444;">${label}</td>
                <td style="color:#666;">${group.target_val || '-'}</td>
                <td>${failuresHtml}</td>
            </tr>
        `;
    }

    document.querySelector('#matrix-table tbody').innerHTML = html;
}

function renderManualScores(latest) {
    if (!latest.cat_scores) return;
    
    const manualScores = latest.cat_scores.filter(c => c.manual_score !== 0 && c.manual_score !== null);
    
    if (manualScores.length === 0) {
        document.getElementById('manual-score-section').style.display = 'none';
        return;
    }
    
    document.getElementById('manual-score-section').style.display = 'block';
    
    let rawSnap = {};
    if (latest.raw_data_json) {
        try { rawSnap = JSON.parse(latest.raw_data_json); } catch(e){}
    }
    const snapAdjData = rawSnap.manualAdjustData || {};
    
    let html = '';
    manualScores.forEach(c => {
        let valStyle = c.manual_score > 0 ? 'color: green; font-weight: bold;' : 'color: red; font-weight: bold;';
        let valStr = c.manual_score > 0 ? `+${c.manual_score}` : `${c.manual_score}`;
        
        let reasons = [];
        let catAdj = snapAdjData[c.cat_name] || {};
        if (window._manualAdjustItems) {
            window._manualAdjustItems.forEach((item, idx) => {
                if (catAdj[idx] > 0) {
                    reasons.push(item.name);
                }
            });
        }
        let desc = reasons.length > 0 ? reasons.join('、') : '系统记录的手工作业/质量事故奖惩等调整项';
        
        html += `
            <tr>
                <td style="font-weight:bold; color:#00285e;">${c.cat_name}</td>
                <td style="${valStyle}">${valStr}</td>
                <td style="color:#666;">（${desc}）</td>
            </tr>
        `;
    });
    
    document.querySelector('#manual-score-table tbody').innerHTML = html;
}

function renderFullSnapshot(latest, categories, globalConfig, metricGroups, manualAdjustItems) {
    if (!latest.raw_data_json) return;
    let snap;
    try { snap = JSON.parse(latest.raw_data_json); } catch(e) { return; }
    
    // Build labelToTargetMap
    const labelToTargetMap = {};
    const { targets, prefs } = globalConfig;
    if (prefs) {
        Object.keys(prefs).forEach(secId => {
            const pref = prefs[secId];
            const cleanSecId = secId.startsWith('sla_prefs_') ? secId.substring(10) : secId;
            if (pref.customMetrics) {
                pref.customMetrics.forEach(rule => {
                    const key = `${cleanSecId}_${rule.id}`;
                    if (targets && targets[key]) labelToTargetMap[rule.label] = targets[key];
                });
            }
        });
    }
    if (targets) {
        Object.keys(targets).forEach(k => {
            if (k.startsWith('manual_') && targets[k].label) {
                labelToTargetMap[targets[k].label] = targets[k];
            }
        });
    }

    // Prepare catData
    const catData = {};
    categories.forEach(cat => {
        catData[cat] = { earnedScore: 0, validWeightSum: 0, values: {} };
    });

    const metricCols = snap.topMetrics || [];
    
    // Inject missing manual
    if (targets) {
        Object.keys(targets).forEach(k => {
            if (k.startsWith('manual_') && targets[k].label) {
                const label = targets[k].label;
                if (!metricCols.find(m => m.label === label)) {
                    metricCols.push({ label: label, value: '--', subMetrics: [], isManual: true });
                } else {
                    const exists = metricCols.find(m => m.label === label);
                    if(exists) exists.isManual = true;
                }
            }
        });
    }

    const targetMonth = snap.month || new Date(snap.timestamp).getMonth() + 1;
    
    function parseNum(str) {
        if (str === undefined || str === null || str === '--') return NaN;
        const n = parseFloat(String(str).replace(/[^0-9.-]/g, ''));
        return isNaN(n) ? NaN : n;
    }

    metricCols.forEach(m => {
        const targetData = labelToTargetMap[m.label];
        const weight = (targetData && targetData.weight !== undefined) ? parseFloat(targetData.weight) : 1;
        m.hasTarget = targetData && targetData[targetMonth] !== undefined && targetData[targetMonth] !== '' && weight > 0;
        
        const subs = m.subMetrics || [];
        subs.forEach(sm => {
            if (!catData[sm.category]) {
                catData[sm.category] = { earnedScore: 0, validWeightSum: 0, values: {} };
                if (!categories.includes(sm.category)) categories.push(sm.category);
            }
            const valNum = parseNum(sm.value);
            let isFailing = false;
            let gapStr = '';
            let bonusScore = 0;
            
            if (!isNaN(valNum) && m.hasTarget) {
                catData[sm.category].validWeightSum += weight;
                const targetNum = parseFloat(targetData[targetMonth]);
                const condition = targetData.type || 'gte';
                const isPercent = String(sm.value).includes('%');
                
                if (condition === 'gte' && valNum < targetNum) {
                    isFailing = true; gapStr = +(targetNum - valNum).toFixed(2) + (isPercent ? '%' : '');
                } else if (condition === 'lte' && valNum > targetNum) {
                    isFailing = true; gapStr = +(valNum - targetNum).toFixed(2) + (isPercent ? '%' : '');
                } else if (targetData.exceedBy > 0 && targetData.bonus > 0) {
                    if (condition === 'gte' && valNum > targetNum) {
                        bonusScore = Math.floor((valNum - targetNum) / targetData.exceedBy) * targetData.bonus;
                    } else if (condition === 'lte' && valNum < targetNum) {
                        bonusScore = Math.floor((targetNum - valNum) / targetData.exceedBy) * targetData.bonus;
                    }
                }
                if (!isFailing) catData[sm.category].earnedScore += weight + bonusScore;
            }
            catData[sm.category].values[m.label] = { raw: sm.value, num: valNum, isFailing: isFailing, gapStr: gapStr, bonusScore: bonusScore||0 };
        });
    });

    const labelToGroup = {};
    const groupWeightMap = {};
    metricGroups.forEach(g => {
        let sumWeight = 0;
        (g.metrics || []).forEach(label => { 
            labelToGroup[label] = g.name; 
            const t = labelToTargetMap[label];
            sumWeight += (t && t.weight !== undefined) ? parseFloat(t.weight) : 1;
        });
        groupWeightMap[g.name] = sumWeight;
    });

    const orderedMetrics = [];
    metricGroups.forEach(g => {
        (g.metrics || []).forEach(label => {
            const m = metricCols.find(x => x.label === label);
            if (m) orderedMetrics.push(m);
        });
    });
    metricCols.forEach(m => { if (!labelToGroup[m.label]) orderedMetrics.push(m); });

    const tableRows = [];
    let i = 0;
    while (i < orderedMetrics.length) {
        const m = orderedMetrics[i];
        const hasTgt = labelToTargetMap[m.label] && labelToTargetMap[m.label][targetMonth] !== undefined && labelToTargetMap[m.label][targetMonth] !== '';
        const grpName = labelToGroup[m.label] || (m.isManual || hasTgt ? '未分组(Ungrouped)' : null);
        
        if (grpName) {
            const grpMetrics = orderedMetrics.filter(x => {
                const xHasTgt = labelToTargetMap[x.label] && labelToTargetMap[x.label][targetMonth] !== undefined && labelToTargetMap[x.label][targetMonth] !== '';
                return (labelToGroup[x.label] || (x.isManual || xHasTgt ? '未分组(Ungrouped)' : null)) === grpName;
            });
            const size = grpMetrics.length;
            const firstIdx = orderedMetrics.findIndex(x => {
                const xHasTgt = labelToTargetMap[x.label] && labelToTargetMap[x.label][targetMonth] !== undefined && labelToTargetMap[x.label][targetMonth] !== '';
                return (labelToGroup[x.label] || (x.isManual || xHasTgt ? '未分组(Ungrouped)' : null)) === grpName && x.label === grpMetrics[0].label;
            });
            if (i === firstIdx) {
                tableRows.push({ groupName: grpName, groupSize: size, isGroupStart: true, metric: m, groupWeight: groupWeightMap[grpName] || '-' });
            } else {
                tableRows.push({ groupName: grpName, groupSize: 0, isGroupStart: false, metric: m });
            }
        }
        i++;
    }

    const escapeHTML = str => typeof str === 'string' ? str.replace(/[&<>'"]/g, tag => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'": '&#39;','"':'&quot;'}[tag]||tag)) : str;

    let matrixHtml = `
        <div style="background:#fff; overflow-x:auto;">
        <table class="matrix-table" style="font-size:12px;">
            <thead>
                <tr>
                    <th style="min-width:40px; background:#e8eaf6; color:#283593;">分组</th>
                    <th style="min-width:40px; background:#e8eaf6; color:#283593;">总权重</th>
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

    tableRows.forEach(row => {
        const m = row.metric;
        let targetStr = '--';
        let isGlobalFailing = false;
        let globalGapStr = '';
        
        const targetData = labelToTargetMap[m.label];
        const weight = (targetData && targetData.weight !== undefined) ? parseFloat(targetData.weight) : 1;
        
        if (m.hasTarget) {
            const condition = targetData.type || 'gte';
            targetStr = (condition === 'gte' ? '≥ ' : '≤ ') + targetData[targetMonth];
            const isPercent = m.value && String(m.value).includes('%');
            if (isPercent) targetStr += '%';
            
            const globalValNum = parseNum(m.value);
            if (!isNaN(globalValNum)) {
                const targetNum = parseFloat(targetData[targetMonth]);
                if (condition === 'gte' && globalValNum < targetNum) {
                    isGlobalFailing = true; globalGapStr = +(targetNum - globalValNum).toFixed(2) + (isPercent ? '%' : '');
                } else if (condition === 'lte' && globalValNum > targetNum) {
                    isGlobalFailing = true; globalGapStr = +(globalValNum - targetNum).toFixed(2) + (isPercent ? '%' : '');
                }
            }
        }
        
        let globalDisplayClass = 'val-none';
        if (m.hasTarget) globalDisplayClass = isGlobalFailing ? 'val-warn' : 'val-good';
        
        matrixHtml += `<tr>`;
        if (metricGroups.length > 0) {
            matrixHtml += `<td ${row.isGroupStart ? `rowspan="${row.groupSize}"` : `style="display:none;"`}>${escapeHTML(row.groupName || '未分组')}</td>`;
            matrixHtml += `<td ${row.isGroupStart ? `rowspan="${row.groupSize}"` : `style="display:none;"`} style="font-weight:bold; color:#1565c0;">${row.groupWeight || '-'}</td>`;
        }

        matrixHtml += `
            <td style="text-align:left; font-weight:600; color:#2c3e50;">${escapeHTML(m.label)}</td>
            <td style="color:#666; font-weight:bold; background:#fafafa;">${weight}</td>
            <td style="color:#0277bd; font-weight:bold; background:#f5f8fa;">${targetStr}</td>
            <td style="background:#fff8e1; border-right:2px solid #ffe082;"><span class="${globalDisplayClass}">${escapeHTML(String(m.value || '--'))}</span></td>`;
            
        categories.forEach(cat => {
            const cell = catData[cat].values[m.label];
            if (!cell || cell.raw === '--') {
                matrixHtml += `<td class="val-none">--</td>`;
            } else {
                let displayClass = 'val-none';
                if (m.hasTarget) displayClass = cell.isFailing ? 'val-warn' : 'val-good';
                matrixHtml += `<td><span class="${displayClass}">${escapeHTML(cell.raw)}</span></td>`;
            }
        });
        
        categories.forEach(cat => {
            const cell = catData[cat].values[m.label];
            if (!cell || cell.raw === '--') {
                matrixHtml += `<td class="val-none" style="background:#f1f8e9;">--</td>`;
            } else if (!m.hasTarget) {
                matrixHtml += `<td class="val-none" style="background:#f1f8e9;">--</td>`;
            } else {
                const earned = cell.isFailing ? 0 : (weight + (cell.bonusScore || 0));
                const scoreColor = cell.isFailing ? '#d32f2f' : '#2e7d32';
                const bonusDisplay = cell.bonusScore ? ` <span style="font-size:10px; color:#e65100;">(+${cell.bonusScore.toFixed(2)})</span>` : '';
                matrixHtml += `<td style="font-weight:bold; color:${scoreColor}; background:#f1f8e9;">${earned}${bonusDisplay}</td>`;
            }
        });
        matrixHtml += `</tr>`;
    });
    
    matrixHtml += `</tbody></table></div>`;

    // Adjustments
    const snapAdjustData = snap.manualAdjustData || {};
    let adjustHtml = `
        <div style="background:#fff; overflow-x:auto; margin-top:20px;">
        <h4 style="margin: 0 0 10px 0; color: #555;">(附) 计分规则与排位说明及加减分详情</h4>
        <table class="matrix-table" style="font-size:12px;">
            <thead>
                <tr>
                    <th style="min-width:60px;">类型</th>
                    <th style="text-align:left;">项目说明</th>
                    <th style="min-width:120px;">计分规则</th>
                    ${categories.map(cat => `<th style="width:80px; background:#fff3e0;">${escapeHTML(cat)} (发生次数)</th>`).join('')}
                    ${categories.map(cat => `<th style="width:70px; background:#e8f5e9;">${escapeHTML(cat)} (加减分)</th>`).join('')}
                </tr>
            </thead>
            <tbody>
    `;

    manualAdjustItems.forEach((item, idx) => {
        if (item.deleted) return;
        const typeColor = item.type === '加分' ? '#2e7d32' : '#c62828';
        const typeBg = item.type === '加分' ? '#e8f5e9' : '#ffebee';
        adjustHtml += `<tr>
            <td style="color:${typeColor}; background:${typeBg}; font-weight:bold; text-align:center;">${escapeHTML(item.type)}</td>
            <td style="text-align:left;">${escapeHTML(item.name)}</td>
            <td style="color:#666;">${escapeHTML(item.desc)}</td>
        `;
        
        categories.forEach(cat => {
            const val = (snapAdjustData[cat] && snapAdjustData[cat][idx]) || '--';
            adjustHtml += `<td style="text-align:center;">${val}</td>`;
        });
        
        categories.forEach(cat => {
            let score = 0;
            const count = (snapAdjustData[cat] && snapAdjustData[cat][idx]) || 0;
            if (count > 0) {
                score = count * item.unit;
                if (item.cap && score > item.cap) score = item.cap;
                if (item.type === '扣分') score = -score;
            }
            const sColor = score > 0 ? '#2e7d32' : (score < 0 ? '#c62828' : '#333');
            adjustHtml += `<td style="font-weight:bold; text-align:center; color:${sColor};">${score}</td>`;
        });
        
        adjustHtml += `</tr>`;
    });
    adjustHtml += `</tbody></table></div>`;

    document.getElementById('full-report-content').innerHTML = matrixHtml + adjustHtml;
}

window.exportToImage = async function() {
    try {
        const btnContainer = document.getElementById('export-actions');
        btnContainer.style.display = 'none'; // hide buttons
        showToast('⏳ 正在生成长图，请稍候...', 'info');

        const element = document.querySelector('.page-container');
        
        // Fix for html2canvas truncation: scroll to top before capturing
        const prevScrollY = window.scrollY;
        window.scrollTo(0, 0);
        
        // Add temporary bottom padding to guarantee whitespace
        const oldPadding = element.style.paddingBottom;
        element.style.paddingBottom = '100px';

        const canvas = await html2canvas(element, {
            scale: 2, // High resolution
            useCORS: true,
            backgroundColor: '#f0f2f5'
        });

        element.style.paddingBottom = oldPadding;
        window.scrollTo(0, prevScrollY);

        const imgData = canvas.toDataURL('image/jpeg', 0.9);
        const a = document.createElement('a');
        a.href = imgData;
        
        let dateStr = document.getElementById('latest-snapshot-date').innerText || 'Latest';
        a.download = `Monthly_Report_${dateStr}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        btnContainer.style.display = 'flex';
        showToast('✅ 长图已成功导出！', 'success');
    } catch (e) {
        console.error(e);
        document.getElementById('export-actions').style.display = 'flex';
        showToast('导出图片失败: ' + e.message, 'error');
    }
};

window.exportToPDF = async function() {
    try {
        const btnContainer = document.getElementById('export-actions');
        btnContainer.style.display = 'none'; // hide buttons
        showToast('⏳ 正在生成 PDF，请稍候...', 'info');

        const element = document.querySelector('.page-container');
        
        // Fix for html2canvas truncation: scroll to top before capturing
        const prevScrollY = window.scrollY;
        window.scrollTo(0, 0);
        
        // Add temporary bottom padding to guarantee whitespace
        const oldPadding = element.style.paddingBottom;
        element.style.paddingBottom = '100px';

        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#f0f2f5'
        });

        element.style.paddingBottom = oldPadding;
        window.scrollTo(0, prevScrollY);

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        
        // Use jsPDF from UMD
        const { jsPDF } = window.jspdf;
        
        // Calculate dimensions to fit A4 width (avoiding PDF 14400pt height limit)
        // A4 width in pt is 595.28
        const pdfWidth = 595.28;
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'pt',
            format: [pdfWidth, pdfHeight]
        });
        
        // Add image to cover the entire custom-sized page
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        
        let dateStr = document.getElementById('latest-snapshot-date').innerText || 'Latest';
        pdf.save(`Monthly_Report_${dateStr}.pdf`);

        btnContainer.style.display = 'flex';
        showToast('✅ PDF 已成功导出！', 'success');
    } catch (e) {
        console.error(e);
        document.getElementById('export-actions').style.display = 'flex';
        showToast('导出 PDF 失败: ' + e.message, 'error');
    }
};
