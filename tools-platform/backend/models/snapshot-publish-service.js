const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { run, get, all, getDbPath } = require('./app-db');
const { getTenantId, runWithTenant } = require('./tenant-context');
const { buildSnapshot, buildPagesSnapshot } = require('./department-reward-penalty-snapshot');
const { updatePublishMenu, MENU_FILE } = require('./snapshot-publish-menu');

const execGit = promisify(execFile);
const git = (file, args, options = {}) => execGit(file, args, {
    ...options,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' }
});
const active = new Set();
const scheduleTimers = new Map();
const schemaInflight = new Map();
const TOOL_SLUG = 'department-reward-penalty';
const DEFAULT_FILE_TEMPLATE = '{toolSlug}/index.html';
const MIN_INTERVAL_MINUTES = 5;
const MAX_INTERVAL_MINUTES = 1440;
const EVIDENCE_FILE = /^[a-f0-9-]{36}\.(?:pdf|png|jpg|txt|zip|rar|7z|tar|gz|eml|msg)$/i;
const PAGES_MARKER = '{"toolId":"department-reward-penalty","format":1}\n';
const bad = (message, status = 400) => Object.assign(new Error(message), { status });

function resolvePublishPath(template, toolSlug = TOOL_SLUG) {
    if (!/^[a-z0-9][a-z0-9_-]{0,47}$/.test(toolSlug)) throw bad('工具 slug 无效');
    const file = String(template || '').trim();
    if ((file.match(/\{toolSlug\}/g) || []).length > 1) throw bad('HTML 路径只能包含一个 {toolSlug} 占位符');
    const resolved = file.replace('{toolSlug}', toolSlug);
    if (!/^[\w./-]+\.html$/.test(resolved) || resolved.startsWith('/') || resolved.split('/').some(part => !part || part === '..')) throw bad('仓库内 HTML 路径无效；仅支持 {toolSlug} 占位符');
    return resolved;
}

function rejectSymlinkParents(root, target) {
    let current = root;
    for (const part of path.relative(root, target).split(path.sep)) {
        current = path.join(current, part);
        if (fs.lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) throw bad('目标路径包含符号链接，已停止发布');
    }
}

async function ready() {
    const key = getDbPath();
    if (schemaInflight.has(key)) return schemaInflight.get(key);
    const task = (async () => {
    await run(`CREATE TABLE IF NOT EXISTS snapshot_publish_settings (
        key TEXT PRIMARY KEY, repo_dir TEXT NOT NULL, branch TEXT NOT NULL,
        remote_url TEXT NOT NULL DEFAULT '',
        publish_mode TEXT NOT NULL DEFAULT 'single',
        schedule_enabled INTEGER NOT NULL DEFAULT 0,
        interval_minutes INTEGER NOT NULL DEFAULT 60,
        schedule_anchor_at TEXT NOT NULL DEFAULT '',
        last_auto_at TEXT NOT NULL DEFAULT '',
        last_auto_error TEXT NOT NULL DEFAULT '',
        file_path TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await run(`CREATE TABLE IF NOT EXISTS snapshot_publish_jobs (
        id TEXT PRIMARY KEY, status TEXT NOT NULL, stage TEXT NOT NULL,
        trigger_type TEXT NOT NULL DEFAULT 'manual',
        progress INTEGER NOT NULL DEFAULT 0, entries_json TEXT NOT NULL DEFAULT '[]',
        commit_sha TEXT NOT NULL DEFAULT '', file_path TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`);
    const columns = await all('PRAGMA table_info(snapshot_publish_settings)');
    if (!columns.some(column => column.name === 'remote_url')) await run("ALTER TABLE snapshot_publish_settings ADD COLUMN remote_url TEXT NOT NULL DEFAULT ''");
    if (!columns.some(column => column.name === 'publish_mode')) await run("ALTER TABLE snapshot_publish_settings ADD COLUMN publish_mode TEXT NOT NULL DEFAULT 'single'");
    if (!columns.some(column => column.name === 'schedule_enabled')) await run('ALTER TABLE snapshot_publish_settings ADD COLUMN schedule_enabled INTEGER NOT NULL DEFAULT 0');
    if (!columns.some(column => column.name === 'interval_minutes')) await run('ALTER TABLE snapshot_publish_settings ADD COLUMN interval_minutes INTEGER NOT NULL DEFAULT 60');
    if (!columns.some(column => column.name === 'schedule_anchor_at')) await run("ALTER TABLE snapshot_publish_settings ADD COLUMN schedule_anchor_at TEXT NOT NULL DEFAULT ''");
    if (!columns.some(column => column.name === 'last_auto_at')) await run("ALTER TABLE snapshot_publish_settings ADD COLUMN last_auto_at TEXT NOT NULL DEFAULT ''");
    if (!columns.some(column => column.name === 'last_auto_error')) await run("ALTER TABLE snapshot_publish_settings ADD COLUMN last_auto_error TEXT NOT NULL DEFAULT ''");
    const jobColumns = await all('PRAGMA table_info(snapshot_publish_jobs)');
    if (!jobColumns.some(column => column.name === 'trigger_type')) await run("ALTER TABLE snapshot_publish_jobs ADD COLUMN trigger_type TEXT NOT NULL DEFAULT 'manual'");
    })();
    schemaInflight.set(key, task);
    try { await task; } finally { if (schemaInflight.get(key) === task) schemaInflight.delete(key); }
}

function validate(settings) {
    const repoDir = String(settings.repoDir || '').trim();
    const remoteUrl = String(settings.remoteUrl || '').trim();
    const branch = String(settings.branch || '').trim();
    const file = String(settings.file || '').trim();
    const publishMode = String(settings.publishMode || 'single');
    const intervalMinutes = Number(settings.intervalMinutes == null ? 60 : settings.intervalMinutes);
    if (!Number.isInteger(intervalMinutes) || intervalMinutes < MIN_INTERVAL_MINUTES || intervalMinutes > MAX_INTERVAL_MINUTES) throw bad('定时推送周期须为 5–1440 分钟');
    if ((!repoDir && !remoteUrl) || !branch || !file) throw bad('请填写本地 Git 仓库或远端地址，并指定分支和 HTML 路径');
    if (!['single', 'pages'].includes(publishMode)) throw bad('推送格式无效');
    if (repoDir.length > 500 || remoteUrl.length > 500 || !/^[\w./-]+$/.test(branch) || branch.startsWith('-') || branch.includes('..')) throw bad('仓库配置格式无效');
    const resolvedFile = resolvePublishPath(file);
    if (resolvedFile === 'index.html') throw bad('仓库根目录 index.html 保留为工具菜单，请使用 {toolSlug}/index.html 等子路径');
    if (remoteUrl) {
        if (/^https:\/\//i.test(remoteUrl)) {
            let url;
            try { url = new URL(remoteUrl); } catch { throw bad('远端 HTTPS 地址格式无效'); }
            if (!url.hostname || url.username || url.password || url.search || url.hash) throw bad('远端地址不得包含账号、密码、Token 或查询参数');
        } else if (!/^ssh:\/\/[\w@.-]+[:/]\S+$/.test(remoteUrl) && !/^git@[\w.-]+:[\w./-]+$/.test(remoteUrl)) throw bad('远端地址仅支持 HTTPS 或 SSH Git 仓库');
    }
    const resolved = repoDir ? path.resolve(repoDir) : '';
    if (!remoteUrl && !fs.existsSync(path.join(resolved, '.git'))) throw bad('本地仓库不存在或缺少 .git');
    return { repoDir: resolved, remoteUrl, branch, file, resolvedFile, publishMode, scheduleEnabled: settings.scheduleEnabled === true, intervalMinutes };
}

async function getSettings() {
    await ready();
    const row = await get('SELECT * FROM snapshot_publish_settings WHERE key = ?', ['department-reward-penalty']);
    return row ? { repoDir: row.repo_dir, remoteUrl: row.remote_url, branch: row.branch, file: row.file_path, resolvedFile: resolvePublishPath(row.file_path), publishMode: row.publish_mode || 'single',
        scheduleEnabled: Boolean(row.schedule_enabled), intervalMinutes: row.interval_minutes,
        lastAutoAt: row.last_auto_at || '', lastAutoError: row.last_auto_error || '',
        nextRunAt: row.schedule_enabled ? new Date((Date.parse(row.schedule_anchor_at || row.updated_at) || Date.now()) + row.interval_minutes * 60000).toISOString() : '',
        updatedAt: row.updated_at, source: 'saved' }
        : { repoDir: process.env.TOOLS_SNAPSHOT_REPO_DIR || '', remoteUrl: '', branch: process.env.TOOLS_SNAPSHOT_BRANCH || process.env.TOOLS_SNAPSHOT_GITHUB_BRANCH || 'master', file: process.env.TOOLS_SNAPSHOT_PATH || process.env.TOOLS_SNAPSHOT_GITHUB_PATH || DEFAULT_FILE_TEMPLATE, resolvedFile: resolvePublishPath(process.env.TOOLS_SNAPSHOT_PATH || process.env.TOOLS_SNAPSHOT_GITHUB_PATH || DEFAULT_FILE_TEMPLATE), publishMode: 'single', scheduleEnabled: false, intervalMinutes: 60, lastAutoAt: '', lastAutoError: '', nextRunAt: '', source: 'environment' };
}

async function saveSettings(input) {
    const value = validate(input);
    await ready();
    await run(`INSERT INTO snapshot_publish_settings (key, repo_dir, remote_url, branch, file_path, publish_mode, schedule_enabled, interval_minutes, schedule_anchor_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET repo_dir=excluded.repo_dir, remote_url=excluded.remote_url, branch=excluded.branch, file_path=excluded.file_path,
            publish_mode=excluded.publish_mode, schedule_enabled=excluded.schedule_enabled, interval_minutes=excluded.interval_minutes, schedule_anchor_at=excluded.schedule_anchor_at, updated_at=CURRENT_TIMESTAMP`,
    [TOOL_SLUG, value.repoDir, value.remoteUrl, value.branch, value.file, value.publishMode, value.scheduleEnabled ? 1 : 0, value.intervalMinutes, new Date().toISOString()]);
    await scheduleTenant(getTenantId());
    return getSettings();
}

async function getPrerequisites() {
    let version;
    try { version = (await git('git', ['--version'], { timeout: 5000 })).stdout.trim().slice(0, 80); }
    catch { return { gitFound: false, gitVersion: '', remoteConfigured: false, remoteReady: false, branchReady: false, message: '未检测到 Git。请安装 Git for Windows，并确认 git.exe 已加入 PATH。' }; }
    const settings = await getSettings();
    if (!settings.remoteUrl && !settings.repoDir) return { gitFound: true, gitVersion: version, remoteConfigured: false, remoteReady: false, branchReady: false, message: '请先配置 CodeHub 仓库的 Git 克隆地址或本地镜像目录。' };
    let remote;
    try {
        const config = validate(settings);
        remote = config.remoteUrl || (await git('git', ['-C', config.repoDir, 'remote', 'get-url', 'origin'], { timeout: 5000 })).stdout.trim();
        if (!remote) throw new Error('Missing origin');
        await git('git', ['ls-remote', '--exit-code', '--heads', remote, config.branch], { timeout: 20000 });
        return { gitFound: true, gitVersion: version, remoteConfigured: true, remoteReady: true, branchReady: true, message: 'Git 可用，可读取远端目标分支；写入权限以实际推送结果为准。' };
    } catch {
        return { gitFound: true, gitVersion: version, remoteConfigured: Boolean(remote), remoteReady: false, branchReady: false, message: '无法读取远端目标分支。请检查 Git 地址、网络、目标分支及 CodeHub 认证；可在 CodeHub 页面右上角帮助中心查看配置指引。' };
    }
}

function decode(row) {
    if (!row) return null;
    return { id: row.id, status: row.status, stage: row.stage, progress: row.progress, trigger: row.trigger_type,
        entries: JSON.parse(row.entries_json), commit: row.commit_sha, path: row.file_path,
        createdAt: row.created_at, updatedAt: row.updated_at };
}

async function getJob(id) {
    await ready();
    const row = await get('SELECT * FROM snapshot_publish_jobs WHERE id = ?', [id]);
    const job = decode(row);
    if (job?.status === 'running' && !active.has(getDbPath() + ':' + id)) {
        await updateJob(job, 'interrupted', job.stage, job.progress, '服务重启导致任务中断，请重新推送');
        return decode(await get('SELECT * FROM snapshot_publish_jobs WHERE id = ?', [id]));
    }
    return job;
}

async function listJobs() {
    await ready();
    const rows = await all('SELECT * FROM snapshot_publish_jobs ORDER BY created_at DESC LIMIT 20');
    return Promise.all(rows.map(row => getJob(row.id)));
}

async function updateJob(job, status, stage, progress, message, commit = '') {
    job.status = status; job.stage = stage; job.progress = progress;
    if (message) job.entries.push({ at: new Date().toISOString(), stage, message });
    if (commit) job.commit = commit;
    await run('UPDATE snapshot_publish_jobs SET status=?, stage=?, progress=?, entries_json=?, commit_sha=?, updated_at=? WHERE id=?',
        [status, stage, progress, JSON.stringify(job.entries), job.commit || '', new Date().toISOString(), job.id]);
}

async function publish(job, tenantId, settings) {
    const key = getDbPath() + ':' + job.id;
    active.add(key);
    let staging;
    try {
        const config = validate(settings);
        await updateJob(job, 'running', '检查仓库', 12, '已读取当前租户的推送配置，正在检查 origin 和目标分支');
        const remote = config.remoteUrl || (await git('git', ['-C', config.repoDir, 'remote', 'get-url', 'origin'], { timeout: 10000 })).stdout.trim();
        if (!remote) throw bad('本地仓库未配置 origin');
        staging = fs.mkdtempSync(path.join(os.tmpdir(), 'tools-snapshot-push-'));
        const checkout = path.join(staging, 'checkout');
        await updateJob(job, 'running', '获取分支', 26, '在隔离目录中获取远端分支，原仓库工作区不会被修改');
        await git('git', ['clone', '--single-branch', '--branch', config.branch, '--', remote, checkout], { timeout: 120000 });
        await updateJob(job, 'running', '生成快照', 48, config.publishMode === 'pages' ? '正在生成 Pages 页面、分区 JSON 和独立证据文件' : '正在读取事件、人员、审计与证据附件');
        const output = config.publishMode === 'pages' ? await buildPagesSnapshot(tenantId) : { html: await buildSnapshot(tenantId), files: new Map() };
        const destination = path.join(checkout, config.resolvedFile);
        rejectSymlinkParents(checkout, destination);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, output.html);
        const dataRelative = path.posix.join(path.posix.dirname(config.resolvedFile), 'data');
        const dataDir = path.join(path.dirname(destination), 'data');
        rejectSymlinkParents(checkout, dataDir);
        const marker = path.join(dataDir, '.tools-platform-snapshot.json');
        const managedData = fs.existsSync(marker) && fs.lstatSync(marker).isFile() && fs.readFileSync(marker, 'utf8') === PAGES_MARKER;
        if (config.publishMode === 'pages' && fs.existsSync(dataDir) && !managedData) throw bad('目标 data/ 目录已存在但不是本工具的发布目录，请选择独立的工具路径');
        if (config.publishMode === 'pages') {
            output.files.set('data/.tools-platform-snapshot.json', PAGES_MARKER);
            for (const [relative, contents] of output.files) {
                const file = path.join(path.dirname(destination), relative);
                rejectSymlinkParents(checkout, file);
                fs.mkdirSync(path.dirname(file), { recursive: true });
                fs.writeFileSync(file, contents);
            }
        }
        // Remove only files this publisher owns; deleted evidence must not remain public.
        const expectedEvidence = new Set([...output.files.keys()].filter(name => name.startsWith('data/evidence/')).map(name => path.basename(name)));
        const evidenceDir = path.join(dataDir, 'evidence');
        rejectSymlinkParents(checkout, evidenceDir);
        if (managedData && fs.existsSync(evidenceDir)) {
            for (const name of fs.readdirSync(evidenceDir)) if (EVIDENCE_FILE.test(name) && !expectedEvidence.has(name)) {
                const oldFile = path.join(evidenceDir, name);
                if (fs.lstatSync(oldFile).isFile()) fs.unlinkSync(oldFile);
            }
        }
        if (config.publishMode === 'single' && managedData) {
            for (const name of ['state.json', 'records.json', 'audit.json']) {
                const oldFile = path.join(dataDir, name);
                if (fs.existsSync(oldFile) && fs.lstatSync(oldFile).isFile()) fs.unlinkSync(oldFile);
            }
            fs.unlinkSync(marker);
        }
        await updateJob(job, 'running', '更新仓库介绍', 62, '正在同步首页菜单和仓库工具说明');
        const tool = await require('./custom-tools-repository').getTool(TOOL_SLUG);
        const { guideName } = updatePublishMenu(checkout, { slug: TOOL_SLUG, name: tool?.name || '负向事件管理', description: tool?.description || '查看负向事件、人员、规则及审计数据的只读快照。', href: './' + config.resolvedFile });
        await updateJob(job, 'running', '检查变更', 68, config.publishMode === 'pages' ? '正在逐文件比较 HTML、JSON 和证据附件' : '已生成只读单文件 HTML，正在检查目标文件变更');
        const paths = [config.resolvedFile, 'index.html', MENU_FILE, guideName];
        if (fs.existsSync(dataDir)) paths.push(dataRelative);
        await git('git', ['-C', checkout, 'add', '-A', '--', ...paths], { timeout: 30000 });
        const changed = (await git('git', ['-C', checkout, 'diff', '--cached', '--name-only', '--', ...paths])).stdout.trim().split('\n').filter(Boolean);
        const dirty = changed.length > 0;
        if (dirty) {
            await updateJob(job, 'running', '检查变更', 75, '本次变更 ' + changed.length + ' 个文件：' + changed.slice(0, 4).join('、') + (changed.length > 4 ? ' 等' : ''));
            await git('git', ['-C', checkout, '-c', 'user.name=Tools Platform', '-c', 'user.email=tools-platform@localhost', 'commit', '-m', 'Update readonly department reward penalty snapshot'], { timeout: 30000 });
            await updateJob(job, 'running', '推送远端', 86, '仅提交发生变化的发布文件；正在更新远端 ' + config.branch + ' 分支');
            await git('git', ['-C', checkout, 'push', 'origin', 'HEAD:refs/heads/' + config.branch], { timeout: 120000 });
        } else {
            await updateJob(job, 'running', '检查变更', 86, '目标文件与远端一致，无需新提交');
        }
        const commit = (await git('git', ['-C', checkout, 'rev-parse', 'HEAD'])).stdout.trim();
        await updateJob(job, 'success', '完成', 100, dirty ? '推送完成；Pages 发布可能仍需等待托管平台部署' : '远端内容已是最新', commit);
    } catch (error) {
        // Never persist raw git stderr: remote URLs and credential helpers may contain secrets.
        const message = error.status === 400 ? error.message : error.code === 'ENOENT'
            ? '未找到 Git 命令：请在运行服务或绿色版的电脑上安装 Git 并加入 PATH'
            : '推送失败：请检查仓库 origin、目标分支、Git 凭据和远端并发更新';
        await updateJob(job, 'failed', '失败', job.progress, message);
    } finally {
        if (staging) fs.rmSync(staging, { recursive: true, force: true });
        active.delete(key);
    }
}

async function startJob(tenantId, options = {}) {
    const settings = validate(await getSettings());
    const keyPrefix = getDbPath() + ':';
    if ([...active].some(key => key.startsWith(keyPrefix))) throw bad('当前租户已有推送任务正在执行', 409);
    const existing = (await listJobs()).find(item => item.status === 'running');
    if (existing) throw bad('当前租户已有推送任务正在执行', 409);
    if ([...active].some(key => key.startsWith(keyPrefix))) throw bad('当前租户已有推送任务正在执行', 409);
    const now = new Date().toISOString();
    const trigger = options.trigger === 'scheduled' ? 'scheduled' : 'manual';
    const job = { id: crypto.randomUUID(), status: 'running', stage: '排队', progress: 3, trigger, entries: [{ at: now, stage: '排队', message: trigger === 'scheduled' ? '定时任务已创建' : '已创建推送任务' }], commit: '', path: settings.resolvedFile, createdAt: now, updatedAt: now };
    active.add(keyPrefix + job.id);
    try {
        await run('INSERT INTO snapshot_publish_jobs (id,status,stage,trigger_type,progress,entries_json,commit_sha,file_path,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [job.id, job.status, job.stage, trigger, job.progress, JSON.stringify(job.entries), '', job.path, now, now]);
        setImmediate(() => { publish(job, tenantId, settings).catch(() => {}); });
        return job;
    } catch (error) { active.delete(keyPrefix + job.id); throw error; }
}

function stopTenantScheduler(tenantId) {
    const timer = scheduleTimers.get(tenantId);
    if (timer) clearTimeout(timer);
    scheduleTimers.delete(tenantId);
}

async function runScheduledTenant(tenantId) {
    return runWithTenant(tenantId, async () => {
        const now = new Date().toISOString();
        try {
            const current = await getSettings();
            if (!current.scheduleEnabled) return null;
            // Move the anchor before starting so a failed or busy push cannot spin immediately.
            await run('UPDATE snapshot_publish_settings SET schedule_anchor_at=?, last_auto_at=?, last_auto_error=? WHERE key=?',
                [now, now, '', 'department-reward-penalty']);
            return await startJob(tenantId, { trigger: 'scheduled' });
        } catch (error) {
            const message = error.status ? error.message : '定时推送启动失败，请检查仓库配置和服务日志';
            await run('UPDATE snapshot_publish_settings SET last_auto_error=? WHERE key=?', [message, 'department-reward-penalty']).catch(() => {});
            console.warn('[snapshot-publish] 定时任务启动失败：' + message);
            return null;
        } finally {
            await scheduleTenant(tenantId).catch(error => console.warn('[snapshot-publish] 重排定时任务失败：' + error.message));
        }
    });
}

async function scheduleTenant(tenantId) {
    stopTenantScheduler(tenantId);
    return runWithTenant(tenantId, async () => {
        const settings = await getSettings();
        if (!settings.scheduleEnabled || settings.source !== 'saved') return { enabled: false, nextRunAt: '' };
        const dueAt = Date.parse(settings.nextRunAt);
        const delay = Math.max(1000, Math.min(2147483647, dueAt - Date.now()));
        const timer = setTimeout(() => { runScheduledTenant(tenantId).catch(error => console.warn('[snapshot-publish] 定时任务执行失败：' + error.message)); }, delay);
        timer.unref?.();
        scheduleTimers.set(tenantId, timer);
        return { enabled: true, nextRunAt: new Date(dueAt).toISOString() };
    });
}

async function startScheduler() {
    const tenants = await require('./tenants-repository').listTenantsForUser('', 'admin');
    return Promise.all(tenants.map(tenant => scheduleTenant(tenant.id)));
}

module.exports = { getSettings, saveSettings, getPrerequisites, getJob, listJobs, startJob, scheduleTenant, startScheduler, stopTenantScheduler, runScheduledTenant, resolvePublishPath };
