function selectLatestSnapshotPerMonth(rows) {
    const latestByMonth = new Map();

    (Array.isArray(rows) ? rows : []).forEach(row => {
        const trendMonth = String(row && row.trend_month || '').trim();
        if (!/^\d{4}-\d{2}$/.test(trendMonth)) return;
        const current = latestByMonth.get(trendMonth);
        if (!current) {
            latestByMonth.set(trendMonth, row);
            return;
        }
        const rowTime = String(row.created_at || '');
        const currentTime = String(current.created_at || '');
        if (rowTime > currentTime || (rowTime === currentTime && Number(row.id) > Number(current.id))) {
            latestByMonth.set(trendMonth, row);
        }
    });

    return Array.from(latestByMonth.values()).sort((a, b) => {
        const monthCompare = String(a.trend_month).localeCompare(String(b.trend_month));
        if (monthCompare) return monthCompare;
        return Number(a.id) - Number(b.id);
    });
}

module.exports = {
    selectLatestSnapshotPerMonth
};
