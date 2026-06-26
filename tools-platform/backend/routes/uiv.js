/**
 * UIVF12 Catcher 路由
 * 管理脚本仓库（分类 + 脚本）的 CRUD，持久化存储在服务端
 */
const express = require('express');
const router = express.Router();
const zlib = require('zlib');
const categoriesRepo = require('../models/uiv-categories-repository');
const scriptsRepo = require('../models/uiv-scripts-repository');

const DEFAULT_CATEGORIES = categoriesRepo.DEFAULT_CATEGORIES;

function decodeCompressedTextField(field, label) {
    if (!field || typeof field !== 'object') {
        throw new Error(`${label} 压缩字段格式无效`);
    }

    const encoding = String(field.encoding || '').toLowerCase();
    const raw = Buffer.from(String(field.data || ''), 'base64');
    if (raw.length === 0 && field.data) {
        throw new Error(`${label} 压缩数据为空`);
    }

    let out;
    if (encoding === 'gzip+base64') {
        out = zlib.gunzipSync(raw);
    } else if (encoding === 'deflate+base64') {
        out = zlib.inflateSync(raw);
    } else {
        throw new Error(`${label} 压缩编码不支持: ${field.encoding || 'unknown'}`);
    }

    return out.toString('utf8');
}

function expandCompressedScriptItems(body) {
    const transportCompression = body && body.transport && body.transport.compression;
    if (!transportCompression) {
        return Array.isArray(body && body.items) ? body.items : [];
    }

    const items = Array.isArray(body && body.items) ? body.items : [];
    return items.map((item, index) => {
        const expanded = { ...item };
        const compressedFields = item && item.compressedFields;
        if (!compressedFields || typeof compressedFields !== 'object') {
            throw new Error(`第 ${index + 1} 条脚本缺少 compressedFields`);
        }

        expanded.code = decodeCompressedTextField(compressedFields.code, `第 ${index + 1} 条脚本 code`);
        expanded.consoleCode = decodeCompressedTextField(compressedFields.consoleCode, `第 ${index + 1} 条脚本 consoleCode`);
        expanded.payload = decodeCompressedTextField(compressedFields.payload, `第 ${index + 1} 条脚本 payload`);
        delete expanded.compressedFields;
        return expanded;
    });
}

// ──────────────────────────────────────────────────────────
// 脚本列表相关
// ──────────────────────────────────────────────────────────

// GET /api/uiv/scripts  → 返回全部脚本 + 分类
router.get('/scripts', async (req, res) => {
    try {
        const { items: scripts, source: scriptSource } = await scriptsRepo.listScripts({
            mode: req.query.scriptsMode || req.query.mode || 'auto'
        });
        const { items: categories, source: categorySource } = await categoriesRepo.listCategories({
            mode: req.query.categoriesMode || req.query.mode || 'auto'
        });
        res.setHeader('X-Data-Source', scriptSource);
        res.setHeader('X-Data-Source-Categories', categorySource);
        console.log(`[DATA SOURCE] GET /api/uiv/scripts -> SCRIPTS:${scriptSource.toUpperCase()} CATEGORIES:${categorySource.toUpperCase()}`);
        res.json({ scripts, categories });
    } catch (err) {
        console.error('[GET /api/uiv/scripts] failed:', err);
        res.status(500).json({ error: '加载脚本仓库失败' });
    }
});

// POST /api/uiv/scripts  → 新增或覆盖脚本（支持阵列批量）
router.post('/scripts', async (req, res) => {
    let items;
    try {
        items = expandCompressedScriptItems(req.body);
    } catch (decodeErr) {
        console.error('[POST /api/uiv/scripts] compressed payload decode failed:', decodeErr);
        return res.status(400).json({ error: decodeErr.message || '压缩脚本解码失败' });
    }

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: '参数错误：items 必须为非空数组' });
    }

    try {
        if (req.body && req.body.transport && req.body.transport.compression) {
            console.log(`[UIV COMPRESS] POST /api/uiv/scripts -> transport=${req.body.transport.compression}, items=${items.length}`);
        }
        const scripts = await scriptsRepo.saveScripts(items);
        res.json({ success: true, count: scripts.length });
    } catch (err) {
        console.error('[POST /api/uiv/scripts] failed:', err);
        res.status(500).json({ error: '保存脚本失败' });
    }
});

// DELETE /api/uiv/scripts/:id  → 删除指定脚本
router.delete('/scripts/:id', async (req, res) => {
    try {
        await scriptsRepo.deleteScriptById(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error('[DELETE /api/uiv/scripts/:id] failed:', err);
        res.status(500).json({ error: '删除脚本失败' });
    }
});

// PATCH /api/uiv/scripts/:id/category  → 移动脚本到新分类（拖拽）
router.patch('/scripts/:id/category', async (req, res) => {
    const { category } = req.body;
    try {
        const script = await scriptsRepo.moveScriptCategory(req.params.id, category);
        if (!script) return res.status(404).json({ error: '脚本不存在' });
        res.json({ success: true });
    } catch (err) {
        console.error('[PATCH /api/uiv/scripts/:id/category] failed:', err);
        res.status(500).json({ error: '移动分类失败' });
    }
});

// ──────────────────────────────────────────────────────────
// 分类管理
// ──────────────────────────────────────────────────────────

// POST /api/uiv/categories  → 新建自定义分类
router.post('/categories', async (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: '分类名不能为空' });
    try {
        const cats = await categoriesRepo.addCategory(name);
        res.json({ success: true, categories: cats });
    } catch (err) {
        console.error('[POST /api/uiv/categories] failed:', err);
        res.status(500).json({ error: '创建分类失败' });
    }
});

// DELETE /api/uiv/categories/:name  → 删除分类（同时清理该分类的脚本）
router.delete('/categories/:name', async (req, res) => {
    const catName = decodeURIComponent(req.params.name);
    try {
        await categoriesRepo.deleteCategory(catName);
        await scriptsRepo.deleteScriptsByCategory(catName);
        res.json({ success: true });
    } catch (err) {
        console.error('[DELETE /api/uiv/categories/:name] failed:', err);
        res.status(500).json({ error: '删除分类失败' });
    }
});

// ──────────────────────────────────────────────────────────
// 导入 / 导出备份
// ──────────────────────────────────────────────────────────

// GET /api/uiv/backup  → 导出全量备份 JSON
router.get('/backup', async (req, res) => {
    try {
        const { items: scripts, source: scriptSource } = await scriptsRepo.listScripts({
            mode: req.query.scriptsMode || req.query.mode || 'auto'
        });
        const { items: allCategories, source: categorySource } = await categoriesRepo.listCategories({
            mode: req.query.categoriesMode || req.query.mode || 'auto'
        });
        const categories = allCategories.filter(c => !DEFAULT_CATEGORIES.includes(c));
        res.setHeader('X-Data-Source', scriptSource);
        res.setHeader('X-Data-Source-Categories', categorySource);
        console.log(`[DATA SOURCE] GET /api/uiv/backup -> SCRIPTS:${scriptSource.toUpperCase()} CATEGORIES:${categorySource.toUpperCase()}`);
        res.json({ scripts, categories, exportDate: new Date().toISOString() });
    } catch (err) {
        console.error('[GET /api/uiv/backup] failed:', err);
        res.status(500).json({ error: '导出备份失败' });
    }
});

// POST /api/uiv/backup  → 导入备份（覆盖 or 融合）
router.post('/backup', async (req, res) => {
    const { scripts, categories, merge } = req.body;
    if (!Array.isArray(scripts)) return res.status(400).json({ error: '无效备份格式' });

    try {
        if (merge) {
            let existingScripts = (await scriptsRepo.listScripts({ mode: 'auto' })).items;
            let existingCats = (await categoriesRepo.listCategories({ mode: 'auto' })).items
                .filter(c => !DEFAULT_CATEGORIES.includes(c));
            scripts.forEach(s => {
                const idx = existingScripts.findIndex(ex => ex.name === s.name);
                if (idx >= 0) existingScripts[idx] = s;
                else {
                    existingScripts.push(s);
                }
            });
            if (categories) {
                categories.forEach(c => {
                    if (!DEFAULT_CATEGORIES.includes(c) && !existingCats.includes(c)) existingCats.push(c);
                });
            }
            await scriptsRepo.replaceAllScripts(existingScripts);
            await categoriesRepo.replaceCategories(existingCats);
        } else {
            await scriptsRepo.replaceAllScripts(scripts);
            if (categories) await categoriesRepo.replaceCategories(categories.filter(c => !DEFAULT_CATEGORIES.includes(c)));
        }
        res.json({ success: true });
    } catch (err) {
        console.error('[POST /api/uiv/backup] failed:', err);
        res.status(500).json({ error: '导入备份失败' });
    }
});

module.exports = router;
