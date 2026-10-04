/* Curated Egyptian lesson audio. Never touches runtime user data. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const run = promisify(execFile);
const VOICE = 'ar-EG-SalmaNeural';
const RATE = '-8%';
const REVISION = 'egyptian-ipa-20261004-1';
// Synthesis spellings do not change the spelling displayed by the classroom.
const SPOKEN = {
    'ثَمَن':'تَمَن', 'ثَانِيَة':'سَنْيَة', 'مَثَل':'مَسَل', 'ذَهَب':'دَهَب',
    'ظَهْر':'ضَهْر', 'قَلْب':'أَلْب', 'سُوق':'سُوء', 'وَقْت':'وَأْت',
    'ذِرَاع':'دِرَاع', 'ذُرَة':'دُرَة', 'قَ':'أَ', 'قِ':'إِ', 'قُ':'أُ', 'قْ':'أَءْ',
    'عَمَّتي':'عَمِّتِي', 'خالتي':'خَالْتِي', 'ثَلَاثَة':'تَلَاتَة',
    'بَحْث':'بَحْس', 'قَفَص':'أَفَص',
    'بَيْت':'بيت', 'يَوْم':'يوم', 'ذَوْق':'ذوق', 'نَظِيف':'نضيف',
    'ذَيْل':'ديل', 'أُسْتَاذ':'استاذ', 'قَهْوَة':'قهوة', 'قَلَم':'قلم', 'قُطَّة':'قطة'
};
const stripPunctuation = text => text.replace(/[.؟،!…]/g, '').trim();
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
function fileName(speech) {
    return 'classroom-' + sha([REVISION, VOICE, RATE, speech].join('\n')).slice(0, 16) + '.mp3';
}
function edgeBinary() {
    return process.env.EDGE_TTS_BIN || (fs.existsSync('/Users/dragon/.local/bin/edge-tts')
        ? '/Users/dragon/.local/bin/edge-tts' : 'edge-tts');
}

function buildPlan(options = {}) {
    const toolRoot = options.toolRoot || __dirname;
    const drill = options.drill || require(path.join(toolRoot, 'letter-drill.js'));
    const dataPath = path.join(toolRoot, 'letter-drill-data.js');
    const pronunciation = options.pronunciation || (fs.existsSync(dataPath) ? require(dataPath) : {});
    const html = options.html || fs.readFileSync(path.join(toolRoot, 'index.html'), 'utf8');
    const begin = html.indexOf('const STARTER_WORD_DATA');
    const end = html.indexOf('const MSA_EQUIVALENTS');
    if (begin < 0 || end <= begin) throw new Error('Unable to locate classroom lesson data');
    const lessons = vm.runInNewContext(html.slice(begin, end) + '; ({STARTER_WORD_DATA, EGYPTIAN_DIALECT_VOCAB, DB})');
    const exact = new Map();
    function add(key, speech, metadata = {}) {
        if (!key || !speech) throw new Error('Audio key and synthesis text are required');
        const previous = exact.get(key);
        if (previous && previous.speech !== speech) throw new Error('Conflicting audio text for key: ' + key);
        exact.set(key, {key, speech, ...previous, ...metadata, file: fileName(speech)});
    }
    const wordSpeech = (key, fallback) => pronunciation.WORD_SPEECH?.[key] || SPOKEN[key] || fallback || key;
    for (const item of drill.bank()) {
        add(item.audioKey, wordSpeech(item.audioKey, item.speech), {
            kind: item.word ? 'word' : 'syllable', expectedIpa: item.word ? item.wordIpa || null : item.ipa || null,
            target: item.word ? null : item.letter, approximate: false
        });
        if (item.contextOnly) {
            const wordEntry = exact.get(item.audioKey);
            const target = {letter: item.letter, index: item.index, expectedIpa: item.ipa, contextOnly: true};
            wordEntry.contextTargets = [...(wordEntry.contextTargets || []), target];
        } else if (item.targetAudioKey && item.targetSpeech) add(item.targetAudioKey, item.targetSpeech, {
            kind: 'sound', expectedIpa: item.ipa || null, target: item.read,
            carrier: Boolean(item.carrier), approximate: /[eoēō]/.test(item.read)
        });
    }
    if (typeof drill.audioTargets === 'function') for (const item of drill.audioTargets()) {
        add(item.audioKey, item.speech, {
            kind: item.kind || 'sound', expectedIpa: item.ipa || null, target: item.read || item.audioKey.slice(6),
            carrier: Boolean(item.carrier), approximate: Boolean(item.approximate) || /[eoēō]/.test(item.read || item.audioKey.slice(6))
        });
    }
    for (const item of [...lessons.STARTER_WORD_DATA, ...lessons.EGYPTIAN_DIALECT_VOCAB, ...Object.values(lessons.DB).flat()]) {
        // Preserve detailed drill-word phonetic metadata on repeated lesson keys.
        const existing = exact.get(item.ar);
        add(item.ar, wordSpeech(item.ar, item.ar), existing ? {} : {kind: 'lesson', expectedIpa: null, approximate: false});
    }
    const manifest = Object.fromEntries([...exact].map(([key, item]) => [key, 'audio/' + item.file]));
    const aliasConflicts = [];
    for (const [key, item] of exact) {
        const alias = stripPunctuation(key);
        if (alias === key || !alias) continue;
        if (Object.hasOwn(manifest, alias)) {
            if (manifest[alias] !== 'audio/' + item.file) aliasConflicts.push({alias, source: key});
            continue;
        }
        manifest[alias] = 'audio/' + item.file;
    }
    const jobs = [...new Map([...exact.values()].map(item => [item.file, item])).values()];
    return {toolRoot, exact: [...exact.values()], jobs, manifest, aliasConflicts};
}

async function inspectAudio(filename) {
    const [probe, decoded] = await Promise.all([
        run(process.env.FFPROBE_BIN || 'ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,sample_rate,channels', '-of', 'json', filename]),
        run(process.env.FFMPEG_BIN || 'ffmpeg', ['-v', 'error', '-i', filename, '-f', 's16le', '-ac', '1', '-ar', '24000', '-'], {encoding: 'buffer', maxBuffer: 8 * 1024 * 1024})
    ]);
    const info = JSON.parse(probe.stdout);
    const pcm = decoded.stdout;
    let sum = 0, peak = 0, active = 0;
    for (let i = 0; i + 1 < pcm.length; i += 2) {
        const sample = pcm.readInt16LE(i);
        sum += sample * sample;
        peak = Math.max(peak, Math.abs(sample));
        if (Math.abs(sample) > 300) active++;
    }
    const samples = pcm.length / 2;
    const duration = Number(info.format?.duration);
    const rms = samples ? Math.sqrt(sum / samples) : 0;
    if (!samples || !Number.isFinite(duration) || duration < 0.10 || duration > 30 || rms < 20 || peak < 100) {
        throw new Error('Invalid or silent audio: ' + path.basename(filename));
    }
    return {duration, rms: Math.round(rms), peak, activeSeconds: +(active / 24000).toFixed(3),
        sha256: sha(fs.readFileSync(filename)), lowLevel: rms < 300,
        sampleRate: Number(info.streams?.[0]?.sample_rate), channels: info.streams?.[0]?.channels};
}

async function auditPlan(plan, options = {}) {
    const audioDir = options.audioDir || path.join(plan.toolRoot, 'audio');
    const rows = [];
    for (const item of plan.jobs) {
        const destination = path.join(audioDir, item.file);
        if (!fs.existsSync(destination)) rows.push({file: item.file, missing: true});
        else {
            try { rows.push({file: item.file, ...await inspectAudio(destination)}); }
            catch (error) { rows.push({file: item.file, error: error.message}); }
        }
    }
    return {revision: REVISION, voice: VOICE, rate: RATE, keyCount: plan.exact.length, fileCount: plan.jobs.length,
        aliasConflicts: plan.aliasConflicts, missing: rows.filter(row => row.missing).length,
        invalid: rows.filter(row => row.error).length, lowLevel: rows.filter(row => row.lowLevel).length, files: rows};
}

function atomicJson(filename, value) {
    const temporary = filename + '.part-' + process.pid;
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n');
    fs.renameSync(temporary, filename);
}

async function generateAudio(plan, options = {}) {
    const audioDir = path.join(plan.toolRoot, 'audio');
    fs.mkdirSync(audioDir, {recursive: true});
    const auditPath = path.join(audioDir, 'drill-audit.json');
    let previous = {};
    try { previous = JSON.parse(fs.readFileSync(auditPath, 'utf8')); } catch (_) {}
    const cache = new Map((previous.entries || []).map(item => [item.file, item]));
    const records = new Map();
    let cursor = 0, failure = null;
    async function worker() {
        while (!failure && cursor < plan.jobs.length) {
            const item = plan.jobs[cursor++];
            const destination = path.join(audioDir, item.file);
            const cached = cache.get(item.file);
            if (!options.force && cached?.revision === REVISION && cached.speech === item.speech && fs.existsSync(destination)) {
                try {
                    const measured = await inspectAudio(destination);
                    if (measured.sha256 === cached.sha256 && !measured.lowLevel) {
                        records.set(item.file, {...measured, source: cached.source || 'synthesized',
                            originalRms: cached.originalRms, gainDb: cached.gainDb, lowSpeechActivity: cached.lowSpeechActivity});
                        continue;
                    }
                } catch (_) { /* Regenerate corrupt or stale cached speech. */ }
            }
            const raw = destination + '.raw-' + process.pid + '.mp3';
            const normalized = destination + '.part-' + process.pid + '.mp3';
            let lastError;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    await run(edgeBinary(), ['--voice', VOICE, '--rate=' + RATE, '--text', item.speech, '--write-media', raw], {timeout: 60000});
                    const initial = await inspectAudio(raw);
                    const gain = Math.min(12, Math.max(-12, -3 - 20 * Math.log10(initial.peak / 32768)));
                    const trim = 'silenceremove=start_periods=1:start_duration=0.015:start_threshold=-55dB';
                    await run(process.env.FFMPEG_BIN || 'ffmpeg', ['-y', '-v', 'error', '-i', raw, '-af',
                        trim + ',areverse,' + trim + ',areverse,volume=' + gain.toFixed(2) + 'dB,apad=pad_dur=0.08',
                        '-ar', '24000', '-ac', '1', '-b:a', '48k', normalized], {timeout: 60000});
                    const measured = await inspectAudio(normalized);
                    fs.renameSync(normalized, destination);
                    records.set(item.file, {...measured, source: 'synthesized', originalRms: initial.rms,
                        gainDb: +gain.toFixed(2), lowSpeechActivity: initial.activeSeconds < 0.08});
                    if (typeof options.onProgress === 'function') options.onProgress(item, records.size, plan.jobs.length);
                    break;
                } catch (error) {
                    lastError = error;
                    if (attempt === 3) {
                        failure = new Error('Audio generation failed for ' + item.key + ': ' + error.message);
                        throw failure;
                    }
                } finally {
                    for (const file of [raw, normalized]) if (fs.existsSync(file)) fs.unlinkSync(file);
                }
            }
            if (!records.has(item.file)) throw lastError;
        }
    }
    const outcomes = await Promise.allSettled(Array.from({length: options.concurrency || 4}, worker));
    const rejected = outcomes.find(outcome => outcome.status === 'rejected');
    if (rejected) throw rejected.reason;
    const audit = {revision: REVISION, generatedAt: new Date().toISOString(), voice: VOICE, rate: RATE,
        verification: 'Decoded, measured, silence-trimmed and volume-normalized; not a human pronunciation review.',
        nativeReviewed: false,
        pendingNativeReview: plan.exact.filter(item => ['ذَوْق', 'فَوْق'].includes(item.key)).map(item => ({
            key: item.key, speech: item.speech, expectedIpa: item.expectedIpa,
            reason: 'Confirm Cairo long /oː/ and final /ʔ/ by a native speaker; decoding and ASR do not verify these sounds.'
        })),
        aliasConflicts: plan.aliasConflicts, entries: plan.exact.map(item => ({...item, revision: REVISION, ...records.get(item.file)}))};
    atomicJson(auditPath, audit);
    atomicJson(path.join(audioDir, 'drill-manifest.json'), plan.manifest);
    const basePath = path.join(audioDir, 'manifest.json');
    const original = JSON.parse(fs.readFileSync(basePath, 'utf8'));
    original.audioFileCount = fs.readdirSync(audioDir).filter(name => name.endsWith('.mp3')).length;
    atomicJson(basePath, original);
    return audit;
}

module.exports = {VOICE, RATE, REVISION, buildPlan, auditPlan, generateAudio, inspectAudio, fileName, edgeBinary};
if (require.main === module) {
    const plan = buildPlan();
    (process.argv.includes('--audit') ? auditPlan(plan) : generateAudio(plan, {
        force: process.argv.includes('--force'), onProgress: (_item, completed, total) => console.log('Audio ' + completed + '/' + total)
    })).then(result => console.log(JSON.stringify(process.argv.includes('--audit') ? result : {
        revision: result.revision, keys: result.entries.length, files: plan.jobs.length
    }, null, 2))).catch(error => {console.error(error.message); process.exitCode = 1;});
}
