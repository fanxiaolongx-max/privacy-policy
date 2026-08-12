const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const customToolsRepo = require('./custom-tools-repository');
const customToolI18nService = require('./custom-tool-i18n-service');

const INTERNAL_FILES = new Set(['.tool-manifest.json', '.i18n.json']);

function safeDownloadName(value, fallback = 'custom-tool') {
    const cleaned = String(value || '')
        .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100);
    return cleaned || fallback;
}

function collectToolFiles(rootDir, currentDir = rootDir, output = []) {
    const items = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const item of items) {
        if (item.isSymbolicLink()) continue;
        const absolutePath = path.join(currentDir, item.name);
        if (item.isDirectory()) {
            collectToolFiles(rootDir, absolutePath, output);
            continue;
        }
        if (!item.isFile()) continue;
        const relativePath = path.relative(rootDir, absolutePath).split(path.sep).join('/');
        if (!relativePath || INTERNAL_FILES.has(relativePath)) continue;
        output.push([relativePath, fs.readFileSync(absolutePath)]);
    }
    return output.sort((a, b) => a[0].localeCompare(b[0]));
}

async function packageToolFiles(tool, files) {
    const indexEntry = files.find(([relativePath]) => relativePath.toLowerCase() === 'index.html');
    if (!indexEntry) {
        const error = new Error('自定义工具缺少 index.html');
        error.status = 400;
        throw error;
    }

    const standaloneIndex = Buffer.from(customToolI18nService.injectLanguageRuntime(
        indexEntry[1].toString('utf8'),
        tool.slug,
        { inlineRuntime: true, standalone: true }
    ), 'utf8');
    const exportName = safeDownloadName(tool.name || tool.nameEn, tool.slug);
    const contentFiles = files.filter(([relativePath]) => !INTERNAL_FILES.has(relativePath));

    if (contentFiles.length === 1) {
        return {
            type: 'html',
            filename: `${exportName}.html`,
            contentType: 'text/html; charset=utf-8',
            buffer: standaloneIndex,
            fileCount: 1
        };
    }

    const zip = new JSZip();
    contentFiles.forEach(([relativePath, content]) => {
        zip.file(relativePath, relativePath.toLowerCase() === 'index.html' ? standaloneIndex : content);
    });
    const buffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    });
    return {
        type: 'zip',
        filename: `${exportName}.zip`,
        contentType: 'application/zip',
        buffer,
        fileCount: contentFiles.length
    };
}

async function createToolExport(slug) {
    const tool = await customToolsRepo.getTool(slug);
    const rootDir = customToolsRepo.getToolRootDir(slug);
    if (!tool || !rootDir) {
        const error = new Error('自定义工具不存在');
        error.status = 404;
        throw error;
    }
    return packageToolFiles(tool, collectToolFiles(rootDir));
}

module.exports = {
    collectToolFiles,
    packageToolFiles,
    createToolExport,
    safeDownloadName
};
