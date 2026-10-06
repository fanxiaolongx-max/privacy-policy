const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const multer = require('multer');
const { requireAdmin } = require('../middleware/auth');
const { logoStorage, resolveLogoAsset, generateAndSaveLogo } = require('../models/platform-logo-runtime');

function createLogoRouter(options = {}) {
    const router = express.Router();
    const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 1 } });
    const storage = () => logoStorage(options);

    router.get('/status', (req, res) => {
        const current = storage();
        const size = name => {
            const filename = resolveLogoAsset(name, current);
            return fs.existsSync(filename) ? fs.statSync(filename).size : 0;
        };
        const logo = resolveLogoAsset('logo.png', current);
        const exists = fs.existsSync(logo);
        const updatedAt = exists ? fs.statSync(logo).mtimeMs : 0;
        res.setHeader('Cache-Control', 'no-store');
        res.json({ ok: true, hasLogo: exists, updatedAt, storageMode: current.runtime ? 'runtime' : 'source',
            logoUrl: `/assets/logo.png?t=${Math.floor(updatedAt)}`, logoRawUrl: `/assets/logo-raw.png?t=${Math.floor(updatedAt)}`,
            fileSizes: { logo: size('logo.png'), mac: size('icon-mac.png'), windows: size('icon-windows.png'), portable: size('icon-windows-portable.png') }
        });
    });

    router.post('/upload', requireAdmin, (req, res, next) => upload.single('logo')(req, res, error => {
        if (error) return res.status(400).json({ ok: false, code: 'LOGO_UPLOAD_INVALID', error: error.message, requestId: req.requestId });
        next();
    }), async (req, res) => {
        if (!req.file) return res.status(400).json({ ok: false, code: 'LOGO_REQUIRED', error: '请上传图片 / Please upload an image', requestId: req.requestId });
        try {
            const current = storage();
            const files = await generateAndSaveLogo(req.file.buffer, {
                storage: current,
                removeBg: req.body.removeBg !== 'false',
                darkEnhance: req.body.darkEnhance !== 'false',
                cropBottomText: req.body.cropBottomText !== 'false'
            });
            const updatedAt = Date.now();
            res.json({ ok: true, updatedAt, storageMode: current.runtime ? 'runtime' : 'source', assetCount: files.length,
                logoUrl: `/assets/logo.png?t=${updatedAt}`, output: files.map(file => path.basename(file)).join('\n') });
        } catch (error) {
            console.error('[platform-logo] Processing failed:', error.message);
            res.status(error.code === 'LOGO_BUSY' ? 409 : 400).json({ ok: false, code: error.code || 'LOGO_PROCESSING_FAILED',
                error: error.message, requestId: req.requestId });
        }
    });
    return router;
}

module.exports = createLogoRouter();
module.exports.createLogoRouter = createLogoRouter;
