const fs = require('fs');
const path = require('path');
const { getDataDir } = require('./store');

const TRANSLATIONS_DIR = path.join(__dirname, '../custom-tool-i18n');
const RUNTIME_FILE = path.join(__dirname, '../../frontend/js/shared/custom-tool-i18n-runtime.js');

function safeJson(value) {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}

function readTranslations(slug) {
    const candidates = [
        path.join(getDataDir(), 'custom-tools', slug, '.i18n.json'),
        path.join(TRANSLATIONS_DIR, `${slug}.json`)
    ];
    for (const file of candidates) {
        try {
            const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
        } catch (_) {}
    }
    return {};
}

function buildBootstrap(slug, options = {}) {
    const config = {
        slug,
        translations: readTranslations(slug),
        standalone: options.standalone === true
    };
    const configScript = `<script>window.__TOOLS_CUSTOM_I18N__=${safeJson(config)};<\/script>`;
    if (options.inlineRuntime) {
        const runtime = fs.readFileSync(RUNTIME_FILE, 'utf8').replace(/<\/script/gi, '<\\/script');
        return `${configScript}<script>${runtime}<\/script>`;
    }
    return `${configScript}<script src="/js/shared/custom-tool-i18n-runtime.js?v=20260812-06"><\/script>`;
}

function injectLanguageRuntime(html, slug, options = {}) {
    const source = String(html || '');
    if (source.includes('__TOOLS_CUSTOM_I18N__')) return source;
    const bootstrap = buildBootstrap(slug, options);
    if (/<\/body\s*>/i.test(source)) return source.replace(/<\/body\s*>/i, `${bootstrap}\n</body>`);
    return `${source}\n${bootstrap}`;
}

module.exports = {
    TRANSLATIONS_DIR,
    readTranslations,
    injectLanguageRuntime
};
