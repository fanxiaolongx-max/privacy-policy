const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const htmlPath = path.join(__dirname, '../backend/builtin-tools/tool-mtpx4vtr/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.ok(scriptMatches.length >= 2, 'tool-mtpx4vtr must have at least 2 script tags');
const mainScript = scriptMatches[1][1];

function createContext() {
  const mockEl = () => ({
    textContent: '',
    value: '',
    files: [],
    classList: { add: () => {}, remove: () => {} },
    querySelector: () => mockEl(),
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 100, height: 100, right: 100, bottom: 100 })
  });

  const winObj = {
    auditStore: { anomalyLogs: [] },
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  const docObj = {
    getElementById: () => mockEl(),
    querySelector: () => mockEl(),
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  winObj.window = winObj;
  winObj.document = docObj;

  const context = {
    tailwind: { config: {} },
    window: winObj,
    document: docObj,
    console,
    Math,
    Date,
    String,
    Number,
    Array,
    Set,
    Map,
    RegExp,
    Uint8Array,
    FileReader: class {},
    alert: () => {},
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {}
  };
  vm.createContext(context);
  vm.runInContext(mainScript, context);
  return context;
}

test('餐单核验: Case 1 表头只有 SUPPLIER\'S NAME 和 BIG SERIES 自动纠偏为品类与品名', () => {
  const ctx = createContext();
  const collector = [];
  const case1Grid = [
    ["SUPPLIER'S NAME", "BIG SERIES"],
    ["肉食禽蛋海鲜", "草鱼"],
    ["肉食禽蛋海鲜", "土鸡"],
    ["蔬菜", "豆腐皮"],
    ["蔬菜", "嫩豆腐"]
  ];

  const cleaned = ctx.cleanAndFilterData(case1Grid, false, { sourceName: '核心标准源', fileName: 'test1.xlsx', sheetName: 'Sheet1' }, collector);
  assert.ok(cleaned.length > 0, 'Cleaned grid should not be empty');
  assert.equal(cleaned[0][0], 'BIG SERIES');
  assert.equal(cleaned[0][1], 'DESCRIPTION OF GOODS');
  assert.equal(cleaned[1][0], '肉食禽蛋海鲜');
  assert.equal(cleaned[1][1], '草鱼');
  assert.equal(cleaned[3][0], '蔬菜');
  assert.equal(cleaned[3][1], '豆腐皮');

  const corrAnomalies = collector.filter(a => a.issueType === '表头列名错位自动校正');
  assert.ok(corrAnomalies.length >= 2, 'Should log column auto-correction anomalies');
});

test('餐单核验: Case 2 表头向左错位 1 列自动校正', () => {
  const ctx = createContext();
  const collector = [];
  const case2Grid = [
    ["SUPPLIER'S NAME", "BIG SERIES", "DESCRIPTION OF GOODS"],
    ["蔬菜", "老豆腐", "pcs"],
    ["蔬菜", "韭菜", "kg"],
    ["肉食禽蛋海鲜", "鲤鱼", "kg"]
  ];

  const cleaned = ctx.cleanAndFilterData(case2Grid, true, { sourceName: '待核对目标表', fileName: 'test2.xlsx', sheetName: 'Sheet1' }, collector);
  assert.ok(cleaned.length > 0);
  assert.equal(cleaned[0][0], 'BIG SERIES');
  assert.equal(cleaned[0][1], 'DESCRIPTION OF GOODS');
  assert.equal(cleaned[0][2], 'UNIT');
  assert.equal(cleaned[1][0], '蔬菜');
  assert.equal(cleaned[1][1], '老豆腐');
  assert.equal(cleaned[1][2], 'pcs');
  assert.equal(cleaned[3][0], '肉食禽蛋海鲜');
  assert.equal(cleaned[3][1], '鲤鱼');
  assert.equal(cleaned[3][2], 'kg');
});

test('餐单核验: Case 3 品名错位到供应商列且品名列全空，自动识别品名并不被大分类覆盖', () => {
  const ctx = createContext();
  const collector = [];
  const case3Grid = [
    ["SUPPLIER'S NAME", "BIG SERIES", "DESCRIPTION OF GOODS", "UNIT", "采购量"],
    ["罗非鱼", "肉食禽蛋海鲜", "", "kg", 20],
    ["老鹅", "肉食禽蛋海鲜", "", "kg", 25],
    ["大白菜", "蔬菜", "", "kg", 20]
  ];

  const cleaned = ctx.cleanAndFilterData(case3Grid, true, { sourceName: '待核对目标表', fileName: 'test3.xlsx', sheetName: 'Sheet1' }, collector);
  assert.ok(cleaned.length > 0);
  assert.equal(cleaned[0][0], 'BIG SERIES');
  assert.equal(cleaned[0][1], 'DESCRIPTION OF GOODS');
  assert.equal(cleaned[0][2], 'UNIT');
  assert.equal(cleaned[0][3], '采购量');
  assert.equal(cleaned[1][0], '肉食禽蛋海鲜');
  assert.equal(cleaned[1][1], '罗非鱼');
  assert.equal(cleaned[1][2], 'kg');
  assert.equal(cleaned[1][3], '20');
  assert.equal(cleaned[2][1], '老鹅');
  assert.equal(cleaned[3][1], '大白菜');
});

test('餐单核验: 内置示例数据兼容性测试', () => {
  const ctx = createContext();
  const collector = [];
  const mockRawGrid1 = [
    ['无效列', 'DATE', 'BIG SERIES', 'BIG SERIES', 'DESCRIPTION OF GOODS', 'UNIT', '采购量', '厨师备注', '总价'],
    ['-', 46295, '干货类', '南北干货', '干海带', '公斤', '4', '多重大类合并去重测试', '100'],
    ['-', 46295, '调料类', '调料类', '', '斤', '5', '品名空缺自动以大分类补全测试', '30'],
    ['-', 46295, '蔬菜类', '蔬菜类', '公斤', '花菜', '15', '品名与单位反转调换测试', '60'],
    ['-', 46002, '蔬菜类', '蔬菜类', '过期大白菜', '斤', '10', '历史日期偏差过大自动过滤测试(2025/12/11)', '50'],
    ['-', '', '蔬菜类', '蔬菜类', '无日期生菜', '斤', '8', '数据行无送货日期自动忽略测试', '30'],
    ['', '', '', '', '', '', '', '', ''],
    ['-', 46295, '', '', '', '斤', '10', '品名与分类皆空不可纠错测试', '50'],
  ];

  const cleaned = ctx.cleanAndFilterData(mockRawGrid1, false, { sourceName: '标准源表格', fileName: 'demo.xlsx', sheetName: 'Sheet1' }, collector);
  assert.ok(cleaned.length > 0);
  assert.deepEqual(Array.from(cleaned[0]), ["DATE", "BIG SERIES", "DESCRIPTION OF GOODS", "UNIT", "采购量", "厨师备注"]);
  assert.equal(cleaned[1][2], '干海带');
  const hasOutdatedRow = cleaned.some(row => row.includes('过期大白菜'));
  assert.equal(hasOutdatedRow, false, 'Row with 2025/12/11 should be filtered out');
  const hasMissingDateRow = cleaned.some(row => row.includes('无日期生菜'));
  assert.equal(hasMissingDateRow, false, 'Row without date should be filtered out');
  const dateAnomalies = collector.filter(a => a.issueType === '过期/异常日期数据过滤');
  assert.ok(dateAnomalies.length >= 1, 'Should log anomaly for filtered outdated date row');
  const missingDateAnomalies = collector.filter(a => a.issueType === '缺失日期数据过滤');
  assert.ok(missingDateAnomalies.length >= 1, 'Should log anomaly for filtered missing date row');
});

test('餐单核验: Case 5 日期列含 Excel 序列号且表头列名错位，防止将日期识别为采购量', () => {
  const ctx = createContext();
  const collector = [];
  const case5Grid = [
    ['DATE', "SUPPLIER'S NAME", 'BIG SERIES', 'DESCRIPTION OF GOODS', 'UNIT', '采购量'],
    [46295, '蔬菜', '老豆腐', 'pcs', '', 20],
    [46295, '蔬菜', '韭菜', 'kg', '', 8],
    [46295, '蔬菜', '空心菜', 'kg', '', 20],
    [46295, '蔬菜', '嫩豆腐', 'pcs', '', 18],
    [46295, '蔬菜', '瓢子瓜', 'kg', '', 15],
    [46295, '蔬菜', '菜心', 'kg', '', 25]
  ];

  const cleaned = ctx.cleanAndFilterData(case5Grid, false, { sourceName: '核心标准源', fileName: 'test5.xlsx', sheetName: 'Sheet1' }, collector);
  assert.ok(cleaned.length > 0);
  assert.deepEqual(Array.from(cleaned[0]), ['DATE', 'BIG SERIES', 'DESCRIPTION OF GOODS', 'UNIT', '采购量']);
  assert.equal(cleaned[1][0], '2026/9/30');
  assert.equal(cleaned[1][1], '蔬菜');
  assert.equal(cleaned[1][2], '老豆腐');
  assert.equal(cleaned[1][3], 'pcs');
  assert.equal(cleaned[1][4], 20);
  assert.notEqual(cleaned[1][4], 46295);
});

test('餐单核验: Case 7 数据行没有有效日期时自动忽略过滤该行', () => {
  const ctx = createContext();
  const collector = [];
  const case7Grid = [
    ['DATE', "SUPPLIER'S NAME", 'BIG SERIES', 'DESCRIPTION OF GOODS', 'UNIT', '采购量'],
    ['2026/10/5', '蔬菜', '老豆腐', 'pcs', '', 20],
    ['', '蔬菜', '无日期空心菜', 'kg', '', 10],
    [null, '蔬菜', '空日期生菜', 'kg', '', 15],
    ['2026/10/5', '蔬菜', '韭菜', 'kg', '', 8],
    ['-', '蔬菜', '横杠日期番茄', 'kg', '', 20],
    ['合计', '蔬菜', '小计统计行', 'kg', '', 50]
  ];

  const cleaned = ctx.cleanAndFilterData(case7Grid, false, { sourceName: '核心标准源', fileName: 'test7.xlsx', sheetName: 'Sheet1' }, collector);
  assert.equal(cleaned.length, 3, 'Header + 2 valid date rows');
  assert.equal(cleaned[1][2], '老豆腐');
  assert.equal(cleaned[2][2], '韭菜');

  const missingAnomalies = collector.filter(a => a.issueType === '缺失日期数据过滤');
  assert.equal(missingAnomalies.length, 4, 'Should record 4 anomalies for the 4 rows missing valid dates');
  assert.equal(missingAnomalies[0].actionTaken, '过滤跳过');
  assert.equal(missingAnomalies[0].hasCorrection, false);
});

test('餐单核验: Case 8 识别到WK周数列（包含WK且其余全是数字）时自动忽略该列，避免被识别为采购量', () => {
  const ctx = createContext();
  const collector = [];
  const case8Grid = [
    ['DATE', 'WK 1', "SUPPLIER'S NAME", 'BIG SERIES', 'DESCRIPTION OF GOODS', 'UNIT', '采购量'],
    ['2026/10/5', 1, '晨光蔬菜', '蔬菜', '老豆腐', 'pcs', 20],
    ['2026/10/5', 1, '晨光蔬菜', '蔬菜', '韭菜', 'kg', 8],
    ['2026/10/5', 1, '晨光蔬菜', '蔬菜', '空心菜', 'kg', 15]
  ];

  const cleaned = ctx.cleanAndFilterData(case8Grid, true, { sourceName: '待核对目标表', fileName: 'test8.xlsx', sheetName: 'Sheet1' }, collector);
  assert.ok(cleaned.length > 0);
  assert.equal(cleaned[0].includes('WK 1'), false, 'WK 1 should not be in cleaned headers');
  const qtyIdx = cleaned[0].indexOf('采购量');
  assert.ok(qtyIdx !== -1, '采购量 column should exist');
  assert.equal(Number(cleaned[1][qtyIdx]), 20, 'Quantity should be 20, not the week number 1');
  assert.equal(Number(cleaned[2][qtyIdx]), 8, 'Quantity should be 8, not the week number 1');
  assert.equal(Number(cleaned[3][qtyIdx]), 15, 'Quantity should be 15, not the week number 1');

  const wkAnomalies = collector.filter(a => a.issueType === '预留周数列自动忽略');
  assert.equal(wkAnomalies.length, 1, 'Should log WK column ignore anomaly');
  assert.match(wkAnomalies[0].issueDesc, /预留周数列/);

  // 进一步测试：采购量表头缺失时，WK列也不会抢占采购量
  const case8Shifted = [
    ['DATE', 'WK', 'BIG SERIES', 'DESCRIPTION OF GOODS', 'UNIT', ''],
    ['2026/10/5', 2, '蔬菜', '土豆', 'kg', 50],
    ['2026/10/5', 2, '蔬菜', '番茄', 'kg', 35]
  ];
  const collector2 = [];
  const cleanedShifted = ctx.cleanAndFilterData(case8Shifted, true, { sourceName: '待核对目标表', fileName: 'test8-shifted.xlsx', sheetName: 'Sheet1' }, collector2);
  const shiftedQtyIdx = cleanedShifted[0].indexOf('采购量');
  assert.ok(shiftedQtyIdx !== -1, 'Shifted 采购量 should be identified');
  assert.equal(Number(cleanedShifted[1][shiftedQtyIdx]), 50, 'Shifted quantity should be 50, not week 2');
  assert.equal(Number(cleanedShifted[2][shiftedQtyIdx]), 35, 'Shifted quantity should be 35, not week 2');
});

test('餐单核验: Case 9 源表中采购量为0（或0.0、0kg等）自动忽略过滤该行', () => {
  const ctx = createContext();
  const collector = [];
  const case9Grid = [
    ['DATE', 'BIG SERIES', 'DESCRIPTION OF GOODS', 'UNIT', '采购量'],
    ['2026/10/5', '蔬菜', '老豆腐', 'pcs', 20],
    ['2026/10/5', '蔬菜', '零采购韭菜', 'kg', 0],
    ['2026/10/5', '蔬菜', '零采购空心菜', 'kg', '0'],
    ['2026/10/5', '蔬菜', '零浮点白菜', 'kg', '0.0'],
    ['2026/10/5', '蔬菜', '零单位菠菜', 'kg', '0kg'],
    ['2026/10/5', '蔬菜', '正常番茄', 'kg', 15]
  ];

  const cleaned = ctx.cleanAndFilterData(case9Grid, false, { sourceName: '核心标准源', fileName: 'test9.xlsx', sheetName: 'Sheet1' }, collector);
  assert.equal(cleaned.length, 3, 'Header + 2 non-zero quantity rows');
  assert.equal(cleaned[1][2], '老豆腐');
  assert.equal(cleaned[2][2], '正常番茄');

  const zeroAnomalies = collector.filter(a => a.issueType === '数量为空或为0');
  assert.equal(zeroAnomalies.length, 4, 'Should record 4 anomalies for the 4 zero-quantity rows');
  assert.equal(zeroAnomalies[0].actionTaken, '过滤跳过');
  assert.equal(zeroAnomalies[0].hasCorrection, false);
});

test('餐单核验: Case 10 比对结果中当 SUPPLIER NAME 全为空时，不标记疑似缺货，只核对差值', () => {
  const ctx = createContext();
  const coreRows = [
    { key: '2026/10/5\u0000老豆腐', date: '2026/10/5', item: '老豆腐', qty: 20, unitText: 'pcs', bigSeriesText: '蔬菜', normalizedItem: '老豆腐', quantityAny: false },
    { key: '2026/10/5\u0000韭菜', date: '2026/10/5', item: '韭菜', qty: 10, unitText: 'kg', bigSeriesText: '蔬菜', normalizedItem: '韭菜', quantityAny: false },
    { key: '2026/10/5\u0000草鱼', date: '2026/10/5', item: '草鱼', qty: 5, unitText: '条', bigSeriesText: '海鲜', normalizedItem: '草鱼', quantityAny: false }
  ];

  // 待核对表中 SUPPLIER NAME 全为空
  const targetRowsEmptySupplier = [
    { key: '2026/10/5\u0000老豆腐', date: '2026/10/5', item: '老豆腐', qty: 20, unitText: 'pcs', bigSeriesText: '蔬菜', normalizedItem: '老豆腐', supplier: '', hasMissingSupplier: true },
    { key: '2026/10/5\u0000韭菜', date: '2026/10/5', item: '韭菜', qty: 8, unitText: 'kg', bigSeriesText: '蔬菜', normalizedItem: '韭菜', supplier: '', hasMissingSupplier: true }
    // 草鱼未送货 (少了)
  ];

  const comparison = ctx.buildComparisonData(coreRows, targetRowsEmptySupplier);
  assert.equal(comparison.length, 3);

  // 验证不标记“疑似缺货”
  comparison.forEach(row => {
    assert.notEqual(row.remark, '疑似缺货', `Row ${row.item} should NOT be marked 疑似缺货 when all suppliers are empty`);
    assert.equal(row.remark, '', 'Remark should remain empty');
  });

  const laodoufu = comparison.find(r => r.item === '老豆腐');
  assert.equal(laodoufu.status, '一致');
  assert.equal(laodoufu.difference, 0);

  const jiucai = comparison.find(r => r.item === '韭菜');
  assert.equal(jiucai.status, '少了');
  assert.equal(jiucai.difference, -2);

  const caoyu = comparison.find(r => r.item === '草鱼');
  assert.equal(caoyu.status, '少了');
  assert.equal(caoyu.difference, -5);
  assert.equal(caoyu.remark, '', 'Missing core item also must NOT be marked 疑似缺货 when all suppliers empty');
});

test('餐单核验: Case 11 比对标签上的数字严格按照核对结果非一致的条目统计', () => {
  const ctx = createContext();
  const comparisonResults = [
    { status: '一致', remark: '' },
    { status: '一致', remark: '' },
    { status: '少了', remark: '' },
    { status: '多了', remark: '' },
    { status: '核心源无此物品', remark: '' },
    { status: '一致', remark: '疑似缺货' } // 即使有疑似缺货，一致的条目也不计入差异
  ];

  const nonMatchCount = comparisonResults.filter(row => row.status !== '一致').length;
  assert.equal(nonMatchCount, 3, 'Should strictly count 3 non-matching items (少了、多了、核心源无此物品)');

  // 模拟 updateAllBadges 的统计逻辑
  let badgeText = '';
  ctx.document.getElementById = (id) => ({
    set textContent(val) {
      if (id === 'tab-badge-comparison') badgeText = val;
    }
  });
  ctx.updateAllBadges();
  // 校验当前比较结果 badge 包含差异描述
  assert.match(badgeText, /\d+项差异/);
});

test('餐单核验: Case 12 比对结果中应有数量、实际数量、差值三列数据都为0的行自动忽略', () => {
  const ctx = createContext();
  const coreRows = [
    // 正常物品
    { key: '2026/10/5\u0000老豆腐', date: '2026/10/5', item: '老豆腐', qty: 20, unitText: 'pcs', bigSeriesText: '蔬菜', normalizedItem: '老豆腐', quantityAny: false },
    { key: '2026/10/5\u0000草鱼', date: '2026/10/5', item: '草鱼', qty: 10, unitText: '条', bigSeriesText: '肉食禽蛋海鲜', normalizedItem: '草鱼', quantityAny: false },
    // 异常的0数量行（如残留表头或大分类伪品名）
    { key: '2026/10/5\u0000采购量', date: '2026/10/5', item: '采购量', qty: 0, unitText: 'UNIT (单位)', bigSeriesText: 'BIG SERIES', normalizedItem: '采购量', quantityAny: false },
    { key: '2026/10/5\u0000肉食禽蛋海鲜', date: '2026/10/5', item: '肉食禽蛋海鲜', qty: 0, unitText: 'kg', bigSeriesText: '肉食禽蛋海鲜', normalizedItem: '肉食禽蛋海鲜', quantityAny: false },
    { key: '2026/10/5\u0000蔬菜', date: '2026/10/5', item: '蔬菜', qty: 0, unitText: 'pcs / kg', bigSeriesText: '蔬菜', normalizedItem: '蔬菜', quantityAny: false }
  ];

  const targetRows = [
    { key: '2026/10/5\u0000老豆腐', date: '2026/10/5', item: '老豆腐', qty: 20, unitText: 'pcs', bigSeriesText: '蔬菜', normalizedItem: '老豆腐', supplier: '', hasMissingSupplier: true },
    { key: '2026/10/5\u0000草鱼', date: '2026/10/5', item: '草鱼', qty: 8, unitText: '条', bigSeriesText: '肉食禽蛋海鲜', normalizedItem: '草鱼', supplier: '', hasMissingSupplier: true }
  ];

  const comparison = ctx.buildComparisonData(coreRows, targetRows);

  // 验证「采购量」、「肉食禽蛋海鲜」、「蔬菜」这3行全为0的行已被完全过滤
  const itemsInResult = comparison.map(r => r.item);
  assert.ok(!itemsInResult.includes('采购量'), '采购量 (0, 0, 0) should be filtered out');
  assert.ok(!itemsInResult.includes('肉食禽蛋海鲜'), '肉食禽蛋海鲜 (0, 0, 0) should be filtered out');
  assert.ok(!itemsInResult.includes('蔬菜'), '蔬菜 (0, 0, 0) should be filtered out');

  // 验证正常品名依然保留
  assert.equal(comparison.length, 2, 'Should only contain the 2 valid items (老豆腐 and 草鱼)');
  const laodoufu = comparison.find(r => r.item === '老豆腐');
  assert.equal(laodoufu.expected, 20);
  assert.equal(laodoufu.actual, 20);
  assert.equal(laodoufu.difference, 0);
  assert.equal(laodoufu.status, '一致');

  const caoyu = comparison.find(r => r.item === '草鱼');
  assert.equal(caoyu.expected, 10);
  assert.equal(caoyu.actual, 8);
  assert.equal(caoyu.difference, -2);
  assert.equal(caoyu.status, '少了');
});

test('餐单核验: Case 13 自动去除品名和单位中的残留括号并完成准确比对', () => {
  const ctx = createContext();

  // 1. 验证 cleanOrderBrackets 基础函数对各种残余、包裹、未闭合括号的处理
  assert.equal(ctx.cleanOrderBrackets('黄豆酱2件('), '黄豆酱2件', 'Trailing unclosed ( should be stripped');
  assert.equal(ctx.cleanOrderBrackets('老豆腐（'), '老豆腐', 'Trailing unclosed （ should be stripped');
  assert.equal(ctx.cleanOrderBrackets('瓶)'), '瓶', 'Trailing stray ) should be stripped');
  assert.equal(ctx.cleanOrderBrackets('瓶）'), '瓶', 'Trailing stray ） should be stripped');
  assert.equal(ctx.cleanOrderBrackets('(瓶)'), '瓶', 'Outer () should be stripped');
  assert.equal(ctx.cleanOrderBrackets('（瓶）'), '瓶', 'Outer （） should be stripped');
  assert.equal(ctx.cleanOrderBrackets('[kg]'), 'kg', 'Outer [] should be stripped');
  assert.equal(ctx.cleanOrderBrackets('【袋】'), '袋', 'Outer 【】 should be stripped');
  assert.equal(ctx.cleanOrderBrackets('）件'), '件', 'Leading stray ） should be stripped');
  assert.equal(ctx.cleanOrderBrackets('(黄豆酱'), '黄豆酱', 'Leading stray ( should be stripped');
  assert.equal(ctx.cleanOrderBrackets('黄豆酱()'), '黄豆酱', 'Empty brackets should be stripped');
  assert.equal(ctx.cleanOrderBrackets('生抽（  ）'), '生抽', 'Empty fullwidth brackets should be stripped');
  assert.equal(ctx.cleanOrderBrackets('可口可乐(罐装)'), '可口可乐(罐装)', 'Valid specification inside brackets should be preserved');
  assert.equal(ctx.cleanOrderBrackets('可口可乐(罐装))'), '可口可乐(罐装)', 'Extra closing bracket on spec should be cleaned');

  // 2. 验证标准文本解析 parseTextToTable 支持形如 "黄豆酱2件(12瓶)" 的解析
  const parsed = ctx.parseTextToTable("黄豆酱2件(12瓶)\n老豆腐（10块）\n可乐24听");
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].item, '黄豆酱2件');
  assert.equal(parsed[0].qty, '12');
  assert.equal(parsed[0].unit, '瓶');
  assert.equal(parsed[1].item, '老豆腐');
  assert.equal(parsed[1].qty, '10');
  assert.equal(parsed[1].unit, '块');
  assert.equal(parsed[2].item, '可乐');
  assert.equal(parsed[2].qty, '24');
  assert.equal(parsed[2].unit, '听');

  // 3. 验证 cleanAndFilterData 自动检测并清洗表格中的残存括号
  const collector = [];
  const rawExcelGrid = [
    ["DATE", "DESCRIPTION OF GOODS", "采购量", "UNIT"],
    ["2026/10/5", "黄豆酱2件(", "12", "瓶)"],
    ["2026/10/5", "老豆腐（", "10", "（块）"]
  ];
  const cleanedGrid = ctx.cleanAndFilterData(rawExcelGrid, false, { sourceName: '核心表', fileName: 'test.xlsx', sheetName: 'Sheet1' }, collector);
  assert.equal(cleanedGrid[1][1], '黄豆酱2件', 'Item name should be cleaned of trailing bracket');
  assert.equal(cleanedGrid[1][2], '瓶', 'Unit should be cleaned of trailing bracket');
  assert.equal(cleanedGrid[1][3], '12');
  assert.equal(cleanedGrid[2][1], '老豆腐');
  assert.equal(cleanedGrid[2][2], '块');
  assert.equal(cleanedGrid[2][3], '10');

  const bracketAnomalies = collector.filter(a => a.issueType.includes('括号冗余自动清洗'));
  assert.ok(bracketAnomalies.length >= 2, 'Should record bracket cleanup anomalies in audit log');

  // 4. 验证比对数据构建 buildComparisonData：
  // 核心源带残余括号 "黄豆酱2件(" 与 "瓶)"，待核对源为 "黄豆酱2件" 与 "瓶"
  const coreRows = [
    { key: '2026/10/5\u0000黄豆酱2件', date: '2026/10/5', item: '黄豆酱2件(', qty: 12, unitText: '瓶)', bigSeriesText: '副食调料', normalizedItem: '黄豆酱2件', quantityAny: false }
  ];
  const targetRowsMatch = [
    { key: '2026/10/5\u0000黄豆酱2件', date: '2026/10/5', item: '黄豆酱2件', qty: 12, unitText: '瓶', bigSeriesText: '副食调料', normalizedItem: '黄豆酱2件', supplier: '海纳副食' }
  ];
  const compMatch = ctx.buildComparisonData(coreRows, targetRowsMatch);
  assert.equal(compMatch.length, 1);
  assert.equal(compMatch[0].status, '一致');
  assert.equal(compMatch[0].item, '黄豆酱2件', 'Output item must not contain dangling bracket');
  assert.equal(compMatch[0].coreUnit, '瓶', 'Output coreUnit must not contain dangling bracket');
  assert.equal(compMatch[0].targetUnit, '瓶');

  // 如果待核对没有送该货（即原问题中的 "2 少了 黄豆酱2件( 12 0 -12 瓶)"）：
  const targetRowsEmpty = [];
  const compMissing = ctx.buildComparisonData(coreRows, targetRowsEmpty);
  assert.equal(compMissing.length, 1);
  assert.equal(compMissing[0].status, '少了');
  assert.equal(compMissing[0].item, '黄豆酱2件', 'Missing row item must have bracket cleaned');
  assert.equal(compMissing[0].expected, 12);
  assert.equal(compMissing[0].actual, 0);
  assert.equal(compMissing[0].difference, -12);
  assert.equal(compMissing[0].coreUnit, '瓶', 'Missing row unit must have bracket cleaned');
});



