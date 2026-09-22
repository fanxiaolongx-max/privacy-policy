const { run, get, all } = require('./app-db');

let initPromise = null;

async function ensureReady() {
    if (!initPromise) {
        initPromise = (async () => {
            await run(`
                CREATE TABLE IF NOT EXISTS meeting_attendance_snapshots (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    meeting_date TEXT DEFAULT '',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    summary_json TEXT,
                    payload_json TEXT NOT NULL
                )
            `);
            await run(`
                CREATE INDEX IF NOT EXISTS idx_meeting_snapshots_lookup
                ON meeting_attendance_snapshots(meeting_date DESC, updated_at DESC)
            `);
        })().catch(err => {
            initPromise = null;
            throw err;
        });
    }
    return initPromise;
}

function parseJson(str, fallback = {}) {
    if (!str) return fallback;
    try {
        return JSON.parse(str);
    } catch (_) {
        return fallback;
    }
}

async function listSnapshots({ search, startDate, endDate, includePayload = false } = {}) {
    await ensureReady();
    const conditions = [];
    const params = [];

    if (search) {
        const query = `%${String(search).trim()}%`;
        conditions.push('(title LIKE ? OR meeting_date LIKE ?)');
        params.push(query, query);
    }
    if (startDate) {
        conditions.push('meeting_date >= ?');
        params.push(String(startDate).trim());
    }
    if (endDate) {
        conditions.push('meeting_date <= ?');
        params.push(String(endDate).trim());
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
        SELECT id, title, meeting_date, created_at, updated_at, summary_json
        ${includePayload ? ', payload_json' : ''}
        FROM meeting_attendance_snapshots
        ${whereClause}
        ORDER BY meeting_date DESC, updated_at DESC, id DESC
    `;

    const rows = await all(query, params);
    return rows.map(row => {
        const item = {
            id: row.id,
            title: row.title,
            meetingDate: row.meeting_date,
            meeting_date: row.meeting_date,
            createdAt: row.created_at,
            created_at: row.created_at,
            updatedAt: row.updated_at,
            updated_at: row.updated_at,
            summary: parseJson(row.summary_json, {})
        };
        if (includePayload) {
            item.payload = parseJson(row.payload_json, null);
        }
        return item;
    });
}

async function getSnapshot(id) {
    await ensureReady();
    const snapId = String(id || '').trim();
    if (!snapId) return null;

    const row = await get(`
        SELECT id, title, meeting_date, created_at, updated_at, summary_json, payload_json
        FROM meeting_attendance_snapshots
        WHERE id = ?
    `, [snapId]);

    if (!row) return null;

    return {
        id: row.id,
        title: row.title,
        meetingDate: row.meeting_date,
        meeting_date: row.meeting_date,
        createdAt: row.created_at,
        created_at: row.created_at,
        updatedAt: row.updated_at,
        updated_at: row.updated_at,
        summary: parseJson(row.summary_json, {}),
        payload: parseJson(row.payload_json, null)
    };
}

async function saveSnapshot({ id, title, meetingDate, summary = {}, payload = {} }) {
    await ensureReady();
    const dateStr = String(meetingDate || '').trim() || new Date().toISOString().slice(0, 10);
    const snapId = String(id || '').trim() || `meet_${dateStr.replace(/-/g, '')}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const snapTitle = String(title || '').trim() || `${dateStr} 会议考勤快照`;

    const summaryJson = JSON.stringify(summary || {});
    const payloadJson = JSON.stringify(payload || {});

    await run(`
        INSERT INTO meeting_attendance_snapshots (
            id, title, meeting_date, created_at, updated_at, summary_json, payload_json
        )
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            meeting_date = excluded.meeting_date,
            updated_at = CURRENT_TIMESTAMP,
            summary_json = excluded.summary_json,
            payload_json = excluded.payload_json
    `, [snapId, snapTitle, dateStr, summaryJson, payloadJson]);

    return getSnapshot(snapId);
}

async function renameSnapshot(id, newTitle) {
    await ensureReady();
    const snapId = String(id || '').trim();
    const title = String(newTitle || '').trim();
    if (!snapId || !title) throw new Error('快照ID和新名称不能为空');

    const result = await run(`
        UPDATE meeting_attendance_snapshots
        SET title = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [title, snapId]);

    if (!result || result.changes === 0) return null;
    return getSnapshot(snapId);
}

async function deleteSnapshot(id) {
    await ensureReady();
    const snapId = String(id || '').trim();
    if (!snapId) return false;

    const result = await run(`
        DELETE FROM meeting_attendance_snapshots
        WHERE id = ?
    `, [snapId]);

    return Boolean(result && result.changes > 0);
}

function normalizeId(id) {
    if (!id) return '';
    const s = String(id).trim().toLowerCase();
    const m = s.match(/^[ua](\d{5,})$/);
    return m ? m[1] : s;
}

function matchPerson(person, targetStaffId, targetName) {
    const tId = normalizeId(targetStaffId);
    const tName = String(targetName || '').trim().toLowerCase();
    const pAccount = normalizeId(person.account || person.staffId || person.id);
    const pName = String(person.name || '').trim().toLowerCase();

    // 1. Exact or normalized ID match
    if (tId && pAccount && (tId === pAccount || tId === (person.account || '').toLowerCase() || tId === (person.staffId || '').toLowerCase() || tId === (person.id || '').toLowerCase())) {
        return true;
    }
    // 2. Exact name match
    if (tName && pName && tName === pName) {
        return true;
    }
    // 3. Name substring match if length >= 2
    if (tName && pName && tName.length >= 2 && (pName.includes(tName) || tName.includes(pName))) {
        return true;
    }
    return false;
}

function getSnapshotAttendees(snapshot) {
    const attendees = [];
    const seen = new Set();
    const add = (p) => {
        if (!p) return;
        const id = p.account || p.staffId || p.id || '';
        const name = p.name || '';
        const key = `${id}|${name}`;
        if (!seen.has(key)) {
            seen.add(key);
            attendees.push({
                account: id,
                staffId: id,
                id,
                name,
                bu: p.bu || p.businessUnit || '',
                businessUnit: p.bu || p.businessUnit || '',
                customerGroup: p.customerGroup || p.group || '',
                role: p.role || '',
                attendance: p.attendance || p.status || 'Attend on Time',
                status: p.status || p.attendance || 'Attend on Time',
                reason: p.reason || ''
            });
        }
    };

    if (Array.isArray(snapshot.summary?.attendees) && snapshot.summary.attendees.length) {
        snapshot.summary.attendees.forEach(add);
    }
    if (Array.isArray(snapshot.summary?.anomalies) && snapshot.summary.anomalies.length) {
        snapshot.summary.anomalies.forEach(add);
    }
    if (attendees.length) return attendees;

    if (Array.isArray(snapshot.payload?.attendees) && snapshot.payload.attendees.length) {
        snapshot.payload.attendees.forEach(add);
    }
    if (attendees.length) return attendees;

    // Fallback: parse sheets if available
    if (snapshot.payload && Array.isArray(snapshot.payload.sheets)) {
        snapshot.payload.sheets.forEach(sheet => {
            if (!sheet || !Array.isArray(sheet.headers) || !Array.isArray(sheet.rows)) return;
            const headers = sheet.headers.map(h => String(h || '').trim());
            const nameIdx = headers.findIndex(h => /姓名|name|fullname|apply fullname/i.test(h));
            const idIdx = headers.findIndex(h => /工号|account|staffid|apply accountid/i.test(h));
            const buIdx = headers.findIndex(h => /bu|部门/i.test(h));
            const grpIdx = headers.findIndex(h => /customer|客户群/i.test(h));
            if (nameIdx === -1 && idIdx === -1) return;

            sheet.rows.forEach(row => {
                const name = nameIdx >= 0 ? String(row[nameIdx] || '').trim() : '';
                const account = idIdx >= 0 ? String(row[idIdx] || '').trim() : '';
                const bu = buIdx >= 0 ? String(row[buIdx] || '').trim() : '';
                const customerGroup = grpIdx >= 0 ? String(row[grpIdx] || '').trim() : '';
                add({ account, name, bu, customerGroup, attendance: 'Attend on Time' });
            });
        });
    }
    return attendees;
}

function isAttendanceAnomaly(att) {
    if (!att) return false;
    const s = String(att).trim().toLowerCase();
    if (s === 'attend on time' || s === '准时出席' || s === 'on time' || s === '正常') return false;
    return s.includes('absent') || s.includes('delay') || s.includes('fake') || s.includes('缺席') || s.includes('迟到') || s.includes('假打卡');
}

async function checkPersonAttendance({ staffId, name }) {
    await ensureReady();
    const queryId = String(staffId || '').trim();
    const queryName = String(name || '').trim();
    if (!queryId && !queryName) {
        return { found: false, hasAnomaly: false, records: [], anomalies: [], cleanCount: 0, anomalyCount: 0, totalMeetingsChecked: 0 };
    }

    const snapshots = await listSnapshots({ includePayload: true });
    const records = [];
    const anomalies = [];
    let cleanCount = 0;
    let anomalyCount = 0;

    for (const snap of snapshots) {
        const attendees = getSnapshotAttendees(snap);
        const match = attendees.find(p => matchPerson(p, queryId, queryName));
        if (match) {
            const rawAtt = match.attendance || match.status || 'Attend on Time';
            const isAnomaly = isAttendanceAnomaly(rawAtt);
            const attLower = String(rawAtt).toLowerCase();
            const issueType = (attLower.includes('absent') || rawAtt.includes('缺席')) ? 'absent' : 'delay';
            const item = {
                snapshotId: snap.id,
                title: snap.title,
                meetingDate: snap.meetingDate || snap.meeting_date || '',
                attendance: rawAtt,
                type: issueType,
                name: match.name || queryName,
                account: match.account || match.staffId || queryId,
                staffId: match.account || match.staffId || queryId,
                bu: match.bu || match.businessUnit || '',
                businessUnit: match.bu || match.businessUnit || '',
                customerGroup: match.customerGroup || ''
            };
            records.push(item);
            if (isAnomaly) {
                anomalies.push(item);
                anomalyCount++;
            } else {
                cleanCount++;
            }
        }
    }

    return {
        found: records.length > 0,
        hasAnomaly: anomalies.length > 0,
        cleanCount,
        anomalyCount,
        anomalies,
        records,
        totalMeetingsChecked: records.length
    };
}

async function batchCheckAttendance(persons = []) {
    await ensureReady();
    if (!Array.isArray(persons) || !persons.length) return {};
    const snapshots = await listSnapshots({ includePayload: true });
    
    const snapshotAttendeesList = snapshots.map(s => ({
        snapshotId: s.id,
        title: s.title,
        meetingDate: s.meetingDate || s.meeting_date || '',
        attendees: getSnapshotAttendees(s)
    }));

    const result = {};
    for (const p of persons) {
        const key = `${p.staffId || ''}|${p.name || ''}`;
        const queryId = String(p.staffId || '').trim();
        const queryName = String(p.name || '').trim();
        if (!queryId && !queryName) {
            result[key] = { found: false, hasAnomaly: false, cleanCount: 0, anomalyCount: 0, anomalies: [], records: [] };
            continue;
        }

        const records = [];
        const anomalies = [];
        let cleanCount = 0;
        let anomalyCount = 0;

        for (const snap of snapshotAttendeesList) {
            const match = snap.attendees.find(a => matchPerson(a, queryId, queryName));
            if (match) {
                const rawAtt = match.attendance || match.status || 'Attend on Time';
                const isAnomaly = isAttendanceAnomaly(rawAtt);
                const attLower = String(rawAtt).toLowerCase();
                const issueType = (attLower.includes('absent') || rawAtt.includes('缺席')) ? 'absent' : 'delay';
                const item = {
                    snapshotId: snap.snapshotId,
                    title: snap.title,
                    meetingDate: snap.meetingDate,
                    attendance: rawAtt,
                    type: issueType,
                    name: match.name || queryName,
                    account: match.account || match.staffId || queryId,
                    staffId: match.account || match.staffId || queryId,
                    bu: match.bu || match.businessUnit || '',
                    businessUnit: match.bu || match.businessUnit || '',
                    customerGroup: match.customerGroup || ''
                };
                records.push(item);
                if (isAnomaly) {
                    anomalies.push(item);
                    anomalyCount++;
                } else {
                    cleanCount++;
                }
            }
        }

        result[key] = {
            found: records.length > 0,
            hasAnomaly: anomalies.length > 0,
            cleanCount,
            anomalyCount,
            anomalies,
            records,
            totalMeetingsChecked: records.length
        };
    }
    return result;
}

async function extractRoster() {
    await ensureReady();
    const snapshots = await listSnapshots({ includePayload: true });
    const rosterMap = new Map();

    for (const snap of snapshots) {
        const attendees = getSnapshotAttendees(snap);
        for (const a of attendees) {
            const id = String(a.account || a.staffId || a.id || '').trim();
            const name = String(a.name || '').trim();
            if (!id && !name) continue;
            const key = id ? id.toLowerCase() : name.toLowerCase();
            const snapTitle = snap.title || '';
            const snapDate = snap.meetingDate || snap.meeting_date || '';

            if (!rosterMap.has(key)) {
                rosterMap.set(key, {
                    id: id || name,
                    staffId: id || '',
                    name: name || id,
                    bu: a.bu || a.businessUnit || '',
                    businessUnit: a.bu || a.businessUnit || '',
                    customerGroup: a.customerGroup || '',
                    role: a.role || '',
                    source: 'meeting',
                    sourceType: 'meeting',
                    snapshotTitle: snapTitle,
                    snapshotTitles: snapTitle ? [snapTitle] : [],
                    snapshotDate: snapDate,
                    meetingDates: snapDate ? [snapDate] : []
                });
            } else {
                const existing = rosterMap.get(key);
                if (!existing.bu && (a.bu || a.businessUnit)) {
                    existing.bu = a.bu || a.businessUnit;
                    existing.businessUnit = existing.bu;
                }
                if (!existing.customerGroup && a.customerGroup) existing.customerGroup = a.customerGroup;
                if (!existing.role && a.role) existing.role = a.role;
                if (!existing.name && name) existing.name = name;
                if (!existing.staffId && id) existing.staffId = id;
                if (snapTitle && !existing.snapshotTitles.includes(snapTitle)) existing.snapshotTitles.push(snapTitle);
                if (snapDate && !existing.meetingDates.includes(snapDate)) existing.meetingDates.push(snapDate);
            }
        }
    }

    return [...rosterMap.values()].sort((a, b) => (a.staffId || a.id || '').localeCompare(b.staffId || b.id || ''));
}

module.exports = {
    ensureReady,
    listSnapshots,
    getSnapshot,
    saveSnapshot,
    renameSnapshot,
    deleteSnapshot,
    checkPersonAttendance,
    batchCheckAttendance,
    extractRoster
};
