const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./store');
const { REPORT_DATA_DIR } = require('./report-store');

const TOOLS_DB_PATH = path.join(DATA_DIR, 'tools.db');
const REPORT_DB_PATH = path.join(REPORT_DATA_DIR, 'report.db');
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

function openReadOnlyDb(filePath) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(filePath)) return resolve(null);
        const db = new sqlite3.Database(filePath, sqlite3.OPEN_READONLY, error => error ? reject(error) : resolve(db));
    });
}

function dbAll(db, sql, params = []) {
    if (!db) return Promise.resolve([]);
    return new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
    });
}

function dbGet(db, sql, params = []) {
    if (!db) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
        db.get(sql, params, (error, row) => error ? reject(error) : resolve(row));
    });
}

function closeDb(db) {
    return new Promise(resolve => {
        if (!db) return resolve();
        db.close(() => resolve());
    });
}

function safeJson(value, fallback = {}) {
    try {
        const parsed = JSON.parse(value || '');
        return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (_error) {
        return fallback;
    }
}

function stableId(prefix, ...parts) {
    const digest = crypto.createHash('sha1').update(parts.map(item => String(item || '')).join('\u0000')).digest('hex').slice(0, 14);
    return `${prefix}:${digest}`;
}

function finiteOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function hasValue(value) {
    return value !== null && value !== undefined && String(value).trim() !== '';
}

function hasMetricValue(value) {
    return hasValue(value) && !['--', '-'].includes(String(value).trim());
}

function normalizeMonth(value, fallback) {
    const month = Number(value);
    return Number.isInteger(month) && month >= 1 && month <= 12 ? month : fallback;
}

function targetCandidateScore(item, month) {
    return (hasValue(item.extra?.[String(month)]) ? 8 : 0)
        + (item.weight !== null ? 4 : 0)
        + (item.target_type ? 2 : 0)
        + (item.extra?.categoryTargets?.[String(month)] ? 2 : 0);
}

function buildRule(target, month) {
    if (!target) return null;
    const extra = target.extra || {};
    const monthlyTargets = {};
    MONTHS.forEach(item => {
        if (hasValue(extra[String(item)])) monthlyTargets[item] = extra[String(item)];
    });
    const categoryTargets = extra.categoryTargets && typeof extra.categoryTargets === 'object'
        ? extra.categoryTargets
        : {};
    return {
        targetKey: target.target_key,
        condition: target.target_type || 'gte',
        weight: finiteOrNull(target.weight),
        isPercent: target.is_percent === 1,
        autoFill: target.auto_fill === null ? null : target.auto_fill === 1,
        proportionalScoring: Boolean(extra.proportionalScoring),
        overachievementScoring: Boolean(extra.overachievementScoring),
        exceedBy: finiteOrNull(target.exceed_by),
        bonus: finiteOrNull(target.bonus),
        monthTarget: hasValue(extra[String(month)]) ? extra[String(month)] : null,
        monthlyTargets,
        categoryTargets
    };
}

function addSubMetric(map, metricLabel, category, details = {}) {
    if (!metricLabel || !category || category === '整体') return;
    if (!map.has(metricLabel)) map.set(metricLabel, new Map());
    const categoryMap = map.get(metricLabel);
    const previous = categoryMap.get(category) || {};
    categoryMap.set(category, {
        category,
        label: details.label || previous.label || category,
        sourceField: details.sourceField || previous.sourceField || null,
        sourceValue: details.sourceValue || previous.sourceValue || null,
        latestValue: hasValue(details.latestValue) ? details.latestValue : previous.latestValue
    });
}

async function getMetricGraph(options = {}) {
    const toolsDb = await openReadOnlyDb(TOOLS_DB_PATH);
    const reportDb = await openReadOnlyDb(REPORT_DB_PATH);
    try {
        const latestSnapshot = await dbGet(reportDb, 'SELECT id, snapshot_id, month, created_at FROM ReportSnapshots ORDER BY id DESC LIMIT 1');
        const month = normalizeMonth(options.month, normalizeMonth(latestSnapshot?.month, new Date().getMonth() + 1));
        const [groupRows, groupItemRows, targetRows, prefRows, latestMonthSnapshot, historyRows, snapshotStats] = await Promise.all([
            dbAll(toolsDb, 'SELECT id, group_key, name, sort_order FROM sla_groups ORDER BY sort_order, id'),
            dbAll(toolsDb, 'SELECT group_id, item_name, item_sort_order FROM sla_group_items ORDER BY group_id, item_sort_order, id'),
            dbAll(toolsDb, `SELECT target_key, label, target_type, weight, auto_fill, is_percent, exceed_by, bonus, extra_config_json
                            FROM sla_targets WHERE label IS NOT NULL AND TRIM(label) <> '' ORDER BY label, target_key`),
            dbAll(toolsDb, `SELECT pref_key, payload_json FROM sla_prefs
                            WHERE pref_kind = 'schema' AND payload_json LIKE '%customMetrics%'`),
            dbGet(reportDb, 'SELECT id, snapshot_id, month, created_at, raw_data_json FROM ReportSnapshots WHERE month = ? ORDER BY id DESC LIMIT 1', [month]),
            dbAll(reportDb, `SELECT metric_label, cat_name, COUNT(DISTINCT snapshot_id) AS snapshot_count
                             FROM ReportMetricData WHERE month = ? GROUP BY metric_label, cat_name`, [month]),
            dbGet(reportDb, `SELECT COUNT(*) AS snapshot_count, MIN(created_at) AS first_at, MAX(created_at) AS latest_at
                             FROM ReportSnapshots WHERE month = ?`, [month])
        ]);

        const groupByDbId = new Map(groupRows.map(row => [row.id, row]));
        const groupMetricLabels = new Map(groupRows.map(row => [row.name, []]));
        const metricGroup = new Map();
        groupItemRows.forEach(row => {
            const group = groupByDbId.get(row.group_id);
            if (!group || !row.item_name) return;
            groupMetricLabels.get(group.name).push(row.item_name);
            if (!metricGroup.has(row.item_name)) metricGroup.set(row.item_name, group.name);
        });

        const targetsByLabel = new Map();
        targetRows.forEach(row => {
            const item = { ...row, extra: safeJson(row.extra_config_json, {}) };
            if (!targetsByLabel.has(row.label)) targetsByLabel.set(row.label, []);
            targetsByLabel.get(row.label).push(item);
        });
        const selectedTargets = new Map();
        targetsByLabel.forEach((items, label) => {
            selectedTargets.set(label, [...items].sort((a, b) => targetCandidateScore(b, month) - targetCandidateScore(a, month))[0]);
        });

        const metricLabels = new Set([...metricGroup.keys(), ...selectedTargets.keys()]);
        const subMetrics = new Map();
        prefRows.forEach(row => {
            const payload = safeJson(row.payload_json, {});
            (Array.isArray(payload.customMetrics) ? payload.customMetrics : []).forEach(metric => {
                if (!metric?.label) return;
                metricLabels.add(metric.label);
                (Array.isArray(metric.subMetrics) ? metric.subMetrics : []).forEach(sub => {
                    addSubMetric(subMetrics, metric.label, sub?.category, {
                        label: sub?.label && sub.label !== metric.label ? `${sub.category} · ${sub.label}` : sub?.category,
                        sourceField: sub?.colZ || null,
                        sourceValue: sub?.valY || null
                    });
                });
            });
        });

        const rawSnapshot = safeJson(latestMonthSnapshot?.raw_data_json, {});
        (Array.isArray(rawSnapshot.topMetrics) ? rawSnapshot.topMetrics : []).forEach(metric => {
            if (!metric?.label) return;
            metricLabels.add(metric.label);
            (Array.isArray(metric.subMetrics) ? metric.subMetrics : []).forEach(sub => {
                addSubMetric(subMetrics, metric.label, sub?.category, { latestValue: sub?.value });
            });
        });
        const historyCount = new Map();
        historyRows.forEach(row => {
            if (!row.metric_label) return;
            metricLabels.add(row.metric_label);
            const key = `${row.metric_label}\u0000${row.cat_name || ''}`;
            historyCount.set(key, Number(row.snapshot_count) || 0);
            addSubMetric(subMetrics, row.metric_label, row.cat_name);
        });

        const ungroupedLabels = [...metricLabels].filter(label => !metricGroup.has(label)).sort((a, b) => a.localeCompare(b, 'zh-CN'));
        if (ungroupedLabels.length) groupMetricLabels.set('未分组', ungroupedLabels);
        const orderedGroups = [
            ...groupRows.map(row => ({ key: row.group_key, name: row.name, sortOrder: row.sort_order })),
            ...(ungroupedLabels.length ? [{ key: 'ungrouped', name: '未分组', sortOrder: 9999 }] : [])
        ];

        const nodes = [{
            id: 'metric-root',
            type: 'metricRoot',
            label: `${month}月指标规则`,
            month,
            size: 34
        }];
        const edges = [];
        let subMetricCount = 0;
        let configuredRuleCount = 0;
        orderedGroups.forEach(group => {
            const labels = (groupMetricLabels.get(group.name) || [])
                .filter((label, index, list) => list.indexOf(label) === index)
                .filter(label => metricGroup.get(label) === group.name || group.name === '未分组');
            if (!labels.length) return;
            const groupId = stableId('metric-category', group.name);
            nodes.push({ id: groupId, type: 'metricCategory', label: group.name, group: group.name, size: 18 + Math.min(12, labels.length) });
            edges.push({ source: 'metric-root', target: groupId, type: 'contains' });
            labels.forEach(metricLabel => {
                const target = selectedTargets.get(metricLabel);
                const rule = buildRule(target, month);
                const children = [...(subMetrics.get(metricLabel)?.values() || [])];
                const metricId = stableId('metric', metricLabel);
                if (rule) configuredRuleCount += 1;
                nodes.push({
                    id: metricId,
                    type: 'metric',
                    label: metricLabel,
                    group: group.name,
                    size: 10 + Math.min(8, children.length * 1.4),
                    month,
                    rule,
                    subMetricCount: children.length,
                    historySnapshotCount: Math.max(0, ...historyRows.filter(row => row.metric_label === metricLabel).map(row => Number(row.snapshot_count) || 0))
                });
                edges.push({ source: groupId, target: metricId, type: 'contains' });
                children.forEach(child => {
                    const subId = stableId('submetric', metricLabel, child.category);
                    subMetricCount += 1;
                    nodes.push({
                        id: subId,
                        type: 'submetric',
                        label: child.label || child.category,
                        category: child.category,
                        metricLabel,
                        group: group.name,
                        size: 5,
                        latestValue: child.latestValue,
                        sourceField: child.sourceField,
                        sourceValue: child.sourceValue,
                        historySnapshotCount: historyCount.get(`${metricLabel}\u0000${child.category}`) || 0
                    });
                    edges.push({ source: metricId, target: subId, type: 'contains' });
                });
            });
        });

        return {
            mode: 'metrics',
            month,
            availableMonths: MONTHS,
            nodes,
            edges,
            stats: {
                categories: nodes.filter(node => node.type === 'metricCategory').length,
                metrics: nodes.filter(node => node.type === 'metric').length,
                subMetrics: subMetricCount,
                configuredRules: configuredRuleCount,
                snapshots: Number(snapshotStats?.snapshot_count) || 0
            },
            snapshot: latestMonthSnapshot ? {
                snapshotId: latestMonthSnapshot.snapshot_id,
                createdAt: latestMonthSnapshot.created_at
            } : null,
            historicalRule: '历史值读取 ReportMetricData 已保存快照；当前月份规则只用于展示，不重算历史结果。',
            source: 'backend/data/tools.db + data/report.db',
            readOnly: true
        };
    } finally {
        await Promise.all([closeDb(toolsDb), closeDb(reportDb)]);
    }
}

function historyRowsToPayload(rows) {
    const seriesMap = new Map();
    rows.forEach(row => {
        const category = row.cat_name || '整体';
        if (!seriesMap.has(category)) seriesMap.set(category, []);
        seriesMap.get(category).push({
            snapshotId: row.snapshot_id,
            month: Number(row.month),
            createdAt: row.created_at,
            value: row.raw_val,
            numericValue: hasMetricValue(row.raw_val) ? finiteOrNull(row.num_val) : null,
            target: row.target_val,
            isFailing: row.is_failing === null || row.is_failing === undefined ? null : Number(row.is_failing) === 1,
            earnedScore: finiteOrNull(row.earned_score),
            proportionalScoring: Number(row.proportional_scoring) === 1,
            completionRatio: finiteOrNull(row.completion_ratio)
        });
    });
    return [...seriesMap.entries()].map(([category, points]) => ({ category, points }));
}

async function getMetricHistory(options = {}) {
    const metric = String(options.metric || '').trim();
    if (!metric || metric.length > 180) throw new Error('指标名称无效');
    const category = String(options.category || '').trim();
    const month = normalizeMonth(options.month, new Date().getMonth() + 1);
    const reportDb = await openReadOnlyDb(REPORT_DB_PATH);
    if (!reportDb) return { metric, category: category || null, month, series: [], snapshots: 0, source: 'data/report.db', readOnly: true };
    try {
        const params = [metric, month];
        let categorySql = '';
        if (category) {
            categorySql = ' AND m.cat_name = ?';
            params.push(category);
        }
        const rows = await dbAll(reportDb, `
            SELECT * FROM (
                SELECT s.id AS snapshot_order, s.snapshot_id, s.month, s.created_at,
                       m.cat_name, m.raw_val, m.num_val, m.target_val, m.is_failing,
                       m.earned_score, m.proportional_scoring, m.completion_ratio
                FROM ReportSnapshots s
                JOIN ReportMetricData m
                  ON m.snapshot_id = s.snapshot_id AND (m.month = s.month OR m.month IS NULL)
                WHERE m.metric_label = ? AND s.month = ?${categorySql}
                ORDER BY s.id DESC, m.cat_name
                LIMIT 320
            ) ORDER BY snapshot_order ASC, cat_name`, params);
        let series = historyRowsToPayload(rows);

        if (!series.length) {
            const snapshots = await dbAll(reportDb, `SELECT snapshot_id, month, created_at, raw_data_json
                                                      FROM ReportSnapshots WHERE month = ? ORDER BY id ASC LIMIT 80`, [month]);
            const fallbackRows = [];
            snapshots.forEach(snapshot => {
                const raw = safeJson(snapshot.raw_data_json, {});
                const item = (Array.isArray(raw.topMetrics) ? raw.topMetrics : []).find(entry => entry?.label === metric);
                if (!item) return;
                if (category) {
                    const sub = (Array.isArray(item.subMetrics) ? item.subMetrics : []).find(entry => entry?.category === category);
                    if (sub) fallbackRows.push({ ...snapshot, cat_name: category, raw_val: sub.value });
                } else if (hasValue(item.value)) {
                    fallbackRows.push({ ...snapshot, cat_name: '整体', raw_val: item.value });
                }
            });
            series = historyRowsToPayload(fallbackRows);
        }

        const snapshotIds = new Set(series.flatMap(item => item.points.map(point => point.snapshotId)));
        return {
            metric,
            category: category || null,
            month,
            series,
            snapshots: snapshotIds.size,
            historicalRule: '展示入库时保存的原始值、目标、达标状态和得分，不按当前规则重算。',
            source: 'data/report.db: ReportSnapshots, ReportMetricData',
            readOnly: true
        };
    } finally {
        await closeDb(reportDb);
    }
}

module.exports = {
    TOOLS_DB_PATH,
    REPORT_DB_PATH,
    getMetricGraph,
    getMetricHistory
};
