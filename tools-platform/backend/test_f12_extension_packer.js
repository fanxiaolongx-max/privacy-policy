const assert = require('assert');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const packer = require('./builtin-tools/f12-to-extension/packer-core');

const toolDir = path.join(__dirname, 'builtin-tools/f12-to-extension');
const defaultCode = fs.readFileSync(path.join(toolDir, 'default-f12.js'), 'utf8');
const examAssistantCode = fs.readFileSync(path.join(toolDir, 'exam-question-bank-assistant.js'), 'utf8');

function baseOptions(overrides = {}) {
    return {
        name: 'SV/CFC 满意度监控',
        version: '1.0.0',
        description: '监控脚本',
        matches: 'https://w3.huawei.com/*',
        world: 'MAIN',
        includePopup: true,
        runAt: 'document_idle',
        allFrames: false,
        optionalPermissions: [],
        code: defaultCode,
        ...overrides
    };
}

function testDefaultCompatibility() {
    const result = packer.buildPackage(baseOptions());
    assert.deepStrictEqual(result.manifest.permissions, ['storage', 'activeTab', 'scripting']);
    assert.deepStrictEqual(result.manifest.host_permissions, ['https://w3.huawei.com/*']);
    assert.deepStrictEqual(result.manifest.content_scripts, [{
        matches: ['https://w3.huawei.com/*'],
        js: ['content.js'],
        run_at: 'document_idle',
        world: 'MAIN'
    }]);
    assert.strictEqual(result.files['content.js'], defaultCode, '默认脚本必须原样写入');
    assert.ok(result.files['popup.js'].includes('source: "EXTENSION_POPUP"'));
    assert.ok(defaultCode.includes('event.data?.source === "EXTENSION_POPUP"'));
    new Function(result.files['popup.js']);
    new Function(result.files['background.js']);
}

function testAdvancedOptionsAreOptIn() {
    const extensionKey = Buffer.alloc(162, 7).toString('base64');
    const result = packer.buildPackage(baseOptions({
        matches: 'https://one.example/*\nhttps://two.example/*',
        runAt: 'document_start',
        allFrames: true,
        optionalPermissions: ['downloads', 'cookies', 'downloads'],
        extensionKey
    }));
    assert.deepStrictEqual(result.manifest.host_permissions, [
        'https://one.example/*',
        'https://two.example/*'
    ]);
    assert.strictEqual(result.manifest.content_scripts[0].run_at, 'document_start');
    assert.strictEqual(result.manifest.content_scripts[0].all_frames, true);
    assert.strictEqual(result.manifest.key, extensionKey, '固定 Manifest Key 必须写入扩展清单');
    assert.deepStrictEqual(result.manifest.permissions, [
        'storage', 'activeTab', 'scripting', 'downloads', 'cookies'
    ]);
}

function testStorePackageOmitsManifestKey() {
    const extensionKey = Buffer.alloc(162, 7).toString('base64');
    const result = packer.buildPackage(baseOptions({ extensionKey, packageTarget: 'store' }));
    assert.strictEqual(Object.prototype.hasOwnProperty.call(result.manifest, 'key'), false,
        'Microsoft Edge 商店包必须移除 manifest.key');
    assert.strictEqual(result.validation.options.packageTarget, 'store');
}

function testValidationAndDiagnostics() {
    assert.strictEqual(packer.isValidVersion('1.0.0'), true);
    assert.strictEqual(packer.isValidVersion('1.01'), false);
    assert.strictEqual(packer.incrementVersion('1.0.0'), '1.0.1');
    assert.strictEqual(packer.incrementVersion('1.2'), '1.2.1');
    assert.strictEqual(packer.incrementVersion('1.0.65535'), '1.1.0');
    assert.strictEqual(packer.incrementVersion('1.2.3.65535'), '1.2.4.0');
    assert.throws(() => packer.incrementVersion('65535.65535.65535'), /最大值/);
    assert.strictEqual(packer.isValidMatchPattern('<all_urls>'), true);
    assert.strictEqual(packer.isValidMatchPattern('https://*.example.com/*'), true);
    assert.strictEqual(packer.isValidMatchPattern('https://*.example.com:8443/*'), true);
    assert.strictEqual(packer.isValidMatchPattern('file:///foo*'), true);
    assert.strictEqual(packer.isValidMatchPattern('ftp://example.com/*'), false);

    const invalid = packer.validateOptions(baseOptions({
        version: 'v1',
        matches: 'not-a-pattern',
        code: 'await fetch("/api")'
    }));
    assert.ok(invalid.errors.some(message => message.includes('版本号')));
    assert.ok(invalid.errors.some(message => message.includes('匹配网址')));
    assert.ok(invalid.errors.some(message => message.includes('content.js')));

    const diagnostics = packer.analyzeCode('copy($0); GM_setValue("x", 1); chrome.downloads.download({});');
    assert.ok(diagnostics.warnings.some(message => message.includes('DevTools')));
    assert.ok(diagnostics.warnings.some(message => message.includes('油猴')));
    assert.ok(diagnostics.suggestions.some(message => message.includes('downloads')));
}

function testGeneratedMarkupIsEscaped() {
    const result = packer.buildPackage(baseOptions({ name: '<img src=x onerror=alert(1)>' }));
    assert.ok(!result.files['popup.html'].includes('<img src=x'));
    assert.ok(result.files['popup.html'].includes('&lt;img'));
}

function testExamAssistantBuiltinCompatibility() {
    const validation = packer.validateOptions(baseOptions({
        name: '题库与答题助手',
        description: '抓取考试题目、维护本地题库并辅助自动答题。',
        includePopup: false,
        code: examAssistantCode
    }));
    assert.deepStrictEqual(validation.errors, [], '题库与答题助手应通过 content.js 语法检查');
    assert.deepStrictEqual(validation.warnings, [], '题库与答题助手不应依赖 F12/油猴专用 API');

    const cleanHelperStart = examAssistantCode.indexOf('const cleanOptionText =');
    const cleanHelperEnd = examAssistantCode.indexOf('// 用于对比时消除空格和大小写差异');
    assert.ok(cleanHelperStart >= 0 && cleanHelperEnd > cleanHelperStart, '必须能定位选项前缀清理函数');
    const cleanOptionText = new Function(`${examAssistantCode.slice(cleanHelperStart, cleanHelperEnd)}; return cleanOptionText;`)();
    assert.strictEqual(cleanOptionText('A. A、 未经批准'), '未经批准', '必须剥离重复的 A. A、 前缀');
    assert.strictEqual(cleanOptionText('D. D、 员工组织活动'), '员工组织活动', '必须剥离重复的 D. D、 前缀');
    assert.strictEqual(cleanOptionText(cleanOptionText('B. B、 打印文件')), '打印文件', '前缀清理必须幂等');
    assert.strictEqual(cleanOptionText('A. A-level security'), 'A-level security', '不得误删正文中的 A-level');

    const result = packer.buildPackage(validation.options);
    assert.strictEqual(result.files['content.js'], examAssistantCode, '新内置脚本必须原样写入');
    assert.strictEqual(result.manifest.action, undefined, '题库助手会自动显示浮窗，无需生成无效 Popup');
    assert.ok(result.files['content.js'].includes("exam-scraper-widget"));
    assert.ok(result.files['content.js'].includes('async function applyAnswerSelection(answerTexts)'));
    assert.ok(result.files['content.js'].includes('const finalOptions = getCurrentOptionEls()'));
    assert.ok(result.files['content.js'].includes('dispatchOptionMouseSequence'), '点击未保持时必须尝试鼠标事件序列');
    assert.ok(result.files['content.js'].includes('dispatchOptionKeyboardSequence'), '点击未保持时必须尝试键盘事件序列');
    assert.ok(result.files['content.js'].includes('for (let pass = 1; pass <= 3; pass++)'), '多选答案必须按整组重试');
    assert.ok(result.files['content.js'].includes('[答案映射失败]'), '必须区分答案映射失败与点击未保持');
    assert.ok(result.files['content.js'].includes('const saveGuessSuggestion ='), '猜答成功后必须保存独立的疑似答案');
    assert.ok(result.files['content.js'].includes('[答题录入新题]'), '自动答题遇到新题时必须直接录入题库');
    assert.ok(result.files['content.js'].includes('const findConfirmedAnswerAcrossBanks ='), '当前题库缺答案时必须支持检索其他本地题库');
    assert.ok(result.files['content.js'].includes('[跨题库命中]'), '跨题库采用答案时必须记录来源');
    assert.ok(result.files['content.js'].includes('[跨题库答案冲突]'), '多个题库答案冲突时必须安全跳过');
    assert.ok(result.files['content.js'].includes('storageKey === currentStorageKey'), '跨题库检索不得重复读取当前题库');
    assert.ok(result.files['content.js'].includes('[采用疑似答案]'), '无准确答案时必须优先复用疑似答案');
    assert.ok(result.files['content.js'].includes('[疑似答案已否定]'), '复盘证实错误后必须停止复用疑似答案');
    assert.ok(result.files['content.js'].includes('suggestedAnswers: q.猜测答案'), '导出题库必须包含疑似答案');
    assert.ok(result.files['content.js'].includes('selection.success && selection.expectedCount === expectedCount'));
    assert.ok(!result.files['content.js'].includes('[class*="checked"]'), '不得用宽泛类名判断复盘选中项');
    assert.ok(result.files['content.js'].includes('const isReviewOptionSelected ='), '必须提供复盘页选中样式兜底识别');
    assert.ok(result.files['content.js'].includes("label.option-list.option-list-active"), '必须兼容复盘页 option-list-active 勾选样式');
    assert.ok(result.files['content.js'].includes('isReviewMode ? isReviewOptionSelected(opt) : isOptionSelected(opt)'), '复盘抓取必须使用展示状态兜底识别');
    assert.ok(result.files['content.js'].includes('existingQ.正确答案 = sortedAnswers'), '权威答案必须替换旧答案以修复污染数据');
    assert.ok(result.files['content.js'].includes('confirmedWrongKey === savedCorrectKey'), '已证实错误的当前选择必须与题库旧答案进行冲突校验');
    assert.ok(result.files['content.js'].includes('[题库答案已否定]'), '复盘答错与旧答案一致时必须作废旧答案');
    assert.ok(result.files['content.js'].includes('[抓到${sourceLabelZh}]'));
    assert.ok(result.files['content.js'].includes('[排除错误答案组合]'));
    assert.ok(result.files['content.js'].includes('getQuestionVariantKey(typeName, titleText, optionsText)'));
    assert.ok(result.files['content.js'].includes('findQuestionVariant(scrapedData, typeName, titleText, optionsText)'));
    assert.ok(result.files['content.js'].includes('const detectCurrentReviewResult ='), '必须把答对/答错反馈限定在当前题目区域');
    assert.ok(result.files['content.js'].includes('findCurrentQuestionReviewScope(titleEl, optionEls)'), '反馈识别不得直接使用整个页面的全局文案');
    assert.ok(result.files['content.js'].includes('findShortestVisibleTextElement(/(?:正确答案|Correct answer)'));
    assert.ok(result.files['content.js'].includes('findShortestVisibleTextElement(/答错了|遗憾|Wrong answer|Wrong Question|Incorrect/i, reviewScope)'));
    assert.ok(result.files['content.js'].includes('existingQ.错误组合.filter(combo => getNormComboStr(combo) !== correctKey)'), '确认答对后必须清理同一组合的历史错误标注');
    assert.ok(result.files['content.js'].includes('combo.every(answer => optionNorms.has(normalizeForCompare(answer)))'));
    assert.ok(result.files['content.js'].includes('resize: both'), '题库详情窗口必须支持缩放');
    assert.ok(result.files['content.js'].includes("const typeOrder = { '判断题': 0, '单选题': 1, '多选题': 2 }"), '题库详情必须按题型自动排序');
    assert.ok(result.files['content.js'].includes("tr.dataset.sourceIndex = String(index)"), '排序展示后必须保留原始题库索引供人工标注');
    assert.ok(result.files['content.js'].includes("document.getElementById('modal-stats').innerHTML"), '题库详情顶部必须渲染统计摘要');
    assert.ok(result.files['content.js'].includes("value: `${confirmedCount} (${coverage}%)`"), '统计摘要必须展示准确答案覆盖率');
    assert.ok(result.files['content.js'].includes("modalHeader.addEventListener('pointerdown'"), '题库详情标题栏必须支持拖拽');
    assert.ok(result.files['content.js'].includes('function dragModal(e)'));
    assert.ok(result.files['content.js'].includes('const getQuestionSections = () =>'), '必须动态枚举题型区段');
    assert.ok(result.files['content.js'].includes('const detectCurrentQuestionType ='), '必须逐题复核题型');
    assert.ok(result.files['content.js'].includes('getQuestionNumber(navLi, qIndex)'), '必须使用页面实际题号');
    assert.ok(!result.files['content.js'].includes("const typeMap = { 1: '判断题', 2: '单选题', 3: '多选题' }"), '不得固定题型区段顺序');
    assert.ok(result.files['content.js'].includes('sectionIndex < initialSections.length'), '抓取和答题必须按实际区段数量遍历');
    assert.ok(result.files['content.js'].includes('findQuestionVariantAcrossTypes'), '必须识别被旧逻辑错分题型的历史记录');
    assert.ok(result.files['content.js'].includes('[修复历史题型]'), '必须记录历史题型自动修复日志');
    assert.ok(result.files['content.js'].includes("q.题型 === '多选题' ? q.明确错误答案 : q.错误答案"), '多选错误组合成员不得按单项错误画线');
    assert.ok(result.files['content.js'].includes('组合错误不能推出单项错误'), '必须清理旧版多选组合造成的错误标注');
    assert.ok(result.files['content.js'].includes('definiteWrongAnswers: q.明确错误答案'), '明确错误项必须支持英文 JSON 导出');
    assert.ok(result.files['content.js'].includes("QUESTION_BANK_BACKUP_FORMAT = 'exam-question-bank-backup'"), '多题库备份必须使用可识别的版本化格式');
    assert.ok(result.files['content.js'].includes("id=\"bank-transfer-select-all\""), '导出题库选择窗口必须支持全选');
    assert.ok(result.files['content.js'].includes('checkbox.checked = bank.storageKey === getStorageKey()'), '导出窗口必须默认选择当前题库');
    assert.ok(result.files['content.js'].includes('downloadQuestionBankBackup(selectedBanks)'), '必须按用户勾选结果导出多个题库');
    assert.ok(result.files['content.js'].includes('Array.isArray(imported.banks)'), '导入必须识别多题库备份包');
    assert.ok(result.files['content.js'].includes('normalizedBanks.forEach(bank =>'), '多题库导入必须逐库恢复本地存储');

    const indexHtml = fs.readFileSync(path.join(toolDir, 'index.html'), 'utf8');
    assert.ok(indexHtml.includes('SV/CFC 满意度监控（原内置）'), '必须保留原内置脚本选项');
    assert.ok(indexHtml.includes('题库与答题助手'), '必须提供题库助手内置脚本选项');
    assert.ok(indexHtml.includes('载入内置脚本'), '必须提供内置脚本载入按钮');
    assert.ok(indexHtml.includes('id="extObfuscate" type="checkbox" class='), '商店包应默认关闭混淆');
    assert.ok(indexHtml.includes('id="extPackageTarget"'), '必须提供商店包与本地包选择');
    assert.ok(indexHtml.includes("packageTarget: document.getElementById('extPackageTarget').value"));
    assert.ok(indexHtml.includes('obfuscateInput.disabled = storePackage'), '商店模式必须禁用混淆选项');
    assert.ok(indexHtml.includes("document.getElementById('extPackageTarget').value !== 'store'"), '收集参数时必须再次阻止商店包混淆');
    assert.ok(indexHtml.includes('updatePackageTargetUI();'), '页面初始化时必须锁定商店包混淆选项');
    assert.ok(indexHtml.includes('id="extLicense" type="checkbox" checked'));
    assert.ok(indexHtml.includes('可完全离线验证'), 'License 说明必须明确支持完全离线验签');
    assert.ok(indexHtml.includes('id="manageLicensesBtn"'), '必须提供 License 管理入口');
    assert.ok(indexHtml.includes('/f12-to-extension/license-config'), '打包必须单独读取公开验签配置');
    assert.ok(indexHtml.includes('const licenseConfig = await getLicensePackagingConfig(options.name)'), '打包必须按扩展名称读取固定身份');
    assert.ok(indexHtml.includes('options.extensionKey = licenseConfig.manifestKey'), '打包必须写入稳定 Manifest Key');
    assert.ok(!indexHtml.includes('issuedLicense = await issueMonthlyLicense(options.name'), '点击打包不得自动签发新 License');
    assert.ok(indexHtml.includes('License ID：${record.licenseId}'), '危险操作确认必须显示 License ID');
    assert.ok(indexHtml.includes('完整输入扩展名称确认'), '归档前必须输入扩展名称二次确认');
    assert.ok(indexHtml.includes("data-license-action=\"revoke\""), '必须支持单独撤销');
    assert.ok(indexHtml.includes("data-license-action=\"renew\""), '必须支持续期');
    assert.ok(indexHtml.includes('https://ilearning.huawei.com/*'));
    assert.ok(indexHtml.includes('includePopup: true'));
    assert.ok(indexHtml.includes('id="previousVersion"'), '界面必须显示上一个版本');
    assert.ok(indexHtml.includes('id="nextVersion"'), '界面必须显示本次新版本');
    assert.ok(indexHtml.includes('f12ExtensionPackerVersionHistoryV1'), '必须按扩展名称持久化版本历史');
    assert.ok(indexHtml.includes('function incrementExtensionVersion(version)'), '页面必须提供版本递增缓存兼容回退');
    assert.ok(indexHtml.includes('typeof F12ExtensionPacker.incrementVersion === \'function\''), '新版核心可用时必须使用统一版本递增函数');
    assert.ok(indexHtml.includes('incrementExtensionVersion(previousVersion)'), '每次打包前必须生成递增版本');
    assert.ok(indexHtml.includes('packer-core.js?v='), '核心脚本必须带缓存失效版本参数');
    assert.ok(indexHtml.includes('rememberPackedVersion(options.name, options.version)'), '成功打包后必须推进版本记录');
    assert.ok(indexHtml.includes('"-v" + options.version + targetSuffix + ".zip"'), 'ZIP 文件名必须包含扩展版本和打包用途');
}

function testManualLaunchAndLicensePackage() {
    const publicKeyJwk = {
        kty: 'EC', crv: 'P-256', x: 'test-x', y: 'test-y', ext: true
    };
    const result = packer.buildPackage(baseOptions({
        manualLaunch: true,
        includePopup: true,
        license: {
            enabled: true,
            productId: '题库与答题助手',
            validationUrl: 'https://tools.example.com/api/public/f12-license/validate',
            publicKeyJwk
        }
    }));
    assert.strictEqual(result.manifest.content_scripts, undefined, '手动启动模式不得提前注入脚本');
    assert.ok(result.manifest.action, '手动启动模式必须生成 Popup');
    assert.ok(result.manifest.host_permissions.includes('https://tools.example.com/*'), '必须允许访问在线可信时间服务');
    assert.ok(result.files['popup.html'].includes('首次运行授权'));
    assert.ok(result.files['popup.html'].includes('id="languageSelect"'), 'Popup 必须提供中英文切换');
    assert.ok(result.files['popup.js'].includes('crypto.subtle.verify'));
    assert.ok(result.files['popup.js'].includes('files: ["content.js"]'));
    assert.ok(result.files['popup.js'].includes('密钥已过期，请获取本月新密钥'));
    assert.ok(result.files['popup.js'].includes('This key has expired'), 'License 校验提示必须支持英语');
    assert.ok(result.files['popup.js'].includes('chrome.i18n.getUILanguage'), 'Popup 必须默认跟随浏览器语言');
    assert.ok(result.files['popup.js'].includes('f12PopupLanguage'), 'Popup 必须记住手动语言选择');
    assert.ok(result.files['popup.js'].includes('Script started!'), '授权后的运行界面必须支持英语');
    assert.ok(result.files['popup.js'].includes('template.replace(/\\{(\\w+)\\}/g'), '日期和倒计时占位符必须能够替换');
    assert.ok(result.files['popup.js'].includes('F12T1'), 'Popup 必须验证服务端可信时间签名');
    assert.ok(result.files['popup.js'].includes('requestOnlineValidation'), '启动前必须执行在线 License 校验');
    assert.ok(result.files['popup.js'].includes('readSignedOfflineValidation'), '无网络时必须支持本地签名有效期验证');
    assert.ok(result.files['popup.js'].includes('f12LocalLicenseClock'), '必须记录本地最大可信时间');
    assert.ok(result.files['popup.js'].includes('localSignature: true'), '本地验签结果必须明确标记');
    assert.ok(result.files['popup.js'].includes('if (verified.attestationPayload)'), '服务器签名的撤销结果必须覆盖旧离线成功缓存');
    assert.ok(result.files['popup.js'].includes('clockRollback'), '离线宽限必须检测系统时间回拨');
    assert.ok(result.files['popup.js'].includes('expiresSoonDays'), '必须提供临近到期提醒');
    assert.ok(result.files['popup.css'].includes('.expiry-warning.urgent'), '24 小时内必须凸显到期提醒');
    new Function(result.files['popup.js']);
}

async function testZipRoundTrip() {
    const generated = packer.buildPackage(baseOptions());
    const zip = new JSZip();
    Object.entries(generated.files).forEach(([name, content]) => zip.file(name, content));
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    const reopened = await JSZip.loadAsync(buffer);
    const manifest = JSON.parse(await reopened.file('manifest.json').async('string'));
    const content = await reopened.file('content.js').async('string');
    assert.strictEqual(manifest.content_scripts[0].world, 'MAIN');
    assert.strictEqual(content, defaultCode, 'ZIP 往返后默认脚本必须保持不变');
    ['popup.html', 'popup.css', 'popup.js', 'background.js'].forEach(file => {
        assert.ok(reopened.file(file), `ZIP 应包含 ${file}`);
    });
}

async function main() {
    testDefaultCompatibility();
    testAdvancedOptionsAreOptIn();
    testStorePackageOmitsManifestKey();
    testValidationAndDiagnostics();
    testGeneratedMarkupIsEscaped();
    testExamAssistantBuiltinCompatibility();
    testManualLaunchAndLicensePackage();
    await testZipRoundTrip();
    console.log('F12 extension packer tests passed');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
