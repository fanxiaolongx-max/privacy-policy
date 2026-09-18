const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { getDataDir } = require('../models/store');
const { getDbPath } = require('../models/app-db');
const repo = require('../models/department-reward-penalty-repository');
const router = express.Router();
const evidenceUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
const clean = (value, limit = 500) => String(value ?? '').trim().slice(0, limit);
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const id = () => crypto.randomUUID();
const roleTokens = value => String(value || '').split(/[,+/]/).map(part => part.trim().toLowerCase()).filter(Boolean);
const ruleRoles = rule => Array.isArray(rule.roles) ? rule.roles : String(rule.roles || '').split(/[,+/]/).map(part => part.trim()).filter(Boolean);
const personRoles = person => Array.isArray(person.roles) ? person.roles : [clean(person.role, 80)].filter(Boolean);
const personGroups = person => Array.isArray(person.customerGroupIds) ? person.customerGroupIds : [clean(person.customerGroupId, 100)].filter(Boolean);
const personBusinessUnits = person => Array.isArray(person.businessUnitIds) ? person.businessUnitIds : [];
const matching = (person, rule) => {
    const actual = new Set(personRoles(person).flatMap(role => [role.toLowerCase(), ...roleTokens(role.toLowerCase().replace(/[()]/g, '/'))]).map(part => part.replace(/[^a-z0-9]/g, '')));
    return roleTokens(rule.roles).some(part => { const allowed = part.replace(/[^a-z0-9]/g, ''); return allowed === 'all' || actual.has(allowed); });
};
const respond = handler => (req, res) => Promise.resolve(handler(req, res)).catch(error => res.status(error.status || 500).json({ error: error.message || '操作失败' }));
const pinFailures = new Map();
async function requireForceEditPin(req, pin) {
    const key = `${getDbPath()}:${req.user.username}`;
    const attempt = pinFailures.get(key);
    if (attempt && attempt.until > Date.now()) fail('口令尝试次数过多，请稍后重试', 429);
    if (await repo.verifyForceEditPin(pin)) { pinFailures.delete(key); return; }
    const count = (attempt?.until && attempt.until <= Date.now() ? 0 : attempt?.count || 0) + 1;
    pinFailures.set(key, { count, until: count >= 5 ? Date.now() + 15 * 60_000 : 0 });
    fail('修改口令不正确', 403);
}

router.get('/', respond(async (req, res) => { res.setHeader('Cache-Control', 'no-store'); res.json({ ...await repo.list(), canEdit: req.user?.role === 'admin', username: req.user?.username || '' }); }));
router.get('/audit', respond(async (req, res) => { res.setHeader('Cache-Control', 'no-store'); res.json(await repo.listAudit(req.query)); }));
router.get('/security', respond(async (req, res) => { if (req.user?.role !== 'admin') fail('仅管理员可查看口令设置', 403); res.setHeader('Cache-Control', 'no-store'); res.json({ hasCustomPin: await repo.hasCustomForceEditPin() }); }));
router.put('/security/pin', respond(async (req, res) => {
    if (req.user?.role !== 'admin') fail('仅管理员可修改口令', 403);
    const currentPin = String(req.body?.currentPin ?? ''), newPin = String(req.body?.newPin ?? '');
    if (!/^\d{4,12}$/.test(newPin)) fail('新口令须为 4–12 位数字');
    await requireForceEditPin(req, currentPin);
    await repo.changeForceEditPin(currentPin, newPin, req.user.username);
    res.json({ success: true });
}));
const CONFIG_KINDS = new Set(['roles', 'deductions', 'deductionCategories', 'customerGroups', 'businessUnits']);
const configKind = req => { if (!CONFIG_KINDS.has(req.params.kind)) fail('配置类型无效'); return req.params.kind; };
const requireConfigAdmin = req => { if (req.user?.role !== 'admin') fail('仅管理员可维护配置', 403); };
router.post('/config/:kind', respond(async (req, res) => {
    requireConfigAdmin(req);
    const kind = configKind(req), value = clean(req.body?.value, 100);
    if (!value) fail('配置名称不能为空');
    const state = await repo.list();
    if (state[kind].some(item => item.value.toLowerCase() === value.toLowerCase())) fail('配置名称已存在', 409);
    const categoryId = kind === 'deductions' ? clean(req.body?.categoryId, 100) : '';
    if (kind === 'deductions' && !state.deductionCategories.some(item => item.id === categoryId)) fail('请选择有效的扣罚分类');
    const itemId = id();
    res.json(await repo.put(kind, itemId, { value, ...(categoryId ? { categoryId } : {}), archived: false }, req.user.username, '新增配置'));
}));
router.put('/config/:kind/:id', respond(async (req, res) => {
    requireConfigAdmin(req);
    const kind = configKind(req), state = await repo.list(), old = state[kind].find(item => item.id === req.params.id);
    if (!old) fail('配置不存在', 404);
    const value = clean(req.body?.value, 100);
    if (!value) fail('配置名称不能为空');
    if (state[kind].some(item => item.id !== old.id && item.value.toLowerCase() === value.toLowerCase())) fail('配置名称已存在', 409);
    const categoryId = kind === 'deductions' ? clean(req.body?.categoryId || old.categoryId, 100) : '';
    if (kind === 'deductions' && !state.deductionCategories.some(item => item.id === categoryId)) fail('请选择有效的扣罚分类');
    const changes = [{ kind, id: old.id, payload: { ...old, value, ...(categoryId ? { categoryId } : {}), archived: false } }];
    if (kind === 'roles') {
        for (const person of state.personnel.filter(item => personRoles(item).includes(old.value))) changes.push({ kind: 'personnel', id: person.id, payload: { ...person, roles: personRoles(person).map(role => role === old.value ? value : role), role: person.role === old.value ? value : person.role } });
        for (const rule of state.rules.filter(item => ruleRoles(item).includes(old.value))) changes.push({ kind: 'rules', id: rule.id, payload: { ...rule, roles: ruleRoles(rule).map(role => role === old.value ? value : role) } });
    }
    if (kind === 'deductionCategories') {
        // Deduction standards refer to a stable category ID; renaming needs no cascade.
    }
    if (kind === 'deductions') {
        for (const rule of state.rules.filter(item => item.deduct === old.value)) changes.push({ kind: 'rules', id: rule.id, payload: { ...rule, deduct: value } });
        for (const record of state.records.filter(item => item.status === 'draft' && item.deduct === old.value)) changes.push({ kind: 'records', id: record.id, payload: { ...record, deduct: value, ruleSnapshot: { ...record.ruleSnapshot, deduct: value } } });
    }
    await repo.putMany(changes, req.user.username, '修改配置', old.value + ' → ' + value);
    res.json({ ...old, value, ...(categoryId ? { categoryId } : {}), updatedReferences: changes.length - 1 });
}));
router.delete('/config/:kind/:id', respond(async (req, res) => {
    requireConfigAdmin(req);
    const kind = configKind(req), state = await repo.list(), old = state[kind].find(item => item.id === req.params.id);
    if (!old) fail('配置不存在', 404);
    const used = kind === 'roles'
        ? state.personnel.some(item => !item.archived && personRoles(item).includes(old.value)) || state.rules.some(item => !item.archived && ruleRoles(item).includes(old.value))
        : kind === 'deductions'
            ? state.rules.some(item => !item.archived && item.deduct === old.value) || state.records.some(item => item.status === 'draft' && item.deduct === old.value)
            : kind === 'deductionCategories'
                ? state.deductions.some(item => item.categoryId === old.id)
                : kind === 'businessUnits'
                    ? state.personnel.some(item => !item.archived && personBusinessUnits(item).includes(old.id))
                    : state.personnel.some(item => !item.archived && personGroups(item).includes(old.id));
    if (used) fail('该配置仍被当前人员、规则或草稿引用，请先调整引用', 409);
    res.json(await repo.put(kind, old.id, { ...old, archived: true }, req.user.username, '删除配置'));
}));
router.post('/legacy-import', respond(async (req, res) => {
    if (req.user.role !== 'admin') fail('仅管理员可导入旧版数据', 403);
    const source = req.body || {}, people = source.personnel, rules = source.rules, records = source.records;
    if (!Array.isArray(people) || !Array.isArray(rules) || !Array.isArray(records) || people.length > 5000 || rules.length > 2000 || records.length > 20000) fail('旧版数据格式或数量无效');
    const current = await repo.list();
    if (current.personnel.length || current.records.length) fail('当前租户已有人员或记录，不能重复导入', 409);
    const personIds = new Set(), ruleIds = new Set(current.rules.map(rule => rule.id));
    for (const person of people) {
        const personId = clean(person.id, 100), name = clean(person.name, 120), role = clean(person.role, 80);
        if (!personId || !name || !role || personIds.has(personId)) fail('旧版人员数据无效或工号重复');
        personIds.add(personId);
    }
    for (const rule of rules) {
        const ruleId = clean(rule.id, 100);
        if (!ruleId || !clean(rule.svcModule, 100) || !clean(rule.subModule, 100) || !clean(rule.desc, 1000)) fail('旧版规则数据无效');
        ruleIds.add(ruleId);
    }
    for (const record of records) {
        if (!clean(record.id, 100) || !personIds.has(clean(record.staffId, 100)) || !ruleIds.has(clean(record.ruleId, 100))) fail('旧版记录存在缺失的人员或规则引用');
    }
    for (const person of people) {
        const role = clean(person.role, 80);
        if (!current.roles.some(item => item.value === role)) await repo.put('roles', role, { value: role }, req.user.username, '迁移角色');
        await repo.put('personnel', clean(person.id, 100), { name: clean(person.name, 120), role, archived: false }, req.user.username, '迁移人员');
    }
    for (const rule of rules) {
        const roles = String(rule.roles || '').split(/[,+/]/).map(value => clean(value, 80)).filter(Boolean);
        const deduct = clean(rule.deduct, 100);
        for (const role of roles) if (!current.roles.some(item => item.value.toLowerCase() === role.toLowerCase())) await repo.put('roles', role, { value: role }, req.user.username, '迁移角色');
        if (deduct && !current.deductions.some(item => item.value === deduct)) await repo.put('deductions', deduct, { value: deduct }, req.user.username, '迁移扣罚标准');
        const weight = /^\d+%$/.test(String(rule.weight)) ? Number.parseInt(rule.weight, 10) : null;
        await repo.put('rules', clean(rule.id, 100), { svcModule: clean(rule.svcModule, 100), subModule: clean(rule.subModule, 100), desc: clean(rule.desc, 1000), roles, deduct, weight, archived: false }, req.user.username, '迁移规则');
    }
    const importedState = await repo.list();
    for (const record of records) {
        const staffId = clean(record.staffId, 100), ruleId = clean(record.ruleId, 100);
        const person = importedState.personnel.find(item => item.id === staffId), rule = importedState.rules.find(item => item.id === ruleId);
        const status = record.status === '已发布' ? 'published' : 'draft';
        await repo.put('records', clean(record.id, 100), { date: clean(record.date, 10), staffId, ruleId, deduct: clean(record.deduct, 100), tt: clean(record.tt, 100), remark: clean(record.remark, 2000), evidence: '', attachment: '', status, createdBy: 'legacy-import', ruleSnapshot: { svcModule: rule.svcModule, subModule: rule.subModule, desc: rule.desc, roles: rule.roles, deduct: rule.deduct }, personSnapshot: { name: person.name, role: person.role }, migrationWarning: !matching(person, rule), ...(status === 'published' ? { publishReason: '旧版浏览器数据迁移' } : {}) }, req.user.username, '迁移历史记录', '旧版浏览器数据迁移');
    }
    res.json({ imported: { personnel: people.length, rules: rules.length, records: records.length } });
}));
router.post('/evidence', evidenceUpload.single('file'), respond(async (req, res) => {
    if (!req.file) fail('请选择证据文件');
    const allowed = new Map([['application/pdf', '.pdf'], ['image/png', '.png'], ['image/jpeg', '.jpg'], ['text/plain', '.txt']]);
    const extension = allowed.get(req.file.mimetype);
    if (!extension) fail('仅支持 PDF、PNG、JPG、TXT 文件');
    const filename = crypto.randomUUID() + extension;
    const directory = path.join(getDataDir(), 'department-reward-penalty-evidence');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, filename), req.file.buffer, { flag: 'wx' });
    await repo.ensureReady();
    await repo.audit(req.user.username, '上传证据', 'evidence', filename, null, { filename, size: req.file.size }, '');
    res.json({ path: '/api/department-reward-penalty/evidence/' + filename });
}));
router.get('/evidence/:filename', respond(async (req, res) => {
    const filename = req.params.filename;
    if (!/^[a-f0-9-]{36}\.(?:pdf|png|jpg|txt)$/.test(filename)) fail('文件名无效');
    const filepath = path.join(getDataDir(), 'department-reward-penalty-evidence', filename);
    if (!fs.existsSync(filepath)) fail('文件不存在', 404);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', 'attachment; filename="evidence' + path.extname(filename) + '"');
    res.sendFile(filepath);
}));
router.post('/records/:id/force-edit', respond(async (req, res) => {
    if (req.user?.role !== 'admin') fail('仅管理员可强制修改已发布记录', 403);
    const recordId = clean(req.params.id, 100), body = req.body || {}, old = await repo.item('records', recordId);
    if (!old || old.status !== 'published') fail('只能强制修改已发布记录');
    const reason = clean(body.reason, 1000);
    if (!reason) fail('强制修改理由必填');
    await requireForceEditPin(req, body.pin);
    const date = clean(body.date, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('日期无效');
    const attachment = clean(body.attachment, 200);
    if (attachment && !/^\/api\/department-reward-penalty\/evidence\/[a-f0-9-]{36}\.(?:pdf|png|jpg|txt)$/.test(attachment)) fail('附件路径无效');
    const staffId = clean(body.staffId, 100), ruleId = clean(body.ruleId, 100), customerGroupId = clean(body.customerGroupId, 100);
    const changedReference = staffId !== old.staffId || ruleId !== old.ruleId || customerGroupId !== clean(old.customerGroupId, 100);
    let ruleSnapshot = old.ruleSnapshot, personSnapshot = old.personSnapshot, deduct = old.deduct;
    if (changedReference) {
        const state = await repo.list();
        const person = state.personnel.find(item => item.id === staffId && !item.archived);
        const rule = state.rules.find(item => item.id === ruleId && !item.archived);
        const group = state.customerGroups.find(item => item.id === customerGroupId);
        if (!person || !rule || !group || !personGroups(person).includes(group.id)) fail('请为新责任主体选择有效的客户群和规则');
        if (!matching(person, rule)) fail(`责任主体角色 ${personRoles(person).join('、')} 不匹配；本规则适用角色：${ruleRoles(rule).join('、')}`);
        deduct = rule.deduct;
        ruleSnapshot = { svcModule: rule.svcModule, subModule: rule.subModule, desc: rule.desc, roles: rule.roles, deduct };
        personSnapshot = { name: person.name, role: person.role, roles: personRoles(person), customerGroupId: group.id, customerGroupName: group.value };
    }
    if (body.deduct && clean(body.deduct, 100) !== deduct) fail('扣罚必须与原记录或新规则的标准一致');
    const value = { ...old, date, staffId, ruleId, customerGroupId, deduct, ruleSnapshot, personSnapshot, tt: clean(body.tt, 100), remark: clean(body.remark, 2000), evidence: clean(body.evidence, 500), attachment, forcedEditAt: new Date().toISOString(), forcedEditBy: req.user.username, forcedEditReason: reason };
    res.json(await repo.putPublishedWithPin(recordId, value, body.pin, req.user.username, reason));
}));
router.post('/records/:id/revoke', respond(async (req, res) => {
    if (req.user.role !== 'admin') fail('仅管理员可发布或撤销', 403);
    const recordId = clean(req.params.id, 100);
    const old = await repo.item('records', recordId);
    if (!old || old.status !== 'published') fail('只能撤销已发布记录', 409);
    const reason = clean(req.body?.reason, 1000);
    if (!reason) fail('撤销理由必填');
    await requireForceEditPin(req, req.body?.pin);
    const value = { ...old, status: 'revoked', revokedAt: new Date().toISOString(), revokeReason: reason, revokedBy: req.user.username };
    res.json(await repo.put('records', recordId, value, req.user.username, '撤销已发布违规', reason));
}));
router.post('/:kind', respond(async (req, res) => {
    const kind = req.params.kind, body = req.body || {}, actor = req.user.username;
    if (!['personnel', 'rules', 'records'].includes(kind)) fail('无效的数据类型');
    if (kind !== 'records' && req.user.role !== 'admin') fail('仅管理员可维护配置', 403);
    const state = await repo.list();
    let value, itemId = clean(body.id, 100) || id();
    if (kind === 'personnel') {
        const name = clean(body.name, 120);
        const roles = [...new Set((Array.isArray(body.roles) ? body.roles : [body.role]).map(value => clean(value, 80)).filter(Boolean))];
        const customerGroupIds = [...new Set((Array.isArray(body.customerGroupIds) ? body.customerGroupIds : [body.customerGroupId]).map(value => clean(value, 100)).filter(Boolean))];
        const businessUnitIds = [...new Set((Array.isArray(body.businessUnitIds) ? body.businessUnitIds : []).map(value => clean(value, 100)).filter(Boolean))];
        if (!name || !roles.length || !roles.every(role => state.roles.some(item => item.value === role))) fail('姓名和有效角色必填');
        if (!body.archived && (!customerGroupIds.length || !customerGroupIds.every(groupId => state.customerGroups.some(item => item.id === groupId)))) fail('请至少为人员配置一个有效客户群');
        if (!businessUnitIds.every(unitId => state.businessUnits.some(item => item.id === unitId))) fail('BU 配置无效');
        value = { id: itemId, name, roles, role: roles[0], customerGroupIds, customerGroupId: customerGroupIds[0] || '', businessUnitIds, archived: Boolean(body.archived) };
    } else if (kind === 'rules') {
        const svcModule = clean(body.svcModule, 100), subModule = clean(body.subModule, 100), desc = clean(body.desc, 1000), roles = Array.isArray(body.roles) ? body.roles.map(value => clean(value, 80)) : roleTokens(body.roles), deduct = clean(body.deduct, 100);
        if (!svcModule || !subModule || !desc || !roles.length || !deduct) fail('规则字段不完整');
        if (!roles.every(role => state.roles.some(item => item.value === role)) || !state.deductions.some(item => item.value === deduct)) fail('角色或扣罚标准无效');
        const weight = body.weight === null ? null : Number(body.weight);
        if (weight !== null && (!Number.isInteger(weight) || weight < 0 || weight > 100)) fail('权重需为 0–100 或不适用');
        value = { id: itemId, svcModule, subModule, desc, roles, deduct, weight, archived: Boolean(body.archived) };
    } else if (kind === 'records') {
        const old = await repo.item('records', itemId);
        if (req.user.role !== 'admin' && (body.action === 'publish' || body.action === 'revoke')) fail('仅管理员可发布或撤销', 403);
        if (req.user.role !== 'admin' && old && old.createdBy !== actor) fail('只能编辑本人草稿', 403);
        if (old && old.status !== 'draft' && body.action !== 'revoke') fail('已发布记录不能编辑');
        const staffId = clean(body.staffId, 100), ruleId = clean(body.ruleId, 100), customerGroupId = clean(body.customerGroupId, 100), person = state.personnel.find(item => item.id === staffId && !item.archived), rule = state.rules.find(item => item.id === ruleId && !item.archived);
        if (body.action === 'revoke') {
            if (!old || old.status !== 'published') fail('只能撤销已发布记录');
            const reason = clean(body.reason, 1000); if (!reason) fail('撤销理由必填');
            await requireForceEditPin(req, body.pin);
            value = { ...old, status: 'revoked', revokedAt: new Date().toISOString(), revokeReason: reason, revokedBy: actor };
            return res.json(await repo.put(kind, itemId, value, actor, '撤销已发布违规', reason));
        }
        if (!person || !rule) fail('请选择有效的责任主体和规则');
        const group = state.customerGroups.find(item => item.id === customerGroupId);
        if (!group || !personGroups(person).includes(group.id)) fail('请先选择客户群，再选择该客户群下的责任主体');
        if (!matching(person, rule)) fail(`责任主体角色 ${personRoles(person).join('、')} 不匹配；本规则适用角色：${ruleRoles(rule).join('、')}`);
        const deduct = rule.deduct;
        if (body.deduct && clean(body.deduct, 100) !== deduct) fail('实际扣罚必须与所选规则的扣罚基准一致');
        const date = clean(body.date, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('日期无效');
        const action = clean(body.action, 20), reason = clean(body.reason, 1000);
        if (action === 'publish' && !reason) fail('发布理由必填');
        const attachment = clean(body.attachment, 200);
        if (attachment && !/^\/api\/department-reward-penalty\/evidence\/[a-f0-9-]{36}\.(?:pdf|png|jpg|txt)$/.test(attachment)) fail('附件路径无效');
        value = { ...(old || {}), id: itemId, createdBy: old?.createdBy || actor, date, staffId, customerGroupId, ruleId, deduct, tt: clean(body.tt, 100), remark: clean(body.remark, 2000), evidence: clean(body.evidence, 500), attachment, status: action === 'publish' ? 'published' : 'draft', ruleSnapshot: { svcModule: rule.svcModule, subModule: rule.subModule, desc: rule.desc, roles: rule.roles, deduct: rule.deduct }, personSnapshot: { name: person.name, role: person.role, roles: personRoles(person), customerGroupId: group.id, customerGroupName: group.value }, ...(action === 'publish' ? { publishedAt: new Date().toISOString(), publishReason: reason } : {}) };
    }
    res.json(await repo.put(kind, itemId, value, actor, body.action === 'publish' ? '发布' : '保存', clean(body.reason, 1000)));
}));

module.exports = router;
