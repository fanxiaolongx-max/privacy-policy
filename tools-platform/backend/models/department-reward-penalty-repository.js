const crypto = require('crypto');
const { run, get, all, getDbPath } = require('./app-db');
const defaultRules = require('../builtin-tools/department-reward-penalty/default-rules.json');

const DEFAULT_ROLES = ['MTD', 'TL', 'TE', 'SPM', 'MS', 'SEC', 'Software', 'CS', 'NTD', 'FME', 'TD', 'PM', 'admin', 'Redline Resource', 'SP manager', 'SP admin', 'Virtual Account', 'ALL'];
const DEFAULT_DEDUCTIONS = ['1 Month/Time', '1 Month/Ticket', '1 Quarter/Time', '1 Quarter/Ticket', '0.5 Year/Time', '1 Month/Resource', '1 Month/FME', '1 Month/Account', 'Quarterly', '1 Monthly/Time', 'Custom'];
const DEFAULT_DEDUCTION_CATEGORIES = [{ id: 'monthly', value: '按月' }, { id: 'quarterly', value: '按季度' }, { id: 'half-year', value: '按半年' }, { id: 'other', value: '其他' }];
const deductionCategory = value => /quarter/i.test(value) ? 'quarterly' : /year/i.test(value) ? 'half-year' : /month/i.test(value) ? 'monthly' : 'other';
const KINDS = new Set(['personnel', 'rules', 'records', 'roles', 'deductions', 'deductionCategories', 'customerGroups', 'businessUnits']);
const writeQueues = new Map();

async function ensureReady() {
    await run(`CREATE TABLE IF NOT EXISTS department_reward_penalty_items (
        kind TEXT NOT NULL, id TEXT NOT NULL, payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (kind, id)
    )`);
    await run(`CREATE TABLE IF NOT EXISTS department_reward_penalty_audit (
        id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL,
        kind TEXT NOT NULL, item_id TEXT NOT NULL, before_json TEXT,
        after_json TEXT, reason TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await run(`CREATE TABLE IF NOT EXISTS department_reward_penalty_security (
        key TEXT PRIMARY KEY, salt TEXT NOT NULL, hash TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
}

async function list() {
    await ensureReady();
    const rows = await all('SELECT kind, id, payload_json FROM department_reward_penalty_items ORDER BY rowid');
    const state = { personnel: [], rules: [], records: [], roles: [], deductions: [], deductionCategories: [], customerGroups: [], businessUnits: [] };
    for (const row of rows) if (KINDS.has(row.kind)) state[row.kind].push(JSON.parse(row.payload_json));
    const savedRules = new Map(state.rules.map(rule => [rule.id, rule]));
    state.rules = [...defaultRules.map(rule => savedRules.get(rule.id) || rule), ...state.rules.filter(rule => !defaultRules.some(seed => seed.id === rule.id))];
    for (const [kind, defaults] of [['roles', [...new Set([...DEFAULT_ROLES, ...defaultRules.flatMap(rule => rule.roles)])]], ['deductions', [...new Set([...DEFAULT_DEDUCTIONS, ...defaultRules.map(rule => rule.deduct)])]]]) {
        const values = new Map(defaults.map(value => [value, { id: value, value, ...(kind === 'deductions' ? { categoryId: deductionCategory(value) } : {}) }]));
        for (const saved of state[kind]) values.set(saved.id, saved);
        state[kind] = [...values.values()].filter(item => !item.archived).map(item => kind === 'deductions' ? { ...item, categoryId: item.categoryId || deductionCategory(item.value) } : item);
    }
    const categories = new Map(DEFAULT_DEDUCTION_CATEGORIES.map(item => [item.id, item]));
    for (const saved of state.deductionCategories) categories.set(saved.id, saved);
    state.deductionCategories = [...categories.values()].filter(item => !item.archived);
    state.customerGroups = state.customerGroups.filter(item => !item.archived);
    state.businessUnits = state.businessUnits.filter(item => !item.archived);
    return state;
}

async function listAudit({ page = 1, pageSize = 20 } = {}) {
    await ensureReady();
    const size = Math.max(1, Math.min(200, Number.parseInt(pageSize, 10) || 20));
    const count = await get('SELECT COUNT(*) AS total FROM department_reward_penalty_audit');
    const total = count.total;
    const totalPages = Math.max(1, Math.ceil(total / size));
    const currentPage = Math.max(1, Math.min(totalPages, Number.parseInt(page, 10) || 1));
    const rows = await all('SELECT id, actor, action, kind, item_id, before_json, after_json, reason, created_at FROM department_reward_penalty_audit ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?', [size, (currentPage - 1) * size]);
    return { rows: rows.map(row => ({ ...row, before: row.before_json ? JSON.parse(row.before_json) : null, after: row.after_json ? JSON.parse(row.after_json) : null, before_json: undefined, after_json: undefined })), total, page: currentPage, pageSize: size, totalPages };
}

async function item(kind, id) {
    if (!KINDS.has(kind)) throw Object.assign(new Error('无效的数据类型'), { status: 400 });
    await ensureReady();
    const row = await get('SELECT payload_json FROM department_reward_penalty_items WHERE kind = ? AND id = ?', [kind, id]);
    if (row) return JSON.parse(row.payload_json);
    return kind === 'rules' ? defaultRules.find(rule => rule.id === id) || null : null;
}

async function audit(actor, action, kind, id, before, after, reason) {
    await run('INSERT INTO department_reward_penalty_audit (id, actor, action, kind, item_id, before_json, after_json, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), actor, action, kind, id, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null, reason || '']);
}

async function hasCustomForceEditPin() {
    await ensureReady();
    return Boolean(await get('SELECT key FROM department_reward_penalty_security WHERE key = ?', ['force-edit-pin']));
}

async function verifyForceEditPin(pin) {
    await ensureReady();
    const row = await get('SELECT salt, hash FROM department_reward_penalty_security WHERE key = ?', ['force-edit-pin']);
    const salt = row?.salt || 'department-reward-penalty-default-pin-v1';
    const expected = row ? Buffer.from(row.hash, 'hex') : crypto.scryptSync('0000', salt, 32);
    const actual = crypto.scryptSync(String(pin ?? ''), salt, 32);
    return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
}

async function changeForceEditPin(currentPin, newPin, actor) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(newPin, salt, 32).toString('hex');
    const key = getDbPath();
    const previous = writeQueues.get(key) || Promise.resolve();
    const current = previous.catch(() => {}).then(async () => {
        await ensureReady();
        await run('BEGIN IMMEDIATE');
        try {
            if (!await verifyForceEditPin(currentPin)) throw Object.assign(new Error('当前修改口令不正确'), { status: 403 });
            await run('INSERT INTO department_reward_penalty_security (key, salt, hash, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET salt = excluded.salt, hash = excluded.hash, updated_at = CURRENT_TIMESTAMP', ['force-edit-pin', salt, hash]);
            await audit(actor, '修改强制编辑口令', 'security', 'force-edit-pin', null, { changed: true }, '');
            await run('COMMIT');
        } catch (error) {
            await run('ROLLBACK').catch(() => {});
            throw error;
        }
    });
    writeQueues.set(key, current);
    current.then(() => { if (writeQueues.get(key) === current) writeQueues.delete(key); }, () => { if (writeQueues.get(key) === current) writeQueues.delete(key); });
    return current;
}

async function put(kind, id, payload, actor, action = '保存', reason = '') {
    const results = await putMany([{ kind, id, payload }], actor, action, reason);
    return results[0];
}

async function putMany(changes, actor, action = '保存', reason = '') {
    const key = getDbPath();
    const previous = writeQueues.get(key) || Promise.resolve();
    const current = previous.catch(() => {}).then(async () => {
        await ensureReady();
        await run('BEGIN IMMEDIATE');
        try {
            const results = [];
            for (const { kind, id, payload } of changes) {
                if (!KINDS.has(kind)) throw new Error('无效的数据类型');
                const before = await item(kind, id);
                const after = { ...payload, id };
                await run('INSERT INTO department_reward_penalty_items (kind, id, payload_json, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(kind, id) DO UPDATE SET payload_json = excluded.payload_json, updated_at = CURRENT_TIMESTAMP', [kind, id, JSON.stringify(after)]);
                await audit(actor, action, kind, id, before, after, reason);
                results.push(after);
            }
            await run('COMMIT');
            return results;
        } catch (error) {
            await run('ROLLBACK').catch(() => {});
            throw error;
        }
    });
    writeQueues.set(key, current);
    current.then(() => { if (writeQueues.get(key) === current) writeQueues.delete(key); }, () => { if (writeQueues.get(key) === current) writeQueues.delete(key); });
    return current;
}

async function putPublishedWithPin(id, payload, pin, actor, reason) {
    const key = getDbPath();
    const previous = writeQueues.get(key) || Promise.resolve();
    const current = previous.catch(() => {}).then(async () => {
        await ensureReady();
        await run('BEGIN IMMEDIATE');
        try {
            if (!await verifyForceEditPin(pin)) throw Object.assign(new Error('修改口令不正确'), { status: 403 });
            const before = await item('records', id);
            if (!before || before.status !== 'published') throw Object.assign(new Error('只能强制修改已发布记录'), { status: 409 });
            const after = { ...payload, id };
            await run('UPDATE department_reward_penalty_items SET payload_json = ?, updated_at = CURRENT_TIMESTAMP WHERE kind = ? AND id = ?', [JSON.stringify(after), 'records', id]);
            await audit(actor, '强制修改已发布违规', 'records', id, before, after, reason);
            await run('COMMIT');
            return after;
        } catch (error) {
            await run('ROLLBACK').catch(() => {});
            throw error;
        }
    });
    writeQueues.set(key, current);
    current.then(() => { if (writeQueues.get(key) === current) writeQueues.delete(key); }, () => { if (writeQueues.get(key) === current) writeQueues.delete(key); });
    return current;
}

async function remove(kind, id, actor, action = '删除', reason = '') {
    const key = getDbPath();
    const previous = writeQueues.get(key) || Promise.resolve();
    const current = previous.catch(() => {}).then(async () => {
        await ensureReady();
        await run('BEGIN IMMEDIATE');
        try {
            if (!KINDS.has(kind)) throw new Error('无效的数据类型');
            const before = await item(kind, id);
            if (!before) throw Object.assign(new Error('记录不存在'), { status: 404 });
            await run('DELETE FROM department_reward_penalty_items WHERE kind = ? AND id = ?', [kind, id]);
            await audit(actor, action, kind, id, before, null, reason);
            await run('COMMIT');
            return { success: true, id };
        } catch (error) {
            await run('ROLLBACK').catch(() => {});
            throw error;
        }
    });
    writeQueues.set(key, current);
    current.then(() => { if (writeQueues.get(key) === current) writeQueues.delete(key); }, () => { if (writeQueues.get(key) === current) writeQueues.delete(key); });
    return current;
}

module.exports = { DEFAULT_ROLES, DEFAULT_DEDUCTIONS, DEFAULT_DEDUCTION_CATEGORIES, deductionCategory, ensureReady, list, listAudit, item, put, putMany, putPublishedWithPin, remove, audit, hasCustomForceEditPin, verifyForceEditPin, changeForceEditPin };
