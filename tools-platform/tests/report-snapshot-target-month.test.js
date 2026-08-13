const test = require('node:test');
const assert = require('node:assert/strict');
const { inferFromDate, resolve } = require('../frontend/js/report/snapshot-target-month');

test('uses the target month saved in the snapshot', () => {
    assert.equal(resolve({ selectedTargetMonth: 7, timestamp: '2026-05-30T18:41:17.229Z' }), 7);
});

test('infers legacy snapshot month from its own date', () => {
    assert.equal(resolve({ timestamp: '2026-05-30T18:41:17.229Z' }), 5);
    assert.equal(resolve({ timestamp: '2026-06-01T08:43:41.113Z' }), 5);
    assert.equal(resolve({ timestamp: '2026-06-10T08:43:41.113Z' }), 6);
});

test('wraps early January snapshots to December', () => {
    assert.equal(inferFromDate(new Date(2026, 0, 5, 12)), 12);
});

test('returns null when neither a saved month nor a valid date exists', () => {
    assert.equal(resolve({ timestamp: 'invalid' }), null);
    assert.equal(resolve({}), null);
});
