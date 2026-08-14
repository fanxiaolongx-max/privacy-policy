const { DEFAULT_TENANT_ID, runWithTenant } = require('./tenant-context');
const tenantPool = require('./tenant-sqlite-pool');

const REPOSITORIES = [
    './uiv-scripts-repository',
    './uiv-categories-repository',
    './sla-targets-repository',
    './sla-prefs-repository',
    './sla-groups-repository',
    './sla-categories-repository',
    './sla-snapshots-repository',
    './sla-rule-templates-repository',
    './upload-history-repository',
    './frt-snapshots-repository',
    './platform-metrics-repository',
    './alert-center-repository',
    './audit-log-repository',
    './service-status-repository',
    './config-change-monitor',
    './ai-chat-repository',
    './ai-usage-repository',
    './slide-design-repository',
    './survey-repository',
    './ai-knowledge-service'
];

function flushDatabaseQueue(db) {
    return new Promise((resolve, reject) => db.get('PRAGMA schema_version', error => error ? reject(error) : resolve()));
}

async function initializeDefaultBusinessSchema() {
    return runWithTenant(DEFAULT_TENANT_ID, async () => {
        for (const modulePath of REPOSITORIES) {
            const repository = require(modulePath);
            if (typeof repository.ensureReady === 'function') await repository.ensureReady();
        }
        const customTools = require('./custom-tools-repository');
        await customTools.ensureRegistryReady();
        // report.db and requirements.db initialize with serialized callbacks when
        // their route modules load. These barriers guarantee that schema is visible
        // before a tenant can clone it.
        await flushDatabaseQueue(tenantPool.getConnection('report.db', 'report'));
        await flushDatabaseQueue(tenantPool.getConnection('requirements.db'));
    });
}

module.exports = { initializeDefaultBusinessSchema };
