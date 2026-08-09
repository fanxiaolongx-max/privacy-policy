const assert = require('assert');
const {
    DEFAULT_SETTINGS,
    mergeDefaultSettingsPreservingCustomTools
} = require('./models/nav-settings-repository');

function testRestorePreservesOnlyRegisteredNonSystemTools() {
    const current = {
        primaryIds: ['custom:user-top', 'praudit', 'home'],
        categories: [
            { id: 'user-category', name: '我的分类', nameEn: 'Mine' },
            { id: 'business', name: '被改名的业务分类' }
        ],
        categoryByItem: {
            praudit: 'business',
            'custom:user-top': 'user-category',
            'custom:user-overflow': 'user-category',
            'custom:removed-tool': 'user-category'
        },
        itemOrder: ['custom:user-overflow', 'custom:removed-tool', 'praudit']
    };

    const restored = mergeDefaultSettingsPreservingCustomTools(current, [
        'custom:user-top',
        'custom:user-overflow',
        'custom:f12-to-extension'
    ]);

    assert.deepStrictEqual(restored.primaryIds.slice(0, DEFAULT_SETTINGS.primaryIds.length), DEFAULT_SETTINGS.primaryIds);
    assert.strictEqual(restored.primaryIds.at(-1), 'custom:user-top', '自定义顶部工具应继续保留在顶部');
    assert.ok(restored.categories.some(category => category.id === 'user-category' && category.name === '我的分类'));
    assert.strictEqual(restored.categories.find(category => category.id === 'business').name, '业务工具', '系统分类名称应恢复默认');
    assert.strictEqual(restored.categoryByItem.praudit, DEFAULT_SETTINGS.categoryByItem.praudit, '系统工具分类应恢复默认');
    assert.strictEqual(restored.categoryByItem['custom:user-overflow'], 'user-category', '非系统工具分类应保留');
    assert.ok(restored.itemOrder.includes('custom:user-overflow'), '非系统工具顺序记录应保留');
    assert.ok(!restored.itemOrder.includes('custom:removed-tool'), '已经不存在的工具不应留下幽灵顺序');
    assert.strictEqual(restored.categoryByItem['custom:f12-to-extension'], DEFAULT_SETTINGS.categoryByItem['custom:f12-to-extension'], '系统自带工具应恢复系统默认分类');
}

function testRestoreFallsBackWhenCustomCategoryIsUnavailable() {
    const restored = mergeDefaultSettingsPreservingCustomTools({
        primaryIds: [],
        categories: DEFAULT_SETTINGS.categories,
        categoryByItem: { 'custom:user-tool': 'missing-category' },
        itemOrder: []
    }, ['custom:user-tool']);
    assert.strictEqual(restored.categoryByItem['custom:user-tool'], 'custom');
    assert.ok(restored.itemOrder.includes('custom:user-tool'));
}

testRestorePreservesOnlyRegisteredNonSystemTools();
testRestoreFallsBackWhenCustomCategoryIsUnavailable();
console.log('Navigation settings restore tests passed');
