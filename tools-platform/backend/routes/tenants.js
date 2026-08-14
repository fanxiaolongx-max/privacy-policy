const express = require('express');
const path = require('path');
const tenantsRepo = require('../models/tenants-repository');
const sessionsRepo = require('../models/auth-sessions-repository');
const customToolsRepo = require('../models/custom-tools-repository');
const { initializeBuiltinTools } = require('../models/builtin-tools-sync');
const { getDataDir, runWithTenant } = require('../models/tenant-context');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const includeArchived = ['1', 'true'].includes(String(req.query.includeArchived || '').toLowerCase());
        if (includeArchived && req.user.role !== 'admin') return res.status(403).json({ error: '仅管理员可查看已归档租户' });
        const tenants = includeArchived
            ? await tenantsRepo.listManagedTenants()
            : await tenantsRepo.listTenantsForUser(req.user.username, req.user.role);
        res.json({ tenants, activeTenantId: req.user.tenantId || tenantsRepo.DEFAULT_TENANT_ID });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message || '读取租户失败' });
    }
});

router.post('/switch', async (req, res) => {
    try {
        const tenantId = String(req.body?.tenantId || '').trim().toLowerCase();
        if (!await tenantsRepo.canAccess(req.user.username, req.user.role, tenantId)) {
            return res.status(403).json({ error: '无权访问该租户' });
        }
        await runWithTenant(tenantId, async () => {
            const dataDir = getDataDir();
            initializeBuiltinTools({
                sourceDir: customToolsRepo.BUILTIN_TOOLS_DIR,
                targetDir: customToolsRepo.getCustomToolsDir(),
                stateFile: path.join(dataDir, 'builtin-tools-sync-decisions.json'),
                backupRoot: path.join(dataDir, 'backups', 'builtin-tools')
            });
            await customToolsRepo.reconcileToolsFromDisk();
        });
        await sessionsRepo.setActiveTenant(req.authToken, tenantId);
        res.json({ success: true, tenantId });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message || '切换租户失败' });
    }
});

router.post('/', async (req, res) => {
    try { res.status(201).json(await tenantsRepo.createTenant(req.body || {})); }
    catch (error) { res.status(error.statusCode || 500).json({ error: error.message || '创建租户失败' }); }
});

router.put('/:id', async (req, res) => {
    try { res.json(await tenantsRepo.updateTenant(req.params.id, req.body || {})); }
    catch (error) { res.status(error.statusCode || 500).json({ error: error.message || '更新租户失败' }); }
});

router.delete('/:id', async (req, res) => {
    try { res.json(await tenantsRepo.archiveTenant(req.params.id)); }
    catch (error) { res.status(error.statusCode || 500).json({ error: error.message || '归档租户失败' }); }
});

router.post('/:id/restore', async (req, res) => {
    try { res.json(await tenantsRepo.restoreTenant(req.params.id)); }
    catch (error) { res.status(error.statusCode || 500).json({ error: error.message || '恢复租户失败' }); }
});

router.delete('/:id/permanent', async (req, res) => {
    try { res.json(await tenantsRepo.deleteTenantPermanently(req.params.id)); }
    catch (error) { res.status(error.statusCode || 500).json({ error: error.message || '彻底删除租户失败' }); }
});

module.exports = router;
