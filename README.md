# Tools Platform

> 综合性运维数据抓取、SLA 指标合控、质量看板、月报工作区、一键催办、胶片设计/素材库、专题分析、部门奖惩与负向事件治理、正向激励申报、Dragon Claw 智能体与 2D/3D 知识图谱中台。

---

## 核心业务与架构全景

平台采用 **Express + 原生多页面静态前端 + SQLite** 的轻量高效架构，同时提供 Windows Electron 托盘常驻安装版/绿色免安装版，并配套 iOS/KMP 移动端工程生态。

- **SLA 数据合控与指标规则引擎**：自动识别日常运维 8 大类表格、支持提取/统计/占比/加减分计算、跨表指标作用域自由切换、1~12 月分月目标基线，内置防意外清空的批量替换防护守卫 (Bulk replacement guard)。
- **自动化采集与 UIV AI 网站适配器**：UI.Vision 宏与 F12 抓取脚本工程仓库、AST 语法树自动分析脱敏、抓取 Rows 免上传自动导入流转会话。
- **报表看板与标准化月报工作区 (Monthly Workspace)**：
  - 客户群健康度积分与短板透视矩阵。
  - 行内交互式富文本编辑（单元格直接修改，浮动格式条加粗/斜体/5色文字调色盘）。
  - 文案一键重置（恢复本月/固定文案）、导入时间与数据源小字自由显隐。
  - 网络名称别名映射（与催办共用统一映射字典）与单据临期预警阈值。
  - 工程化管理与快照比对：月报工程 `.json` 导出/导入、云端快照库保存与多版本分屏比对 (Diff)。
  - 全矩阵交付：独立中文 PNG、独立英文 PNG、中英合一双语高清 PNG、一键打包 3 张下载，以及标准 PDF、单文件离线 HTML、原生带格式 Excel 与 Outlook 邮件草稿 (`.msg`) 一键导出。
- **专项治理与激励闭环工具链**：
  - **专题分析中心 (`/topic-analysis`)**：NetCare 与 DataFab 导入快照的租户级历史中心、EOS 产品与版本收编进展月报。
  - **部门奖惩与负向事件治理 (`/api/department-reward-penalty`)**：红线违规登记、证据链留存、免责归因、离线单文件及 Pages 自动化推送。
  - **正向激励方案管理 (`/api/reward-program`)**：多维度激励方案设定、月度/季度申报立项、额度核算、证明凭证附件管理与审批流。
  - **会议考勤与操作激励花名册体系**：花名册多姓名复合单元格智能拆分去重、工号去 `m` 前缀归一化、角色清洗与 $O(1)$ 哈希索引秒级比对。
  - **PR 审计 (`/praudit`)**、**FRT 核算 (`/frt`)**、**需求广场 (`/requirements`)**、**问卷调研 (`/surveys`)**。
- **Dragon Claw 智能体与 2D/3D 双视图知识图谱**：
  - 专属绿恐龙品牌形象，多模型提供商 (Gemini/OpenAI/Claude/MiniMax) SSE 流式问答与成本核算。
  - 项目源码与文档 BM25 增量知识库，业务数据受限只读安全检索。
  - **租户全局跨页面历史会话检索与恢复 (`/api/ai/sessions-archive`)**：汇聚全页面活跃与归档会话，支持关键词检索与无缝续聊。
  - 2D 平面与 3D 空间透视视角切换，支持相机反投影空间拖拽交互。
- **光影大厅 (Tools Cinema) 与多媒体生态**：沉浸式多媒体影院大厅 (`/cinema.html`) 与流媒体分段切片服务 (`/api/media`)。
- **多源工具市场与扩展生态**：支持官方 GitHub `tool-market` 分支与多个第三方内网 HTTP(S) 静态源聚合，具备 Ed25519 签名与 SHA-256 指纹校验；自定义 HTML 工具沙箱隔离与单文件离线导出。
- **多租户业务隔离与双轨授权**：默认租户零迁移，新租户原子初始化；ECDSA P-256 离线高可用验签；全链路请求/响应日志动态递归脱敏。

---

## 快速导航

- **核心工程主目录**：[`tools-platform/`](./tools-platform/)
- **完整架构与使用指南**：[`tools-platform/README.md`](./tools-platform/README.md)
- **常用页面入口清单**：[`tools-platform/README.md#7-常用页面入口清单`](./tools-platform/README.md#7-常用页面入口清单)
- **主要 API 路由全景表**：[`tools-platform/README.md#8-主要-api-路由全景表`](./tools-platform/README.md#8-主要-api-路由全景表)
- **Windows 客户端落地文件与目录全景字典**：[`tools-platform/README.md#124-windows-客户端本地生成文件与目录全景字典-setup-vs-portable`](./tools-platform/README.md#124-windows-客户端本地生成文件与目录全景字典-setup-vs-portable)
- **外部指标 API 调用文档**：[`tools-platform/docs/external-metrics-api.md`](./tools-platform/docs/external-metrics-api.md)
- **双语特性与能力全景**：[`tools-platform/docs/tools-platform-feature-overview-bilingual.html`](./tools-platform/docs/tools-platform-feature-overview-bilingual.html)
- **配套 iOS/KMP 移动端工程**：[`tools-platform/iosapp/`](./tools-platform/iosapp/)

---

## 启动指南简述

```bash
cd tools-platform/backend
npm install
npm run doctor
npm start
```

服务默认运行在 `http://localhost:3030`。更多详细部署、Windows 桌面托盘版打包与运维文档请参阅 [`tools-platform/README.md`](./tools-platform/README.md)。

---

## Windows 客户端落地文件与目录说明 (Setup vs Portable)

平台发布的两个 Windows 客户端在系统中的文件分布如下（详细字段字典参见 [完整文档](./tools-platform/README.md#124-windows-客户端本地生成文件与目录全景字典-setup-vs-portable)）：

| 目录类型 | 物理路径 | 包含文件 | 作用与生命周期 |
| :--- | :--- | :--- | :--- |
| **安装目录 (仅 Setup)** | `%LocalAppData%\Programs\tools-platform\` | `Tools Platform.exe`, `app.asar`, `Uninstall.exe`, DLLs | 程序核心运行环境，覆盖安装或卸载时变动 |
| **临时解压 (仅 Portable)** | `%TEMP%\electron-builder-portable\...` | 临时 asar 与运行载荷 | 绿色版运行时临时解压，**退出即销毁，0 注册表残留** |
| **持久化用户数据 (两者共享)** | `%APPDATA%\Tools Platform\` | `desktop-license.json`, `logs\`, `data\*.db` 等 | **核心配置、授权、日志与业务数据（换包/升级数据不丢失）** |
| **核心数据库 (两者共享)** | `%APPDATA%\Tools Platform\data\` | `tools.db` (中台主库), `report.db` (报表库), `requirements.db` (需求库) | SQLite 业务持久化数据、自定义工具与系统快照 |
| **默认导出目录** | `%USERPROFILE%\Downloads\` | 月报 `.xlsx`、催办邮件、Outlook `.msg`、全量备份 `.zip` | 用户主动在页面中点击“导出/下载”的保存位置 |
