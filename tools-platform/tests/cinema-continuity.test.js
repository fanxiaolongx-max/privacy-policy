const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const cinemaPath = path.join(__dirname, '../frontend/pages/cinema.html');
const source = fs.readFileSync(cinemaPath, 'utf8');
const inlineScript = source.slice(source.lastIndexOf('<script>') + '<script>'.length, source.lastIndexOf('</script>'));

test('影视展播页面的内联脚本语法有效', () => {
    assert.doesNotThrow(() => new vm.Script(inlineScript, { filename: cinemaPath }));
});

test('同设备保存最后观看影片并在再次进入时询问续播', () => {
    assert.match(source, /cinema_last_watch_v1/);
    assert.match(source, /id="continueWatchingModal"/);
    assert.match(source, /function offerLastWatchResume\(\)/);
    assert.match(source, /function continueLastWatching\(\)/);
    assert.match(source, /localStorage\.setItem\(LAST_WATCH_KEY/);
});

test('播放器支持同分类上下集、选集及播完自动下一集', () => {
    assert.match(source, /id="previousEpisodeBtn"/);
    assert.match(source, /id="nextEpisodeBtn"/);
    assert.match(source, /id="episodePicker"/);
    assert.match(source, /function getCurrentCategoryEpisodes\(\)/);
    assert.match(source, /function playAdjacentVideo\(direction\)/);
    assert.match(source, /video\.addEventListener\('ended',[\s\S]*?playAdjacentVideo\(1\)/);
});
