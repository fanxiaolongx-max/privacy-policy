const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { checkAuth } = require('../middleware/auth');

// 初始化 Gemini
let genAI = null;
const apiKey = process.env.GEMINI_API_KEY;

if (apiKey) {
    genAI = new GoogleGenerativeAI(apiKey);
    console.log('[AI] Google Gemini API Key configured.');
} else {
    console.warn('[AI] WARNING: GEMINI_API_KEY environment variable is not set. AI Assistant will not work.');
}

/**
 * POST /api/ai/chat
 * 接收对话历史和页面上下文，返回 Gemini 响应
 */
router.post('/chat', checkAuth, async (req, res) => {
    try {
        if (!genAI) {
            return res.status(503).json({ 
                error: '未配置 GEMINI_API_KEY，AI 助手当前不可用。请联系管理员在服务端配置环境变量。' 
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
3. 如果用户的提问超出了系统功能范畴，请礼貌地告知你专注于协助使用本工具中台。`;

        // 我们使用 gemini-2.5-flash
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            systemInstruction: systemInstruction
        });

        // 转换历史记录为 Gemini SDK 格式
        const chat = model.startChat({
            history: messages.slice(0, -1).map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            })),
            generationConfig: {
                maxOutputTokens: 2048,
                temperature: 0.7,
            },
        });

        // 获取最新一条用户消息
        const lastMessage = messages[messages.length - 1];
        if (!lastMessage || lastMessage.role !== 'user') {
            return res.status(400).json({ error: '最后一条消息必须是用户发送的' });
        }

        // 发送消息
        const result = await chat.sendMessage(lastMessage.content);
        const responseText = result.response.text();
        
        let totalTokens = 0;
        let costMao = 0;
        if (result.response.usageMetadata) {
            totalTokens = result.response.usageMetadata.totalTokenCount;
            const promptTokens = result.response.usageMetadata.promptTokenCount || 0;
            const outputTokens = result.response.usageMetadata.candidatesTokenCount || 0;
            // 估算：Gemini Flash 约为 $0.075/1M Input, $0.30/1M Output
            const costUSD = (promptTokens * 0.075 + outputTokens * 0.3) / 1000000;
            // 按目前大约 1美元 = 7.2人民币，即 1美元 = 72毛 计算
            costMao = costUSD * 72;
        }

        res.json({ reply: responseText, tokens: totalTokens, cost: costMao });
    } catch (error) {
        console.error('[AI] Chat error:', error);
        res.status(500).json({ error: 'AI 思考时出现异常: ' + error.message });
    }
});

module.exports = router;
