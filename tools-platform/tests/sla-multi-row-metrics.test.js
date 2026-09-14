const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const eventsPath = path.join(__dirname, '..', 'frontend', 'js', 'sla', 'events.js');
const source = fs.readFileSync(eventsPath, 'utf8');
const start = source.indexOf('function getMetricRuleConditions');
const end = source.indexOf('function buildMetricConditionFieldOptions');

assert.ok(start >= 0 && end > start, 'metric rule helper functions should remain extractable');

const helpers = vm.runInNewContext(`(() => {
    ${source.slice(start, end)}
    return { metricRuleRowMatches, parseMetricNumericValue, aggregateMetricRowValues };
})()`);

test('legacy and single-row rules keep AND condition behavior', () => {
    const rule = {
        type: 'extract',
        colX: 'region',
        valY: 'North',
        filterLogic: 'or',
        conditions: [{ column: 'status', value: 'Done' }]
    };

    assert.equal(helpers.metricRuleRowMatches({ region: 'North', status: 'Open' }, rule), false);
    assert.equal(helpers.metricRuleRowMatches({ region: 'North', status: 'Done' }, rule), true);
});

test('multi-row OR matches the primary condition or any advanced condition', () => {
    const rule = {
        type: 'extract_multi',
        colX: 'region',
        valY: 'North',
        filterLogic: 'or',
        conditions: [
            { column: 'team', value: 'Core' },
            { column: 'status', value: '[空]' }
        ]
    };

    assert.equal(helpers.metricRuleRowMatches({ region: 'North', team: 'Edge', status: 'Open' }, rule), true);
    assert.equal(helpers.metricRuleRowMatches({ region: 'South', team: 'Core', status: 'Open' }, rule), true);
    assert.equal(helpers.metricRuleRowMatches({ region: 'South', team: 'Edge', status: '' }, rule), true);
    assert.equal(helpers.metricRuleRowMatches({ region: 'South', team: 'Edge', status: 'Open' }, rule), false);
});

test('multi-row aggregation defaults to sum and supports common calculations', () => {
    const rows = [{ amount: '1,200.5' }, { amount: 99.5 }, { amount: '' }, { amount: 'not a number' }];
    const rule = { colZ: 'amount' };

    assert.equal(helpers.aggregateMetricRowValues(rows, rule), 1300);
    assert.equal(helpers.aggregateMetricRowValues(rows, { ...rule, aggregation: 'avg' }), 650);
    assert.equal(helpers.aggregateMetricRowValues(rows, { ...rule, aggregation: 'max' }), 1200.5);
    assert.equal(helpers.aggregateMetricRowValues(rows, { ...rule, aggregation: 'min' }), 99.5);
    assert.equal(helpers.aggregateMetricRowValues(rows, { ...rule, aggregation: 'count' }), 2);
});

test('multi-row aggregation preserves percentage units and handles empty numeric results', () => {
    const rule = { colZ: 'rate', aggregation: 'sum' };
    assert.equal(helpers.aggregateMetricRowValues([{ rate: '12.5%' }, { rate: '7.5%' }], rule), '20%');
    assert.equal(helpers.aggregateMetricRowValues([{ rate: '-' }, { rate: null }], rule), '--');
});
