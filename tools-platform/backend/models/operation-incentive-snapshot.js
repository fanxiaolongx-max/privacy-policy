const fs = require('fs');
const path = require('path');
const tools = require('./custom-tools-repository');
const { injectGatekeeper } = require('./snapshot-gatekeeper');
const { safeJson, collectMeetingData, collectIncentiveData, staticRuntimeSource } = require('./static-snapshot-data');

const TOOL_SLUG = 'tool-ms4xb66s';

async function loadSource() {
    let sourcePath = null;
    try {
        const candidate = await tools.getToolFilePath(TOOL_SLUG);
        if (candidate && fs.existsSync(candidate)) sourcePath = candidate;
    } catch (_) {}
    if (!sourcePath) {
        const builtin = path.join(__dirname, '../builtin-tools', TOOL_SLUG, 'index.html');
        if (fs.existsSync(builtin)) sourcePath = builtin;
    }
    if (!sourcePath) throw new Error('操作激励统计工具尚未安装');
    const html = fs.readFileSync(sourcePath, 'utf8');
    if (!html.includes("fetch('/api/operation-incentive-snapshots')")) throw new Error('操作激励统计模板与静态快照适配器不兼容');
    return html;
}

function injectRuntime(html, source, pages) {
    const csp = pages
        ? "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; font-src data:; object-src blob: data:; frame-src blob: data:; form-action 'none'; base-uri 'none'"
        : "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src data: blob:; img-src data: blob:; font-src data:; object-src blob: data:; frame-src blob: data:; form-action 'none'; base-uri 'none'";
    return html.replace(/<head([^>]*)>/i, `<head$1>\n<meta http-equiv="Content-Security-Policy" content="${csp}">\n<script>${source}</script>`);
}

async function collect() {
    const [meeting, incentive] = await Promise.all([collectMeetingData(), collectIncentiveData()]);
    return { meeting, incentive };
}

async function buildSnapshot(tenantId, options = {}) {
    let html = await loadSource();
    const data = await collect();
    const source = `const TP_STATIC_DATA=${safeJson(data)};\n${staticRuntimeSource('TP_STATIC_DATA', { incentive: true })}\nconst tpStaticOriginalFetch=window.fetch.bind(window);\nwindow.fetch=(url,options={})=>{const raw=String(url||'');if(raw.startsWith('data:')||raw.startsWith('blob:'))return tpStaticOriginalFetch(url,options);const response=tpStaticApiResponse(url,options);return Promise.resolve(response||tpStaticReadonlyResponse());};`;
    html = injectRuntime(html, source, false);
    const enc = options.encryption?.enabled && (options.encryption?.passwordHash || options.encryption?.hash) ? options.encryption : null;
    if (enc) html = injectGatekeeper(html, enc, TOOL_SLUG);
    return html;
}

async function buildPagesSnapshot(tenantId, options = {}) {
    let html = await loadSource();
    const data = await collect();
    const source = `let TP_STATIC_DATA=null;\n${staticRuntimeSource('TP_STATIC_DATA', { incentive: true })}\nconst tpStaticPagesFetch=window.fetch.bind(window);\nasync function tpStaticLoadData(){if(!TP_STATIC_DATA){const [meetingResponse,incentiveResponse]=await Promise.all([tpStaticPagesFetch('./data/meeting.json',{cache:'no-store'}),tpStaticPagesFetch('./data/incentive.json',{cache:'no-store'})]);if(!meetingResponse.ok||!incentiveResponse.ok)throw new Error('静态数据读取失败');TP_STATIC_DATA={meeting:await meetingResponse.json(),incentive:await incentiveResponse.json()};}return TP_STATIC_DATA;}\nwindow.fetch=async(url,options={})=>{const raw=String(url||'');if(raw.startsWith('./data/')||raw.startsWith('data:')||raw.startsWith('blob:'))return tpStaticPagesFetch(url,options);await tpStaticLoadData();return tpStaticApiResponse(url,options)||tpStaticReadonlyResponse();};`;
    html = injectRuntime(html, source, true);
    const enc = options.encryption?.enabled && (options.encryption?.passwordHash || options.encryption?.hash) ? options.encryption : null;
    if (enc) html = injectGatekeeper(html, enc, TOOL_SLUG);
    return { html, files: new Map([
        ['data/meeting.json', safeJson(data.meeting) + '\n'],
        ['data/incentive.json', safeJson(data.incentive) + '\n']
    ]) };
}

module.exports = { buildSnapshot, buildPagesSnapshot };
