const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../frontend/js/shared/navbar.js'), 'utf8');
const start = source.indexOf('const NAV_LOCAL_ONLY_TOOLS');
const end = source.indexOf('function isRecentlyChangedTool', start);
const renderBadges = vm.runInNewContext(`(() => {
    const navEscape = value => String(value);
    const navLocaleText = zh => zh;
    ${source.slice(start, end)}
    return renderNavToolBadges;
})()`);

test('browser-only custom tools show both distinct badges', () => {
    const html = renderBadges({ id: 'custom:tool-msqfplq0', builtIn: false });
    assert.match(html, /tool-kind-badge--local[^>]*>纯 HTML<\/span>/);
    assert.match(html, /tool-kind-badge--custom[^>]*>自定义<\/span>/);
    assert.match(html, /nav-tool-badges--stacked/);
});

test('server-backed custom tools and browser-only bundled tools keep their own badges', () => {
    const custom = renderBadges({ id: 'custom:tool-mttuw8kn', builtIn: false });
    assert.match(custom, /自定义/);
    assert.doesNotMatch(custom, /纯 HTML/);

    const bundled = renderBadges({ id: 'custom:particle-effects', builtIn: true });
    assert.match(bundled, /纯 HTML/);
    assert.doesNotMatch(bundled, /自定义/);
});

test('recently used shortcuts show only the tool name', () => {
    const start = source.indexOf('function renderNavRecentSection');
    const end = source.indexOf('function refreshNavMoreRecent', start);
    const renderRecent = vm.runInNewContext(`(() => {
        const window = { location: { pathname: '/' } };
        const navEscape = value => String(value);
        const navT = key => key;
        const getNavLabel = item => item.label;
        const buildNavSearchIndex = item => item.label;
        ${source.slice(start, end)}
        return renderNavRecentSection;
    })()`);
    const html = renderRecent([{ id: 'custom:tool-msqfplq0', label: '文档编辑', href: '/tools/tool-msqfplq0', icon: '🧩', builtIn: false, match: () => false }]);
    assert.match(html, /文档编辑/);
    assert.doesNotMatch(html, /tool-kind-badge|NEW!/);
});
