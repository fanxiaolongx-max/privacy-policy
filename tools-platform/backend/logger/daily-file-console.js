const fs = require('fs');
const path = require('path');
const util = require('util');

const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;
const MAX_BUFFERED_EVENTS = 1000;
const MAX_DETAIL_LENGTH = 16000;
const SENSITIVE_KEY_PATTERN = /authorization|password|passwd|token|cookie|api[_-]?key|secret|private[_-]?key|session/i;

let runtimeLogSink = null;
let bufferedEvents = [];

function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function localTimestamp(date = new Date()) {
    const dateKey = localDateKey(date);
    const time = [
        String(date.getHours()).padStart(2, '0'),
        String(date.getMinutes()).padStart(2, '0'),
        String(date.getSeconds()).padStart(2, '0')
    ].join(':');
    return `${dateKey} ${time}`;
}

function redactSensitiveText(value) {
    return String(value || '')
        .replace(/("(?:authorization|password|passwd|token|cookie|api[_-]?key|secret|private[_-]?key|session)"\s*:\s*)"[^"]*"/gi, '$1"[REDACTED]"')
        .replace(/((?:authorization|password|passwd|token|cookie|api[_-]?key|secret|private[_-]?key|session)\s*[=:]\s*)(?:bearer\s+)?[^\s,;&]+/gi, '$1[REDACTED]')
        .replace(/(bearer\s+)[a-z0-9._~+/=-]+/gi, '$1[REDACTED]');
}

function sanitizeConsoleValue(value, depth = 0, seen = new WeakSet()) {
    if (typeof value === 'string') return redactSensitiveText(value);
    if (value == null || typeof value !== 'object') return value;
    if (value instanceof Error) {
        const copy = new Error(redactSensitiveText(value.message));
        copy.name = value.name;
        copy.stack = redactSensitiveText(value.stack || `${value.name}: ${value.message}`);
        return copy;
    }
    if (Buffer.isBuffer(value)) return `<Buffer ${value.length} bytes>`;
    if (depth >= 6) return '[Max depth]';
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    if (Array.isArray(value)) return value.map(item => sanitizeConsoleValue(item, depth + 1, seen));
    const copy = {};
    Object.entries(value).forEach(([key, item]) => {
        copy[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : sanitizeConsoleValue(item, depth + 1, seen);
    });
    return copy;
}

function formatConsoleDetail(args) {
    const safeArgs = args.map(value => sanitizeConsoleValue(value));
    const message = redactSensitiveText(util.format(...safeArgs)).replace(ANSI_PATTERN, '');
    return message.length > MAX_DETAIL_LENGTH ? `${message.slice(0, MAX_DETAIL_LENGTH)}\n… [truncated]` : message;
}

function captureSourceLocation() {
    const stack = String(new Error().stack || '').split('\n').slice(2);
    const backendRoot = path.resolve(__dirname, '..');
    for (const line of stack) {
        if (line.includes('daily-file-console.js') || line.includes('node:internal') || line.includes('(internal/')) continue;
        const match = line.match(/(?:\(|at\s+)([^()]+?):(\d+):(\d+)\)?$/);
        if (!match) continue;
        const filePath = path.resolve(match[1]);
        const relative = path.relative(backendRoot, filePath);
        const displayPath = !relative.startsWith('..') && !path.isAbsolute(relative)
            ? `backend/${relative.split(path.sep).join('/')}`
            : filePath;
        return `${displayPath}:${match[2]}`;
    }
    return 'backend/unknown';
}

function emitRuntimeLog(event) {
    if (!runtimeLogSink) {
        bufferedEvents.push(event);
        if (bufferedEvents.length > MAX_BUFFERED_EVENTS) bufferedEvents.shift();
        return;
    }
    try {
        const result = runtimeLogSink(event);
        if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch (_) {}
}

function setRuntimeLogSink(sink) {
    runtimeLogSink = typeof sink === 'function' ? sink : null;
    if (!runtimeLogSink || !bufferedEvents.length) return;
    const pending = bufferedEvents;
    bufferedEvents = [];
    pending.forEach(emitRuntimeLog);
}

function installDailyFileConsole(options = {}) {
    if (global.__TOOLS_DAILY_FILE_CONSOLE_INSTALLED__) return;
    global.__TOOLS_DAILY_FILE_CONSOLE_INSTALLED__ = true;

    const fileLoggingEnabled = process.env.TOOLS_DAILY_LOGS !== '0';
    const logRoot = options.logRoot || process.env.TOOLS_LOG_DIR || path.join(__dirname, '..', 'logs');
    const original = {
        log: console.log.bind(console),
        info: console.info.bind(console),
        debug: console.debug.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console)
    };

    let currentDateKey = null;
    let outStream = null;
    let errorStream = null;
    let disabled = false;

    function closeStreams() {
        if (outStream) outStream.end();
        if (errorStream) errorStream.end();
        outStream = null;
        errorStream = null;
    }

    function ensureStreams() {
        if (!fileLoggingEnabled || disabled) return null;

        const dateKey = localDateKey();
        if (dateKey === currentDateKey && outStream && errorStream) {
            return { outStream, errorStream };
        }

        try {
            closeStreams();
            const dayDir = path.join(logRoot, dateKey);
            fs.mkdirSync(dayDir, { recursive: true });
            outStream = fs.createWriteStream(path.join(dayDir, 'out.log'), { flags: 'a' });
            errorStream = fs.createWriteStream(path.join(dayDir, 'error.log'), { flags: 'a' });
            outStream.on('error', handleStreamError);
            errorStream.on('error', handleStreamError);
            currentDateKey = dateKey;
            return { outStream, errorStream };
        } catch (err) {
            disabled = true;
            original.error('[daily-file-console] disabled:', err.message);
            return null;
        }
    }

    function handleStreamError(err) {
        if (disabled) return;
        disabled = true;
        original.error('[daily-file-console] disabled:', err.message);
        closeStreams();
    }

    function write(level, args) {
        const streams = ensureStreams();
        const timestamp = new Date();
        const detail = formatConsoleDetail(args);
        if (streams) {
            const line = `${localTimestamp(timestamp)} ${detail}\n`;
            if (level === 'ERROR' || level === 'WARN') streams.errorStream.write(line);
            else streams.outStream.write(line);
        }
        emitRuntimeLog({ timestamp, level, source: captureSourceLocation(), detail });
    }

    console.log = (...args) => {
        write('LOG', args);
        original.log(...args);
    };

    console.info = (...args) => {
        write('INFO', args);
        original.info(...args);
    };

    console.debug = (...args) => {
        write('DEBUG', args);
        original.debug(...args);
    };

    console.warn = (...args) => {
        write('WARN', args);
        original.warn(...args);
    };

    console.error = (...args) => {
        write('ERROR', args);
        original.error(...args);
    };

    process.on('exit', closeStreams);
}

module.exports = {
    captureSourceLocation,
    formatConsoleDetail,
    installDailyFileConsole,
    redactSensitiveText,
    setRuntimeLogSink
};
