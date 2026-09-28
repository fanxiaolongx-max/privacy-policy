# 💼 驻外薪资换汇计算器 · 浏览器扩展 (Chrome & Edge MV3)

专为驻外员工、海外出海团队及跨国工作人员打造的轻量级薪资换汇与盈亏核算浏览器插件。基于 Manifest V3 标准开发，支持在 Google Chrome、Microsoft Edge 等 Chromium 内核浏览器中一键运行与商店发布。

---

## 🌟 核心特性与体验设计

- **与网页版体验完全一致**：保留原有高清晰度专业卡片视觉设计（蓝底公司结汇、红底自己换回、深灰底最终得失核算、顶部实时汇率看板）。
- **实时与历史汇率无缝获取**：
  - 自动拉取今日官方收盘与实时汇率（USD/EGP、USD/CNY）。
  - 支持回溯过去 45 天公司结算日的历史真实官方牌价。
  - 内置离线与断网降级机制，无网环境下亦可使用基准汇率或手动修改。
- **状态自动记忆持久化**：
  - 自动记录上次输入的美元工资总额、结算日、成交汇率及换汇埃镑金额，重新打开插件无需繁琐重复输入。
- **灵活视图模式**：
  - 默认 520px 黄金宽度 Popup 弹窗，即点即用，不打扰当前网页工作流。
  - 点击右上角「在新标签页打开（↗）」可一键切换为宽屏桌面完整版。
- **100% 商店合规 (MV3)**：
  - 纯本地 CSS 与原生 JavaScript 构建，无任何外部 CDN `<script>` 注入，符合 Chrome Web Store 及 Edge Add-ons 严格的安全内容策略（CSP）。
  - 配备 16x16、32x32、48x48、128x128、512x512 全套高品质图标。

---

## 📂 目录结构说明

```
overseas-salary-calculator/
├── manifest.json              # 扩展配置文件 (Manifest V3)
├── popup.html                 # 扩展弹出界面 (HTML5)
├── popup.css                  # 独立样式表 (无外部依赖)
├── popup.js                   # 业务逻辑与计算引擎 (含持久化与多源降级)
├── background.js              # 后台 Service Worker 进程
├── icons/                     # 全套图标资源 (16/32/48/128/512px)
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   ├── icon128.png
│   └── icon512.png
├── dist/                      # 商店发布压缩包
│   └── overseas-salary-calculator-v1.0.0-store.zip
├── README.md                  # 本文档
└── STORE_SUBMISSION_GUIDE.md  # 谷歌与 Edge 应用商店上架图文实战指南
```

---

## 🚀 方式一：本地快速安装调试（开发者模式）

无需打包，30 秒即可在当前电脑浏览器中加载体验：

### 在 Google Chrome 浏览器：
1. 打开 Chrome，在地址栏输入 `chrome://extensions/` 并回车。
2. 开启右上角的 **「开发者模式」** 开关。
3. 点击左上角的 **「加载已解压的扩展程序」** 按钮。
4. 选择本目录：`/Volumes/512G/06-工具开发/privacy-policy/tools-platform/extensions/overseas-salary-calculator`。
5. 安装完成！点击浏览器右上角拼图图标，将「💼 驻外薪资换汇计算器」固定到工具栏即可随时唤起。

### 在 Microsoft Edge 浏览器：
1. 打开 Edge，在地址栏输入 `edge://extensions/` 并回车。
2. 开启左侧菜单栏下方的 **「开发人员模式」**。
3. 点击 **「加载解压缩的扩展」**。
4. 选择本目录即可加载运行。

---

## 📦 方式二：在平台内置【F12 扩展打包】中使用

本计算器已完整内置到平台的「F12 扩展打包」工具库中：

1. 打开平台工具列表中的 **「F12 扩展打包」**。
2. 在 **「系统内置脚本」** 下拉菜单中，选择 **「💼 驻外薪资换汇计算器」**。
3. 平台将自动载入本模板，并支持：
   - 自由修改扩展名称与描述。
   - 自动或手动管理发布版本号（如 `1.0.0` -> `1.0.1`）。
   - 选择打包目标：
     - **Edge 商店 / Store**：自动剔除 `manifest.key`，确保商店审核合规。
     - **本地安装 / Local**：保留固定 key，保障本地重新安装时扩展 ID 不变。
4. 点击 **「打包为 Edge/Chrome 扩展 (.zip)」**，即可一键生成最新的安装包。

---

## 🛒 方式三：发布到应用商店

详细的账户注册、上架表单填写、隐私权限理由说明请查阅同目录下的 **[STORE_SUBMISSION_GUIDE.md](./STORE_SUBMISSION_GUIDE.md)**。
可以直接使用 `dist/overseas-salary-calculator-v1.0.0-store.zip` 上传审核。
