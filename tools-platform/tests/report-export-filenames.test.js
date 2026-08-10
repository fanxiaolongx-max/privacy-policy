const test = require('node:test');
const assert = require('node:assert/strict');
const {
    resolveAssessmentPeriod,
    buildMonthlyPdfFilename,
    buildHorseRacingExcelFilename
} = require('../frontend/js/report/export-filenames');

test('builds the requested August 2026 export filenames', () => {
    assert.equal(
        buildMonthlyPdfFilename(8, '2026-08-10T07:15:23.000Z'),
        'Egypt Maintenance Operation Monthly Report - August 2026.pdf'
    );
    assert.equal(
        buildHorseRacingExcelFilename('8', '2026-08-10T07:15:23.000Z'),
        'Egypt SPM Horse Racing Monthly Report - August 2026.xlsx'
    );
});

test('uses the previous year for a clear year-boundary assessment month', () => {
    assert.deepEqual(resolveAssessmentPeriod(12, '2027-01-05'), {
        month: 12,
        monthName: 'December',
        year: 2026
    });
});

test('keeps a nearby upcoming assessment month in the reference year', () => {
    assert.deepEqual(resolveAssessmentPeriod(8, '2026-07-20'), {
        month: 8,
        monthName: 'August',
        year: 2026
    });
});
