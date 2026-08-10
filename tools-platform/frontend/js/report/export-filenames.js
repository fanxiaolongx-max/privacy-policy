(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.ReportExportFilenames = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    const ENGLISH_MONTHS = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    function getReferenceYearMonth(referenceDate) {
        if (referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())) {
            return { year: referenceDate.getFullYear(), month: referenceDate.getMonth() + 1 };
        }

        const text = String(referenceDate || '').trim();
        const dateMatch = text.match(/^(\d{4})-(\d{1,2})/);
        if (dateMatch) {
            return { year: Number(dateMatch[1]), month: Number(dateMatch[2]) };
        }

        const parsed = new Date(text);
        if (!Number.isNaN(parsed.getTime())) {
            return { year: parsed.getFullYear(), month: parsed.getMonth() + 1 };
        }

        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() + 1 };
    }

    function resolveAssessmentPeriod(targetMonth, referenceDate) {
        const month = parseInt(targetMonth, 10);
        if (month < 1 || month > 12) return null;

        const reference = getReferenceYearMonth(referenceDate);
        const crossesIntoPreviousYear = month - reference.month >= 6;
        return {
            month,
            monthName: ENGLISH_MONTHS[month - 1],
            year: reference.year - (crossesIntoPreviousYear ? 1 : 0)
        };
    }

    function buildMonthlyPdfFilename(targetMonth, referenceDate) {
        const period = resolveAssessmentPeriod(targetMonth, referenceDate);
        if (!period) return 'Egypt Maintenance Operation Monthly Report.pdf';
        return `Egypt Maintenance Operation Monthly Report - ${period.monthName} ${period.year}.pdf`;
    }

    function buildHorseRacingExcelFilename(targetMonth, referenceDate) {
        const period = resolveAssessmentPeriod(targetMonth, referenceDate);
        if (!period) return 'Egypt SPM Horse Racing Monthly Report.xlsx';
        return `Egypt SPM Horse Racing Monthly Report - ${period.monthName} ${period.year}.xlsx`;
    }

    return {
        ENGLISH_MONTHS,
        resolveAssessmentPeriod,
        buildMonthlyPdfFilename,
        buildHorseRacingExcelFilename
    };
});
