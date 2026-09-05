const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const graphSource = fs.readFileSync(path.join(
    __dirname,
    '..',
    'frontend',
    'js',
    'shared',
    'ai-knowledge-graph-spatial-themes-v5.js'
), 'utf8');

test('chat relationship overview expands every group and discussion by default', () => {
    assert.match(graphSource, /state\.chatView = \{ mode:'overview', nodeId:null \}/);
    assert.match(graphSource, /\['group', 'discussion'\]\.includes\(node\.conversationType\)/);
    assert.match(graphSource, /expandedConversationIds\.has\(edge\.source\)/);
    assert.doesNotMatch(graphSource, /defaultExpandedConversation/);
});

test('chat relationship overview creates a separate person node for each conversation', () => {
    assert.match(graphSource, /instanceId = `\$\{person\.id\}:conversation:/);
    assert.match(graphSource, /canonicalPersonId: person\.id/);
    assert.match(graphSource, /scopeConversationId: conversation\?\.conversationId/);
    assert.match(graphSource, /instanceEdges\.push\(\{ \.\.\.edge, target: instanceId \}\)/);
    assert.match(graphSource, /node\.canonicalPersonId \|\| node\.id/);
});
