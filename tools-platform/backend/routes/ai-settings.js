const express = require('express');
const router = express.Router();
const repo = require('../models/ai-settings-repository');

router.get('/', async (req, res) => {
    res.json(await repo.getPublicSettings());
});

router.put('/', async (req, res) => {
    try {
        res.json(await repo.saveSettings(req.body || {}));
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message || '保存 AI 助手设置失败' });
    }
});

module.exports = router;
