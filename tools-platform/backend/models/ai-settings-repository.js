const crypto = require('crypto');
const { readKV, writeKV } = require('./kv-store');

const PROFILE_STORE_KEY = 'ai_settings_profiles';
const LEGACY_SETTINGS_KEY = 'ai_settings';

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
    minimax: 'MiniMax-M2.7-highspeed',
    'openai-compatible': 'gpt-4o-mini'
};

function normalizeProvider(value) {
    const provider = String(value || DEFAULT_SETTINGS.provider).trim().toLowerCase();
    return ['gemini', 'openai', 'anthropic', 'minimax', 'openai-compatible'].includes(provider) ? provider : 'gemini';
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
    if (provider === 'minimax') return String(process.env.MINIMAX_API_KEY || '').trim();
    return String(process.env.GEMINI_API_KEY || '').trim();
}

function cleanProfileName(value, fallback = 'AI 配置') {
    return String(value || fallback).replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 60) || fallback;
}

function defaultProfileName(settings) {
    const providerNames = {
        gemini: 'Gemini',
        openai: 'OpenAI',
        anthropic: 'Anthropic',
        minimax: 'MiniMax',
        'openai-compatible': '兼容接口'
    };
    return `${providerNames[settings.provider] || 'AI'} · ${settings.model}`;
}

function uniqueProfileName(profiles, requested) {
    const used = new Set(profiles.map(item => item.name));
    if (!used.has(requested)) return requested;
    let suffix = 2;
    while (used.has(`${requested} ${suffix}`)) suffix += 1;
    return `${requested} ${suffix}`;
}

function createProfileRecord(settings, name, id = crypto.randomUUID()) {
    const now = new Date().toISOString();
    return {
        id: String(id),
        name: cleanProfileName(name, defaultProfileName(settings)),
        ...normalizeSettings(settings),
        createdAt: now,
        updatedAt: now
    };
}

function profileSettings(profile) {
    return normalizeSettings(profile);
}

function normalizeProfile(profile, index) {
    const settings = normalizeSettings(profile);
    const fallbackId = index === 0 ? 'default' : crypto.randomUUID();
    return {
        id: String(profile && profile.id || fallbackId).slice(0, 100),
        name: cleanProfileName(profile && profile.name, defaultProfileName(settings)),
        ...settings,
        createdAt: String(profile && profile.createdAt || new Date().toISOString()),
        updatedAt: String(profile && profile.updatedAt || new Date().toISOString())
    };
}

async function getProfileStore() {
    const raw = await readKV('sys', PROFILE_STORE_KEY, null);
    if (raw && Array.isArray(raw.profiles) && raw.profiles.length) {
        const profiles = raw.profiles.map(normalizeProfile);
        const activeProfileId = profiles.some(item => item.id === raw.activeProfileId)
            ? raw.activeProfileId
            : profiles[0].id;
        return { version: 2, activeProfileId, profiles };
    }

    // 无感迁移：历史单配置原样成为第一套方案，Token 不会丢失。
    const legacy = normalizeSettings(await readKV('sys', LEGACY_SETTINGS_KEY, DEFAULT_SETTINGS));
    const first = createProfileRecord(legacy, defaultProfileName(legacy), 'default');
    const migrated = { version: 2, activeProfileId: first.id, profiles: [first] };
    await writeProfileStore(migrated);
    return migrated;
}

async function writeProfileStore(store) {
    const active = store.profiles.find(item => item.id === store.activeProfileId) || store.profiles[0];
    const normalized = {
        version: 2,
        activeProfileId: active.id,
        profiles: store.profiles.map(normalizeProfile)
    };
    await writeKV('sys', PROFILE_STORE_KEY, normalized);
    // 同步旧键，确保旧版本回滚和历史脚本仍能读取当前激活配置。
    await writeKV('sys', LEGACY_SETTINGS_KEY, profileSettings(active));
    return normalized;
}

function findProfile(store, profileId) {
    const id = String(profileId || store.activeProfileId);
    return store.profiles.find(item => item.id === id) || null;
}

function profileNotFoundError() {
    const error = new Error('AI 配置不存在或已被删除');
    error.statusCode = 404;
    return error;
}

function runtimeSettings(stored) {
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

function publicSettings(runtime) {
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

function publicProfile(profile, activeProfileId) {
    return {
        id: profile.id,
        name: profile.name,
        isActive: profile.id === activeProfileId,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
        ...publicSettings(runtimeSettings(profileSettings(profile)))
    };
}

async function getStoredSettings(profileId) {
    const store = await getProfileStore();
    const profile = findProfile(store, profileId);
    if (!profile) throw profileNotFoundError();
    return profileSettings(profile);
}

async function getRuntimeSettings() {
    return runtimeSettings(await getStoredSettings());
}

async function buildRuntimeSettings(payload = {}) {
    const current = await getStoredSettings(payload.profileId);
    const nextPayload = { ...payload };
    delete nextPayload.profileId;
    delete nextPayload.name;
    if (!Object.prototype.hasOwnProperty.call(nextPayload, 'apiKey') || String(nextPayload.apiKey || '').trim() === '') {
        nextPayload.apiKey = current.apiKey;
    }
    return runtimeSettings(normalizeSettings(nextPayload, current));
}

async function getPublicSettings() {
    const store = await getProfileStore();
    const active = findProfile(store, store.activeProfileId);
    return {
        ...publicSettings(runtimeSettings(profileSettings(active))),
        activeProfileId: store.activeProfileId,
        profiles: store.profiles.map(item => publicProfile(item, store.activeProfileId))
    };
}

async function saveSettings(payload = {}) {
    const store = await getProfileStore();
    const profile = findProfile(store, payload.profileId);
    if (!profile) throw profileNotFoundError();
    const nextPayload = { ...payload };
    delete nextPayload.profileId;
    delete nextPayload.name;
    if (payload.clearApiKey) {
        nextPayload.apiKey = '';
    } else if (!Object.prototype.hasOwnProperty.call(payload, 'apiKey') || String(payload.apiKey || '').trim() === '') {
        nextPayload.apiKey = profile.apiKey;
    }
    const normalized = normalizeSettings(nextPayload, profile);
    if (normalized.apiKey && !isLikelyValidApiKey(normalized.apiKey)) {
        const error = new Error('API Token 格式疑似无效');
        error.statusCode = 400;
        throw error;
    }
    Object.assign(profile, normalized, {
        name: Object.prototype.hasOwnProperty.call(payload, 'name') ? cleanProfileName(payload.name, profile.name) : profile.name,
        updatedAt: new Date().toISOString()
    });
    await writeProfileStore(store);
    return getPublicSettings();
}

async function createProfile(payload = {}) {
    const store = await getProfileStore();
    const source = payload.sourceProfileId ? findProfile(store, payload.sourceProfileId) : null;
    if (payload.sourceProfileId && !source) throw profileNotFoundError();
    const requestedProvider = normalizeProvider(payload.provider || source && source.provider || DEFAULT_SETTINGS.provider);
    const base = source ? profileSettings(source) : {
        ...DEFAULT_SETTINGS,
        provider: requestedProvider,
        model: DEFAULT_MODELS[requestedProvider]
    };
    const settings = normalizeSettings(payload, base);
    if (!source && !Object.prototype.hasOwnProperty.call(payload, 'apiKey')) settings.apiKey = '';
    const requestedName = cleanProfileName(payload.name, source ? `${source.name} 副本` : defaultProfileName(settings));
    const profile = createProfileRecord(settings, uniqueProfileName(store.profiles, requestedName));
    store.profiles.push(profile);
    if (payload.activate === true) store.activeProfileId = profile.id;
    await writeProfileStore(store);
    return { ...(await getPublicSettings()), createdProfileId: profile.id };
}

async function activateProfile(profileId) {
    const store = await getProfileStore();
    const profile = findProfile(store, profileId);
    if (!profile) throw profileNotFoundError();
    store.activeProfileId = profile.id;
    await writeProfileStore(store);
    return getPublicSettings();
}

async function deleteProfile(profileId) {
    const store = await getProfileStore();
    if (store.profiles.length <= 1) {
        const error = new Error('至少需要保留一套 AI 配置');
        error.statusCode = 400;
        throw error;
    }
    const index = store.profiles.findIndex(item => item.id === String(profileId));
    if (index < 0) throw profileNotFoundError();
    const wasActive = store.activeProfileId === store.profiles[index].id;
    store.profiles.splice(index, 1);
    if (wasActive) store.activeProfileId = store.profiles[Math.min(index, store.profiles.length - 1)].id;
    await writeProfileStore(store);
    return getPublicSettings();
}

module.exports = {
    DEFAULT_SETTINGS,
    getStoredSettings,
    getRuntimeSettings,
    buildRuntimeSettings,
    getPublicSettings,
    saveSettings,
    createProfile,
    activateProfile,
    deleteProfile,
    isLikelyValidApiKey
};
