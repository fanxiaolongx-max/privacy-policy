import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toolRoot = __dirname;
const audioDir = path.join(toolRoot, 'audio');
const bundlePath = path.join(audioDir, 'audio.bundle.zip');

export async function unpackAudioBundle(options = {}) {
    const targetDir = options.targetDir || audioDir;
    const force = Boolean(options.force);

    if (!fs.existsSync(bundlePath)) {
        throw new Error(`Audio bundle not found: ${bundlePath}`);
    }

    const manifestPath = path.join(audioDir, 'manifest.json');
    let expectedCount = 951;
    if (fs.existsSync(manifestPath)) {
        try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            if (manifest.audioFileCount) expectedCount = manifest.audioFileCount;
        } catch (_) {}
    }

    if (!force && fs.existsSync(targetDir)) {
        const existingMp3s = fs.readdirSync(targetDir).filter(f => f.endsWith('.mp3'));
        if (existingMp3s.length >= expectedCount) {
            return {
                unpacked: false,
                skipped: true,
                count: existingMp3s.length,
                targetDir
            };
        }
    }

    fs.mkdirSync(targetDir, { recursive: true });
    const buffer = fs.readFileSync(bundlePath);
    const zip = await JSZip.loadAsync(buffer);

    let extractedCount = 0;
    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue;
        const filename = path.basename(relativePath);
        if (!filename.endsWith('.mp3')) continue;

        const destFile = path.join(targetDir, filename);
        if (!force && fs.existsSync(destFile)) continue;

        const content = await zipEntry.async('nodebuffer');
        fs.writeFileSync(destFile, content);
        extractedCount++;
    }

    return {
        unpacked: true,
        extractedCount,
        targetDir
    };
}

// Allow direct CLI execution
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    console.log('正在解压音频包 audio.bundle.zip...');
    unpackAudioBundle({ force: process.argv.includes('--force') })
        .then(result => {
            if (result.skipped) {
                console.log(`已存在 ${result.count} 个音频文件，无需重复解压。使用 --force 可强制覆盖解压。`);
            } else {
                console.log(`成功解压 ${result.extractedCount} 个音频文件至 ${result.targetDir}`);
            }
        })
        .catch(err => {
            console.error('解压失败:', err);
            process.exit(1);
        });
}
