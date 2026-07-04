const crypto = require('crypto');
const { run, get } = require('./app-db');
const alertCenterRepo = require('./alert-center-repository');
const targetsRepo = require('./sla-targets-repository');
const prefsRepo = require('./sla-prefs-repository');
const groupsRepo = require('./sla-groups-repository');

const DEFAULT_SCAN_INTERVAL_MS = 5 * 60 * 1000;

let initPromise = null;
let scanTimer = null;
let scanRunning = false;

function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

function hashObject(value) {
    return crypto.createHash('sha256').update(stableStringify(value || {})).digest('hex');
}

function shortHash(value) {
    return hashObject(value).slice(0, 16);
}

function getRequestActor(req) {
    return req?.user?.username || req?.user?.name || req?.session?.user?.username || req?.ip || '';
}

function getRequestSource(req) {
    return req?.get?.('x-tools-source') || req?.get?.('referer') || req?.originalUrl || '';
}

function buildRequestContext(req, extra = {}) {
    return {
        request_id: req?.requestId || '',
        actor: getRequestActor(req),
        method: req?.method || '',
        path: req?.originalUrl || req?.path || '',
        referer: req?.get?.('referer') || '',
        user_agent: req?.get?.('user-agent') || '',
        source: getRequestSource(req),
        ...extra
    };
}

function collectMetricLabelsFromPrefs(prefs = {}) {
    const labels = [];
    Object.entries(prefs || {}).forEach(([prefKey, pref]) => {
        if (!pref || !Array.isArray(pref.customMetrics)) return;
        pref.customMetrics.forEach(metric => {
            if (metric && metric.label) labels.push({
                key: prefKey,
                label: metric.label,
                id: metric.id || ''
            });
        });
    });
    return labels;
}

function summarizeConfigObject(value, kind = 'object') {
    const summary = { kind, hash: shortHash(value) };
    if (Array.isArray(value)) {
        summary.count = value.length;
        summary.names = value.map(item => item && (item.name || item.label || item.id)).filter(Boolean).slice(0, 80);
        return summary;
    }
    if (!value || typeof value !== 'object') {
        summary.valueType = typeof value;
        return summary;
    }
    const keys = Object.keys(value);
    summary.keyCount = keys.length;
    summary.keys = keys.slice(0, 80);
    if (Array.isArray(value.customMetrics)) {
        summary.metricCount = value.customMetrics.length;
        summary.metricLabels = value.customMetrics.map(item => item && item.label).filter(Boolean).slice(0, 80);
        summary.subMetricCount = value.customMetrics.reduce((sum, item) => sum + (Array.isArray(item?.subMetrics) ? item.subMetrics.length : 0), 0);
    }
    return summary;
}

function summarizeSlaConfig({ targets = {}, prefs = {}, groups = [] } = {}) {
    const metricRefs = collectMetricLabelsFromPrefs(prefs);
    const labels = metricRefs.map(item => item.label);
    const schemaPrefs = Object.entries(prefs || {}).filter(([, pref]) => pref && Array.isArray(pref.customMetrics));
    const manualItems = Array.isArray(prefs.manualAdjustItems) ? prefs.manualAdjustItems.filter(item => item && !item.deleted) : [];
    return {
        targetCount: Object.keys(targets || {}).length,
        prefCount: Object.keys(prefs || {}).length,
        schemaPrefCount: schemaPrefs.length,
        metricRuleCount: labels.length,
        uniqueMetricCount: new Set(labels).size,
        subMetricCount: schemaPrefs.reduce((sum, [, pref]) => sum + pref.customMetrics.reduce((n, metric) => n + (Array.isArray(metric?.subMetrics) ? metric.subMetrics.length : 0), 0), 0),
        manualAdjustCount: manualItems.length,
        groupCount: Array.isArray(groups) ? groups.length : 0,
        groupedMetricCount: Array.isArray(groups) ? groups.reduce((sum, group) => sum + (Array.isArray(group?.metrics) ? group.metrics.length : 0), 0) : 0,
        labels: Array.from(new Set(labels)).sort().slice(0, 200),
        hash: shortHash({ targets, prefs, groups })
    };
}

function diffArrays(beforeItems = [], afterItems = []) {
    const beforeSet = new Set(beforeItems || []);
    const afterSet = new Set(afterItems || []);
    return {
        added: [...afterSet].filter(item => !beforeSet.has(item)).sort().slice(0, 80),
        removed: [...beforeSet].filter(item => !afterSet.has(item)).sort().slice(0, 80)
    };
}

function diffSummaries(before = {}, after = {}) {
    const diff = {
        before,
        after,
        changed: before.hash !== after.hash
    };
    if (before.labels || after.labels) {
        const labelsDiff = diffArrays(before.labels || [], after.labels || []);
        diff.addedLabels = labelsDiff.added;
        diff.removedLabels = labelsDiff.removed;
    }
    return diff;
}

function isRiskyConfigDiff(diff = {}) {
    const before = diff.before || {};
    const after = diff.after || {};
    const metricDrop = Number(before.metricRuleCount || before.metricCount || 0) - Number(after.metricRuleCount || after.metricCount || 0);
    const subDrop = Number(before.subMetricCount || 0) - Number(after.subMetricCount || 0);
    const targetDrop = Number(before.targetCount || before.keyCount || 0) - Number(after.targetCount || after.keyCount || 0);
    const removedLabels = Array.isArray(diff.removedLabels) ? diff.removedLabels.length : 0;
    return metricDrop >= 3 || subDrop >= 8 || targetDrop >= 5 || removedLabels >= 3;
}

function buildConfigChangeTitle(action, diff) {
    const before = diff.before || {};
    const after = diff.after || {};
    const metricBefore = before.metricRuleCount ?? before.metricCount ?? before.keyCount ?? before.count;
    const metricAfter = after.metricRuleCount ?? after.metricCount ?? after.keyCount ?? after.count;
    if (metricBefore !== undefined && metricAfter !== undefined && metricBefore !== metricAfter) {
        return `${action}：数量 ${metricBefore} → ${metricAfter}`;
    }
    return `${action}：内容已变化`;
}

async function ensureReady() {
    if (!initPromise) {
        initPromise = (async () => {
            await run(`
                CREATE TABLE IF NOT EXISTS config_fingerprints (
                    scope TEXT PRIMARY KEY,
                    hash TEXT NOT NULL,
                    summary_json TEXT NOT NULL DEFAULT '{}',
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
        })().catch(err => {
            initPromise = null;
            throw err;
        });
    }
    return initPromise;
}

async function recordConfigChangeAlert({ req, scope = 'sla', action, before, after, objectType = 'config', objectId = '', message = '', severity, detail = {} }) {
    try {
        await ensureReady();
        const beforeSummary = summarizeConfigObject(before, `${objectType}:before`);
        const afterSummary = summarizeConfigObject(after, `${objectType}:after`);
        const diff = diffSummaries(beforeSummary, afterSummary);
        if (!diff.changed) return null;
        const requestContext = buildRequestContext(req);
        const finalSeverity = severity || (isRiskyConfigDiff(diff) ? 'warn' : 'info');
        return await alertCenterRepo.addEvent({
            eventType: 'config',
            severity: finalSeverity,
            title: buildConfigChangeTitle(action || '配置变化', diff),
            message: message || `${objectType} 配置已保存，告警台记录本次变更来源。`,
            actor: requestContext.actor,
            source: requestContext.source || `${requestContext.method} ${requestContext.path}`.trim(),
            objectType,
            objectId,
            detail: {
                scope,
                action,
                request: requestContext,
                diff,
                ...detail
            }
        });
    } catch (err) {
        console.error('[config-change-monitor] record alert failed:', err.message);
        return null;
    }
}

async function recordSlaConfigChange({ req, action, beforeTargets, beforePrefs, beforeGroups, afterTargets, afterPrefs, afterGroups, objectType = 'sla_config', objectId = '', detail = {} }) {
    try {
        await ensureReady();
        const beforeSummary = summarizeSlaConfig({ targets: beforeTargets, prefs: beforePrefs, groups: beforeGroups });
        const afterSummary = summarizeSlaConfig({ targets: afterTargets, prefs: afterPrefs, groups: afterGroups });
        const diff = diffSummaries(beforeSummary, afterSummary);
        if (!diff.changed) return null;
        const requestContext = buildRequestContext(req);
        const severity = isRiskyConfigDiff(diff) ? 'warn' : 'info';
        const event = await alertCenterRepo.addEvent({
            eventType: 'config',
            severity,
            title: buildConfigChangeTitle(action || 'SLA 指标配置变化', diff),
            message: 'SLA/报表指标相关配置已变化，详情包含数量、内容 hash 和请求来源。',
            actor: requestContext.actor,
            source: requestContext.source || `${requestContext.method} ${requestContext.path}`.trim(),
            objectType,
            objectId,
            detail: {
                scope: 'sla',
                action,
                request: requestContext,
                diff,
                ...detail
            }
        });
        await updateFingerprint('sla_core', afterSummary);
        return event;
    } catch (err) {
        console.error('[config-change-monitor] record SLA alert failed:', err.message);
        return null;
    }
}

async function updateFingerprint(scope, summary) {
    await ensureReady();
    const hash = summary.hash || shortHash(summary);
    await run(
        `INSERT INTO config_fingerprints (scope, hash, summary_json, updated_at, last_seen_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT(scope) DO UPDATE SET
            hash = excluded.hash,
            summary_json = excluded.summary_json,
            updated_at = CURRENT_TIMESTAMP,
            last_seen_at = CURRENT_TIMESTAMP`,
        [scope, hash, JSON.stringify(summary || {})]
    );
}

async function collectSlaCoreSummary() {
    const [{ items: targets }, { items: prefs }, { items: groups }] = await Promise.all([
        targetsRepo.getTargets({ mode: 'auto' }),
        prefsRepo.getPrefsObject({ mode: 'auto' }),
        groupsRepo.listGroups({ mode: 'auto' })
    ]);
    return summarizeSlaConfig({ targets, prefs, groups });
}

async function scanSlaCoreFingerprint({ reason = 'scheduled' } = {}) {
    await ensureReady();
    const summary = await collectSlaCoreSummary();
    const row = await get('SELECT hash, summary_json FROM config_fingerprints WHERE scope = ?', ['sla_core']);
    if (!row) {
        await updateFingerprint('sla_core', summary);
        return { changed: false, initialized: true };
    }
    if (row.hash === summary.hash) {
        await run('UPDATE config_fingerprints SET last_seen_at = CURRENT_TIMESTAMP WHERE scope = ?', ['sla_core']);
        return { changed: false };
    }
    const beforeSummary = (() => {
        try { return JSON.parse(row.summary_json || '{}'); } catch (_err) { return {}; }
    })();
    const diff = diffSummaries(beforeSummary, summary);
    await alertCenterRepo.addEvent({
        eventType: 'config',
        severity: isRiskyConfigDiff(diff) ? 'warn' : 'info',
        title: buildConfigChangeTitle('检测到未归因配置变化', diff),
        message: '配置指纹扫描发现 SLA/报表指标配置发生变化，但没有匹配到主链路告警。可能来自备份恢复、数据库直改或未接入的旧接口。',
        actor: 'system',
        source: `config-fingerprint:${reason}`,
        objectType: 'sla_config_fingerprint',
        objectId: 'sla_core',
        detail: {
            scope: 'sla',
            action: 'fingerprint.scan.detected',
            diff
        }
    });
    await updateFingerprint('sla_core', summary);
    return { changed: true };
}

function startConfigFingerprintMonitor({ intervalMs = DEFAULT_SCAN_INTERVAL_MS } = {}) {
    if (scanTimer) return;
    setTimeout(() => {
        scanSlaCoreFingerprint({ reason: 'startup' }).catch(err => {
            console.error('[config-change-monitor] startup scan failed:', err.message);
        });
    }, 3000);
    scanTimer = setInterval(async () => {
        if (scanRunning) return;
        scanRunning = true;
        try {
            await scanSlaCoreFingerprint({ reason: 'scheduled' });
        } catch (err) {
            console.error('[config-change-monitor] scheduled scan failed:', err.message);
        } finally {
            scanRunning = false;
        }
    }, intervalMs);
}

module.exports = {
    stableStringify,
    hashObject,
    shortHash,
    buildRequestContext,
    summarizeConfigObject,
    summarizeSlaConfig,
    recordConfigChangeAlert,
    recordSlaConfigChange,
    scanSlaCoreFingerprint,
    startConfigFingerprintMonitor
};
