const fs = require('fs');
const path = require('path');
const { readJSON, writeJSON, DATA_DIR, ensureDataDir } = require('./store');

const REGISTRY_FILE = 'custom_tools.json';
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

function listTools() {
    const items = readJSON(REGISTRY_FILE, []);
    return Array.isArray(items) ? items : [];
}

function saveRegistry(items) {
    writeJSON(REGISTRY_FILE, items);
}

function getTool(slug) {
    return listTools().find(item => item.slug === slug) || null;
}

function saveToolFile(slug, htmlContent) {
    ensureCustomToolsDir();
    const toolDir = path.join(CUSTOM_TOOLS_DIR, slug);
    fs.mkdirSync(toolDir, { recursive: true });
    fs.writeFileSync(path.join(toolDir, 'index.html'), htmlContent, 'utf-8');
}

function createTool(payload) {
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

    const tools = listTools();
    const existingSlugs = new Set(tools.map(item => item.slug));
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

    saveToolFile(slug, htmlContent);
    tools.push(tool);
    saveRegistry(tools);
    return tool;
}

function deleteTool(slug) {
    const tools = listTools();
    const next = tools.filter(item => item.slug !== slug);
    if (next.length === tools.length) return false;
    saveRegistry(next);
    fs.rmSync(path.join(CUSTOM_TOOLS_DIR, slug), { recursive: true, force: true });
    return true;
}

function getToolFilePath(slug) {
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
