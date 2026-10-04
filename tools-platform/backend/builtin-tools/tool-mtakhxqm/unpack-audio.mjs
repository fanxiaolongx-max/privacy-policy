import fs from 'fs';
import path from 'path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toolRoot = __dirname;
const audioDir = path.join(toolRoot, 'audio');
const checksum = buffer => createHash('sha256').update(buffer).digest('hex');

function referencedFiles(value, result = new Set()) {
    if (typeof value === 'string' && /^audio\/[^/]+\.mp3$/.test(value)) result.add(path.basename(value));
    else if (value && typeof value === 'object') for (const child of Object.values(value)) referencedFiles(child, result);
    return result;
}

export async function unpackAudioBundle(options = {}) {
    const sourceDir = options.sourceDir || audioDir;
    const targetDir = options.targetDir || sourceDir;
    const bundlePath = path.join(sourceDir, 'audio.bundle.zip');
    const force = Boolean(options.force);

    if (!fs.existsSync(bundlePath)) {
        throw new Error(`Audio bundle not found: ${bundlePath}`);
    }

    const expected = new Set();
    for (const name of ['manifest.json', 'drill-manifest.json']) {
        const filename = path.join(sourceDir, name);
        if (fs.existsSync(filename)) referencedFiles(JSON.parse(fs.readFileSync(filename, 'utf8')), expected);
    }
    const buffer = fs.readFileSync(bundlePath);
    const zip = await JSZip.loadAsync(buffer, { checkCRC32: true });
    const entries = new Map();
    for (const [relativePath, entry] of Object.entries(zip.files)) {
        if (entry.dir || !relativePath.endsWith('.mp3')) continue;
        const filename = path.basename(relativePath);
        if (filename !== relativePath || entries.has(filename)) throw new Error('Unexpected audio archive entry: ' + relativePath);
        entries.set(filename, entry);
    }
    const missing = [...expected].filter(filename => !entries.has(filename));
    if (missing.length) throw new Error('Audio bundle is missing manifest files: ' + missing.join(', '));

    // File count cannot prove that every new manifest entry is present or that
    // existing speech matches the current archive. Compare content explicitly.
    const pending = [];
    for (const [filename, entry] of entries) {
        const content = await entry.async('nodebuffer');
        const destination = path.join(targetDir, filename);
        if (force || !fs.existsSync(destination) || checksum(fs.readFileSync(destination)) !== checksum(content)) {
            pending.push({ destination, content });
        }
    }
    if (!pending.length) return { unpacked: false, skipped: true, count: entries.size, targetDir };
    fs.mkdirSync(targetDir, { recursive: true });
    for (const { destination, content } of pending) {
        const temporary = destination + '.part-' + process.pid;
        fs.writeFileSync(temporary, content);
        fs.renameSync(temporary, destination);
    }
    return {
        unpacked: true,
        extractedCount: pending.length,
        targetDir
    };
}

// Allow direct CLI execution
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    console.log('正在解压音频包 audio.bundle.zip...');
    unpackAudioBundle({ force: process.argv.includes('--force') })
        .then(result => {
            if (result.skipped) {
                console.log(`已验证 ${result.count} 个音频文件，无需重复解压。`);
            } else {
                console.log(`成功解压 ${result.extractedCount} 个音频文件至 ${result.targetDir}`);
            }
        })
        .catch(err => {
            console.error('解压失败:', err);
            process.exit(1);
        });
}
