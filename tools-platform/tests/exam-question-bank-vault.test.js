const test = require('node:test');
const assert = require('node:assert/strict');
const createVault = require('../backend/builtin-tools/f12-to-extension/exam-vault.js');
const core = createVault();
function nativeStore(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {get length(){return values.size},key:index=>[...values.keys()][index]||null,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
}
const bank = JSON.stringify([{id:'q1',题型:'单选题',题目:'Private question sentinel',选项:['A','B'],正确答案:['A'],AI学习解析:{explanation:'Study note sentinel'}}]);
test('vault ciphertext hides bank data, rejects wrong passwords and authenticated metadata tampering', async () => {
  const salt=core.newSalt(); const key=await core.derive('strong-password-sentinel',salt);
  const data={origins:{'https://a.example':{revision:0,items:{ScraperData_Exam:bank}}}};
  const record=await core.encrypt(key,data,salt,0); const second=await core.encrypt(key,data,salt,0);
  assert.notEqual(record.iv,second.iv);assert.notEqual(record.ciphertext,second.ciphertext);
  for(const secret of ['Private question sentinel','Study note sentinel','strong-password-sentinel','ScraperData_Exam'])assert.ok(!JSON.stringify(record).includes(secret));
  assert.deepEqual(await core.decrypt(key,record),data);
  const wrong=await core.derive('other-password-sentinel',salt);await assert.rejects(core.decrypt(wrong,record));
  await assert.rejects(core.decrypt(key,{...record,revision:1}));
  await assert.rejects(core.decrypt(key,{...record,ciphertext:record.ciphertext.slice(0,-4)+'AAAA'}));
});
test('legacy migration preserves collisions and malformed records, deletes plaintext only after verified persistence', async () => {
  const source=nativeStore({ScraperData_Exam:bank,ScraperData_Broken:'{broken',websiteSession:'unrelated'});
  const written=[];const storage=core.adapter({ScraperData_Exam:'[]'},async items=>written.push(items));
  const result=await core.migrate(storage,source);
  assert.equal(result.migrated,1);assert.equal(result.collisions,1);assert.equal(result.malformed,1);
  assert.equal(storage.getItem('ScraperData_Exam'),'[]');assert.equal(storage.getItem('ScraperData_Exam (旧题库迁移)'),bank);
  assert.equal(source.getItem('ScraperData_Exam'),null);assert.equal(source.getItem('ScraperData_Broken'),'{broken');assert.equal(source.getItem('websiteSession'),'unrelated');assert.ok(written.length);
  const failedSource=nativeStore({ScraperData_Exam:bank}); const failed=core.adapter({},async()=>{throw new Error('quota failure')});await assert.rejects(core.migrate(failed,failedSource));assert.equal(failedSource.getItem('ScraperData_Exam'),bank);assert.equal(failed.getItem('ScraperData_Exam'),bank);
});
test('multi-bank cache transaction is saved as one snapshot; failure retains an exportable cache and blocks further writes', async () => {
  let calls=0;const storage=core.adapter({},async items=>{calls++;assert.equal(items.ScraperData_A,'[]');assert.equal(items.ScraperData_B,'[]')});
  storage.setItems({ScraperData_A:'[]',ScraperData_B:'[]'});await storage.flush();assert.equal(calls,1);
  const failed=core.adapter({},async()=>{throw new Error('CONFLICT')});failed.setItem('ScraperData_A',bank);await assert.rejects(failed.flush(),/CONFLICT/);assert.equal(failed.snapshot().ScraperData_A,bank);failed.dispose();assert.equal(failed.getItem('ScraperData_A'),null);assert.throws(()=>failed.setItem('ScraperData_A','[]'),/LOCKED/);
});
function background(locale = 'en-US') {
  const records={};const sessions={};const listeners=[];const created=[];let windows=0;
  const area=target=>({get:async key=>({[key]:target[key]}),set:async values=>Object.assign(target,structuredClone(values)),remove:async key=>{delete target[key]},setAccessLevel:async()=>{}});
  const chrome={i18n:{getUILanguage:()=>locale},storage:{local:area(records),session:area(sessions)},runtime:{id:'test-ext',getURL:path=>'chrome-extension://test-ext/'+path,onMessage:{addListener:fn=>listeners.push(fn)},sendMessage:async()=>({})},tabs:{query:async()=>[],sendMessage:async()=>({})},windows:{create:async options=>{created.push(options);return{id:++windows}},get:async id=>({id}),update:async()=>({}),onRemoved:{addListener(){}}}};
  const previous=global.chrome;global.chrome=chrome;core.background();global.chrome=previous;
  // Serialized worker callbacks read their global chrome when invoked.
  return {records,sessions,chrome,created,send:async(message,sender)=>{global.chrome=chrome;try{return await new Promise(resolve=>listeners[0](message,sender,resolve));}finally{global.chrome=previous;}}};
}
test('extension vault enforces trusted password entry, isolates origins, checks revisions and locks session keys', async () => {
  const bg=background();const unlock={id:'test-ext',url:'chrome-extension://test-ext/exam-vault.html'};
  const detail={id:'test-ext',url:'chrome-extension://test-ext/exam-details.html'};
  const site={id:'test-ext',url:'https://a.example/exam',tab:{id:1},frameId:0};
  const other={...site,url:'https://b.example/exam'};
  const denied=await bg.send({type:'TP_VAULT_UNLOCK',passwordMode:'complex',password:'Strong-vault-2026!'},site);assert.equal(denied.ok,false);
  assert.equal((await bg.send({type:'TP_VAULT_UNLOCK',passwordMode:'complex',password:'Strong-vault-2026!'},unlock)).ok,true);
  assert.equal((await bg.send({type:'TP_VAULT_READ'},site)).revision,0);
  const saved=await bg.send({type:'TP_VAULT_WRITE',revision:0,items:{ScraperData_Exam:bank}},site);assert.equal(saved.ok,true);assert.equal(saved.revision,1);
  assert.equal((await bg.send({type:'TP_VAULT_READ'},other)).items.ScraperData_Exam,undefined);
  const stale=await bg.send({type:'TP_VAULT_WRITE',revision:0,items:{}},site);assert.match(stale.error,/CONFLICT/);
  const backup=await bg.send({type:'TP_VAULT_EXPORT',origin:'https://a.example'},detail);assert.equal(backup.backup.format,'tp-exam-encrypted-backup');
  assert.equal((await bg.send({type:'TP_VAULT_IMPORT',origin:'https://a.example',record:backup.backup.record},detail)).data.origins['https://a.example'].items.ScraperData_Exam,bank);
  assert.ok(!JSON.stringify(bg.records).includes('Private question sentinel'));assert.ok(!JSON.stringify(bg.records).includes('Strong-vault-2026!'));
  assert.equal((await bg.send({type:'TP_VAULT_LOCK'},site)).ok,true);assert.equal(bg.sessions[core.SESSION],undefined);assert.equal((await bg.send({type:'TP_VAULT_READ'},site)).error,'LOCKED');
  const unchanged=JSON.stringify(bg.records);assert.equal((await bg.send({type:'TP_VAULT_UNLOCK',password:'incorrect-password'},unlock)).ok,false);assert.equal(JSON.stringify(bg.records),unchanged);
  assert.equal((await bg.send({type:'TP_VAULT_UNLOCK',passwordMode:'complex',password:'Strong-vault-2026!'},unlock)).ok,true);assert.equal((await bg.send({type:'TP_VAULT_READ'},site)).items.ScraperData_Exam,bank);
});
test('new password policy requires length and requested character types; shuffling preserves every key', () => {
  for (const password of ['Short-2026!', 'abcdefghijklmnop!', 'abcdefghijklmnop1', '1234567890123456!', 'abcdefghijklmnop ']) assert.ok(core.passwordError(password));
  assert.equal(core.passwordError('long-passphrase-2026!'), '');
  assert.ok(core.passwordError('a'.repeat(1025) + '1!'));
  const keys = 'abcdefghijklmnopqrstuvwxyz0123456789!@#';
  for (let i = 0; i < 20; i++) assert.equal(core.shuffledKeys(keys).sort().join(''), Array.from(keys).sort().join(''));
});
test('worker rejects weak new passwords without writing and unlocks legacy passwords unchanged', async () => {
  const bg = background(); const sender = { id: 'test-ext', url: 'chrome-extension://test-ext/exam-vault.html' };
  assert.equal((await bg.send({type:'TP_VAULT_UNLOCK',password:'old-password'}, sender)).ok, false);
  assert.equal(bg.records[core.RECORD], undefined); assert.equal(bg.sessions[core.SESSION], undefined);
  const legacy = '旧密码-abcdefgh'; const salt = core.newSalt(); const key = await core.derive(legacy, salt);
  bg.records[core.RECORD] = await core.encrypt(key, { origins: { 'https://a.example': {revision:0,items:{ScraperData_Exam:bank}} } }, salt, 0);
  const before = JSON.stringify(bg.records);
  assert.equal((await bg.send({type:'TP_VAULT_UNLOCK',password:legacy}, sender)).ok, true);
  assert.equal(JSON.stringify(bg.records), before);
});
test('default six-digit PIN survives writes, encrypted backups and unlock; mode metadata is authenticated', async () => {
  const bg=background(); const unlock={id:'test-ext',url:'chrome-extension://test-ext/exam-vault.html'};
  const detail={id:'test-ext',url:'chrome-extension://test-ext/exam-details.html'};
  const site={id:'test-ext',url:'https://a.example/exam',tab:{id:1}};
  assert.equal((await bg.send({type:'TP_VAULT_STATE'},unlock)).passwordMode,'pin');
  for(const pin of ['12345','1234567','12345a','123 56']) {
    assert.ok(core.passwordError(pin,'pin'));assert.equal((await bg.send({type:'TP_VAULT_UNLOCK',password:pin},unlock)).ok,false);
    assert.equal(bg.records[core.RECORD],undefined);
  }
  assert.equal(core.passwordError('012345','pin'),'');
  assert.equal((await bg.send({type:'TP_VAULT_UNLOCK',password:'012345'},unlock)).ok,true);
  assert.equal((await bg.send({type:'TP_VAULT_STATE'},unlock)).passwordMode,'pin');
  assert.equal((await bg.send({type:'TP_VAULT_WRITE',revision:0,items:{ScraperData_Exam:bank}},site)).ok,true);
  assert.equal(bg.records[core.RECORD].passwordMode,'pin');
  const exported=await bg.send({type:'TP_VAULT_EXPORT',origin:'https://a.example'},detail);
  assert.equal(exported.backup.record.passwordMode,'pin');
  assert.equal((await bg.send({type:'TP_VAULT_IMPORT',origin:'https://a.example',record:exported.backup.record,password:'012345'},detail)).data.origins['https://a.example'].items.ScraperData_Exam,bank);
  const key=await core.derive('012345',bg.records[core.RECORD].salt);
  await assert.rejects(core.decrypt(key,{...bg.records[core.RECORD],passwordMode:'complex'}));
  const noMode={...bg.records[core.RECORD]};delete noMode.passwordMode;await assert.rejects(core.decrypt(key,noMode));
  await bg.send({type:'TP_VAULT_LOCK'},site);
  assert.equal((await bg.send({type:'TP_VAULT_UNLOCK',password:'012345'},unlock)).ok,true);
  assert.equal((await bg.send({type:'TP_VAULT_READ'},site)).items.ScraperData_Exam,bank);
});
test('browser language initializes the locked vault and a manual choice persists across unlock and lock', async () => {
  for(const locale of ['zh','zh-CN','zh-TW','zh_Hans'])assert.equal(core.detectLanguage(locale),'zh');
  for(const locale of ['en-US','fr-FR','ja-JP'])assert.equal(core.detectLanguage(locale),'en');
  const bg=background('zh-CN');const unlock={id:'test-ext',url:'chrome-extension://test-ext/exam-vault.html'};
  const site={id:'test-ext',url:'https://a.example/exam',tab:{id:1}};
  assert.equal((await bg.send({type:'TP_VAULT_STATE'},unlock)).language,'zh');
  assert.equal((await bg.send({type:'TP_VAULT_LANGUAGE',language:'en'},unlock)).language,'en');
  assert.equal((await bg.send({type:'TP_VAULT_STATE'},unlock)).language,'en');
  assert.equal(bg.records[core.RECORD],undefined);
  assert.equal((await bg.send({type:'TP_VAULT_LANGUAGE',language:'invalid'},site)).ok,false);
  assert.equal((await bg.send({type:'TP_VAULT_UNLOCK',password:'012345'},unlock)).ok,true);
  assert.equal((await bg.send({type:'TP_VAULT_READ'},site)).language,'en');
  await bg.send({type:'TP_VAULT_LANGUAGE',language:'zh'},site);await bg.send({type:'TP_VAULT_LOCK'},site);
  assert.equal((await bg.send({type:'TP_VAULT_STATE'},unlock)).language,'zh');
});
test('one-click import handoff is encrypted, origin-bound, one-use and never writes the bank before confirmation', async () => {
  const bg=background();const unlock={id:'test-ext',url:'chrome-extension://test-ext/exam-vault.html'};
  const site={id:'test-ext',url:'https://a.example/exam',tab:{id:1}};
  await bg.send({type:'TP_VAULT_UNLOCK',password:'012345'},unlock);
  const before=JSON.stringify(bg.records[core.RECORD]);
  const file={name:'private.json',text:bank};
  assert.equal((await bg.send({type:'TP_VAULT_DETAILS',name:'Exam',view:'import',file},site)).ok,true);
  const url=bg.created.at(-1).url;const ticket=new URL(url).searchParams.get('import');assert.ok(ticket);
  assert.ok(!JSON.stringify(bg.sessions).includes('Private question sentinel'));
  assert.equal(JSON.stringify(bg.records[core.RECORD]),before);
  assert.equal((await bg.send({type:'TP_VAULT_TAKE_IMPORT',ticket},site)).ok,false);
  const detail={id:'test-ext',url};
  assert.equal((await bg.send({type:'TP_VAULT_TAKE_IMPORT',ticket,origin:'https://b.example'},detail)).ok,false);
  const wrongPage={id:'test-ext',url:'chrome-extension://test-ext/exam-details.html?origin=https%3A%2F%2Fa.example'};
  assert.equal((await bg.send({type:'TP_VAULT_TAKE_IMPORT',ticket,origin:'https://a.example'},wrongPage)).ok,false);
  assert.deepEqual((await bg.send({type:'TP_VAULT_TAKE_IMPORT',ticket,origin:'https://a.example'},detail)).file,file);
  assert.equal((await bg.send({type:'TP_VAULT_TAKE_IMPORT',ticket,origin:'https://a.example'},detail)).ok,false);
  assert.equal(JSON.stringify(bg.records[core.RECORD]),before);
  await bg.send({type:'TP_VAULT_DETAILS',name:'Exam',view:'import',file},site);
  await bg.send({type:'TP_VAULT_LOCK'},site);assert.equal(bg.sessions[core.SESSION],undefined);
});
