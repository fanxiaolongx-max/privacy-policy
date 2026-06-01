let snapshots = [];
let categories = [];
let globalConfig = { targets: {}, prefs: {} };
let labelToTargetMap = {};
let labelToTargetKeyMap = {};
let currentSnapshot = null;
let standardTotalScore = 0;
let metricGroups = []; // [{id, name, metrics:[label,...]}]
const REPORT_TARGET_MONTH_KEY = 'report_target_month';

function isReportEligibleSnapshot(snapshot) {
    return Array.isArray(snapshot && snapshot.topMetrics) && snapshot.topMetrics.length > 0;
}

let i18nMap = {
    "分组": "Group",
    "总权重": "Total Weight",
    "考核的指标名称": "Assessment Metric Name",
    "权重": "Weight",
    "月目标值": "Target",
    "全局总体达标": "Global Compliance",
    "排名": "Rank",
    "客户群": "Customer Base",
    "标准总分": "Standard Total Score",
    "系统得分": "System Score",
    "预留加减分 (手动)": "Manual Adj.",
    "最终得分": "Final Score",
    "类型": "Type",
    "项目说明": "Item Description",
    "计分规则": "Scoring Rule",
    "操作": "Action",
    "整改完成率": "Rectification Completion Rate",
    "TOPN风险完成率": "TOPN Risk Completion Rate",
    "数字证书消减率": "Digital Certificate Reduction Rate",
    "产品EOS闭环率": "Product EOS Closure Rate",
    "版本EOS闭环率": "Version EOS Closure Rate",
    "重急EOS闭环率": "Critical/Urgent EOS Closure Rate",
    "锂电池整改完成率": "Lithium Battery Rectification Completion Rate",
    "路由器": "Router RC",
    "业务比对回传率": "Business Comparison Return Rate",
    "业务比对备案率": "Business Comparison Filing Rate",
    "日志稽查率": "Log Audit Rate",
    "价值网络巡检完成率": "Value Network Inspection Completion Rate",
    "逃生演练完成率": "Escape Drill Completion Rate",
    "应急演练完成率": "Emergency Drill Completion Rate",
    "拓扑刷新率": "Topology Refresh Rate",
    "预案刷新率": "Contingency Plan Refresh Rate",
    "IBMS刷新率": "IBMS Refresh Rate",
    "月度例会及报告准时完成率": "Monthly Meeting & Report Punctuality Rate",
    "服务专刊季度提交": "Quarterly Service Publication Submission",
    "半年度服务峰会召开": "Semi-Annual Service Summit Holding",
    "Jam客户互动月度发布": "Monthly Jam Customer Interaction Release",
    "L4骨干晋升目标达成": "L4 Backbone Promotion Target Achievement",
    "在职员工平均能力得分": "Avg Competence Score of Active Employees",
    "专家讲座及经验分享": "Expert Lectures & Experience Sharing",
    "项目复盘与外部对标学习": "Project Review & External Benchmarking Study",
    "青年人才辅导培养": "Youth Talent Mentoring & Training",
    "存储整改完成率": "Storage Rectification Completion Rate",
    "软件MM收编率": "Software MM Incorporation Rate",
    "SR FRT率": "SR FRT Rate",
    "高危命令拦截次数": "High-Risk Command Interception Count",
    "GUI拦截次数": "GUI Interception Count",
    "任职率": "Employment Rate",
    "维护红线岗位满足率": "Maintenance Red Line Post Fulfillment Rate",
    "0工单人数": "Zero Work Order Headcount",
    "延期补授权完成率": "Delayed Supplemental Auth Completion Rate",
    "过保订单及SPMS": "Out-of-Warranty Orders & SPMS",
    "维保订单": "Maintenance Orders",
    "业务收入": "Business Revenue",
    "PS GP利润率": "PS GP Margin",
    "TE备件短缺解决方案": "TE Spare Parts Shortage Solution",
    "TE AOS 2.0过保订单": "TE AOS 2.0 Out-of-Warranty Orders",
    "ORG AOS 2.0过保订单": "ORG AOS 2.0 Out-of-Warranty Orders",
    "VDF AOS 2.0过保订单": "VDF AOS 2.0 Out-of-Warranty Orders",
    "ET成本控制(GPR提升10%)": "ET Cost Control (GPR Up 10%)",
    "人为事故 (含整改逾期、错认漏认)": "Human Error Incident (incl. Overdue Rectification, Missed/Wrong Recognition)",
    "恢复超60分钟事故 (华为原因)": ">60min Recovery Incident (Huawei Reason)",
    "严重投诉 (CXO/Operation Head级别)": "Severe Complaint (CXO/Operation Head Level)",
    "严重违规 (瞒报、无方案/越权操作)": "Severe Violation (Concealment, No Plan/Unauthorized Operation)",
    "整改确认及执行逾期": "Overdue Rectification Confirmation & Execution",
    "不合格的关闭整改单 (审计发现)": "Unqualified Closed Rectification Ticket (Audit Finding)",
    "未按要求完成整改 (含延期)": "Incomplete Rectification as Required (incl. Delay)",
    "不规范风险处理 (月度审计)": "Non-standard Risk Handling (Monthly Audit)",
    "风险确认/挂起/关闭逾期": "Overdue Risk Confirmation/Suspension/Closure",
    "FME离职超10天未清理账号": "FME Resigned >10 Days w/o Account Cleanup",
    "WFM无授权违规操作 (未发客户延期邮件)": "WFM Unauthorized Violation (No Customer Delay Email)",
    "WFM操作回退 (代表处服务质量原因)": "WFM Operation Rollback (Rep Office Service Quality Reason)",
    "未按时完成回退复盘 (SLA:10天)": "Overdue Rollback Review (SLA: 10 Days)",
    "ITR-FRT达不到98.5% (按月)": "ITR-FRT <98.5% (Monthly)",
    "跨产品逃生演练及Jam宣传": "Cross-product Escape Drill & Jam Promotion",
    "邀约客户交流呈现服务价值": "Inviting Customers to Communicate & Present Service Value"
};

function getBilingual(text) {
    if (!text) return '';
    const en = i18nMap[text];
    if (en) {
        if (en.includes('<br>')) return en;
        return escapeHTML(text) + '<br><span style="font-size:11px;color:#888;font-weight:normal;">' + escapeHTML(en) + '</span>';
    }
    return escapeHTML(text);
}

function escapeHTML(str) {
    return typeof str === 'string' ? str.replace(/[&<>'"]/g, tag => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'": '&#39;','"':'&quot;'}[tag]||tag)) : str;
}

function getJSONBytes(value) {
    try {
        return new Blob([JSON.stringify(value)]).size;
    } catch (e) {
        return 0;
    }
}

function isReportCompressionSupported() {
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
    const compressedSnapshot = await compressTextToTransportField(JSON.stringify(snapshot), algorithm);
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

function logReportSaveStep(step, detail) {
    const prefix = '%c[Report Save]';
    const style = 'color:#2563eb;font-weight:700;';
    if (detail === undefined) {
        console.info(prefix, style, step);
    } else {
        console.info(prefix, style, step, detail);
    }
}

function logReportSaveError(step, error, detail) {
    const prefix = '%c[Report Save]';
    const style = 'color:#ef4444;font-weight:700;';
    console.error(prefix, style, `${step} failed`, detail || '', error);
}

async function putSnapshotWithCompression(snapshotId, snapshot, reason = 'snapshot-update') {
    const path = `/api/sla/snapshots/${snapshotId}`;
    const stats = {
        reason,
        requestBytes: getJSONBytes(snapshot),
        topMetricCount: Array.isArray(snapshot && snapshot.topMetrics) ? snapshot.topMetrics.length : 0,
        expiringTicketCount: Array.isArray(snapshot && snapshot.expiringTickets) ? snapshot.expiringTickets.length : 0
    };

    try {
        logReportSaveStep('开始写回 SLA 快照', stats);
        return await API.put(path, snapshot);
    } catch (e) {
        logReportSaveError('普通 SLA 快照写回链路', e, stats);
        if (!isReportCompressionSupported()) {
            throw e;
        }

        logReportSaveStep('普通写回失败，开始构建 gzip 压缩重试请求', { reason });
        const compressedBody = await buildCompressedSnapshotBody(snapshot, 'gzip');
        const compressedStats = {
            reason,
            requestBytes: getJSONBytes(compressedBody),
            originalBytes: compressedBody.transport.originalBytes,
            compressedBytes: compressedBody.transport.compressedBytes
        };
        logReportSaveStep('gzip 压缩快照写回请求已构建', compressedStats);
        const result = await API.put(path, compressedBody);
        logReportSaveStep('gzip 压缩快照写回成功', compressedStats);
        return result;
    }
}

const defaultManualAdjustItems = [
    { type: '扣分', name: '人为事故 (含整改逾期、错认漏认)', unit: 10, cap: null, desc: '10分/次, 上限无' },
    { type: '扣分', name: '恢复超60分钟事故 (华为原因)', unit: 5, cap: null, desc: '5分/次, 上限无' },
    { type: '扣分', name: '严重投诉 (CXO/Operation Head级别)', unit: 10, cap: null, desc: '10分/次, 上限无' },
    { type: '扣分', name: '严重违规 (瞒报、无方案/越权操作)', unit: 5, cap: null, desc: '5分/次, 上限无' },
    { type: '扣分', name: '整改确认及执行逾期', unit: 3, cap: 5, desc: '3分/次, 上限5分' },
    { type: '扣分', name: '不合格的关闭整改单 (审计发现)', unit: 3, cap: 5, desc: '3分/次, 上限5分' },
    { type: '扣分', name: '未按要求完成整改 (含延期)', unit: 3, cap: 5, desc: '3分/次, 上限5分' },
    { type: '扣分', name: '不规范风险处理 (月度审计)', unit: 2, cap: 5, desc: '2分/次, 上限5分' },
    { type: '扣分', name: '风险确认/挂起/关闭逾期', unit: 2, cap: 5, desc: '2分/次, 上限5分' },
    { type: '扣分', name: 'FME离职超10天未清理账号', unit: 2, cap: 5, desc: '2分/次, 上限5分' },
    { type: '扣分', name: 'WFM无授权违规操作 (未发客户延期邮件)', unit: 2, cap: 5, desc: '2分/次, 上限5分' },
    { type: '扣分', name: 'WFM操作回退 (代表处服务质量原因)', unit: 3, cap: 5, desc: '3分/次, 上限5分' },
    { type: '扣分', name: '未按时完成回退复盘 (SLA:10天)', unit: 3, cap: 5, desc: '3分/次, 上限5分' },
    { type: '扣分', name: 'ITR-FRT达不到98.5% (按月)', unit: 2, cap: 5, desc: '2分/次, 上限5分' },
    { type: '加分', name: '跨产品逃生演练及Jam宣传', unit: 2, cap: 7, desc: '2分/次, 上限7分' },
    { type: '加分', name: '邀约客户交流呈现服务价值', unit: 2, cap: 10, desc: '2分/次, 上限10分' }
];
let manualAdjustItems = [...defaultManualAdjustItems];

function getTargetMonthDefaultByDay(date = new Date()) {
    const currentMonth = date.getMonth() + 1;
    if (date.getDate() < 10) {
        return currentMonth === 1 ? 12 : currentMonth - 1;
    }
    return currentMonth;
}

function getTodayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDefaultTargetMonth() {
    try {
        const saved = JSON.parse(localStorage.getItem(REPORT_TARGET_MONTH_KEY) || '{}');
        const month = parseInt(saved.month, 10);
        if (saved.date === getTodayKey() && month >= 1 && month <= 12) return month;
    } catch (e) {}
    return getTargetMonthDefaultByDay();
}

function setReportTargetMonth(month) {
    const normalized = parseInt(month, 10);
    if (normalized >= 1 && normalized <= 12) {
        localStorage.setItem(REPORT_TARGET_MONTH_KEY, JSON.stringify({
            month: normalized,
            date: getTodayKey()
        }));
    }
}

function getSnapshotSuggestedTargetMonth(snapshot) {
    const month = parseInt(snapshot && snapshot.selectedTargetMonth, 10);
    return month >= 1 && month <= 12 ? month : null;
}

async function initReport() {
    try {
        const mode = API.getSourceMode('report_sla_data');
        const query = mode === 'auto' ? '' : `?mode=${encodeURIComponent(mode)}`;
        const [snapData, catData, configData, groupData] = await Promise.all([
            API.get(`/api/sla/snapshots${query}`),
            API.get(`/api/sla/categories${query}`),
            API.get(`/api/sla/config${query}`),
            API.get(`/api/sla/groups${query}`)
        ]);
        
        const allSnapshots = snapData || [];
        snapshots = allSnapshots.filter(isReportEligibleSnapshot);
        categories = catData || ['TE', 'ORG', 'ET', 'VDF'];
        globalConfig = configData || { targets: {}, prefs: {} };
        metricGroups = groupData || [];
        
        if (globalConfig.prefs && globalConfig.prefs.manualAdjustItems) {
            manualAdjustItems = globalConfig.prefs.manualAdjustItems;
        } else {
            manualAdjustItems = [...defaultManualAdjustItems];
        }
        
        if (globalConfig.prefs && globalConfig.prefs.i18nMap) {
            // Strip any legacy HTML tags that might have been saved
            const loadedI18n = globalConfig.prefs.i18nMap;
            const cleanI18n = {};
            for (const [k, v] of Object.entries(loadedI18n)) {
                if (v && v.includes('<br>')) {
                    // Extract just the English text if it matches the old format
                    const match = v.match(/<span[^>]*>(.*?)<\/span>/);
                    cleanI18n[k] = match ? match[1] : v.replace(/<[^>]+>/g, '');
                } else {
                    cleanI18n[k] = v;
                }
            }
            i18nMap = { ...i18nMap, ...cleanI18n };
        }
        
        buildLabelTargetMap();
        
        // Populate month selector
        const monthSel = document.getElementById('target-month-select');
        let monthOptions = '';
        for (let i = 1; i <= 12; i++) {
            monthOptions += `<option value="${i}">${i}月份</option>`;
        }
        monthSel.innerHTML = monthOptions;
        monthSel.value = getDefaultTargetMonth();
        monthSel.dataset.userChanged = 'false';
        monthSel.addEventListener('change', () => {
            monthSel.dataset.userChanged = 'true';
        });
        
        const sel = document.getElementById('snapshot-select');
        if (!snapshots.length) {
            sel.innerHTML = '<option value="">暂无快照数据 (No snapshot data)</option>';
            document.getElementById('report-content').innerHTML = '<div class="empty-state"><h3>暂无可入库报表快照 (No report-ready snapshot)</h3><p>当前只有明细/临期类快照，未包含顶部指标数据，不会参与报表看板入库。<br><span style="font-size:12px;color:#888;">Only detail/expiring snapshots were found. They do not contain topMetrics and are excluded from report saving.</span></p></div>';
            if (window.renderReportSourcePanel) window.renderReportSourcePanel();
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
        if (window.renderReportSourcePanel) window.renderReportSourcePanel();
    } catch (e) {
        showToast('加载报表数据失败 (Failed to load report data)', 'error');
        console.error(e);
        if (window.renderReportSourcePanel) window.renderReportSourcePanel();
        document.getElementById('report-content').innerHTML = '<div class="empty-state"><h3>加载失败 (Loading Failed)</h3><p>请检查后端服务是否正常运行。<br><span style="font-size:12px;color:#888;">Please check if the backend service is running normally.</span></p></div>';
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
        const monthSel = document.getElementById('target-month-select');
        if (monthSel && monthSel.dataset.userChanged !== 'true') {
            monthSel.value = getSnapshotSuggestedTargetMonth(currentSnapshot) || getDefaultTargetMonth();
        }
        renderReport(currentSnapshot);
    }
};

window.renderCurrentSnapshot = function() {
    const monthSel = document.getElementById('target-month-select');
    if (monthSel) setReportTargetMonth(monthSel.value);
    if (currentSnapshot) {
        renderReport(currentSnapshot);
    }
};

function parseNum(str) {
    if (str === undefined || str === null || str === '--') return NaN;
    const n = parseFloat(String(str).replace(/[^0-9.-]/g, ''));
    return isNaN(n) ? NaN : n;
}

function hasUsableMetricValue(metric) {
    if (!metric) return false;
    const hasGlobal = metric.value !== undefined && metric.value !== null && String(metric.value).trim() !== '' && String(metric.value).trim() !== '--';
    const hasSubs = Array.isArray(metric.subMetrics) && metric.subMetrics.some(sm => {
        return sm && sm.value !== undefined && sm.value !== null && String(sm.value).trim() !== '' && String(sm.value).trim() !== '--';
    });
    return hasGlobal || hasSubs;
}

function formatSnapshotTime(snapshot) {
    const d = new Date(snapshot && snapshot.timestamp);
    if (Number.isNaN(d.getTime())) return snapshot && snapshot.id ? `快照 ${snapshot.id}` : '未知快照';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function findLatestMetricSnapshotBefore(currentSnap, label) {
    const snapIdx = snapshots.findIndex(s => s.id === currentSnap.id);
    if (snapIdx < 0) return null;

    for (let i = snapIdx + 1; i < snapshots.length; i++) {
        const sourceSnap = snapshots[i];
        const sourceMetric = (sourceSnap.topMetrics || []).find(m => m.label === label);
        if (hasUsableMetricValue(sourceMetric)) {
            return {
                snapshot: sourceSnap,
                metric: sourceMetric,
                sourceText: formatSnapshotTime(sourceSnap)
            };
        }
    }
    return null;
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
                
                let valToUse = '--';
                let subsToUse = [];
                let autoFillSource = null;
                
                if (globalConfig.targets[k].autoFill) {
                    const source = findLatestMetricSnapshotBefore(snap, label);
                    if (source) {
                        valToUse = source.metric.value || '--';
                        if (source.metric.subMetrics) {
                            subsToUse = JSON.parse(JSON.stringify(source.metric.subMetrics));
                        }
                        autoFillSource = {
                            snapshotId: source.snapshot.id,
                            timestamp: source.snapshot.timestamp,
                            label: source.sourceText
                        };
                    }
                }
                
                if (!exists) {
                    const newMetric = {
                        id: `manual_m_${Date.now()}_${Math.random()}`,
                        colX: "手动指标",
                        valY: "总计",
                        colZ: "手动指标",
                        label: label,
                        value: valToUse,
                        subMetrics: subsToUse,
                        isManual: true,
                        autoFillSource
                    };
                    metricCols.push(newMetric);
                    if (globalConfig.targets[k].autoFill) {
                        if (!currentSnapshot.topMetrics) currentSnapshot.topMetrics = [];
                        currentSnapshot.topMetrics.push(newMetric);
                        putSnapshotWithCompression(currentSnapshot.id, currentSnapshot, 'auto-fill-new-metric').catch(e => console.error('Auto-fill save error:', e));
                    }
                } else {
                    exists.isManual = true;
                    if (globalConfig.targets[k].autoFill) {
                        let changed = false;
                        if (!exists.value || exists.value === '--') { exists.value = valToUse; changed = true; }
                        if (!exists.subMetrics || exists.subMetrics.length === 0) { exists.subMetrics = subsToUse; changed = true; }
                        if (autoFillSource && (!exists.autoFillSource || exists.autoFillSource.snapshotId !== autoFillSource.snapshotId)) {
                            exists.autoFillSource = autoFillSource;
                            changed = true;
                        }
                        
                        if (changed) {
                            if (!currentSnapshot.topMetrics) currentSnapshot.topMetrics = [];
                            const realExists = currentSnapshot.topMetrics.find(m => m.label === label);
                            if (realExists) {
                                realExists.value = exists.value;
                                realExists.subMetrics = exists.subMetrics;
                                realExists.autoFillSource = exists.autoFillSource;
                            } else {
                                currentSnapshot.topMetrics.push(exists);
                            }
                            putSnapshotWithCompression(currentSnapshot.id, currentSnapshot, 'auto-fill-existing-metric').catch(e => console.error('Auto-fill save error:', e));
                        }
                    }
                }
            }
        });
    }
    
    if (metricCols.length === 0) {
        content.innerHTML = '<div class="empty-state"><h3>该快照无维度数据 (No dimension data in this snapshot)</h3><p>请在此快照生成前，配置相关的统计指标。<br><span style="font-size:12px;color:#888;">Please configure related metrics before generating this snapshot.</span></p></div>';
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
        m.hasTarget = targetData && targetData[targetMonth] !== undefined && targetData[targetMonth] !== '' && weight > 0;
        
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
            let bonusScore = 0;
            
            if (!isNaN(valNum)) {
                if (m.hasTarget) {
                    catData[sm.category].validWeightSum += weight;
                    
                    const targetNum = parseFloat(targetData[targetMonth]);
                    const condition = targetData.type || 'gte';
                    const isPercent = String(sm.value).includes('%');
                    
                    if (condition === 'gte' && valNum < targetNum) {
                        isFailing = true;
                        gapStr = +(targetNum - valNum).toFixed(2) + (isPercent ? '%' : '');
                    } else if (condition === 'lte' && valNum > targetNum) {
                        isFailing = true;
                        gapStr = +(valNum - targetNum).toFixed(2) + (isPercent ? '%' : '');
                    } else if (targetData.exceedBy > 0 && targetData.bonus > 0) {
                        if (condition === 'gte' && valNum > targetNum) {
                            bonusScore = Math.floor((valNum - targetNum) / targetData.exceedBy) * targetData.bonus;
                        } else if (condition === 'lte' && valNum < targetNum) {
                            bonusScore = Math.floor((targetNum - valNum) / targetData.exceedBy) * targetData.bonus;
                        }
                    }
                    
                    if (!isFailing) {
                        catData[sm.category].earnedScore += weight + bonusScore;
                    }
                }
            }
            
            catData[sm.category].values[m.label] = { raw: sm.value, num: valNum, isFailing: isFailing, gapStr: gapStr, bonusScore: bonusScore || 0 };
        });
    });

    // ── Arrange metricCols by group order ──────────────────────────────
    // Build a lookup: label -> group name (or null)
    const labelToGroup = {};
    const groupWeightMap = {};
    metricGroups.forEach(g => {
        let sumWeight = 0;
        (g.metrics || []).forEach(label => { 
            labelToGroup[label] = g.name; 
            const targetData = labelToTargetMap[label];
            sumWeight += (targetData && targetData.weight !== undefined) ? parseFloat(targetData.weight) : 1;
        });
        groupWeightMap[g.name] = sumWeight;
    });

    // Build ordered list: grouped metrics first (in group order, then metric order), then ungrouped
    const orderedMetrics = [];
    metricGroups.forEach(g => {
        (g.metrics || []).forEach(label => {
            const m = metricCols.find(x => x.label === label);
            if (m) orderedMetrics.push(m);
        });
    });
    // Append ungrouped
    metricCols.forEach(m => {
        if (!labelToGroup[m.label]) orderedMetrics.push(m);
    });

    window._currentGroupWeightMap = groupWeightMap;
    window._currentLabelToGroup = labelToGroup;

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

    const hasGroups = metricGroups.length > 0;

    // Generate Matrix Table
    let matrixHtml = `
        <div class="card" id="matrix-card">
            <h3 class="card-title" style="display:flex; justify-content:space-between; align-items:center;">
                <span>🧩 客户群短板透视矩阵 (Customer Base Shortcoming Matrix)</span>
                <button onclick="toggleMatrixFullscreen()" style="padding:4px 10px; font-size:12px; background:#f0f4f8; border:1px solid #cbd5e1; border-radius:4px; cursor:pointer; color:#334155; display:flex; align-items:center; gap:4px; font-weight:normal;" title="全屏查看表格 (Fullscreen)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
                    全屏显示 (Fullscreen)
                </button>
            </h3>
            <div class="matrix-container" style="background:#fff; height:100%;">
            <table class="matrix-table" id="main-matrix-table">
                <thead>
                    <tr>
                        ${hasGroups ? `<th style="min-width:40px; max-width:60px; white-space:normal; position:sticky; top:0; z-index:11; background:#e8eaf6; color:#283593;">${getBilingual('分组')}</th>
                                       <th style="min-width:40px; position:sticky; top:0; z-index:11; background:#e8eaf6; color:#283593;" title="分组内所有指标权重之和">${getBilingual('总权重')}</th>` : ''}
                        <th style="min-width:180px; text-align:left;">${getBilingual('考核的指标名称')}</th>
                        <th style="min-width:60px;">${getBilingual('权重')}</th>
                        <th style="min-width:100px;">${targetMonth}月目标值<br><span style="font-size:10px;color:#666;font-weight:normal;">Target</span></th>
                        <th style="min-width:100px; background:#fff8e1; border-right:2px solid #ffe082; color:#ef6c00;">${getBilingual('全局总体达标')}</th>
                        ${categories.map(cat => `<th>${escapeHTML(cat)}</th>`).join('')}
                        ${categories.map(cat => `<th style="background:#e8f5e9;">${escapeHTML(cat)}得分<br><span style="font-size:10px;color:#666;font-weight:normal;">Score</span></th>`).join('')}
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
                    isGlobalFailing = true;
                    globalGapStr = +(targetNum - globalValNum).toFixed(2) + (isPercent ? '%' : '');
                } else if (condition === 'lte' && globalValNum > targetNum) {
                    isGlobalFailing = true;
                    globalGapStr = +(globalValNum - targetNum).toFixed(2) + (isPercent ? '%' : '');
                }
            }
        }
        
        let globalDisplayClass = 'val-none';
        let globalTitleAttr = '';
        if (m.hasTarget) {
            globalDisplayClass = isGlobalFailing ? 'val-warn' : 'val-good';
            globalTitleAttr = isGlobalFailing ? ` title="整体不达标，距离目标差 ${globalGapStr}"` : '';
        }
        let autoFillBtn = '';
        if (m.isManual) {
            const targetData = labelToTargetMap[m.label] || {};
            const isAuto = !!targetData.autoFill;
            const autoColor = isAuto ? '#0288d1' : '#9e9e9e';
            const autoBg = isAuto ? '#e1f5fe' : '#f5f5f5';
            const autoBorder = isAuto ? '#81d4fa' : '#e0e0e0';
            const sourceText = m.autoFillSource && m.autoFillSource.label ? ` · 来源: ${m.autoFillSource.label}` : '';
            const autoText = isAuto ? `🔄 自动填报: 已开${sourceText}` : '🔄 自动填报: 未开';
            const autoTitle = isAuto && sourceText ? `自动填报跨快照获取数据源：${m.autoFillSource.label}` : '点击切换自动填报';
            autoFillBtn = `<span style="cursor:pointer; margin-left:6px; font-size:12px; color:${autoColor}; background:${autoBg}; padding:2px 6px; border-radius:4px; border:1px solid ${autoBorder};" title="${escapeHTML(autoTitle)}" onclick="toggleAutoFill('${escapeHTML(m.label)}')">${escapeHTML(autoText)}</span>`;
        }
        const editBtn = m.isManual ? `<span style="cursor:pointer; margin-left:6px; font-size:12px; color:#2e7d32; background:#e8f5e9; padding:2px 6px; border-radius:4px; border:1px solid #c8e6c9;" onclick="editManualMetric('${escapeHTML(m.label)}')">✏️ 填报 (Fill)</span>${autoFillBtn}` : '';

        matrixHtml += `<tr class="matrix-data-row" data-group="${escapeHTML(row.groupName || '未分组')}">`;

        let colIdx = 0;
        
        // Group column
        if (hasGroups) {
            matrixHtml += `<td class="matrix-group-cell" data-col="${colIdx++}" ${row.isGroupStart ? `rowspan="${row.groupSize}"` : `style="display:none;"`}>${getBilingual(row.groupName || '未分组')}</td>`;
            matrixHtml += `<td class="matrix-group-cell" data-col="${colIdx++}" ${row.isGroupStart ? `rowspan="${row.groupSize}"` : `style="display:none;"`} style="font-weight:bold; color:#1565c0;">${row.groupWeight || '-'}</td>`;
        }

        matrixHtml += `
            <td data-col="${colIdx++}" style="text-align:left; font-weight:600; color:#2c3e50;">
                <div style="display:flex; align-items:center;">
                    <span>${getBilingual(m.label)}</span>${editBtn}
                </div>
            </td>
            <td data-col="${colIdx++}" style="color:#666; font-weight:bold; background:#fafafa;">${weight}</td>
            <td data-col="${colIdx++}" style="color:#0277bd; font-weight:bold; background:#f5f8fa;">${targetStr}</td>
            <td data-col="${colIdx++}" style="background:#fff8e1; border-right:2px solid #ffe082;"><span class="${globalDisplayClass}"${globalTitleAttr}>${escapeHTML(String(m.value || '--'))}</span></td>`;
            
        categories.forEach(cat => {
            const cell = catData[cat].values[m.label];
            if (!cell || cell.raw === '--') {
                matrixHtml += `<td data-col="${colIdx++}" class="val-none">--</td>`;
            } else {
                let displayClass = 'val-none';
                let titleAttr = '';
                if (m.hasTarget) {
                    displayClass = cell.isFailing ? 'val-warn' : 'val-good';
                    titleAttr = cell.isFailing ? ` title="不达标，距离目标差 ${cell.gapStr}"` : ` title="达标"`;
                }
                matrixHtml += `<td data-col="${colIdx++}"><span class="${displayClass}"${titleAttr}>${escapeHTML(cell.raw)}</span></td>`;
            }
        });
        
        categories.forEach(cat => {
            const cell = catData[cat].values[m.label];
            if (!cell || cell.raw === '--') {
                matrixHtml += `<td data-col="${colIdx++}" class="val-none" style="background:#f1f8e9;">--</td>`;
            } else if (!m.hasTarget) {
                matrixHtml += `<td data-col="${colIdx++}" class="val-none" style="background:#f1f8e9;" title="未配置目标值或权重为0，不计分">--</td>`;
            } else {
                const earned = cell.isFailing ? 0 : (weight + (cell.bonusScore || 0));
                const scoreColor = cell.isFailing ? '#d32f2f' : '#2e7d32';
                const bonusDisplay = cell.bonusScore ? ` <span style="font-size:10px; color:#e65100;">(+${cell.bonusScore.toFixed(2)})</span>` : '';
                matrixHtml += `<td data-col="${colIdx++}" style="font-weight:bold; color:${scoreColor}; background:#f1f8e9;" title="基础分: ${weight}, 超额奖励: ${cell.bonusScore||0}">${earned}${bonusDisplay}</td>`;
            }
        });
        
        matrixHtml += `</tr>`;
    });
    
    matrixHtml += `
                </tbody>
            </table>
            </div>
            <div style="margin-top:12px; font-size:12px; color:#888;">
                * 自动打分逻辑 (Scoring Logic)：<strong>客户群总分 / 涉及到的指标有效权重之和 × 标准总分</strong>。若某客户群数据为空，则不计入该指标权重。<br>
                <span style="font-size:11px;color:#aaa;">* Auto-scoring Logic: <strong>Customer Base Total Score / Sum of Valid Weights × Standard Total Score</strong>. If data is empty, weight is omitted.</span>
            </div>
        </div>
    `;

    // Generate Ranking Table
    let rankingHtml = `
        <div class="card">
            <h3 class="card-title" style="color:#0277bd;"><span>🏇 “赛马”排行 (Horse Racing Ranking)</span> <span style="font-size:12px; font-weight:normal; color:#888; margin-left:10px;">(支持预留手动调整机制)</span></h3>
            <table class="ranking-table">
                <thead>
                    <tr>
                        <th style="width:60px;">${getBilingual('排名')}</th>
                        <th style="text-align:left;">${getBilingual('客户群')}</th>
                        <th>${getBilingual('标准总分')}</th>
                        <th>${getBilingual('系统得分')}</th>
                        <th>${getBilingual('预留加减分 (手动)')}</th>
                        <th>${getBilingual('最终得分')}</th>
                    </tr>
                </thead>
                <tbody id="ranking-tbody">
                </tbody>
            </table>
        </div>
    `;

    // Generate Manual Adjustments Table
    let adjustHtml = `
        <div class="card" id="adjust-card" style="margin-top:20px; margin-bottom:20px;">
            <h3 class="card-title" style="display:flex; justify-content:space-between; align-items:center;">
                <span style="color:#e65100;">⚖️ 手动加减分项目配置 (Manual Adjustment Config)</span>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:12px; font-weight:normal; color:#888; background:#f5f5f5; padding:4px 8px; border-radius:4px;">✨ 修改后自动保存到当前快照</span>
                    <button onclick="openAddAdjustModal()" style="padding:4px 10px; font-size:12px; background:#e8f5e9; border:1px solid #c8e6c9; border-radius:4px; cursor:pointer; color:#2e7d32; display:flex; align-items:center; gap:4px; font-weight:normal;" title="新增自定义加减分项 (Add Custom Adj. Item)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        新增加减分项 (Add Adj. Item)
                    </button>
                    <button onclick="toggleAdjustFullscreen()" style="padding:4px 10px; font-size:12px; background:#f0f4f8; border:1px solid #cbd5e1; border-radius:4px; cursor:pointer; color:#334155; display:flex; align-items:center; gap:4px; font-weight:normal;" title="全屏查看表格 (Fullscreen)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
                        全屏显示 (Fullscreen)
                    </button>
                </div>
            </h3>
            <div class="matrix-container" style="background:#fff;">
            <table class="matrix-table" style="font-size:12px;">
                <thead>
                    <tr>
                        <th style="min-width:60px;">${getBilingual('类型')}</th>
                        <th style="text-align:left;">${getBilingual('项目说明')}</th>
                        <th style="min-width:120px;">${getBilingual('计分规则')}</th>
                        ${categories.map(cat => `<th style="width:80px; background:#fff3e0;">${escapeHTML(cat)} (发生次数)<br><span style="font-size:10px;color:#666;font-weight:normal;">Occurrences</span></th>`).join('')}
                        ${categories.map(cat => `<th style="width:70px; background:#e8f5e9;">${escapeHTML(cat)} (加减分)<br><span style="font-size:10px;color:#666;font-weight:normal;">Adj. Score</span></th>`).join('')}
                        <th style="width:60px;">${getBilingual('操作')}</th>
                    </tr>
                </thead>
                <tbody>
    `;

    const snapAdjustData = currentSnapshot.manualAdjustData || {};
    
    manualAdjustItems.forEach((item, idx) => {
        if (item.deleted) return;
        
        const typeColor = item.type === '加分' ? '#2e7d32' : '#c62828';
        const typeBg = item.type === '加分' ? '#e8f5e9' : '#ffebee';
        adjustHtml += `<tr>
            <td style="color:${typeColor}; background:${typeBg}; font-weight:bold; text-align:center;">${getBilingual(item.type)}</td>
            <td style="text-align:left;">${getBilingual(item.name)}</td>
            <td style="color:#666;">${escapeHTML(item.desc)}</td>
        `;
        
        // Input fields for occurrences
        categories.forEach(cat => {
            const val = (snapAdjustData[cat] && snapAdjustData[cat][idx]) || '';
            adjustHtml += `<td><input type="number" class="manual-adjust-input" data-cat="${escapeHTML(cat)}" data-idx="${idx}" value="${val}" min="0" step="1" onchange="calculateManualAdjustments(); saveManualAdjustData(true);" style="width:100%; text-align:center; border:1px solid #ddd; padding:4px; border-radius:3px;"></td>`;
        });
        
        // Computed scores fields
        categories.forEach(cat => {
            adjustHtml += `<td id="adjust-score-${escapeHTML(cat)}-${idx}" style="font-weight:bold; text-align:center;">0</td>`;
        });
        
        adjustHtml += `
            <td style="text-align:center;">
                <button onclick="deleteAdjustItem(${idx})" style="background:none; border:none; cursor:pointer; font-size:16px; opacity:0.6; padding:4px;" title="删除此项" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'">🗑️</button>
            </td>
        </tr>`;
    });
    
    adjustHtml += `
                </tbody>
            </table>
            </div>
            <div style="margin-top:8px; font-size:12px; color:#888;">
                * 填入发生次数后，系统会自动计算分值并汇总到上方赛马排行的“预留加减分”中。每一次修改都会自动静默保存至当前快照。<br>
                <span style="font-size:11px;color:#aaa;">* After entering occurrences, the system auto-calculates scores and adds them to the "Manual Adj." in the ranking. Changes are auto-saved to the snapshot.</span>
            </div>
        </div>
    `;

    let rulesHtml = `
        <div class="card" style="margin-top:20px; margin-bottom:40px; background:#f8fbff; border:1px solid #bbdefb; box-shadow:0 2px 8px rgba(21,101,192,0.05);">
            <h3 class="card-title" style="color:#0277bd; font-size:15px; border-bottom:1px solid #bbdefb; padding-bottom:10px; margin-bottom:12px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:text-bottom; margin-right:6px;"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>
                计分规则与排位说明 (Scoring Rules and Ranking Explanation)
            </h3>
            <div style="font-size:13px; color:#455a64; line-height:1.8;">
                <p style="margin:0 0 8px;"><strong>1. 标准总分基准 (Standard Total Score Baseline)：</strong>标准总分为当前左侧或后台配置中所有<span style="color:#0277bd; font-weight:bold;">权重＞0</span>的考核指标之和。该总分是各大区排名的公共基准，不受任何客户群是否缺考影响。<br><span style="font-size:12px;color:#888;">The Standard Total Score is the sum of all assessment metrics with a <span style="color:#0277bd; font-weight:bold;">weight > 0</span>. This total score is the public baseline for ranking all regions and is not affected by whether any customer base misses an assessment.</span></p>
                <p style="margin:0 0 8px;"><strong>2. 考核免除机制 (Assessment Exemption Mechanism)：</strong>当某一指标在本月<span style="color:#d32f2f;">未配置明确目标值</span>，或该大区/客户群在某指标上<span style="color:#d32f2f;">暂无数据（显示为 --）</span>时，该指标将触发免除机制。<span style="color:#e65100; background:#fff3e0; padding:2px 4px; border-radius:3px;">免除指标不会扣分，也不计入该客户群的考核满权基数。</span><br><span style="font-size:12px;color:#888;">When a metric has <span style="color:#d32f2f;">no clear target value configured</span> this month, or the region/customer base has <span style="color:#d32f2f;">no data (shown as --)</span>, the exemption mechanism is triggered. <span style="color:#e65100; background:#fff3e0; padding:2px 4px; border-radius:3px;">Exempt metrics will not deduct points, nor will they be included in the full weight base.</span></span></p>
                <p style="margin:0 0 8px;"><strong>3. 动态折算算法（系统得分） (Dynamic Conversion Algorithm - System Score)：</strong>为了确保公平，大区最终系统得分 = <strong>( 实际达标获得的权重 / 实际参与考核的有效满权 ) × 标准总分</strong>。这意味着即使大区免考了部分指标，只要在它实际参与的指标上100%达标，它依然可以折算拿到满分。<br><span style="font-size:12px;color:#888;">To ensure fairness, the final System Score = <strong>( Actual Weights Gained / Valid Full Weights Participated ) × Standard Total Score</strong>. This means even if a region is exempt from some metrics, it can still get a full score if it reaches 100% compliance on the metrics it actually participated in.</span></p>
                <p style="margin:0 0 8px;"><strong>4. 预留加减分机制 (Reserved Manual Adjustment Mechanism)：</strong>上方看板的【最终得分】= 【系统得分】+【预留加减分】。这部分主要涵盖非自动化专项奖惩（如维保、退网、重点项目攻坚等）。相关人工配置可通过上方“手动加减分项目配置”表进行设置并自动存入快照。<br><span style="font-size:12px;color:#888;">【Final Score】 = 【System Score】 + 【Manual Adj.】. This part covers non-automated special rewards and punishments. Manual configurations can be set in the "Manual Adjustment Config" table above and are automatically saved to the snapshot.</span></p>
                <p style="margin:0;"><strong>5. 动态汇总分析 (Dynamic Summary Analysis)：</strong>“客户群短板透视矩阵”最下方的汇总行，会智能跟随你的表头下拉过滤条件，自动排雷（跳过免考项）并实时求和有效权重与得分，方便进行透视复盘。<br><span style="font-size:12px;color:#888;">The summary row at the bottom of the "Shortcoming Matrix" intelligently follows the header dropdown filters, automatically skipping exempt items, and calculates the sum of valid weights and scores in real-time.</span></p>
            </div>
        </div>
    `;

    content.innerHTML = rankingHtml + matrixHtml + adjustHtml + rulesHtml;
    window._currentCatData = catData;
    window._currentOrderedMetrics = orderedMetrics;
    
    // Setup matrix filters
    setupMatrixFilters();
    
    // We must call calculateManualAdjustments first so the sum goes into ranking
    setTimeout(calculateManualAdjustments, 0);
}

window.setupMatrixFilters = function() {
    const table = document.getElementById('main-matrix-table');
    if (!table) return;
    
    const thead = table.querySelector('thead');
    const headerCells = thead.querySelectorAll('tr:first-child th');
    
    // Remove existing if any
    const existing = thead.querySelector('.matrix-filter-row');
    if (existing) existing.remove();
    
    const filterRow = document.createElement('tr');
    filterRow.className = 'matrix-filter-row';
    
    // Calculate the dynamic height of the bilingual header row
    const firstRowHeight = thead.querySelector('tr:first-child').offsetHeight || 45;
    
    headerCells.forEach((th, colIdx) => {
        const filterTh = document.createElement('th');
        filterTh.style.padding = '4px';
        filterTh.style.background = '#f1f5f9';
        filterTh.style.position = 'sticky';
        filterTh.style.top = firstRowHeight + 'px';
        filterTh.style.zIndex = '20';
        filterTh.style.borderBottom = '1px solid #cbd5e1';
        
        filterTh.innerHTML = `
            <div class="custom-ms" data-col="${colIdx}" style="position:relative; width:100%; text-align:left; font-weight:normal;">
                <div class="ms-btn" onclick="toggleMsDropdown(${colIdx}, event)" style="background:#fff; border:1px solid #cbd5e1; border-radius:3px; padding:2px 4px; font-size:11px; cursor:pointer; min-height:16px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; justify-content:space-between; align-items:center;" title="全部">
                    <span class="ms-text">全部</span>
                    <span style="font-size:8px; color:#888;">▼</span>
                </div>
                <div class="ms-dropdown" id="ms-dropdown-${colIdx}" style="display:none; position:absolute; top:100%; left:0; min-width:120px; background:#fff; border:1px solid #ccc; box-shadow:0 4px 6px rgba(0,0,0,0.1); z-index:9999; max-height:250px; overflow-y:auto; padding:6px; border-radius:4px;">
                    <label style="display:block; margin-bottom:4px; font-weight:bold; cursor:pointer; border-bottom:1px solid #eee; padding-bottom:6px; font-size:11px;">
                        <input type="checkbox" class="ms-all-cb" checked onchange="msSelectAll(${colIdx}, this.checked)"> (全选)
                    </label>
                    <div class="ms-options-container"></div>
                </div>
            </div>
        `;
        
        filterRow.appendChild(filterTh);
    });
    
    thead.appendChild(filterRow);
    
    // Global click listener to close dropdowns
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.custom-ms')) {
            document.querySelectorAll('.ms-dropdown').forEach(d => {
                d.style.display = 'none';
                if (d.closest('th')) d.closest('th').style.zIndex = '20';
            });
        }
    });
    
    populateFilterOptions();
    
    // Initialize summary row immediately
    if (typeof updateMatrixSummary === 'function') {
        updateMatrixSummary();
    }
};

window.toggleMsDropdown = function(colIdx, e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById(`ms-dropdown-${colIdx}`);
    const isVisible = dropdown.style.display === 'block';
    
    // Close all
    document.querySelectorAll('.ms-dropdown').forEach(d => {
        d.style.display = 'none';
        if (d.closest('th')) d.closest('th').style.zIndex = '20';
    });
    
    if (!isVisible) {
        dropdown.style.display = 'block';
        if (dropdown.closest('th')) dropdown.closest('th').style.zIndex = '30';
    }
};

window.populateFilterOptions = function() {
    const table = document.getElementById('main-matrix-table');
    const msContainers = table.querySelectorAll('.custom-ms');
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr.matrix-data-row'));
    
    msContainers.forEach(container => {
        const colIdx = parseInt(container.getAttribute('data-col'));
        const uniqueValues = new Set();
        
        rows.forEach(row => {
            const cell = row.querySelector(`td[data-col="${colIdx}"]`);
            if (cell) {
                let val = cell.innerText.trim().replace(/✏️[\s\S]*$/, '').trim();
                if (val) uniqueValues.add(val);
            }
        });
        
        const sorted = Array.from(uniqueValues).sort();
        const optContainer = container.querySelector('.ms-options-container');
        optContainer.innerHTML = '';
        
        sorted.forEach(val => {
            const label = document.createElement('label');
            label.style.display = 'block';
            label.style.padding = '3px 0';
            label.style.fontSize = '11px';
            label.style.cursor = 'pointer';
            label.style.whiteSpace = 'nowrap';
            
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = true;
            cb.value = val;
            cb.className = 'ms-opt-cb';
            cb.onchange = () => msCheckboxChange(colIdx);
            
            label.appendChild(cb);
            label.appendChild(document.createTextNode(' ' + val));
            optContainer.appendChild(label);
        });
    });
};

window.msSelectAll = function(colIdx, isChecked) {
    const container = document.querySelector(`.custom-ms[data-col="${colIdx}"]`);
    const cbs = container.querySelectorAll('.ms-opt-cb');
    cbs.forEach(cb => cb.checked = isChecked);
    updateMsBtnText(colIdx);
    filterMatrix();
};

window.msCheckboxChange = function(colIdx) {
    const container = document.querySelector(`.custom-ms[data-col="${colIdx}"]`);
    const cbs = container.querySelectorAll('.ms-opt-cb');
    const allCb = container.querySelector('.ms-all-cb');
    
    const allChecked = Array.from(cbs).every(cb => cb.checked);
    allCb.checked = allChecked;
    
    updateMsBtnText(colIdx);
    filterMatrix();
};

window.updateMsBtnText = function(colIdx) {
    const container = document.querySelector(`.custom-ms[data-col="${colIdx}"]`);
    const cbs = container.querySelectorAll('.ms-opt-cb');
    const checked = Array.from(cbs).filter(cb => cb.checked);
    
    const btnText = container.querySelector('.ms-text');
    if (checked.length === cbs.length) {
        btnText.innerText = '全部';
        btnText.parentElement.title = '全部';
    } else if (checked.length === 0) {
        btnText.innerText = '无';
        btnText.parentElement.title = '无';
    } else if (checked.length === 1) {
        btnText.innerText = checked[0].value;
        btnText.parentElement.title = checked[0].value;
    } else {
        btnText.innerText = `已选 ${checked.length} 项`;
        btnText.parentElement.title = checked.map(c => c.value).join(', ');
    }
};

window.filterMatrix = function() {
    const table = document.getElementById('main-matrix-table');
    const msContainers = Array.from(table.querySelectorAll('.custom-ms'));
    
    // Build filters map: colIdx -> set of allowed values
    const filters = {};
    msContainers.forEach(container => {
        const colIdx = parseInt(container.getAttribute('data-col'));
        const allCb = container.querySelector('.ms-all-cb');
        if (!allCb.checked) {
            const checkedVals = Array.from(container.querySelectorAll('.ms-opt-cb:checked')).map(cb => cb.value);
            filters[colIdx] = new Set(checkedVals);
        }
    });
    
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr.matrix-data-row'));
    
    rows.forEach(row => {
        let match = true;
        for (let colIdx in filters) {
            const allowedSet = filters[colIdx];
            const cell = row.querySelector(`td[data-col="${colIdx}"]`);
            if (cell) {
                let text = cell.innerText.trim().replace(/✏️[\s\S]*$/, '').trim();
                if (!allowedSet.has(text)) {
                    match = false;
                    break;
                }
            } else {
                match = false; break;
            }
        }
        row.style.display = match ? '' : 'none';
    });
    
    // Fix rowspans
    const groups = {}; 
    rows.forEach(row => {
        const groupName = row.getAttribute('data-group');
        if (groupName) {
            if (!groups[groupName]) groups[groupName] = [];
            if (row.style.display !== 'none') groups[groupName].push(row);
        }
    });
    
    Object.keys(groups).forEach(gName => {
        const visibleRows = groups[gName];
        rows.forEach(row => {
            if (row.getAttribute('data-group') === gName) {
                const grpCell1 = row.querySelector('td[data-col="0"]');
                const grpCell2 = row.querySelector('td[data-col="1"]');
                if (grpCell1) grpCell1.style.display = 'none';
                if (grpCell2) grpCell2.style.display = 'none';
            }
        });
        
        if (visibleRows.length > 0) {
            const firstRow = visibleRows[0];
            const grpCell1 = firstRow.querySelector('td[data-col="0"]');
            const grpCell2 = firstRow.querySelector('td[data-col="1"]');
            if (grpCell1) {
                grpCell1.style.display = '';
                grpCell1.rowSpan = visibleRows.length;
            }
            if (grpCell2) {
                grpCell2.style.display = '';
                grpCell2.rowSpan = visibleRows.length;
            }
        }
    });
    
    // Update summary row
    updateMatrixSummary();
};

window.updateMatrixSummary = function() {
    const table = document.getElementById('main-matrix-table');
    if (!table) return;
    
    let summaryRow = table.querySelector('.matrix-summary-row');
    if (!summaryRow) {
        summaryRow = document.createElement('tr');
        summaryRow.className = 'matrix-summary-row';
        summaryRow.style.background = '#e8eaf6';
        summaryRow.style.fontWeight = 'bold';
        summaryRow.style.position = 'sticky';
        summaryRow.style.bottom = '0';
        summaryRow.style.zIndex = '12';
        summaryRow.style.boxShadow = '0 -2px 10px rgba(0,0,0,0.1)';
        table.querySelector('tbody').appendChild(summaryRow);
    }
    
    const rows = Array.from(table.querySelectorAll('tbody tr.matrix-data-row'));
    const visibleRows = rows.filter(r => r.style.display !== 'none');
    
    const sums = {};
    visibleRows.forEach(row => {
        const cells = row.querySelectorAll('td[data-col]');
        cells.forEach(cell => {
            const col = cell.getAttribute('data-col');
            if (cell.classList.contains('val-none')) return;
            const text = cell.innerText.trim();
            if (text === '--') return;
            
            const val = parseFloat(text);
            if (!isNaN(val)) {
                if (!sums[col]) sums[col] = 0;
                sums[col] += val;
            }
        });
    });
    
    const headerCells = table.querySelectorAll('thead tr:first-child th');
    let html = '';
    headerCells.forEach((th, colIdx) => {
        const headerText = th.innerText.trim();
        if (headerText.includes('考核的指标名称')) {
            html += `<td style="text-align:right; color:#283593; padding:8px;">当前筛选汇总：</td>`;
        } else if (headerText === '权重' || headerText.includes('得分')) {
            let sumVal = sums[colIdx] !== undefined ? sums[colIdx] : 0;
            sumVal = Math.round(sumVal * 100) / 100;
            html += `<td style="color:#c62828; padding:8px;">${sumVal}</td>`;
        } else {
            html += `<td style="color:#aaa; padding:8px;">-</td>`;
        }
    });
    summaryRow.innerHTML = html;
};

window.toggleMatrixFullscreen = function() {
    const card = document.getElementById('matrix-card');
    const table = card.querySelector('.matrix-table');
    if (!card) return;
    
    if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
        // Enter fullscreen
        if (card.requestFullscreen) {
            card.requestFullscreen();
        } else if (card.msRequestFullscreen) {
            card.msRequestFullscreen();
        } else if (card.mozRequestFullScreen) {
            card.mozRequestFullScreen();
        } else if (card.webkitRequestFullscreen) {
            card.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
        }
        card.style.overflow = 'auto'; // allow scrolling the whole card if necessary
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        if (table) table.style.height = '100%';
        const container = card.querySelector('.matrix-container');
        if (container) {
            container.style.flex = '1';
            container.style.maxHeight = 'none';
        }
    } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
        card.style.overflow = '';
        card.style.display = '';
        card.style.flexDirection = '';
        if (table) table.style.height = '';
        const container = card.querySelector('.matrix-container');
        if (container) {
            container.style.flex = '';
            container.style.maxHeight = '';
        }
    }
};

window.toggleAdjustFullscreen = function() {
    const card = document.getElementById('adjust-card');
    const table = card.querySelector('.matrix-table');
    if (!card) return;
    
    if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
        if (card.requestFullscreen) card.requestFullscreen();
        else if (card.msRequestFullscreen) card.msRequestFullscreen();
        else if (card.mozRequestFullScreen) card.mozRequestFullScreen();
        else if (card.webkitRequestFullscreen) card.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
        
        card.style.overflow = 'auto';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        if (table) table.style.height = '100%';
        const container = card.querySelector('.matrix-container');
        if (container) {
            container.style.flex = '1';
            container.style.maxHeight = 'none';
        }
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.msExitFullscreen) document.msExitFullscreen();
        else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        
        card.style.overflow = '';
        card.style.display = '';
        card.style.flexDirection = '';
        if (table) table.style.height = '';
        const container = card.querySelector('.matrix-container');
        if (container) {
            container.style.flex = '';
            container.style.maxHeight = '';
        }
    }
};

window.calculateManualAdjustments = function() {
    const inputs = document.querySelectorAll('.manual-adjust-input');
    const catSums = {};
    
    // reset sums
    categories.forEach(cat => catSums[cat] = 0);
    
    inputs.forEach(input => {
        const cat = input.getAttribute('data-cat');
        const idx = parseInt(input.getAttribute('data-idx'));
        const occurrences = parseInt(input.value) || 0;
        
        const item = manualAdjustItems[idx];
        if (!item || item.deleted) return;
        
        let score = occurrences * item.unit;
        if (item.cap !== null && score > item.cap) score = item.cap;
        
        if (item.type === '扣分') {
            score = -score;
        }
        
        // update display
        const scoreCell = document.getElementById(`adjust-score-${cat}-${idx}`);
        if (scoreCell) {
            scoreCell.innerText = score;
            scoreCell.style.color = score < 0 ? '#d32f2f' : (score > 0 ? '#2e7d32' : '#000');
        }
        
        catSums[cat] += score;
    });
    
    // Inject sums into ranking inputs
    categories.forEach(cat => {
        const manualInput = document.getElementById(`manual-score-${cat}`);
        if (manualInput) {
            manualInput.value = catSums[cat];
        }
        if (window._currentCatData && window._currentCatData[cat]) {
            window._currentCatData[cat].manualScore = catSums[cat];
        }
    });
    
    renderRanking();
};

window.saveManualAdjustData = async function(silent = false) {
    if (!currentSnapshot) return;
    
    const inputs = document.querySelectorAll('.manual-adjust-input');
    const newData = {};
    categories.forEach(cat => newData[cat] = {});
    
    inputs.forEach(input => {
        const cat = input.getAttribute('data-cat');
        const idx = input.getAttribute('data-idx');
        const val = parseInt(input.value);
        if (!isNaN(val)) {
            newData[cat][idx] = val;
        }
    });
    
    currentSnapshot.manualAdjustData = newData;
    
    try {
        await putSnapshotWithCompression(currentSnapshot.id, currentSnapshot, 'manual-adjust-data');
        if (!silent) showToast('手动加减分数据已保存到快照', 'success');
    } catch (e) {
        if (!silent) showToast('保存失败', 'error');
        console.error(e);
    }
};

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
                <td style="font-weight:bold; color:#777; padding:8px;">${medal}</td>
                <td style="text-align:left; padding:8px;" class="cat-name">${escapeHTML(d.name)}</td>
                <td style="color:#666; font-weight:bold; padding:8px;">
                    <span onclick="showStdScoreDetails()" style="cursor:pointer; border-bottom:1px dashed #999;" title="点击查看详情">${standardTotalScore}</span>
                </td>
                <td style="color:#2c3e50; font-weight:bold; padding:8px;">
                    <div onclick="showSysScoreDetails('${escapeHTML(cat)}')" style="cursor:pointer; border-bottom:1px dashed #0277bd; display:inline-block;" title="点击查看计算明细">${d.baseScore}</div>
                    <div style="font-size:11px;color:#aaa;font-weight:normal;margin-top:2px;">(获权 ${d.earnedScore} / 满权 ${d.validWeightSum})</div>
                </td>
                <td style="padding:8px;">
                    <div onclick="showAdjScoreDetails('${escapeHTML(cat)}')" style="cursor:pointer; display:inline-block; border-bottom:1px dashed #e65100; font-weight:bold; color:${d.manualScore>=0?'#2e7d32':'#c62828'};" title="点击查看加减分明细">${d.manualScore >= 0 ? '+'+d.manualScore : d.manualScore}</div>
                </td>
                <td style="padding:8px;"><span class="${scoreClass}" style="padding:4px 12px; font-size:16px;">${d.finalScore}</span></td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

window.showScoreDetails = function(title, content) {
    let modal = document.getElementById('details-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'details-modal';
        modal.style.cssText = 'display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:99999; align-items:center; justify-content:center;';
        modal.innerHTML = `
            <div style="background:#fff; border-radius:12px; width:760px; max-width:95%; padding:24px; box-shadow:0 10px 30px rgba(0,0,0,0.2);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid #eee; padding-bottom:12px;">
                    <h3 id="details-modal-title" style="margin:0; color:#0277bd;"></h3>
                    <button onclick="document.getElementById('details-modal').style.display='none'" style="border:none; background:none; font-size:20px; cursor:pointer; color:#888;">&times;</button>
                </div>
                <div id="details-modal-content" style="max-height:60vh; overflow-y:auto; font-size:13px; line-height:1.6; padding-right:10px;"></div>
                <div style="text-align:center; margin-top:20px; padding-top:10px; border-top:1px solid #eee;">
                    <button onclick="document.getElementById('details-modal').style.display='none'" style="padding:8px 24px; border:1px solid #ccc; background:#fff; color:#333; border-radius:6px; cursor:pointer;">关闭</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
    }
    document.getElementById('details-modal-title').innerHTML = title;
    document.getElementById('details-modal-content').innerHTML = content;
    modal.style.display = 'flex';
};

window.showStdScoreDetails = function() {
    showScoreDetails('📊 标准总分说明 (Standard Total Score Details)', `
        <div style="margin-bottom:10px;">标准总分为大盘所设定考核指标的总体权重之和 (Sum of all metric weights):</div>
        <div style="font-size:24px; font-weight:bold; color:#0277bd; text-align:center; padding:10px; background:#f5f8fa; border-radius:6px;">${standardTotalScore}</div>
        <ul style="margin-top:10px; padding-left:20px; color:#555;">
            <li>所有配置了大于0权重的指标将全额计入标准总分。<br><span style="font-size:12px;color:#999;">All metrics with a weight greater than 0 are fully counted in the standard total score.</span></li>
            <li>无论某个客户群是否参与该指标的考核，标准总分保持一致，以提供横向比较的基准。<br><span style="font-size:12px;color:#999;">The standard total score remains the same regardless of whether a customer base participates in the metric, providing a baseline for horizontal comparison.</span></li>
        </ul>
    `);
};

window.showSysScoreDetails = function(cat) {
    const d = window._currentCatData[cat];
    if(!d) return;
    
    let passHtml = '';
    let failHtml = '';
    // 排除项拆成两桶
    let onlyMissingHtml = '';  // ⚠️ 仅本群缺考：其他客户群有数据，本群没有
    let allExcludedHtml = '';  // ⚪ 全员豁免：所有客户群都无数据 / 未配置目标
    
    const targetMonth = document.getElementById('target-month-select').value;
    const allCatData = window._currentCatData || {};
    const allMetrics = window._currentOrderedMetrics || [];

    allMetrics.forEach(m => {
        const mLabel = m.label;
        const cell = d.values[mLabel];
        const targetData = labelToTargetMap[mLabel];
        const weight = (targetData && targetData.weight !== undefined) ? parseFloat(targetData.weight) : 1;
        const hasTarget = targetData && targetData[targetMonth] !== undefined && targetData[targetMonth] !== '' && weight > 0;
        const mEn = i18nMap[mLabel] ? `<br><span style="font-size:11px; color:#aaa;">${escapeHTML(i18nMap[mLabel])}</span>` : '';

        if (!hasTarget || !cell || cell.raw === '--') {
            const otherHasData = Object.keys(allCatData).some(otherCat => {
                if (otherCat === cat) return false;
                const otherCell = allCatData[otherCat].values[mLabel];
                return otherCell && otherCell.raw !== '--' && !isNaN(otherCell.num);
            });

            if (!hasTarget) {
                allExcludedHtml += `<li style="margin-bottom:8px; line-height:1.4;"><span style="color:#999; font-weight:600;">${escapeHTML(mLabel)}</span> <span style="color:#ccc; font-size:11px;">(未配置目标值或权重为0 / No Target)</span>${mEn}</li>`;
            } else if (otherHasData) {
                onlyMissingHtml += `<li style="margin-bottom:8px; line-height:1.4;"><span style="color:#b45309; font-weight:600;">${escapeHTML(mLabel)}</span> <span style="color:#d97706; font-size:11px;">(本群暂无数据 / No Data)</span>${mEn}</li>`;
            } else {
                allExcludedHtml += `<li style="margin-bottom:8px; line-height:1.4;"><span style="color:#999; font-weight:600;">${escapeHTML(mLabel)}</span> <span style="color:#ccc; font-size:11px;">(全员暂无数据 / Global No Data)</span>${mEn}</li>`;
            }
        } else if (cell.isFailing) {
            failHtml += `<li style="margin-bottom:8px; line-height:1.4;"><span style="color:#d32f2f; font-weight:600;">${escapeHTML(mLabel)}</span> <span style="color:#888; font-size:11px;">(权重 Weight: ${weight}, 差值 Gap: ${cell.gapStr})</span>${mEn}</li>`;
        } else {
            passHtml += `<li style="margin-bottom:8px; line-height:1.4;"><span style="color:#2e7d32; font-weight:600;">${escapeHTML(mLabel)}</span> <span style="color:#888; font-size:11px;">(权重 Weight: ${weight})</span>${mEn}</li>`;
        }
    });

    // 拼接排除项区块：仅在有内容时才渲染对应子块
    const onlyMissingBlock = onlyMissingHtml ? `
        <div style="margin-bottom:8px;">
            <div style="color:#b45309; font-size:11px; font-weight:bold; margin-bottom:4px; display:flex; align-items:center; gap:4px;">
                <span>⚠️ 仅本群缺考 (Missing in this base only)</span>
                <span style="color:#d97706; font-weight:normal;">— 其他客户群有数据，本群暂无 (Others have data, this base has none)</span>
            </div>
            <ul style="margin:0; padding-left:15px;">${onlyMissingHtml}</ul>
        </div>` : '';

    const allExcludedBlock = allExcludedHtml ? `
        <div>
            <div style="color:#999; font-size:11px; font-weight:bold; margin-bottom:4px; display:flex; align-items:center; gap:4px;">
                <span>⚪ 全员豁免 (Global Exempt)</span>
                <span style="color:#bbb; font-weight:normal;">— 所有客户群均不涉及此指标 (No base is involved in this metric)</span>
            </div>
            <ul style="margin:0; padding-left:15px;">${allExcludedHtml}</ul>
        </div>` : '';

    const excludedSection = (onlyMissingHtml || allExcludedHtml)
        ? `${onlyMissingBlock}${onlyMissingHtml && allExcludedHtml ? '<hr style="border:none; border-top:1px dashed #e0e0e0; margin:8px 0;">' : ''}${allExcludedBlock}`
        : '<li style="color:#999;">无 (None)</li>';

    showScoreDetails(`📈 [${escapeHTML(d.name)}] 系统得分计算明细 (System Score Details)`, `
        <div style="background:#f5f8fa; padding:12px; border-radius:6px; text-align:center; margin-bottom:15px; border:1px solid #e1e8ed;">
            <div style="color:#666; font-size:12px; margin-bottom:4px;">计算公式 (Formula): ( 获权 Earned W. / 满权 Valid W. ) × 标准总分 Standard Total Score</div>
            <span style="font-size:18px; color:#333;">( </span>
            <span style="color:#2e7d32; font-weight:bold; font-size:18px;" title="获权 (Earned Weight)">${d.earnedScore}</span>
            <span style="font-size:18px; color:#333;"> / </span>
            <span style="color:#ef6c00; font-weight:bold; font-size:18px;" title="满权 (Valid Full Weight)">${d.validWeightSum}</span>
            <span style="font-size:18px; color:#333;"> ) × </span>
            <span style="color:#0277bd; font-weight:bold; font-size:18px;" title="标准总分 (Standard Total Score)">${standardTotalScore}</span>
            <span style="font-size:18px; color:#333;"> = </span>
            <span style="color:#2c3e50; font-weight:bold; font-size:22px;">${d.baseScore}</span>
        </div>
        <div style="display:flex; gap:10px; margin-bottom:10px;">
            <div style="flex:1; background:#f1f8e9; padding:10px; border-radius:6px; border:1px solid #c8e6c9;">
                <div style="color:#2e7d32; font-weight:bold; border-bottom:1px solid #c8e6c9; padding-bottom:5px; margin-bottom:8px;">✅ 达标项 Passed (获权 Earned W. ${d.earnedScore})</div>
                <ul style="margin:0; padding-left:15px; font-size:12px; color:#333;">${passHtml || '<li style="color:#999;">无 (None)</li>'}</ul>
            </div>
            <div style="flex:1; background:#ffebee; padding:10px; border-radius:6px; border:1px solid #ffcdd2;">
                <div style="color:#c62828; font-weight:bold; border-bottom:1px solid #ffcdd2; padding-bottom:5px; margin-bottom:8px;">❌ 不达标项 Failed (失权 Lost W. ${d.validWeightSum - d.earnedScore})</div>
                <ul style="margin:0; padding-left:15px; font-size:12px; color:#333;">${failHtml || '<li style="color:#999;">无 (None)</li>'}</ul>
            </div>
        </div>
        <div style="background:#fafafa; padding:10px; border-radius:6px; border:1px solid #e0e0e0; font-size:12px; color:#666;">
            <div style="color:#777; font-weight:bold; border-bottom:1px solid #e0e0e0; padding-bottom:6px; margin-bottom:8px;">🚫 不参与折算 Excluded</div>
            ${excludedSection}
        </div>
    `);
};

window.showAdjScoreDetails = function(cat) {
    const d = window._currentCatData[cat];
    if(!d) return;
    
    let adjDetails = '';
    if (currentSnapshot && currentSnapshot.manualAdjustData && currentSnapshot.manualAdjustData[cat]) {
        const catAdj = currentSnapshot.manualAdjustData[cat];
        manualAdjustItems.forEach((item, idx) => {
            const count = catAdj[idx] || 0;
            if (count > 0) {
                let score = count * item.unit;
                if (score > item.cap) score = item.cap;
                if (item.type === '扣分') score = -score;
                
                const color = score > 0 ? '#2e7d32' : '#d32f2f';
                adjDetails += `
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px dashed #eee; padding-bottom:6px;">
                        <span style="flex:1; padding-right:10px; color:#333;">${escapeHTML(item.name)} <span style="background:#eee; padding:1px 6px; border-radius:10px; font-size:11px; margin-left:4px;">x${count}</span></span>
                        <span style="color:${color}; font-weight:bold;">${score > 0 ? '+'+score : score}</span>
                    </div>
                `;
            }
        });
    }
    
    showScoreDetails(`⚖️ [${escapeHTML(d.name)}] 加减分明细 (Manual Adj. Details)`, `
        <div style="font-size:24px; font-weight:bold; color:${d.manualScore >= 0 ? '#2e7d32' : '#d32f2f'}; text-align:center; padding:10px; background:#f5f8fa; border-radius:6px; margin-bottom:15px; border:1px solid #e1e8ed;">
            ${d.manualScore >= 0 ? '+'+d.manualScore : d.manualScore}
        </div>
        ${adjDetails || '<div style="text-align:center; color:#888; padding:20px;">无加减分记录 (No records)</div>'}
    `);
};

window.openAddAdjustModal = function() {
    let modal = document.getElementById('add-adjust-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'add-adjust-modal';
        modal.style.cssText = 'display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:99999; align-items:center; justify-content:center;';
        modal.innerHTML = `
            <div style="background:#fff; border-radius:12px; width:440px; padding:24px; box-shadow:0 10px 30px rgba(0,0,0,0.2);">
                <h3 style="margin-top:0; margin-bottom:20px; color:#e65100; display:flex; justify-content:space-between; align-items:center;">
                    <span>➕ 新增手动加减分项</span>
                    <button onclick="document.getElementById('add-adjust-modal').style.display='none'" style="border:none; background:none; font-size:20px; cursor:pointer; color:#888;">&times;</button>
                </h3>
                <div style="margin-bottom:15px;">
                    <label style="display:block; margin-bottom:5px; font-size:13px; color:#555;">项目类型</label>
                    <select id="new-adjust-type" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; font-size:14px;">
                        <option value="扣分">扣分 (惩罚项)</option>
                        <option value="加分">加分 (奖励项)</option>
                    </select>
                </div>
                <div style="margin-bottom:15px;">
                    <label style="display:block; margin-bottom:5px; font-size:13px; color:#555;">项目说明名称</label>
                    <input type="text" id="new-adjust-name" placeholder="例如：重大客户表扬" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box; font-size:14px;">
                </div>
                <div style="display:flex; gap:15px; margin-bottom:15px;">
                    <div style="flex:1;">
                        <label style="display:block; margin-bottom:5px; font-size:13px; color:#555;">单次分值 (发生1次加减多少分)</label>
                        <input type="number" id="new-adjust-unit" value="2" min="1" step="0.5" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box; font-size:14px;">
                    </div>
                    <div style="flex:1;">
                        <label style="display:block; margin-bottom:5px; font-size:13px; color:#555;">累计上限封顶 (留空代表无上限)</label>
                        <input type="number" id="new-adjust-cap" placeholder="留空无上限" min="1" step="0.5" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box; font-size:14px;">
                    </div>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:25px;">
                    <button onclick="document.getElementById('add-adjust-modal').style.display='none'" style="padding:8px 16px; border:1px solid #ccc; background:#fff; border-radius:6px; cursor:pointer;">取消</button>
                    <button onclick="saveNewAdjustItem()" style="padding:8px 16px; border:none; background:#e65100; color:#fff; border-radius:6px; cursor:pointer; font-weight:bold;">保存到全局并生效</button>
                </div>
            </div>
        `;
    }
    
    modal.querySelector('#new-adjust-name').value = '';
    modal.querySelector('#new-adjust-unit').value = '2';
    modal.querySelector('#new-adjust-cap').value = '';
    
    const card = document.getElementById('adjust-card');
    if (document.fullscreenElement === card) {
        card.appendChild(modal);
    } else {
        document.body.appendChild(modal);
    }
    
    modal.style.display = 'flex';
};

window.saveNewAdjustItem = async function() {
    const type = document.getElementById('new-adjust-type').value;
    const name = document.getElementById('new-adjust-name').value.trim();
    const unit = parseFloat(document.getElementById('new-adjust-unit').value) || 0;
    const capStr = document.getElementById('new-adjust-cap').value.trim();
    const cap = capStr === '' ? null : parseFloat(capStr);
    
    if (!name) {
        showToast('请输入项目名称', 'error');
        return;
    }
    
    const desc = cap === null ? `${unit}分/次, 上限无` : `${unit}分/次, 上限${cap}分`;
    
    manualAdjustItems.push({ type, name, unit, cap, desc });
    
    // Save to global prefs
    if (!globalConfig.prefs) globalConfig.prefs = {};
    globalConfig.prefs.manualAdjustItems = manualAdjustItems;
    
    try {
        await API.post('/api/sla/config', globalConfig);
        showToast('自定义项目已添加', 'success');
        document.getElementById('add-adjust-modal').style.display = 'none';
        
        // Re-render
        renderCurrentSnapshot();
    } catch (e) {
        showToast('保存失败', 'error');
    }
};

window.deleteAdjustItem = async function(idx) {
    if (!confirm('确定要全局删除该加减分项目吗？\n删除后该项目将不再计分，且在所有快照中隐藏！')) {
        return;
    }
    
    manualAdjustItems[idx].deleted = true;
    
    // Save to global prefs
    if (!globalConfig.prefs) globalConfig.prefs = {};
    globalConfig.prefs.manualAdjustItems = manualAdjustItems;
    
    try {
        await API.post('/api/sla/config', globalConfig);
        showToast('项目已成功删除', 'success');
        
        // Re-render report to remove the row
        renderCurrentSnapshot();
        
        // Update the current snapshot to purge the removed data
        setTimeout(() => saveManualAdjustData(true), 100);
    } catch (e) {
        showToast('删除失败', 'error');
        console.error(e);
    }
};

window.openWeightModal = function() {
    if (!currentSnapshot || !currentSnapshot.topMetrics) {
        showToast('请先加载一份快照', 'error');
        return;
    }
    
    let metricCols = [...(currentSnapshot.topMetrics || [])];
    
    // Auto inject manual metrics that are missing in current snapshot
    if (globalConfig.targets) {
        Object.keys(globalConfig.targets).forEach(k => {
            if (k.startsWith('manual_') && globalConfig.targets[k].label) {
                const label = globalConfig.targets[k].label;
                if (!metricCols.find(m => m.label === label)) {
                    metricCols.push({ label: label, isManual: true });
                }
            }
        });
    }

    // Sort metricCols according to metricGroups order
    const orderedMetrics = [];
    const assignedLabels = new Set();
    
    // 1. Grouped metrics first
    metricGroups.forEach(g => {
        (g.metrics || []).forEach(label => {
            const m = metricCols.find(x => x.label === label);
            if (m) {
                orderedMetrics.push(m);
                assignedLabels.add(label);
            }
        });
    });
    
    // 2. Append ungrouped metrics
    metricCols.forEach(m => {
        if (!assignedLabels.has(m.label)) {
            orderedMetrics.push(m);
        }
    });
    
    metricCols = orderedMetrics;

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
            const highlightStyle = weight === 0 ? 'border: 2px solid #e53935; background: #ffebee;' : 'border:1px solid #ccc; background:#fff;';
            const labelColor = weight === 0 ? '#e53935' : '#2c3e50';
            const strikeStyle = weight === 0 ? 'text-decoration:line-through; opacity:0.6;' : '';

            html += `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:#f5f8fa; border-radius:6px; border:1px solid #e1e8ed;">
                <span style="font-weight:600; color:${labelColor}; ${strikeStyle}">${escapeHTML(m.label)}</span>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:12px; color:#666;">权重:</span>
                    <input type="number" class="metric-weight-input" data-key="${key}" value="${weight}" step="0.1" min="0" 
                           style="width:70px; padding:6px; ${highlightStyle} border-radius:4px; text-align:center;" 
                           oninput="
                               const w = parseFloat(this.value);
                               const labelSpan = this.closest('div').previousElementSibling;
                               if(w === 0) { 
                                   this.style.backgroundColor = '#ffebee'; 
                                   this.style.borderColor = '#e53935'; 
                                   this.style.borderWidth = '2px';
                                   labelSpan.style.color = '#e53935';
                                   labelSpan.style.textDecoration = 'line-through';
                                   labelSpan.style.opacity = '0.6';
                               } else { 
                                   this.style.backgroundColor = '#fff'; 
                                   this.style.borderColor = '#ccc'; 
                                   this.style.borderWidth = '1px';
                                   labelSpan.style.color = '#2c3e50';
                                   labelSpan.style.textDecoration = 'none';
                                   labelSpan.style.opacity = '1';
                               }
                           ">
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
    
    let modal = document.getElementById('add-metric-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'add-metric-modal';
        modal.style.cssText = 'display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:999; align-items:center; justify-content:center;';
        modal.innerHTML = `
            <div style="background:#fff; border-radius:12px; width:600px; max-width:90%; padding:24px; box-shadow:0 10px 30px rgba(0,0,0,0.2);">
                <h3 style="margin-top:0; border-bottom:1px solid #eee; padding-bottom:12px; margin-bottom:16px; color:#2e7d32;">➕ 手动增加指标 (Add Manual Metric)</h3>
                <div style="max-height:60vh; overflow-y:auto; margin-bottom:16px; padding-right:10px;" id="add-metric-form"></div>
                <div style="text-align:right; border-top:1px solid #eee; padding-top:16px;">
                    <button onclick="closeAddMetricModal()" style="padding:8px 16px; border:1px solid #ccc; background:#fff; border-radius:6px; cursor:pointer; margin-right:10px;">取消</button>
                    <button onclick="saveManualMetric()" style="padding:8px 16px; border:none; background:#2e7d32; color:#fff; border-radius:6px; cursor:pointer; font-weight:bold;">保存指标到快照</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
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
        
        <div style="display:flex; gap:10px; margin-bottom:12px; background:#f5f8fa; padding:10px; border-radius:4px; border:1px solid #e1e8ed;">
            <div style="flex:1;">
                <label style="display:block; font-size:12px; color:#0277bd; margin-bottom:4px; font-weight:bold;">🏆 超额奖励 (每超出)</label>
                <input type="number" id="manual-metric-exceed-by" step="0.1" min="0" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box;" placeholder="例如: 1">
            </div>
            <div style="flex:1;">
                <label style="display:block; font-size:12px; color:#0277bd; margin-bottom:4px; font-weight:bold;">➕ 给予加分</label>
                <input type="number" id="manual-metric-bonus" step="0.1" min="0" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box;" placeholder="例如: 0.1">
            </div>
            <div style="flex:1.5; display:flex; align-items:center;">
                <span style="font-size:11px; color:#666; line-height:1.4;">(选填) 若客户群超额完成目标，按比例折算增加得分。留空表示不启用超额奖励。</span>
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
    
    modal.querySelector('h3').innerHTML = '➕ 手动增加指标';
    
    if (document.fullscreenElement) {
        document.fullscreenElement.appendChild(modal);
    } else if (document.webkitFullscreenElement) {
        document.webkitFullscreenElement.appendChild(modal);
    } else {
        document.body.appendChild(modal);
    }
    
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
        if (targetData.exceedBy !== undefined) document.getElementById('manual-metric-exceed-by').value = targetData.exceedBy;
        if (targetData.bonus !== undefined) document.getElementById('manual-metric-bonus').value = targetData.bonus;
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
    const modal = document.getElementById('add-metric-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.appendChild(modal);
    }
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
    
    const exceedBy = parseFloat(document.getElementById('manual-metric-exceed-by').value);
    const bonus = parseFloat(document.getElementById('manual-metric-bonus').value);
    updatedTargets[targetKey].exceedBy = isNaN(exceedBy) ? '' : exceedBy;
    updatedTargets[targetKey].bonus = isNaN(bonus) ? '' : bonus;
    
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
        
        await putSnapshotWithCompression(currentSnapshot.id, currentSnapshot, 'manual-metric-save');
        
        buildLabelTargetMap();
        showToast('手动指标保存成功', 'success');
        closeAddMetricModal();
        renderCurrentSnapshot();
    } catch(e) {
        showToast('保存失败', 'error');
        console.error(e);
    }
};

window.toggleAutoFill = async function(label) {
    if (!globalConfig.targets) globalConfig.targets = {};
    let targetKey = labelToTargetKeyMap[label];
    if (!targetKey) {
        targetKey = `manual_target_${Date.now()}`;
        globalConfig.targets[targetKey] = { label: label };
    }
    
    globalConfig.targets[targetKey].autoFill = !globalConfig.targets[targetKey].autoFill;
    
    try {
        await API.put('/api/sla/targets', globalConfig.targets);
        buildLabelTargetMap();
        showToast(globalConfig.targets[targetKey].autoFill ? '自动填报已开启 (Auto Fill ON)' : '自动填报已关闭 (Auto Fill OFF)', 'success');
        renderReport(currentSnapshot);
    } catch(e) {
        console.error(e);
        showToast('设置失败 (Save failed)', 'error');
    }
};

// ══════════════════════════════════════════════════════════
// GROUP CONFIG MODAL
// ══════════════════════════════════════════════════════════

// Working copy of groups while editing in modal
let _editGroups = [];
let _focusedGroupIdx = 0; // which group is currently focused in the modal

function getAllMetricLabels() {
    if (!currentSnapshot) return [];
    const labels = new Set();
    (currentSnapshot.topMetrics || []).forEach(m => labels.add(m.label));
    // Also add manual targets that aren't in current snapshot
    if (globalConfig.targets) {
        Object.keys(globalConfig.targets).forEach(k => {
            if (k.startsWith('manual_') && globalConfig.targets[k].label) {
                labels.add(globalConfig.targets[k].label);
            }
        });
    }
    return [...labels];
}

function renderGroupModal() {
    const container = document.getElementById('group-list-container');
    const poolEl = document.getElementById('unassigned-pool');
    
    const allLabels = getAllMetricLabels();
    const assignedLabels = new Set(_editGroups.flatMap(g => g.metrics || []));
    const unassigned = allLabels.filter(l => !assignedLabels.has(l));

    // Clamp focused index
    if (_focusedGroupIdx >= _editGroups.length) _focusedGroupIdx = Math.max(0, _editGroups.length - 1);

    const focusedName = _editGroups[_focusedGroupIdx] ? _editGroups[_focusedGroupIdx].name : '';

    // Render unassigned pool
    const poolTitle = _editGroups.length > 0
        ? `点击分配到「${focusedName || '聚焦分组'}」`
        : '请先新增分组';
    poolEl.innerHTML = unassigned.length
        ? unassigned.map(l => `<span class="unassigned-tag" onclick="assignToFocusedGroup('${escapeHTML(l)}')" title="${poolTitle}">${escapeHTML(l)}</span>`).join('')
        : `<span style="color:#bbb; font-size:12px;">全部指标已分组</span>`;

    // Render group list
    container.innerHTML = _editGroups.map((g, gi) => {
        const isFocused = gi === _focusedGroupIdx;
        const focusStyle = isFocused
            ? 'border:2px solid #3949ab; box-shadow:0 0 0 3px rgba(57,73,171,0.15);'
            : 'border:1px solid #e1e8ed;';
        return `
        <div class="group-item" data-gi="${gi}" style="${focusStyle} cursor:pointer;"
            onclick="setFocusedGroup(${gi})">
            <div class="group-item-header">
                <div style="display:flex; flex-direction:column; align-items:center; margin-right:8px; line-height:1;">
                    <span onclick="event.stopPropagation(); moveGroupUp(${gi})" style="cursor:${gi === 0 ? 'not-allowed' : 'pointer'}; color:${gi === 0 ? '#ddd' : '#777'}; font-size:14px; padding:0 4px; user-select:none;" title="上移">▲</span>
                    <span onclick="event.stopPropagation(); moveGroupDown(${gi})" style="cursor:${gi === _editGroups.length - 1 ? 'not-allowed' : 'pointer'}; color:${gi === _editGroups.length - 1 ? '#ddd' : '#777'}; font-size:14px; padding:0 4px; user-select:none;" title="下移">▼</span>
                </div>
                <input class="group-name-input" value="${escapeHTML(g.name)}" placeholder="分组名称"
                    onclick="event.stopPropagation()"
                    oninput="_editGroups[${gi}].name = this.value"
                    onblur="updatePoolHint()">
                <span class="focus-badge" style="font-size:11px; background:#3949ab; color:#fff; border-radius:10px; padding:1px 7px; margin-left:4px; display:${isFocused ? 'inline' : 'none'};">聚焦</span>
                <span onclick="event.stopPropagation(); removeGroup(${gi})" style="cursor:pointer; color:#e53935; font-size:18px; padding:0 4px;" title="删除分组">✕</span>
            </div>
            <div class="group-metrics-list">
                ${(g.metrics || []).map((label, mi) => `
                    <div class="group-metric-tag">
                        <span onclick="event.stopPropagation(); moveMetricUp(${gi}, ${mi})" style="cursor:${mi === 0 ? 'not-allowed' : 'pointer'}; color:${mi === 0 ? '#ddd' : '#777'}; font-size:12px; padding:0 4px; user-select:none;" title="上移">▲</span>
                        <span onclick="event.stopPropagation(); moveMetricDown(${gi}, ${mi})" style="cursor:${mi === g.metrics.length - 1 ? 'not-allowed' : 'pointer'}; color:${mi === g.metrics.length - 1 ? '#ddd' : '#777'}; font-size:12px; padding:0 4px; user-select:none;" title="下移">▼</span>
                        <span style="flex:1; margin-left:4px;">${escapeHTML(label)}</span>
                        <span class="group-metric-remove" onclick="event.stopPropagation(); removeMetricFromGroup(${gi}, ${mi})">✕</span>
                    </div>`).join('')}
                ${g.metrics.length === 0 ? `<div style="color:#bbb; font-size:12px; text-align:center; padding:4px;">点击右侧指标标签分配到此分组</div>` : ''}
            </div>
        </div>
    `}).join('');
}

window.moveGroupUp = function(gi) {
    if (gi <= 0) return;
    const temp = _editGroups[gi - 1];
    _editGroups[gi - 1] = _editGroups[gi];
    _editGroups[gi] = temp;
    if (_focusedGroupIdx === gi) _focusedGroupIdx = gi - 1;
    else if (_focusedGroupIdx === gi - 1) _focusedGroupIdx = gi;
    renderGroupModal();
};

window.moveGroupDown = function(gi) {
    if (gi >= _editGroups.length - 1) return;
    const temp = _editGroups[gi + 1];
    _editGroups[gi + 1] = _editGroups[gi];
    _editGroups[gi] = temp;
    if (_focusedGroupIdx === gi) _focusedGroupIdx = gi + 1;
    else if (_focusedGroupIdx === gi + 1) _focusedGroupIdx = gi;
    renderGroupModal();
};

window.moveMetricUp = function(gi, mi) {
    if (mi <= 0) return;
    const metrics = _editGroups[gi].metrics;
    const temp = metrics[mi - 1];
    metrics[mi - 1] = metrics[mi];
    metrics[mi] = temp;
    renderGroupModal();
};

window.moveMetricDown = function(gi, mi) {
    const metrics = _editGroups[gi].metrics;
    if (mi >= metrics.length - 1) return;
    const temp = metrics[mi + 1];
    metrics[mi + 1] = metrics[mi];
    metrics[mi] = temp;
    renderGroupModal();
};

window.assignToFocusedGroup = function(label) {
    if (_editGroups.length === 0) {
        _editGroups.push({ id: `grp_${Date.now()}`, name: '默认分组', metrics: [] });
        _focusedGroupIdx = 0;
    }
    const targetIdx = (_focusedGroupIdx >= 0 && _focusedGroupIdx < _editGroups.length)
        ? _focusedGroupIdx : 0;
    _editGroups[targetIdx].metrics.push(label);
    renderGroupModal();
};

// Lightweight focus update - NO full re-render so input stays editable
window.setFocusedGroup = function(gi) {
    if (_focusedGroupIdx === gi) return; // already focused, skip
    _focusedGroupIdx = gi;
    // Update borders
    document.querySelectorAll('#group-list-container .group-item').forEach((el, idx) => {
        const focused = idx === gi;
        el.style.border = focused ? '2px solid #3949ab' : '1px solid #e1e8ed';
        el.style.boxShadow = focused ? '0 0 0 3px rgba(57,73,171,0.15)' : '';
        const badge = el.querySelector('.focus-badge');
        if (badge) badge.style.display = focused ? 'inline' : 'none';
    });
    updatePoolHint();
};

window.updatePoolHint = function() {
    const groupName = (_editGroups[_focusedGroupIdx] || {}).name || '聚焦分组';
    const title = _editGroups.length > 0 ? `点击分配到「${groupName}」` : '请先新增分组';
    document.querySelectorAll('#unassigned-pool .unassigned-tag').forEach(tag => {
        tag.title = title;
    });
};

window.removeGroup = function(gi) {
    _editGroups.splice(gi, 1);
    renderGroupModal();
};

window.removeMetricFromGroup = function(gi, mi) {
    _editGroups[gi].metrics.splice(mi, 1);
    renderGroupModal();
};

window.addNewGroup = function() {
    _editGroups.push({ id: `grp_${Date.now()}`, name: '新分组', metrics: [] });
    _focusedGroupIdx = _editGroups.length - 1;
    renderGroupModal();
    // Auto-focus and select the new group's name input
    setTimeout(() => {
        const items = document.querySelectorAll('#group-list-container .group-item');
        if (items.length > 0) {
            const lastInput = items[items.length - 1].querySelector('.group-name-input');
            if (lastInput) { lastInput.focus(); lastInput.select(); }
        }
    }, 30);
};

window.openGroupModal = function() {
    // Deep clone current groups for editing
    _editGroups = JSON.parse(JSON.stringify(metricGroups));
    _focusedGroupIdx = 0;
    renderGroupModal();
    document.getElementById('group-modal').style.display = 'flex';
};

window.closeGroupModal = function() {
    document.getElementById('group-modal').style.display = 'none';
};

window.saveGroups = async function() {
    try {
        // Collect current names from inputs
        const inputs = document.querySelectorAll('.group-name-input');
        inputs.forEach((inp, i) => { if (_editGroups[i]) _editGroups[i].name = inp.value.trim() || `分组${i+1}`; });
        
        await API.put('/api/sla/groups', _editGroups);
        metricGroups = _editGroups;
        showToast('分组配置已保存', 'success');
        closeGroupModal();
        renderCurrentSnapshot();
    } catch(e) {
        showToast('保存分组失败', 'error');
        console.error(e);
    }
};
let _editI18nMap = {};
let _editingZh = null;

window.openI18nModal = function() {
    _editI18nMap = { ...i18nMap };
    _editingZh = null;
    renderI18nList();
    document.getElementById('i18n-new-zh').value = '';
    document.getElementById('i18n-new-en').value = '';
    document.getElementById('i18n-modal').style.display = 'flex';
};

window.closeI18nModal = function() {
    document.getElementById('i18n-modal').style.display = 'none';
};

window.renderI18nList = function() {
    const container = document.getElementById('i18n-list-container');
    const searchInput = document.getElementById('i18n-search');
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
    
    let html = '';
    let keys = Object.keys(_editI18nMap).sort();
    
    if (searchTerm) {
        keys = keys.filter(zh => {
            const en = _editI18nMap[zh] || '';
            return zh.toLowerCase().includes(searchTerm) || en.toLowerCase().includes(searchTerm);
        });
    }
    
    if (keys.length === 0) {
        html = '<tr><td colspan="3" style="text-align:center; padding:20px; color:#999; font-size:13px;">没有找到匹配的指标</td></tr>';
    } else {
        keys.forEach(zh => {
            const en = _editI18nMap[zh];
            html += `
                <tr style="border-bottom:1px solid #f0f0f0;">
                    <td style="padding:8px; font-size:13px; color:#333; font-weight:600;">${escapeHTML(zh)}</td>
                <td style="padding:8px; font-size:13px; color:#0277bd;">${escapeHTML(en)}</td>
                <td style="padding:8px; text-align:center; white-space:nowrap;">
                    <button onclick="editI18nEntry('${escapeHTML(zh.replace(/'/g, "\\'"))}')" style="background:none; border:none; cursor:pointer; font-size:14px; opacity:0.6; padding:4px;" title="编辑此项" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'">✏️</button>
                    <button onclick="deleteI18nEntry('${escapeHTML(zh.replace(/'/g, "\\'"))}')" style="background:none; border:none; cursor:pointer; font-size:14px; opacity:0.6; padding:4px;" title="删除此项" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'">🗑️</button>
                </td>
            </tr>
        `;
        });
    }
    container.innerHTML = html;
};

window.editI18nEntry = function(zh) {
    _editingZh = zh;
    document.getElementById('i18n-new-zh').value = zh;
    document.getElementById('i18n-new-en').value = _editI18nMap[zh] || '';
    document.getElementById('i18n-new-en').focus();
};

window.addI18nEntry = async function() {
    const zh = document.getElementById('i18n-new-zh').value.trim();
    const en = document.getElementById('i18n-new-en').value.trim();
    if (!zh || !en) {
        showToast('请填写完整的中英文', 'error');
        return;
    }
    
    if (_editingZh) {
        if (_editingZh !== zh) {
            if (_editI18nMap[zh] !== undefined) {
                showToast('该中文名称已存在，不能重命名为已有的指标', 'error');
                return;
            }
            if (confirm(`您修改了指标的中文名称（从 [${_editingZh}] 改为 [${zh}]）。\n是否要全局同步重命名该指标？（这将自动更新历史快照、分组、考核配置中的名称）`)) {
                try {
                    await API.post('/api/sla/rename-metric', { oldName: _editingZh, newName: zh, newEn: en });
                    showToast('全局重命名成功！页面即将自动刷新...', 'success');
                    setTimeout(() => window.location.reload(), 1500);
                    return; // Prevent further logic to avoid race condition with manual save
                } catch(e) {
                    showToast('全局重命名失败', 'error');
                    console.error(e);
                    return;
                }
            } else {
                // Only update local map
                delete _editI18nMap[_editingZh];
                _editI18nMap[zh] = en;
            }
        } else {
            _editI18nMap[zh] = en;
        }
    } else {
        if (_editI18nMap[zh] !== undefined) {
            if (!confirm(`指标 [${zh}] 已存在，是否覆盖其英文翻译？`)) {
                return;
            }
        }
        _editI18nMap[zh] = en;
    }
    
    _editingZh = null;
    document.getElementById('i18n-new-zh').value = '';
    document.getElementById('i18n-new-en').value = '';
    renderI18nList();
};

window.deleteI18nEntry = function(zh) {
    if (confirm(`确定要删除“${zh}”的翻译吗？`)) {
        delete _editI18nMap[zh];
        renderI18nList();
    }
};

window.saveI18nMap = async function() {
    try {
        if (!globalConfig.prefs) globalConfig.prefs = {};
        globalConfig.prefs.i18nMap = _editI18nMap;
        
        await API.post('/api/sla/config', { 
            targets: globalConfig.targets, 
            prefs: globalConfig.prefs 
        });
        
        i18nMap = { ..._editI18nMap };
        showToast('翻译字典已保存', 'success');
        closeI18nModal();
        setTimeout(() => window.location.reload(), 500);
    } catch(e) {
        showToast('保存失败', 'error');
        console.error(e);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const modeSelect = document.getElementById('reportSourceMode');
    if (modeSelect) {
        modeSelect.value = API.getSourceMode('report_sla_data');
        modeSelect.addEventListener('change', () => {
            API.setSourceMode('report_sla_data', modeSelect.value);
            initReport();
        });
    }
    if (window.renderReportSourcePanel) window.renderReportSourcePanel();
    initReport();
});

async function promptExpiringTickets(tickets) {
    return new Promise(resolve => {
        const modalId = 'expiring-tickets-modal';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
            document.body.appendChild(modal);
        }
        
        let listHtml = tickets.map((t, i) => {
            const data = t.data || {};
            const id = data.sr_num || data.sr_id || data.task_id || data.risk_id || data.ticket_id || data['单号'] || data['问题风险编号'] || data['问题编号'] || '未知单号';
            const network = data.network_name || data['网络名称'] || data.network || '未知网络';
            return `<div style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;display:flex;align-items:center;gap:8px;">
                <input type="checkbox" class="exp-ticket-cb" value="${i}" checked style="margin-right:10px;cursor:pointer;width:16px;height:16px;">
                <div style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHTML(t.title)} | 单号: ${escapeHTML(id)} | 网络: ${escapeHTML(network)} | ${escapeHTML(t._slaCleanText)}">
                    <b>${escapeHTML(t.title)}</b> | 单号: <span style="color:#1976d2">${escapeHTML(id)}</span> | 网络: ${escapeHTML(network)} | <span style="color:#d32f2f">${escapeHTML(t._slaCleanText)}</span>
                </div>
            </div>`;
        }).join('');
        
        modal.innerHTML = `
            <div style="background:#fff;border-radius:10px;width:min(1080px,96vw);max-height:84vh;display:flex;flex-direction:column;box-shadow:0 8px 28px rgba(0,0,0,0.18);">
                <div style="padding:16px;border-bottom:1px solid #eee;background:#fff3e0;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:center;">
                    <h3 style="margin:0;color:#e65100;font-size:16px;">⚠️ 发现待处理的临期数据</h3>
                    <label style="font-size:13px;cursor:pointer;color:#e65100;font-weight:bold;display:flex;align-items:center;"><input type="checkbox" id="exp-select-all" checked style="margin-right:4px;"> 全选</label>
                </div>
                <div style="padding:16px;overflow-y:auto;flex:1;">
                    <p style="margin-top:0;font-size:14px;color:#333;">本次快照关联到了以下 <b>${tickets.length}</b> 条“本月底+5天内处理”条件的最新数据。请<b>勾选</b>需要一起入库的单子（取消勾选则会忽略）：</p>
                    <div style="background:#fcfcfc;border-radius:6px;border:1px solid #ddd;max-height:360px;overflow-y:auto;overflow-x:hidden;margin-bottom:16px;">
                        ${listHtml}
                    </div>
                    <p style="margin-bottom:0;font-size:14px;color:#d32f2f;font-weight:bold;">
                        是否将勾选的单子统一入库？
                    </p>
                    <p style="margin-top:4px;font-size:12px;color:#666;">
                        一旦入库，将会和库中已有内容一起，后面计划呈现在一键催办和月报页面。不勾选的单子将被彻底忽略。
                    </p>
                </div>
                <div style="padding:16px;border-top:1px solid #eee;display:flex;justify-content:flex-end;gap:12px;background:#f8f9fa;border-radius:0 0 8px 8px;">
                    <button id="btn-ignore-exp" style="padding:8px 16px;border:1px solid #ccc;background:#fff;border-radius:4px;cursor:pointer;color:#666;font-size:14px;">全部忽略</button>
                    <button id="btn-confirm-exp" style="padding:8px 16px;border:none;background:#e65100;color:#fff;border-radius:4px;cursor:pointer;font-weight:bold;font-size:14px;">✅ 统一入库 (已选 <span id="exp-sel-count">${tickets.length}</span> 项)</button>
                </div>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        const selectAllCb = document.getElementById('exp-select-all');
        const cbs = document.querySelectorAll('.exp-ticket-cb');
        const countSpan = document.getElementById('exp-sel-count');
        
        const updateCount = () => {
            const checkedCount = document.querySelectorAll('.exp-ticket-cb:checked').length;
            countSpan.innerText = checkedCount;
            selectAllCb.checked = checkedCount === cbs.length;
        };
        
        selectAllCb.onchange = (e) => {
            cbs.forEach(cb => cb.checked = e.target.checked);
            updateCount();
        };
        
        cbs.forEach(cb => {
            cb.onchange = updateCount;
        });
        
        document.getElementById('btn-ignore-exp').onclick = () => {
            modal.style.display = 'none';
            resolve([]);
        };
        
        document.getElementById('btn-confirm-exp').onclick = () => {
            const selectedIndices = Array.from(document.querySelectorAll('.exp-ticket-cb:checked')).map(cb => parseInt(cb.value));
            const selectedTickets = selectedIndices.map(i => tickets[i]);
            modal.style.display = 'none';
            resolve(selectedTickets);
        };
    });
}

window.saveDashboardToDB = async function(event) {
    if (!currentSnapshot) {
        return showToast('无可用快照数据', 'error');
    }
    if (!isReportEligibleSnapshot(currentSnapshot)) {
        return showToast('当前快照没有顶部指标数据，不会入库到报表看板', 'warn');
    }

    const snapshot_id = currentSnapshot.id;
    const month = parseInt(document.getElementById('target-month-select').value);
    setReportTargetMonth(month);
    const rawDataForSave = JSON.parse(JSON.stringify(currentSnapshot));

    if (rawDataForSave.expiringTickets && rawDataForSave.expiringTickets.length > 0) {
        rawDataForSave.expiringTickets = await promptExpiringTickets(rawDataForSave.expiringTickets);
    }
    rawDataForSave.selectedTargetMonth = month;
    rawDataForSave.selectedTargetMonthLabel = `${month}月`;
    
    // Build cat scores
    const cat_scores = [];
    const catData = window._currentCatData || {};
    Object.keys(catData).forEach(catName => {
        const c = catData[catName];
        cat_scores.push({
            cat_name: c.name,
            base_score: c.baseScore,
            manual_score: c.manualScore,
            final_score: c.finalScore
        });
    });

    // Build metric data
    const metric_data = [];
    const orderedMetrics = window._currentOrderedMetrics || [];
    
    orderedMetrics.forEach(m => {
        const targetData = labelToTargetMap[m.label] || {};
        const weight = targetData.weight !== undefined ? parseFloat(targetData.weight) : 1;
        
        let targetStr = '--';
        if (targetData[month] !== undefined && targetData[month] !== '') {
            const condition = targetData.type || 'gte';
            targetStr = (condition === 'gte' ? '≥ ' : '≤ ') + targetData[month];
            
            // Check if any cat has % in this metric to append % to target
            let isPercent = false;
            Object.keys(catData).forEach(catName => {
                const cell = catData[catName].values[m.label];
                if (cell && String(cell.raw).includes('%')) isPercent = true;
            });
            if (isPercent) targetStr += '%';
        }
        
        Object.keys(catData).forEach(catName => {
            const cell = catData[catName].values[m.label];
            if (cell) {
                metric_data.push({
                    cat_name: catName,
                    metric_label: m.label,
                    weight: weight,
                    target_val: targetStr,
                    raw_val: String(cell.raw),
                    num_val: cell.num,
                    is_failing: cell.isFailing,
                    gap: cell.gapStr || ''
                });
            }
        });
    });

    const payload = {
        snapshot_id: snapshot_id,
        month: month,
        created_at: currentSnapshot.timestamp,
        standard_total_score: standardTotalScore,
        cat_scores: cat_scores,
        metric_data: metric_data,
        raw_data: rawDataForSave
    };

    try {
        const btn = event ? event.target : null;
        if (btn) btn.innerHTML = '⏳ 正在准备数据...';
        
        payload.image_data = null;

        // Generate Excel File
        if (typeof ExcelJS !== 'undefined') {
            try {
                if (btn) btn.innerHTML = '⏳ 正在生成报表...';
                const workbook = new ExcelJS.Workbook();
                const sheet = workbook.addWorksheet('短板透视矩阵');
                
                const stripHtml = (html) => {
                    const tmp = document.createElement('div');
                    tmp.innerHTML = html;
                    return tmp.textContent || tmp.innerText || "";
                };
                
                // Define columns
                const columns = [
                    { header: '分组 (Group)', key: 'group', width: 18 },
                    { header: '总权重', key: 'groupWeight', width: 12 },
                    { header: '考核的指标名称 (Metric)', key: 'metric', width: 50 },
                    { header: '权重', key: 'weight', width: 10 },
                    { header: '目标值 (Target)', key: 'target', width: 18 },
                    { header: '全局总体达标', key: 'global', width: 18 }
                ];
                
                const catData = window._currentCatData || {};
                const categories = Object.keys(catData);
                categories.forEach(cat => {
                    columns.push({ header: cat, key: `val_${cat}`, width: 22 });
                    columns.push({ header: `${cat}得分`, key: `score_${cat}`, width: 18 });
                });
                
                sheet.columns = columns;
                
                // Set default font for all columns
                sheet.columns.forEach(column => {
                    column.font = { name: 'Microsoft YaHei', size: 11 };
                    column.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
                });
                // Metric name left-aligned
                sheet.getColumn('metric').alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
                
                // Style header
                const headerRow = sheet.getRow(1);
                headerRow.font = { name: 'Microsoft YaHei', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
                headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A237E' } };
                headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
                headerRow.height = 30; // Slightly taller header

                
                // Add data
                const orderedMetrics = window._currentOrderedMetrics || [];
                const groupWeightMap = window._currentGroupWeightMap || {};
                const labelToGroup = window._currentLabelToGroup || {};
                
                let curGroup = null;
                let curGroupStartRow = -1;
                let currentRowIdx = 2; // Header is row 1
                const merges = [];
                
                orderedMetrics.forEach(m => {
                    const gName = labelToGroup[m.label];
                    if (!gName) return; // Skip ungrouped as requested by user
                    
                    if (gName !== curGroup) {
                        if (curGroup && (currentRowIdx - curGroupStartRow) > 1) {
                            merges.push({ s: curGroupStartRow, e: currentRowIdx - 1 });
                        }
                        curGroup = gName;
                        curGroupStartRow = currentRowIdx;
                    }
                    
                    const rowData = {};
                    rowData.group = stripHtml(getBilingual(gName));
                    rowData.groupWeight = groupWeightMap[gName] || '-';
                    rowData.metric = stripHtml(getBilingual(m.label));
                    
                    const targetData = labelToTargetMap[m.label] || {};
                    const weight = targetData.weight !== undefined ? parseFloat(targetData.weight) : 1;
                    rowData.weight = weight;
                    
                    let targetStr = '--';
                    if (targetData[month] !== undefined && targetData[month] !== '') {
                        const condition = targetData.type || 'gte';
                        targetStr = (condition === 'gte' ? '≥ ' : '≤ ') + targetData[month];
                        let isPercent = false;
                        categories.forEach(cat => {
                            if (catData[cat].values[m.label] && String(catData[cat].values[m.label].raw).includes('%')) isPercent = true;
                        });
                        if (isPercent) targetStr += '%';
                    }
                    rowData.target = targetStr;
                    rowData.global = m.value || '--';
                    
                    categories.forEach(cat => {
                        const cell = catData[cat].values[m.label] || {};
                        rowData[`val_${cat}`] = cell.raw || '--';
                        if (!cell || cell.raw === undefined || cell.raw === '--') {
                            rowData[`score_${cat}`] = '--';
                        } else if (!m.hasTarget) {
                            rowData[`score_${cat}`] = '--';
                        } else {
                            const earned = cell.isFailing ? 0 : (weight + (cell.bonusScore || 0));
                            rowData[`score_${cat}`] = Number.isInteger(earned) ? earned : +earned.toFixed(2);
                        }
                    });
                    
                    const row = sheet.addRow(rowData);
                    row.height = 25; // Professional row height
                    
                    // Highlight global failing cell
                    if (m.isWarn) {
                        const globalColObj = sheet.getColumn('global');
                        const globalCell = row.getCell(globalColObj.number);
                        globalCell.font = { name: 'Microsoft YaHei', size: 11, color: { argb: 'FFD32F2F' }, bold: true };
                        globalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } };
                    }
                    
                    // Highlight failing cells
                    categories.forEach(cat => {
                        const cell = catData[cat].values[m.label] || {};
                        if (cell.isFailing) {
                            const valColObj = sheet.getColumn(`val_${cat}`);
                            const valCell = row.getCell(valColObj.number);
                            valCell.font = { name: 'Microsoft YaHei', size: 11, color: { argb: 'FFD32F2F' }, bold: true };
                            valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } };
                        }
                    });
                    
                    currentRowIdx++;
                });
                
                // Final group merge check
                if (curGroup && (currentRowIdx - curGroupStartRow) > 1) {
                    merges.push({ s: curGroupStartRow, e: currentRowIdx - 1 });
                }
                
                // Apply merges and borders
                merges.forEach(m => {
                    sheet.mergeCells(`A${m.s}:A${m.e}`);
                    sheet.mergeCells(`B${m.s}:B${m.e}`);
                });
                
                // Apply borders to all used cells
                sheet.eachRow((row, rowNumber) => {
                    row.eachCell((cell) => {
                        cell.border = {
                            top: {style:'thin', color: {argb:'FFE0E0E0'}},
                            left: {style:'thin', color: {argb:'FFE0E0E0'}},
                            bottom: {style:'thin', color: {argb:'FFE0E0E0'}},
                            right: {style:'thin', color: {argb:'FFE0E0E0'}}
                        };
                    });
                });
                
                // Add total score row
                const totalRowData = { metric: '🏁 总分 (Total Score)' };
                categories.forEach(cat => {
                    totalRowData[`score_${cat}`] = catData[cat].finalScore;
                });
                const totalRow = sheet.addRow(totalRowData);
                totalRow.height = 30;
                totalRow.font = { name: 'Microsoft YaHei', size: 12, bold: true, color: { argb: 'FF333333' } };
                totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF59D' } };
                // Also add borders to total row
                totalRow.eachCell((cell) => {
                    cell.border = {
                        top: {style:'thin', color: {argb:'FFBDBDBD'}},
                        left: {style:'thin', color: {argb:'FFBDBDBD'}},
                        bottom: {style:'thin', color: {argb:'FFBDBDBD'}},
                        right: {style:'thin', color: {argb:'FFBDBDBD'}}
                    };
                });
                
                const buffer = await workbook.xlsx.writeBuffer();
                let binary = '';
                const bytes = new Uint8Array(buffer);
                const len = bytes.byteLength;
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                payload.excel_data = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + window.btoa(binary);
            } catch (err) {
                console.error("Excel generation error:", err);
            }
        }

        if (btn) btn.innerHTML = '⏳ 正在入库...';
        const res = await API.post('/api/db/save', payload);
        if (btn) btn.innerHTML = '💾 入库 (Save to DB)';
        
        if (res.success) {
            showToast('数据已成功入库 (Saved to DB successfully)', 'success');
        } else {
            showToast(res.error || '入库失败', 'error');
        }
    } catch (e) {
        showToast('入库请求失败: ' + e.message, 'error');
        console.error(e);
    }
};
