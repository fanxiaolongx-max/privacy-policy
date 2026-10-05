const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadMeetingAttendance(lang = 'zh', minSessionRecords = 1) {
    const htmlPath = path.resolve(__dirname, '../backend/builtin-tools/tool-msf5b7nn/index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    const scriptMatch = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i);
    assert.ok(scriptMatch, 'Script block must be present');
    const code = scriptMatch[1];

    const storage = new Map([
        ['tools_lang', lang === 'en' ? 'en-US' : 'zh-CN'],
        ['meeting_attendance_lang_v1', lang]
    ]);

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

    const sandbox = {
        console,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        TextEncoder,
        Uint8Array,
        DataView,
        requestAnimationFrame: (cb) => setTimeout(cb, 0),
        localStorage: {
            getItem: (k) => storage.get(k) ?? null,
            setItem: (k, v) => storage.set(k, String(v)),
            removeItem: (k) => storage.delete(k),
            clear: () => storage.clear()
        },
        sessionStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
            clear: () => {}
        },
        document: {
            documentElement: { lang: lang === 'en' ? 'en' : 'zh-CN' },
            title: '',
            querySelector: (sel) => {
                if (sel === '#welinkModal') return getEl('welinkModal');
                return getEl(sel.replace(/^[#.]/, ''));
            },
            querySelectorAll: () => [],
            getElementById: (id) => getEl(id),
            createElement: () => ({ ...getEl('created') }),
            body: { appendChild: () => {}, classList: { contains: () => false, add: () => {}, remove: () => {} } },
            addEventListener: () => {}
        },
        window: {
            location: { reload: () => {} },
            addEventListener: () => {},
            dispatchEvent: () => {}
        }
    };
    sandbox.window.window = sandbox.window;
    sandbox.window.document = sandbox.document;
    sandbox.window.localStorage = sandbox.localStorage;

    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    const api = sandbox.window.__meetingAttendance;
    if (minSessionRecords !== null) {
        api.state.attendanceRules.minSessionRecords = minSessionRecords;
    }
    return api;
}

test('Overall Status column in Multi-Session Comparison sheet is 100% English when exporting in English mode', async () => {
    const api = loadMeetingAttendance('en', 1);
    api.state.lang = 'en';

    api.state.sheets = [
        {
            id: 'qr',
            category: 'qr',
            fileName: 'QR_2026.xlsx',
            sheetName: 'Sheet1',
            headers: ['Task ID', 'Create Time', 'Apply Fullname', 'Apply Accountid', 'BU', 'Customer Group'],
            rows: [
                ['QR202608010001', '2026-08-01 09:00:00', 'Alice Cooper', 'AC001', 'Cloud BU', 'Egypt VIP'],
                ['QR202608010002', '2026-08-01 09:00:00', 'Bob Martin', 'BM002', 'Cloud BU', 'Egypt VIP'],
                ['QR202608010003', '2026-08-01 09:00:00', 'Charlie Brown', 'CB003', 'Network BU', 'Egypt VIP']
            ]
        },
        {
            id: 'offline_1',
            category: 'offline',
            fileName: '2026-08-01现场签到.xlsx',
            sheetName: 'Session1',
            headers: ['工号', '姓名', '签到时间'],
            rows: [
                ['AC001', 'Alice Cooper', '2026-08-01 13:45:00'],
                ['BM002', 'Bob Martin', '2026-08-01 14:15:00'] // Delay
            ]
        },
        {
            id: 'offline_2',
            category: 'offline',
            fileName: '2026-08-15现场签到.xlsx',
            sheetName: 'Session2',
            headers: ['工号', '姓名', '签到时间'],
            rows: [
                ['AC001', 'Alice Cooper', '2026-08-15 13:50:00']
            ]
        }
    ];

    // Mark Charlie as suspected departed
    api.installWelinkPeople([
        {
            __queryEmpNo: 'CB003',
            __suspectedDeparted: true,
            deptName: '疑似已离职'
        }
    ], false);

    const cache = await api.ensurePeopleCache();
    const tables = api.buildAnalysisTables(cache.all);
    assert.ok(tables.multiMatrix, 'multiMatrix must be generated for multi-session');

    // Headers
    const headers = tables.multiMatrix[0];
    const overallIdx = headers.indexOf('Overall Status');
    assert.ok(overallIdx > 0, 'Overall Status column must exist in headers');

    // Alice attended all on time -> Full (All On-time)
    const aliceRow = tables.multiMatrix.find(r => r[1] === 'AC001');
    assert.ok(aliceRow);
    assert.equal(aliceRow[overallIdx], 'Full (All On-time)', 'Alice should be Full (All On-time)');

    // Bob attended session 1 with delay, absent in session 2 -> Partial (1/2)
    const bobRow = tables.multiMatrix.find(r => r[1] === 'BM002');
    assert.ok(bobRow);
    assert.equal(bobRow[overallIdx], 'Partial (1/2)', 'Bob should be Partial (1/2)');

    // Charlie was absent in both and is suspected departed -> Suspected Departure or ID Change
    const charlieRow = tables.multiMatrix.find(r => r[1] === 'CB003');
    assert.ok(charlieRow);
    assert.equal(charlieRow[overallIdx], 'Suspected Departure or ID Change', 'Charlie should be Suspected Departure or ID Change');
});

test('Attendance Summary exports Note column and remarks suspected departures on subtotal and total rows', async () => {
    // 1. Chinese mode
    const apiZh = loadMeetingAttendance('zh', 1);
    apiZh.state.lang = 'zh';

    apiZh.state.sheets = [
        {
            id: 'qr',
            category: 'qr',
            fileName: 'QR.xlsx',
            sheetName: 'Sheet1',
            headers: ['Task ID', 'Create Time', 'Apply Fullname', 'Apply Accountid', 'BU', 'Customer Group'],
            rows: [
                ['QR202608010001', '2026-08-01 09:00:00', '张三', 'U001', '网络BU', 'VIP'],
                ['QR202608010002', '2026-08-01 09:00:00', '李四', 'U002', '网络BU', 'VIP'],
                ['QR202608010003', '2026-08-01 09:00:00', '王五', 'U003', 'IT BU', 'VIP']
            ]
        },
        {
            id: 'offline_1',
            category: 'offline',
            fileName: '2026-08-01现场签到.xlsx',
            sheetName: 'Sheet1',
            headers: ['工号', '姓名', '签到时间'],
            rows: [
                ['U001', '张三', '2026-08-01 13:50:00']
            ]
        }
    ];

    // 李四 is suspected departed
    apiZh.installWelinkPeople([
        {
            __queryEmpNo: 'U002',
            __suspectedDeparted: true,
            deptName: '疑似已离职'
        }
    ], false);

    const cacheZh = await apiZh.ensurePeopleCache();
    const tablesZh = apiZh.buildAnalysisTables(cacheZh.all);

    // Summary headers
    assert.equal(tablesZh.summary[0][8], 'Note');

    // BU rows: 网络BU has 1 departed (李四), IT BU has 0 departed (王五)
    const netBuRowZh = tablesZh.summary.find(r => r[1] === '网络BU');
    assert.ok(netBuRowZh);
    assert.equal(netBuRowZh[8], '含疑似离职 1 人');

    const itBuRowZh = tablesZh.summary.find(r => r[1] === 'IT BU');
    assert.ok(itBuRowZh);
    assert.equal(itBuRowZh[8], '');

    // Total row
    const totalRowZh = tablesZh.summary.find(r => r[1] === 'Total');
    assert.ok(totalRowZh);
    assert.equal(totalRowZh[8], '含疑似离职 1 人');

    // 2. English mode
    apiZh.state.lang = 'en';
    const tablesEn = apiZh.buildAnalysisTables(cacheZh.all);
    const totalRowEn = tablesEn.summary.find(r => r[1] === 'Total');
    assert.ok(totalRowEn);
    assert.equal(totalRowEn[8], 'Incl. 1 suspected departure');
    const netBuRowEn = tablesEn.summary.find(r => r[1] === '网络BU');
    assert.equal(netBuRowEn[8], 'Incl. 1 suspected departure');
});

test('Workbook OpenXML styles highlight Subtotal rows with style 3 and Total rows with style 2', async () => {
    const api = loadMeetingAttendance('zh', 1);
    api.state.sheets = [
        {
            id: 'qr', category: 'qr', fileName: 'QR.xlsx', sheetName: 'Sheet1',
            headers: ['Task ID', 'Create Time', 'Apply Fullname', 'Apply Accountid', 'BU'],
            rows: [
                ['QR202608010001', '2026-08-01 09:00:00', '张三', 'U001', 'BU1'],
                ['QR202608010002', '2026-08-01 09:00:00', '李四', 'U002', 'BU2']
            ]
        },
        {
            id: 'off_1', category: 'offline', fileName: '2026-08-01现场.xlsx', sheetName: 'S1',
            headers: ['工号', '姓名', '签到时间'],
            rows: [['U001', '张三', '2026-08-01 13:50:00']]
        },
        {
            id: 'off_2', category: 'offline', fileName: '2026-08-15现场.xlsx', sheetName: 'S2',
            headers: ['工号', '姓名', '签到时间'],
            rows: [['U002', '李四', '2026-08-15 13:50:00']]
        }
    ];

    api.state.selectedSession = 'all';
    const cache = await api.ensurePeopleCache();
    const tables = api.buildAnalysisTables(cache.all);

    // Verify Subtotal rows exist
    const subtotalRows = tables.summary.filter(r => r[1] === 'Subtotal');
    assert.equal(subtotalRows.length, 2, 'Should have 2 subtotal rows for 2 sessions');

    const grandTotalRow = tables.summary.filter(r => r[1] === 'Grand Total');
    assert.equal(grandTotalRow.length, 1, 'Should have 1 grand total row');

    // Test worksheetXml row styling resolver directly
    const xml = api.buildAnalysisWorkbook(cache.all);
    assert.ok(xml instanceof Uint8Array, 'buildAnalysisWorkbook should return Uint8Array binary zip');

    const sheet1Xml = api.buildAnalysisWorkbook.toString();
    assert.match(sheet1Xml, /Subtotal.*return 3/, 'Subtotal must resolve to style 3');
    assert.match(sheet1Xml, /Grand Total.*return 2/, 'Grand Total must resolve to style 2');
});
