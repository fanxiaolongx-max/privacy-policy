const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const { ensureDataDir, DATA_DIR } = require('../models/store');

const dataDir = DATA_DIR;
ensureDataDir();

const dbPath = path.join(dataDir, 'requirements.db');
const db = new sqlite3.Database(dbPath);

// 初始化表结构
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS Requirements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        description TEXT,
        status TEXT,
        creator TEXT,
        assignee TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Add category column dynamically if it doesn't exist
    db.run("ALTER TABLE Requirements ADD COLUMN category TEXT", () => {});
    db.run("ALTER TABLE Requirements ADD COLUMN urgent INTEGER NOT NULL DEFAULT 0", () => {});

    db.run(`CREATE TABLE IF NOT EXISTS RequirementLogs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        req_id INTEGER,
        old_status TEXT,
        new_status TEXT,
        remark TEXT,
        operator TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// 获取需求列表
router.get('/', (req, res) => {
    db.all('SELECT * FROM Requirements ORDER BY id DESC', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 获取单个需求及日志
router.get('/:id', (req, res) => {
    const id = req.params.id;
    db.get('SELECT * FROM Requirements WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: '需求不存在' });
        
        db.all('SELECT * FROM RequirementLogs WHERE req_id = ? ORDER BY id ASC', [id], (err, logs) => {
            if (err) return res.status(500).json({ error: err.message });
            row.logs = logs;
            res.json(row);
        });
    });
});

// 提交新需求
router.post('/', (req, res) => {
    const { title, description, category, urgent } = req.body;
    if (!title) return res.status(400).json({ error: '标题为必填项' });
    if (!category) return res.status(400).json({ error: '页面分类为必选项' });

    const status = '提交';
    const creator = req.user ? req.user.username : 'Guest';
    
    const isUrgent = urgent === true || urgent === 1 || urgent === '1';

    db.run(`INSERT INTO Requirements (title, description, category, status, creator, urgent) VALUES (?, ?, ?, ?, ?, ?)`,
        [title, description || '', category, status, creator, isUrgent ? 1 : 0],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const reqId = this.lastID;
            
            db.run(`INSERT INTO RequirementLogs (req_id, old_status, new_status, remark, operator) VALUES (?, ?, ?, ?, ?)`,
                [reqId, '', status, '创建需求', creator],
                (err) => {
                    if (err) console.error("Log insert error:", err);
                    res.json({ success: true, id: reqId, message: '需求提交成功' });
                }
            );
        }
    );
});

// 更新需求 (可以只更新信息，或者推进流程状态)
router.put('/:id', (req, res) => {
    const id = req.params.id;
    const { title, description, category, status, assignee, remark, urgent } = req.body;
    const operator = req.user ? req.user.username : 'Guest';
    const userRole = req.user ? req.user.role : 'guest';

    db.get('SELECT * FROM Requirements WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: '需求不存在' });

        // 权限校验：提交后，只有管理员能修改需求
        if (userRole !== 'admin') {
            return res.status(403).json({ error: '没有权限，提交后仅管理员可修改需求信息' });
        }

        const newTitle = title !== undefined ? title : row.title;
        const newDesc = description !== undefined ? description : row.description;
        const newCategory = category !== undefined ? category : (row.category || '未分类');
        const newAssignee = assignee !== undefined ? assignee : row.assignee;
        const newUrgent = urgent !== undefined
            ? (urgent === true || urgent === 1 || urgent === '1' ? 1 : 0)
            : (row.urgent ? 1 : 0);
        let newStatus = status !== undefined ? status : row.status;
        
        // 如果是从客户端发起的更新并且没有状态变更
        if (status === undefined) {
             newStatus = row.status;
        }

        // 验证状态流转规则：只能前进一格，或直接拒绝，不能后退或跳跃
        const statuses = ['提交', '需求接受', '需求实现中', '需求完成', '验收完成', '需求评价'];
        const oldIndex = statuses.indexOf(row.status);
        const newIndex = statuses.indexOf(newStatus);

        if (newStatus !== row.status && newStatus !== '已拒绝' && row.status !== '已拒绝') {
            if (newIndex === -1 || oldIndex === -1) {
                return res.status(400).json({ error: '无效的状态' });
            }
            if (newIndex < oldIndex) {
                return res.status(400).json({ error: '流程不能回退' });
            }
            if (newIndex > oldIndex + 1) {
                return res.status(400).json({ error: '流程不能跳级' });
            }
        }
        if (row.status === '已拒绝' && newStatus !== '已拒绝') {
            return res.status(400).json({ error: '已拒绝的需求无法再流转' });
        }

        db.run(`UPDATE Requirements SET title = ?, description = ?, category = ?, status = ?, assignee = ?, urgent = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [newTitle, newDesc, newCategory, newStatus, newAssignee, newUrgent, id],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                
                // 如果状态发生了变化，或者填写了备注，就记录日志
                if (newStatus !== row.status || (remark && remark.trim() !== '')) {
                    db.run(`INSERT INTO RequirementLogs (req_id, old_status, new_status, remark, operator) VALUES (?, ?, ?, ?, ?)`,
                        [id, row.status, newStatus, remark || '更新需求信息', operator],
                        (err) => {
                            if (err) console.error("Log insert error:", err);
                            res.json({ success: true, message: '更新成功' });
                        }
                    );
                } else {
                    res.json({ success: true, message: '更新成功' });
                }
            }
        );
    });
});

// 删除需求
router.delete('/:id', (req, res) => {
    const id = req.params.id;
    const operator = req.user ? req.user.username : 'Guest';
    const userRole = req.user ? req.user.role : 'guest';

    db.get('SELECT creator FROM Requirements WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: '需求不存在' });

        if (userRole !== 'admin') {
            return res.status(403).json({ error: '没有权限，仅管理员可删除需求' });
        }

        db.run('DELETE FROM Requirements WHERE id = ?', [id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            
            db.run('DELETE FROM RequirementLogs WHERE req_id = ?', [id], (err) => {
                res.json({ success: true, message: '删除成功' });
            });
        });
    });
});

router.closeDatabase = function closeDatabase() {
    return new Promise((resolve, reject) => {
        db.close(err => {
            if (err && err.code !== 'SQLITE_MISUSE') return reject(err);
            resolve();
        });
    });
};

module.exports = router;
