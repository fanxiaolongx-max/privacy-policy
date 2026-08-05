const express = require('express');
const fs = require('fs');

const router = express.Router();

function getStatus() {
    if (process.env.TOOLS_DESKTOP_RUNTIME !== '1') return { enabled: false, valid: true };
    const file = process.env.TOOLS_DESKTOP_LICENSE_STATUS_PATH;
    try {
        const status = JSON.parse(fs.readFileSync(file, 'utf8'));
        const updatedAt = Date.parse(status.updatedAt) || Date.now();
        const trustedNow = Number(status.trustedNow) || updatedAt;
        const effectiveNow = trustedNow + Math.max(0, Date.now() - updatedAt);
        if (status.valid && effectiveNow >= Number(status.expiresAt)) {
            return { ...status, valid: false, reasonCode: 'EXPIRED', trustedNow: effectiveNow };
        }
        return { ...status, trustedNow: effectiveNow };
    } catch (_) {
        return { enabled: true, valid: false, reasonCode: 'LICENSE_REQUIRED', expiresAt: 0, trustedNow: Date.now() };
    }
}

router.get('/status', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(getStatus());
});

module.exports = { getStatus, router };
