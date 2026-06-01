const express = require('express');
const router = express.Router();
const repo = require('../models/praudit-configs-repository');
const crypto = require('crypto');

router.get('/configs', async (req, res) => {
    try {
        const configs = await repo.getAll();
        res.json(configs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/configs', async (req, res) => {
    try {
        const { id, name, fields, checkpoints, reportFields } = req.body;
        
        if (!name || !fields || !checkpoints) {
            return res.status(400).json({ error: "Missing required fields: name, fields, or checkpoints" });
        }
        
        const configId = id || 'audit_' + crypto.randomBytes(8).toString('hex');
        
        const config = {
            id: configId,
            name,
            fields,
            checkpoints,
            reportFields: reportFields || []
        };
        
        const saved = await repo.save(config);
        res.json(saved);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/configs/:id', async (req, res) => {
    try {
        const id = req.params.id;
        await repo.delete(id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Initialize DB on route load
repo.init().catch(console.error);

module.exports = router;
