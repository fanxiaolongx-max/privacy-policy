const fs = require('fs');
const content = fs.readFileSync('recovered.txt', 'utf8');

const regex = /^\d+:(.*)$/gm;
let result = '';
let match;
while ((match = regex.exec(content)) !== null) {
    result += match[1] + '\n';
}
// Remove the leading space that view_file adds after the colon
result = result.replace(/^ /gm, '');

fs.writeFileSync('clean_export.js', result);
console.log("Saved clean_export.js");
