#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const readmePath = path.join(projectRoot, 'README.md');
const bundlePath = path.join(projectRoot, 'backend/defaults/quick-start-bundle.json');
const startMarker = '<!-- DEFAULT_QUICK_START_BEGIN -->';
const endMarker = '<!-- DEFAULT_QUICK_START_END -->';

const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));

function escapeCell(value) {
    return String(value == null ? '' : value).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function describeScript(name) {
    const clean = String(name).replace(/^PBI_自动抓取[-_]?/, '');
    const rules = [
        [/数字证书/, '抓取数字证书整改/达成数据，供证书指标核算。'],
        [/锂电池|锂电/, '抓取锂电池治理数据，供锂电达成率指标核算。'],
        [/重急EOS风险/, '抓取重急 EOS 风险库存与处置进度。'],
        [/版本EOS风险/, '抓取版本级 EOS 风险与收编进度。'],
        [/产品EOS风险/, '抓取产品级 EOS 风险与收编进度。'],
        [/SRFRT/, '抓取中国区 SR FRT 数据，供首次响应达成率核算。'],
        [/事故-CN/, '抓取中国区事故数据，供恶性事故数量监控。'],
        [/路由器整改/, '抓取路由器整改进度和明细。'],
        [/数据存储整改/, '抓取数据存储整改进度和明细。'],
        [/软件MM收编分停退/, '抓取软件 MM 收编/停退数据。'],
        [/风险详单-CN/, '抓取中国区 NetCare 风险明细，用于风险合控。'],
        [/风险详单-DE/, '抓取德国 NetCare 风险明细，用于风险合控。'],
        [/CPT风险详表-CN/, '抓取中国区 CPT 风险详表。'],
        [/CPT风险详表-DE/, '抓取德国 CPT 风险详表。'],
        [/整改详单/, '抓取整改任务明细，用于进度和超期核算。'],
        [/(^|_)整改$/, '抓取整改看板汇总数据，用于整改达成率。'],
        [/任职匹配度/, '抓取维护红线岗位任职匹配度。'],
        [/红线人员工单统计/, '抓取红线人员工单量，用于低工单/零工单监控。'],
        [/明细红线/, '抓取维护红线人员明细，支撑风险人员识别。'],
        [/维护红线资源/, '抓取维护红线资源汇总数据。'],
        [/业务比对明细/, '抓取业务比对任务明细，用于回传和备案核算。'],
        [/业务比对报告看板/, '抓取业务比对看板汇总数据。'],
        [/日志稽查率/, '抓取日志稽查达成率。'],
        [/详单_图形化拦截/, '抓取图形化拦截明细，支持原因穿透。'],
        [/图形化拦截/, '抓取图形化命令拦截汇总数据。'],
        [/高危命令拦截人员管理/, '抓取 ADMS 高危命令拦截人员数据。'],
        [/延期操作补授权/, '抓取延期操作补授权进度。'],
        [/产品TOPN风险/, '抓取产品 TOPN 风险整改数据。'],
        [/预案拓扑/, '抓取应急预案和网络拓扑覆盖情况。'],
        [/详单_逃生演练/, '抓取逃生演练明细，支持客户群穿透。'],
        [/逃生演练/, '抓取逃生演练达成率汇总数据。'],
        [/应急演练/, '抓取 iLab/应急演练完成进度。'],
        [/巡检详单/, '抓取价值网络巡检明细，识别未完成巡检单。'],
        [/价值网络巡检/, '抓取价值网络巡检汇总与 HC 数据。'],
        [/详单漏洞/, '抓取漏洞预警明细，支持漏洞穿透。'],
        [/漏洞预警/, '抓取漏洞预警汇总与闭环进度。'],
        [/详单-SR-CN/, '抓取中国区 SR 工单明细，支持 SLA/FRT 分析。'],
        [/详单预警冒泡/, '抓取 SR/风险预警冒泡明细。'],
        [/操作资质积分/, '抓取事前操作资质积分和人员风险数据。'],
        [/重疾软件EOS/, '抓取重疾软件 EOS 库存与预案数据。'],
        [/重急EOS收编/, '抓取分年份重急 EOS 收编进度。'],
        [/^IBMS$/i, '抓取 IBMS 完成情况，支持 IBMS 达成率指标。'],
        [/isales-summit/i, '抓取 iSales 服务峰会/客户活动数据。']
    ];
    const match = rules.find(([pattern]) => pattern.test(clean));
    return match ? match[1] : `抓取“${clean}”业务数据，供后续 SLA 合控和报表使用。`;
}

function describeTarget(target) {
    const direction = target.type === 'lte' ? '实际值 ≤ 目标时达标' : '实际值 ≥ 目标时达标';
    return `${direction}；权重 ${target.weight == null ? '未设置' : target.weight}分。`;
}

function describeMonths(target) {
    const entries = Object.keys(target)
        .filter(key => /^(?:[1-9]|1[0-2])$/.test(key) && target[key] !== '' && target[key] != null)
        .sort((a, b) => Number(a) - Number(b))
        .map(key => [Number(key), target[key]]);
    if (!entries.length) return '未设置分月值（待按业务填写）';
    const values = [...new Set(entries.map(([, value]) => String(value)))];
    if (values.length === 1) return `${entries[0][0]}–${entries.at(-1)[0]}月：${values[0]}`;
    return entries.map(([month, value]) => `${month}月 ${value}`).join(' / ');
}

function sourceName(prefKey, pref) {
    const meta = pref && pref._sourceMeta;
    if (meta && meta.baseName) return meta.baseName;
    if (meta && meta.title) return String(meta.title).replace(/^\p{Extended_Pictographic}\s*/u, '');
    return prefKey;
}

function describePreference(prefKey, pref) {
    if (prefKey === 'i18nMap') return `指标中英文字典，共 ${Object.keys(pref || {}).length} 个词条。`;
    if (prefKey === 'manualAdjustItems') return `手工加减分项清单，共 ${(pref || []).length} 项。`;
    if (prefKey === 'manualAdjustAutoFill') return '手工加减分自动填充配置。';
    if (prefKey === 'isAutoStandardTotalScore') return '标准总分自动计算开关。';
    if (prefKey === 'expediteIgnoreKeywords') return '一键催办忽略关键词。';
    if (prefKey === 'expediteTemplate') return '一键催办默认文案模板。';
    if (prefKey === 'sla_builtin_rule_risk_v1') return '常规风险表的内置状态、时间和告警分级规则。';
    const metrics = Array.isArray(pref && pref.customMetrics) ? pref.customMetrics : [];
    const labels = [...new Set(metrics.map(metric => metric && metric.label).filter(Boolean))];
    const subCount = metrics.reduce((sum, metric) => sum + (Array.isArray(metric && metric.subMetrics) ? metric.subMetrics.length : 0), 0);
    if (!metrics.length) return '保存该数据源的列显隐、宽度、排序与识别信息；当前未定义顶部自定义指标。';
    return `自定义指标：${labels.join('、')}；${metrics.length} 个主指标、${subCount} 个客户群子指标。`;
}

const scriptsRows = bundle.uiv.scripts.map(script =>
    `| ${escapeCell(script.category || '默认分类')} | ${escapeCell(script.name)} | ${escapeCell(describeScript(script.name))} |`
).join('\n');

const prefRows = Object.entries(bundle.sla.prefs).sort(([a], [b]) => a.localeCompare(b)).map(([key, pref]) =>
    `| \`${escapeCell(key)}\` | ${escapeCell(sourceName(key, pref))} | ${escapeCell(describePreference(key, pref))} |`
).join('\n');

const targetRows = Object.entries(bundle.sla.targets).map(([key, target]) =>
    `| ${escapeCell(target.label || key)} | \`${escapeCell(key)}\` | ${escapeCell(describeTarget(target))} | ${escapeCell(describeMonths(target))} |`
).join('\n');

const groupRows = bundle.sla.groups.map(group =>
    `| ${escapeCell(group.name || group.id)} | \`${escapeCell(group.id)}\` | ${escapeCell((group.metrics || []).join('、') || '暂无绑定指标')} |`
).join('\n');

const section = `${startMarker}
### 默认快速上手包

项目第一次启动后（Windows 安装版、绿色免安装版和源代码启动一致），超级管理员首次进入页面会看到一次性引导，可分别选择导入“默认智能调度脚本仓库”和“全量指标规则”，也可两项都不导入。选择保存在当前运行数据目录的 \`first-run-defaults.json\`，不依赖浏览器缓存，因此各启动形态行为一致。

- 导入策略是 **只补齐、不覆盖**：现有同名脚本、同 ID/同名分组和同 key 指标规则保留用户版本。
- 真正写入前会在 \`backups/first-run-defaults/\` 生成 JSON 备份；任一步失败会尝试回滚。
- 默认包是可版本化的静态快照，发布前运行 \`npm run defaults:export\` 可用当前 \`tools.db\` 重新生成。
- 脚本不携带固定 Cookie、Authorization 或口令；运行时从用户已登录的目标系统会话动态取得令牌。使用前仍需确认目标系统授权、地区/代表处参数和数据合规要求。

本版默认包摘要：**${bundle.summary.scriptCount}** 个脚本、**${bundle.summary.scriptCategoryCount}** 个脚本分类、**${bundle.summary.targetCount}** 条目标/权重规则、**${bundle.summary.preferenceCount}** 份偏好与数据源规则、**${bundle.summary.metricGroupCount}** 个指标分组、**${bundle.summary.metricCategoryCount}** 个客户类别和 **${bundle.summary.dictionaryCount}** 个双语字典词条。

#### 默认智能调度脚本（逐个说明）

| 仓库分类 | 脚本 | 用途 |
|---|---|---|
${scriptsRows}

#### 默认数据源/偏好规则（逐个说明）

以下每个 \`sla_prefs_*\` 条目都是一份可匹配到具体导入表的规则档案；除了自定义指标，还包含列显隐、列宽、排序和数据源识别元数据。

| 配置 Key | 数据源/全局项 | 规则内容 |
|---|---|---|
${prefRows}

#### 默认目标、权重与达标方向（逐个说明）

\`gte\` 表示“越高越好”，\`lte\` 表示“越低越好”。表中“分月目标”完整列出当前默认包已配置的月份；未设置的手工经营指标需由管理员按实际业务补充。

| 指标 | 规则 Key | 达标与权重 | 分月目标 |
|---|---|---|---|
${targetRows}

#### 默认指标分组（逐个说明）

默认客户类别为：${bundle.sla.categories.map(escapeCell).join('、')}。

| 分组 | 分组 ID | 包含指标 |
|---|---|---|
${groupRows}
${endMarker}`;

let readme = fs.readFileSync(readmePath, 'utf8');
if (!readme.includes('[默认快速上手包](#默认快速上手包)')) {
    readme = readme.replace(
        '   - [2.2 SLA 数据合控与指标规则引擎](#22-sla-数据合控与指标规则引擎)\n',
        '   - [2.2 SLA 数据合控与指标规则引擎](#22-sla-数据合控与指标规则引擎)\n   - [默认快速上手包](#默认快速上手包)\n'
    );
}

if (readme.includes(startMarker) && readme.includes(endMarker)) {
    const start = readme.indexOf(startMarker);
    const end = readme.indexOf(endMarker) + endMarker.length;
    readme = `${readme.slice(0, start)}${section}${readme.slice(end)}`;
} else {
    readme = readme.replace('\n---\n\n### 2.3 报表看板、月报与运营大屏', `\n${section}\n\n---\n\n### 2.3 报表看板、月报与运营大屏`);
}

fs.writeFileSync(readmePath, readme, 'utf8');
console.log('README default quick-start inventory updated.');
