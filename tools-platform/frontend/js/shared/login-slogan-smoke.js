/* Local, short-lived volumetric smoke for the login inscription. */
(function () {
    'use strict';
    const wrap = document.getElementById('loginSloganWrap');
    const canvas = document.getElementById('loginSloganSmoke');
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const lines = [...wrap.querySelectorAll('p')];
    let raf = 0, debounce = 0, started = 0, last = 0, emitted = 0;
    let width = 0, height = 0, contentWidth = 0, padding = 0, particles = [], textures = [], text = '';
    let visible = false, edgeMask = null;
    const verticalPadding = 120;
    const clamp = v => Math.max(0, Math.min(1, v));
    const smooth = v => { v = clamp(v); return v * v * (3 - 2 * v); };

    function texture(gold) {
        const size = 192, image = document.createElement('canvas');
        image.width = image.height = size;
        const context = image.getContext('2d'), data = context.createImageData(size, size);
        const grids = [5, 9, 17, 33, 65].map(n => ({ n, values: Float32Array.from({ length:n*n }, () => Math.random()) }));
        for (let y=0; y<size; y++) for (let x=0; x<size; x++) {
            let cloud = 0, weight = 0;
            grids.forEach((grid, octave) => {
                const gx=x/(size-1)*(grid.n-1), gy=y/(size-1)*(grid.n-1);
                const ix=Math.min(grid.n-2,Math.floor(gx)), iy=Math.min(grid.n-2,Math.floor(gy));
                const fx=smooth(gx-ix), fy=smooth(gy-iy), values=grid.values, n=grid.n;
                const a=values[iy*n+ix]*(1-fx)+values[iy*n+ix+1]*fx;
                const b=values[(iy+1)*n+ix]*(1-fx)+values[(iy+1)*n+ix+1]*fx;
                const w=Math.pow(.56,octave); cloud+=(a*(1-fy)+b*fy)*w; weight+=w;
            });
            const edge=clamp(1-Math.hypot((x-size/2)/(size/2),(y-size/2)/(size/2)));
            const density=clamp((cloud/weight-.28)*1.9), i=(y*size+x)*4;
            data.data[i]=gold?205:125; data.data[i+1]=gold?184:183; data.data[i+2]=gold?139:195;
            data.data[i+3]=Math.round(210 * smooth(edge / .7) * density * density);
        }
        context.putImageData(data,0,0); return image;
    }
    function finish() {
        cancelAnimationFrame(raf); raf=0; particles=[];
        wrap.classList.remove('slogan-smoke-active');
        ctx.clearRect(0,0,canvas.width,canvas.height);
    }
    function makeEdgeMask() {
        const mask = document.createElement('canvas');
        mask.width = Math.ceil(width); mask.height = Math.ceil(height);
        const context = mask.getContext('2d');
        function gradient(length, feather, horizontal) {
            const ramp = context.createLinearGradient(0, 0, horizontal ? length : 0, horizontal ? 0 : length);
            const span = Math.min(feather, length / 2) / length;
            // Smooth alpha ramp: fully transparent at all four clipping boundaries.
            for (const step of [0, .25, .5, .75, 1]) {
                const alpha = smooth(step);
                ramp.addColorStop(step * span, 'rgba(255,255,255,' + alpha + ')');
            }
            for (const step of [1, .75, .5, .25, 0]) {
                const alpha = smooth(step);
                ramp.addColorStop(1 - step * span, 'rgba(255,255,255,' + alpha + ')');
            }
            return ramp;
        }
        context.fillStyle = gradient(width, 90, true);
        context.fillRect(0, 0, mask.width, mask.height);
        context.globalCompositeOperation = 'destination-in';
        context.fillStyle = gradient(height, 90, false);
        context.fillRect(0, 0, mask.width, mask.height);
        return mask;
    }
    function size() {
        const rect = wrap.getBoundingClientRect(), dpr=Math.min(window.devicePixelRatio||1,1.5);
        contentWidth=rect.width; padding=Math.max(0,Math.min(80,rect.left,window.innerWidth-rect.right));
        width=contentWidth+padding*2; height=rect.height+verticalPadding*2;
        canvas.style.left=-padding+'px'; canvas.style.width=width+'px';
        canvas.width=Math.ceil(width*dpr); canvas.height=Math.ceil(height*dpr);
        ctx.setTransform(dpr,0,0,dpr,0,0);
        edgeMask=makeEdgeMask();
    }
    function start() {
        finish();
        if (!visible || motion.matches || document.hidden || document.getElementById('loginPanel')?.classList.contains('login-success')) return;
        size(); if (!width) return;
        if (!textures.length) textures=[texture(false),texture(true),texture(false)];
        wrap.classList.add('slogan-smoke-ready','slogan-smoke-active');
        started=performance.now(); last=0; emitted=0;
        wrap.style.setProperty('--slogan-reveal','-.15');
        wrap.style.setProperty('--slogan-reveal-secondary','-.15');
        raf=requestAnimationFrame(frame);
    }
    function frame(now) {
        if (document.hidden || motion.matches) { finish(); return; }
        if (last && now-last<32) { raf=requestAnimationFrame(frame); return; }
        last=now;
        const t=(now-started)/1000, progress=smooth((t-.35)/2.8);
        const secondary=smooth((t-.65)/2.8);
        wrap.style.setProperty('--slogan-reveal',String(-.15+progress*1.3));
        wrap.style.setProperty('--slogan-reveal-secondary',String(-.15+secondary*1.3));
        wrap.style.setProperty('--slogan-clarity',String(progress));
        const target=Math.floor(Math.min(t,3.3)*26);
        while (emitted<target) {
            const row=emitted%2, rect=lines[row].getBoundingClientRect(), parent=wrap.getBoundingClientRect();
            const p=row?secondary:progress;
            particles.push({born:t, x:padding+contentWidth*(-.06+p*1.1)+(Math.random()-.5)*55,
                y:verticalPadding+rect.top-parent.top+rect.height/2+(Math.random()-.5)*26,
                radius:45+Math.random()*55, life:1.8+Math.random()*1.3,
                vx:8+Math.random()*16, vy:-8-Math.random()*17,
                angle:Math.random()*6.28, spin:(Math.random()-.5)*.5, texture:emitted%textures.length});
            emitted++;
        }
        ctx.clearRect(0,0,width,height); ctx.globalCompositeOperation='screen';
        particles=particles.filter(p=>t-p.born<p.life);
        particles.forEach(p=>{
            const age=t-p.born, fraction=age/p.life;
            const radius=p.radius*(.65+fraction*.65);
            ctx.save();
            ctx.translate(p.x+p.vx*age+Math.sin(age*1.6+p.angle)*12,p.y+p.vy*age);
            ctx.rotate(p.angle+p.spin*age); ctx.scale(1,.55+fraction*.3);
            ctx.globalAlpha=Math.sin(Math.PI*fraction)*.58;
            ctx.drawImage(textures[p.texture],-radius,-radius,radius*2,radius*2); ctx.restore();
        });
        // Feather the rendered smoke's alpha, without blurring or dimming the text.
        ctx.globalCompositeOperation='destination-in'; ctx.globalAlpha=1;
        ctx.drawImage(edgeMask,0,0,width,height);
        ctx.globalCompositeOperation='source-over';
        if (t>6.5) { finish(); return; }
        raf=requestAnimationFrame(frame);
    }
    function schedule() { clearTimeout(debounce); debounce=setTimeout(start,160); }
    const contentObserver=new MutationObserver(()=>{
        const next=lines.map(line=>line.textContent).join('\n');
        if (next!==text) { text=next; schedule(); }
    });
    contentObserver.observe(wrap,{subtree:true,childList:true,characterData:true});
    const panelObserver=new MutationObserver(()=>{
        if (document.getElementById('loginPanel')?.classList.contains('login-success')) finish();
    });
    const panel=document.getElementById('loginPanel');
    if(panel) panelObserver.observe(panel,{attributes:true,attributeFilter:['class']});
    const visibilityObserver=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
        const wasVisible=visible;visible=entries[0].isIntersecting;
        if(visible&&!wasVisible)schedule();else if(!visible)finish();
    },{threshold:.15}):null;
    if(visibilityObserver)visibilityObserver.observe(wrap);else{visible=true;schedule();}
    window.addEventListener('resize',schedule);
    motion.addEventListener('change',()=>{if(motion.matches)finish();else schedule();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)finish();});
    window.addEventListener('pagehide',()=>{finish();clearTimeout(debounce);contentObserver.disconnect();panelObserver.disconnect();visibilityObserver?.disconnect();});
})();
