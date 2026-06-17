const ExcelJS = require('exceljs');
const path = require('path');
const templatePath = path.join('/Volumes/512G/06-工具开发/privacy-policy/tools-platform/backend/templates/每月赛马-分网络.xlsx');

async function test() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const sheet = workbook.worksheets[0];
    console.log("RowCount:", sheet.rowCount);
    for(let r = 55; r <= sheet.rowCount; r++) {
        const cVal = sheet.getRow(r).getCell(3).value;
        const zVal = sheet.getRow(r).getCell(26).value;
        if (cVal || zVal) {
            console.log(`Row ${r}: C='${cVal}' Z='${zVal}'`);
        }
    }
}
test();
