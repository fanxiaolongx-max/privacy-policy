const express = require('express');
const router = express.Router();
const { all, get } = require('../models/app-db');
const { requireAdmin } = require('../middleware/auth');

// 仅限超级管理员访问数据库浏览功能
router.use(requireAdmin);

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
