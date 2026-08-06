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
