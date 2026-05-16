/**
 * shared/navbar.js - 统一导航栏组件
 * 根据当前路径自动标记 active 链接
 */
function renderNavbar() {
    const path = window.location.pathname;
    const links = [
        { href: '/',        icon: '🏠', label: '工具中台', match: p => p === '/' },
        { href: '/uivf12',  icon: '🚀', label: 'UIVF12 抓取引擎', match: p => p.startsWith('/uivf12') },
        { href: '/sla',     icon: '📊', label: 'Task SLA 监控台', match: p => p.startsWith('/sla') },
        { href: '/report',  icon: '📈', label: '专业报表看板', match: p => p.startsWith('/report') }
    ];

    const linksHtml = links.map(l =>
        `<a href="${l.href}" class="nav-link ${l.match(path) ? 'active' : ''}">${l.icon} ${l.label}</a>`
    ).join('');

    const nav = document.createElement('nav');
    nav.id = 'app-navbar';
    nav.innerHTML = `
        <a href="/" class="nav-brand">
            <span class="brand-icon">⚡</span>
            <span class="brand-name">Tools Platform</span>
        </a>
        <div class="nav-divider"></div>
        <div class="nav-links">${linksHtml}</div>
        <div class="nav-status">
            <div class="status-dot"></div>
            <span id="server-status-text">服务在线</span>
        </div>
    `;
    document.body.prepend(nav);
}

// 检查服务状态
async function checkServerStatus() {
    try {
        const r = await fetch('/api/health');
        const data = await r.json();
        const el = document.getElementById('server-status-text');
        if (el) el.textContent = '服务在线';
    } catch (e) {
        const dot = document.querySelector('.status-dot');
        const el = document.getElementById('server-status-text');
        if (dot) dot.style.background = '#ef5350';
        if (el) el.textContent = '离线';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    renderNavbar();
    setTimeout(checkServerStatus, 500);
});
