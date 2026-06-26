const express = require('express');
const router = express.Router();
const repo = require('../models/custom-tools-repository');
const historyRepo = require('../models/upload-history-repository');

router.get('/', async (req, res) => {
    res.json(await repo.listTools());
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
