const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const assistant = fs.readFileSync(path.join(root, 'frontend/js/shared/ai-assistant.js'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'backend/routes/ai.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'backend/server.js'), 'utf8');
const navbar = fs.readFileSync(path.join(root, 'frontend/js/shared/navbar.js'), 'utf8');

test('global assistant schedules, displays, and opens proactive KPI alerts', () => {
    assert.match(assistant, /PROACTIVE_MIN_DELAY_MS = 5 \* 60 \* 1000/);
    assert.match(assistant, /PROACTIVE_MAX_DELAY_MS = 60 \* 60 \* 1000/);
    assert.match(assistant, /\/api\/ai\/proactive-alerts\?limit=200/);
    assert.match(assistant, /\/api\/ai\/proactive-alert-message/);
    assert.match(assistant, /openAssistant\(\{ prompt, displayText \}\)/);
    assert.match(assistant, /fab\.addEventListener\('pointerenter'/);
    assert.match(assistant, /localStorage\.setItem\(proactiveSeenStorageKey\(\)/);
    assert.match(assistant, /date: localDateKey\(\)/);
    assert.match(assistant, /z-index: 100020/);
    assert.match(assistant, /data-placement="below"/);
    assert.match(assistant, /availableAbove >= availableBelow/);
    assert.match(assistant, /PROACTIVE_ENTRY_PATHS = new Set\(\['\/', '\/uivf12', '\/sla', '\/report', '\/expedite', '\/monthly'\]\)/);
    assert.match(assistant, /window\.setTimeout\(\(\) => loadProactiveAlert\(\), 700\)/);
    assert.match(assistant, /classList\.add\('ai-polished'\)/);
    assert.match(assistant, />✦ AI<\/span>/);
    assert.match(assistant, /@keyframes ai-alert-arrive/);
    assert.match(assistant, /@keyframes ai-alert-depart/);
    assert.match(assistant, /@keyframes ai-alert-close-away/);
    assert.match(assistant, /hideProactiveAlert\(\{ reason:'close' \}\)/);
    assert.match(assistant, /prefers-reduced-motion: reduce/);
    assert.match(assistant, /proactiveItemKey\(item\)/);
    assert.match(assistant, /alertTaskKicker: '近 7 天临期任务'/);
    assert.match(assistant, /ai-proactive-alert-ai-panel/);
    assert.match(assistant, /revealProactiveAiText\(message\)/);
    assert.match(assistant, /@keyframes ai-polish-flow/);
    assert.match(assistant, /@keyframes ai-polish-char/);
    assert.match(assistant, /proactiveAlert\.addEventListener\('pointerenter'/);
    assert.match(assistant, /proactiveAlert\.addEventListener\('pointerleave'/);
    assert.match(assistant, /PROACTIVE_HOVER_LEAVE_GRACE_MS = 6 \* 1000/);
    assert.match(assistant, /ai-proactive-alert-snooze/);
    assert.match(assistant, /snoozeProactiveAlertsToday\(\)/);
    assert.match(assistant, /isProactiveSnoozedToday\(\)/);
    assert.match(assistant, /navigator\.clipboard\.writeText\(copyText\)/);
});

test('assistant bubble and dialogs follow the current page theme first', () => {
    assert.match(assistant, /function detectPageAssistantTheme\(\)/);
    assert.match(assistant, /detectPageAssistantTheme\(\) \|\| getFallbackAssistantTheme\(\)/);
    assert.match(assistant, /new MutationObserver\(\(\) => applyContextTheme\(\)\)/);
    assert.match(assistant, /proactiveAlert\.dataset\.theme = assistantTheme/);
    assert.match(assistant, /archiveOverlay\.dataset\.theme = assistantTheme/);
});

test('proactive KPI APIs are authenticated and the wording route remains read-only for users', () => {
    assert.match(routes, /router\.get\('\/proactive-alerts', checkAuth/);
    assert.match(routes, /router\.post\('\/proactive-alert-message', checkAuth/);
    assert.match(server, /req\.path === '\/ai\/proactive-alert-message'/);
    assert.match(routes, /item\?\.kind === 'task'/);
    assert.match(routes, /不得补充或索要单号/);
    assert.match(routes, /enrichProactiveAlertWithDeepContext/);
    assert.match(routes, /generateRuleBasedDeepAnalysis/);
    assert.match(assistant, /alertAi: 'AI 深度分析'/);
    assert.match(assistant, /alertAiCaption: '深度分析结果'/);
});

test('navbar loads the current proactive assistant asset version everywhere', () => {
    const matches = navbar.match(/ai-assistant\.js\?v=20260920-04/g) || [];
    assert.equal(matches.length, 2);
    assert.doesNotMatch(navbar, /ai-assistant\.js\?v=20260914-10/);
});
