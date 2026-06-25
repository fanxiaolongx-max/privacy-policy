const { readJSON, writeJSON } = require('./store');

const SETTINGS_FILE = 'ai_settings.json';

const DEFAULT_SETTINGS = {
    provider: 'gemini',
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

function clampNumber(value, fallback, min, max) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, num));
}

function normalizeSettings(input = {}, previous = {}) {
    const base = { ...DEFAULT_SETTINGS, ...previous, ...input };
    return {
        provider: 'gemini',
        model: String(base.model || DEFAULT_SETTINGS.model).trim() || DEFAULT_SETTINGS.model,
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
    // Google API keys used by Gemini usually start with AIza and are much longer than a short code.
    return /^AIza[0-9A-Za-z_-]{20,}$/.test(String(apiKey).trim());
}

function getStoredSettings() {
    return normalizeSettings(readJSON(SETTINGS_FILE, DEFAULT_SETTINGS));
}

function getRuntimeSettings() {
    const stored = getStoredSettings();
    const envKey = String(process.env.GEMINI_API_KEY || '').trim();
    const apiKey = stored.apiKey || envKey;
    return {
        ...stored,
        apiKey,
        apiKeySource: stored.apiKey ? 'stored' : (envKey ? 'env' : 'none'),
        hasApiKey: Boolean(apiKey),
        keyLooksValid: isLikelyValidApiKey(apiKey)
    };
}

function getPublicSettings() {
    const runtime = getRuntimeSettings();
    return {
        provider: runtime.provider,
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

function saveSettings(payload = {}) {
    const current = getStoredSettings();
    const nextPayload = { ...payload };
    if (payload.clearApiKey) {
        nextPayload.apiKey = '';
    } else if (!Object.prototype.hasOwnProperty.call(payload, 'apiKey') || String(payload.apiKey || '').trim() === '') {
        nextPayload.apiKey = current.apiKey;
    }
    const normalized = normalizeSettings(nextPayload, current);
    if (normalized.apiKey && !isLikelyValidApiKey(normalized.apiKey)) {
        const err = new Error('API Token 格式疑似无效：Gemini API Key 通常以 AIza 开头，且长度明显长于短验证码。');
        err.statusCode = 400;
        throw err;
    }
    writeJSON(SETTINGS_FILE, normalized);
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
