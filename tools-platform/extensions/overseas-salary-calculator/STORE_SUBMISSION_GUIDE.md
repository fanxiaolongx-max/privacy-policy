# 🚀 驻外薪资换汇计算器 · 谷歌与 Edge 商店上架实战全流程指引

本文档收录了将「驻外薪资换汇计算器」发布至 **Microsoft Edge 外挂程序应用商店** 与 **Google Chrome 网上应用店** 的**完整表单填写内容、预制图像素材路径、认证说明模版及审核必过技巧**。所有内容均已通过真实审核规则对齐，可直接对照复制粘贴。

---

## 📑 准备工作速览

| 项目 | 说明 | 对应文件 / 建议 |
| :--- | :--- | :--- |
| **安装包文件** | 纯净标准的 MV3 ZIP 发布包 | `dist/overseas-salary-calculator-v1.0.0-store.zip` |
| **商店图标 (128x128)** | 符合 Chrome 16px Padding 规范 | `store-assets/store_icon_128x128.png` |
| **扩展徽标 (300x300)** | Edge 商店 1:1 PNG 徽标 | `store-assets/logo_300x300.png` |
| **屏幕截图 (1280x800)** | 官方标准高清界面展示图 | `store-assets/screenshot_1280x800.png` |
| **小促销磁贴 (440x280)** | 商店推荐位展示图（选填） | `store-assets/small_promo_440x280.png` |
| **大促销磁贴 (1400x560)**| 商店轮播大横幅图（选填） | `store-assets/large_promo_1400x560.png` |
| **商店分类** | 统一标准类别 | **「高效工作」 / `Productivity`** |

---

## 🌊 第一部分：Microsoft Edge 商店详细填报指南 (Partner Center)

> Edge 商店后台地址：[Microsoft Partner Center 控制台](https://partner.microsoft.com/dashboard/microsoftedge)  
> 费用：**完全免费**（无注册费） | 审核周期：**24 ~ 48 小时**

### 一、属性（Properties）
- **分类（Category）**：选择 **`高效工作`**（英文对应 `Productivity`）。
- **支持链接**：`https://github.com/fanxiaolongx-max/privacy-policy`

---

### 二、隐私（Privacy）表单填写（核心环节）

#### 1. 单一用途描述 * (Single Purpose Description)
> **直接复制并粘贴：**  
> 本扩展专门用于帮助跨国与驻外员工进行薪资换汇与汇差盈亏核算。用户可输入固定美元薪资、选择公司结算日，获取实时官方牌价折算到手埃镑，并按实际成交汇率计算换回人民币后的最终损益。功能纯粹单一，无任何无关冗余模块。  
> *(This extension is specifically designed for overseas and cross-border employees to calculate salary foreign exchange rates and profit/loss changes between USD, EGP, and CNY.)*

#### 2. 权限理由 (Permission Justification)
- **`storage` 理由 \***：  
  > 仅用于在用户本地浏览器（chrome.storage.local）中保存用户输入的工资基数、换汇金额及语言偏好（中文/英文），避免用户每次打开弹窗都需要重复输入。所有数据完全保存在用户本地设备，绝不上传到任何远程服务器。
- **主机权限理由 \***（针对 `https://cdn.jsdelivr.net/*`）：  
  > 用于通过 jsDelivr CDN 获取公开开源的每日官方收盘外汇牌价 JSON 数据（fawazahmed0 currency-api），以展示最新的 USD/EGP 和 USD/CNY 实时基准汇率。该权限仅用于只读请求公开静态汇率数据，不读取或修改任何用户网页内容，不涉及任何用户个人数据。

#### 3. 你在使用远程代码吗? * (Are you using remote code?)
- 👉 **必须选择：【否】（No）**
- **理由（若有输入框）**：  
  > 本扩展所有 JavaScript、HTML 和 CSS 文件均已完整打包在扩展包本地，完全遵循 Manifest V3 标准，不包含任何外部脚本加载或动态代码求值（无外部 script，无 eval）。

#### 4. 数据使用量 (Data Usage)
- **收集哪些用户数据？**：👉 **全部不要勾选**（选择“不收集任何用户数据 / None”）。

#### 5. 隐私策略 URL (Privacy Policy URL)
- 填入：`https://github.com/fanxiaolongx-max/privacy-policy`

#### 6. 披露内容属实声明
- 👉 **勾选全部 3 项证实声明**（不出售用户数据、不用于信贷核准等）。

---

### 三、详细信息（Store Listings - 英语 / 中文）

> 💡 **重点说明**：程序包已内置 Chromium 官方 `_locales` 原生国际化规范（包含 `zh_CN` 与 `en`）。重新上传 `overseas-salary-calculator-v1.0.0-store.zip` 后，Edge Partner Center 的 Store Listings 会**自动识别并列出两大语言条目**：
> 1. **`Chinese (Simplified) / 中文(简体)`**：扩展名称自动抓取为 `驻外薪资换汇计算器`；
> 2. **`English (United States) / 英语(美国)`**：扩展名称自动抓取为 `Overseas Salary Currency Calculator`（已彻底解决被锁死为中文的问题！）。
>
> *(根据商店要求，至少填写其中 1 种语言即可提交；推荐将中英两种语言都填写完整，以获得全球与国内最佳曝光)*

---

#### 1. 英语 (美国) - English (United States) 填写内容

- **扩展名**：自动显示 `Overseas Salary Currency Calculator`（由清单提供）
- **描述 \*（Description）**：直接复制粘贴以下英文：
```text
Overseas Salary Currency Exchange Calculator is an essential financial productivity tool designed specifically for expatriates, cross-border professionals, and international remote teams.

Key Features:
1. Live & Historical Official FX Rates: Automatically tracks daily official benchmark exchange rates for USD/EGP and USD/CNY via public open-source currency APIs. Supports historical rate retrospective for up to 45 company settlement days.
2. Dual Payroll Conversion (USD → EGP → CNY): Enter your base USD salary, select your company settlement date to calculate actual local EGP received, and calculate the exact CNY converted back with one-click full payout (Max All).
3. Real-Time Profit / Loss Audit: Compare your final received CNY against the payday benchmark value with instant visual badges (FX Gain, FX Loss, or Break-even).
4. Full Bilingual Support (English & Chinese): Instant one-click toggle between English and Chinese across all labels, dropdowns, and status badges.
5. Privacy & Offline Safe: All calculations and user inputs (salary, deal rates, language preference) are saved strictly inside your local browser storage. No user data is ever uploaded to any remote server.
6. Flexible View Modes: Instant popup under your extension toolbar, plus one-click expansion to a full-screen desktop tab.
```
- **搜索词（Search terms，最多 7 个）**：
  1. `salary calculator`
  2. `currency exchange`
  3. `forex calculator`
  4. `expat salary`
  5. `exchange rate`
  6. `egp to cny`
  7. `currency converter`
- **上传图像**：
  - 扩展徽标 \*：上传 `store-assets/logo_300x300.png`
  - 屏幕截图 \*：上传 `store-assets/screenshot_1280x800.png`
  - 小促销磁贴（选填）：上传 `store-assets/small_promo_440x280.png`
  - 大促销磁贴（选填）：上传 `store-assets/large_promo_1400x560.png`

---

#### 2. 中文 (简体) - Chinese (Simplified) 填写内容

- **扩展名**：自动显示 `驻外薪资换汇计算器`（由清单提供）
- **描述 \*（Description）**：直接复制粘贴以下中文：
```text
【驻外薪资换汇计算器 - 专为驻外与跨国出海员工定制的薪资核算工具】

核心功能：
1. 实时与历史官方牌价同步：自动追踪 USD/EGP 与 USD/CNY 官方收盘汇率，支持回溯过去 45 天发薪结算日历史汇率。
2. 双重换汇智能测算：美元工资设定、实际到手埃镑折算、一键全额换回与成交汇率填报。
3. 精准盈亏对账：全流程展示发薪日基准价值、实际到手人民币与最终盈亏差额（赚回汇差 / 汇兑损失 / 无亏无赚）。
4. 全界面中英双语切换：右上角一键在中文与英文之间秒切，无缝适配多语言办公场景。
5. 纯本地隐私安全：数据仅保存在浏览器本地，自动记忆上次输入，不上传任何服务器。
6. 弹窗与全屏双重视图：浏览器右上角轻量唤起，或一键在新标签页全屏使用。
```
- **搜索词（Search terms，最多 7 个）**：
  1. `驻外薪资`
  2. `汇率计算器`
  3. `换汇计算`
  4. `埃及镑汇率`
  5. `外汇换算`
  6. `薪资核算`
  7. `出海工具`
- **上传图像**：直接使用相同的 `store-assets/` 下的各尺寸图片即可。

---

### 四、发布与认证说明（Certification Notes）

在最终的「发布」页面：

#### 1. 是否需要凭据、帐户或其他信息? *
👉 **必须勾选：【不需要，测试人员无需任何附加信息即可访问和测试所有功能】**

#### 2. 认证说明 (Certification Notes) *
> **直接复制并粘贴以下英文测试说明：**
> 
> ```text
> Dear Microsoft Edge Extension Review Team,
> 
> Thank you for reviewing the Overseas Salary Currency Exchange Calculator extension.
> 
> [Overview]
> This extension is a standalone financial productivity tool designed for expatriates and cross-border employees to calculate salary currency conversion and net gain/loss (USD → EGP → CNY). It operates purely locally in the browser with no user accounts, logins, or authentication required.
> 
> [Steps to Test]
> 1. Click on the extension icon in the toolbar to open the popup window.
> 2. Observe the top banner displaying real-time benchmark rates for USD/EGP and USD/CNY (retrieved via public open-source API from jsDelivr).
> 3. In "Company Payroll Settings", enter any base USD salary (e.g., 2000) and select any settlement date from the dropdown. The actual EGP received is calculated automatically.
> 4. In "Personal Conversion", click the "Max All / 全额换回" button to populate the EGP amount, and enter an executed deal rate (e.g., 7.20).
> 5. The dark "Final CNY Settlement & Gain/Loss Audit" card at the bottom instantly updates with benchmark value, received CNY, and net profit/loss badges.
> 6. Click the "EN / 中" button in the top-right header to test seamless bilingual switching between English and Chinese.
> 7. Click the expand button (top-right) to test opening the full-page view in a new browser tab.
> 
> [Permissions & Network]
> - storage: Used strictly to store user inputs and language preference locally.
> - cdn.jsdelivr.net: Used solely for fetching public daily close foreign exchange JSON data.
> - No remote executable code or external scripts are used. All JS and CSS are bundled locally in compliance with MV3.
> 
> If you have any questions, please feel free to contact us. Thank you!
> ```

---

## 🌐 第二部分：Google Chrome 网上应用店上架指引 (Chrome Web Store)

> Chrome 控制台地址：[Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)  
> 费用：一次性 5 美元 | 审核周期：**1 ~ 3 个工作日**

### 一、安装包上传
- 点击右上角 **「新建商品（New Item）」**，直接上传 `dist/overseas-salary-calculator-v1.0.0-store.zip`。

### 二、商店图标规范与上传（核心注意点）
- 根据 [Chrome Web Store 图片指南](https://developer.chrome.com/webstore/images#icons)：
  - 图标必须为 **128 x 128 像素** PNG 格式。
  - **关键合规规则**：主体图案需居中控制在约 96x96 区域，四周保留约 16px 透明安全边距（Padding），防止商店裁剪切掉边缘。
  - 👉 **直接上传我们为您专门生成的标准文件**：`store-assets/store_icon_128x128.png`。

### 三、隐私权实务声明（Privacy Practices）
- **单一用途（Single Purpose）**：填入前述第一部分单一用途说明。
- **权限合理性说明（Permission Justification）**：
  - `storage`: *"Used strictly to save user's calculator inputs (base salary, custom rates) and language preference locally on their device, preventing repetitive data entry."*
  - `host_permissions`: *"Used solely to fetch public, open-source daily foreign exchange rate data (USD/EGP/CNY) from jsDelivr currency API for accurate local calculations."*
- **数据收集**：全部声明为不收集任何个人数据。

### 四、商店详情与截图
- 分类选择：**生产力工具（Productivity）**。
- 详细说明与截图：使用前述相同文本与 `store-assets/screenshot_1280x800.png`。

---

## 💡 常见审核解答（FAQ）

1. **问：为什么上传时不能包含 `manifest.key`？**  
   - 答：应用商店官方会自动为发布包生成签名并分配公钥。如果包含开发者本地私有 key，商店会报错拒收。本项目提供的 `dist/*.zip` 及 F12 扩展打包的「商店」模式已自动剔除该字段。
2. **问：为什么不能加载远程 CDN 脚本？**  
   - 答：Manifest V3 安全红线严禁加载外部动态 JS。本项目所有样式与逻辑已全部本地化打包，完全免除审查风险。
3. **问：后续版本如何更新？**  
   - 答：修改 `manifest.json` 中的 `"version": "1.0.1"`，重新打包为 zip，在控制台点击「上传新程序包」即可发布升级。
