const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('uivf12 i18n dictionaries contain comprehensive keys for site picker, AI adapter, and script analysis', () => {
    const i18nPath = path.resolve(__dirname, '../frontend/js/uivf12/i18n.js');
    const content = fs.readFileSync(i18nPath, 'utf8');

    // Extract dictionaries from i18n.js
    const dictMatch = content.match(/const dictionaries = (\{[\s\S]*?\n    \});/);
    assert.ok(dictMatch, 'dictionaries object should exist in uivf12/i18n.js');

    const fn = new Function(`return ${dictMatch[1]};`);
    const dicts = fn();

    assert.ok(dicts['zh-CN'], 'zh-CN should exist');
    assert.ok(dicts['en-US'], 'en-US should exist');

    const requiredSiteKeys = [
        'uiv.siteScript.title',
        'uiv.siteScript.subtitle',
        'uiv.siteScript.notice',
        'uiv.siteScript.unresolved',
        'uiv.siteScript.empty',
        'uiv.siteScript.scriptCount',
        'uiv.siteScript.simulate',
        'uiv.siteScript.copy',
        'uiv.siteScript.close',
        'uiv.siteScript.noSite',
        'uiv.siteScript.copied',
        'uiv.siteScript.depText',
        'uiv.siteScript.copyFail',
        'uiv.siteScript.readFail'
    ];

    const requiredAiAdapterKeys = [
        'uiv.aiAdapter.title',
        'uiv.aiAdapter.subtitle',
        'uiv.aiAdapter.close',
        'uiv.aiAdapter.step1',
        'uiv.aiAdapter.parseBtn',
        'uiv.aiAdapter.parseSummary',
        'uiv.aiAdapter.step2',
        'uiv.aiAdapter.keywordLabel',
        'uiv.aiAdapter.keywordPh',
        'uiv.aiAdapter.keywordSummary',
        'uiv.aiAdapter.advanced',
        'uiv.aiAdapter.reqUrl',
        'uiv.aiAdapter.openUrl',
        'uiv.aiAdapter.method',
        'uiv.aiAdapter.bodyType',
        'uiv.aiAdapter.pagination',
        'uiv.aiAdapter.credentials',
        'uiv.aiAdapter.outputFileName',
        'uiv.aiAdapter.authStrategy',
        'uiv.aiAdapter.guardrail',
        'uiv.aiAdapter.waitingStart',
        'uiv.aiAdapter.stepValidate',
        'uiv.aiAdapter.stepSample',
        'uiv.aiAdapter.stepModel',
        'uiv.aiAdapter.stepVerify',
        'uiv.aiAdapter.previewDefault',
        'uiv.aiAdapter.cancel',
        'uiv.aiAdapter.analyzeBtn',
        'uiv.aiAdapter.generateBtn',
        'uiv.aiAdapter.choiceTitle',
        'uiv.aiAdapter.choiceSubtitle',
        'uiv.aiAdapter.pulseSample',
        'uiv.aiAdapter.pulseModel',
        'uiv.aiAdapter.pulseWait',
        'uiv.aiAdapter.fetchSourceEmpty',
        'uiv.aiAdapter.fetchParsed',
        'uiv.aiAdapter.toastNativeSuccess',
        'uiv.aiAdapter.toastGenericSuccess'
    ];

    const requiredAnalysisKeys = [
        'uiv.analysis.title',
        'uiv.analysis.reading',
        'uiv.analysis.summary',
        'uiv.analysis.searchPh',
        'uiv.analysis.allCategories',
        'uiv.analysis.saveChanges',
        'uiv.analysis.refresh',
        'uiv.analysis.thCategory',
        'uiv.analysis.thName',
        'uiv.analysis.thOutput',
        'uiv.analysis.thUrl',
        'uiv.analysis.thUpdated',
        'uiv.analysis.thPlatform',
        'uiv.analysis.thRequest',
        'uiv.analysis.thCore',
        'uiv.analysis.thFilters',
        'uiv.analysis.thOptions',
        'uiv.analysis.thResponse',
        'uiv.analysis.thRefill',
        'uiv.analysis.thActions',
        'uiv.analysis.empty',
        'uiv.analysis.noMatches',
        'uiv.analysis.footer',
        'uiv.analysis.copyModified',
        'uiv.analysis.saveAsNew',
        'uiv.analysis.deleteScript',
        'uiv.analysis.modifiedTag',
        'uiv.analysis.payloadOk',
        'uiv.analysis.payloadLegacy',
        'uiv.analysis.configOk',
        'uiv.analysis.configCode',
        'uiv.analysis.saveChangesCount',
        'uiv.analysis.deleteTitle',
        'uiv.analysis.saveAsTitle',
        'uiv.analysis.unsavedTitle',
        'uiv.analysis.refreshTitle'
    ];

    ['zh-CN', 'en-US'].forEach(lang => {
        requiredSiteKeys.forEach(k => {
            assert.ok(dicts[lang][k], `Missing site script key: ${k} in ${lang}`);
        });
        requiredAiAdapterKeys.forEach(k => {
            assert.ok(dicts[lang][k], `Missing AI adapter key: ${k} in ${lang}`);
        });
        requiredAnalysisKeys.forEach(k => {
            assert.ok(dicts[lang][k], `Missing script analysis key: ${k} in ${lang}`);
        });
    });
});

test('sla i18n dictionaries contain comprehensive keys for metric rule configuration modal', () => {
    const i18nPath = path.resolve(__dirname, '../frontend/js/sla/i18n.js');
    const content = fs.readFileSync(i18nPath, 'utf8');

    const dictMatch = content.match(/const dictionaries = (\{[\s\S]*?\n    \});/);
    assert.ok(dictMatch, 'dictionaries object should exist in sla/i18n.js');

    const fn = new Function(`return ${dictMatch[1]};`);
    const dicts = fn();

    const requiredSlaKeys = [
        'sla.section.metricHint',
        'sla.section.extractOne',
        'sla.section.extractMulti',
        'sla.section.countTimes',
        'sla.section.countRatio',
        'sla.section.dataScope',
        'sla.section.scopeCurrent',
        'sla.section.scopeAll',
        'sla.section.colXOption',
        'sla.section.valYPh',
        'sla.section.colZOption',
        'sla.section.aggregateSum',
        'sla.section.aggregateAvg',
        'sla.section.aggregateMax',
        'sla.section.aggregateMin',
        'sla.section.aggregateCount',
        'sla.section.advancedFilter',
        'sla.section.advancedHelp',
        'sla.section.addCondition',
        'sla.section.conditionRelation',
        'sla.section.conditionAnd',
        'sla.section.conditionOr',
        'sla.section.metricNamePh',
        'sla.section.color',
        'sla.section.green',
        'sla.section.red',
        'sla.section.yellow',
        'sla.section.mainMetric',
        'sla.section.chooseCategory',
        'sla.section.saveRule',
        'sla.section.noRules',
        'sla.section.ruleEdit',
        'sla.section.ruleDelete',
        'sla.section.crossBadge',
        'sla.section.crossNote',
        'sla.section.crossSource',
        'sla.section.inboundHeader',
        'sla.section.uncategorized',
        'sla.section.subMetricOf'
    ];

    ['zh-CN', 'en-US'].forEach(lang => {
        requiredSlaKeys.forEach(k => {
            assert.ok(dicts[lang][k], `Missing SLA metric key: ${k} in ${lang}`);
        });
    });
});

test('uivf12.html markup binds data-uiv-i18n attributes on AI adapter and script analysis modals', () => {
    const htmlPath = path.resolve(__dirname, '../frontend/pages/uivf12.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    assert.ok(html.includes('id="uivAiAdapterOverlay"'), 'uivAiAdapterOverlay should exist');
    assert.ok(html.includes('data-uiv-i18n="uiv.aiAdapter.title"'), 'AI adapter title should have i18n binding');
    assert.ok(html.includes('data-uiv-i18n="uiv.aiAdapter.step1"'), 'AI adapter step1 should have i18n binding');
    assert.ok(html.includes('data-uiv-i18n="uiv.aiAdapter.reqUrl"'), 'AI adapter reqUrl should have i18n binding');
    assert.ok(html.includes('data-uiv-i18n="uiv.aiAdapter.guardrail"'), 'AI adapter guardrail should have i18n binding');
    assert.ok(html.includes('id="scriptAnalysisModal"'), 'scriptAnalysisModal should exist');
    assert.ok(html.includes('id="scriptAnalysisTitle"'), 'scriptAnalysisTitle should exist');
});
