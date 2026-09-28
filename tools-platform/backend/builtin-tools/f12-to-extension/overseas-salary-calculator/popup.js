// 驻外薪资换汇计算器 - Popup 交互逻辑 (支持中英双语切换 · 离线安全 · 状态持久化)
(function () {
  'use strict';

  // 多语言词典
  const I18N = {
    zh: {
      appTitle: '驻外薪资换汇计算器',
      appSubtitle: '基准：USD发薪 → EGP到手 → 换回CNY 的最终得失',
      refreshTitle: '刷新今日实时官方汇率',
      openTabTitle: '在新标签页全屏打开',
      switchLangTitle: 'Switch to English / 切换为英文',
      langBtnText: 'EN',
      rateUsdEgpTitle: '今日实时官方汇率 (USD/EGP)',
      rateUsdCnyTitle: '今日实时官方汇率 (USD/CNY)',
      syncFetching: '正在获取最新官方汇率…',
      syncConnecting: '正在连接国际汇率接口…',
      syncOfflineFallback: '离线模式：使用基准参考汇率（支持自定义）',
      syncOfflineWarning: '⚠️ 当前网络受限，正在使用基准离线汇率',
      syncSuccess: (date) => `实时数据来源：${date} 官方收盘牌价`,
      syncRefreshSuccess: (date) => `✅ 官方实时汇率已更新 (${date})`,
      syncFail: '未能获取汇率，请检查网络',
      syncRefreshFail: '❌ 汇率刷新失败，请检查网络连接',
      todaySuffix: ' (今日)',
      panelCompanyTitle: '公司发薪设定 (USD → EGP)',
      labelSalaryUsd: '固定美元工资总额 (USD)',
      labelBuyDate: '公司结算日 (决定折算汇率)',
      loadingDates: '正在加载日期...',
      labelBuyRateEgp: '当日公司结汇 (USD/EGP):',
      labelBuyRateCny: '当日基准汇率 (USD/CNY):',
      labelReceivedEgp: '公司实际发给你的 EGP:',
      panelUserTitle: '自己换回设定 (EGP → CNY)',
      labelSellEgp: '本次准备换回的 EGP 金额',
      btnMax: '全额换回',
      btnMaxTitle: '点击填入全部到手埃镑',
      placeholderSellEgp: '输入换回金额',
      labelSellRate: '实际成交汇率 (1 CNY = ? EGP)',
      placeholderSellRate: '例如 7.20',
      hintSellRate: '提示：填入实际成交价。例如 7.20 (代表 7.2 EGP 换 1 人民币)',
      resultTitle: '换回人民币 (CNY) 最终得失核算',
      labelOriginalCny: '发薪当日基准价值 (CNY)',
      tooltipOriginalCny: '发薪当日，这部分EGP对应的USD直接换CNY的价值',
      labelFinalCny: '现在实际换到手 (CNY)',
      labelProfitCny: '相比发薪日基准盈亏：',
      badgeGain: '赚回汇差',
      badgeLoss: '汇兑损失',
      badgeNeutral: '无亏无赚',
      footerSource: '数据来源: jsDelivr CDN / fawazahmed0 Currency API',
      footerNotice: '汇率仅供参考，计算结果取决于输入准确性'
    },
    en: {
      appTitle: 'Overseas Salary Calculator',
      appSubtitle: 'Benchmark: USD Salary → EGP Payout → Convert to CNY',
      refreshTitle: 'Refresh today\'s official exchange rates',
      openTabTitle: 'Open full page in new tab',
      switchLangTitle: '切换为中文 / Switch to Chinese',
      langBtnText: '中',
      rateUsdEgpTitle: 'Today\'s Official FX (USD/EGP)',
      rateUsdCnyTitle: 'Today\'s Official FX (USD/CNY)',
      syncFetching: 'Fetching latest official rates…',
      syncConnecting: 'Connecting to FX rate service…',
      syncOfflineFallback: 'Offline mode: using baseline rates',
      syncOfflineWarning: '⚠️ Network restricted, using cached/offline rates',
      syncSuccess: (date) => `Live source: ${date} official close rates`,
      syncRefreshSuccess: (date) => `✅ Official FX rates updated (${date})`,
      syncFail: 'Failed to fetch rates, please check network',
      syncRefreshFail: '❌ Refresh failed, please check network',
      todaySuffix: ' (Today)',
      panelCompanyTitle: 'Company Payroll (USD → EGP)',
      labelSalaryUsd: 'Base USD Salary (USD)',
      labelBuyDate: 'Settlement Date (Fixes Rate)',
      loadingDates: 'Loading dates...',
      labelBuyRateEgp: 'Company FX (USD/EGP):',
      labelBuyRateCny: 'Benchmark FX (USD/CNY):',
      labelReceivedEgp: 'Actual EGP Paid to You:',
      panelUserTitle: 'Personal Conversion (EGP → CNY)',
      labelSellEgp: 'EGP Amount to Convert Back',
      btnMax: 'Max All',
      btnMaxTitle: 'Click to fill all received EGP',
      placeholderSellEgp: 'Amount to convert',
      labelSellRate: 'Actual Traded Rate (1 CNY = ? EGP)',
      placeholderSellRate: 'e.g. 7.20',
      hintSellRate: 'Hint: Enter actual rate, e.g. 7.20 (7.2 EGP per 1 CNY)',
      resultTitle: 'Final CNY Settlement & Gain/Loss Audit',
      labelOriginalCny: 'Payday Benchmark (CNY)',
      tooltipOriginalCny: 'Payday value of this EGP converted from USD to CNY',
      labelFinalCny: 'Actual CNY Received (CNY)',
      labelProfitCny: 'Net Gain / Loss vs Payday:',
      badgeGain: 'FX Gain',
      badgeLoss: 'FX Loss',
      badgeNeutral: 'Break-even',
      footerSource: 'Source: jsDelivr CDN / fawazahmed0 Currency API',
      footerNotice: 'For reference only; results depend on input accuracy'
    }
  };

  // 当前激活语言 (默认 zh)
  let currentLanguage = 'zh';

  // 内存汇率缓存
  const rateCache = new Map();
  let currentCompanyRates = { egp: 0, cny: 0 };
  let lastCalculatedReceivedEgp = 0;
  let isRateFetching = false;
  let allDateStrings = [];

  // DOM 元素引用
  const elSalaryUsd = document.getElementById('salary-usd');
  const elBuyDate = document.getElementById('buy-date');
  const elBuyRateEgp = document.getElementById('buy-rate-egp');
  const elBuyRateCny = document.getElementById('buy-rate-cny');
  const elReceivedEgp = document.getElementById('received-egp');

  const elSellEgp = document.getElementById('sell-egp');
  const elSellRate = document.getElementById('sell-rate');
  const btnMax = document.getElementById('btn-max');

  const elOriginalCny = document.getElementById('original-cny');
  const elFinalCny = document.getElementById('final-cny');
  const elProfitCny = document.getElementById('profit-cny');
  const elProfitLabel = document.getElementById('profit-label');

  const elLiveUsdEgp = document.getElementById('live-usd-egp');
  const elLiveUsdCny = document.getElementById('live-usd-cny');
  const elRateSyncStatus = document.getElementById('rate-sync-status');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnOpenTab = document.getElementById('btn-open-tab');
  const btnLang = document.getElementById('btn-lang');

  // 工具函数
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const formatMoney = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '--';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  // 存储适配层 (优先 chrome.storage.local，降级 localStorage)
  const storage = {
    async get(keys) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
      }
      const result = {};
      const keyList = Array.isArray(keys) ? keys : [keys];
      keyList.forEach(k => {
        try {
          const val = localStorage.getItem('salary_calc_' + k);
          if (val !== null) result[k] = JSON.parse(val);
        } catch (_) {}
      });
      return result;
    },
    async set(items) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return new Promise((resolve) => chrome.storage.local.set(items, resolve));
      }
      try {
        Object.entries(items).forEach(([k, v]) => {
          localStorage.setItem('salary_calc_' + k, JSON.stringify(v));
        });
      } catch (_) {}
    }
  };

  function generateDates() {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 45; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dates.push(formatDate(d));
    }
    return dates;
  }

  function applyLanguage(lang) {
    currentLanguage = lang === 'en' ? 'en' : 'zh';
    document.documentElement.lang = currentLanguage === 'zh' ? 'zh-CN' : 'en';
    const dict = I18N[currentLanguage];

    // 更新文本元素
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key] && typeof dict[key] === 'string') {
        el.textContent = dict[key];
      }
    });

    // 更新标题 (title)
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (dict[key] && typeof dict[key] === 'string') {
        el.setAttribute('title', dict[key]);
      }
    });

    // 更新占位符 (placeholder)
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (dict[key] && typeof dict[key] === 'string') {
        el.setAttribute('placeholder', dict[key]);
      }
    });

    // 更新切换按钮自身显示
    if (btnLang) {
      btnLang.textContent = dict.langBtnText;
      btnLang.setAttribute('title', dict.switchLangTitle);
    }

    // 更新日期选择框文字
    if (allDateStrings.length > 0 && elBuyDate) {
      const currentSelected = elBuyDate.value;
      Array.from(elBuyDate.options).forEach((opt, idx) => {
        if (idx === 0) {
          opt.textContent = `${allDateStrings[0]}${dict.todaySuffix}`;
        } else {
          opt.textContent = allDateStrings[idx];
        }
      });
      if (currentSelected) elBuyDate.value = currentSelected;
    }

    // 重新渲染当前盈亏徽章文本
    calculateProfit();
  }

  // 获取特定日期的官方汇率（支持超时与多源备用降级）
  async function fetchRatesForDate(dateStr, forceRefresh = false) {
    if (!forceRefresh && rateCache.has(dateStr)) {
      return rateCache.get(dateStr);
    }

    const todayStr = formatDate(new Date());
    const isToday = dateStr === todayStr;
    const endpointDate = isToday ? 'latest' : dateStr;

    const urls = [
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${endpointDate}/v1/currencies/usd.json`,
      `https://latest.currency-api.pages.dev/v1/currencies/usd.json`
    ];

    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4500);

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!res.ok) continue;
        const data = await res.json();
        if (data && data.usd && data.usd.egp && data.usd.cny) {
          const rates = {
            egp: Number(data.usd.egp),
            cny: Number(data.usd.cny),
            date: data.date || dateStr
          };
          rateCache.set(dateStr, rates);
          return rates;
        }
      } catch (err) {
        console.warn(`[汇率抓取] 请求 ${url} 失败:`, err.message);
      }
    }

    // 若网络不可达，尝试从历史本地存储读取上一次保存的今日汇率
    const stored = await storage.get(['lastKnownRates']);
    if (stored.lastKnownRates && stored.lastKnownRates.egp && stored.lastKnownRates.cny) {
      rateCache.set(dateStr, stored.lastKnownRates);
      return stored.lastKnownRates;
    }

    // 保底参考汇率（防止首次离线完全无法测试）
    const fallbackRates = { egp: 51.7830, cny: 6.7152, date: dateStr, fallback: true };
    rateCache.set(dateStr, fallbackRates);
    return fallbackRates;
  }

  async function updateCompanyRateDisplay(rates) {
    currentCompanyRates = rates;
    elBuyRateEgp.textContent = rates.egp.toFixed(4);
    elBuyRateCny.textContent = rates.cny.toFixed(4);
    updateReceivedEgp();
  }

  function updateReceivedEgp() {
    const salaryUsd = parseFloat(elSalaryUsd.value) || 0;
    lastCalculatedReceivedEgp = salaryUsd * (currentCompanyRates.egp || 0);
    elReceivedEgp.textContent = formatMoney(lastCalculatedReceivedEgp);
  }

  function calculateProfit() {
    const dict = I18N[currentLanguage] || I18N.zh;
    const sellEgp = parseFloat(elSellEgp.value) || 0;
    const sellRate = parseFloat(elSellRate.value) || 0; // 1 CNY = ? EGP

    if (sellEgp === 0 || !currentCompanyRates.egp || sellRate === 0) {
      elOriginalCny.textContent = '--';
      elFinalCny.textContent = '--';
      elProfitCny.textContent = '--';
      elProfitCny.className = 'profit-val font-mono profit-val-neutral';
      elProfitLabel.className = 'profit-badge hidden';
      return;
    }

    // 1. 发薪当日基准价值 (CNY)
    const equivalentUsd = sellEgp / currentCompanyRates.egp;
    const originalCny = equivalentUsd * currentCompanyRates.cny;

    // 2. 现在实际换到手 (CNY)
    const finalCny = sellEgp / sellRate;

    // 3. 计算盈亏
    const profit = finalCny - originalCny;

    elOriginalCny.textContent = `¥ ${formatMoney(originalCny)}`;
    elFinalCny.textContent = `¥ ${formatMoney(finalCny)}`;

    const prefix = profit > 0 ? '+' : '';
    elProfitCny.textContent = `${prefix}${formatMoney(profit)}`;

    elProfitLabel.classList.remove('hidden');
    if (profit > 0.005) {
      elProfitCny.className = 'profit-val font-mono profit-val-positive';
      elProfitLabel.textContent = dict.badgeGain;
      elProfitLabel.className = 'profit-badge badge-positive';
    } else if (profit < -0.005) {
      elProfitCny.className = 'profit-val font-mono profit-val-negative';
      elProfitLabel.textContent = dict.badgeLoss;
      elProfitLabel.className = 'profit-badge badge-negative';
    } else {
      elProfitCny.className = 'profit-val font-mono profit-val-neutral';
      elProfitLabel.textContent = dict.badgeNeutral;
      elProfitLabel.className = 'profit-badge badge-neutral';
    }

    // 保存用户的输入状态
    persistUserInput();
  }

  function persistUserInput() {
    storage.set({
      userSalaryUsd: elSalaryUsd.value,
      userBuyDate: elBuyDate.value,
      userSellEgp: elSellEgp.value,
      userSellRate: elSellRate.value,
      preferredLang: currentLanguage
    });
  }

  async function handleDateChange() {
    const dateStr = elBuyDate.value;
    elBuyRateEgp.textContent = '...';
    elBuyRateCny.textContent = '...';
    const rates = await fetchRatesForDate(dateStr);
    if (rates) {
      await updateCompanyRateDisplay(rates);
      calculateProfit();
    } else {
      elBuyRateEgp.textContent = currentLanguage === 'en' ? 'Error' : '读取失败';
      elBuyRateCny.textContent = currentLanguage === 'en' ? 'Error' : '读取失败';
    }
  }

  function handleSalaryChange() {
    updateReceivedEgp();
    calculateProfit();
  }

  function handleMaxClick() {
    elSellEgp.value = lastCalculatedReceivedEgp.toFixed(2);
    calculateProfit();
  }

  async function handleRefreshClick() {
    if (isRateFetching) return;
    const dict = I18N[currentLanguage] || I18N.zh;
    isRateFetching = true;
    btnRefresh.classList.add('animate-pulse');
    elRateSyncStatus.textContent = dict.syncFetching;

    const todayStr = formatDate(new Date());
    rateCache.delete(todayStr);

    const latestRates = await fetchRatesForDate(todayStr, true);
    if (latestRates) {
      elLiveUsdEgp.textContent = latestRates.egp.toFixed(4);
      elLiveUsdCny.textContent = latestRates.cny.toFixed(4);

      if (latestRates.fallback) {
        elRateSyncStatus.textContent = dict.syncOfflineWarning;
      } else {
        elRateSyncStatus.textContent = dict.syncRefreshSuccess(latestRates.date || todayStr);
        storage.set({ lastKnownRates: latestRates });
      }

      if (elBuyDate.value === todayStr) {
        await updateCompanyRateDisplay(latestRates);
        calculateProfit();
      }
    } else {
      elRateSyncStatus.textContent = dict.syncRefreshFail;
    }

    btnRefresh.classList.remove('animate-pulse');
    isRateFetching = false;
  }

  function handleOpenTabClick() {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
    } else {
      window.open(window.location.href, '_blank');
    }
  }

  function handleLangToggle() {
    const nextLang = currentLanguage === 'zh' ? 'en' : 'zh';
    applyLanguage(nextLang);
    storage.set({ preferredLang: nextLang });
  }

  async function init() {
    allDateStrings = generateDates();

    // 填充日期下拉菜单
    elBuyDate.innerHTML = '';
    const initialDict = I18N[currentLanguage];
    allDateStrings.forEach((date, idx) => {
      const option = document.createElement('option');
      option.value = date;
      option.textContent = idx === 0 ? `${date}${initialDict.todaySuffix}` : date;
      elBuyDate.appendChild(option);
    });

    // 读取已持久化的用户历史输入及语言偏好
    const saved = await storage.get(['userSalaryUsd', 'userBuyDate', 'userSellEgp', 'userSellRate', 'lastKnownRates', 'preferredLang']);

    if (saved.preferredLang && (saved.preferredLang === 'en' || saved.preferredLang === 'zh')) {
      applyLanguage(saved.preferredLang);
    } else {
      applyLanguage('zh');
    }

    const dict = I18N[currentLanguage] || I18N.zh;

    if (saved.userSalaryUsd) elSalaryUsd.value = saved.userSalaryUsd;
    if (saved.userBuyDate && allDateStrings.includes(saved.userBuyDate)) elBuyDate.value = saved.userBuyDate;

    // 获取今日实时汇率
    elRateSyncStatus.textContent = dict.syncConnecting;
    const latestRates = await fetchRatesForDate(allDateStrings[0]);

    if (latestRates) {
      elLiveUsdEgp.textContent = latestRates.egp.toFixed(4);
      elLiveUsdEgp.classList.remove('animate-pulse');
      elLiveUsdCny.textContent = latestRates.cny.toFixed(4);
      elLiveUsdCny.classList.remove('animate-pulse');

      if (latestRates.fallback) {
        elRateSyncStatus.textContent = dict.syncOfflineFallback;
      } else {
        elRateSyncStatus.textContent = dict.syncSuccess(latestRates.date || allDateStrings[0]);
        storage.set({ lastKnownRates: latestRates });
      }

      // 如果用户没有保存过成交汇率，自动用今日官方估算 (EGP/CNY) 初始化
      if (saved.userSellRate) {
        elSellRate.value = saved.userSellRate;
      } else {
        const estimatedCnyEgp = latestRates.egp / latestRates.cny;
        elSellRate.value = estimatedCnyEgp.toFixed(4);
      }

      // 选定结算日期的汇率
      const selectedDate = elBuyDate.value || allDateStrings[0];
      const selectedRates = selectedDate === allDateStrings[0] ? latestRates : await fetchRatesForDate(selectedDate);
      await updateCompanyRateDisplay(selectedRates || latestRates);

      if (saved.userSellEgp) {
        elSellEgp.value = saved.userSellEgp;
      } else {
        elSellEgp.value = lastCalculatedReceivedEgp.toFixed(2);
      }

      calculateProfit();
    } else {
      elRateSyncStatus.textContent = dict.syncFail;
    }

    // 绑定事件监听
    elBuyDate.addEventListener('change', handleDateChange);
    elSalaryUsd.addEventListener('input', handleSalaryChange);
    btnMax.addEventListener('click', handleMaxClick);
    elSellEgp.addEventListener('input', calculateProfit);
    elSellRate.addEventListener('input', calculateProfit);
    btnRefresh.addEventListener('click', handleRefreshClick);
    btnOpenTab.addEventListener('click', handleOpenTabClick);
    if (btnLang) btnLang.addEventListener('click', handleLangToggle);
  }

  // 启动初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
