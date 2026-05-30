const crypto = require('crypto');
const authSessionsRepo = require('../models/auth-sessions-repository');

const SALT = 'tools_platform_salt';

async function checkAuth(req, res, next) {
    // 登录接口无需鉴权 (req.path is relative to /api, so it's /auth/login)
    if (req.path === '/auth/login') return next();

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '请先登录' });
    }

    const token = authHeader.split(' ')[1];
    
    try {
        const session = await authSessionsRepo.getSession(token);

        if (!session || session.expiresAt < Date.now()) {
            if (session) {
                await authSessionsRepo.deleteSession(token);
            }
            return res.status(401).json({ error: '登录已过期，请重新登录' });
        }

        req.user = session.user; // { username, role }
        next();
    } catch (err) {
        console.error('Auth check error:', err);
        return res.status(500).json({ error: '服务器鉴权异常' });
    }
}

function requireAdmin(req, res, next) {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: '权限不足，需要超级管理员账号' });
    }
}

function hashPassword(password) {
    return crypto.createHash('sha256').update(password + SALT).digest('hex');
}

module.exports = {
    checkAuth,
    requireAdmin,
    hashPassword
};
