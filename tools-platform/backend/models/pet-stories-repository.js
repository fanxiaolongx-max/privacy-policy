const db = require('./app-db');
const seeds = require('../builtin-content/pet-stories');
const ready = new WeakMap();

async function ensureReady() {
    const connection = db.getDatabase();
    if (!ready.has(connection)) {
        const promise = (async () => {
            await db.run(`CREATE TABLE IF NOT EXISTS desktop_pet_stories (
                id TEXT PRIMARY KEY,
                kind TEXT NOT NULL,
                title_zh TEXT NOT NULL, title_en TEXT NOT NULL,
                hook_zh TEXT NOT NULL, hook_en TEXT NOT NULL,
                body_zh TEXT NOT NULL, body_en TEXT NOT NULL,
                note_zh TEXT NOT NULL, note_en TEXT NOT NULL,
                sources_json TEXT NOT NULL DEFAULT '[]',
                seed_version INTEGER NOT NULL DEFAULT 1
            )`);
            // Static bundled content is a seed, never a second runtime database.
            // Repeated initialization preserves existing rows and tenant customizations.
            for (const story of seeds) {
                await db.run(`INSERT OR IGNORE INTO desktop_pet_stories
                    (id,kind,title_zh,title_en,hook_zh,hook_en,body_zh,body_en,note_zh,note_en,sources_json)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [
                    story.id, story.kind, story.zh.title, story.en.title, story.zh.hook, story.en.hook,
                    story.zh.body, story.en.body, story.zh.note, story.en.note, JSON.stringify(story.sources)
                ]);
            }
        })().catch(error => { ready.delete(connection); throw error; });
        ready.set(connection, promise);
    }
    return ready.get(connection);
}
function localize(row, language, full = false) {
    const lang = language === 'en-US' ? 'en' : 'zh';
    const result = { id: row.id, kind: row.kind, title: row['title_' + lang], hook: row['hook_' + lang] };
    if (full) Object.assign(result, {
        body: row['body_' + lang], note: row['note_' + lang],
        sources: JSON.parse(row.sources_json), language: lang === 'en' ? 'en-US' : 'zh-CN'
    });
    return result;
}
async function listStories(language) {
    await ensureReady();
    return (await db.all('SELECT id,kind,title_zh,title_en,hook_zh,hook_en FROM desktop_pet_stories ORDER BY id'))
        .map(row => localize(row, language));
}
async function getStory(id, language) {
    if (typeof id !== 'string' || !/^[a-z0-9-]{1,64}$/.test(id)) return null;
    await ensureReady();
    const row = await db.get('SELECT * FROM desktop_pet_stories WHERE id = ?', [id]);
    return row ? localize(row, language, true) : null;
}
module.exports = { ensureReady, listStories, getStory };
