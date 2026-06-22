const crypto = require('crypto');
const { run, get, all } = require('./app-db');

const FIELD_TYPES = new Set(['text', 'textarea', 'date', 'number', 'select', 'radio', 'checkbox']);

function makeId(prefix) {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function parseJson(value, fallback) {
    try {
        return JSON.parse(value);
    } catch (err) {
        return fallback;
    }
}

function normalizeOptions(options) {
    if (!Array.isArray(options)) return [];
    return options
        .map(option => {
            if (typeof option === 'string') {
                const text = option.trim();
                return text ? { label: text, value: text } : null;
            }
            const label = String(option && option.label || '').trim();
            const value = String(option && option.value || label).trim();
            return label && value ? { label, value } : null;
        })
        .filter(Boolean)
        .slice(0, 100);
}

function normalizeSuggestions(suggestions) {
    if (!Array.isArray(suggestions)) return [];
    return suggestions
        .map(group => {
            const category = String(group && group.category || '').trim();
            const items = Array.isArray(group && group.items)
                ? group.items.map(item => String(item || '').trim()).filter(Boolean).slice(0, 50)
                : [];
            return category && items.length ? { category, items } : null;
        })
        .filter(Boolean)
        .slice(0, 30);
}

function normalizeOrgChart(orgChart, options) {
    if (!Array.isArray(orgChart)) return [];
    const optionValues = new Set(options.map(option => option.value));
    const usedValues = new Set();
    return orgChart
        .map(node => {
            const value = String(node && node.value || '').trim();
            if (!value || !optionValues.has(value) || usedValues.has(value)) return null;
            usedValues.add(value);
            const parentValue = String(node && node.parentValue || '').trim();
            return {
                value,
                parentValue: parentValue && parentValue !== value && optionValues.has(parentValue) ? parentValue : ''
            };
        })
        .filter(Boolean);
}

function normalizeUrlValidation(validation) {
    if (!validation || validation.type !== 'url') return null;
    const domains = Array.isArray(validation.domains)
        ? validation.domains.map(domain => String(domain || '').trim().toLowerCase())
            .filter(Boolean).slice(0, 20)
        : [];
    return {
        type: 'url',
        allowNone: validation.allowNone !== false,
        noneValue: String(validation.noneValue || '无').trim() || '无',
        domains
    };
}

function managerOrgChart(options) {
    const findValue = patterns => {
        const option = options.find(item => patterns.some(pattern => pattern.test(item.label)));
        return option ? option.value : '';
    };
    const regionPresident = findValue([/Region President/i, /地区部总裁/, /地总/]);
    const vp = findValue([/^代表 \(VP\)$/i, /^VP$/i, /代表.*VP/i]);
    const deliveryVp = findValue([/交付VP/i, /Delivery VP/i]);
    const buDirector = findValue([/BU长/i, /BU Director/i]);
    const fr = findValue([/^FR$/i]);
    const csm = findValue([/^CSM/i]);
    const spm = findValue([/^SPM/i]);
    const ad = findValue([/^AD/i, /Account Director/i]);

    return [
        { value: regionPresident, parentValue: '' },
        { value: vp, parentValue: regionPresident },
        { value: deliveryVp, parentValue: vp },
        { value: buDirector, parentValue: vp },
        { value: fr, parentValue: deliveryVp },
        { value: csm, parentValue: deliveryVp },
        { value: spm, parentValue: deliveryVp },
        { value: ad, parentValue: buDirector }
    ].filter(node => node.value);
}

function customerOrgChart(options) {
    const findValue = patterns => {
        const option = options.find(item => patterns.some(pattern => pattern.test(item.label)));
        return option ? option.value : '';
    };
    const ceo = findValue([/^CEO$/i]);
    const cto = findValue([/^CTO$/i]);
    const gm = findValue([/^GM$/i]);
    const hod = findValue([/^HOD$/i]);
    const operationDirector = findValue([/运维总监/i, /O&M Director/i]);

    return [
        { value: ceo, parentValue: '' },
        { value: cto, parentValue: ceo },
        { value: gm, parentValue: ceo },
        { value: hod, parentValue: ceo },
        { value: operationDirector, parentValue: gm }
    ].filter(node => node.value);
}

function activityDescriptionSuggestions() {
    return [
        { category: '保障类（最常见）', items: [
            '{客户}{节日/事件}首日保障（{运营商1}/{运营商2}/{运营商3}）',
            '{客户}夏令时调整值守保障',
            '{客户} DST Major Operation Assurance'
        ] },
        { category: '故障恢复类', items: [
            'P1{故障描述}故障恢复保障',
            '{客户}{设备}{故障描述}故障恢复保障',
            '{客户}VIP站点紧急抢修恢复保障'
        ] },
        { category: '高层对标类', items: [
            '会见{客户} CTO，汇报{项目}保障结果',
            '地总与{客户}客户高层对标（{主题}）',
            '{客户} CEO/CTO高层对标 - {人员}（含服务主题）'
        ] },
        { category: '例会/汇报类', items: [
            'X月 CNBG/EBG网络安全大会，主管讲安全',
            '{客户}客户月度维护例会汇报'
        ] },
        { category: 'Summit/Drilling类', items: [
            '{客户} Service Summit',
            '{客户} {领域} Drilling Summary'
        ] }
    ];
}

function normalizeFields(fields) {
    if (!Array.isArray(fields) || fields.length === 0) {
        const err = new Error('模板至少需要一个字段');
        err.status = 400;
        throw err;
    }

    const usedKeys = new Set();
    return fields.slice(0, 100).map((field, index) => {
        const label = String(field && field.label || '').trim();
        if (!label) {
            const err = new Error(`第 ${index + 1} 个字段缺少名称`);
            err.status = 400;
            throw err;
        }

        let key = String(field.key || '')
            .trim()
            .replace(/[^a-zA-Z0-9_-]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 64);
        if (!key) key = `field_${index + 1}`;
        const baseKey = key;
        let suffix = 2;
        while (usedKeys.has(key)) key = `${baseKey}_${suffix++}`;
        usedKeys.add(key);

        const type = FIELD_TYPES.has(field.type) ? field.type : 'text';
        const options = normalizeOptions(field.options);
        if (['select', 'radio', 'checkbox'].includes(type) && options.length === 0) {
            const err = new Error(`字段“${label}”至少需要一个选项`);
            err.status = 400;
            throw err;
        }

        const orgChart = normalizeOrgChart(field.orgChart, options);
        return {
            id: String(field.id || makeId('field')),
            key,
            label,
            exportLabel: String(field.exportLabel || '').trim().slice(0, 200),
            description: String(field.description || '').trim().slice(0, 500),
            type,
            required: Boolean(field.required),
            placeholder: String(field.placeholder || '').trim().slice(0, 200),
            defaultValue: field.defaultValue === undefined ? '' : field.defaultValue,
            width: field.width === 'half' ? 'half' : 'full',
            display: ['cards', 'orgchart'].includes(field.display) ? field.display : 'standard',
            min: field.min === '' || field.min === undefined ? null : Number(field.min),
            max: field.max === '' || field.max === undefined ? null : Number(field.max),
            options,
            suggestions: normalizeSuggestions(field.suggestions),
            orgChart,
            validation: normalizeUrlValidation(field.validation)
        };
    });
}

function mapTemplate(row) {
    return {
        id: row.id,
        name: row.name,
        description: row.description || '',
        fields: parseJson(row.fields, []),
        active: Boolean(row.active),
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function defaultTemplates() {
    const managerOptions = ['代表 (VP)', 'BU长 (BU Director)', 'AD (Account Director)', '交付VP (Delivery VP)', 'FR', 'BU主管 (BU Manager)', 'CSM', 'SPM', 'BG长 (BG Director)', 'VP (Region President)'];
    const customerOptions = ['CTO', '运维总监', '部门维护主管', 'CEO', 'HOD', 'GM', '无'];
    const sharedFields = [
        {
            key: 'activityDesc', label: '活动描述', description: 'Activity Description', type: 'textarea',
            required: true, width: 'full', placeholder: '可选择推荐模板，也可以自由输入',
            suggestions: activityDescriptionSuggestions()
        },
        { key: 'activityDate', label: '活动日期', description: 'Activity Date', type: 'date', required: true, width: 'half' },
        {
            key: 'managerRoles', label: '参加主管', description: '可多选', type: 'checkbox', required: true, display: 'orgchart', width: 'full',
            options: managerOptions,
            orgChart: managerOrgChart(normalizeOptions(managerOptions))
        },
        {
            key: 'materialArchive', label: '素材归档目录', type: 'text', required: true,
            defaultValue: '无', width: 'full',
            validation: { type: 'url', allowNone: true, noneValue: '无', domains: ['onebox.huawei.com'] }
        },
        {
            key: 'networkSafety', label: '涉及网络平安内容', type: 'radio', required: true, display: 'cards', width: 'half',
            options: ['是', '否']
        },
        {
            key: 'jamLink', label: 'JAM链接', type: 'text', required: true,
            defaultValue: '无', width: 'half',
            validation: { type: 'url', allowNone: true, noneValue: '无', domains: ['3ms.huawei.com'] }
        },
        {
            key: 'customerRoles', label: '卷入客户角色', type: 'checkbox', display: 'orgchart', width: 'full',
            options: customerOptions,
            orgChart: customerOrgChart(normalizeOptions(customerOptions))
        }
    ];

    return [
        ['maintenance', '与客户的维护活动', 'Maintenance Activities with Customers'],
        ['communication', '与维护人员的面对面沟通', 'Face-to-face Communication with Staff'],
        ['recovery', '网络故障的恢复支持', 'Network Fault Recovery Support'],
        ['supervision', '重大变更的现场督导', 'Major Changes Onsite Supervision'],
        ['drill', '与客户应急预案的实操演练', 'Emergency Drill with Customers'],
        ['declaration', '代表处网络安全宣誓', 'Network Safety Declaration']
    ].map(([id, name, description]) => ({
        id,
        name,
        description,
        fields: sharedFields
    }));
}

let initPromise = null;
async function ensureReady() {
    if (!initPromise) {
        initPromise = (async () => {
            await run(`
                CREATE TABLE IF NOT EXISTS survey_templates (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT '',
                    fields TEXT NOT NULL,
                    active INTEGER NOT NULL DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await run(`
                CREATE TABLE IF NOT EXISTS survey_submissions (
                    id TEXT PRIMARY KEY,
                    template_id TEXT NOT NULL,
                    template_name TEXT NOT NULL,
                    answers TEXT NOT NULL,
                    submitted_by TEXT DEFAULT '',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            try {
                await run('ALTER TABLE survey_submissions ADD COLUMN updated_at DATETIME');
                await run('UPDATE survey_submissions SET updated_at = created_at WHERE updated_at IS NULL');
            } catch (err) {
                if (!/duplicate column/i.test(err.message)) throw err;
            }
            await run('CREATE INDEX IF NOT EXISTS idx_survey_submissions_template ON survey_submissions(template_id, created_at DESC)');

            const row = await get('SELECT COUNT(1) AS count FROM survey_templates');
            if (!row || row.count === 0) {
                for (const template of defaultTemplates()) {
                    await run(
                        `INSERT INTO survey_templates (id, name, description, fields) VALUES (?, ?, ?, ?)`,
                        [template.id, template.name, template.description, JSON.stringify(normalizeFields(template.fields))]
                    );
                }
            } else {
                const rows = await all('SELECT id, fields FROM survey_templates');
                for (const templateRow of rows) {
                    const fields = parseJson(templateRow.fields, []);
                    let changed = false;
                    for (const field of fields) {
                        if (field.key === 'activityDesc' && (!Array.isArray(field.suggestions) || field.suggestions.length === 0)) {
                            field.suggestions = activityDescriptionSuggestions();
                            field.placeholder = field.placeholder || '可选择推荐模板，也可以自由输入';
                            changed = true;
                        }
                        if (field.key === 'managerRoles' && (!Array.isArray(field.orgChart) || field.orgChart.length === 0)) {
                            const options = normalizeOptions(field.options);
                            field.display = 'orgchart';
                            field.orgChart = managerOrgChart(options);
                            changed = true;
                        }
                        if (field.key === 'customerRoles' && (!Array.isArray(field.orgChart) || field.orgChart.length === 0)) {
                            const options = normalizeOptions(field.options);
                            field.display = 'orgchart';
                            field.orgChart = customerOrgChart(options);
                            changed = true;
                        }
                        if (field.key === 'materialArchive' && (!field.validation || field.validation.type !== 'url')) {
                            field.validation = { type: 'url', allowNone: true, noneValue: '无', domains: ['onebox.huawei.com'] };
                            changed = true;
                        }
                        if (field.key === 'jamLink' && (!field.validation || field.validation.type !== 'url')) {
                            field.validation = { type: 'url', allowNone: true, noneValue: '无', domains: ['3ms.huawei.com'] };
                            changed = true;
                        }
                    }
                    if (changed) {
                        await run(
                            'UPDATE survey_templates SET fields = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                            [JSON.stringify(normalizeFields(fields)), templateRow.id]
                        );
                    }
                }
            }
        })().catch(err => {
            initPromise = null;
            throw err;
        });
    }
    return initPromise;
}

async function listTemplates() {
    await ensureReady();
    const rows = await all('SELECT * FROM survey_templates ORDER BY created_at ASC');
    return rows.map(mapTemplate);
}

async function getTemplate(id) {
    await ensureReady();
    const row = await get('SELECT * FROM survey_templates WHERE id = ?', [id]);
    return row ? mapTemplate(row) : null;
}

async function saveTemplate(payload) {
    await ensureReady();
    const name = String(payload.name || '').trim();
    if (!name) {
        const err = new Error('模板名称不能为空');
        err.status = 400;
        throw err;
    }
    const id = String(payload.id || makeId('survey')).trim().replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 64);
    const fields = normalizeFields(payload.fields);
    const existing = await get('SELECT id FROM survey_templates WHERE id = ?', [id]);
    if (existing) {
        await run(
            `UPDATE survey_templates
             SET name = ?, description = ?, fields = ?, active = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [name, String(payload.description || '').trim(), JSON.stringify(fields), payload.active === false ? 0 : 1, id]
        );
    } else {
        await run(
            `INSERT INTO survey_templates (id, name, description, fields, active) VALUES (?, ?, ?, ?, ?)`,
            [id, name, String(payload.description || '').trim(), JSON.stringify(fields), payload.active === false ? 0 : 1]
        );
    }
    return getTemplate(id);
}

async function deleteTemplate(id) {
    await ensureReady();
    const result = await run('DELETE FROM survey_templates WHERE id = ?', [id]);
    return result.changes > 0;
}

function validateAnswers(template, answers) {
    const normalized = {};
    for (const field of template.fields) {
        const value = answers ? answers[field.key] : undefined;
        const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
        if (field.required && empty) {
            const err = new Error(`请填写“${field.label}”`);
            err.status = 400;
            throw err;
        }
        if (!empty && field.validation && field.validation.type === 'url') {
            const textValue = String(value).trim();
            const isNone = field.validation.allowNone && textValue === field.validation.noneValue;
            if (!isNone) {
                let parsed;
                try {
                    parsed = new URL(textValue);
                } catch (parseErr) {
                    const err = new Error(`“${field.label}”必须填写完整的网址链接`);
                    err.status = 400;
                    throw err;
                }
                if (parsed.protocol !== 'https:') {
                    const err = new Error(`“${field.label}”必须使用 HTTPS 链接`);
                    err.status = 400;
                    throw err;
                }
                const domains = Array.isArray(field.validation.domains) ? field.validation.domains : [];
                const hostname = parsed.hostname.toLowerCase();
                const allowed = domains.length === 0 || domains.some(domain =>
                    hostname === domain || hostname.endsWith(`.${domain}`)
                );
                if (!allowed) {
                    const err = new Error(`“${field.label}”必须使用指定域名：${domains.join('、')}`);
                    err.status = 400;
                    throw err;
                }
            }
        }
        if (field.type === 'checkbox') {
            normalized[field.key] = Array.isArray(value) ? Array.from(new Set(value.map(String))).slice(0, 100) : [];
        } else if (field.type === 'number' && !empty) {
            const numberValue = Number(value);
            if (!Number.isFinite(numberValue)) {
                const err = new Error(`“${field.label}”必须是有效数字`);
                err.status = 400;
                throw err;
            }
            normalized[field.key] = numberValue;
        } else {
            normalized[field.key] = empty ? '' : String(value).slice(0, 20000);
        }
    }
    return normalized;
}

async function createSubmission(payload, username) {
    await ensureReady();
    const template = await getTemplate(String(payload.templateId || ''));
    if (!template || !template.active) {
        const err = new Error('调查模板不存在或已停用');
        err.status = 404;
        throw err;
    }
    const answers = validateAnswers(template, payload.answers || {});
    const id = makeId('submission');
    await run(
        `INSERT INTO survey_submissions (id, template_id, template_name, answers, submitted_by)
         VALUES (?, ?, ?, ?, ?)`,
        [id, template.id, template.name, JSON.stringify(answers), String(username || '')]
    );
    return { id, templateId: template.id, templateName: template.name, submittedBy: username || '', createdAt: new Date().toISOString() };
}

function mapSubmission(row) {
    return {
        id: row.id,
        templateId: row.template_id,
        templateName: row.template_name,
        answers: parseJson(row.answers, {}),
        submittedBy: row.submitted_by || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at || row.created_at
    };
}

async function listSubmissions({ templateId = '', limit = 100 } = {}) {
    await ensureReady();
    const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));
    const rows = templateId
        ? await all('SELECT * FROM survey_submissions WHERE template_id = ? ORDER BY created_at DESC LIMIT ?', [templateId, safeLimit])
        : await all('SELECT * FROM survey_submissions ORDER BY created_at DESC LIMIT ?', [safeLimit]);
    return rows.map(mapSubmission);
}

async function getSubmission(id) {
    await ensureReady();
    const row = await get('SELECT * FROM survey_submissions WHERE id = ?', [id]);
    return row ? mapSubmission(row) : null;
}

async function updateSubmission(id, payload, username) {
    await ensureReady();
    const existing = await getSubmission(id);
    if (!existing) {
        const err = new Error('记录不存在');
        err.status = 404;
        throw err;
    }
    const templateId = String(payload.templateId || existing.templateId);
    const template = await getTemplate(templateId);
    if (!template) {
        const err = new Error('调查模板不存在');
        err.status = 404;
        throw err;
    }
    const answers = validateAnswers(template, payload.answers || {});
    await run(
        `UPDATE survey_submissions
         SET template_id = ?, template_name = ?, answers = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [template.id, template.name, JSON.stringify(answers), id]
    );
    return getSubmission(id);
}

async function deleteSubmission(id) {
    await ensureReady();
    const result = await run('DELETE FROM survey_submissions WHERE id = ?', [id]);
    return result.changes > 0;
}

module.exports = {
    ensureReady,
    listTemplates,
    getTemplate,
    saveTemplate,
    deleteTemplate,
    createSubmission,
    listSubmissions,
    getSubmission,
    updateSubmission,
    deleteSubmission
};
