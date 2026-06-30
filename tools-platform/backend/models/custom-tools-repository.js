const { readKV, writeKV } = require('./kv-store');
const fs = require('fs');
const path = require('path');
const { DATA_DIR, ensureDataDir } = require('./store');

const CUSTOM_TOOLS_DIR = path.join(DATA_DIR, 'custom-tools');

function ensureCustomToolsDir() {
    ensureDataDir();
    fs.mkdirSync(CUSTOM_TOOLS_DIR, { recursive: true });
}

function normalizeSlug(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
}

function createSlug(name, existingSlugs = new Set()) {
    const base = normalizeSlug(name) || `tool-${Date.now().toString(36)}`;
    let slug = base;
    let index = 2;
    while (existingSlugs.has(slug)) {
        slug = `${base}-${index++}`;
    }
    return slug;
}

function listToolDirs() {
    ensureCustomToolsDir();
    return fs.readdirSync(CUSTOM_TOOLS_DIR, { withFileTypes: true })
        .filter(item => item.isDirectory())
        .map(item => item.name);
}

async function listTools() {
    const items = await readKV('sys', 'custom_tools', []);
    return Array.isArray(items) ? items : [];
}

async function saveRegistry(items) {
    await writeKV('sys', 'custom_tools', items);
}

async function getTool(slug) {
    return (await listTools()).find(item => item.slug === slug) || null;
}

function saveToolFile(slug, htmlContent) {
    ensureCustomToolsDir();
    const toolDir = path.join(CUSTOM_TOOLS_DIR, slug);
    fs.mkdirSync(toolDir, { recursive: true });
    const targetPath = path.join(toolDir, 'index.html');
    const tempPath = path.join(toolDir, `index.${Date.now().toString(36)}.tmp`);
    fs.writeFileSync(tempPath, htmlContent, 'utf-8');
    fs.renameSync(tempPath, targetPath);
    return targetPath;
}

function removeToolDir(slug) {
    fs.rmSync(path.join(CUSTOM_TOOLS_DIR, slug), { recursive: true, force: true });
}

async function verifyCreatedTool(tool, expectedHtmlContent) {
    const latestTools = await listTools();
    const registered = latestTools.find(item => item.slug === tool.slug);
    if (!registered) throw new Error('自定义工具注册表写入后校验失败');

    const filePath = path.join(CUSTOM_TOOLS_DIR, tool.slug, 'index.html');
    if (!fs.existsSync(filePath)) throw new Error('自定义工具 HTML 文件写入后校验失败');

    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size <= 0) throw new Error('自定义工具 HTML 文件为空');

    if (Buffer.byteLength(expectedHtmlContent, 'utf8') !== stat.size) {
        const savedContent = fs.readFileSync(filePath, 'utf-8');
        if (savedContent !== expectedHtmlContent) {
            throw new Error('自定义工具 HTML 文件内容校验失败');
        }
    }

    return registered;
}

async function createTool(payload) {
    const name = String(payload.name || '').trim();
    const htmlContent = String(payload.htmlContent || '');
    if (!name) {
        const err = new Error('工具名称不能为空');
        err.status = 400;
        throw err;
    }
    if (!htmlContent || !/<html[\s>]/i.test(htmlContent)) {
        const err = new Error('请上传完整的 HTML 文件内容');
        err.status = 400;
        throw err;
    }

    const tools = await listTools();
    const existingSlugs = new Set([
        ...tools.map(item => item.slug),
        ...listToolDirs()
    ]);
    const slug = createSlug(payload.slug || name, existingSlugs);
    const now = new Date().toISOString();
    const tool = {
        slug,
        name,
        icon: String(payload.icon || '🧩').trim().slice(0, 8) || '🧩',
        description: String(payload.description || '').trim(),
        tags: Array.isArray(payload.tags) ? payload.tags.map(String).filter(Boolean).slice(0, 8) : [],
        href: `/tools/${slug}`,
        filePath: `/custom-tools/${slug}/index.html`,
        createdAt: now,
        updatedAt: now
    };

    const previousTools = tools.slice();
    try {
        saveToolFile(slug, htmlContent);
        tools.push(tool);
        await saveRegistry(tools);
        await verifyCreatedTool(tool, htmlContent);
        return tool;
    } catch (err) {
        removeToolDir(slug);
        try {
            await saveRegistry(previousTools);
        } catch (rollbackErr) {
            console.error('[custom-tools] registry rollback failed:', rollbackErr.message);
        }
        throw err;
    }
}

async function deleteTool(slug) {
    const tools = await listTools();
    const next = tools.filter(item => item.slug !== slug);
    if (next.length === tools.length) return false;
    await saveRegistry(next);
    removeToolDir(slug);
    return true;
}

async function getToolFilePath(slug) {
    const safeSlug = normalizeSlug(slug);
    if (!safeSlug || safeSlug !== slug) return null;
    return path.join(CUSTOM_TOOLS_DIR, safeSlug, 'index.html');
}

module.exports = {
    listTools,
    getTool,
    createTool,
    deleteTool,
    getToolFilePath,
    CUSTOM_TOOLS_DIR
};
