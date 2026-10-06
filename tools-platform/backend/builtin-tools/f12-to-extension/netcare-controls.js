/* Typed, inert mirror of the extension's own collector UI; never transports website HTML. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.createNetcareControls=factory;})(typeof globalThis!=='undefined'?globalThis:this,function createNetcareControls(){
  const tags=new Set(['section','header','div','span','label','input','button','details','summary','pre','small','p','strong','h2','h3','ul','li']);
  const actions=new Set(['click','input','check','toggle']);
  function validate(data){
    if(!data||typeof data.version!=='string'||data.version.length>80||!Number.isFinite(data.at)||JSON.stringify(data).length>220000)throw Error('Invalid collector panel');
    let count=0;const node=(n,depth)=>{if(++count>2200||depth>30||!n||typeof n!=='object')throw Error('Invalid panel nodes');if(typeof n.text==='string'){if(n.text.length>60000)throw Error('Panel text exceeds limit');return {text:n.text};}if(!tags.has(n.tag)||typeof n.key!=='string'||n.key.length>100)throw Error('Invalid panel element');const out={tag:n.tag,key:n.key,children:(n.children||[]).map(c=>node(c,depth+1))};for(const k of ['label','title','value','className'])if(n[k]!=null){if(typeof n[k]!=='string'||n[k].length>(k==='value'?300:500))throw Error('Invalid panel field');out[k]=n[k];}if(n.tag==='input'){if(!['text','checkbox'].includes(n.type))throw Error('Invalid panel input');out.type=n.type;}for(const k of ['disabled','checked','open'])if(n[k]!=null){if(typeof n[k]!=='boolean')throw Error('Invalid panel state');out[k]=n[k];}return out;};
    return {version:data.version,at:data.at,revision:Number.isSafeInteger(data.revision)&&data.revision>=0?data.revision:0,tree:data.tree?node(data.tree,0):null,dialog:data.dialog?node(data.dialog,0):null,closed:data.closed===true,truncated:data.truncated===true};
  }
  function command(value){if(!value||!actions.has(value.action)||typeof value.version!=='string'||value.version.length>80||typeof value.key!=='string'||value.key.length>100)throw Error('Invalid collector command');if(value.action==='input'&&(typeof value.value!=='string'||value.value.length>300)||['check','toggle'].includes(value.action)&&typeof value.value!=='boolean')throw Error('Invalid collector value');return {action:value.action,version:value.version,key:value.key,...(value.action==='click'?{}:{value:value.value})};}
  function source(root,options={}){
    const version=crypto.randomUUID(),keys=new WeakMap(),elements=new Map();let next=0,revision=0,closed=false;
    const key=el=>{if(!keys.has(el))keys.set(el,'c'+(++next));const k=keys.get(el);elements.set(k,el);return k;},redact=options.redact||String;
    function snapshot(){
      let nodes=0,bytes=0,truncated=false;
      const serialize=(el,depth=0)=>{if(++nodes>2000||depth>25||bytes>180000){truncated=true;return null;}if(el.nodeType===3){const text=redact(el.textContent).slice(0,50000);bytes+=text.length;return {text};}const tag=el.tagName?.toLowerCase();if(!tags.has(tag)||el.hidden)return null;const row={tag,key:key(el),children:[]};if(el.className&&typeof el.className==='string')row.className=el.className.slice(0,500);if(tag==='button'&&el.id==='zip')row.className=(row.className?row.className+' ':'')+'control-primary';for(const [field,attr] of [['label','aria-label'],['title','title']])if(el.getAttribute(attr))row[field]=redact(el.getAttribute(attr)).slice(0,500);if(tag==='input'){if(!['checkbox','text'].includes(el.type))return null;row.type=el.type;row.value=redact(el.value).slice(0,300);row.checked=el.checked;row.disabled=el.disabled;}if(tag==='button')row.disabled=el.disabled;if(tag==='details')row.open=el.open;row.children=[...el.childNodes].map(n=>serialize(n,depth+1)).filter(Boolean);return row;};
      for(const [k,el]of elements)if(!el.isConnected)elements.delete(k);
      const tree=closed?null:serialize(root.querySelector('section'));const dialogEl=closed?null:root.querySelector('dialog[open]');let dialog=null;
      if(dialogEl){const container={tag:'div',key:key(dialogEl),children:[...dialogEl.childNodes].map(n=>serialize(n)).filter(Boolean)};dialog=container;}
      return validate({version,revision:++revision,at:Date.now(),tree,dialog,closed,truncated});
    }
    function execute(input){
      const m=command(input),el=elements.get(m.key);if(closed||m.version!==version||!el?.isConnected||el.getRootNode()!==root||el.disabled)throw Error('控件已失效或暂不可操作，请等待更新 / Control is stale or disabled; wait for refresh');
      if(m.action==='click'&&el.tagName==='BUTTON')el.dispatchEvent(new Event('click',{bubbles:true,composed:true}));
      else if(m.action==='input'&&el.tagName==='INPUT'&&el.type==='text'){el.value=m.value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
      else if(m.action==='check'&&el.tagName==='INPUT'&&el.type==='checkbox'){el.checked=m.value;el.dispatchEvent(new Event('change',{bubbles:true}));}
      else if(m.action==='toggle'&&el.tagName==='DETAILS')el.open=m.value;
      else throw Error('Unsupported collector control');return snapshot();
    }
    return {snapshot,execute,close(){closed=true;elements.clear();}};
  }
  function mount(container,options){
    let latest,signature='',destroyed=false,pending,language='zh';const doc=container.ownerDocument,dialog=doc.createElement('dialog');dialog.className='control-dialog';container.getRootNode().append(dialog);
    const status=doc.createElement('p');status.className='control-connection';const body=doc.createElement('div');body.className='control-body';container.replaceChildren(status,body);
    const tr=(zh,en)=>language==='en'?en:zh;
    const translate=value=>{const i=value?.indexOf(' / ');return i>=0?(language==='en'?value.slice(i+3):value.slice(0,i)):value;};
    function build(n){if(n.text!=null)return doc.createTextNode(n.text);const el=doc.createElement(n.tag);el.dataset.controlKey=n.key;if(n.className)el.className=n.className;if(n.label)el.setAttribute('aria-label',translate(n.label));if(n.title)el.title=translate(n.title);if(n.tag==='input'){el.type=n.type;el.value=n.value||'';el.checked=!!n.checked;el.disabled=!!n.disabled;el.onchange=()=>send(n,n.type==='checkbox'?'check':'input',n.type==='checkbox'?el.checked:el.value);}if(n.tag==='button'){el.disabled=!!n.disabled;el.onclick=()=>{if(dialog.contains(el))dialog.close();send(n,'click');};}if(n.tag==='details'){el.open=!!n.open;el.addEventListener('toggle',()=>{if(el.open!==!!n.open)send(n,'toggle',el.open);});}for(const c of n.children||[])el.append(build(c));return el;}
    async function send(n,action,value){if(!latest||destroyed)return;const version=latest.version;status.textContent=tr('正在同步操作…','Syncing control…');try{const data=await options.command(command({version,key:n.key,action,value}));if(!destroyed)update(data);}catch(e){status.textContent=e.message;}}
    function update(input){if(destroyed)return;const data=validate(input);if(latest?.version===data.version&&(data.revision<latest.revision||data.at<latest.at))return;latest=data;
      const focused=container.getRootNode().activeElement;if(focused&&body.contains(focused)&&focused.tagName==='INPUT'&&focused.type==='text'){pending=data;return;}
      pending=null;const next=JSON.stringify([data.tree,data.dialog,data.closed,data.truncated]);if(next===signature){status.textContent=data.closed?tr('源采集浮窗已关闭','Source collector closed'):tr('在线同步 · ','Live · ')+new Date(data.at).toLocaleTimeString(language==='en'?'en-GB':'zh-CN');return;}signature=next;
      const scrolls=new Map([...body.querySelectorAll('[data-control-key]')].filter(el=>el.scrollTop).map(el=>[el.dataset.controlKey,el.scrollTop]));body.replaceChildren();if(data.tree)body.append(build(data.tree));for(const el of body.querySelectorAll('[data-control-key]'))if(scrolls.has(el.dataset.controlKey))el.scrollTop=scrolls.get(el.dataset.controlKey);
      status.textContent=data.closed?tr('源采集浮窗已关闭','Source collector closed'):data.truncated?tr('部分内容超出展示上限，可打开原页查看','Some content exceeds the display limit; open the original tab'):tr('在线同步 · ','Live · ')+new Date(data.at).toLocaleTimeString(language==='en'?'en-GB':'zh-CN');
      if(data.dialog){dialog.replaceChildren(build(data.dialog));if(!dialog.open)dialog.showModal();}else if(dialog.open)dialog.close();
    }
    dialog.addEventListener('cancel',event=>{event.preventDefault();const button=latest?.dialog?.children.flatMap(n=>n.children||[]).find(n=>n.tag==='button');dialog.close();if(button)send(button,'click');});
    body.addEventListener('focusout',()=>{if(pending){const next=pending;pending=null;queueMicrotask(()=>{if(next===latest)update(next);});}});
    return {update,error(message){if(!destroyed)status.textContent=message;},language(value){language=value==='en'?'en':'zh';},destroy(){destroyed=true;dialog.close();dialog.remove();container.replaceChildren();}};
  }
  return {validate,command,source,mount};
});
