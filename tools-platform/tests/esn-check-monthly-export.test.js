const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ExcelJS = require('exceljs');

test('temporary License monthly Excel gives wrapped copy and table cells enough height', async () => {
    const source = fs.readFileSync(path.join(__dirname, '../backend/builtin-tools/esn-check/index.html'), 'utf8');
    const start = source.indexOf('        function reportExcelTextHeight(');
    const end = source.indexOf('        async function downloadExcelWorkbook(', start);
    assert.ok(start >= 0 && end > start);

    const copy = {
        classList: { contains: name => name === 'report-copy' },
        textContent: '简要进展：第一行\n第二行\n第三行',
        innerText: '简要进展：第一行\n第二行\n第三行',
        getBoundingClientRect: () => ({ height: 20 })
    };
    const tableCell = {
        textContent: '临时许可证使用进展与商用转换跟踪说明'.repeat(5),
        querySelector: () => null
    };
    const table = {
        tagName: 'TABLE',
        rows: [{ cells: [tableCell, { ...tableCell, textContent: '其他' }],
            parentElement: { tagName: 'TBODY' }, getBoundingClientRect: () => ({ height: 20 }) }]
    };
    const sheet = { children: [copy, table], querySelectorAll: () => [table] };
    const append = vm.runInNewContext(`(() => { ${source.slice(start, end)} return appendMonthlyWorksheet; })()`, {
        document: { getElementById: () => sheet },
        getComputedStyle: () => ({ fontWeight: '400', fontSize: '12px', color: 'rgb(0, 0, 0)' }),
        reportExcelRichText: block => block.textContent,
        excelReportColor: () => 'FF000000'
    });
    const workbook = new ExcelJS.Workbook();
    const worksheet = append(workbook);
    assert.ok(worksheet.getRow(1).height >= 50, 'Three explicit lines must be visible');
    assert.ok(worksheet.getRow(2).height >= 60, 'Long wrapped table text must be visible');

    const buffer = await workbook.xlsx.writeBuffer();
    const readBack = new ExcelJS.Workbook();
    await readBack.xlsx.load(buffer);
    assert.equal(readBack.worksheets[0].getRow(1).height, worksheet.getRow(1).height);
    assert.equal(readBack.worksheets[0].getRow(2).height, worksheet.getRow(2).height);
});
