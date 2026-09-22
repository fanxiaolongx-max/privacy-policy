const express = require('express');
const repo = require('../models/meeting-snapshots-repository');

const router = express.Router();

function sendError(res, error, fallback = '操作会议考勤快照失败') {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error('[meeting-snapshots]', error);
    res.status(status).json({ error: status >= 500 ? fallback : error.message, code: error?.code });
}

// 1. 获取会议快照列表
router.get('/', async (req, res) => {
    try {
        const { search, startDate, endDate, full } = req.query;
        const includePayload = full === '1' || full === 'true';
        const items = await repo.listSnapshots({ search, startDate, endDate, includePayload });
        res.setHeader('X-Data-Source', 'sqlite');
        res.json({ success: true, items, data: items, count: items.length });
    } catch (error) {
        sendError(res, error, '获取会议考勤快照列表失败');
    }
});

// 1.1 校验单人会议考勤记录（缺席/迟到/全勤）
router.get('/attendance-check', async (req, res) => {
    try {
        const { staffId, name, account } = req.query;
        const result = await repo.checkPersonAttendance({ staffId: staffId || account, name });
        res.setHeader('X-Data-Source', 'sqlite');
        res.json({ success: true, ...result, data: result });
    } catch (error) {
        sendError(res, error, '核验人员会议考勤记录失败');
    }
});

// 1.2 批量校验多人会议考勤记录（供操作激励等工具百人级高速排查）
router.post('/batch-attendance-check', async (req, res) => {
    try {
        const { persons } = req.body || {};
        const result = await repo.batchCheckAttendance(persons || []);
        res.setHeader('X-Data-Source', 'sqlite');
        res.json({ success: true, results: result, data: result });
    } catch (error) {
        sendError(res, error, '批量核验会议考勤记录失败');
    }
});

// 1.3 从所有会议快照中提取全量在册参会人员名单（供负向事件等工具提取名册）
router.get('/extract-roster', async (req, res) => {
    try {
        const roster = await repo.extractRoster();
        res.setHeader('X-Data-Source', 'sqlite');
        res.json({ success: true, roster, items: roster, data: roster, count: roster.length });
    } catch (error) {
        sendError(res, error, '从会议考勤快照提取人员名单失败');
    }
});

// 2. 获取单个快照完整数据
router.get('/:id', async (req, res) => {
    try {
        const item = await repo.getSnapshot(req.params.id);
        if (!item) return res.status(404).json({ error: '未找到指定会议快照', code: 'SNAPSHOT_NOT_FOUND' });
        res.setHeader('X-Data-Source', 'sqlite');
        res.json({ success: true, item, data: item });
    } catch (error) {
        sendError(res, error, '读取指定会议考勤快照失败');
    }
});

// 3. 保存或更新快照
router.post('/', async (req, res) => {
    try {
        const { id, title, meetingDate, summary, payload } = req.body || {};
        if (!payload) return res.status(400).json({ error: '缺少快照数据 (payload)' });

        const item = await repo.saveSnapshot({ id, title, meetingDate, summary, payload });
        res.status(201).json({ success: true, item, data: item });
    } catch (error) {
        sendError(res, error, '保存会议考勤快照失败');
    }
});

// 4. 重命名快照
router.put('/:id', async (req, res) => {
    try {
        const { title } = req.body || {};
        if (!title) return res.status(400).json({ error: '缺少快照新标题' });

        const item = await repo.renameSnapshot(req.params.id, title);
        if (!item) return res.status(404).json({ error: '未找到指定会议快照' });
        res.json({ success: true, item, data: item });
    } catch (error) {
        sendError(res, error, '重命名会议考勤快照失败');
    }
});

// 5. 删除快照
router.delete('/:id', async (req, res) => {
    try {
        const success = await repo.deleteSnapshot(req.params.id);
        if (!success) return res.status(404).json({ error: '未找到指定会议快照或删除失败' });
        res.json({ success: true });
    } catch (error) {
        sendError(res, error, '删除会议考勤快照失败');
    }
});

module.exports = router;
