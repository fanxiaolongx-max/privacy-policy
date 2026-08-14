#!/usr/bin/env node

/**
 * Export the current UIV script repository and complete SLA configuration as
 * the optional first-run quick-start bundle shipped with every distribution.
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const outputPath = path.join(projectRoot, 'backend/defaults/quick-start-bundle.json');
const scriptsRepo = require('../backend/models/uiv-scripts-repository');
const uivCategoriesRepo = require('../backend/models/uiv-categories-repository');
const targetsRepo = require('../backend/models/sla-targets-repository');
const prefsRepo = require('../backend/models/sla-prefs-repository');
const groupsRepo = require('../backend/models/sla-groups-repository');
const slaCategoriesRepo = require('../backend/models/sla-categories-repository');
const { closeDatabase } = require('../backend/models/app-db');

function assertNoLiteralCredentials(scripts) {
    const suspicious = [];
    const patterns = [
        /authorization\s*["']?\s*:\s*["']bearer\s+[a-z0-9._~+\/-]{16,}/ig,
        /(?:password|api[_-]?key|access[_-]?token)\s*["']?\s*:\s*["'][^"'\n]{8,}["']/ig,
        /cookie\s*["']?\s*:\s*["'][^"'\n]{20,}["']/ig
    ];
    for (const script of scripts) {
        const text = JSON.stringify(script);
        if (patterns.some(pattern => {
            pattern.lastIndex = 0;
            return pattern.test(text);
        })) suspicious.push(script.name || script.id || '未命名脚本');
    }
    if (suspicious.length) {
        throw new Error(`默认脚本包中疑似存在固定凭证，已停止导出：${suspicious.join('、')}`);
    }
}

async function main() {
    const [scriptResult, uivCategoryResult, targetResult, prefResult, groupResult, slaCategoryResult] = await Promise.all([
        scriptsRepo.listScripts(),
        uivCategoriesRepo.listCategories(),
        targetsRepo.getTargets(),
        prefsRepo.getPrefsObject(),
        groupsRepo.listGroups(),
        slaCategoriesRepo.listCategories()
    ]);

    assertNoLiteralCredentials(scriptResult.items);

    const bundle = {
        schemaVersion: 1,
        bundleVersion: require('../package.json').version,
        generatedAt: new Date().toISOString(),
        description: '首次启动可选快速上手包：当前智能调度脚本仓库与全量 SLA 指标规则。',
        mergePolicy: 'preserve-existing',
        uiv: {
            categories: uivCategoryResult.items,
            scripts: scriptResult.items
        },
        sla: {
            categories: slaCategoryResult.items,
            targets: targetResult.items,
            prefs: prefResult.items,
            groups: groupResult.items
        },
        summary: {
            scriptCount: scriptResult.items.length,
            scriptCategoryCount: uivCategoryResult.items.length,
            targetCount: Object.keys(targetResult.items).length,
            preferenceCount: Object.keys(prefResult.items).length,
            metricGroupCount: groupResult.items.length,
            metricCategoryCount: slaCategoryResult.items.length,
            dictionaryCount: Object.keys(prefResult.items.i18nMap || {}).length
        }
    };

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
    console.log(`Default quick-start bundle exported: ${outputPath}`);
    console.log(JSON.stringify(bundle.summary, null, 2));
}

main()
    .then(() => closeDatabase())
    .catch(async error => {
        console.error(error.stack || error.message || error);
        await closeDatabase().catch(() => {});
        process.exit(1);
    });
