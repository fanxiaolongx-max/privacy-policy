const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
    applyBuiltinToolDecisions,
    initializeBuiltinTools,
    previewBuiltinTools
} = require('./models/builtin-tools-sync');

function writeFile(root, relativePath, content) {
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
}

function writeBundledTool(root, slug, files = {}) {
    writeFile(root, `${slug}/index.html`, files['index.html'] || `<html>${slug}</html>`);
    writeFile(root, `${slug}/.tool-manifest.json`, `${JSON.stringify({
        version: 1,
        tool: {
            slug,
            name: slug,
            icon: '🧩',
            description: '',
            tags: [],
            publicAccess: false,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z'
        },
        history: null
    }, null, 2)}\n`);
    Object.entries(files).forEach(([relativePath, content]) => {
        if (relativePath !== 'index.html') writeFile(root, `${slug}/${relativePath}`, content);
    });
}

function run() {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tools-platform-builtin-sync-'));
    const sourceDir = path.join(tempRoot, 'source');
    const targetDir = path.join(tempRoot, 'target');
    const stateFile = path.join(tempRoot, 'data/builtin-tools-sync-decisions.json');
    const backupRoot = path.join(tempRoot, 'data/backups/builtin-tools');
    try {
        writeBundledTool(sourceDir, 'system-tool', {
            'index.html': '<html>v1</html>',
            'assets/obsolete.js': 'obsolete'
        });

        const firstPreview = previewBuiltinTools({ sourceDir, targetDir, stateFile });
        assert.strictEqual(firstPreview.pending.length, 1);
        assert.strictEqual(firstPreview.pending[0].status, 'missing');
        assert.strictEqual(firstPreview.pending[0].counts.added, 2);
        const first = applyBuiltinToolDecisions({
            sourceDir,
            targetDir,
            stateFile,
            backupRoot,
            applySlugs: ['system-tool'],
            expectedFingerprints: { 'system-tool': firstPreview.pending[0].fingerprint }
        });
        assert.deepStrictEqual(first.installed, ['system-tool']);
        assert.strictEqual(fs.readFileSync(path.join(targetDir, 'system-tool/index.html'), 'utf8'), '<html>v1</html>');
        const firstManifest = JSON.parse(fs.readFileSync(path.join(targetDir, 'system-tool/.tool-manifest.json'), 'utf8'));
        assert.strictEqual(firstManifest.builtIn, true);
        assert.strictEqual(firstManifest.system.managedBy, 'tools-platform');

        writeFile(targetDir, 'system-tool/user-note.txt', 'preserve me');
        fs.rmSync(path.join(sourceDir, 'system-tool/assets/obsolete.js'));
        writeFile(sourceDir, 'system-tool/index.html', '<html>v2</html>');
        writeFile(sourceDir, 'system-tool/assets/new.js', 'new');

        const secondPreview = previewBuiltinTools({ sourceDir, targetDir, stateFile });
        assert.strictEqual(secondPreview.pending[0].status, 'update');
        assert.strictEqual(secondPreview.pending[0].counts.modified, 1);
        assert.strictEqual(secondPreview.pending[0].counts.added, 1);
        assert.strictEqual(secondPreview.pending[0].counts.removed, 1);
        assert.strictEqual(secondPreview.pending[0].counts.preserved, 1);
        const second = applyBuiltinToolDecisions({
            sourceDir,
            targetDir,
            stateFile,
            backupRoot,
            applySlugs: ['system-tool'],
            expectedFingerprints: { 'system-tool': secondPreview.pending[0].fingerprint }
        });
        assert.deepStrictEqual(second.updated, ['system-tool']);
        assert.strictEqual(second.backups.length, 1);
        assert.strictEqual(fs.readFileSync(path.join(second.backups[0].path, 'index.html'), 'utf8'), '<html>v1</html>');
        assert.strictEqual(fs.readFileSync(path.join(targetDir, 'system-tool/index.html'), 'utf8'), '<html>v2</html>');
        assert.strictEqual(fs.readFileSync(path.join(targetDir, 'system-tool/user-note.txt'), 'utf8'), 'preserve me');
        assert.strictEqual(fs.existsSync(path.join(targetDir, 'system-tool/assets/obsolete.js')), false);
        assert.strictEqual(fs.readFileSync(path.join(targetDir, 'system-tool/assets/new.js'), 'utf8'), 'new');

        const third = previewBuiltinTools({ sourceDir, targetDir, stateFile });
        assert.deepStrictEqual(third.unchanged, ['system-tool']);
        assert.strictEqual(third.pending.length, 0);

        writeBundledTool(sourceDir, 'legacy-tool', { 'index.html': '<html>legacy</html>' });
        writeBundledTool(targetDir, 'legacy-tool', { 'index.html': '<html>legacy</html>' });
        writeFile(targetDir, 'legacy-tool/user-data.json', '{"preserved":true}');
        const adoptPreview = previewBuiltinTools({ sourceDir, targetDir, stateFile });
        const legacy = adoptPreview.pending.find(tool => tool.slug === 'legacy-tool');
        assert.strictEqual(legacy.status, 'adopt');
        const adopted = applyBuiltinToolDecisions({
            sourceDir,
            targetDir,
            stateFile,
            backupRoot,
            applySlugs: ['legacy-tool'],
            expectedFingerprints: { 'legacy-tool': legacy.fingerprint }
        });
        assert.deepStrictEqual(adopted.adopted, ['legacy-tool']);
        assert.strictEqual(fs.readFileSync(path.join(targetDir, 'legacy-tool/user-data.json'), 'utf8'), '{"preserved":true}');
        const adoptedManifest = JSON.parse(fs.readFileSync(path.join(targetDir, 'legacy-tool/.tool-manifest.json'), 'utf8'));
        assert.strictEqual(adoptedManifest.builtIn, true);

        writeBundledTool(sourceDir, 'collision-tool', { 'index.html': '<html>system</html>' });
        writeBundledTool(targetDir, 'collision-tool', { 'index.html': '<html>user</html>' });
        writeFile(targetDir, 'collision-tool/user-state.json', '{"keep":true}');
        const conflictPreview = previewBuiltinTools({ sourceDir, targetDir, stateFile });
        const collision = conflictPreview.pending.find(tool => tool.slug === 'collision-tool');
        assert.strictEqual(collision.status, 'conflict');
        assert.strictEqual(collision.recommended, false);
        assert.strictEqual(collision.counts.modified, 1);
        assert.strictEqual(collision.counts.preserved, 1);

        const skipped = applyBuiltinToolDecisions({
            sourceDir,
            targetDir,
            stateFile,
            backupRoot,
            skipSlugs: ['collision-tool'],
            expectedFingerprints: { 'collision-tool': collision.fingerprint }
        });
        assert.deepStrictEqual(skipped.skipped, ['collision-tool']);
        assert.strictEqual(fs.readFileSync(path.join(targetDir, 'collision-tool/index.html'), 'utf8'), '<html>user</html>');
        const suppressed = previewBuiltinTools({ sourceDir, targetDir, stateFile });
        assert.strictEqual(suppressed.pending.some(tool => tool.slug === 'collision-tool'), false);
        assert.strictEqual(suppressed.skipped.length, 1);

        writeFile(sourceDir, 'collision-tool/index.html', '<html>system-v2</html>');
        const changedAfterSkip = previewBuiltinTools({ sourceDir, targetDir, stateFile });
        const changedCollision = changedAfterSkip.pending.find(tool => tool.slug === 'collision-tool');
        assert(changedCollision, 'changed bundle should be prompted again after a prior skip');

        assert.throws(() => applyBuiltinToolDecisions({
            sourceDir,
            targetDir,
            stateFile,
            backupRoot,
            applySlugs: ['collision-tool'],
            expectedFingerprints: { 'collision-tool': 'stale-fingerprint' }
        }), error => error.status === 409);

        const overwritten = applyBuiltinToolDecisions({
            sourceDir,
            targetDir,
            stateFile,
            backupRoot,
            applySlugs: ['collision-tool'],
            expectedFingerprints: { 'collision-tool': changedCollision.fingerprint }
        });
        assert.deepStrictEqual(overwritten.updated, ['collision-tool']);
        assert.strictEqual(fs.readFileSync(path.join(targetDir, 'collision-tool/index.html'), 'utf8'), '<html>system-v2</html>');
        assert.strictEqual(fs.readFileSync(path.join(targetDir, 'collision-tool/user-state.json'), 'utf8'), '{"keep":true}');
        assert.strictEqual(fs.readFileSync(path.join(overwritten.backups[0].path, 'index.html'), 'utf8'), '<html>user</html>');

        const samePath = previewBuiltinTools({ sourceDir, targetDir: sourceDir, stateFile });
        assert.strictEqual(samePath.samePath, true);

        writeBundledTool(sourceDir, 'startup-tool', { 'index.html': '<html>startup</html>' });
        const startupTargetDir = path.join(tempRoot, 'startup-target');
        writeBundledTool(sourceDir, 'startup-conflict', { 'index.html': '<html>system</html>' });
        writeBundledTool(startupTargetDir, 'startup-conflict', { 'index.html': '<html>user</html>' });
        const initialized = initializeBuiltinTools({
            sourceDir,
            targetDir: startupTargetDir,
            stateFile: path.join(tempRoot, 'startup-state.json'),
            backupRoot
        });
        assert(initialized.installed.includes('startup-tool'));
        assert(initialized.pending.includes('startup-conflict'));
        assert.strictEqual(fs.readFileSync(path.join(startupTargetDir, 'startup-conflict/index.html'), 'utf8'), '<html>user</html>');

        console.log('builtin tools sync tests passed');
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
}

run();
