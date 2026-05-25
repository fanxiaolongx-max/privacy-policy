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
const GROUPS_FILE = 'sla_groups.json';

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
// 指标分组配置
// ──────────────────────────────────────────────────────────

// GET /api/sla/groups
router.get('/groups', (req, res) => {
    const groups = readJSON(GROUPS_FILE, []);
    res.json(groups);
});

// PUT /api/sla/groups
router.put('/groups', (req, res) => {
    const groups = req.body;
    if (!Array.isArray(groups)) return res.status(400).json({ error: '必须是数组' });
    writeJSON(GROUPS_FILE, groups);
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

    try {
        // --- 自动清理孤儿预警配置 (Clean up orphaned targets) ---
        const validCustomMetricIds = new Set();
        Object.keys(prefs).forEach(hash => {
            if (prefs[hash] && prefs[hash].customMetrics) {
                let secId = '';
                if (hash.startsWith('sla_prefs_other_')) {
                    secId = hash.replace('sla_prefs_', ''); 
                } else if (hash.startsWith('sla_prefs_rectification')) {
                    secId = 'rectification';
                } else if (hash.startsWith('sla_prefs_risk')) {
                    secId = 'risk';
                } else if (hash.startsWith('sla_prefs_special')) {
                    secId = 'special';
                } else {
                    secId = hash.replace('sla_prefs_', '');
                }
                prefs[hash].customMetrics.forEach(cm => {
                    validCustomMetricIds.add(`${secId}_${cm.id}`);
                });
            }
        });

        let targets = readJSON(TARGETS_FILE, {});
        let targetsChanged = false;
        
        Object.keys(targets).forEach(k => {
            // 前端生成的自定义指标的 target key 特征是包含 "_m_"
            if (k.includes('_m_') && !validCustomMetricIds.has(k)) {
                delete targets[k];
                targetsChanged = true;
            }
        });

        if (targetsChanged) {
            writeJSON(TARGETS_FILE, targets);
        }
    } catch (e) {
        console.error('Failed to clean up orphaned targets:', e);
    }

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

// ──────────────────────────────────────────────────────────
// 全局重命名指标
// ──────────────────────────────────────────────────────────

// POST /api/sla/rename-metric
router.post('/rename-metric', (req, res) => {
    const { oldName, newName, newEn } = req.body;
    if (!oldName || !newName || oldName === newName) {
        return res.status(400).json({ error: '无效的名称' });
    }

    try {
        // 1. targets
        let targets = readJSON(TARGETS_FILE, {});
        let targetsChanged = false;
        Object.keys(targets).forEach(k => {
            if (targets[k].label === oldName) {
                targets[k].label = newName;
                targetsChanged = true;
            }
        });
        if (targetsChanged) writeJSON(TARGETS_FILE, targets);

        // 2. prefs
        let prefs = readJSON(PREFS_FILE, {});
        let prefsChanged = false;
        Object.keys(prefs).forEach(k => {
            if (k.startsWith('sla_prefs_') && prefs[k].customMetrics) {
                prefs[k].customMetrics.forEach(m => {
                    if (m.label === oldName) {
                        m.label = newName;
                        prefsChanged = true;
                    }
                });
            }
        });
        if (prefs.i18nMap && prefs.i18nMap[oldName] !== undefined) {
            prefs.i18nMap[newName] = newEn !== undefined ? newEn : prefs.i18nMap[oldName];
            delete prefs.i18nMap[oldName];
            prefsChanged = true;
        } else if (newEn !== undefined) {
            if (!prefs.i18nMap) prefs.i18nMap = {};
            prefs.i18nMap[newName] = newEn;
            prefsChanged = true;
        }
        if (prefs.manualAdjustItems) {
            prefs.manualAdjustItems.forEach(item => {
                if (item.name === oldName) {
                    item.name = newName;
                    prefsChanged = true;
                }
            });
        }
        if (prefsChanged) writeJSON(PREFS_FILE, prefs);

        // 3. groups
        let groups = readJSON(GROUPS_FILE, []);
        let groupsChanged = false;
        groups.forEach(g => {
            if (g.metrics) {
                const idx = g.metrics.indexOf(oldName);
                if (idx !== -1) {
                    g.metrics[idx] = newName;
                    groupsChanged = true;
                }
            }
        });
        if (groupsChanged) writeJSON(GROUPS_FILE, groups);

        // 4. snapshots
        let snapshots = readJSON(SNAPSHOTS_FILE, []);
        let snapsChanged = false;
        snapshots.forEach(s => {
            if (s.topMetrics) {
                s.topMetrics.forEach(m => {
                    if (m.label === oldName) {
                        m.label = newName;
                        snapsChanged = true;
                    }
                });
            }
        });
        if (snapsChanged) writeJSON(SNAPSHOTS_FILE, snapshots);

        res.json({ success: true });
    } catch (e) {
        console.error('Rename metric failed:', e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
