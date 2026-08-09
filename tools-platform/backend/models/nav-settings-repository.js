const { readKV, writeKV } = require('./kv-store');


const DEFAULT_SETTINGS = {
    // 首次安装且尚无 nav_settings 记录时使用；已有用户配置不会被覆盖。
    primaryIds: [
        'home',
        'uivf12',
        'sla',
        'report',
        'custom-report',
        'expedite',
        'monthly',
        'bigscreen',
        'custom:network_safety_meeting_summary'
    ],
    categories: [
        { id: 'business', name: '业务工具', nameEn: 'Business Tools' },
        { id: 'audit', name: '审计与核算', nameEn: 'Audit & KPI' },
        { id: 'system', name: '系统治理', nameEn: 'System Governance' },
        { id: 'cat_mq0nny3v', name: '五个端到端', nameEn: '“5” E2E' },
        { id: 'cat_msbmuup1', name: '实用工具', nameEn: 'Useful' },
        { id: 'cat_msbmvd5l', name: '网络安全', nameEn: 'Safety' },
        { id: 'cat_mshv1h0m', name: '汇报呈现', nameEn: 'Report' },
        { id: 'custom', name: '自定义工具', nameEn: 'Custom Tools' },
        { id: 'cat_ms2192c7', name: '行政餐饮', nameEn: 'Admin' },
        { id: 'cat_mshua5iu', name: '休闲娱乐', nameEn: 'Play' }
    ],
    categoryByItem: {
        frt: 'audit',
        praudit: 'audit',
        storage: 'system',
        'db-explorer': 'system',
        'custom:eos_tool-v2': 'cat_mq0nny3v',
        'custom:eos': 'cat_mq0nny3v',
        'custom:eos_tool-v4': 'cat_mq0nny3v',
        'custom:eos_tool-v8': 'cat_mq0nny3v',
        'custom:esn-check': 'cat_mq0nny3v',
        'custom:pr': 'audit',
        'custom:tool-mro1gt5o': 'cat_ms2192c7',
        'custom:tool-mr87218d': 'cat_ms2192c7',
        'custom:tool-mrlpwjk3': 'cat_ms2192c7',
        'custom:tool-ms1saxuh': 'cat_ms2192c7',
        'custom:tool-msbmscxd': 'audit',
        'custom:tool-msbmu55i': 'audit',
        'custom:tool-ms4xb66s': 'cat_msbmuup1',
        'custom:tool-mrhqjeya': 'cat_msbmuup1',
        'custom:tool-mrsw86w8': 'cat_mshv1h0m',
        'custom:pr-2': 'cat_msbmuup1',
        'custom:f12-to-extension': 'cat_msbmuup1',
        'custom:tool-mrrgpqy4': 'cat_ms2192c7',
        'custom:particle-effects': 'cat_mshua5iu',
        'custom:tool-mrrn48dc': 'cat_mshua5iu',
        'custom:optical-transfer': 'cat_mshua5iu',
        'custom:tool-msf5b7nn': 'audit',
        'custom:nis_2026h1_summary': 'cat_mshv1h0m',
        'custom:tool-msh8aro4': 'cat_mshv1h0m',
        'custom:question-bank-assistant-privacy': 'cat_mshv1h0m',
        'custom:tool-mr88gv9x': 'cat_mshv1h0m'
    },
    itemOrder: [
        'praudit',
        'custom:pr',
        'frt',
        'storage',
        'db-explorer',
        'custom:eos_tool-v8',
        'custom:tool-mqtlwcrv',
        'custom:nis_2026h1_summary',
        'custom:tool-ms4xb66s',
        'custom:particle-effects',
        'custom:esn-check',
        'custom:tool-mqp55fna',
        'custom:tool-mrrn48dc',
        'custom:tool-ms1saxuh',
        'custom:tool-mr88gv9x',
        'custom:tool-mrlpwjk3',
        'custom:tool-mrrgpqy4',
        'custom:tool-mrhqjeya',
        'custom:tool-mr87218d',
        'custom:tool-mr0vvmyi',
        'custom:tool-mro1gt5o',
        'custom:tool-mrsw86w8'
    ]
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

function collectDefaultItemIds() {
    return new Set([
        ...DEFAULT_SETTINGS.primaryIds,
        ...Object.keys(DEFAULT_SETTINGS.categoryByItem),
        ...DEFAULT_SETTINGS.itemOrder
    ].map(String));
}

function mergeDefaultSettingsPreservingCustomTools(currentInput, customToolIds = []) {
    const current = normalizeSettings(currentInput || {});
    const defaults = normalizeSettings(DEFAULT_SETTINGS);
    const defaultItemIds = collectDefaultItemIds();
    const registeredCustomIds = [...new Set((customToolIds || []).map(String).filter(id => id.startsWith('custom:')))];
    const preservedCustomIds = registeredCustomIds.filter(id => !defaultItemIds.has(id));
    const preservedSet = new Set(preservedCustomIds);

    const defaultCategoryIds = new Set(defaults.categories.map(category => category.id));
    const preservedCategories = current.categories
        .filter(category => !defaultCategoryIds.has(category.id))
        .map(category => ({ ...category }));
    const categories = [...defaults.categories.map(category => ({ ...category })), ...preservedCategories];
    const availableCategoryIds = new Set(categories.map(category => category.id));

    const preservedPrimaryIds = current.primaryIds.filter(id => preservedSet.has(id));
    const primaryIds = [...defaults.primaryIds, ...preservedPrimaryIds.filter(id => !defaults.primaryIds.includes(id))];
    const primarySet = new Set(primaryIds);

    const categoryByItem = { ...defaults.categoryByItem };
    preservedCustomIds.forEach(id => {
        const currentCategory = current.categoryByItem[id];
        categoryByItem[id] = availableCategoryIds.has(currentCategory) ? currentCategory : 'custom';
    });

    const itemOrder = defaults.itemOrder.slice();
    const itemOrderSet = new Set(itemOrder);
    current.itemOrder.forEach(id => {
        if (preservedSet.has(id) && !primarySet.has(id) && !itemOrderSet.has(id)) {
            itemOrder.push(id);
            itemOrderSet.add(id);
        }
    });
    preservedCustomIds.forEach(id => {
        if (!primarySet.has(id) && !itemOrderSet.has(id)) {
            itemOrder.push(id);
            itemOrderSet.add(id);
        }
    });

    return normalizeSettings({ primaryIds, categories, categoryByItem, itemOrder });
}

async function getSettings() {
    return normalizeSettings(await readKV('sys', 'nav_settings', DEFAULT_SETTINGS));
}

async function saveSettings(settings) {
    const normalized = normalizeSettings(settings);
    await writeKV('sys', 'nav_settings', normalized);
    return normalized;
}

async function restoreDefaultsPreservingCustomTools(customToolIds = []) {
    const current = await getSettings();
    const restored = mergeDefaultSettingsPreservingCustomTools(current, customToolIds);
    await writeKV('sys', 'nav_settings', restored);
    return {
        settings: restored,
        preservedCustomToolCount: customToolIds.filter(id => !collectDefaultItemIds().has(String(id))).length,
        preservedCustomCategoryCount: restored.categories.filter(category =>
            !DEFAULT_SETTINGS.categories.some(defaultCategory => defaultCategory.id === category.id)
        ).length
    };
}

module.exports = {
    DEFAULT_SETTINGS,
    mergeDefaultSettingsPreservingCustomTools,
    getSettings,
    saveSettings,
    restoreDefaultsPreservingCustomTools
};
