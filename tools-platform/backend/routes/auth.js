const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const path = require('path');
const { checkAuth, requireAdmin, hashPassword, SESSIONS_FILE, readJSON, writeJSON } = require('../middleware/auth');

const USERS_FILE = path.join(__dirname, '../data/users.json');

// POST /api/auth/login
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    const users = readJSON(USERS_FILE, {});
    const user = users[username];

    if (!user || user.passwordHash !== hashPassword(password)) {
        return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const sessions = readJSON(SESSIONS_FILE, {});
    
    // Set expiry to 7 days
    sessions[token] = {
        user: { username, role: user.role },
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
    };
    
    writeJSON(SESSIONS_FILE, sessions);
    res.json({ success: true, token, role: user.role, username });
});

// POST /api/auth/logout
router.post('/logout', checkAuth, (req, res) => {
    const token = req.headers.authorization.split(' ')[1];
    const sessions = readJSON(SESSIONS_FILE, {});
    if (sessions[token]) {
        delete sessions[token];
        writeJSON(SESSIONS_FILE, sessions);
    }
    res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', checkAuth, (req, res) => {
    res.json(req.user);
});

// --- User Management (Admin Only) ---

// GET /api/auth/users
router.get('/users', checkAuth, requireAdmin, (req, res) => {
    const users = readJSON(USERS_FILE, {});
    const userList = Object.keys(users).map(u => ({ username: u, role: users[u].role }));
    res.json(userList);
});

// POST /api/auth/users
router.post('/users', checkAuth, requireAdmin, (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role) return res.status(400).json({ error: '缺少必填字段' });
    
    const users = readJSON(USERS_FILE, {});
    if (users[username]) {
        return res.status(400).json({ error: '用户名已存在' });
    }
    
    users[username] = { role, passwordHash: hashPassword(password) };
    writeJSON(USERS_FILE, users);
    res.json({ success: true });
});

// DELETE /api/auth/users/:username
router.delete('/users/:username', checkAuth, requireAdmin, (req, res) => {
    const username = req.params.username;
    if (username === 'admin') {
        return res.status(403).json({ error: '默认超级管理员不能删除' });
    }
    
    const users = readJSON(USERS_FILE, {});
    if (users[username]) {
        delete users[username];
        writeJSON(USERS_FILE, users);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: '用户不存在' });
    }
});

// PUT /api/auth/users/:username/password
router.put('/users/:username/password', checkAuth, requireAdmin, (req, res) => {
    const { password } = req.body;
    const username = req.params.username;
    
    const users = readJSON(USERS_FILE, {});
    if (users[username]) {
        users[username].passwordHash = hashPassword(password);
        writeJSON(USERS_FILE, users);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: '用户不存在' });
    }
});

module.exports = router;
