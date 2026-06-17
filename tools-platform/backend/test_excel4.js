const ExcelJS = require('exceljs');
async function run() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('/Volumes/512G/06-工具开发/privacy-policy/每月赛马-分网络.xlsx');
    const sheet = workbook.worksheets[0];
    for (let r of [37, 54, 55, 56]) {
        let rowStr = `Row ${r}:\t`;
        const row = sheet.getRow(r);
        for(let c = 10; c <= 18; c++) {
            let cell = row.getCell(c);
            let val = cell.value;
            if (val && val.formula) {
                rowStr += `[FORMULA: ${val.formula}]\t`;
            } else {
                rowStr += `${val}\t`;
            }
        }
        console.log(rowStr);
    }
}
run();
