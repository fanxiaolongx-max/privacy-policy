const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const express = require('express');

const meetingRepo = require('../backend/models/meeting-snapshots-repository');
const incentiveRepo = require('../backend/models/operation-incentive-snapshots-repository');
const meetingRoutes = require('../backend/routes/meeting-snapshots');
const incentiveRoutes = require('../backend/routes/operation-incentive-snapshots');

test('Cross-tool attendance check & roster extraction integration test', async (t) => {
    await meetingRepo.ensureReady();
    await incentiveRepo.ensureReady();

    const timestamp = Date.now();
    const testMeetingSnapId = `snap_cross_test_meeting_${timestamp}`;
    const testIncentiveSnapId = `snap_cross_test_inc_${timestamp}`;

    // 1. Create a test meeting snapshot with attendees and anomalies in summary
    const meetingSnapshot = {
        id: testMeetingSnapId,
        title: '测试会议考勤快照-跨工具联调',
        meetingDate: '2026-09-22',
        summary: {
            totalAttendees: 3,
            attendees: [
                { account: 'T8801', staffId: 'T8801', name: '王强', customerGroup: 'ET', businessUnit: 'NIS', role: 'TL', attendance: 'Absent' },
                { account: 'T8802', staffId: 'T8802', name: '李芳', customerGroup: 'Orange', businessUnit: 'Wireless', role: 'STAFF', attendance: 'Delay' },
                { account: 'T8803', staffId: 'T8803', name: '张伟', customerGroup: 'ET', businessUnit: 'NIS', role: 'STAFF', attendance: 'Attend on Time' }
            ],
            anomalies: [
                { account: 'T8801', staffId: 'T8801', name: '王强', type: 'absent', attendance: 'Absent', bu: 'NIS', group: 'ET', role: 'TL' },
                { account: 'T8802', staffId: 'T8802', name: '李芳', type: 'delay', attendance: 'Delay', bu: 'Wireless', group: 'Orange', role: 'STAFF' }
            ]
        },
        payload: {
            sheets: [],
            customerMappings: [],
            attendanceRules: { onTime: '10:00', fake: '11:00' }
        }
    };

    // 2. Create a test operation incentive snapshot with rawRows
    const incentiveSnapshot = {
        id: testIncentiveSnapId,
        title: '测试操作激励快照-跨工具联调',
        period: '2026-09',
        summary: {
            totalPeople: 2,
            topPeople: [
                { name: '王强', bu: 'NIS', count: 10, amount: 2800 },
                { name: '赵云', bu: 'Wireless', count: 8, amount: 2000 }
            ]
        },
        payload: {
            rawRows: [
                { task_id: 'WO-8801', complete_operator: '王强 (T8801)', BU1: 'NIS', operate_level: 'High' },
                { task_id: 'WO-8802', complete_operator: '赵云 (T8804)', BU1: 'Wireless', operate_level: 'Medium' }
            ]
        }
    };

    await meetingRepo.saveSnapshot(meetingSnapshot);
    await incentiveRepo.saveSnapshot(incentiveSnapshot);

    t.after(async () => {
        try {
            await meetingRepo.deleteSnapshot(testMeetingSnapId);
        } catch (_) {}
        try {
            await incentiveRepo.deleteSnapshot(testIncentiveSnapId);
        } catch (_) {}
    });

    // Subtest 1: Repository - checkPersonAttendance
    await t.test('meetingRepo.checkPersonAttendance correctly identifies absent, delay, clean, and not-found', async () => {
        // T8801: Absent anomaly
        const resAbsent = await meetingRepo.checkPersonAttendance({ staffId: 'T8801', name: '王强' });
        assert.equal(resAbsent.found, true);
        assert.equal(resAbsent.hasAnomaly, true);
        assert.ok(resAbsent.anomalies.some(a => a.type === 'absent'));

        // T8802: Delay anomaly by name
        const resDelay = await meetingRepo.checkPersonAttendance({ name: '李芳' });
        assert.equal(resDelay.found, true);
        assert.equal(resDelay.hasAnomaly, true);
        assert.ok(resDelay.anomalies.some(a => a.type === 'delay'));

        // T8803: Clean attendance (attend on time)
        const resClean = await meetingRepo.checkPersonAttendance({ staffId: 'T8803' });
        assert.equal(resClean.found, true);
        assert.equal(resClean.hasAnomaly, false);
        assert.ok(resClean.totalMeetingsChecked >= 1);

        // Unknown person
        const resUnknown = await meetingRepo.checkPersonAttendance({ staffId: 'T9999_NON_EXIST', name: '无此人' });
        assert.equal(resUnknown.found, false);
        assert.equal(resUnknown.hasAnomaly, false);
    });

    // Subtest 2: Repository - batchCheckAttendance
    await t.test('meetingRepo.batchCheckAttendance returns batched results for multiple persons', async () => {
        const batch = await meetingRepo.batchCheckAttendance([
            { staffId: 'T8801', name: '王强' },
            { staffId: 'T8803', name: '张伟' },
            { staffId: 'UNKNOWN_999' }
        ]);

        const entries = Object.values(batch);
        assert.equal(entries.length, 3);
        assert.equal(batch['T8801|王强'].hasAnomaly, true);
        assert.equal(batch['T8803|张伟'].hasAnomaly, false);
        assert.equal(batch['T8803|张伟'].found, true);
        assert.equal(batch['UNKNOWN_999|'].found, false);
    });

    // Subtest 3: Repository - extractRoster from meeting & incentive
    await t.test('extractRoster aggregates roster candidates from meeting and incentive snapshots', async () => {
        const meetingRoster = await meetingRepo.extractRoster();
        assert.ok(Array.isArray(meetingRoster));
        const foundWang = meetingRoster.find(r => r.staffId === 'T8801' || r.name === '王强');
        assert.ok(foundWang, 'Meeting roster should contain 王强');
        assert.equal(foundWang.customerGroup, 'ET');
        assert.equal(foundWang.businessUnit, 'NIS');
        assert.equal(foundWang.role, 'TL');
        assert.equal(foundWang.source, 'meeting');

        const incentiveRoster = await incentiveRepo.extractRoster();
        assert.ok(Array.isArray(incentiveRoster));
        const foundZhao = incentiveRoster.find(r => r.name === '赵云' || r.staffId === 'T8804');
        assert.ok(foundZhao, 'Incentive roster should contain 赵云');
        assert.equal(foundZhao.source, 'incentive');
    });

    // Subtest 4: HTTP API Endpoints
    await t.test('HTTP endpoints for cross-tool attendance check and roster extraction respond as expected', async () => {
        const app = express();
        app.use(express.json());
        app.use('/api/meeting-snapshots', meetingRoutes);
        app.use('/api/operation-incentive-snapshots', incentiveRoutes);

        const server = http.createServer(app);
        await new Promise(resolve => server.listen(0, resolve));
        const port = server.address().port;
        const meetingBase = `http://127.0.0.1:${port}/api/meeting-snapshots`;
        const incBase = `http://127.0.0.1:${port}/api/operation-incentive-snapshots`;

        try {
            // GET /attendance-check
            const res1 = await fetch(`${meetingBase}/attendance-check?staffId=T8801`);
            assert.equal(res1.status, 200);
            const data1 = await res1.json();
            assert.equal(data1.found, true);
            assert.equal(data1.hasAnomaly, true);

            // POST /batch-attendance-check
            const res2 = await fetch(`${meetingBase}/batch-attendance-check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    persons: [{ staffId: 'T8801' }, { staffId: 'T8803' }]
                })
            });
            assert.equal(res2.status, 200);
            const data2 = await res2.json();
            assert.equal(Object.keys(data2.results).length, 2);

            // GET /extract-roster (meeting)
            const res3 = await fetch(`${meetingBase}/extract-roster`);
            assert.equal(res3.status, 200);
            const data3 = await res3.json();
            assert.equal(data3.success, true);
            assert.ok(data3.roster.some(r => r.name === '王强'));

            // GET /extract-roster (incentive)
            const res4 = await fetch(`${incBase}/extract-roster`);
            assert.equal(res4.status, 200);
            const data4 = await res4.json();
            assert.equal(data4.success, true);
            assert.ok(data4.roster.some(r => r.name === '赵云'));
        } finally {
            server.close();
        }
    });

    // Subtest 5: Byte-for-byte parity across builtin-tools and data/custom-tools
    await t.test('All 4 integrated tools have 100% byte parity between builtin-tools and data/custom-tools', async () => {
        const tools = ['tool-msf5b7nn', 'reward-program', 'tool-ms4xb66s', 'department-reward-penalty'];
        for (const tool of tools) {
            const builtinPath = path.join(__dirname, '..', 'backend', 'builtin-tools', tool, 'index.html');
            const customPath = path.join(__dirname, '..', 'backend', 'data', 'custom-tools', tool, 'index.html');
            assert.ok(fs.existsSync(builtinPath), `builtin tool ${tool} exists`);
            assert.ok(fs.existsSync(customPath), `custom tool ${tool} exists`);
            const builtinContent = fs.readFileSync(builtinPath, 'utf8');
            const customContent = fs.readFileSync(customPath, 'utf8');
            assert.equal(builtinContent, customContent, `Tool ${tool} must be identical between builtin and custom`);
        }
    });

    // Subtest 6: Critical UI elements and integration triggers present
    await t.test('Integrated tools contain all required UI hooks, dialogs, and verification logic', async () => {
        // tool-msf5b7nn
        const meetingHtml = fs.readFileSync(path.join(__dirname, '..', 'backend', 'builtin-tools', 'tool-msf5b7nn', 'index.html'), 'utf8');
        assert.ok(meetingHtml.includes('attendees,') || meetingHtml.includes('attendees:'), 'tool-msf5b7nn must save attendees in snapshot summary');
        assert.ok(meetingHtml.includes('anomalies,') || meetingHtml.includes('anomalies:'), 'tool-msf5b7nn must save anomalies in snapshot summary');

        // reward-program
        const rewardHtml = fs.readFileSync(path.join(__dirname, '..', 'backend', 'builtin-tools', 'reward-program', 'index.html'), 'utf8');
        assert.ok(rewardHtml.includes('checkPersonAttendanceStatus'), 'reward-program must include checkPersonAttendanceStatus');
        assert.ok(rewardHtml.includes('att-badge'), 'reward-program must include att-badge styles');
        assert.ok(rewardHtml.includes('att-check-indicator'), 'reward-program must include att-check-indicator');

        // tool-ms4xb66s
        const incHtml = fs.readFileSync(path.join(__dirname, '..', 'backend', 'builtin-tools', 'tool-ms4xb66s', 'index.html'), 'utf8');
        assert.ok(incHtml.includes('attendanceAnomalyModal'), 'tool-ms4xb66s must include attendanceAnomalyModal');
        assert.ok(incHtml.includes('attendanceAnomalyAlert'), 'tool-ms4xb66s must include attendanceAnomalyAlert');
        assert.ok(incHtml.includes('applyAnomaliesToBlacklist'), 'tool-ms4xb66s must include applyAnomaliesToBlacklist');

        // department-reward-penalty
        const deptHtml = fs.readFileSync(path.join(__dirname, '..', 'backend', 'builtin-tools', 'department-reward-penalty', 'index.html'), 'utf8');
        assert.ok(deptHtml.includes('checkStaffAttendance'), 'department-reward-penalty must include checkStaffAttendance');
        assert.ok(deptHtml.includes('btn-extract-roster'), 'department-reward-penalty must include btn-extract-roster');
        assert.ok(deptHtml.includes('snapshot-roster-dialog'), 'department-reward-penalty must include snapshot-roster-dialog');
        assert.ok(deptHtml.includes('openSnapshotRosterDialog'), 'department-reward-penalty must include openSnapshotRosterDialog');
        assert.ok(deptHtml.includes('confirmImportSnapshotRoster'), 'department-reward-penalty must include confirmImportSnapshotRoster');
    });
});
