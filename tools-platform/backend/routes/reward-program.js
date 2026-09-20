const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { getDataDir } = require('../models/tenant-context');
const repo = require('../models/reward-program-repository');
const { CATEGORIES, money, label, normalizeApplication } = require('../models/reward-program-core');
const router = express.Router();
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const wrap = handler => (req, res) => Promise.resolve(handler(req, res)).catch(error => res.status(error.status || 500).json({ error: error.message || '操作失败' }));
const admin = req => req.user?.role === 'admin';
const owner = (req, record) => admin(req) || record.applicant === req.user.username;
const revision = body => { const value = Number(body?.revision); if (!Number.isInteger(value) || value < 1) fail('记录版本无效'); return value; };

const evidenceUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 } });
const EVIDENCE_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.txt', '.zip', '.rar', '.7z', '.tar', '.gz', '.eml', '.msg']);
const EVIDENCE_FILENAME_REGEX = /^[a-f0-9-]{36}\.(?:pdf|png|jpg|jpeg|txt|zip|rar|7z|tar|gz|eml|msg)$/i;
const getEvidenceDir = req => path.join(getDataDir(req?.user?.tenantId || 'default'), 'reward-program-evidence');
const getEvidencePath = (filename, req) => path.join(getEvidenceDir(req), filename);

const draft = body => ({
    category: label(body.category, 30), ruleId: label(body.ruleId, 100), title: label(body.title),
    period: label(body.period, 40), projectName: label(body.projectName), summary: label(body.summary, 3000),
    evidence: label(body.evidence, 2000), totalAmountMinor: body.totalAmountMinor,
    currency: body.currency === 'CNY' ? 'CNY' : 'EGP',
    attachments: Array.isArray(body.attachments) ? body.attachments.filter(u => typeof u === 'string' && u.length <= 500).slice(0, 20) : (body.attachment ? [String(body.attachment)] : []),
    teams: Array.isArray(body.teams) ? body.teams.slice(0, 200).map(item => ({ name: label(item.name), mode: item.mode, amountMinor: item.amountMinor, percentBp: item.percentBp, members: Array.isArray(item.members) ? item.members.slice(0, 200).map(member => ({ name: label(member.name), staffId: label(member.staffId, 80), mode: member.mode, amountMinor: member.amountMinor, percentBp: member.percentBp })) : [] })) : [],
    recipients: Array.isArray(body.recipients) ? body.recipients.slice(0, 200).map(item => ({ name: label(item.name), staffId: label(item.staffId, 80), team: label(item.team), mode: item.mode, amountMinor: item.amountMinor, percentBp: item.percentBp })) : []
});

router.post('/evidence', evidenceUpload.single('file'), wrap(async (req, res) => {
    if (!req.file) fail('请选择证据文件');
    const originalExt = path.extname(req.file.originalname || '').toLowerCase();
    const mimeToExt = new Map([
        ['application/pdf', '.pdf'],
        ['image/png', '.png'],
        ['image/jpeg', '.jpg'],
        ['text/plain', '.txt'],
        ['application/zip', '.zip'],
        ['application/x-zip-compressed', '.zip'],
        ['application/vnd.rar', '.rar'],
        ['application/x-rar-compressed', '.rar'],
        ['application/x-7z-compressed', '.7z'],
        ['application/x-tar', '.tar'],
        ['application/gzip', '.gz'],
        ['application/x-gzip', '.gz'],
        ['message/rfc822', '.eml'],
        ['application/vnd.ms-outlook', '.msg'],
        ['application/x-msg', '.msg']
    ]);
    let extension = mimeToExt.get(req.file.mimetype);
    if (!extension && EVIDENCE_EXTENSIONS.has(originalExt)) {
        extension = originalExt === '.jpeg' ? '.jpg' : originalExt;
    }
    if (!extension || !EVIDENCE_EXTENSIONS.has(extension)) {
        fail('仅支持 PDF、PNG、JPG、TXT、压缩包(ZIP/RAR/7Z/TAR/GZ) 及邮件(EML/MSG) 格式');
    }
    const filename = crypto.randomUUID() + extension;
    const directory = getEvidenceDir(req);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, filename), req.file.buffer, { flag: 'wx' });
    res.json({ path: '/api/reward-program/evidence/' + filename, filename: req.file.originalname, size: req.file.size });
}));

router.get('/evidence/:filename', wrap(async (req, res) => {
    const filename = req.params.filename;
    if (!EVIDENCE_FILENAME_REGEX.test(filename)) fail('文件名无效');
    const filepath = getEvidencePath(filename, req);
    if (!fs.existsSync(filepath)) fail('文件不存在', 404);
    res.setHeader('Cache-Control', 'private, no-store');
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
        '.pdf': 'application/pdf',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.txt': 'text/plain; charset=utf-8',
        '.zip': 'application/zip',
        '.rar': 'application/vnd.rar',
        '.7z': 'application/x-7z-compressed',
        '.tar': 'application/x-tar',
        '.gz': 'application/gzip',
        '.eml': 'message/rfc822',
        '.msg': 'application/vnd.ms-outlook'
    };
    if (mimeTypes[ext]) res.setHeader('Content-Type', mimeTypes[ext]);
    fs.createReadStream(filepath).pipe(res);
}));

router.get('/', wrap(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ rules: await repo.rules(), applications: await repo.listApplications(req.user.username, admin(req)), username: req.user.username, isAdmin: admin(req) });
}));
router.get('/applications/:id/events', wrap(async (req, res) => {
    const record = await repo.application(req.params.id);
    if (!record || !owner(req, record)) fail('申请不存在或无权查看', 404);
    res.json(await repo.events(record.id));
}));
router.get('/applications/:id/objections', wrap(async (req, res) => {
    const record = await repo.application(req.params.id);
    if (!record || (record.status !== 'publicity' && !owner(req, record))) fail('申请不存在或无权查看', 404);
    res.json(await repo.objections(record.id, req.user.username, admin(req)));
}));
router.post('/applications/:id/objections', wrap(async (req, res) => {
    const note = label(req.body?.note, 1000);
    if (!note) fail('请填写异议内容');
    res.status(201).json(await repo.addObjection(req.params.id, req.user.username, note));
}));
router.post('/applications/:id/objections/:objectionId/resolve', wrap(async (req, res) => {
    if (!admin(req)) fail('仅管理员可处理公示异议', 403);
    const resolution = label(req.body?.resolution, 1000);
    if (!resolution) fail('请填写处理结论');
    res.json(await repo.resolveObjection(req.params.id, req.params.objectionId, req.user.username, resolution));
}));
router.post('/applications', wrap(async (req, res) => {
    const value = draft(req.body || {});
    if (!CATEGORIES.includes(value.category) || !(await repo.rules()).some(item => item.id === value.ruleId && item.category === value.category && !item.archived)) fail('奖励规则无效');
    res.status(201).json(await repo.insert(value, req.user.username));
}));
router.post('/applications/:id/save', wrap(async (req, res) => {
    const old = await repo.application(req.params.id);
    if (!old || !owner(req, old)) fail('申请不存在或无权编辑', 404);
    if (!['draft', 'returned', 'published'].includes(old.status)) fail('当前状态不能修改', 409);
    if (old.status === 'published' && !admin(req)) fail('仅管理员可修改已发布记录', 403);
    const value = draft(req.body || {});
    if (!CATEGORIES.includes(value.category) || !(await repo.rules()).some(item => item.id === value.ruleId && item.category === value.category && !item.archived)) fail('奖励规则无效');
    const targetStatus = old.status === 'published' ? 'published' : 'draft';
    res.json(await repo.update(old.id, revision(req.body), req.user.username, { category: value.category, ruleId: value.ruleId, status: targetStatus, payload: value }, old.status === 'published' ? 'force_edit' : 'save'));
}));
router.post('/applications/:id/publish', wrap(async (req, res) => {
    const old = await repo.application(req.params.id);
    if (!old || !owner(req, old)) fail('申请不存在或无权发布', 404);
    if (old.status !== 'draft' && old.status !== 'returned') fail('只有草稿可以发布', 409);
    const value = normalizeApplication(draft(req.body?.title ? req.body : old), await repo.rules());
    res.json(await repo.update(old.id, revision(req.body?.revision ? req.body : { revision: old.revision }), req.user.username, { category: value.category, ruleId: value.ruleId, status: 'published', payload: value }, 'publish', '发布奖励记录'));
}));
router.post('/applications/:id/revoke', wrap(async (req, res) => {
    if (!admin(req)) fail('仅管理员可撤销记录', 403);
    const old = await repo.application(req.params.id);
    if (!old) fail('申请不存在', 404);
    if (!['published', 'completed', 'publicity'].includes(old.status)) fail('只有已发布的记录可以撤销', 409);
    const reason = label(req.body?.reason, 1000);
    if (!reason) fail('请填写撤销原因');
    const updatedPayload = { ...old, revokeReason: reason, revokedAt: new Date().toISOString(), revokedBy: req.user.username };
    res.json(await repo.update(old.id, revision(req.body?.revision ? req.body : { revision: old.revision }), req.user.username, { category: old.category, ruleId: old.ruleId, status: 'revoked', payload: updatedPayload }, 'revoke', reason));
}));
router.post('/applications/:id/archive', wrap(async (req, res) => {
    if (!admin(req)) fail('仅管理员可归档记录', 403);
    const old = await repo.application(req.params.id);
    if (!old) fail('申请不存在', 404);
    if (old.status === 'archived') fail('该记录已归档', 409);
    if (!['published', 'revoked', 'completed'].includes(old.status)) fail('当前状态不能归档', 409);
    const previousStatus = old.status;
    const updatedPayload = { ...old, previousStatus, archivedAt: new Date().toISOString(), archivedBy: req.user.username };
    res.json(await repo.update(old.id, revision(req.body?.revision ? req.body : { revision: old.revision }), req.user.username, { category: old.category, ruleId: old.ruleId, status: 'archived', payload: updatedPayload }, 'archive', '归档记录'));
}));
router.post('/applications/:id/unarchive', wrap(async (req, res) => {
    if (!admin(req)) fail('仅管理员可恢复归档记录', 403);
    const old = await repo.application(req.params.id);
    if (!old) fail('申请不存在', 404);
    if (!['archived', 'completed'].includes(old.status)) fail('只有已归档记录可以恢复', 409);
    const restoreStatus = old.previousStatus === 'revoked' ? 'revoked' : 'published';
    const updatedPayload = { ...old, unarchivedAt: new Date().toISOString(), unarchivedBy: req.user.username };
    res.json(await repo.update(old.id, revision(req.body?.revision ? req.body : { revision: old.revision }), req.user.username, { category: old.category, ruleId: old.ruleId, status: restoreStatus, payload: updatedPayload }, 'unarchive', `恢复为${restoreStatus === 'published' ? '已发布' : restoreStatus}`));
}));
router.delete('/applications/:id', wrap(async (req, res) => {
    const old = await repo.application(req.params.id);
    if (!old || !owner(req, old)) fail('申请不存在或无权删除', 404);
    if (old.status !== 'draft') fail('只能删除草稿', 409);
    res.json(await repo.remove(old.id, req.user.username));
}));
router.post('/applications/:id/submit', wrap(async (req, res) => {
    const old = await repo.application(req.params.id);
    if (!old || !owner(req, old)) fail('申请不存在或无权提交', 404);
    if (!['draft', 'returned'].includes(old.status)) fail('当前状态不能提交', 409);
    const value = normalizeApplication(draft(req.body || {}), await repo.rules());
    res.json(await repo.update(old.id, revision(req.body), req.user.username, { category: value.category, ruleId: value.ruleId, status: 'submitted', payload: value }, 'submit'));
}));
router.post('/applications/:id/decision', wrap(async (req, res) => {
    if (!admin(req)) fail('仅管理员可记录审批结果', 403);
    const old = await repo.application(req.params.id);
    if (!old) fail('申请不存在', 404);
    const action = label(req.body?.action, 30), note = label(req.body?.note, 1000);
    const flow = old.ruleSnapshot?.approvalFlow || ['department', 'at', 'publicity'];
    const stages = ['submitted', ...flow.map(step => step === 'publicity' ? 'publicity' : `${step}_approved`), 'completed'];
    if (action === 'return' || action === 'reject') {
        if (['draft', 'returned', 'rejected', 'completed'].includes(old.status)) fail('当前状态不能退回或驳回', 409);
        if (!note) fail('退回或驳回必须填写原因');
        return res.json(await repo.update(old.id, revision(req.body), req.user.username, { category: old.category, ruleId: old.ruleId, status: action === 'return' ? 'returned' : 'rejected', payload: old }, action, note));
    }
    if (action !== 'approve') fail('审批动作无效');
    const index = stages.indexOf(old.status);
    if (index < 0 || index >= stages.length - 1) fail('当前状态不能推进审批', 409);
    if (stages[index + 1] === 'at_approved' && !note) fail('请记录 AT 评议结论或会议依据');
    const status = stages[index + 1];
    res.json(await repo.update(old.id, revision(req.body), req.user.username, { category: old.category, ruleId: old.ruleId, status, payload: old }, 'approve', note));
}));
router.put('/rules/:id', wrap(async (req, res) => {
    if (!admin(req)) fail('仅管理员可维护奖励规则', 403);
    const previous = (await repo.rules()).find(item => item.id === req.params.id);
    const category = label(req.body?.category || previous?.category, 30);
    if (!CATEGORIES.includes(category)) fail('奖励类别无效');
    const name = label(req.body?.name);
    if (!name) fail('奖项名称不能为空');
    const referenceBudgetMinor = req.body?.referenceBudgetMinor === '' || req.body?.referenceBudgetMinor == null ? null : Number(req.body.referenceBudgetMinor);
    if (referenceBudgetMinor !== null && !money(referenceBudgetMinor)) fail('参考预算无效');
    const approvalFlow = Array.isArray(req.body?.approvalFlow) ? req.body.approvalFlow : previous?.approvalFlow || ['department', 'at', 'publicity'];
    if (!approvalFlow.length || approvalFlow[0] !== 'department' || approvalFlow.join(',') !== ['department', 'at', 'publicity'].filter(step => approvalFlow.includes(step)).join(',')) fail('审批流程无效');
    const unitAmountMinor = req.body?.unitAmountMinor === '' || req.body?.unitAmountMinor == null ? null : Number(req.body.unitAmountMinor);
    if (unitAmountMinor !== null && !money(unitAmountMinor)) fail('单人金额无效');
    const currency = req.body?.currency === 'CNY' ? 'CNY' : 'EGP';
    const rule = { id: previous?.id || req.params.id || crypto.randomUUID(), category, name, cycle: label(req.body?.cycle, 80), recipientType: req.body?.recipientType === 'team' ? 'team' : 'person', positionName: label(req.body?.positionName), criteria: label(req.body?.criteria, 1000), unitAmountMinor, referenceBudgetMinor, currency, approvalFlow, archived: Boolean(req.body?.archived) };
    if (previous && previous.id !== rule.id) fail('奖项 ID 不可修改');
    res.json(await repo.saveRule(rule));
}));
router.delete('/rules/:id', wrap(async (req, res) => {
    if (!admin(req)) fail('仅管理员可维护奖励规则', 403);
    res.json(await repo.deleteRule(req.params.id));
}));

const snapshotPublish = require('../models/snapshot-publish-service');
const { buildSnapshot } = require('../models/reward-program-snapshot');

const snapshotAdmin = req => { if (!admin(req)) fail('仅管理员可配置或发布静态页面', 403); };

router.get('/snapshot/html', wrap(async (req, res) => {
    snapshotAdmin(req);
    const toolSecurity = await snapshotPublish.getToolSettings('reward-program', true);
    const html = await buildSnapshot(req.user?.tenantId || 'default', {
        encryption: {
            enabled: Boolean(toolSecurity.encryptionEnabled && toolSecurity.passwordHash),
            passwordHash: toolSecurity.passwordHash,
            passwordSalt: toolSecurity.passwordSalt
        }
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="reward-program-readonly.html"');
    res.send(html);
}));

router.get('/snapshot/settings', wrap(async (req, res) => {
    snapshotAdmin(req);
    res.setHeader('Cache-Control', 'no-store');
    res.json(await snapshotPublish.getToolSettings('reward-program'));
}));

router.put('/snapshot/settings', wrap(async (req, res) => {
    snapshotAdmin(req);
    res.json(await snapshotPublish.saveToolSettings('reward-program', req.body || {}));
}));

router.post('/snapshot/publish', wrap(async (req, res) => {
    snapshotAdmin(req);
    res.status(202).json(await snapshotPublish.startJob(req.user?.tenantId || 'default', { toolSlug: 'reward-program' }));
}));

module.exports = router;
