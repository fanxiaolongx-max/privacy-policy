const express = require('express');
const quickStartService = require('../models/default-quick-start-service');
const factoryResetService = require('../models/factory-reset-service');

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

router.post('/defaults/apply', async (req, res) => {
    try {
        const state = await quickStartService.applyBundledDefaults({
            importScripts: req.body?.importScripts !== false,
            importMetricRules: req.body?.importMetricRules !== false,
            actor: req.user && req.user.username
        });
        res.json({ success: true, state });
    } catch (error) {
        console.error('[onboarding] 重新导入开箱即用内容失败：', error);
        res.status(error.statusCode || 500).json({ error: error.message || '导入开箱即用内容失败' });
    }
});

router.post('/factory-reset', async (req, res) => {
    try {
        const result = await factoryResetService.prepareFactoryReset({
            confirmation: req.body && req.body.confirmation,
            actor: req.user && req.user.username
        });
        if (process.env.TOOLS_FACTORY_RESET_AUTO_EXIT !== 'false') {
            res.on('finish', () => setTimeout(() => process.exit(0), 800));
        }
        res.json(result);
    } catch (error) {
        console.error('[onboarding] 准备彻底初始化失败：', error);
        res.status(error.statusCode || 500).json({ error: error.message || '准备彻底初始化失败' });
    }
});

module.exports = router;
