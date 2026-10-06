const fs = require('node:fs/promises');
const path = require('node:path');
const { generateAndSaveLogo, logoStorage } = require('../backend/models/platform-logo-runtime');

async function main() {
    const args = process.argv.slice(2);
    if (!args.length || args.includes('--help')) {
        console.log('Generate and update platform logo assets\nUsage: npm run logo:generate -- <image.png|image.jpg> [--root <directory>] [--no-remove-bg] [--no-dark-enhance] [--no-crop-bottom]');
        return;
    }
    const rootIndex = args.indexOf('--root');
    if (rootIndex >= 0 && !args[rootIndex + 1]) throw new Error('--root requires a directory');
    const root = rootIndex >= 0 ? path.resolve(args[rootIndex + 1]) : path.resolve(__dirname, '..');
    const files = await generateAndSaveLogo(await fs.readFile(args[0]), {
        storage: logoStorage({ root }),
        removeBg: !args.includes('--no-remove-bg'),
        darkEnhance: !args.includes('--no-dark-enhance'),
        cropBottomText: !args.includes('--no-crop-bottom')
    });
    console.log(`Successfully updated ${files.length} logo/icon assets:\n${files.join('\n')}`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
