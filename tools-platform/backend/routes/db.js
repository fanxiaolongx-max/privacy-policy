const express = require('express');
const router = express.require ? express.Router() : require('express').Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'report.db');
const db = new sqlite3.Database(dbPath);

// Initialize DB schema
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS ReportSnapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_id TEXT,
        month INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        standard_total_score REAL,
        raw_data_json TEXT,
        image_path TEXT,
        excel_path TEXT
    )`);
    
    // Add column if it didn't exist in older versions
    db.run("ALTER TABLE ReportSnapshots ADD COLUMN image_path TEXT", () => {});
    db.run("ALTER TABLE ReportSnapshots ADD COLUMN excel_path TEXT", () => {});
    
    db.run(`CREATE TABLE IF NOT EXISTS ReportCategoryScores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_id TEXT,
        cat_name TEXT,
        base_score REAL,
        manual_score REAL,
        final_score REAL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS ReportMetricData (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_id TEXT,
        cat_name TEXT,
        metric_label TEXT,
        weight REAL,
        target_val TEXT,
        raw_val TEXT,
        num_val REAL,
        is_failing INTEGER,
        gap TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS PlatformConfig (
        key_name TEXT PRIMARY KEY,
        value_json TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

const imagesDir = path.join(dataDir, 'images');
if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
}

// Serve static images
router.use('/images', express.static(imagesDir));

router.post('/save', (req, res) => {
    const { snapshot_id, month, standard_total_score, cat_scores, metric_data, raw_data, image_data } = req.body;
    
    if (!snapshot_id) {
        return res.status(400).json({ error: 'Missing snapshot_id' });
    }

    let image_path = null;
    if (image_data && image_data.startsWith('data:image/')) {
        const base64Data = image_data.replace(/^data:image\/\w+;base64,/, "");
        const filePath = path.join(imagesDir, `${snapshot_id}_${month}.png`);
        fs.writeFileSync(filePath, base64Data, 'base64');
        image_path = `/api/db/images/${snapshot_id}_${month}.png`;
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // Delete existing data for this snapshot to allow re-saving
        db.run('DELETE FROM ReportSnapshots WHERE snapshot_id = ? AND month = ?', [snapshot_id, month]);
        db.run('DELETE FROM ReportCategoryScores WHERE snapshot_id = ?', [snapshot_id]);
        db.run('DELETE FROM ReportMetricData WHERE snapshot_id = ?', [snapshot_id]);

        // Save excel to disk if provided
        let excel_path = null;
        if (req.body.excel_data) {
            const matches = req.body.excel_data.match(/^data:(.+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                const buffer = Buffer.from(matches[2], 'base64');
                const filename = `${snapshot_id}_${month}.xlsx`;
                const fullPath = path.join(imagesDir, filename);
                fs.writeFileSync(fullPath, buffer);
                excel_path = `/api/db/images/${filename}`;
            }
        }

        db.run(`INSERT INTO ReportSnapshots (snapshot_id, month, standard_total_score, raw_data_json, image_path, excel_path)
                VALUES (?, ?, ?, ?, ?, ?)`, 
                [snapshot_id, month, standard_total_score, JSON.stringify(raw_data), image_path, excel_path], function(err) {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
            }
        });

        const stmtCat = db.prepare(`INSERT INTO ReportCategoryScores (snapshot_id, cat_name, base_score, manual_score, final_score)
                                    VALUES (?, ?, ?, ?, ?)`);
        for (const cat of (cat_scores || [])) {
            stmtCat.run([snapshot_id, cat.cat_name, cat.base_score, cat.manual_score, cat.final_score]);
        }
        stmtCat.finalize();

        const stmtMetric = db.prepare(`INSERT INTO ReportMetricData (snapshot_id, cat_name, metric_label, weight, target_val, raw_val, num_val, is_failing, gap)
                                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        for (const m of (metric_data || [])) {
            stmtMetric.run([snapshot_id, m.cat_name, m.metric_label, m.weight, m.target_val, m.raw_val, m.num_val, m.is_failing ? 1 : 0, m.gap]);
        }
        stmtMetric.finalize();

        db.run('COMMIT', (err) => {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, message: '数据已成功入库' });
        });
    });
});

router.get('/snapshots', (req, res) => {
    db.all('SELECT snapshot_id, month, created_at, standard_total_score FROM ReportSnapshots ORDER BY id DESC', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

function getFailingForSnapshot(snapshot, res) {
    db.all('SELECT * FROM ReportMetricData WHERE snapshot_id = ? AND is_failing = 1', [snapshot.snapshot_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const grouped = {};
        rows.forEach(row => {
            if (!grouped[row.cat_name]) grouped[row.cat_name] = [];
            grouped[row.cat_name].push(row);
        });
        
        res.json({
            snapshot_id: snapshot.snapshot_id,
            month: snapshot.month,
            created_at: snapshot.created_at,
            failing_metrics: grouped,
            image_path: snapshot.image_path,
            excel_path: snapshot.excel_path
        });
    });
}

router.get('/latest_failing', (req, res) => {
    db.get('SELECT * FROM ReportSnapshots ORDER BY id DESC LIMIT 1', (err, snapshot) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!snapshot) return res.json({ message: 'No snapshots found' });
        getFailingForSnapshot(snapshot, res);
    });
});

router.get('/failing/:snapshot_id', (req, res) => {
    db.get('SELECT * FROM ReportSnapshots WHERE snapshot_id = ?', [req.params.snapshot_id], (err, snapshot) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!snapshot) return res.status(404).json({ error: 'Snapshot not found' });
        getFailingForSnapshot(snapshot, res);
    });
});

// Configuration Endpoints
router.get('/config/:key', (req, res) => {
    db.get('SELECT value_json FROM PlatformConfig WHERE key_name = ?', [req.params.key], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.json({});
        try {
            res.json(JSON.parse(row.value_json));
        } catch (e) {
            res.json({});
        }
    });
});

router.post('/config/:key', (req, res) => {
    const valueJson = JSON.stringify(req.body);
    db.run('INSERT INTO PlatformConfig (key_name, value_json) VALUES (?, ?) ON CONFLICT(key_name) DO UPDATE SET value_json = ?, updated_at = CURRENT_TIMESTAMP', 
        [req.params.key, valueJson, valueJson], 
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

module.exports = router;
