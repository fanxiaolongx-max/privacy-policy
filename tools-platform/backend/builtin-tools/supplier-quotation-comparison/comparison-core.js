(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SupplierQuoteCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const FIELD_ALIASES = {
    item: ['descriptionofgoods', 'description', 'goods', '品名', '名称', '商品名称', '货品名称', '物料名称', '食材名称', '菜品', '项目'],
    baseSupplier: ['suppliersname', 'suppliername', 'supplier', '供应商名字', '供应商名称', '供应商'],
    category: ['bigseries', 'series', 'category', '种类', '大类', '类别', '品类'],
    quantity: ['purchasequantity', 'quantity', 'qty', '采购量', '需求量', '数量'],
    unit: ['unit', '单位', '计量单位'],
    price: ['quotationbeforetax', 'quotation', 'quote', 'unitprice', 'price', '埃镑报价税前价', '税前价', '报价', '单价', '价格'],
    taxPrice: ['aftertax14', 'taxincluded', 'settlementprice', '税后14', '含税价', '税后价', '结算价格'],
    spec: ['specification', 'spec', '规格', '包装规格'],
    remark: ['chefremark', 'remarks', 'remark', 'note', 'notes', '厨师备注', '备注', '说明'],
    taxFlag: ['taxflag', '是否加税', '加税', '税'],
    stock: ['stock', 'availability', '库存', '有货', '无货']
  };

  const UNIT_WORDS = {
    kg: ['kg', 'kgs', '公斤', '千克'],
    g: ['g', 'gr', 'gram', 'grams', '克'],
    jin: ['斤'],
    l: ['l', 'lt', 'liter', 'litre', '升'],
    ml: ['ml', '毫升'],
    each: ['pcs', 'pc', 'piece', 'pieces', '个', '件', '条', '板'],
    bag: ['包', '袋'],
    bottle: ['瓶'],
    barrel: ['桶'],
    box: ['盒', '箱'],
    can: ['罐']
  };

  function text(value) {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).trim();
  }

  function compact(value) {
    return text(value).toLowerCase().replace(/[‘’“”'"`~!@#$%^&*+=|\\/:;,.?，。：；！？（）()\[\]{}、·—_\s-]+/g, '');
  }

  function normalizeItem(value) {
    return compact(value)
      .replace(/毫升/g, 'ml').replace(/公斤|千克/g, 'kg').replace(/克/g, 'g')
      .replace(/蚝油/g, '耗油').replace(/鸡粉/g, '鸡精');
  }

  function parseNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const source = text(value).replace(/,/g, '');
    const found = source.match(/-?\d+(?:\.\d+)?/);
    return found ? Number(found[0]) : null;
  }

  function headerScore(header, alias) {
    const source = compact(header);
    const target = compact(alias);
    if (!source || !target) return 0;
    if (source === target) return 100 + target.length;
    if (source.includes(target)) return 70 + target.length;
    if (target.includes(source) && source.length >= 2) return 45 + source.length;
    return 0;
  }

  function detectColumns(row) {
    const candidates = [];
    (row || []).forEach((header, columnIndex) => {
      Object.entries(FIELD_ALIASES).forEach(([field, aliases]) => {
        const score = Math.max(...aliases.map(alias => headerScore(header, alias)));
        if (score) candidates.push({ field, columnIndex, score, header: text(header) });
      });
    });
    candidates.sort((a, b) => b.score - a.score);
    const columns = {};
    const used = new Set();
    candidates.forEach(candidate => {
      if (columns[candidate.field] !== undefined || used.has(candidate.columnIndex)) return;
      columns[candidate.field] = candidate.columnIndex;
      used.add(candidate.columnIndex);
    });
    return columns;
  }

  function detectHeaderRow(matrix, role) {
    let best = { headerRow: 0, columns: {}, score: -1 };
    const limit = Math.min(15, matrix.length);
    for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
      const columns = detectColumns(matrix[rowIndex]);
      let score = Object.keys(columns).length * 2;
      if (columns.item !== undefined) score += 8;
      if (role === 'base' && columns.quantity !== undefined) score += 4;
      if (role === 'supplier' && (columns.price !== undefined || columns.taxPrice !== undefined)) score += 5;
      if (score > best.score) best = { headerRow: rowIndex, columns, score };
    }
    return best;
  }

  function scoreBaseSheet(sheet) {
    const named = /(?:^|\b)week\s*1\b|第一周|基础|需求|采购清单/i.test(sheet.name) ? 20 : 0;
    const detection = detectHeaderRow(sheet.matrix, 'base');
    return named + detection.score + (detection.columns.quantity !== undefined ? 5 : 0) - (detection.columns.price !== undefined ? 2 : 0);
  }

  function deriveSupplierName(sheetName) {
    const original = text(sheetName);
    const stripped = original
      .replace(/^[\s_\-]*(?:食材|调味品|干货|蔬菜|海鲜|肉类)[\s_\-]+/i, '')
      .replace(/[\s_\-]+(?:食材|调味品|干货|蔬菜|海鲜|肉类)$/i, '')
      .trim();
    return stripped || original || '未命名供应商';
  }

  function analyzeSheets(sheets) {
    if (!Array.isArray(sheets) || !sheets.length) return [];
    let baseIndex = 0;
    let bestScore = -Infinity;
    sheets.forEach((sheet, index) => {
      const score = scoreBaseSheet(sheet);
      if (score > bestScore) { bestScore = score; baseIndex = index; }
    });
    return sheets.map((sheet, index) => {
      const role = index === baseIndex ? 'base' : 'supplier';
      const detection = detectHeaderRow(sheet.matrix, role);
      const priceHeader = detection.columns.price === undefined ? '' : text(sheet.matrix[detection.headerRow]?.[detection.columns.price]);
      return {
        name: sheet.name,
        matrix: sheet.matrix,
        role,
        supplier: role === 'supplier' ? deriveSupplierName(sheet.name) : '',
        headerRow: detection.headerRow,
        columns: detection.columns,
        taxMode: /税前|beforetax/i.test(compact(priceHeader)) ? 'exclusive' : 'auto',
        detectionScore: detection.score
      };
    });
  }

  function parseQuantityUnit(value, fallbackUnit) {
    const source = text(value);
    return { quantity: parseNumber(source), unit: text(fallbackUnit) || source.replace(/[\d\s.,]/g, '') };
  }

  function cellAt(row, index) {
    return index === undefined || index === null ? '' : row[index];
  }

  function recordsFromSheet(config) {
    const rows = [];
    const start = Number(config.headerRow || 0) + 1;
    for (let rowIndex = start; rowIndex < config.matrix.length; rowIndex += 1) {
      const row = config.matrix[rowIndex] || [];
      const item = text(cellAt(row, config.columns.item));
      if (!item) continue;
      const quantityRaw = cellAt(row, config.columns.quantity);
      const unitRaw = cellAt(row, config.columns.unit);
      const parsedQty = parseQuantityUnit(quantityRaw, unitRaw);
      const record = {
        id: `${config.name}:${rowIndex + 1}`,
        sheet: config.name,
        rowNumber: rowIndex + 1,
        supplier: config.supplier,
        baseSupplier: text(cellAt(row, config.columns.baseSupplier)),
        item,
        category: text(cellAt(row, config.columns.category)),
        quantity: parsedQty.quantity,
        unit: parsedQty.unit,
        priceRaw: cellAt(row, config.columns.price),
        taxPriceRaw: cellAt(row, config.columns.taxPrice),
        spec: text(cellAt(row, config.columns.spec)),
        remark: text(cellAt(row, config.columns.remark)),
        taxFlag: text(cellAt(row, config.columns.taxFlag)),
        stock: text(cellAt(row, config.columns.stock)),
        taxMode: config.taxMode || 'auto'
      };
      rows.push(record);
    }
    return rows;
  }

  function bigrams(value) {
    const source = normalizeItem(value);
    if (source.length < 2) return source ? [source] : [];
    const result = [];
    for (let index = 0; index < source.length - 1; index += 1) result.push(source.slice(index, index + 2));
    return result;
  }

  function similarity(left, right) {
    const a = normalizeItem(left);
    const b = normalizeItem(right);
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) return Math.min(0.95, 0.72 + Math.min(a.length, b.length) / Math.max(a.length, b.length) * 0.2);
    const aa = bigrams(a);
    const bb = bigrams(b);
    const counts = new Map();
    aa.forEach(token => counts.set(token, (counts.get(token) || 0) + 1));
    let overlap = 0;
    bb.forEach(token => {
      const count = counts.get(token) || 0;
      if (count) { overlap += 1; counts.set(token, count - 1); }
    });
    return aa.length + bb.length ? (2 * overlap) / (aa.length + bb.length) : 0;
  }

  function matchScore(base, quote) {
    let score = similarity(base.item, quote.item);
    if (base.category && quote.category) {
      const categoryScore = similarity(base.category, quote.category);
      score = Math.min(1, score * 0.92 + categoryScore * 0.08);
    }
    return score;
  }

  function rankedMatches(base, records, limit) {
    return records.map(record => ({ record, score: matchScore(base, record) }))
      .filter(item => item.score >= 0.24)
      .sort((a, b) => b.score - a.score || a.record.rowNumber - b.record.rowNumber)
      .slice(0, limit || 8);
  }

  function inferUnit(value) {
    const source = compact(value);
    for (const [unit, words] of Object.entries(UNIT_WORDS)) {
      if (words.some(word => source.includes(compact(word)))) return unit;
    }
    return source || '';
  }

  function extractMeasure(source) {
    const value = text(source).toLowerCase().replace(/,/g, '');
    const expressions = [
      { regex: /(\d+(?:\.\d+)?)\s*(kg|kgs|公斤|千克)/i, basis: 'kg', factor: 1 },
      { regex: /(\d+(?:\.\d+)?)\s*(g|gr|gram|grams|克)/i, basis: 'kg', factor: 0.001 },
      { regex: /(\d+(?:\.\d+)?)\s*斤/i, basis: 'kg', factor: 0.5 },
      { regex: /(\d+(?:\.\d+)?)\s*(l|lt|liter|litre|升)(?![a-z])/i, basis: 'l', factor: 1 },
      { regex: /(\d+(?:\.\d+)?)\s*(ml|毫升)/i, basis: 'l', factor: 0.001 }
    ];
    for (const expression of expressions) {
      const found = value.match(expression.regex);
      if (found) return { basis: expression.basis, amount: Number(found[1]) * expression.factor, raw: found[0] };
    }
    return null;
  }

  function parsePrice(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    let source = text(value).replace(/,/g, '');
    if (!source) return null;
    source = source.replace(/\d+(?:\.\d+)?\s*(?:kg|kgs|g|gr|gram|grams|ml|lt|liter|litre|公斤|千克|毫升|克|斤)(?:\s*\/?\s*(?:包|袋|瓶|桶|盒|罐))?/gi, ' ');
    const numbers = source.match(/-?\d+(?:\.\d+)?/g);
    return numbers && numbers.length ? Number(numbers[numbers.length - 1]) : null;
  }

  function quoteDetails(record, taxRate) {
    const notes = [record.spec, record.remark, text(record.priceRaw), text(record.taxPriceRaw), record.stock].filter(Boolean).join(' ');
    const unavailable = /(?:无货|缺货|暂无|outofstock|unavailable)/i.test(compact(notes));
    const rawPrice = parsePrice(record.priceRaw);
    const suppliedTaxPrice = parsePrice(record.taxPriceRaw);
    let finalPrice = suppliedTaxPrice && suppliedTaxPrice > 0 ? suppliedTaxPrice : rawPrice;
    let taxApplied = false;
    const taxFlag = compact(record.taxFlag);
    if (finalPrice && !(suppliedTaxPrice > 0)) {
      const explicitlyNoTax = /不加|含税|included|noadd/.test(taxFlag);
      const explicitlyAddTax = /(?:^|要)加|taxbefore|税前/.test(taxFlag) || record.taxMode === 'exclusive';
      if (!explicitlyNoTax && explicitlyAddTax) {
        finalPrice *= 1 + Number(taxRate || 0) / 100;
        finalPrice = Math.round(finalPrice * 10000) / 10000;
        taxApplied = true;
      }
    }
    const measure = extractMeasure([record.spec, record.remark, text(record.priceRaw), text(record.taxPriceRaw)].filter(Boolean).join(' '));
    const unit = inferUnit(record.unit || record.spec);
    let basis = '';
    let normalizedPrice = null;
    if (measure && measure.amount > 0 && finalPrice > 0) {
      basis = measure.basis;
      normalizedPrice = Math.round((finalPrice / measure.amount) * 10000) / 10000;
    } else if (finalPrice > 0) {
      if (unit === 'kg' || unit === 'g' || unit === 'jin') {
        basis = 'kg';
        normalizedPrice = Math.round((finalPrice / (unit === 'g' ? 0.001 : unit === 'jin' ? 0.5 : 1)) * 10000) / 10000;
      } else if (unit === 'l' || unit === 'ml') {
        basis = 'l';
        normalizedPrice = Math.round((finalPrice / (unit === 'ml' ? 0.001 : 1)) * 10000) / 10000;
      } else if (unit) {
        basis = unit;
        normalizedPrice = finalPrice;
      }
    }
    if (unavailable || !(finalPrice > 0)) normalizedPrice = null;
    return { rawPrice, suppliedTaxPrice, finalPrice: finalPrice > 0 && !unavailable ? finalPrice : null, taxApplied, measure, basis, normalizedPrice, unavailable };
  }

  function groupSuppliers(configs) {
    const groups = new Map();
    configs.filter(config => config.role === 'supplier').forEach(config => {
      const name = text(config.supplier) || deriveSupplierName(config.name);
      if (!groups.has(name)) groups.set(name, { name, sheets: [], records: [] });
      const group = groups.get(name);
      group.sheets.push(config.name);
      group.records.push(...recordsFromSheet({ ...config, supplier: name }));
    });
    return Array.from(groups.values());
  }

  function evaluateRowComparison(base, selectedQuotes, taxRate) {
    const validQuotes = (selectedQuotes || []).map((selection, index) => {
      if (!selection || !selection.record) return null;
      const details = quoteDetails(selection.record, taxRate);
      return {
        supplier: selection.record.supplier,
        record: selection.record,
        details,
        index
      };
    }).filter(item => item && item.details && item.details.finalPrice !== null && item.details.finalPrice > 0 && !item.details.unavailable);

    if (!validQuotes.length) {
      return {
        unitMismatch: false,
        extremeDeviation: false,
        canCompareByNormalized: false,
        winner: null,
        recommendation: { supplier: '', reason: '无有效报价，请人工确认' },
        comparisonCode: 'missing-recommendation'
      };
    }

    if (validQuotes.length === 1) {
      const single = validQuotes[0];
      return {
        unitMismatch: false,
        extremeDeviation: false,
        canCompareByNormalized: true,
        winner: single,
        recommendation: { supplier: single.supplier, reason: '唯一有效且可比价的供应商报价' },
        comparisonCode: null
      };
    }

    // 检查不同供应商的单位是否一致
    const bases = new Set();
    const unitNames = [];
    validQuotes.forEach(q => {
      const b = q.details.basis || inferUnit(q.record.unit || q.record.spec) || '未指定单位';
      bases.add(b);
      const displayUnit = q.record.unit || q.record.spec || b;
      if (displayUnit && !unitNames.includes(displayUnit)) unitNames.push(displayUnit);
    });

    // 1. 同一商品不同供应商单位不一致：不作为比价依据，弱化单价显示
    if (bases.size > 1) {
      return {
        unitMismatch: true,
        extremeDeviation: false,
        canCompareByNormalized: false,
        unitNames,
        winner: null,
        recommendation: {
          supplier: '',
          reason: `不同供应商报价单位不一致（${unitNames.join(' vs ')}），折算单价不作为比价依据，请人工确认`
        },
        comparisonCode: 'unit-mismatch'
      };
    }

    const normalizedPrices = validQuotes
      .map(q => q.details.normalizedPrice)
      .filter(p => typeof p === 'number' && p > 0);

    // 若有报价未能有效折算单价，视为单位不全
    if (normalizedPrices.length < validQuotes.length) {
      const sortedByFinal = validQuotes.slice().sort((a, b) => a.details.finalPrice - b.details.finalPrice);
      const directWinner = sortedByFinal[0];
      return {
        unitMismatch: true,
        extremeDeviation: false,
        canCompareByNormalized: false,
        winner: directWinner,
        recommendation: {
          supplier: directWinner.supplier,
          reason: `部分报价缺少折算规格，已按含税报价直接对比（最低¥${directWinner.details.finalPrice.toFixed(2)}），需人工核实`
        },
        comparisonCode: 'anomaly-review'
      };
    }

    const minNorm = Math.min(...normalizedPrices);
    const maxNorm = Math.max(...normalizedPrices);
    const deviationRatio = minNorm > 0 ? (maxNorm / minNorm) : 1;

    // 2. 单位一致，但自动折算的单价偏差非常大（>= 3.0倍）：疑似计算或表格填写有误，不作为比价依据，直接对比含税价格，并提示人工二次确认
    if (deviationRatio >= 3.0) {
      const sortedByFinal = validQuotes.slice().sort((a, b) => a.details.finalPrice - b.details.finalPrice);
      const directWinner = sortedByFinal[0];
      const ratioStr = deviationRatio.toFixed(1);
      return {
        unitMismatch: false,
        extremeDeviation: true,
        deviationRatio,
        canCompareByNormalized: false,
        directWinner,
        winner: directWinner,
        recommendation: {
          supplier: directWinner.supplier,
          reason: `折算单价偏差达 ${ratioStr} 倍（疑规格或填写有误）；暂按含税报价直接比对推荐（¥${directWinner.details.finalPrice.toFixed(2)}），需人工二次复核确认！`,
          isAnomaly: true
        },
        comparisonCode: 'anomaly-review'
      };
    }

    // 3. 正常情况：单位一致且偏差在合理范围内，按折算单价推荐最低
    const sortedByNorm = validQuotes.slice().sort((a, b) => a.details.normalizedPrice - b.details.normalizedPrice);
    const winner = sortedByNorm[0];
    const second = sortedByNorm[1];

    if (Math.abs(winner.details.normalizedPrice - second.details.normalizedPrice) < 0.005) {
      return {
        unitMismatch: false,
        extremeDeviation: false,
        canCompareByNormalized: true,
        winner,
        recommendation: {
          supplier: winner.supplier,
          reason: '含税折算单价并列最低，请结合质量、交期和付款条件确认'
        },
        comparisonCode: null
      };
    }

    const saving = second.details.normalizedPrice > 0
      ? ((1 - winner.details.normalizedPrice / second.details.normalizedPrice) * 100)
      : 0;
    const unitLabel = winner.details.basis === 'kg' ? '公斤' : winner.details.basis === 'l' ? '升' : '单位';
    return {
      unitMismatch: false,
      extremeDeviation: false,
      canCompareByNormalized: true,
      winner,
      recommendation: {
        supplier: winner.supplier,
        reason: `含税折算单价最低（${winner.details.normalizedPrice.toFixed(2)}/${unitLabel}），比次低价约低 ${Math.max(0, saving).toFixed(1)}%`
      },
      comparisonCode: null
    };
  }

  function recommendation(base, selectedQuotes, taxRate) {
    return evaluateRowComparison(base, selectedQuotes, taxRate).recommendation;
  }

  function normalizeSupplierName(value) {
    const source = compact(value).replace(/供应商|公司|supplier|company/g, '');
    if (!source || /^(?:没有|无|未定|待定|none|na|n\/a|-)$/.test(source)) return '';
    if (/^(?:pyramid|pyramids|金字塔)$/.test(source)) return 'pyramids';
    return source;
  }

  function compareSupplier(baseSupplier, recommendedSupplier, isAnomaly) {
    if (isAnomaly) {
      return { code: 'anomaly-review', label: '⚠️ 需人工复核' };
    }
    const base = normalizeSupplierName(baseSupplier);
    const recommended = normalizeSupplierName(recommendedSupplier);
    if (!base) return { code: 'missing-base', label: '基础表未填' };
    if (!recommended) return { code: 'missing-recommendation', label: '未生成推荐' };
    if (base === recommended) return { code: 'same', label: '一致' };
    return { code: 'different', label: '不一致' };
  }

  function buildSheetFingerprint(sheet) {
    if (!sheet) return null;
    const name = text(sheet.name);
    const matrix = sheet.matrix || [];
    const rowSignatures = matrix.slice(0, 15).map(row => {
      if (!Array.isArray(row)) return '';
      return row.map(cell => compact(cell)).filter(Boolean).slice(0, 25).join('|');
    }).filter(Boolean);
    return {
      name,
      signature: rowSignatures.join(';;')
    };
  }

  function buildWorkbookFingerprint(sheets) {
    if (!Array.isArray(sheets)) return [];
    return sheets.map(sheet => buildSheetFingerprint(sheet));
  }

  function isSchemaMatch(currentFingerprints, savedFingerprints) {
    if (!Array.isArray(currentFingerprints) || !Array.isArray(savedFingerprints)) return false;
    if (currentFingerprints.length === 0 || currentFingerprints.length !== savedFingerprints.length) return false;
    for (let i = 0; i < currentFingerprints.length; i += 1) {
      const cur = currentFingerprints[i];
      const sav = savedFingerprints[i];
      if (!cur || !sav) return false;
      if (cur.name !== sav.name) return false;
      if (cur.signature !== sav.signature) return false;
    }
    return true;
  }

  function applySavedConfig(currentConfigs, savedConfig) {
    if (!Array.isArray(currentConfigs) || !savedConfig || !Array.isArray(savedConfig.sheets)) {
      return false;
    }
    const savedMap = new Map();
    savedConfig.sheets.forEach(s => {
      if (s && s.name) savedMap.set(s.name, s);
    });

    let appliedCount = 0;
    currentConfigs.forEach(config => {
      const saved = savedMap.get(config.name);
      if (!saved) return;
      if (['base', 'supplier', 'ignore'].includes(saved.role)) {
        config.role = saved.role;
      }
      if (typeof saved.supplier === 'string') {
        config.supplier = saved.supplier;
      }
      if (typeof saved.headerRow === 'number' && saved.headerRow >= 0 && saved.headerRow < config.matrix.length) {
        config.headerRow = saved.headerRow;
      }
      if (['auto', 'exclusive', 'inclusive'].includes(saved.taxMode)) {
        config.taxMode = saved.taxMode;
      }
      if (saved.columns && typeof saved.columns === 'object') {
        const rowLen = (config.matrix[config.headerRow] || []).length;
        const validColumns = {};
        Object.entries(saved.columns).forEach(([field, colIdx]) => {
          if (typeof colIdx === 'number' && colIdx >= 0 && colIdx < rowLen) {
            validColumns[field] = colIdx;
          }
        });
        if (Object.keys(validColumns).length > 0) {
          config.columns = validColumns;
        }
      }
      appliedCount += 1;
    });

    return appliedCount > 0;
  }

  return {
    FIELD_ALIASES,
    text,
    compact,
    normalizeItem,
    parseNumber,
    detectColumns,
    detectHeaderRow,
    analyzeSheets,
    deriveSupplierName,
    recordsFromSheet,
    similarity,
    rankedMatches,
    inferUnit,
    extractMeasure,
    parsePrice,
    quoteDetails,
    groupSuppliers,
    recommendation,
    evaluateRowComparison,
    normalizeSupplierName,
    compareSupplier,
    buildWorkbookFingerprint,
    isSchemaMatch,
    applySavedConfig
  };
});
