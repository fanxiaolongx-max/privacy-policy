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
        { href: '/monthly', icon: '📅', label: '月报页面', match: p => p.startsWith('/monthly') },
        { href: '/frt', icon: '📊', label: 'FRT核算', match: p => p.startsWith('/frt') },
        { href: '/praudit', icon: '📋', label: 'PR稽查', match: p => p.startsWith('/praudit') },
        { href: '/storage', icon: '💽', label: '迁移状态', match: p => p.startsWith('/storage') },
        { href: '/db-explorer', icon: '🗄️', label: '数据探索', match: p => p.startsWith('/db-explorer') }
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
        
        <div style="display:flex; align-items:center; gap:4px; font-size:11px; font-weight:600; color:#e2e8f0;">
            <a href="/requirements" class="req-btn" style="text-decoration:none; color:#fff; background: linear-gradient(135deg, #00b09b, #96c93d); padding:3px 8px; border-radius:4px; font-size:11px; font-weight:bold; box-shadow:0 2px 4px rgba(0,176,155,0.3); display:flex; align-items:center; gap:4px; transition:transform 0.2s;">🎯 需求</a>
            ${role === 'admin' ? '<a href="#" onclick="openUserModal()" onmouseover="this.style.background=\'rgba(255,255,255,0.2)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.1)\'" style="text-decoration:none; color:#f8fafc; background:rgba(255,255,255,0.1); padding:3px 8px; border-radius:4px; border:1px solid rgba(255,255,255,0.2); font-size:11px; transition:background 0.2s;">👥 账号</a>' : ''}
            <span style="color:#38bdf8; background:rgba(56,189,248,0.15); padding:3px 8px; border-radius:4px; border:1px solid rgba(56,189,248,0.3); font-size:11px;">👤 ${user || '未登录'}</span>
            <a href="#" onclick="doLogout()" onmouseover="this.style.background='rgba(239,68,68,0.25)'" onmouseout="this.style.background='rgba(239,68,68,0.15)'" style="text-decoration:none; color:#fca5a5; background:rgba(239,68,68,0.15); padding:3px 8px; border-radius:4px; border:1px solid rgba(239,68,68,0.3); font-size:11px; transition:background 0.2s;">退出</a>
        </div>

        <div class="nav-status" style="margin-left:20px; display:flex; align-items:center; gap:12px;">
            <div style="font-size:11px; color:#64748b; background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px; font-family:monospace; letter-spacing:0.5px;">v1.1.0</div>
            <div style="display:flex; align-items:center; gap:6px;">
                <div class="status-dot"></div>
                <span id="server-status-text">服务在线</span>
            </div>
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
        m.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(15,23,42,0.6); backdrop-filter:blur(4px); z-index:99999; display:none; align-items:center; justify-content:center;';
        document.body.appendChild(m);
    }

    try {
        const res = await API.get('/api/auth/users');

        let trs = res.map(u => {
            const roleBadge = u.role === 'admin' 
                ? '<span style="background:#e0e7ff; color:#4338ca; padding:4px 10px; border-radius:20px; font-size:12px; font-weight:600; border:1px solid #c7d2fe;">超级管理</span>'
                : '<span style="background:#f1f5f9; color:#64748b; padding:4px 10px; border-radius:20px; font-size:12px; font-weight:600; border:1px solid #e2e8f0;">只读用户</span>';
            
            return `
            <tr style="transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <td style="padding:14px 16px; border-bottom:1px solid #f1f5f9; font-weight:500; color:#334155;">${u.username}</td>
                <td style="padding:14px 16px; border-bottom:1px solid #f1f5f9;">${roleBadge}</td>
                <td style="padding:14px 16px; border-bottom:1px solid #f1f5f9; text-align:right;">
                    ${u.username !== 'admin' ? `<button onclick="deleteUser('${u.username}')" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='#fef2f2'" style="background:#fef2f2; color:#ef4444; border:1px solid #fee2e2; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; transition:all 0.2s;">删除</button>` : ''}
                    <button onclick="resetPwd('${u.username}')" onmouseover="this.style.background='#e0f2fe'" onmouseout="this.style.background='#f0f9ff'" style="background:#f0f9ff; color:#0284c7; border:1px solid #e0f2fe; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; transition:all 0.2s; margin-left:8px;">重置密码</button>
                </td>
            </tr>
            `;
        }).join('');

        m.innerHTML = `
            <div style="background:#ffffff; width:650px; max-width:90%; padding:32px; border-radius:16px; box-shadow:0 20px 40px rgba(0,0,0,0.2); position:relative; animation: fadeIn 0.3s ease;">
                <button onclick="document.getElementById('user-mgmt-modal').style.display='none'" style="position:absolute; top:24px; right:24px; background:none; border:none; font-size:24px; color:#94a3b8; cursor:pointer; line-height:1; transition:color 0.2s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#94a3b8'">&times;</button>
                
                <h3 style="margin-top:0; margin-bottom:24px; font-size:20px; font-weight:700; color:#1e293b; display:flex; align-items:center; gap:8px; border-bottom:2px solid #f1f5f9; padding-bottom:16px;">
                    👥 账号管理与权限
                </h3>
                
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px; margin-bottom:24px;">
                    <div style="font-size:13px; font-weight:600; color:#475569; margin-bottom:12px;">➕ 新增账号</div>
                    <div style="display:flex; gap:12px;">
                        <input id="nu_name" placeholder="输入新用户名" style="flex:1; padding:10px 14px; border:1px solid #cbd5e1; border-radius:8px; outline:none; font-size:14px; transition:border-color 0.2s, box-shadow 0.2s;" onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#cbd5e1'; this.style.boxShadow='none'">
                        <input id="nu_pwd" placeholder="设置密码" style="flex:1; padding:10px 14px; border:1px solid #cbd5e1; border-radius:8px; outline:none; font-size:14px; transition:border-color 0.2s, box-shadow 0.2s;" onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#cbd5e1'; this.style.boxShadow='none'">
                        <select id="nu_role" style="padding:10px 14px; border:1px solid #cbd5e1; border-radius:8px; outline:none; font-size:14px; background:#fff; cursor:pointer;">
                            <option value="readonly">只读权限</option>
                            <option value="admin">超级管理</option>
                        </select>
                        <button onclick="addUser()" style="background:#10b981; color:#fff; border:none; padding:10px 20px; border-radius:8px; font-weight:600; cursor:pointer; transition:background 0.2s; box-shadow:0 2px 4px rgba(16,185,129,0.2);" onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'">新增</button>
                    </div>
                </div>
                
                <div style="border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
                    <table style="width:100%; border-collapse:collapse; text-align:left;">
                        <thead>
                            <tr style="background:#f8fafc; border-bottom:1px solid #e2e8f0;">
                                <th style="padding:12px 16px; font-size:13px; font-weight:600; color:#64748b;">账号名称</th>
                                <th style="padding:12px 16px; font-size:13px; font-weight:600; color:#64748b;">权限角色</th>
                                <th style="padding:12px 16px; font-size:13px; font-weight:600; color:#64748b; text-align:right;">快捷操作</th>
                            </tr>
                        </thead>
                        <tbody>${trs}</tbody>
                    </table>
                </div>
                
                <div style="text-align:right; margin-top:24px;">
                    <button onclick="document.getElementById('user-mgmt-modal').style.display='none'" style="background:#f1f5f9; color:#475569; border:none; padding:10px 24px; border-radius:8px; font-weight:600; font-size:14px; cursor:pointer; transition:background 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">完成并关闭</button>
                </div>
            </div>
        `;
        m.style.display = 'flex';
    } catch (e) {
        alert('获取用户列表失败: ' + e.message);
    }
};

// ==========================================
// 全局注入 AI 客服助手
// ==========================================
(function() {
    // 确保不重复加载
    if (!document.querySelector('script[src="/js/shared/ai-assistant.js"]')) {
        const aiScript = document.createElement('script');
        aiScript.src = '/js/shared/ai-assistant.js';
        document.body.appendChild(aiScript);
    }
})();

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
