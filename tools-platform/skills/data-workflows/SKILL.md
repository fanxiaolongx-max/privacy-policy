---
name: tools-platform-data-workflows
description: Use when working on the Tools Platform project's UIVF12 data capture, SLA data import, report dashboard, or monthly report modules. 适用于维护 Tools Platform 的数据抓取、数据导入、报表看板和月报页面，帮助 Codex 遵守现有 Express + 静态前端架构、SQLite/JSON 兼容策略、报表入库口径和历史月报一致性。
---

# Tools Platform Data Workflows

这个 skill 面向 Tools Platform 项目中的数据链路模块，覆盖 `/uivf12` 数据抓取脚本、`/sla` 数据导入、`/report` 看板，以及 `/monthly` 月报。除了帮助 Agent 维护原始项目的代码外，**该 Skill 还内置了纯 Python 的月报生成脚本，能够脱离原有的 Web 服务，直接读取原始导入的 Excel/CSV 表格，一键生成完整的本地 HTML 月报。**

## 🚀 如何独立使用该 Skill 生成月报？

如果 Agent 只需要用该 Skill 来生成月报，可以直接使用以下命令（自带的 `scripts/generate_html_monthly_report.py` 没有任何第三方依赖）：

```bash
python3 scripts/generate_html_monthly_report.py \
  --input-dir ./imports \
  --config ./config-bundle.json \
  --month 6 \
  --output ./monthly-report.html
```

- `--input-dir`: 包含原始 `_Latest.xlsx` 等文件的目录。
- `--config`: 随本 Skill 导出的项目配置，包含了所有的目标值 (targets) 和 偏好设定 (prefs)。
- `--month`: 需要生成月报的月份（如 6 代表 6月）。
- 脚本不仅会输出一份非常美观的 `.html` 报告文件，还会附带一份同名的 `.snapshot.json` 以便二次利用数据。

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

