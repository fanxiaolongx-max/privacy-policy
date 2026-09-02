const test = require('node:test');
const assert = require('node:assert/strict');

const { collapseToolAssetFiles } = require('../backend/models/ai-knowledge-service');

test('knowledge graph collapses MP3 assets while preserving actual totals', () => {
    const files = [
        { path: 'index.html', bytes: 1200, mtimeMs: 10 },
        { path: 'audio/lesson-1.mp3', bytes: 2000, mtimeMs: 20 },
        { path: 'audio/unit-2/lesson-2.MP3', bytes: 3000, mtimeMs: 30 },
        { path: 'styles/app.css', bytes: 400, mtimeMs: 15 }
    ];

    const result = collapseToolAssetFiles(files);
    assert.deepEqual(result.visibleFiles.map(file => file.path), ['index.html', 'styles/app.css']);
    assert.equal(result.collapsedGroups.length, 1);
    assert.equal(result.collapsedGroups[0].extension, '.mp3');
    assert.equal(result.collapsedGroups[0].fileCount, 2);
    assert.equal(result.collapsedGroups[0].bytes, 5000);
    assert.equal(result.collapsedGroups[0].mtimeMs, 30);
});
