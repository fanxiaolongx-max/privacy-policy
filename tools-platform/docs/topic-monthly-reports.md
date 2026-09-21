# 专题月报

专题分析页顶部的“月报专题”可切换 EOS、证书风险、变更质量、高危拦截、SR、日志回传、日志备案。默认仍显示 EOS。

各专题共用中英文编辑、表格编辑、文字格式、差异提示、AI 翻译、恢复本月文案、工程文件以及 PNG/PDF/HTML/Excel/MSG 导出。AI 翻译需要平台已配置 AI 助手。Excel 第一页保存当前编辑后的中英文月报，其余页保存专题原始数据；MSG 附带同一 Excel。

## 数据口径

| 专题 | 数据月份 | 内容 |
| --- | --- | --- |
| EOS | 保持原 `getEosMonthlyReport` 规则 | 原有产品/版本收编、固定风险进展及四页 Excel |
| 证书 | 快照 settings 年月，缺省使用 SR 年月，再回退 capturedAt | 快照时点的需消减、已消减、待消减，客户/产品线分布、重点任务 |
| 变更 | change.currentYear/currentMonth | 当月、年累计、同期变化、任务数加权成功率、回退与高危核心操作 |
| 高危拦截 | interception.currentYear/currentMonth | 当月、年累计、同期变化、命令行与图形化拦截 |
| SR | sr.currentYear/currentMonth | 当月与累计 SR、FRT、逾期、未关闭、Major/Critical |
| 日志回传 | settings.year/month | 保存的需回传/已回传/缺口/目标、产品线表现及月度趋势 |
| 日志备案 | settings.year/month | 保存的备案量/备案率/上限、月度对照、符合剔除规则的原因分布 |

新专题每月选择该租户、该平台、该专题月份最后导入的快照；同一导入时间用 rowid 确定顺序。不会用当前月份的配置重算历史目标。变更和拦截的整体只取 TOTAL 行，业务范围不重复加总。SR 累计 FRT 直接取累计汇总。缺少记录或分母为零显示“—”，无专题数据时显示空态并禁用导出。

DataFab 汇总沿用快照结果；原因分布应用快照保存的 ICT 与待评分剔除设置。原始 Excel 明细保留被剔除记录，页面有口径说明。手工修改用于月报表达，不反向修改原始数据或自动重算其他单元格。

## 兼容和存储

- 后端快照仍保存在租户感知的 `topic_snapshots` SQLite 表，无新增数据库。
- EOS 保留原 API、DOM 标识、版式、`topic-eos:*` 浏览器存储键与 `.eos.json` 工程格式。
- 新专题编辑按 `topic-monthly:<topic>:<kind>:v1:<tenant>:month:<scope>:<month>` 隔离，仍与原编辑器一样存于当前浏览器。跨设备继续编辑需导出/导入工程。
- 新工程格式为 `fileType: topic-monthly-project`、`schemaVersion: 1`，包含 `topicKey`、`month`、`reportData`、源快照及编辑/同步/翻译撤回记录。导入后自动切换至对应专题。
- 切换时保留当前页面内各专题的月报与离线工程状态；刷新数据会重新读取服务器。

## 扩展位置

`frontend/js/shared/topic-monthly-engine.js` 是前后端共用的纯数据模块：注册专题、解析月份、生成双语段落/表格、校验工程。`frontend/js/topic-analysis.js` 提供共用编辑/导出工作区，EOS 通过兼容分支保留现有渲染和专属 Excel。

新接口：`GET /api/topic-snapshots/monthly-report?topic=change&month=2026-08`。`topic` 可为 `eos/certificate/change/interception/sr/return/filing`，省略月份取最新月份，返回 `{ months, report }`。无数据时 `report` 为 `null`，非法专题或月份返回 400。与其他专题 API 一样由平台鉴权和租户中间件保护。

## 验证

```bash
node --test tests/topic-monthly-engine.test.js tests/topic-analysis-*.test.js tests/topic-snapshots-repository.test.js tests/report-msg-export.test.js
node_modules/.bin/electron tests/topic-monthly-browser.cjs
```

Electron 验证使用独立临时用户目录、合成 API 数据和临时导出文件，不访问业务数据库。覆盖专题切换、编辑隔离、双语同步、EOS/新工程互导、五种文件导出、空态、请求竞态和窄屏/暗色布局。
