const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../backend/builtin-tools/tool-mtakhxqm');
const drill = require(path.join(root, 'letter-drill.js'));
const pool = drill.bank();

test('all 28 letters have questions; ambiguous dialect sounds use word context', () => {
    assert.equal(new Set(drill.LETTERS).size, 28);
    for (const letter of drill.LETTERS) assert.ok(pool.some(q => q.letter === letter), letter);
    for (const q of pool.filter(q => 'ثذظ'.includes(q.letter))) assert.ok(q.word);
    for (const q of pool.filter(q => q.word)) {
        assert.equal(drill.graphemes(q.word)[q.index].replace(/\p{Mark}/gu, ''), q.letter);
    }
});

test('single-letter pools terminate with unique reading choices and exactly one answer', () => {
    for (const letter of drill.LETTERS) {
        const selected = pool.filter(q => q.letter === letter);
        for (const count of [2, 3]) for (let i = 0; i < 25; i++) {
            const q = drill.question(selected, count);
            assert.equal(q.answer.letter, letter);
            assert.equal(q.options.length, count);
            assert.equal(new Set(q.options.map(o => o.ipa)).size, count);
            assert.equal(q.options.filter(o => o.ipa === q.answer.ipa).length, 1);
        }
    }
    assert.throws(() => drill.question([]), /至少一个/);
});

test('IPA uses standard sound symbols, vowel length and consonant gemination', () => {
    for (const [reading, ipa] of [
        ['ʾa','ʔa'], ['gī','ɡiː'], ['ḥ','ħ'], ['kh','x'], ['shī','ʃiː'],
        ['ṣa','sˤa'], ['ḍḍā','dˤːaː'], ['ṭṭ','tˤː'], ['ʿē','ʕeː'],
        ['ghā','ɣaː'], ['yō','joː'], ['zz','zː'], ['ʾesmi','ʔismi'],
        ['ḥegāb','ħiɡaːb'], ['sokkar','sukːar']
    ]) assert.equal(drill.toIpa(reading), ipa, reading);
    assert.equal(drill.toIpa('ge'), drill.toIpa('gi'), 'short e/i are one broad phonemic choice');
    assert.equal(drill.toIpa('go'), drill.toIpa('gu'), 'short o/u are one broad phonemic choice');
    assert.notEqual(drill.toIpa('gē'), drill.toIpa('gī'), 'long e and i remain distinct');
    assert.notEqual(drill.toIpa('ō'), drill.toIpa('ū'), 'long o and u remain distinct');
    // Equivalent old spellings cannot become two indistinguishable options.
    const equivalent = {...pool[0], id: 'equivalent', read: 'other notation'};
    const q = drill.question([pool[0], equivalent], 3, () => 0);
    assert.equal(new Set(q.options.map(option => option.ipa)).size, 3);
});

test('every word has explicit contextual sounds and the highlighted sound matches its part', () => {
    const words = pool.filter(q => q.word);
    for (const q of words) {
        assert.equal(q.parts.length, drill.graphemes(q.word).length, q.word);
        assert.equal(q.parts[q.index].read, q.read, q.word + ' target');
        assert.equal(q.parts[q.index].ipa, q.ipa, q.word + ' IPA');
        if (q.contextOnly) {
            assert.equal(q.targetAudioKey, q.audioKey, q.word + ' contextual audio');
            assert.equal(q.carrier, false);
        } else assert.notEqual(q.targetAudioKey, q.audioKey, q.word + ' word/target audio');
        assert.ok(q.wordIpa && q.parts.every(part => typeof part.read === 'string'), q.word);
        for (const part of q.parts.filter(part => part.read)) {
            assert.ok(part.ipa && part.speech && part.audioKey, q.word + ' part ' + part.index);
        }
    }
    const target = (word, index) => words.find(q => q.word === word && q.index === index).ipa;
    assert.equal(target('قَهْوَة', 0), 'ʔa');
    assert.equal(target('كَلْب', 0), 'ka');
    assert.equal(target('حَبِيبِي', 1), 'biː');
    assert.equal(target('حَبِيبِي', 4), 'i');
    assert.equal(target('مَاشِي', 2), 'ʃi');
    assert.equal(target('أَنَا', 2), 'a');
    assert.equal(drill.wordParts('شُكْرًا').at(-1).read, '');
    assert.ok(!words.some(q => !q.parts[q.index].read), 'silent spelling supports are never quiz targets');
    const bananaVowel = drill.wordParts('مَوْز')[1];
    assert.equal(bananaVowel.ipa, 'oː');
    assert.equal(bananaVowel.audioKey, 'مَوْز');
    assert.equal(bananaVowel.contextOnly, true, 'unreliable isolated TTS vowels use their real word');
    const isolatedKa = pool.find(q => q.id === 'ك:0');
    assert.equal(isolatedKa.ipa, 'ka');
    assert.equal(isolatedKa.carrier, true);
    assert.ok(isolatedKa.targetSpeech.startsWith('أَ'), 'carrier makes isolated short vowels audible');
});

test('common Egyptian words extend the drill beyond the original vocabulary', () => {
    const words = new Set(pool.map(q => q.word));
    for (const word of ['فِين','لِيه','هِنَا','هِنَاك','فَوْق','تَحْت','جَنْب','بُكْرَة','لَيْل','نَهَار',
        'كِتِير','شُوَيَّة','بَسّ','تَمَام','سَهْل','سُخْن','سَاقِع','مِلْح','فُول','خَلّ']) {
        assert.ok(words.has(word), word);
    }
});

test('non-joining letters never grow a left connection; speed stays bounded', () => {
    for (const letter of 'ادذرزو') {
        const forms = drill.forms(letter, 'َ');
        assert.equal(forms[0], forms[1]);
        assert.equal(forms[2], forms[3]);
        assert.ok(!forms[1].endsWith('ـ'));
    }
    assert.equal(new Set(drill.forms('ب', 'َ')).size, 4);
    assert.ok(drill.limit(15) < drill.limit(5));
    assert.ok(drill.limit(1000) >= 2600);
});

test('whole words, target sounds and every audible word part have shipped Egyptian audio', async () => {
    const JSZip = require('jszip');
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'audio/drill-manifest.json')));
    const planned = require(path.join(root, 'generate-classroom-audio.cjs')).buildPlan().manifest;
    const zip = await JSZip.loadAsync(fs.readFileSync(path.join(root, 'audio/audio.bundle.zip')));
    const keys = new Set(pool.flatMap(q => [q.audioKey, q.targetAudioKey,
        ...(q.parts || []).filter(part => part.read).map(part => part.audioKey)]));
    const checked = new Set();
    for (const key of keys) {
        assert.ok(manifest[key], key);
        assert.equal(manifest[key], planned[key], 'shipped pronunciation is current: ' + key);
        const filename = path.basename(manifest[key]);
        assert.ok(zip.files[filename], 'missing packed audio: ' + filename);
        if (!checked.has(filename)) {
            assert.ok((await zip.files[filename].async('nodebuffer')).length > 1000, key);
            checked.add(filename);
        }
    }
});

test('four primary modules keep all sublesson and drill targets available', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const navigation = fs.readFileSync(path.join(root, 'classroom.js'), 'utf8');
    const context = {window: {}};
    const groups = vm.runInNewContext(navigation + '; CLASSROOM_MODULES', context);
    assert.equal(Object.keys(groups).length, 4);
    assert.equal((html.match(/data-module=/g) || []).length, 4);
    for (const [id] of Object.values(groups).flat()) assert.ok(html.includes(`id="${id}"`), id);
});

test('curated beginner content excludes formal and Levantine distractors', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const data = vm.runInNewContext(html.slice(html.indexOf('const STARTER_WORD_DATA'), html.indexOf('const MSA_EQUIVALENTS')) + '; ({STARTER_WORD_DATA,EGYPTIAN_DIALECT_VOCAB})');
    assert.ok(data.STARTER_WORD_DATA.some(w => w.ar === 'عِيش' && w.pron === 'ʿēsh'));
    assert.ok(data.STARTER_WORD_DATA.some(w => w.ar === 'بَيْت' && w.pron === 'bēt'));
    for (const word of data.EGYPTIAN_DIALECT_VOCAB) {
        assert.ok(word.translation, word.ar);
        assert.ok(word.hz, word.ar);
        assert.ok(!['كِيفَك؟','كَيْفَ؟','لَيْسَ','هَذَا','هَذِهِ','ذَلِكَ'].includes(word.ar));
    }
});

// A small DOM/clock/audio fixture exercises public UI events without adding a
// browser dependency. Audio completion and timer advancement are independent.
function browserFixture(letter = 'ث', random = 0) {
    class Element {
        constructor(tagName = 'div') {
            this.tagName = tagName.toUpperCase();this.children = [];this.hidden = false;
            this.disabled = false;this.attributes = {};this.style = {};this._classes = new Set();
            this.classList = {
                add: (...names) => names.forEach(name => this._classes.add(name)),
                remove: (...names) => names.forEach(name => this._classes.delete(name)),
                contains: name => this._classes.has(name),
                toggle: (name, force) => {
                    const add = force === undefined ? !this._classes.has(name) : force;
                    add ? this._classes.add(name) : this._classes.delete(name);return add;
                }
            };
        }
        set className(value) {this._classes = new Set(value.split(/\s+/).filter(Boolean));}
        get className() {return [...this._classes].join(' ');}
        setAttribute(name, value) {this.attributes[name] = String(value);if (name === 'id') this.id = value;}
        getAttribute(name) {return this.attributes[name];}
        append(...children) {this.children.push(...children);}
        replaceChildren(...children) {this.children = children;this._html = '';this._text = '';}
        querySelector(selector) {return descendants(this).find(child => child.tagName.toLowerCase() === selector);}
        scrollIntoView() {}
        set textContent(value) {this._text = String(value);this._html = '';this.children = [];}
        get textContent() {return this._text || this.children.map(child => child.textContent).join('');}
        set innerHTML(value) {
            this._html = value;this._text = value.replace(/<[^>]*>/g, '');this.children = [];
            for (const match of value.matchAll(/<(\w+)([^>]*\bid="([^"]+)"[^>]*)>/g)) {
                const child = new Element(match[1]);child.id = match[3];child.hidden = /\bhidden\b/.test(match[2]);
                child.disabled = /\bdisabled\b/.test(match[2]);
                if (child.tagName === 'SELECT') {
                    const options = value.slice(match.index).match(/<option value="([^"]+)"/);
                    child.value = options?.[1];
                }
                this.append(child);
            }
            for (const match of value.matchAll(/<input ([^>]+)>/g)) {
                const input = new Element('input');input.value = match[1].match(/value="([^"]+)"/)?.[1];
                input.checked = /\bchecked\b/.test(match[1]);this.append(input);
            }
            for (const match of value.matchAll(/<strong[^>]*>([^<]*)<\/strong>/g)) {
                const strong = new Element('strong');strong.textContent = match[1];this.append(strong);
            }
        }
        get innerHTML() {return this._html || '';}
    }
    function descendants(element) {return element.children.flatMap(child => [child, ...descendants(child)]);}
    const container = new Element();
    const rootElement = new Element();rootElement.id = 'letter-drill-root';container.append(rootElement);
    const tab = new Element();tab.id = 'tab-letter-drill';tab.classList.add('active');container.append(tab);
    const $ = id => descendants(container).find(element => element.id === id);
    const document = {
        getElementById: $, createElement: tag => new Element(tag), addEventListener() {},
        querySelectorAll(selector) {
            const inputs = descendants($('drill-letters')).filter(element => element.tagName === 'INPUT');
            return selector.endsWith(':checked') ? inputs.filter(input => input.checked) : inputs;
        }
    };
    let cursor = 0;
    const timeouts = new Map(), intervals = new Map(), recordings = [];
    class Audio {
        constructor() {recordings.push(this);}
        play() {this.played = this.src;return Promise.resolve();}
        pause() {this.wasPaused = true;}
        finish() {this.onended?.();}
    }
    const manifest = Object.fromEntries(pool.flatMap(q => [q.audioKey, q.targetAudioKey,
        ...(q.parts || []).filter(part => part.read).map(part => part.audioKey)]).map(key => [key, 'fixture:' + key]));
    const window = {EgyptianDrillData: require(path.join(root, 'letter-drill-data.js')), addEventListener() {}};
    const context = {
        window, document, Audio, performance: {now: () => 0}, fetch: async () => ({ok: true, json: async () => manifest}),
        Math: Object.assign(Object.create(Math), {random: typeof random === 'function' ? random : () => random}),
        setTimeout: (fn, delay) => {const id = ++cursor;timeouts.set(id, {fn,delay});return id;},
        clearTimeout: id => timeouts.delete(id),
        setInterval: fn => {const id = ++cursor;intervals.set(id, fn);return id;},
        clearInterval: id => intervals.delete(id)
    };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'letter-drill.js'), 'utf8'), context);
    window.letterDrill.init();
    document.querySelectorAll('#drill-letters input').forEach(input => input.checked = input.value === letter);
    $('drill-start').onclick();
    return {$, recordings, timeouts, intervals, manifest,
        flush: async () => {for (let i = 0; i < 6; i++) await Promise.resolve();},
        runTimeouts: () => {const scheduled = [...timeouts.values()];timeouts.clear();scheduled.forEach(item => item.fn());}};
}

test('running and paused words stay visible and support decomposition and word/letter playback', async () => {
    for (const paused of [false, true]) {
        const browser = browserFixture(), {$, recordings} = browser;
        const originalWord = $('drill-word').innerHTML;
        for (const choice of $('drill-options').children) {
            assert.match(choice.querySelector('strong').textContent, /^\/[^/]+\/$/);
            assert.ok(!/[\u3400-\u9fff]/u.test(choice.innerHTML), 'choices contain only IPA and a number');
        }
        if (paused) {
            $('drill-pause').onclick();
            assert.ok($('drill-options').children.every(button => button.disabled));
            $('drill-options').children[0].onclick();
            assert.equal($('drill-score').textContent, '0', 'paused answers cannot score');
        }
        assert.equal($('drill-word').innerHTML, originalWord);
        assert.equal($('drill-display').hidden, false);
        assert.ok(!$('drill-display').classList.contains('paused'));
        $('drill-word').onclick();await browser.flush();
        assert.equal($('drill-parts').hidden, false);
        assert.equal(recordings.at(-1).played, browser.manifest['ثَمَن']);
        assert.ok(!$('drill-audio-status').textContent.includes('前导'), 'whole word has no carrier note');
        $('drill-parts').children[0].onclick();await browser.flush();
        assert.equal(recordings.at(-1).played, browser.manifest['sound:ta']);
        assert.ok($('drill-audio-status').textContent.includes('前导 /a/'), 'carrier is disclosed for letter playback');
        assert.equal($('drill-pause').textContent, paused ? '继续' : '暂停');
        assert.equal($('drill-word').innerHTML, originalWord);
        if (paused) $('drill-pause').onclick();
        assert.ok($('drill-options').children.every(button => !button.disabled));
        assert.equal($('drill-count').textContent, '1/20');
    }
});

test('contextual vowel replay is labelled as a word rather than a made-up isolated sound', async () => {
    const browser = browserFixture('ذ', 0.3), {$} = browser;
    const firstWord = $('drill-word').innerHTML;
    const correct = $('drill-options').children.find(button => button.querySelector('strong').textContent === '/zoː/');
    const completed = correct.onclick();await browser.flush();
    assert.equal(browser.recordings.at(-1).played, browser.manifest['ذَوْق']);
    assert.ok($('drill-audio-status').textContent.includes('在整词中听'));
    assert.equal($('drill-replay').textContent, '♫ 听词内读音');
    $('drill-whole').onclick();await browser.flush();await completed;
    assert.equal($('drill-word').innerHTML, firstWord);
    assert.ok(!$('drill-audio-status').textContent.includes('前导'));
    assert.ok(!$('drill-audio-status').textContent.includes('在整词中听'));
    $('drill-split-toggle').onclick();await browser.flush();
    $('drill-parts').children[0].onclick();await browser.flush();
    assert.equal(browser.recordings.at(-1).played, browser.manifest['ذَوْق']);
    assert.ok($('drill-audio-status').textContent.includes('词内读音 /zoː/'));
});

test('standalone glyph distractors never borrow a pronunciation that requires a whole word', async () => {
    let draws=0;
    const browser=browserFixture('ب',()=>draws++===0?0:.27), {$}=browser;
    const glyphs=$('drill-display').children[0].children;
    assert.ok(glyphs[1].textContent.includes('ِ'), 'the visible short vowel matches its standalone sound');
    $('drill-pause').onclick();
    assert.ok($('drill-feedback').textContent.includes('字母仍可点读'));
    glyphs[1].onclick();await browser.flush();
    assert.equal(browser.recordings.at(-1).played,browser.manifest['sound:bi']);
});

test('target highlighting cannot imitate a vowel mark or hide the word on pause', () => {
    const css = fs.readFileSync(path.join(root, 'classroom.css'), 'utf8');
    const targetStyles = [...css.matchAll(/\.drill-target\s*\{([^}]+)\}/g)];
    assert.ok(targetStyles.length);
    assert.ok(targetStyles.every(match => !/underline/.test(match[1])), 'highlight cannot imitate a vowel mark');
    assert.ok(!/#drill-display\.paused\s*\{\s*visibility\s*:\s*hidden/.test(css));
});

test('word highlights measure intact text including its combining marks', () => {
    for (const q of pool.filter(q => q.word)) {
        const offsets=drill.targetRange(q.word,q.index);
        assert.equal(q.word.slice(offsets.start,offsets.end),drill.graphemes(q.word)[q.index]);
    }
    assert.deepEqual(drill.targetRange('كِتَاب',1),{start:2,end:4});
    assert.deepEqual(drill.targetRange('شُوَيَّة',2),{start:4,end:7});
    const browser=browserFixture('ث'), html=browser.$('drill-display').innerHTML;
    const word=html.match(/id="drill-word-text">([^<]+)<\/span>/)?.[1];
    assert.ok(word, 'the entire word occupies one text node without a target span');
    assert.ok(!/class="drill-target"/.test(html));
    assert.ok(/class="drill-word-highlight"[^>]+aria-hidden="true"/.test(html));
    const css=fs.readFileSync(path.join(root,'classroom.css'),'utf8');
    assert.match(css,/\.drill-word-highlight\s*\{[^}]*position:absolute;[^}]*pointer-events:none/);
});

test('a correct answer advances after audio completion and resets all review controls', async () => {
    const browser = browserFixture(), {$} = browser;
    const correct = $('drill-options').children.find(button => button.querySelector('strong').textContent === '/ta/');
    const completed = correct.onclick();await browser.flush();
    assert.equal(browser.timeouts.size, 0, 'no advancement timer while speech is playing');
    assert.equal($('drill-count').textContent, '1/20');
    assert.equal($('drill-replay').disabled, false);
    assert.equal($('drill-next').hidden, false);
    browser.recordings.at(-1).finish();await completed;
    assert.equal(browser.timeouts.size, 1);
    browser.runTimeouts();
    assert.equal($('drill-count').textContent, '2/20');
    assert.equal($('drill-replay').disabled, true);
    assert.equal($('drill-next').hidden, true);
    assert.equal($('drill-pause').textContent, '暂停');
    assert.ok($('drill-options').children.every(button => !button.disabled));
});

test('deliberate inspection cancels automatic advancement before or after audio finishes', async () => {
    for (const inspectBeforeCompletion of [true, false]) {
        const browser = browserFixture(), {$} = browser;
        const correct = $('drill-options').children.find(button => button.querySelector('strong').textContent === '/ta/');
        const completed = correct.onclick();await browser.flush();
        if (!inspectBeforeCompletion) {browser.recordings.at(-1).finish();await completed;}
        $('drill-word').onclick();await browser.flush();await completed;
        assert.equal(browser.timeouts.size, 0);
        browser.recordings.at(-1).finish();await browser.flush();browser.runTimeouts();
        assert.equal($('drill-count').textContent, '1/20');
        assert.equal($('drill-parts').hidden, false);
        $('drill-next').onclick();
        assert.equal($('drill-count').textContent, '2/20');
    }
});
