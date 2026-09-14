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
});

test('proactive KPI APIs are authenticated and the wording route remains read-only for users', () => {
    assert.match(routes, /router\.get\('\/proactive-alerts', checkAuth/);
    assert.match(routes, /router\.post\('\/proactive-alert-message', checkAuth/);
    assert.match(server, /req\.path === '\/ai\/proactive-alert-message'/);
});

test('navbar loads the current proactive assistant asset version everywhere', () => {
    const matches = navbar.match(/ai-assistant\.js\?v=20260914-03/g) || [];
    assert.equal(matches.length, 2);
    assert.doesNotMatch(navbar, /ai-assistant\.js\?v=20260914-02/);
});
