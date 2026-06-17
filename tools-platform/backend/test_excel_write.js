const ExcelJS = require('exceljs');
async function run() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('/Volumes/512G/06-工具开发/privacy-policy/每月赛马-分网络.xlsx');
    const sheet = workbook.worksheets[0];
    
    // row 20 target is usually 80%
    const cell = sheet.getRow(20).getCell(10);
    cell.value = "80%";
    
    // another cell with number
    const cell2 = sheet.getRow(20).getCell(11);
    cell2.value = 0.8;
    
    const cell3 = sheet.getRow(20).getCell(12);
    cell3.value = 80;

    await workbook.xlsx.writeFile('test_out.xlsx');
    console.log("Wrote test_out.xlsx");
}
run();
