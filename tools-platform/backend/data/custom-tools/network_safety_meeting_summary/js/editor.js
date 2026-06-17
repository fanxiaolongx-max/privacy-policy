// js/editor.js
export function scrubClone(clone) {
    clone.querySelectorAll('[contenteditable]').forEach(el => {
        el.removeAttribute('contenteditable');
        el.removeAttribute('tabindex');
    });
    clone.querySelectorAll('.editable').forEach(el => el.classList.remove('editable'));
    clone.querySelectorAll('.is-active').forEach(el => el.classList.remove('is-active'));
    return clone;
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
    try {
        document.activeElement && document.activeElement.blur();
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [960, 720], compress: true });
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
                scale: 4,
                backgroundColor: '#fbfbf9',
                useCORS: true,
                windowWidth: 1280,
                windowHeight: 960,
                width: 480,
                height: 360
            });
            const img = canvas.toDataURL('image/png');
            if (i > 0) pdf.addPage([960, 720], 'landscape');
            pdf.addImage(img, 'PNG', 0, 0, 960, 720);
        }
        
        pdf.save(`安全大会_${new Date().toISOString().slice(0, 10)}.pdf`);
        return true;
    } catch (err) {
        console.error('PDF Export Error:', err);
        alert(`导出 PDF 失败：${err.message}`);
        return false;
    } finally {
        if (renderHost) renderHost.remove();
    }
}
