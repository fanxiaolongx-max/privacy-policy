/**
 * shared/navbar.js - 统一导航栏组件
 * 支持固定工具、自定义工具、二级分类与全局顺序设置。
 */
const NAV_BUILTIN_LINKS = [
    { id: 'home', href: '/', icon: '🏠', label: '工具中台', labelKey: 'nav.home', defaultCategory: 'business', match: p => p === '/' },
    { id: 'uivf12', href: '/uivf12', icon: '🚀', label: '数据抓取', labelKey: 'nav.uivf12', defaultCategory: 'business', match: p => p.startsWith('/uivf12') },
    { id: 'sla', href: '/sla', icon: '📊', label: '数据导入', labelKey: 'nav.sla', defaultCategory: 'business', match: p => p.startsWith('/sla') },
    { id: 'report', href: '/report', icon: '📈', label: '报表看板', labelKey: 'nav.report', defaultCategory: 'business', match: p => p.startsWith('/report') },
    { id: 'expedite', href: '/expedite', icon: '⚡', label: '一键催办', labelKey: 'nav.expedite', defaultCategory: 'business', match: p => p.startsWith('/expedite') },
    { id: 'monthly', href: '/monthly', icon: '📅', label: '月报页面', labelKey: 'nav.monthly', defaultCategory: 'business', match: p => p.startsWith('/monthly') },
    { id: 'bigscreen', href: '/bigscreen', icon: '🖥️', label: '大屏看板', labelKey: 'nav.bigscreen', defaultCategory: 'business', match: p => p.startsWith('/bigscreen') },
    { id: 'frt', href: '/frt', icon: '📊', label: 'FRT核算', labelKey: 'nav.frt', defaultCategory: 'audit', match: p => p.startsWith('/frt') },
    { id: 'praudit', href: '/praudit', icon: '📋', label: 'PR稽查', labelKey: 'nav.praudit', defaultCategory: 'audit', match: p => p.startsWith('/praudit') },
    { id: 'storage', href: '/storage', icon: '💽', label: '迁移状态', labelKey: 'nav.storage', defaultCategory: 'system', match: p => p.startsWith('/storage') },
    { id: 'db-explorer', href: '/db-explorer', icon: '🗄️', label: '数据探索', labelKey: 'nav.dbExplorer', defaultCategory: 'system', match: p => p.startsWith('/db-explorer') }
];

const NAV_DEFAULT_SETTINGS = {
    primaryIds: ['home', 'uivf12', 'sla', 'report', 'expedite', 'monthly', 'bigscreen'],
    categories: [
        { id: 'business', name: '业务工具', nameEn: 'Business Tools', nameKey: 'nav.category.business' },
        { id: 'audit', name: '审计与核算', nameEn: 'Audit & KPI', nameKey: 'nav.category.audit' },
        { id: 'system', name: '系统治理', nameEn: 'System Governance', nameKey: 'nav.category.system' },
        { id: 'custom', name: '自定义工具', nameEn: 'Custom Tools', nameKey: 'nav.category.custom' }
    ],
    categoryByItem: { frt: 'audit', praudit: 'audit', storage: 'system', 'db-explorer': 'system' },
    itemOrder: ['frt', 'praudit', 'storage', 'db-explorer']
};

let navState = {
    settings: JSON.parse(JSON.stringify(NAV_DEFAULT_SETTINGS)),
    customTools: [],
    currentPrimaryItems: [],
    settingsTab: 'primary',
    saveTimer: null,
    aiSettings: null,
    aiSaveTimer: null,
    securitySettings: null,
    securityLocks: [],
    securitySaveTimer: null,
    remoteBackupSettings: null,
    remoteBackupSaveTimer: null,
    scheduleBackupSettings: null,
    scheduleBackupSaveTimer: null,
    updaterStatus: null,
    updaterVersion: null,
    updaterUnsubscribe: null,
    alertCenter: {
        events: [],
        summary: null,
        filter: 'all',
        loading: false
    }
};

function navT(key, params) {
    return window.ToolsI18n ? window.ToolsI18n.t(key, params) : key;
}

function getNavLabel(item) {
    return item.labelKey && window.ToolsI18n ? navT(item.labelKey) : item.label;
}

function getNavCategoryName(cat) {
    if (!window.ToolsI18n) return cat.name;
    const lang = window.ToolsI18n.getLanguage();
    if (cat.nameKey) return navT(cat.nameKey);
    const inferredKey = `nav.category.${cat.id}`;
    const inferred = navT(inferredKey);
    if (inferred !== inferredKey) return inferred;
    if (lang === 'en-US' && cat.nameEn) return cat.nameEn;
    return cat.name;
}

function registerNavbarI18n() {
    if (!window.ToolsI18n) return;
    window.ToolsI18n.register('navbar', {
        'zh-CN': {
            'nav.home': '工具中台',
            'nav.uivf12': '数据抓取',
            'nav.sla': '数据导入',
            'nav.report': '报表看板',
            'nav.expedite': '一键催办',
            'nav.monthly': '月报页面',
            'nav.bigscreen': '大屏看板',
            'nav.frt': 'FRT核算',
            'nav.praudit': 'PR稽查',
            'nav.storage': '迁移状态',
            'nav.dbExplorer': '数据探索',
            'nav.more': '更多工具',
            'nav.requirements': '需求',
            'nav.alertCenter': '告警台',
            'nav.alertCenterTitle': '打开系统告警台',
            'nav.settings': '全局导航设置',
            'nav.userPrefix': '👤 {user}',
            'nav.logout': '退出',
            'nav.online': '服务在线',
            'nav.offline': '离线',
            'nav.language': '语言',
            'nav.languageTitle': '切换语言',
            'nav.category.business': '业务工具',
            'nav.category.audit': '审计与核算',
            'nav.category.system': '系统治理',
            'nav.category.custom': '自定义工具',
            'nav.uncategorized': '未分类',
            'nav.empty': '暂无更多工具',
            'nav.customTool': '自定义工具',
            'nav.set.title': '全局设置',
            'nav.set.tab.primary': '顶部菜单',
            'nav.set.tab.categories': '二级分类',
            'nav.set.tab.items': '分类与顺序',
            'nav.set.tab.ai': 'AI 助手',
            'nav.set.tab.update': '程序更新',
            'nav.set.tab.backup': '备份恢复',
            'nav.set.tab.accounts': '账号管理',
            'nav.set.tab.security': '安全策略',
            'nav.set.tab.pages': '页面配置',
            'nav.set.saved': '已自动保存',
            'nav.set.saving': '正在自动保存...',
            'nav.set.saveFail': '保存失败: ',
            'nav.set.loaded': '已加载',
            'nav.set.pageConfig': '{page}配置',
            'nav.set.sub.primary': '修改后会自动保存，并立即影响顶部导航。',
            'nav.set.sub.categories': '修改后会自动保存，并立即影响“更多工具”的分类展示。',
            'nav.set.sub.items': '修改后会自动保存，并立即影响“更多工具”的分组与排序。',
            'nav.set.sub.ai': '修改后会自动保存，并立即影响智能客服助手配置。',
            'nav.set.sub.update': '检查、下载并安装桌面客户端更新。',
            'nav.set.sub.backup': '备份和恢复会覆盖全局配置、数据库、上传附件与自定义工具数据。',
            'nav.set.sub.accounts': '修改后会自动保存，并立即影响账号权限。',
            'nav.set.sub.security': '配置登录失败锁定、会话过期和安全告警策略。',
            'nav.set.sub.report': '报表看板相关维护能力，当前支持历史快照冗余清理。',
            'nav.set.sub.pageFallback': '该页面的配置预留位，后续可把页面内相关设置迁移到这里统一管理。',
            'nav.set.help.primary': '勾选后显示在顶部 bar；未勾选的菜单会进入“更多工具”。使用上下按钮调整顶部显示顺序。',
            'nav.set.help.categories': '分类会显示在“更多工具”下拉菜单中。配置英文名称后，系统会在英文模式下自动应用。',
            'nav.set.help.items': '这里管理“更多工具”里的二级分类和分类内顺序。顶部直显菜单不会出现在此列表中。',
            'nav.set.btn.up': '上移',
            'nav.set.btn.down': '下移',
            'nav.set.btn.delete': '删除',
            'nav.set.btn.addCategory': '新增分类',
            'nav.set.emptyItems': '暂无更多工具菜单。',
            'nav.set.placeholder.zh': '中文名称',
            'nav.set.placeholder.en': 'English Name',
            'nav.set.newCategory': '新分类',

            'nav.page.placeholderTitle': '{page}配置预留位',
            'nav.page.placeholderDesc': '当前暂无需要迁移到全局设置的配置项。后续如果该页面新增全局级设置，可以直接放在这里。',
            'nav.page.home.help': '逐个控制自定义 HTML 工具的新窗口直达地址是否需要登录。默认关闭公开访问；开启后，任何获得链接的人都可以访问该工具及其静态资源。',
            'nav.page.home.title': '自定义 HTML 访问鉴权',
            'nav.page.home.public': '允许免登录新窗口访问',
            'nav.page.home.private': '需要登录',
            'nav.page.home.empty': '暂无自定义 HTML 工具。',
            'nav.page.report.help': '清理“历史快照 (Snapshot)”中最近 X 天内的同日冗余快照，仅保留每天最新一份。较早日期和每天最新快照都会保留，不影响月报、一键催办等按日读取最新快照的业务。',
            'nav.page.report.title': '历史快照冗余清理',
            'nav.page.report.desc': '建议先“预览影响”，确认要删除的数量后再执行清理。',
            'nav.page.report.cleanLast': '清理最近',
            'nav.page.report.days': '天内冗余快照',
            'nav.page.report.btnPreview': '预览影响',
            'nav.page.report.btnRun': '执行清理',
            'nav.page.report.wait': '等待预览。',
            'nav.page.report.res.preview': '预览结果',
            'nav.page.report.res.done': '清理完成',
            'nav.page.report.res.summary': '范围：最近 {days} 天；清理前 {beforeCount} 条，清理后 {afterCount} 条，预计/实际删除 {removedCount} 条。',
            'nav.page.report.res.kept': '保留的最近日期每日最新快照：{keptDailyCount} 天。',
            'nav.page.report.res.empty': '没有需要清理的冗余快照。',
            'nav.page.report.res.more': '仅展示前 8 条，剩余 {remaining} 条未展开。',

            'nav.ai.empty': '正在加载 AI 助手配置...',
            'nav.ai.help': '这里配置右下角智能客服助手及后台 AI 分析。支持 Gemini、OpenAI、Anthropic 和 OpenAI 兼容网关；Token 会保存到服务端，前端只显示脱敏状态。',
            'nav.ai.sourcePrefix': '当前 Token 来源：',
            'nav.ai.srcStored': '设置中心保存的 Token',
            'nav.ai.srcEnv': '供应商环境变量',
            'nav.ai.srcNone': '未配置',
            'nav.ai.keyNone': '尚未配置 Token',
            'nav.ai.keyInvalid': '格式疑似无效 ',
            'nav.ai.keyValid': '已配置 ',
            'nav.ai.lblToken': 'API Token',
            'nav.ai.plhToken': '点击后粘贴当前供应商 API Token',
            'nav.ai.plhKeep': '留空则保持当前：',
            'nav.ai.btnClear': '清除 Token',
            'nav.ai.btnTest': '测试模型',
            'nav.ai.testing': '正在测试模型...',
            'nav.ai.testOk': '测试通过',
            'nav.ai.testFail': '测试失败：',
            'nav.ai.lblProvider': '供应商协议',
            'nav.ai.lblApiUrl': 'API URL',
            'nav.ai.plhApiUrl': '留空使用供应商默认地址；兼容网关填 /v1 基地址',
            'nav.ai.lblModel': '模型名称',
            'nav.ai.lblMax': '最大输出 Tokens',
            'nav.ai.lblInputCost': '输入成本 USD / 1M Tokens',
            'nav.ai.lblOutputCost': '输出成本 USD / 1M Tokens',
            'nav.ai.lblUsdCny': '美元兑人民币',
            'nav.ai.lblPrompt': '补充系统提示词',
            'nav.ai.plhPrompt': '例如：回答优先使用中文，涉及平台操作时给出步骤。',
            'nav.ai.failLoad': '加载 AI 助手配置失败：',
            'nav.ai.saving': '正在保存 AI 设置...',
            'nav.ai.saved': 'AI 设置已自动保存',
            'nav.ai.waitSave': 'AI 设置待保存...',

            'nav.up.help': '更新来源为 GitHub Releases。下载完成后可立即重启安装，也可以稍后手动重启。',
            'nav.up.current': '当前版本',
            'nav.up.latest': '最新版本',
            'nav.up.packaged': '运行模式',
            'nav.up.packagedYes': '安装版',
            'nav.up.packagedNo': '开发模式',
            'nav.up.status': '更新状态',
            'nav.up.progress': '下载进度',
            'nav.up.btnCheck': '检查更新',
            'nav.up.btnDownload': '下载更新',
            'nav.up.btnInstall': '重启安装',
            'nav.up.unavailable': '网页端不直接执行程序更新。请在 Windows 托盘图标中选择“检查更新 / 下载更新 / 重启并安装更新”。',
            'nav.up.state.idle': '等待检查',
            'nav.up.state.checking': '检查中',
            'nav.up.state.available': '有可用更新',
            'nav.up.state.not-available': '已是最新',
            'nav.up.state.downloading': '下载中',
            'nav.up.state.downloaded': '已下载',
            'nav.up.state.installing': '安装中',
            'nav.up.state.error': '更新失败',
            'nav.up.state.dev-unavailable': '开发模式不可用',

            'nav.bk.empty': '正在加载备份列表...',
            'nav.bk.help': '覆盖范围：{target}。包含全局配置、JSON 数据、SQLite 数据库、上传附件、自定义工具 HTML 等运行数据。',
            'nav.bk.remoteTitle': '远端主站同步',
            'nav.bk.remoteDesc': '适合分站/Windows 本地启动时，从主站自动拉取最新全局备份并恢复。配置只保存在当前机器，不会被备份包覆盖。',
            'nav.bk.enable': '启用',
            'nav.bk.remoteDomain': '远端网站域名',
            'nav.bk.remoteUser': '账号',
            'nav.bk.remotePwd': '密码',
            'nav.bk.plhPwd': '填写远端登录密码',
            'nav.bk.optCompare': '比较备份新旧，未更新则跳过',
            'nav.bk.optPull': '拉取前请求主站立即生成备份',
            'nav.bk.optAuto': '启动时自动恢复最新备份',
            'nav.bk.scheduleTitle': '定时备份',
            'nav.bk.scheduleDesc': '默认每天凌晨 2 点自动生成服务器备份，并仅清理超过保留天数的自动备份。',
            'nav.bk.scheduleEnabled': '开启定时备份',
            'nav.bk.scheduleTime': '执行时间',
            'nav.bk.scheduleRetention': '保留天数',
            'nav.bk.scheduleDays': '天',
            'nav.bk.scheduleNext': '下次执行：',
            'nav.bk.scheduleLast': '最近成功：',
            'nav.bk.scheduleLastFile': '最近文件：',
            'nav.bk.scheduleError': '最近错误：',
            'nav.bk.scheduleNotRun': '尚未执行',
            'nav.bk.scheduleDisabled': '已关闭',
            'nav.bk.scheduleSaved': '定时备份设置已保存',
            'nav.bk.scheduleSaving': '正在保存定时备份设置...',
            'nav.bk.scheduleRun': '立即执行一次',
            'nav.bk.stLocal': '时间显示：浏览器本地时区（{tz}）',
            'nav.bk.stCheck': '最近检查：',
            'nav.bk.stSync': '最近恢复：',
            'nav.bk.stError': '最近错误：',
            'nav.bk.btnCheck': '测试连接/检查最新',
            'nav.bk.btnPull': '按规则拉取恢复',
            'nav.bk.btnForce': '强制恢复远端最新',
            'nav.bk.btnClearPwd': '清除密码',
            'nav.bk.svrTitle': '服务器备份',
            'nav.bk.svrDesc': '生成后会保存在服务器，也可以直接下载到本地留档。',
            'nav.bk.btnCreate': '生成服务器备份',
            'nav.bk.btnCreateDL': '生成并下载',
            'nav.bk.upTitle': '上传备份包恢复',
            'nav.bk.upDesc': '仅接受平台生成的全局备份 zip 包；恢复前会自动创建 pre-restore 安全备份。',
            'nav.bk.btnUp': '上传并恢复',
            'nav.bk.badgeSync': '外部同步触发',
            'nav.bk.badgeSafe': '恢复前安全备份',
            'nav.bk.badgeAuto': '定时备份',
            'nav.bk.fail': '加载备份列表失败：',
            'nav.bk.dlTitle': '下载备份',
            'nav.bk.rsTitle': '从该备份恢复',
            'nav.bk.delTitle': '永久删除此备份',
            'nav.bk.thFile': '备份文件',
            'nav.bk.thAction': '操作',
            'nav.bk.noData': '暂无服务器备份',

            'nav.acc.empty': '正在加载账号列表...',
            'nav.acc.admin': '超级管理',
            'nav.acc.readonly': '只读用户',
            'nav.acc.help': '账号权限用于控制平台写入类操作。新增或调整后立即生效。',
            'nav.acc.plhUser': '输入新用户名',
            'nav.acc.plhPwd': '设置密码',
            'nav.acc.btnAdd': '新增账号',
            'nav.acc.thUser': '账号名称',
            'nav.acc.thRole': '权限角色',
            'nav.acc.thAction': '快捷操作',
            'nav.acc.noData': '暂无账号',
            'nav.acc.fail': '加载账号失败：',
            'nav.acc.btnDel': '删除',
            'nav.acc.btnReset': '重置密码',

            'nav.sec.empty': '正在加载安全策略...',
            'nav.sec.help': '登录失败后会按账号、来源 IP、同一 IP 多账号尝试三类规则递进锁定；触发锁定时会按配置级别上报告警台。',
            'nav.sec.enabled': '启用登录失败递进锁定',
            'nav.sec.alertOnLock': '锁定时上报告警台',
            'nav.sec.sessionHours': '会话有效期（小时）',
            'nav.sec.accountPolicy': '账号锁定策略',
            'nav.sec.ipPolicy': 'IP 锁定策略',
            'nav.sec.multiPolicy': '同 IP 多账号策略',
            'nav.sec.thEnabled': '启用',
            'nav.sec.thCount': '失败次数/账号数',
            'nav.sec.thWindow': '统计窗口(分钟)',
            'nav.sec.thLock': '锁定(分钟)',
            'nav.sec.thSeverity': '告警级别',
            'nav.sec.locksTitle': '当前锁定',
            'nav.sec.btnRefresh': '刷新锁定',
            'nav.sec.btnUnlock': '解锁',
            'nav.sec.noLocks': '暂无账号或 IP 被锁定',
            'nav.sec.thType': '类型',
            'nav.sec.thTarget': '对象',
            'nav.sec.thReason': '原因',
            'nav.sec.thFailCount': '计数',
            'nav.sec.thUntil': '锁定到',
            'nav.sec.failLoad': '加载安全策略失败：',
            'nav.sec.saving': '正在保存安全策略...',
            'nav.sec.saved': '安全策略已自动保存',

            'nav.alert.title': '告警台',
            'nav.alert.subtitle': '集中查看系统告警、配置变化和用户关键行为。',
            'nav.alert.loading': '正在加载告警...',
            'nav.alert.empty': '暂无告警事件',
            'nav.alert.all': '全部',
            'nav.alert.unread': '未读',
            'nav.alert.warn': '风险以上',
            'nav.alert.config': '配置变化',
            'nav.alert.security': '安全',
            'nav.alert.userAction': '用户行为',
            'nav.alert.system': '系统',
            'nav.alert.summaryTotal': '事件',
            'nav.alert.summaryUnread': '未读',
            'nav.alert.summaryRisk': '风险',
            'nav.alert.markAll': '全部已读',
            'nav.alert.refresh': '刷新',
            'nav.alert.archive': '归档',
            'nav.alert.archiveAll': '全部归档',
            'nav.alert.archiveAllConfirm': '确定要将所有告警归档吗？',
            'nav.alert.read': '已读',
            'nav.alert.actor': '操作人',
            'nav.alert.source': '来源',
            'nav.alert.object': '对象',
            'nav.alert.failLoad': '告警加载失败：'
        },
        'en-US': {
            'nav.home': 'Home',
            'nav.uivf12': 'Data Capture',
            'nav.sla': 'Data Import',
            'nav.report': 'Reports',
            'nav.expedite': 'Expedite',
            'nav.monthly': 'Monthly',
            'nav.bigscreen': 'Big Screen',
            'nav.frt': 'FRT KPI',
            'nav.praudit': 'PR Audit',
            'nav.storage': 'Migration',
            'nav.dbExplorer': 'Data Explorer',
            'nav.more': 'More Tools',
            'nav.requirements': 'Requests',
            'nav.alertCenter': 'Alerts',
            'nav.alertCenterTitle': 'Open Alert Center',
            'nav.settings': 'Global navigation settings',
            'nav.userPrefix': '👤 {user}',
            'nav.logout': 'Logout',
            'nav.online': 'Online',
            'nav.offline': 'Offline',
            'nav.language': 'Language',
            'nav.languageTitle': 'Switch language',
            'nav.category.business': 'Business Tools',
            'nav.category.audit': 'Audit & KPI',
            'nav.category.system': 'System Governance',
            'nav.category.custom': 'Custom Tools',
            'nav.uncategorized': 'Uncategorized',
            'nav.empty': 'No more tools',
            'nav.customTool': 'Custom Tool',
            'nav.set.title': 'Global Settings',
            'nav.set.tab.primary': 'Top Menu',
            'nav.set.tab.categories': 'Categories',
            'nav.set.tab.items': 'Items & Order',
            'nav.set.tab.ai': 'AI Assistant',
            'nav.set.tab.update': 'App Updates',
            'nav.set.tab.backup': 'Backup & Restore',
            'nav.set.tab.accounts': 'Accounts',
            'nav.set.tab.security': 'Security',
            'nav.set.tab.pages': 'Page Settings',
            'nav.set.saved': 'Saved automatically',
            'nav.set.saving': 'Saving automatically...',
            'nav.set.saveFail': 'Save failed: ',
            'nav.set.loaded': 'Loaded',
            'nav.set.pageConfig': '{page} Config',
            'nav.set.sub.primary': 'Changes are saved automatically and immediately applied to the top navigation.',
            'nav.set.sub.categories': 'Changes are saved automatically and immediately applied to the category display in "More Tools".',
            'nav.set.sub.items': 'Changes are saved automatically and immediately applied to the grouping and ordering in "More Tools".',
            'nav.set.sub.ai': 'Changes are saved automatically and immediately applied to the AI Assistant configuration.',
            'nav.set.sub.update': 'Check, download, and install desktop client updates.',
            'nav.set.sub.backup': 'Backup and restore will overwrite global configuration, database, uploaded files, and custom tools data.',
            'nav.set.sub.accounts': 'Changes are saved automatically and immediately applied to account permissions.',
            'nav.set.sub.security': 'Configure login lockouts, session expiry, and security alert severity.',
            'nav.set.sub.report': 'Report dashboard maintenance. Currently supports historical snapshot cleanup.',
            'nav.set.sub.pageFallback': "Placeholder for this page's configuration. Future page settings can be managed here.",
            'nav.set.help.primary': 'Checked items appear in the top bar; unchecked items move to "More Tools". Use up/down buttons to reorder.',
            'nav.set.help.categories': 'Categories are displayed in the "More Tools" dropdown. English names will apply automatically in English mode.',
            'nav.set.help.items': 'Manage sub-categories and their ordering in "More Tools". Direct top menu items do not appear here.',
            'nav.set.btn.up': 'Up',
            'nav.set.btn.down': 'Down',
            'nav.set.btn.delete': 'Delete',
            'nav.set.btn.addCategory': 'Add Category',
            'nav.set.emptyItems': 'No more tools available.',
            'nav.set.placeholder.zh': 'Chinese Name',
            'nav.set.placeholder.en': 'English Name',
            'nav.set.newCategory': 'New Category',

            'nav.page.placeholderTitle': '{page} Configuration Placeholder',
            'nav.page.placeholderDesc': 'There are currently no configuration items to migrate to global settings. Future global settings for this page will be placed here.',
            'nav.page.home.help': 'Control whether each custom HTML tool can be opened in a new window without signing in. Public access is off by default; when enabled, anyone with the link can access the tool and its static assets.',
            'nav.page.home.title': 'Custom HTML Access Control',
            'nav.page.home.public': 'Allow public new-window access',
            'nav.page.home.private': 'Sign-in required',
            'nav.page.home.empty': 'No custom HTML tools yet.',
            'nav.page.report.help': 'Clean up redundant same-day historical snapshots from the last X days, keeping only the latest snapshot per day. Older dates and daily latest snapshots are retained to ensure daily-read business metrics are unaffected.',
            'nav.page.report.title': 'Redundant Historical Snapshot Cleanup',
            'nav.page.report.desc': 'We recommend "Previewing Impact" to confirm the deletion count before executing cleanup.',
            'nav.page.report.cleanLast': 'Clean up the last',
            'nav.page.report.days': 'days of redundant snapshots',
            'nav.page.report.btnPreview': 'Preview Impact',
            'nav.page.report.btnRun': 'Execute Cleanup',
            'nav.page.report.wait': 'Waiting for preview.',
            'nav.page.report.res.preview': 'Preview Result',
            'nav.page.report.res.done': 'Cleanup Complete',
            'nav.page.report.res.summary': 'Scope: last {days} days; Before: {beforeCount}, After: {afterCount}, Removed (est./actual): {removedCount}.',
            'nav.page.report.res.kept': 'Retained daily latest snapshots for recent dates: {keptDailyCount} days.',
            'nav.page.report.res.empty': 'No redundant snapshots to clean up.',
            'nav.page.report.res.more': 'Only showing the first 8 items, {remaining} items hidden.',

            'nav.ai.empty': 'Loading AI configuration...',
            'nav.ai.help': 'Configure the AI Assistant and background AI analysis. Supports Gemini, OpenAI, Anthropic, and OpenAI-compatible gateways. The token is stored on the server and masked in the UI.',
            'nav.ai.sourcePrefix': 'Current Token Source: ',
            'nav.ai.srcStored': 'Stored in Settings',
            'nav.ai.srcEnv': 'Provider Environment Variable',
            'nav.ai.srcNone': 'Not Configured',
            'nav.ai.keyNone': 'No Token Configured',
            'nav.ai.keyInvalid': 'Format seems invalid ',
            'nav.ai.keyValid': 'Configured ',
            'nav.ai.lblToken': 'API Token',
            'nav.ai.plhToken': 'Click to paste the current provider API token',
            'nav.ai.plhKeep': 'Leave empty to keep current: ',
            'nav.ai.btnClear': 'Clear Token',
            'nav.ai.btnTest': 'Test Model',
            'nav.ai.testing': 'Testing model...',
            'nav.ai.testOk': 'Test passed',
            'nav.ai.testFail': 'Test failed: ',
            'nav.ai.lblProvider': 'Provider Protocol',
            'nav.ai.lblApiUrl': 'API URL',
            'nav.ai.plhApiUrl': 'Leave empty for provider default; compatible gateways should use the /v1 base URL',
            'nav.ai.lblModel': 'Model Name',
            'nav.ai.lblMax': 'Max Output Tokens',
            'nav.ai.lblInputCost': 'Input Cost (USD / 1M)',
            'nav.ai.lblOutputCost': 'Output Cost (USD / 1M)',
            'nav.ai.lblUsdCny': 'USD to CNY Exchange Rate',
            'nav.ai.lblPrompt': 'Supplemental System Prompt',
            'nav.ai.plhPrompt': 'e.g. Please respond in English and provide step-by-step instructions.',
            'nav.ai.failLoad': 'Failed to load AI configuration: ',
            'nav.ai.saving': 'Saving AI settings...',
            'nav.ai.saved': 'AI settings saved automatically',
            'nav.ai.waitSave': 'AI settings waiting to save...',

            'nav.up.help': 'Updates are delivered from GitHub Releases. After download, restart now to install or restart later manually.',
            'nav.up.current': 'Current Version',
            'nav.up.latest': 'Latest Version',
            'nav.up.packaged': 'Runtime',
            'nav.up.packagedYes': 'Installed App',
            'nav.up.packagedNo': 'Development Mode',
            'nav.up.status': 'Status',
            'nav.up.progress': 'Download Progress',
            'nav.up.btnCheck': 'Check for Updates',
            'nav.up.btnDownload': 'Download Update',
            'nav.up.btnInstall': 'Restart & Install',
            'nav.up.unavailable': 'Program updates are managed from the Windows tray icon. Use “Check update / Download update / Restart and install” there.',
            'nav.up.state.idle': 'Waiting',
            'nav.up.state.checking': 'Checking',
            'nav.up.state.available': 'Update Available',
            'nav.up.state.not-available': 'Up to Date',
            'nav.up.state.downloading': 'Downloading',
            'nav.up.state.downloaded': 'Downloaded',
            'nav.up.state.installing': 'Installing',
            'nav.up.state.error': 'Update Failed',
            'nav.up.state.dev-unavailable': 'Unavailable in Development',

            'nav.bk.empty': 'Loading backup list...',
            'nav.bk.help': 'Scope: {target}. Includes global configuration, JSON data, SQLite databases, uploaded files, and custom tool HTML.',
            'nav.bk.remoteTitle': 'Remote Main Site Sync',
            'nav.bk.remoteDesc': 'Suitable for local branch syncs from the main site. Settings are saved locally and not overwritten by backups.',
            'nav.bk.enable': 'Enable',
            'nav.bk.remoteDomain': 'Remote Domain',
            'nav.bk.remoteUser': 'Username',
            'nav.bk.remotePwd': 'Password',
            'nav.bk.plhPwd': 'Enter remote login password',
            'nav.bk.optCompare': 'Compare before restore, skip if not updated',
            'nav.bk.optPull': 'Request immediate backup generation on main site before pulling',
            'nav.bk.optAuto': 'Auto-restore latest backup on startup',
            'nav.bk.scheduleTitle': 'Scheduled Backup',
            'nav.bk.scheduleDesc': 'By default, creates a server backup every day at 02:00 and only prunes scheduled backups older than the retention window.',
            'nav.bk.scheduleEnabled': 'Enable scheduled backup',
            'nav.bk.scheduleTime': 'Run Time',
            'nav.bk.scheduleRetention': 'Retention',
            'nav.bk.scheduleDays': 'days',
            'nav.bk.scheduleNext': 'Next Run: ',
            'nav.bk.scheduleLast': 'Last Success: ',
            'nav.bk.scheduleLastFile': 'Last File: ',
            'nav.bk.scheduleError': 'Last Error: ',
            'nav.bk.scheduleNotRun': 'Not run yet',
            'nav.bk.scheduleDisabled': 'Disabled',
            'nav.bk.scheduleSaved': 'Scheduled backup settings saved',
            'nav.bk.scheduleSaving': 'Saving scheduled backup settings...',
            'nav.bk.scheduleRun': 'Run Once Now',
            'nav.bk.stLocal': 'Time displayed in local timezone ({tz})',
            'nav.bk.stCheck': 'Last Check: ',
            'nav.bk.stSync': 'Last Sync: ',
            'nav.bk.stError': 'Last Error: ',
            'nav.bk.btnCheck': 'Test Connection / Check Latest',
            'nav.bk.btnPull': 'Pull & Restore by Rules',
            'nav.bk.btnForce': 'Force Restore Remote Latest',
            'nav.bk.btnClearPwd': 'Clear Password',
            'nav.bk.svrTitle': 'Server Backup',
            'nav.bk.svrDesc': 'Backups are saved on the server and can be downloaded locally.',
            'nav.bk.btnCreate': 'Create Server Backup',
            'nav.bk.btnCreateDL': 'Create & Download',
            'nav.bk.upTitle': 'Restore from Upload',
            'nav.bk.upDesc': 'Accepts only platform-generated backup zip files. Creates a pre-restore safety backup.',
            'nav.bk.btnUp': 'Upload & Restore',
            'nav.bk.badgeSync': 'Remote Sync',
            'nav.bk.badgeSafe': 'Safety Backup',
            'nav.bk.badgeAuto': 'Scheduled',
            'nav.bk.fail': 'Failed to load backups: ',
            'nav.bk.dlTitle': 'Download Backup',
            'nav.bk.rsTitle': 'Restore from this backup',
            'nav.bk.delTitle': 'Permanently delete this backup',
            'nav.bk.thFile': 'Backup File',
            'nav.bk.thAction': 'Action',
            'nav.bk.noData': 'No Server Backups',

            'nav.acc.empty': 'Loading accounts...',
            'nav.acc.admin': 'Admin',
            'nav.acc.readonly': 'Readonly',
            'nav.acc.help': 'Account permissions control write operations on the platform. Takes effect immediately.',
            'nav.acc.plhUser': 'New Username',
            'nav.acc.plhPwd': 'Set Password',
            'nav.acc.btnAdd': 'Add Account',
            'nav.acc.thUser': 'Username',
            'nav.acc.thRole': 'Role',
            'nav.acc.thAction': 'Actions',
            'nav.acc.noData': 'No Accounts',
            'nav.acc.fail': 'Failed to load accounts: ',
            'nav.acc.btnDel': 'Delete',
            'nav.acc.btnReset': 'Reset Password',

            'nav.sec.empty': 'Loading security policy...',
            'nav.sec.help': 'Failed logins are progressively locked by account, source IP, and multi-account attempts from the same IP. Lock events are reported to the alert center with the configured severity.',
            'nav.sec.enabled': 'Enable progressive failed-login lockout',
            'nav.sec.alertOnLock': 'Report lock events to alert center',
            'nav.sec.sessionHours': 'Session lifetime (hours)',
            'nav.sec.accountPolicy': 'Account Lock Policies',
            'nav.sec.ipPolicy': 'IP Lock Policies',
            'nav.sec.multiPolicy': 'Same-IP Multi-Account Policies',
            'nav.sec.thEnabled': 'Enabled',
            'nav.sec.thCount': 'Fail/User Count',
            'nav.sec.thWindow': 'Window (min)',
            'nav.sec.thLock': 'Lock (min)',
            'nav.sec.thSeverity': 'Severity',
            'nav.sec.locksTitle': 'Active Locks',
            'nav.sec.btnRefresh': 'Refresh Locks',
            'nav.sec.btnUnlock': 'Unlock',
            'nav.sec.noLocks': 'No account or IP locks',
            'nav.sec.thType': 'Type',
            'nav.sec.thTarget': 'Target',
            'nav.sec.thReason': 'Reason',
            'nav.sec.thFailCount': 'Count',
            'nav.sec.thUntil': 'Locked Until',
            'nav.sec.failLoad': 'Failed to load security policy: ',
            'nav.sec.saving': 'Saving security policy...',
            'nav.sec.saved': 'Security policy saved',

            'nav.alert.title': 'Alert Center',
            'nav.alert.subtitle': 'Review system alerts, configuration changes, and key user actions in one place.',
            'nav.alert.loading': 'Loading alerts...',
            'nav.alert.empty': 'No alert events',
            'nav.alert.all': 'All',
            'nav.alert.unread': 'Unread',
            'nav.alert.warn': 'Risk+',
            'nav.alert.config': 'Config',
            'nav.alert.security': 'Security',
            'nav.alert.userAction': 'User Actions',
            'nav.alert.system': 'System',
            'nav.alert.summaryTotal': 'Events',
            'nav.alert.summaryUnread': 'Unread',
            'nav.alert.summaryRisk': 'Risk',
            'nav.alert.markAll': 'Mark all read',
            'nav.alert.refresh': 'Refresh',
            'nav.alert.archive': 'Archive',
            'nav.alert.archiveAll': 'Archive all',
            'nav.alert.archiveAllConfirm': 'Archive all alerts?',
            'nav.alert.read': 'Read',
            'nav.alert.actor': 'Actor',
            'nav.alert.source': 'Source',
            'nav.alert.object': 'Object',
            'nav.alert.failLoad': 'Failed to load alerts: '
        }
    });
}

function navEscape(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getAuthHeaderForNav() {
    const token = localStorage.getItem('tools_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function normalizeNavSettings(settings = {}) {
    const cats = Array.isArray(settings.categories) && settings.categories.length ? settings.categories.map(cat => {
        const defCat = NAV_DEFAULT_SETTINGS.categories.find(c => c.id === cat.id);
        if (defCat && !cat.nameEn) cat.nameEn = defCat.nameEn;
        return cat;
    }) : NAV_DEFAULT_SETTINGS.categories.slice();

    return {
        primaryIds: Array.isArray(settings.primaryIds) ? settings.primaryIds.map(String) : NAV_DEFAULT_SETTINGS.primaryIds.slice(),
        categories: cats,
        categoryByItem: settings.categoryByItem && typeof settings.categoryByItem === 'object' ? { ...settings.categoryByItem } : { ...NAV_DEFAULT_SETTINGS.categoryByItem },
        itemOrder: Array.isArray(settings.itemOrder) ? settings.itemOrder.map(String) : NAV_DEFAULT_SETTINGS.itemOrder.slice()
    };
}

function getAllNavItems() {
    const customItems = (navState.customTools || []).map(tool => ({
        id: `custom:${tool.slug}`,
        href: tool.href,
        icon: tool.icon || '🧩',
        label: tool.name || navT('nav.customTool'),
        defaultCategory: 'custom',
        match: p => p === tool.href || p.startsWith(`${tool.href}/`)
    }));
    return [...NAV_BUILTIN_LINKS, ...customItems];
}

function sortNavItems(items, orderIds) {
    const order = new Map((orderIds || []).map((id, index) => [id, index]));
    return items.slice().sort((a, b) => {
        const ai = order.has(a.id) ? order.get(a.id) : 9999;
        const bi = order.has(b.id) ? order.get(b.id) : 9999;
        if (ai !== bi) return ai - bi;
        const locale = window.ToolsI18n?.getLanguage?.() || 'zh-CN';
        return getNavLabel(a).localeCompare(getNavLabel(b), locale);
    });
}

function renderNavItem(item, className) {
    const path = window.location.pathname;
    return `<a href="${item.href}" class="${className} ${item.match(path) ? 'active' : ''}" data-nav-item-id="${navEscape(item.id)}">${item.icon} ${navEscape(getNavLabel(item))}</a>`;
}

function renderNavLinksFromState() {
    const primaryEl = document.querySelector('#app-navbar .nav-links');
    const menuEl = document.getElementById('navMoreMenu');
    if (!primaryEl || !menuEl) return;

    const settings = navState.settings;
    const allItems = getAllNavItems();
    const itemById = new Map(allItems.map(item => [item.id, item]));
    const primaryItems = (settings.primaryIds || []).map(id => itemById.get(id)).filter(Boolean);
    const primaryIds = new Set(primaryItems.map(item => item.id));
    const overflowItems = sortNavItems(allItems.filter(item => !primaryIds.has(item.id)), settings.itemOrder);
    navState.currentPrimaryItems = primaryItems;

    primaryEl.innerHTML = primaryItems.map(item => renderNavItem(item, 'nav-link')).join('');

    const categoryMap = new Map((settings.categories || []).map(cat => [cat.id, { ...cat, items: [] }]));
    if (!categoryMap.size) {
        NAV_DEFAULT_SETTINGS.categories.forEach(cat => categoryMap.set(cat.id, { ...cat, items: [] }));
    }
    overflowItems.forEach(item => {
        const catId = settings.categoryByItem[item.id] || item.defaultCategory || 'custom';
        if (!categoryMap.has(catId)) categoryMap.set(catId, { id: catId, name: navT('nav.uncategorized'), items: [] });
        categoryMap.get(catId).items.push(item);
    });

    const menuHtml = Array.from(categoryMap.values())
        .filter(cat => cat.items.length)
        .map(cat => `
            <div class="nav-more-category">
                <div class="nav-more-section-label">${navEscape(getNavCategoryName(cat))}</div>
                ${cat.items.map(item => renderNavItem(item, 'nav-more-item')).join('')}
            </div>
        `).join('');
    menuEl.innerHTML = menuHtml || `<div class="nav-more-empty">${navEscape(navT('nav.empty'))}</div>`;
    queueResponsiveNavbarUpdate();
}

let navResponsiveRaf = null;

function queueResponsiveNavbarUpdate() {
    if (navResponsiveRaf) cancelAnimationFrame(navResponsiveRaf);
    navResponsiveRaf = requestAnimationFrame(updateResponsiveNavbar);
}

function isNavbarOverflowing(nav) {
    const primaryEl = nav.querySelector('.nav-links');
    const moreEl = document.getElementById('navMore');
    const actionsEl = nav.querySelector('.nav-actions');
    const statusEl = nav.querySelector('.nav-status');
    const rightEdge = actionsEl?.getBoundingClientRect?.().left || statusEl?.getBoundingClientRect?.().left || nav.getBoundingClientRect().right;
    const menuEdge = moreEl?.getBoundingClientRect?.().right || primaryEl?.getBoundingClientRect?.().right || 0;
    const visibleLinks = Array.from(primaryEl?.querySelectorAll('.nav-link:not(.nav-responsive-hidden)') || []);
    const lastLink = visibleLinks[visibleLinks.length - 1];
    const lastLinkEdge = lastLink?.getBoundingClientRect?.().right || 0;
    const moreLeft = moreEl?.getBoundingClientRect?.().left || Infinity;
    return nav.scrollWidth > nav.clientWidth + 1 || menuEdge > rightEdge - 8 || lastLinkEdge > moreLeft - 10;
}

function updateResponsiveNavbar() {
    navResponsiveRaf = null;
    const nav = document.getElementById('app-navbar');
    const primaryEl = nav?.querySelector('.nav-links');
    const menuEl = document.getElementById('navMoreMenu');
    if (!nav || !primaryEl || !menuEl) return;

    primaryEl.querySelectorAll('.nav-link.nav-responsive-hidden').forEach(link => {
        link.classList.remove('nav-responsive-hidden');
    });
    document.getElementById('navResponsiveCategory')?.remove();
    if (!menuEl.children.length) {
        menuEl.innerHTML = `<div class="nav-more-empty">${navEscape(navT('nav.empty'))}</div>`;
    }

    const links = Array.from(primaryEl.querySelectorAll('.nav-link'));
    if (!links.length || !isNavbarOverflowing(nav)) return;

    const nonActive = links.filter(link => !link.classList.contains('active')).reverse();
    const active = links.filter(link => link.classList.contains('active')).reverse();
    const candidates = [...nonActive, ...active];
    const collapsedIds = [];

    for (const link of candidates) {
        if (!isNavbarOverflowing(nav)) break;
        link.classList.add('nav-responsive-hidden');
        const itemId = link.getAttribute('data-nav-item-id');
        if (itemId) collapsedIds.push(itemId);
    }

    if (!collapsedIds.length) return;

    const itemById = new Map((navState.currentPrimaryItems || []).map(item => [item.id, item]));
    const collapsedItems = collapsedIds
        .map(id => itemById.get(id))
        .filter(Boolean)
        .reverse();
    if (!collapsedItems.length) return;

    const emptyEl = menuEl.querySelector(':scope > .nav-more-empty');
    if (emptyEl && menuEl.children.length === 1) emptyEl.remove();

    const category = document.createElement('div');
    category.className = 'nav-more-category nav-responsive-category';
    category.id = 'navResponsiveCategory';
    category.innerHTML = `
        <div class="nav-more-section-label">${navEscape(navT('nav.more'))}</div>
        ${collapsedItems.map(item => renderNavItem(item, 'nav-more-item nav-responsive-more-item')).join('')}
    `;
    menuEl.prepend(category);
}

async function loadNavigationData() {
    try {
        const [settingsRes, toolsRes] = await Promise.all([
            fetch('/api/nav-settings', { headers: getAuthHeaderForNav() }),
            fetch('/api/custom-tools', { headers: getAuthHeaderForNav() })
        ]);
        if (settingsRes.ok) navState.settings = normalizeNavSettings(await settingsRes.json());
        if (toolsRes.ok) navState.customTools = await toolsRes.json();
    } catch (e) {
        console.warn('[Navbar] load navigation data failed:', e);
    }
    renderNavLinksFromState();
    if (document.getElementById('navSettingsModal')) renderNavSettingsContent();
}

function renderNavbar() {
    const role = localStorage.getItem('tools_role');
    const user = localStorage.getItem('tools_user');


    // Hide all buttons that edit/add stuff if readonly
    if (role === 'readonly') {
        const style = document.createElement('style');
        style.textContent = `
            button[onclick^="openAdd"], button[onclick^="openGroupModal"], 
            button[onclick^="openWeightModal"], button[onclick^="save"],
            button[onclick^="delete"], button[onclick^="add"], button[onclick^="upload"],
            .btn-action, .manual-adjust-input { display: none !important; }
        `;
        document.head.appendChild(style);
    }

    const nav = document.createElement('nav');
    nav.id = 'app-navbar';
    nav.innerHTML = `
        <a href="/" class="nav-brand">
            <span class="brand-icon">⚡</span>
            <span class="brand-name">Tools Platform</span>
        </a>
        <div class="nav-divider"></div>
        <div class="nav-links"></div>
        <div class="nav-more" id="navMore">
            <button type="button" class="nav-more-btn" id="navMoreBtn" onclick="toggleNavMore(event)">${navEscape(navT('nav.more'))} ▾</button>
            <div class="nav-more-menu" id="navMoreMenu"></div>
        </div>
        <div style="flex:1"></div>
        
        <div class="nav-actions">
            <button type="button" class="nav-lang-toggle" onclick="toggleAppLanguage()" title="${navEscape(navT('nav.languageTitle'))}" aria-label="${navEscape(navT('nav.languageTitle'))}">
                <span class="nav-lang-icon">🌐</span>
                <span class="nav-lang-current">${window.ToolsI18n?.getLanguage?.() === 'en-US' ? 'EN' : '中文'}</span>
            </button>
            <a href="/requirements" class="req-btn nav-action-link" title="${navEscape(navT('nav.requirements'))}"><span class="nav-action-icon">🎯</span><span class="nav-action-text">${navEscape(navT('nav.requirements'))}</span></a>
            <button type="button" class="nav-alert-btn" onclick="openAlertCenter()" title="${navEscape(navT('nav.alertCenterTitle'))}" aria-label="${navEscape(navT('nav.alertCenterTitle'))}">
                <span class="nav-action-icon">🔔</span>
                <span class="nav-action-text">${navEscape(navT('nav.alertCenter'))}</span>
                <span class="nav-alert-count" id="navAlertCount" hidden>0</span>
            </button>
            ${role === 'admin' ? `<button type="button" class="nav-gear-btn" onclick="openNavSettingsModal()" title="${navEscape(navT('nav.settings'))}">⚙</button>` : ''}
            <span class="nav-user-chip" title="${navEscape(user || '未登录')}"><span class="nav-action-icon">👤</span><span class="nav-action-text">${navEscape(user || '未登录')}</span></span>
            <a href="#" class="nav-logout-link" onclick="doLogout()" title="${navEscape(navT('nav.logout'))}"><span class="nav-action-icon">↩</span><span class="nav-action-text">${navEscape(navT('nav.logout'))}</span></a>
        </div>

        <div class="nav-status" style="margin-left:20px; display:flex; align-items:center; gap:12px;">
            <div style="font-size:11px; color:#64748b; background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px; font-family:monospace; letter-spacing:0.5px;" id="nav-resource-version-display"></div>
            <div style="display:flex; align-items:center; gap:6px;">
                <div class="status-dot"></div>
                <span id="server-status-text">${navEscape(navT('nav.online'))}</span>
            </div>
        </div>
    `;
    document.body.prepend(nav);

    // Automatically extract resource cache version from navbar.js script tag
    const versionDisplay = document.getElementById('nav-resource-version-display');
    if (versionDisplay) {
        let detectedVersion = 'v1.1.0';
        for (const script of document.querySelectorAll('script')) {
            if (script.src && script.src.includes('/js/shared/navbar.js')) {
                const match = script.src.match(/\?v=([^&]+)/);
                if (match) {
                    detectedVersion = `v${match[1]}`;
                    break;
                }
            }
        }
        versionDisplay.textContent = detectedVersion;
    }

    renderNavLinksFromState();
}

window.refreshCustomToolNavLinks = loadNavigationData;

window.toggleAppLanguage = function () {
    if (window.ToolsI18n) window.ToolsI18n.toggleLanguage();
};

window.addEventListener('tools:languagechange', () => {
    registerNavbarI18n();
    const existingNav = document.getElementById('app-navbar');
    if (existingNav) existingNav.remove();
    renderNavbar();
    renderNavLinksFromState();

    // Also re-render the modal shell if it's open, to update the sidebar language without losing the open state
    const modal = document.getElementById('navSettingsModal');
    if (modal && modal.style.display !== 'none') {
        renderNavSettingsSidebar();
        renderNavSettingsContent();
    }
});

window.addEventListener('resize', queueResponsiveNavbarUpdate);

window.toggleNavMore = function (event) {
    event.preventDefault();
    event.stopPropagation();
    document.getElementById('navMore')?.classList.toggle('open');
};

document.addEventListener('click', (event) => {
    const more = document.getElementById('navMore');
    if (more && !more.contains(event.target)) more.classList.remove('open');
});

function scheduleNavSettingsSave() {
    renderNavLinksFromState();
    const indicator = document.getElementById('navSettingsSaveState');
    if (indicator) indicator.textContent = navT('nav.set.saving');
    clearTimeout(navState.saveTimer);
    navState.saveTimer = setTimeout(async () => {
        try {
            const res = await fetch('/api/nav-settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaderForNav()
                },
                body: JSON.stringify(navState.settings)
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            navState.settings = normalizeNavSettings(await res.json());
            if (indicator) indicator.textContent = navT('nav.set.saved');
        } catch (e) {
            if (indicator) indicator.textContent = navT('nav.set.saveFail') + e.message;
        }
    }, 420);
}

function moveArrayItem(arr, index, delta) {
    const next = index + delta;
    if (index < 0 || next < 0 || next >= arr.length) return arr;
    const copy = arr.slice();
    const [item] = copy.splice(index, 1);
    copy.splice(next, 0, item);
    return copy;
}

function renderPageSettingsTabs() {
    return NAV_BUILTIN_LINKS.map(item => `
        <button class="nav-settings-tab nav-settings-tab-page ${navState.settingsTab === `page:${item.id}` ? 'active' : ''}" data-tab="page:${navEscape(item.id)}" onclick="switchNavSettingsTab('page:${navEscape(item.id)}')">${item.icon} ${navEscape(getNavLabel(item))}</button>
    `).join('');
}

function renderNavSettingsSidebar() {
    const sidebar = document.querySelector('.nav-settings-sidebar');
    if (!sidebar) return;
    const t = navState.settingsTab;
    sidebar.innerHTML = `
        <div class="nav-settings-title">${navEscape(navT('nav.set.title'))}</div>
        <button class="nav-settings-tab ${t === 'primary' ? 'active' : ''}" data-tab="primary" onclick="switchNavSettingsTab('primary')">${navEscape(navT('nav.set.tab.primary'))}</button>
        <button class="nav-settings-tab ${t === 'categories' ? 'active' : ''}" data-tab="categories" onclick="switchNavSettingsTab('categories')">${navEscape(navT('nav.set.tab.categories'))}</button>
        <button class="nav-settings-tab ${t === 'items' ? 'active' : ''}" data-tab="items" onclick="switchNavSettingsTab('items')">${navEscape(navT('nav.set.tab.items'))}</button>
        <button class="nav-settings-tab ${t === 'ai' ? 'active' : ''}" data-tab="ai" onclick="switchNavSettingsTab('ai')">${navEscape(navT('nav.set.tab.ai'))}</button>
        <button class="nav-settings-tab ${t === 'update' ? 'active' : ''}" data-tab="update" onclick="switchNavSettingsTab('update')">${navEscape(navT('nav.set.tab.update'))}</button>
        <button class="nav-settings-tab ${t === 'backup' ? 'active' : ''}" data-tab="backup" onclick="switchNavSettingsTab('backup')">${navEscape(navT('nav.set.tab.backup'))}</button>
        <button class="nav-settings-tab ${t === 'accounts' ? 'active' : ''}" data-tab="accounts" onclick="switchNavSettingsTab('accounts')">${navEscape(navT('nav.set.tab.accounts'))}</button>
        <button class="nav-settings-tab ${t === 'security' ? 'active' : ''}" data-tab="security" onclick="switchNavSettingsTab('security')">${navEscape(navT('nav.set.tab.security'))}</button>
        <div class="nav-settings-title nav-settings-section-title">${navEscape(navT('nav.set.tab.pages'))}</div>
        ${renderPageSettingsTabs()}
    `;
}

function openNavSettingsModal() {
    if (localStorage.getItem('tools_role') !== 'admin') return;
    let modal = document.getElementById('navSettingsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'navSettingsModal';
        modal.className = 'nav-settings-modal';
        modal.innerHTML = `
            <div class="nav-settings-window">
                <div class="nav-settings-sidebar"></div>
                <div class="nav-settings-main">
                    <button class="nav-settings-close" onclick="closeNavSettingsModal()">×</button>
                    <div class="nav-settings-head">
                        <div>
                            <div class="nav-settings-heading" id="navSettingsHeading"></div>
                            <div class="nav-settings-subtitle" id="navSettingsSubtitle"></div>
                        </div>
                        <div class="nav-settings-save-state" id="navSettingsSaveState">${navEscape(navT('nav.set.loaded'))}</div>
                    </div>
                    <div id="navSettingsContent"></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    renderNavSettingsSidebar();
    renderNavSettingsContent();
}

function closeNavSettingsModal() {
    const modal = document.getElementById('navSettingsModal');
    if (modal) modal.style.display = 'none';
}

window.openNavSettingsModal = openNavSettingsModal;
window.closeNavSettingsModal = closeNavSettingsModal;

window.switchNavSettingsTab = function (tab) {
    navState.settingsTab = tab;
    document.querySelectorAll('.nav-settings-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    renderNavSettingsContent();
};

function getNavSettingsTitle() {
    if (navState.settingsTab.startsWith('page:')) {
        const pageId = navState.settingsTab.slice(5);
        const item = NAV_BUILTIN_LINKS.find(link => link.id === pageId);
        return item ? navT('nav.set.pageConfig', { page: getNavLabel(item) }) : navT('nav.set.tab.pages');
    }
    if (navState.settingsTab === 'accounts') return navT('nav.set.tab.accounts');
    if (navState.settingsTab === 'security') return navT('nav.set.tab.security');
    if (navState.settingsTab === 'ai') return navT('nav.set.tab.ai');
    if (navState.settingsTab === 'update') return navT('nav.set.tab.update');
    if (navState.settingsTab === 'backup') return navT('nav.set.tab.backup');
    if (navState.settingsTab === 'categories') return navT('nav.set.tab.categories');
    if (navState.settingsTab === 'items') return navT('nav.set.tab.items');
    return navT('nav.set.tab.primary');
}

function getNavSettingsSubtitle() {
    if (navState.settingsTab.startsWith('page:')) {
        const pageId = navState.settingsTab.slice(5);
        if (pageId === 'report') return navT('nav.set.sub.report');
        return navT('nav.set.sub.pageFallback');
    }
    if (navState.settingsTab === 'accounts') return navT('nav.set.sub.accounts');
    if (navState.settingsTab === 'security') return navT('nav.set.sub.security');
    if (navState.settingsTab === 'ai') return navT('nav.set.sub.ai');
    if (navState.settingsTab === 'update') return navT('nav.set.sub.update');
    if (navState.settingsTab === 'backup') return navT('nav.set.sub.backup');
    if (navState.settingsTab === 'categories') return navT('nav.set.sub.categories');
    if (navState.settingsTab === 'items') return navT('nav.set.sub.items');
    return navT('nav.set.sub.primary');
}

function renderNavSettingsContent() {
    const content = document.getElementById('navSettingsContent');
    const heading = document.getElementById('navSettingsHeading');
    const subtitle = document.getElementById('navSettingsSubtitle');
    if (!content) return;
    if (heading) heading.textContent = getNavSettingsTitle();
    if (subtitle) subtitle.textContent = getNavSettingsSubtitle();

    const indicator = document.getElementById('navSettingsSaveState');
    if (indicator && (indicator.textContent === '已加载' || indicator.textContent === 'Loaded')) {
        indicator.textContent = navT('nav.set.loaded');
    }

    if (navState.settingsTab.startsWith('page:')) return renderPageSettings(content, navState.settingsTab.slice(5));
    if (navState.settingsTab === 'accounts') return renderAccountSettings(content);
    if (navState.settingsTab === 'security') return renderSecuritySettings(content);
    if (navState.settingsTab === 'ai') return renderAiSettings(content);
    if (navState.settingsTab === 'update') return renderUpdaterSettings(content);
    if (navState.settingsTab === 'backup') return renderBackupSettings(content);
    if (navState.settingsTab === 'categories') return renderCategorySettings(content);
    if (navState.settingsTab === 'items') return renderItemCategorySettings(content);
    renderPrimarySettings(content);
}

function renderPrimarySettings(content) {
    const items = sortNavItems(getAllNavItems(), navState.settings.primaryIds);
    const primaryIds = new Set(navState.settings.primaryIds || []);
    content.innerHTML = `
        <div class="nav-settings-help">${navEscape(navT('nav.set.help.primary'))}</div>
        <div class="nav-settings-list">
            ${items.map(item => {
        const index = navState.settings.primaryIds.indexOf(item.id);
        return `
                    <div class="nav-settings-row">
                        <label class="nav-settings-check">
                            <input type="checkbox" ${primaryIds.has(item.id) ? 'checked' : ''} onchange="togglePrimaryNavItem('${navEscape(item.id)}', this.checked)">
                            <span>${item.icon} ${navEscape(getNavLabel(item))}</span>
                        </label>
                        <div class="nav-settings-actions">
                            <button onclick="movePrimaryNavItem('${navEscape(item.id)}', -1)" ${index <= 0 ? 'disabled' : ''}>${navEscape(navT('nav.set.btn.up'))}</button>
                            <button onclick="movePrimaryNavItem('${navEscape(item.id)}', 1)" ${index < 0 || index >= navState.settings.primaryIds.length - 1 ? 'disabled' : ''}>${navEscape(navT('nav.set.btn.down'))}</button>
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
    `;
}

window.togglePrimaryNavItem = function (id, checked) {
    const ids = navState.settings.primaryIds || [];
    if (checked && !ids.includes(id)) ids.push(id);
    if (!checked) navState.settings.primaryIds = ids.filter(item => item !== id);
    else navState.settings.primaryIds = ids;
    renderNavSettingsContent();
    scheduleNavSettingsSave();
};

window.movePrimaryNavItem = function (id, delta) {
    const ids = navState.settings.primaryIds || [];
    const index = ids.indexOf(id);
    navState.settings.primaryIds = moveArrayItem(ids, index, delta);
    renderNavSettingsContent();
    scheduleNavSettingsSave();
};

function renderCategorySettings(content) {
    const categories = navState.settings.categories || [];
    content.innerHTML = `
        <div class="nav-settings-help">${navEscape(navT('nav.set.help.categories'))}</div>
        <div class="nav-settings-list">
            ${categories.map((cat, index) => `
                <div class="nav-settings-row" style="flex-wrap: wrap; gap: 8px; padding-bottom: 12px;">
                    <div style="display: flex; gap: 8px; flex: 1; min-width: 300px;">
                        <input class="nav-settings-input" placeholder="${navEscape(navT('nav.set.placeholder.zh'))}" value="${navEscape(cat.name)}" oninput="renameNavCategory('${navEscape(cat.id)}', this.value, 'zh')">
                        <input class="nav-settings-input" placeholder="${navEscape(navT('nav.set.placeholder.en'))}" value="${navEscape(cat.nameEn || '')}" oninput="renameNavCategory('${navEscape(cat.id)}', this.value, 'en')">
                    </div>
                    <div class="nav-settings-actions" style="margin-left: auto;">
                        <button onclick="moveNavCategory(${index}, -1)" ${index === 0 ? 'disabled' : ''}>${navEscape(navT('nav.set.btn.up'))}</button>
                        <button onclick="moveNavCategory(${index}, 1)" ${index === categories.length - 1 ? 'disabled' : ''}>${navEscape(navT('nav.set.btn.down'))}</button>
                        <button onclick="deleteNavCategory('${navEscape(cat.id)}')" ${categories.length <= 1 ? 'disabled' : ''}>${navEscape(navT('nav.set.btn.delete'))}</button>
                    </div>
                </div>
            `).join('')}
        </div>
        <button class="nav-settings-add" onclick="addNavCategory()">${navEscape(navT('nav.set.btn.addCategory'))}</button>
    `;
}

window.renameNavCategory = function (id, name, lang = 'zh') {
    const cat = (navState.settings.categories || []).find(item => item.id === id);
    if (cat) {
        if (lang === 'zh') cat.name = name.trim();
        else if (lang === 'en') cat.nameEn = name.trim();
    }
    scheduleNavSettingsSave();
};

window.moveNavCategory = function (index, delta) {
    navState.settings.categories = moveArrayItem(navState.settings.categories || [], index, delta);
    renderNavSettingsContent();
    scheduleNavSettingsSave();
};

window.addNavCategory = function () {
    const id = `cat_${Date.now().toString(36)}`;
    navState.settings.categories.push({ id, name: navT('nav.set.newCategory') });
    renderNavSettingsContent();
    scheduleNavSettingsSave();
};

window.deleteNavCategory = function (id) {
    const categories = navState.settings.categories || [];
    const fallback = categories.find(item => item.id !== id);
    navState.settings.categories = categories.filter(item => item.id !== id);
    Object.keys(navState.settings.categoryByItem || {}).forEach(itemId => {
        if (navState.settings.categoryByItem[itemId] === id && fallback) {
            navState.settings.categoryByItem[itemId] = fallback.id;
        }
    });
    renderNavSettingsContent();
    scheduleNavSettingsSave();
};

function renderItemCategorySettings(content) {
    const settings = navState.settings;
    const primaryIds = new Set(settings.primaryIds || []);
    const items = sortNavItems(getAllNavItems().filter(item => !primaryIds.has(item.id)), settings.itemOrder);
    const categories = settings.categories || [];
    content.innerHTML = `
        <div class="nav-settings-help">${navEscape(navT('nav.set.help.items'))}</div>
        <div class="nav-settings-list">
            ${items.map((item, index) => {
        const selected = settings.categoryByItem[item.id] || item.defaultCategory || (categories[0] && categories[0].id) || '';
        return `
                    <div class="nav-settings-row">
                        <div class="nav-settings-item-name">${item.icon} ${navEscape(getNavLabel(item))}</div>
                        <select class="nav-settings-select" onchange="setNavItemCategory('${navEscape(item.id)}', this.value)">
                            ${categories.map(cat => `<option value="${navEscape(cat.id)}" ${cat.id === selected ? 'selected' : ''}>${navEscape(getNavCategoryName(cat))}</option>`).join('')}
                        </select>
                        <div class="nav-settings-actions">
                            <button onclick="moveOverflowNavItem('${navEscape(item.id)}', -1)" ${index === 0 ? 'disabled' : ''}>${navEscape(navT('nav.set.btn.up'))}</button>
                            <button onclick="moveOverflowNavItem('${navEscape(item.id)}', 1)" ${index === items.length - 1 ? 'disabled' : ''}>${navEscape(navT('nav.set.btn.down'))}</button>
                        </div>
                    </div>
                `;
    }).join('') || `<div class="nav-settings-empty">${navEscape(navT('nav.set.emptyItems'))}</div>`}
        </div>
    `;
}

window.setNavItemCategory = function (id, categoryId) {
    navState.settings.categoryByItem[id] = categoryId;
    scheduleNavSettingsSave();
};

window.moveOverflowNavItem = function (id, delta) {
    const primaryIds = new Set(navState.settings.primaryIds || []);
    const overflowIds = sortNavItems(getAllNavItems().filter(item => !primaryIds.has(item.id)), navState.settings.itemOrder).map(item => item.id);
    const moved = moveArrayItem(overflowIds, overflowIds.indexOf(id), delta);
    const primaryOrder = new Set(moved);
    const rest = (navState.settings.itemOrder || []).filter(itemId => !primaryOrder.has(itemId));
    navState.settings.itemOrder = [...moved, ...rest];
    renderNavSettingsContent();
    scheduleNavSettingsSave();
};

function sourceLabelForAiSettings(source) {
    if (source === 'stored') return navT('nav.ai.srcStored');
    if (source === 'env') return navT('nav.ai.srcEnv');
    return navT('nav.ai.srcNone');
}

function keyHealthLabelForAiSettings(settings) {
    if (!settings.hasApiKey) return navT('nav.ai.keyNone');
    if (!settings.keyLooksValid) return navT('nav.ai.keyInvalid') + (settings.maskedApiKey || '');
    return navT('nav.ai.keyValid') + (settings.maskedApiKey || '');
}

async function fetchAiSettingsForNav() {
    const res = await fetch('/api/ai-settings', { headers: getAuthHeaderForNav() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    navState.aiSettings = await res.json();
    return navState.aiSettings;
}

async function renderAiSettings(content) {
    content.innerHTML = `<div class="nav-settings-empty">${navEscape(navT('nav.ai.empty'))}</div>`;
    try {
        const settings = await fetchAiSettingsForNav();
        content.innerHTML = `
            <div class="nav-settings-help">${navEscape(navT('nav.ai.help'))}</div>
            <div class="nav-ai-status">
                <span>${navEscape(navT('nav.ai.sourcePrefix'))}${navEscape(sourceLabelForAiSettings(settings.apiKeySource))}</span>
                <span class="${settings.hasApiKey && !settings.keyLooksValid ? 'warning' : ''}">${navEscape(keyHealthLabelForAiSettings(settings))}</span>
            </div>
            <div class="nav-ai-grid">
                <label class="nav-ai-field">
                    <span>${navEscape(navT('nav.ai.lblProvider'))}</span>
                    <select id="navAiProvider" class="nav-settings-input" onchange="handleAiProviderChange()">
                        <option value="gemini" ${settings.provider === 'gemini' ? 'selected' : ''}>Gemini</option>
                        <option value="openai" ${settings.provider === 'openai' ? 'selected' : ''}>OpenAI</option>
                        <option value="anthropic" ${settings.provider === 'anthropic' ? 'selected' : ''}>Anthropic</option>
                        <option value="openai-compatible" ${settings.provider === 'openai-compatible' ? 'selected' : ''}>OpenAI Compatible</option>
                    </select>
                </label>
                <label class="nav-ai-field nav-ai-field-wide">
                    <span>${navEscape(navT('nav.ai.lblApiUrl'))}</span>
                    <input id="navAiApiBaseUrl" class="nav-settings-input" value="${navEscape(settings.apiBaseUrl || '')}" placeholder="${navEscape(navT('nav.ai.plhApiUrl'))}" oninput="scheduleAiSettingsSave()">
                </label>
                <label class="nav-ai-field nav-ai-field-wide">
                    <span>${navEscape(navT('nav.ai.lblToken'))}</span>
                    <div class="nav-ai-token-row">
                        <input id="navAiApiKey" type="text" inputmode="text" class="nav-settings-input nav-ai-token-input" autocomplete="new-password" autocapitalize="off" autocorrect="off" spellcheck="false" data-lpignore="true" data-1p-ignore="true" placeholder="${settings.hasApiKey ? `${navEscape(navT('nav.ai.plhKeep'))}${navEscape(settings.maskedApiKey)}` : navEscape(navT('nav.ai.plhToken'))}" onfocus="this.dataset.userTouched='1'" oninput="scheduleAiSettingsSave({ tokenTouched: this.dataset.userTouched === '1' })">
                        <button type="button" class="nav-settings-add" onclick="clearAiApiKey()">${navEscape(navT('nav.ai.btnClear'))}</button>
                    </div>
                </label>
                <label class="nav-ai-field">
                    <span>${navEscape(navT('nav.ai.lblModel'))}</span>
                    <input id="navAiModel" class="nav-settings-input" list="navAiModelOptions" value="${navEscape(settings.model)}" oninput="scheduleAiSettingsSave()">
                    <datalist id="navAiModelOptions">
                        <option value="gemini-2.5-flash"></option>
                        <option value="gemini-2.5-pro"></option>
                        <option value="gemini-1.5-flash"></option>
                        <option value="gpt-4o-mini"></option>
                        <option value="gpt-4o"></option>
                        <option value="gpt-4.1-mini"></option>
                        <option value="claude-3-5-sonnet-latest"></option>
                        <option value="claude-3-5-haiku-latest"></option>
                    </datalist>
                </label>
                <label class="nav-ai-field">
                    <span>Temperature</span>
                    <input id="navAiTemperature" type="number" min="0" max="2" step="0.1" class="nav-settings-input" value="${navEscape(settings.temperature)}" oninput="scheduleAiSettingsSave()">
                </label>
                <label class="nav-ai-field">
                    <span>${navEscape(navT('nav.ai.lblMax'))}</span>
                    <input id="navAiMaxTokens" type="number" min="128" max="8192" step="128" class="nav-settings-input" value="${navEscape(settings.maxOutputTokens)}" oninput="scheduleAiSettingsSave()">
                </label>
                <label class="nav-ai-field">
                    <span>${navEscape(navT('nav.ai.lblInputCost'))}</span>
                    <input id="navAiInputCost" type="number" min="0" step="0.001" class="nav-settings-input" value="${navEscape(settings.inputCostPerMillionUsd)}" oninput="scheduleAiSettingsSave()">
                </label>
                <label class="nav-ai-field">
                    <span>${navEscape(navT('nav.ai.lblOutputCost'))}</span>
                    <input id="navAiOutputCost" type="number" min="0" step="0.001" class="nav-settings-input" value="${navEscape(settings.outputCostPerMillionUsd)}" oninput="scheduleAiSettingsSave()">
                </label>
                <label class="nav-ai-field">
                    <span>${navEscape(navT('nav.ai.lblUsdCny'))}</span>
                    <input id="navAiUsdToCny" type="number" min="0" step="0.01" class="nav-settings-input" value="${navEscape(settings.usdToCny)}" oninput="scheduleAiSettingsSave()">
                </label>
                <label class="nav-ai-field nav-ai-field-wide">
                    <span>${navEscape(navT('nav.ai.lblPrompt'))}</span>
                    <textarea id="navAiSystemPrompt" class="nav-ai-textarea" maxlength="5000" placeholder="${navEscape(navT('nav.ai.plhPrompt'))}" oninput="scheduleAiSettingsSave()">${navEscape(settings.systemPrompt || '')}</textarea>
                </label>
                <div class="nav-ai-field nav-ai-field-wide">
                    <button type="button" class="nav-settings-add" onclick="testAiSettingsNow()">${navEscape(navT('nav.ai.btnTest'))}</button>
                    <div id="navAiTestResult" class="nav-ai-test-result"></div>
                </div>
            </div>
        `;
    } catch (e) {
        content.innerHTML = `<div class="nav-settings-empty">${navEscape(navT('nav.ai.failLoad'))}${navEscape(e.message)}</div>`;
    }
}

function collectAiSettingsPayload(options = {}) {
    const tokenInput = document.getElementById('navAiApiKey');
    const payload = {
        provider: document.getElementById('navAiProvider')?.value || 'gemini',
        apiBaseUrl: document.getElementById('navAiApiBaseUrl')?.value || '',
        model: document.getElementById('navAiModel')?.value || 'gemini-2.5-flash',
        temperature: document.getElementById('navAiTemperature')?.value || 0.7,
        maxOutputTokens: document.getElementById('navAiMaxTokens')?.value || 2048,
        inputCostPerMillionUsd: document.getElementById('navAiInputCost')?.value || 0.075,
        outputCostPerMillionUsd: document.getElementById('navAiOutputCost')?.value || 0.3,
        usdToCny: document.getElementById('navAiUsdToCny')?.value || 7.2,
        systemPrompt: document.getElementById('navAiSystemPrompt')?.value || ''
    };
    const token = tokenInput ? tokenInput.value.trim() : '';
    if (token) payload.apiKey = token;
    if (options.clearApiKey) payload.clearApiKey = true;
    return payload;
}

window.handleAiProviderChange = function () {
    const provider = document.getElementById('navAiProvider')?.value || 'gemini';
    const modelInput = document.getElementById('navAiModel');
    const defaults = {
        gemini: 'gemini-2.5-flash',
        openai: 'gpt-4o-mini',
        anthropic: 'claude-3-5-sonnet-latest',
        'openai-compatible': 'gpt-4o-mini'
    };
    if (modelInput && defaults[provider]) {
        modelInput.value = defaults[provider];
    }
    scheduleAiSettingsSave();
};

window.testAiSettingsNow = async function () {
    const resultEl = document.getElementById('navAiTestResult');
    const indicator = document.getElementById('navSettingsSaveState');
    clearTimeout(navState.aiSaveTimer);
    if (resultEl) {
        resultEl.className = 'nav-ai-test-result testing';
        resultEl.textContent = navT('nav.ai.testing');
    }
    if (indicator) indicator.textContent = navT('nav.ai.testing');
    try {
        const res = await fetch('/api/ai-settings/test', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaderForNav()
            },
            body: JSON.stringify(collectAiSettingsPayload())
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            throw new Error(data.error || `HTTP ${res.status}`);
        }
        const reply = data.reply ? `：${data.reply}` : '';
        if (resultEl) {
            resultEl.className = 'nav-ai-test-result ok';
            resultEl.textContent = `${navT('nav.ai.testOk')}${reply}`;
        }
        if (indicator) indicator.textContent = navT('nav.ai.testOk');
    } catch (e) {
        if (resultEl) {
            resultEl.className = 'nav-ai-test-result fail';
            resultEl.textContent = `${navT('nav.ai.testFail')}${e.message}`;
        }
        if (indicator) indicator.textContent = `${navT('nav.ai.testFail')}${e.message}`;
    }
};

async function saveAiSettingsNow(options = {}) {
    const indicator = document.getElementById('navSettingsSaveState');
    if (indicator) indicator.textContent = navT('nav.ai.saving');
    const res = await fetch('/api/ai-settings', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaderForNav()
        },
        body: JSON.stringify(collectAiSettingsPayload(options))
    });
    if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
            const data = await res.json();
            if (data && data.error) message = data.error;
        } catch (e) { }
        throw new Error(message);
    }
    navState.aiSettings = await res.json();
    const tokenInput = document.getElementById('navAiApiKey');
    if (tokenInput) {
        tokenInput.value = '';
        tokenInput.placeholder = navState.aiSettings.hasApiKey
            ? `${navT('nav.ai.plhKeep')}${navState.aiSettings.maskedApiKey}`
            : navT('nav.ai.plhToken');
    }
    const status = document.querySelector('.nav-ai-status');
    if (status) {
        status.innerHTML = `
            <span>${navEscape(navT('nav.ai.sourcePrefix'))}${navEscape(sourceLabelForAiSettings(navState.aiSettings.apiKeySource))}</span>
            <span class="${navState.aiSettings.hasApiKey && !navState.aiSettings.keyLooksValid ? 'warning' : ''}">${navEscape(keyHealthLabelForAiSettings(navState.aiSettings))}</span>
        `;
    }
    if (indicator) indicator.textContent = navT('nav.ai.saved');
}

window.scheduleAiSettingsSave = function (options = {}) {
    const tokenInput = document.getElementById('navAiApiKey');
    if (tokenInput && tokenInput.value.trim() && !options.tokenTouched) {
        tokenInput.value = '';
        return;
    }
    const indicator = document.getElementById('navSettingsSaveState');
    if (indicator) indicator.textContent = navT('nav.ai.waitSave');
    clearTimeout(navState.aiSaveTimer);
    navState.aiSaveTimer = setTimeout(async () => {
        try {
            await saveAiSettingsNow();
        } catch (e) {
            if (indicator) indicator.textContent = navT('nav.set.saveFail') + e.message;
        }
    }, 700);
};

window.clearAiApiKey = async function () {
    try {
        clearTimeout(navState.aiSaveTimer);
        await saveAiSettingsNow({ clearApiKey: true });
    } catch (e) {
        const indicator = document.getElementById('navSettingsSaveState');
        if (indicator) indicator.textContent = `清除失败: ${e.message}`;
    }
};

function updaterStateLabel(state) {
    const key = `nav.up.state.${state || 'idle'}`;
    const label = navT(key);
    return label === key ? (state || 'idle') : label;
}

function setUpdaterBusy(isBusy) {
    document.querySelectorAll('[data-updater-action]').forEach(btn => {
        btn.disabled = Boolean(isBusy);
    });
}

function updateUpdaterPanel(status = navState.updaterStatus || {}) {
    navState.updaterStatus = status || {};
    const state = navState.updaterStatus.state || 'idle';
    const progress = Math.max(0, Math.min(100, Number(navState.updaterStatus.progress) || 0));
    const latest = navState.updaterStatus.latestVersion || '-';
    const message = navState.updaterStatus.message || updaterStateLabel(state);

    const latestEl = document.getElementById('navUpdaterLatest');
    const statusEl = document.getElementById('navUpdaterStatus');
    const progressEl = document.getElementById('navUpdaterProgress');
    const progressTextEl = document.getElementById('navUpdaterProgressText');
    const checkBtn = document.getElementById('navUpdaterCheckBtn');
    const downloadBtn = document.getElementById('navUpdaterDownloadBtn');
    const installBtn = document.getElementById('navUpdaterInstallBtn');

    if (latestEl) latestEl.textContent = latest;
    if (statusEl) statusEl.textContent = `${updaterStateLabel(state)} · ${message}`;
    if (progressEl) progressEl.style.width = `${progress}%`;
    if (progressTextEl) progressTextEl.textContent = `${Math.round(progress)}%`;

    const checking = state === 'checking';
    const downloading = state === 'downloading';
    if (checkBtn) checkBtn.disabled = checking || downloading;
    if (downloadBtn) downloadBtn.disabled = state !== 'available';
    if (installBtn) installBtn.disabled = state !== 'downloaded';
}

async function renderUpdaterSettings(content) {
    if (!window.ToolsUpdater) {
        content.innerHTML = `<div class="nav-settings-empty">${navEscape(navT('nav.up.unavailable'))}</div>`;
        return;
    }

    let versionInfo;
    let status;
    try {
        versionInfo = await window.ToolsUpdater.getVersion();
        status = await window.ToolsUpdater.getStatus();
    } catch (e) {
        content.innerHTML = `<div class="nav-settings-empty">${navEscape(e.message || navT('nav.up.unavailable'))}</div>`;
        return;
    }
    navState.updaterVersion = versionInfo;
    navState.updaterStatus = status;

    if (!navState.updaterUnsubscribe) {
        navState.updaterUnsubscribe = window.ToolsUpdater.onStatus((nextStatus) => {
            updateUpdaterPanel(nextStatus);
        });
    }

    content.innerHTML = `
        <div class="nav-settings-help">${navEscape(navT('nav.up.help'))}</div>
        <div class="nav-update-card">
            <div class="nav-update-grid">
                <div class="nav-update-field">
                    <span>${navEscape(navT('nav.up.current'))}</span>
                    <strong>${navEscape(versionInfo.version || '-')}</strong>
                </div>
                <div class="nav-update-field">
                    <span>${navEscape(navT('nav.up.latest'))}</span>
                    <strong id="navUpdaterLatest">${navEscape(status.latestVersion || '-')}</strong>
                </div>
                <div class="nav-update-field">
                    <span>${navEscape(navT('nav.up.packaged'))}</span>
                    <strong>${navEscape(versionInfo.packaged ? navT('nav.up.packagedYes') : navT('nav.up.packagedNo'))}</strong>
                </div>
            </div>
            <div class="nav-update-status">
                <span>${navEscape(navT('nav.up.status'))}</span>
                <strong id="navUpdaterStatus">${navEscape(updaterStateLabel(status.state))} · ${navEscape(status.message || '')}</strong>
            </div>
            <div class="nav-update-progress-row">
                <span>${navEscape(navT('nav.up.progress'))}</span>
                <div class="nav-update-progress">
                    <div id="navUpdaterProgress" style="width:${Math.max(0, Math.min(100, Number(status.progress) || 0))}%"></div>
                </div>
                <b id="navUpdaterProgressText">${Math.round(Number(status.progress) || 0)}%</b>
            </div>
            <div class="nav-backup-toolbar nav-update-actions">
                <button id="navUpdaterCheckBtn" data-updater-action="check" onclick="checkToolsUpdate()">${navEscape(navT('nav.up.btnCheck'))}</button>
                <button id="navUpdaterDownloadBtn" data-updater-action="download" onclick="downloadToolsUpdate()">${navEscape(navT('nav.up.btnDownload'))}</button>
                <button id="navUpdaterInstallBtn" data-updater-action="install" onclick="installToolsUpdate()">${navEscape(navT('nav.up.btnInstall'))}</button>
            </div>
        </div>
    `;
    updateUpdaterPanel(status);
}

window.checkToolsUpdate = async function () {
    if (!window.ToolsUpdater) return;
    setUpdaterBusy(true);
    try {
        updateUpdaterPanel(await window.ToolsUpdater.check());
    } catch (e) {
        updateUpdaterPanel({ state: 'error', message: e.message, progress: 0 });
    } finally {
        setUpdaterBusy(false);
        updateUpdaterPanel(navState.updaterStatus);
    }
};

window.downloadToolsUpdate = async function () {
    if (!window.ToolsUpdater) return;
    try {
        updateUpdaterPanel(await window.ToolsUpdater.download());
    } catch (e) {
        updateUpdaterPanel({ state: 'error', message: e.message, progress: 0 });
    }
};

window.installToolsUpdate = async function () {
    if (!window.ToolsUpdater) return;
    try {
        updateUpdaterPanel(await window.ToolsUpdater.install());
    } catch (e) {
        updateUpdaterPanel({ state: 'error', message: e.message, progress: 100 });
    }
};

function formatBackupSize(bytes) {
    const size = Number(bytes) || 0;
    if (size >= 1024 * 1024 * 1024) return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`;
    if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} MB`;
    if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${size} B`;
}

function formatBackupTime(value) {
    if (!value) return '-';
    try {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleString('zh-CN', {
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
        });
    } catch (e) {
        return value;
    }
}

function getLocalTimeZoneLabel() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || '浏览器本地时区';
    } catch (e) {
        return '浏览器本地时区';
    }
}

async function fetchBackupList() {
    const res = await fetch('/api/global-backup/list', { headers: getAuthHeaderForNav() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function fetchRemoteBackupSettings() {
    const res = await fetch('/api/global-backup/remote-settings', { headers: getAuthHeaderForNav() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function fetchScheduleBackupSettings() {
    const res = await fetch('/api/global-backup/schedule-settings', { headers: getAuthHeaderForNav() });
    if (res.status === 404) {
        return {
            enabled: true,
            time: '02:00',
            retentionDays: 90,
            nextRunAt: null,
            lastSuccessAt: null,
            lastBackupName: '',
            lastError: '定时备份接口未加载，请重启后端服务。'
        };
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

function renderScheduleBackupSettings(settings = {}) {
    const nextRunText = settings.enabled
        ? formatBackupTime(settings.nextRunAt)
        : navT('nav.bk.scheduleDisabled');
    const lastSuccessText = settings.lastSuccessAt
        ? formatBackupTime(settings.lastSuccessAt)
        : navT('nav.bk.scheduleNotRun');
    return `
        <div class="nav-schedule-backup-card">
            <div class="nav-remote-backup-head">
                <div>
                    <div class="nav-backup-panel-title">${navEscape(navT('nav.bk.scheduleTitle'))}</div>
                    <div class="nav-backup-panel-desc">${navEscape(navT('nav.bk.scheduleDesc'))}</div>
                </div>
                <label class="nav-remote-switch">
                    <input id="scheduleBackupEnabled" type="checkbox" ${settings.enabled !== false ? 'checked' : ''} onchange="scheduleBackupSettingsSave()">
                    ${navEscape(navT('nav.bk.scheduleEnabled'))}
                </label>
            </div>
            <div class="nav-schedule-backup-grid">
                <label>
                    <span>${navEscape(navT('nav.bk.scheduleTime'))}</span>
                    <input id="scheduleBackupTime" type="time" class="nav-settings-input" value="${navEscape(settings.time || '02:00')}" oninput="scheduleBackupSettingsSave()">
                </label>
                <label>
                    <span>${navEscape(navT('nav.bk.scheduleRetention'))}</span>
                    <div class="nav-schedule-retention-row">
                        <input id="scheduleBackupRetentionDays" type="number" min="1" max="3650" step="1" class="nav-settings-input" value="${navEscape(settings.retentionDays || 90)}" oninput="scheduleBackupSettingsSave()">
                        <em>${navEscape(navT('nav.bk.scheduleDays'))}</em>
                    </div>
                </label>
                <div class="nav-backup-toolbar nav-remote-backup-actions">
                    <button type="button" onclick="runScheduledBackupNow()">${navEscape(navT('nav.bk.scheduleRun'))}</button>
                </div>
            </div>
            <div class="nav-remote-backup-status">
                <span>${navEscape(navT('nav.bk.scheduleNext'))}${navEscape(nextRunText)}</span>
                <span>${navEscape(navT('nav.bk.scheduleLast'))}${navEscape(lastSuccessText)}</span>
                ${settings.lastBackupName ? `<span>${navEscape(navT('nav.bk.scheduleLastFile'))}${navEscape(settings.lastBackupName)}</span>` : ''}
                ${settings.lastError ? `<span class="warning">${navEscape(navT('nav.bk.scheduleError'))}${navEscape(settings.lastError)}</span>` : ''}
            </div>
        </div>
    `;
}

function renderRemoteBackupSyncSettings(settings = {}) {
    const lastSync = settings.lastSync || {};
    const lastRemote = lastSync.remoteBackup || {};
    const lastCheck = settings.lastCheck || {};
    const checkLatest = lastCheck.latest || {};
    const lastSyncText = lastSync.restoredAt
        ? `${formatBackupTime(lastSync.restoredAt)} · ${lastRemote.name || '-'}`
        : '尚未恢复远端备份';
    const lastCheckText = lastCheck.checkedAt
        ? `${formatBackupTime(lastCheck.checkedAt)} · 最新：${checkLatest.name || '-'}`
        : '尚未检查远端';
    return `
        <div class="nav-remote-backup-card">
            <div class="nav-remote-backup-head">
                <div>
                    <div class="nav-backup-panel-title">${navEscape(navT('nav.bk.remoteTitle'))}</div>
                    <div class="nav-backup-panel-desc">${navEscape(navT('nav.bk.remoteDesc'))}</div>
                </div>
                <label class="nav-remote-switch">
                    <input id="remoteBackupEnabled" type="checkbox" ${settings.enabled ? 'checked' : ''} onchange="scheduleRemoteBackupSettingsSave()">
                    ${navEscape(navT('nav.bk.enable'))}
                </label>
            </div>
            <div class="nav-remote-backup-grid">
                <label>
                    <span>${navEscape(navT('nav.bk.remoteDomain'))}</span>
                    <input id="remoteBackupBaseUrl" class="nav-settings-input" value="${navEscape(settings.baseUrl || '')}" placeholder="例如：https://cs.fanxiaolong.uk" oninput="scheduleRemoteBackupSettingsSave()">
                </label>
                <label>
                    <span>${navEscape(navT('nav.bk.remoteUser'))}</span>
                    <input id="remoteBackupUsername" class="nav-settings-input" value="${navEscape(settings.username || '')}" autocomplete="username" oninput="scheduleRemoteBackupSettingsSave()">
                </label>
                <label>
                    <span>${navEscape(navT('nav.bk.remotePwd'))}</span>
                    <input id="remoteBackupPassword" type="password" class="nav-settings-input" autocomplete="new-password" data-lpignore="true" data-1p-ignore="true" placeholder="${settings.hasPassword ? `留空保持当前：${navEscape(settings.maskedPassword || '已保存')}` : navEscape(navT('nav.bk.plhPwd'))}" onfocus="this.dataset.userTouched='1'" oninput="scheduleRemoteBackupSettingsSave({ passwordTouched: this.dataset.userTouched === '1' })">
                </label>
                <div class="nav-remote-checks">
                    <label><input id="remoteBackupCompare" type="checkbox" ${settings.compareBeforeRestore !== false ? 'checked' : ''} onchange="scheduleRemoteBackupSettingsSave()"> ${navEscape(navT('nav.bk.optCompare'))}</label>
                    <label><input id="remoteBackupCreateBeforePull" type="checkbox" ${settings.createRemoteBackupBeforePull !== false ? 'checked' : ''} onchange="scheduleRemoteBackupSettingsSave()"> ${navEscape(navT('nav.bk.optPull'))}</label>
                    <label><input id="remoteBackupAutoRestore" type="checkbox" ${settings.autoRestore ? 'checked' : ''} onchange="scheduleRemoteBackupSettingsSave()"> ${navEscape(navT('nav.bk.optAuto'))}</label>
                </div>
            </div>
            <div class="nav-remote-backup-status">
                <span>${navEscape(navT('nav.bk.stLocal', { tz: getLocalTimeZoneLabel() }))}</span>
                <span>${navEscape(navT('nav.bk.stCheck'))}${navEscape(lastCheckText)}</span>
                <span>${navEscape(navT('nav.bk.stSync'))}${navEscape(lastSyncText)}</span>
                ${settings.lastError ? `<span class="warning">${navEscape(navT('nav.bk.stError'))}${navEscape(settings.lastError)}</span>` : ''}
            </div>
            <div class="nav-backup-toolbar nav-remote-backup-actions">
                <button type="button" onclick="checkRemoteBackupNow()">${navEscape(navT('nav.bk.btnCheck'))}</button>
                <button type="button" onclick="pullRemoteBackupNow(false)">${navEscape(navT('nav.bk.btnPull'))}</button>
                <button type="button" class="danger" onclick="pullRemoteBackupNow(true)">${navEscape(navT('nav.bk.btnForce'))}</button>
                <button type="button" onclick="clearRemoteBackupPassword()">${navEscape(navT('nav.bk.btnClearPwd'))}</button>
            </div>
        </div>
    `;
}

async function renderBackupSettings(content) {
    content.innerHTML = `<div class="nav-settings-empty">${navEscape(navT('nav.bk.empty'))}</div>`;
    try {
        const [data, remoteSettings, scheduleSettings] = await Promise.all([
            fetchBackupList(),
            fetchRemoteBackupSettings(),
            fetchScheduleBackupSettings()
        ]);
        navState.remoteBackupSettings = remoteSettings;
        navState.scheduleBackupSettings = scheduleSettings;
        const targetText = (data.targets || []).map(item => item.relPath || item.path).join('、') || 'backend/data、data';
        const rows = (data.backups || []).map(item => `
            <tr>
                <td>
                    <div class="nav-backup-name">
                        ${navEscape(item.name)}
                        ${item.triggerType === 'remote-sync-request' ? `<span class="nav-backup-badge remote">${navEscape(navT('nav.bk.badgeSync'))}</span>` : ''}
                        ${item.triggerType === 'pre-restore' ? `<span class="nav-backup-badge safety">${navEscape(navT('nav.bk.badgeSafe'))}</span>` : ''}
                        ${item.triggerType === 'scheduled-auto' ? `<span class="nav-backup-badge automatic">${navEscape(navT('nav.bk.badgeAuto'))}</span>` : ''}
                    </div>
                    <div class="nav-backup-meta">${formatBackupTime(item.modifiedAt)} · ${formatBackupSize(item.size)}</div>
                    ${item.reason ? `<div class="nav-backup-meta">Reason: ${navEscape(item.reason)}</div>` : ''}
                </td>
                <td class="nav-backup-actions" style="display:flex; gap:6px; justify-content:flex-end;">
                    <button onclick="downloadGlobalBackup('${navEscape(item.name)}')" title="${navEscape(navT('nav.bk.dlTitle'))}" style="padding:4px 8px; font-size:13px; min-width:auto;">⬇️</button>
                    <button class="danger" onclick="restoreGlobalBackupFromServer('${navEscape(item.name)}')" title="${navEscape(navT('nav.bk.rsTitle'))}" style="padding:4px 8px; font-size:13px; min-width:auto;">⏪</button>
                    <button class="danger" style="background:#fff3e0; color:#e65100; border-color:#ffe0b2; padding:4px 8px; font-size:13px; min-width:auto;" onclick="deleteGlobalBackup('${navEscape(item.name)}')" title="${navEscape(navT('nav.bk.delTitle'))}">🗑️</button>
                </td>
            </tr>
        `).join('');

        content.innerHTML = `
            <div class="nav-settings-help">${navEscape(navT('nav.bk.help', { target: targetText }))}</div>
            ${renderScheduleBackupSettings(scheduleSettings)}
            ${renderRemoteBackupSyncSettings(remoteSettings)}
            <div class="nav-backup-panel">
                <div>
                    <div class="nav-backup-panel-title">${navEscape(navT('nav.bk.svrTitle'))}</div>
                    <div class="nav-backup-panel-desc">${navEscape(navT('nav.bk.svrDesc'))}</div>
                </div>
                <div class="nav-backup-toolbar">
                    <button onclick="createGlobalBackup(false)">${navEscape(navT('nav.bk.btnCreate'))}</button>
                    <button onclick="createGlobalBackup(true)">${navEscape(navT('nav.bk.btnCreateDL'))}</button>
                </div>
            </div>
            <div class="nav-backup-upload">
                <div>
                    <div class="nav-backup-panel-title">${navEscape(navT('nav.bk.upTitle'))}</div>
                    <div class="nav-backup-panel-desc">${navEscape(navT('nav.bk.upDesc'))}</div>
                </div>
                <input id="globalBackupUploadInput" type="file" accept=".zip,application/zip">
                <button class="danger" onclick="restoreGlobalBackupFromUpload()">${navEscape(navT('nav.bk.btnUp'))}</button>
            </div>
            <div class="nav-account-table-wrap">
                <table class="nav-account-table nav-backup-table">
                    <thead><tr><th>${navEscape(navT('nav.bk.thFile'))}</th><th>${navEscape(navT('nav.bk.thAction'))}</th></tr></thead>
                    <tbody>${rows || `<tr><td colspan="2">${navEscape(navT('nav.bk.noData'))}</td></tr>`}</tbody>
                </table>
            </div>
        `;
    } catch (e) {
        content.innerHTML = `<div class="nav-settings-empty">${navEscape(navT('nav.bk.fail'))}${navEscape(e.message)}</div>`;
    }
}

function collectRemoteBackupSettings(options = {}) {
    const passwordInput = document.getElementById('remoteBackupPassword');
    const payload = {
        enabled: Boolean(document.getElementById('remoteBackupEnabled')?.checked),
        baseUrl: document.getElementById('remoteBackupBaseUrl')?.value || '',
        username: document.getElementById('remoteBackupUsername')?.value || '',
        compareBeforeRestore: Boolean(document.getElementById('remoteBackupCompare')?.checked),
        createRemoteBackupBeforePull: Boolean(document.getElementById('remoteBackupCreateBeforePull')?.checked),
        autoRestore: Boolean(document.getElementById('remoteBackupAutoRestore')?.checked)
    };
    if (options.clearPassword) {
        payload.clearPassword = true;
    } else if (options.passwordTouched && passwordInput) {
        payload.password = passwordInput.value || '';
    }
    return payload;
}

function collectScheduleBackupSettings() {
    return {
        enabled: Boolean(document.getElementById('scheduleBackupEnabled')?.checked),
        time: document.getElementById('scheduleBackupTime')?.value || '02:00',
        retentionDays: parseInt(document.getElementById('scheduleBackupRetentionDays')?.value || '90', 10)
    };
}

async function saveScheduleBackupSettingsNow() {
    const res = await fetch('/api/global-backup/schedule-settings', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaderForNav()
        },
        body: JSON.stringify(collectScheduleBackupSettings())
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    navState.scheduleBackupSettings = data;
    const indicator = document.getElementById('navSettingsSaveState');
    if (indicator) indicator.textContent = navT('nav.bk.scheduleSaved');
    return data;
}

window.scheduleBackupSettingsSave = function () {
    const indicator = document.getElementById('navSettingsSaveState');
    if (indicator) indicator.textContent = navT('nav.bk.scheduleSaving');
    clearTimeout(navState.scheduleBackupSaveTimer);
    navState.scheduleBackupSaveTimer = setTimeout(async () => {
        try {
            await saveScheduleBackupSettingsNow();
        } catch (e) {
            if (indicator) indicator.textContent = `${navT('nav.set.saveFail')}${e.message}`;
        }
    }, 650);
};

window.runScheduledBackupNow = async function () {
    clearTimeout(navState.scheduleBackupSaveTimer);
    await saveScheduleBackupSettingsNow();
    await runGlobalBackupAction('正在执行定时备份...', async () => {
        const res = await fetch('/api/global-backup/schedule-run', {
            method: 'POST',
            headers: getAuthHeaderForNav()
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        return data;
    });
    renderNavSettingsContent();
};

async function saveRemoteBackupSettingsNow(options = {}) {
    const res = await fetch('/api/global-backup/remote-settings', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaderForNav()
        },
        body: JSON.stringify(collectRemoteBackupSettings(options))
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    navState.remoteBackupSettings = data;
    const indicator = document.getElementById('navSettingsSaveState');
    if (indicator) indicator.textContent = '远端同步设置已保存';
    return data;
}

window.scheduleRemoteBackupSettingsSave = function (options = {}) {
    const indicator = document.getElementById('navSettingsSaveState');
    if (indicator) indicator.textContent = '正在保存远端同步设置...';
    clearTimeout(navState.remoteBackupSaveTimer);
    navState.remoteBackupSaveTimer = setTimeout(async () => {
        try {
            await saveRemoteBackupSettingsNow(options);
        } catch (e) {
            if (indicator) indicator.textContent = `保存失败: ${e.message}`;
        }
    }, 650);
};

window.clearRemoteBackupPassword = async function () {
    await runGlobalBackupAction('正在清除远端密码...', async () => {
        await saveRemoteBackupSettingsNow({ clearPassword: true });
    });
    renderNavSettingsContent();
};

window.checkRemoteBackupNow = async function () {
    clearTimeout(navState.remoteBackupSaveTimer);
    await saveRemoteBackupSettingsNow();
    const result = await runGlobalBackupAction('正在检查远端备份...', async () => {
        const res = await fetch('/api/global-backup/remote-check', {
            method: 'POST',
            headers: getAuthHeaderForNav()
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        return data;
    });
    const latest = result.latest || {};
    alert(`远端连接成功。\n\n${result.remoteCreatedBackup?.name ? `已请求主站生成新备份：${result.remoteCreatedBackup.name}\n` : ''}备份数量：${result.backups?.length || 0}\n最新备份：${latest.name || '-'}\n时间：${formatBackupTime(latest.modifiedAt || latest.createdAt)}`);
    renderNavSettingsContent();
};

window.pullRemoteBackupNow = async function (force) {
    clearTimeout(navState.remoteBackupSaveTimer);
    await saveRemoteBackupSettingsNow();
    const ok = confirm(`${force ? '确定要强制恢复远端最新备份吗？' : '确定要按规则拉取并恢复远端备份吗？'}\n\n此操作会覆盖当前全部本地数据。恢复成功后服务会自动重启或需要手动重启。`);
    if (!ok) return;
    await runGlobalBackupAction('正在拉取远端备份并恢复...', async () => {
        const res = await fetch('/api/global-backup/remote-pull', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaderForNav()
            },
            body: JSON.stringify({ restore: true, force })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        if (data.restored) {
            alert(`远端备份恢复完成：${data.latest?.name || '-'}\n\n服务将自动重启；如果是手动 npm start，请重新启动服务。`);
        } else {
            alert(data.message || '远端备份未更新，未执行恢复。');
        }
        return data;
    });
};

async function runGlobalBackupAction(actionText, action) {
    const indicator = document.getElementById('navSettingsSaveState');
    if (indicator) indicator.textContent = actionText;
    try {
        const result = await action();
        if (indicator) indicator.textContent = '操作完成';
        if (document.getElementById('backupOperationConsole')) {
            appendBackupConsoleEntry('客户端已收到服务端完成响应', 'success');
            setBackupConsoleProgress(100, 'COMPLETED');
        }
        return result;
    } catch (e) {
        if (indicator) indicator.textContent = `操作失败: ${e.message}`;
        if (document.getElementById('backupOperationConsole')) {
            appendBackupConsoleEntry(`操作失败：${e.message}`, 'error');
            setBackupConsoleProgress(100, 'FAILED');
        }
        alert(`操作失败：${e.message}`);
        throw e;
    }
}

let backupConsolePollTimer = null;
let backupConsoleSeenEntries = 0;

function createBackupOperationId() {
    return `backup_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function ensureBackupOperationConsole(title = '备份任务控制台') {
    let panel = document.getElementById('backupOperationConsole');
    if (!panel) {
        panel = document.createElement('aside');
        panel.id = 'backupOperationConsole';
        panel.className = 'backup-operation-console';
        panel.innerHTML = `
            <div class="backup-console-head">
                <div>
                    <div class="backup-console-kicker">TOOLS PLATFORM · DATA OPS</div>
                    <strong id="backupConsoleTitle"></strong>
                </div>
                <div class="backup-console-actions">
                    <button type="button" onclick="toggleBackupOperationConsole()" title="折叠/展开">−</button>
                    <button type="button" onclick="clearBackupOperationConsole()" title="关闭">×</button>
                </div>
            </div>
            <div class="backup-console-progress"><span id="backupConsoleProgress"></span></div>
            <div class="backup-console-body" id="backupConsoleBody"></div>
            <div class="backup-console-foot"><span class="backup-console-pulse"></span><span id="backupConsoleStatus">READY</span></div>
        `;
        document.body.appendChild(panel);
    }
    panel.classList.remove('collapsed');
    document.getElementById('backupConsoleTitle').textContent = title;
    return panel;
}

function appendBackupConsoleEntry(message, level = 'info', detail = null, timestamp = null) {
    ensureBackupOperationConsole();
    const body = document.getElementById('backupConsoleBody');
    const row = document.createElement('div');
    row.className = `backup-console-entry ${level}`;
    const time = timestamp ? new Date(timestamp) : new Date();
    const timeText = Number.isNaN(time.getTime())
        ? '--:--:--'
        : time.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    row.innerHTML = `
        <span class="backup-console-time">${navEscape(timeText)}</span>
        <span class="backup-console-dot"></span>
        <span class="backup-console-message">${navEscape(message)}</span>
        ${detail ? `<code>${navEscape(typeof detail === 'string' ? detail : JSON.stringify(detail))}</code>` : ''}
    `;
    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
}

function setBackupConsoleProgress(percent, status) {
    const bar = document.getElementById('backupConsoleProgress');
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, Number(percent) || 0))}%`;
    const statusEl = document.getElementById('backupConsoleStatus');
    if (statusEl && status) statusEl.textContent = status;
}

function stopBackupConsolePolling() {
    if (backupConsolePollTimer) {
        clearTimeout(backupConsolePollTimer);
        backupConsolePollTimer = null;
    }
}

async function pollBackupOperation(operationId) {
    stopBackupConsolePolling();
    try {
        const res = await fetch(`/api/global-backup/operations/${encodeURIComponent(operationId)}`, {
            headers: getAuthHeaderForNav()
        });
        if (res.ok) {
            const operation = await res.json();
            const entries = Array.isArray(operation.entries) ? operation.entries : [];
            entries.slice(backupConsoleSeenEntries).forEach(entry => {
                appendBackupConsoleEntry(entry.message, entry.level, entry.detail, entry.timestamp);
            });
            backupConsoleSeenEntries = entries.length;
            setBackupConsoleProgress(operation.status === 'completed' ? 100 : operation.status === 'failed' ? 100 : 72, operation.status.toUpperCase());
            if (operation.status === 'completed' || operation.status === 'failed') return;
        }
    } catch (e) {
        // The service may be restarting after a successful restore.
    }
    backupConsolePollTimer = setTimeout(() => pollBackupOperation(operationId), 650);
}

function startBackupOperationConsole(title) {
    stopBackupConsolePolling();
    ensureBackupOperationConsole(title);
    document.getElementById('backupConsoleBody').innerHTML = '';
    backupConsoleSeenEntries = 0;
    setBackupConsoleProgress(4, 'STARTING');
    const operationId = createBackupOperationId();
    appendBackupConsoleEntry('任务已创建，正在连接服务端', 'info');
    pollBackupOperation(operationId);
    return operationId;
}

window.toggleBackupOperationConsole = function () {
    document.getElementById('backupOperationConsole')?.classList.toggle('collapsed');
};

window.clearBackupOperationConsole = function () {
    stopBackupConsolePolling();
    document.getElementById('backupOperationConsole')?.remove();
};

window.createGlobalBackup = async function (downloadAfterCreate) {
    const operationId = startBackupOperationConsole('生成全局备份');
    const result = await runGlobalBackupAction('正在生成备份...', async () => {
        const res = await fetch('/api/global-backup/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Backup-Operation-Id': operationId,
                ...getAuthHeaderForNav()
            },
            body: JSON.stringify({ reason: 'manual' })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    });
    if (downloadAfterCreate && result?.name) {
        await downloadGlobalBackupFile(result.name);
    }
    renderNavSettingsContent();
};

async function downloadGlobalBackupFile(name) {
    ensureBackupOperationConsole('下载备份包');
    appendBackupConsoleEntry(`开始下载：${name}`);
    const res = await fetch(`/api/global-backup/download/${encodeURIComponent(name)}`, {
        headers: getAuthHeaderForNav()
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentLength = res.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    let loaded = 0;
    const reader = res.body.getReader();
    const chunks = [];
    const indicator = document.getElementById('navSettingsSaveState');

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        if (indicator) {
            if (total) {
                const percent = Math.round((loaded / total) * 100);
                indicator.textContent = `正在下载... ${percent}% (${formatBackupSize(loaded)} / ${formatBackupSize(total)})`;
                setBackupConsoleProgress(percent, `DOWNLOADING ${percent}%`);
            } else {
                indicator.textContent = `正在下载... 已接收 ${formatBackupSize(loaded)}`;
            }
        }
    }

    const blob = new Blob(chunks, { type: res.headers.get('content-type') || 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    appendBackupConsoleEntry(`下载完成：${formatBackupSize(loaded)}`, 'success');
    setBackupConsoleProgress(100, 'COMPLETED');
}

window.downloadGlobalBackup = async function (name) {
    await runGlobalBackupAction('正在下载备份...', () => downloadGlobalBackupFile(name));
};

window.deleteGlobalBackup = async function (name) {
    const ok = confirm(`确定要永久删除备份文件吗？\n\n${name}`);
    if (!ok) return;
    await runGlobalBackupAction('正在删除备份...', async () => {
        const res = await fetch(`/api/global-backup/delete/${encodeURIComponent(name)}`, {
            method: 'DELETE',
            headers: getAuthHeaderForNav()
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        return data;
    });
    renderNavSettingsContent();
};

function getGlobalRestoreCompletionMessage(data = {}) {
    const missing = Array.isArray(data.missingTargets) ? data.missingTargets : [];
    const partialText = data.partialRestore
        ? `\n\n注意：这是旧版或不完整备份，未包含：${missing.join('、')}。对应的现有数据未被覆盖。`
        : '';
    return `恢复完成。恢复前安全备份：${data.safetyBackup?.name || '-'}${partialText}\n\n建议重启服务或刷新页面，确保 SQLite 连接重新加载。`;
}

window.restoreGlobalBackupFromServer = async function (name) {
    const ok = confirm(`确定要从服务器备份恢复吗？\n\n${name}\n\n此操作会覆盖当前全局配置和全部数据。系统会先自动生成恢复前安全备份。`);
    if (!ok) return;
    const operationId = startBackupOperationConsole('恢复服务器备份');
    await runGlobalBackupAction('正在从服务器备份恢复...', async () => {
        const res = await fetch(`/api/global-backup/restore/server/${encodeURIComponent(name)}`, {
            method: 'POST',
            headers: {
                'X-Backup-Operation-Id': operationId,
                ...getAuthHeaderForNav()
            }
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        alert(getGlobalRestoreCompletionMessage(data));
        return data;
    });
    renderNavSettingsContent();
};

window.restoreGlobalBackupFromUpload = async function () {
    const input = document.getElementById('globalBackupUploadInput');
    const file = input && input.files && input.files[0];
    if (!file) return alert('请先选择备份 zip 包');
    const ok = confirm(`确定要上传并恢复这个备份包吗？\n\n${file.name}\n\n此操作会覆盖当前全局配置和全部数据。系统会先自动生成恢复前安全备份。`);
    if (!ok) return;
    const operationId = startBackupOperationConsole('上传并恢复备份');
    appendBackupConsoleEntry(`已选择文件：${file.name}`, 'info', { size: formatBackupSize(file.size) });

    const indicator = document.getElementById('navSettingsSaveState');
    if (indicator) indicator.textContent = '准备上传备份...';

    try {
        const data = await new Promise((resolve, reject) => {
            const form = new FormData();
            form.append('backup', file);
            let uploadCompleteLogged = false;

            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/global-backup/restore/upload', true);

            const headers = getAuthHeaderForNav();
            Object.keys(headers).forEach(key => {
                xhr.setRequestHeader(key, headers[key]);
            });
            xhr.setRequestHeader('X-Backup-Operation-Id', operationId);

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable && indicator) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    indicator.textContent = `正在上传并解压... ${percent}% (${formatBackupSize(e.loaded)} / ${formatBackupSize(e.total)})`;
                    setBackupConsoleProgress(Math.min(45, Math.round(percent * 0.45)), `UPLOADING ${percent}%`);
                    if (percent === 100 && !uploadCompleteLogged) {
                        uploadCompleteLogged = true;
                        appendBackupConsoleEntry('上传完成，服务端开始校验和恢复', 'success');
                    }
                }
            };

            xhr.onload = () => {
                let resData = {};
                try { resData = JSON.parse(xhr.responseText); } catch (err) { }
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(resData);
                } else {
                    reject(new Error(resData.error || `HTTP ${xhr.status}`));
                }
            };

            xhr.onerror = () => reject(new Error('网络请求失败'));
            xhr.send(form);
        });

        if (indicator) indicator.textContent = '操作完成';
        appendBackupConsoleEntry('客户端已收到恢复完成响应', 'success');
        setBackupConsoleProgress(100, 'COMPLETED');
        alert(getGlobalRestoreCompletionMessage(data));
    } catch (e) {
        if (indicator) indicator.textContent = `操作失败: ${e.message}`;
        appendBackupConsoleEntry(`恢复失败：${e.message}`, 'error');
        setBackupConsoleProgress(100, 'FAILED');
        alert(`操作失败：${e.message}`);
    }
    renderNavSettingsContent();
};

function renderPageSettings(content, pageId) {
    if (pageId === 'home') return renderHomePageSettings(content);
    if (pageId === 'report') return renderReportPageSettings(content);
    const item = NAV_BUILTIN_LINKS.find(link => link.id === pageId);
    content.innerHTML = `
        <div class="nav-page-config-placeholder">
            <div class="nav-page-config-icon">${item?.icon || '🧩'}</div>
            <div>
                <div class="nav-page-config-title">${navEscape(navT('nav.page.placeholderTitle', { page: getNavLabel(item) || '页面' }))}</div>
                <div class="nav-page-config-desc">${navEscape(navT('nav.page.placeholderDesc'))}</div>
            </div>
        </div>
    `;
}

function renderHomePageSettings(content) {
    const tools = Array.isArray(navState.customTools) ? navState.customTools : [];
    content.innerHTML = `
        <div class="nav-settings-help">${navEscape(navT('nav.page.home.help'))}</div>
        <div class="nav-settings-list">
            ${tools.map(tool => `
                <div class="nav-settings-row">
                    <div class="nav-settings-item-name">
                        ${navEscape(tool.icon || '🧩')} ${navEscape(tool.name || tool.slug)}
                        <div style="font-size:11px;color:#7b8794;font-weight:500;margin-top:4px;">/custom-tools/${navEscape(tool.slug)}/index.html</div>
                    </div>
                    <label class="nav-settings-check" style="margin-left:auto;">
                        <input type="checkbox" ${tool.publicAccess === true ? 'checked' : ''} onchange="setCustomToolPublicAccess('${navEscape(tool.slug)}', this.checked, this)">
                        <span>${navEscape(tool.publicAccess === true ? navT('nav.page.home.public') : navT('nav.page.home.private'))}</span>
                    </label>
                </div>
            `).join('') || `<div class="nav-settings-empty">${navEscape(navT('nav.page.home.empty'))}</div>`}
        </div>
    `;
}

window.setCustomToolPublicAccess = async function (slug, publicAccess, checkbox) {
    const indicator = document.getElementById('navSettingsSaveState');
    if (indicator) indicator.textContent = navT('nav.set.saving');
    if (checkbox) checkbox.disabled = true;
    try {
        const res = await fetch(`/api/custom-tools/${encodeURIComponent(slug)}/access`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaderForNav() },
            body: JSON.stringify({ publicAccess })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        const index = navState.customTools.findIndex(item => item.slug === slug);
        if (index >= 0) navState.customTools[index] = data.tool;
        if (indicator) indicator.textContent = navT('nav.set.saved');
        renderHomePageSettings(document.getElementById('navSettingsContent'));
    } catch (err) {
        if (checkbox) checkbox.checked = !publicAccess;
        if (indicator) indicator.textContent = navT('nav.set.saveFail') + err.message;
    } finally {
        if (checkbox) checkbox.disabled = false;
    }
};

function renderReportPageSettings(content) {
    content.innerHTML = `
        <div class="nav-settings-help">${navEscape(navT('nav.page.report.help'))}</div>
        <div class="nav-report-cleanup-card">
            <div class="nav-report-cleanup-main">
                <div class="nav-backup-panel-title">${navEscape(navT('nav.page.report.title'))}</div>
                <div class="nav-backup-panel-desc">${navEscape(navT('nav.page.report.desc'))}</div>
                <label class="nav-report-cleanup-field">
                    <span>${navEscape(navT('nav.page.report.cleanLast'))}</span>
                    <input id="reportSnapshotCleanupDays" type="number" min="1" max="3650" step="1" value="30">
                    <span>${navEscape(navT('nav.page.report.days'))}</span>
                </label>
            </div>
            <div class="nav-backup-toolbar">
                <button onclick="previewReportSnapshotCleanup()">${navEscape(navT('nav.page.report.btnPreview'))}</button>
                <button class="danger" onclick="runReportSnapshotCleanup()">${navEscape(navT('nav.page.report.btnRun'))}</button>
            </div>
        </div>
        <div id="reportSnapshotCleanupResult" class="nav-report-cleanup-result">${navEscape(navT('nav.page.report.wait'))}</div>
    `;
}

function getReportSnapshotCleanupDays() {
    const input = document.getElementById('reportSnapshotCleanupDays');
    return Math.max(1, Math.min(3650, parseInt(input?.value, 10) || 30));
}

function renderReportSnapshotCleanupResult(result) {
    const el = document.getElementById('reportSnapshotCleanupResult');
    if (!el) return;
    const removedPreview = (result.removed || []).slice(0, 8)
        .map(item => `<li>${navEscape(item.date || '-')} · ${navEscape(item.timestamp || '-')} · ${navEscape(item.id || '-')}</li>`)
        .join('');
    const titleText = result.dryRun ? navT('nav.page.report.res.preview') : navT('nav.page.report.res.done');
    const summaryText = navT('nav.page.report.res.summary', { days: result.days, beforeCount: result.beforeCount, afterCount: result.afterCount, removedCount: result.removedCount })
        .replace('{days}', result.days).replace('{beforeCount}', result.beforeCount).replace('{afterCount}', result.afterCount).replace('{removedCount}', result.removedCount);
    const keptText = navT('nav.page.report.res.kept', { keptDailyCount: result.keptDailyCount }).replace('{keptDailyCount}', result.keptDailyCount);
    const emptyText = navT('nav.page.report.res.empty');
    const moreText = result.removedCount > 8 ? navT('nav.page.report.res.more', { remaining: result.removedCount - 8 }).replace('{remaining}', result.removedCount - 8) : '';

    el.innerHTML = `
        <div><strong>${navEscape(titleText)}</strong></div>
        <div>${navEscape(summaryText)}</div>
        <div>${navEscape(keptText)}</div>
        ${removedPreview ? `<ul>${removedPreview}</ul>` : `<div>${navEscape(emptyText)}</div>`}
        ${moreText ? `<div>${navEscape(moreText)}</div>` : ''}
    `;
}

async function requestReportSnapshotCleanup(dryRun) {
    const res = await fetch('/api/sla/snapshots/cleanup-redundant', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaderForNav()
        },
        body: JSON.stringify({
            days: getReportSnapshotCleanupDays(),
            dryRun
        })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}

window.previewReportSnapshotCleanup = async function () {
    await runGlobalBackupAction('正在预览快照清理...', async () => {
        const result = await requestReportSnapshotCleanup(true);
        renderReportSnapshotCleanupResult(result);
        return result;
    });
};

window.runReportSnapshotCleanup = async function () {
    const days = getReportSnapshotCleanupDays();
    const preview = await requestReportSnapshotCleanup(true);
    renderReportSnapshotCleanupResult(preview);
    if (!preview.removedCount) return alert('没有需要清理的冗余快照。');
    const ok = confirm(`确定清理最近 ${days} 天内的 ${preview.removedCount} 条冗余快照吗？\n\n规则：每天只保留最新一份快照。`);
    if (!ok) return;
    await runGlobalBackupAction('正在清理冗余快照...', async () => {
        const result = await requestReportSnapshotCleanup(false);
        renderReportSnapshotCleanupResult(result);
        return result;
    });
};

function formatAlertTime(value) {
    if (!value) return '-';
    const raw = String(value).trim();
    // SQLite CURRENT_TIMESTAMP is UTC but omits the timezone suffix.
    // Mark timezone-less database timestamps as UTC before formatting with
    // local Date getters, so each browser sees its own local time.
    const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(raw)
        ? `${raw.replace(' ', 'T')}Z`
        : raw;
    const d = new Date(normalized);
    if (Number.isNaN(d.getTime())) return value || '-';
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function alertTypeLabel(type) {
    if (type === 'config') return navT('nav.alert.config');
    if (type === 'security') return navT('nav.alert.security');
    if (type === 'user_action') return navT('nav.alert.userAction');
    if (type === 'alert') return navT('nav.alertCenter');
    return navT('nav.alert.system');
}

function severityLabel(severity) {
    return ({ info: 'Info', warn: 'Warn', error: 'Error', critical: 'Critical' })[severity] || 'Info';
}

async function fetchAlertCenterSummary() {
    const res = await fetch('/api/alert-center/summary', { headers: getAuthHeaderForNav() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function fetchAlertCenterEvents(filter = navState.alertCenter.filter) {
    const params = new URLSearchParams({ limit: '120' });
    if (filter === 'unread') params.set('status', 'unread');
    if (filter === 'config') params.set('type', 'config');
    if (filter === 'security') params.set('type', 'security');
    if (filter === 'user_action') params.set('type', 'user_action');
    if (filter === 'system') params.set('type', 'system');
    const res = await fetch(`/api/alert-center/events?${params.toString()}`, { headers: getAuthHeaderForNav() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    const events = data.events || [];
    return filter === 'warn'
        ? events.filter(event => ['warn', 'error', 'critical'].includes(event.severity))
        : events;
}

function updateAlertCenterBadge(summary = navState.alertCenter.summary) {
    const badge = document.getElementById('navAlertCount');
    const button = document.querySelector('.nav-alert-btn');
    if (!badge || !button) return;
    const unread = Number(summary && summary.unread) || 0;
    badge.textContent = unread > 99 ? '99+' : String(unread);
    badge.hidden = unread <= 0;
    button.classList.toggle('has-alerts', unread > 0);
}

async function refreshAlertCenterBadge() {
    try {
        navState.alertCenter.summary = await fetchAlertCenterSummary();
        updateAlertCenterBadge();
    } catch (e) {
        console.warn('[AlertCenter] summary failed:', e);
    }
}

function ensureAlertCenterModal() {
    let modal = document.getElementById('alertCenterModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'alertCenterModal';
    modal.className = 'alert-center-modal';
    modal.innerHTML = `
        <div class="alert-center-backdrop" onclick="closeAlertCenter()"></div>
        <aside class="alert-center-panel" role="dialog" aria-modal="true" aria-labelledby="alertCenterTitle">
            <div class="alert-center-head">
                <div>
                    <h2 id="alertCenterTitle">${navEscape(navT('nav.alert.title'))}</h2>
                    <p>${navEscape(navT('nav.alert.subtitle'))}</p>
                </div>
                <button class="alert-center-close" type="button" onclick="closeAlertCenter()">×</button>
            </div>
            <div class="alert-center-summary" id="alertCenterSummary"></div>
            <div class="alert-center-toolbar">
                <div class="alert-center-filters" id="alertCenterFilters"></div>
                <div class="alert-center-actions">
                    <button type="button" onclick="markAllAlertCenterRead()">${navEscape(navT('nav.alert.markAll'))}</button>
                    <button type="button" onclick="archiveAllAlertCenter()">${navEscape(navT('nav.alert.archiveAll'))}</button>
                    <button type="button" onclick="reloadAlertCenter()">${navEscape(navT('nav.alert.refresh'))}</button>
                </div>
            </div>
            <div class="alert-center-list" id="alertCenterList">${navEscape(navT('nav.alert.loading'))}</div>
        </aside>
    `;
    document.body.appendChild(modal);
    return modal;
}

function renderAlertCenterFilters() {
    const el = document.getElementById('alertCenterFilters');
    if (!el) return;
    const filters = [
        ['all', navT('nav.alert.all')],
        ['unread', navT('nav.alert.unread')],
        ['warn', navT('nav.alert.warn')],
        ['config', navT('nav.alert.config')],
        ['security', navT('nav.alert.security')],
        ['user_action', navT('nav.alert.userAction')],
        ['system', navT('nav.alert.system')]
    ];
    el.innerHTML = filters.map(([id, label]) => `
        <button type="button" class="${navState.alertCenter.filter === id ? 'active' : ''}" onclick="setAlertCenterFilter('${id}')">${navEscape(label)}</button>
    `).join('');
}

function renderAlertCenterSummary() {
    const el = document.getElementById('alertCenterSummary');
    if (!el) return;
    const summary = navState.alertCenter.summary || {};
    el.innerHTML = `
        <div><span>${navEscape(navT('nav.alert.summaryTotal'))}</span><strong>${Number(summary.total) || 0}</strong></div>
        <div><span>${navEscape(navT('nav.alert.summaryUnread'))}</span><strong>${Number(summary.unread) || 0}</strong></div>
        <div><span>${navEscape(navT('nav.alert.summaryRisk'))}</span><strong>${Number(summary.warnOrAbove) || 0}</strong></div>
    `;
}

function renderAlertCenterList() {
    const list = document.getElementById('alertCenterList');
    if (!list) return;
    if (navState.alertCenter.loading) {
        list.innerHTML = `<div class="alert-center-empty">${navEscape(navT('nav.alert.loading'))}</div>`;
        return;
    }
    const events = navState.alertCenter.events || [];
    if (!events.length) {
        list.innerHTML = `<div class="alert-center-empty">${navEscape(navT('nav.alert.empty'))}</div>`;
        return;
    }
    list.innerHTML = events.map(event => {
        const meta = [
            event.actor ? `${navT('nav.alert.actor')}: ${event.actor}` : '',
            event.source ? `${navT('nav.alert.source')}: ${event.source}` : '',
            event.object_type || event.object_id ? `${navT('nav.alert.object')}: ${event.object_type || '-'} ${event.object_id || ''}` : ''
        ].filter(Boolean);
        const detailEntries = event.detail && typeof event.detail === 'object'
            ? Object.entries(event.detail).slice(0, 4)
            : [];
        return `
            <article class="alert-center-item ${navEscape(event.severity)} ${event.status === 'unread' ? 'unread' : ''}">
                <div class="alert-center-item-top">
                    <div class="alert-center-title-wrap">
                        <span class="alert-center-severity">${navEscape(severityLabel(event.severity))}</span>
                        <span class="alert-center-type">${navEscape(alertTypeLabel(event.event_type))}</span>
                        <strong>${navEscape(event.title)}</strong>
                    </div>
                    <time>${navEscape(formatAlertTime(event.created_at))}</time>
                </div>
                ${event.ai_summary ? `<div class="alert-center-ai-summary"><span>AI</span>${navEscape(event.ai_summary)}</div>` : ''}
                ${event.message ? `<div class="alert-center-message" onclick="this.classList.toggle('expanded')" title="点击展开/收起">${navEscape(event.message)}</div>` : ''}
                ${meta.length ? `<div class="alert-center-meta">${meta.map(navEscape).join(' · ')}</div>` : ''}
                ${detailEntries.length ? `<div class="alert-center-detail">${detailEntries.map(([k, v]) => `<span onclick="this.classList.toggle('expanded')" title="点击展开/收起">${navEscape(k)}: ${navEscape(typeof v === 'object' ? JSON.stringify(v) : v)}</span>`).join('')}</div>` : ''}
                <div class="alert-center-row-actions">
                    ${event.status === 'unread' ? `<button type="button" onclick="markAlertCenterRead('${navEscape(event.id)}')">${navEscape(navT('nav.alert.read'))}</button>` : ''}
                    <button type="button" onclick="archiveAlertCenterEvent('${navEscape(event.id)}')">${navEscape(navT('nav.alert.archive'))}</button>
                </div>
            </article>
        `;
    }).join('');
}

window.reloadAlertCenter = async function () {
    navState.alertCenter.loading = true;
    renderAlertCenterSummary();
    renderAlertCenterFilters();
    renderAlertCenterList();
    try {
        const [summary, events] = await Promise.all([
            fetchAlertCenterSummary(),
            fetchAlertCenterEvents()
        ]);
        navState.alertCenter.summary = summary;
        navState.alertCenter.events = events;
        updateAlertCenterBadge(summary);
    } catch (e) {
        const list = document.getElementById('alertCenterList');
        if (list) list.innerHTML = `<div class="alert-center-empty warning">${navEscape(navT('nav.alert.failLoad'))}${navEscape(e.message)}</div>`;
    } finally {
        navState.alertCenter.loading = false;
        renderAlertCenterSummary();
        renderAlertCenterFilters();
        renderAlertCenterList();
    }
};

window.openAlertCenter = function () {
    const modal = ensureAlertCenterModal();
    modal.classList.add('open');
    window.reloadAlertCenter();
};

window.closeAlertCenter = function () {
    document.getElementById('alertCenterModal')?.classList.remove('open');
};

window.setAlertCenterFilter = function (filter) {
    navState.alertCenter.filter = filter || 'all';
    window.reloadAlertCenter();
};

window.markAlertCenterRead = async function (id) {
    await fetch('/api/alert-center/events/read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaderForNav() },
        body: JSON.stringify({ ids: [id] })
    });
    window.reloadAlertCenter();
};

window.markAllAlertCenterRead = async function () {
    await fetch('/api/alert-center/events/read-all', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaderForNav() }
    });
    window.reloadAlertCenter();
};

window.archiveAllAlertCenter = async function () {
    if (!confirm(navT('nav.alert.archiveAllConfirm'))) return;
    await fetch('/api/alert-center/events/archive-all', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaderForNav() }
    });
    window.reloadAlertCenter();
};

window.archiveAlertCenterEvent = async function (id) {
    await fetch(`/api/alert-center/events/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAuthHeaderForNav()
    });
    window.reloadAlertCenter();
};

async function fetchSecuritySettingsForNav() {
    const [settings, locks] = await Promise.all([
        API.get('/api/auth/security/settings'),
        API.get('/api/auth/security/locks')
    ]);
    navState.securitySettings = settings;
    navState.securityLocks = locks;
    return settings;
}

function renderSecurityPolicyRows(kind, rows) {
    return (rows || []).map((policy, index) => `
        <tr>
            <td><input type="checkbox" ${policy.enabled !== false ? 'checked' : ''} onchange="updateSecurityPolicy('${kind}', ${index}, 'enabled', this.checked)"></td>
            <td><input class="nav-settings-input nav-security-number" type="number" min="1" max="1000" step="1" value="${navEscape(policy.count)}" oninput="updateSecurityPolicy('${kind}', ${index}, 'count', this.value)"></td>
            <td><input class="nav-settings-input nav-security-number" type="number" min="1" max="10080" step="1" value="${navEscape(policy.windowMinutes)}" oninput="updateSecurityPolicy('${kind}', ${index}, 'windowMinutes', this.value)"></td>
            <td><input class="nav-settings-input nav-security-number" type="number" min="1" max="10080" step="1" value="${navEscape(policy.lockMinutes)}" oninput="updateSecurityPolicy('${kind}', ${index}, 'lockMinutes', this.value)"></td>
            <td>
                <select class="nav-settings-input nav-security-severity" onchange="updateSecurityPolicy('${kind}', ${index}, 'severity', this.value)">
                    ${['info', 'warn', 'error', 'critical'].map(level => `<option value="${level}" ${policy.severity === level ? 'selected' : ''}>${level}</option>`).join('')}
                </select>
            </td>
        </tr>
    `).join('');
}

function renderSecurityPolicyTable(title, kind, rows) {
    return `
        <div class="nav-security-section">
            <div class="nav-security-section-title">${navEscape(title)}</div>
            <div class="nav-account-table-wrap">
                <table class="nav-account-table nav-security-table">
                    <thead>
                        <tr>
                            <th>${navEscape(navT('nav.sec.thEnabled'))}</th>
                            <th>${navEscape(navT('nav.sec.thCount'))}</th>
                            <th>${navEscape(navT('nav.sec.thWindow'))}</th>
                            <th>${navEscape(navT('nav.sec.thLock'))}</th>
                            <th>${navEscape(navT('nav.sec.thSeverity'))}</th>
                        </tr>
                    </thead>
                    <tbody>${renderSecurityPolicyRows(kind, rows)}</tbody>
                </table>
            </div>
        </div>
    `;
}

function getSecurityLockTarget(lock) {
    return lock.lock_type === 'account' ? lock.username : lock.ip;
}

function renderSecurityLocksTable() {
    const locks = navState.securityLocks || [];
    const rows = locks.map(lock => `
        <tr>
            <td>${navEscape(lock.lock_type)}</td>
            <td>${navEscape(getSecurityLockTarget(lock))}</td>
            <td>${navEscape(lock.reason || '')}</td>
            <td>${navEscape(lock.fail_count || 0)}</td>
            <td>${navEscape(lock.locked_until || '')}</td>
            <td class="nav-account-actions">
                <button onclick="unlockSecurityLock('${navEscape(lock.lock_key)}')">${navEscape(navT('nav.sec.btnUnlock'))}</button>
            </td>
        </tr>
    `).join('');
    return `
        <div class="nav-security-section">
            <div class="nav-security-lock-head">
                <div class="nav-security-section-title">${navEscape(navT('nav.sec.locksTitle'))}</div>
                <button class="nav-settings-add" onclick="reloadSecurityLocks()">${navEscape(navT('nav.sec.btnRefresh'))}</button>
            </div>
            <div class="nav-account-table-wrap">
                <table class="nav-account-table">
                    <thead>
                        <tr>
                            <th>${navEscape(navT('nav.sec.thType'))}</th>
                            <th>${navEscape(navT('nav.sec.thTarget'))}</th>
                            <th>${navEscape(navT('nav.sec.thReason'))}</th>
                            <th>${navEscape(navT('nav.sec.thFailCount'))}</th>
                            <th>${navEscape(navT('nav.sec.thUntil'))}</th>
                            <th>${navEscape(navT('nav.acc.thAction'))}</th>
                        </tr>
                    </thead>
                    <tbody>${rows || `<tr><td colspan="6">${navEscape(navT('nav.sec.noLocks'))}</td></tr>`}</tbody>
                </table>
            </div>
        </div>
    `;
}

async function renderSecuritySettings(content) {
    content.innerHTML = `<div class="nav-settings-empty">${navEscape(navT('nav.sec.empty'))}</div>`;
    try {
        const settings = await fetchSecuritySettingsForNav();
        content.innerHTML = `
            <div class="nav-settings-help">${navEscape(navT('nav.sec.help'))}</div>
            <div class="nav-security-grid">
                <label class="nav-security-toggle">
                    <input type="checkbox" id="navSecurityEnabled" ${settings.enabled !== false ? 'checked' : ''} onchange="scheduleSecuritySettingsSave()">
                    <span>${navEscape(navT('nav.sec.enabled'))}</span>
                </label>
                <label class="nav-security-toggle">
                    <input type="checkbox" id="navSecurityAlertOnLock" ${settings.alertOnLock !== false ? 'checked' : ''} onchange="scheduleSecuritySettingsSave()">
                    <span>${navEscape(navT('nav.sec.alertOnLock'))}</span>
                </label>
                <label class="nav-ai-field">
                    <span>${navEscape(navT('nav.sec.sessionHours'))}</span>
                    <input id="navSecuritySessionHours" class="nav-settings-input" type="number" min="1" max="720" step="1" value="${navEscape(settings.sessionMaxAgeHours || 168)}" oninput="scheduleSecuritySettingsSave()">
                </label>
            </div>
            ${renderSecurityPolicyTable(navT('nav.sec.accountPolicy'), 'accountLockPolicies', settings.accountLockPolicies)}
            ${renderSecurityPolicyTable(navT('nav.sec.ipPolicy'), 'ipLockPolicies', settings.ipLockPolicies)}
            ${renderSecurityPolicyTable(navT('nav.sec.multiPolicy'), 'ipMultiUserPolicies', settings.ipMultiUserPolicies)}
            ${renderSecurityLocksTable()}
        `;
    } catch (e) {
        content.innerHTML = `<div class="nav-settings-empty">${navEscape(navT('nav.sec.failLoad'))}${navEscape(e.message)}</div>`;
    }
}

function collectSecuritySettingsPayload() {
    const current = navState.securitySettings || {};
    return {
        enabled: document.getElementById('navSecurityEnabled')?.checked !== false,
        alertOnLock: document.getElementById('navSecurityAlertOnLock')?.checked !== false,
        sessionMaxAgeHours: Number(document.getElementById('navSecuritySessionHours')?.value || current.sessionMaxAgeHours || 168),
        accountLockPolicies: current.accountLockPolicies || [],
        ipLockPolicies: current.ipLockPolicies || [],
        ipMultiUserPolicies: current.ipMultiUserPolicies || []
    };
}

window.updateSecurityPolicy = function (kind, index, field, value) {
    if (!navState.securitySettings || !Array.isArray(navState.securitySettings[kind])) return;
    const policy = navState.securitySettings[kind][index];
    if (!policy) return;
    policy[field] = field === 'enabled' ? Boolean(value) : (field === 'severity' ? value : Number(value));
    scheduleSecuritySettingsSave();
};

window.scheduleSecuritySettingsSave = function () {
    if (!navState.securitySettings) return;
    const indicator = document.getElementById('navSettingsSaveState');
    if (indicator) indicator.textContent = navT('nav.sec.saving');
    clearTimeout(navState.securitySaveTimer);
    navState.securitySaveTimer = setTimeout(async () => {
        try {
            const res = await fetch('/api/auth/security/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaderForNav()
                },
                body: JSON.stringify(collectSecuritySettingsPayload())
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            navState.securitySettings = await res.json();
            if (indicator) indicator.textContent = navT('nav.sec.saved');
        } catch (e) {
            if (indicator) indicator.textContent = navT('nav.set.saveFail') + e.message;
        }
    }, 420);
};

window.reloadSecurityLocks = async function () {
    const content = document.getElementById('navSettingsContent');
    try {
        navState.securityLocks = await API.get('/api/auth/security/locks');
        if (content && navState.settingsTab === 'security') renderSecuritySettings(content);
    } catch (e) {
        const indicator = document.getElementById('navSettingsSaveState');
        if (indicator) indicator.textContent = navT('nav.sec.failLoad') + e.message;
    }
};

window.unlockSecurityLock = async function (lockKey) {
    const res = await fetch(`/api/auth/security/locks/${encodeURIComponent(lockKey)}`, {
        method: 'DELETE',
        headers: getAuthHeaderForNav()
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await window.reloadSecurityLocks();
};

async function renderAccountSettings(content) {
    content.innerHTML = `<div class="nav-settings-empty">${navEscape(navT('nav.acc.empty'))}</div>`;
    try {
        const users = await API.get('/api/auth/users');
        const rows = users.map(u => {
            const roleBadge = u.role === 'admin'
                ? `<span class="nav-account-role admin">${navEscape(navT('nav.acc.admin'))}</span>`
                : `<span class="nav-account-role readonly">${navEscape(navT('nav.acc.readonly'))}</span>`;
            return `
                <tr>
                    <td>${navEscape(u.username)}</td>
                    <td>${roleBadge}</td>
                    <td class="nav-account-actions">
                        ${u.username !== 'admin' ? `<button onclick="deleteUser('${navEscape(u.username)}')">${navEscape(navT('nav.acc.btnDel'))}</button>` : ''}
                        <button onclick="resetPwd('${navEscape(u.username)}')">${navEscape(navT('nav.acc.btnReset'))}</button>
                    </td>
                </tr>
            `;
        }).join('');

        content.innerHTML = `
            <div class="nav-settings-help">${navEscape(navT('nav.acc.help'))}</div>
            <div class="nav-account-create">
                <input id="nu_name" placeholder="${navEscape(navT('nav.acc.plhUser'))}">
                <input id="nu_pwd" placeholder="${navEscape(navT('nav.acc.plhPwd'))}" type="password">
                <select id="nu_role">
                    <option value="readonly">${navEscape(navT('nav.acc.readonly'))}</option>
                    <option value="admin">${navEscape(navT('nav.acc.admin'))}</option>
                </select>
                <button onclick="addUser()">${navEscape(navT('nav.acc.btnAdd'))}</button>
            </div>
            <div class="nav-account-table-wrap">
                <table class="nav-account-table">
                    <thead>
                        <tr><th>${navEscape(navT('nav.acc.thUser'))}</th><th>${navEscape(navT('nav.acc.thRole'))}</th><th>${navEscape(navT('nav.acc.thAction'))}</th></tr>
                    </thead>
                    <tbody>${rows || `<tr><td colspan="3">${navEscape(navT('nav.acc.noData'))}</td></tr>`}</tbody>
                </table>
            </div>
        `;
    } catch (e) {
        content.innerHTML = `<div class="nav-settings-empty">${navEscape(navT('nav.acc.fail'))}${navEscape(e.message)}</div>`;
    }
}

window.doLogout = async function () {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('tools_token') }
        });
    } catch (e) { }
    localStorage.removeItem('tools_token');
    localStorage.removeItem('tools_user');
    localStorage.removeItem('tools_role');
    document.cookie = 'tools_token=; path=/; max-age=0';
    window.location.href = '/login.html';
};

window.openUserModal = async function () {
    if (localStorage.getItem('tools_role') !== 'admin') return;

    let m = document.getElementById('user-mgmt-modal');
    if (!m) {
        m = document.createElement('div');
        m.id = 'user-mgmt-modal';
        m.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(15,23,42,0.6); backdrop-filter:blur(4px); z-index:99999; display:none; align-items:center; justify-content:center;';
        document.body.appendChild(m);
    }

    try {
        const res = await API.get('/api/auth/users');

        let trs = res.map(u => {
            const roleBadge = u.role === 'admin'
                ? '<span style="background:#e0e7ff; color:#4338ca; padding:4px 10px; border-radius:20px; font-size:12px; font-weight:600; border:1px solid #c7d2fe;">超级管理</span>'
                : '<span style="background:#f1f5f9; color:#64748b; padding:4px 10px; border-radius:20px; font-size:12px; font-weight:600; border:1px solid #e2e8f0;">只读用户</span>';

            return `
            <tr style="transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <td style="padding:14px 16px; border-bottom:1px solid #f1f5f9; font-weight:500; color:#334155;">${u.username}</td>
                <td style="padding:14px 16px; border-bottom:1px solid #f1f5f9;">${roleBadge}</td>
                <td style="padding:14px 16px; border-bottom:1px solid #f1f5f9; text-align:right;">
                    ${u.username !== 'admin' ? `<button onclick="deleteUser('${u.username}')" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='#fef2f2'" style="background:#fef2f2; color:#ef4444; border:1px solid #fee2e2; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; transition:all 0.2s;">删除</button>` : ''}
                    <button onclick="resetPwd('${u.username}')" onmouseover="this.style.background='#e0f2fe'" onmouseout="this.style.background='#f0f9ff'" style="background:#f0f9ff; color:#0284c7; border:1px solid #e0f2fe; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; transition:all 0.2s; margin-left:8px;">重置密码</button>
                </td>
            </tr>
            `;
        }).join('');

        m.innerHTML = `
            <div style="background:#ffffff; width:650px; max-width:90%; padding:32px; border-radius:16px; box-shadow:0 20px 40px rgba(0,0,0,0.2); position:relative; animation: fadeIn 0.3s ease;">
                <button onclick="document.getElementById('user-mgmt-modal').style.display='none'" style="position:absolute; top:24px; right:24px; background:none; border:none; font-size:24px; color:#94a3b8; cursor:pointer; line-height:1; transition:color 0.2s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#94a3b8'">&times;</button>
                
                <h3 style="margin-top:0; margin-bottom:24px; font-size:20px; font-weight:700; color:#1e293b; display:flex; align-items:center; gap:8px; border-bottom:2px solid #f1f5f9; padding-bottom:16px;">
                    👥 账号管理与权限
                </h3>
                
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px; margin-bottom:24px;">
                    <div style="font-size:13px; font-weight:600; color:#475569; margin-bottom:12px;">➕ 新增账号</div>
                    <div style="display:flex; gap:12px;">
                        <input id="nu_name" placeholder="输入新用户名" style="flex:1; padding:10px 14px; border:1px solid #cbd5e1; border-radius:8px; outline:none; font-size:14px; transition:border-color 0.2s, box-shadow 0.2s;" onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#cbd5e1'; this.style.boxShadow='none'">
                        <input id="nu_pwd" placeholder="设置密码" style="flex:1; padding:10px 14px; border:1px solid #cbd5e1; border-radius:8px; outline:none; font-size:14px; transition:border-color 0.2s, box-shadow 0.2s;" onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#cbd5e1'; this.style.boxShadow='none'">
                        <select id="nu_role" style="padding:10px 14px; border:1px solid #cbd5e1; border-radius:8px; outline:none; font-size:14px; background:#fff; cursor:pointer;">
                            <option value="readonly">只读权限</option>
                            <option value="admin">超级管理</option>
                        </select>
                        <button onclick="addUser()" style="background:#10b981; color:#fff; border:none; padding:10px 20px; border-radius:8px; font-weight:600; cursor:pointer; transition:background 0.2s; box-shadow:0 2px 4px rgba(16,185,129,0.2);" onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'">新增</button>
                    </div>
                </div>
                
                <div style="border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
                    <table style="width:100%; border-collapse:collapse; text-align:left;">
                        <thead>
                            <tr style="background:#f8fafc; border-bottom:1px solid #e2e8f0;">
                                <th style="padding:12px 16px; font-size:13px; font-weight:600; color:#64748b;">账号名称</th>
                                <th style="padding:12px 16px; font-size:13px; font-weight:600; color:#64748b;">权限角色</th>
                                <th style="padding:12px 16px; font-size:13px; font-weight:600; color:#64748b; text-align:right;">快捷操作</th>
                            </tr>
                        </thead>
                        <tbody>${trs}</tbody>
                    </table>
                </div>
                
                <div style="text-align:right; margin-top:24px;">
                    <button onclick="document.getElementById('user-mgmt-modal').style.display='none'" style="background:#f1f5f9; color:#475569; border:none; padding:10px 24px; border-radius:8px; font-weight:600; font-size:14px; cursor:pointer; transition:background 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">完成并关闭</button>
                </div>
            </div>
        `;
        m.style.display = 'flex';
    } catch (e) {
        alert('获取用户列表失败: ' + e.message);
    }
};

// ==========================================
// 全局注入 AI 客服助手
// ==========================================
(function () {
    // 华子胶片设计工具内置了自己的 AI 助手，避免重复显示全局悬浮入口。
    if (window.location.pathname.startsWith('/tools/network_safety_meeting_summary')) return;

    // 确保不重复加载
    if (!document.querySelector('script[src^="/js/shared/ai-assistant.js"]')) {
        const aiScript = document.createElement('script');
        aiScript.src = '/js/shared/ai-assistant.js?v=20260707-01';
        document.body.appendChild(aiScript);
    }
})();

window.addUser = async function () {
    const username = document.getElementById('nu_name').value;
    const password = document.getElementById('nu_pwd').value;
    const role = document.getElementById('nu_role').value;
    if (!username || !password) return alert('需填写完整');
    try {
        await API.post('/api/auth/users', { username, password, role });
        alert('添加成功');
        if (document.getElementById('navSettingsModal')?.style.display === 'flex') renderNavSettingsContent();
        else openUserModal();
    } catch (e) { alert(e.message); }
};
window.deleteUser = async function (u) {
    if (!confirm('确定删除?')) return;
    try {
        await API.delete('/api/auth/users/' + u);
        if (document.getElementById('navSettingsModal')?.style.display === 'flex') renderNavSettingsContent();
        else openUserModal();
    } catch (e) { alert(e.message); }
};
window.resetPwd = async function (u) {
    const password = prompt('请输入新密码:');
    if (!password) return;
    try {
        await API.put('/api/auth/users/' + u + '/password', { password });
        alert('重置成功');
    } catch (e) { alert(e.message); }
};

// 检查服务状态
async function checkServerStatus() {
    try {
        const r = await fetch('/api/health');
        const data = await r.json();
        const el = document.getElementById('server-status-text');
        if (el) el.textContent = navT('nav.online');
    } catch (e) {
        const dot = document.querySelector('.status-dot');
        const el = document.getElementById('server-status-text');
        if (dot) dot.style.background = '#ef5350';
        if (el) el.textContent = navT('nav.offline');
    }
}

function ensureToolsI18nLoaded() {
    if (window.ToolsI18n) return Promise.resolve();
    return new Promise((resolve) => {
        const existing = document.querySelector('script[src^="/js/shared/i18n.js"]');
        if (existing) {
            existing.addEventListener('load', resolve, { once: true });
            existing.addEventListener('error', resolve, { once: true });
            return;
        }
        const script = document.createElement('script');
        script.src = '/js/shared/i18n.js?v=20260610-01';
        script.onload = resolve;
        script.onerror = resolve;
        document.head.appendChild(script);
    });
}

function ensureMigrationStatusLoaded() {
    if (document.querySelector('script[src^="/js/shared/migration-status.js"]')) return;
    const script = document.createElement('script');
    script.src = '/js/shared/migration-status.js?v=20260626-01';
    document.head.appendChild(script);
}

function initBackToTopButton() {
    if (document.getElementById('globalBackToTop')) return;

    const styleId = 'globalBackToTopStyle';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #globalBackToTop {
                position: fixed;
                right: 22px;
                bottom: var(--global-back-to-top-bottom, 112px);
                z-index: 10050;
                width: 40px;
                height: 40px;
                border: 1px solid rgba(255, 255, 255, 0.22);
                border-radius: 999px;
                background: rgba(15, 23, 42, 0.58);
                color: #e2e8f0;
                box-shadow: 0 10px 28px rgba(0, 0, 0, 0.22);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                cursor: pointer;
                display: grid;
                place-items: center;
                font-size: 20px;
                line-height: 1;
                opacity: 0;
                visibility: hidden;
                transform: translateY(10px);
                transition: opacity 0.18s ease, transform 0.18s ease, visibility 0.18s ease, background 0.18s ease;
            }
            #globalBackToTop.visible {
                opacity: 0.82;
                visibility: visible;
                transform: translateY(0);
            }
            #globalBackToTop:hover {
                opacity: 1;
                background: rgba(15, 23, 42, 0.78);
                color: #fff;
            }
            #globalBackToTop:focus-visible {
                outline: 3px solid rgba(100, 255, 218, 0.28);
                outline-offset: 3px;
            }
            @media (max-width: 720px) {
                #globalBackToTop {
                    right: 14px;
                    bottom: var(--global-back-to-top-bottom, 94px);
                    width: 38px;
                    height: 38px;
                }
            }
            @media print {
                #globalBackToTop { display: none !important; }
            }
        `;
        document.head.appendChild(style);
    }

    const button = document.createElement('button');
    button.id = 'globalBackToTop';
    button.type = 'button';
    button.setAttribute('aria-label', '回到顶部');
    button.title = '回到顶部';
    button.textContent = '↑';
    document.body.appendChild(button);

    let lastScrollElement = null;
    let rafPending = false;
    let lastAiFabRect = null;
    const threshold = 360;
    const defaultBottom = () => (window.innerWidth <= 720 ? 94 : 112);
    const minimumBottom = () => (window.innerWidth <= 720 ? 16 : 24);

    function getWindowScrollTop() {
        return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    }

    function getActiveScrollTop() {
        const windowTop = getWindowScrollTop();
        const elementTop = lastScrollElement && document.contains(lastScrollElement)
            ? lastScrollElement.scrollTop || 0
            : 0;
        return Math.max(windowTop, elementTop);
    }

    function updateVisibility() {
        rafPending = false;
        updateBackToTopPlacement();
        button.classList.toggle('visible', getActiveScrollTop() > threshold);
    }

    function rectsOverlap(a, b, gap = 10) {
        if (!a || !b) return false;
        return !(
            a.right + gap < b.left ||
            a.left - gap > b.right ||
            a.bottom + gap < b.top ||
            a.top - gap > b.bottom
        );
    }

    function updateBackToTopPlacement() {
        if (!lastAiFabRect) {
            const aiFab = document.querySelector('.ai-fab');
            if (aiFab) {
                const rect = aiFab.getBoundingClientRect();
                lastAiFabRect = {
                    left: rect.left,
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                    width: rect.width,
                    height: rect.height
                };
            }
        }
        const fallback = defaultBottom();
        let nextBottom = fallback;
        const buttonWidth = button.offsetWidth || 40;
        const buttonHeight = button.offsetHeight || 40;
        const right = window.innerWidth <= 720 ? 14 : 22;
        const syntheticButtonRect = {
            left: window.innerWidth - right - buttonWidth,
            right: window.innerWidth - right,
            top: window.innerHeight - nextBottom - buttonHeight,
            bottom: window.innerHeight - nextBottom
        };

        if (rectsOverlap(syntheticButtonRect, lastAiFabRect)) {
            const bottomAboveAi = Math.max(minimumBottom(), window.innerHeight - lastAiFabRect.top + 12);
            const bottomBelowAi = Math.max(minimumBottom(), window.innerHeight - lastAiFabRect.bottom - buttonHeight - 12);
            nextBottom = bottomAboveAi + buttonHeight < window.innerHeight
                ? bottomAboveAi
                : bottomBelowAi;
        }
        button.style.setProperty('--global-back-to-top-bottom', `${Math.round(nextBottom)}px`);
    }

    function queueVisibilityUpdate(event) {
        const target = event && event.target;
        if (target && target !== document && target !== window && target !== document.documentElement && target !== document.body) {
            if (target.scrollTop > threshold) lastScrollElement = target;
        }
        if (rafPending) return;
        rafPending = true;
        window.requestAnimationFrame(updateVisibility);
    }

    function scrollElementToTop(element) {
        if (!element || !document.contains(element) || !element.scrollTo) return;
        if ((element.scrollTop || 0) <= 0) return;
        element.scrollTo({ top: 0, behavior: 'smooth' });
    }

    button.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        scrollElementToTop(document.scrollingElement);
        scrollElementToTop(lastScrollElement);
    });

    window.addEventListener('scroll', queueVisibilityUpdate, { passive: true });
    document.addEventListener('scroll', queueVisibilityUpdate, { passive: true, capture: true });
    window.addEventListener('resize', () => {
        updateBackToTopPlacement();
        queueVisibilityUpdate();
    }, { passive: true });
    window.addEventListener('tools:ai-fab-position', (event) => {
        lastAiFabRect = event.detail && event.detail.rect ? event.detail.rect : null;
        updateBackToTopPlacement();
    });
    setTimeout(updateVisibility, 300);
}

document.addEventListener('DOMContentLoaded', async () => {
    ensureMigrationStatusLoaded();
    await ensureToolsI18nLoaded();
    registerNavbarI18n();
    renderNavbar();
    initBackToTopButton();
    loadNavigationData();
    refreshAlertCenterBadge();
    setInterval(refreshAlertCenterBadge, 60000);
    setTimeout(checkServerStatus, 500);
});
