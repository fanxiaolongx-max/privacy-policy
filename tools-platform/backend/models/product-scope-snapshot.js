'use strict';
const fs = require('fs');
const path = require('path');
const { runWithTenant } = require('./tenant-context');
const { loadProducts } = require('./product-scope-repository');
const { safeJson } = require('./static-snapshot-data');
const { injectGatekeeper } = require('./snapshot-gatekeeper');
const { injectLanguageRuntime } = require('./custom-tool-i18n-service');
const SLUG = 'tool-mumxi3px';

function render(data, pages, options) {
    const source = fs.readFileSync(path.join(__dirname, '../builtin-tools', SLUG, 'index.html'), 'utf8')
        .replace(/<!-- PRODUCT_DATA_MANAGEMENT_START -->[\s\S]*?<!-- PRODUCT_DATA_MANAGEMENT_END -->/, '')
        .replace(/\/\/ PRODUCT_DATA_MANAGEMENT_SCRIPT_START[\s\S]*?\/\/ PRODUCT_DATA_MANAGEMENT_SCRIPT_END/, '');
    const payload = data.updatedAt
        ? pages ? "window.__PRODUCT_SCOPE_DATA_URL__='./data/products.json';" : `window.__PRODUCT_SCOPE_DATA__=${safeJson(data.products)};`
        : '';
    const bootstrap = `<script>window.__PRODUCT_SCOPE_SNAPSHOT__=true;${payload}</script>`;
    let html = source.replace('</head>', `${bootstrap}\n</head>`);
    html = injectLanguageRuntime(html, SLUG, { inlineRuntime: true, standalone: true });
    if (options.encryption?.enabled && (options.encryption.passwordHash || options.encryption.hash)) {
        html = injectGatekeeper(html, options.encryption, SLUG);
    }
    return html;
}
async function buildSnapshot(tenantId, options = {}) {
    return runWithTenant(tenantId, async () => render(await loadProducts(), false, options));
}
async function buildPagesSnapshot(tenantId, options = {}) {
    return runWithTenant(tenantId, async () => {
        const data = await loadProducts();
        return { html: render(data, true, options), files: new Map(data.updatedAt ? [['data/products.json', safeJson(data.products) + '\n']] : []) };
    });
}
module.exports = { buildSnapshot, buildPagesSnapshot };
