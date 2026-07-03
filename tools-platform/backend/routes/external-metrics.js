const express = require('express');
const router = express.Router();

const metricsRepo = require('../models/external-metrics-repository');

function markSource(res, label) {
    res.setHeader('X-Data-Source', 'sqlite');
    console.log(`[DATA SOURCE] ${label} -> SQLITE`);
}

function parseBool(value) {
    return value === true || value === 'true' || value === '1' || value === 1;
}

function getFilters(req) {
    return {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        month: req.query.month,
        limit: req.query.limit,
        offset: req.query.offset,
        snapshotId: req.query.snapshot_id || req.query.snapshotId,
        category: req.query.category,
        metricLabel: req.query.metric_label || req.query.metricLabel,
        failingOnly: parseBool(req.query.failing_only || req.query.failingOnly),
        includeRaw: parseBool(req.query.include_raw || req.query.includeRaw),
        collection: req.query.collection,
        urgency: req.query.urgency
    };
}

router.get('/summary', async (req, res, next) => {
    try {
        const data = await metricsRepo.getSummary(getFilters(req));
        markSource(res, 'GET /api/external/metrics/summary');
        res.json(data);
    } catch (err) {
        next(err);
    }
});

router.get('/schema', async (req, res, next) => {
    try {
        const data = await metricsRepo.getSchema();
        markSource(res, 'GET /api/external/metrics/schema');
        res.json(data);
    } catch (err) {
        next(err);
    }
});

router.get('/alerts', async (req, res, next) => {
    try {
        const data = await metricsRepo.getAlerts(getFilters(req));
        markSource(res, 'GET /api/external/metrics/alerts');
        if (!data) return res.status(404).json({ error: 'Snapshot not found' });
        res.json(data);
    } catch (err) {
        next(err);
    }
});

router.get('/snapshots', async (req, res, next) => {
    try {
        const data = await metricsRepo.listSnapshots(getFilters(req));
        markSource(res, 'GET /api/external/metrics/snapshots');
        res.json(data);
    } catch (err) {
        next(err);
    }
});

router.get('/snapshots/latest', async (req, res, next) => {
    try {
        const snapshot = await metricsRepo.getLatestSnapshot(getFilters(req));
        markSource(res, 'GET /api/external/metrics/snapshots/latest');
        if (!snapshot) return res.status(404).json({ error: 'Snapshot not found' });
        res.json(snapshot);
    } catch (err) {
        next(err);
    }
});

router.get('/snapshots/:snapshot_id', async (req, res, next) => {
    try {
        const data = await metricsRepo.getSnapshotDetail(req.params.snapshot_id, getFilters(req));
        markSource(res, `GET /api/external/metrics/snapshots/${req.params.snapshot_id}`);
        if (!data) return res.status(404).json({ error: 'Snapshot not found' });
        res.json(data);
    } catch (err) {
        next(err);
    }
});

async function handleMetricList(req, res, next) {
    try {
        const data = await metricsRepo.listMetrics(getFilters(req));
        markSource(res, `GET ${req.originalUrl.split('?')[0]}`);
        res.json(data);
    } catch (err) {
        next(err);
    }
}

router.get('/', handleMetricList);
router.get('/metrics', handleMetricList);

router.get('/failing', async (req, res, next) => {
    try {
        const data = await metricsRepo.listMetrics({
            ...getFilters(req),
            failingOnly: true
        });
        markSource(res, 'GET /api/external/metrics/failing');
        res.json(data);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
