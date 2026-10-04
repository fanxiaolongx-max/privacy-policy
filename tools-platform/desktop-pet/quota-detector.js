const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

let cachedAntigravityPort = null;
let cachedCsrfToken = null;
let lastKnownAntigravityQuota = null;

/**
 * 探测 HTTPS 端口并提取 CSRF Token
 */
function probeHttps(port) {
    return new Promise((resolve) => {
        let done = false;
        const req = https.get('https://127.0.0.1:' + port + '/', { rejectUnauthorized: false, timeout: 800 }, (res) => {
            let b = '';
            res.on('data', d => { b += d.toString(); });
            res.on('end', () => {
                if (!done) {
                    done = true;
                    const m = /"csrfToken":"([^"]+)"/.exec(b);
                    resolve(m ? m[1] : null);
                }
            });
        });
        req.on('error', () => {
            if (!done) { done = true; resolve(null); }
        });
        req.on('timeout', () => {
            if (!done) { done = true; req.destroy(); resolve(null); }
        });
    });
}

/**
 * 检查 Antigravity 是否在线并获取端口
 */
async function checkAntigravityAlive() {
    if (cachedAntigravityPort) {
        const token = await probeHttps(cachedAntigravityPort);
        if (token) {
            cachedCsrfToken = token;
            return true;
        }
        cachedAntigravityPort = null;
        cachedCsrfToken = null;
    }
    try {
        const home = process.env.HOME || process.env.USERPROFILE || '';
        const logFile = process.platform === 'win32'
            ? path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'antigravity', 'logs', 'language_server.log')
            : (process.platform === 'darwin'
                ? path.join(home, 'Library', 'Application Support', 'antigravity', 'logs', 'language_server.log')
                : path.join(home, '.config', 'antigravity', 'logs', 'language_server.log'));

        if (!fs.existsSync(logFile)) return false;

        const stat = fs.statSync(logFile);
        const readSize = Math.min(stat.size, 65536);
        if (readSize <= 0) return false;

        const buf = Buffer.alloc(readSize);
        const fd = fs.openSync(logFile, 'r');
        fs.readSync(fd, buf, 0, readSize, stat.size - readSize);
        fs.closeSync(fd);

        const content = buf.toString('utf8');
        const matches = [...content.matchAll(/listening on \w+ port at (\d+)/gi)];
        if (matches.length > 0) {
            const ports = [...new Set(matches.map(m => Number(m[1])).filter(Boolean))].reverse();
            for (const p of ports) {
                const token = await probeHttps(p);
                if (token) {
                    cachedAntigravityPort = p;
                    cachedCsrfToken = token;
                    return true;
                }
            }
        }
    } catch (_) {}
    return false;
}

/**
 * 获取 Antigravity (Gemini / Claude) 额度详情
 */
async function fetchAntigravityQuota() {
    try {
        if (!cachedAntigravityPort || !cachedCsrfToken) {
            const alive = await checkAntigravityAlive();
            if (!alive || !cachedAntigravityPort || !cachedCsrfToken) return lastKnownAntigravityQuota;
        }

        const quotaData = await new Promise((resolve, reject) => {
            const data = JSON.stringify({});
            const req = https.request({
                hostname: '127.0.0.1',
                port: cachedAntigravityPort,
                path: '/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data),
                    'Connect-Protocol-Version': '1',
                    'x-codeium-csrf-token': cachedCsrfToken
                },
                rejectUnauthorized: false,
                timeout: 2500
            }, (res) => {
                let resBody = '';
                res.on('data', d => { resBody += d.toString(); });
                res.on('end', () => {
                    try { resolve(JSON.parse(resBody)); } catch (e) { reject(e); }
                });
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
            req.write(data);
            req.end();
        });

        if (quotaData && quotaData.response) {
            const parsed = parseAntigravityQuota(quotaData.response);
            if (parsed) {
                lastKnownAntigravityQuota = parsed;
                return parsed;
            }
        }
    } catch (_) {
        cachedAntigravityPort = null;
        cachedCsrfToken = null;
    }
    return lastKnownAntigravityQuota;
}

function parseAntigravityQuota(resp) {
    let gemini5h = 1;
    let gemini5hReset = '';
    let geminiWeekly = 1;
    let geminiWeeklyReset = '';
    let claude5h = 1;
    let claudeWeekly = 1;

    (resp.groups || []).forEach(g => {
        const name = (g.displayName || '').toLowerCase();
        (g.buckets || []).forEach(b => {
            const window = (b.window || '').toLowerCase();
            const desc = b.description || '';
            let resetStr = '';
            const m = desc.match(/refresh in (.*)\./i);
            if (m) {
                resetStr = m[1].replace(/days?/g, '天').replace(/hours?/g, '小时').replace(/minutes?/g, '分').replace(/\s+/g, '') + '后刷新';
            }
            if (name.includes('gemini')) {
                if (window === '5h') {
                    gemini5h = b.remainingFraction;
                    gemini5hReset = resetStr;
                } else if (window === 'weekly') {
                    geminiWeekly = b.remainingFraction;
                    geminiWeeklyReset = resetStr;
                }
            } else if (name.includes('claude') || name.includes('gpt')) {
                if (window === '5h') {
                    claude5h = b.remainingFraction;
                } else if (window === 'weekly') {
                    claudeWeekly = b.remainingFraction;
                }
            }
        });
    });

    return {
        active: true,
        gemini5h: Math.round(gemini5h * 100),
        gemini5hReset,
        geminiWeekly: Math.round(geminiWeekly * 100),
        geminiWeeklyReset,
        claude5h: Math.round(claude5h * 100),
        claudeWeekly: Math.round(claudeWeekly * 100),
        updatedAt: Date.now()
    };
}

/**
 * 探测 Codex / OpenAI 相关本地或扩展额度
 * （预留扩展槽位，未来可接入 Codex 本地 Proxy、CLI 状态或配额接口）
 */
async function fetchCodexQuota() {
    try {
        const home = process.env.HOME || process.env.USERPROFILE || '';
        // 尝试检测本地是否有 codex 运行实例或配置文件
        const codexConfigPath = path.join(home, '.codex', 'config.json');
        if (fs.existsSync(codexConfigPath)) {
            const conf = JSON.parse(fs.readFileSync(codexConfigPath, 'utf8'));
            return {
                active: true,
                provider: conf.provider || 'codex',
                status: 'configured',
                updatedAt: Date.now()
            };
        }
    } catch (_) {}
    return null;
}

/**
 * 多模型额度统一聚合探测
 * 静默容错：若未安装或未运行任何检测项，纯粹返回 null，不影响任何主业务。
 */
async function detectAllQuotas() {
    const quotas = {
        antigravity: null,
        codex: null,
        hasAny: false,
        timestamp: Date.now()
    };

    try {
        quotas.antigravity = await fetchAntigravityQuota();
        if (quotas.antigravity && quotas.antigravity.active) quotas.hasAny = true;
    } catch (_) {}

    try {
        quotas.codex = await fetchCodexQuota();
        if (quotas.codex && quotas.codex.active) quotas.hasAny = true;
    } catch (_) {}

    return quotas;
}

module.exports = {
    checkAntigravityAlive,
    fetchAntigravityQuota,
    fetchCodexQuota,
    detectAllQuotas
};
