const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadMeetingAttendance(minSessionRecords = 1) {
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
        setAttribute: () => {},
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
    const api = sandbox.window.__meetingAttendance;
    if (minSessionRecords !== null) api.state.attendanceRules.minSessionRecords = minSessionRecords;
    return api;
}

test('extractTicketDate recognizes RFC (NC/NE), QR, and WFM (TK/TE) ticket dates correctly', () => {
    const api = loadMeetingAttendance();

    // RFC: NC20260422002126 -> 2026-04-22
    const rfcDate = api.extractTicketDate('NC20260422002126');
    assert.ok(rfcDate);
    assert.equal(rfcDate.dateStr, '2026-04-22');
    assert.equal(rfcDate.year, 2026);
    assert.equal(rfcDate.month, 4);
    assert.equal(rfcDate.day, 22);
    assert.equal(api.extractTicketDate('NE20260423002126').dateStr, '2026-04-23');

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
    assert.equal(api.extractTicketDate('TE20260805000905').dateStr, '2026-08-05');

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

test('multiple meeting dates use separate order windows and ignore a saved fallback date', () => {
    const api = loadMeetingAttendance();
    api.state.attendanceRules.meetingDate = '2026-01-01';
    api.state.attendanceRules.orderWindowMonths = 1;
    api.state.sheets = [
        { id: 'early', category: 'offline', sessionName: 'Early', fileName: 'early.xlsx', headers: ['工号', '签到时间'], rows: [['a1111111', '2026-03-01 09:00:00']] },
        { id: 'late', category: 'offline', sessionName: 'Late', fileName: 'late.xlsx', headers: ['工号', '签到时间'], rows: [['b2222222', '2026-08-01 09:00:00']] },
        { id: 'qr', category: 'qr', fileName: 'orders.xlsx', headers: ['Apply Fullname', 'Apply Accountid', 'Task ID', 'Create Time'], rows: [
            ['Between meetings', 'c3333333', 'QR20260501000001', '2026-05-01 10:00:00'],
            ['Before late meeting', 'd4444444', 'QR20260715000001', '2026-07-15 10:00:00']
        ] }
    ];

    assert.equal(api.detectMeetingDate('Early'), '2026-03-01');
    assert.equal(api.detectMeetingDate('Late'), '2026-08-01');
    assert.equal(api.getAllMeetingDates().join(','), '2026-03-01,2026-08-01');
    assert.equal(api.isOrderInMeetingWindows(api.extractTicketDate('QR20260501000001'), api.getAllMeetingDates(), 1), false);
    assert.equal(api.isOrderInMeetingWindows(api.extractTicketDate('QR20260715000001'), api.getAllMeetingDates(), 1), true);
    const people = api.extractAllPeople();
    assert.equal(people.some(person => person.account === 'c3333333'), false);
    assert.equal(people.some(person => person.account === 'd4444444'), true);

    api.state.sheets = api.state.sheets.filter(sheet => sheet.category === 'qr');
    assert.equal(api.getAllMeetingDates().join(','), '2026-01-01');
});

test('night-before WFM engineers are exempt, granted Attend on Time with 前夜WFM豁免', () => {
    const api = loadMeetingAttendance(0);
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
    assert.equal(p.attendanceTime, '', 'WFM task time must not appear as a meeting scan time');

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
        assert.equal(engineerInCache.attendanceTime, '');
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

test('refresh after import keeps per-session requirements and applies saved and preset exemptions', async () => {
    const api = loadMeetingAttendance();
    const { state } = api;
    state.attendanceRules.orderWindowMonths = 1;
    state.sheets = [
        { id: 'qr', category: 'qr', fileName: 'QR.xlsx', sheetName: 'Sheet1',
          headers: ['Task ID', 'Create Time', 'Apply Fullname', 'Apply Accountid', 'BU'],
          rows: [
              ['QR20260727A', '', 'liqiyan', 'U10001', 'NIS'],
              ['QR20260727B', '', 'Alice', 'U10002', 'NIS']
          ] },
        { id: 'july', category: 'online', fileName: 'July.xlsx', sheetName: 'Join',
          headers: ['meeting_title', 'user_id', 'join_time'], rows: [['July meeting', 'U99991', '2026-07-28 09:00:00']] },
        { id: 'august', category: 'online', fileName: 'August.xlsx', sheetName: 'Join',
          headers: ['meeting_title', 'user_id', 'join_time'], rows: [['August meeting', 'U99992', '2026-08-05 09:00:00']] }
    ];
    const before = await api.ensurePeopleCache();
    assert.equal(before.sessions.length, 2);
    assert.equal(before.all.length, 2);

    state.mandatoryAttendees = [{ name: 'Manual', account: 'U10003', bu: 'NIS' }];
    state.exemptions = [{ name: 'Alice', account: 'U10002' }];
    assert.equal(await api.refreshCalculatedResults('Refreshing'), true);

    const after = state.peopleCache;
    assert.equal(after.all.length, 3);
    for (const session of after.sessions) {
        const records = after.all.map(person => person.sessionRecords?.[session.name]);
        assert.ok(records.every(record => record?.required), 'the refreshed list must retain each session requirement');
        assert.equal(after.sessionStats[session.name].total, 3);
        assert.equal(api.getSessionPeopleRows(after.all, session.name).length, 3);
    }
    const preset = after.all.find(person => person.account === 'U10001');
    const saved = after.all.find(person => person.account === 'U10002');
    const manual = after.all.find(person => person.account === 'U10003');
    assert.ok(preset && saved && manual);
    assert.ok(after.sessions.every(session => preset.sessionRecords[session.name].attendanceMethod === '豁免名单'));
    assert.ok(after.sessions.every(session => saved.sessionRecords[session.name].attendanceMethod === '豁免名单'));
    assert.ok(after.sessions.every(session => manual.sessionRecords[session.name].attendance === 'Absent'));
    assert.equal(manual.requiredSessionsCount, 2);
});

test('multi-session imports correctly handle spanning window, per-session night WFM exemption, and mandatory attendees', async () => {
    const api = loadMeetingAttendance();
    const { state } = api;

    // Multi-day sessions: Session 1 on 2026-08-01, Session 2 on 2026-08-05
    state.attendanceRules.meetingDate = '';
    state.attendanceRules.orderWindowMonths = 1;
    state.attendanceRules.nightWfmExempt = true;

    state.sheets = [
        {
            id: 'qr1',
            category: 'qr',
            fileName: 'QR_Orders.xlsx',
            headers: ['Apply Fullname', 'Apply Accountid', 'BU', 'Customer Group', 'Task ID', 'Create Time'],
            rows: [
                ['Engineer Alpha', 'a1111111', 'Cloud BU', 'Core-Network', 'QR20260715001234', '2026-07-15 10:00:00']
            ]
        },
        {
            id: 'wfm1',
            category: 'wfm',
            fileName: 'WFM_Tasks.xlsx',
            headers: ['实施任务单号', '创建时间', '实施人/Operator', 'BU', '客户群/Customer Group', '任务结束时间'],
            rows: [
                ['TK20260731000888', '2026-07-31 23:15:00', 'Engineer NightBeta b2222222', 'Core BU', 'Bank-Net', '2026-08-01 02:00:00']
            ]
        },
        {
            id: 'off_sess1',
            category: 'offline',
            fileName: 'Meeting_2026-08-01_Session1.xlsx',
            sessionName: '8月1日例会',
            headers: ['工号', '姓名', 'BU', '签到时间'],
            rows: [
                ['a1111111', 'Engineer Alpha', 'Cloud BU', '2026-08-01 08:50:00']
            ]
        },
        {
            id: 'off_sess2',
            category: 'offline',
            fileName: 'Meeting_2026-08-05_Session2.xlsx',
            sessionName: '8月5日例会',
            headers: ['工号', '姓名', 'BU', '签到时间'],
            rows: [
                ['g3333333', 'Engineer MandatoryGamma', 'Management', '2026-08-05 08:55:00']
            ]
        }
    ];

    state.mandatoryAttendees = [
        { name: 'Engineer MandatoryGamma', account: 'g3333333', role: '质量督导', bu: '管理部', customer: '重点保障' }
    ];

    // Check detected meeting dates
    const allDates = api.getAllMeetingDates();
    assert.equal([...allDates].sort().join(','), '2026-08-01,2026-08-05');

    // Check window spans from 1 month before 2026-08-01 to 2026-08-05
    const windowRange = api.getWindowDateRange(allDates, 1);
    assert.equal(windowRange.startDateStr, '2026-07-01');
    assert.equal(windowRange.endDateStr, '2026-08-05');

    // Run cache calculation
    api.invalidatePeopleCache();
    const cache = await api.ensurePeopleCache();
    assert.equal(cache.sessions.length, 2);

    // Verify all 3 engineers are in the list
    assert.equal(cache.all.length, 3);
    const alpha = cache.all.find(p => p.account === 'a1111111');
    const beta = cache.all.find(p => p.account === 'b2222222');
    const gamma = cache.all.find(p => p.account === 'g3333333');

    assert.ok(alpha, 'Alpha should be present');
    assert.ok(beta, 'NightBeta should be present');
    assert.ok(gamma, 'MandatoryGamma should be present');

    // Alpha: Attended Sess 1, Absent from Sess 2
    assert.equal(alpha.sessionRecords['8月1日例会'].attendance, 'Attend on Time');
    assert.equal(alpha.sessionRecords['8月5日例会'].attendance, 'Absent');
    assert.equal(alpha.multiSessionStatusTag, 'partial');

    // NightBeta: Night shift before 2026-08-01 -> Exempt in Sess 1!
    // But NOT night shift before 2026-08-05 -> Absent in Sess 2!
    assert.equal(beta.sessionRecords['8月1日例会'].attendance, 'Attend on Time');
    assert.equal(beta.sessionRecords['8月1日例会'].attendanceMethod, '前夜WFM豁免');
    assert.equal(beta.sessionRecords['8月5日例会'].attendance, 'Absent');
    assert.equal(beta.multiSessionStatusTag, 'partial');

    // MandatoryGamma: Marked mandatory, Absent from Sess 1, Attended Sess 2
    assert.equal(gamma.isManualMandatory, true);
    assert.equal(gamma.sessionRecords['8月1日例会'].attendance, 'Absent');
    assert.equal(gamma.sessionRecords['8月5日例会'].attendance, 'Attend on Time');
    assert.equal(gamma.multiSessionStatusTag, 'partial');

    // Single session view drilldown
    const sess1Rows = api.getSessionPeopleRows(cache.all, '8月1日例会');
    const betaInSess1 = sess1Rows.find(p => p.account === 'b2222222');
    assert.equal(betaInSess1.attendance, 'Attend on Time');
    assert.equal(betaInSess1.attendanceMethod, '前夜WFM豁免');

    const sess2Rows = api.getSessionPeopleRows(cache.all, '8月5日例会');
    const betaInSess2 = sess2Rows.find(p => p.account === 'b2222222');
    assert.equal(betaInSess2.attendance, 'Absent');

    // Test Same-Day Multi-Session (Morning + Afternoon)
    state.sheets = [
        {
            id: 'wfm2',
            category: 'wfm',
            fileName: 'WFM_Tasks.xlsx',
            headers: ['实施任务单号', '创建时间', '实施人/Operator', 'BU', '客户群/Customer Group', '任务结束时间'],
            rows: [
                ['TK20260804000905', '2026-08-04 22:30:00', 'NightEngineer n8888888', 'Network BU', 'Bank-A', '2026-08-05 03:00:00']
            ]
        },
        {
            id: 'off_am',
            category: 'offline',
            fileName: 'Meeting_2026-08-05_AM.xlsx',
            sessionName: '2026-08-05 上午场',
            headers: ['工号', '姓名', 'BU', '签到时间'],
            rows: []
        },
        {
            id: 'off_pm',
            category: 'offline',
            fileName: 'Meeting_2026-08-05_PM.xlsx',
            sessionName: '2026-08-05 下午场',
            headers: ['工号', '姓名', 'BU', '签到时间'],
            rows: []
        }
    ];
    state.mandatoryAttendees = [];
    state.attendanceRules.minSessionRecords = 0;

    api.invalidatePeopleCache();
    const sameDayCache = await api.ensurePeopleCache();
    assert.equal(sameDayCache.sessions.length, 2);
    const nightEng = sameDayCache.all.find(p => p.account === 'n8888888');
    assert.ok(nightEng);
    // Since both sessions are on 2026-08-05, Night WFM on 2026-08-04 grants exemption for BOTH sessions!
    assert.equal(nightEng.sessionRecords['2026-08-05 上午场'].attendance, 'Attend on Time');
    assert.equal(nightEng.sessionRecords['2026-08-05 上午场'].attendanceMethod, '前夜WFM豁免');
    assert.equal(nightEng.sessionRecords['2026-08-05 下午场'].attendance, 'Attend on Time');
    assert.equal(nightEng.sessionRecords['2026-08-05 下午场'].attendanceMethod, '前夜WFM豁免');
    assert.equal(nightEng.multiSessionStatusTag, 'full-ontime');

    // Check Excel export analysis tables output
    const tables = api.buildAnalysisTables();
    assert.ok(tables.multiMatrix);
    const matrixRow = tables.multiMatrix.find(r => r[1] === 'n8888888');
    assert.ok(matrixRow);
    assert.ok(matrixRow[4].includes('(Night WFM Exempt)'));
    assert.ok(matrixRow[5].includes('(Night WFM Exempt)'));
});

test('identifies fake attendance for check-ins after cutoff time or on subsequent days within a session sheet', async () => {
    const api = loadMeetingAttendance(1);
    const state = api.state;

    // Meeting session on 2026-08-05
    // onTime: 09:00, fake: 10:00
    state.attendanceRules = {
        onTime: '09:00',
        fake: '10:00',
        minSessionRecords: 1
    };

    state.sheets = [
        {
            id: 'rfc1',
            category: 'rfc',
            fileName: 'RFC_Orders.xlsx',
            headers: ['作业单号/Ticket ID', '创建时间/Create Time', '建单人/Originator', '实施人', 'BU', '客户群'],
            rows: [
                ['NC20260804000001', '2026-08-04 10:00:00', 'Alice a1111111', 'Alice a1111111', 'BU-1', 'Group-A'],
                ['NC20260804000002', '2026-08-04 10:00:00', 'Bob b2222222', 'Bob b2222222', 'BU-1', 'Group-A'],
                ['NC20260804000003', '2026-08-04 10:00:00', 'Charlie c3333333', 'Charlie c3333333', 'BU-1', 'Group-A'],
                ['NC20260804000004', '2026-08-04 10:00:00', 'David d4444444', 'David d4444444', 'BU-1', 'Group-A'],
                ['NC20260804000005', '2026-08-04 10:00:00', 'Eva e5555555', 'Eva e5555555', 'BU-1', 'Group-A']
            ]
        },
        {
            id: 'offline_meeting',
            category: 'offline',
            fileName: '2026-08-05_安全生产例会签到.xlsx',
            headers: ['工号', '姓名', '签到时间', 'BU'],
            rows: [
                // Alice: on time (BJT 13:55 -> Cairo 08:55 <= 09:00)
                ['a1111111', 'Alice', '2026-08-05 13:55:00', 'BU-1'],
                // Bob: delay (BJT 14:15 -> Cairo 09:15 between 09:00 and 10:00)
                ['b2222222', 'Bob', '2026-08-05 14:15:00', 'BU-1'],
                // Charlie: fake attendance on same day after cutoff (BJT 15:20 -> Cairo 10:20 >= 10:00)
                ['c3333333', 'Charlie', '2026-08-05 15:20:00', 'BU-1'],
                // David: fake attendance on subsequent day (BJT 2026-08-06 13:30 -> Cairo 2026-08-06 08:30 - early morning, but next day!)
                ['d4444444', 'David', '2026-08-06 13:30:00', 'BU-1'],
                // Eva: checked in twice: on-time (13:50) and next day (13:30) - should retain Attend on Time
                ['e5555555', 'Eva', '2026-08-05 13:50:00', 'BU-1'],
                ['e5555555', 'Eva', '2026-08-06 13:30:00', 'BU-1']
            ]
        }
    ];

    api.invalidatePeopleCache();
    const cache = await api.ensurePeopleCache();

    // 1. Verify that the sheet rows are NOT fragmented into rogue sessions
    assert.equal(cache.sessions.length, 1, 'All rows in the sheet should remain in the single meeting session');

    // 2. Verify attendance resolution for each person in single session
    const people = cache.all;
    const alice = people.find(p => p.account === 'a1111111');
    const bob = people.find(p => p.account === 'b2222222');
    const charlie = people.find(p => p.account === 'c3333333');
    const david = people.find(p => p.account === 'd4444444');
    const eva = people.find(p => p.account === 'e5555555');

    assert.equal(alice.attendance, 'Attend on Time', 'Alice checked in before 09:00 on meeting day');
    assert.equal(bob.attendance, 'Delay', 'Bob checked in between 09:00 and 10:00 on meeting day');
    assert.equal(charlie.attendance, 'Fake Attendance', 'Charlie checked in after 10:00 cutoff on meeting day');
    assert.equal(david.attendance, 'Fake Attendance', 'David checked in on the next day (2026-08-06)');
    assert.equal(eva.attendance, 'Attend on Time', 'Eva has both on-time and late check-in, best status wins');

    // 3. Now add a second meeting session on 2026-08-12 and verify multi-session handling
    state.sheets.push({
        id: 'offline_meeting_2',
        category: 'offline',
        fileName: '2026-08-12_第二场安全例会.xlsx',
        sessionName: '2026-08-12_第二场安全例会',
        headers: ['工号', '姓名', '签到时间', 'BU'],
        rows: [
            // Alice attended on time for session 2
            ['a1111111', 'Alice', '2026-08-12 13:50:00', 'BU-1'],
            // David attended on time for session 2 (even though he had fake attendance in session 1)
            ['d4444444', 'David', '2026-08-12 13:55:00', 'BU-1'],
            // Charlie checked in 2 days late for session 2 -> Fake Attendance
            ['c3333333', 'Charlie', '2026-08-14 13:50:00', 'BU-1']
        ]
    });

    api.invalidatePeopleCache();
    const multiCache = await api.ensurePeopleCache();
    assert.equal(multiCache.sessions.length, 2);

    const mAlice = multiCache.all.find(p => p.account === 'a1111111');
    const mBob = multiCache.all.find(p => p.account === 'b2222222');
    const mCharlie = multiCache.all.find(p => p.account === 'c3333333');
    const mDavid = multiCache.all.find(p => p.account === 'd4444444');
    const mEva = multiCache.all.find(p => p.account === 'e5555555');

    const sess1Name = multiCache.sessions[0].name;
    const sess2Name = multiCache.sessions[1].name;

    // Check Session 1 records
    assert.equal(mAlice.sessionRecords[sess1Name].attendance, 'Attend on Time');
    assert.equal(mBob.sessionRecords[sess1Name].attendance, 'Delay');
    assert.equal(mCharlie.sessionRecords[sess1Name].attendance, 'Fake Attendance');
    assert.equal(mDavid.sessionRecords[sess1Name].attendance, 'Fake Attendance');
    assert.equal(mEva.sessionRecords[sess1Name].attendance, 'Attend on Time');

    // Check Session 2 records
    assert.equal(mAlice.sessionRecords[sess2Name].attendance, 'Attend on Time');
    assert.equal(mDavid.sessionRecords[sess2Name].attendance, 'Attend on Time');
    assert.equal(mCharlie.sessionRecords[sess2Name].attendance, 'Fake Attendance');
    assert.equal(mBob.sessionRecords[sess2Name].attendance, 'Absent');
});

test('multi-session matrix card supports toggle fullscreen view and exit fullscreen view', async () => {
    const api = loadMeetingAttendance(1);
    const state = api.state;

    state.sheets = [
        {
            id: 'rfc1',
            category: 'rfc',
            fileName: 'RFC_Orders.xlsx',
            headers: ['作业单号/Ticket ID', '创建时间/Create Time', '建单人/Originator', '实施人', 'BU', '客户群'],
            rows: [
                ['NC20260804000001', '2026-08-04 10:00:00', 'Alice a1111111', 'Alice a1111111', 'BU-1', 'Group-A']
            ]
        },
        {
            id: 'offline_1',
            category: 'offline',
            fileName: 'Meeting_1.xlsx',
            sessionName: '第1场例会',
            headers: ['工号', '姓名', '签到时间', 'BU'],
            rows: [['a1111111', 'Alice', '2026-08-05 13:55:00', 'BU-1']]
        },
        {
            id: 'offline_2',
            category: 'offline',
            fileName: 'Meeting_2.xlsx',
            sessionName: '第2场例会',
            headers: ['工号', '姓名', '签到时间', 'BU'],
            rows: [['a1111111', 'Alice', '2026-08-12 13:55:00', 'BU-1']]
        }
    ];

    api.invalidatePeopleCache();
    const cache = await api.ensurePeopleCache();
    assert.equal(cache.sessions.length, 2);

    // Initial render HTML
    assert.equal(state.matrixFullscreen, false);
    const initialHtml = api.renderMultiSessionMatrixCard(cache.sessions, cache.all);
    assert.match(initialHtml, /id="multiSessionMatrixCard"/);
    assert.match(initialHtml, /data-action="toggle-matrix-fullscreen"/);
    assert.match(initialHtml, /全屏查看/);
    assert.doesNotMatch(initialHtml, /is-fullscreen/);

    // Toggle fullscreen to ON
    const isFsNow = api.toggleMatrixFullscreen();
    assert.equal(isFsNow, true);
    assert.equal(state.matrixFullscreen, true);

    // Rerender matrix card in fullscreen mode
    const fsHtml = api.renderMultiSessionMatrixCard(cache.sessions, cache.all);
    assert.match(fsHtml, /is-fullscreen/);
    assert.match(fsHtml, /退出全屏/);

    // Toggle fullscreen to OFF
    const isFsOff = api.toggleMatrixFullscreen();
    assert.equal(isFsOff, false);
    assert.equal(state.matrixFullscreen, false);

    const normalHtml = api.renderMultiSessionMatrixCard(cache.sessions, cache.all);
    assert.doesNotMatch(normalHtml, /is-fullscreen/);
    assert.match(normalHtml, /全屏查看/);

    // Force toggleMatrixFullscreen with boolean argument
    api.toggleMatrixFullscreen(true);
    assert.equal(state.matrixFullscreen, true);
    api.toggleMatrixFullscreen(false);
    assert.equal(state.matrixFullscreen, false);
});

test('multi-session export includes Meeting Session column and aligns per-session attendance evaluation without false fake attendance', async () => {
    const api = loadMeetingAttendance(1);
    const state = api.state;

    // Session 1 on 2026-08-01, Session 2 on 2026-08-05
    state.attendanceRules = {
        onTime: '09:00',
        fake: '10:00',
        minSessionRecords: 1,
        orderWindowMonths: 1
    };

    state.sheets = [
        {
            id: 'rfc',
            category: 'rfc',
            fileName: 'RFC.xlsx',
            sheetName: 'Sheet1',
            headers: ['作业单号/Ticket ID', '创建时间/Create Time', '申请人账号/Apply Account', '处理人/Handler', 'BU'],
            rows: [
                ['NC20260725000001', '2026-07-25 08:00:00', 'u_alice', 'Alice', 'BU-Alpha'],
                ['NC20260728000002', '2026-07-28 08:00:00', 'u_bob', 'Bob', 'BU-Beta'],
                ['NC20260802000003', '2026-08-02 08:00:00', 'u_charlie', 'Charlie', 'BU-Gamma'] // Charlie only in window for Session 2
            ]
        },
        {
            id: 'offline_1',
            category: 'offline',
            fileName: '2026-08-01_现场签到.xlsx',
            sheetName: 'Sheet1',
            headers: ['工号', '姓名', '签到时间', 'BU'],
            rows: [
                ['u_alice', 'Alice', '2026-08-01 13:45:00', 'BU-Alpha'],
                ['u_bob', 'Bob', '2026-08-01 16:30:00', 'BU-Beta'] // 16:30 Beijing -> 11:30 Cairo (>= 10:00 Fake Attendance)
            ]
        },
        {
            id: 'offline_2',
            category: 'offline',
            fileName: '2026-08-05_现场签到.xlsx',
            sheetName: 'Sheet1',
            headers: ['工号', '姓名', '签到时间', 'BU'],
            rows: [
                ['u_alice', 'Alice', '2026-08-05 13:50:00', 'BU-Alpha'], // 13:50 Beijing -> 08:50 Cairo (Attend on Time)
                ['u_charlie', 'Charlie', '2026-08-05 13:55:00', 'BU-Gamma'] // 13:55 Beijing -> 08:55 Cairo (Attend on Time)
            ]
        }
    ];

    const cache = await api.ensurePeopleCache();
    assert.equal(cache.sessions.length, 2);

    // 1. Verify UI functions: BU table has Total People column and alternating classes
    const buTableHtml = api.renderMultiSessionBuTable(cache.sessions, cache.all);
    assert.match(buTableHtml, /涉及参会总人数/);
    assert.match(buTableHtml, /session-col-alt/);
    assert.match(buTableHtml, /session-col-end/);

    // 2. Verify matrix card has alternating session classes
    const matrixHtml = api.renderMultiSessionMatrixCard(cache.sessions, cache.all);
    assert.match(matrixHtml, /session-col-alt/);
    assert.match(matrixHtml, /session-col-end/);

    // 3. Verify Excel export tables
    state.selectedSession = 'all';
    const tables = api.buildAnalysisTables(cache.all);
    assert.ok(tables.summary);
    assert.ok(tables.people);
    assert.ok(tables.multiMatrix);

    // Verify Summary Sheet headers and Meeting Session column
    assert.deepEqual(Array.from(tables.summary[0]), ['Meeting Session', 'BU', 'Total People', 'Absent', 'Attend on Time', 'Delay', 'Fake Attendance', 'On-time Attendance Rate']);

    // Verify People Sheet headers
    assert.deepEqual(Array.from(tables.people[0]), ['Meeting Session', 'Name', 'Employee ID / Account', 'BU', 'Customer Group', 'Attendance Status', 'Check-in / Join Time (Cairo)', 'Decision Source', 'Related Records']);

    // In Session 2, Charlie attended on 2026-08-05 on time.
    // Charlie MUST NOT be marked as Fake Attendance in Session 2 export!
    const sess2Charlie = tables.people.find(r => r[0].includes('2026-08-05') && r[2] === 'u_charlie');
    assert.ok(sess2Charlie, 'Charlie must appear in Session 2 exported people list');
    assert.equal(sess2Charlie[5], 'Attend on Time', 'Charlie must be Attend on Time, NOT Fake Attendance');

    // Bob in Session 1 checked in at 10:30 (after 10:00 cutoff) -> Fake Attendance
    const sess1Bob = tables.people.find(r => r[0].includes('2026-08-01') && r[2] === 'u_bob');
    assert.ok(sess1Bob);
    assert.equal(sess1Bob[5], 'Fake Attendance');

    // Alice attended Session 2 on time on 2026-08-05.
    // In old code, Alice's check-in date 08-05 was after Session 1 (08-01), causing false Fake Attendance.
    // In new code, Alice MUST be Attend on Time in Session 2!
    const sess2Alice = tables.people.find(r => r[0].includes('2026-08-05') && r[2] === 'u_alice');
    assert.ok(sess2Alice);
    assert.equal(sess2Alice[5], 'Attend on Time');

    // Verify sticky header in coverage table css
    const fs = require('fs');
    const path = require('path');
    const htmlContent = fs.readFileSync(path.join(__dirname, '../backend/builtin-tools/tool-msf5b7nn/index.html'), 'utf8');
    assert.match(htmlContent, /\.coverage-table thead th\s*\{[^}]*position:\s*sticky/);
});




