/**
 * Task SLA Killer 路由
 * 持久化存储：全局预警目标 + 每张表的用户偏好设置（列宽/显示/排序/指标规则）
 */
const express = require('express');
const router = express.Router();
const { readJSON, writeJSON } = require('../models/store');

const TARGETS_FILE = 'sla_targets.json';
const PREFS_FILE = 'sla_prefs.json';
const SNAPSHOTS_FILE = 'sla_snapshots.json';
const CATEGORIES_FILE = 'sla_categories.json';

// ──────────────────────────────────────────────────────────
// 全局字典配置 (例如：指标分类)
// ──────────────────────────────────────────────────────────

// GET /api/sla/categories
router.get('/categories', (req, res) => {
    const defaultCats = ['TE', 'ORG', 'ET', 'VDF'];
    const cats = readJSON(CATEGORIES_FILE, defaultCats);
    res.json(cats);
});

// PUT /api/sla/categories
router.put('/categories', (req, res) => {
    const cats = req.body;
    if (!Array.isArray(cats)) return res.status(400).json({ error: '必须是数组' });
    writeJSON(CATEGORIES_FILE, cats);
    res.json({ success: true });
});

// ──────────────────────────────────────────────────────────
// 全局预警目标
// ──────────────────────────────────────────────────────────

// GET /api/sla/targets
router.get('/targets', (req, res) => {
    const targets = readJSON(TARGETS_FILE, {});
    res.json(targets);
});

// PUT /api/sla/targets  → 保存全量预警目标
router.put('/targets', (req, res) => {
    const targets = req.body;
    if (typeof targets !== 'object') return res.status(400).json({ error: '无效数据格式' });
    writeJSON(TARGETS_FILE, targets);
    res.json({ success: true });
});

// ──────────────────────────────────────────────────────────
// 历史导入快照
// ──────────────────────────────────────────────────────────

// GET /api/sla/snapshots
router.get('/snapshots', (req, res) => {
    const snapshots = readJSON(SNAPSHOTS_FILE, []);
    res.json(snapshots);
});

// POST /api/sla/snapshot
router.post('/snapshot', (req, res) => {
    let snapshots = readJSON(SNAPSHOTS_FILE, []);
    snapshots.unshift({ id: Date.now().toString(36), ...req.body });
    if (snapshots.length > 50) snapshots = snapshots.slice(0, 50); // 保留最近50次
    writeJSON(SNAPSHOTS_FILE, snapshots);
    res.json({ success: true });
});

// DELETE /api/sla/snapshots/:id
router.delete('/snapshots/:id', (req, res) => {
    let snapshots = readJSON(SNAPSHOTS_FILE, []);
    snapshots = snapshots.filter(s => s.id !== req.params.id);
    writeJSON(SNAPSHOTS_FILE, snapshots);
    res.json({ success: true });
});

// PUT /api/sla/snapshots/:id
router.put('/snapshots/:id', (req, res) => {
    let snapshots = readJSON(SNAPSHOTS_FILE, []);
    const idx = snapshots.findIndex(s => s.id === req.params.id);
    if (idx !== -1) {
        snapshots[idx] = { ...snapshots[idx], ...req.body };
        writeJSON(SNAPSHOTS_FILE, snapshots);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Snapshot not found' });
    }
});

// ──────────────────────────────────────────────────────────
// 表格偏好设置（列宽、显示列、排序、自定义指标规则）
// 使用 schemaHash 作为 key，与原前端逻辑对应
// ──────────────────────────────────────────────────────────

// GET /api/sla/prefs/:schemaHash
router.get('/prefs/:schemaHash', (req, res) => {
    const prefs = readJSON(PREFS_FILE, {});
    const data = prefs[req.params.schemaHash] || null;
    res.json(data);
});

// PUT /api/sla/prefs/:schemaHash
router.put('/prefs/:schemaHash', (req, res) => {
    const prefs = readJSON(PREFS_FILE, {});
    prefs[req.params.schemaHash] = req.body;
    writeJSON(PREFS_FILE, prefs);
    res.json({ success: true });
});

// ──────────────────────────────────────────────────────────
// 全量配置导出 / 导入
// ──────────────────────────────────────────────────────────

// GET /api/sla/config  → 导出全量配置（targets + prefs）
router.get('/config', (req, res) => {
    const targets = readJSON(TARGETS_FILE, {});
    const prefs = readJSON(PREFS_FILE, {});
    res.json({ targets, prefs, exportDate: new Date().toISOString() });
});

// POST /api/sla/config  → 导入配置
router.post('/config', (req, res) => {
    const { targets, prefs } = req.body;
    console.log(`[POST /config] Received body keys:`, Object.keys(req.body));
    console.log(`[POST /config] targets defined?`, !!targets, `prefs defined?`, !!prefs);
    
    try {
        if (targets) {
            writeJSON(TARGETS_FILE, targets);
            console.log(`[POST /config] Wrote targets successfully`);
        }
        if (prefs) {
            writeJSON(PREFS_FILE, prefs);
            console.log(`[POST /config] Wrote prefs successfully, keys count:`, Object.keys(prefs).length);
        }
        res.json({ success: true });
    } catch (e) {
        console.error(`[POST /config] Write failed:`, e);
        res.status(500).json({ error: '保存文件失败: ' + e.message });
    }
});

module.exports = router;
