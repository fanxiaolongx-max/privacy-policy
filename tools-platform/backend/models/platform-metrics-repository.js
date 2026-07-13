const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { run, get, all } = require('./app-db');
const { DATA_DIR } = require('./store');
const { REPORT_DATA_DIR } = require('./report-store');
const customToolsRepo = require('./custom-tools-repository');

const BUILTIN_TOOL_COUNT = 11;
const REPORT_DB_PATH = path.join(REPORT_DATA_DIR, 'report.db');
const REQUIREMENTS_DB_PATH = path.join(DATA_DIR, 'requirements.db');

let initPromise = null;

async function ensureReady() {
    if (!initPromise) {
        initPromise = run(`
            CREATE TABLE IF NOT EXISTS platform_usage_daily (
                tool_key TEXT NOT NULL,
                usage_date TEXT NOT NULL,
                open_count INTEGER NOT NULL DEFAULT 0,
                first_opened_at TEXT NOT NULL,
                last_opened_at TEXT NOT NULL,
                PRIMARY KEY (tool_key, usage_date)
            )
        `).catch(err => {
            initPromise = null;
            throw err;
        });
    }
    return initPromise;
}

function normalizeToolKey(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9:_-]+/g, '-')
        .slice(0, 80);
}

async function trackOpen(toolKey) {
    const safeKey = normalizeToolKey(toolKey);
    if (!safeKey) throw new Error('工具标识不能为空');
    await ensureReady();
    const now = new Date().toISOString();
    const date = now.slice(0, 10);
    await run(`
        INSERT INTO platform_usage_daily
            (tool_key, usage_date, open_count, first_opened_at, last_opened_at)
        VALUES (?, ?, 1, ?, ?)
        ON CONFLICT(tool_key, usage_date) DO UPDATE SET
            open_count = platform_usage_daily.open_count + 1,
            last_opened_at = excluded.last_opened_at
    `, [safeKey, date, now, now]);
    return { toolKey: safeKey, tracked: true };
}

function queryExternalDb(dbPath, sql, params = []) {
    return new Promise(resolve => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, err => {
            if (err) return resolve(null);
            db.get(sql, params, (queryErr, row) => {
                db.close(() => {});
                resolve(queryErr ? null : row);
            });
        });
    });
}

async function safeGet(sql, params = []) {
    try {
        return await get(sql, params);
    } catch (err) {
        return null;
    }
}

async function getSummary() {
    await ensureReady();

    const [
        scriptsRow,
        historyRow,
        slaSnapshotsRow,
        frtSnapshotsRow,
        targetRow,
        auditConfigRows,
        usageRows,
        usageTotalRow,
        appTableRow,
        aiChatRow,
        aiAlertRow,
        reportRow,
        requirementsRow,
        customTools
    ] = await Promise.all([
        safeGet('SELECT COUNT(1) AS count FROM uiv_scripts'),
        safeGet(`SELECT
            COUNT(1) AS count,
            SUM(CASE WHEN action LIKE '%导入%' THEN 1 ELSE 0 END) AS imports,
            SUM(CASE WHEN action LIKE '%导出%' THEN 1 ELSE 0 END) AS exports
            FROM upload_history`),
        safeGet('SELECT COUNT(1) AS count FROM sla_snapshots'),
        safeGet('SELECT COUNT(1) AS count FROM frt_snapshots'),
        safeGet('SELECT COUNT(1) AS count FROM sla_targets'),
        all('SELECT checkpoints FROM praudit_configs').catch(() => []),
        all(`SELECT tool_key, SUM(open_count) AS open_count
             FROM platform_usage_daily GROUP BY tool_key`).catch(() => []),
        safeGet('SELECT COALESCE(SUM(open_count), 0) AS count FROM platform_usage_daily'),
        safeGet("SELECT COUNT(1) AS count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"),
        safeGet(`SELECT
            (SELECT COUNT(1) FROM ai_chat_sessions) AS sessions,
            (SELECT COUNT(1) FROM ai_chat_messages WHERE role = 'user') AS questions,
            (SELECT COUNT(1) FROM ai_chat_messages WHERE role = 'model') AS answers,
            (SELECT COALESCE(SUM(tokens), 0) FROM ai_chat_messages WHERE role = 'model') AS tokens,
            (SELECT COALESCE(SUM(cost), 0) FROM ai_chat_messages WHERE role = 'model') AS cost_mao,
            (SELECT COUNT(DISTINCT page_path) FROM ai_chat_sessions WHERE page_path <> '') AS covered_pages,
            (SELECT COUNT(1) FROM ai_question_suggestions WHERE enabled = 1) AS suggestions`),
        safeGet(`SELECT
            COUNT(1) AS analyzed,
            SUM(CASE WHEN ai_status = 'done' THEN 1 ELSE 0 END) AS model_analyzed,
            SUM(CASE WHEN ai_status = 'fallback_done' THEN 1 ELSE 0 END) AS rule_analyzed
            FROM alert_center_events
            WHERE ai_analyzed_at IS NOT NULL`),
        queryExternalDb(REPORT_DB_PATH, `SELECT
            (SELECT COUNT(1) FROM ReportMetricData) AS metric_checks,
            (SELECT COUNT(1) FROM ReportMetricData WHERE is_failing = 1) AS failing_checks,
            (SELECT COUNT(DISTINCT cat_name) FROM ReportMetricData) AS customer_groups,
            (SELECT COUNT(DISTINCT month) FROM ReportMetricData) AS report_months,
            (SELECT COUNT(1) FROM ReportSnapshots) AS report_snapshots,
            (SELECT COUNT(1) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%') AS table_count`),
        queryExternalDb(REQUIREMENTS_DB_PATH, `SELECT
            COUNT(1) AS count,
            SUM(CASE WHEN status IN ('完成','已完成','关闭','已关闭') THEN 1 ELSE 0 END) AS completed,
            (SELECT COUNT(1) FROM RequirementLogs) AS transitions
            FROM Requirements`),
        customToolsRepo.listTools().catch(() => [])
    ]);

    const scripts = Number(scriptsRow?.count || 0);
    const history = Number(historyRow?.count || 0);
    const imports = Number(historyRow?.imports || 0);
    const exportsCount = Number(historyRow?.exports || 0);
    const slaSnapshots = Number(slaSnapshotsRow?.count || 0);
    const frtSnapshots = Number(frtSnapshotsRow?.count || 0);
    const targets = Number(targetRow?.count || 0);
    const metricChecks = Number(reportRow?.metric_checks || 0);
    const failingChecks = Number(reportRow?.failing_checks || 0);
    const reportSnapshots = Number(reportRow?.report_snapshots || 0);
    const reportMonths = Number(reportRow?.report_months || 0);
    const customerGroups = Number(reportRow?.customer_groups || 0);
    const trackedOpens = Number(usageTotalRow?.count || 0);
    const aiQuestions = Number(aiChatRow?.questions || 0);
    const aiAnswers = Number(aiChatRow?.answers || 0);
    const aiAnalyzedAlerts = Number(aiAlertRow?.analyzed || 0);
    const aiSavedMinutes = aiAnswers * 8 + aiAnalyzedAlerts * 3;
    const auditCheckpoints = auditConfigRows.reduce((sum, row) => {
        try {
            const items = JSON.parse(row.checkpoints || '[]');
            return sum + (Array.isArray(items) ? items.length : 0);
        } catch (err) {
            return sum;
        }
    }, 0);

    // 保守价值折算：指标手工核对 2 分钟/项，脚本手工编制 90 分钟/个，
    // 数据导入整理 30 分钟/次，报表整理 45 分钟/份，FRT 核算 60 分钟/次。
    const manualEquivalentMinutes = (
        metricChecks * 2 + scripts * 90 + imports * 30 +
        reportSnapshots * 45 + frtSnapshots * 60
    );
    // 平台执行仍需复核和操作时间，不按 100% 节省计算。
    const savedMinutes = (
        metricChecks * 1.9 + scripts * 75 + imports * 25 +
        reportSnapshots * 40 + frtSnapshots * 50
    );

    const openCounts = Object.fromEntries(usageRows.map(row => [row.tool_key, Number(row.open_count || 0)]));
    const customToolCount = Array.isArray(customTools) ? customTools.length : 0;
    const toolStats = {
        uivf12: { primary: scripts, labelKey: 'home.impact.automationScripts', secondary: Math.round(scripts * 75 / 60), secondaryLabelKey: 'home.impact.hoursSaved' },
        sla: { primary: imports, labelKey: 'home.impact.dataImports', secondary: slaSnapshots, secondaryLabelKey: 'home.impact.snapshotsStored' },
        report: { primary: metricChecks, labelKey: 'home.impact.metricChecks', secondary: reportSnapshots, secondaryLabelKey: 'home.impact.reportSnapshots' },
        expedite: { primary: failingChecks, labelKey: 'home.impact.weaknessesFound', secondary: reportSnapshots, secondaryLabelKey: 'home.impact.traceableSnapshots' },
        monthly: { primary: reportMonths, labelKey: 'home.impact.monthsStored', secondary: reportSnapshots, secondaryLabelKey: 'home.impact.historySnapshots' },
        bigscreen: { primary: customerGroups, labelKey: 'home.impact.customerGroups', secondary: metricChecks, secondaryLabelKey: 'home.impact.metricResults' },
        frt: { primary: frtSnapshots, labelKey: 'home.impact.autoCalculations', secondary: Math.round(frtSnapshots * 50 / 60), secondaryLabelKey: 'home.impact.hoursSaved' },
        requirements: { primary: Number(requirementsRow?.count || 0), labelKey: 'home.impact.requirementsManaged', secondary: Number(requirementsRow?.transitions || 0), secondaryLabelKey: 'home.impact.workflowTransitions' },
        praudit: { primary: auditCheckpoints, labelKey: 'home.impact.auditRules', secondary: auditConfigRows.length, secondaryLabelKey: 'home.impact.auditTemplates' },
        storage: { primary: Number(appTableRow?.count || 0) + Number(reportRow?.table_count || 0), labelKey: 'home.impact.tablesProtected', secondary: 2, secondaryLabelKey: 'home.impact.databasesGoverned' },
        'db-explorer': { primary: Number(appTableRow?.count || 0) + Number(reportRow?.table_count || 0), labelKey: 'home.impact.tablesVisible', secondary: 2, secondaryLabelKey: 'home.impact.coreDatabases' }
    };

    return {
        generatedAt: new Date().toISOString(),
        totals: {
            metricChecks,
            serviceCount: history + trackedOpens,
            manualEquivalentHours: Math.round(manualEquivalentMinutes / 60),
            savedHours: Math.round(savedMinutes / 60),
            efficiencyRate: manualEquivalentMinutes > 0 ? Math.round(savedMinutes / manualEquivalentMinutes * 100) : 0,
            onlineTools: BUILTIN_TOOL_COUNT + customToolCount,
            scripts,
            history,
            trackedOpens
        },
        toolStats,
        customToolStats: Object.fromEntries((customTools || []).map(tool => [
            tool.slug,
            { primary: openCounts[`custom:${tool.slug}`] || 0, labelKey: 'home.impact.totalOpens', secondary: 1, secondaryLabelKey: 'home.impact.onlineTool' }
        ])),
        ai: {
            applicationScenarios: 4,
            completedTasks: aiAnswers + aiAnalyzedAlerts,
            sessions: Number(aiChatRow?.sessions || 0),
            questions: aiQuestions,
            answers: aiAnswers,
            tokens: Number(aiChatRow?.tokens || 0),
            costCny: Number((Number(aiChatRow?.cost_mao || 0) / 10).toFixed(2)),
            coveredPages: Number(aiChatRow?.covered_pages || 0),
            suggestions: Number(aiChatRow?.suggestions || 0),
            analyzedAlerts: aiAnalyzedAlerts,
            modelAnalyzedAlerts: Number(aiAlertRow?.model_analyzed || 0),
            ruleAnalyzedAlerts: Number(aiAlertRow?.rule_analyzed || 0),
            savedHours: Math.round(aiSavedMinutes / 60)
        },
        methodology: {
            metricCheckMinutes: 2,
            scriptBuildMinutes: 90,
            dataImportMinutes: 30,
            reportMinutes: 45,
            frtCalculationMinutes: 60,
            aiAnswerMinutes: 8,
            aiAlertAnalysisMinutes: 3,
            note: '基于已入库业务量与保守人工处理时长折算，为管理口径估算值。'
        },
        supporting: { targets, exports: exportsCount }
    };
}

module.exports = { ensureReady, trackOpen, getSummary };
