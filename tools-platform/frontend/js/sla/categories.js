window.GlobalCategories = ['TE', 'ORG', 'ET', 'VDF'];
let pendingCascadeDelete = null;

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
            <span style="color: #1565c0; font-weight: bold; font-size: 13px;">${escapeHTML(c)}</span>
            <button onclick="removeCategory(${i})" style="background:none; border:none; color: #d32f2f; cursor:pointer; font-size: 12px; padding: 0;" title="级联删除分类及关联数据">✖</button>
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

function ensureCategoryCascadeModal() {
    let modal = document.getElementById('category-cascade-delete-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'category-cascade-delete-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'display:none; z-index:100001;';
    modal.innerHTML = `
        <div class="modal-content" style="width:min(920px, 94vw); max-height:88vh; display:flex; flex-direction:column;">
            <div class="modal-header">
                <div>
                    <h3 style="margin:0; color:#b42318;">级联删除分类</h3>
                    <p id="category-cascade-delete-subtitle" style="margin:6px 0 0; color:#64748b; font-size:12px;"></p>
                </div>
                <button class="modal-close" onclick="closeCategoryCascadeDeleteModal()">✖</button>
            </div>
            <div class="modal-body" id="category-cascade-delete-body" style="padding:16px 20px; overflow:auto; background:#f8fafc;"></div>
            <div class="modal-footer" style="gap:10px;">
                <button class="action-btn" onclick="closeCategoryCascadeDeleteModal()" style="background:#64748b; color:white; border:none;">取消</button>
                <button id="category-cascade-delete-confirm" class="btn-save" onclick="confirmCategoryCascadeDelete()" style="background:#b42318; color:white;">确认级联删除</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

function closeCategoryCascadeDeleteModal() {
    const modal = document.getElementById('category-cascade-delete-modal');
    if (modal) modal.style.display = 'none';
    pendingCascadeDelete = null;
}

function renderImpactSection(title, count, rowsHtml) {
    const empty = !count;
    return `
        <section style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:12px; overflow:hidden;">
            <div style="display:flex; justify-content:space-between; gap:12px; padding:10px 12px; background:${empty ? '#f8fafc' : '#fff7ed'}; border-bottom:1px solid #e2e8f0;">
                <strong style="color:${empty ? '#475569' : '#9a3412'};">${escapeHTML(title)}</strong>
                <span style="font-size:12px; color:#64748b;">${count} 项</span>
            </div>
            <div style="padding:10px 12px; font-size:12px; color:#334155;">
                ${empty ? '<div style="color:#94a3b8;">无关联数据</div>' : rowsHtml}
            </div>
        </section>
    `;
}

function renderCompactList(items, renderItem) {
    return `<div style="display:grid; gap:6px;">${items.map(renderItem).join('')}</div>`;
}

function renderCategoryCascadeImpact(impact) {
    const totals = impact.totals || {};
    const details = impact.details || {};
    const report = details.report || {};
    const totalItems = totals.total_items || 0;
    const title = `将删除分类 "${impact.category}" 及全部关联数据`;
    document.getElementById('category-cascade-delete-subtitle').textContent = title;

    const rules = details.rules || [];
    const ruleTemplates = details.rule_templates || [];
    const slaSnapshots = details.sla_snapshots || [];
    const categoryScores = report.category_scores || [];
    const metricData = report.metric_data || [];
    const rawSnapshots = report.raw_snapshots || [];
    const owners = report.bigscreen_owners || [];

    const summary = `
        <div style="border:1px solid #fecaca; background:#fff1f2; color:#7f1d1d; padding:12px; border-radius:8px; margin-bottom:12px; line-height:1.6;">
            <strong>请确认：</strong>继续后会永久删除该分类在规则、历史快照、报表入库和月报来源中的关联子指标数据。历史报表/月报会随之变化。
            <div style="margin-top:8px; color:#991b1b;">
                分类配置 ${totals.category_rows || 0} 项，规则子指标 ${totals.rule_sub_metrics || 0} 项，SLA 快照子指标 ${totals.sla_snapshot_sub_metrics || 0} 项，
                速填模板行 ${totals.rule_template_lines || 0} 行，报表评分 ${totals.report_category_scores || 0} 行，报表指标 ${totals.report_metric_data || 0} 行，
                报表原始快照子指标 ${totals.report_raw_sub_metrics || 0} 项，大屏负责人 ${totals.bigscreen_owners || 0} 项。
            </div>
        </div>
    `;

    const html = summary +
        renderImpactSection('全局分类配置', totals.category_rows || 0, `<div>sla_categories.name = <strong>${escapeHTML(impact.category)}</strong></div>`) +
        renderImpactSection('子指标规则 sla_prefs.customMetrics[].subMetrics', totals.rule_sub_metrics || 0, renderCompactList(rules, item => `
            <div style="padding:8px; border:1px solid #e2e8f0; border-radius:6px;">
                <strong>${escapeHTML(item.metric_label || '(未命名指标)')}</strong>
                <span style="color:#64748b;"> · ${escapeHTML(item.pref_key)} · ${escapeHTML(item.rule_id)} · ${item.removed_count} 项</span>
                <div style="margin-top:4px; color:#475569;">${(item.sub_metrics || []).map(sm => `${escapeHTML(sm.colX)}=${escapeHTML(sm.valY)} / ${escapeHTML(sm.colZ)}`).join('<br>')}</div>
            </div>
        `)) +
        renderImpactSection('规则速填模板 sla_rule_templates.template_text', totals.rule_template_lines || 0, renderCompactList(ruleTemplates, item => `
            <div style="padding:8px; border:1px solid #e2e8f0; border-radius:6px;">
                <strong>${escapeHTML(item.template_key)}</strong>
                <span style="color:#64748b;"> · ${item.removed_count} 行</span>
                <div style="margin-top:4px; color:#475569;">${(item.lines || []).map(line => escapeHTML(line)).join('<br>')}</div>
            </div>
        `)) +
        renderImpactSection('SLA 历史快照 sla_snapshots.payload_json', totals.sla_snapshot_sub_metrics || 0, renderCompactList(slaSnapshots, item => `
            <div style="padding:8px; border:1px solid #e2e8f0; border-radius:6px;">
                <strong>${escapeHTML(item.id)}</strong>
                <span style="color:#64748b;"> · ${escapeHTML(item.timestamp)} · ${item.sub_metric_count} 项</span>
                <div style="margin-top:4px; color:#475569;">${(item.metrics || []).map(m => `${escapeHTML(m.metric_label)} (${m.removed_count})`).join('，')}</div>
            </div>
        `)) +
        renderImpactSection('报表分类评分 ReportCategoryScores', categoryScores.length, renderCompactList(categoryScores, item => `
            <div>snapshot=${escapeHTML(item.snapshot_id)} · month=${escapeHTML(String(item.month || ''))} · final=${escapeHTML(String(item.final_score ?? ''))}</div>
        `)) +
        renderImpactSection('报表指标明细 ReportMetricData', metricData.length, renderCompactList(metricData, item => `
            <div>snapshot=${escapeHTML(item.snapshot_id)} · month=${escapeHTML(String(item.month || ''))} · ${escapeHTML(item.metric_label)} · raw=${escapeHTML(String(item.raw_val ?? ''))}</div>
        `)) +
        renderImpactSection('报表原始快照 ReportSnapshots.raw_data_json', totals.report_raw_sub_metrics || 0, renderCompactList(rawSnapshots, item => `
            <div style="padding:8px; border:1px solid #e2e8f0; border-radius:6px;">
                <strong>${escapeHTML(item.snapshot_id)}</strong>
                <span style="color:#64748b;"> · month=${escapeHTML(String(item.month || ''))} · ${escapeHTML(item.created_at || '')} · ${item.sub_metric_count} 项</span>
                <div style="margin-top:4px; color:#475569;">${(item.metrics || []).map(m => `${escapeHTML(m.metric_label)} (${m.removed_count})`).join('，')}</div>
            </div>
        `)) +
        renderImpactSection('大屏负责人 BigscreenOwners', owners.length, renderCompactList(owners, item => `
            <div>${escapeHTML(item.owner_name)} · ${escapeHTML(item.emp_id || '')} · ${escapeHTML(item.metric_label || '分类负责人')}</div>
        `));

    document.getElementById('category-cascade-delete-body').innerHTML = html;
    const confirmBtn = document.getElementById('category-cascade-delete-confirm');
    if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = totalItems > 0 ? '确认级联删除' : '确认删除分类';
    }
}

async function removeCategory(index) {
    const category = window.GlobalCategories[index];
    if (!category) return;
    const modal = ensureCategoryCascadeModal();
    modal.style.display = 'flex';
    document.getElementById('category-cascade-delete-subtitle').textContent = `正在检查 "${category}" 的关联数据...`;
    document.getElementById('category-cascade-delete-body').innerHTML = '<div class="loading-text">正在生成删除影响清单...</div>';
    const confirmBtn = document.getElementById('category-cascade-delete-confirm');
    if (confirmBtn) confirmBtn.disabled = true;

    try {
        const impact = await API.get(`/api/sla/categories/${encodeURIComponent(category)}/cascade-impact`);
        pendingCascadeDelete = { category, index, impact };
        renderCategoryCascadeImpact(impact);
    } catch (e) {
        document.getElementById('category-cascade-delete-body').innerHTML = `<div style="color:#b42318;">读取影响清单失败：${escapeHTML(e.message)}</div>`;
    }
}

async function confirmCategoryCascadeDelete() {
    if (!pendingCascadeDelete || !pendingCascadeDelete.category) return;
    const category = pendingCascadeDelete.category;
    const confirmBtn = document.getElementById('category-cascade-delete-confirm');
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = '正在删除...';
    }

    try {
        const result = await API.deleteWithBody(`/api/sla/categories/${encodeURIComponent(category)}/cascade`, { confirm: true });
        window.GlobalCategories = window.GlobalCategories.filter(item => item !== category);
        renderCategoryList();
        closeCategoryCascadeDeleteModal();
        const deleted = result.deleted || {};
        showToast(`✅ 已级联删除分类 ${category}：规则子指标 ${deleted.rule_sub_metrics || 0}，模板行 ${deleted.rule_template_lines || 0}，SLA快照子指标 ${deleted.sla_snapshot_sub_metrics || 0}，报表指标 ${deleted.report_metric_data || 0}`, 'success');
        if (window.renderSLASourcePanel) window.renderSLASourcePanel();
    } catch (e) {
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = '确认级联删除';
        }
        showToast(`级联删除失败: ${e.message}`, 'error');
    }
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
window.closeCategoryCascadeDeleteModal = closeCategoryCascadeDeleteModal;
window.confirmCategoryCascadeDelete = confirmCategoryCascadeDelete;
