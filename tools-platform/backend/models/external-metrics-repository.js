const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const { ensureReportDataDir, REPORT_DATA_DIR } = require('./report-store');
const prefsRepo = require('./sla-prefs-repository');
const targetsRepo = require('./sla-targets-repository');

ensureReportDataDir();

const dbPath = path.join(REPORT_DATA_DIR, 'report.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run('ALTER TABLE ReportSnapshots ADD COLUMN stored_at DATETIME', () => {});
});

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

function normalizeLang(value) {
    const lang = String(value || '').toLowerCase();
    if (lang === 'en' || lang === 'en-us') return 'en-US';
    if (lang === 'zh' || lang === 'zh-cn') return 'zh-CN';
    return 'zh-CN';
}

function stripEmojiPrefix(value) {
    return String(value || '').replace(/^[^\p{L}\p{N}\u4e00-\u9fff]+/u, '').trim();
}

const STATIC_TEXT_TRANSLATIONS = {
    '整改详单合集': 'Rectification Details',
    '常规风险合集': 'Regular Risk Details',
    '常规风险详单合集': 'Regular Risk Details',
    'CPT专项风险合集': 'CPT Special Risk Details',
    'CPT专项': 'CPT Special',
    '专项风险合集': 'Special Risk Details',
    'SR详单分析': 'SR Details Analysis',
    '漏洞预警详单': 'Vulnerability Warning Details',
    '整改监控': 'Rectification Monitoring',
    '常规风险监控': 'Regular Risk Monitoring',
    '专项风险监控': 'Special Risk Monitoring',
    '漏洞预警分析': 'Vulnerability Warning Analysis',
    '特殊指标提醒': 'Special Metric Alerts',
    '全局不达标但客户群/代表处/区域无值': 'Global metric failed but customer group / rep office / region has no value',
    '其他临期数据': 'Other Expiring Items'
};

function getTranslatedText(text, i18nMap = {}) {
    const zh = text === undefined || text === null ? '' : String(text);
    const normalized = stripEmojiPrefix(zh);
    const en = i18nMap[zh] || i18nMap[normalized] || STATIC_TEXT_TRANSLATIONS[zh] || STATIC_TEXT_TRANSLATIONS[normalized] || '';
    return {
        zh,
        en: en || zh
    };
}

function getDisplayText(text, i18nMap = {}, lang = 'zh-CN') {
    const translated = getTranslatedText(text, i18nMap);
    return normalizeLang(lang) === 'en-US' ? translated.en : translated.zh;
}

function decorateText(out, fieldName, value, schema) {
    const i18n = getTranslatedText(value, schema && schema.i18nMap);
    out[`${fieldName}_i18n`] = i18n;
    out[`display_${fieldName}`] = normalizeLang(schema && schema.lang) === 'en-US' ? i18n.en : i18n.zh;
}

function normalizeSnapshot(row, { includeRaw = false } = {}) {
    if (!row) return null;
    const out = {
        row_id: row.id || row.row_id || null,
        snapshot_id: row.snapshot_id,
        month: row.month,
        created_at: row.created_at,
        stored_at: row.stored_at || null,
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

function normalizeTargetConfig(targetKey, targetConfig, i18nMap = {}, lang = 'zh-CN') {
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
        label_i18n: getTranslatedText(targetConfig.label || null, i18nMap),
        display_label: getDisplayText(targetConfig.label || null, i18nMap, lang),
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

async function getMetricSchema(filters = {}) {
    const [{ items: prefs }, { items: targets }] = await Promise.all([
        prefsRepo.getPrefsObject(),
        targetsRepo.getTargets()
    ]);
    const i18nMap = (prefs && prefs.i18nMap) || {};
    const lang = normalizeLang(filters.lang);
    const sources = [];
    const metrics = [];
    const byLabel = new Map();
    const byLabelCategory = new Map();
    const targetByLabel = new Map();

    Object.entries(targets || {}).forEach(([targetKey, targetConfig]) => {
        if (targetConfig && targetConfig.label && !targetByLabel.has(targetConfig.label)) {
            targetByLabel.set(targetConfig.label, {
                target_key: targetKey,
                target_config: normalizeTargetConfig(targetKey, targetConfig, i18nMap, lang)
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
            title_i18n: getTranslatedText(sourceMeta.title || null, i18nMap),
            display_title: getDisplayText(sourceMeta.title || null, i18nMap, lang),
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
                target_config: normalizeTargetConfig(targetKey, targetConfig, i18nMap, lang),
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
                    target_config: normalizeTargetConfig(effectiveTargetKey, effectiveTarget, i18nMap, lang),
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
        targetByLabel,
        i18nMap,
        lang
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
    const effectiveTargetConfig = (matchedSchema && matchedSchema.target_config) || (labelTarget ? labelTarget.target_config : null);
    const displayTargetValue = formatTargetText(effectiveTargetConfig, row.month, row.raw_val || row.raw_value);
    const targetNumericValue = effectiveTargetConfig && effectiveTargetConfig.monthly_targets
        ? effectiveTargetConfig.monthly_targets[String(row.month)]
        : null;
    const out = {
        id: row.id,
        snapshot_id: row.snapshot_id,
        month: row.month,
        category: row.cat_name,
        metric_label: row.metric_label,
        is_derived_overall: Boolean(row.is_derived_overall),
        weight: row.weight,
        target_value: row.target_val,
        display_target_value: displayTargetValue === '--' ? row.target_val : displayTargetValue,
        target_numeric_value: targetNumericValue === undefined ? null : targetNumericValue,
        target_is_percent: effectiveTargetConfig && effectiveTargetConfig.is_percent === null ? null : Boolean(effectiveTargetConfig && effectiveTargetConfig.is_percent),
        raw_value: row.raw_val,
        numeric_value: row.num_val,
        is_failing: Boolean(row.is_failing),
        gap: row.gap,
        earned_score: row.earned_score,
        proportional_scoring: row.proportional_scoring === null ? null : Boolean(row.proportional_scoring),
        completion_ratio: row.completion_ratio
    };
    decorateText(out, 'metric_label', row.metric_label, schema);
    decorateText(out, 'category', row.cat_name, schema);
    if (matchedSchema) {
        out.schema = {
            source_id: matchedSchema.source.source_id,
            source_title: matchedSchema.source.title,
            source_title_i18n: matchedSchema.source.title_i18n,
            display_source_title: matchedSchema.source.display_title,
            source_base_name: matchedSchema.source.base_name,
            main_metric_label: matchedSchema.main_metric_label,
            main_metric_label_i18n: getTranslatedText(matchedSchema.main_metric_label, schema.i18nMap),
            display_main_metric_label: getDisplayText(matchedSchema.main_metric_label, schema.i18nMap, schema.lang),
            is_sub_metric: matchedSchema.is_sub_metric,
            sub_metric_category: matchedSchema.is_sub_metric ? matchedSchema.category : null,
            sub_metric_category_i18n: matchedSchema.is_sub_metric ? getTranslatedText(matchedSchema.category, schema.i18nMap) : null,
            display_sub_metric_category: matchedSchema.is_sub_metric ? getDisplayText(matchedSchema.category, schema.i18nMap, schema.lang) : null,
            rule_id: matchedSchema.rule_id,
            parent_rule_id: matchedSchema.parent_rule_id || null,
            rule_type: matchedSchema.rule_type,
            target_key: matchedSchema.target_key,
            target_config: effectiveTargetConfig,
            source_columns: matchedSchema.source_columns
        };
    } else if (labelTarget) {
        out.schema = {
            source_id: null,
            source_title: null,
            source_title_i18n: null,
            display_source_title: null,
            source_base_name: null,
            main_metric_label: row.metric_label,
            main_metric_label_i18n: getTranslatedText(row.metric_label, schema.i18nMap),
            display_main_metric_label: getDisplayText(row.metric_label, schema.i18nMap, schema.lang),
            is_sub_metric: row.cat_name !== '整体',
            sub_metric_category: row.cat_name === '整体' ? null : row.cat_name,
            sub_metric_category_i18n: row.cat_name === '整体' ? null : getTranslatedText(row.cat_name, schema.i18nMap),
            display_sub_metric_category: row.cat_name === '整体' ? null : getDisplayText(row.cat_name, schema.i18nMap, schema.lang),
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

function parseMetricNumber(value) {
    if (value === undefined || value === null) return NaN;
    const text = String(value).replace(/,/g, '').replace(/%/g, '').trim();
    const matched = text.match(/-?\d+(?:\.\d+)?/);
    return matched ? Number(matched[0]) : NaN;
}

function formatTargetText(targetConfig, month, rawValue) {
    if (!targetConfig || !month) return '--';
    const monthly = targetConfig.monthly_targets || {};
    const target = monthly[String(month)];
    if (target === undefined || target === null || target === '') return '--';
    const condition = targetConfig.condition || 'gte';
    const hasPercent = String(rawValue || '').includes('%') || targetConfig.is_percent;
    return `${condition === 'lte' ? '≤' : '≥'} ${target}${hasPercent && !String(target).includes('%') ? '%' : ''}`;
}

function buildDerivedOverallMetricRow(snapshot, metric, schema) {
    if (!snapshot || !metric || !metric.label) return null;
    const schemaItem = schema && schema.byLabel ? schema.byLabel.get(metric.label) : null;
    const targetConfig = (schemaItem && schemaItem.target_config)
        || (schema && schema.targetByLabel && schema.targetByLabel.get(metric.label) && schema.targetByLabel.get(metric.label).target_config)
        || null;
    const rawValue = metric.value;
    const numValue = parseMetricNumber(rawValue);
    const month = snapshot.month;
    const targetValue = targetConfig && month ? (targetConfig.monthly_targets || {})[String(month)] : undefined;
    const targetNum = parseMetricNumber(targetValue);
    const condition = (targetConfig && targetConfig.condition) || 'gte';
    let isFailing = Boolean(metric.isWarn || metric.isFailing);
    let gap = metric.gap || '';

    if (Number.isFinite(numValue) && Number.isFinite(targetNum)) {
        if (condition === 'lte' && numValue > targetNum) {
            isFailing = true;
            gap = `${Number((numValue - targetNum).toFixed(2))}${String(rawValue || '').includes('%') ? '%' : ''}`;
        } else if (condition !== 'lte' && numValue < targetNum) {
            isFailing = true;
            gap = `${Number((targetNum - numValue).toFixed(2))}${String(rawValue || '').includes('%') ? '%' : ''}`;
        } else {
            isFailing = false;
            gap = '';
        }
    }

    return {
        id: null,
        is_derived_overall: true,
        snapshot_sort_id: snapshot.id || snapshot.row_id || null,
        snapshot_row_id: snapshot.id || snapshot.row_id || null,
        snapshot_id: snapshot.snapshot_id,
        month,
        snapshot_created_at: snapshot.created_at || snapshot.snapshot_created_at || null,
        stored_at: snapshot.stored_at || null,
        standard_total_score: snapshot.standard_total_score === undefined ? null : snapshot.standard_total_score,
        cat_name: '整体',
        metric_label: metric.label,
        weight: targetConfig && targetConfig.weight !== null && targetConfig.weight !== undefined ? targetConfig.weight : null,
        target_val: formatTargetText(targetConfig, month, rawValue),
        raw_val: rawValue === undefined || rawValue === null ? '' : String(rawValue),
        num_val: Number.isFinite(numValue) ? numValue : null,
        is_failing: isFailing ? 1 : 0,
        gap,
        earned_score: null,
        proportional_scoring: false,
        completion_ratio: null
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

const ALERT_COLLECTION_LABELS = {
    rectification: { zh: '整改预警', en: 'Rectification Alerts' },
    vulnerability: { zh: '漏洞预警', en: 'Vulnerability Alerts' },
    risk: { zh: '风险预警', en: 'Risk Alerts' },
    special: { zh: '专项风险预警', en: 'Special Risk Alerts' },
    sr: { zh: 'SR 工单预警', en: 'SR Ticket Alerts' },
    other: { zh: '其他临期数据', en: 'Other Expiring Items' }
};

const SLA_STATUS_TRANSLATIONS = [
    ['漏洞紧急', 'Vulnerability urgent'],
    ['漏洞提醒', 'Vulnerability warning'],
    ['Checking紧急', 'Checking urgent'],
    ['Checking提醒', 'Checking warning'],
    ['整改紧急', 'Rectification urgent'],
    ['整改提醒', 'Rectification warning'],
    ['Confirm紧急', 'Confirm urgent'],
    ['Confirm提醒', 'Confirm warning'],
    ['Open紧急', 'Open urgent'],
    ['Open提醒', 'Open warning'],
    ['Suspend紧急', 'Suspend urgent'],
    ['Suspend提醒', 'Suspend warning'],
    ['确认紧急', 'Confirmation urgent'],
    ['确认提醒', 'Confirmation warning'],
    ['处理紧急', 'Processing urgent'],
    ['处理提醒', 'Processing warning'],
    ['Critical高危', 'Critical high risk'],
    ['Critical预警', 'Critical warning'],
    ['SR高危', 'SR high risk'],
    ['SR预警', 'SR warning'],
    ['SR超期', 'SR overdue'],
    ['挂起后未超期', 'Not overdue after suspension'],
    ['挂起后超期', 'Overdue after suspension'],
    ['历史超期', 'Historical overdue'],
    ['挂起忽略', 'Pending ignored'],
    ['已关单', 'Closed'],
    ['缺少SLA关键时间', 'Missing SLA key time'],
    ['解析失败', 'Parse failed'],
    ['已触发上游超期标识', 'Upstream overdue flag triggered'],
    ['剩余', 'remaining'],
    ['消耗', 'consumed'],
    ['已超', 'overdue by'],
    ['小时', 'hours'],
    ['天', 'days'],
    ['周', 'weeks'],
    ['月', 'months']
];

function getCollectionLabel(collection, lang = 'zh-CN') {
    const label = ALERT_COLLECTION_LABELS[collection] || ALERT_COLLECTION_LABELS.other;
    return normalizeLang(lang) === 'en-US' ? label.en : label.zh;
}

function translateSlaStatusText(text) {
    let out = String(text || '');
    out = out
        .replace(/(\d+)\s*月\s*(\d+)\s*天/g, (_, months, days) => `${months} ${Number(months) === 1 ? 'month' : 'months'} ${days} ${Number(days) === 1 ? 'day' : 'days'}`)
        .replace(/(\d+)\s*周\s*(\d+)\s*天/g, (_, weeks, days) => `${weeks} ${Number(weeks) === 1 ? 'week' : 'weeks'} ${days} ${Number(days) === 1 ? 'day' : 'days'}`)
        .replace(/(\d+)\s*小时/g, (_, hours) => `${hours} ${Number(hours) === 1 ? 'hour' : 'hours'}`)
        .replace(/(\d+)\s*天/g, (_, days) => `${days} ${Number(days) === 1 ? 'day' : 'days'}`)
        .replace(/(\d+)\s*周/g, (_, weeks) => `${weeks} ${Number(weeks) === 1 ? 'week' : 'weeks'}`)
        .replace(/(\d+)\s*月/g, (_, months) => `${months} ${Number(months) === 1 ? 'month' : 'months'}`);
    SLA_STATUS_TRANSLATIONS.forEach(([zh, en]) => {
        out = out.replace(new RegExp(zh, 'g'), en);
    });
    return out;
}

function parseSlaStatusText(text, item = {}) {
    const raw = String(text || '').trim();
    const days = Number(item && item._slaDays);
    const statusMatch = raw.match(/^([^()（]+?)\s*[（(]/) || raw.match(/^([^/]+?)\s+剩余/);
    const remainingMatch = raw.match(/剩余\s*([^/),，）]+)/);
    const consumedMatch = raw.match(/消耗\s*(\d+(?:\.\d+)?)%/);
    const overdueMatch = raw.match(/已超\s*([^/),，）]+)/) || raw.match(/超期\s*[（(]([^/),，）]+)/);
    return {
        raw_text: raw,
        remaining_text: remainingMatch ? remainingMatch[1].trim() : null,
        overdue_text: overdueMatch ? overdueMatch[1].trim() : null,
        consume_percent: consumedMatch ? Number(consumedMatch[1]) : null,
        sla_days: Number.isFinite(days) ? days : null,
        status_label: statusMatch ? statusMatch[1].trim() : null,
        is_overdue: Number.isFinite(days) ? days < 0 : /超期|已超/.test(raw)
    };
}

function getSlaTextI18n(text) {
    const zh = String(text || '');
    return {
        zh,
        en: translateSlaStatusText(zh)
    };
}

function normalizeExpiringTicket(item, snapshot, schema) {
    const data = item && typeof item.data === 'object' ? item.data : {};
    const days = Number(item && item._slaDays);
    const collection = item.collection || 'other';
    const collectionLabel = ALERT_COLLECTION_LABELS[collection] || ALERT_COLLECTION_LABELS.other;
    const slaText = item._slaCleanText || data._slaCleanText || '';
    const slaTextI18n = getSlaTextI18n(slaText);
    const out = {
        snapshot_id: snapshot ? snapshot.snapshot_id : null,
        month: snapshot ? snapshot.month : null,
        snapshot_created_at: snapshot ? snapshot.created_at : null,
        collection,
        collection_label: collectionLabel.zh,
        collection_label_i18n: collectionLabel,
        display_collection_label: getCollectionLabel(collection, schema && schema.lang),
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
        sla_text: slaText,
        sla_text_i18n: slaTextI18n,
        display_sla_text: normalizeLang(schema && schema.lang) === 'en-US' ? slaTextI18n.en : slaTextI18n.zh,
        sla_status: parseSlaStatusText(slaText, item),
        raw: item
    };
    decorateText(out, 'title', out.title, schema);
    decorateText(out, 'collection', out.collection, schema);
    decorateText(out, 'status', out.status, schema);
    return out;
}

function normalizeSpecialMetricAlert(item, snapshot, schema) {
    const out = {
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
    decorateText(out, 'title', out.title, schema);
    decorateText(out, 'metric_label', out.metric_label, schema);
    return out;
}

function parseRawAlerts(snapshotRow, schema) {
    const raw = parseRawData(snapshotRow);
    const tickets = Array.isArray(raw.expiringTickets) ? raw.expiringTickets : [];
    const metricAlerts = Array.isArray(raw.specialMetricAlerts) ? raw.specialMetricAlerts : [];
    return {
        expiring_tickets: tickets.map(item => normalizeExpiringTicket(item, snapshotRow, schema)),
        special_metric_alerts: metricAlerts.map(item => normalizeSpecialMetricAlert(item, snapshotRow, schema))
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

function normalizeDays(value) {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return 30;
    return Math.min(parsed, 3650);
}

function getDateTimeCutoff(days) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .replace('T', ' ')
        .substring(0, 19);
}

async function listSnapshots(filters = {}) {
    const limit = parsePositiveInt(filters.limit, 50, 500);
    const offset = Math.max(0, parseInt(filters.offset, 10) || 0);
    const where = buildSnapshotWhere(filters);
    const rows = await all(
        `SELECT id, snapshot_id, month, created_at, stored_at, standard_total_score, image_path, excel_path
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
    const schema = await getMetricSchema(filters);
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
        alerts: parseRawAlerts(snapshot, schema)
    };
}

async function listMetrics(filters = {}) {
    const schema = await getMetricSchema(filters);
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

    let derivedRows = [];
    if (filters.includeOverall || filters.category === '整体') {
        derivedRows = await getDerivedOverallMetricRows(filters, schema);
    }
    const normalizedItems = rows
        .concat(derivedRows)
        .sort((a, b) => {
            const aSort = a.snapshot_sort_id || 0;
            const bSort = b.snapshot_sort_id || 0;
            if (aSort !== bSort) return bSort - aSort;
            return String(a.cat_name || '').localeCompare(String(b.cat_name || ''));
        })
        .map(row => normalizeMetric(row, schema));

    return {
        items: normalizedItems,
        pagination: {
            limit,
            offset,
            total: (countRow ? countRow.count : 0) + derivedRows.length
        }
    };
}

async function getDerivedOverallMetricRows(filters = {}, schema) {
    if (filters.category && filters.category !== '整体') return [];
    const month = normalizeMonth(filters.month);
    const where = [];
    const params = [];
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
    const rows = await all(
        `SELECT id, snapshot_id, month, created_at, stored_at, raw_data_json
         FROM ReportSnapshots
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
        [...params, parsePositiveInt(filters.limit, 200, 2000)]
    );
    const labelFilter = filters.metricLabel ? String(filters.metricLabel) : '';
    const out = [];
    rows.forEach(snapshot => {
        const raw = parseRawData(snapshot);
        const metrics = Array.isArray(raw.topMetrics) ? raw.topMetrics : [];
        metrics.forEach(metric => {
            if (!metric || !metric.label) return;
            if (labelFilter && !String(metric.label).includes(labelFilter)) return;
            const row = buildDerivedOverallMetricRow(snapshot, metric, schema);
            if (!row) return;
            if (filters.failingOnly && !row.is_failing) return;
            out.push(row);
        });
    });
    return out;
}

function normalizeTrendPoint(row, schema) {
    const metric = normalizeMetric(row, schema);
    return {
        snapshot_id: row.snapshot_id,
        snapshot_row_id: row.snapshot_row_id || row.snapshot_sort_id || null,
        month: row.month,
        snapshot_created_at: row.snapshot_created_at || row.created_at || null,
        stored_at: row.stored_at || null,
        standard_total_score: row.standard_total_score,
        category: metric.category,
        category_i18n: metric.category_i18n,
        display_category: metric.display_category,
        metric_label: metric.metric_label,
        metric_label_i18n: metric.metric_label_i18n,
        display_metric_label: metric.display_metric_label,
        target_value: metric.target_value,
        display_target_value: metric.display_target_value,
        target_numeric_value: metric.target_numeric_value,
        target_is_percent: metric.target_is_percent,
        raw_value: metric.raw_value,
        numeric_value: metric.numeric_value,
        is_failing: metric.is_failing,
        gap: metric.gap,
        weight: metric.weight,
        earned_score: metric.earned_score,
        proportional_scoring: metric.proportional_scoring,
        completion_ratio: metric.completion_ratio,
        is_derived_overall: metric.is_derived_overall,
        schema: metric.schema
    };
}

function addTrendDeltas(points) {
    const lastByCategory = new Map();
    return points.map(point => {
        const key = point.category || '整体';
        const prev = lastByCategory.get(key);
        const next = { ...point };
        if (prev && Number.isFinite(point.numeric_value) && Number.isFinite(prev.numeric_value)) {
            next.delta_numeric_value = Number((point.numeric_value - prev.numeric_value).toFixed(4));
        } else {
            next.delta_numeric_value = null;
        }
        if (prev && Number.isFinite(point.earned_score) && Number.isFinite(prev.earned_score)) {
            next.delta_earned_score = Number((point.earned_score - prev.earned_score).toFixed(4));
        } else {
            next.delta_earned_score = null;
        }
        next.previous_snapshot_id = prev ? prev.snapshot_id : null;
        lastByCategory.set(key, point);
        return next;
    });
}

async function getMetricTrend(filters = {}) {
    if (!filters.metricLabel) {
        const err = new Error('metric_label is required');
        err.statusCode = 400;
        throw err;
    }

    const schema = await getMetricSchema(filters);
    const days = normalizeDays(filters.days);
    const month = normalizeMonth(filters.month);
    const where = ['m.metric_label = ?'];
    const params = [String(filters.metricLabel)];
    const wantsOverall = !filters.category || filters.category === '整体' || filters.includeOverall;
    const wantsDbRows = filters.category !== '整体';

    if (filters.category && filters.category !== '整体') {
        where.push('m.cat_name = ?');
        params.push(String(filters.category));
    }
    if (month) {
        where.push('m.month = ?');
        params.push(month);
    }
    if (filters.startDate) {
        where.push('DATE(s.created_at) >= ?');
        params.push(String(filters.startDate));
    } else {
        where.push('s.created_at >= ?');
        params.push(getDateTimeCutoff(days));
    }
    if (filters.endDate) {
        where.push('DATE(s.created_at) <= ?');
        params.push(String(filters.endDate));
    }

    const limit = parsePositiveInt(filters.limit, 1000, 5000);
    const rows = wantsDbRows
        ? await all(
            `SELECT m.*,
                    s.id AS snapshot_row_id,
                    s.created_at AS snapshot_created_at,
                    s.stored_at AS stored_at,
                    s.standard_total_score AS standard_total_score
             FROM ReportMetricData m
             INNER JOIN ReportSnapshots s
                ON s.snapshot_id = m.snapshot_id
               AND (s.month = m.month OR m.month IS NULL)
             WHERE ${where.join(' AND ')}
             ORDER BY s.created_at ASC, s.id ASC, m.cat_name ASC, m.id ASC
             LIMIT ?`,
            [...params, limit]
        )
        : [];
    const derivedRows = wantsOverall
        ? await getDerivedOverallTrendRows(filters, schema, { days, month, limit })
        : [];
    const points = addTrendDeltas(rows
        .concat(derivedRows)
        .sort((a, b) => {
            const at = Date.parse(a.snapshot_created_at || a.created_at || '') || 0;
            const bt = Date.parse(b.snapshot_created_at || b.created_at || '') || 0;
            if (at !== bt) return at - bt;
            const ai = a.snapshot_row_id || a.snapshot_sort_id || 0;
            const bi = b.snapshot_row_id || b.snapshot_sort_id || 0;
            if (ai !== bi) return ai - bi;
            return String(a.cat_name || '').localeCompare(String(b.cat_name || ''));
        })
        .map(row => normalizeTrendPoint(row, schema)));
    const series = {};
    points.forEach(point => {
        const key = point.category || '整体';
        if (!series[key]) {
            series[key] = {
                category: point.category,
                category_i18n: point.category_i18n,
                display_category: point.display_category,
                points: []
            };
        }
        series[key].points.push(point);
    });

    const firstSchema = points.find(point => point.schema)?.schema || null;
    const metricLabelI18n = getTranslatedText(filters.metricLabel, schema.i18nMap);
    return {
        query: {
            metric_label: String(filters.metricLabel),
            metric_label_i18n: metricLabelI18n,
            display_metric_label: normalizeLang(filters.lang) === 'en-US' ? metricLabelI18n.en : metricLabelI18n.zh,
            category: filters.category || null,
            days,
            month: month || null,
            startDate: filters.startDate || null,
            endDate: filters.endDate || null,
            limit
        },
        metric_schema: firstSchema,
        point_count: points.length,
        categories: Object.values(series).map(item => ({
            category: item.category,
            category_i18n: item.category_i18n,
            display_category: item.display_category,
            point_count: item.points.length
        })),
        series,
        points
    };
}

async function getDerivedOverallTrendRows(filters = {}, schema, options = {}) {
    const month = options.month || normalizeMonth(filters.month);
    const days = options.days || normalizeDays(filters.days);
    const limit = options.limit || parsePositiveInt(filters.limit, 1000, 5000);
    const where = [];
    const params = [];
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
    } else {
        where.push('created_at >= ?');
        params.push(getDateTimeCutoff(days));
    }
    if (filters.endDate) {
        where.push('DATE(created_at) <= ?');
        params.push(String(filters.endDate));
    }
    const snapshots = await all(
        `SELECT id, snapshot_id, month, created_at, stored_at, standard_total_score, raw_data_json
         FROM ReportSnapshots
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY created_at ASC, id ASC
         LIMIT ?`,
        [...params, limit]
    );
    const label = String(filters.metricLabel || '');
    const out = [];
    snapshots.forEach(snapshot => {
        const raw = parseRawData(snapshot);
        const metric = (Array.isArray(raw.topMetrics) ? raw.topMetrics : []).find(item => item && item.label === label);
        if (!metric) return;
        const row = buildDerivedOverallMetricRow(snapshot, metric, schema);
        if (row) out.push(row);
    });
    return out;
}

async function getSummary(filters = {}) {
    const schema = await getMetricSchema(filters);
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
        latest_alerts: parseRawAlerts(latestRow, schema),
        latest_expiring_ticket_count: latestRow ? parseRawAlerts(latestRow, schema).expiring_tickets.length : 0,
        latest_special_metric_alert_count: latestRow ? parseRawAlerts(latestRow, schema).special_metric_alerts.length : 0
    };
}

async function getAlerts(filters = {}) {
    const schema = await getMetricSchema(filters);
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
    const alerts = parseRawAlerts(snapshotRow, schema);
    const expiringTickets = filterAlerts(alerts.expiring_tickets, filters);
    return {
        snapshot: normalizeSnapshot(snapshotRow),
        expiring_ticket_count: expiringTickets.length,
        special_metric_alert_count: alerts.special_metric_alerts.length,
        expiring_tickets: expiringTickets,
        special_metric_alerts: alerts.special_metric_alerts
    };
}

async function getSchema(filters = {}) {
    const schema = await getMetricSchema(filters);
    return {
        sources: schema.sources,
        metrics: schema.metrics.map(item => ({
            source_id: item.source.source_id,
            source_title: item.source.title,
            source_title_i18n: item.source.title_i18n,
            display_source_title: item.source.display_title,
            source_base_name: item.source.base_name,
            main_metric_label: item.main_metric_label,
            main_metric_label_i18n: getTranslatedText(item.main_metric_label, schema.i18nMap),
            display_main_metric_label: getDisplayText(item.main_metric_label, schema.i18nMap, schema.lang),
            metric_label: item.metric_label,
            metric_label_i18n: getTranslatedText(item.metric_label, schema.i18nMap),
            display_metric_label: getDisplayText(item.metric_label, schema.i18nMap, schema.lang),
            category: item.category,
            category_i18n: getTranslatedText(item.category, schema.i18nMap),
            display_category: getDisplayText(item.category, schema.i18nMap, schema.lang),
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
    getMetricTrend,
    getSchema,
    getAlerts,
    closeDatabase
};
