const GATEKEEPER_STYLE = `
body.tp-locked > *:not(#tpGatekeeperModal):not(#tpGatekeeperStyle) { display: none !important; }
.tp-gatekeeper-overlay { position: fixed; inset: 0; z-index: 999999; display: grid; place-items: center; padding: 20px; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); font-family: system-ui, -apple-system, sans-serif; color: #1e293b; }
.tp-gatekeeper-dialog { width: min(420px, 92vw); background: #ffffff; border-radius: 20px; padding: 32px 28px; box-shadow: 0 25px 60px rgba(0,0,0,0.3); text-align: center; border: 1px solid rgba(255,255,255,0.2); }
.tp-gatekeeper-icon { font-size: 40px; margin-bottom: 12px; line-height: 1; }
.tp-gatekeeper-dialog h3 { margin: 0 0 8px; font-size: 20px; font-weight: 750; color: #0f172a; }
.tp-gatekeeper-dialog p { margin: 0 0 20px; font-size: 13px; color: #64748b; line-height: 1.5; }
.tp-gatekeeper-form { display: flex; flex-direction: column; gap: 12px; }
.tp-gatekeeper-input { width: 100%; box-sizing: border-box; padding: 12px 14px; font-size: 14px; border: 1.5px solid #cbd5e1; border-radius: 10px; outline: none; transition: border-color .2s; }
.tp-gatekeeper-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15); }
.tp-gatekeeper-btn { width: 100%; padding: 12px; font-size: 14px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #2563eb, #1d4ed8); border: none; border-radius: 10px; cursor: pointer; transition: opacity .2s; }
.tp-gatekeeper-btn:hover { opacity: 0.92; }
.tp-gatekeeper-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.tp-gatekeeper-error { margin-top: 6px; font-size: 12px; color: #ef4444; font-weight: 600; min-height: 18px; }
@media (prefers-color-scheme: dark) {
  .tp-gatekeeper-dialog { background: #1e293b; border-color: #334155; color: #f8fafc; }
  .tp-gatekeeper-dialog h3 { color: #f8fafc; }
  .tp-gatekeeper-dialog p { color: #94a3b8; }
  .tp-gatekeeper-input { background: #0f172a; border-color: #334155; color: #f8fafc; }
}
`;

function injectGatekeeper(html, encryption, toolSlug = 'department-reward-penalty') {
    if (!encryption || !encryption.enabled) return html;
    const hash = String(encryption.passwordHash || encryption.hash || '');
    const salt = String(encryption.passwordSalt || encryption.salt || '');
    if (!hash) return html;
    const modalHtml = `<style id="tpGatekeeperStyle">${GATEKEEPER_STYLE}</style>
<div id="tpGatekeeperModal" class="tp-gatekeeper-overlay" role="dialog" aria-modal="true" aria-labelledby="tpGatekeeperTitle">
  <div class="tp-gatekeeper-dialog">
    <div class="tp-gatekeeper-icon" aria-hidden="true">🔒</div>
    <h3 id="tpGatekeeperTitle">访问受限 · 密码保护</h3>
    <p>该静态页面已启用访问保护，请输入访问密码以继续浏览。</p>
    <div class="tp-gatekeeper-form">
      <input type="password" id="tpGatekeeperInput" class="tp-gatekeeper-input" placeholder="请输入访问密码" autocomplete="current-password" autofocus onkeydown="if(event.key==='Enter')tpUnlockSnapshot(event)" />
      <button type="button" id="tpGatekeeperSubmit" class="tp-gatekeeper-btn" onclick="tpUnlockSnapshot(event)">解锁页面</button>
    </div>
    <div id="tpGatekeeperError" class="tp-gatekeeper-error" hidden></div>
  </div>
</div>`;
    const script = `<script>
(function() {
    const HASH = ${JSON.stringify(hash)};
    const SALT = ${JSON.stringify(salt)};
    const KEY = 'tp_unlocked_' + ${JSON.stringify(toolSlug)};

    async function computeHash(pwd) {
        const text = new TextEncoder().encode(pwd + ':' + SALT);
        const buffer = await window.crypto.subtle.digest('SHA-256', text);
        return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    window.tpIsUnlocked = function() {
        try { return sessionStorage.getItem(KEY) === '1'; } catch (_) { return false; }
    };

    function doUnlock() {
        try { sessionStorage.setItem(KEY, '1'); } catch (_) {}
        document.body.classList.remove('tp-locked');
        const modal = document.getElementById('tpGatekeeperModal');
        if (modal) modal.remove();
        const style = document.getElementById('tpGatekeeperStyle');
        if (style) style.remove();
        if (typeof window.refresh === 'function') window.refresh();
        else if (typeof window.renderAll === 'function') window.renderAll();
        else if (typeof window.load === 'function') window.load();
    }

    window.tpUnlockSnapshot = async function(e) {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        const input = document.getElementById('tpGatekeeperInput');
        const btn = document.getElementById('tpGatekeeperSubmit');
        const err = document.getElementById('tpGatekeeperError');
        if (!input) return;
        const val = input.value.trim();
        if (!val) {
            if (err) { err.textContent = '请输入访问密码'; err.hidden = false; }
            input.focus();
            return;
        }
        if (btn) btn.disabled = true;
        try {
            const h = await computeHash(val);
            if (h === HASH) {
                doUnlock();
            } else {
                if (err) { err.textContent = '密码错误，请重新输入'; err.hidden = false; }
                input.value = '';
                input.focus();
            }
        } catch (error) {
            if (err) { err.textContent = '校验失败：' + error.message; err.hidden = false; }
        } finally {
            if (btn) btn.disabled = false;
        }
    };

    if (window.tpIsUnlocked()) {
        const modal = document.getElementById('tpGatekeeperModal');
        if (modal) modal.remove();
        const style = document.getElementById('tpGatekeeperStyle');
        if (style) style.remove();
    } else {
        document.body.classList.add('tp-locked');
        window.addEventListener('DOMContentLoaded', () => {
            if (!window.tpIsUnlocked()) {
                document.body.classList.add('tp-locked');
                const inp = document.getElementById('tpGatekeeperInput');
                if (inp) inp.focus();
            }
        });
    }
})();
</script>`;

    let res = html.replace(/<body([^>]*)>/i, `<body$1>\n${modalHtml}`);
    res = res.replace('</body>', `${script}\n</body>`);
    return res;
}

module.exports = { injectGatekeeper, GATEKEEPER_STYLE };
