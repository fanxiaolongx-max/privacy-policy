const uploadHistoryRepo = require('./models/upload-history-repository');
const uivCategoriesRepo = require('./models/uiv-categories-repository');
const uivScriptsRepo = require('./models/uiv-scripts-repository');
const slaCategoriesRepo = require('./models/sla-categories-repository');
const slaGroupsRepo = require('./models/sla-groups-repository');
const slaSnapshotsRepo = require('./models/sla-snapshots-repository');
const slaTargetsRepo = require('./models/sla-targets-repository');
const slaPrefsRepo = require('./models/sla-prefs-repository');
const authUsersRepo = require('./models/auth-users-repository');
const authSessionsRepo = require('./models/auth-sessions-repository');
const { readJSON } = require('./models/store');

async function test() {
    const checks = [
        { key: 'upload_history', getJson: async () => readJSON('upload_history.json', []), getSqlite: async () => (await uploadHistoryRepo.listHistory({ mode: 'sqlite', limit: 1 })).items },
        { key: 'uiv_categories', getJson: async () => readJSON('uiv_categories.json', []), getSqlite: async () => (await uivCategoriesRepo.listCategories({ mode: 'sqlite' })).items },
        { key: 'uiv_scripts', getJson: async () => readJSON('uiv_scripts.json', []), getSqlite: async () => (await uivScriptsRepo.listScripts({ mode: 'sqlite' })).items },
        { key: 'sla_categories', getJson: async () => readJSON('sla_categories.json', []), getSqlite: async () => (await slaCategoriesRepo.listCategories({ mode: 'sqlite' })).items },
        { key: 'sla_groups', getJson: async () => readJSON('sla_groups.json', []), getSqlite: async () => (await slaGroupsRepo.listGroups({ mode: 'sqlite' })).items },
        { key: 'sla_snapshots', getJson: async () => readJSON('sla_snapshots.json', []), getSqlite: async () => (await slaSnapshotsRepo.listSnapshots({ mode: 'sqlite' })).items },
        { key: 'sla_targets', getJson: async () => readJSON('sla_targets.json', {}), getSqlite: async () => (await slaTargetsRepo.getTargets({ mode: 'sqlite' })).items },
        { key: 'sla_prefs', getJson: async () => readJSON('sla_prefs.json', {}), getSqlite: async () => (await slaPrefsRepo.getPrefsObject({ mode: 'sqlite' })).items },
        { key: 'auth_users', getJson: async () => readJSON('users.json', {}), getSqlite: async () => (await authUsersRepo.listUsers({ mode: 'sqlite' })).items },
        { key: 'auth_sessions', getJson: async () => readJSON('sessions.json', {}), getSqlite: async () => (await authSessionsRepo.listSessions({ mode: 'sqlite' })).items }
    ];

    for (const check of checks) {
        console.log(`Checking ${check.key}...`);
        try {
            await check.getJson();
        } catch(e) {
            console.error(`  getJson failed for ${check.key}:`, e);
        }
        try {
            await check.getSqlite();
        } catch(e) {
            console.error(`  getSqlite failed for ${check.key}:`, e);
        }
    }
}
test().then(() => console.log('Done')).catch(console.error);
