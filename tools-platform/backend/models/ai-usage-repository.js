const { run, get, all } = require('./app-db');
const { readKV, writeKV } = require('./kv-store');
const aiChatRepo = require('./ai-chat-repository');

const BACKFILL_KEY = 'ai_usage_daily_backfill_v1';
let readyPromise = null;

async function ensureReady() {
    if (!readyPromise) {
        readyPromise = (async () => {
            await aiChatRepo.ensureReady();
            await run(`
                CREATE TABLE IF NOT EXISTS ai_usage_daily (
                    usage_date TEXT PRIMARY KEY,
                    prompt_tokens INTEGER NOT NULL DEFAULT 0,
                    output_tokens INTEGER NOT NULL DEFAULT 0,
                    total_tokens INTEGER NOT NULL DEFAULT 0,
                    cost_usd REAL NOT NULL DEFAULT 0,
                    cost_cny REAL NOT NULL DEFAULT 0,
                    request_count INTEGER NOT NULL DEFAULT 0,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await run(`
                CREATE TABLE IF NOT EXISTS ai_usage_daily_models (
                    usage_date TEXT NOT NULL,
                    provider TEXT NOT NULL,
                    model TEXT NOT NULL,
                    profile_id TEXT NOT NULL DEFAULT '',
                    profile_name TEXT NOT NULL DEFAULT '',
                    prompt_tokens INTEGER NOT NULL DEFAULT 0,
                    output_tokens INTEGER NOT NULL DEFAULT 0,
                    total_tokens INTEGER NOT NULL DEFAULT 0,
                    cost_usd REAL NOT NULL DEFAULT 0,
                    cost_cny REAL NOT NULL DEFAULT 0,
                    request_count INTEGER NOT NULL DEFAULT 0,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (usage_date, provider, model, profile_id)
                )
            `);
            const backfilled = await readKV('sys', BACKFILL_KEY, false);
            const usageCount = await get('SELECT COUNT(*) AS count FROM ai_usage_daily');
            if (!backfilled && Number(usageCount?.count || 0) === 0) {
                await run(`
                    INSERT INTO ai_usage_daily
                    (usage_date, total_tokens, cost_usd, cost_cny, request_count)
                    SELECT substr(created_at, 1, 10),
                           COALESCE(SUM(tokens), 0),
                           COALESCE(SUM(cost), 0) / 72.0,
                           COALESCE(SUM(cost), 0) / 10.0,
                           COUNT(*)
                    FROM ai_chat_messages
                    WHERE role = 'model' AND substr(created_at, 1, 10) <> ''
                    GROUP BY substr(created_at, 1, 10)
                `);
            }
            if (!backfilled) await writeKV('sys', BACKFILL_KEY, true);
        })().catch(err => {
            readyPromise = null;
            throw err;
        });
    }
    return readyPromise;
}

function safeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
}

async function recordUsage({ promptTokens, outputTokens, totalTokens, costUsd, costCny, occurredAt, provider, model, profileId, profileName } = {}) {
    await ensureReady();
    const date = occurredAt ? new Date(occurredAt) : new Date();
    const usageDate = Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
    const prompt = Math.round(safeNumber(promptTokens));
    const output = Math.round(safeNumber(outputTokens));
    const total = Math.round(safeNumber(totalTokens)) || prompt + output;
    await run(`
        INSERT INTO ai_usage_daily
        (usage_date, prompt_tokens, output_tokens, total_tokens, cost_usd, cost_cny, request_count, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(usage_date) DO UPDATE SET
            prompt_tokens = prompt_tokens + excluded.prompt_tokens,
            output_tokens = output_tokens + excluded.output_tokens,
            total_tokens = total_tokens + excluded.total_tokens,
            cost_usd = cost_usd + excluded.cost_usd,
            cost_cny = cost_cny + excluded.cost_cny,
            request_count = request_count + 1,
            updated_at = CURRENT_TIMESTAMP
    `, [usageDate, prompt, output, total, safeNumber(costUsd), safeNumber(costCny)]);
    const safeProvider = String(provider || 'unknown').trim().slice(0, 50) || 'unknown';
    const safeModel = String(model || 'unknown').trim().slice(0, 160) || 'unknown';
    const safeProfileId = String(profileId || '').trim().slice(0, 100);
    const safeProfileName = String(profileName || '').trim().slice(0, 60);
    await run(`
        INSERT INTO ai_usage_daily_models
        (usage_date, provider, model, profile_id, profile_name, prompt_tokens, output_tokens, total_tokens, cost_usd, cost_cny, request_count, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(usage_date, provider, model, profile_id) DO UPDATE SET
            profile_name = CASE WHEN excluded.profile_name <> '' THEN excluded.profile_name ELSE profile_name END,
            prompt_tokens = prompt_tokens + excluded.prompt_tokens,
            output_tokens = output_tokens + excluded.output_tokens,
            total_tokens = total_tokens + excluded.total_tokens,
            cost_usd = cost_usd + excluded.cost_usd,
            cost_cny = cost_cny + excluded.cost_cny,
            request_count = request_count + 1,
            updated_at = CURRENT_TIMESTAMP
    `, [usageDate, safeProvider, safeModel, safeProfileId, safeProfileName, prompt, output, total, safeNumber(costUsd), safeNumber(costCny)]);
}

function isoDate(date) {
    return date.toISOString().slice(0, 10);
}

function startOfUtcWeek(date) {
    const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const weekday = result.getUTCDay() || 7;
    result.setUTCDate(result.getUTCDate() - weekday + 1);
    return result;
}

function bucketKey(date, dimension) {
    if (dimension === 'year') return String(date.getUTCFullYear());
    if (dimension === 'month') return isoDate(date).slice(0, 7);
    if (dimension === 'week') return isoDate(startOfUtcWeek(date));
    return isoDate(date);
}

function buildBuckets(dimension) {
    const today = new Date();
    const current = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const buckets = [];
    if (dimension === 'year') {
        for (let offset = 4; offset >= 0; offset -= 1) {
            const date = new Date(Date.UTC(current.getUTCFullYear() - offset, 0, 1));
            buckets.push({ key: bucketKey(date, dimension), label: String(date.getUTCFullYear()) });
        }
    } else if (dimension === 'month') {
        for (let offset = 11; offset >= 0; offset -= 1) {
            const date = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - offset, 1));
            buckets.push({ key: bucketKey(date, dimension), label: isoDate(date).slice(0, 7) });
        }
    } else if (dimension === 'week') {
        const week = startOfUtcWeek(current);
        for (let offset = 11; offset >= 0; offset -= 1) {
            const date = new Date(week);
            date.setUTCDate(date.getUTCDate() - offset * 7);
            buckets.push({ key: bucketKey(date, dimension), label: `${isoDate(date).slice(5)} 周` });
        }
    } else {
        for (let offset = 29; offset >= 0; offset -= 1) {
            const date = new Date(current);
            date.setUTCDate(date.getUTCDate() - offset);
            buckets.push({ key: bucketKey(date, 'day'), label: isoDate(date).slice(5) });
        }
    }
    return buckets.map(item => ({ ...item, inputTokens: 0, outputTokens: 0, tokens: 0, costUsd: 0, costCny: 0, requests: 0 }));
}

async function getUsageStats({ dimension = 'day' } = {}) {
    await ensureReady();
    const safeDimension = ['day', 'week', 'month', 'year'].includes(dimension) ? dimension : 'day';
    const rows = await all('SELECT * FROM ai_usage_daily ORDER BY usage_date ASC');
    const modelRows = await all('SELECT * FROM ai_usage_daily_models ORDER BY usage_date ASC, provider, model');
    const buckets = buildBuckets(safeDimension);
    const byKey = new Map(buckets.map(item => [item.key, item]));
    rows.forEach(row => {
        const date = new Date(`${row.usage_date}T00:00:00Z`);
        if (Number.isNaN(date.getTime())) return;
        const target = byKey.get(bucketKey(date, safeDimension));
        if (!target) return;
        target.inputTokens += Number(row.prompt_tokens || 0);
        target.outputTokens += Number(row.output_tokens || 0);
        target.tokens += Number(row.total_tokens || 0);
        target.costUsd += Number(row.cost_usd || 0);
        target.costCny += Number(row.cost_cny || 0);
        target.requests += Number(row.request_count || 0);
    });
    const totals = rows.reduce((sum, row) => ({
        inputTokens: sum.inputTokens + Number(row.prompt_tokens || 0),
        outputTokens: sum.outputTokens + Number(row.output_tokens || 0),
        tokens: sum.tokens + Number(row.total_tokens || 0),
        costUsd: sum.costUsd + Number(row.cost_usd || 0),
        costCny: sum.costCny + Number(row.cost_cny || 0),
        requests: sum.requests + Number(row.request_count || 0)
    }), { inputTokens: 0, outputTokens: 0, tokens: 0, costUsd: 0, costCny: 0, requests: 0 });
    const modelGroups = new Map();
    modelRows.forEach(row => {
        const key = Buffer.from(`${row.provider}\u0000${row.model}\u0000${row.profile_id || ''}`).toString('base64url');
        if (!modelGroups.has(key)) {
            modelGroups.set(key, {
                key,
                provider: row.provider,
                model: row.model,
                profileId: row.profile_id || '',
                profileName: row.profile_name || '',
                totals: { inputTokens: 0, outputTokens: 0, tokens: 0, costUsd: 0, costCny: 0, requests: 0 },
                series: buildBuckets(safeDimension)
            });
        }
        const group = modelGroups.get(key);
        const values = {
            inputTokens: Number(row.prompt_tokens || 0), outputTokens: Number(row.output_tokens || 0), tokens: Number(row.total_tokens || 0),
            costUsd: Number(row.cost_usd || 0), costCny: Number(row.cost_cny || 0), requests: Number(row.request_count || 0)
        };
        Object.keys(values).forEach(field => { group.totals[field] += values[field]; });
        const date = new Date(`${row.usage_date}T00:00:00Z`);
        const target = Number.isNaN(date.getTime()) ? null : group.series.find(item => item.key === bucketKey(date, safeDimension));
        if (target) Object.keys(values).forEach(field => { target[field] += values[field]; });
    });
    const models = [...modelGroups.values()].map(group => ({
        ...group,
        totals: { ...group.totals, costUsd: Number(group.totals.costUsd.toFixed(6)), costCny: Number(group.totals.costCny.toFixed(4)) },
        series: group.series.map(item => ({ ...item, costUsd: Number(item.costUsd.toFixed(6)), costCny: Number(item.costCny.toFixed(4)) }))
    })).sort((a, b) => b.totals.tokens - a.totals.tokens);
    const classified = models.reduce((sum, item) => ({ tokens: sum.tokens + item.totals.tokens, costUsd: sum.costUsd + item.totals.costUsd, costCny: sum.costCny + item.totals.costCny, requests: sum.requests + item.totals.requests }), { tokens: 0, costUsd: 0, costCny: 0, requests: 0 });
    return {
        dimension: safeDimension,
        totals: { ...totals, costUsd: Number(totals.costUsd.toFixed(6)), costCny: Number(totals.costCny.toFixed(4)) },
        series: buckets.map(item => ({ ...item, costUsd: Number(item.costUsd.toFixed(6)), costCny: Number(item.costCny.toFixed(4)) })),
        models,
        unclassified: {
            tokens: Math.max(0, totals.tokens - classified.tokens),
            costUsd: Number(Math.max(0, totals.costUsd - classified.costUsd).toFixed(6)),
            costCny: Number(Math.max(0, totals.costCny - classified.costCny).toFixed(4)),
            requests: Math.max(0, totals.requests - classified.requests)
        }
    };
}

module.exports = { ensureReady, recordUsage, getUsageStats };
