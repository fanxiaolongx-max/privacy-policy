const DEFAULT_BASE_URLS = {
    gemini: 'https://generativelanguage.googleapis.com/v1beta',
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    'openai-compatible': 'https://api.openai.com/v1'
};
const aiUsageRepo = require('./ai-usage-repository');

function normalizeProvider(provider) {
    const value = String(provider || '').trim().toLowerCase();
    if (['gemini', 'openai', 'anthropic', 'openai-compatible'].includes(value)) return value;
    return 'gemini';
}

function trimSlash(value) {
    return String(value || '').replace(/\/+$/, '');
}

function getBaseUrl(settings = {}) {
    const provider = normalizeProvider(settings.provider);
    return trimSlash(settings.apiBaseUrl || DEFAULT_BASE_URLS[provider]);
}

function normalizeMessages(messages = []) {
    return (Array.isArray(messages) ? messages : [])
        .map(msg => ({
            role: msg.role === 'model' || msg.role === 'assistant' ? 'model' : 'user',
            content: String(msg.content || '')
        }))
        .filter(msg => msg.content);
}

function extractGeminiText(data) {
    const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
    return Array.isArray(parts) ? parts.map(part => part.text || '').join('').trim() : '';
}

function extractAnthropicText(data) {
    const parts = Array.isArray(data && data.content) ? data.content : [];
    return parts.map(part => part && part.type === 'text' ? part.text || '' : '').join('').trim();
}

function stripReasoningText(value) {
    let text = String(value || '');
    if (!text) return '';

    text = text.replace(/^\s*(AI|Assistant|助手)?\s*(?=<think\b)/i, '');
    text = text.replace(/<think(?:ing)?\b[^>]*>[\s\S]*?<\/think(?:ing)?>/gi, '');
    text = text.replace(/<reasoning\b[^>]*>[\s\S]*?<\/reasoning>/gi, '');

    const openThink = text.search(/<think(?:ing)?\b[^>]*>/i);
    if (openThink >= 0) {
        const afterOpen = text.slice(openThink).replace(/^<think(?:ing)?\b[^>]*>/i, '');
        const markers = [
            /\n\s*(?:最终答案|答案|总结|结论|回复|输出)\s*[:：]\s*/i,
            /\n\s*(?:Final Answer|Answer|Response|Summary)\s*[:：]\s*/i,
            /\n\s*<\/think(?:ing)?>\s*/i
        ];
        let best = -1;
        let bestLength = 0;
        markers.forEach(marker => {
            const match = afterOpen.match(marker);
            if (match && (best === -1 || match.index < best)) {
                best = match.index;
                bestLength = match[0].length;
            }
        });
        text = best >= 0 ? afterOpen.slice(best + bestLength) : '';
    }

    text = text
        .replace(/^\s*(?:最终答案|答案|总结|结论|回复|输出|Final Answer|Answer|Response|Summary)\s*[:：]\s*/i, '')
        .trim();
    return text;
}

function isJsonMode(options = {}) {
    return options.responseMimeType === 'application/json' || options.json === true;
}

async function parseErrorResponse(res) {
    let body = '';
    try {
        body = await res.text();
    } catch (_err) {}
    const error = new Error(buildProviderErrorMessage(res, body));
    error.status = res.status;
    error.statusCode = res.status;
    throw error;
}

function buildProviderErrorMessage(res, body = '') {
    const contentType = res && res.headers && res.headers.get ? String(res.headers.get('content-type') || '') : '';
    const text = String(body || '').trim();
    const preview = text.replace(/\s+/g, ' ').slice(0, 220);
    if (/<!doctype|<html/i.test(text) || contentType.includes('text/html')) {
        return `AI 接口返回了 HTML 页面，不是 JSON。通常是供应商协议或 API URL 配错：当前请求到 ${res.url || '未知地址'}，请检查是否应选择 OpenAI Compatible，并填写正确的 /v1 基地址。返回片段：${preview}`;
    }
    return `AI provider request failed (${res.status}): ${preview}`;
}

async function readProviderJson(res) {
    const text = await res.text();
    const contentType = String(res.headers.get('content-type') || '');
    if (/<!doctype|<html/i.test(text) || contentType.includes('text/html')) {
        const error = new Error(buildProviderErrorMessage(res, text));
        error.status = res.status;
        error.statusCode = res.status;
        throw error;
    }
    try {
        return JSON.parse(text);
    } catch (err) {
        const error = new Error(`AI 接口返回内容不是合法 JSON。请检查供应商协议/API URL/模型名称。返回片段：${text.replace(/\s+/g, ' ').slice(0, 220)}`);
        error.status = res.status;
        error.statusCode = res.status;
        throw error;
    }
}

class AiProviderClient {
    constructor(settings = {}) {
        this.settings = settings;
        this.provider = normalizeProvider(settings.provider);
        this.baseUrl = getBaseUrl(settings);
        this.apiKey = settings.apiKey || '';
        this.model = settings.model || (this.provider === 'anthropic' ? 'claude-3-5-sonnet-latest' : 'gemini-2.5-flash');
    }

    async generateText({ prompt, systemInstruction = '', messages = null, maxOutputTokens, temperature, responseMimeType, json } = {}) {
        const finalMessages = messages ? normalizeMessages(messages) : [{ role: 'user', content: String(prompt || '') }];
        let result;
        if (this.provider === 'openai' || this.provider === 'openai-compatible') {
            result = await this.generateOpenAi({ messages: finalMessages, systemInstruction, maxOutputTokens, temperature, responseMimeType, json });
        } else if (this.provider === 'anthropic') {
            result = await this.generateAnthropic({ messages: finalMessages, systemInstruction, maxOutputTokens, temperature });
        } else {
            result = await this.generateGemini({ messages: finalMessages, systemInstruction, maxOutputTokens, temperature, responseMimeType, json });
        }
        try {
            const usage = result?.usage || {};
            const promptTokens = Number(usage.promptTokens || 0);
            const outputTokens = Number(usage.outputTokens || 0);
            const totalTokens = Number(usage.totalTokens || 0) || promptTokens + outputTokens;
            const costUsd = (
                promptTokens * Number(this.settings.inputCostPerMillionUsd || 0) +
                outputTokens * Number(this.settings.outputCostPerMillionUsd || 0)
            ) / 1000000;
            await aiUsageRepo.recordUsage({
                promptTokens,
                outputTokens,
                totalTokens,
                costUsd,
                costCny: costUsd * Number(this.settings.usdToCny || 0)
            });
        } catch (usageErr) {
            console.warn('[AI] failed to record provider usage:', usageErr.message || usageErr);
        }
        return result;
    }

    async generateChat({ messages, systemInstruction = '', maxOutputTokens, temperature, responseMimeType, json } = {}) {
        return this.generateText({ messages, systemInstruction, maxOutputTokens, temperature, responseMimeType, json });
    }

    async generateGemini({ messages, systemInstruction, maxOutputTokens, temperature, responseMimeType, json }) {
        const url = `${this.baseUrl}/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
        const body = {
            contents: normalizeMessages(messages).map(msg => ({
                role: msg.role === 'model' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            })),
            generationConfig: {
                maxOutputTokens: Math.round(Number(maxOutputTokens || this.settings.maxOutputTokens || 2048)),
                temperature: Number(temperature ?? this.settings.temperature ?? 0.7)
            }
        };
        if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] };
        if (isJsonMode({ responseMimeType, json })) body.generationConfig.responseMimeType = 'application/json';

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) await parseErrorResponse(res);
        const data = await readProviderJson(res);
        const usage = data.usageMetadata || {};
        return {
            text: stripReasoningText(extractGeminiText(data)),
            usage: {
                promptTokens: usage.promptTokenCount || 0,
                outputTokens: usage.candidatesTokenCount || 0,
                totalTokens: usage.totalTokenCount || 0
            },
            raw: data
        };
    }

    async generateOpenAi({ messages, systemInstruction, maxOutputTokens, temperature, responseMimeType, json }) {
        const bodyMessages = [];
        if (systemInstruction) bodyMessages.push({ role: 'system', content: systemInstruction });
        normalizeMessages(messages).forEach(msg => {
            bodyMessages.push({ role: msg.role === 'model' ? 'assistant' : 'user', content: msg.content });
        });
        const body = {
            model: this.model,
            messages: bodyMessages,
            max_tokens: Math.round(Number(maxOutputTokens || this.settings.maxOutputTokens || 2048)),
            temperature: Number(temperature ?? this.settings.temperature ?? 0.7)
        };
        if (isJsonMode({ responseMimeType, json })) body.response_format = { type: 'json_object' };

        const res = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(body)
        });
        if (!res.ok) await parseErrorResponse(res);
        const data = await readProviderJson(res);
        const usage = data.usage || {};
        return {
            text: stripReasoningText(data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content),
            usage: {
                promptTokens: usage.prompt_tokens || 0,
                outputTokens: usage.completion_tokens || 0,
                totalTokens: usage.total_tokens || 0
            },
            raw: data
        };
    }

    async generateAnthropic({ messages, systemInstruction, maxOutputTokens, temperature }) {
        const body = {
            model: this.model,
            max_tokens: Math.round(Number(maxOutputTokens || this.settings.maxOutputTokens || 2048)),
            temperature: Number(temperature ?? this.settings.temperature ?? 0.7),
            messages: normalizeMessages(messages).map(msg => ({
                role: msg.role === 'model' ? 'assistant' : 'user',
                content: msg.content
            }))
        };
        if (systemInstruction) body.system = systemInstruction;

        const res = await fetch(`${this.baseUrl}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(body)
        });
        if (!res.ok) await parseErrorResponse(res);
        const data = await readProviderJson(res);
        const usage = data.usage || {};
        return {
            text: stripReasoningText(extractAnthropicText(data)),
            usage: {
                promptTokens: usage.input_tokens || 0,
                outputTokens: usage.output_tokens || 0,
                totalTokens: (usage.input_tokens || 0) + (usage.output_tokens || 0)
            },
            raw: data
        };
    }
}

function createClient(settings = {}) {
    return new AiProviderClient(settings);
}

module.exports = {
    DEFAULT_BASE_URLS,
    normalizeProvider,
    stripReasoningText,
    createClient
};
