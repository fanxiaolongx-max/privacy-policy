const express = require('express');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const router = express.Router();
const { all, get } = require('../models/app-db');
const { requireAdmin } = require('../middleware/auth');

// 仅限超级管理员访问数据库浏览功能
router.use(requireAdmin);

const LOG_DIR = path.join(__dirname, '../logs');
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function parseDateKey(value, fallback) {
    const text = String(value || '').trim();
    if (!DATE_KEY_PATTERN.test(text)) return fallback;
    const date = new Date(`${text}T00:00:00`);
    return Number.isNaN(date.getTime()) ? fallback : text;
}

function enumerateDateKeys(fromKey, toKey) {
    const keys = [];
    let cursor = new Date(`${fromKey}T00:00:00`);
    const end = new Date(`${toKey}T00:00:00`);
    while (cursor <= end && keys.length <= 31) {
        keys.push(localDateKey(cursor));
        cursor = addDays(cursor, 1);
    }
    return keys;
}

function sanitizeRange(fromKey, toKey) {
    const today = localDateKey();
    const defaultFrom = localDateKey(addDays(new Date(), -2));
    let from = parseDateKey(fromKey, defaultFrom);
    let to = parseDateKey(toKey, today);
    if (from > to) {
        const tmp = from;
        from = to;
        to = tmp;
    }

    const dates = enumerateDateKeys(from, to);
    if (dates.length > 31) {
        dates.splice(0, dates.length - 31);
        from = dates[0];
    }
    return { from, to, dates };
}

function filterLegacyLogByDates(filePath, dateSet) {
    if (!fs.existsSync(filePath)) return '';
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    return lines.filter(line => {
        const dateKey = line.slice(0, 10);
        return dateSet.has(dateKey);
    }).join('\n');
}

// 获取所有表名
router.get('/tables', async (req, res) => {
    try {
        const rows = await all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC");
        res.json(rows.map(r => r.name));
    } catch (err) {
        console.error('[db-explorer] Error fetching tables:', err);
        res.status(500).json({ error: '获取表列表失败' });
    }
});

// 导出最近日志。默认最近 3 个自然日，可通过 from/to 手动指定，最多 31 天。
router.get('/logs/export', async (req, res) => {
    try {
        const { from, to, dates } = sanitizeRange(req.query.from, req.query.to);
        const dateSet = new Set(dates);
        const zip = new JSZip();
        const manifest = {
            generatedAt: new Date().toISOString(),
            from,
            to,
            dates,
            logDir: LOG_DIR,
            files: []
        };

        for (const dateKey of dates) {
            const dayDir = path.join(LOG_DIR, dateKey);
            if (!fs.existsSync(dayDir)) continue;
            for (const name of ['out.log', 'error.log']) {
                const filePath = path.join(dayDir, name);
                if (!fs.existsSync(filePath)) continue;
                const archivePath = `${dateKey}/${name}`;
                zip.file(archivePath, fs.readFileSync(filePath));
                manifest.files.push({
                    path: archivePath,
                    source: filePath,
                    bytes: fs.statSync(filePath).size
                });
            }
        }

        for (const name of ['out.log', 'error.log']) {
            const filePath = path.join(LOG_DIR, name);
            const filtered = filterLegacyLogByDates(filePath, dateSet);
            if (!filtered) continue;
            const archivePath = `legacy-filtered/${name}`;
            zip.file(archivePath, `${filtered}\n`);
            manifest.files.push({
                path: archivePath,
                source: filePath,
                filteredByDate: true,
                bytes: Buffer.byteLength(filtered)
            });
        }

        zip.file('manifest.json', JSON.stringify(manifest, null, 2));

        const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
        const filename = `tools-platform-logs_${from}_${to}.zip`;
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'no-store');
        res.send(content);
    } catch (err) {
        console.error('[db-explorer] Error exporting logs:', err);
        res.status(500).json({ error: '导出日志失败' });
    }
});

// 获取某张表的结构和数据
router.get('/tables/:name', async (req, res) => {
    try {
        const tableName = req.params.name;
        // 防 SQL 注入：确保表真的存在
        const check = await get("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", [tableName]);
        if (!check) return res.status(404).json({ error: '表不存在' });

        const limit = parseInt(req.query.limit, 10) || 100;
        const offset = parseInt(req.query.offset, 10) || 0;

        const countRow = await get(`SELECT COUNT(1) as total FROM "${tableName}"`);
        const total = countRow.total;

        const rows = await all(`SELECT * FROM "${tableName}" LIMIT ? OFFSET ?`, [limit, offset]);
        const schema = await all(`PRAGMA table_info("${tableName}")`);

        res.json({
            table: tableName,
            total,
            limit,
            offset,
            schema,
            rows
        });
    } catch (err) {
        console.error(`[db-explorer] Error fetching table ${req.params.name}:`, err);
        res.status(500).json({ error: '获取表数据失败' });
    }
});

module.exports = router;
