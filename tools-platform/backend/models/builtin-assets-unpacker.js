const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

/**
 * 检查并自动解压内置工具中的资源压缩包（如 audio.bundle.zip）
 * @param {Object} options
 * @param {string} [options.sourceDir] 内置工具源码目录（默认为 backend/builtin-tools）
 * @param {string} [options.targetDir] 运行时自定义工具目录（如 backend/data/custom-tools）
 * @param {boolean} [options.force] 是否强制覆盖解压
 */
async function ensureBuiltinToolAssets(options = {}) {
    const defaultSourceDir = path.resolve(__dirname, '../builtin-tools');
    const sourceDir = options.sourceDir ? path.resolve(options.sourceDir) : defaultSourceDir;
    const targetDir = options.targetDir ? path.resolve(options.targetDir) : null;
    const force = Boolean(options.force);

    const results = [];
    const dirsToCheck = [sourceDir];
    if (targetDir && fs.existsSync(targetDir) && targetDir !== sourceDir) {
        dirsToCheck.push(targetDir);
    }

    for (const baseDir of dirsToCheck) {
        if (!fs.existsSync(baseDir) || !fs.statSync(baseDir).isDirectory()) continue;
        const toolEntries = fs.readdirSync(baseDir, { withFileTypes: true });

        for (const entry of toolEntries) {
            if (!entry.isDirectory()) continue;
            const toolDir = path.join(baseDir, entry.name);
            const audioDir = path.join(toolDir, 'audio');
            const bundlePath = path.join(audioDir, 'audio.bundle.zip');

            if (!fs.existsSync(bundlePath)) continue;

            const manifestPath = path.join(audioDir, 'manifest.json');
            let expectedCount = 951;
            if (fs.existsSync(manifestPath)) {
                try {
                    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                    if (manifest.audioFileCount) expectedCount = manifest.audioFileCount;
                } catch (_) {}
            }

            const existingMp3s = fs.existsSync(audioDir)
                ? fs.readdirSync(audioDir).filter(f => f.endsWith('.mp3'))
                : [];

            if (!force && existingMp3s.length >= expectedCount) {
                results.push({
                    tool: entry.name,
                    dir: audioDir,
                    status: 'skipped',
                    existingCount: existingMp3s.length
                });
                continue;
            }

            try {
                const buffer = fs.readFileSync(bundlePath);
                const zip = await JSZip.loadAsync(buffer);
                let extracted = 0;

                for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
                    if (zipEntry.dir) continue;
                    const filename = path.basename(relativePath);
                    if (!filename.endsWith('.mp3')) continue;

                    const destFile = path.join(audioDir, filename);
                    if (!force && fs.existsSync(destFile)) continue;

                    const content = await zipEntry.async('nodebuffer');
                    fs.writeFileSync(destFile, content);
                    extracted++;
                }

                results.push({
                    tool: entry.name,
                    dir: audioDir,
                    status: 'extracted',
                    extractedCount: extracted,
                    totalCount: fs.readdirSync(audioDir).filter(f => f.endsWith('.mp3')).length
                });
            } catch (err) {
                results.push({
                    tool: entry.name,
                    dir: audioDir,
                    status: 'error',
                    error: err.message
                });
            }
        }
    }

    return results;
}

if (require.main === module) {
    console.log('[builtin-assets] 正在检查内置工具媒体资源包...');
    ensureBuiltinToolAssets({ force: process.argv.includes('--force') })
        .then(results => {
            for (const item of results) {
                if (item.status === 'extracted') {
                    console.log(`[builtin-assets] ${item.tool}: 已解压 ${item.extractedCount} 个音频文件至 ${item.dir}`);
                } else if (item.status === 'skipped') {
                    console.log(`[builtin-assets] ${item.tool}: 音频已就绪 (${item.existingCount} 个文件)，跳过解压`);
                } else if (item.status === 'error') {
                    console.error(`[builtin-assets] ${item.tool}: 解压失败 - ${item.error}`);
                }
            }
        })
        .catch(err => {
            console.error('[builtin-assets] 处理失败:', err);
            process.exit(1);
        });
}

module.exports = {
    ensureBuiltinToolAssets
};
