const test = require('node:test');
const assert = require('node:assert/strict');
const { selectLatestSnapshotPerMonth } = require('../backend/models/report-trend-utils');

test('keeps only the latest snapshot from each calendar month and orders the result', () => {
    const rows = [
        { id: 5, trend_month: '2026-06', created_at: '2026-06-29 19:45:00' },
        { id: 1, trend_month: '2026-04', created_at: '2026-04-12 09:00:00' },
        { id: 4, trend_month: '2026-06', created_at: '2026-06-27 11:00:00' },
        { id: 3, trend_month: '2026-05', created_at: '2026-05-31 08:00:00' },
        { id: 2, trend_month: '2026-04', created_at: '2026-04-29 17:30:00' }
    ];

    assert.deepEqual(
        selectLatestSnapshotPerMonth(rows).map(row => row.id),
        [2, 3, 5]
    );
});

test('ignores rows without a valid calendar-month key', () => {
    assert.deepEqual(selectLatestSnapshotPerMonth([
        { id: 1, trend_month: '' },
        { id: 2, trend_month: '06-2026' },
        { id: 3, trend_month: '2026-06' }
    ]).map(row => row.id), [3]);
});
