const fs = require('fs');
const jsFile = '/Volumes/512G/06-工具开发/privacy-policy/tools-platform/frontend/js/report/report.js';
let jsContent = fs.readFileSync(jsFile, 'utf8');

const oldStr = `const adjs = globalConfig.prefs.manualAdjustItems || [];`;
const newStr = `const adjs = (typeof manualAdjustItems !== 'undefined' ? manualAdjustItems : []);`;

if (jsContent.includes(oldStr)) {
    jsContent = jsContent.replace(oldStr, newStr);
    fs.writeFileSync(jsFile, jsContent);
    console.log("Patched adjs logic");
}
