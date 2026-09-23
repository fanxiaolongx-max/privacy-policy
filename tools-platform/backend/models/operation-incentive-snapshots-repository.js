const { run, get, all, getDbPath } = require('./app-db');

const initPromises = new Map();

async function ensureReady() {
    const key = getDbPath();
    if (!initPromises.has(key)) {
        const task = (async () => {
            await run(`
                CREATE TABLE IF NOT EXISTS operation_incentive_snapshots (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    period TEXT DEFAULT '',
                    source_file TEXT DEFAULT '',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    summary_json TEXT,
                    payload_json TEXT NOT NULL
                )
            `);
            await run(`
                CREATE INDEX IF NOT EXISTS idx_operation_incentive_snapshots_lookup
                ON operation_incentive_snapshots(period DESC, updated_at DESC)
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
async function listSnapshots({ search, period, startDate, endDate, includePayload = false, full = false } = {}) {
    await ensureReady();
    const conditions = [];
    const params = [];
    const withPayload = Boolean(includePayload || full);
    if (search) {
        const query = `%${String(search).trim()}%`;
        conditions.push('(title LIKE ? OR period LIKE ? OR source_file LIKE ? OR id LIKE ?)');
        params.push(query, query, query, query);
    }
    if (period) {
        conditions.push('period LIKE ?');
        params.push(`%${String(period).trim()}%`);
    }
    if (startDate) {
        conditions.push('period >= ?');
        params.push(String(startDate).trim());
    }
    if (endDate) {
        conditions.push('period <= ?');
        params.push(String(endDate).trim());
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
        SELECT id, title, period, source_file, created_at, updated_at, summary_json
        ${withPayload ? ', payload_json' : ''}
        FROM operation_incentive_snapshots
        ${whereClause}
        ORDER BY period DESC, updated_at DESC, id DESC
    `;

    const rows = await all(query, params);
    return rows.map(row => {
        const item = {
            id: row.id,
            title: row.title,
            period: row.period,
            sourceFile: row.source_file,
            source_file: row.source_file,
            createdAt: row.created_at,
            created_at: row.created_at,
            updatedAt: row.updated_at,
            updated_at: row.updated_at,
            summary: parseJson(row.summary_json, {})
        };
        if (withPayload) {
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
        SELECT id, title, period, source_file, created_at, updated_at, summary_json, payload_json
        FROM operation_incentive_snapshots
        WHERE id = ?
    `, [snapId]);

    if (!row) return null;

    return {
        id: row.id,
        title: row.title,
        period: row.period,
        sourceFile: row.source_file,
        source_file: row.source_file,
        createdAt: row.created_at,
        created_at: row.created_at,
        updatedAt: row.updated_at,
        updated_at: row.updated_at,
        summary: parseJson(row.summary_json, {}),
        payload: parseJson(row.payload_json, null)
    };
}

async function saveSnapshot({ id, title, period, sourceFile, summary = {}, payload = {} }) {
    await ensureReady();
    const periodStr = String(period || '').trim() || new Date().toISOString().slice(0, 7);
    const snapId = String(id || '').trim() || `inc_${periodStr.replace(/[^0-9a-zA-Z]/g, '')}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const snapTitle = String(title || '').trim() || `${periodStr} 操作激励核算快照`;
    const sourceFileName = String(sourceFile || payload?.sourceFileName || '').trim();

    const summaryJson = JSON.stringify(summary || {});
    const payloadJson = JSON.stringify(payload || {});

    await run(`
        INSERT INTO operation_incentive_snapshots (
            id, title, period, source_file, created_at, updated_at, summary_json, payload_json
        ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            period = excluded.period,
            source_file = excluded.source_file,
            summary_json = excluded.summary_json,
            payload_json = excluded.payload_json,
            updated_at = CURRENT_TIMESTAMP
    `, [snapId, snapTitle, periodStr, sourceFileName, summaryJson, payloadJson]);

    return getSnapshot(snapId);
}

async function renameSnapshot(id, newTitle) {
    await ensureReady();
    const snapId = String(id || '').trim();
    const title = String(newTitle || '').trim();
    if (!snapId || !title) return null;

    await run(`
        UPDATE operation_incentive_snapshots
        SET title = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [title, snapId]);

    return getSnapshot(snapId);
}

async function deleteSnapshot(id) {
    await ensureReady();
    const snapId = String(id || '').trim();
    if (!snapId) return false;

    const result = await run(`
        DELETE FROM operation_incentive_snapshots
        WHERE id = ?
    `, [snapId]);

    return (result?.changes || 0) > 0;
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

    // Check normalized digits if >= 5 digits
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

function isEmploymentCategory(str) {
    if (!str) return false;
    const s = String(str).trim();
    return /^(自有|租赁|合作|外包|派遣|自有人|租赁人|合作方|全职|兼职|自有员工|租赁员工|合作人员)$/i.test(s)
        || /属性|用工性质|用工类型|员工分类|雇佣/i.test(s);
}

function extractNameFromFullname(raw, id) {
    if (!raw) return '';
    const str = String(raw).trim();
    if (!str) return '';
    if (id) {
        const normId = String(id).trim().toLowerCase();
        const parts = str.split(/\s+/).filter(Boolean);
        const filtered = parts.filter(p => p.toLowerCase() !== normId && (!normId.startsWith('u') || p.toLowerCase() !== normId.slice(1)));
        if (filtered.length > 0) return filtered.join(' ');
    }
    const m = str.match(/^([^\s(/]+)/);
    return m ? m[1] : str;
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

function splitAndParsePeople(rawStr, defaultStaffId = '', defaultName = '') {
    if (!rawStr) return [];
    const text = String(rawStr).trim();
    if (!text) return [];

    const tokens = text.split(/[;\n；|]+/).map(t => t.trim()).filter(Boolean);
    const results = [];

    for (const token of tokens) {
        let name = '';
        let staffId = '';

        let m = token.match(/^(.*?)\s*[(（]([A-Za-z0-9_-]+)[)）]$/);
        if (m) {
            name = m[1].trim();
            staffId = m[2].trim();
        } else {
            m = token.match(/^([A-Za-z0-9_-]+)\s*[(（](.*?)[)）]$/);
            if (m) {
                staffId = m[1].trim();
                name = m[2].trim();
            }
        }

        if (!staffId) {
            const mEnd = token.match(/^(.*?)\s+([A-Za-z0-9_-]{4,10})$/);
            if (mEnd && !isOrderNumber(mEnd[2]) && !isInvalidStaffId(mEnd[2]) && mEnd[1].trim()) {
                name = mEnd[1].trim();
                staffId = mEnd[2].trim();
            }
        }

        if (!staffId) {
            const mStart = token.match(/^([A-Za-z0-9_-]{4,10})\s+(.*?)$/);
            if (mStart && !isOrderNumber(mStart[1]) && !isInvalidStaffId(mStart[1]) && mStart[2].trim()) {
                staffId = mStart[1].trim();
                name = mStart[2].trim();
            }
        }

        if (!staffId && !name) {
            if (/[\u4e00-\u9fa5]/.test(token) || /\s+/.test(token)) {
                name = token;
                staffId = defaultStaffId || '';
            } else if (!isInvalidStaffId(token) && /^[A-Za-z0-9_-]{4,10}$/.test(token)) {
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

function extractPeopleFromRow(r, rowIdx, snapTitle, sheetName = '计算明细') {
    const people = [];

    const addPerson = (name, staffId, fieldName, rawVal) => {
        let sid = String(staffId || '').trim();
        let nm = String(name || '').trim();
        if (isInvalidStaffId(sid)) sid = '';
        if (isOrderNumber(nm)) nm = '';
        if (nm) nm = nm.replace(/^[\s,;，；|/()（）\-]+|[\s,;，；|/()（）\-]+$/g, '').trim();
        if (!sid && !nm) return;
        if (isTotalRow(sid, nm) || /总计|合计|小计/i.test(sid) || /总计|合计|小计/i.test(nm)) return;

        const norm = normName(nm);
        // Check if already in row's people
        const existing = people.find(p => {
            if (sid && p.staffId && (sid.toLowerCase() === p.staffId.toLowerCase() || areStaffIdsEquivalent(sid, p.staffId))) return true;
            if (norm && normName(p.name) === norm) return true;
            return false;
        });

        const trace = {
            source: 'incentive',
            sourceName: '操作激励快照',
            snapshotTitle: snapTitle || '操作激励快照',
            sheetName: sheetName,
            rowNumber: rowIdx + 1,
            field: fieldName || '操作人',
            raw: String(rawVal || `${nm} ${sid}`).trim()
        };

        if (existing) {
            const canonicalId = preferCanonicalStaffId(existing.staffId, sid);
            if (canonicalId) existing.staffId = canonicalId;
            existing.name = preferCanonicalName(existing.name, nm);
            if (!existing.traces.some(t => t.field === trace.field && t.raw === trace.raw)) {
                existing.traces.push(trace);
            }
            return;
        }

        people.push({
            name: nm || sid,
            staffId: sid || '',
            traces: [trace]
        });
    };

    // Priority 1: Multi-person / compound fields: 操作人, 方案实施人, complete_operator, solution_develop_name, operator, fme_fullname, full_name
    const compoundFields = [
        { key: '操作人', name: '操作人' },
        { key: '方案实施人', name: '方案实施人' },
        { key: 'complete_operator', name: 'complete_operator' },
        { key: 'solution_develop_name', name: 'solution_develop_name' },
        { key: 'operator', name: 'operator' },
        { key: 'fme_fullname', name: 'fme_fullname' },
        { key: 'full_name', name: 'full_name' }
    ];

    for (const { key, name: fName } of compoundFields) {
        const val = String(r[key] || '').trim();
        if (val && !/总计|合计|小计/i.test(val)) {
            const parsed = splitAndParsePeople(val);
            for (const p of parsed) {
                addPerson(p.name, p.staffId, fName, val);
            }
        }
    }

    // Priority 2: Pair-wise fields (e.g. 操作人工号 + 操作人姓名, 方案实施人工号 + 方案实施人姓名, __person + __name, staffId + name)
    const pairFields = [
        { idKey: '操作人工号', nameKey: '操作人姓名', label: '操作人' },
        { idKey: '方案实施人工号', nameKey: '方案实施人姓名', label: '方案实施人' },
        { idKey: '__person', nameKey: '__name', label: '人员' },
        { idKey: 'staffId', nameKey: 'name', label: '员工' },
        { idKey: 'account', nameKey: 'name', label: '账号' },
        { idKey: 'id', nameKey: 'name', label: 'ID' }
    ];

    for (const pair of pairFields) {
        const rawId = String(r[pair.idKey] || '').trim();
        const rawName = String(r[pair.nameKey] || '').trim();
        if (rawId || rawName) {
            if (rawId.includes(';') || rawId.includes('；') || rawName.includes(';') || rawName.includes('；')) {
                const parsedIds = splitAndParsePeople(rawId);
                const parsedNames = splitAndParsePeople(rawName);
                const maxLen = Math.max(parsedIds.length, parsedNames.length);
                for (let i = 0; i < maxLen; i++) {
                    const idItem = parsedIds[i] || {};
                    const nameItem = parsedNames[i] || {};
                    const pId = idItem.staffId || idItem.name || '';
                    const pNm = nameItem.name || idItem.name || '';
                    addPerson(pNm, pId, pair.label, `${rawName} ${rawId}`.trim());
                }
            } else {
                let pId = rawId;
                let pNm = rawName;
                const m1 = rawId.match(/^(.*?)\s*[(（]([A-Za-z0-9_-]+)[)）]$/);
                if (m1) {
                    if (!pNm) pNm = m1[1].trim();
                    pId = m1[2].trim();
                }
                addPerson(pNm, pId, pair.label, `${rawName} ${rawId}`.trim());
            }
        }
    }

    return people;
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

    const findExistingCandidate = (parsedId, parsedName) => {
        if (parsedId) {
            const sid = parsedId.toLowerCase();
            let c = candById.get(sid);
            if (!c && sid.startsWith('m')) c = candById.get(sid.slice(1));
            if (!c) c = candById.get('m' + sid);
            if (!c) {
                const digits = getDigits(sid);
                if (digits) c = candByDigits.get(digits);
            }
            if (c) return c;
        }
        if (parsedName) {
            const norm = normName(parsedName);
            const candidates = (norm && candByName.get(norm)) || candByName.get(parsedName.trim().toLowerCase());
            if (candidates && candidates.length) {
                for (const c of candidates) {
                    if (!parsedId || !c.staffId || areStaffIdsEquivalent(parsedId, c.staffId)) {
                        return c;
                    }
                }
            }
        }
        return null;
    };

    for (const snap of snapshots) {
        try {
            const period = snap.period || '';
            const title = snap.title || '';
            const rawRows = Array.isArray(snap.payload?.rawRows) ? snap.payload.rawRows : [];

            if (rawRows.length > 0) {
                for (let rIdx = 0; rIdx < rawRows.length; rIdx++) {
                    const r = rawRows[rIdx];
                    const sheetName = r.__sheet || '计算明细';
                    const bu = String(r.__bu || r.bu || r.BU || r.BU1 || r['部门'] || r.department || '').trim();
                    const customerGroup = String(
                        r.__customer || r['客户名称'] || r['客户'] || r['客户群'] || 
                        r.customer || r.customer_office || r.customerGroup || r.customerName ||
                        r['周期交叉表客户名称'] || r['计算明细客户'] || ''
                    ).trim();

                    // Detect accurate role: reject employee category (自有/租赁/合作), fallback to FME
                    let explicitRole = String(
                        r.__role || r.role || r['角色'] || r['实施人角色'] || r['操作人角色'] || 
                        r['岗位'] || r['岗位名称'] || r['工作岗位'] || r['Role'] || ''
                    ).trim();
                    if (isEmploymentCategory(explicitRole)) {
                        explicitRole = '';
                    }
                    const role = explicitRole || 'FME';

                    const rowPeople = extractPeopleFromRow(r, rIdx, title, sheetName);
                    for (const p of rowPeople) {
                        const parsedId = p.staffId;
                        const parsedName = p.name;
                        const existing = findExistingCandidate(parsedId, parsedName);
                        if (!existing) {
                            const key = parsedId ? parsedId.toLowerCase() : (parsedName ? parsedName.toLowerCase() : '');
                            if (!key) continue;
                            const cGroups = customerGroup ? [customerGroup] : [];
                            const rRoles = role ? [role] : [];
                            const newEntry = {
                                id: parsedId || parsedName,
                                staffId: parsedId || '',
                                name: parsedName || parsedId,
                                bu,
                                businessUnit: bu,
                                customerGroup,
                                customerGroups: cGroups,
                                role,
                                roles: rRoles,
                                source: 'incentive',
                                sourceType: 'incentive',
                                snapshotTitle: title,
                                snapshotTitles: title ? [title] : [],
                                snapshotPeriod: period,
                                sourceTraces: Array.isArray(p.traces) ? [...p.traces] : []
                            };
                            rosterMap.set(key, newEntry);
                            registerCandidate(newEntry);
                        } else {
                            const canonicalId = preferCanonicalStaffId(existing.staffId, parsedId);
                            if (canonicalId && canonicalId !== existing.staffId) {
                                existing.staffId = canonicalId;
                                existing.id = canonicalId;
                                rosterMap.set(canonicalId.toLowerCase(), existing);
                                registerCandidate(existing);
                            }
                            if (!existing.name && parsedName) {
                                existing.name = parsedName;
                                registerCandidate(existing);
                            } else if (parsedName) {
                                const prevName = existing.name;
                                existing.name = preferCanonicalName(existing.name, parsedName);
                                if (existing.name !== prevName) {
                                    registerCandidate(existing);
                                }
                            }
                            if (!existing.bu && bu) { existing.bu = bu; existing.businessUnit = bu; }
                            
                            // Accumulate multiple customer groups
                            if (!Array.isArray(existing.customerGroups)) {
                                existing.customerGroups = existing.customerGroup ? [existing.customerGroup] : [];
                            }
                            if (customerGroup && !existing.customerGroups.includes(customerGroup)) {
                                existing.customerGroups.push(customerGroup);
                                existing.customerGroup = existing.customerGroups.join(', ');
                            }

                            // Accumulate multiple roles
                            if (!Array.isArray(existing.roles)) {
                                existing.roles = existing.role ? [existing.role] : [];
                            }
                            if (role && !existing.roles.includes(role)) {
                                existing.roles.push(role);
                                existing.role = existing.roles.join(', ');
                            }

                            if (title && !existing.snapshotTitles.includes(title)) existing.snapshotTitles.push(title);

                            if (Array.isArray(p.traces)) {
                                if (!Array.isArray(existing.sourceTraces)) existing.sourceTraces = [];
                                for (const tr of p.traces) {
                                    if (!existing.sourceTraces.some(et => et.snapshotTitle === tr.snapshotTitle && et.rowNumber === tr.rowNumber && et.field === tr.field && et.sheetName === tr.sheetName)) {
                                        existing.sourceTraces.push(tr);
                                    }
                                }
                            }
                        }
                    }
                }
            } else if (Array.isArray(snap.summary?.topPeople)) {
                for (let pIdx = 0; pIdx < snap.summary.topPeople.length; pIdx++) {
                    const p = snap.summary.topPeople[pIdx];
                    const rawPerson = String(p.person || p.account || p.name || '').trim();
                    if (!rawPerson) continue;

                    const bu = String(p.bu || '').trim();
                    const customerGroup = String(
                        p.customerGroup || p['客户名称'] || p['客户'] || p['客户群'] || 
                        p.customer || p.customer_office || p.group || ''
                    ).trim();

                    let topRole = String(p.role || '').trim();
                    if (isEmploymentCategory(topRole)) {
                        topRole = '';
                    }
                    const role = topRole || 'FME';

                    const parsedPeople = splitAndParsePeople(rawPerson, String(p.account || p.staffId || '').trim(), String(p.name || '').trim());
                    if (!parsedPeople.length && (p.name || p.account || p.staffId)) {
                        parsedPeople.push({ name: String(p.name || p.account || p.staffId).trim(), staffId: String(p.account || p.staffId || '').trim() });
                    }

                    for (const personItem of parsedPeople) {
                        const parsedId = personItem.staffId;
                        const parsedName = personItem.name;
                        if (!parsedId && !parsedName) continue;
                        if (isTotalRow(parsedId, parsedName) || /总计|合计|小计/i.test(parsedName) || /总计|合计|小计/i.test(parsedId)) continue;

                        const trace = {
                            source: 'incentive',
                            sourceName: '操作激励快照',
                            snapshotTitle: title || '操作激励快照',
                            sheetName: '激励汇总',
                            rowNumber: pIdx + 1,
                            field: 'Top激励人员',
                            raw: rawPerson
                        };

                        const existing = findExistingCandidate(parsedId, parsedName);
                        if (!existing) {
                            const key = parsedId ? parsedId.toLowerCase() : (parsedName ? parsedName.toLowerCase() : '');
                            if (!key) continue;
                            const cGroups = customerGroup ? [customerGroup] : [];
                            const rRoles = role ? [role] : [];
                            const newEntry = {
                                id: parsedId || parsedName,
                                staffId: parsedId || '',
                                name: parsedName || parsedId,
                                bu,
                                businessUnit: bu,
                                customerGroup,
                                customerGroups: cGroups,
                                role,
                                roles: rRoles,
                                source: 'incentive',
                                sourceType: 'incentive',
                                snapshotTitle: title,
                                snapshotTitles: title ? [title] : [],
                                snapshotPeriod: period,
                                sourceTraces: [trace]
                            };
                            rosterMap.set(key, newEntry);
                            registerCandidate(newEntry);
                        } else {
                            const canonicalId = preferCanonicalStaffId(existing.staffId, parsedId);
                            if (canonicalId && canonicalId !== existing.staffId) {
                                existing.staffId = canonicalId;
                                existing.id = canonicalId;
                                rosterMap.set(canonicalId.toLowerCase(), existing);
                                registerCandidate(existing);
                            }
                            if (!existing.name && parsedName) {
                                existing.name = parsedName;
                                registerCandidate(existing);
                            } else if (parsedName) {
                                const prevName = existing.name;
                                existing.name = preferCanonicalName(existing.name, parsedName);
                                if (existing.name !== prevName) {
                                    registerCandidate(existing);
                                }
                            }
                            if (!existing.bu && bu) { existing.bu = bu; existing.businessUnit = bu; }

                            if (!Array.isArray(existing.customerGroups)) {
                                existing.customerGroups = existing.customerGroup ? [existing.customerGroup] : [];
                            }
                            if (customerGroup && !existing.customerGroups.includes(customerGroup)) {
                                existing.customerGroups.push(customerGroup);
                                existing.customerGroup = existing.customerGroups.join(', ');
                            }

                            if (!Array.isArray(existing.roles)) {
                                existing.roles = existing.role ? [existing.role] : [];
                            }
                            if (role && !existing.roles.includes(role)) {
                                existing.roles.push(role);
                                existing.role = existing.roles.join(', ');
                            }

                            if (title && !existing.snapshotTitles.includes(title)) existing.snapshotTitles.push(title);

                            if (!Array.isArray(existing.sourceTraces)) existing.sourceTraces = [];
                            if (!existing.sourceTraces.some(et => et.snapshotTitle === trace.snapshotTitle && et.rowNumber === trace.rowNumber && et.field === trace.field && et.sheetName === trace.sheetName)) {
                                existing.sourceTraces.push(trace);
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.warn('[operation-incentive-snapshots] extractRoster error in snapshot:', snap?.id, err?.message);
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

            if (!target.bu && cand.bu) {
                target.bu = cand.bu;
                target.businessUnit = cand.bu;
            }

            cand.snapshotTitles?.forEach(t => { if (!target.snapshotTitles.includes(t)) target.snapshotTitles.push(t); });

            if (Array.isArray(cand.sourceTraces)) {
                if (!Array.isArray(target.sourceTraces)) target.sourceTraces = [];
                for (const t of cand.sourceTraces) {
                    if (!target.sourceTraces.some(et => et.snapshotTitle === t.snapshotTitle && et.sheetName === t.sheetName && et.rowNumber === t.rowNumber && et.field === t.field)) {
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
    extractRoster
};
