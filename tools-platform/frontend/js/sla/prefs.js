/**
 * sla/prefs.js - 表格偏好存储模块（列宽/显示列/排序/自定义指标规则）
 * 与服务端 /api/sla/prefs/:schemaHash 交互，替代原 localStorage
 */

async function loadPrefs(secId) {
    const state = AppState[secId];
    try {
        const saved = await API.get(`/api/sla/prefs/${encodeURIComponent(state.schemaHash)}`);
        if (saved) {
            const validV = (saved.visibleHeaders || []).filter(h => state.orderedHeaders.includes(h));
            state.visibleHeaders = validV.length > 0 ? validV : [...state.orderedHeaders];
            state.columnWidths = saved.columnWidths || {};
            state.sortKey = saved.sortKey || null;
            state.sortAsc = saved.sortAsc !== undefined ? saved.sortAsc : true;
            state.customMetrics = saved.customMetrics || [];
        }
    } catch (e) {
        // 服务端无数据时使用默认值（不报错）
    }
}

async function savePrefs(secId) {
    const state = AppState[secId];
    try {
        await API.put(`/api/sla/prefs/${encodeURIComponent(state.schemaHash)}`, {
            visibleHeaders: state.visibleHeaders,
            columnWidths: state.columnWidths,
            sortKey: state.sortKey,
            sortAsc: state.sortAsc,
            customMetrics: state.customMetrics
        });
    } catch (e) {
        // 保存失败静默处理（不影响主流程）
    }
}

window.SLAPrefs = { loadPrefs, savePrefs };
