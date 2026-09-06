import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toolRoot = __dirname;
const audioDir = path.join(toolRoot, 'audio');
const bundlePath = path.join(audioDir, 'audio.bundle.zip');

export async function packAudioBundle() {
    if (!fs.existsSync(audioDir)) {
        throw new Error(`Audio directory not found: ${audioDir}`);
    }

    const files = fs.readdirSync(audioDir)
        .filter(file => file.endsWith('.mp3'))
        .sort();

    if (files.length === 0) {
        throw new Error(`No .mp3 files found in ${audioDir}`);
    }

    console.log(`正在打包 ${files.length} 个音频文件为单一归档压缩包...`);
    const zip = new JSZip();

    for (const filename of files) {
        const filePath = path.join(audioDir, filename);
        const data = fs.readFileSync(filePath);
        zip.file(filename, data, { compression: 'DEFLATE', compressionOptions: { level: 9 } });
    }

    const content = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
    });

    fs.writeFileSync(bundlePath, content);
    const stat = fs.statSync(bundlePath);
    const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
    console.log(`打包完成: ${bundlePath} (${sizeMb} MB, 包含 ${files.length} 个音频)`);
    return { bundlePath, sizeMb, fileCount: files.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    packAudioBundle().catch(err => {
        console.error('打包失败:', err);
        process.exit(1);
    });
}
