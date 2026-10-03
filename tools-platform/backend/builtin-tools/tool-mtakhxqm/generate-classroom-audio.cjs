/* Regenerates only the curated lesson overlay. Never modifies runtime user data. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const drill = require('./letter-drill.js');
const run = promisify(execFile);
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const source = html.slice(html.indexOf('const STARTER_WORD_DATA'), html.indexOf('const MSA_EQUIVALENTS'));
const data = vm.runInNewContext(source+'; ({STARTER_WORD_DATA, EGYPTIAN_DIALECT_VOCAB, DB})');
// Pronunciation spellings for speech synthesis only; displayed spelling remains intact.
const spoken = {
    'ثَمَن':'تَمَن', 'ثَانِيَة':'سَنْيَة', 'مَثَل':'مَسَل', 'ذَهَب':'دَهَب', 'ذَوْق':'زُوق',
    'ظَهْر':'ضَهْر', 'نَظِيف':'نَضِيف', 'قَلْب':'أَلْب', 'سُوق':'سُوء',
    'وَقْت':'وَأْت', 'بَيْت':'بِيت', 'يَوْم':'يُوم', 'جِدَّة':'جِدَّة',
    'ذِرَاع':'دِرَاع', 'ذَيْل':'دِيل', 'ذُرَة':'دُرَة',
    'قَ':'أَ', 'قِ':'إِ', 'قُ':'أُ', 'قْ':'أَءْ',
    'عَمَّتي':'عَمِّتِي', 'خالتي':'خَالْتِي',
    'ثَلَاثَة':'تَلَاتَة', 'بَحْث':'بَحْس', 'أُسْتَاذ':'أُسْتَاذ',
    'قَهْوَة':'أَهْوَة', 'قَلَم':'أَلَم', 'قُطَّة':'أُطَّة', 'قَفَص':'أَفَص',
    'لَذِيذ':'لَذِيذ'
};
// Keep long ē/ō and emphatic z in natural, unvocalized Egyptian words where TTS knows them.
Object.assign(spoken, {'بَيْت':'بيت','يَوْم':'يوم','ذَوْق':'ذوق','نَظِيف':'نضيف','ذَيْل':'ديل','أُسْتَاذ':'استاذ','قَهْوَة':'قهوة','قَلَم':'قلم','قُطَّة':'قطة'});
const entries = new Map();
for (const item of drill.bank()) entries.set(item.audioKey, spoken[item.audioKey] || item.speech);
for (const item of [...data.STARTER_WORD_DATA,...data.EGYPTIAN_DIALECT_VOCAB,...Object.values(data.DB).flat()]) {
    entries.set(item.ar, spoken[item.ar] || item.ar);
}
const manifest={};
const jobs=[...entries].map(([key,text])=>{
    const name='classroom-'+crypto.createHash('sha256').update('ar-EG-SalmaNeural:'+text).digest('hex').slice(0,16)+'.mp3';
    manifest[key]='audio/'+name;
    manifest[key.replace(/[.؟،!…]/g,'').trim()]='audio/'+name;return {text,name};
});
let cursor=0;
const EDGE_BIN = process.env.EDGE_TTS_BIN || fs.existsSync('/Users/dragon/.local/bin/edge-tts') ? '/Users/dragon/.local/bin/edge-tts' : 'edge-tts';
async function worker(){while(cursor<jobs.length){const {text,name}=jobs[cursor++];const dest=path.join(__dirname,'audio',name);if(fs.existsSync(dest))continue;
    await run(EDGE_BIN,['--voice','ar-EG-SalmaNeural','--rate=-8%','--text',text,'--write-media',dest],{timeout:60000});}}
Promise.all(Array.from({length:4},worker)).then(()=>{
    fs.writeFileSync(path.join(__dirname,'audio/drill-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
    const originalPath=path.join(__dirname,'audio/manifest.json');
    const original=JSON.parse(fs.readFileSync(originalPath,'utf8'));
    original.audioFileCount=fs.readdirSync(path.join(__dirname,'audio')).filter(name=>name.endsWith('.mp3')).length;
    fs.writeFileSync(originalPath,JSON.stringify(original,null,2)+'\n');
    console.log('Curated Egyptian audio ready: '+entries.size+' keys');
}).catch(e=>{console.error(e.message);process.exitCode=1;});
