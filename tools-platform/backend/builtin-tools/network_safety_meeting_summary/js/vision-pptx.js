// Native text and separate visual objects, in the slide's current paint order.
// The Canva-derived bitmap objects remain replaceable pictures in PowerPoint.
export function rgbHex(value) {
    if (/^#[0-9a-f]{6}$/i.test(value)) return value.slice(1);
    const channels = String(value).match(/[\d.]+/g);
    return channels?.length >= 3
        ? channels.slice(0, 3).map(v => Math.max(0, Math.min(255, Math.round(Number(v)))).toString(16).padStart(2, '0')).join('')
        : '293746';
}

function ancestors(node, root) {
    const result = [];
    for (let current = node; current && current !== root; current = current.parentElement) result.unshift(current);
    return result;
}

export function visibleForExport(node, root, styleOf = getComputedStyle) {
    return ancestors(node, root).every(el => {
        const style = styleOf(el);
        return el.dataset.pptHidden !== 'true' && style.visibility !== 'hidden'
            && style.display !== 'none' && Number(style.opacity || 1) > 0;
    });
}

function collectObjects(root) {
    const candidates = [...root.querySelectorAll('.vision-element, .ppt-created-element, .ppt-group, .ppt-element')];
    // A group is exported through its independent children, never as a page image.
    return candidates.filter(node => !node.classList.contains('ppt-group')
        && !node.querySelector('.vision-element, .ppt-created-element')
        && !node.closest('.vision-element')?.isSameNode(node.parentElement)
        && !ancestors(node.parentElement, root).some(el => el.matches('.vision-element, .ppt-created-element'))
        && visibleForExport(node, root))
        .map((node, order) => ({node, order, chain: ancestors(node, root).map(el => Number.parseInt(getComputedStyle(el).zIndex, 10) || 0)}))
        .sort((a, b) => {
            for (let i = 0; i < Math.max(a.chain.length, b.chain.length); i++) {
                const delta = (a.chain[i] || 0) - (b.chain[i] || 0);
                if (delta) return delta;
            }
            return a.order - b.order;
        }).map(item => item.node);
}

export async function addVisionObjects(pptSlide, root, rasterize = window.html2canvas) {
    const slideRect = root.getBoundingClientRect();
    const xScale = 10 / slideRect.width, yScale = 5.625 / slideRect.height;
    const nodes = collectObjects(root);
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        const chain = ancestors(node, root);
        const rotate = chain.reduce((total, el) => total + (Number.parseFloat(el.dataset.pptRotate || el.style.rotate) || 0), 0);
        const width = node.offsetWidth || rect.width, height = node.offsetHeight || rect.height;
        const geometry = {
            x: (rect.left - slideRect.left + rect.width / 2 - width / 2) * xScale,
            y: (rect.top - slideRect.top + rect.height / 2 - height / 2) * yScale,
            w: width * xScale, h: height * yScale,
            rotate: ((rotate % 360) + 360) % 360
        };
        if (!geometry.w || !geometry.h) continue;
        const text = node.matches('.vision-text, .editable') && !node.querySelector('img, svg, table')
            ? node.innerText : null;
        if (text !== null) {
            pptSlide.addText(text, {
                ...geometry, margin: 0, valign: 'top',
                fontFace: style.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
                fontSize: Number.parseFloat(style.fontSize) * xScale * 72,
                color: rgbHex(style.color), bold: Number.parseInt(style.fontWeight, 10) >= 600,
                italic: style.fontStyle === 'italic',
                align: style.textAlign === 'center' ? 'center' : ['right','end'].includes(style.textAlign) ? 'right' : 'left',
                breakLine: false,
                charSpacing: (Number.parseFloat(style.letterSpacing) || 0) * xScale * 72,
                lineSpacingMultiple: Number.parseFloat(style.lineHeight) / Number.parseFloat(style.fontSize) || 1.2,
                transparency: Math.round((1 - chain.reduce((opacity, el) => opacity * Number(getComputedStyle(el).opacity || 1), 1)) * 100)
            });
        } else {
            // Rasterize only this object: preserve gradients, shadows and icons,
            // while retaining a separately movable/resizable PPT picture.
            const canvas = await rasterize(node, {scale: 2, backgroundColor: null, useCORS: true});
            const unique = document.createElement('canvas');
            unique.width = canvas.width;
            unique.height = canvas.height + i;
            unique.getContext('2d').drawImage(canvas, 0, 0);
            pptSlide.addImage({data: unique.toDataURL('image/png'), ...geometry,
                // A rotated capture already includes rotation; use its actual bounds.
                x: (rect.left - slideRect.left) * xScale,
                y: (rect.top - slideRect.top) * yScale,
                w: rect.width * xScale,
                h: rect.height * yScale * unique.height / canvas.height,
                rotate: 0,
                altText: node.dataset.componentName || '视觉元素'});
            canvas.width = canvas.height = unique.width = unique.height = 0;
        }
    }
    return nodes.length;
}
