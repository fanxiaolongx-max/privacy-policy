const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const tenantPool = require('./tenant-sqlite-pool');

const DB_FILENAME = 'chat-history.db';
const HEADER_WITH_ID_RE = /^(.+?)[([（]([^()（）[\]]+)[)\]）]\s+(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})$/;
const HEADER_WITHOUT_ID_RE = /^(.+?)\s+(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})$/;
const readyByPath = new Map();
const ftsByPath = new Map();
const importQueues = new Map();

function dbPath() {
    return tenantPool.databasePath(DB_FILENAME);
}

function db() {
    return tenantPool.getConnection(DB_FILENAME);
}

function run(sql, params = []) {
    const connection = db();
    return new Promise((resolve, reject) => connection.run(sql, params, function onRun(error) {
        error ? reject(error) : resolve({ changes: this.changes, lastID: this.lastID });
    }));
}

function get(sql, params = []) {
    const connection = db();
    return new Promise((resolve, reject) => connection.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));
}

function all(sql, params = []) {
    const connection = db();
    return new Promise((resolve, reject) => connection.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
}

function cleanInline(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeRelativePath(value) {
    const normalized = String(value || '')
        .replace(/\\/g, '/')
        .split('/')
        .filter(part => part && part !== '.' && part !== '..')
        .join('/');
    if (!normalized || !/\.txt$/i.test(normalized)) throw new Error('仅支持导入 TXT 聊天文件');
    return normalized.slice(0, 1000);
}

function classifyConversation(relativePath) {
    const parts = relativePath.split('/');
    const normalized = parts.map(item => cleanInline(item).toLowerCase());
    if (normalized.some(item => item === '单聊' || item === 'single' || item === 'direct')) return 'single';
    if (normalized.some(item => item === '群组' || item === '群聊' || item === 'group' || item === 'groups')) return 'group';
    if (normalized.some(item => item === '讨论组' || item === 'discussion' || item === 'discussions')) return 'discussion';
    return 'other';
}

function displayNameFromPath(relativePath) {
    return cleanInline(path.posix.basename(relativePath).replace(/\.txt$/i, '')) || '未命名会话';
}

function digest(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function placeholders(count) {
    return Array.from({ length: count }, () => '?').join(',');
}

async function ensureReady() {
    const filePath = dbPath();
    if (!readyByPath.has(filePath)) {
        readyByPath.set(filePath, (async () => {
            await run('PRAGMA journal_mode = WAL');
            await run('PRAGMA foreign_keys = ON');
            await run('PRAGMA busy_timeout = 10000');
            await run(`CREATE TABLE IF NOT EXISTS chat_sources (
                id TEXT PRIMARY KEY,
                relative_path TEXT NOT NULL UNIQUE,
                source_hash TEXT NOT NULL DEFAULT '',
                file_size INTEGER NOT NULL DEFAULT 0,
                modified_at INTEGER NOT NULL DEFAULT 0,
                imported_at TEXT NOT NULL,
                message_count INTEGER NOT NULL DEFAULT 0
            )`);
            await run(`CREATE TABLE IF NOT EXISTS chat_conversations (
                id TEXT PRIMARY KEY,
                source_id TEXT NOT NULL UNIQUE,
                display_name TEXT NOT NULL,
                conversation_type TEXT NOT NULL DEFAULT 'other',
                last_message TEXT,
                last_message_time TEXT,
                first_message_time TEXT,
                message_count INTEGER NOT NULL DEFAULT 0,
                participant_count INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(source_id) REFERENCES chat_sources(id) ON DELETE CASCADE
            )`);
            await run(`CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id TEXT NOT NULL,
                ordinal INTEGER NOT NULL,
                stable_key TEXT NOT NULL UNIQUE,
                sender_name TEXT NOT NULL DEFAULT '',
                sender_id TEXT NOT NULL DEFAULT '',
                message_time TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                FOREIGN KEY(conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
                UNIQUE(conversation_id, ordinal)
            )`);
            await run(`CREATE TABLE IF NOT EXISTS chat_user_settings (
                user_id TEXT PRIMARY KEY,
                my_sender_id TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL
            )`);
            await run(`CREATE TABLE IF NOT EXISTS chat_user_states (
                user_id TEXT NOT NULL,
                conversation_id TEXT NOT NULL,
                pinned INTEGER NOT NULL DEFAULT 0 CHECK(pinned IN (0,1)),
                last_read_time TEXT,
                updated_at TEXT NOT NULL,
                PRIMARY KEY(user_id, conversation_id),
                FOREIGN KEY(conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
            )`);
            await run(`CREATE TABLE IF NOT EXISTS chat_favorites (
                user_id TEXT NOT NULL,
                message_stable_key TEXT NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY(user_id, message_stable_key)
            )`);
            await run(`CREATE TABLE IF NOT EXISTS chat_person_directory (
                sender_id TEXT PRIMARY KEY,
                sender_name TEXT NOT NULL,
                alias_names TEXT NOT NULL DEFAULT '',
                message_count INTEGER NOT NULL DEFAULT 0,
                conversation_count INTEGER NOT NULL DEFAULT 0,
                first_seen_at TEXT,
                last_seen_at TEXT,
                updated_at TEXT NOT NULL
            )`);
            await run('CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_time ON chat_messages(conversation_id, message_time, id)');
            await run('CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id, sender_name)');
            await run('CREATE INDEX IF NOT EXISTS idx_chat_messages_time ON chat_messages(message_time, id)');
            await run('CREATE INDEX IF NOT EXISTS idx_chat_conversations_type_time ON chat_conversations(conversation_type, last_message_time)');
            await run('CREATE INDEX IF NOT EXISTS idx_chat_person_directory_name ON chat_person_directory(sender_name)');
            let ftsAvailable = true;
            try {
                const row = await get("SELECT sql FROM sqlite_master WHERE type='table' AND name='chat_messages_fts'");
                if (row && !String(row.sql || '').toLowerCase().includes('trigram')) await run('DROP TABLE chat_messages_fts');
                await run(`CREATE VIRTUAL TABLE IF NOT EXISTS chat_messages_fts USING fts5(
                    message_id UNINDEXED,
                    conversation_id UNINDEXED,
                    sender_name,
                    sender_id,
                    content,
                    tokenize='trigram'
                )`);
                const counts = await get(`SELECT
                    (SELECT COUNT(*) FROM chat_messages) AS message_count,
                    (SELECT COUNT(*) FROM chat_messages_fts) AS fts_count`);
                if (Number(counts.message_count) !== Number(counts.fts_count)) {
                    await run('DELETE FROM chat_messages_fts');
                    await run(`INSERT INTO chat_messages_fts(message_id,conversation_id,sender_name,sender_id,content)
                        SELECT id,conversation_id,sender_name,sender_id,content FROM chat_messages`);
                }
            } catch (error) {
                ftsAvailable = false;
                console.warn(`[chat-history] FTS5 trigram unavailable, using LIKE search: ${error.message}`);
            }
            ftsByPath.set(filePath, ftsAvailable);
        })().catch(error => {
            readyByPath.delete(filePath);
            throw error;
        }));
    }
    return readyByPath.get(filePath);
}

function isFtsAvailable() {
    return ftsByPath.get(dbPath()) === true;
}

function withImportQueue(task) {
    const key = dbPath();
    const previous = importQueues.get(key) || Promise.resolve();
    const operation = previous.then(task, task);
    const tracked = operation.catch(() => {});
    importQueues.set(key, tracked);
    return operation.finally(() => {
        if (importQueues.get(key) === tracked) importQueues.delete(key);
    });
}

function parseHeader(line) {
    const text = String(line || '').trim();
    if (!text) return null;
    const withIdMatch = HEADER_WITH_ID_RE.exec(text);
    if (withIdMatch) {
        return {
            senderName: cleanInline(withIdMatch[1]),
            senderId: cleanInline(withIdMatch[2]),
            messageTime: withIdMatch[3]
        };
    }
    const withoutIdMatch = HEADER_WITHOUT_ID_RE.exec(text);
    if (withoutIdMatch) {
        const senderName = cleanInline(withoutIdMatch[1]);
        if (!senderName) return null;
        return {
            senderName,
            senderId: '',
            messageTime: withoutIdMatch[2]
        };
    }
    return null;
}

async function insertMessageBatch(rows) {
    if (!rows.length) return;
    const values = rows.map(() => '(?,?,?,?,?,?,?)').join(',');
    const params = rows.flatMap(row => [
        row.conversationId,
        row.ordinal,
        row.stableKey,
        row.senderName,
        row.senderId,
        row.messageTime,
        row.content
    ]);
    await run(`INSERT INTO chat_messages(
        conversation_id,ordinal,stable_key,sender_name,sender_id,message_time,content
    ) VALUES ${values}`, params);
}

async function importTxtFile(input) {
    await ensureReady();
    const relativePath = normalizeRelativePath(input.relativePath || input.originalName);
    const stat = fs.statSync(input.filePath);
    const sourceHash = await new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(input.filePath);
        stream.on('data', chunk => hash.update(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(hash.digest('hex')));
    });
    const existing = await get('SELECT id,source_hash FROM chat_sources WHERE relative_path=?', [relativePath]);
    if (existing && existing.source_hash === sourceHash) {
        const conversation = await get('SELECT id,message_count FROM chat_conversations WHERE source_id=?', [existing.id]);
        return { relativePath, skipped: true, conversationId: conversation && conversation.id, messageCount: Number(conversation && conversation.message_count || 0) };
    }

    return withImportQueue(async () => {
        const now = new Date().toISOString();
        const sourceId = existing ? existing.id : `src_${digest(relativePath).slice(0, 24)}`;
        const conversationId = `chat_${digest(relativePath).slice(0, 24)}`;
        const conversationType = classifyConversation(relativePath);
        const displayName = displayNameFromPath(relativePath);
        const duplicateOccurrences = new Map();
        let ordinal = 0;
        let current = null;
        let batch = [];

        await run('BEGIN IMMEDIATE');
        try {
            await run(`INSERT INTO chat_sources(id,relative_path,source_hash,file_size,modified_at,imported_at,message_count)
                VALUES(?,?,?,?,?,?,0)
                ON CONFLICT(relative_path) DO UPDATE SET
                    source_hash=excluded.source_hash,
                    file_size=excluded.file_size,
                    modified_at=excluded.modified_at,
                    imported_at=excluded.imported_at`, [
                sourceId,
                relativePath,
                sourceHash,
                stat.size,
                Number(input.modifiedAt || stat.mtimeMs || 0),
                now
            ]);
            await run(`INSERT INTO chat_conversations(
                id,source_id,display_name,conversation_type,updated_at
            ) VALUES(?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET
                display_name=excluded.display_name,
                conversation_type=excluded.conversation_type,
                updated_at=excluded.updated_at`, [conversationId, sourceId, displayName, conversationType, now]);

            if (isFtsAvailable()) await run('DELETE FROM chat_messages_fts WHERE conversation_id=?', [conversationId]);
            await run('DELETE FROM chat_messages WHERE conversation_id=?', [conversationId]);

            const flushCurrent = async () => {
                if (!current) return;
                ordinal += 1;
                const content = current.lines.join('\n').replace(/[\r\n]+$/, '');
                const baseKey = digest([relativePath, current.senderName, current.senderId, current.messageTime, content].join('\0'));
                const occurrence = (duplicateOccurrences.get(baseKey) || 0) + 1;
                duplicateOccurrences.set(baseKey, occurrence);
                batch.push({
                    conversationId,
                    ordinal,
                    stableKey: `${baseKey}:${occurrence}`,
                    senderName: current.senderName,
                    senderId: current.senderId,
                    messageTime: current.messageTime,
                    content
                });
                if (batch.length >= 100) {
                    await insertMessageBatch(batch);
                    batch = [];
                }
            };

            const source = fs.createReadStream(input.filePath, { encoding: 'utf8' });
            let firstLine = true;
            const lines = readline.createInterface({ input: source, crlfDelay: Infinity });
            for await (let line of lines) {
                if (firstLine) {
                    line = line.replace(/^\uFEFF/, '');
                    firstLine = false;
                }
                const header = parseHeader(line);
                if (header) {
                    await flushCurrent();
                    current = { ...header, lines: [] };
                } else if (current) {
                    current.lines.push(line);
                }
            }
            await flushCurrent();
            await insertMessageBatch(batch);

            if (isFtsAvailable()) {
                await run(`INSERT INTO chat_messages_fts(message_id,conversation_id,sender_name,sender_id,content)
                    SELECT id,conversation_id,sender_name,sender_id,content
                    FROM chat_messages WHERE conversation_id=?`, [conversationId]);
            }
            const summary = await get(`SELECT
                COUNT(*) AS message_count,
                COUNT(DISTINCT CASE WHEN sender_id<>'' THEN sender_id ELSE sender_name END) AS participant_count,
                MIN(message_time) AS first_message_time,
                MAX(message_time) AS last_message_time
                FROM chat_messages WHERE conversation_id=?`, [conversationId]);
            const last = await get(`SELECT content FROM chat_messages
                WHERE conversation_id=? ORDER BY message_time DESC,id DESC LIMIT 1`, [conversationId]);
            await run(`UPDATE chat_conversations SET
                last_message=?,last_message_time=?,first_message_time=?,message_count=?,participant_count=?,updated_at=?
                WHERE id=?`, [
                last && last.content || null,
                summary && summary.last_message_time || null,
                summary && summary.first_message_time || null,
                Number(summary && summary.message_count || 0),
                Number(summary && summary.participant_count || 0),
                now,
                conversationId
            ]);
            await run('UPDATE chat_sources SET message_count=? WHERE id=?', [Number(summary && summary.message_count || 0), sourceId]);
            await run(`DELETE FROM chat_favorites
                WHERE message_stable_key NOT IN (SELECT stable_key FROM chat_messages)`);
            await run('COMMIT');
            await syncPersonDirectory();
            return { relativePath, skipped: false, conversationId, messageCount: ordinal, conversationType };
        } catch (error) {
            await run('ROLLBACK').catch(() => {});
            throw error;
        }
    });
}

async function syncPersonDirectory() {
    await ensureReady();
    const rows = await all(`SELECT
        m.sender_id,
        (SELECT p.sender_name FROM chat_messages p WHERE p.sender_id=m.sender_id AND p.sender_name<>'' GROUP BY p.sender_name ORDER BY COUNT(*) DESC LIMIT 1) AS primary_name,
        GROUP_CONCAT(DISTINCT NULLIF(m.sender_name, '')) AS all_names,
        COUNT(*) AS message_count,
        COUNT(DISTINCT m.conversation_id) AS conversation_count,
        MIN(m.message_time) AS first_seen_at,
        MAX(m.message_time) AS last_seen_at
        FROM chat_messages m
        WHERE m.sender_id<>'' AND m.sender_id IS NOT NULL
        GROUP BY m.sender_id`);

    const now = new Date().toISOString();
    for (const row of rows) {
        const primary = row.primary_name || row.sender_id;
        const aliases = (row.all_names || '')
            .split(',')
            .map(s => s.trim())
            .filter(s => s && s !== primary)
            .join(' / ');

        await run(`INSERT INTO chat_person_directory(
            sender_id, sender_name, alias_names, message_count, conversation_count, first_seen_at, last_seen_at, updated_at
        ) VALUES(?,?,?,?,?,?,?,?)
        ON CONFLICT(sender_id) DO UPDATE SET
            sender_name=CASE WHEN chat_person_directory.sender_name<>'' THEN chat_person_directory.sender_name ELSE excluded.sender_name END,
            alias_names=excluded.alias_names,
            message_count=excluded.message_count,
            conversation_count=excluded.conversation_count,
            first_seen_at=excluded.first_seen_at,
            last_seen_at=excluded.last_seen_at,
            updated_at=excluded.updated_at`, [
            row.sender_id,
            primary,
            aliases,
            Number(row.message_count || 0),
            Number(row.conversation_count || 0),
            row.first_seen_at,
            row.last_seen_at,
            now
        ]);
    }
    await run(`DELETE FROM chat_person_directory WHERE sender_id NOT IN (SELECT DISTINCT sender_id FROM chat_messages WHERE sender_id<>'')`);
}

async function listPersonDirectory(options = {}) {
    await ensureReady();
    const q = String(options.q || '').trim();
    const limit = parsePositiveInt(options.limit, 200, 500);
    const where = q ? 'WHERE sender_id LIKE ? OR sender_name LIKE ? OR alias_names LIKE ?' : '';
    const params = q ? [`%${q}%`, `%${q}%`, `%${q}%`] : [];
    const items = await all(`SELECT sender_id, sender_name, alias_names, message_count,
        conversation_count, first_seen_at, last_seen_at, updated_at
        FROM chat_person_directory
        ${where}
        ORDER BY message_count DESC, last_seen_at DESC
        LIMIT ?`, [...params, limit]);
    const total = await get(`SELECT COUNT(*) AS total FROM chat_person_directory ${where}`, params);
    return { items, total: Number(total && total.total || 0) };
}

async function updatePersonDirectory(senderId, payload = {}) {
    await ensureReady();
    const senderName = cleanInline(payload.senderName || '').slice(0, 120);
    const aliasNames = cleanInline(payload.aliasNames || '').slice(0, 200);
    if (!senderName) throw new Error('姓名不能为空');
    const now = new Date().toISOString();
    await run(`UPDATE chat_person_directory SET sender_name=?, alias_names=?, updated_at=? WHERE sender_id=?`, [
        senderName, aliasNames, now, senderId
    ]);
    if (payload.syncMessages !== false) {
        await run(`UPDATE chat_messages SET sender_name=? WHERE sender_id=?`, [senderName, senderId]);
        if (isFtsAvailable()) {
            await run(`UPDATE chat_messages_fts SET sender_name=? WHERE sender_id=?`, [senderName, senderId]);
        }
    }
    return { senderId, senderName, aliasNames, updatedAt: now };
}

async function getUnidentifiedMessages(options = {}) {
    await ensureReady();
    const limit = parsePositiveInt(options.limit, 100, 300);
    const items = await all(`SELECT m.id, m.conversation_id, c.display_name, c.conversation_type,
        m.sender_name, m.sender_id, m.message_time, m.content, s.relative_path,
        CASE
            WHEN m.sender_name='' AND (m.sender_id='' OR m.sender_id IS NULL) THEN '完全无发送人信息'
            WHEN m.sender_id='' OR m.sender_id IS NULL THEN '缺失工号（仅有昵称）'
            ELSE '异常格式'
        END AS issue_type
        FROM chat_messages m
        JOIN chat_conversations c ON c.id=m.conversation_id
        JOIN chat_sources s ON s.id=c.source_id
        WHERE m.sender_id='' OR m.sender_id IS NULL
        ORDER BY m.message_time DESC, m.id DESC
        LIMIT ?`, [limit]);
    const total = await get(`SELECT COUNT(*) AS total FROM chat_messages WHERE sender_id='' OR sender_id IS NULL`);
    return { items, total: Number(total && total.total || 0) };
}

async function getUserSettings(userId) {
    await ensureReady();
    const row = await get('SELECT my_sender_id,updated_at FROM chat_user_settings WHERE user_id=?', [userId]);
    return row || { my_sender_id: '', updated_at: null };
}

async function saveUserSettings(userId, payload = {}) {
    await ensureReady();
    const senderId = cleanInline(payload.mySenderId).slice(0, 120);
    const now = new Date().toISOString();
    await run(`INSERT INTO chat_user_settings(user_id,my_sender_id,updated_at) VALUES(?,?,?)
        ON CONFLICT(user_id) DO UPDATE SET my_sender_id=excluded.my_sender_id,updated_at=excluded.updated_at`, [userId, senderId, now]);
    return { mySenderId: senderId, updatedAt: now };
}

function parsePositiveInt(value, fallback, max) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(parsed, max);
}

async function listConversations(userId, filters = {}) {
    await ensureReady();
    const limit = parsePositiveInt(filters.limit, 40, 100);
    const offset = Math.max(0, Number.parseInt(filters.offset, 10) || 0);
    const settings = await getUserSettings(userId);
    const conditions = [];
    const params = [userId, settings.my_sender_id || ''];
    if (filters.q) {
        conditions.push('(c.display_name LIKE ? OR s.relative_path LIKE ?)');
        params.push(`%${String(filters.q).trim()}%`, `%${String(filters.q).trim()}%`);
    }
    if (['single', 'group', 'discussion', 'other'].includes(filters.type)) {
        conditions.push('c.conversation_type=?');
        params.push(filters.type);
    }
    if (filters.pinned === '1') conditions.push('COALESCE(us.pinned,0)=1');
    if (filters.unread === '1') conditions.push(`EXISTS(SELECT 1 FROM chat_messages unread
        WHERE unread.conversation_id=c.id AND unread.sender_id<>?
        AND (us.last_read_time IS NULL OR unread.message_time>us.last_read_time))`), params.push(settings.my_sender_id || '');
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await all(`SELECT c.id,c.display_name,c.conversation_type,c.last_message,c.last_message_time,
        c.first_message_time,c.message_count,c.participant_count,s.relative_path,s.imported_at,
        COALESCE(us.pinned,0) AS pinned,us.last_read_time,
        (SELECT COUNT(*) FROM chat_messages unread WHERE unread.conversation_id=c.id
            AND unread.sender_id<>? AND (us.last_read_time IS NULL OR unread.message_time>us.last_read_time)) AS unread_count
        FROM chat_conversations c
        JOIN chat_sources s ON s.id=c.source_id
        LEFT JOIN chat_user_states us ON us.conversation_id=c.id AND us.user_id=?
        ${where}
        ORDER BY COALESCE(us.pinned,0) DESC,c.last_message_time DESC,c.id
        LIMIT ? OFFSET ?`, [settings.my_sender_id || '', userId, ...params.slice(2), limit, offset]);
    const count = await get(`SELECT COUNT(*) AS count FROM chat_conversations c
        JOIN chat_sources s ON s.id=c.source_id
        LEFT JOIN chat_user_states us ON us.conversation_id=c.id AND us.user_id=?
        ${where}`, [userId, ...params.slice(2)]);
    return { items: rows, total: Number(count && count.count || 0), limit, offset, mySenderId: settings.my_sender_id || '' };
}

async function getConversation(conversationId, userId) {
    await ensureReady();
    const row = await get(`SELECT c.*,s.relative_path,s.imported_at,COALESCE(us.pinned,0) AS pinned,us.last_read_time
        FROM chat_conversations c JOIN chat_sources s ON s.id=c.source_id
        LEFT JOIN chat_user_states us ON us.conversation_id=c.id AND us.user_id=?
        WHERE c.id=?`, [userId, conversationId]);
    if (!row) return null;
    row.participants = await all(`SELECT sender_name,sender_id,COUNT(*) AS message_count,
        MIN(message_time) AS first_message_time,MAX(message_time) AS last_message_time
        FROM chat_messages WHERE conversation_id=?
        GROUP BY sender_id,sender_name ORDER BY message_count DESC,sender_name`, [conversationId]);
    return row;
}

async function listMessages(conversationId, userId, options = {}) {
    await ensureReady();
    const limit = parsePositiveInt(options.limit, 80, 200);
    const around = Number.parseInt(options.around, 10);
    if (Number.isFinite(around) && around > 0) {
        const before = await all(`SELECT m.id,m.stable_key,m.sender_name,m.sender_id,m.message_time,m.content,
            CASE WHEN f.message_stable_key IS NULL THEN 0 ELSE 1 END AS favorite
            FROM chat_messages m LEFT JOIN chat_favorites f
                ON f.message_stable_key=m.stable_key AND f.user_id=?
            WHERE m.conversation_id=? AND m.id<=? ORDER BY m.id DESC LIMIT 20`, [userId, conversationId, around]);
        const after = await all(`SELECT m.id,m.stable_key,m.sender_name,m.sender_id,m.message_time,m.content,
            CASE WHEN f.message_stable_key IS NULL THEN 0 ELSE 1 END AS favorite
            FROM chat_messages m LEFT JOIN chat_favorites f
                ON f.message_stable_key=m.stable_key AND f.user_id=?
            WHERE m.conversation_id=? AND m.id>? ORDER BY m.id LIMIT 20`, [userId, conversationId, around]);
        return { items: [...before.reverse(), ...after], nextBefore: null, hasMore: false, focusId: around };
    }
    const conditions = ['m.conversation_id=?'];
    const params = [userId, conversationId];
    if (options.before) {
        conditions.push('m.id<?');
        params.push(Number(options.before));
    }
    const rows = await all(`SELECT m.id,m.stable_key,m.sender_name,m.sender_id,m.message_time,m.content,
        CASE WHEN f.message_stable_key IS NULL THEN 0 ELSE 1 END AS favorite
        FROM chat_messages m LEFT JOIN chat_favorites f
            ON f.message_stable_key=m.stable_key AND f.user_id=?
        WHERE ${conditions.join(' AND ')} ORDER BY m.id DESC LIMIT ?`, [...params, limit]);
    const items = rows.reverse();
    return { items, nextBefore: items.length === limit ? items[0].id : null, hasMore: items.length === limit };
}

async function markRead(userId, conversationId) {
    await ensureReady();
    const conversation = await get('SELECT last_message_time FROM chat_conversations WHERE id=?', [conversationId]);
    if (!conversation) return null;
    const readTime = conversation.last_message_time || new Date().toISOString();
    const now = new Date().toISOString();
    await run(`INSERT INTO chat_user_states(user_id,conversation_id,pinned,last_read_time,updated_at)
        VALUES(?,?,0,?,?) ON CONFLICT(user_id,conversation_id) DO UPDATE SET
        last_read_time=excluded.last_read_time,updated_at=excluded.updated_at`, [userId, conversationId, readTime, now]);
    return { lastReadTime: readTime };
}

async function setPinned(userId, conversationId, pinned) {
    await ensureReady();
    if (!await get('SELECT 1 FROM chat_conversations WHERE id=?', [conversationId])) return null;
    const now = new Date().toISOString();
    await run(`INSERT INTO chat_user_states(user_id,conversation_id,pinned,last_read_time,updated_at)
        VALUES(?,?,?,NULL,?) ON CONFLICT(user_id,conversation_id) DO UPDATE SET
        pinned=excluded.pinned,updated_at=excluded.updated_at`, [userId, conversationId, pinned ? 1 : 0, now]);
    return { pinned: Boolean(pinned) };
}

async function setFavorite(userId, stableKey, favorite) {
    await ensureReady();
    if (!await get('SELECT 1 FROM chat_messages WHERE stable_key=?', [stableKey])) return null;
    if (favorite) {
        await run('INSERT OR IGNORE INTO chat_favorites(user_id,message_stable_key,created_at) VALUES(?,?,?)', [userId, stableKey, new Date().toISOString()]);
    } else {
        await run('DELETE FROM chat_favorites WHERE user_id=? AND message_stable_key=?', [userId, stableKey]);
    }
    return { favorite: Boolean(favorite) };
}

function safeFtsQuery(keyword) {
    return `"${String(keyword).trim().replace(/"/g, '""')}"`;
}

async function searchMessages(userId, filters = {}) {
    await ensureReady();
    const limit = parsePositiveInt(filters.limit, 50, 200);
    const offset = Math.max(0, Number.parseInt(filters.offset, 10) || 0);
    const settings = await getUserSettings(userId);
    const keyword = String(filters.keyword || '').trim();
    const joins = [
        'JOIN chat_conversations c ON c.id=m.conversation_id',
        'LEFT JOIN chat_favorites f ON f.message_stable_key=m.stable_key AND f.user_id=?'
    ];
    const conditions = [];
    const params = [userId];
    if (keyword) {
        if (isFtsAvailable() && keyword.length >= 3) {
            joins.push('JOIN chat_messages_fts ON chat_messages_fts.message_id=m.id');
            conditions.push('chat_messages_fts MATCH ?');
            params.push(safeFtsQuery(keyword));
        } else {
            conditions.push('m.content LIKE ?');
            params.push(`%${keyword}%`);
        }
    }
    if (filters.sender) {
        conditions.push('(m.sender_name LIKE ? OR m.sender_id LIKE ?)');
        params.push(`%${filters.sender}%`, `%${filters.sender}%`);
    }
    if (filters.conversationId) {
        conditions.push('m.conversation_id=?');
        params.push(filters.conversationId);
    }
    if (['single', 'group', 'discussion', 'other'].includes(filters.type)) {
        conditions.push('c.conversation_type=?');
        params.push(filters.type);
    }
    if (filters.from) {
        conditions.push('m.message_time>=?');
        params.push(`${filters.from} 00:00:00`);
    }
    if (filters.to) {
        conditions.push('m.message_time<=?');
        params.push(`${filters.to} 23:59:59`);
    }
    if (filters.direction === 'mine') {
        conditions.push('m.sender_id=?');
        params.push(settings.my_sender_id || '__not_configured__');
    } else if (filters.direction === 'others') {
        conditions.push('m.sender_id<>?');
        params.push(settings.my_sender_id || '');
    }
    if (filters.favorites === '1') conditions.push('f.message_stable_key IS NOT NULL');
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const base = `FROM chat_messages m ${joins.join(' ')} ${where}`;
    const count = await get(`SELECT COUNT(*) AS count ${base}`, params);
    const items = await all(`SELECT m.id,m.stable_key,m.conversation_id,c.display_name,c.conversation_type,
        m.sender_name,m.sender_id,m.message_time,m.content,
        CASE WHEN f.message_stable_key IS NULL THEN 0 ELSE 1 END AS favorite,
        (SELECT p.content FROM chat_messages p WHERE p.conversation_id=m.conversation_id AND p.id<m.id ORDER BY p.id DESC LIMIT 1) AS previous_content,
        (SELECT n.content FROM chat_messages n WHERE n.conversation_id=m.conversation_id AND n.id>m.id ORDER BY n.id LIMIT 1) AS next_content
        ${base} ORDER BY m.message_time DESC,m.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    return { items, total: Number(count && count.count || 0), limit, offset, ftsAvailable: isFtsAvailable() };
}

async function getOverviewStats(userId) {
    await ensureReady();
    const settings = await getUserSettings(userId);
    const myId = settings.my_sender_id || '__not_configured__';
    const summary = await get(`SELECT
        (SELECT COUNT(*) FROM chat_conversations) AS conversation_count,
        (SELECT COUNT(*) FROM chat_messages) AS message_count,
        (SELECT COUNT(*) FROM chat_messages WHERE sender_id<>'' AND sender_id IS NOT NULL) AS identified_messages,
        (SELECT COUNT(*) FROM chat_messages WHERE sender_id='' OR sender_id IS NULL) AS unidentified_messages,
        (SELECT COUNT(DISTINCT CASE WHEN sender_id<>'' THEN sender_id ELSE sender_name END) FROM chat_messages) AS participant_count,
        (SELECT COUNT(*) FROM chat_person_directory) AS directory_person_count,
        (SELECT COUNT(DISTINCT sender_name) FROM chat_messages WHERE sender_id='' OR sender_id IS NULL) AS unidentified_senders_count,
        (SELECT COUNT(DISTINCT substr(message_time,1,10)) FROM chat_messages) AS active_days,
        (SELECT COUNT(*) FROM chat_messages WHERE sender_id=?) AS my_messages,
        (SELECT COUNT(*) FROM chat_favorites WHERE user_id=?) AS favorite_count`, [myId, userId]);

    const totalMsg = Number(summary && summary.message_count || 0);
    const identifiedMsg = Number(summary && summary.identified_messages || 0);
    const recognitionRate = totalMsg > 0 ? ((identifiedMsg / totalMsg) * 100).toFixed(1) : '100.0';
    summary.recognition_rate = `${recognitionRate}%`;

    const types = await all(`SELECT conversation_type AS type,COUNT(*) AS conversation_count,
        SUM(message_count) AS message_count FROM chat_conversations GROUP BY conversation_type ORDER BY message_count DESC`);
    const months = await all(`SELECT substr(message_time,1,7) AS month,COUNT(*) AS message_count
        FROM chat_messages GROUP BY substr(message_time,1,7) ORDER BY month DESC LIMIT 18`);
    const hours = await all(`SELECT substr(message_time,12,2) AS hour,COUNT(*) AS message_count
        FROM chat_messages GROUP BY substr(message_time,12,2) ORDER BY hour`);
    return { summary, types, months: months.reverse(), hours, mySenderId: settings.my_sender_id || '' };
}

async function getPeopleStats(userId, options = {}) {
    await ensureReady();
    const settings = await getUserSettings(userId);
    const limit = parsePositiveInt(options.limit, 100, 300);
    const q = String(options.q || '').trim();
    const where = q ? 'WHERE m.sender_name LIKE ? OR m.sender_id LIKE ?' : '';
    const params = q ? [`%${q}%`, `%${q}%`] : [];
    const items = await all(`WITH ordered AS (
        SELECT sender_name,sender_id,message_time,
            LAG(sender_id) OVER (PARTITION BY conversation_id ORDER BY message_time,id) AS previous_sender_id,
            LAG(message_time) OVER (PARTITION BY conversation_id ORDER BY message_time,id) AS previous_time
        FROM chat_messages
    ), response AS (
        SELECT sender_name,sender_id,
            AVG((julianday(message_time)-julianday(previous_time))*1440.0) AS avg_response_minutes
        FROM ordered WHERE previous_time IS NOT NULL AND sender_id<>previous_sender_id
            AND (julianday(message_time)-julianday(previous_time))*1440.0 BETWEEN 0 AND 720
        GROUP BY sender_name,sender_id
    )
    SELECT m.sender_name,m.sender_id,COUNT(*) AS message_count,
        COUNT(DISTINCT m.conversation_id) AS conversation_count,
        COUNT(DISTINCT substr(m.message_time,1,10)) AS active_days,
        MIN(m.message_time) AS first_message_time,MAX(m.message_time) AS last_message_time,
        ROUND(AVG(length(m.content)),1) AS average_length,
        ROUND(MAX(r.avg_response_minutes),1) AS average_response_minutes,
        CASE WHEN m.sender_id=? THEN 1 ELSE 0 END AS is_me
    FROM chat_messages m LEFT JOIN response r ON r.sender_id=m.sender_id AND r.sender_name=m.sender_name
    ${where} GROUP BY m.sender_id,m.sender_name ORDER BY message_count DESC,last_message_time DESC LIMIT ?`, [
        settings.my_sender_id || '__not_configured__', ...params, limit
    ]);
    return { items, approximateResponseTime: true, mySenderId: settings.my_sender_id || '' };
}

async function listSources(options = {}) {
    await ensureReady();
    const q = String(options.q || '').trim();
    const type = String(options.type || '').trim();
    const limit = parsePositiveInt(options.limit, 20, 500);
    const page = Math.max(1, Number.parseInt(options.page, 10) || 1);
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    if (q) {
        conditions.push('(s.relative_path LIKE ? OR c.display_name LIKE ?)');
        params.push(`%${q}%`, `%${q}%`);
    }
    if (['single', 'group', 'discussion', 'other'].includes(type)) {
        conditions.push('c.conversation_type=?');
        params.push(type);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const items = await all(`SELECT s.id,s.relative_path,s.source_hash,s.file_size,s.modified_at,s.imported_at,s.message_count,
        c.id AS conversation_id,c.display_name,c.conversation_type
        FROM chat_sources s LEFT JOIN chat_conversations c ON c.source_id=s.id
        ${where}
        ORDER BY s.imported_at DESC, s.id DESC
        LIMIT ? OFFSET ?`, [...params, limit, offset]);

    const countRow = await get(`SELECT COUNT(*) AS total FROM chat_sources s
        LEFT JOIN chat_conversations c ON c.source_id=s.id
        ${where}`, params);
    const total = Number(countRow && countRow.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
        items,
        total,
        page,
        limit,
        totalPages
    };
}

async function deleteSource(sourceId) {
    await ensureReady();
    const source = await get('SELECT * FROM chat_sources WHERE id=?', [sourceId]);
    if (!source) return null;
    const conversation = await get('SELECT id FROM chat_conversations WHERE source_id=?', [sourceId]);
    await run('BEGIN IMMEDIATE');
    try {
        if (conversation && isFtsAvailable()) await run('DELETE FROM chat_messages_fts WHERE conversation_id=?', [conversation.id]);
        await run('DELETE FROM chat_sources WHERE id=?', [sourceId]);
        await run('DELETE FROM chat_favorites WHERE message_stable_key NOT IN (SELECT stable_key FROM chat_messages)');
        await run('COMMIT');
        await syncPersonDirectory();
        return source;
    } catch (error) {
        await run('ROLLBACK').catch(() => {});
        throw error;
    }
}

async function deleteTestDataSources() {
    await ensureReady();
    const testSources = await all(`SELECT s.id, s.relative_path, c.id AS conversation_id
        FROM chat_sources s LEFT JOIN chat_conversations c ON c.source_id=s.id
        WHERE s.relative_path LIKE '测试数据/%' OR s.relative_path LIKE 'test_data/%'`);
    if (!testSources.length) return { deletedCount: 0, sources: [] };

    await run('BEGIN IMMEDIATE');
    try {
        for (const item of testSources) {
            if (item.conversation_id && isFtsAvailable()) {
                await run('DELETE FROM chat_messages_fts WHERE conversation_id=?', [item.conversation_id]);
            }
            await run('DELETE FROM chat_sources WHERE id=?', [item.id]);
        }
        await run('DELETE FROM chat_favorites WHERE message_stable_key NOT IN (SELECT stable_key FROM chat_messages)');
        await run('COMMIT');
        await syncPersonDirectory();
        return { deletedCount: testSources.length, sources: testSources.map(s => s.relative_path) };
    } catch (error) {
        await run('ROLLBACK').catch(() => {});
        throw error;
    }
}

async function deleteAllSources() {
    await ensureReady();
    await run('BEGIN IMMEDIATE');
    try {
        if (isFtsAvailable()) await run('DELETE FROM chat_messages_fts');
        await run('DELETE FROM chat_sources');
        await run('DELETE FROM chat_favorites');
        await run('DELETE FROM chat_person_directory');
        await run('COMMIT');
        return { success: true };
    } catch (error) {
        await run('ROLLBACK').catch(() => {});
        throw error;
    }
}

module.exports = {
    DB_FILENAME,
    classifyConversation,
    deleteAllSources,
    deleteSource,
    deleteTestDataSources,
    ensureReady,
    getConversation,
    getOverviewStats,
    getPeopleStats,
    getUnidentifiedMessages,
    getUserSettings,
    importTxtFile,
    isFtsAvailable,
    listConversations,
    listMessages,
    listPersonDirectory,
    listSources,
    markRead,
    normalizeRelativePath,
    parseHeader,
    saveUserSettings,
    searchMessages,
    setFavorite,
    setPinned,
    syncPersonDirectory,
    updatePersonDirectory
};
