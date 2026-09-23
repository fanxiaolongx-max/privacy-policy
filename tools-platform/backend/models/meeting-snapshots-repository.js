const { run, get, all, getDbPath } = require('./app-db');

const initPromises = new Map();

async function ensureReady() {
    const key = getDbPath();
    if (!initPromises.has(key)) {
        const task = (async () => {
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
            initPromises.delete(key);
            throw err;
        });
        initPromises.set(key, task);
    }
    return initPromises.get(key);
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

function areStaffIdsEquivalent(id1, id2) {
    if (!id1 || !id2) return false;
    const s1 = String(id1).trim().toLowerCase();
    const s2 = String(id2).trim().toLowerCase();
    if (!s1 || !s2) return false;
    if (s1 === s2) return true;

    // Check leading 'm' prefix (e.g. mWX1350434 vs WX1350434)
    if (s1 === 'm' + s2 || s2 === 'm' + s1) return true;

    // Check single leading letter difference
    if (s1.length === s2.length + 1 && s1.slice(1) === s2 && s2.length >= 4) return true;
    if (s2.length === s1.length + 1 && s2.slice(1) === s1 && s1.length >= 4) return true;

    // Check normalized digits if >= 5 digits (e.g. u1350434 vs 1350434 or mwx1350434 vs wx1350434)
    const num1 = s1.replace(/^[a-z]+/i, '');
    const num2 = s2.replace(/^[a-z]+/i, '');
    if (num1 && num1 === num2 && num1.length >= 5) return true;

    return false;
}

function isOrderNumber(str) {
    if (!str) return false;
    const s = String(str).trim();
    if (!s) return false;
    // 单号特征：以 qr/task/wo/req/inc/chg/cr 开头且后面跟纯数字或大部分数字
    if (/^qr\d+/i.test(s) || /^(task|wo|req|inc|chg|cr)\d+/i.test(s)) return true;
    // 纯无空格连续单号/工单编码（如 QR20260610000307，长于10位且含6位以上连续数字）
    if (/^[A-Za-z0-9_-]{11,}$/.test(s) && /\d{6,}/.test(s)) return true;
    return false;
}

function isInvalidStaffId(id) {
    if (!id) return false;
    const s = String(id).trim();
    if (!s) return false;
    // 自动过滤超过10位字符的非工号（如 QR20260610000307 共16位）
    if (s.length > 10) return true;
    // 单号/工单号特征过滤（如 QR...、TASK...、WO...）
    if (isOrderNumber(s)) return true;
    return false;
}

function preferCanonicalStaffId(id1, id2, preferredIds = new Set()) {
    const s1 = String(id1 || '').trim();
    const s2 = String(id2 || '').trim();
    if (isInvalidStaffId(s1) && !isInvalidStaffId(s2)) return s2;
    if (isInvalidStaffId(s2) && !isInvalidStaffId(s1)) return s1;
    if (isInvalidStaffId(s1) && isInvalidStaffId(s2)) return '';
    if (!s1) return s2;
    if (!s2) return s1;
    if (s1.toLowerCase() === s2.toLowerCase()) return s1;

    // 1. If one matches an already existing employee ID in the personnel roster, prefer it
    if (preferredIds.has(s1) && !preferredIds.has(s2)) return s1;
    if (preferredIds.has(s2) && !preferredIds.has(s1)) return s2;

    // 2. Prefer non-m prefix (e.g. WX1350434 over mWX1350434)
    const isM1 = /^m[a-z]/i.test(s1);
    const isM2 = /^m[a-z]/i.test(s2);
    if (isM1 && !isM2) return s2;
    if (isM2 && !isM1) return s1;

    // 3. Prefer standard enterprise prefix (e.g. WX...)
    if (/^wx\d+/i.test(s1) && !/^wx\d+/i.test(s2)) return s1;
    if (/^wx\d+/i.test(s2) && !/^wx\d+/i.test(s1)) return s2;

    // 4. Shorter ID preferred
    if (s1.length !== s2.length) return s1.length < s2.length ? s1 : s2;
    return s1;
}

function isTotalRow(id, name) {
    const sId = String(id || '').trim();
    const sName = String(name || '').trim();
    return /总计|合计|小计|^total$/i.test(sId) || /总计|合计|小计|^total$/i.test(sName);
}

function matchPerson(person, targetStaffId, targetName) {
    const tId = normalizeId(targetStaffId);
    const tName = String(targetName || '').trim().toLowerCase();
    const pAccount = normalizeId(person.account || person.staffId || person.id);
    const pName = String(person.name || '').trim().toLowerCase();

    // 1. Exact or normalized ID match, or fuzzy equivalent ID match (e.g. WX1350434 vs mWX1350434)
    if (tId && pAccount && (
        tId === pAccount ||
        tId === (person.account || '').toLowerCase() ||
        tId === (person.staffId || '').toLowerCase() ||
        tId === (person.id || '').toLowerCase() ||
        areStaffIdsEquivalent(tId, pAccount)
    )) {
        return true;
    }
    // 2. Exact name match
    if (tName && pName && tName === pName) {
        if (!tId || !pAccount || areStaffIdsEquivalent(tId, pAccount)) {
            return true;
        }
    }
    // 3. Name substring match if length >= 2
    if (tName && pName && tName.length >= 2 && (pName.includes(tName) || tName.includes(pName))) {
        if (!tId || !pAccount || areStaffIdsEquivalent(tId, pAccount)) {
            return true;
        }
    }
    return false;
}

function getDigits(s) {
    const d = String(s || '').replace(/^[a-z]+/i, '').trim();
    return d.length >= 5 ? d : '';
}

function isStaffIdToken(token) {
    if (!token) return false;
    const s = String(token).trim();
    if (s.length < 4 || s.length > 10) return false;
    if (isInvalidStaffId(s) || isOrderNumber(s)) return false;
    const digits = s.replace(/\D/g, '');
    if (digits.length < 3) return false;
    return /^[A-Za-z]{0,4}\d{3,9}[A-Za-z]?$/i.test(s);
}

function cleanNameAndStaffId(rawName, existingStaffId = '') {
    let name = String(rawName || '').trim();
    let staffId = String(existingStaffId || '').trim();

    if (isInvalidStaffId(staffId)) staffId = '';
    if (!name) {
        if (staffId && !isStaffIdToken(staffId)) {
            return cleanNameAndStaffId(staffId, '');
        }
        return { name: '', staffId };
    }

    if (isStaffIdToken(name) && !staffId) {
        return { name: '', staffId: name };
    }

    // 1. Bracketed pattern
    const mParen = name.match(/^(.*?)\s*[(（]([A-Za-z0-9_-]{4,10})[)）]$/);
    if (mParen && isStaffIdToken(mParen[2])) {
        name = mParen[1].trim();
        staffId = preferCanonicalStaffId(staffId, mParen[2].trim());
    } else {
        const mParenStart = name.match(/^[(（]([A-Za-z0-9_-]{4,10})[)）]\s*(.*?)$/);
        if (mParenStart && isStaffIdToken(mParenStart[1])) {
            name = mParenStart[2].trim();
            staffId = preferCanonicalStaffId(staffId, mParenStart[1].trim());
        }
    }

    // 2. Suffix pattern
    const mSuffix = name.match(/^(.*?)\s+([A-Za-z0-9_-]{4,10})$/);
    if (mSuffix && isStaffIdToken(mSuffix[2])) {
        name = mSuffix[1].trim();
        staffId = preferCanonicalStaffId(staffId, mSuffix[2].trim());
    }

    // 3. Prefix pattern
    const mPrefix = name.match(/^([A-Za-z0-9_-]{4,10})\s+(.*?)$/);
    if (mPrefix && isStaffIdToken(mPrefix[1])) {
        staffId = preferCanonicalStaffId(staffId, mPrefix[1].trim());
        name = mPrefix[2].trim();
    }

    // 4. Strip known staffId from name
    if (staffId) {
        const idEscaped = staffId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const idRegex = new RegExp(`(^|\\s+|[(（])${idEscaped}($|\\s+|[)）])`, 'gi');
        if (idRegex.test(name)) {
            name = name.replace(idRegex, ' ').replace(/\s+/g, ' ').trim();
        }
        const digits = getDigits(staffId);
        if (digits && digits.length >= 5) {
            const digitsRegex = new RegExp(`(^|\\s+|[(（])${digits}($|\\s+|[)）])`, 'gi');
            if (digitsRegex.test(name)) {
                name = name.replace(digitsRegex, ' ').replace(/\s+/g, ' ').trim();
            }
        }
    }

    name = name.replace(/^[\s,;，；|/()（）\-]+|[\s,;，；|/()（）\-]+$/g, '').trim();
    return { name, staffId };
}

function splitAndParsePeople(rawStr, defaultStaffId = '', defaultName = '') {
    if (!rawStr) return [];
    const text = String(rawStr).trim();
    if (!text) return [];

    const tokens = text.split(/[;\n；|]+/).map(t => t.trim()).filter(Boolean);
    const results = [];

    for (const token of tokens) {
        let { name, staffId } = cleanNameAndStaffId(token, defaultStaffId);

        if (!staffId && !name) {
            if (/[\u4e00-\u9fa5]/.test(token) || /\s+/.test(token)) {
                name = token;
                staffId = defaultStaffId || '';
            } else if (isStaffIdToken(token)) {
                staffId = token;
                name = defaultName || '';
            } else {
                name = token;
                staffId = '';
            }
        }

        if (isInvalidStaffId(staffId)) staffId = '';
        if (isOrderNumber(name)) name = '';
        if (name) name = name.replace(/^[\s,;，；|/()（）\-]+|[\s,;，；|/()（）\-]+$/g, '').trim();

        if ((name || staffId) && !isTotalRow(staffId, name)) {
            results.push({ name: name || staffId, staffId: staffId || '' });
        }
    }
    return results;
}

function getSnapshotAttendees(snapshot) {
    if (!snapshot) return [];
    const attendees = [];
    const attByKey = new Map();
    const attById = new Map();
    const attByName = new Map();

    const getDigits = s => {
        const d = String(s || '').replace(/^[a-z]+/i, '').trim();
        return d.length >= 5 ? d : '';
    };

    const add = (p, traceInfo = null) => {
        let id = String(p.account || p.staffId || p.id || '').trim();
        let name = String(p.name || '').trim();
        const cleaned = cleanNameAndStaffId(name, id);
        id = cleaned.staffId;
        name = cleaned.name;
        if (isInvalidStaffId(id)) {
            id = '';
        }
        if (isOrderNumber(name)) {
            name = '';
        }
        if (!id && !name) return;
        if (isTotalRow(id, name)) return;

        const role = p.role || '';
        const isPm = /^\s*pm\s*$/i.test(role);
        const bu = isPm ? 'PMO' : (p.bu || p.businessUnit || '');
        const customerGroup = p.customerGroup || p.group || '';

        const normN = normName(name);
        const key = id ? id.toLowerCase() : (normN ? `name:${normN}` : '');
        if (!key) return;

        let existing = attByKey.get(key);
        if (!existing && id) {
            existing = attById.get(id.toLowerCase());
            if (!existing) {
                const digits = getDigits(id);
                if (digits) existing = attById.get('digits:' + digits);
            }
        }
        if (!existing && normN) {
            existing = attByName.get(normN);
        }

        const splitDelimited = val => {
            if (!val) return [];
            if (Array.isArray(val)) {
                return [...new Set(val.flatMap(x => String(x || '').split(/[,，;/]+/).map(s => s.trim()).filter(Boolean)))];
            }
            return [...new Set(String(val).split(/[,，;/]+/).map(s => s.trim()).filter(Boolean))];
        };

        const initGroups = splitDelimited(p.customerGroups && p.customerGroups.length ? p.customerGroups : customerGroup);
        const initRoles = splitDelimited(p.roles && p.roles.length ? p.roles : role);

        if (!existing) {
            const newEntry = {
                account: id,
                staffId: id,
                id,
                name,
                bu,
                businessUnit: bu,
                customerGroup: initGroups.join(', '),
                customerGroups: initGroups,
                role: initRoles.join(', '),
                roles: initRoles,
                attendance: p.attendance || p.status || 'Attend on Time',
                status: p.status || p.attendance || 'Attend on Time',
                reason: p.reason || '',
                date: p.date || p.meetingDate || p.attendanceDate || '',
                attendanceTime: p.attendanceTime || '',
                sourceTraces: traceInfo ? [traceInfo] : []
            };
            attendees.push(newEntry);
            attByKey.set(key, newEntry);
            if (id) {
                attById.set(id.toLowerCase(), newEntry);
                const digits = getDigits(id);
                if (digits) attById.set('digits:' + digits, newEntry);
            }
            if (normN) attByName.set(normN, newEntry);
        } else {
            existing.account = preferCanonicalStaffId(existing.account, id);
            existing.staffId = preferCanonicalStaffId(existing.staffId, id);
            existing.id = existing.staffId || existing.account;
            existing.name = preferCanonicalName(existing.name, name);
            if (id) {
                attById.set(id.toLowerCase(), existing);
                const digits = getDigits(id);
                if (digits) attById.set('digits:' + digits, existing);
            }
            if (normN) attByName.set(normN, existing);

            if (p.attendance && (!existing.attendance || isAttendanceAnomaly(p.attendance))) {
                existing.attendance = p.attendance;
                existing.status = p.attendance;
            }
            if (!Array.isArray(existing.roles)) {
                existing.roles = splitDelimited(existing.role);
            }
            for (const r of initRoles) {
                if (r && !existing.roles.includes(r)) existing.roles.push(r);
            }
            existing.role = existing.roles.join(', ');

            if (!Array.isArray(existing.customerGroups)) {
                existing.customerGroups = splitDelimited(existing.customerGroup);
            }
            for (const g of initGroups) {
                if (g && !existing.customerGroups.includes(g)) existing.customerGroups.push(g);
            }
            existing.customerGroup = existing.customerGroups.join(', ');

            const anyPm = isPm || /^\s*pm\s*$/i.test(role) || existing.roles.some(r => /^\s*pm\s*$/i.test(r));
            if (anyPm) {
                existing.bu = 'PMO';
                existing.businessUnit = 'PMO';
            } else if (!existing.bu && bu) {
                existing.bu = bu;
                existing.businessUnit = bu;
            }
            if (!existing.date && (p.date || p.meetingDate || p.attendanceDate)) {
                existing.date = p.date || p.meetingDate || p.attendanceDate;
            }
            if (!existing.attendanceTime && p.attendanceTime) {
                existing.attendanceTime = p.attendanceTime;
            }
            if (traceInfo) {
                if (!Array.isArray(existing.sourceTraces)) existing.sourceTraces = [];
                if (!existing.sourceTraces.some(t => t.snapshotTitle === traceInfo.snapshotTitle && t.rowNumber === traceInfo.rowNumber && t.field === traceInfo.field)) {
                    existing.sourceTraces.push(traceInfo);
                }
            }
        }
    };

    // 核心业务原则：获取员工数据时，只获取“三类合并人员备用名单”（快照输出精华），其他原始表跳过
    if (Array.isArray(snapshot.summary?.attendees) && snapshot.summary.attendees.length) {
        snapshot.summary.attendees.forEach((a, idx) => {
            const trace = {
                source: 'meeting',
                sourceName: '会议考勤快照',
                snapshotTitle: snapshot.title || '会议考勤快照',
                sheetName: '三类合并人员备用名单',
                rowNumber: idx + 1,
                field: '参会人员',
                raw: [a.name, a.account || a.staffId].filter(Boolean).join(' ')
            };
            add(a, trace);
        });
        return attendees;
    }

    // 若无 summary.attendees，检查 payload.sheets 中是否存在显式的“三类合并人员备用名单”表
    if (snapshot.payload && Array.isArray(snapshot.payload.sheets)) {
        const combinedSheet = snapshot.payload.sheets.find(s => 
            /三类合并人员备用名单|Combined.*People List/i.test(s.sheetName || s.name || s.title || '')
        );
        if (combinedSheet && Array.isArray(combinedSheet.rows) && combinedSheet.rows.length) {
            const headers = (combinedSheet.headers || []).map(h => String(h || '').trim());
            const nameIdx = headers.findIndex(h => /姓名|fullname|\bname\b/i.test(h));
            const idIdx = headers.findIndex(h => /工号|account|staffid|\bid\b/i.test(h));
            const buIdx = headers.findIndex(h => /bu|部门/i.test(h));
            const grpIdx = headers.findIndex(h => /客户群|customer group|customer/i.test(h));

            combinedSheet.rows.forEach((row, rIdx) => {
                const name = nameIdx >= 0 ? String(row[nameIdx] || '').trim() : '';
                const account = idIdx >= 0 ? String(row[idIdx] || '').trim() : '';
                const bu = buIdx >= 0 ? String(row[buIdx] || '').trim() : '';
                const customerGroup = grpIdx >= 0 ? String(row[grpIdx] || '').trim() : '';
                if (name || account) {
                    add({ account, name, bu, customerGroup, attendance: 'Attend on Time' }, {
                        source: 'meeting',
                        sourceName: '会议考勤快照',
                        snapshotTitle: snapshot.title || '会议考勤快照',
                        sheetName: combinedSheet.sheetName || '三类合并人员备用名单',
                        rowNumber: rIdx + 1,
                        field: '参会人员',
                        raw: `${name} ${account}`.trim()
                    });
                }
            });
            return attendees;
        }
    }

    // 兜底方案：仅在无合并备用名单时（如纯原始表的测试数据）降级扫描原始 Sheet

    // Helper to parse role-paired cell or free-text names/accounts
    const parsePeopleTokens = (value) => {
        const text = String(value || '').trim();
        if (!text) return [];
        const people = [];
        const re = /([A-Za-z]{0,4}\d{4,})/g;
        let match, cursor = 0;
        while ((match = re.exec(text))) {
            const rawPart = text.slice(cursor, match.index).replace(/[\s,;，；|/()（）\-]+$/g, '').trim();
            const account = match[1];
            if (!isInvalidStaffId(account)) {
                people.push({ name: rawPart || account, account });
            } else if (rawPart && !isOrderNumber(rawPart)) {
                people.push({ name: rawPart, account: '' });
            }
            cursor = re.lastIndex;
        }
        if (people.length) return people;
        return text.split(/[\n;,，；|]+/)
            .map(s => s.replace(/^[\s,;，；|/()（）\-]+|[\s,;，；|/()（）\-]+$/g, '').trim())
            .filter(name => Boolean(name) && !isOrderNumber(name))
            .map(name => ({ name, account: '' }));
    };

    // Parse or enrich from sheets if available
    if (snapshot.payload && Array.isArray(snapshot.payload.sheets)) {
        const rfcRoles = [
            { role: 'Originator', re: /建单人|originator/i },
            { role: 'Owner', re: /\bowner\b/i },
            { role: 'Solution Developer', re: /方案制作人|solution developer/i },
            { role: 'TD', re: /\btd\b/i },
            { role: 'PM', re: /\bpm\b/i },
            { role: 'L1 Solution Reviewer', re: /l1评审人|l1 solution reviewer|l1 reviewer/i }
        ];
        const wfmRoles = [
            { role: 'FME', re: /实施人|operator|oprator|fme/i },
            { role: 'Creator', re: /建单人|creator|originator/i },
            { role: 'TD', re: /\btd\b/i },
            { role: 'PM', re: /\bpm\b/i }
        ];

        snapshot.payload.sheets.forEach(sheet => {
            if (!sheet || !Array.isArray(sheet.headers) || !Array.isArray(sheet.rows)) return;
            const headers = sheet.headers.map(h => String(h || '').trim());
            const nameIdx = headers.findIndex(h => /姓名|fullname|apply fullname|\bname\b/i.test(h));
            const idIdx = headers.findIndex(h => /工号|accountid|apply accountid|staffid|\baccount\b|\bid\b/i.test(h));
            const buIdx = headers.findIndex(h => /bu|部门|service type/i.test(h));
            const roleIdx = headers.findIndex(h => /匹配角色|用户角色|角色|role name|\brole\b|岗位|identity|身份/i.test(h));

            // Support:
            // 1. 客户网络/Network Name
            // 2. 客户群/Customer Group
            // 3. 客户组织/Customer Org
            // 4. Fallback 客户/Customer Name
            const grpCandidates = [
                headers.findIndex(h => /客户网络|network name/i.test(h)),
                headers.findIndex(h => /客户群|customer group/i.test(h)),
                headers.findIndex(h => /客户组织|customer org/i.test(h)),
                headers.findIndex(h => /网络|network/i.test(h)),
                headers.findIndex(h => /组织|org/i.test(h)),
                headers.findIndex(h => /customer name|customer|客户/i.test(h))
            ].filter(idx => idx >= 0);

            const isRfc = sheet.category === 'rfc' || headers.some(h => /solution developer|方案制作人|rfc/i.test(h));
            const isWfm = sheet.category === 'wfm' || headers.some(h => /wfm|fme/i.test(h));
            const isQr = sheet.category === 'qr' || headers.some(h => /apply fullname|apply accountid/i.test(h));

            sheet.rows.forEach(row => {
                const bu = buIdx >= 0 ? String(row[buIdx] || '').trim() : '';
                let customerGroup = '';
                for (const cIdx of grpCandidates) {
                    const val = String(row[cIdx] || '').trim();
                    if (val) {
                        customerGroup = val;
                        break;
                    }
                }
                const explicitRole = roleIdx >= 0 ? String(row[roleIdx] || '').trim() : '';

                if (isQr) {
                    const applyNameIdx = headers.findIndex(h => /apply fullname|apply name/i.test(h));
                    const applyIdIdx = headers.findIndex(h => /apply accountid|apply account/i.test(h));
                    const tdNameIdx = headers.findIndex(h => /td fullname|td name/i.test(h));
                    const tdIdIdx = headers.findIndex(h => /^td$/i.test(h));
                    if (applyNameIdx >= 0 || applyIdIdx >= 0) {
                        const name = applyNameIdx >= 0 ? String(row[applyNameIdx] || '').trim() : '';
                        const account = applyIdIdx >= 0 ? String(row[applyIdIdx] || '').trim() : '';
                        if (name || account) add({ account, name, bu, customerGroup, role: explicitRole || '申请人', attendance: 'Attend on Time' });
                    }
                    if (tdNameIdx >= 0 || tdIdIdx >= 0) {
                        const name = tdNameIdx >= 0 ? String(row[tdNameIdx] || '').trim() : '';
                        const account = tdIdIdx >= 0 ? String(row[tdIdIdx] || '').trim() : '';
                        if (name || account) add({ account, name, bu, customerGroup, role: explicitRole || 'TD', attendance: 'Attend on Time' });
                    }
                } else if (isRfc) {
                    rfcRoles.forEach(cfg => {
                        const colIdx = headers.findIndex(h => cfg.re.test(h));
                        if (colIdx >= 0) {
                            parsePeopleTokens(row[colIdx]).forEach(p => {
                                add({ account: p.account, name: p.name, bu, customerGroup, role: explicitRole || cfg.role, attendance: 'Attend on Time' });
                            });
                        }
                    });
                } else if (isWfm) {
                    wfmRoles.forEach(cfg => {
                        const colIdx = headers.findIndex(h => cfg.re.test(h));
                        if (colIdx >= 0) {
                            parsePeopleTokens(row[colIdx]).forEach(p => {
                                add({ account: p.account, name: p.name, bu, customerGroup, role: explicitRole || cfg.role, attendance: 'Attend on Time' });
                            });
                        }
                    });
                }

                // Generic row fallback
                if (nameIdx >= 0 || idIdx >= 0) {
                    const name = nameIdx >= 0 ? String(row[nameIdx] || '').trim() : '';
                    const account = idIdx >= 0 ? String(row[idIdx] || '').trim() : '';
                    if (name || account) {
                        add({ account, name, bu, customerGroup, role: explicitRole || '', attendance: 'Attend on Time' });
                    }
                }
            });
        });
    }

    if (Array.isArray(snapshot.payload?.attendees) && snapshot.payload.attendees.length) {
        snapshot.payload.attendees.forEach(add);
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
            const actualDate = match.date || match.actualDate || (match.attendanceTime && match.attendanceTime.match(/\d{4}-\d{2}-\d{2}/)?.[0]) || (match.reason && match.reason.match(/\d{4}-\d{2}-\d{2}/)?.[0]) || (snap.title && snap.title.match(/\b(20\d\d[-_/.](?:0?[1-9]|1[0-2])[-_/.](?:0?[1-9]|[12]\d|3[01]))\b/)?.[1]?.replace(/[/_.]/g, '-')) || snap.meetingDate || snap.meeting_date || '';
            const item = {
                snapshotId: snap.id,
                title: snap.title,
                meetingDate: actualDate || snap.meetingDate || snap.meeting_date || '',
                actualDate: actualDate || snap.meetingDate || snap.meeting_date || '',
                attendanceDate: actualDate || snap.meetingDate || snap.meeting_date || '',
                attendanceTime: match.attendanceTime || '',
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
    const snapshots = await listSnapshots({ includePayload: false });

    const getDigits = s => {
        const d = String(s || '').replace(/^[a-z]+/i, '').trim();
        return d.length >= 5 ? d : '';
    };

    const snapshotAttendeesList = [];
    for (const s of snapshots) {
        let snapToUse = s;
        if (!Array.isArray(s.summary?.attendees) || !s.summary.attendees.length) {
            try {
                const full = await getSnapshot(s.id);
                if (full) snapToUse = full;
            } catch (_) {}
        }
        const attendees = getSnapshotAttendees(snapToUse);
        const attById = new Map();
        const attByName = new Map();
        for (const a of attendees) {
            const aid = String(a.account || a.staffId || a.id || '').trim().toLowerCase();
            const aname = String(a.name || '').trim().toLowerCase();
            if (aid) {
                attById.set(aid, a);
                if (aid.startsWith('m')) attById.set(aid.slice(1), a);
                const digits = getDigits(aid);
                if (digits) attById.set(digits, a);
            }
            if (aname) {
                if (!attByName.has(aname)) attByName.set(aname, []);
                attByName.get(aname).push(a);
            }
        }
        snapshotAttendeesList.push({
            snapshotId: snapToUse.id,
            title: snapToUse.title,
            meetingDate: snapToUse.meetingDate || snapToUse.meeting_date || '',
            attendees,
            attById,
            attByName
        });
    }

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
            let match = null;
            if (queryId) {
                const qId = queryId.toLowerCase();
                match = snap.attById.get(qId);
                if (!match && qId.startsWith('m')) match = snap.attById.get(qId.slice(1));
                if (!match) match = snap.attById.get('m' + qId);
                if (!match) {
                    const digits = getDigits(qId);
                    if (digits) match = snap.attById.get(digits);
                }
            }
            if (!match && queryName) {
                const qName = queryName.toLowerCase();
                const list = snap.attByName.get(qName);
                if (list && list.length) {
                    for (const a of list) {
                        const aid = String(a.account || a.staffId || a.id || '').trim();
                        if (!queryId || !aid || areStaffIdsEquivalent(queryId, aid)) {
                            match = a;
                            break;
                        }
                    }
                }
            }
            if (!match) {
                match = snap.attendees.find(a => matchPerson(a, queryId, queryName));
            }

            if (match) {
                const rawAtt = match.attendance || match.status || 'Attend on Time';
                const isAnomaly = isAttendanceAnomaly(rawAtt);
                const attLower = String(rawAtt).toLowerCase();
                const issueType = (attLower.includes('absent') || rawAtt.includes('缺席')) ? 'absent' : 'delay';
                const actualDate = match.date || match.actualDate || (match.attendanceTime && match.attendanceTime.match(/\d{4}-\d{2}-\d{2}/)?.[0]) || (match.reason && match.reason.match(/\d{4}-\d{2}-\d{2}/)?.[0]) || (snap.title && snap.title.match(/\b(20\d\d[-_/.](?:0?[1-9]|1[0-2])[-_/.](?:0?[1-9]|[12]\d|3[01]))\b/)?.[1]?.replace(/[/_.]/g, '-')) || snap.meetingDate || snap.meeting_date || '';
                const item = {
                    snapshotId: snap.snapshotId,
                    title: snap.title,
                    meetingDate: actualDate || snap.meetingDate || '',
                    actualDate: actualDate || snap.meetingDate || '',
                    attendanceDate: actualDate || snap.meetingDate || '',
                    attendanceTime: match.attendanceTime || '',
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

function normName(str) {
    if (!str) return '';
    return String(str).replace(/[\(（].*?[\)）]/g, '').replace(/[\/\\].*$/, '').replace(/\s+/g, '').trim().toLowerCase();
}

function isChinese(str) {
    return /[\u4e00-\u9fa5]/.test(String(str || ''));
}

function preferCanonicalName(n1, n2) {
    const s1 = String(n1 || '').trim();
    const s2 = String(n2 || '').trim();
    if (!s1) return s2;
    if (!s2) return s1;
    if (s1 === s2) return s1;
    if (isChinese(s1) && !isChinese(s2)) return s1;
    if (isChinese(s2) && !isChinese(s1)) return s2;
    const hasBracket1 = /[\(（]/.test(s1);
    const hasBracket2 = /[\(（]/.test(s2);
    if (!hasBracket1 && hasBracket2) return s1;
    if (!hasBracket2 && hasBracket1) return s2;
    return s1.length <= s2.length ? s1 : s2;
}

async function extractRoster() {
    await ensureReady();
    const snapshots = await listSnapshots({ includePayload: true });
    const rosterMap = new Map();
    const candById = new Map();
    const candByDigits = new Map();
    const candByName = new Map();

    const getDigits = s => {
        const d = String(s || '').replace(/^[a-z]+/i, '').trim();
        return d.length >= 5 ? d : '';
    };

    const registerCandidate = (c) => {
        if (c.staffId) {
            const sid = c.staffId.toLowerCase();
            candById.set(sid, c);
            if (sid.startsWith('m')) candById.set(sid.slice(1), c);
            const digits = getDigits(sid);
            if (digits) candByDigits.set(digits, c);
        }
        if (c.id && c.id !== c.staffId) {
            const cid = c.id.toLowerCase();
            candById.set(cid, c);
            if (cid.startsWith('m')) candById.set(cid.slice(1), c);
            const digits = getDigits(cid);
            if (digits) candByDigits.set(digits, c);
        }
        if (c.name) {
            const norm = normName(c.name);
            if (norm) {
                if (!candByName.has(norm)) candByName.set(norm, []);
                const list = candByName.get(norm);
                if (!list.includes(c)) list.push(c);
            }
            const lowerName = c.name.trim().toLowerCase();
            if (lowerName) {
                if (!candByName.has(lowerName)) candByName.set(lowerName, []);
                const list = candByName.get(lowerName);
                if (!list.includes(c)) list.push(c);
            }
        }
    };

    const findExisting = (id, name) => {
        if (id) {
            const sid = id.toLowerCase();
            let c = candById.get(sid);
            if (!c && sid.startsWith('m')) {
                c = candById.get(sid.slice(1));
            }
            if (!c) {
                c = candById.get('m' + sid);
            }
            if (!c) {
                const digits = getDigits(sid);
                if (digits) c = candByDigits.get(digits);
            }
            if (c) return c;
        }

        if (name) {
            const norm = normName(name);
            const candidates = (norm && candByName.get(norm)) || candByName.get(name.trim().toLowerCase());
            if (candidates && candidates.length) {
                for (const c of candidates) {
                    if (!id || !c.staffId || areStaffIdsEquivalent(id, c.staffId)) {
                        return c;
                    }
                }
            }
        }
        return null;
    };

    for (const snap of snapshots) {
        const attendees = getSnapshotAttendees(snap);
        for (const a of attendees) {
            let id = String(a.account || a.staffId || a.id || '').trim();
            let name = String(a.name || '').trim();
            if (isInvalidStaffId(id)) {
                id = '';
            }
            if (isOrderNumber(name)) {
                name = '';
            }
            if (!id && !name) continue;
            if (isTotalRow(id, name)) continue;

            const existingEntry = findExisting(id, name);
            const snapTitle = snap.title || '';
            const snapDate = snap.meetingDate || snap.meeting_date || '';
            const isPm = /^\s*pm\s*$/i.test(a.role || '');
            const resolvedBu = isPm ? 'PMO' : (a.bu || a.businessUnit || '');

            const traces = Array.isArray(a.sourceTraces) ? [...a.sourceTraces] : [];
            if (!existingEntry) {
                const key = id ? id.toLowerCase() : name.toLowerCase();
                const cGroups = Array.isArray(a.customerGroups) && a.customerGroups.length ? [...a.customerGroups] : (a.customerGroup ? [a.customerGroup] : []);
                const rRoles = Array.isArray(a.roles) && a.roles.length ? [...a.roles] : (a.role ? [a.role] : []);
                const newEntry = {
                    id: id || name,
                    staffId: id || '',
                    name: name || id,
                    bu: resolvedBu,
                    businessUnit: resolvedBu,
                    customerGroup: cGroups.join(', ') || a.customerGroup || '',
                    customerGroups: cGroups,
                    role: rRoles.join(', ') || a.role || '',
                    roles: rRoles,
                    source: 'meeting',
                    sourceType: 'meeting',
                    snapshotTitle: snapTitle,
                    snapshotTitles: snapTitle ? [snapTitle] : [],
                    snapshotDate: snapDate,
                    meetingDates: snapDate ? [snapDate] : [],
                    sourceTraces: traces
                };
                rosterMap.set(key, newEntry);
                registerCandidate(newEntry);
            } else {
                const canonicalId = preferCanonicalStaffId(existingEntry.staffId, id);
                if (canonicalId && canonicalId !== existingEntry.staffId) {
                    existingEntry.staffId = canonicalId;
                    existingEntry.id = canonicalId;
                    rosterMap.set(canonicalId.toLowerCase(), existingEntry);
                    registerCandidate(existingEntry);
                }
                if (!existingEntry.name && name) {
                    existingEntry.name = name;
                    registerCandidate(existingEntry);
                } else if (name) {
                    const prevName = existingEntry.name;
                    existingEntry.name = preferCanonicalName(existingEntry.name, name);
                    if (existingEntry.name !== prevName) {
                        registerCandidate(existingEntry);
                    }
                }

                // Accumulate customer groups
                if (!Array.isArray(existingEntry.customerGroups)) {
                    existingEntry.customerGroups = existingEntry.customerGroup ? [existingEntry.customerGroup] : [];
                }
                const newGroups = Array.isArray(a.customerGroups) && a.customerGroups.length ? a.customerGroups : (a.customerGroup ? [a.customerGroup] : []);
                for (const g of newGroups) {
                    if (g && !existingEntry.customerGroups.includes(g)) {
                        existingEntry.customerGroups.push(g);
                    }
                }
                existingEntry.customerGroup = existingEntry.customerGroups.join(', ');

                // Accumulate roles
                if (!Array.isArray(existingEntry.roles)) {
                    existingEntry.roles = existingEntry.role ? [existingEntry.role] : [];
                }
                const newRoles = Array.isArray(a.roles) && a.roles.length ? a.roles : (a.role ? [a.role] : []);
                for (const r of newRoles) {
                    if (r && !existingEntry.roles.includes(r)) {
                        existingEntry.roles.push(r);
                    }
                }
                existingEntry.role = existingEntry.roles.join(', ');

                // BU remains singular: if any role is PM, BU is PMO
                const anyPm = isPm || existingEntry.roles.some(r => /^\s*pm\s*$/i.test(r));
                if (anyPm) {
                    existingEntry.bu = 'PMO';
                    existingEntry.businessUnit = 'PMO';
                } else if (!existingEntry.bu && resolvedBu) {
                    existingEntry.bu = resolvedBu;
                    existingEntry.businessUnit = resolvedBu;
                }

                if (snapTitle && !existingEntry.snapshotTitles.includes(snapTitle)) existingEntry.snapshotTitles.push(snapTitle);
                if (snapDate && !existingEntry.meetingDates.includes(snapDate)) existingEntry.meetingDates.push(snapDate);

                if (traces.length) {
                    if (!Array.isArray(existingEntry.sourceTraces)) existingEntry.sourceTraces = [];
                    for (const t of traces) {
                        if (!existingEntry.sourceTraces.some(et => et.snapshotTitle === t.snapshotTitle && et.rowNumber === t.rowNumber && et.field === t.field)) {
                            existingEntry.sourceTraces.push(t);
                        }
                    }
                }
            }
        }
    }

    // 最终唯一性收敛：同姓名记录强制聚合，优先保留非空工号
    const converged = [];
    const convById = new Map();
    const convByName = new Map();

    for (const cand of rosterMap.values()) {
        const sid = String(cand.staffId || '').trim();
        const nm = String(cand.name || '').trim();
        const norm = normName(nm);

        let target = null;
        if (sid) {
            target = convById.get(sid.toLowerCase());
            if (!target) {
                const digits = getDigits(sid);
                if (digits) target = convById.get('digits:' + digits);
            }
        }
        if (!target && norm) {
            target = convByName.get(norm);
        }

        if (!target) {
            target = { ...cand };
            converged.push(target);
            if (sid) {
                convById.set(sid.toLowerCase(), target);
                const digits = getDigits(sid);
                if (digits) convById.set('digits:' + digits, target);
            }
            if (norm) convByName.set(norm, target);
        } else {
            const canonicalId = preferCanonicalStaffId(target.staffId, sid);
            if (canonicalId) {
                target.staffId = canonicalId;
                target.id = canonicalId;
                convById.set(canonicalId.toLowerCase(), target);
                const digits = getDigits(canonicalId);
                if (digits) convById.set('digits:' + digits, target);
            }
            target.name = preferCanonicalName(target.name, nm);
            const targetNorm = normName(target.name);
            if (targetNorm) convByName.set(targetNorm, target);

            // Merge customer groups
            if (!Array.isArray(target.customerGroups)) target.customerGroups = target.customerGroup ? [target.customerGroup] : [];
            const newGroups = Array.isArray(cand.customerGroups) && cand.customerGroups.length ? cand.customerGroups : (cand.customerGroup ? [cand.customerGroup] : []);
            for (const g of newGroups) {
                if (g && !target.customerGroups.includes(g)) target.customerGroups.push(g);
            }
            target.customerGroup = target.customerGroups.join(', ');

            // Merge roles
            if (!Array.isArray(target.roles)) target.roles = target.role ? [target.role] : [];
            const newRoles = Array.isArray(cand.roles) && cand.roles.length ? cand.roles : (cand.role ? [cand.role] : []);
            for (const r of newRoles) {
                if (r && !target.roles.includes(r)) target.roles.push(r);
            }
            target.role = target.roles.join(', ');

            if (target.roles.some(r => /^\s*pm\s*$/i.test(r))) {
                target.bu = 'PMO';
                target.businessUnit = 'PMO';
            } else if (!target.bu && cand.bu) {
                target.bu = cand.bu;
                target.businessUnit = cand.bu;
            }

            cand.snapshotTitles?.forEach(t => { if (!target.snapshotTitles.includes(t)) target.snapshotTitles.push(t); });
            cand.meetingDates?.forEach(d => { if (!target.meetingDates.includes(d)) target.meetingDates.push(d); });

            if (Array.isArray(cand.sourceTraces)) {
                if (!Array.isArray(target.sourceTraces)) target.sourceTraces = [];
                for (const t of cand.sourceTraces) {
                    if (!target.sourceTraces.some(et => et.snapshotTitle === t.snapshotTitle && et.rowNumber === t.rowNumber && et.field === t.field)) {
                        target.sourceTraces.push(t);
                    }
                }
            }
        }
    }

    return converged.sort((a, b) => (a.staffId || a.id || '').localeCompare(b.staffId || b.id || ''));
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
