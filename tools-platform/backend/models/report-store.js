const fs = require('fs');
const path = require('path');

const { BASE_REPORT_DATA_DIR, getReportDataDir } = require('./tenant-context');

const REPORT_DATA_DIR = BASE_REPORT_DATA_DIR;

function ensureReportDataDir(tenantId) {
    const reportDir = getReportDataDir(tenantId);
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }
    return reportDir;
}

module.exports = {
    REPORT_DATA_DIR,
    getReportDataDir,
    ensureReportDataDir
};
