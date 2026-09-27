(function initF12ExtensionPacker(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.F12ExtensionPacker = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPackerApi() {
  "use strict";

  const DEFAULT_PERMISSIONS = ["storage", "activeTab", "scripting"];
  const OPTIONAL_PERMISSIONS = new Set([
    "alarms", "clipboardRead", "clipboardWrite", "cookies", "downloads",
    "notifications", "tabs", "webNavigation"
  ]);
  const RUN_AT_VALUES = new Set(["document_start", "document_end", "document_idle"]);
  const WORLD_VALUES = new Set(["MAIN", "ISOLATED"]);
  const PACKAGE_TARGET_VALUES = new Set(["store", "local"]);

  function unique(values) {
    return [...new Set(values)];
  }

  function parseList(value) {
    if (Array.isArray(value)) return unique(value.map(String).map(item => item.trim()).filter(Boolean));
    return unique(String(value || "").split(/[\n,]+/).map(item => item.trim()).filter(Boolean));
  }

  function isValidVersion(version) {
    const parts = String(version || "").split(".");
    return parts.length >= 1 && parts.length <= 4 && parts.every(part => {
      if (!/^\d+$/.test(part)) return false;
      if (part.length > 1 && part.startsWith("0")) return false;
      const value = Number(part);
      return Number.isSafeInteger(value) && value >= 0 && value <= 65535;
    });
  }

  function incrementVersion(version) {
    if (!isValidVersion(version)) throw new Error("无法递增无效版本号。");
    const parts = String(version).split(".").map(Number);
    while (parts.length < 3) parts.push(0);
    for (let index = parts.length - 1; index >= 0; index--) {
      if (parts[index] < 65535) {
        parts[index] += 1;
        for (let resetIndex = index + 1; resetIndex < parts.length; resetIndex++) parts[resetIndex] = 0;
        return parts.join(".");
      }
    }
    throw new Error("版本号已达到浏览器允许的最大值，请更换扩展名称或重置版本记录。");
  }

  function isValidManifestKey(value) {
    const key = String(value || "").trim();
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(key) || key.length < 172 || key.length % 4 !== 0) return false;
    const padding = key.endsWith("==") ? 2 : (key.endsWith("=") ? 1 : 0);
    return ((key.length * 3) / 4) - padding >= 128;
  }

  function isValidMatchPattern(pattern) {
    if (pattern === "<all_urls>") return true;
    const match = /^(\*|http|https|file):\/\/([^/]*)\/(.*)$/.exec(pattern);
    if (!match) return false;
    const [, scheme, host] = match;
    if (scheme === "file") return host === "";
    if (host === "*") return true;
    if (host.startsWith("*.")) return /^\*\.[^*\s/:]+(?:\.[^*\s/:]+)+(?:\:\d+)?$/.test(host);
    return host.length > 0 && /^[^*\s/]+$/.test(host);
  }

  function analyzeCode(code) {
    const source = String(code || "");
    const errors = [];
    const warnings = [];
    const suggestions = [];

    if (!source.trim()) {
      warnings.push("脚本为空，将生成一条加载日志作为 content.js。");
      return { errors, warnings, suggestions };
    }

    try {
      // Content scripts are classic scripts, so Function is a useful syntax compatibility check.
      // It intentionally rejects top-level await/import/export just like content.js would.
      new Function(source);
    } catch (error) {
      errors.push(`脚本无法作为传统 content.js 解析：${error.message}`);
    }

    if (/\b(?:\$0|\$1|\$2|\$3|\$4|copy|inspect|monitor|unmonitor|queryObjects)\s*\(/.test(source)) {
      warnings.push("检测到 DevTools Console 专用命令（如 $0/copy/inspect），扩展环境中不可直接使用。");
    }
    if (/\bGM_[A-Za-z0-9_]+\b|\bunsafeWindow\b/.test(source)) {
      warnings.push("检测到油猴/Tampermonkey API；浏览器扩展不会自动提供 GM_* 或 unsafeWindow。");
    }
    if (/\b(?:eval|new\s+Function)\s*\(/.test(source)) {
      warnings.push("检测到动态代码执行；可能受到页面 CSP 或扩展安全策略限制。");
    }
    if (/(?:createElement\s*\(\s*["']script["']|\.src\s*=)\s*[\s\S]{0,160}https?:\/\//i.test(source)) {
      warnings.push("检测到远程脚本加载；目标网站 CSP 可能阻止加载，发布到扩展商店时也需要额外审查。");
    }
    if (/\bchrome\.downloads\b/.test(source)) suggestions.push("脚本使用 chrome.downloads，建议增加 downloads 权限。");
    if (/\bchrome\.cookies\b/.test(source)) suggestions.push("脚本使用 chrome.cookies，建议增加 cookies 权限。");
    if (/\bchrome\.notifications\b/.test(source)) suggestions.push("脚本使用 chrome.notifications，建议增加 notifications 权限。");
    if (/\bchrome\.tabs\b/.test(source)) suggestions.push("脚本使用 chrome.tabs；该 API 通常应放在 Popup 或后台脚本中，并可能需要 tabs 权限。");

    return { errors, warnings, suggestions };
  }

  function normalizeOptions(options) {
    const input = options || {};
    const licenseInput = input.license && typeof input.license === "object" ? input.license : {};
    const license = {
      enabled: licenseInput.enabled === true,
      productId: String(licenseInput.productId || input.name || "My Extension").trim(),
      validationUrl: String(licenseInput.validationUrl || "").trim(),
      publicKeyJwk: licenseInput.publicKeyJwk && typeof licenseInput.publicKeyJwk === "object"
        ? licenseInput.publicKeyJwk
        : null
    };
    const matches = parseList(input.matches || input.matchPattern || "*://*/*");
    const optionalPermissions = parseList(input.optionalPermissions)
      .filter(permission => OPTIONAL_PERMISSIONS.has(permission));
    return {
      name: String(input.name || "My Extension").trim(),
      version: String(input.version || "1.0.0").trim(),
      extensionKey: String(input.extensionKey || "").trim(),
      packageTarget: PACKAGE_TARGET_VALUES.has(input.packageTarget) ? input.packageTarget : "local",
      description: String(input.description || "Generated by F12 Packer").trim(),
      matches,
      world: WORLD_VALUES.has(input.world) ? input.world : "MAIN",
      runAt: RUN_AT_VALUES.has(input.runAt) ? input.runAt : "document_idle",
      allFrames: input.allFrames === true,
      includePopup: input.includePopup !== false || input.manualLaunch === true || license.enabled,
      manualLaunch: input.manualLaunch === true || license.enabled,
      license,
      optionalPermissions,
      code: String(input.code || "")
    };
  }

  function validateOptions(options) {
    const normalized = normalizeOptions(options);
    const errors = [];
    if (!normalized.name) errors.push("扩展名称不能为空。");
    if (normalized.name.length > 75) errors.push("扩展名称不能超过 75 个字符。");
    if (normalized.description.length > 132) errors.push("扩展描述不能超过 132 个字符。");
    if (!isValidVersion(normalized.version)) errors.push("版本号必须由 1–4 段 0–65535 的整数构成，例如 1.0.0。段不能有前导零。");
    if (normalized.extensionKey && !isValidManifestKey(normalized.extensionKey)) errors.push("固定扩展身份 Manifest Key 无效。");
    if (!normalized.matches.length) errors.push("至少需要一个匹配网址。");
    normalized.matches.forEach(pattern => {
      if (!isValidMatchPattern(pattern)) errors.push(`无效的匹配网址：${pattern}`);
    });
    if (normalized.license.enabled) {
      if (!normalized.license.productId) errors.push("启用 License 时产品标识不能为空。");
      try {
        const validationUrl = new URL(normalized.license.validationUrl);
        const localHttp = validationUrl.protocol === "http:"
          && /^(?:localhost|127\.0\.0\.1|\[::1\])$/i.test(validationUrl.hostname);
        if (validationUrl.protocol !== "https:" && !localHttp) throw new Error("invalid protocol");
      } catch (_) {
        errors.push("License 在线校验地址无效；生产环境必须使用 HTTPS。");
      }
      const jwk = normalized.license.publicKeyJwk;
      if (!jwk || jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.x || !jwk.y) {
        errors.push("License 公钥无效，请从平台重新签发本月 License。");
      }
    }
    const analysis = analyzeCode(normalized.code);
    return {
      options: normalized,
      errors: [...errors, ...analysis.errors],
      warnings: analysis.warnings,
      suggestions: analysis.suggestions
    };
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[char]);
  }

  function buildPackage(options) {
    const validation = validateOptions(options);
    if (validation.errors.length) {
      const error = new Error(validation.errors.join("\n"));
      error.validation = validation;
      throw error;
    }
    const settings = validation.options;
    const permissions = unique([...DEFAULT_PERMISSIONS, ...settings.optionalPermissions]);
    const contentScript = {
      matches: settings.matches,
      js: ["content.js"],
      run_at: settings.runAt,
      world: settings.world
    };
    if (settings.allFrames) contentScript.all_frames = true;

    const manifest = {
      manifest_version: 3,
      name: settings.name,
      version: settings.version,
      description: settings.description,
      permissions,
      host_permissions: unique([
        ...settings.matches,
        ...(settings.license.enabled
          ? [`${new URL(settings.license.validationUrl).origin}/*`]
          : [])
      ])
    };
    // Stores assign the published extension identity and reject a developer-supplied key.
    // Keep the stable key only for local installation and enterprise distribution.
    if (settings.packageTarget === "local" && settings.extensionKey) manifest.key = settings.extensionKey;
    if (!settings.manualLaunch) manifest.content_scripts = [contentScript];
    const files = {
      "manifest.json": JSON.stringify(manifest, null, 2),
      "content.js": settings.code.trim() ? settings.code : `console.log("[${settings.name.replace(/["\\]/g, "\\$&")}] Content script loaded!");`
    };

    if (settings.includePopup) {
      const licenseEnabled = settings.license.enabled;
      manifest.action = { default_title: settings.name, default_popup: "popup.html" };
      manifest.background = { service_worker: "background.js" };
      files["manifest.json"] = JSON.stringify(manifest, null, 2);
      files["popup.html"] = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(settings.name)}</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <main class="panel">
    <header class="panel-header">
      <h1>${escapeHtml(settings.name)}</h1>
      <select id="languageSelect" aria-label="Language">
        <option value="zh">中文</option>
        <option value="en">English</option>
      </select>
    </header>
    <p id="status" data-i18n="openTarget">Please open the target page first</p>
    ${licenseEnabled ? `<div id="expiryWarning" class="expiry-warning hidden"></div>` : ""}
    ${licenseEnabled ? `<section id="licensePanel" class="license-panel">
      <strong data-i18n="firstAuthorization">首次运行授权</strong>
      <small data-i18n="licenseHint">请输入 Tools Platform 提供的本月 License 密钥。</small>
      <textarea id="licenseInput" rows="4" placeholder="F12L1..."></textarea>
      <button id="activateButton" class="license-button" data-i18n="activate">验证并授权</button>
    </section>` : ""}
    <button id="startButton" data-i18n="start">启动脚本</button>
    <button id="stopButton" class="secondary" data-i18n="stop">停止脚本</button>
  </main>
  <script src="popup.js"><\/script>
</body>
</html>`;
      files["popup.css"] = `* { box-sizing: border-box; }
body { width: 260px; margin: 0; padding: 12px; color: #172033; font-family: "Microsoft YaHei", "Segoe UI", sans-serif; background: #f3f6f9; }
.panel { padding: 14px; border-radius: 14px; background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
.panel-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
h1 { min-width: 0; margin: 0; font-size: 17px; overflow-wrap: anywhere; }
.panel-header select { flex: 0 0 auto; padding: 4px 5px; border: 1px solid #d0d5dd; border-radius: 7px; color: #344054; background: #fff; font-size: 10px; cursor: pointer; }
p { min-height: 32px; margin: 0 0 12px; color: #667085; font-size: 11px; }
.license-panel { margin: 0 0 10px; padding: 10px; border: 1px solid #f59e0b; border-radius: 10px; background: #fffbeb; }
.license-panel strong, .license-panel small { display: block; }
.license-panel small { margin: 4px 0 7px; color: #92400e; font-size: 10px; line-height: 1.4; }
.license-panel textarea { width: 100%; padding: 7px; resize: vertical; border: 1px solid #fbbf24; border-radius: 7px; font-size: 10px; word-break: break-all; }
.hidden { display: none !important; }
.expiry-warning { margin: -4px 0 10px; padding: 9px; border: 1px solid #f59e0b; border-radius: 9px; color: #92400e; background: #fef3c7; font-size: 11px; font-weight: 700; line-height: 1.45; }
.expiry-warning.urgent { border-color: #ef4444; color: #991b1b; background: #fee2e2; animation: licensePulse 1.4s ease-in-out infinite; }
@keyframes licensePulse { 50% { box-shadow: 0 0 0 3px rgba(239,68,68,.16); } }
button { width: 100%; margin-top: 7px; padding: 9px 10px; border: 0; border-radius: 9px; color: #fff; background: #1677ff; cursor: pointer; transition: background 0.2s; }
button:hover { background: #0958d9; }
button:disabled { cursor: not-allowed; opacity: .45; }
button.license-button { background: #d97706; }
button.secondary { color: #fff; background: #ff4d4f; }
button.secondary:hover { background: #cf1322; }`;
      files["popup.js"] = `const MANUAL_LAUNCH = ${JSON.stringify(settings.manualLaunch)};
const SCRIPT_WORLD = ${JSON.stringify(settings.world)};
const ALL_FRAMES = ${JSON.stringify(settings.allFrames)};
      const LICENSE_CONFIG = ${JSON.stringify({
        enabled: licenseEnabled,
        productId: settings.license.productId,
        validationUrl: settings.license.validationUrl,
        publicKeyJwk: settings.license.publicKeyJwk
      })};
const I18N = {
  zh: {
    openTarget: "请先打开目标网页",
    firstAuthorization: "首次运行授权",
    licenseHint: "请输入 Tools Platform 提供的本月 License 密钥。",
    activate: "验证并授权",
    start: "启动脚本",
    stop: "停止脚本",
    invalidFormat: "密钥格式无效",
    invalidSignature: "签名无效",
    wrongProduct: "密钥不适用于此扩展",
    notYetValid: "密钥尚未生效",
    expired: "密钥已过期，请获取本月新密钥",
    revoked: "此 License 已被管理员撤销",
    archived: "此 License 已被管理员归档",
    licenseNotFound: "服务器中不存在此 License，请联系管理员",
    verificationFailed: "验证失败",
    onlineRequired: "无法连接授权服务器，请联网后重试",
    clockRollback: "检测到系统时间回拨，请联网重新校验",
    checkingOnline: "正在验证 License 签名与有效期…",
    validUntil: "授权有效至 {date}",
    validUntilOffline: "本地签名验证通过，授权有效至 {date}",
    expiresSoonDays: "⚠ License 即将过期：还剩 {count} 天，请提前获取新密钥",
    expiresSoonHours: "❗ License 即将过期：还剩 {count} 小时，请立即获取新密钥",
    authorizationRequired: "需要授权：{reason}",
    authorizationFailed: "授权失败：{reason}",
    cannotGetPage: "无法获取当前页面",
    started: "脚本已启动！",
    stopped: "脚本已停止！",
    cannotRunSystemPage: "无法在系统页面（edge:// 等）运行，请打开目标网页",
    executionFailed: "执行失败：{reason}"
  },
  en: {
    openTarget: "Please open the target page first",
    firstAuthorization: "First-time authorization",
    licenseHint: "Enter the monthly License key provided by Tools Platform.",
    activate: "Verify and activate",
    start: "Start script",
    stop: "Stop script",
    invalidFormat: "Invalid key format",
    invalidSignature: "Invalid signature",
    wrongProduct: "This key is not valid for this extension",
    notYetValid: "This key is not active yet",
    expired: "This key has expired. Please obtain a new key for this month",
    revoked: "This License has been revoked by the administrator",
    archived: "This License has been archived by the administrator",
    licenseNotFound: "This License was not found on the server. Contact the administrator",
    verificationFailed: "Verification failed",
    onlineRequired: "Unable to reach the authorization server. Connect to the internet and try again",
    clockRollback: "A system clock rollback was detected. Reconnect to verify the License",
    checkingOnline: "Verifying the License signature and validity period…",
    validUntil: "License valid until {date}",
    validUntilOffline: "Local signature verified. License valid until {date}",
    expiresSoonDays: "⚠ License expires soon: {count} day(s) remaining. Obtain a new key in advance",
    expiresSoonHours: "❗ License expires soon: {count} hour(s) remaining. Obtain a new key now",
    authorizationRequired: "Authorization required: {reason}",
    authorizationFailed: "Authorization failed: {reason}",
    cannotGetPage: "Unable to access the current page",
    started: "Script started!",
    stopped: "Script stopped!",
    cannotRunSystemPage: "This extension cannot run on system pages (such as edge://). Open the target page instead",
    executionFailed: "Execution failed: {reason}"
  }
};
let currentLanguage = "en";

function translate(key, values) {
  const dictionary = I18N[currentLanguage] || I18N.en;
  const template = dictionary[key] || I18N.en[key] || key;
  return template.replace(/\\{(\\w+)\\}/g, (_, name) => String((values || {})[name] ?? ""));
}

function applyLanguage() {
  document.documentElement.lang = currentLanguage === "zh" ? "zh-CN" : "en";
  document.getElementById("languageSelect").value = currentLanguage;
  document.querySelectorAll("[data-i18n]").forEach(element => {
    element.textContent = translate(element.dataset.i18n);
  });
}

async function initializeLanguage() {
  const stored = await chrome.storage.local.get("f12PopupLanguage");
  const browserLanguage = (chrome.i18n && chrome.i18n.getUILanguage
    ? chrome.i18n.getUILanguage()
    : navigator.language) || "en";
  currentLanguage = stored.f12PopupLanguage === "zh" || stored.f12PopupLanguage === "en"
    ? stored.f12PopupLanguage
    : (/^zh(?:-|$)/i.test(browserLanguage) ? "zh" : "en");
  applyLanguage();
}

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), char => char.charCodeAt(0));
}

function encodeBase64Url(bytes) {
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/g, "");
}

let verificationKeyPromise = null;
function getVerificationKey() {
  if (!verificationKeyPromise) {
    verificationKeyPromise = crypto.subtle.importKey(
      "jwk", LICENSE_CONFIG.publicKeyJwk,
      { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]
    );
  }
  return verificationKeyPromise;
}

async function verifySignedValue(value, prefix) {
  const parts = String(value || "").trim().split(".");
  if (parts.length !== 3 || parts[0] !== prefix) return { valid: false, reasonKey: "invalidFormat" };
  try {
    const signatureValid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" }, await getVerificationKey(),
      decodeBase64Url(parts[2]), new TextEncoder().encode(parts[1])
    );
    if (!signatureValid) return { valid: false, reasonKey: "invalidSignature" };
    return {
      valid: true,
      payload: JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])))
    };
  } catch (_) {
    return { valid: false, reasonKey: "verificationFailed" };
  }
}

async function inspectLicenseToken(token) {
  if (!LICENSE_CONFIG.enabled) return { valid: true };
  const result = await verifySignedValue(token, "F12L1");
  if (!result.valid) return result;
  if (!result.payload
    || result.payload.version !== 1
    || !/^\\d{4}-(?:0[1-9]|1[0-2])$/.test(String(result.payload.month || ""))
    || !Number.isFinite(result.payload.notBefore)
    || !Number.isFinite(result.payload.expiresAt)
    || result.payload.expiresAt <= result.payload.notBefore) {
    return { valid: false, reasonKey: "invalidFormat" };
  }
  if (result.payload.productId !== LICENSE_CONFIG.productId) return { valid: false, reasonKey: "wrongProduct" };
  return result;
}

function reasonKeyFromServer(code) {
  return ({
    INVALID_FORMAT: "invalidFormat",
    INVALID_SIGNATURE: "invalidSignature",
    PRODUCT_MISMATCH: "wrongProduct",
    NOT_YET_VALID: "notYetValid",
    EXPIRED: "expired",
    REVOKED: "revoked",
    ARCHIVED: "archived",
    LICENSE_NOT_FOUND: "licenseNotFound",
    REGISTRY_MISMATCH: "licenseNotFound",
    VERIFICATION_FAILED: "verificationFailed"
  })[code] || "verificationFailed";
}

async function tokenDigest(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return encodeBase64Url(new Uint8Array(digest));
}

function randomNonce() {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(18)));
}

async function verifyAttestation(attestation, token, expectedNonce) {
  const result = await verifySignedValue(attestation, "F12T1");
  if (!result.valid) return result;
  const payload = result.payload;
  if (payload.productId !== LICENSE_CONFIG.productId) return { valid: false, reasonKey: "wrongProduct" };
  if (expectedNonce && payload.nonce !== expectedNonce) return { valid: false, reasonKey: "verificationFailed" };
  if (payload.tokenDigest !== await tokenDigest(token)) return { valid: false, reasonKey: "verificationFailed" };
  if (!payload.valid) return { valid: false, reasonKey: reasonKeyFromServer(payload.reasonCode), attestationPayload: payload };
  return { valid: true, attestationPayload: payload };
}

async function requestOnlineValidation(token) {
  const nonce = randomNonce();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(LICENSE_CONFIG.validationUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, productId: LICENSE_CONFIG.productId, nonce }),
      cache: "no-store",
      signal: controller.signal
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.attestation) throw new Error(body.error || "online validation failed");
    const verified = await verifyAttestation(body.attestation, token, nonce);
    const localCheckedAt = Date.now();
    const digest = await tokenDigest(token);
    if (!verified.valid) {
      if (verified.attestationPayload) {
        await chrome.storage.local.set({
          f12TrustedLicenseCache: {
            attestation: body.attestation,
            localCheckedAt,
            lastObservedLocalTime: localCheckedAt
          },
          f12LocalLicenseClock: {
            tokenDigest: digest,
            lastObservedLocalTime: localCheckedAt,
            lastTrustedTime: verified.attestationPayload.checkedAt
          }
        });
      }
      return verified;
    }
    await chrome.storage.local.set({
      f12TrustedLicenseCache: {
        attestation: body.attestation,
        localCheckedAt,
        lastObservedLocalTime: localCheckedAt
      },
      f12LocalLicenseClock: {
        tokenDigest: digest,
        lastObservedLocalTime: localCheckedAt,
        lastTrustedTime: verified.attestationPayload.checkedAt
      }
    });
    return {
      valid: true,
      trustedNow: verified.attestationPayload.checkedAt,
      tokenExpiresAt: verified.attestationPayload.tokenExpiresAt,
      online: true
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function readOfflineValidation(token) {
  const stored = await chrome.storage.local.get("f12TrustedLicenseCache");
  const cache = stored.f12TrustedLicenseCache;
  if (!cache || !cache.attestation) return { valid: false, reasonKey: "onlineRequired" };
  const verified = await verifyAttestation(cache.attestation, token);
  if (!verified.valid) return verified;
  const localNow = Date.now();
  const localFloor = Math.max(Number(cache.localCheckedAt) || 0, Number(cache.lastObservedLocalTime) || 0);
  if (localNow < localFloor - 2 * 60 * 1000) return { valid: false, reasonKey: "clockRollback" };
  const elapsed = Math.max(0, localNow - (Number(cache.localCheckedAt) || localNow));
  const trustedNow = Number(verified.attestationPayload.checkedAt) + elapsed;
  if (trustedNow >= Number(verified.attestationPayload.tokenExpiresAt)) return { valid: false, reasonKey: "expired" };
  if (trustedNow >= Number(verified.attestationPayload.offlineUntil)) return { valid: false, reasonKey: "onlineRequired" };
  cache.lastObservedLocalTime = Math.max(localFloor, localNow);
  await chrome.storage.local.set({ f12TrustedLicenseCache: cache });
  return {
    valid: true,
    trustedNow,
    tokenExpiresAt: verified.attestationPayload.tokenExpiresAt,
    online: false
  };
}

async function readSignedOfflineValidation(token, tokenPayload) {
  const stored = await chrome.storage.local.get(["f12TrustedLicenseCache", "f12LocalLicenseClock"]);
  const cache = stored.f12TrustedLicenseCache;
  const digest = await tokenDigest(token);
  const savedClock = stored.f12LocalLicenseClock && stored.f12LocalLicenseClock.tokenDigest === digest
    ? stored.f12LocalLicenseClock
    : {};
  const localNow = Date.now();
  const localFloor = Math.max(
    Number(savedClock.lastObservedLocalTime) || 0,
    Number(savedClock.lastTrustedTime) || 0
  );
  if (localNow < localFloor - 2 * 60 * 1000) {
    return { valid: false, reasonKey: "clockRollback" };
  }

  let trustedNow = Math.max(localNow, localFloor);
  if (cache && cache.attestation) {
    const serverState = await verifyAttestation(cache.attestation, token);
    if (!serverState.valid && serverState.attestationPayload) {
      return serverState;
    }
    if (serverState.valid) {
      trustedNow = Math.max(
        trustedNow,
        Number(serverState.attestationPayload.checkedAt)
          + Math.max(0, localNow - (Number(cache.localCheckedAt) || localNow))
      );
    }
  }

  if (trustedNow < Number(tokenPayload.notBefore)) return { valid: false, reasonKey: "notYetValid" };
  if (trustedNow >= Number(tokenPayload.expiresAt)) return { valid: false, reasonKey: "expired" };
  await chrome.storage.local.set({
    f12LocalLicenseClock: {
      tokenDigest: digest,
      lastObservedLocalTime: localNow,
      lastTrustedTime: trustedNow
    }
  });
  return {
    valid: true,
    trustedNow,
    tokenExpiresAt: tokenPayload.expiresAt,
    online: false,
    localSignature: true
  };
}

async function validateLicense(token, requireOnline) {
  const inspected = await inspectLicenseToken(token);
  if (!inspected.valid) return inspected;
  try {
    return await requestOnlineValidation(token);
  } catch (_) {
    if (Number.isFinite(inspected.payload.notBefore) && Number.isFinite(inspected.payload.expiresAt)) {
      return readSignedOfflineValidation(token, inspected.payload);
    }
    return requireOnline ? { valid: false, reasonKey: "onlineRequired" } : readOfflineValidation(token);
  }
}

function updateExpiryWarning(expiresAt, trustedNow) {
  const warning = document.getElementById("expiryWarning");
  if (!warning) return;
  const remaining = Number(expiresAt) - Number(trustedNow);
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  if (!(remaining > 0 && remaining <= sevenDays)) {
    warning.classList.add("hidden");
    warning.classList.remove("urgent");
    return;
  }
  const urgent = remaining <= 24 * 60 * 60 * 1000;
  const count = urgent
    ? Math.max(1, Math.ceil(remaining / (60 * 60 * 1000)))
    : Math.max(1, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
  warning.textContent = translate(urgent ? "expiresSoonHours" : "expiresSoonDays", { count });
  warning.classList.remove("hidden");
  warning.classList.toggle("urgent", urgent);
}

async function refreshLicenseState(options) {
  const startButton = document.getElementById("startButton");
  const panel = document.getElementById("licensePanel");
  if (!LICENSE_CONFIG.enabled) return true;
  startButton.disabled = true;
  document.getElementById("status").textContent = translate("checkingOnline");
  const stored = await chrome.storage.local.get("f12LicenseToken");
  const result = await validateLicense(stored.f12LicenseToken, Boolean(options && options.requireOnline));
  startButton.disabled = !result.valid;
  panel.hidden = result.valid;
  if (result.valid) updateExpiryWarning(result.tokenExpiresAt, result.trustedNow);
  else updateExpiryWarning(0, 0);
  document.getElementById("status").textContent = result.valid
    ? translate(result.online ? "validUntil" : "validUntilOffline", {
        date: new Date(result.tokenExpiresAt).toLocaleString(currentLanguage === "zh" ? "zh-CN" : "en-US")
      })
    : translate("authorizationRequired", { reason: translate(result.reasonKey) });
  return result.valid;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToPage(action) {
  if (action === "START" && !(await refreshLicenseState())) return;
  const tab = await getActiveTab();
  if (!tab?.id) {
    document.getElementById("status").textContent = translate("cannotGetPage");
    return;
  }
  try {
    if (action === "START" && MANUAL_LAUNCH) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: ALL_FRAMES },
        world: SCRIPT_WORLD,
        files: ["content.js"]
      });
    } else {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: ALL_FRAMES },
        world: "MAIN",
        func: (pageAction) => {
          window.postMessage({ source: "EXTENSION_POPUP", action: pageAction }, "*");
        },
        args: [action]
      });
    }
    document.getElementById("status").textContent = translate(action === "START" ? "started" : "stopped");
  } catch (err) {
    document.getElementById("status").textContent = err.message.includes("Cannot access")
      ? translate("cannotRunSystemPage")
      : translate("executionFailed", { reason: err.message });
  }
}

${licenseEnabled ? `document.getElementById("activateButton").addEventListener("click", async () => {
  const activateButton = document.getElementById("activateButton");
  const token = document.getElementById("licenseInput").value.trim();
  activateButton.disabled = true;
  document.getElementById("status").textContent = translate("checkingOnline");
  const result = await validateLicense(token, true);
  if (!result.valid) {
    document.getElementById("status").textContent = translate("authorizationFailed", { reason: translate(result.reasonKey) });
    activateButton.disabled = false;
    return;
  }
  await chrome.storage.local.set({ f12LicenseToken: token });
  document.getElementById("licenseInput").value = "";
  await refreshLicenseState();
  activateButton.disabled = false;
});` : ""}
document.getElementById("startButton").addEventListener("click", () => sendToPage("START"));
document.getElementById("stopButton").addEventListener("click", () => sendToPage("STOP"));
document.getElementById("languageSelect").addEventListener("change", async event => {
  currentLanguage = event.target.value === "zh" ? "zh" : "en";
  await chrome.storage.local.set({ f12PopupLanguage: currentLanguage });
  applyLanguage();
  await refreshLicenseState();
});

async function initializePopup() {
  await initializeLanguage();
  await refreshLicenseState();
}

initializePopup();`;
      files["background.js"] = `chrome.runtime.onInstalled.addListener(() => {
  console.log(${JSON.stringify(`${settings.name} extension installed successfully.`)});
});`;
    }

    return { manifest, files, validation };
  }

  const BUILTIN_TEMPLATES = {
    "chrome-capture-pro": {
      id: "chrome-capture-pro",
      name: "Chrome Capture Pro",
      defaultVersion: "3.3.8",
      description: "全功能屏幕录制、区域与长截图、GIF/视频编辑及画板标注工具。",
      matches: ["<all_urls>"],
      isFullExtension: true,
      templateZip: "./chrome-capture-pro.template.zip"
    }
  };

  function transformChromeCaptureManifest(manifestJson, options) {
    const manifest = typeof manifestJson === "string" ? JSON.parse(manifestJson) : { ...manifestJson };
    const settings = normalizeOptions(options);
    if (settings.name) manifest.name = settings.name;
    if (settings.version) manifest.version = settings.version;
    if (settings.description) manifest.description = settings.description;
    if (settings.packageTarget === "store") {
      delete manifest.key;
    } else if (settings.packageTarget === "local" && settings.extensionKey) {
      manifest.key = settings.extensionKey;
    }
    return manifest;
  }

  function createChromeCaptureLicenseConfig(options) {
    const settings = normalizeOptions(options);
    return {
      enabled: settings.license.enabled === true,
      productId: settings.license.productId || settings.name || "Chrome Capture Pro",
      validationUrl: settings.license.validationUrl || "",
      publicKeyJwk: settings.license.publicKeyJwk || null
    };
  }

  return {
    DEFAULT_PERMISSIONS,
    BUILTIN_TEMPLATES,
    analyzeCode,
    buildPackage,
    createChromeCaptureLicenseConfig,
    incrementVersion,
    isValidManifestKey,
    isValidMatchPattern,
    isValidVersion,
    parseList,
    transformChromeCaptureManifest,
    validateOptions
  };
});
