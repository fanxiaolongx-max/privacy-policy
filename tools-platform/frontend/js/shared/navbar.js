/**
 * shared/navbar.js - 统一导航栏组件
 * 支持固定工具、自定义工具、二级分类与全局顺序设置。
 */
const NAV_BUILTIN_LINKS = [
    { id: 'home', href: '/', icon: '🏠', label: '工具中台', defaultCategory: 'business', match: p => p === '/' },
    { id: 'uivf12', href: '/uivf12', icon: '🚀', label: '数据抓取', defaultCategory: 'business', match: p => p.startsWith('/uivf12') },
    { id: 'sla', href: '/sla', icon: '📊', label: '数据导入', defaultCategory: 'business', match: p => p.startsWith('/sla') },
    { id: 'report', href: '/report', icon: '📈', label: '报表看板', defaultCategory: 'business', match: p => p.startsWith('/report') },
    { id: 'expedite', href: '/expedite', icon: '⚡', label: '一键催办', defaultCategory: 'business', match: p => p.startsWith('/expedite') },
    { id: 'monthly', href: '/monthly', icon: '📅', label: '月报页面', defaultCategory: 'business', match: p => p.startsWith('/monthly') },
    { id: 'frt', href: '/frt', icon: '📊', label: 'FRT核算', defaultCategory: 'audit', match: p => p.startsWith('/frt') },
    { id: 'praudit', href: '/praudit', icon: '📋', label: 'PR稽查', defaultCategory: 'audit', match: p => p.startsWith('/praudit') },
    { id: 'storage', href: '/storage', icon: '💽', label: '迁移状态', defaultCategory: 'system', match: p => p.startsWith('/storage') },
    { id: 'db-explorer', href: '/db-explorer', icon: '🗄️', label: '数据探索', defaultCategory: 'system', match: p => p.startsWith('/db-explorer') }
];

const NAV_DEFAULT_SETTINGS = {
    primaryIds: ['home', 'uivf12', 'sla', 'report', 'expedite', 'monthly'],
    categories: [
        { id: 'business', name: '业务工具' },
        { id: 'audit', name: '审计与核算' },
        { id: 'system', name: '系统治理' },
        { id: 'custom', name: '自定义工具' }
    ],
    categoryByItem: { frt: 'audit', praudit: 'audit', storage: 'system', 'db-explorer': 'system' },
    itemOrder: ['frt', 'praudit', 'storage', 'db-explorer']
};

let navState = {
    settings: JSON.parse(JSON.stringify(NAV_DEFAULT_SETTINGS)),
    customTools: [],
    settingsTab: 'primary',
    saveTimer: null,
    aiSettings: null,
    aiSaveTimer: null,
    remoteBackupSettings: null,
    remoteBackupSaveTimer: null
};

function navEscape(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getAuthHeaderForNav() {
    const token = localStorage.getItem('tools_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function normalizeNavSettings(settings = {}) {
    return {
        primaryIds: Array.isArray(settings.primaryIds) ? settings.primaryIds.map(String) : NAV_DEFAULT_SETTINGS.primaryIds.slice(),
        categories: Array.isArray(settings.categories) && settings.categories.length ? settings.categories : NAV_DEFAULT_SETTINGS.categories.slice(),
        categoryByItem: settings.categoryByItem && typeof settings.categoryByItem === 'object' ? { ...settings.categoryByItem } : { ...NAV_DEFAULT_SETTINGS.categoryByItem },
        itemOrder: Array.isArray(settings.itemOrder) ? settings.itemOrder.map(String) : NAV_DEFAULT_SETTINGS.itemOrder.slice()
    };
}

function getAllNavItems() {
    const customItems = (navState.customTools || []).map(tool => ({
        id: `custom:${tool.slug}`,
        href: tool.href,
        icon: tool.icon || '🧩',
        label: tool.name || '自定义工具',
        defaultCategory: 'custom',
        match: p => p === tool.href || p.startsWith(`${tool.href}/`)
    }));
    return [...NAV_BUILTIN_LINKS, ...customItems];
}

function sortNavItems(items, orderIds) {
    const order = new Map((orderIds || []).map((id, index) => [id, index]));
    return items.slice().sort((a, b) => {
        const ai = order.has(a.id) ? order.get(a.id) : 9999;
        const bi = order.has(b.id) ? order.get(b.id) : 9999;
        if (ai !== bi) return ai - bi;
        return a.label.localeCompare(b.label, 'zh-CN');
    });
}

function renderNavItem(item, className) {
    const path = window.location.pathname;
    return `<a href="${item.href}" class="${className} ${item.match(path) ? 'active' : ''}" data-nav-item-id="${navEscape(item.id)}">${item.icon} ${navEscape(item.label)}</a>`;
}

function renderNavLinksFromState() {
    const primaryEl = document.querySelector('#app-navbar .nav-links');
    const menuEl = document.getElementById('navMoreMenu');
    if (!primaryEl || !menuEl) return;

    const settings = navState.settings;
    const allItems = getAllNavItems();
    const itemById = new Map(allItems.map(item => [item.id, item]));
    const primaryItems = (settings.primaryIds || []).map(id => itemById.get(id)).filter(Boolean);
    const primaryIds = new Set(primaryItems.map(item => item.id));
    const overflowItems = sortNavItems(allItems.filter(item => !primaryIds.has(item.id)), settings.itemOrder);

    primaryEl.innerHTML = primaryItems.map(item => renderNavItem(item, 'nav-link')).join('');

    const categoryMap = new Map((settings.categories || []).map(cat => [cat.id, { ...cat, items: [] }]));
    if (!categoryMap.size) {
        NAV_DEFAULT_SETTINGS.categories.forEach(cat => categoryMap.set(cat.id, { ...cat, items: [] }));
    }
    overflowItems.forEach(item => {
        const catId = settings.categoryByItem[item.id] || item.defaultCategory || 'custom';
        if (!categoryMap.has(catId)) categoryMap.set(catId, { id: catId, name: '未分类', items: [] });
        categoryMap.get(catId).items.push(item);
    });

    const menuHtml = Array.from(categoryMap.values())
        .filter(cat => cat.items.length)
        .map(cat => `
            <div class="nav-more-category">
                <div class="nav-more-section-label">${navEscape(cat.name)}</div>
                ${cat.items.map(item => renderNavItem(item, 'nav-more-item')).join('')}
            </div>
        `).join('');
    menuEl.innerHTML = menuHtml || '<div class="nav-more-empty">暂无更多工具</div>';
}

async function loadNavigationData() {
    try {
        const [settingsRes, toolsRes] = await Promise.all([
            fetch('/api/nav-settings', { headers: getAuthHeaderForNav() }),
            fetch('/api/custom-tools', { headers: getAuthHeaderForNav() })
        ]);
        if (settingsRes.ok) navState.settings = normalizeNavSettings(await settingsRes.json());
        if (toolsRes.ok) navState.customTools = await toolsRes.json();
    } catch (e) {
        console.warn('[Navbar] load navigation data failed:', e);
    }
    renderNavLinksFromState();
    if (document.getElementById('navSettingsModal')) renderNavSettingsContent();
}

function renderNavbar() {
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
        <div class="nav-links"></div>
        <div class="nav-more" id="navMore">
            <button type="button" class="nav-more-btn" id="navMoreBtn" onclick="toggleNavMore(event)">更多工具 ▾</button>
            <div class="nav-more-menu" id="navMoreMenu"></div>
        </div>
        <div style="flex:1"></div>
        
        <div style="display:flex; align-items:center; gap:4px; font-size:11px; font-weight:600; color:#e2e8f0;">
            <a href="/requirements" class="req-btn" style="text-decoration:none; color:#fff; background: linear-gradient(135deg, #00b09b, #96c93d); padding:3px 8px; border-radius:4px; font-size:11px; font-weight:bold; box-shadow:0 2px 4px rgba(0,176,155,0.3); display:flex; align-items:center; gap:4px; transition:transform 0.2s;">🎯 需求</a>
            ${role === 'admin' ? '<button type="button" class="nav-gear-btn" onclick="openNavSettingsModal()" title="全局导航设置">⚙</button>' : ''}
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
    renderNavLinksFromState();
}

window.refreshCustomToolNavLinks = loadNavigationData;

window.toggleNavMore = function (event) {
    event.preventDefault();
    event.stopPropagation();
    document.getElementById('navMore')?.classList.toggle('open');
};

document.addEventListener('click', (event) => {
    const more = document.getElementById('navMore');
    if (more && !more.contains(event.target)) more.classList.remove('open');
});

function scheduleNavSettingsSave() {
    renderNavLinksFromState();
    const indicator = document.getElementById('navSettingsSaveState');
    if (indicator) indicator.textContent = '正在自动保存...';
    clearTimeout(navState.saveTimer);
    navState.saveTimer = setTimeout(async () => {
        try {
            const res = await fetch('/api/nav-settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaderForNav()
                },
                body: JSON.stringify(navState.settings)
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            navState.settings = normalizeNavSettings(await res.json());
            if (indicator) indicator.textContent = '已自动保存';
        } catch (e) {
            if (indicator) indicator.textContent = `保存失败: ${e.message}`;
        }
    }, 420);
}

function moveArrayItem(arr, index, delta) {
    const next = index + delta;
    if (index < 0 || next < 0 || next >= arr.length) return arr;
    const copy = arr.slice();
    const [item] = copy.splice(index, 1);
    copy.splice(next, 0, item);
    return copy;
}

function renderPageSettingsTabs() {
    return NAV_BUILTIN_LINKS.map(item => `
        <button class="nav-settings-tab nav-settings-tab-page" data-tab="page:${navEscape(item.id)}" onclick="switchNavSettingsTab('page:${navEscape(item.id)}')">${item.icon} ${navEscape(item.label)}</button>
    `).join('');
}

function openNavSettingsModal() {
    if (localStorage.getItem('tools_role') !== 'admin') return;
    let modal = document.getElementById('navSettingsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'navSettingsModal';
        modal.className = 'nav-settings-modal';
        modal.innerHTML = `
            <div class="nav-settings-window">
                <div class="nav-settings-sidebar">
                    <div class="nav-settings-title">全局设置</div>
                    <button class="nav-settings-tab active" data-tab="primary" onclick="switchNavSettingsTab('primary')">顶部菜单</button>
                    <button class="nav-settings-tab" data-tab="categories" onclick="switchNavSettingsTab('categories')">二级分类</button>
                    <button class="nav-settings-tab" data-tab="items" onclick="switchNavSettingsTab('items')">分类与顺序</button>
                    <button class="nav-settings-tab" data-tab="ai" onclick="switchNavSettingsTab('ai')">AI 助手</button>
                    <button class="nav-settings-tab" data-tab="backup" onclick="switchNavSettingsTab('backup')">备份恢复</button>
                    <button class="nav-settings-tab" data-tab="accounts" onclick="switchNavSettingsTab('accounts')">账号管理</button>
                    <div class="nav-settings-title nav-settings-section-title">页面配置</div>
                    ${renderPageSettingsTabs()}
                </div>
                <div class="nav-settings-main">
                    <button class="nav-settings-close" onclick="closeNavSettingsModal()">×</button>
                    <div class="nav-settings-head">
                        <div>
                            <div class="nav-settings-heading" id="navSettingsHeading">顶部菜单</div>
                            <div class="nav-settings-subtitle" id="navSettingsSubtitle">修改后会自动保存，并立即影响顶部导航。</div>
                        </div>
                        <div class="nav-settings-save-state" id="navSettingsSaveState">已加载</div>
                    </div>
                    <div id="navSettingsContent"></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    renderNavSettingsContent();
}

function closeNavSettingsModal() {
    const modal = document.getElementById('navSettingsModal');
    if (modal) modal.style.display = 'none';
}

window.openNavSettingsModal = openNavSettingsModal;
window.closeNavSettingsModal = closeNavSettingsModal;

window.switchNavSettingsTab = function (tab) {
    navState.settingsTab = tab;
    document.querySelectorAll('.nav-settings-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    renderNavSettingsContent();
};

function getNavSettingsTitle() {
    if (navState.settingsTab.startsWith('page:')) {
        const pageId = navState.settingsTab.slice(5);
        const item = NAV_BUILTIN_LINKS.find(link => link.id === pageId);
        return item ? `${item.label}配置` : '页面配置';
    }
    if (navState.settingsTab === 'accounts') return '账号管理';
    if (navState.settingsTab === 'ai') return 'AI 助手';
    if (navState.settingsTab === 'backup') return '备份恢复';
    if (navState.settingsTab === 'categories') return '二级分类';
    if (navState.settingsTab === 'items') return '分类与顺序';
    return '顶部菜单';
}

function getNavSettingsSubtitle() {
    if (navState.settingsTab.startsWith('page:')) {
        const pageId = navState.settingsTab.slice(5);
        if (pageId === 'report') return '报表看板相关维护能力，当前支持历史快照冗余清理。';
        return '该页面的配置预留位，后续可把页面内相关设置迁移到这里统一管理。';
    }
    if (navState.settingsTab === 'accounts') return '修改后会自动保存，并立即影响账号权限。';
    if (navState.settingsTab === 'ai') return '修改后会自动保存，并立即影响智能客服助手配置。';
    if (navState.settingsTab === 'backup') return '备份和恢复会覆盖全局配置、数据库、上传附件与自定义工具数据。';
    if (navState.settingsTab === 'categories') return '修改后会自动保存，并立即影响“更多工具”的分类展示。';
    if (navState.settingsTab === 'items') return '修改后会自动保存，并立即影响“更多工具”的分组与排序。';
    return '修改后会自动保存，并立即影响顶部导航。';
}

function renderNavSettingsContent() {
    const content = document.getElementById('navSettingsContent');
    const heading = document.getElementById('navSettingsHeading');
    const subtitle = document.getElementById('navSettingsSubtitle');
    if (!content) return;
    if (heading) heading.textContent = getNavSettingsTitle();
    if (subtitle) subtitle.textContent = getNavSettingsSubtitle();
    if (navState.settingsTab.startsWith('page:')) return renderPageSettings(content, navState.settingsTab.slice(5));
    if (navState.settingsTab === 'accounts') return renderAccountSettings(content);
    if (navState.settingsTab === 'ai') return renderAiSettings(content);
    if (navState.settingsTab === 'backup') return renderBackupSettings(content);
    if (navState.settingsTab === 'categories') return renderCategorySettings(content);
    if (navState.settingsTab === 'items') return renderItemCategorySettings(content);
    renderPrimarySettings(content);
}

function renderPrimarySettings(content) {
    const items = sortNavItems(getAllNavItems(), navState.settings.primaryIds);
    const primaryIds = new Set(navState.settings.primaryIds || []);
    content.innerHTML = `
        <div class="nav-settings-help">勾选后显示在顶部 bar；未勾选的菜单会进入“更多工具”。使用上下按钮调整顶部显示顺序。</div>
        <div class="nav-settings-list">
            ${items.map(item => {
                const index = navState.settings.primaryIds.indexOf(item.id);
                return `
                    <div class="nav-settings-row">
                        <label class="nav-settings-check">
                            <input type="checkbox" ${primaryIds.has(item.id) ? 'checked' : ''} onchange="togglePrimaryNavItem('${navEscape(item.id)}', this.checked)">
                            <span>${item.icon} ${navEscape(item.label)}</span>
                        </label>
                        <div class="nav-settings-actions">
                            <button onclick="movePrimaryNavItem('${navEscape(item.id)}', -1)" ${index <= 0 ? 'disabled' : ''}>上移</button>
                            <button onclick="movePrimaryNavItem('${navEscape(item.id)}', 1)" ${index < 0 || index >= navState.settings.primaryIds.length - 1 ? 'disabled' : ''}>下移</button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

window.togglePrimaryNavItem = function (id, checked) {
    const ids = navState.settings.primaryIds || [];
    if (checked && !ids.includes(id)) ids.push(id);
    if (!checked) navState.settings.primaryIds = ids.filter(item => item !== id);
    else navState.settings.primaryIds = ids;
    renderNavSettingsContent();
    scheduleNavSettingsSave();
};

window.movePrimaryNavItem = function (id, delta) {
    const ids = navState.settings.primaryIds || [];
    const index = ids.indexOf(id);
    navState.settings.primaryIds = moveArrayItem(ids, index, delta);
    renderNavSettingsContent();
    scheduleNavSettingsSave();
};

function renderCategorySettings(content) {
    const categories = navState.settings.categories || [];
    content.innerHTML = `
        <div class="nav-settings-help">分类会显示在“更多工具”下拉菜单中。分类名称修改后自动保存。</div>
        <div class="nav-settings-list">
            ${categories.map((cat, index) => `
                <div class="nav-settings-row">
                    <input class="nav-settings-input" value="${navEscape(cat.name)}" oninput="renameNavCategory('${navEscape(cat.id)}', this.value)">
                    <div class="nav-settings-actions">
                        <button onclick="moveNavCategory(${index}, -1)" ${index === 0 ? 'disabled' : ''}>上移</button>
                        <button onclick="moveNavCategory(${index}, 1)" ${index === categories.length - 1 ? 'disabled' : ''}>下移</button>
                        <button onclick="deleteNavCategory('${navEscape(cat.id)}')" ${categories.length <= 1 ? 'disabled' : ''}>删除</button>
                    </div>
                </div>
            `).join('')}
        </div>
        <button class="nav-settings-add" onclick="addNavCategory()">新增分类</button>
    `;
}

window.renameNavCategory = function (id, name) {
    const cat = (navState.settings.categories || []).find(item => item.id === id);
    if (cat) cat.name = name.trim() || cat.name;
    scheduleNavSettingsSave();
};

window.moveNavCategory = function (index, delta) {
    navState.settings.categories = moveArrayItem(navState.settings.categories || [], index, delta);
    renderNavSettingsContent();
    scheduleNavSettingsSave();
};

window.addNavCategory = function () {
    const id = `cat_${Date.now().toString(36)}`;
    navState.settings.categories.push({ id, name: '新分类' });
    renderNavSettingsContent();
    scheduleNavSettingsSave();
};

window.deleteNavCategory = function (id) {
    const categories = navState.settings.categories || [];
    const fallback = categories.find(item => item.id !== id);
    navState.settings.categories = categories.filter(item => item.id !== id);
    Object.keys(navState.settings.categoryByItem || {}).forEach(itemId => {
        if (navState.settings.categoryByItem[itemId] === id && fallback) {
            navState.settings.categoryByItem[itemId] = fallback.id;
        }
    });
    renderNavSettingsContent();
    scheduleNavSettingsSave();
};

function renderItemCategorySettings(content) {
    const settings = navState.settings;
    const primaryIds = new Set(settings.primaryIds || []);
    const items = sortNavItems(getAllNavItems().filter(item => !primaryIds.has(item.id)), settings.itemOrder);
    const categories = settings.categories || [];
    content.innerHTML = `
        <div class="nav-settings-help">这里管理“更多工具”里的二级分类和分类内顺序。顶部直显菜单不会出现在此列表中。</div>
        <div class="nav-settings-list">
            ${items.map((item, index) => {
                const selected = settings.categoryByItem[item.id] || item.defaultCategory || (categories[0] && categories[0].id) || '';
                return `
                    <div class="nav-settings-row">
                        <div class="nav-settings-item-name">${item.icon} ${navEscape(item.label)}</div>
                        <select class="nav-settings-select" onchange="setNavItemCategory('${navEscape(item.id)}', this.value)">
                            ${categories.map(cat => `<option value="${navEscape(cat.id)}" ${cat.id === selected ? 'selected' : ''}>${navEscape(cat.name)}</option>`).join('')}
                        </select>
                        <div class="nav-settings-actions">
                            <button onclick="moveOverflowNavItem('${navEscape(item.id)}', -1)" ${index === 0 ? 'disabled' : ''}>上移</button>
                            <button onclick="moveOverflowNavItem('${navEscape(item.id)}', 1)" ${index === items.length - 1 ? 'disabled' : ''}>下移</button>
                        </div>
                    </div>
                `;
            }).join('') || '<div class="nav-settings-empty">暂无更多工具菜单。</div>'}
        </div>
    `;
}

window.setNavItemCategory = function (id, categoryId) {
    navState.settings.categoryByItem[id] = categoryId;
    scheduleNavSettingsSave();
};

window.moveOverflowNavItem = function (id, delta) {
    const primaryIds = new Set(navState.settings.primaryIds || []);
    const overflowIds = sortNavItems(getAllNavItems().filter(item => !primaryIds.has(item.id)), navState.settings.itemOrder).map(item => item.id);
    const moved = moveArrayItem(overflowIds, overflowIds.indexOf(id), delta);
    const primaryOrder = new Set(moved);
    const rest = (navState.settings.itemOrder || []).filter(itemId => !primaryOrder.has(itemId));
    navState.settings.itemOrder = [...moved, ...rest];
    renderNavSettingsContent();
    scheduleNavSettingsSave();
};

function sourceLabelForAiSettings(source) {
    if (source === 'stored') return '设置中心保存的 Token';
    if (source === 'env') return '环境变量 GEMINI_API_KEY';
    return '未配置';
}

function keyHealthLabelForAiSettings(settings) {
    if (!settings.hasApiKey) return '尚未配置 Token';
    if (!settings.keyLooksValid) return `格式疑似无效 ${settings.maskedApiKey || ''}`;
    return `已配置 ${settings.maskedApiKey || ''}`;
}

async function fetchAiSettingsForNav() {
    const res = await fetch('/api/ai-settings', { headers: getAuthHeaderForNav() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    navState.aiSettings = await res.json();
    return navState.aiSettings;
}

async function renderAiSettings(content) {
    content.innerHTML = '<div class="nav-settings-empty">正在加载 AI 助手配置...</div>';
    try {
        const settings = await fetchAiSettingsForNav();
        content.innerHTML = `
            <div class="nav-settings-help">这里配置右下角智能客服助手。Token 会保存到服务端，前端只显示脱敏状态；环境变量 GEMINI_API_KEY 仍会作为兜底。</div>
            <div class="nav-ai-status">
                <span>当前 Token 来源：${navEscape(sourceLabelForAiSettings(settings.apiKeySource))}</span>
                <span class="${settings.hasApiKey && !settings.keyLooksValid ? 'warning' : ''}">${navEscape(keyHealthLabelForAiSettings(settings))}</span>
            </div>
            <div class="nav-ai-grid">
                <label class="nav-ai-field nav-ai-field-wide">
                    <span>API Token</span>
                    <div class="nav-ai-token-row">
                        <input id="navAiApiKey" type="text" inputmode="text" class="nav-settings-input nav-ai-token-input" autocomplete="new-password" autocapitalize="off" autocorrect="off" spellcheck="false" data-lpignore="true" data-1p-ignore="true" placeholder="${settings.hasApiKey ? `点击后粘贴新 Token；留空则保持当前：${navEscape(settings.maskedApiKey)}` : '点击后粘贴 Gemini API Token'}" onfocus="this.dataset.userTouched='1'" oninput="scheduleAiSettingsSave({ tokenTouched: this.dataset.userTouched === '1' })">
                        <button type="button" class="nav-settings-add" onclick="clearAiApiKey()">清除 Token</button>
                    </div>
                </label>
                <label class="nav-ai-field">
                    <span>模型名称</span>
                    <input id="navAiModel" class="nav-settings-input" list="navAiModelOptions" value="${navEscape(settings.model)}" oninput="scheduleAiSettingsSave()">
                    <datalist id="navAiModelOptions">
                        <option value="gemini-2.5-flash"></option>
                        <option value="gemini-2.5-pro"></option>
                        <option value="gemini-1.5-flash"></option>
                    </datalist>
                </label>
                <label class="nav-ai-field">
                    <span>Temperature</span>
                    <input id="navAiTemperature" type="number" min="0" max="2" step="0.1" class="nav-settings-input" value="${navEscape(settings.temperature)}" oninput="scheduleAiSettingsSave()">
                </label>
                <label class="nav-ai-field">
                    <span>最大输出 Tokens</span>
                    <input id="navAiMaxTokens" type="number" min="128" max="8192" step="128" class="nav-settings-input" value="${navEscape(settings.maxOutputTokens)}" oninput="scheduleAiSettingsSave()">
                </label>
                <label class="nav-ai-field">
                    <span>输入成本 USD / 1M Tokens</span>
                    <input id="navAiInputCost" type="number" min="0" step="0.001" class="nav-settings-input" value="${navEscape(settings.inputCostPerMillionUsd)}" oninput="scheduleAiSettingsSave()">
                </label>
                <label class="nav-ai-field">
                    <span>输出成本 USD / 1M Tokens</span>
                    <input id="navAiOutputCost" type="number" min="0" step="0.001" class="nav-settings-input" value="${navEscape(settings.outputCostPerMillionUsd)}" oninput="scheduleAiSettingsSave()">
                </label>
                <label class="nav-ai-field">
                    <span>美元兑人民币</span>
                    <input id="navAiUsdToCny" type="number" min="0" step="0.01" class="nav-settings-input" value="${navEscape(settings.usdToCny)}" oninput="scheduleAiSettingsSave()">
                </label>
                <label class="nav-ai-field nav-ai-field-wide">
                    <span>补充系统提示词</span>
                    <textarea id="navAiSystemPrompt" class="nav-ai-textarea" maxlength="5000" placeholder="例如：回答优先使用中文，涉及平台操作时给出步骤。" oninput="scheduleAiSettingsSave()">${navEscape(settings.systemPrompt || '')}</textarea>
                </label>
            </div>
        `;
    } catch (e) {
        content.innerHTML = `<div class="nav-settings-empty">加载 AI 助手配置失败：${navEscape(e.message)}</div>`;
    }
}

function collectAiSettingsPayload(options = {}) {
    const tokenInput = document.getElementById('navAiApiKey');
    const payload = {
        model: document.getElementById('navAiModel')?.value || 'gemini-2.5-flash',
        temperature: document.getElementById('navAiTemperature')?.value || 0.7,
        maxOutputTokens: document.getElementById('navAiMaxTokens')?.value || 2048,
        inputCostPerMillionUsd: document.getElementById('navAiInputCost')?.value || 0.075,
        outputCostPerMillionUsd: document.getElementById('navAiOutputCost')?.value || 0.3,
        usdToCny: document.getElementById('navAiUsdToCny')?.value || 7.2,
        systemPrompt: document.getElementById('navAiSystemPrompt')?.value || ''
    };
    const token = tokenInput ? tokenInput.value.trim() : '';
    if (token) payload.apiKey = token;
    if (options.clearApiKey) payload.clearApiKey = true;
    return payload;
}

async function saveAiSettingsNow(options = {}) {
    const indicator = document.getElementById('navSettingsSaveState');
    if (indicator) indicator.textContent = '正在保存 AI 设置...';
    const res = await fetch('/api/ai-settings', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaderForNav()
        },
        body: JSON.stringify(collectAiSettingsPayload(options))
    });
    if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
            const data = await res.json();
            if (data && data.error) message = data.error;
        } catch (e) { }
        throw new Error(message);
    }
    navState.aiSettings = await res.json();
    const tokenInput = document.getElementById('navAiApiKey');
    if (tokenInput) {
        tokenInput.value = '';
        tokenInput.placeholder = navState.aiSettings.hasApiKey
            ? `留空则保持当前：${navState.aiSettings.maskedApiKey}`
            : '输入 Gemini API Token';
    }
    const status = document.querySelector('.nav-ai-status');
    if (status) {
        status.innerHTML = `
            <span>当前 Token 来源：${navEscape(sourceLabelForAiSettings(navState.aiSettings.apiKeySource))}</span>
            <span class="${navState.aiSettings.hasApiKey && !navState.aiSettings.keyLooksValid ? 'warning' : ''}">${navEscape(keyHealthLabelForAiSettings(navState.aiSettings))}</span>
        `;
    }
    if (indicator) indicator.textContent = 'AI 设置已自动保存';
}

window.scheduleAiSettingsSave = function (options = {}) {
    const tokenInput = document.getElementById('navAiApiKey');
    if (tokenInput && tokenInput.value.trim() && !options.tokenTouched) {
        tokenInput.value = '';
        return;
    }
    const indicator = document.getElementById('navSettingsSaveState');
    if (indicator) indicator.textContent = 'AI 设置待保存...';
    clearTimeout(navState.aiSaveTimer);
    navState.aiSaveTimer = setTimeout(async () => {
        try {
            await saveAiSettingsNow();
        } catch (e) {
            if (indicator) indicator.textContent = `保存失败: ${e.message}`;
        }
    }, 700);
};

window.clearAiApiKey = async function () {
    try {
        clearTimeout(navState.aiSaveTimer);
        await saveAiSettingsNow({ clearApiKey: true });
    } catch (e) {
        const indicator = document.getElementById('navSettingsSaveState');
        if (indicator) indicator.textContent = `清除失败: ${e.message}`;
    }
};

function formatBackupSize(bytes) {
    const size = Number(bytes) || 0;
    if (size >= 1024 * 1024 * 1024) return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`;
    if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} MB`;
    if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${size} B`;
}

function formatBackupTime(value) {
    if (!value) return '-';
    try {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleString('zh-CN', {
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
        });
    } catch (e) {
        return value;
    }
}

function getLocalTimeZoneLabel() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || '浏览器本地时区';
    } catch (e) {
        return '浏览器本地时区';
    }
}

async function fetchBackupList() {
    const res = await fetch('/api/global-backup/list', { headers: getAuthHeaderForNav() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function fetchRemoteBackupSettings() {
    const res = await fetch('/api/global-backup/remote-settings', { headers: getAuthHeaderForNav() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

function renderRemoteBackupSyncSettings(settings = {}) {
    const lastSync = settings.lastSync || {};
    const lastRemote = lastSync.remoteBackup || {};
    const lastCheck = settings.lastCheck || {};
    const checkLatest = lastCheck.latest || {};
    const lastSyncText = lastSync.restoredAt
        ? `${formatBackupTime(lastSync.restoredAt)} · ${lastRemote.name || '-'}`
        : '尚未恢复远端备份';
    const lastCheckText = lastCheck.checkedAt
        ? `${formatBackupTime(lastCheck.checkedAt)} · 最新：${checkLatest.name || '-'}`
        : '尚未检查远端';
    return `
        <div class="nav-remote-backup-card">
            <div class="nav-remote-backup-head">
                <div>
                    <div class="nav-backup-panel-title">远端主站同步</div>
                    <div class="nav-backup-panel-desc">适合分站/Windows 本地启动时，从主站自动拉取最新全局备份并恢复。配置只保存在当前机器，不会被备份包覆盖。</div>
                </div>
                <label class="nav-remote-switch">
                    <input id="remoteBackupEnabled" type="checkbox" ${settings.enabled ? 'checked' : ''} onchange="scheduleRemoteBackupSettingsSave()">
                    启用
                </label>
            </div>
            <div class="nav-remote-backup-grid">
                <label>
                    <span>远端网站域名</span>
                    <input id="remoteBackupBaseUrl" class="nav-settings-input" value="${navEscape(settings.baseUrl || '')}" placeholder="例如：https://cs.fanxiaolong.uk" oninput="scheduleRemoteBackupSettingsSave()">
                </label>
                <label>
                    <span>账号</span>
                    <input id="remoteBackupUsername" class="nav-settings-input" value="${navEscape(settings.username || '')}" autocomplete="username" oninput="scheduleRemoteBackupSettingsSave()">
                </label>
                <label>
                    <span>密码</span>
                    <input id="remoteBackupPassword" type="password" class="nav-settings-input" autocomplete="new-password" data-lpignore="true" data-1p-ignore="true" placeholder="${settings.hasPassword ? `留空保持当前：${navEscape(settings.maskedPassword || '已保存')}` : '填写远端登录密码'}" onfocus="this.dataset.userTouched='1'" oninput="scheduleRemoteBackupSettingsSave({ passwordTouched: this.dataset.userTouched === '1' })">
                </label>
                <div class="nav-remote-checks">
                    <label><input id="remoteBackupCompare" type="checkbox" ${settings.compareBeforeRestore !== false ? 'checked' : ''} onchange="scheduleRemoteBackupSettingsSave()"> 比较备份新旧，未更新则跳过</label>
                    <label><input id="remoteBackupCreateBeforePull" type="checkbox" ${settings.createRemoteBackupBeforePull !== false ? 'checked' : ''} onchange="scheduleRemoteBackupSettingsSave()"> 拉取前请求主站立即生成备份</label>
                    <label><input id="remoteBackupAutoRestore" type="checkbox" ${settings.autoRestore ? 'checked' : ''} onchange="scheduleRemoteBackupSettingsSave()"> 启动时自动恢复最新备份</label>
                </div>
            </div>
            <div class="nav-remote-backup-status">
                <span>时间显示：浏览器本地时区（${navEscape(getLocalTimeZoneLabel())}）</span>
                <span>最近检查：${navEscape(lastCheckText)}</span>
                <span>最近恢复：${navEscape(lastSyncText)}</span>
                ${settings.lastError ? `<span class="warning">最近错误：${navEscape(settings.lastError)}</span>` : ''}
            </div>
            <div class="nav-backup-toolbar nav-remote-backup-actions">
                <button type="button" onclick="checkRemoteBackupNow()">测试连接/检查最新</button>
                <button type="button" onclick="pullRemoteBackupNow(false)">按规则拉取恢复</button>
                <button type="button" class="danger" onclick="pullRemoteBackupNow(true)">强制恢复远端最新</button>
                <button type="button" onclick="clearRemoteBackupPassword()">清除密码</button>
            </div>
        </div>
    `;
}

async function renderBackupSettings(content) {
    content.innerHTML = '<div class="nav-settings-empty">正在加载备份列表...</div>';
    try {
        const [data, remoteSettings] = await Promise.all([
            fetchBackupList(),
            fetchRemoteBackupSettings()
        ]);
        navState.remoteBackupSettings = remoteSettings;
        const targetText = (data.targets || []).map(item => item.relPath || item.path).join('、') || 'backend/data、data';
        const rows = (data.backups || []).map(item => `
            <tr>
                <td>
                    <div class="nav-backup-name">
                        ${navEscape(item.name)}
                        ${item.triggerType === 'remote-sync-request' ? '<span class="nav-backup-badge remote">外部同步触发</span>' : ''}
                        ${item.triggerType === 'pre-restore' ? '<span class="nav-backup-badge safety">恢复前安全备份</span>' : ''}
                    </div>
                    <div class="nav-backup-meta">${formatBackupTime(item.modifiedAt)} · ${formatBackupSize(item.size)}</div>
                    ${item.reason ? `<div class="nav-backup-meta">Reason: ${navEscape(item.reason)}</div>` : ''}
                </td>
                <td class="nav-backup-actions">
                    <button onclick="downloadGlobalBackup('${navEscape(item.name)}')">下载</button>
                    <button class="danger" onclick="restoreGlobalBackupFromServer('${navEscape(item.name)}')">恢复</button>
                    <button class="danger" style="background:#fff3e0; color:#e65100; border-color:#ffe0b2;" onclick="deleteGlobalBackup('${navEscape(item.name)}')">删除</button>
                </td>
            </tr>
        `).join('');

        content.innerHTML = `
            <div class="nav-settings-help">覆盖范围：${navEscape(targetText)}。包含全局配置、JSON 数据、SQLite 数据库、上传附件、自定义工具 HTML 等运行数据。</div>
            ${renderRemoteBackupSyncSettings(remoteSettings)}
            <div class="nav-backup-panel">
                <div>
                    <div class="nav-backup-panel-title">服务器备份</div>
                    <div class="nav-backup-panel-desc">生成后会保存在服务器，也可以直接下载到本地留档。</div>
                </div>
                <div class="nav-backup-toolbar">
                    <button onclick="createGlobalBackup(false)">生成服务器备份</button>
                    <button onclick="createGlobalBackup(true)">生成并下载</button>
                </div>
            </div>
            <div class="nav-backup-upload">
                <div>
                    <div class="nav-backup-panel-title">上传备份包恢复</div>
                    <div class="nav-backup-panel-desc">仅接受平台生成的全局备份 zip 包；恢复前会自动创建 pre-restore 安全备份。</div>
                </div>
                <input id="globalBackupUploadInput" type="file" accept=".zip,application/zip">
                <button class="danger" onclick="restoreGlobalBackupFromUpload()">上传并恢复</button>
            </div>
            <div class="nav-account-table-wrap">
                <table class="nav-account-table nav-backup-table">
                    <thead><tr><th>备份文件</th><th>操作</th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="2">暂无服务器备份</td></tr>'}</tbody>
                </table>
            </div>
        `;
    } catch (e) {
        content.innerHTML = `<div class="nav-settings-empty">加载备份列表失败：${navEscape(e.message)}</div>`;
    }
}

function collectRemoteBackupSettings(options = {}) {
    const passwordInput = document.getElementById('remoteBackupPassword');
    const payload = {
        enabled: Boolean(document.getElementById('remoteBackupEnabled')?.checked),
        baseUrl: document.getElementById('remoteBackupBaseUrl')?.value || '',
        username: document.getElementById('remoteBackupUsername')?.value || '',
        compareBeforeRestore: Boolean(document.getElementById('remoteBackupCompare')?.checked),
        createRemoteBackupBeforePull: Boolean(document.getElementById('remoteBackupCreateBeforePull')?.checked),
        autoRestore: Boolean(document.getElementById('remoteBackupAutoRestore')?.checked)
    };
    if (options.clearPassword) {
        payload.clearPassword = true;
    } else if (options.passwordTouched && passwordInput) {
        payload.password = passwordInput.value || '';
    }
    return payload;
}

async function saveRemoteBackupSettingsNow(options = {}) {
    const res = await fetch('/api/global-backup/remote-settings', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaderForNav()
        },
        body: JSON.stringify(collectRemoteBackupSettings(options))
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    navState.remoteBackupSettings = data;
    const indicator = document.getElementById('navSettingsSaveState');
    if (indicator) indicator.textContent = '远端同步设置已保存';
    return data;
}

window.scheduleRemoteBackupSettingsSave = function (options = {}) {
    const indicator = document.getElementById('navSettingsSaveState');
    if (indicator) indicator.textContent = '正在保存远端同步设置...';
    clearTimeout(navState.remoteBackupSaveTimer);
    navState.remoteBackupSaveTimer = setTimeout(async () => {
        try {
            await saveRemoteBackupSettingsNow(options);
        } catch (e) {
            if (indicator) indicator.textContent = `保存失败: ${e.message}`;
        }
    }, 650);
};

window.clearRemoteBackupPassword = async function () {
    await runGlobalBackupAction('正在清除远端密码...', async () => {
        await saveRemoteBackupSettingsNow({ clearPassword: true });
    });
    renderNavSettingsContent();
};

window.checkRemoteBackupNow = async function () {
    clearTimeout(navState.remoteBackupSaveTimer);
    await saveRemoteBackupSettingsNow();
    const result = await runGlobalBackupAction('正在检查远端备份...', async () => {
        const res = await fetch('/api/global-backup/remote-check', {
            method: 'POST',
            headers: getAuthHeaderForNav()
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        return data;
    });
    const latest = result.latest || {};
    alert(`远端连接成功。\n\n${result.remoteCreatedBackup?.name ? `已请求主站生成新备份：${result.remoteCreatedBackup.name}\n` : ''}备份数量：${result.backups?.length || 0}\n最新备份：${latest.name || '-'}\n时间：${formatBackupTime(latest.modifiedAt || latest.createdAt)}`);
    renderNavSettingsContent();
};

window.pullRemoteBackupNow = async function (force) {
    clearTimeout(navState.remoteBackupSaveTimer);
    await saveRemoteBackupSettingsNow();
    const ok = confirm(`${force ? '确定要强制恢复远端最新备份吗？' : '确定要按规则拉取并恢复远端备份吗？'}\n\n此操作会覆盖当前全部本地数据。恢复成功后服务会自动重启或需要手动重启。`);
    if (!ok) return;
    await runGlobalBackupAction('正在拉取远端备份并恢复...', async () => {
        const res = await fetch('/api/global-backup/remote-pull', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaderForNav()
            },
            body: JSON.stringify({ restore: true, force })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        if (data.restored) {
            alert(`远端备份恢复完成：${data.latest?.name || '-'}\n\n服务将自动重启；如果是手动 npm start，请重新启动服务。`);
        } else {
            alert(data.message || '远端备份未更新，未执行恢复。');
        }
        return data;
    });
};

async function runGlobalBackupAction(actionText, action) {
    const indicator = document.getElementById('navSettingsSaveState');
    if (indicator) indicator.textContent = actionText;
    try {
        const result = await action();
        if (indicator) indicator.textContent = '操作完成';
        return result;
    } catch (e) {
        if (indicator) indicator.textContent = `操作失败: ${e.message}`;
        alert(`操作失败：${e.message}`);
        throw e;
    }
}

window.createGlobalBackup = async function (downloadAfterCreate) {
    const result = await runGlobalBackupAction('正在生成备份...', async () => {
        const res = await fetch('/api/global-backup/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaderForNav()
            },
            body: JSON.stringify({ reason: 'manual' })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    });
    if (downloadAfterCreate && result?.name) {
        await downloadGlobalBackupFile(result.name);
    }
    renderNavSettingsContent();
};

async function downloadGlobalBackupFile(name) {
    const res = await fetch(`/api/global-backup/download/${encodeURIComponent(name)}`, {
        headers: getAuthHeaderForNav()
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const contentLength = res.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    
    let loaded = 0;
    const reader = res.body.getReader();
    const chunks = [];
    const indicator = document.getElementById('navSettingsSaveState');
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        if (indicator) {
            if (total) {
                const percent = Math.round((loaded / total) * 100);
                indicator.textContent = `正在下载... ${percent}% (${formatBackupSize(loaded)} / ${formatBackupSize(total)})`;
            } else {
                indicator.textContent = `正在下载... 已接收 ${formatBackupSize(loaded)}`;
            }
        }
    }
    
    const blob = new Blob(chunks, { type: res.headers.get('content-type') || 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

window.downloadGlobalBackup = async function (name) {
    await runGlobalBackupAction('正在下载备份...', () => downloadGlobalBackupFile(name));
};

window.deleteGlobalBackup = async function (name) {
    const ok = confirm(`确定要永久删除备份文件吗？\n\n${name}`);
    if (!ok) return;
    await runGlobalBackupAction('正在删除备份...', async () => {
        const res = await fetch(`/api/global-backup/delete/${encodeURIComponent(name)}`, {
            method: 'DELETE',
            headers: getAuthHeaderForNav()
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        return data;
    });
    renderNavSettingsContent();
};

window.restoreGlobalBackupFromServer = async function (name) {
    const ok = confirm(`确定要从服务器备份恢复吗？\n\n${name}\n\n此操作会覆盖当前全局配置和全部数据。系统会先自动生成恢复前安全备份。`);
    if (!ok) return;
    await runGlobalBackupAction('正在从服务器备份恢复...', async () => {
        const res = await fetch(`/api/global-backup/restore/server/${encodeURIComponent(name)}`, {
            method: 'POST',
            headers: getAuthHeaderForNav()
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        alert(`恢复完成。恢复前安全备份：${data.safetyBackup?.name || '-'}\n\n建议重启服务或刷新页面，确保 SQLite 连接重新加载。`);
        return data;
    });
    renderNavSettingsContent();
};

window.restoreGlobalBackupFromUpload = async function () {
    const input = document.getElementById('globalBackupUploadInput');
    const file = input && input.files && input.files[0];
    if (!file) return alert('请先选择备份 zip 包');
    const ok = confirm(`确定要上传并恢复这个备份包吗？\n\n${file.name}\n\n此操作会覆盖当前全局配置和全部数据。系统会先自动生成恢复前安全备份。`);
    if (!ok) return;
    
    const indicator = document.getElementById('navSettingsSaveState');
    if (indicator) indicator.textContent = '准备上传备份...';
    
    try {
        const data = await new Promise((resolve, reject) => {
            const form = new FormData();
            form.append('backup', file);
            
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/global-backup/restore/upload', true);
            
            const headers = getAuthHeaderForNav();
            Object.keys(headers).forEach(key => {
                xhr.setRequestHeader(key, headers[key]);
            });
            
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable && indicator) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    indicator.textContent = `正在上传并解压... ${percent}% (${formatBackupSize(e.loaded)} / ${formatBackupSize(e.total)})`;
                }
            };
            
            xhr.onload = () => {
                let resData = {};
                try { resData = JSON.parse(xhr.responseText); } catch (err) {}
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(resData);
                } else {
                    reject(new Error(resData.error || `HTTP ${xhr.status}`));
                }
            };
            
            xhr.onerror = () => reject(new Error('网络请求失败'));
            xhr.send(form);
        });
        
        if (indicator) indicator.textContent = '操作完成';
        alert(`恢复完成。恢复前安全备份：${data.safetyBackup?.name || '-'}\n\n建议重启服务或刷新页面，确保 SQLite 连接重新加载。`);
    } catch (e) {
        if (indicator) indicator.textContent = `操作失败: ${e.message}`;
        alert(`操作失败：${e.message}`);
    }
    renderNavSettingsContent();
};

function renderPageSettings(content, pageId) {
    if (pageId === 'report') return renderReportPageSettings(content);
    const item = NAV_BUILTIN_LINKS.find(link => link.id === pageId);
    content.innerHTML = `
        <div class="nav-page-config-placeholder">
            <div class="nav-page-config-icon">${item?.icon || '🧩'}</div>
            <div>
                <div class="nav-page-config-title">${navEscape(item?.label || '页面')}配置预留位</div>
                <div class="nav-page-config-desc">当前暂无需要迁移到全局设置的配置项。后续如果该页面新增全局级设置，可以直接放在这里。</div>
            </div>
        </div>
    `;
}

function renderReportPageSettings(content) {
    content.innerHTML = `
        <div class="nav-settings-help">清理“历史快照 (Snapshot)”中最近 X 天内的同日冗余快照，仅保留每天最新一份。较早日期和每天最新快照都会保留，不影响月报、一键催办等按日读取最新快照的业务。</div>
        <div class="nav-report-cleanup-card">
            <div class="nav-report-cleanup-main">
                <div class="nav-backup-panel-title">历史快照冗余清理</div>
                <div class="nav-backup-panel-desc">建议先“预览影响”，确认要删除的数量后再执行清理。</div>
                <label class="nav-report-cleanup-field">
                    <span>清理最近</span>
                    <input id="reportSnapshotCleanupDays" type="number" min="1" max="3650" step="1" value="30">
                    <span>天内冗余快照</span>
                </label>
            </div>
            <div class="nav-backup-toolbar">
                <button onclick="previewReportSnapshotCleanup()">预览影响</button>
                <button class="danger" onclick="runReportSnapshotCleanup()">执行清理</button>
            </div>
        </div>
        <div id="reportSnapshotCleanupResult" class="nav-report-cleanup-result">等待预览。</div>
    `;
}

function getReportSnapshotCleanupDays() {
    const input = document.getElementById('reportSnapshotCleanupDays');
    return Math.max(1, Math.min(3650, parseInt(input?.value, 10) || 30));
}

function renderReportSnapshotCleanupResult(result) {
    const el = document.getElementById('reportSnapshotCleanupResult');
    if (!el) return;
    const removedPreview = (result.removed || []).slice(0, 8)
        .map(item => `<li>${navEscape(item.date || '-')} · ${navEscape(item.timestamp || '-')} · ${navEscape(item.id || '-')}</li>`)
        .join('');
    el.innerHTML = `
        <div><strong>${result.dryRun ? '预览结果' : '清理完成'}</strong></div>
        <div>范围：最近 ${result.days} 天；清理前 ${result.beforeCount} 条，清理后 ${result.afterCount} 条，预计/实际删除 ${result.removedCount} 条。</div>
        <div>保留的最近日期每日最新快照：${result.keptDailyCount} 天。</div>
        ${removedPreview ? `<ul>${removedPreview}</ul>` : '<div>没有需要清理的冗余快照。</div>'}
        ${result.removedCount > 8 ? `<div>仅展示前 8 条，剩余 ${result.removedCount - 8} 条未展开。</div>` : ''}
    `;
}

async function requestReportSnapshotCleanup(dryRun) {
    const res = await fetch('/api/sla/snapshots/cleanup-redundant', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaderForNav()
        },
        body: JSON.stringify({
            days: getReportSnapshotCleanupDays(),
            dryRun
        })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}

window.previewReportSnapshotCleanup = async function () {
    await runGlobalBackupAction('正在预览快照清理...', async () => {
        const result = await requestReportSnapshotCleanup(true);
        renderReportSnapshotCleanupResult(result);
        return result;
    });
};

window.runReportSnapshotCleanup = async function () {
    const days = getReportSnapshotCleanupDays();
    const preview = await requestReportSnapshotCleanup(true);
    renderReportSnapshotCleanupResult(preview);
    if (!preview.removedCount) return alert('没有需要清理的冗余快照。');
    const ok = confirm(`确定清理最近 ${days} 天内的 ${preview.removedCount} 条冗余快照吗？\n\n规则：每天只保留最新一份快照。`);
    if (!ok) return;
    await runGlobalBackupAction('正在清理冗余快照...', async () => {
        const result = await requestReportSnapshotCleanup(false);
        renderReportSnapshotCleanupResult(result);
        return result;
    });
};

async function renderAccountSettings(content) {
    content.innerHTML = '<div class="nav-settings-empty">正在加载账号列表...</div>';
    try {
        const users = await API.get('/api/auth/users');
        const rows = users.map(u => {
            const roleBadge = u.role === 'admin'
                ? '<span class="nav-account-role admin">超级管理</span>'
                : '<span class="nav-account-role readonly">只读用户</span>';
            return `
                <tr>
                    <td>${navEscape(u.username)}</td>
                    <td>${roleBadge}</td>
                    <td class="nav-account-actions">
                        ${u.username !== 'admin' ? `<button onclick="deleteUser('${navEscape(u.username)}')">删除</button>` : ''}
                        <button onclick="resetPwd('${navEscape(u.username)}')">重置密码</button>
                    </td>
                </tr>
            `;
        }).join('');

        content.innerHTML = `
            <div class="nav-settings-help">账号权限用于控制平台写入类操作。新增或调整后立即生效。</div>
            <div class="nav-account-create">
                <input id="nu_name" placeholder="输入新用户名">
                <input id="nu_pwd" placeholder="设置密码" type="password">
                <select id="nu_role">
                    <option value="readonly">只读权限</option>
                    <option value="admin">超级管理</option>
                </select>
                <button onclick="addUser()">新增账号</button>
            </div>
            <div class="nav-account-table-wrap">
                <table class="nav-account-table">
                    <thead>
                        <tr><th>账号名称</th><th>权限角色</th><th>快捷操作</th></tr>
                    </thead>
                    <tbody>${rows || '<tr><td colspan="3">暂无账号</td></tr>'}</tbody>
                </table>
            </div>
        `;
    } catch (e) {
        content.innerHTML = `<div class="nav-settings-empty">加载账号失败：${navEscape(e.message)}</div>`;
    }
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
        if (document.getElementById('navSettingsModal')?.style.display === 'flex') renderNavSettingsContent();
        else openUserModal();
    } catch (e) { alert(e.message); }
};
window.deleteUser = async function (u) {
    if (!confirm('确定删除?')) return;
    try {
        await API.delete('/api/auth/users/' + u);
        if (document.getElementById('navSettingsModal')?.style.display === 'flex') renderNavSettingsContent();
        else openUserModal();
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
    loadNavigationData();
    setTimeout(checkServerStatus, 500);
});
