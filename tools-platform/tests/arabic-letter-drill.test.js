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
            assert.equal(new Set(q.options.map(o => o.read)).size, count);
            assert.equal(q.options.filter(o => o.read === q.answer.read).length, 1);
        }
    }
    assert.throws(() => drill.question([]), /至少一个/);
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

test('every question has a shipped Egyptian audio file', async () => {
    const JSZip = require('jszip');
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'audio/drill-manifest.json')));
    const zip = await JSZip.loadAsync(fs.readFileSync(path.join(root, 'audio/audio.bundle.zip')));
    for (const q of pool) {
        assert.ok(manifest[q.audioKey], q.audioKey);
        const filename = path.basename(manifest[q.audioKey]);
        assert.ok(zip.files[filename], 'missing packed audio: ' + filename);
        assert.ok((await zip.files[filename].async('nodebuffer')).length > 1000);
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
