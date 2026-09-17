(function () {
    'use strict';

    const allowedTags = new Set(['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'SPAN', 'STRONG', 'B', 'EM', 'I', 'BR', 'UL', 'OL', 'LI', 'A']);
    const styleNames = ['color', 'background-color', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-decoration', 'text-align', 'line-height', 'padding', 'border-top', 'border-right', 'border-bottom', 'border-left'];

    function copyForEmail(source) {
        if (source.nodeType === Node.TEXT_NODE) return document.createTextNode(source.textContent || '');
        if (source.nodeType !== Node.ELEMENT_NODE) return null;
        const style = getComputedStyle(source);
        if (style.display === 'none' || style.visibility === 'hidden') return null;
        const tag = allowedTags.has(source.tagName) ? source.tagName.toLowerCase() : 'div';
        const target = document.createElement(tag);
        if (tag === 'a' && /^https?:\/\//i.test(source.href)) target.href = source.href;
        const inline = styleNames.map(name => {
            const value = style.getPropertyValue(name);
            return value && value !== 'none' && value !== 'normal' && value !== 'rgba(0, 0, 0, 0)' ? `${name}:${value}` : '';
        }).filter(Boolean);
        if (tag === 'table') inline.push('border-collapse:collapse', 'width:100%');
        if (tag === 'td' || tag === 'th') inline.push('vertical-align:top');
        if (inline.length) target.setAttribute('style', inline.join(';'));
        if (tag === 'td' || tag === 'th') {
            if (source.colSpan > 1) target.colSpan = source.colSpan;
            if (source.rowSpan > 1) target.rowSpan = source.rowSpan;
        }
        Array.from(source.childNodes).forEach(child => {
            const copied = copyForEmail(child);
            if (copied) target.appendChild(copied);
        });
        return target;
    }

    function showError(error) {
        const overlay = document.createElement('div');
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.55)';
        const panel = document.createElement('div');
        panel.style.cssText = 'width:min(680px,100%);max-height:85vh;display:flex;flex-direction:column;gap:12px;padding:18px;border-radius:12px;background:#fff;color:#0f172a;box-shadow:0 20px 50px #0004';
        const heading = document.createElement('strong');
        heading.textContent = `MSG 导出失败${error.status ? `（HTTP ${error.status}）` : ''}`;
        const summary = document.createElement('div');
        summary.textContent = error.message || '请求失败';
        panel.append(heading, summary);
        if (error.responseHtml) {
            const frame = document.createElement('iframe');
            frame.setAttribute('title', '服务器响应内容');
            frame.setAttribute('sandbox', '');
            frame.style.cssText = 'width:100%;height:min(48vh,400px);border:1px solid #cbd5e1;border-radius:6px;background:#fff';
            frame.srcdoc = error.responseHtml;
            panel.appendChild(frame);
        } else if (error.responseText) {
            const details = document.createElement('pre');
            details.style.cssText = 'max-height:40vh;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;border:1px solid #cbd5e1;padding:10px';
            details.textContent = error.responseText;
            panel.appendChild(details);
        }
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = '关闭';
        close.style.cssText = 'align-self:flex-end;padding:7px 18px;cursor:pointer';
        close.addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', event => { if (event.target === overlay) overlay.remove(); });
        panel.appendChild(close);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        close.focus();
    }

    async function download(root, subject, filename, attachment) {
        if (!root) throw new Error('当前没有可导出的月报');
        const theme = document.documentElement.getAttribute('data-theme');
        let content;
        try {
            if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'light');
            content = copyForEmail(root);
        } finally {
            if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
        }
        const html = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#ffffff;color:#0f172a;font-family:Microsoft YaHei,Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#ffffff"><tr><td align="center" style="padding:18px"><table role="presentation" width="960" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:960px"><tr><td>${content.outerHTML}</td></tr></table></td></tr></table></body></html>`;
        let file;
        if (attachment) {
            const data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result).split(',')[1]);
                reader.onerror = () => reject(reader.error || new Error('附件读取失败'));
                reader.readAsDataURL(new Blob([attachment.bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
            });
            file = { filename: attachment.filename, data };
        }
        const response = await fetch('/api/report-msg/export', {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject, html, text: root.innerText || root.textContent || '', attachment: file })
        });
        if (!response.ok) {
            const responseText = await response.text();
            const contentType = response.headers.get('content-type') || '';
            let body = {};
            if (contentType.includes('json')) {
                try { body = JSON.parse(responseText); } catch (_) { /* Show the original response below. */ }
            }
            const error = new Error(body.message || body.error || `请求失败（${response.status}）`);
            error.status = response.status;
            if (contentType.includes('html') || /^\s*(?:<!doctype|<html)/i.test(responseText)) error.responseHtml = responseText;
            else if (!body.message && !body.error) error.responseText = responseText;
            throw error;
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    window.ReportMsgExport = { download, showError };
})();
