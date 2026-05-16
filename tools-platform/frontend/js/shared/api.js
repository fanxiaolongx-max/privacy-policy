/**
 * shared/api.js - 前端统一 API 请求模块
 */

const API_BASE = window.location.origin;

function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('tools_token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

async function handleResponse(res) {
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
    return res.json();
}

const API = {
    get: async function(path) {
        const res = await fetch(`${API_BASE}${path}`, {
            headers: {
                ...getAuthHeaders()
            }
        });
        return handleResponse(res);
    },
    post: async function(path, body) {
        const res = await fetch(`${API_BASE}${path}`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(body)
        });
        return handleResponse(res);
    },
    put: async function(path, body) {
        const res = await fetch(`${API_BASE}${path}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(body)
        });
        return handleResponse(res);
    },
    delete: async function(path) {
        const res = await fetch(`${API_BASE}${path}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        return handleResponse(res);
    },
    patch: async function(path, body) {
        const res = await fetch(`${API_BASE}${path}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(body)
        });
        return handleResponse(res);
    },
    logHistory: async function(tool, action, detail = '') {
        try {
            await this.post('/api/upload/history', { tool, action, detail });
        } catch (e) {
            // 历史记录失败不影响主流程
        }
    }
};

window.API = API;
