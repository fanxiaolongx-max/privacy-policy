
const { readKV, writeKV } = require('./kv-store');

const DEFAULT_SETTINGS = {
    provider: 'gemini',
    apiBaseUrl: '',
    model: 'gemini-2.5-flash',
    apiKey: '',
    maxOutputTokens: 2048,
    temperature: 0.7,
    inputCostPerMillionUsd: 0.075,
    outputCostPerMillionUsd: 0.3,
    usdToCny: 7.2,
    systemPrompt: '',
    pptCopilotRules: ''
};

const DEFAULT_MODELS = {
    gemini: 'gemini-2.5-flash',
    openai: 'gpt-4o-mini',
    anthropic: 'claude-3-5-sonnet-latest',
    'openai-compatible': 'gpt-4o-mini'
};

function normalizeProvider(value) {
    const provider = String(value || DEFAULT_SETTINGS.provider).trim().toLowerCase();
    return ['gemini', 'openai', 'anthropic', 'openai-compatible'].includes(provider) ? provider : 'gemini';
}

function clampNumber(value, fallback, min, max) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, num));
}

function normalizeSettings(input = {}, previous = {}) {
    const base = { ...DEFAULT_SETTINGS, ...previous, ...input };
    const provider = normalizeProvider(base.provider);
    return {
        provider,
        apiBaseUrl: String(base.apiBaseUrl || '').trim().slice(0, 500),
        model: String(base.model || DEFAULT_MODELS[provider] || DEFAULT_SETTINGS.model).trim() || DEFAULT_MODELS[provider],
        apiKey: String(base.apiKey || '').trim(),
        maxOutputTokens: Math.round(clampNumber(base.maxOutputTokens, DEFAULT_SETTINGS.maxOutputTokens, 128, 8192)),
        temperature: clampNumber(base.temperature, DEFAULT_SETTINGS.temperature, 0, 2),
        inputCostPerMillionUsd: clampNumber(base.inputCostPerMillionUsd, DEFAULT_SETTINGS.inputCostPerMillionUsd, 0, 999),
        outputCostPerMillionUsd: clampNumber(base.outputCostPerMillionUsd, DEFAULT_SETTINGS.outputCostPerMillionUsd, 0, 999),
        usdToCny: clampNumber(base.usdToCny, DEFAULT_SETTINGS.usdToCny, 0, 99),
        systemPrompt: String(base.systemPrompt || '').slice(0, 5000),
        pptCopilotRules: String(base.pptCopilotRules || '').slice(0, 20000)
    };
}

function maskApiKey(apiKey) {
    if (!apiKey) return '';
    if (apiKey.length <= 8) return '********';
    return `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`;
}

function isLikelyValidApiKey(apiKey) {
    if (!apiKey) return false;
    return String(apiKey).trim().length >= 12;
}

function getEnvKeyForProvider(provider) {
    if (provider === 'openai' || provider === 'openai-compatible') return String(process.env.OPENAI_API_KEY || '').trim();
    if (provider === 'anthropic') return String(process.env.ANTHROPIC_API_KEY || '').trim();
    return String(process.env.GEMINI_API_KEY || '').trim();
}

async function getStoredSettings() {
    return normalizeSettings(await readKV('sys', 'ai_settings', DEFAULT_SETTINGS));
}

async function getRuntimeSettings() {
    const stored = await getStoredSettings();
    const envKey = getEnvKeyForProvider(stored.provider);
    const apiKey = stored.apiKey || envKey;
    return {
        ...stored,
        apiKey,
        apiKeySource: stored.apiKey ? 'stored' : (envKey ? 'env' : 'none'),
        hasApiKey: Boolean(apiKey),
        keyLooksValid: isLikelyValidApiKey(apiKey)
    };
}

async function getPublicSettings() {
    const runtime = await getRuntimeSettings();
    return {
        provider: runtime.provider,
        apiBaseUrl: runtime.apiBaseUrl,
        model: runtime.model,
        maxOutputTokens: runtime.maxOutputTokens,
        temperature: runtime.temperature,
        inputCostPerMillionUsd: runtime.inputCostPerMillionUsd,
        outputCostPerMillionUsd: runtime.outputCostPerMillionUsd,
        usdToCny: runtime.usdToCny,
        systemPrompt: runtime.systemPrompt,
        pptCopilotRules: runtime.pptCopilotRules,
        hasApiKey: runtime.hasApiKey,
        keyLooksValid: runtime.hasApiKey ? runtime.keyLooksValid : false,
        apiKeySource: runtime.apiKeySource,
        maskedApiKey: maskApiKey(runtime.apiKey)
    };
}

async function saveSettings(payload = {}) {
    const current = await getStoredSettings();
    const nextPayload = { ...payload };
    if (payload.clearApiKey) {
        nextPayload.apiKey = '';
    } else if (!Object.prototype.hasOwnProperty.call(payload, 'apiKey') || String(payload.apiKey || '').trim() === '') {
        nextPayload.apiKey = current.apiKey;
    }
    const normalized = normalizeSettings(nextPayload, current);
    if (normalized.apiKey && !isLikelyValidApiKey(normalized.apiKey)) {
        const err = new Error('API Token 格式疑似无效');
        err.statusCode = 400;
        throw err;
    }
    await writeKV('sys', 'ai_settings', normalized);
    return getPublicSettings();
}

module.exports = {
    DEFAULT_SETTINGS,
    getStoredSettings,
    getRuntimeSettings,
    getPublicSettings,
    saveSettings,
    isLikelyValidApiKey
};
