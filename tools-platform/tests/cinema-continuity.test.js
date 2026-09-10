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

test('移动端支持 iOS 原生视频全屏', () => {
    assert.match(source, /function isIOSDevice\(\)/);
    assert.match(source, /video\.webkitEnterFullscreen\(\)/);
    assert.match(source, /video\.webkitExitFullscreen\(\)/);
    assert.match(source, /webkitbeginfullscreen/);
    assert.match(source, /webkitendfullscreen/);
});

test('影片详情使用当前视频的动态技术参数', () => {
    assert.match(source, /id="currentResolutionSpec"/);
    assert.match(source, /currentFileSizeSpec/);
    assert.match(source, /item\.fileSizeFormatted/);
    assert.match(source, /item\.audioCodec/);
});

test('播放器控制按钮仅显示图标且保留无障碍名称', () => {
    assert.match(source, /\.player-wrapper \.ctrl-btn \.ctrl-label/);
    assert.match(source, /class="ctrl-label" id="fullscreenBtnText"/);
    assert.match(source, /id="fullscreenBtn"[^>]*aria-label="切换全屏"/);
    assert.match(source, /id="episodePickerBtn"[^>]*aria-label="打开选集"/);
});
