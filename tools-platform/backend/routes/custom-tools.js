const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const repo = require('../models/custom-tools-repository');
const backupRepo = require('../models/custom-tools-backup-repository');
const historyRepo = require('../models/upload-history-repository');
const { DATA_DIR } = require('../models/store');

const backupUploadDir = path.join(DATA_DIR, '../tmp/custom-tool-backups');
fs.mkdirSync(backupUploadDir, { recursive: true });
const backupUpload = multer({
    dest: backupUploadDir,
    limits: { fileSize: 512 * 1024 * 1024, files: 1 }
});

router.get('/', async (req, res) => {
    res.json(await repo.listTools());
});

router.get('/backup/summary', async (req, res) => {
    try {
        res.json(await backupRepo.getBackupSummary());
    } catch (err) {
        res.status(500).json({ error: err.message || '读取自定义工具备份清单失败' });
    }
});

router.post('/backup/export', (req, res, next) => {
    // The request may contain a custom tool's browser-local data. Never print it
    // through the generic error-body logger when an export fails.
    req.suppressBodyLog = true;
    next();
}, async (req, res) => {
    try {
        const result = await backupRepo.createBackup({
            slugs: req.body && req.body.slugs,
            browserState: req.body && req.body.browserState
        });
        historyRepo.addHistory({
            tool: 'custom',
            action: '导出自定义工具备份',
            detail: `${result.manifest.toolCount} 个工具 / ${result.manifest.totalFiles} 个文件`
        }).catch(err => console.error('[custom-tools] log backup export failed:', err.message));
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.setHeader('Content-Length', result.buffer.length);
        res.send(result.buffer);
    } catch (err) {
        res.status(err.status || 400).json({ error: err.message || '导出自定义工具备份失败' });
    }
});

router.post('/backup/restore', backupUpload.single('backup'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: '请上传自定义工具备份 ZIP' });
    try {
        const result = await backupRepo.restoreBackup(fs.readFileSync(req.file.path), {
            conflictStrategy: req.body && req.body.conflictStrategy
        });
        historyRepo.addHistory({
            tool: 'custom',
            action: '恢复自定义工具备份',
            detail: `恢复 ${result.restored.length} 个，跳过 ${result.skipped.length} 个`
        }).catch(err => console.error('[custom-tools] log backup restore failed:', err.message));
        res.json(result);
    } catch (err) {
        res.status(err.status || 400).json({ error: err.message || '恢复自定义工具备份失败' });
    } finally {
        fs.rmSync(req.file.path, { force: true });
    }
});

router.get('/:slug/state', async (req, res) => {
    const state = await repo.getToolState(req.params.slug);
    if (!state) return res.status(404).json({ error: '自定义工具不存在' });
    res.json(state);
});

router.put('/:slug/state', async (req, res) => {
    try {
        const state = await repo.saveToolState(req.params.slug, req.body && req.body.data, {
            reason: req.body && req.body.reason,
            createSnapshot: req.body && req.body.createSnapshot !== false
        });
        if (!state) return res.status(404).json({ error: '自定义工具不存在' });
        res.json({ success: true, updatedAt: state.updatedAt, snapshots: state.snapshots.map(({ data, ...item }) => item) });
    } catch (err) {
        res.status(400).json({ error: err.message || '保存日程失败' });
    }
});

router.get('/:slug/snapshots', async (req, res) => {
    const state = await repo.getToolState(req.params.slug);
    if (!state) return res.status(404).json({ error: '自定义工具不存在' });
    res.json((state.snapshots || []).map(({ data, ...item }) => item));
});

router.post('/:slug/state/restore', async (req, res) => {
    const restored = await repo.restoreToolState(req.params.slug, req.body && req.body.snapshotId);
    if (restored === null) return res.status(404).json({ error: '自定义工具不存在' });
    if (restored === false) return res.status(404).json({ error: '备份快照不存在' });
    res.json({ success: true, data: restored.data, updatedAt: restored.updatedAt });
});

router.post('/', async (req, res) => {
    try {
        const tool = await repo.createTool(req.body || {});
        historyRepo.addHistory({
            tool: 'custom',
            action: '导入自定义工具',
            detail: `${tool.name} (${tool.slug})`
        }).catch(err => console.error('[custom-tools] log import history failed:', err.message));
        res.json({ success: true, tool });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message || '保存自定义工具失败' });
    }
});

router.patch('/:slug/access', async (req, res) => {
    try {
        const tool = await repo.updateToolAccess(req.params.slug, req.body && req.body.publicAccess);
        if (!tool) return res.status(404).json({ error: '自定义工具不存在' });
        res.json({ success: true, tool });
    } catch (err) {
        res.status(500).json({ error: err.message || '保存自定义工具访问权限失败' });
    }
});

router.patch('/:slug/name', async (req, res) => {
    try {
        const previous = await repo.getTool(req.params.slug);
        const tool = await repo.updateToolName(req.params.slug, req.body && req.body.name);
        if (!tool) return res.status(404).json({ error: '自定义工具不存在' });
        historyRepo.addHistory({
            tool: 'custom',
            action: '修改工具名称',
            detail: `${previous?.name || req.params.slug} → ${tool.name}`
        }).catch(err => console.error('[custom-tools] log rename history failed:', err.message));
        res.json({ success: true, tool });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message || '修改工具名称失败' });
    }
});

router.delete('/:slug', async (req, res) => {
    try {
        const tool = await repo.getTool(req.params.slug);
        const deleted = await repo.deleteTool(req.params.slug);
        if (!deleted) return res.status(404).json({ error: '自定义工具不存在' });
        historyRepo.addHistory({
            tool: 'custom',
            action: '删除自定义工具',
            detail: tool ? `${tool.name} (${tool.slug})` : req.params.slug
        }).catch(err => console.error('[custom-tools] log delete history failed:', err.message));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message || '删除自定义工具失败' });
    }
});

module.exports = router;
