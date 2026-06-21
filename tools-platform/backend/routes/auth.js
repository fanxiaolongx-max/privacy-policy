const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { checkAuth, requireAdmin, hashPassword } = require('../middleware/auth');
const authUsersRepo = require('../models/auth-users-repository');
const authSessionsRepo = require('../models/auth-sessions-repository');

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const user = await authUsersRepo.getUser(username);

        if (!user || user.passwordHash !== hashPassword(password)) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        
        // Set expiry to 7 days
        const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
        await authSessionsRepo.saveSession(token, username, user.role, expiresAt);
        
        res.cookie('tools_token', token, { maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' });
        res.json({ success: true, token, role: user.role, username });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: '登录失败' });
    }
});

// POST /api/auth/logout
router.post('/logout', checkAuth, async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        await authSessionsRepo.deleteSession(token);
        res.clearCookie('tools_token', { path: '/' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: '注销失败' });
    }
});

// GET /api/auth/me
router.get('/me', checkAuth, (req, res) => {
    res.json(req.user);
});

// --- User Management (Admin Only) ---

// GET /api/auth/users
router.get('/users', checkAuth, requireAdmin, async (req, res) => {
    try {
        const usersObj = await authUsersRepo.listUsers({ mode: 'auto' });
        // usersObj.items is a dict: { username: { role, passwordHash } }
        const users = usersObj.items || {};
        const userList = Object.keys(users).map(u => ({ username: u, role: users[u].role }));
        res.json(userList);
    } catch (err) {
        res.status(500).json({ error: '获取用户列表失败' });
    }
});

// POST /api/auth/users
router.post('/users', checkAuth, requireAdmin, async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role) return res.status(400).json({ error: '缺少必填字段' });
    
    try {
        const user = await authUsersRepo.getUser(username);
        if (user) {
            return res.status(400).json({ error: '用户名已存在' });
        }
        
        await authUsersRepo.saveUser(username, role, hashPassword(password));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: '创建用户失败' });
    }
});

// DELETE /api/auth/users/:username
router.delete('/users/:username', checkAuth, requireAdmin, async (req, res) => {
    const username = req.params.username;
    if (username === 'admin') {
        return res.status(403).json({ error: '默认超级管理员不能删除' });
    }
    
    try {
        const user = await authUsersRepo.getUser(username);
        if (user) {
            await authUsersRepo.deleteUser(username);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: '用户不存在' });
        }
    } catch (err) {
        res.status(500).json({ error: '删除用户失败' });
    }
});

// PUT /api/auth/users/:username/password
router.put('/users/:username/password', checkAuth, requireAdmin, async (req, res) => {
    const { password } = req.body;
    const username = req.params.username;
    
    try {
        const user = await authUsersRepo.getUser(username);
        if (user) {
            await authUsersRepo.saveUser(username, user.role, hashPassword(password));
            res.json({ success: true });
        } else {
            res.status(404).json({ error: '用户不存在' });
        }
    } catch (err) {
        res.status(500).json({ error: '修改密码失败' });
    }
});

module.exports = router;
