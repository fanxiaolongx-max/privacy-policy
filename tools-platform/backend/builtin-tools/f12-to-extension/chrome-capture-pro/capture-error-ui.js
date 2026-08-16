(function initCaptureErrorUi() {
  'use strict';

  const ERROR_STORAGE_KEY = 'chromeCaptureLastError';
  const MAX_ERROR_AGE_MS = 10 * 60 * 1000;

  async function clearError(alertElement) {
    if (alertElement) alertElement.remove();
    await chrome.storage.session.remove(ERROR_STORAGE_KEY).catch(() => {});
    await chrome.action.setBadgeText({ text: '' }).catch(() => {});
    const manifest = chrome.runtime.getManifest();
    await chrome.action.setTitle({ title: manifest.name || 'Chrome Capture Pro' }).catch(() => {});
  }

  function renderError(error) {
    const alertElement = document.createElement('div');
    alertElement.id = 'chrome-capture-popup-error';
    alertElement.setAttribute('role', 'alert');
    alertElement.style.cssText = `
      position: fixed; top: 8px; left: 10px; right: 10px; z-index: 2147483647;
      display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: start;
      padding: 10px 12px; border-radius: 10px; color: #fee2e2;
      background: rgba(127, 29, 29, 0.97); border: 1px solid rgba(248, 113, 113, 0.85);
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45);
      font: 11px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    `;
    const text = document.createElement('div');
    const title = document.createElement('strong');
    title.style.cssText = 'display:block;margin-bottom:2px;color:#fff;font-size:12px;';
    title.textContent = error.title || '截图失败';
    const message = document.createElement('span');
    message.textContent = error.message || '请刷新目标网页后重试。';
    text.append(title, message);
    const close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', '关闭错误提示');
    close.textContent = '×';
    close.style.cssText = 'border:0;background:transparent;color:#fff;font-size:18px;line-height:1;cursor:pointer;padding:0 2px;';
    close.addEventListener('click', () => void clearError(alertElement));
    alertElement.append(text, close);
    document.body.append(alertElement);
    window.setTimeout(() => void clearError(alertElement), 12000);
  }

  window.addEventListener('DOMContentLoaded', async () => {
    const stored = await chrome.storage.session.get(ERROR_STORAGE_KEY).catch(() => ({}));
    const error = stored && stored[ERROR_STORAGE_KEY];
    if (!error || error.code === 'PAGE_NOT_CONNECTED' || Date.now() - Number(error.occurredAt || 0) > MAX_ERROR_AGE_MS) {
      await clearError(null);
      return;
    }
    renderError(error);
  });
})();
