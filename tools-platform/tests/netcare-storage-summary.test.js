const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('backend/builtin-tools/f12-to-extension/packer-core.js','utf8');
const start=source.indexOf("cache.stats().then(async stats=>");
const end=source.indexOf(";else if(main&&m.action==='clear-results')",start);
const expression=source.slice(start,end);
test('storage reconciles retained audit summaries separately from configuration and empty material cache',async()=>{
  const records=[{reports:[{},{}]},{reports:[{},{}]},{reports:[{},{}]}];
  let reads=0;
  const result=await vm.runInNewContext(expression,{cache:{stats:async()=>({used:64,files:0,snapshots:0})},chrome:{storage:{local:{get:async()=>({netcareAuditSummaries:records,settings:{apiKey:'must-not-return'}}),getBytesInUse:async key=>{reads++;return key===null?4096:3072;}}}}});
  assert.equal(result.auditResults.count,3);
  assert.equal(result.auditResults.checks,6);
  assert.equal(result.auditResults.bytes,3072);
  assert.equal(result.configurationBytes,1024);
  assert.equal(result.configurationCount,1);
  assert.equal(result.snapshots,0);
  assert.equal(reads,2);
  assert.ok(!JSON.stringify(result).includes('must-not-return'));
});
test('empty result cache remains zero without counting its absent storage key',async()=>{
  const result=await vm.runInNewContext(expression,{cache:{stats:async()=>({used:0})},chrome:{storage:{local:{get:async()=>({}),getBytesInUse:async()=>0}}}});
  assert.equal(result.auditResults.count,0);
  assert.equal(result.auditResults.bytes,0);
  assert.equal(result.configurationCount,0);
});
