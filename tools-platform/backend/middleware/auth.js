const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SESSIONS_FILE = path.join(__dirname, '../data/sessions.json');
const SALT = 'tools_platform_salt';

function readJSON(file, defaultVal) {
    if (!fs.existsSync(file)) return defaultVal;
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch(e) {
        return defaultVal;
    }
}

function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Ensure sessions file exists
if (!fs.existsSync(SESSIONS_FILE)) {
    writeJSON(SESSIONS_FILE, {});
}

function checkAuth(req, res, next) {
    // 登录接口无需鉴权 (req.path is relative to /api, so it's /auth/login)
    if (req.path === '/auth/login') return next();

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '请先登录' });
    }

    const token = authHeader.split(' ')[1];
    const sessions = readJSON(SESSIONS_FILE, {});
    const session = sessions[token];

    if (!session || session.expiresAt < Date.now()) {
        if (session) {
            delete sessions[token];
            writeJSON(SESSIONS_FILE, sessions);
        }
        return res.status(401).json({ error: '登录已过期，请重新登录' });
    }

    req.user = session.user; // { username, role }
    next();
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
    hashPassword,
    SESSIONS_FILE,
    readJSON,
    writeJSON
};
