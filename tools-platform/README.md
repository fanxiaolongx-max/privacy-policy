# Tools Platform

一个基于 `Node.js + Express + 原生 HTML/CSS/JS` 的内部工具中台。当前项目不是单一工具，而是一套共用登录、权限、导航、AI 助手与数据存储能力的多模块平台。

按当前代码实际情况，平台首页已接入 7 个业务模块：

- `数据抓取`：UIVF12 脚本生成与仓库管理
- `数据导入`：Task SLA 监控与 Excel 导入分析
- `报表看板`：快照入库、排名矩阵、指标透视
- `一键催办`：基于快照生成催办文本与分发策略
- `月报页面`：历史趋势分析、双语月报、导出图片/PDF
- `需求管理`：需求提报、状态流转、日志追踪
- `PR 稽查`：Excel 批量自检与审计报告页面

## 1. 技术栈

### 前端

- 原生 `HTML + CSS + JavaScript`
- 公共模块：`API` 封装、导航栏、Toast、悬浮 AI 助手
- 页面脚本按模块拆分，未使用打包器

### 后端

- `Express 4`
- `cors`
- `sqlite3`
- `exceljs`
- `uuid`
- `@google/generative-ai`（用于页面内 AI 助手）

## 2. 项目结构

```text
tools-platform/
├── README.md
├── frontend/
│   ├── index.html
│   ├── pages/
│   │   ├── login.html
│   │   ├── uivf12.html
│   │   ├── sla.html
│   │   ├── report.html
│   │   ├── expedite.html
│   │   ├── monthly.html
│   │   ├── requirements.html
│   │   ├── praudit.html
│   │   ├── privacy.html
│   │   └── terms.html
│   ├── js/
│   │   ├── shared/
│   │   ├── sla/
│   │   ├── report/
│   │   └── uivf12/
│   └── css/
├── backend/
│   ├── server.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── uiv.js
│   │   ├── sla.js
│   │   ├── upload.js
│   │   ├── db.js
│   │   ├── requirements.js
│   │   └── ai.js
│   ├── middleware/
│   ├── models/
│   ├── data/
│   └── package.json
└── data/
    ├── report.db
    ├── requirements.db
    └── images/
```

## 3. 模块概览

### 3.1 UIVF12 数据抓取

对应页面：`/uivf12`

核心能力：

- 脚本仓库管理
- 自定义分类管理
- 批量保存、覆盖、拖拽换分类
- 备份导出与导入
- 生成 UI.Vision 宏代码与 F12 控制台脚本

后端接口：

- `GET /api/uiv/scripts`
- `POST /api/uiv/scripts`
- `DELETE /api/uiv/scripts/:id`
- `PATCH /api/uiv/scripts/:id/category`
- `GET /api/uiv/backup`
- `POST /api/uiv/backup`
- `POST /api/uiv/categories`
- `DELETE /api/uiv/categories/:name`

### 3.2 SLA 数据导入与监控

对应页面：`/sla`

核心能力：

- Excel 导入与快照保存
- 指标分类、分组、目标阈值维护
- 表格偏好持久化
- 自定义指标与重命名
- 历史快照管理

后端接口：

- `GET/PUT /api/sla/categories`
- `GET/PUT /api/sla/groups`
- `GET/PUT /api/sla/targets`
- `GET /api/sla/snapshots`
- `POST /api/sla/snapshot`
- `PUT /api/sla/snapshots/:id`
- `DELETE /api/sla/snapshots/:id`
- `GET/PUT /api/sla/prefs/:schemaHash`
- `GET/POST /api/sla/config`
- `POST /api/sla/rename-metric`

### 3.3 报表看板

对应页面：`/report`

核心能力：

- 将快照结果写入 SQLite
- 读取历史快照
- 生成客户群排名与短板透视矩阵
- 保存截图与原始 Excel 附件
- 维护催办分发策略等平台配置

后端接口：

- `POST /api/db/save`
- `GET /api/db/snapshots`
- `GET /api/db/latest_failing`
- `GET /api/db/failing/:snapshot_id`
- `GET /api/db/config/:key`
- `POST /api/db/config/:key`

### 3.4 一键催办

对应页面：`/expedite`

依赖 `SLA` 与 `报表看板` 数据，主要用于：

- 读取失败指标快照
- 生成催办文本
- 维护分发名册与策略
- 输出截图与附件引用

### 3.5 月报页面

对应页面：`/monthly`

核心能力：

- 基于日报快照聚合趋势数据
- 7/30/90 天或自定义时间段分析
- 中英双语切换
- 导出长图和 PDF

后端接口：

- `GET /api/db/monthly_report_data`

### 3.6 需求管理

对应页面：`/requirements`

核心能力：

- 用户提交需求
- 管理员推进状态流转
- 记录需求日志
- 删除需求

后端接口：

- `GET /api/requirements`
- `GET /api/requirements/:id`
- `POST /api/requirements`
- `PUT /api/requirements/:id`
- `DELETE /api/requirements/:id`

状态流转以当前代码为准：

- `提交`
- `需求接受`
- `需求实现中`
- `需求完成`
- `验收完成`
- `需求评价`
- `已拒绝`

### 3.7 PR 稽查

对应页面：`/praudit`

这是一个前端侧审计页面，当前代码中主要能力为：

- 导入 Excel
- 批量检查任务项
- 记录不通过原因
- 生成打印/导出用审计报告

## 4. 认证与权限

项目使用自定义 Bearer Token 鉴权。

- 登录接口：`POST /api/auth/login`
- 退出接口：`POST /api/auth/logout`
- 当前用户：`GET /api/auth/me`
- 用户管理：`GET/POST/DELETE/PUT /api/auth/users...`

角色：

- `admin`：可读写全部模块，并可管理用户
- `readonly`：只能执行只读请求

权限规则以 `backend/server.js` 当前实现为准：

- `/api/auth/*` 独立处理鉴权
- `/api/requirements` 自行在路由内部控制权限
- 其他 `/api/*` 默认先过 `checkAuth`
- 大部分非 `GET` 请求要求 `admin`

Token 会话默认保存在：

- `backend/data/sessions.json`

## 5. 数据存储

当前项目同时使用 JSON 与 SQLite，两套存储都在运行。

### JSON 存储

主要位于 `backend/data/`，例如：

- `users.json`
- `sessions.json`
- `uiv_scripts.json`
- `uiv_categories.json`
- `sla_targets.json`
- `sla_prefs.json`
- `sla_snapshots.json`
- `sla_categories.json`
- `sla_groups.json`
- `upload_history.json`

### SQLite 存储

当前实现里，报表与需求模块使用根目录下的 `data/`：

- `data/report.db`
- `data/requirements.db`
- `data/images/`

仓库中也存在 `backend/data/*.db` 文件，说明项目处于一段混合存储演进阶段。若后续继续维护，建议统一数据库目录，避免运行时读写分散。

## 6. 运行方式

### 6.1 安装依赖

项目只有后端需要安装 npm 依赖：

```bash
cd backend
npm install
```

### 6.2 启动开发环境

```bash
cd backend
npm run dev
```

或：

```bash
cd backend
npm start
```

默认端口：

- `3030`

启动后访问：

- 首页：[http://localhost:3030](http://localhost:3030)
- 登录页：[http://localhost:3030/login.html](http://localhost:3030/login.html)
- UIVF12：[http://localhost:3030/uivf12](http://localhost:3030/uivf12)
- SLA：[http://localhost:3030/sla](http://localhost:3030/sla)
- 报表看板：[http://localhost:3030/report](http://localhost:3030/report)
- 一键催办：[http://localhost:3030/expedite](http://localhost:3030/expedite)
- 月报页面：[http://localhost:3030/monthly](http://localhost:3030/monthly)
- 需求管理：[http://localhost:3030/requirements](http://localhost:3030/requirements)
- PR 稽查：[http://localhost:3030/praudit](http://localhost:3030/praudit)

健康检查：

- `GET /api/health`

## 7. 环境变量

目前代码里实际使用到的环境变量：

- `PORT`：后端端口，默认 `3030`
- `GEMINI_API_KEY`：启用页面内 AI 助手所需

如果未配置 `GEMINI_API_KEY`，`/api/ai/chat` 会返回 `503`，但平台其他功能仍可运行。

## 8. 前端公共能力

### API 封装

`frontend/js/shared/api.js` 提供：

- 自动附带 `Authorization: Bearer <token>`
- 401 自动清理本地登录态并跳转登录页
- `GET/POST/PUT/PATCH/DELETE` 简单封装
- 上传历史记录 `logHistory`

### AI 助手

`frontend/js/shared/ai-assistant.js` 会：

- 注入一个全局悬浮助手
- 抓取当前页面上下文
- 调用 `POST /api/ai/chat`
- 基于 Gemini 返回结果进行 Markdown 渲染

## 9. 当前实现现状

结合代码现状，维护这个项目时建议先注意下面几点：

1. 仓库里同时存在 `backend/data/` 和根目录 `data/`，不同模块落盘位置不一致。
2. 前端页面较多，且大部分为原生脚本直连 API，没有构建流程与类型约束。
3. `backend/node_modules/` 已被提交进仓库，仓库体积会偏大。
4. README 旧版中“4 个模块”的描述已经过期，当前首页展示和服务路由实际上是 7 个模块。

## 10. 适合的后续整理方向

- 统一所有 SQLite 与附件目录
- 为各模块补充初始化数据说明
- 为登录、需求流转、报表入库补最小可回归测试
- 拆分前端内联脚本，降低单页面复杂度
- 增加部署说明与默认账号初始化脚本

