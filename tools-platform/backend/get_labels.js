const fs = require('fs');
const ExcelJS = require('exceljs');

const i18n = {
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
  "IBMS刷新率": "IBMS Refresh Rate"
};

async function run() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('/Volumes/512G/06-工具开发/privacy-policy/每月赛马-分网络.xlsx');
    const sheet = workbook.worksheets[0];
    
    // Rows 9 to 36
    for (let r = 9; r <= 36; r++) {
        const en = sheet.getRow(r).getCell(3).value;
        console.log(`Row ${r}: ${en}`);
    }
}
run();
