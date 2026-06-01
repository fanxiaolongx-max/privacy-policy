const express = require('express');
const router = express.Router();
const frtRepo = require('../models/frt-snapshots-repository');

// GET /api/frt/snapshots
router.get('/snapshots', async (req, res) => {
    try {
        const { mode } = req.query;
        const result = await frtRepo.listSnapshots({ mode });
        res.setHeader('X-Data-Source', result.source);
        res.json(result.items);
    } catch (err) {
        console.error('[FRT GET Snapshots] Error:', err);
        res.status(500).json({ error: 'Failed to retrieve FRT snapshots' });
    }
});

// POST /api/frt/snapshots
router.post('/snapshots', async (req, res) => {
    try {
        const payload = req.body;
        if (!payload || !payload.month) {
            return res.status(400).json({ error: 'Missing month in payload' });
        }
        
        const newSnapshot = await frtRepo.addSnapshot(payload);
        res.status(201).json({ message: 'Snapshot saved successfully', item: newSnapshot });
    } catch (err) {
        console.error('[FRT POST Snapshot] Error:', err);
        res.status(500).json({ error: 'Failed to save FRT snapshot' });
    }
});

// DELETE /api/frt/snapshots/:id
router.delete('/snapshots/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await frtRepo.deleteSnapshot(id);
        res.json({ message: 'Snapshot deleted successfully' });
    } catch (err) {
        console.error('[FRT DELETE Snapshot] Error:', err);
        res.status(500).json({ error: 'Failed to delete FRT snapshot' });
    }
});

module.exports = router;
