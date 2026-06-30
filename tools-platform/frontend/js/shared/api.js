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
        if (typeof document !== 'undefined' && !document.cookie.includes('tools_token=')) {
            document.cookie = `tools_token=${token}; path=/; max-age=${7 * 24 * 60 * 60}`;
        }
    }
    return headers;
}

async function handleResponse(res, requestMeta = {}) {
    if (res.status === 401) {
        // Clear token and redirect to login
        localStorage.removeItem('tools_token');
        localStorage.removeItem('tools_user');
        localStorage.removeItem('tools_role');
        if (typeof document !== 'undefined') {
            document.cookie = 'tools_token=; path=/; max-age=0';
        }
        if (window.location.pathname !== '/login.html') {
            const currentParams = new URLSearchParams(window.location.search);
            const loginParams = new URLSearchParams();
            ['welcome', 'version', 'from'].forEach(key => {
                const value = currentParams.get(key);
                if (value) loginParams.set(key, value);
            });
            const suffix = loginParams.toString() ? `?${loginParams.toString()}` : '';
            window.location.href = `/login.html${suffix}`;
        }
    }
    
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const err = new Error(body.error || `HTTP ${res.status}`);
        err.status = res.status;
        err.body = body;
        throw err;
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
    deleteWithBody: async function(path, body) {
        const res = await fetch(`${API_BASE}${path}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
            body: JSON.stringify(body)
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
        return ['auto', 'sqlite'].includes(mode) ? mode : 'auto';
    },
    setSourceMode: function(scope = 'default', mode = 'auto') {
        const normalized = ['auto', 'sqlite'].includes(mode) ? mode : 'auto';
        const map = readSourceModeMap();
        map[scope] = normalized;
        writeSourceModeMap(map);
        return normalized;
    }
};

window.API = API;

function initToolsWelcomeExperience() {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('welcome');
    if (!['first', 'updated'].includes(mode)) return;

    const version = params.get('version') || '';
    const fromVersion = params.get('from') || '';
    const isUpdated = mode === 'updated';
    const title = isUpdated ? 'Tools Platform 已焕新' : '欢迎来到 Tools Platform';
    const subtitle = isUpdated && fromVersion
        ? `已从 v${fromVersion.replace(/^v/i, '')} 升级到 v${version.replace(/^v/i, '')}`
        : '桌面窗口与系统浏览器已同步就绪';

    const style = document.createElement('style');
    style.textContent = `
        .tools-welcome-overlay {
            position: fixed;
            inset: 0;
            z-index: 2147483000;
            display: grid;
            place-items: center;
            overflow: hidden;
            background:
                radial-gradient(circle at 18% 22%, rgba(100,255,218,0.18), transparent 28%),
                radial-gradient(circle at 82% 28%, rgba(74,144,226,0.22), transparent 30%),
                radial-gradient(circle at 50% 86%, rgba(168,85,247,0.18), transparent 34%),
                linear-gradient(135deg, #08111f 0%, #0f172a 46%, #111827 100%);
            color: #e2e8f0;
            font-family: 'Segoe UI', Tahoma, 'PingFang SC', 'Microsoft YaHei', sans-serif;
            opacity: 1;
            transition: opacity 0.65s ease, visibility 0.65s ease;
        }
        .tools-welcome-overlay.hide {
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
        }
        .tools-welcome-grid {
            position: absolute;
            inset: -40%;
            background-image:
                linear-gradient(rgba(148,163,184,0.09) 1px, transparent 1px),
                linear-gradient(90deg, rgba(148,163,184,0.09) 1px, transparent 1px);
            background-size: 46px 46px;
            transform: perspective(800px) rotateX(62deg) translateY(12%);
            animation: toolsWelcomeGrid 5.6s linear infinite;
            mask-image: linear-gradient(to bottom, transparent, #000 22%, #000 72%, transparent);
        }
        .tools-welcome-aurora {
            position: absolute;
            width: 78vmin;
            height: 78vmin;
            border-radius: 50%;
            background: conic-gradient(from 180deg, rgba(100,255,218,0), rgba(100,255,218,0.28), rgba(59,130,246,0.26), rgba(168,85,247,0.24), rgba(100,255,218,0));
            filter: blur(28px);
            opacity: 0.72;
            animation: toolsWelcomeSpin 8s linear infinite;
        }
        .tools-welcome-card {
            position: relative;
            width: min(760px, calc(100vw - 36px));
            min-height: 430px;
            display: grid;
            place-items: center;
            text-align: center;
            padding: 46px 34px;
            border: 1px solid rgba(255,255,255,0.18);
            border-radius: 22px;
            background: linear-gradient(145deg, rgba(15,23,42,0.68), rgba(15,23,42,0.34));
            box-shadow: 0 38px 110px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.16);
            backdrop-filter: blur(22px);
            overflow: hidden;
            animation: toolsWelcomeRise 0.82s cubic-bezier(.2,.8,.2,1) both;
        }
        .tools-welcome-card::before {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.2) 45%, transparent 58%);
            transform: translateX(-120%);
            animation: toolsWelcomeSweep 2.4s ease 0.35s both;
        }
        .tools-welcome-mark {
            width: 94px;
            height: 94px;
            margin: 0 auto 24px;
            display: grid;
            place-items: center;
            border-radius: 28px;
            background: linear-gradient(135deg, rgba(100,255,218,0.22), rgba(74,144,226,0.22));
            border: 1px solid rgba(125,211,252,0.32);
            box-shadow: 0 0 50px rgba(100,255,218,0.28);
            font-size: 46px;
            animation: toolsWelcomePulse 1.8s ease-in-out infinite;
        }
        .tools-welcome-title {
            margin: 0;
            font-size: clamp(34px, 6vw, 68px);
            line-height: 1;
            font-weight: 950;
            letter-spacing: 0;
            background: linear-gradient(90deg, #e0f2fe, #64ffda 34%, #93c5fd 68%, #c4b5fd);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .tools-welcome-subtitle {
            margin: 18px auto 0;
            max-width: 560px;
            color: #cbd5e1;
            font-size: clamp(15px, 2.2vw, 20px);
            line-height: 1.65;
        }
        .tools-welcome-version {
            margin-top: 18px;
            display: inline-flex;
            align-items: center;
            min-height: 30px;
            padding: 0 13px;
            border-radius: 999px;
            background: rgba(100,255,218,0.12);
            border: 1px solid rgba(100,255,218,0.26);
            color: #99f6e4;
            font-size: 12px;
            font-weight: 900;
        }
        .tools-welcome-points {
            margin-top: 30px;
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
        }
        .tools-welcome-point {
            min-height: 82px;
            display: grid;
            align-content: center;
            gap: 6px;
            padding: 12px;
            border-radius: 14px;
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.1);
        }
        .tools-welcome-point b {
            color: #f8fafc;
            font-size: 13px;
        }
        .tools-welcome-point span {
            color: #94a3b8;
            font-size: 11px;
            line-height: 1.45;
        }
        .tools-welcome-skip {
            position: absolute;
            top: 18px;
            right: 18px;
            height: 34px;
            padding: 0 13px;
            border: 1px solid rgba(255,255,255,0.16);
            border-radius: 999px;
            background: rgba(15,23,42,0.38);
            color: #cbd5e1;
            cursor: pointer;
            font-size: 12px;
            font-weight: 850;
        }
        .tools-welcome-skip:hover {
            color: #fff;
            border-color: rgba(100,255,218,0.38);
            background: rgba(100,255,218,0.12);
        }
        @keyframes toolsWelcomeGrid {
            from { transform: perspective(800px) rotateX(62deg) translateY(12%); }
            to { transform: perspective(800px) rotateX(62deg) translateY(calc(12% + 46px)); }
        }
        @keyframes toolsWelcomeSpin {
            to { transform: rotate(360deg); }
        }
        @keyframes toolsWelcomeRise {
            from { opacity: 0; transform: translateY(28px) scale(0.96); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes toolsWelcomeSweep {
            to { transform: translateX(120%); }
        }
        @keyframes toolsWelcomePulse {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-4px) scale(1.04); }
        }
        @media (max-width: 680px) {
            .tools-welcome-card { min-height: 0; padding: 38px 20px; }
            .tools-welcome-points { grid-template-columns: 1fr; }
            .tools-welcome-mark { width: 76px; height: 76px; border-radius: 22px; font-size: 38px; }
        }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.className = 'tools-welcome-overlay';
    overlay.innerHTML = `
        <div class="tools-welcome-grid"></div>
        <div class="tools-welcome-aurora"></div>
        <button type="button" class="tools-welcome-skip">跳过</button>
        <section class="tools-welcome-card" role="dialog" aria-label="${title}">
            <div>
                <div class="tools-welcome-mark">⚡</div>
                <h1 class="tools-welcome-title">${title}</h1>
                <p class="tools-welcome-subtitle">${subtitle}</p>
                ${version ? `<div class="tools-welcome-version">v${version.replace(/^v/i, '')}</div>` : ''}
                <div class="tools-welcome-points">
                    <div class="tools-welcome-point"><b>双入口已就绪</b><span>内置窗口与系统浏览器可同时进入工具页面</span></div>
                    <div class="tools-welcome-point"><b>本地数据留存</b><span>配置、数据库和备份继续保存在用户目录</span></div>
                    <div class="tools-welcome-point"><b>自动更新在线</b><span>后续版本可在全局设置中检查并重启安装</span></div>
                </div>
            </div>
        </section>
    `;
    document.body.appendChild(overlay);

    const cleanUrl = () => {
        const next = new URL(window.location.href);
        ['welcome', 'version', 'from'].forEach(key => next.searchParams.delete(key));
        window.history.replaceState({}, '', `${next.pathname}${next.search}${next.hash}`);
    };
    const close = () => {
        overlay.classList.add('hide');
        cleanUrl();
        setTimeout(() => {
            overlay.remove();
            style.remove();
        }, 700);
    };

    overlay.querySelector('.tools-welcome-skip')?.addEventListener('click', close);
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') close();
    }, { once: true });
    setTimeout(close, isUpdated ? 4800 : 5600);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initToolsWelcomeExperience, { once: true });
} else {
    initToolsWelcomeExperience();
}
