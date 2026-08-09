const dns = require('dns').promises;
const net = require('net');
const repo = require('./friend-links-repository');

const REQUEST_TIMEOUT_MS = 8000;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_REDIRECTS = 4;
const PROBE_CONCURRENCY = 2;

const WARNING_PATTERNS = [
    /you are about to visit/i,
    /only visit this website if you trust/i,
    /cloudflare (?:tunnel|access)/i,
    /attention required[^<]{0,80}cloudflare/i,
    /security (?:warning|risk|checkpoint)/i,
    /安全(?:警告|风险|提示|检查)/i,
    /代理.{0,20}(?:警告|风险|提示)/i,
    /deceptive site|reported as unsafe|suspected phishing/i,
    /certificate (?:warning|error)|privacy error/i
];

let schedulerTimer = null;
let schedulerStarted = false;
let currentProbe = null;
let nextProbeAt = null;

function isPrivateIp(address) {
    const value = String(address || '').toLowerCase().split('%')[0];
    if (!value) return true;
    if (value.startsWith('::ffff:')) return isPrivateIp(value.slice(7));
    if (net.isIPv4(value)) {
        const parts = value.split('.').map(Number);
        const [a, b] = parts;
        return a === 0 || a === 10 || a === 127 || a >= 224
            || (a === 100 && b >= 64 && b <= 127)
            || (a === 169 && b === 254)
            || (a === 172 && b >= 16 && b <= 31)
            || (a === 192 && b === 168)
            || (a === 198 && (b === 18 || b === 19));
    }
    if (net.isIPv6(value)) {
        return value === '::' || value === '::1' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe8') || value.startsWith('fe9') || value.startsWith('fea') || value.startsWith('feb');
    }
    return true;
}

async function assertPublicTarget(urlValue) {
    const parsed = new URL(repo.normalizeUrl(urlValue));
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
        throw new Error('不允许探测本地地址');
    }
    if (net.isIP(hostname)) {
        if (isPrivateIp(hostname)) throw new Error('不允许探测内网地址');
        return parsed;
    }
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    if (!records.length || records.some(item => isPrivateIp(item.address))) {
        throw new Error('域名未解析到可探测的公网地址');
    }
    return parsed;
}

async function readLimitedText(response) {
    if (!response.body || typeof response.body.getReader !== 'function') return '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: false });
    let total = 0;
    let text = '';
    try {
        while (total < MAX_BODY_BYTES) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = value.subarray(0, Math.min(value.length, MAX_BODY_BYTES - total));
            total += chunk.length;
            text += decoder.decode(chunk, { stream: true });
            if (total >= MAX_BODY_BYTES) break;
        }
        text += decoder.decode();
    } finally {
        if (total >= MAX_BODY_BYTES) await reader.cancel().catch(() => {});
    }
    return text;
}

function detectWarningContent(text) {
    const compact = String(text || '').replace(/\s+/g, ' ').slice(0, MAX_BODY_BYTES);
    return WARNING_PATTERNS.find(pattern => pattern.test(compact)) || null;
}

async function fetchWithSafeRedirects(urlValue, signal) {
    let current = await assertPublicTarget(urlValue);
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
        const response = await fetch(current, {
            method: 'GET',
            redirect: 'manual',
            signal,
            headers: {
                'User-Agent': 'Tools-Platform-Link-Monitor/1.0',
                Accept: 'text/html,application/xhtml+xml,application/json;q=0.8,*/*;q=0.5',
                Range: `bytes=0-${MAX_BODY_BYTES - 1}`
            }
        });
        if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
            if (redirectCount >= MAX_REDIRECTS) throw new Error('重定向次数过多');
            current = await assertPublicTarget(new URL(response.headers.get('location'), current).toString());
            continue;
        }
        return { response, finalUrl: current.toString() };
    }
    throw new Error('重定向次数过多');
}

async function probeLink(link) {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    if (typeof timeout.unref === 'function') timeout.unref();
    try {
        const { response, finalUrl } = await fetchWithSafeRedirects(link.url, controller.signal);
        const text = await readLimitedText(response);
        const warningPattern = detectWarningContent(text);
        const latencyMs = Date.now() - startedAt;
        if (warningPattern) {
            return { status: 'warning', httpStatus: response.status, latencyMs, checkedAt: new Date().toISOString(), finalUrl, message: '返回了代理或安全警告页面' };
        }
        if (response.status >= 200 && response.status < 400) {
            return { status: 'online', httpStatus: response.status, latencyMs, checkedAt: new Date().toISOString(), finalUrl, message: '可正常访问' };
        }
        return { status: 'offline', httpStatus: response.status, latencyMs, checkedAt: new Date().toISOString(), finalUrl, message: `HTTP ${response.status}` };
    } catch (error) {
        const timedOut = error && error.name === 'AbortError';
        return {
            status: 'offline',
            httpStatus: null,
            latencyMs: Date.now() - startedAt,
            checkedAt: new Date().toISOString(),
            finalUrl: link.url,
            message: timedOut ? '连接超时' : String(error && error.message || '无法访问').slice(0, 160)
        };
    } finally {
        clearTimeout(timeout);
    }
}

async function runWithConcurrency(items, worker, limit = PROBE_CONCURRENCY) {
    const results = new Array(items.length);
    let cursor = 0;
    async function runWorker() {
        while (cursor < items.length) {
            const index = cursor;
            cursor += 1;
            results[index] = await worker(items[index]);
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, runWorker));
    return results;
}

async function buildSnapshot() {
    const [config, stored] = await Promise.all([repo.getConfig(), repo.getStatuses()]);
    const liveIds = new Set(config.links.map(link => link.id));
    const statuses = Object.fromEntries(Object.entries(stored.byId).filter(([id]) => liveIds.has(id)));
    return {
        ...config,
        statuses,
        lastProbeAt: stored.lastProbeAt,
        nextProbeAt,
        isProbing: Boolean(currentProbe),
        desktopAutoInstallAvailable: process.env.TOOLS_DESKTOP_RUNTIME === '1'
    };
}

async function scheduleNext(delayMs) {
    if (!schedulerStarted) return;
    if (schedulerTimer) clearTimeout(schedulerTimer);
    const config = await repo.getConfig();
    const delay = Number.isFinite(delayMs) ? delayMs : config.probeIntervalMinutes * 60 * 1000;
    nextProbeAt = new Date(Date.now() + Math.max(1000, delay)).toISOString();
    schedulerTimer = setTimeout(() => {
        probeAll().catch(error => console.warn(`[friend-links] 自动探测失败：${error.message}`));
    }, Math.max(1000, delay));
    if (typeof schedulerTimer.unref === 'function') schedulerTimer.unref();
}

async function probeAll() {
    if (currentProbe) {
        await currentProbe;
        return buildSnapshot();
    }
    currentProbe = (async () => {
        const [config, stored] = await Promise.all([repo.getConfig(), repo.getStatuses()]);
        const results = await runWithConcurrency(config.links, probeLink);
        const byId = { ...stored.byId };
        config.links.forEach((link, index) => { byId[link.id] = results[index]; });
        const lastProbeAt = new Date().toISOString();
        await repo.saveStatuses({ byId, lastProbeAt });
    })();
    try {
        await currentProbe;
    } finally {
        currentProbe = null;
        await scheduleNext();
    }
    return buildSnapshot();
}

async function probeOne(linkId) {
    if (currentProbe) {
        await currentProbe;
        const [activeConfig, activeStored] = await Promise.all([repo.getConfig(), repo.getStatuses()]);
        const activeLink = activeConfig.links.find(item => item.id === String(linkId || ''));
        if (!activeLink) throw new Error('友情链接不存在');
        return { link: activeLink, result: activeStored.byId[activeLink.id] || null };
    }
    const [config, stored] = await Promise.all([repo.getConfig(), repo.getStatuses()]);
    const link = config.links.find(item => item.id === String(linkId || ''));
    if (!link) throw new Error('友情链接不存在');
    const result = await probeLink(link);
    await repo.saveStatuses({ byId: { ...stored.byId, [link.id]: result }, lastProbeAt: stored.lastProbeAt });
    return { link, result };
}

async function refreshSchedule() {
    await scheduleNext();
    return buildSnapshot();
}

async function start() {
    if (schedulerStarted) return;
    schedulerStarted = true;
    const [config, stored] = await Promise.all([repo.getConfig(), repo.getStatuses()]);
    const lastTime = stored.lastProbeAt ? new Date(stored.lastProbeAt).getTime() : 0;
    const intervalMs = config.probeIntervalMinutes * 60 * 1000;
    const remaining = lastTime ? Math.max(12000, intervalMs - (Date.now() - lastTime)) : 12000;
    await scheduleNext(remaining);
}

module.exports = {
    REQUEST_TIMEOUT_MS,
    MAX_BODY_BYTES,
    WARNING_PATTERNS,
    isPrivateIp,
    detectWarningContent,
    assertPublicTarget,
    probeLink,
    buildSnapshot,
    probeAll,
    probeOne,
    refreshSchedule,
    start
};
