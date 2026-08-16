const ERROR_STORAGE_KEY = 'chromeCaptureLastError';
const FRIENDLY_ERRORS = [
  {
    code: 'CANVAS_NOT_READY',
    match: /getContext|undefined.*canvas|canvas.*undefined/i,
    zh: '完整网页截图未能初始化画布。请刷新目标网页后重试，并避免在 Edge 内部页、插件商店或扩展页面使用。',
    en: 'The full-page capture canvas could not be initialized. Refresh the target page and try again. Edge internal, store, and extension pages cannot be captured.'
  },
  {
    code: 'PAGE_NOT_CONNECTED',
    match: /Receiving end does not exist|Could not establish connection/i,
    userVisible: false,
    zh: '无法连接当前网页的截图脚本。请刷新网页后重试；Edge 内部页、插件商店和扩展页面不允许注入。',
    en: 'The capture script could not connect to this page. Refresh the page and try again. Edge internal, store, and extension pages do not allow script injection.'
  }
];

let lastErrorSignature = '';
let lastErrorAt = 0;
const CAPTURE_COMMANDS = new Set([
  'screenshot', 'full_webpage_screenshot', 'desktop_screenshot',
  'open_snipping_tool', 'record_tab', 'record_desktop'
]);

function isChinese() {
  return /^zh(?:-|$)/i.test(chrome.i18n?.getUILanguage?.() || '');
}

function classifyError(reason) {
  const technicalMessage = String(reason && (reason.message || reason.reason) || reason || '');
  const matched = FRIENDLY_ERRORS.find(item => item.match.test(technicalMessage));
  if (!matched) return null;
  return {
    code: matched.code,
    title: isChinese() ? '截图失败' : 'Capture failed',
    message: isChinese() ? matched.zh : matched.en,
    userVisible: matched.userVisible !== false,
    technicalMessage,
    occurredAt: Date.now()
  };
}

async function clearFriendlyError() {
  lastErrorSignature = '';
  await chrome.storage.session.remove(ERROR_STORAGE_KEY).catch(() => {});
  await chrome.action.setBadgeText({ text: '' }).catch(() => {});
  const manifest = chrome.runtime.getManifest();
  await chrome.action.setTitle({ title: manifest.name || 'Chrome Capture Pro' }).catch(() => {});
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab || !Number.isInteger(tab.id)) return;
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.getElementById('chrome-capture-friendly-error')?.remove()
    });
  } catch (_) {}
}

function beginCaptureAttempt(command) {
  if (CAPTURE_COMMANDS.has(String(command || ''))) void clearFriendlyError();
}

chrome.runtime.onMessage.addListener(message => beginCaptureAttempt(message && message.command));
chrome.commands.onCommand.addListener(beginCaptureAttempt);
chrome.contextMenus.onClicked.addListener(info => beginCaptureAttempt(info && info.menuItemId));
chrome.runtime.onConnect.addListener(port => {
  if (port && port.name === 'full_webpage_screenshot') void clearFriendlyError();
});

function showPageToast(message) {
  const existing = document.getElementById('chrome-capture-friendly-error');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'chrome-capture-friendly-error';
  toast.setAttribute('role', 'alert');
  toast.style.cssText = [
    'position:fixed', 'top:18px', 'left:50%', 'transform:translateX(-50%)',
    'z-index:2147483647', 'max-width:min(520px,calc(100vw - 32px))',
    'padding:12px 16px', 'border-radius:12px', 'background:#7f1d1d',
    'border:1px solid #f87171', 'box-shadow:0 12px 32px rgba(0,0,0,.35)',
    'color:#fff', 'font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    'white-space:normal', 'word-break:break-word'
  ].join(';');
  toast.textContent = message;
  document.documentElement.appendChild(toast);
  window.setTimeout(() => toast.remove(), 9000);
}

async function surfaceFriendlyError(error) {
  const signature = `${error.code}:${error.technicalMessage}`;
  const now = Date.now();
  if (signature === lastErrorSignature && now - lastErrorAt < 1500) return;
  lastErrorSignature = signature;
  lastErrorAt = now;

  console.warn('[Chrome Capture]', error.code, error.technicalMessage);
  await chrome.storage.session.set({
    isCapturing: false,
    isWaitingForDesktopRecord: false,
    [ERROR_STORAGE_KEY]: error
  }).catch(() => {});
  await chrome.action.setBadgeBackgroundColor({ color: '#dc2626' }).catch(() => {});
  await chrome.action.setBadgeText({ text: '!' }).catch(() => {});
  await chrome.action.setTitle({ title: `${error.title}: ${error.message}` }).catch(() => {});

  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab || !Number.isInteger(tab.id)) return;
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: showPageToast,
      args: [`${error.title}：${error.message}`]
    });
  } catch (_) {
    // Restricted pages cannot receive an injected toast; the action badge and Popup handle that case.
  }
}

self.addEventListener('unhandledrejection', event => {
  const friendlyError = classifyError(event.reason);
  if (!friendlyError) return;
  event.preventDefault();
  if (!friendlyError.userVisible) {
    console.info('[Chrome Capture] Page probe had no receiver; continuing with dynamic injection.');
    return;
  }
  void surfaceFriendlyError(friendlyError);
});

self.addEventListener('error', event => {
  const friendlyError = classifyError(event.error || event.message);
  if (!friendlyError) return;
  event.preventDefault();
  if (!friendlyError.userVisible) return;
  void surfaceFriendlyError(friendlyError);
});
