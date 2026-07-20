const DATAFAB_PROFILE = 'DATAFAB';
const NETCARE_PROFILE = 'NETCARE';
const GENERIC_PROFILE = 'GENERIC';
const DATAFAB_HOSTS = new Set(['datafab-pro.gtsdata.huawei.com']);
const NETCARE_HOSTS = new Set([
    'netcare.huawei.com',
    'netcare-ae.gts.huawei.com',
    'netcare-de.gts.huawei.com'
]);

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasKeyDeep(value, keys, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 8) return false;
    if (Array.isArray(value)) {
        return value.slice(0, 20).some(item => hasKeyDeep(item, keys, depth + 1));
    }
    if (Object.keys(value).some(key => keys.has(String(key).toLowerCase()))) return true;
    return Object.values(value).slice(0, 80).some(item => hasKeyDeep(item, keys, depth + 1));
}

function normalizeHeaders(headers) {
    if (!isObject(headers)) return {};
    return Object.fromEntries(Object.entries(headers).map(([key, value]) => [String(key).toLowerCase(), value]));
}

function normalizePath(value) {
    const normalized = String(value || '')
        .trim()
        .replace(/^\$\.?/, '')
        .replace(/\[(\d+)\]/g, '.$1');
    if (!normalized) return '';
    const keys = normalized.split('.');
    if (keys.some(key => !key || ['__proto__', 'prototype', 'constructor'].includes(key.toLowerCase()))) return '';
    return keys.join('.');
}

function getAtPath(value, path) {
    const normalized = normalizePath(path);
    if (!normalized) return value;
    return normalized.split('.').filter(Boolean).reduce((current, key) => {
        if (current === null || current === undefined || !Object.prototype.hasOwnProperty.call(Object(current), key)) return undefined;
        return current[key];
    }, value);
}

function pushSignal(target, points, message) {
    target.score += points;
    target.evidence.push(message);
}

function detectNativeGenerationPlan(input = {}) {
    const rawUrl = String(input.url || '');
    let hostname = '';
    let pathname = '';
    let secureDefaultPort = false;
    try {
        const parsedUrl = new URL(rawUrl);
        hostname = parsedUrl.hostname.toLowerCase();
        pathname = parsedUrl.pathname.toLowerCase();
        secureDefaultPort = parsedUrl.protocol === 'https:' && (!parsedUrl.port || parsedUrl.port === '443');
    } catch (_) {}
    const method = String(input.method || (input.adapter && input.adapter.request && input.adapter.request.method) || 'POST').toUpperCase();
    const bodyType = String(input.adapter && input.adapter.request && input.adapter.request.bodyType || (method === 'GET' ? 'none' : 'json'));
    const headers = normalizeHeaders(input.headers);
    const payload = input.requestBody;
    const response = input.responseSample;
    const rowsPath = normalizePath(input.adapter && input.adapter.response && input.adapter.response.rowsPath);
    const adaptedRows = getAtPath(response, rowsPath);
    const datafab = { score: 0, evidence: [] };
    const netcare = { score: 0, evidence: [] };

    const datafabHost = secureDefaultPort && DATAFAB_HOSTS.has(hostname);
    const netcareHost = secureDefaultPort && NETCARE_HOSTS.has(hostname);
    if (datafabHost) pushSignal(datafab, 10, '请求域名命中 DataFab');
    if (/datafabkernelcn|getanswers|getvaluetablesumdata/.test(pathname)) {
        pushSignal(datafab, 4, '接口路径命中 DataFab 抓取服务');
    }
    if (netcareHost) pushSignal(netcare, 10, '请求域名命中 NetCare');
    if (/adc-service|op_ex_|special_nid/.test(pathname)) {
        pushSignal(netcare, 3, '接口路径命中 NetCare 服务特征');
    }

    const hasAnswerParamList = isObject(payload) && Array.isArray(payload.answerParamList);
    if (hasAnswerParamList) {
        pushSignal(datafab, 5, '请求负载包含 answerParamList');
    }
    if (hasKeyDeep(payload, new Set(['srctenantid']))) pushSignal(datafab, 2, '请求负载包含 srcTenantId');
    if (hasKeyDeep(payload, new Set(['boardid']))) pushSignal(datafab, 2, '请求负载包含 boardId');
    if (hasKeyDeep(payload, new Set(['pageid']))) pushSignal(datafab, 2, '请求负载包含 pageId');

    const datafabRowsAtRoot = isObject(response)
        && Array.isArray(response.data)
        && response.data[0]
        && Array.isArray(response.data[0].data);
    const rowsContainObjects = Array.isArray(adaptedRows) && adaptedRows.some(row => isObject(row));
    const datafabRows = (datafabRowsAtRoot
        || (Array.isArray(adaptedRows) && /(?:^|\.)data\.0\.data$/.test(rowsPath)))
        && rowsContainObjects;
    if (datafabRows) pushSignal(datafab, 5, '响应符合 data[0].data 明细结构');
    if (hasKeyDeep(response, new Set(['totalsdata', 'sumdata']))) {
        pushSignal(datafab, 3, '响应包含 totalsData/sumData 汇总结构');
    }
    if (headers['x-xsrf-token'] || headers['x-netlive-xsrf-token']) {
        pushSignal(datafab, 3, '请求头包含 DataFab XSRF 认证字段');
    }
    if (headers.tenantid || headers['project-id'] || headers['session-affinity-key']) {
        pushSignal(datafab, 2, '请求头包含 DataFab 租户/项目字段');
    }

    const hasNetcareSummary = hasKeyDeep(payload, new Set(['need_summary']));
    const hasNetcareNid = hasKeyDeep(payload, new Set(['nid', 'nid_name']));
    const hasNetcarePagination = hasKeyDeep(payload, new Set(['start', 'offset', 'limit', 'page', 'pagenum', 'pageindex', 'pagesize']));
    if (hasNetcareSummary) pushSignal(netcare, 3, '请求负载包含 need_summary');
    if (hasNetcareNid) pushSignal(netcare, 2, '请求负载包含 NID 筛选字段');
    if (hasNetcarePagination) pushSignal(netcare, 2, '请求负载包含 NetCare 常用分页字段');
    const netcareRowsAtRoot = isObject(response)
        && isObject(response.data)
        && ['data', 'list', 'items', 'records'].some(key => Array.isArray(response.data[key]));
    const netcareRows = (netcareRowsAtRoot
        || (Array.isArray(adaptedRows) && /(?:^|\.)data\.(?:data|list|items|records)$/.test(rowsPath)))
        && rowsContainObjects;
    if (netcareRows) pushSignal(netcare, 3, '响应符合 data.data/list/items/records 明细结构');
    if (rowsContainObjects) {
        pushSignal(netcare, 1, '响应数组包含标准表格对象行');
    }
    if (input.adapter && input.adapter.pagination && input.adapter.pagination.type !== 'none') {
        pushSignal(netcare, 2, 'AI 已验证分页类型和请求路径');
    }
    if (headers['x-gde-csrf-token']) pushSignal(netcare, 5, '请求头包含 NetCare CSRF 认证字段');

    const eligibleRequest = method === 'POST' && bodyType === 'json' && isObject(payload);
    const datafabStructureMatch = hasAnswerParamList && Boolean(datafabRows);
    const netcareStructureMatch = Boolean(netcareRows) && (hasNetcareSummary || hasNetcareNid || hasNetcarePagination);
    const candidates = [
        { profile: DATAFAB_PROFILE, nativeHost: datafabHost, threshold: 9, structureMatch: datafabStructureMatch, ...datafab },
        { profile: NETCARE_PROFILE, nativeHost: netcareHost, threshold: 8, structureMatch: netcareStructureMatch, ...netcare }
    ].sort((left, right) => right.score - left.score);
    const officialNetcare = candidates.find(candidate => candidate.profile === NETCARE_PROFILE && candidate.nativeHost);
    if (eligibleRequest && officialNetcare && !officialNetcare.structureMatch) {
        officialNetcare.evidence.push('官方 NetCare POST JSON 请求优先复用成熟生成引擎');
    }
    const winner = officialNetcare || candidates.find(candidate => candidate.structureMatch && candidate.score >= candidate.threshold);
    const matched = eligibleRequest && Boolean(winner);

    if (!matched) {
        const reason = !eligibleRequest
            ? '成熟模板当前只接管 POST JSON 请求'
            : '未达到 DataFab/NetCare 成熟模板的结构匹配阈值';
        return {
            mode: 'generic',
            profile: GENERIC_PROFILE,
            confidence: 0,
            nativeHost: false,
            evidence: [reason],
            capabilities: {
                reuseNativeExtraction: false,
                allowSpecialEndpoints: false,
                preferPagination: false
            }
        };
    }

    const confidence = 0.7 + Math.min(1, Math.max(0, winner.score - winner.threshold) / 10) * 0.3;
    return {
        mode: 'native-hybrid',
        profile: winner.profile,
        confidence: Math.min(1, Number(confidence.toFixed(2))),
        nativeHost: winner.nativeHost,
        evidence: winner.evidence.slice(0, 8),
        capabilities: {
            reuseNativeExtraction: true,
            allowSpecialEndpoints: winner.nativeHost,
            preferPagination: Boolean(input.adapter && input.adapter.pagination && input.adapter.pagination.type !== 'none')
        }
    };
}

module.exports = {
    DATAFAB_PROFILE,
    NETCARE_PROFILE,
    GENERIC_PROFILE,
    detectNativeGenerationPlan
};
