/**
 * uivf12/generator.js - 脚本生成引擎
 * 完整移植原版生成逻辑，生成 UIV 宏代码和 F12 控制台脚本
 * 当前工具版本: v6.6
 */

const TOOL_VERSION = 'v6.6';

function generateScript() {
    const errorDiv = document.getElementById('errorMsg');
    errorDiv.innerText = '';
    UIVGenLog.start();
    UIVGenLog.section(UIVT('uiv.generator.engineStart', { version: TOOL_VERSION }));

    if (document.getElementById('jsonInput').style.display !== 'none') {
        window.UIVWorkbench.formatAndAnalyzeJSON();
    }

    const url = document.getElementById('requestUrl').value.trim();
    const fileNameBase = document.getElementById('fileName').value.trim() || 'PBI_Data';
    const useGlobalVars = document.getElementById('useGlobalVars').checked;
    const isPagination = document.getElementById('isPagination').checked;
    const forceSumData = document.getElementById('forceSumData').checked;
    const autoFetchCPC = document.getElementById('autoFetchCPC').checked;
    const autoRuntimeMonth = document.getElementById('autoRuntimeMonth').checked;

    const parsedPayloadObj = window.UIVWorkbench.getParsedPayload();
    if (!parsedPayloadObj) { errorDiv.innerText = UIVT('uiv.generator.needPayload'); UIVGenLog.error(UIVT('uiv.generator.needPayloadLog')); UIVGenLog.done(false); return; }

    const platform = url.includes('datafab') ? 'DATAFAB' : (url.includes('netcare') ? 'NETCARE' : 'CUSTOM');
    UIVGenLog.info(UIVT('uiv.generator.targetPlatform', { platform, url: url.substring(0, 60) + (url.length > 60 ? '...' : '') }));
    UIVGenLog.section(UIVT('uiv.generator.payloadSection'));
    let payloadClone = JSON.parse(JSON.stringify(parsedPayloadObj));

    if (platform === 'NETCARE') { payloadClone.need_summary = true; UIVGenLog.dim(UIVT('uiv.generator.netcareSummary')); }

    let hasCPC = false, hasNID = false, hasMonthFilter = false;

    function traversePayload(obj) {
        if (typeof obj !== 'object' || obj === null) return;
        if (platform === 'DATAFAB' && autoFetchCPC && obj.column === 'cpc' && Array.isArray(obj.values)) {
            hasCPC = true; obj.values = '__CPC_IDS_PLACEHOLDER__';
        }
        if (platform === 'NETCARE' && autoFetchCPC) {
            if (obj.nid !== undefined && Array.isArray(obj.nid)) { hasNID = true; obj.nid = '__NID_PLACEHOLDER__'; }
            if (obj.nid_name !== undefined && Array.isArray(obj.nid_name)) { hasNID = true; obj.nid_name = '__NID_PLACEHOLDER__'; }
        }
        if (autoRuntimeMonth) {
            if (typeof obj.column === 'string' && Array.isArray(obj.values) && obj.values.length === 1 && typeof obj.values[0] === 'string') {
                if (obj.column.toLowerCase().includes('month') && /^[0-9]{1,2}$/.test(obj.values[0])) {
                    hasMonthFilter = true; obj.values = '__MONTH_PLACEHOLDER__';
                }
                if (obj.column.toLowerCase().includes('year') && /^[0-9]{4}$/.test(obj.values[0])) {
                    obj.values = '__YEAR_PLACEHOLDER__';
                }
            }
            let sKey = Object.keys(obj).find(k => (k.toLowerCase().includes('start_date') || k.toLowerCase() === 'startdate') && typeof obj[k] === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(obj[k]));
            let eKey = Object.keys(obj).find(k => (k.toLowerCase().includes('end_date') || k.toLowerCase() === 'enddate') && typeof obj[k] === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(obj[k]));
            if (sKey && eKey) {
                const sMonth = obj[sKey].substring(0, 7), eMonth = obj[eKey].substring(0, 7);
                if (sMonth === eMonth) {
                    hasMonthFilter = true;
                    obj[sKey] = '__START_DATE_PLACEHOLDER__' + obj[sKey].substring(10);
                    obj[eKey] = '__END_DATE_PLACEHOLDER__' + obj[eKey].substring(10);
                }
            }
        }
        for (let key in obj) { if (typeof obj[key] === 'object' && obj[key] !== null) traversePayload(obj[key]); }
    }
    traversePayload(payloadClone);

    // 输出嗅探结果
    const detectedText = UIVT('uiv.generator.detectedPlaceholder');
    const notDetectedText = UIVT('uiv.generator.notDetected');
    UIVGenLog.info(UIVT('uiv.generator.cpcPoint', { state: hasCPC ? detectedText : notDetectedText }));
    UIVGenLog.info(UIVT('uiv.generator.nidPoint', { state: hasNID ? detectedText : notDetectedText }));
    UIVGenLog.info(UIVT('uiv.generator.monthSplit', {
        state: hasMonthFilter
            ? UIVT('uiv.generator.monthEnabled', { mode: autoRuntimeMonth ? UIVT('uiv.generator.monthDual') : UIVT('uiv.generator.monthSingle') })
            : UIVT('uiv.generator.off')
    }));

    UIVGenLog.section(UIVT('uiv.generator.paramsSection'));
    const pageId = window.UIVWorkbench.findKeyDeep(payloadClone, 'pageId') || '';
    const boardId = window.UIVWorkbench.findKeyDeep(payloadClone, 'boardId') || '';
    const tenantIdStr = window.UIVWorkbench.findKeyDeep(payloadClone, 'srcTenantId') || '';
    let dynamicPageName = window.UIVWorkbench.findKeyDeep(payloadClone, 'pageName') || '';
    const compId = window.UIVWorkbench.findKeyDeep(payloadClone, 'id') || '';

    UIVGenLog.dim('pageId: '   + (pageId   || UIVT('uiv.generator.notFound')));
    UIVGenLog.dim('boardId: '  + (boardId  || UIVT('uiv.generator.notFound')));
    UIVGenLog.dim('tenantId: ' + (tenantIdStr || UIVT('uiv.generator.notFound')));
    UIVGenLog.dim('compId: '   + (compId   || UIVT('uiv.generator.notFound')));

    if (autoFetchCPC && platform === 'DATAFAB' && hasCPC && !pageId) {
        errorDiv.innerText = UIVT('uiv.generator.missingPageId');
    }
    if (dynamicPageName) dynamicPageName = '_' + dynamicPageName.replace(/[<>:"/\\|?*]+/g, '');
    const finalFileName = fileNameBase + dynamicPageName + '_Latest.csv';
    const title = fileNameBase + dynamicPageName;
    window.UIVWorkbench.setCurrentTitle(title + (!dynamicPageName && compId ? '_' + compId.substring(0, 6) : ''));

    UIVGenLog.info(UIVT('uiv.generator.outputFile', { name: finalFileName }));
    UIVGenLog.section(UIVT('uiv.generator.switchSection'));
    UIVGenLog.info(UIVT('uiv.generator.globalVars', { state: useGlobalVars ? UIVT('uiv.generator.on') : UIVT('uiv.generator.offStatic') }));
    UIVGenLog.info(UIVT('uiv.generator.pagination', { state: isPagination ? UIVT('uiv.generator.on') : UIVT('uiv.generator.offFirstPage') }));
    UIVGenLog.info(UIVT('uiv.generator.forceSum', {
        state: forceSumData && platform === 'DATAFAB' && compId ? UIVT('uiv.generator.on') : (forceSumData && (!compId) ? UIVT('uiv.generator.onMissingComp') : UIVT('uiv.generator.off'))
    }));
    UIVGenLog.info(UIVT('uiv.generator.runtimeMonth', { state: hasMonthFilter ? UIVT('uiv.generator.onMonthRange') : UIVT('uiv.generator.off') }));

    let paramsStr = JSON.stringify(payloadClone, null, 12);
    let varDefBlock = useGlobalVars
        ? `        // 🎯 全局变量控制台\n        const targetRegion = (typeof storedVars !== 'undefined' && storedVars['global_region']) ? storedVars['global_region'] : "北部非洲地区部";\n        const targetOffice = (typeof storedVars !== 'undefined' && storedVars['global_office']) ? storedVars['global_office'] : "埃及代表处";\n        const targetDate = (typeof storedVars !== 'undefined' && storedVars['global_start_date']) ? storedVars['global_start_date'] : "2026-01-01";`
        : `        // ⭐ 静态变量回退机制\n        const targetRegion = "北部非洲地区部";\n        const targetOffice = "埃及代表处";\n        const targetDate = "2026-01-01";`;

    if (useGlobalVars) {
        paramsStr = paramsStr.replace(/"北部非洲地区部"/g, 'targetRegion').replace(/"埃及代表处"/g, 'targetOffice');
    }
    if (hasCPC) paramsStr = paramsStr.replace(/"__CPC_IDS_PLACEHOLDER__"/g, 'cpcIds');

    const authCode = platform === 'DATAFAB'
        ? `        function getCookie(n){let m=document.cookie.match(new RegExp('(^| )'+n+'=([^;]+)'));return m?decodeURIComponent(m[2]):null;}\n        let csrfToken = getCookie("XSRF-TOKEN") || getCookie("NETLIVE-XSRF-TOKEN") || "";`
        : `        const cStr=localStorage.getItem('globalConfig'); let csrfToken="";\n        if(cStr){const m=cStr.match(/([A-Fa-f0-9]{64})/); if(m)csrfToken=m[0]; else try{let o=JSON.parse(cStr);csrfToken=o.csrfToken||(o.configData&&o.configData.csrfToken)||""}catch(e){} }`;
    const headerCode = platform === 'DATAFAB'
        ? `        const fetchHeaders = { "accept": "application/json, text/plain, */*", "content-type": "application/json;charset=UTF-8", "x-xsrf-token": csrfToken, "x-requested-with": "XMLHttpRequest", "tenantId": "${tenantIdStr}", "project-id": "${tenantIdStr}", "SESSION-AFFINITY-KEY": "${boardId}", "language": "zh_CN" };`
        : `        const fetchHeaders = { "accept": "application/json, text/plain, */*", "content-type": "application/json;charset=UTF-8", "x-gde-csrf-token": csrfToken, "x-requested-with": "XMLHttpRequest" };`;

    // 核心函数体
    const genTime = new Date().toLocaleString('zh-CN', { hour12: false });
    let coreBody = `        // ╔══════════════════════════════════════════════════╗\n        // ║  🚀 UIVF12 自动化抓取引擎  ${TOOL_VERSION}                 ║\n        // ║  生成时间: ${genTime}\n        // ║  URL: ${url}\n        // ╚══════════════════════════════════════════════════╝\n${varDefBlock}\n        // ==========================================\n\n${authCode}\n${headerCode}\n
        function getSmartValue(cell, colName, isTotal = false) {
            if (cell === null || cell === undefined) return "";
            if (typeof cell !== 'object') return cell;
            let isRate = false;
            if (colName && typeof colName === 'string') {
                let ln = colName.toLowerCase();
                if (ln.includes("率") || ln.includes("比") || ln.includes("rate") || ln.includes("ratio") || ln.includes("%")) isRate = true;
            }
            let val = "", source = "";
            if (cell.formula !== undefined && cell.formula !== null && typeof cell.formula === 'number') {
                val = cell.formula; source = "formula (绝对优先-数字)";
            } else if (cell.formula !== undefined && cell.formula !== null && typeof cell.formula === 'string' && cell.formula !== "") {
                val = cell.formula; source = "formula (绝对优先-文本)";
            } else if (isRate) {
                if (cell.average !== undefined && cell.average !== null && cell.average !== "") { val = cell.average; source = "average (率/比自动兜底)"; }
                else if (cell.summing !== undefined && cell.summing !== null && cell.summing !== "") { val = cell.summing; source = "summing (⚠️率/比被迫降级)"; }
            } else {
                if (cell.summing !== undefined && cell.summing !== null && cell.summing !== "") { val = cell.summing; source = "summing (常规累加)"; }
                else if (cell.average !== undefined && cell.average !== null && cell.average !== "") { val = cell.average; source = "average (⚠️常规被迫降级)"; }
            }
            if (val === "") { val = JSON.stringify(cell); source = "原始对象 (解析兜底)"; }
            if (isTotal) console.log("%c     ├─ [取数追踪] [" + colName + "] 匹配策略: " + source + " -> 值: " + val, "color: #00b894; font-size: 11px;");
            return val;
        }

        // 🔥 v6.5 多源聚合融合引擎 (Multi-source Fusion)
        // 不再单选第一个命中源，而是把 totalsData / sumData 全部吸出来深度融合
        // 优先保留任意源中存在 formula 的单元格，彻底根治平台数据割裂问题
        function extractSmartSumData(resObj) {
            if (!resObj) return null;
            const candidates = [];
            // --- totalsData 系列 ---
            if (resObj.totalsData && resObj.totalsData.columns) candidates.push(resObj.totalsData.columns);
            if (resObj.data && !Array.isArray(resObj.data) && resObj.data.totalsData && resObj.data.totalsData.columns) candidates.push(resObj.data.totalsData.columns);
            if (resObj.data && Array.isArray(resObj.data) && resObj.data[0] && resObj.data[0].totalsData && resObj.data[0].totalsData.columns) candidates.push(resObj.data[0].totalsData.columns);
            // --- sumData 系列 ---
            if (resObj.sumData) candidates.push(resObj.sumData);
            if (resObj.data && !Array.isArray(resObj.data) && resObj.data.sumData) candidates.push(resObj.data.sumData);
            if (resObj.data && Array.isArray(resObj.data) && resObj.data[0] && resObj.data[0].sumData) candidates.push(resObj.data[0].sumData);

            if (candidates.length === 0) return null;
            if (candidates.length === 1) return candidates[0];

            // 多源命中 → 按列名深度融合
            const hasFormula = (cell) => cell && (typeof cell.formula === 'number' || (typeof cell.formula === 'string' && cell.formula !== ''));
            const merged = {};
            candidates.forEach(src => {
                if (!src || typeof src !== 'object') return;
                Object.keys(src).forEach(col => {
                    if (!merged[col]) {
                        merged[col] = src[col];
                    } else {
                        const existing = merged[col], incoming = src[col];
                        if (incoming && typeof incoming === 'object') {
                            if (!hasFormula(existing) && hasFormula(incoming)) {
                                merged[col] = incoming;                     // 新源有 formula，整体替换
                            } else if (hasFormula(existing) && hasFormula(incoming)) {
                                merged[col] = Object.assign({}, existing, incoming); // 双方都有，字段级合并
                            }
                            // existing 有 formula 而 incoming 没有 → 保持 existing 不变
                        }
                    }
                });
            });
            console.log("%c     🔀 [v6.5 Fusion] 多源融合完成，命中源数: " + candidates.length + "，合并列数: " + Object.keys(merged).length, "color: #a29bfe; font-size: 11px;");
            return merged;
        }

         function extractRows(obj) {
             // Case 1: DataFab answerParamList 标准格式: { data: [{ data: [...], totalsData: {...} }] }
             if (obj && obj.data && Array.isArray(obj.data) && obj.data[0] && Array.isArray(obj.data[0].data)) return obj.data[0].data;
             // Case 2: ADMS/NetCare 嵌套格式: { data: { data: [...], total: N } }
             if (obj && obj.data && !Array.isArray(obj.data) && typeof obj.data === 'object') {
                 if (Array.isArray(obj.data.data))   return obj.data.data;
                 if (Array.isArray(obj.data.list))   return obj.data.list;
                 if (Array.isArray(obj.data.items))  return obj.data.items;
                 if (Array.isArray(obj.data.records)) return obj.data.records;
             }
             // Case 3: 顶层平铺格式: { results/items/list: [...] } 或 { data: [...] }
             let arr = obj.results || obj.items || obj.list || (obj.data && obj.data.results) || obj.data || [];
             return Array.isArray(arr) ? arr : (Array.isArray(obj) ? obj : [arr]);
         }

         // 🔬 自动扫描 getAnswers 响应中含 formulaId 的列，构建 aggFields 参数
         function extractAggFields(resObj) {
             const fields = [];
             const seen = new Set();
             function scan(obj) {
                 if (!obj || typeof obj !== 'object') return;
                 if (Array.isArray(obj)) { obj.forEach(scan); return; }
                 if (obj.formulaId && obj.displayName && !seen.has(obj.displayName)) {
                     seen.add(obj.displayName);
                     fields.push({ columnName: obj.displayName, aggType: 'formula' });
                 }
                 Object.values(obj).forEach(scan);
             }
             scan(resObj);
             return fields;
         }\n`;

    if (hasCPC) {
        coreBody += `
        // 🚀 阶段零：动态嗅探 CPC
        let d_pageId = "${pageId}"; let d_boardId = "${boardId}";
        if ((!d_pageId || !d_boardId) && typeof window !== 'undefined' && window.location.href.indexOf('/board/') !== -1) {
            const urlParts = window.location.href.split('?')[0].split('/');
            const bIdx = urlParts.indexOf('board');
            if (bIdx !== -1 && urlParts.length > bIdx + 2) {
                if (!d_boardId) d_boardId = urlParts[bIdx + 1];
                if (!d_pageId) d_pageId = urlParts[bIdx + 2];
            }
        }
        if (!d_pageId) throw new Error("未能获取 pageId！");
        const pvPayload = { "pageId": d_pageId, "boardId": d_boardId, "srcTenantId": "${tenantIdStr}", "behavior": "VIEW", "needTheme": 1 };
        const pvRes = await fetch("https://datafab-pro.gtsdata.huawei.com/DataFabKernelCn/v1/board/pageView", { headers: fetchHeaders, body: JSON.stringify(pvPayload), method: "POST", credentials: "include" });
        const pvData = await pvRes.json();
        const cpcIds = [...new Set(JSON.stringify(pvData).match(/CPC[0-9]+/g) || [])];
        if (cpcIds.length === 0) throw new Error("未能提取到任何 CPC 单号。");\n`;
    }

    coreBody += `
        const baseDetailPayload = ${paramsStr.replace(/"targetRegion"/g, 'targetRegion').replace(/"targetOffice"/g, 'targetOffice')};\n`;

    if (hasNID) {
        coreBody += `
        // 🚀 阶段零扩展：动态嗅探 NetCare NID
        let fetchedNids = [];
        try {
            const nidUrl = "${url}".substring(0, "${url}".lastIndexOf('/')) + "/op_ex_rectify_check_special_nid";
            const nidRes = await fetch(nidUrl, { headers: fetchHeaders, body: "{}", method: "POST", credentials: "include" });
            const nidData = await nidRes.json();
            let pLines = baseDetailPayload.product_line || (baseDetailPayload.params && baseDetailPayload.params.product_line) || [];
            if (Array.isArray(pLines) && pLines.length > 0) {
                pLines.forEach(pl => { if (nidData[pl] && Array.isArray(nidData[pl])) fetchedNids = fetchedNids.concat(nidData[pl]); });
            } else { Object.values(nidData).forEach(arr => { if (Array.isArray(arr)) fetchedNids = fetchedNids.concat(arr); }); }
            fetchedNids = [...new Set(fetchedNids)];
        } catch(e) { console.error("动态抓取 NID 失败: " + e.message); }\n`;
    }

    coreBody += `
        const sysDate = new Date();
        const currentYear = sysDate.getFullYear(); const currentMonth = sysDate.getMonth() + 1;
        const prevDateObj = new Date(sysDate.getFullYear(), sysDate.getMonth() - 1, 1);
        const prevYear = prevDateObj.getFullYear(); const prevMonth = prevDateObj.getMonth() + 1;
        const padZ = (n) => n.toString().padStart(2, '0');
        const currentMonthEndDay = new Date(currentYear, currentMonth, 0).getDate();
        const currentStartStr = currentYear + "-" + padZ(currentMonth) + "-01";
        const currentEndStr = currentYear + "-" + padZ(currentMonth) + "-" + padZ(currentMonthEndDay);
        const prevMonthEndDay = new Date(prevYear, prevMonth, 0).getDate();
        const prevStartStr = prevYear + "-" + padZ(prevMonth) + "-01";
        const prevEndStr = prevYear + "-" + padZ(prevMonth) + "-" + padZ(prevMonthEndDay);

        let runConfigs = [ { month: null, year: null, startDate: null, endDate: null, label: "默认" } ];
${hasMonthFilter ? `        runConfigs = [
            { year: currentYear.toString(), month: padZ(currentMonth), startDate: currentStartStr, endDate: currentEndStr, label: "当月" },
            { year: prevYear.toString(), month: padZ(prevMonth), startDate: prevStartStr, endDate: prevEndStr, label: "上月" }
        ];` : ''}

        let finalSummary = [];

        for (let runIdx = 0; runIdx < runConfigs.length; runIdx++) {
            let config = runConfigs[runIdx];
            let branchName = config.month ? config.label + " (" + config.year + "-" + config.month + ")" : "基础任务";
            console.log("%c   ↳ 运行分支: " + branchName + "...", "color: #8e44ad; font-size: 13px; font-weight: bold;");

            let currentPayloadStr = JSON.stringify(baseDetailPayload);
            if (config.month) currentPayloadStr = currentPayloadStr.replace(/"__MONTH_PLACEHOLDER__"/g, JSON.stringify([config.month]));
            if (config.year) currentPayloadStr = currentPayloadStr.replace(/"__YEAR_PLACEHOLDER__"/g, JSON.stringify([config.year]));
            if (config.startDate) currentPayloadStr = currentPayloadStr.replace(/__START_DATE_PLACEHOLDER__/g, config.startDate);
            if (config.endDate) currentPayloadStr = currentPayloadStr.replace(/__END_DATE_PLACEHOLDER__/g, config.endDate);
${hasNID ? `            currentPayloadStr = currentPayloadStr.replace(/"__NID_PLACEHOLDER__"/g, JSON.stringify(fetchedNids));` : ''}

            const detailPayload = JSON.parse(currentPayloadStr);
            let limitVal = parseInt(detailPayload.limit || (detailPayload.answerParamList && detailPayload.answerParamList[0] && detailPayload.answerParamList[0].pageSize) || 50, 10);
             let allDataResults = []; let globalSumData = null; let aggFields = []; let currentPage = 1; let isFetching = true;

            while (isFetching) {
${isPagination ? `                if (detailPayload.answerParamList && detailPayload.answerParamList[0]) {
                    detailPayload.answerParamList[0].pageNum = currentPage;
                    detailPayload.answerParamList[0].requestTime = Date.now();
                }
                if (detailPayload.start !== undefined) detailPayload.start = (currentPage - 1) * limitVal;
                if (detailPayload.pageNum !== undefined && !detailPayload.answerParamList) detailPayload.pageNum = currentPage;
                if (detailPayload.pageIndex !== undefined) detailPayload.pageIndex = currentPage;
                if (detailPayload.page !== undefined) detailPayload.page = currentPage;` : ''}
                const response = await fetch("${url}", { headers: fetchHeaders, body: JSON.stringify(detailPayload), method: "POST", credentials: "include" });
                const data = await response.json();
                if (data.status === 9999 || data.errorCode === "9999") throw new Error("请求报错 (9999)：请检查登录状态。");
                if (!globalSumData) globalSumData = extractSmartSumData(data);
                if (aggFields.length === 0) aggFields = extractAggFields(data);
                let pageItems = extractRows(data);
                if (!pageItems || pageItems.length === 0) break;
                allDataResults = allDataResults.concat(pageItems);
                if (pageItems.length < limitVal) break;
                currentPage++; await new Promise(r => setTimeout(r, 300));
            }

            if (allDataResults.length === 0) { console.warn("⚠️ " + branchName + " 未提取到数据，跳过。"); continue; }
${forceSumData && platform === 'DATAFAB' && compId ? `
            // 🔑 v6.5 强制权威数据源：无论 getAnswers 是否已返回 sumData，
            // 始终独立请求 getValueTableSumData，因为它才含有准确的 formula。
            // getAnswers 的 sumData 只含 average，不能作为最终来源。
            console.log("%c     🔄 [权威数据] 强制请求 getValueTableSumData（含 formula 的唯一可信来源）...", "color: #3498db; font-size: 11px; font-weight: bold;");
            const sumPayload = JSON.parse(JSON.stringify(detailPayload.answerParamList[0]));
            sumPayload.pageNum = 1; sumPayload.answerSource = 2;
            if (aggFields.length > 0) console.log("%c     🔬 [aggFields] 检测到 " + aggFields.length + " 个 formulaId 列: " + aggFields.map(f=>f.columnName).join('、'), "color: #fd79a8; font-size: 11px;");
            const sumReqPayload = { "id": "${compId}", "srcTenantId": detailPayload.srcTenantId, "behavior": "VIEW", "boardId": "${boardId}", "maxRows": 1000, "pageNum": 1, "pageSize": 50, "calStatistic": true, "params": sumPayload.params, "chartType": "table", "answerSource": 2, ...(aggFields.length > 0 ? { aggFields } : {}) };
            try {
                const sumRes = await fetch("https://datafab-pro.gtsdata.huawei.com/DataFabKernelCn/v1/answer/getValueTableSumData", { headers: fetchHeaders, body: JSON.stringify(sumReqPayload), method: "POST", credentials: "include" });
                const sumDataRes = await sumRes.json();
                const authSumData = extractSmartSumData(sumDataRes);
                if (authSumData) {
                    globalSumData = authSumData;
                    console.log("%c     ✅ [权威数据] getValueTableSumData 成功，已覆盖 getAnswers 的汇总（formula 优先）", "color: #2ecc71; font-size: 11px;");
                } else if (globalSumData) {
                    console.warn("     ⚠️ [权威数据] getValueTableSumData 无数据，保留 getAnswers 汇总（注意：可能无 formula）");
                } else {
                    console.warn("     ❌ [权威数据] 两路径均未获取到汇总数据。");
                }
            } catch(e) { console.error("权威大盘请求异常: ", e); }` : `
            if (globalSumData) { console.log("%c     ✅ 原生截获总计数据成功。", "color: #2ecc71; font-size: 11px;"); }
            else { console.log("%c     ℹ️ 报文中无总计数据 (未开启独立兜底)。", "color: #95a5a6; font-size: 11px;"); }`}

            const headers = [];
            allDataResults.forEach(row => { Object.keys(row).forEach(k => { if (!headers.includes(k)) headers.push(k); }); });
            if (globalSumData) {
                console.log("%c     📊 开始解析大盘总计行列值...", "color: #0984e3; font-size: 11px; font-weight: bold;");
                let totalRow = {}; totalRow[headers[0]] = "【总计】";
                for (let i = 1; i < headers.length; i++) { totalRow[headers[i]] = getSmartValue(globalSumData[headers[i]], headers[i], true); }
                allDataResults.push(totalRow);
            }

            let csvContent = String.fromCharCode(0xFEFF) + headers.join(",") + String.fromCharCode(10);
            allDataResults.forEach(function(row) {
                let rowArray = headers.map(header => {
                    let cellVal = getSmartValue(row[header], header, false);
                    return '"' + String(cellVal).replace(/"/g, '""') + '"';
                });
                csvContent += rowArray.join(",") + String.fromCharCode(10);
            });

            let finalOutputName = "${finalFileName}";
            if (config.month) finalOutputName = finalOutputName.replace(".csv", "_" + config.year + "年" + config.month + "月.csv");
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
            link.download = finalOutputName; document.body.appendChild(link); link.click(); document.body.removeChild(link);

            let reportLine = config.label + (config.month ? "(" + config.month + "月)" : "") + ": " + (allDataResults.length - (globalSumData ? 1 : 0)) + " 条";
            finalSummary.push(reportLine);
            console.log("%c      ✔️ " + branchName + " 数据已触发下载！", "color: #2ecc71;");
            if (runIdx < runConfigs.length - 1) await new Promise(r => setTimeout(r, 1500));
        }\n`;

    const uivTemplate = `return (async function() {\n    try {\n${coreBody}\n        return "✅ 导出成功！子任务: " + finalSummary.join(" | ");\n    } catch (error) {\n        return "❌ 报错: " + error.message;\n    }\n})();`;
    const consoleTemplate = `(async function() {\n    try {\n        console.log("%c🚀 [UIVF12 ${TOOL_VERSION}] 任务列车启动，请保持页面开启并耐心等待...", "color: #e67e22; font-size: 14px; font-weight: bold;");\n${coreBody}\n        console.log("%c🎉 [UIVF12 ${TOOL_VERSION}] 任务圆满成功！提取报告: " + finalSummary.join(" | "), "color: #4CAF50; font-size: 14px; font-weight: bold;");\n    } catch (error) {\n        console.error("%c❌ [UIVF12 ${TOOL_VERSION}] 内部报错: " + error.message, "color: #c53030; font-size: 13px; font-weight: bold;");\n    }\n})();`;

    UIVGenLog.section(UIVT('uiv.generator.buildSection'));
    UIVGenLog.info(UIVT('uiv.generator.scriptTitle', { title }));
    UIVGenLog.info(UIVT('uiv.generator.auth', { auth: platform === 'DATAFAB' ? UIVT('uiv.generator.cookieAuth') : UIVT('uiv.generator.localAuth') }));
    document.getElementById('codeOutput').value = uivTemplate;
    document.getElementById('consoleOutput').value = consoleTemplate;
    UIVGenLog.success(UIVT('uiv.generator.outputReady'));
    UIVGenLog.done(true, title);
}

window.UIVGenerator = { generateScript };
