const express = require('express');
const repo = require('../models/monthly-snapshots-repository');

const router = express.Router();

function sendError(res, error, fallback = '操作月报快照失败') {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error('[monthly-snapshots]', error);
    res.status(status).json({ error: status >= 500 ? fallback : error.message, code: error?.code });
}

// 1. 获取快照列表
router.get('/', async (req, res) => {
    try {
        const { toolKey, topicKey, month, full } = req.query;
        const includePayload = full === '1' || full === 'true';
        const items = await repo.listSnapshots({ toolKey, topicKey, month, includePayload });
        res.setHeader('X-Data-Source', 'sqlite');
        res.json({ success: true, items });
    } catch (error) {
        sendError(res, error, '获取月报快照列表失败');
    }
});

// 2. 获取单个快照完整数据
router.get('/:id', async (req, res) => {
    try {
        const item = await repo.getSnapshot(req.params.id);
        if (!item) return res.status(404).json({ error: '未找到指定快照', code: 'SNAPSHOT_NOT_FOUND' });
        res.setHeader('X-Data-Source', 'sqlite');
        res.json({ success: true, item });
    } catch (error) {
        sendError(res, error, '读取指定月报快照失败');
    }
});

// 3. 保存或更新快照
router.post('/', async (req, res) => {
    try {
        const { id, toolKey, topicKey, month, name, summary, payload } = req.body || {};
        if (!toolKey) return res.status(400).json({ error: '缺少工具标识 (toolKey)' });
        if (!payload) return res.status(400).json({ error: '缺少快照数据 (payload)' });

        const item = await repo.saveSnapshot({ id, toolKey, topicKey, month, name, summary, payload });
        res.status(201).json({ success: true, item });
    } catch (error) {
        sendError(res, error, '保存月报快照失败');
    }
});

// 4. 重命名快照
router.put('/:id', async (req, res) => {
    try {
        const { name } = req.body || {};
        if (!name) return res.status(400).json({ error: '缺少快照名称' });

        const item = await repo.renameSnapshot(req.params.id, name);
        if (!item) return res.status(404).json({ error: '未找到指定快照' });
        res.json({ success: true, item });
    } catch (error) {
        sendError(res, error, '重命名月报快照失败');
    }
});

// 5. 删除快照
router.delete('/:id', async (req, res) => {
    try {
        const success = await repo.deleteSnapshot(req.params.id);
        if (!success) return res.status(404).json({ error: '未找到指定快照或删除失败' });
        res.json({ success: true });
    } catch (error) {
        sendError(res, error, '删除月报快照失败');
    }
});

module.exports = router;
