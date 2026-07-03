/**
 * Tools Platform - 主服务入口
 * 统一管理 UIVF12 Catcher 和 Task SLA Killer 的后端 API
 */
require('./logger/daily-file-console').installDailyFileConsole();
const { runPreflight } = require('./preflight');

const PORT = process.env.PORT || 3030;

if (!runPreflight({ port: PORT })) {
    process.exit(1);
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const appPackage = require('../package.json');

const uivRoutes = require('./routes/uiv');
const uivAutoImportRoutes = require('./routes/uiv-auto-import');
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
const externalMetricsRoutes = require('./routes/external-metrics');
const customToolsRepo = require('./models/custom-tools-repository');
const navSettingsRoutes = require('./routes/nav-settings');
const aiSettingsRoutes = require('./routes/ai-settings');
const globalBackupRoutes = require('./routes/global-backup');
const globalBackupRepo = require('./models/global-backup-repository');
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

const FRONTEND_DIR = path.join(__dirname, '../frontend');
const PUBLIC_HTML_PATHS = new Set([
    '/login.html',
    '/pages/login.html',
    '/privacy',
    '/privacy.html',
    '/pages/privacy.html',
    '/terms',
    '/terms.html',
    '/pages/terms.html',
    '/googlea8435fd020ce60ab.html'
]);
const PUBLIC_ASSET_EXTS = new Set([
    '.css', '.js', '.mjs', '.map',
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
    '.woff', '.woff2', '.ttf', '.otf',
    '.json', '.txt'
]);

function shouldProtectHtmlEntry(req) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false;
    if (req.path.startsWith('/api/')) return false;
    if (req.path.startsWith('/knight-dreams/')) return false;
    if (PUBLIC_HTML_PATHS.has(req.path)) return false;
    const ext = path.extname(req.path).toLowerCase();
    if (PUBLIC_ASSET_EXTS.has(ext)) return false;
    if (ext && ext !== '.html') return false;
    return true;
}

app.use((req, res, next) => {
    if (!shouldProtectHtmlEntry(req)) return next();
    return checkHtmlAuth(req, res, next);
});

app.use(express.static(FRONTEND_DIR, { index: false }));
app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'assets/icon.ico'));
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

// 登录页未登录可访问，用根 package.json 版本号对齐 GitHub/electron-builder 打包版本。
app.get('/api/app-version', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
        name: appPackage.productName || appPackage.name || 'Tools Platform',
        version: appPackage.version || '0.0.0'
    });
});

// 旧 JSON -> SQLite 启动迁移报告。允许未登录访问，便于 Windows 打包版升级后定位数据迁移问题。
app.get('/api/migration-status', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(legacyJsonMigration.getLastMigrationReport());
});

// 开放静态图片访问，跳过 JWT 鉴权 (浏览器 <img> 标签不带 Auth header)
const { REPORT_DATA_DIR } = require('./models/report-store');
app.use('/api/db/images', express.static(path.join(REPORT_DATA_DIR, 'images')));
app.use('/api/uiv-auto-import', uivAutoImportRoutes);

app.use('/api', checkAuth); // Protect all /api/* (except login, which is handled inside checkAuth)

// Protect modifications: requireAdmin for all non-GET requests under uiv, sla, upload
app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/auth/')) return next();
    if (req.path.startsWith('/requirements')) return next(); // 需求管理内部自行控制权限
    if (req.path.startsWith('/surveys')) return next(); // 调查模板和提交由模块内部控制权限
    if (req.method === 'POST' && req.path === '/uiv/run-uivision-macro') return next(); // 只生成临时 runner，不修改业务数据
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
app.use('/api/external/metrics', externalMetricsRoutes); // 外部/移动端只读指标 API

// ============================================================
// 前端路由回退（SPA）
// ============================================================
app.get('/', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'pages/login.html'));
});
app.get('/uivf12', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'pages/uivf12.html'));
});
app.get('/sla', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'pages/sla.html'));
});
app.get('/report', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'pages/report.html'));
});
app.get('/expedite', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'pages/expedite.html'));
});
app.get('/monthly', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'pages/monthly.html'));
});
app.get('/bigscreen', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'pages/bigscreen.html'));
});
app.get('/requirements', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'pages/requirements.html'));
});
app.get('/praudit', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'pages/praudit.html'));
});
app.get('/storage', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'pages/storage.html'));
});
app.get('/db-explorer', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'pages/db-explorer.html'));
});
app.get('/privacy', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'pages/privacy.html'));
});
app.get('/terms', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'pages/terms.html'));
});
app.get('/frt', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'pages/frt.html'));
});
app.get('/tools/:slug', checkHtmlAuth, (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'pages/custom-tool.html'));
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
        setTimeout(() => {
            globalBackupRepo.startAutoBackupScheduler().catch(err => {
                console.error('[GLOBAL BACKUP] Failed to start scheduled backup:', err);
            });
        }, 1800);
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
