const express = require('express');
const router = express.Router();
const metricsRepo = require('../models/platform-metrics-repository');
const serviceStatusRepo = require('../models/service-status-repository');
const desktopLicenseLocal = require('./desktop-license-local');

router.get('/service-status', async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-store');
        const history = await serviceStatusRepo.getHistory(req.query.days);
        history.license = serviceStatusRepo.summarizeLicenseStatus(desktopLicenseLocal.getStatus());
        res.json(history);
    } catch (err) {
        console.error('[platform-metrics] service status failed:', err);
        res.status(500).json({ error: '读取服务状态统计失败' });
    }
});

router.get('/summary', async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-store');
        res.json(await metricsRepo.getSummary());
    } catch (err) {
        console.error('[platform-metrics] summary failed:', err);
        res.status(500).json({ error: '读取平台效能统计失败' });
    }
});

router.post('/open', async (req, res) => {
    try {
        res.json(await metricsRepo.trackOpen(req.body && req.body.toolKey));
    } catch (err) {
        res.status(400).json({ error: err.message || '记录使用量失败' });
    }
});

module.exports = router;
