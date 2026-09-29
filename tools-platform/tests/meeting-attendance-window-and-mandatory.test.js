const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadMeetingAttendance() {
    const htmlPath = path.resolve(__dirname, '../backend/builtin-tools/tool-msf5b7nn/index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
    assert.ok(scriptMatch, 'Script block should exist in index.html');
    const scriptContent = scriptMatch[1];

    const mockStorage = new Map();
    const mockLocalStorage = {
        getItem: key => mockStorage.get(key) || null,
        setItem: (key, val) => mockStorage.set(key, String(val)),
        removeItem: key => mockStorage.delete(key),
        clear: () => mockStorage.clear()
    };
    const mockSessionStorage = {
        getItem: key => mockStorage.get('session:' + key) || null,
        setItem: (key, val) => mockStorage.set('session:' + key, String(val)),
        removeItem: key => mockStorage.delete('session:' + key),
        clear: () => mockStorage.clear()
    };

    const mockElement = {
        classList: { toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false },
        querySelectorAll: () => [],
        querySelector: () => null,
        addEventListener: () => {},
        style: {},
        innerHTML: '',
        textContent: '',
        value: ''
    };

    const sandbox = {
        console,
        Date,
        Math,
        Number,
        String,
        Set,
        Map,
        Array,
        RegExp,
        Intl,
        JSON,
        setTimeout: () => {},
        clearTimeout: () => {},
        requestAnimationFrame: cb => cb(),
        localStorage: mockLocalStorage,
        sessionStorage: mockSessionStorage,
        document: {
            documentElement: { lang: 'zh-CN' },
            title: '',
            querySelector: () => mockElement,
            querySelectorAll: () => [],
            getElementById: () => mockElement,
            createElement: () => ({ ...mockElement }),
            body: { appendChild: () => {}, classList: mockElement.classList },
            addEventListener: () => {}
        },
        window: {}
    };
    sandbox.window = sandbox;

    vm.createContext(sandbox);
    vm.runInContext(scriptContent, sandbox);
    return sandbox.window.__meetingAttendance;
}

test('extractTicketDate recognizes RFC (NC), QR, and WFM (TK) ticket dates correctly', () => {
    const api = loadMeetingAttendance();

    // RFC: NC20260422002126 -> 2026-04-22
    const rfcDate = api.extractTicketDate('NC20260422002126');
    assert.ok(rfcDate);
    assert.equal(rfcDate.dateStr, '2026-04-22');
    assert.equal(rfcDate.year, 2026);
    assert.equal(rfcDate.month, 4);
    assert.equal(rfcDate.day, 22);

    // QR: QR20260804002864 -> 2026-08-04
    const qrDate = api.extractTicketDate('QR20260804002864');
    assert.ok(qrDate);
    assert.equal(qrDate.dateStr, '2026-08-04');
    assert.equal(qrDate.year, 2026);
    assert.equal(qrDate.month, 8);
    assert.equal(qrDate.day, 4);

    // WFM: TK20260804000905 -> 2026-08-04
    const wfmDate = api.extractTicketDate('TK20260804000905');
    assert.ok(wfmDate);
    assert.equal(wfmDate.dateStr, '2026-08-04');
    assert.equal(wfmDate.year, 2026);
    assert.equal(wfmDate.month, 8);
    assert.equal(wfmDate.day, 4);

    // Standard date delimiter in ticket or fallback
    const delimited = api.extractTicketDate('INC-2026-05-15-999');
    assert.ok(delimited);
    assert.equal(delimited.dateStr, '2026-05-15');

    // Fallback to create time string if ticket has no date
    const fallback = api.extractTicketDate('SIMPLE_TICKET_NO_DATE', '2026-07-20 14:30:00');
    assert.ok(fallback);
    assert.equal(fallback.dateStr, '2026-07-20');
    assert.equal(fallback.source, 'create_time');
});

test('attendance verification window filters out older orders and keeps in-window orders', () => {
    const api = loadMeetingAttendance();
    const { state } = api;

    // Meeting is on 2026-08-05
    state.attendanceRules.meetingDate = '2026-08-05';
    state.attendanceRules.orderWindowMonths = 1; // Default 1 month

    const range = api.getWindowDateRange('2026-08-05', 1);
    assert.equal(range.startDateStr, '2026-07-05');
    assert.equal(range.endDateStr, '2026-08-05');

    // In-window ticket (2026-08-04)
    const inDate = api.extractTicketDate('QR20260804002864');
    assert.equal(api.isOrderInWindow(inDate, range), true);

    // Out-of-window ticket (2026-04-22, >1 month prior)
    const outDate = api.extractTicketDate('NC20260422002126');
    assert.equal(api.isOrderInWindow(outDate, range), false);

    // Set up sheets:
    // Sheet 1: RFC sheet with Engineer A having only old order NC20260422002126
    // Sheet 2: QR sheet with Engineer B having recent order QR20260804002864
    state.sheets = [
        {
            id: 's1',
            category: 'rfc',
            fileName: 'RFC_List.xlsx',
            headers: ['建单人/Originator', 'BU', '客户群/Customer Group', '作业单号/Ticket ID', '创建时间/Create Time'],
            rows: [
                ['EngineerA a1111111', 'Cloud BU', 'Core-Network', 'NC20260422002126', '2026-04-22 10:00:00']
            ]
        },
        {
            id: 's2',
            category: 'qr',
            fileName: 'QR_List.xlsx',
            headers: ['Apply Fullname', 'Apply Accountid', 'BU', 'Customer Group', 'Task ID', 'Create Time'],
            rows: [
                ['EngineerB', 'b2222222', 'Core BU', 'Radio-Net', 'QR20260804002864', '2026-08-04 11:00:00']
            ]
        },
        {
            id: 's3',
            category: 'offline',
            fileName: 'Meeting_2026-08-05.xlsx',
            headers: ['工号', '姓名', 'BU', '签到时间'],
            rows: [
                ['b2222222', 'EngineerB', 'Core BU', '2026-08-05 09:00:00']
            ]
        }
    ];

    // Under 1-month window: Engineer A (order from April) is excluded! Only Engineer B is required.
    const people1M = api.extractAllPeople();
    assert.equal(people1M.length, 1);
    assert.equal(people1M[0].account, 'b2222222');
    assert.equal(people1M[0].attendance, 'Attend on Time');

    // Now change window to 6 months: Engineer A is now within window and required!
    state.attendanceRules.orderWindowMonths = 6;
    api.invalidatePeopleCache();
    const people6M = api.extractAllPeople();
    assert.equal(people6M.length, 2);
    const names = people6M.map(p => p.account);
    assert.ok(names.includes('a1111111'));
    assert.ok(names.includes('b2222222'));

    // Engineer A didn't sign in on 2026-08-05 -> Absent
    const engineerA = people6M.find(p => p.account === 'a1111111');
    assert.equal(engineerA.attendance, 'Absent');
});

test('night-before WFM engineers are exempt, granted Attend on Time with 前夜WFM豁免', () => {
    const api = loadMeetingAttendance();
    const { state } = api;

    // Meeting is on 2026-08-05
    state.attendanceRules.meetingDate = '2026-08-05';
    state.attendanceRules.orderWindowMonths = 1;
    state.attendanceRules.nightWfmExempt = true;

    // Previous day: 2026-08-04
    assert.equal(api.getPreviousDayDateString('2026-08-05'), '2026-08-04');

    // WFM row on 2026-08-04 at 23:00 (Night shift before meeting)
    const wfmSheet = {
        id: 'wfm1',
        category: 'wfm',
        fileName: 'WFM_Tasks.xlsx',
        headers: ['实施任务单号', '创建时间', '实施人/Operator', 'BU', '客户群/Customer Group', '任务结束时间'],
        rows: [
            ['TK20260804000905', '2026-08-04 22:30:00', 'NightEngineer n8888888', 'Network BU', 'Bank-A', '2026-08-05 03:00:00']
        ]
    };

    const isNight = api.isNightWfmTask(wfmSheet, wfmSheet.rows[0], '2026-08-05');
    assert.equal(isNight.isNight, true);

    state.sheets = [
        wfmSheet,
        {
            id: 'off1',
            category: 'offline',
            fileName: 'Attendance_2026-08-05.xlsx',
            headers: ['工号', '姓名', 'BU', '签到时间'],
            rows: [
                // NightEngineer is NOT in sign-in list!
            ]
        }
    ];

    const people = api.extractAllPeople();
    assert.equal(people.length, 1);
    const p = people[0];
    assert.equal(p.account, 'n8888888');
    assert.equal(p.isNightWfmExempt, true);
    assert.equal(p.attendance, 'Attend on Time');
    assert.equal(p.attendanceMethod, '前夜WFM豁免');

    // Multi-session check
    state.sheets.push({
        id: 'off2',
        category: 'offline',
        fileName: 'Attendance_Afternoon_2026-08-05.xlsx',
        sessionName: '下午场',
        headers: ['工号', '姓名', 'BU', '签到时间'],
        rows: []
    });
    wfmSheet.sessionName = '上午场';

    api.invalidatePeopleCache();
    return api.ensurePeopleCache().then(cache => {
        assert.ok(cache.sessions.length >= 1);
        const engineerInCache = cache.all.find(x => x.account === 'n8888888');
        assert.ok(engineerInCache);
        assert.equal(engineerInCache.attendance, 'Attend on Time');
        assert.equal(engineerInCache.attendanceMethod, '前夜WFM豁免');
    });
});

test('manual mandatory attendees list (其他必选参会名单) correctly forces requirement and persists in snapshots', async () => {
    const api = loadMeetingAttendance();
    const { state } = api;

    state.attendanceRules.meetingDate = '2026-08-05';
    state.attendanceRules.orderWindowMonths = 1;

    // Normal sheet has only EngineerB
    state.sheets = [
        {
            id: 'qr1',
            category: 'qr',
            fileName: 'QR.xlsx',
            headers: ['Apply Fullname', 'Apply Accountid', 'BU', 'Customer Group', 'Task ID', 'Create Time'],
            rows: [
                ['EngineerB', 'b2222222', 'Core BU', 'Radio-Net', 'QR20260804002864', '2026-08-04 11:00:00']
            ]
        },
        {
            id: 'off1',
            category: 'offline',
            fileName: 'Attendance_2026-08-05.xlsx',
            headers: ['工号', '姓名', 'BU', '签到时间'],
            rows: [
                ['m9999999', 'MandatoryLeader', 'Management', '2026-08-05 08:50:00'] // MandatoryLeader signed in on time
            ]
        }
    ];

    // Add MandatoryLeader to mandatory attendees list (has NO RFC/QR/WFM tickets)
    state.mandatoryAttendees = [
        { name: 'MandatoryLeader', account: 'm9999999', role: '质量总监', bu: '管理部', customer: '重点保障', note: '特邀督导' }
    ];

    const people = api.extractAllPeople();
    assert.equal(people.length, 2);

    const leader = people.find(p => p.account === 'm9999999');
    assert.ok(leader, 'Mandatory attendee should be included in people list');
    assert.equal(leader.isManualMandatory, true);
    assert.equal(leader.attendance, 'Attend on Time');
    assert.equal(leader.role, '质量总监');

    // Test batch paste text parsing
    const batchText = `
        c3333333 张三 专员 运营部 华东区
        李四 l4444444 组长 研发部 核心网络
    `;
    const parsedEntries = api.normalizeMandatoryEntries([
        { account: 'c3333333', name: '张三', role: '专员', bu: '运营部', customer: '华东区' },
        { account: 'l4444444', name: '李四', role: '组长', bu: '研发部', customer: '核心网络' }
    ]);
    assert.equal(parsedEntries.length, 2);
    assert.equal(parsedEntries[0].account, 'c3333333');
    assert.equal(parsedEntries[1].account, 'l4444444');

    // Test snapshot persistence and restoration
    const snapshot = await api.buildSnapshotPayload('测试快照', '2026-08-05');
    assert.ok(snapshot.payload.mandatoryAttendees);
    assert.equal(snapshot.payload.mandatoryAttendees.length, 1);
    assert.equal(snapshot.payload.mandatoryAttendees[0].account, 'm9999999');
    assert.equal(snapshot.payload.attendanceRules.orderWindowMonths, 1);

    // Clear state
    state.mandatoryAttendees = [];
    state.sheets = [];
    api.invalidatePeopleCache();

    // Restore from snapshot
    api.restoreMeetingSnapshot(snapshot);
    assert.equal(state.mandatoryAttendees.length, 1);
    assert.equal(state.mandatoryAttendees[0].account, 'm9999999');
    assert.equal(state.attendanceRules.orderWindowMonths, 1);
});
