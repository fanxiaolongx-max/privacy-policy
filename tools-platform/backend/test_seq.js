const prefsRepo = require('./models/sla-prefs-repository');
const categoriesRepo = require('./models/sla-categories-repository');
const { closeDatabase } = require('./models/app-db');

(async () => {
    const prefs = (await prefsRepo.getPrefsObject()).items;
    const categories = (await categoriesRepo.listCategories()).items;
    console.log({ prefKeys: Object.keys(prefs), categories });
    await closeDatabase();
})().catch(async err => {
    console.error(err);
    try { await closeDatabase(); } catch {}
    process.exit(1);
});
