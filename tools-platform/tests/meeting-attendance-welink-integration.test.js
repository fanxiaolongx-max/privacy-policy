const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadMeetingAttendance(minSessionRecords = 1, extraSandbox = {}) {
    const htmlPath = path.resolve(__dirname, '../backend/builtin-tools/tool-msf5b7nn/index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
    assert.ok(scriptMatch, 'Script block should exist in index.html');
    const scriptContent = scriptMatch[1];

    const mockStorage = extraSandbox.mockStorage || new Map();
    const mockLocalStorage = extraSandbox.localStorage || {
        getItem: key => mockStorage.get(key) || null,
        setItem: (key, val) => mockStorage.set(key, String(val)),
        removeItem: key => mockStorage.delete(key),
        clear: () => mockStorage.clear()
    };
    const mockSessionStorage = extraSandbox.sessionStorage || {
        getItem: key => mockStorage.get('session:' + key) || null,
        setItem: (key, val) => mockStorage.set('session:' + key, String(val)),
        removeItem: key => mockStorage.delete('session:' + key),
        clear: () => mockStorage.clear()
    };

    const mockElement = {
        classList: { toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false },
        querySelectorAll: () => [],
        querySelector: () => null,
        appendChild: () => {},
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
        window: {},
        ...extraSandbox
    };
    sandbox.window = sandbox;

    vm.createContext(sandbox);
    vm.runInContext(scriptContent, sandbox);
    const api = sandbox.window.__meetingAttendance;
    if (minSessionRecords !== null) api.state.attendanceRules.minSessionRecords = minSessionRecords;
    api._mockStorage = mockStorage;
    return api;
}

test('WeLink script generation targets current extracted roster IDs with PowerShell escaping and login check', () => {
    const api = loadMeetingAttendance();

    // Populate sheets with RFC, QR, and WFM
    api.state.sheets = [
        {
            id: 's_rfc',
            category: 'rfc',
            fileName: 'RFC_2026-08.xlsx',
            sheetName: 'RFC',
            headers: ['BU', 'Customer Group', 'Create Time', '建单人/Originator', 'Task ID'],
            rows: [
                ['Network BU', 'Cairo Net', '2026-08-01 10:00:00', 'Zhang San 00123456', 'NC202608010001']
            ]
        },
        {
            id: 's_qr',
            category: 'qr',
            fileName: 'QR_2026-08.xlsx',
            sheetName: 'QR',
            headers: ['BU', 'Customer Group', 'Create Time', 'Apply Fullname', 'Apply Accountid', 'Task ID'],
            rows: [
                ['IT BU', 'Egypt Org', '2026-08-02 11:00:00', 'Li Si', 'WX987654', 'QR202608020002']
            ]
        }
    ];

    api.state.mandatoryAttendees = [
        { name: 'Wang Wu', account: '00654321', bu: 'HQ', customer: 'All', role: 'Leader' }
    ];

    const ids = api.allExtractedPeopleIds();
    assert.ok(ids.includes('00123456'), 'Should extract RFC employee number');
    assert.ok(ids.includes('WX987654'), 'Should extract QR employee number');
    assert.ok(ids.includes('00654321'), 'Should extract mandatory attendee employee number');

    const script = api.buildWelinkScript(ids);
    assert.ok(script.startsWith('\ufeff'), 'Script should have UTF8-BOM');
    assert.ok(script.includes('welink-cli auth login'), 'Script should include login');
    assert.ok(script.includes('welink-cli search person --text "00123456"'), 'Script should query 00123456');
    assert.ok(script.includes('welink-cli search person --text "WX987654"'), 'Script should query WX987654');
    assert.ok(script.includes('welink-cli search person --text "00654321"'), 'Script should query 00654321');
    assert.ok(script.includes('$outputFile'), 'Script should define output file');
});

test('WeLink result parsing recognizes employee data, ID changes, and suspected departures', () => {
    const api = loadMeetingAttendance();

    const sampleCliOutput = `
welink-cli search person --text "00123456"
{
  "code": "200",
  "message": "success",
  "data": [
    {
      "employeeNumber": "WX123456",
      "chineseName": "张三",
      "englishName": "San Zhang",
      "deptName": "交付与服务部"
    }
  ]
}
welink-cli search person --text "00999999"
{
  "code": "200",
  "message": "success",
  "data": []
}
welink-cli search person --text "WX987654"
{
  "code": "200",
  "message": "success",
  "data": [
    {
      "employeeNumber": "WX987654",
      "chineseName": "李四",
      "englishName": "Si Li",
      "deptName": "云核心网产品线"
    }
  ]
}
`;

    const parsed = api.parseWelinkPeople(sampleCliOutput);
    assert.equal(parsed.length, 3, 'Should parse 3 blocks (2 active, 1 suspected departed)');

    // 00123456 -> WX123456
    const p1 = parsed.find(p => p.__queryEmpNo === '00123456');
    assert.ok(p1);
    assert.equal(p1.employeeNumber, 'WX123456');
    assert.equal(p1.chineseName, '张三');

    // 00999999 -> departed
    const p2 = parsed.find(p => p.__queryEmpNo === '00999999');
    assert.ok(p2);
    assert.equal(p2.__suspectedDeparted, true);

    // WX987654 -> unchanged
    const p3 = parsed.find(p => p.__queryEmpNo === 'WX987654');
    assert.ok(p3);
    assert.equal(p3.employeeNumber, 'WX987654');
    assert.equal(p3.chineseName, '李四');
});

test('installWelinkPeople establishes bidirectional alias clusters and persists to storage', () => {
    const api = loadMeetingAttendance();

    const welinkData = [
        {
            __queryEmpNo: '00123456',
            employeeNumber: 'WX123456',
            chineseName: '张三',
            deptName: '交付与服务部'
        }
    ];

    api.installWelinkPeople(welinkData, false);

    assert.equal(api.changedEmployeeId('00123456'), 'WX123456', '00123456 should map to changed ID WX123456');
    assert.equal(api.getCanonicalStaffId('00123456'), 'WX123456', 'Canonical staff ID of 00123456 should be WX123456');
    assert.equal(api.getCanonicalStaffId('WX123456'), 'WX123456', 'Canonical staff ID of WX123456 should be WX123456');

    // Transitive aliases
    const aliasesFromOld = [...api.getAllIdAliases('00123456')];
    assert.ok(aliasesFromOld.includes('00123456'));
    assert.ok(aliasesFromOld.includes('WX123456'));

    const aliasesFromNew = [...api.getAllIdAliases('WX123456')];
    assert.ok(aliasesFromNew.includes('00123456'));
    assert.ok(aliasesFromNew.includes('WX123456'));

    // Verify localStorage
    const saved = api.loadWelinkPeopleList();
    assert.equal(saved.length, 1);
    assert.equal(saved[0].employeeNumber, 'WX123456');
});

test('Roster deduplication: merges persons with old and new employee numbers into a single entry', () => {
    const api = loadMeetingAttendance();

    // Setup WeLink mapping: old 00123456 <-> new WX123456
    api.installWelinkPeople([
        {
            __queryEmpNo: '00123456',
            employeeNumber: 'WX123456',
            chineseName: '张三',
            deptName: '无线网络BU'
        }
    ], false);

    // RFC has old ID 00123456, WFM has new ID WX123456
    api.state.sheets = [
        {
            id: 's_rfc',
            category: 'rfc',
            fileName: 'RFC_Tasks.xlsx',
            sheetName: 'RFC',
            headers: ['BU', 'Customer Group', 'Create Time', '建单人/Originator', 'Task ID'],
            rows: [
                ['无线网络BU', 'Cairo VIP', '2026-08-01 09:00:00', '张三 00123456', 'NC202608010001']
            ]
        },
        {
            id: 's_wfm',
            category: 'wfm',
            fileName: 'WFM_Tasks.xlsx',
            sheetName: 'WFM',
            headers: ['BU', 'Customer Group', 'Task Create Time', '实施人/Operator', 'Task ID'],
            rows: [
                ['无线网络BU', 'Cairo VIP', '2026-08-02 10:00:00', '张三 WX123456', 'TK202608020002']
            ]
        }
    ];

    const allPeople = api.extractAllPeople();

    // Without mapping, this would produce 2 rows; with mapping, it must produce exactly 1 merged row!
    assert.equal(allPeople.length, 1, 'Persons with mapped old and new IDs must be merged into 1 row');
    const person = allPeople[0];
    assert.equal(person.name, '张三');
    assert.equal(person.count, 2, 'Task count should be combined across RFC and WFM');
    assert.equal(person.changedEmployeeId, 'WX123456', 'Should mark changedEmployeeId');
    assert.equal(person.oldEmployeeId, '00123456', 'Should mark oldEmployeeId');
    assert.ok(person.account.includes('WX123456'), 'Account should include new ID');
    assert.ok(person.account.includes('00123456'), 'Account should include old ID');
});

test('Attendance matching: check-in with new staff ID satisfies attendance for roster extracted with old staff ID', () => {
    const api = loadMeetingAttendance();

    // Roster has only old ID 00123456 from RFC
    api.state.sheets = [
        {
            id: 's_rfc',
            category: 'rfc',
            fileName: 'RFC_Tasks.xlsx',
            sheetName: 'RFC',
            headers: ['BU', 'Customer Group', 'Create Time', '建单人/Originator', 'Task ID'],
            rows: [
                ['交付BU', 'Alexandria', '2026-08-10 10:00:00', '张三 00123456', 'NC202608100001']
            ]
        },
        {
            id: 's_offline',
            category: 'offline',
            fileName: '2026-08-15现场签到.xlsx',
            sheetName: '签到表',
            headers: ['工号', '姓名', '签到时间'],
            rows: [
                // Checked in using new ID WX123456 at 13:40 Beijing Time (= 07:40 Cairo Time, on-time <= 08:00)
                ['WX123456', '张三', '2026-08-15 13:40:00']
            ]
        }
    ];

    // Case A: Before WeLink mapping, 00123456 and WX123456 do not match -> Absent
    const unmappedPeople = api.extractAllPeople();
    assert.equal(unmappedPeople.length, 1);
    assert.equal(unmappedPeople[0].attendance, 'Absent', 'Without mapping, old ID roster should show Absent');

    // Case B: Install WeLink mapping 00123456 <-> WX123456
    api.installWelinkPeople([
        {
            __queryEmpNo: '00123456',
            employeeNumber: 'WX123456',
            chineseName: '张三',
            deptName: '交付BU'
        }
    ], false);

    const mappedPeople = api.extractAllPeople();
    assert.equal(mappedPeople.length, 1);
    const p = mappedPeople[0];
    assert.equal(p.attendance, 'Attend on Time', 'With mapping, check-in under new ID must fulfill old ID roster attendance');
    assert.equal(p.attendanceMethod, '现场扫码');
    assert.equal(p.changedEmployeeId, 'WX123456');
    assert.equal(p.oldEmployeeId, '00123456');
});

test('Attendance matching: check-in with old staff ID satisfies attendance for roster extracted with new staff ID', () => {
    const api = loadMeetingAttendance();

    // Roster has new ID WX123456 from WFM
    api.state.sheets = [
        {
            id: 's_wfm',
            category: 'wfm',
            fileName: 'WFM_Tasks.xlsx',
            sheetName: 'WFM',
            headers: ['BU', 'Customer Group', 'Task Create Time', '实施人/Operator', 'Task ID'],
            rows: [
                ['服务BU', 'Giza', '2026-08-12 11:00:00', '李四 WX123456', 'TK202608120001']
            ]
        },
        {
            id: 's_online',
            category: 'online',
            fileName: '2026-08-15线上会议.xlsx',
            sheetName: '入会记录',
            headers: ['meeting_title', 'user_id', 'user_name', 'join_time'],
            rows: [
                // Joined online meeting using old ID 00123456 at 07:55 Cairo Time
                ['2026-08-15 例会', '00123456', '李四', '2026-08-15 07:55:00']
            ]
        }
    ];

    api.installWelinkPeople([
        {
            __queryEmpNo: '00123456',
            employeeNumber: 'WX123456',
            chineseName: '李四',
            deptName: '服务BU'
        }
    ], false);

    const people = api.extractAllPeople();
    assert.equal(people.length, 1);
    const p = people[0];
    assert.equal(p.attendance, 'Attend on Time', 'Online join under old ID must fulfill new ID roster attendance');
    assert.equal(p.attendanceMethod, '线上会议');
});

test('Snapshot persistence and restoration preserves WeLink mapped people and alias clusters', async () => {
    const api = loadMeetingAttendance();

    api.state.sheets = [
        {
            id: 's_rfc',
            category: 'rfc',
            fileName: 'RFC_2026-08.xlsx',
            sheetName: 'RFC',
            headers: ['BU', 'Customer Group', 'Create Time', '建单人/Originator', 'Task ID'],
            rows: [
                ['网络BU', 'Cairo', '2026-08-01 10:00:00', '张三 00123456', 'NC202608010001']
            ]
        },
        {
            id: 's_offline',
            category: 'offline',
            fileName: '2026-08-01现场签到.xlsx',
            sheetName: '签到表',
            headers: ['工号', '姓名', '签到时间'],
            rows: [
                ['WX123456', '张三', '2026-08-01 13:50:00']
            ]
        }
    ];

    api.installWelinkPeople([
        {
            __queryEmpNo: '00123456',
            employeeNumber: 'WX123456',
            chineseName: '张三',
            deptName: '网络BU'
        }
    ], false);

    // Build snapshot payload
    const snapshot = await api.buildSnapshotPayload('2026-08-01 考勤快照', '2026-08-01');
    assert.ok(snapshot.payload.welinkPeople, 'Snapshot payload should include welinkPeople');
    assert.equal(snapshot.payload.welinkPeople.length, 1);
    assert.equal(snapshot.payload.welinkPeople[0].employeeNumber, 'WX123456');

    // Create a new clean instance and restore snapshot
    const api2 = loadMeetingAttendance();
    assert.equal(api2.state.welinkPeopleList.length, 0);

    api2.restoreMeetingSnapshot(snapshot);

    assert.equal(api2.state.welinkPeopleList.length, 1);
    assert.equal(api2.changedEmployeeId('00123456'), 'WX123456');

    const restoredPeople = api2.extractAllPeople();
    assert.equal(restoredPeople.length, 1);
    assert.equal(restoredPeople[0].attendance, 'Attend on Time');
    assert.equal(restoredPeople[0].changedEmployeeId, 'WX123456');
});

test('WeLink modal DOM structure is top-level and clicking welinkToolsBtn opens modal without hidden parents', () => {
    const htmlPath = path.resolve(__dirname, '../backend/builtin-tools/tool-msf5b7nn/index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    // 1. Verify #welinkModal is NOT nested inside #snapshotModal
    const snapModalIndex = html.indexOf('id="snapshotModal"');
    const welinkModalIndex = html.indexOf('id="welinkModal"');
    assert.ok(snapModalIndex > 0, 'snapshotModal must exist');
    assert.ok(welinkModalIndex > snapModalIndex, 'welinkModal must appear after snapshotModal');

    // Count open/close divs between snapshotModal and welinkModal
    const between = html.slice(snapModalIndex, welinkModalIndex);
    const opens = (between.match(/<div\b/g) || []).length;
    const closes = (between.match(/<\/div>/g) || []).length;
    assert.equal(opens, closes, 'All divs in snapshotModal must be properly closed before welinkModal opens');

    // 2. Test modal element open/close behavior in mock DOM
    const mockElements = new Map();
    function getEl(id) {
        if (!mockElements.has(id)) {
            const classes = new Set(id.toLowerCase().includes('modal') ? ['hidden'] : []);
            mockElements.set(id, {
                id,
                classList: {
                    contains: (cls) => classes.has(cls),
                    remove: (cls) => { classes.delete(cls); },
                    add: (cls) => { classes.add(cls); },
                    toggle: (cls) => { classes.has(cls) ? classes.delete(cls) : classes.add(cls); }
                },
                querySelectorAll: () => [],
                querySelector: () => null,
                appendChild: () => {},
                addEventListener: () => {},
                setAttribute: () => {},
                style: {},
                textContent: '',
                innerHTML: '',
                value: ''
            });
        }
        return mockElements.get(id);
    }

    const api = loadMeetingAttendance(1, {
        document: {
            documentElement: { lang: 'zh-CN' },
            title: '',
            querySelector: (sel) => {
                if (sel === '#welinkModal') return getEl('welinkModal');
                if (sel === '#welinkExtractStats') return getEl('welinkExtractStats');
                if (sel === '#welinkChangedSection') return getEl('welinkChangedSection');
                if (sel === '#welinkDepartedSection') return getEl('welinkDepartedSection');
                if (sel === '#welinkParseStatus') return getEl('welinkParseStatus');
                if (sel === '#welinkToolsBtn') return getEl('welinkToolsBtn');
                return getEl(sel.replace(/^[#.]/, ''));
            },
            querySelectorAll: () => [],
            getElementById: (id) => getEl(id),
            createElement: () => ({ ...getEl('created') }),
            body: { appendChild: () => {}, classList: { contains: () => false, add: () => {}, remove: () => {} } },
            addEventListener: () => {}
        }
    });

    // Initial state: hidden
    assert.equal(getEl('welinkModal').classList.contains('hidden'), true, 'welinkModal should initially be hidden');

    // Call openWelinkModal
    api.openWelinkModal();
    assert.equal(getEl('welinkModal').classList.contains('hidden'), false, 'openWelinkModal must remove hidden class from welinkModal');

    // Call closeWelinkModal
    api.closeWelinkModal();
    assert.equal(getEl('welinkModal').classList.contains('hidden'), true, 'closeWelinkModal must re-add hidden class to welinkModal');
});

test('Suspected departure attendance: un-checked staff with empty WeLink result evaluated as Suspected Departure or ID Change in calculation and export', () => {
    const api = loadMeetingAttendance();

    // 1. Setup sheets: RFC has 2 people (00111111 departed and un-checked, 00222222 departed but checked in)
    api.state.sheets = [
        {
            id: 's_rfc',
            category: 'rfc',
            fileName: 'RFC_Tasks.xlsx',
            sheetName: 'RFC',
            headers: ['BU', 'Customer Group', 'Create Time', '建单人/Originator', 'Task ID'],
            rows: [
                ['网络BU', 'Cairo', '2026-08-01 10:00:00', '张三 00111111', 'NC202608010001'],
                ['网络BU', 'Cairo', '2026-08-01 10:00:00', '李四 00222222', 'NC202608010002']
            ]
        },
        {
            id: 's_offline',
            category: 'offline',
            fileName: '2026-08-15现场签到.xlsx',
            sheetName: '签到表',
            headers: ['工号', '姓名', '签到时间'],
            rows: [
                // Only 李四 checked in on time
                ['00222222', '李四', '2026-08-15 13:40:00']
            ]
        }
    ];

    // 2. Install WeLink results where both are suspected departed (data: [])
    api.installWelinkPeople([
        {
            __queryEmpNo: '00111111',
            __suspectedDeparted: true,
            deptName: '疑似已离职'
        },
        {
            __queryEmpNo: '00222222',
            __suspectedDeparted: true,
            deptName: '疑似已离职'
        }
    ], false);

    // 3. Evaluate people
    const people = api.extractAllPeople();
    assert.equal(people.length, 2);

    const zhang = people.find(p => p.account.includes('00111111'));
    assert.ok(zhang);
    assert.equal(zhang.isSuspectedDeparted, true);
    assert.equal(zhang.attendance, 'Suspected Departure or ID Change', 'Unchecked suspected departed staff must receive Suspected Departure or ID Change');

    const li = people.find(p => p.account.includes('00222222'));
    assert.ok(li);
    assert.equal(li.isSuspectedDeparted, true);
    assert.equal(li.attendance, 'Attend on Time', 'Checked-in staff must retain Attend on Time even if marked as suspected departed in query');

    // 4. Test Excel buildAnalysisTables export
    const tables = api.buildAnalysisTables(people);
    assert.ok(tables.people);
    assert.ok(tables.summary);

    // Summary headers should include Note
    assert.equal(tables.summary[0][8], 'Note', 'Header 8 should be Note');

    // Total row should have remarks with departed count in Chinese by default
    const totalRow = tables.summary.find(r => r[1] === 'Total');
    assert.ok(totalRow);
    assert.equal(totalRow[8], '含疑似离职 1 人', 'Total row should remark suspected departure in Chinese');

    // In English mode, remarks should be in English
    api.state.lang = 'en';
    const enTables = api.buildAnalysisTables(people);
    const enTotalRow = enTables.summary.find(r => r[1] === 'Total');
    assert.ok(enTotalRow);
    assert.equal(enTotalRow[8], 'Incl. 1 suspected departure', 'Total row should remark suspected departure in English');

    const exportedZhang = tables.people.find(r => r[2].includes('00111111'));
    assert.ok(exportedZhang);
    assert.equal(exportedZhang[5], 'Suspected Departure or ID Change', 'Exported Attendance Status column must be Suspected Departure or ID Change');

    const exportedLi = tables.people.find(r => r[2].includes('00222222'));
    assert.ok(exportedLi);
    assert.equal(exportedLi[5], 'Attend on Time', 'Exported Attendance Status column for attendee must be Attend on Time');
});


