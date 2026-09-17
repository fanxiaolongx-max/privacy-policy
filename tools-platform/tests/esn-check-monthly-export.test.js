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
        rows: [{ cells: [{ ...tableCell, classList: { contains: name => name === 'report-metric-critical' } }, { ...tableCell, textContent: '其他' }],
            parentElement: { tagName: 'TBODY' }, getBoundingClientRect: () => ({ height: 20 }) }]
    };
    const brand = {
        classList: { contains: name => name === 'report-copy' || name === 'report-title' || name === 'report-footer-brand' },
        textContent: '埃及网络保障与运维服务部',
        innerText: '埃及网络保障与运维服务部',
        getBoundingClientRect: () => ({ height: 40 })
    };
    const documentUrl = 'https://w3.huawei.com/info/cn/doc/viewDoc.do?did=19787023&cata=333961';
    const guidanceLink = {
        classList: { contains: name => name === 'report-copy' || name === 'report-guidance-link' },
        textContent: documentUrl,
        innerText: documentUrl,
        querySelector: () => ({ textContent: documentUrl, href: documentUrl }),
        getBoundingClientRect: () => ({ height: 25 })
    };
    const sheet = { children: [copy, table, guidanceLink, brand], querySelectorAll: () => [table] };
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
    assert.equal(worksheet.getRow(2).getCell(1).font.color.argb, 'FFA61B1B', 'Highlighted counts stay red in Excel');
    assert.equal(worksheet.getRow(3).getCell(1).value.hyperlink, documentUrl, 'Management rule URL remains clickable in Excel');
    assert.equal(worksheet.getRow(4).getCell(1).alignment.horizontal, 'center');
    assert.equal(worksheet.getRow(4).getCell(1).fill.fgColor.argb, 'FFDCEEF4', 'Closing banner matches report title');

    assert.match(source, /紧急恢复场景 License/);
    assert.match(source, /License 管理规定&指导/);
    assert.ok(source.indexOf("addReportTable(host, '（表 2）', highRiskRows") < source.indexOf("addReportTable(host, '（表 3）', rows, 'report-line'"), 'Core risk precedes product lines');
    assert.match(source, /总体目标：无 License 违规使用/);
    assert.match(source, /viewDoc\.do\?did=19787023&cata=333961/);
    assert.match(source, /BP0002976353\/3\?treeId=a709931a-5415-4346-94f2-4756538100d3&flowAdapt=true&orgCode=1001/);

    const buffer = await workbook.xlsx.writeBuffer();
    const readBack = new ExcelJS.Workbook();
    await readBack.xlsx.load(buffer);
    assert.equal(readBack.worksheets[0].getRow(1).height, worksheet.getRow(1).height);
    assert.equal(readBack.worksheets[0].getRow(2).height, worksheet.getRow(2).height);
});
