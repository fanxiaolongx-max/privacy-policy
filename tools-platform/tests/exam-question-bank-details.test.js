const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('backend/builtin-tools/f12-to-extension/exam-question-bank-assistant.js', 'utf8');
function helpers() {
  const context = vm.createContext({ Blob, TextEncoder, currentLang: 'zh', aiText: zh => zh, typeLabel: type => type, normalizeForCompare: value => value.trim(), readStudyNotes: q => q.AI学习解析 || null });
  vm.runInContext(source.slice(source.indexOf('function detailEscape('), source.indexOf('function exportDetailFile(')) + '\nthis.h = {detailExportRows,buildDetailHtml,buildDetailWorkbook};', context);
  return context.h;
}
const entries = [{ bank: {name: '<script>bank</script>'}, q: { id: 'q1', 题型: '单选题', 题目: '=HYPERLINK("https://example.com") <img src=x onerror=alert(1)>', 选项: ['TCP', 'UDP'], 正确答案: ['TCP'], 猜测答案: ['UDP'], AI学习解析: { titleZh: '哪种协议可靠？', options: [{original:'TCP',textZh:'传输控制协议'}, {original:'UDP',textZh:'用户数据报协议'}], concept: '可靠传输', explanation: '丢包会重传。', recommendedAnswers: ['TCP'] } } }];
test('detail HTML escapes bank/question text and includes translations with confirmed answers', () => {
  const h = helpers(); const html = h.buildDetailHtml(entries);
  assert.ok(html.includes('&lt;script&gt;bank&lt;/script&gt;'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!html.includes('<script>')); assert.ok(!html.includes('<img'));
  for (const value of ['哪种协议可靠？', '传输控制协议', '可靠传输', '丢包会重传。']) assert.ok(html.includes(value));
  assert.equal(h.detailExportRows(entries)[1][8], '');
});
test('detail export produces a genuine XLSX ZIP with text cells, styles, freeze pane and filter', async () => {
  const bytes = Buffer.from(await helpers().buildDetailWorkbook(entries).arrayBuffer());
  const files = new Map(); let offset = 0;
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(bytes.readUInt16LE(offset + 8), 0);
    const size = bytes.readUInt32LE(offset + 18); const length = bytes.readUInt16LE(offset + 26);
    const name = bytes.subarray(offset + 30, offset + 30 + length).toString();
    files.set(name, bytes.subarray(offset + 30 + length, offset + 30 + length + size).toString()); offset += 30 + length + size;
  }
  assert.equal(files.size, 6); assert.ok(files.has('[Content_Types].xml'));
  const sheet = files.get('xl/worksheets/sheet1.xml');
  assert.match(sheet, /t="inlineStr"/); assert.ok(!sheet.includes('<f>'));
  assert.match(sheet, /state="frozen"/); assert.match(sheet, /autoFilter ref="A1:L2"/);
  assert.ok(sheet.includes('丢包会重传。')); assert.ok(sheet.includes('&lt;img'));
  assert.equal(bytes.readUInt32LE(offset), 0x02014b50); assert.equal(bytes.readUInt32LE(bytes.length - 22), 0x06054b50);
});
test('stat filters distinguish question type and learning status without losing confirmed error evidence', () => {
  const context=vm.createContext({});
  vm.runInContext(source.slice(source.indexOf('function questionLearningStatus('), source.indexOf('function applyDetailFilters('))+'\nthis.h={questionLearningStatus,matchesDetailStatFilter};',context);
  const {questionLearningStatus:status,matchesDetailStatFilter:match}=context.h;
  const confirmed={题型:'单选题',正确答案:['A'],猜测答案:['B'],错误答案:['B']};
  const suggested={题型:'多选题',猜测答案:['A'],错误组合:[['B','C']]};
  const pending={题型:'判断题',正确答案:[],猜测答案:[]};
  assert.equal(status(confirmed).confirmed,true);assert.equal(status(confirmed).suggested,false);
  assert.equal(match(confirmed,'confirmed'),true);assert.equal(match(confirmed,'suggested'),false);assert.equal(match(confirmed,'pending'),false);assert.equal(match(confirmed,'errors'),true);
  assert.equal(match(suggested,'suggested'),true);assert.equal(match(suggested,'errors'),true);assert.equal(match(suggested,'multiple'),true);
  assert.equal(match(pending,'trueFalse'),true);assert.equal(match(pending,'pending'),true);assert.equal(match(pending,'single'),false);
  for(const filter of [null,'total'])for(const q of [confirmed,suggested,pending])assert.equal(match(q,filter),true);
  assert.equal(match({明确错误答案:['A']},'errors'),true);assert.equal(match({},'pending'),true);assert.equal(match({},'errors'),false);
});
test('question-bank assistant and encryption core do not call browser-native dialogs', () => {
  const vault=fs.readFileSync('backend/builtin-tools/f12-to-extension/exam-vault.js','utf8');
  for(const code of [source,vault])assert.doesNotMatch(code,/\b(?:alert|confirm|prompt)\s*\(/);
});
test('asynchronous confirmations cancel if data changed or the assistant closed', async () => {
  const values=new Map([['ScraperData_A','old']]);const notices=[];
  const context=vm.createContext({examStorage:{getItem:key=>values.get(key)??null},widget:{isConnected:true},secureStorage:{failed:null},showExamConfirm:async()=>true,showExamAlert:message=>notices.push(message),aiText:zh=>zh});
  vm.runInContext(source.slice(source.indexOf('async function confirmStoredChange('),source.indexOf('const I18N ='))+'\nthis.ask=confirmStoredChange;',context);
  assert.equal(await context.ask('confirm',['ScraperData_A']),true);
  context.showExamConfirm=async()=>false;assert.equal(await context.ask('confirm',['ScraperData_A']),false);
  context.showExamConfirm=async()=>{values.set('ScraperData_A','new');return true};assert.equal(await context.ask('confirm',['ScraperData_A']),false);assert.equal(notices.length,1);
  context.showExamConfirm=async()=>true;context.widget.isConnected=false;assert.equal(await context.ask('confirm',['ScraperData_A']),false);
});
