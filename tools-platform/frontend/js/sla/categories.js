window.GlobalCategories = ['TE', 'ORG', 'ET', 'VDF'];

async function initCategories() {
    try {
        const mode = API.getSourceMode('sla_data');
        const query = mode === 'auto' ? '' : `?mode=${encodeURIComponent(mode)}`;
        const data = await API.get(`/api/sla/categories${query}`);
        if (Array.isArray(data) && data.length > 0) {
            window.GlobalCategories = data;
        }
        if (window.renderSLASourcePanel) window.renderSLASourcePanel();
    } catch (e) {
        console.warn('Failed to load categories, using defaults.');
        if (window.renderSLASourcePanel) window.renderSLASourcePanel();
    }
}

function openCategoryModal() {
    const modal = document.getElementById('category-modal');
    if(modal) modal.style.display = 'flex';
    renderCategoryList();
}

function closeCategoryModal() {
    const modal = document.getElementById('category-modal');
    if(modal) modal.style.display = 'none';
}

function renderCategoryList() {
    const list = document.getElementById('category-list');
    if (!list) return;
    list.innerHTML = window.GlobalCategories.map((c, i) => `
        <div style="background: #e3f2fd; border: 1px solid #90caf9; padding: 4px 10px; border-radius: 12px; display: flex; align-items: center; gap: 6px;">
            <span style="color: #1565c0; font-weight: bold; font-size: 13px;">${c}</span>
            <button onclick="removeCategory(${i})" style="background:none; border:none; color: #d32f2f; cursor:pointer; font-size: 12px; padding: 0;">✖</button>
        </div>
    `).join('');
}

function addCategory() {
    const input = document.getElementById('new-category-input');
    const val = input.value.trim();
    if (!val) return;
    if (window.GlobalCategories.includes(val)) {
        showToast(SLAT('sla.category.exists'), 'warn');
        return;
    }
    window.GlobalCategories.push(val);
    input.value = '';
    renderCategoryList();
}

function removeCategory(index) {
    window.GlobalCategories.splice(index, 1);
    renderCategoryList();
}

async function saveCategories() {
    try {
        await API.put('/api/sla/categories', window.GlobalCategories);
        showToast(SLAT('sla.category.saved'));
        closeCategoryModal();
    } catch (e) {
        showToast(SLAT('sla.category.saveFail', { message: e.message }), 'error');
    }
}

window.openCategoryModal = openCategoryModal;
window.closeCategoryModal = closeCategoryModal;
window.addCategory = addCategory;
window.removeCategory = removeCategory;
window.saveCategories = saveCategories;
window.initCategories = initCategories;
