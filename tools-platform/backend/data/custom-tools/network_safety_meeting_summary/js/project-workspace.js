const API_ROOT = '/api/slide-design';

function authHeaders(json = true) {
    const headers = {};
    const token = localStorage.getItem('tools_token');
    if (token) headers.Authorization = `Bearer ${token}`;
    if (json) headers['Content-Type'] = 'application/json';
    return headers;
}

async function request(path, options = {}) {
    const response = await fetch(`${API_ROOT}${path}`, {
        ...options,
        headers: { ...authHeaders(!(options.body instanceof FormData)), ...(options.headers || {}) }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    return body;
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));
}

function formatTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function initProjectWorkspace(callbacks) {
    const hub = document.getElementById('projectHub');
    const projectList = document.getElementById('projectList');
    const projectCountLabel = document.getElementById('projectCountLabel');
    const nameInput = document.getElementById('newProjectNameInput');
    const createButton = document.getElementById('createProjectBtn');
    const projectNameChip = document.getElementById('openProjectHubBtn');
    const autoSaveBadge = document.getElementById('autoSaveBadge');
    const importInput = document.getElementById('pptImportInput');
    const importProgress = document.getElementById('pptImportProgress');
    const hubImportStatus = document.getElementById('hubPptImportStatus');
    const library = document.getElementById('materialLibrary');
    const materialGrid = document.getElementById('materialGrid');
    const tagFilters = document.getElementById('libraryTagFilters');
    const searchInput = document.getElementById('librarySearchInput');
    const dateInput = document.getElementById('libraryDateInput');
    const uploaderSelect = document.getElementById('libraryUploaderSelect');
    const scenarioSelect = document.getElementById('libraryScenarioSelect');
    const shelfList = document.getElementById('materialShelfList');
    const shelfCount = document.getElementById('materialShelfCount');
    const combineButton = document.getElementById('downloadCombinedPptBtn');

    let currentProject = null;
    let saveTimer = null;
    let saveInFlight = false;
    let saveQueued = false;
    let activeTag = '';
    let libraryItems = [];
    let searchTimer = null;
    let shelfItems = [];
    let thumbnailObjectUrls = [];
    let projectViewPreference = localStorage.getItem('slide_project_view') || 'auto';

    function applyProjectView(projectCount) {
        if (!['auto', 'grid', 'list'].includes(projectViewPreference)) projectViewPreference = 'auto';
        const resolvedMode = projectViewPreference === 'auto'
            ? (projectCount > 4 ? 'list' : 'grid')
            : projectViewPreference;
        projectList.classList.toggle('view-list', resolvedMode === 'list');
        document.querySelectorAll('[data-project-view]').forEach(button => {
            button.classList.toggle('active', button.dataset.projectView === projectViewPreference);
            button.setAttribute('aria-pressed', button.dataset.projectView === projectViewPreference ? 'true' : 'false');
        });
        projectCountLabel.textContent = `${projectCount} 个项目 · ${resolvedMode === 'list' ? '列表' : '网格'}显示${projectViewPreference === 'auto' ? '（自动）' : ''}`;
    }

    function setSaveBadge(text, tone = 'idle') {
        autoSaveBadge.textContent = text;
        autoSaveBadge.dataset.tone = tone;
    }

    async function loadProjects() {
        projectList.innerHTML = '<div class="project-empty">正在读取项目…</div>';
        try {
            const { items } = await request('/projects');
            applyProjectView(items.length);
            projectList.innerHTML = items.length ? items.map(project => `
                <button class="project-card" data-project-id="${escapeHtml(project.id)}">
                    <span class="project-source">${project.source === 'ppt-import' ? 'PPT IMPORT' : 'DESIGN'}</span>
                    <span class="project-card-icon"><i class="ph ph-presentation"></i></span>
                    <strong title="${escapeHtml(project.name)}">${escapeHtml(project.name)}</strong>
                    <small>最近保存 ${formatTime(project.updatedAt)}</small>
                </button>
            `).join('') : '<div class="project-empty">还没有项目，输入名称创建第一份胶片吧。</div>';
        } catch (error) {
            projectList.innerHTML = `<div class="project-empty">读取失败：${escapeHtml(error.message)}</div>`;
        }
    }

    async function openProject(id) {
        callbacks.setStatus('正在打开项目…');
        const { project } = await request(`/projects/${encodeURIComponent(id)}`);
        currentProject = project;
        callbacks.loadDeck(project.deckHtml, project.activeSlide);
        projectNameChip.innerHTML = `${escapeHtml(project.name)} <i class="ph ph-caret-down"></i>`;
        projectNameChip.title = `当前项目：${project.name}`;
        hub.classList.add('is-hidden');
        setSaveBadge('已同步', 'saved');
        callbacks.setStatus(`已打开：${project.name}`);
    }

    async function createProject() {
        const name = nameInput.value.trim();
        if (!name) {
            nameInput.focus();
            return;
        }
        createButton.disabled = true;
        try {
            const { project } = await request('/projects', {
                method: 'POST',
                body: JSON.stringify({
                    name,
                    deckHtml: callbacks.getNewProjectDeckHtml ? callbacks.getNewProjectDeckHtml() : callbacks.getDeckHtml(),
                    activeSlide: 0,
                    source: 'manual'
                })
            });
            nameInput.value = '';
            await loadProjects();
            await openProject(project.id);
        } catch (error) {
            alert(`创建项目失败：${error.message}`);
        } finally {
            createButton.disabled = false;
        }
    }

    async function saveNow(manual = false) {
        clearTimeout(saveTimer);
        if (!currentProject) return false;
        if (saveInFlight) {
            saveQueued = true;
            return false;
        }
        saveInFlight = true;
        setSaveBadge(manual ? '正在手动保存…' : '正在同步…', 'saving');
        try {
            const { project } = await request(`/projects/${encodeURIComponent(currentProject.id)}`, {
                method: 'PUT',
                body: JSON.stringify({
                    deckHtml: callbacks.getDeckHtml(),
                    activeSlide: callbacks.getActiveSlide()
                })
            });
            currentProject = project;
            setSaveBadge(manual ? '已手动保存' : '已自动保存', 'saved');
            if (manual) callbacks.setStatus('项目已手动保存');
            return true;
        } catch (error) {
            setSaveBadge('保存失败', 'error');
            callbacks.setStatus(`保存失败：${error.message}`);
            return false;
        } finally {
            saveInFlight = false;
            if (saveQueued) {
                saveQueued = false;
                scheduleAutoSave();
            }
        }
    }

    function scheduleAutoSave() {
        if (!currentProject) return;
        clearTimeout(saveTimer);
        setSaveBadge('待同步', 'dirty');
        saveTimer = setTimeout(() => saveNow(false), 1200);
    }

    async function importPptx(file) {
        if (!file) return;
        const form = new FormData();
        form.append('pptx', file);
        importProgress.classList.remove('hidden');
        importInput.disabled = true;
        hubImportStatus.textContent = `正在导入 ${file.name}…`;
        try {
            const result = await request('/import-pptx', { method: 'POST', body: form });
            hubImportStatus.textContent = `已建立 ${result.slideCount} 页素材${result.usedAi ? '，AI 编目完成' : '，使用本地编目'}`;
            callbacks.setStatus(`素材库新增 ${result.slideCount} 页 PPT`);
            await loadLibrary();
        } catch (error) {
            hubImportStatus.textContent = '导入失败，请重新选择 PPT 文件';
            alert(error.message);
        } finally {
            importProgress.classList.add('hidden');
            importInput.disabled = false;
            importInput.value = '';
        }
    }

    function renderTagFilters() {
        const tags = [...new Set(libraryItems.map(item => item.tag).filter(Boolean))];
        tagFilters.innerHTML = [`<button class="${activeTag ? '' : 'active'}" data-library-tag="">全部</button>`]
            .concat(tags.map(tag => `<button class="${activeTag === tag ? 'active' : ''}" data-library-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`))
            .join('');
    }

    function renderLibrary() {
        materialGrid.innerHTML = libraryItems.length ? libraryItems.map(asset => `
            <article class="material-card">
                <div class="material-card-preview" data-thumbnail="${asset.thumbnailUrl ? escapeHtml(asset.id) : ''}"><i class="ph ph-presentation-chart"></i></div>
                <div class="material-card-content">
                    <div class="material-card-top"><span class="material-card-tag">${escapeHtml(asset.usageScenario || asset.tag)}</span><span class="material-card-page">PAGE ${asset.pageNumber}</span></div>
                    <h3>${escapeHtml(asset.summary || '未生成摘要')}</h3>
                    <p title="${escapeHtml(asset.intent || asset.extractedText)}">${escapeHtml(asset.intent || asset.extractedText || '本页未提取到可识别文字')}</p>
                    <div class="material-card-tags">${(asset.tags || [asset.tag]).map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
                    <div class="material-card-meta" title="${escapeHtml(asset.sourceFilename)}">${escapeHtml(asset.uploader || '未知用户')} · ${formatTime(asset.importedAt)} · ${escapeHtml(asset.sourceFilename)}</div>
                    <div class="material-card-actions">
                        <button data-insert-asset="${escapeHtml(asset.id)}"><i class="ph ph-plus-circle"></i>&nbsp; 插入项目</button>
                        <button data-shelf-asset="${escapeHtml(asset.id)}"><i class="ph ph-stack-plus"></i>&nbsp; 加入暂存架</button>
                        <button data-download-asset="${escapeHtml(asset.id)}" title="下载单页 PPT"><i class="ph ph-download-simple"></i></button>
                    </div>
                </div>
            </article>
        `).join('') : '<div class="project-empty">没有匹配的 PPT 页面素材。</div>';
        loadVisibleThumbnails();
    }

    async function loadVisibleThumbnails() {
        thumbnailObjectUrls.forEach(url => URL.revokeObjectURL(url));
        thumbnailObjectUrls = [];
        const targets = Array.from(materialGrid.querySelectorAll('[data-thumbnail]')).filter(item => item.dataset.thumbnail);
        await Promise.all(targets.map(async target => {
            const asset = libraryItems.find(item => item.id === target.dataset.thumbnail);
            if (!asset) return;
            try {
                const response = await fetch(asset.thumbnailUrl, { headers: authHeaders(false) });
                if (!response.ok) return;
                const url = URL.createObjectURL(await response.blob());
                thumbnailObjectUrls.push(url);
                target.innerHTML = `<img src="${url}" alt="${escapeHtml(asset.summary || 'PPT 页面缩略图')}">`;
            } catch (_) { /* 保留文字卡片降级预览 */ }
        }));
    }

    function renderShelf() {
        shelfCount.textContent = String(shelfItems.length);
        combineButton.disabled = !shelfItems.length;
        shelfList.innerHTML = shelfItems.length ? shelfItems.map((asset, index) => `
            <div class="material-shelf-item" draggable="true" data-shelf-item="${escapeHtml(asset.id)}">
                <i class="ph ph-dots-six-vertical"></i><b>${index + 1}</b>
                <span title="${escapeHtml(asset.summary)}">${escapeHtml(asset.summary || asset.tag)}</span>
                <button data-remove-shelf="${escapeHtml(asset.id)}" title="移除"><i class="ph ph-x"></i></button>
            </div>
        `).join('') : '<div class="material-shelf-empty">从左侧选择素材<br>在这里编排新的 PPT</div>';
    }

    function addToShelf(asset) {
        if (shelfItems.some(item => item.id === asset.id)) {
            callbacks.setStatus('该页面已经在暂存架中');
            return;
        }
        shelfItems.push(asset);
        renderShelf();
        callbacks.setStatus(`已加入暂存架：第 ${shelfItems.length} 页`);
    }

    async function loadFilterOptions() {
        try {
            const { uploaders = [], scenarios = [] } = await request('/asset-filters');
            const selectedUploader = uploaderSelect.value;
            const selectedScenario = scenarioSelect.value;
            uploaderSelect.innerHTML = '<option value="">全部上传人</option>' + uploaders.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
            scenarioSelect.innerHTML = '<option value="">全部场景</option>' + scenarios.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
            uploaderSelect.value = selectedUploader;
            scenarioSelect.value = selectedScenario;
        } catch (_) { /* 筛选项失败不影响素材检索 */ }
    }

    async function loadLibrary() {
        const params = new URLSearchParams();
        if (searchInput.value.trim()) params.set('q', searchInput.value.trim());
        if (dateInput.value) params.set('date', dateInput.value);
        if (activeTag) params.set('tag', activeTag);
        if (uploaderSelect.value) params.set('uploader', uploaderSelect.value);
        if (scenarioSelect.value) params.set('scenario', scenarioSelect.value);
        materialGrid.innerHTML = '<div class="project-empty">正在检索素材库…</div>';
        try {
            const { items } = await request(`/assets?${params}`);
            libraryItems = items;
            renderTagFilters();
            renderLibrary();
            loadFilterOptions();
        } catch (error) {
            materialGrid.innerHTML = `<div class="project-empty">读取失败：${escapeHtml(error.message)}</div>`;
        }
    }

    async function downloadCombinedPpt() {
        if (!shelfItems.length) return;
        combineButton.disabled = true;
        combineButton.innerHTML = '<i class="ph ph-spinner"></i> 正在合并…';
        try {
            const response = await fetch(`${API_ROOT}/combine`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ assetIds: shelfItems.map(item => item.id) })
            });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${response.status}`);
            }
            const blob = await response.blob();
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `PPT素材组合_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.pptx`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(link.href), 1000);
            callbacks.setStatus(`已合并下载 ${shelfItems.length} 页原始 PPT 素材`);
        } catch (error) {
            alert(error.message);
        } finally {
            combineButton.disabled = !shelfItems.length;
            combineButton.innerHTML = '<i class="ph ph-download-simple"></i> 合并下载';
        }
    }

    async function downloadAsset(asset) {
        try {
            const response = await fetch(asset.downloadUrl, { headers: authHeaders(false) });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = asset.fileName;
            link.click();
            setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        } catch (error) {
            alert(`下载失败：${error.message}`);
        }
    }

    createButton.addEventListener('click', createProject);
    nameInput.addEventListener('keydown', event => { if (event.key === 'Enter') createProject(); });
    document.getElementById('refreshProjectsBtn').addEventListener('click', loadProjects);
    document.querySelector('.project-view-switch').addEventListener('click', event => {
        const button = event.target.closest('[data-project-view]');
        if (!button) return;
        projectViewPreference = button.dataset.projectView;
        localStorage.setItem('slide_project_view', projectViewPreference);
        applyProjectView(projectList.querySelectorAll('[data-project-id]').length);
    });
    projectList.addEventListener('click', event => {
        const card = event.target.closest('[data-project-id]');
        if (card) openProject(card.dataset.projectId).catch(error => alert(error.message));
    });
    projectNameChip.addEventListener('click', () => { hub.classList.remove('is-hidden'); loadProjects(); });
    document.getElementById('manualSaveBtn').addEventListener('click', () => saveNow(true));
    importInput.addEventListener('change', () => importPptx(importInput.files[0]));
    document.getElementById('openLibraryBtn').addEventListener('click', () => {
        library.classList.remove('hidden');
        library.setAttribute('aria-hidden', 'false');
        loadLibrary();
    });
    document.getElementById('openHubLibraryBtn').addEventListener('click', () => {
        library.classList.remove('hidden');
        library.setAttribute('aria-hidden', 'false');
        loadLibrary();
    });
    document.getElementById('closeLibraryBtn').addEventListener('click', () => {
        library.classList.add('hidden');
        library.setAttribute('aria-hidden', 'true');
    });
    document.getElementById('refreshLibraryBtn').addEventListener('click', loadLibrary);
    searchInput.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadLibrary, 320); });
    dateInput.addEventListener('change', loadLibrary);
    uploaderSelect.addEventListener('change', loadLibrary);
    scenarioSelect.addEventListener('change', loadLibrary);
    tagFilters.addEventListener('click', event => {
        const button = event.target.closest('[data-library-tag]');
        if (!button) return;
        activeTag = button.dataset.libraryTag;
        loadLibrary();
    });
    materialGrid.addEventListener('click', event => {
        const insertButton = event.target.closest('[data-insert-asset]');
        const downloadButton = event.target.closest('[data-download-asset]');
        const shelfButton = event.target.closest('[data-shelf-asset]');
        if (insertButton) {
            if (!currentProject) return alert('请先关闭素材库并打开一个项目，再插入素材');
            const asset = libraryItems.find(item => item.id === insertButton.dataset.insertAsset);
            if (asset) {
                callbacks.insertAsset(asset);
                scheduleAutoSave();
                callbacks.setStatus(`已导入素材：${asset.tag}`);
            }
        } else if (shelfButton) {
            const asset = libraryItems.find(item => item.id === shelfButton.dataset.shelfAsset);
            if (asset) addToShelf(asset);
        } else if (downloadButton) {
            const asset = libraryItems.find(item => item.id === downloadButton.dataset.downloadAsset);
            if (asset) downloadAsset(asset);
        }
    });
    shelfList.addEventListener('click', event => {
        const button = event.target.closest('[data-remove-shelf]');
        if (!button) return;
        shelfItems = shelfItems.filter(item => item.id !== button.dataset.removeShelf);
        renderShelf();
    });
    shelfList.addEventListener('dragstart', event => {
        const item = event.target.closest('[data-shelf-item]');
        if (!item) return;
        item.classList.add('is-dragging');
        event.dataTransfer.setData('text/plain', item.dataset.shelfItem);
        event.dataTransfer.effectAllowed = 'move';
    });
    shelfList.addEventListener('dragend', event => event.target.closest('[data-shelf-item]')?.classList.remove('is-dragging'));
    shelfList.addEventListener('dragover', event => { if (event.target.closest('[data-shelf-item]')) event.preventDefault(); });
    shelfList.addEventListener('drop', event => {
        const target = event.target.closest('[data-shelf-item]');
        const sourceId = event.dataTransfer.getData('text/plain');
        if (!target || !sourceId || target.dataset.shelfItem === sourceId) return;
        event.preventDefault();
        const sourceIndex = shelfItems.findIndex(item => item.id === sourceId);
        const targetIndex = shelfItems.findIndex(item => item.id === target.dataset.shelfItem);
        const [moved] = shelfItems.splice(sourceIndex, 1);
        shelfItems.splice(targetIndex, 0, moved);
        renderShelf();
    });
    document.getElementById('clearMaterialShelfBtn').addEventListener('click', () => { shelfItems = []; renderShelf(); });
    combineButton.addEventListener('click', downloadCombinedPpt);
    document.addEventListener('keydown', event => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
            event.preventDefault();
            saveNow(true);
        }
    });

    loadProjects();
    renderShelf();
    return {
        scheduleAutoSave,
        saveNow,
        openHub: () => hub.classList.remove('is-hidden'),
        getCurrentProject: () => currentProject
    };
}
