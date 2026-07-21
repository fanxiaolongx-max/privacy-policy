const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const JSZip = require('jszip');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');

const { DATA_DIR, ensureDataDir } = require('../models/store');
const slideRepo = require('../models/slide-design-repository');
const aiSettingsRepo = require('../models/ai-settings-repository');
const aiProviderClient = require('../models/ai-provider-client');
const { combineSingleSlidePptx } = require('../models/pptx-package');

const execFileAsync = promisify(execFile);

const router = express.Router();
const uploadDir = path.join(DATA_DIR, 'tmp', 'slide-imports');
ensureDataDir();
fs.mkdirSync(uploadDir, { recursive: true });

const pptUpload = multer({
    dest: uploadDir,
    limits: { fileSize: 120 * 1024 * 1024, files: 1 }
});

function decodeXml(value) {
    return String(value || '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function extractSlideText(xml) {
    const chunks = Array.from(String(xml || '').matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g))
        .map(match => decodeXml(match[1]).trim())
        .filter(Boolean);
    return chunks.join('\n').replace(/\n{3,}/g, '\n\n').slice(0, 24000);
}

function fallbackAnalysis(text, pageNumber) {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    const keywordTags = [
        [/\b(AI|LLM|GPT)\b|\u4eba\u5de5\u667a\u80fd|\u6a21\u578b/i, '人工智能'],
        [/\u7f51\u7edc|\u5b89\u5168|\u98ce\u9669|\u6f0f\u6d1e/i, '网络安全'],
        [/\u5ba2\u6237|\u5e02\u573a|\u9500\u552e|\u5546\u4e1a/i, '客户市场'],
        [/\u9879\u76ee|\u8ba1\u5212|\u8fdb\u5ea6|\u91cc\u7a0b\u7891/i, '项目计划'],
        [/\u6570\u636e|\u6307\u6807|\u62a5\u8868|KPI/i, '数据指标'],
        [/\u67b6\u6784|\u65b9\u6848|\u6280\u672f|\u7cfb\u7edf/i, '技术方案'],
        [/\u603b\u7ed3|\u7ed3\u8bba|\u5c55\u671b/i, '总结展望']
    ];
    const tag = keywordTags.find(([pattern]) => pattern.test(normalized))?.[1] || '综合材料';
    return {
        pageNumber,
        summary: normalized ? normalized.slice(0, 140) : `第 ${pageNumber} 页（未提取到可识别文字）`,
        tag,
        tags: [tag],
        usageScenario: /总结|结论|展望/.test(normalized) ? '汇报总结' : /方案|架构|技术/.test(normalized) ? '方案讲解' : '通用展示',
        intent: normalized ? `传达${normalized.slice(0, 48)}` : '页面信息展示'
    };
}

function parseJson(value) {
    const raw = String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    try {
        return JSON.parse(raw);
    } catch (_) {
        const start = raw.indexOf('[');
        const end = raw.lastIndexOf(']');
        if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
        throw _;
    }
}

async function analyzeSlides(slides) {
    const fallback = slides.map(item => fallbackAnalysis(item.text, item.pageNumber));
    try {
        const settings = await aiSettingsRepo.getRuntimeSettings();
        if (!settings.hasApiKey || !settings.keyLooksValid) return { items: fallback, usedAi: false };
        const client = aiProviderClient.createClient(settings);
        const analyzed = [];
        for (let offset = 0; offset < slides.length; offset += 10) {
            const chunk = slides.slice(offset, offset + 10);
            const prompt = `请分析下面的 PPT 页面文字，返回 JSON 数组。每项必须包含 pageNumber、summary、tag、tags、usageScenario、intent。
要求：
1. summary 用一句中文提炼本页核心信息，最多 100 字。
2. tag 必须是 3-5 个中文字，准确表示内容分类，不要使用“其他”。
3. tags 是 2-5 个标签组成的数组，每个标签 3-5 个中文字。
4. usageScenario 是本页最适用的一个场景，如“方案讲解”“管理汇报”“数据复盘”“培训宣讲”。
5. intent 用一句短语说明本页的沟通意图，最多 60 字。
6. 只返回 JSON，不要 Markdown，不要编造原文中没有的信息。

${JSON.stringify(chunk.map(item => ({ pageNumber: item.pageNumber, text: item.text.slice(0, 6000) })))}`;
            const result = await client.generateText({
                prompt,
                systemInstruction: '你是 PPT 素材库的内容编目助手，只输出合法 JSON 数组。',
                maxOutputTokens: Math.min(Math.max(Number(settings.maxOutputTokens || 2048), 2048), 4096),
                temperature: 0.1,
                responseMimeType: 'application/json'
            });
            const parsed = parseJson(result.text);
            if (!Array.isArray(parsed)) throw new Error('AI 未返回数组');
            analyzed.push(...parsed);
        }
        const byPage = new Map(analyzed.map(item => [Number(item.pageNumber), item]));
        return {
            usedAi: true,
            items: fallback.map(item => {
                const aiItem = byPage.get(item.pageNumber);
                if (!aiItem) return item;
                const tag = slideRepo.cleanTag(aiItem.tag);
                return {
                    pageNumber: item.pageNumber,
                    summary: String(aiItem.summary || item.summary).trim().slice(0, 300),
                    tag: tag.length >= 3 ? tag : item.tag,
                    tags: slideRepo.cleanTags(aiItem.tags, tag),
                    usageScenario: String(aiItem.usageScenario || item.usageScenario).trim().slice(0, 60),
                    intent: String(aiItem.intent || item.intent).trim().slice(0, 160)
                };
            })
        };
    } catch (error) {
        console.warn('[slide-design] AI analysis fallback:', error.message);
        return { items: fallback, usedAi: false, aiError: error.message };
    }
}

async function renderSlideThumbnails(sourcePath) {
    const renderDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slide-preview-'));
    try {
        const renderSource = path.join(renderDir, 'source.pptx');
        fs.copyFileSync(sourcePath, renderSource);
        await execFileAsync('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', renderDir, renderSource], { timeout: 120000 });
        const pdf = fs.readdirSync(renderDir).find(name => /\.pdf$/i.test(name));
        if (!pdf) throw new Error('LibreOffice 未输出 PDF');
        const prefix = path.join(renderDir, 'preview');
        await execFileAsync('pdftoppm', ['-png', '-r', '110', path.join(renderDir, pdf), prefix], { timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
        const files = fs.readdirSync(renderDir)
            .filter(name => /^preview-\d+\.png$/i.test(name))
            .sort((a, b) => Number(a.match(/(\d+)/)?.[1]) - Number(b.match(/(\d+)/)?.[1]));
        return { renderDir, files: files.map(name => path.join(renderDir, name)) };
    } catch (error) {
        fs.rmSync(renderDir, { recursive: true, force: true });
        throw error;
    }
}

function selectedPresentationRelationship(zip, slideNumber) {
    const relsFile = zip.file('ppt/_rels/presentation.xml.rels');
    const presentationFile = zip.file('ppt/presentation.xml');
    return Promise.all([
        relsFile ? relsFile.async('string') : '',
        presentationFile ? presentationFile.async('string') : ''
    ]).then(([relsXml, presentationXml]) => {
        const targetPattern = new RegExp(`<Relationship\\b[^>]*\\bId="([^"]+)"[^>]*\\bTarget="slides/slide${slideNumber}\\.xml"[^>]*/>`, 'i');
        const reversePattern = new RegExp(`<Relationship\\b[^>]*\\bTarget="slides/slide${slideNumber}\\.xml"[^>]*\\bId="([^"]+)"[^>]*/>`, 'i');
        const relId = relsXml.match(targetPattern)?.[1] || relsXml.match(reversePattern)?.[1] || null;
        return { relsXml, presentationXml, relId };
    });
}

async function makeSingleSlidePptx(sourceBuffer, slideNumber) {
    const zip = await JSZip.loadAsync(sourceBuffer);
    const { relsXml, presentationXml, relId } = await selectedPresentationRelationship(zip, slideNumber);
    if (!relId) throw new Error(`无法定位第 ${slideNumber} 页的演示文档关系`);

    Object.keys(zip.files).forEach(name => {
        const match = name.match(/^ppt\/slides\/(?:_rels\/)?slide(\d+)\.xml(?:\.rels)?$/i);
        if (match && Number(match[1]) !== slideNumber) zip.remove(name);
    });

    const nextPresentation = presentationXml.replace(/<p:sldId\b[^>]*\br:id="([^"]+)"[^>]*\/>/gi, tag => tag.includes(`r:id="${relId}"`) ? tag : '');
    zip.file('ppt/presentation.xml', nextPresentation);

    const nextRels = relsXml.replace(/<Relationship\b[^>]*\bType="[^"]*\/slide"[^>]*\/>/gi, tag => tag.includes(`Id="${relId}"`) ? tag : '');
    zip.file('ppt/_rels/presentation.xml.rels', nextRels);

    const contentTypes = zip.file('[Content_Types].xml');
    if (contentTypes) {
        const xml = await contentTypes.async('string');
        zip.file('[Content_Types].xml', xml.replace(/<Override\b[^>]*PartName="\/ppt\/slides\/slide(\d+)\.xml"[^>]*\/>/gi,
            (tag, number) => Number(number) === slideNumber ? tag : ''));
    }
    const appXml = zip.file('docProps/app.xml');
    if (appXml) {
        const xml = await appXml.async('string');
        zip.file('docProps/app.xml', xml.replace(/<Slides>\d+<\/Slides>/i, '<Slides>1</Slides>'));
    }
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

async function orderedSlideEntries(zip) {
    const fallback = Object.keys(zip.files)
        .map(name => ({ name, match: name.match(/^ppt\/slides\/slide(\d+)\.xml$/i) }))
        .filter(item => item.match)
        .map(item => ({ name: item.name, slideNumber: Number(item.match[1]) }))
        .sort((a, b) => a.slideNumber - b.slideNumber)
        .map((item, index) => ({ ...item, pageNumber: index + 1 }));
    const presentation = zip.file('ppt/presentation.xml');
    const relationships = zip.file('ppt/_rels/presentation.xml.rels');
    if (!presentation || !relationships) return fallback;
    try {
        const [presentationXml, relationshipsXml] = await Promise.all([
            presentation.async('string'), relationships.async('string')
        ]);
        const relToSlide = new Map();
        Array.from(relationshipsXml.matchAll(/<Relationship\b[^>]*\/>/gi)).forEach(match => {
            const tag = match[0];
            const id = tag.match(/\bId="([^"]+)"/i)?.[1];
            const target = tag.match(/\bTarget="slides\/slide(\d+)\.xml"/i)?.[1];
            if (id && target) relToSlide.set(id, Number(target));
        });
        const ordered = Array.from(presentationXml.matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"[^>]*\/>/gi))
            .map(match => relToSlide.get(match[1]))
            .filter(Boolean)
            .map((slideNumber, index) => ({
                pageNumber: index + 1,
                slideNumber,
                name: `ppt/slides/slide${slideNumber}.xml`
            }))
            .filter(item => zip.file(item.name));
        return ordered.length === fallback.length ? ordered : fallback;
    } catch (_) {
        return fallback;
    }
}

router.get('/projects', async (_req, res) => {
    res.json({ items: await slideRepo.listProjects() });
});

router.post('/projects', async (req, res) => {
    try {
        const project = await slideRepo.createProject(req.body || {});
        res.status(201).json({ project });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.get('/projects/:id', async (req, res) => {
    const project = await slideRepo.getProject(req.params.id);
    if (!project) return res.status(404).json({ error: '项目不存在' });
    res.json({ project });
});

router.put('/projects/:id', async (req, res) => {
    try {
        const project = await slideRepo.saveProject(req.params.id, req.body || {});
        if (!project) return res.status(404).json({ error: '项目不存在' });
        res.json({ project });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.get('/assets', async (req, res) => {
    const items = await slideRepo.listAssets({
        query: req.query.q,
        tag: req.query.tag,
        date: req.query.date,
        uploader: req.query.uploader,
        usageScenario: req.query.scenario,
        limit: req.query.limit
    });
    res.json({ items });
});

router.get('/asset-filters', async (_req, res) => {
    res.json(await slideRepo.getAssetFilters());
});

router.post('/combine', async (req, res) => {
    try {
        const ids = Array.isArray(req.body && req.body.assetIds) ? req.body.assetIds.map(String) : [];
        if (!ids.length) return res.status(400).json({ error: '请至少选择一页素材' });
        if (ids.length > 60) return res.status(400).json({ error: '单次最多合并 60 页素材' });
        const files = [];
        for (const id of ids) {
            const result = await slideRepo.getAssetFile(id);
            if (!result || !fs.existsSync(result.absolutePath)) return res.status(404).json({ error: `素材不存在：${id}` });
            files.push(fs.readFileSync(result.absolutePath));
        }
        const output = await combineSingleSlidePptx(files);
        const fileName = `PPT素材组合_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.pptx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
        res.setHeader('Content-Disposition', `attachment; filename="slides_${Date.now()}.pptx"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        res.send(output);
    } catch (error) {
        console.error('[slide-design] combine failed:', error);
        res.status(400).json({ error: `PPT 合并失败：${error.message}` });
    }
});

router.get('/assets/:id/download', async (req, res) => {
    const result = await slideRepo.getAssetFile(req.params.id);
    if (!result || !fs.existsSync(result.absolutePath)) return res.status(404).json({ error: '素材文件不存在' });
    res.download(result.absolutePath, result.asset.fileName);
});

router.get('/assets/:id/thumbnail', async (req, res) => {
    const result = await slideRepo.getAssetThumbnail(req.params.id);
    if (!result || !fs.existsSync(result.absolutePath)) return res.status(404).end();
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.sendFile(result.absolutePath);
});

router.post('/import-pptx', pptUpload.single('pptx'), async (req, res) => {
    const createdFiles = [];
    try {
        if (!req.file) return res.status(400).json({ error: '请选择 PPTX 文件' });
        if (!/\.pptx$/i.test(req.file.originalname || '')) return res.status(400).json({ error: '目前支持 .pptx 格式' });
        const sourceBuffer = fs.readFileSync(req.file.path);
        const sourceZip = await JSZip.loadAsync(sourceBuffer);
        const slideEntries = await orderedSlideEntries(sourceZip);
        if (!slideEntries.length) return res.status(400).json({ error: '未在 PPTX 中找到可导入页面' });
        if (slideEntries.length > 100) return res.status(400).json({ error: '单次最多导入 100 页 PPT' });

        const slides = [];
        for (const entry of slideEntries) {
            const xml = await sourceZip.file(entry.name).async('string');
            slides.push({ pageNumber: entry.pageNumber, slideNumber: entry.slideNumber, text: extractSlideText(xml) });
        }
        const analysis = await analyzeSlides(slides);
        const analysisByPage = new Map(analysis.items.map(item => [item.pageNumber, item]));
        const importedAt = new Date().toISOString();
        const dateFolder = importedAt.slice(0, 10);
        const dateToken = dateFolder.replace(/-/g, '');
        const absoluteFolder = path.join(slideRepo.LIBRARY_DIR, dateFolder);
        fs.mkdirSync(absoluteFolder, { recursive: true });
        const assets = [];
        let rendered = null;
        try {
            rendered = await renderSlideThumbnails(req.file.path);
        } catch (error) {
            console.warn('[slide-design] thumbnail fallback:', error.message);
        }

        for (const slide of slides) {
            const meta = analysisByPage.get(slide.pageNumber) || fallbackAnalysis(slide.text, slide.pageNumber);
            const id = slideRepo.makeId('sld');
            const tag = slideRepo.cleanTag(meta.tag);
            const fileName = `${id}_${tag}_${dateToken}.pptx`;
            const relativePath = path.posix.join(dateFolder, fileName);
            const absolutePath = path.join(absoluteFolder, fileName);
            let thumbnailPath = '';
            const singleSlideBuffer = await makeSingleSlidePptx(sourceBuffer, slide.slideNumber);
            fs.writeFileSync(absolutePath, singleSlideBuffer);
            createdFiles.push(absolutePath);
            const renderedPreview = rendered && rendered.files[slide.pageNumber - 1];
            if (renderedPreview && fs.existsSync(renderedPreview)) {
                const previewName = `${id}_preview.png`;
                const previewAbsolutePath = path.join(absoluteFolder, previewName);
                fs.copyFileSync(renderedPreview, previewAbsolutePath);
                createdFiles.push(previewAbsolutePath);
                thumbnailPath = path.posix.join(dateFolder, previewName);
            }
            assets.push(await slideRepo.createAsset({
                id,
                projectId: req.body && req.body.projectId,
                sourceFilename: req.file.originalname,
                pageNumber: slide.pageNumber,
                fileName,
                relativePath,
                extractedText: slide.text,
                summary: meta.summary,
                tag,
                tags: meta.tags,
                uploader: (req.user && req.user.username) || '未知用户',
                usageScenario: meta.usageScenario,
                intent: meta.intent,
                thumbnailPath,
                importedAt
            }));
        }
        if (rendered) fs.rmSync(rendered.renderDir, { recursive: true, force: true });
        res.status(201).json({
            success: true,
            sourceFilename: req.file.originalname,
            slideCount: assets.length,
            usedAi: analysis.usedAi,
            aiWarning: analysis.aiError || null,
            assets
        });
    } catch (error) {
        createdFiles.forEach(file => fs.rmSync(file, { force: true }));
        console.error('[slide-design] import failed:', error);
        res.status(400).json({ error: `PPT 导入失败：${error.message}` });
    } finally {
        if (req.file) fs.rmSync(req.file.path, { force: true });
    }
});

module.exports = router;
