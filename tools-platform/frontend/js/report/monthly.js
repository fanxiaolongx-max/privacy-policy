let chartOverallInstance = null;
let chartGroupsInstance = null;

window.currentLang = localStorage.getItem('monthlyReportLang') || 'zh';

const i18n = {
    zh: {
        title: '月度运营质量与合规分析报告 <span style="font-size:14px;color:#94a3b8;font-weight:normal;margin-left:8px;">v1.0.0</span>',
        date_range_loading: '分析周期: 加载中...',
        filter_7_days: '最近 7 天',
        filter_30_days: '最近 30 天',
        filter_90_days: '最近 90 天',
        filter_all: '全部',
        to: '至',
        filter: '筛选',
        export_image: '🖼️ 导出为长图',
        export_pdf: '📄 导出为 PDF',
        loading_report: '正在分析历史数据，生成月报...',
        section1_title: '一、整体状况与关键结论',
        section2_title: '二、历史趋势与波动分析',
        section3_title: '三、最新运行快照与短板透视',
        section3_1_title: '3.1 客户群达标排名及加减分详情',
        th_rank: '排名',
        th_group: '客户群名称',
        th_base_score: '基准得分',
        th_adj_score: '加减分项',
        th_final_score: '最终得分',
        th_rating: '评级',
        section3_2_title: '3.2 客户群短板透视矩阵 (不达标项)',
        th_metric_name: '指标名称',
        th_target: '目标值',
        th_failures: '未达标客户群及实测值',
        section3_3_title: '3.3 手工考核加减分明细',
        th_manual_score: '手工调整分数',
        th_desc: '说明',
        section3_4_title: '3.4 完整考核快照数据一览',
        
        // JS generated strings
        no_data: '当前时间范围内没有入库数据。',
        analysis_period: '分析周期: {start} 至 {end} (共 {count} 份数据快照)',
        overall_failing: '整体上共有 <span class="summary-highlight">{count}</span> 项指标存在未达标情况，主要包含：{list}。',
        overall_passed: '整体上所有考核指标均 <span style="color:green; font-weight:bold;">100% 达标</span>。',
        add_score: '加 {score} 分',
        sub_score: '扣 {score} 分',
        because: '，因为：{list}',
        manual_details: '额外加减分情况：{details}。',
        as_of: '截至 <strong>{date}</strong> (基于 {month} 月目标)，{overallStr} {manualStr}',
        group_details_title: '各客户群详细达标情况如下：',
        group_failing: '共有 <span class="summary-highlight">{count}</span> 项未达标，主要包含：{list}。',
        group_passed: '各项指标 <span style="color:green; font-weight:bold;">全部达标</span>。',
        expiring_warning: '⚠️ 临期任务预警 ({count}项)',
        unknown_id: '未知单号',
        unknown_network: '未知网络',
        ticket_format: '<strong>[{title}]</strong> 单号: {id} | 网络: {network} | 状态: {status}',
        
        chart1_title: '整体达标率与指标数趋势',
        chart1_overall_rate: '整体达标率',
        chart1_true_rate: '真实整体达标率',
        chart1_passed_metrics: '达标指标数',
        chart1_total_metrics: '总考核指标数',
        chart1_y_rate: '达标率',
        chart1_y_count: '数量',
        chart_unit_item: '项',
        
        chart2_title: '各客户群达标情况趋势',
        
        rating_excellent: '<span style="color:green;font-weight:bold;">优秀</span>',
        rating_good: '良好',
        rating_warning: '<span style="color:red;font-weight:bold;">警告</span>',
        
        matrix_no_failures: '恭喜，当前快照无任何未达标项！',
        manual_default_desc: '系统记录的手工作业/质量事故奖惩等调整项',
        
        full_title: '(附) 计分规则与排位说明及加减分详情',
        full_th_type: '类型',
        full_th_desc: '项目说明',
        full_th_rule: '计分规则',
        full_occurrences: ' (发生次数)',
        full_adjustments: ' (加减分)',
        
        full_th_grouping: '分组',
        full_th_total_weight: '总权重',
        full_th_metric: '考核的指标名称',
        full_th_weight: '权重',
        full_th_month_target: '{month}月目标值',
        full_th_global: '全局总体达标',
        full_th_score: '得分',
        full_ungrouped: '未分组(Ungrouped)',
        full_ungrouped_short: '未分组'
    },
    en: {
        title: 'Monthly Quality & Compliance Analysis <span style="font-size:14px;color:#94a3b8;font-weight:normal;margin-left:8px;">v1.0.0</span>',
        date_range_loading: 'Analysis Period: Loading...',
        filter_7_days: 'Last 7 Days',
        filter_30_days: 'Last 30 Days',
        filter_90_days: 'Last 90 Days',
        filter_all: 'All',
        to: 'to',
        filter: 'Filter',
        export_image: '🖼️ Export Image',
        export_pdf: '📄 Export PDF',
        loading_report: 'Analyzing historical data, generating report...',
        section1_title: 'I. Overall Status & Key Conclusions',
        section2_title: 'II. Historical Trends & Volatility',
        section3_title: 'III. Latest Snapshot & Weakness Analysis',
        section3_1_title: '3.1 Customer Group Ranking & Score Details',
        th_rank: 'Rank',
        th_group: 'Group',
        th_base_score: 'Base Score',
        th_adj_score: 'Adjustments',
        th_final_score: 'Final Score',
        th_rating: 'Rating',
        section3_2_title: '3.2 Weakness Matrix (Non-compliant Items)',
        th_metric_name: 'Metric Name',
        th_target: 'Target',
        th_failures: 'Non-compliant Groups & Actuals',
        section3_3_title: '3.3 Manual Adjustment Details',
        th_manual_score: 'Adj. Score',
        th_desc: 'Description',
        section3_4_title: '3.4 Full Assessment Snapshot',
        
        no_data: 'No data available in the selected time range.',
        analysis_period: 'Analysis Period: {start} to {end} ({count} snapshots)',
        overall_failing: 'Overall, there are <span class="summary-highlight">{count}</span> non-compliant metrics, including: {list}.',
        overall_passed: 'Overall, all metrics are <span style="color:green; font-weight:bold;">100% Compliant</span>.',
        add_score: '+{score}',
        sub_score: '-{score}',
        because: ', because: {list}',
        manual_details: 'Score Adjustments: {details}.',
        as_of: 'As of <strong>{date}</strong> (based on Month {month} targets), {overallStr} {manualStr}',
        group_details_title: 'Detailed compliance by group:',
        group_failing: '<span class="summary-highlight">{count}</span> non-compliant items, including: {list}.',
        group_passed: 'All metrics <span style="color:green; font-weight:bold;">Compliant</span>.',
        expiring_warning: '⚠️ Expiring Tasks Warning ({count})',
        unknown_id: 'Unknown ID',
        unknown_network: 'Unknown Network',
        ticket_format: '<strong>[{title}]</strong> ID: {id} | Network: {network} | Status: {status}',
        
        chart1_title: 'Overall Compliance Rate & Metrics Trend',
        chart1_overall_rate: 'Compliance Rate',
        chart1_true_rate: 'True Overall Rate',
        chart1_passed_metrics: 'Compliant Metrics',
        chart1_total_metrics: 'Total Metrics',
        chart1_y_rate: 'Rate',
        chart1_y_count: 'Count',
        chart_unit_item: ' items',
        
        chart2_title: 'Compliance Trend by Group',
        
        rating_excellent: '<span style="color:green;font-weight:bold;">Excellent</span>',
        rating_good: 'Good',
        rating_warning: '<span style="color:red;font-weight:bold;">Warning</span>',
        
        matrix_no_failures: 'Congratulations, no non-compliant items in the current snapshot!',
        manual_default_desc: 'System recorded manual/quality adjustment items',
        
        full_title: '(Appx) Scoring Rules & Adjustments',
        full_th_type: 'Type',
        full_th_desc: 'Description',
        full_th_rule: 'Rule',
        full_occurrences: ' (Count)',
        full_adjustments: ' (Score)',
        
        full_th_grouping: 'Group',
        full_th_total_weight: 'Total Weight',
        full_th_metric: 'Metric Name',
        full_th_weight: 'Weight',
        full_th_month_target: '{month} Target',
        full_th_global: 'Global Actual',
        full_th_score: 'Score',
        full_ungrouped: 'Ungrouped',
        full_ungrouped_short: 'Ungrouped',

        // Metric and Category mappings
        "TE": "TE",
        "ORG": "ORG",
        "ET": "ET",
        "VDF": "VDF",
        "加分": "Bonus",
        "扣分": "Penalty"
    }
};

function t(key, params = {}) {
    let str = i18n[window.currentLang][key] || key;
    for (let k in params) {
        str = str.replace(`{${k}}`, params[k]);
    }
    return str;
}

function tVal(text) {
    if (!text) return '';
    return i18n[window.currentLang][text] || text;
}

function updateStaticI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (i18n[window.currentLang][key]) {
            el.innerHTML = i18n[window.currentLang][key];
            if (key === 'section3_title') {
                const baselineText = window.currentLang === 'zh' ? ' (基准: ' : ' (Baseline: ';
                el.innerHTML += `${baselineText}<span id="latest-snapshot-date">${document.getElementById('latest-snapshot-date') ? document.getElementById('latest-snapshot-date').innerText : ''}</span>)`;
            }
        }
    });
    const toggleBtn = document.getElementById('lang-toggle');
    if (toggleBtn) {
        toggleBtn.innerText = window.currentLang === 'zh' ? 'English' : '中文';
    }
}

let currentTrends = null;
let currentLatest = null;

async function loadData(startDate, endDate) {
    try {
        document.getElementById('loader').style.display = 'block';
        document.getElementById('report-content').style.display = 'none';
        const exportBtnContainer = document.getElementById('export-actions');
        if (exportBtnContainer) exportBtnContainer.style.display = 'none';
        
        let url = '/api/db/monthly_report_data';
        if (startDate && endDate) {
            url += `?startDate=${startDate}&endDate=${endDate}`;
        }

        const [data, configData, catDataRes, groupData] = await Promise.all([
            window.API.get(url),
            window.API.get('/api/sla/config'),
            window.API.get('/api/sla/categories'),
            window.API.get('/api/sla/groups')
        ]);
        
        window._categories = catDataRes || [];
        window._globalConfig = configData || { targets: {}, prefs: {} };
        window._metricGroups = groupData || [];
        
        if (window._globalConfig.prefs && window._globalConfig.prefs.i18nMap) {
            const loadedI18n = window._globalConfig.prefs.i18nMap;
            const cleanI18n = {};
            for (const [k, v] of Object.entries(loadedI18n)) {
                if (v && v.includes('<br>')) {
                    const match = v.match(/<span[^>]*>(.*?)<\/span>/);
                    cleanI18n[k] = match ? match[1] : v.replace(/<[^>]+>/g, '');
                } else {
                    cleanI18n[k] = v;
                }
            }
            i18n['en'] = { ...i18n['en'], ...cleanI18n };
        }
        
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
            document.getElementById('report-date-range').innerText = t('no_data');
            document.getElementById('report-content').style.display = 'block';
            document.getElementById('report-content').innerHTML = `<div style="text-align:center; padding:40px;">${t('no_data')}</div>`;
            return;
        }

        document.getElementById('report-content').style.display = 'block';
        if (exportBtnContainer) exportBtnContainer.style.display = 'flex';

        currentTrends = data.trends;
        currentLatest = data.latest_snapshot;

        renderAll();

    } catch (error) {
        console.error('Failed to load monthly data:', error);
        document.getElementById('loader').innerHTML = `<p style="color:red;">Failed to load data: ${error.message}</p>`;
    }
}

function renderAll() {
    if (!currentTrends || !currentLatest) return;
    
    updateStaticI18n();

    const actualStartDate = currentTrends[0].date;
    const actualEndDate = currentTrends[currentTrends.length - 1].date;
    document.getElementById('report-date-range').innerText = t('analysis_period', {start: actualStartDate, end: actualEndDate, count: currentTrends.length});
    
    const latestSnapshotElem = document.getElementById('latest-snapshot-date');
    if (latestSnapshotElem) latestSnapshotElem.innerText = actualEndDate;

    generateSummary(currentTrends, currentLatest, window._globalConfig);
    drawCharts(currentTrends);
    renderRanking(currentLatest);
    renderMatrix(currentLatest);
    renderManualScores(currentLatest);
    
    if (typeof renderFullSnapshot === 'function') {
        renderFullSnapshot(currentLatest, window._categories, window._globalConfig, window._metricGroups, window._manualAdjustItems);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    updateStaticI18n();

    const langToggleBtn = document.getElementById('lang-toggle');
    if (langToggleBtn) {
        langToggleBtn.addEventListener('click', () => {
            window.currentLang = window.currentLang === 'zh' ? 'en' : 'zh';
            localStorage.setItem('monthlyReportLang', window.currentLang);
            if (currentTrends && currentLatest) {
                renderAll();
            } else {
                updateStaticI18n();
            }
        });
    }

    // Initial load (all data)
    loadData();

    // Setup filter buttons
    const filterBtns = document.querySelectorAll('.filter-btn:not(#lang-toggle)');
    const startDateInput = document.getElementById('filter-start-date');
    const endDateInput = document.getElementById('filter-end-date');
    const customBtn = document.getElementById('custom-filter-btn');

    function formatDate(d) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const days = btn.getAttribute('data-days');
            if (days === 'all') {
                startDateInput.value = '';
                endDateInput.value = '';
                loadData();
            } else {
                const end = new Date();
                const start = new Date();
                start.setDate(end.getDate() - parseInt(days));
                
                const sDate = formatDate(start);
                const eDate = formatDate(end);
                
                startDateInput.value = sDate;
                endDateInput.value = eDate;
                loadData(sDate, eDate);
            }
        });
    });

    customBtn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        const s = startDateInput.value;
        const e = endDateInput.value;
        if (!s || !e) {
            showToast('Please select start and end dates', 'warn');
            return;
        }
        if (s > e) {
            showToast('Start date cannot be after end date', 'warn');
            return;
        }
        loadData(s, e);
    });
});

function generateSummary(trends, latest, globalConfig) {
    if (!latest.metrics || latest.metrics.length === 0) return;

    const failingByCat = {};
    const catTotalMetrics = {};
    const overallFailingSet = new Set();
    
    latest.metrics.forEach(m => {
        if (!catTotalMetrics[m.cat_name]) catTotalMetrics[m.cat_name] = 0;
        catTotalMetrics[m.cat_name]++;
        
        if (m.is_failing === 1) {
            if (!failingByCat[m.cat_name]) failingByCat[m.cat_name] = [];
            failingByCat[m.cat_name].push(m.metric_label);
        }
    });
    
    let currentTrend = trends[trends.length - 1];
    
    // overallFailingArr calculation moved below

    const manualScoresArr = latest.cat_scores ? latest.cat_scores.filter(c => c.manual_score !== 0 && c.manual_score !== null) : [];
    let manualStr = '';
    
    let rawSnap = {};
    if (latest.raw_data_json) {
        try { rawSnap = JSON.parse(latest.raw_data_json); } catch(e){}
    }
    const targetMonth = rawSnap.month || (rawSnap.timestamp ? new Date(rawSnap.timestamp).getMonth() + 1 : (new Date(latest.created_at || Date.now()).getMonth() + 1));

    if (globalConfig && rawSnap.topMetrics) {
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
        
        // targetMonth calculated above
        function parseNum(str) {
            if (str === undefined || str === null || str === '--') return NaN;
            const n = parseFloat(String(str).replace(/[^0-9.-]/g, ''));
            return isNaN(n) ? NaN : n;
        }

        rawSnap.topMetrics.forEach(m => {
            const targetData = labelToTargetMap[m.label];
            const weight = (targetData && targetData.weight !== undefined) ? parseFloat(targetData.weight) : 1;
            const hasTarget = targetData && targetData[targetMonth] !== undefined && targetData[targetMonth] !== '' && weight > 0;
            
            if (hasTarget) {
                const condition = targetData.type || 'gte';
                const globalValNum = parseNum(m.value);
                const targetNum = parseFloat(targetData[targetMonth]);
                if (!isNaN(globalValNum) && !isNaN(targetNum)) {
                    if (condition === 'gte' && globalValNum < targetNum) {
                        console.log("DEBUG_FAILING:", m.label, globalValNum, targetNum, condition); overallFailingSet.add(m.label);
                    } else if (condition === 'lte' && globalValNum > targetNum) {
                        console.log("DEBUG_FAILING:", m.label, globalValNum, targetNum, condition); overallFailingSet.add(m.label);
                    }
                }
            }
        });
    }
    const overallFailingArr = Array.from(overallFailingSet);
    let overallStr = '';
    if (overallFailingArr.length > 0) {
        overallStr = t('overall_failing', {count: overallFailingArr.length, list: overallFailingArr.map(tVal).join('、')});
    } else {
        overallStr = t('overall_passed');
    }

    const snapAdjData = rawSnap.manualAdjustData || {};
    
    if (manualScoresArr.length > 0) {
        let details = manualScoresArr.map(c => {
            let actionStr = c.manual_score > 0 ? t('add_score', {score: c.manual_score}) : t('sub_score', {score: Math.abs(c.manual_score)});
            
            let reasons = [];
            let catAdj = snapAdjData[c.cat_name] || {};
            if (window._manualAdjustItems) {
                window._manualAdjustItems.forEach((item, idx) => {
                    if (catAdj[idx] > 0) {
                        reasons.push(tVal(item.name));
                    }
                });
            }
            
            let reasonStr = reasons.length > 0 ? t('because', {list: reasons.join('、')}) : '';
            return `${tVal(c.cat_name)}（${actionStr}${reasonStr}）`;
        }).join('；');
        manualStr = t('manual_details', {details: details});
    }
    
    let summaryHtml = `
        <p>${t('as_of', {date: currentTrend.date, month: targetMonth, overallStr: overallStr, manualStr: manualStr})}</p>
        <p>${t('group_details_title')}</p>
        <ul style="padding-left:20px; line-height:1.8;">
    `;
    
    for (let catName in catTotalMetrics) {
        let failingList = failingByCat[catName] || [];
        if (failingList.length > 0) {
            summaryHtml += `<li>【<strong>${tVal(catName)}</strong>】：${t('group_failing', {count: failingList.length, list: failingList.map(tVal).join('、')})}</li>`;
        } else {
            summaryHtml += `<li>【<strong>${tVal(catName)}</strong>】：${t('group_passed')}</li>`;
        }
    }
    
    summaryHtml += `</ul>`;

    const expiringTickets = rawSnap.expiringTickets || [];
    if (expiringTickets.length > 0) {
        summaryHtml += `
        <div style="margin-top:15px; padding:12px; background-color:#fff3e0; border-left:4px solid #e65100; border-radius:4px;">
            <h4 style="margin:0 0 8px 0; color:#e65100; font-size:14px;">${t('expiring_warning', {count: expiringTickets.length})}</h4>
            <ul style="padding-left:20px; margin:0; line-height:1.6; color:#c62828; font-size:13px;">
        `;
        expiringTickets.forEach(tItem => {
            const td = tItem.data || {};
            const id = td.task_id || td.risk_id || td.ticket_id || td['单号'] || td['问题风险编号'] || td['问题编号'] || t('unknown_id');
            const network = td.network_name || td['网络名称'] || td.network || t('unknown_network');
            summaryHtml += `<li>${t('ticket_format', {
                title: tItem.title.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim(),
                id: id,
                network: network,
                status: tItem._slaCleanText
            })}</li>`;
        });
        summaryHtml += `</ul></div>`;
    }
    
    document.getElementById('summary-content').innerHTML = summaryHtml;
}

function drawCharts(trends) {
    const dates = trends.map(t => t.date);
    
    const overallDom = document.getElementById('chart-overall');
    let chartOverall = echarts.getInstanceByDom(overallDom);
    if (!chartOverall) chartOverall = echarts.init(overallDom);
    
    const trueOverallRates = trends.map(t => {
        let rawSnap = {};
        if (t.raw_data_json) {
            try { rawSnap = JSON.parse(t.raw_data_json); } catch(e){}
        }
        if (!rawSnap.topMetrics || rawSnap.topMetrics.length === 0) return t.compliance_rate !== undefined ? parseFloat(t.compliance_rate).toFixed(2) : 0;

        const targetMonth = rawSnap.month || (rawSnap.timestamp ? new Date(rawSnap.timestamp).getMonth() + 1 : (new Date(t.created_at || t.date || Date.now()).getMonth() + 1));
        
        const labelToTargetMap = {};
        const globalConfig = window._globalConfig;
        const { targets, prefs } = globalConfig || {};
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
        
        function parseNum(str) {
            if (str === undefined || str === null || str === '--') return NaN;
            const n = parseFloat(String(str).replace(/[^0-9.-]/g, ''));
            return isNaN(n) ? NaN : n;
        }

        let totalTrueMetrics = 0;
        const failingSet = new Set();
        
        const fallbackMap = {
            '产品EOS闭环率': '全量EOS-产品',
            '版本EOS闭环率': '全量EOS-版本',
            '业务比对回传率': '日志回传',
            '业务比对备案率': '日志回传备案',
            '价值网络巡检完成率': '价值网络HC',
            '应急演练完成率': 'iLab 应急演练',
            '锂电池整改完成率': '锂电',
            '高危命令拦截次数': '高危命令拦截'
        };
        const currentTargetLabels = Object.keys(labelToTargetMap).sort((a, b) => b.length - a.length);

        rawSnap.topMetrics.forEach(m => {
            let targetData = labelToTargetMap[m.label];
            if (!targetData) {
                let matched = fallbackMap[m.label];
                if (!matched) {
                    matched = currentTargetLabels.find(n => m.label.includes(n) || n.includes(m.label) || m.label.replace(/ /g, '').includes(n.replace(/ /g, '')));
                }
                if (matched && labelToTargetMap[matched]) {
                    targetData = labelToTargetMap[matched];
                }
            }

            const weight = (targetData && targetData.weight !== undefined) ? parseFloat(targetData.weight) : 1;
            const hasTarget = targetData && targetData[targetMonth] !== undefined && targetData[targetMonth] !== '' && weight > 0;
            
            if (hasTarget) {
                totalTrueMetrics++;
                const condition = targetData.type || 'gte';
                const globalValNum = parseNum(m.value);
                const targetNum = parseFloat(targetData[targetMonth]);
                if (!isNaN(globalValNum) && !isNaN(targetNum)) {
                    if (condition === 'gte' && globalValNum < targetNum) {
                        failingSet.add(m.label);
                    } else if (condition === 'lte' && globalValNum > targetNum) {
                        failingSet.add(m.label);
                    }
                }
            }
        });
        
        if (totalTrueMetrics === 0) return 100.00;
        return (((totalTrueMetrics - failingSet.size) / totalTrueMetrics) * 100).toFixed(2);
    });

    const overallRates = trends.map(t => t.compliance_rate !== undefined ? parseFloat(t.compliance_rate).toFixed(2) : 0);
    const totalMetrics = trends.map(t => t.metrics_total || 0);
    const passedMetrics = trends.map(t => (t.metrics_total || 0) - (t.metrics_failing || 0));
    
    chartOverall.setOption({
        title: { text: t('chart1_title'), left: 'center', textStyle: { fontSize: 15, fontWeight: 'normal' } },
        tooltip: { trigger: 'axis', formatter: function(params) {
            let relVal = params[0].name;
            for (let i = 0, l = params.length; i < l; i++) {
                let unit = (params[i].seriesName === t('chart1_overall_rate') || params[i].seriesName === t('chart1_true_rate')) ? '%' : t('chart_unit_item');
                relVal += '<br/>' + params[i].marker + params[i].seriesName + ': ' + params[i].value + unit;
            }
            return relVal;
        }},
        legend: { data: [t('chart1_true_rate'), t('chart1_overall_rate'), t('chart1_passed_metrics'), t('chart1_total_metrics')], bottom: 0 },
        xAxis: { type: 'category', data: dates, boundaryGap: true },
        yAxis: [
            { 
                type: 'value', 
                min: 0, 
                max: 100,
                name: t('chart1_y_rate'),
                axisLabel: { formatter: '{value}%' }
            },
            {
                type: 'value',
                name: t('chart1_y_count'),
                min: 0,
                axisLabel: { formatter: `{value}${t('chart_unit_item').replace(' ', '')}` },
                splitLine: { show: false }
            }
        ],
        grid: { left: '3%', right: '3%', bottom: '5%', containLabel: true },
        series: [
            {
                name: t('chart1_true_rate'),
                data: trueOverallRates,
                type: 'line',
                smooth: true,
                yAxisIndex: 0,
                itemStyle: { color: '#e65100' }, // Orange for distinction
                label: { show: true, position: 'top', formatter: '{c}%' },
                labelLayout: { hideOverlap: true }
            },
            {
                name: t('chart1_overall_rate'),
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
                label: { show: true, position: 'top', formatter: '{c}%' },
                labelLayout: { hideOverlap: true }
            },
            {
                name: t('chart1_total_metrics'),
                data: totalMetrics,
                type: 'line',
                smooth: true,
                yAxisIndex: 1,
                itemStyle: { color: '#9e9e9e' },
                lineStyle: { type: 'dashed' }
            },
            {
                name: t('chart1_passed_metrics'),
                data: passedMetrics,
                type: 'line',
                smooth: true,
                yAxisIndex: 1,
                itemStyle: { color: '#2e7d32' },
                label: { show: true, position: 'bottom', formatter: `{c}${t('chart_unit_item').replace(' ', '')}` },
                labelLayout: { hideOverlap: true }
            }
        ]
    }, true); // Use true to not merge with previous options if data changed entirely

    // Chart 2: Groups Trend
    const groupsDom = document.getElementById('chart-groups');
    let chartGroups = echarts.getInstanceByDom(groupsDom);
    if (!chartGroups) chartGroups = echarts.init(groupsDom);
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
        title: { text: t('chart2_title'), left: 'center', textStyle: { fontSize: 15, fontWeight: 'normal' } },
        tooltip: { trigger: 'axis' },
        legend: { data: allCats.map(tVal), bottom: 0, type: 'scroll' },
        xAxis: { type: 'category', data: dates, boundaryGap: true },
        yAxis: { type: 'value', min: 'dataMin' },
        grid: { left: '3%', right: '5%', bottom: '5%', containLabel: true },
        series: seriesData.map(s => ({ ...s, name: tVal(s.name) }))
    }, true);

    window.addEventListener('resize', () => {
        if (chartOverall) chartOverall.resize();
        if (chartGroups) chartGroups.resize();
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

        let rating = t('rating_good');
        if (cat.final_score >= 95) rating = t('rating_excellent');
        else if (cat.final_score < 80) rating = t('rating_warning');

        html += `
            <tr>
                <td style="font-weight:bold; font-size:16px;">${rankStr}</td>
                <td style="font-weight:bold; color:#00285e;">${tVal(cat.cat_name)}</td>
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
        document.querySelector('#matrix-table tbody').innerHTML = `<tr><td colspan="3" style="text-align:center;color:#666;">${t('matrix_no_failures')}</td></tr>`;
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
                <strong>${tVal(f.cat_name)}</strong>: ${f.raw_val}
            </span>`;
        }).join(' ');

        html += `
            <tr>
                <td style="font-weight:600; color:#444;">${tVal(label)}</td>
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
                    reasons.push(tVal(item.name));
                }
            });
        }
        let desc = reasons.length > 0 ? reasons.join('、') : t('manual_default_desc');
        
        html += `
            <tr>
                <td style="font-weight:bold; color:#00285e;">${tVal(c.cat_name)}</td>
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
        const grpName = labelToGroup[m.label] || (m.isManual || hasTgt ? t('full_ungrouped') : null);
        
        if (grpName) {
            const grpMetrics = orderedMetrics.filter(x => {
                const xHasTgt = labelToTargetMap[x.label] && labelToTargetMap[x.label][targetMonth] !== undefined && labelToTargetMap[x.label][targetMonth] !== '';
                return (labelToGroup[x.label] || (x.isManual || xHasTgt ? t('full_ungrouped') : null)) === grpName;
            });
            const size = grpMetrics.length;
            const firstIdx = orderedMetrics.findIndex(x => {
                const xHasTgt = labelToTargetMap[x.label] && labelToTargetMap[x.label][targetMonth] !== undefined && labelToTargetMap[x.label][targetMonth] !== '';
                return (labelToGroup[x.label] || (x.isManual || xHasTgt ? t('full_ungrouped') : null)) === grpName && x.label === grpMetrics[0].label;
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
        <table class="matrix-table" style="font-size:clamp(10px, 0.85vw, 11px); line-height:1.4;">
            <thead>
                <tr>
                    <th style="width:40px; max-width:60px; background:#e8eaf6; color:#283593; white-space:normal; word-wrap:break-word; text-align:center;">${t('full_th_grouping')}</th>
                    <th style="width:40px; max-width:50px; background:#e8eaf6; color:#283593; white-space:normal; word-wrap:break-word; text-align:center;">${t('full_th_total_weight')}</th>
                    <th style="width:100px; max-width:140px; text-align:left; white-space:normal; word-wrap:break-word;">${t('full_th_metric')}</th>
                    <th style="width:40px; text-align:center;">${t('full_th_weight')}</th>
                    <th style="width:75px; text-align:center; white-space:normal; word-wrap:break-word;">${t('full_th_month_target', {month: targetMonth})}</th>
                    <th style="width:75px; background:#fff8e1; border-right:2px solid #ffe082; color:#ef6c00; text-align:center; white-space:normal; word-wrap:break-word;">${t('full_th_global')}</th>
                    ${categories.map(cat => `<th style="text-align:center; width:40px; white-space:normal; word-wrap:break-word;">${escapeHTML(tVal(cat))}</th>`).join('')}
                    ${categories.map(cat => `<th style="background:#e8f5e9; text-align:center; width:40px; white-space:normal; word-wrap:break-word;">${escapeHTML(tVal(cat))}<br>${t('full_th_score')}</th>`).join('')}
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
            matrixHtml += `<td ${row.isGroupStart ? `rowspan="${row.groupSize}"` : `style="display:none;"`} style="max-width:60px; white-space:normal; word-wrap:break-word; text-align:center;">${escapeHTML(tVal(row.groupName) || t('full_ungrouped_short'))}</td>`;
            matrixHtml += `<td ${row.isGroupStart ? `rowspan="${row.groupSize}"` : `style="display:none;"`} style="font-weight:bold; color:#1565c0; text-align:center; max-width:50px;">${row.groupWeight || '-'}</td>`;
        }

        matrixHtml += `
            <td style="text-align:left; font-weight:600; color:#2c3e50; max-width:140px; white-space:normal; word-wrap:break-word;">${escapeHTML(tVal(m.label))}</td>
            <td style="color:#666; font-weight:bold; background:#fafafa; text-align:center;">${weight}</td>
            <td style="color:#0277bd; font-weight:bold; background:#f5f8fa; text-align:center; max-width:75px; white-space:normal; word-wrap:break-word;">${targetStr}</td>
            <td style="background:#fff8e1; border-right:2px solid #ffe082; text-align:center; max-width:75px; white-space:normal; word-wrap:break-word;"><span class="${globalDisplayClass}">${escapeHTML(String(m.value || '--').trim())}</span></td>`;
            
        categories.forEach(cat => {
            const cell = catData[cat].values[m.label];
            if (!cell || cell.raw === '--') {
                matrixHtml += `<td class="val-none" style="text-align:center;">--</td>`;
            } else {
                let displayClass = 'val-none';
                if (m.hasTarget) displayClass = cell.isFailing ? 'val-warn' : 'val-good';
                matrixHtml += `<td style="text-align:center;"><span class="${displayClass}">${escapeHTML(String(cell.raw).trim())}</span></td>`;
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
                const bonusDisplay = cell.bonusScore ? ` <span style="font-size:9px; color:#e65100;">(+${cell.bonusScore.toFixed(2)})</span>` : '';
                matrixHtml += `<td style="font-weight:bold; color:${scoreColor}; background:#f1f8e9; text-align:center;">${earned}${bonusDisplay}</td>`;
            }
        });
        matrixHtml += `</tr>`;
    });
    
    matrixHtml += `</tbody></table></div>`;

    // Adjustments
    const snapAdjustData = snap.manualAdjustData || {};
    let adjustHtml = `
        <div style="background:#fff; overflow-x:auto; margin-top:20px;">
        <h4 style="margin: 0 0 10px 0; color: #555;">${t('full_title')}</h4>
        <table class="matrix-table" style="font-size:clamp(10px, 0.85vw, 11px); line-height:1.4;">
            <thead>
                <tr>
                    <th style="width:40px; text-align:center;">${t('full_th_type')}</th>
                    <th style="text-align:left; max-width:200px; white-space:normal; word-wrap:break-word;">${t('full_th_desc')}</th>
                    <th style="min-width:80px; max-width:120px; white-space:normal; word-wrap:break-word;">${t('full_th_rule')}</th>
                    ${categories.map(cat => `<th style="width:60px; background:#fff3e0; text-align:center;">${escapeHTML(tVal(cat))}<br>${t('full_occurrences')}</th>`).join('')}
                    ${categories.map(cat => `<th style="width:50px; background:#e8f5e9; text-align:center;">${escapeHTML(tVal(cat))}<br>${t('full_adjustments')}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
    `;

    manualAdjustItems.forEach((item, idx) => {
        if (item.deleted) return;
        const typeColor = item.type === '加分' ? '#2e7d32' : '#c62828';
        const typeBg = item.type === '加分' ? '#e8f5e9' : '#ffebee';
        
        let displayDesc = item.desc;
        if (window.currentLang === 'en' && item.unit !== undefined) {
            displayDesc = item.cap ? `${item.unit} pts/time, Cap ${item.cap} pts` : `${item.unit} pts/time, No cap`;
        }

        adjustHtml += `<tr>
            <td style="color:${typeColor}; background:${typeBg}; font-weight:bold; text-align:center;">${escapeHTML(tVal(item.type))}</td>
            <td style="text-align:left; max-width:200px; white-space:normal; word-wrap:break-word;">${escapeHTML(tVal(item.name))}</td>
            <td style="color:#666; max-width:120px; white-space:normal; word-wrap:break-word;">${escapeHTML(displayDesc)}</td>
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
        
        const filterContainer = document.getElementById('date-filter-container');
        if (filterContainer) filterContainer.style.display = 'none';
        
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
        
        if (filterContainer) filterContainer.style.display = 'flex';

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
        
        const filterContainer = document.getElementById('date-filter-container');
        if (filterContainer) filterContainer.style.display = 'none';
        
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
        
        if (filterContainer) filterContainer.style.display = 'flex';

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
