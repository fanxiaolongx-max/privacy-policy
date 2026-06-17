window.exportYuxiangExcel = async function() {
    const orderedMetrics = window._currentOrderedMetrics;
    if (!currentSnapshot || !orderedMetrics || !window._currentCatData) {
        return showToast('无数据可导出', 'warn');
    }
    const btn = event.currentTarget;
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '⏳ 正在导出...';
    btn.disabled = true;

    try {
        const payload = {
            metrics: [],
            adjustments: [],
            totals: {
                subTotal: { TE: 0, ORG: 0, ET: 0, VDF: 0 },
                adjustTotal: { TE: 0, ORG: 0, ET: 0, VDF: 0 },
                weightInMonth: { TE: 0, ORG: 0, ET: 0, VDF: 0 },
                finalResult: { TE: 0, ORG: 0, ET: 0, VDF: 0 }
            }
        };

        const monthStr = document.getElementById('target-month-select').value || '未知';
        const targetMonth = parseInt(monthStr, 10);
        const targetCats = ['TE', 'ORG', 'ET', 'VDF'];

        // Filter out Others group metrics
        const labelGroupLookup = window._currentLabelToGroup || {};
        const mainMetrics = orderedMetrics.filter(m => labelGroupLookup[m.label] !== 'Others');
        mainMetrics.forEach(m => {
            const labelEn = rt(m.label, true) || m.label;
            const targetData = labelToTargetMap[m.label];
            const target = targetData && targetData[targetMonth] !== undefined ? targetData[targetMonth] : '';
            const metricData = { label: m.label, labelEn, target };
            
            targetCats.forEach(cat => {
                const cell = window._currentCatData[cat] && window._currentCatData[cat].values ? window._currentCatData[cat].values[m.label] : null;
                const weight = Number(m.weight) || 0;
                
                let achv = '';
                let score = 0;
                
                if (cell) {
                    if (cell.isFailing) {
                        achv = cell.raw;
                    } else {
                        achv = cell.raw;
                    }
                    score = cell.earnedScore !== undefined ? cell.earnedScore : (cell.isFailing ? 0 : (weight + (cell.bonusScore || 0)));
                }
                
                metricData[cat] = { achv, score };
            });
