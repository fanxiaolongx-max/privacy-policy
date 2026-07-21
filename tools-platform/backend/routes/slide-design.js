const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const JSZip = require('jszip');

const { DATA_DIR, ensureDataDir } = require('../models/store');
const slideRepo = require('../models/slide-design-repository');
const { combineSingleSlidePptx, removePresentationSections, sanitizePptxPackage } = require('../models/pptx-package');
const { renderSingleSlideThumbnails } = require('../models/slide-thumbnail-renderer');
const slideAnalyzer = require('../models/slide-content-analyzer');

const router = express.Router();
const uploadDir = path.join(DATA_DIR, 'tmp', 'slide-imports');
ensureDataDir();
fs.mkdirSync(uploadDir, { recursive: true });

const pptUpload = multer({
    dest: uploadDir,
    limits: { fileSize: 120 * 1024 * 1024, files: 1 }
});

function normalizeUploadFilename(value) {
    const raw = path.posix.basename(String(value || '').replace(/\\/g, '/')).normalize('NFC');
    if (!/[\u0080-\u00ff]/.test(raw)) return raw;
    const decoded = Buffer.from(raw, 'latin1').toString('utf8').normalize('NFC');
    const looksDecoded = !decoded.includes('\ufffd') && /[\u3400-\u9fff]/.test(decoded);
    return looksDecoded ? decoded : raw;
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

async function extractStructuralLayoutText(zip, slideNumber) {
    const rels = zip.file(`ppt/slides/_rels/slide${slideNumber}.xml.rels`);
    if (!rels) return '';
    const relsXml = await rels.async('string');
    const tag = Array.from(relsXml.matchAll(/<Relationship\b[^>]*\/>/gi))
        .map(match => match[0])
        .find(item => /\bType="[^"]*\/slideLayout"/i.test(item));
    const target = tag?.match(/\bTarget="([^"]+)"/i)?.[1];
    if (!target) return '';
    const layoutName = path.posix.normalize(path.posix.join('ppt/slides', target));
    const layout = zip.file(layoutName);
    if (!layout) return '';
    const text = slideAnalyzer.extractSlideText(await layout.async('string'));
    return /目录|学习目标|课程目标|修订记录|章节|结束/i.test(text) ? text : '';
}

async function makeSingleSlidePptx(sourceBuffer, slideNumber) {
    const zip = await JSZip.loadAsync(sourceBuffer);
    const { relsXml, presentationXml, relId } = await selectedPresentationRelationship(zip, slideNumber);
    if (!relId) throw new Error(`无法定位第 ${slideNumber} 页的演示文档关系`);

    Object.keys(zip.files).forEach(name => {
        const match = name.match(/^ppt\/slides\/(?:_rels\/)?slide(\d+)\.xml(?:\.rels)?$/i);
        if (match && Number(match[1]) !== slideNumber) zip.remove(name);
    });

    const nextPresentation = removePresentationSections(presentationXml.replace(/<p:sldId\b[^>]*\br:id="([^"]+)"[^>]*\/>/gi, tag => tag.includes(`r:id="${relId}"`) ? tag : ''));
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
        period: req.query.period,
        uploader: req.query.uploader,
        usageScenario: req.query.scenario,
        pageType: req.query.pageType,
        limit: req.query.limit
    });
    res.json({ items });
});

router.get('/asset-filters', async (_req, res) => {
    res.json(await slideRepo.getAssetFilters());
});

router.get('/assets/:id', async (req, res) => {
    const asset = await slideRepo.getAsset(req.params.id);
    if (!asset) return res.status(404).json({ error: '素材不存在' });
    res.json({ asset });
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
    try {
        const output = await sanitizePptxPackage(fs.readFileSync(result.absolutePath));
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
        res.setHeader('Content-Disposition', `attachment; filename="slide_${Date.now()}.pptx"; filename*=UTF-8''${encodeURIComponent(result.asset.fileName)}`);
        res.send(output);
    } catch (error) {
        res.status(400).json({ error: `PPT 下载准备失败：${error.message}` });
    }
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
        const sourceFilename = normalizeUploadFilename(req.file.originalname);
        if (!/\.pptx$/i.test(sourceFilename)) return res.status(400).json({ error: '目前支持 .pptx 格式' });
        const sourceBuffer = fs.readFileSync(req.file.path);
        const sourceZip = await JSZip.loadAsync(sourceBuffer);
        const slideEntries = await orderedSlideEntries(sourceZip);
        if (!slideEntries.length) return res.status(400).json({ error: '未在 PPTX 中找到可导入页面' });
        if (slideEntries.length > 100) return res.status(400).json({ error: '单次最多导入 100 页 PPT' });

        const slides = [];
        for (const entry of slideEntries) {
            const xml = await sourceZip.file(entry.name).async('string');
            const slideText = slideAnalyzer.extractSlideText(xml);
            const layoutText = await extractStructuralLayoutText(sourceZip, entry.slideNumber);
            slides.push({
                pageNumber: entry.pageNumber,
                slideNumber: entry.slideNumber,
                hidden: /<p:sld\b[^>]*\bshow="0"/i.test(xml),
                text: layoutText ? `${slideText}\n[版式结构提示]\n${layoutText}` : slideText
            });
        }
        const analysis = await slideAnalyzer.analyzeSlides(slides);
        const analysisByPage = new Map(analysis.items.map(item => [item.pageNumber, item]));
        const importedAt = new Date().toISOString();
        const dateFolder = importedAt.slice(0, 10);
        const dateToken = dateFolder.replace(/-/g, '');
        const absoluteFolder = path.join(slideRepo.LIBRARY_DIR, dateFolder);
        fs.mkdirSync(absoluteFolder, { recursive: true });
        const pendingAssets = [];
        for (const slide of slides) {
            const meta = analysisByPage.get(slide.pageNumber) || slideAnalyzer.fallbackAnalysis(slide.text, slide.pageNumber);
            const id = slideRepo.makeId('sld');
            const tag = slideRepo.cleanTag(meta.tag);
            const fileName = `${id}_${tag}_${dateToken}.pptx`;
            const relativePath = path.posix.join(dateFolder, fileName);
            const absolutePath = path.join(absoluteFolder, fileName);
            const singleSlideBuffer = await makeSingleSlidePptx(sourceBuffer, slide.slideNumber);
            fs.writeFileSync(absolutePath, singleSlideBuffer);
            createdFiles.push(absolutePath);
            pendingAssets.push({ slide, meta, id, tag, fileName, relativePath, absolutePath });
        }

        let rendered = null;
        try {
            rendered = await renderSingleSlideThumbnails(pendingAssets.map(item => ({
                sourcePath: item.absolutePath,
                hidden: item.slide.hidden
            })));
        } catch (error) {
            console.warn('[slide-design] thumbnail fallback:', error.message);
        }

        const assets = [];
        for (let index = 0; index < pendingAssets.length; index += 1) {
            const { slide, meta, id, tag, fileName, relativePath } = pendingAssets[index];
            let thumbnailPath = '';
            const renderedPreview = rendered && rendered.files[index];
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
                sourceFilename,
                pageNumber: slide.pageNumber,
                fileName,
                relativePath,
                extractedText: slide.text,
                summary: meta.summary,
                tag,
                tags: meta.tags,
                uploader: (req.user && req.user.username) || '未知用户',
                usageScenario: meta.usageScenario,
                pageType: meta.pageType,
                intent: meta.intent,
                thumbnailPath,
                importedAt
            }));
        }
        if (rendered) fs.rmSync(rendered.renderDir, { recursive: true, force: true });
        res.status(201).json({
            success: true,
            sourceFilename,
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
