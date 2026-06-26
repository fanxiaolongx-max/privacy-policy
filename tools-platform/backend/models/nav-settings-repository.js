const { readKV, writeKV } = require('./kv-store');


const DEFAULT_SETTINGS = {
    primaryIds: ['home', 'uivf12', 'sla', 'report', 'expedite', 'monthly'],
    categories: [
        { id: 'business', name: '业务工具', nameEn: 'Business Tools' },
        { id: 'audit', name: '审计与核算', nameEn: 'Audit & KPI' },
        { id: 'system', name: '系统治理', nameEn: 'System Governance' },
        { id: 'custom', name: '自定义工具', nameEn: 'Custom Tools' }
    ],
    categoryByItem: {
        frt: 'audit',
        praudit: 'audit',
        storage: 'system',
        'db-explorer': 'system'
    },
    itemOrder: ['frt', 'praudit', 'storage', 'db-explorer']
};

function normalizeSettings(input = {}) {
    const categories = Array.isArray(input.categories) && input.categories.length
        ? input.categories
        : DEFAULT_SETTINGS.categories;
    const normalizedCategories = categories
        .map((item, index) => {
            const cat = {
                id: String(item.id || `cat_${index + 1}`).replace(/[^a-zA-Z0-9_-]+/g, '_'),
                name: String(item.name || `分类 ${index + 1}`).trim()
            };
            if (item.nameEn) {
                cat.nameEn = String(item.nameEn).trim();
            }
            return cat;
        })
        .filter(item => item.id && item.name);

    return {
        primaryIds: Array.isArray(input.primaryIds) ? input.primaryIds.map(String) : DEFAULT_SETTINGS.primaryIds.slice(),
        categories: normalizedCategories.length ? normalizedCategories : DEFAULT_SETTINGS.categories.slice(),
        categoryByItem: input.categoryByItem && typeof input.categoryByItem === 'object' && !Array.isArray(input.categoryByItem)
            ? { ...input.categoryByItem }
            : { ...DEFAULT_SETTINGS.categoryByItem },
        itemOrder: Array.isArray(input.itemOrder) ? input.itemOrder.map(String) : DEFAULT_SETTINGS.itemOrder.slice()
    };
}

async function getSettings() {
    return normalizeSettings(await readKV('sys', 'nav_settings', DEFAULT_SETTINGS));
}

async function saveSettings(settings) {
    const normalized = normalizeSettings(settings);
    await writeKV('sys', 'nav_settings', normalized);
    return normalized;
}

module.exports = {
    DEFAULT_SETTINGS,
    getSettings,
    saveSettings
};
