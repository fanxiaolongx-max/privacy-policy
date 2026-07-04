const { run, get, all } = require('./app-db');
const { v4: uuidv4 } = require('uuid');

const MAX_MESSAGES = 1000;
const RECENT_CONTEXT_MESSAGES = 8;
const DEFAULT_QUESTIONS = [
    '这个页面主要看什么？',
    '当前有哪些关键指标？',
    '哪些指标未达标？',
    'GAP分别是多少？',
    '今天导入了多少文件？',
    '最近规则有没有变化？'
];

let initPromise = null;

function buildId(prefix) {
    return `${prefix}_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
}

async function ensureReady() {
    if (!initPromise) {
        initPromise = (async () => {
            await run(`
                CREATE TABLE IF NOT EXISTS ai_chat_sessions (
                    id TEXT PRIMARY KEY,
                    page_path TEXT NOT NULL DEFAULT '',
                    page_title TEXT NOT NULL DEFAULT '',
                    summary TEXT NOT NULL DEFAULT '',
                    summary_until_message_id TEXT NOT NULL DEFAULT '',
                    summary_updated_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await addColumnIfMissing('ai_chat_sessions', 'summary', "TEXT NOT NULL DEFAULT ''");
            await addColumnIfMissing('ai_chat_sessions', 'summary_until_message_id', "TEXT NOT NULL DEFAULT ''");
            await addColumnIfMissing('ai_chat_sessions', 'summary_updated_at', 'DATETIME');
            await run(`
                CREATE TABLE IF NOT EXISTS ai_chat_messages (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    page_path TEXT NOT NULL DEFAULT '',
                    page_title TEXT NOT NULL DEFAULT '',
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    tokens INTEGER DEFAULT 0,
                    cost REAL DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await run(`
                CREATE TABLE IF NOT EXISTS ai_question_suggestions (
                    id TEXT PRIMARY KEY,
                    page_path TEXT NOT NULL DEFAULT '',
                    normalized_key TEXT NOT NULL DEFAULT '',
                    question TEXT NOT NULL,
                    source TEXT NOT NULL DEFAULT 'history',
                    hit_count INTEGER DEFAULT 0,
                    enabled INTEGER DEFAULT 1,
                    last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(page_path, normalized_key)
                )
            `);
            await run('CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session ON ai_chat_messages(session_id, created_at)');
            await run('CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_page ON ai_chat_sessions(page_path, updated_at)');
            await run('CREATE INDEX IF NOT EXISTS idx_ai_question_suggestions_page ON ai_question_suggestions(page_path, enabled, hit_count, last_used_at)');
        })().catch(err => {
            initPromise = null;
            throw err;
        });
    }
    return initPromise;
}

async function addColumnIfMissing(tableName, columnName, definition) {
    const rows = await all(`PRAGMA table_info(${tableName})`);
    if (rows.some(row => row.name === columnName)) return;
    await run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

function normalizePagePath(value) {
    const raw = String(value || '').trim();
    try {
        if (/^https?:\/\//i.test(raw)) {
            const parsed = new URL(raw);
            return parsed.pathname || '/';
        }
    } catch {
        // Fall back to lightweight string cleanup below.
    }
    return raw.split('?')[0].split('#')[0].trim() || '/';
}

function normalizeQuestion(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[，。！？、,.!?;；:："'“”‘’()[\]{}<>《》\s]/g, '')
        .replace(/分别|具体|一下|请问|帮我|看看|看下/g, '')
        .replace(/差距|gap/g, 'gap')
        .replace(/未达标|不达标|不满足目标|没达标/g, '未达标')
        .slice(0, 120);
}

function cleanQuestion(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 120);
}

async function getOrCreateSession({ sessionId, pagePath, pageTitle }) {
    await ensureReady();
    const normalizedPath = normalizePagePath(pagePath);
    const cleanTitle = String(pageTitle || '').slice(0, 200);
    if (sessionId) {
        const existing = await get('SELECT id FROM ai_chat_sessions WHERE id = ?', [sessionId]);
        if (existing) {
            await run(
                `UPDATE ai_chat_sessions
                 SET page_path = ?, page_title = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [normalizedPath, cleanTitle, sessionId]
            );
            return sessionId;
        }
    }
    const id = buildId('chat');
    await run(
        `INSERT INTO ai_chat_sessions (id, page_path, page_title)
         VALUES (?, ?, ?)`,
        [id, normalizedPath, cleanTitle]
    );
    return id;
}

async function addMessage({ sessionId, pagePath, pageTitle, role, content, tokens = 0, cost = 0 }) {
    await ensureReady();
    const normalizedPath = normalizePagePath(pagePath);
    const cleanTitle = String(pageTitle || '').slice(0, 200);
    const finalSessionId = await getOrCreateSession({ sessionId, pagePath: normalizedPath, pageTitle: cleanTitle });
    await run(
        `INSERT INTO ai_chat_messages (id, session_id, page_path, page_title, role, content, tokens, cost)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            buildId('msg'),
            finalSessionId,
            normalizedPath,
            cleanTitle,
            role === 'model' ? 'model' : 'user',
            String(content || '').slice(0, 20000),
            Math.max(0, Number(tokens) || 0),
            Math.max(0, Number(cost) || 0)
        ]
    );
    await run('UPDATE ai_chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [finalSessionId]);
    await trimMessages();
    return finalSessionId;
}

async function recordQuestion({ pagePath, question }) {
    await ensureReady();
    const normalizedPath = normalizePagePath(pagePath);
    const clean = cleanQuestion(question);
    const key = normalizeQuestion(clean);
    if (!clean || key.length < 2) return null;
    const existing = await get(
        `SELECT id, question, hit_count
         FROM ai_question_suggestions
         WHERE page_path = ? AND normalized_key = ?`,
        [normalizedPath, key]
    );
    if (existing) {
        await run(
            `UPDATE ai_question_suggestions
             SET hit_count = hit_count + 1,
                 question = CASE WHEN length(question) > length(?) THEN question ELSE ? END,
                 last_used_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [clean, clean, existing.id]
        );
        return existing.id;
    }
    const id = buildId('suggest');
    await run(
        `INSERT INTO ai_question_suggestions
         (id, page_path, normalized_key, question, source, hit_count)
         VALUES (?, ?, ?, ?, 'history', 1)`,
        [id, normalizedPath, key, clean]
    );
    return id;
}

async function trimMessages() {
    await run(`
        DELETE FROM ai_chat_messages
        WHERE id NOT IN (
            SELECT id
            FROM ai_chat_messages
            ORDER BY created_at DESC, rowid DESC
            LIMIT ?
        )
    `, [MAX_MESSAGES]);
    await run(`
        DELETE FROM ai_chat_sessions
        WHERE id NOT IN (
            SELECT DISTINCT session_id FROM ai_chat_messages
        )
        AND updated_at < datetime('now', '-1 day')
    `);
}

async function listSuggestions({ pagePath, limit = 8 } = {}) {
    await ensureReady();
    const normalizedPath = normalizePagePath(pagePath);
    const safeLimit = Math.max(1, Math.min(Number(limit) || 8, 12));
    const rows = await all(
        `SELECT id, question, source, hit_count, last_used_at
         FROM ai_question_suggestions
         WHERE enabled = 1 AND (page_path = ? OR page_path = '*')
         ORDER BY page_path = ? DESC, hit_count DESC, last_used_at DESC
         LIMIT ?`,
        [normalizedPath, normalizedPath, safeLimit]
    );
    const seen = new Set();
    const items = [];
    rows.forEach(row => {
        const key = normalizeQuestion(row.question);
        if (seen.has(key)) return;
        seen.add(key);
        items.push(row);
    });
    DEFAULT_QUESTIONS.forEach(question => {
        if (items.length >= safeLimit) return;
        const key = normalizeQuestion(question);
        if (seen.has(key)) return;
        seen.add(key);
        items.push({
            id: `default:${key}`,
            question,
            source: 'default',
            hit_count: 0,
            last_used_at: null
        });
    });
    return items;
}

async function listSessions({ pagePath, limit = 20 } = {}) {
    await ensureReady();
    const normalizedPath = normalizePagePath(pagePath);
    const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 50));
    const rows = await all(
        `SELECT s.id, s.page_path, s.page_title, s.created_at, s.updated_at,
                COUNT(m.id) AS message_count,
                (
                    SELECT content
                    FROM ai_chat_messages um
                    WHERE um.session_id = s.id AND um.role = 'user'
                    ORDER BY um.created_at DESC, um.rowid DESC
                    LIMIT 1
                ) AS last_question
         FROM ai_chat_sessions s
         LEFT JOIN ai_chat_messages m ON m.session_id = s.id
         WHERE s.page_path = ?
         GROUP BY s.id
         HAVING message_count > 0
         ORDER BY s.updated_at DESC, s.rowid DESC
         LIMIT ?`,
        [normalizedPath, safeLimit]
    );
    return rows.map(row => ({
        ...row,
        last_question: String(row.last_question || '').slice(0, 120)
    }));
}

async function listMessages(sessionId) {
    await ensureReady();
    return all(
        `SELECT id, session_id, role, content, tokens, cost, created_at
         FROM ai_chat_messages
         WHERE session_id = ?
         ORDER BY created_at ASC, rowid ASC`,
        [sessionId]
    );
}

async function getSession(sessionId) {
    await ensureReady();
    if (!sessionId) return null;
    return get(
        `SELECT id, page_path, page_title, summary, summary_until_message_id, summary_updated_at, created_at, updated_at
         FROM ai_chat_sessions
         WHERE id = ?`,
        [sessionId]
    );
}

async function getMessagesForCompression(sessionId, keepRecent = RECENT_CONTEXT_MESSAGES) {
    await ensureReady();
    const session = await getSession(sessionId);
    if (!session) return { session: null, messages: [], cutoffMessageId: '' };
    const marker = session.summary_until_message_id || '';
    const markerRow = marker
        ? await get('SELECT rowid FROM ai_chat_messages WHERE id = ? AND session_id = ?', [marker, sessionId])
        : null;
    const markerRowid = markerRow ? markerRow.rowid : 0;
    const rows = await all(
        `SELECT id, rowid, role, content, created_at
         FROM ai_chat_messages
         WHERE session_id = ? AND rowid > ?
         ORDER BY rowid ASC`,
        [sessionId, markerRowid]
    );
    const compressibleCount = Math.max(0, rows.length - Math.max(2, keepRecent));
    const messages = rows.slice(0, compressibleCount);
    return {
        session,
        messages,
        cutoffMessageId: messages.length ? messages[messages.length - 1].id : ''
    };
}

async function updateSessionSummary(sessionId, { summary, summaryUntilMessageId }) {
    await ensureReady();
    await run(
        `UPDATE ai_chat_sessions
         SET summary = ?,
             summary_until_message_id = ?,
             summary_updated_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
            String(summary || '').slice(0, 12000),
            summaryUntilMessageId || '',
            sessionId
        ]
    );
}

async function getRecentMessagesForContext(sessionId, limit = RECENT_CONTEXT_MESSAGES) {
    await ensureReady();
    const safeLimit = Math.max(2, Math.min(Number(limit) || RECENT_CONTEXT_MESSAGES, 20));
    const rows = await all(
        `SELECT id, role, content, created_at
         FROM ai_chat_messages
         WHERE session_id = ?
         ORDER BY rowid DESC
         LIMIT ?`,
        [sessionId, safeLimit]
    );
    return rows.reverse();
}

module.exports = {
    ensureReady,
    getOrCreateSession,
    addMessage,
    recordQuestion,
    listSuggestions,
    listSessions,
    listMessages,
    getSession,
    getMessagesForCompression,
    updateSessionSummary,
    getRecentMessagesForContext,
    normalizePagePath
};
