/**
 * UIVF12 Catcher 路由
 * 管理脚本仓库（分类 + 脚本）的 CRUD，持久化存储在服务端
 */
const express = require('express');
const router = express.Router();
const { readJSON, writeJSON } = require('../models/store');
const { v4: uuidv4 } = require('uuid');

const SCRIPTS_FILE = 'uiv_scripts.json';
const CATS_FILE = 'uiv_categories.json';

const DEFAULT_CATEGORIES = ['DataFab', 'NetCare中国', 'NetCare中东', 'NetCare德国', '默认分类'];

// ──────────────────────────────────────────────────────────
// 脚本列表相关
// ──────────────────────────────────────────────────────────

// GET /api/uiv/scripts  → 返回全部脚本 + 分类
router.get('/scripts', (req, res) => {
    const scripts = readJSON(SCRIPTS_FILE, []);
    const userCats = readJSON(CATS_FILE, []);
    const categories = [...new Set([...DEFAULT_CATEGORIES, ...userCats])];
    res.json({ scripts, categories });
});

// POST /api/uiv/scripts  → 新增或覆盖脚本（支持阵列批量）
router.post('/scripts', (req, res) => {
    const { items } = req.body; // items: Array<ScriptObject>
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: '参数错误：items 必须为非空数组' });
    }

    let scripts = readJSON(SCRIPTS_FILE, []);

    items.forEach(item => {
        if (!item.id) item.id = 'script_' + uuidv4().replace(/-/g, '').substr(0, 9);
        const idx = scripts.findIndex(s => s.name === item.name);
        if (idx >= 0) {
            scripts[idx] = { ...scripts[idx], ...item };
        } else {
            scripts.push(item);
        }
    });

    writeJSON(SCRIPTS_FILE, scripts);
    res.json({ success: true, count: scripts.length });
});

// DELETE /api/uiv/scripts/:id  → 删除指定脚本
router.delete('/scripts/:id', (req, res) => {
    let scripts = readJSON(SCRIPTS_FILE, []);
    scripts = scripts.filter(s => s.id !== req.params.id);
    writeJSON(SCRIPTS_FILE, scripts);
    res.json({ success: true });
});

// PATCH /api/uiv/scripts/:id/category  → 移动脚本到新分类（拖拽）
router.patch('/scripts/:id/category', (req, res) => {
    const { category } = req.body;
    let scripts = readJSON(SCRIPTS_FILE, []);
    const script = scripts.find(s => s.id === req.params.id);
    if (!script) return res.status(404).json({ error: '脚本不存在' });
    script.category = category;
    writeJSON(SCRIPTS_FILE, scripts);
    res.json({ success: true });
});

// ──────────────────────────────────────────────────────────
// 分类管理
// ──────────────────────────────────────────────────────────

// POST /api/uiv/categories  → 新建自定义分类
router.post('/categories', (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: '分类名不能为空' });
    let cats = readJSON(CATS_FILE, []);
    if (!DEFAULT_CATEGORIES.includes(name) && !cats.includes(name)) {
        cats.push(name.trim());
        writeJSON(CATS_FILE, cats);
    }
    res.json({ success: true, categories: cats });
});

// DELETE /api/uiv/categories/:name  → 删除分类（同时清理该分类的脚本）
router.delete('/categories/:name', (req, res) => {
    const catName = decodeURIComponent(req.params.name);
    let cats = readJSON(CATS_FILE, []);
    cats = cats.filter(c => c !== catName);
    writeJSON(CATS_FILE, cats);

    let scripts = readJSON(SCRIPTS_FILE, []);
    scripts = scripts.filter(s => s.category !== catName);
    writeJSON(SCRIPTS_FILE, scripts);

    res.json({ success: true });
});

// ──────────────────────────────────────────────────────────
// 导入 / 导出备份
// ──────────────────────────────────────────────────────────

// GET /api/uiv/backup  → 导出全量备份 JSON
router.get('/backup', (req, res) => {
    const scripts = readJSON(SCRIPTS_FILE, []);
    const categories = readJSON(CATS_FILE, []);
    res.json({ scripts, categories, exportDate: new Date().toISOString() });
});

// POST /api/uiv/backup  → 导入备份（覆盖 or 融合）
router.post('/backup', (req, res) => {
    const { scripts, categories, merge } = req.body;
    if (!Array.isArray(scripts)) return res.status(400).json({ error: '无效备份格式' });

    if (merge) {
        let existingScripts = readJSON(SCRIPTS_FILE, []);
        let existingCats = readJSON(CATS_FILE, []);
        scripts.forEach(s => {
            const idx = existingScripts.findIndex(ex => ex.name === s.name);
            if (idx >= 0) existingScripts[idx] = s;
            else {
                if (existingScripts.some(ex => ex.id === s.id)) s.id = 'script_' + uuidv4().replace(/-/g, '').substr(0, 9);
                existingScripts.push(s);
            }
        });
        if (categories) {
            categories.forEach(c => {
                if (!DEFAULT_CATEGORIES.includes(c) && !existingCats.includes(c)) existingCats.push(c);
            });
        }
        writeJSON(SCRIPTS_FILE, existingScripts);
        writeJSON(CATS_FILE, existingCats);
    } else {
        writeJSON(SCRIPTS_FILE, scripts);
        if (categories) writeJSON(CATS_FILE, categories.filter(c => !DEFAULT_CATEGORIES.includes(c)));
    }
    res.json({ success: true });
});

module.exports = router;
