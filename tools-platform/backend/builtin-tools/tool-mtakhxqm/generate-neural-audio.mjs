import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import vm from 'node:vm';

const execFileAsync = promisify(execFile);
const toolDir = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(toolDir, 'index.html');
const outputDir = join(toolDir, 'audio');
const edgeTtsBin = process.env.EDGE_TTS_BIN || 'edge-tts';
const egyptianVoice = 'ar-EG-SalmaNeural';
const standardVoice = 'ar-SA-ZariyahNeural';
const concurrency = 4;

const html = await readFile(htmlPath, 'utf8');
const dbMatch = html.match(/const DB = (\{[\s\S]*?\n        \});\n\n        \/\* 标准阿语/);
const msaMatch = html.match(/const MSA_EQUIVALENTS = (\{[\s\S]*?\n        \});\n\n        const TOKEN_GLOSS/);
const starterWordsMatch = html.match(/const STARTER_WORD_DATA = (\[[\s\S]*?\n        \]);/);
if (!dbMatch || !msaMatch || !starterWordsMatch) throw new Error('Unable to locate Arabic lesson data in index.html');

const context = {};
vm.runInNewContext(`lessonDb = ${dbMatch[1]}; msaMap = ${msaMatch[1]}; starterWords = ${starterWordsMatch[1]};`, context);
const { lessonDb, msaMap, starterWords } = context;
const entries = [
    ...lessonDb.family,
    ...lessonDb.basic,
    ...lessonDb.supermarket,
    ...lessonDb.numbers,
    ...lessonDb.dialogues,
    ...starterWords
];

const uniqueEntries = new Map();
for (const entry of entries) {
    const egyptianText = entry.ar.trim();
    if (!uniqueEntries.has(egyptianText)) {
        uniqueEntries.set(egyptianText, {
            egyptianText,
            standardText: entry.msa || msaMap[egyptianText] || egyptianText
        });
    }
}

// Include vocabulary and dialogue added directly to the static learning page.
const supplementalPatterns = [
    /<td class="vocab-example"><b>([^<]+)<\/b>/g,
    /<td class="vocab-ar"[^>]*>([^<]+)<\/td>/g,
    /<div class="scene-arabic"[^>]*>([^<]+)<\/div>/g,
    /<p><b lang="ar">([^<]+)<\/b>/g
];
for (const pattern of supplementalPatterns) {
    for (const match of html.matchAll(pattern)) {
        const text = match[1].trim();
        if (text && !uniqueEntries.has(text)) {
            uniqueEntries.set(text, { egyptianText: text, standardText: text });
        }
    }
}

const letterNames = {
    "ا": "ألف", "أ": "ألف", "إ": "ألف", "آ": "ألف ممدودة", "ب": "باء", "ت": "تاء",
    "ة": "تاء مربوطة", "ث": "ثاء", "ج": "جيم", "ح": "حاء", "خ": "خاء", "د": "دال",
    "ذ": "ذال", "ر": "راء", "ز": "زاي", "س": "سين", "ش": "شين", "ص": "صاد",
    "ض": "ضاد", "ط": "طاء", "ظ": "ظاء", "ع": "عين", "غ": "غين", "ف": "فاء",
    "ق": "قاف", "ك": "كاف", "ل": "لام", "م": "ميم", "ن": "نون", "ه": "هاء",
    "و": "واو", "ي": "ياء", "ى": "ألف مقصورة", "ء": "همزة", "ئ": "همزة على نبرة",
    "ؤ": "همزة على واو"
};

const alphabetLetters = [...'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'];

function syllableSpecs(letter) {
    if (letter === 'ا') {
        return [
            { key: 'أَ', text: 'أَ', label: 'a' },
            { key: 'إِ', text: 'إِ', label: 'i' },
            { key: 'أُ', text: 'أُ', label: 'u' },
            { key: 'آ', text: 'آ', label: 'ā' }
        ];
    }
    return [
        { key: `${letter}َ`, text: `${letter}َ`, label: 'a' },
        { key: `${letter}ِ`, text: `${letter}ِ`, label: 'i' },
        { key: `${letter}ُ`, text: `${letter}ُ`, label: 'u' },
        { key: `${letter}ْ`, text: `أَ${letter}ْ`, label: '无元音收尾' }
    ];
}

function words(text) {
    return text.replace(/[.؟،!…]/g, ' ').match(/[\u0600-\u06ff]+|[0-9\u0660-\u0669]+/g) || [];
}

function letters(text) {
    const segmenter = new Intl.Segmenter('ar', { granularity: 'grapheme' });
    return [...segmenter.segment(text)]
        .map(({ segment }) => segment.replace(/[\u064b-\u065f\u0670]/g, ''))
        .filter(letter => letterNames[letter]);
}

function graphemes(text) {
    const segmenter = new Intl.Segmenter('ar', { granularity: 'grapheme' });
    return [...segmenter.segment(text)]
        .map(({ segment }) => segment)
        .filter(unit => /[\u0600-\u06ff]/.test(unit) && letters(unit).length);
}

await mkdir(outputDir, { recursive: true });

function fileStem(text) {
    return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

async function synthesize(text, voice, destination) {
    try {
        await access(destination);
        return;
    } catch {
        // Generate missing assets below.
    }
    const temporary = `${destination}.part`;
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            await execFileAsync(edgeTtsBin, [
                '--voice', voice,
                '--rate=-12%',
                '--text', text,
                '--write-media', temporary
            ], { timeout: 60000 });
            await rename(temporary, destination);
            return;
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError;
}

const jobs = [];
const items = {};
for (const { egyptianText, standardText } of uniqueEntries.values()) {
    const key = fileStem(egyptianText);
    const egyptianFile = `eg-${key}.mp3`;
    const standardFile = `msa-${key}.mp3`;
    items[egyptianText] = {
        egyptianText,
        standardText,
        egyptian: `audio/${egyptianFile}`,
        standard: `audio/${standardFile}`
    };
    jobs.push(
        { text: egyptianText, voice: egyptianVoice, path: join(outputDir, egyptianFile) },
        { text: standardText, voice: standardVoice, path: join(outputDir, standardFile) }
    );
}

const units = {
    words: { egyptian: {}, standard: {} },
    letters: { egyptian: {}, standard: {} },
    syllables: { egyptian: {}, standard: {} }
};
const egyptianWords = new Set();
const standardWords = new Set();
for (const { egyptianText, standardText } of uniqueEntries.values()) {
    words(egyptianText).forEach(word => egyptianWords.add(word));
    words(standardText).forEach(word => standardWords.add(word));
}

function addWordUnit(word, variant, voice) {
    const reusable = items[word]?.[variant];
    if (reusable) {
        units.words[variant][word] = reusable;
        return;
    }
    const filename = `word-${variant}-${fileStem(word)}.mp3`;
    units.words[variant][word] = `audio/${filename}`;
    jobs.push({ text: word, voice, path: join(outputDir, filename) });
}

egyptianWords.forEach(word => addWordUnit(word, 'egyptian', egyptianVoice));
standardWords.forEach(word => addWordUnit(word, 'standard', standardVoice));

const allLetters = new Set([
    ...alphabetLetters,
    ...[...egyptianWords].flatMap(letters),
    ...[...standardWords].flatMap(letters)
]);
for (const letter of allLetters) {
    for (const [variant, voice] of [['egyptian', egyptianVoice], ['standard', standardVoice]]) {
        const filename = `letter-${variant}-${fileStem(letter)}.mp3`;
        units.letters[variant][letter] = {
            name: letterNames[letter],
            audio: `audio/${filename}`
        };
        jobs.push({ text: letterNames[letter], voice, path: join(outputDir, filename) });
    }
}

for (const letter of alphabetLetters) {
    for (const spec of syllableSpecs(letter)) {
        for (const [variant, voice] of [['egyptian', egyptianVoice], ['standard', standardVoice]]) {
            const filename = `syllable-${variant}-${fileStem(spec.key)}.mp3`;
            units.syllables[variant][spec.key] = {
                text: spec.text,
                label: spec.label,
                audio: `audio/${filename}`
            };
            jobs.push({ text: spec.text, voice, path: join(outputDir, filename) });
        }
    }
}


// Add every vowelled grapheme used by the page, including shadda combinations.
const allGraphemes = new Set([
    ...[...egyptianWords].flatMap(graphemes),
    ...[...standardWords].flatMap(graphemes)
]);
for (const unit of allGraphemes) {
    for (const [variant, voice] of [['egyptian', egyptianVoice], ['standard', standardVoice]]) {
        if (units.syllables[variant][unit]) continue;
        const spokenText = unit.includes('ْ') ? `أَ${unit}` : unit;
        const filename = `syllable-${variant}-${fileStem(unit)}.mp3`;
        units.syllables[variant][unit] = {
            text: spokenText,
            label: '页面字素',
            audio: `audio/${filename}`
        };
        jobs.push({ text: spokenText, voice, path: join(outputDir, filename) });
    }
}

let nextJob = 0;
let completed = 0;
async function worker() {
    while (nextJob < jobs.length) {
        const job = jobs[nextJob];
        nextJob += 1;
        await synthesize(job.text, job.voice, job.path);
        completed += 1;
        process.stdout.write(`\rGenerated ${completed}/${jobs.length}`);
    }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
process.stdout.write('\n');

const manifest = {
    version: 4,
    generatedAt: new Date().toISOString(),
    voices: {
        egyptian: { locale: 'ar-EG', name: egyptianVoice, gender: 'female' },
        standard: { locale: 'ar-SA', name: standardVoice, gender: 'female' }
    },
    itemCount: Object.keys(items).length,
    wordCount: egyptianWords.size + standardWords.size,
    letterCount: allLetters.size,
    audioFileCount: new Set([
        ...Object.values(items).flatMap(item => [item.egyptian, item.standard]),
        ...Object.values(units.words.egyptian),
        ...Object.values(units.words.standard),
        ...Object.values(units.letters.egyptian).map(item => item.audio),
        ...Object.values(units.letters.standard).map(item => item.audio),
        ...Object.values(units.syllables.egyptian).map(item => item.audio),
        ...Object.values(units.syllables.standard).map(item => item.audio)
    ]).size,
    items,
    units
};
await writeFile(join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Prepared ${manifest.audioFileCount} audio files for ${manifest.itemCount} lesson entries, ${manifest.wordCount} accent-specific words, ${manifest.letterCount} letters, and ${Object.keys(units.syllables.egyptian).length * 2} accent-specific syllables.`);
