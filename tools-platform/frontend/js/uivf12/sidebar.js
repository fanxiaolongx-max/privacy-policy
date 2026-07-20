/**
 * uivf12/sidebar.js - 侧边栏分类脚本仓库模块
 * 负责：加载脚本数据、渲染折叠分类列表、拖拽分类、双击回填等
 */

const DEFAULT_CATEGORIES = ['DataFab', 'NetCare中国', 'NetCare中东', 'NetCare德国', '默认分类'];

// 展开状态仅保留在内存（不再用 localStorage，服务端不存此状态）
let expandedCategories = [];
let draggedScriptId = null;
let lastScripts = [];
let lastCategories = [];

function logSidebarStep(step, detail) {
    const prefix = '%c[UIVF12 Sidebar]';
    const style = 'color:#38bdf8;font-weight:700;';
    if (detail === undefined) {
        console.info(prefix, style, step);
        return;
    }
    console.info(prefix, style, step, detail);
}

function logSidebarError(step, error, detail) {
    const prefix = '%c[UIVF12 Sidebar]';
    const style = 'color:#ef4444;font-weight:700;';
    console.error(prefix, style, `${step} failed`, detail || '', error);
}

function formatSourceLabel(source) {
    return window.UIVI18n ? UIVI18n.sourceLabel(source) : (source || '-');
}

function renderRepositorySource() {
    const panel = document.getElementById('repoSourcePanel');
    if (!panel) return;
    panel.dataset.loaded = '1';

    const mode = API.getSourceMode('uiv_repository');
    const query = mode === 'auto' ? '' : `?mode=${encodeURIComponent(mode)}`;
    const meta = API.getLastDataSourceMeta(`/api/uiv/scripts${query}`) || API.getLastDataSourceMeta('/api/uiv/scripts') || {};
    const scriptSource = formatSourceLabel(meta.primary);
    const categorySource = formatSourceLabel(meta.extras ? meta.extras.categories : null);

    panel.innerHTML = `
        <span class="repo-source-badge">${UIVT('uiv.source.script', { source: scriptSource })}</span>
        <span class="repo-source-badge">${UIVT('uiv.source.category', { source: categorySource })}</span>
        <span class="repo-source-note">${UIVT('uiv.source.currentNote', { mode: formatSourceLabel(mode) })}</span>
    `;
}

// ──────────────────────────────────────────────────────────
// 数据加载
// ──────────────────────────────────────────────────────────
async function loadSavedScripts(options = {}) {
    try {
        const mode = API.getSourceMode('uiv_repository');
        const query = mode === 'auto' ? '' : `?mode=${encodeURIComponent(mode)}`;
        logSidebarStep('开始加载侧边栏脚本仓库', {
            mode,
            query: query || '(auto)',
            reason: options.reason || 'direct'
        });
        const { scripts, categories } = await API.get(`/api/uiv/scripts${query}`);
        lastScripts = scripts || [];
        lastCategories = categories || [];
        logSidebarStep('脚本仓库接口返回成功', {
            scriptCount: scripts.length,
            categoryCount: categories.length,
            categoryBreakdown: categories.map(catName => ({
                category: catName,
                count: scripts.filter(s => s.category === catName).length
            }))
        });
        renderRepositorySource();
        renderSidebar(lastScripts, lastCategories);
        logSidebarStep('侧边栏渲染完成', {
            expandedCategories: [...expandedCategories]
        });
    } catch (e) {
        logSidebarError('加载侧边栏脚本仓库', e, {
            reason: options.reason || 'direct'
        });
        renderRepositorySource();
        showToast(UIVT('uiv.toast.serverFail'), 'error');
        throw e;
    }
}

// ──────────────────────────────────────────────────────────
// 渲染侧边栏
// ──────────────────────────────────────────────────────────
function renderSidebar(scripts, categories) {
    const list = document.getElementById('scriptList');
    list.innerHTML = '';

    categories.forEach(catName => {
        const catScripts = scripts.filter(s => s.category === catName);
        const isCustom = !DEFAULT_CATEGORIES.includes(catName);

        const groupDiv = document.createElement('div');
        groupDiv.className = 'category-group';
        if (expandedCategories.includes(catName)) groupDiv.classList.add('expanded');

        // 拖拽目标
        groupDiv.addEventListener('dragover', e => { e.preventDefault(); groupDiv.classList.add('drag-over'); });
        groupDiv.addEventListener('dragleave', () => groupDiv.classList.remove('drag-over'));
        groupDiv.addEventListener('drop', async e => {
            e.preventDefault();
            groupDiv.classList.remove('drag-over');
            if (draggedScriptId) {
                try {
                    await API.patch(`/api/uiv/scripts/${draggedScriptId}/category`, { category: catName });
                    if (!expandedCategories.includes(catName)) expandedCategories.push(catName);
                    await loadSavedScripts();
                } catch (err) {
                    showToast(UIVT('uiv.toast.moveFail'), 'error');
                }
            }
        });

        // 分类头
        const headerDiv = document.createElement('div');
        headerDiv.className = 'category-header';
        headerDiv.onclick = e => {
            if (e.target.tagName === 'BUTTON') return;
            groupDiv.classList.toggle('expanded');
            if (groupDiv.classList.contains('expanded')) {
                if (!expandedCategories.includes(catName)) expandedCategories.push(catName);
            } else {
                expandedCategories = expandedCategories.filter(c => c !== catName);
            }
        };

        const titleSpan = document.createElement('span');
        titleSpan.className = 'cat-title';
        titleSpan.innerHTML = `<span class="cat-arrow">▶</span> 📂 ${UIVI18n.categoryLabel(catName)} <span style="color:#aaa;font-weight:normal;">(${catScripts.length})</span>`;

        const actionSpan = document.createElement('div');
        actionSpan.className = 'category-actions';

        if (catScripts.length > 0) {
            const copyCatBtn = document.createElement('button');
            copyCatBtn.className = 'cat-copy-btn';
            copyCatBtn.innerHTML = '📦';
            copyCatBtn.title = UIVT('uiv.category.copyTitle');
            copyCatBtn.onclick = e => { e.stopPropagation(); window.UIVBatch.buildAndCopyMasterScript(catScripts, UIVI18n.categoryLabel(catName)); };
            actionSpan.appendChild(copyCatBtn);
        }

        if (isCustom) {
            const delCatBtn = document.createElement('button');
            delCatBtn.className = 'cat-del-btn';
            delCatBtn.innerHTML = '✖';
            delCatBtn.title = UIVT('uiv.category.deleteTitle');
            delCatBtn.onclick = e => { e.stopPropagation(); deleteCategory(catName); };
            actionSpan.appendChild(delCatBtn);
        }

        headerDiv.appendChild(titleSpan);
        headerDiv.appendChild(actionSpan);
        groupDiv.appendChild(headerDiv);

        // 分类内容
        const contentDiv = document.createElement('div');
        contentDiv.className = 'category-content';

        if (catScripts.length === 0) {
            contentDiv.innerHTML = `<div style="color:#666;font-size:11px;text-align:center;padding:5px;">${UIVT('uiv.category.empty')}</div>`;
        }

        catScripts.forEach(script => {
            const item = buildScriptItem(script);
            contentDiv.appendChild(item);
        });

        groupDiv.appendChild(contentDiv);
        list.appendChild(groupDiv);
    });
}

// ──────────────────────────────────────────────────────────
// 构建单个脚本条目
// ──────────────────────────────────────────────────────────
function buildScriptItem(script) {
    const item = document.createElement('div');
    item.className = 'script-item';
    item.draggable = true;
    item.title = UIVT('uiv.script.itemTitle');

    item.addEventListener('dragstart', e => {
        draggedScriptId = script.id;
        setTimeout(() => item.style.opacity = '0.5', 0);
    });
    item.addEventListener('dragend', () => {
        draggedScriptId = null;
        item.style.opacity = '1';
    });

    item.addEventListener('dblclick', e => {
        if (e.target.tagName === 'BUTTON') return;
        window.UIVWorkbench.fillWorkbench(script);
        const orig = item.style.backgroundColor;
        item.style.backgroundColor = '#2e7d32';
        setTimeout(() => item.style.backgroundColor = orig, 300);
        showToast(UIVT('uiv.toast.filled', { name: script.name }));
    });

    const itemTitle = document.createElement('div');
    itemTitle.className = 'script-item-title';
    itemTitle.innerText = '📄 ' + script.name;

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'sidebar-actions';

    const btnGroup = document.createElement('div');
    btnGroup.style.cssText = 'display:flex;gap:5px;';

    const uivBtn = document.createElement('button');
    uivBtn.className = 'mini-btn uiv';
    uivBtn.innerText = 'UIV';
    uivBtn.onclick = () => window.UIVCopy.copyFromMemory(script.code, 'UI.Vision');

    const conBtn = document.createElement('button');
    conBtn.className = 'mini-btn con';
    conBtn.innerText = 'F12';
    conBtn.onclick = () => {
        if (script.consoleCode) window.UIVCopy.copyFromMemory(script.consoleCode, UIVT('uiv.copy.consoleScript'));
        else alert(UIVT('uiv.alert.legacyScript'));
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'mini-btn del';
    delBtn.innerHTML = '✖';
    delBtn.onclick = async () => {
        if (confirm(UIVT('uiv.confirm.deleteScript', { name: script.name }))) {
            try {
                await API.delete(`/api/uiv/scripts/${script.id}`);
                await loadSavedScripts();
                showToast(UIVT('uiv.toast.scriptDeleted'));
                API.logHistory('uiv', '删除脚本', script.name);
            } catch (err) {
                showToast(UIVT('uiv.toast.deleteFail'), 'error');
            }
        }
    };

    btnGroup.appendChild(uivBtn);
    btnGroup.appendChild(conBtn);
    actionsDiv.appendChild(btnGroup);
    actionsDiv.appendChild(delBtn);
    item.appendChild(itemTitle);
    item.appendChild(actionsDiv);
    return item;
}

// ──────────────────────────────────────────────────────────
// 分类操作
// ──────────────────────────────────────────────────────────
async function createNewCategory() {
    const newCat = prompt(UIVT('uiv.prompt.newCategory'));
    if (!newCat || !newCat.trim()) return;
    try {
        await API.post('/api/uiv/categories', { name: newCat.trim() });
        if (!expandedCategories.includes(newCat.trim())) expandedCategories.push(newCat.trim());
        await loadSavedScripts();
        showToast(UIVT('uiv.toast.categoryCreated'));
    } catch (e) {
        showToast(UIVT('uiv.toast.createFail'), 'error');
    }
}

async function deleteCategory(catName) {
    if (!confirm(UIVT('uiv.confirm.deleteCategory', { name: UIVI18n.categoryLabel(catName) }))) return;
    try {
        await API.delete(`/api/uiv/categories/${encodeURIComponent(catName)}`);
        expandedCategories = expandedCategories.filter(c => c !== catName);
        await loadSavedScripts();
        showToast(UIVT('uiv.toast.categoryDeleted'));
    } catch (e) {
        showToast(UIVT('uiv.toast.deleteFail'), 'error');
    }
}

// ──────────────────────────────────────────────────────────
// 导入 / 导出
// ──────────────────────────────────────────────────────────
async function exportBackup() {
    try {
        const data = await API.get('/api/uiv/backup');
        if (data.scripts.length === 0 && (!data.categories || data.categories.length === 0)) {
            alert(UIVT('uiv.alert.emptyExport')); return;
        }
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = UIVT('uiv.export.filename', { date: dateStr });
        a.click();
        showToast(UIVT('uiv.toast.exported'));
        API.logHistory('uiv', '导出脚本', `共 ${data.scripts.length} 个脚本`);
    } catch (e) {
        showToast(UIVT('uiv.toast.exportFail'), 'error');
    }
}

async function importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
        try {
            const parsed = JSON.parse(e.target.result);
            if (!Array.isArray(parsed.scripts)) { alert(UIVT('uiv.alert.invalidBackup')); return; }
            const merge = confirm(UIVT('uiv.confirm.importMode'));
            await API.post('/api/uiv/backup', { scripts: parsed.scripts, categories: parsed.categories, merge });
            await loadSavedScripts();
            showToast(UIVT('uiv.toast.imported'));
            API.logHistory('uiv', merge ? '融合导入' : '覆盖导入', `共 ${parsed.scripts.length} 个脚本`);
        } catch (err) {
            alert(UIVT('uiv.alert.importFail'));
        }
        event.target.value = '';
    };
    reader.readAsText(file);
}

// 暴露给全局
function refreshI18n() {
    renderRepositorySource();
    if (lastCategories.length) renderSidebar(lastScripts, lastCategories);
}

function getScripts() {
    return Array.isArray(lastScripts) ? [...lastScripts] : [];
}

function getCategories() {
    return Array.isArray(lastCategories) ? [...lastCategories] : [];
}

function refillScript(scriptId) {
    const script = lastScripts.find(item => item.id === scriptId);
    if (!script) return false;
    window.UIVWorkbench.fillWorkbench(script);
    showToast(UIVT('uiv.toast.filled', { name: script.name }));
    return true;
}

window.UIVSidebar = {
    loadSavedScripts,
    createNewCategory,
    exportBackup,
    importBackup,
    refreshI18n,
    getScripts,
    getCategories,
    refillScript
};
