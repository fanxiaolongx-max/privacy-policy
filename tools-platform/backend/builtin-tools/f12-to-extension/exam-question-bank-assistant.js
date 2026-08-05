(function () {

if (document.getElementById('exam-scraper-widget') || document.getElementById('scraper-minimized-icon')) {
    const existingWidget = document.getElementById('exam-scraper-widget');
    const existingIcon = document.getElementById('scraper-minimized-icon');
    if (existingWidget) existingWidget.style.display = 'flex';
    if (existingIcon) existingIcon.style.display = 'none';
    return;
}

let currentLang = localStorage.getItem('exam_scraper_language') === 'en' ? 'en' : 'zh';
const I18N = {
    zh: {
        defaultExam: '默认考试', title: '🚀 题库与答题助手 (无视选项打乱版)', closeTitle: '关闭/最小化',
        closeOptions: '关闭选项', minimize: '⬇️ 最小化', quit: '❌ 退出脚本', remember: '记住选择', cancel: '取消',
        examName: '选择/新建题库:', examPlaceholder: '输入或下拉选择', delay: '翻页延迟(ms):',
        totalPrefix: '当前题库收录:', questionUnit: '题', status: '状态:', ready: '就绪',
        welcome: '🌐 系统基于纯文本匹配，自动兼容选项打乱现象！\n等待开始...',
        start: '▶ 开始抓取', autoAnswer: '🤖 自动答题', stop: '⏸ 停止', view: '📊 查看题库与标注',
        exportJson: '📥 导出JSON', importJson: '📤 导入JSON', clear: '🗑 清空当前题库', language: 'EN',
        modalTitle: '📚 题库详情中心', correctHint: '(勾选即为正确答案)', search: '🔍 输入题目、选项或ID搜索...',
        type: '题型', question: '题目', options: '选项 (单选错项/多选明确错项标红，错误组合仅在下方展示)', count: '次数',
        combo: '组合', excludedCombos: n => `❌ 已排除的错误组合 (${n}种):`,
        emptyBank: '当前题库为空，请先抓取！', needName: '请填写题库名称！',
        scrapingReview: '复盘抓取中...', scrapingExam: '答题抓取中...', stopped: '已停止', answering: '自动答题中...',
        reviewModeBlocked: '⚠️ 当前处于回顾/复盘模式，禁止点击自动答题！请在正常的考试模式下使用。',
        reviewModeLog: '🚫 已拦截！回顾模式下禁止使用自动答题，以免干扰页面。',
        cannotAnswerEmpty: '当前题库为空，将对全部题目按题型策略猜答。', noData: '没有数据！',
        clearConfirm: name => `确定清空题库 [${name}] 的所有缓存吗？`, cleared: '🗑 已清空。', forceStop: '⚠️ 正在强制停止...',
        importConfirm: name => `导入后将覆盖题库 [${name}]，是否继续？`, importSuccess: n => `📤 导入成功：${n}题。`,
        importInvalid: '导入失败：不是有效的本脚本JSON题库文件。', localDataBroken: '⚠️ 当前题库缓存损坏，已安全切换为空题库；原缓存未被覆盖。'
    },
    en: {
        defaultExam: 'Default Exam', title: '🚀 Question Bank & Answer Assistant (Shuffle-proof)', closeTitle: 'Close / Minimize',
        closeOptions: 'Close options', minimize: '⬇️ Minimize', quit: '❌ Exit script', remember: 'Remember choice', cancel: 'Cancel',
        examName: 'Select / create bank:', examPlaceholder: 'Type or select from list', delay: 'Page delay (ms):',
        totalPrefix: 'Questions in current bank:', questionUnit: '', status: 'Status:', ready: 'Ready',
        welcome: '🌐 Pure-text matching automatically handles shuffled options!\nReady to start...',
        start: '▶ Start scraping', autoAnswer: '🤖 Auto answer', stop: '⏸ Stop', view: '📊 View & label bank',
        exportJson: '📥 Export JSON', importJson: '📤 Import JSON', clear: '🗑 Clear current bank', language: '中',
        modalTitle: '📚 Question Bank Details', correctHint: '(checked = correct answer)', search: '🔍 Search question, option, or ID...',
        type: 'Type', question: 'Question', options: 'Options (red = confirmed wrong only; invalid combinations shown below)', count: 'Count',
        combo: 'Combo', excludedCombos: n => `❌ Eliminated invalid combinations (${n}):`,
        emptyBank: 'The current question bank is empty. Scrape questions first.', needName: 'Please enter a question bank name.',
        scrapingReview: 'Scraping review...', scrapingExam: 'Scraping exam...', stopped: 'Stopped', answering: 'Auto answering...',
        reviewModeBlocked: '⚠️ Auto answer is disabled in review mode. Please use it during a normal exam.',
        reviewModeLog: '🚫 Blocked: auto answer cannot run in review mode.',
        cannotAnswerEmpty: 'The question bank is empty. Every question will be guessed by question-type strategy.', noData: 'No data to export.',
        clearConfirm: name => `Clear all cached data for question bank [${name}]?`, cleared: '🗑 Cleared.', forceStop: '⚠️ Force stopping...',
        importConfirm: name => `Importing will replace question bank [${name}]. Continue?`, importSuccess: n => `📤 Import successful: ${n} questions.`,
        importInvalid: 'Import failed: this is not a valid question-bank JSON file.', localDataBroken: '⚠️ The current local cache is corrupted. Switched safely to an empty bank without overwriting the original cache.'
    }
};
const t = (key, ...args) => {
    const value = I18N[currentLang][key];
    return typeof value === 'function' ? value(...args) : value;
};
const typeLabel = type => currentLang === 'en' ? ({'判断题':'True/False', '单选题':'Single Choice', '多选题':'Multiple Choice'}[type] || type) : type;

const isVisible = (node) => {
    if (!node) return false;
    return node.offsetWidth > 0 || node.offsetHeight > 0 || node.getClientRects().length > 0;
};

const getEl = (xpath) => {
    try {
        let nodes = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for(let i=0; i<nodes.snapshotLength; i++) {
            let node = nodes.snapshotItem(i);
            if(isVisible(node)) return node;
        }
        return null;
    } catch (e) { return null; }
};

const getEls = (xpath) => {
    let res = [];
    try {
        let nodes = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for(let i=0; i<nodes.snapshotLength; i++) {
            let node = nodes.snapshotItem(i);
            if(isVisible(node)) res.push(node);
        }
    } catch (e) {}
    return res;
};

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

const optionListPath = `//*[@id="app"]/div/div/div[1]/div/div[1]/div[2]/div[2]/div/div/div[2]/div[1]/div[2]/div`;
const getCurrentOptionEls = () => getEls(optionListPath);

const isOptionSelected = (optionEl) => {
    if (!optionEl) return false;
    const selectedSelector = [
        'input:checked',
        '[aria-checked="true"]',
        '.ant-radio-checked',
        '.ant-checkbox-checked',
        '.ant-radio-wrapper-checked',
        '.ant-checkbox-wrapper-checked'
    ].join(', ');
    return optionEl.matches(selectedSelector) || Boolean(optionEl.querySelector(selectedSelector));
};

const clickOption = (optionEl) => {
    if (!optionEl) return false;
    const clickable = optionEl.querySelector('input[type="checkbox"], input[type="radio"]') ||
        optionEl.querySelector('label') || optionEl;
    clickable.click();
    return true;
};

async function waitForOptionState(normalizedText, shouldBeSelected, timeout = 1200) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        const current = getCurrentOptionEls().find(opt => normalizeForCompare(opt.innerText) === normalizedText);
        if (current && isOptionSelected(current) === shouldBeSelected) return true;
        await sleep(50);
    }
    return false;
}

async function setOptionState(normalizedText, shouldBeSelected) {
    for (let attempt = 0; attempt < 3; attempt++) {
        const currentOptions = getCurrentOptionEls();
        const option = currentOptions.find(opt => normalizeForCompare(opt.innerText) === normalizedText);
        if (!option) return false;
        if (isOptionSelected(option) === shouldBeSelected) return true;
        clickOption(option);
        if (await waitForOptionState(normalizedText, shouldBeSelected)) return true;
    }
    return false;
}

async function applyAnswerSelection(answerTexts) {
    const targetNorms = [...new Set((answerTexts || []).map(normalizeForCompare).filter(Boolean))];
    const targetSet = new Set(targetNorms);

    // 先取消不属于目标答案的旧选项，避免重复运行时 click() 把正确项反向取消。
    for (const option of getCurrentOptionEls()) {
        const norm = normalizeForCompare(option.innerText);
        if (norm && !targetSet.has(norm) && isOptionSelected(option)) {
            await setOptionState(norm, false);
        }
    }

    // 每次操作都重新查询 DOM，兼容 React/Ant Design 点击后的节点重建。
    for (const norm of targetNorms) {
        await setOptionState(norm, true);
    }

    const finalOptions = getCurrentOptionEls();
    const selectedNorms = [...new Set(finalOptions
        .filter(isOptionSelected)
        .map(opt => normalizeForCompare(opt.innerText))
        .filter(Boolean))];
    const selectedSet = new Set(selectedNorms);
    const missing = targetNorms.filter(norm => !selectedSet.has(norm));
    const extra = selectedNorms.filter(norm => !targetSet.has(norm));
    return {
        success: missing.length === 0 && extra.length === 0,
        expectedCount: targetNorms.length,
        selectedCount: selectedNorms.length,
        missing,
        extra
    };
}

// 🌟 核心升级：强力前缀剥离器。确保彻底剥离 A. B、 C: [D] 等选项前缀
// 保证 "A. 2" 和 "B. 2" 提取出的纯文本都是 "2"，从而完美兼容乱序
const cleanOptionText = (text) => {
    if (!text) return '';
    let txt = text.trim().replace(/\n/g, ' ');
    // 剔除带标点符号的前缀如 A. A、 A: (A) [A]
    txt = txt.replace(/^[(（\[【]?[A-Za-z][)）\]】]?[\.\、\:\-．]\s*/, '');
    // 剔除仅带空格的前缀如 A 选项内容
    txt = txt.replace(/^[A-Za-z]\s+/, '');
    return txt;
};

// 用于对比时消除空格和大小写差异
const normalizeForCompare = (text) => {
    if (!text) return '';
    return cleanOptionText(text).replace(/\s+/g, '').toLowerCase();
};

const getNormComboStr = (comboArr) => {
    return comboArr.map(normalizeForCompare).sort().join('|||');
};

const uniqueAnswerTexts = (answers) => {
    const seen = new Set();
    return (answers || []).filter(answer => {
        const norm = normalizeForCompare(answer);
        if (!norm || seen.has(norm)) return false;
        seen.add(norm);
        return true;
    });
};

const describeAnswers = (answers, optionsText) => uniqueAnswerTexts(answers).map(answer => {
    const norm = normalizeForCompare(answer);
    const index = optionsText.findIndex(option => normalizeForCompare(option) === norm);
    return `${index >= 0 ? `${String.fromCharCode(65 + index)}. ` : ''}${answer}`;
}).join(' | ');

const normalizeQuestionText = (text) => String(text || '').replace(/\s+/g, '').toLowerCase();
const getOptionSignature = (options) => [...new Set((options || [])
    .map(normalizeForCompare)
    .filter(Boolean))].sort().join('|||');
const getQuestionVariantKey = (typeName, titleText, optionsText) =>
    `${typeName}::${normalizeQuestionText(titleText)}::${getOptionSignature(optionsText)}`;

const findQuestionVariant = (questions, typeName, titleText, optionsText) => {
    const variantKey = getQuestionVariantKey(typeName, titleText, optionsText);
    return questions.find(question => {
        if (question.variantKey === variantKey) return true;
        return question.题型 === typeName &&
            normalizeQuestionText(question.题目) === normalizeQuestionText(titleText) &&
            getOptionSignature(question.选项) === getOptionSignature(optionsText);
    });
};

const findQuestionVariantAcrossTypes = (questions, titleText, optionsText) => questions.find(question =>
    normalizeQuestionText(question.题目) === normalizeQuestionText(titleText)
    && getOptionSignature(question.选项) === getOptionSignature(optionsText)
);

const reclassifyQuestionVariant = (question, typeName, titleText, optionsText, questionNumber) => {
    if (!question || question.题型 === typeName) return '';
    const previousType = question.题型 || '未知题型';
    question.题型 = typeName;
    question.题号 = questionNumber;
    question.variantKey = getQuestionVariantKey(typeName, titleText, optionsText);
    if (typeName === '多选题') {
        question.错误答案 = [];
        const correctNorms = new Set((question.正确答案 || []).map(normalizeForCompare));
        question.明确错误答案 = correctNorms.size
            ? (question.选项 || []).filter(option => !correctNorms.has(normalizeForCompare(option)))
            : [];
    } else {
        question.明确错误答案 = [];
    }
    return previousType;
};

const findShortestVisibleTextElement = (pattern) => {
    const scope = document.getElementById('app') || document.body;
    return [...scope.querySelectorAll('*')]
        .filter(node => isVisible(node) && pattern.test(node.innerText || ''))
        .sort((a, b) => (a.innerText || '').length - (b.innerText || '').length)[0] || null;
};

const trueEquivs = ['true', '正确', '对', 'yes', 't'];
const falseEquivs = ['false', '错误', '错', 'no', 'f'];

const detectTypeFromText = (text) => {
    const value = String(text || '').replace(/\s+/g, ' ').trim();
    if (!value) return '';
    if (/多选题|多项选择|multiple[-\s]?(?:answer|choice)|multi[-\s]?(?:answer|choice)/i.test(value)) return '多选题';
    if (/判断题|是非题|true\s*\/\s*false|true\s+or\s+false|judg(?:e)?ment|boolean/i.test(value)) return '判断题';
    if (/单选题|单项选择|single[-\s]?(?:answer|choice)/i.test(value)) return '单选题';
    return '';
};

const getQuestionSections = () => {
    const panels = [...document.querySelectorAll('[id^="rc-tabs-"][id*="-panel-"]')]
        .filter(panel => isVisible(panel));
    const sectionEls = [];
    const seen = new Set();

    for (const panel of panels) {
        const expectedRoot = panel.firstElementChild && panel.firstElementChild.firstElementChild;
        const candidates = expectedRoot
            ? [...expectedRoot.children]
            : [];
        for (const candidate of candidates) {
            const list = [...candidate.children].find(child => child.tagName === 'UL');
            if (!list || seen.has(list)) continue;
            const navItems = [...list.children].filter(child => child.tagName === 'LI');
            if (!navItems.length) continue;
            seen.add(list);
            sectionEls.push({ sectionEl: candidate, list, navItems });
        }
    }

    // 兼容页面包装层发生变化：只在标准层级未命中时，从可见 tab panel 中寻找题号列表。
    if (!sectionEls.length) {
        for (const panel of panels) {
            for (const list of panel.querySelectorAll('ul')) {
                if (seen.has(list)) continue;
                const navItems = [...list.children].filter(child => child.tagName === 'LI');
                const questionLikeCount = navItems.filter(item => /(?:第\s*)?\d+\s*题|question\s*\d+/i.test(item.innerText || '')).length;
                if (!navItems.length || questionLikeCount < Math.max(1, Math.ceil(navItems.length / 2))) continue;
                seen.add(list);
                sectionEls.push({ sectionEl: list.parentElement, list, navItems });
            }
        }
    }

    return sectionEls.map((section, index) => {
        const headerText = [...section.sectionEl.children]
            .filter(child => child !== section.list)
            .map(child => child.innerText || '')
            .join(' ');
        const firstLines = String(section.sectionEl.innerText || '').split(/\r?\n/).slice(0, 3).join(' ');
        return {
            ...section,
            sectionIndex: index,
            typeName: detectTypeFromText(headerText) || detectTypeFromText(firstLines)
        };
    });
};

const isBooleanOptionSet = (optionsText) => {
    if (!Array.isArray(optionsText) || optionsText.length !== 2) return false;
    const normalized = optionsText.map(normalizeForCompare);
    return normalized.some(value => trueEquivs.includes(value))
        && normalized.some(value => falseEquivs.includes(value));
};

const detectCurrentQuestionType = (sectionType, titleEl, optionEls, optionsText) => {
    // 只读取当前题目附近短小且以题型开头的标签，避免题目正文恰好提到 “multiple choice” 时误判。
    let scope = titleEl;
    for (let depth = 0; scope && depth < 5; depth++, scope = scope.parentElement) {
        const candidates = [scope, ...scope.querySelectorAll('div, span, p, h1, h2, h3, h4')];
        for (const candidate of candidates) {
            const labelText = String(candidate.innerText || '').replace(/\s+/g, ' ').trim();
            if (!labelText || labelText.length > 120) continue;
            const explicitLabel = /^(?:多选题|多项选择|单选题|单项选择|判断题|是非题|multiple[-\s]?(?:answer|choice)|multi[-\s]?(?:answer|choice)|single[-\s]?(?:answer|choice)|true\s*\/\s*false|true\s+or\s+false|judg(?:e)?ment|boolean)(?:\s|$)/i.test(labelText);
            if (!explicitLabel) continue;
            const detected = detectTypeFromText(labelText);
            if (detected) return detected;
        }
    }

    if (isBooleanOptionSet(optionsText)) return '判断题';
    if (sectionType) return sectionType;

    const hasRadio = optionEls.some(option => option.matches('input[type="radio"], [role="radio"]')
        || option.querySelector('input[type="radio"], [role="radio"]'));
    const hasCheckbox = optionEls.some(option => option.matches('input[type="checkbox"], [role="checkbox"]')
        || option.querySelector('input[type="checkbox"], [role="checkbox"]'));
    if (hasRadio) return '单选题';
    if (hasCheckbox) return '多选题';
    return '单选题';
};

const getQuestionNumber = (navItem, fallback) => {
    const text = String(navItem && navItem.innerText || '');
    const match = text.match(/第\s*(\d+)\s*题|question\s*(\d+)/i);
    return Number(match && (match[1] || match[2])) || fallback;
};

const generateQID = () => {
    const d = new Date();
    const dateStr = d.getFullYear().toString().substring(2) + (d.getMonth() + 1).toString().padStart(2, '0') + d.getDate().toString().padStart(2, '0');
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `Q${dateStr}-${randomStr}`;
};

const examNamePath = `//*[@id="app"]/div/div/div[1]/div/div[1]/div[1]/div/div[1]/div[1]/span`;
const examNameEl = getEl(examNamePath);
let defaultExamName = examNameEl && examNameEl.innerText ? examNameEl.innerText.trim() : (document.title.substring(0, 15) || t('defaultExam'));

const style = document.createElement('style');
style.innerHTML = `
    #scraper-minimized-icon { position: fixed; bottom: 30px; right: 30px; width: 50px; height: 50px; background: #2563eb; color: white; border-radius: 50%; display: none; justify-content: center; align-items: center; font-size: 24px; box-shadow: 0 4px 16px rgba(37, 99, 235, 0.4); cursor: pointer; z-index: 999999; transition: all 0.2s ease; }
    #scraper-minimized-icon:hover { transform: scale(1.1); background: #1d4ed8; }
    #exam-scraper-widget { position: fixed; top: 100px; right: 20px; width: 450px; min-width: 380px; height: 550px; max-height: 90vh; background: #ffffff; border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.2); font-family: sans-serif; z-index: 999999; display: flex; flex-direction: column; overflow: hidden; border: 1px solid #e2e8f0; resize: both; }
    #scraper-header { background: #1e293b; color: white; padding: 12px 16px; font-size: 15px; font-weight: bold; cursor: move; display: flex; justify-content: space-between; align-items: center; user-select: none; flex-shrink: 0; }
    #scraper-close { cursor: pointer; color: #94a3b8; font-size: 18px; line-height: 1; padding: 0 4px; } #scraper-close:hover { color: #fff; }
    #scraper-lang { cursor: pointer; background: #334155; color: #fff; border: 1px solid #64748b; border-radius: 4px; padding: 2px 8px; font-size: 12px; margin-left: auto; margin-right: 8px; }
    #scraper-body { padding: 16px; display: flex; flex-direction: column; gap: 12px; position: relative; flex: 1; min-height: 0; overflow: hidden; }
    .scraper-row { display: flex; align-items: center; justify-content: space-between; font-size: 13px; flex-shrink: 0; }
    .scraper-row input { padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 4px; outline: none; width: 220px; }
    .scraper-stats { background: #f1f5f9; padding: 10px; border-radius: 6px; font-size: 13px; color: #334155; flex-shrink: 0; }
    .scraper-stats span { font-weight: bold; color: #0f172a; }
    #scraper-log { flex: 1; min-height: 0; overflow-y: auto; background: #1e1e1e; color: #a7f3d0; padding: 8px; border-radius: 6px; font-size: 12px; font-family: monospace; line-height: 1.4; word-break: break-all; }
    .scraper-btn { background: #2563eb; color: white; border: none; padding: 8px 0; border-radius: 4px; cursor: pointer; font-weight: bold; flex: 1; font-size: 13px; flex-shrink: 0; }
    .scraper-btn:hover { background: #1d4ed8; }
    .scraper-btn-danger { background: #ef4444; } .scraper-btn-danger:hover { background: #b91c1c; }
    .scraper-btn-success { background: #10b981; } .scraper-btn-success:hover { background: #059669; }
    .scraper-btn-warning { background: #f59e0b; } .scraper-btn-warning:hover { background: #d97706; }
    .scraper-btn-purple { background: #8b5cf6; } .scraper-btn-purple:hover { background: #7c3aed; }
    .btn-group { display: flex; gap: 8px; flex-shrink: 0; }
    #scraper-close-dialog { display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255, 255, 255, 0.9); z-index: 100; flex-direction: column; justify-content: center; align-items: center; backdrop-filter: blur(2px); }
    .dialog-box { background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); border: 1px solid #cbd5e1; text-align: center; width: 85%; }

    #scraper-data-modal { display: none; position: fixed; top: 5vh; left: 5vw; width: 90vw; height: 90vh; min-width: 520px; min-height: 320px; max-width: calc(100vw - 16px); max-height: calc(100vh - 16px); background: #fff; z-index: 1000000; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); flex-direction: column; overflow: hidden; border: 1px solid #cbd5e1; font-family: sans-serif; resize: both; }
    #scraper-data-modal::after { content: ''; position: absolute; right: 3px; bottom: 3px; width: 12px; height: 12px; pointer-events: none; background: linear-gradient(135deg, transparent 50%, #64748b 51%); opacity: .7; }
    #modal-header { background: #0f172a; color: white; padding: 16px 20px; font-size: 18px; font-weight: bold; display: flex; justify-content: space-between; align-items: center; cursor: move; user-select: none; flex-shrink: 0; touch-action: none; }
    #modal-close { cursor: pointer; font-size: 24px; color: #cbd5e1; line-height: 1; } #modal-close:hover { color: #fff; }
    #modal-info { padding: 12px 20px; background: #f8fafc; font-size: 13px; color: #475569; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
    #modal-search-input { padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 6px; outline: none; width: 260px; font-size: 13px; }
    #modal-content { flex: 1; overflow: auto; padding: 0; background: #f1f5f9; }
    #exam-table { width: 100%; border-collapse: collapse; background: #fff; font-size: 13px; }
    #exam-table th { background: #e2e8f0; padding: 12px 16px; text-align: left; position: sticky; top: 0; z-index: 10; border-bottom: 2px solid #cbd5e1; }
    #exam-table td { padding: 12px 16px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    #exam-table tr:hover { background: #f8fafc; }
    .ans-label { display: flex; align-items: flex-start; gap: 6px; margin-bottom: 6px; cursor: pointer; padding: 6px 8px; border-radius: 6px; transition: all 0.15s ease; border: 1px solid transparent; }
    .ans-label:hover { background: #f1f5f9; }
    .ans-label.selected { background: #dcfce7; border-color: #86efac; color: #15803d; font-weight: bold; }
    .ans-label.wrong-opt { background: #fee2e2; border-color: #fca5a5; color: #b91c1c; text-decoration: line-through; }
    .count-badge { background: #ef4444; color: white; padding: 2px 6px; border-radius: 12px; font-size: 12px; font-weight: bold; }
    .id-badge { font-family: monospace; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 11px; color: #475569; }
    .wrong-combos-box { margin-top: 8px; padding: 6px 8px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; font-size: 11px; color: #9f1239; }
    .wrong-combo-item { display: inline-block; background: #ffe4e6; padding: 2px 6px; border-radius: 4px; margin: 2px; border: 1px solid #f43f5e; color: #881337; }
    @media (max-width: 640px) {
        #scraper-data-modal { top: 8px; left: 8px; width: calc(100vw - 16px); height: calc(100vh - 16px); min-width: 0; min-height: 0; resize: none; }
        #modal-info { align-items: stretch; flex-direction: column; gap: 8px; }
        #modal-search-input { width: 100%; }
    }
`;
document.head.appendChild(style);

const minIcon = document.createElement('div');
minIcon.id = 'scraper-minimized-icon'; minIcon.innerHTML = '🚀'; document.body.appendChild(minIcon);

const widget = document.createElement('div');
widget.id = 'exam-scraper-widget';
widget.innerHTML = `
    <div id="scraper-header"><span id="ui-title">${t('title')}</span><button id="scraper-lang">${t('language')}</button><span id="scraper-close" title="${t('closeTitle')}">×</span></div>
    <div id="scraper-body">
        <div id="scraper-close-dialog">
            <div class="dialog-box">
                <div id="ui-close-options" style="font-weight:bold; margin-bottom:16px; font-size:15px;">${t('closeOptions')}</div>
                <div class="btn-group" style="margin-bottom:12px;">
                    <button class="scraper-btn" id="btn-minimize">${t('minimize')}</button>
                    <button class="scraper-btn scraper-btn-danger" id="btn-quit">${t('quit')}</button>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px;">
                    <label style="cursor:pointer; color:#475569;"><input type="checkbox" id="chk-remember"> <span id="ui-remember">${t('remember')}</span></label>
                    <span id="btn-cancel-close" style="color:#94a3b8; cursor:pointer;">${t('cancel')}</span>
                </div>
            </div>
        </div>
        <div class="scraper-row"><label id="ui-exam-name">${t('examName')}</label><input type="text" id="scraper-exam-name" list="exam-name-list" value="${defaultExamName}" placeholder="${t('examPlaceholder')}"> <datalist id="exam-name-list"></datalist></div>
        <div class="scraper-row"><label id="ui-delay">${t('delay')}</label><input type="number" id="scraper-delay" value="600" step="100"></div>
        <div class="scraper-stats">
            <div><span id="ui-total-prefix">${t('totalPrefix')}</span> <span id="stat-total">0</span> <span id="ui-question-unit">${t('questionUnit')}</span></div>
            <div style="margin-top:4px;"><span id="ui-status-label">${t('status')}</span> <span id="stat-status" style="color:#2563eb;">${t('ready')}</span></div>
        </div>
        <div id="scraper-log">${t('welcome')}</div>
        <div class="btn-group">
            <button class="scraper-btn" id="btn-start">${t('start')}</button>
            <button class="scraper-btn scraper-btn-purple" id="btn-auto-answer">${t('autoAnswer')}</button>
            <button class="scraper-btn scraper-btn-danger" id="btn-stop" disabled>${t('stop')}</button>
        </div>
        <div class="btn-group">
            <button class="scraper-btn scraper-btn-warning" id="btn-view">${t('view')}</button>
        </div>
        <div class="btn-group">
            <button class="scraper-btn scraper-btn-success" id="btn-export">${t('exportJson')}</button>
            <button class="scraper-btn" style="background:#0ea5e9;" id="btn-import">${t('importJson')}</button>
            <button class="scraper-btn" style="background:#64748b;" id="btn-clear">${t('clear')}</button>
            <input type="file" id="scraper-import-file" accept="application/json,.json" style="display:none;">
        </div>
    </div>
`;
document.body.appendChild(widget);

const modal = document.createElement('div');
modal.id = 'scraper-data-modal';
modal.innerHTML = `
    <div id="modal-header" title="拖动标题栏移动窗口；拖动右下角调整大小"><span id="ui-modal-title">${t('modalTitle')}</span><span id="modal-close">×</span></div>
    <div id="modal-info">
        <div>Key: <strong id="modal-key-display"></strong> <span id="ui-correct-hint" style="margin-left: 10px; color:#10b981;">${t('correctHint')}</span></div>
        <input type="text" id="modal-search-input" placeholder="${t('search')}">
    </div>
    <div id="modal-content"><table id="exam-table"><thead><tr><th width="10%">ID</th><th id="ui-th-type" width="8%">${t('type')}</th><th id="ui-th-question" width="32%">${t('question')}</th><th id="ui-th-options" width="42%">${t('options')}</th><th id="ui-th-count" width="8%">${t('count')}</th></tr></thead><tbody id="exam-table-body"></tbody></table></div>
`;
document.body.appendChild(modal);

const header = document.getElementById('scraper-header');
let isDragging = false, startX, startY, initialX, initialY;
header.addEventListener('mousedown', e => {
    if(e.target.id === 'scraper-close' || e.target.id === 'scraper-lang') return;
    isDragging = true;
    const rect = widget.getBoundingClientRect(); initialX = rect.left; initialY = rect.top;
    startX = e.clientX; startY = e.clientY; document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', drag); document.addEventListener('mouseup', stopDrag);
});
function drag(e) { if (!isDragging) return; widget.style.left = (initialX + e.clientX - startX) + 'px'; widget.style.top = (initialY + e.clientY - startY) + 'px'; widget.style.right = 'auto'; widget.style.bottom = 'auto'; }
function stopDrag() { isDragging = false; document.body.style.userSelect = ''; document.removeEventListener('mousemove', drag); document.removeEventListener('mouseup', stopDrag); }

const modalHeader = document.getElementById('modal-header');
let modalDragState = null;
modalHeader.addEventListener('pointerdown', e => {
    if (e.target.id === 'modal-close' || e.button !== 0 || window.innerWidth <= 640) return;
    const rect = modal.getBoundingClientRect();
    modalDragState = { startX: e.clientX, startY: e.clientY, left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    // 固定当前尺寸后再移动，避免原来的视口百分比改变窗口大小。
    modal.style.width = `${rect.width}px`;
    modal.style.height = `${rect.height}px`;
    modal.style.left = `${rect.left}px`;
    modal.style.top = `${rect.top}px`;
    document.body.style.userSelect = 'none';
    document.addEventListener('pointermove', dragModal);
    document.addEventListener('pointerup', stopModalDrag);
    e.preventDefault();
});

function dragModal(e) {
    if (!modalDragState) return;
    const maxLeft = Math.max(0, window.innerWidth - modalDragState.width);
    const maxTop = Math.max(0, window.innerHeight - modalDragState.height);
    modal.style.left = `${Math.max(0, Math.min(maxLeft, modalDragState.left + e.clientX - modalDragState.startX))}px`;
    modal.style.top = `${Math.max(0, Math.min(maxTop, modalDragState.top + e.clientY - modalDragState.startY))}px`;
}

function stopModalDrag() {
    modalDragState = null;
    document.body.style.userSelect = '';
    document.removeEventListener('pointermove', dragModal);
    document.removeEventListener('pointerup', stopModalDrag);
}

window.addEventListener('resize', () => {
    if (modal.style.display !== 'flex' || window.innerWidth <= 640) return;
    const rect = modal.getBoundingClientRect();
    modal.style.left = `${Math.max(0, Math.min(rect.left, window.innerWidth - rect.width))}px`;
    modal.style.top = `${Math.max(0, Math.min(rect.top, window.innerHeight - rect.height))}px`;
});

const dialogOverlay = document.getElementById('scraper-close-dialog'); const chkRemember = document.getElementById('chk-remember');
function executeCloseAction(action) { if(action === 'minimize') { widget.style.display = 'none'; modal.style.display = 'none'; minIcon.style.display = 'flex'; } else if(action === 'quit') { window.removeEventListener('message', handleExtensionPopupMessage); widget.remove(); modal.remove(); minIcon.remove(); style.remove(); } }
function handleExtensionPopupMessage(event) {
    if (event.source !== window || event.data?.source !== 'EXTENSION_POPUP') return;
    if (event.data.action === 'START') {
        minIcon.style.display = 'none';
        widget.style.display = 'flex';
    } else if (event.data.action === 'STOP') {
        window.removeEventListener('message', handleExtensionPopupMessage);
        executeCloseAction('quit');
    }
}
window.addEventListener('message', handleExtensionPopupMessage);
document.getElementById('scraper-close').onclick = () => { const savedAction = localStorage.getItem('scraper_close_behavior'); if (savedAction === 'minimize' || savedAction === 'quit') executeCloseAction(savedAction); else dialogOverlay.style.display = 'flex'; };
document.getElementById('btn-cancel-close').onclick = () => { dialogOverlay.style.display = 'none'; };
document.getElementById('btn-minimize').onclick = () => { if(chkRemember.checked) localStorage.setItem('scraper_close_behavior', 'minimize'); dialogOverlay.style.display = 'none'; executeCloseAction('minimize'); };
document.getElementById('btn-quit').onclick = () => { if(chkRemember.checked) localStorage.setItem('scraper_close_behavior', 'quit'); executeCloseAction('quit'); };
minIcon.onclick = () => { minIcon.style.display = 'none'; widget.style.display = 'flex'; };
document.getElementById('modal-close').onclick = () => { modal.style.display = 'none'; };

let isRunning = false; let scrapedData = [];
const logEl = document.getElementById('scraper-log'); const totalEl = document.getElementById('stat-total'); const statusEl = document.getElementById('stat-status');
const examNameInput = document.getElementById('scraper-exam-name'); const datalist = document.getElementById('exam-name-list'); const tbody = document.getElementById('exam-table-body');
const getStorageKey = () => `ScraperData_${examNameInput.value.trim()}`;
let currentStatusKey = 'ready';
function setStatus(key, color) {
    currentStatusKey = key;
    statusEl.innerText = t(key);
    if (color) statusEl.style.color = color;
}
function applyLanguage() {
    document.getElementById('ui-title').innerText = t('title');
    document.getElementById('scraper-close').title = t('closeTitle');
    document.getElementById('scraper-lang').innerText = t('language');
    document.getElementById('ui-close-options').innerText = t('closeOptions');
    document.getElementById('btn-minimize').innerText = t('minimize');
    document.getElementById('btn-quit').innerText = t('quit');
    document.getElementById('ui-remember').innerText = t('remember');
    document.getElementById('btn-cancel-close').innerText = t('cancel');
    document.getElementById('ui-exam-name').innerText = t('examName');
    examNameInput.placeholder = t('examPlaceholder');
    document.getElementById('ui-delay').innerText = t('delay');
    document.getElementById('ui-total-prefix').innerText = t('totalPrefix');
    document.getElementById('ui-question-unit').innerText = t('questionUnit');
    document.getElementById('ui-status-label').innerText = t('status');
    statusEl.innerText = t(currentStatusKey);
    document.getElementById('btn-start').innerText = t('start');
    document.getElementById('btn-auto-answer').innerText = t('autoAnswer');
    document.getElementById('btn-stop').innerText = t('stop');
    document.getElementById('btn-view').innerText = t('view');
    document.getElementById('btn-export').innerText = t('exportJson');
    document.getElementById('btn-import').innerText = t('importJson');
    document.getElementById('btn-clear').innerText = t('clear');
    document.getElementById('ui-modal-title').innerText = t('modalTitle');
    document.getElementById('ui-correct-hint').innerText = t('correctHint');
    document.getElementById('modal-search-input').placeholder = t('search');
    document.getElementById('ui-th-type').innerText = t('type');
    document.getElementById('ui-th-question').innerText = t('question');
    document.getElementById('ui-th-options').innerText = t('options');
    document.getElementById('ui-th-count').innerText = t('count');
    if (modal.style.display === 'flex') renderTable();
}
document.getElementById('scraper-lang').onclick = e => {
    e.stopPropagation();
    currentLang = currentLang === 'zh' ? 'en' : 'zh';
    localStorage.setItem('exam_scraper_language', currentLang);
    applyLanguage();
};

function refreshExamList() {
    datalist.innerHTML = '';
    for (let i = 0; i < localStorage.length; i++) {
        let key = localStorage.key(i);
        if (key.startsWith('ScraperData_')) { let option = document.createElement('option'); option.value = key.substring(12); datalist.appendChild(option); }
    }
}

function loadLocalData() {
    let key = getStorageKey();
    try {
        const parsed = JSON.parse(localStorage.getItem(key) || '[]');
        if (!Array.isArray(parsed)) throw new Error('Question bank must be an array');
        scrapedData = parsed;
        let hasModified = false;
        let repairedLearningCount = 0;
        scrapedData.forEach(q => {
            if (!q || typeof q !== 'object' || typeof q.题目 !== 'string') throw new Error('Invalid question record');
            if (!q.id) { q.id = generateQID(); hasModified = true; }
            if (!Array.isArray(q.选项)) { q.选项 = []; hasModified = true; }
            if (!Array.isArray(q.正确答案)) { q.正确答案 = []; hasModified = true; }
            if (!Array.isArray(q.错误答案)) { q.错误答案 = []; hasModified = true; }
            if (!Array.isArray(q.明确错误答案)) { q.明确错误答案 = []; hasModified = true; }
            if (!Array.isArray(q.错误组合)) { q.错误组合 = []; hasModified = true; }
            const variantKey = getQuestionVariantKey(q.题型, q.题目, q.选项);
            if (q.variantKey !== variantKey) { q.variantKey = variantKey; hasModified = true; }

            // 清理旧版按题干误合并后遗留的跨选项答案与错误组合。
            const optionNorms = new Set(q.选项.map(normalizeForCompare).filter(Boolean));
            const oldLearningState = JSON.stringify([q.正确答案, q.错误答案, q.明确错误答案, q.错误组合]);
            q.正确答案 = uniqueAnswerTexts(q.正确答案).filter(answer => optionNorms.has(normalizeForCompare(answer)));
            q.错误答案 = uniqueAnswerTexts(q.错误答案).filter(answer => optionNorms.has(normalizeForCompare(answer)));
            q.明确错误答案 = uniqueAnswerTexts(q.明确错误答案).filter(answer => optionNorms.has(normalizeForCompare(answer)));
            const comboKeys = new Set();
            q.错误组合 = q.错误组合
                .filter(Array.isArray)
                .map(uniqueAnswerTexts)
                .filter(combo => combo.length > 0 && combo.every(answer => optionNorms.has(normalizeForCompare(answer))))
                .filter(combo => {
                    const key = getNormComboStr(combo);
                    if (comboKeys.has(key)) return false;
                    comboKeys.add(key);
                    return true;
                });

            if (q.题型 === '多选题') {
                // 旧版可能把“错误组合”的每个成员都写进错误答案；组合错误不能推出单项错误，必须清除。
                q.错误答案 = [];
                if (q.正确答案.length > 0) {
                    const correctNorms = new Set(q.正确答案.map(normalizeForCompare));
                    q.明确错误答案 = q.选项.filter(option => !correctNorms.has(normalizeForCompare(option)));
                } else {
                    q.明确错误答案 = [];
                }
            }
            if (oldLearningState !== JSON.stringify([q.正确答案, q.错误答案, q.明确错误答案, q.错误组合])) {
                hasModified = true;
                repairedLearningCount++;
            }
        });
        if (hasModified) localStorage.setItem(key, JSON.stringify(scrapedData));
        if (repairedLearningCount > 0) {
            logMsg(currentLang === 'zh'
                ? `🧹 [题库修复] 已清理 ${repairedLearningCount} 道题中不属于当前选项版本的旧答案/错误组合`
                : `🧹 [Bank repair] Removed cross-variant answers/combinations from ${repairedLearningCount} question(s).`, 'warn');
        }
        totalEl.innerText = scrapedData.length;
    } catch (error) {
        scrapedData = [];
        totalEl.innerText = '0';
        logMsg(t('localDataBroken'), 'warn');
        console.warn('[Exam Scraper] Failed to load local question bank:', error);
    }
}
examNameInput.addEventListener('input', loadLocalData); refreshExamList(); loadLocalData();

function logMsg(msg, colorType = 'default') {
    const div = document.createElement('div'); div.innerText = msg;
    if(colorType === 'detail') { div.style.color = '#fff'; div.style.borderLeft = '3px solid #2563eb'; div.style.paddingLeft = '6px'; div.style.marginBottom = '8px'; }
    if(colorType === 'success') { div.style.color = '#34d399'; div.style.fontWeight = 'bold'; }
    if(colorType === 'warn') { div.style.color = '#fbbf24'; }
    if(colorType === 'info') { div.style.color = '#38bdf8'; div.style.fontWeight = 'bold'; }
    if(colorType === 'guess') { div.style.color = '#c084fc'; div.style.fontWeight = 'bold'; }
    logEl.appendChild(div); logEl.scrollTop = logEl.scrollHeight;
}

function renderTable() {
    tbody.innerHTML = ''; document.getElementById('modal-key-display').innerText = getStorageKey();
    scrapedData.forEach((q, index) => {
        let tr = document.createElement('tr');
        let optionsHtml = q.选项.map((opt, i) => {
            let cleanOpt = cleanOptionText(opt);
            let normOpt = normalizeForCompare(cleanOpt);

            let isChecked = q.正确答案 && q.正确答案.some(ans => {
                let normAns = normalizeForCompare(ans);
                if (normAns === normOpt) return true;
                if (trueEquivs.includes(normAns) && trueEquivs.includes(normOpt)) return true;
                if (falseEquivs.includes(normAns) && falseEquivs.includes(normOpt)) return true;
                return false;
            });

            const wrongOptionsForDisplay = q.题型 === '多选题' ? q.明确错误答案 : q.错误答案;
            let isWrongOpt = wrongOptionsForDisplay && wrongOptionsForDisplay.some(w => normalizeForCompare(w) === normOpt);

            let selectedClass = isChecked ? 'selected' : (isWrongOpt ? 'wrong-opt' : '');
            let safeOpt = cleanOpt.replace(/"/g, '&quot;');

            return `<label class="ans-label ${selectedClass}">
                        <input type="checkbox" class="ans-check" data-idx="${index}" value="${safeOpt}" ${isChecked ? 'checked' : ''}>
                        <span><b>${String.fromCharCode(65+i)}.</b> ${cleanOpt}</span>
                    </label>`;
        }).join('');

        if (q.题型 === '多选题' && q.错误组合 && q.错误组合.length > 0) {
            let comboBadges = q.错误组合.map((comboArr, cIdx) => {
                let comboNames = comboArr.map(item => {
                    let optIdx = q.选项.findIndex(o => cleanOptionText(o) === cleanOptionText(item));
                    return optIdx !== -1 ? String.fromCharCode(65 + optIdx) : item.substring(0, 6);
                });
                comboNames.sort();
                return `<span class="wrong-combo-item" title="${comboArr.join(', ')}">${t('combo')}${cIdx+1}: [${comboNames.join('+')}]</span>`;
            }).join(' ');

            optionsHtml += `<div class="wrong-combos-box">
                <div><b>${t('excludedCombos', q.错误组合.length)}</b></div>
                <div style="margin-top:4px;">${comboBadges}</div>
            </div>`;
        }

        let countHtml = q.出现次数 > 1 ? `<span class="count-badge">${q.出现次数}</span>` : `1`;
        tr.innerHTML = `<td><span class="id-badge">${q.id || 'N/A'}</span></td><td><b>${typeLabel(q.题型)}</b></td><td>${q.题目}</td><td>${optionsHtml}</td><td style="text-align:center;">${countHtml}</td>`;
        tbody.appendChild(tr);
    });
}

document.getElementById('modal-search-input').addEventListener('input', (e) => {
    const keyword = e.target.value.trim().toLowerCase();
    const rows = tbody.querySelectorAll('tr');
    scrapedData.forEach((q, idx) => {
        const tr = rows[idx];
        if (!tr) return;
        const matchId = (q.id || '').toLowerCase().includes(keyword);
        const matchTitle = (q.题目 || '').toLowerCase().includes(keyword);
        const matchOpt = (q.选项 || []).some(o => (o || '').toLowerCase().includes(keyword));
        if (matchId || matchTitle || matchOpt) { tr.style.display = ''; } else { tr.style.display = 'none'; }
    });
});

tbody.addEventListener('change', (e) => {
    if(e.target.classList.contains('ans-check')) {
        let idx = e.target.getAttribute('data-idx'); let val = e.target.value; let q = scrapedData[idx];
        let isSingleChoice = (q.题型 === '单选题' || q.题型 === '判断题');
        if(!q.正确答案) q.正确答案 = [];
        if(e.target.checked) {
            if (isSingleChoice) {
                q.正确答案 = [val]; let siblings = tbody.querySelectorAll(`.ans-check[data-idx="${idx}"]`);
                siblings.forEach(cb => { if(cb !== e.target) { cb.checked = false; cb.closest('.ans-label').classList.remove('selected'); } });
            } else { if(!q.正确答案.includes(val)) q.正确答案.push(val); }
            e.target.closest('.ans-label').classList.add('selected');
            e.target.closest('.ans-label').classList.remove('wrong-opt');
        } else {
            q.正确答案 = q.正确答案.filter(v => v !== val); e.target.closest('.ans-label').classList.remove('selected');
        }

        if (q.题型 === '多选题') {
            q.正确答案.sort((a, b) => normalizeForCompare(a).localeCompare(normalizeForCompare(b)));
        }

        localStorage.setItem(getStorageKey(), JSON.stringify(scrapedData));
    }
});

document.getElementById('btn-view').onclick = () => {
    loadLocalData(); if(scrapedData.length === 0) { alert(t('emptyBank')); return; }
    renderTable(); document.getElementById('modal-search-input').value = ''; modal.style.display = 'flex';
};

// --- 🌟 智能抓取 ---
document.getElementById('btn-start').onclick = async () => {
    if (!examNameInput.value.trim()) { alert(t('needName')); return; }

    const bodyText = document.body.innerText;
    let isReviewMode = false;

    if (bodyText.includes('答题用时') || bodyText.includes('Answer Time')) {
        isReviewMode = true;
    } else if (bodyText.includes('剩余时间') || bodyText.includes('Time Left')) {
        isReviewMode = false;
    } else {
        isReviewMode = (
            bodyText.includes('未通过') || bodyText.includes('已通过') || bodyText.includes('正确答案') ||
            bodyText.includes('No Pass') || bodyText.includes('Score：') || bodyText.includes('Score:') ||
            bodyText.includes('Correct answer') || bodyText.includes('Congratulations') || bodyText.includes('Wrong Question Feedback')
        );
    }

    isRunning = true; document.getElementById('btn-start').disabled = true; document.getElementById('btn-auto-answer').disabled = true; document.getElementById('btn-stop').disabled = false;
    examNameInput.disabled = true; setStatus(isReviewMode ? 'scrapingReview' : 'scrapingExam', '#10b981');

    logMsg(currentLang === 'zh' ? `--- 🚀 开始抓取 [${examNameInput.value.trim()}] ---` : `--- 🚀 Started scraping [${examNameInput.value.trim()}] ---`);
    logMsg(currentLang === 'zh' ? `👀 模式: 【${isReviewMode ? '复盘/查看详情模式' : '正常考试模式'}】` : `👀 Mode: [${isReviewMode ? 'Review / details' : 'Normal exam'}]`, 'info');

    const delay = parseInt(document.getElementById('scraper-delay').value) || 500;
    const initialSections = getQuestionSections(); let newCount = 0; let autoAnswerCount = 0; let learnedCount = 0;
    if (!initialSections.length) {
        logMsg(currentLang === 'zh' ? '⚠️ 未识别到题型导航区段，已停止以避免错分题型。' : '⚠️ No question sections were detected. Stopped to avoid misclassifying questions.', 'warn');
        isRunning = false;
    }

    for (let sectionIndex = 0; sectionIndex < initialSections.length && isRunning; sectionIndex++) {
        let qIndex = 1;
        let sectionType = initialSections[sectionIndex].typeName;
        logMsg(currentLang === 'zh'
            ? `[区段] 开始检查 ${sectionType || `第${sectionIndex + 1}区段（逐题识别）`}...`
            : `[Section] Checking ${sectionType ? typeLabel(sectionType) : `section ${sectionIndex + 1} (per-question detection)`}...`);
        while (isRunning) {
            const currentSection = getQuestionSections()[sectionIndex];
            let navLi = currentSection && currentSection.navItems[qIndex - 1];

            if (!navLi) {
                const completedType = sectionType || (currentLang === 'zh' ? `第${sectionIndex + 1}区段` : `section ${sectionIndex + 1}`);
                logMsg(currentLang === 'zh' ? `✅ ${completedType} 结束` : `✅ ${sectionType ? typeLabel(sectionType) : completedType} completed`);
                break;
            }

            const questionNumber = getQuestionNumber(navLi, qIndex);

            let navTarget = navLi.querySelector('a') || navLi.querySelector('span') || navLi;
            navTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
            navTarget.click();
            await sleep(delay);

            let titleEl = getEl(`//*[@id="app"]/div/div/div[1]/div/div[1]/div[2]/div[2]/div/div/div[2]/div[1]/div[1]/div/div/div`);
            let titleText = titleEl ? titleEl.innerText.trim() : "";

            if(titleText) {
                let optionEls = getEls(`//*[@id="app"]/div/div/div[1]/div/div[1]/div[2]/div[2]/div/div/div[2]/div[1]/div[2]/div`);
                let optionsText = [];
                let checkedOptionsText = [];

                for(let opt of optionEls) {
                    let cleaned = cleanOptionText(opt.innerText);
                    if(cleaned) {
                        optionsText.push(cleaned);
                        if (isOptionSelected(opt)) checkedOptionsText.push(cleaned);
                    }
                }

                const typeName = detectCurrentQuestionType(currentSection && currentSection.typeName || sectionType, titleEl, optionEls, optionsText);
                if (!sectionType) sectionType = typeName;
                if (currentSection && currentSection.typeName && currentSection.typeName !== typeName) {
                    logMsg(currentLang === 'zh'
                        ? `🔎 [题型纠正] 第${questionNumber}题：区段标记为${currentSection.typeName}，页面识别为${typeName}`
                        : `🔎 [Type corrected] Question ${questionNumber}: section says ${typeLabel(currentSection.typeName)}, page detected ${typeLabel(typeName)}.`, 'warn');
                }

                let isCorrectAnswer = false;
                let isWrongAnswer = false;
                let officialAnswers = [];

                if (isReviewMode) {
                    let resultEl = findShortestVisibleTextElement(/答对了|答错了|遗憾|Congratulations|Wrong answer|Wrong Question|Incorrect/i) ||
                        getEl(`//*[@id="app"]/div/div/div[1]/div/div[1]/div[2]/div[2]/div/div/div[2]/div[4]/div[1]/span[1]`);
                    let resText = resultEl ? resultEl.innerText : "";

                    if (resText.includes('答对了') || resText.includes('Congratulations') || (resultEl && resultEl.classList.contains('pass'))) {
                        isCorrectAnswer = true;
                    } else if (resText.includes('答错了') || resText.includes('遗憾') || /Wrong answer|Wrong Question|Incorrect/i.test(resText) || (resultEl && resultEl.classList.contains('fail'))) {
                        isWrongAnswer = true;
                    }

                    let reviewBlock = findShortestVisibleTextElement(/(?:正确答案|Correct answer)\s*[：:]/i) ||
                        getEl(`//*[@id="app"]/div/div/div[1]/div/div[1]/div[2]/div[2]/div/div/div[2]/div[4]`);
                    if (reviewBlock) {
                        let blockText = reviewBlock.innerText || "";
                        // 只读取“正确答案”所在行，避免把下一行说明文字一起吞进答案。
                        let match = blockText.match(/(?:正确答案|Correct answer)\s*[：:]\s*([^\r\n]+)/i);
                        if (match && match[1]) {
                            let ansRaw = match[1].trim();
                            let textAnsNorm = normalizeForCompare(ansRaw);
                            let isTextMatch = false;

                            let exactMatch = optionsText.find(o => normalizeForCompare(o) === textAnsNorm);
                            if (exactMatch) {
                                officialAnswers.push(exactMatch); isTextMatch = true;
                            } else if (trueEquivs.includes(textAnsNorm) || falseEquivs.includes(textAnsNorm)) {
                                let isTrue = trueEquivs.includes(textAnsNorm);
                                let semanticMatch = optionsText.find(o => {
                                    let n = normalizeForCompare(o);
                                    return isTrue ? trueEquivs.includes(n) : falseEquivs.includes(n);
                                });
                                if (semanticMatch) { officialAnswers.push(semanticMatch); isTextMatch = true; }
                            }

                            if (!isTextMatch && /^[A-Ha-h\s,，、;；/|&+]+$/.test(ansRaw)) {
                                let letters = ansRaw.replace(/[^A-Ha-h]/g, '').toUpperCase();
                                for (let i = 0; i < letters.length; i++) {
                                    let letterIdx = letters.charCodeAt(i) - 65;
                                    if (letterIdx >= 0 && letterIdx < optionsText.length) {
                                        officialAnswers.push(optionsText[letterIdx]);
                                    }
                                }
                            }
                        }
                    }
                }

                let existingQ = findQuestionVariant(scrapedData, typeName, titleText, optionsText);
                let isNew = false;
                if (!existingQ) {
                    const legacyVariant = findQuestionVariantAcrossTypes(scrapedData, titleText, optionsText);
                    const previousType = reclassifyQuestionVariant(legacyVariant, typeName, titleText, optionsText, questionNumber);
                    if (previousType) {
                        existingQ = legacyVariant;
                        logMsg(currentLang === 'zh'
                            ? `🧹 [修复历史题型] 第${questionNumber}题：${previousType} -> ${typeName}`
                            : `🧹 [Question type repaired] Question ${questionNumber}: ${typeLabel(previousType)} -> ${typeLabel(typeName)}.`, 'warn');
                    }
                }
                if (!existingQ) {
                    const hasOtherVariant = scrapedData.some(q => q.题型 === typeName && normalizeQuestionText(q.题目) === normalizeQuestionText(titleText));
                    existingQ = { id: generateQID(), variantKey: getQuestionVariantKey(typeName, titleText, optionsText), 题型: typeName, 题号: questionNumber, 题目: titleText, 选项: optionsText, 出现次数: 0, 正确答案: [], 错误答案: [], 明确错误答案: [], 错误组合: [] };
                    scrapedData.push(existingQ);
                    isNew = true;
                    newCount++;
                    logMsg(currentLang === 'zh'
                        ? `[新增${hasOtherVariant ? '选项版本' : ''}] ${typeName} 第${questionNumber}题`
                        : `[New${hasOtherVariant ? ' option variant' : ''}] ${typeLabel(typeName)} question ${questionNumber}`);
                    logMsg(`Q: ${titleText}`, 'detail');
                }
                existingQ.出现次数++;
                if (!existingQ.错误答案) existingQ.错误答案 = [];
                if (!existingQ.明确错误答案) existingQ.明确错误答案 = [];
                if (!existingQ.错误组合) existingQ.错误组合 = [];

                if (!Array.isArray(existingQ.正确答案)) existingQ.正确答案 = [];
                if ((typeName === '单选题' || typeName === '判断题') && existingQ.正确答案.length > 1) {
                    existingQ.正确答案 = [];
                    logMsg(currentLang === 'zh'
                        ? `🧹 [修复历史数据] ${typeName} 第${questionNumber}题曾保存多个正确答案，已清空并重新学习`
                        : `🧹 [Data repair] ${typeLabel(typeName)} question ${questionNumber} had multiple saved answers; cleared for relearning.`, 'warn');
                }

                let learnedSomething = false;
                if (isReviewMode) {
                    const authoritativeAnswers = uniqueAnswerTexts(
                        officialAnswers.length > 0 ? officialAnswers : (isCorrectAnswer ? checkedOptionsText : [])
                    );
                    const sourceLabelZh = officialAnswers.length > 0 ? '官方正确答案' : '答对记录';
                    const sourceLabelEn = officialAnswers.length > 0 ? 'official answer' : 'correct attempt';

                    if (authoritativeAnswers.length > 0) {
                        if ((typeName === '单选题' || typeName === '判断题') && authoritativeAnswers.length !== 1) {
                            logMsg(currentLang === 'zh'
                                ? `⚠️ [答案识别异常] ${typeName} 第${questionNumber}题识别到 ${authoritativeAnswers.length} 个答案，已拒绝写入：${describeAnswers(authoritativeAnswers, optionsText)}`
                                : `⚠️ [Answer anomaly] ${typeLabel(typeName)} question ${questionNumber}: found ${authoritativeAnswers.length} answers; not saved.`, 'warn');
                        } else {
                            const oldCorrect = getNormComboStr(existingQ.正确答案);
                            const sortedAnswers = [...authoritativeAnswers].sort((a, b) => normalizeForCompare(a).localeCompare(normalizeForCompare(b)));
                            existingQ.正确答案 = sortedAnswers;
                            if (typeName === '多选题') {
                                const correctNorms = new Set(sortedAnswers.map(normalizeForCompare));
                                existingQ.错误答案 = [];
                                existingQ.明确错误答案 = optionsText.filter(option => !correctNorms.has(normalizeForCompare(option)));
                            }
                            const changed = oldCorrect !== getNormComboStr(sortedAnswers);
                            logMsg(currentLang === 'zh'
                                ? `🎯 [抓到${sourceLabelZh}] ${typeName} 第${questionNumber}题 -> ${describeAnswers(sortedAnswers, optionsText)}${changed ? '（已更新题库）' : '（题库已一致）'}`
                                : `🎯 [Captured ${sourceLabelEn}] ${typeLabel(typeName)} question ${questionNumber}: ${describeAnswers(sortedAnswers, optionsText)}${changed ? ' (bank updated)' : ' (already current)'}.`, 'success');
                            learnedSomething = true;
                            if (changed) {
                                autoAnswerCount++;
                            }
                        }
                    }

                    if (isWrongAnswer && checkedOptionsText.length > 0) {
                        if (typeName === '判断题' && officialAnswers.length === 0 && checkedOptionsText.length === 1) {
                            const wrongAnsNorm = normalizeForCompare(checkedOptionsText[0]);
                            const correctOne = optionsText.find(option => normalizeForCompare(option) !== wrongAnsNorm);
                            if (correctOne) {
                                const changed = getNormComboStr(existingQ.正确答案) !== getNormComboStr([correctOne]);
                                existingQ.正确答案 = [correctOne];
                                logMsg(currentLang === 'zh'
                                    ? `🧠 [反向推断正确答案] 判断题 第${questionNumber}题：排除 ${describeAnswers(checkedOptionsText, optionsText)} -> 正确为 ${describeAnswers([correctOne], optionsText)}`
                                    : `🧠 [Deduced answer] True/False question ${questionNumber}: excluded ${describeAnswers(checkedOptionsText, optionsText)} -> ${describeAnswers([correctOne], optionsText)}.`, 'success');
                                if (changed) autoAnswerCount++;
                                learnedSomething = true;
                            }
                        } else if (typeName === '单选题' || typeName === '判断题') {
                            const officialSet = new Set(officialAnswers.map(normalizeForCompare));
                            const wrongOptions = checkedOptionsText.filter(option => !officialSet.has(normalizeForCompare(option)));
                            for (const wrongOption of wrongOptions) {
                                if (!existingQ.错误答案.some(saved => normalizeForCompare(saved) === normalizeForCompare(wrongOption))) {
                                    existingQ.错误答案.push(wrongOption);
                                    logMsg(currentLang === 'zh'
                                        ? `💣 [排除错误答案] ${typeName} 第${questionNumber}题 -> ${describeAnswers([wrongOption], optionsText)}`
                                        : `💣 [Excluded wrong answer] ${typeLabel(typeName)} question ${questionNumber}: ${describeAnswers([wrongOption], optionsText)}.`, 'warn');
                                    learnedCount++;
                                    learnedSomething = true;
                                }
                            }
                        } else if (typeName === '多选题') {
                            const sortedWrongCombo = uniqueAnswerTexts(checkedOptionsText)
                                .sort((a, b) => normalizeForCompare(a).localeCompare(normalizeForCompare(b)));
                            const comboKey = getNormComboStr(sortedWrongCombo);
                            const officialKey = getNormComboStr(officialAnswers);
                            if (comboKey && comboKey !== officialKey && !existingQ.错误组合.some(combo => getNormComboStr(combo) === comboKey)) {
                                existingQ.错误组合.push(sortedWrongCombo);
                                if (getNormComboStr(existingQ.正确答案) === comboKey) {
                                    existingQ.正确答案 = [];
                                    existingQ.明确错误答案 = [];
                                    logMsg(currentLang === 'zh'
                                        ? `🧹 [修复历史数据] 已从正确答案中移除这组已证实错误的组合`
                                        : `🧹 [Data repair] Removed the confirmed-wrong combination from saved correct answers.`, 'warn');
                                }
                                logMsg(currentLang === 'zh'
                                    ? `💣 [排除错误答案组合] 多选题 第${questionNumber}题 -> ${describeAnswers(sortedWrongCombo, optionsText)}`
                                    : `💣 [Excluded wrong combination] Multiple-choice question ${questionNumber}: ${describeAnswers(sortedWrongCombo, optionsText)}.`, 'warn');
                                learnedCount++;
                                learnedSomething = true;
                            }
                        }
                    }
                }

                if (!learnedSomething && !isNew) {
                    logMsg(currentLang === 'zh' ? `[更新次数] ${typeName} 第${questionNumber}题` : `[Count updated] ${typeLabel(typeName)} question ${questionNumber}`);
                }

                localStorage.setItem(getStorageKey(), JSON.stringify(scrapedData));
                totalEl.innerText = scrapedData.length;
            }
            qIndex++;
        }
    }
    isRunning = false; document.getElementById('btn-start').disabled = false; document.getElementById('btn-auto-answer').disabled = false; document.getElementById('btn-stop').disabled = true; examNameInput.disabled = false; setStatus('stopped', '#ef4444'); refreshExamList();
    logMsg(currentLang === 'zh' ? `--- 🏁 任务结束 (新增:${newCount}题 | 收录答案:${autoAnswerCount}题 | 排雷学习:${learnedCount}次) ---` : `--- 🏁 Finished (new: ${newCount} | answers learned: ${autoAnswerCount} | eliminations learned: ${learnedCount}) ---`, 'info');
};

// --- 🤖 自动答题功能（🌟 文本匹配核心 - 完美免疫选项乱序） ---
async function guessByType(typeName, qIndex, optionEls, currentOptionsCleaned, existingQ) {
    const sourceZh = existingQ ? '题库内无正确答案' : '新题未入库';
    const sourceEn = existingQ ? 'bank question without a correct answer' : 'new question not in bank';

    if (typeName === '单选题' || typeName === '判断题') {
        let knownWrongs = existingQ ? (existingQ.错误答案 || []) : [];
        let candidatesIndices = [];
        for (let i = 0; i < currentOptionsCleaned.length; i++) {
            let normO = normalizeForCompare(currentOptionsCleaned[i]);
            let isWrong = knownWrongs.some(w => normalizeForCompare(w) === normO);
            if (!isWrong) candidatesIndices.push(i);
        }
        if (candidatesIndices.length === 0) candidatesIndices = currentOptionsCleaned.map((_, i) => i);
        if (candidatesIndices.length === 0) {
            logMsg(currentLang === 'zh' ? `⚠️ [无法猜答] ${typeName} 第${qIndex}题未抓到选项` : `⚠️ [Cannot guess] No options found for ${typeLabel(typeName)} question ${qIndex}.`, 'warn');
            return false;
        }

        let guessIdx = -1;
        let strategyName = '';
        if (typeName === '单选题' && candidatesIndices.length >= 3) {
            let lenMap = candidatesIndices.map(idx => ({ idx, len: currentOptionsCleaned[idx].length })).sort((a, b) => a.len - b.len);
            let shortest = lenMap[0];
            let longest = lenMap[lenMap.length - 1];
            let avgLen = lenMap.reduce((sum, item) => sum + item.len, 0) / lenMap.length;
            if (longest.len > avgLen * 1.35 && lenMap.slice(0, -1).every(item => item.len < avgLen * 1.2)) {
                guessIdx = longest.idx;
                strategyName = currentLang === 'zh' ? '三短一长选最长' : 'three short, one long: choose longest';
            } else if (shortest.len < avgLen * 0.75 && lenMap.slice(1).every(item => item.len > avgLen * 0.8)) {
                guessIdx = shortest.idx;
                strategyName = currentLang === 'zh' ? '三长一短选最短' : 'three long, one short: choose shortest';
            }
        }
        if (guessIdx === -1) {
            guessIdx = candidatesIndices[Math.floor(Math.random() * candidatesIndices.length)];
            strategyName = currentLang === 'zh' ? (knownWrongs.length ? '排除已知错项后随机' : '候选项随机') : (knownWrongs.length ? 'random after eliminating known wrong options' : 'random candidate');
        }

        const selection = await applyAnswerSelection([currentOptionsCleaned[guessIdx]]);
        if (!selection.success) {
            logMsg(currentLang === 'zh'
                ? `⚠️ [猜答失败] ${typeName} 第${qIndex}题页面未保持目标选项`
                : `⚠️ [Guess failed] ${typeLabel(typeName)} question ${qIndex}: the page did not retain the target option.`, 'warn');
            return false;
        }
        logMsg(currentLang === 'zh'
            ? `🔮 [策略猜答·${sourceZh}] ${typeName} 第${qIndex}题 -> ${strategyName}（选定${String.fromCharCode(65 + guessIdx)}）`
            : `🔮 [Strategy guess · ${sourceEn}] ${typeLabel(typeName)} question ${qIndex}: ${strategyName} (selected ${String.fromCharCode(65 + guessIdx)}).`, 'guess');
        return true;
    }

    if (typeName === '多选题') {
        let knownWrongCombos = existingQ ? (existingQ.错误组合 || []).map(arr => getNormComboStr(arr)) : [];
        let n = currentOptionsCleaned.length;
        let optionIndicesByLen = currentOptionsCleaned.map((txt, idx) => ({ idx, len: txt.length })).sort((a, b) => b.len - a.len);
        let allCombosByLength = {};
        for (let len = n; len >= 2; len--) allCombosByLength[len] = [];
        let maxMask = 1 << n;
        for (let mask = 1; mask < maxMask; mask++) {
            let comboTextArr = [];
            let comboIndices = [];
            for (let i = 0; i < n; i++) {
                if (mask & (1 << i)) {
                    comboTextArr.push(currentOptionsCleaned[i]);
                    comboIndices.push(i);
                }
            }
            if (comboIndices.length >= 2 && !knownWrongCombos.includes(getNormComboStr(comboTextArr))) {
                allCombosByLength[comboIndices.length].push(comboIndices);
            }
        }
        let chosenComboIndices = null;
        let chosenLevel = 0;
        for (let len = n; len >= 2; len--) {
            let validList = allCombosByLength[len];
            if (!validList || validList.length === 0) continue;
            validList.sort((a, b) => b.reduce((sum, idx) => sum + currentOptionsCleaned[idx].length, 0) - a.reduce((sum, idx) => sum + currentOptionsCleaned[idx].length, 0));
            let topCandidates = validList.slice(0, Math.max(1, Math.ceil(validList.length / 2)));
            chosenComboIndices = topCandidates[Math.floor(Math.random() * topCandidates.length)];
            chosenLevel = len;
            break;
        }
        if (!chosenComboIndices) {
            chosenComboIndices = [optionIndicesByLen[0].idx, optionIndicesByLen[1].idx];
            chosenLevel = 2;
        }
        const selection = await applyAnswerSelection(chosenComboIndices.map(idx => currentOptionsCleaned[idx]));
        if (!selection.success) {
            logMsg(currentLang === 'zh'
                ? `⚠️ [猜答失败] ${typeName} 第${qIndex}题最终仅保持 ${selection.selectedCount}/${selection.expectedCount} 项`
                : `⚠️ [Guess failed] ${typeLabel(typeName)} question ${qIndex}: retained ${selection.selectedCount}/${selection.expectedCount} options.`, 'warn');
            return false;
        }
        logMsg(currentLang === 'zh'
            ? `🔮 [策略猜答·${sourceZh}] ${typeName} 第${qIndex}题 -> 选择${chosenLevel}项，优先长选项${knownWrongCombos.length ? '并排除已知错误组合' : ''}`
            : `🔮 [Strategy guess · ${sourceEn}] ${typeLabel(typeName)} question ${qIndex}: selected ${chosenLevel} options, prioritizing longer options${knownWrongCombos.length ? ' and excluding known invalid combinations' : ''}.`, 'guess');
        return true;
    }
    return false;
}

document.getElementById('btn-auto-answer').onclick = async () => {
    if (!examNameInput.value.trim()) { alert(t('needName')); return; }

    const bodyText = document.body.innerText;
    let isReviewMode = false;
    if (bodyText.includes('答题用时') || bodyText.includes('Answer Time')) {
        isReviewMode = true;
    } else if (bodyText.includes('剩余时间') || bodyText.includes('Time Left')) {
        isReviewMode = false;
    } else {
        isReviewMode = (
            bodyText.includes('未通过') || bodyText.includes('已通过') || bodyText.includes('正确答案') ||
            bodyText.includes('No Pass') || bodyText.includes('Score：') || bodyText.includes('Score:') ||
            bodyText.includes('Correct answer') || bodyText.includes('Congratulations') || bodyText.includes('Wrong Question Feedback')
        );
    }

    if (isReviewMode) {
        alert(t('reviewModeBlocked'));
        logMsg(t('reviewModeLog'), 'warn');
        return;
    }

    isRunning = true;
    document.getElementById('btn-start').disabled = true;
    document.getElementById('btn-auto-answer').disabled = true;
    document.getElementById('btn-stop').disabled = false;
    examNameInput.disabled = true; setStatus('answering', '#8b5cf6');
    logMsg(currentLang === 'zh' ? `--- 🤖 自动答题开始，匹配题库 [${examNameInput.value.trim()}] ---` : `--- 🤖 Auto answer started using [${examNameInput.value.trim()}] ---`);
    if (scrapedData.length === 0) logMsg(t('cannotAnswerEmpty'), 'warn');

    const delay = parseInt(document.getElementById('scraper-delay').value) || 500;
    const initialSections = getQuestionSections();
    let answeredCount = 0; let missedCount = 0; let guessCount = 0;
    if (!initialSections.length) {
        logMsg(currentLang === 'zh' ? '⚠️ 未识别到题型导航区段，已停止以避免按错误题型答题。' : '⚠️ No question sections were detected. Stopped to avoid using the wrong answer strategy.', 'warn');
        isRunning = false;
    }

    for (let sectionIndex = 0; sectionIndex < initialSections.length && isRunning; sectionIndex++) {
        let qIndex = 1;
        let sectionType = initialSections[sectionIndex].typeName;
        logMsg(currentLang === 'zh'
            ? `[作答区段] 检索 ${sectionType || `第${sectionIndex + 1}区段（逐题识别）`}...`
            : `[Answer section] Searching ${sectionType ? typeLabel(sectionType) : `section ${sectionIndex + 1} (per-question detection)`}...`);

        while (isRunning) {
            const currentSection = getQuestionSections()[sectionIndex];
            let navLi = currentSection && currentSection.navItems[qIndex - 1];
            if (!navLi) {
                const completedType = sectionType || (currentLang === 'zh' ? `第${sectionIndex + 1}区段` : `section ${sectionIndex + 1}`);
                logMsg(currentLang === 'zh' ? `✅ ${completedType} 检索完毕` : `✅ ${sectionType ? typeLabel(sectionType) : completedType} search completed`);
                break;
            }

            const questionNumber = getQuestionNumber(navLi, qIndex);

            let navTarget = navLi.querySelector('a') || navLi.querySelector('span') || navLi;
            navTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
            navTarget.click();
            await sleep(delay);

            let titleEl = getEl(`//*[@id="app"]/div/div/div[1]/div/div[1]/div[2]/div[2]/div/div/div[2]/div[1]/div[1]/div/div/div`);
            let titleText = titleEl ? titleEl.innerText.trim() : "";

            if (!titleText) { logMsg(currentLang === 'zh' ? `⚠️ 第${questionNumber}题无法获取题目内容` : `⚠️ Could not read question ${questionNumber}`, 'warn'); qIndex++; continue; }

            let optionEls = getEls(`//*[@id="app"]/div/div/div[1]/div/div[1]/div[2]/div[2]/div/div/div[2]/div[1]/div[2]/div`);
            let currentOptionsCleaned = optionEls.map(opt => cleanOptionText(opt.innerText));
            const typeName = detectCurrentQuestionType(currentSection && currentSection.typeName || sectionType, titleEl, optionEls, currentOptionsCleaned);
            if (!sectionType) sectionType = typeName;
            if (currentSection && currentSection.typeName && currentSection.typeName !== typeName) {
                logMsg(currentLang === 'zh'
                    ? `🔎 [题型纠正] 第${questionNumber}题：区段标记为${currentSection.typeName}，页面识别为${typeName}`
                    : `🔎 [Type corrected] Question ${questionNumber}: section says ${typeLabel(currentSection.typeName)}, page detected ${typeLabel(typeName)}.`, 'warn');
            }
            let existingQ = findQuestionVariant(scrapedData, typeName, titleText, currentOptionsCleaned);
            if (!existingQ) {
                const legacyVariant = findQuestionVariantAcrossTypes(scrapedData, titleText, currentOptionsCleaned);
                const previousType = reclassifyQuestionVariant(legacyVariant, typeName, titleText, currentOptionsCleaned, questionNumber);
                if (previousType) {
                    existingQ = legacyVariant;
                    if ((typeName === '单选题' || typeName === '判断题') && (existingQ.正确答案 || []).length > 1) {
                        existingQ.正确答案 = [];
                    }
                    localStorage.setItem(getStorageKey(), JSON.stringify(scrapedData));
                    logMsg(currentLang === 'zh'
                        ? `🧹 [修复历史题型] 第${questionNumber}题：${previousType} -> ${typeName}`
                        : `🧹 [Question type repaired] Question ${questionNumber}: ${typeLabel(previousType)} -> ${typeLabel(typeName)}.`, 'warn');
                }
            }

            if (existingQ && existingQ.正确答案 && existingQ.正确答案.length > 0) {
                const answersOnPage = [];
                for (const answer of existingQ.正确答案) {
                    const normalizedAnswer = normalizeForCompare(answer);
                    const matchedOption = currentOptionsCleaned.find(option => {
                        const normalizedOption = normalizeForCompare(option);
                        if (normalizedAnswer === normalizedOption) return true;
                        if (trueEquivs.includes(normalizedAnswer) && trueEquivs.includes(normalizedOption)) return true;
                        if (falseEquivs.includes(normalizedAnswer) && falseEquivs.includes(normalizedOption)) return true;
                        return false;
                    });
                    if (matchedOption) answersOnPage.push(matchedOption);
                }

                const selection = await applyAnswerSelection(answersOnPage);
                const expectedCount = [...new Set(existingQ.正确答案.map(normalizeForCompare).filter(Boolean))].length;
                const isComplete = answersOnPage.length === expectedCount && selection.success && selection.expectedCount === expectedCount;
                if (isComplete) {
                    logMsg(currentLang === 'zh'
                        ? `✅ [题库答案] ${typeName} 第${questionNumber}题最终选中 ${selection.selectedCount}/${expectedCount} 项`
                        : `✅ [Bank answer] ${typeLabel(typeName)} question ${questionNumber}: finally selected ${selection.selectedCount}/${expectedCount}.`, 'success');
                    answeredCount++;
                } else {
                    logMsg(currentLang === 'zh'
                        ? `⚠️ [答案未保持] ${typeName} 第${questionNumber}题最终选中 ${selection.selectedCount}/${expectedCount} 项，不计为成功`
                        : `⚠️ [Answer not retained] ${typeLabel(typeName)} question ${questionNumber}: finally selected ${selection.selectedCount}/${expectedCount}; not counted as answered.`, 'warn');
                    missedCount++;
                }
            } else {
                let guessed = await guessByType(typeName, questionNumber, optionEls, currentOptionsCleaned, existingQ);
                if (guessed) guessCount++; else missedCount++;
            }
            qIndex++;
        }
    }

    isRunning = false; document.getElementById('btn-start').disabled = false; document.getElementById('btn-auto-answer').disabled = false; document.getElementById('btn-stop').disabled = true; examNameInput.disabled = false; setStatus('stopped', '#ef4444');
    logMsg(currentLang === 'zh' ? `--- 🏁 答题结束 (确实答对: ${answeredCount}, 技巧蒙猜: ${guessCount}, 跳过: ${missedCount}) ---` : `--- 🏁 Answering finished (matched: ${answeredCount}, guessed: ${guessCount}, skipped: ${missedCount}) ---`, 'info');
};

document.getElementById('btn-stop').onclick = () => { isRunning = false; logMsg(t('forceStop')); };
document.getElementById('btn-clear').onclick = () => { if(confirm(t('clearConfirm', examNameInput.value.trim()))) { localStorage.removeItem(getStorageKey()); loadLocalData(); refreshExamList(); logEl.innerHTML = ''; logMsg(t('cleared')); } };
const typeToEnglish = type => ({ '判断题': 'True/False', '单选题': 'Single Choice', '多选题': 'Multiple Choice' }[type] || type);
const typeToChinese = type => {
    const normalized = String(type || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
    const map = {
        '判断题': '判断题', 'true/false': '判断题', 'truefalse': '判断题', 'boolean': '判断题',
        '单选题': '单选题', 'singlechoice': '单选题', 'single': '单选题',
        '多选题': '多选题', 'multiplechoice': '多选题', 'multiple': '多选题', 'multichoice': '多选题'
    };
    return map[normalized] || '单选题';
};
const exportQuestionBank = () => currentLang === 'zh' ? scrapedData : scrapedData.map(q => ({
    id: q.id,
    variantKey: q.variantKey,
    questionType: typeToEnglish(q.题型),
    questionNumber: q.题号,
    question: q.题目,
    options: q.选项,
    occurrenceCount: q.出现次数,
    correctAnswers: q.正确答案,
    wrongAnswers: q.错误答案,
    definiteWrongAnswers: q.明确错误答案,
    wrongCombinations: q.错误组合
}));
document.getElementById('btn-export').onclick = () => {
    if (scrapedData.length === 0) { alert(t('noData')); return; }
    let dataStr = JSON.stringify(exportQuestionBank(), null, 2);
    let blob = new Blob([dataStr], { type: 'application/json' });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = `${examNameInput.value.trim()}_${currentLang === 'zh' ? '题库' : 'question_bank'}.json`;
    a.click();
    URL.revokeObjectURL(url);
};
const importFileInput = document.getElementById('scraper-import-file');
document.getElementById('btn-import').onclick = () => {
    if (!examNameInput.value.trim()) { alert(t('needName')); return; }
    importFileInput.value = '';
    importFileInput.click();
};
importFileInput.onchange = async () => {
    const file = importFileInput.files && importFileInput.files[0];
    if (!file) return;
    try {
        const imported = JSON.parse(await file.text());
        if (!Array.isArray(imported) || !imported.every(q => {
            if (!q || typeof q !== 'object') return false;
            const question = q.题目 ?? q.question;
            const options = q.选项 ?? q.options;
            return typeof question === 'string' && Array.isArray(options);
        })) {
            throw new Error('Invalid question-bank structure');
        }
        if (!confirm(t('importConfirm', examNameInput.value.trim()))) return;

        const normalized = imported.map(q => {
            const questionNumber = q.题号 ?? q.questionNumber;
            const occurrenceCount = q.出现次数 ?? q.occurrenceCount;
            const options = q.选项 ?? q.options;
            const correctAnswers = q.正确答案 ?? q.correctAnswers;
            const wrongAnswers = q.错误答案 ?? q.wrongAnswers;
            const definiteWrongAnswers = q.明确错误答案 ?? q.definiteWrongAnswers;
            const wrongCombinations = q.错误组合 ?? q.wrongCombinations;
            const questionType = typeToChinese(q.题型 ?? q.questionType ?? q.type);
            const questionText = String(q.题目 ?? q.question).trim();
            const normalizedOptions = options.map(v => String(v));
            return {
                id: q.id || generateQID(),
                variantKey: getQuestionVariantKey(questionType, questionText, normalizedOptions),
                题型: questionType,
                题号: Number.isFinite(Number(questionNumber)) ? Number(questionNumber) : 0,
                题目: questionText,
                选项: normalizedOptions,
                出现次数: Number.isFinite(Number(occurrenceCount)) ? Number(occurrenceCount) : 1,
                正确答案: Array.isArray(correctAnswers) ? correctAnswers.map(v => String(v)) : [],
                错误答案: Array.isArray(wrongAnswers) ? wrongAnswers.map(v => String(v)) : [],
                明确错误答案: Array.isArray(definiteWrongAnswers) ? definiteWrongAnswers.map(v => String(v)) : [],
                错误组合: Array.isArray(wrongCombinations) ? wrongCombinations.filter(Array.isArray).map(arr => arr.map(v => String(v))) : []
            };
        });
        localStorage.setItem(getStorageKey(), JSON.stringify(normalized));
        loadLocalData();
        refreshExamList();
        logMsg(t('importSuccess', normalized.length), 'success');
        alert(t('importSuccess', normalized.length));
    } catch (error) {
        console.warn('[Exam Scraper] Import failed:', error);
        alert(t('importInvalid'));
        logMsg(t('importInvalid'), 'warn');
    }
};
})();
