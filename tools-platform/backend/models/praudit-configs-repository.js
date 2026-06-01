const { db, run, all, get } = require('./app-db');

class PRAuditConfigsRepository {
    async init() {
        const sql = `
            CREATE TABLE IF NOT EXISTS praudit_configs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                fields TEXT NOT NULL,
                checkpoints TEXT NOT NULL,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;
        await run(sql);
        
        // Add migration for reportFields
        try {
            await run(`ALTER TABLE praudit_configs ADD COLUMN reportFields TEXT DEFAULT '[]'`);
        } catch (e) {
            // ignore if exists
        }
        
        // Check if there are any configs, if not, create the default RC template
        const countRow = await get(`SELECT COUNT(*) as count FROM praudit_configs`);
        if (countRow.count === 0) {
            const defaultId = 'rc_audit_default';
            const defaultName = 'RC 整改单审计 (内置)';
            const defaultFields = JSON.stringify([
                "任务号", "索引号", "整改通知中文ID", "整改通知英文ID", "整改通知中文链接", "整改通知英文链接", 
                "标题", "运营商名称", "产品域", "任务状态", "处理人", "是否延期", "延期原因", "延期审批状态", 
                "延期审批人", "延期后计划完成时间", "产品存量", "决策不实施数", "排查完成时间", "延期申请备注", 
                "累计延期天数", "延期审批时间", "累计延期次数", "历史责任人", "延期备案方式"
            ]);
            const defaultCheckpoints = JSON.stringify([
                { key: 'c1', name: "① 书面证据", nameEn: "Written Evidence", desc: "客户确切回复", descEn: "Explicit customer reply" },
                { key: 'c2', name: "② 产品名称", nameEn: "Product Name", desc: "附件明确包含", descEn: "Clearly included in attachment" },
                { key: 'c3', name: "③ 数量", nameEn: "Quantity", desc: "附件明确包含", descEn: "Clearly included in attachment" },
                { key: 'c4', name: "④ 延期时间", nameEn: "Extension Time", desc: "明确时间", descEn: "Explicit time" },
                { key: 'c5', name: "⑤ 风险传递", nameEn: "Risk Transfer", desc: "邮件明确风险", descEn: "Risk clearly stated in email" },
                { key: 'c6', name: "⑥ 有效性核实", nameEn: "Validity Verification", desc: "客户邮箱/签字", descEn: "Customer email/signature" },
                { key: 'c7', name: "⑦ 高层审批", nameEn: "Executive Approval", desc: "交付部长审批", descEn: "Delivery Dept. Head approval" }
            ]);
            const defaultReportFields = JSON.stringify(["标题", "处理人", "任务状态", "是否延期"]);

            await run(`
                INSERT INTO praudit_configs (id, name, fields, checkpoints, reportFields)
                VALUES (?, ?, ?, ?, ?)
            `, [defaultId, defaultName, defaultFields, defaultCheckpoints, defaultReportFields]);
            console.log("Initialized default PR Audit config.");
        }
    }

    async getAll() {
        const rows = await all(`SELECT * FROM praudit_configs ORDER BY createdAt ASC`);
        return rows.map(r => ({
            id: r.id,
            name: r.name,
            fields: JSON.parse(r.fields),
            checkpoints: JSON.parse(r.checkpoints),
            reportFields: r.reportFields ? JSON.parse(r.reportFields) : [],
            createdAt: r.createdAt,
            updatedAt: r.updatedAt
        }));
    }

    async getById(id) {
        const row = await get(`SELECT * FROM praudit_configs WHERE id = ?`, [id]);
        if (!row) return null;
        return {
            id: row.id,
            name: row.name,
            fields: JSON.parse(row.fields),
            checkpoints: JSON.parse(row.checkpoints),
            reportFields: row.reportFields ? JSON.parse(row.reportFields) : [],
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        };
    }

    async save(config) {
        const { id, name, fields, checkpoints, reportFields } = config;
        const rfString = JSON.stringify(reportFields || []);
        
        const existing = await get(`SELECT id FROM praudit_configs WHERE id = ?`, [id]);
        if (existing) {
            await run(`
                UPDATE praudit_configs 
                SET name = ?, fields = ?, checkpoints = ?, reportFields = ?, updatedAt = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [name, JSON.stringify(fields), JSON.stringify(checkpoints), rfString, id]);
            return this.getById(id);
        } else {
            await run(`
                INSERT INTO praudit_configs (id, name, fields, checkpoints, reportFields)
                VALUES (?, ?, ?, ?, ?)
            `, [id, name, JSON.stringify(fields), JSON.stringify(checkpoints), rfString]);
            return this.getById(id);
        }
    }

    async delete(id) {
        await run(`DELETE FROM praudit_configs WHERE id = ?`, [id]);
    }
}

module.exports = new PRAuditConfigsRepository();
