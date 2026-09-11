const express = require('express');
const topicSnapshotsRepo = require('../models/topic-snapshots-repository');

const router = express.Router();

function sendError(res, error, fallback) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error('[topic-snapshots]', error);
    res.status(status).json({ error: status >= 500 ? fallback : error.message, code: error?.code });
}

router.get('/', async (req, res) => {
    try {
        const result = await topicSnapshotsRepo.listSnapshots(req.query);
        res.setHeader('X-Data-Source', 'sqlite');
        res.json(result);
    } catch (error) {
        sendError(res, error, '读取专题快照失败');
    }
});

router.get('/series', async (req, res) => {
    try {
        const items = await topicSnapshotsRepo.getSeries(req.query);
        res.setHeader('X-Data-Source', 'sqlite');
        res.json({ items });
    } catch (error) {
        sendError(res, error, '读取专题趋势失败');
    }
});

router.get('/latest', async (req, res) => {
    try {
        const item = await topicSnapshotsRepo.getLatestSnapshot(req.query.platform);
        res.setHeader('X-Data-Source', 'sqlite');
        if (!item) return res.status(404).json({ error: '暂无专题快照', code: 'TOPIC_SNAPSHOT_NOT_FOUND' });
        res.json({ item });
    } catch (error) {
        sendError(res, error, '读取最新专题快照失败');
    }
});

router.get('/:id', async (req, res) => {
    try {
        const item = await topicSnapshotsRepo.getSnapshot(req.params.id);
        res.setHeader('X-Data-Source', 'sqlite');
        if (!item) return res.status(404).json({ error: '专题快照不存在', code: 'TOPIC_SNAPSHOT_NOT_FOUND' });
        res.json({ item });
    } catch (error) {
        sendError(res, error, '读取专题快照失败');
    }
});

router.post('/', async (req, res) => {
    try {
        const result = await topicSnapshotsRepo.saveSnapshot(req.body?.snapshot, { name: req.body?.name });
        res.setHeader('X-Data-Source', 'sqlite');
        res.status(result.created ? 201 : 200).json({
            message: result.created ? '专题快照已保存到服务器' : '相同专题快照已存在，已更新导入时间',
            ...result
        });
    } catch (error) {
        sendError(res, error, '保存专题快照失败');
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const deleted = await topicSnapshotsRepo.deleteSnapshot(req.params.id);
        if (!deleted) return res.status(404).json({ error: '专题快照不存在', code: 'TOPIC_SNAPSHOT_NOT_FOUND' });
        res.json({ message: '专题快照已删除' });
    } catch (error) {
        sendError(res, error, '删除专题快照失败');
    }
});

module.exports = router;
