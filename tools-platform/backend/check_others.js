const fs = require('fs');
const prefs = JSON.parse(fs.readFileSync('/Volumes/512G/06-工具开发/privacy-policy/tools-platform/backend/data/sla_prefs.json', 'utf8'));
let othersCount = 0;
if (prefs.labelToGroup) {
    for (let k in prefs.labelToGroup) {
        if (prefs.labelToGroup[k] === 'Others') othersCount++;
    }
}
console.log('Others count:', othersCount);
