/**
 * shared/navbar.js - 统一导航栏组件
 * 根据当前路径自动标记 active 链接
 */
function renderNavbar() {
    const path = window.location.pathname;
    const links = [
        { href: '/', icon: '🏠', label: '工具中台', match: p => p === '/' },
        { href: '/uivf12', icon: '🚀', label: '数据抓取', match: p => p.startsWith('/uivf12') },
        { href: '/sla', icon: '📊', label: '数据导入', match: p => p.startsWith('/sla') },
        { href: '/report', icon: '📈', label: '报表看板', match: p => p.startsWith('/report') },
        { href: '/expedite', icon: '⚡', label: '一键催办', match: p => p.startsWith('/expedite') },
        { href: '/monthly', icon: '📅', label: '月报页面', match: p => p.startsWith('/monthly') }
    ];

    const linksHtml = links.map(l =>
        `<a href="${l.href}" class="nav-link ${l.match(path) ? 'active' : ''}">${l.icon} ${l.label}</a>`
    ).join('');

    const role = localStorage.getItem('tools_role');
    const user = localStorage.getItem('tools_user');

    // Hide all buttons that edit/add stuff if readonly
    if (role === 'readonly') {
        const style = document.createElement('style');
        style.textContent = `
            button[onclick^="openAdd"], button[onclick^="openGroupModal"], 
            button[onclick^="openWeightModal"], button[onclick^="save"],
            button[onclick^="delete"], button[onclick^="add"], button[onclick^="upload"],
            .btn-action, .manual-adjust-input { display: none !important; }
        `;
        document.head.appendChild(style);
    }

    const nav = document.createElement('nav');
    nav.id = 'app-navbar';
    nav.innerHTML = `
        <a href="/" class="nav-brand">
            <span class="brand-icon">⚡</span>
            <span class="brand-name">Tools Platform</span>
        </a>
        <div class="nav-divider"></div>
        <div class="nav-links">${linksHtml}</div>
        <div style="flex:1"></div>
        
        <div style="display:flex; align-items:center; gap:15px; font-size:14px; font-weight:600; color:#555;">
            ${role === 'admin' ? '<a href="#" onclick="openUserModal()" style="text-decoration:none; color:#3949ab;">👥 账号管理</a>' : ''}
            <span style="color:#0277bd;">👤 ${user || '未登录'}</span>
            <a href="#" onclick="doLogout()" style="text-decoration:none; color:#d32f2f; background:#ffebee; padding:4px 10px; border-radius:15px;">退出</a>
        </div>

        <div class="nav-status" style="margin-left:20px;">
            <div class="status-dot"></div>
            <span id="server-status-text">服务在线</span>
        </div>
    `;
    document.body.prepend(nav);
}

window.doLogout = async function () {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('tools_token') }
        });
    } catch (e) { }
    localStorage.removeItem('tools_token');
    localStorage.removeItem('tools_user');
    localStorage.removeItem('tools_role');
    window.location.href = '/login.html';
};

window.openUserModal = async function () {
    if (localStorage.getItem('tools_role') !== 'admin') return;

    let m = document.getElementById('user-mgmt-modal');
    if (!m) {
        m = document.createElement('div');
        m.id = 'user-mgmt-modal';
        m.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:99999; display:none; align-items:center; justify-content:center;';
        document.body.appendChild(m);
    }

    try {
        const res = await API.get('/api/auth/users');

        let trs = res.map(u => `
            <tr>
                <td style="padding:10px; border-bottom:1px solid #eee;">${u.username}</td>
                <td style="padding:10px; border-bottom:1px solid #eee;">${u.role === 'admin' ? '超级管理' : '只读'}</td>
                <td style="padding:10px; border-bottom:1px solid #eee; text-align:right;">
                    ${u.username !== 'admin' ? `<button onclick="deleteUser('${u.username}')" style="background:#ffebee; color:#d32f2f; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">删除</button>` : ''}
                    <button onclick="resetPwd('${u.username}')" style="background:#e8eaf6; color:#3949ab; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; margin-left:5px;">重置密码</button>
                </td>
            </tr>
        `).join('');

        m.innerHTML = `
            <div style="background:#fff; width:500px; padding:20px; border-radius:12px;">
                <h3 style="margin-top:0;">👥 账号管理</h3>
                <div style="display:flex; gap:10px; margin-bottom:15px;">
                    <input id="nu_name" placeholder="新用户名" style="flex:1; padding:8px; border:1px solid #ccc; border-radius:4px;">
                    <input id="nu_pwd" placeholder="密码" style="flex:1; padding:8px; border:1px solid #ccc; border-radius:4px;">
                    <select id="nu_role" style="padding:8px; border:1px solid #ccc; border-radius:4px;">
                        <option value="readonly">只读</option>
                        <option value="admin">超管</option>
                    </select>
                    <button onclick="addUser()" style="background:#2e7d32; color:#fff; border:none; padding:8px 12px; border-radius:4px; cursor:pointer;">新增</button>
                </div>
                <table style="width:100%; border-collapse:collapse; text-align:left;">
                    <thead><tr style="background:#f5f5f5;"><th style="padding:10px;">账号</th><th style="padding:10px;">权限角色</th><th style="padding:10px; text-align:right;">操作</th></tr></thead>
                    <tbody>${trs}</tbody>
                </table>
                <div style="text-align:right; margin-top:20px;">
                    <button onclick="document.getElementById('user-mgmt-modal').style.display='none'" style="padding:8px 20px; cursor:pointer;">关闭</button>
                </div>
            </div>
        `;
        m.style.display = 'flex';
    } catch (e) {
        alert('获取用户列表失败: ' + e.message);
    }
};

window.addUser = async function () {
    const username = document.getElementById('nu_name').value;
    const password = document.getElementById('nu_pwd').value;
    const role = document.getElementById('nu_role').value;
    if (!username || !password) return alert('需填写完整');
    try {
        await API.post('/api/auth/users', { username, password, role });
        alert('添加成功');
        openUserModal();
    } catch (e) { alert(e.message); }
};
window.deleteUser = async function (u) {
    if (!confirm('确定删除?')) return;
    try {
        await API.delete('/api/auth/users/' + u);
        openUserModal();
    } catch (e) { alert(e.message); }
};
window.resetPwd = async function (u) {
    const password = prompt('请输入新密码:');
    if (!password) return;
    try {
        await API.put('/api/auth/users/' + u + '/password', { password });
        alert('重置成功');
    } catch (e) { alert(e.message); }
};

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
