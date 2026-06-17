const fs = require('fs');
const jsFile = '/Volumes/512G/06-工具开发/privacy-policy/tools-platform/frontend/js/report/report.js';
let jsContent = fs.readFileSync(jsFile, 'utf8');

const oldOpts = `const metrics = window._currentOrderedMetrics ? window._currentOrderedMetrics.map(m => m.label) : [];
        const adjs = (globalConfig.prefs.manualAdjustItems || []).map(a => a.name);`;
        
const newOpts = `
        // If window._currentOrderedMetrics is missing, try to reconstruct it from metricCols and ungrouped
        let metricsList = window._currentOrderedMetrics || [];
        if (metricsList.length === 0 && typeof metricCols !== 'undefined') {
             metricsList = [...metricCols];
        }
        
        // Ensure "全量EOS (合并)" is in the options list so auto-fill can select it!
        const metrics = metricsList.map(m => m.label);
        if (!metrics.includes('全量EOS (合并)')) metrics.push('全量EOS (合并)');
        
        // manualAdjustItems is a global array in report.js
        const adjs = (typeof manualAdjustItems !== 'undefined' ? manualAdjustItems : []).map(a => a.name);
`;

if (jsContent.includes('const adjs = (globalConfig.prefs.manualAdjustItems || []).map(a => a.name);')) {
    jsContent = jsContent.replace(oldOpts, newOpts);
    fs.writeFileSync(jsFile, jsContent);
    console.log("Patched dropdown options logic");
} else {
    console.log("Could not find dropdown options logic");
}

