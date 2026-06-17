const fs = require('fs');
const file = '/Volumes/512G/06-工具开发/privacy-policy/tools-platform/frontend/js/report/report.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Update exportYuxiangExcel merging logic
const oldExportMerge = `        // Merge 全量EOS
        const mergedMetrics = [];
        let eosProduct = null;
        payload.metrics.forEach(md => {
            if (md.label === '全量EOS-产品') {
                eosProduct = md;
                mergedMetrics.push(eosProduct);
            } else if (md.label === '全量EOS-版本') {
                if (eosProduct) {
                    eosProduct.label = '全量EOS (合并)';`;
const newExportMerge = `        // Merge 全量EOS & 日志回传
        const mergedMetrics = [];
        let eosProduct = null;
        let logBase = null;

        const parseFloatSafe = (val) => {
            if (typeof val === 'string' && val.endsWith('%')) return parseFloat(val);
            if (typeof val === 'string' || typeof val === 'number') {
                const n = parseFloat(val);
                return isNaN(n) ? 0 : n;
            }
            return 0;
        };
        const isPct = (val) => typeof val === 'string' && val.endsWith('%');

        const mergeTwoMetrics = (baseObj, newObj, newLabel) => {
            baseObj.label = newLabel;
            const t1 = parseFloatSafe(baseObj.target);
            const t2 = parseFloatSafe(newObj.target);
            const hasPctTarget = isPct(baseObj.target) || isPct(newObj.target);
            baseObj.target = hasPctTarget ? (t1+t2)+'%' : (t1+t2);
            
            ['TE', 'ORG', 'ET', 'VDF'].forEach(cat => {
                const a1 = parseFloatSafe(baseObj[cat].achv);
                const a2 = parseFloatSafe(newObj[cat].achv);
                const hasPctAchv = isPct(baseObj[cat].achv) || isPct(newObj[cat].achv);
                
                let combinedAchv = '';
                if (baseObj[cat].achv === '' && newObj[cat].achv === '') {
                    combinedAchv = '';
                } else {
                    combinedAchv = hasPctAchv ? (a1+a2)+'%' : (a1+a2);
                }
                baseObj[cat].achv = combinedAchv;
                
                const s1 = parseFloatSafe(baseObj[cat].score);
                const s2 = parseFloatSafe(newObj[cat].score);
                baseObj[cat].score = s1 + s2;
            });
        };

        payload.metrics.forEach(md => {
            if (md.label === '全量EOS-产品') {
                eosProduct = md;
                mergedMetrics.push(eosProduct);
            } else if (md.label === '全量EOS-版本') {
                if (eosProduct) {
                    mergeTwoMetrics(eosProduct, md, '全量EOS (合并)');`;
                    
const oldExportMergeEnd = `                        const s2 = parseFloatSafe(md[cat].score);
                        eosProduct[cat].score = s1 + s2;
                    });
                } else {
                    mergedMetrics.push(md);
                }
            } else {
                mergedMetrics.push(md);
            }
        });`;
const newExportMergeEnd = `                } else {
                    mergedMetrics.push(md);
                }
            } else if (md.label === '日志回传') {
                logBase = md;
                mergedMetrics.push(logBase);
            } else if (md.label === '日志回传备案') {
                if (logBase) {
                    mergeTwoMetrics(logBase, md, '日志回传 (合并)');
                } else {
                    mergedMetrics.push(md);
                }
            } else {
                mergedMetrics.push(md);
            }
        });`;

// 2. Update autoFillSequentialMapping
const oldAutoFill = `    // Merge EOS
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
    });`;
const newAutoFill = `    // Merge EOS and Log
    const mainMetrics = [];
    let eosProduct = null;
    let logBase = null;
    mainMetricsRaw.forEach(m => {
        if (m.label === '全量EOS-产品') {
            eosProduct = { label: '全量EOS (合并)' };
            mainMetrics.push(eosProduct);
        } else if (m.label === '全量EOS-版本') {
            if (!eosProduct) mainMetrics.push(m);
        } else if (m.label === '日志回传') {
            logBase = { label: '日志回传 (合并)' };
            mainMetrics.push(logBase);
        } else if (m.label === '日志回传备案') {
            if (!logBase) mainMetrics.push(m);
        } else {
            mainMetrics.push(m);
        }
    });`;

// 3. Update options in openTemplateMappingModal
const oldOptions = `        // Ensure "全量EOS (合并)" is in the options list so auto-fill can select it!
        const metrics = metricsList.map(m => m.label);
        if (!metrics.includes('全量EOS (合并)')) metrics.push('全量EOS (合并)');`;
const newOptions = `        // Ensure merged labels are in the options list so auto-fill can select them!
        const metrics = metricsList.map(m => m.label);
        if (!metrics.includes('全量EOS (合并)')) metrics.push('全量EOS (合并)');
        if (!metrics.includes('日志回传 (合并)')) metrics.push('日志回传 (合并)');`;

// Apply patches
if (content.includes(oldExportMerge) && content.includes(oldExportMergeEnd) && content.includes(oldAutoFill) && content.includes(oldOptions)) {
    content = content.replace(oldExportMerge, newExportMerge);
    content = content.replace(oldExportMergeEnd, newExportMergeEnd);
    content = content.replace(oldAutoFill, newAutoFill);
    content = content.replace(oldOptions, newOptions);
    fs.writeFileSync(file, content);
    console.log("Patched log merge");
} else {
    console.log("Could not find targets");
}
