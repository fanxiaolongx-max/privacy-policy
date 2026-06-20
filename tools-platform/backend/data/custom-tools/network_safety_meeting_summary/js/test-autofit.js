function autoFitSlide(slide) {
    const pad = slide.querySelector('.slide-pad');
    if (!pad) return;
    
    let iterations = 0;
    while (pad.scrollHeight > pad.clientHeight && iterations < 30) {
        let changed = false;
        const elements = pad.querySelectorAll('*');
        elements.forEach(el => {
            const style = window.getComputedStyle(el);
            const fontSize = parseFloat(style.fontSize);
            if (fontSize > 12) {
                el.style.fontSize = (fontSize * 0.95) + 'px';
                changed = true;
            }
        });
        if (!changed) break;
        iterations++;
    }
}
