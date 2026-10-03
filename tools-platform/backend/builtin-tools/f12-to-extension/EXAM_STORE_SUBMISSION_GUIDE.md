# 题库与答题助手 · Chrome / Edge 上架指南

核对日期：2026-10-03。本文依据当前内置脚本与打包器编写，参考驻外薪资换汇计算器指南的结构。指南用于准备提交，不代表已通过审核。发布前重新核对官方政策和最终 ZIP。

## 1. 是否可以上架

可以准备向 Chrome Web Store 和 Microsoft Edge Add-ons 提交，但当前包不能视为已经满足全部发布条件。题库管理、翻译和学习解析有明确学习用途；自动选择答案、自动翻页、采集考试内容存在使用授权和审核风险。这是基于当前功能的判断，并非官方宣布所有答题工具都被禁止。

不得以“纯本地、完全不联网、只有翻译功能”描述包含 AI 调用和自动作答的实际包。不要承诺考试通过率、检测规避或不可破解加密。只应在自有或获得授权的练习内容上使用；网站规则不允许时不应使用自动作答。不要随包附带第三方付费或未授权题库，不使用第三方机构徽标暗示官方授权。

## 1.1 旧版升级填写对照（发布者内部参考）

根据发布者提供的历史信息，旧版题库与答题助手曾成功上架；所提供的旧表单截图强调用户主动启动、当前页面操作、本地题库保存，以及应用已保存答案或题型策略。这可以作为维护原商店项目的填写参考，但不代表商店已经认可新版的 AI 功能、新增权限或数据处理方式，也不能据此推算新版通过率。本节供发布者准备版本更新使用，不必复制到面向用户的商店介绍。

### 原说明可以沿用的部分

- activeTab：若最终包仍在用户点击扩展后手动启动，可保留“访问当前支持页面的可见题目和选项，不访问非活动标签或浏览历史”的说明。
- scripting：若仍注入包内脚本、在用户启动后操作当前页面，可保留对应理由和“不注入远程托管脚本”的说明。以最终包验证结果为准。
- 本地题库管理与导入导出：可继续作为单一用途的核心描述；新版补充加密保险库、学习解析与可选 AI 辅助作答。

### 必须更新的部分

- storage：保留本地保存题库、标注和偏好的用途，并补充加密记录与可信会话存储。旧说明中的“不与第三方共享”不能作为全部题目数据处理的概括；调用 AI 时相关题目内容会发送给启用的模型服务。权限保存用途与 AI 外发披露应分别写清。
- 主机权限：旧说明“仅限指定考试网站”不再覆盖当前 AI 包的 https://*/*、localhost 和 127.0.0.1 权限。应区分支持页面的题目读取/作答与用户配置模型端点的请求，并审查最小权限。
- 单一用途：删除“所有题库处理和存储都在本地”的绝对描述，改为本地题库管理、学习回顾及可选 AI 翻译、解析和辅助作答。AI 默认关闭不意味着所有功能都不联网。
- unlimitedStorage：旧截图未列出这一权限；新版如仍声明，需说明较大题库和学习解析的本地存储用途，并核对必要性。
- 隐私实践与政策：同步补充发送内容、模型服务接收方、会话凭据、日志和明文导出。若启用 License，另补许可验证的数据流。

更新流程：在原商店项目中递增版本号、上传新版商店 ZIP，并同步修改实际发生变化的权限理由、单一用途、商店介绍及隐私披露；提供可用测试途径。不能只换文案而不核对实际包，也不能沿用旧版审核结果替代新版审核。本指南后续的可复制文案已按新版数据流编写，提交时仍需替换占位信息并核对发布配置。

## 2. 提交前待办（当前并未自动完成）

- 在打包用途选择“商店上架”；该模式禁用代码混淆。保持题库助手的 ISOLATED 环境和手动启动。
- 确认匹配网址覆盖实际支持的练习站点。默认预设的站点并不代表发布者已获得内容使用或站点授权。
- 核查最终 manifest.json。当前 AI 包声明 https://*/*、http://localhost/*、http://127.0.0.1/* 以支持用户自定义模型端点。广泛网络权限是审核风险；固定模型服务版本应在代码适配后收窄，或另行实现按需授权。写权限理由不能代替最小权限改造。
- 检查 AI 设置的告知与同意：题干、题型、选项、相关错误记录会发送到所有启用的服务。学习解析也会外发题目；不是关闭自动答题的“AI 思考”后所有 AI 功能都停止联网。模型测试同样联网。
- 发布可公开访问的专属隐私政策，填写真实发布者、联系地址、更新时间和数据用途；让插件内也能访问。本文草稿不是已经发布的隐私政策。
- 准备原创图标和不含真实账户、API Key、受限制题目的截图。当前生成包没有自动配齐商店图标和宣传素材，需添加 manifest.icons 与对应本地文件并重新验证。尺寸以提交后台实时要求为准。
- 准备发布者自有的演示站点或已授权练习站点，以及原创 JSON 演示题库。说明当前网页识别的适用范围，不能声称支持所有考试网站。
- 用 Chrome 和 Edge 分别验证最终 ZIP：首次密码、解锁/锁定、导入导出、切换语言、AI 默认关闭、模型测试、AI 思考、学习解析、停止操作与失败回退。
- 默认不启用月度 License。若启用，说明激活方式、是否收费、验证服务器及发送的字段，提供可用的审核测试授权。实际许可验证可能联网，不能直接复制“没有发布者服务通信”。
- 搜索最终扩展代码中的远程脚本、eval、new Function 和动态加载。平台打包网页上的 CDN/语法检查不等于扩展包里的远程代码；仍须检查最终包，AI 响应只能作为数据处理。
- 完成上述事项再提交。指南不会自动替你发布到商店，也不会修改当前答题行为。

## 3. 包与配套资料

打包题库助手时，同时下载扩展 ZIP 与本指南 Markdown；ZIP 根目录也包含 EXAM_STORE_SUBMISSION_GUIDE.md。若浏览器限制连续下载，可在页面再次点击“下载指南”，或从 ZIP 解压获取。指南无密码、API Key、用户题库或许可密钥。

检查 manifest.json 位于 ZIP 根目录。商店模式与本地模式分别使用不同后缀；发布时选择商店模式，后缀 edge-store 的 MV3 包也可供 Chrome 提交验证。商店包由商店分配身份，本地包保留固定身份配置；manifest.key 不是密码或私钥。主界面中英切换不等于清单具备 _locales，当前包不能保证后台自动生成两种语言条目，应按后台添加语言。

建议准备：128×128 扩展图标、Edge 所需徽标、1280×800 的清晰截图、有效支持联系方式、隐私政策 URL、审核测试步骤。用原创练习数据展示题库详情、翻译解释和 AI 设置。分类按后台当前选项选择最贴合的教育或效率类别。

## 4. 可复制：中文商店名称与短描述

```text
题库与答题助手

管理授权练习题库，支持学习解析、翻译、加密备份和可选 AI 辅助作答。
```

## 5. 可复制：英文名称与短描述

```text
Question Bank & Answer Assistant

Manage authorized practice questions with study explanations, translation, encrypted backups and optional AI-assisted answering.
```

## 6. 可复制：中文详细描述

```text
题库与答题助手用于整理自有或已获得授权的练习题目，回顾答案与错误记录。

功能包括题库选择、搜索与分类筛选、答案标注、JSON 导入导出、Excel/HTML 导出、加密备份，以及可选的 AI 翻译与学习解析。

在支持的网页中，用户手动启动后可采集题目，并根据题库或已配置 AI 的推荐自动选择答案、翻页。AI 思考默认关闭；用户可选择题库优先或 AI 优先，配置多个模型同时查询。AI 结果可能错误，不保证考试结果。

AI 需要用户自行配置兼容接口与 API Key；模型服务可能收费。使用 AI 时，题干、题型、选项及相关错误经验会发送给所有启用的模型服务，由这些服务按各自政策处理。学习解析和模型测试也会联网。

题库保存在本地加密保险库中，可选 6 位 PIN 或复杂密码。PIN 的离线猜测防护较弱，敏感数据建议使用复杂密码。普通 JSON、Excel、HTML 导出包含明文内容；加密备份需要原密码才能恢复。

仅用于允许辅助工具的授权练习场景。请遵守网站规则与内容授权，不用于禁止辅助工具的考试。支持范围和隐私政策请查看发布者提供的说明。
```

## 7. 可复制：英文详细描述

```text
Organize your own or authorized practice questions and review answers and previous mistakes.

Features include bank selection, search and category filters, answer marking, JSON import/export, Excel/HTML export, encrypted backups, and optional AI translation and study explanations.

On supported pages, after manual launch, the extension can collect questions, automatically select answers based on a bank or configured AI recommendations, and navigate between pages. AI thinking is off by default. Users can choose bank-first or AI-first behavior and query multiple models concurrently. AI answers may be incorrect; no examination outcome is guaranteed.

AI features require a user-configured compatible endpoint and API key. Provider fees may apply. Question text, types, options and relevant past mistakes are sent to all enabled model providers. Study explanations and model tests also make network requests. Provider policies apply to data they receive.

Question banks are stored in a local encrypted vault. Choose a six-digit PIN or a complex password. A PIN offers weaker protection against offline guessing. Ordinary JSON, Excel and HTML exports contain plaintext; encrypted backups require the original password.

Use only for authorized practice where assistance is permitted. Respect website rules and content rights. Refer to the publisher's support information and privacy policy for supported sites and data practices.
```

## 8. 可复制：单一用途（中英分别填写）

```text
本扩展帮助用户管理自有或授权练习题库并进行学习回顾。题目采集、答案标注、错误回顾、翻译解析、备份和可选的自动辅助作答都围绕同一题库学习流程；自动作答仅应在允许辅助工具的练习页面使用。
```

```text
This extension manages users' own or authorized practice question banks for study and review. Question collection, answer marking, mistake review, translation, explanations, backups and optional automated answer assistance serve the same question-bank workflow. Automated assistance should only be used on practice pages that permit it.
```

## 9. 可复制：当前基础权限理由

只为最终 manifest 实际声明的权限填写理由。不要勾选无关的 cookies、tabs、downloads、webNavigation 等附加权限；浏览器 Blob 下载与当前窗口控制不代表必须新增这些权限。

```text
storage: Stores encrypted question banks and preferences locally. Trusted extension session storage holds the unlock key and configured AI credentials for the current browser session.

unlimitedStorage: Supports larger local encrypted question banks and saved study explanations beyond ordinary local-storage quotas. Reassess whether this permission is needed for the final release.

activeTab: Accesses the active supported practice page after the user clicks the extension to start the assistant.

scripting: Injects the bundled assistant into the user-selected supported page, in the isolated world, following manual launch.

Host permissions: Supported practice-site patterns allow the assistant to read question text and options and interact with answer controls after user launch. https://*/* permits requests to user-configured HTTPS AI endpoints; localhost and 127.0.0.1 HTTP patterns support locally hosted model services. The current broad HTTPS permission requires review and should be narrowed or made optional when the release architecture permits.
```

## 10. 数据披露与远程代码

不能照搬薪资计算器指南中的“不收集任何数据”。按最终发布行为和后台定义填写：网页题目内容会被读取，AI 模式会传给用户指定服务；API Key 用于向对应服务鉴权，应按后台定义核对认证信息类别。不要因为发布者没有集中收集就遗漏第三方传输。若启用许可验证，额外披露其请求与服务器信息。

“远程代码”与“远程数据”不同：AI 响应为答案或解释数据，不应执行为 JavaScript。当前基础包的执行脚本来自 ZIP 本地文件；经最终包核对没有外部执行代码时，远程代码项才填“否”。用户端点可返回数据，不可使其提供或更换扩展执行代码。

### 可复制：远程代码说明（最终包核对后使用）

```text
Executable JavaScript, HTML and CSS are bundled with the extension. AI endpoints return answer and explanation data, which is not executed as code. No remotely hosted executable scripts are loaded. This declaration must be rechecked if the package is modified.
```

## 11. 隐私政策草稿（替换占位内容后单独发布）

本平台内置助手的公开隐私政策地址：

https://cs.fanxiaolong.uk/custom-tools/question-bank-assistant-privacy/index.html

发布该内置版本时可填写此地址；如更改运营方、服务或数据处理方式，应先同步政策。以下草稿用于自行维护政策，不代替该公开页面。

```text
题库与答题助手隐私政策
更新时间：[填写日期]
发布者：[填写真实发布者]
联系与支持：[填写有效邮箱或支持 URL]

本扩展在用户启动后处理支持页面中的题干、题型、选项、答案标注、错误记录和学习解析，用于题库管理、学习回顾及可选辅助作答。不会随包提供未经授权的第三方题库。

题库在 chrome.storage.local 中以 AES-GCM 加密记录保存，密码通过 PBKDF2 派生密钥。解锁密钥保留于可信扩展会话存储，锁定或浏览器会话结束后需重新解锁。六位 PIN 比复杂密码更容易被离线猜测；加密不承诺绝对不可破解，也无法保护已被恶意软件控制的设备。语言等非敏感偏好可单独明文保存。

AI 思考默认关闭。开启 AI 思考或使用学习解析时，相关题目、选项及错误经验会发送到所有启用的模型服务。模型测试发送测试请求。API Key 用于对应服务鉴权，在浏览器会话中保存，不写入题库备份或请求日志。服务提供者的保存期限、训练用途和数据地区由其政策决定，请在使用前核对并只选可信服务。

最近一场的 AI 请求与响应日志保存在本地，可能含题目和模型输出；日志凭据会被脱敏，但不应分享含敏感题目的日志。新一场记录会替换上一场，用户可通过插件提供的题库管理或卸载管理本地数据；备份、其他题库及磁盘上的导出文件需要另行管理。

普通 JSON、Excel 和 HTML 导出含明文题库及学习解析。加密备份需要原密码恢复，忘记密码无法保证找回。用户自行负责导出文件的保存和分享。

[若启用 License，补充验证服务器、发送字段、用途及保存期限；未启用时删除本占位段。]

发布者不将题库数据出售或用于广告及信用判断，仅用于已披露的题库学习功能。数据处理遵守 Chrome Web Store User Data Policy 的 Limited Use 要求。此承诺需与实际发布者及模型服务处理安排一致。

本政策仅覆盖本扩展；用户自行配置的模型服务和访问的网站适用其各自隐私政策。隐私政策变更将在公开政策页面说明；数据处理方式变化时同步更新产品内告知。
```

先核对占位段、保留期限、清除途径与真实实现，再发布政策。不要提交不存在的 URL，或指向与本插件无关的隐私页面。

## 12. Edge 提交步骤

进入 Microsoft Partner Center 的 Edge 项目，创建扩展并上传商店 ZIP。填写可用地区、属性、隐私、每种语言的商店介绍、图片和审核测试备注。核对权限、数据披露与实际政策 URL 一致后提交。Hidden 只改变可发现性，不意味着免审核。开发者注册条件、费用、图片规格及审核时间以实时后台为准。

## 13. Chrome 提交步骤

进入 Chrome Web Store Developer Dashboard，按后台要求完成开发者注册。上传商店 ZIP，填写商店详情、隐私实践、权限理由、隐私政策 URL 与测试说明，补齐图片并验证后提交。发布新版本时递增版本号；收窄或增加权限后重新测试。不要用反复换名称、账户或隐瞒功能的方式处理拒审。

## 14. 可复制：审核测试说明（填完占位内容）

```text
Purpose: Manage authorized practice question banks and provide optional AI-assisted study and answering.

Test page: [publisher-owned or authorized supported practice URL]
Sample bank: [public URL to original non-sensitive JSON practice questions]
Supported page behavior and selectors: [describe supported layouts]
Support / privacy policy: [valid public URLs]

1. Install the submitted package, open the test page and click the extension's Start button.
2. Create a six-digit PIN or choose complex-password mode. Unlocking occurs inside an extension window. AI thinking is disabled by default.
3. Import the sample JSON, open the details center, filter questions, mark answers and export JSON, Excel/HTML or an encrypted backup.
4. Test lock/unlock and encrypted-backup restoration with the password created in step 2.
5. Optional AI test: [review-only service endpoint/model and securely supplied temporary credential instructions]. Use the model-test button. Enable AI thinking explicitly, or run study explanations. Questions and relevant mistakes are sent to enabled providers. Review the request/response log with credentials redacted.
6. On the authorized practice page, test bank-first / AI-first automated answer selection and page navigation, then Stop. AI failures can fall back to the existing bank workflow; results may be wrong.
7. Switch Chinese / English and verify window controls.

License: [disabled, or activation/testing instructions and any service data disclosure]. No real exam account or personal API key is included in the public package.
```

为审核提供有效可用的测试途径，不让审核人员自备付费服务才能验证核心宣称。临时测试凭据只通过审核专用安全渠道提供，不能写进公开指南、ZIP、截图或日志。示例站点与测试模型尚需发布者准备，本文没有替你创建。

## 15. 常见拒审风险与处理

权限过宽：核对最终清单并按实际服务收窄或实现按需授权；不能只修改商店文案。

内容授权不清：提供自有样例与授权说明，删除未授权题库和素材。自动答题用途受到站点限制时，应调整真实产品范围并重新测试，再同步更新指南。

隐私不一致：把本地加密、明文导出、AI 外发、日志与可选 License 服务都写清；补齐产品内可见告知和政策链接。

代码不可审查：商店模式不用混淆，不运行服务器提供的代码，不藏功能。可阅读不意味着要公开用户密码或 API Key。

测试失败：提供支持的演示页面、原创题库和可用测试服务；阅读拒审原因，在同一项目修复后重新提交。本文不承诺审核时间或通过率。

## 16. 官方来源

- Chrome 程序政策（权限、用户数据、透明披露与内容授权）：https://developer.chrome.com/docs/webstore/program-policies/policies
- Chrome 代码可读性：https://developer.chrome.com/docs/webstore/program-policies/code-readability
- Chrome MV3 远程代码要求：https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements
- Chrome 发布操作：https://developer.chrome.com/docs/webstore/publish
- Edge 发布操作：https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension
- Edge 开发者政策：https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies

以上链接优先于参考指南的历史费用、审核时长或“必过”说法。最终以提交时官方后台、政策与审核结果为准。
