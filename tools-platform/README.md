# Tools Platform

Tools Platform 是一个面向运维数据抓取、SLA 指标导入、报表看板、月报分析、催办、PR 审计、自定义工具和需求管理的本地/内网工具中台。

项目采用 Express + 多页面静态前端 + SQLite 的轻量架构，同时提供 Windows Electron 安装版。安装版主要作为托盘常驻壳使用：启动本地服务、用默认浏览器打开 Web 主页、检查更新、查看运行日志，不再承载业务登录主页面。

## 当前能力

- 数据抓取：UIVF12 脚本仓库、F12 脚本、UI.Vision 批脚本、直接运行批脚本、测试批脚本、抓取进度悬浮面板。
- 自动化导入：UI.Vision 抓取完成后可自动打开 SLA 数据导入页，并以结构化 rows 方式触发智能分流合并，不上传原始 CSV。
- SLA 数据导入：风险、整改、CPT、SR、漏洞、红线、业务比对、日志稽查、图形化拦截等多类表自动识别、合并、快照和历史上传。
- 指标规则管理：全量指标规则总览、编辑、批量复制、快速映射、提取/统计/占比模式、搜索和目标预警配置。
- 报表看板：指标入库、比例计分、Others 额外监控分组、不计入总分指标展示、历史快照、额外监控指标说明。
- 月报页面：客户群/代表处/区域透视、短板矩阵、不达标项、Others 灰色弱化和说明区。
- 一键催办：基于报表快照生成催办视图，并带可读解释说明。
- 大屏看板：达标/未达标客户群、指标巡检、统计数量展示。
- 外部指标 API：提供移动端/外部系统只读读取入库指标、快照、异常指标和总览数据。
- PR 审计：PR 稽查配置、抽查导入、审计报表、截图和导出能力。
- FRT 核算：FRT 数据导入、快照和 KPI 自动核算。
- 需求广场：需求记录、状态流转、日志追踪。
- 数据探索：SQLite 数据浏览、最近日志收集并压缩下载。
- 存储迁移状态台：JSON -> SQLite 迁移状态检查、遗留 JSON 清理入口。
- 全局设置：顶部导航配置、更多工具分类、AI 助手配置、账号管理、备份恢复、程序更新提示。
- 自定义工具：上传/管理 HTML 工具，并通过独立入口访问。
- AI 助手：Gemini 聊天助手，支持页面上下文、token 成本估算和设置中心配置。

## 常用入口

默认端口为 `3030`。

| 页面 | 路径 | 用途 |
| --- | --- | --- |
| 首页 | `/` | 工具中台入口 |
| 登录页 | `/login.html` | 用户登录 |
| 数据抓取 | `/uivf12` | UIVF12/F12/UI.Vision 脚本仓库和批量运行 |
| 数据导入 | `/sla` | SLA 数据导入、规则配置、快照上传 |
| 报表看板 | `/report` | 指标看板、入库、比例计分 |
| 月报页面 | `/monthly` | 月度报告、短板矩阵、趋势分析 |
| 一键催办 | `/expedite` | 基于快照生成催办视图 |
| 大屏看板 | `/bigscreen` | 大屏展示 |
| PR 审计 | `/praudit` | PR 稽查和审计 |
| FRT 核算 | `/frt` | FRT KPI 自动核算 |
| 需求广场 | `/requirements` | 需求管理 |
| 存储迁移 | `/storage` | SQLite/JSON 迁移状态和清理 |
| 数据探索 | `/db-explorer` | SQLite 浏览和日志导出 |
| 自定义工具 | `/custom-tool` | 自定义工具管理 |
| 隐私政策/条款 | `/privacy`, `/terms` | 静态说明页，登录页也支持弹窗查看 |

## 目录结构

```text
tools-platform/
  backend/                 Express 服务、API、SQLite 仓储、迁移工具
    routes/                API 路由
    models/                数据模型和 SQLite/JSON 仓储
    middleware/            鉴权中间件
    logger/                按日归档日志
    data/                  后端数据、tools.db、自定义工具
    logs/                  PM2/开发环境日志
  frontend/                多页面静态前端
    index.html             首页
    pages/                 各业务页面
    js/shared/             顶部导航、API、AI 助手等公共能力
    js/uivf12/             数据抓取脚本仓库
    js/sla/                数据导入
    js/report/             报表、大屏、月报相关脚本
  data/                    report.db、requirements.db、图片/导出文件
  electron-main.js         Windows 桌面托盘壳主进程
  electron-preload.js      桌面更新/日志桥接
  package.json             Electron 打包配置
```

## 本地启动

推荐环境：

- Node.js 20 LTS 优先；当前开发机可运行更高版本，但遇到 `sqlite3` 原生依赖问题时建议回到 Node 20 LTS。
- npm 9+
- Windows 如需本地安装 `sqlite3`，建议安装 Visual Studio Build Tools 2022，并勾选 `Desktop development with C++`。

### 启动 Web 服务

Web 服务可独立在 `backend/` 下运行：

```bash
cd tools-platform/backend
npm install
npm run doctor
npm start
```

开发模式：

```bash
cd tools-platform/backend
npm install
npm run dev
```

指定端口：

```bash
PORT=3030 npm start
```

Windows PowerShell：

```powershell
$env:PORT=3030
npm start
```

### 生产运行 PM2

```bash
cd tools-platform/backend
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

常用命令：

```bash
pm2 restart tools-platform
pm2 logs tools-platform --lines 100
pm2 status
```

`backend/ecosystem.config.js` 默认：

- 进程名：`tools-platform`
- 端口：`3030`
- 最大内存自动重启：`256MB`
- PM2 日志：`backend/logs/out.log`、`backend/logs/error.log`
- 按日应用日志：`backend/logs/YYYY-MM-DD/out.log`、`backend/logs/YYYY-MM-DD/error.log`

## Windows 安装版

安装版使用 Electron + electron-builder + NSIS。现在的定位是“Windows 托盘常驻服务壳”：

- 启动本地 Express 服务。
- 用默认浏览器打开 Tools Platform Web 主页。
- 托盘单击/双击打开默认浏览器主页。
- 托盘菜单可打开数据抓取、数据导入、报表看板。
- 托盘菜单可检查更新、下载更新、重启安装。
- 托盘菜单可打开实时日志/更新进度窗口。
- 托盘菜单可开启/关闭开机自启动。
- 托盘“重启本地服务”会重启当前应用。

Windows 日志位置：

- Electron 和安装版后端日志写到系统用户数据目录下的 `logs/YYYY-MM-DD/out.log`、`error.log`。
- 安装版不会再尝试写入 `app.asar/backend/logs`，避免 `ENOTDIR`。
- 托盘“查看实时日志/更新进度”优先打开 Windows 原生 WinForms 窗口；如果 PowerShell/WinForms 启动失败，会自动回退到备用窗口并显示错误原因。

本地打包验证：

```bash
cd tools-platform
npm install
npm run build:win
```

GitHub Actions 当前会同时构建两种 Windows 版本，不再构建 macOS `.dmg`：

- `Tools-Platform-Setup-X.Y.Z.exe`：NSIS 安装版，支持快捷方式、卸载和应用内更新。
- `Tools-Platform-Portable-X.Y.Z.exe`：绿色免安装版，双击即用，不创建安装/卸载注册表项、快捷方式或开机自启动；更新时需从 GitHub Releases 手动下载新 EXE。

两种版本共用 Windows 当前用户数据目录，因此更换绿色版 EXE 不会丢失原有数据。推送到 `main` 后会自动递增 patch 版本、创建 `vX.Y.Z` tag，并发布两个 `.exe` 以及安装版所需的 `latest.yml` 和 `.blockmap` 到 GitHub Releases。

## 数据存储

项目正在从历史 JSON 文件存储逐步迁移到 SQLite。现在原则是：

- 业务数据优先以 SQLite 为准。
- 新功能尽量不再 fallback 到 JSON。
- 旧 Windows 安装版升级到新版本时，如只有 JSON 无 SQLite，应通过启动迁移流程自动迁移。
- 存储迁移状态台用于检查迁移状态、查看迁移结果、清理确认可删除的 JSON 文件。

主要存储位置：

| 位置 | 用途 |
| --- | --- |
| `backend/data/tools.db` | 账号、session、UIV 脚本、SLA 配置/目标/偏好/快照、上传历史、FRT、PR 审计配置等 |
| `data/report.db` | 报表看板入库数据、客户群得分、指标明细、月报读取数据 |
| `data/requirements.db` | 需求广场和流转日志 |
| `backend/data/custom-tools/` | 自定义 HTML 工具文件 |
| `data/images/` | 报表截图、Excel 等导出产物 |
| `backend/backups/` | 全局备份包 |
| `backend/data/*.json` | 历史数据、部分仍未迁移的配置、迁移前数据来源 |

仍需特别理解的 JSON：

- `ai_settings.json`、`custom_tools.json`、部分导航/页面配置属于轻量配置或历史配置，不等同于原始业务指标数据。
- SQLite 表中的 `*_json` 字段是数据库内容，只是字段内容是 JSON 字符串，不是文件 fallback。
- 清理 JSON 前应先确认 SQLite 已有相同或更多数据，再使用存储迁移状态台清理。

## 数据抓取到自动导入

UIVF12 支持两条链路：

1. 手动链路：用户运行 F12/UI.Vision 脚本，文件下载到浏览器下载目录，再在 `/sla` 手动一键批量导入。
2. 自动链路：点击“运行批脚本”后，脚本抓取 CSV 内容，浏览器端解析为结构化 rows，写入临时桥接会话，完成后在新标签页打开 `/sla` 并触发智能分流合并。

自动链路注意事项：

- 不上传原始 CSV 文件。
- 自动导入只发送解析后的结构化 rows 和必要元信息。
- 抓取报告会显示脚本任务数、实际文件数、自动导入数、失败文件和错误详情。
- 同名文件会按类似 Windows 下载命名策略区分，避免覆盖。
- 目标月份可在抓取完成报告页选择；不选则使用 SLA 页面默认月份。
- 批脚本运行时会显示悬浮进度面板、站点登录探测日志、各站点进度和总进度。

UI.Vision 相关建议：

- 运行批脚本前建议安装并启用 UI.Vision 扩展。
- XModules 是可选增强能力；未安装/未启用时，下载仍按浏览器默认下载目录处理。
- 不同浏览器 Chrome/Edge 均可，只要对应浏览器安装 UI.Vision 并允许 embedded macro。

## 报表与月报口径

报表看板 `/report` 负责计算和入库，月报 `/monthly` 主要读取入库后的历史结果。

关键口径：

- 入库时总分已经考虑 Others 额外监控分组不计入总分。
- 历史入库分数以入库当时计算结果为准。
- Others 分组指标在报表看板、月报和短板矩阵中以弱化样式展示，表示只监控、不计总分。
- “比例计分”支持常规指标和 Others 额外监控指标。
- 月报底部和一键催办底部包含用户容易疑惑点的解释说明。

## 主要 API

| 路由 | 模块 |
| --- | --- |
| `/api/auth` | 登录、退出、账号和 session |
| `/api/nav-settings` | 顶部导航和全局设置 |
| `/api/ai-settings` | AI 助手配置 |
| `/api/ai/chat` | Gemini AI 聊天 |
| `/api/uiv` | UIVF12 脚本仓库和 UI.Vision runner |
| `/api/uiv-auto-import` | 抓取后自动导入桥接会话 |
| `/api/sla` | SLA 配置、目标、分组、快照 |
| `/api/upload` | 上传历史和导入历史 |
| `/api/db` | 报表看板、月报、大屏相关数据 |
| `/api/external/metrics` | 外部/移动端只读指标 API，调用文档见 `docs/external-metrics-api.md` |
| `/api/praudit` | PR 审计 |
| `/api/frt` | FRT 快照和核算 |
| `/api/requirements` | 需求广场 |
| `/api/custom-tools` | 自定义工具 |
| `/api/global-backup` | 全局备份恢复 |
| `/api/storage` | 存储迁移状态和 JSON 清理 |
| `/api/db-explorer` | 数据探索和日志导出 |

## 鉴权与权限

- `/login.html` 和登录接口公开。
- 大部分 HTML 页面需要登录后访问，避免退出后页面先闪现再跳登录。
- 大部分 `/api/*` 需要登录。
- 非 GET 修改类请求默认要求管理员权限，部分业务路由内部还有额外校验。
- 登录页的隐私政策、服务条款通过弹窗展示，不强制跳转离开登录页。

## 全局设置与 AI 助手

全局设置包括：

- 顶部菜单显示、排序和更多工具分类。
- AI 助手 API Token、模型、费用参数和系统提示词。
- 账号管理。
- 备份恢复。
- 程序更新说明。
- 页面级配置入口。

AI 助手：

- 前端收集当前页面可见上下文。
- 后端调用 Gemini。
- 设置中心保存的 Token 优先于环境变量 `GEMINI_API_KEY`。
- 对 Gemini 503/high demand 有重试，但 503 本质上通常是模型高峰或服务端临时不可用。

## 备份恢复

全局备份覆盖：

- SQLite 数据库。
- 关键 JSON 配置。
- 自定义工具。
- 图片和导出产物。
- 上传附件和运行所需数据。

恢复会覆盖当前数据，建议先生成备份包再操作。远端主站同步会使用 `backend/runtime` 存储本机同步状态，该目录不作为业务数据备份主体。

## 日志

开发/PM2 环境：

- `backend/logs/out.log`
- `backend/logs/error.log`
- `backend/logs/YYYY-MM-DD/out.log`
- `backend/logs/YYYY-MM-DD/error.log`

Windows 安装版：

- 用户数据目录下的 `logs/YYYY-MM-DD/out.log`
- 用户数据目录下的 `logs/YYYY-MM-DD/error.log`
- 托盘菜单可打开日志目录或实时日志/更新进度窗口。

数据探索页 `/db-explorer` 也支持收集最近 N 天日志并压缩下载。

## 常见问题

### 1. 数据导入页某些请求重复两次？

目前部分页面初始化会先加载基础配置，再根据目标月份/快照/页面状态做二次刷新。重复请求不一定是 bug，优化前需要确认两次请求的调用目的和返回差异。

### 2. Gemini 503 是什么？

通常是 Gemini 服务端高峰或模型暂时不可用。后端已有短暂重试；如果仍失败，可稍后重试或切换模型。

### 3. Windows 安装版为什么不在 Electron 主窗口登录？

为了贴近 Windows 用户习惯，安装版只做托盘常驻、更新、日志和本地服务管理。业务页面统一在默认浏览器中打开，这样也更方便使用已登录浏览器、扩展和 UI.Vision。

### 4. 旧 Windows 用户只有 JSON 没 SQLite 怎么办？

新版本启动时应通过迁移流程把旧 JSON 写入 SQLite。迁移结果可在存储迁移状态台查看；如果迁移失败，应保留 JSON 并查看启动日志。

### 5. 可以直接删除 JSON 吗？

不要手工直接删。应先在存储迁移状态台确认 SQLite 已有相同或更多数据，再使用清理按钮。

## 开发约定

- 前端优先保持多页面静态架构，不引入复杂构建链。
- 新数据优先写 SQLite。
- 不再新增页面级“强制切换 JSON”入口。
- 迁移和清理必须可观测：有状态、有明细、有成功/失败结果。
- 涉及前端静态 JS 改动时，同步更新页面引用版本号，避免浏览器缓存旧脚本。
- 涉及后端或静态资源服务改动后，本地 PM2 环境需要 `pm2 restart tools-platform`。
- Windows 安装版行为改动需要重新打包发布后才会在用户机器生效。
