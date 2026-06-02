const express = require('express');
const router = express.Router();
const repo = require('../models/praudit-configs-repository');
const crypto = require('crypto');

function logPRAuditConfigSave(message, payload = null) {
    const prefix = '[PR Audit Config API]';
    if (payload === null || payload === undefined) console.log(prefix, message);
    else console.log(prefix, message, payload);
}

router.get('/configs', async (req, res) => {
    try {
        const configs = await repo.getAll();
        res.json(configs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/configs', async (req, res) => {
    try {
        const { id, name, fields, allFields, checkpoints, reportFields, groupField, filterRules, reasonTemplates } = req.body;
        
        if (!name || !fields || !checkpoints) {
            return res.status(400).json({ error: "Missing required fields: name, fields, or checkpoints" });
        }
        
        const configId = id || 'audit_' + crypto.randomBytes(8).toString('hex');
        
        const config = {
            id: configId,
            name,
            fields,
            allFields: allFields || fields,
            checkpoints,
            reportFields: reportFields || [],
            groupField: groupField || '',
            filterRules: filterRules || [],
            reasonTemplates: reasonTemplates || []
        };

        logPRAuditConfigSave('收到模板保存请求', {
            id: configId,
            name,
            fieldCount: Array.isArray(fields) ? fields.length : -1,
            allFieldCount: Array.isArray(allFields) ? allFields.length : Array.isArray(fields) ? fields.length : -1,
            checkpointCount: Array.isArray(checkpoints) ? checkpoints.length : -1,
            reportFieldCount: Array.isArray(reportFields) ? reportFields.length : 0,
            groupField: groupField || '',
            filterRuleCount: Array.isArray(filterRules) ? filterRules.length : 0,
            reasonTemplateCount: Array.isArray(reasonTemplates) ? reasonTemplates.length : 0,
            fields: Array.isArray(fields) ? fields : fields,
            allFields: Array.isArray(allFields) ? allFields : allFields
        });
        
        const saved = await repo.save(config);
        logPRAuditConfigSave('模板保存完成并自动回查', {
            id: saved.id,
            name: saved.name,
            fieldCount: Array.isArray(saved.fields) ? saved.fields.length : -1,
            allFieldCount: Array.isArray(saved.allFields) ? saved.allFields.length : -1,
            checkpointCount: Array.isArray(saved.checkpoints) ? saved.checkpoints.length : -1,
            reportFieldCount: Array.isArray(saved.reportFields) ? saved.reportFields.length : 0,
            groupField: saved.groupField || '',
            filterRuleCount: Array.isArray(saved.filterRules) ? saved.filterRules.length : 0,
            fields: saved.fields || [],
            allFields: saved.allFields || []
        });
        res.json(saved);
    } catch (error) {
        logPRAuditConfigSave('模板保存失败', {
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: error.message });
    }
});

router.delete('/configs/:id', async (req, res) => {
    try {
        const id = req.params.id;
        await repo.delete(id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Initialize DB on route load
repo.init().catch(console.error);

module.exports = router;
