const { readJSON, writeJSON } = require('./store');

const SETTINGS_FILE = 'nav_settings.json';

const DEFAULT_SETTINGS = {
    primaryIds: ['home', 'uivf12', 'sla', 'report', 'expedite', 'monthly'],
    categories: [
        { id: 'business', name: '业务工具' },
        { id: 'audit', name: '审计与核算' },
        { id: 'system', name: '系统治理' },
        { id: 'custom', name: '自定义工具' }
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
        .map((item, index) => ({
            id: String(item.id || `cat_${index + 1}`).replace(/[^a-zA-Z0-9_-]+/g, '_'),
            name: String(item.name || `分类 ${index + 1}`).trim()
        }))
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

function getSettings() {
    return normalizeSettings(readJSON(SETTINGS_FILE, DEFAULT_SETTINGS));
}

function saveSettings(settings) {
    const normalized = normalizeSettings(settings);
    writeJSON(SETTINGS_FILE, normalized);
    return normalized;
}

module.exports = {
    DEFAULT_SETTINGS,
    getSettings,
    saveSettings
};
