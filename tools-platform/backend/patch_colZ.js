const fs = require('fs');
const file = '/Volumes/512G/06-工具开发/privacy-policy/tools-platform/backend/routes/sla.js';
let content = fs.readFileSync(file, 'utf8');

// 1. GET /template-mapping
const oldGet = `            let text = val;
            let mapping = '';
            if (typeof val === 'string') {
                const match = val.match(/\\[Map:\\s*(.+?)\\]/);
                if (match) {
                    mapping = match[1];
                    text = val.replace(/\\s*\\[Map:\\s*.+?\\]/, '');
                }
            }`;
const newGet = `            let text = val;
            let mapping = '';
            // clean up legacy Map tag in C column
            if (typeof val === 'string') {
                const matchC = val.match(/\\[Map:\\s*(.+?)\\]/);
                if (matchC) {
                    text = val.replace(/\\s*\\[Map:\\s*.+?\\]/, '');
                }
            }
            // read from Column 26 (Z)
            const zVal = sheet.getRow(r).getCell(26).value;
            if (typeof zVal === 'string') {
                const matchZ = zVal.match(/\\[Map:\\s*(.+?)\\]/);
                if (matchZ) {
                    mapping = matchZ[1];
                }
            } else if (typeof val === 'string' && val.includes('[Map:')) {
                // fallback legacy read
                const matchC = val.match(/\\[Map:\\s*(.+?)\\]/);
                if (matchC) mapping = matchC[1];
            }`;
content = content.replace(oldGet, newGet);

// 2. POST /template-mapping
const oldPost = `            let finalVal = u.text;
            if (u.mapping) {
                finalVal += \` [Map:\${u.mapping}]\`;
            }
            cell.value = finalVal;
            cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };`;
const newPost = `            // Clean up C column text just in case
            let finalVal = u.text;
            if (typeof finalVal === 'string') {
                finalVal = finalVal.replace(/\\s*\\[Map:\\s*.+?\\]/g, '');
            }
            cell.value = finalVal;
            cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
            
            // Write mapping to Column 26 (Z)
            const zCell = sheet.getRow(u.r).getCell(26);
            if (u.mapping) {
                zCell.value = \`[Map:\${u.mapping}]\`;
            } else {
                zCell.value = '';
            }`;
content = content.replace(oldPost, newPost);

// 3. POST /export-yuxiang
const oldExport = `        for(let r = 3; r <= 60; r++) {
            const cell = sheet.getRow(r).getCell(3);
            if (cell.value) {
                const currentAlign = cell.alignment || {};
                cell.alignment = { ...currentAlign, horizontal: 'left' };
            }
            const cellVal = sheet.getRow(r).getCell(3).value;
            if (typeof cellVal === 'string') {
                const match = cellVal.match(/\\[Map:\\s*(.+?)\\]/);
                if (match) {
                    mappingToRow[match[1]] = r;
                }
            }
        }`;
const newExport = `        for(let r = 3; r <= 60; r++) {
            const cell = sheet.getRow(r).getCell(3);
            if (cell.value) {
                const currentAlign = cell.alignment || {};
                cell.alignment = { ...currentAlign, horizontal: 'left' };
                // Also strip legacy tag if it exists when exporting
                if (typeof cell.value === 'string' && cell.value.includes('[Map:')) {
                    cell.value = cell.value.replace(/\\s*\\[Map:\\s*.+?\\]/g, '');
                }
            }
            const zVal = sheet.getRow(r).getCell(26).value;
            if (typeof zVal === 'string') {
                const match = zVal.match(/\\[Map:\\s*(.+?)\\]/);
                if (match) {
                    mappingToRow[match[1]] = r;
                }
            } else if (typeof cell.value === 'string') { // fallback legacy read
                 const matchC = cell.value.match(/\\[Map:\\s*(.+?)\\]/);
                 if (matchC) mappingToRow[matchC[1]] = r;
            }
        }`;
content = content.replace(oldExport, newExport);

fs.writeFileSync(file, content);
console.log("Patched column Z mapping");
