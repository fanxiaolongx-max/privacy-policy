#!/usr/bin/env python3
"""Generate UIV/F12 data capture scripts from API payloads.

This is a Python port of the UIVF12 generator.js, allowing Agents
to generate data extraction scripts without needing the Web UI.
"""

import argparse
import json
import re
from pathlib import Path
from typing import Any

TOOL_VERSION = 'v6.6 (Python Port)'

def find_key_deep(obj: Any, target_key: str) -> Any:
    if isinstance(obj, dict):
        if target_key in obj:
            return obj[target_key]
        for v in obj.values():
            res = find_key_deep(v, target_key)
            if res:
                return res
    elif isinstance(obj, list):
        for item in obj:
            res = find_key_deep(item, target_key)
            if res:
                return res
    return None

def traverse_payload(obj: Any, platform: str, auto_cpc: bool, auto_month: bool) -> tuple[bool, bool, bool]:
    has_cpc = False
    has_nid = False
    has_month = False
    
    def walk(o: Any):
        nonlocal has_cpc, has_nid, has_month
        if isinstance(o, dict):
            if platform == 'DATAFAB' and auto_cpc and o.get('column') == 'cpc' and isinstance(o.get('values'), list):
                has_cpc = True
                o['values'] = '__CPC_IDS_PLACEHOLDER__'
            if platform == 'NETCARE' and auto_cpc:
                if 'nid' in o and isinstance(o['nid'], list):
                    has_nid = True
                    o['nid'] = '__NID_PLACEHOLDER__'
                if 'nid_name' in o and isinstance(o['nid_name'], list):
                    has_nid = True
                    o['nid_name'] = '__NID_PLACEHOLDER__'
            if auto_month:
                if isinstance(o.get('column'), str) and isinstance(o.get('values'), list) and len(o['values']) == 1 and isinstance(o['values'][0], str):
                    if 'month' in o['column'].lower() and re.match(r'^[0-9]{1,2}$', o['values'][0]):
                        has_month = True
                        o['values'] = '__MONTH_PLACEHOLDER__'
                    if 'year' in o['column'].lower() and re.match(r'^[0-9]{4}$', o['values'][0]):
                        o['values'] = '__YEAR_PLACEHOLDER__'
                
                s_key = None
                e_key = None
                for k, v in o.items():
                    if ('start_date' in k.lower() or k.lower() == 'startdate') and isinstance(v, str) and re.match(r'^[0-9]{4}-[0-9]{2}-[0-9]{2}', v):
                        s_key = k
                    if ('end_date' in k.lower() or k.lower() == 'enddate') and isinstance(v, str) and re.match(r'^[0-9]{4}-[0-9]{2}-[0-9]{2}', v):
                        e_key = k
                if s_key and e_key:
                    s_month = o[s_key][:7]
                    e_month = o[e_key][:7]
                    if s_month == e_month:
                        has_month = True
                        o[s_key] = '__START_DATE_PLACEHOLDER__' + o[s_key][10:]
                        o[e_key] = '__END_DATE_PLACEHOLDER__' + o[e_key][10:]
            
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for item in o:
                walk(item)
                
    walk(obj)
    return has_cpc, has_nid, has_month

def main():
    parser = argparse.ArgumentParser(description="Generate UIV data capture scripts.")
    parser.add_argument("--payload", required=True, help="Path to JSON payload file.")
    parser.add_argument("--url", required=True, help="Target API URL.")
    parser.add_argument("--name", default="PBI_Data", help="Base filename.")
    parser.add_argument("--global-vars", action="store_true", help="Use global variables for region/office/date.")
    parser.add_argument("--pagination", action="store_true", help="Enable pagination scraping.")
    parser.add_argument("--force-sum", action="store_true", help="Force fetching summary data independently.")
    parser.add_argument("--auto-cpc", action="store_true", help="Auto detect and inject CPC/NID.")
    parser.add_argument("--auto-month", action="store_true", help="Auto split months (current and previous).")
    parser.add_argument("--output-uiv", help="Output file for UIV Macro script.")
    parser.add_argument("--output-console", help="Output file for F12 Console script.")
    args = parser.parse_args()

    payload_path = Path(args.payload).expanduser().resolve()
    if not payload_path.exists():
        print(f"Error: Payload file not found: {payload_path}")
        return 1

    try:
        payload = json.loads(payload_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"Error parsing payload JSON: {e}")
        return 1

    url = args.url.strip()
    platform = 'DATAFAB' if 'datafab' in url else ('NETCARE' if 'netcare' in url else 'CUSTOM')

    if platform == 'NETCARE':
        payload['need_summary'] = True

    has_cpc, has_nid, has_month = traverse_payload(payload, platform, args.auto_cpc, args.auto_month)

    page_id = find_key_deep(payload, 'pageId') or ''
    board_id = find_key_deep(payload, 'boardId') or ''
    tenant_id_str = find_key_deep(payload, 'srcTenantId') or ''
    dynamic_page_name = find_key_deep(payload, 'pageName') or ''
    comp_id = find_key_deep(payload, 'id') or ''

    if dynamic_page_name:
        dynamic_page_name = '_' + re.sub(r'[<>\:"/\\|?*]+', '', str(dynamic_page_name))
    
    final_file_name = f"{args.name}{dynamic_page_name}_Latest.csv"

    params_str = json.dumps(payload, indent=12, ensure_ascii=False)
    
    if args.global_vars:
        var_def_block = """        // 🎯 全局变量控制台
        const targetRegion = (typeof storedVars !== 'undefined' && storedVars['global_region']) ? storedVars['global_region'] : "北部非洲地区部";
        const targetOffice = (typeof storedVars !== 'undefined' && storedVars['global_office']) ? storedVars['global_office'] : "埃及代表处";
        const targetDate = (typeof storedVars !== 'undefined' && storedVars['global_start_date']) ? storedVars['global_start_date'] : "2026-01-01";"""
        params_str = params_str.replace('"北部非洲地区部"', 'targetRegion').replace('"埃及代表处"', 'targetOffice')
    else:
        var_def_block = """        // ⭐ 静态变量回退机制
        const targetRegion = "北部非洲地区部";
        const targetOffice = "埃及代表处";
        const targetDate = "2026-01-01";"""

    if has_cpc:
        params_str = params_str.replace('"__CPC_IDS_PLACEHOLDER__"', 'cpcIds')

    auth_code = """        function getCookie(n){let m=document.cookie.match(new RegExp('(^| )'+n+'=([^;]+)'));return m?decodeURIComponent(m[2]):null;}
        let csrfToken = getCookie("XSRF-TOKEN") || getCookie("NETLIVE-XSRF-TOKEN") || "";""" if platform == 'DATAFAB' else """        const cStr=localStorage.getItem('globalConfig'); let csrfToken="";
        if(cStr){const m=cStr.match(/([A-Fa-f0-9]{64})/); if(m)csrfToken=m[0]; else try{let o=JSON.parse(cStr);csrfToken=o.csrfToken||(o.configData&&o.configData.csrfToken)||""}catch(e){} }"""

    header_code = f"""        const fetchHeaders = {{ "accept": "application/json, text/plain, */*", "content-type": "application/json;charset=UTF-8", "x-xsrf-token": csrfToken, "x-requested-with": "XMLHttpRequest", "tenantId": "{tenant_id_str}", "project-id": "{tenant_id_str}", "SESSION-AFFINITY-KEY": "{board_id}", "language": "zh_CN" }};""" if platform == 'DATAFAB' else """        const fetchHeaders = { "accept": "application/json, text/plain, */*", "content-type": "application/json;charset=UTF-8", "x-gde-csrf-token": csrfToken, "x-requested-with": "XMLHttpRequest" };"""

    core_body = f"""        // ╔══════════════════════════════════════════════════╗
        // ║  🚀 UIVF12 自动化抓取引擎  {TOOL_VERSION}
        // ║  URL: {url}
        // ╚══════════════════════════════════════════════════╝
{var_def_block}
        // ==========================================

{auth_code}
{header_code}

        function getSmartValue(cell, colName, isTotal = false) {{
            if (cell === null || cell === undefined) return "";
            if (typeof cell !== 'object') return cell;
            let isRate = false;
            if (colName && typeof colName === 'string') {{
                let ln = colName.toLowerCase();
                if (ln.includes("率") || ln.includes("比") || ln.includes("rate") || ln.includes("ratio") || ln.includes("%")) isRate = true;
            }}
            let val = "", source = "";
            if (cell.formula !== undefined && cell.formula !== null && typeof cell.formula === 'number') {{
                val = cell.formula; source = "formula (绝对优先-数字)";
            }} else if (cell.formula !== undefined && cell.formula !== null && typeof cell.formula === 'string' && cell.formula !== "") {{
                val = cell.formula; source = "formula (绝对优先-文本)";
            }} else if (isRate) {{
                if (cell.average !== undefined && cell.average !== null && cell.average !== "") {{ val = cell.average; source = "average (率/比自动兜底)"; }}
                else if (cell.summing !== undefined && cell.summing !== null && cell.summing !== "") {{ val = cell.summing; source = "summing (⚠️率/比被迫降级)"; }}
            }} else {{
                if (cell.summing !== undefined && cell.summing !== null && cell.summing !== "") {{ val = cell.summing; source = "summing (常规累加)"; }}
                else if (cell.average !== undefined && cell.average !== null && cell.average !== "") {{ val = cell.average; source = "average (⚠️常规被迫降级)"; }}
            }}
            if (val === "") {{ val = JSON.stringify(cell); source = "原始对象 (解析兜底)"; }}
            if (isTotal) console.log("%c     ├─ [取数追踪] [" + colName + "] 匹配策略: " + source + " -> 值: " + val, "color: #00b894; font-size: 11px;");
            return val;
        }}

        function extractSmartSumData(resObj) {{
            if (!resObj) return null;
            const candidates = [];
            if (resObj.totalsData && resObj.totalsData.columns) candidates.push(resObj.totalsData.columns);
            if (resObj.data && !Array.isArray(resObj.data) && resObj.data.totalsData && resObj.data.totalsData.columns) candidates.push(resObj.data.totalsData.columns);
            if (resObj.data && Array.isArray(resObj.data) && resObj.data[0] && resObj.data[0].totalsData && resObj.data[0].totalsData.columns) candidates.push(resObj.data[0].totalsData.columns);
            if (resObj.sumData) candidates.push(resObj.sumData);
            if (resObj.data && !Array.isArray(resObj.data) && resObj.data.sumData) candidates.push(resObj.data.sumData);
            if (resObj.data && Array.isArray(resObj.data) && resObj.data[0] && resObj.data[0].sumData) candidates.push(resObj.data[0].sumData);

            if (candidates.length === 0) return null;
            if (candidates.length === 1) return candidates[0];

            const hasFormula = (cell) => cell && (typeof cell.formula === 'number' || (typeof cell.formula === 'string' && cell.formula !== ''));
            const merged = {{}};
            candidates.forEach(src => {{
                if (!src || typeof src !== 'object') return;
                Object.keys(src).forEach(col => {{
                    if (!merged[col]) {{
                        merged[col] = src[col];
                    }} else {{
                        const existing = merged[col], incoming = src[col];
                        if (incoming && typeof incoming === 'object') {{
                            if (!hasFormula(existing) && hasFormula(incoming)) {{
                                merged[col] = incoming;
                            }} else if (hasFormula(existing) && hasFormula(incoming)) {{
                                merged[col] = Object.assign({{}}, existing, incoming);
                            }}
                        }}
                    }}
                }});
            }});
            return merged;
        }}

         function extractRows(obj) {{
             if (obj && obj.data && Array.isArray(obj.data) && obj.data[0] && Array.isArray(obj.data[0].data)) return obj.data[0].data;
             if (obj && obj.data && !Array.isArray(obj.data) && typeof obj.data === 'object') {{
                 if (Array.isArray(obj.data.data))   return obj.data.data;
                 if (Array.isArray(obj.data.list))   return obj.data.list;
                 if (Array.isArray(obj.data.items))  return obj.data.items;
                 if (Array.isArray(obj.data.records)) return obj.data.records;
             }}
             let arr = obj.results || obj.items || obj.list || (obj.data && obj.data.results) || obj.data || [];
             return Array.isArray(arr) ? arr : (Array.isArray(obj) ? obj : [arr]);
         }}

         function extractAggFields(resObj) {{
             const fields = [];
             const seen = new Set();
             function scan(obj) {{
                 if (!obj || typeof obj !== 'object') return;
                 if (Array.isArray(obj)) {{ obj.forEach(scan); return; }}
                 if (obj.formulaId && obj.displayName && !seen.has(obj.displayName)) {{
                     seen.add(obj.displayName);
                     fields.push({{ columnName: obj.displayName, aggType: 'formula' }});
                 }}
                 Object.values(obj).forEach(scan);
             }}
             scan(resObj);
             return fields;
         }}
"""

    if has_cpc:
        core_body += f"""
        // 🚀 阶段零：动态嗅探 CPC
        let d_pageId = "{page_id}"; let d_boardId = "{board_id}";
        if ((!d_pageId || !d_boardId) && typeof window !== 'undefined' && window.location.href.indexOf('/board/') !== -1) {{
            const urlParts = window.location.href.split('?')[0].split('/');
            const bIdx = urlParts.indexOf('board');
            if (bIdx !== -1 && urlParts.length > bIdx + 2) {{
                if (!d_boardId) d_boardId = urlParts[bIdx + 1];
                if (!d_pageId) d_pageId = urlParts[bIdx + 2];
            }}
        }}
        if (!d_pageId) throw new Error("未能获取 pageId！");
        const pvPayload = {{ "pageId": d_pageId, "boardId": d_boardId, "srcTenantId": "{tenant_id_str}", "behavior": "VIEW", "needTheme": 1 }};
        const pvRes = await fetch("https://datafab-pro.gtsdata.huawei.com/DataFabKernelCn/v1/board/pageView", {{ headers: fetchHeaders, body: JSON.stringify(pvPayload), method: "POST", credentials: "include" }});
        const pvData = await pvRes.json();
        const cpcIds = [...new Set(JSON.stringify(pvData).match(/CPC[0-9]+/g) || [])];
        if (cpcIds.length === 0) throw new Error("未能提取到任何 CPC 单号。");
"""

    params_str = params_str.replace('"targetRegion"', 'targetRegion').replace('"targetOffice"', 'targetOffice')
    core_body += f"""
        const baseDetailPayload = {params_str};
"""

    if has_nid:
        core_body += f"""
        // 🚀 阶段零扩展：动态嗅探 NetCare NID
        let fetchedNids = [];
        try {{
            const nidUrl = "{url}".substring(0, "{url}".lastIndexOf('/')) + "/op_ex_rectify_check_special_nid";
            const nidRes = await fetch(nidUrl, {{ headers: fetchHeaders, body: "{{}}", method: "POST", credentials: "include" }});
            const nidData = await nidRes.json();
            let pLines = baseDetailPayload.product_line || (baseDetailPayload.params && baseDetailPayload.params.product_line) || [];
            if (Array.isArray(pLines) && pLines.length > 0) {{
                pLines.forEach(pl => {{ if (nidData[pl] && Array.isArray(nidData[pl])) fetchedNids = fetchedNids.concat(nidData[pl]); }});
            }} else {{ Object.values(nidData).forEach(arr => {{ if (Array.isArray(arr)) fetchedNids = fetchedNids.concat(arr); }}); }}
            fetchedNids = [...new Set(fetchedNids)];
        }} catch(e) {{ console.error("动态抓取 NID 失败: " + e.message); }}
"""

    month_config = """        runConfigs = [
            { year: currentYear.toString(), month: padZ(currentMonth), startDate: currentStartStr, endDate: currentEndStr, label: "当月" },
            { year: prevYear.toString(), month: padZ(prevMonth), startDate: prevStartStr, endDate: prevEndStr, label: "上月" }
        ];""" if has_month else """        runConfigs = [ { month: null, year: null, startDate: null, endDate: null, label: "默认" } ];"""

    pagination_code = """                if (detailPayload.answerParamList && detailPayload.answerParamList[0]) {
                    detailPayload.answerParamList[0].pageNum = currentPage;
                    detailPayload.answerParamList[0].requestTime = Date.now();
                }
                if (detailPayload.start !== undefined) detailPayload.start = (currentPage - 1) * limitVal;
                if (detailPayload.pageNum !== undefined && !detailPayload.answerParamList) detailPayload.pageNum = currentPage;
                if (detailPayload.pageIndex !== undefined) detailPayload.pageIndex = currentPage;
                if (detailPayload.page !== undefined) detailPayload.page = currentPage;""" if args.pagination else ""

    force_sum_code = f"""
            // 🔑 v6.5 强制权威数据源
            console.log("%c     🔄 [权威数据] 强制请求 getValueTableSumData（含 formula 的唯一可信来源）...", "color: #3498db; font-size: 11px; font-weight: bold;");
            const sumPayload = JSON.parse(JSON.stringify(detailPayload.answerParamList[0]));
            sumPayload.pageNum = 1; sumPayload.answerSource = 2;
            if (aggFields.length > 0) console.log("%c     🔬 [aggFields] 检测到 " + aggFields.length + " 个 formulaId 列: " + aggFields.map(f=>f.columnName).join('、'), "color: #fd79a8; font-size: 11px;");
            const sumReqPayload = {{ "id": "{comp_id}", "srcTenantId": detailPayload.srcTenantId, "behavior": "VIEW", "boardId": "{board_id}", "maxRows": 1000, "pageNum": 1, "pageSize": 50, "calStatistic": true, "params": sumPayload.params, "chartType": "table", "answerSource": 2, ...(aggFields.length > 0 ? {{ aggFields }} : {{}}) }};
            try {{
                const sumRes = await fetch("https://datafab-pro.gtsdata.huawei.com/DataFabKernelCn/v1/answer/getValueTableSumData", {{ headers: fetchHeaders, body: JSON.stringify(sumReqPayload), method: "POST", credentials: "include" }});
                const sumDataRes = await sumRes.json();
                const authSumData = extractSmartSumData(sumDataRes);
                if (authSumData) {{
                    globalSumData = authSumData;
                    console.log("%c     ✅ [权威数据] getValueTableSumData 成功，已覆盖 getAnswers 的汇总（formula 优先）", "color: #2ecc71; font-size: 11px;");
                }} else if (globalSumData) {{
                    console.warn("     ⚠️ [权威数据] getValueTableSumData 无数据，保留 getAnswers 汇总（注意：可能无 formula）");
                }} else {{
                    console.warn("     ❌ [权威数据] 两路径均未获取到汇总数据。");
                }}
            }} catch(e) {{ console.error("权威大盘请求异常: ", e); }}""" if (args.force_sum and platform == 'DATAFAB' and comp_id) else """
            if (globalSumData) { console.log("%c     ✅ 原生截获总计数据成功。", "color: #2ecc71; font-size: 11px;"); }
            else { console.log("%c     ℹ️ 报文中无总计数据 (未开启独立兜底)。", "color: #95a5a6; font-size: 11px;"); }"""

    core_body += f"""
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

        let runConfigs;
{month_config}

        let finalSummary = [];

        for (let runIdx = 0; runIdx < runConfigs.length; runIdx++) {{
            let config = runConfigs[runIdx];
            let branchName = config.month ? config.label + " (" + config.year + "-" + config.month + ")" : "基础任务";
            console.log("%c   ↳ 运行分支: " + branchName + "...", "color: #8e44ad; font-size: 13px; font-weight: bold;");

            let currentPayloadStr = JSON.stringify(baseDetailPayload);
            if (config.month) currentPayloadStr = currentPayloadStr.replace(/"__MONTH_PLACEHOLDER__"/g, JSON.stringify([config.month]));
            if (config.year) currentPayloadStr = currentPayloadStr.replace(/"__YEAR_PLACEHOLDER__"/g, JSON.stringify([config.year]));
            if (config.startDate) currentPayloadStr = currentPayloadStr.replace(/__START_DATE_PLACEHOLDER__/g, config.startDate);
            if (config.endDate) currentPayloadStr = currentPayloadStr.replace(/__END_DATE_PLACEHOLDER__/g, config.endDate);
{ '            currentPayloadStr = currentPayloadStr.replace(/"__NID_PLACEHOLDER__"/g, JSON.stringify(fetchedNids));' if has_nid else '' }

            const detailPayload = JSON.parse(currentPayloadStr);
            let limitVal = parseInt(detailPayload.limit || (detailPayload.answerParamList && detailPayload.answerParamList[0] && detailPayload.answerParamList[0].pageSize) || 50, 10);
            let allDataResults = []; let globalSumData = null; let aggFields = []; let currentPage = 1; let isFetching = true;

            while (isFetching) {{
{pagination_code}
                const response = await fetch("{url}", {{ headers: fetchHeaders, body: JSON.stringify(detailPayload), method: "POST", credentials: "include" }});
                const data = await response.json();
                if (data.status === 9999 || data.errorCode === "9999") throw new Error("请求报错 (9999)：请检查登录状态。");
                if (!globalSumData) globalSumData = extractSmartSumData(data);
                if (aggFields.length === 0) aggFields = extractAggFields(data);
                let pageItems = extractRows(data);
                if (!pageItems || pageItems.length === 0) break;
                allDataResults = allDataResults.concat(pageItems);
                if (pageItems.length < limitVal) break;
                currentPage++; await new Promise(r => setTimeout(r, 300));
            }}

            if (allDataResults.length === 0) {{ console.warn("⚠️ " + branchName + " 未提取到数据，跳过。"); continue; }}
{force_sum_code}

            const headers = [];
            allDataResults.forEach(row => {{ Object.keys(row).forEach(k => {{ if (!headers.includes(k)) headers.push(k); }}); }});
            if (globalSumData) {{
                console.log("%c     📊 开始解析大盘总计行列值...", "color: #0984e3; font-size: 11px; font-weight: bold;");
                let totalRow = {{}}; totalRow[headers[0]] = "【总计】";
                for (let i = 1; i < headers.length; i++) {{ totalRow[headers[i]] = getSmartValue(globalSumData[headers[i]], headers[i], true); }}
                allDataResults.push(totalRow);
            }}

            let csvContent = String.fromCharCode(0xFEFF) + headers.join(",") + String.fromCharCode(10);
            allDataResults.forEach(function(row) {{
                let rowArray = headers.map(header => {{
                    let cellVal = getSmartValue(row[header], header, false);
                    return '"' + String(cellVal).replace(/"/g, '""') + '"';
                }});
                csvContent += rowArray.join(",") + String.fromCharCode(10);
            }});

            let finalOutputName = "{final_file_name}";
            if (config.month) finalOutputName = finalOutputName.replace(".csv", "_" + config.year + "年" + config.month + "月.csv");
            const blob = new Blob([csvContent], {{ type: 'text/csv;charset=utf-8;' }});
            const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
            link.download = finalOutputName; document.body.appendChild(link); link.click(); document.body.removeChild(link);

            let reportLine = config.label + (config.month ? "(" + config.month + "月)" : "") + ": " + (allDataResults.length - (globalSumData ? 1 : 0)) + " 条";
            finalSummary.push(reportLine);
            console.log("%c      ✔️ " + branchName + " 数据已触发下载！", "color: #2ecc71;");
            if (runIdx < runConfigs.length - 1) await new Promise(r => setTimeout(r, 1500));
        }}
"""

    uiv_template = f"""return (async function() {{
    try {{
{core_body}
        return "✅ 导出成功！子任务: " + finalSummary.join(" | ");
    }} catch (error) {{
        return "❌ 报错: " + error.message;
    }}
}})();"""

    console_template = f"""(async function() {{
    try {{
        console.log("%c🚀 [UIVF12 {TOOL_VERSION}] 任务列车启动，请保持页面开启并耐心等待...", "color: #e67e22; font-size: 14px; font-weight: bold;");
{core_body}
        console.log("%c🎉 [UIVF12 {TOOL_VERSION}] 任务圆满成功！提取报告: " + finalSummary.join(" | "), "color: #4CAF50; font-size: 14px; font-weight: bold;");
    }} catch (error) {{
        console.error("%c❌ [UIVF12 {TOOL_VERSION}] 内部报错: " + error.message, "color: #c53030; font-size: 13px; font-weight: bold;");
    }}
}})();"""

    if args.output_uiv:
        Path(args.output_uiv).write_text(uiv_template, encoding="utf-8")
        print(f"Wrote UIV script to {args.output_uiv}")

    if args.output_console:
        Path(args.output_console).write_text(console_template, encoding="utf-8")
        print(f"Wrote Console script to {args.output_console}")

    if not args.output_uiv and not args.output_console:
        print(console_template)

if __name__ == "__main__":
    main()
