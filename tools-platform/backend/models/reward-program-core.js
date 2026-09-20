const CATEGORIES = ['bounty', 'position', 'operation', 'excellence'];
const money = value => Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000_00;
const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
const label = (value, max = 120) => String(value ?? '').trim().slice(0, max);

function allocate(total, rows, scope) {
    if (!Array.isArray(rows) || !rows.length || rows.length > 200) fail(`${scope}不能为空或超过 200 项`);
    let sum = 0;
    const calculated = rows.map((row, index) => {
        const mode = row.mode === 'percent' ? 'percent' : 'amount';
        const amountMinor = mode === 'amount' ? Number(row.amountMinor) : Math.round(total * Number(row.percentBp) / 10000);
        if (mode === 'percent' && (!Number.isInteger(Number(row.percentBp)) || Number(row.percentBp) < 0 || Number(row.percentBp) > 10000)) fail(`${scope}第 ${index + 1} 项百分比无效`);
        if (!money(amountMinor)) fail(`${scope}第 ${index + 1} 项金额无效`);
        sum += amountMinor;
        return { ...row, mode, amountMinor };
    });
    if (sum !== total) fail(`${scope}分配合计与总额不一致（差额 ${(total - sum) / 100} EGP）`);
    return calculated;
}

function normalizeApplication(input, rules) {
    const category = label(input.category, 30);
    if (!CATEGORIES.includes(category)) fail('奖励类别无效');
    const rule = rules.find(item => item.id === input.ruleId && item.category === category && !item.archived);
    if (!rule) fail('请选择有效的奖励规则');
    const title = label(input.title);
    if (!title) fail('请输入申请标题');
    const totalAmountMinor = Number(input.totalAmountMinor);
    if (!money(totalAmountMinor) || totalAmountMinor === 0) fail('总金额必须大于 0');
    const value = {
        category, ruleId: rule.id, ruleSnapshot: { ...rule }, title,
        period: label(input.period, 40), projectName: label(input.projectName),
        summary: label(input.summary, 3000), evidence: label(input.evidence, 2000),
        totalAmountMinor, currency: input.currency === 'CNY' ? 'CNY' : 'EGP',
        attachments: Array.isArray(input.attachments) ? input.attachments.filter(u => typeof u === 'string' && u.length <= 500).slice(0, 20) : [],
        teams: [], recipients: []
    };
    if (!value.summary) fail('请填写申报依据或事迹说明');
    if (category === 'bounty') {
        if (!value.projectName) fail('悬赏奖必须填写项目名称');
        value.teams = allocate(totalAmountMinor, input.teams, '团队').map((team, index) => {
            const name = label(team.name);
            if (!name) fail(`团队第 ${index + 1} 项缺少名称`);
            const members = allocate(team.amountMinor, team.members, `${name}成员`).map((member, memberIndex) => {
                const memberName = label(member.name);
                if (!memberName) fail(`${name}第 ${memberIndex + 1} 位成员缺少姓名`);
                return { name: memberName, staffId: label(member.staffId, 80), mode: member.mode, percentBp: member.mode === 'percent' ? Number(member.percentBp) : null, amountMinor: member.amountMinor };
            });
            return { name, mode: team.mode, percentBp: team.mode === 'percent' ? Number(team.percentBp) : null, amountMinor: team.amountMinor, members };
        });
        const staffIds = value.teams.flatMap(team => team.members.map(member => member.staffId).filter(Boolean));
        if (new Set(staffIds).size !== staffIds.length) fail('同一工号不能在悬赏奖中重复分配');
    } else {
        const recipients = Array.isArray(input.recipients) ? input.recipients : [];
        if (!recipients.length || recipients.length > 200) fail('获奖对象不能为空或超过 200 项');
        value.recipients = allocate(totalAmountMinor, recipients, '获奖对象').map((person, index) => {
            const name = label(person.name);
            if (!name) fail(`获奖对象第 ${index + 1} 项缺少名称`);
            return { name, staffId: label(person.staffId, 80), team: label(person.team), mode: person.mode, percentBp: person.mode === 'percent' ? Number(person.percentBp) : null, amountMinor: person.amountMinor };
        });
        const staffIds = value.recipients.map(person => person.staffId).filter(Boolean);
        if (new Set(staffIds).size !== staffIds.length) fail('同一工号不能重复分配');
        if (category === 'position') {
            if (!money(rule.unitAmountMinor) || rule.unitAmountMinor === 0 || !label(rule.positionName)) fail('岗位激励规则需先配置固定岗位和单人金额');
            if (value.recipients.some(person => person.amountMinor !== rule.unitAmountMinor)) fail('岗位激励每位人员金额必须等于规则中的固定单人金额');
        }
        if (category === 'operation' && rule.unitAmountMinor != null && value.recipients.some(person => person.amountMinor !== rule.unitAmountMinor)) fail('操作激励每位人员金额必须等于规则中的单人金额');
    }
    return value;
}

module.exports = { CATEGORIES, money, label, allocate, normalizeApplication };
