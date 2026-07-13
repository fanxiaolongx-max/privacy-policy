/**
 * sla/rule-picker.js - 基于当前导入数据生成规则字段/匹配值选择器
 */
(function () {
    'use strict';

    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>'"]/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[char]));
    }

    function unique(values) {
        return Array.from(new Set((values || []).map(value => String(value || '').trim()).filter(Boolean)));
    }

    function context(mode, valueFields = []) {
        if (window.SLASection && typeof window.SLASection.getRuleDataContext === 'function') {
            return window.SLASection.getRuleDataContext(mode, valueFields);
        }
        return { rowCount: 0, columns: [] };
    }

    function orderCandidates(candidates, selected) {
        const selectedIndex = new Map(selected.map((value, index) => [value, index]));
        return candidates.slice().sort((a, b) => {
            const ai = selectedIndex.has(a.value) ? selectedIndex.get(a.value) : Number.MAX_SAFE_INTEGER;
            const bi = selectedIndex.has(b.value) ? selectedIndex.get(b.value) : Number.MAX_SAFE_INTEGER;
            return ai === bi ? a.value.localeCompare(b.value, 'zh-CN') : ai - bi;
        });
    }

    function renderPicker(options) {
        const mode = options.mode;
        const id = options.id;
        const selected = unique(options.selected);
        const dataContext = context(mode, options.kind === 'value' ? options.fields : []);
        let candidates = [];
        if (options.kind === 'field') {
            candidates = dataContext.columns.map(column => ({ value: column.name, count: column.nonEmptyCount }));
        } else {
            const allowedFields = new Set(unique(options.fields));
            const counts = new Map();
            dataContext.columns.filter(column => allowedFields.has(column.name)).forEach(column => {
                (column.values || []).forEach(item => counts.set(item.value, (counts.get(item.value) || 0) + item.count));
            });
            candidates = Array.from(counts, ([value, count]) => ({ value, count }));
        }
        const candidateValues = new Set(candidates.map(item => item.value));
        const missing = selected.filter(value => !candidateValues.has(value));
        const ordered = orderCandidates(candidates, selected);
        const type = options.multiple === false ? 'radio' : 'checkbox';
        const emptyText = dataContext.rowCount
            ? (options.kind === 'field' ? '当前表没有可用字段' : '所选字段中暂未发现真实取值')
            : '请先导入该类型表格，导入后这里会显示真实候选项';
        const renderChoice = (item, checked) => `<label class="rule-data-choice ${checked ? 'selected' : ''} present" title="当前导入表中存在，${item.count} 行有值">
                <input type="${type}" name="${esc(id)}-choice" value="${esc(item.value)}" ${checked ? 'checked' : ''}>
                <span class="rule-data-choice-name">${esc(item.value)}</span>
                <span class="rule-data-choice-count">${item.count}</span>
            </label>`;
        const selectedCandidates = ordered.filter(item => selected.includes(item.value));
        const otherCandidates = ordered.filter(item => !selected.includes(item.value));
        const selectedChoices = selectedCandidates.map(item => renderChoice(item, true)).join('');
        const otherChoices = otherCandidates.map(item => renderChoice(item, false)).join('');
        const missingChoices = missing.map(value => `<label class="rule-data-choice selected missing" title="配置中已选择，但当前导入表中未发现">
            <input type="${type}" name="${esc(id)}-choice" value="${esc(value)}" checked>
            <span class="rule-data-choice-name">${esc(value)}</span><span class="rule-data-choice-count">表内未发现</span>
        </label>`).join('');
        return `<div class="rule-data-picker" id="${esc(id)}" data-picker-kind="${esc(options.kind)}">
            <div class="rule-data-picker-head"><span>${esc(options.label)}</span><span>${dataContext.rowCount ? `来自当前 ${dataContext.rowCount} 行导入数据` : '暂无导入数据'}</span></div>
            <div class="rule-data-choice-list rule-data-selected-list">${selectedChoices}${missingChoices || ''}${!selectedChoices && !missingChoices ? '<span class="rule-data-picker-empty">尚未选择</span>' : ''}</div>
            ${otherChoices ? `<details class="rule-data-other"><summary>表中其他候选 <b>${otherCandidates.length}</b> 项</summary><div class="rule-data-choice-list rule-data-other-list">${otherChoices}</div></details>` : (!selectedChoices && !missingChoices ? `<div class="rule-data-picker-empty">${emptyText}</div>` : '')}
            <details class="rule-data-manual"><summary>手工补充当前表中没有的项</summary><textarea class="risk-editor-input" data-picker-manual rows="2" placeholder="每行一个，也可用逗号分隔"></textarea></details>
        </div>`;
    }

    function collect(id) {
        const root = document.getElementById(id);
        if (!root) return [];
        const checked = Array.from(root.querySelectorAll('.rule-data-choice input:checked')).map(input => input.value);
        const manual = String(root.querySelector('[data-picker-manual]')?.value || '').split(/[\n,，]/);
        return unique([...checked, ...manual]);
    }

    function hasImportedData(mode) { return context(mode).rowCount > 0; }

    function updateEmptyState(root) {
        const selectedList = root.querySelector('.rule-data-selected-list');
        const selectedCount = selectedList.querySelectorAll('.rule-data-choice').length;
        const empty = selectedList.querySelector('.rule-data-picker-empty');
        if (!selectedCount && !empty) selectedList.insertAdjacentHTML('beforeend', '<span class="rule-data-picker-empty">尚未选择</span>');
        if (selectedCount && empty) empty.remove();
        const details = root.querySelector('.rule-data-other');
        if (!details) return;
        const otherCount = details.querySelectorAll('.rule-data-choice').length;
        const count = details.querySelector('summary b');
        if (count) count.textContent = String(otherCount);
        if (!otherCount) details.remove();
    }

    function handleChoiceChange(input) {
        if (!input || !input.matches('.rule-data-choice input')) return;
        const root = input.closest('.rule-data-picker');
        const label = input.closest('.rule-data-choice');
        const selectedList = root.querySelector('.rule-data-selected-list');
        let otherList = root.querySelector('.rule-data-other-list');
        if (input.checked) {
            label.classList.add('selected');
            selectedList.appendChild(label);
        } else if (label.classList.contains('missing')) {
            label.remove();
        } else {
            if (!otherList) {
                const manual = root.querySelector('.rule-data-manual');
                manual.insertAdjacentHTML('beforebegin', '<details class="rule-data-other"><summary>表中其他候选 <b>0</b> 项</summary><div class="rule-data-choice-list rule-data-other-list"></div></details>');
                otherList = root.querySelector('.rule-data-other-list');
            }
            label.classList.remove('selected');
            otherList.appendChild(label);
        }
        updateEmptyState(root);
    }

    window.SLARulePicker = { renderPicker, collect, context, hasImportedData, handleChoiceChange };
})();
