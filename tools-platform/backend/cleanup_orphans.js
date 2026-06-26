const prefsRepo = require('./models/sla-prefs-repository');
const targetsRepo = require('./models/sla-targets-repository');
const { closeDatabase } = require('./models/app-db');

(async () => {
    const prefs = (await prefsRepo.getPrefsObject()).items;
    const targets = (await targetsRepo.getTargets()).items;

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
        await targetsRepo.replaceTargets(targets);
        console.log(`Successfully deleted ${deletedCount} orphaned target configurations.`);
    } else {
        console.log(`No orphaned targets found.`);
    }
    await closeDatabase();
})().catch(async err => {
    console.error(err);
    try { await closeDatabase(); } catch {}
    process.exit(1);
});
