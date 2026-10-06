/* Re-locate live evidence on every attempt. Reconstructed native XML is explicitly labelled. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.createNetcareCapture=factory;})(typeof globalThis!=='undefined'?globalThis:this,function createNetcareCapture(){
  const title=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/^\s*\d+(?:\.\d+)*(?:[.、):\s]+)?/,'').replace(/[\s\p{P}\p{S}]+/gu,'');
  const href=el=>(el.getAttribute('data-hd-href')||el.getAttribute('href')||'').toLowerCase();
  const fail=(code,message)=>Object.assign(Error(message),{code});
  function article(doc,topic){
    const expected=title(topic.title),matches=[...doc.querySelectorAll('article')].filter(el=>{
      const heading=el.querySelector('h1,h2,h3,h4,h5,h6');if(!heading)return false;
      const text=heading.textContent.trim(),number=text.match(/^\s*(\d+(?:\.\d+)*)(?=\s|[.、):]|[A-Za-z\u3400-\u9fff])/i)?.[1];
      return title(text)===expected&&(!number||number===topic.number);
    });
    if(matches.length>1)throw fail('AMBIGUOUS_REGION','原始章节区域不唯一，已拒绝截图 / Ambiguous original section; capture refused');return matches[0]||null;
  }
  function locate(doc,shot){
    const section=article(doc,shot.topic);if(shot.kind==='text')return section;
    if(!section)return null;
    const matches=[...section.querySelectorAll('a')].filter(a=>href(a)===shot.file.href.toLowerCase());
    if(matches.length>1)throw fail('AMBIGUOUS_ATTACHMENT','附件位置不唯一，已拒绝截图 / Ambiguous attachment location; capture refused');
    const anchor=matches[0];return anchor?.closest('tr')||anchor?.closest('p')||anchor||null;
  }
  function navigate(doc,topic){
    const normal=value=>String(value||'').replace(/\s+/g,' ').trim().toLowerCase();
    // The native directory uses nested DIV/P/SPAN nodes, not links or ARIA tree items.
    const nodes=[...doc.querySelectorAll('#NavigationTree span,#NavigationTree p,#NavigationTree div,a,[role=treeitem]')].filter(el=>!el.closest('article')&&el.getBoundingClientRect().width>0);
    const numbered=nodes.filter(el=>normal(el.textContent)===normal(topic.number+' '+topic.title));
    const matches=(numbered.length?numbered:nodes.filter(el=>normal(el.textContent)===normal(topic.title))).filter(el=>!nodes.some(child=>child!==el&&el.contains?.(child)&&normal(child.textContent)===normal(el.textContent)));
    if(matches.length===1){matches[0].click();return true;}return false;
  }
  async function ready(doc,shot,signal,sleep){
    let previous,signature='',stable=0;
    for(let poll=0;poll<25;poll++){
      if(signal.aborted)throw fail('STOPPED','已停止 / Stopped');
      const element=locate(doc,shot),bounds=element?.getBoundingClientRect();
      const images=element?[...element.querySelectorAll('img')]:[];
      if(element&&element.isConnected!==false&&bounds.width>0&&bounds.height>0&&images.every(img=>img.complete)){
        const next=[element.innerHTML||element.textContent||'',Math.round(bounds.width),Math.round(bounds.height)].join('|');
        stable=element===previous&&next===signature?stable+1:0;previous=element;signature=next;
        if(stable>=2)return element;
      }else{previous=null;stable=0;}
      await sleep(120,signal);
    }
    throw fail('REGION_NOT_STABLE','章节未在等待时间内完成挂载或稳定布局 / Section did not mount or settle within the wait period');
  }
  function reconstruct(doc,shot){
    if(!shot.topic.xml)throw fail('NO_NATIVE_XML','章节原始内容未保留，无法兜底 / Native section XML unavailable');
    const parsed=new DOMParser().parseFromString(shot.topic.xml,'text/html'),source=parsed.querySelector('article');if(!source)throw fail('INVALID_NATIVE_XML','原始章节内容无效 / Invalid native section XML');
    const heading=source.querySelector('h1,h2,h3,h4,h5,h6')?.textContent.trim(),number=heading?.match(/^\s*(\d+(?:\.\d+)*)(?=\s|[.、):]|[A-Za-z\u3400-\u9fff]|$)/i)?.[1];
    if(heading&&(number&&number!==shot.topic.number||title(heading)&&title(heading)!==title(shot.topic.title)))throw fail('NATIVE_SECTION_MISMATCH','原始内容的章节序号或名称不符，已拒绝重建 / Native section number or title mismatch; reconstruction refused');
    const clone=doc.importNode(source,true);
    // Resolve the region before sanitizing, so removed anchors cannot shift its index.
    let region=clone;if(shot.kind==='attachments'){
      const matches=[...clone.querySelectorAll('a')].filter(a=>href(a)===shot.file.href.toLowerCase());
      if(matches.length!==1)throw fail('ATTACHMENT_NOT_IN_XML','附件未唯一定位到该章节原始内容中 / Attachment not uniquely located in native section XML');
      const anchor=matches[0];region=anchor.closest('tr')||anchor.closest('p')||anchor;
    }
    clone.querySelectorAll('script,style,iframe,object,embed,link,meta,base,form,input,button,textarea,select').forEach(el=>el.remove());
    for(const el of [clone,...clone.querySelectorAll('*')]){for(const a of [...el.attributes])if(/^on/i.test(a.name)||['id','srcdoc','srcset','poster','ping','xlink:href','autofocus','contenteditable','action','formaction','href','data-hd-href'].includes(a.name)||a.name==='style'&&/url\s*\(|expression|@import/i.test(a.value))el.removeAttribute(a.name);
      if(el.hasAttribute('src')){try{const u=new URL(el.getAttribute('src'),doc.location.href);if(u.origin!==doc.location.origin||u.username||u.password)el.removeAttribute('src');}catch{el.removeAttribute('src');}}
    }
    if(!clone.contains(region))throw fail('UNSAFE_ATTACHMENT_REGION','附件区域不可安全重建 / Attachment region cannot be safely reconstructed');
    const box=doc.createElement('div');box.setAttribute('data-netcare-reconstructed','true');box.style.cssText='position:fixed;left:-20000px;top:0;width:'+Math.max(320,Math.min(1400,doc.defaultView.innerWidth||1000))+'px;background:#fff;color:#243149;padding:20px;font:12px/1.6 Arial;pointer-events:none;z-index:-1;';
    const label=doc.createElement('p');label.textContent=shot.topic.number+' '+shot.topic.title+' · 内容重建截图（非页面原图） / Reconstructed native content (not a live-page screenshot)';box.append(label);
    if(region.tagName==='TR'){const table=doc.createElement('table');table.append(region);box.append(table);}else box.append(region);doc.body.append(box);
    return {element:box,remove:()=>box.remove()};
  }
  const delay=(ms,signal)=>new Promise((resolve,reject)=>{const done=()=>{signal.removeEventListener('abort',abort);resolve();},timer=setTimeout(done,ms),abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(fail('STOPPED','已停止 / Stopped'));};signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();});
  async function capture(doc,shot,options){
    const {signal,render}=options,attempts=[],sleep=options.sleep||delay;
    for(let n=1;n<=3;n++){
      if(signal.aborted)throw fail('STOPPED','已停止 / Stopped');
      if(n>1)await sleep(n===2?400:1000,signal);
      let element;
      try{
        const clicked=navigate(doc,shot.topic);
        element=locate(doc,shot);
        if(!element&&!clicked)throw fail('REGION_NOT_RENDERED','未定位到章节目录入口或原始区域 / Native directory and live region not found');
        // Never retain a node across scroll-driven virtual DOM replacement.
        element=await ready(doc,shot,signal,sleep);
        try{
          element.scrollIntoView({block:'start',inline:'nearest',behavior:'instant'});
          let scroller=element.parentElement;
          while(scroller&&!(scroller.clientHeight>0&&scroller.scrollHeight>scroller.clientHeight+1))scroller=scroller.parentElement;
          scroller?.dispatchEvent(new Event('scroll',{bubbles:true}));
        }catch{}
        element=await ready(doc,shot,signal,sleep);
        if(signal.aborted)throw fail('STOPPED','已停止 / Stopped');
        const images=await render(element);
        if(element.isConnected===false||locate(doc,shot)!==element)throw fail('REGION_REPLACED','渲染期间章节节点发生替换，重新定位并重试 / Section replaced during rendering; retrying');
        options.attempt?.({attempt:n,stage:'live',ok:true});return {images,method:'live',attempts};
      }catch(e){if(signal.aborted)throw e;const bounds=element?.getBoundingClientRect();const item={attempt:n,stage:'live',code:e.code||e.name||'RENDER_FAILED',message:String(e.message||e).slice(0,1500),stack:String(e.stack||'').slice(0,2000),articles:doc.querySelectorAll('article').length,bounds:bounds?{width:bounds.width,height:bounds.height,connected:element.isConnected}:null};attempts.push(item);options.attempt?.(item);if(n===1&&typeof options.onStuck==='function'){try{options.onStuck();}catch{}}}
    }
    let fallback;
    try{if(signal.aborted)throw fail('STOPPED','已停止 / Stopped');fallback=reconstruct(doc,shot);const images=await render(fallback.element);return {images,method:'reconstructed',attempts};}
    catch(e){if(signal.aborted)throw e;attempts.push({attempt:4,stage:'reconstructed',code:e.code||e.name||'RENDER_FAILED',message:String(e.message||e).slice(0,1500),stack:String(e.stack||'').slice(0,2000)});throw Object.assign(fail('CAPTURE_FAILED','截图重试与兜底均失败 / Capture retries and fallback failed'),{attempts});}
    finally{fallback?.remove();}
  }
  return {article,locate,navigate,reconstruct,capture};
});
