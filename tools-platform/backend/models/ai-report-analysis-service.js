const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { REPORT_DATA_DIR } = require('./report-store');

const REPORT_DB_PATH = path.join(REPORT_DATA_DIR, 'report.db');
const MAX_METRIC_ROWS = 5000;
const DATA_SCOPE_RE = /报表|月报|指标|得分|排名|趋势|差距|gap|快照|客户群|合规率|运营|异常|短板/i;
const DATA_ACTION_RE = /当前|最新|本月|上月|未达标|达标|多少|哪些|分析|总结|对比|变化|下降|上升|改善|异常|排名|趋势|差距|gap|(?:20\d{2}[-/.])?(?:1[0-2]|0?[1-9])\s*月/i;
const IMPLEMENTATION_QUESTION_RE = /怎么实现|代码|文件|接口|路由|数据源|存在哪|读取逻辑|计算逻辑/i;

function openReadOnlyDb() {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(REPORT_DB_PATH)) return resolve(null);
        const db = new sqlite3.Database(REPORT_DB_PATH, sqlite3.OPEN_READONLY, error => {
            if (error) return reject(error);
            resolve(db);
        });
    });
}

function dbGet(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (error, row) => error ? reject(error) : resolve(row));
    });
}

function dbAll(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
    });
}

function closeDb(db) {
    return new Promise(resolve => {
        if (!db) return resolve();
        db.close(() => resolve());
    });
}

function parseRequestedMonth(question) {
    const text = String(question || '');
    const explicit = text.match(/(?:^|[^\d])(?:20\d{2}[-/.])?(1[0-2]|0?[1-9])\s*月/);
    if (explicit) return Number(explicit[1]);
    const iso = text.match(/20\d{2}[-/.](1[0-2]|0[1-9])(?:\D|$)/);
    return iso ? Number(iso[1]) : null;
}

function shouldAnalyze(question) {
    const text = String(question || '');
    if (!DATA_SCOPE_RE.test(text)) return false;
    if (IMPLEMENTATION_QUESTION_RE.test(text) && !DATA_ACTION_RE.test(text)) return false;
    return DATA_ACTION_RE.test(text);
}

function finiteOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function round(value, digits = 2) {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    const scale = 10 ** digits;
    return Math.round(number * scale) / scale;
}

function buildMetricStats(metrics) {
    const total = metrics.length;
    const failing = metrics.filter(item => Number(item.is_failing) === 1);
    return {
        totalMetrics: total,
        failingMetrics: failing.length,
        passingMetrics: Math.max(0, total - failing.length),
        complianceRate: total ? round(((total - failing.length) / total) * 100) : null
    };
}

async function loadSnapshotBundle(db, snapshot) {
    if (!snapshot) return null;
    const month = snapshot.month;
    const categoryScores = await dbAll(
        db,
        `SELECT cat_name, base_score, manual_score, final_score
         FROM ReportCategoryScores
         WHERE snapshot_id = ? AND (month = ? OR month IS NULL)
         ORDER BY final_score DESC
         LIMIT 500`,
        [snapshot.snapshot_id, month]
    );
    const metrics = await dbAll(
        db,
        `SELECT cat_name, metric_label, weight, target_val, raw_val, num_val,
                is_failing, gap, earned_score, proportional_scoring, completion_ratio
         FROM ReportMetricData
         WHERE snapshot_id = ? AND (month = ? OR month IS NULL)
         LIMIT ?`,
        [snapshot.snapshot_id, month, MAX_METRIC_ROWS]
    );
    const stats = buildMetricStats(metrics);
    const failures = metrics
        .filter(item => Number(item.is_failing) === 1)
        .sort((a, b) => (Number(b.weight) || 0) - (Number(a.weight) || 0))
        .slice(0, 20)
        .map(item => ({
            customerGroup: item.cat_name,
            metric: item.metric_label,
            weight: finiteOrNull(item.weight),
            target: item.target_val,
            actual: item.raw_val,
            numericValue: finiteOrNull(item.num_val),
            gap: item.gap,
            earnedScore: finiteOrNull(item.earned_score),
            proportionalScoring: Number(item.proportional_scoring) === 1,
            completionRatio: finiteOrNull(item.completion_ratio)
        }));
    const rankings = categoryScores.slice(0, 30).map((item, index) => ({
        rank: index + 1,
        customerGroup: item.cat_name,
        baseScore: finiteOrNull(item.base_score),
        manualScore: finiteOrNull(item.manual_score),
        finalScore: finiteOrNull(item.final_score)
    }));
    return {
        snapshot: {
            snapshotId: snapshot.snapshot_id,
            month,
            createdAt: snapshot.created_at,
            storedAt: snapshot.stored_at || null,
            standardTotalScore: finiteOrNull(snapshot.standard_total_score)
        },
        stats,
        rankings,
        topFailures: failures
    };
}

async function analyzeQuestion(question) {
    if (!shouldAnalyze(question)) return null;
    const requestedMonth = parseRequestedMonth(question);
    const db = await openReadOnlyDb();
    if (!db) {
        return {
            available: false,
            reason: '报表数据库尚未创建',
            source: 'data/report.db'
        };
    }

    try {
        const latestSql = requestedMonth
            ? `SELECT id, snapshot_id, month, created_at, stored_at, standard_total_score
               FROM ReportSnapshots WHERE month = ? ORDER BY id DESC LIMIT 1`
            : `SELECT id, snapshot_id, month, created_at, stored_at, standard_total_score
               FROM ReportSnapshots ORDER BY id DESC LIMIT 1`;
        const latest = await dbGet(db, latestSql, requestedMonth ? [requestedMonth] : []);
        if (!latest) {
            return {
                available: false,
                reason: requestedMonth ? `没有找到 ${requestedMonth} 月的入库报表` : '尚无入库报表',
                requestedMonth,
                source: 'data/report.db'
            };
        }

        const current = await loadSnapshotBundle(db, latest);
        const previous = await dbGet(
            db,
            `SELECT id, snapshot_id, month, created_at, stored_at, standard_total_score
             FROM ReportSnapshots
             WHERE id < ? AND month = ?
             ORDER BY id DESC LIMIT 1`,
            [latest.id, latest.month]
        );
        const previousBundle = previous ? await loadSnapshotBundle(db, previous) : null;
        const trendRows = await dbAll(
            db,
            `SELECT s.id, s.snapshot_id, s.month, s.created_at, s.standard_total_score,
                    COUNT(m.id) AS total_metrics,
                    SUM(CASE WHEN m.is_failing = 1 THEN 1 ELSE 0 END) AS failing_metrics
             FROM ReportSnapshots s
             LEFT JOIN ReportMetricData m
               ON m.snapshot_id = s.snapshot_id AND (m.month = s.month OR m.month IS NULL)
             WHERE s.month = ?
             GROUP BY s.id
             ORDER BY s.id DESC
             LIMIT 12`,
            [latest.month]
        );
        const trends = trendRows.reverse().map(row => ({
            snapshotId: row.snapshot_id,
            month: row.month,
            createdAt: row.created_at,
            totalScore: finiteOrNull(row.standard_total_score),
            totalMetrics: Number(row.total_metrics) || 0,
            failingMetrics: Number(row.failing_metrics) || 0
        }));

        return {
            available: true,
            requestedMonth,
            selectionRule: requestedMonth ? '指定月份的最新入库快照' : '全部月份中的最新入库快照',
            historicalRule: '历史得分使用入库时保存的结果，不按当前目标或计分规则重算。',
            current,
            previous: previousBundle,
            comparison: previousBundle ? {
                totalScoreChange: current.snapshot.standardTotalScore !== null && previousBundle.snapshot.standardTotalScore !== null
                    ? round(current.snapshot.standardTotalScore - previousBundle.snapshot.standardTotalScore)
                    : null,
                failingMetricChange: current.stats.failingMetrics - previousBundle.stats.failingMetrics,
                complianceRateChange: current.stats.complianceRate !== null && previousBundle.stats.complianceRate !== null
                    ? round(current.stats.complianceRate - previousBundle.stats.complianceRate)
                    : null
            } : null,
            trends,
            source: 'data/report.db: ReportSnapshots, ReportCategoryScores, ReportMetricData',
            readOnly: true
        };
    } finally {
        await closeDb(db);
    }
}

function formatAnalysisForPrompt(analysis) {
    if (!analysis) return '';
    return JSON.stringify(analysis, null, 2);
}

module.exports = {
    REPORT_DB_PATH,
    shouldAnalyze,
    parseRequestedMonth,
    analyzeQuestion,
    formatAnalysisForPrompt,
    buildMetricStats
};
