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
    const taskProgressTitle = document.getElementById('pptTaskProgressTitle');
    const taskProgressText = document.getElementById('pptImportProgressText');
    const taskProgressBar = document.getElementById('pptTaskProgressBar');
    const taskProgressPercent = document.getElementById('pptTaskProgressPercent');
    const hubImportStatus = document.getElementById('hubPptImportStatus');
    const library = document.getElementById('materialLibrary');
    const materialGrid = document.getElementById('materialGrid');
    const tagFilters = document.getElementById('libraryTagFilters');
    const searchInput = document.getElementById('librarySearchInput');
    const periodSelect = document.getElementById('libraryPeriodSelect');
    const uploaderSelect = document.getElementById('libraryUploaderSelect');
    const scenarioSelect = document.getElementById('libraryScenarioSelect');
    const pageTypeFilters = document.getElementById('libraryPageTypeFilters');
    const shelfList = document.getElementById('materialShelfList');
    const shelfCount = document.getElementById('materialShelfCount');
    const combineButton = document.getElementById('downloadCombinedPptBtn');
    const previewModal = document.getElementById('materialPreviewModal');
    const previewImage = document.getElementById('materialPreviewImage');
    const previewTitle = document.getElementById('materialPreviewTitle');
    const previewMeta = document.getElementById('materialPreviewMeta');

    let currentProject = null;
    let saveTimer = null;
    let saveInFlight = false;
    let saveQueued = false;
    let activeTag = '';
    let activePageType = '';
    let libraryItems = [];
    let searchTimer = null;
    let shelfItems = [];
    let thumbnailObjectUrls = [];
    let projectViewPreference = localStorage.getItem('slide_project_view') || 'auto';
    let availableTags = [];
    let availablePageTypes = [];
    let materialViewPreference = localStorage.getItem('slide_material_view') || 'grid';

    function applyMaterialView() {
        if (!['grid', 'table'].includes(materialViewPreference)) materialViewPreference = 'grid';
        materialGrid.classList.toggle('view-table', materialViewPreference === 'table');
        document.querySelectorAll('[data-material-view]').forEach(button => {
            const active = button.dataset.materialView === materialViewPreference;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    }

    function closeMaterialPreview() {
        previewModal.classList.add('hidden');
        previewModal.setAttribute('aria-hidden', 'true');
        previewImage.removeAttribute('src');
    }

    function openMaterialPreview(asset, imageUrl) {
        if (!asset || !imageUrl) return;
        previewTitle.textContent = asset.summary || `PPT 第 ${asset.pageNumber} 页`;
        previewMeta.textContent = `PAGE ${asset.pageNumber} · ${asset.pageType || asset.tag || '未分类'} · ${asset.sourceFilename || ''}`;
        previewImage.src = imageUrl;
        previewModal.classList.remove('hidden');
        previewModal.setAttribute('aria-hidden', 'false');
    }

    function setTaskProgress(percent, text) {
        const value = Math.min(100, Math.max(0, Math.round(Number(percent) || 0)));
        taskProgressBar.style.width = `${value}%`;
        taskProgressPercent.textContent = `${value}%`;
        if (text) taskProgressText.textContent = text;
    }

    function showTaskProgress(title, text, percent = 0) {
        taskProgressTitle.textContent = title;
        importProgress.classList.remove('hidden');
        setTaskProgress(percent, text);
    }

    function hideTaskProgress(delay = 350) {
        window.setTimeout(() => importProgress.classList.add('hidden'), delay);
    }

    function beginWaitingProgress(maximum = 58) {
        let value = Number.parseInt(taskProgressPercent.textContent, 10) || 0;
        return window.setInterval(() => {
            if (value >= maximum) return;
            value += value < 25 ? 3 : value < 45 ? 2 : 1;
            setTaskProgress(Math.min(value, maximum));
        }, 280);
    }

    async function responseBlobWithProgress(response, start = 62, end = 94) {
        const total = Number(response.headers.get('content-length') || 0);
        if (!response.body?.getReader) {
            setTaskProgress(end, '文件已接收，正在写入下载…');
            return response.blob();
        }
        const reader = response.body.getReader();
        const chunks = [];
        let received = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.byteLength;
            const ratio = total ? received / total : Math.min(.95, chunks.length / (chunks.length + 2));
            setTaskProgress(start + ((end - start) * ratio), `正在接收 PPT… ${total ? `${Math.round(received / total * 100)}%` : ''}`);
        }
        return new Blob(chunks, { type: response.headers.get('content-type') || 'application/octet-stream' });
    }

    function triggerBlobDownload(blob, fileName) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }

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
        showTaskProgress('正在构建 PPT 素材库', '正在拆分页面、提取文字并生成 AI 摘要…', 8);
        const waitingProgress = beginWaitingProgress(72);
        importInput.disabled = true;
        hubImportStatus.textContent = `正在导入 ${file.name}…`;
        try {
            const result = await request('/import-pptx', { method: 'POST', body: form });
            window.clearInterval(waitingProgress);
            setTaskProgress(100, `已完成 ${result.slideCount} 页素材的处理`);
            hubImportStatus.textContent = `已建立 ${result.slideCount} 页素材${result.usedAi ? '，AI 编目完成' : '，使用本地编目'}`;
            callbacks.setStatus(`素材库新增 ${result.slideCount} 页 PPT`);
            await loadLibrary();
        } catch (error) {
            hubImportStatus.textContent = '导入失败，请重新选择 PPT 文件';
            alert(error.message);
        } finally {
            window.clearInterval(waitingProgress);
            hideTaskProgress();
            importInput.disabled = false;
            importInput.value = '';
        }
    }

    function renderTagFilters() {
        const tags = availableTags.length
            ? availableTags
            : [...new Set(libraryItems.map(item => item.tag).filter(Boolean))].map(value => ({ value, count: 0 }));
        tagFilters.innerHTML = [`<button class="${activeTag ? '' : 'active'}" data-library-tag="">全部</button>`]
            .concat(tags.map(tag => `<button class="${activeTag === tag.value ? 'active' : ''}" data-library-tag="${escapeHtml(tag.value)}">${escapeHtml(tag.value)}${tag.count ? `<small>${tag.count}</small>` : ''}</button>`))
            .join('');
    }

    function renderPageTypeFilters() {
        const types = availablePageTypes.length
            ? availablePageTypes
            : [...new Set(libraryItems.map(item => item.pageType).filter(Boolean))].map(value => ({ value, count: 0 }));
        pageTypeFilters.innerHTML = [`<button class="${activePageType ? '' : 'active'}" data-library-page-type="">全部页型</button>`]
            .concat(types.map(item => `<button class="${activePageType === item.value ? 'active' : ''}" data-library-page-type="${escapeHtml(item.value)}">${escapeHtml(item.value)}${item.count ? `<small>${item.count}</small>` : ''}</button>`))
            .join('');
    }

    function renderLibrary() {
        materialGrid.innerHTML = libraryItems.length ? libraryItems.map(asset => `
            <article class="material-card">
                <div class="material-card-preview" data-thumbnail="${asset.thumbnailUrl ? escapeHtml(asset.id) : ''}"><i class="ph ph-presentation-chart"></i></div>
                <div class="material-card-content">
                    <div class="material-card-top"><span class="material-card-tag">${escapeHtml(asset.pageType || asset.usageScenario || asset.tag)}</span><span class="material-card-page">PAGE ${asset.pageNumber}</span></div>
                    <h3>${escapeHtml(asset.summary || '未生成摘要')}</h3>
                    <p title="${escapeHtml(asset.intent || asset.extractedText)}">${escapeHtml(asset.intent || asset.extractedText || '本页未提取到可识别文字')}</p>
                    <div class="material-card-extract" title="${escapeHtml(asset.extractedText)}">${escapeHtml(asset.extractedText || '本页未提取到可识别文字')}</div>
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
        applyMaterialView();
        loadVisibleThumbnails();
    }

    async function loadVisibleThumbnails() {
        closeMaterialPreview();
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
            const { uploaders = [], scenarios = [], pageTypes = [], tags = [], periods = [] } = await request('/asset-filters');
            const selectedUploader = uploaderSelect.value;
            const selectedScenario = scenarioSelect.value;
            const selectedPeriod = periodSelect.value;
            uploaderSelect.innerHTML = '<option value="">全部上传人</option>' + uploaders.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
            scenarioSelect.innerHTML = '<option value="">全部场景</option>' + scenarios.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
            periodSelect.innerHTML = '<option value="">全部时间</option>' + periods.map(item => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`).join('');
            uploaderSelect.value = selectedUploader;
            scenarioSelect.value = selectedScenario;
            periodSelect.value = selectedPeriod;
            availableTags = tags;
            availablePageTypes = pageTypes;
            renderTagFilters();
            renderPageTypeFilters();
        } catch (_) { /* 筛选项失败不影响素材检索 */ }
    }

    async function loadLibrary() {
        const params = new URLSearchParams();
        if (searchInput.value.trim()) params.set('q', searchInput.value.trim());
        if (periodSelect.value) params.set('period', periodSelect.value);
        if (activeTag) params.set('tag', activeTag);
        if (uploaderSelect.value) params.set('uploader', uploaderSelect.value);
        if (scenarioSelect.value) params.set('scenario', scenarioSelect.value);
        if (activePageType) params.set('pageType', activePageType);
        materialGrid.innerHTML = '<div class="project-empty">正在检索素材库…</div>';
        try {
            const { items } = await request(`/assets?${params}`);
            libraryItems = items;
            renderTagFilters();
            renderPageTypeFilters();
            renderLibrary();
            await loadFilterOptions();
        } catch (error) {
            materialGrid.innerHTML = `<div class="project-empty">读取失败：${escapeHtml(error.message)}</div>`;
        }
    }

    async function downloadCombinedPpt() {
        if (!shelfItems.length) return;
        combineButton.disabled = true;
        combineButton.innerHTML = '<i class="ph ph-spinner"></i> 正在合并…';
        showTaskProgress('正在合并 PPT', `正在校验 ${shelfItems.length} 页素材并准备版式资源…`, 6);
        const waitingProgress = beginWaitingProgress(58);
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
            window.clearInterval(waitingProgress);
            setTaskProgress(62, '合并与无用章节清理完成，正在下载…');
            const blob = await responseBlobWithProgress(response);
            triggerBlobDownload(blob, `PPT素材组合_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.pptx`);
            setTaskProgress(100, `已合并并下载 ${shelfItems.length} 页 PPT`);
            callbacks.setStatus(`已合并下载 ${shelfItems.length} 页原始 PPT 素材`);
        } catch (error) {
            alert(error.message);
        } finally {
            window.clearInterval(waitingProgress);
            hideTaskProgress();
            combineButton.disabled = !shelfItems.length;
            combineButton.innerHTML = '<i class="ph ph-download-simple"></i> 合并下载';
        }
    }

    async function downloadAsset(asset) {
        showTaskProgress('正在准备单页 PPT', `正在清理第 ${asset.pageNumber} 页的无用章节和包元数据…`, 8);
        const waitingProgress = beginWaitingProgress(58);
        try {
            const response = await fetch(asset.downloadUrl, { headers: authHeaders(false) });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            window.clearInterval(waitingProgress);
            setTaskProgress(62, '文件准备完成，正在下载…');
            const blob = await responseBlobWithProgress(response);
            triggerBlobDownload(blob, asset.fileName);
            setTaskProgress(100, `第 ${asset.pageNumber} 页 PPT 已下载`);
        } catch (error) {
            alert(`下载失败：${error.message}`);
        } finally {
            window.clearInterval(waitingProgress);
            hideTaskProgress();
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
    document.querySelector('.material-view-switch').addEventListener('click', event => {
        const button = event.target.closest('[data-material-view]');
        if (!button) return;
        materialViewPreference = button.dataset.materialView;
        localStorage.setItem('slide_material_view', materialViewPreference);
        applyMaterialView();
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
    periodSelect.addEventListener('change', loadLibrary);
    uploaderSelect.addEventListener('change', loadLibrary);
    scenarioSelect.addEventListener('change', loadLibrary);
    document.getElementById('resetLibraryFiltersBtn').addEventListener('click', () => {
        searchInput.value = '';
        periodSelect.value = '';
        uploaderSelect.value = '';
        scenarioSelect.value = '';
        activeTag = '';
        activePageType = '';
        loadLibrary();
    });
    tagFilters.addEventListener('click', event => {
        const button = event.target.closest('[data-library-tag]');
        if (!button) return;
        activeTag = button.dataset.libraryTag;
        loadLibrary();
    });
    pageTypeFilters.addEventListener('click', event => {
        const button = event.target.closest('[data-library-page-type]');
        if (!button) return;
        activePageType = button.dataset.libraryPageType;
        loadLibrary();
    });
    materialGrid.addEventListener('click', async event => {
        const insertButton = event.target.closest('[data-insert-asset]');
        const downloadButton = event.target.closest('[data-download-asset]');
        const shelfButton = event.target.closest('[data-shelf-asset]');
        const previewTarget = event.target.closest('[data-thumbnail]');
        if (previewTarget && !insertButton && !downloadButton && !shelfButton) {
            const asset = libraryItems.find(item => item.id === previewTarget.dataset.thumbnail);
            const image = previewTarget.querySelector('img');
            if (asset && image) openMaterialPreview(asset, image.src);
        } else if (insertButton) {
            if (!currentProject) return alert('请先关闭素材库并打开一个项目，再插入素材');
            const asset = libraryItems.find(item => item.id === insertButton.dataset.insertAsset);
            if (asset) {
                insertButton.disabled = true;
                try {
                    await callbacks.insertAsset(asset);
                    scheduleAutoSave();
                } catch (error) {
                    alert(`插入页面失败：${error.message}`);
                } finally {
                    insertButton.disabled = false;
                }
            }
        } else if (shelfButton) {
            const asset = libraryItems.find(item => item.id === shelfButton.dataset.shelfAsset);
            if (asset) addToShelf(asset);
        } else if (downloadButton) {
            const asset = libraryItems.find(item => item.id === downloadButton.dataset.downloadAsset);
            if (asset) downloadAsset(asset);
        }
    });
    document.getElementById('closeMaterialPreviewBtn').addEventListener('click', closeMaterialPreview);
    previewModal.addEventListener('click', event => { if (event.target === previewModal) closeMaterialPreview(); });
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
        if (event.key === 'Escape' && !previewModal.classList.contains('hidden')) {
            closeMaterialPreview();
            return;
        }
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
