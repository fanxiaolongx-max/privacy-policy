const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR, ensureDataDir } = require('./store');
const scriptsRepo = require('./uiv-scripts-repository');
const uivCategoriesRepo = require('./uiv-categories-repository');
const targetsRepo = require('./sla-targets-repository');
const prefsRepo = require('./sla-prefs-repository');
const groupsRepo = require('./sla-groups-repository');
const slaCategoriesRepo = require('./sla-categories-repository');

const DEFAULT_REPOSITORIES = {
    scriptsRepo,
    uivCategoriesRepo,
    targetsRepo,
    prefsRepo,
    groupsRepo,
    slaCategoriesRepo
};

const DEFAULT_BUNDLE_PATH = path.join(__dirname, '../defaults/quick-start-bundle.json');
const DEFAULT_STATE_PATH = path.join(DATA_DIR, 'first-run-defaults.json');

function readJson(filePath, fallback = null) {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        console.warn(`[quick-start] 读取 ${filePath} 失败：${error.message}`);
        return fallback;
    }
}

function writeJsonAtomic(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.renameSync(tempPath, filePath);
}

function validateBundle(bundle) {
    if (!bundle || bundle.schemaVersion !== 1 || !bundle.uiv || !bundle.sla) {
        throw new Error('默认快速上手包格式无效');
    }
    if (!Array.isArray(bundle.uiv.scripts) || !Array.isArray(bundle.uiv.categories)) {
        throw new Error('默认脚本仓库格式无效');
    }
    if (!bundle.sla.targets || !bundle.sla.prefs || !Array.isArray(bundle.sla.groups) || !Array.isArray(bundle.sla.categories)) {
        throw new Error('默认指标规则格式无效');
    }
    return bundle;
}

function loadBundle(bundlePath = DEFAULT_BUNDLE_PATH) {
    return validateBundle(readJson(bundlePath));
}

function uniqueStrings(items) {
    return [...new Set((items || []).map(item => String(item || '').trim()).filter(Boolean))];
}

function mergeScripts(defaultScripts, existingScripts) {
    const output = [...existingScripts];
    const existingNames = new Set(existingScripts.map(item => String(item.name || '').trim()).filter(Boolean));
    const existingIds = new Set(existingScripts.map(item => String(item.id || '').trim()).filter(Boolean));
    let added = 0;
    let preserved = 0;
    for (const script of defaultScripts) {
        if (existingNames.has(String(script.name || '').trim()) || existingIds.has(String(script.id || '').trim())) {
            preserved += 1;
            continue;
        }
        output.push(script);
        existingNames.add(String(script.name || '').trim());
        existingIds.add(String(script.id || '').trim());
        added += 1;
    }
    return { items: output, added, preserved };
}

function mergeGroups(defaultGroups, existingGroups) {
    const output = [...existingGroups];
    const identities = new Set(existingGroups.flatMap(group => [
        group.id ? `id:${String(group.id).toLowerCase()}` : '',
        group.name ? `name:${String(group.name).trim().toLowerCase()}` : ''
    ]).filter(Boolean));
    let added = 0;
    for (const group of defaultGroups) {
        const keys = [
            group.id ? `id:${String(group.id).toLowerCase()}` : '',
            group.name ? `name:${String(group.name).trim().toLowerCase()}` : ''
        ].filter(Boolean);
        if (keys.some(key => identities.has(key))) continue;
        output.push(group);
        keys.forEach(key => identities.add(key));
        added += 1;
    }
    return { items: output, added };
}

function stateSummary(state) {
    if (!state) return null;
    return {
        decision: state.decision,
        decidedAt: state.decidedAt,
        bundleVersion: state.bundleVersion,
        imported: state.imported || { scripts: false, metricRules: false },
        result: state.result || null
    };
}

async function getStatus(options = {}) {
    const bundlePath = options.bundlePath || DEFAULT_BUNDLE_PATH;
    const statePath = options.statePath || DEFAULT_STATE_PATH;
    const bundle = loadBundle(bundlePath);
    const state = readJson(statePath);
    const isAdmin = options.role === 'admin';
    return {
        required: !state && isAdmin,
        decided: Boolean(state),
        requiresAdmin: !isAdmin,
        state: stateSummary(state),
        bundle: {
            version: bundle.bundleVersion,
            generatedAt: bundle.generatedAt,
            description: bundle.description,
            mergePolicy: bundle.mergePolicy,
            summary: bundle.summary
        }
    };
}

async function applyDecision(options = {}) {
    const bundlePath = options.bundlePath || DEFAULT_BUNDLE_PATH;
    const statePath = options.statePath || DEFAULT_STATE_PATH;
    const backupDir = options.backupDir || path.join(DATA_DIR, 'backups/first-run-defaults');
    const bundle = loadBundle(bundlePath);
    const repositories = options.repositories || DEFAULT_REPOSITORIES;
    const existingState = readJson(statePath);
    if (existingState && options.allowRepeat !== true) {
        const error = new Error('首次启动选择已完成，不会重复导入');
        error.statusCode = 409;
        throw error;
    }

    const action = options.action === 'skip' ? 'skip' : 'import';
    const importScripts = action === 'import' && options.importScripts === true;
    const importMetricRules = action === 'import' && options.importMetricRules === true;
    if (action === 'import' && !importScripts && !importMetricRules) {
        const error = new Error('请至少选择脚本仓库或全量指标规则中的一项');
        error.statusCode = 400;
        throw error;
    }

    const [existingScriptResult, existingUivCategoryResult, existingTargetResult, existingPrefResult, existingGroupResult, existingSlaCategoryResult] = await Promise.all([
        repositories.scriptsRepo.listScripts(),
        repositories.uivCategoriesRepo.listCategories(),
        repositories.targetsRepo.getTargets(),
        repositories.prefsRepo.getPrefsObject(),
        repositories.groupsRepo.listGroups(),
        repositories.slaCategoriesRepo.listCategories()
    ]);
    const before = {
        uiv: { scripts: existingScriptResult.items, categories: existingUivCategoryResult.items },
        sla: {
            targets: existingTargetResult.items,
            prefs: existingPrefResult.items,
            groups: existingGroupResult.items,
            categories: existingSlaCategoryResult.items
        }
    };

    let backupPath = null;
    const result = {
        scriptsAdded: 0,
        scriptsPreserved: 0,
        targetsAdded: 0,
        preferencesAdded: 0,
        groupsAdded: 0,
        categoriesAdded: 0
    };

    if (action === 'import') {
        ensureDataDir();
        fs.mkdirSync(backupDir, { recursive: true });
        backupPath = path.join(backupDir, `before-import-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
        writeJsonAtomic(backupPath, before);
        try {
            if (importScripts) {
                const mergedScripts = mergeScripts(bundle.uiv.scripts, before.uiv.scripts);
                const mergedCategories = uniqueStrings([...before.uiv.categories, ...bundle.uiv.categories]);
                await repositories.scriptsRepo.replaceAllScripts(mergedScripts.items);
                await repositories.uivCategoriesRepo.replaceCategories(mergedCategories);
                result.scriptsAdded = mergedScripts.added;
                result.scriptsPreserved = mergedScripts.preserved;
                result.categoriesAdded += Math.max(0, mergedCategories.length - before.uiv.categories.length);
            }
            if (importMetricRules) {
                const mergedTargets = { ...bundle.sla.targets, ...before.sla.targets };
                const mergedPrefs = { ...bundle.sla.prefs, ...before.sla.prefs };
                const mergedGroups = mergeGroups(bundle.sla.groups, before.sla.groups);
                const mergedCategories = uniqueStrings([...before.sla.categories, ...bundle.sla.categories]);
                await repositories.targetsRepo.replaceTargets(mergedTargets);
                await repositories.prefsRepo.replacePrefs(mergedPrefs);
                await repositories.groupsRepo.replaceGroups(mergedGroups.items);
                await repositories.slaCategoriesRepo.replaceCategories(mergedCategories);
                result.targetsAdded = Object.keys(mergedTargets).length - Object.keys(before.sla.targets).length;
                result.preferencesAdded = Object.keys(mergedPrefs).length - Object.keys(before.sla.prefs).length;
                result.groupsAdded = mergedGroups.added;
                result.categoriesAdded += Math.max(0, mergedCategories.length - before.sla.categories.length);
            }
        } catch (error) {
            try {
                if (importScripts) {
                    await repositories.scriptsRepo.replaceAllScripts(before.uiv.scripts);
                    await repositories.uivCategoriesRepo.replaceCategories(before.uiv.categories);
                }
                if (importMetricRules) {
                    await repositories.targetsRepo.replaceTargets(before.sla.targets);
                    await repositories.prefsRepo.replacePrefs(before.sla.prefs);
                    await repositories.groupsRepo.replaceGroups(before.sla.groups);
                    await repositories.slaCategoriesRepo.replaceCategories(before.sla.categories);
                }
            } catch (rollbackError) {
                console.error('[quick-start] 导入回滚失败：', rollbackError);
            }
            throw error;
        }
    }

    const state = {
        schemaVersion: 1,
        decision: action,
        decidedAt: new Date().toISOString(),
        decidedBy: options.actor || '',
        source: options.source || 'first-run',
        bundleVersion: bundle.bundleVersion,
        imported: { scripts: importScripts, metricRules: importMetricRules },
        mergePolicy: 'preserve-existing',
        backupPath,
        result
    };
    writeJsonAtomic(statePath, state);
    return stateSummary(state);
}

async function applyBundledDefaults(options = {}) {
    return applyDecision({
        ...options,
        action: 'import',
        allowRepeat: true,
        source: 'global-settings'
    });
}

module.exports = {
    DEFAULT_BUNDLE_PATH,
    DEFAULT_STATE_PATH,
    applyBundledDefaults,
    applyDecision,
    getStatus,
    loadBundle,
    mergeGroups,
    mergeScripts,
    uniqueStrings,
    validateBundle
};
