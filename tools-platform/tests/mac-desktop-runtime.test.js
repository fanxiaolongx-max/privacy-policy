const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const acorn = require('acorn');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'electron-main.js'), 'utf8');
const ast = acorn.parse(source, { ecmaVersion: 'latest' });
const functionNames = new Set(['getAppIconPath', 'createTray', 'focusPendingAppWindow']);
const isolatedSource = ast.body.filter((node) => {
    if (node.type === 'FunctionDeclaration') return functionNames.has(node.id.name);
    const call = node.type === 'ExpressionStatement' && node.expression;
    return call && call.type === 'CallExpression'
        && call.callee.type === 'MemberExpression'
        && call.callee.object.name === 'app' && call.callee.property.name === 'on'
        && ['activate', 'second-instance'].includes(call.arguments[0].value);
}).map((node) => source.slice(node.start, node.end)).join('\n');

function createRuntime(platform = 'darwin', portable = false) {
    const events = new Map();
    const opened = [];
    const imageLoads = [];
    const trayClicks = new Map();
    const context = {
        path,
        __dirname: root,
        process: { platform },
        isPortableWindows: portable,
        localPort: null,
        licenseWindow: null,
        startupWindow: null,
        tray: null,
        console: { log() {}, warn() {} },
        app: { on(name, callback) { events.set(name, callback); } },
        openAppPath(target) { opened.push(target); },
        refreshTrayMenu() { context.tray.menuInstalled = true; },
        nativeImage: {
            createFromPath(file) {
                imageLoads.push(file);
                return { resize: (size) => ({ file, width: size.width, height: size.height }) };
            }
        },
        Tray: class {
            constructor(icon) { this.icon = icon; }
            setToolTip() {}
            on(name, callback) { trayClicks.set(name, callback); }
        }
    };
    vm.runInNewContext(isolatedSource, context);
    return { context, events, opened, imageLoads, trayClicks };
}

function windowDouble({ destroyed = false, minimized = false } = {}) {
    const calls = [];
    return {
        calls,
        isDestroyed: () => destroyed,
        isMinimized: () => minimized,
        restore() { calls.push('restore'); },
        show() { calls.push('show'); },
        focus() { calls.push('focus'); },
        setAlwaysOnTop() { calls.push('top'); },
        moveTop() { calls.push('move'); }
    };
}

test('macOS tray loads the usable PNG at menu-bar size without opening browser tabs on menu clicks', () => {
    const runtime = createRuntime();
    runtime.context.createTray();
    assert.deepEqual(runtime.imageLoads, [path.join(root, 'frontend/assets/icon-windows.png')]);
    assert.equal(runtime.context.tray.icon.width, 18);
    assert.equal(runtime.context.tray.icon.height, 18);
    assert.equal(runtime.context.tray.menuInstalled, true);
    assert.equal(runtime.trayClicks.size, 0);
    assert.deepEqual(runtime.opened, []);
});

for (const portable of [false, true]) {
    test(`Windows ${portable ? 'portable' : 'setup'} retains its ICO and click behavior`, () => {
        const runtime = createRuntime('win32', portable);
        runtime.context.createTray();
        assert.equal(runtime.context.tray.icon, path.join(root, 'frontend/assets', portable ? 'icon-windows-portable.ico' : 'icon-windows.ico'));
        assert.deepEqual(runtime.imageLoads, []);
        runtime.trayClicks.get('click')();
        runtime.trayClicks.get('double-click')();
        assert.deepEqual(runtime.opened, ['/', '/']);
    });
}

test('Dock activation restores the license window before opening the main application', () => {
    const runtime = createRuntime();
    const license = windowDouble({ minimized: true });
    const startup = windowDouble();
    runtime.context.licenseWindow = license;
    runtime.context.startupWindow = startup;
    runtime.events.get('activate')();
    assert.deepEqual(license.calls, ['restore', 'show', 'focus', 'top', 'move']);
    assert.deepEqual(startup.calls, []);
    assert.deepEqual(runtime.opened, []);
});

test('Dock activation restores startup when the license window is already destroyed', () => {
    const runtime = createRuntime();
    runtime.context.licenseWindow = windowDouble({ destroyed: true });
    const startup = windowDouble({ minimized: true });
    runtime.context.startupWindow = startup;
    runtime.events.get('activate')();
    assert.deepEqual(startup.calls, ['restore', 'show', 'focus']);
    assert.deepEqual(runtime.opened, []);
});

test('Dock activation before initialization is quiet and opens the browser after a port is assigned', () => {
    const runtime = createRuntime();
    runtime.events.get('activate')();
    assert.deepEqual(runtime.opened, []);
    runtime.context.localPort = 3030;
    runtime.events.get('activate')();
    assert.deepEqual(runtime.opened, ['/']);
});

test('a second Windows instance still focuses licensing and opens the browser when ready', () => {
    const runtime = createRuntime('win32');
    const license = windowDouble();
    runtime.context.licenseWindow = license;
    runtime.events.get('second-instance')();
    assert.deepEqual(license.calls, ['show', 'focus', 'top', 'move']);
    assert.deepEqual(runtime.opened, []);
    runtime.context.licenseWindow = null;
    runtime.events.get('second-instance')();
    assert.deepEqual(runtime.opened, ['/']);
});
