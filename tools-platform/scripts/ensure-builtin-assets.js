const path = require('path');
const { ensureBuiltinToolAssets } = require('../backend/models/builtin-assets-unpacker');

const projectRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(projectRoot, 'backend', 'builtin-tools');
const targetDir = path.join(projectRoot, 'backend', 'data', 'custom-tools');

async function main() {
    console.log('[assets] 正在检查并准备内置工具媒体资产...');
    const results = await ensureBuiltinToolAssets({ sourceDir, targetDir });
    for (const item of results) {
        if (item.status === 'extracted') {
            console.log(`[assets] ${item.tool}: 已解压 ${item.extractedCount} 个音频文件至 ${item.dir}`);
        } else if (item.status === 'skipped') {
            console.log(`[assets] ${item.tool}: 音频已就绪 (${item.existingCount} 个文件)`);
        } else if (item.status === 'error') {
            console.error(`[assets] ${item.tool}: 解压失败 - ${item.error}`);
            process.exitCode = 1;
        }
    }
}

main().catch(err => {
    console.error('[assets] 检查失败:', err);
    process.exit(1);
});
