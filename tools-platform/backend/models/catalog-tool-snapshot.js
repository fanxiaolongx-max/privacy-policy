const { injectGatekeeper } = require('./snapshot-gatekeeper');
const { safeJson } = require('./static-snapshot-data');

const TOOLS = {
    'tool-mqp55fna': { title: '六个一信息收集', file: 'surveys.json' }
};

async function collect(slug) {
    if (slug === 'tool-mqp55fna') {
        const repo = require('./survey-repository');
        const [templates, submissions] = await Promise.all([repo.listTemplates(), repo.listAllSubmissions()]);
        return { templates, submissions };
    }
    throw new Error('该工具尚未接入静态页面发布');
}

function htmlFor(slug, data, pages, options = {}) {
    const tool = TOOLS[slug];
    if (!tool) throw new Error('该工具尚未接入静态页面发布');
    const csp = pages
        ? "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'"
        : "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; base-uri 'none'; form-action 'none'";
    const boot = pages
        ? `fetch('./data/${tool.file}',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('数据读取失败：HTTP '+r.status);return r.json()}).then(render).catch(e=>{document.getElementById('status').textContent=e.message})`
        : `render(${safeJson(data)})`;
    let html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>${tool.title} · 只读快照</title><style>
*{box-sizing:border-box}body{margin:0;background:#f4f7fb;color:#172b42;font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}main{max-width:1200px;margin:auto;padding:32px 20px 70px}header{background:#173b63;color:#fff;padding:28px;border-radius:18px}h1{font-size:25px;margin:0 0 6px}h2{font-size:18px;margin:26px 0 12px}p{margin:0}.sub{color:#c9dff4}.bar{display:flex;gap:10px;flex-wrap:wrap;margin:22px 0}.bar input,.bar select{font:inherit;padding:10px 12px;border:1px solid #b8c9da;border-radius:8px;background:#fff;min-width:220px}.card{background:#fff;border:1px solid #dce5ef;border-radius:12px;padding:18px;margin:10px 0;overflow:auto}.muted{color:#62758a}.tag{display:inline-block;background:#e9f2fa;border-radius:6px;padding:2px 7px;margin:2px 4px 2px 0;font-size:12px}table{width:100%;border-collapse:collapse;min-width:690px}th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #e8edf2;vertical-align:top;word-break:break-word}th{background:#f4f7fb;white-space:nowrap}details{max-width:600px}summary{cursor:pointer;color:#1768a7}dl{display:grid;grid-template-columns:minmax(110px,180px) 1fr;gap:6px 12px;margin:12px 0}dt{font-weight:650}dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}@media(max-width:600px){main{padding:12px}header{padding:20px}h1{font-size:21px}}
</style></head><body><main><header><h1>${tool.title}</h1><p class="sub">只读快照 · 数据以生成时刻为准；填写、修改、签发和打包请返回平台操作。</p></header><div id="status" class="muted" style="margin-top:16px">正在读取快照…</div><div id="app"></div></main><script>
const SLUG=${safeJson(slug)};
function el(name,text){const node=document.createElement(name);if(text!==undefined)node.textContent=String(text??'');return node}
function cell(row,value){row.appendChild(el('td',value));}
function valueText(value){return Array.isArray(value)?value.join('、'):value&&typeof value==='object'?JSON.stringify(value):String(value??'')}
function render(data){const app=document.getElementById('app');const status=document.getElementById('status');app.replaceChildren();status.textContent='';if(SLUG==='tool-mqp55fna')renderSurveys(data,app);else renderPresets(data,app)}
function renderSurveys(data,app){const templates=Array.isArray(data.templates)?data.templates:[],records=Array.isArray(data.submissions)?data.submissions:[];const title=el('h2','调查模板（'+templates.length+'）');app.appendChild(title);for(const item of templates){const card=el('section');card.className='card';card.appendChild(el('strong',item.name||item.id));card.appendChild(el('p',(item.fields||[]).map(f=>f.label).join(' · ')));app.appendChild(card)}const heading=el('h2','提交台账（'+records.length+'）');app.appendChild(heading);const bar=el('div');bar.className='bar';const filter=el('select');filter.appendChild(new Option('全部模板',''));for(const item of templates)filter.appendChild(new Option(item.name||item.id,item.id));const search=el('input');search.type='search';search.placeholder='搜索提交内容';bar.append(filter,search);app.appendChild(bar);const card=el('section');card.className='card';const table=el('table');const head=el('tr');for(const label of ['提交时间','模板','提交人','内容'])head.appendChild(el('th',label));table.appendChild(head);const body=el('tbody');table.appendChild(body);card.appendChild(table);app.appendChild(card);function draw(){body.replaceChildren();const q=search.value.trim().toLocaleLowerCase();let shown=0;for(const item of records){if(filter.value&&item.templateId!==filter.value)continue;if(q&&!JSON.stringify([item.templateName,item.submittedBy,item.answers]).toLocaleLowerCase().includes(q))continue;const tr=el('tr');cell(tr,item.createdAt||'');cell(tr,item.templateName||'');cell(tr,item.submittedBy||'');const td=el('td');const detail=el('details');detail.appendChild(el('summary','查看字段'));const dl=el('dl');const template=templates.find(t=>t.id===item.templateId);for(const [key,value] of Object.entries(item.answers||{})){dl.appendChild(el('dt',template?.fields?.find(f=>f.key===key)?.label||key));dl.appendChild(el('dd',valueText(value)))}detail.appendChild(dl);td.appendChild(detail);tr.appendChild(td);body.appendChild(tr);shown++}if(!shown){const tr=el('tr');const td=el('td','暂无匹配记录');td.colSpan=4;tr.appendChild(td);body.appendChild(tr)}}filter.addEventListener('change',draw);search.addEventListener('input',draw);draw()}
function renderPresets(data,app){const presets=Array.isArray(data.presets)?data.presets:[];app.appendChild(el('h2','服务器脚本预设（'+presets.length+'）'));const notice=el('p','快照只展示配置摘要。脚本源码、匹配网址、License Token 与签发记录均未发布。');notice.className='muted';app.appendChild(notice);const bar=el('div');bar.className='bar';const search=el('input');search.type='search';search.placeholder='搜索脚本名称或说明';bar.appendChild(search);app.appendChild(bar);const card=el('section');card.className='card';const table=el('table');const head=el('tr');for(const label of ['脚本名称','说明','运行方式','权限','更新时间'])head.appendChild(el('th',label));table.appendChild(head);const body=el('tbody');table.appendChild(body);card.appendChild(table);app.appendChild(card);function draw(){body.replaceChildren();const q=search.value.trim().toLocaleLowerCase();let shown=0;for(const item of presets){if(q&&!JSON.stringify([item.name,item.description]).toLocaleLowerCase().includes(q))continue;const tr=el('tr');cell(tr,item.name||'');cell(tr,item.description||'');cell(tr,[item.world,item.runAt,item.manualLaunch?'手动启动':'自动启动',item.allFrames?'所有 Frame':'主 Frame'].filter(Boolean).join(' · '));cell(tr,(item.optionalPermissions||[]).join('、')||'无');cell(tr,item.updatedAt||'');body.appendChild(tr);shown++}if(!shown){const tr=el('tr');const td=el('td','暂无匹配脚本');td.colSpan=5;tr.appendChild(td);body.appendChild(tr)}}search.addEventListener('input',draw);draw()}
${boot};
</script></body></html>`;
    const encryption = options.encryption;
    if (encryption?.enabled && (encryption.passwordHash || encryption.hash)) html = injectGatekeeper(html, encryption, slug);
    return html;
}

async function buildSnapshot(slug, tenantId, options = {}) {
    return htmlFor(slug, await collect(slug), false, options);
}

async function buildPagesSnapshot(slug, tenantId, options = {}) {
    const data = await collect(slug);
    const tool = TOOLS[slug];
    return { html: htmlFor(slug, null, true, options), files: new Map([[`data/${tool.file}`, safeJson(data) + '\n']]) };
}

module.exports = { buildSnapshot, buildPagesSnapshot, collect };
