const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const repo = require('../models/global-backup-repository');
const remoteRepo = require('../models/remote-backup-sync-repository');

const { DATA_DIR } = require('../models/store');

const router = express.Router();
const uploadDir = path.join(DATA_DIR, '../tmp/uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const operationLogs = new Map();
const MAX_OPERATION_LOGS = 60;

const upload = multer({
    dest: uploadDir,
    limits: { fileSize: 1024 * 1024 * 1024 }
});

function handleError(res, err, fallback) {
    res.status(err.statusCode || 500).json({ error: err.message || fallback });
}

function getOperationId(req) {
    const value = String(req.headers['x-backup-operation-id'] || '').trim();
    return /^[a-zA-Z0-9_-]{8,80}$/.test(value) ? value : '';
}

function startOperation(req, type) {
    const id = getOperationId(req);
    if (!id) return null;
    const operation = {
        id,
        type,
        status: 'running',
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        entries: []
    };
    operationLogs.set(id, operation);
    while (operationLogs.size > MAX_OPERATION_LOGS) {
        operationLogs.delete(operationLogs.keys().next().value);
    }
    return operation;
}

function appendOperation(operation, entry) {
    if (!operation) return;
    operation.entries.push({
        timestamp: entry.timestamp || new Date().toISOString(),
        stage: entry.stage || 'progress',
        level: entry.level || 'info',
        message: entry.message || '',
        detail: entry.detail || null
    });
    operation.updatedAt = new Date().toISOString();
    if (operation.entries.length > 300) operation.entries.splice(0, operation.entries.length - 300);
}

function finishOperation(operation, status, message) {
    if (!operation) return;
    operation.status = status;
    operation.updatedAt = new Date().toISOString();
    operation.completedAt = new Date().toISOString();
    if (message) appendOperation(operation, {
        stage: status,
        level: status === 'completed' ? 'success' : 'error',
        message
    });
}

router.get('/operations/:id', (req, res) => {
    const operation = operationLogs.get(req.params.id);
    if (!operation) return res.status(404).json({ error: '备份任务日志不存在或已过期' });
    res.json(operation);
});

function scheduleProcessExitAfterRestore(res, source) {
    if (process.env.TOOLS_BACKUP_AUTO_EXIT_AFTER_RESTORE === 'false') return;
    res.on('finish', () => {
        console.log(`[GLOBAL BACKUP] Restore from ${source} completed. SQLite connections were closed for safe file replacement; exiting current process so it can be restarted cleanly.`);
        setTimeout(() => process.exit(0), 800);
    });
}

router.get('/list', (req, res) => {
    try {
        res.json({ backups: repo.listBackups(), targets: repo.DATA_TARGETS });
    } catch (err) {
        handleError(res, err, '获取备份列表失败');
    }
});

router.get('/schedule-settings', async (req, res) => {
    try {
        res.json(repo.getScheduleStatus(await repo.getScheduleSettings()));
    } catch (err) {
        handleError(res, err, '获取定时备份设置失败');
    }
});

router.put('/schedule-settings', async (req, res) => {
    try {
        res.json(await repo.saveScheduleSettings(req.body || {}));
    } catch (err) {
        handleError(res, err, '保存定时备份设置失败');
    }
});

router.post('/schedule-run', async (req, res) => {
    try {
        res.json(await repo.runScheduledBackup({ source: 'manual-trigger', reason: 'scheduled-auto-manual-trigger' }));
    } catch (err) {
        handleError(res, err, '执行定时备份失败');
    }
});

router.post('/create', async (req, res) => {
    const operation = startOperation(req, 'create');
    try {
        appendOperation(operation, { stage: 'start', message: '收到创建备份请求' });
        const result = await repo.createBackup({
            reason: req.body?.reason || 'manual',
            onProgress: entry => appendOperation(operation, entry)
        });
        finishOperation(operation, 'completed', '备份任务完成');
        res.json(result);
    } catch (err) {
        finishOperation(operation, 'failed', err.message || '创建备份失败');
        handleError(res, err, '创建备份失败');
    }
});

router.get('/download/:name', (req, res) => {
    try {
        const filePath = repo.getBackupPath(req.params.name);
        res.download(filePath, path.basename(filePath));
    } catch (err) {
        handleError(res, err, '下载备份失败');
    }
});

router.delete('/delete/:name', (req, res) => {
    try {
        const result = repo.deleteBackup(req.params.name);
        res.json(result);
    } catch (err) {
        handleError(res, err, '删除备份失败');
    }
});

router.post('/restore/server/:name', async (req, res) => {
    const operation = startOperation(req, 'restore-server');
    try {
        appendOperation(operation, { stage: 'start', message: `准备恢复服务器备份：${req.params.name}` });
        const filePath = repo.getBackupPath(req.params.name);
        const result = await repo.restoreFromZip(filePath, {
            onProgress: entry => appendOperation(operation, entry)
        });
        finishOperation(operation, 'completed', '恢复任务完成，服务即将重启');
        scheduleProcessExitAfterRestore(res, `server backup ${req.params.name}`);
        res.json(result);
    } catch (err) {
        finishOperation(operation, 'failed', err.message || '恢复失败');
        handleError(res, err, '从服务器备份恢复失败');
    }
});

router.post('/restore/upload', upload.single('backup'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: '请上传备份包' });
    const operation = startOperation(req, 'restore-upload');
    try {
        appendOperation(operation, {
            stage: 'upload-received',
            message: `备份包上传完成：${req.file.originalname || req.file.filename}`,
            detail: { size: req.file.size }
        });
        const result = await repo.restoreFromZip(req.file.path, {
            onProgress: entry => appendOperation(operation, entry)
        });
        finishOperation(operation, 'completed', '恢复任务完成，服务即将重启');
        scheduleProcessExitAfterRestore(res, `uploaded backup ${req.file.originalname || req.file.filename}`);
        res.json(result);
    } catch (err) {
        finishOperation(operation, 'failed', err.message || '恢复失败');
        handleError(res, err, '从上传备份包恢复失败');
    } finally {
        fs.rmSync(req.file.path, { force: true });
    }
});

router.get('/remote-settings', (req, res) => {
    try {
        res.json(remoteRepo.getPublicSettings());
    } catch (err) {
        handleError(res, err, '获取远端备份同步设置失败');
    }
});

router.put('/remote-settings', (req, res) => {
    try {
        res.json(remoteRepo.saveSettings(req.body || {}));
    } catch (err) {
        handleError(res, err, '保存远端备份同步设置失败');
    }
});

router.post('/remote-check', async (req, res) => {
    try {
        const result = await remoteRepo.pullRemoteBackup({
            restore: false,
            force: true,
            createRemoteBackupBeforePull: false
        });
        res.json(result);
    } catch (err) {
        handleError(res, err, '检查远端备份失败');
    }
});

router.post('/remote-pull', async (req, res) => {
    try {
        const result = await remoteRepo.pullRemoteBackup({
            restore: req.body?.restore !== false,
            force: Boolean(req.body?.force)
        });
        if (result.restored) scheduleProcessExitAfterRestore(res, `remote backup ${result.latest?.name || '-'}`);
        res.json(result);
    } catch (err) {
        handleError(res, err, '拉取远端备份失败');
    }
});

module.exports = router;
