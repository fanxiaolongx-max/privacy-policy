const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');

const repo = require('../backend/models/operation-incentive-snapshots-repository');

test('operation-incentive-snapshots-repository performs complete CRUD and filtering on SQLite database', async () => {
    await repo.ensureReady();

    const testId = `snap_inc_test_${Date.now()}`;
    const testSnapshot = {
        id: testId,
        title: '[测试数据] 单元测试操作激励快照',
        period: '2026-09',
        sourceFile: 'UnitTest_Operation_Log.xlsx',
        summary: {
            totalRaw: 120,
            totalValid: 110,
            totalPaid: 95,
            totalPeople: 18,
            totalAmount: 25400,
            operatorGroups: {
                nonwx: { count: 90, amount: 24000, people: 16 },
                wx: { count: 5, amount: 1400, people: 2 }
            },
            byLevel: {
                fatal: { count: 2, amount: 1200 },
                high: { count: 18, amount: 5040 },
                medium: { count: 45, amount: 8100 },
                low: { count: 30, amount: 1500 }
            },
            byBu: {
                NIS: { count: 60, amount: 16000, people: 10 },
                Wireless: { count: 35, amount: 9400, people: 8 }
            },
            topPeople: [
                { name: '张工', bu: 'NIS', count: 15, amount: 4200 },
                { name: '李工', bu: 'Wireless', count: 12, amount: 3300 }
            ],
            rules: { feeLow: 50, feeMedium: 180, feeHigh: 280, feeFatal: 600, nightOnly: false }
        },
        payload: {
            version: 1,
            sourceFileName: 'UnitTest_Operation_Log.xlsx',
            sourceSheetName: 'Sheet1',
            rawRows: [
                { 'task_id': 'INC001', 'complete_operator': '张工', 'BU1': 'NIS', 'operate_level': 'High', 'task_status': '已完成', '当地开始时间': '2026-09-10 23:00', '当地完成时间': '2026-09-11 02:00' }
            ],
            rules: { feeLow: 50, feeMedium: 180, feeHigh: 280, feeFatal: 600, nightOnly: false },
            blacklistText: '测试忽略工号',
            activeOperatorGroup: 'nonwx',
            dedupMode: 'ticket-operator',
            blacklistMode: 'name',
            periodSourceMode: 'auto'
        }
    };

    try {
        // 1. Create
        const saved = await repo.saveSnapshot(testSnapshot);
        assert.equal(saved.id, testId);
        assert.equal(saved.title, '[测试数据] 单元测试操作激励快照');
        assert.equal(saved.period, '2026-09');
        assert.equal(saved.sourceFile, 'UnitTest_Operation_Log.xlsx');
        assert.equal(saved.summary.totalPaid, 95);
        assert.equal(saved.summary.totalAmount, 25400);
        assert.equal(saved.summary.byBu.NIS.amount, 16000);
        assert.equal(saved.payload.rawRows.length, 1);

        // 2. List (default: omits payload)
        const list = await repo.listSnapshots({ search: '单元测试' });
        assert.ok(list.length >= 1);
        const found = list.find(s => s.id === testId);
        assert.ok(found, 'Should find created snapshot in list');
        assert.equal(found.title, '[测试数据] 单元测试操作激励快照');
        assert.equal(found.period, '2026-09');
        assert.equal(found.source_file, 'UnitTest_Operation_Log.xlsx');
        assert.equal(found.summary.totalAmount, 25400);
        assert.equal(found.payload, undefined, 'List should omit payload by default');

        // 3. List with period filtering
        const listPeriodMatch = await repo.listSnapshots({ period: '2026-09' });
        assert.ok(listPeriodMatch.some(s => s.id === testId));

        const listPeriodMismatch = await repo.listSnapshots({ period: '2025-01' });
        assert.ok(!listPeriodMismatch.some(s => s.id === testId));

        // 4. List with full payload flag
        const listFull = await repo.listSnapshots({ search: testId, full: true });
        assert.ok(listFull.length >= 1);
        assert.ok(listFull[0].payload && listFull[0].payload.rawRows);

        // 5. Get by ID (includes payload)
        const fetched = await repo.getSnapshot(testId);
        assert.ok(fetched);
        assert.equal(fetched.id, testId);
        assert.equal(fetched.title, '[测试数据] 单元测试操作激励快照');
        assert.equal(fetched.payload.version, 1);
        assert.equal(fetched.payload.sourceFileName, 'UnitTest_Operation_Log.xlsx');
        assert.equal(fetched.payload.rawRows[0]['task_id'], 'INC001');

        // 6. Rename
        const renamed = await repo.renameSnapshot(testId, '[测试数据] 单元测试操作激励快照【重命名】');
        assert.equal(renamed.title, '[测试数据] 单元测试操作激励快照【重命名】');
        const checkRenamed = await repo.getSnapshot(testId);
        assert.equal(checkRenamed.title, '[测试数据] 单元测试操作激励快照【重命名】');
    } finally {
        // 7. Delete (always cleans up)
        await repo.deleteSnapshot(testId);
        const checkDeleted = await repo.getSnapshot(testId);
        assert.equal(checkDeleted, null);
    }
});

test('tool-ms4xb66s index.html ensures exact parity and embeds snapshot UI controls', () => {
    const builtinPath = path.join(__dirname, '../backend/builtin-tools/tool-ms4xb66s/index.html');
    const dataPath = path.join(__dirname, '../backend/data/custom-tools/tool-ms4xb66s/index.html');

    const builtinHtml = fs.readFileSync(builtinPath, 'utf8');
    const dataHtml = fs.readFileSync(dataPath, 'utf8');

    // Exact byte-for-byte parity between builtin and custom data copy
    assert.equal(builtinHtml, dataHtml, 'builtin-tools and data/custom-tools tool-ms4xb66s index.html must be identical');

    // Action buttons in Hero and Top actions
    assert.match(builtinHtml, /id="heroSaveSnapshotBtn"/);
    assert.match(builtinHtml, /id="heroManageSnapshotsBtn"/);
    assert.match(builtinHtml, /id="topSaveSnapshotBtn"/);
    assert.match(builtinHtml, /id="topManageSnapshotsBtn"/);
    assert.match(builtinHtml, /id="gateManageSnapshotsBtn"/);

    // Save snapshot modal controls
    assert.match(builtinHtml, /id="saveSnapshotModal"/);
    assert.match(builtinHtml, /id="snapTitleInput"/);
    assert.match(builtinHtml, /id="snapPeriodInput"/);
    assert.match(builtinHtml, /id="saveSnapshotSubmitBtn"/);

    // Snapshot manager library modal controls
    assert.match(builtinHtml, /id="snapshotModal"/);
    assert.match(builtinHtml, /id="smSearchInput"/);
    assert.match(builtinHtml, /id="smImportBtn"/);
    assert.match(builtinHtml, /id="smNewSnapshotBtn"/);
    assert.match(builtinHtml, /id="smListContainer"/);
    assert.match(builtinHtml, /id="smFileInput"/);
});

function loadSandboxTool() {
    const htmlPath = path.resolve(__dirname, '../backend/builtin-tools/tool-ms4xb66s/index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
    assert.ok(scriptMatch, 'Script block should exist in index.html');
    const scriptContent = scriptMatch[1];

    const elements = new Map();
    function element(id) {
        if (elements.has(id)) return elements.get(id);
        const classes = new Set();
        const value = {
            id,
            value: '',
            checked: false,
            disabled: false,
            hidden: false,
            innerHTML: '',
            textContent: '',
            style: {},
            dataset: {},
            classList: {
                add: (...names) => names.forEach(name => classes.add(name)),
                remove: (...names) => names.forEach(name => classes.delete(name)),
                toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
                contains: name => classes.has(name)
            },
            addEventListener() {},
            setAttribute() {},
            scrollIntoView() {},
            getBoundingClientRect() { return { width: 100, height: 40, left: 0, top: 0, bottom: 40 }; },
            getContext() {
                const gradient = { addColorStop() {} };
                return new Proxy({}, {
                    get: (_, prop) => {
                        if (prop === 'measureText') return () => ({ width: 10 });
                        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
                        return () => {};
                    }
                });
            }
        };
        elements.set(id, value);
        return value;
    }

    const storage = new Map();
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
        structuredClone,
        localStorage: {
            getItem: key => storage.get(key) || null,
            setItem: (key, val) => storage.set(key, String(val)),
            removeItem: key => storage.delete(key),
            clear: () => storage.clear()
        },
        document: {
            getElementById: element,
            querySelector: () => null,
            querySelectorAll: () => [],
            createElement: () => element('created_' + Date.now()),
            addEventListener: () => {},
            body: {
                classList: element('body').classList,
                appendChild: () => {}
            }
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        scrollTo: () => {},
        XLSX: null,
        devicePixelRatio: 1,
        innerWidth: 1200,
        innerHeight: 800
    };
    sandbox.window = sandbox;

    vm.runInNewContext(scriptContent, sandbox);
    return sandbox.window.__operationIncentive;
}

test('buildIncentiveSnapshotPayload and restoreIncentiveSnapshot handle state serialization and restoration', async () => {
    const api = loadSandboxTool();
    assert.ok(api, '__operationIncentive should be exposed on window');
    assert.equal(typeof api.buildIncentiveSnapshotPayload, 'function');
    assert.equal(typeof api.restoreIncentiveSnapshot, 'function');

    // Setup raw rows in the tool
    api.rawRows = [
        {
            'task_id': 'WO-2026-001',
            'complete_operator': 'U10001',
            'BU1': 'NIS',
            'operate_level': 'High',
            'task_status': '已完成',
            '当地开始时间': '2026-09-10 22:30:00',
            '当地完成时间': '2026-09-11 02:00:00'
        },
        {
            'task_id': 'WO-2026-002',
            'complete_operator': 'U10002',
            'BU1': 'Wireless',
            'operate_level': 'Medium',
            'task_status': '已完成',
            '当地开始时间': '2026-09-12 23:00:00',
            '当地完成时间': '2026-09-13 01:30:00'
        }
    ];

    api.recalculate();
    assert.ok(api.validRows.length >= 1, 'Recalculation should produce valid rows');

    // 1. Build Snapshot Payload
    const snapshot = await api.buildIncentiveSnapshotPayload('2026-09 自动化测试快照', '2026-09');
    assert.equal(snapshot.title, '2026-09 自动化测试快照');
    assert.equal(snapshot.period, '2026-09');
    assert.ok(snapshot.summary, 'Summary should exist');
    assert.ok(snapshot.summary.totalRaw >= 2);
    assert.ok(snapshot.summary.totalAmount > 0);
    assert.ok(snapshot.summary.operatorGroups);
    assert.ok(snapshot.summary.byLevel);
    assert.ok(snapshot.summary.byBu);
    assert.equal(snapshot.payload.rawRows.length, 2);
    assert.equal(snapshot.payload.rawRows[0]['task_id'], 'WO-2026-001');

    // 2. Clear state
    api.rawRows = [];
    api.recalculate();
    assert.equal(api.rawRows.length, 0);

    // 3. Restore Snapshot
    api.restoreIncentiveSnapshot(snapshot);
    assert.equal(api.rawRows.length, 2);
    assert.equal(api.rawRows[0]['task_id'], 'WO-2026-001');
    assert.equal(api.rawRows[1]['task_id'], 'WO-2026-002');
    assert.ok(api.validRows.length >= 1);
});

test('operation-incentive-snapshots REST API routes respond correctly to GET, POST, PUT, DELETE', async () => {
    const express = require('express');
    const incentiveRoutes = require('../backend/routes/operation-incentive-snapshots');
    const app = express();
    app.use(express.json());
    app.use('/api/operation-incentive-snapshots', incentiveRoutes);

    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}/api/operation-incentive-snapshots`;

    try {
        // 1. POST /api/operation-incentive-snapshots
        const postRes = await fetch(base, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'HTTP Route Test Operation Incentive',
                period: '2026-09',
                sourceFile: 'HTTP_Test_Log.xlsx',
                summary: {
                    totalRaw: 10,
                    totalValid: 10,
                    totalPaid: 8,
                    totalPeople: 3,
                    totalAmount: 2400
                },
                payload: {
                    version: 1,
                    rawRows: [{ id: 1, name: 'Alice' }]
                }
            })
        });

        assert.equal(postRes.status, 201);
        const postData = await postRes.json();
        assert.equal(postData.success, true);
        assert.ok(postData.item && postData.item.id);
        const createdId = postData.item.id;
        assert.equal(postData.item.title, 'HTTP Route Test Operation Incentive');
        assert.equal(postData.item.period, '2026-09');

        // 2. GET /api/operation-incentive-snapshots (List)
        const getListRes = await fetch(`${base}?search=HTTP+Route+Test`);
        assert.equal(getListRes.status, 200);
        const getListData = await getListRes.json();
        assert.equal(getListData.success, true);
        const found = getListData.items.find(s => s.id === createdId);
        assert.ok(found, 'Should find newly created snapshot in list');
        assert.equal(found.period, '2026-09');
        assert.equal(found.summary.totalAmount, 2400);

        // 3. GET /api/operation-incentive-snapshots/:id (Detail)
        const getDetailRes = await fetch(`${base}/${createdId}`);
        assert.equal(getDetailRes.status, 200);
        const getDetailData = await getDetailRes.json();
        assert.equal(getDetailData.success, true);
        assert.equal(getDetailData.item.id, createdId);
        assert.equal(getDetailData.item.payload.rawRows.length, 1);

        // 4. PUT /api/operation-incentive-snapshots/:id (Rename)
        const putRes = await fetch(`${base}/${createdId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'HTTP Route Test Operation Incentive Renamed' })
        });
        assert.equal(putRes.status, 200);
        const putData = await putRes.json();
        assert.equal(putData.success, true);
        assert.equal(putData.item.title, 'HTTP Route Test Operation Incentive Renamed');

        // 5. DELETE /api/operation-incentive-snapshots/:id
        const deleteRes = await fetch(`${base}/${createdId}`, { method: 'DELETE' });
        assert.equal(deleteRes.status, 200);
        const deleteData = await deleteRes.json();
        assert.equal(deleteData.success, true);

        // 6. Verify 404 after delete
        const checkRes = await fetch(`${base}/${createdId}`);
        assert.equal(checkRes.status, 404);

        // 7. Test invalid POST (missing title or period)
        const badPostRes = await fetch(base, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Missing Period Snapshot' })
        });
        assert.equal(badPostRes.status, 400);
    } finally {
        server.close();
    }
});
