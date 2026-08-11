const test = require('node:test');
const assert = require('node:assert/strict');
const { findMatchedMetricLabels } = require('../backend/models/ai-report-analysis-service');

test('matches a uniquely identifying shortened Chinese metric name', () => {
    const labels = ['存储整改', '路由器', '重疾EOS预案覆盖率'];

    assert.deepEqual(
        findMatchedMetricLabels(labels, '6 月存储的指标如何，和 7 月比怎么样'),
        ['存储整改']
    );
});

test('does not guess from a generic Chinese metric fragment', () => {
    const labels = ['存储整改', '整改确认及执行逾期'];

    assert.deepEqual(findMatchedMetricLabels(labels, '整改怎么样'), []);
});

test('prefers the most specific uniquely matched metric name', () => {
    const labels = ['预案', '重疾EOS预案覆盖率'];

    assert.deepEqual(findMatchedMetricLabels(labels, '重疾预案最近怎么样'), ['重疾EOS预案覆盖率']);
    assert.deepEqual(findMatchedMetricLabels(labels, '预案覆盖情况'), ['重疾EOS预案覆盖率']);
});

test('honors an explicit year for year-suffixed metric families', () => {
    const labels = ['重急EOS收编2025', '重急EOS收编2026'];

    assert.deepEqual(findMatchedMetricLabels(labels, '重急EOS收编2026怎么样'), ['重急EOS收编2026']);
    assert.deepEqual(findMatchedMetricLabels(labels, '重急EOS收编怎么样'), labels);
});

test('does not silently choose one metric for an ambiguous shorthand', () => {
    const labels = ['全量EOS-产品', '全量EOS-版本', '重急EOS'];

    assert.deepEqual(findMatchedMetricLabels(labels, 'EOS怎么样'), []);
    assert.deepEqual(findMatchedMetricLabels(labels, '全量EOS版本怎么样'), ['全量EOS-版本']);
});

test('keeps overlapping metric names when the user explicitly lists them', () => {
    const labels = ['日志回传', '日志回传备案', '日志稽查'];

    assert.deepEqual(
        findMatchedMetricLabels(labels, '日志回传、日志回传备案、日志稽查这三个指标当前值怎么样'),
        labels
    );
    assert.deepEqual(findMatchedMetricLabels(labels, '日志回传备案当前值怎么样'), ['日志回传备案']);
});
