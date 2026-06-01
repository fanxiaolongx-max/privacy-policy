/**
 * Task SLA Killer 路由
 * 持久化存储：全局预警目标 + 每张表的用户偏好设置（列宽/显示/排序/指标规则）
 */
const express = require('express');
const router = express.Router();
const zlib = require('zlib');
const { readJSON, writeJSON } = require('../models/store');
const targetsRepo = require('../models/sla-targets-repository');
const prefsRepo = require('../models/sla-prefs-repository');
const categoriesRepo = require('../models/sla-categories-repository');
const groupsRepo = require('../models/sla-groups-repository');
const snapshotsRepo = require('../models/sla-snapshots-repository');

const TARGETS_FILE = 'sla_targets.json';
const PREFS_FILE = 'sla_prefs.json';
const SNAPSHOTS_FILE = 'sla_snapshots.json';

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

function expandCompressedSnapshot(body) {
    const transportCompression = body && body.transport && body.transport.compression;
    if (!transportCompression) return body;

    const snapshotText = decodeCompressedTextField(body.compressedSnapshot, 'SLA 快照');
    const snapshot = JSON.parse(snapshotText);
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
        throw new Error('SLA 快照解压后格式无效');
    }
    return snapshot;
}

// ──────────────────────────────────────────────────────────
// 全局字典配置 (例如：指标分类)
// ──────────────────────────────────────────────────────────

// GET /api/sla/categories
router.get('/categories', async (req, res) => {
    try {
        const { items, source } = await categoriesRepo.listCategories({
            mode: req.query.mode || 'auto'
        });
        res.setHeader('X-Data-Source', source);
        console.log(`[DATA SOURCE] GET /api/sla/categories -> ${source.toUpperCase()}`);
        res.json(items);
    } catch (err) {
        console.error('[GET /api/sla/categories] failed:', err);
        res.status(500).json({ error: '读取分类失败' });
    }
});

// PUT /api/sla/categories
router.put('/categories', async (req, res) => {
    const cats = req.body;
    if (!Array.isArray(cats)) return res.status(400).json({ error: '必须是数组' });
    try {
        await categoriesRepo.replaceCategories(cats);
        res.json({ success: true });
    } catch (err) {
        console.error('[PUT /api/sla/categories] failed:', err);
        res.status(500).json({ error: '保存分类失败' });
    }
});

// ──────────────────────────────────────────────────────────
// 指标分组配置
// ──────────────────────────────────────────────────────────

// GET /api/sla/groups
router.get('/groups', async (req, res) => {
    try {
        const { items, source } = await groupsRepo.listGroups({
            mode: req.query.mode || 'auto'
        });
        res.setHeader('X-Data-Source', source);
        console.log(`[DATA SOURCE] GET /api/sla/groups -> ${source.toUpperCase()}`);
        res.json(items);
    } catch (err) {
        console.error('[GET /api/sla/groups] failed:', err);
        res.status(500).json({ error: '读取分组失败' });
    }
});

// PUT /api/sla/groups
router.put('/groups', async (req, res) => {
    const groups = req.body;
    if (!Array.isArray(groups)) return res.status(400).json({ error: '必须是数组' });
    try {
        await groupsRepo.replaceGroups(groups);
        res.json({ success: true });
    } catch (err) {
        console.error('[PUT /api/sla/groups] failed:', err);
        res.status(500).json({ error: '保存分组失败' });
    }
});

// ──────────────────────────────────────────────────────────
// 全局预警目标
// ──────────────────────────────────────────────────────────

// GET /api/sla/targets
router.get('/targets', async (req, res) => {
    try {
        const { items, source } = await targetsRepo.getTargets({
            mode: req.query.mode || 'auto'
        });
        res.setHeader('X-Data-Source', source);
        console.log(`[DATA SOURCE] GET /api/sla/targets -> ${source.toUpperCase()}`);
        res.json(items);
    } catch (err) {
        console.error('[GET /api/sla/targets] failed:', err);
        res.status(500).json({ error: '读取预警目标失败' });
    }
});

// PUT /api/sla/targets  → 保存全量预警目标
router.put('/targets', async (req, res) => {
    const targets = req.body;
    if (!targets || typeof targets !== 'object' || Array.isArray(targets)) {
        return res.status(400).json({ error: '无效数据格式' });
    }
    try {
        await targetsRepo.replaceTargets(targets);
        res.json({ success: true });
    } catch (err) {
        console.error('[PUT /api/sla/targets] failed:', err);
        res.status(500).json({ error: '保存预警目标失败' });
    }
});

// ──────────────────────────────────────────────────────────
// 历史导入快照
// ──────────────────────────────────────────────────────────

// GET /api/sla/snapshots
router.get('/snapshots', async (req, res) => {
    try {
        const { items, source } = await snapshotsRepo.listSnapshots({
            mode: req.query.mode || 'auto'
        });
        res.setHeader('X-Data-Source', source);
        console.log(`[DATA SOURCE] GET /api/sla/snapshots -> ${source.toUpperCase()}`);
        res.json(items);
    } catch (err) {
        console.error('[GET /api/sla/snapshots] failed:', err);
        res.status(500).json({ error: '读取历史快照失败' });
    }
});

// POST /api/sla/snapshot
router.post('/snapshot', async (req, res) => {
    let snapshot;
    try {
        snapshot = expandCompressedSnapshot(req.body);
    } catch (decodeErr) {
        console.error('[POST /api/sla/snapshot] compressed payload decode failed:', decodeErr);
        return res.status(400).json({ error: decodeErr.message || '压缩快照解码失败' });
    }

    try {
        if (req.body && req.body.transport && req.body.transport.compression) {
            console.log(
                `[SLA COMPRESS] POST /api/sla/snapshot -> transport=${req.body.transport.compression}, ` +
                `original=${req.body.transport.originalBytes || '-'}, compressed=${req.body.transport.compressedBytes || '-'}`
            );
        }
        await snapshotsRepo.addSnapshot(snapshot);
        res.json({ success: true });
    } catch (err) {
        console.error('[POST /api/sla/snapshot] failed:', err);
        res.status(500).json({ error: '保存历史快照失败' });
    }
});

// DELETE /api/sla/snapshots/:id
router.delete('/snapshots/:id', async (req, res) => {
    try {
        await snapshotsRepo.deleteSnapshot(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error('[DELETE /api/sla/snapshots/:id] failed:', err);
        res.status(500).json({ error: '删除历史快照失败' });
    }
});

// PUT /api/sla/snapshots/:id
router.put('/snapshots/:id', async (req, res) => {
    let snapshotPatch;
    try {
        snapshotPatch = expandCompressedSnapshot(req.body);
    } catch (decodeErr) {
        console.error('[PUT /api/sla/snapshots/:id] compressed payload decode failed:', decodeErr);
        return res.status(400).json({ error: decodeErr.message || '压缩快照解码失败' });
    }

    try {
        if (req.body && req.body.transport && req.body.transport.compression) {
            console.log(
                `[SLA COMPRESS] PUT /api/sla/snapshots/${req.params.id} -> transport=${req.body.transport.compression}, ` +
                `original=${req.body.transport.originalBytes || '-'}, compressed=${req.body.transport.compressedBytes || '-'}`
            );
        }
        const updated = await snapshotsRepo.updateSnapshot(req.params.id, snapshotPatch);
        if (!updated) {
            return res.status(404).json({ error: 'Snapshot not found' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('[PUT /api/sla/snapshots/:id] failed:', err);
        res.status(500).json({ error: '更新历史快照失败' });
    }
});

// ──────────────────────────────────────────────────────────
// 表格偏好设置（列宽、显示列、排序、自定义指标规则）
// 使用 schemaHash 作为 key，与原前端逻辑对应
// ──────────────────────────────────────────────────────────

// GET /api/sla/prefs/:schemaHash
router.get('/prefs/:schemaHash', async (req, res) => {
    try {
        const { item, source } = await prefsRepo.getPrefItem(req.params.schemaHash, {
            mode: req.query.mode || 'auto'
        });
        res.setHeader('X-Data-Source', source);
        console.log(`[DATA SOURCE] GET /api/sla/prefs/${req.params.schemaHash} -> ${source.toUpperCase()}`);
        res.json(item);
    } catch (err) {
        console.error('[GET /api/sla/prefs/:schemaHash] failed:', err);
        res.status(500).json({ error: '读取偏好设置失败' });
    }
});

// PUT /api/sla/prefs/:schemaHash
router.put('/prefs/:schemaHash', async (req, res) => {
    const prefs = (await prefsRepo.getPrefsObject({ mode: 'json' })).items;
    prefs[req.params.schemaHash] = req.body;
    await prefsRepo.upsertPrefItem(req.params.schemaHash, req.body);

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
            await targetsRepo.replaceTargets(targets);
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
router.get('/config', async (req, res) => {
    try {
        const { items: targets, source: targetsSource } = await targetsRepo.getTargets({
            mode: req.query.mode || 'auto'
        });
        const { items: prefs, source: prefsSource } = await prefsRepo.getPrefsObject({
            mode: req.query.mode || 'auto'
        });
        res.setHeader('X-Data-Source', prefsSource);
        res.setHeader('X-Data-Source-Targets', targetsSource);
        res.setHeader('X-Data-Source-Prefs', prefsSource);
        console.log(`[DATA SOURCE] GET /api/sla/config -> PREFS ${prefsSource.toUpperCase()}, TARGETS ${targetsSource.toUpperCase()}`);
        res.json({ targets, prefs, exportDate: new Date().toISOString() });
    } catch (err) {
        console.error('[GET /api/sla/config] failed:', err);
        res.status(500).json({ error: '导出配置失败' });
    }
});

// POST /api/sla/config  → 导入配置
router.post('/config', async (req, res) => {
    const { targets, prefs } = req.body;
    console.log(`[POST /config] Received body keys:`, Object.keys(req.body));
    console.log(`[POST /config] targets defined?`, !!targets, `prefs defined?`, !!prefs);
    
    try {
        if (targets) {
            await targetsRepo.replaceTargets(targets);
            console.log(`[POST /config] Wrote targets successfully`);
        }
        if (prefs) {
            await prefsRepo.replacePrefs(prefs);
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
router.post('/rename-metric', async (req, res) => {
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
        if (targetsChanged) await targetsRepo.replaceTargets(targets);

        // 2. prefs
        let prefs = (await prefsRepo.getPrefsObject({ mode: 'json' })).items;
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
        if (prefsChanged) await prefsRepo.replacePrefs(prefs);

        // 3. groups
        let groups = readJSON('sla_groups.json', []);
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
        if (groupsChanged) {
            writeJSON('sla_groups.json', groups);
            groupsRepo.replaceGroups(groups).catch(err => {
                console.error('[sla-groups] sync after rename failed:', err.message);
            });
        }

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
        if (snapsChanged) {
            writeJSON(SNAPSHOTS_FILE, snapshots);
            snapshotsRepo.replaceSnapshots(snapshots).catch(err => {
                console.error('[sla-snapshots] sync after rename failed:', err.message);
            });
        }

        res.json({ success: true });
    } catch (e) {
        console.error('Rename metric failed:', e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
