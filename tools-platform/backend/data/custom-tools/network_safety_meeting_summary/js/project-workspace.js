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
    if (!response.ok) {
        const error = new Error(body.error || `HTTP ${response.status}`);
        error.status = response.status;
        error.code = body.code || '';
        error.body = body;
        throw error;
    }
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

function formatExtractedText(value) {
    const source = String(value || '')
        .replace(/\[版式结构提示\][\s\S]*$/i, '')
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ');
    const parts = source.split(/[\r\n]+/)
        .map(item => item.replace(/^[\s•·▪●◆■□]+|[\s•·▪●◆■□]+$/g, '').replace(/\s+/g, ' ').trim())
        .filter(item => item && item !== '/')
        .filter((item, index, items) => index === 0 || item !== items[index - 1]);
    return parts.reduce((result, item) => !result ? item : /[\/／-]$/.test(result) ? `${result}${item}` : `${result}、${item}`, '')
        .replace(/、{2,}/g, '、')
        .replace(/\s*([,，。；;：:])\s*/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
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
    const materialAssetImportInput = document.getElementById('materialAssetImportInput');
    const addMaterialAssetButton = document.getElementById('addMaterialAssetBtn');
    const importProgress = document.getElementById('pptImportProgress');
    const taskProgressTitle = document.getElementById('pptTaskProgressTitle');
    const taskProgressText = document.getElementById('pptImportProgressText');
    const taskProgressBar = document.getElementById('pptTaskProgressBar');
    const taskProgressPercent = document.getElementById('pptTaskProgressPercent');
    const importDetailLog = document.getElementById('pptImportDetailLog');
    const importLogList = document.getElementById('pptImportLogList');
    const importLogCount = document.getElementById('pptImportLogCount');
    const hubImportStatus = document.getElementById('hubPptImportStatus');
    const library = document.getElementById('materialLibrary');
    const materialGrid = document.getElementById('materialGrid');
    const tagFilters = document.getElementById('libraryTagFilters');
    const searchInput = document.getElementById('librarySearchInput');
    const periodSelect = document.getElementById('libraryPeriodSelect');
    const uploaderSelect = document.getElementById('libraryUploaderSelect');
    const scenarioSelect = document.getElementById('libraryScenarioSelect');
    const pageTypeFilters = document.getElementById('libraryPageTypeFilters');
    const expandTagsButton = document.getElementById('expandLibraryTagsBtn');
    const expandPageTypesButton = document.getElementById('expandLibraryPageTypesBtn');
    const shelfList = document.getElementById('materialShelfList');
    const shelfCount = document.getElementById('materialShelfCount');
    const combineButton = document.getElementById('downloadCombinedPptBtn');
    const previewModal = document.getElementById('materialPreviewModal');
    const previewImage = document.getElementById('materialPreviewImage');
    const previewTitle = document.getElementById('materialPreviewTitle');
    const previewMeta = document.getElementById('materialPreviewMeta');
    const editModal = document.getElementById('materialEditModal');
    const editForm = document.getElementById('materialEditForm');
    const editAssetId = document.getElementById('materialEditAssetId');
    const editSummary = document.getElementById('materialEditSummary');
    const editTag = document.getElementById('materialEditTag');
    const editTags = document.getElementById('materialEditTags');
    const editPageType = document.getElementById('materialEditPageType');
    const editScenario = document.getElementById('materialEditScenario');
    const editIntent = document.getElementById('materialEditIntent');
    const paginationSummary = document.getElementById('materialPaginationSummary');
    const paginationPages = document.getElementById('materialPaginationPages');
    const pageSizeSelect = document.getElementById('materialPageSizeSelect');
    const fileFilter = document.getElementById('libraryFileFilter');
    const fileFilterButton = document.getElementById('libraryFileFilterButton');
    const fileFilterMenu = document.getElementById('libraryFileFilterMenu');
    const fileFilterSearch = document.getElementById('libraryFileFilterSearch');
    const fileFilterOptions = document.getElementById('libraryFileFilterOptions');

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
    let currentPage = 1;
    let pageSize = Number(localStorage.getItem('slide_material_page_size') || 12);
    let pagination = { page: 1, pageSize, total: 0, totalPages: 1 };
    let selectedSourceFilename = '';
    let availableSourceFiles = [];
    let tagsExpanded = localStorage.getItem('slide_material_tags_expanded') === '1';
    let pageTypesExpanded = localStorage.getItem('slide_material_page_types_expanded') === '1';
    let activeImportTaskId = '';
    let importProgressTimer = null;
    let lastImportLogSequence = 0;
    let importCapabilities = { maxFileSizeMb: 200, maxSlides: 100, platform: '', preferredThumbnailEngine: '' };
    if (![12, 24, 48, 96].includes(pageSize)) pageSize = 12;
    pageSizeSelect.value = String(pageSize);

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

    function resetTaskLog(visible = false) {
        importDetailLog.classList.toggle('hidden', !visible);
        importLogList.innerHTML = '';
        importLogCount.textContent = '0';
        lastImportLogSequence = 0;
    }

    function appendTaskLog(entry) {
        const sequence = Number(entry?.sequence);
        const hasServerSequence = Number.isFinite(sequence) && sequence > 0;
        if (hasServerSequence && sequence <= lastImportLogSequence) return;
        if (hasServerSequence) lastImportLogSequence = sequence;
        const timestamp = entry?.time ? new Date(entry.time) : new Date();
        const time = Number.isNaN(timestamp.getTime())
            ? '--:--:--'
            : timestamp.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const item = document.createElement('li');
        item.className = ['success', 'warning', 'error'].includes(entry?.level) ? entry.level : 'info';
        item.innerHTML = `<time>${escapeHtml(time)}</time><i></i><span>${escapeHtml(entry?.message || '')}</span>`;
        importLogList.appendChild(item);
        while (importLogList.children.length > 180) importLogList.firstElementChild.remove();
        importLogCount.textContent = String(importLogList.children.length);
        importLogList.scrollTop = importLogList.scrollHeight;
    }

    function showTaskProgress(title, text, percent = 0, showDetails = false) {
        taskProgressTitle.textContent = title;
        importProgress.classList.remove('hidden');
        resetTaskLog(showDetails);
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

    function stopImportProgressPolling() {
        clearTimeout(importProgressTimer);
        importProgressTimer = null;
    }

    async function fetchImportProgress(taskId, scheduleNext = true) {
        if (!taskId || activeImportTaskId !== taskId) return;
        try {
            const progress = await request(`/import-progress/${encodeURIComponent(taskId)}`);
            if (activeImportTaskId !== taskId) return;
            setTaskProgress(progress.percent, progress.message);
            (progress.logs || []).forEach(appendTaskLog);
            if (scheduleNext && !['completed', 'failed'].includes(progress.status)) {
                importProgressTimer = window.setTimeout(() => fetchImportProgress(taskId, true), 420);
            }
        } catch (error) {
            if (scheduleNext && activeImportTaskId === taskId) {
                importProgressTimer = window.setTimeout(() => fetchImportProgress(taskId, true), 700);
            }
        }
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

    async function loadImportCapabilities() {
        try {
            importCapabilities = { ...importCapabilities, ...(await request('/capabilities')) };
        } catch (_) { /* 使用前端默认限制，服务端仍会执行权威校验 */ }
        addMaterialAssetButton.classList.toggle('hidden', importCapabilities.canManageAssets === false);
        return importCapabilities;
    }

    async function importPptx(file, { singlePageOnly = false } = {}) {
        if (!file) return;
        const capabilities = await loadImportCapabilities();
        const maxBytes = Number(capabilities.maxFileSizeMb || 200) * 1024 * 1024;
        if (file.size > maxBytes) {
            const message = `文件大小 ${(file.size / 1024 / 1024).toFixed(2)} MB，超过当前 ${capabilities.maxFileSizeMb} MB 上限。请先压缩 PPT 媒体文件，或由管理员调整 SLIDE_IMPORT_MAX_MB。`;
            showTaskProgress('PPT 上传校验未通过', message, 100, true);
            appendTaskLog({ level: 'error', message });
            alert(message);
            hideTaskProgress(2500);
            importInput.value = '';
            materialAssetImportInput.value = '';
            return;
        }
        const taskId = window.crypto?.randomUUID ? window.crypto.randomUUID() : `import_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        const form = new FormData();
        form.append('taskId', taskId);
        form.append('singlePageOnly', singlePageOnly ? '1' : '0');
        form.append('pptx', file);
        activeImportTaskId = taskId;
        showTaskProgress(singlePageOnly ? '正在新增单页 PPT 素材' : '正在构建 PPT 素材库', '正在上传 PPT 文件…', 2, true);
        appendTaskLog({ level: 'info', message: `准备上传 ${file.name}，大小 ${(file.size / 1024 / 1024).toFixed(2)} MB；服务端上限 ${capabilities.maxFileSizeMb} MB` });
        appendTaskLog({ level: 'info', message: `当前平台 ${capabilities.platform || 'unknown'}，首选缩略图引擎 ${capabilities.preferredThumbnailEngine || '自动检测'}` });
        fetchImportProgress(taskId, true);
        importInput.disabled = true;
        materialAssetImportInput.disabled = true;
        hubImportStatus.textContent = `正在导入 ${file.name}…`;
        try {
            const result = await request('/import-pptx', {
                method: 'POST',
                body: form,
                headers: { 'X-Slide-Import-Task-Id': taskId }
            });
            await fetchImportProgress(taskId, false);
            setTaskProgress(100, `已完成 ${result.slideCount} 页素材的处理`);
            appendTaskLog({ level: 'success', message: `前端已收到完成响应，${result.slideCount} 页素材可以检索` });
            appendTaskLog({
                level: result.thumbnailCount === result.slideCount ? 'success' : 'warning',
                message: `缩略图结果：${result.thumbnailCount || 0}/${result.slideCount}，引擎 ${result.thumbnailEngine || '不可用'}`
            });
            hubImportStatus.textContent = `已建立 ${result.slideCount} 页素材${result.usedAi ? '，AI 编目完成' : '，使用本地编目'}`;
            callbacks.setStatus(`素材库新增 ${result.slideCount} 页 PPT`);
            appendTaskLog({ level: 'success', message: `正在打开素材库，并筛选本次导入文件：${result.sourceFilename || file.name}` });
            await openLibraryForImportedFile(result.sourceFilename || file.name);
        } catch (error) {
            await fetchImportProgress(taskId, false);
            appendTaskLog({ level: 'error', message: error.message });
            hubImportStatus.textContent = '导入失败，请重新选择 PPT 文件';
            alert(error.message);
        } finally {
            stopImportProgressPolling();
            activeImportTaskId = '';
            hideTaskProgress(1200);
            importInput.disabled = false;
            materialAssetImportInput.disabled = false;
            importInput.value = '';
            materialAssetImportInput.value = '';
        }
    }

    function renderTagFilters() {
        const tags = availableTags.length
            ? availableTags
            : [...new Set(libraryItems.map(item => item.tag).filter(Boolean))].map(value => ({ value, count: 0 }));
        const allCount = tags.reduce((sum, item) => sum + Number(item.count || 0), 0);
        tagFilters.innerHTML = [`<button class="${activeTag ? '' : 'active'}" data-library-tag="">全部${allCount ? `<small>${allCount}</small>` : ''}</button>`]
            .concat(tags.map(tag => `<button class="${activeTag === tag.value ? 'active' : ''}" data-library-tag="${escapeHtml(tag.value)}">${escapeHtml(tag.value)}${Number.isFinite(Number(tag.count)) ? `<small>${Number(tag.count)}</small>` : ''}</button>`))
            .join('');
        syncExpandableFilter(tagFilters, expandTagsButton, tagsExpanded);
    }

    function renderPageTypeFilters() {
        const types = availablePageTypes.length
            ? availablePageTypes
            : [...new Set(libraryItems.map(item => item.pageType).filter(Boolean))].map(value => ({ value, count: 0 }));
        const allCount = types.reduce((sum, item) => sum + Number(item.count || 0), 0);
        pageTypeFilters.innerHTML = [`<button class="${activePageType ? '' : 'active'}" data-library-page-type="">全部页型${allCount ? `<small>${allCount}</small>` : ''}</button>`]
            .concat(types.map(item => `<button class="${activePageType === item.value ? 'active' : ''}" data-library-page-type="${escapeHtml(item.value)}">${escapeHtml(item.value)}${Number.isFinite(Number(item.count)) ? `<small>${Number(item.count)}</small>` : ''}</button>`))
            .join('');
        syncExpandableFilter(pageTypeFilters, expandPageTypesButton, pageTypesExpanded);
    }

    function syncExpandableFilter(container, button, expanded) {
        container.classList.toggle('expanded', expanded);
        button.textContent = expanded ? '收起' : '展开';
        requestAnimationFrame(() => {
            const needsExpansion = container.scrollHeight > 40;
            button.classList.toggle('hidden', !needsExpansion);
            if (!needsExpansion) container.classList.remove('expanded');
        });
    }

    function toggleExpandableFilter(container, button, kind) {
        if (kind === 'tags') {
            tagsExpanded = !tagsExpanded;
            localStorage.setItem('slide_material_tags_expanded', tagsExpanded ? '1' : '0');
            syncExpandableFilter(container, button, tagsExpanded);
        } else {
            pageTypesExpanded = !pageTypesExpanded;
            localStorage.setItem('slide_material_page_types_expanded', pageTypesExpanded ? '1' : '0');
            syncExpandableFilter(container, button, pageTypesExpanded);
        }
    }

    function renderFileFilterOptions() {
        const keyword = fileFilterSearch.value.trim().toLocaleLowerCase('zh-CN');
        const visible = availableSourceFiles.filter(item => !keyword || item.value.toLocaleLowerCase('zh-CN').includes(keyword));
        const allOption = keyword ? [] : [{ value: '', count: availableSourceFiles.reduce((sum, item) => sum + item.count, 0), all: true }];
        const options = allOption.concat(visible);
        fileFilterOptions.innerHTML = options.length ? options.map(item => `
            <button type="button" class="${selectedSourceFilename === item.value ? 'active' : ''}" data-source-filename="${escapeHtml(item.value)}" title="${escapeHtml(item.value || '全部文件')}">
                <span>${escapeHtml(item.all ? '全部文件' : item.value)}</span><small>${item.count} 页</small>
            </button>`).join('') : '<div class="material-file-filter-empty">没有匹配的原始文件</div>';
        const label = selectedSourceFilename || '全部文件';
        fileFilterButton.querySelector('span').textContent = label;
        fileFilterButton.title = selectedSourceFilename ? `当前文件：${selectedSourceFilename}` : '按上传的原始文件名筛选';
    }

    function renderPagination() {
        const { page, total, totalPages } = pagination;
        const first = total ? ((page - 1) * pageSize) + 1 : 0;
        const last = Math.min(total, page * pageSize);
        paginationSummary.textContent = total ? `第 ${first}-${last} 条 · 共 ${total} 条` : '共 0 条';
        const candidates = new Set([1, totalPages, page - 2, page - 1, page, page + 1, page + 2]);
        const pages = [...candidates].filter(value => value >= 1 && value <= totalPages).sort((a, b) => a - b);
        const controls = [`<button data-material-page="${page - 1}" ${page <= 1 ? 'disabled' : ''} title="上一页"><i class="ph ph-caret-left"></i></button>`];
        let previous = 0;
        pages.forEach(value => {
            if (previous && value - previous > 1) controls.push('<span>…</span>');
            controls.push(`<button class="${value === page ? 'active' : ''}" data-material-page="${value}">${value}</button>`);
            previous = value;
        });
        controls.push(`<button data-material-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''} title="下一页"><i class="ph ph-caret-right"></i></button>`);
        paginationPages.innerHTML = controls.join('');
        pageSizeSelect.value = String(pageSize);
    }

    function loadLibraryFromFirstPage() {
        currentPage = 1;
        return loadLibrary();
    }

    function closeMaterialEdit() {
        editModal.classList.add('hidden');
        editModal.setAttribute('aria-hidden', 'true');
        editForm.reset();
        editAssetId.value = '';
    }

    function openMaterialEdit(asset) {
        if (!asset || !asset.canEdit) return;
        editAssetId.value = asset.id;
        editSummary.value = asset.summary || '';
        editTag.value = asset.tag || '';
        editTags.value = (asset.tags || []).join('，');
        editPageType.value = asset.pageType || '';
        editScenario.value = asset.usageScenario || '';
        editIntent.value = asset.intent || '';
        editModal.classList.remove('hidden');
        editModal.setAttribute('aria-hidden', 'false');
        setTimeout(() => editSummary.focus(), 0);
    }

    async function saveMaterialEdit() {
        const id = editAssetId.value;
        if (!id) return;
        const submitButton = editForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        try {
            await request(`/assets/${encodeURIComponent(id)}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    summary: editSummary.value,
                    tag: editTag.value,
                    tags: editTags.value.split(/[,，、|]/).map(item => item.trim()).filter(Boolean),
                    pageType: editPageType.value,
                    usageScenario: editScenario.value,
                    intent: editIntent.value
                })
            });
            closeMaterialEdit();
            callbacks.setStatus('素材标签与分类已人工更正');
            await loadLibrary();
        } catch (error) {
            alert(error.message);
        } finally {
            submitButton.disabled = false;
        }
    }

    async function deleteMaterialAsset(asset) {
        if (!asset?.canDelete) return;
        if (!confirm(`确定删除“${asset.summary || `第 ${asset.pageNumber} 页素材`}”吗？\n单页 PPT 与缩略图文件也会删除，此操作不可恢复。`)) return;
        try {
            await request(`/assets/${encodeURIComponent(asset.id)}`, { method: 'DELETE' });
            shelfItems = shelfItems.filter(item => item.id !== asset.id);
            renderShelf();
            callbacks.setStatus('素材已删除');
            await loadLibrary();
        } catch (error) {
            alert(error.message);
        }
    }

    async function regenerateMaterialThumbnail(asset) {
        if (!asset?.canEdit) return;
        showTaskProgress('正在重新生成缩略图', `正在检测 ${navigator.platform || '当前平台'} 可用的渲染引擎…`, 5, true);
        appendTaskLog({ level: 'info', message: `开始重新生成素材 ${asset.id} 的缩略图` });
        const waitingProgress = beginWaitingProgress(64);
        try {
            const result = await request(`/assets/${encodeURIComponent(asset.id)}/regenerate-thumbnail`, { method: 'POST', body: '{}' });
            window.clearInterval(waitingProgress);
            (result.logs || []).forEach(appendTaskLog);
            setTaskProgress(100, `缩略图已通过 ${result.engine || '可用引擎'} 重新生成`);
            appendTaskLog({ level: 'success', message: 'PNG 文件与数据库缩略图路径均已写入成功' });
            callbacks.setStatus('缩略图重新生成成功');
            await loadLibrary();
        } catch (error) {
            window.clearInterval(waitingProgress);
            appendTaskLog({ level: 'error', message: error.message });
            setTaskProgress(100, '缩略图重新生成失败');
            alert(error.message);
        } finally {
            window.clearInterval(waitingProgress);
            hideTaskProgress(1800);
        }
    }

    function renderLibrary() {
        materialGrid.innerHTML = libraryItems.length ? libraryItems.map(asset => `
            <article class="material-card">
                <div class="material-card-preview" data-thumbnail="${asset.thumbnailUrl ? escapeHtml(asset.id) : ''}"><i class="ph ph-presentation-chart"></i></div>
                <div class="material-card-content">
                    <div class="material-card-top"><span class="material-card-tag">${escapeHtml(asset.pageType || asset.usageScenario || asset.tag)}</span><span class="material-card-page">PAGE ${asset.pageNumber}</span></div>
                    <h3>${escapeHtml(asset.summary || '未生成摘要')}</h3>
                    <p title="${escapeHtml(formatExtractedText(asset.intent || asset.extractedText))}">${escapeHtml(formatExtractedText(asset.intent || asset.extractedText) || '本页未提取到可识别文字')}</p>
                    <div class="material-card-extract" title="${escapeHtml(formatExtractedText(asset.extractedText))}">${escapeHtml(formatExtractedText(asset.extractedText) || '本页未提取到可识别文字')}</div>
                    <div class="material-card-tags">${(asset.tags || [asset.tag]).map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
                    <div class="material-card-meta" title="${escapeHtml(asset.sourceFilename)}">${escapeHtml(asset.uploader || '未知用户')} · ${formatTime(asset.importedAt)} · ${escapeHtml(asset.sourceFilename)}</div>
                    <div class="material-card-actions">
                        <button data-insert-asset="${escapeHtml(asset.id)}"><i class="ph ph-plus-circle"></i>&nbsp; 插入项目</button>
                        <button data-shelf-asset="${escapeHtml(asset.id)}"><i class="ph ph-stack-plus"></i>&nbsp; 加入暂存架</button>
                        <button class="material-icon-action" data-download-asset="${escapeHtml(asset.id)}" title="下载单页 PPT"><i class="ph ph-download-simple"></i></button>
                        ${asset.canEdit ? `<button class="material-icon-action" data-edit-asset="${escapeHtml(asset.id)}" title="人工更正标签与分类"><i class="ph ph-pencil-simple"></i></button>` : ''}
                        ${asset.canEdit ? `<button class="material-icon-action" data-regenerate-thumbnail="${escapeHtml(asset.id)}" title="重新生成缩略图"><i class="ph ph-image-square"></i></button>` : ''}
                        ${asset.canDelete ? `<button class="material-icon-action danger" data-delete-asset="${escapeHtml(asset.id)}" title="删除素材"><i class="ph ph-trash"></i></button>` : ''}
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

    function normalizedFacetItems(items = []) {
        return items.map(item => typeof item === 'string'
            ? { value: item, label: item, count: 0 }
            : { value: String(item.value || ''), label: String(item.label || item.value || ''), count: Number(item.count || 0) }
        ).filter(item => item.value);
    }

    function retainSelectedFacet(items, selectedValue, selectedLabel = selectedValue) {
        const normalized = normalizedFacetItems(items);
        if (selectedValue && !normalized.some(item => item.value === selectedValue)) {
            normalized.unshift({ value: selectedValue, label: selectedLabel || selectedValue, count: 0, retained: true });
        }
        return normalized;
    }

    function renderFacetSelect(select, allLabel, items, selectedValue) {
        const total = items.reduce((sum, item) => sum + Number(item.count || 0), 0);
        select.innerHTML = `<option value="">${escapeHtml(allLabel)}${total ? ` (${total})` : ''}</option>`
            + items.map(item => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)} (${item.count})${item.retained ? ' · 已选' : ''}</option>`).join('');
        select.value = selectedValue;
    }

    function currentLibraryFilterParams() {
        const params = new URLSearchParams();
        if (searchInput.value.trim()) params.set('q', searchInput.value.trim());
        if (periodSelect.value) params.set('period', periodSelect.value);
        if (activeTag) params.set('tag', activeTag);
        if (uploaderSelect.value) params.set('uploader', uploaderSelect.value);
        if (scenarioSelect.value) params.set('scenario', scenarioSelect.value);
        if (activePageType) params.set('pageType', activePageType);
        if (selectedSourceFilename) params.set('sourceFilename', selectedSourceFilename);
        return params;
    }

    async function loadFilterOptions() {
        try {
            const filterParams = currentLibraryFilterParams();
            const { uploaders = [], scenarios = [], pageTypes = [], tags = [], periods = [], sourceFiles = [] } = await request(`/asset-filters?${filterParams}`);
            const selectedUploader = uploaderSelect.value;
            const selectedScenario = scenarioSelect.value;
            const selectedPeriod = periodSelect.value;
            const uploaderItems = retainSelectedFacet(uploaders, selectedUploader);
            const scenarioItems = retainSelectedFacet(scenarios, selectedScenario);
            const periodItems = retainSelectedFacet(periods, selectedPeriod, selectedPeriod.replace('-', ' '));
            renderFacetSelect(uploaderSelect, '全部上传人', uploaderItems, selectedUploader);
            renderFacetSelect(scenarioSelect, '全部用途', scenarioItems, selectedScenario);
            renderFacetSelect(periodSelect, '全部时间', periodItems, selectedPeriod);
            availableTags = retainSelectedFacet(tags, activeTag);
            availablePageTypes = retainSelectedFacet(pageTypes, activePageType);
            availableSourceFiles = retainSelectedFacet(sourceFiles, selectedSourceFilename);
            renderTagFilters();
            renderPageTypeFilters();
            renderFileFilterOptions();
        } catch (_) { /* 筛选项失败不影响素材检索 */ }
    }

    async function loadLibrary() {
        const params = currentLibraryFilterParams();
        params.set('page', String(currentPage));
        params.set('pageSize', String(pageSize));
        materialGrid.innerHTML = '<div class="project-empty">正在检索素材库…</div>';
        try {
            const result = await request(`/assets?${params}`);
            const { items } = result;
            libraryItems = items;
            pagination = result.pagination || { page: 1, pageSize, total: items.length, totalPages: 1 };
            currentPage = pagination.page;
            await loadFilterOptions();
            renderLibrary();
            renderPagination();
        } catch (error) {
            materialGrid.innerHTML = `<div class="project-empty">读取失败：${escapeHtml(error.message)}</div>`;
            pagination = { page: 1, pageSize, total: 0, totalPages: 1 };
            renderPagination();
        }
    }

    async function openLibraryForImportedFile(sourceFilename) {
        searchInput.value = '';
        periodSelect.value = '';
        uploaderSelect.value = '';
        scenarioSelect.value = '';
        activeTag = '';
        activePageType = '';
        selectedSourceFilename = String(sourceFilename || '').trim();
        fileFilterSearch.value = '';
        fileFilterMenu.classList.add('hidden');
        currentPage = 1;
        library.classList.remove('hidden');
        library.setAttribute('aria-hidden', 'false');
        renderFileFilterOptions();
        await loadLibrary();
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
    addMaterialAssetButton.addEventListener('click', () => materialAssetImportInput.click());
    materialAssetImportInput.addEventListener('change', () => importPptx(materialAssetImportInput.files[0], { singlePageOnly: true }));
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
    searchInput.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadLibraryFromFirstPage, 320); });
    periodSelect.addEventListener('change', loadLibraryFromFirstPage);
    uploaderSelect.addEventListener('change', loadLibraryFromFirstPage);
    scenarioSelect.addEventListener('change', loadLibraryFromFirstPage);
    fileFilterButton.addEventListener('click', () => {
        const opening = fileFilterMenu.classList.contains('hidden');
        fileFilterMenu.classList.toggle('hidden', !opening);
        if (opening) {
            fileFilterSearch.value = '';
            renderFileFilterOptions();
            setTimeout(() => fileFilterSearch.focus(), 0);
        }
    });
    fileFilterSearch.addEventListener('input', renderFileFilterOptions);
    fileFilterOptions.addEventListener('click', event => {
        const button = event.target.closest('[data-source-filename]');
        if (!button) return;
        selectedSourceFilename = button.dataset.sourceFilename;
        fileFilterMenu.classList.add('hidden');
        fileFilterSearch.value = '';
        renderFileFilterOptions();
        loadLibraryFromFirstPage();
    });
    document.addEventListener('click', event => {
        if (!fileFilter.contains(event.target)) fileFilterMenu.classList.add('hidden');
    });
    document.getElementById('resetLibraryFiltersBtn').addEventListener('click', () => {
        searchInput.value = '';
        periodSelect.value = '';
        uploaderSelect.value = '';
        scenarioSelect.value = '';
        activeTag = '';
        activePageType = '';
        selectedSourceFilename = '';
        fileFilterSearch.value = '';
        renderFileFilterOptions();
        loadLibraryFromFirstPage();
    });
    tagFilters.addEventListener('click', event => {
        const button = event.target.closest('[data-library-tag]');
        if (!button) return;
        activeTag = button.dataset.libraryTag;
        loadLibraryFromFirstPage();
    });
    pageTypeFilters.addEventListener('click', event => {
        const button = event.target.closest('[data-library-page-type]');
        if (!button) return;
        activePageType = button.dataset.libraryPageType;
        loadLibraryFromFirstPage();
    });
    expandTagsButton.addEventListener('click', () => toggleExpandableFilter(tagFilters, expandTagsButton, 'tags'));
    expandPageTypesButton.addEventListener('click', () => toggleExpandableFilter(pageTypeFilters, expandPageTypesButton, 'pageTypes'));
    paginationPages.addEventListener('click', event => {
        const button = event.target.closest('[data-material-page]');
        if (!button || button.disabled) return;
        currentPage = Number(button.dataset.materialPage);
        loadLibrary();
    });
    pageSizeSelect.addEventListener('change', () => {
        pageSize = Number(pageSizeSelect.value);
        localStorage.setItem('slide_material_page_size', String(pageSize));
        loadLibraryFromFirstPage();
    });
    materialGrid.addEventListener('click', async event => {
        const insertButton = event.target.closest('[data-insert-asset]');
        const downloadButton = event.target.closest('[data-download-asset]');
        const shelfButton = event.target.closest('[data-shelf-asset]');
        const editButton = event.target.closest('[data-edit-asset]');
        const deleteButton = event.target.closest('[data-delete-asset]');
        const regenerateButton = event.target.closest('[data-regenerate-thumbnail]');
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
        } else if (editButton) {
            const asset = libraryItems.find(item => item.id === editButton.dataset.editAsset);
            if (asset) openMaterialEdit(asset);
        } else if (regenerateButton) {
            const asset = libraryItems.find(item => item.id === regenerateButton.dataset.regenerateThumbnail);
            if (asset) regenerateMaterialThumbnail(asset);
        } else if (deleteButton) {
            const asset = libraryItems.find(item => item.id === deleteButton.dataset.deleteAsset);
            if (asset) deleteMaterialAsset(asset);
        }
    });
    document.getElementById('closeMaterialPreviewBtn').addEventListener('click', closeMaterialPreview);
    previewModal.addEventListener('click', event => { if (event.target === previewModal) closeMaterialPreview(); });
    document.getElementById('closeMaterialEditBtn').addEventListener('click', closeMaterialEdit);
    document.getElementById('cancelMaterialEditBtn').addEventListener('click', closeMaterialEdit);
    editModal.addEventListener('click', event => { if (event.target === editModal) closeMaterialEdit(); });
    editForm.addEventListener('submit', event => { event.preventDefault(); saveMaterialEdit(); });
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
        if (event.key === 'Escape' && !editModal.classList.contains('hidden')) {
            closeMaterialEdit();
            return;
        }
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
    loadImportCapabilities();
    renderShelf();
    return {
        scheduleAutoSave,
        saveNow,
        openHub: () => hub.classList.remove('is-hidden'),
        getCurrentProject: () => currentProject
    };
}
