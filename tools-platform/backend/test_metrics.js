const prefsRepo = require('./models/sla-prefs-repository');
const { closeDatabase } = require('./models/app-db');

(async () => {
    const prefs = (await prefsRepo.getPrefsObject()).items;
    const items = prefs.orderedMetrics || [];
    items.forEach((item, idx) => {
        console.log(`[${idx}] ${item.label}`);
    });
    await closeDatabase();
})().catch(async err => {
    console.error(err);
    try { await closeDatabase(); } catch {}
    process.exit(1);
});
