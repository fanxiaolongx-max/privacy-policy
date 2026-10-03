(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory;
    else root.createTPExamVault = factory;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createTPExamVault() {
    'use strict';
    const RECORD = 'tpExamEncryptedVaultV1';
    const SESSION = 'tpExamVaultSessionV1';
    const ITERATIONS = 600000;
    const LANGUAGE = 'tpExamLanguage';
    const detectLanguage = value => /^zh(?:-|_|$)/i.test(String(value || '')) ? 'zh' : 'en';
    const browserLanguage = () => detectLanguage(typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage ? chrome.i18n.getUILanguage() : typeof navigator !== 'undefined' ? navigator.language : 'en');
    const localText = (value, language) => { const parts = String(value).split(' / '); return parts.length === 2 ? parts[language === 'zh' ? 0 : 1] : String(value); };

    const allowed = key => typeof key === 'string' && (key.startsWith('ScraperData_') || ['exam_scraper_language', 'exam_window_appearance', 'scraper_close_behavior', 'exam_ai_preferences', 'exam_ai_journal'].includes(key));
    const encode = value => { const bytes = new Uint8Array(value); let text = ''; for (const byte of bytes) text += String.fromCharCode(byte); return btoa(text); };
    const decode = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));
    const fail = message => { throw new Error(message); };
    async function derive(password, salt) {
        const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
        return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: decode(salt), iterations: ITERATIONS }, material, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    }
    async function encrypt(key, data, salt, revision, passwordMode) {
        if (passwordMode !== undefined && !['pin', 'complex'].includes(passwordMode)) fail('Invalid password mode');
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const aad = new TextEncoder().encode(`TPExamVault:1:${salt}:${ITERATIONS}:${revision}${passwordMode === undefined ? '' : ':' + passwordMode}`);
        const text = JSON.stringify(data);
        if (text.length > 24000000) fail('题库超过保险库容量限制 / Vault size limit exceeded');
        const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, new TextEncoder().encode(text));
        return { version: 1, iterations: ITERATIONS, salt, revision, iv: encode(iv), ciphertext: encode(ciphertext), ...(passwordMode === undefined ? {} : { passwordMode }) };
    }
    async function decrypt(key, record) {
        if (!record || record.version !== 1 || record.iterations !== ITERATIONS || !Number.isSafeInteger(record.revision) || record.revision < 0 || decode(record.salt).length !== 16 || decode(record.iv).length !== 12) fail('加密数据格式不支持 / Unsupported encrypted data');
        if (record.passwordMode !== undefined && !['pin', 'complex'].includes(record.passwordMode)) fail('Invalid password mode');
        const aad = new TextEncoder().encode(`TPExamVault:1:${record.salt}:${ITERATIONS}:${record.revision}${record.passwordMode === undefined ? '' : ':' + record.passwordMode}`);
        const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(record.iv), additionalData: aad }, key, decode(record.ciphertext));
        const data = JSON.parse(new TextDecoder().decode(clear));
        if (!data || !data.origins || typeof data.origins !== 'object' || Array.isArray(data.origins)) fail('题库数据无效 / Invalid vault data');
        return data;
    }
    const newSalt = () => encode(crypto.getRandomValues(new Uint8Array(16)));
    const isExtension = () => typeof chrome !== 'undefined' && !!chrome.runtime?.id && !!chrome.runtime?.sendMessage;
    function background() {
        let queue = Promise.resolve(); let passwordWindow = null;
        const serial = task => { const run = queue.then(task); queue = run.catch(() => {}); return run; };
        const notify = async payload => { const tabs = await chrome.tabs.query({}); for (const tab of tabs) if (tab.id) chrome.tabs.sendMessage(tab.id, payload).catch(() => {}); chrome.runtime.sendMessage(payload).catch(() => {}); };
        const localRecord = async () => (await chrome.storage.local.get(RECORD))[RECORD];
        const getLanguage = async () => { const stored = (await chrome.storage.local.get(LANGUAGE))[LANGUAGE]; return ['zh', 'en'].includes(stored) ? stored : browserLanguage(); };
        const getSession = async () => (await chrome.storage.session.get(SESSION))[SESSION];
        const trusted = sender => sender.id === chrome.runtime.id && typeof sender.url === 'string' && sender.url.startsWith(chrome.runtime.getURL(''));
        const originOf = (message, sender) => {
            if (trusted(sender)) { const url = new URL(message.origin); if (!['https:', 'http:'].includes(url.protocol) || url.origin !== message.origin) fail('Invalid origin'); return url.origin; }
            if (!sender.tab || !sender.url) fail('Not allowed');
            const url = new URL(sender.url); if (!['https:', 'http:'].includes(url.protocol)) fail('Not allowed'); return url.origin;
        };
        const read = async () => {
            const record = await localRecord(); const session = await getSession();
            if (!record || !session || session.salt !== record.salt) fail('LOCKED');
            const key = await crypto.subtle.importKey('raw', decode(session.rawKey), 'AES-GCM', false, ['encrypt', 'decrypt']);
            return { record, key, data: await decrypt(key, record), session };
        };
        chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(() => {});
        if (typeof chrome.storage.local.setAccessLevel === 'function') chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(() => {});
        chrome.runtime.onMessage.addListener((message, sender, respond) => {
            if (sender.id !== chrome.runtime.id || ['TP_VAULT_LOCKED', 'TP_VAULT_CHANGED', 'TP_VAULT_LANGUAGE_CHANGED'].includes(message?.type) || !String(message?.type || '').startsWith('TP_VAULT_')) return;
            serial(async () => {
                const type = message.type;
                if (type === 'TP_VAULT_LANGUAGE') {
                    if (!trusted(sender)) originOf(message, sender);
                    if (message.language !== undefined) {
                        if (!['zh', 'en'].includes(message.language)) fail('Invalid language');
                        await chrome.storage.local.set({ [LANGUAGE]: message.language });
                        await notify({ type: 'TP_VAULT_LANGUAGE_CHANGED', language: message.language });
                    }
                    return { ok: true, language: await getLanguage() };
                }
                if (type === 'TP_VAULT_STATE') {
                    if (!trusted(sender)) fail('Not allowed');
                    const record = await localRecord(); return { ok: true, configured: !!record, language: await getLanguage(), passwordMode: record?.passwordMode || (record ? 'complex' : 'pin') };
                }
                if (type === 'TP_VAULT_UNLOCK') {
                    if (!trusted(sender) || new URL(sender.url).pathname !== '/exam-vault.html') fail('Not allowed');
                    const record = await localRecord();
                    const password = message.password;
                    if (typeof password !== 'string' || !password || password.length > 1024) fail('Invalid password');
                    const passwordMode = record?.passwordMode || message.passwordMode || 'pin';
                    if (!record && !['pin', 'complex'].includes(passwordMode)) fail('Invalid password mode');
                    if (!record && passwordError(password, passwordMode)) fail(passwordError(password, passwordMode));
                    const salt = record?.salt || newSalt(); const key = await derive(password, salt);
                    if (record) { try { await decrypt(key, record); } catch (_) { fail('密码错误或数据已损坏；未修改题库 / Wrong password or damaged data; vault unchanged'); } }
                    else { const initial = await encrypt(key, { origins: {} }, salt, 0, passwordMode); await chrome.storage.local.set({ [RECORD]: initial }); await decrypt(key, await localRecord()); }
                    const rawKey = encode(await crypto.subtle.exportKey('raw', key));
                    await chrome.storage.session.set({ [SESSION]: { salt, rawKey, modelKeys: {} } });
                    return { ok: true };
                }
                if (type === 'TP_VAULT_OPEN') {
                    originOf(message, sender);
                    if (passwordWindow !== null) { try { await chrome.windows.update(passwordWindow, { focused: true }); return { ok: true, windowId: passwordWindow }; } catch (_) { passwordWindow = null; } }
                    const opened = await chrome.windows.create({ url: chrome.runtime.getURL('exam-vault.html'), type: 'popup', width: 520, height: 740 });
                    passwordWindow = opened.id; return { ok: true, windowId: opened.id };
                }
                if (type === 'TP_VAULT_WINDOW') {
                    originOf(message, sender); if (passwordWindow !== message.windowId) fail('Cancelled');
                    await chrome.windows.get(passwordWindow); return { ok: true };
                }
                if (type === 'TP_VAULT_DETAILS') {
                    const origin = originOf(message, sender); const state = await read();
                    const url = new URL(chrome.runtime.getURL('exam-details.html')); url.searchParams.set('origin', origin); url.searchParams.set('bank', String(message.name || '').slice(0, 1000));
                    if (['ai', 'storage', 'import'].includes(message.view)) url.searchParams.set('view', message.view);
                    let ticket; let pending;
                    if (message.view === 'import' && message.file) {
                        if (typeof message.file.text !== 'string' || message.file.text.length > 24000000 || typeof message.file.name !== 'string') fail('Invalid import file');
                        ticket = crypto.randomUUID(); url.searchParams.set('import', ticket);
                        pending = await encrypt(state.key, { origins: {}, file: { name: message.file.name.slice(0, 300), text: message.file.text } }, state.record.salt, 0);
                    }
                    const opened = await chrome.windows.create({ url: url.href, type: 'popup', width: 1200, height: 850 });
                    if (ticket) {
                        state.session.pendingImports ||= {};
                        for (const [id, item] of Object.entries(state.session.pendingImports)) if (item.expiresAt < Date.now()) delete state.session.pendingImports[id];
                        state.session.pendingImports[ticket] = { origin, windowId: opened.id, expiresAt: Date.now() + 300000, record: pending };
                        try { await chrome.storage.session.set({ [SESSION]: state.session }); }
                        catch (error) { await chrome.windows.remove(opened.id).catch(() => {}); fail('文件转交失败，请在详情中心直接导入 / File handoff failed; import directly in the details window'); }
                    }
                    return { ok: true, windowId: opened.id };
                }
                const origin = originOf(message, sender); const state = await read();
                const stored = state.data.origins[origin] || { revision: 0, items: {} };
                if (type === 'TP_VAULT_TAKE_IMPORT') {
                    if (!trusted(sender)) fail('Not allowed');
                    const url = new URL(sender.url);
                    if (url.pathname !== '/exam-details.html' || url.searchParams.get('import') !== message.ticket || url.searchParams.get('origin') !== origin) fail('Not allowed');
                    const item = state.session.pendingImports?.[message.ticket];
                    if (!item || item.origin !== origin || item.expiresAt < Date.now()) fail('导入已过期或取消，请重新选择文件 / Import expired or cancelled; select the file again');
                    const decoded = await decrypt(state.key, item.record);
                    delete state.session.pendingImports[message.ticket]; await chrome.storage.session.set({ [SESSION]: state.session });
                    return { ok: true, file: decoded.file };
                }
                if (type === 'TP_VAULT_READ') return { ok: true, language: await getLanguage(), items: stored.items, revision: stored.revision, modelKeys: state.session.modelKeys?.[origin] || [], aiSession: state.session.aiConfigs?.[origin] || {} };
                if (type === 'TP_VAULT_EXPORT') return { ok: true, backup: { format: 'tp-exam-encrypted-backup', version: 1, record: await encrypt(state.key, { origins: { [origin]: stored } }, state.record.salt, 0, state.record.passwordMode) } };
                if (type === 'TP_VAULT_IMPORT') {
                    if (!trusted(sender)) fail('请在扩展详情窗口导入加密备份 / Import in the extension details window');
                    let key = state.key; if (message.password !== undefined) { if (typeof message.password !== 'string' || message.password.length > 1024) fail('Invalid password'); key = await derive(message.password, message.record.salt); }
                    try { return { ok: true, data: await decrypt(key, message.record) }; } catch (_) { fail('BACKUP_PASSWORD: 备份密码不匹配或文件损坏 / Wrong backup password or damaged file'); }
                }
                if (type === 'TP_VAULT_KEYS') {
                    if (!Array.isArray(message.models) || JSON.stringify(message.models).length > 100000) fail('Invalid model keys');
                    state.session.modelKeys ||= {}; state.session.modelKeys[origin] = message.models; state.session.aiConfigs ||= {}; state.session.aiConfigs[origin] = { enabled: message.enabled === true };
                    await chrome.storage.session.set({ [SESSION]: state.session }); return { ok: true };
                }
                if (type === 'TP_VAULT_WRITE') {
                    if (message.revision !== stored.revision) fail('CONFLICT: 其他窗口已修改题库，请导出未保存数据后重新打开 / Another window changed this bank; export unsaved data and reopen');
                    const items = message.items;
                    if (!items || typeof items !== 'object' || Array.isArray(items) || Object.entries(items).some(([key, value]) => !allowed(key) || typeof value !== 'string')) fail('Invalid vault items');
                    const updated = { revision: stored.revision + 1, items };
                    state.data.origins[origin] = updated;
                    const encrypted = await encrypt(state.key, state.data, state.record.salt, state.record.revision + 1, state.record.passwordMode);
                    await chrome.storage.local.set({ [RECORD]: encrypted });
                    // Verify the actual stored ciphertext before acknowledging a migration/write.
                    const verified = await decrypt(state.key, await localRecord());
                    if (JSON.stringify(verified.origins[origin]) !== JSON.stringify(updated)) fail('Write verification failed');
                    await notify({ type: 'TP_VAULT_CHANGED', origin, writer: message.writer });
                    return { ok: true, revision: updated.revision };
                }
                if (type === 'TP_VAULT_LOCK') {
                    await chrome.storage.session.remove(SESSION);
                    const tabs = await chrome.tabs.query({});
                    for (const tab of tabs) if (tab.id) chrome.tabs.sendMessage(tab.id, { type: 'TP_VAULT_LOCKED' }).catch(() => {});
                    chrome.runtime.sendMessage({ type: 'TP_VAULT_LOCKED' }).catch(() => {});
                    return { ok: true };
                }
                fail('Unsupported operation');
            }).then(respond).catch(error => respond({ ok: false, error: error.message === 'LOCKED' ? 'LOCKED' : String(error.message || 'Vault operation failed').slice(0, 500) }));
            return true;
        });
        chrome.windows.onRemoved.addListener(id => {
            if (passwordWindow === id) passwordWindow = null;
            serial(async () => { const session = await getSession(); if (!session?.pendingImports) return; let changed = false;
                for (const [ticket, item] of Object.entries(session.pendingImports)) if (item.windowId === id) { delete session.pendingImports[ticket]; changed = true; }
                if (changed) await chrome.storage.session.set({ [SESSION]: session });
            }).catch(() => {});
        });
    }
    const passwordError = (password, mode = 'complex') => mode === 'pin'
        ? (typeof password === 'string' && /^[0-9]{6}$/.test(password) ? '' : 'PIN 必须为 6 位数字 / Enter exactly 6 digits')
        : typeof password !== 'string' || password.length > 1024 || Array.from(password).length < 16 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password) || !/[^a-zA-Z0-9\s]/.test(password)
        ? '新密码至少 16 位，包含字母、数字和符号 / Use 16+ characters with a letter, digit and symbol' : '';
    function shuffledKeys(text) {
        const keys = Array.from(text);
        for (let i = keys.length - 1; i > 0; i--) {
            const limit = Math.floor(4294967296 / (i + 1)) * (i + 1); let value;
            do { value = crypto.getRandomValues(new Uint32Array(1))[0]; } while (value >= limit);
            const j = value % (i + 1); [keys[i], keys[j]] = [keys[j], keys[i]];
        }
        return keys;
    }
    // Password fields are masked; physical typing and the shuffled screen keyboard share one value.
    function screenKeyboard(host, options = {}) {
        const root = host.attachShadow({ mode: 'closed' });
        root.innerHTML = `<style>
            :host{display:block;color:#172033;font:12px/1.45 system-ui,sans-serif;color-scheme:light}
            *{box-sizing:border-box}[hidden]{display:none!important}form{margin:0}label{display:block;margin:6px 0;font-weight:600}
            input{width:100%;margin-top:4px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc;padding:6px;font:16px monospace;color:#334155;cursor:pointer}
            input.active{border-color:#6366f1;box-shadow:0 0 0 3px #6366f122}button{font:inherit;cursor:pointer;border:1px solid #dbe2ef;border-radius:10px;background:white;color:#334155;padding:6px 8px;touch-action:manipulation}
            button:hover{background:#eef2ff;border-color:#a5b4fc}button:active{transform:translateY(1px)}button:disabled{opacity:.5;cursor:wait}
            .tabs,.actions{display:flex;flex-wrap:wrap;gap:5px;margin:6px 0}.tabs button[aria-pressed=true]{background:#4f46e5;color:white;border-color:#4f46e5}
            .keys{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:4px;padding:8px;background:linear-gradient(135deg,#eef2ff,#f0fdfa);border:1px solid #e0e7ff;border-radius:16px}
            .keys button{min-height:28px;font:600 15px monospace;box-shadow:0 2px 3px #0f172a08}.actions button{flex:1;min-width:0;height:34px;padding:5px 8px;font-size:12px;line-height:1.3;white-space:nowrap}.actions .en{display:block;font-size:11px;font-weight:400;margin-top:3px}.submit{width:100%;background:#4f46e5;color:white;border:0;padding:9px;margin-top:8px;font-weight:600}
            .hint{color:#64748b;font-size:11px;margin:6px 0}.status{color:#92400e;overflow-wrap:anywhere;min-height:16px;font-size:11px}.unicode{background:#eef2ff;padding:8px;border-radius:8px}
            @media(max-width:360px){.keys{grid-template-columns:repeat(6,minmax(0,1fr));gap:4px;padding:8px}.keys button{padding:6px}.actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}}
        </style><form autocomplete="off"><div class="mode tabs"></div><label>密码 / Password<input name="password" type="password" inputmode="text" maxlength="1024" autocomplete="off" aria-label="密码 / Password"></label><label class="confirm">确认密码 / Confirm<input name="confirm" type="password" inputmode="text" maxlength="1024" autocomplete="off" aria-label="确认密码 / Confirm password"></label><p class="hint rules"></p><div class="tabs"></div><div class="unicode" hidden></div><div class="keys"></div><div class="actions"></div><p class="hint">支持实体键盘或屏幕键盘；屏幕按键随机排列。<br>Type with your keyboard or click the shuffled screen keys.</p><button class="submit" type="submit"></button><div class="status" role="status" aria-live="polite"></div></form>`;
        let language = options.language || browserLanguage(); const buttonLabels = new Map();
        const form = root.querySelector('form'); const status = root.querySelector('.status'); const submit = root.querySelector('.submit');
        const fields = { password: form.elements.password, confirm: form.elements.confirm }; let values = { password: '', confirm: '' }; let active = 'password'; let mode = options.passwordMode || (options.newPassword ? 'pin' : 'complex'); let group = mode === 'pin' ? '123' : 'abc'; let unicode = ''; let busy = false; let disposed = false;
        const groups = { abc: 'abcdefghijklmnopqrstuvwxyz', ABC: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '123': '0123456789', '#+=': '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~', 'U+': '0123456789ABCDEF' };
        root.querySelector('.confirm').hidden = !options.confirm;

        submit.textContent = options.submitLabel || '确认 / Confirm';
        function update() {
            for (const name of Object.keys(fields)) { if (fields[name].value !== values[name]) fields[name].value = values[name]; fields[name].classList.toggle('active', active === name); }
            root.querySelector('[data-action=space]').hidden = mode === 'pin';
            root.querySelector('.unicode').hidden = group !== 'U+';
            root.querySelector('[data-action=unicode]').hidden = group !== 'U+';
            root.querySelector('.unicode').textContent = (language === 'zh' ? '输入 Unicode 十六进制码，再点添加字符 · U+' : 'Enter Unicode hex, then Add · U+') + unicode;
            status.textContent = `${localText(active === 'confirm' ? '确认 / Confirm' : '密码 / Password', language)} · ${Array.from(values[active]).length} ${language === 'zh' ? '位' : 'characters'}`;
        }
        function button(label, target, handler, data = {}) {
            const element = document.createElement('button'); element.type = 'button'; element.textContent = label;
            buttonLabels.set(element, label); element.textContent = localText(label, language);
            for (const [name, value] of Object.entries(data)) element.dataset[name] = value;
            element.addEventListener('click', event => { if (event.isTrusted && !busy && !disposed) { handler(); if (!disposed && (target.classList.contains('keys') || target.classList.contains('actions'))) fields[active].focus(); } }); target.appendChild(element); return element;
        }
        function drawKeys() {
            const keys = root.querySelector('.keys'); keys.replaceChildren();
            for (const char of shuffledKeys(groups[group])) button(char, keys, () => {
                if (group === 'U+') { if (unicode.length < 6) unicode += char; }
                else if (values[active].length + char.length <= (mode === 'pin' ? 6 : 1024)) values[active] += char;
                update();
            }, { key: char });
            root.querySelectorAll('.tabs:not(.mode) button').forEach(element => element.setAttribute('aria-pressed', String(element.dataset.group === group))); update();
        }
        for (const name of ['abc', 'ABC', '123', '#+=', 'U+']) button(name, root.querySelector('.tabs:not(.mode)'), () => { group = name; unicode = ''; drawKeys(); }, { group: name });
        for (const name of Object.keys(fields)) {
            fields[name].addEventListener('focus', () => { if (!busy) { active = name; unicode = ''; update(); } });
            fields[name].addEventListener('input', () => {
                if (busy || disposed) return;
                values[name] = mode === 'pin' ? fields[name].value.replace(/[^0-9]/g, '').slice(0, 6) : fields[name].value.slice(0, 1024);
                active = name; update();
            });
        }
        const actions = root.querySelector('.actions');
        button('⌫ 删除 / Delete', actions, () => { if (group === 'U+') unicode = unicode.slice(0, -1); else values[active] = Array.from(values[active]).slice(0, -1).join(''); update(); });
        button('清空 / Clear', actions, () => { values[active] = ''; unicode = ''; update(); });
        button('↻ 打乱 / Shuffle', actions, drawKeys);
        button('空格 / Space', actions, () => { if (values[active].length < 1024) values[active] += ' '; update(); }, { action: 'space' });
        button('添加字符 / Add U+', actions, () => {
            const point = parseInt(unicode, 16);
            if (group !== 'U+' || !unicode || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) { status.textContent = localText('请选择 U+ 并输入有效字符编码 / Select U+ and enter a valid code point', language); return; }
            const char = String.fromCodePoint(point); if (values[active].length + char.length <= (mode === 'pin' ? 6 : 1024)) values[active] += char; unicode = ''; update();
        }, { action: 'unicode' });
        if (options.onCancel) button('取消 / Cancel', actions, options.onCancel);
        function configureMode() {
            group = mode === 'pin' ? '123' : 'abc'; unicode = '';
            root.querySelector('.keys').style.gridTemplateColumns = mode === 'pin' ? 'repeat(3,minmax(0,1fr))' : '';
            root.querySelector('.tabs:not(.mode)').hidden = mode === 'pin';
            root.querySelector('.rules').textContent = localText(mode === 'pin'
                ? '6 位数字 PIN · 输入方便，但防离线猜测能力较弱 / 6-digit PIN · convenient, weaker against offline guessing'
                : options.newPassword ? '至少 16 位 · 字母 + 数字 + 符号（不强制大小写） / 16+ characters · letter + digit + symbol' : '旧密码按原值输入，无需修改 / Enter your existing password unchanged', language);
            for (const field of Object.values(fields)) { field.inputMode = mode === 'pin' ? 'numeric' : 'text'; field.maxLength = mode === 'pin' ? 6 : 1024; }
            root.querySelectorAll('.mode button').forEach(element => element.setAttribute('aria-pressed', String(element.dataset.mode === mode)));
            drawKeys();
        }
        root.querySelector('.mode').hidden = !options.newPassword;
        if (options.newPassword) for (const [name, label] of [['pin', '简单 PIN（默认） / Simple PIN'], ['complex', '复杂密码 / Complex password']]) {
            button(label, root.querySelector('.mode'), () => { mode = name; values = { password: '', confirm: '' }; active = 'password'; configureMode(); fields.password.focus(); }, { mode: name });
        }
        form.addEventListener('submit', async event => {
            event.preventDefault(); if (busy || disposed) return;
            const error = options.newPassword ? passwordError(values.password, mode) : (!values.password ? '请输入密码 / Enter a password' : '');
            if (error || (options.confirm && values.password !== values.confirm)) { status.textContent = localText(error || '两次密码不一致 / Passwords do not match', language); return; }
            busy = true; root.querySelectorAll('button,input').forEach(element => { element.disabled = true; }); status.textContent = localText('正在处理… / Processing…', language);
            try { await options.onSubmit(values.password, mode); }
            catch (error) { values = { password: '', confirm: '' }; unicode = ''; active = 'password'; drawKeys(); status.textContent = localText(error.message || error, language); }
            finally { busy = false; if (!disposed) root.querySelectorAll('button,input').forEach(element => { element.disabled = false; }); }
        });
        function setLanguage(value) {
            if (disposed) return;
            language = value;
            fields.password.parentElement.firstChild.nodeValue = localText('密码 / Password', language);
            fields.confirm.parentElement.firstChild.nodeValue = localText('确认密码 / Confirm', language);
            for (const [element, label] of buttonLabels) element.textContent = localText(label, language);
            submit.textContent = localText(options.submitLabel || '确认 / Confirm', language);
            root.querySelectorAll('.hint')[1].textContent = language === 'zh' ? '支持实体键盘，也可点击随机屏幕按键。' : 'Type with your keyboard or click the shuffled keys.';
            const rules = mode === 'pin' ? '6 位数字 PIN · 输入方便，但防离线猜测能力较弱 / 6-digit PIN · convenient, weaker against offline guessing' : options.newPassword ? '至少 16 位 · 字母 + 数字 + 符号（不强制大小写） / 16+ characters · letter + digit + symbol' : '旧密码按原值输入，无需修改 / Enter your existing password unchanged';
            root.querySelector('.rules').textContent = localText(rules, language); update();
        }
        configureMode(); setLanguage(language); fields.password.focus();
        return { setLanguage, destroy() { disposed = true; values = { password: '', confirm: '' }; unicode = ''; root.replaceChildren(); } };
    }
    function requestPassword(options = {}) {
        return new Promise(resolve => {
            const overlay = document.createElement('div'); overlay.style.cssText = 'position:fixed;inset:0;background:#0f172a88;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
            const panel = document.createElement('div'); panel.style.cssText = 'background:white;color:#172033;padding:24px;border-radius:20px;width:500px;max-width:100%;max-height:90vh;overflow:auto;box-shadow:0 24px 80px #0003;font:14px system-ui';
            const heading = document.createElement('h2'); heading.textContent = localText(options.title || '题库密码 / Vault password', options.language || browserLanguage()); heading.style.cssText = 'font-size:20px;margin:0 0 12px';
            const host = document.createElement('div'); panel.append(heading, host); overlay.append(panel); document.body.append(overlay);
            let controller; const finish = (password, passwordMode) => { controller.destroy(); overlay.remove(); resolve(password !== null && options.includeMode ? { password, passwordMode } : password); };
            controller = screenKeyboard(host, { ...options, onSubmit: finish, onCancel: () => finish(null) });
        });
    }
    async function passwordPage() {
        const status = document.getElementById('vault-status');
        const state = await chrome.runtime.sendMessage({ type: 'TP_VAULT_STATE' });
        if (!state?.ok) { status.textContent = state?.error || 'Vault unavailable'; return; }
        let language = state.language || browserLanguage();
        const keyboard = screenKeyboard(document.getElementById('vault-keyboard'), {
            language, passwordMode: state.passwordMode, confirm: !state.configured, newPassword: !state.configured,
            submitLabel: state.configured ? '解锁 / Unlock' : '创建保险库 / Create vault',
            onSubmit: async (password, passwordMode) => {
                const result = await chrome.runtime.sendMessage({ type: 'TP_VAULT_UNLOCK', password, passwordMode });
                if (!result?.ok) throw new Error(result?.error || 'Unlock failed');
                keyboard.destroy(); status.textContent = localText('已解锁，本次浏览器会话无需重复输入 / Unlocked for this browser session', language); setTimeout(() => window.close(), 600);
            }
        });
        function applyLanguage(value) {
            language = value; document.documentElement.lang = value === 'zh' ? 'zh-CN' : 'en';
            document.title = value === 'zh' ? '题库保险库' : 'Question bank vault';
            document.getElementById('vault-title').textContent = localText(state.configured ? '解锁题库 / Unlock question banks' : '设置题库密码 / Set vault password', value);
            document.getElementById('vault-language').textContent = value === 'zh' ? 'EN' : '中文';
            document.getElementById('vault-intro').textContent = value === 'zh' ? '密码只在扩展窗口输入。每次浏览器会话解锁一次，关闭浏览器或手动锁定后需重新解锁。' : 'Enter your password inside the extension. Unlock once per browser session; unlock again after restarting or locking.';
            document.getElementById('vault-note').textContent = value === 'zh' ? '默认 6 位 PIN，可选复杂密码。忘记密码无法恢复，请妥善保存。取消不会清空旧题库。' : 'Choose a 6-digit PIN or a complex password. Forgotten passwords cannot be recovered. Cancelling preserves your banks.';
            keyboard.setLanguage(value);
        }
        const handleLanguage = message => { if (message?.type === 'TP_VAULT_LANGUAGE_CHANGED') applyLanguage(message.language); };
        chrome.runtime.onMessage.addListener(handleLanguage);
        document.getElementById('vault-language').onclick = async () => {
            const result = await chrome.runtime.sendMessage({ type: 'TP_VAULT_LANGUAGE', language: language === 'zh' ? 'en' : 'zh' });
            if (result?.ok) applyLanguage(result.language);
        };
        applyLanguage(language);
        window.addEventListener('pagehide', () => { keyboard.destroy(); chrome.runtime.onMessage.removeListener(handleLanguage); }, { once: true });
    }
    function adapter(items, writer, options = {}) {
        let cache = { ...items }; let pending = Promise.resolve(); let failure = null; let disposed = false; let dirty = 0;
        const store = {
            ...options,
            get length() { return Object.keys(cache).length; },
            key(index) { return Object.keys(cache)[index] || null; },
            getItem(key) { return Object.hasOwn(cache, key) ? cache[key] : null; },
            setItem(key, value) { if (disposed) fail('LOCKED'); if (!allowed(key)) fail('Not a tool storage key'); cache[key] = String(value); schedule(); },
            setItems(items) { if (disposed) fail('LOCKED'); if (Object.entries(items).some(([key, value]) => !allowed(key) || typeof value !== 'string')) fail('Invalid items'); Object.assign(cache, items); schedule(); },
            replaceSnapshot(items) { if (!dirty && !disposed && !failure) { cache = { ...items }; return true; } return false; },
            get dirty() { return dirty; },
            removeItem(key) { if (disposed) fail('LOCKED'); delete cache[key]; schedule(); },
            flush: async () => { await pending; if (failure) throw failure; },
            dispose() { disposed = true; cache = {}; },
            get failed() { return failure; },
            onError: null, onLock: null, onSaved: null, onRefresh: null,
            snapshot: () => ({ ...cache })
        };
        function schedule() {
            if (failure) return;
            const snapshot = { ...cache }; dirty++; store.onSaved?.('pending');
            pending = pending.then(async () => { if (failure) throw failure; await writer(snapshot); store.onSaved?.('saved'); }).catch(error => { if (!failure) { failure = error; store.onError?.(error); } }).finally(() => { dirty--; });
        }
        return store;
    }
    async function migrate(storage, nativeStorage) {
        const changes = []; let malformed = 0; let collisions = 0;
        for (let index = 0; index < nativeStorage.length; index++) {
            const key = nativeStorage.key(index); if (!allowed(key)) continue;
            const raw = nativeStorage.getItem(key); if (raw === null) continue;
            if (key.startsWith('ScraperData_')) {
                try { const bank = JSON.parse(raw); if (!Array.isArray(bank) || bank.some(q => !q || typeof q !== 'object' || typeof (q.题目 ?? q.question) !== 'string' || !Array.isArray(q.选项 ?? q.options))) throw new Error(); }
                catch (_) { malformed++; continue; }
            }
            let target = key; const existing = storage.getItem(key);
            if (existing !== null && existing !== raw) {
                if (!key.startsWith('ScraperData_')) continue;
                target = key + ' (旧题库迁移)'; let suffix = 2;
                while (storage.getItem(target) !== null && storage.getItem(target) !== raw) target = key + ` (旧题库迁移 ${suffix++})`;
                collisions++;
            }
            if (storage.getItem(target) !== raw) storage.setItem(target, raw);
            changes.push({ key, raw });
        }
        await storage.flush();
        // Never delete a legacy item until encrypted persistence has succeeded, or if it changed meanwhile.
        let changed = 0;
        for (const change of changes) { const current = nativeStorage.getItem(change.key); if (current === change.raw) nativeStorage.removeItem(change.key); else if (current !== null) changed++; }
        return { changed, migrated: changes.filter(item => item.key.startsWith('ScraperData_')).length, malformed, collisions };
    }
    async function open() {
        if (!crypto?.subtle) fail('需要 HTTPS 或 localhost 才能启用题库加密 / Encryption requires HTTPS or localhost');
        const extension = isExtension();
        const detailMode = extension && location.protocol === 'chrome-extension:' && location.pathname.endsWith('/exam-details.html');
        const origin = detailMode ? new URL(location.href).searchParams.get('origin') : location.origin;
        if (extension) {
            const send = async (type, data = {}) => { const result = await chrome.runtime.sendMessage({ type, origin, ...data }); if (!result?.ok) fail(result?.error || 'Extension vault unavailable'); return result; };
            let state = await chrome.runtime.sendMessage({ type: 'TP_VAULT_READ', origin });
            if (!state?.ok && state?.error === 'LOCKED') {
                const opened = await send('TP_VAULT_OPEN');
                const notice = document.createElement('div'); notice.textContent = '请在扩展窗口设置密码或解锁题库。关闭解锁窗口可取消。 / Unlock in the extension window; close it to cancel.';
                notice.style.cssText = 'position:fixed;top:16px;left:16px;right:16px;padding:18px;background:#0f172a;color:white;z-index:2147483647;border-radius:10px'; document.body.appendChild(notice);
                try {
                    for (let attempt = 0; attempt < 300; attempt++) {
                        await new Promise(resolve => setTimeout(resolve, 700)); state = await chrome.runtime.sendMessage({ type: 'TP_VAULT_READ', origin }); if (state?.ok) break;
                        // Content scripts cannot query windows; ask the worker whether the password window is still alive.
                        const exists = await chrome.runtime.sendMessage({ type: 'TP_VAULT_WINDOW', origin, windowId: opened.windowId });
                        if (!exists?.ok) fail('已取消解锁，题库未修改 / Unlock cancelled; banks unchanged');
                    }
                } finally { notice.remove(); }
            }
            if (!state?.ok) fail(state?.error || 'Unlock timed out');
            let revision = state.revision; const writer = crypto.randomUUID();
            const storage = adapter(state.items, async items => { const result = await send('TP_VAULT_WRITE', { revision, items, writer }); revision = result.revision; }, {
                extension: true, detailMode, origin, language: state.language, setLanguage: language => send('TP_VAULT_LANGUAGE', { language }), modelKeys: state.modelKeys, aiSession: state.aiSession,
                setModelKeys: (models, enabled) => send('TP_VAULT_KEYS', { models, enabled }),
                openDetails: (name, view, file) => send('TP_VAULT_DETAILS', { name, view, ...(file ? { file } : {}) }),
                takeImport: ticket => send('TP_VAULT_TAKE_IMPORT', { ticket }),
                exportEncrypted: async () => (await send('TP_VAULT_EXPORT')).backup,
                decryptBackup: async (record, password) => (await send('TP_VAULT_IMPORT', { record, ...(password === undefined ? {} : { password }) })).data,
                lock: () => send('TP_VAULT_LOCK')
            });
            const handleRuntime = message => {
                if (message?.type === 'TP_VAULT_LANGUAGE_CHANGED') { storage.language = message.language; storage.onLanguage?.(message.language); }
                if (message?.type === 'TP_VAULT_LOCKED') { storage.dispose(); storage.onLock?.(); }
                if (message?.type === 'TP_VAULT_CHANGED' && message.origin === origin && message.writer !== writer && !storage.dirty) {
                    send('TP_VAULT_READ').then(current => { if (storage.replaceSnapshot(current.items)) { revision = current.revision; storage.modelKeys = current.modelKeys; storage.aiSession = current.aiSession; storage.onRefresh?.(); } }).catch(() => {});
                }
            };
            chrome.runtime.onMessage.addListener(handleRuntime);
            const dispose = storage.dispose; storage.dispose = () => { dispose(); storage.modelKeys = []; chrome.runtime.onMessage.removeListener(handleRuntime); };
            if (!detailMode) storage.migration = await migrate(storage, window.localStorage);
            return storage;
        }
        // Console/F12 mode encrypts at rest, but its password prompt shares the host page environment.
        const native = window.localStorage; let record;
        try { record = JSON.parse(native.getItem(RECORD) || 'null'); } catch (_) { fail('加密题库格式损坏，未覆盖 / Damaged encrypted vault; not overwritten'); }
        const preferredLanguage = native.getItem(LANGUAGE) || browserLanguage();
        const credential = await requestPassword({ language: preferredLanguage, title: record ? '解锁题库 / Unlock vault (F12)' : '设置题库密码 / Create vault (F12)', passwordMode: record?.passwordMode || (record ? 'complex' : 'pin'), confirm: !record, newPassword: !record, includeMode: true });
        if (credential === null) fail('已取消，旧题库未修改 / Cancelled; banks unchanged');
        const { password, passwordMode } = credential;
        const storedMode = record ? record.passwordMode : passwordMode;
        const salt = record?.salt || newSalt(); let key = await derive(password, salt);
        let data;
        try { data = record ? await decrypt(key, record) : { origins: {} }; } catch (_) { fail('密码错误或数据损坏，未修改 / Wrong password or damaged data; unchanged'); }
        let revision = record?.revision || 0;
        const writeUnlocked = async items => {
            const current = native.getItem(RECORD); if (current !== (record ? JSON.stringify(record) : null)) fail('其他窗口修改了加密题库 / Another window changed the vault');
            data.origins[origin] = { revision: revision + 1, items }; const updated = await encrypt(key, data, salt, revision + 1, storedMode);
            if (native.getItem(RECORD) !== current) fail('其他窗口修改了加密题库 / Another window changed the vault');
            native.setItem(RECORD, JSON.stringify(updated)); await decrypt(key, JSON.parse(native.getItem(RECORD)));
            record = updated; revision++;
        };
        const write = items => typeof navigator !== 'undefined' && navigator.locks?.request ? navigator.locks.request(RECORD, () => writeUnlocked(items)) : writeUnlocked(items);
        const storage = adapter(data.origins[origin]?.items || {}, write, { extension: false, detailMode: false, origin, language: preferredLanguage, setLanguage: async language => { native.setItem(LANGUAGE, language); }, modelKeys: [], exportEncrypted: async () => ({ format: 'tp-exam-encrypted-backup', version: 1, record: await encrypt(key, { origins: { [origin]: { revision: 0, items: storage.snapshot() } } }, salt, 0, storedMode) }), decryptBackup: async (backup, password) => decrypt(password === undefined ? key : await derive(password, backup.salt), backup), lock: async () => { storage.dispose(); } });
        const dispose = storage.dispose; storage.dispose = () => { dispose(); key = null; data = { origins: {} }; };
        if (!record) { await write({}); }
        storage.migration = await migrate(storage, native); return storage;
    }
    return { derive, encrypt, decrypt, newSalt, adapter, migrate, open, background, passwordPage, requestPassword, browserLanguage, detectLanguage, passwordError, shuffledKeys, allowed, RECORD, SESSION };
});
