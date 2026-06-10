/**
 * uivf12/genlog.js - 生成日志面板控制器
 * 提供结构化的生成过程可视化日志，按级别着色输出
 */

const UIVGenLog = (() => {
    let _count = 0;

    function _ts() {
        const now = new Date();
        return now.toTimeString().substring(0, 8);
    }

    function _write(msg, level = 'info') {
        const content = document.getElementById('genLogContent');
        if (!content) return;

        // 第一条日志时清除"等待生成..."占位
        if (_count === 0) content.innerHTML = '';

        _count++;

        const line = document.createElement('div');
        line.className = 'log-line';
        line.innerHTML = `<span class="log-ts">${_ts()}</span><span class="log-msg ${level}">${msg}</span>`;
        content.appendChild(line);

        // 滚动到底部
        const body = document.getElementById('genLogBody');
        if (body) body.scrollTop = body.scrollHeight;

        // 更新徽章
        const badge = document.getElementById('genLogBadge');
        if (badge) { badge.textContent = _count; badge.style.display = 'inline-block'; }
    }

    function _open() {
        const body = document.getElementById('genLogBody');
        const icon = document.getElementById('genLogIcon');
        if (body) body.style.display = 'block';
        if (icon) icon.classList.add('open');
    }

    function setStatus(type, text) {
        const el = document.getElementById('genLogStatus');
        if (!el) return;
        el.className = 'gen-log-status ' + type;
        el.textContent = text;
    }

    // ── 公开 API ─────────────────────────────────────────

    function start() {
        // 重置日志区，展开面板，设置 busy 状态
        _count = 0;
        const content = document.getElementById('genLogContent');
        if (content) content.innerHTML = UIVI18n.waitingMarkup();
        const badge = document.getElementById('genLogBadge');
        if (badge) { badge.textContent = '0'; badge.style.display = 'none'; }
        _open();
        setStatus('busy', UIVT('uiv.log.busy'));
    }

    function info(msg)    { _write('ℹ️  ' + msg, 'info'); }
    function success(msg) { _write('✅ ' + msg, 'success'); }
    function warn(msg)    { _write('⚠️  ' + msg, 'warn'); }
    function error(msg)   { _write('❌ ' + msg, 'error'); }
    function section(msg) { _write('── ' + msg + ' ──', 'section'); }
    function dim(msg)     { _write(msg, 'dim'); }

    function done(isOk, summary) {
        if (isOk) {
            success(UIVT('uiv.log.done') + (summary ? ' | ' + summary : ''));
            setStatus('ok', UIVT('uiv.log.ok'));
        } else {
            setStatus('err', UIVT('uiv.log.err'));
        }
    }

    function toggle() {
        const body = document.getElementById('genLogBody');
        const icon = document.getElementById('genLogIcon');
        if (!body) return;
        const isOpen = body.style.display !== 'none';
        body.style.display = isOpen ? 'none' : 'block';
        if (icon) icon.classList.toggle('open', !isOpen);
    }

    function clear() {
        _count = 0;
        const content = document.getElementById('genLogContent');
        if (content) content.innerHTML = UIVI18n.waitingMarkup();
        const badge = document.getElementById('genLogBadge');
        if (badge) { badge.textContent = '0'; badge.style.display = 'none'; }
        const status = document.getElementById('genLogStatus');
        if (status) { status.className = 'gen-log-status'; status.textContent = ''; }
    }

    function refreshI18n() {
        const content = document.getElementById('genLogContent');
        if (content && _count === 0) content.innerHTML = UIVI18n.waitingMarkup();
    }

    return { start, info, success, warn, error, section, dim, done, toggle, clear, refreshI18n };
})();
