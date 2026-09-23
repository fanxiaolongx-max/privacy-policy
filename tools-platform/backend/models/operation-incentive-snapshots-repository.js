const { run, get, all, getDbPath } = require('./app-db');
const { normalizeStaffId } = require('./staff-id-normalization');

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

    // 2. Prefer non-m prefix (e.g. WX1350434 over mWX1350434, 00665597 over m00665597)
    const isM1 = /^m/i.test(s1) && (s2.toLowerCase() === s1.slice(1).toLowerCase() || areStaffIdsEquivalent(s1, s2));
    const isM2 = /^m/i.test(s2) && (s1.toLowerCase() === s2.slice(1).toLowerCase() || areStaffIdsEquivalent(s1, s2));
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

    // 1. 真实姓名绝对优于工号 Token
    const isId1 = isStaffIdToken(s1) || (/^[A-Za-z0-9_-]{4,10}$/.test(s1) && /\d{3,}/.test(s1));
    const isId2 = isStaffIdToken(s2) || (/^[A-Za-z0-9_-]{4,10}$/.test(s2) && /\d{3,}/.test(s2));
    if (isId1 && !isId2) return s2;
    if (!isId1 && isId2) return s1;
    if (isId1 && isId2) return preferCanonicalStaffId ? preferCanonicalStaffId(s1, s2) : s1;

    // 2. 中文姓名优于非中文
    if (isChinese(s1) && !isChinese(s2)) return s1;
    if (isChinese(s2) && !isChinese(s1)) return s2;

    // 3. 不带括号的纯姓名优于带括号（如包含标注/角色）的姓名
    const hasBracket1 = /[\(（]/.test(s1);
    const hasBracket2 = /[\(（]/.test(s2);
    if (!hasBracket1 && hasBracket2) return s1;
    if (!hasBracket2 && hasBracket1) return s2;

    // 4. 外文多词完整姓名优于单词或残缺名（如 "Ahmed Helmy" 优于 "Ahmed"）
    const words1 = s1.split(/\s+/).filter(Boolean);
    const words2 = s2.split(/\s+/).filter(Boolean);
    if (!isChinese(s1) && !isChinese(s2)) {
        if (words1.length !== words2.length) {
            return words1.length > words2.length ? s1 : s2;
        }
    }

    return s1.length <= s2.length ? s1 : s2;
}

function splitDelimited(val) {
    if (!val) return [];
    if (Array.isArray(val)) {
        return [...new Set(val.flatMap(x => String(x || '').split(/[,，;/]+/).map(s => s.trim()).filter(Boolean)))];
    }
    return [...new Set(String(val).split(/[,，;/]+/).map(s => s.trim()).filter(Boolean))];
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
    // Must contain at least 3 digits
    const digits = s.replace(/\D/g, '');
    if (digits.length < 3) return false;
    // Common staff ID patterns:
    // e.g. 00909378, 84347085, a84237671, yWX1232731, mWX1350434, WX1350434, T8801, etc.
    return /^[A-Za-z]{0,4}\d{3,9}[A-Za-z]?$/i.test(s);
}

function cleanNameAndStaffId(rawName, existingStaffId = '') {
    let name = String(rawName || '').trim();
    let staffId = String(existingStaffId || '').trim();

    if (!name) {
        if (staffId && !isStaffIdToken(staffId)) {
            return cleanNameAndStaffId(staffId, '');
        }
        if (isInvalidStaffId(staffId)) staffId = '';
        return { name: '', staffId };
    }
    if (isInvalidStaffId(staffId)) staffId = '';

    if (isStaffIdToken(name)) {
        if (staffId && !isStaffIdToken(staffId)) {
            return cleanNameAndStaffId(staffId, name);
        }
        staffId = preferCanonicalStaffId ? preferCanonicalStaffId(staffId, name) : (staffId || name);
        return { name: '', staffId };
    }

    // 1. Bracketed pattern: e.g. "Mahmoud Elnaggar (00909378)", "Mahmoud Elnaggar(a84237671)", "张三(yWX1232731)"
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

    // 2. Suffix pattern: e.g. "Mahmoud Elnaggar 00909378", "Ahmed Ali a84237671", "Hassan yWX1232731"
    const mSuffix = name.match(/^(.*?)\s+([A-Za-z0-9_-]{4,10})$/);
    if (mSuffix && isStaffIdToken(mSuffix[2])) {
        name = mSuffix[1].trim();
        staffId = preferCanonicalStaffId(staffId, mSuffix[2].trim());
    }

    // 3. Prefix pattern: e.g. "00909378 Mahmoud Elnaggar", "a84237671 Ahmed Ali"
    const mPrefix = name.match(/^([A-Za-z0-9_-]{4,10})\s+(.*?)$/);
    if (mPrefix && isStaffIdToken(mPrefix[1])) {
        staffId = preferCanonicalStaffId(staffId, mPrefix[1].trim());
        name = mPrefix[2].trim();
    }

    // 4. If staffId is known and exists inside name, strip it without breaking the rest of the name
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

    // Clean edge punctuation
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
            if ((!existing.name || isStaffIdToken(existing.name) || existing.name === existing.staffId) && nm && !isStaffIdToken(nm)) {
                existing.name = nm;
            } else if (nm) {
                existing.name = preferCanonicalName(existing.name, nm);
            }
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

function getPersonnelPeriodSummaryRows(snap) {
    if (!snap) return [];

    // 1. Check summary.personnelSummary or payload.personnelSummary
    const summaryList = Array.isArray(snap.summary?.personnelSummary) && snap.summary.personnelSummary.length
        ? snap.summary.personnelSummary
        : (Array.isArray(snap.summary?.['人员周期汇总']) && snap.summary['人员周期汇总'].length
            ? snap.summary['人员周期汇总']
            : (Array.isArray(snap.payload?.personnelSummary) && snap.payload.personnelSummary.length
                ? snap.payload.personnelSummary
                : (Array.isArray(snap.payload?.['人员周期汇总']) && snap.payload['人员周期汇总'].length
                    ? snap.payload['人员周期汇总']
                    : null)));

    if (summaryList && summaryList.length > 0) {
        return summaryList;
    }

    // 2. Check payload.sheets for explicit sheet named "人员周期汇总"
    const sheets = Array.isArray(snap.payload?.sheets) ? snap.payload.sheets : [];
    const summarySheet = sheets.find(s => String(s.sheetName || s.name || '').trim() === '人员周期汇总');
    if (summarySheet) {
        const rows = summarySheet.rows || summarySheet.data || [];
        const headers = Array.isArray(summarySheet.headers) ? summarySheet.headers.map(h => String(h || '').trim()) : [];
        if (rows.length > 0 && Array.isArray(rows[0]) && headers.length > 0) {
            return rows.map(r => {
                const obj = {};
                headers.forEach((h, idx) => {
                    obj[h] = r[idx];
                });
                return obj;
            });
        }
        return rows;
    }

    // 3. Check payload.rawRows for rows belonging to "人员周期汇总"
    const rawRows = Array.isArray(snap.payload?.rawRows) ? snap.payload.rawRows : [];
    const directRows = rawRows.filter(r => String(r.__sheet || r.sheetName || '').trim() === '人员周期汇总');
    if (directRows.length > 0) {
        return directRows;
    }

    // 4. Fallback: synthesize "人员周期汇总" from rawRows (for legacy snapshots without pre-computed summary sheet)
    if (rawRows.length > 0) {
        const opMap = new Map();
        for (const r of rawRows) {
            let op = String(r['操作人'] || r.__person || r.operator || r.account || r.staffId || r.complete_operator || '').trim();
            let nm = String(r['姓名'] || r.name || r.__name || r.__fmeName || '').trim();
            const bu = String(r['BU1 / 部门'] || r['BU1/部门'] || r['BU1'] || r['部门'] || r.__bu || r.bu || r.department || '').trim();
            const cust = String(r['客户'] || r['客户群'] || r['客户名称'] || r.__customer || r.customer || r.customerGroup || '').trim();

            if (!nm && op) {
                if (!/[;\n；|]+/.test(op)) {
                    const cleaned = cleanNameAndStaffId(op, '');
                    if (cleaned.name && cleaned.staffId) {
                        nm = cleaned.name;
                        op = cleaned.staffId;
                    }
                }
            } else if (nm && !op) {
                if (!/[;\n；|]+/.test(nm)) {
                    const cleaned = cleanNameAndStaffId(nm, '');
                    if (cleaned.name && cleaned.staffId) {
                        nm = cleaned.name;
                        op = cleaned.staffId;
                    }
                }
            }

            const key = op || nm;
            if (!key) continue;

            if (!opMap.has(key)) {
                opMap.set(key, {
                    '操作人': op,
                    '姓名': nm,
                    'BU1 / 部门': bu,
                    '客户': cust,
                    _buSet: new Set(bu ? [bu] : []),
                    _custSet: new Set(cust ? [cust] : [])
                });
            } else {
                const entry = opMap.get(key);
                if (!entry['操作人'] && op) entry['操作人'] = op;
                if (!entry['姓名'] && nm) entry['姓名'] = nm;
                if (bu) entry._buSet.add(bu);
                if (cust) entry._custSet.add(cust);
            }
        }
        return [...opMap.values()].map(x => ({
            '操作人': x['操作人'],
            '姓名': x['姓名'],
            'BU1 / 部门': [...x._buSet].join(' / ') || x['BU1 / 部门'],
            '客户': [...x._custSet].join(' / ') || x['客户']
        }));
    }

    // 5. Fallback from topPeople
    if (Array.isArray(snap.summary?.topPeople) && snap.summary.topPeople.length) {
        return snap.summary.topPeople.map(p => ({
            '操作人': String(p.person || p.account || p.staffId || '').trim(),
            '姓名': String(p.name || '').trim(),
            'BU1 / 部门': String(p.bu || '').trim(),
            '客户': String(p.customerGroup || p['客户名称'] || p['客户'] || p['客户群'] || '').trim()
        }));
    }

    return [];
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
            // 核心原则：严格仅提取“人员周期汇总”，跳过其他所有明细表
            const summaryRows = getPersonnelPeriodSummaryRows(snap);

            for (let rIdx = 0; rIdx < summaryRows.length; rIdx++) {
                const r = summaryRows[rIdx];
                const rawStaffId = String(r['操作人'] || r['工号'] || r['账号'] || r.staffId || r.account || r.operator || r.person || r.__person || r.complete_operator || '').trim();
                const rawName = String(r['姓名'] || r['纯姓名'] || r.name || r.__name || r.__fmeName || '').trim();
                const bu = String(r['BU1 / 部门'] || r['BU1/部门'] || r['BU1'] || r['部门'] || r.bu || r.businessUnit || r.department || r.__bu || '').trim();
                const customerGroup = String(r['客户'] || r['客户群'] || r['客户名称'] || r.customer || r.customerGroup || r.__customer || '').trim();

                let parsedPeople = [];
                const hasMultiId = /[;\n；|]+/.test(rawStaffId);
                const hasMultiName = /[;\n；|]+/.test(rawName);

                if (hasMultiId || hasMultiName) {
                    if (hasMultiId && hasMultiName) {
                        const parsedIds = splitAndParsePeople(rawStaffId);
                        const parsedNames = splitAndParsePeople(rawName);
                        const maxLen = Math.max(parsedIds.length, parsedNames.length);
                        for (let i = 0; i < maxLen; i++) {
                            const idItem = parsedIds[i] || {};
                            const nameItem = parsedNames[i] || {};
                            const pId = idItem.staffId || idItem.name || '';
                            const pNm = nameItem.name || idItem.name || '';
                            parsedPeople.push(cleanNameAndStaffId(pNm, pId));
                        }
                    } else if (hasMultiId) {
                        parsedPeople = splitAndParsePeople(rawStaffId);
                    } else {
                        parsedPeople = splitAndParsePeople(rawName);
                    }
                } else {
                    if (rawName && rawStaffId) {
                        parsedPeople = [cleanNameAndStaffId(rawName, rawStaffId)];
                    } else if (rawName) {
                        parsedPeople = [cleanNameAndStaffId(rawName, '')];
                    } else if (rawStaffId) {
                        parsedPeople = [cleanNameAndStaffId(rawStaffId, '')];
                    }
                }

                for (const p of parsedPeople) {
                    const cleaned = cleanNameAndStaffId(p.name, p.staffId);
                    let parsedId = normalizeStaffId(cleaned.staffId);
                    let parsedName = cleaned.name;

                    if (isInvalidStaffId(parsedId)) {
                        if (parsedName === parsedId || isOrderNumber(parsedName)) continue;
                        parsedId = '';
                    }
                    if (isOrderNumber(parsedName)) {
                        if (!parsedId) continue;
                        parsedName = '';
                    }
                    if (!parsedId && !parsedName) continue;
                    if (isTotalRow(parsedId, parsedName)) continue;

                    const trace = {
                        source: 'incentive',
                        sourceName: '操作激励快照',
                        snapshotTitle: title || '操作激励快照',
                        sheetName: '人员周期汇总',
                        rowNumber: rIdx + 1,
                        field: r['操作人'] ? '操作人' : (r['姓名'] ? '姓名' : '操作人'),
                        raw: `${rawStaffId} ${rawName}`.trim()
                    };

                    const existing = findExistingCandidate(parsedId, parsedName);
                    const cGroups = splitDelimited(customerGroup);
                    // 业务规则：人员周期汇总表中人员均为 FME 和 TE 双重角色
                    const rRoles = ['FME', 'TE'];

                    if (!existing) {
                        const key = parsedId ? parsedId.toLowerCase() : (parsedName ? parsedName.toLowerCase() : '');
                        if (!key) continue;
                        const newEntry = {
                            id: parsedId || parsedName,
                            staffId: parsedId || '',
                            name: parsedName,
                            bu,
                            businessUnit: bu,
                            customerGroup: cGroups.join(', ') || customerGroup,
                            customerGroups: cGroups,
                            role: 'FME, TE',
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
                        if ((!existing.name || isStaffIdToken(existing.name) || existing.name === existing.staffId) && parsedName && !isStaffIdToken(parsedName)) {
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

                        // Accumulate customer groups
                        if (!Array.isArray(existing.customerGroups)) {
                            existing.customerGroups = splitDelimited(existing.customerGroup);
                        }
                        for (const g of cGroups) {
                            if (g && !existing.customerGroups.includes(g)) {
                                existing.customerGroups.push(g);
                            }
                        }
                        existing.customerGroup = existing.customerGroups.join(', ');

                        // Ensure FME and TE roles
                        if (!Array.isArray(existing.roles)) {
                            existing.roles = splitDelimited(existing.role);
                        }
                        for (const r of ['FME', 'TE']) {
                            if (!existing.roles.includes(r)) existing.roles.push(r);
                        }
                        existing.role = existing.roles.join(', ');

                        if (title && !existing.snapshotTitles.includes(title)) existing.snapshotTitles.push(title);

                        if (!Array.isArray(existing.sourceTraces)) existing.sourceTraces = [];
                        if (!existing.sourceTraces.some(et => et.snapshotTitle === trace.snapshotTitle && et.rowNumber === trace.rowNumber && et.field === trace.field && et.sheetName === trace.sheetName)) {
                            existing.sourceTraces.push(trace);
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
            if ((!target.name || isStaffIdToken(target.name) || target.name === target.staffId) && nm && !isStaffIdToken(nm)) {
                target.name = nm;
            } else {
                target.name = preferCanonicalName(target.name, nm);
            }
            const targetNorm = normName(target.name);
            if (targetNorm) convByName.set(targetNorm, target);

            // Merge customer groups
            if (!Array.isArray(target.customerGroups)) target.customerGroups = splitDelimited(target.customerGroup);
            const newGroups = splitDelimited(Array.isArray(cand.customerGroups) && cand.customerGroups.length ? cand.customerGroups : (cand.customerGroup || ''));
            for (const g of newGroups) {
                if (g && !target.customerGroups.includes(g)) target.customerGroups.push(g);
            }
            target.customerGroup = target.customerGroups.join(', ');

            // Merge roles: guarantee FME and TE
            if (!Array.isArray(target.roles)) target.roles = splitDelimited(target.role);
            const newRoles = splitDelimited(Array.isArray(cand.roles) && cand.roles.length ? cand.roles : (cand.role || ''));
            for (const r of newRoles) {
                if (r && !target.roles.includes(r)) target.roles.push(r);
            }
            if (!target.roles.includes('FME')) target.roles.push('FME');
            if (!target.roles.includes('TE')) target.roles.push('TE');
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
    extractRoster,
    preferCanonicalStaffId,
    cleanNameAndStaffId,
    areStaffIdsEquivalent
};
