const express = require('express');
const quickStartService = require('../models/default-quick-start-service');

const router = express.Router();

router.get('/defaults/status', async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-store');
        res.json(await quickStartService.getStatus({ role: req.user && req.user.role }));
    } catch (error) {
        console.error('[onboarding] 读取首次启动状态失败：', error);
        res.status(500).json({ error: error.message || '读取首次启动状态失败' });
    }
});

router.post('/defaults/decision', async (req, res) => {
    try {
        const state = await quickStartService.applyDecision({
            action: req.body && req.body.action,
            importScripts: req.body && req.body.importScripts,
            importMetricRules: req.body && req.body.importMetricRules,
            actor: req.user && req.user.username
        });
        res.json({ success: true, state });
    } catch (error) {
        console.error('[onboarding] 保存首次启动选择失败：', error);
        res.status(error.statusCode || 500).json({ error: error.message || '保存首次启动选择失败' });
    }
});

module.exports = router;
