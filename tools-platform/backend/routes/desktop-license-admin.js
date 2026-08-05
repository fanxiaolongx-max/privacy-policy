const express = require('express');
const authority = require('../models/desktop-license-authority');
const registry = require('../models/desktop-license-registry');

const router = express.Router();

router.get('/', (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-store');
        res.json({ success: true, licenses: registry.listRecords({ includeArchived: req.query.includeArchived !== '0' }) });
    } catch (error) {
        res.status(500).json({ error: error.message || '读取 EXE License 失败' });
    }
});

router.post('/issue', (req, res) => {
    try {
        res.json({ success: true, ...authority.issue(req.body || {}) });
    } catch (error) {
        res.status(400).json({ error: error.message || '签发 EXE License 失败' });
    }
});

router.post('/:licenseId/renew', (req, res) => {
    try {
        res.json({ success: true, ...authority.renew(req.params.licenseId, req.body || {}) });
    } catch (error) {
        res.status(400).json({ error: error.message || '续期失败' });
    }
});

router.post('/:licenseId/revoke', (req, res) => {
    try {
        res.json({ success: true, record: registry.setStatus(req.params.licenseId, 'revoked', req.body && req.body.reason) });
    } catch (error) {
        res.status(400).json({ error: error.message || '失效操作失败' });
    }
});

router.post('/:licenseId/restore', (req, res) => {
    try {
        res.json({ success: true, record: registry.setStatus(req.params.licenseId, 'active') });
    } catch (error) {
        res.status(400).json({ error: error.message || '恢复失败' });
    }
});

router.post('/:licenseId/archive', (req, res) => {
    try {
        res.json({ success: true, record: registry.setStatus(req.params.licenseId, 'archived') });
    } catch (error) {
        res.status(400).json({ error: error.message || '归档失败' });
    }
});

module.exports = router;
