/**
 * uivf12/i18n.js - Page dictionary and helpers for the Data Capture page.
 */
(function () {
    const dictionaries = {
        'zh-CN': {
            'uiv.title': 'UIVF12 抓取引擎 v6.6 - Tools Platform',
            'uiv.description': 'UI.Vision 全能抓取引擎，自动化脚本工程中心，脚本云端仓库管理',
            'uiv.header.title': '🚀 自动化脚本工程中心',
            'uiv.version.loading': 'v加载中',
            'uiv.version.unmarked': 'v未标记',
            'uiv.version.title': '当前页面资源最新版本：{version}',
            'uiv.version.missing': '未检测到前端资源版本号',
            'uiv.header.tag': '多源融合 + Formula 权威版',
            'uiv.repo.title': '📂 智能调度仓库',
            'uiv.repo.copyAll': '全量打包',
            'uiv.repo.copyAllTitle': '拷贝仓库内所有分类的全部脚本',
            'uiv.repo.tip': '默认清爽折叠，<b>双击回填至工作台</b>。',
            'uiv.repo.mode': '仓库读源模式:',
            'uiv.source.auto': '自动模式',
            'uiv.source.json': 'JSON',
            'uiv.source.sqlite': '强制 SQLite',
            'uiv.source.script': '脚本来源: {source}',
            'uiv.source.category': '分类来源: {source}',
            'uiv.source.initialNote': '仓库加载后会在这里显示当前真实读源。',
            'uiv.source.currentNote': '当前模式: {mode} · 默认要求页面直接渲染当前真实读源，便于迁移期验证。',
            'uiv.repo.newCategory': '[+] 新建自定义分类',
            'uiv.repo.copyBatch': '📦 拷贝全部为批量阵列 (F12)',
            'uiv.repo.copyBatchUiv': '📦 拷贝全部为批量阵列 (UI.V)',
            'uiv.repo.runBatchUiv': '🚀 运行批脚本',
            'uiv.repo.batchSpeedTitle': '当前 {speed} 倍速：脚本间隔约 {seconds} 秒。点击切换 1x / 2x / 4x。',
            'uiv.repo.batchSpeedToast': 'UI.Vision 批量速度已切换为 {speed}x，脚本间隔约 {seconds} 秒',
            'uiv.repo.export': '📤 导出脚本',
            'uiv.repo.import': '📥 导入脚本',
            'uiv.input.urlLabel': '1. 请求 URL 目标地址:',
            'uiv.preset.datafab': '🟢 DataFab - 明细列表',
            'uiv.preset.netcareCn': '🔴 NetCare - 中国节点',
            'uiv.preset.netcareAe': '🔵 NetCare - 中东节点',
            'uiv.preset.netcareDe': '🟠 NetCare - 德国节点',
            'uiv.preset.custom': '⚙️ 自定义新地址...',
            'uiv.input.payloadLabel': '2. 请求负载 Payload (JSON):',
            'uiv.input.payloadHint': '粘贴后可点击格式化',
            'uiv.input.filePlaceholder': '文件名前缀 (例如：PBI_代表处数据)',
            'uiv.option.globalVars': '全局变量注入',
            'uiv.option.pagination': '循环翻页',
            'uiv.option.forceSum': '强制获取汇总数据-兜底',
            'uiv.option.cpc': '动态抓取 CPC / NID',
            'uiv.option.runtimeMonth': '开启[运行时:当月+上月]动态双重裂变',
            'uiv.option.netcareTriplicate': '🌍 保存侧边栏时自动生成 NetCare 三大区脚本阵列',
            'uiv.action.format': '🔍 格式化',
            'uiv.action.clear': '🗑️ 清空',
            'uiv.action.generate': '⚡ 一键生成生产级脚本',
            'uiv.output.uivLabel': '🤖 生产级 UI.Vision 宏代码:',
            'uiv.output.save': '💾 加入侧边栏',
            'uiv.output.copyUiv': '📋 复制 UIV',
            'uiv.output.uivPlaceholder': '生成后显示 UI.Vision 宏代码...',
            'uiv.output.consoleLabel': '💻 纯浏览器控制台执行脚本 (F12):',
            'uiv.output.copyConsole': '📋 复制 Console',
            'uiv.output.consolePlaceholder': '生成后显示纯浏览器 F12 直跑脚本...',
            'uiv.log.title': '📋 生成日志',
            'uiv.log.clear': '清空',
            'uiv.log.waiting': '等待生成...',
            'uiv.log.busy': '⏳ 生成中...',
            'uiv.log.ok': '✅ 生成成功',
            'uiv.log.err': '❌ 生成失败',
            'uiv.log.done': '脚本生成完毕！',
            'uiv.category.netcareCn': 'NetCare中国',
            'uiv.category.netcareAe': 'NetCare中东',
            'uiv.category.netcareDe': 'NetCare德国',
            'uiv.category.default': '默认分类',
            'uiv.category.empty': '（空）将脚本拖拽至此',
            'uiv.category.copyTitle': '仅打包提取此组脚本',
            'uiv.category.deleteTitle': '删除此分类',
            'uiv.script.itemTitle': '双击回填配置至工作台',
            'uiv.toast.serverFail': '❌ 无法连接服务器，脚本仓库加载失败',
            'uiv.toast.moveFail': '❌ 移动分类失败',
            'uiv.toast.filled': '✅ [{name}] 配置已回填！',
            'uiv.copy.consoleScript': '控制台脚本',
            'uiv.alert.legacyScript': '⚠️ 旧版脚本，请重新生成并覆盖保存。',
            'uiv.confirm.deleteScript': '确定删除 [{name}] 吗？',
            'uiv.toast.scriptDeleted': '✅ 脚本已删除',
            'uiv.toast.deleteFail': '❌ 删除失败',
            'uiv.prompt.newCategory': '请输入新分类名称：',
            'uiv.toast.categoryCreated': '✅ 分类已创建',
            'uiv.toast.createFail': '❌ 创建失败',
            'uiv.confirm.deleteCategory': '确定要删除分类 [{name}] 吗？\n注意：该分类下的所有脚本也会被一并删除！',
            'uiv.toast.categoryDeleted': '✅ 分类已删除',
            'uiv.alert.emptyExport': '⚠️ 当前脚本仓库为空，没有可导出的脚本！',
            'uiv.export.filename': 'UIVision_脚本仓库_{date}.json',
            'uiv.toast.exported': '✅ 脚本和自定义分类已导出！',
            'uiv.toast.exportFail': '❌ 导出失败',
            'uiv.alert.invalidBackup': '❌ 无效的脚本导入文件',
            'uiv.confirm.importMode': '📦 已读取脚本文件！\n\n点击【确定】融合（保留现有脚本，同名脚本用导入版替换）\n点击【取消】覆盖（清空现有脚本仓库，完全替换）',
            'uiv.toast.imported': '✅ 脚本和自定义分类已导入！',
            'uiv.alert.importFail': '❌ 导入失败：脚本文件解析出错。',
            'uiv.copy.noCode': '⚠️ 没有可复制的代码！',
            'uiv.copy.successButton': '✅ 成功',
            'uiv.copy.toast': '✅ {type} 已复制到剪贴板！',
            'uiv.copy.memoryToast': '✅ [{type}] 复制成功！',
            'uiv.copy.allGroup': '全量总仓库',
            'uiv.copy.fetchFail': '❌ 无法获取脚本列表',
            'uiv.copy.emptyGroup': '⚠️ 当前分类下没有可执行的脚本！',
            'uiv.copy.batchType': '[{group}] 批量阵列 (F12)',
            'uiv.copy.batchTypeUiv': '[{group}] 批量阵列 (UI.V)',
            'uiv.copy.noUivBatch': '⚠️ 当前仓库没有可打包的 UI.Vision 脚本，请重新生成并保存脚本。',
            'uiv.workbench.badJson': 'JSON 格式不合法，请检查标点或括号是否匹配。',
            'uiv.save.needGenerate': '⚠️ 请先生成脚本后再保存！',
            'uiv.save.defaultFile': 'PBI_自动抓取',
            'uiv.save.conflictMany': '发现 {count} 个同名脚本（含裂变分发区域），是否一键覆盖更新？',
            'uiv.save.conflictOne': '已存在名为 [{name}] 的脚本，是否覆盖更新？',
            'uiv.save.toastTriplicate': '✅ {count} 个脚本已分发至三大区！',
            'uiv.save.toastSaved': '✅ 脚本已保存至仓库！',
            'uiv.save.btnTriplicate': '✅ 阵列已分发',
            'uiv.save.btnSaved': '✅ 已保存',
            'uiv.save.noCompression': '❌ 保存失败，且当前浏览器不支持压缩重试',
            'uiv.save.retryTriplicate': '✅ {count} 个脚本已通过压缩重试保存！',
            'uiv.save.retrySaved': '✅ 脚本已通过压缩重试保存！',
            'uiv.save.retryFail': '❌ 保存失败，压缩重试也未成功',
            'uiv.generator.needPayload': '请先提供有效的 Payload JSON！',
            'uiv.generator.needPayloadLog': 'Payload 为空，请先格式化输入',
            'uiv.generator.engineStart': '引擎启动 · UIVF12 {version}',
            'uiv.generator.targetPlatform': '目标平台: {platform}  |  URL: {url}',
            'uiv.generator.payloadSection': 'Payload 解析',
            'uiv.generator.netcareSummary': 'NetCare 模式：已自动注入 need_summary=true',
            'uiv.generator.detectedPlaceholder': '✅ 检测到，已转为动态占位符',
            'uiv.generator.notDetected': '未检测到',
            'uiv.generator.cpcPoint': 'CPC 嵌入点: {state}',
            'uiv.generator.nidPoint': 'NID 嵌入点: {state}',
            'uiv.generator.monthSplit': '月份裂变: {state}',
            'uiv.generator.monthEnabled': '✅ 已开启 [{mode}]',
            'uiv.generator.monthDual': '当月 + 上月双跨度运行',
            'uiv.generator.monthSingle': '单期模式',
            'uiv.generator.off': '关闭',
            'uiv.generator.paramsSection': '参数提取',
            'uiv.generator.notFound': '(未找到)',
            'uiv.generator.missingPageId': '⚠️ 警告：缺少 pageId！已生成自动嗅探代码。',
            'uiv.generator.outputFile': '输出文件名: {name}',
            'uiv.generator.switchSection': '开关配置检查',
            'uiv.generator.on': '开启',
            'uiv.generator.offStatic': '关闭 — 使用静态占位符',
            'uiv.generator.offFirstPage': '关闭 — 仅报文第一页',
            'uiv.generator.onMissingComp': '开启（但 compId 缺失，可能失效）',
            'uiv.generator.onMonthRange': '开启（当月 + 上月）',
            'uiv.generator.globalVars': '全局变量注入: {state}',
            'uiv.generator.pagination': '循环翻页: {state}',
            'uiv.generator.forceSum': '独立大盘兜底: {state}',
            'uiv.generator.runtimeMonth': '运行时月份裂变: {state}',
            'uiv.generator.buildSection': '脚本构建',
            'uiv.generator.scriptTitle': '脚本标题: {title}',
            'uiv.generator.auth': '平台认证: {auth}',
            'uiv.generator.cookieAuth': 'CSRF-Token (Cookie 自动提取)',
            'uiv.generator.localAuth': '本地存储 globalConfig CSRF',
            'uiv.generator.outputReady': '脚本内容已写入输出区！UIV + F12 Console 双版均就绪'
        },
        'en-US': {
            'uiv.title': 'UIVF12 Data Capture Engine v6.6 - Tools Platform',
            'uiv.description': 'UI.Vision capture engine, automation script center, and cloud script repository.',
            'uiv.header.title': '🚀 Automation Script Center',
            'uiv.version.loading': 'v loading',
            'uiv.version.unmarked': 'v unmarked',
            'uiv.version.title': 'Latest frontend asset version: {version}',
            'uiv.version.missing': 'No frontend asset version detected',
            'uiv.header.tag': 'Multi-source Fusion + Formula Authority',
            'uiv.repo.title': '📂 Smart Repository',
            'uiv.repo.copyAll': 'Package All',
            'uiv.repo.copyAllTitle': 'Copy all scripts from every repository category',
            'uiv.repo.tip': 'Collapsed by default. <b>Double-click to refill the workbench</b>.',
            'uiv.repo.mode': 'Repository source mode:',
            'uiv.source.auto': 'Auto Mode',
            'uiv.source.json': 'JSON',
            'uiv.source.sqlite': 'Force SQLite',
            'uiv.source.script': 'Script source: {source}',
            'uiv.source.category': 'Category source: {source}',
            'uiv.source.initialNote': 'The real read source appears here after the repository loads.',
            'uiv.source.currentNote': 'Current mode: {mode} · The page renders the active source directly for migration checks.',
            'uiv.repo.newCategory': '[+] New Custom Category',
            'uiv.repo.copyBatch': '📦 Copy All as Batch Array (F12)',
            'uiv.repo.copyBatchUiv': '📦 Copy All as Batch Array (UI.V)',
            'uiv.repo.runBatchUiv': '🚀 Run Batch',
            'uiv.repo.batchSpeedTitle': 'Current {speed}x speed: script interval is about {seconds}s. Click to switch 1x / 2x / 4x.',
            'uiv.repo.batchSpeedToast': 'UI.Vision batch speed switched to {speed}x, script interval about {seconds}s',
            'uiv.repo.export': '📤 Export Scripts',
            'uiv.repo.import': '📥 Import Scripts',
            'uiv.input.urlLabel': '1. Request URL target:',
            'uiv.preset.datafab': '🟢 DataFab - Detail List',
            'uiv.preset.netcareCn': '🔴 NetCare - China Node',
            'uiv.preset.netcareAe': '🔵 NetCare - Middle East Node',
            'uiv.preset.netcareDe': '🟠 NetCare - Germany Node',
            'uiv.preset.custom': '⚙️ Custom URL...',
            'uiv.input.payloadLabel': '2. Request Payload (JSON):',
            'uiv.input.payloadHint': 'Paste, then format when ready',
            'uiv.input.filePlaceholder': 'File prefix, for example: PBI_Office_Data',
            'uiv.option.globalVars': 'Inject global variables',
            'uiv.option.pagination': 'Loop pagination',
            'uiv.option.forceSum': 'Force summary fallback',
            'uiv.option.cpc': 'Dynamically fetch CPC / NID',
            'uiv.option.runtimeMonth': 'Enable runtime current + previous month split',
            'uiv.option.netcareTriplicate': '🌍 Auto-generate NetCare three-region script array when saving',
            'uiv.action.format': '🔍 Format',
            'uiv.action.clear': '🗑️ Clear',
            'uiv.action.generate': '⚡ Generate Production Script',
            'uiv.output.uivLabel': '🤖 Production UI.Vision macro:',
            'uiv.output.save': '💾 Add to Sidebar',
            'uiv.output.copyUiv': '📋 Copy UIV',
            'uiv.output.uivPlaceholder': 'Generated UI.Vision macro appears here...',
            'uiv.output.consoleLabel': '💻 Browser console script (F12):',
            'uiv.output.copyConsole': '📋 Copy Console',
            'uiv.output.consolePlaceholder': 'Generated browser F12 script appears here...',
            'uiv.log.title': '📋 Generation Log',
            'uiv.log.clear': 'Clear',
            'uiv.log.waiting': 'Waiting for generation...',
            'uiv.log.busy': '⏳ Generating...',
            'uiv.log.ok': '✅ Generated',
            'uiv.log.err': '❌ Failed',
            'uiv.log.done': 'Script generation complete!',
            'uiv.category.netcareCn': 'NetCare China',
            'uiv.category.netcareAe': 'NetCare Middle East',
            'uiv.category.netcareDe': 'NetCare Germany',
            'uiv.category.default': 'Default Category',
            'uiv.category.empty': '(Empty) Drag scripts here',
            'uiv.category.copyTitle': 'Package only this category',
            'uiv.category.deleteTitle': 'Delete this category',
            'uiv.script.itemTitle': 'Double-click to refill the workbench',
            'uiv.toast.serverFail': '❌ Cannot connect to the server; script repository failed to load',
            'uiv.toast.moveFail': '❌ Failed to move category',
            'uiv.toast.filled': '✅ [{name}] configuration refilled!',
            'uiv.copy.consoleScript': 'Console Script',
            'uiv.alert.legacyScript': '⚠️ Legacy script. Please regenerate and overwrite-save it.',
            'uiv.confirm.deleteScript': 'Delete [{name}]?',
            'uiv.toast.scriptDeleted': '✅ Script deleted',
            'uiv.toast.deleteFail': '❌ Delete failed',
            'uiv.prompt.newCategory': 'New category name:',
            'uiv.toast.categoryCreated': '✅ Category created',
            'uiv.toast.createFail': '❌ Create failed',
            'uiv.confirm.deleteCategory': 'Delete category [{name}]?\nAll scripts under this category will also be deleted.',
            'uiv.toast.categoryDeleted': '✅ Category deleted',
            'uiv.alert.emptyExport': '⚠️ The script repository is empty; there are no scripts to export.',
            'uiv.export.filename': 'UIVision_Script_Repository_{date}.json',
            'uiv.toast.exported': '✅ Scripts and custom categories exported!',
            'uiv.toast.exportFail': '❌ Export failed',
            'uiv.alert.invalidBackup': '❌ Invalid script import file',
            'uiv.confirm.importMode': '📦 Script file loaded!\n\nOK: merge and replace scripts with matching names\nCancel: clear and replace the current script repository',
            'uiv.toast.imported': '✅ Scripts and custom categories imported!',
            'uiv.alert.importFail': '❌ Import failed: script file parsing error.',
            'uiv.copy.noCode': '⚠️ There is no code to copy.',
            'uiv.copy.successButton': '✅ Done',
            'uiv.copy.toast': '✅ {type} copied to clipboard!',
            'uiv.copy.memoryToast': '✅ [{type}] copied!',
            'uiv.copy.allGroup': 'Full Repository',
            'uiv.copy.fetchFail': '❌ Unable to fetch script list',
            'uiv.copy.emptyGroup': '⚠️ This category has no executable scripts.',
            'uiv.copy.batchType': '[{group}] Batch Array (F12)',
            'uiv.copy.batchTypeUiv': '[{group}] Batch Array (UI.V)',
            'uiv.copy.noUivBatch': '⚠️ No packageable UI.Vision scripts in the repository. Regenerate and save scripts first.',
            'uiv.workbench.badJson': 'Invalid JSON. Check punctuation or bracket matching.',
            'uiv.save.needGenerate': '⚠️ Generate a script before saving.',
            'uiv.save.defaultFile': 'PBI_Auto_Capture',
            'uiv.save.conflictMany': '{count} scripts with the same name were found, including split regional copies. Overwrite all?',
            'uiv.save.conflictOne': 'A script named [{name}] already exists. Overwrite it?',
            'uiv.save.toastTriplicate': '✅ {count} scripts distributed to the three regions!',
            'uiv.save.toastSaved': '✅ Script saved to repository!',
            'uiv.save.btnTriplicate': '✅ Array Distributed',
            'uiv.save.btnSaved': '✅ Saved',
            'uiv.save.noCompression': '❌ Save failed, and this browser does not support compressed retry',
            'uiv.save.retryTriplicate': '✅ {count} scripts saved through compressed retry!',
            'uiv.save.retrySaved': '✅ Script saved through compressed retry!',
            'uiv.save.retryFail': '❌ Save failed; compressed retry also failed',
            'uiv.generator.needPayload': 'Provide a valid Payload JSON first.',
            'uiv.generator.needPayloadLog': 'Payload is empty. Format the input first.',
            'uiv.generator.engineStart': 'Engine start · UIVF12 {version}',
            'uiv.generator.targetPlatform': 'Target platform: {platform}  |  URL: {url}',
            'uiv.generator.payloadSection': 'Payload Parsing',
            'uiv.generator.netcareSummary': 'NetCare mode: injected need_summary=true',
            'uiv.generator.detectedPlaceholder': '✅ Detected and converted to a dynamic placeholder',
            'uiv.generator.notDetected': 'Not detected',
            'uiv.generator.cpcPoint': 'CPC insertion point: {state}',
            'uiv.generator.nidPoint': 'NID insertion point: {state}',
            'uiv.generator.monthSplit': 'Month split: {state}',
            'uiv.generator.monthEnabled': '✅ Enabled [{mode}]',
            'uiv.generator.monthDual': 'current + previous month dual-span run',
            'uiv.generator.monthSingle': 'single-period mode',
            'uiv.generator.off': 'Off',
            'uiv.generator.paramsSection': 'Parameter Extraction',
            'uiv.generator.notFound': '(not found)',
            'uiv.generator.missingPageId': '⚠️ Warning: pageId is missing. Auto-sniffing code was generated.',
            'uiv.generator.outputFile': 'Output file: {name}',
            'uiv.generator.switchSection': 'Switch Configuration Check',
            'uiv.generator.on': 'On',
            'uiv.generator.offStatic': 'Off — static placeholders',
            'uiv.generator.offFirstPage': 'Off — first response page only',
            'uiv.generator.onMissingComp': 'On, but compId is missing and it may fail',
            'uiv.generator.onMonthRange': 'On (current + previous month)',
            'uiv.generator.globalVars': 'Global variable injection: {state}',
            'uiv.generator.pagination': 'Pagination loop: {state}',
            'uiv.generator.forceSum': 'Independent summary fallback: {state}',
            'uiv.generator.runtimeMonth': 'Runtime month split: {state}',
            'uiv.generator.buildSection': 'Script Build',
            'uiv.generator.scriptTitle': 'Script title: {title}',
            'uiv.generator.auth': 'Platform auth: {auth}',
            'uiv.generator.cookieAuth': 'CSRF-Token (auto from cookie)',
            'uiv.generator.localAuth': 'localStorage globalConfig CSRF',
            'uiv.generator.outputReady': 'Script content written to output areas. UIV + F12 Console are ready.'
        }
    };

    function t(key, params = {}) {
        return window.ToolsI18n ? window.ToolsI18n.t(key, params) : key;
    }

    function setText(selector, value) {
        const el = document.querySelector(selector);
        if (el) el.textContent = value;
    }

    function setHtml(selector, value) {
        const el = document.querySelector(selector);
        if (el) el.innerHTML = value;
    }

    function setPlaceholder(selector, value) {
        const el = document.querySelector(selector);
        if (el) el.placeholder = value;
    }

    function setTitle(selector, value) {
        const el = document.querySelector(selector);
        if (el) el.title = value;
    }

    function categoryLabel(category) {
        const map = {
            'NetCare中国': 'uiv.category.netcareCn',
            'NetCare中东': 'uiv.category.netcareAe',
            'NetCare德国': 'uiv.category.netcareDe',
            '默认分类': 'uiv.category.default'
        };
        return map[category] ? t(map[category]) : category;
    }

    function sourceLabel(source) {
        if (source === 'sqlite') return 'SQLite';
        if (source === 'json') return 'JSON';
        if (source === 'auto') return t('uiv.source.auto');
        return source || '-';
    }

    function applyPage() {
        document.title = t('uiv.title');
        const desc = document.querySelector('meta[name="description"]');
        if (desc) desc.setAttribute('content', t('uiv.description'));

        const titleWrap = document.querySelector('.uiv-title > span:first-child');
        const versionEl = document.getElementById('uivFrontendVersion');
        if (titleWrap) {
            titleWrap.textContent = t('uiv.header.title') + ' ';
            if (versionEl) titleWrap.appendChild(versionEl);
        }
        setText('.uiv-title .tag', t('uiv.header.tag'));
        const repoTitle = document.querySelector('.sidebar h2');
        const copyBtn = repoTitle?.querySelector('.cat-copy-btn');
        if (repoTitle) repoTitle.textContent = t('uiv.repo.title') + ' ';
        if (copyBtn) {
            copyBtn.textContent = t('uiv.repo.copyAll');
            copyBtn.title = t('uiv.repo.copyAllTitle');
            repoTitle?.appendChild(copyBtn);
        }
        setHtml('.sidebar h2 + div', t('uiv.repo.tip'));
        setText('.repo-source-controls .repo-source-note', t('uiv.repo.mode'));
        setText('#repoSourceMode option[value="auto"]', t('uiv.source.auto'));
        setText('#repoSourceMode option[value="sqlite"]', t('uiv.source.sqlite'));
        const sourcePanel = document.getElementById('repoSourcePanel');
        if (sourcePanel && !sourcePanel.dataset.loaded) {
            sourcePanel.innerHTML = `
                <span class="repo-source-badge">${t('uiv.source.script', { source: '-' })}</span>
                <span class="repo-source-badge">${t('uiv.source.category', { source: '-' })}</span>
                <span class="repo-source-note">${t('uiv.source.initialNote')}</span>
            `;
        }
        setText('.btn-add-cat', t('uiv.repo.newCategory'));
        setText('.btn-batch-pkg:not(.btn-batch-uiv):not(.btn-batch-uiv-run)', t('uiv.repo.copyBatch'));
        setText('.btn-batch-uiv', t('uiv.repo.copyBatchUiv'));
        setText('.btn-batch-uiv-run', t('uiv.repo.runBatchUiv'));
        if (window.UIVCopy && typeof window.UIVCopy.updateUivBatchSpeedButton === 'function') {
            window.UIVCopy.updateUivBatchSpeedButton();
        }
        setText('.btn-io[onclick="UIVSidebar.exportBackup()"]', t('uiv.repo.export'));
        const importLabel = document.querySelector('label.btn-io');
        if (importLabel) {
            const input = importLabel.querySelector('input');
            importLabel.textContent = t('uiv.repo.import') + ' ';
            if (input) importLabel.appendChild(input);
        }

        const panelLabels = document.querySelectorAll('.left-panel > .panel-label');
        if (panelLabels[0]) panelLabels[0].textContent = t('uiv.input.urlLabel');
        if (panelLabels[1]) {
            const hint = panelLabels[1].querySelector('span') || document.createElement('span');
            panelLabels[1].textContent = t('uiv.input.payloadLabel');
            hint.style.cssText = 'font-size:12px; color:#888; font-weight:normal;';
            hint.textContent = t('uiv.input.payloadHint');
            panelLabels[1].appendChild(hint);
        }
        setText('#urlPreset option:nth-child(1)', t('uiv.preset.datafab'));
        setText('#urlPreset option:nth-child(2)', t('uiv.preset.netcareCn'));
        setText('#urlPreset option:nth-child(3)', t('uiv.preset.netcareAe'));
        setText('#urlPreset option:nth-child(4)', t('uiv.preset.netcareDe'));
        setText('#urlPreset option:nth-child(5)', t('uiv.preset.custom'));
        setPlaceholder('#fileName', t('uiv.input.filePlaceholder'));

        const optionLabels = document.querySelectorAll('.controls label');
        [
            'uiv.option.globalVars',
            'uiv.option.pagination',
            'uiv.option.forceSum',
            'uiv.option.cpc',
            'uiv.option.runtimeMonth',
            'uiv.option.netcareTriplicate'
        ].forEach((key, index) => {
            const label = optionLabels[index];
            const input = label?.querySelector('input');
            if (!label || !input) return;
            label.textContent = ' ' + t(key);
            label.prepend(input);
        });

        const actionButtons = document.querySelectorAll('.left-panel .btn-group .btn');
        if (actionButtons[0]) actionButtons[0].textContent = t('uiv.action.format');
        if (actionButtons[1]) actionButtons[1].textContent = t('uiv.action.clear');
        if (actionButtons[2]) actionButtons[2].textContent = t('uiv.action.generate');
        setText('.right-panel .output-label', t('uiv.output.uivLabel'));
        setText('#saveBtn', t('uiv.output.save'));
        setText('#btnCopyUIV', t('uiv.output.copyUiv'));
        setPlaceholder('#codeOutput', t('uiv.output.uivPlaceholder'));
        setText('.right-panel .console-label', t('uiv.output.consoleLabel'));
        setText('#btnCopyConsole', t('uiv.output.copyConsole'));
        setPlaceholder('#consoleOutput', t('uiv.output.consolePlaceholder'));
        const logTitle = document.querySelector('.gen-log-title');
        const logIcon = document.getElementById('genLogIcon');
        const logBadge = document.getElementById('genLogBadge');
        if (logTitle) {
            logTitle.textContent = '';
            if (logIcon) logTitle.appendChild(logIcon);
            logTitle.appendChild(document.createTextNode(' ' + t('uiv.log.title') + ' '));
            if (logBadge) logTitle.appendChild(logBadge);
        }
        setText('.gen-log-clear', t('uiv.log.clear'));
    }

    if (window.ToolsI18n) {
        window.ToolsI18n.register('uivf12', dictionaries);
    }

    window.UIVI18n = {
        t,
        applyPage,
        categoryLabel,
        sourceLabel,
        waitingMarkup: () => `<span style="color:#555; font-size:12px;">${t('uiv.log.waiting')}</span>`
    };
    window.UIVT = t;

    window.addEventListener('tools:languagechange', () => {
        applyPage();
        if (window.UIVSidebar?.refreshI18n) window.UIVSidebar.refreshI18n();
        if (window.UIVGenLog?.refreshI18n) window.UIVGenLog.refreshI18n();
    });
})();
