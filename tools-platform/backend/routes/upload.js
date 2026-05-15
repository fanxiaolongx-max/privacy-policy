/**
 * 上传历史记录路由
 * 记录两个工具的操作历史，存储在服务端
 */
const express = require('express');
const router = express.Router();
const { readJSON, writeJSON } = require('../models/store');

const HISTORY_FILE = 'upload_history.json';
const MAX_HISTORY = 200; // 最多保留 200 条记录

// GET /api/upload/history?tool=uiv|sla&limit=50
router.get('/history', (req, res) => {
    const { tool, limit = 50 } = req.query;
    let history = readJSON(HISTORY_FILE, []);
    if (tool) history = history.filter(h => h.tool === tool);
    res.json(history.slice(0, parseInt(limit)));
});

// POST /api/upload/history  → 追加一条历史记录
router.post('/history', (req, res) => {
    const { tool, action, detail } = req.body;
    if (!tool || !action) return res.status(400).json({ error: '参数不完整' });

    let history = readJSON(HISTORY_FILE, []);
    history.unshift({
        id: Date.now().toString(36),
        tool,
        action,
        detail: detail || '',
        time: new Date().toISOString()
    });

    // 只保留最近 MAX_HISTORY 条
    if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
    writeJSON(HISTORY_FILE, history);
    res.json({ success: true });
});

// DELETE /api/upload/history  → 清空历史
router.delete('/history', (req, res) => {
    const { tool } = req.query;
    if (tool) {
        let history = readJSON(HISTORY_FILE, []);
        history = history.filter(h => h.tool !== tool);
        writeJSON(HISTORY_FILE, history);
    } else {
        writeJSON(HISTORY_FILE, []);
    }
    res.json({ success: true });
});

module.exports = router;
