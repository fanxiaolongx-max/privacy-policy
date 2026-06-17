const fs = require('fs');
const file = '/Volumes/512G/06-工具开发/privacy-policy/tools-platform/backend/routes/sla.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Add GET /template-mapping
const getEndpoint = `
router.get('/template-mapping', async (req, res) => {
    try {
        const ExcelJS = require('exceljs');
        const path = require('path');
        const fs = require('fs');
        const templatePath = path.join(__dirname, '../templates/每月赛马-分网络.xlsx');
        if (!fs.existsSync(templatePath)) return res.json([]);
        
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(templatePath);
        const sheet = workbook.worksheets[0];
        const data = [];
        for(let r = 3; r <= 60; r++) {
            const val = sheet.getRow(r).getCell(3).value || '';
            let text = val;
            let mapping = '';
            if (typeof val === 'string') {
                const match = val.match(/\\[Map:\\s*(.+?)\\]/);
                if (match) {
                    mapping = match[1];
                    text = val.replace(/\\s*\\[Map:\\s*.+?\\]/, '');
                }
            }
            data.push({ r, text: String(text).trim(), mapping, originalVal: val });
        }
        res.json(data);
    } catch(e) {
        res.status(500).send(e.message);
    }
});

router.post('/template-mapping', async (req, res) => {
    try {
        const updates = req.body;
        const ExcelJS = require('exceljs');
        const path = require('path');
        const fs = require('fs');
        const templatePath = path.join(__dirname, '../templates/每月赛马-分网络.xlsx');
        
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(templatePath);
        const sheet = workbook.worksheets[0];
        
        updates.forEach(u => {
            const cell = sheet.getRow(u.r).getCell(3);
            let finalVal = u.text;
            if (u.mapping) {
                finalVal += \` [Map:\${u.mapping}]\`;
            }
            cell.value = finalVal;
        });
        
        await workbook.xlsx.writeFile(templatePath);
        res.json({ success: true });
    } catch(e) {
        res.status(500).send(e.message);
    }
});
`;

if (!content.includes('/template-mapping')) {
    content = content.replace("module.exports = router;", getEndpoint + "\nmodule.exports = router;");
}

// 2. Modify /export-yuxiang
const oldExportStart = "const workbook = new ExcelJS.Workbook();\n        await workbook.xlsx.readFile(templatePath);\n        const sheet = workbook.worksheets[0];";

const newExportStart = `const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(templatePath);
        const sheet = workbook.worksheets[0];

        const mappingToRow = {};
        for(let r = 1; r <= 100; r++) {
            const cellVal = sheet.getRow(r).getCell(3).value;
            if (typeof cellVal === 'string') {
                const match = cellVal.match(/\\[Map:\\s*(.+?)\\]/);
                if (match) {
                    mappingToRow[match[1]] = r;
                }
            }
        }`;

content = content.replace(oldExportStart, newExportStart);

// 3. Replace metrics loop
const oldMetrics = `        if (Array.isArray(metrics)) {
            metrics.forEach((m, idx) => {
                const r = 3 + idx; // 3 to 36
                if (r <= 36) {`;
const newMetrics = `        if (Array.isArray(metrics)) {
            metrics.forEach((m, idx) => {
                const r = mappingToRow[m.label] || (3 + idx); // fallback to sequential if not mapped
                if (r) {`;
content = content.replace(oldMetrics, newMetrics);

// 4. Replace adjustments loop
const oldAdj = `        if (Array.isArray(adjustments)) {
            adjustments.forEach((a, idx) => {
                let r;
                if (idx < 14) r = 38 + idx; // 38 to 51
                else r = 52 + (idx - 14);   // 52 to 53

                if (r <= 53) {`;
const newAdj = `        if (Array.isArray(adjustments)) {
            adjustments.forEach((a, idx) => {
                const aName = a.name; // frontend must send name!
                let fallbackR;
                if (idx < 14) fallbackR = 38 + idx;
                else fallbackR = 52 + (idx - 14);
                
                const r = aName && mappingToRow[aName] ? mappingToRow[aName] : fallbackR;
                if (r) {`;
content = content.replace(oldAdj, newAdj);

// 5. Replace totals
const oldTotals = `        if (totals) {
            fillRow(37, 15, totals.subTotal);
            fillRow(54, 15, totals.adjustTotal);
            fillRow(55, 15, totals.weightInMonth);
            fillRow(56, 15, totals.finalResult);
        }`;
const newTotals = `        if (totals) {
            fillRow(mappingToRow['SYS_SubTotal'] || 37, 15, totals.subTotal);
            fillRow(mappingToRow['SYS_AdjustTotal'] || 54, 15, totals.adjustTotal);
            fillRow(mappingToRow['SYS_WeightInMonth'] || 55, 15, totals.weightInMonth);
            fillRow(mappingToRow['SYS_FinalResult'] || 56, 15, totals.finalResult);
        }`;
content = content.replace(oldTotals, newTotals);

fs.writeFileSync(file, content);
console.log("Patched sla.js backend");
