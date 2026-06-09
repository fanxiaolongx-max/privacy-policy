---
name: tools-platform-data-workflows
description: Use when working on the Tools Platform project's UIVF12 data capture, SLA data import, report dashboard, or monthly report modules. 适用于维护 Tools Platform 的数据抓取、数据导入、报表看板和月报页面，帮助 Codex 遵守现有 Express + 静态前端架构、SQLite/JSON 兼容策略、报表入库口径和历史月报一致性。
---

# Tools Platform Data Workflows

这个 skill 面向 Tools Platform 项目中的数据链路模块，覆盖 `/uivf12` 数据抓取脚本、`/sla` 数据导入、`/report` 看板，以及 `/monthly` 月报。除了帮助 Agent 维护原始项目的代码外，**该 Skill 还内置了纯 Python 的月报生成脚本和抓取脚本生成器，能够完全脱离原有的 Web 服务独立运行。**

- `scripts/export_config_bundle.py`: export SLA/report configuration from an existing Tools Platform project.
- `scripts/generate_html_monthly_report.py`: read original XLSX/CSV import files and generate an HTML monthly report.
- `scripts/generate_uiv_script.py`: generate UIV macro and F12 console data-capture scripts directly from a raw JSON payload, bypassing the Web UI.

## 🚀 独立功能 1：独立生成月报 (Headless Monthly Report)

如果 Agent 只需要用该 Skill 来生成月报，可以直接使用以下命令（自带的 `scripts/generate_html_monthly_report.py` 没有任何第三方依赖）：

```bash
python3 scripts/generate_html_monthly_report.py \
  --input-dir ./imports \
  --config ./config-bundle.json \
  --month 6 \
  --output ./monthly-report.html
```

## 🚀 独立功能 2：独立生成抓取脚本 (UIV Script Generator)

Agent 现在也能像前端页面一样，直接基于 Payload JSON 和目标 URL 独立生成用于抓取数据的 JavaScript 脚本。

```bash
python3 scripts/generate_uiv_script.py \
  --payload ./request_payload.json \
  --url "https://datafab-pro.gtsdata.huawei.com/DataFabKernelCn/v1/answer/getAnswers" \
  --name "PBI_自动抓取-某某详单" \
  --global-vars \
  --pagination \
  --auto-cpc \
  --auto-month \
  --output-console ./console_script.js
```

支持的所有开关与页面完全一致：`--global-vars` (全局变量控制), `--pagination` (翻页拉取), `--force-sum` (强制大盘兜底), `--auto-cpc` (动态嗅探CPC/NID), `--auto-month` (自动当月上月裂变)。

## 🚀 独立功能 3：超期与高风险明细提取器 (Risk & Overdue Extractor)

你可以通过内置脚本脱离 Web 前端，直接从下载好的各种 Excel / CSV 中分析、提取出哪些 SR 已经超期、哪些漏洞即将到达 30 天红线！

```bash
python3 scripts/extract_risks.py \
  --input-dir ./imports \
  --output ./risk_report.json
```

这个工具会自动判断你的报表类型（整改、CPT、常规风险、SR、漏洞预警等），并根据内建的硬核 SLA 规则（如 Critical > 85% 预警等）帮你筛选出所有带有 `danger` 和 `warning` 标签的高危数据，最终输出为一份格式化良好的 JSON 报告，非常适合**企微机器人推流或定时邮件告警**。

## 🔍 指标映射说明 (Mapping Guide)

在其他 Agent 中使用这个 Skill 处理原始表格时，可能会遇到 **“指标 ID 与实际指标名称对不上”、“导入的文件不知道对应哪个配置”** 的问题。原因在于，原项目在入库时对独立表的文件名进行了哈希，并且指标名称是挂载在偏好设置（`prefs`）而非目标配置（`targets`）上的。

为了解决这个问题，新版 Skill 中 `config-bundle.json` 已经进行了优化：

1. **目标配置包含 Label**：在 `targets` 节点下的所有独立表自定义指标（如 `other_36ksoy_m_1778705593174`）都已经被自动补全了 `"label": "重急EOS"` 字段。Agent 可以直接通过检索 `targets` 里的 `label` 字段来锁定并修改指标的打分规则（如 权重 weight、达标阈值、是否支持比例计分 等）。
2. **文件名哈希逻辑**：在 `config-bundle.json` 底部新增了 `mappings` 节点，或者查阅 Python 源码中的 `generate_schema_hash`。比如导入了一个叫 `PBI_重急EOS_Latest.xlsx` 的独立表，程序会自动截取 `PBI_重急EOS`，并通过内部散列算法得到一个短码 `36ksoy`，最终该表在配置中的唯一标志为 `other_36ksoy`。Agent 在分析或修改具体某个导入表时，只需找 `other_<短码>` 即可。

## For AI Agents: Workflow & Guardrails

1. Use this skill when the user asks to modify, debug, explain, or extend these Tools Platform modules (`/uivf12`, `/sla`, `/report`, `/monthly`).
2. Use the bundled scripts when the user wants to process original imported spreadsheet files outside the original web app (`generate_html_monthly_report.py` and `export_config_bundle.py`).
3. For DB schema changes, add backward-compatible `ALTER TABLE ... ADD COLUMN` logic rather than assuming a fresh database.
4. For report/monthly changes, prioritize saved入库 results over recalculating historical results from current frontend logic.
5. Do not treat this as a full-project skill. PR audit, FRT, requirements, storage migration, custom tools, global backup, and AI assistant work are out of scope unless they directly affect data workflows.
6. The `config-bundle.json` is automatically injected with `mappings.metric_id_to_label` and target `label` properties via the updated `export_config_bundle.py` script.
7. Refer to `references/` directory for detailed module behaviors.

