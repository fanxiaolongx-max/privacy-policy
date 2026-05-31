/**
 * uivf12/sidebar.js - 侧边栏分类脚本仓库模块
 * 负责：加载脚本数据、渲染折叠分类列表、拖拽分类、双击回填等
 */

const DEFAULT_CATEGORIES = ['DataFab', 'NetCare中国', 'NetCare中东', 'NetCare德国', '默认分类'];

// 展开状态仅保留在内存（不再用 localStorage，服务端不存此状态）
let expandedCategories = [];
let draggedScriptId = null;

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
    if (source === 'sqlite') return 'SQLite';
    if (source === 'json') return 'JSON';
    if (source === 'auto') return '自动模式';
    return source || '-';
}

function renderRepositorySource() {
    const panel = document.getElementById('repoSourcePanel');
    if (!panel) return;

    const mode = API.getSourceMode('uiv_repository');
    const query = mode === 'auto' ? '' : `?mode=${encodeURIComponent(mode)}`;
    const meta = API.getLastDataSourceMeta(`/api/uiv/scripts${query}`) || API.getLastDataSourceMeta('/api/uiv/scripts') || {};
    const scriptSource = formatSourceLabel(meta.primary);
    const categorySource = formatSourceLabel(meta.extras ? meta.extras.categories : null);

    panel.innerHTML = `
        <span class="repo-source-badge">脚本来源: ${scriptSource}</span>
        <span class="repo-source-badge">分类来源: ${categorySource}</span>
        <span class="repo-source-note">当前模式: ${formatSourceLabel(mode)} · 默认要求页面直接渲染当前真实读源，便于迁移期验证。</span>
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
        logSidebarStep('脚本仓库接口返回成功', {
            scriptCount: scripts.length,
            categoryCount: categories.length,
            categoryBreakdown: categories.map(catName => ({
                category: catName,
                count: scripts.filter(s => s.category === catName).length
            }))
        });
        renderRepositorySource();
        renderSidebar(scripts, categories);
        logSidebarStep('侧边栏渲染完成', {
            expandedCategories: [...expandedCategories]
        });
    } catch (e) {
        logSidebarError('加载侧边栏脚本仓库', e, {
            reason: options.reason || 'direct'
        });
        renderRepositorySource();
        showToast('❌ 无法连接服务器，脚本仓库加载失败', 'error');
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
                    showToast('❌ 移动分类失败', 'error');
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
        titleSpan.innerHTML = `<span class="cat-arrow">▶</span> 📂 ${catName} <span style="color:#aaa;font-weight:normal;">(${catScripts.length})</span>`;

        const actionSpan = document.createElement('div');
        actionSpan.className = 'category-actions';

        if (catScripts.length > 0) {
            const copyCatBtn = document.createElement('button');
            copyCatBtn.className = 'cat-copy-btn';
            copyCatBtn.innerHTML = '📦';
            copyCatBtn.title = '仅打包提取此组脚本';
            copyCatBtn.onclick = e => { e.stopPropagation(); window.UIVBatch.buildAndCopyMasterScript(catScripts, catName); };
            actionSpan.appendChild(copyCatBtn);
        }

        if (isCustom) {
            const delCatBtn = document.createElement('button');
            delCatBtn.className = 'cat-del-btn';
            delCatBtn.innerHTML = '✖';
            delCatBtn.title = '删除此分类';
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
            contentDiv.innerHTML = '<div style="color:#666;font-size:11px;text-align:center;padding:5px;">（空）将脚本拖拽至此</div>';
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
    item.title = '双击回填配置至工作台';

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
        showToast(`✅ [${script.name}] 配置已回填！`);
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
        if (script.consoleCode) window.UIVCopy.copyFromMemory(script.consoleCode, '控制台脚本');
        else alert('⚠️ 旧版脚本，请重新生成并覆盖保存。');
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'mini-btn del';
    delBtn.innerHTML = '✖';
    delBtn.onclick = async () => {
        if (confirm(`确定删除 [${script.name}] 吗？`)) {
            try {
                await API.delete(`/api/uiv/scripts/${script.id}`);
                await loadSavedScripts();
                showToast('✅ 脚本已删除');
                API.logHistory('uiv', '删除脚本', script.name);
            } catch (err) {
                showToast('❌ 删除失败', 'error');
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
    const newCat = prompt('请输入新分类名称：');
    if (!newCat || !newCat.trim()) return;
    try {
        await API.post('/api/uiv/categories', { name: newCat.trim() });
        if (!expandedCategories.includes(newCat.trim())) expandedCategories.push(newCat.trim());
        await loadSavedScripts();
        showToast('✅ 分类已创建');
    } catch (e) {
        showToast('❌ 创建失败', 'error');
    }
}

async function deleteCategory(catName) {
    if (!confirm(`确定要删除分类 [${catName}] 吗？\n注意：该分类下的所有脚本也会被一并删除！`)) return;
    try {
        await API.delete(`/api/uiv/categories/${encodeURIComponent(catName)}`);
        expandedCategories = expandedCategories.filter(c => c !== catName);
        await loadSavedScripts();
        showToast('✅ 分类已删除');
    } catch (e) {
        showToast('❌ 删除失败', 'error');
    }
}

// ──────────────────────────────────────────────────────────
// 导入 / 导出
// ──────────────────────────────────────────────────────────
async function exportBackup() {
    try {
        const data = await API.get('/api/uiv/backup');
        if (data.scripts.length === 0 && (!data.categories || data.categories.length === 0)) {
            alert('⚠️ 当前仓库为空，没有需要导出的配置！'); return;
        }
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `UIVision_抓取引擎配置备份_${dateStr}.json`;
        a.click();
        showToast('✅ 仓库备份配置已安全导出！');
        API.logHistory('uiv', '导出备份', `共 ${data.scripts.length} 个脚本`);
    } catch (e) {
        showToast('❌ 导出失败', 'error');
    }
}

async function importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
        try {
            const parsed = JSON.parse(e.target.result);
            if (!Array.isArray(parsed.scripts)) { alert('❌ 无效备份文件格式'); return; }
            const merge = confirm('📦 成功解析备份文件！\n\n点击【确定】融合（保留现有脚本，追加新脚本）\n点击【取消】覆盖（清空现有仓库，完全替换）');
            await API.post('/api/uiv/backup', { scripts: parsed.scripts, categories: parsed.categories, merge });
            await loadSavedScripts();
            showToast('✅ 配置快照已成功导入！');
            API.logHistory('uiv', merge ? '融合导入' : '覆盖导入', `共 ${parsed.scripts.length} 个脚本`);
        } catch (err) {
            alert('❌ 导入失败：解析文件出错。');
        }
        event.target.value = '';
    };
    reader.readAsText(file);
}

// 暴露给全局
window.UIVSidebar = { loadSavedScripts, createNewCategory, exportBackup, importBackup };
