const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('backend/builtin-tools/f12-to-extension/netcare-artifacts.js','utf8');
const method=source.slice(source.indexOf('    async cleanupMaterials('),source.indexOf('\n  };return api;'));
function fixture(){
  const settings=new Map([['log-buffer',{id:'log-buffer',events:[{at:1,message:'old'},{at:Date.now(),message:'new'}],dropped:0}]]);
  const files=[{id:'txt',size:100,category:'texts'}];
  const api=vm.runInNewContext('({'+method+'})',{
    request:async value=>value,metadataSize:value=>Buffer.byteLength(JSON.stringify(value)),refs:()=>new Set(),classify:f=>f.category,
    usage:all=>all.reduce((n,f)=>n+f.size,0),erase:(_,__,file)=>files.splice(files.findIndex(f=>f.id===file.id),1),
    transaction:async(_,fn)=>fn({getAll:()=>structuredClone(files)},null,{getAll:()=>[]},{get:key=>structuredClone(settings.get(key)),put:value=>settings.set(value.id,structuredClone(value)),delete:key=>settings.delete(key)})
  });
  return {api,settings};
}
test('repeated cleanup estimates do not mutate logs or accumulate bytes; clearing logs leaves zero log estimate',async()=>{
  const {api,settings}=fixture();const options={categories:['logs'],days:0};
  const a=await api.cleanupMaterials(options),b=await api.cleanupMaterials(options);
  assert.equal(a.released,b.released);assert.equal(a.logCount,2);assert.equal(settings.get('log-buffer').events.length,2);
  const removed=await api.cleanupMaterials(options,true);
  assert.equal(removed.released,a.released);assert.equal(removed.remaining,100);assert.equal(settings.has('log-buffer'),false);
  const after=await api.cleanupMaterials(options);assert.equal(after.released,0);assert.equal(after.logCount,0);
});
test('retention cleanup keeps recent logs and reports the same remaining bytes before and after execution',async()=>{
  const {api,settings}=fixture();const options={categories:['logs'],days:1};
  const preview=await api.cleanupMaterials(options),removed=await api.cleanupMaterials(options,true);
  assert.equal(preview.remaining,removed.remaining);assert.equal(removed.logCount,1);assert.equal(settings.get('log-buffer').events.length,1);
  const after=await api.cleanupMaterials(options);assert.equal(after.released,0);assert.equal(after.remaining,removed.remaining);
});
test('a slower old preview cannot overwrite the estimate for the latest category selection',async()=>{
  const ui=fs.readFileSync('backend/builtin-tools/f12-to-extension/netcare-rfc-word.js','utf8');
  const start=ui.indexOf('  let materialsPreviewGeneration=0;'),end=ui.indexOf('  async function refreshStorage()',start);
  const elements={materialsRetentionDays:{value:'0'},protectSnapshotRefs:{checked:true},materialsCleanupPreview:{textContent:''},materialsCleanupExecute:{disabled:false}};
  let selected=['logs'];const pending=[];
  const context=vm.createContext({$:id=>elements[id],selectedMaterialsCategories:()=>selected,netcareArtifactRequest:()=>new Promise(resolve=>pending.push(resolve)),tr:(zh)=>zh,formatBytes:n=>String(n)});
  vm.runInContext(ui.slice(start,end),context);
  const old=vm.runInContext('updateMaterialsCleanupPreview()',context);
  selected=['texts'];const latest=vm.runInContext('updateMaterialsCleanupPreview()',context);
  pending[1]({fileCount:1,logCount:0,released:200,remaining:20,count:1});await latest;
  const expected=elements.materialsCleanupPreview.textContent;
  pending[0]({fileCount:0,logCount:9,released:999,remaining:0,count:9});await old;
  assert.equal(elements.materialsCleanupPreview.textContent,expected);
  assert.ok(expected.includes('200'));
});
test('all cleanup UI producers are suppressed at the artifact store before any database write',async()=>{
  let opens=0;const api=require('../backend/builtin-tools/f12-to-extension/netcare-artifacts.js')({open(){opens++;throw Error('unexpected write');}});
  for(const control of ['cleanCatLogs','cleanCatScreenshots','cleanCatAttachments','cleanCatTexts','cleanCatBundles','materialsCleanupRefresh','materialsRetentionDays','protectSnapshotRefs'])for(const action of ['ui.click','ui.change']){
    assert.equal((await api.log({action,data:{control}})).ignored,true);
  }
  assert.equal(opens,0);
  await assert.rejects(api.log({action:'ui.change',data:{control:'concurrency'}}),/unexpected write|crypto/);
});
test('toggling empty categories repeatedly neither changes the log estimate nor adds bytes; category labels share its current read',async()=>{
  const {api,settings}=fixture();const first=await api.cleanupMaterials({categories:['logs']});
  for(const category of ['screenshots','attachments','bundles','screenshots','attachments']){
    const next=await api.cleanupMaterials({categories:['logs',category]});
    assert.equal(next.logCount,first.logCount);assert.equal(next.released,first.released);assert.equal(next.remaining,first.remaining);
    assert.equal(next.breakdown.logs.count,next.logCount);assert.equal(next.breakdown.logs.bytes,next.released);
  }
  settings.get('log-buffer').events.push({at:Date.now(),message:'real extraction event'});
  const latest=await api.cleanupMaterials({categories:['logs']});assert.equal(latest.logCount,3);assert.equal(latest.breakdown.logs.count,3);
});
