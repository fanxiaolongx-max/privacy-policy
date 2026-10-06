const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const { EventEmitter } = require('node:events');

const projectRoot = path.resolve(__dirname, '../..');
const events = new EventEmitter();
const activeWrites = new Set();
const ASSET_NAMES = new Set(['logo.png', 'logo-raw.png', 'icon-mac.png', 'icon-windows.png', 'icon-windows.ico',
    'icon-windows-portable.png', 'icon-windows-portable.ico', 'portable-splash.bmp', 'icon.ico', 'icon.png']);

function logoStorage({ root = projectRoot, env = process.env } = {}) {
    const runtime = env.TOOLS_DESKTOP_RUNTIME === '1' || Boolean(env.TOOLS_BRANDING_DIR)
        || root.split(path.sep).some(part => part.endsWith('.asar'));
    const bundled = path.join(root, 'frontend/assets');
    const directory = runtime
        ? path.resolve(env.TOOLS_BRANDING_DIR || path.join(env.TOOLS_DATA_DIR || path.join(require('node:os').homedir(), '.tools-platform'), 'branding'))
        : bundled;
    return { root, bundled, directory, runtime };
}

function resolveLogoAsset(name, storage = logoStorage()) {
    if (!ASSET_NAMES.has(name)) return null;
    const override = path.join(storage.directory, name);
    return fs.existsSync(override) ? override : path.join(storage.bundled, name);
}

function createLogoAssetMiddleware(options = {}) {
    return (req, res, next) => {
        const name = req.path === '/favicon.ico' ? 'icon.ico' : /^\/assets\/([^/]+)$/.exec(req.path)?.[1];
        if (!ASSET_NAMES.has(name)) return next();
        const filename = resolveLogoAsset(name, logoStorage(options));
        if (!fs.existsSync(filename)) return next();
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(filename, error => { if (error) next(error); });
    };
}

function generateInWorker(source, options) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(path.join(__dirname, '../workers/platform-logo-worker.js'), {
            workerData: { source, options }, resourceLimits: { maxOldGenerationSizeMb: 256 }
        });
        let received = false;
        const timer = setTimeout(() => { worker.terminate(); reject(new Error('Logo processing timed out')); }, 90000);
        worker.once('message', message => {
            received = true;
            clearTimeout(timer);
            if (message.error) reject(new Error(message.error));
            else resolve(message.assets);
        });
        worker.once('error', error => { clearTimeout(timer); reject(error); });
        worker.once('exit', code => { clearTimeout(timer); if (!received || code !== 0) reject(new Error(`Logo worker exited: ${code}`)); });
    });
}

async function saveAssets(assets, storage) {
    const files = Object.entries(assets).map(([name, bytes]) => [path.join(storage.directory, name), Buffer.from(bytes)]);
    if (!storage.runtime) {
        for (const [relative, asset] of [
            ['desktop-pet/assets/icon.png', 'icon.png'], ['iosapp/icon.ico', 'icon.ico'],
            ['iosapp/iosApp/Assets.xcassets/AppIcon.appiconset/app-icon-1024.png', 'icon-mac.png']
        ]) {
            const target = path.join(storage.root, relative);
            if (fs.existsSync(path.dirname(target))) files.push([target, Buffer.from(assets[asset])]);
        }
    }
    const written = [];
    try {
        for (const [target, bytes] of files) {
            await fsp.mkdir(path.dirname(target), { recursive: true });
            const previous = fs.existsSync(target) ? await fsp.readFile(target) : null;
            const temporary = `${target}.${process.pid}.tmp`;
            try {
                await fsp.writeFile(temporary, bytes);
                await fsp.rename(temporary, target);
                written.push({ target, previous });
            } finally { await fsp.rm(temporary, { force: true }); }
        }
    } catch (error) {
        for (const { target, previous } of written.reverse()) {
            if (previous) await fsp.writeFile(target, previous);
            else await fsp.rm(target, { force: true });
        }
        throw error;
    }
    return files.map(([target]) => target);
}

async function generateAndSaveLogo(source, { storage = logoStorage(), removeBg = true, darkEnhance = true, cropBottomText = true } = {}) {
    if (activeWrites.has(storage.directory)) {
        const error = new Error('Logo processing is already running'); error.code = 'LOGO_BUSY'; throw error;
    }
    activeWrites.add(storage.directory);
    try {
        const splashTemplate = await fsp.readFile(path.join(projectRoot, 'frontend/assets/portable-splash.bmp'));
        const assets = await generateInWorker(source, { removeBg, darkEnhance, cropBottomText, splashTemplate });
        const files = await saveAssets(assets, storage);
        events.emit('change');
        return files;
    } finally { activeWrites.delete(storage.directory); }
}

module.exports = { ASSET_NAMES, logoStorage, resolveLogoAsset, createLogoAssetMiddleware, generateAndSaveLogo, events };
