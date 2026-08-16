(function initChromeCaptureLicenseGuard(root, factory) {
  const guard = factory();
  if (typeof module === 'object' && module.exports) module.exports = guard;
  if (root) root.ChromeCaptureLicenseGuard = guard;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createGuard() {
  'use strict';

  const TOKEN_PREFIX = 'F12L1';
  const ATTESTATION_PREFIX = 'F12T1';

  const I18N = {
    zh: {
      licenseTitle: 'Chrome Capture Pro 授权激活',
      licenseSubtitle: '请输入 Tools Platform 提供的本月 License 密钥以解锁全功能特权。',
      licensePlaceholder: 'F12L1.eyJwcm9kdWN0SWQiOiJDaHJvbWUgQ2FwdHVyZSBQcm8iLC... (粘贴完整密钥)',
      activateBtn: '验证并激活 Pro 特权',
      activating: '正在校验签名与有效期…',
      activeStatus: '✨ Pro 授权已激活',
      validUntil: '授权有效至 {date}',
      validUntilOffline: '本地签名验证通过，有效至 {date}',
      expiresSoonDays: '⚠️ License 即将过期：还剩 {count} 天，请提前获取新月密钥',
      expiresSoonHours: '❗ License 即将过期：还剩 {count} 小时，请立即获取新密钥',
      manageLicense: '管理授权',
      updateLicense: '更新密钥',
      copySuccess: '密钥已复制',
      invalidFormat: '密钥格式无效（需为 F12L1 开头的三段式签名）',
      invalidSignature: '数字签名验证失败，公钥不匹配或密钥已被篡改',
      wrongProduct: '密钥产品不匹配（当前扩展要求：{expected}，提供：{actual}）',
      notYetValid: '密钥尚未生效',
      expired: '密钥已过期，请在 Tools Platform 中获取本月新 License',
      revoked: '此 License 已被管理员在后台撤销',
      archived: '此 License 已被管理员归档',
      licenseNotFound: '授权服务器中未找到此 License 记录',
      clockRollback: '检测到系统时钟回拨，请联网重新校验',
      verificationFailed: '校验失败：{reason}',
      onlineRequired: '无法连接授权服务器，请联网后重试',
      proFeaturesUnlocked: '4K超清录制、60FPS、无限时长、无水印及全套编辑功能已全部解锁！'
    },
    en: {
      licenseTitle: 'Chrome Capture Pro Activation',
      licenseSubtitle: 'Enter the monthly License key provided by Tools Platform to unlock all Pro features.',
      licensePlaceholder: 'F12L1.eyJwcm9kdWN0SWQiOiJDaHJvbWUgQ2FwdHVyZSBQcm8iLC... (Paste full key)',
      activateBtn: 'Verify & Activate Pro',
      activating: 'Verifying signature & validity…',
      activeStatus: '✨ Pro License Active',
      validUntil: 'Valid until {date}',
      validUntilOffline: 'Offline signature verified. Valid until {date}',
      expiresSoonDays: '⚠️ License expires soon: {count} day(s) remaining. Obtain next month key in advance',
      expiresSoonHours: '❗ License expires soon: {count} hour(s) remaining. Obtain next month key now',
      manageLicense: 'Manage License',
      updateLicense: 'Update Key',
      copySuccess: 'Key copied',
      invalidFormat: 'Invalid key format (must start with F12L1)',
      invalidSignature: 'Digital signature verification failed. Public key mismatch or tampered key',
      wrongProduct: 'Product mismatch (expected: {expected}, provided: {actual})',
      notYetValid: 'Key is not active yet',
      expired: 'Key has expired. Please obtain a new License for this month in Tools Platform',
      revoked: 'This License has been revoked by administrator',
      archived: 'This License has been archived by administrator',
      licenseNotFound: 'License record was not found on server',
      clockRollback: 'System clock rollback detected. Connect to internet to verify',
      verificationFailed: 'Verification failed: {reason}',
      onlineRequired: 'Unable to connect to authorization server. Please try online',
      proFeaturesUnlocked: '4K Recording, 60FPS, No duration limit, No watermark and Full Editor tools unlocked!'
    }
  };

  let currentLang = 'en';
  function initLanguage() {
    const browserLang = (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getUILanguage
      ? chrome.i18n.getUILanguage()
      : (typeof navigator !== 'undefined' ? navigator.language : 'en')) || 'en';
    currentLang = /^zh(?:-|$)/i.test(browserLang) ? 'zh' : 'en';
  }
  initLanguage();

  function t(key, values = {}) {
    const dict = I18N[currentLang] || I18N.en;
    let template = dict[key] || I18N.en[key] || key;
    return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
  }

  function decodeBase64Url(value) {
    const base64 = String(value || '').replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil((value || '').length / 4) * 4, '=');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function encodeBase64Url(bytes) {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function randomNonce() {
    return encodeBase64Url(crypto.getRandomValues(new Uint8Array(18)));
  }

  async function tokenDigest(token) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    return encodeBase64Url(new Uint8Array(bytes));
  }

  function onlineFailureReason(reasonCode) {
    const key = ({
      NOT_YET_VALID: 'notYetValid',
      EXPIRED: 'expired',
      REVOKED: 'revoked',
      ARCHIVED: 'archived',
      LICENSE_NOT_FOUND: 'licenseNotFound',
      REGISTRY_MISMATCH: 'licenseNotFound'
    })[reasonCode];
    return key ? t(key) : t('verificationFailed', { reason: reasonCode || 'UNKNOWN' });
  }

  let cachedPublicKey = null;
  let cachedPublicKeyJwk = null;

  async function getVerificationKey(jwk) {
    if (!jwk || typeof jwk !== 'object') throw new Error('License 公钥配置缺失');
    if (cachedPublicKey && JSON.stringify(cachedPublicKeyJwk) === JSON.stringify(jwk)) {
      return cachedPublicKey;
    }
    const cryptoSubtle = typeof crypto !== 'undefined' && crypto.subtle ? crypto.subtle : null;
    if (!cryptoSubtle) throw new Error('WebCrypto API 不受支持');
    cachedPublicKey = await cryptoSubtle.importKey(
      'jwk',
      jwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    );
    cachedPublicKeyJwk = jwk;
    return cachedPublicKey;
  }

  async function verifySignedValue(value, prefix, publicKeyJwk) {
    const parts = String(value || '').trim().split('.');
    if (parts.length !== 3 || parts[0] !== prefix) {
      return { valid: false, reason: t('invalidFormat'), reasonCode: 'INVALID_FORMAT' };
    }
    try {
      const payloadBytes = decodeBase64Url(parts[1]);
      const signatureBytes = decodeBase64Url(parts[2]);
      const payloadJson = new TextDecoder('utf-8').decode(payloadBytes);
      const payload = JSON.parse(payloadJson);
      const key = await getVerificationKey(publicKeyJwk);
      const valid = await crypto.subtle.verify(
        { name: 'ECDSA', hash: { name: 'SHA-256' } },
        key,
        signatureBytes,
        new TextEncoder().encode(parts[1])
      );
      if (!valid) return { valid: false, reason: t('invalidSignature'), reasonCode: 'INVALID_SIGNATURE' };
      return { valid: true, payload };
    } catch (err) {
      return { valid: false, reason: err.message || t('invalidFormat'), reasonCode: 'PARSE_ERROR' };
    }
  }

  async function readLicenseConfig() {
    try {
      if (typeof globalThis !== 'undefined' && globalThis.__CHROME_CAPTURE_LICENSE_CONFIG__) {
        return globalThis.__CHROME_CAPTURE_LICENSE_CONFIG__;
      }
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        const url = chrome.runtime.getURL('license-config.json');
        const res = await fetch(url);
        if (res.ok) {
          const cfg = await res.json();
          globalThis.__CHROME_CAPTURE_LICENSE_CONFIG__ = cfg;
          return cfg;
        }
      }
    } catch (_) {}
    return {
      enabled: false,
      productId: 'Chrome Capture Pro',
      validationUrl: '',
      publicKeyJwk: null
    };
  }

  async function getStoredLicenseData() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return {};
    return new Promise(resolve => {
      chrome.storage.local.get([
        'f12LicenseToken',
        'f12LicenseValidation',
        'f12LocalLicenseClock'
      ], resolve);
    });
  }

  async function applyProStatus(isProActive) {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    if (isProActive) {
      await chrome.storage.local.set({
        purchased: true,
        subscriptionInfo: {
          hasPurchased: true,
          isSubscribed: true,
          subscriptionStatus: 'active'
        }
      });
      if (chrome.storage.sync) {
        chrome.storage.sync.get('settings', ({ settings = {} }) => {
          chrome.storage.sync.set({
            settings: {
              ...settings,
              frames: 60,
              maxLength: 'no-limit',
              defaultRecordingOutputResolution: '4K',
              disableRequestRating: true,
              hasRated: true
            }
          });
        });
      }
    }
  }

  async function verifyLicenseToken(token, config, options = {}) {
    const safeToken = String(token || '').trim();
    if (!safeToken) return { valid: false, reasonCode: 'MISSING_TOKEN', reason: t('licenseSubtitle') };
    const verified = await verifySignedValue(safeToken, TOKEN_PREFIX, config.publicKeyJwk);
    if (!verified.valid) return verified;

    const payload = verified.payload;
    const now = options.now || Date.now();
    const expectedProduct = String(config.productId || 'Chrome Capture Pro').trim().toLowerCase();
    const actualProduct = String(payload.productId || '').trim().toLowerCase();

    if (expectedProduct && actualProduct && expectedProduct !== actualProduct) {
      return {
        valid: false,
        reasonCode: 'PRODUCT_MISMATCH',
        reason: t('wrongProduct', { expected: config.productId, actual: payload.productId }),
        payload
      };
    }

    if (now < payload.notBefore) {
      return { valid: false, reasonCode: 'NOT_YET_VALID', reason: t('notYetValid'), payload };
    }
    if (now >= payload.expiresAt) {
      return { valid: false, reasonCode: 'EXPIRED', reason: t('expired'), payload };
    }

    return { valid: true, payload, token: safeToken };
  }

  async function validateOnline(token, config) {
    if (!config.validationUrl) return null;
    const nonce = randomNonce();
    try {
      const response = await fetch(config.validationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          productId: config.productId,
          nonce
        }),
        cache: 'no-store'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          valid: false,
          onlineError: true,
          reason: data.reason || data.error || t('verificationFailed', { reason: `HTTP ${response.status}` }),
          reasonCode: data.reasonCode || 'ONLINE_REJECTED'
        };
      }
      if (data.attestation) {
        const verifiedAttestation = await verifySignedValue(data.attestation, ATTESTATION_PREFIX, config.publicKeyJwk);
        if (verifiedAttestation.valid) {
          const payload = verifiedAttestation.payload;
          const expectedDigest = await tokenDigest(token);
          if (payload.productId !== config.productId) {
            return {
              valid: false,
              onlineError: true,
              reasonCode: 'PRODUCT_MISMATCH',
              reason: t('wrongProduct', { expected: config.productId, actual: payload.productId })
            };
          }
          if (payload.nonce !== nonce || payload.tokenDigest !== expectedDigest || !Number.isFinite(payload.checkedAt)) {
            return {
              valid: false,
              onlineError: true,
              reasonCode: 'INVALID_ATTESTATION',
              reason: t('verificationFailed', { reason: 'INVALID_ATTESTATION' })
            };
          }
          return {
            valid: payload.valid === true,
            reason: payload.valid === true ? null : onlineFailureReason(payload.reasonCode),
            reasonCode: payload.reasonCode,
            payload,
            attestation: data.attestation,
            attestationPayload: payload
          };
        }
        return {
          valid: false,
          onlineError: true,
          reason: verifiedAttestation.reason || t('invalidSignature'),
          reasonCode: verifiedAttestation.reasonCode || 'INVALID_ATTESTATION'
        };
      }
      return {
        valid: false,
        onlineError: true,
        reason: t('verificationFailed', { reason: 'MISSING_ATTESTATION' }),
        reasonCode: 'MISSING_ATTESTATION'
      };
    } catch (err) {
      return { valid: null, onlineError: true, error: err.message };
    }
  }

  async function checkLicenseStatus(options = {}) {
    const config = await readLicenseConfig();
    if (!config || !config.enabled) {
      await applyProStatus(true);
      return { enabled: false, valid: true, pro: true };
    }

    const stored = await getStoredLicenseData();
    const token = options.token || stored.f12LicenseToken;
    if (!token) {
      return { enabled: true, valid: false, reasonCode: 'NO_LICENSE', reason: t('licenseSubtitle'), config };
    }

    const localCheck = await verifyLicenseToken(token, config);
    if (!localCheck.valid) {
      return { enabled: true, valid: false, ...localCheck, config };
    }

    // Check clock rollback
    const now = Date.now();
    const maxClock = Number(stored.f12LocalLicenseClock || 0);
    if (maxClock > now + 300000) { // 5 minutes grace
      return { enabled: true, valid: false, reasonCode: 'CLOCK_ROLLBACK', reason: t('clockRollback'), config };
    }

    // Update local clock
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ f12LocalLicenseClock: Math.max(now, maxClock) });
    }

    // Online verification if requested or in grace period
    let onlineResult = null;
    if (options.forceOnline || !stored.f12LicenseValidation) {
      onlineResult = await validateOnline(token, config);
      if (onlineResult && onlineResult.valid === false) {
        return { enabled: true, valid: false, ...onlineResult, config };
      }
      if (onlineResult && onlineResult.attestationPayload) {
        const checkedAt = Number(onlineResult.attestationPayload.checkedAt);
        const serverTime = Number.isFinite(checkedAt) ? checkedAt : now;
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          await chrome.storage.local.set({
            f12LicenseValidation: onlineResult,
            f12LocalLicenseClock: serverTime
          });
        }
      }
    }

    await applyProStatus(true);
    return {
      enabled: true,
      valid: true,
      pro: true,
      payload: localCheck.payload,
      token,
      config,
      localSignature: true
    };
  }

  async function activateLicense(token) {
    const config = await readLicenseConfig();
    if (!config || !config.enabled) return { success: true };

    const localCheck = await verifyLicenseToken(token, config);
    if (!localCheck.valid) {
      throw new Error(localCheck.reason || t('invalidSignature'));
    }

    const onlineResult = await validateOnline(token, config);
    if (onlineResult && onlineResult.valid === false) {
      throw new Error(onlineResult.reason || t('verificationFailed', { reason: onlineResult.reasonCode }));
    }

    const now = Date.now();
    const checkedAt = onlineResult && onlineResult.attestationPayload
      ? Number(onlineResult.attestationPayload.checkedAt)
      : NaN;
    const serverTime = Number.isFinite(checkedAt) ? checkedAt : now;

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({
        f12LicenseToken: token.trim(),
        f12LicenseValidation: onlineResult || { valid: true, payload: localCheck.payload },
        f12LocalLicenseClock: serverTime
      });
    }

    await applyProStatus(true);
    return { success: true, payload: localCheck.payload };
  }

  function renderLicenseUI(containerElement, onActivatedCallback) {
    if (!containerElement) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'chrome-capture-license-overlay';
    wrapper.style.cssText = `
      position: fixed; inset: 0; z-index: 999999;
      background: rgba(12, 16, 23, 0.96);
      backdrop-filter: blur(12px);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
      color: #f1f5f9; box-sizing: border-box; overflow-y: auto;
    `;

    wrapper.innerHTML = `
      <div style="width: 100%; max-width: 328px; background: rgba(30, 41, 59, 0.85); border: 1px solid rgba(99, 102, 241, 0.35); border-radius: 16px; padding: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">🛡️</span>
            <strong style="font-size: 14px; font-weight: 700; color: #fff;">${t('licenseTitle')}</strong>
          </div>
          <button id="cc-lang-btn" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #cbd5e1; padding: 2px 8px; border-radius: 6px; font-size: 11px; cursor: pointer;">
            ${currentLang === 'zh' ? 'EN' : '中文'}
          </button>
        </div>
        <p style="font-size: 12px; line-height: 1.5; color: #94a3b8; margin: 0 0 14px 0;">
          ${t('licenseSubtitle')}
        </p>
        <div id="cc-license-alert" style="display: none; padding: 8px 10px; border-radius: 8px; font-size: 11px; line-height: 1.4; margin-bottom: 12px;"></div>
        <textarea id="cc-license-input" rows="4" placeholder="${t('licensePlaceholder')}" style="width: 100%; box-sizing: border-box; background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 10px; color: #e2e8f0; font-family: monospace; font-size: 11px; padding: 8px; resize: none; margin-bottom: 14px; outline: none;"></textarea>
        <button id="cc-activate-btn" style="width: 100%; background: linear-gradient(135deg, #6366f1 0%, #06b6d4 100%); color: #fff; border: 0; border-radius: 10px; padding: 10px 14px; font-size: 13px; font-weight: 650; cursor: pointer; transition: opacity 0.2s; box-shadow: 0 4px 14px rgba(99,102,241,0.35);">
          ${t('activateBtn')}
        </button>
        <div style="margin-top: 12px; text-align: center; font-size: 11px; color: #64748b;">
          Tools Platform • ECDSA P-256
        </div>
      </div>
    `;

    containerElement.appendChild(wrapper);

    const alertBox = wrapper.querySelector('#cc-license-alert');
    const input = wrapper.querySelector('#cc-license-input');
    const btn = wrapper.querySelector('#cc-activate-btn');
    const langBtn = wrapper.querySelector('#cc-lang-btn');

    langBtn.addEventListener('click', () => {
      currentLang = currentLang === 'zh' ? 'en' : 'zh';
      wrapper.remove();
      renderLicenseUI(containerElement, onActivatedCallback);
    });

    btn.addEventListener('click', async () => {
      const val = input.value.trim();
      if (!val) {
        alertBox.style.display = 'block';
        alertBox.style.background = 'rgba(239, 68, 68, 0.15)';
        alertBox.style.border = '1px solid rgba(239, 68, 68, 0.4)';
        alertBox.style.color = '#fca5a5';
        alertBox.textContent = t('invalidFormat');
        return;
      }
      btn.disabled = true;
      btn.textContent = t('activating');
      try {
        await activateLicense(val);
        alertBox.style.display = 'block';
        alertBox.style.background = 'rgba(16, 185, 129, 0.15)';
        alertBox.style.border = '1px solid rgba(16, 185, 129, 0.4)';
        alertBox.style.color = '#6ee7b7';
        alertBox.textContent = `${t('activeStatus')}！${t('proFeaturesUnlocked')}`;
        setTimeout(() => {
          wrapper.remove();
          if (typeof onActivatedCallback === 'function') onActivatedCallback();
        }, 1200);
      } catch (err) {
        alertBox.style.display = 'block';
        alertBox.style.background = 'rgba(239, 68, 68, 0.15)';
        alertBox.style.border = '1px solid rgba(239, 68, 68, 0.4)';
        alertBox.style.color = '#fca5a5';
        alertBox.textContent = err.message || t('invalidSignature');
        btn.disabled = false;
        btn.textContent = t('activateBtn');
      }
    });
  }

  function injectLicenseStatusBadge(containerElement, status) {
    if (!containerElement || !status || !status.payload) return;
    const existing = document.getElementById('cc-license-badge');
    if (existing) existing.remove();

    const badge = document.createElement('div');
    badge.id = 'cc-license-badge';
    const expiresDate = new Date(status.payload.expiresAt);
    const msLeft = status.payload.expiresAt - Date.now();
    const daysLeft = Math.ceil(msLeft / 86400000);

    const isUrgent = daysLeft <= 1;
    const isWarn = daysLeft <= 3;

    const isPopup = Boolean(document.getElementById('mountNode'));
    const popupBadgeStyles = isPopup ? `
      position: fixed; left: 10px; right: 92px; bottom: 7px; height: 38px; z-index: 2147483646;
      padding: 4px 8px; margin: 0;
    ` : `
      padding: 6px 12px; margin: 6px 10px;
    `;

    badge.style.cssText = `
      display: flex; align-items: center; justify-content: space-between; gap: 6px;
      ${popupBadgeStyles}
      border-radius: 8px; font-size: ${isPopup ? '10px' : '11px'}; font-weight: 500;
      background: ${isUrgent ? 'rgba(239,68,68,0.2)' : isWarn ? 'rgba(245,158,11,0.2)' : 'rgba(99,102,241,0.15)'};
      border: 1px solid ${isUrgent ? 'rgba(239,68,68,0.5)' : isWarn ? 'rgba(245,158,11,0.5)' : 'rgba(99,102,241,0.35)'};
      color: ${isUrgent ? '#fca5a5' : isWarn ? '#fcd34d' : '#c7d2fe'};
    `;

    badge.innerHTML = `
      <span>🔑 ${status.payload.month} (${daysLeft > 0 ? `${daysLeft}天` : '今天到期'})</span>
      <span style="font-size: 10px; opacity: 0.8; cursor: pointer;" id="cc-badge-renew">${t('updateLicense')}</span>
    `;

    if (isPopup) {
      badge.classList.add('cc-license-badge--popup');
      document.body.classList.add('cc-license-badge-in-footer');
      document.body.append(badge);
    } else {
      containerElement.prepend(badge);
    }
    badge.querySelector('#cc-badge-renew').addEventListener('click', () => {
      renderLicenseUI(document.body, () => {
        location.reload();
      });
    });
  }

  // Auto-run guard on DOMContentLoaded if in window context
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.addEventListener('DOMContentLoaded', async () => {
      try {
        const config = await readLicenseConfig();
        if (config && config.enabled) {
          const status = await checkLicenseStatus();
          if (!status.valid) {
            const mount = document.body;
            renderLicenseUI(mount, () => {
              location.reload();
            });
          } else {
            injectLicenseStatusBadge(document.body, status);
          }
        }
      } catch (err) {
        console.warn('[ChromeCapture License Guard]', err);
      }
    });
  }

  return {
    TOKEN_PREFIX,
    ATTESTATION_PREFIX,
    verifySignedValue,
    readLicenseConfig,
    verifyLicenseToken,
    checkLicenseStatus,
    activateLicense,
    renderLicenseUI,
    injectLicenseStatusBadge,
    t
  };
});
