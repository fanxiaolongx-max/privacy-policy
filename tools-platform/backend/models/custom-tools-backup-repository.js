const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const JSZip = require('jszip');

const customToolsRepo = require('./custom-tools-repository');
const { readKV, writeKV, deleteKV } = require('./kv-store');

const BACKUP_TYPE = 'tools-platform-custom-tools-backup';
const BACKUP_VERSION = 1;
const MAX_FILES = 10000;
const MAX_UNCOMPRESSED_BYTES = 1024 * 1024 * 1024;
const MAX_BROWSER_STATE_BYTES = 25 * 1024 * 1024;
const TEXT_DEPENDENCY_EXTENSIONS = new Set(['.html', '.htm', '.js', '.mjs', '.css', '.json', '.txt']);
const SENSITIVE_BROWSER_KEY_PATTERN = /(?:token|password|passwd|secret|authorization|session|credential)/i;
const RESERVED_PLATFORM_BROWSER_KEYS = new Set(['tools_token', 'tools_role', 'tools_user', 'tools_language']);

function isSafeBrowserStateKey(key) {
    return typeof key === 'string'
        && !SENSITIVE_BROWSER_KEY_PATTERN.test(key)
        && !RESERVED_PLATFORM_BROWSER_KEYS.has(key);
}

function sha256(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeSlug(value) {
    return String(value || '').trim().toLowerCase();
}

function assertSafeSlug(value) {
    const slug = normalizeSlug(value);
    if (!slug || !/^[a-z0-9][a-z0-9_-]{0,47}$/.test(slug)) {
        throw new Error(`备份包包含非法工具标识：${value}`);
    }
    return slug;
}

function normalizeArchivePath(value) {
    const normalized = String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
    if (!normalized || normalized.startsWith('/') || /^[a-z]:\//i.test(normalized)) return null;
    const parts = normalized.split('/').filter(Boolean);
    if (!parts.length || parts.some(part => part === '..' || part === '.')) return null;
    return parts.join('/');
}

function walkToolFiles(rootDir) {
    const result = [];
    const stack = [{ absPath: rootDir, relativePath: '' }];
    while (stack.length) {
        const current = stack.pop();
        const entries = fs.readdirSync(current.absPath, { withFileTypes: true });
        entries.forEach(entry => {
            const absPath = path.join(current.absPath, entry.name);
            const relativePath = normalizeArchivePath(path.posix.join(current.relativePath.replace(/\\/g, '/'), entry.name));
            if (!relativePath) throw new Error(`工具目录包含非法路径：${entry.name}`);
            const stat = fs.lstatSync(absPath);
            if (stat.isSymbolicLink()) throw new Error(`工具目录不允许包含符号链接：${relativePath}`);
            if (stat.isDirectory()) {
                stack.push({ absPath, relativePath });
            } else if (stat.isFile()) {
                result.push({ absPath, relativePath, size: stat.size });
            }
        });
    }
    return result.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function extractDependencies(files) {
    const apiPaths = new Set();
    const externalUrls = new Set();
    const localStorageKeys = new Set();
    const sessionStorageKeys = new Set();
    const indexedDbNames = new Set();

    files.forEach(file => {
        if (!TEXT_DEPENDENCY_EXTENSIONS.has(path.extname(file.relativePath).toLowerCase())) return;
        if (file.size > 2 * 1024 * 1024 || /(^|\/)vendor\//i.test(file.relativePath) || /\.min\.js$/i.test(file.relativePath)) return;
        const source = fs.readFileSync(file.absPath, 'utf8');
        Array.from(source.matchAll(/(?:["'`(]|^)\s*(\/api\/[A-Za-z0-9_./?=&:%${}{}-]+)/g)).forEach(match => apiPaths.add(match[1]));
        Array.from(source.matchAll(/https?:\/\/[^\s"'`<>\\)]+/g)).forEach(match => externalUrls.add(match[0]));
        Array.from(source.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\(\s*["']([^"']+)["']/g)).forEach(match => localStorageKeys.add(match[1]));
        Array.from(source.matchAll(/sessionStorage\.(?:getItem|setItem|removeItem)\(\s*["']([^"']+)["']/g)).forEach(match => sessionStorageKeys.add(match[1]));
        Array.from(source.matchAll(/indexedDB\.open\(\s*["']([^"']+)["']/g)).forEach(match => indexedDbNames.add(match[1]));
    });

    const limited = set => Array.from(set).sort().slice(0, 200);
    return {
        platformApiPaths: limited(apiPaths),
        externalUrls: limited(externalUrls),
        localStorageKeys: limited(localStorageKeys),
        sessionStorageKeys: limited(sessionStorageKeys),
        indexedDbNames: limited(indexedDbNames)
    };
}

function extractDependenciesFromBuffers(files) {
    const apiPaths = new Set();
    const externalUrls = new Set();
    const localStorageKeys = new Set();
    const sessionStorageKeys = new Set();
    const indexedDbNames = new Set();
    files.forEach(file => {
        if (!TEXT_DEPENDENCY_EXTENSIONS.has(path.extname(file.relativePath).toLowerCase())) return;
        if (file.content.length > 2 * 1024 * 1024 || /(^|\/)vendor\//i.test(file.relativePath) || /\.min\.js$/i.test(file.relativePath)) return;
        const source = file.content.toString('utf8');
        Array.from(source.matchAll(/(?:["'`(]|^)\s*(\/api\/[A-Za-z0-9_./?=&:%${}{}-]+)/g)).forEach(match => apiPaths.add(match[1]));
        Array.from(source.matchAll(/https?:\/\/[^\s"'`<>\\)]+/g)).forEach(match => externalUrls.add(match[0]));
        Array.from(source.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\(\s*["']([^"']+)["']/g)).forEach(match => localStorageKeys.add(match[1]));
        Array.from(source.matchAll(/sessionStorage\.(?:getItem|setItem|removeItem)\(\s*["']([^"']+)["']/g)).forEach(match => sessionStorageKeys.add(match[1]));
        Array.from(source.matchAll(/indexedDB\.open\(\s*["']([^"']+)["']/g)).forEach(match => indexedDbNames.add(match[1]));
    });
    const limited = set => Array.from(set).sort().slice(0, 200);
    return {
        platformApiPaths: limited(apiPaths),
        externalUrls: limited(externalUrls),
        localStorageKeys: limited(localStorageKeys),
        sessionStorageKeys: limited(sessionStorageKeys),
        indexedDbNames: limited(indexedDbNames)
    };
}

function getPlatformVersion() {
    try {
        return require('../../package.json').version || 'unknown';
    } catch (_) {
        return 'unknown';
    }
}

function normalizeToolMetadata(raw, slug) {
    const now = new Date().toISOString();
    return {
        slug,
        name: String(raw && raw.name || slug).trim().slice(0, 120) || slug,
        icon: String(raw && raw.icon || '🧩').trim().slice(0, 8) || '🧩',
        description: String(raw && raw.description || '').trim().slice(0, 2000),
        tags: Array.isArray(raw && raw.tags) ? raw.tags.map(String).map(item => item.trim()).filter(Boolean).slice(0, 8) : [],
        href: `/tools/${slug}`,
        filePath: `/custom-tools/${slug}/index.html`,
        publicAccess: raw && raw.publicAccess === true,
        createdAt: raw && raw.createdAt || now,
        updatedAt: raw && raw.updatedAt || now
    };
}

async function getBackupSummary() {
    const tools = await customToolsRepo.listTools();
    return {
        type: BACKUP_TYPE,
        version: BACKUP_VERSION,
        tools: tools.map(tool => {
            const slug = assertSafeSlug(tool.slug);
            const rootDir = path.join(customToolsRepo.CUSTOM_TOOLS_DIR, slug);
            const files = fs.existsSync(rootDir) ? walkToolFiles(rootDir) : [];
            const dependencies = extractDependencies(files);
            return {
                slug,
                name: tool.name || slug,
                icon: tool.icon || '🧩',
                fileCount: files.length,
                totalBytes: files.reduce((sum, item) => sum + item.size, 0),
                hasIndexHtml: files.some(item => item.relativePath.toLowerCase() === 'index.html'),
                dependencies
            };
        })
    };
}

function normalizeBrowserState(rawState, allowedKeys) {
    const result = {};
    let totalBytes = 0;
    if (!rawState || typeof rawState !== 'object' || Array.isArray(rawState)) return result;
    Object.entries(rawState).forEach(([key, value]) => {
        if (!allowedKeys.has(key) || !isSafeBrowserStateKey(key) || typeof value !== 'string') return;
        totalBytes += Buffer.byteLength(key, 'utf8') + Buffer.byteLength(value, 'utf8');
        if (totalBytes > MAX_BROWSER_STATE_BYTES) throw new Error('浏览器本地状态超过 25 MB，无法安全打包');
        result[key] = value;
    });
    return result;
}

async function createBackup(options = {}) {
    const allTools = await customToolsRepo.listTools();
    const requested = Array.isArray(options.slugs) && options.slugs.length
        ? new Set(options.slugs.map(assertSafeSlug))
        : new Set(allTools.map(tool => assertSafeSlug(tool.slug)));
    const tools = allTools.filter(tool => requested.has(tool.slug));
    if (!tools.length) throw new Error('没有可导出的自定义工具');
    const missing = Array.from(requested).filter(slug => !tools.some(tool => tool.slug === slug));
    if (missing.length) throw new Error(`以下自定义工具不存在：${missing.join('、')}`);

    const zip = new JSZip();
    const fileManifest = [];
    const toolManifest = [];
    const allowedBrowserKeys = new Set();
    let totalBytes = 0;

    function addFile(zipPath, content) {
        const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
        totalBytes += buffer.length;
        if (fileManifest.length >= MAX_FILES) throw new Error(`自定义工具文件数量超过 ${MAX_FILES} 个`);
        if (totalBytes > MAX_UNCOMPRESSED_BYTES) throw new Error('自定义工具解压后总大小超过 1 GB');
        zip.file(zipPath, buffer);
        fileManifest.push({ path: zipPath, size: buffer.length, sha256: sha256(buffer) });
    }

    for (const tool of tools) {
        const slug = assertSafeSlug(tool.slug);
        const rootDir = path.join(customToolsRepo.CUSTOM_TOOLS_DIR, slug);
        if (!fs.existsSync(rootDir)) throw new Error(`工具目录不存在：${slug}`);
        const files = walkToolFiles(rootDir);
        if (!files.some(file => file.relativePath.toLowerCase() === 'index.html')) {
            throw new Error(`工具缺少入口文件 index.html：${slug}`);
        }
        const dependencies = extractDependencies(files);
        dependencies.localStorageKeys.filter(isSafeBrowserStateKey).forEach(key => allowedBrowserKeys.add(key));
        files.forEach(file => addFile(`tools/${slug}/${file.relativePath}`, fs.readFileSync(file.absPath)));
        const state = await readKV('custom_tool_state', slug, null);
        addFile(`state/${slug}.json`, JSON.stringify(state, null, 2));
        toolManifest.push({
            slug,
            name: tool.name || slug,
            fileCount: files.length,
            totalBytes: files.reduce((sum, file) => sum + file.size, 0),
            stateIncluded: true,
            dependencies
        });
    }

    const registry = tools.map(tool => normalizeToolMetadata(tool, tool.slug));
    const browserState = normalizeBrowserState(options.browserState, allowedBrowserKeys);
    addFile('registry.json', JSON.stringify(registry, null, 2));
    addFile('browser-state.json', JSON.stringify(browserState, null, 2));
    fileManifest.sort((a, b) => a.path.localeCompare(b.path));

    const manifest = {
        type: BACKUP_TYPE,
        version: BACKUP_VERSION,
        createdAt: new Date().toISOString(),
        platformVersion: getPlatformVersion(),
        toolCount: toolManifest.length,
        tools: toolManifest,
        browserStateKeys: Object.keys(browserState).sort(),
        files: fileManifest,
        totalFiles: fileManifest.length,
        totalBytes,
        portability: {
            serverStateIncluded: true,
            browserLocalStorageIncluded: true,
            sharedPlatformApiDataIncluded: false,
            note: '工具调用的公共平台 API、外部接口及 IndexedDB 数据属于运行环境依赖，不会复制到独立工具备份中。'
        }
    };
    const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2));
    zip.file('manifest.json', manifestBuffer);
    zip.file('integrity.json', JSON.stringify({ algorithm: 'sha256', manifestSha256: sha256(manifestBuffer) }, null, 2));
    const buffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    });
    return {
        buffer,
        filename: `tools-platform-custom-tools_${new Date().toISOString().replace(/[:.]/g, '-')}.zip`,
        manifest
    };
}

async function loadAndValidateBackup(buffer) {
    const zip = await JSZip.loadAsync(buffer, { checkCRC32: true });
    const manifestEntry = zip.file('manifest.json');
    const integrityEntry = zip.file('integrity.json');
    if (!manifestEntry || !integrityEntry) throw new Error('备份包缺少 manifest.json 或 integrity.json');
    const manifestBuffer = await manifestEntry.async('nodebuffer');
    const manifest = JSON.parse(manifestBuffer.toString('utf8'));
    const integrity = JSON.parse(await integrityEntry.async('string'));
    if (manifest.type !== BACKUP_TYPE || manifest.version !== BACKUP_VERSION) {
        throw new Error('不是受支持的自定义工具备份包，或备份版本不兼容');
    }
    if (integrity.algorithm !== 'sha256' || integrity.manifestSha256 !== sha256(manifestBuffer)) {
        throw new Error('备份清单完整性校验失败');
    }
    if (!Array.isArray(manifest.files) || !Array.isArray(manifest.tools) || manifest.tools.length !== manifest.toolCount) {
        throw new Error('备份清单结构不完整');
    }
    if (manifest.files.length > MAX_FILES || Number(manifest.totalBytes) > MAX_UNCOMPRESSED_BYTES) {
        throw new Error('备份包超过允许的文件数量或容量');
    }
    const declaredPaths = new Set();
    let verifiedBytes = 0;
    for (const item of manifest.files) {
        const safePath = normalizeArchivePath(item.path);
        if (!safePath || safePath !== item.path || declaredPaths.has(safePath)) throw new Error(`备份清单包含非法或重复路径：${item.path}`);
        declaredPaths.add(safePath);
        const entry = zip.file(safePath);
        if (!entry) throw new Error(`备份包缺少文件：${safePath}`);
        const content = await entry.async('nodebuffer');
        verifiedBytes += content.length;
        if (content.length !== Number(item.size) || sha256(content) !== item.sha256) {
            throw new Error(`文件完整性校验失败：${safePath}`);
        }
    }
    const actualPaths = Object.values(zip.files)
        .filter(entry => !entry.dir && !['manifest.json', 'integrity.json'].includes(entry.name))
        .map(entry => entry.name);
    if (actualPaths.some(entryPath => !declaredPaths.has(entryPath)) || actualPaths.length !== declaredPaths.size) {
        throw new Error('备份包包含清单之外的文件，已拒绝恢复');
    }
    if (verifiedBytes !== Number(manifest.totalBytes)) throw new Error('备份包总容量校验失败');

    const registry = JSON.parse(await zip.file('registry.json').async('string'));
    const browserState = JSON.parse(await zip.file('browser-state.json').async('string'));
    if (!Array.isArray(registry) || registry.length !== manifest.toolCount) throw new Error('工具注册信息不完整');
    const manifestSlugs = manifest.tools.map(tool => assertSafeSlug(tool.slug));
    if (new Set(manifestSlugs).size !== manifestSlugs.length) throw new Error('备份清单包含重复的工具标识');
    const manifestSlugSet = new Set(manifestSlugs);
    manifest.files.forEach(item => {
        if (['registry.json', 'browser-state.json'].includes(item.path)) return;
        const toolMatch = item.path.match(/^tools\/([^/]+)\//);
        const stateMatch = item.path.match(/^state\/([^/]+)\.json$/);
        if (toolMatch && manifestSlugSet.has(toolMatch[1])) return;
        if (stateMatch && manifestSlugSet.has(stateMatch[1])) return;
        throw new Error(`备份清单包含未归属任何工具的文件：${item.path}`);
    });
    const registryBySlug = new Map(registry.map(tool => [assertSafeSlug(tool.slug), tool]));
    const tools = [];
    for (const toolInfo of manifest.tools) {
        const slug = assertSafeSlug(toolInfo.slug);
        if (!registryBySlug.has(slug)) throw new Error(`缺少工具注册信息：${slug}`);
        const prefix = `tools/${slug}/`;
        const fileEntries = manifest.files.filter(item => item.path.startsWith(prefix));
        if (!fileEntries.some(item => item.path.toLowerCase() === `${prefix}index.html`)) throw new Error(`工具缺少入口文件：${slug}`);
        const stateEntry = zip.file(`state/${slug}.json`);
        if (!stateEntry) throw new Error(`工具缺少服务端状态文件：${slug}`);
        const restoredFiles = await Promise.all(fileEntries.map(async item => ({
            relativePath: item.path.slice(prefix.length),
            content: await zip.file(item.path).async('nodebuffer')
        })));
        tools.push({
            slug,
            metadata: normalizeToolMetadata(registryBySlug.get(slug), slug),
            files: restoredFiles,
            state: JSON.parse(await stateEntry.async('string')),
            dependencies: extractDependenciesFromBuffers(restoredFiles)
        });
    }
    return { manifest, tools, browserState };
}

async function restoreBackup(buffer, options = {}) {
    const validated = await loadAndValidateBackup(buffer);
    const conflictStrategy = options.conflictStrategy === 'skip' ? 'skip' : 'replace';
    const originalRegistry = await customToolsRepo.listTools();
    const existingSlugs = new Set(originalRegistry.map(tool => tool.slug));
    const selectedTools = validated.tools.filter(tool => conflictStrategy !== 'skip' || !existingSlugs.has(tool.slug));
    if (!selectedTools.length) {
        return { success: true, restored: [], skipped: validated.tools.map(tool => tool.slug), browserState: {}, manifest: validated.manifest };
    }

    fs.mkdirSync(customToolsRepo.CUSTOM_TOOLS_DIR, { recursive: true });
    const operationId = `restore-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
    const stageRoot = path.join(customToolsRepo.CUSTOM_TOOLS_DIR, `.${operationId}.stage`);
    const rollbackRoot = path.join(customToolsRepo.CUSTOM_TOOLS_DIR, `.${operationId}.rollback`);
    const originalStates = new Map();
    const swapped = [];
    fs.mkdirSync(stageRoot, { recursive: true });
    fs.mkdirSync(rollbackRoot, { recursive: true });

    try {
        for (const tool of selectedTools) {
            const stageDir = path.join(stageRoot, tool.slug);
            fs.mkdirSync(stageDir, { recursive: true });
            tool.files.forEach(file => {
                const targetPath = path.resolve(stageDir, ...file.relativePath.split('/'));
                if (!targetPath.startsWith(path.resolve(stageDir) + path.sep)) throw new Error(`工具文件路径不安全：${file.relativePath}`);
                fs.mkdirSync(path.dirname(targetPath), { recursive: true });
                fs.writeFileSync(targetPath, file.content);
            });
            originalStates.set(tool.slug, await readKV('custom_tool_state', tool.slug, undefined));
        }

        for (const tool of selectedTools) {
            const targetDir = path.join(customToolsRepo.CUSTOM_TOOLS_DIR, tool.slug);
            const rollbackDir = path.join(rollbackRoot, tool.slug);
            const hadExistingDir = fs.existsSync(targetDir);
            if (hadExistingDir) fs.renameSync(targetDir, rollbackDir);
            swapped.push({ slug: tool.slug, targetDir, rollbackDir, hadExistingDir });
            fs.renameSync(path.join(stageRoot, tool.slug), targetDir);
        }

        const restoredSlugs = new Set(selectedTools.map(tool => tool.slug));
        const nextRegistry = originalRegistry.filter(tool => !restoredSlugs.has(tool.slug));
        selectedTools.forEach(tool => nextRegistry.push({ ...tool.metadata, slug: tool.slug }));
        await writeKV('sys', 'custom_tools', nextRegistry);
        for (const tool of selectedTools) {
            if (tool.state === null || tool.state === undefined) await deleteKV('custom_tool_state', tool.slug);
            else await writeKV('custom_tool_state', tool.slug, tool.state);
        }

        const allowedBrowserKeys = new Set(selectedTools.flatMap(tool => tool.dependencies.localStorageKeys || []).filter(isSafeBrowserStateKey));
        const browserState = normalizeBrowserState(validated.browserState, allowedBrowserKeys);
        return {
            success: true,
            restored: selectedTools.map(tool => tool.slug),
            skipped: validated.tools.filter(tool => !restoredSlugs.has(tool.slug)).map(tool => tool.slug),
            browserState,
            manifest: validated.manifest,
            dependencyWarnings: selectedTools.filter(tool =>
                (tool.dependencies.platformApiPaths || []).length ||
                (tool.dependencies.externalUrls || []).length ||
                (tool.dependencies.indexedDbNames || []).length
            ).map(tool => ({ slug: tool.slug, dependencies: tool.dependencies }))
        };
    } catch (err) {
        try {
            await writeKV('sys', 'custom_tools', originalRegistry);
            for (const [slug, state] of originalStates.entries()) {
                if (state === undefined) await deleteKV('custom_tool_state', slug);
                else await writeKV('custom_tool_state', slug, state);
            }
            swapped.reverse().forEach(item => {
                fs.rmSync(item.targetDir, { recursive: true, force: true });
                if (item.hadExistingDir && fs.existsSync(item.rollbackDir)) fs.renameSync(item.rollbackDir, item.targetDir);
            });
        } catch (rollbackError) {
            err.message = `${err.message}；自动回滚失败：${rollbackError.message}`;
        }
        throw err;
    } finally {
        fs.rmSync(stageRoot, { recursive: true, force: true });
        fs.rmSync(rollbackRoot, { recursive: true, force: true });
    }
}

module.exports = {
    BACKUP_TYPE,
    BACKUP_VERSION,
    getBackupSummary,
    createBackup,
    loadAndValidateBackup,
    restoreBackup
};
