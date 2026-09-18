const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'reward-penalty-'));
process.env.TOOLS_DATA_DIR = path.join(sandbox, 'data');
process.env.TOOLS_REPORT_DATA_DIR = path.join(sandbox, 'report');
const db = require('../backend/models/app-db');
const { runWithTenant } = require('../backend/models/tenant-context');
const repo = require('../backend/models/department-reward-penalty-repository');
const express = require('express');
const request = require('supertest');
const router = require('../backend/routes/department-reward-penalty');
test.after(async () => { await db.closeDatabase(); fs.rmSync(sandbox, { recursive: true, force: true }); });

test('default rules exclude personal data; writes and audit remain tenant isolated', async () => {
    const initial = await repo.list();
    assert.equal(initial.rules.length, 55);
    assert.deepEqual(initial.personnel, []);
    assert.deepEqual(initial.records, []);
    assert.deepEqual((await repo.listAudit()).rows, []);

    await repo.put('personnel', 'P-1', { name: 'Test Person', role: 'MTD' }, 'admin', '保存');
    await repo.put('personnel', 'P-1', { name: 'Changed Person', role: 'MTD' }, 'admin', '修改', '校正姓名');
    const own = await repo.list();
    assert.equal(own.personnel[0].name, 'Changed Person');
    const audit = await repo.listAudit({ page: 1, pageSize: 1 });
    assert.equal(audit.total, 2);
    assert.equal(audit.rows[0].actor, 'admin');
    assert.equal(audit.rows[0].before.name, 'Test Person');
    assert.equal(audit.rows[0].after.name, 'Changed Person');
    assert.equal(audit.rows[0].reason, '校正姓名');
    await repo.put('roles', 'New Role', { value: 'New Role' }, 'admin');
    assert.ok((await repo.list()).roles.some(item => item.value === 'MTD'));
    assert.ok((await repo.list()).roles.some(item => item.value === 'New Role'));

    await runWithTenant('other', async () => {
        const isolated = await repo.list();
        assert.equal(isolated.rules.length, 55);
        assert.deepEqual(isolated.personnel, []);
        assert.deepEqual((await repo.listAudit()).rows, []);
        await repo.put('personnel', 'P-2', { name: 'Other Tenant', role: 'TE' }, 'admin');
    });
    assert.deepEqual((await repo.list()).personnel.map(item => item.id), ['P-1']);
});

test('record API checks roles, requires a publish reason, and keeps rule snapshots', async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = req.headers['x-test-role'] === 'user' ? { username: 'reporter', role: 'user' } : { username: 'admin', role: 'admin' }; next(); });
    app.use('/api/department-reward-penalty', router);
    const base = '/api/department-reward-penalty';
    const group = await request(app).post(base + '/config/customerGroups').send({ value: '客户群 A' }).expect(200);
    const anotherGroup = await request(app).post(base + '/config/customerGroups').send({ value: '客户群 B' }).expect(200);
    await request(app).post(base + '/personnel').send({ id: 'TEST-MTD', name: 'Reviewer', role: 'MTD' }).expect(400);
    await request(app).post(base + '/personnel').send({ id: 'TEST-MTD', name: 'Reviewer', role: 'MTD', customerGroupId: group.body.id }).expect(200);
    await request(app).post(base + '/personnel').send({ id: 'TEST-TE', name: 'Engineer', role: 'TE', customerGroupId: anotherGroup.body.id }).expect(200);
    const draft = { id: 'test-record', date: '2026-09-17', customerGroupId: group.body.id, staffId: 'TEST-MTD', ruleId: 'R04', deduct: '1 Month/Time', remark: 'Test' };
    await request(app).post(base + '/records').send({ ...draft, staffId: 'TEST-TE' }).expect(400);
    const mismatch = await request(app).post(base + '/records').send({ ...draft, staffId: 'TEST-TE', customerGroupId: anotherGroup.body.id }).expect(400);
    assert.match(mismatch.body.error, /MTD/);
    await request(app).post(base + '/records').send({ ...draft, deduct: '1 Quarter/Time' }).expect(400);
    await request(app).post(base + '/records').set('x-test-role', 'user').send(draft).expect(200);
    await request(app).post(base + '/records').set('x-test-role', 'user').send({ ...draft, action: 'publish', reason: 'Attempt' }).expect(403);
    await request(app).post(base + '/rules').set('x-test-role', 'user').send({ id: 'bad' }).expect(403);
    await request(app).post(base + '/records').send({ ...draft, action: 'publish' }).expect(400);
    const published = await request(app).post(base + '/records').send({ ...draft, action: 'publish', reason: 'Reviewed evidence' }).expect(200);
    assert.equal(published.body.status, 'published');
    assert.equal(published.body.ruleSnapshot.desc, '整改未在支持要求的时间内完成（包括延期）');
    await request(app).post(base + '/records').send({ ...draft, remark: 'Late edit' }).expect(400);
    await request(app).post(base + '/records').send({ id: draft.id, action: 'revoke', reason: 'Incorrect finding' }).expect(403);
    await request(app).post(base + '/records').send({ id: draft.id, action: 'revoke', pin: 'wrong', reason: 'Incorrect finding' }).expect(403);
    const revoked = await request(app).post(base + '/records').send({ id: draft.id, action: 'revoke', pin: '0000', reason: 'Incorrect finding' }).expect(200);
    assert.equal(revoked.body.status, 'revoked');
    const state = await request(app).get(base).expect(200);
    const auditPage = await request(app).get(base + '/audit?page=1&pageSize=2').expect(200);
    assert.equal(auditPage.body.rows.length, 2);
    assert.ok(auditPage.body.total > 2);
    assert.equal(auditPage.body.rows.find(item => item.action === '撤销已发布违规').reason, 'Incorrect finding');
    const lastPage = await request(app).get(base + '/audit?page=999&pageSize=2').expect(200);
    assert.equal(lastPage.body.page, lastPage.body.totalPages);
    const uploaded = await request(app).post(base + '/evidence').attach('file', Buffer.from('%PDF-1.4\n% test'), { filename: 'proof.pdf', contentType: 'application/pdf' }).expect(200);
    assert.match(uploaded.body.path, /^\/api\/department-reward-penalty\/evidence\/[a-f0-9-]+\.pdf$/);
    await request(app).get(uploaded.body.path).expect(200);
});

test('legacy import moves browser records into a separate tenant without bundling people', async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = { username: 'admin', role: 'admin' }; runWithTenant('import-test', next); });
    app.use('/api/department-reward-penalty', router);
    const legacy = {
        personnel: [{ id: 'P-9', name: 'Legacy Person', role: 'MTD' }],
        rules: [{ id: 'R04', svcModule: 'Risk', subModule: '整改', desc: '逾期', roles: 'MTD', deduct: '1 Month/Time', weight: '10%' }],
        records: [{ id: 'OLD-1', status: '已发布', date: '2026-08-01', staffId: 'P-9', ruleId: 'R04', deduct: '1 Month/Time', tt: 'T-1', remark: '历史记录' }]
    };
    await request(app).post('/api/department-reward-penalty/legacy-import').send(legacy).expect(200);
    const imported = await request(app).get('/api/department-reward-penalty').expect(200);
    assert.equal(imported.body.personnel[0].name, 'Legacy Person');
    assert.equal(imported.body.records[0].status, 'published');
    assert.equal(imported.body.records[0].ruleSnapshot.desc, '逾期');
    const amended = await request(app).post('/api/department-reward-penalty/records/OLD-1/force-edit').send({ ...imported.body.records[0], remark: '历史备注修正', pin: '0000', reason: '历史信息校正' }).expect(200);
    assert.equal(amended.body.status, 'published');
    assert.equal(amended.body.remark, '历史备注修正');
    assert.equal(amended.body.customerGroupId, '');
    await request(app).post('/api/department-reward-penalty/legacy-import').send(legacy).expect(409);
});

test('configuration CRUD updates references, blocks used deletion, and paginates audit', async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = { username: 'admin', role: 'admin' }; runWithTenant('config-test', next); });
    app.use('/api/department-reward-penalty', router);
    const base = '/api/department-reward-penalty';
    const group = (await request(app).post(base + '/config/customerGroups').send({ value: '群一' }).expect(200)).body;
    const role = (await request(app).post(base + '/config/roles').send({ value: '新角色' }).expect(200)).body;
    const category = (await request(app).post(base + '/config/deductionCategories').send({ value: '专项' }).expect(200)).body;
    await request(app).post(base + '/config/deductions').send({ value: '无分类扣罚' }).expect(400);
    const deduction = (await request(app).post(base + '/config/deductions').send({ value: '新扣罚', categoryId: category.id }).expect(200)).body;
    await request(app).post(base + '/personnel').send({ id: 'P-1', name: '人员', role: role.value, customerGroupId: group.id }).expect(200);
    await request(app).post(base + '/rules').send({ id: 'TEST-RULE', svcModule: '大类', subModule: '子类', desc: '违规', roles: [role.value], deduct: deduction.value, weight: null }).expect(200);
    await request(app).delete(base + '/config/roles/' + role.id).expect(409);
    await request(app).delete(base + '/config/deductions/' + deduction.id).expect(409);
    await request(app).delete(base + '/config/deductionCategories/' + category.id).expect(409);
    await request(app).delete(base + '/config/customerGroups/' + group.id).expect(409);
    await request(app).put(base + '/config/roles/' + role.id).send({ value: '新角色二' }).expect(200);
    await request(app).put(base + '/config/deductions/' + deduction.id).send({ value: '新扣罚二' }).expect(200);
    await request(app).put(base + '/config/customerGroups/' + group.id).send({ value: '群二' }).expect(200);
    const state = (await request(app).get(base).expect(200)).body;
    assert.equal(state.personnel[0].role, '新角色二');
    assert.equal(state.personnel[0].customerGroupId, group.id);
    assert.deepEqual(state.rules.find(item => item.id === 'TEST-RULE').roles, ['新角色二']);
    assert.equal(state.rules.find(item => item.id === 'TEST-RULE').deduct, '新扣罚二');
    assert.equal(state.deductions.find(item => item.id === deduction.id).categoryId, category.id);
    assert.equal(state.customerGroups[0].value, '群二');
    const audit = (await request(app).get(base + '/audit?page=2&pageSize=3').expect(200)).body;
    assert.equal(audit.page, 2);
    assert.equal(audit.rows.length, 3);
});

test('one person can hold multiple groups and roles while records bind to one selected group', async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = { username: 'admin', role: 'admin' }; runWithTenant('multi-person-test', next); });
    app.use('/api/department-reward-penalty', router);
    const base = '/api/department-reward-penalty';
    const a = (await request(app).post(base + '/config/customerGroups').send({ value: 'A' }).expect(200)).body;
    const b = (await request(app).post(base + '/config/customerGroups').send({ value: 'B' }).expect(200)).body;
    await request(app).post(base + '/personnel').send({ id: 'MULTI-1', name: '多角色人员', roles: ['TE', 'MTD'], customerGroupIds: [a.id, b.id] }).expect(200);
    const person = (await request(app).get(base).expect(200)).body.personnel[0];
    assert.deepEqual(person.roles, ['TE', 'MTD']);
    assert.deepEqual(person.customerGroupIds, [a.id, b.id]);
    const draft = { id: 'multi-record', date: '2026-09-17', staffId: person.id, customerGroupId: b.id, ruleId: 'R04' };
    const recorded = await request(app).post(base + '/records').send(draft).expect(200);
    assert.equal(recorded.body.deduct, '1 Month/Time');
    assert.equal(recorded.body.customerGroupId, b.id);
    await request(app).post(base + '/records').send({ ...draft, id: 'bad-group', customerGroupId: 'unknown' }).expect(400);
    await request(app).post(base + '/records').send({ ...draft, id: 'bad-deduction', deduct: 'Custom' }).expect(400);
    await request(app).delete(base + '/config/customerGroups/' + b.id).expect(409);
    await request(app).delete(base + '/config/roles/MTD').expect(409);
});

test('BU assignment and forced published-record edits are tenant-scoped and audited without leaking PINs', async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = req.headers['x-test-role'] === 'user' ? { username: 'reporter', role: 'user' } : { username: 'admin', role: 'admin' }; runWithTenant(req.headers['x-test-tenant'] || 'force-edit-test', next); });
    app.use('/api/department-reward-penalty', router);
    const base = '/api/department-reward-penalty';
    const unitA = (await request(app).post(base + '/config/businessUnits').send({ value: 'BU A' }).expect(200)).body;
    const unitB = (await request(app).post(base + '/config/businessUnits').send({ value: 'BU B' }).expect(200)).body;
    const group = (await request(app).post(base + '/config/customerGroups').send({ value: '客户群' }).expect(200)).body;
    await request(app).post(base + '/personnel').send({ id: 'BU-1', name: '人员', roles: ['MTD'], customerGroupIds: [group.id], businessUnitIds: [unitA.id, unitB.id] }).expect(200);
    let state = (await request(app).get(base).expect(200)).body;
    assert.deepEqual(state.personnel[0].businessUnitIds, [unitA.id, unitB.id]);
    await request(app).delete(base + '/config/businessUnits/' + unitA.id).expect(409);
    const draft = { id: 'PUBLISHED-1', date: '2026-09-17', staffId: 'BU-1', customerGroupId: group.id, ruleId: 'R04', remark: '原备注' };
    await request(app).post(base + '/records').send({ ...draft, action: 'publish', reason: '核准' }).expect(200);
    await request(app).post(base + '/records/PUBLISHED-1/force-edit').set('x-test-role', 'user').send({ ...draft, pin: '0000', reason: '修正' }).expect(403);
    await request(app).post(base + '/records/PUBLISHED-1/force-edit').send({ ...draft, pin: '9999', reason: '修正' }).expect(403);
    await request(app).post(base + '/records/PUBLISHED-1/force-edit').send({ ...draft, pin: '0000' }).expect(400);
    const updated = (await request(app).post(base + '/records/PUBLISHED-1/force-edit').send({ ...draft, pin: '0000', reason: '修正误录', remark: '新备注' }).expect(200)).body;
    assert.equal(updated.status, 'published');
    assert.equal(updated.remark, '新备注');
    assert.equal(updated.forcedEditReason, '修正误录');
    await request(app).put(base + '/security/pin').send({ currentPin: '0000', newPin: '123456' }).expect(200);
    await request(app).post(base + '/records/PUBLISHED-1/force-edit').send({ ...draft, pin: '0000', reason: '旧口令' }).expect(403);
    await request(app).post(base + '/records/PUBLISHED-1/force-edit').send({ ...draft, pin: '123456', reason: '再次修正', remark: '再次修改' }).expect(200);
    state = (await request(app).get(base).expect(200)).body;
    assert.equal(JSON.stringify(state).includes('123456'), false);
    const audit = (await request(app).get(base + '/audit').expect(200)).body;
    assert.ok(audit.rows.some(row => row.action === '强制修改已发布违规'));
    assert.equal(JSON.stringify(audit).includes('123456'), false);
    const draft2 = { id: 'PUBLISHED-2', date: '2026-09-17', staffId: 'BU-1', customerGroupId: group.id, ruleId: 'R04', remark: '待撤销记录' };
    await request(app).post(base + '/records').send({ ...draft2, action: 'publish', reason: '发布待撤' }).expect(200);
    await request(app).post(base + '/records/PUBLISHED-2/revoke').set('x-test-role', 'user').send({ pin: '123456', reason: '越权撤销' }).expect(403);
    await request(app).post(base + '/records/PUBLISHED-2/revoke').send({ pin: '0000', reason: '旧口令撤销' }).expect(403);
    await request(app).post(base + '/records/PUBLISHED-2/revoke').send({ pin: '123456' }).expect(400);
    const revokedRes = (await request(app).post(base + '/records/PUBLISHED-2/revoke').send({ pin: '123456', reason: '合规复核撤销' }).expect(200)).body;
    assert.equal(revokedRes.status, 'revoked');
    assert.equal(revokedRes.revokeReason, '合规复核撤销');
    const revokeAudit = (await request(app).get(base + '/audit').expect(200)).body;
    assert.ok(revokeAudit.rows.some(row => row.action === '撤销已发布违规' && row.reason === '合规复核撤销'));
    assert.equal(JSON.stringify(revokeAudit).includes('123456'), false);
    const otherSecurity = (await request(app).get(base + '/security').set('x-test-tenant', 'other-force-edit-test').expect(200)).body;
    assert.equal(otherSecurity.hasCustomPin, false);
});
