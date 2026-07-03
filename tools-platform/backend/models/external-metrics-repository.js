const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const { ensureReportDataDir, REPORT_DATA_DIR } = require('./report-store');
const prefsRepo = require('./sla-prefs-repository');
const targetsRepo = require('./sla-targets-repository');

ensureReportDataDir();

const dbPath = path.join(REPORT_DATA_DIR, 'report.db');
const db = new sqlite3.Database(dbPath);

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row || null);
        });
    });
}

function parsePositiveInt(value, fallback, max) {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(parsed, max);
}

function normalizeMonth(value) {
    if (value === undefined || value === null || value === '') return null;
    const month = parseInt(value, 10);
    if (!Number.isFinite(month) || month < 1 || month > 12) return null;
    return month;
}

function normalizeSnapshot(row, { includeRaw = false } = {}) {
    if (!row) return null;
    const out = {
        snapshot_id: row.snapshot_id,
        month: row.month,
        created_at: row.created_at,
        standard_total_score: row.standard_total_score,
        image_path: row.image_path || null,
        excel_path: row.excel_path || null
    };
    if (includeRaw) {
        try {
            out.raw_data = row.raw_data_json ? JSON.parse(row.raw_data_json) : null;
        } catch (err) {
            out.raw_data = null;
            out.raw_data_parse_error = true;
        }
    }
    return out;
}

function getSourceId(prefKey, pref) {
    return (pref && pref._sourceMeta && pref._sourceMeta.secId)
        || String(prefKey || '').replace(/^sla_prefs_/, '');
}

function normalizeTargetConfig(targetKey, targetConfig) {
    if (!targetConfig) return null;
    const monthlyTargets = {};
    Object.keys(targetConfig).forEach(key => {
        if (/^(?:[1-9]|1[0-2])$/.test(String(key))) {
            monthlyTargets[key] = targetConfig[key];
        }
    });
    return {
        target_key: targetKey || null,
        label: targetConfig.label || null,
        condition: targetConfig.type || null,
        weight: targetConfig.weight === undefined ? null : targetConfig.weight,
        auto_fill: targetConfig.autoFill === undefined ? null : Boolean(targetConfig.autoFill),
        is_percent: targetConfig.isPercent === undefined ? null : Boolean(targetConfig.isPercent),
        exceed_by: targetConfig.exceedBy === undefined ? null : targetConfig.exceedBy,
        bonus: targetConfig.bonus === undefined ? null : targetConfig.bonus,
        proportional_scoring: targetConfig.proportionalScoring === undefined ? null : Boolean(targetConfig.proportionalScoring),
        monthly_targets: monthlyTargets
    };
}

function getMetricDisplayLabel(rule, parentRule) {
    return (rule && rule.label) || (parentRule && parentRule.label) || '';
}

async function getMetricSchema() {
    const [{ items: prefs }, { items: targets }] = await Promise.all([
        prefsRepo.getPrefsObject(),
        targetsRepo.getTargets()
    ]);
    const sources = [];
    const metrics = [];
    const byLabel = new Map();
    const byLabelCategory = new Map();
    const targetByLabel = new Map();

    Object.entries(targets || {}).forEach(([targetKey, targetConfig]) => {
        if (targetConfig && targetConfig.label && !targetByLabel.has(targetConfig.label)) {
            targetByLabel.set(targetConfig.label, {
                target_key: targetKey,
                target_config: normalizeTargetConfig(targetKey, targetConfig)
            });
        }
    });

    Object.entries(prefs || {}).forEach(([prefKey, pref]) => {
        if (!pref || !Array.isArray(pref.customMetrics)) return;
        const sourceId = getSourceId(prefKey, pref);
        const sourceMeta = pref._sourceMeta || {};
        const source = {
            source_id: sourceId,
            pref_key: prefKey,
            mode: sourceMeta.mode || null,
            title: sourceMeta.title || null,
            base_name: sourceMeta.baseName || null,
            source_files: Array.isArray(sourceMeta.sourceFiles) ? sourceMeta.sourceFiles : [],
            matched_prefix: sourceMeta.matchedPrefix || null,
            updated_at: sourceMeta.updatedAt || null
        };
        sources.push(source);

        pref.customMetrics.forEach(rule => {
            if (!rule || !rule.label) return;
            const targetKey = `${sourceId}_${rule.id}`;
            const targetConfig = targets[targetKey] || null;
            const baseMetric = {
                source,
                rule_id: rule.id || null,
                rule_type: rule.type || null,
                target_key: targetKey,
                target_config: normalizeTargetConfig(targetKey, targetConfig),
                main_metric_label: rule.label,
                metric_label: rule.label,
                category: '整体',
                is_sub_metric: false,
                source_columns: {
                    match_column: rule.colX || null,
                    match_value: rule.valY || null,
                    value_column: rule.colZ || null,
                    extra_value: rule.valK || null
                }
            };
            metrics.push(baseMetric);
            if (!byLabel.has(rule.label)) byLabel.set(rule.label, baseMetric);
            byLabelCategory.set(`${rule.label}@@整体`, baseMetric);

            (Array.isArray(rule.subMetrics) ? rule.subMetrics : []).forEach(subRule => {
                if (!subRule) return;
                const label = getMetricDisplayLabel(subRule, rule);
                if (!label) return;
                const subTargetKey = subRule.id ? `${sourceId}_${subRule.id}` : null;
                const effectiveTargetKey = subTargetKey && targets[subTargetKey] ? subTargetKey : targetKey;
                const effectiveTarget = targets[effectiveTargetKey] || targetConfig;
                const subMetric = {
                    source,
                    rule_id: subRule.id || null,
                    parent_rule_id: rule.id || null,
                    rule_type: subRule.type || rule.type || null,
                    target_key: effectiveTargetKey,
                    target_config: normalizeTargetConfig(effectiveTargetKey, effectiveTarget),
                    main_metric_label: rule.label,
                    metric_label: label,
                    category: subRule.category || null,
                    is_sub_metric: true,
                    source_columns: {
                        match_column: subRule.colX || rule.colX || null,
                        match_value: subRule.valY || rule.valY || null,
                        value_column: subRule.colZ || rule.colZ || null,
                        extra_value: subRule.valK || rule.valK || null,
                        source_section_id: subRule.sourceSecId || sourceId
                    }
                };
                metrics.push(subMetric);
                if (subMetric.category) {
                    byLabelCategory.set(`${label}@@${subMetric.category}`, subMetric);
                }
                if (!byLabel.has(label)) byLabel.set(label, subMetric);
            });
        });
    });

    return {
        sources,
        metrics,
        byLabel,
        byLabelCategory,
        targetByLabel
    };
}

function getMetricSchemaForRow(row, schema) {
    if (!schema || !row) return null;
    return schema.byLabelCategory.get(`${row.metric_label}@@${row.cat_name}`)
        || schema.byLabelCategory.get(`${row.metric_label}@@整体`)
        || schema.byLabel.get(row.metric_label)
        || null;
}

function normalizeMetric(row, schema) {
    const matchedSchema = getMetricSchemaForRow(row, schema);
    const labelTarget = schema && schema.targetByLabel ? schema.targetByLabel.get(row.metric_label) : null;
    const out = {
        id: row.id,
        snapshot_id: row.snapshot_id,
        month: row.month,
        category: row.cat_name,
        metric_label: row.metric_label,
        weight: row.weight,
        target_value: row.target_val,
        raw_value: row.raw_val,
        numeric_value: row.num_val,
        is_failing: Boolean(row.is_failing),
        gap: row.gap,
        earned_score: row.earned_score,
        proportional_scoring: row.proportional_scoring === null ? null : Boolean(row.proportional_scoring),
        completion_ratio: row.completion_ratio
    };
    if (matchedSchema) {
        out.schema = {
            source_id: matchedSchema.source.source_id,
            source_title: matchedSchema.source.title,
            source_base_name: matchedSchema.source.base_name,
            main_metric_label: matchedSchema.main_metric_label,
            is_sub_metric: matchedSchema.is_sub_metric,
            sub_metric_category: matchedSchema.is_sub_metric ? matchedSchema.category : null,
            rule_id: matchedSchema.rule_id,
            parent_rule_id: matchedSchema.parent_rule_id || null,
            rule_type: matchedSchema.rule_type,
            target_key: matchedSchema.target_key,
            target_config: matchedSchema.target_config || (labelTarget ? labelTarget.target_config : null),
            source_columns: matchedSchema.source_columns
        };
    } else if (labelTarget) {
        out.schema = {
            source_id: null,
            source_title: null,
            source_base_name: null,
            main_metric_label: row.metric_label,
            is_sub_metric: row.cat_name !== '整体',
            sub_metric_category: row.cat_name === '整体' ? null : row.cat_name,
            rule_id: null,
            parent_rule_id: null,
            rule_type: null,
            target_key: labelTarget.target_key,
            target_config: labelTarget.target_config,
            source_columns: null
        };
    } else {
        out.schema = null;
    }
    return out;
}

function normalizeCategoryScore(row) {
    return {
        snapshot_id: row.snapshot_id,
        month: row.month,
        category: row.cat_name,
        base_score: row.base_score,
        manual_score: row.manual_score,
        final_score: row.final_score
    };
}

function parseRawData(row) {
    if (!row || !row.raw_data_json) return {};
    try {
        const parsed = JSON.parse(row.raw_data_json);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
        return {};
    }
}

function getTicketId(data = {}) {
    return data.sr_num
        || data.sr_id
        || data.task_id
        || data.risk_id
        || data.ticket_id
        || data['单号']
        || data['问题风险编号']
        || data['问题编号']
        || null;
}

function normalizeExpiringTicket(item, snapshot) {
    const data = item && typeof item.data === 'object' ? item.data : {};
    const days = Number(item && item._slaDays);
    return {
        snapshot_id: snapshot ? snapshot.snapshot_id : null,
        month: snapshot ? snapshot.month : null,
        snapshot_created_at: snapshot ? snapshot.created_at : null,
        collection: item.collection || 'other',
        title: item.title || '',
        ticket_id: getTicketId(data),
        network_name: data.network_name || data['网络名称'] || data.network || null,
        status: data.task_status || data.sr_status_name || data.status || data['状态'] || null,
        owner: data.fullname || data.cur_assignee || data.task_owner || data.sr_owner || data.owner || null,
        product_line: data.product_line_name || data.product_line || data.itr_product_line_name || null,
        product: data.product || data.product_category || null,
        customer_name: data.customer_name || data.customer_name_cn || data.network_cust_name || null,
        due_date: data.rectify_plan_end_time || data.exp_close_date || data.sus_exp_close_date || data.support_end_time || null,
        sla_days: Number.isFinite(days) ? days : null,
        urgency: Number.isFinite(days) && days < 0 ? 'overdue' : 'expiring',
        sla_text: item._slaCleanText || data._slaCleanText || '',
        raw: item
    };
}

function normalizeSpecialMetricAlert(item, snapshot) {
    return {
        snapshot_id: snapshot ? snapshot.snapshot_id : null,
        month: snapshot ? snapshot.month : null,
        snapshot_created_at: snapshot ? snapshot.created_at : null,
        type: item.type || 'special_metric_alert',
        title: item.title || '',
        metric_label: item.metric_label || item.metricLabel || null,
        weight: item.weight === undefined ? null : item.weight,
        target_month: item.target_month || item.targetMonth || null,
        target_value: item.target_val || item.targetValue || null,
        global_value: item.global_val || item.globalValue || null,
        gap: item.gap || null,
        condition: item.condition || null,
        customer_groups_checked: Array.isArray(item.customer_groups_checked) ? item.customer_groups_checked : [],
        created_at: item.created_at || null,
        raw: item
    };
}

function parseRawAlerts(snapshotRow) {
    const raw = parseRawData(snapshotRow);
    const tickets = Array.isArray(raw.expiringTickets) ? raw.expiringTickets : [];
    const metricAlerts = Array.isArray(raw.specialMetricAlerts) ? raw.specialMetricAlerts : [];
    return {
        expiring_tickets: tickets.map(item => normalizeExpiringTicket(item, snapshotRow)),
        special_metric_alerts: metricAlerts.map(item => normalizeSpecialMetricAlert(item, snapshotRow))
    };
}

function filterAlerts(alerts, filters = {}) {
    const collection = filters.collection ? String(filters.collection) : '';
    const urgency = filters.urgency ? String(filters.urgency) : '';
    return alerts.filter(item => {
        if (collection && item.collection !== collection) return false;
        if (urgency && item.urgency !== urgency) return false;
        return true;
    });
}

function buildSnapshotWhere(filters = {}) {
    const where = [];
    const params = [];
    const month = normalizeMonth(filters.month);

    if (filters.snapshotId) {
        where.push('snapshot_id = ?');
        params.push(String(filters.snapshotId));
    }
    if (month) {
        where.push('month = ?');
        params.push(month);
    }
    if (filters.startDate) {
        where.push('DATE(created_at) >= ?');
        params.push(String(filters.startDate));
    }
    if (filters.endDate) {
        where.push('DATE(created_at) <= ?');
        params.push(String(filters.endDate));
    }

    return {
        sql: where.length ? `WHERE ${where.join(' AND ')}` : '',
        params
    };
}

function buildMetricWhere(filters = {}) {
    const where = [];
    const params = [];
    const month = normalizeMonth(filters.month);

    if (filters.snapshotId) {
        where.push('m.snapshot_id = ?');
        params.push(String(filters.snapshotId));
    }
    if (month) {
        where.push('m.month = ?');
        params.push(month);
    }
    if (filters.category) {
        where.push('m.cat_name = ?');
        params.push(String(filters.category));
    }
    if (filters.metricLabel) {
        where.push('m.metric_label LIKE ?');
        params.push(`%${String(filters.metricLabel)}%`);
    }
    if (filters.failingOnly) {
        where.push('m.is_failing = 1');
    }
    if (filters.startDate) {
        where.push('DATE(s.created_at) >= ?');
        params.push(String(filters.startDate));
    }
    if (filters.endDate) {
        where.push('DATE(s.created_at) <= ?');
        params.push(String(filters.endDate));
    }

    return {
        sql: where.length ? `WHERE ${where.join(' AND ')}` : '',
        params
    };
}

async function listSnapshots(filters = {}) {
    const limit = parsePositiveInt(filters.limit, 50, 500);
    const offset = Math.max(0, parseInt(filters.offset, 10) || 0);
    const where = buildSnapshotWhere(filters);
    const rows = await all(
        `SELECT id, snapshot_id, month, created_at, standard_total_score, image_path, excel_path
         FROM ReportSnapshots
         ${where.sql}
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
        [...where.params, limit, offset]
    );
    const countRow = await get(
        `SELECT COUNT(1) AS count FROM ReportSnapshots ${where.sql}`,
        where.params
    );

    return {
        items: rows.map(row => normalizeSnapshot(row)),
        pagination: {
            limit,
            offset,
            total: countRow ? countRow.count : 0
        }
    };
}

async function getLatestSnapshot(filters = {}) {
    const where = buildSnapshotWhere(filters);
    const row = await get(
        `SELECT *
         FROM ReportSnapshots
         ${where.sql}
         ORDER BY created_at DESC, id DESC
         LIMIT 1`,
        where.params
    );
    return normalizeSnapshot(row, { includeRaw: filters.includeRaw });
}

async function getLatestSnapshotRow(filters = {}) {
    const where = buildSnapshotWhere(filters);
    return await get(
        `SELECT *
         FROM ReportSnapshots
         ${where.sql}
         ORDER BY created_at DESC, id DESC
         LIMIT 1`,
        where.params
    );
}

async function getSnapshotDetail(snapshotId, filters = {}) {
    const schema = await getMetricSchema();
    const month = normalizeMonth(filters.month);
    const params = month ? [snapshotId, month] : [snapshotId];
    const monthClause = month ? 'AND month = ?' : '';
    const snapshot = await get(
        `SELECT *
         FROM ReportSnapshots
         WHERE snapshot_id = ? ${monthClause}
         ORDER BY created_at DESC, id DESC
         LIMIT 1`,
        params
    );

    if (!snapshot) return null;

    const detailParams = [snapshot.snapshot_id, snapshot.month];
    const categories = await all(
        `SELECT snapshot_id, month, cat_name, base_score, manual_score, final_score
         FROM ReportCategoryScores
         WHERE snapshot_id = ? AND (month = ? OR month IS NULL)
         ORDER BY cat_name ASC`,
        detailParams
    );
    const metrics = await all(
        `SELECT *
         FROM ReportMetricData
         WHERE snapshot_id = ? AND (month = ? OR month IS NULL)
         ORDER BY cat_name ASC, metric_label ASC, id ASC`,
        detailParams
    );

    return {
        snapshot: normalizeSnapshot(snapshot, { includeRaw: filters.includeRaw }),
        category_scores: categories.map(normalizeCategoryScore),
        metrics: metrics.map(row => normalizeMetric(row, schema)),
        alerts: parseRawAlerts(snapshot)
    };
}

async function listMetrics(filters = {}) {
    const schema = await getMetricSchema();
    const limit = parsePositiveInt(filters.limit, 200, 2000);
    const offset = Math.max(0, parseInt(filters.offset, 10) || 0);
    const where = buildMetricWhere(filters);
    const rows = await all(
        `SELECT m.*
         FROM ReportMetricData m
         LEFT JOIN ReportSnapshots s
            ON s.snapshot_id = m.snapshot_id
           AND (s.month = m.month OR m.month IS NULL)
         ${where.sql}
         ORDER BY s.created_at DESC, m.snapshot_id DESC, m.cat_name ASC, m.metric_label ASC, m.id ASC
         LIMIT ? OFFSET ?`,
        [...where.params, limit, offset]
    );
    const countRow = await get(
        `SELECT COUNT(1) AS count
         FROM ReportMetricData m
         LEFT JOIN ReportSnapshots s
            ON s.snapshot_id = m.snapshot_id
           AND (s.month = m.month OR m.month IS NULL)
         ${where.sql}`,
        where.params
    );

    return {
        items: rows.map(row => normalizeMetric(row, schema)),
        pagination: {
            limit,
            offset,
            total: countRow ? countRow.count : 0
        }
    };
}

async function getSummary(filters = {}) {
    const schema = await getMetricSchema();
    const latestRow = await getLatestSnapshotRow(filters);
    const latest = normalizeSnapshot(latestRow);
    const snapshotWhere = buildSnapshotWhere(filters);
    const metricWhere = buildMetricWhere(filters);

    const snapshotStats = await get(
        `SELECT COUNT(1) AS snapshot_count,
                MIN(created_at) AS first_snapshot_at,
                MAX(created_at) AS latest_snapshot_at
         FROM ReportSnapshots ${snapshotWhere.sql}`,
        snapshotWhere.params
    );
    const metricStats = await get(
        `SELECT COUNT(1) AS metric_count,
                SUM(CASE WHEN m.is_failing = 1 THEN 1 ELSE 0 END) AS failing_metric_count
         FROM ReportMetricData m
         LEFT JOIN ReportSnapshots s
            ON s.snapshot_id = m.snapshot_id
           AND (s.month = m.month OR m.month IS NULL)
         ${metricWhere.sql}`,
        metricWhere.params
    );

    let latestCategories = [];
    let latestMetrics = [];
    if (latest) {
        latestCategories = await all(
            `SELECT snapshot_id, month, cat_name, base_score, manual_score, final_score
             FROM ReportCategoryScores
             WHERE snapshot_id = ? AND (month = ? OR month IS NULL)
             ORDER BY cat_name ASC`,
            [latest.snapshot_id, latest.month]
        );
        latestMetrics = await all(
            `SELECT *
             FROM ReportMetricData
             WHERE snapshot_id = ? AND (month = ? OR month IS NULL)
             ORDER BY is_failing DESC, cat_name ASC, metric_label ASC`,
            [latest.snapshot_id, latest.month]
        );
    }

    const metricCount = metricStats ? metricStats.metric_count || 0 : 0;
    const failingCount = metricStats ? metricStats.failing_metric_count || 0 : 0;
    const complianceRate = metricCount ? Number((((metricCount - failingCount) / metricCount) * 100).toFixed(2)) : null;

    return {
        snapshot_count: snapshotStats ? snapshotStats.snapshot_count || 0 : 0,
        metric_count: metricCount,
        failing_metric_count: failingCount,
        compliance_rate: complianceRate,
        first_snapshot_at: snapshotStats ? snapshotStats.first_snapshot_at : null,
        latest_snapshot_at: snapshotStats ? snapshotStats.latest_snapshot_at : null,
        latest_snapshot: latest,
        latest_category_scores: latestCategories.map(normalizeCategoryScore),
        latest_metrics_total: latestMetrics.length,
        latest_failing_metrics: latestMetrics.filter(row => row.is_failing).map(row => normalizeMetric(row, schema)),
        latest_alerts: parseRawAlerts(latestRow),
        latest_expiring_ticket_count: latestRow ? parseRawAlerts(latestRow).expiring_tickets.length : 0,
        latest_special_metric_alert_count: latestRow ? parseRawAlerts(latestRow).special_metric_alerts.length : 0
    };
}

async function getAlerts(filters = {}) {
    const snapshotRow = filters.snapshotId
        ? await get(
            `SELECT *
             FROM ReportSnapshots
             WHERE snapshot_id = ? ${normalizeMonth(filters.month) ? 'AND month = ?' : ''}
             ORDER BY created_at DESC, id DESC
             LIMIT 1`,
            normalizeMonth(filters.month) ? [filters.snapshotId, normalizeMonth(filters.month)] : [filters.snapshotId]
        )
        : await getLatestSnapshotRow(filters);
    if (!snapshotRow) return null;
    const alerts = parseRawAlerts(snapshotRow);
    const expiringTickets = filterAlerts(alerts.expiring_tickets, filters);
    return {
        snapshot: normalizeSnapshot(snapshotRow),
        expiring_ticket_count: expiringTickets.length,
        special_metric_alert_count: alerts.special_metric_alerts.length,
        expiring_tickets: expiringTickets,
        special_metric_alerts: alerts.special_metric_alerts
    };
}

async function getSchema() {
    const schema = await getMetricSchema();
    return {
        sources: schema.sources,
        metrics: schema.metrics.map(item => ({
            source_id: item.source.source_id,
            source_title: item.source.title,
            source_base_name: item.source.base_name,
            main_metric_label: item.main_metric_label,
            metric_label: item.metric_label,
            category: item.category,
            is_sub_metric: item.is_sub_metric,
            rule_id: item.rule_id,
            parent_rule_id: item.parent_rule_id || null,
            rule_type: item.rule_type,
            target_key: item.target_key,
            target_config: item.target_config,
            source_columns: item.source_columns
        }))
    };
}

function closeDatabase() {
    return new Promise((resolve, reject) => {
        db.close(err => {
            if (err && err.code !== 'SQLITE_MISUSE') return reject(err);
            resolve();
        });
    });
}

module.exports = {
    getSummary,
    listSnapshots,
    getLatestSnapshot,
    getSnapshotDetail,
    listMetrics,
    getSchema,
    getAlerts,
    closeDatabase
};
