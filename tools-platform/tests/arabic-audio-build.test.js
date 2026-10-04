const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const JSZip = require('jszip');
const toolRoot = path.join(__dirname, '../backend/builtin-tools/tool-mtakhxqm');
const generator = require(path.join(toolRoot, 'generate-classroom-audio.cjs'));
const unpacker = import(pathToFileURL(path.join(toolRoot, 'unpack-audio.mjs')).href);
const emptyLessons = 'const STARTER_WORD_DATA=[]; const EGYPTIAN_DIALECT_VOCAB=[]; const DB={}; const MSA_EQUIVALENTS={};';

function plan(items, options = {}) {
    return generator.buildPlan({toolRoot, html: emptyLessons, pronunciation: {}, drill: {bank: () => items}, ...options});
}

function fixture(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'egyptian-audio-test-'));
    const sourceDir = path.join(directory, 'source');
    const targetDir = path.join(directory, 'target');
    fs.mkdirSync(sourceDir);fs.mkdirSync(targetDir);
    t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
    return {sourceDir, targetDir};
}

async function writeBundle(sourceDir, files, manifest = {}) {
    const zip = new JSZip();
    for (const [name, bytes] of Object.entries(files)) zip.file(name, bytes);
    const buffer = await zip.generateAsync({type: 'nodebuffer', compression: 'STORE'});
    fs.writeFileSync(path.join(sourceDir, 'audio.bundle.zip'), buffer);
    fs.writeFileSync(path.join(sourceDir, 'manifest.json'), JSON.stringify({items: {example: {egyptian: manifest.main || 'audio/example.mp3'}}}));
    fs.writeFileSync(path.join(sourceDir, 'drill-manifest.json'), JSON.stringify(manifest.drill || {}));
    return buffer;
}

test('punctuation aliases never replace an exact audio key', () => {
    const built = plan([{audioKey: 'ب', speech: 'بَ'}, {audioKey: 'ب.', speech: 'بِ'}]);
    const plain = built.exact.find(item => item.key === 'ب');
    const punctuated = built.exact.find(item => item.key === 'ب.');
    assert.notEqual(plain.file, punctuated.file);
    assert.equal(built.manifest['ب'], 'audio/' + plain.file);
    assert.equal(built.manifest['ب.'], 'audio/' + punctuated.file);
    assert.deepEqual(built.aliasConflicts, [{alias: 'ب', source: 'ب.'}]);
    assert.throws(() => plan([{audioKey: 'ب', speech: 'بَ'}, {audioKey: 'ب', speech: 'بِ'}]), /Conflicting audio text/);
});

test('contextual target metadata preserves the whole-word pronunciation', () => {
    const common = {word: 'بيت', audioKey: 'بيت', speech: 'بَيْت', targetAudioKey: 'بيت',
        targetSpeech: 'بَيْت', contextOnly: true, wordIpa: 'beːt'};
    const built = plan([{...common, letter: 'ب', index: 0, ipa: 'beː'}, {...common, letter: 'ي', index: 1, ipa: 'eː'}], {
        pronunciation: {WORD_SPEECH: {'بيت': 'بَيْت'}},
        html: "const STARTER_WORD_DATA=[{ar:'بيت'}]; const EGYPTIAN_DIALECT_VOCAB=[]; const DB={}; const MSA_EQUIVALENTS={};"
    });
    const word = built.exact.find(item => item.key === 'بيت');
    assert.equal(word.kind, 'word');
    assert.equal(word.expectedIpa, 'beːt');
    assert.deepEqual(word.contextTargets, [
        {letter: 'ب', index: 0, expectedIpa: 'beː', contextOnly: true},
        {letter: 'ي', index: 1, expectedIpa: 'eː', contextOnly: true}
    ]);
    assert.equal(built.jobs.length, 1, 'one actual word recording serves both contextual targets');
});

test('the explicitly configured Edge TTS binary has priority', t => {
    const previous = process.env.EDGE_TTS_BIN;
    t.after(() => {if (previous === undefined) delete process.env.EDGE_TTS_BIN;else process.env.EDGE_TTS_BIN = previous;});
    process.env.EDGE_TTS_BIN = '/temporary fixture/edge-tts';
    assert.equal(generator.edgeBinary(), '/temporary fixture/edge-tts');
});

test('unpacking repairs missing new assets even when old asset count is higher', async t => {
    const {sourceDir, targetDir} = fixture(t);
    await writeBundle(sourceDir, {'example.mp3': 'main audio', 'new-target.mp3': 'new target'}, {
        drill: {'sound:b': 'audio/new-target.mp3'}
    });
    fs.writeFileSync(path.join(targetDir, 'example.mp3'), 'main audio');
    fs.writeFileSync(path.join(targetDir, 'old-a.mp3'), 'old a');
    fs.writeFileSync(path.join(targetDir, 'old-b.mp3'), 'old b');
    const {unpackAudioBundle} = await unpacker;
    const result = await unpackAudioBundle({sourceDir, targetDir});
    assert.equal(result.extractedCount, 1);
    assert.equal(fs.readFileSync(path.join(targetDir, 'new-target.mp3'), 'utf8'), 'new target');
    assert.equal(fs.readFileSync(path.join(targetDir, 'old-a.mp3'), 'utf8'), 'old a', 'unrelated files are retained');
});

test('unpacking replaces stale bytes and then becomes idempotent', async t => {
    const {sourceDir, targetDir} = fixture(t);
    await writeBundle(sourceDir, {'example.mp3': 'correct new recording'});
    const output = path.join(targetDir, 'example.mp3');
    fs.writeFileSync(output, 'old recording with the same name');
    const {unpackAudioBundle} = await unpacker;
    const first = await unpackAudioBundle({sourceDir, targetDir});
    assert.equal(first.extractedCount, 1);
    assert.equal(fs.readFileSync(output, 'utf8'), 'correct new recording');
    const before = fs.statSync(output).mtimeMs;
    const second = await unpackAudioBundle({sourceDir, targetDir});
    assert.equal(second.skipped, true);
    assert.equal(second.count, 1);
    assert.equal(fs.statSync(output).mtimeMs, before, 'verified files are not rewritten');
    assert.equal(fs.readdirSync(targetDir).length, 1, 'no temporary extraction files remain');
});

test('a missing manifest-referenced clip rejects the archive before writing', async t => {
    const {sourceDir, targetDir} = fixture(t);
    await writeBundle(sourceDir, {'example.mp3': 'audio'}, {drill: {'sound:b': 'audio/missing.mp3'}});
    const {unpackAudioBundle} = await unpacker;
    await assert.rejects(unpackAudioBundle({sourceDir, targetDir}), /missing manifest files: missing\.mp3/);
    assert.deepEqual(fs.readdirSync(targetDir), []);
});

test('CRC corruption rejects the archive before replacing existing audio', async t => {
    const {sourceDir, targetDir} = fixture(t);
    const payload = 'CRC verified unique audio bytes';
    const buffer = await writeBundle(sourceDir, {'example.mp3': payload});
    const offset = buffer.indexOf(payload);
    assert.ok(offset > 0);
    buffer[offset] ^= 1;
    fs.writeFileSync(path.join(sourceDir, 'audio.bundle.zip'), buffer);
    const destination = path.join(targetDir, 'example.mp3');
    fs.writeFileSync(destination, 'current audio stays intact');
    const {unpackAudioBundle} = await unpacker;
    await assert.rejects(unpackAudioBundle({sourceDir, targetDir}), /CRC32/i);
    assert.equal(fs.readFileSync(destination, 'utf8'), 'current audio stays intact');
});
