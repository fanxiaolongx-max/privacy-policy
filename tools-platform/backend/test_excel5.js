const ExcelJS = require('exceljs');
async function run() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('/Volumes/512G/06-工具开发/privacy-policy/每月赛马-分网络.xlsx');
    const sheet = workbook.worksheets[0];
    for (let r = 38; r <= 53; r++) {
        const row = sheet.getRow(r);
        console.log(`Row ${r} type: ${row.getCell(1).value}, English: ${row.getCell(3).value}`);
    }
}
run();
