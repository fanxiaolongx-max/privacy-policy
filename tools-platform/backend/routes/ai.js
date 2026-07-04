const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { checkAuth } = require('../middleware/auth');
const aiSettingsRepo = require('../models/ai-settings-repository');
const aiChatRepo = require('../models/ai-chat-repository');

console.log('[AI] AI Assistant route loaded. Runtime config will be read from settings, with GEMINI_API_KEY as fallback.');

const RECENT_CONTEXT_MESSAGES = 8;
const COMPRESS_TRIGGER_MESSAGES = 14;
const COMPRESS_TRIGGER_CHARS = 14000;
const SUMMARY_MAX_CHARS = 6000;
const PAGE_CONTEXT_MAX_CHARS = 12000;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isTransientAiError(error) {
    const status = error && (error.status || error.statusCode);
    const msg = String(error && error.message || '');
    return status === 503 || /Service Unavailable|high demand|temporar/i.test(msg);
}

async function sendMessageWithRetry(chat, content, maxAttempts = 3) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            return await chat.sendMessage(content);
        } catch (error) {
            lastError = error;
            if (!isTransientAiError(error) || attempt >= maxAttempts) throw error;
            const waitMs = 700 * attempt;
            console.warn(`[AI] Gemini transient error, retrying ${attempt}/${maxAttempts - 1} after ${waitMs}ms: ${error.message}`);
            await sleep(waitMs);
        }
    }
    throw lastError;
}

function stripJsonFence(value) {
    return String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
}

function parseAiJson(value) {
    const raw = stripJsonFence(value);
    try {
        return JSON.parse(raw);
    } catch (firstError) {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
        throw firstError;
    }
}

function estimateMessagesChars(messages = []) {
    return messages.reduce((sum, msg) => sum + String(msg.content || '').length, 0);
}

function formatMessagesForSummary(messages = []) {
    return messages.map(msg => {
        const role = msg.role === 'model' ? 'AI' : '用户';
        return `[${role}] ${String(msg.content || '').slice(0, 4000)}`;
    }).join('\n\n');
}

async function generateRollingSummary(model, { previousSummary, messages, pageTitle }) {
    if (!messages.length) return previousSummary || '';
    const prompt = `请把下面 Tools Platform 智能客服的历史对话压缩成可继续对话的滚动摘要。

要求：
- 保留用户关注点、已确认事实、排除过的原因、关键数据口径、待跟进事项。
- 如果已有旧摘要，请与新消息合并，避免重复。
- 不要编造新事实，不要输出寒暄。
- 控制在 ${SUMMARY_MAX_CHARS} 个中文字符以内。

页面标题：${pageTitle || '未知'}

旧摘要：
${previousSummary || '无'}

新增历史消息：
${formatMessagesForSummary(messages)}`;

    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.2
        }
    });
    return String(result.response.text() || '').trim().slice(0, SUMMARY_MAX_CHARS);
}

async function compressSessionIfNeeded({ model, sessionId, pageTitle }) {
    if (!sessionId) return null;
    const payload = await aiChatRepo.getMessagesForCompression(sessionId, RECENT_CONTEXT_MESSAGES);
    if (!payload.session || !payload.messages.length) return payload.session;
    const chars = estimateMessagesChars(payload.messages);
    if (payload.messages.length < COMPRESS_TRIGGER_MESSAGES && chars < COMPRESS_TRIGGER_CHARS) {
        return payload.session;
    }

    try {
        const summary = await generateRollingSummary(model, {
            previousSummary: payload.session.summary || '',
            messages: payload.messages,
            pageTitle
        });
        if (summary && payload.cutoffMessageId) {
            await aiChatRepo.updateSessionSummary(payload.session.id, {
                summary,
                summaryUntilMessageId: payload.cutoffMessageId
            });
            return {
                ...payload.session,
                summary,
                summary_until_message_id: payload.cutoffMessageId
            };
        }
    } catch (err) {
        console.warn('[AI] session compression skipped:', err.message || err);
    }
    return payload.session;
}

async function buildEffectiveMessages({ sessionId, incomingMessages, lastMessage }) {
    if (!sessionId) {
        return incomingMessages.slice(-10);
    }
    const recent = await aiChatRepo.getRecentMessagesForContext(sessionId, RECENT_CONTEXT_MESSAGES);
    const effective = recent.map(msg => ({
        role: msg.role === 'model' ? 'model' : 'user',
        content: msg.content || ''
    }));
    while (effective.length && effective[0].role !== 'user') {
        effective.shift();
    }
    const lastRecent = effective[effective.length - 1];
    if (!lastRecent || lastRecent.role !== 'user' || lastRecent.content !== lastMessage.content) {
        effective.push(lastMessage);
    }
    return effective;
}

function fallbackPptActions(instruction, operationContext) {
    const components = Array.isArray(operationContext?.components) ? operationContext.components : [];
    const unlocked = components.filter(item => !item.locked);
    const excludesTitle = /除标题|标题除外|不动标题/.test(instruction);
    const targets = unlocked
        .filter(item => !(excludesTitle && /标题/.test(String(item.type))))
        .map(item => item.id)
        .filter(Boolean);
    if (!targets.length) return null;

    const columnMatch = String(instruction).match(/([二两三四五六2-6])\s*栏/);
    const columnMap = { 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6 };
    const columns = columnMatch ? (columnMap[columnMatch[1]] || Number(columnMatch[1])) : null;
    if (columns) {
        return {
            summary: `已使用本地布局引擎整理为 ${columns} 栏`,
            actions: [
                {
                    type: 'grid',
                    targets,
                    columns,
                    gap: 12,
                    x: 34,
                    y: 72,
                    width: 412,
                    rowHeight: Math.max(60, Math.floor(240 / Math.ceil(targets.length / columns))),
                    equalWidth: true
                },
                {
                    type: 'setStyle',
                    targets,
                    styles: {
                        borderRadius: '8px',
                        padding: '10px',
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        borderColor: '#d4d4d8'
                    }
                }
            ],
            fallback: true
        };
    }
    return null;
}

/**
 * POST /api/ai/chat
 * 接收对话历史和页面上下文，返回 Gemini 响应
 */
router.post('/chat', checkAuth, async (req, res) => {
    try {
        const aiSettings = await aiSettingsRepo.getRuntimeSettings();
        if (!aiSettings.hasApiKey) {
            return res.status(503).json({ 
                error: '未配置 AI 助手 API Token，当前不可用。请管理员在全局设置中配置，或继续使用 GEMINI_API_KEY 环境变量兜底。'
            });
        }
        if (!aiSettings.keyLooksValid) {
            return res.status(503).json({
                error: '当前 AI 助手 API Token 格式疑似无效。请在全局设置 > AI 助手中重新填写 Gemini API Key，通常以 AIza 开头。'
            });
        }

        const { messages, context, pageTitle, pagePath, sessionId, persist } = req.body;
        
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: '无效的 messages 参数' });
        }

        const lastMessage = messages[messages.length - 1];
        if (!lastMessage || lastMessage.role !== 'user') {
            return res.status(400).json({ error: '最后一条消息必须是用户发送的' });
        }

        const normalizedPath = aiChatRepo.normalizePagePath(pagePath || req.get('referer') || '');
        let savedSessionId = sessionId || null;
        if (persist !== false) {
            savedSessionId = await aiChatRepo.getOrCreateSession({
                sessionId,
                pagePath: normalizedPath,
                pageTitle
            });
        }

        const genAI = new GoogleGenerativeAI(aiSettings.apiKey);
        const model = genAI.getGenerativeModel({
            model: aiSettings.model
        });
        const compressedSession = persist !== false
            ? await compressSessionIfNeeded({ model, sessionId: savedSessionId, pageTitle })
            : null;
        const sessionSummary = compressedSession && compressedSession.summary ? compressedSession.summary : '';
        const effectiveMessages = await buildEffectiveMessages({
            sessionId: savedSessionId,
            incomingMessages: messages,
            lastMessage
        });

        // 构造 System Instruction
        const systemInstruction = `你是一个名为 "Tools Platform 智能助手" 的 AI，被集成在华为的一个工具中台中。
你的主要职责是根据用户当前所在的页面上下文，帮助他们理解页面功能、解答疑惑或总结数据。
当前页面标题: ${pageTitle || '未知'}
当前页面核心文本内容:
---
${context ? context.substring(0, PAGE_CONTEXT_MAX_CHARS) : '未提供'}
---
${sessionSummary ? `\n历史会话滚动摘要：\n---\n${sessionSummary}\n---\n` : ''}
**核心要求**：
1. 必须极其精简，直接切中要害。
2. 拒绝长篇大论，务必使用 Markdown 列表（Bullet points）来组织信息。
3. 如果用户的提问超出了系统功能范畴，请礼貌地告知你专注于协助使用本工具中台。
${aiSettings.systemPrompt ? `\n**管理员补充要求**：\n${aiSettings.systemPrompt}` : ''}`;

        const answerModel = genAI.getGenerativeModel({
            model: aiSettings.model,
            systemInstruction: systemInstruction
        });

        // 转换历史记录为 Gemini SDK 格式
        const chat = answerModel.startChat({
            history: effectiveMessages.slice(0, -1).map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            })),
            generationConfig: {
                maxOutputTokens: aiSettings.maxOutputTokens,
                temperature: aiSettings.temperature,
            },
        });

        // 发送消息
        const result = await sendMessageWithRetry(chat, effectiveMessages[effectiveMessages.length - 1].content);
        const responseText = result.response.text();
        
        let totalTokens = 0;
        let costMao = 0;
        if (result.response.usageMetadata) {
            totalTokens = result.response.usageMetadata.totalTokenCount;
            const promptTokens = result.response.usageMetadata.promptTokenCount || 0;
            const outputTokens = result.response.usageMetadata.candidatesTokenCount || 0;
            const costUSD = (
                promptTokens * aiSettings.inputCostPerMillionUsd +
                outputTokens * aiSettings.outputCostPerMillionUsd
            ) / 1000000;
            costMao = costUSD * aiSettings.usdToCny * 10;
        }

        if (persist !== false) {
            try {
                await aiChatRepo.addMessage({
                    sessionId: savedSessionId,
                    pagePath: normalizedPath,
                    pageTitle,
                    role: 'user',
                    content: lastMessage.content
                });
                await aiChatRepo.addMessage({
                    sessionId: savedSessionId,
                    pagePath: normalizedPath,
                    pageTitle,
                    role: 'model',
                    content: responseText,
                    tokens: totalTokens,
                    cost: costMao
                });
                await aiChatRepo.recordQuestion({
                    pagePath: normalizedPath,
                    question: lastMessage.content
                });
            } catch (saveErr) {
                console.warn('[AI] failed to persist chat history:', saveErr.message || saveErr);
            }
        }

        res.json({ reply: responseText, tokens: totalTokens, cost: costMao, sessionId: savedSessionId });
    } catch (error) {
        console.error('[AI] Chat error:', error);
        if (isTransientAiError(error)) {
            return res.status(503).json({
                error: 'AI 服务当前繁忙，已自动重试但仍未成功。请稍后再试，或在全局设置中临时切换其他可用模型。'
            });
        }
        res.status(500).json({ error: 'AI 思考时出现异常: ' + error.message });
    }
});

router.get('/suggestions', checkAuth, async (req, res) => {
    try {
        const items = await aiChatRepo.listSuggestions({
            pagePath: req.query.pagePath || req.get('referer') || '',
            limit: req.query.limit
        });
        res.json({ items });
    } catch (err) {
        console.error('[AI] suggestions failed:', err);
        res.status(500).json({ error: '读取推荐问题失败: ' + err.message });
    }
});

router.get('/sessions', checkAuth, async (req, res) => {
    try {
        const items = await aiChatRepo.listSessions({
            pagePath: req.query.pagePath || req.get('referer') || '',
            limit: req.query.limit
        });
        res.json({ items });
    } catch (err) {
        console.error('[AI] sessions failed:', err);
        res.status(500).json({ error: '读取历史问答失败: ' + err.message });
    }
});

router.get('/sessions/:sessionId/messages', checkAuth, async (req, res) => {
    try {
        const items = await aiChatRepo.listMessages(req.params.sessionId);
        res.json({ items });
    } catch (err) {
        console.error('[AI] session messages failed:', err);
        res.status(500).json({ error: '读取历史消息失败: ' + err.message });
    }
});

/**
 * POST /api/ai/ppt-copilot-actions
 * 针对单个选中组件生成受控、可校验的结构化修改动作
 */
router.post('/ppt-copilot-actions', checkAuth, async (req, res) => {
    try {
        const aiSettings = await aiSettingsRepo.getRuntimeSettings();
        if (!aiSettings.hasApiKey || !aiSettings.keyLooksValid) {
            return res.status(503).json({ error: 'AI API Token 未配置或格式无效。' });
        }
        const { instruction, context, component, rules } = req.body || {};
        const operationContext = context || (component ? { scope: 'single', components: [component] } : null);
        if (!instruction || typeof instruction !== 'string' || !operationContext || typeof operationContext !== 'object') {
            return res.status(400).json({ error: '缺少修改指令或组件上下文。' });
        }

        const systemInstruction = `你是 PPT 组件与页面布局精确修改助手。你只能返回 JSON，不得返回 Markdown 或解释。
返回结构：
{"summary":"一句话说明","actions":[...]}

允许的 action：
1. {"type":"setText","target":"组件id","value":"新文本"}
2. {"type":"setStyle","target":"组件id或all","targets":["id1","id2"],"styles":{...}}
3. {"type":"move","target":"组件id或all","targets":["id1"],"dx":数字,"dy":数字}
4. {"type":"setPosition","target":"组件id","x":数字,"y":数字}
5. {"type":"resize","target":"组件id或all","targets":["id1"],"width":数字,"height":数字}
6. {"type":"align","targets":["id1","id2"],"mode":"left|center|right|top|middle|bottom"}
7. {"type":"grid","targets":["id1","id2"],"columns":2,"gap":12,"x":40,"y":70,"width":400,"rowHeight":90,"equalWidth":true}

setStyle 只允许以下属性：
backgroundColor,borderColor,borderWidth,borderRadius,borderStyle,boxShadow,opacity,padding,
color,fontFamily,fontSize,fontWeight,fontStyle,lineHeight,letterSpacing,textAlign,textDecoration。

要求：
- 不修改用户没有要求的属性。
- 多选批量操作应使用 target:"all" 或 targets。
- 整页重排必须为每个动作提供 target/targets，优先使用 grid、align 和 setPosition。
- 不移动页脚等 locked 组件；上下文中的组件 id 必须原样使用。
- 尺寸坐标基于 480x360 幻灯片。
- CSS 数值需要带单位，例如 "24px"；opacity 使用 0 到 1。
- 不生成 HTML、脚本、URL 或事件处理器。
- actions 最多 40 条，尽量合并相同目标的样式操作。`;

        const genAI = new GoogleGenerativeAI(aiSettings.apiKey);
        const model = genAI.getGenerativeModel({
            model: aiSettings.model,
            systemInstruction,
            generationConfig: {
                maxOutputTokens: Math.min(Math.max(aiSettings.maxOutputTokens, 4096), 8192),
                temperature: 0.1,
                responseMimeType: 'application/json'
            }
        });
        const prompt = `用户要求：${instruction.slice(0, 2000)}
操作范围：${operationContext.scope || 'single'}
组件上下文：${JSON.stringify(operationContext).slice(0, 24000)}
用户规范：${String(rules || '').slice(0, 3000)}`;
        let parsed;
        let firstRaw = '';
        try {
            const result = await model.generateContent(prompt);
            firstRaw = result.response.text();
            parsed = parseAiJson(firstRaw);
        } catch (parseError) {
            console.warn('[AI Copilot Actions] invalid JSON, retrying:', parseError.message);
            try {
                const retryPrompt = `${prompt}

你上一次输出的 JSON 无法解析。请重新输出更短、更紧凑的完整 JSON。
不要解释，不要 Markdown。每个 action 只保留必要字段。
上次输出（可能被截断）：
${firstRaw.slice(0, 6000)}`;
                const retryResult = await model.generateContent(retryPrompt);
                parsed = parseAiJson(retryResult.response.text());
            } catch (retryError) {
                const fallback = fallbackPptActions(instruction, operationContext);
                if (fallback) return res.json(fallback);
                throw new Error('AI 返回的结构化结果不完整，请缩短要求后重试');
            }
        }
        const actions = Array.isArray(parsed.actions) ? parsed.actions.slice(0, 40) : [];
        res.json({ summary: String(parsed.summary || '组件修改完成'), actions });
    } catch (error) {
        console.error('[AI Copilot Actions] error:', error);
        res.status(500).json({ error: 'AI 组件修改失败: ' + error.message });
    }
});

/**
 * POST /api/ai/ppt-copilot
 * 专为 PPT Copilot 优化的 AI 生成接口，直接返回 HTML 代码格式的幻灯片
 */
router.post('/ppt-copilot', checkAuth, async (req, res) => {
    try {
        const aiSettings = await aiSettingsRepo.getRuntimeSettings();
        if (!aiSettings.hasApiKey) {
            return res.status(503).json({ error: '未配置 AI API Token。' });
        }
        if (!aiSettings.keyLooksValid) {
            return res.status(503).json({ error: 'AI API Token 格式无效。' });
        }

        const { messages, templates } = req.body;
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: '无效的 messages 参数' });
        }

        const systemInstruction = `你是一个专业的幻灯片（PPT）内容生成助手。
你的任务是根据用户的需求，生成符合格式的 PPT 幻灯片 JSON 数据。
**极其重要：你必须返回一段合法的 JSON 数组，每个元素代表一页幻灯片。不要返回任何 Markdown 或 HTML！**

**关于排版与主题（核心要求）**：
- 用户希望你**自由发挥排版**，不必拘泥于固定的模板或表格格式！
- 你可以大量使用 \`"layout": "custom"\`，在 \`html\` 字段中自由编写排版代码（如使用 flex, grid, div 结构等）。
- **为了保持整体 PPT 的主题一致性**，你生成的 HTML 必须复用页面的基础类名，例如：
  - 页面大标题：\`<h2 class="slide-title editable">你的标题</h2>\`
  - 正文/段落容器：包含 \`class="editable"\`，如 \`<div class="editable">...</div>\` 或 \`<p class="editable">...</p>\`
- **画布尺寸与字号规范（极重要）**：当前幻灯片的物理画布是标准宽屏（**1920x1080 像素**），因此你需要使用大号的排版与字号：
  - **正文字号**：推荐使用 \`text-2xl\` (24px) 或 \`text-3xl\` (30px)。
  - **模块标题**：推荐使用 \`text-4xl\` (36px)。
  - **最大号的页面大标题**：仅建议使用 \`text-5xl\` 或 \`text-6xl\`。
  - **间距调整**：务必保证内容的呼吸感，多使用 \`gap-8\`, \`gap-12\`, \`p-8\` 等大间距，以适应 1920x1080 边界。
- **防止垂直溢出（严禁文字超出底部）**：大字号会占用更多空间！你必须极度精简文案，提炼核心结论，绝对不要生成大段长篇文本导致内容撑破屏幕底部！如果内容多，请务必使用多列布局（如 \`grid grid-cols-2\` 或 \`grid-cols-3\`）来横向分摊内容。
- 文本如果需要特定强调，可以使用 \`<strong>\` 或内联颜色，但整体基础颜色交由外部 CSS 控制即可。
如果你觉得有必要，依然可以使用以下快捷 Layout，但推荐优先使用 custom 自由排版：
1. 封面: {"layout": "cover", "title": "主标题", "subtitle": "副标题"}
2. 目录: {"layout": "agenda", "title": "标题", "rows": [{"active": true, "content": "事项"}]}
3. 自由排版 (最推荐): {"layout": "custom", "html": "<h2 class='slide-title editable'>标题</h2><div class='editable flex gap-4'>自由结构代码...</div>"}

**规则**：
1. 返回形式必须是 JSON 数组，例如：[ { "layout": "custom", "html": "..." } ]
2. 只返回 JSON，不要解释说明文字，不要 \`\`\`json 包裹符。
${templates || ''}`;

        const genAI = new GoogleGenerativeAI(aiSettings.apiKey);
        const model = genAI.getGenerativeModel({ 
            model: aiSettings.model,
            systemInstruction: systemInstruction
        });

        const chat = model.startChat({
            history: messages.slice(0, -1).map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            })),
            generationConfig: {
                maxOutputTokens: 8192,
                temperature: 0.2, // Lower temperature for more stable template generation
                responseMimeType: "application/json",
            },
        });

        const lastMessage = messages[messages.length - 1];
        if (!lastMessage || lastMessage.role !== 'user') {
            return res.status(400).json({ error: '最后一条消息必须是用户发送的' });
        }

        const result = await sendMessageWithRetry(chat, lastMessage.content);
        const responseText = result.response.text();

        res.json({ reply: responseText });
    } catch (error) {
        console.error('[AI Copilot] Chat error:', error);
        res.status(500).json({ error: 'AI 生成失败: ' + error.message });
    }
});

module.exports = router;
