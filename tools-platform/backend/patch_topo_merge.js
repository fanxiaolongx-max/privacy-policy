const fs = require('fs');
const file = '/Volumes/512G/06-工具开发/privacy-policy/tools-platform/frontend/js/report/report.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Update exportYuxiangExcel merging logic
const oldExportMerge = `        // Merge 全量EOS & 日志回传
        const mergedMetrics = [];
        let eosProduct = null;
        let logBase = null;`;
const newExportMerge = `        // Merge 全量EOS & 日志回传 & 拓扑与预案
        const mergedMetrics = [];
        let eosProduct = null;
        let logBase = null;
        let topoBase = null;`;

const oldExportMergeEnd = `            } else if (md.label === '日志回传备案') {
                if (logBase) {
                    mergeTwoMetrics(logBase, md, '日志回传 (合并)');
                } else {
                    mergedMetrics.push(md);
                }
            } else {
                mergedMetrics.push(md);
            }
        });`;
const newExportMergeEnd = `            } else if (md.label === '日志回传备案') {
                if (logBase) {
                    mergeTwoMetrics(logBase, md, '日志回传 (合并)');
                } else {
                    mergedMetrics.push(md);
                }
            } else if (md.label === '拓扑') {
                topoBase = md;
                mergedMetrics.push(topoBase);
            } else if (md.label === '预案') {
                if (topoBase) {
                    mergeTwoMetrics(topoBase, md, '拓扑与预案 (合并)');
                } else {
                    mergedMetrics.push(md);
                }
            } else {
                mergedMetrics.push(md);
            }
        });`;

// 2. Update autoFillSequentialMapping
const oldAutoFill = `    // Merge EOS and Log
    const mainMetrics = [];
    let eosProduct = null;
    let logBase = null;`;
const newAutoFill = `    // Merge EOS, Log, Topo
    const mainMetrics = [];
    let eosProduct = null;
    let logBase = null;
    let topoBase = null;`;

const oldAutoFillEnd = `        } else if (m.label === '日志回传备案') {
            if (!logBase) mainMetrics.push(m);
        } else {
            mainMetrics.push(m);
        }
    });`;
const newAutoFillEnd = `        } else if (m.label === '日志回传备案') {
            if (!logBase) mainMetrics.push(m);
        } else if (m.label === '拓扑') {
            topoBase = { label: '拓扑与预案 (合并)' };
            mainMetrics.push(topoBase);
        } else if (m.label === '预案') {
            if (!topoBase) mainMetrics.push(m);
        } else {
            mainMetrics.push(m);
        }
    });`;

// 3. Update options
const oldOptions = `        if (!metrics.includes('全量EOS (合并)')) metrics.push('全量EOS (合并)');
        if (!metrics.includes('日志回传 (合并)')) metrics.push('日志回传 (合并)');`;
const newOptions = `        if (!metrics.includes('全量EOS (合并)')) metrics.push('全量EOS (合并)');
        if (!metrics.includes('日志回传 (合并)')) metrics.push('日志回传 (合并)');
        if (!metrics.includes('拓扑与预案 (合并)')) metrics.push('拓扑与预案 (合并)');`;

if (content.includes(oldExportMerge) && content.includes(oldExportMergeEnd) && content.includes(oldAutoFill) && content.includes(oldAutoFillEnd) && content.includes(oldOptions)) {
    content = content.replace(oldExportMerge, newExportMerge);
    content = content.replace(oldExportMergeEnd, newExportMergeEnd);
    content = content.replace(oldAutoFill, newAutoFill);
    content = content.replace(oldAutoFillEnd, newAutoFillEnd);
    content = content.replace(oldOptions, newOptions);
    fs.writeFileSync(file, content);
    console.log("Patched topo merge");
} else {
    console.log("Could not find targets");
}
