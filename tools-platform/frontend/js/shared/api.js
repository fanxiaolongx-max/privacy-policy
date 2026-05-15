/**
 * shared/api.js - 前端统一 API 请求模块
 * 所有对后端的 fetch 调用都通过此模块，方便统一管理 base URL 和错误处理
 */

const API_BASE = window.location.origin;

async function apiGet(path) {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(`HTTP ${res.status} - ${body.error || path}`);
    }
    return res.json();
}

async function apiPost(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(`HTTP ${res.status} - ${errBody.error || path}`);
    }
    return res.json();
}

async function apiPut(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(`HTTP ${res.status} - ${errBody.error || path}`);
    }
    return res.json();
}

async function apiDelete(path) {
    const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
    if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(`HTTP ${res.status} - ${errBody.error || path}`);
    }
    return res.json();
}

async function apiPatch(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(`HTTP ${res.status} - ${errBody.error || path}`);
    }
    return res.json();
}

// 记录操作历史到服务端
async function logHistory(tool, action, detail = '') {
    try {
        await apiPost('/api/upload/history', { tool, action, detail });
    } catch (e) {
        // 历史记录失败不影响主流程
    }
}

window.API = { get: apiGet, post: apiPost, put: apiPut, delete: apiDelete, patch: apiPatch, logHistory };
