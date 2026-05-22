# Tools Platform — 工具中台

> 统一工具平台，前后端分离架构，数据服务端持久化（JSON + SQLite）。
> 目前集成四大核心工具模块：**UIVF12 抓取引擎**、**Task SLA 监控台**、**专业报表入库看板**、**一键催办与自动化月报系统**。

---

## 目录结构

```
tools-platform/
├── README.md
│
├── backend/                        # Node.js 后端服务
│   ├── server.js                   # 主服务入口（Express，端口 3030）
│   ├── package.json                # 依赖声明
│   ├── ecosystem.config.js         # PM2 进程守护配置
│   │
│   ├── routes/                     # API 路由层
│   │   ├── auth.js                 # 认证 & 用户管理路由
│   │   ├── sla.js                  # Task SLA 监控台 API
│   │   ├── uiv.js                  # UIVF12 脚本仓库 API
│   │   ├── upload.js               # 文件上传历史 API
│   │   └── db.js                   # SQLite 历史数据库读取 API
│   │
│   ├── middleware/
│   │   └── auth.js                 # JWT-like Token 鉴权中间件
│   │
│   ├── models/
│   │   ├── store.js                # 通用 JSON 文件读写工具
│   │   └── db.js                   # SQLite3 数据库初始化与操作封装
│   │
│   ├── data/                       # 持久化数据存储
│   │   ├── database.sqlite         # 核心关系型数据库（存储快照与入库明细）
│   │   ├── users.json              # 用户账号 & 密码哈希
│   │   ├── sessions.json           # 登录 Token 会话
│   │   ├── sla_targets.json        # SLA 预警目标（分月配置）
│   │   ├── sla_prefs.json          # SLA 用户偏好（列宽/列显示/排序/指标规则）
│   │   ├── sla_snapshots.json      # SLA 临时导入快照缓存
│   │   ├── sla_categories.json     # SLA 指标分类标签配置
│   │   ├── sla_groups.json         # SLA 指标分组配置
│   │   ├── uiv_scripts.json        # UIVF12 脚本仓库数据
│   │   ├── uiv_categories.json     # UIVF12 自定义分类
│   │   └── upload_history.json     # 文件上传操作历史
│   │
│   └── logs/                       # PM2 运行日志
│       ├── out.log
│       └── error.log
│
└── frontend/                       # 纯静态前端（HTML + Vanilla JS + CSS）
    ├── index.html                  # 平台主页（工具入口导航）
    │
    ├── pages/                      # 子页面
    │   ├── login.html              # 登录页
    │   ├── sla.html                # Task SLA 监控台页面
    │   ├── uivf12.html             # UIVF12 抓取引擎页面
    │   ├── report.html             # 报表入库看板页面
    │   ├── expedite.html           # WeLink 一键催办分发引擎
    │   └── monthly.html            # 自动化月报大屏页面
    │
    ├── css/                        # 样式文件
    │   ├── shared.css              # 公共样式（Navbar、布局、主题变量）
    │   ├── sla.css                 # SLA 监控台专属样式
    │   └── uivf12.css              # UIVF12 工具专属样式
    │
    └── js/                         # JavaScript 模块
        ├── shared/                 # 全局公共模块
        │   ├── api.js              # 统一 API 封装（自动带 Token 的 fetch）
        │   ├── navbar.js           # 顶部导航栏渲染 & 登出逻辑
        │   └── toast.js            # 全局 Toast 通知组件
        │
        ├── sla/                    # Task SLA 监控台模块（9个子模块）
        │   ├── upload.js           # Excel 解析、表格模式识别、历史快照
        │   ├── section.js          # 区块初始化、数据预处理、DOM 渲染
        │   ├── table.js            # 表格渲染（虚拟列宽、排序、过滤）
        │   ├── events.js           # 工具条事件（列设置、去重提取、指标配置）
        │   ├── metrics.js          # 顶部悬浮指标推送、预警呼吸灯、目标弹窗
        │   ├── prefs.js            # 用户偏好本地/服务端持久化
        │   ├── config.js           # SLA 规则配置（周期、预警阈值等）
        │   ├── history.js          # 操作历史记录面板
        │   └── categories.js       # 指标分类管理
        │
        ├── uivf12/                 # UIVF12 抓取引擎模块（5个子模块）
        │   ├── sidebar.js          # 脚本仓库侧边栏（分类、搜索、拖拽）
        │   ├── workbench.js        # 工作台主控（参数输入、模式切换）
        │   ├── generator.js        # 核心代码生成引擎（宏/F12 脚本）
        │   ├── save.js             # 脚本保存 & 仓库管理
        │   └── copy.js             # 代码复制 & 导出工具
        │
        └── report/                 # 报表与催办大屏模块
            ├── report.js           # 数据校对与一键入库逻辑
            ├── expedite.js         # WeLink 双语分发与文案自动化生成
            └── monthly.js          # 月度大屏渲染（ECharts、高清截图导出）
```

---

## 功能模块详解

### 1. 认证系统（Auth）

基于 Bearer Token 的轻量级鉴权机制，支持角色权限控制。

| 角色 | 权限 |
|------|------|
| `admin`（超级管理员） | 全量 CRUD，含用户管理、数据写入 |
| `readonly`（只读用户） | 仅查看数据，所有 POST/PUT/DELETE 被拒绝 |

**API 端点：**

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/auth/login` | 登录，返回 Token |
| POST | `/api/auth/logout` | 登出，销毁 Token |
| GET  | `/api/auth/me` | 获取当前登录用户信息 |
| GET  | `/api/auth/users` | 获取用户列表（仅 Admin） |
| POST | `/api/auth/users` | 创建新用户（仅 Admin） |
| DELETE | `/api/auth/users/:username` | 删除用户（仅 Admin） |
| PUT  | `/api/auth/users/:username/password` | 重置密码（仅 Admin） |

- Token 有效期：**7 天**
- 密码使用 **SHA-256 + Salt** 哈希存储
- 默认管理员账号 `admin` 不可删除

---

### 2. UIVF12 抓取引擎（`/uivf12`）

自动化脚本工程中心，生成并管理 UI.Vision 宏代码和 F12 控制台脚本。

**核心功能：**
- **脚本仓库管理**：按分类组织脚本，支持增删改查、拖拽换分类
- **代码生成引擎**：根据参数（CPC、NID、运营商区域）智能生成生产级脚本
- **多模式支持**：UI.Vision 宏模式 / F12 控制台模式
- **批量阵列执行**：支持 NetCare 中国、中东、德国三大区批量生成
- **双月裂变**：自动根据运行时间生成跨月翻页逻辑
- **备份还原**：一键导出/导入全量脚本仓库 JSON

**API 端点：**

| 方法 | 路径 | 描述 |
|------|------|------|
| GET  | `/api/uiv/scripts` | 获取全部脚本 & 分类列表 |
| POST | `/api/uiv/scripts` | 新增或覆盖脚本（支持批量） |
| DELETE | `/api/uiv/scripts/:id` | 删除指定脚本 |
| PATCH | `/api/uiv/scripts/:id/category` | 移动脚本分类（拖拽） |
| POST | `/api/uiv/categories` | 新建自定义分类 |
| DELETE | `/api/uiv/categories/:name` | 删除分类及其脚本 |
| GET  | `/api/uiv/backup` | 导出全量备份 |
| POST | `/api/uiv/backup` | 导入备份（覆盖或融合模式） |

---

### 3. Task SLA 监控台（`/sla`）

全局数据合控大中台，整改/风险/专项三类工单合一管理，提供 SLA 预警和指标推送。

#### 3.1 多模式表格导入

支持通过 Excel (.xlsx) 文件导入，自动识别三种表格模式：

| 模式 | 关键字段 | SLA 计算逻辑 |
|------|---------|------------|
| `rectification`（整改表） | `task_status` | Checking 状态：创建时间 +30 天；整改中：计划结束时间 |
| `risk`（风险表） | `风险状态` / `risk_status` | Risk Confirming +30 天；Risk Open：期望关闭时间 |
| `special`（专项表） | `状态-Status` 等 | 待确认：创建日期 +30 天；处理中：要求完成日期 |
| `other`（自由表） | 无限制 | 无 SLA 计算 |

#### 3.2 预警系统

- 🔴 **紧急**（≤10 天）：红色高亮行
- 🟠 **提醒**（≤30/82 天）：橙色提醒行
- 🔥 **重点关注**：手动标记行
- 顶部悬浮状态栏滚动展示所有指标，异常时触发呼吸灯警告

#### 3.3 顶部悬浮指标推送

在每张表上可配置自定义指标规则，支持三种模式：

| 模式 | 说明 |
|------|------|
| **提取单行数值** | IF 某列(X) 包含内容(Y) → 展示该行列(Z)的值 |
| **统计满足次数** | 筛选 X 列含 Y，统计 Z 列中含关键字 K 的行数 |
| **统计占比** | 满足条件行数 / 总行数，结果以百分比展示 |

> **特殊关键字：** 在 Y 或 K 输入框中输入 `[空]` 匹配空白单元格，`[非空]` 匹配有内容的单元格。

支持主指标 + 子指标（按分类分组）的两级层次结构，可跨表数据源引用。

#### 3.4 分月预警目标

为每个指标配置 1~12 月的目标值，支持两种比较方向（≥ 越大越好 / ≤ 越小越好），实时显示差距。

#### 3.5 表格操作工具

- **列设置**：自由显示/隐藏列，设置持久化到服务端
- **列去重提取**：一键提取指定列所有唯一值并复制到剪贴板
- **搜索过滤**：实时全文搜索当前表数据
- **排序**：点击列头升降序排列
- **导出**：导出当前视图（含过滤结果）为 Excel

#### 3.6 历史快照

每次导入数据自动保存快照（最多保留 50 次），支持快照命名、回溯历史、删除旧快照。

**API 端点：**

| 方法 | 路径 | 描述 |
|------|------|------|
| GET  | `/api/sla/targets` | 获取预警目标配置 |
| PUT  | `/api/sla/targets` | 保存预警目标配置 |
| GET  | `/api/sla/prefs/:schemaHash` | 获取指定表的用户偏好 |
| PUT  | `/api/sla/prefs/:schemaHash` | 保存指定表的用户偏好 |
| GET  | `/api/sla/snapshots` | 获取历史快照列表 |
| POST | `/api/sla/snapshot` | 新增历史快照 |
| PUT  | `/api/sla/snapshots/:id` | 更新快照（重命名等） |
| DELETE | `/api/sla/snapshots/:id` | 删除指定快照 |
| GET  | `/api/sla/categories` | 获取指标分类列表 |
| PUT  | `/api/sla/categories` | 更新指标分类列表 |
| GET  | `/api/sla/groups` | 获取指标分组配置 |
| PUT  | `/api/sla/groups` | 更新指标分组配置 |
| GET  | `/api/sla/config` | 导出全量配置（targets + prefs） |
| POST | `/api/sla/config` | 导入全量配置 |

---

### 4. 自动化报表与分发系统（`/report`, `/expedite`, `/monthly`）

基于 SLA 历史快照构建的全链路数据流转中枢，涵盖“入库、通报、复盘”闭环。

**核心功能：**
- **双重持久化引擎**：一键入库，自动剔除冗余项，将 JSON 复杂格式归档落盘至 `database.sqlite` 关系型数据库，支持长周期趋势查询。
- **动态加减分统筹**：支持 16 种事故/奖励的人工考评加减分干预（包含审计发现违规等）。
- **临期工单极速拦截**：在入库时自动弹窗锁定“本月底+5天”内即将超期的工单，精准分流入重点关注池。
- **WeLink 自动化一键催办**：自动组装中英双语催办文案，区分“群聊通知”、“会议邀请”、“个人单发”，一键复制到剪贴板，彻底解放手工粘贴统计的时间。
- **全景月度大屏**：
  - 基于 ECharts 的多维度动态历史曲线图。
  - 短板透视矩阵图、基准得分与评级系统。
  - **优雅无痕导出**：支持底层无截断长图 (Image) 与自适应长卷轴无损 PDF 导出，适用于企业级高层汇报。

---

## 全链路数据流走向图 (Data Flow)

整个工具平台采用 **配置与大容量数据分离** 的双底座架构（`JSON` + `SQLite`），下面梳理了核心业务从“文件导入”到“月报生成”的全生命周期数据走向：

```mermaid
graph TD
    %% 核心动作
    A([1. 本地 Excel 拖拽 / 一键导入]) -->|前端 SheetJS 解析| B{前端内存加工处理}
    B -->|合并/计算/提取| C(SLA 监控台视图渲染)
    
    %% 配置流
    J_Prefs[(sla_prefs.json)] -.->|读取指标提取规则| B
    J_Tgt[(sla_targets.json)] -.->|读取红线考核目标| B
    J_Cat[(sla_categories.json)] -.->|读取客户群归属| B

    %% 临时快照流
    C -->|点击 '快照留存' / 自动缓存| D[(sla_snapshots.json)]
    D -->|回溯功能| C
    
    %% 临期拦截与手工干预
    B -.->|探测_slaDays<月底+5天| E[发现并组装临期工单]
    C -->|在报表预览页进行手工加减分| F[计算 Manual Score]

    %% 落盘入库流
    C -->|点击 '同步至历史数据库'| G{数据聚合过滤组装}
    E --> G
    F --> G
    J_Tgt -.-> G
    
    %% 数据库结构
    G -->|拆分维度写入| DB[(database.sqlite)]
    
    subgraph SQLite 关系型数据库
        DB_S[表: ReportSnapshots<br/>存储快照元数据及 raw_data_json]
        DB_M[表: ReportMetricData<br/>按客户群拆解存储底层指标项明细]
    end
    DB --> DB_S
    DB --> DB_M

    %% 消费端流向
    DB_S -->|提取最新 raw_data_json 和 失败指标| H(WeLink 一键催办与分发)
    DB_M -->|分组聚合计算| H
    
    DB_S -->|历史快照集合 trends| I(全自动化月度大屏)
    DB_M -->|最新短板与排名| I
```

### 数据流转步骤详解

1. **第 1 步：解析与规则注入 (前端 -> 内存)**
   - 当用户在 `SLA 监控台`点击**一键导入**时，浏览器端通过 SheetJS 将数十 MB 的 Excel 直接转为 JSON。
   - 此时，系统会调用配置类文件（`sla_prefs.json` 规则、`sla_targets.json` 目标、`sla_categories.json` 群组），在内存中动态算出哪些指标达标、哪些未达标。
   
2. **第 2 步：临时快照存留 (内存 -> JSON)**
   - 当前的内存快照会被原样压缩，追加写入 `data/sla_snapshots.json`（仅保留最近 50 次，防止文件过大爆炸），主要用于在监控台的**历史回溯**下拉框中快速切换查看原表。

3. **第 3 步：一键统一入库 (内存 -> SQLite)**
   - 当用户进入报表预览界面，完成**“人工加减分操作”**后，点击**同步至数据库**按钮。
   - 系统会做两件事：
     - **拦截告警**：弹窗让用户勾选“本月即将超期”的拦截单（通过 `_slaDays` 识别）。
     - **轻量化归档**：剥离庞大无用的底层表格数据，仅将“考核项数值”、“是否达标标识”、“人工加减分”、“临期单数组”打包进 `raw_data_json`。
   - 最终请求 `POST /api/db/save_dashboard`，数据被拆分写入 `database.sqlite` 中的 `ReportSnapshots`（主表）和 `ReportMetricData`（指标明细从表）中，实现永久留存。

4. **第 4 步：全自动数据消费 (SQLite -> 页面引擎)**
   - **一键催办页 (`expedite.js`)**：直接请求 SQLite 中时间戳最新的快照。不仅提取 `ReportMetricData` 里的不达标项分配给各客户群负责人，还会从 `raw_data_json` 中解包出**临期工单预警**，组装成英文版 WeLink 发送脚本。
   - **月度大屏 (`monthly.js`)**：请求 SQLite 中所有的历史快照数据计算出 `trends` 渲染趋势图；然后取最新快照数据绘制矩阵透视图、加减分明细表以及高亮显示临期风险。

---

## 技术栈

| 层次 | 技术 |
|------|------|
| 后端运行时 | Node.js |
| 后端框架 | Express 4.x |
| 持久化引擎 | SQLite3（历史长线数据）+ JSON文件（配置策略） |
| 进程守护 | PM2 |
| 前端框架 | 纯 HTML + Vanilla JS（无框架依赖） |
| 可视化图表 | ECharts |
| 高清导出 | html2canvas + jsPDF |
| 样式 | Vanilla CSS（自定义设计系统） |
| Excel 解析 | SheetJS (xlsx) |
| 唯一 ID | uuid v9 |
| 文件上传 | multer |

---

## 快速启动

### 开发模式

```bash
cd backend
npm install
npm run dev    # 使用 nodemon 自动重启，端口 3030
```

### 生产模式（PM2）

```bash
cd backend
npm install --omit=dev

# 启动
pm2 start ecosystem.config.js

# 查看状态
pm2 status tools-platform

# 查看日志
pm2 logs tools-platform

# 停止
pm2 stop tools-platform

# 重启
pm2 restart tools-platform
```

启动后访问：
- 平台主页：`http://localhost:3030`
- UIVF12：`http://localhost:3030/uivf12`
- SLA 监控台：`http://localhost:3030/sla`
- 报表看板：`http://localhost:3030/report`
- 健康检查：`http://localhost:3030/api/health`

---

## 数据文件说明

所有数据以 JSON 格式持久化在 `backend/data/` 目录下，无需数据库，可直接备份整个 `data/` 目录迁移数据。

| 文件 | 说明 | 建议备份 |
|------|------|---------|
| `users.json` | 用户账号信息 | ✅ 是 |
| `sla_targets.json` | 预警目标配置（含分月目标） | ✅ 是 |
| `sla_prefs.json` | 各表列设置及指标规则（较大） | ✅ 是 |
| `sla_snapshots.json` | 历史导入快照（可能很大） | ✅ 是 |
| `uiv_scripts.json` | 脚本仓库（可能很大） | ✅ 是 |
| `sessions.json` | 登录会话（重启后自动续期） | ❌ 否 |

---

## 权限说明

前端所有写操作（新增、修改、删除）会在请求前检查用户角色，只读用户访问时相关按钮会被隐藏或禁用。后端 API 对所有非 GET 请求强制校验 `admin` 角色，双重保障。
