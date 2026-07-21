const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { run, get, all } = require('./app-db');
const { DATA_DIR, ensureDataDir } = require('./store');

const LIBRARY_DIR = path.join(DATA_DIR, 'slide-library');
let readyPromise = null;

function makeId(prefix) {
    return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

function cleanName(value, fallback = '未命名项目') {
    return String(value || fallback).trim().replace(/[\x00-\x1f]/g, '').slice(0, 120) || fallback;
}

function cleanTag(value) {
    const cleaned = String(value || '综合材料').trim().replace(/[\\/:*?"<>|\s]+/g, '');
    const shortened = Array.from(cleaned).slice(0, 5).join('');
    return Array.from(shortened).length >= 3 ? shortened : '综合材料';
}

function cleanTags(value, fallback = '综合材料') {
    const input = Array.isArray(value) && value.length
        ? value
        : String(value || '').trim() ? String(value).split(/[,，、|]/) : [fallback];
    const tags = [...new Set(input.map(cleanTag).filter(Boolean))].slice(0, 6);
    return tags.length ? tags : [cleanTag(fallback)];
}

async function ensureColumn(table, column, definition) {
    const columns = await all(`PRAGMA table_info(${table})`);
    if (!columns.some(item => item.name === column)) {
        await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
}

async function ensureReady() {
    if (!readyPromise) {
        readyPromise = (async () => {
            ensureDataDir();
            fs.mkdirSync(LIBRARY_DIR, { recursive: true });
            await run(`CREATE TABLE IF NOT EXISTS slide_design_projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                deck_html TEXT NOT NULL DEFAULT '',
                active_slide INTEGER NOT NULL DEFAULT 0,
                source TEXT NOT NULL DEFAULT 'manual',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )`);
            await run('CREATE INDEX IF NOT EXISTS idx_slide_design_projects_updated ON slide_design_projects(updated_at DESC)');
            await run(`CREATE TABLE IF NOT EXISTS slide_library_assets (
                id TEXT PRIMARY KEY,
                project_id TEXT,
                source_filename TEXT NOT NULL,
                page_number INTEGER NOT NULL,
                file_name TEXT NOT NULL,
                relative_path TEXT NOT NULL,
                extracted_text TEXT NOT NULL DEFAULT '',
                summary TEXT NOT NULL DEFAULT '',
                tag TEXT NOT NULL DEFAULT '',
                imported_at TEXT NOT NULL,
                FOREIGN KEY(project_id) REFERENCES slide_design_projects(id) ON DELETE SET NULL
            )`);
            await run('CREATE INDEX IF NOT EXISTS idx_slide_library_assets_imported ON slide_library_assets(imported_at DESC)');
            await run('CREATE INDEX IF NOT EXISTS idx_slide_library_assets_tag ON slide_library_assets(tag)');
            await ensureColumn('slide_library_assets', 'tags_json', "TEXT NOT NULL DEFAULT '[]'");
            await ensureColumn('slide_library_assets', 'uploader', "TEXT NOT NULL DEFAULT ''");
            await ensureColumn('slide_library_assets', 'usage_scenario', "TEXT NOT NULL DEFAULT ''");
            await ensureColumn('slide_library_assets', 'page_type', "TEXT NOT NULL DEFAULT '内容页'");
            await ensureColumn('slide_library_assets', 'intent', "TEXT NOT NULL DEFAULT ''");
            await ensureColumn('slide_library_assets', 'thumbnail_path', "TEXT NOT NULL DEFAULT ''");
            await run('CREATE INDEX IF NOT EXISTS idx_slide_library_assets_uploader ON slide_library_assets(uploader)');
            await run('CREATE INDEX IF NOT EXISTS idx_slide_library_assets_scenario ON slide_library_assets(usage_scenario)');
            await run('CREATE INDEX IF NOT EXISTS idx_slide_library_assets_page_type ON slide_library_assets(page_type)');
        })().catch(error => {
            readyPromise = null;
            throw error;
        });
    }
    return readyPromise;
}

function rowToProject(row) {
    return row && {
        id: row.id,
        name: row.name,
        deckHtml: row.deck_html || '',
        activeSlide: Number(row.active_slide || 0),
        source: row.source || 'manual',
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function rowToAsset(row) {
    if (!row) return null;
    let tags = [];
    try { tags = JSON.parse(row.tags_json || '[]'); } catch (_) { tags = []; }
    tags = cleanTags(tags, row.tag);
    return {
        id: row.id,
        projectId: row.project_id || null,
        sourceFilename: row.source_filename,
        pageNumber: Number(row.page_number || 0),
        fileName: row.file_name,
        extractedText: row.extracted_text || '',
        summary: row.summary || '',
        tag: row.tag || '',
        tags,
        uploader: row.uploader || '',
        usageScenario: row.usage_scenario || '',
        pageType: row.page_type || '内容页',
        intent: row.intent || '',
        importedAt: row.imported_at,
        downloadUrl: `/api/slide-design/assets/${encodeURIComponent(row.id)}/download`,
        thumbnailUrl: row.thumbnail_path
            ? `/api/slide-design/assets/${encodeURIComponent(row.id)}/thumbnail?v=${encodeURIComponent(path.basename(row.thumbnail_path))}`
            : ''
    };
}

async function listProjects() {
    await ensureReady();
    return (await all(`SELECT id, name, '' AS deck_html, active_slide, source, created_at, updated_at
                       FROM slide_design_projects ORDER BY updated_at DESC, created_at DESC`)).map(rowToProject);
}

async function getProject(id) {
    await ensureReady();
    return rowToProject(await get('SELECT * FROM slide_design_projects WHERE id = ?', [id]));
}

async function createProject({ name, deckHtml = '', activeSlide = 0, source = 'manual' } = {}) {
    await ensureReady();
    const id = makeId('prj');
    const now = new Date().toISOString();
    await run(
        `INSERT INTO slide_design_projects(id, name, deck_html, active_slide, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, cleanName(name), String(deckHtml || ''), Math.max(0, Number(activeSlide || 0)), String(source || 'manual').slice(0, 30), now, now]
    );
    return getProject(id);
}

async function saveProject(id, { name, deckHtml, activeSlide } = {}) {
    await ensureReady();
    const existing = await getProject(id);
    if (!existing) return null;
    await run(
        `UPDATE slide_design_projects
         SET name = ?, deck_html = ?, active_slide = ?, updated_at = ?
         WHERE id = ?`,
        [
            name === undefined ? existing.name : cleanName(name),
            deckHtml === undefined ? existing.deckHtml : String(deckHtml || ''),
            activeSlide === undefined ? existing.activeSlide : Math.max(0, Number(activeSlide || 0)),
            new Date().toISOString(),
            id
        ]
    );
    return getProject(id);
}

async function createAsset({ id: providedId, projectId, sourceFilename, pageNumber, fileName, relativePath, extractedText, summary, tag, tags, uploader, usageScenario, pageType, intent, thumbnailPath, importedAt }) {
    await ensureReady();
    const id = providedId || makeId('sld');
    await run(
        `INSERT INTO slide_library_assets(
            id, project_id, source_filename, page_number, file_name, relative_path,
            extracted_text, summary, tag, tags_json, uploader, usage_scenario, page_type, intent, thumbnail_path, imported_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, projectId || null, cleanName(sourceFilename, 'import.pptx'), Number(pageNumber), fileName, relativePath,
            String(extractedText || ''), String(summary || ''), cleanTag(tag), JSON.stringify(cleanTags(tags, tag)),
            cleanName(uploader, '未知用户'), cleanName(usageScenario, '通用展示'), cleanName(pageType, '内容页'), String(intent || '').trim().slice(0, 160),
            String(thumbnailPath || ''), importedAt || new Date().toISOString()]
    );
    return getAsset(id);
}

async function updateAssetAnalysis(id, { summary, tag, tags, usageScenario, pageType, intent }) {
    await ensureReady();
    await run(
        `UPDATE slide_library_assets
         SET summary = ?, tag = ?, tags_json = ?, usage_scenario = ?, page_type = ?, intent = ?
         WHERE id = ?`,
        [String(summary || '').trim().slice(0, 300), cleanTag(tag), JSON.stringify(cleanTags(tags, tag)),
            cleanName(usageScenario, '方案讲解'), cleanName(pageType, '内容页'), String(intent || '').trim().slice(0, 160), id]
    );
    return getAsset(id);
}

async function getAsset(id) {
    await ensureReady();
    return rowToAsset(await get('SELECT * FROM slide_library_assets WHERE id = ?', [id]));
}

async function getAssetFile(id) {
    await ensureReady();
    const row = await get('SELECT * FROM slide_library_assets WHERE id = ?', [id]);
    if (!row) return null;
    const absolutePath = path.resolve(LIBRARY_DIR, row.relative_path);
    const root = `${path.resolve(LIBRARY_DIR)}${path.sep}`;
    if (!absolutePath.startsWith(root)) throw new Error('素材文件路径非法');
    return { asset: rowToAsset(row), absolutePath };
}

async function getAssetThumbnail(id) {
    await ensureReady();
    const row = await get('SELECT * FROM slide_library_assets WHERE id = ?', [id]);
    if (!row || !row.thumbnail_path) return null;
    const absolutePath = path.resolve(LIBRARY_DIR, row.thumbnail_path);
    const root = `${path.resolve(LIBRARY_DIR)}${path.sep}`;
    if (!absolutePath.startsWith(root)) throw new Error('缩略图路径非法');
    return { asset: rowToAsset(row), absolutePath };
}

function buildAssetFilter({ query = '', tag = '', date = '', period = '', uploader = '', usageScenario = '', pageType = '', sourceFilename = '' } = {}, exclude = []) {
    const clauses = [];
    const params = [];
    const excluded = new Set(Array.isArray(exclude) ? exclude : [exclude]);
    if (query) {
        clauses.push('(source_filename LIKE ? OR extracted_text LIKE ? OR summary LIKE ? OR tag LIKE ? OR tags_json LIKE ? OR page_type LIKE ? OR intent LIKE ?)');
        const pattern = `%${String(query).slice(0, 100)}%`;
        params.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern);
    }
    if (tag && !excluded.has('tag')) {
        clauses.push('tag = ?');
        params.push(String(tag).slice(0, 20));
    }
    if (date && !excluded.has('date') && !excluded.has('period')) {
        clauses.push('substr(imported_at, 1, 10) = ?');
        params.push(String(date).slice(0, 10));
    }
    if (period && !excluded.has('period') && /^(\d{4})-Q([1-4])$/.test(String(period))) {
        const [, yearText, quarterText] = String(period).match(/^(\d{4})-Q([1-4])$/);
        const year = Number(yearText);
        const startMonth = ((Number(quarterText) - 1) * 3) + 1;
        const nextMonth = startMonth + 3;
        const start = `${year}-${String(startMonth).padStart(2, '0')}-01`;
        const end = nextMonth > 12
            ? `${year + 1}-01-01`
            : `${year}-${String(nextMonth).padStart(2, '0')}-01`;
        clauses.push('imported_at >= ? AND imported_at < ?');
        params.push(start, end);
    }
    if (uploader && !excluded.has('uploader')) {
        clauses.push('uploader = ?');
        params.push(String(uploader).slice(0, 120));
    }
    if (usageScenario && !excluded.has('usageScenario')) {
        clauses.push('usage_scenario = ?');
        params.push(String(usageScenario).slice(0, 120));
    }
    if (pageType && !excluded.has('pageType')) {
        clauses.push('page_type = ?');
        params.push(String(pageType).slice(0, 120));
    }
    if (sourceFilename && !excluded.has('sourceFilename')) {
        clauses.push('source_filename = ?');
        params.push(String(sourceFilename).slice(0, 240));
    }
    return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

async function listAssets({ limit = 200, offset = 0, ...filters } = {}) {
    await ensureReady();
    const { where, params } = buildAssetFilter(filters);
    params.push(Math.min(500, Math.max(1, Number(limit || 200))));
    params.push(Math.max(0, Number(offset || 0)));
    return (await all(`SELECT * FROM slide_library_assets ${where} ORDER BY imported_at DESC, page_number ASC LIMIT ? OFFSET ?`, params)).map(rowToAsset);
}

async function countAssets(filters = {}) {
    await ensureReady();
    const { where, params } = buildAssetFilter(filters);
    const row = await get(`SELECT COUNT(*) AS count FROM slide_library_assets ${where}`, params);
    return Number(row?.count || 0);
}


async function facetRows(column, filters, exclude, { orderBy = 'count DESC, value' } = {}) {
    const { where, params } = buildAssetFilter(filters, exclude);
    const scopedWhere = where ? `${where} AND ${column} <> ''` : `WHERE ${column} <> ''`;
    return all(`SELECT ${column} AS value, COUNT(*) AS count, MAX(imported_at) AS latest
                FROM slide_library_assets ${scopedWhere}
                GROUP BY ${column} ORDER BY ${orderBy}`, params);
}

async function getAssetFilters(filters = {}) {
    await ensureReady();
    const [uploaders, scenarios, pageTypes, tags, importedMonths, sourceFiles] = await Promise.all([
        facetRows('uploader', filters, 'uploader', { orderBy: 'value' }),
        facetRows('usage_scenario', filters, 'usageScenario', { orderBy: 'count DESC, value' }),
        facetRows('page_type', filters, 'pageType'),
        facetRows('tag', filters, 'tag'),
        facetRows("substr(imported_at, 1, 7)", filters, ['period', 'date'], { orderBy: 'value DESC' }),
        facetRows('source_filename', filters, 'sourceFilename', { orderBy: 'latest DESC, value' })
    ]);
    const periodCounts = new Map();
    importedMonths.forEach(item => {
        const match = String(item.value || '').match(/^(\d{4})-(\d{2})$/);
        if (!match) return;
        const value = `${match[1]}-Q${Math.floor((Number(match[2]) - 1) / 3) + 1}`;
        periodCounts.set(value, (periodCounts.get(value) || 0) + Number(item.count || 0));
    });
    const periods = [...periodCounts.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    return {
        uploaders: uploaders.map(item => ({ value: item.value, count: Number(item.count || 0) })),
        scenarios: scenarios.map(item => ({ value: item.value, count: Number(item.count || 0) })),
        pageTypes: pageTypes.map(item => ({ value: item.value, count: Number(item.count || 0) })),
        periods: periods.map(([value, count]) => ({ value, label: value.replace('-', ' '), count })),
        sourceFiles: sourceFiles.map(item => ({ value: item.value, count: Number(item.count || 0) })),
        tags: tags.map(item => ({ value: item.value, count: Number(item.count || 0) })),
        filteredTotal: await countAssets(filters)
    };
}

module.exports = {
    LIBRARY_DIR,
    makeId,
    cleanTag,
    cleanTags,
    ensureReady,
    listProjects,
    getProject,
    createProject,
    saveProject,
    createAsset,
    updateAssetAnalysis,
    getAsset,
    getAssetFile,
    getAssetThumbnail,
    listAssets,
    countAssets,
    getAssetFilters
};
