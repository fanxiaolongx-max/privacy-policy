const { run, all } = require('./app-db');

const ALLOWED_WINDOWS = new Set([30, 90, 180]);
const LICENSE_WARNING_MS = 7 * 24 * 60 * 60 * 1000;
const LICENSE_CRITICAL_MS = 24 * 60 * 60 * 1000;

const SERVICE_DEFINITIONS = [
    {
        id: 'core',
        name: '平台核心服务',
        nameEn: 'Platform Core',
        description: '健康检查、导航、版本与平台指标',
        descriptionEn: 'Health, navigation, version and platform metrics',
        prefixes: ['/api/health', '/api/app-version', '/api/migration-status', '/api/nav-settings', '/api/platform-metrics']
    },
    {
        id: 'auth',
        name: '账号与授权',
        nameEn: 'Identity & Access',
        description: '登录、账号、安全策略与授权校验',
        descriptionEn: 'Login, accounts, security policy and licensing',
        prefixes: ['/api/auth', '/api/public/f12-license', '/api/desktop-license', '/api/desktop-licenses']
    },
    {
        id: 'automation',
        name: '数据抓取与自动化',
        nameEn: 'Capture & Automation',
        description: 'UI.Vision、F12 与网站适配请求',
        descriptionEn: 'UI.Vision, F12 and website adaptation requests',
        prefixes: ['/api/uiv', '/api/uiv-auto-import', '/api/uiv-ai-adapter']
    },
    {
        id: 'data',
        name: '数据与报表',
        nameEn: 'Data & Reporting',
        description: '导入、SLA、报表、核算与数据查询',
        descriptionEn: 'Imports, SLA, reports, calculations and data queries',
        prefixes: ['/api/sla', '/api/upload', '/api/db', '/api/frt', '/api/praudit', '/api/storage', '/api/db-explorer', '/api/requirements']
    },
    {
        id: 'ai',
        name: 'AI 服务',
        nameEn: 'AI Services',
        description: '模型调用、智能助手与 AI 配置',
        descriptionEn: 'Model calls, AI assistant and provider settings',
        prefixes: ['/api/ai', '/api/ai-settings']
    },
    {
        id: 'tools',
        name: '自定义工具服务',
        nameEn: 'Custom Tool Services',
        description: '自定义工具、胶片设计与调查服务',
        descriptionEn: 'Custom tools, slide design and survey services',
        prefixes: ['/api/custom-tools', '/api/slide-design', '/api/surveys']
    },
    {
        id: 'operations',
        name: '运维与告警',
        nameEn: 'Operations & Alerts',
        description: '备份、外部指标与系统告警',
        descriptionEn: 'Backup, external metrics and system alerts',
        prefixes: ['/api/global-backup', '/api/external/metrics', '/api/alert-center']
    }
];

let initPromise = null;

async function ensureReady() {
    if (!initPromise) {
        initPromise = run(`
            CREATE TABLE IF NOT EXISTS service_status_daily (
                service_key TEXT NOT NULL,
                status_date TEXT NOT NULL,
                request_count INTEGER NOT NULL DEFAULT 0,
                success_count INTEGER NOT NULL DEFAULT 0,
                client_error_count INTEGER NOT NULL DEFAULT 0,
                server_error_count INTEGER NOT NULL DEFAULT 0,
                total_duration_ms INTEGER NOT NULL DEFAULT 0,
                max_duration_ms INTEGER NOT NULL DEFAULT 0,
                last_status_code INTEGER,
                last_request_at TEXT NOT NULL,
                PRIMARY KEY (service_key, status_date)
            )
        `).catch(error => {
            initPromise = null;
            throw error;
        });
    }
    return initPromise;
}

function pathnameOf(value) {
    try {
        return new URL(String(value || ''), 'http://tools-platform.local').pathname;
    } catch (_) {
        return String(value || '').split('?')[0];
    }
}

function resolveService(pathname) {
    const safePath = pathnameOf(pathname);
    return SERVICE_DEFINITIONS.find(service => service.prefixes.some(prefix => safePath === prefix || safePath.startsWith(`${prefix}/`))) || SERVICE_DEFINITIONS[0];
}

function shouldTrackRequest(method, pathname) {
    const safePath = pathnameOf(pathname);
    if (String(method || '').toUpperCase() === 'OPTIONS') return false;
    return safePath.startsWith('/api/') && safePath !== '/api/platform-metrics/service-status';
}

async function trackRequest({ method, pathname, statusCode, durationMs, timestamp = new Date() }) {
    if (!shouldTrackRequest(method, pathname)) return { tracked: false };
    await ensureReady();
    const service = resolveService(pathname);
    const status = Number(statusCode) || 0;
    const duration = Math.max(0, Math.round(Number(durationMs) || 0));
    const success = status >= 200 && status < 400 ? 1 : 0;
    const clientError = status >= 400 && status < 500 ? 1 : 0;
    const serverError = status >= 500 ? 1 : 0;
    const requestTime = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const safeTime = Number.isFinite(requestTime.getTime()) ? requestTime : new Date();
    const iso = safeTime.toISOString();
    const date = iso.slice(0, 10);

    await run(`
        INSERT INTO service_status_daily (
            service_key, status_date, request_count, success_count,
            client_error_count, server_error_count, total_duration_ms,
            max_duration_ms, last_status_code, last_request_at
        ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(service_key, status_date) DO UPDATE SET
            request_count = service_status_daily.request_count + 1,
            success_count = service_status_daily.success_count + excluded.success_count,
            client_error_count = service_status_daily.client_error_count + excluded.client_error_count,
            server_error_count = service_status_daily.server_error_count + excluded.server_error_count,
            total_duration_ms = service_status_daily.total_duration_ms + excluded.total_duration_ms,
            max_duration_ms = MAX(service_status_daily.max_duration_ms, excluded.max_duration_ms),
            last_status_code = excluded.last_status_code,
            last_request_at = excluded.last_request_at
    `, [service.id, date, success, clientError, serverError, duration, duration, status, iso]);
    return { tracked: true, serviceKey: service.id, date };
}

function isoDateOffset(daysAgo) {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - daysAgo);
    return date.toISOString().slice(0, 10);
}

function dateRange(days) {
    const dates = [];
    for (let offset = days - 1; offset >= 0; offset -= 1) dates.push(isoDateOffset(offset));
    return dates;
}

function classifyDay(row) {
    if (!row || !Number(row.request_count || 0)) return 'no-data';
    if (Number(row.server_error_count || 0) > 0) return 'incident';
    if (Number(row.client_error_count || 0) > 0) return 'degraded';
    return 'operational';
}

function percent(numerator, denominator) {
    return denominator ? Number((numerator / denominator * 100).toFixed(2)) : null;
}

function summarizeRows(rows) {
    const summary = rows.reduce((result, row) => {
        result.requests += Number(row.request_count || 0);
        result.successes += Number(row.success_count || 0);
        result.clientErrors += Number(row.client_error_count || 0);
        result.serverErrors += Number(row.server_error_count || 0);
        result.totalDurationMs += Number(row.total_duration_ms || 0);
        result.maxDurationMs = Math.max(result.maxDurationMs, Number(row.max_duration_ms || 0));
        return result;
    }, { requests: 0, successes: 0, clientErrors: 0, serverErrors: 0, totalDurationMs: 0, maxDurationMs: 0 });
    summary.availability = percent(summary.requests - summary.serverErrors, summary.requests);
    summary.successRate = percent(summary.successes, summary.requests);
    summary.averageDurationMs = summary.requests ? Math.round(summary.totalDurationMs / summary.requests) : 0;
    return summary;
}

function summarizeLicenseStatus(status = {}, fallbackNow = Date.now()) {
    if (status.enabled !== true) {
        return {
            enabled: false,
            valid: true,
            state: 'not-applicable',
            reasonCode: 'WEB_RUNTIME',
            expiresAt: null,
            remainingMs: null,
            daysRemaining: null,
            hoursRemaining: null
        };
    }
    const suppliedNow = Number(status.trustedNow);
    const trustedNow = Number.isFinite(suppliedNow) ? suppliedNow : Number(fallbackNow) || Date.now();
    const suppliedExpiry = Number(status.expiresAt);
    const expiresAt = Number.isFinite(suppliedExpiry) && suppliedExpiry > 0 ? suppliedExpiry : null;
    const remainingMs = expiresAt == null ? 0 : Math.max(0, expiresAt - trustedNow);
    const valid = status.valid === true && remainingMs > 0;
    const state = !valid || remainingMs <= LICENSE_CRITICAL_MS
        ? 'incident'
        : remainingMs <= LICENSE_WARNING_MS ? 'degraded' : 'operational';
    return {
        enabled: true,
        valid,
        state,
        reasonCode: valid ? null : String(status.reasonCode || (remainingMs <= 0 ? 'EXPIRED' : 'LICENSE_INVALID')),
        expiresAt,
        remainingMs,
        daysRemaining: valid ? Math.ceil(remainingMs / (24 * 60 * 60 * 1000)) : 0,
        hoursRemaining: valid ? Math.ceil(remainingMs / (60 * 60 * 1000)) : 0,
        online: status.online === true
    };
}

async function getHistory(daysInput = 90) {
    await ensureReady();
    const requestedDays = Number(daysInput);
    const days = ALLOWED_WINDOWS.has(requestedDays) ? requestedDays : 90;
    const dates = dateRange(days);
    const rows = await all(`
        SELECT service_key, status_date, request_count, success_count,
               client_error_count, server_error_count, total_duration_ms,
               max_duration_ms, last_status_code, last_request_at
        FROM service_status_daily
        WHERE status_date BETWEEN ? AND ?
        ORDER BY status_date ASC, service_key ASC
    `, [dates[0], dates[dates.length - 1]]);
    const byService = new Map(SERVICE_DEFINITIONS.map(service => [service.id, new Map()]));
    rows.forEach(row => {
        if (byService.has(row.service_key)) byService.get(row.service_key).set(row.status_date, row);
    });

    const services = SERVICE_DEFINITIONS.map(service => {
        const serviceRows = dates.map(date => byService.get(service.id).get(date) || null);
        const history = serviceRows.map((row, index) => ({
            date: dates[index],
            state: classifyDay(row),
            requests: Number(row?.request_count || 0),
            successes: Number(row?.success_count || 0),
            clientErrors: Number(row?.client_error_count || 0),
            serverErrors: Number(row?.server_error_count || 0),
            averageDurationMs: row?.request_count ? Math.round(Number(row.total_duration_ms || 0) / Number(row.request_count)) : 0,
            maxDurationMs: Number(row?.max_duration_ms || 0),
            lastStatusCode: row?.last_status_code == null ? null : Number(row.last_status_code)
        }));
        return {
            id: service.id,
            name: service.name,
            nameEn: service.nameEn,
            description: service.description,
            descriptionEn: service.descriptionEn,
            currentState: history[history.length - 1].state,
            summary: summarizeRows(serviceRows.filter(Boolean)),
            history
        };
    });
    const overall = summarizeRows(rows);
    const todayStates = services.map(service => service.currentState);
    overall.currentState = todayStates.includes('incident') ? 'incident'
        : todayStates.includes('degraded') ? 'degraded'
            : todayStates.includes('operational') ? 'operational' : 'no-data';

    return {
        generatedAt: new Date().toISOString(),
        days,
        startDate: dates[0],
        endDate: dates[dates.length - 1],
        overall,
        services
    };
}

module.exports = {
    ALLOWED_WINDOWS,
    SERVICE_DEFINITIONS,
    ensureReady,
    resolveService,
    shouldTrackRequest,
    trackRequest,
    classifyDay,
    summarizeRows,
    summarizeLicenseStatus,
    getHistory
};
