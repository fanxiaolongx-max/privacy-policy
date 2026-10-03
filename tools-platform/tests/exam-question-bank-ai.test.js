const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../backend/builtin-tools/f12-to-extension');
const source = fs.readFileSync(path.join(root, 'exam-question-bank-assistant.js'), 'utf8');
const packer = require(path.join(root, 'packer-core.js'));
function helpers(fetch = async () => {}, clock = performance, log = () => {}) {
  const start = source.indexOf('function redactAiText(');
  const end = source.indexOf('function readAiQuestion(', start);
  return new Function('aiFetch', 'logMsg', 'aiText', 'getNormComboStr', 'normalizeForCompare', 'performance', `${source.slice(start, end)}\nreturn {buildAiRequest,parseAiAnswers,voteAiAnswers,queryAiBatch,getAiExperience,isAiAnswerRejected,createAiRunStats,readAiTokenUsage,formatAiRunSummary,logAiQuestionTime,sanitizeAiJournal,getAiResponseSections};`)(fetch, log, (zh, en) => en, answers => [...answers].map(x => String(x).replace(/\s+/g, '').toLowerCase()).sort().join('|'), x => String(x).replace(/\s+/g, '').toLowerCase(), clock);
}
const question = { id: '1', type: '单选题', title: 'Choose', options: [{ label: 'A', text: 'Yes' }, { label: 'B', text: 'No' }] };
const model = { protocol: 'openai', model: 'test-model', url: 'https://example.com/v1/chat/completions', key: 'test-key', enabled: true };
const answer = options => ({ choices: [{ message: { content: JSON.stringify({ answers: [{ id: '1', options }] }) } }] });
test('protocol adapters separate auth from question payload, strip sensitive question fields, and reject insecure endpoints', () => {
  const h = helpers();
  for (const protocol of ['openai', 'responses', 'anthropic', 'gemini']) {
    const request = h.buildAiRequest({ ...model, protocol }, [{ ...question, title: 'password=hidden token=hidden API_KEY=hidden', cookie: 'not sent' }]);
    assert.equal(request.headers['Content-Type'], 'application/json');
    assert.ok(!JSON.stringify(request.body).includes('hidden'));
    assert.ok(!JSON.stringify(request.body).includes('test-key'));
    assert.ok(!JSON.stringify(request.body).includes('not sent'));
    if (protocol === 'anthropic') { assert.equal(request.headers['x-api-key'], 'test-key'); assert.equal(request.body.max_tokens, 4096); }
    if (protocol === 'gemini') { assert.equal(request.headers['x-goog-api-key'], 'test-key'); assert.match(request.url, /\/models\/test-model:generateContent$/); }
    if (protocol === 'responses') assert.equal(typeof request.body.input, 'string');
  }
  for (const url of ['http://remote.example/api', 'https://user:pass@example.com/api', 'https://example.com/api?key=secret']) assert.throws(() => h.buildAiRequest({ ...model, url }, []));
  assert.doesNotThrow(() => h.buildAiRequest({ ...model, url: 'http://localhost:11434/v1/chat/completions' }, []));
});
test('response parsing validates IDs, cardinality and option range for all protocols', () => {
  const h = helpers(); const text = JSON.stringify({ answers: [{ id: '1', options: ['B'] }] });
  for (const [protocol, data] of [
    ['openai', answer(['B'])], ['responses', { output: [{ content: [{ type: 'output_text', text }] }] }],
    ['anthropic', { content: [{ type: 'text', text }] }], ['gemini', { candidates: [{ content: { parts: [{ thought: true, text: 'ignore' }, { text }] } }] }]
  ]) assert.deepEqual(h.parseAiAnswers(data, { protocol }, [question]).get('1'), ['No']);
  for (const options of [['C'], ['A', 'B'], [], ['a'], [0]]) assert.equal(h.parseAiAnswers(answer(options), model, [question]).size, 0);
  assert.equal(h.parseAiAnswers({ choices: [{ message: { content: '{"answers":[{"id":"1","options":["A"]},{"id":"1","options":["B"]}]}' } }] }, model, [question]).size, 0);
  assert.deepEqual(h.parseAiAnswers(answer(['B', 'A']), model, [{ ...question, type: '多选题' }]).get('1'), ['No', 'Yes']);
  assert.throws(() => h.parseAiAnswers({ choices: [{ message: { content: 'A' } }] }, model, [question]));
});
test('models query concurrently, tolerate partial failure, and decline tied recommendations', async () => {
  let started = 0; const releases = [];
  const h = helpers(() => { started++; return new Promise(resolve => releases.push(resolve)); });
  const work = h.queryAiBatch([question], { models: [model, model, { ...model, enabled: false }] });
  assert.equal(started, 2);
  releases[0](answer(['A'])); releases[1](answer(['B']));
  assert.deepEqual((await work).get('1'), []);
  assert.deepEqual(h.voteAiAnswers([new Map([['1', ['Yes']]]), new Map([['1', ['Yes']]]), new Map([['1', ['No']]])], '1'), ['Yes']);
  let call = 0;
  const partial = helpers(async () => { if (++call === 1) throw new Error('failure'); return answer(['B']); });
  assert.deepEqual((await partial.queryAiBatch([question], { models: [model, model] })).get('1'), ['No']);
});
test('AI extension includes isolated relay and background for auto/manual launch and preserves ordinary packages', () => {
  for (const manualLaunch of [true, false]) {
    const result = packer.buildPackage({ name: 'Exam', code: source, matches: 'https://exam.example/*', manualLaunch });
    assert.ok(result.manifest.host_permissions.includes('https://*/*'));
    assert.equal(result.manifest.background.service_worker, 'background.js');
    assert.equal(result.manifest.content_scripts?.find(s => s.js.includes('content.js'))?.world || 'ISOLATED', 'ISOLATED');
    assert.ok(!result.files['exam-ai-relay.js']); assert.ok(result.files['exam-vault.html']);
    for (const [name, code] of Object.entries(result.files)) if (name.endsWith('.js')) new vm.Script(code, { filename: name });
  }
  const ordinary = packer.buildPackage({ code: 'console.log(1)', includePopup: false, matches: 'https://exam.example/*' });
  assert.equal(ordinary.manifest.background, undefined);
  assert.deepEqual(ordinary.manifest.host_permissions, ['https://exam.example/*']);
  const normalized = packer.validateOptions({ code: 'console.log("obfuscated")', examAiBridge: true }).options;
  assert.ok(packer.buildPackage(normalized).files['exam-ai-relay.js']);
});
test('batch collection skips confirmed bank questions, restores the current page and respects stop', async () => {
  const start = source.indexOf('async function collectAiBatch(');
  const end = source.indexOf('\nconst aiJournalDialog', start);
  const other = { ...question, id: '2', title: 'Other' };
  let current = question; const visits = []; const calls = [];
  const navItems = [question, other].map(q => ({ querySelector: () => null, click() { current = q; visits.push(q.id); } }));
  const collect = new Function('getQuestionSections', 'sleep', 'readAiQuestion', 'findQuestionVariant', 'findConfirmedAnswerAcrossBanks', 'getStorageKey', 'queryAiBatch', 'getAiExperience', 'getPageDelay', 'getQuestionNumber',
    `let isRunning = true; const scrapedData = []; ${source.slice(start, end)}; return {collectAiBatch, stop: () => {isRunning = false}};`)(
    () => [{ navItems, typeName: '单选题' }], async () => {}, () => current,
    (_data, _type, title) => title === 'Other' ? { 正确答案: ['Yes'] } : null,
    () => ({ status: 'none' }), () => 'bank', async payload => { calls.push(payload); return new Map([['1', ['Yes']]]); }, helpers().getAiExperience, value => value, (_nav, fallback) => fallback);
  const cache = new Map();
  await collect.collectAiBatch(0, 1, 0, question, { batchSize: 2, priority: 'bank' }, cache);
  assert.deepEqual(visits, ['2', '1']);
  assert.equal(calls[0].length, 1); assert.equal(calls[0][0].id, '1');
  assert.deepEqual(cache.get('1'), ['Yes']); assert.deepEqual(cache.get('2'), []);
  collect.stop();
  await collect.collectAiBatch(0, 1, 0, question, { batchSize: 2, priority: 'ai' }, new Map());
  assert.equal(calls.length, 1);
});
test('background transport omits cookies, hides provider errors and cancels only the sending frame', async () => {
  const generated = packer.buildPackage({ code: source.replace('TP_EXAM_VAULT_V1', ''), includePopup: false, matches: 'https://exam.example/*' });
  let listener; let request; let signal;
  const context = { URL, AbortController, TextDecoder, setTimeout, clearTimeout,
    chrome: { runtime: { id: 'extension', onMessage: { addListener(fn) { listener = fn; } } } },
    fetch: async (_url, init) => { request = init; signal = init.signal; return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('secret provider body')))); } };
  vm.runInNewContext(generated.files['background.js'], context);
  const sender = { id: 'extension', tab: { id: 1 }, frameId: 0 };
  const message = { type: 'TP_EXAM_AI_FETCH', id: '00000000-0000-0000-0000-000000000000', request: helpers().buildAiRequest(model, [question]) };
  const result = new Promise(resolve => listener(message, sender, resolve));
  assert.equal(request.credentials, 'omit'); assert.equal(request.redirect, 'error');
  listener({ ...message, type: 'TP_EXAM_AI_CANCEL' }, { ...sender, frameId: 1 }, () => {});
  assert.equal(signal.aborted, false);
  listener({ ...message, type: 'TP_EXAM_AI_CANCEL' }, sender, () => {});
  assert.equal(signal.aborted, true);
  const response = await result;
  assert.equal(response.ok, false); assert.ok(!response.error.includes('secret'));
});
test('answer flow keeps AI off by default and applies bank-first / AI-first without changing confirmed answers', async () => {
  const start = source.indexOf("document.getElementById('btn-auto-answer').onclick = async () => {");
  const end = source.indexOf("\ndocument.getElementById('btn-stop').onclick", start);
  for (const [enabled, priority, expectedQueries, expectedAnswer] of [[false, 'ai', 0, 'Yes'], [true, 'bank', 0, 'Yes'], [true, 'ai', 1, 'No']]) {
    const buttons = Object.fromEntries(['btn-auto-answer', 'btn-start', 'btn-stop', 'scraper-delay'].map(id => [id, { value: '1' }]));
    const bankQuestion = { 正确答案: ['Yes'], 猜测答案: [] };
    const selected = []; let queries = 0;
    const nav = { querySelector: () => null, scrollIntoView() {}, click() {} };
    const context = {
      document: { body: { innerText: 'Time Left' }, getElementById: id => buttons[id] },
      examNameInput: { value: 'bank' }, currentLang: 'en', currentStatusKey: 'ready',
      aiSettings: { enabled, priority, batchSize: 1, models: [] }, isRunning: false, scrapedData: [bankQuestion],
      isStudyRunning: false,
      beginAiJournal: async () => null, finishAiJournal() {},
      performance, createAiRunStats: helpers().createAiRunStats, logAiQuestionTime() {}, formatAiRunSummary: helpers().formatAiRunSummary, getPageDelay: value => value,
      t: key => key, showExamAlert() {}, setStatus() {}, logMsg() {}, totalEl: {},
      getQuestionSections: () => [{ typeName: '单选题', navItems: [nav] }], getQuestionNumber: () => 1,
      sleep: async () => {}, getEl: () => ({ innerText: 'Choose' }),
      getEls: () => [{ innerText: 'Yes' }, { innerText: 'No' }], cleanOptionText: x => x,
      detectCurrentQuestionType: () => '单选题', findQuestionVariant: () => bankQuestion,
      getAiExperience: helpers().getAiExperience, isAiAnswerRejected: helpers().isAiAnswerRejected,
      getQuestionVariantKey: () => '1', readAiQuestion: () => ({ id: '1' }),
      collectAiBatch: async (_s, _q, _d, _question, _settings, cache) => { queries++; cache.set('1', ['No']); },
      applyAnswerSelection: async answers => { selected.push(...answers); return { success: true, expectedCount: 1, selectedCount: 1, passes: 1, attempts: 1 }; },
      mapSavedAnswersToOptions: answers => ({ mappedAnswers: answers, unmappedAnswers: [] }),
      normalizeForCompare: x => x, stopAiRequests() {}, aiText: (_zh, en) => en, describeAnswers: answers => answers.join(),
      typeLabel: x => x
    };
    vm.runInNewContext(source.slice(start, end), context);
    await buttons['btn-auto-answer'].onclick();
    assert.equal(queries, expectedQueries);
    assert.deepEqual(selected, [expectedAnswer]);
    assert.deepEqual(bankQuestion.正确答案, ['Yes']);
    assert.equal(context.isRunning, false);
    assert.equal(buttons['btn-auto-answer'].disabled, false);
  }
});
test('platform API base URLs and full endpoints resolve to the selected protocol without duplicate paths', () => {
  const h = helpers();
  const cases = [
    ['responses', 'https://api2.fanxiaolong.uk/v1', '/v1/responses'],
    ['responses', 'https://api2.fanxiaolong.uk/v1/', '/v1/responses'],
    ['responses', 'https://example.com/v1/responses/', '/v1/responses'],
    ['openai', 'https://example.com/v1', '/v1/chat/completions'],
    ['openai', 'https://example.com', '/v1/chat/completions'],
    ['openai', 'https://example.com/v1/chat/completions', '/v1/chat/completions'],
    ['anthropic', 'https://example.com/v1', '/v1/messages'],
    ['anthropic', 'https://example.com/v1/messages/', '/v1/messages'],
    ['responses', 'https://example.com/proxy/v1', '/proxy/v1/responses'],
    ['openai', 'https://example.com/v1/responses', '/v1/chat/completions'],
    ['gemini', 'https://example.com/v1beta/', '/v1beta/models/test-model:generateContent'],
    ['gemini', 'https://example.com/v1beta/models/old-model:generateContent', '/v1beta/models/test-model:generateContent']
  ];
  for (const [protocol, url, expected] of cases) {
    const request = h.buildAiRequest({ ...model, protocol, url }, [question]);
    assert.equal(new URL(request.url).pathname, expected);
  }
});
test('AI error experience maps by option text after shuffling and omits unverified guesses and unmatched history', () => {
  const h = helpers();
  const shuffled = { ...question, options: [{ label: 'A', text: 'No' }, { label: 'B', text: 'Yes' }] };
  const saved = { 错误答案: [' Y e s ', 'Old option'], 猜测答案: ['No'], 错误组合: [['Yes', 'Old option']] };
  const experience = h.getAiExperience(shuffled, saved);
  assert.deepEqual(experience, { excludedOptions: ['B'], excludedCombinations: [] });
  const request = h.buildAiRequest(model, [{ ...shuffled, experience }]);
  const prompt = request.body.messages[0].content;
  const payload = JSON.parse(prompt.slice(prompt.indexOf('\n') + 1));
  assert.deepEqual(payload[0].experience, experience);
  assert.ok(!prompt.includes('Old option'));
  assert.equal(h.parseAiAnswers(answer(['B']), model, [{ ...shuffled, experience }]).size, 0);
  assert.deepEqual(h.parseAiAnswers(answer(['A']), model, [{ ...shuffled, experience }]).get('1'), ['No']);
});
test('multiple-choice failed combinations do not mark their individual options wrong', () => {
  const h = helpers();
  const multiple = { ...question, type: '多选题', options: [...question.options, { label: 'C', text: 'Maybe' }] };
  const experience = h.getAiExperience(multiple, { 错误答案: ['Yes', 'No'], 错误组合: [['Yes', 'No'], ['No', 'Yes']] });
  assert.deepEqual(experience, { excludedOptions: [], excludedCombinations: [['A', 'B']] });
  const q = { ...multiple, experience };
  assert.equal(h.parseAiAnswers(answer(['B', 'A']), model, [q]).size, 0);
  assert.deepEqual(h.parseAiAnswers(answer(['A', 'C']), model, [q]).get('1'), ['Yes', 'Maybe']);
  const definite = { ...multiple, experience: h.getAiExperience(multiple, { 明确错误答案: ['Maybe'] }) };
  assert.equal(h.parseAiAnswers(answer(['A', 'C']), model, [definite]).size, 0);
});
test('confirmed answers supersede conflicting old errors, and model votes exclude known wrong attempts', async () => {
  const h = helpers();
  const experience = h.getAiExperience(question, { 正确答案: ['Yes'], 错误答案: ['Yes', 'No'], 错误组合: [['Yes']] });
  assert.deepEqual(experience, { excludedOptions: ['B'], excludedCombinations: [] });
  let call = 0;
  const ai = helpers(async () => answer(++call <= 2 ? ['B'] : ['A']));
  const results = await ai.queryAiBatch([{ ...question, experience }], { models: [model, model, model] });
  assert.deepEqual(results.get('1'), ['Yes']);
});
test('true/false review deductions exclude the opposite option even without a stored error row', () => {
  const h = helpers();
  const q = { ...question, type: '判断题' };
  const experience = h.getAiExperience(q, { 正确答案: ['Yes'], 错误答案: [] });
  assert.deepEqual(experience.excludedOptions, ['B']);
  assert.equal(h.parseAiAnswers(answer(['B']), model, [{ ...q, experience }]).size, 0);
});
test('usage adapters use reported totals without double-counting cached or reasoning tokens', () => {
  const h = helpers();
  const cases = [
    ['openai', { usage: { prompt_tokens: 100, completion_tokens: 25, total_tokens: 125, completion_tokens_details: { reasoning_tokens: 10 } } }, 125],
    ['responses', { usage: { input_tokens: 80, output_tokens: 20, total_tokens: 100, input_tokens_details: { cached_tokens: 60 } } }, 100],
    ['anthropic', { usage: { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 30, cache_read_input_tokens: 40 } }, 100],
    ['gemini', { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, thoughtsTokenCount: 30, totalTokenCount: 60 } }, 60],
    ['gemini', { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, thoughtsTokenCount: 30 } }, 60],
    ['openai', { usage: { prompt_tokens: 0, completion_tokens: 0 } }, 0],
    ['openai', {}, null], ['openai', { usage: { prompt_tokens: 10 } }, null],
    ['responses', { usage: { total_tokens: -1 } }, null], ['gemini', { usageMetadata: { totalTokenCount: '100' } }, null]
  ];
  for (const [protocol, data, expected] of cases) assert.equal(h.readAiTokenUsage(data, protocol), expected);
});
test('parallel request totals add tokens but count batch wall time once, including failed answer parsing', async () => {
  let now = 0; let started = 0; const releases = [];
  const logs = [];
  const h = helpers(() => { started++; return new Promise(resolve => releases.push(resolve)); }, { now: () => now }, message => logs.push(message));
  const stats = h.createAiRunStats();
  const work = h.queryAiBatch([question, { ...question, id: '2' }], { models: [model, model] }, stats);
  assert.equal(started, 2);
  now = 1000;
  releases[0]({ ...answer(['A']), usage: { total_tokens: 100 } });
  await Promise.resolve(); await Promise.resolve();
  now = 2000;
  releases[1]({ choices: [{ message: { content: 'invalid JSON' } }], usage: { total_tokens: 200 } });
  const result = await work;
  assert.equal(stats.tokens, 300); assert.equal(stats.reportedRequests, 2);
  assert.equal(stats.unreportedRequests, 0);
  assert.equal(stats.durationMs, 2000); assert.equal(stats.questionCount, 2);
  assert.deepEqual(result.timing, { durationMs: 2000, questionCount: 2 });
  assert.match(h.formatAiRunSummary(stats), /AI total time: 2.00s/);
  assert.match(h.formatAiRunSummary(stats), /Average\/question: 1.00s/);
  stats.questionTimes.set('1', result.timing);
  h.logAiQuestionTime(question, 9, stats);
  assert.match(logs.at(-1), /Question 9.*batch of 2.*2.00s.*allocated 1.00s/);
  const empty = h.createAiRunStats(); assert.match(h.formatAiRunSummary(empty), /Average\/question: 0.00s/);
});
test('missing usage and failed or cancelled requests remain unknown instead of being reported as zero tokens', async () => {
  let call = 0; let now = 0;
  const h = helpers(async () => { now += 500; if (++call === 1) throw new Error('cancelled'); return answer(['A']); }, { now: () => now });
  const stats = h.createAiRunStats();
  await h.queryAiBatch([question], { models: [model, model] }, stats);
  assert.equal(stats.unreportedRequests, 2);
  assert.match(h.formatAiRunSummary(stats), /reported 0 \(2 request\(s\) with unknown usage\)/);
  assert.equal(stats.durationMs, 1000); assert.equal(stats.questionCount, 1);
});
test('log timestamps have fixed width and page delays independently stay within the bounded jitter', () => {
  const start = source.indexOf('function formatLogTimestamp('); const end = source.indexOf('\nfunction logMsg', start);
  const timestamp = new Function(`${source.slice(start, end)}; return formatLogTimestamp;`)();
  assert.equal(timestamp(new Date(2026, 9, 2, 1, 2, 3, 4)), '[01:02:03.004]');
  assert.equal(timestamp(new Date(2026, 9, 2, 23, 59, 59, 999)).length, 14);
  const delayStart = source.indexOf('const getPageDelay = '); const delayEnd = source.indexOf('\nconst optionListPath', delayStart);
  const pageDelay = new Function(`${source.slice(delayStart, delayEnd)}; return getPageDelay;`)();
  assert.equal(pageDelay(600, () => 0), 510); assert.equal(pageDelay(600, () => 1), 690);
  assert.equal(pageDelay(600, () => 0.5), 600);
  assert.equal(pageDelay(5000, () => 0), 4800); assert.equal(pageDelay(5000, () => 1), 5200);
  assert.equal(pageDelay(-100, () => 0), 0);
  assert.equal(pageDelay(0, () => 0), 0);
});
test('window appearance defaults, saved preferences and viewport positioning respect scaled visual dimensions', () => {
  const start = source.indexOf('function normalizeWindowAppearance(');
  const end = source.indexOf('\nconst appearanceDialog', start);
  function appearance(saved) {
    const window = { innerWidth: 1024, innerHeight: 768 };
    const widget = { style: {}, getBoundingClientRect() {
      const scale = Number((this.style.transform || 'scale(1)').match(/scale\(([^)]+)\)/)[1]);
      const width = Math.min(450, parseFloat(this.style.maxWidth) || 450) * scale;
      const height = Math.min(550, parseFloat(this.style.maxHeight) || 550) * scale;
      return { width, height, left: this.style.left ? parseFloat(this.style.left) : window.innerWidth - 20 - width,
        top: this.style.top ? parseFloat(this.style.top) : 100 };
    } };
    const localStorage = { getItem: () => saved };
    const api = new Function('examStorage', 'widget', 'window', `${source.slice(start, end)}; return {normalizeWindowAppearance, applyWindowAppearance, set: value => { windowAppearance = normalizeWindowAppearance(value); applyWindowAppearance(); }};`)(localStorage, widget, window);
    api.applyWindowAppearance(); return { api, widget, window };
  }
  const defaults = appearance(null);
  assert.equal(defaults.widget.style.opacity, '0.5');
  assert.equal(defaults.widget.style.transform, 'scale(0.5)');
  assert.equal(defaults.widget.style.left, '779px');
  assert.equal(defaults.widget.style.top, '100px');
  defaults.api.set({ opacity: 75, scale: 150 });
  assert.equal(defaults.widget.style.opacity, '0.75');
  assert.equal(defaults.widget.style.left, '349px');
  assert.equal(defaults.widget.style.top, '16px');
  defaults.window.innerWidth = 320; defaults.window.innerHeight = 480;
  defaults.api.applyWindowAppearance();
  const rect = defaults.widget.getBoundingClientRect();
  assert.ok(rect.left >= 0 && rect.left + rect.width <= 320);
  assert.ok(rect.top >= 0 && rect.top + rect.height <= 480);
  const restored = appearance('{"opacity":80,"scale":75}');
  assert.equal(restored.widget.style.opacity, '0.8'); assert.equal(restored.widget.style.transform, 'scale(0.75)');
  assert.equal(appearance('not JSON').widget.style.transform, 'scale(0.5)');
  assert.deepEqual(defaults.api.normalizeWindowAppearance({ opacity: -1, scale: 999 }), { opacity: 20, scale: 150 });
  assert.deepEqual(defaults.api.normalizeWindowAppearance({ opacity: 'bad', scale: Infinity }), { opacity: 50, scale: 50 });
  assert.deepEqual(defaults.api.normalizeWindowAppearance(null), { opacity: 50, scale: 50 });
});
test('diagnostic journal redacts credentials recursively and in raw echoed provider errors', () => {
  const h = helpers();
  const secret = 'SECRET_SENTINEL_123';
  const safe = h.sanitizeAiJournal({ request: { headers: { Authorization: `Bearer ${secret}`, 'x-api-key': secret }, body: { prompt: `echo ${secret}` } },
    response: { password: 'password-sentinel', nested: { access_token: 'access-sentinel' }, content: `Key echoed: ${secret}` },
    error: `Provider rejected ${secret}; token=another-sentinel` }, [secret]);
  const text = JSON.stringify(safe);
  for (const forbidden of [secret, 'password-sentinel', 'access-sentinel', 'another-sentinel']) assert.ok(!text.includes(forbidden));
  assert.equal(safe.request.headers.Authorization, '[REDACTED]');
  assert.equal(safe.request.headers['x-api-key'], '[REDACTED]');
  assert.match(safe.response.content, /REDACTED/);
  assert.match(h.sanitizeAiJournal('x'.repeat(49000)), /Truncated at 48000/);
});
test('background diagnostics preserve HTTP failure response and status for the journal', async () => {
  const generated = packer.buildPackage({ code: source.replace('TP_EXAM_VAULT_V1', ''), includePopup: false, matches: 'https://exam.example/*' });
  let listener;
  const context = { URL, AbortController, TextDecoder, setTimeout, clearTimeout,
    chrome: { runtime: { id: 'extension', onMessage: { addListener(fn) { listener = fn; } } } },
    fetch: async () => new Response('{"error":{"message":"Invalid endpoint"}}', { status: 404 }) };
  vm.runInNewContext(generated.files['background.js'], context);
  const response = await new Promise(resolve => listener({ type: 'TP_EXAM_AI_FETCH', id: '00000000-0000-0000-0000-000000000000', request: helpers().buildAiRequest(model, [question]) }, { id: 'extension', tab: { id: 1 }, frameId: 0 }, resolve));
  assert.equal(response.status, 404); assert.equal(response.ok, false);
  assert.equal(JSON.parse(response.responseText).error.message, 'Invalid endpoint');
});
function studyHelpers() {
  const start = source.indexOf('function getStudySourceKey(');
  const end = source.indexOf('function appendStudyNotes(', start);
  const normalize = x => String(x).replace(/\s+/g, '').toLowerCase();
  return new Function('getQuestionVariantKey', 'getNormComboStr', 'normalizeForCompare', 'cleanOptionText', 'getAiResponseSections', `${source.slice(start, end)}; return {getStudySourceKey,readStudyNotes,parseStudyResponse,buildStudyQuestion};`)(
    (type, title, options) => [type, title, ...[...options].sort()].join('|'), values => [...values].sort().join('|'), normalize, x => x, helpers().getAiResponseSections);
}
test('study notes translate every option and explain confirmed answers without modifying bank originals', () => {
  const h = studyHelpers();
  const bank = { 题型: '单选题', 题目: 'Which is correct?', 选项: ['Yes', 'No'], 正确答案: ['Yes'] };
  const original = JSON.stringify(bank); const q = h.buildStudyQuestion(bank, '1');
  const data = { choices: [{ message: { content: JSON.stringify({ questions: [{ id: '1', titleZh: '哪个正确？', options: [{ label: 'B', textZh: '否' }, { label: 'A', textZh: '是' }], concept: '判断真假。', explanation: '题库确认选择是。', recommendedOptions: ['A'] }] }) } }] };
  const notes = h.parseStudyResponse(data, model, [q]).get('1');
  assert.equal(JSON.stringify(bank), original);
  assert.deepEqual(notes.options, [{ original: 'Yes', textZh: '是' }, { original: 'No', textZh: '否' }]);
  assert.equal(notes.confirmed, true); assert.deepEqual(notes.recommendedAnswers, ['Yes']);
  bank.AI学习解析 = notes; assert.equal(h.readStudyNotes(bank), notes);
  bank.正确答案 = ['No']; assert.equal(h.readStudyNotes(bank), null);
  const payload = JSON.parse(data.choices[0].message.content); payload.questions[0].recommendedOptions = ['B'];
  data.choices[0].message.content = JSON.stringify(payload);
  assert.equal(h.parseStudyResponse(data, model, [q]).size, 0);
});
test('study parser rejects missing/duplicate translations and out-of-range answers, and labels unconfirmed recommendations', () => {
  const h = studyHelpers();
  const q = h.buildStudyQuestion({ 题型: '单选题', 题目: 'Choose', 选项: ['Yes', 'No'], 正确答案: [] }, '1');
  const row = { id: '1', titleZh: '请选择', options: [{ label: 'A', textZh: '是' }, { label: 'B', textZh: '否' }], concept: '真假', explanation: '尚未确认，仅作建议。', recommendedOptions: ['A'] };
  const data = value => ({ choices: [{ message: { content: JSON.stringify({ questions: [value] }) } }] });
  assert.equal(h.parseStudyResponse(data(row), model, [q]).get('1').confirmed, false);
  for (const bad of [{ ...row, options: row.options.slice(0, 1) }, { ...row, options: [row.options[0], row.options[0]] }, { ...row, recommendedOptions: ['C'] }, { ...row, recommendedOptions: ['A', 'B'] }]) assert.equal(h.parseStudyResponse(data(bad), model, [q]).size, 0);
  const request = helpers().buildAiRequest(model, [], 'Study prompt');
  assert.equal(request.body.messages[0].content, 'Study prompt');
});
