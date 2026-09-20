const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const vm = require('vm');
const express = require('express');
const request = require('supertest');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'reward-program-snapshot-'));
process.env.TOOLS_DATA_DIR = temp;
const db = require('../backend/models/app-db');
const tools = require('../backend/models/custom-tools-repository');
const repo = require('../backend/models/reward-program-repository');
const service = require('../backend/models/snapshot-publish-service');
const { buildSnapshot, buildPagesSnapshot } = require('../backend/models/reward-program-snapshot');
const router = require('../backend/routes/reward-program');
const { runWithTenant } = require('../backend/models/tenant-context');

const originalPath = tools.getToolFilePath;
test.after(async () => {
    tools.getToolFilePath = originalPath;
    await db.closeDatabase();
    fs.rmSync(temp, { recursive: true, force: true });
});

test('single HTML embeds reward-program rules and applications with evidence and blocks writes', async () => {
    tools.getToolFilePath = async () => path.join(__dirname, '../backend/builtin-tools/reward-program/index.html');

    const rule = {
        id: 'rule-test-1',
        category: 'bounty',
        name: '特别技术攻坚奖',
        cycle: '2026Q3',
        recipientType: 'person',
        positionName: '开发工程师',
        criteria: '重大技术难题攻关',
        unitAmountMinor: 50000,
        referenceBudgetMinor: 200000,
        currency: 'CNY',
        approvalFlow: ['department', 'at', 'publicity']
    };
    await repo.saveRule(rule);

    const filename = '11112222-3333-4444-5555-666677778888.txt';
    const evidenceDir = path.join(temp, 'reward-program-evidence');
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.writeFileSync(path.join(evidenceDir, filename), 'bounty evidence text');

    const app = await repo.insert({
        category: 'bounty',
        ruleId: 'rule-test-1',
        title: '</script><script>alert("xss")</script>攻坚成果申报',
        period: '2026-09',
        projectName: '安全沙箱',
        summary: '完成了快照沙箱隔离',
        evidence: '见附件说明',
        totalAmountMinor: 50000,
        currency: 'CNY',
        attachments: ['/api/reward-program/evidence/' + filename],
        teams: [],
        recipients: [{ name: '张三', staffId: '001', team: '工具组', mode: 'amount', amountMinor: 50000 }]
    }, 'applicant1');

    // Publish application so it appears in snapshot
    await repo.update(app.id, 1, 'admin', { category: app.category, ruleId: app.ruleId, status: 'published', payload: app }, 'publish');

    const html = await buildSnapshot('default');
    assert.match(html, /OFFLINE_SNAPSHOT/);
    assert.match(html, /rule-test-1/);
    assert.match(html, /特别技术攻坚奖/);
    assert.match(html, /data:text\/plain; charset=utf-8;base64,Ym91bnR5IGV2aWRlbmNlIHRleHQ=#11112222/);
    assert.doesNotMatch(html, /<\/script><script>alert\("xss"\)<\/script>/);
    assert.match(html, /connect-src data: blob:/);
    assert.match(html, /无权限，仅供查看。请联系管理员。/);

    for (const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
        new vm.Script(script[1]);
    }
});

test('Pages snapshot stores reward-program data and evidence files separately', async () => {
    const output = await buildPagesSnapshot('default');
    assert.doesNotMatch(output.html, /OFFLINE_SNAPSHOT/);
    assert.match(output.html, /connect-src 'self'/);

    assert.ok(output.files.has('data/rules.json'));
    assert.ok(output.files.has('data/applications.json'));
    assert.ok(output.files.has('data/evidence/11112222-3333-4444-5555-666677778888.txt'));

    const rules = JSON.parse(output.files.get('data/rules.json'));
    const applications = JSON.parse(output.files.get('data/applications.json'));

    assert.ok(rules.some(r => r.id === 'rule-test-1'));
    assert.equal(applications[0].attachments[0], './data/evidence/11112222-3333-4444-5555-666677778888.txt');

    for (const script of output.html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
        new vm.Script(script[1]);
    }
});

test('reward-program can independently configure encryption and password', async () => {
    await runWithTenant('reward-encryption-tenant', async () => {
        const rpSettingsBefore = await service.getToolSettings('reward-program');
        assert.equal(rpSettingsBefore.encryptionEnabled, false);
        assert.equal(rpSettingsBefore.hasPassword, false);

        await assert.rejects(service.saveToolSettings('reward-program', {
            encryptionEnabled: true,
            password: '123'
        }), /至少需 4 位字符/);

        const rpSaved = await service.saveToolSettings('reward-program', {
            encryptionEnabled: true,
            password: 'RewardProgramSecretPassword!'
        });
        assert.equal(rpSaved.encryptionEnabled, true);
        assert.equal(rpSaved.hasPassword, true);

        // department-reward-penalty remains unchanged
        const drpSettings = await service.getToolSettings('department-reward-penalty');
        assert.equal(drpSettings.encryptionEnabled, false);

        const fullSettings = await service.getSettings();
        const rpFromFull = fullSettings.tools.find(t => t.toolSlug === 'reward-program');
        assert.equal(rpFromFull.encryptionEnabled, true);
        assert.equal(rpFromFull.hasPassword, true);

        const rpSecrets = await service.getToolSettings('reward-program', true);
        assert.ok(rpSecrets.passwordHash);
        assert.ok(rpSecrets.passwordSalt);
        assert.equal(rpSecrets.passwordHash, service.hashPassword('RewardProgramSecretPassword!', rpSecrets.passwordSalt));

        const encOptions = {
            encryption: {
                enabled: true,
                hash: rpSecrets.passwordHash,
                salt: rpSecrets.passwordSalt
            }
        };
        const encHtml = await buildSnapshot('default', encOptions);
        assert.match(encHtml, /id="tpGatekeeperModal"/);
        assert.match(encHtml, /tp-gatekeeper-dialog/);
        assert.match(encHtml, /tpIsUnlocked/);
        assert.match(encHtml, /reward-program/);

        for (const script of encHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
            new vm.Script(script[1]);
        }
    });
});

test('reward-program snapshot API endpoints require admin', async () => {
    tools.getToolFilePath = async () => path.join(__dirname, '../backend/builtin-tools/reward-program/index.html');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user = { role: req.headers['x-role'] || 'user', tenantId: 'default', username: 'tester' };
        next();
    });
    app.use('/api/reward-program', router);

    await request(app).get('/api/reward-program/snapshot/html').expect(403);
    await request(app).get('/api/reward-program/snapshot/settings').expect(403);
    await request(app).put('/api/reward-program/snapshot/settings').send({}).expect(403);
    await request(app).post('/api/reward-program/snapshot/publish').expect(403);

    const htmlRes = await request(app).get('/api/reward-program/snapshot/html').set('x-role', 'admin').expect(200);
    assert.match(htmlRes.text, /OFFLINE_SNAPSHOT/);

    const settingsRes = await request(app).get('/api/reward-program/snapshot/settings').set('x-role', 'admin').expect(200);
    assert.equal(settingsRes.body.toolSlug, 'reward-program');
});
