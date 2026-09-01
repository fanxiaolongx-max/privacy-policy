const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const repo = require('../models/chat-history-repository');
const { getDataDir } = require('../models/store');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

function currentUser(req) {
    return String(req.user && req.user.username || '').trim() || 'unknown';
}

function importTempDir() {
    const dir = path.join(getDataDir(), 'tmp', 'chat-history-imports');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

const upload = multer({
    storage: multer.diskStorage({
        destination(_req, _file, callback) {
            callback(null, importTempDir());
        },
        filename(_req, file, callback) {
            callback(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]+/g, '_')}`);
        }
    }),
    limits: { fileSize: 100 * 1024 * 1024, files: 100, fields: 20 },
    fileFilter(_req, file, callback) {
        callback(null, /\.txt$/i.test(file.originalname));
    }
});

function asyncRoute(handler) {
    return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

router.get('/settings', asyncRoute(async (req, res) => {
    const settings = await repo.getUserSettings(currentUser(req));
    res.json({ mySenderId: settings.my_sender_id || '', updatedAt: settings.updated_at || null });
}));

router.put('/settings', asyncRoute(async (req, res) => {
    res.json({ success: true, ...(await repo.saveUserSettings(currentUser(req), req.body || {})) });
}));

router.get('/conversations', asyncRoute(async (req, res) => {
    res.json(await repo.listConversations(currentUser(req), req.query || {}));
}));

router.get('/conversations/:conversationId', asyncRoute(async (req, res) => {
    const item = await repo.getConversation(req.params.conversationId, currentUser(req));
    if (!item) return res.status(404).json({ error: '会话不存在' });
    res.json(item);
}));

router.get('/conversations/:conversationId/messages', asyncRoute(async (req, res) => {
    if (!await repo.getConversation(req.params.conversationId, currentUser(req))) {
        return res.status(404).json({ error: '会话不存在' });
    }
    res.json(await repo.listMessages(req.params.conversationId, currentUser(req), req.query || {}));
}));

router.put('/conversations/:conversationId/read', asyncRoute(async (req, res) => {
    const result = await repo.markRead(currentUser(req), req.params.conversationId);
    if (!result) return res.status(404).json({ error: '会话不存在' });
    res.json({ success: true, ...result });
}));

router.put('/conversations/:conversationId/pin', asyncRoute(async (req, res) => {
    const result = await repo.setPinned(currentUser(req), req.params.conversationId, req.body && req.body.pinned === true);
    if (!result) return res.status(404).json({ error: '会话不存在' });
    res.json({ success: true, ...result });
}));

router.put('/favorites/:stableKey', asyncRoute(async (req, res) => {
    const result = await repo.setFavorite(currentUser(req), req.params.stableKey, req.body && req.body.favorite === true);
    if (!result) return res.status(404).json({ error: '消息不存在' });
    res.json({ success: true, ...result });
}));

router.get('/search', asyncRoute(async (req, res) => {
    res.json(await repo.searchMessages(currentUser(req), req.query || {}));
}));

router.get('/stats/overview', asyncRoute(async (req, res) => {
    res.json(await repo.getOverviewStats(currentUser(req)));
}));

router.get('/stats/people', asyncRoute(async (req, res) => {
    res.json(await repo.getPeopleStats(currentUser(req), req.query || {}));
}));

router.get('/stats/unidentified', asyncRoute(async (req, res) => {
    res.json(await repo.getUnidentifiedMessages(req.query || {}));
}));

router.get('/directory', asyncRoute(async (req, res) => {
    res.json(await repo.listPersonDirectory(req.query || {}));
}));

router.put('/directory/:senderId', requireAdmin, asyncRoute(async (req, res) => {
    res.json(await repo.updatePersonDirectory(req.params.senderId, req.body || {}));
}));

router.get('/sources', requireAdmin, asyncRoute(async (_req, res) => {
    res.json(await repo.listSources());
}));

router.post('/sources/clear-test-data', requireAdmin, asyncRoute(async (_req, res) => {
    res.json(await repo.deleteTestDataSources());
}));

router.post('/sources/clear-all', requireAdmin, asyncRoute(async (_req, res) => {
    res.json(await repo.deleteAllSources());
}));

router.post('/import', requireAdmin, upload.array('files', 100), asyncRoute(async (req, res) => {
    const uploadedFiles = Array.isArray(req.files) ? req.files : [];
    const removeUploadedFiles = () => uploadedFiles.forEach(file => fs.rmSync(file.path, { force: true }));
    let relativePaths = [];
    let modifiedAts = [];
    try {
        relativePaths = JSON.parse(String(req.body && req.body.relativePaths || '[]'));
        modifiedAts = JSON.parse(String(req.body && req.body.modifiedAts || '[]'));
    } catch (_error) {
        removeUploadedFiles();
        return res.status(400).json({ error: '导入文件清单无效' });
    }
    if (!uploadedFiles.length) return res.status(400).json({ error: '未选择 TXT 文件' });
    if (!Array.isArray(relativePaths) || relativePaths.length !== uploadedFiles.length) {
        removeUploadedFiles();
        return res.status(400).json({ error: '相对路径数量与文件数量不一致' });
    }

    const results = [];
    const errors = [];
    try {
        for (let index = 0; index < uploadedFiles.length; index += 1) {
            const file = uploadedFiles[index];
            try {
                results.push(await repo.importTxtFile({
                    filePath: file.path,
                    originalName: file.originalname,
                    relativePath: relativePaths[index],
                    modifiedAt: Number(modifiedAts[index] || 0)
                }));
            } catch (error) {
                errors.push({ relativePath: relativePaths[index], error: error.message || '导入失败' });
            }
        }
    } finally {
        removeUploadedFiles();
    }
    res.status(errors.length && !results.length ? 400 : 200).json({
        success: errors.length === 0,
        imported: results.filter(item => !item.skipped).length,
        skipped: results.filter(item => item.skipped).length,
        results,
        errors
    });
}));

router.delete('/sources/:sourceId', requireAdmin, asyncRoute(async (req, res) => {
    const source = await repo.deleteSource(req.params.sourceId);
    if (!source) return res.status(404).json({ error: '数据源不存在' });
    res.json({ success: true, source });
}));

router.use((error, _req, res, _next) => {
    if (error instanceof multer.MulterError) {
        return res.status(400).json({ error: `导入文件不符合限制：${error.message}` });
    }
    console.error('[chat-history]', error);
    res.status(error.status || 500).json({ error: error.message || '聊天记录服务异常' });
});

module.exports = router;
