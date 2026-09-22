const express = require('express');
const repo = require('../models/operation-incentive-snapshots-repository');

const router = express.Router();

function sendError(res, error, fallback = '操作激励快照处理失败') {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error('[operation-incentive-snapshots]', error);
    res.status(status).json({ error: status >= 500 ? fallback : error.message, code: error?.code });
}

// 1. 获取操作激励快照列表
router.get('/', async (req, res) => {
    try {
        const { search, period, startDate, endDate, full } = req.query;
        const includePayload = full === '1' || full === 'true';
        const items = await repo.listSnapshots({ search, period, startDate, endDate, includePayload });
        res.setHeader('X-Data-Source', 'sqlite');
        res.json({ success: true, items, data: items, count: items.length });
    } catch (error) {
        sendError(res, error, '获取操作激励快照列表失败');
    }
});

// 1.1 从所有操作激励快照中提取全量在册操作人员名单（供负向事件等工具提取名册）
router.get('/extract-roster', async (req, res) => {
    try {
        const roster = await repo.extractRoster();
        res.setHeader('X-Data-Source', 'sqlite');
        res.json({ success: true, roster, items: roster, data: roster, count: roster.length });
    } catch (error) {
        sendError(res, error, '从操作激励快照提取人员名单失败');
    }
});

// 2. 获取单个快照完整数据
router.get('/:id', async (req, res) => {
    try {
        const item = await repo.getSnapshot(req.params.id);
        if (!item) return res.status(404).json({ error: '未找到指定操作激励快照', code: 'SNAPSHOT_NOT_FOUND' });
        res.setHeader('X-Data-Source', 'sqlite');
        res.json({ success: true, item, data: item });
    } catch (error) {
        sendError(res, error, '读取指定操作激励快照失败');
    }
});

// 3. 保存或更新快照
router.post('/', async (req, res) => {
    try {
        const { id, title, period, sourceFile, summary, payload } = req.body || {};
        if (!payload) return res.status(400).json({ error: '缺少快照数据 (payload)' });

        const item = await repo.saveSnapshot({ id, title, period, sourceFile, summary, payload });
        res.status(201).json({ success: true, item, data: item });
    } catch (error) {
        sendError(res, error, '保存操作激励快照失败');
    }
});

// 4. 重命名快照
router.put('/:id', async (req, res) => {
    try {
        const { title } = req.body || {};
        if (!title) return res.status(400).json({ error: '缺少快照新标题' });

        const item = await repo.renameSnapshot(req.params.id, title);
        if (!item) return res.status(404).json({ error: '未找到指定操作激励快照' });
        res.json({ success: true, item, data: item });
    } catch (error) {
        sendError(res, error, '重命名操作激励快照失败');
    }
});

// 5. 删除快照
router.delete('/:id', async (req, res) => {
    try {
        const success = await repo.deleteSnapshot(req.params.id);
        if (!success) return res.status(404).json({ error: '未找到指定操作激励快照或删除失败' });
        res.json({ success: true });
    } catch (error) {
        sendError(res, error, '删除操作激励快照失败');
    }
});

module.exports = router;
