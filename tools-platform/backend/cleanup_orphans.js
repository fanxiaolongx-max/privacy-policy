const fs = require('fs');
const path = require('path');

const { DATA_DIR } = require('./models/store');

const PREFS_FILE = path.join(DATA_DIR, 'sla_prefs.json');
const TARGETS_FILE = path.join(DATA_DIR, 'sla_targets.json');

const prefs = JSON.parse(fs.readFileSync(PREFS_FILE, 'utf8'));
const targets = JSON.parse(fs.readFileSync(TARGETS_FILE, 'utf8'));

const validCustomMetricIds = new Set();
Object.keys(prefs).forEach(hash => {
    if (prefs[hash] && prefs[hash].customMetrics) {
        let secId = '';
        if (hash.startsWith('sla_prefs_other_')) {
            secId = hash.replace('sla_prefs_', ''); 
        } else if (hash.startsWith('sla_prefs_rectification')) {
            secId = 'rectification';
        } else if (hash.startsWith('sla_prefs_risk')) {
            secId = 'risk';
        } else if (hash.startsWith('sla_prefs_special')) {
            secId = 'special';
        } else {
            secId = hash.replace('sla_prefs_', '');
        }
        prefs[hash].customMetrics.forEach(cm => {
            validCustomMetricIds.add(`${secId}_${cm.id}`);
        });
    }
});

let targetsChanged = false;
let deletedCount = 0;

Object.keys(targets).forEach(k => {
    if (k.includes('_m_') && !validCustomMetricIds.has(k)) {
        console.log(`Deleting orphaned target key: ${k}`);
        delete targets[k];
        targetsChanged = true;
        deletedCount++;
    }
});

if (targetsChanged) {
    fs.writeFileSync(TARGETS_FILE, JSON.stringify(targets, null, 2), 'utf8');
    console.log(`Successfully deleted ${deletedCount} orphaned target configurations.`);
} else {
    console.log(`No orphaned targets found.`);
}
