/**
 * uivf12/url-assist.js - 请求 URL 自动分类与脚本仓库地址联想
 */
(function () {
    const PRESET_BY_CATEGORY = {
        DataFab: 'https://datafab-pro.gtsdata.huawei.com/DataFabKernelCn/v1/answer/getAnswers',
        NetCare中国: 'https://netcare.huawei.com/adc-service/web/rest/v1/services/xxx',
        NetCare中东: 'https://netcare-ae.gts.huawei.com/adc-service/web/rest/v1/services/xxx',
        NetCare德国: 'https://netcare-de.gts.huawei.com/adc-service/web/rest/v1/services/xxx'
    };
    let repositoryScripts = [];

    function t(key, params) {
        return typeof window.UIVT === 'function' ? window.UIVT(key, params) : key;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function detectCategory(rawUrl) {
        const value = String(rawUrl || '').trim();
        if (!value) return 'custom';
        let host = '';
        try {
            const parseable = /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`;
            host = new URL(parseable).hostname.toLowerCase();
        } catch (_) {
            return 'custom';
        }
        if (host === 'datafab-pro.gtsdata.huawei.com') return 'DataFab';
        if (host === 'netcare-ae.gts.huawei.com') return 'NetCare中东';
        if (host === 'netcare-de.gts.huawei.com') return 'NetCare德国';
        if (host === 'netcare.huawei.com') return 'NetCare中国';
        return 'custom';
    }

    function syncPreset(rawUrl) {
        const select = document.getElementById('urlPreset');
        if (!select) return 'custom';
        const category = detectCategory(rawUrl);
        select.value = PRESET_BY_CATEGORY[category] || '';
        return category;
    }

    function safeDisplayUrl(rawUrl) {
        try {
            const url = new URL(rawUrl);
            const safeParams = new URLSearchParams();
            url.searchParams.forEach((value, key) => {
                if (!/token|secret|password|cookie|authorization|csrf|xsrf|session/i.test(key)) {
                    safeParams.append(key, value.length > 40 ? `${value.slice(0, 37)}...` : value);
                }
            });
            const query = safeParams.toString();
            return `${url.origin}${url.pathname}${query ? `?${query}` : ''}`;
        } catch (_) {
            return String(rawUrl || '');
        }
    }

    function commonPrefixLength(a, b) {
        const max = Math.min(a.length, b.length);
        let index = 0;
        while (index < max && a[index] === b[index]) index += 1;
        return index;
    }

    function scoreCandidate(input, candidate) {
        const query = input.toLowerCase();
        const target = candidate.toLowerCase();
        if (!query || target === query) return -1;
        if (target.startsWith(query)) return 2000 + query.length;
        if (query.startsWith(target)) return 1600 + target.length;
        try {
            const queryUrl = new URL(input);
            const targetUrl = new URL(candidate);
            if (queryUrl.origin !== targetUrl.origin) return -1;
            const sharedPath = commonPrefixLength(queryUrl.pathname.toLowerCase(), targetUrl.pathname.toLowerCase());
            return 1000 + sharedPath;
        } catch (_) {
            const shared = commonPrefixLength(query, target);
            return shared >= 12 ? 500 + shared : -1;
        }
    }

    function getCandidates(input) {
        const deduped = new Map();
        repositoryScripts.forEach(script => {
            const url = String(script && script.url || '').trim();
            if (!url) return;
            const score = scoreCandidate(input, url);
            if (score < 0) return;
            const existing = deduped.get(url);
            if (!existing || score > existing.score) {
                deduped.set(url, {
                    url,
                    score,
                    name: String(script.name || ''),
                    category: detectCategory(url) !== 'custom'
                        ? detectCategory(url)
                        : String(script.category || 'custom')
                });
            }
        });
        return [...deduped.values()]
            .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url))
            .slice(0, 6);
    }

    function categoryLabel(category) {
        if (category === 'custom') return t('uiv.urlAssist.custom');
        return window.UIVI18n?.categoryLabel?.(category) || category;
    }

    function categoryTone(category) {
        return ({
            DataFab: 'datafab',
            NetCare中国: 'netcare-cn',
            NetCare中东: 'netcare-ae',
            NetCare德国: 'netcare-de'
        })[category] || 'custom';
    }

    function render() {
        const input = document.getElementById('requestUrl');
        const panel = document.getElementById('urlSuggestionPanel');
        if (!input || !panel) return;
        const value = input.value.trim();
        const category = syncPreset(value);
        const candidates = value.length >= 8 ? getCandidates(value) : [];
        if (!candidates.length) {
            panel.hidden = true;
            panel.innerHTML = '';
            return;
        }
        panel.innerHTML = `
            <div class="url-suggestion-head">
                <span>${t('uiv.urlAssist.detected', { category: categoryLabel(category) })}</span>
                <b>${t('uiv.urlAssist.matches', { count: candidates.length })}</b>
            </div>
            <div class="url-suggestion-list">
                ${candidates.map((item, index) => `
                    <button type="button" data-url-index="${index}" title="${escapeHtml(safeDisplayUrl(item.url))}">
                        <i class="${categoryTone(item.category)}"></i>
                        <span>
                            <strong>${escapeHtml(item.name || categoryLabel(item.category))}</strong>
                            <small>${escapeHtml(safeDisplayUrl(item.url))}</small>
                        </span>
                        <em>${escapeHtml(categoryLabel(item.category))}</em>
                    </button>
                `).join('')}
            </div>
        `;
        panel.hidden = false;
        panel.querySelectorAll('[data-url-index]').forEach(button => {
            button.addEventListener('click', () => applyCandidate(candidates[Number(button.dataset.urlIndex)]));
        });
    }

    function applyCandidate(candidate) {
        if (!candidate) return;
        const input = document.getElementById('requestUrl');
        if (!input) return;
        input.value = candidate.url;
        syncPreset(candidate.url);
        document.getElementById('urlSuggestionPanel')?.setAttribute('hidden', '');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
    }

    function selectPreset(value) {
        const input = document.getElementById('requestUrl');
        if (!input) return;
        input.value = value || '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
    }

    function setRepositoryScripts(scripts) {
        repositoryScripts = Array.isArray(scripts) ? scripts : [];
        const input = document.getElementById('requestUrl');
        if (input && document.activeElement === input) render();
    }

    function initialize() {
        const input = document.getElementById('requestUrl');
        const select = document.getElementById('urlPreset');
        if (!input || !select) return;
        input.addEventListener('input', render);
        input.addEventListener('focus', render);
        select.addEventListener('change', () => selectPreset(select.value));
        document.addEventListener('click', event => {
            if (event.target.closest?.('.request-url-area')) return;
            document.getElementById('urlSuggestionPanel')?.setAttribute('hidden', '');
        });
        syncPreset(input.value);
    }

    window.UIVUrlAssist = {
        detectCategory,
        syncPreset,
        selectPreset,
        setRepositoryScripts,
        render
    };

    initialize();
})();
