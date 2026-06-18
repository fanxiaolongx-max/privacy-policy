const STRUCTURAL_COMPONENTS = [
    '.cover-banner',
    '.cover-copy',
    '.cover-photo',
    '.rule-box',
    '.qr',
    '.agenda-table',
    '.speaker',
    '.case-layout',
    '.sticky-note',
    '.two-col > .box',
    '.footer',
    '.ppt-created-element',
    'img'
].join(', ');

const STANDALONE_TEXT = [
    '.slide-pad > .slide-title',
    '.slide-pad > .small-title',
    '.slide-pad > .plain-list',
    '.slide-pad > .editable'
].join(', ');

const COMPONENT_SELECTOR = `${STRUCTURAL_COMPONENTS}, ${STANDALONE_TEXT}`;
const LOCKED_BY_DEFAULT = '.footer';
const INTERNAL_TEXT_SELECTOR = '.editable, td, th, li, .case-cells > div, .case-labels > div';

function createId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `ppt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function numberStyle(element, property) {
    const inlineValue = parseFloat(element.style[property]);
    if (Number.isFinite(inlineValue)) return inlineValue;
    const computed = getComputedStyle(element);
    if (computed.position === 'absolute' || computed.position === 'fixed') {
        const computedValue = parseFloat(computed[property]);
        if (Number.isFinite(computedValue)) return computedValue;
    }
    return 0;
}

function isTextEditingTarget(target) {
    return Boolean(target.closest('input, textarea, [contenteditable="true"]'));
}

function componentName(element) {
    if (element.classList.contains('ppt-inner-element')) {
        if (element.matches('td, th')) return '表格单元格';
        if (element.matches('li')) return '列表项';
        if (element.matches('.rule-head')) return '卡片标题';
        if (element.matches('.case-cells > div')) return '案例内容';
        if (element.matches('.case-labels > div')) return '案例标签';
        return '内部文本';
    }
    if (element.classList.contains('agenda-table')) return '表格';
    if (element.classList.contains('rule-box')) return '规则卡片';
    if (element.classList.contains('qr')) return '二维码';
    if (element.classList.contains('speaker')) return '人物介绍';
    if (element.classList.contains('case-layout')) return '案例区块';
    if (element.classList.contains('sticky-note')) return '便签';
    if (element.classList.contains('cover-photo')) return '封面图片';
    if (element.classList.contains('cover-banner')) return '封面横幅';
    if (element.classList.contains('cover-copy')) return '封面文字';
    if (element.classList.contains('footer')) return '页脚';
    if (element.matches('img')) return '图片';
    if (element.matches('.slide-title, .small-title')) return '标题';
    if (element.classList.contains('box')) return '内容卡片';
    return '文本';
}

export function createComponentEditor({ deck, getScale, onChange, onStatus }) {
    let selected = null;
    const selectedSet = new Set();
    let clipboard = [];
    let moveable = null;
    let toolbar = null;
    let directDrag = null;
    let directResize = null;
    let directRotate = null;
    let layerPointerDrag = null;
    let suppressClick = false;
    const layersList = document.getElementById('layersList');
    const propertiesPanel = document.getElementById('propertiesPanel');
    let verticalGuide = null;
    let horizontalGuide = null;
    let editingComponent = null;
    let editingTarget = null;

    function ensureToolbar() {
        if (toolbar) return toolbar;
        toolbar = document.createElement('div');
        toolbar.className = 'ppt-component-toolbar';
        toolbar.innerHTML = `
            <span class="ppt-component-name">组件</span>
            <button type="button" data-action="parent" title="选择父组件"><i class="ph-bold ph-arrow-bend-up-left"></i></button>
            <button type="button" data-action="edit" title="编辑文字（双击）"><i class="ph-bold ph-text-t"></i></button>
            <button type="button" data-action="duplicate" title="复制组件（Ctrl/Cmd+D）"><i class="ph-bold ph-copy"></i></button>
            <button type="button" data-action="lock" title="锁定/解锁"><i class="ph-bold ph-lock-key"></i></button>
            <button type="button" data-action="front" title="置于顶层"><i class="ph-bold ph-stack-simple"></i></button>
            <button type="button" data-action="delete" title="删除（Delete）"><i class="ph-bold ph-trash"></i></button>
        `;
        document.body.appendChild(toolbar);
        toolbar.addEventListener('mousedown', event => event.preventDefault());
        toolbar.addEventListener('click', event => {
            const action = event.target.closest('button')?.dataset.action;
            if (!action || !selectedSet.size) return;
            if (action === 'parent') selectParent();
            if (action === 'edit' && selectedSet.size === 1) startTextEditing(selected);
            if (action === 'duplicate') duplicateSelected();
            if (action === 'lock') toggleLock();
            if (action === 'front') bringToFront();
            if (action === 'delete') deleteSelected();
        });
        return toolbar;
    }

    function ensureMoveable() {
        if (moveable) return moveable;
        const controlBox = document.createElement('div');
        controlBox.className = 'moveable-control-box ppt-manual-control-box';
        controlBox.innerHTML = `
            <span class="moveable-line moveable-line-top"></span>
            <span class="moveable-line moveable-line-right"></span>
            <span class="moveable-line moveable-line-bottom"></span>
            <span class="moveable-line moveable-line-left"></span>
            ${['n', 'e', 's', 'w', 'nw', 'ne', 'se', 'sw'].map(direction =>
                `<span class="moveable-control moveable-direction moveable-${direction} moveable-resizable"></span>`
            ).join('')}
            <span class="moveable-rotation-line"></span>
            <span class="moveable-control moveable-rotation-control"></span>
        `;
        document.body.appendChild(controlBox);
        moveable = {
            element: controlBox,
            target: null,
            resizable: false,
            rotatable: false,
            updateRect() {
                const target = this.target;
                if (!target || !target.isConnected) {
                    controlBox.style.display = 'none';
                    return;
                }
                const rect = target.getBoundingClientRect();
                controlBox.style.display = 'block';
                controlBox.style.left = `${rect.left}px`;
                controlBox.style.top = `${rect.top}px`;
                controlBox.style.width = `${rect.width}px`;
                controlBox.style.height = `${rect.height}px`;
                controlBox.classList.toggle('is-resizable', Boolean(this.resizable));
                controlBox.classList.toggle('is-rotatable', Boolean(this.rotatable));
            }
        };
        return moveable;
    }

    function refreshMoveable() {
        if (!moveable) return;
        moveable.updateRect();
    }

    function getSelectedElements() {
        return Array.from(selectedSet).filter(element => element.isConnected);
    }

    function selectedEditable(element = selected) {
        if (!element) return null;
        if (element.classList.contains('ppt-inner-element')) return element;
        return element.matches('.editable') ? element : element.querySelector('.editable');
    }

    function isImageComponent(element = selected) {
        return Boolean(element?.matches('img, .cover-photo, .avatar, .qr-box, .ppt-image-placeholder')
            || element?.querySelector('.qr-box, img'));
    }

    function imageTarget(element = selected) {
        if (!element) return null;
        if (element.matches('img, .cover-photo, .avatar, .qr-box, .ppt-image-placeholder')) return element;
        return element.querySelector('.qr-box, img');
    }

    function isTableComponent(element = selected) {
        return Boolean(element?.matches('table, .agenda-table, td, th') || element?.closest('table'));
    }

    function isLayoutBoundInner(element = selected) {
        return Boolean(element?.matches('td, th, li') || element?.closest('table'));
    }

    function parentComponent(element = selected) {
        if (!element?.classList.contains('ppt-inner-element')) return null;
        return element.parentElement?.closest('.ppt-element') || null;
    }

    function internalEditTargets(component) {
        if (!component) return [];
        if (component.classList.contains('ppt-inner-element')) {
            const parent = parentComponent(component);
            return parent ? internalEditTargets(parent) : [component];
        }
        const candidates = Array.from(component.querySelectorAll(INTERNAL_TEXT_SELECTOR));
        const leafTargets = candidates.filter(candidate => {
            return !candidates.some(other => other !== candidate && candidate.contains(other));
        });
        if (component.matches('.editable') && !leafTargets.length) leafTargets.push(component);
        return leafTargets;
    }

    function activeSlide() {
        return deck.querySelector('.slide-wrap.is-active .slide');
    }

    function elementRectInSlide(element) {
        const slide = element.closest('.slide');
        const slideRect = slide.getBoundingClientRect();
        const rect = element.getBoundingClientRect();
        const scale = getScale();
        return {
            left: (rect.left - slideRect.left) / scale,
            top: (rect.top - slideRect.top) / scale,
            right: (rect.right - slideRect.left) / scale,
            bottom: (rect.bottom - slideRect.top) / scale,
            width: rect.width / scale,
            height: rect.height / scale,
            centerX: (rect.left + rect.width / 2 - slideRect.left) / scale,
            centerY: (rect.top + rect.height / 2 - slideRect.top) / scale
        };
    }

    function selectionBounds(elements = getSelectedElements()) {
        if (!elements.length) return null;
        const rects = elements.map(elementRectInSlide);
        const left = Math.min(...rects.map(rect => rect.left));
        const top = Math.min(...rects.map(rect => rect.top));
        const right = Math.max(...rects.map(rect => rect.right));
        const bottom = Math.max(...rects.map(rect => rect.bottom));
        return {
            left,
            top,
            right,
            bottom,
            width: right - left,
            height: bottom - top,
            centerX: (left + right) / 2,
            centerY: (top + bottom) / 2
        };
    }

    function ensureGuides() {
        const slide = activeSlide();
        if (!slide) return;
        if (!verticalGuide || verticalGuide.parentElement !== slide) {
            verticalGuide?.remove();
            verticalGuide = document.createElement('div');
            verticalGuide.className = 'ppt-snap-guide is-vertical';
            slide.appendChild(verticalGuide);
        }
        if (!horizontalGuide || horizontalGuide.parentElement !== slide) {
            horizontalGuide?.remove();
            horizontalGuide = document.createElement('div');
            horizontalGuide.className = 'ppt-snap-guide is-horizontal';
            slide.appendChild(horizontalGuide);
        }
    }

    function hideGuides() {
        verticalGuide?.classList.remove('is-visible');
        horizontalGuide?.classList.remove('is-visible');
    }

    function snapDrag(dx, dy, baseBounds = null) {
        const selectedElements = getSelectedElements();
        const bounds = baseBounds || selectionBounds(selectedElements);
        const slide = activeSlide();
        if (!bounds || !slide) return { dx, dy };
        const others = Array.from(slide.querySelectorAll('.ppt-element'))
            .filter(element => !selectedSet.has(element) && !element.classList.contains('ppt-hidden'));
        const xTargets = [0, 240, 480];
        const yTargets = [0, 180, 360];
        others.forEach(element => {
            const rect = elementRectInSlide(element);
            xTargets.push(rect.left, rect.centerX, rect.right);
            yTargets.push(rect.top, rect.centerY, rect.bottom);
        });
        const movingX = [bounds.left + dx, bounds.centerX + dx, bounds.right + dx];
        const movingY = [bounds.top + dy, bounds.centerY + dy, bounds.bottom + dy];
        const threshold = 5;
        let bestX = null;
        let bestY = null;
        movingX.forEach(value => xTargets.forEach(target => {
            const diff = target - value;
            if (Math.abs(diff) <= threshold && (!bestX || Math.abs(diff) < Math.abs(bestX.diff))) {
                bestX = { diff, target };
            }
        }));
        movingY.forEach(value => yTargets.forEach(target => {
            const diff = target - value;
            if (Math.abs(diff) <= threshold && (!bestY || Math.abs(diff) < Math.abs(bestY.diff))) {
                bestY = { diff, target };
            }
        }));
        ensureGuides();
        if (bestX) {
            dx += bestX.diff;
            verticalGuide.style.left = `${bestX.target}px`;
            verticalGuide.classList.add('is-visible');
        } else {
            verticalGuide?.classList.remove('is-visible');
        }
        if (bestY) {
            dy += bestY.diff;
            horizontalGuide.style.top = `${bestY.target}px`;
            horizontalGuide.classList.add('is-visible');
        } else {
            horizontalGuide?.classList.remove('is-visible');
        }
        return { dx, dy };
    }

    function markComponents(root = deck) {
        root.querySelectorAll('.editable').forEach(editable => {
            editable.dataset.pptEditable = 'true';
            if (!editable.classList.contains('ppt-editing')) {
                editable.setAttribute('contenteditable', 'false');
            }
        });
        root.querySelectorAll(COMPONENT_SELECTOR).forEach(element => {
            element.classList.add('ppt-element');
            element.dataset.pptElementId ||= createId();
            element.dataset.pptElementType ||= componentName(element);
            element.classList.toggle('ppt-hidden', element.dataset.pptHidden === 'true');
            if (element.dataset.pptHidden === 'true') element.style.visibility = 'hidden';
            if (element.matches(LOCKED_BY_DEFAULT) && !element.hasAttribute('data-ppt-lock-set')) {
                element.classList.add('ppt-locked');
                element.dataset.pptLockSet = 'true';
            }
        });
        root.querySelectorAll('.ppt-element').forEach(component => {
            internalEditTargets(component).forEach(target => {
                if (target === component) return;
                target.classList.add('ppt-inner-element');
                target.dataset.pptElementId ||= createId();
                target.dataset.pptElementType ||= componentName(target);
                target.dataset.pptEditable = 'true';
                if (target !== editingTarget) target.setAttribute('contenteditable', 'false');
            });
        });
    }

    function resolveComponent(target) {
        const inner = target.closest('.ppt-inner-element');
        if (inner && inner.closest('.slide')) return inner;
        const structural = target.closest(STRUCTURAL_COMPONENTS);
        if (structural && structural.closest('.slide')) return structural;
        const text = target.closest(STANDALONE_TEXT);
        return text && text.closest('.slide') ? text : null;
    }

    function positionToolbar() {
        const bar = ensureToolbar();
        const elements = getSelectedElements();
        if (!elements.length) {
            bar.classList.remove('is-visible');
            return;
        }
        const rects = elements.map(element => element.getBoundingClientRect());
        const leftEdge = Math.min(...rects.map(rect => rect.left));
        const topEdge = Math.min(...rects.map(rect => rect.top));
        const top = Math.max(8, topEdge - bar.offsetHeight - 8);
        const left = Math.max(8, Math.min(window.innerWidth - bar.offsetWidth - 8, leftEdge));
        bar.style.top = `${top}px`;
        bar.style.left = `${left}px`;
        bar.querySelector('.ppt-component-name').textContent = elements.length > 1
            ? `已选 ${elements.length} 个`
            : selected.dataset.pptElementType || componentName(selected);
        bar.querySelector('[data-action="parent"]').style.display = parentComponent(selected) ? '' : 'none';
        bar.querySelector('[data-action="edit"]').style.display = elements.length === 1 ? '' : 'none';
        bar.querySelector('[data-action="lock"] i').className = elements.every(element => element.classList.contains('ppt-locked'))
            ? 'ph-bold ph-lock-key-open'
            : 'ph-bold ph-lock-key';
        bar.classList.add('is-visible');
    }

    function rgbToHex(color) {
        const match = color?.match(/\d+/g);
        if (!match || match.length < 3) return '#000000';
        return `#${match.slice(0, 3).map(value => Number(value).toString(16).padStart(2, '0')).join('')}`;
    }

    function renderProperties() {
        if (!propertiesPanel) return;
        const elements = getSelectedElements();
        const empty = propertiesPanel.querySelector('.properties-empty');
        const content = propertiesPanel.querySelector('.properties-content');
        if (elements.length !== 1 || !selected) {
            empty.classList.remove('hidden');
            content.classList.add('hidden');
            empty.textContent = elements.length > 1 ? `已选择 ${elements.length} 个组件，可使用上方对齐工具` : '选择单个组件后编辑属性';
            return;
        }
        empty.classList.add('hidden');
        content.classList.remove('hidden');
        const rect = elementRectInSlide(selected);
        const computed = getComputedStyle(selected);
        const values = {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
            rotate: parseFloat(selected.dataset.pptRotate || computed.rotate || '0') || 0,
            zIndex: parseInt(computed.zIndex, 10) || 0
        };
        Object.entries(values).forEach(([property, value]) => {
            const input = content.querySelector(`[data-property="${property}"]`);
            if (input && document.activeElement !== input) input.value = String(Math.round(value * 100) / 100);
        });

        const editable = selectedEditable();
        const textSection = content.querySelector('.properties-text-section');
        textSection.classList.toggle('hidden', !editable);
        if (editable) {
            const style = getComputedStyle(editable);
            const fontSizeInput = content.querySelector('[data-property="fontSize"]');
            const colorInput = content.querySelector('[data-property="color"]');
            const backgroundInput = content.querySelector('[data-property="backgroundColor"]');
            if (document.activeElement !== fontSizeInput) fontSizeInput.value = String(Math.round(parseFloat(style.fontSize) * 100) / 100);
            if (document.activeElement !== colorInput) colorInput.value = rgbToHex(style.color);
            if (document.activeElement !== backgroundInput) backgroundInput.value = rgbToHex(getComputedStyle(selected).backgroundColor);
            content.querySelector('[data-style-action="bold"]').classList.toggle('is-active', Number(style.fontWeight) >= 600 || style.fontWeight === 'bold');
            content.querySelector('[data-style-action="italic"]').classList.toggle('is-active', style.fontStyle === 'italic');
            ['left', 'center', 'right'].forEach(align => {
                content.querySelector(`[data-style-action="align-${align}"]`).classList.toggle('is-active', style.textAlign === align);
            });
        }

        const imageSection = content.querySelector('.properties-image-section');
        imageSection.classList.toggle('hidden', !isImageComponent());
        if (isImageComponent()) {
            const target = imageTarget();
            const fit = target.matches('img') ? getComputedStyle(target).objectFit : target.dataset.pptObjectFit || 'cover';
            content.querySelector('[data-property="objectFit"]').value = fit;
        }
        content.querySelector('.properties-table-section').classList.toggle('hidden', !isTableComponent());
    }

    function updateSelectionVisuals() {
        deck.querySelectorAll('.ppt-selected, .ppt-selected-secondary').forEach(element => {
            element.classList.remove('ppt-selected', 'ppt-selected-secondary');
        });
        getSelectedElements().forEach(element => {
            element.classList.add(element === selected ? 'ppt-selected' : 'ppt-selected-secondary');
        });
        const controls = ensureMoveable();
        if (controls) {
            const single = selectedSet.size === 1 && selected;
            const transformable = single && !single.classList.contains('ppt-locked') && !isLayoutBoundInner(single);
            controls.target = single || null;
            controls.resizable = Boolean(transformable);
            controls.rotatable = Boolean(transformable);
            refreshMoveable();
        }
        positionToolbar();
        renderLayers();
        renderProperties();
    }

    function select(element, additive = false) {
        if (!element || !element.isConnected) return clearSelection();
        stopTextEditing();
        if (!additive) {
            selectedSet.clear();
            selectedSet.add(element);
            selected = element;
        } else if (selectedSet.has(element)) {
            selectedSet.delete(element);
            if (selected === element) selected = getSelectedElements().at(-1) || null;
        } else {
            selectedSet.add(element);
            selected = element;
        }
        updateSelectionVisuals();
        if (selectedSet.size) onStatus?.(selectedSet.size > 1 ? `已选择 ${selectedSet.size} 个组件` : `${componentName(selected)}已选中；Shift 点击多选`);
    }

    function clearSelection() {
        stopTextEditing();
        selectedSet.clear();
        selected = null;
        updateSelectionVisuals();
        hideGuides();
    }

    function selectParent() {
        const parent = parentComponent();
        if (parent) select(parent, false);
    }

    function placeCaretAtPoint(target, clientX, clientY) {
        const selection = window.getSelection();
        if (!selection) return;
        const range = document.caretRangeFromPoint?.(clientX, clientY)
            || document.caretPositionFromPoint?.(clientX, clientY);
        if (!range) return;
        const node = range.startContainer || range.offsetNode;
        const offset = range.startOffset ?? range.offset;
        if (!node || !target.contains(node)) return;
        const caret = document.createRange();
        caret.setStart(node, offset);
        caret.collapse(true);
        selection.removeAllRanges();
        selection.addRange(caret);
    }

    function startTextEditing(component, preferredEditable = null, point = null) {
        const editable = preferredEditable
            || (component.classList.contains('ppt-inner-element') ? component : null)
            || (component.matches('.editable') ? component : component.querySelector('.editable'));
        if (!editable) {
            onStatus?.('该组件没有可编辑文字');
            return;
        }
        stopTextEditing();
        editingComponent = component.classList.contains('ppt-inner-element') ? parentComponent(component) || component : component;
        editingTarget = editable;
        editingComponent.classList.add('ppt-editing');
        editable.classList.add('ppt-inner-editing');
        editable.setAttribute('contenteditable', 'true');
        editable.focus();
        if (point) {
            placeCaretAtPoint(editable, point.x, point.y);
        } else {
            const selection = window.getSelection();
            selection?.selectAllChildren(editable);
            selection?.collapseToEnd();
        }
        if (moveable) {
            moveable.target = null;
            moveable.resizable = false;
            moveable.rotatable = false;
            refreshMoveable();
        }
    }

    function stopTextEditing() {
        deck.querySelectorAll('.ppt-editing').forEach(component => component.classList.remove('ppt-editing'));
        deck.querySelectorAll('.ppt-inner-editing').forEach(target => target.classList.remove('ppt-inner-editing'));
        deck.querySelectorAll('[data-ppt-editable="true"][contenteditable="true"]').forEach(editable => {
            editable.setAttribute('contenteditable', 'false');
        });
        editingComponent = null;
        editingTarget = null;
        if (selected && moveable) {
            const enabled = !selected.classList.contains('ppt-locked');
            moveable.target = selectedSet.size === 1 ? selected : null;
            moveable.resizable = enabled;
            moveable.rotatable = enabled;
            refreshMoveable();
        }
    }

    function deleteSelected() {
        const targets = getSelectedElements().filter(element => !element.classList.contains('ppt-locked'));
        if (!targets.length) return onStatus?.('所选组件均已锁定');
        clearSelection();
        targets.forEach(target => target.remove());
        commitChange();
    }

    function duplicateSelected() {
        const sources = getSelectedElements();
        if (!sources.length) return;
        const clones = sources.map(source => {
            const clone = source.cloneNode(true);
            clone.classList.remove('ppt-selected', 'ppt-selected-secondary', 'ppt-editing');
            clone.dataset.pptElementId = createId();
            clone.style.position = clone.style.position || (getComputedStyle(source).position === 'static' ? 'relative' : getComputedStyle(source).position);
            clone.style.left = `${numberStyle(source, 'left') + 10}px`;
            clone.style.top = `${numberStyle(source, 'top') + 10}px`;
            source.after(clone);
            return clone;
        });
        markComponents(activeSlide());
        selectedSet.clear();
        clones.forEach(clone => selectedSet.add(clone));
        selected = clones.at(-1);
        updateSelectionVisuals();
        commitChange();
    }

    function copySelected() {
        const sources = getSelectedElements();
        if (!sources.length) return;
        clipboard = sources.map(source => {
            const clone = source.cloneNode(true);
            clone.classList.remove('ppt-selected', 'ppt-selected-secondary', 'ppt-editing');
            return clone;
        });
        onStatus?.(`已复制 ${clipboard.length} 个组件`);
    }

    function pasteClipboard() {
        if (!clipboard.length) return;
        const slide = activeSlide();
        if (!slide) return;
        const clones = clipboard.map(source => {
            const clone = source.cloneNode(true);
            clone.dataset.pptElementId = createId();
            clone.style.position = clone.style.position || 'relative';
            clone.style.left = `${numberStyle(clone, 'left') + 10}px`;
            clone.style.top = `${numberStyle(clone, 'top') + 10}px`;
            slide.appendChild(clone);
            return clone;
        });
        markComponents(slide);
        selectedSet.clear();
        clones.forEach(clone => selectedSet.add(clone));
        selected = clones.at(-1);
        updateSelectionVisuals();
        commitChange();
    }

    function toggleLock() {
        const elements = getSelectedElements();
        if (!elements.length) return;
        const shouldLock = !elements.every(element => element.classList.contains('ppt-locked'));
        elements.forEach(element => {
            element.classList.toggle('ppt-locked', shouldLock);
            element.dataset.pptLockSet = 'true';
        });
        updateSelectionVisuals();
        commitChange();
    }

    function bringToFront() {
        const elements = getSelectedElements();
        if (!elements.length) return;
        const siblings = Array.from(elements[0].parentElement.children);
        const maxZ = siblings.reduce((max, node) => Math.max(max, parseInt(getComputedStyle(node).zIndex, 10) || 0), 0);
        elements.forEach((element, index) => {
            element.style.zIndex = String(maxZ + index + 1);
        });
        commitChange();
    }

    function nudge(dx, dy) {
        const elements = getSelectedElements().filter(element => !element.classList.contains('ppt-locked'));
        if (!elements.length) return;
        elements.forEach(element => {
            element.style.position = element.style.position || (getComputedStyle(element).position === 'static' ? 'relative' : getComputedStyle(element).position);
            element.style.left = `${numberStyle(element, 'left') + dx}px`;
            element.style.top = `${numberStyle(element, 'top') + dy}px`;
        });
        refreshMoveable();
        positionToolbar();
        commitChange();
    }

    function commitChange() {
        refreshMoveable();
        positionToolbar();
        renderLayers();
        onChange?.();
    }

    function handleClick(event) {
        if (event.target.closest('.moveable-control-box, .ppt-component-toolbar')) return;
        if (event.target.closest('[contenteditable="true"], .ppt-editing')) return;
        if (suppressClick) {
            suppressClick = false;
            return;
        }
        const component = resolveComponent(event.target);
        if (!component) {
            if (event.target.closest('.slide')) clearSelection();
            return;
        }
        if (event.shiftKey) window.getSelection()?.removeAllRanges();
        select(component, event.shiftKey);
    }

    function handleDoubleClick(event) {
        const component = resolveComponent(event.target);
        if (!component) return;
        select(component, false);
        const exactTarget = event.target.closest('.ppt-inner-element, td, th, li, .editable');
        startTextEditing(component, exactTarget, { x: event.clientX, y: event.clientY });
        event.preventDefault();
        event.stopPropagation();
    }

    function addElement(kind) {
        const slide = deck.querySelector('.slide-wrap.is-active .slide');
        if (!slide) return;
        let element;
        if (kind === 'title') {
            element = document.createElement('h2');
            element.className = 'ppt-created-element slide-title editable';
            element.textContent = '新标题';
            element.style.width = '260px';
        } else if (kind === 'text') {
            element = document.createElement('div');
            element.className = 'ppt-created-element editable';
            element.textContent = '双击编辑文本';
            element.style.width = '220px';
            element.style.minHeight = '44px';
            element.style.padding = '8px';
            element.style.fontSize = '10px';
        } else if (kind === 'image') {
            element = document.createElement('div');
            element.className = 'ppt-created-element ppt-image-placeholder';
            element.textContent = '双击选择图片';
        } else if (kind === 'table') {
            element = document.createElement('table');
            element.className = 'ppt-created-element agenda-table';
            element.style.width = '320px';
            element.innerHTML = `
                <tbody class="editable" contenteditable="false">
                    <tr class="active"><td class="idx">1</td><td>双击编辑内容</td><td class="owner">负责人</td></tr>
                    <tr><td class="idx">2</td><td>双击编辑内容</td><td class="owner">日期</td></tr>
                </tbody>
            `;
        } else {
            element = document.createElement('div');
            element.className = 'ppt-created-element sticky-note editable';
            element.textContent = '双击编辑便签';
            element.style.transform = 'none';
            element.style.rotate = '-5deg';
        }
        element.style.position = 'absolute';
        element.style.left = '60px';
        element.style.top = '60px';
        element.style.zIndex = '5';
        slide.appendChild(element);
        markComponents(slide);
        select(element);
        commitChange();
        if (kind === 'title' || kind === 'text' || kind === 'note') {
            startTextEditing(element);
        }
    }

    function layerElements() {
        const slide = activeSlide();
        if (!slide) return [];
        return Array.from(slide.querySelectorAll('.ppt-element')).sort((a, b) => {
            const zA = parseInt(getComputedStyle(a).zIndex, 10) || 0;
            const zB = parseInt(getComputedStyle(b).zIndex, 10) || 0;
            if (zA !== zB) return zB - zA;
            return Array.from(slide.querySelectorAll('.ppt-element')).indexOf(b)
                - Array.from(slide.querySelectorAll('.ppt-element')).indexOf(a);
        });
    }

    function renderLayers() {
        if (!layersList) return;
        const elements = layerElements();
        layersList.innerHTML = elements.map(element => {
            const id = element.dataset.pptElementId;
            const name = element.dataset.pptElementType || componentName(element);
            const hidden = element.dataset.pptHidden === 'true';
            const locked = element.classList.contains('ppt-locked');
            const isSelected = selectedSet.has(element);
            return `
                <div class="layer-row ${isSelected ? 'is-selected' : ''} ${hidden ? 'is-hidden' : ''}" draggable="true" data-layer-id="${id}">
                    <span class="layer-drag-handle" title="拖动调整层级"><i class="ph-bold ph-dots-six-vertical"></i></span>
                    <button type="button" class="layer-action" data-layer-action="visibility" title="${hidden ? '显示' : '隐藏'}">
                        <i class="ph-bold ${hidden ? 'ph-eye-slash' : 'ph-eye'}"></i>
                    </button>
                    <span class="layer-name" title="${name}">${name}</span>
                    <button type="button" class="layer-action" data-layer-action="lock" title="${locked ? '解锁' : '锁定'}">
                        <i class="ph-bold ${locked ? 'ph-lock-key' : 'ph-lock-key-open'}"></i>
                    </button>
                    <button type="button" class="layer-action" data-layer-action="raise" title="上移一层">
                        <i class="ph-bold ph-caret-up"></i>
                    </button>
                </div>
            `;
        }).join('');
        document.querySelectorAll('.layers-align-actions button').forEach(button => {
            const distribute = button.dataset.align?.startsWith('distribute');
            button.disabled = selectedSet.size < (distribute ? 3 : 2);
        });
    }

    function findLayerElement(id) {
        return activeSlide()?.querySelector(`.ppt-element[data-ppt-element-id="${CSS.escape(id)}"]`) || null;
    }

    function toggleVisibility(element) {
        const hidden = element.dataset.pptHidden !== 'true';
        element.dataset.pptHidden = String(hidden);
        element.classList.toggle('ppt-hidden', hidden);
        element.style.visibility = hidden ? 'hidden' : '';
        if (hidden && selectedSet.has(element)) {
            selectedSet.delete(element);
            if (selected === element) selected = getSelectedElements().at(-1) || null;
        }
        updateSelectionVisuals();
        commitChange();
    }

    function raiseLayer(element) {
        const elements = layerElements().reverse();
        elements.forEach((item, index) => {
            item.style.zIndex = String(index + 1);
        });
        element.style.zIndex = String(elements.length + 1);
        commitChange();
    }

    function reorderLayer(draggedId, targetId) {
        const orderedTopDown = layerElements();
        const dragged = findLayerElement(draggedId);
        const target = findLayerElement(targetId);
        if (!dragged || !target || dragged === target) return;
        const without = orderedTopDown.filter(element => element !== dragged);
        const targetIndex = without.indexOf(target);
        without.splice(targetIndex, 0, dragged);
        without.reverse().forEach((element, index) => {
            element.style.zIndex = String(index + 1);
        });
        commitChange();
    }

    function moveBy(element, dx, dy) {
        element.style.position = element.style.position || (getComputedStyle(element).position === 'static' ? 'relative' : getComputedStyle(element).position);
        element.style.left = `${numberStyle(element, 'left') + dx}px`;
        element.style.top = `${numberStyle(element, 'top') + dy}px`;
    }

    function alignSelection(action) {
        const elements = getSelectedElements().filter(element => !element.classList.contains('ppt-locked'));
        if (elements.length < 2) return;
        const entries = elements.map(element => ({ element, rect: elementRectInSlide(element) }));
        const bounds = selectionBounds(elements);
        if (action === 'left') entries.forEach(entry => moveBy(entry.element, bounds.left - entry.rect.left, 0));
        if (action === 'center') entries.forEach(entry => moveBy(entry.element, bounds.centerX - entry.rect.centerX, 0));
        if (action === 'right') entries.forEach(entry => moveBy(entry.element, bounds.right - entry.rect.right, 0));
        if (action === 'top') entries.forEach(entry => moveBy(entry.element, 0, bounds.top - entry.rect.top));
        if (action === 'middle') entries.forEach(entry => moveBy(entry.element, 0, bounds.centerY - entry.rect.centerY));
        if (action === 'bottom') entries.forEach(entry => moveBy(entry.element, 0, bounds.bottom - entry.rect.bottom));
        if (action === 'distribute-h' && entries.length >= 3) {
            const sorted = entries.sort((a, b) => a.rect.left - b.rect.left);
            const totalWidth = sorted.reduce((sum, entry) => sum + entry.rect.width, 0);
            const gap = (bounds.width - totalWidth) / (sorted.length - 1);
            let cursor = bounds.left;
            sorted.forEach(entry => {
                moveBy(entry.element, cursor - entry.rect.left, 0);
                cursor += entry.rect.width + gap;
            });
        }
        if (action === 'distribute-v' && entries.length >= 3) {
            const sorted = entries.sort((a, b) => a.rect.top - b.rect.top);
            const totalHeight = sorted.reduce((sum, entry) => sum + entry.rect.height, 0);
            const gap = (bounds.height - totalHeight) / (sorted.length - 1);
            let cursor = bounds.top;
            sorted.forEach(entry => {
                moveBy(entry.element, 0, cursor - entry.rect.top);
                cursor += entry.rect.height + gap;
            });
        }
        commitChange();
    }

    function applyNumericProperty(property, rawValue) {
        if (!selected || selectedSet.size !== 1) return;
        const value = Number(rawValue);
        if (!Number.isFinite(value)) return;
        const rect = elementRectInSlide(selected);
        if (property === 'x') moveBy(selected, value - rect.left, 0);
        if (property === 'y') moveBy(selected, 0, value - rect.top);
        if (property === 'width') selected.style.width = `${Math.max(12, value)}px`;
        if (property === 'height') selected.style.height = `${Math.max(12, value)}px`;
        if (property === 'rotate') {
            selected.dataset.pptRotate = String(value);
            selected.style.rotate = `${value}deg`;
        }
        if (property === 'zIndex') selected.style.zIndex = String(Math.max(0, Math.round(value)));
        if (property === 'fontSize') {
            const editable = selectedEditable();
            if (editable) editable.style.fontSize = `${Math.max(5, value)}px`;
        }
        commitChange();
    }

    function applyTextStyle(action) {
        const editable = selectedEditable();
        if (!editable) return;
        const style = getComputedStyle(editable);
        if (action === 'bold') editable.style.fontWeight = Number(style.fontWeight) >= 600 || style.fontWeight === 'bold' ? '400' : '700';
        if (action === 'italic') editable.style.fontStyle = style.fontStyle === 'italic' ? 'normal' : 'italic';
        if (action.startsWith('align-')) editable.style.textAlign = action.replace('align-', '');
        if (action === 'background-transparent') selected.style.background = 'transparent';
        commitChange();
    }

    function applyObjectFit(value) {
        const target = imageTarget();
        if (!target) return;
        if (target.matches('img')) {
            target.style.objectFit = value;
        } else {
            target.dataset.pptObjectFit = value;
            const backgroundImage = getComputedStyle(target).backgroundImage;
            if (backgroundImage && backgroundImage !== 'none') {
                target.style.backgroundSize = value === 'fill' ? '100% 100%' : value;
                target.style.backgroundPosition = 'center';
                target.style.backgroundRepeat = 'no-repeat';
            }
        }
        commitChange();
    }

    function replaceSelectedImage() {
        const target = imageTarget();
        if (!target) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.addEventListener('change', () => {
            const file = input.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                if (target.matches('img')) {
                    target.src = reader.result;
                } else {
                    const fit = target.dataset.pptObjectFit || 'cover';
                    target.style.backgroundImage = `url("${reader.result}")`;
                    target.style.backgroundPosition = 'center';
                    target.style.backgroundRepeat = 'no-repeat';
                    target.style.backgroundSize = fit === 'fill' ? '100% 100%' : fit;
                    target.classList.add('has-image');
                    if (target.classList.contains('ppt-image-placeholder')) target.textContent = '';
                }
                commitChange();
            };
            reader.readAsDataURL(file);
        }, { once: true });
        input.click();
    }

    function editTable(action) {
        if (!isTableComponent()) return;
        const table = selected.matches('table')
            ? selected
            : selected.closest('table') || selected.querySelector('table');
        if (!table) return;
        const rows = Array.from(table.rows);
        const selectedCell = selected.matches('td, th') && selected.closest('table') === table ? selected : null;
        const selectedRowIndex = selectedCell?.parentElement?.rowIndex ?? rows.length - 1;
        const selectedColumnIndex = selectedCell?.cellIndex ?? (rows[0]?.cells.length || 1) - 1;
        let nextSelection = selectedCell;
        if (action === 'add-row') {
            const columns = rows[0]?.cells.length || 3;
            const insertAt = Math.min(selectedRowIndex + 1, rows.length);
            const row = table.insertRow(insertAt);
            for (let index = 0; index < columns; index++) {
                const cell = row.insertCell();
                cell.textContent = index === 0 ? String(rows.length + 1) : '新内容';
                if (index === 0) cell.className = 'idx';
                if (index === columns - 1) cell.classList.add('owner');
            }
            nextSelection = row.cells[Math.min(selectedColumnIndex, columns - 1)];
        }
        if (action === 'delete-row' && rows.length > 1) {
            const deleteAt = Math.min(selectedRowIndex, rows.length - 1);
            const fallbackRow = rows[deleteAt === rows.length - 1 ? deleteAt - 1 : deleteAt + 1];
            nextSelection = fallbackRow?.cells[Math.min(selectedColumnIndex, fallbackRow.cells.length - 1)] || table;
            table.deleteRow(deleteAt);
        }
        if (action === 'add-column') {
            const insertAt = Math.min(selectedColumnIndex + 1, rows[0]?.cells.length || 0);
            rows.forEach((row, index) => {
                const cell = row.insertCell(insertAt);
                cell.textContent = index === 0 ? '新列' : '新内容';
                if (row === selectedCell?.parentElement) nextSelection = cell;
            });
        }
        if (action === 'delete-column' && (rows[0]?.cells.length || 0) > 1) {
            const deleteAt = Math.min(selectedColumnIndex, rows[0].cells.length - 1);
            const fallbackColumn = deleteAt === rows[0].cells.length - 1 ? deleteAt - 1 : deleteAt + 1;
            nextSelection = selectedCell?.parentElement?.cells[fallbackColumn] || table;
            rows.forEach(row => row.deleteCell(deleteAt));
        }
        Array.from(table.rows).forEach((row, rowIndex) => {
            if (row.cells[0]?.classList.contains('idx')) row.cells[0].textContent = String(rowIndex + 1);
        });
        markComponents(table.closest('.slide') || table);
        if (nextSelection?.isConnected) select(nextSelection, false);
        else select(table, false);
        commitChange();
    }

    function handlePointerDown(event) {
        if (event.button !== 0 || event.target.closest('.moveable-control-box, .ppt-component-toolbar')) return;
        if (event.target.closest('[contenteditable="true"], .ppt-editing')) return;
        const component = resolveComponent(event.target);
        if (!component || component.classList.contains('ppt-locked') || component.classList.contains('ppt-editing')) return;
        if (event.shiftKey) {
            window.getSelection()?.removeAllRanges();
            event.preventDefault();
            return;
        }
        if (!selectedSet.has(component)) select(component, event.shiftKey);
        if (isLayoutBoundInner(component)) return;
        const movable = getSelectedElements().filter(element => !element.classList.contains('ppt-locked'));
        directDrag = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            elements: movable.map(element => ({
                element,
                left: numberStyle(element, 'left'),
                top: numberStyle(element, 'top')
            })),
            bounds: selectionBounds(movable),
            moved: false
        };
        component.setPointerCapture?.(event.pointerId);
    }

    function handlePointerMove(event) {
        if (!directDrag || event.pointerId !== directDrag.pointerId) return;
        let dx = (event.clientX - directDrag.startX) / getScale();
        let dy = (event.clientY - directDrag.startY) / getScale();
        if (!directDrag.moved && Math.hypot(dx, dy) < 2) return;
        directDrag.moved = true;
        ({ dx, dy } = snapDrag(dx, dy, directDrag.bounds));
        directDrag.elements.forEach(item => {
            item.element.style.position = item.element.style.position || (getComputedStyle(item.element).position === 'static' ? 'relative' : getComputedStyle(item.element).position);
            item.element.style.left = `${item.left + dx}px`;
            item.element.style.top = `${item.top + dy}px`;
        });
        refreshMoveable();
        positionToolbar();
        event.preventDefault();
    }

    function handlePointerUp(event) {
        if (!directDrag || event.pointerId !== directDrag.pointerId) return;
        const changed = directDrag.moved;
        directDrag = null;
        hideGuides();
        suppressClick = changed;
        if (changed) commitChange();
    }

    function controlDirection(control) {
        const match = control.className.match(/moveable-(nw|ne|sw|se|n|s|e|w)(?:\s|$)/);
        return match ? match[1] : '';
    }

    function handleControlPointerDown(event) {
        const control = event.target.closest('.moveable-control-box .moveable-control');
        if (!control || selectedSet.size !== 1 || !selected || selected.classList.contains('ppt-locked')) return;
        const rect = selected.getBoundingClientRect();
        const pointerState = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            width: rect.width / getScale(),
            height: rect.height / getScale(),
            left: numberStyle(selected, 'left'),
            top: numberStyle(selected, 'top'),
            moved: false
        };
        if (control.classList.contains('moveable-rotation-control')) {
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            directRotate = {
                ...pointerState,
                centerX,
                centerY,
                startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180 / Math.PI,
                rotation: parseFloat(selected.dataset.pptRotate || '0')
            };
        } else {
            const direction = controlDirection(control);
            if (!direction) return;
            directResize = { ...pointerState, direction };
        }
        control.setPointerCapture?.(event.pointerId);
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    function handleControlPointerMove(event) {
        if (directResize && event.pointerId === directResize.pointerId && selected) {
            const dx = (event.clientX - directResize.startX) / getScale();
            const dy = (event.clientY - directResize.startY) / getScale();
            const west = directResize.direction.includes('w');
            const east = directResize.direction.includes('e');
            const north = directResize.direction.includes('n');
            const south = directResize.direction.includes('s');
            const width = Math.max(12, directResize.width + (east ? dx : west ? -dx : 0));
            const height = Math.max(12, directResize.height + (south ? dy : north ? -dy : 0));
            selected.style.position = selected.style.position || (getComputedStyle(selected).position === 'static' ? 'relative' : getComputedStyle(selected).position);
            selected.style.width = `${width}px`;
            selected.style.height = `${height}px`;
            if (west) selected.style.left = `${directResize.left + dx}px`;
            if (north) selected.style.top = `${directResize.top + dy}px`;
            directResize.moved = true;
            refreshMoveable();
            positionToolbar();
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        if (directRotate && event.pointerId === directRotate.pointerId && selected) {
            const angle = Math.atan2(event.clientY - directRotate.centerY, event.clientX - directRotate.centerX) * 180 / Math.PI;
            const rotation = directRotate.rotation + angle - directRotate.startAngle;
            selected.dataset.pptRotate = String(rotation);
            selected.style.rotate = `${rotation}deg`;
            directRotate.moved = true;
            refreshMoveable();
            positionToolbar();
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }

    function handleControlPointerUp(event) {
        const resized = directResize && event.pointerId === directResize.pointerId;
        const rotated = directRotate && event.pointerId === directRotate.pointerId;
        if (!resized && !rotated) return;
        const changed = directResize?.moved || directRotate?.moved;
        directResize = null;
        directRotate = null;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (changed) commitChange();
    }

    function handleKeydown(event) {
        if (isTextEditingTarget(event.target)) {
            if (event.key === 'Tab' && editingComponent) {
                const targets = internalEditTargets(editingComponent);
                const current = editingTarget || event.target.closest('.ppt-inner-element, .editable, td, th, li');
                const currentIndex = Math.max(0, targets.indexOf(current));
                const direction = event.shiftKey ? -1 : 1;
                const next = targets[(currentIndex + direction + targets.length) % targets.length];
                if (next) {
                    event.preventDefault();
                    select(next, false);
                    startTextEditing(next, next);
                }
                return;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                event.target.blur();
                stopTextEditing();
                refreshMoveable();
            }
            return;
        }
        const command = event.ctrlKey || event.metaKey;
        if (command && event.key.toLowerCase() === 'c' && selectedSet.size) {
            event.preventDefault();
            copySelected();
            return;
        }
        if (command && event.key.toLowerCase() === 'v' && clipboard.length) {
            event.preventDefault();
            pasteClipboard();
            return;
        }
        if (command && event.key.toLowerCase() === 'd' && selectedSet.size) {
            event.preventDefault();
            duplicateSelected();
            return;
        }
        if ((event.key === 'Delete' || event.key === 'Backspace') && selectedSet.size) {
            event.preventDefault();
            deleteSelected();
            return;
        }
        if (event.key === 'Escape') {
            clearSelection();
            return;
        }
        const step = event.shiftKey ? 10 : 1;
        const directions = {
            ArrowLeft: [-step, 0],
            ArrowRight: [step, 0],
            ArrowUp: [0, -step],
            ArrowDown: [0, step]
        };
        if (selectedSet.size && directions[event.key]) {
            event.preventDefault();
            nudge(...directions[event.key]);
        }
    }

    function refresh(root = deck) {
        markComponents(root);
        Array.from(selectedSet).forEach(element => {
            if (!element.isConnected) selectedSet.delete(element);
        });
        if (selected && !selected.isConnected) selected = getSelectedElements().at(-1) || null;
        updateSelectionVisuals();
        refreshMoveable();
        renderLayers();
    }

    markComponents();
    ensureToolbar();
    ensureMoveable();
    renderLayers();
    deck.addEventListener('click', handleClick);
    deck.addEventListener('dblclick', handleDoubleClick);
    deck.addEventListener('pointerdown', handlePointerDown);
    deck.addEventListener('pointermove', handlePointerMove);
    deck.addEventListener('pointerup', handlePointerUp);
    deck.addEventListener('pointercancel', handlePointerUp);
    deck.addEventListener('focusout', event => {
        if (event.target.matches('[data-ppt-editable="true"]')) {
            setTimeout(() => {
                if (editingTarget && document.activeElement === editingTarget) return;
                if (document.activeElement?.matches('[data-ppt-editable="true"][contenteditable="true"]')) return;
                stopTextEditing();
                refreshMoveable();
                onChange?.();
            }, 0);
        }
    });
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('pointerdown', handleControlPointerDown, true);
    document.addEventListener('pointermove', handleControlPointerMove, true);
    document.addEventListener('pointerup', handleControlPointerUp, true);
    document.addEventListener('pointercancel', handleControlPointerUp, true);
    layersList?.addEventListener('click', event => {
        const row = event.target.closest('.layer-row');
        if (!row) return;
        const element = findLayerElement(row.dataset.layerId);
        if (!element) return;
        const action = event.target.closest('[data-layer-action]')?.dataset.layerAction;
        if (action === 'visibility') return toggleVisibility(element);
        if (action === 'lock') {
            if (!selectedSet.has(element)) select(element, false);
            return toggleLock();
        }
        if (action === 'raise') return raiseLayer(element);
        select(element, event.shiftKey);
    });
    layersList?.addEventListener('dragstart', event => {
        const row = event.target.closest('.layer-row');
        if (!row) return;
        event.dataTransfer.setData('text/plain', row.dataset.layerId);
        event.dataTransfer.effectAllowed = 'move';
    });
    layersList?.addEventListener('dragover', event => {
        if (event.target.closest('.layer-row')) event.preventDefault();
    });
    layersList?.addEventListener('drop', event => {
        const row = event.target.closest('.layer-row');
        if (!row) return;
        event.preventDefault();
        reorderLayer(event.dataTransfer.getData('text/plain'), row.dataset.layerId);
    });
    layersList?.addEventListener('pointerdown', event => {
        const handle = event.target.closest('.layer-drag-handle');
        const row = handle?.closest('.layer-row');
        if (!row) return;
        layerPointerDrag = {
            pointerId: event.pointerId,
            layerId: row.dataset.layerId
        };
        handle.setPointerCapture?.(event.pointerId);
        event.preventDefault();
    });
    layersList?.addEventListener('pointerup', event => {
        if (!layerPointerDrag || event.pointerId !== layerPointerDrag.pointerId) return;
        const targetRow = document.elementFromPoint(event.clientX, event.clientY)?.closest('.layer-row');
        const draggedId = layerPointerDrag.layerId;
        layerPointerDrag = null;
        if (targetRow) reorderLayer(draggedId, targetRow.dataset.layerId);
        event.preventDefault();
    });
    layersList?.addEventListener('pointercancel', () => {
        layerPointerDrag = null;
    });
    document.querySelectorAll('.layers-align-actions button').forEach(button => {
        button.addEventListener('click', () => alignSelection(button.dataset.align));
    });
    propertiesPanel?.addEventListener('change', event => {
        const property = event.target.dataset.property;
        if (!property) return;
        if (property === 'objectFit') applyObjectFit(event.target.value);
    });
    propertiesPanel?.addEventListener('input', event => {
        const property = event.target.dataset.property;
        if (['x', 'y', 'width', 'height', 'rotate', 'zIndex', 'fontSize'].includes(property)) {
            applyNumericProperty(property, event.target.value);
        }
        if (property === 'color') {
            const editable = selectedEditable();
            if (editable) {
                editable.style.color = event.target.value;
                commitChange();
            }
        }
        if (property === 'backgroundColor' && selected) {
            selected.style.background = event.target.value;
            commitChange();
        }
    });
    propertiesPanel?.addEventListener('click', event => {
        const styleAction = event.target.closest('[data-style-action]')?.dataset.styleAction;
        if (styleAction) return applyTextStyle(styleAction);
        const imageAction = event.target.closest('[data-image-action]')?.dataset.imageAction;
        if (imageAction === 'replace') return replaceSelectedImage();
        const tableAction = event.target.closest('[data-table-action]')?.dataset.tableAction;
        if (tableAction) return editTable(tableAction);
    });
    window.addEventListener('resize', () => {
        refreshMoveable();
        positionToolbar();
    });
    deckWrapperObserver(deck, () => {
        refreshMoveable();
        positionToolbar();
    });

    return {
        refresh,
        clearSelection,
        refreshControls: refreshMoveable,
        refreshLayers: renderLayers,
        addElement
    };
}

function deckWrapperObserver(deck, callback) {
    if (!window.ResizeObserver) return;
    const wrapper = deck.closest('#deckWrapper');
    if (!wrapper) return;
    const observer = new ResizeObserver(callback);
    observer.observe(wrapper);
}
