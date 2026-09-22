const fs = require('fs');
const path = require('path');
const repo = require('./reward-program-repository');
const { getDataDir } = require('./tenant-context');
const tools = require('./custom-tools-repository');
const { injectGatekeeper } = require('./snapshot-gatekeeper');
const { collectMeetingData, staticRuntimeSource } = require('./static-snapshot-data');

const EVIDENCE = /^\/api\/reward-program\/evidence\/([a-f0-9-]{36}\.(?:pdf|png|jpg|jpeg|txt|zip|rar|7z|tar|gz|eml|msg))$/i;
const MIME = {
    pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    txt: 'text/plain; charset=utf-8', zip: 'application/zip', rar: 'application/vnd.rar',
    '7z': 'application/x-7z-compressed', tar: 'application/x-tar', gz: 'application/gzip',
    eml: 'message/rfc822', msg: 'application/vnd.ms-outlook'
};
const safeJson = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

async function loadSource() {
    let sourcePath = null;
    try {
        const p = await tools.getToolFilePath('reward-program');
        if (p && fs.existsSync(p)) {
            const content = fs.readFileSync(p, 'utf8');
            if (content.includes("const API = '/api/reward-program';")) {
                sourcePath = p;
            }
        }
    } catch (_) {}
    if (!sourcePath) {
        const builtinPath = path.join(__dirname, '../builtin-tools/reward-program/index.html');
        if (fs.existsSync(builtinPath)) sourcePath = builtinPath;
    }
    if (!sourcePath || !fs.existsSync(sourcePath)) throw new Error('奖励申报与评优工具尚未安装');
    const html = fs.readFileSync(sourcePath, 'utf8');
    const apiMarker = "const API = '/api/reward-program';";
    if (!html.includes(apiMarker)) throw new Error('奖励申报与评优模板缺少 API 声明，无法生成快照');
    return { html, apiMarker };
}

async function collectSnapshot(tenantId, evidenceMode) {
    const rules = await repo.rules();
    const rawApplications = await repo.listApplications('admin', true);
    // Exclude unsubmitted personal drafts; keep published, publicity, completed, archived, revoked records
    const applications = rawApplications.filter(app => app.status !== 'draft');

    const evidenceDir = path.join(getDataDir(tenantId), 'reward-program-evidence');
    let evidenceBytes = 0;
    const evidenceFiles = new Map();

    const embedEvidence = url => {
        const match = EVIDENCE.exec(url);
        if (!match) return url;
        const filename = match[1];
        let bytes = evidenceFiles.get(filename);
        if (!bytes) {
            const filePath = path.join(evidenceDir, filename);
            if (fs.existsSync(filePath)) {
                bytes = fs.readFileSync(filePath);
                evidenceFiles.set(filename, bytes);
                evidenceBytes += bytes.length;
            }
        }
        if (!bytes) return url;
        if (evidenceMode === 'inline' && evidenceBytes > 100 * 1024 * 1024) throw new Error('证据附件超过 100 MB，无法生成单文件快照');
        if (evidenceMode === 'files') return './data/evidence/' + filename;
        const ext = filename.split('.').pop().toLowerCase();
        return 'data:' + (MIME[ext] || 'application/octet-stream') + ';base64,' + bytes.toString('base64') + '#' + filename;
    };

    for (const app of applications) {
        if (Array.isArray(app.attachments)) {
            app.attachments = app.attachments.map(embedEvidence);
        }
    }

    return {
        snapshot: { rules, applications, username: '', isAdmin: false },
        evidenceFiles
    };
}

async function buildSnapshot(tenantId, options = {}) {
    let { html, apiMarker } = await loadSource();
    const { snapshot } = await collectSnapshot(tenantId, 'inline');
    const meetingData = await collectMeetingData();
    const related = { meeting: { attendance: meetingData.attendance } };
    const enc = options.encryption?.enabled && (options.encryption?.passwordHash || options.encryption?.hash) ? options.encryption : null;

    html = html.replace(apiMarker, apiMarker + '\nconst OFFLINE_SNAPSHOT = ' + safeJson(snapshot) + ';\nconst TP_RELATED_SNAPSHOT = ' + safeJson(related) + ';\n' + staticRuntimeSource('TP_RELATED_SNAPSHOT') + `\nconst originalOfflineFetch = window.fetch.bind(window); window.fetch = (url, options = {}) => { if(String(url).startsWith("data:") || String(url).startsWith("blob:")) return originalOfflineFetch(url, options); const response = tpStaticApiResponse(url, options); if(response) return Promise.resolve(response); console.warn("[只读快照] 网络请求已拦截:", url); return Promise.resolve(tpStaticReadonlyResponse()); };`);

    const offlineApiRegex = /async function api\(path,\s*method\s*=\s*'GET',\s*body\)\s*\{[\s\S]*?\n  \}/;
    const offlineApiFn = `async function api(path, method = 'GET', body) {
    if (typeof window !== 'undefined' && typeof window.tpIsUnlocked === 'function' && !window.tpIsUnlocked()) {
      throw new Error('请先输入访问密码解锁页面');
    }
    if (method && method !== 'GET') {
      if (typeof toast === 'function') toast('无权限，仅供查看。请联系管理员。');
      throw new Error('无权限，仅供查看。请联系管理员。');
    }
    if (path === '/' || path === '') return OFFLINE_SNAPSHOT;
    if (path.startsWith('/rules')) return OFFLINE_SNAPSHOT.rules || [];
    if (path.startsWith('/applications')) return OFFLINE_SNAPSHOT.applications || [];
    if (typeof toast === 'function') toast('无权限，仅供查看。请联系管理员。');
    throw new Error('无权限，仅供查看。请联系管理员。');
  }`;

    if (!offlineApiRegex.test(html)) throw new Error('奖励申报与评优模板缺少 api 函数声明，无法拦截请求');
    html = html.replace(offlineApiRegex, offlineApiFn);

    html = html.replace(/<head([^>]*)>/i, `<head$1>\n<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src data: blob:; object-src blob: data:; frame-src blob: data:; form-action 'none'; base-uri 'none'">`);

    if (enc) html = injectGatekeeper(html, enc, 'reward-program');
    return html;
}

async function buildPagesSnapshot(tenantId, options = {}) {
    let { html, apiMarker } = await loadSource();
    const { snapshot, evidenceFiles } = await collectSnapshot(tenantId, 'files');
    const meetingData = await collectMeetingData();
    const related = { meeting: { attendance: meetingData.attendance } };
    const enc = options.encryption?.enabled && (options.encryption?.passwordHash || options.encryption?.hash) ? options.encryption : null;

    html = html.replace(apiMarker, apiMarker + `
let PAGES_SNAPSHOT = null;
let TP_RELATED_SNAPSHOT = null;
${staticRuntimeSource('TP_RELATED_SNAPSHOT')}
const pagesFetch = window.fetch.bind(window);
async function loadRelatedSnapshot() {
  if (!TP_RELATED_SNAPSHOT) {
    const response = await pagesFetch('./data/related.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('关联数据读取失败');
    TP_RELATED_SNAPSHOT = await response.json();
  }
  return TP_RELATED_SNAPSHOT;
}
window.fetch = async (url, options = {}) => {
  if (String(url).startsWith('./data/') || String(url).startsWith('blob:') || String(url).startsWith('data:')) return pagesFetch(url, options);
  await loadRelatedSnapshot();
  return tpStaticApiResponse(url, options) || tpStaticReadonlyResponse();
};`);

    const pagesApiRegex = /async function api\(path,\s*method\s*=\s*'GET',\s*body\)\s*\{[\s\S]*?\n  \}/;
    const pagesApiFn = `async function api(path, method = 'GET', body) {
    if (typeof window !== 'undefined' && typeof window.tpIsUnlocked === 'function' && !window.tpIsUnlocked()) {
      throw new Error('请先输入访问密码解锁页面');
    }
    if (method && method !== 'GET') {
      if (typeof toast === 'function') toast('无权限，仅供查看。请联系管理员。');
      throw new Error('无权限，仅供查看。请联系管理员。');
    }
    if (path === '/' || path === '') {
      if (!PAGES_SNAPSHOT) {
        const [rulesRes, appsRes] = await Promise.all([
          pagesFetch('./data/rules.json', { cache: 'no-store' }),
          pagesFetch('./data/applications.json', { cache: 'no-store' })
        ]);
        if (!rulesRes.ok || !appsRes.ok) throw new Error('静态数据读取失败');
        const [rules, applications] = await Promise.all([rulesRes.json(), appsRes.json()]);
        PAGES_SNAPSHOT = { rules, applications, username: '', isAdmin: false };
      }
      return PAGES_SNAPSHOT;
    }
    if (path.startsWith('/rules')) {
      if (!PAGES_SNAPSHOT) await api('/');
      return PAGES_SNAPSHOT.rules || [];
    }
    if (path.startsWith('/applications')) {
      if (!PAGES_SNAPSHOT) await api('/');
      return PAGES_SNAPSHOT.applications || [];
    }
    if (typeof toast === 'function') toast('无权限，仅供查看。请联系管理员。');
    throw new Error('无权限，仅供查看。请联系管理员。');
  }`;

    if (!pagesApiRegex.test(html)) throw new Error('奖励申报与评优模板缺少 api 函数声明，无法拦截请求');
    html = html.replace(pagesApiRegex, pagesApiFn);

    html = html.replace(/<head([^>]*)>/i, `<head$1>\n<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; font-src data:; object-src 'self' blob: data:; frame-src 'self' blob: data:; form-action 'none'; base-uri 'none'">`);

    if (enc) html = injectGatekeeper(html, enc, 'reward-program');

    const files = new Map([
        ['data/rules.json', safeJson(snapshot.rules) + '\n'],
        ['data/applications.json', safeJson(snapshot.applications) + '\n'],
        ['data/related.json', safeJson(related) + '\n']
    ]);
    for (const [filename, bytes] of evidenceFiles) {
        files.set('data/evidence/' + filename, bytes);
    }

    return { html, files };
}

module.exports = { buildSnapshot, buildPagesSnapshot, collectSnapshot };
