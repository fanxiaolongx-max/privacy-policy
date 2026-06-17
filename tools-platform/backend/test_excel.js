const ExcelJS = require('exceljs');
async function run() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('/Volumes/512G/06-工具开发/privacy-policy/每月赛马-分网络.xlsx');
    const sheet = workbook.worksheets[0];
    console.log("Columns J to R map to indices 10 to 18");
    for (let r = 1; r <= 60; r++) {
        let rowStr = `Row ${r}:\t`;
        const row = sheet.getRow(r);
        // let's print A to C to see the metric name, and then J to R
        rowStr += `A:${row.getCell(1).value} | B:${row.getCell(2).value} | C:${row.getCell(3).value} || `;
        for(let c = 10; c <= 18; c++) {
            rowStr += `${row.getCell(c).value}\t`;
        }
        console.log(rowStr);
    }
}
run();
