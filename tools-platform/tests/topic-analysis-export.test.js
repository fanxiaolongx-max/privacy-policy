const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ExcelJS = require('exceljs');

test('monthly Excel export handles multi-row table headers', async () => {
    const source = fs.readFileSync(path.join(__dirname, '../frontend/js/topic-analysis.js'), 'utf-8');
    const start = source.indexOf('    function appendMonthlyWorksheet(workbook) {');
    const end = source.indexOf('    function appendAnalysisWorksheet(', start);
    assert.ok(start >= 0 && end > start);

    const cell = (text, rowSpan = 1, colSpan = 1) => ({
        textContent: text, rowSpan, colSpan, tagName: 'TH', classList: { contains: () => false },
        getAttribute: () => null
    });
    const row = cells => ({ cells, parentElement: { tagName: 'THEAD' }, classList: { contains: () => false } });
    const table = {
        nodeType: 1, tagName: 'TABLE', rows: [
            row([cell('客户', 3), cell('紧急 EOS', 1, 7)]),
            row([cell('总量', 2), cell('已收编', 2), cell('当前收编率', 2), cell('待收编', 1, 3), cell('计划后收编率', 2)]),
            row([cell('小计'), cell('今年计划'), cell('无计划')])
        ]
    };
    const sheet = { children: [table] };
    const append = vm.runInNewContext(`(() => { ${source.slice(start, end)} return appendMonthlyWorksheet; })()`, {
        elements: { eosReportSheet: sheet }, document: {}, Node: { ELEMENT_NODE: 1 }
    });
    const workbook = new ExcelJS.Workbook();
    const worksheet = append(workbook);
    assert.equal(worksheet.getCell('A1').value, '客户');
    assert.equal(worksheet.getCell('B2').value, '总量');
    assert.equal(worksheet.getCell('E3').value, '小计');
    assert.equal(worksheet.getCell('G3').value, '无计划');
    const buffer = await workbook.xlsx.writeBuffer();
    assert.ok(buffer.length > 0);
});

test('frontend static assets for html2canvas, jspdf and exceljs exist and are valid', () => {
    const html2canvasPath = path.join(__dirname, '../frontend/js/shared/html2canvas.min.js');
    const jspdfPath = path.join(__dirname, '../frontend/js/shared/jspdf.umd.min.js');
    const exceljsPath = path.join(__dirname, '../frontend/js/shared/exceljs.min.js');
    assert.ok(fs.existsSync(html2canvasPath), 'html2canvas.min.js should exist');
    assert.ok(fs.existsSync(jspdfPath), 'jspdf.umd.min.js should exist');
    assert.ok(fs.existsSync(exceljsPath), 'exceljs.min.js should exist');
    assert.ok(fs.statSync(html2canvasPath).size > 50000, 'html2canvas size should be > 50KB');
    assert.ok(fs.statSync(jspdfPath).size > 100000, 'jspdf size should be > 100KB');
    assert.ok(fs.statSync(exceljsPath).size > 500000, 'exceljs size should be > 500KB');
});

test('topic-analysis.html contains theme toggle and export controls', () => {
    const html = fs.readFileSync(path.join(__dirname, '../frontend/pages/topic-analysis.html'), 'utf-8');
    assert.ok(html.includes('id="themeToggleButton"'), 'Must have theme toggle button');
    assert.ok(html.includes('id="eosDownloadPng"'), 'Must have EOS PNG download button');
    assert.ok(html.includes('id="eosDownloadPdf"'), 'Must have EOS PDF download button');
    assert.ok(html.includes('id="eosDownloadHtml"'), 'Must have EOS HTML download button');
    assert.ok(html.includes('id="eosDownloadExcel"'), 'Must have EOS Excel download button');
    assert.ok(html.includes('id="eosDownloadMsg"'), 'Must have EOS MSG download button');
    assert.ok(html.includes('src="/js/shared/report-msg-export.js'), 'Must load MSG export helper');
    assert.ok(html.includes('id="eosReportSheet"'), 'Must have eosReportSheet ID');
    assert.ok(html.includes('src="/js/shared/html2canvas.min.js'), 'Must load html2canvas');
    assert.ok(html.includes('src="/js/shared/jspdf.umd.min.js'), 'Must load jspdf');
    assert.ok(html.includes('src="/js/shared/exceljs.min.js'), 'Must load exceljs');
});

test('topic-analysis.css contains light default and data-theme="dark" rules', () => {
    const css = fs.readFileSync(path.join(__dirname, '../frontend/css/topic-analysis.css'), 'utf-8');
    assert.ok(css.includes(':root[data-theme="dark"]'), 'Must support data-theme="dark"');
    assert.ok(!css.includes('@media (prefers-color-scheme:dark)'), 'Must not force dark mode with media query');
    assert.ok(css.includes('.topic-theme-toggle'), 'Must style theme toggle');
    assert.ok(css.includes('.topic-monthly-btn-primary'), 'Must style primary monthly button');
});

test('ExcelJS can construct the 4 required sheets for EOS monthly report', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'NetCare · EOS 进展月报';
    workbook.created = new Date();

    // Sheet 1: 月报
    const s1 = workbook.addWorksheet('EOS收编进展月报');
    s1.addRow(['EOS 产品与版本收编进展月报（2026-03）']);
    s1.mergeCells('A1:L1');
    s1.addRow(['表 1：产品 EOS 收编进展']);
    assert.equal(s1.name, 'EOS收编进展月报');

    // Sheet 2: 多维度统计分析
    const s2 = workbook.addWorksheet('多维度统计分析');
    s2.addRow(['表 1：产品收编 · 分客户与产品线多维分析']);
    s2.addRow(['序号', '客户', '产品线', '产品种类数', '网元总量', '已收编网元', '当前收编率', '待收编网元', '今年计划', '无计划', '计划后收编率']);
    s2.addRow([1, 'TE', '数通', 5, 200, 150, '75.0%', 50, 30, 20, '90.0%']);
    assert.equal(s2.name, '多维度统计分析');

    // Sheet 3: 产品收编详表
    const s3 = workbook.addWorksheet('产品收编详表');
    s3.addRow(['序号', '客户', '产品线', '产品名称', '当前阶段', '网元总量', '已收编网元', '待收编网元', '已退网网元', '今年计划', '无计划', '当前收编率', '计划后收编率']);
    s3.addRow([1, 'TE', '数通', 'NE40E', '待收编', 100, 60, 40, 0, 20, 20, '60.0%', '80.0%']);
    assert.equal(s3.name, '产品收编详表');

    // Sheet 4: 版本收编详表
    const s4 = workbook.addWorksheet('版本收编详表');
    s4.addRow(['序号', '客户', '产品线', '产品名称', '软件版本', '当前阶段', '网元总量', '已收编网元', '待收编网元', '已退网网元', '今年计划', '无计划', '当前收编率', '计划后收编率']);
    s4.addRow([1, 'TE', '数通', 'NE40E', 'V800R012', '待收编', 100, 60, 40, 0, 20, 20, '60.0%', '80.0%']);
    assert.equal(s4.name, '版本收编详表');

    const buffer = await workbook.xlsx.writeBuffer();
    assert.ok(buffer.length > 5000, 'Excel file should be generated with valid size');

    // Verify reading back from buffer
    const readBack = new ExcelJS.Workbook();
    await readBack.xlsx.load(buffer);
    assert.equal(readBack.worksheets.length, 4, 'Must have 4 worksheets');
    assert.equal(readBack.worksheets[0].name, 'EOS收编进展月报');
    assert.equal(readBack.worksheets[1].name, '多维度统计分析');
    assert.equal(readBack.worksheets[2].name, '产品收编详表');
    assert.equal(readBack.worksheets[3].name, '版本收编详表');
});

test('topic-analysis.js provides exportMonthlyPdf and exportMonthlyHtml with full styling', () => {
    const js = fs.readFileSync(path.join(__dirname, '../frontend/js/topic-analysis.js'), 'utf-8');
    assert.match(js, /async function exportMonthlyPdf\(/, 'Must define exportMonthlyPdf');
    assert.match(js, /async function exportMonthlyHtml\(/, 'Must define exportMonthlyHtml');
    assert.match(js, /eosDownloadPdf/, 'Must wire eosDownloadPdf');
    assert.match(js, /eosDownloadHtml/, 'Must wire eosDownloadHtml');
    assert.match(js, /pdf\.save\(/, 'Must save PDF using jsPDF');
    assert.match(js, /埃及代表处EOS退网收编简报_.*\.html/, 'Must name exported HTML appropriately');
    assert.match(js, /埃及代表处EOS退网收编简报_.*\.pdf/, 'Must name exported PDF appropriately');
});

test('topic-analysis supports scoped PNG export for Chinese, English, Combined, and All Three', () => {
    const html = fs.readFileSync(path.join(__dirname, '../frontend/pages/topic-analysis.html'), 'utf-8');
    assert.ok(html.includes('id="eosPngDropdown"'), 'Must have eosPngDropdown container');
    assert.ok(html.includes('id="eosDownloadPng"'), 'Must have eosDownloadPng button');
    assert.ok(html.includes('id="eosPngMenu"'), 'Must have eosPngMenu element');
    assert.ok(html.includes('data-png-scope="cn"'), 'Must have Chinese scope option');
    assert.ok(html.includes('data-png-scope="en"'), 'Must have English scope option');
    assert.ok(html.includes('data-png-scope="both"'), 'Must have Combined scope option');
    assert.ok(html.includes('data-png-scope="all-three"'), 'Must have All-Three scope option');
    assert.ok(html.includes('topic-report-footer-cn'), 'Must tag Chinese footer');
    assert.ok(html.includes('topic-report-footer-en'), 'Must tag English footer');

    const css = fs.readFileSync(path.join(__dirname, '../frontend/css/topic-analysis.css'), 'utf-8');
    assert.ok(css.includes('.topic-dropdown'), 'Must style dropdown');
    assert.ok(css.includes('.topic-dropdown-menu'), 'Must style dropdown menu');
    assert.ok(css.includes('.export-mode-cn'), 'Must define export-mode-cn rules');
    assert.ok(css.includes('.export-mode-en'), 'Must define export-mode-en rules');

    const js = fs.readFileSync(path.join(__dirname, '../frontend/js/topic-analysis.js'), 'utf-8');
    assert.match(js, /function togglePngDropdown\(/, 'Must define togglePngDropdown');
    assert.match(js, /function closePngDropdown\(/, 'Must define closePngDropdown');
    assert.match(js, /async function captureAndDownloadMonthlyPng\(/, 'Must define captureAndDownloadMonthlyPng');
    assert.match(js, /async function exportMonthlyPng\(scope = 'both'\)/, 'Must define exportMonthlyPng with scope');
    assert.match(js, /'_中文版'/, 'Must suffix Chinese PNG filename');
    assert.match(js, /'_英文版'/, 'Must suffix English PNG filename');
    assert.match(js, /'_中英文合一'/, 'Must suffix Combined PNG filename');
    assert.match(js, /'eosPngDropdown'/, 'Must register eosPngDropdown in elements');
    assert.match(js, /'eosPngMenu'/, 'Must register eosPngMenu in elements');
});

