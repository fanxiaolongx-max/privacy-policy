'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');

const source = fs.readFileSync(path.join(__dirname, '../desktop-pet/pet-keyboard-hook.js'), 'utf8');

function loadHook({ platform = 'darwin', permission = true, missingPermissionApi = false } = {}) {
    const nativeHook = new EventEmitter();
    let starts = 0;
    let stops = 0;
    const permissionPrompts = [];
    nativeHook.start = () => { starts++; };
    nativeHook.stop = () => { stops++; };
    const systemPreferences = missingPermissionApi ? {} : {
        isTrustedAccessibilityClient(prompt) {
            permissionPrompts.push(prompt);
            return typeof permission === 'function' ? permission(prompt) : permission;
        }
    };
    const context = {
        module: { exports: {} },
        process: { platform },
        Date,
        console: { log() {}, warn() {} },
        require(name) {
            if (name === 'electron') return { systemPreferences, shell: { openExternal() {} } };
            if (name === 'uiohook-napi') return { uIOhook: nativeHook };
            throw new Error(`Unexpected dependency: ${name}`);
        }
    };
    vm.runInNewContext(source, context);
    return {
        hook: context.module.exports,
        nativeHook,
        permissionPrompts,
        get starts() { return starts; },
        get stops() { return stops; }
    };
}

test('pet keyboard hook exports and permission detection', () => {
    const { hook: { startKeyboardHook, stopKeyboardHook, isKeyboardHookRunning, checkAccessibilityPermission } } = loadHook();
    assert.equal(typeof startKeyboardHook, 'function');
    assert.equal(typeof stopKeyboardHook, 'function');
    assert.equal(typeof isKeyboardHookRunning, 'function');
    assert.equal(typeof checkAccessibilityPermission, 'function');

    const perm = checkAccessibilityPermission(false);
    assert.equal(typeof perm, 'boolean');
});

test('pet keyboard hook start and stop lifecycle', () => {
    const runtime = loadHook();
    const { startKeyboardHook, stopKeyboardHook, isKeyboardHookRunning } = runtime.hook;
    let callCount = 0;
    const dummyCallback = () => { callCount++; };

    const started = startKeyboardHook(dummyCallback);
    assert.equal(started, true);
    assert.equal(isKeyboardHookRunning(), true);
    assert.equal(runtime.starts, 1);
    runtime.nativeHook.emit('keydown', { keycode: 30 });
    assert.equal(callCount, 1);

    stopKeyboardHook();
    assert.equal(isKeyboardHookRunning(), false);
    assert.equal(runtime.stops, 1);
    assert.equal(runtime.nativeHook.listenerCount('keydown'), 0);
});

test('macOS denial requests permission without starting or registering a native hook', () => {
    const runtime = loadHook({ permission: false });
    assert.equal(runtime.hook.startKeyboardHook(() => {}), false);
    assert.equal(runtime.hook.isKeyboardHookRunning(), false);
    assert.equal(runtime.starts, 0);
    assert.equal(runtime.nativeHook.listenerCount('keydown'), 0);
    assert.deepEqual(runtime.permissionPrompts, [false, true]);
});

test('macOS permission detection errors fail closed', () => {
    const runtime = loadHook({ permission() { throw new Error('Permission service unavailable'); } });
    assert.equal(runtime.hook.checkAccessibilityPermission(), false);
    assert.equal(runtime.hook.startKeyboardHook(() => {}), false);
    assert.equal(runtime.starts, 0);
});

test('macOS missing permission API does not start the native hook', () => {
    const runtime = loadHook({ missingPermissionApi: true });
    assert.equal(runtime.hook.checkAccessibilityPermission(), false);
    assert.equal(runtime.hook.startKeyboardHook(() => {}), false);
    assert.equal(runtime.starts, 0);
});

test('macOS can retry after the user explicitly grants permission', () => {
    let granted = false;
    const runtime = loadHook({ permission: () => granted });
    assert.equal(runtime.hook.startKeyboardHook(() => {}), false);
    assert.equal(runtime.starts, 0);
    granted = true;
    assert.equal(runtime.hook.startKeyboardHook(() => {}), true);
    assert.equal(runtime.hook.isKeyboardHookRunning(), true);
    assert.equal(runtime.starts, 1);
    runtime.hook.stopKeyboardHook();
});

test('Windows hook startup remains independent of macOS accessibility permissions', () => {
    const runtime = loadHook({ platform: 'win32', permission: false });
    assert.equal(runtime.hook.startKeyboardHook(() => {}), true);
    assert.equal(runtime.starts, 1);
    assert.deepEqual(runtime.permissionPrompts, []);
    runtime.hook.stopKeyboardHook();
});
