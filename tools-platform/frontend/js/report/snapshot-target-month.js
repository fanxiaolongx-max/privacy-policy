(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.ReportSnapshotTargetMonth = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    function normalizeMonth(value) {
        const month = parseInt(value, 10);
        return month >= 1 && month <= 12 ? month : null;
    }

    function inferFromDate(dateInput) {
        const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
        if (Number.isNaN(date.getTime())) return null;
        const currentMonth = date.getMonth() + 1;
        if (date.getDate() < 10) return currentMonth === 1 ? 12 : currentMonth - 1;
        return currentMonth;
    }

    function resolve(snapshot) {
        const savedMonth = normalizeMonth(snapshot && snapshot.selectedTargetMonth);
        if (savedMonth) return savedMonth;
        const timestamp = snapshot && (snapshot.timestamp || snapshot.created_at || snapshot.createdAt);
        return timestamp ? inferFromDate(timestamp) : null;
    }

    return { normalizeMonth, inferFromDate, resolve };
});
