const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const repo = require('../models/global-backup-repository');

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
        res.json(result);
    } catch (err) {
        handleError(res, err, '从服务器备份恢复失败');
    }
});

router.post('/restore/upload', upload.single('backup'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: '请上传备份包' });
    try {
        const result = await repo.restoreFromZip(req.file.path);
        res.json(result);
    } catch (err) {
        handleError(res, err, '从上传备份包恢复失败');
    } finally {
        fs.rmSync(req.file.path, { force: true });
    }
});

module.exports = router;
