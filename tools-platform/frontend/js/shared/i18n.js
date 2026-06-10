/**
 * shared/i18n.js - Lightweight client-side language helper.
 * Pages register dictionaries and mark translatable nodes with data-i18n.
 */
(function () {
    const STORAGE_KEY = 'tools_lang';
    const DEFAULT_LANG = 'zh-CN';
    const SUPPORTED_LANGS = ['zh-CN', 'en-US'];
    const dictionaries = {};

    function getStoredLang() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (SUPPORTED_LANGS.includes(saved)) return saved;
        return DEFAULT_LANG;
    }

    function interpolate(template, params = {}) {
        return String(template).replace(/\{(\w+)\}/g, (_, key) => (
            Object.prototype.hasOwnProperty.call(params, key) ? params[key] : `{${key}}`
        ));
    }

    function translate(key, params = {}, lang = getStoredLang()) {
        const dict = dictionaries[lang] || {};
        const fallback = dictionaries[DEFAULT_LANG] || {};
        const value = dict[key] ?? fallback[key] ?? key;
        return interpolate(value, params);
    }

    function hasTranslation(key, lang = getStoredLang()) {
        const dict = dictionaries[lang] || {};
        const fallback = dictionaries[DEFAULT_LANG] || {};
        return (key in dict) || (key in fallback);
    }

    function applyI18n(root = document) {
        const lang = getStoredLang();
        document.documentElement.lang = lang;
        root.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            if (hasTranslation(key, lang)) el.textContent = translate(key, {}, lang);
        });
        root.querySelectorAll('[data-i18n-html]').forEach(el => {
            const key = el.dataset.i18nHtml;
            if (hasTranslation(key, lang)) el.innerHTML = translate(key, {}, lang);
        });
        root.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.dataset.i18nTitle;
            if (hasTranslation(key, lang)) el.title = translate(key, {}, lang);
        });
        root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.dataset.i18nPlaceholder;
            if (hasTranslation(key, lang)) el.placeholder = translate(key, {}, lang);
        });
        root.querySelectorAll('[data-i18n-value]').forEach(el => {
            const key = el.dataset.i18nValue;
            if (hasTranslation(key, lang)) el.value = translate(key, {}, lang);
        });
    }

    function setLanguage(lang) {
        if (!SUPPORTED_LANGS.includes(lang)) return;
        localStorage.setItem(STORAGE_KEY, lang);
        applyI18n(document);
        window.dispatchEvent(new CustomEvent('tools:languagechange', { detail: { lang } }));
    }

    function toggleLanguage() {
        setLanguage(getStoredLang() === 'zh-CN' ? 'en-US' : 'zh-CN');
    }

    function register(namespace, entries) {
        Object.entries(entries || {}).forEach(([lang, values]) => {
            dictionaries[lang] = { ...(dictionaries[lang] || {}), ...values };
        });
        applyI18n(document);
    }

    window.ToolsI18n = {
        defaultLang: DEFAULT_LANG,
        supportedLangs: SUPPORTED_LANGS,
        getLanguage: getStoredLang,
        setLanguage,
        toggleLanguage,
        register,
        apply: applyI18n,
        t: translate
    };
})();
