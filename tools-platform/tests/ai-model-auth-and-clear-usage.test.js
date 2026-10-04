const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const settingsRepo = require('../backend/models/ai-settings-repository');
const aiUsageRepo = require('../backend/models/ai-usage-repository');
const { createClient } = require('../backend/models/ai-provider-client');

test('settings repository defaults to ANTHROPIC_AUTH_TOKEN and supports ANTHROPIC_API_KEY', async () => {
    assert.equal(settingsRepo.DEFAULT_SETTINGS.anthropicAuthType, 'ANTHROPIC_AUTH_TOKEN');

    const runtimeDefault = await settingsRepo.buildRuntimeSettings({
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-latest',
        apiKey: 'test-ant-key-123456'
    });
    assert.equal(runtimeDefault.anthropicAuthType, 'ANTHROPIC_AUTH_TOKEN');

    const runtimeCustom = await settingsRepo.buildRuntimeSettings({
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-latest',
        anthropicAuthType: 'ANTHROPIC_API_KEY',
        apiKey: 'test-ant-key-123456'
    });
    assert.equal(runtimeCustom.anthropicAuthType, 'ANTHROPIC_API_KEY');
});

test('ai-provider-client sends correct headers based on anthropicAuthType', () => {
    // 1. Default (ANTHROPIC_AUTH_TOKEN) -> Authorization: Bearer <token>
    const clientDefault = createClient({
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-latest',
        apiKey: 'sk-ant-test-auth-token-123456'
    });
    assert.equal(clientDefault.anthropicAuthType, 'ANTHROPIC_AUTH_TOKEN');
    const headersDefault = clientDefault.getAnthropicHeaders(false);
    assert.equal(headersDefault['Authorization'], 'Bearer sk-ant-test-auth-token-123456');
    assert.equal(headersDefault['x-api-key'], undefined);

    // 2. Explicit ANTHROPIC_API_KEY -> x-api-key: <key>
    const clientApiKey = createClient({
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-latest',
        anthropicAuthType: 'ANTHROPIC_API_KEY',
        apiKey: 'sk-ant-api03-test-key-123456'
    });
    assert.equal(clientApiKey.anthropicAuthType, 'ANTHROPIC_API_KEY');
    const headersApiKey = clientApiKey.getAnthropicHeaders(true);
    assert.equal(headersApiKey['x-api-key'], 'sk-ant-api03-test-key-123456');
    assert.equal(headersApiKey['Authorization'], undefined);
    assert.equal(headersApiKey['Accept'], 'text/event-stream');
});

test('ai-usage-repository supports clearing usage stats for a specific model', async () => {
    const testDate = '2099-01-01';
    // Record usage for Model A
    await aiUsageRepo.recordUsage({
        promptTokens: 100,
        outputTokens: 200,
        totalTokens: 300,
        costUsd: 0.05,
        costCny: 0.36,
        occurredAt: testDate,
        provider: 'anthropic',
        model: 'test-clear-model-a',
        profileId: 'prof_test_a',
        profileName: 'Claude Test A'
    });

    // Record usage for Model B
    await aiUsageRepo.recordUsage({
        promptTokens: 50,
        outputTokens: 50,
        totalTokens: 100,
        costUsd: 0.02,
        costCny: 0.14,
        occurredAt: testDate,
        provider: 'gemini',
        model: 'test-keep-model-b',
        profileId: 'prof_test_b',
        profileName: 'Gemini Test B'
    });

    // Verify Model A exists in stats
    let stats = await aiUsageRepo.getUsageStats({ dimension: 'day' });
    let modelA = stats.models.find(m => m.model === 'test-clear-model-a');
    let modelB = stats.models.find(m => m.model === 'test-keep-model-b');
    assert.ok(modelA, 'Model A should be present in stats');
    assert.ok(modelB, 'Model B should be present in stats');
    assert.ok(modelA.totals.tokens >= 300);

    // Clear usage for Model A using its key
    const clearResult = await aiUsageRepo.clearUsageStats({ key: modelA.key });
    assert.equal(clearResult.model, 'test-clear-model-a');
    assert.ok(clearResult.clearedTokens >= 300);

    // Re-check stats: Model A should be removed, Model B should remain
    stats = await aiUsageRepo.getUsageStats({ dimension: 'day' });
    modelA = stats.models.find(m => m.model === 'test-clear-model-a');
    modelB = stats.models.find(m => m.model === 'test-keep-model-b');
    assert.equal(modelA, undefined, 'Model A should have been removed from models ledger');
    assert.ok(modelB, 'Model B should still remain in stats');

    // Clean up Model B
    await aiUsageRepo.clearUsageStats({ key: modelB.key });
});
