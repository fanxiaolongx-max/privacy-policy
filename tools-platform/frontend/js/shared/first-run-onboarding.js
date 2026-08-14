/**
 * First-run quick-start prompt shared by source, installed and portable builds.
 * The decision is stored by the backend in its active data directory, so it is
 * independent of browser cache and Electron packaging mode.
 */
(function initFirstRunOnboardingModule() {
    const MODAL_ID = 'defaultQuickStartModal';
    const README_URL = 'https://github.com/fanxiaolongx-max/privacy-policy#默认快速上手包';

    function isEnglish() {
        const value = localStorage.getItem('tools_lang') || navigator.language || document.documentElement.lang || '';
        return /^en/i.test(value);
    }

    function strings() {
        return isEnglish() ? {
            eyebrow: 'FIRST-RUN QUICK START',
            title: 'Import the ready-to-use defaults?',
            intro: 'Choose whether to add the bundled scheduling scripts and complete KPI rules. You can start with the maintained baseline and customize it later.',
            scriptsTitle: 'Smart scheduling script repository',
            scriptsBody: '{scripts} production scripts across {categories} categories, including NetCare, DataFab, IBMS and iSales collection flows.',
            rulesTitle: 'Complete KPI rule set',
            rulesBody: '{targets} target/weight rules, {prefs} source profiles, {groups} metric groups and {metricCategories} customer categories.',
            safeTitle: 'Existing data stays in control',
            safeBody: 'Import only adds missing defaults. Existing scripts and rules with the same identity are preserved, and a backup is created before writing.',
            docs: 'Read every bundled script and rule in README',
            selectHint: 'Select either or both:',
            scriptsOption: 'Default script repository',
            rulesOption: 'Complete KPI rules',
            import: 'Import selected defaults',
            skip: 'Do not import',
            importing: 'Importing and backing up existing configuration…',
            skipping: 'Saving your choice…',
            success: 'Defaults imported. Reloading the workspace…',
            skipped: 'Choice saved. You can continue with an empty/custom configuration.',
            chooseOne: 'Select at least one item to import.',
            failed: 'Could not save the first-run choice: '
        } : {
            eyebrow: '首次启动快速上手',
            title: '是否导入开箱即用的默认内容？',
            intro: '可选择导入当前维护的智能调度脚本仓库和全量指标规则，先快速跑起来，之后再按自己的业务调整。',
            scriptsTitle: '智能调度脚本仓库',
            scriptsBody: '包含 {scripts} 个生产脚本、{categories} 个分类，覆盖 NetCare、DataFab、IBMS 和 iSales 等抓取链路。',
            rulesTitle: '全量指标规则',
            rulesBody: '包含 {targets} 条目标/权重规则、{prefs} 份数据源配置、{groups} 个指标分组和 {metricCategories} 个客户类别。',
            safeTitle: '不抢占现有配置',
            safeBody: '导入只补齐缺失的默认项；同名脚本和同标识规则保留当前版本，写入前还会自动备份。',
            docs: '在 README 中逐个查看默认脚本和指标规则',
            selectHint: '可选一项或两项都选：',
            scriptsOption: '默认脚本仓库',
            rulesOption: '全量指标规则',
            import: '导入选中的默认内容',
            skip: '不导入，直接使用',
            importing: '正在备份现有配置并导入…',
            skipping: '正在保存选择…',
            success: '默认内容已导入，正在重新加载工作区…',
            skipped: '已保存选择，可继续使用空白或自定义配置。',
            chooseOne: '请至少选择一项需要导入的内容。',
            failed: '首次启动选择保存失败：'
        };
    }

    function interpolate(template, values) {
        return String(template).replace(/\{(\w+)\}/g, (_match, key) => values[key] ?? '0');
    }

    function addStyles() {
        if (document.getElementById('defaultQuickStartStyles')) return;
        const style = document.createElement('style');
        style.id = 'defaultQuickStartStyles';
        style.textContent = `
            .quick-start-overlay{position:fixed;inset:0;z-index:2147482000;display:grid;place-items:center;padding:24px;background:rgba(2,6,23,.82);backdrop-filter:blur(14px)}
            .quick-start-card{width:min(760px,100%);max-height:calc(100vh - 48px);overflow:auto;border:1px solid rgba(125,211,252,.28);border-radius:24px;background:linear-gradient(145deg,#0f172a 0%,#111827 58%,#172554 100%);color:#e2e8f0;box-shadow:0 32px 100px rgba(0,0,0,.58);font-family:Inter,"Microsoft YaHei",sans-serif}
            .quick-start-head{padding:30px 32px 20px;border-bottom:1px solid rgba(148,163,184,.15)}
            .quick-start-eyebrow{color:#67e8f9;font-size:11px;font-weight:900;letter-spacing:.18em}.quick-start-head h2{margin:8px 0 10px;color:#fff;font-size:26px;line-height:1.2}.quick-start-head p{margin:0;color:#94a3b8;font-size:13px;line-height:1.7}
            .quick-start-body{padding:22px 32px 30px}.quick-start-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.quick-start-info{padding:16px;border:1px solid rgba(148,163,184,.16);border-radius:15px;background:rgba(15,23,42,.62)}
            .quick-start-info.safe{grid-column:1/-1}.quick-start-info strong{display:block;margin-bottom:6px;color:#f8fafc;font-size:14px}.quick-start-info p{margin:0;color:#94a3b8;font-size:12px;line-height:1.6}.quick-start-info .icon{float:right;font-size:24px}
            .quick-start-docs{display:inline-flex;margin:15px 0 19px;color:#7dd3fc;font-size:12px;text-decoration:none}.quick-start-docs:hover{text-decoration:underline}.quick-start-select-title{margin-bottom:10px;color:#cbd5e1;font-size:12px;font-weight:800}
            .quick-start-options{display:grid;grid-template-columns:1fr 1fr;gap:10px}.quick-start-option{display:flex;align-items:center;gap:10px;padding:13px 14px;border:1px solid rgba(56,189,248,.26);border-radius:13px;background:rgba(14,116,144,.12);color:#e0f2fe;font-size:13px;font-weight:800;cursor:pointer}.quick-start-option input{width:17px;height:17px;accent-color:#06b6d4}
            .quick-start-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}.quick-start-actions button{min-height:42px;padding:0 18px;border-radius:11px;font-size:12px;font-weight:900;cursor:pointer}.quick-start-skip{border:1px solid rgba(148,163,184,.28);background:transparent;color:#cbd5e1}.quick-start-import{border:0;background:linear-gradient(135deg,#0891b2,#2563eb);color:#fff;box-shadow:0 10px 28px rgba(37,99,235,.3)}
            .quick-start-actions button:disabled{opacity:.55;cursor:wait}.quick-start-result{min-height:20px;margin-top:12px;color:#a5f3fc;font-size:12px;text-align:right}.quick-start-result.error{color:#fda4af}
            @media(max-width:650px){.quick-start-overlay{padding:12px}.quick-start-head,.quick-start-body{padding-left:20px;padding-right:20px}.quick-start-grid,.quick-start-options{grid-template-columns:1fr}.quick-start-info.safe{grid-column:auto}.quick-start-actions{flex-direction:column-reverse}.quick-start-actions button{width:100%}}
        `;
        document.head.appendChild(style);
    }

    function openModal(status) {
        if (document.getElementById(MODAL_ID)) return;
        addStyles();
        const t = strings();
        const summary = status.bundle && status.bundle.summary || {};
        const values = {
            scripts: summary.scriptCount,
            categories: summary.scriptCategoryCount,
            targets: summary.targetCount,
            prefs: summary.preferenceCount,
            groups: summary.metricGroupCount,
            metricCategories: summary.metricCategoryCount
        };
        const modal = document.createElement('div');
        modal.id = MODAL_ID;
        modal.className = 'quick-start-overlay';
        modal.innerHTML = `
            <section class="quick-start-card" role="dialog" aria-modal="true" aria-labelledby="quickStartTitle">
                <header class="quick-start-head"><div class="quick-start-eyebrow">${t.eyebrow}</div><h2 id="quickStartTitle">${t.title}</h2><p>${t.intro}</p></header>
                <div class="quick-start-body">
                    <div class="quick-start-grid">
                        <article class="quick-start-info"><span class="icon">🚀</span><strong>${t.scriptsTitle}</strong><p>${interpolate(t.scriptsBody, values)}</p></article>
                        <article class="quick-start-info"><span class="icon">🎯</span><strong>${t.rulesTitle}</strong><p>${interpolate(t.rulesBody, values)}</p></article>
                        <article class="quick-start-info safe"><span class="icon">🛡️</span><strong>${t.safeTitle}</strong><p>${t.safeBody}</p></article>
                    </div>
                    <a class="quick-start-docs" href="${README_URL}" target="_blank" rel="noopener noreferrer">📖 ${t.docs} ↗</a>
                    <div class="quick-start-select-title">${t.selectHint}</div>
                    <div class="quick-start-options">
                        <label class="quick-start-option"><input type="checkbox" data-quick-start="scripts" checked><span>${t.scriptsOption}</span></label>
                        <label class="quick-start-option"><input type="checkbox" data-quick-start="rules" checked><span>${t.rulesOption}</span></label>
                    </div>
                    <div class="quick-start-actions"><button type="button" class="quick-start-skip">${t.skip}</button><button type="button" class="quick-start-import">${t.import}</button></div>
                    <div class="quick-start-result" aria-live="polite"></div>
                </div>
            </section>`;
        document.body.appendChild(modal);

        const buttons = [...modal.querySelectorAll('button')];
        const result = modal.querySelector('.quick-start-result');
        const setBusy = busy => buttons.forEach(button => { button.disabled = busy; });
        const showResult = (message, error = false) => {
            result.textContent = message;
            result.classList.toggle('error', error);
        };

        modal.querySelector('.quick-start-import').addEventListener('click', async () => {
            const importScripts = modal.querySelector('[data-quick-start="scripts"]').checked;
            const importMetricRules = modal.querySelector('[data-quick-start="rules"]').checked;
            if (!importScripts && !importMetricRules) return showResult(t.chooseOne, true);
            setBusy(true);
            showResult(t.importing);
            try {
                await API.post('/api/onboarding/defaults/decision', { action: 'import', importScripts, importMetricRules });
                showResult(t.success);
                setTimeout(() => window.location.reload(), 850);
            } catch (error) {
                showResult(`${t.failed}${error.message || ''}`, true);
                setBusy(false);
            }
        });

        modal.querySelector('.quick-start-skip').addEventListener('click', async () => {
            setBusy(true);
            showResult(t.skipping);
            try {
                await API.post('/api/onboarding/defaults/decision', { action: 'skip' });
                showResult(t.skipped);
                setTimeout(() => {
                    modal.remove();
                    if (typeof window.checkBuiltinToolsSync === 'function') window.checkBuiltinToolsSync();
                }, 650);
            } catch (error) {
                showResult(`${t.failed}${error.message || ''}`, true);
                setBusy(false);
            }
        });
    }

    async function check() {
        if (localStorage.getItem('tools_role') !== 'admin' || typeof API === 'undefined') return;
        try {
            const status = await API.get('/api/onboarding/defaults/status');
            if (status && status.required) openModal(status);
        } catch (error) {
            console.warn('[quick-start] 读取首次启动状态失败：', error.message);
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(check, 450), { once: true });
    else setTimeout(check, 450);
})();
