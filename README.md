# Tools Platform

> 综合性运维数据抓取、SLA 指标合控、质量看板、月报分析、一键催办、胶片设计/素材库、专项治理与 AI 智能中台。

---

## 快速导航

- **核心工程主目录**：[`tools-platform/`](./tools-platform/)
- **完整架构与使用指南**：[`tools-platform/README.md`](./tools-platform/README.md)
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
| **默认导出目录** | `%USERPROFILE%\Downloads\` | 月报 `.xlsx`、催办邮件、全量备份 `.zip` | 用户主动在页面中点击“导出/下载”的保存位置 |
