const fs = require('fs');
const htmlFile = '/Volumes/512G/06-工具开发/privacy-policy/tools-platform/frontend/pages/report.html';
const jsFile = '/Volumes/512G/06-工具开发/privacy-policy/tools-platform/frontend/js/report/report.js';

// 1. Update HTML
let htmlContent = fs.readFileSync(htmlFile, 'utf8');
const btnSearch = `<button class="btn btn-primary" onclick="saveTemplateMapping()">保存并修改模板</button>`;
const btnReplace = `<button class="btn btn-info" onclick="autoFillSequentialMapping()" style="margin-right:10px;">✨ 一键按顺序自动预填</button>\n                    <button class="btn btn-primary" onclick="saveTemplateMapping()">保存并修改模板</button>`;
if (htmlContent.includes(btnSearch) && !htmlContent.includes('autoFillSequentialMapping')) {
    htmlContent = htmlContent.replace(btnSearch, btnReplace);
    fs.writeFileSync(htmlFile, htmlContent);
    console.log("Patched HTML");
}

// 2. Update JS
let jsContent = fs.readFileSync(jsFile, 'utf8');
const autoFillFn = `
window.autoFillSequentialMapping = function() {
    if (!window._currentTemplateData) return;
    
    // 1. Build ordered main metrics
    const orderedMetrics = window._currentOrderedMetrics || [];
    const labelGroupLookup = window._currentLabelToGroup || {};
    const mainMetricsRaw = orderedMetrics.filter(m => labelGroupLookup[m.label] !== 'Others');
    
    // Merge EOS
    const mainMetrics = [];
    let eosProduct = null;
    mainMetricsRaw.forEach(m => {
        if (m.label === '全量EOS-产品') {
            eosProduct = { label: '全量EOS (合并)' };
            mainMetrics.push(eosProduct);
        } else if (m.label === '全量EOS-版本') {
            if (!eosProduct) mainMetrics.push(m); // should not happen
        } else {
            mainMetrics.push(m);
        }
    });

    const adjs = globalConfig.prefs.manualAdjustItems || [];
    
    const selects = document.querySelectorAll('.mapping-select');
    
    // Helper to find select by row
    const setSelectByRow = (r, val) => {
        const idx = window._currentTemplateData.findIndex(d => d.r === r);
        if (idx !== -1 && selects[idx]) {
            // Only set if option exists
            if (Array.from(selects[idx].options).some(o => o.value === val)) {
                selects[idx].value = val;
            }
        }
    };
    
    // Fill metrics 3 to 36
    mainMetrics.forEach((m, i) => {
        const r = 3 + i;
        if (r <= 36) {
            setSelectByRow(r, m.label);
        }
    });
    
    // Fill SubTotal 37
    setSelectByRow(37, 'SYS_SubTotal');
    
    // Fill Adjustments 38 to 51, 52 to 53
    adjs.forEach((a, i) => {
        let r;
        if (i < 14) r = 38 + i;
        else r = 52 + (i - 14);
        if (r <= 53) {
            setSelectByRow(r, a.name);
        }
    });
    
    // Fill Totals 54, 55, 56
    setSelectByRow(54, 'SYS_AdjustTotal');
    setSelectByRow(55, 'SYS_WeightInMonth');
    setSelectByRow(56, 'SYS_FinalResult');
    
    showToast('已按照顺序自动填入选项！请核对后点击【保存】。', 'success');
};
`;

if (!jsContent.includes('autoFillSequentialMapping')) {
    jsContent += '\n' + autoFillFn;
    fs.writeFileSync(jsFile, jsContent);
    console.log("Patched JS");
}
