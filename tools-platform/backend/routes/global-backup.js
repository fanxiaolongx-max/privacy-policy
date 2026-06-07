const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const repo = require('../models/global-backup-repository');
const remoteRepo = require('../models/remote-backup-sync-repository');

const router = express.Router();
const uploadDir = path.join(__dirname, '../tmp/uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
    dest: uploadDir,
    limits: { fileSize: 1024 * 1024 * 1024 }
});

function handleError(res, err, fallback) {
    res.status(err.statusCode || 500).json({ error: err.message || fallback });
}

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

router.post('/create', async (req, res) => {
    try {
        const result = await repo.createBackup({ reason: req.body?.reason || 'manual' });
        res.json(result);
    } catch (err) {
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

router.post('/restore/server/:name', async (req, res) => {
    try {
        const filePath = repo.getBackupPath(req.params.name);
        const result = await repo.restoreFromZip(filePath);
        scheduleProcessExitAfterRestore(res, `server backup ${req.params.name}`);
        res.json(result);
    } catch (err) {
        handleError(res, err, '从服务器备份恢复失败');
    }
});

router.post('/restore/upload', upload.single('backup'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: '请上传备份包' });
    try {
        const result = await repo.restoreFromZip(req.file.path);
        scheduleProcessExitAfterRestore(res, `uploaded backup ${req.file.originalname || req.file.filename}`);
        res.json(result);
    } catch (err) {
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
