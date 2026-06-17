const fs = require('fs');
const logFile = '/Users/dragon/.gemini/antigravity-ide/brain/6cc793fb-58bb-4eb6-93c0-690c14a6d111/.system_generated/logs/transcript.jsonl';
const lines = fs.readFileSync(logFile, 'utf8').split('\n');

const allCodeLines = new Map();

for (const line of lines) {
    if (!line) continue;
    try {
        const obj = JSON.parse(line);
        if (obj.type === 'RUN_COMMAND' || obj.type === 'VIEW_FILE' || obj.source === 'SYSTEM') {
            if (obj.content && obj.content.includes('File Path: `file:///Volumes/512G/06-%E5%B7%A5%E5%85%B7%E5%BC%80%E5%8F%91/privacy-policy/tools-platform/frontend/js/report/report.js`')) {
                const parts = obj.content.split('\n');
                for (const p of parts) {
                    const m = p.match(/^(\d+): (.*)$/);
                    if (m) {
                        allCodeLines.set(parseInt(m[1]), m[2]);
                    }
                }
            }
        }
    } catch(e) {}
}

let result = '';
for (let i = 3248; i <= 3445; i++) {
    if (allCodeLines.has(i)) {
        result += allCodeLines.get(i) + '\n';
    } else {
        result += `// MISSING LINE ${i}\n`;
    }
}
fs.writeFileSync('reconstructed_export.js', result);
console.log("Done");
