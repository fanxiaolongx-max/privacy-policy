/**
 * uivf12/generator.js - 脚本生成引擎
 * 完整移植原版生成逻辑，生成 UIV 宏代码和 F12 控制台脚本
 */

function generateScript() {
    const errorDiv = document.getElementById('errorMsg');
    errorDiv.innerText = '';

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
    if (!parsedPayloadObj) { errorDiv.innerText = '请先提供有效的 Payload JSON！'; return; }

    const platform = url.includes('datafab') ? 'DATAFAB' : (url.includes('netcare') ? 'NETCARE' : 'CUSTOM');
    let payloadClone = JSON.parse(JSON.stringify(parsedPayloadObj));

    if (platform === 'NETCARE') payloadClone.need_summary = true;

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

    const pageId = window.UIVWorkbench.findKeyDeep(payloadClone, 'pageId') || '';
    const boardId = window.UIVWorkbench.findKeyDeep(payloadClone, 'boardId') || '';
    const tenantIdStr = window.UIVWorkbench.findKeyDeep(payloadClone, 'srcTenantId') || '';
    let dynamicPageName = window.UIVWorkbench.findKeyDeep(payloadClone, 'pageName') || '';
    const compId = window.UIVWorkbench.findKeyDeep(payloadClone, 'id') || '';

    if (autoFetchCPC && platform === 'DATAFAB' && hasCPC && !pageId) {
        errorDiv.innerText = '⚠️ 警告：缺少 pageId！已生成自动嗅探代码。';
    }
    if (dynamicPageName) dynamicPageName = '_' + dynamicPageName.replace(/[<>:"/\\|?*]+/g, '');
    const finalFileName = fileNameBase + dynamicPageName + '_Latest.csv';

    const title = fileNameBase + dynamicPageName;
    window.UIVWorkbench.setCurrentTitle(title + (!dynamicPageName && compId ? '_' + compId.substring(0, 6) : ''));

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
    let coreBody = `        // 【自动生成：抓取核心引擎】========================\n        // 🚀 URL: ${url}\n        // ==========================================\n${varDefBlock}\n        // ==========================================\n\n${authCode}\n${headerCode}\n
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

        function extractSmartSumData(resObj) {
            if (!resObj) return null;
            if (resObj.totalsData && resObj.totalsData.columns) return resObj.totalsData.columns;
            if (resObj.data && !Array.isArray(resObj.data) && resObj.data.totalsData && resObj.data.totalsData.columns) return resObj.data.totalsData.columns;
            if (resObj.data && Array.isArray(resObj.data) && resObj.data[0] && resObj.data[0].totalsData && resObj.data[0].totalsData.columns) return resObj.data[0].totalsData.columns;
            if (resObj.sumData) return resObj.sumData;
            if (resObj.data && !Array.isArray(resObj.data) && resObj.data.sumData) return resObj.data.sumData;
            if (resObj.data && Array.isArray(resObj.data) && resObj.data[0] && resObj.data[0].sumData) return resObj.data[0].sumData;
            return null;
        }

        function extractRows(obj) {
            if (obj && obj.data && Array.isArray(obj.data) && obj.data[0] && Array.isArray(obj.data[0].data)) return obj.data[0].data;
            let arr = obj.results || obj.items || obj.list || (obj.data && obj.data.results) || obj.data || [];
            return Array.isArray(arr) ? arr : (Array.isArray(obj) ? obj : [arr]);
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
            let allDataResults = []; let globalSumData = null; let currentPage = 1; let isFetching = true;

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
                let pageItems = extractRows(data);
                if (!pageItems || pageItems.length === 0) break;
                allDataResults = allDataResults.concat(pageItems);
                if (pageItems.length < limitVal) break;
                currentPage++; await new Promise(r => setTimeout(r, 300));
            }

            if (allDataResults.length === 0) { console.warn("⚠️ " + branchName + " 未提取到数据，跳过。"); continue; }
${forceSumData && platform === 'DATAFAB' && compId ? `
            if (!globalSumData) {
                console.log("%c     ⚠️ 一阶段未截获到总计数据，触发独立大盘兜底请求...", "color: #e1b12c; font-size: 11px;");
                const sumPayload = JSON.parse(JSON.stringify(detailPayload.answerParamList[0]));
                sumPayload.pageNum = 1; sumPayload.answerSource = 2;
                const sumReqPayload = { "id": "${compId}", "srcTenantId": detailPayload.srcTenantId, "behavior": "VIEW", "boardId": "${boardId}", "maxRows": 1000, "pageNum": 1, "pageSize": 50, "calStatistic": true, "params": sumPayload.params, "chartType": "table", "answerSource": 2 };
                try {
                    const sumRes = await fetch("https://datafab-pro.gtsdata.huawei.com/DataFabKernelCn/v1/answer/getValueTableSumData", { headers: fetchHeaders, body: JSON.stringify(sumReqPayload), method: "POST", credentials: "include" });
                    const sumDataRes = await sumRes.json();
                    globalSumData = extractSmartSumData(sumDataRes);
                    if (globalSumData) console.log("%c     ✅ 兜底成功，已获取大盘数据！", "color: #2ecc71; font-size: 11px;");
                    else console.warn("     ❌ 兜底失败，未能提取到总计数据。");
                } catch(e) { console.error("大盘兜底请求异常: ", e); }
            } else { console.log("%c     ✅ 一阶段原生截获总计成功，无需兜底请求。", "color: #2ecc71; font-size: 11px;"); }` : `
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
    const consoleTemplate = `(async function() {\n    try {\n        console.log("%c🚀 [单次抓取] 任务列车启动，请保持页面开启并耐心等待...", "color: #e67e22; font-size: 14px; font-weight: bold;");\n${coreBody}\n        console.log("%c🎉 [单次抓取] 任务圆满成功！提取报告: " + finalSummary.join(" | "), "color: #4CAF50; font-size: 14px; font-weight: bold;");\n    } catch (error) {\n        console.error("%c❌ 内部报错: " + error.message, "color: #c53030; font-size: 13px; font-weight: bold;");\n    }\n})();`;

    document.getElementById('codeOutput').value = uivTemplate;
    document.getElementById('consoleOutput').value = consoleTemplate;
}

window.UIVGenerator = { generateScript };
