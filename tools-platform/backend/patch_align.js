const fs = require('fs');
const file = '/Volumes/512G/06-工具开发/privacy-policy/tools-platform/backend/routes/sla.js';
let content = fs.readFileSync(file, 'utf8');

// Patch 1: In /template-mapping POST
const oldMapping = "            cell.value = finalVal;";
const newMapping = "            cell.value = finalVal;\n            cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };";
if (content.includes(oldMapping)) {
    content = content.replace(oldMapping, newMapping);
}

// Patch 2: In /export-yuxiang POST
// Right after writing mappingToRow, let's force left alignment for column 3
const exportSearch = "const mappingToRow = {};";
const exportReplace = `const mappingToRow = {};
        for(let r = 3; r <= 60; r++) {
            const cell = sheet.getRow(r).getCell(3);
            if (cell.value) {
                const currentAlign = cell.alignment || {};
                cell.alignment = { ...currentAlign, horizontal: 'left' };
            }
        }`;
if (content.includes(exportSearch)) {
    content = content.replace(exportSearch, exportReplace);
}

fs.writeFileSync(file, content);
console.log("Patched alignment");
