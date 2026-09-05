(function authorizedMediaExporter() {
  'use strict';

  const PANEL_ID = 'tools-authorized-media-exporter';
  const STYLE_ID = `${PANEL_ID}-style`;
  const MEDIA_PATTERN = /\.(?:m3u8|mp4|webm|mov)(?:$|[?#])/i;
  const state = { items: [] };

  function removeExporter() {
    document.getElementById(PANEL_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
    window.removeEventListener('message', handleExtensionMessage);
    delete window.__toolsAuthorizedMediaExporterCleanup;
  }

  if (typeof window.__toolsAuthorizedMediaExporterCleanup === 'function') {
    window.__toolsAuthorizedMediaExporterCleanup();
  }
  window.__toolsAuthorizedMediaExporterCleanup = removeExporter;

  function handleExtensionMessage(event) {
    if (event.source !== window || event.data?.source !== 'EXTENSION_POPUP') return;
    if (event.data.action === 'STOP') removeExporter();
  }
  window.addEventListener('message', handleExtensionMessage);

  function normalizeUrl(value) {
    try {
      const url = new URL(String(value || '').trim(), location.href);
      if (!['http:', 'https:'].includes(url.protocol) || !MEDIA_PATTERN.test(url.href)) return '';
      return url.href;
    } catch (_error) {
      return '';
    }
  }

  function cleanFilePart(value, fallback) {
    const cleaned = String(value || '')
      .normalize('NFKC')
      .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 120);
    return cleaned || fallback;
  }

  function guessTitle(element, index) {
    const container = element?.closest?.('[data-title], article, li, section');
    return cleanFilePart(
      element?.getAttribute?.('data-title')
        || element?.getAttribute?.('title')
        || element?.getAttribute?.('aria-label')
        || container?.getAttribute?.('data-title')
        || container?.querySelector?.('h1,h2,h3,h4')?.textContent
        || document.title,
      `视频_${index + 1}`
    );
  }

  function collectVisibleMedia() {
    const candidates = [];
    document.querySelectorAll('video, video source').forEach((element, index) => {
      ['src', 'data-src', 'data-video-src', 'data-url'].forEach(attribute => {
        const url = normalizeUrl(element.getAttribute(attribute));
        if (url) candidates.push({ url, title: guessTitle(element, index), source: '页面媒体' });
      });
      if (element.currentSrc) {
        const url = normalizeUrl(element.currentSrc);
        if (url) candidates.push({ url, title: guessTitle(element, index), source: '当前播放' });
      }
    });
    performance.getEntriesByType('resource').forEach((entry, index) => {
      const url = normalizeUrl(entry.name);
      if (url) candidates.push({ url, title: `网络媒体_${index + 1}`, source: '页面网络记录' });
    });
    return candidates;
  }

  function mergeCandidates(candidates) {
    const existing = new Map(state.items.map(item => [item.url, item]));
    candidates.forEach(candidate => {
      if (!candidate.url || existing.has(candidate.url)) return;
      const item = { ...candidate, selected: true };
      state.items.push(item);
      existing.set(item.url, item);
    });
  }

  function parseManualInput(value) {
    return String(value || '').split(/\r?\n/).map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      const separator = trimmed.indexOf('|');
      const title = separator >= 0 ? trimmed.slice(0, separator).trim() : `手动媒体_${index + 1}`;
      const rawUrl = separator >= 0 ? trimmed.slice(separator + 1).trim() : trimmed;
      const url = normalizeUrl(rawUrl);
      return url ? { url, title: cleanFilePart(title, `手动媒体_${index + 1}`), source: '手动输入' } : null;
    }).filter(Boolean);
  }

  function shellQuote(value) {
    return `'${String(value).replace(/'/g, `'"'"'`)}'`;
  }

  function buildDownloadScript(items, directoryName) {
    const outputDirectory = cleanFilePart(directoryName, '课程视频');
    const referer = `${location.origin}/`;
    const lines = [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      '',
      'if ! command -v ffmpeg >/dev/null 2>&1; then',
      '  echo "未找到 ffmpeg，请先安装后重试。" >&2',
      '  exit 1',
      'fi',
      '',
      `OUTPUT_DIR="$HOME/Downloads/${outputDirectory.replace(/[$`"\\]/g, '_')}"`,
      'mkdir -p "$OUTPUT_DIR"',
      'cd "$OUTPUT_DIR"',
      ''
    ];
    items.forEach((item, index) => {
      const order = String(index + 1).padStart(3, '0');
      const extension = /\.webm(?:$|[?#])/i.test(item.url) ? 'webm' : /\.mov(?:$|[?#])/i.test(item.url) ? 'mov' : 'mp4';
      const fileName = `${order}_${cleanFilePart(item.title, `视频_${order}`)}.${extension}`;
      lines.push(`echo ${shellQuote(`正在下载 ${index + 1}/${items.length}：${item.title}`)}`);
      lines.push(`ffmpeg -nostdin -hide_banner -loglevel warning -stats -headers ${shellQuote(`Referer: ${referer}\r\n`)} -i ${shellQuote(item.url)} -c copy -y ${shellQuote(fileName)}`);
      lines.push('');
    });
    lines.push('echo "全部任务完成。"');
    return lines.join('\n');
  }

  function downloadText(content, fileName) {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/x-shellscript;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function renderItems() {
    const list = document.querySelector(`#${PANEL_ID} [data-role="list"]`);
    const status = document.querySelector(`#${PANEL_ID} [data-role="status"]`);
    list.replaceChildren();
    state.items.forEach((item, index) => {
      const row = document.createElement('label');
      row.className = 'tam-row';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = item.selected;
      checkbox.addEventListener('change', () => { item.selected = checkbox.checked; updateStatus(); });
      const main = document.createElement('span');
      main.className = 'tam-row-main';
      const title = document.createElement('input');
      title.className = 'tam-title-input';
      title.value = item.title;
      title.addEventListener('input', () => { item.title = title.value; });
      const meta = document.createElement('small');
      meta.textContent = `${item.source} · ${item.url}`;
      main.append(title, meta);
      row.append(checkbox, main);
      list.appendChild(row);
    });
    status.textContent = state.items.length ? '' : '尚未发现可直接访问的媒体地址。可先播放视频后重新扫描，或手动粘贴直链。';
    updateStatus();
  }

  function updateStatus(message) {
    const status = document.querySelector(`#${PANEL_ID} [data-role="status"]`);
    if (!status) return;
    if (message) {
      status.textContent = message;
      return;
    }
    const selected = state.items.filter(item => item.selected).length;
    status.textContent = `已发现 ${state.items.length} 条，已选择 ${selected} 条。`;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${PANEL_ID}{position:fixed;z-index:2147483646;top:18px;right:18px;width:min(520px,calc(100vw - 36px));max-height:calc(100vh - 36px);display:flex;flex-direction:column;border:1px solid #334155;border-radius:16px;background:#0f172a;color:#e2e8f0;box-shadow:0 24px 70px rgba(0,0,0,.55);font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif}
    #${PANEL_ID} *{box-sizing:border-box}#${PANEL_ID} .tam-head{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-bottom:1px solid #273449}#${PANEL_ID} .tam-head-main{min-width:0;flex:1}#${PANEL_ID} h2{margin:0;color:#f8fafc;font-size:16px}#${PANEL_ID} .tam-note{margin:4px 0 0;color:#94a3b8;font-size:11px}#${PANEL_ID} button{border:1px solid #475569;border-radius:9px;padding:7px 10px;background:#1e293b;color:#e2e8f0;cursor:pointer}#${PANEL_ID} button:hover{background:#334155}#${PANEL_ID} .tam-primary{border-color:#0ea5e9;background:#0369a1}#${PANEL_ID} .tam-body{min-height:0;overflow:auto;padding:14px 16px}#${PANEL_ID} .tam-actions{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}#${PANEL_ID} textarea,#${PANEL_ID} .tam-dir{width:100%;border:1px solid #334155;border-radius:9px;padding:8px 10px;background:#111c30;color:#e2e8f0;outline:none}#${PANEL_ID} textarea{min-height:72px;resize:vertical;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}#${PANEL_ID} .tam-list{margin:10px 0;max-height:320px;overflow:auto;border:1px solid #263449;border-radius:10px}#${PANEL_ID} .tam-row{display:flex;gap:9px;padding:9px;border-bottom:1px solid #223047}#${PANEL_ID} .tam-row:last-child{border-bottom:0}#${PANEL_ID} .tam-row-main{min-width:0;flex:1}#${PANEL_ID} .tam-title-input{width:100%;border:0;background:transparent;color:#f1f5f9;font-weight:650;outline:none}#${PANEL_ID} small{display:block;margin-top:3px;overflow:hidden;color:#64748b;text-overflow:ellipsis;white-space:nowrap}#${PANEL_ID} .tam-status{min-height:20px;color:#7dd3fc;font-size:11px}#${PANEL_ID} .tam-foot{display:grid;grid-template-columns:1fr auto;gap:9px;padding:12px 16px;border-top:1px solid #273449}
  `;
  document.head.appendChild(style);

  const panel = document.createElement('section');
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <header class="tam-head"><div class="tam-head-main"><h2>🎬 授权媒体下载脚本生成器</h2><p class="tam-note">仅收集当前页面已直接暴露的媒体地址；不解密、不提取 DRM 密钥、不绕过付费权限。</p></div><button type="button" data-action="close" aria-label="关闭">×</button></header>
    <div class="tam-body"><div class="tam-actions"><button type="button" data-action="scan">重新扫描页面</button><button type="button" data-action="select-all">全选/取消</button></div><textarea data-role="manual" placeholder="手动补充直链，每行一条：\n课程名称 | https://example.com/video.m3u8\n或直接填写 https://example.com/video.mp4"></textarea><div class="tam-actions" style="margin-top:8px"><button type="button" data-action="add">添加手动直链</button></div><div class="tam-list" data-role="list"></div><div class="tam-status" data-role="status"></div></div>
    <footer class="tam-foot"><input class="tam-dir" data-role="directory" value="课程视频" aria-label="下载目录名"><button class="tam-primary" type="button" data-action="export">导出 download_all.sh</button></footer>
  `;
  document.body.appendChild(panel);

  panel.querySelector('[data-action="close"]').addEventListener('click', removeExporter);
  panel.querySelector('[data-action="scan"]').addEventListener('click', () => {
    mergeCandidates(collectVisibleMedia());
    renderItems();
  });
  panel.querySelector('[data-action="add"]').addEventListener('click', () => {
    const input = panel.querySelector('[data-role="manual"]');
    const parsed = parseManualInput(input.value);
    mergeCandidates(parsed);
    input.value = '';
    renderItems();
    if (!parsed.length) updateStatus('没有识别到有效的 HTTP(S) MP4/M3U8/WebM/MOV 直链。');
  });
  panel.querySelector('[data-action="select-all"]').addEventListener('click', () => {
    const shouldSelect = state.items.some(item => !item.selected);
    state.items.forEach(item => { item.selected = shouldSelect; });
    renderItems();
  });
  panel.querySelector('[data-action="export"]').addEventListener('click', () => {
    const selected = state.items.filter(item => item.selected);
    if (!selected.length) {
      updateStatus('请至少选择一条媒体地址。');
      return;
    }
    const directory = panel.querySelector('[data-role="directory"]').value;
    downloadText(buildDownloadScript(selected, directory), 'download_all.sh');
    updateStatus(`已生成 ${selected.length} 个下载任务；请先审阅脚本内容再执行。`);
  });

  mergeCandidates(collectVisibleMedia());
  renderItems();
})();
