const fs = require('fs');
const prefs = JSON.parse(fs.readFileSync('/Volumes/512G/06-工具开发/privacy-policy/tools-platform/backend/data/sla_prefs.json', 'utf8'));
const items = prefs.manualAdjustItems || [];
items.forEach((item, idx) => {
    if (!item.deleted) console.log(`[${idx}] ${item.type} ${item.name}`);
});
