const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repo = require('../backend/models/meeting-snapshots-repository');

test('meeting-snapshots-repository performs complete CRUD and filtering on SQLite database', async () => {
    await repo.ensureReady();

    const testId = `snap_test_${Date.now()}`;
    const testSnapshot = {
        id: testId,
        title: '2026-09-22 埃及网安例会考勤分析',
        meetingDate: '2026-09-22',
        summary: {
            sheetCount: 5,
            totalRows: 1250,
            totalAttendees: 180,
            onTimeRate: '92.5%',
            counts: {
                Absent: 10,
                'Attend on Time': 160,
                Delay: 8,
                'Fake Attendance': 2
            },
            byBu: {
                NIS: { total: 100, Absent: 5, 'Attend on Time': 90, Delay: 4, 'Fake Attendance': 1 },
                Wireless: { total: 80, Absent: 5, 'Attend on Time': 70, Delay: 4, 'Fake Attendance': 1 }
            }
        },
        payload: {
            version: 1,
            sheets: [
                { id: 's1', category: 'qr', fileName: 'QR_20260922.xlsx', headers: ['Task ID', 'Apply Accountid'], rows: [['QR001', 'U1001']] }
            ],
            customerMappings: [{ from: 'Orange', to: 'ORG' }],
            attendanceRules: { onTime: '10:00', fake: '11:00' },
            exemptions: [{ name: 'liqiyan', account: '' }]
        }
    };

    // 1. Create
    const saved = await repo.saveSnapshot(testSnapshot);
    assert.equal(saved.id, testId);
    assert.equal(saved.title, '2026-09-22 埃及网安例会考勤分析');
    assert.equal(saved.meetingDate, '2026-09-22');
    assert.equal(saved.summary.totalAttendees, 180);
    assert.equal(saved.summary.onTimeRate, '92.5%');
    assert.equal(saved.payload.sheets.length, 1);

    // 2. List (default: omits payload)
    const list = await repo.listSnapshots({ search: '网安例会' });
    assert.ok(list.length >= 1);
    const found = list.find(s => s.id === testId);
    assert.ok(found, 'Should find the created snapshot in list');
    assert.equal(found.title, '2026-09-22 埃及网安例会考勤分析');
    assert.equal(found.meeting_date, '2026-09-22');
    assert.equal(found.summary.totalAttendees, 180);
    assert.equal(found.payload, undefined, 'List should omit payload by default');

    // 3. List with date filtering
    const listDateMatch = await repo.listSnapshots({ startDate: '2026-09-01', endDate: '2026-09-30' });
    assert.ok(listDateMatch.some(s => s.id === testId));

    const listDateMismatch = await repo.listSnapshots({ startDate: '2026-10-01' });
    assert.ok(!listDateMismatch.some(s => s.id === testId));

    // 4. Get by ID (includes payload)
    const fetched = await repo.getSnapshot(testId);
    assert.ok(fetched);
    assert.equal(fetched.id, testId);
    assert.equal(fetched.title, '2026-09-22 埃及网安例会考勤分析');
    assert.equal(fetched.payload.version, 1);
    assert.equal(fetched.payload.sheets[0].fileName, 'QR_20260922.xlsx');
    assert.deepEqual(fetched.payload.customerMappings, [{ from: 'Orange', to: 'ORG' }]);

    // 5. Rename
    const renamed = await repo.renameSnapshot(testId, '2026-09-22 埃及网安例会终版考勤分析');
    assert.equal(renamed.title, '2026-09-22 埃及网安例会终版考勤分析');
    const checkRenamed = await repo.getSnapshot(testId);
    assert.equal(checkRenamed.title, '2026-09-22 埃及网安例会终版考勤分析');

    // 6. Delete
    const deleted = await repo.deleteSnapshot(testId);
    assert.equal(deleted, true);
    const checkDeleted = await repo.getSnapshot(testId);
    assert.equal(checkDeleted, null);
});

test('tool-msf5b7nn index.html ensures exact parity and embeds snapshot UI controls', () => {
    const builtinPath = path.join(__dirname, '../backend/builtin-tools/tool-msf5b7nn/index.html');
    const dataPath = path.join(__dirname, '../backend/data/custom-tools/tool-msf5b7nn/index.html');

    const builtinHtml = fs.readFileSync(builtinPath, 'utf8');
    const dataHtml = fs.readFileSync(dataPath, 'utf8');

    // Exact byte-for-byte parity between builtin and custom data copy
    assert.equal(builtinHtml, dataHtml, 'builtin-tools and data/custom-tools tool-msf5b7nn index.html must be identical');

    // Top buttons
    assert.match(builtinHtml, /id="saveSnapshotBtn"/);
    assert.match(builtinHtml, /id="manageSnapshotsBtn"/);

    // Modals
    assert.match(builtinHtml, /id="saveSnapshotModal"/);
    assert.match(builtinHtml, /id="snapTitleInput"/);
    assert.match(builtinHtml, /id="snapDateInput"/);
    assert.match(builtinHtml, /id="saveSnapshotSubmitBtn"/);

    assert.match(builtinHtml, /id="snapshotModal"/);
    assert.match(builtinHtml, /id="smSearchInput"/);
    assert.match(builtinHtml, /id="smImportBtn"/);
    assert.match(builtinHtml, /id="smNewSnapshotBtn"/);
    assert.match(builtinHtml, /id="smListContainer"/);
});

function loadSandboxTool() {
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
            createElement: () => ({ ...mockElement }),
            addEventListener: () => {}
        },
        window: {}
    };
    sandbox.window = sandbox;

    vm.runInNewContext(scriptContent, sandbox);
    return sandbox.window.__meetingAttendance;
}

test('buildSnapshotPayload and restoreMeetingSnapshot handle state serialization and restoration', async () => {
    const api = loadSandboxTool();

    // Prepare mock state in tool
    api.state.sheets = [
        {
            id: 'sheet_1',
            category: 'qr',
            fileName: 'QR_Attendance_2026-09-22.xlsx',
            sheetName: 'Sheet1',
            headers: ['Task ID', 'Apply Accountid', 'Apply Fullname', 'BU', 'Customer Group'],
            rows: [
                ['QR1001', 'U90001', 'Test Engineer', 'NIS', 'ET']
            ],
            visibleColumns: [0, 1, 2, 3, 4],
            page: 1,
            order: 1
        },
        {
            id: 'sheet_2',
            category: 'offline',
            fileName: 'Offline_Scan_2026-09-22.xlsx',
            sheetName: 'Sheet1',
            headers: ['工号', '姓名', '签到时间'],
            rows: [
                ['U90001', 'Test Engineer', '2026-09-22 10:30:00']
            ],
            visibleColumns: [0, 1, 2],
            page: 1,
            order: 2
        }
    ];

    // 1. Build Snapshot Payload
    const snapshot = await api.buildSnapshotPayload('2026-09-22 自动测试快照', '2026-09-22');
    assert.equal(snapshot.title, '2026-09-22 自动测试快照');
    assert.equal(snapshot.meetingDate, '2026-09-22');
    assert.equal(snapshot.summary.sheetCount, 2);
    assert.equal(snapshot.summary.totalRows, 2);
    assert.equal(snapshot.summary.totalAttendees, 1);
    assert.equal(snapshot.summary.counts['Attend on Time'], 1);
    assert.equal(snapshot.summary.onTimeRate, '100.0%');
    assert.equal(snapshot.payload.sheets.length, 2);

    // 2. Clear state
    api.state.sheets = [];
    assert.equal(api.state.sheets.length, 0);

    // 3. Restore Snapshot
    api.restoreMeetingSnapshot(snapshot);
    assert.equal(api.state.sheets.length, 2);
    assert.equal(api.state.sheets[0].fileName, 'QR_Attendance_2026-09-22.xlsx');
    assert.equal(api.state.sheets[0].rows[0][0], 'QR1001');
    assert.equal(api.state.sheets[1].category, 'offline');
    assert.equal(api.state.active, 'people');
});

test('meeting-snapshots REST API routes respond correctly to GET, POST, PUT, DELETE', async () => {
    const express = require('express');
    const meetingRoutes = require('../backend/routes/meeting-snapshots');
    const app = express();
    app.use(express.json());
    app.use('/api/meeting-snapshots', meetingRoutes);

    const server = app.listen(0);
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}/api/meeting-snapshots`;

    try {
        // 1. POST /api/meeting-snapshots
        const postRes = await fetch(base, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'HTTP Route Test Snapshot',
                meetingDate: '2026-09-22',
                summary: { totalAttendees: 50 },
                payload: { sheets: [] }
            })
        });
        assert.equal(postRes.status, 201);
        const postData = await postRes.json();
        assert.equal(postData.success, true);
        const newId = postData.data.id;
        assert.ok(newId);

        // 2. GET /api/meeting-snapshots (list)
        const listRes = await fetch(`${base}?search=HTTP+Route`);
        assert.equal(listRes.status, 200);
        const listData = await listRes.json();
        assert.equal(listData.success, true);
        assert.ok(listData.data.some(s => s.id === newId));

        // 3. GET /api/meeting-snapshots/:id (detail)
        const getRes = await fetch(`${base}/${newId}`);
        assert.equal(getRes.status, 200);
        const getData = await getRes.json();
        assert.equal(getData.success, true);
        assert.equal(getData.data.title, 'HTTP Route Test Snapshot');

        // 4. PUT /api/meeting-snapshots/:id (rename)
        const putRes = await fetch(`${base}/${newId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'HTTP Renamed Snapshot' })
        });
        assert.equal(putRes.status, 200);
        const putData = await putRes.json();
        assert.equal(putData.success, true);
        assert.equal(putData.data.title, 'HTTP Renamed Snapshot');

        // 5. DELETE /api/meeting-snapshots/:id
        const delRes = await fetch(`${base}/${newId}`, { method: 'DELETE' });
        assert.equal(delRes.status, 200);
        const delData = await delRes.json();
        assert.equal(delData.success, true);

        // Verify deleted
        const checkRes = await fetch(`${base}/${newId}`);
        assert.equal(checkRes.status, 404);
    } finally {
        server.close();
    }
});

