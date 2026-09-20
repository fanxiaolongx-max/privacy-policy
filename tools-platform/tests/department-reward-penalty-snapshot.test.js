const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const vm = require('vm');
const { execFileSync } = require('child_process');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'readonly-snapshot-'));
process.env.TOOLS_DATA_DIR = temp;
const db = require('../backend/models/app-db');
const tools = require('../backend/models/custom-tools-repository');
const repo = require('../backend/models/department-reward-penalty-repository');
const { buildSnapshot, buildPagesSnapshot } = require('../backend/models/department-reward-penalty-snapshot');
const express = require('express');
const request = require('supertest');
const router = require('../backend/routes/department-reward-penalty');
const { runWithTenant } = require('../backend/models/tenant-context');
const originalPath = tools.getToolFilePath;
test.after(async () => { tools.getToolFilePath = originalPath; await db.closeDatabase(); fs.rmSync(temp, { recursive: true, force: true }); });

test('single HTML embeds tenant data safely and blocks network/write requests', async () => {
    tools.getToolFilePath = async () => path.join(__dirname, '../backend/builtin-tools/department-reward-penalty/index.html');
    await repo.put('personnel', 'snapshot-person', { id: 'snapshot-person', name: '</script><script>alert(1)</script>', role: 'MTD' }, 'tester');
    const filename = '12345678-1234-1234-1234-123456789abc.txt';
    const evidenceDir = path.join(temp, 'department-reward-penalty-evidence');
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.writeFileSync(path.join(evidenceDir, filename), 'offline evidence');
    await repo.put('records', 'snapshot-record', { id: 'snapshot-record', attachments: ['/api/department-reward-penalty/evidence/' + filename], revokeAttachment: '/api/department-reward-penalty/evidence/' + filename }, 'tester');
    const html = await buildSnapshot('default');
    assert.match(html, /OFFLINE_SNAPSHOT/);
    assert.match(html, /snapshot-person/);
    assert.match(html, /data:text\/plain;base64,b2ZmbGluZSBldmlkZW5jZQ==#12345678/);
    assert.doesNotMatch(html, /<\/script><script>alert\(1\)<\/script>/);
    assert.match(html, /connect-src data:/);
    assert.match(html, /无权限，仅供查看。请联系管理员。/);
    assert.match(html, /const OFFLINE_SNAPSHOT = .*"canEdit":true/);
    assert.match(html, /originalOfflineFetch/);
    assert.equal(await buildSnapshot('default'), html, 'unchanged data must produce stable HTML for scheduled runs');
    for (const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(script[1]);
});

test('Pages snapshot keeps HTML stable and stores data and evidence separately', async () => {
    const output = await buildPagesSnapshot('default');
    assert.doesNotMatch(output.html, /OFFLINE_SNAPSHOT/);
    assert.match(output.html, /\['state','records','audit'\]/);
    assert.match(output.html, /connect-src 'self'/);
    const state = JSON.parse(output.files.get('data/state.json'));
    const records = JSON.parse(output.files.get('data/records.json'));
    const audit = JSON.parse(output.files.get('data/audit.json'));
    assert.equal(state.canEdit, true);
    assert.equal(records.find(row => row.id === 'snapshot-record').attachments[0], './data/evidence/12345678-1234-1234-1234-123456789abc.txt');
    assert.ok(audit.length);
    assert.equal(output.files.get('data/evidence/12345678-1234-1234-1234-123456789abc.txt').toString(), 'offline evidence');
    for (const script of output.html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(script[1]);
    const requestStart = output.html.indexOf('async function request(path,options){');
    const requestEnd = output.html.indexOf('async function refresh(){', requestStart);
    const requests = [];
    let prompts = 0;
    const staticRequest = vm.runInNewContext('let PAGES_SNAPSHOT=null;\n' + output.html.slice(requestStart, requestEnd) + '\nrequest', {
        pagesFetch: async (url, options) => { requests.push([url, options.cache]); return { ok: true, json: async () => JSON.parse(output.files.get(url.slice(2))) }; },
        uiAlert: async () => { prompts++; }, URLSearchParams
    });
    assert.equal((await staticRequest('/')).records.length, 1);
    assert.deepEqual(requests.map(([url]) => url), ['./data/state.json', './data/records.json', './data/audit.json']);
    assert.ok(requests.every(([, cache]) => cache === 'no-store'));
    assert.equal((await staticRequest('/audit?page=1&pageSize=1')).rows.length, 1);
    await assert.rejects(staticRequest('/records/x', { method: 'POST' }), /无权限/);
    assert.equal(prompts, 1);
});

test('snapshot export and publication require admin; unconfigured publish cannot mutate a remote', async () => {
    tools.getToolFilePath = async () => path.join(__dirname, '../backend/builtin-tools/department-reward-penalty/index.html');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = { role: req.headers['x-role'] || 'user', tenantId: 'default', username: 'tester' }; next(); });
    app.use('/api/department-reward-penalty', router);
    await request(app).get('/api/department-reward-penalty/snapshot/html').expect(403);
    await request(app).post('/api/department-reward-penalty/snapshot/publish').expect(403);
    await request(app).get('/api/department-reward-penalty/snapshot/settings').expect(403);
    await request(app).get('/api/department-reward-penalty/snapshot/prerequisites').expect(403);
    await request(app).put('/api/department-reward-penalty/snapshot/settings').send({}).expect(403);
    await request(app).get('/api/department-reward-penalty/snapshot/jobs').expect(403);
    await request(app).put('/api/department-reward-penalty/snapshot/settings').set('x-role', 'admin').send({ remoteUrl: 'https://user:secret@example.com/repo.git', branch: 'github-import', file: 'index.html' }).expect(400);
    const exported = await request(app).get('/api/department-reward-penalty/snapshot/html').set('x-role', 'admin').expect(200);
    assert.match(exported.text, /OFFLINE_SNAPSHOT/);
    await request(app).post('/api/department-reward-penalty/snapshot/publish').set('x-role', 'admin').expect(400);
});

test('push updates only the configured HTML on an isolated git branch', async () => {
    tools.getToolFilePath = async () => path.join(__dirname, '../backend/builtin-tools/department-reward-penalty/index.html');
    const bare = path.join(temp, 'remote.git');
    const mirror = path.join(temp, 'mirror');
    execFileSync('git', ['init', '--bare', bare]);
    execFileSync('git', ['clone', bare, mirror]);
    execFileSync('git', ['-C', mirror, 'checkout', '-b', 'github-import']);
    fs.writeFileSync(path.join(mirror, 'keep.txt'), 'unchanged');
    execFileSync('git', ['-C', mirror, 'add', 'keep.txt']);
    execFileSync('git', ['-C', mirror, '-c', 'user.name=Test', '-c', 'user.email=test@localhost', 'commit', '-m', 'Initial']);
    execFileSync('git', ['-C', mirror, 'push', '-u', 'origin', 'github-import']);
    const before = execFileSync('git', ['-C', mirror, 'status', '--porcelain']).toString();
    const saved = ['TOOLS_SNAPSHOT_REPO_DIR', 'TOOLS_SNAPSHOT_BRANCH', 'TOOLS_SNAPSHOT_PATH'].map(key => [key, process.env[key]]);
    process.env.TOOLS_SNAPSHOT_REPO_DIR = mirror;
    process.env.TOOLS_SNAPSHOT_BRANCH = 'github-import';
    process.env.TOOLS_SNAPSHOT_PATH = 'pages/reward-penalty.html';
    try {
    const app = express();
    app.use(express.json());
        app.use((req, _res, next) => { req.user = { role: 'admin', tenantId: 'default', username: 'tester' }; next(); });
        app.use('/api/department-reward-penalty', router);
        await request(app).put('/api/department-reward-penalty/snapshot/settings').send({ repoDir: mirror, branch: 'github-import', file: 'pages/reward-penalty.html' }).expect(200);
        const preflight = await request(app).get('/api/department-reward-penalty/snapshot/prerequisites').expect(200);
        assert.equal(preflight.body.gitFound, true);
        assert.equal(preflight.body.branchReady, true);
        const started = await request(app).post('/api/department-reward-penalty/snapshot/publish').expect(202);
        let job;
        for (let attempt = 0; attempt < 100; attempt++) {
            job = (await request(app).get('/api/department-reward-penalty/snapshot/jobs/' + started.body.id).expect(200)).body;
            if (job.status !== 'running') break;
            await new Promise(resolve => setTimeout(resolve, 30));
        }
        assert.equal(job.status, 'success', JSON.stringify(job.entries));
        assert.equal(job.progress, 100);
        assert.ok(job.entries.some(entry => entry.stage === '推送远端'));
        const history = await request(app).get('/api/department-reward-penalty/snapshot/jobs').expect(200);
        assert.equal(history.body[0].id, started.body.id);
        const published = execFileSync('git', ['--git-dir', bare, 'show', 'github-import:pages/reward-penalty.html']).toString();
        assert.match(published, /OFFLINE_SNAPSHOT/);
        assert.equal(execFileSync('git', ['--git-dir', bare, 'show', 'github-import:keep.txt']).toString(), 'unchanged');
        assert.equal(execFileSync('git', ['-C', mirror, 'status', '--porcelain']).toString(), before);
        const service = require('../backend/models/snapshot-publish-service');
        const scheduled = await service.saveSettings({ repoDir: mirror, branch: 'github-import', file: 'pages/reward-penalty.html', scheduleEnabled: true, intervalMinutes: 5 });
        assert.equal(scheduled.scheduleEnabled, true);
        assert.ok(Date.parse(scheduled.nextRunAt) > Date.now());
        service.stopTenantScheduler('default');
        const resumed = await service.scheduleTenant('default');
        assert.equal(resumed.enabled, true, 'saved schedule should resume after scheduler startup');
        const automatic = await service.runScheduledTenant('default');
        assert.equal(automatic.trigger, 'scheduled');
        let autoJob;
        for (let attempt = 0; attempt < 100; attempt++) {
            autoJob = await service.getJob(automatic.id);
            if (autoJob.status !== 'running') break;
            await new Promise(resolve => setTimeout(resolve, 30));
        }
        assert.equal(autoJob.status, 'success', JSON.stringify(autoJob.entries));
        assert.equal(autoJob.commit, job.commit, 'unchanged snapshot must not add a commit');
        assert.ok((await service.getSettings()).lastAutoAt);
        const pagesSettings = await service.saveSettings({ repoDir: mirror, branch: 'github-import', file: 'pages/reward-penalty.html', publishMode: 'pages' });
        assert.equal(pagesSettings.publishMode, 'pages');
        const pagesJob = await service.startJob('default');
        let pagesResult;
        for (let attempt = 0; attempt < 100; attempt++) {
            pagesResult = await service.getJob(pagesJob.id);
            if (pagesResult.status !== 'running') break;
            await new Promise(resolve => setTimeout(resolve, 30));
        }
        assert.equal(pagesResult.status, 'success', JSON.stringify(pagesResult.entries));
        const pagesHtml = execFileSync('git', ['--git-dir', bare, 'show', 'github-import:pages/reward-penalty.html']).toString();
        assert.match(pagesHtml, /\['state','records','audit'\]/);
        assert.doesNotMatch(pagesHtml, /OFFLINE_SNAPSHOT/);
        const initialRecordJson = execFileSync('git', ['--git-dir', bare, 'show', 'github-import:pages/data/records.json']).toString();
        assert.ok(JSON.parse(initialRecordJson).some(row => row.id === 'snapshot-record'));
        assert.equal(execFileSync('git', ['--git-dir', bare, 'show', 'github-import:pages/data/evidence/12345678-1234-1234-1234-123456789abc.txt']).toString(), 'offline evidence');
        await repo.put('records', 'snapshot-record', { id: 'snapshot-record', remark: 'new remark', attachments: ['/api/department-reward-penalty/evidence/12345678-1234-1234-1234-123456789abc.txt'] }, 'tester');
        const changedJob = await service.startJob('default');
        let changedResult;
        for (let attempt = 0; attempt < 100; attempt++) {
            changedResult = await service.getJob(changedJob.id);
            if (changedResult.status !== 'running') break;
            await new Promise(resolve => setTimeout(resolve, 30));
        }
        assert.equal(changedResult.status, 'success', JSON.stringify(changedResult.entries));
        const changedFiles = execFileSync('git', ['--git-dir', bare, 'diff-tree', '--no-commit-id', '--name-only', '-r', 'github-import']).toString().trim().split('\n').sort();
        assert.deepEqual(changedFiles, ['pages/data/audit.json', 'pages/data/records.json']);
        await repo.put('records', 'snapshot-record', { id: 'snapshot-record', remark: 'evidence removed', attachments: [] }, 'tester');
        const removedJob = await service.startJob('default');
        let removedResult;
        for (let attempt = 0; attempt < 100; attempt++) {
            removedResult = await service.getJob(removedJob.id);
            if (removedResult.status !== 'running') break;
            await new Promise(resolve => setTimeout(resolve, 30));
        }
        assert.equal(removedResult.status, 'success', JSON.stringify(removedResult.entries));
        const deletedFiles = execFileSync('git', ['--git-dir', bare, 'diff-tree', '--no-commit-id', '--name-status', '-r', 'github-import']).toString();
        assert.match(deletedFiles, /D\tpages\/data\/evidence\/12345678-1234-1234-1234-123456789abc\.txt/);
        await service.saveSettings({ repoDir: mirror, branch: 'github-import', file: 'pages/reward-penalty.html', publishMode: 'single' });
        const singleAgain = await service.startJob('default');
        let singleResult;
        for (let attempt = 0; attempt < 100; attempt++) {
            singleResult = await service.getJob(singleAgain.id);
            if (singleResult.status !== 'running') break;
            await new Promise(resolve => setTimeout(resolve, 30));
        }
        assert.equal(singleResult.status, 'success', JSON.stringify(singleResult.entries));
        const singleFiles = execFileSync('git', ['--git-dir', bare, 'ls-tree', '-r', '--name-only', 'github-import', 'pages']).toString();
        assert.match(singleFiles, /pages\/reward-penalty\.html/);
        assert.doesNotMatch(singleFiles, /pages\/data\//);
        const templated = await service.saveSettings({ repoDir: mirror, branch: 'github-import', file: '{toolSlug}/index.html', publishMode: 'pages' });
        assert.equal(templated.file, '{toolSlug}/index.html');
        assert.equal(templated.resolvedFile, 'department-reward-penalty/index.html');
        const templatedJob = await service.startJob('default');
        assert.equal(templatedJob.path, 'department-reward-penalty/index.html');
        let templatedResult;
        for (let attempt = 0; attempt < 100; attempt++) {
            templatedResult = await service.getJob(templatedJob.id);
            if (templatedResult.status !== 'running') break;
            await new Promise(resolve => setTimeout(resolve, 30));
        }
        assert.equal(templatedResult.status, 'success', JSON.stringify(templatedResult.entries));
        assert.ok(JSON.parse(execFileSync('git', ['--git-dir', bare, 'show', 'github-import:department-reward-penalty/data/records.json']).toString()).length);
        service.stopTenantScheduler('default');
    } finally {
        for (const [key, value] of saved) if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
});

test('publishing settings and history remain tenant isolated', async () => {
    const local = await require('../backend/models/snapshot-publish-service').getSettings();
    assert.equal(local.branch, 'github-import');
    await runWithTenant('another-snapshot-tenant', async () => {
        const isolated = await require('../backend/models/snapshot-publish-service').getSettings();
        assert.equal(isolated.source, 'environment');
        assert.equal(isolated.file, '{toolSlug}/index.html');
        assert.equal(isolated.resolvedFile, 'department-reward-penalty/index.html');
        assert.equal(isolated.branch, process.env.TOOLS_SNAPSHOT_BRANCH || process.env.TOOLS_SNAPSHOT_GITHUB_BRANCH || 'master');
        assert.equal(isolated.scheduleEnabled, false);
        assert.deepEqual(await require('../backend/models/snapshot-publish-service').listJobs(), []);
    });
});

test('remote HTTPS destination can be saved without embedding credentials', async () => {
    await runWithTenant('remote-snapshot-tenant', async () => {
        const service = require('../backend/models/snapshot-publish-service');
        const settings = await service.saveSettings({ remoteUrl: 'https://codehub.example.com/team/project.git', branch: 'github-import', file: 'published/events.html' });
        assert.equal(settings.remoteUrl, 'https://codehub.example.com/team/project.git');
        assert.equal(settings.repoDir, '');
        await assert.rejects(service.saveSettings({ remoteUrl: 'https://user:token@codehub.example.com/project.git', branch: 'github-import', file: 'index.html' }), /Token/);
        await assert.rejects(service.saveSettings({ remoteUrl: 'https://codehub.example.com/project.git', branch: 'master', file: 'index.html', scheduleEnabled: true, intervalMinutes: 1 }), /5–1440/);
    });
});

test('publish path template accepts one stable slug placeholder only', () => {
    const { resolvePublishPath } = require('../backend/models/snapshot-publish-service');
    assert.equal(resolvePublishPath('{toolSlug}/index.html'), 'department-reward-penalty/index.html');
    assert.equal(resolvePublishPath('pages/{toolSlug}/index.html', 'other-tool'), 'pages/other-tool/index.html');
    assert.throws(() => resolvePublishPath('{toolSlug}/{toolSlug}/index.html'), /只能包含一个/);
    assert.throws(() => resolvePublishPath('{toolName}/index.html'), /仅支持/);
    assert.throws(() => resolvePublishPath('{toolSlug}/../index.html'), /路径无效/);
    assert.throws(() => resolvePublishPath('{toolSlug}/index.html', '../bad'), /slug 无效/);
});

test('existing publishing settings schema gains remote URL without losing rows', async () => {
    await runWithTenant('legacy-snapshot-tenant', async () => {
        await db.run('CREATE TABLE snapshot_publish_settings (key TEXT PRIMARY KEY, repo_dir TEXT NOT NULL, branch TEXT NOT NULL, file_path TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
        await db.run('INSERT INTO snapshot_publish_settings (key, repo_dir, branch, file_path) VALUES (?, ?, ?, ?)', ['department-reward-penalty', '/old/mirror', 'github-import', 'old.html']);
        const settings = await require('../backend/models/snapshot-publish-service').getSettings();
        assert.equal(settings.repoDir, '/old/mirror');
        assert.equal(settings.remoteUrl, '');
        assert.equal(settings.scheduleEnabled, false);
        assert.equal(settings.intervalMinutes, 60);
        assert.equal(settings.publishMode, 'single');
    });
});
