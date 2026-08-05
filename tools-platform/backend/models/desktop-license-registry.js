const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./store');

const REGISTRY_FILE = process.env.DESKTOP_LICENSE_REGISTRY_FILE
    || path.join(DATA_DIR, 'desktop-license-registry.json');
const VERSION = 1;
const PRODUCT_ID = 'tools-platform-desktop';
const VALID_STATUSES = new Set(['active', 'revoked', 'archived']);

function emptyState() {
    return { version: VERSION, licenses: [] };
}

function readState() {
    if (!fs.existsSync(REGISTRY_FILE)) return emptyState();
    try {
        const parsed = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
        return parsed && parsed.version === VERSION && Array.isArray(parsed.licenses)
            ? parsed
            : emptyState();
    } catch (error) {
        throw new Error(`EXE License 台账读取失败：${error.message}`);
    }
}

function writeState(state) {
    fs.mkdirSync(path.dirname(REGISTRY_FILE), { recursive: true });
    const temp = `${REGISTRY_FILE}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temp, REGISTRY_FILE);
    try { fs.chmodSync(REGISTRY_FILE, 0o600); } catch (_) {}
}

function normalizeLabel(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 120);
}

function getRecord(licenseId) {
    return readState().licenses.find(item => item.licenseId === String(licenseId || '')) || null;
}

function listRecords({ includeArchived = true } = {}) {
    return readState().licenses.filter(item => includeArchived || item.status !== 'archived');
}

function createRecord({ licenseId, label, token, notBefore, expiresAt }) {
    const state = readState();
    if (state.licenses.some(item => item.licenseId === licenseId)) throw new Error('License ID 已存在');
    const now = new Date().toISOString();
    const record = {
        licenseId,
        productId: PRODUCT_ID,
        label: normalizeLabel(label),
        token: String(token || ''),
        tokenDigest: crypto.createHash('sha256').update(String(token || '')).digest('base64url'),
        status: 'active',
        notBefore: Number(notBefore),
        expiresAt: Number(expiresAt),
        issuedAt: now,
        updatedAt: now,
        revokedAt: null,
        revokeReason: '',
        archivedAt: null,
        renewalHistory: []
    };
    state.licenses.unshift(record);
    writeState(state);
    return record;
}

function updateRecord(licenseId, updater) {
    const state = readState();
    const index = state.licenses.findIndex(item => item.licenseId === String(licenseId || ''));
    if (index < 0) throw new Error('未找到 License 记录');
    const current = state.licenses[index];
    const next = updater({ ...current, renewalHistory: [...(current.renewalHistory || [])] });
    if (!next || next.licenseId !== current.licenseId) throw new Error('License 更新结果无效');
    next.updatedAt = new Date().toISOString();
    state.licenses[index] = next;
    writeState(state);
    return next;
}

function setStatus(licenseId, status, reason = '') {
    if (!VALID_STATUSES.has(status)) throw new Error('License 状态无效');
    return updateRecord(licenseId, record => {
        record.status = status;
        if (status === 'revoked') {
            record.revokedAt = new Date().toISOString();
            record.revokeReason = String(reason || '').trim().slice(0, 240);
        } else if (status === 'archived') {
            record.archivedAt = new Date().toISOString();
        } else {
            record.revokedAt = null;
            record.revokeReason = '';
            record.archivedAt = null;
        }
        return record;
    });
}

function renew(licenseId, { days, expiresAt } = {}) {
    return updateRecord(licenseId, record => {
        const previousExpiresAt = Number(record.expiresAt);
        let nextExpiresAt = Number(expiresAt);
        if (!Number.isFinite(nextExpiresAt)) {
            const safeDays = Math.max(1, Math.min(3650, Number.parseInt(days, 10) || 30));
            nextExpiresAt = Math.max(Date.now(), previousExpiresAt) + safeDays * 86400000;
        }
        if (!Number.isFinite(nextExpiresAt) || nextExpiresAt <= Date.now()) throw new Error('新到期时间必须晚于当前时间');
        record.expiresAt = nextExpiresAt;
        record.status = 'active';
        record.revokedAt = null;
        record.revokeReason = '';
        record.archivedAt = null;
        record.renewalHistory.push({
            renewedAt: new Date().toISOString(),
            previousExpiresAt,
            expiresAt: nextExpiresAt
        });
        return record;
    });
}

function checkPayload(payload, now = Date.now(), token = '') {
    if (!payload || payload.productId !== PRODUCT_ID || !payload.licenseId) {
        return { valid: false, reasonCode: 'PRODUCT_MISMATCH' };
    }
    const record = getRecord(payload.licenseId);
    if (!record) return { valid: false, reasonCode: 'LICENSE_NOT_FOUND' };
    const digest = crypto.createHash('sha256').update(String(token || '')).digest('base64url');
    if (record.productId !== payload.productId || record.tokenDigest !== digest) {
        return { valid: false, reasonCode: 'REGISTRY_MISMATCH', record };
    }
    if (record.status === 'revoked') return { valid: false, reasonCode: 'REVOKED', record };
    if (record.status === 'archived') return { valid: false, reasonCode: 'ARCHIVED', record };
    if (Number(now) < record.notBefore) return { valid: false, reasonCode: 'NOT_YET_VALID', record };
    if (Number(now) >= record.expiresAt) return { valid: false, reasonCode: 'EXPIRED', record };
    return { valid: true, record };
}

module.exports = {
    PRODUCT_ID,
    REGISTRY_FILE,
    checkPayload,
    createRecord,
    getRecord,
    listRecords,
    normalizeLabel,
    renew,
    setStatus
};
