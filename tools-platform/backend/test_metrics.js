const fs = require('fs');
const prefs = JSON.parse(fs.readFileSync('/Volumes/512G/06-工具开发/privacy-policy/tools-platform/backend/data/sla_prefs.json', 'utf8'));
const items = prefs.orderedMetrics || [];
items.forEach((item, idx) => {
    console.log(`[${idx}] ${item.label}`);
});
