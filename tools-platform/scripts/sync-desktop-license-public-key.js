const fs = require('fs');
const path = require('path');
const authority = require('../backend/models/desktop-license-authority');
const registry = require('../backend/models/desktop-license-registry');

const root = path.join(__dirname, '..');
const target = path.join(root, 'frontend', 'desktop-license-client-config.json');
const config = {
    version: 1,
    productId: registry.PRODUCT_ID,
    validationUrl: process.env.DESKTOP_LICENSE_VALIDATION_URL
        || 'https://cs.fanxiaolong.uk/api/public/desktop-license/validate',
    publicKeyJwk: authority.getPublicKeyJwk(),
    offlineMode: 'signed-token-validity'
};

fs.writeFileSync(target, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
console.log(`[desktop-license] Public verification config written to ${target}`);
