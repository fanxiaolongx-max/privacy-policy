# Tools Platform

> 综合性运维数据抓取、SLA 指标合控、质量看板、月报工作区、一键催办、胶片设计/素材库、专题分析、部门奖惩与负向事件治理、正向激励申报、会议考勤矩阵与花名册体系、智能订单与报价核验、加密考题金库、Dragon Claw 智能体、哈基米桌面宠物伴侣 (Desktop Pet) 与 2D/3D 知识图谱中台。

---

## 核心业务与架构全景

平台采用 **Express + 原生多页面静态前端 + SQLite** 的轻量高效架构，客户端生态原生覆盖 **Windows (NSIS 安装版 / 单文件免安装绿色版)** 与 **macOS (Apple Developer 签名与官方公证 DMG / ZIP 双架构)**，并配套 iOS/KMP 移动端工程生态。

- **🐾 桌面宠物伴侣 (哈基米 Hajimi Companion) 与智能客服**：
  - **系统级置顶伴侣视窗**：透明无边框悬浮小宠，具备待机呼吸、果冻弹性碰撞回弹 (Jelly)、抓取拖拽、抚摸爱心升腾 (Heart float) 与跌落重力动画。
  - **跨平台系统级全局键盘监听**：基于 `uiohook-napi` 无侵入捕获操作系统全局打字事件（macOS 辅助功能原生授权引导与 Windows 免配），敲击键盘实时联动小宠疯狂打字、连击热力徽章 (Combo)、狂热模式 (Fever) 抖动与可爱小鸭子音效 (`Ya1.mp3`/`Ya2.mp3`)。
  - **本地多模型额度实时探测器 (`quota-detector.js`)**：无缝嗅探探测本地 Antigravity / Gemini / Claude 额度（精确计算 5 小时与周重置百分比及倒计时提示）、Codex 状态，并在小宠动态对话气泡中直观展示。
  - **独立毛玻璃 AI 客服面板 (`pet-chat.html`)**：在桌宠旁一键呼出高颜值毛玻璃对话视窗，算法智能左右避让防遮挡；自动签发本地长期安全凭据，直通后端智能体与会话记忆。
  - **完整托盘与右键个性化控制**：支持体型缩放 (0.6x~2.5x)、音效音量与声效切换、打字反馈开关、气泡开关及记忆位置重置。
- **SLA 数据合控与指标规则引擎**：自动识别日常运维 8 大类表格、支持提取/统计/占比/加减分计算、跨表指标作用域自由切换、1~12 月分月目标基线，内置防意外清空的批量替换防护守卫 (Bulk replacement guard) 与双击紧凑字段详情弹窗。
- **自动化采集与 UIV AI 网站适配器**：UI.Vision 宏与 F12 抓取脚本工程仓库、AST 语法树自动分析脱敏、抓取 Rows 免上传自动导入流转会话。
- **报表看板与标准化月报工作区 (Monthly Workspace)**：
  - 客户群健康度积分、比例计分与短板透视矩阵，支持手动微调自动填充 (Manual adjust autofill)。
  - 行内交互式富文本编辑（单元格直接修改，浮动格式条加粗/斜体/5色文字调色盘）。
  - 文案一键重置（恢复本月/固定文案）、导入时间与数据源小字自由显隐。
  - 网络名称别名映射（与催办共用统一映射字典）与单据临期预警阈值。
  - 工程化管理与快照比对：月报工程 `.json` 导出/导入、云端快照库保存与多版本分屏比对 (Diff)。
  - 全矩阵交付：独立中文 PNG、独立英文 PNG、中英合一双语高清 PNG、一键打包 3 张下载，以及标准 PDF、单文件离线 HTML、原生带格式 Excel 与 Outlook 邮件草稿 (`.msg`) 一键导出。
- **专项治理与激励闭环工具链**：
  - **会议考勤与花名册体系 (`/api/meeting-snapshots`)**：
    - 多场次会议批量导入、场次实时切换与一键全屏跨场次对比矩阵。
    - 伪考勤与多日/截断后伪打卡智能识别。
    - 夜班/晚班 WFM 排班豁免判定。
    - 自动生成 WeLink 人员查询脚本并导入映射表，实现新旧工号（如 `m` 前缀归一化）自动合并与跨表同人考勤秒级比对。
    - 疑似离职/工号变更 ('Suspected Departure or ID Change') 自动排查与导出。
  - **餐单与采购订单核验器 (`order-validator`)**：基于内容驱动列画像 (Profiling) 自动纠偏错标表头，智能剥离 WK 预留周列与 Excel 序列号干扰，清洗悬空冗余括号，提供顶部每日差异汇总与默认折叠明细表格。
  - **供应商报价比对 (`supplier-quotation-comparison`)** 与 **强控业务比对检索 (`tool-mumxi3px`)**。
  - **加密考题金库与题库学习 (`exam-question-bank-vault`)**：题目与选项物理加密存储，支持 AI 辅助答题与思考日志分析。
  - **阿拉伯语/埃及口语沉浸式互动学习 (`tool-mtakhxqm`)**：课堂词汇发音跟读、字母操练与交互测验。
  - **专题分析中心 (`/topic-analysis`)**：NetCare 与 DataFab 导入快照的租户级历史中心、EOS 产品与版本收编进展月报。
  - **部门奖惩与负向事件治理 (`/api/department-reward-penalty`)**：红线违规登记、证据链留存、免责归因、离线单文件及 Pages 自动化推送。
  - **正向激励方案管理 (`/api/reward-program`)**：多维度激励方案设定、月度/季度申报立项、额度核算、证明凭证附件管理与审批流。
  - **PR 审计 (`/praudit`)**、**FRT 核算 (`/frt`)**、**需求广场 (`/requirements`)**、**问卷调研 (`/surveys`)**。
- **Dragon Claw 智能体与 2D/3D 双视图知识图谱**：
  - 专属绿恐龙品牌形象，多模型提供商 (Gemini/OpenAI/Claude/MiniMax) SSE 流式问答与成本核算，支持 Anthropic 单模型认证类型定制与历史模型用量一键清理。
  - 项目源码与文档 BM25 增量知识库，业务数据受限只读安全检索。
  - **租户全局跨页面历史会话检索与恢复 (`/api/ai/sessions-archive`)**：汇聚全页面活跃与归档会话，支持关键词检索与无缝续聊。
  - 2D 平面与 3D 空间透视视角切换，支持相机反投影空间拖拽交互。
- **光影大厅 (Tools Cinema) 与多媒体生态**：沉浸式多媒体影院大厅 (`/cinema.html`) 与流媒体分段切片服务 (`/api/media`)。
- **多源工具市场与扩展生态**：支持官方 GitHub `tool-market` 分支与多个第三方内网 HTTP(S) 静态源聚合，具备 Ed25519 签名与 SHA-256 指纹校验；自定义 HTML 工具沙箱隔离与单文件离线导出。
- **多租户业务隔离与双轨授权**：默认租户零迁移，新租户原子初始化；ECDSA P-256 离线高可用验签；现代化中英双语 License 激活界面配有动态进度条；单实例互斥锁与 SQLite 15 秒 Busy Timeout 防并发冲突自愈；全链路日志动态递归脱敏。

---

## 快速导航

- **核心工程主目录**：[`tools-platform/`](./tools-platform/)
- **完整架构与使用指南**：[`tools-platform/README.md`](./tools-platform/README.md)
- **桌面宠物 (哈基米) 专题指南**：[`tools-platform/README.md#211-桌面宠物伴侣-哈基米-hajimi-companion-详析`](./tools-platform/README.md#211-桌面宠物伴侣-哈基米-hajimi-companion-详析)
- **macOS 桌面构建与验收文档**：[`tools-platform/docs/macos-desktop-release.md`](./tools-platform/docs/macos-desktop-release.md)
- **常用页面入口清单**：[`tools-platform/README.md#7-常用页面入口清单`](./tools-platform/README.md#7-常用页面入口清单)
- **主要 API 路由全景表**：[`tools-platform/README.md#8-主要-api-路由全景表`](./tools-platform/README.md#8-主要-api-路由全景表)
- **桌面客户端文件与目录全景字典 (Windows & macOS)**：[`tools-platform/README.md#124-桌面客户端本地生成文件与目录全景字典-windows-vs-macos`](./tools-platform/README.md#124-桌面客户端本地生成文件与目录全景字典-windows-vs-macos)
- **外部指标 API 调用文档**：[`tools-platform/docs/external-metrics-api.md`](./tools-platform/docs/external-metrics-api.md)
- **题库助手与可选 AI 作答规范**：[`tools-platform/docs/f12-exam-ai.md`](./tools-platform/docs/f12-exam-ai.md)
- **阿拉伯语沉浸式口语互动文档**：[`tools-platform/docs/egyptian-classroom.md`](./tools-platform/docs/egyptian-classroom.md)
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

服务默认运行在 `http://localhost:3030`。更多详细部署、Windows/macOS 桌面客户端打包与运维文档请参阅 [`tools-platform/README.md`](./tools-platform/README.md)。

---

## 桌面客户端落地文件与目录说明 (Windows vs macOS)

平台通过 GitHub Actions 自动构建并发布 Windows 与 macOS 桌面客户端：

| 平台 / 版本类型 | 默认安装 / 运行物理路径 | 包含文件 | 作用与生命周期 |
| :--- | :--- | :--- | :--- |
| **Windows 安装版 (NSIS Setup)** | `%LocalAppData%\Programs\tools-platform\` | `Tools Platform.exe`, `app.asar`, `Uninstall.exe`, DLLs | 程序核心运行环境，覆盖安装或卸载时变动 |
| **Windows 绿色版 (Portable)** | `%TEMP%\electron-builder-portable\...` | 临时 asar 与运行载荷 | 绿色版运行时临时解压，**退出即销毁，0 注册表残留** |
| **macOS 客户端 (DMG / ZIP)** | `/Applications/Tools Platform.app/` | `Contents/MacOS/Tools Platform`, `app.asar`, Frameworks | Apple Developer 签名与公证原生应用，支持 arm64/x64 |
| **持久化用户数据 (Windows)** | `%APPDATA%\Tools Platform\` | `desktop-license.json`, `desktop-pet-config.json`, `logs\`, `data\*.db` | **核心配置、授权、桌宠设置、日志与业务数据（升级不丢失）** |
| **持久化用户数据 (macOS)** | `~/Library/Application Support/Tools Platform/` | 同上（`desktop-license.json`, `desktop-pet-config.json`, `data\*.db` 等） | **macOS 核心业务与配置持久化目录（重启/换包数据不丢失）** |
| **核心数据库 (多端共享结构)** | 用户数据目录下的 `data/` | `tools.db` (中台主库), `report.db` (报表库), `requirements.db` (需求库) | SQLite 业务持久化数据、自定义工具与系统快照 |
| **默认导出目录** | 操作系统默认的“下载”目录 (`Downloads`) | 月报 `.xlsx`、催办邮件、Outlook `.msg`、全量备份 `.zip` | 用户主动在页面中点击“导出/下载”的保存位置 |

