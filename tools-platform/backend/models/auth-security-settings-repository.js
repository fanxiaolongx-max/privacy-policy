const { readKV, writeKV } = require('./kv-store');

const SEVERITIES = ['info', 'warn', 'error', 'critical'];

const DEFAULT_SECURITY_SETTINGS = {
    enabled: true,
    sessionMaxAgeHours: 168,
    alertOnLock: true,
    accountLockPolicies: [
        { enabled: true, count: 5, windowMinutes: 15, lockMinutes: 5, severity: 'warn' },
        { enabled: true, count: 10, windowMinutes: 30, lockMinutes: 30, severity: 'error' },
        { enabled: true, count: 20, windowMinutes: 1440, lockMinutes: 720, severity: 'critical' }
    ],
    ipLockPolicies: [
        { enabled: true, count: 8, windowMinutes: 15, lockMinutes: 10, severity: 'warn' },
        { enabled: true, count: 15, windowMinutes: 30, lockMinutes: 60, severity: 'error' },
        { enabled: true, count: 30, windowMinutes: 1440, lockMinutes: 1440, severity: 'critical' }
    ],
    ipMultiUserPolicies: [
        { enabled: true, count: 3, windowMinutes: 15, lockMinutes: 30, severity: 'warn' },
        { enabled: true, count: 6, windowMinutes: 30, lockMinutes: 360, severity: 'error' }
    ]
};

function clampNumber(value, fallback, min, max) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, Math.round(num)));
}

function normalizeSeverity(value, fallback = 'warn') {
    const severity = String(value || '').trim().toLowerCase();
    return SEVERITIES.includes(severity) ? severity : fallback;
}

function normalizePolicies(input, defaults) {
    const rows = Array.isArray(input) ? input : defaults;
    return rows.slice(0, 5).map((item, index) => {
        const fallback = defaults[index] || defaults[defaults.length - 1] || {};
        return {
            enabled: item?.enabled !== false,
            count: clampNumber(item?.count, fallback.count || 5, 1, 1000),
            windowMinutes: clampNumber(item?.windowMinutes, fallback.windowMinutes || 15, 1, 10080),
            lockMinutes: clampNumber(item?.lockMinutes, fallback.lockMinutes || 5, 1, 10080),
            severity: normalizeSeverity(item?.severity, fallback.severity || 'warn')
        };
    });
}

function normalizeSettings(input = {}, previous = {}) {
    const base = {
        ...DEFAULT_SECURITY_SETTINGS,
        ...previous,
        ...input
    };
    return {
        enabled: base.enabled !== false,
        sessionMaxAgeHours: clampNumber(base.sessionMaxAgeHours, DEFAULT_SECURITY_SETTINGS.sessionMaxAgeHours, 1, 720),
        alertOnLock: base.alertOnLock !== false,
        accountLockPolicies: normalizePolicies(base.accountLockPolicies, DEFAULT_SECURITY_SETTINGS.accountLockPolicies),
        ipLockPolicies: normalizePolicies(base.ipLockPolicies, DEFAULT_SECURITY_SETTINGS.ipLockPolicies),
        ipMultiUserPolicies: normalizePolicies(base.ipMultiUserPolicies, DEFAULT_SECURITY_SETTINGS.ipMultiUserPolicies)
    };
}

async function getSettings() {
    return normalizeSettings(await readKV('sys', 'auth_security_settings', DEFAULT_SECURITY_SETTINGS));
}

async function saveSettings(payload = {}) {
    const current = await getSettings();
    const normalized = normalizeSettings(payload, current);
    await writeKV('sys', 'auth_security_settings', normalized);
    return normalized;
}

module.exports = {
    DEFAULT_SECURITY_SETTINGS,
    getSettings,
    saveSettings,
    normalizeSettings
};
