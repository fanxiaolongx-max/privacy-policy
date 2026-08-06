const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tools-platform-service-status-'));
process.env.TOOLS_DATA_DIR = tempDir;

const repo = require('./models/service-status-repository');
const { closeDatabase } = require('./models/app-db');

async function main() {
    const dateAt = daysAgo => {
        const date = new Date();
        date.setUTCHours(10, 0, 0, 0);
        date.setUTCDate(date.getUTCDate() - daysAgo);
        return date;
    };
    const dayKey = daysAgo => dateAt(daysAgo).toISOString().slice(0, 10);
    assert.strictEqual(repo.resolveService('/api/health').id, 'core');
    assert.strictEqual(repo.resolveService('/api/uiv/scripts').id, 'automation');
    assert.strictEqual(repo.resolveService('/api/custom-tools').id, 'tools');
    assert.strictEqual(repo.resolveService('/api/ai/chat').id, 'ai');
    assert.strictEqual(repo.shouldTrackRequest('OPTIONS', '/api/health'), false);
    assert.strictEqual(repo.shouldTrackRequest('GET', '/api/platform-metrics/service-status?days=90'), false);

    const now = Date.now();
    assert.strictEqual(repo.summarizeLicenseStatus({ enabled: false }, now).state, 'not-applicable');
    assert.strictEqual(repo.summarizeLicenseStatus({ enabled: true, valid: true, trustedNow: now, expiresAt: now + 8 * 86400000 }, now).state, 'operational');
    assert.strictEqual(repo.summarizeLicenseStatus({ enabled: true, valid: true, trustedNow: now, expiresAt: now + 6 * 86400000 }, now).state, 'degraded');
    assert.strictEqual(repo.summarizeLicenseStatus({ enabled: true, valid: true, trustedNow: now, expiresAt: now + 23 * 3600000 }, now).state, 'incident');
    assert.strictEqual(repo.summarizeLicenseStatus({ enabled: true, valid: false, reasonCode: 'REVOKED', trustedNow: now, expiresAt: now + 30 * 86400000 }, now).state, 'incident');

    await repo.trackRequest({ method: 'GET', pathname: '/api/health', statusCode: 200, durationMs: 12, timestamp: dateAt(2) });
    await repo.trackRequest({ method: 'GET', pathname: '/api/health', statusCode: 404, durationMs: 18, timestamp: dateAt(1) });
    await repo.trackRequest({ method: 'POST', pathname: '/api/ai/chat', statusCode: 503, durationMs: 140, timestamp: dateAt(0) });
    await repo.trackRequest({ method: 'GET', pathname: '/api/custom-tools', statusCode: 200, durationMs: 22, timestamp: dateAt(0) });

    const history = await repo.getHistory(30);
    assert.strictEqual(history.days, 30);
    assert.strictEqual(history.services.length, repo.SERVICE_DEFINITIONS.length);
    const core = history.services.find(service => service.id === 'core');
    const ai = history.services.find(service => service.id === 'ai');
    const tools = history.services.find(service => service.id === 'tools');
    assert.strictEqual(core.history.find(day => day.date === dayKey(2)).state, 'operational');
    assert.strictEqual(core.history.find(day => day.date === dayKey(1)).state, 'degraded');
    assert.strictEqual(ai.history.find(day => day.date === dayKey(0)).state, 'incident');
    assert.strictEqual(tools.history.find(day => day.date === dayKey(0)).state, 'operational');
    assert.strictEqual(history.overall.requests, 4);
    assert.strictEqual(history.overall.successes, 2);
    assert.strictEqual(history.overall.clientErrors, 1);
    assert.strictEqual(history.overall.serverErrors, 1);
    assert.strictEqual(history.overall.availability, 75);

    const fallback = await repo.getHistory(365);
    assert.strictEqual(fallback.days, 90);
    console.log('service status repository tests passed');
}

main()
    .then(closeDatabase)
    .then(() => fs.rmSync(tempDir, { recursive: true, force: true }))
    .catch(async error => {
        console.error(error);
        try { await closeDatabase(); } catch (_) {}
        fs.rmSync(tempDir, { recursive: true, force: true });
        process.exit(1);
    });
