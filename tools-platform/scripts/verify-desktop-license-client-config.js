const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'frontend', 'desktop-license-client-config.json');

if (!fs.existsSync(configPath)) {
    throw new Error('Desktop License 公钥配置缺失，已中止打包，避免发布无法授权的 EXE。');
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
if (config.version !== 1 || config.productId !== 'tools-platform-desktop') {
    throw new Error('Desktop License 公钥配置的版本或产品标识无效。');
}
const validationUrl = new URL(config.validationUrl);
if (validationUrl.protocol !== 'https:' || validationUrl.pathname !== '/api/public/desktop-license/validate') {
    throw new Error('Desktop License 验证地址必须是正确的 HTTPS 公开校验端点。');
}
const jwk = config.publicKeyJwk;
if (!jwk || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.x || !jwk.y || jwk.d) {
    throw new Error('Desktop License 验签公钥无效，或配置中意外包含私钥。');
}
crypto.createPublicKey({ key: jwk, format: 'jwk' });
console.log('[desktop-license] Client verification config is valid; no private key is present.');
