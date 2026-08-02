const slideRepo = require('./slide-design-repository');
const aiSettingsRepo = require('./ai-settings-repository');
const aiProviderClient = require('./ai-provider-client');

function decodeXml(value) {
    return String(value || '')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'").replace(/&amp;/g, '&')
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function extractSlideText(xml) {
    return Array.from(String(xml || '').matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g))
        .map(match => decodeXml(match[1]).trim())
        .filter(Boolean)
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .slice(0, 30000);
}

function normalizeText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
}

function reportProgress(reporter, event) {
    if (typeof reporter !== 'function') return;
    try {
        reporter({
            progress: Math.min(1, Math.max(0, Number(event.progress) || 0)),
            level: event.level || 'info',
            status: normalizeText(event.status || '正在进行 AI 内容编目…').slice(0, 120),
            message: normalizeText(event.message || event.status || '').slice(0, 420)
        });
    } catch (error) {
        console.warn('[slide-design] analysis progress reporter failed:', error.message);
    }
}

function conciseFallbackSummary(text, pageNumber) {
    const normalized = normalizeText(text);
    if (!normalized) return `第${pageNumber}页无可识别文字`;
    const phrases = normalized.split(/[。；;！？!?]/).map(item => item.trim()).filter(Boolean);
    const first = phrases[0] || normalized;
    return Array.from(first).slice(0, 42).join('').replace(/[：:,，、\s]+$/g, '');
}

function fallbackCategory(text) {
    const value = normalizeText(text);
    const rules = [
        [/术语|缩略语|Glossary|Abbreviations/i, '术语附录'],
        [/智能翻译|语音转写|实时翻译|字幕合成/i, '智能翻译'],
        [/趣味通话|背景替换|虚拟头像|表情雨|手势动效/i, '趣味通话'],
        [/业务发放|业务开通|签约|订购|用户数据|透明数据/i, '业务发放'],
        [/组网|新增接口|网元|Diameter|HTTP 2\.0|SIP|协议栈/i, '组网接口'],
        [/目标架构|解决方案架构|云原生|平台架构|三层架构/i, '方案架构'],
        [/标准进展|背景|演进|现状|战略产品|商用/i, '背景演进'],
        [/课程|目录|掌握如下|本课程|修订记录|不打印/i, '文档导览']
    ];
    return rules.find(([pattern]) => pattern.test(value))?.[1] || '业务说明';
}

const PAGE_TYPES = ['封面', '文档信息', '目录导航', '学习目标', '章节过渡', '内容页', '总结页', '术语附录', '结束页'];
const USAGE_SCENARIOS = ['课程培训', '方案讲解', '架构评审', '流程说明', '业务汇报', '术语查阅'];

function detectPageType(text, summary = '', category = '') {
    const rawText = String(text || '');
    const value = normalizeText(`${summary} ${rawText}`);
    const meaningfulLines = rawText.split(/\n+/).map(item => item.trim()).filter(item => item && !/Copyright|Page\s*\d+/i.test(item));
    const directoryLayout = /\[版式结构提示\][\s\S]*目录/i.test(rawText);
    const conciseDirectory = /目录/i.test(rawText) && meaningfulLines.length <= 14 && Array.from(normalizeText(rawText)).length <= 420;
    if (directoryLayout || conciseDirectory || /目录页|目录导航|内容结构|章节导航|课程目录/i.test(value)) return '目录导航';
    if (/学习目标|课程目标|您将掌握|学完.*掌握|掌握如下/i.test(value)) return '学习目标';
    if (/修订记录|版本记录|开发人员信息|文档日期/i.test(value)) return '文档信息';
    if (/章节开篇|章节标题|过渡页|章节引导/i.test(value)) return '章节过渡';
    if (/课程总结|总结展望|内容总结|要点回顾/i.test(value)) return '总结页';
    if (/课程结束|感谢聆听|THANKS?|Q\s*&\s*A/i.test(value)) return '结束页';
    if (category === '术语附录' || /术语|缩略语|Glossary|Abbreviations/i.test(value)) return '术语附录';
    if (/PPT封面|演示文稿封面|封面展示|标题页/i.test(value)) return '封面';
    return '内容页';
}

function fallbackAnalysis(text, pageNumber) {
    const category = fallbackCategory(text);
    const summarySource = String(text || '').split('[版式结构提示]')[0].trim();
    let summary = conciseFallbackSummary(summarySource, pageNumber);
    const pageType = detectPageType(text, summary, category);
    if (pageType === '目录导航' && !summary.startsWith('目录导航')) summary = `目录导航：${summary}`;
    return {
        pageNumber,
        sourceText: String(text || ''),
        summary,
        tag: category,
        tags: slideRepo.cleanTags([pageType, category], category),
        usageScenario: category === '术语附录' ? '术语查阅' : category === '文档导览' ? '课程培训' : '方案讲解',
        pageType,
        intent: category === '文档导览' ? '帮助读者定位课程内容' : `说明${category}的核心信息`
    };
}

function parseJson(value) {
    const raw = String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    try { return JSON.parse(raw); } catch (originalError) {
        const objectStart = raw.indexOf('{');
        const objectEnd = raw.lastIndexOf('}');
        if (objectStart >= 0 && objectEnd > objectStart) {
            try { return JSON.parse(raw.slice(objectStart, objectEnd + 1)); } catch (_) { /* try array */ }
        }
        const arrayStart = raw.indexOf('[');
        const arrayEnd = raw.lastIndexOf(']');
        if (arrayStart >= 0 && arrayEnd > arrayStart) return JSON.parse(raw.slice(arrayStart, arrayEnd + 1));
        throw originalError;
    }
}

function parsedItems(value) {
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.items)) return value.items;
    if (value && Array.isArray(value.slides)) return value.slides;
    return [];
}

function defaultTaxonomy() {
    return [
        { name: '文档导览', description: '封面、目录、课程目标、修订记录和总结' },
        { name: '背景演进', description: '行业背景、标准进展、现状与演进路线' },
        { name: '方案架构', description: '总体方案、目标架构、平台和产品能力' },
        { name: '组网接口', description: '网络组网、网元关系、接口与协议' },
        { name: '业务发放', description: '业务开通、签约、订购和用户数据' },
        { name: '业务流程', description: '端到端步骤、时序和处理流程' },
        { name: '术语附录', description: '术语、缩略语与参考说明' }
    ];
}

function normalizeLibraryVocabulary(value = {}) {
    const topics = Array.isArray(value.topics) ? value.topics : [];
    const normalizeCounts = (items, allowedValues) => (Array.isArray(items) ? items : [])
        .map(item => ({
            name: normalizeText(item && item.name),
            count: Math.max(0, Number(item && item.count) || 0)
        }))
        .filter(item => allowedValues.includes(item.name));
    return {
        totalAssets: Math.max(0, Number(value.totalAssets) || 0),
        topics: topics.map(item => ({
            name: slideRepo.cleanTag(item && item.name),
            count: Math.max(0, Number(item && item.count) || 0),
            sampleSummary: normalizeText(item && item.sampleSummary).slice(0, 120)
        })).filter(item => item.name && item.name !== '综合材料').slice(0, 30),
        pageTypes: normalizeCounts(value.pageTypes, PAGE_TYPES),
        usageScenarios: normalizeCounts(value.usageScenarios, USAGE_SCENARIOS)
    };
}

async function buildDeckTaxonomy(client, slides, settings, reporter, vocabulary = {}) {
    const libraryVocabulary = normalizeLibraryVocabulary(vocabulary);
    const existingTopics = libraryVocabulary.topics;
    const existingTopicNames = new Map(existingTopics.map(item => [slideRepo.cleanTag(item.name), item.name]));
    const outline = slides.map(item => ({
        pageNumber: item.pageNumber,
        text: normalizeText(item.text).slice(0, 900)
    }));
    const prompt = `你是企业培训与解决方案 PPT 的资深内容架构师。请通读整套页面提纲，先为这份 PPT 建立一套专属主题分类。

素材库已有 ${libraryVocabulary.totalAssets} 页素材，已有主题分类如下：
${JSON.stringify(existingTopics)}
已有页面类型分布：${JSON.stringify(libraryVocabulary.pageTypes)}
已有用途分布：${JSON.stringify(libraryVocabulary.usageScenarios)}

分类要求：
1. 优先复用语义相同或高度相近的已有主题，复用时 name 必须与已有名称完全一致；不得仅为换一种说法而创建近义分类。
2. 只有新 PPT 出现已有主题无法准确容纳的新业务概念时，才允许创建新分类。
3. 输出 6-10 个互斥、可复用的主题分类；新建名称应为 4-5 个中文字。
4. 分类必须反映页面真正讨论的业务主题，例如“方案架构、组网接口、业务发放、智能翻译”，不要仅因出现“网络、数据、AI、市场、计划”等词就归入泛化类别。
5. 应包含能容纳封面、目录、课程目标、总结、术语页的类别。
6. 禁止使用“综合材料、其他、通用内容”等兜底名称。
7. 返回严格 JSON 对象：{"deckTopic":"...","categories":[{"name":"...","description":"..."}]}。

    页面提纲：
${JSON.stringify(outline)}`;
    reportProgress(reporter, {
        progress: 0.02,
        status: 'AI 正在通读整套 PPT…',
        message: `主题分类：正在读取 ${slides.length} 页提纲并建立专属分类体系`
    });
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const result = await client.generateText({
                prompt: attempt ? `${prompt}\n上次输出不可解析，请只输出短小且严格合法的 JSON。` : prompt,
                systemInstruction: '只输出严格合法的 JSON 对象，不要 Markdown。',
                maxOutputTokens: Math.min(Math.max(Number(settings.maxOutputTokens || 2048), 1536), 3072),
                temperature: attempt ? 0 : 0.1,
                responseMimeType: 'application/json',
                thinkingBudget: 0
            });
            const parsed = parseJson(result.text);
            const categories = (parsed.categories || [])
                .map(item => ({
                    name: existingTopicNames.get(slideRepo.cleanTag(item.name)) || slideRepo.cleanTag(item.name),
                    description: normalizeText(item.description).slice(0, 100)
                }))
                .filter(item => !/综合材料|其他|通用内容/.test(item.name));
            const unique = [...new Map(categories.map(item => [item.name, item])).values()];
            if (unique.length >= 5) {
                const reusedCount = unique.filter(item => existingTopicNames.has(slideRepo.cleanTag(item.name))).length;
                reportProgress(reporter, {
                    progress: 0.08,
                    level: 'success',
                    status: '主题分类体系已建立…',
                    message: `主题分类：AI 已生成 ${unique.slice(0, 10).length} 个分类，其中复用素材库已有分类 ${reusedCount} 个`
                });
                return {
                    deckTopic: normalizeText(parsed.deckTopic).slice(0, 100),
                    categories: unique.slice(0, 10),
                    reusedCount,
                    libraryPageTypes: libraryVocabulary.pageTypes,
                    libraryUsageScenarios: libraryVocabulary.usageScenarios
                };
            }
            throw new Error(`有效分类不足（${unique.length} 个）`);
        } catch (error) {
            reportProgress(reporter, {
                progress: attempt ? 0.08 : 0.05,
                level: 'warning',
                status: attempt ? '主题分类生成失败，启用默认分类…' : '主题分类格式不完整，正在重试…',
                message: attempt
                    ? `主题分类：两次请求均未得到有效结果，改用默认分类体系（${error.message}）`
                    : `主题分类：第 1 次请求失败，正在用严格 JSON 模式重试（${error.message}）`
            });
            if (attempt === 1) console.warn('[slide-design] taxonomy fallback:', error.message);
        }
    }
    return { deckTopic: '', categories: defaultTaxonomy() };
}

function slideContext(slides, index) {
    const neighbor = offset => normalizeText(slides[index + offset]?.text).slice(0, 220);
    return {
        pageNumber: slides[index].pageNumber,
        previousPage: neighbor(-1),
        fullText: String(slides[index].text || '').slice(0, 14000),
        nextPage: neighbor(1)
    };
}

async function analyzeChunk(client, chunk, taxonomy, settings, retryNote = '', onProviderRetry) {
    const categoryNames = taxonomy.categories.map(item => item.name);
    const prompt = `请结合整套 PPT 主题、当前页全部文字以及前后页语境，对页面进行精确编目。

整套主题：${taxonomy.deckTopic || '未命名演示文稿'}
允许的分类及定义：${JSON.stringify(taxonomy.categories)}
素材库已有页面类型分布：${JSON.stringify(taxonomy.libraryPageTypes || [])}
素材库已有用途分布：${JSON.stringify(taxonomy.libraryUsageScenarios || [])}

每页必须输出：
- pageNumber：原页码。
- category：只能从允许分类中原样选择；按页面的主要讨论对象分类，不能按偶然出现的关键词分类。
- pageType：只能选择“封面、文档信息、目录导航、学习目标、章节过渡、内容页、总结页、术语附录、结束页”之一。若页面在前部集中列出多个章节，即使 XML 未提取出“目录”标题，也必须识别为“目录导航”。
- summary：18-42 个中文字的一句核心结论。必须提炼“本页主要说明什么”，禁止复制整段标题、堆砌列表、罗列所有网元或协议。
- tags：2-4 个具体内容标签，避免与 category 完全重复。
- usageScenario：只能选择“课程培训、方案讲解、架构评审、流程说明、业务汇报、术语查阅”之一。
- intent：12-28 个中文字，说明本页希望读者理解什么。

清洗规则：
1. 忽略 Copyright、Page、页眉页脚、Logo、配色参考、模板操作提示等非正文。
2. 表格、架构图和流程图要概括结论或关系，不要逐项抄录。
3. 文字很少时结合前后页判断其章节作用，但不得编造原文没有的事实。
4. 空白或结束页归入最接近的文档导览类，并明确说明页面作用。
5. “[版式结构提示]”是页面引用的版式文字；若其中明确出现“目录”，且页面正文为少量章节条目，pageType 必须是“目录导航”，不得选“内容页”。
6. 返回严格 JSON 对象：{"items":[...]}，不要 Markdown。
${retryNote}

页面内容：
${JSON.stringify(chunk)}`;
    const result = await client.generateText({
        prompt,
        systemInstruction: `你是 PPT 内容编目专家。分类只能使用：${categoryNames.join('、')}。只输出严格合法 JSON。`,
        maxOutputTokens: Math.min(Math.max(Number(settings.maxOutputTokens || 2048), 2048), 4096),
        temperature: retryNote ? 0 : 0.1,
        responseMimeType: 'application/json',
        thinkingBudget: 0,
        onRetry: onProviderRetry
    });
    const items = parsedItems(parseJson(result.text));
    if (!items.length) throw new Error('AI 未返回 items 数组');
    return items;
}

async function analyzeChunkWithFallback(client, chunk, taxonomy, settings, warnings, reporter, chunkMeta) {
    const range = `${chunk[0].pageNumber}-${chunk[chunk.length - 1].pageNumber}`;
    const onProviderRetry = event => reportProgress(reporter, {
        progress: chunkMeta.progressStart,
        level: 'warning',
        status: `AI 正在扩充输出额度重试第 ${chunkMeta.index}/${chunkMeta.total} 组…`,
        message: `第 ${range} 页：${event.message || `模型输出被截断，输出额度从 ${event.previousLimit} 调整为 ${event.nextLimit} tokens 后重试`}`
    });
    try {
        return await analyzeChunk(client, chunk, taxonomy, settings, '', onProviderRetry);
    } catch (firstError) {
        reportProgress(reporter, {
            progress: chunkMeta.progressStart,
            level: 'warning',
            status: `AI 正在重试第 ${chunkMeta.index}/${chunkMeta.total} 组…`,
            message: `第 ${range} 页：首次分析失败，正在缩短输出并重试（${firstError.message}）`
        });
        try {
            return await analyzeChunk(client, chunk, taxonomy, settings, '\n上次输出被截断或格式不完整，请进一步缩短 summary 和 intent，确保 JSON 完整闭合。', onProviderRetry);
        } catch (secondError) {
            if (chunk.length === 1) {
                warnings.push(`第${chunk[0].pageNumber}页：${secondError.message || firstError.message}`);
                reportProgress(reporter, {
                    progress: chunkMeta.progressEnd,
                    level: 'warning',
                    status: `第 ${chunk[0].pageNumber} 页改用本地规则…`,
                    message: `第 ${chunk[0].pageNumber} 页：AI 重试仍失败，已使用本地规则完成分类与摘要`
                });
                return [];
            }

            // 五页批次先降为 3 + 2（更小批次同样对半拆分），避免长思考挤占最终 JSON。
            const midpoint = Math.ceil(chunk.length / 2);
            const parts = [chunk.slice(0, midpoint), chunk.slice(midpoint)].filter(Boolean).filter(part => part.length);
            const recovered = [];
            reportProgress(reporter, {
                progress: chunkMeta.progressStart,
                level: 'warning',
                status: `AI 正在拆分第 ${chunkMeta.index}/${chunkMeta.total} 组恢复…`,
                message: `第 ${range} 页：整组重试仍失败，已拆分为 ${parts.map(part => `${part[0].pageNumber}-${part[part.length - 1].pageNumber} 页`).join('、')} 分别恢复`
            });
            for (const part of parts) {
                const partRange = `${part[0].pageNumber}-${part[part.length - 1].pageNumber}`;
                try {
                    recovered.push(...await analyzeChunk(
                        client,
                        part,
                        taxonomy,
                        settings,
                        '\n这是拆分后的修复请求，请保持答案简短，只返回完整 JSON。',
                        onProviderRetry
                    ));
                    reportProgress(reporter, {
                        progress: chunkMeta.progressEnd,
                        level: 'success',
                        status: `AI 分组恢复进行中…`,
                        message: `第 ${partRange} 页：拆分后的修复请求成功`
                    });
                } catch (partError) {
                    reportProgress(reporter, {
                        progress: chunkMeta.progressEnd,
                        level: 'warning',
                        status: `AI 正在逐页恢复第 ${partRange} 页…`,
                        message: `第 ${partRange} 页：小组修复失败，正在降为逐页分析（${partError.message}）`
                    });
                    for (const single of part) {
                        try {
                            recovered.push(...await analyzeChunk(client, [single], taxonomy, settings, '\n这是逐页修复请求，请确保 JSON 完整闭合。', onProviderRetry));
                            reportProgress(reporter, {
                                progress: chunkMeta.progressEnd,
                                level: 'success',
                                status: `AI 正在逐页恢复第 ${partRange} 页…`,
                                message: `第 ${single.pageNumber} 页：逐页 AI 修复成功`
                            });
                        } catch (singleError) {
                            warnings.push(`第${single.pageNumber}页：${singleError.message}`);
                            reportProgress(reporter, {
                                progress: chunkMeta.progressEnd,
                                level: 'warning',
                                status: `第 ${single.pageNumber} 页改用本地规则…`,
                                message: `第 ${single.pageNumber} 页：逐页 AI 修复仍失败，已改用本地规则完成编目`
                            });
                        }
                    }
                    console.warn(`[slide-design] AI sub-chunk degraded (${part[0].pageNumber}-${part[part.length - 1].pageNumber}):`, partError.message);
                }
            }
            console.warn(`[slide-design] AI chunk split (${chunk[0].pageNumber}-${chunk[chunk.length - 1].pageNumber}):`, secondError.message || firstError.message);
            return recovered;
        }
    }
}

function normalizeAiItem(aiItem, fallback, allowedCategories) {
    const requestedCategory = slideRepo.cleanTag(aiItem.category || aiItem.tag);
    const tag = allowedCategories.includes(requestedCategory) ? requestedCategory : fallback.tag;
    const summary = normalizeText(aiItem.summary).replace(/^(本页|本页面)(主要)?(介绍|说明|讲述)[：:]?/i, '').slice(0, 90);
    const requestedPageType = normalizeText(aiItem.pageType);
    const detectedPageType = detectPageType(fallback.sourceText, summary || fallback.summary, tag);
    const pageType = detectedPageType !== '内容页'
        ? detectedPageType
        : PAGE_TYPES.includes(requestedPageType) ? requestedPageType : fallback.pageType;
    return {
        pageNumber: fallback.pageNumber,
        summary: summary || fallback.summary,
        tag,
        tags: slideRepo.cleanTags([pageType, ...(Array.isArray(aiItem.tags) ? aiItem.tags : [])], tag),
        usageScenario: USAGE_SCENARIOS.includes(aiItem.usageScenario)
            ? aiItem.usageScenario
            : fallback.usageScenario,
        pageType,
        intent: normalizeText(aiItem.intent || fallback.intent).slice(0, 60)
    };
}

async function refineSummaries(client, slides, items, settings, reporter) {
    const byPage = new Map(items.map(item => [item.pageNumber, { ...item }]));
    const candidates = slides.map(slide => {
        const item = byPage.get(slide.pageNumber);
        return item && {
            pageNumber: slide.pageNumber,
            category: item.tag,
            pageType: item.pageType,
            currentSummary: item.summary,
            fullText: String(slide.text || '').slice(0, 6000)
        };
    }).filter(Boolean);

    const totalChunks = Math.max(1, Math.ceil(candidates.length / 10));
    for (let offset = 0; offset < candidates.length; offset += 10) {
        const chunk = candidates.slice(offset, offset + 10);
        const chunkIndex = Math.floor(offset / 10) + 1;
        const range = `${chunk[0].pageNumber}-${chunk[chunk.length - 1].pageNumber}`;
        reportProgress(reporter, {
            progress: 0.78 + (chunkIndex - 1) / totalChunks * 0.2,
            status: `正在精炼摘要第 ${chunkIndex}/${totalChunks} 组…`,
            message: `摘要精炼：正在压缩第 ${range} 页的卡片摘要`
        });
        const prompt = `把下面每页的摘要压缩为真正适合素材库卡片的一句话。

硬性要求：
1. 每条 16-32 个中文字，直接写主题、关键关系或结论。
2. 删除“本页、该页、主要、详细介绍、使读者了解、希望读者”等空话。
3. 不罗列全部项目，不照抄长标题，不添加原文没有的事实。
4. 流程页要指出具体场景和步骤作用；架构页要指出核心分工；章节页说明章节主题即可。
5. 目录页必须以“目录导航：”开头，概括包含的主要章节；不能只写“内容概览”。
6. 空白结束页可写“课程结束页，用于自然收束演示内容”。
7. 返回严格 JSON：{"items":[{"pageNumber":1,"summary":"..."}]}。

页面：${JSON.stringify(chunk)}`;
        try {
            const result = await client.generateText({
                prompt,
                systemInstruction: '你是中文信息压缩编辑，只输出严格合法 JSON，不输出解释。',
                maxOutputTokens: 2048,
                temperature: 0,
                responseMimeType: 'application/json',
                thinkingBudget: 0
            });
            parsedItems(parseJson(result.text)).forEach(refined => {
                const item = byPage.get(Number(refined.pageNumber));
                const summary = normalizeText(refined.summary);
                if (item && summary) item.summary = summary;
            });
            reportProgress(reporter, {
                progress: 0.78 + chunkIndex / totalChunks * 0.2,
                level: 'success',
                status: `摘要精炼已完成 ${chunkIndex}/${totalChunks} 组…`,
                message: `摘要精炼：第 ${range} 页处理完成`
            });
        } catch (error) {
            reportProgress(reporter, {
                progress: 0.78 + chunkIndex / totalChunks * 0.2,
                level: 'warning',
                status: `摘要精炼已跳过第 ${chunkIndex}/${totalChunks} 组…`,
                message: `摘要精炼：第 ${range} 页请求失败，保留原摘要并继续下一组（${error.message}）`
            });
            console.warn(`[slide-design] summary refinement skipped (${chunk[0].pageNumber}-${chunk[chunk.length - 1].pageNumber}):`, error.message);
        }
    }

    for (const candidate of candidates) {
        const item = byPage.get(candidate.pageNumber);
        if (!item || Array.from(item.summary).length <= 34) continue;
        try {
            const result = await client.generateText({
                prompt: `将下面摘要改写为22-30个中文字，只保留一个核心信息。禁止使用“本页、介绍、详细、使读者、希望读者”，不得以半句话结束。只输出摘要纯文本，不要引号和解释。\n分类：${candidate.category}\n全文：${candidate.fullText}\n当前摘要：${item.summary}`,
                systemInstruction: '你是中文标题编辑，只输出一条22-30字的完整摘要。',
                maxOutputTokens: 128,
                temperature: 0,
                thinkingBudget: 0
            });
            const summary = normalizeText(result.text).replace(/^["“]|["”]$/g, '');
            if (summary && Array.from(summary).length <= 36) item.summary = summary;
        } catch (error) {
            console.warn(`[slide-design] single summary compression skipped (${candidate.pageNumber}):`, error.message);
        }
    }
    return items.map(item => byPage.get(item.pageNumber) || item);
}

async function analyzeSlides(slides, { onProgress } = {}) {
    const fallback = slides.map(item => fallbackAnalysis(item.text, item.pageNumber));
    try {
        let libraryVocabulary = {};
        try {
            libraryVocabulary = await slideRepo.getClassificationVocabulary();
            if (libraryVocabulary.totalAssets > 0) {
                reportProgress(onProgress, {
                    progress: 0.01,
                    status: '正在读取素材库已有分类…',
                    message: `分类复用：已读取 ${libraryVocabulary.totalAssets} 页历史素材、${libraryVocabulary.topics.length} 个主题分类、${libraryVocabulary.pageTypes.length} 个页面类型和 ${libraryVocabulary.usageScenarios.length} 个用途`
                });
            }
        } catch (error) {
            console.warn('[slide-design] existing taxonomy lookup skipped:', error.message);
        }
        const settings = await aiSettingsRepo.getRuntimeSettings();
        if (!settings.hasApiKey || !settings.keyLooksValid) {
            reportProgress(onProgress, {
                progress: 1,
                level: 'warning',
                status: 'AI 未启用，正在使用本地规则…',
                message: `AI 配置不可用，${slides.length} 页将全部使用本地规则完成分类与摘要`
            });
            return { items: fallback, usedAi: false, taxonomy: defaultTaxonomy() };
        }
        const client = aiProviderClient.createClient(settings);
        const taxonomy = await buildDeckTaxonomy(client, slides, settings, onProgress, libraryVocabulary);
        const allowedCategories = taxonomy.categories.map(item => item.name);
        const analyzed = [];
        const warnings = [];
        const contexts = slides.map((_, index) => slideContext(slides, index));

        const totalChunks = Math.max(1, Math.ceil(contexts.length / 5));
        reportProgress(onProgress, {
            progress: 0.1,
            status: `AI 将分 ${totalChunks} 组分析页面…`,
            message: `页面编目：${contexts.length} 页将按每组最多 5 页顺序分析，共 ${totalChunks} 组`
        });
        for (let offset = 0; offset < contexts.length; offset += 5) {
            const chunk = contexts.slice(offset, offset + 5);
            const chunkIndex = Math.floor(offset / 5) + 1;
            const progressStart = 0.1 + (chunkIndex - 1) / totalChunks * 0.66;
            const progressEnd = 0.1 + chunkIndex / totalChunks * 0.66;
            const range = `${chunk[0].pageNumber}-${chunk[chunk.length - 1].pageNumber}`;
            reportProgress(onProgress, {
                progress: progressStart,
                status: `AI 正在分析第 ${chunkIndex}/${totalChunks} 组…`,
                message: `页面编目：开始分析第 ${range} 页（第 ${chunkIndex}/${totalChunks} 组）`
            });
            const recovered = await analyzeChunkWithFallback(client, chunk, taxonomy, settings, warnings, onProgress, {
                index: chunkIndex,
                total: totalChunks,
                progressStart,
                progressEnd
            });
            analyzed.push(...recovered);
            reportProgress(onProgress, {
                progress: progressEnd,
                level: recovered.length === chunk.length ? 'success' : 'warning',
                status: `AI 页面分析已完成 ${chunkIndex}/${totalChunks} 组…`,
                message: `页面编目：第 ${range} 页处理完成，AI 返回 ${recovered.length}/${chunk.length} 页，其余页面使用本地规则`
            });
        }

        const byPage = new Map(analyzed.map(item => [Number(item.pageNumber), item]));
        const normalizedItems = fallback.map(item => {
            const aiItem = byPage.get(item.pageNumber);
            return aiItem ? normalizeAiItem(aiItem, item, allowedCategories) : item;
        });
        const refinedItems = await refineSummaries(client, slides, normalizedItems, settings, onProgress);
        return {
            usedAi: analyzed.length > 0,
            aiError: warnings.length ? warnings.join('；') : null,
            taxonomy,
            items: refinedItems
        };
    } catch (error) {
        console.warn('[slide-design] AI analysis fallback:', error.message);
        reportProgress(onProgress, {
            progress: 1,
            level: 'warning',
            status: 'AI 整体不可用，正在使用本地规则…',
            message: `AI 分析发生未恢复错误，${slides.length} 页已全部切换到本地规则（${error.message}）`
        });
        return { items: fallback, usedAi: false, aiError: error.message, taxonomy: defaultTaxonomy() };
    }
}

async function refineExistingSummaries(slides, items) {
    const settings = await aiSettingsRepo.getRuntimeSettings();
    if (!settings.hasApiKey || !settings.keyLooksValid) return items;
    return refineSummaries(aiProviderClient.createClient(settings), slides, items, settings);
}

function mergeReclassificationVocabulary(vocabulary, assets) {
    const base = normalizeLibraryVocabulary(vocabulary);
    const selectedCounts = new Map();
    const selectedSamples = new Map();
    (Array.isArray(assets) ? assets : []).forEach(asset => {
        const name = slideRepo.cleanTag(asset.tag);
        selectedCounts.set(name, (selectedCounts.get(name) || 0) + 1);
        if (!selectedSamples.has(name)) selectedSamples.set(name, normalizeText(asset.summary).slice(0, 120));
    });
    const topics = new Map(base.topics.map(item => [item.name, { ...item }]));
    selectedCounts.forEach((count, name) => {
        if (!topics.has(name)) topics.set(name, { name, count, sampleSummary: selectedSamples.get(name) || '' });
    });
    const sortedTopics = [...topics.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
    const specificTopics = sortedTopics.filter(item => !/^(综合材料|其他|通用内容)$/.test(item.name));
    return {
        ...base,
        topics: (specificTopics.length ? specificTopics : sortedTopics).slice(0, 120)
    };
}

async function harmonizeExistingTopics(client, vocabulary, settings) {
    const topics = vocabulary.topics || [];
    if (!topics.length) return { aliases: new Map(), topics: [] };
    const prompt = `你是企业 PPT 素材库的信息架构师。请整理已有主题分类名称，把语义相同或高度近似的名字合并。

规则：
1. canonical 必须原样选自输入 name，优先保留使用次数 count 更高、含义更清晰、可复用性更强的名称。
2. 只有可相互替代的近义名称才能合并；上下位概念、不同业务对象、不同流程阶段不得强行合并。
3. aliases 只列出需要改名的其他现有名称，不包含 canonical。
4. 没有近义项的分类不需要输出。
5. 返回严格 JSON：{"groups":[{"canonical":"方案架构","aliases":["解决方案架构"],"reason":"语义相同，保留高频名称"}]}。

现有主题分类：${JSON.stringify(topics)}`;
    const result = await client.generateText({
        prompt,
        systemInstruction: '只输出严格合法 JSON，不创建输入中不存在的分类名称。',
        maxOutputTokens: Math.min(Math.max(Number(settings.maxOutputTokens || 2048), 2048), 4096),
        temperature: 0,
        responseMimeType: 'application/json',
        thinkingBudget: 0
    });
    const parsed = parseJson(result.text);
    const names = new Set(topics.map(item => item.name));
    const groups = (Array.isArray(parsed.groups) ? parsed.groups : []).map(group => ({
        canonical: slideRepo.cleanTag(group && group.canonical),
        aliases: Array.isArray(group && group.aliases) ? group.aliases : []
    })).filter(group => names.has(group.canonical));
    const canonicalNamesFromGroups = new Set(groups.map(group => group.canonical));
    const aliases = new Map();
    groups.forEach(group => {
        const canonical = group.canonical;
        group.aliases.forEach(value => {
            const alias = slideRepo.cleanTag(value);
            if (alias !== canonical && names.has(alias) && !canonicalNamesFromGroups.has(alias) && !aliases.has(alias)) {
                aliases.set(alias, canonical);
            }
        });
    });
    const canonicalNames = new Set(topics.map(item => aliases.get(item.name) || item.name));
    return {
        aliases,
        topics: topics.filter(item => canonicalNames.has(item.name) && !aliases.has(item.name))
    };
}

function normalizeReclassificationItem(raw, asset, allowedTopics, aliases) {
    const requestedTopic = raw ? slideRepo.cleanTag(raw.topic || raw.category || raw.tag) : '';
    const mappedCurrentTopic = aliases.get(asset.tag) || asset.tag;
    const tag = allowedTopics.has(requestedTopic) ? requestedTopic : mappedCurrentTopic;
    const requestedPageType = normalizeText(raw && raw.pageType);
    const requestedUsageScenario = normalizeText(raw && raw.usageScenario);
    return {
        id: asset.id,
        before: {
            tag: asset.tag,
            pageType: asset.pageType,
            usageScenario: asset.usageScenario
        },
        after: {
            tag,
            pageType: PAGE_TYPES.includes(requestedPageType) ? requestedPageType : asset.pageType,
            usageScenario: USAGE_SCENARIOS.includes(requestedUsageScenario) ? requestedUsageScenario : asset.usageScenario
        },
        reason: normalizeText(raw && raw.reason).slice(0, 180),
        sourceFilename: asset.sourceFilename,
        pageNumber: asset.pageNumber,
        summary: asset.summary
    };
}

function hasClassificationChange(change) {
    return change.before.tag !== change.after.tag
        || change.before.pageType !== change.after.pageType
        || change.before.usageScenario !== change.after.usageScenario;
}

async function classifyExistingAssetChunk(client, assets, canonicalTopics, aliases, settings) {
    const allowedNames = canonicalTopics.map(item => item.name);
    const compactAssets = assets.map(asset => ({
        id: asset.id,
        file: asset.sourceFilename,
        pageNumber: asset.pageNumber,
        current: {
            topic: asset.tag,
            pageType: asset.pageType,
            usageScenario: asset.usageScenario
        },
        summary: normalizeText(asset.summary).slice(0, 180),
        intent: normalizeText(asset.intent).slice(0, 160),
        extractedText: String(asset.extractedText || '').slice(0, 3500)
    }));
    const prompt = `请利用素材库中已经提取保存的文字，对这些历史 PPT 页面重新编目。不要生成摘要，不要改写内容。

允许的主题分类：${JSON.stringify(canonicalTopics)}
页面类型只能选择：${PAGE_TYPES.join('、')}
用途只能选择：${USAGE_SCENARIOS.join('、')}

要求：
1. topic 必须从允许的主题分类 name 中原样选择，优先复用已有名称。
2. 根据页面主要讨论对象判断主题，不能只看偶然关键词；语义近似页面必须归入同一主题。
3. pageType 反映页面在演示文稿中的结构作用；usageScenario 反映最适合的复用场景。
4. 即使建议保持不变，也必须返回该页。
5. reason 用一句简短中文说明变更依据。
6. 返回严格 JSON：{"items":[{"id":"...","topic":"...","pageType":"内容页","usageScenario":"方案讲解","reason":"..."}]}。

页面：${JSON.stringify(compactAssets)}`;
    const result = await client.generateText({
        prompt,
        systemInstruction: `你是 PPT 素材编目专家。主题只能使用：${allowedNames.join('、')}。只输出严格合法 JSON。`,
        maxOutputTokens: Math.min(Math.max(Number(settings.maxOutputTokens || 2048), 2048), 4096),
        temperature: 0,
        responseMimeType: 'application/json',
        thinkingBudget: 0
    });
    const returned = new Map(parsedItems(parseJson(result.text)).map(item => [String(item.id || ''), item]));
    if (!returned.size) throw new Error('AI 未返回历史素材分类结果');
    const allowedTopics = new Set(allowedNames);
    return assets.map(asset => normalizeReclassificationItem(returned.get(asset.id), asset, allowedTopics, aliases));
}

async function reclassifyExistingAssets(assets, { onProgress, client: providedClient, settings: providedSettings, vocabulary: providedVocabulary } = {}) {
    const input = Array.isArray(assets) ? assets.filter(asset => asset && asset.id) : [];
    if (!input.length) return { totalAssets: 0, changes: [], unchangedCount: 0, aliases: [] };
    const settings = providedSettings || await aiSettingsRepo.getRuntimeSettings();
    if (!providedClient && (!settings.hasApiKey || !settings.keyLooksValid)) {
        throw new Error('AI 配置不可用，无法进行语义分类整理');
    }
    const client = providedClient || aiProviderClient.createClient(settings);
    const libraryVocabulary = mergeReclassificationVocabulary(
        providedVocabulary || await slideRepo.getClassificationVocabulary({ topicLimit: 100 }),
        input
    );
    reportProgress(onProgress, {
        progress: 0.03,
        status: '正在归并历史分类名称…',
        message: `已读取 ${input.length} 页已有文字和 ${libraryVocabulary.topics.length} 个主题名称，不会重新解析 PPT 文件`
    });
    const harmonized = await harmonizeExistingTopics(client, libraryVocabulary, settings);
    const canonicalTopics = harmonized.topics.length ? harmonized.topics : libraryVocabulary.topics;
    const changes = [];
    const chunkSize = 5;
    const totalChunks = Math.ceil(input.length / chunkSize);
    for (let offset = 0; offset < input.length; offset += chunkSize) {
        const chunk = input.slice(offset, offset + chunkSize);
        const chunkIndex = Math.floor(offset / chunkSize) + 1;
        reportProgress(onProgress, {
            progress: 0.08 + ((chunkIndex - 1) / totalChunks * 0.9),
            status: `正在重新识别第 ${chunkIndex}/${totalChunks} 组…`,
            message: `使用已保存文字重新判断 ${chunk[0].sourceFilename} 第 ${chunk[0].pageNumber} 页起的主题、页面类型和用途`
        });
        let classified;
        try {
            classified = await classifyExistingAssetChunk(client, chunk, canonicalTopics, harmonized.aliases, settings);
        } catch (firstError) {
            classified = await classifyExistingAssetChunk(client, chunk, canonicalTopics, harmonized.aliases, {
                ...settings,
                maxOutputTokens: Math.max(Number(settings.maxOutputTokens || 2048), 3072)
            }).catch(secondError => {
                throw new Error(`第 ${chunkIndex}/${totalChunks} 组分类失败：${secondError.message || firstError.message}`);
            });
        }
        changes.push(...classified.filter(hasClassificationChange));
    }
    reportProgress(onProgress, {
        progress: 1,
        level: 'success',
        status: '分类整理预览已生成',
        message: `${input.length} 页分析完成，发现 ${changes.length} 页建议修改，等待用户确认后才会写入`
    });
    return {
        totalAssets: input.length,
        changes,
        unchangedCount: input.length - changes.length,
        aliases: [...harmonized.aliases.entries()].map(([from, to]) => ({ from, to }))
    };
}

module.exports = {
    extractSlideText,
    detectPageType,
    fallbackAnalysis,
    analyzeSlides,
    refineExistingSummaries,
    reclassifyExistingAssets,
    mergeReclassificationVocabulary,
    normalizeReclassificationItem,
    hasClassificationChange,
    buildDeckTaxonomy,
    normalizeLibraryVocabulary
};
