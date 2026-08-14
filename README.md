# Tools Platform

> 综合性运维数据抓取、SLA 指标合控、质量看板、月报分析、一键催办、胶片设计/素材库、专项治理与 AI 智能中台。

---

## 快速导航

- **核心工程主目录**：[`tools-platform/`](./tools-platform/)
- **完整架构与使用指南**：[`tools-platform/README.md`](./tools-platform/README.md)
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
