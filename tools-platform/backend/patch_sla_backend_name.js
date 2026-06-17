const fs = require('fs');
const file = '/Volumes/512G/06-工具开发/privacy-policy/tools-platform/backend/routes/sla.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("const aName = a.name; // frontend must send name!", "const aName = a.label; // using a.label from frontend");

fs.writeFileSync(file, content);
console.log("Patched sla.js name");
