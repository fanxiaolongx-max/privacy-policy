const crypto = require('crypto');
const { run, get, all, getDbPath } = require('./app-db');
const defaults = require('../builtin-tools/reward-program/default-rules.json');
const queues = new Map();

async function ready() {
    await run(`CREATE TABLE IF NOT EXISTS reward_program_rules (
        id TEXT PRIMARY KEY, payload_json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await run(`CREATE TABLE IF NOT EXISTS reward_program_applications (
        id TEXT PRIMARY KEY, category TEXT NOT NULL, rule_id TEXT NOT NULL, applicant TEXT NOT NULL,
        status TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`);
    await run('CREATE INDEX IF NOT EXISTS idx_reward_program_applicant ON reward_program_applications(applicant, updated_at)');
    await run(`CREATE TABLE IF NOT EXISTS reward_program_events (
        id TEXT PRIMARY KEY, application_id TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
    )`);
    await run(`CREATE TABLE IF NOT EXISTS reward_program_objections (
        id TEXT PRIMARY KEY, application_id TEXT NOT NULL, actor TEXT NOT NULL, note TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open', resolution TEXT NOT NULL DEFAULT '', resolved_by TEXT,
        created_at TEXT NOT NULL, resolved_at TEXT
    )`);
}

async function rules() {
    await ready();
    const overrides = new Map((await all('SELECT id, payload_json FROM reward_program_rules')).map(row => [row.id, JSON.parse(row.payload_json)]));
    const allRules = [...defaults.map(item => overrides.get(item.id) || item), ...[...overrides.values()].filter(item => !defaults.some(seed => seed.id === item.id))];
    return allRules.filter(item => !item.deleted);
}

async function saveRule(rule) {
    await ready();
    await run('INSERT INTO reward_program_rules (id, payload_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json, updated_at = CURRENT_TIMESTAMP', [rule.id, JSON.stringify(rule)]);
    return rule;
}

async function deleteRule(id) {
    await ready();
    const isDefault = defaults.some(seed => seed.id === id);
    if (isDefault) {
        await run('INSERT INTO reward_program_rules (id, payload_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json, updated_at = CURRENT_TIMESTAMP', [id, JSON.stringify({ id, deleted: true })]);
    } else {
        await run('DELETE FROM reward_program_rules WHERE id = ?', [id]);
    }
    return { ok: true, id };
}

const unpack = row => row && ({ ...JSON.parse(row.payload_json), id: row.id, applicant: row.applicant, status: row.status, revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at });
async function application(id) {
    await ready();
    return unpack(await get('SELECT * FROM reward_program_applications WHERE id = ?', [id]));
}
async function listApplications(user, admin) {
    await ready();
    const rows = admin
        ? await all('SELECT * FROM reward_program_applications ORDER BY updated_at DESC LIMIT 1000')
        : await all("SELECT * FROM reward_program_applications WHERE applicant = ? OR status IN ('publicity', 'published') ORDER BY updated_at DESC LIMIT 1000", [user]);
    return rows.map(unpack).map(item => admin || item.applicant === user ? item : {
        id: item.id, category: item.category, ruleId: item.ruleId, title: item.title,
        period: item.period, projectName: item.projectName,
        status: item.status, createdAt: item.createdAt, updatedAt: item.updatedAt,
        summary: item.summary, evidence: item.evidence, attachments: item.attachments,
        teams: item.teams?.map(team => ({ name: team.name, members: team.members?.map(member => ({ name: member.name })) })),
        recipients: item.recipients?.map(person => ({ name: person.name, team: person.team }))
    });
}
async function remove(id, actor) {
    return withLock(async () => {
        const old = await application(id);
        if (!old) throw Object.assign(new Error('申请不存在'), { status: 404 });
        if (old.status !== 'draft') throw Object.assign(new Error('只能删除草稿'), { status: 409 });
        await run('DELETE FROM reward_program_applications WHERE id = ?', [id]);
        await run('DELETE FROM reward_program_events WHERE application_id = ?', [id]);
        await run('DELETE FROM reward_program_objections WHERE application_id = ?', [id]);
        return { id, deleted: true };
    });
}
async function events(applicationId) {
    await ready();
    return all('SELECT actor, action, note, created_at AS createdAt FROM reward_program_events WHERE application_id = ? ORDER BY created_at, rowid', [applicationId]);
}
async function objections(applicationId, actor, admin) {
    await ready();
    return admin
        ? all('SELECT id, actor, note, status, resolution, resolved_by AS resolvedBy, created_at AS createdAt, resolved_at AS resolvedAt FROM reward_program_objections WHERE application_id = ? ORDER BY created_at, rowid', [applicationId])
        : all('SELECT id, actor, note, status, resolution, resolved_by AS resolvedBy, created_at AS createdAt, resolved_at AS resolvedAt FROM reward_program_objections WHERE application_id = ? AND actor = ? ORDER BY created_at, rowid', [applicationId, actor]);
}
function withLock(work) {
    const key = getDbPath();
    const previous = queues.get(key) || Promise.resolve();
    const current = previous.catch(() => {}).then(async () => {
        await ready();
        await run('BEGIN IMMEDIATE');
        try { const result = await work(); await run('COMMIT'); return result; }
        catch (error) { await run('ROLLBACK').catch(() => {}); throw error; }
    });
    queues.set(key, current);
    current.finally(() => { if (queues.get(key) === current) queues.delete(key); }).catch(() => {});
    return current;
}
async function insert(payload, actor) {
    return withLock(async () => {
        const id = crypto.randomUUID(), now = new Date().toISOString();
        await run('INSERT INTO reward_program_applications (id, category, rule_id, applicant, status, revision, payload_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)', [id, payload.category, payload.ruleId, actor, 'draft', JSON.stringify(payload), now, now]);
        await run('INSERT INTO reward_program_events VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), id, actor, 'create', '', now]);
        return application(id);
    });
}
async function update(id, expectedRevision, actor, next, action, note = '') {
    return withLock(async () => {
        const old = await application(id);
        if (!old) throw Object.assign(new Error('申请不存在'), { status: 404 });
        if (old.revision !== expectedRevision) throw Object.assign(new Error('记录已被其他人更新，请刷新后重试'), { status: 409 });
        if (old.status === 'publicity' && next.status === 'completed') {
            const pending = await get("SELECT COUNT(*) AS count FROM reward_program_objections WHERE application_id = ? AND status = 'open'", [id]);
            if (pending.count) throw Object.assign(new Error(`还有 ${pending.count} 条公示异议未处理，不能结束公示`), { status: 409 });
        }
        const now = new Date().toISOString();
        const result = await run('UPDATE reward_program_applications SET category = ?, rule_id = ?, status = ?, revision = revision + 1, payload_json = ?, updated_at = ? WHERE id = ? AND revision = ?', [next.category, next.ruleId, next.status, JSON.stringify(next.payload), now, id, expectedRevision]);
        if (!result.changes) throw Object.assign(new Error('记录已变更'), { status: 409 });
        await run('INSERT INTO reward_program_events VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), id, actor, action, note, now]);
        return application(id);
    });
}
async function addObjection(applicationId, actor, note) {
    return withLock(async () => {
        const record = await application(applicationId);
        if (!record || record.status !== 'publicity') throw Object.assign(new Error('当前不在公示期'), { status: 409 });
        const id = crypto.randomUUID(), now = new Date().toISOString();
        await run('INSERT INTO reward_program_objections (id, application_id, actor, note, created_at) VALUES (?, ?, ?, ?, ?)', [id, applicationId, actor, note, now]);
        await run('INSERT INTO reward_program_events VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), applicationId, actor, 'objection', '已提交公示异议', now]);
        return { id, status: 'open', createdAt: now };
    });
}
async function resolveObjection(applicationId, objectionId, actor, resolution) {
    return withLock(async () => {
        const item = await get('SELECT * FROM reward_program_objections WHERE id = ? AND application_id = ?', [objectionId, applicationId]);
        if (!item) throw Object.assign(new Error('异议不存在'), { status: 404 });
        if (item.status !== 'open') throw Object.assign(new Error('异议已处理'), { status: 409 });
        const now = new Date().toISOString();
        await run("UPDATE reward_program_objections SET status = 'resolved', resolution = ?, resolved_by = ?, resolved_at = ? WHERE id = ?", [resolution, actor, now, objectionId]);
        await run('INSERT INTO reward_program_events VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), applicationId, actor, 'resolve_objection', resolution, now]);
        return { id: objectionId, status: 'resolved', resolution, resolvedBy: actor, resolvedAt: now };
    });
}
module.exports = { rules, saveRule, deleteRule, application, listApplications, events, objections, insert, update, remove, addObjection, resolveObjection };
