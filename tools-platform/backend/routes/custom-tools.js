const express = require('express');
const router = express.Router();
const repo = require('../models/custom-tools-repository');
const historyRepo = require('../models/upload-history-repository');

router.get('/', async (req, res) => {
    res.json(await repo.listTools());
});

router.get('/:slug/state', async (req, res) => {
    const state = await repo.getToolState(req.params.slug);
    if (!state) return res.status(404).json({ error: '自定义工具不存在' });
    res.json(state);
});

router.put('/:slug/state', async (req, res) => {
    try {
        const state = await repo.saveToolState(req.params.slug, req.body && req.body.data, {
            reason: req.body && req.body.reason,
            createSnapshot: req.body && req.body.createSnapshot !== false
        });
        if (!state) return res.status(404).json({ error: '自定义工具不存在' });
        res.json({ success: true, updatedAt: state.updatedAt, snapshots: state.snapshots.map(({ data, ...item }) => item) });
    } catch (err) {
        res.status(400).json({ error: err.message || '保存日程失败' });
    }
});

router.get('/:slug/snapshots', async (req, res) => {
    const state = await repo.getToolState(req.params.slug);
    if (!state) return res.status(404).json({ error: '自定义工具不存在' });
    res.json((state.snapshots || []).map(({ data, ...item }) => item));
});

router.post('/:slug/state/restore', async (req, res) => {
    const restored = await repo.restoreToolState(req.params.slug, req.body && req.body.snapshotId);
    if (restored === null) return res.status(404).json({ error: '自定义工具不存在' });
    if (restored === false) return res.status(404).json({ error: '备份快照不存在' });
    res.json({ success: true, data: restored.data, updatedAt: restored.updatedAt });
});

router.post('/', async (req, res) => {
    try {
        const tool = await repo.createTool(req.body || {});
        historyRepo.addHistory({
            tool: 'custom',
            action: '导入自定义工具',
            detail: `${tool.name} (${tool.slug})`
        }).catch(err => console.error('[custom-tools] log import history failed:', err.message));
        res.json({ success: true, tool });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message || '保存自定义工具失败' });
    }
});

router.patch('/:slug/access', async (req, res) => {
    try {
        const tool = await repo.updateToolAccess(req.params.slug, req.body && req.body.publicAccess);
        if (!tool) return res.status(404).json({ error: '自定义工具不存在' });
        res.json({ success: true, tool });
    } catch (err) {
        res.status(500).json({ error: err.message || '保存自定义工具访问权限失败' });
    }
});

router.delete('/:slug', async (req, res) => {
    try {
        const tool = await repo.getTool(req.params.slug);
        const deleted = await repo.deleteTool(req.params.slug);
        if (!deleted) return res.status(404).json({ error: '自定义工具不存在' });
        historyRepo.addHistory({
            tool: 'custom',
            action: '删除自定义工具',
            detail: tool ? `${tool.name} (${tool.slug})` : req.params.slug
        }).catch(err => console.error('[custom-tools] log delete history failed:', err.message));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message || '删除自定义工具失败' });
    }
});

module.exports = router;
