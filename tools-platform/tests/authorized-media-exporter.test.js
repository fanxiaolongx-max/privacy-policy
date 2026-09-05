const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const toolDir = path.join(__dirname, '..', 'backend', 'builtin-tools', 'f12-to-extension');
const script = fs.readFileSync(path.join(toolDir, 'authorized-media-exporter.js'), 'utf8');
const page = fs.readFileSync(path.join(toolDir, 'index.html'), 'utf8');

test('authorized media exporter is bundled without decryption or credential extraction', () => {
  assert.match(page, /authorized-media-exporter\.js/);
  assert.match(script, /download_all\.sh/);
  assert.match(script, /performance\.getEntriesByType\('resource'\)/);
  assert.match(script, /video, video source/);
  assert.match(script, /ffmpeg/);
  assert.doesNotMatch(script, /crypto\.subtle|AES-(?:CBC|GCM)|widevine|authorization\s*:|document\.cookie/i);
});
