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
    ['', '', '', '', '', '', '', '', ''],
    ['-', 46295, '', '', '', '斤', '10', '品名与分类皆空不可纠错测试', '50'],
  ];

  const cleaned = ctx.cleanAndFilterData(mockRawGrid1, false, { sourceName: '标准源表格', fileName: 'demo.xlsx', sheetName: 'Sheet1' }, collector);
  assert.ok(cleaned.length > 0);
  assert.deepEqual(Array.from(cleaned[0]), ["DATE", "BIG SERIES", "DESCRIPTION OF GOODS", "UNIT", "采购量", "厨师备注"]);
  assert.equal(cleaned[1][2], '干海带');
  const hasOutdatedRow = cleaned.some(row => row.includes('过期大白菜'));
  assert.equal(hasOutdatedRow, false, 'Row with 2025/12/11 should be filtered out');
  const dateAnomalies = collector.filter(a => a.issueType === '过期/异常日期数据过滤');
  assert.ok(dateAnomalies.length >= 1, 'Should log anomaly for filtered outdated date row');
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

