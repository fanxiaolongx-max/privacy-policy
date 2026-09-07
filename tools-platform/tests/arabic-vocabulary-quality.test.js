const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
    path.join(__dirname, '../backend/builtin-tools/tool-mtakhxqm/index.html'),
    'utf8'
);

test('beginner vocabulary keeps internal sukun without mechanically adding a final sukun', () => {
    assert.match(source, /\{ ar: 'تَمْر', emoji:/);
    assert.doesNotMatch(source, /تَمْرْ/);
    assert.doesNotMatch(source, /return `\$\{letter\}ْ`/);
});

test('flashcard Arabic text leaves vertical room for vowel marks', () => {
    assert.match(source, /\.starter-word \{[^}]*line-height: 1\.45;[^}]*padding: \.28em \.2em \.18em;[^}]*overflow: visible;/);
    assert.match(source, /\.starter-back-word \{[^}]*line-height: 1\.4;[^}]*overflow: visible;/);
    assert.match(source, /\.starter-breakdown-letter \{[^}]*min-height: 43px;[^}]*overflow: visible;[^}]*line-height: 1\.35;/);
    assert.doesNotMatch(source, /\.starter-word \{[^}]*overflow: hidden;/);
});

test('memory category controls appear only on the front of each flashcard', () => {
    const cardTemplate = source.slice(
        source.indexOf('function createUnifiedWordCard'),
        source.indexOf('// 正面整词发音')
    );
    assert.equal((cardTemplate.match(/\$\{categoryButtonsHtml\}/g) || []).length, 1);
    assert.doesNotMatch(cardTemplate, /starter-flip-back[\s\S]*\$\{categoryButtonsHtml\}/);
    assert.match(source, /\.starter-flip-card\.flipped \.starter-flip-front \.card-shift-actions \{ display: none; \}/);
});

test('Arabic spelling, transliteration, and case-ending examples stay aligned', () => {
    const expectedPairs = [
        ['بِقَلْبِي', 'bi-qalbī'],
        ['خُبْز', 'khubz'],
        ['مَثِيل', 'mathīl'],
        ['صَنْدُوق', 'ṣandūʾ'],
        ['بَرْطَمَان', 'barṭamān'],
        ['إِزَازَة', 'izāza'],
        ['بَيْتٌ', 'baytun'],
        ['بَيْتٍ', 'baytin'],
        ['بَيْتًا', 'baytan'],
        ['كُتُبٌ', 'kutubun'],
        ['عُضْوٌ', 'ʿuḍwun'],
        ['هَدْيٌ', 'hadyun'],
        ['مَبْدَأً', 'mabdaʾan'],
        ['تَبَاطُؤٌ', 'tabāṭuʾun']
    ];
    expectedPairs.forEach(([arabic, transliteration]) => {
        assert.ok(source.includes(arabic), `missing corrected Arabic form: ${arabic}`);
        assert.ok(source.includes(transliteration), `missing corrected transliteration: ${transliteration}`);
    });
});

test('flashcard phonetic labels analyze only the selected key letter', () => {
    const graphemeHelpers = source.slice(
        source.indexOf('function graphemeParts'),
        source.indexOf('function interactiveArabicHtml')
    );
    const keyPhoneticHelper = source.slice(
        source.indexOf('function analyzeKeyLetterPhonetics'),
        source.indexOf('// 关键字母在词前')
    );
    const analyze = vm.runInNewContext(
        `${graphemeHelpers}\n${keyPhoneticHelper}\nanalyzeKeyLetterPhonetics`,
        { Intl }
    );

    assert.equal(analyze('تُفَّاح', 'ت').vowelDetail, '短音 u');
    assert.equal(analyze('تُفَّاح', 'ف').vowelDetail, '长音 ā · 重音');
    assert.equal(analyze('بَاب', 'ب').vowelDetail, '长音 ā');
    assert.equal(analyze('تِين', 'ت').vowelDetail, '长音 ī');
    assert.equal(analyze('سُوق', 'و').vowelDetail, '长音 ū');
    assert.equal(analyze('بَيْت', 'ب').vowelDetail, '双元音 ay');
    assert.equal(analyze('تَمْر', 'م').vowelDetail, '静音 ْ');

    assert.match(source, /const keyPhonetics = getCardKeyPhonetics\(word\);/);
    assert.match(source, /keyPhonetics\.vowelDetail/);
    assert.doesNotMatch(source, /starter-card-phonetic-badge[^\n]*word\.vowelClass/);
});
