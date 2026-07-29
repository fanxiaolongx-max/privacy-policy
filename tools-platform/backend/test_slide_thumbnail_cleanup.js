const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { removeRenderDirectoryBestEffort } = require('./models/slide-thumbnail-renderer');

function makeTempDir() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slide-cleanup-test-'));
    const nestedDir = path.join(tempDir, 'nested');
    fs.mkdirSync(nestedDir);
    fs.writeFileSync(path.join(nestedDir, 'preview.png'), 'preview');
    return tempDir;
}

function testRecursiveCleanup() {
    const tempDir = makeTempDir();
    assert.strictEqual(removeRenderDirectoryBestEffort(tempDir, { scheduleRetry: false }), true);
    assert.strictEqual(fs.existsSync(tempDir), false);
}

function testCleanupFailureDoesNotThrow() {
    const tempDir = makeTempDir();
    const originalRmSync = fs.rmSync;
    const originalWarn = console.warn;
    let receivedOptions = null;
    let warning = '';

    fs.rmSync = (target, options) => {
        assert.strictEqual(target, tempDir);
        receivedOptions = options;
        const error = new Error('directory not empty');
        error.code = 'ENOTEMPTY';
        throw error;
    };
    console.warn = (...parts) => {
        warning = parts.join(' ');
    };

    try {
        assert.strictEqual(removeRenderDirectoryBestEffort(tempDir, { scheduleRetry: false }), false);
    } finally {
        fs.rmSync = originalRmSync;
        console.warn = originalWarn;
        fs.rmSync(tempDir, { recursive: true, force: true });
    }

    assert.deepStrictEqual(receivedOptions, {
        recursive: true,
        force: true,
        maxRetries: 8,
        retryDelay: 150
    });
    assert.match(warning, /temporary preview cleanup delayed/);
}

function run() {
    testRecursiveCleanup();
    testCleanupFailureDoesNotThrow();
    console.log('slide thumbnail cleanup tests passed');
}

run();
