/**
 * Tools Platform - 主服务入口
 * 统一管理 UIVF12 Catcher 和 Task SLA Killer 的后端 API
 */
const express = require('express');
const cors = require('cors');
const path = require('path');

const uivRoutes = require('./routes/uiv');
const slaRoutes = require('./routes/sla');
const uploadRoutes = require('./routes/upload');
const authRoutes = require('./routes/auth');
const { checkAuth, requireAdmin } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3030;

// ============================================================
// 中间件
// ============================================================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── 请求日志（每次 API 请求都打印到控制台）
app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) return next(); // 只记录 API 请求
    const start = Date.now();
    const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    res.on('finish', () => {
        const dur = Date.now() - start;
        const status = res.statusCode;
        const color = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m';
        const reset = '\x1b[0m';
        const bodySize = req.headers['content-length'] ? `(body: ${req.headers['content-length']}B)` : '';
        console.log(`${color}[${ts}] ${req.method} ${req.path} → ${status} (${dur}ms) ${bodySize}${reset}`);
        if (status >= 400) {
            console.log(`  ↳ Body:`, JSON.stringify(req.body).substring(0, 300));
        }
    });
    next();
});

// 静态文件 (前端) - 需要鉴权控制，除了 login.html 等
app.use((req, res, next) => {
    // Check if the route is an API route or static asset
    if (req.path.startsWith('/api/') || req.path.endsWith('.css') || req.path.endsWith('.js') || req.path.endsWith('.png') || req.path.endsWith('.svg') || req.path === '/login.html') {
        return next();
    }
    
    // For HTML pages, we don't have token in headers easily. The JS will redirect.
    // So we just let frontend load and the JS api calls will fail with 401 and redirect.
    next();
});

app.use(express.static(path.join(__dirname, '../frontend')));

// ============================================================
// API 路由与鉴权
// ============================================================
app.use('/api/auth', authRoutes);

app.use('/api', checkAuth); // Protect all /api/* (except login, which is handled inside checkAuth)

// Protect modifications: requireAdmin for all non-GET requests under uiv, sla, upload
app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/auth/')) return next();
    if (req.method !== 'GET') {
        return requireAdmin(req, res, next);
    }
    next();
});
app.use('/api/uiv', uivRoutes);         // UIV12 脚本仓库 API
app.use('/api/sla', slaRoutes);         // SLA 配置持久化 API
app.use('/api/upload', uploadRoutes);   // 文件上传历史 API

// ============================================================
// 前端路由回退（SPA）
// ============================================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages/login.html'));
});
app.get('/uivf12', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages/uivf12.html'));
});
app.get('/sla', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages/sla.html'));
});
app.get('/report', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages/report.html'));
});

// ============================================================
// 健康检查
// ============================================================
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// ── 全局错误兜底
app.use((err, req, res, next) => {
    console.error(`\x1b[31m[ERROR] ${req.method} ${req.path}:\x1b[0m`, err.stack || err.message);
    res.status(500).json({ error: err.message || '服务器内部错误' });
});

app.listen(PORT, () => {
    console.log(`\n✅ Tools Platform 已启动`);
    console.log(`   🌐 访问地址: http://localhost:${PORT}`);
    console.log(`   📦 UIVF12:   http://localhost:${PORT}/uivf12`);
    console.log(`   📊 SLA:      http://localhost:${PORT}/sla\n`);
});
