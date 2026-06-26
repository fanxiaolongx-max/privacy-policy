const express = require('express');
const router = express.Router();
const repo = require('../models/nav-settings-repository');

router.get('/', (req, res) => {
    res.json(await repo.getSettings());
});

router.put('/', (req, res) => {
    try {
        res.json(await repo.saveSettings(req.body || {}));
    } catch (err) {
        res.status(500).json({ error: err.message || '保存导航设置失败' });
    }
});

module.exports = router;
