/**
 * Tools Platform - 主服务入口
 * 统一管理 UIVF12 Catcher 和 Task SLA Killer 的后端 API
 */
const { runPreflight } = require('./preflight');

const PORT = process.env.PORT || 3030;

if (!runPreflight({ port: PORT })) {
    process.exit(1);
}

const express = require('express');
const cors = require('cors');
const path = require('path');

const uivRoutes = require('./routes/uiv');
const slaRoutes = require('./routes/sla');
const uploadRoutes = require('./routes/upload');
const authRoutes = require('./routes/auth');
const requirementsRoutes = require('./routes/requirements');
const aiRoutes = require('./routes/ai');
const storageRoutes = require('./routes/storage');
const frtRoutes = require('./routes/frt');
const prauditRoutes = require('./routes/praudit');
const customToolsRoutes = require('./routes/custom-tools');
const surveysRoutes = require('./routes/surveys');
const customToolsRepo = require('./models/custom-tools-repository');
const navSettingsRoutes = require('./routes/nav-settings');
const aiSettingsRoutes = require('./routes/ai-settings');
const globalBackupRoutes = require('./routes/global-backup');
const remoteBackupSyncRepo = require('./models/remote-backup-sync-repository');
const legacyJsonMigration = require('./models/legacy-json-migration');
const { checkAuth, requireAdmin, checkHtmlAuth } = require('./middleware/auth');

const app = express();

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
app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/assets/icon.ico'));
});

// ============================================================
// API 路由与鉴权
// ============================================================
app.use('/api/auth', authRoutes);

// ============================================================
// 健康检查
// ============================================================
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// 旧 JSON -> SQLite 启动迁移报告。允许未登录访问，便于 Windows 打包版升级后定位数据迁移问题。
app.get('/api/migration-status', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(legacyJsonMigration.getLastMigrationReport());
});

// 开放静态图片访问，跳过 JWT 鉴权 (浏览器 <img> 标签不带 Auth header)
const { REPORT_DATA_DIR } = require('./models/report-store');
app.use('/api/db/images', express.static(path.join(REPORT_DATA_DIR, 'images')));

app.use('/api', checkAuth); // Protect all /api/* (except login, which is handled inside checkAuth)

// Protect modifications: requireAdmin for all non-GET requests under uiv, sla, upload
app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/auth/')) return next();
    if (req.path.startsWith('/requirements')) return next(); // 需求管理内部自行控制权限
    if (req.path.startsWith('/surveys')) return next(); // 调查模板和提交由模块内部控制权限
    if (req.method !== 'GET') {
        return requireAdmin(req, res, next);
    }
    next();
});
app.use('/api/uiv', uivRoutes);         // UIV12 脚本仓库 API
app.use('/api/sla', slaRoutes);         // SLA 配置持久化 API
app.use('/api/upload', uploadRoutes);   // 文件上传历史 API
app.use('/api/db', require('./routes/db')); // DB 保存 API
app.use('/api/requirements', requirementsRoutes); // 需求管理 API
app.use('/api/ai', aiRoutes); // AI 服务 API
app.use('/api/storage', storageRoutes); // 存储迁移状态 API
app.use('/api/db-explorer', require('./routes/db-explorer')); // 数据库浏览 API
app.use('/api/frt', frtRoutes); // FRT 历史快照 API
app.use('/api/praudit', prauditRoutes); // PR审计配置 API
app.use('/api/custom-tools', customToolsRoutes); // 自定义 HTML 工具注册 API
app.use('/api/surveys', surveysRoutes); // 可配置调查模板与提交记录 API
app.use('/api/nav-settings', navSettingsRoutes); // 顶部导航全局设置 API
app.use('/api/ai-settings', aiSettingsRoutes); // 智能客服助手模型配置 API
app.use('/api/global-backup', globalBackupRoutes); // 全局数据备份与恢复 API

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
app.get('/expedite', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages/expedite.html'));
});
app.get('/monthly', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages/monthly.html'));
});
app.get('/bigscreen', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages/bigscreen.html'));
});
app.get('/requirements', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages/requirements.html'));
});
app.get('/praudit', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages/praudit.html'));
});
app.get('/storage', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages/storage.html'));
});
app.get('/db-explorer', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages/db-explorer.html'));
});
app.get('/privacy', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages/privacy.html'));
});
app.get('/terms', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages/terms.html'));
});
app.get('/frt', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages/frt.html'));
});
app.get('/tools/:slug', checkHtmlAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages/custom-tool.html'));
});
app.use('/custom-tools', checkHtmlAuth);
app.get('/custom-tools/:slug/index.html', async (req, res, next) => {
    try {
        const tool = await customToolsRepo.getTool(req.params.slug);
        const filePath = await customToolsRepo.getToolFilePath(req.params.slug);
        if (!tool || !filePath) return res.status(404).send('Custom tool not found');
        if (req.query.download === '1') {
            const filename = `${String(tool.name || tool.slug).replace(/[\\/:*?"<>|]+/g, '_')}.html`;
            return res.download(filePath, filename);
        }
        res.sendFile(filePath);
    } catch (err) {
        next(err);
    }
});
app.use('/custom-tools', express.static(customToolsRepo.CUSTOM_TOOLS_DIR));


// ── 全局错误兜底
app.use((err, req, res, next) => {
    console.error(`\x1b[31m[ERROR] ${req.method} ${req.path}:\x1b[0m`, err.stack || err.message);
    res.status(500).json({ error: err.message || '服务器内部错误' });
});

async function startServer() {
    await legacyJsonMigration.runStartupLegacyJsonMigration();

    const server = app.listen(PORT, () => {
        console.log(`\n✅ Tools Platform 已启动`);
        console.log(`   🌐 访问地址: http://localhost:${PORT}`);
        console.log(`   📦 UIVF12:   http://localhost:${PORT}/uivf12`);
        console.log(`   📊 SLA:      http://localhost:${PORT}/sla\n`);
        setTimeout(() => {
            remoteBackupSyncRepo.runStartupRemoteSync();
        }, 1200);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`\n❌ 启动失败：端口 ${PORT} 已被占用。`);
            console.error(`   解决方式：关闭占用该端口的程序，或使用其他端口启动：`);
            console.error(`   Windows PowerShell: $env:PORT=3031; npm start`);
            console.error(`   macOS/Linux: PORT=3031 npm start\n`);
        } else if (err.code === 'EACCES') {
            console.error(`\n❌ 启动失败：没有权限监听端口 ${PORT}。请换用 1024 以上端口，或检查系统权限。\n`);
        } else {
            console.error('\n❌ 启动失败：', err);
        }
        process.exit(1);
    });
}

startServer().catch(err => {
    console.error('\n❌ 启动失败：旧 JSON 自动迁移失败：', err);
    process.exit(1);
});
