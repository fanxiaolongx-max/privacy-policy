const express = require('express');
const acorn = require('acorn');
const aiSettingsRepo = require('../models/ai-settings-repository');
const aiProviderClient = require('../models/ai-provider-client');

const router = express.Router();

const ALLOWED_METHODS = new Set(['GET', 'POST']);
const ALLOWED_BODY_TYPES = new Set(['none', 'json']);
const ALLOWED_PAGINATION_TYPES = new Set(['none', 'pageNumber', 'offset']);
const ALLOWED_AUTH_STRATEGIES = new Set(['none', 'cookie', 'localStorage', 'sessionStorage']);
const SENSITIVE_HEADER_RE = /authorization|cookie|token|secret|api[-_]?key|csrf|xsrf/i;
const SAFE_HEADER_VALUE_RE = /^(accept|content-type|x-requested-with|language)$/i;
const MAX_AI_SAMPLE_CHARS = 120000;
const MAX_FETCH_SOURCE_CHARS = 200000;
const AI_SAMPLE_CONFIGS = [
    { maxDepth: 8, maxArrayItems: 8, maxObjectKeys: 120, maxStringLength: 1200 },
    { maxDepth: 7, maxArrayItems: 5, maxObjectKeys: 80, maxStringLength: 800 },
    { maxDepth: 6, maxArrayItems: 3, maxObjectKeys: 50, maxStringLength: 500 },
    { maxDepth: 5, maxArrayItems: 2, maxObjectKeys: 35, maxStringLength: 300 }
];

function readStaticAstValue(node, depth = 0) {
    if (!node || depth > 20) throw new Error('fetch 内容嵌套过深');
    if (node.type === 'Literal') return node.value;
    if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
        return node.quasis.map(item => item.value.cooked || '').join('');
    }
    if (node.type === 'ObjectExpression') {
        const output = {};
        node.properties.forEach(property => {
            if (property.type !== 'Property' || property.kind !== 'init' || property.computed || property.method) {
                throw new Error('fetch 对象中包含不支持的动态属性');
            }
            const key = property.key.type === 'Identifier'
                ? property.key.name
                : readStaticAstValue(property.key, depth + 1);
            output[String(key)] = readStaticAstValue(property.value, depth + 1);
        });
        return output;
    }
    if (node.type === 'ArrayExpression') {
        return node.elements.map(item => readStaticAstValue(item, depth + 1));
    }
    if (node.type === 'UnaryExpression' && ['-', '+'].includes(node.operator)) {
        const value = readStaticAstValue(node.argument, depth + 1);
        if (typeof value !== 'number') throw new Error('fetch 中的一元运算只允许数字');
        return node.operator === '-' ? -value : value;
    }
    if (
        node.type === 'CallExpression' &&
        node.callee &&
        node.callee.type === 'MemberExpression' &&
        !node.callee.computed &&
        node.callee.object.type === 'Identifier' &&
        node.callee.object.name === 'JSON' &&
        node.callee.property.type === 'Identifier' &&
        node.callee.property.name === 'stringify' &&
        node.arguments.length === 1
    ) {
        return JSON.stringify(readStaticAstValue(node.arguments[0], depth + 1));
    }
    throw new Error(`fetch 中包含不支持的动态表达式：${node.type}`);
}

function unwrapFetchExpression(node) {
    let current = node;
    while (current && ['AwaitExpression', 'ChainExpression'].includes(current.type)) {
        current = current.argument || current.expression;
    }
    return current;
}

function parseCopyAsFetch(source) {
    const text = String(source || '').trim();
    if (!text) throw new Error('请粘贴浏览器 Copy as fetch 的内容');
    if (text.length > MAX_FETCH_SOURCE_CHARS) throw new Error('Copy as fetch 内容过大');
    const program = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'script' });
    const statement = program.body.find(item => item.type === 'ExpressionStatement');
    const expression = statement && unwrapFetchExpression(statement.expression);
    if (
        !expression ||
        expression.type !== 'CallExpression' ||
        expression.callee.type !== 'Identifier' ||
        expression.callee.name !== 'fetch'
    ) {
        throw new Error('未识别到标准 fetch(...) 调用');
    }
    if (!expression.arguments.length || expression.arguments.length > 2) {
        throw new Error('fetch 参数数量不受支持');
    }
    const url = String(readStaticAstValue(expression.arguments[0]) || '').trim();
    let parsedUrl;
    try {
        parsedUrl = new URL(url);
    } catch (error) {
        throw new Error('fetch 请求 URL 无效');
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('仅支持 HTTP/HTTPS URL');

    const options = expression.arguments[1] ? readStaticAstValue(expression.arguments[1]) : {};
    if (!options || Array.isArray(options) || typeof options !== 'object') throw new Error('fetch options 必须是对象');
    const method = String(options.method || (options.body === undefined ? 'GET' : 'POST')).toUpperCase();
    if (!ALLOWED_METHODS.has(method)) throw new Error('第一版仅支持 GET/POST');
    const headers = options.headers || {};
    if (!headers || Array.isArray(headers) || typeof headers !== 'object') throw new Error('fetch headers 必须是对象');

    let requestBody = {};
    if (options.body !== undefined && options.body !== null && options.body !== '') {
        if (typeof options.body !== 'string') throw new Error('第一版仅支持 JSON 字符串请求体');
        try {
            requestBody = JSON.parse(options.body);
        } catch (error) {
            throw new Error('fetch body 不是合法 JSON；第一版暂不支持 FormData 或表单字符串');
        }
    }
    return {
        url,
        method,
        headers: normalizeHeaders(headers),
        requestBody,
        credentials: options.credentials === 'omit' ? 'omit' : 'include'
    };
}

function parseJsonValue(value, label, options = {}) {
    if (value === undefined || value === null || value === '') {
        if (options.optional) return options.fallback;
        throw new Error(`${label}不能为空`);
    }
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(String(value));
    } catch (error) {
        throw new Error(`${label}不是合法 JSON`);
    }
}

function stripJsonFence(value) {
    return String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
}

function parseAiJson(value) {
    const raw = stripJsonFence(value);
    try {
        return JSON.parse(raw);
    } catch (firstError) {
        try {
            const start = raw.indexOf('{');
            const end = raw.lastIndexOf('}');
            if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
        } catch (secondError) {
            const preview = raw.slice(0, 600).replace(/\s+/g, ' ').trim();
            throw new Error(`AI 返回的适配器 JSON 格式异常：${secondError.message}。输出预览：${preview}`);
        }
        const preview = raw.slice(0, 600).replace(/\s+/g, ' ').trim();
        throw new Error(`AI 返回的适配器 JSON 格式异常：${firstError.message}。输出预览：${preview}`);
    }
}

function normalizePath(value) {
    const path = String(value || '')
        .trim()
        .replace(/^\$\.?/, '')
        .replace(/\[(\d+)\]/g, '.$1');
    if (!path) return '';
    if (!/^[A-Za-z0-9_$.-]+$/.test(path)) throw new Error(`数据路径包含不支持的字符：${path}`);
    return path;
}

function getAtPath(value, path) {
    if (!path) return value;
    return normalizePath(path).split('.').filter(Boolean).reduce((current, key) => {
        if (current === null || current === undefined) return undefined;
        return current[key];
    }, value);
}

function joinPaths(prefix, path) {
    const left = normalizePath(prefix);
    const right = normalizePath(path);
    if (!left) return right;
    if (!right) return left;
    if (right === left || right.startsWith(`${left}.`)) return right;
    return `${left}.${right}`;
}

function normalizeHeaders(value) {
    const headers = parseJsonValue(value, '请求头', { optional: true, fallback: {} });
    if (!headers || Array.isArray(headers) || typeof headers !== 'object') {
        throw new Error('请求头必须是 JSON 对象');
    }
    return Object.fromEntries(
        Object.entries(headers)
            .slice(0, 60)
            .map(([key, headerValue]) => [String(key).slice(0, 100), String(headerValue).slice(0, 4000)])
    );
}

function redactHeaders(headers) {
    return Object.fromEntries(Object.entries(headers).map(([key, value]) => {
        if (SENSITIVE_HEADER_RE.test(key)) return [key, '{{REDACTED_SENSITIVE_VALUE}}'];
        return [key, SAFE_HEADER_VALUE_RE.test(key) ? value : '{{VALUE_OMITTED}}'];
    }));
}

function redactSensitiveObject(value, depth = 0) {
    if (depth > 12) return '{{DEPTH_LIMIT}}';
    if (Array.isArray(value)) return value.slice(0, 200).map(item => redactSensitiveObject(item, depth + 1));
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).slice(0, 300).map(([key, child]) => {
        if (SENSITIVE_HEADER_RE.test(key)) return [key, '{{REDACTED_SENSITIVE_VALUE}}'];
        return [key, redactSensitiveObject(child, depth + 1)];
    }));
}

function jsonSize(value) {
    return JSON.stringify(value).length;
}

function sampleJsonValue(value, config, depth = 0) {
    if (depth > config.maxDepth) return { value: '{{DEPTH_LIMIT}}', truncated: true };
    if (typeof value === 'string') {
        if (value.length > config.maxStringLength) {
            return {
                value: `${value.slice(0, config.maxStringLength)}…{{STRING_TRUNCATED:${value.length}}}`,
                truncated: true
            };
        }
        return { value, truncated: false };
    }
    if (!value || typeof value !== 'object') return { value, truncated: false };
    if (Array.isArray(value)) {
        let truncated = value.length > config.maxArrayItems;
        const items = value.slice(0, config.maxArrayItems).map(item => {
            const sampled = sampleJsonValue(item, config, depth + 1);
            if (sampled.truncated) truncated = true;
            return sampled.value;
        });
        return { value: items, truncated };
    }
    const entries = Object.entries(value);
    let truncated = entries.length > config.maxObjectKeys;
    const sampledEntries = entries.slice(0, config.maxObjectKeys).map(([key, child]) => {
        const sampled = sampleJsonValue(child, config, depth + 1);
        if (sampled.truncated) truncated = true;
        return [key, sampled.value];
    });
    return { value: Object.fromEntries(sampledEntries), truncated };
}

function prepareAiSample(value, label) {
    const originalChars = jsonSize(value);
    for (const config of AI_SAMPLE_CONFIGS) {
        const sampled = sampleJsonValue(redactSensitiveObject(value), config);
        const sampledChars = jsonSize(sampled.value);
        if (sampledChars <= MAX_AI_SAMPLE_CHARS) {
            return {
                value: sampled.value,
                info: {
                    label,
                    originalChars,
                    sampledChars,
                    truncated: sampled.truncated || sampledChars < originalChars
                }
            };
        }
    }
    throw new Error(`${label}结构过大，自动抽样后仍超过 ${MAX_AI_SAMPLE_CHARS} 字符；请保留代表性字段后再试`);
}

function normalizeAdapter(raw, requestMethod) {
    const request = raw && typeof raw.request === 'object' ? raw.request : {};
    const auth = raw && typeof raw.auth === 'object' ? raw.auth : {};
    const pagination = raw && typeof raw.pagination === 'object' ? raw.pagination : {};
    const response = raw && typeof raw.response === 'object' ? raw.response : {};

    const method = String(request.method || requestMethod || 'POST').toUpperCase();
    const bodyType = String(request.bodyType || (method === 'GET' ? 'none' : 'json'));
    const authStrategy = String(auth.strategy || 'none');
    const paginationType = String(pagination.type || 'none');

    if (!ALLOWED_METHODS.has(method)) throw new Error(`AI 返回了不支持的请求方法：${method}`);
    if (!ALLOWED_BODY_TYPES.has(bodyType)) throw new Error(`AI 返回了不支持的请求体类型：${bodyType}`);
    if (!ALLOWED_AUTH_STRATEGIES.has(authStrategy)) throw new Error(`AI 返回了不支持的认证策略：${authStrategy}`);
    if (!ALLOWED_PAGINATION_TYPES.has(paginationType)) throw new Error(`AI 返回了不支持的分页类型：${paginationType}`);

    const adapter = {
        version: 1,
        request: {
            method,
            bodyType,
            credentials: request.credentials === 'omit' ? 'omit' : 'include'
        },
        auth: {
            strategy: authStrategy,
            sourceKey: String(auth.sourceKey || '').slice(0, 160),
            header: String(auth.header || '').slice(0, 100),
            prefix: String(auth.prefix || '').slice(0, 40)
        },
        pagination: {
            type: paginationType,
            requestPath: normalizePath(pagination.requestPath),
            pageSizePath: normalizePath(pagination.pageSizePath),
            start: Number.isFinite(Number(pagination.start)) ? Number(pagination.start) : 1,
            step: Math.max(1, Number.isFinite(Number(pagination.step)) ? Number(pagination.step) : 1)
        },
        response: {
            rowsPath: normalizePath(response.rowsPath),
            totalPath: normalizePath(response.totalPath)
        },
        notes: Array.isArray(raw.notes) ? raw.notes.map(item => String(item).slice(0, 300)).slice(0, 8) : []
    };

    if (adapter.pagination.type !== 'none' && !adapter.pagination.requestPath) {
        throw new Error('分页适配器缺少 requestPath');
    }
    return adapter;
}

function applyAuthHint(adapter, rawHint) {
    if (rawHint && typeof rawHint === 'object') {
        const strategy = String(rawHint.strategy || 'auto');
        if (strategy !== 'auto') {
            if (!ALLOWED_AUTH_STRATEGIES.has(strategy)) throw new Error('认证提示类型无效');
            adapter.auth = {
                strategy,
                sourceKey: String(rawHint.sourceKey || '').slice(0, 160),
                header: String(rawHint.header || '').slice(0, 100),
                prefix: String(rawHint.prefix || '').slice(0, 40)
            };
        }
    }
    if (adapter.auth.strategy !== 'none' && adapter.auth.strategy !== 'cookie' && (!adapter.auth.sourceKey || !adapter.auth.header)) {
        throw new Error('选择 localStorage/sessionStorage 认证时必须填写存储键和请求头名');
    }
    return adapter;
}

function validateAdapterAgainstSample(adapter, responseSample) {
    const rows = getAtPath(responseSample, adapter.response.rowsPath);
    if (!Array.isArray(rows)) {
        throw new Error(`响应路径 ${adapter.response.rowsPath || '(根节点)'} 未提取到数组`);
    }
    const fields = [];
    rows.slice(0, 20).forEach(row => {
        if (!row || Array.isArray(row) || typeof row !== 'object') return;
        Object.keys(row).forEach(key => {
            if (!fields.includes(key) && fields.length < 100) fields.push(key);
        });
    });
    const totalValue = adapter.response.totalPath
        ? getAtPath(responseSample, adapter.response.totalPath)
        : null;
    return {
        rowCount: rows.length,
        fields,
        totalValue: totalValue === undefined ? null : totalValue,
        previewRows: rows.slice(0, 5)
    };
}

function applyResponseFocus(adapter, focusPath) {
    const normalizedFocusPath = normalizePath(focusPath);
    if (!normalizedFocusPath) return adapter;
    adapter.response.rowsPath = joinPaths(normalizedFocusPath, adapter.response.rowsPath);
    if (adapter.response.totalPath) {
        adapter.response.totalPath = joinPaths(normalizedFocusPath, adapter.response.totalPath);
    }
    adapter.notes = [
        `已按关键词聚焦响应片段：${normalizedFocusPath}`,
        ...(adapter.notes || [])
    ].slice(0, 8);
    return adapter;
}

function buildPrompt(input) {
    return `你是 Tools Platform 的 JSON API 抓取适配器分析器。只分析结构，不生成 JavaScript。

仅允许：
- request.method: GET 或 POST
- request.bodyType: none 或 json
- auth.strategy: none、cookie、localStorage、sessionStorage
- pagination.type: none、pageNumber、offset
- 所有 path 使用点号路径，例如 data.records；数组下标使用 .0，例如 data.viewer.scope_0.0.records；根数组使用空字符串

请严格返回一个 JSON 对象，结构如下：
{
  "request": {"method":"POST","bodyType":"json","credentials":"include"},
  "auth": {"strategy":"none","sourceKey":"","header":"","prefix":""},
  "pagination": {"type":"none","requestPath":"","pageSizePath":"","start":1,"step":1},
  "response": {"rowsPath":"data.records","totalPath":"data.total"},
  "notes": ["简短说明"]
}

规则：
1. 不得输出 Markdown、代码围栏、函数或额外字段。
2. 不得猜测或还原已脱敏的 Token、Cookie、密钥。
3. rowsPath 必须指向响应样本中的数据数组，而不是包装对象。
4. 不能可靠判断分页时使用 none，并在 notes 说明。
5. 请求头中出现认证字段时，只有能从字段名判断存储键才选择 localStorage/sessionStorage；否则使用 cookie 或 none 并说明需要用户确认。
6. 输入中的样本可能已自动抽样；数组只保留了少量代表行，但字段路径仍按样本结构判断。
7. 如果 auth.strategy 是 none 或 cookie，auth.sourceKey、auth.header、auth.prefix 必须返回空字符串。
8. 只返回一个完整、可被 JSON.parse 解析的 JSON 对象，不要输出解释文本。
9. 不要使用 [0] 这种括号路径；数组下标必须写成 .0。
10. 如果输入里提供 responseFocus，responseSample 已经是聚焦片段；response.rowsPath 返回相对该片段的路径即可。

输入：
${JSON.stringify(input, null, 2)}`;
}

function buildRepairPrompt(input, invalidOutput) {
    return `你刚才返回的适配器 JSON 不完整或不合法。请重新分析输入，并只返回一个完整、严格、可被 JSON.parse 解析的 JSON 对象。

不要输出解释，不要输出 Markdown，不要沿用不完整片段。

只能返回这个结构：
{
  "request": {"method":"POST","bodyType":"json","credentials":"include"},
  "auth": {"strategy":"none","sourceKey":"","header":"","prefix":""},
  "pagination": {"type":"none","requestPath":"","pageSizePath":"","start":1,"step":1},
  "response": {"rowsPath":"","totalPath":""},
  "notes": []
}

约束：
- method 只能是 GET 或 POST
- bodyType 只能是 none 或 json
- auth.strategy 只能是 none、cookie、localStorage、sessionStorage
- pagination.type 只能是 none、pageNumber、offset
- 如果某个字段无法从原文可靠恢复，用安全默认值
- 只返回一个完整 JSON 对象
- rowsPath 必须指向响应样本中的数据数组
- 不要使用 [0] 这种括号路径；数组下标必须写成 .0
- 如果输入里提供 responseFocus，responseSample 已经是聚焦片段；response.rowsPath 返回相对该片段的路径即可

上次非法输出预览：
${String(invalidOutput || '').slice(0, 2000)}

输入：
${JSON.stringify(input, null, 2)}`;
}

router.post('/parse-fetch', (req, res) => {
    try {
        const parsed = parseCopyAsFetch(req.body && req.body.source);
        res.json({
            parsed,
            sensitiveHeaderNames: Object.keys(parsed.headers).filter(key => SENSITIVE_HEADER_RE.test(key))
        });
    } catch (error) {
        res.status(400).json({ error: error.message || 'Copy as fetch 解析失败' });
    }
});

router.post('/analyze', async (req, res) => {
    let stage = '初始化';
    const logs = [];
    const addLog = (message, type = 'info') => {
        logs.push({ message, type });
        console.info(`[UIVF12 AI Adapter] ${message}`);
    };
    try {
        stage = '校验 URL';
        addLog('开始校验 URL 和请求方法。', 'busy');
        const url = String(req.body && req.body.url || '').trim();
        let parsedUrl;
        try {
            parsedUrl = new URL(url);
        } catch (error) {
            return res.status(400).json({ error: '请求 URL 无效' });
        }
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return res.status(400).json({ error: '仅支持 HTTP/HTTPS URL' });
        }

        const method = String(req.body.method || 'POST').toUpperCase();
        if (!ALLOWED_METHODS.has(method)) {
            return res.status(400).json({ error: '第一版仅支持 GET/POST' });
        }
        stage = '解析输入 JSON';
        addLog('开始解析请求头、请求负载和响应样本。', 'busy');
        const headers = normalizeHeaders(req.body.headers);
        const requestBody = parseJsonValue(req.body.requestBody, '请求负载', {
            optional: method === 'GET',
            fallback: {}
        });
        const responseSample = parseJsonValue(req.body.responseSample, '响应样本');
        const secondResponseSample = parseJsonValue(req.body.secondResponseSample, '第二页响应样本', {
            optional: true,
            fallback: null
        });
        const responseFocusKeyword = String(req.body.responseFocusKeyword || '').trim().slice(0, 120);
        const responseFocusPath = normalizePath(req.body.responseFocusPath || '');
        let responseSampleForAnalysis = responseSample;
        let secondResponseSampleForAnalysis = secondResponseSample;
        if (responseFocusPath) {
            responseSampleForAnalysis = getAtPath(responseSample, responseFocusPath);
            if (responseSampleForAnalysis === undefined) {
                throw new Error(`关键词聚焦路径不存在：${responseFocusPath}`);
            }
            if (secondResponseSample) {
                const focusedSecond = getAtPath(secondResponseSample, responseFocusPath);
                secondResponseSampleForAnalysis = focusedSecond === undefined ? null : focusedSecond;
            }
            addLog(`已按关键词${responseFocusKeyword ? `“${responseFocusKeyword}”` : ''}聚焦响应片段：${responseFocusPath}`, 'ok');
        } else if (responseFocusKeyword) {
            addLog(`已收到关键词“${responseFocusKeyword}”，但未选择聚焦路径，将使用完整响应样本。`, 'info');
        }
        stage = '样本抽样脱敏';
        addLog('输入 JSON 解析完成，开始自动抽样和敏感字段脱敏。', 'busy');
        const requestBodySample = prepareAiSample(requestBody, '请求负载');
        const responseSampleForAi = prepareAiSample(responseSampleForAnalysis, responseFocusPath ? '聚焦响应样本' : '响应样本');
        const secondResponseSampleForAi = secondResponseSampleForAnalysis
            ? prepareAiSample(secondResponseSampleForAnalysis, responseFocusPath ? '聚焦第二页响应样本' : '第二页响应样本')
            : { value: null, info: null };
        addLog(`样本准备完成：${responseSampleForAi.info.label} ${responseSampleForAi.info.originalChars} → ${responseSampleForAi.info.sampledChars} 字符。`, 'ok');

        stage = '读取 AI 设置';
        addLog('正在读取 AI 配置。', 'busy');
        const settings = await aiSettingsRepo.getRuntimeSettings();
        if (!settings.hasApiKey || !settings.keyLooksValid) {
            return res.status(503).json({ error: 'AI API Token 未配置或格式无效，请先在全局设置中配置。' });
        }

        stage = '调用 AI';
        addLog('AI 配置有效，开始调用模型分析响应结构。', 'busy');
        const client = aiProviderClient.createClient(settings);
        const promptInput = {
            url: `${parsedUrl.origin}${parsedUrl.pathname}`,
            method,
            headers: redactHeaders(headers),
            requestBody: requestBodySample.value,
            responseSample: responseSampleForAi.value,
            secondResponseSample: secondResponseSampleForAi.value,
            responseFocus: responseFocusPath ? {
                keyword: responseFocusKeyword,
                path: responseFocusPath,
                note: 'responseSample 是完整响应中的聚焦片段；返回 rowsPath 时使用相对该片段的路径'
            } : null,
            sampleInfo: [
                requestBodySample.info,
                responseSampleForAi.info,
                secondResponseSampleForAi.info
            ].filter(Boolean)
        };
        const result = await client.generateText({
            prompt: buildPrompt(promptInput),
            maxOutputTokens: Math.min(Math.max(settings.maxOutputTokens || 2048, 1600), 4096),
            temperature: 0.1,
            responseMimeType: 'application/json',
            json: true
        });
        stage = '解析 AI 返回';
        addLog('AI 已返回，开始解析适配器 JSON。', 'busy');
        let adapterJson;
        let repairResult = null;
        try {
            adapterJson = parseAiJson(result.text);
        } catch (parseError) {
            addLog('AI 返回 JSON 不完整，正在自动重新分析并要求严格 JSON。', 'busy');
            repairResult = await client.generateText({
                prompt: buildRepairPrompt(promptInput, result.text),
                maxOutputTokens: 2048,
                temperature: 0,
                responseMimeType: 'application/json',
                json: true
            });
            adapterJson = parseAiJson(repairResult.text);
            addLog('第二次 AI 返回已解析为严格 JSON。', 'ok');
        }
        const adapter = applyAuthHint(
            normalizeAdapter(adapterJson, method),
            req.body.authHint
        );
        adapter.request.credentials = req.body.credentials === 'omit' ? 'omit' : 'include';
        applyResponseFocus(adapter, responseFocusPath);
        stage = '验证响应路径';
        addLog('适配器 JSON 解析完成，开始用原始响应样本验证数据路径。', 'busy');
        const validation = validateAdapterAgainstSample(adapter, responseSample);
        addLog(`路径验证通过：提取到 ${validation.rowCount || 0} 行数据。`, 'ok');

        res.json({
            adapter,
            validation,
            sanitized: {
                headers: redactHeaders(headers),
                sensitiveHeaderNames: Object.keys(headers).filter(key => SENSITIVE_HEADER_RE.test(key))
            },
            sampleInfo: promptInput.sampleInfo,
            responseFocus: responseFocusPath ? {
                keyword: responseFocusKeyword,
                path: responseFocusPath
            } : null,
            logs,
            usage: result.usage || null,
            repairUsage: repairResult && repairResult.usage || null
        });
    } catch (error) {
        console.error(`[UIVF12 AI Adapter] analyze failed at ${stage}:`, error);
        res.status(400).json({
            error: error.message || 'AI 适配分析失败',
            stage,
            logs: logs.concat([{ message: `失败阶段：${stage}`, type: 'error' }])
        });
    }
});

module.exports = router;
