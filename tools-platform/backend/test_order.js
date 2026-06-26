const prefsRepo = require('./models/sla-prefs-repository');
const { closeDatabase } = require('./models/app-db');

(async () => {
    const prefs = (await prefsRepo.getPrefsObject()).items;
    const items = prefs.manualAdjustItems || [];
    items.forEach((item, idx) => {
        if (!item.deleted) console.log(`[${idx}] ${item.type} ${item.name}`);
    });
    await closeDatabase();
})().catch(async err => {
    console.error(err);
    try { await closeDatabase(); } catch {}
    process.exit(1);
});
