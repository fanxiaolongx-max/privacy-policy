const fs = require('fs');
const logFile = '/Users/dragon/.gemini/antigravity-ide/brain/6cc793fb-58bb-4eb6-93c0-690c14a6d111/.system_generated/logs/transcript.jsonl';
const lines = fs.readFileSync(logFile, 'utf8').split('\n');
for (const line of lines) {
    if (!line) continue;
    try {
        const obj = JSON.parse(line);
        if (obj.content && obj.content.includes('exportYuxiangExcel = async function')) {
            // Find if this is a view_file output
            if (obj.content.includes('The following code has been modified to include a line number before every line')) {
                const codeLines = obj.content.split('\n');
                let result = '';
                let capturing = false;
                for(let c of codeLines) {
                    if (c.includes('exportYuxiangExcel = async function')) capturing = true;
                    if (capturing) {
                        const m = c.match(/^\d+: (.*)$/);
                        if (m) {
                            result += m[1] + '\n';
                        }
                    }
                }
                fs.writeFileSync('clean_export.js', result);
                console.log("Found complete function! Lines:", result.split('\n').length);
                break;
            }
        }
    } catch(e) {}
}
