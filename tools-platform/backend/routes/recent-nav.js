const express = require('express');
const repo = require('../models/recent-nav-repository');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        res.json({ ids: await repo.listRecent(req.user.username) });
    } catch (error) {
        res.status(500).json({ error: '读取最近使用失败' });
    }
});

router.post('/', async (req, res) => {
    const toolId = req.body?.toolId;
    if (typeof toolId !== 'string' || !toolId.trim() || toolId.length > 160) {
        return res.status(400).json({ error: '工具 ID 无效' });
    }
    try {
        res.json({ ids: await repo.recordRecent(req.user.username, toolId) });
    } catch (error) {
        res.status(500).json({ error: '保存最近使用失败' });
    }
});

module.exports = router;
