(function () {
    'use strict';

    const DATA_URL = 'handwriting/calliar-human-strokes.json?v=20260830-3';
    const STORAGE_PREFIX = 'egypt-arabic-human-writing:';
    const DIACRITICS = /[\u064b-\u065f\u0670]/g;
    const ARABIC_WORDS = /[\u0621-\u063a\u0641-\u064a\u0671\u06a4]+/g;

    const state = {
        data: null,
        text: '',
        sample: null,
        sampleKind: '',
        formOverride: '',
        animation: null,
        speed: 1,
        paths: [],
        trace: [],
        drawing: false,
        currentStroke: null,
    };

    function normalizeText(value) {
        return (String(value).match(ARABIC_WORDS) || []).join('').replace(DIACRITICS, '');
    }

    function words(value) {
        return String(value).replace(DIACRITICS, '').match(ARABIC_WORDS) || [];
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, character => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[character]);
    }

    function pointBounds(strokes) {
        const points = strokes.flat();
        const xs = points.map(point => point[0]);
        const ys = points.map(point => point[1]);
        return {
            minX: Math.min(...xs), maxX: Math.max(...xs),
            minY: Math.min(...ys), maxY: Math.max(...ys),
        };
    }

    function fitStrokes(strokes, box = { x: 55, y: 38, width: 790, height: 230 }) {
        if (!strokes?.length) return [];
        const bounds = pointBounds(strokes);
        const sourceWidth = Math.max(1, bounds.maxX - bounds.minX);
        const sourceHeight = Math.max(1, bounds.maxY - bounds.minY);
        const scale = Math.min(box.width / sourceWidth, box.height / sourceHeight);
        const offsetX = box.x + (box.width - sourceWidth * scale) / 2;
        const offsetY = box.y + (box.height - sourceHeight * scale) / 2;
        return strokes.map(stroke => stroke.map(([x, y]) => [
            offsetX + (x - bounds.minX) * scale,
            offsetY + (y - bounds.minY) * scale,
        ]));
    }

    function storageKey(text, form = '') {
        return STORAGE_PREFIX + text + (form ? `:${form}` : '');
    }

    function savedSample(text, form = '') {
        try {
            const parsed = JSON.parse(localStorage.getItem(storageKey(text, form)));
            return Array.isArray(parsed?.strokes) ? parsed.strokes : null;
        } catch (_) {
            return null;
        }
    }

    function resolveSample(text, formOverride = '') {
        const saved = savedSample(text, formOverride);
        if (saved) return { strokes: saved, kind: 'saved', label: '你在本机录制的真人笔迹' };
        if (text.length === 1) {
            const form = formOverride || 'isolated';
            const glyph = state.data.glyphs[text]?.[form];
            if (glyph) return { strokes: glyph.strokes, kind: 'glyph', label: `Calliar 真人字母轨迹 · ${form}` };
        }
        const exact = state.data.exactWords[text];
        if (exact) return { strokes: exact.strokes, kind: 'exact', label: 'Calliar 真人整词轨迹' };
        return { strokes: [], kind: 'missing', label: '暂无经过验证的真人整词轨迹，请在下方真人补录' };
    }

    function lineLength(stroke) {
        let length = 0;
        for (let index = 1; index < stroke.length; index++) {
            length += Math.hypot(stroke[index][0] - stroke[index - 1][0], stroke[index][1] - stroke[index - 1][1]);
        }
        return length;
    }

    function pathData(stroke) {
        return stroke.map((point, index) => `${index ? 'L' : 'M'}${point[0].toFixed(1)} ${point[1].toFixed(1)}`).join(' ');
    }

    function renderReference() {
        const svg = document.getElementById('handwriting-svg');
        const fitted = state.sample.strokes.length ? fitStrokes(state.sample.strokes) : [];
        state.sample.fitted = fitted;
        svg.innerHTML = `
            <line class="hw-guide" x1="45" y1="260" x2="855" y2="260"></line>
            <line class="hw-guide hw-guide-mid" x1="45" y1="150" x2="855" y2="150"></line>
            ${fitted.map((stroke, index) => `<path class="hw-ghost" d="${pathData(stroke)}"></path><path class="hw-ink" data-stroke="${index + 1}" d="${pathData(stroke)}"></path>`).join('')}
            <g id="handwriting-pen" hidden><circle r="9"></circle><path d="M0 0 L15 -25 L23 -17 Z"></path></g>`;
        state.paths = Array.from(svg.querySelectorAll('.hw-ink')).map((path, index) => {
            const length = path.getTotalLength();
            path.style.strokeDasharray = String(length);
            path.style.strokeDashoffset = String(length);
            return { path, length, stroke: fitted[index] };
        });
        document.getElementById('handwriting-empty').hidden = fitted.length > 0;
        document.getElementById('handwriting-source').textContent = state.sample.label;
        document.getElementById('handwriting-source').dataset.kind = state.sample.kind;
        document.getElementById('handwriting-play').disabled = !fitted.length;
        document.getElementById('handwriting-step').disabled = !fitted.length;
        resetAnimation();
        resizeTraceCanvas();
    }

    function resetAnimation() {
        cancelAnimationFrame(state.animation);
        clearTimeout(state.animation);
        state.animation = null;
        state.paths.forEach(({ path, length }) => { path.style.strokeDashoffset = String(length); });
        const pen = document.getElementById('handwriting-pen');
        if (pen) pen.hidden = true;
        const play = document.getElementById('handwriting-play');
        if (play) play.textContent = '▶ 播放真人笔顺';
    }

    function animateStroke(index, done, stopAfterCurrent = false) {
        if (index >= state.paths.length) return done?.();
        const item = state.paths[index];
        const duration = Math.max(180, item.length * 3.3) / state.speed;
        const started = performance.now();
        const pen = document.getElementById('handwriting-pen');
        pen.hidden = false;
        function frame(now) {
            const progress = Math.min(1, (now - started) / duration);
            item.path.style.strokeDashoffset = String(item.length * (1 - progress));
            const point = item.path.getPointAtLength(item.length * progress);
            pen.setAttribute('transform', `translate(${point.x} ${point.y})`);
            if (progress < 1) state.animation = requestAnimationFrame(frame);
            else {
                pen.hidden = true;
                if (stopAfterCurrent) {
                    state.animation = null;
                    done?.();
                } else {
                    state.animation = window.setTimeout(() => animateStroke(index + 1, done), 115 / state.speed);
                }
            }
        }
        state.animation = requestAnimationFrame(frame);
    }

    function playAll() {
        resetAnimation();
        document.getElementById('handwriting-play').textContent = '播放中…';
        animateStroke(0, () => {
            state.animation = null;
            document.getElementById('handwriting-play').textContent = '↻ 再播放一次';
        });
    }

    function stepStroke() {
        cancelAnimationFrame(state.animation);
        clearTimeout(state.animation);
        const next = state.paths.findIndex(({ path, length }) => Number(path.style.strokeDashoffset) >= length - 0.5);
        if (next < 0) return resetAnimation();
        animateStroke(next, () => {}, true);
    }

    function modalMarkup() {
        return `
        <div class="hw-modal" id="handwriting-modal" hidden>
            <div class="hw-backdrop" data-close-handwriting></div>
            <article class="hw-panel" role="dialog" aria-modal="true" aria-labelledby="handwriting-title">
                <button class="hw-close" type="button" data-close-handwriting aria-label="关闭书写练习">×</button>
                <div class="hw-kicker">真人轨迹 · 阿拉伯语书写练习</div>
                <div class="hw-heading">
                    <div><h3 id="handwriting-title">跟写</h3><p id="handwriting-source"></p></div>
                    <div class="hw-current" id="handwriting-current" lang="ar" dir="rtl"></div>
                </div>
                <div class="hw-picker" id="handwriting-picker" aria-label="选择要练习的词或字母"></div>
                <div class="hw-truth-note" id="handwriting-truth-note"></div>
                <div class="hw-stage">
                    <svg id="handwriting-svg" viewBox="0 0 900 310" aria-label="真人笔迹播放区"></svg>
                    <canvas id="handwriting-trace" aria-label="在此跟随描写"></canvas>
                    <div class="hw-empty" id="handwriting-empty" hidden>暂无轨迹。请直接在这里书写并保存为本机真人样本。</div>
                </div>
                <div class="hw-controls">
                    <button type="button" id="handwriting-play">▶ 播放真人笔顺</button>
                    <button type="button" id="handwriting-step">下一笔</button>
                    <label>速度 <select id="handwriting-speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option></select></label>
                    <button type="button" id="handwriting-clear">清空跟写</button>
                </div>
                <div class="hw-practice-head"><strong>跟写区</strong><span>鼠标、触控笔或手指均可；触控笔会记录压力。</span></div>
                <div class="hw-score" id="handwriting-score">先播放观察抬笔和补点顺序，再沿浅色轨迹临摹。</div>
                <div class="hw-record-actions">
                    <button type="button" id="handwriting-check">检查贴合度</button>
                    <button type="button" id="handwriting-save">保存为本机真人样本</button>
                    <button type="button" id="handwriting-delete">删除本机样本</button>
                </div>
                <p class="hw-disclaimer">“真人整词轨迹”来自连续的真实书写采集；缺少整词样本时不会再用单字片段机械拼接，只提供真人补录。动画速度按路径距离重建，并非原作者的精确书写时长。</p>
            </article>
        </div>`;
    }

    function decorateArabic(root = document) {
        const tokens = [
            ...(root.matches?.('.arabic-token') ? [root] : []),
            ...root.querySelectorAll('.arabic-token'),
        ];
        tokens.forEach(token => {
            if (token.querySelector('.handwriting-trigger')) return;
            const text = normalizeText(token.dataset.unitKey || token.textContent);
            if (!text) return;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'handwriting-trigger handwriting-trigger-inline';
            button.dataset.handwritingText = text;
            button.title = `播放 ${text} 的真人书写轨迹`;
            button.setAttribute('aria-label', `学习书写 ${text}`);
            button.textContent = '✍';
            token.appendChild(button);
        });
        const cards = [
            ...(root.matches?.('.alphabet-card') ? [root] : []),
            ...root.querySelectorAll('.alphabet-card'),
        ];
        cards.forEach(card => {
            if (card.querySelector('.handwriting-trigger-card')) return;
            const text = normalizeText(card.querySelector('.alphabet-letter-main')?.textContent || '');
            if (!text) return;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'handwriting-trigger handwriting-trigger-card';
            button.dataset.handwritingText = text;
            button.dataset.handwritingForm = 'isolated';
            button.textContent = '✍️ 播放真人笔顺并跟写';
            card.appendChild(button);
            card.querySelectorAll('.alphabet-form').forEach((formElement, index) => {
                if (formElement.querySelector('.handwriting-form-trigger')) return;
                const formButton = document.createElement('button');
                formButton.type = 'button';
                formButton.className = 'handwriting-trigger handwriting-form-trigger';
                formButton.dataset.handwritingText = text;
                formButton.dataset.handwritingForm = ['isolated', 'initial', 'medial', 'final'][index];
                formButton.title = '播放这一位置字形的真人笔顺';
                formButton.textContent = '✍';
                formElement.appendChild(formButton);
            });
        });
    }

    function buildPicker(value, formOverride = '') {
        const wordList = words(value);
        const characters = Array.from(normalizeText(value));
        const items = [...wordList.map(text => ({ text, type: '词', form: '' })), ...characters.map(text => ({ text, type: '字母', form: '' }))];
        if (characters.length === 1 && formOverride) {
            items.splice(0, items.length, ...['isolated', 'initial', 'medial', 'final'].map((form, index) => ({
                text: characters[0], type: ['独立', '词首', '词中', '词尾'][index], form,
            })));
        }
        const unique = items.filter((item, index) => items.findIndex(other => other.text === item.text && other.type === item.type) === index);
        document.getElementById('handwriting-picker').innerHTML = unique.map(item => `
            <button type="button" data-hw-choice="${escapeHtml(item.text)}" data-hw-form="${item.form}"><b lang="ar" dir="rtl">${escapeHtml(item.text)}</b><small>${item.type}</small></button>`).join('');
    }

    function selectText(value, formOverride = '') {
        const text = normalizeText(value);
        if (!text) return;
        state.text = text;
        state.formOverride = formOverride;
        state.sample = resolveSample(text, formOverride);
        state.sampleKind = state.sample.kind;
        document.getElementById('handwriting-current').textContent = text;
        document.getElementById('handwriting-title').textContent = `书写：${text}`;
        document.querySelectorAll('[data-hw-choice]').forEach(button => button.classList.toggle('active', button.dataset.hwChoice === text && (button.dataset.hwForm || '') === formOverride));
        const notes = {
            saved: '当前播放的是你亲手录制并保存在本机的轨迹。',
            exact: '这是连续采集的真人整词笔迹，抬笔、回补点和笔画次序均来自原始数据。',
            glyph: '这是从真人在线书写中提取的当前位置字形，保留了原始抬笔与回补笔画顺序。',
            missing: '没有经过验证的真人整词轨迹，系统不会机械拼字。请由老师或熟练书写者写一次并保存，之后即可反复播放。',
        };
        document.getElementById('handwriting-truth-note').textContent = notes[state.sample.kind];
        renderReference();
        clearTrace();
        document.getElementById('handwriting-delete').disabled = state.sample.kind !== 'saved';
    }

    function open(value, formOverride = '') {
        const modal = document.getElementById('handwriting-modal');
        buildPicker(value, formOverride);
        selectText(words(value)[0] || value, formOverride);
        modal.hidden = false;
        document.body.classList.add('modal-open');
        requestAnimationFrame(resizeTraceCanvas);
    }

    function close() {
        resetAnimation();
        document.getElementById('handwriting-modal').hidden = true;
        document.body.classList.remove('modal-open');
    }

    function resizeTraceCanvas() {
        const canvas = document.getElementById('handwriting-trace');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.max(1, Math.round(rect.width * ratio));
        canvas.height = Math.max(1, Math.round(rect.height * ratio));
        const context = canvas.getContext('2d');
        context.setTransform(ratio * rect.width / 900, 0, 0, ratio * rect.height / 310, 0, 0);
        redrawTrace();
    }

    function canvasPoint(event) {
        const rect = event.currentTarget.getBoundingClientRect();
        return {
            x: (event.clientX - rect.left) * 900 / rect.width,
            y: (event.clientY - rect.top) * 310 / rect.height,
            pressure: event.pressure || 0.5,
            time: performance.now(),
        };
    }

    function redrawTrace() {
        const canvas = document.getElementById('handwriting-trace');
        if (!canvas) return;
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, 900, 310);
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.strokeStyle = '#0f766e';
        state.trace.forEach(stroke => {
            if (!stroke.length) return;
            context.beginPath();
            stroke.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
            const pressure = stroke.reduce((sum, point) => sum + point.pressure, 0) / stroke.length;
            context.lineWidth = 5 + pressure * 7;
            context.stroke();
        });
    }

    function clearTrace() {
        state.trace = [];
        state.currentStroke = null;
        redrawTrace();
        const score = document.getElementById('handwriting-score');
        if (score) score.textContent = '先播放观察抬笔和补点顺序，再沿浅色轨迹临摹。';
    }

    function nearestDistance(point, reference) {
        let best = Infinity;
        reference.forEach(candidate => { best = Math.min(best, Math.hypot(point.x - candidate[0], point.y - candidate[1])); });
        return best;
    }

    function checkTrace() {
        const user = state.trace.flat();
        const reference = state.sample?.fitted?.flat() || [];
        if (user.length < 6) {
            document.getElementById('handwriting-score').textContent = '请先完整写一遍，再检查。';
            return;
        }
        if (!reference.length) {
            document.getElementById('handwriting-score').textContent = `已记录 ${state.trace.length} 笔。当前没有参考轨迹，可直接保存为本机真人样本。`;
            return;
        }
        const sampledUser = user.filter((_, index) => index % Math.max(1, Math.floor(user.length / 180)) === 0);
        const sampledRef = reference.filter((_, index) => index % Math.max(1, Math.floor(reference.length / 180)) === 0);
        const mean = sampledUser.reduce((sum, point) => sum + nearestDistance(point, sampledRef), 0) / sampledUser.length;
        const coverage = sampledRef.filter(point => nearestDistance({ x: point[0], y: point[1] }, sampledUser.map(p => [p.x, p.y])) < 28).length / sampledRef.length;
        const score = Math.max(0, Math.min(100, Math.round(100 - mean * 1.7 - (1 - coverage) * 35)));
        const advice = score >= 85 ? '很贴合，继续注意抬笔和补点顺序。' : score >= 65 ? '轮廓基本正确，再放慢速度对齐起笔和转折。' : '偏差较大，建议先用 0.5× 逐笔观察，再临摹。';
        document.getElementById('handwriting-score').innerHTML = `<strong>${score} 分</strong> · ${advice}`;
    }

    function saveTrace() {
        if (!state.trace.length) return checkTrace();
        const strokes = state.trace.filter(stroke => stroke.length).map(stroke => stroke.map(point => [
            Math.round(point.x * 10) / 10, Math.round(point.y * 10) / 10,
        ]));
        localStorage.setItem(storageKey(state.text, state.formOverride), JSON.stringify({ text: state.text, form: state.formOverride, strokes, savedAt: new Date().toISOString() }));
        selectText(state.text, state.formOverride);
        document.getElementById('handwriting-score').textContent = '已保存。这一词现在会优先播放你自己的真人书写轨迹。';
    }

    function deleteSaved() {
        localStorage.removeItem(storageKey(state.text, state.formOverride));
        selectText(state.text, state.formOverride);
        document.getElementById('handwriting-score').textContent = '已删除本机样本，恢复为数据集参考轨迹。';
    }

    async function init() {
        document.body.insertAdjacentHTML('beforeend', modalMarkup());
        try {
            const response = await fetch(DATA_URL);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            state.data = await response.json();
        } catch (error) {
            state.data = { exactWords: {}, glyphs: {} };
            console.warn('Handwriting trajectories unavailable:', error);
        }
        decorateArabic();
        new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
            if (node.nodeType === 1) decorateArabic(node);
        }))).observe(document.body, { childList: true, subtree: true });

        document.addEventListener('click', event => {
            const trigger = event.target.closest('[data-handwriting-text]');
            if (trigger) {
                event.preventDefault(); event.stopPropagation();
                return open(trigger.dataset.handwritingText, trigger.dataset.handwritingForm || '');
            }
            const choice = event.target.closest('[data-hw-choice]');
            if (choice) return selectText(choice.dataset.hwChoice, choice.dataset.hwForm || '');
            if (event.target.closest('[data-close-handwriting]')) close();
        }, true);
        document.getElementById('handwriting-play').addEventListener('click', playAll);
        document.getElementById('handwriting-step').addEventListener('click', stepStroke);
        document.getElementById('handwriting-clear').addEventListener('click', clearTrace);
        document.getElementById('handwriting-check').addEventListener('click', checkTrace);
        document.getElementById('handwriting-save').addEventListener('click', saveTrace);
        document.getElementById('handwriting-delete').addEventListener('click', deleteSaved);
        document.getElementById('handwriting-speed').addEventListener('change', event => { state.speed = Number(event.target.value); });

        const canvas = document.getElementById('handwriting-trace');
        canvas.addEventListener('pointerdown', event => {
            event.preventDefault(); canvas.setPointerCapture(event.pointerId);
            state.drawing = true; state.currentStroke = [canvasPoint(event)]; state.trace.push(state.currentStroke); redrawTrace();
        });
        canvas.addEventListener('pointermove', event => {
            if (!state.drawing) return;
            const point = canvasPoint(event);
            const last = state.currentStroke[state.currentStroke.length - 1];
            if (Math.hypot(point.x - last.x, point.y - last.y) >= 1.5) state.currentStroke.push(point);
            redrawTrace();
        });
        const endStroke = () => { state.drawing = false; state.currentStroke = null; };
        canvas.addEventListener('pointerup', endStroke);
        canvas.addEventListener('pointercancel', endStroke);
        window.addEventListener('resize', resizeTraceCanvas);
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !document.getElementById('handwriting-modal').hidden) close();
        });
    }

    if (document.readyState === 'loading') window.addEventListener('load', init);
    else init();
})();
