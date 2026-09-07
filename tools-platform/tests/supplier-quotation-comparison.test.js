const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../backend/builtin-tools/supplier-quotation-comparison/comparison-core');

function sampleSheets() {
    return [
        {
            name: 'Week1 (9.5-9.9)',
            matrix: [
                ['SV 2026年报价单'],
                ['日期', "SUPPLIER'S NAME", 'DESCRIPTION OF GOODS', 'BIG SERIES', '单位', '采购量'],
                ['2026/9/5', 'yummy', '干海带', '干货调味品', 'kg', 4],
                ['2026/9/5', 'pyramids', '鸡精', '干货调味品', '件', 1]
            ]
        },
        {
            name: '食材-金字塔',
            matrix: [
                ['登记表 SV2026年'],
                ['DATE', 'BIG SERIES', 'DESCRIPTION OF GOODS', 'UNIT', '采购量', '厨师备注', '埃镑报价（税前价）', '规格', '是否加税'],
                ['2026/9/5', '干货调味品', '干海带', 'kg', 4, '', 600, '1kg', '加']
            ]
        },
        {
            name: '-调味品-金字塔',
            matrix: [
                ['登记表 SV2026年'],
                ['DATE', 'BIG SERIES', 'DESCRIPTION OF GOODS', '采购量', '厨师备注', '埃镑报价（税前价）', '结算价格'],
                ['2026/9/5', '干货调味品', '鸡精', '1件', '200克', 350, '']
            ]
        },
        {
            name: '罗葛家',
            matrix: [
                ['种类', '名称', '规格', '2026年9月份', '税后14%', '币种', '备注'],
                ['干货调味品', '干海带', '包', 535, 609.44, 'EGP', '1KG每包'],
                ['干货调味品', '鸡精', '瓶', 0, 0, 'EGP', '无货']
            ]
        }
    ];
}

test('detects Week1 as base and merges category sheets from the same supplier', () => {
    const configs = core.analyzeSheets(sampleSheets());
    assert.equal(configs.find(config => config.role === 'base').name, 'Week1 (9.5-9.9)');
    assert.equal(configs.find(config => config.name === '食材-金字塔').supplier, '金字塔');
    assert.equal(configs.find(config => config.name === '-调味品-金字塔').supplier, '金字塔');
    const groups = core.groupSuppliers(configs);
    assert.deepEqual(groups.map(group => group.name), ['金字塔', '罗葛家']);
    assert.equal(groups[0].sheets.length, 2);
    assert.equal(groups[0].records.length, 2);
});

test('extracts price and pack weight from mixed quote cells', () => {
    assert.equal(core.parsePrice('鱼酸菜400克130'), 130);
    assert.equal(core.parsePrice('185 800g'), 185);
    assert.deepEqual(core.extractMeasure('桥头火锅底料500克320'), { basis: 'kg', amount: 0.5, raw: '500克' });
});

test('normalizes tax-exclusive and tax-inclusive quotes and treats no-stock zero as missing', () => {
    const exclusive = core.quoteDetails({ priceRaw: 600, taxPriceRaw: '', spec: '1kg', unit: '', remark: '', stock: '', taxFlag: '加', taxMode: 'exclusive' }, 14);
    assert.equal(exclusive.finalPrice, 684);
    assert.equal(exclusive.normalizedPrice, 684);
    assert.equal(exclusive.taxApplied, true);

    const included = core.quoteDetails({ priceRaw: 535, taxPriceRaw: 609.44, spec: '包', unit: '', remark: '1KG每包', stock: '', taxFlag: '', taxMode: 'auto' }, 14);
    assert.equal(included.finalPrice, 609.44);
    assert.equal(included.normalizedPrice, 609.44);

    const missing = core.quoteDetails({ priceRaw: 0, taxPriceRaw: 0, spec: '瓶', unit: '', remark: '无货', stock: '', taxFlag: '', taxMode: 'auto' }, 14);
    assert.equal(missing.unavailable, true);
    assert.equal(missing.normalizedPrice, null);
});

test('matches exact product names and recommends the lowest comparable tax-inclusive price', () => {
    const base = { item: '干海带', category: '干货调味品', unit: 'kg' };
    const expensive = { supplier: '金字塔', item: '干海带', category: '干货调味品', unit: 'kg', spec: '1kg', priceRaw: 600, taxPriceRaw: '', remark: '', stock: '', taxFlag: '加', taxMode: 'exclusive' };
    const cheap = { supplier: '罗葛家', item: '干海带', category: '干货调味品', unit: '包', spec: '', priceRaw: 535, taxPriceRaw: 609.44, remark: '1KG每包', stock: '', taxFlag: '', taxMode: 'auto' };
    assert.equal(core.rankedMatches(base, [expensive], 3)[0].score, 1);
    const result = core.recommendation(base, [{ record: expensive }, { record: cheap }], 14);
    assert.equal(result.supplier, '罗葛家');
    assert.match(result.reason, /含税折算单价最低/);
});

test('reads the base-sheet supplier and compares it with the recommendation', () => {
    const baseSheet = sampleSheets()[0];
    const config = core.analyzeSheets([baseSheet])[0];
    const rows = core.recordsFromSheet(config);
    assert.equal(rows[0].baseSupplier, 'yummy');
    assert.deepEqual(core.compareSupplier('yummy', 'yummy'), { code: 'same', label: '一致' });
    assert.deepEqual(core.compareSupplier('pyramids', '金字塔'), { code: 'same', label: '一致' });
    assert.deepEqual(core.compareSupplier('yummy', '金字塔'), { code: 'different', label: '不一致' });
    assert.equal(core.compareSupplier('没有', '罗葛家').code, 'missing-base');
});
