const fs = require('fs');
const path = require('path');
const util = require('util');

const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

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

function installDailyFileConsole(options = {}) {
    if (process.env.TOOLS_DAILY_LOGS === '0') return;
    if (global.__TOOLS_DAILY_FILE_CONSOLE_INSTALLED__) return;
    global.__TOOLS_DAILY_FILE_CONSOLE_INSTALLED__ = true;

    const logRoot = options.logRoot || process.env.TOOLS_LOG_DIR || path.join(__dirname, '..', 'logs');
    const original = {
        log: console.log.bind(console),
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
        if (disabled) return null;

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
        if (!streams) return;

        const message = util.format(...args).replace(ANSI_PATTERN, '');
        const line = `${localTimestamp()} ${message}\n`;
        if (level === 'error' || level === 'warn') {
            streams.errorStream.write(line);
        } else {
            streams.outStream.write(line);
        }
    }

    console.log = (...args) => {
        write('log', args);
        original.log(...args);
    };

    console.warn = (...args) => {
        write('warn', args);
        original.warn(...args);
    };

    console.error = (...args) => {
        write('error', args);
        original.error(...args);
    };

    process.on('exit', closeStreams);
}

module.exports = {
    installDailyFileConsole
};
