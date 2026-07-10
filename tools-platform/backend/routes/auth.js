const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { checkAuth, requireAdmin, hashPassword } = require('../middleware/auth');
const authUsersRepo = require('../models/auth-users-repository');
const authSessionsRepo = require('../models/auth-sessions-repository');
const authSecurityMonitor = require('../models/auth-security-monitor');
const authSecuritySettingsRepo = require('../models/auth-security-settings-repository');

const DEFAULT_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

async function getSessionMaxAgeMs() {
    try {
        const settings = await authSecuritySettingsRepo.getSettings();
        return Math.max(1, Number(settings.sessionMaxAgeHours) || 168) * 60 * 60 * 1000;
    } catch (err) {
        console.error('[auth] failed to load security settings:', err.message);
        return DEFAULT_SESSION_MAX_AGE_MS;
    }
}

function isSecureRequest(req) {
    const forwardedProto = String(req.get('x-forwarded-proto') || '').split(',')[0].trim().toLowerCase();
    return Boolean(req.secure || forwardedProto === 'https');
}

function getAuthCookieOptions(req, extra = {}) {
    return {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecureRequest(req),
        ...extra
    };
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const block = await authSecurityMonitor.getLoginBlock(req, username);
        if (block) {
            res.setHeader('Retry-After', String(block.retry_after_seconds || 60));
            return res.status(429).json({
                error: '登录失败次数过多，请稍后再试',
                locked_until: block.locked_until,
                retry_after_seconds: block.retry_after_seconds,
                lock_type: block.lock_type
            });
        }

        const user = await authUsersRepo.getUser(username);

        if (!user || user.passwordHash !== hashPassword(password)) {
            authSecurityMonitor.recordLoginAttempt(req, {
                username,
                success: false,
                reason: user ? 'bad_password' : 'unknown_user'
            });
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        
        const sessionMaxAgeMs = await getSessionMaxAgeMs();
        const expiresAt = Date.now() + sessionMaxAgeMs;
        await authSessionsRepo.saveSession(token, username, user.role, expiresAt);
        authSecurityMonitor.recordLoginAttempt(req, {
            username,
            success: true,
            reason: 'success'
        });
        authSecurityMonitor.clearSuccessfulLoginState(req, username);
        
        res.cookie('tools_token', token, getAuthCookieOptions(req, { maxAge: sessionMaxAgeMs }));
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
        res.clearCookie('tools_token', getAuthCookieOptions(req));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: '注销失败' });
    }
});

// GET /api/auth/me
router.get('/me', checkAuth, (req, res) => {
    res.json(req.user);
});

// --- Security Settings & Lock Management (Admin Only) ---

router.get('/security/settings', checkAuth, requireAdmin, async (req, res) => {
    try {
        res.json(await authSecuritySettingsRepo.getSettings());
    } catch (err) {
        console.error('[auth] get security settings failed:', err);
        res.status(500).json({ error: '获取安全配置失败' });
    }
});

router.put('/security/settings', checkAuth, requireAdmin, async (req, res) => {
    try {
        res.json(await authSecuritySettingsRepo.saveSettings(req.body || {}));
    } catch (err) {
        console.error('[auth] save security settings failed:', err);
        res.status(err.statusCode || 500).json({ error: err.message || '保存安全配置失败' });
    }
});

router.get('/security/locks', checkAuth, requireAdmin, async (req, res) => {
    try {
        res.json(await authSecurityMonitor.listActiveLocks());
    } catch (err) {
        console.error('[auth] list security locks failed:', err);
        res.status(500).json({ error: '获取锁定状态失败' });
    }
});

router.delete('/security/locks/:lockKey', checkAuth, requireAdmin, async (req, res) => {
    try {
        const lock = await authSecurityMonitor.unlockLock(req.params.lockKey, req);
        if (!lock) return res.status(404).json({ error: '锁定记录不存在' });
        res.json({ success: true, lock });
    } catch (err) {
        console.error('[auth] unlock security lock failed:', err);
        res.status(500).json({ error: '解除锁定失败' });
    }
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
