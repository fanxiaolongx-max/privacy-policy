// js/editor.js
export function scrubClone(clone) {
    clone.querySelectorAll('[contenteditable]').forEach(el => {
        el.removeAttribute('contenteditable');
        el.removeAttribute('tabindex');
    });
    clone.querySelectorAll('.editable').forEach(el => el.classList.remove('editable'));
    clone.querySelectorAll('.is-active').forEach(el => el.classList.remove('is-active'));
    clone.querySelectorAll('.ppt-selected, .ppt-selected-secondary, .ppt-editing, .ppt-inner-editing').forEach(el => {
        el.classList.remove('ppt-selected', 'ppt-selected-secondary', 'ppt-editing', 'ppt-inner-editing');
    });
    clone.querySelectorAll('.ppt-snap-guide').forEach(el => el.remove());
    // Workaround for html2canvas bug with transformed text
    clone.querySelectorAll('.sticky-note').forEach(el => el.style.transform = 'none');
    return clone;
}

export function serializeDeck(deck) {
    const clone = deck.cloneNode(true);
    clone.querySelectorAll('.ppt-selected, .ppt-selected-secondary, .ppt-editing, .ppt-inner-editing').forEach(el => {
        el.classList.remove('ppt-selected', 'ppt-selected-secondary', 'ppt-editing', 'ppt-inner-editing');
    });
    clone.querySelectorAll('.ppt-snap-guide').forEach(el => el.remove());
    clone.querySelectorAll('[contenteditable="true"]').forEach(el => {
        el.setAttribute('contenteditable', 'false');
    });
    return clone.innerHTML;
}

export function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export async function exportPdf(deck, setStatusCallback) {
    if (!window.html2canvas || !window.jspdf || !window.jspdf.jsPDF) {
        alert('缺少 PDF 导出依赖，请检查网络或是否正确加载 html2canvas / jsPDF。');
        return false;
    }
    
    let renderHost = null;
    const originalGetComputedStyle = window.getComputedStyle;

    try {
        // Patch getComputedStyle to fix html2canvas crash with modern color() function
        window.getComputedStyle = function(el, pseudoElt) {
            const style = originalGetComputedStyle(el, pseudoElt);
            return new Proxy(style, {
                get(target, prop) {
                    let val = target[prop];
                    if (typeof val === 'string' && val.includes('color(')) {
                        val = val.replace(/color\((srgb|display-p3)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/g, (match, space, r, g, b, a) => {
                            return `rgba(${Math.round(parseFloat(r)*255)}, ${Math.round(parseFloat(g)*255)}, ${Math.round(parseFloat(b)*255)}, ${a || 1})`;
                        });
                    }
                    return typeof val === 'function' ? val.bind(target) : val;
                }
            });
        };

        document.activeElement && document.activeElement.blur();
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [1920, 1080], compress: true });
        const slides = Array.from(deck.querySelectorAll('.slide'));
        
        renderHost = document.createElement('div');
        renderHost.className = 'pdf-render-host';
        document.body.appendChild(renderHost);
        
        for (let i = 0; i < slides.length; i++) {
            renderHost.innerHTML = '';
            const exportSlide = scrubClone(slides[i].cloneNode(true));
            renderHost.appendChild(exportSlide);
            
            setStatusCallback(`正在生成页面 ${i + 1}/${slides.length}`);
            
            const canvas = await html2canvas(exportSlide, {
                scale: 2,
                backgroundColor: '#fbfbf9',
                useCORS: true,
                windowWidth: 1920,
                windowHeight: 1080,
                width: 1920,
                height: 1080
            });
            const img = canvas.toDataURL('image/jpeg', 0.9);
            if (i > 0) pdf.addPage([1920, 1080], 'landscape');
            pdf.addImage(img, 'JPEG', 0, 0, 1920, 1080);
        }
        
        pdf.save(`华子胶片_${new Date().toISOString().slice(0, 10)}.pdf`);
        return true;
    } catch (err) {
        console.error('PDF Export Error:', err);
        alert(`导出 PDF 失败：${err.message}`);
        return false;
    } finally {
        window.getComputedStyle = originalGetComputedStyle;
        if (renderHost) renderHost.remove();
    }
}


export async function exportPptx(deck, setStatusCallback) {
    if (!window.html2canvas || !window.PptxGenJS) {
        alert('缺少必要库，请检查网络或是否正确加载 html2canvas / PptxGenJS。');
        return false;
    }
    
    let renderHost = null;
    const originalGetComputedStyle = window.getComputedStyle;

    try {
        // Patch getComputedStyle to fix html2canvas crash with modern color() function
        // Also fix the --editor-scale bug for HTML2Canvas
        window.getComputedStyle = function(el, pseudoElt) {
            const style = originalGetComputedStyle(el, pseudoElt);
            return new Proxy(style, {
                get(target, prop) {
                    let val = target[prop];
                    if (typeof val === 'string' && val.includes('color(')) {
                        val = val.replace(/color\((srgb|display-p3)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/g, (match, space, r, g, b, a) => {
                            return `rgba(${Math.round(parseFloat(r)*255)}, ${Math.round(parseFloat(g)*255)}, ${Math.round(parseFloat(b)*255)}, ${a || 1})`;
                        });
                    }
                    if (prop === 'getPropertyValue' || prop === 'getPropertyCSSValue') {
                        return (p) => {
                            if (p === '--editor-scale') return '1';
                            let cssVal = target.getPropertyValue(p);
                            if (typeof cssVal === 'string' && cssVal.includes('color(')) {
                                cssVal = cssVal.replace(/color\((srgb|display-p3)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/g, (match, space, r, g, b, a) => {
                                    return `rgba(${Math.round(parseFloat(r)*255)}, ${Math.round(parseFloat(g)*255)}, ${Math.round(parseFloat(b)*255)}, ${a || 1})`;
                                });
                            }
                            return cssVal;
                        };
                    }
                    return typeof val === 'function' ? val.bind(target) : val;
                }
            });
        };

        document.activeElement && document.activeElement.blur();
        
        const pptx = new window.PptxGenJS();
        pptx.layout = 'LAYOUT_16x9';
        
        const slides = Array.from(deck.querySelectorAll('.slide'));
        
        renderHost = document.createElement('div');
        renderHost.className = 'pdf-render-host';
        document.body.appendChild(renderHost);
        
        for (let i = 0; i < slides.length; i++) {
            renderHost.innerHTML = '';
            const exportSlide = scrubClone(slides[i].cloneNode(true));
            renderHost.appendChild(exportSlide);
            
            setStatusCallback(`正在生成页面 ${i + 1}/${slides.length}`);
            
            const canvas = await html2canvas(exportSlide, {
                scale: 2,
                backgroundColor: '#fbfbf9',
                useCORS: true,
                windowWidth: 1920,
                windowHeight: 1080,
                width: 1920,
                height: 1080
            });
            
            // Fix PptxGenJS aggressive base64 caching bug:
            // 1. We use PNG instead of JPEG so the varying pixel is not crushed by lossy compression.
            // 2. We draw a unique pixel with varying alpha so the image data is mathematically unique.
            // Because PNG is lossless and uses DEFLATE, changing the first pixel completely scrambles the resulting base64 stream.
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = `rgba(0, 0, 0, ${(i + 1) / 255})`;
            ctx.fillRect(0, 0, 1, 1);
            
            const img = canvas.toDataURL('image/png');
            
            const slide = pptx.addSlide();
            slide.addImage({ data: img, x: 0, y: 0, w: '100%', h: '100%' });
        }
        
        setStatusCallback('正在打包 PPTX 文件...');
        await pptx.writeFile({ fileName: `华子胶片_${new Date().toISOString().slice(0, 10)}.pptx` });
        return true;
    } catch (err) {
        console.error('PPTX Export Error:', err);
        alert(`导出 PPT 失败：${err.message}`);
        return false;
    } finally {
        window.getComputedStyle = originalGetComputedStyle;
        if (renderHost) renderHost.remove();
    }
}
