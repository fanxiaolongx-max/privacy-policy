/* Cairo pronunciation data is explicit: spelling alone cannot predict dialect vowels. */
(function (root) {
    'use strict';
    const data = typeof module === 'object' && module.exports ? require('./letter-drill-data.js') : root.EgyptianDrillData;
    const { WORDS, WORD_PARTS, WORD_SPEECH, toIpa } = data;
    const LETTERS = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'.split('');
    const SOUNDS = ['ʾ','b','t',null,'g','ḥ','kh','d',null,'r','z','s','sh','ṣ','ḍ','ṭ',null,'ʿ','gh','f','ʾ','k','l','m','n','h','w','y'];
    const MARKS = ['َ','ِ','ُ','ْ'];
    const VOWELS = ['a','i','u',''];
    const NON_JOINING = new Set('ادذرزو');
    const ARABIC_SOUNDS = {'ʾ':'ء',b:'ب',t:'ت',g:'ج','ḥ':'ح',kh:'خ',d:'د',r:'ر',z:'ز',s:'س',sh:'ش','ṣ':'ص','ḍ':'ض','ṭ':'ط','ẓ':'ظ','ʿ':'ع',gh:'غ',f:'ف',k:'ك',l:'ل',m:'م',n:'ن',h:'ه',w:'و',y:'ي'};
    function graphemes(text) {
        return Array.from(text).reduce((parts,c) => {
            if (/\p{Mark}/u.test(c) && parts.length) parts[parts.length-1] += c;
            else parts.push(c);
            return parts;
        }, []);
    }
    function forms(letter, mark) {
        const initial = letter + mark + (NON_JOINING.has(letter) ? '' : 'ـ');
        return [letter+mark, initial, 'ـ'+initial, 'ـ'+letter+mark];
    }
    function targetRange(word, index) {
        const glyphs=graphemes(word), start=glyphs.slice(0,index).join('').length;
        return {start,end:start+(glyphs[index]?.length||0)};
    }
    function hasCarrier(read) { return /[ʾbtdgrzsṣḍṭẓʿfklmnhwyḥ]/u.test(read) && !/^ʾ[aiuāīū]$/u.test(read); }
    // Arabic spelling does not encode Cairo /e o/ reliably in isolated TTS syllables.
    // Hear these inside the actual word rather than passing off /i u/ as the answer.
    function needsContext(read) { return /[eoēō]/u.test(read) || /^[aiuāīū]+$/u.test(read); }
    function speechFor(read) {
        if (data.PART_SPEECH?.[read]) {
            const speech = data.PART_SPEECH[read];
            return hasCarrier(read) && /[aiueoāīūēō]/u.test(read) ? 'أَ'+speech : speech;
        }
        const tokens = read.match(/kh|sh|gh|[ʾbtdgrzsṣḍṭẓʿfklmnhwyḥ]|[aiueoāīūēō]/gu) || [];
        let speech = '';
        for (let i=0; i<tokens.length; i++) {
            const token = tokens[i];
            if (ARABIC_SOUNDS[token]) {
                let glyph = ARABIC_SOUNDS[token];
                if (tokens[i+1] === token) { glyph += 'ّ'; i++; }
                const vowel = tokens[i+1];
                if (vowel && /[aiueoāīūēō]/u.test(vowel)) {
                    glyph += /[aā]/u.test(vowel) ? 'َ' : /[ieīē]/u.test(vowel) ? 'ِ' : 'ُ';
                    if (/[āīūēō]/u.test(vowel)) glyph += /ā/u.test(vowel) ? 'ا' : /[īē]/u.test(vowel) ? 'ي' : 'و';
                    i++;
                } else glyph += 'ْ';
                speech += glyph;
            } else speech += /[aā]/u.test(token) ? (token === 'ā' ? 'آ' : 'أَ') : /[ieīē]/u.test(token) ? (/[īē]/u.test(token) ? 'إِي' : 'إِ') : (/[ūō]/u.test(token) ? 'أُو' : 'أُ');
        }
        // Carrier syllables avoid isolated-TTS letter names and swallowed short vowels.
        // The leading /a/ is never part of the answer.
        return hasCarrier(read) ? 'أَ' + speech : speech;
    }
    function sound(read) {
        return {audioKey:'sound:'+read, speech:speechFor(read), ipa:toIpa(read), read, kind:'sound', carrier:hasCarrier(read)};
    }
    function wordParts(word) {
        const readings = WORD_PARTS[word];
        return graphemes(word).map((glyph,index) => {
            const part = {glyph,index,read:readings[index], ...sound(readings[index])};
            if (needsContext(part.read)) Object.assign(part,{audioKey:word,speech:WORD_SPEECH[word]||word,carrier:false,contextOnly:true});
            return part;
        });
    }
    let cachedBank;
    function bank() {
        if (cachedBank) return cachedBank;
        const result = [];
        LETTERS.forEach((letter,i) => {
            if (SOUNDS[i] === null) return;
            MARKS.forEach((mark,j) => {
                if (letter === 'ا' && j === 3) return;
                const unit = letter === 'ا' ? ['أَ','إِ','أُ'][j] : letter+mark;
                const read = SOUNDS[i]+VOWELS[j], target = sound(read);
                result.push({id:letter+':'+j, letter,unit,
                    forms:letter==='ا'?[unit,unit,'ـ'+unit,'ـ'+unit]:forms(letter,mark), read,ipa:target.ipa,
                    audioKey:target.audioKey, speech:target.speech, targetAudioKey:target.audioKey,targetSpeech:target.speech,
                    carrier:target.carrier});
            });
        });
        WORDS.forEach(([letter,word,index,read,,roman,meaning],i) => {
            const target = sound(read);
            const contextOnly = needsContext(read);
            result.push({id:'word:'+i,letter,word,index,read,ipa:target.ipa,roman,wordIpa:toIpa(roman),meaning,
                audioKey:word,speech:WORD_SPEECH[word] || word,targetAudioKey:contextOnly?word:target.audioKey,targetSpeech:contextOnly?(WORD_SPEECH[word]||word):target.speech,
                carrier:contextOnly?false:target.carrier,contextOnly,parts:wordParts(word)});
        });
        cachedBank = result;
        return result;
    }
    function audioTargets() {
        const reads = new Set(bank().map(item => item.read));
        Object.values(WORD_PARTS).flat().filter(Boolean).forEach(read => reads.add(read));
        return [...reads].filter(read=>!needsContext(read)).map(sound);
    }
    function shuffle(items, random=Math.random) {
        const a=[...items];
        for(let i=a.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
        return a;
    }
    function question(pool,count=3,random=Math.random,forced=null) {
        if (!pool.length) throw new Error('请选择至少一个字母');
        const answer = forced || pool[Math.floor(random()*pool.length)];
        const seen = new Set([answer.ipa]);
        const candidates = [...shuffle(pool,random),...shuffle(bank(),random)].filter(item => {
            if(seen.has(item.ipa)) return false;
            seen.add(item.ipa);return true;
        });
        return {answer,options:shuffle([answer,...candidates.slice(0,count-1)],random)};
    }
    function limit(round) { return Math.max(3000,10000-Math.floor(round/5)*2200); }
    const api = {LETTERS,WORDS,WORD_PARTS,bank,question,limit,graphemes,forms,targetRange,toIpa,wordParts,audioTargets,speechFor,needsContext};
    if (typeof module==='object' && module.exports) { module.exports=api; return; }
    const $ = id => document.getElementById(id);
    const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const ipaText = ipa => '/' + ipa + '/';
    let state={running:false,paused:false,locked:false,round:0,score:0,streak:0,correct:0,misses:[],pool:[],q:null,remaining:0,deadline:0,timer:null,next:null,split:false,inspecting:false};
    let audio=null, audioManifest=null, fullManifest=null, audioEpoch=0, audioDone=null, activeTrigger=null;
    let wordObserver=null;
    const manifestReady = fetch('audio/drill-manifest.json?v=20261004-3',{cache:'no-cache'})
        .then(r=>r.ok?r.json():null).then(m=>audioManifest=m).catch(()=>null);
    const fullManifestReady = fetch('audio/manifest.json',{cache:'no-cache'})
        .then(r=>r.ok?r.json():null).then(m=>fullManifest=m).catch(()=>null);
    function getSyllablesCatalog() {
        return root.speechState?.manifest?.units?.syllables?.egyptian
            || fullManifest?.units?.syllables?.egyptian
            || null;
    }
    function getLettersCatalog() {
        return root.speechState?.manifest?.units?.letters?.egyptian
            || fullManifest?.units?.letters?.egyptian
            || null;
    }
    function stopAudio() {
        audioEpoch++;
        if(audio) { audio.onended=null;audio.onerror=null;audio.pause(); }
        root.speechSynthesis?.cancel();
        activeTrigger?.classList.remove('playing');activeTrigger=null;
        if(audioDone) { audioDone(false);audioDone=null; }
    }
    function audioStatus(text) { $('drill-audio-status').textContent=text; }
    async function play(item,trigger=null,label='目标音') {
        stopAudio();
        if(typeof stopSpeech==='function') stopSpeech();
        const epoch=audioEpoch;
        if(!audioManifest) await manifestReady;
        if(!fullManifest && fullManifestReady) await fullManifestReady;
        if(epoch!==audioEpoch || !state.running) return false;
        const source=item.audioUrl || audioManifest?.[item.audioKey];
        const isClean=Boolean(item.audioUrl);
        const carrier=isClean?'':item.contextOnly?' · 在整词中听这个音':item.carrier?' · 前导 /a/ 帮助听清目标音':'';
        audioStatus('正在播放'+label+carrier);
        activeTrigger=trigger;trigger?.classList.add('playing');
        return new Promise(resolve => {
            const done=(ok,message) => {
                if(epoch!==audioEpoch) return;
                audioDone=null;trigger?.classList.remove('playing');activeTrigger=null;
                if(message) audioStatus(message);
                resolve(ok);
            };
            audioDone=resolve;
            if(source) {
                if(!audio) audio=new Audio();
                audio.src=source;
                audio.onended=()=>done(true,label+'已播放'+carrier+' · 可再次点读');
                audio.onerror=()=>done(false,'此段配音暂不可用，请重新点读');
                audio.play().catch(error => {
                    if(epoch!==audioEpoch) return;
                    done(false,error?.name==='NotAllowedError'?'请点一下朗读按钮播放配音':'配音加载失败，请重新点读');
                });
                return;
            }
            const voice=root.speechSynthesis?.getVoices().find(v=>v.lang.toLowerCase()==='ar-eg');
            if(voice && item.speech) {
                const utterance=new SpeechSynthesisUtterance(item.speech);
                utterance.voice=voice;utterance.lang='ar-EG';utterance.rate=.85;
                utterance.onend=()=>done(true,label+'已播放'+carrier);
                utterance.onerror=()=>done(false,'配音暂不可用，请重新点读');
                root.speechSynthesis.speak(utterance);
            } else done(false,'此段埃及配音未加载，请重新点读');
        });
    }
    function clearTimers() { clearInterval(state.timer);clearTimeout(state.next);state.timer=null;state.next=null; }
    function inspect() {
        // A deliberate replay/decomposition cancels auto advance so the word stays available.
        state.inspecting=true;clearTimeout(state.next);state.next=null;
    }
    function stats() {
        $('drill-score').textContent=state.score;$('drill-streak').textContent=state.streak;
        $('drill-level').textContent=Math.floor(state.round/5)+1;
        $('drill-count').textContent=Math.min(state.round+1,20)+'/20';
    }
    function tick() {
        state.remaining=Math.max(0,state.deadline-performance.now());
        $('drill-time').style.width=(state.remaining/limit(state.round)*100)+'%';
        $('drill-seconds').textContent=(state.remaining/1000).toFixed(1)+' s';
        $('drill-clock').classList.toggle('urgent',state.remaining<2500);
        if(!state.remaining) answer(-1);
    }
    function listenWord(trigger) { inspect();return play({...state.q.answer,carrier:false,contextOnly:false},trigger,'整词'); }
    function listenPart(part,trigger) {
        inspect();
        if(!part.read) { stopAudio();audioStatus('这个字母在此词中不单独发音');return; }
        const syllables=getSyllablesCatalog(), letters=getLettersCatalog();
        let cleanAudio=null, cleanLabel=null;
        if(syllables) {
            if(part.glyph==='ا' || part.read==='ā') {
                const syl=syllables['آ'];
                if(syl?.audio) { cleanAudio=syl.audio;cleanLabel='长元音 '+ipaText(part.ipa); }
            } else if(syllables[part.glyph]?.audio) {
                cleanAudio=syllables[part.glyph].audio;cleanLabel='字母音 '+ipaText(part.ipa);
            } else if(syllables[part.glyph+'ْ']?.audio && (part.read===part.glyph || !/[aiueoāīūēō]/u.test(part.read))) {
                cleanAudio=syllables[part.glyph+'ْ'].audio;cleanLabel='字母音 '+ipaText(part.ipa);
            } else if(letters?.[part.glyph]?.audio && !part.contextOnly) {
                cleanAudio=letters[part.glyph].audio;cleanLabel='字母 '+ipaText(part.ipa);
            }
        }
        if(cleanAudio) return play({...part,audioUrl:cleanAudio,carrier:false,contextOnly:false},trigger,cleanLabel);
        return play(part,trigger,(part.contextOnly?'词内读音 ':'字母 ')+ipaText(part.ipa));
    }
    function renderWord(q) {
        $('drill-display').innerHTML='<button class="drill-word" id="drill-word" lang="ar" dir="rtl" aria-expanded="'+state.split+'" aria-label="'+esc(q.meaning)+'：朗读整词并'+(state.split?'合并':'拆开')+'字母">'
            +'<span class="drill-word-text" id="drill-word-text">'+esc(q.word)+'</span><span class="drill-word-highlight" id="drill-word-highlight" aria-hidden="true"></span></button>'
            +'<div class="drill-word-meaning">'+esc(q.meaning)+'</div>'
            +'<div class="drill-word-actions"><button id="drill-whole">♫ 听整词</button><button id="drill-split-toggle" aria-expanded="'+state.split+'">'+(state.split?'合并字母':'拆字母')+'</button></div>'
            +'<div id="drill-parts" class="drill-parts" dir="rtl" '+(state.split?'':'hidden')+'></div>'
            +'<span class="drill-caption">'+(state.split?'按词内读音点读 · 长音载体与前一字母共享元音':'点击单词可拆字并朗读 · 只判断高亮部分')+'</span>';
        highlightWord(q);
        const toggle = trigger => { state.split=!state.split;renderWord(q);listenWord(trigger==='word'?$('drill-word'):$('drill-split-toggle')); };
        $('drill-word').onclick=()=>toggle('word');
        $('drill-split-toggle').onclick=()=>toggle('split');
        $('drill-whole').onclick=()=>listenWord($('drill-whole'));
        q.parts.forEach(part => {
            const button=document.createElement('button');
            button.className='drill-part'+(part.index===q.index?' is-target':'');
            button.setAttribute('aria-label','朗读 '+part.glyph+' '+(part.read?ipaText(part.ipa):'不单独发音'));
            button.innerHTML='<span class="drill-part-glyph" lang="ar">'+esc(part.glyph)+'</span><span class="drill-ipa" dir="ltr">'+(part.read?esc(ipaText(part.ipa)):'∅')+'</span>';
            button.onclick=()=>listenPart(part,button);$('drill-parts').append(button);
        });
    }
    function highlightWord(q) {
        wordObserver?.disconnect();
        // Keep the whole word in one text node. Inline styling can split Arabic
        // shaping runs in WebKit; a Range measures an independent background.
        if(!document.createRange) return;
        const word=$('drill-word'), text=$('drill-word-text'), marker=$('drill-word-highlight');
        const paint=()=>{
            if(!word.isConnected || !text.firstChild) return;
            const range=document.createRange(), offsets=targetRange(q.word,q.index);
            range.setStart(text.firstChild,offsets.start);range.setEnd(text.firstChild,offsets.end);
            const rect=range.getBoundingClientRect(), box=word.getBoundingClientRect();
            marker.style.left=(rect.left-box.left-word.clientLeft)+'px';
            marker.style.top=(rect.top-box.top-word.clientTop)+'px';
            marker.style.width=rect.width+'px';marker.style.height=rect.height+'px';
        };
        paint();
        if(root.ResizeObserver) {wordObserver=new root.ResizeObserver(paint);wordObserver.observe(word);}
        document.fonts?.ready.then(paint);
    }
    function renderWave(q) {
        wordObserver?.disconnect();
        const count=2+Math.floor(Math.random()*3),target=Math.floor(Math.random()*count);
        const syllables=state.pool.filter(item=>!item.word);
        const wave=document.createElement('div');wave.className='drill-wave';wave.dir='rtl';
        Array.from({length:count},(_,i)=>{
            const item=i===target?q:syllables[Math.floor(Math.random()*syllables.length)];
            const shape=item.forms[Math.floor(Math.random()*4)];
            const button=document.createElement('button');button.lang='ar';button.className='drill-glyph'+(i===target?' drill-target':'');
            button.textContent=shape;button.setAttribute('aria-label','朗读字母 '+shape);
            button.onclick=()=>{
                inspect();
                const sylCatalog=getSyllablesCatalog();
                const cleanAudio=sylCatalog?.[item.unit]?.audio;
                if(cleanAudio) play({...item,audioUrl:cleanAudio,carrier:false,contextOnly:false},button,'字母 '+ipaText(item.ipa));
                else play({...item,audioKey:item.targetAudioKey,speech:item.targetSpeech},button,'字母 '+ipaText(item.ipa));
            };
            wave.append(button);
        });
        $('drill-display').replaceChildren(wave);
        const caption=document.createElement('span');caption.className='drill-caption';caption.textContent='点击字母可听音 · 只判断高亮部分';$('drill-display').append(caption);
    }
    function feedback() {
        if(state.paused) return state.q.answer.word?'已暂停 · 单词保留，可拆字和点读':'已暂停 · 字母仍可点读';
        if(state.locked) return state.answerMessage;
        return '选择高亮字母的读音';
    }
    function next() {
        clearTimers();stopAudio();
        if(state.round>=20) { finish();return; }
        const due=state.misses.find(m=>m.due===state.round);
        state.q=question(state.pool,Number($('drill-options-count').value),Math.random,due?.item);
        state.locked=false;state.paused=false;state.split=false;state.inspecting=false;
        $('drill-arena').classList.remove('is-paused','is-correct','is-wrong');
        $('drill-pause').textContent='暂停';$('drill-pause').setAttribute('aria-pressed','false');
        $('drill-feedback').textContent=feedback();audioStatus(state.q.answer.word?'作答后播放目标音 · 整词可随时点读':'作答后播放目标音 · 字母可随时点读');
        $('drill-next').hidden=true;$('drill-replay').disabled=true;
        $('drill-replay').textContent=state.q.answer.contextOnly?'♫ 听词内读音':'♫ 听目标音';
        const q=state.q.answer;
        q.word?renderWord(q):renderWave(q);
        $('drill-options').replaceChildren();
        state.q.options.forEach((option,i)=>{
            const button=document.createElement('button');button.className='drill-choice';
            button.innerHTML='<small aria-hidden="true">'+(i+1)+'</small><strong class="drill-ipa" dir="ltr">'+esc(ipaText(option.ipa))+'</strong>';
            button.onclick=()=>answer(i);$('drill-options').append(button);
        });
        stats();state.remaining=limit(state.round);state.deadline=performance.now()+state.remaining;tick();state.timer=setInterval(tick,50);
    }
    async function answer(index) {
        if(!state.running||state.locked||state.paused) return;
        state.locked=true;clearTimers();
        $('drill-seconds').textContent='复习中';
        const q=state.q,round=state.round;
        const correct=index>=0&&q.options[index].ipa===q.answer.ipa;
        if(correct) { state.correct++;state.streak++;state.score+=100+Math.min(100,state.streak*10)+Math.ceil(state.remaining/1000)*5; }
        else { state.streak=0;state.misses.push({item:q.answer,due:state.round+3}); }
        [...$('drill-options').children].forEach((button,i)=>{
            button.disabled=true;
            if(q.options[i].ipa===q.answer.ipa) button.classList.add('correct');
            else if(i===index) button.classList.add('wrong');
        });
        $('drill-arena').classList.add(correct?'is-correct':'is-wrong');
        state.answerMessage=(correct?'✓ 正确 ':index<0?'时间到 · 正确读音 ':'再记一次 · 正确读音 ')+ipaText(q.answer.ipa);
        $('drill-feedback').textContent=feedback();$('drill-replay').disabled=false;$('drill-next').hidden=false;stats();
        const played=await play({...q.answer,audioKey:q.answer.targetAudioKey,speech:q.answer.targetSpeech},$('drill-replay'),(q.answer.contextOnly?'词内读音 ':'目标音 ')+ipaText(q.answer.ipa));
        // Never cut off a clip or a deliberate review to advance to the next question.
        if(correct&&played&&state.running&&state.q===q&&state.round===round&&!state.paused&&!state.inspecting) state.next=setTimeout(advance,900);
    }
    function advance() { if(!state.running||!state.locked||state.paused) return;state.round++;next(); }
    function pause() {
        if(!state.running||state.paused) return;
        if(!state.locked) state.remaining=Math.max(0,state.deadline-performance.now());
        state.paused=true;clearTimers();stopAudio();
        $('drill-pause').textContent='继续';$('drill-pause').setAttribute('aria-pressed','true');
        $('drill-arena').classList.add('is-paused');
        [...$('drill-options').children].forEach(button=>button.disabled=true);
        $('drill-next').disabled=true;$('drill-feedback').textContent=feedback();$('drill-seconds').textContent='已暂停';
    }
    function resume() {
        if(!state.running||!state.paused) return;
        state.paused=false;$('drill-pause').textContent='暂停';$('drill-pause').setAttribute('aria-pressed','false');
        $('drill-arena').classList.remove('is-paused');$('drill-next').disabled=false;
        [...$('drill-options').children].forEach(button=>button.disabled=state.locked);
        $('drill-feedback').textContent=feedback();
        if(!state.locked) { state.deadline=performance.now()+state.remaining;tick();state.timer=setInterval(tick,50); }
        else $('drill-seconds').textContent='已作答';
    }
    function start(review=false) {
        const selected=[...document.querySelectorAll('#drill-letters input:checked')].map(input=>input.value);
        const pool=review?[...new Map(state.misses.map(m=>[m.item.id,m.item])).values()]:bank().filter(q=>selected.includes(q.letter));
        if(!pool.length) { $('drill-setup-status').textContent='请至少选择一个字母。';return; }
        clearTimers();stopAudio();
        state={running:true,paused:false,locked:false,round:0,score:0,streak:0,correct:0,misses:[],pool,split:false,inspecting:false};
        $('letter-drill-root').classList.add('in-game');$('drill-setup').hidden=true;$('drill-results').hidden=true;$('drill-arena').hidden=false;$('drill-next').disabled=false;
        next();$('letter-drill-root').scrollIntoView({block:'start',behavior:'smooth'});
    }
    function finish() {
        $('letter-drill-root').classList.remove('in-game');clearTimers();stopAudio();state.running=false;
        $('drill-arena').hidden=true;$('drill-results').hidden=false;
        $('drill-summary').textContent='本轮 '+state.score+' 分 · 正确 '+state.correct+'/20 · '+Math.round(state.correct/20*100)+'%';
        const misses=[...new Map(state.misses.map(m=>[m.item.id,m.item])).values()];
        $('drill-misses').textContent=misses.length?'再练这些：'+misses.map(q=>(q.word||q.unit)+' → '+ipaText(q.ipa)).join('；'):'全部答对！下次试着加入几个新字母。';
        $('drill-review').hidden=!misses.length;
    }
    function init() {
        $('letter-drill-root').innerHTML=`<div class="drill-heading"><span class="drill-kicker">CAIRO · LETTER SPRINT</span><h2>字母抽查</h2><p>看清字形，听懂读音。每轮 20 题，每 5 题加速。</p></div>
        <div id="drill-setup" class="drill-panel"><h3>今天练哪些字母？</h3><p>点选一个或多个字母。初学建议从 ب · ت · ج 开始。</p><div class="drill-toolbar"><button id="drill-all">全选</button><button id="drill-clear">清空</button><label>选择方式 <select id="drill-selection"><option value="multi">多选</option><option value="single">单选</option></select></label><label>选项 <select id="drill-options-count"><option value="3">3 个</option><option value="2">2 个</option></select></label></div><div id="drill-letters" class="drill-letters"></div><p class="drill-note">包括首、中、尾字形，短元音、静符、长元音与叠音。选项使用国际音标；/ː/ 表示延长，/ˤ/ 表示咽化。ث / ذ / ظ 的读音随具体词变化。</p><p id="drill-setup-status" role="status"></p><button id="drill-start" class="drill-primary">开始闯关 →</button></div>
        <div id="drill-arena" class="drill-panel" hidden><div class="drill-hud"><span>关卡 <b id="drill-level">1</b></span><span>得分 <b id="drill-score">0</b></span><span>连击 <b id="drill-streak">0</b></span><span id="drill-count"></span><button id="drill-pause" aria-pressed="false">暂停</button><button id="drill-exit">结束本轮</button></div><div id="drill-clock" class="drill-clock"><div id="drill-time"></div></div><div id="drill-seconds" aria-hidden="true"></div><div id="drill-display"></div><div id="drill-options" class="drill-options"></div><p id="drill-feedback" role="status" aria-live="polite"></p><div class="drill-toolbar drill-review-actions"><button id="drill-replay" disabled>♫ 听目标音</button><button id="drill-next" hidden>下一题 →</button></div><p id="drill-audio-status" class="drill-note" role="status"></p><p class="drill-shortcuts">1 / 2 / 3 作答 · 空格暂停 · 点读后手动进入下一题</p></div>
        <div id="drill-results" class="drill-panel" hidden><h3>本轮完成</h3><p id="drill-summary"></p><p id="drill-misses"></p><div class="drill-toolbar"><button id="drill-review" class="drill-primary">错题专项再练</button><button id="drill-reset">重新选字母</button></div></div>`;
        LETTERS.forEach(letter=>{
            const label=document.createElement('label');label.innerHTML='<input type="checkbox" value="'+letter+'" '+('بتج'.includes(letter)?'checked':'')+'><span lang="ar">'+letter+'</span>';
            label.querySelector('input').onchange=e=>{if($('drill-selection').value==='single'&&e.target.checked) document.querySelectorAll('#drill-letters input').forEach(input=>{if(input!==e.target)input.checked=false;});};
            $('drill-letters').append(label);
        });
        $('drill-all').onclick=()=>{$('drill-selection').value='multi';document.querySelectorAll('#drill-letters input').forEach(input=>input.checked=true);};
        $('drill-clear').onclick=()=>document.querySelectorAll('#drill-letters input').forEach(input=>input.checked=false);
        $('drill-selection').onchange=()=>{if($('drill-selection').value==='single') { let found=false;document.querySelectorAll('#drill-letters input').forEach(input=>{if(input.checked&&!found)found=true;else input.checked=false;}); }};
        $('drill-start').onclick=()=>start();$('drill-review').onclick=()=>start(true);
        const reset=()=>{$('letter-drill-root').classList.remove('in-game');clearTimers();stopAudio();state.running=false;$('drill-setup').hidden=false;$('drill-results').hidden=true;$('drill-arena').hidden=true;};
        $('drill-reset').onclick=reset;$('drill-exit').onclick=reset;
        $('drill-pause').onclick=()=>state.paused?resume():pause();$('drill-next').onclick=advance;
        $('drill-replay').onclick=()=>{inspect();const q=state.q.answer;play({...q,audioKey:q.targetAudioKey,speech:q.targetSpeech},$('drill-replay'),(q.contextOnly?'词内读音 ':'目标音 ')+ipaText(q.ipa));};
        document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
        root.addEventListener('pagehide',()=>{clearTimers();stopAudio();});
        document.addEventListener('keydown',e=>{
            if(!state.running||!$('tab-letter-drill').classList.contains('active')||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.repeat) return;
            if(e.code==='Space') {e.preventDefault();state.paused?resume():pause();}
            else if(/^[123]$/.test(e.key)) {const index=Number(e.key)-1;if(index<state.q.options.length)answer(index);}
        });
    }
    root.letterDrill={init,pause,...api};
})(typeof window==='undefined'?globalThis:window);
