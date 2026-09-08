'use strict';

const crypto = require('crypto');
const dns = require('dns').promises;
const fs = require('fs');
const net = require('net');
const path = require('path');
const JSZip = require('jszip');
const builtinToolsSync = require('./builtin-tools-sync');
const repo = require('./custom-tools-repository');
const { fingerprintFiles } = require('./tool-content-fingerprint');
const { getDataDir } = require('./store');

const DEFAULT_CATALOG_URL = 'https://raw.githubusercontent.com/fanxiaolongx-max/privacy-policy/tool-market/catalog.json';
const CATALOG_MAX_BYTES = 2 * 1024 * 1024;
const PACKAGE_MAX_BYTES = 50 * 1024 * 1024;
const EXTRACTED_MAX_BYTES = 120 * 1024 * 1024;
const MAX_FILES = 1500;
const CACHE_MS = 5 * 60 * 1000;
let catalogCache = null;

function sha256(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeSlug(value) {
    return String(value || '').trim().toLowerCase();
}

function isPrivateIp(address) {
    const value = String(address || '').toLowerCase().split('%')[0];
    if (value.startsWith('::ffff:')) return isPrivateIp(value.slice(7));
    if (net.isIPv4(value)) {
        const [a, b] = value.split('.').map(Number);
        return a === 0 || a === 10 || a === 127 || a >= 224
            || (a === 100 && b >= 64 && b <= 127)
            || (a === 169 && b === 254)
            || (a === 172 && b >= 16 && b <= 31)
            || (a === 192 && b === 168)
            || (a === 198 && (b === 18 || b === 19));
    }
    if (net.isIPv6(value)) {
        return value === '::' || value === '::1' || value.startsWith('fc') || value.startsWith('fd')
            || /^fe[89ab]/.test(value);
    }
    return true;
}

function allowedHostname(hostname, catalogHostname) {
    const configured = String(process.env.TOOLS_MARKET_ALLOWED_HOSTS || '')
        .split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
    const value = String(hostname || '').toLowerCase();
    return value === catalogHostname
        || value === 'github.com'
        || value.endsWith('.githubusercontent.com')
        || configured.includes(value);
}

async function assertPublicHttps(urlValue, catalogHostname) {
    const parsed = new URL(urlValue);
    if (parsed.protocol !== 'https:') throw new Error('工具市场只允许 HTTPS 下载地址');
    if (!allowedHostname(parsed.hostname, catalogHostname || parsed.hostname)) throw new Error('工具包下载域名不在允许列表');
    if (net.isIP(parsed.hostname)) {
        if (isPrivateIp(parsed.hostname)) throw new Error('工具市场不允许访问本地或内网地址');
        return parsed;
    }
    const records = await dns.lookup(parsed.hostname, { all: true, verbatim: true });
    if (!records.length || records.some(record => isPrivateIp(record.address))) {
        throw new Error('工具市场地址未解析到安全的公网地址');
    }
    return parsed;
}

async function readLimitedResponse(response, limit) {
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > limit) throw new Error('远程文件超过允许大小');
    if (!response.body || typeof response.body.getReader !== 'function') {
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length > limit) throw new Error('远程文件超过允许大小');
        return buffer;
    }
    const chunks = [];
    let total = 0;
    const reader = response.body.getReader();
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value.length;
            if (total > limit) throw new Error('远程文件超过允许大小');
            chunks.push(Buffer.from(value));
        }
    } finally {
        if (total > limit) await reader.cancel().catch(() => {});
    }
    return Buffer.concat(chunks, total);
}

async function fetchBuffer(urlValue, { limit, catalogHostname }) {
    let current = await assertPublicHttps(urlValue, catalogHostname);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    if (typeof timeout.unref === 'function') timeout.unref();
    try {
        for (let redirects = 0; redirects <= 4; redirects += 1) {
            const response = await fetch(current, {
                redirect: 'manual',
                signal: controller.signal,
                headers: { 'User-Agent': 'Tools-Platform-Market/1.0', Accept: 'application/json,application/zip' }
            });
            if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
                if (redirects === 4) throw new Error('工具市场重定向次数过多');
                current = await assertPublicHttps(new URL(response.headers.get('location'), current).toString(), catalogHostname);
                continue;
            }
            if (!response.ok) throw new Error(`工具市场返回 HTTP ${response.status}`);
            return readLimitedResponse(response, limit);
        }
    } catch (error) {
        if (error.name === 'AbortError') throw new Error('连接工具市场超时');
        throw error;
    } finally {
        clearTimeout(timeout);
    }
    throw new Error('无法读取工具市场');
}

function verifyCatalogSignature(raw) {
    const signature = raw && raw.signature;
    const publicKeyBase64 = String(process.env.TOOLS_MARKET_PUBLIC_KEY || '').trim();
    const requireSignature = process.env.TOOLS_MARKET_REQUIRE_SIGNATURE === '1';
    if (!signature) {
        if (requireSignature) throw new Error('工具市场目录缺少数字签名');
        return { state: 'unsigned', keyId: null };
    }
    if (signature.algorithm !== 'Ed25519' || !signature.value) throw new Error('工具市场目录签名格式无效');
    if (!publicKeyBase64) {
        if (requireSignature) throw new Error('客户端尚未配置工具市场验签公钥');
        return { state: 'unverified', keyId: signature.keyId || null };
    }
    const unsigned = { ...raw };
    delete unsigned.signature;
    const publicKey = crypto.createPublicKey({ key: Buffer.from(publicKeyBase64, 'base64'), format: 'der', type: 'spki' });
    const valid = crypto.verify(null, Buffer.from(JSON.stringify(unsigned)), publicKey, Buffer.from(signature.value, 'base64'));
    if (!valid) throw new Error('工具市场目录数字签名校验失败');
    return { state: 'verified', keyId: signature.keyId || null };
}

function validateCatalog(raw, catalogUrl) {
    if (!raw || raw.catalogVersion !== 1 || !Array.isArray(raw.tools)) throw new Error('工具市场目录格式无效');
    const seen = new Set();
    const tools = raw.tools.map(item => {
        const slug = normalizeSlug(item && item.slug);
        if (!/^[a-z0-9][a-z0-9_-]{0,47}$/.test(slug) || slug !== item.slug || seen.has(slug)) {
            throw new Error(`工具市场包含无效或重复的 slug：${item && item.slug}`);
        }
        seen.add(slug);
        const pkg = item.package || {};
        if (!/^[a-f0-9]{64}$/.test(String(pkg.sha256 || '')) || !/^[a-f0-9]{64}$/.test(String(pkg.directoryFingerprint || ''))) {
            throw new Error(`${slug} 缺少有效的 SHA-256 指纹`);
        }
        const packageSize = Number(pkg.size || 0);
        if (!Number.isSafeInteger(packageSize) || packageSize <= 0 || packageSize > PACKAGE_MAX_BYTES) {
            throw new Error(`${slug} 工具包大小无效`);
        }
        if (!Array.isArray(pkg.files) || pkg.files.length < 2 || pkg.files.length > MAX_FILES) {
            throw new Error(`${slug} 工具包文件清单无效`);
        }
        const packageFiles = pkg.files.map(record => {
            const recordPath = safeArchivePath(record && record.path);
            if (!recordPath || !/^[a-f0-9]{64}$/.test(String(record && record.sha256 || ''))) {
                throw new Error(`${slug} 工具包文件指纹无效`);
            }
            return { path: recordPath, size: Number(record.size || 0), sha256: record.sha256 };
        });
        const packageUrl = new URL(String(pkg.url || ''), catalogUrl).toString();
        return {
            id: String(item.id || `official/${slug}`),
            slug,
            releaseVersion: String(item.releaseVersion || item.releasedAt || 'unknown'),
            releasedAt: item.releasedAt || null,
            minPlatformVersion: String(item.minPlatformVersion || '1.0.0'),
            changelog: String(item.changelog || ''),
            tool: item.tool && typeof item.tool === 'object' ? item.tool : {},
            package: {
                url: packageUrl,
                size: packageSize,
                sha256: pkg.sha256,
                directoryFingerprint: pkg.directoryFingerprint,
                files: packageFiles
            }
        };
    });
    return { catalogVersion: 1, publisher: String(raw.publisher || 'unknown'), generatedAt: raw.generatedAt || null, tools };
}

function numericVersion(value) {
    return String(value || '').split('.').slice(0, 3).map(part => Number.parseInt(part, 10) || 0);
}

function versionAtLeast(current, minimum) {
    const left = numericVersion(current);
    const right = numericVersion(minimum);
    for (let index = 0; index < 3; index += 1) {
        if (left[index] !== right[index]) return left[index] > right[index];
    }
    return true;
}

function readManifest(toolDir) {
    try { return JSON.parse(fs.readFileSync(path.join(toolDir, repo.TOOL_MANIFEST_FILE), 'utf8')); } catch (_) { return null; }
}

function hasLocalChanges(toolDir, manifest) {
    const records = manifest && manifest.market && Array.isArray(manifest.market.files) ? manifest.market.files : [];
    return records.some(record => {
        if (!record || record.path === repo.TOOL_MANIFEST_FILE || !/^[a-f0-9]{64}$/.test(record.sha256 || '')) return false;
        const target = path.resolve(toolDir, record.path);
        if (!target.startsWith(`${path.resolve(toolDir)}${path.sep}`) || !fs.existsSync(target)) return true;
        return sha256(fs.readFileSync(target)) !== record.sha256;
    });
}

function compareCatalogTool(item, { targetDir = repo.CUSTOM_TOOLS_DIR, platformVersion = require('../../package.json').version } = {}) {
    const toolDir = path.join(targetDir, item.slug);
    const exists = fs.existsSync(toolDir) && fs.statSync(toolDir).isDirectory();
    const manifest = exists ? readManifest(toolDir) : null;
    const managed = Boolean(manifest && manifest.system && manifest.system.managedBy === builtinToolsSync.SYSTEM_MARKER);
    const linked = Boolean(manifest && manifest.market && manifest.market.id === item.id) || managed;
    const compatible = versionAtLeast(platformVersion, item.minPlatformVersion);
    let localFingerprint = manifest && manifest.system && manifest.system.fingerprint || null;
    if (managed && !manifest.market && Array.isArray(manifest.system.files)) {
        const managedFiles = [repo.TOOL_MANIFEST_FILE, ...manifest.system.files]
            .filter((file, index, files) => files.indexOf(file) === index);
        try {
            localFingerprint = managedFiles.every(file => fs.existsSync(path.join(toolDir, file)))
                ? fingerprintFiles(toolDir, managedFiles)
                : null;
        } catch (_) { localFingerprint = null; }
    }
    let status = 'unchanged';
    if (!compatible) status = 'incompatible';
    else if (!exists) status = 'missing';
    else if (!linked) status = 'conflict';
    else if (localFingerprint !== item.package.directoryFingerprint) status = 'update';
    return {
        id: item.id,
        slug: item.slug,
        name: item.tool.name || item.slug,
        nameEn: item.tool.nameEn || '',
        icon: item.tool.icon || '🧩',
        description: item.tool.description || '',
        descriptionEn: item.tool.descriptionEn || '',
        releaseVersion: item.releaseVersion,
        localVersion: manifest && manifest.market && manifest.market.releaseVersion || null,
        localSource: exists && !manifest?.market ? 'bundled' : null,
        releasedAt: item.releasedAt,
        minPlatformVersion: item.minPlatformVersion,
        changelog: item.changelog,
        packageSize: item.package.size,
        fingerprint: item.package.directoryFingerprint,
        packageSha256: item.package.sha256,
        status,
        compatible,
        localModified: exists && linked ? hasLocalChanges(toolDir, manifest) : false,
        recommended: ['missing', 'update'].includes(status) && compatible
    };
}

async function loadCatalog({ force = false } = {}) {
    const url = String(process.env.TOOLS_MARKET_CATALOG_URL || DEFAULT_CATALOG_URL).trim();
    if (!force && catalogCache && catalogCache.url === url && Date.now() - catalogCache.loadedAt < CACHE_MS) return catalogCache.value;
    const parsedUrl = new URL(url);
    const suffix = parsedUrl.search ? `&t=${Date.now()}` : `?t=${Date.now()}`;
    const buffer = await fetchBuffer(`${url}${suffix}`, { limit: CATALOG_MAX_BYTES, catalogHostname: parsedUrl.hostname });
    let raw;
    try { raw = JSON.parse(buffer.toString('utf8')); } catch (_) { throw new Error('工具市场目录不是有效 JSON'); }
    const trust = verifyCatalogSignature(raw);
    const catalog = validateCatalog(raw, url);
    const value = { ...catalog, trust, catalogUrl: url };
    catalogCache = { url, loadedAt: Date.now(), value };
    return value;
}

async function previewMarket(options = {}) {
    const catalog = await loadCatalog(options);
    const tools = catalog.tools.map(item => compareCatalogTool(item));
    return {
        publisher: catalog.publisher,
        generatedAt: catalog.generatedAt,
        trust: catalog.trust,
        tools,
        counts: tools.reduce((result, tool) => {
            result[tool.status] = (result[tool.status] || 0) + 1;
            return result;
        }, {})
    };
}

function safeArchivePath(value) {
    const normalized = String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
    const parts = normalized.split('/').filter(Boolean);
    if (!parts.length || normalized.startsWith('/') || /^[a-z]:\//i.test(normalized) || parts.some(part => part === '.' || part === '..')) return null;
    return parts.join('/');
}

async function extractPackage(buffer, targetDir) {
    const zip = await JSZip.loadAsync(buffer, { checkCRC32: true });
    const entries = Object.values(zip.files).filter(entry => !entry.dir);
    if (!entries.length || entries.length > MAX_FILES) throw new Error('工具包文件数量无效');
    let total = 0;
    for (const entry of entries) {
        if (typeof entry.unixPermissions === 'number' && (entry.unixPermissions & 0o170000) === 0o120000) throw new Error('工具包不允许包含符号链接');
        const relativePath = safeArchivePath(entry.unsafeOriginalName || entry.name);
        if (!relativePath) throw new Error(`工具包包含不安全路径：${entry.name}`);
        const content = await entry.async('nodebuffer');
        total += content.length;
        if (total > EXTRACTED_MAX_BYTES) throw new Error('工具包解压后超过大小限制');
        const output = path.join(targetDir, relativePath);
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(output, content);
    }
}

function annotateInstalledTool(item) {
    const target = path.join(repo.CUSTOM_TOOLS_DIR, item.slug, repo.TOOL_MANIFEST_FILE);
    const manifest = JSON.parse(fs.readFileSync(target, 'utf8'));
    manifest.market = {
        id: item.id,
        publisher: 'tools-platform-official',
        releaseVersion: item.releaseVersion,
        packageSha256: item.package.sha256,
        directoryFingerprint: item.package.directoryFingerprint,
        installedAt: new Date().toISOString(),
        files: item.package.files
    };
    const temp = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(temp, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    fs.renameSync(temp, target);
}

async function applyMarketUpdates({ slugs = [], adoptSlugs = [], expectedFingerprints = {} } = {}) {
    const selected = [...new Set(slugs.map(normalizeSlug).filter(Boolean))];
    const allowedAdoptions = new Set(adoptSlugs.map(normalizeSlug).filter(slug => selected.includes(slug)));
    if (!selected.length) return { installed: [], updated: [], backups: [], invalid: [], preview: await previewMarket() };
    const catalog = await loadCatalog({ force: true });
    const items = new Map(catalog.tools.map(item => [item.slug, item]));
    const current = new Map(catalog.tools.map(item => [item.slug, compareCatalogTool(item)]));
    for (const slug of selected) {
        const item = items.get(slug);
        const comparison = current.get(slug);
        if (!item) throw Object.assign(new Error(`工具市场中不存在 ${slug}`), { status: 404 });
        if (expectedFingerprints[slug] !== item.package.directoryFingerprint) throw Object.assign(new Error(`${slug} 已发布新版本，请重新加载市场`), { status: 409 });
        if (comparison.status === 'conflict' && !allowedAdoptions.has(slug)) {
            throw Object.assign(new Error(`${slug} 与未关联的本地工具同名，需要明确确认接管`), { status: 409 });
        }
        if (comparison.status === 'incompatible') throw Object.assign(new Error(`${slug} 需要平台 ${item.minPlatformVersion} 或更高版本`), { status: 409 });
    }
    const tempParent = path.join(getDataDir(), 'tmp', 'tool-market');
    fs.mkdirSync(tempParent, { recursive: true });
    const sourceDir = fs.mkdtempSync(path.join(tempParent, 'apply-'));
    try {
        const catalogHost = new URL(catalog.catalogUrl).hostname;
        for (const slug of selected) {
            const item = items.get(slug);
            const buffer = await fetchBuffer(item.package.url, { limit: PACKAGE_MAX_BYTES, catalogHostname: catalogHost });
            if (buffer.length !== item.package.size || sha256(buffer) !== item.package.sha256) throw new Error(`${slug} 工具包 SHA-256 或大小校验失败`);
            const toolSource = path.join(sourceDir, slug);
            fs.mkdirSync(toolSource, { recursive: true });
            await extractPackage(buffer, toolSource);
        }
        const sourcePreview = builtinToolsSync.previewBuiltinTools({ sourceDir, targetDir: repo.CUSTOM_TOOLS_DIR, includeSkipped: true });
        const sourceMap = new Map(sourcePreview.tools.map(item => [item.slug, item]));
        for (const slug of selected) {
            if (sourceMap.get(slug)?.fingerprint !== items.get(slug).package.directoryFingerprint) throw new Error(`${slug} 解压内容指纹与目录不一致`);
        }
        const result = builtinToolsSync.applyBuiltinToolDecisions({
            sourceDir,
            targetDir: repo.CUSTOM_TOOLS_DIR,
            backupRoot: path.join(getDataDir(), 'backups', 'tool-market'),
            applySlugs: selected,
            expectedFingerprints: Object.fromEntries(selected.map(slug => [slug, sourceMap.get(slug).fingerprint]))
        });
        const changed = [...result.installed, ...result.adopted, ...result.updated];
        changed.forEach(slug => annotateInstalledTool(items.get(slug)));
        return { ...result, changed, preview: await previewMarket() };
    } finally {
        fs.rmSync(sourceDir, { recursive: true, force: true });
    }
}

module.exports = {
    DEFAULT_CATALOG_URL,
    applyMarketUpdates,
    compareCatalogTool,
    loadCatalog,
    previewMarket,
    validateCatalog,
    verifyCatalogSignature,
    versionAtLeast
};
