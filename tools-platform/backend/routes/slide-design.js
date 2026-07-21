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
const importTasks = new Map();
ensureDataDir();
fs.mkdirSync(uploadDir, { recursive: true });

const pptUpload = multer({
    dest: uploadDir,
    limits: { fileSize: 120 * 1024 * 1024, files: 1 }
});

function normalizeImportTaskId(value) {
    const id = String(value || '').trim();
    return /^[a-zA-Z0-9_-]{8,100}$/.test(id) ? id : slideRepo.makeId('imp');
}

function ensureImportTask(taskId) {
    if (!importTasks.has(taskId)) {
        importTasks.set(taskId, {
            taskId,
            status: 'running',
            percent: 1,
            message: '等待服务端接收文件…',
            logs: [],
            nextSequence: 1,
            updatedAt: new Date().toISOString()
        });
    }
    return importTasks.get(taskId);
}

function updateImportTask(taskId, percent, message, detail = message, level = 'info') {
    const task = ensureImportTask(taskId);
    task.percent = Math.min(100, Math.max(task.percent || 0, Math.round(Number(percent) || 0)));
    task.message = String(message || task.message || '处理中…').slice(0, 240);
    task.updatedAt = new Date().toISOString();
    if (detail) {
        task.logs.push({
            sequence: task.nextSequence++,
            time: task.updatedAt,
            level,
            message: String(detail).replace(/[\r\n]+/g, ' ').slice(0, 500)
        });
        if (task.logs.length > 400) task.logs.splice(0, task.logs.length - 400);
    }
    return task;
}

function finishImportTask(taskId, status, message, level = 'success') {
    const task = updateImportTask(taskId, status === 'completed' ? 100 : ensureImportTask(taskId).percent, message, message, level);
    task.status = status;
    const cleanup = setTimeout(() => importTasks.delete(taskId), 10 * 60 * 1000);
    if (cleanup.unref) cleanup.unref();
    return task;
}

function assetFiltersFromQuery(query = {}) {
    return {
        query: query.q,
        tag: query.tag,
        date: query.date,
        period: query.period,
        uploader: query.uploader,
        usageScenario: query.scenario,
        pageType: query.pageType,
        sourceFilename: query.sourceFilename
    };
}

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
    const filters = assetFiltersFromQuery(req.query);
    const requestedPageSize = Number(req.query.pageSize || req.query.limit || 12);
    const pageSize = [12, 24, 48, 96].includes(requestedPageSize) ? requestedPageSize : 12;
    const total = await slideRepo.countAssets(filters);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const requestedPage = Number(req.query.page || 1);
    const page = Math.min(totalPages, Math.max(1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1));
    const items = await slideRepo.listAssets({ ...filters, limit: pageSize, offset: (page - 1) * pageSize });
    res.json({ items, pagination: { page, pageSize, total, totalPages } });
});

router.get('/asset-filters', async (req, res) => {
    res.json(await slideRepo.getAssetFilters(assetFiltersFromQuery(req.query)));
});

router.get('/import-progress/:taskId', (req, res) => {
    const task = importTasks.get(String(req.params.taskId));
    if (!task) {
        return res.json({
            taskId: String(req.params.taskId),
            status: 'waiting',
            percent: 1,
            message: '正在上传 PPT 文件…',
            logs: []
        });
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json(task);
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
    let taskId = normalizeImportTaskId(req.body && req.body.taskId);
    try {
        ensureImportTask(taskId);
        if (!req.file) {
            finishImportTask(taskId, 'failed', '没有收到 PPTX 文件', 'error');
            return res.status(400).json({ error: '请选择 PPTX 文件', taskId });
        }
        const sourceFilename = normalizeUploadFilename(req.file.originalname);
        updateImportTask(taskId, 6, '文件上传完成，正在校验…', `已接收 ${sourceFilename}，文件大小 ${(req.file.size / 1024 / 1024).toFixed(2)} MB`);
        if (!/\.pptx$/i.test(sourceFilename)) {
            finishImportTask(taskId, 'failed', '文件格式不是 PPTX', 'error');
            return res.status(400).json({ error: '目前支持 .pptx 格式', taskId });
        }
        const sourceBuffer = fs.readFileSync(req.file.path);
        updateImportTask(taskId, 9, '正在解包演示文稿…', '开始读取 PPTX 压缩包、关系文件与页面清单');
        const sourceZip = await JSZip.loadAsync(sourceBuffer);
        const slideEntries = await orderedSlideEntries(sourceZip);
        if (!slideEntries.length) {
            finishImportTask(taskId, 'failed', '未在 PPTX 中找到可导入页面', 'error');
            return res.status(400).json({ error: '未在 PPTX 中找到可导入页面', taskId });
        }
        if (slideEntries.length > 100) {
            finishImportTask(taskId, 'failed', `检测到 ${slideEntries.length} 页，超过单次 100 页限制`, 'error');
            return res.status(400).json({ error: '单次最多导入 100 页 PPT', taskId });
        }
        updateImportTask(taskId, 13, `已识别 ${slideEntries.length} 页，正在提取文字…`, `页面顺序解析完成，共 ${slideEntries.length} 页；开始逐页读取正文、版式提示及隐藏状态`);

        const slides = [];
        for (let entryIndex = 0; entryIndex < slideEntries.length; entryIndex += 1) {
            const entry = slideEntries[entryIndex];
            const xml = await sourceZip.file(entry.name).async('string');
            const slideText = slideAnalyzer.extractSlideText(xml);
            const layoutText = await extractStructuralLayoutText(sourceZip, entry.slideNumber);
            slides.push({
                pageNumber: entry.pageNumber,
                slideNumber: entry.slideNumber,
                hidden: /<p:sld\b[^>]*\bshow="0"/i.test(xml),
                text: layoutText ? `${slideText}\n[版式结构提示]\n${layoutText}` : slideText
            });
            updateImportTask(
                taskId,
                13 + ((entryIndex + 1) / slideEntries.length * 17),
                `正在提取第 ${entry.pageNumber}/${slideEntries.length} 页文字…`,
                `第 ${entry.pageNumber} 页：提取 ${slideText.length} 个字符${layoutText ? '，已识别版式结构提示' : ''}${/<p:sld\b[^>]*\bshow="0"/i.test(xml) ? '，页面标记为隐藏' : ''}`
            );
        }
        updateImportTask(taskId, 32, '正在进行 AI 主题分类与摘要提炼…', `文字提取完成，开始分析 ${slides.length} 页的主题分类、页面类型、用途、摘要和标签`);
        const analysis = await slideAnalyzer.analyzeSlides(slides, {
            onProgress(event) {
                updateImportTask(
                    taskId,
                    32 + Math.round((Number(event.progress) || 0) * 22),
                    event.status || '正在进行 AI 主题分类与摘要提炼…',
                    event.message || event.status,
                    event.level || 'info'
                );
            }
        });
        updateImportTask(
            taskId,
            55,
            analysis.usedAi ? 'AI 编目完成，正在拆分原始页面…' : '本地编目完成，正在拆分原始页面…',
            analysis.usedAi
                ? `AI 编目完成${analysis.aiError ? `；部分页面已降级处理：${analysis.aiError}` : '，全部页面返回有效分类结果'}`
                : `AI 未启用或不可用，已使用本地规则完成 ${slides.length} 页编目`,
            analysis.aiError ? 'warning' : 'success'
        );
        const analysisByPage = new Map(analysis.items.map(item => [item.pageNumber, item]));
        const importedAt = new Date().toISOString();
        const dateFolder = importedAt.slice(0, 10);
        const dateToken = dateFolder.replace(/-/g, '');
        const absoluteFolder = path.join(slideRepo.LIBRARY_DIR, dateFolder);
        fs.mkdirSync(absoluteFolder, { recursive: true });
        const pendingAssets = [];
        for (let slideIndex = 0; slideIndex < slides.length; slideIndex += 1) {
            const slide = slides[slideIndex];
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
            updateImportTask(
                taskId,
                55 + ((slideIndex + 1) / slides.length * 20),
                `正在生成第 ${slide.pageNumber}/${slides.length} 页独立 PPT…`,
                `第 ${slide.pageNumber} 页：已保留原始版式与媒体资源，分类为“${tag}”，页型为“${meta.pageType || '内容页'}”`
            );
        }

        let rendered = null;
        try {
            updateImportTask(taskId, 77, '正在批量渲染页面缩略图…', `已生成 ${pendingAssets.length} 个单页 PPT，开始调用渲染引擎生成预览图`);
            rendered = await renderSingleSlideThumbnails(pendingAssets.map(item => ({
                sourcePath: item.absolutePath,
                hidden: item.slide.hidden
            })));
            updateImportTask(taskId, 89, '缩略图渲染完成，正在写入素材库…', `渲染引擎返回 ${rendered.files.filter(Boolean).length}/${pendingAssets.length} 张缩略图`, 'success');
        } catch (error) {
            console.warn('[slide-design] thumbnail fallback:', error.message);
            updateImportTask(taskId, 89, '部分缩略图未生成，继续写入素材库…', `缩略图渲染降级：${error.message}`, 'warning');
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
            updateImportTask(
                taskId,
                90 + ((index + 1) / pendingAssets.length * 9),
                `正在入库第 ${index + 1}/${pendingAssets.length} 页…`,
                `第 ${slide.pageNumber} 页：素材记录、检索全文、分类标签${thumbnailPath ? '及缩略图' : ''}已写入数据库`
            );
        }
        if (rendered) fs.rmSync(rendered.renderDir, { recursive: true, force: true });
        finishImportTask(taskId, 'completed', `导入完成：${assets.length} 页素材已可检索`, 'success');
        res.status(201).json({
            success: true,
            taskId,
            sourceFilename,
            slideCount: assets.length,
            usedAi: analysis.usedAi,
            aiWarning: analysis.aiError || null,
            assets
        });
    } catch (error) {
        createdFiles.forEach(file => fs.rmSync(file, { force: true }));
        console.error('[slide-design] import failed:', error);
        finishImportTask(taskId, 'failed', `导入失败：${error.message}`, 'error');
        res.status(400).json({ error: `PPT 导入失败：${error.message}`, taskId });
    } finally {
        if (req.file) fs.rmSync(req.file.path, { force: true });
    }
});

module.exports = router;
