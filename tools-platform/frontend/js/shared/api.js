/**
 * shared/api.js - 前端统一 API 请求模块
 */

const API_BASE = window.location.origin;
const lastDataSourceByPath = {};
const DATA_SOURCE_MODE_KEY = 'tools_data_source_modes';

function ensureDataSourceBadge() {
    let badge = document.getElementById('dataSourceBadge');
    if (badge) return badge;

    badge = document.createElement('div');
    badge.id = 'dataSourceBadge';
    badge.style.cssText = [
        'position:fixed',
        'left:16px',
        'bottom:16px',
        'z-index:99999',
        'padding:8px 10px',
        'border-radius:10px',
        'background:rgba(15,23,42,0.88)',
        'color:#e2e8f0',
        'font-size:12px',
        'line-height:1.45',
        'box-shadow:0 8px 24px rgba(0,0,0,0.2)',
        'backdrop-filter:blur(10px)',
        'max-width:280px',
        'opacity:0',
        'visibility:hidden',
        'transition:opacity 0.45s ease, visibility 0.45s ease',
        'pointer-events:none'
    ].join(';');
    document.body.appendChild(badge);
    return badge;
}

function formatSourceLabel(source) {
    if (!source) return 'unknown';
    if (source === 'sqlite') return 'SQLite';
    if (source === 'json') return 'JSON';
    return String(source).toUpperCase();
}

function updateDataSourceHint(path, source) {
    if (!source || !document.body) return;
    const badge = ensureDataSourceBadge();
    const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    badge.innerHTML = `数据来源: <strong>${formatSourceLabel(source)}</strong><br><span style="color:#94a3b8;">${path} · ${now}</span>`;
    badge.style.visibility = 'visible';
    badge.style.opacity = '1';
    clearTimeout(badge._fadeTimer);
    badge._fadeTimer = setTimeout(() => {
        badge.style.opacity = '0';
        badge.style.visibility = 'hidden';
    }, 3600);
    console.info(`[DATA SOURCE] ${path} <- ${formatSourceLabel(source)}`);
}

function readSourceModeMap() {
    try {
        return JSON.parse(localStorage.getItem(DATA_SOURCE_MODE_KEY) || '{}');
    } catch (e) {
        return {};
    }
}

function writeSourceModeMap(map) {
    localStorage.setItem(DATA_SOURCE_MODE_KEY, JSON.stringify(map));
}

function extractDataSourceMeta(res, path) {
    const meta = {
        primary: res.headers.get('X-Data-Source') || null,
        extras: {}
    };

    for (const [headerName, headerValue] of res.headers.entries()) {
        const lower = headerName.toLowerCase();
        if (!lower.startsWith('x-data-source-')) continue;
        const key = lower.replace('x-data-source-', '');
        if (!key) continue;
        meta.extras[key] = headerValue;
    }

    if (path && (meta.primary || Object.keys(meta.extras).length > 0)) {
        lastDataSourceByPath[path] = meta;
    }

    return meta;
}

function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('tools_token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

async function handleResponse(res, requestMeta = {}) {
    if (res.status === 401) {
        // Clear token and redirect to login
        localStorage.removeItem('tools_token');
        localStorage.removeItem('tools_user');
        localStorage.removeItem('tools_role');
        if (window.location.pathname !== '/login.html') {
            window.location.href = '/login.html';
        }
    }
    
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
    }

    const body = await res.json();
    const sourceMeta = extractDataSourceMeta(res, requestMeta.path || '');
    const source = sourceMeta.primary;

    if (source && requestMeta.method === 'GET') {
        updateDataSourceHint(requestMeta.path || '', source);
    }

    return body;
}

const API = {
    get: async function(path) {
        const res = await fetch(`${API_BASE}${path}`, {
            headers: {
                ...getAuthHeaders()
            }
        });
        return handleResponse(res, { method: 'GET', path });
    },
    post: async function(path, body) {
        const res = await fetch(`${API_BASE}${path}`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(body)
        });
        return handleResponse(res, { method: 'POST', path });
    },
    put: async function(path, body) {
        const res = await fetch(`${API_BASE}${path}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(body)
        });
        return handleResponse(res, { method: 'PUT', path });
    },
    delete: async function(path) {
        const res = await fetch(`${API_BASE}${path}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        return handleResponse(res, { method: 'DELETE', path });
    },
    patch: async function(path, body) {
        const res = await fetch(`${API_BASE}${path}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(body)
        });
        return handleResponse(res, { method: 'PATCH', path });
    },
    logHistory: async function(tool, action, detail = '') {
        try {
            await this.post('/api/upload/history', { tool, action, detail });
        } catch (e) {
            // 历史记录失败不影响主流程
        }
    },
    getLastDataSource: function(path) {
        const meta = lastDataSourceByPath[path];
        return meta ? meta.primary : null;
    },
    getLastDataSourceMeta: function(path) {
        return lastDataSourceByPath[path] || null;
    },
    getSourceMode: function(scope = 'default') {
        const map = readSourceModeMap();
        const mode = map[scope];
        return ['auto', 'json', 'sqlite'].includes(mode) ? mode : 'auto';
    },
    setSourceMode: function(scope = 'default', mode = 'auto') {
        const normalized = ['auto', 'json', 'sqlite'].includes(mode) ? mode : 'auto';
        const map = readSourceModeMap();
        map[scope] = normalized;
        writeSourceModeMap(map);
        return normalized;
    }
};

window.API = API;
