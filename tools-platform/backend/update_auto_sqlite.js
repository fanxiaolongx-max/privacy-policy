const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, 'models');
const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('-repository.js'));

let changed = 0;

for (const file of files) {
    const fullPath = path.join(modelsDir, file);
    let content = fs.readFileSync(fullPath, 'utf8');

    // We want to find:
    //    if (normalizedMode === 'sqlite' || normalizedMode === 'db') {
    //        return {
    //            items: await listFromDb(...),
    //            source: 'sqlite'
    //        };
    //    }
    //
    // And insert a try block right after it that tries the exact same `await call`.
    
    // regex to match:
    // if (normalizedMode === 'sqlite' || normalizedMode === 'db') {\n        return {\n            items: await XXX,\n            source: 'sqlite'\n        };\n    }
    
    // Handle both items: and value: (for getPrefItem)
    const regex = /([ \t]+)if \(normalizedMode === 'sqlite' \|\| normalizedMode === 'db'\) \{[ \t]*\n[ \t]*return \{[ \t]*\n[ \t]*(items|value): (await [^,]+),[ \t]*\n[ \t]*source: 'sqlite'[ \t]*\n[ \t]*\};[ \t]*\n[ \t]*\}/g;

    let modified = content.replace(regex, (match, indent, keyName, awaitDbCall) => {
        let condition = keyName === 'items' 
            ? `dbRes && (Array.isArray(dbRes) ? dbRes.length > 0 : Object.keys(dbRes).length > 0)`
            : `dbRes !== undefined`;
            
        return `${match}

${indent}// --- AUTO MODE PRIORITY: SQLITE ---
${indent}try {
${indent}    const dbRes = ${awaitDbCall};
${indent}    if (${condition}) {
${indent}        return { ${keyName}: dbRes, source: 'sqlite' };
${indent}    }
${indent}} catch (err) {}`;
    });

    if (modified !== content) {
        fs.writeFileSync(fullPath, modified, 'utf8');
        changed++;
        console.log(`Updated: ${file}`);
    } else {
        console.log(`Unchanged: ${file}`);
    }
}
console.log(`Changed ${changed} files.`);
