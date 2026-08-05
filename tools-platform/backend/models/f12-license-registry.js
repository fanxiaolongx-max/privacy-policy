const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./store');

const REGISTRY_FILE = process.env.F12_LICENSE_REGISTRY_FILE
    || path.join(DATA_DIR, 'f12-license-registry.json');
const VERSION = 1;
const VALID_STATUSES = new Set(['active', 'revoked', 'archived']);

function emptyState() {
    return { version: VERSION, licenses: [] };
}

function readState() {
    try {
        if (!fs.existsSync(REGISTRY_FILE)) return emptyState();
        const parsed = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
        if (!parsed || parsed.version !== VERSION || !Array.isArray(parsed.licenses)) return emptyState();
        return parsed;
    } catch (error) {
        throw new Error(`License 台账读取失败：${error.message}`);
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

function createRecord(input) {
    const state = readState();
    const licenseId = String(input.licenseId || crypto.randomUUID());
    if (state.licenses.some(item => item.licenseId === licenseId)) throw new Error('License ID 已存在');
    const nowIso = new Date().toISOString();
    const record = {
        licenseId,
        productId: String(input.productId || ''),
        label: normalizeLabel(input.label),
        month: String(input.month || ''),
        notBefore: Number(input.notBefore),
        expiresAt: Number(input.expiresAt),
        token: String(input.token || ''),
        tokenDigest: crypto.createHash('sha256').update(String(input.token || '')).digest('base64url'),
        status: 'active',
        issuedAt: nowIso,
        updatedAt: nowIso,
        renewedFrom: input.renewedFrom ? String(input.renewedFrom) : null,
        renewedBy: null,
        revokedAt: null,
        revokeReason: '',
        archivedAt: null
    };
    state.licenses.unshift(record);
    writeState(state);
    return record;
}

function listRecords({ includeArchived = true, productId = '' } = {}) {
    const wantedProduct = String(productId || '').trim();
    return readState().licenses.filter(record =>
        (includeArchived || record.status !== 'archived')
        && (!wantedProduct || record.productId === wantedProduct)
    );
}

function getRecord(licenseId) {
    return readState().licenses.find(record => record.licenseId === String(licenseId || '')) || null;
}

function updateRecord(licenseId, updater) {
    const state = readState();
    const index = state.licenses.findIndex(record => record.licenseId === String(licenseId || ''));
    if (index < 0) throw new Error('未找到 License 记录');
    const current = state.licenses[index];
    const next = updater({ ...current });
    if (!next || next.licenseId !== current.licenseId) throw new Error('License 更新结果无效');
    next.updatedAt = new Date().toISOString();
    state.licenses[index] = next;
    writeState(state);
    return next;
}

function setStatus(licenseId, status, { reason = '' } = {}) {
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

function linkRenewal(oldLicenseId, newLicenseId) {
    return updateRecord(oldLicenseId, record => {
        record.renewedBy = newLicenseId;
        return record;
    });
}

function checkPayload(payload) {
    if (!payload || !payload.licenseId) return { valid: true, legacy: true };
    const record = getRecord(payload.licenseId);
    if (!record) return { valid: false, reasonCode: 'LICENSE_NOT_FOUND' };
    if (record.productId !== payload.productId || record.month !== payload.month) {
        return { valid: false, reasonCode: 'REGISTRY_MISMATCH', record };
    }
    if (record.status === 'revoked') return { valid: false, reasonCode: 'REVOKED', record };
    if (record.status === 'archived') return { valid: false, reasonCode: 'ARCHIVED', record };
    return { valid: true, record };
}

module.exports = {
    REGISTRY_FILE,
    checkPayload,
    createRecord,
    getRecord,
    linkRenewal,
    listRecords,
    normalizeLabel,
    setStatus,
    updateRecord
};
