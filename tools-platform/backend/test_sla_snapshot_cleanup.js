const test = require('node:test');
const assert = require('node:assert/strict');

const { planSnapshotCleanup } = require('./models/sla-snapshots-repository');
const { closeDatabase } = require('./models/app-db');

test.after(async () => {
    await closeDatabase();
});

const NOW = Date.parse('2026-08-12T12:00:00Z');
const snapshots = [
    { id: 'newest', timestamp: '2026-08-12T10:00:00Z' },
    { id: 'same-day-old', timestamp: '2026-08-12T08:00:00Z' },
    { id: 'recent', timestamp: '2026-08-10T10:00:00Z' },
    { id: 'old', timestamp: '2026-06-01T10:00:00Z' },
    { id: 'invalid', timestamp: 'not-a-date' }
];

test('latest-only removes every historical and malformed snapshot but keeps the newest', () => {
    const plan = planSnapshotCleanup(snapshots, { mode: 'latest-only', now: NOW });

    assert.equal(plan.beforeCount, 5);
    assert.equal(plan.afterCount, 1);
    assert.equal(plan.removedCount, 4);
    assert.equal(plan.latestSnapshotId, 'newest');
    assert.deepEqual(plan.kept.map(item => item.id), ['newest']);
    assert.equal(plan.invalidRemovedCount, 1);
});

test('retain-days keeps one snapshot per retained day and removes older data', () => {
    const plan = planSnapshotCleanup(snapshots, { mode: 'retain-days', days: 30, now: NOW });

    assert.deepEqual(plan.kept.map(item => item.id), ['newest', 'recent']);
    assert.deepEqual(
        Object.fromEntries(plan.removed.map(item => [item.id, item.reason])),
        {
            'same-day-old': 'same-day-duplicate',
            old: 'outside-retention',
            invalid: 'invalid-timestamp'
        }
    );
});

test('retain-days always keeps the newest snapshot when all data is stale', () => {
    const stale = snapshots.filter(item => ['old', 'invalid'].includes(item.id));
    const plan = planSnapshotCleanup(stale, { mode: 'retain-days', days: 30, now: NOW });

    assert.deepEqual(plan.kept.map(item => item.id), ['old']);
    assert.equal(plan.removedCount, 1);
});

test('legacy requests still only deduplicate recent dates', () => {
    const plan = planSnapshotCleanup(snapshots, { days: 30, now: NOW });

    assert.deepEqual(plan.kept.map(item => item.id), ['newest', 'recent', 'old', 'invalid']);
    assert.deepEqual(plan.removed.map(item => item.id), ['same-day-old']);
});
