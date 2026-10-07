(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.SlaReminderEngine = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
    'use strict';
    const META_KEY = '__slaReminders';
    const DEFAULTS = { enabled: true, firstDays: 7, secondDays: 3 };
    const STAGES = {
        first: ['第一次提醒', 'First reminder'], second: ['第二次提醒', 'Second reminder'],
        due: ['第三次重要提醒 · 今日到期', 'Third / important reminder · due today'],
        overdue: ['超期每日重要提醒', 'Daily important overdue reminder']
    };
    function dateKey(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }
    function addDays(day, days) {
        const date = new Date(`${day}T12:00:00`);
        date.setDate(date.getDate() + days);
        return dateKey(date);
    }
    function dayDiff(a, b) {
        return Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86400000);
    }
    function entries(state) {
        return Object.entries(state || {}).filter(([day, events]) => /^\d{4}-\d{2}-\d{2}$/.test(day) && Array.isArray(events));
    }
    function settings(raw = {}) {
        const firstDays = Math.max(2, Math.min(90, Math.round(Number(raw.firstDays) || 7)));
        const secondDays = Math.max(1, Math.min(firstDays - 1, Math.round(Number(raw.secondDays) || 3)));
        return { enabled: raw.enabled !== false, firstDays, secondDays };
    }
    function field(row, names) {
        const keys = Object.keys(row || {});
        for (const name of names) {
            const key = keys.find(key => key.toLowerCase().replace(/[\s_-]/g, '') === name.toLowerCase().replace(/[\s_-]/g, ''));
            const value = key && row[key];
            if (value != null && typeof value !== 'object' && String(value).trim()) return String(value).trim();
        }
        return '';
    }
    function normalizeTicket(ticket, snapshot) {
        if (!ticket || typeof ticket !== 'object') return null;
        const row = ticket.data || {};
        const value = ticket._slaDays ?? row._slaDays;
        const days = Number(value);
        if (value == null || String(value).trim() === '' || !Number.isFinite(days) || Math.abs(days) >= 999990) return null;
        const status = field(row, ['sr_status_name', 'task_status', 'task_status_en', '状态-Status', '状态', 'status']);
        const disposition = String(row._srDisposition || '');
        const clean = String(ticket._slaCleanText || row._slaCleanText || '');
        if (/closed|pending/i.test(disposition) || /历史超期|已关单|挂起忽略|挂起后未超期/.test(clean)) return null;
        if (/^(closed|resolved|cancelled|canceled|completed|已关闭|已完成|已取消|关闭)$/i.test(status)) return null;
        // Closed SRs can appear in the snapshot as historical overdue rows.
        if (ticket.collection === 'sr' && /closed|resolved|pending|挂起|关闭/i.test(status)) return null;
        const captured = new Date(snapshot.timestamp);
        if (isNaN(captured)) return null;
        let deadline = ticket.deadline || row._slaDeadline;
        // Old SR snapshots have a precise upstream deadline even without the new metadata.
        if (!deadline && ticket.collection === 'sr') deadline = field(row, ['sus_exp_close_date', '期望关闭时间-挂起']) || field(row, ['exp_close_date']);
        let exact = deadline ? new Date(deadline) : null;
        if (exact && isNaN(exact)) exact = null;
        const dueDate = exact ? dateKey(exact) : addDays(dateKey(captured), Math.ceil(days));
        const number = field(row, ['sr_num', 'sr_id', 'task_id', 'risk_id', 'ticket_id', '单号', '问题风险编号', '问题编号', '任务编号', 'id']);
        const subject = field(row, ['task_name', 'task_title', 'risk_name', 'risk_title', 'sr_title', 'sr_subject', 'ticket_title', '问题描述', '问题标题', '任务名称', '风险描述', 'title', 'subject', 'description']);
        const customer = field(row, ['customer_group', 'customer_group_name', '客户群', '客户群-Customer Group', 'network_name', '网络名称', 'customer_name', '客户名称', 'customer']);
        const productLine = field(row, ['product_line', 'product_line_name', '产品线', '产品线-Product Line', 'product_family']);
        const product = field(row, ['product_name', 'product', '产品', '产品名称', '产品-Product']);
        const owner = field(row, ['responsible_person', 'responsible_person_name', '责任人', '责任人-Owner', 'owner_name', 'owner', 'task_owner', 'task_owner_name', 'rectify_owner', 'risk_owner', 'handler_name', '处理人', 'assignee', 'sr_owner', 'engineer_name']);
        const severity = field(row, ['hw_sev_name', 'severity', 'urgency', 'priority', '严重等级', '优先级']);
        const collection = String(ticket.collection || ticket.title || 'ticket');
        // Do not include mutable SLA days, status, owner or deadline in identity.
        const identity = number || JSON.stringify([subject, customer, productLine, product]);
        if (!number && !subject && !customer && !product) return null;
        return { key: `${collection}:${identity}`, collection, category: String(ticket.title || collection),
            number: number || '—', subject, customer, productLine, product, owner, severity, status,
            dueDate, deadline: exact ? exact.toISOString() : null, estimated: !exact };
    }
    function minute(time) {
        return /^\d{2}:\d{2}$/.test(time || '') ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) : NaN;
    }
    function clock(value) {
        return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
    }
    function allocate(events) {
        const pending = events.filter(event => event.slaReminder && event.status === 'pending' && !event.timeLocked);
        if (!pending.length) return;
        const pendingSet = new Set(pending);
        const occupied = events.filter(event => !pendingSet.has(event) && event.status !== 'completed')
            .map(event => [minute(event.start), minute(event.end)]).filter(([a, b]) => Number.isFinite(a) && b > a);
        let free = [[510, 720], [810, 1110]]; // 08:30–12:00 and 13:30–18:30
        occupied.forEach(([a, b]) => {
            free = free.flatMap(([start, end]) => b <= start || a >= end ? [[start, end]] :
                [[start, Math.min(a, end)], [Math.max(b, start), end]].filter(([x, y]) => y > x));
        });
        const available = free.reduce((total, [a, b]) => total + b - a, 0);
        const duration = Math.max(1, Math.min(30, Math.floor(available / pending.length)));
        const rank = { overdue: 0, due: 1, second: 2, first: 3 };
        pending.sort((a, b) => rank[a.slaReminder.stage] - rank[b.slaReminder.stage] ||
            a.slaReminder.ticket.dueDate.localeCompare(b.slaReminder.ticket.dueDate) || a.id.localeCompare(b.id));
        let slot = 0;
        pending.forEach(event => {
            while (slot < free.length && free[slot][1] - free[slot][0] < duration) slot++;
            if (slot === free.length) {
                event.start = ''; event.end = ''; event.unplanned = true;
            } else {
                event.start = clock(free[slot][0]); event.end = clock(free[slot][0] + duration);
                event.unplanned = false; free[slot][0] += duration;
            }
        });
    }
    function stageLabel(stage, lang = 'zh') { return (STAGES[stage] || STAGES.first)[lang === 'en' ? 1 : 0]; }
    function reminderText(event, lang = 'zh') {
        const ticket = event.slaReminder.ticket;
        const zh = lang !== 'en';
        const labels = zh ? ['单号', '内容', '客户群', '产品线', '产品', '责任人', '到期日期', '状态', '优先级'] :
            ['Ticket', 'Subject', 'Customer group', 'Product line', 'Product', 'Owner', 'Due date', 'Status', 'Priority'];
        const values = [ticket.number, ticket.subject, ticket.customer, ticket.productLine, ticket.product, ticket.owner, ticket.dueDate, ticket.status, ticket.severity];
        return [stageLabel(event.slaReminder.stage, lang), ...values.map((value, i) => value ? `${labels[i]}：${value}` : '').filter(Boolean),
            zh ? '请责任人与客户群确认处理进展、预计完成时间及阻塞事项。' : 'Please confirm progress, expected completion time and blockers with the owner and customer group.'].join('\n');
    }
    function reconcile(state, snapshot, options = {}) {
        const before = JSON.stringify(state);
        const today = options.today || dateKey(new Date());
        let meta = state[META_KEY];
        if (!meta && !snapshot) return { changed: false, added: 0, completed: 0 };
        meta ||= state[META_KEY] = { config: { ...DEFAULTS }, tickets: [], firstTrackedDate: today };
        meta.config = settings(options.config || meta.config);
        let completed = 0, added = 0;
        const snapshotTime = snapshot && Date.parse(snapshot.timestamp);
        const valid = snapshot && Array.isArray(snapshot.expiringTickets) && Number.isFinite(snapshotTime) &&
            (!meta.snapshotTime || snapshotTime >= meta.snapshotTime);
        if (valid) {
            const previous = new Map((meta.tickets || []).map(ticket => [ticket.key, ticket]));
            const normalized = snapshot.expiringTickets.map(ticket => normalizeTicket(ticket, snapshot)).filter(Boolean);
            const unique = new Map(normalized.map(ticket => [ticket.key, ticket]));
            const version = JSON.stringify([snapshot.id, snapshot.timestamp, [...unique.values()]]);
            if (version !== meta.version) {
                entries(state).forEach(([, events]) => events.forEach(event => {
                    if (event.slaReminder && !unique.has(event.slaReminder.key) && event.status !== 'completed') {
                        event.status = 'completed'; event.completedAt = today; event.completionReason = 'snapshot';
                        event.completedSnapshotId = snapshot.id; completed++;
                    }
                }));
                meta.tickets = [...unique.values()].map(ticket => {
                    const old = previous.get(ticket.key);
                    return { ...ticket, firstSeenDate: old?.firstSeenDate || today,
                        planFromDate: !old || old.dueDate !== ticket.dueDate ? today : (old.planFromDate || old.firstSeenDate || today) };
                });
                meta.version = version; meta.snapshotTime = snapshotTime; meta.snapshotId = snapshot.id;
                meta.snapshotTimestamp = snapshot.timestamp;
                meta.skipped = snapshot.expiringTickets.length - normalized.length;
            }
        }
        if (meta.config.enabled) {
            const from = meta.firstTrackedDate || today;
            const to = options.to && options.to > today ? options.to : addDays(today, 45);
            meta.tickets.forEach(ticket => {
                const first = addDays(ticket.dueDate, -meta.config.firstDays);
                const second = addDays(ticket.dueDate, -meta.config.secondDays);
                const firstSeen = ticket.planFromDate || ticket.firstSeenDate || today;
                // If imported during a reminder window, schedule that stage today.
                const firstDay = first < firstSeen && firstSeen < second ? firstSeen : first;
                const secondDay = second < firstSeen && firstSeen < ticket.dueDate ? firstSeen : second;
                const days = [[firstDay, 'first'], [secondDay, 'second'], [ticket.dueDate, 'due']];
                const overdueStart = [addDays(ticket.dueDate, 1), from, firstSeen].sort().at(-1);
                for (let day = overdueStart; day <= to; day = addDays(day, 1)) {
                    days.push([day, 'overdue']);
                }
                days.forEach(([day, stage]) => {
                    if (day < from || day < firstSeen || day > to) return;
                    const events = state[day] ||= [];
                    const existing = events.find(event => event.slaReminder?.key === ticket.key && event.slaReminder.stage === stage);
                    if (existing) {
                        if (existing.status === 'completed' && ['snapshot', 'rescheduled'].includes(existing.completionReason)) {
                            existing.status = 'pending'; delete existing.completionReason; delete existing.completedAt;
                        }
                        if (existing.status !== 'completed') existing.slaReminder.ticket = ticket;
                        return;
                    }
                    const event = { id: `sla:${encodeURIComponent(ticket.key).replace(/'/g, '%27')}:${day}:${stage}`, start: '', end: '',
                        title: `${stageLabel(stage)} · ${ticket.category} ${ticket.number}`, type: ['due', 'overdue'].includes(stage) ? 'urgent' : 'work',
                        reporter: ticket.owner, attendees: ticket.customer, status: 'pending',
                        slaReminder: { key: ticket.key, stage, ticket }, description: '' };
                    event.description = reminderText(event);
                    events.push(event); added++;
                });
            });
            // Update details on existing pending reminders and retire future
            // reminder dates made obsolete by a changed deadline or policy.
            const active = new Map(meta.tickets.map(ticket => [ticket.key, ticket]));
            entries(state).forEach(([day, events]) => {
                events.forEach(event => {
                    if (!event.slaReminder || event.status === 'completed') return;
                    const ticket = active.get(event.slaReminder.key);
                    if (!ticket) return;
                    if (day >= today && event.status === 'pending') {
                        const { stage } = event.slaReminder;
                        const expected = stage === 'due' ? ticket.dueDate : stage === 'overdue' ? day :
                            addDays(ticket.dueDate, -(stage === 'first' ? meta.config.firstDays : meta.config.secondDays));
                        const catchup = day === (ticket.planFromDate || ticket.firstSeenDate) && day < ticket.dueDate &&
                            (stage === 'first' ? day < addDays(ticket.dueDate, -meta.config.secondDays) : day >= addDays(ticket.dueDate, -meta.config.secondDays));
                        if ((stage === 'overdue' && day <= ticket.dueDate) || (stage !== 'overdue' && day !== expected && !catchup)) {
                            event.status = 'completed'; event.completionReason = 'rescheduled'; event.completedAt = today; completed++;
                        }
                    }
                    if (event.status !== 'completed') {
                        event.slaReminder.ticket = ticket; event.reporter = ticket.owner; event.attendees = ticket.customer;
                        event.description = reminderText(event);
                    }
                });
                if (day >= today) allocate(events);
            });
        }
        return { changed: before !== JSON.stringify(state), added, completed, snapshotAccepted: !!valid };
    }
    return { META_KEY, DEFAULTS, entries, settings, normalizeTicket, reconcile, allocate, addDays, dayDiff, dateKey, stageLabel, reminderText };
});
