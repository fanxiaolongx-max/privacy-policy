const fs = require('fs');
const path = require('path');

const MENU_FILE = '.tools-platform-menu.json';
const START = '<!-- tools-platform:menu:start -->';
const END = '<!-- tools-platform:menu:end -->';
const GUIDE_START = '<!-- tools-platform:guide:start -->';
const GUIDE_END = '<!-- tools-platform:guide:end -->';
const bad = message => Object.assign(new Error(message), { status: 400 });
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const escapeTable = value => String(value).replace(/\s+/g, ' ').replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\[/g, '\\[').replace(/\]/g, '\\]').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[`*_!]/g, '\\$&').replace(/</g, '&lt;').replace(/>/g, '&gt;').trim();

function validateItem(item) {
    if (!item || !/^[a-z0-9][a-z0-9_-]{0,47}$/.test(item.slug)
        || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 80
        || (item.description !== undefined && (typeof item.description !== 'string' || item.description.length > 300))
        || typeof item.href !== 'string' || !/^\.\/[\w./-]+\.html$/.test(item.href)
        || item.href.slice(2).split('/').some(part => !part || part === '.' || part === '..')) {
        throw bad('仓库工具菜单清单格式无效，请检查 ' + MENU_FILE);
    }
    return {
        slug: item.slug,
        name: item.name.trim(),
        description: String(item.description || '').replace(/\s+/g, ' ').trim(),
        href: item.href,
        encrypted: Boolean(item.encrypted)
    };
}

function renderGuide(items) {
    const rows = items.map(item => {
        const lock = item.encrypted ? ' 🔒' : '';
        const desc = (item.description || '查看最新只读数据快照') + (item.encrypted ? '（受密码保护）' : '');
        return `| ${escapeTable(item.name)}${lock} | \`${item.slug}\` | ${escapeTable(desc)} | [打开页面](${item.href}) |`;
    }).join('\n');
    return `${GUIDE_START}
## 已发布工具

本仓库集中托管工具的只读静态页面。页面中的数据随平台推送更新；访问范围由仓库及 Pages 的权限设置决定。

| 工具 | 标识（slug） | 简介 | 页面 |
| --- | --- | --- | --- |
${rows}

> 工具页面仅供查看；需要修改业务数据时，请返回 Tools Platform 联系管理员。
${GUIDE_END}`;
}

function updateGuide(markdown, section, fileName) {
    const starts = markdown.split(GUIDE_START).length - 1;
    const ends = markdown.split(GUIDE_END).length - 1;
    if (starts !== ends || starts > 1) throw bad('仓库说明中的工具目录标记不完整或重复，请人工检查 ' + fileName);
    if (starts === 1) {
        const start = markdown.indexOf(GUIDE_START);
        const end = markdown.indexOf(GUIDE_END);
        if (end < start) throw bad('仓库说明中的工具目录标记顺序有误，请人工检查 ' + fileName);
        return markdown.slice(0, start) + section + markdown.slice(end + GUIDE_END.length);
    }
    return markdown + (markdown.endsWith('\n') ? '\n' : '\n\n') + section + '\n';
}

function chooseGuideFile(checkout) {
    // Keep updating the guide we previously managed, even if another Markdown
    // file is later added to the repository.
    for (const name of ['repository-guide.md', 'README.md']) {
        const file = path.join(checkout, name);
        if (fs.lstatSync(file, { throwIfNoEntry: false })?.isFile() && fs.readFileSync(file, 'utf8').includes(GUIDE_START)) return name;
    }
    for (const name of ['repository-guide.md', 'README.md']) {
        if (fs.lstatSync(path.join(checkout, name), { throwIfNoEntry: false })) return name;
    }
    return 'README.md';
}

function renderMenu(items) {
    const links = items.map(item => {
        const badge = item.encrypted ? `<span class="tp-menu-badge tp-menu-encrypted" title="访问此工具需输入密码">🔒 密码保护</span>` : '';
        return `        <a class="tp-menu-card" href="${escapeHtml(item.href)}"><span class="tp-menu-icon" aria-hidden="true">${item.encrypted ? '🔒' : '↗'}</span><span class="tp-menu-card-text"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.slug)} · 只读页面</small>${badge}</span><span class="tp-menu-arrow" aria-hidden="true">→</span></a>`;
    }).join('\n');
    return `${START}
<style>
.tp-publish-menu{box-sizing:border-box;max-width:1180px;margin:20px auto;padding:25px 28px;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#1e293b;background:#f8fafc;border:1px solid #e2e8f0;border-radius:20px;box-shadow:0 12px 35px rgba(15,23,42,.06)}
.tp-publish-menu *{box-sizing:border-box}.tp-menu-head{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:19px}.tp-menu-kicker{display:block;color:#396b9e;font-size:11px;font-weight:800;letter-spacing:.15em}.tp-menu-head h2{margin:5px 0 0;color:#15263c;font-size:22px;line-height:1.3}.tp-menu-head p{margin:0;color:#52657a;font-size:12px;line-height:1.6}
.tp-menu-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:12px}.tp-menu-card{display:flex;align-items:center;gap:13px;min-height:76px;padding:15px;border:1px solid #dce5ef;border-radius:14px;background:#fff;color:#20334c;text-decoration:none;box-shadow:0 2px 7px rgba(15,23,42,.03);transition:transform .18s,border-color .18s,box-shadow .18s}.tp-menu-card:hover,.tp-menu-card:focus-visible{transform:translateY(-2px);border-color:#7aa9d8;box-shadow:0 10px 24px rgba(29,78,130,.12);outline:none}.tp-menu-icon{display:grid;place-items:center;flex:0 0 38px;height:38px;border-radius:11px;background:#eaf3ff;color:#1b61a8;font-size:21px}.tp-menu-card-text{display:grid;gap:4px;min-width:0}.tp-menu-card-text strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}.tp-menu-card-text small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#60758b;font-size:11px}.tp-menu-arrow{margin-left:auto;color:#6285aa;font-size:18px}
.tp-menu-badge{display:inline-flex;align-items:center;gap:3px;margin-top:2px;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;width:fit-content}
.tp-menu-encrypted{background:#fef3c7;color:#92400e;border:1px solid #fde68a}
@media(max-width:640px){.tp-publish-menu{margin:12px;padding:18px}.tp-menu-head{display:block}.tp-menu-head p{margin-top:7px}}
</style>
<nav class="tp-publish-menu" aria-label="只读工具入口">
  <div class="tp-menu-head"><div><span class="tp-menu-kicker">TOOLS / READ ONLY</span><h2>工具入口</h2></div><p>选择工具，查看最新发布的数据快照</p></div>
  <div class="tp-menu-grid">
${links}
  </div>
</nav>
${END}`;
}

function updateIndex(html, menu) {
    const starts = html.split(START).length - 1;
    const ends = html.split(END).length - 1;
    if (starts !== ends || starts > 1) throw bad('仓库首页工具菜单标记不完整或重复，请人工检查 index.html');
    if (starts === 1) {
        const start = html.indexOf(START);
        const end = html.indexOf(END);
        if (end < start) throw bad('仓库首页工具菜单标记顺序有误，请人工检查 index.html');
        return html.slice(0, start) + menu + html.slice(end + END.length);
    }
    if (!/<body\b[^>]*>/i.test(html)) throw bad('仓库首页缺少 body 标签，无法安全添加工具菜单');
    return html.replace(/<body\b[^>]*>/i, match => match + '\n' + menu + '\n');
}

function updatePublishMenu(checkout, entry) {
    const item = validateItem(entry);
    const indexFile = path.join(checkout, 'index.html');
    const manifestFile = path.join(checkout, MENU_FILE);
    const guideName = chooseGuideFile(checkout);
    const guideFile = path.join(checkout, guideName);
    for (const file of [indexFile, manifestFile, guideFile]) {
        const stat = fs.lstatSync(file, { throwIfNoEntry: false });
        if (stat && !stat.isFile()) throw bad('仓库首页、菜单清单或说明文件不是普通文件，已停止发布');
    }
    let items = [];
    if (fs.existsSync(manifestFile)) {
        let parsed;
        try { parsed = JSON.parse(fs.readFileSync(manifestFile, 'utf8')); } catch { throw bad('仓库工具菜单清单不是有效 JSON'); }
        if (parsed?.version !== 1 || !Array.isArray(parsed.items) || parsed.items.length > 200) throw bad('仓库工具菜单清单版本或条目数无效');
        items = parsed.items.map(validateItem);
        if (new Set(items.map(row => row.slug)).size !== items.length) throw bad('仓库工具菜单清单存在重复 slug');
    } else if (fs.existsSync(indexFile) && fs.readFileSync(indexFile, 'utf8').includes(START)) {
        throw bad('仓库首页已有工具菜单但缺少清单，请先恢复 ' + MENU_FILE);
    }
    const existing = items.findIndex(row => row.slug === item.slug);
    if (existing >= 0) items[existing] = item;
    else items.push(item);
    const menu = renderMenu(items);
    const current = fs.existsSync(indexFile) ? fs.readFileSync(indexFile, 'utf8') : '';
    const next = current
        ? updateIndex(current, menu)
        : `<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>工具入口</title>\n<style>body.tp-publish-home{margin:0;padding:24px;background:#f1f5f9}</style>\n</head>\n<body class="tp-publish-home">\n${menu}\n</body>\n</html>\n`;
    const currentGuide = fs.existsSync(guideFile) ? fs.readFileSync(guideFile, 'utf8') : '';
    const guide = currentGuide
        ? updateGuide(currentGuide, renderGuide(items), guideName)
        : `# 静态工具仓库\n\n本仓库提供工具的只读静态页面，便于通过 Pages 统一访问。\n\n${renderGuide(items)}\n`;
    fs.writeFileSync(indexFile, next);
    fs.writeFileSync(manifestFile, JSON.stringify({ version: 1, items }, null, 2) + '\n');
    fs.writeFileSync(guideFile, guide);
    return { indexFile, manifestFile, guideFile, guideName, items };
}

module.exports = { updatePublishMenu, MENU_FILE };
