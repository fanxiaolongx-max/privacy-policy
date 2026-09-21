const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const page = read('frontend/pages/topic-analysis.html');
const css = read('frontend/css/topic-analysis.css');
const script = read('frontend/js/topic-analysis.js');
const msgExportScript = read('frontend/js/shared/report-msg-export.js');

test('topic-analysis.html includes source time toggle, sync capsule, gutter and fixed table IDs', () => {
    assert.match(page, /id="eosToggleSourceTimeBtn"/, 'Must have source time toggle button');
    assert.match(page, /id="eosToggleSourceTimeIcon"/, 'Must have source time toggle icon');
    assert.match(page, /id="eosToggleSourceTimeText"/, 'Must have source time toggle text');
    assert.match(page, /id="eosSyncCapsule"/, 'Must have sync capsule');
    assert.match(page, /id="eosReportGutter"/, 'Must have report gutter');
    assert.match(page, /id="fixedProductTable"/, 'Must have fixedProductTable ID');
    assert.match(page, /id="fixedVersionTable"/, 'Must have fixedVersionTable ID');
    assert.match(page, /id="fixedProductTableEn"/, 'Must have fixedProductTableEn ID');
    assert.match(page, /id="fixedVersionTableEn"/, 'Must have fixedVersionTableEn ID');
});

test('topic-analysis.css provides rules for source time hiding, editable cells, gutter badges and sync states', () => {
    assert.match(css, /\.topic-monthly-source\.is-hidden\s*\{\s*display:\s*none\s*!important;\s*\}/);
    assert.match(css, /\.topic-cell-editable/);
    assert.match(css, /\.topic-report-gutter/);
    assert.match(css, /\.topic-gutter-badge/);
    assert.match(css, /\.topic-sync-capsule/);
    assert.match(css, /\.topic-block-modified/);
    assert.match(css, /\.topic-en-needs-sync/);
    assert.match(css, /\.topic-en-synced/);
    assert.match(css, /\.topic-sync-chip/);
});

test('report-msg-export.js excludes gutter badges, sync chips, and html2canvas-ignore elements', () => {
    const sandbox = {
        window: {
            ReportMsgExport: {}
        },
        document: {
            createElement: tag => {
                const el = {
                    nodeType: 1,
                    tagName: tag.toUpperCase(),
                    style: {},
                    children: [],
                    childNodes: [],
                    setAttribute: () => {},
                    getAttribute: () => null,
                    removeAttribute: () => {},
                    appendChild: child => {
                        el.childNodes.push(child);
                        el.children.push(child);
                        child.parentElement = el;
                    }
                };
                return el;
            },
            createTextNode: text => ({
                nodeType: 3,
                textContent: text
            })
        },
        Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 }
    };
    vm.createContext(sandbox);
    vm.runInContext(msgExportScript, sandbox);
    const exportHelper = sandbox.window.ReportMsgExport;
    assert.ok(exportHelper, 'ReportMsgExport should be attached to window');

    // Create a mock DOM tree containing regular text, an editable block, a sync chip, and a gutter badge
    const createMockNode = (tag, opts = {}) => {
        const textChild = opts.text ? [{ nodeType: 3, textContent: opts.text }] : [];
        const node = {
            nodeType: opts.nodeType || 1,
            nodeName: tag.toUpperCase(),
            tagName: tag.toUpperCase(),
            textContent: opts.text || '',
            dataset: opts.dataset || {},
            className: opts.className || '',
            classList: {
                contains: cls => (opts.className || '').split(/\s+/).includes(cls)
            },
            hasAttribute: attr => {
                if (attr === 'data-html2canvas-ignore' && opts.ignore) return true;
                return false;
            },
            getAttribute: attr => {
                if (attr === 'data-html2canvas-ignore' && opts.ignore) return 'true';
                if (attr === 'class') return opts.className || null;
                return null;
            },
            childNodes: opts.children || textChild,
            style: opts.style || {}
        };
        (opts.children || textChild).forEach(child => { child.parentElement = node; });
        return node;
    };

    const normalP = createMockNode('p', { text: '这是正常月报内容' });
    const syncChip = createMockNode('div', {
        className: 'topic-sync-chip topic-sync-chip-warn print-hide',
        ignore: true,
        text: '⚠️ 对应中文已修改'
    });
    const gutterBadge = createMockNode('div', {
        className: 'topic-gutter-badge is-cn print-hide',
        ignore: true,
        text: '✏️ 中文已改'
    });
    const rootSheet = createMockNode('div', {
        className: 'topic-report-sheet',
        children: [normalP, syncChip, gutterBadge]
    });

    const emailRoot = exportHelper.copyForEmail(rootSheet);
    // emailRoot should contain normalP, but NOT syncChip or gutterBadge
    const renderedTags = [];
    const collectTags = n => {
        if (n.textContent) renderedTags.push(n.textContent);
        (n.childNodes || []).forEach(collectTags);
    };
    collectTags(emailRoot);
    const combinedText = renderedTags.join(' ');
    assert.ok(combinedText.includes('这是正常月报内容'), 'Email root must preserve main content');
    assert.ok(!combinedText.includes('对应中文已修改'), 'Email root must NOT include sync chip');
    assert.ok(!combinedText.includes('中文已改'), 'Email root must NOT include gutter badge');
});

test('topic-analysis.js supports rich text parsing for ExcelJS export', () => {
    const start = script.indexOf('    function excelReportColor(');
    const end = script.indexOf('    function appendMonthlyWorksheet(', start);
    assert.ok(start >= 0 && end > start, 'excelReportColor and reportExcelRichText must exist before appendMonthlyWorksheet');

    const fakeHtml = '前缀 <strong>加粗重点</strong> <span style="color:#dc2626">红色文字</span> 后缀';
    // Test that the parsing logic correctly identifies plain text, bold runs, and colored runs
    const sandbox = {
        Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 }
    };
    const fn = vm.runInNewContext(`(() => { ${script.slice(start, end)} return reportExcelRichText; })()`, sandbox);

    // Mock an element whose childNodes represent formatted text
    const textNode = t => ({ nodeType: 3, textContent: t });
    const elemNode = (tag, text, style = {}, children = null) => ({
        nodeType: 1,
        tagName: tag.toUpperCase(),
        textContent: text,
        style,
        children: children || [],
        childNodes: children || [textNode(text)]
    });

    const mockCell = {
        nodeType: 1,
        tagName: 'TD',
        childNodes: [
            textNode('前缀 '),
            elemNode('strong', '加粗重点'),
            textNode(' '),
            elemNode('span', '红色文字', { color: '#dc2626' }),
            textNode(' 后缀')
        ]
    };

    const res = fn(mockCell);
    assert.ok(res && res.richText, 'Result should have richText property');
    const richRuns = res.richText;
    assert.ok(Array.isArray(richRuns));
    assert.equal(richRuns.length, 5);
    assert.equal(richRuns[0].text, '前缀 ');
    assert.equal(richRuns[1].text, '加粗重点');
    assert.equal(richRuns[1].font.bold, true);
    assert.equal(richRuns[3].text, '红色文字');
    assert.ok(richRuns[3].font.color.argb.includes('DC2626'));
    assert.equal(richRuns[4].text, ' 后缀');
});

test('updateSourceTimeVisibility correctly toggles elements and classes', () => {
    const start = script.indexOf('    function updateSourceTimeVisibility(');
    const end = script.indexOf('    function setCopyStatus(', start);
    assert.ok(start >= 0 && end > start, 'updateSourceTimeVisibility must exist');

    const createEl = () => {
        const classes = new Set();
        return {
            classList: {
                add: c => classes.add(c),
                remove: c => classes.delete(c),
                contains: c => classes.has(c)
            },
            textContent: ''
        };
    };

    const elements = {
        eosMonthlySource: createEl(),
        eosToggleSourceTimeIcon: createEl(),
        eosToggleSourceTimeText: createEl(),
        eosToggleSourceTimeBtn: createEl()
    };

    const fn = vm.runInNewContext(`(() => { ${script.slice(start, end)} return updateSourceTimeVisibility; })()`, { elements });

    // Test hiding
    fn(true);
    assert.equal(elements.eosMonthlySource.classList.contains('is-hidden'), true);
    assert.equal(elements.eosToggleSourceTimeIcon.textContent, '👁️‍🗨️');
    assert.equal(elements.eosToggleSourceTimeText.textContent, '显示导入时间');
    assert.equal(elements.eosToggleSourceTimeBtn.classList.contains('is-active'), true);

    // Test showing
    fn(false);
    assert.equal(elements.eosMonthlySource.classList.contains('is-hidden'), false);
    assert.equal(elements.eosToggleSourceTimeIcon.textContent, '👁️');
    assert.equal(elements.eosToggleSourceTimeText.textContent, '隐藏导入时间');
    assert.equal(elements.eosToggleSourceTimeBtn.classList.contains('is-active'), false);
});

test('topic-analysis.html contains project file export/import controls and bilingual jump navigation', () => {
    assert.match(page, /id="eosExportProjectBtn"/, 'Must have project export button');
    assert.match(page, /id="eosImportProjectBtn"/, 'Must have project import button');
    assert.match(page, /id="eosProjectFileInput"/, 'Must have project file input');
    assert.match(page, /name="eos-section-cn"\s+id="eos-section-cn"/, 'Must have Chinese section anchor');
    assert.match(page, /name="eos-section-en"\s+id="eos-section-en"/, 'Must have English section anchor');
    assert.match(page, /id="eosReportNavCn"/, 'Must have Chinese navigation bar');
    assert.match(page, /id="eosReportNavEn"/, 'Must have English navigation bar');
    assert.match(page, /href="#eos-section-en"/, 'Chinese nav bar must link to English section');
    assert.match(page, /href="#eos-section-cn"/, 'English nav bar must link to Chinese section');
});

test('topic-analysis.css defines bilingual navigation bar, anchors, and imported project badge', () => {
    assert.match(css, /\.topic-section-anchor/);
    assert.match(css, /\.topic-report-nav-bar/);
    assert.match(css, /\.topic-report-nav-tag/);
    assert.match(css, /\.topic-report-nav-link/);
    assert.match(css, /\.topic-imported-badge/);
});

test('report-msg-export.js preserves in-email anchor links, name, and id attributes', () => {
    const sandbox = {
        window: { ReportMsgExport: {} },
        document: {
            createElement: tag => {
                const attrs = {};
                const el = {
                    nodeType: 1,
                    tagName: tag.toUpperCase(),
                    style: {},
                    children: [],
                    childNodes: [],
                    setAttribute: (k, v) => { attrs[k] = String(v); },
                    getAttribute: k => attrs[k] || null,
                    removeAttribute: k => { delete attrs[k]; },
                    appendChild: child => {
                        el.childNodes.push(child);
                        el.children.push(child);
                        child.parentElement = el;
                    }
                };
                return el;
            },
            createTextNode: text => ({ nodeType: 3, textContent: text })
        },
        Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 }
    };
    vm.createContext(sandbox);
    vm.runInContext(msgExportScript, sandbox);
    const exportHelper = sandbox.window.ReportMsgExport;

    const createNodeWithAttrs = (tag, attrs = {}, text = '') => {
        const textChild = text ? [{ nodeType: 3, textContent: text }] : [];
        const node = {
            nodeType: 1,
            tagName: tag.toUpperCase(),
            textContent: text,
            getAttribute: k => attrs[k] || null,
            hasAttribute: k => k in attrs,
            childNodes: textChild,
            style: {}
        };
        textChild.forEach(c => { c.parentElement = node; });
        return node;
    };

    const anchorTarget = createNodeWithAttrs('a', { name: 'eos-section-en', id: 'eos-section-en' });
    const anchorLink = createNodeWithAttrs('a', { href: '#eos-section-en' }, 'Jump to English');
    const container = {
        nodeType: 1,
        tagName: 'DIV',
        getAttribute: () => null,
        hasAttribute: () => false,
        childNodes: [anchorTarget, anchorLink],
        style: {}
    };

    const copied = exportHelper.copyForEmail(container);
    assert.ok(copied, 'Email container must be copied');
    assert.equal(copied.childNodes.length, 2);

    const copiedTarget = copied.childNodes[0];
    assert.equal(copiedTarget.getAttribute('name'), 'eos-section-en');
    assert.equal(copiedTarget.getAttribute('id'), 'eos-section-en');

    const copiedLink = copied.childNodes[1];
    assert.equal(copiedLink.getAttribute('href'), '#eos-section-en');
    assert.equal(copiedLink.childNodes[0].textContent, 'Jump to English');
});

test('topic-analysis.js project export/import workflow preserves complete offline data and badges', () => {
    assert.match(script, /function exportProjectFile\(/, 'Must define exportProjectFile');
    assert.match(script, /function importProjectFile\(/, 'Must define importProjectFile');
    assert.match(script, /fileType:\s*'topic-eos-monthly-project'/, 'Must define topic-eos-monthly-project fileType');
    assert.match(script, /topic-imported-badge/, 'Must format imported project badge');
    assert.match(script, /state\.isImportedProject\s*=\s*true/, 'Must flag isImportedProject on import');
    assert.match(script, /state\.isImportedProject\s*=\s*false/, 'Must reset isImportedProject on loadMonthlyReport');
});

test('ai.js exposes POST /api/ai/translate with bold/color style preservation rules', () => {
    const aiScript = read('backend/routes/ai.js');
    assert.match(aiScript, /router\.post\('\/translate'/, 'Must define POST /api/ai/translate route');
    assert.match(aiScript, /HTML INLINE FORMATTING TAGS MUST BE PRESERVED/, 'Prompt must instruct preserving inline HTML tags');
    assert.match(aiScript, /未配置 AI 助手 API Token/);
    assert.match(aiScript, /translatedText/);
});

test('topic-analysis.css includes styles for AI translate button, disabled state, and spinner', () => {
    assert.match(css, /\.topic-ai-translate-btn\b/);
    assert.match(css, /\.topic-ai-translate-btn\.is-disabled/);
    assert.match(css, /\.topic-ai-spinner/);
    assert.match(css, /\.topic-ai-translate-mini-btn/);
});

test('topic-analysis.js provides checkAiAssistantStatus, performAiTranslate, and disabled button fallback', () => {
    assert.match(script, /async function checkAiAssistantStatus\(/);
    assert.match(script, /async function performAiTranslate\(/);
    assert.match(script, /async function performAiTranslateAll\(/);
    assert.match(script, /isAiConnected/);
    assert.match(script, /topic-ai-translate-btn/);
    assert.match(script, /is-disabled/);
});

test('topic-analysis.css defines rules for hiding nav tags, divider badge, and diff popover', () => {
    assert.match(css, /\.topic-report-nav-tag\.is-hidden/);
    assert.match(css, /\.topic-report-divider-badge\.is-hidden/);
    assert.match(css, /\.topic-report-divider-en\.is-hidden/);
    assert.match(css, /\.topic-diff-popover/);
    assert.match(css, /\.topic-diff-popover\.is-visible/);
    assert.match(css, /\.topic-diff-section\.is-before/);
    assert.match(css, /\.topic-diff-section\.is-after/);
    assert.match(css, /\.topic-diff-copy-btn/);
    assert.match(css, /\.topic-diff-ai-btn/);
});

test('updateSourceTimeVisibility toggles is-hidden on nav tags and divider badges', () => {
    const start = script.indexOf('    function updateSourceTimeVisibility(');
    const end = script.indexOf('    function setCopyStatus(', start);
    assert.ok(start >= 0 && end > start);

    const createMockTag = () => {
        const classes = new Set();
        return {
            classList: {
                add: c => classes.add(c),
                remove: c => classes.delete(c),
                toggle: (c, force) => {
                    if (force === undefined) {
                        if (classes.has(c)) classes.delete(c); else classes.add(c);
                    } else if (force) {
                        classes.add(c);
                    } else {
                        classes.delete(c);
                    }
                },
                contains: c => classes.has(c)
            }
        };
    };

    const mockNavTags = [createMockTag(), createMockTag()];
    const mockDividerBadges = [createMockTag()];
    const mockDividerEns = [createMockTag()];

    const mockDoc = {
        getElementById: () => null,
        querySelectorAll: selector => {
            if (selector === '.topic-report-nav-tag') return mockNavTags;
            if (selector === '.topic-report-divider-badge') return mockDividerBadges;
            if (selector === '.topic-report-divider-en') return mockDividerEns;
            return [];
        }
    };

    const fn = vm.runInNewContext(`(() => { ${script.slice(start, end)} return updateSourceTimeVisibility; })()`, {
        document: mockDoc,
        elements: {}
    });

    // Hide: all elements must have is-hidden
    fn(true);
    assert.equal(mockNavTags[0].classList.contains('is-hidden'), true);
    assert.equal(mockNavTags[1].classList.contains('is-hidden'), true);
    assert.equal(mockDividerBadges[0].classList.contains('is-hidden'), true);
    assert.equal(mockDividerEns[0].classList.contains('is-hidden'), true);

    // Show: all elements must NOT have is-hidden
    fn(false);
    assert.equal(mockNavTags[0].classList.contains('is-hidden'), false);
    assert.equal(mockNavTags[1].classList.contains('is-hidden'), false);
    assert.equal(mockDividerBadges[0].classList.contains('is-hidden'), false);
    assert.equal(mockDividerEns[0].classList.contains('is-hidden'), false);
});

test('topic-analysis.js provides diff popover and synced Chinese baseline tracking', () => {
    assert.match(script, /function getOrCreateDiffPopover\(/);
    assert.match(script, /function showDiffPopover\(/);
    assert.match(script, /function hideDiffPopover\(/);
    assert.match(script, /function attachDiffPopoverListeners\(/);
    assert.match(script, /function saveSyncedCn\(/);
    assert.match(script, /function readSyncedCnPreferences\(/);
    assert.match(script, /syncedCnPreferences/);
    assert.match(script, /eosDiffCopyBtn/);
    assert.match(script, /eosDiffAiBtn/);
});

test('report-msg-export.js excludes topic-diff-popover', () => {
    assert.match(msgExportScript, /source\.classList\.contains\('topic-diff-popover'\)/);
});

test('topic-analysis.css defines styles for revert translation button and dark mode', () => {
    assert.match(css, /\.topic-diff-revert-btn\s*\{/);
    assert.match(css, /\.topic-diff-revert-btn:hover\s*\{/);
    assert.match(css, /\.topic-diff-revert-btn\.is-reverted\s*\{/);
    assert.match(css, /:root\[data-theme="dark"\]\s+\.topic-diff-revert-btn\s*\{/);
});

test('topic-analysis.js provides revert translation button, pre-translate snapshot storage, and baseline clearance', () => {
    assert.match(script, /function preTranslateStorageKey\(/);
    assert.match(script, /function readPreTranslatePreferences\(/);
    assert.match(script, /function savePreTranslate\(/);
    assert.match(script, /function clearPreTranslate\(/);
    assert.match(script, /function clearSyncedCn\(/);
    assert.match(script, /id="eosDiffRevertBtn"/);
    assert.match(script, /↩ 撤回翻译/);
    assert.match(script, /✓ 已撤回/);
    assert.match(script, /savePreTranslate\(enEl\.dataset\.eosCopyScope/);
    assert.match(script, /clearSyncedCn\(enScope,\s*enKey\)/);
});


