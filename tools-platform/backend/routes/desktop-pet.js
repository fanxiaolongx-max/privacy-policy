const express = require('express');
const language = require('../models/desktop-language');
const router = express.Router();

// A logged-in local user may change this machine's UI language, including viewers.
// Use the actual peer address, never forwarded headers, to exclude remote clients.
router.use((req, res, next) => {
    if (!req.user) return res.status(401).json({ code: 'AUTH_REQUIRED', error: 'Login required' });
    const peer = req.socket?.remoteAddress;
    if (process.env.TOOLS_DESKTOP_RUNTIME !== '1' ||
        !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer)) {
        return res.status(403).json({ code: 'DESKTOP_LOCAL_ONLY', error: 'Local desktop access required' });
    }
    if (req.headers.origin) {
        try {
            const origin = new URL(req.headers.origin);
            if (!['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) || origin.host !== req.headers.host) {
                return res.status(403).json({ code: 'DESKTOP_LOCAL_ONLY', error: 'Same-origin access required' });
            }
        } catch (_) {
            return res.status(403).json({ code: 'DESKTOP_LOCAL_ONLY', error: 'Invalid origin' });
        }
    }
    next();
});
router.post('/language', (req, res) => {
    if (!language.setLanguage(req.body?.language)) {
        return res.status(400).json({ code: 'INVALID_LANGUAGE', error: 'Unsupported language' });
    }
    res.json({ success: true, language: language.getLanguage() });
});
module.exports = router;
