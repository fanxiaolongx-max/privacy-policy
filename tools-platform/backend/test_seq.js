const fs = require('fs');
const prefs = JSON.parse(fs.readFileSync('/Volumes/512G/06-工具开发/privacy-policy/tools-platform/backend/data/sla_prefs.json', 'utf8'));
const categories = JSON.parse(fs.readFileSync('/Volumes/512G/06-工具开发/privacy-policy/tools-platform/backend/data/sla_categories.json', 'utf8'));

// orderedMetrics is basically metric map? Wait, sla_prefs doesn't have orderedMetrics.
// Where are metrics stored?
console.log(Object.keys(prefs));
