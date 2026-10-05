/*
 * NetCare RFC Word downloader — paste the entire file into Chrome Console.
 * First paste: NetCare top context. Second paste (once): rfc-word-worker context.
 * No credentials are exported or persisted. Uses the site's original download
 * action for every RFC so its authorization/compliance checks remain in place.
 */
(() => {
  'use strict';
  const CHANNEL = 'netcare-rfc-word-v1';
  const NETCARE = 'https://netcare-ae.gts.huawei.com';
  const ID = 'netcare-rfc-word-panel';
  const validOrder = value => /^NC\d{14}$/.test(value);
  const validExport = value => {
    const u = new URL(value);
    return u.protocol === 'https:' && /(^|\.)kdp\.gts\.huawei\.com$/.test(u.hostname)
      && u.pathname === '/ows1/static/editor/IdpLiteView/PublishLiteView.html';
  };

  // Execute this branch once in the named, cross-origin export iframe.
  if (validExport(location.href) && window.name === 'rfc-word-worker') {
    window.__rfcWordWorkerCleanup?.();
    const jobs = new Map();
    const tell = message => parent.postMessage({ channel: CHANNEL, ...message }, NETCARE);
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
          tell({ type: 'done', job, text: `已获取 Word 文件（${Math.round(blob.size / 1024)} KB），已发起保存；请在 Chrome 下载记录中确认。` });
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
      if (event.origin !== NETCARE || event.source !== parent || event.data?.channel !== CHANNEL) return;
      const message = event.data;
      if (message.type === 'hello') return tell({ type: 'ready' });
      if (message.type === 'cancel') return jobs.get(message.job)?.abort();
      if (message.type !== 'run' || !validOrder(message.order) || typeof message.job !== 'string') return;
      if (jobs.size) return tell({ type: 'error', job: message.job, text: '导出服务正忙，请先停止当前任务' });
      const controller = new AbortController();
      jobs.set(message.job, controller);
      run(message, controller.signal).catch(error => tell({ type: 'error', job: message.job, text: error.message }))
        .finally(() => jobs.delete(message.job));
    };
    window.addEventListener('message', receive);
    window.__rfcWordWorkerCleanup = () => {
      jobs.forEach(controller => controller.abort());
      window.removeEventListener('message', receive);
    };
    tell({ type: 'ready' });
    console.info('RFC Word 导出服务已连接。切回 top 上下文，使用页面右下角浮窗即可。');
    return;
  }

  if (location.origin !== NETCARE) throw new Error('请在 NetCare 页面 top 上下文执行；服务端上下文请选 rfc-word-worker');
  if (window !== window.top) throw new Error('请先在 Console 左上角选择 top 上下文');
  window.__rfcWordPanelCleanup?.();
  const host = document.createElement('div');
  host.id = ID;
  host.style.cssText = 'position:fixed;right:20px;bottom:20px;width:min(390px,calc(100vw - 24px));z-index:2147483647';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    *{box-sizing:border-box}section{font:14px/1.5 system-ui,sans-serif;background:#fff;color:#182338;border:1px solid #ccd6e5;border-radius:14px;box-shadow:0 8px 35px #0003;padding:16px}
    header{display:flex;justify-content:space-between;font-weight:700;cursor:move;touch-action:none}button,input,select{font:inherit}button{cursor:pointer;border:0;border-radius:7px;padding:8px 12px;background:#edf2f8;color:#182338}button:disabled{opacity:.5;cursor:default}
    input,select{width:100%;padding:10px;margin:12px 0 8px;border:1px solid #b5c3d6;border-radius:7px;background:#fff;color:#182338}select[hidden]{display:none}.actions{display:flex;gap:8px}.primary{background:#076ad6;color:#fff}
    pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.6 system-ui;max-height:210px;overflow:auto;background:#f4f7fb;padding:10px;border-radius:8px}small{display:block;color:#53647d;margin-top:9px}.badge{font-size:12px;color:#53647d}
  </style><section><header><span>RFC 方案 Word 下载</span><button id="close" aria-label="关闭">×</button></header>
    <div class="badge" id="connection">导出服务：尚未连接</div>
    <input id="order" aria-label="RFC 单号" placeholder="例如 NC20261001000381" autocomplete="off">
    <select id="plans" aria-label="选择方案" hidden></select>
    <div class="actions"><button id="run" class="primary">查找并下载</button><button id="stop" disabled>停止</button></div>
    <pre id="log" role="status">输入 RFC 单号后点击“查找并下载”。</pre>
    <small>首次连接：在 Console 上下文中选 rfc-word-worker，再粘贴本脚本一次。刷新页面后需重新连接。停止只停止等待，不取消服务端任务。</small>
  </section>`;
  document.body.append(host);
  const $ = id => root.getElementById(id);
  let bridge, exportOrigin, connected = false, active, selection;
  const log = text => {
    $('log').textContent += '\n' + text;
    $('log').scrollTop = $('log').scrollHeight;
  };
  const visible = element => element && element.getClientRects().length > 0
    && element.ownerDocument.defaultView.getComputedStyle(element).visibility !== 'hidden';
  const post = message => bridge?.contentWindow.postMessage({ channel: CHANNEL, ...message }, exportOrigin);
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
  const receive = event => {
    if (!bridge || event.source !== bridge.contentWindow || event.origin !== exportOrigin || event.data?.channel !== CHANNEL) return;
    const message = event.data;
    if (message.type === 'ready') {
      connected = true;
      $('connection').textContent = '导出服务：已连接';
      log('导出服务连接成功。');
      return;
    }
    if (!active || message.job !== active.job) return;
    if (message.type === 'progress') log(message.text);
    else if (message.type === 'done') active.resolve(message.text);
    else if (message.type === 'error') active.reject(new Error(message.text));
  };
  window.addEventListener('message', receive);
  async function start() {
    const order = $('order').value.trim().toUpperCase();
    $('order').value = order;
    if (!validOrder(order)) { log('单号格式应为 NC + 14 位数字。'); return; }
    if (active) return;
    const controller = new AbortController();
    const signal = controller.signal;
    const job = crypto.randomUUID();
    active = { controller, job };
    $('run').disabled = true;
    $('stop').disabled = false;
    $('order').disabled = true;
    $('log').textContent = `正在处理 ${order}`;
    try {
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
        if (selection?.order === order && selection.doc === doc) {
          button = buttons[Number($('plans').value)];
          if (!button) throw new Error('方案列表已变化，请重新查询');
        } else {
          $('plans').replaceChildren(...buttons.map((item, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = item.closest('tr')?.querySelector('td')?.textContent.trim() || `方案 ${index + 1}`;
            return option;
          }));
          $('plans').hidden = false;
          selection = { order, doc };
          log(`找到 ${buttons.length} 个方案，请选择后再次点击下载。`);
          return;
        }
      } else { $('plans').hidden = true; selection = null; }
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
      if (!bridge || exportOrigin !== url.origin) {
        bridge?.remove();
        connected = false;
        exportOrigin = url.origin;
        bridge = document.createElement('iframe');
        bridge.id = bridge.name = 'rfc-word-worker';
        bridge.title = 'RFC Word 导出服务连接';
        // Keep a real browsing context; display:none may throttle the page.
        bridge.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;border:0;opacity:.01;pointer-events:none';
        bridge.src = url.href;
        document.body.append(bridge);
        $('connection').textContent = '导出服务：等待初始化';
        log('首次连接：Console 左上角 top 下拉 → rfc-word-worker → 再粘贴本脚本。连接后将自动继续。');
      }
      doc.querySelector('button.nc-close')?.click();
      post({ type: 'hello' });
      await wait(() => connected, 5 * 60 * 1000, signal, '连接等待超时；请选择 rfc-word-worker 上下文并粘贴本脚本，再重试');
      log('授权入口已通过，开始生成 Word…');
      const result = await new Promise((resolve, reject) => {
        active.resolve = resolve;
        active.reject = reject;
        signal.addEventListener('abort', () => reject(new Error('已停止等待')), { once: true });
        post({ type: 'run', job, order });
        if (signal.aborted) reject(new Error('已停止等待'));
      });
      log(result);
    } catch (error) { log(error.message); }
    finally {
      active = null;
      $('run').disabled = false;
      $('stop').disabled = true;
      $('order').disabled = false;
    }
  }
  $('run').onclick = start;
  $('order').onkeydown = event => { if (event.key === 'Enter') start(); };
  $('order').oninput = () => { selection = null; $('plans').hidden = true; };
  $('stop').onclick = () => { if (active) { post({ type: 'cancel', job: active.job }); active.controller.abort(); } };
  const cleanup = () => {
    if (active) { post({ type: 'cancel', job: active.job }); active.controller.abort(); }
    window.removeEventListener('message', receive);
    bridge?.remove();
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
  console.info('RFC Word 浮窗已打开；点击 × 可清理浮窗和连接。');
})();
