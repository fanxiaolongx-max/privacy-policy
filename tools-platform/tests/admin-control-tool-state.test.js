const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeToolState } = require('../backend/models/custom-tools-repository');

test('administrative control state preserves validated CRUD data', () => {
    const state = normalizeToolState({
        version: 1,
        tasks: [{ id: ' T-1 ', module: '餐饮服务', title: '整改', owner: '张三', status: '预警', risk: '高', progress: 130, deadline: '2026-09-30', milestone: '验收', audit: [{ id: 'log-1', action: '编辑任务', detail: '进度 20%→30%', actor: 'admin', at: '2026-09-09T08:00:00.000Z' }] }],
        satisfactionData: [{ type: '心愿菜', no: 2, id: '0088', text: '希望增加凉菜', progress: '排期中', owner: '李四', done: '' }],
        sidebarCollapsed: true,
        report: { month: '9月', metrics: [{ name: '满意度', value: '4.8', unit: '分' }] }
    });

    assert.equal(state.tasks[0].id, 'T-1');
    assert.equal(state.tasks[0].progress, 100);
    assert.deepEqual(state.tasks[0].audit[0], { id: 'log-1', action: '编辑任务', detail: '进度 20%→30%', actor: 'admin', at: '2026-09-09T08:00:00.000Z' });
    assert.equal(state.satisfactionData[0].type, '心愿菜');
    assert.equal(state.satisfactionData[0].text, '希望增加凉菜');
    assert.equal(state.sidebarCollapsed, true);
    assert.deepEqual(state.report.metrics, [{ name: '满意度', value: '4.8', unit: '分' }]);
});

test('administrative control state rejects invalid rows and normalizes enums', () => {
    const state = normalizeToolState({
        version: 1,
        tasks: [{ id: '', title: '' }, { id: 'T-2', title: '任务', status: '未知', risk: '未知', deadline: 'not-a-date' }],
        satisfactionData: [{ id: '', text: '' }, { id: '9', text: '反馈', type: '未知' }]
    });

    assert.equal(state.tasks.length, 1);
    assert.equal(state.tasks[0].status, '正常');
    assert.equal(state.tasks[0].risk, '低');
    assert.equal(state.tasks[0].deadline, '');
    assert.equal(state.satisfactionData.length, 1);
    assert.equal(state.satisfactionData[0].type, '问题建议');
});
