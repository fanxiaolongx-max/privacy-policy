const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const toolsDb = require('./app-db');
const { ensureReportDataDir, REPORT_DATA_DIR } = require('./report-store');

ensureReportDataDir();

const reportDbPath = path.join(REPORT_DATA_DIR, 'report.db');
const reportDb = new sqlite3.Database(reportDbPath);

function reportAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        reportDb.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
}

function reportRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        reportDb.run(sql, params, function(err) {
            if (err) return reject(err);
            resolve({ changes: this.changes, lastID: this.lastID });
        });
    });
}

async function reportTableExists(tableName) {
    const rows = await reportAll(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
        [tableName]
    );
    return rows.length > 0;
}

async function toolsTableExists(tableName) {
    const rows = await toolsDb.all(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
        [tableName]
    );
    return rows.length > 0;
}

function parseJsonSafe(text, fallback) {
    try {
        return JSON.parse(text);
    } catch (err) {
        return fallback;
    }
}

function countAndRemoveSubMetricsFromMetric(metric, categoryName) {
    if (!metric || !Array.isArray(metric.subMetrics)) return { removed: [], changed: false };
    const removed = metric.subMetrics.filter(item => item && item.category === categoryName);
    if (!removed.length) return { removed, changed: false };
    metric.subMetrics = metric.subMetrics.filter(item => !(item && item.category === categoryName));
    return { removed, changed: true };
}

function collectRuleImpacts(prefKey, payload, categoryName) {
    const impacts = [];
    const customMetrics = Array.isArray(payload && payload.customMetrics) ? payload.customMetrics : [];
    customMetrics.forEach(rule => {
        const { removed } = countAndRemoveSubMetricsFromMetric(
            { subMetrics: Array.isArray(rule.subMetrics) ? rule.subMetrics.slice() : [] },
            categoryName
        );
        if (!removed.length) return;
        impacts.push({
            pref_key: prefKey,
            rule_id: rule.id || '',
            metric_label: rule.label || '',
            removed_count: removed.length,
            sub_metrics: removed.map(item => ({
                category: item.category || '',
                colX: item.colX || '',
                valY: item.valY || '',
                colZ: item.colZ || '',
                valK: item.valK || ''
            }))
        });
    });
    return impacts;
}

function removeRuleSubMetrics(payload, categoryName) {
    let removedCount = 0;
    const customMetrics = Array.isArray(payload && payload.customMetrics) ? payload.customMetrics : [];
    customMetrics.forEach(rule => {
        if (!Array.isArray(rule.subMetrics)) return;
        const before = rule.subMetrics.length;
        rule.subMetrics = rule.subMetrics.filter(item => !(item && item.category === categoryName));
        removedCount += before - rule.subMetrics.length;
    });
    return removedCount;
}

function collectSnapshotMetricImpacts(snapshot, categoryName) {
    const impacts = [];
    const metrics = Array.isArray(snapshot && snapshot.topMetrics) ? snapshot.topMetrics : [];
    metrics.forEach(metric => {
        const { removed } = countAndRemoveSubMetricsFromMetric(
            { subMetrics: Array.isArray(metric.subMetrics) ? metric.subMetrics.slice() : [] },
            categoryName
        );
        if (!removed.length) return;
        impacts.push({
            metric_label: metric.label || '',
            removed_count: removed.length,
            sub_metrics: removed.map(item => ({
                category: item.category || '',
                value: item.value === undefined || item.value === null ? '' : String(item.value)
            }))
        });
    });
    return impacts;
}

function removeSnapshotSubMetrics(snapshot, categoryName) {
    let removedCount = 0;
    const metrics = Array.isArray(snapshot && snapshot.topMetrics) ? snapshot.topMetrics : [];
    metrics.forEach(metric => {
        const result = countAndRemoveSubMetricsFromMetric(metric, categoryName);
        removedCount += result.removed.length;
    });
    return removedCount;
}

function getTemplateLineCategory(line) {
    const text = String(line || '').trim();
    if (!text) return '';
    let parts;
    if (text.includes('\t')) {
        parts = text.split('\t');
    } else if (text.includes(',')) {
        parts = text.split(',');
    } else {
        parts = text.split(/\s+/);
    }
    return String(parts[0] || '').trim();
}

function collectTemplateImpacts(row, categoryName) {
    const lines = String(row.template_text || '').split('\n');
    const removedLines = lines
        .map(line => line.trim())
        .filter(line => line && getTemplateLineCategory(line) === categoryName);
    if (!removedLines.length) return null;
    return {
        template_key: row.template_key,
        updated_at: row.updated_at || '',
        removed_count: removedLines.length,
        lines: removedLines
    };
}

function removeTemplateLines(text, categoryName) {
    const lines = String(text || '').split('\n');
    const kept = [];
    let removedCount = 0;
    lines.forEach(line => {
        if (line.trim() && getTemplateLineCategory(line) === categoryName) {
            removedCount += 1;
            return;
        }
        kept.push(line);
    });
    return {
        text: kept.join('\n').trim(),
        removedCount
    };
}

async function collectImpact(categoryName) {
    const category = String(categoryName || '').trim();
    if (!category) throw new Error('分类名不能为空');

    const categories = await toolsDb.all('SELECT name FROM sla_categories WHERE name = ?', [category]);
    const prefRows = await toolsDb.all('SELECT pref_key, payload_json FROM sla_prefs ORDER BY pref_key ASC');
    const snapshotRows = await toolsDb.all('SELECT id, timestamp, payload_json FROM sla_snapshots ORDER BY timestamp DESC, id DESC');
    const templateRows = await toolsTableExists('sla_rule_templates')
        ? await toolsDb.all('SELECT template_key, template_text, updated_at FROM sla_rule_templates ORDER BY template_key ASC')
        : [];

    const ruleImpacts = [];
    prefRows.forEach(row => {
        const payload = parseJsonSafe(row.payload_json, null);
        if (!payload) return;
        ruleImpacts.push(...collectRuleImpacts(row.pref_key, payload, category));
    });

    const slaSnapshotImpacts = [];
    snapshotRows.forEach(row => {
        const snapshot = parseJsonSafe(row.payload_json, null);
        const metrics = collectSnapshotMetricImpacts(snapshot, category);
        if (!metrics.length) return;
        slaSnapshotImpacts.push({
            id: row.id,
            timestamp: row.timestamp || (snapshot && snapshot.timestamp) || '',
            metric_count: metrics.length,
            sub_metric_count: metrics.reduce((sum, item) => sum + item.removed_count, 0),
            metrics
        });
    });

    const ruleTemplateImpacts = templateRows
        .map(row => collectTemplateImpacts(row, category))
        .filter(Boolean);

    const report = {
        category_scores: [],
        metric_data: [],
        raw_snapshots: [],
        bigscreen_owners: []
    };

    if (await reportTableExists('ReportCategoryScores')) {
        report.category_scores = await reportAll(
            `SELECT snapshot_id, month, cat_name, base_score, manual_score, final_score
             FROM ReportCategoryScores
             WHERE cat_name = ?
             ORDER BY snapshot_id ASC, month ASC`,
            [category]
        );
    }

    if (await reportTableExists('ReportMetricData')) {
        report.metric_data = await reportAll(
            `SELECT snapshot_id, month, cat_name, metric_label, weight, target_val, raw_val, num_val, is_failing, gap
             FROM ReportMetricData
             WHERE cat_name = ?
             ORDER BY snapshot_id ASC, month ASC, metric_label ASC`,
            [category]
        );
    }

    if (await reportTableExists('ReportSnapshots')) {
        const reportSnapshotRows = await reportAll(
            `SELECT id, snapshot_id, month, created_at, raw_data_json
             FROM ReportSnapshots
             ORDER BY id DESC`
        );
        report.raw_snapshots = reportSnapshotRows.map(row => {
            const snapshot = parseJsonSafe(row.raw_data_json, null);
            const metrics = collectSnapshotMetricImpacts(snapshot, category);
            if (!metrics.length) return null;
            return {
                id: row.id,
                snapshot_id: row.snapshot_id,
                month: row.month,
                created_at: row.created_at,
                metric_count: metrics.length,
                sub_metric_count: metrics.reduce((sum, item) => sum + item.removed_count, 0),
                metrics
            };
        }).filter(Boolean);
    }

    if (await reportTableExists('BigscreenOwners')) {
        report.bigscreen_owners = await reportAll(
            `SELECT id, cat_name, metric_label, owner_name, emp_id
             FROM BigscreenOwners
             WHERE cat_name = ?
             ORDER BY metric_label ASC, owner_name ASC`,
            [category]
        );
    }

    const totals = {
        category_rows: categories.length,
        rule_rows: ruleImpacts.length,
        rule_sub_metrics: ruleImpacts.reduce((sum, item) => sum + item.removed_count, 0),
        rule_templates: ruleTemplateImpacts.length,
        rule_template_lines: ruleTemplateImpacts.reduce((sum, item) => sum + item.removed_count, 0),
        sla_snapshots: slaSnapshotImpacts.length,
        sla_snapshot_sub_metrics: slaSnapshotImpacts.reduce((sum, item) => sum + item.sub_metric_count, 0),
        report_category_scores: report.category_scores.length,
        report_metric_data: report.metric_data.length,
        report_raw_snapshots: report.raw_snapshots.length,
        report_raw_sub_metrics: report.raw_snapshots.reduce((sum, item) => sum + item.sub_metric_count, 0),
        bigscreen_owners: report.bigscreen_owners.length
    };

    totals.total_items =
        totals.category_rows +
        totals.rule_sub_metrics +
        totals.rule_template_lines +
        totals.sla_snapshot_sub_metrics +
        totals.report_category_scores +
        totals.report_metric_data +
        totals.report_raw_sub_metrics +
        totals.bigscreen_owners;

    return {
        category,
        exists: categories.length > 0,
        totals,
        details: {
            rules: ruleImpacts,
            rule_templates: ruleTemplateImpacts,
            sla_snapshots: slaSnapshotImpacts,
            report
        }
    };
}

async function deleteCascade(categoryName) {
    const category = String(categoryName || '').trim();
    if (!category) throw new Error('分类名不能为空');

    const impact = await collectImpact(category);
    const deleted = {
        categories: 0,
        rule_sub_metrics: 0,
        rule_template_lines: 0,
        sla_snapshot_sub_metrics: 0,
        report_category_scores: 0,
        report_metric_data: 0,
        report_raw_sub_metrics: 0,
        bigscreen_owners: 0
    };

    await toolsDb.run('BEGIN TRANSACTION');
    await reportRun('BEGIN TRANSACTION');

    try {
        const categoryResult = await toolsDb.run('DELETE FROM sla_categories WHERE name = ?', [category]);
        deleted.categories = categoryResult.changes || 0;

        const prefRows = await toolsDb.all('SELECT pref_key, pref_kind, payload_json FROM sla_prefs ORDER BY pref_key ASC');
        for (const row of prefRows) {
            const payload = parseJsonSafe(row.payload_json, null);
            if (!payload) continue;
            const removed = removeRuleSubMetrics(payload, category);
            if (!removed) continue;
            deleted.rule_sub_metrics += removed;
            await toolsDb.run(
                `UPDATE sla_prefs
                 SET payload_json = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE pref_key = ?`,
                [JSON.stringify(payload), row.pref_key]
            );
        }

        const snapshotRows = await toolsDb.all('SELECT id, payload_json FROM sla_snapshots ORDER BY timestamp DESC, id DESC');
        for (const row of snapshotRows) {
            const snapshot = parseJsonSafe(row.payload_json, null);
            if (!snapshot) continue;
            const removed = removeSnapshotSubMetrics(snapshot, category);
            if (!removed) continue;
            deleted.sla_snapshot_sub_metrics += removed;
            await toolsDb.run(
                `UPDATE sla_snapshots
                 SET payload_json = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [JSON.stringify(snapshot), row.id]
            );
        }

        if (await toolsTableExists('sla_rule_templates')) {
            const templateRows = await toolsDb.all('SELECT template_key, template_text FROM sla_rule_templates ORDER BY template_key ASC');
            for (const row of templateRows) {
                const next = removeTemplateLines(row.template_text, category);
                if (!next.removedCount) continue;
                deleted.rule_template_lines = (deleted.rule_template_lines || 0) + next.removedCount;
                await toolsDb.run(
                    `UPDATE sla_rule_templates
                     SET template_text = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE template_key = ?`,
                    [next.text, row.template_key]
                );
            }
        }

        if (await reportTableExists('ReportCategoryScores')) {
            const result = await reportRun('DELETE FROM ReportCategoryScores WHERE cat_name = ?', [category]);
            deleted.report_category_scores = result.changes || 0;
        }

        if (await reportTableExists('ReportMetricData')) {
            const result = await reportRun('DELETE FROM ReportMetricData WHERE cat_name = ?', [category]);
            deleted.report_metric_data = result.changes || 0;
        }

        if (await reportTableExists('ReportSnapshots')) {
            const reportSnapshotRows = await reportAll('SELECT id, raw_data_json FROM ReportSnapshots ORDER BY id DESC');
            for (const row of reportSnapshotRows) {
                const snapshot = parseJsonSafe(row.raw_data_json, null);
                if (!snapshot) continue;
                const removed = removeSnapshotSubMetrics(snapshot, category);
                if (!removed) continue;
                deleted.report_raw_sub_metrics += removed;
                await reportRun(
                    'UPDATE ReportSnapshots SET raw_data_json = ? WHERE id = ?',
                    [JSON.stringify(snapshot), row.id]
                );
            }
        }

        if (await reportTableExists('BigscreenOwners')) {
            const result = await reportRun('DELETE FROM BigscreenOwners WHERE cat_name = ?', [category]);
            deleted.bigscreen_owners = result.changes || 0;
        }

        await reportRun('COMMIT');
        await toolsDb.run('COMMIT');

        return {
            success: true,
            category,
            impact,
            deleted
        };
    } catch (err) {
        await reportRun('ROLLBACK').catch(() => {});
        await toolsDb.run('ROLLBACK').catch(() => {});
        throw err;
    }
}

module.exports = {
    collectImpact,
    deleteCascade
};
