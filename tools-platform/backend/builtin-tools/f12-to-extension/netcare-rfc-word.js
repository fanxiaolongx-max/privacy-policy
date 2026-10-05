/*
 * TP_NETCARE_RFC_WORD_V1 — automatically injected MV3 content script.
 * MAIN world + all_frames required; popup starts the panel, export frames auto-connect.
 * No credentials are exported or persisted. Uses the site's original download
 * action for every RFC so its authorization/compliance checks remain in place.
 */
function parseNetcareRfcOrders(value) {
  const orders = [...new Set(value.trim().toUpperCase().split(/[\s,，;；、]+/).filter(Boolean))];
  if (!orders.length) throw new Error('请输入 RFC 单号 / Enter RFC numbers');
  const invalid = orders.filter(order => !/^NC\d{14}$/.test(order));
  if (invalid.length) throw new Error(`单号格式应为 NC + 14 位数字：${invalid.join(', ')}`);
  if (orders.length > 50) throw new Error('每批最多 50 个 RFC / Maximum 50 RFCs per batch');
  return orders;
}

// Search/authorization uses shared site UI sequentially; independent exports overlap.
async function executeNetcareRfcBatch(orders, concurrency, signal, prepare, transfer, onResult) {
  const running = new Set(), results = new Array(orders.length);
  const record = (index, result) => { results[index] = result; onResult(orders[index], result); };
  const limit = Math.max(1, Math.min(3, Number(concurrency) || 1));
  for (let index = 0; index < orders.length; index++) {
    if (running.size >= limit) await Promise.race(running);
    if (signal.aborted) { record(index, { ok: false, error: '已停止等待' }); continue; }
    try {
      const prepared = await prepare(orders[index], signal);
      if (signal.aborted) throw new Error('已停止等待');
      const task = Promise.resolve().then(() => transfer(orders[index], prepared, signal))
        .then(value => record(index, { ok: true, value }), error => record(index, { ok: false, error: error.message }))
        .finally(() => running.delete(task));
      running.add(task);
    } catch (error) { record(index, { ok: false, error: error.message }); }
  }
  await Promise.all(running);
  return results;
}

// Binary transfer uses bounded chunks; no credentials or server download URLs enter the cache.
function netcareArtifactRequest(message){
  return new Promise((resolve,reject)=>{const requestId=crypto.randomUUID(),timer=setTimeout(()=>finish(reject,Error('审计材料传输超时')),30000);
    const finish=(fn,value)=>{clearTimeout(timer);window.removeEventListener('message',receive);fn(value);};
    const receive=event=>{if(event.source===window&&event.origin===location.origin&&event.data?.source==='TP_RFC_ARTIFACT_RESULT'&&event.data.requestId===requestId)event.data.ok?finish(resolve,event.data.data):finish(reject,Error(event.data.error||'材料缓存失败'));};
    window.addEventListener('message',receive);window.postMessage({source:'TP_RFC_ARTIFACT_REQUEST',requestId,...message},location.origin);
  });
}
async function netcareStoreArtifact(order,name,blob,signal){
  const fileId=crypto.randomUUID(),chunk=384*1024;await netcareArtifactRequest({action:'begin',order,fileId,name,size:blob.size});
  for(let start=0,index=0;start<blob.size;start+=chunk,index++){if(signal?.aborted)throw Error('已停止 / Stopped');const bytes=new Uint8Array(await blob.slice(start,start+chunk).arrayBuffer());let raw='';for(let n=0;n<bytes.length;n+=8192)raw+=String.fromCharCode(...bytes.subarray(n,n+8192));await netcareArtifactRequest({action:'part',order,fileId,index,data:btoa(raw)});}
  await netcareArtifactRequest({action:'finish',order,fileId});
}
// Standard ZIP (stored entries), UTF-8 names and CRC32; no remote dependencies.
async function createNetcareZip(entries) {
  const encoder = new TextEncoder(), chunks = [], central = [];
  let offset = 0;
  const crc = bytes => {
    let value = 0xffffffff;
    for (const byte of bytes) { value ^= byte; for (let n = 0; n < 8; n++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0); }
    return (value ^ 0xffffffff) >>> 0;
  };
  for (const entry of entries) {
    const name = encoder.encode(entry.name), bytes = new Uint8Array(await entry.blob.arrayBuffer());
    if (bytes.length > 100 * 1024 * 1024 || offset + bytes.length > 500 * 1024 * 1024) throw new Error('附件超过打包容量限制（单文件100MB，总计500MB）');
    const checksum = crc(bytes), local = new Uint8Array(30 + name.length), d = new DataView(local.buffer);
    d.setUint32(0, 0x04034b50, true); d.setUint16(4, 20, true); d.setUint16(6, 0x800, true);
    d.setUint16(12, 33, true); d.setUint32(14, checksum, true); d.setUint32(18, bytes.length, true); d.setUint32(22, bytes.length, true);
    d.setUint16(26, name.length, true); local.set(name, 30);
    const record = new Uint8Array(46 + name.length), r = new DataView(record.buffer);
    r.setUint32(0, 0x02014b50, true); r.setUint16(4, 20, true); r.setUint16(6, 20, true); r.setUint16(8, 0x800, true);
    r.setUint16(14, 33, true); r.setUint32(16, checksum, true); r.setUint32(20, bytes.length, true); r.setUint32(24, bytes.length, true);
    r.setUint16(28, name.length, true); r.setUint32(42, offset, true); record.set(name, 46);
    chunks.push(local, bytes); central.push(record); offset += local.length + bytes.length;
  }
  const size = central.reduce((total, part) => total + part.length, 0), end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, entries.length, true); e.setUint16(10, entries.length, true);
  e.setUint32(12, size, true); e.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, end], { type: 'application/zip' });
}
function netcareAuditRows(records){
  const rows=[];for(const record of [...records].reverse())for(const report of [...(record.reports||[])].sort((a,b)=>String(a.section).localeCompare(String(b.section),undefined,{numeric:true}))){const item=(record.items||[]).find(i=>i.section===report.section&&i.kind===report.kind&&i.filename===report.filename);rows.push({...report,order:record.order,wordFilename:record.wordFilename||'',text:item?.text||item?.error||'未提取到可展示文本 / No text available'});}return rows;
}
async function netcareAuditExcel(records){
  const rows=netcareAuditRows(records),escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,''),labels={pass:'通过 / Pass',fail:'不通过 / Fail',needs_review:'需人工核查 / Review'};
  const values=[['RFC / 方案','章节 / Section','审计点与内容 / Evidence','结论 / Result','原因 / Reason'],...rows.map(r=>[r.order+(r.wordFilename?'\n'+r.wordFilename:''),`${r.section||''} ${r.sectionTitle||''}`,`${r.kind==='text'?'章节文本':'附件'}: ${r.filename||''}\n审计点: ${r.rule||''}\n\n${r.text}`,labels[r.status]||labels.needs_review,[r.summary,...(r.findings||[]),r.diagnostics?'错误详情: '+JSON.stringify(r.diagnostics):''].filter(Boolean).join('\n')])];
  const merges=[];for(let i=0;i<rows.length;){let end=i+1;while(end<rows.length&&rows[end].order===rows[i].order)end++;if(end-i>1)merges.push(`A${i+2}:A${end+1}`);for(let j=i;j<end;){let next=j+1;while(next<end&&rows[next].section===rows[j].section)next++;if(next-j>1)merges.push(`B${j+2}:B${next+1}`);j=next;}i=end;}
  const sheetRows=values.map((cells,i)=>`<row r="${i+1}" ht="${i?100:28}" customHeight="1">${cells.map((v,j)=>`<c r="${'ABCDE'[j]}${i+1}" t="inlineStr" s="${i?1:2}"><is><t xml:space="preserve">${escape(String(v).slice(0,32700)+(String(v).length>32700?'\n[单元格内容截断，完整内容见材料ZIP]':''))}</t></is></c>`).join('')}</row>`).join('');
  const files={'[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
  '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="审计结果" sheetId="1" r:id="rId1"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
  'xl/styles.xml':'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF243149"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFDCE3ED"/></left><right style="thin"><color rgb="FFDCE3ED"/></right><top style="thin"><color rgb="FFDCE3ED"/></top><bottom style="thin"><color rgb="FFDCE3ED"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
  'xl/worksheets/sheet1.xml':`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${[28,30,65,20,60].map((width,i)=>`<col min="${i+1}" max="${i+1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${sheetRows}</sheetData>${merges.length?`<mergeCells count="${merges.length}">${merges.map(ref=>`<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`:''}</worksheet>`};
  return createNetcareZip(Object.entries(files).map(([name,text])=>({name,blob:new Blob(['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+text])})));
}
async function netcareAuditMaterials(records,files,readFile,progress=()=>{}){
  const entries=[],missing=[],reconstructed=[];
  for(const record of records){const names=new Set(record.reports.map(r=>r.filename)),wanted=files.filter(f=>f.order===record.order&&(f.name===record.wordFilename||!record.wordFilename&&f.name.startsWith(record.order+'_')&&f.name.endsWith('.docx')||names.has(f.name))),added=new Set();
    if(!wanted.some(f=>f.name.endsWith('.docx')))missing.push(record.order+' · 方案 Word');
    for(const report of record.reports){if(!wanted.some(f=>f.name===report.filename)&&!added.has(report.filename)){added.add(report.filename);const item=record.items.find(i=>i.section===report.section&&i.kind===report.kind&&i.filename===report.filename);if(item?.kind==='text'&&item.text){entries.push({name:record.order+'/'+netcareSafeFilename(item.filename),blob:new Blob(['\ufeff'+item.text],{type:'text/plain;charset=utf-8'})});reconstructed.push(record.order+' · '+item.filename);}else missing.push(record.order+' · '+report.filename);}}
    for(const file of wanted){progress(file);entries.push({name:record.order+'/'+netcareSafeFilename(file.name),blob:await readFile(file)});}
    entries.push({name:record.order+'/AI审计结果.json',blob:new Blob([JSON.stringify(record,null,2)],{type:'application/json'})});
  }
  if(missing.length)entries.push({name:'缺失材料清单.txt',blob:new Blob(['\ufeff'+missing.join('\n')+'\n旧记录、原方案缺少附件或过期缓存可能缺少原文件，请重新下载并审计相应RFC。'],{type:'text/plain;charset=utf-8'})});
  if(reconstructed.length)entries.push({name:'文本回填说明.txt',blob:new Blob(['\ufeff以下章节TXT由已脱敏的审计证据回填，原始TXT未缓存：\n'+reconstructed.join('\n')],{type:'text/plain;charset=utf-8'})});
  entries.push({name:'审计结果.xlsx',blob:await netcareAuditExcel(records)});return {entries,missing,reconstructed};
}
function netcareSafeFilename(value) {
  return String(value).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/[. ]+$/, '').slice(0, 200) || 'unnamed';
}
function netcareUniqueFilename(name, used) {
  let candidate = name, n = 2;
  while (used.has(candidate.toLowerCase())) {
    const dot = name.lastIndexOf('.');
    candidate = dot > 0 ? `${name.slice(0, dot)} (${n++})${name.slice(dot)}` : `${name} (${n++})`;
  }
  used.add(candidate.toLowerCase()); return candidate;
}
function netcareTopicCatalogue(groups) {
  const seen = new Set();
  return groups.flat().filter(item => typeof item === 'string').map(query => {
    const p = new URLSearchParams(query);
    return { query, number: p.get('catalognumber'), title: (() => { const raw = query.split('&title=')[1] || ''; try { return decodeURIComponent(raw.replace(/\+/g, ' ')); } catch { return raw; } })(), topic: p.get('number') };
  }).filter(item => /^\d+(\.\d+)*$/.test(item.number || '') && item.topic && !seen.has(item.number) && seen.add(item.number));
}
function netcareDefaultSettings() {
  const template = [["1", "Description of Change and Change Influence"], ["1.1", "Change Purpose"], ["1.2", "Basic Information and Change Plan"], ["1.2.1", "Network Topology"], ["1.2.2", "Change Batches"], ["1.2.3", "Peripherals"], ["1.3", "Change Influence"], ["1.4", "Severity Information"], ["2", "Preparations for Change"], ["2.1", "Composition of Change Team and Responsibility of Team Members"], ["2.1.1", "Change Team of Orange Company"], ["2.1.2", "Huawei On-site Change Team"], ["2.1.3", "Huawei Support & Guarantee Team"], ["2.2", "Remote Access"], ["2.3", "Tool and Software Preparation"], ["2.4", "Check of Equipment Running"], ["2.5", "Change Risks and Countermeasures"], ["2.6", "Confirm Work Before Change"], ["3", "Operation Steps for Change"], ["3.1", "Overall Description of Change Steps"], ["3.2", "Preparation for Change Implementation"], ["3.3", "Operation Steps for Change"], ["3.3.1", "Operation Scripts"], ["3.4", "Test and Verification"], ["3.5", "Solution for Changeback In the Case of Failure"], ["3.5.1", "Definition of Change Failure"], ["3.5.2", "Overall Description of Changeback"], ["3.5.3", "Changeback Steps"], ["3.5.4", "Tests After Changeback"], ["3.5.5", "Changeback Risk Analysis"], ["3.6", "Change of Spare Parts and Emergency Workstation"], ["4", "Work After Change"], ["4.1", "Observation"], ["4.2", "Other work"]];
  return { aiAuditEnabled: false, concurrency: 3, openOnline: true, attachmentsEnabled: false, textEnabled: false, intervalMs: 1500,
    sections: template.map(([number, title]) => ({ number, title, attachments: number === '3.2', text: ['1.1', '3.2'].includes(number), attachmentsPrompt: '', textPrompt: '' })) };
}
function netcareNormalizeSettings(value) {
  if (!value || !Array.isArray(value.sections) || value.sections.length > 100) throw new Error('章节模板最多 100 项 / Maximum 100 sections');
  if (value.concurrency != null && (!Number.isInteger(value.concurrency) || value.concurrency < 1 || value.concurrency > 3) || value.openOnline != null && typeof value.openOnline !== 'boolean' || value.screenshotsEnabled != null && typeof value.screenshotsEnabled !== 'boolean') throw new Error('下载全局设置无效 / Invalid preferences');
  const seen = new Set();
  const sections = value.sections.map(row => {
    const number = String(row.number || '').trim(), title = String(row.title || '').trim();
    if (!/^\d+(\.\d+)*$/.test(number) || number.length > 40 || !title || title.length > 200 || seen.has(number)) throw new Error('章节序号须为数字点号且不能重复，名称不能为空 / Invalid or duplicate section');
    const attachmentsPrompt = netcareRedactText(String(row.attachmentsPrompt || '').trim()), textPrompt = netcareRedactText(String(row.textPrompt || '').trim());
    if (attachmentsPrompt.length > 4000 || textPrompt.length > 4000) throw new Error('单条提示词最多4000字符');
    seen.add(number); return { number, title, attachments: row.attachments === true || !!attachmentsPrompt, text: row.text === true || !!textPrompt, attachmentsPrompt, textPrompt };
  });
  if (value.attachmentsEnabled === true && !sections.some(row => row.attachments) || value.textEnabled === true && !sections.some(row => row.text)) throw new Error('请为已开启的提取类型选择至少一个章节 / Select a section');
  if (value.aiAuditEnabled === true && !sections.some(row => row.textPrompt || row.attachmentsPrompt)) throw new Error('开启AI审计需要至少一条章节提示词 / Add an audit rule');
  return { aiAuditEnabled: value.aiAuditEnabled === true, concurrency: Number.isInteger(value.concurrency) && value.concurrency >= 1 && value.concurrency <= 3 ? value.concurrency : 3, openOnline: value.openOnline !== false, screenshotsEnabled:value.screenshotsEnabled!==false,
    attachmentsEnabled: value.attachmentsEnabled === true || value.aiAuditEnabled === true && sections.some(row => row.attachmentsPrompt), textEnabled: value.textEnabled === true || value.aiAuditEnabled === true && sections.some(row => row.textPrompt),
    intervalMs: Math.max(1000, Math.min(30000, Number(value.intervalMs) || 1500)), sections };
}
function netcareExportSettings(settings) {
  return JSON.stringify({ format: 'netcare-rfc-settings', version: 1, settings: netcareNormalizeSettings(settings) }, null, 2);
}
function netcareImportSettings(text) {
  if (text.length > 2097152) throw new Error('配置文件超过2MB / File too large');
  const data = JSON.parse(text);
  if (data?.format !== 'netcare-rfc-settings' || data.version !== 1) throw new Error('不支持的配置格式或版本 / Unsupported configuration');
  return netcareNormalizeSettings(data.settings);
}
function netcareSectionMatches(settings, number, kind) {
  return settings.sections.some(row => row.number === number && row[kind]);
}

function netcareRedactText(value) {
  return String(value).replace(/(["']?(?:password|passwd|token|api[_ -]?key|secret|authorization|cookie)["']?\s*[:=]\s*)("[^"\n]*"|'[^'\n]*'|[^\s,&;]+)/gi,'$1[REDACTED]')
    .replace(/Bearer\s+[^\s]+/gi,'Bearer [REDACTED]')
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g,'[REDACTED PRIVATE KEY]');
}
// Temporary audit evidence only; keys never enter site storage. Bounded to 2MB/5 RFCs/24h.
function netcareCacheAudit(storage, order, items, reports) {
  const key = 'tpNetcareAuditCacheV1', now = Date.now(); let records = [];
  try { records = JSON.parse(storage.getItem(key) || '[]'); } catch {}
  if (!Array.isArray(records)) records = [];
  records = records.filter(r => r && r.order !== order && Number.isFinite(r.created) && now-r.created < 86400000);
  items = items.map(item=>({...item,text:item.text==null?undefined:netcareRedactText(item.text)}));
  records.push({ order, created: now, items, reports }); records = records.slice(-5);
  const encoder = new TextEncoder();
  while (records.length > 1 && encoder.encode(JSON.stringify(records)).length > 2097152) records.shift();
  const value = JSON.stringify(records); if (encoder.encode(value).length > 2097152) throw new Error('审计暂存超过2MB限制');
  storage.setItem(key,value);
}
async function netcareRunAudits(items, settings, request, signal, progress) {
  const reports=[];
  if(!settings.aiAuditEnabled)return reports;
  for (const item of items) {
    if (signal.aborted) throw new Error('已停止 / Stopped');
    const row=settings.sections.find(r=>r.number===item.section), rule=row?.[item.kind+'Prompt'];
    if (!rule) continue;
    const result={section:item.section,kind:item.kind,filename:item.filename,sectionTitle:row.title,rule:netcareRedactText(rule),status:'needs_review'};
    if (item.error) {result.summary=item.error;reports.push(result);continue;}
    if (!item.text?.trim() || item.text.length>60000) {result.summary='文本为空或超过60000字符，未提交模型';reports.push(result);continue;}
    progress(`${item.section} · ${item.filename}`);
    try {const reply=await request(item,signal);if(!reply?.ok){result.diagnostics=reply?.diagnostics;throw new Error(reply?.error||'AI request failed');} Object.assign(result,reply.report,{model:reply.model});}
    catch(error){if(signal.aborted)throw error;result.summary=error.message;result.error=true;}
    reports.push(result);
  }
  return reports;
}
async function netcareCaptureEvidence(element,renderer,signal){
  if(!element||!element.isConnected)throw Error('未定位到在线方案原始区域 / Original region not found');
  if(typeof renderer!=='function')throw Error('截图组件未加载，请更新扩展并重新打开方案 / Renderer missing');
  if(signal.aborted)throw Error('已停止 / Stopped');
  const bounds=element.getBoundingClientRect(),width=Math.ceil(Math.max(bounds.width,element.scrollWidth)),height=Math.ceil(Math.max(bounds.height,element.scrollHeight));
  if(!width||!height||width>6000||height>30000||width*height>24000000)throw Error('区域过大或不可见，截图未保存 / Region exceeds capture limit');
  const canvas=await renderer(element,{scale:1,backgroundColor:'#ffffff',logging:false,useCORS:false,allowTaint:false,imageTimeout:10000,width,height});
  const images=[];for(let y=0;y<canvas.height;y+=1600){if(signal.aborted)throw Error('已停止 / Stopped');const page=element.ownerDocument.createElement('canvas');page.width=canvas.width;page.height=Math.min(1600,canvas.height-y);page.getContext('2d').drawImage(canvas,0,y,page.width,page.height,0,0,page.width,page.height);const blob=await new Promise(resolve=>page.toBlob(resolve,'image/png'));if(!blob)throw Error('PNG编码失败');images.push(blob);page.width=page.height=0;}canvas.width=canvas.height=0;return images;
}
function mountNetcareCollector() {
  const order = new URL(location.href).searchParams.get('docId');
  if (!/^NC\d{14}$/.test(order)) return;
  window.__netcareCollectorCleanup?.();
  try {const cached=JSON.parse(localStorage.getItem('tpNetcareAuditCacheV1')||'[]');if(Array.isArray(cached))localStorage.setItem('tpNetcareAuditCacheV1',JSON.stringify(cached.filter(r=>r&&Date.now()-r.created<86400000)));}catch{}
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;right:20px;bottom:20px;width:min(540px,calc(100vw - 32px));z-index:2147483647';
  host.id = 'netcare-solution-collector';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>*{box-sizing:border-box}section{font:11px/1.6 system-ui;background:#fff;color:#243149;padding:20px;border:1px solid #dce3ed;border-radius:16px;box-shadow:0 20px 60px #0003;max-height:calc(100vh - 40px);overflow:auto}header{display:flex;align-items:center;justify-content:space-between;font-size:14px;font-weight:650;margin-bottom:16px}header button{font-size:18px;padding:2px 10px;background:transparent!important;color:inherit!important}button,input{font:inherit}button{padding:9px 14px;border:1px solid #cdd8e7;border-radius:7px;background:#f2f6fb;color:#243149;cursor:pointer;margin:10px 5px 12px 0}#zip{background:#176ae6;color:#fff;border-color:#176ae6}button:disabled{opacity:.45;cursor:default}input[type=text]{width:100%;padding:9px 10px;background:transparent;color:inherit;border:1px solid #cdd8e7;border-radius:7px;margin:6px 0 2px}.list{max-height:180px;overflow:auto;border:1px solid #dce3ed;border-radius:8px;padding:10px;margin:8px 0;background:#f7f9fc}.list>div,.list>label{padding:4px 0;border-bottom:1px solid #cdd8e733}label{display:block}input[type=checkbox]{vertical-align:middle;margin-right:7px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:11px/1.6 system-ui;max-height:145px;overflow:auto;background:#f2f6fb;border-radius:8px;padding:12px;margin:12px 0}details{margin-top:10px}summary{cursor:pointer;font-weight:550}small{display:block;color:#7b8a9f;margin-top:14px;font-size:10px}@media(prefers-color-scheme:dark){section{background:#182235;color:#e3eaf5;border-color:#314058}button,input[type=text],.list{background:#202d42;color:#e3eaf5;border-color:#314058}pre{background:#111c2d}}
</style><section><header><span>方案附件与章节 / Solution bundle</span><button id="close" aria-label="关闭采集浮窗">×</button></header><div>${order}</div><label>方案文件名 / Word filename<input id="filename" type="text" aria-label="方案文件名" placeholder="等待 Word 下载文件名，或手动填写"></label><button id="scan">扫描全部章节 / Scan</button><button id="zip" disabled>下载 ZIP / Download</button><button id="stop" disabled>停止 / Stop</button><details open><summary id="count">附件 / Attachments</summary><div id="files" class="list">尚未扫描 / Not scanned</div></details><details><summary>选择提取章节 / Select sections</summary><label><input id="all" type="checkbox">全部章节 / All sections</label><div id="chapters" class="list"></div></details><pre id="status" role="status">正在等待在线方案加载…</pre><details><summary>AI 审计 / Audit</summary><pre id="auditStatus">未开启 / Disabled</pre></details><small>按原生目录读取全部章节。ZIP 文件名与 Word 一致；扫描/下载错误会列入清单，不提交评审。 / Reads all native sections; errors are listed.</small></section>`;
  document.body.append(host);
  const $ = id => root.getElementById(id);
  let controller, topics = [], attachments = [], dirtyName = false, cleanScan = false;
  const selected = new Set(), blobs = new Map(), slots = new Map(), aiRequests = new Map();
  const collectorLanguage=globalThis.createNetcareLanguage?.(root,'zh');
  let generationAt=Date.now();let settings = netcareDefaultSettings(), settingsReady = false, scanFinished = false, autoAttempted = false;
  const maybeAuto = () => {
    if (settingsReady && scanFinished && !controller && !autoAttempted && (settings.attachmentsEnabled || settings.textEnabled) && $('filename').value.trim()) {
      autoAttempted = true; download(true);
    }
  };
  const status = text => { $('status').textContent = text; };
  const receive = event => {
    if (event.source === window && event.origin === location.origin && event.data?.source === 'EXTENSION_POPUP' && event.data.action === 'STOP') { cleanup(); return; }
    if (event.source !== window || event.origin !== location.origin || event.data?.source !== 'TP_RFC_COLLECTOR_NAME' || event.data.order !== order) return;
    if (event.data.loaded === true) {
      if(!settingsReady&&Number.isFinite(event.data.generationAt))generationAt=event.data.generationAt;
      collectorLanguage?.set(event.data.language||'zh');
      try { settings = netcareNormalizeSettings(event.data.settings || netcareDefaultSettings()); settingsReady = true; } catch { status('提取设置无效，请回主浮窗重新保存'); return; }
      if (!scanFinished) { selected.clear(); if (settings.textEnabled) settings.sections.filter(row => row.text).forEach(row => selected.add(row.number)); }
    }
    if (!dirtyName && typeof event.data.filename === 'string' && event.data.filename.endsWith('.docx')) $('filename').value = event.data.filename;
    maybeAuto();
  };
  window.addEventListener('message', receive);
  const getName = () => window.postMessage({ source: 'TP_RFC_COLLECTOR_GET_NAME', order }, location.origin);
  const nameTimer = setInterval(getName, 2500); getName();
  $('filename').oninput = () => { dirtyName = true; };
  const receiveSlot = event => {
    if(event.source===window&&event.origin===location.origin&&event.data?.source==='TP_RFC_AUDIT_PUBLISHED'&&event.data.order===order&&(!event.data.ok||event.data.snapshotError)){$('auditStatus').textContent+='\n主页面汇总失败：'+event.data.error;return;}
    if(event.source===window && event.origin===location.origin && event.data?.source==='TP_RFC_AI_RESULT') { aiRequests.get(event.data.id)?.resolve(event.data); return; }
    if (event.source !== window || event.origin !== location.origin || event.data?.source !== 'TP_RFC_READ_SLOT_RESULT') return;
    const slot = slots.get(event.data.id); if (slot) event.data.ok ? slot.resolve() : slot.reject(new Error(event.data.error || '请求节流连接失败'));
  };
  window.addEventListener('message', receiveSlot);
  const throttle = signal => new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const finish = (fn, value) => { clearTimeout(timer); slots.delete(id); signal.removeEventListener('abort', abort); fn(value); };
    const abort = () => finish(reject, new Error('已停止 / Stopped'));
    const timer = setTimeout(() => finish(reject, new Error('请求节流连接超时，请重新启动扩展')), 120000);
    slots.set(id, { resolve: () => finish(resolve), reject: error => finish(reject, error) });
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    else window.postMessage({ source: 'TP_RFC_READ_SLOT', id, order, intervalMs: settings.intervalMs }, location.origin);
  });
  const requestAudit = (item, signal) => new Promise((resolve, reject) => {
    const id=crypto.randomUUID();
    const finish=(fn,value)=>{clearTimeout(timer);aiRequests.delete(id);signal.removeEventListener('abort',abort);fn(value);};
    const abort=()=>{window.postMessage({source:'TP_RFC_AI_CANCEL',id,order},location.origin);finish(reject,new Error('已停止 / Stopped'));};
    const timer=setTimeout(()=>finish(reject,new Error('AI审计请求超时 / Timed out')),70000);
    aiRequests.set(id,{resolve:reply=>finish(resolve,reply)});signal.addEventListener('abort',abort,{once:true});
    if(signal.aborted)return abort(); window.postMessage({source:'TP_RFC_AI_AUDIT',id,order,section:item.section,kind:item.kind,filename:item.filename,text:netcareRedactText(item.text)},location.origin);
  });
  const editor = () => {
    try { const w = document.getElementById('appFrame')?.contentWindow;
      if (w?.editorApp?.Adapter && w.navigationTree?.FirstLevelTopics?.length) return w;
    } catch {} return null;
  };
  const loadTopic = (w, topic, signal) => new Promise((resolve, reject) => {
    const abort = () => finish(reject, new Error('已停止 / Stopped'));
    const timer = setTimeout(() => finish(reject, new Error(`章节 ${topic.number} 读取超时`)), 45000);
    const finish = (fn, value) => { clearTimeout(timer); signal.removeEventListener('abort', abort); fn(value); };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) return abort();
    try { w.editorApp.Adapter.GetTopicSync(topic.query, data => {
      if (!data?.XmlContent || !/<article\b/i.test(data.XmlContent)) finish(reject, new Error(`章节 ${topic.number} 正文无效或没有权限`));
      else finish(resolve, new DOMParser().parseFromString(data.XmlContent, 'text/html'));
    }); } catch (error) { finish(reject, error); }
  });
  const bodyText = doc => {
    const article = doc.querySelector('article');
    const cloned = article.cloneNode(true);
    cloned.querySelectorAll('script,style,button,[data-generate-editor]').forEach(e => e.remove());
    cloned.querySelectorAll('tr').forEach(row => {
      row.replaceWith(doc.createTextNode('\n' + Array.from(row.querySelectorAll('th,td')).map(cell => cell.textContent.trim()).join('\t') + '\n'));
    });
    cloned.querySelectorAll('p,h1,h2,h3,h4,li,div').forEach(e => e.append(doc.createTextNode('\n')));
    return cloned.textContent.replace(/↵/g, '').replace(/\n{3,}/g, '\n\n').trim();
  };
  async function scan(automatic = false) {
    if (controller) return;
    const w = editor(); if (!w) { status('方案尚未加载，稍后再扫描 / Wait for solution'); return; }
    if (!settingsReady) { getName(); status('正在等待默认设置 / Waiting for settings'); return; }
    controller = new AbortController(); const signal = controller.signal;
    scanFinished = false;
    $('scan').disabled = $('zip').disabled = true; $('stop').disabled = false;
    topics = netcareTopicCatalogue(w.navigationTree.FirstLevelTopics);
    if (automatic && (settings.attachmentsEnabled || settings.textEnabled)) topics = topics.filter(topic => settings.attachmentsEnabled && netcareSectionMatches(settings, topic.number, 'attachments') || settings.textEnabled && netcareSectionMatches(settings, topic.number, 'text'));
    attachments = []; cleanScan = false;
    $('files').replaceChildren(); $('chapters').replaceChildren();
    let errors = 0;
    try {
      if (!topics.length) throw new Error('未识别到完整章节目录，请检查网站页面版本');
      for (const topic of topics) {
        if (signal.aborted) throw new Error('已停止 / Stopped');
        status(`扫描 ${topic.number} ${topic.title} / Scanning`);
        try {
          await throttle(signal);
          const doc = await loadTopic(w, topic, signal);
          topic.text = `${topic.number} ${topic.title}\n\n${bodyText(doc)}`;
          const seen = new Set();
          for (const a of doc.querySelectorAll('a[data-hd-attachment="true"]')) {
            const href = a.getAttribute('data-hd-href') || a.getAttribute('href') || '';
            if (!/^x-wc:\/\/file=[a-z0-9_.-]+$/i.test(href)) { errors++; topic.error = '存在不支持的附件链接'; continue; }
            if (seen.has(href)) continue; seen.add(href);
            const item = { section: topic.number, name: a.textContent.trim() || href.split('=')[1], href, topic: topic.topic };
            attachments.push(item);
            const line = document.createElement('div'); line.textContent = `${topic.number} · ${item.name}`; $('files').append(line);
          }
        } catch (error) { if (signal.aborted) throw error; topic.error = error.message; errors++; }
        const label = document.createElement('label'), box = document.createElement('input'); box.type = 'checkbox';
        const required = settings.aiAuditEnabled && settings.sections.some(row=>row.number===topic.number && row.textPrompt);
        if(required)selected.add(topic.number);
        box.checked = selected.has(topic.number); box.disabled = !!topic.error || !!required;
        box.onchange = () => box.checked ? selected.add(topic.number) : selected.delete(topic.number);
        label.append(box, document.createTextNode(`${topic.number} ${topic.title}${topic.error ? ' · ERROR: ' + topic.error : ''}`)); $('chapters').append(label);
      }
      cleanScan = errors === 0; scanFinished = true;
      $('count').textContent = `附件 ${attachments.length} 个 / Attachments`;
      if (!attachments.length) $('files').textContent = '未发现附件 / No attachments found';
      status(`已扫描 ${topics.length} 章，发现 ${attachments.length} 个附件；${errors} 处扫描错误。可勾选章节并下载 ZIP。`);
      $('zip').disabled = false;
    } catch (error) { status(error.message + '；扫描未完成，需重新扫描。'); }
    finally { controller = null; $('scan').disabled = false; $('stop').disabled = true; maybeAuto(); }
  }
  async function download(automatic = false) {
    if (controller) return;
    const filename = $('filename').value.trim();
    if (!filename) { getName(); status('请先完成 Word 下载，或填写对应 Word 文件名 / Enter Word filename'); return; }
    controller = new AbortController(); const signal = controller.signal;
    $('scan').disabled = $('zip').disabled = true; $('stop').disabled = false;
    const selection = automatic ? new Set(settings.textEnabled ? settings.sections.filter(row => row.text).map(row => row.number) : []) : new Set(selected);
    if(settings.aiAuditEnabled)settings.sections.filter(row=>row.textPrompt).forEach(row=>selection.add(row.number));
    const chosen = automatic ? attachments.filter(file => settings.attachmentsEnabled && netcareSectionMatches(settings, file.section, 'attachments')) : attachments;
    const evidence = [], entries = [], used = new Set(), report = [`RFC: ${order}`, `Word: ${filename}`, `扫描完整: ${cleanScan}`, ''];
    report.push(`模式: ${automatic ? '按默认设置自动提取' : '手动全部附件与所选章节'}`);
    for (const number of selection) if (!topics.some(t => t.number === number)) report.push(`章节 MISSING: ${number}`);
    if (automatic && settings.attachmentsEnabled) for (const row of settings.sections.filter(row => row.attachments)) if (!topics.some(t => t.number === row.number)) report.push(`附件章节 MISSING: ${row.number}`);
    let failed = topics.filter(t => t.error).length, attachmentSuccess=0;
    try {
      const w = editor(); if (!w) throw new Error('在线编辑器连接失效，请重新加载方案');
      // Same native file-state check as clicking an attachment.
      if (chosen.length && chosen.some(file => !blobs.has(file.href))) {
      await throttle(signal);
      await new Promise((resolve, reject) => {
        const abort = () => finish(reject, new Error('已停止 / Stopped'));
        const timer = setTimeout(() => finish(reject, new Error('原生附件状态检查超时')), 45000);
        const finish = (fn, value) => { clearTimeout(timer); signal.removeEventListener('abort', abort); fn(value); };
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) return abort();
        try { w.editorApp.Adapter.GetFileStatus(data => data ? finish(resolve, data) : finish(reject, new Error('原生文件状态检查失败'))); }
        catch (error) { finish(reject, error); }
      });
      }
      for (const file of chosen) {
        if (signal.aborted) throw new Error('已停止 / Stopped');
        status(`下载 ${file.section} · ${file.name}`);
        try {
          let blob = blobs.get(file.href);
          if (!blob) {
          await throttle(signal);
          const href = await new Promise(resolve => w.editorApp.Adapter.DownloadAttachmentUrl(file.href, resolve));
          const u = new URL(href, location.origin);
          if (u.origin !== location.origin || u.pathname !== '/ows1/services/content/downloadAttachment') throw new Error('附件地址校验失败');
          // Credentials remain in their own KDP origin, never sent to messages.
          const token = w.sessionStorage.getItem('X-CSRF-TOKEN');
          const response = await fetch(u.href, { credentials: 'same-origin', headers: token ? { 'X-CSRF-TOKEN': token } : {}, signal: AbortSignal.any([signal, AbortSignal.timeout(120000)]) });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          blob = await response.blob();
          const preview = await blob.slice(0, 200).text();
          if (!blob.size || /text\/html/i.test(blob.type) && /<html|<!doctype/i.test(preview)) throw new Error('附件为空或返回登录/错误页');
          if (blob.size > 100 * 1024 * 1024) throw new Error('单附件超过100MB');
          blobs.set(file.href, blob);
          }
          const saved = netcareUniqueFilename(netcareSafeFilename(`${file.section}-${file.name}`), used);
          if (/\.txt$/i.test(file.name)) {
            try { if(blob.size>240000)throw new Error('TXT附件过大，暂不自动审计'); const bytes=new Uint8Array(await blob.arrayBuffer()), decoder=new TextDecoder(bytes[0]===255&&bytes[1]===254?'utf-16le':'utf-8',{fatal:true}); evidence.push({section:file.section,kind:'attachments',filename:saved,text:decoder.decode(bytes).replace(/^\ufeff/,'')}); }
            catch(error){evidence.push({section:file.section,kind:'attachments',filename:saved,error:error.message});}
          } else evidence.push({section:file.section,kind:'attachments',filename:saved,error:'当前仅审计TXT附件，此格式需人工检查 / TXT only'});
          entries.push({ name: saved, blob });attachmentSuccess++; report.push(`附件 OK: ${file.section} · ${file.name} -> ${saved} (${blob.size} bytes)`);
        } catch (error) { if (signal.aborted) throw error; failed++; report.push(`附件 ERROR: ${file.section} · ${file.name}: ${error.message}`); }
      }
      for (const topic of topics) {
        if (topic.error) report.push(`章节 ERROR: ${topic.number} ${topic.title}: ${topic.error}`);
        if (selection.has(topic.number) && topic.text && !topic.error) {
          const name = netcareUniqueFilename(netcareSafeFilename(`${topic.number}-${topic.title}.txt`), used);
          evidence.push({section:topic.number,kind:'text',filename:name,text:topic.text});
          entries.push({ name, blob: new Blob(['\ufeff' + topic.text], { type: 'text/plain;charset=utf-8' }) }); report.push(`章节 OK: ${name}`);
        }
      }
      if(settings.screenshotsEnabled!==false){
        const shots=[];
        for(const topic of topics.filter(t=>selection.has(t.number)&&!t.error)){
          const article=[...w.document.querySelectorAll('article')].find(a=>a.querySelector('h1,h2,h3')?.textContent.trim().replace(/\s+/g,' ').startsWith(topic.number+' '));
          shots.push({element:article,name:`${topic.number}-${topic.title}-章节原图`});
        }
        for(const file of chosen){const anchor=[...w.document.querySelectorAll('a')].find(a=>(a.getAttribute('data-hd-href')||a.getAttribute('href')||'').toLowerCase()===file.href.toLowerCase());shots.push({element:anchor?.closest('tr')||anchor?.closest('p')||anchor,name:`${file.section}-${file.name}-附件位置`});}
        for(const shot of shots){if(signal.aborted)throw Error('已停止 / Stopped');status('保存原始区域截图 / Screenshot: '+shot.name);try{const images=await netcareCaptureEvidence(shot.element,globalThis.html2canvas,signal);for(let i=0;i<images.length;i++)entries.push({name:netcareUniqueFilename(netcareSafeFilename(shot.name+`-${String(i+1).padStart(3,'0')}.png`),used),blob:images[i]});report.push(`截图 OK: ${shot.name} · ${images.length} 张`);}catch(e){if(signal.aborted)throw e;failed++;report.push(`截图 ERROR: ${shot.name}: ${e.message}`);}}
      }
      for(const row of settings.sections) for(const kind of ['text','attachments']) if(settings.aiAuditEnabled && row[kind+'Prompt'] && !evidence.some(item=>item.section===row.number && item.kind===kind)) evidence.push({section:row.number,kind,filename:row.title,error:'未提取到该章节内容或附件，需人工检查 / Missing evidence'});
      let reports=[], cached=true;
      try {netcareCacheAudit(localStorage,order,evidence,[]);}catch(error){cached=false;report.push('暂存 ERROR: '+error.message);}
      if(settings.aiAuditEnabled){
        if(!cached)reports=[{status:'needs_review',summary:'浏览器暂存失败，未自动提交审计',error:true}];
        else reports=await netcareRunAudits(evidence,settings,requestAudit,signal,text=>{status('AI 审计 / Auditing: '+text);$('auditStatus').textContent=text;});
        const auditText=reports.map(r=>`${r.section||''} ${r.filename||''} · ${r.status}\n${r.summary}\n${(r.findings||[]).join('\n')}`).join('\n\n');
        $('auditStatus').textContent=auditText || '没有匹配的审计规则 / No audit rules';
        entries.push({name:netcareUniqueFilename('AI审计结果.json',used),blob:new Blob([JSON.stringify({order,at:new Date().toISOString(),reports},null,2)],{type:'application/json'})});
        entries.push({name:netcareUniqueFilename('AI审计结果.txt',used),blob:new Blob(['\ufeff'+auditText],{type:'text/plain;charset=utf-8'})});
        report.push('AI审计: '+reports.length+' 项；需人工复核 / Human review required');
        try{netcareCacheAudit(localStorage,order,evidence,reports);}catch{}

      }
      for(const entry of entries.filter(e=>evidence.some(i=>i.filename===e.name))){try{await netcareStoreArtifact(order,entry.name,entry.blob,signal);}catch(error){report.push('材料缓存 ERROR: '+entry.name+': '+error.message);}}
      window.postMessage({source:'TP_RFC_AUDIT_PUBLISH',order,record:{order,wordFilename:filename,generationAt,at:new Date().toISOString(),items:evidence,reports}},location.origin);
      entries.push({ name: netcareUniqueFilename('清单.txt', used), blob: new Blob(['\ufeff' + report.join('\n')], { type: 'text/plain;charset=utf-8' }) });
      if (signal.aborted) throw new Error('已停止 / Stopped');
      status('正在生成 ZIP… / Building ZIP'); const zip = await createNetcareZip(entries);
      if (signal.aborted) throw new Error('已停止 / Stopped');
      const href = URL.createObjectURL(zip), a = document.createElement('a'); a.href = href;
      a.download = netcareSafeFilename(filename.replace(/\.docx$/i, '') + '.zip'); document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 60000);
      status(`ZIP 已发起保存：${a.download}\n${attachmentSuccess} 个附件成功；${failed} 处错误（详见清单）；${entries.length - 1} 个数据文件。`);
    } catch (error) { status(error.message); }
    finally { controller = null; $('scan').disabled = $('zip').disabled = false; $('stop').disabled = true; }
  }
  $('scan').onclick = () => scan(false); $('zip').onclick = () => { autoAttempted = true; download(false); }; $('stop').onclick = () => controller?.abort();
  $('all').onchange = () => {
    for (const box of $('chapters').querySelectorAll('input:not(:disabled)')) { box.checked = $('all').checked; box.onchange(); }
  };
  const timer = setInterval(() => { if (editor() && settingsReady) { clearInterval(timer); scan(true); } }, 1000);
  const cleanup = () => { collectorLanguage?.stop();controller?.abort(); clearInterval(timer); clearInterval(nameTimer); window.removeEventListener('message', receive); window.removeEventListener('message', receiveSlot); blobs.clear(); host.remove(); };
  window.__netcareCollectorCleanup = cleanup; $('close').onclick = cleanup;
}

(() => {
  'use strict';
  const CHANNEL = 'netcare-rfc-word-v1';
  const NETCARE_ORIGINS = new Set([
    'https://netcare-ae.gts.huawei.com',
    'https://netcare.huawei.com',
    'https://netcare-de.gts.huawei.com'
  ]);
  const ID = 'netcare-rfc-word-panel';
  const validOrder = value => /^NC\d{14}$/.test(value);
  const validExport = value => {
    const u = new URL(value);
    return u.protocol === 'https:' && /(^|\.)kdp\.gts\.huawei\.com$/.test(u.hostname)
      && u.pathname === '/ows1/static/editor/IdpLiteView/PublishLiteView.html';
  };

  if (location.protocol === 'https:' && /(^|\.)kdp\.gts\.huawei\.com$/.test(location.hostname)
    && location.pathname === '/ows1/static/editor/IdpLiteView/OwsPage.html' && window === window.top) {
    mountNetcareCollector(); return;
  }

  // Chrome injects this script automatically in the persistent export iframe.
  if (validExport(location.href) && window.name === 'rfc-word-worker') {
    // ancestorOrigins exposes the direct parent's origin without accessing its DOM.
    // Only a supported direct parent can initialize this dedicated worker.
    const parentOrigin = location.ancestorOrigins?.[0];
    if (!NETCARE_ORIGINS.has(parentOrigin)) return;
    window.__rfcWordWorkerCleanup?.();
    const jobs = new Map();
    let readyTimer;
    const tell = message => parent.postMessage({ channel: CHANNEL, ...message }, parentOrigin);
    const ajax = (path, params, signal) => new Promise((resolve, reject) => {
      if (!window.jQuery?.ajax) return reject(new Error('导出页面尚未加载完成，请稍后重新粘贴脚本'));
      const u = new URL('/ows1/services/' + path, location.origin);
      Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
      const request = window.jQuery.ajax({ url: u.href, type: 'GET', dataType: 'json', timeout: 45000,
        // The native ViewAjaxLoader reads this value from the export origin.
        // Keep it in this frame only; never include it in messages or logs.
        beforeSend(xhr) {
          const value = sessionStorage.getItem('X-CSRF-TOKEN');
          if (value) xhr.setRequestHeader('X-CSRF-TOKEN', value);
        }
      });
      const abort = () => request.abort();
      signal.addEventListener('abort', abort, { once: true });
      request.done(data => {
        signal.removeEventListener('abort', abort);
        if (!data || typeof data !== 'object') reject(new Error('导出服务未返回有效数据，请检查登录状态'));
        else resolve(data);
      }).fail((_xhr, status) => {
        signal.removeEventListener('abort', abort);
        reject(new Error(signal.aborted ? '已停止等待' : `导出服务请求失败：${status}（请检查登录或权限）`));
      });
      if (signal.aborted) abort();
    });
    const sleep = (ms, signal) => new Promise((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new Error('已停止等待')); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
    async function run(message, signal) {
      const { job, order } = message;
      const progress = text => tell({ type: 'progress', job, text });
      progress('读取方案信息…');
      // Same first request as the native Word export action.
      await ajax('alm/ows/getManualInfo', { id: order, from: 'undefined' }, signal);
      progress('创建 Word 转换任务…');
      const created = await ajax('ows/addPublishToolTask', { owsId: order, from: 'null' }, signal);
      if (created.status !== 'Success' || typeof created.returnValue !== 'string' || !created.returnValue) {
        throw new Error('创建任务失败；可能没有数字化方案或当前账号没有导出权限');
      }
      const taskId = created.returnValue;
      const start = Date.now();
      while (!signal.aborted && Date.now() - start < 10 * 60 * 1000) {
        const state = await ajax('ows/getPublishToolStatus', {
          taskId, docId: order, tm: Date.now(), from: 'ows'
        }, signal);
        const status = String(state.status);
        progress(`转换状态 ${status}：${String(state.message || '等待服务处理').slice(0, 120)}（${Math.round((Date.now() - start) / 1000)} 秒）`);
        if (status === '9') {
          if (signal.aborted) throw new Error('已停止等待');
          const filename = typeof state.fileName === 'string' && state.fileName ? state.fileName
            : typeof created.obj === 'string' ? created.obj : order;
          const u = new URL('/ows1/services/ows/downloadPublishFileFromUrl', location.origin);
          u.searchParams.set('taskId', taskId);
          u.searchParams.set('docId', order);
          // Native endpoint uses a double-encoded fileName.
          u.searchParams.set('fileName', encodeURIComponent(filename));
          u.searchParams.set('tm', Date.now());
          u.searchParams.set('from', 'ows');
          progress('Word 已生成，正在获取文件…');
          // Native download also uses an authenticated XMLHttpRequest.
          const blob = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', u.href);
            const value = sessionStorage.getItem('X-CSRF-TOKEN');
            if (value) xhr.setRequestHeader('X-CSRF-TOKEN', value);
            xhr.responseType = 'blob';
            xhr.timeout = 120000;
            const abort = () => xhr.abort();
            signal.addEventListener('abort', abort, { once: true });
            const finish = () => signal.removeEventListener('abort', abort);
            xhr.onload = () => { finish(); if (xhr.status === 200) resolve(xhr.response);
              else reject(new Error(`文件下载失败：HTTP ${xhr.status}`)); };
            xhr.onerror = () => { finish(); reject(new Error('文件下载请求失败')); };
            xhr.ontimeout = () => { finish(); reject(new Error('文件下载超时')); };
            xhr.onabort = () => { finish(); reject(new Error('已停止等待')); };
            xhr.send();
            if (signal.aborted) xhr.abort();
          });
          const bytes = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
          if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
            throw new Error('返回文件不是有效的 DOCX/ZIP，可能登录已失效或无下载权限');
          }
          if (signal.aborted) throw new Error('已停止等待');
          const objectURL = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = objectURL;
          anchor.download = `${order}_${filename.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\.docx$/i, '')}.docx`;
          document.body.append(anchor);
          anchor.click();
          anchor.remove();
          setTimeout(() => URL.revokeObjectURL(objectURL), 60000);
          {try{await netcareStoreArtifact(order,anchor.download,blob,signal);}catch(error){tell({type:'progress',job,text:'Word已保存；审计材料缓存失败：'+error.message});}}
          tell({ type: 'done', job, filename: anchor.download, text: `已获取 Word 文件（${Math.round(blob.size / 1024)} KB），已发起保存；请在 Chrome 下载记录中确认。` });
          return;
        }
        if (/失败|异常|无权限|不存在|failed|error|denied/i.test(String(state.message || ''))) {
          throw new Error(`转换未完成：${String(state.message).slice(0, 160)}`);
        }
        await sleep(5000, signal);
      }
      throw new Error(signal.aborted ? '已停止等待' : '转换超过 10 分钟，已停止轮询；服务端任务可能仍在运行');
    }
    const receive = event => {
      if(event.source===window&&event.origin===location.origin&&event.data?.source==='TP_RFC_ARTIFACT_READY'){window.__tpNetcareArtifactReady=true;return;}
      if (event.origin !== parentOrigin || event.source !== parent || event.data?.channel !== CHANNEL) return;
      const message = event.data;
      if (message.type === 'hello') {
        if (window.jQuery?.ajax && sessionStorage.getItem('X-CSRF-TOKEN')) tell({ type: 'ready' });
        return;
      }
      if (message.type === 'cancel') return jobs.get(message.job)?.abort();
      if (message.type !== 'run' || !validOrder(message.order) || typeof message.job !== 'string') return;
      if (jobs.has(message.job)) return;
      if (jobs.size >= 3) return tell({ type: 'error', job: message.job, text: '并发任务已达上限（3 个）' });
      const controller = new AbortController();
      jobs.set(message.job, controller);
      run(message, controller.signal).catch(error => tell({ type: 'error', job: message.job, text: error.message }))
        .finally(() => jobs.delete(message.job));
    };
    window.addEventListener('message', receive);
    window.__rfcWordWorkerCleanup = () => {
      clearInterval(readyTimer);
      jobs.forEach(controller => controller.abort());
      window.removeEventListener('message', receive);
    };
    const announce = () => {
      if (window.jQuery?.ajax && sessionStorage.getItem('X-CSRF-TOKEN')) {
        clearInterval(readyTimer);
        tell({ type: 'ready' });
      }
    };
    readyTimer = setInterval(announce, 250);
    announce();
    return;
  }

  // Native export dialogs also match the extension; only the named worker runs.
  if (!NETCARE_ORIGINS.has(location.origin) || window !== window.top) return;
  window.__rfcWordPanelCleanup?.();
  const host = document.createElement('div');
  host.id = ID;
  host.style.cssText = 'position:fixed;right:20px;bottom:20px;width:min(390px,calc(100vw - 24px));z-index:2147483647';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    :host{--bg:#fff;--soft:#f5f7fb;--ink:#243149;--muted:#738096;--line:#e0e6ef;--accent:#2563eb;--hover:#edf2fa;color-scheme:light}
    *{box-sizing:border-box}button,input,textarea,select{font:inherit}button{cursor:pointer;border:1px solid var(--line);border-radius:7px;padding:7px 11px;background:var(--bg);color:var(--ink);transition:background .15s}button:hover{background:var(--hover)}button:disabled{opacity:.45;cursor:default}button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid var(--accent);outline-offset:2px}button[hidden],[hidden]{display:none!important}
    .panel{font:12px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:14px;box-shadow:0 12px 42px #15264326;max-height:calc(100vh - 40px);overflow:auto;padding:15px}
    .panel header{display:flex;align-items:center;justify-content:space-between;cursor:move;touch-action:none;margin-bottom:11px}.title{font-size:14px;font-weight:650;letter-spacing:.2px}.eyebrow{font-size:10px;color:var(--muted);letter-spacing:.8px}.header-actions{display:flex;gap:4px}.icon{width:30px;height:30px;padding:4px;border:0;background:transparent;font-size:17px;display:grid;place-items:center}.icon svg{width:17px;height:17px}
    .badge{font-size:10px;color:var(--muted);display:inline-block;background:var(--soft);padding:3px 7px;border-radius:5px;margin-bottom:10px}textarea,input[type=text],input[type=number],select{border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink);padding:8px;min-width:0}textarea{display:block;width:100%;resize:vertical;min-height:78px;max-height:160px;font:12px/1.6 ui-monospace,monospace;margin:5px 0 9px}input[type=checkbox]{accent-color:var(--accent);width:14px;height:14px;margin:0;vertical-align:middle}
    .actions{display:flex;gap:7px;margin:11px 0}.primary{background:var(--accent);color:#fff;border-color:var(--accent)}.primary:hover{background:#1d4ed8}.actions .primary{flex:1}.summary{font-size:10px;color:var(--muted);padding:7px 0;border-bottom:1px solid var(--line)}#results{max-height:180px;overflow:auto}pre{font:11px/1.55 system-ui;white-space:pre-wrap;overflow-wrap:anywhere;background:var(--soft);border-radius:7px;padding:9px;margin:10px 0 0;max-height:100px;overflow:auto}.panel small{display:block;color:var(--muted);font-size:10px;margin-top:9px}
    dialog{font:12px/1.5 system-ui,sans-serif;color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:16px;padding:0;width:min(920px,calc(100vw - 40px));max-width:none;height:min(740px,calc(100vh - 48px));max-height:none;box-shadow:0 24px 80px #0004;overflow:hidden}dialog::backdrop{background:#101b3566;backdrop-filter:blur(3px)}.settings-shell{height:100%;display:flex;flex-direction:column}.modal-head{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid var(--line)}.modal-head h2{font-size:18px;margin:0;font-weight:650}.modal-head p{margin:3px 0 0;color:var(--muted);font-size:11px}.modal-nav{display:flex;gap:6px;padding:12px 24px 0}.modal-nav button{border:0;background:transparent;color:var(--muted)}.modal-nav button[aria-selected=true]{background:var(--hover);color:var(--accent);font-weight:600}.modal-body{flex:1;min-height:0;overflow:auto;padding:18px 24px}.modal-footer{display:flex;gap:8px;align-items:center;padding:14px 24px;border-top:1px solid var(--line);background:var(--soft)}#settingsStatus{flex:1;font-size:11px;color:var(--muted)}.settings-card{border:1px solid var(--line);border-radius:10px;padding:17px;margin-bottom:14px}.settings-card h3{font-size:13px;margin:0 0 14px}.field-row{display:grid;grid-template-columns:1fr 150px;gap:20px;align-items:center;padding:11px 0;border-top:1px solid var(--line)}.field-row:first-of-type{border-top:0}.field-row label{font-weight:500}.field-row small,.note{display:block;font-size:11px;color:var(--muted);margin-top:4px}.field-row select,.field-row input[type=number]{width:100%}.switch-row{display:flex;gap:9px;align-items:center;margin:12px 0}.section-toolbar{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px}.section-toolbar strong{font-size:13px}.section-table{border:1px solid var(--line);border-radius:8px;overflow:hidden}.section-grid{display:grid;grid-template-columns:60px minmax(100px,1fr) 38px 38px minmax(130px,1fr) minmax(130px,1fr) 26px;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--line)}.section-grid:last-child{border-bottom:0}.section-grid.table-head{background:var(--soft);font-size:10px;color:var(--muted);position:sticky;top:0;z-index:1}.section-grid input[type=text]{width:100%;padding:6px;font-size:11px}.section-grid .check-cell{text-align:center}.section-grid textarea{font:11px/1.4 system-ui;margin:0;padding:6px;min-height:56px;max-height:140px;resize:vertical}.section-table{overflow:auto}.section-grid{min-width:750px}#aiFrame{border:0;width:100%;height:610px;border-radius:10px}.section-grid .delete{font-size:17px;padding:2px;width:28px;border:0;color:var(--muted)}.config-actions{display:flex;gap:8px;flex-wrap:wrap}.note{margin:10px 0 16px}
    #auditSummaryDialog{width:min(1560px,calc(100vw - 40px));height:calc(100vh - 48px)}.audit-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:12px 24px;border-bottom:1px solid var(--line);background:var(--soft)}.audit-toolbar span{font-size:11px;color:var(--muted)}.audit-table{width:100%;min-width:1000px;border-collapse:separate;border-spacing:0;table-layout:fixed;font-size:11px}.audit-table th{position:sticky;top:0;background:var(--soft);z-index:1;text-align:left;font-size:11px;padding:12px;border-top:1px solid var(--line)}.audit-table td{padding:14px 12px;vertical-align:top;border-top:1px solid var(--line);border-right:1px solid var(--line);overflow-wrap:anywhere;line-height:1.65}.audit-table td:first-child{border-left:1px solid var(--line)}.audit-table .group-cell{background:var(--soft);font-weight:600}.audit-table pre{max-height:200px;font-size:11px}.audit-table details{margin:8px 0}.audit-table summary{cursor:pointer}.audit-table .rule-label{font-weight:600;margin:8px 0}.audit-table .kind-label{font-size:10px;color:var(--muted)}.audit-table .group-start td{border-top:2px solid var(--accent)}.audit-rfc{border:1px solid var(--line);border-radius:10px;padding:14px;margin-bottom:14px}.audit-rfc>summary{font-weight:650;cursor:pointer}.audit-card{border-top:1px solid var(--line);margin-top:14px;padding-top:14px}.audit-card h4{margin:0 0 6px;font-size:13px}.audit-state{display:inline-block;border-radius:5px;padding:3px 7px;background:var(--soft);font-size:11px;margin-bottom:5px}.audit-state.pass{color:#27a77b}.audit-state.fail{color:#e36d72}.audit-state.needs_review{color:#cd9b34}.audit-card pre{max-height:220px}.audit-card details{margin-top:8px}.audit-card p{margin:5px 0;overflow-wrap:anywhere}
    @media(prefers-color-scheme:dark){:host{--bg:#182235;--soft:#131d2d;--ink:#e3eaf5;--muted:#97a8c0;--line:#314058;--accent:#4386f5;--hover:#24344d;color-scheme:dark}}
    @media(max-width:600px){dialog{width:calc(100vw - 16px);height:calc(100vh - 24px)}.modal-head,.modal-footer{padding:14px}.modal-body{padding:14px}.modal-nav{padding-left:14px}.section-grid{grid-template-columns:60px minmax(100px,1fr) 38px 38px minmax(130px,1fr) minmax(130px,1fr) 26px;padding:7px 6px;gap:4px}.section-toolbar{flex-wrap:wrap}.modal-footer{flex-wrap:wrap}#settingsStatus{flex-basis:100%}}
  </style><section class="panel"><header><div><div class="eyebrow">NETCARE · RFC</div><div class="title">方案与 AI 审计 / Solutions & AI audit</div></div><div class="header-actions"><button id="languageButton" class="icon" title="切换语言 / Change language">EN</button><button id="settingsButton" class="icon" aria-label="设置 / Settings" title="设置 / Settings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 2 3-1 2 2 3-1 1-3 3-1 2-3-2-2 1-3-3-2-3 1-2-2Z"/></svg></button><button id="close" class="icon" aria-label="关闭">×</button></div></header>
    <div class="badge" id="connection">导出服务：尚未连接</div><label for="order">RFC 单号 / RFC numbers</label>
    <textarea id="order" aria-label="RFC 单号列表" rows="3" placeholder="每行一个单号，也支持空格或逗号 / One RFC per line" autocomplete="off"></textarea>
    <div id="configSummary" class="summary"></div><select id="plans" aria-label="选择方案" hidden></select><button id="choose" hidden>确认方案 / Confirm</button>
    <div class="actions"><button id="run" class="primary">下载与审计 / Download & audit</button><button id="stop" disabled>停止 / Stop</button></div>
    <button id="auditResultsButton" style="width:100%">审计结果 / Audit results</button><div id="results" role="status"></div><pre id="log" role="status">输入单号开始下载 / Enter RFC numbers to start</pre><small>Ctrl / ⌘ + Enter 快速启动 · 配置保存在当前浏览器</small>
  </section>
  <dialog id="settingsDialog" aria-labelledby="settingsTitle"><div class="settings-shell"><div class="modal-head"><div><h2 id="settingsTitle">工具设置 / Settings</h2><p>下载偏好、章节规则与配置管理 / Preferences, sections & configuration</p></div><button id="settingsClose" class="icon" aria-label="关闭设置 / Close settings">×</button></div>
  <div class="modal-nav" role="tablist" aria-label="设置分类"><button id="generalTab" role="tab" aria-selected="true" aria-controls="generalSettings">常规 / General</button><button id="sectionsTab" role="tab" aria-selected="false" aria-controls="chapterSettings">章节规则 / Sections</button><button id="storageTab" role="tab" aria-selected="false" aria-controls="storageSettings">存储与快照 / Storage & snapshots</button><button id="aiTab" role="tab" aria-selected="false" aria-controls="aiSettings">AI 对接 / AI models</button></div>
  <div class="modal-body"><div id="generalSettings" role="tabpanel" aria-labelledby="generalTab"><div class="settings-card"><h3>下载与在线方案 / Download preferences</h3><div class="field-row"><div><label for="concurrency">Word 下载并发数 / Concurrency</label><small>同时处理 1–3 个下载任务</small></div><select id="concurrency"><option>1</option><option>2</option><option>3</option></select></div><div class="field-row"><div><label for="openOnline">同时在线打开方案 / Open online</label><small>独立开关。只下载 Word 时关闭此项和自动提取。 / Independent switch; disable for Word only.</small></div><input id="openOnline" type="checkbox"></div><div class="field-row"><div><label for="readInterval">采集请求间隔（秒） / Request interval</label><small>多个在线方案页共享间隔，范围 1–30 秒</small></div><input type="number" id="readInterval" min="1" max="30" step="0.5"></div></div>
  <div class="settings-card"><h3>AI 审计 / AI audit</h3><label class="switch-row"><input type="checkbox" id="aiAuditEnabled">开启 AI 审计 / Enable AI audit</label><p class="note">开启后向配置的模型发送有规则的章节文本和 TXT 附件。其它文件标记为需人工检查。先在“AI 对接”保存模型。 / Sends selected evidence to your model.</p></div><div class="settings-card"><h3>自动提取 / Automatic extraction</h3><label class="switch-row"><input type="checkbox" id="autoAttachments">指定章节的附件 / Section attachments</label><label class="switch-row"><input type="checkbox" id="autoText">指定章节的文本 / Section text</label><label class="switch-row"><input type="checkbox" id="screenshotsEnabled">保存原始区域截图（PNG） / Save source screenshots</label><p class="note">开启后在线提取所选章节并打包；AI 审计会自动启用有提示词的必需提取。 / Select sections in the next tab; ZIP follows Word export.</p></div>
  <div class="settings-card"><h3>配置管理 / Configuration</h3><iframe id="backupFrame" title="完整配置备份 / Full configuration backup" style="width:100%;height:230px;border:0"></iframe><div class="config-actions"><button id="importSettings" hidden>导入 JSON / Import</button><button id="exportSettings" hidden>导出 JSON / Export</button><button id="resetSections">恢复默认 / Reset</button></div><input id="importFile" type="file" accept=".json,application/json" hidden><p class="note">导出已保存配置。修改后先保存，再导出完整备份；导入完整备份立即恢复。 / Save changes before backup; import restores immediately.</p></div></div>
  <div id="chapterSettings" role="tabpanel" aria-labelledby="sectionsTab" hidden><div class="section-toolbar"><strong>章节模板 <span id="sectionCount"></span> / Sections</strong><button id="addSection">＋ 添加章节 / Add</button></div><p class="note">按序号精确匹配，父章节不包含子章节；文件名采用方案中的实际标题。 / Exact numbers; exported files use actual section titles.</p><div class="section-table"><div class="section-grid table-head"><span>序号 / No.</span><span>章节名称 / Title</span><span>附件</span><span>文本</span><span>附件检查提示词 / Attachment rule</span><span>文本检查提示词 / Text rule</span><span></span></div><div id="sectionRows"></div></div></div><div id="storageSettings" role="tabpanel" hidden><div class="settings-card"><h3>插件存储 / Extension storage</h3><p id="storageUsage"></p><progress id="storageMeter" max="1" value="0" style="width:100%"></progress><div class="field-row"><label for="storageCapacity">容量上限（MB） / Capacity (MB)</label><input id="storageCapacity" type="number" min="50" step="50"></div><p class="note">默认500MB，最多使用浏览器配额的一半且不超过2GB；不足时自动清理最旧快照及不再引用的材料。浏览器可能清理扩展数据，请定期下载备份。 / Default 500MB; capped at half the browser quota and 2GB. Oldest snapshots are removed when full. Download backups regularly.</p><button id="storageApply">应用容量 / Apply capacity</button><p id="storageMessage" role="status"></p></div><div class="settings-card"><div class="section-toolbar"><h3>历史快照 / Snapshot history</h3><button id="storageRefresh">刷新 / Refresh</button></div><div class="config-actions"><button id="snapSelectAll">全选 / Select all</button><button id="snapSelectNone">取消选择 / Clear selection</button></div><div id="snapshotRows"></div><p id="cleanupPreview"></p><div class="config-actions"><button id="snapshotBackup" class="primary">下载待清理快照与材料 / Backup selected</button><button id="snapshotDelete">删除所选快照 / Delete selected</button></div><p class="note">清理不会删除已下载到本地的文件；共享材料只在不再被任何快照引用时删除。 / Local downloads are kept. Shared files are removed only when no snapshot references them.</p></div></div><div id="aiSettings" role="tabpanel" aria-labelledby="aiTab" hidden><iframe id="aiFrame" title="AI 模型配置 / AI model settings"></iframe><p id="aiFrameStatus" class="note">等待扩展模型配置模块连接 / Waiting for extension</p></div></div>
  <div class="modal-footer"><div id="settingsStatus" role="status"></div><button id="cancelSettings">取消 / Cancel</button><button id="saveSettings" class="primary">保存设置 / Save</button></div></div></dialog><dialog id="auditSummaryDialog" aria-labelledby="auditSummaryTitle"><div class="settings-shell"><div class="modal-head"><div><h2 id="auditSummaryTitle">审计结果 / Audit results</h2><p id="auditCounts">尚无结果 / No results</p></div><button id="auditSummaryClose" class="icon" aria-label="关闭审计汇总 / Close audit results">×</button></div><div class="audit-toolbar"><select id="snapshotSelect" aria-label="历史快照 / Snapshot history"><option value="">当前结果 / Current results</option></select><button id="snapshotSave">保存快照 / Save snapshot</button><button id="auditExcel" class="primary">导出审计 Excel / Export</button><button id="auditBundle">下载审计材料 ZIP / Materials</button><span id="auditExportStatus" role="status"></span></div><div id="auditSummaryBody" class="modal-body"></div></div></dialog>`;
  document.body.append(host);
  const $ = id => root.getElementById(id);
  let active;
  const bridges = new Map(), jobs = new Map();
  const translations = {
    '导出服务连接成功。': 'Export service connected.',
    '读取方案信息…': 'Reading solution…',
    '创建 Word 转换任务…': 'Creating Word conversion task…',
    'Word 已生成，正在获取文件…': 'Word generated; fetching file…',
    '已停止等待': 'Stopped waiting.',
    '通过网站原生搜索定位作业单…': 'Finding RFC through the site search…',
    '调用网站原生下载入口，检查授权…': 'Checking authorization through the native download action…',
    '授权入口已通过，开始生成 Word…': 'Authorization passed; generating Word…',
    '单号格式应为 NC + 14 位数字。': 'RFC must be NC followed by 14 digits.'
  };
  const translate = text => translations[text] ? `${text} / ${translations[text]}` : text;
  const log = text => {
    $('log').textContent += '\n' + translate(text);
    $('log').scrollTop = $('log').scrollHeight;
  };
  let extractionSettings = netcareDefaultSettings(), settingsLoaded = false;
  const renderSettings = () => {
    $('aiAuditEnabled').checked = extractionSettings.aiAuditEnabled;
    $('concurrency').value = extractionSettings.concurrency; $('openOnline').checked = extractionSettings.openOnline;
    updatePreferenceSummary();
    $('screenshotsEnabled').checked=extractionSettings.screenshotsEnabled!==false; $('autoAttachments').checked = extractionSettings.attachmentsEnabled; $('autoText').checked = extractionSettings.textEnabled;
    $('readInterval').value = extractionSettings.intervalMs / 1000; $('sectionRows').replaceChildren();
    for (const row of extractionSettings.sections) addSectionRow(row);
  };
  function addSectionRow(row) {
    const line = document.createElement('div'); line.className = 'section-grid';
    const number = document.createElement('input'); number.type = 'text'; number.value = row.number; number.setAttribute('aria-label', '章节序号 / Section number'); number.dataset.field = 'number';
    const title = document.createElement('input'); title.type = 'text'; title.value = row.title; title.setAttribute('aria-label', '章节名字 / Section title'); title.dataset.field = 'title';
    line.append(number, title);
    for (const [kind, caption] of [['attachments', '附件 / Attachments'], ['text', '文本 / Text']]) {
      const label = document.createElement('label'), box = document.createElement('input'); label.className = 'check-cell'; box.type = 'checkbox'; box.checked = row[kind]; box.dataset.field = kind; box.setAttribute('aria-label', caption); label.append(box); line.append(label);
    }
    for(const [kind,caption] of [['attachments','附件检查提示词 / Attachment rule'],['text','文本检查提示词 / Text rule']]) {
      const prompt=document.createElement('textarea');prompt.dataset.field=kind+'Prompt';prompt.value=row[kind+'Prompt']||'';prompt.setAttribute('aria-label',caption);prompt.placeholder='填写后自动勾选并锁定 / Required when set';
      const lock=()=>{const box=line.querySelector(`[data-field=${kind}]`);box.disabled=!!prompt.value.trim();if(box.disabled)box.checked=true;};prompt.oninput=lock;line.append(prompt);lock();
    }
    const remove = document.createElement('button'); remove.textContent = '×'; remove.className = 'delete'; remove.setAttribute('aria-label','删除章节 / Delete section'); remove.onclick = () => { line.remove(); updateSectionCount(); }; line.append(remove); $('sectionRows').append(line); updateSectionCount();
  }
  const updateSectionCount = () => { $('sectionCount').textContent = `(${ $('sectionRows').children.length })`; };
  const readSettings = () => netcareNormalizeSettings({ screenshotsEnabled:$('screenshotsEnabled').checked, aiAuditEnabled: $('aiAuditEnabled').checked, concurrency: Number($('concurrency').value), openOnline: $('openOnline').checked, attachmentsEnabled: $('autoAttachments').checked, textEnabled: $('autoText').checked, intervalMs: Number($('readInterval').value) * 1000,
    sections: Array.from($('sectionRows').children, line => ({ number: line.querySelector('[data-field=number]').value, title: line.querySelector('[data-field=title]').value, attachments: line.querySelector('[data-field=attachments]').checked, text: line.querySelector('[data-field=text]').checked, attachmentsPrompt:line.querySelector('[data-field=attachmentsPrompt]').value,textPrompt:line.querySelector('[data-field=textPrompt]').value })) });
  $('addSection').onclick = () => addSectionRow({ number: '', title: '', attachments: false, text: false });
  $('resetSections').onclick = () => { const saved = extractionSettings; extractionSettings = netcareDefaultSettings(); renderSettings(); extractionSettings = saved; $('settingsStatus').textContent = '已恢复默认草稿，请保存 / Save to apply'; };
  $('saveSettings').onclick = () => {
    try { const settings = readSettings(); $('settingsStatus').textContent = '正在保存 / Saving'; window.postMessage({ source: 'TP_RFC_SETTINGS_SET', settings }, location.origin); }
    catch (error) { $('settingsStatus').textContent = error.message; }
  };
  const dialog = $('settingsDialog');
  const auditDialog=$('auditSummaryDialog'); let auditRecords=[],liveAuditRecords=[],activeSnapshot='',auditExportBusy=false;
  let uiLanguage='zh';const localization=globalThis.createNetcareLanguage?.(root,uiLanguage);
  const setLanguage=lang=>{uiLanguage=lang==='en'?'en':'zh';localization?.set(uiLanguage);$('languageButton').textContent=uiLanguage==='zh'?'EN':'中';updatePreferenceSummary();};
  const tr=(zh,en)=>uiLanguage==='en'?en:zh;
  function updatePreferenceSummary(){$('configSummary').textContent = tr(`并发 ${extractionSettings.concurrency} · 在线${extractionSettings.openOnline || extractionSettings.attachmentsEnabled || extractionSettings.textEnabled ? '开启' : '关闭'} · 自动提取${extractionSettings.attachmentsEnabled || extractionSettings.textEnabled ? '开启' : '关闭'}`,`Concurrency ${extractionSettings.concurrency} · Online ${extractionSettings.openOnline || extractionSettings.attachmentsEnabled || extractionSettings.textEnabled ? 'on' : 'off'} · Extraction ${extractionSettings.attachmentsEnabled || extractionSettings.textEnabled ? 'on' : 'off'}`);}
  $('languageButton').onclick=()=>{setLanguage(uiLanguage==='zh'?'en':'zh');window.postMessage({source:'TP_RFC_LANGUAGE_SET',language:uiLanguage},location.origin);renderAudits();};
  window.postMessage({source:'TP_RFC_LANGUAGE_GET'},location.origin);
  const auditStatusLabel=value=>({pass:'通过 / Pass',fail:'不通过 / Fail',needs_review:'需人工检查 / Review'})[value]||'需人工检查 / Review';
  const renderAudits=()=>{
    const body=$('auditSummaryBody'),scroll=body.scrollTop;body.replaceChildren();
    const counts={pass:0,fail:0,needs_review:0};
    const append=(parent,tag,text,className)=>{const e=document.createElement(tag);e.textContent=text;if(className)e.className=className;parent.append(e);return e;};
    if(!auditRecords.length)append(body,'p','暂无审计结果。开启AI审计并完成提取后自动显示。 / No audit results yet.');
    const table=append(body,'table','', 'audit-table'),colgroup=append(table,'colgroup','');for(const width of ['16%','16%','30%','12%','26%']){const col=append(colgroup,'col','');col.style.width=width;}
    const head=append(table,'thead',''),headRow=append(head,'tr','');for(const title of ['方案 / RFC','章节 / Section','审计点与内容 / Evidence','结论 / Result','原因 / Reason'])append(headRow,'th',title);
    const tbody=append(table,'tbody',''),rows=netcareAuditRows(auditRecords);
    rows.forEach((report,index)=>{
      const state=['pass','fail'].includes(report.status)?report.status:'needs_review';counts[state]++;const tr=append(tbody,'tr','');
      if(!index||rows[index-1].order!==report.order){tr.className='group-start';const cell=append(tr,'td',report.order,'group-cell');cell.rowSpan=rows.filter(r=>r.order===report.order).length;if(report.wordFilename)append(cell,'p',report.wordFilename,'note');}
      if(!index||rows[index-1].order!==report.order||rows[index-1].section!==report.section){const cell=append(tr,'td',`${report.section||'—'} ${report.sectionTitle||''}`,'group-cell');cell.rowSpan=rows.filter(r=>r.order===report.order&&r.section===report.section).length;}
      const content=append(tr,'td','');append(content,'div',report.kind==='text'?'章节文本 / Section text':'附件 / Attachment','kind-label');append(content,'p',report.rule||'未提供规则 / No rule','rule-label');const details=append(content,'details','');append(details,'summary',report.filename||'查看内容 / Content');append(details,'pre',report.text);
      const result=append(tr,'td','');append(result,'span',auditStatusLabel(state),'audit-state '+state);
      const reason=append(tr,'td','');append(reason,'p',report.summary||tr('未提供理由','No reason provided')).setAttribute('data-user-content','');if(report.findings?.length){const list=append(reason,'ul','');list.setAttribute('data-user-content','');report.findings.forEach(f=>append(list,'li',f));}
      if(report.diagnostics){const d=report.diagnostics,more=append(reason,'details','');append(more,'summary','查看失败详情 / Error details');append(more,'pre',JSON.stringify({...d,response:undefined},null,2));if(d.response){let response=d.response;try{const parsed=JSON.parse(response);response=typeof parsed==='string'?parsed:JSON.stringify(parsed,null,2);}catch{}append(more,'pre',response);}}
    });
    $('auditExcel').disabled=$('auditBundle').disabled=!rows.length||auditExportBusy;
    $('auditCounts').textContent=tr(`通过 ${counts.pass} · 不通过 ${counts.fail} · 需人工核查 ${counts.needs_review}`,`Pass ${counts.pass} · Fail ${counts.fail} · Review ${counts.needs_review}`);
    $('auditResultsButton').textContent=tr(`审计结果（${counts.pass+counts.fail+counts.needs_review}）`,`Audit results (${counts.pass+counts.fail+counts.needs_review})`);body.scrollTop=scroll;
  };
  const saveAuditFile=(blob,name)=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);};
  $('auditExcel').onclick=async()=>{if(auditExportBusy)return;auditExportBusy=true;try{$('auditExcel').disabled=$('auditBundle').disabled=true;saveAuditFile(await netcareAuditExcel(auditRecords),'NetCare-审计结果-'+new Date().toISOString().slice(0,10)+'.xlsx');$('auditExportStatus').textContent='Excel 已导出 / Exported';}catch(e){$('auditExportStatus').textContent=e.message;}finally{auditExportBusy=false;$('auditExcel').disabled=$('auditBundle').disabled=!netcareAuditRows(auditRecords).length;}};
  $('auditBundle').onclick=async()=>{if(auditExportBusy)return;auditExportBusy=true;const snapshot=JSON.parse(JSON.stringify(auditRecords));try{$('auditExcel').disabled=$('auditBundle').disabled=true;const selectedSnapshot=activeSnapshot,files=await netcareArtifactRequest({action:'list',orders:snapshot.map(r=>r.order),snapshotId:selectedSnapshot});
    if(files.reduce((n,f)=>n+f.size,0)>512*1048576)throw Error(tr('单次打包超过512MB，请按历史快照分批下载','This export exceeds 512MB. Download snapshots in smaller batches.'));
    const {entries,missing}=await netcareAuditMaterials(snapshot,files,async file=>{const parts=[];for(let index=0;index<file.count;index++){const data=await netcareArtifactRequest({action:'read',order:file.order,fileId:file.id,index,snapshotId:selectedSnapshot});parts.push(Uint8Array.from(atob(data),c=>c.charCodeAt(0)));}return new Blob(parts);},file=>{$('auditExportStatus').textContent='打包 / Packing: '+file.order+' · '+file.name;});
    saveAuditFile(await createNetcareZip(entries),'NetCare-审计材料-'+new Date().toISOString().slice(0,10)+'.zip');$('auditExportStatus').textContent=missing.length?`ZIP 已保存；${missing.length} 个材料缺失，详见清单 / Incomplete`:'审计材料 ZIP 已保存 / Saved';
  }catch(e){$('auditExportStatus').textContent=e.message;}finally{auditExportBusy=false;$('auditExcel').disabled=$('auditBundle').disabled=!netcareAuditRows(auditRecords).length;}};
  const formatBytes=n=>(n/1048576).toFixed(1)+' MB';
  const selectedSnapshots=()=>Array.from($('snapshotRows').querySelectorAll('input:checked')).map(e=>e.value);
  async function refreshHistory(){const history=await netcareArtifactRequest({action:'history'}),select=$('snapshotSelect');select.replaceChildren();const current=document.createElement('option');current.value='';current.textContent=tr('当前结果','Current results');select.append(current);for(const item of history){const option=document.createElement('option');option.value=item.id;option.textContent=new Date(item.created).toLocaleString(uiLanguage==='zh'?'zh-CN':'en-GB')+' · '+(item.label||item.orders.join(', '))+' · '+item.checks;select.append(option);}select.value=activeSnapshot;return history;}
  $('snapshotSelect').onchange=async()=>{try{const id=$('snapshotSelect').value;if(id){const data=await netcareArtifactRequest({action:'snapshot',snapshotId:id});auditRecords=data.records;activeSnapshot=id;}else{activeSnapshot='';auditRecords=liveAuditRecords;}renderAudits();$('auditExportStatus').textContent=tr('已载入，导出包含本快照材料','Loaded; exports use this snapshot’s files');}catch(e){$('auditExportStatus').textContent=e.message;}};
  $('snapshotSave').onclick=async()=>{try{if(activeSnapshot)throw Error(tr('当前正在查看历史快照，请先切换当前结果','Switch to current results before saving'));$('snapshotSave').disabled=true;const id=await netcareArtifactRequest({action:'save-snapshot',label:liveAuditRecords.map(r=>r.order).join(', ')});await refreshHistory();$('auditExportStatus').textContent=tr('快照已保存','Snapshot saved');}catch(e){$('auditExportStatus').textContent=e.message;}finally{$('snapshotSave').disabled=false;}};
  async function previewCleanup(){const result=await netcareArtifactRequest({action:'cleanup-preview',ids:selectedSnapshots()});$('cleanupPreview').textContent=tr(`已选择 ${result.count} 个快照 · 预计释放 ${formatBytes(result.released)} · 清理后 ${formatBytes(result.remaining)}`,`${result.count} selected · Releases ${formatBytes(result.released)} · Remaining ${formatBytes(result.remaining)}`);return result;}
  async function refreshStorage(){const [stats,history]=await Promise.all([netcareArtifactRequest({action:'stats'}),refreshHistory()]);$('storageUsage').textContent=tr(`审计存储约 ${formatBytes(stats.used)} / ${formatBytes(stats.capacity)} · ${stats.snapshots} 个快照 · ${stats.files} 个材料 · 配置 ${formatBytes(stats.configurationBytes||0)}`,`Audit storage ≈ ${formatBytes(stats.used)} / ${formatBytes(stats.capacity)} · ${stats.snapshots} snapshots · ${stats.files} files · Config ${formatBytes(stats.configurationBytes||0)}`);$('storageMeter').value=stats.used/stats.capacity;$('storageCapacity').value=Math.floor(stats.capacity/1048576);$('storageCapacity').max=Math.floor(stats.maximum/1048576);const old=new Set(selectedSnapshots());$('snapshotRows').replaceChildren();for(const s of history){const label=document.createElement('label');label.className='field-row';const input=document.createElement('input');input.type='checkbox';input.value=s.id;input.checked=old.has(s.id);input.onchange=()=>previewCleanup().catch(e=>$('storageMessage').textContent=e.message);const title=document.createElement('span');title.textContent=new Date(s.created).toLocaleString(uiLanguage==='zh'?'zh-CN':'en-GB')+' · '+(s.label||s.orders.join(', '))+' · '+s.checks+' '+tr('个审计点',s.checks===1?'check':'checks');label.append(title,input);$('snapshotRows').append(label);}await previewCleanup();}
  $('storageRefresh').onclick=()=>refreshStorage().catch(e=>$('storageMessage').textContent=e.message);
  $('snapSelectAll').onclick=()=>{$('snapshotRows').querySelectorAll('input').forEach(e=>e.checked=true);previewCleanup().catch(e=>$('storageMessage').textContent=e.message);};
  $('snapSelectNone').onclick=()=>{$('snapshotRows').querySelectorAll('input').forEach(e=>e.checked=false);previewCleanup().catch(e=>$('storageMessage').textContent=e.message);};
  $('storageApply').onclick=async()=>{try{const stats=await netcareArtifactRequest({action:'stats'}),bytes=Number($('storageCapacity').value)*1048576;if(bytes<stats.used&&!confirm(tr('降低容量将立即删除最旧快照和材料。请先备份所需快照。继续？','Reducing capacity removes oldest snapshots and materials. Back up first. Continue?')))return;await netcareArtifactRequest({action:'configure',bytes});await refreshStorage();$('storageMessage').textContent=tr('容量已保存','Capacity saved');}catch(e){$('storageMessage').textContent=e.message;}};
  $('snapshotDelete').onclick=async()=>{try{const ids=selectedSnapshots(),p=await previewCleanup();if(!p.count)return;if(!confirm(tr(`删除 ${p.count} 个快照及不再引用的材料，预计释放 ${formatBytes(p.released)}？`,`Delete ${p.count} snapshots and unreferenced files, freeing ${formatBytes(p.released)}?`)))return;await netcareArtifactRequest({action:'cleanup',ids});if(ids.includes(activeSnapshot)){activeSnapshot='';auditRecords=liveAuditRecords;renderAudits();}await refreshStorage();}catch(e){$('storageMessage').textContent=e.message;}};
  $('snapshotBackup').onclick=async()=>{const ids=selectedSnapshots();if(!ids.length)return;$('snapshotBackup').disabled=$('snapshotDelete').disabled=$('storageApply').disabled=true;try{const entries=[];let totalBytes=0;for(const id of ids){const s=await netcareArtifactRequest({action:'snapshot',snapshotId:id}),files=await netcareArtifactRequest({action:'list',orders:s.records.map(r=>r.order),snapshotId:id});totalBytes+=files.reduce((n,f)=>n+f.size,0);if(totalBytes>512*1048576)throw Error(tr('单次备份超过512MB，请减少选择并分批下载','This backup exceeds 512MB. Select fewer snapshots and download in batches.'));const bundle=await netcareAuditMaterials(s.records,files,async f=>{const chunks=[];for(let index=0;index<f.count;index++){const data=await netcareArtifactRequest({action:'read',fileId:f.id,order:f.order,index,snapshotId:id});chunks.push(Uint8Array.from(atob(data),c=>c.charCodeAt(0)));}return new Blob(chunks);});const prefix=new Date(s.created).toISOString().replace(/[:.]/g,'-')+'_'+id+'/';entries.push({name:prefix+'snapshot.json',blob:new Blob([JSON.stringify(s,null,2)],{type:'application/json'})},...bundle.entries.map(e=>({...e,name:prefix+e.name})));$('storageMessage').textContent=tr(`正在打包 ${entries.length} 个文件`,`Packing ${entries.length} files`);}saveAuditFile(await createNetcareZip(entries),'NetCare-audit-snapshots-'+new Date().toISOString().slice(0,10)+'.zip');$('storageMessage').textContent=tr('备份已发起保存，请在下载记录确认后清理','Backup save initiated. Confirm in downloads before deleting.');}catch(e){$('storageMessage').textContent=e.message;}finally{$('snapshotBackup').disabled=$('snapshotDelete').disabled=$('storageApply').disabled=false;}};
  $('auditResultsButton').onclick=()=>{renderAudits();refreshHistory().catch(e=>$('auditExportStatus').textContent=e.message);auditDialog.showModal();};$('auditSummaryClose').onclick=()=>auditDialog.close();
  const tabs=[$('generalTab'),$('sectionsTab'),$('storageTab'),$('aiTab')], panes=[$('generalSettings'),$('chapterSettings'),$('storageSettings'),$('aiSettings')];
  const showTab = index => {if(index===2)refreshStorage().catch(e=>$('storageMessage').textContent=e.message);root.querySelector('.modal-body').scrollTop=0;tabs.forEach((tab,i)=>{tab.tabIndex=i===index?0:-1;tab.setAttribute('aria-selected',String(i===index));panes[i].hidden=i!==index;});};
  tabs.forEach((tab,index)=>{tab.onclick=()=>showTab(index);tab.onkeydown=event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowLeft'?tabs.length-1:1))%tabs.length;showTab(next);tabs[next].focus();}};});
  $('settingsButton').onclick = () => { renderSettings(); $('settingsStatus').textContent = '修改后保存生效 / Save to apply'; showTab(0); dialog.showModal(); };
  const cancelSettings = () => { dialog.close(); renderSettings(); };
  $('settingsClose').onclick = $('cancelSettings').onclick = cancelSettings;
  dialog.addEventListener('cancel', () => renderSettings());
  $('exportSettings').onclick = () => {
    try { const blob = new Blob([netcareExportSettings(readSettings())], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = 'netcare-rfc-settings.json'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); $('settingsStatus').textContent = '配置已导出 / Exported';
    } catch (error) { $('settingsStatus').textContent = error.message; }
  };
  $('importSettings').onclick = () => $('importFile').click();
  $('importFile').onchange = async () => {
    const file = $('importFile').files[0]; if (!file) return;
    try { if (file.size > 2097152) throw new Error('配置文件超过2MB'); const draft = netcareImportSettings(await file.text()), saved = extractionSettings;
      extractionSettings = draft; renderSettings(); extractionSettings = saved; $('settingsStatus').textContent = '配置已导入草稿，请保存 / Imported; save to apply';
    } catch (error) { $('settingsStatus').textContent = `导入失败 / Import failed: ${error.message}`; }
    finally { $('importFile').value = ''; }
  };
  renderSettings();
  const settingsTimer = setInterval(() => { if (!settingsLoaded) window.postMessage({ source: 'TP_RFC_SETTINGS_GET' }, location.origin); }, 1500);
  window.postMessage({ source: 'TP_RFC_SETTINGS_GET' }, location.origin);
  const visible = element => element && element.getClientRects().length > 0
    && element.ownerDocument.defaultView.getComputedStyle(element).visibility !== 'hidden';
  const post = (connection, message) => connection.frame.contentWindow.postMessage({ channel: CHANNEL, ...message }, connection.origin);
  const wait = async (fn, ms, signal, failure) => {
    const start = Date.now();
    while (Date.now() - start < ms) {
      if (signal.aborted) throw new Error('已停止等待');
      const value = fn();
      if (value) return value;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error(failure);
  };
  const detail = order => Array.from(document.querySelectorAll('iframe')).find(frame => {
    try {
      const u = new URL(frame.src, location.href);
      const hash = u.hash;
      return visible(frame) && u.origin === location.origin && u.pathname.includes('/rfc/network_tuning/')
        && new URLSearchParams(hash.split('?')[1] || '').get('orderid') === order
        && frame.contentDocument?.readyState === 'complete'
        && Array.from(frame.contentDocument.querySelectorAll('input')).some(input => input.value === order);
    } catch { return false; }
  });
  const rows = new Map(), onlineRequests = new Map();
  const update = (order, text) => {
    const row = rows.get(order);
    if (row) row.status.textContent = `${order} · ${translate(text)}`;
  };
  const receive = event => {
    if (event.source === window && event.origin === location.origin
      && event.data?.source === 'EXTENSION_POPUP' && event.data.action === 'STOP') {
      cleanup();
      return;
    }
    if(event.source===window&&event.origin===location.origin&&event.data?.source==='TP_RFC_LANGUAGE'){setLanguage(event.data.language);return;}
    if(event.source===window&&event.origin===location.origin&&event.data?.source==='TP_RFC_AUDIT_SUMMARIES'){
      if(Array.isArray(event.data.records)){liveAuditRecords=event.data.records.filter(r=>r&&Array.isArray(r.reports)&&Array.isArray(r.items)).slice(-5);if(!activeSnapshot)auditRecords=liveAuditRecords;refreshHistory().catch(()=>{});renderAudits();if(event.data.updated&&auditRecords.length&&!dialog.open&&!auditDialog.open)auditDialog.showModal();}return;
    }
    if (event.source === window && event.origin === location.origin && event.data?.source === 'TP_RFC_SETTINGS_RESULT') {
      if (!event.data.ok) { $('settingsStatus').textContent = event.data.error || '设置保存失败'; return; }
      if(typeof event.data.backupPageUrl==='string'){try{const u=new URL(event.data.backupPageUrl);if(u.protocol==='chrome-extension:'&&u.pathname==='/netcare-backup.html'&&$('backupFrame').getAttribute('src')!==u.href)$('backupFrame').src=u.href;}catch{}}
      if(typeof event.data.aiPageUrl==='string') {try{const u=new URL(event.data.aiPageUrl);if(u.protocol==='chrome-extension:'&&u.pathname==='/netcare-ai.html'){if($('aiFrame').getAttribute('src')!==u.href)$('aiFrame').src=u.href;$('aiFrameStatus').textContent='';}}catch{}}
      try { extractionSettings = netcareNormalizeSettings(event.data.settings || netcareDefaultSettings()); settingsLoaded = true; clearInterval(settingsTimer); renderSettings(); if (event.data.saved) dialog.close(); $('settingsStatus').textContent = event.data.saved ? '已保存，下次在线打开时生效 / Saved' : '默认设置已载入 / Loaded'; } catch (error) { $('settingsStatus').textContent = error.message; }
      return;
    }
    if (event.source === window && event.origin === location.origin && event.data?.source === 'TP_RFC_OPEN_RESULT') {
      const request = onlineRequests.get(event.data.id);
      if (request) event.data.ok ? request.resolve() : request.reject(new Error(event.data.error || '在线页签打开失败'));
      else if(event.data.ok){const row=[...rows.values()].find(r=>r.onlineRequestId===event.data.id);if(row?.online.querySelector('a')){const link=row.online.querySelector('a');row.online.replaceChildren(link,document.createTextNode(tr(' · 已新开页签',' · Tab opened')));}}
      return;
    }
    const connection = bridges.get(event.origin);
    if (!connection || event.source !== connection.frame.contentWindow || event.data?.channel !== CHANNEL) return;
    const message = event.data;
    if (message.type === 'ready') {
      connection.connected = true;
      $('connection').textContent = '导出服务：已连接 / Connected';
      return;
    }
    const job = jobs.get(message.job);
    if (!job || job.connection !== connection) return;
    if (message.type === 'progress') update(job.order, message.text);
    else if (message.type === 'done') {
      if (typeof message.filename === 'string') window.postMessage({ source: 'TP_RFC_WORD_FILENAME', order: job.order, filename: message.filename }, location.origin);
      job.resolve(message.text);
    }
    else if (message.type === 'error') job.reject(new Error(message.text));
  };
  window.addEventListener('message', receive);
  window.postMessage({source:'TP_RFC_AUDIT_GET'},location.origin);
  async function openOnline(order, doc, button, signal) {
    const row = rows.get(order);
    row.online.textContent = '在线方案：正在获取原生入口… / Opening online…';
    let openedInline = false;
    try {
      const title = button.closest('tr')?.querySelector('td:first-child .nt-table-link');
      if (!title) throw new Error('未找到方案名称入口');
      const oldFrame = doc.querySelector('iframe#IdpFrame');
      if (oldFrame && visible(oldFrame)) throw new Error('请先返回 RFC 信息再打开方案');
      title.click();
      openedInline = true;
      const native = await wait(() => {
        const item = doc.querySelector('iframe#IdpFrame');
        if (!item || !visible(item)) return null;
        try {
          const u = new URL(item.src);
          return u.protocol === 'https:' && /(^|\.)kdp\.gts\.huawei\.com$/.test(u.hostname)
            && u.pathname === '/ows1/static/editor/IdpLiteView/OwsPage.html'
            && u.searchParams.get('docId') === order && u.searchParams.get('order_id') === order ? u : null;
        } catch { return null; }
      }, 45000, signal, '在线方案入口未打开，请检查网站授权提示');
      // Keep a native link even if extension relay permissions are unavailable.
      const link = document.createElement('a');
      link.href = native.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = `${order} · 在线方案 / Online solution`;
      link.style.cssText = 'color:#368cff';
      row.online.replaceChildren(link);
      const id = crypto.randomUUID();row.onlineRequestId=id;
      await new Promise((resolve, reject) => {
        let timer;
        const finish = (fn, value) => {
          clearTimeout(timer);
          signal.removeEventListener('abort', abort);
          onlineRequests.delete(id);
          fn(value);
        };
        const abort = () => settle(reject, new Error('已停止等待'));
        let settled=false,failureTimer;const settle=(fn,value)=>{if(settled)return;settled=true;clearTimeout(failureTimer);finish(fn,value);};onlineRequests.set(id,{resolve:()=>settle(resolve),reject:error=>{if(!failureTimer)failureTimer=setTimeout(()=>settle(reject,error),2000);}});
        signal.addEventListener('abort', abort, { once: true });
        timer = setTimeout(() => settle(reject, new Error('扩展未响应，可点击上方链接手动打开')), 15000);
        if (signal.aborted) abort();
        else window.postMessage({ source: 'TP_RFC_OPEN_REQUEST', id, order, url: native.href }, location.origin);
      });
      row.online.append(document.createTextNode(' · 已新开页签 / Tab opened'));
    } catch (error) {
      row.online.append(document.createTextNode(` · 新页签状态未确认 / Tab status unconfirmed: ${error.message}`));
    } finally {
      if (openedInline) {
        const back = Array.from(doc.querySelectorAll('.solution_normal_text')).find(item => item.textContent.trim() === '返回RFC/HC');
        back?.click();
      }
    }
  }
  async function prepare(order, signal) {
    const log = text => update(order, text);
    let frame = detail(order);
    if (!frame) {
      log('通过网站原生搜索定位作业单…');
      const input = document.querySelector('input[placeholder="请输入单号"]');
      const search = input?.closest('.search-input')?.querySelector('button.search-icon');
      if (!input || !search) throw new Error('未找到单号搜索入口，请在 NetCare 主页面执行');
      const previous = input.value;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, order);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await Promise.resolve();
      search.click();
      frame = await wait(() => detail(order), 45000, signal, '未找到可访问的作业单；请检查单号、登录及页面提示');
      // Restore the original search input without submitting another query.
      if (input.isConnected) {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, previous);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    const doc = frame.contentDocument;
    const buttons = await wait(() => {
      const found = Array.from(doc.querySelectorAll('.v-icon-dolwnload-1')).filter(visible);
      return found.length ? found : null;
    }, 30000, signal, '没有可下载的方案；请检查方案信息及权限');
    let button = buttons[0];
    if (buttons.length > 1) {
      update(order, '请选择方案 / Choose solution');
      $('plans').replaceChildren(...buttons.map((item, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = item.closest('tr')?.querySelector('td')?.textContent.trim() || `方案 ${index + 1}`;
        return option;
      }));
      $('plans').hidden = $('choose').hidden = false;
      await new Promise((resolve, reject) => {
        const abort = () => { $('choose').onclick = null; reject(new Error('已停止等待')); };
        signal.addEventListener('abort', abort, { once: true });
        $('choose').onclick = () => { signal.removeEventListener('abort', abort); resolve(); };
        if (signal.aborted) abort();
      });
      button = buttons[Number($('plans').value)];
      $('plans').hidden = $('choose').hidden = true;
    }
    log('调用网站原生下载入口，检查授权…');
    const oldExport = doc.querySelector('iframe[src*="PublishLiteView.html"]');
    if (oldExport && visible(oldExport)) throw new Error('请先关闭页面已有的导出弹窗，再重试（避免使用旧单号）');
    button.click();
    const nativeFrame = await wait(() => {
      const item = doc.querySelector('iframe[src*="PublishLiteView.html"]');
      if (!item || !visible(item)) return null;
      const u = new URL(item.src, location.href);
      return validExport(u.href) && u.searchParams.get('id') === order ? item : null;
    }, 45000, signal, '未进入数字化方案导出页；可能需要处理授权提示，或该方案是离线附件');
    const url = new URL(nativeFrame.src, location.href);
    let connection = bridges.get(url.origin);
    if (!connection || !connection.frame.isConnected) {
      const bridge = document.createElement('iframe');
      bridge.name = 'rfc-word-worker';
      bridge.title = 'RFC Word 导出服务连接';
      bridge.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;border:0;opacity:.01;pointer-events:none';
      bridge.src = url.href;
      connection = { frame: bridge, origin: url.origin, connected: false };
      bridges.set(url.origin, connection);
      document.body.append(bridge);
      $('connection').textContent = '导出服务：等待初始化';
    }
    doc.querySelector('button.nc-close')?.click();
    if ($('openOnline').checked) await openOnline(order, doc, button, signal);
    post(connection, { type: 'hello' });
    await wait(() => connection.connected, 60000, signal, '自动连接失败，请检查导出服务登录状态和扩展的网站权限');
    return connection;
  }
  function transfer(order, connection, signal) {
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      let timer;
      const finish = (fn, value) => {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
        jobs.delete(id);
        fn(value);
      };
      const abort = () => {
        post(connection, { type: 'cancel', job: id });
        finish(reject, new Error('已停止等待'));
      };
      jobs.set(id, { order, connection, resolve: value => finish(resolve, value), reject: error => finish(reject, error) });
      signal.addEventListener('abort', abort, { once: true });
      timer = setTimeout(() => {
        post(connection, { type: 'cancel', job: id });
        finish(reject, new Error('等待导出响应超时，请检查连接后重试'));
      }, 13 * 60 * 1000);
      if (signal.aborted) abort();
      else post(connection, { type: 'run', job: id, order });
    });
  }
  async function start() {
    if (active) return;
    if (!settingsLoaded) { log('请等待默认提取设置加载，或重新启动扩展'); return; }
    $('concurrency').value = extractionSettings.concurrency; $('openOnline').checked = extractionSettings.openOnline || extractionSettings.attachmentsEnabled || extractionSettings.textEnabled;
    let orders;
    try { orders = parseNetcareRfcOrders($('order').value); }
    catch (error) { log(error.message); return; }
    const controller = new AbortController();
    active = controller;
    $('order').value = orders.join('\n');
    $('run').disabled = $('order').disabled = $('concurrency').disabled = $('openOnline').disabled = true;
    $('stop').disabled = false;
    $('log').textContent = `共 ${orders.length} 单 · 并发 ${$('concurrency').value} / RFC batch`;
    rows.clear();
    $('results').replaceChildren(...orders.map(order => {
      const row = document.createElement('div');
      row.style.cssText = 'font-size:12px;padding:6px 0;border-bottom:1px solid #8883;overflow-wrap:anywhere';
      const status = document.createElement('div'), online = document.createElement('div');
      status.textContent = `${order} · 排队 / Queued`;
      online.style.fontSize = '11px';
      row.append(status, online);
      rows.set(order, { status, online });
      return row;
    }));
    try {
      const results = await executeNetcareRfcBatch(orders, Number($('concurrency').value), controller.signal,
        prepare, transfer, (order, result) => update(order, result.ok ? result.value : (controller.signal.aborted ? result.error : `失败 / Failed: ${result.error}`)));
      const success = results.filter(result => result.ok).length;
      log(`已发起保存 ${success} / ${orders.length}；其余 ${orders.length - success} 单失败或停止。请在 Chrome 下载记录中确认。`);
    } finally {
      active = null;
      $('run').disabled = $('order').disabled = $('concurrency').disabled = $('openOnline').disabled = false;
      $('stop').disabled = true;
      $('plans').hidden = $('choose').hidden = true;
      $('choose').onclick = null;
    }
  }
  $('run').onclick = start;
  $('order').onkeydown = event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); start(); } };
  $('stop').onclick = () => active?.abort();
  const cleanup = () => {
    active?.abort();localization?.stop();
    window.removeEventListener('message', receive);
    clearInterval(settingsTimer); dialog.close();auditDialog.close();
    bridges.forEach(connection => connection.frame.remove());
    host.remove();
  };
  window.__rfcWordPanelCleanup = cleanup;
  $('close').onclick = cleanup;
  const header = root.querySelector('header');
  header.onpointerdown = event => {
    if (event.target.closest('button')) return;
    const rect = host.getBoundingClientRect();
    const offsetX = event.clientX - rect.left, offsetY = event.clientY - rect.top;
    header.setPointerCapture(event.pointerId);
    header.onpointermove = move => {
      host.style.right = host.style.bottom = 'auto';
      host.style.left = Math.max(0, Math.min(innerWidth - rect.width, move.clientX - offsetX)) + 'px';
      host.style.top = Math.max(0, Math.min(innerHeight - rect.height, move.clientY - offsetY)) + 'px';
    };
    header.onpointerup = header.onpointercancel = () => { header.onpointermove = null; };
  };
  const current = Array.from(document.querySelectorAll('iframe')).map(frame => {
    try { return new URLSearchParams(new URL(frame.src).hash.split('?')[1]).get('orderid'); }
    catch { return null; }
  }).find(validOrder);
  if (current) $('order').value = current;
  console.info('RFC Word 下载扩展已加载 / Extension loaded.');
})();
