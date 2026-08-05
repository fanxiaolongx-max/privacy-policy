const dgram = require('dgram');
const { performance } = require('perf_hooks');

const NTP_UNIX_EPOCH_SECONDS = 2208988800;
const DEFAULT_SERVERS = ['time.cloudflare.com', 'time.google.com', 'pool.ntp.org'];
const CACHE_TTL_MS = 5 * 60 * 1000;
const QUERY_TIMEOUT_MS = 1800;

let cachedAnchor = null;
let refreshPromise = null;

function configuredServers() {
    const values = String(process.env.F12_NTP_SERVERS || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);
    return values.length ? [...new Set(values)] : DEFAULT_SERVERS;
}

function parseNtpTransmitTime(message) {
    if (!Buffer.isBuffer(message) || message.length < 48) throw new Error('NTP 响应长度不足');
    const mode = message[0] & 0x07;
    const stratum = message[1];
    if (mode !== 4 && mode !== 5) throw new Error('NTP 响应模式无效');
    if (stratum < 1 || stratum > 15) throw new Error('NTP 层级无效');
    const seconds = message.readUInt32BE(40);
    const fraction = message.readUInt32BE(44);
    return (seconds - NTP_UNIX_EPOCH_SECONDS) * 1000 + (fraction * 1000 / 0x100000000);
}

function queryNtpServer(host, timeoutMs = QUERY_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
        const socket = dgram.createSocket('udp4');
        const request = Buffer.alloc(48);
        request[0] = 0x23;
        const startedMono = performance.now();
        let settled = false;

        const finish = (error, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try { socket.close(); } catch (_) {}
            if (error) reject(error);
            else resolve(value);
        };
        const timer = setTimeout(() => finish(new Error(`NTP ${host} 请求超时`)), timeoutMs);
        socket.once('error', error => finish(error));
        socket.once('message', message => {
            try {
                const receivedMono = performance.now();
                const rttMs = receivedMono - startedMono;
                finish(null, {
                    host,
                    timeMs: parseNtpTransmitTime(message) + (rttMs / 2),
                    receivedMono,
                    rttMs
                });
            } catch (error) {
                finish(error);
            }
        });
        socket.send(request, 123, host, error => {
            if (error) finish(error);
        });
    });
}

function median(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    if (!sorted.length) throw new Error('没有可用的可信时间样本');
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

async function refreshTrustedTime() {
    const servers = configuredServers();
    const results = await Promise.allSettled(servers.map(host => queryNtpServer(host)));
    const nowMono = performance.now();
    const samples = results
        .filter(result => result.status === 'fulfilled')
        .map(result => ({
            ...result.value,
            currentTimeMs: result.value.timeMs + (nowMono - result.value.receivedMono)
        }));

    if (samples.length) {
        const trustedNow = median(samples.map(sample => sample.currentTimeMs));
        cachedAnchor = {
            trustedTimeMs: trustedNow,
            monotonicMs: nowMono,
            refreshedAtMono: nowMono,
            source: samples.length >= 2 ? 'ntp-consensus' : 'ntp-single',
            servers: samples.map(sample => sample.host),
            sampleCount: samples.length
        };
    } else {
        cachedAnchor = {
            trustedTimeMs: Date.now(),
            monotonicMs: nowMono,
            refreshedAtMono: nowMono,
            source: 'server-clock-fallback',
            servers: [],
            sampleCount: 0
        };
    }
    return currentFromAnchor();
}

function currentFromAnchor() {
    if (!cachedAnchor) return null;
    const nowMono = performance.now();
    return {
        now: Math.round(cachedAnchor.trustedTimeMs + (nowMono - cachedAnchor.monotonicMs)),
        source: cachedAnchor.source,
        servers: cachedAnchor.servers,
        sampleCount: cachedAnchor.sampleCount
    };
}

async function getTrustedTime({ forceRefresh = false } = {}) {
    const current = currentFromAnchor();
    const cacheAge = cachedAnchor ? performance.now() - cachedAnchor.refreshedAtMono : Infinity;
    if (!forceRefresh && current && cacheAge < CACHE_TTL_MS) return current;
    if (!refreshPromise) {
        refreshPromise = refreshTrustedTime().finally(() => { refreshPromise = null; });
    }
    return refreshPromise;
}

module.exports = {
    CACHE_TTL_MS,
    DEFAULT_SERVERS,
    getTrustedTime,
    median,
    parseNtpTransmitTime,
    queryNtpServer
};
