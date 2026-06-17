const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { checkAuth } = require('../middleware/auth');
const aiSettingsRepo = require('../models/ai-settings-repository');

console.log('[AI] AI Assistant route loaded. Runtime config will be read from settings, with GEMINI_API_KEY as fallback.');

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

/**
 * POST /api/ai/chat
 * 接收对话历史和页面上下文，返回 Gemini 响应
 */
router.post('/chat', checkAuth, async (req, res) => {
    try {
        const aiSettings = aiSettingsRepo.getRuntimeSettings();
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

        const { messages, context, pageTitle } = req.body;
        
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: '无效的 messages 参数' });
        }

        // 构造 System Instruction
        const systemInstruction = `你是一个名为 "Tools Platform 智能助手" 的 AI，被集成在华为的一个工具中台中。
你的主要职责是根据用户当前所在的页面上下文，帮助他们理解页面功能、解答疑惑或总结数据。
当前页面标题: ${pageTitle || '未知'}
当前页面核心文本内容:
---
${context ? context.substring(0, 15000) : '未提供'}
---
**核心要求**：
1. 必须极其精简，直接切中要害。
2. 拒绝长篇大论，务必使用 Markdown 列表（Bullet points）来组织信息。
3. 如果用户的提问超出了系统功能范畴，请礼貌地告知你专注于协助使用本工具中台。
${aiSettings.systemPrompt ? `\n**管理员补充要求**：\n${aiSettings.systemPrompt}` : ''}`;

        const genAI = new GoogleGenerativeAI(aiSettings.apiKey);
        const model = genAI.getGenerativeModel({ 
            model: aiSettings.model,
            systemInstruction: systemInstruction
        });

        // 转换历史记录为 Gemini SDK 格式
        const chat = model.startChat({
            history: messages.slice(0, -1).map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            })),
            generationConfig: {
                maxOutputTokens: aiSettings.maxOutputTokens,
                temperature: aiSettings.temperature,
            },
        });

        // 获取最新一条用户消息
        const lastMessage = messages[messages.length - 1];
        if (!lastMessage || lastMessage.role !== 'user') {
            return res.status(400).json({ error: '最后一条消息必须是用户发送的' });
        }

        // 发送消息
        const result = await sendMessageWithRetry(chat, lastMessage.content);
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

        res.json({ reply: responseText, tokens: totalTokens, cost: costMao });
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

/**
 * POST /api/ai/ppt-copilot
 * 专为 PPT Copilot 优化的 AI 生成接口，直接返回 HTML 代码格式的幻灯片
 */
router.post('/ppt-copilot', checkAuth, async (req, res) => {
    try {
        const aiSettings = aiSettingsRepo.getRuntimeSettings();
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

        const systemInstruction = `你是一个专业的幻灯片（PPT）代码生成助手。
你的任务是根据用户的需求，生成符合格式的 PPT 幻灯片。
**极其重要：你必须且只能使用以下提供的 HTML 模板结构，严格原样保留 HTML 标签、class 属性和 contenteditable 属性，只替换其中的文本内容！不要自创 HTML 结构，不要使用 Markdown 列表，你的回复应该仅仅是一段或多段符合模板的有效 HTML 代码。**

可用模板库如下：
---
${templates || ''}
---
**规则**：
1. 请根据用户请求的类型（封面、议程、规则、案例），直接返回对应的 HTML 代码块。
2. 你可以组合多个幻灯片（即返回多段 \`<div class="slide-wrap">...</div>\`）。
3. 只返回 HTML 代码，不要任何解释说明的文字，不要包含 \`\`\`html 这样的包裹符（或者如果有，前端也会处理，但最好直接返回干净的代码）。`;

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
                maxOutputTokens: aiSettings.maxOutputTokens,
                temperature: 0.2, // Lower temperature for more stable template generation
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
