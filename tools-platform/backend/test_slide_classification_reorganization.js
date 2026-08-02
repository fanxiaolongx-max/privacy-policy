const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const supertest = require('supertest');

const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slide-classification-test-'));
process.env.TOOLS_DATA_DIR = tempDataDir;

const slideRepo = require('./models/slide-design-repository');
const slideAnalyzer = require('./models/slide-content-analyzer');
const { closeDatabase } = require('./models/app-db');
const slideDesignRoutes = require('./routes/slide-design');

function assetInput(overrides = {}) {
    return {
        sourceFilename: '历史方案.pptx',
        pageNumber: 1,
        fileName: 'page.pptx',
        relativePath: '2026-01-01/page.pptx',
        extractedText: '目标架构分为接入层、平台层和能力层。',
        summary: '目标架构说明平台分层和核心能力',
        tag: '解决方案架构',
        tags: ['内容页', '分层架构'],
        uploader: 'admin',
        usageScenario: '方案讲解',
        pageType: '内容页',
        intent: '帮助读者理解平台分层',
        importedAt: '2026-01-02T03:04:05.000Z',
        ...overrides
    };
}

async function testAnalyzerPreview() {
    const assets = [
        { id: 'a1', ...assetInput() },
        { id: 'a2', ...assetInput({ pageNumber: 2, tag: '方案架构', summary: '方案架构总览' }) }
    ];
    const prompts = [];
    const progressEvents = [];
    const client = {
        async generateText(request) {
            prompts.push(request.prompt);
            if (prompts.length === 1) {
                return { text: JSON.stringify({
                    groups: [{ canonical: '方案架构', aliases: ['解决方案架构'], reason: '同义分类' }]
                }) };
            }
            return { text: JSON.stringify({ items: [
                { id: 'a1', topic: '方案架构', pageType: '内容页', usageScenario: '架构评审', reason: '架构页更适合评审复用' },
                { id: 'a2', topic: '方案架构', pageType: '内容页', usageScenario: '方案讲解', reason: '保持原分类' }
            ] }) };
        }
    };
    const result = await slideAnalyzer.reclassifyExistingAssets(assets, {
        client,
        settings: { maxOutputTokens: 2048 },
        onProgress: event => progressEvents.push(event),
        vocabulary: {
            totalAssets: 20,
            topics: [
                { name: '方案架构', count: 15, sampleSummary: '平台方案架构' },
                { name: '解决方案架构', count: 5, sampleSummary: '目标架构分层' }
            ],
            pageTypes: [{ name: '内容页', count: 20 }],
            usageScenarios: [{ name: '方案讲解', count: 20 }]
        }
    });
    assert.strictEqual(result.totalAssets, 2);
    assert.strictEqual(result.changes.length, 1);
    assert.deepStrictEqual(result.changes[0].before, {
        tag: '解决方案架构', pageType: '内容页', usageScenario: '方案讲解'
    });
    assert.deepStrictEqual(result.changes[0].after, {
        tag: '方案架构', pageType: '内容页', usageScenario: '架构评审'
    });
    assert.deepStrictEqual(result.aliases, [{ from: '解决方案架构', to: '方案架构' }]);
    assert(prompts[1].includes('已经提取保存的文字'));
    assert(!prompts[1].includes('重新提取'));
    assert(progressEvents.some(event => event.status.includes('归并历史分类')));
    assert(progressEvents.some(event => event.status.includes('第 1/1 组')));
    assert.strictEqual(progressEvents.at(-1).progress, 1);
}

async function testRepositorySelectionAndAtomicApply() {
    const first = await slideRepo.createAsset(assetInput({ id: 'db1' }));
    await slideRepo.createAsset(assetInput({
        id: 'db2', pageNumber: 2, importedAt: '2026-02-02T03:04:05.000Z', tag: '业务流程'
    }));
    const selected = await slideRepo.listAssetsForReclassification({
        batches: [{
            sourceFilename: first.sourceFilename,
            importedAt: first.importedAt,
            uploader: first.uploader
        }]
    });
    assert.deepStrictEqual(selected.map(item => item.id), ['db1']);

    const change = {
        id: first.id,
        before: { tag: first.tag, pageType: first.pageType, usageScenario: first.usageScenario },
        after: { tag: '方案架构', pageType: '章节过渡', usageScenario: '架构评审' }
    };
    const applied = await slideRepo.applyAssetClassificationChanges([change]);
    assert.strictEqual(applied.appliedCount, 1);
    const updated = await slideRepo.getAsset(first.id);
    assert.strictEqual(updated.tag, '方案架构');
    assert.strictEqual(updated.pageType, '章节过渡');
    assert.strictEqual(updated.usageScenario, '架构评审');
    assert.strictEqual(updated.extractedText, first.extractedText, '已有提取文字不得被改写');
    assert.strictEqual(updated.summary, first.summary, '已有摘要不得被改写');
    assert(updated.tags.includes('章节过渡'), '页面类型标签应同步迁移');

    const stale = await slideRepo.applyAssetClassificationChanges([change]);
    assert.strictEqual(stale.appliedCount, 0);
    assert.deepStrictEqual(stale.skippedIds, [first.id]);
}

async function testPreviewAndApplyRoutes() {
    const originalList = slideRepo.listAssetsForReclassification;
    const originalAnalyze = slideAnalyzer.reclassifyExistingAssets;
    const originalApply = slideRepo.applyAssetClassificationChanges;
    const change = {
        id: 'route1',
        before: { tag: '解决方案架构', pageType: '内容页', usageScenario: '方案讲解' },
        after: { tag: '方案架构', pageType: '内容页', usageScenario: '架构评审' },
        sourceFilename: '历史方案.pptx',
        pageNumber: 1,
        summary: '目标架构说明平台分层',
        reason: '统一近义分类'
    };
    try {
        slideRepo.listAssetsForReclassification = async () => [{ id: 'route1' }];
        slideAnalyzer.reclassifyExistingAssets = async (_assets, options = {}) => {
            options.onProgress?.({
                progress: 0.5,
                status: '正在重新识别第 1/1 组…',
                message: '正在分析测试页面',
                level: 'info'
            });
            return {
                totalAssets: 1,
                unchangedCount: 0,
                changes: [change],
                aliases: [{ from: '解决方案架构', to: '方案架构' }]
            };
        };
        slideRepo.applyAssetClassificationChanges = async changes => ({
            appliedCount: changes.length,
            appliedIds: changes.map(item => item.id),
            skippedIds: []
        });
        const app = express();
        app.use(express.json());
        app.use((req, _res, next) => { req.user = { username: 'admin', role: 'admin' }; next(); });
        app.use(slideDesignRoutes);
        const preview = await supertest(app)
            .post('/classification-reorganization/preview')
            .send({ taskId: 'clstask_route_test', allAssets: true })
            .expect(200);
        assert.strictEqual(preview.body.changes.length, 1);
        assert.match(preview.body.previewId, /^cls_/);

        const progress = await supertest(app)
            .get('/classification-reorganization/progress/clstask_route_test')
            .expect(200);
        assert.strictEqual(progress.body.status, 'completed');
        assert.strictEqual(progress.body.percent, 100);
        assert(progress.body.logs.some(item => item.message.includes('正在分析测试页面')));

        const applied = await supertest(app)
            .post('/classification-reorganization/apply')
            .send({ previewId: preview.body.previewId, changeIds: ['route1'] })
            .expect(200);
        assert.strictEqual(applied.body.appliedCount, 1);

        await supertest(app)
            .post('/classification-reorganization/apply')
            .send({ previewId: preview.body.previewId, changeIds: ['route1'] })
            .expect(404);
    } finally {
        slideRepo.listAssetsForReclassification = originalList;
        slideAnalyzer.reclassifyExistingAssets = originalAnalyze;
        slideRepo.applyAssetClassificationChanges = originalApply;
    }
}

async function main() {
    try {
        await testAnalyzerPreview();
        await testRepositorySelectionAndAtomicApply();
        await testPreviewAndApplyRoutes();
        console.log('slide classification reorganization tests passed');
    } finally {
        await closeDatabase();
        fs.rmSync(tempDataDir, { recursive: true, force: true });
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
