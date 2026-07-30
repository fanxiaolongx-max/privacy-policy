const assert = require('assert');

const {
    buildDeckTaxonomy,
    normalizeLibraryVocabulary
} = require('./models/slide-content-analyzer');

async function testExistingTopicReuse() {
    let receivedPrompt = '';
    const client = {
        async generateText(options) {
            receivedPrompt = options.prompt;
            return {
                text: JSON.stringify({
                    deckTopic: '智能通信方案',
                    categories: [
                        { name: '方案 架构', description: '总体方案与系统分层' },
                        { name: '业务发放', description: '业务开通与订购' },
                        { name: '智能翻译', description: '实时翻译能力' },
                        { name: '文档导览', description: '目录和课程目标' },
                        { name: '全新能力', description: '历史素材尚未覆盖的新主题' }
                    ]
                })
            };
        }
    };
    const progress = [];
    const taxonomy = await buildDeckTaxonomy(
        client,
        [{ pageNumber: 1, text: '总体方案架构与智能翻译业务' }],
        { maxOutputTokens: 2048 },
        event => progress.push(event),
        {
            totalAssets: 106,
            topics: [
                { name: '方案架构', count: 12, sampleSummary: '总体方案采用分层架构' },
                { name: '业务发放', count: 12, sampleSummary: '业务签约与开通流程' },
                { name: '智能翻译', count: 22, sampleSummary: '实时字幕与翻译能力' }
            ],
            pageTypes: [{ name: '内容页', count: 67 }],
            usageScenarios: [{ name: '方案讲解', count: 41 }]
        }
    );

    assert.match(receivedPrompt, /优先复用语义相同或高度相近的已有主题/);
    assert.match(receivedPrompt, /方案架构/);
    assert.match(receivedPrompt, /已有页面类型分布/);
    assert.match(receivedPrompt, /方案讲解/);
    assert.strictEqual(taxonomy.categories[0].name, '方案架构');
    assert.strictEqual(taxonomy.reusedCount, 3);
    assert.deepStrictEqual(taxonomy.libraryPageTypes, [{ name: '内容页', count: 67 }]);
    assert(progress.some(event => /复用素材库已有分类 3 个/.test(event.message)));
}

function testVocabularyNormalization() {
    const vocabulary = normalizeLibraryVocabulary({
        totalAssets: '8',
        topics: [
            { name: ' 方案 架构 ', count: '3', sampleSummary: '  示例摘要  ' },
            { name: '', count: 1 }
        ],
        pageTypes: [{ name: '内容页', count: '7' }, { name: '随意页型', count: 1 }],
        usageScenarios: [{ name: '方案讲解', count: 5 }, { name: '随意用途', count: 1 }]
    });
    assert.strictEqual(vocabulary.totalAssets, 8);
    assert.deepStrictEqual(vocabulary.topics, [
        { name: '方案架构', count: 3, sampleSummary: '示例摘要' }
    ]);
    assert.deepStrictEqual(vocabulary.pageTypes, [{ name: '内容页', count: 7 }]);
    assert.deepStrictEqual(vocabulary.usageScenarios, [{ name: '方案讲解', count: 5 }]);
}

async function run() {
    testVocabularyNormalization();
    await testExistingTopicReuse();
    console.log('slide taxonomy reuse tests passed');
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
