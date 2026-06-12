const fs = require('fs');
const path = require('path');

const { DATA_DIR } = require('./store');

const REPORT_DATA_DIR = process.env.TOOLS_REPORT_DATA_DIR
    || (process.env.TOOLS_DATA_DIR ? DATA_DIR : path.join(__dirname, '../../data'));

function ensureReportDataDir() {
    if (!fs.existsSync(REPORT_DATA_DIR)) {
        fs.mkdirSync(REPORT_DATA_DIR, { recursive: true });
    }
}

module.exports = {
    REPORT_DATA_DIR,
    ensureReportDataDir
};
