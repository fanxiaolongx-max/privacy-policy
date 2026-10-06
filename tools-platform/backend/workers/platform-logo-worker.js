const { parentPort, workerData } = require('node:worker_threads');
const { generateLogoAssets } = require('../models/platform-logo-image');

try {
    parentPort.postMessage({ assets: generateLogoAssets(workerData.source, workerData.options) });
} catch (error) {
    parentPort.postMessage({ error: error.message });
}
