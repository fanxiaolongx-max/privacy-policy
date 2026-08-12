#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const settingsRepo = require('../backend/models/ai-settings-repository');
const clientFactory = require('../backend/models/ai-provider-client');
const customToolsRepo = require('../backend/models/custom-tools-repository');
const { TRANSLATIONS_DIR } = require('../backend/models/custom-tool-i18n-service');

const CHINESE_RE = /[\u3400-\u9fff]/;
const BATCH_SIZE = 60;

function normalizeCandidate(value) {
    const text = String(value || '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\s+/g, ' ')
        .trim();
    if (!CHINESE_RE.test(text) || text.length < 2 || text.length > 220) return '';
    if (/^(?:data:|https?:|\/|#)/i.test(text)) return '';
    if (/[{}]{2,}|(?:function|const|let|var)\s+[A-Za-z_$]|=>|document\.|\.addEventListener\(/.test(text)) return '';
    if ((text.match(/[=;{}<>]/g) || []).length > 4) return '';
    return text;
}

function collectScriptStrings(script, output) {
    let ast;
    try {
        ast = acorn.parse(script, { ecmaVersion: 'latest', sourceType: 'script', allowAwaitOutsideFunction: true });
    } catch (_) {
        return;
    }
    const visit = node => {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'Literal' && typeof node.value === 'string') {
            const value = normalizeCandidate(node.value);
            if (value) output.add(value);
        } else if (node.type === 'TemplateElement') {
            const value = normalizeCandidate(node.value && (node.value.cooked || node.value.raw));
            if (value && !/[<>]/.test(value)) output.add(value);
        }
        Object.entries(node).forEach(([key, value]) => {
            if (key === 'start' || key === 'end' || key === 'loc') return;
            if (Array.isArray(value)) value.forEach(visit);
            else if (value && typeof value === 'object') visit(value);
        });
    };
    visit(ast);
}

function extractCandidates(html) {
    const output = new Set();
    const scripts = [];
    const withoutScripts = String(html).replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (_match, script) => {
        scripts.push(script);
        return '';
    });
    const visible = withoutScripts.replace(/<(?:style|noscript|svg)\b[^>]*>[\s\S]*?<\/(?:style|noscript|svg)>/gi, '');
    for (const match of visible.matchAll(/>([^<>]+)</g)) {
        const value = normalizeCandidate(match[1]);
        if (value) output.add(value);
    }
    for (const match of visible.matchAll(/\b(?:placeholder|title|aria-label|data-empty-text|value)\s*=\s*["']([^"']+)["']/gi)) {
        const value = normalizeCandidate(match[1]);
        if (value) output.add(value);
    }
    scripts.forEach(script => collectScriptStrings(script, output));
    return [...output].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function parseTranslationResponse(text) {
    const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    return Array.isArray(parsed.translations) ? parsed.translations.map(value => String(value || '').trim()) : [];
}

async function translateBatch(client, strings, attempt = 1) {
    try {
        const result = await client.generateText({
            systemInstruction: [
                'Translate Chinese user-interface text into concise, natural English for a professional software tool.',
                'Preserve placeholders such as {name}, ${value}, %s, numbers, acronyms, product names, emoji, punctuation meaning, and line intent.',
                'Do not explain. Return exactly one English translation per input item, in the same order.',
                'Return JSON only: {"translations":["..."]}.'
            ].join('\n'),
            prompt: JSON.stringify(strings),
            maxOutputTokens: 4096,
            temperature: 0,
            responseMimeType: 'application/json'
        });
        const translations = parseTranslationResponse(result.text);
        if (translations.length !== strings.length || translations.some(value => !value)) {
            throw new Error(`expected ${strings.length} translations, received ${translations.length}`);
        }
        return translations;
    } catch (error) {
        if (attempt >= 3) throw error;
        return translateBatch(client, strings, attempt + 1);
    }
}

async function generateToolTranslations(tool, options = {}) {
    const sourcePath = path.join(customToolsRepo.CUSTOM_TOOLS_DIR, tool.slug, 'index.html');
    if (!fs.existsSync(sourcePath)) return { slug: tool.slug, candidates: 0, generated: 0 };
    const settings = options.client ? null : await settingsRepo.getRuntimeSettings();
    if (!options.client && (!settings.hasApiKey || !settings.keyLooksValid)) throw new Error('AI configuration is unavailable');
    const client = options.client || clientFactory.createClient(settings);
    const candidates = extractCandidates(fs.readFileSync(sourcePath, 'utf8'));
    const targetPath = options.targetPath || path.join(customToolsRepo.CUSTOM_TOOLS_DIR, tool.slug, '.i18n.json');
    let dictionary = {};
    try { dictionary = JSON.parse(fs.readFileSync(targetPath, 'utf8')); } catch (_) {}
    const pending = candidates.filter(value => !dictionary[value]);
    for (let offset = 0; offset < pending.length; offset += BATCH_SIZE) {
        const batch = pending.slice(offset, offset + BATCH_SIZE);
        const translated = await translateBatch(client, batch);
        batch.forEach((source, index) => { dictionary[source] = translated[index]; });
        fs.writeFileSync(targetPath, `${JSON.stringify(dictionary, null, 2)}\n`, 'utf8');
    }
    if (!fs.existsSync(targetPath)) fs.writeFileSync(targetPath, '{}\n', 'utf8');
    return { slug: tool.slug, candidates: candidates.length, generated: pending.length };
}

async function main() {
    const settings = await settingsRepo.getRuntimeSettings();
    if (!settings.hasApiKey || !settings.keyLooksValid) throw new Error('AI configuration is unavailable');
    const client = clientFactory.createClient(settings);
    const tools = await customToolsRepo.listTools();
    fs.mkdirSync(TRANSLATIONS_DIR, { recursive: true });

    let nextToolIndex = 0;
    async function processNextTool() {
        const toolIndex = nextToolIndex++;
        if (toolIndex >= tools.length) return;
        const tool = tools[toolIndex];
        const sourcePath = path.join(customToolsRepo.CUSTOM_TOOLS_DIR, tool.slug, 'index.html');
        if (!fs.existsSync(sourcePath)) return processNextTool();
        const candidates = extractCandidates(fs.readFileSync(sourcePath, 'utf8'));
        const targetPath = path.join(TRANSLATIONS_DIR, `${tool.slug}.json`);
        let dictionary = {};
        try { dictionary = JSON.parse(fs.readFileSync(targetPath, 'utf8')); } catch (_) {}
        const pending = candidates.filter(value => !dictionary[value]);
        process.stdout.write(`[${toolIndex + 1}/${tools.length}] ${tool.slug}: ${candidates.length} strings, ${pending.length} pending\n`);
        for (let offset = 0; offset < pending.length; offset += BATCH_SIZE) {
            const batch = pending.slice(offset, offset + BATCH_SIZE);
            const translated = await translateBatch(client, batch);
            batch.forEach((source, index) => { dictionary[source] = translated[index]; });
            fs.writeFileSync(targetPath, `${JSON.stringify(dictionary, null, 2)}\n`, 'utf8');
            process.stdout.write(`  translated ${Math.min(offset + batch.length, pending.length)}/${pending.length}\n`);
        }
        if (!fs.existsSync(targetPath)) fs.writeFileSync(targetPath, '{}\n', 'utf8');
        return processNextTool();
    }
    await Promise.all(Array.from({ length: 3 }, () => processNextTool()));
}

if (require.main === module) {
    main().catch(error => {
        console.error(error.stack || error.message);
        process.exit(1);
    });
}

module.exports = { extractCandidates, generateToolTranslations };
