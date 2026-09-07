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

test('generates fingerprint and matches identical schema', () => {
    const sheetsA = sampleSheets();
    const sheetsB = sampleSheets();
    const fpA = core.buildWorkbookFingerprint(sheetsA);
    const fpB = core.buildWorkbookFingerprint(sheetsB);
    assert.equal(core.isSchemaMatch(fpA, fpB), true);

    const changedSheets = sampleSheets();
    changedSheets[1].name = '食材-新金字塔';
    const fpChanged = core.buildWorkbookFingerprint(changedSheets);
    assert.equal(core.isSchemaMatch(fpA, fpChanged), false);
});

test('applies saved sheet configurations when schema matches', () => {
    const sheets = sampleSheets();
    const configs = core.analyzeSheets(sheets);
    const savedConfig = {
        sheets: [
            {
                name: 'Week1 (9.5-9.9)',
                role: 'base',
                headerRow: 1,
                columns: { item: 2, quantity: 5, category: 3, unit: 4, baseSupplier: 1 }
            },
            {
                name: '罗葛家',
                role: 'supplier',
                supplier: '罗葛精选',
                headerRow: 0,
                taxMode: 'inclusive',
                columns: { item: 1, category: 0, spec: 2, price: 3, taxPrice: 4, remark: 6 }
            }
        ]
    };
    const success = core.applySavedConfig(configs, savedConfig);
    assert.equal(success, true);
    const luoConfig = configs.find(c => c.name === '罗葛家');
    assert.equal(luoConfig.supplier, '罗葛精选');
    assert.equal(luoConfig.taxMode, 'inclusive');
});

test('handles inconsistent units across suppliers by disabling normalized comparison', () => {
    const base = { item: '鸡精', category: '调味品', unit: '件' };
    const quotePiece = { supplier: '供应商A', item: '鸡精', category: '调味品', unit: '件', spec: '', priceRaw: 120, taxPriceRaw: 120, remark: '', stock: '' };
    const quoteKg = { supplier: '供应商B', item: '鸡精', category: '调味品', unit: 'kg', spec: '1kg', priceRaw: 45, taxPriceRaw: 45, remark: '', stock: '' };

    const evaluation = core.evaluateRowComparison(base, [{ record: quotePiece }, { record: quoteKg }], 14);
    assert.equal(evaluation.unitMismatch, true);
    assert.equal(evaluation.canCompareByNormalized, false);
    assert.equal(evaluation.recommendation.supplier, '');
    assert.match(evaluation.recommendation.reason, /不同供应商报价单位不一致/);
});

test('handles extreme normalized price deviation by directly comparing quote prices and flagging for review', () => {
    const base = { item: '干海带', category: '干货', unit: 'kg' };
    // 同样是 kg，但供应商A 20元/kg，供应商B 180元/kg，相差 9 倍（>= 3.0倍）
    const quoteNormal = { supplier: '供应商A', item: '干海带', category: '干货', unit: 'kg', spec: '1kg', priceRaw: 20, taxPriceRaw: 20, remark: '', stock: '' };
    const quoteExtreme = { supplier: '供应商B', item: '干海带', category: '干货', unit: 'kg', spec: '1kg', priceRaw: 180, taxPriceRaw: 180, remark: '', stock: '' };

    const evaluation = core.evaluateRowComparison(base, [{ record: quoteNormal }, { record: quoteExtreme }], 14);
    assert.equal(evaluation.extremeDeviation, true);
    assert.equal(evaluation.canCompareByNormalized, false);
    assert.equal(evaluation.winner.supplier, '供应商A');
    assert.equal(evaluation.recommendation.supplier, '供应商A');
    assert.equal(evaluation.recommendation.isAnomaly, true);
    assert.match(evaluation.recommendation.reason, /需人工二次复核确认/);

    const compStatus = core.compareSupplier('供应商B', '供应商A', true);
    assert.equal(compStatus.code, 'anomaly-review');
    assert.equal(compStatus.label, '⚠️ 需人工复核');
});


