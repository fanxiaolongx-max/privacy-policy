(function () {
  'use strict';

  const core = window.SupplierQuoteCore;
  const palette = [
    { dark: '#175CD3', light: '#EAF2FF' },
    { dark: '#7A5AF8', light: '#F1EDFF' },
    { dark: '#B54708', light: '#FFF3E0' },
    { dark: '#067647', light: '#E9F8EF' },
    { dark: '#C11574', light: '#FCE7F3' },
    { dark: '#475467', light: '#EEF2F6' }
  ];
  const state = { fileName: '', configs: [], suppliers: [], rows: [] };
  const $ = selector => document.querySelector(selector);
  const elements = {
    input: $('#fileInput'), drop: $('#dropZone'), status: $('#status'), config: $('#configCard'), result: $('#resultCard'),
    sheets: $('#sheetList'), preview: $('#preview'), summary: $('#summary'), tax: $('#taxRate'), threshold: $('#matchThreshold'), exportName: $('#exportName')
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }

  function showStatus(message, type) {
    elements.status.textContent = message;
    elements.status.className = `status show ${type || ''}`;
  }

  function sheetToMatrix(workbook, sheetName) {
    return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: '', blankrows: false });
  }

  async function readFile(file) {
    if (!window.XLSX) throw new Error('Excel 组件未加载，请刷新页面后重试');
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array', cellDates: true, dense: true });
    if (!workbook.SheetNames.length) throw new Error('文件中没有可读取的工作表');
    loadSheets(workbook.SheetNames.map(name => ({ name, matrix: sheetToMatrix(workbook, name) })), file.name);
  }

  function loadSheets(sheets, fileName) {
    state.fileName = fileName;
    state.configs = core.analyzeSheets(sheets);
    state.rows = [];
    renderSheetConfig();
    elements.config.classList.remove('hidden');
    elements.result.classList.add('hidden');
    const base = state.configs.find(item => item.role === 'base');
    const supplierCount = state.configs.filter(item => item.role === 'supplier').length;
    showStatus(`已读取 ${state.configs.length} 个工作表；基础表：${base ? base.name : '未识别'}；报价表：${supplierCount} 个`, 'success');
    elements.config.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function columnOptions(config, selected) {
    const row = config.matrix[config.headerRow] || [];
    const options = ['<option value="">不使用</option>'];
    row.forEach((value, index) => {
      const label = core.text(value) || `第 ${index + 1} 列`;
      options.push(`<option value="${index}"${Number(selected) === index ? ' selected' : ''}>${escapeHtml(label)}</option>`);
    });
    return options.join('');
  }

  function fieldControl(config, index, field, label, className) {
    return `<div class="field ${className || ''}"><label>${label}</label><select data-sheet-index="${index}" data-column-field="${field}">${columnOptions(config, config.columns[field])}</select></div>`;
  }

  function renderSheetConfig() {
    elements.sheets.innerHTML = state.configs.map((config, index) => `
      <div class="sheet-card" data-config-index="${index}" data-role="${config.role}">
        <div class="sheet-head">
          <div><strong>${escapeHtml(config.name)}</strong><div class="small">自动识别 ${Object.keys(config.columns).length} 个字段</div></div>
          <div class="field"><label>用途</label><select data-sheet-index="${index}" data-prop="role"><option value="base"${config.role === 'base' ? ' selected' : ''}>基础需求表</option><option value="supplier"${config.role === 'supplier' ? ' selected' : ''}>供应商报价</option><option value="ignore"${config.role === 'ignore' ? ' selected' : ''}>忽略</option></select></div>
          <div class="field supplier-only"><label>供应商名称</label><input data-sheet-index="${index}" data-prop="supplier" value="${escapeHtml(config.supplier)}"></div>
          <div class="field"><label>表头行</label><input data-sheet-index="${index}" data-prop="headerRow" type="number" min="1" max="${Math.max(1, config.matrix.length)}" value="${config.headerRow + 1}"></div>
          <div class="field supplier-only"><label>报价含税方式</label><select data-sheet-index="${index}" data-prop="taxMode"><option value="auto"${config.taxMode === 'auto' ? ' selected' : ''}>逐行自动判断</option><option value="exclusive"${config.taxMode === 'exclusive' ? ' selected' : ''}>全部是税前价</option><option value="inclusive"${config.taxMode === 'inclusive' ? ' selected' : ''}>全部是含税价</option></select></div>
        </div>
        <div class="sheet-map">
          ${fieldControl(config, index, 'item', '商品名称')}
          ${fieldControl(config, index, 'baseSupplier', '基础表供应商', 'base-only')}
          ${fieldControl(config, index, 'category', '类别')}
          ${fieldControl(config, index, 'quantity', '采购量')}
          ${fieldControl(config, index, 'unit', '单位')}
          ${fieldControl(config, index, 'price', '税前/原报价', 'supplier-only')}
          ${fieldControl(config, index, 'taxPrice', '税后/结算价', 'supplier-only')}
          ${fieldControl(config, index, 'spec', '规格', 'supplier-only')}
          ${fieldControl(config, index, 'remark', '备注', 'supplier-only')}
          ${fieldControl(config, index, 'taxFlag', '是否加税', 'supplier-only')}
          ${fieldControl(config, index, 'stock', '库存状态', 'supplier-only')}
        </div>
      </div>`).join('');
  }

  function syncConfigFromControls() {
    elements.sheets.querySelectorAll('[data-sheet-index]').forEach(control => {
      const config = state.configs[Number(control.dataset.sheetIndex)];
      if (!config) return;
      if (control.dataset.columnField) {
        if (control.value === '') delete config.columns[control.dataset.columnField];
        else config.columns[control.dataset.columnField] = Number(control.value);
      } else if (control.dataset.prop === 'headerRow') config.headerRow = Math.max(0, Number(control.value || 1) - 1);
      else config[control.dataset.prop] = control.value;
    });
  }

  function validateConfig() {
    const bases = state.configs.filter(config => config.role === 'base');
    if (bases.length !== 1) throw new Error('请且只能选择一个基础需求表');
    if (bases[0].columns.item === undefined) throw new Error('基础表必须指定“商品名称”列');
    const suppliers = state.configs.filter(config => config.role === 'supplier');
    if (!suppliers.length) throw new Error('至少需要一个供应商报价表');
    suppliers.forEach(config => {
      if (!config.supplier.trim()) throw new Error(`请填写工作表“${config.name}”的供应商名称`);
      if (config.columns.item === undefined) throw new Error(`工作表“${config.name}”未指定商品名称列`);
      if (config.columns.price === undefined && config.columns.taxPrice === undefined) throw new Error(`工作表“${config.name}”未指定报价列`);
    });
  }

  function generateComparison() {
    syncConfigFromControls();
    validateConfig();
    const baseConfig = state.configs.find(config => config.role === 'base');
    const baseRows = core.recordsFromSheet(baseConfig);
    if (!baseRows.length) throw new Error('基础需求表中没有识别到商品行');
    state.suppliers = core.groupSuppliers(state.configs);
    const threshold = Number(elements.threshold.value || 0.58);
    const taxRate = Number(elements.tax.value || 14);
    state.rows = baseRows.map(base => {
      const quotes = state.suppliers.map(group => {
        const candidates = core.rankedMatches(base, group.records, 10);
        const selected = candidates[0] && candidates[0].score >= threshold ? candidates[0].record : null;
        return { supplier: group.name, candidates, selectedId: selected ? selected.id : '' };
      });
      const row = { base, quotes, recommendation: { supplier: '', reason: '' } };
      row.recommendation = calculateRecommendation(row, taxRate);
      return row;
    });
    renderResults();
    elements.result.classList.remove('hidden');
    elements.result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function selectedRecord(quote) {
    const candidate = quote.candidates.find(item => item.record.id === quote.selectedId);
    return candidate ? candidate.record : null;
  }

  function calculateRecommendation(row, taxRate) {
    return core.recommendation(row.base, row.quotes.map(quote => ({ record: selectedRecord(quote) })), taxRate);
  }

  function formatMoney(value) { return value === null || value === undefined ? '—' : Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function basisLabel(value) { return value === 'kg' ? '公斤' : value === 'l' ? '升' : value || '单位'; }

  function quoteCell(rowIndex, quote, supplierIndex) {
    const record = selectedRecord(quote);
    const chosen = quote.candidates.find(candidate => candidate.record.id === quote.selectedId);
    const details = record ? core.quoteDetails(record, Number(elements.tax.value || 14)) : null;
    const options = [`<option value="">未找到 / 不采用</option>`].concat(quote.candidates.map(candidate => `<option value="${escapeHtml(candidate.record.id)}"${candidate.record.id === quote.selectedId ? ' selected' : ''}>${escapeHtml(candidate.record.item)} (${Math.round(candidate.score * 100)}%)</option>`));
    const bg = palette[supplierIndex % palette.length].light;
    const quoteValue = details && details.finalPrice !== null ? formatMoney(details.finalPrice) : '—';
    const rawHint = record && core.text(record.priceRaw) && String(record.priceRaw) !== String(details.finalPrice) ? `原报价：${core.text(record.priceRaw)}` : '';
    const unitSpec = record ? [record.unit, record.spec || (details.measure && details.measure.raw)].filter(Boolean).join(' / ') : '—';
    const normalized = details && details.normalizedPrice !== null ? `${formatMoney(details.normalizedPrice)} / ${basisLabel(details.basis)}` : '—';
    const notes = record ? [record.remark, record.stock, details.taxApplied ? '已按税率加税' : '', details.unavailable ? '无货' : ''].filter(Boolean).join('；') : '—';
    return `
      <td style="background:${bg}"><select data-row="${rowIndex}" data-supplier="${supplierIndex}" data-action="match">${options.join('')}</select><div class="quote-value">${quoteValue}</div><div class="small">${escapeHtml(rawHint)}</div>${chosen && chosen.score < .7 ? '<span class="badge warn">低置信度</span>' : chosen ? '<span class="badge good">已匹配</span>' : ''}</td>
      <td style="background:${bg}">${escapeHtml(unitSpec || '—')}</td>
      <td style="background:${bg}" class="${normalized === '—' ? 'warn' : ''}">${escapeHtml(normalized)}</td>
      <td style="background:${bg}" class="small">${escapeHtml(notes || '—')}</td>`;
  }

  function renderResults() {
    const headerGroups = state.suppliers.map((group, index) => `<th colspan="4" style="background:${palette[index % palette.length].dark};color:#fff">${escapeHtml(group.name)}<div class="small" style="color:rgba(255,255,255,.82)">${escapeHtml(group.sheets.join(' + '))}</div></th>`).join('');
    const headerFields = state.suppliers.map((group, index) => {
      const color = palette[index % palette.length].light;
      return `<th style="background:${color}">含税报价</th><th style="background:${color}">单位 / 规格</th><th style="background:${color}">折算单价</th><th style="background:${color}">备注</th>`;
    }).join('');
    const body = state.rows.map((row, rowIndex) => {
      const supplierCells = row.quotes.map((quote, supplierIndex) => quoteCell(rowIndex, quote, supplierIndex)).join('');
      const supplierOptions = ['<option value="">待人工确认</option>'].concat(state.suppliers.map(group => `<option value="${escapeHtml(group.name)}"${group.name === row.recommendation.supplier ? ' selected' : ''}>${escapeHtml(group.name)}</option>`));
      const comparison = core.compareSupplier(row.base.baseSupplier, row.recommendation.supplier);
      return `<tr><td>${rowIndex + 1}</td><td>${escapeHtml(row.base.category || '—')}</td><td><strong>${escapeHtml(row.base.item)}</strong></td><td>${escapeHtml([row.base.quantity, row.base.unit].filter(value => value !== null && value !== '').join(' ') || '—')}</td><td>${escapeHtml(row.base.baseSupplier || '—')}</td>${supplierCells}<td style="background:#ecfdf3"><select data-row="${rowIndex}" data-action="recommend">${supplierOptions.join('')}</select></td><td style="background:#ecfdf3"><span class="compare-status ${comparison.code}">${escapeHtml(comparison.label)}</span></td><td style="background:#f0fdf4"><input class="reason" data-row="${rowIndex}" data-action="reason" value="${escapeHtml(row.recommendation.reason)}"></td></tr>`;
    }).join('');
    elements.preview.innerHTML = `<table class="compare"><thead><tr><th colspan="5" style="background:#1f4e78;color:#fff">基础需求</th>${headerGroups}<th colspan="3" style="background:#067647;color:#fff">推荐结果</th></tr><tr><th>序号</th><th>类别</th><th>商品</th><th>需求量</th><th>基础表供应商</th>${headerFields}<th>推荐供应商</th><th>是否一致</th><th>推荐理由</th></tr></thead><tbody>${body}</tbody></table>`;
    const matched = state.rows.reduce((sum, row) => sum + row.quotes.filter(quote => selectedRecord(quote)).length, 0);
    const total = state.rows.length * state.suppliers.length;
    const recommended = state.rows.filter(row => row.recommendation.supplier).length;
    const sameCount = state.rows.filter(row => core.compareSupplier(row.base.baseSupplier, row.recommendation.supplier).code === 'same').length;
    const differentCount = state.rows.filter(row => core.compareSupplier(row.base.baseSupplier, row.recommendation.supplier).code === 'different').length;
    elements.summary.innerHTML = `<div class="metric"><span class="muted">基础商品</span><b>${state.rows.length}</b></div><div class="metric"><span class="muted">供应商</span><b>${state.suppliers.length}</b></div><div class="metric"><span class="muted">已匹配报价</span><b>${matched} / ${total}</b></div><div class="metric"><span class="muted">已生成推荐</span><b>${recommended}</b></div><div class="metric"><span class="muted">与基础表一致</span><b>${sameCount}</b></div><div class="metric"><span class="muted">与基础表不一致</span><b>${differentCount}</b></div>`;
  }

  function recalculateAll() {
    const taxRate = Number(elements.tax.value || 14);
    state.rows.forEach(row => { row.recommendation = calculateRecommendation(row, taxRate); });
    renderResults();
  }

  function sampleSheets() {
    const base = [['SV 2026年报价单'], ['日期', "SUPPLIER'S NAME", 'DESCRIPTION OF GOODS', 'BIG SERIES', 'Unit', '采购量'], ['2026/9/5', 'pyramids', '鸡精', '干货调味品', '', '1件'], ['2026/9/5', 'yummy', '干海带', '干货调味品', '', '4公斤'], ['2026/9/5', 'yummy', '茶树菇', '蔬菜', '', '2公斤'], ['2026/9/5', 'pyramids', '白芷', '蔬菜', '', '1公斤'], ['2026/9/5', '没有', '面筋粉', '主食', '', '10包']];
    const pyramidFood = [['登记表 SV2026年'], ['DATE', 'BIG SERIES', 'DESCRIPTION OF GOODS', 'UNIT', '采购量', '厨师备注', '埃镑报价（税前价）', '规格', '是否加税'], ['2026/9/5', '蔬菜', '茶树菇', 'kg', 2, '', 1580, '1kg', '加'], ['2026/9/5', '蔬菜', '白芷', 'kg', 1, '', 1300, '1kg', '加']];
    const pyramidSeasoning = [['登记表 SV2026年'], ['DATE', 'BIG SERIES', 'DESCRIPTION OF GOODS', '采购量', '厨师备注', '埃镑报价（税前价）', '规格', '结算价格'], ['2026/9/5', '干货调味品', '鸡精', '1件', '', '', '', ''], ['2026/9/5', '干货调味品', '干海带', '4公斤', '', 600, '1kg', '']];
    const yummyFood = [['登记表 SV2026年'], ['DATE', 'BIG SERIES', 'DESCRIPTION OF GOODS', 'UNIT', '采购量', '厨师备注', '埃镑报价（税前价）', '结算价格'], ['2026/9/5', '蔬菜', '茶树菇', 'kg', 2, '', 1300, ''], ['2026/9/5', '蔬菜', '白芷', 'kg', 1, '', 1300, '']];
    const yummySeasoning = [['登记表 SV2026年'], ['DATE', 'BIG SERIES', 'DESCRIPTION OF GOODS', '采购量', '厨师备注', '埃镑报价（税前价）', '结算价格'], ['2026/9/5', '干货调味品', '鸡精', '1件', '200克', '', ''], ['2026/9/5', '干货调味品', '干海带', '4公斤', '', 600, '']];
    const luo = [['种类', '名称', '规格', '2026年9月份', '税后14%', '币种', '备注'], ['干货调味品', '鸡精', '瓶', 0, 0, 'EGP', '无货'], ['干货调味品', '干海带', '包', 535, 609.44, 'EGP', '1KG每包'], ['主食', '面筋粉', '包', 680, 775.2, 'EGP', '2KG/包']];
    return [{ name: 'Week1 (9.5-9.9)', matrix: base }, { name: '食材-金字塔', matrix: pyramidFood }, { name: '-调味品-金字塔', matrix: pyramidSeasoning }, { name: '食材-yummy', matrix: yummyFood }, { name: '-调味品-yummy', matrix: yummySeasoning }, { name: '罗葛家', matrix: luo }];
  }

  function xmlEscape(value) { return String(value == null ? '' : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]); }
  function columnName(index) { let value = index + 1, result = ''; while (value) { result = String.fromCharCode(65 + (value - 1) % 26) + result; value = Math.floor((value - 1) / 26); } return result; }
  function safeSheetName(value) { return String(value || '供应商比价').replace(/[\\/?*\[\]:]/g, '').slice(0, 31) || '供应商比价'; }
  function safeFileName(value) { return String(value || '供应商比价表').replace(/[\\/:*?"<>|]/g, '_').trim() || '供应商比价表'; }

  function exportRows() {
    const groupRow = [{ v: '基础需求', s: 1 }, { v: '', s: 1 }, { v: '', s: 1 }, { v: '', s: 1 }, { v: '', s: 1 }];
    const subRow = ['序号', '类别', '商品', '需求量', '基础表供应商'].map(value => ({ v: value, s: 2 }));
    state.suppliers.forEach((group, index) => {
      const headerStyle = 3 + (index % palette.length);
      groupRow.push({ v: group.name, s: headerStyle }, { v: '', s: headerStyle }, { v: '', s: headerStyle }, { v: '', s: headerStyle });
      ['含税报价', '单位 / 规格', '折算单价', '备注'].forEach(value => subRow.push({ v: value, s: headerStyle }));
    });
    groupRow.push({ v: '推荐结果', s: 15 }, { v: '', s: 15 }, { v: '', s: 15 });
    subRow.push({ v: '推荐供应商', s: 15 }, { v: '是否一致', s: 15 }, { v: '推荐理由', s: 15 });
    const rows = [groupRow, subRow];
    state.rows.forEach((row, rowIndex) => {
      const output = [{ v: rowIndex + 1, s: 2 }, { v: row.base.category || '', s: 2 }, { v: row.base.item, s: 2 }, { v: [row.base.quantity, row.base.unit].filter(value => value !== null && value !== '').join(' '), s: 2 }, { v: row.base.baseSupplier || '', s: 2 }];
      row.quotes.forEach((quote, index) => {
        const record = selectedRecord(quote);
        const details = record ? core.quoteDetails(record, Number(elements.tax.value || 14)) : null;
        const style = 9 + (index % palette.length);
        const unitSpec = record ? [record.unit, record.spec || (details.measure && details.measure.raw)].filter(Boolean).join(' / ') : '';
        const notes = record ? [record.remark, record.stock, core.text(record.priceRaw) ? `原报价：${core.text(record.priceRaw)}` : '', details.taxApplied ? '已按税率加税' : '', details.unavailable ? '无货' : ''].filter(Boolean).join('；') : '';
        output.push({ v: details && details.finalPrice, s: style }, { v: unitSpec, s: style }, { v: details && details.normalizedPrice, s: style }, { v: notes, s: style });
      });
      const comparison = core.compareSupplier(row.base.baseSupplier, row.recommendation.supplier);
      output.push({ v: row.recommendation.supplier, s: 16 }, { v: comparison.label, s: 16 }, { v: row.recommendation.reason, s: 16 });
      rows.push(output);
    });
    return rows;
  }

  function buildStylesXml() {
    const darkFills = palette.map(color => `<fill><patternFill patternType="solid"><fgColor rgb="FF${color.dark.slice(1)}"/><bgColor indexed="64"/></patternFill></fill>`).join('');
    const lightFills = palette.map(color => `<fill><patternFill patternType="solid"><fgColor rgb="FF${color.light.slice(1)}"/><bgColor indexed="64"/></patternFill></fill>`).join('');
    const headerXfs = palette.map((_, index) => `<xf numFmtId="0" fontId="1" fillId="${3 + index}" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>`).join('');
    const dataXfs = palette.map((_, index) => `<xf numFmtId="4" fontId="0" fillId="${9 + index}" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="0"/><fonts count="2"><font><sz val="11"/><name val="Microsoft YaHei"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Microsoft YaHei"/></font></fonts><fills count="18"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill>${darkFills}${lightFills}<fill><patternFill patternType="solid"><fgColor rgb="FFD9EAF7"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF067647"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFECFDF3"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFD0D5DD"/></left><right style="thin"><color rgb="FFD0D5DD"/></right><top style="thin"><color rgb="FFD0D5DD"/></top><bottom style="thin"><color rgb="FFD0D5DD"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="17"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="15" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>${headerXfs}${dataXfs}<xf numFmtId="0" fontId="1" fillId="16" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="17" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  }

  async function exportStyledWorkbook() {
    if (!window.JSZip) throw new Error('Excel 导出组件未加载，请刷新页面后重试');
    if (!state.rows.length) throw new Error('请先生成比价表');
    const rows = exportRows();
    const columnCount = rows[0].length;
    const rowXml = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}"${rowIndex < 2 ? ' ht="30" customHeight="1"' : ' ht="42" customHeight="1"'}>${row.map((cell, columnIndex) => {
      const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
      const style = ` s="${cell.s || 0}"`;
      if (typeof cell.v === 'number' && Number.isFinite(cell.v)) return `<c r="${ref}"${style}><v>${cell.v}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEscape(cell.v == null ? '' : cell.v)}</t></is></c>`;
    }).join('')}</row>`).join('');
    const merges = [];
    merges.push('A1:E1');
    state.suppliers.forEach((_, index) => { const start = 5 + index * 4; merges.push(`${columnName(start)}1:${columnName(start + 3)}1`); });
    merges.push(`${columnName(columnCount - 3)}1:${columnName(columnCount - 1)}1`);
    const cols = [];
    [7, 16, 22, 14, 18].forEach((width, index) => cols.push(`<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`));
    state.suppliers.forEach((_, index) => [15, 17, 16, 28].forEach((width, offset) => { const col = 6 + index * 4 + offset; cols.push(`<col min="${col}" max="${col}" width="${width}" customWidth="1"/>`); }));
    cols.push(`<col min="${columnCount - 2}" max="${columnCount - 2}" width="18" customWidth="1"/><col min="${columnCount - 1}" max="${columnCount - 1}" width="16" customWidth="1"/><col min="${columnCount}" max="${columnCount}" width="42" customWidth="1"/>`);
    const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${columnName(columnCount - 1)}${rows.length}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${cols.join('')}</cols><sheetData>${rowXml}</sheetData><autoFilter ref="A2:${columnName(columnCount - 1)}${rows.length}"/><mergeCells count="${merges.length}">${merges.map(ref => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells><pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
    const zip = new JSZip();
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
    zip.folder('_rels').file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
    zip.folder('xl').file('workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(safeSheetName(elements.exportName.value))}" sheetId="1" r:id="rId1"/></sheets></workbook>`);
    zip.folder('xl').folder('_rels').file('workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
    zip.folder('xl').folder('worksheets').file('sheet1.xml', sheetXml);
    zip.folder('xl').file('styles.xml', buildStylesXml());
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${safeFileName(elements.exportName.value)}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1200);
  }

  elements.input.addEventListener('change', event => { const file = event.target.files[0]; if (file) readFile(file).catch(error => showStatus(error.message, 'error')); });
  ['dragenter', 'dragover'].forEach(name => elements.drop.addEventListener(name, event => { event.preventDefault(); elements.drop.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(name => elements.drop.addEventListener(name, event => { event.preventDefault(); elements.drop.classList.remove('drag'); }));
  elements.drop.addEventListener('drop', event => { const file = event.dataTransfer.files[0]; if (file) readFile(file).catch(error => showStatus(error.message, 'error')); });
  $('#sampleBtn').addEventListener('click', () => loadSheets(sampleSheets(), '示例：3家供应商报价.xlsx'));
  $('#generateBtn').addEventListener('click', () => { try { generateComparison(); } catch (error) { showStatus(error.message, 'error'); } });
  $('#regenerateBtn').addEventListener('click', recalculateAll);
  $('#exportBtn').addEventListener('click', () => exportStyledWorkbook().catch(error => showStatus(error.message, 'error')));
  elements.sheets.addEventListener('change', event => {
    if (event.target.dataset.prop === 'role') {
      const card = event.target.closest('.sheet-card');
      card.dataset.role = event.target.value;
    }
    if (event.target.dataset.prop === 'headerRow') {
      syncConfigFromControls();
      const index = Number(event.target.dataset.sheetIndex);
      const config = state.configs[index];
      config.columns = core.detectColumns(config.matrix[config.headerRow] || []);
      renderSheetConfig();
    }
  });
  elements.preview.addEventListener('change', event => {
    const row = state.rows[Number(event.target.dataset.row)];
    if (!row) return;
    if (event.target.dataset.action === 'match') {
      row.quotes[Number(event.target.dataset.supplier)].selectedId = event.target.value;
      row.recommendation = calculateRecommendation(row, Number(elements.tax.value || 14));
      renderResults();
    } else if (event.target.dataset.action === 'recommend') {
      row.recommendation.supplier = event.target.value;
      renderResults();
    }
  });
  elements.preview.addEventListener('input', event => {
    const row = state.rows[Number(event.target.dataset.row)];
    if (row && event.target.dataset.action === 'reason') row.recommendation.reason = event.target.value;
  });
})();
