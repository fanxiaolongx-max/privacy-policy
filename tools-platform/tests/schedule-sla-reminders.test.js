const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const engine = require('../backend/builtin-tools/tool-mrhqjeya/assets/sla-reminder-engine');

const ticket = (id, due = '2026-10-14', extra = {}) => ({
    collection: 'risk', title: '风险', _slaDays: 7, deadline: `${due}T18:00:00`,
    data: { ticket_id: id, risk_title: '处理网络风险', network_name: 'ET', product_line: '无线', product: 'LTE', owner: '张三', ...extra }
});
const snapshot = (tickets, id = 's1', timestamp = '2026-10-07T09:00:00Z') => ({ id, timestamp, expiringTickets: tickets });
const sync = (state, snap, today = '2026-10-07', extra = {}) => engine.reconcile(state, snap, { today, to: '2026-10-20', ...extra });
const reminders = (state, day) => (state[day] || []).filter(event => event.slaReminder);

test('plans three stages and daily overdue reminders without duplicates; retains cached snapshot', () => {
    const state = {};
    sync(state, snapshot([ticket('R1')]));
    for (const [day, stage] of [['2026-10-07', 'first'], ['2026-10-11', 'second'], ['2026-10-14', 'due'], ['2026-10-15', 'overdue'], ['2026-10-20', 'overdue']]) {
        assert.equal(reminders(state, day)[0].slaReminder.stage, stage);
        assert.equal(reminders(state, day)[0].reporter, '张三');
        assert.equal(reminders(state, day)[0].attendees, 'ET');
    }
    assert.equal(sync(state, snapshot([ticket('R1')])).changed, false);
    const due = reminders(state, '2026-10-14')[0];
    due.status = 'reminded';
    sync(state, null, '2026-10-16', { to: '2026-10-25' });
    assert.equal(due.status, 'reminded');
    assert.equal(reminders(state, '2026-10-25')[0].status, 'pending');
    assert.equal(reminders(state, '2026-10-14').length, 1);
});

test('new snapshots resolve only generated tasks, refresh details and retain manual events', () => {
    const manual = { id: 'manual', start: '09:00', end: '10:00', title: '经营会议' };
    const state = { '2026-10-07': [manual] };
    sync(state, snapshot([ticket('R1'), ticket('R2')]));
    sync(state, snapshot([ticket('R2', '2026-10-14', { owner: '李四' })], 's2', '2026-10-08T09:00:00Z'), '2026-10-08');
    assert.equal(state['2026-10-07'][0], manual);
    for (const [, events] of engine.entries(state)) for (const event of events) {
        if (event.slaReminder?.ticket.number === 'R1') assert.equal(event.status, 'completed');
        if (event.slaReminder?.ticket.number === 'R2') assert.equal(event.reporter, '李四');
    }
    sync(state, snapshot([], 's3', '2026-10-09T09:00:00Z'), '2026-10-09');
    assert.ok(engine.entries(state).flatMap(([, events]) => events).filter(event => event.slaReminder).every(event => event.status === 'completed'));
});

test('missing, malformed or older snapshots cannot resolve current reminders', () => {
    const state = {};
    sync(state, snapshot([ticket('R1')], 's2', '2026-10-08T09:00:00Z'));
    const before = JSON.stringify(state);
    for (const snap of [null, { id: 'broken', timestamp: '2026-10-09' }, snapshot([], 'old', '2026-10-06T09:00:00Z')]) {
        assert.equal(sync(state, snap).changed, false);
        assert.equal(JSON.stringify(state), before);
    }
});

test('uses captured date for legacy estimates; excludes sentinel, closed and historical SR rows', () => {
    const snap = snapshot([]);
    const legacy = { collection: 'risk', _slaDays: -2, data: { ticket_id: 'R1' } };
    const row = engine.normalizeTicket(legacy, snap);
    assert.equal(row.dueDate, '2026-10-05');
    assert.equal(row.estimated, true);
    for (const days of [999995, 999996, 999997, 999998, 999999, -999999, '', null]) {
        assert.equal(engine.normalizeTicket({ ...legacy, _slaDays: days }, snap), null);
    }
    assert.equal(engine.normalizeTicket({ ...legacy, collection: 'sr', _slaDays: -1, _slaCleanText: '历史超期 (3 天)' }, snap), null);
    assert.equal(engine.normalizeTicket({ ...legacy, data: { ticket_id: 'R1', task_status: 'Closed' } }, snap), null);
    const sr = engine.normalizeTicket({ ...legacy, collection: 'sr', data: { sr_num: 'SR1', exp_close_date: '2026-10-12T11:00:00', sus_exp_close_date: '2026-10-15T11:00:00' } }, snap);
    assert.equal(sr.dueDate, '2026-10-15');
    assert.equal(sr.estimated, false);
});

test('allocates shorter slots when busy, avoids manual events and lunch, and exposes overflow', () => {
    function plan(count) {
        const state = { '2026-10-07': [{ id: 'meeting', start: '09:00', end: '11:00' }] };
        sync(state, snapshot(Array.from({ length: count }, (_, i) => ticket(`R${i}`))));
        return reminders(state, '2026-10-07');
    }
    const few = plan(2), many = plan(100);
    const minutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
    const length = event => minutes(event.end) - minutes(event.start);
    assert.equal(length(few[0]), 30);
    assert.ok(length(many[0]) < length(few[0]));
    const sorted = many.filter(event => !event.unplanned).sort((a, b) => a.start.localeCompare(b.start));
    sorted.forEach((event, i) => {
        assert.ok(event.end <= '09:00' || event.start >= '11:00');
        assert.ok(event.end <= '12:00' || event.start >= '13:30');
        if (i) assert.ok(sorted[i - 1].end <= event.start);
    });
    assert.ok(plan(600).some(event => event.unplanned && event.start === '' && event.status === 'pending'));
});

test('catches up late imports, updates deadlines and reopens tickets that return to scope', () => {
    const state = {};
    sync(state, snapshot([ticket('R1', '2026-10-09')]));
    assert.equal(reminders(state, '2026-10-07')[0].slaReminder.stage, 'second');
    sync(state, snapshot([ticket('R1', '2026-10-12')], 's2', '2026-10-08T09:00:00Z'), '2026-10-08');
    assert.equal(reminders(state, '2026-10-09').find(event => event.slaReminder.stage === 'due').status, 'completed');
    assert.equal(reminders(state, '2026-10-12').find(event => event.slaReminder.stage === 'due').status, 'pending');
    sync(state, snapshot([], 's3', '2026-10-08T10:00:00Z'), '2026-10-08');
    sync(state, snapshot([ticket('R1', '2026-10-12')], 's4', '2026-10-08T11:00:00Z'), '2026-10-08');
    assert.equal(reminders(state, '2026-10-12').find(event => event.slaReminder.stage === 'due').status, 'pending');
    assert.equal(reminders(state, '2026-10-12').filter(event => event.status === 'pending').length, 1);
});

test('manual time adjustments survive syncing; disabling policy stops new reminders', () => {
    const state = {};
    sync(state, snapshot([ticket('R1')]));
    const event = reminders(state, '2026-10-07')[0];
    event.start = '16:00'; event.end = '16:20'; event.timeLocked = true;
    sync(state, null);
    assert.equal(event.start, '16:00');
    sync(state, null, '2026-10-21', { config: { enabled: false }, to: '2026-10-25' });
    assert.equal(reminders(state, '2026-10-25').length, 0);
    assert.ok(engine.entries(state).every(([day]) => day !== engine.META_KEY));
});

test('deadline updates inside a reminder window catch up today instead of adding a missed past reminder', () => {
    const state = {};
    sync(state, snapshot([ticket('R1', '2026-10-08')]));
    sync(state, snapshot([ticket('R1', '2026-10-20')], 's2', '2026-10-14T09:00:00Z'), '2026-10-14', { to: '2026-10-25' });
    assert.ok(reminders(state, '2026-10-14').some(event => event.slaReminder.stage === 'first' && event.status === 'pending'));
    assert.equal(reminders(state, '2026-10-13').filter(event => event.slaReminder.stage === 'first').length, 0);
});

test('configured SLA rules expose their exact deadlines for snapshot capture', () => {
    const window = {};
    const context = vm.createContext({ window, console, document: { addEventListener() {} }, Date });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../frontend/js/sla/other-rules.js'), 'utf8'), context);
    const standard = window.SLAOtherRules.evaluate('rectification', { task_status: 'Checking', task_create_time: '2026-10-01T10:00:00Z' }, { now: new Date('2026-10-07T09:00:00Z') });
    const expected = new Date('2026-10-01T10:00:00Z'); expected.setDate(expected.getDate() + 30);
    assert.equal(standard.deadline.toISOString(), expected.toISOString());
    const sr = window.SLAOtherRules.evaluate('sr', { sr_status_name: 'Open', open_date: '2026-10-01T10:00:00Z', exp_close_date: '2026-10-15T10:00:00Z' }, { now: new Date('2026-10-07T09:00:00Z') });
    assert.equal(sr.deadline.toISOString(), '2026-10-15T10:00:00.000Z');
});
