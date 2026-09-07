const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
    DEFAULT_MEDIA_ORDER,
    normalizeMediaOrder,
    compareMediaOrder
} = require('../backend/routes/media');

test('龙餐馆在未设置优先级时默认排在普通视频之前', () => {
    assert.equal(normalizeMediaOrder(undefined, true), 0);
    assert.equal(normalizeMediaOrder(undefined, false), DEFAULT_MEDIA_ORDER);

    const videos = [
        { fileName: '01_普通视频.mp4', order: normalizeMediaOrder(undefined, false) },
        { fileName: '龙餐馆_1334x720.mp4', order: normalizeMediaOrder(undefined, true) }
    ].sort(compareMediaOrder);

    assert.equal(videos[0].fileName, '龙餐馆_1334x720.mp4');
});

test('管理员设置的整数优先级优先于默认顺序', () => {
    assert.equal(normalizeMediaOrder(-5, false), -5);
    assert.equal(normalizeMediaOrder('12', false), 12);
    assert.equal(normalizeMediaOrder('not-a-number', false), DEFAULT_MEDIA_ORDER);

    const videos = [
        { fileName: '龙餐馆.mp4', order: 1 },
        { fileName: '管理员置顶.mp4', order: 0 }
    ].sort(compareMediaOrder);

    assert.equal(videos[0].fileName, '管理员置顶.mp4');
});

test('管理端可修改优先级，影视展播使用服务端排序的第一项', () => {
    const navbarSource = fs.readFileSync(path.join(__dirname, '../frontend/js/shared/navbar.js'), 'utf8');
    const cinemaSource = fs.readFileSync(path.join(__dirname, '../frontend/pages/cinema.html'), 'utf8');

    assert.match(navbarSource, /onchange="setMediaPriority\(/);
    assert.match(navbarSource, /body: JSON\.stringify\(\{ order \}\)/);
    assert.match(cinemaSource, /const defaultFilm = allVideos\[0\]/);
    assert.match(cinemaSource, /applyVideoToPage\(defaultFilm\)/);
});

test('媒体管理不重复渲染全部分类，根目录分类使用分类 ID 筛选', () => {
    const navbarSource = fs.readFileSync(path.join(__dirname, '../frontend/js/shared/navbar.js'), 'utf8');

    assert.match(navbarSource, /categories\.filter\(category => category\.id !== 'all'\)/);
    assert.match(navbarSource, /const filterValue = c\.folder \|\| c\.id/);
    assert.match(navbarSource, /video\.category === category\.id/);
});

test('Windows 打包版使用可写媒体目录，不在 app.asar 内创建目录', (t) => {
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'tools-media-runtime-'));
    t.after(() => fs.rmSync(sandbox, { recursive: true, force: true }));
    const mediaDir = path.join(sandbox, 'media');
    const routePath = path.join(__dirname, '../backend/routes/media.js');
    const script = `const media = require(${JSON.stringify(routePath)}); process.stdout.write(media.VIDEOS_DIR);`;
    const result = spawnSync(process.execPath, ['-e', script], {
        encoding: 'utf8',
        env: { ...process.env, TOOLS_MEDIA_DIR: mediaDir }
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, path.resolve(mediaDir));
    assert.equal(fs.statSync(mediaDir).isDirectory(), true);

    const electronSource = fs.readFileSync(path.join(__dirname, '../electron-main.js'), 'utf8');
    assert.match(electronSource, /if \(app\.isPackaged\) \{\s*process\.env\.TOOLS_MEDIA_DIR = path\.join\(userDataPath, 'media'\);/);
});
