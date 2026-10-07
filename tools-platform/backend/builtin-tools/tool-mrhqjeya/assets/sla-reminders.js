'use strict';
let slaFetchInProgress = false;
let slaSourceError = false;
let slaPollingStarted = false;

function openSlaReminderSettings() {
    renderSlaReminderStatus();
    document.getElementById('sla-settings-dialog').showModal();
}
function closeSlaReminderSettings() {
    document.getElementById('sla-settings-dialog').close();
}

function scheduleEntries() { return SlaReminderEngine.entries(STORAGE_CORE); }
function reminderPlanningEnd() {
    const visibleEnd = currentView === 'year'
        ? `${anchorDate.getFullYear()}-12-31`
        : localDateString(new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 7, 12));
    return [SlaReminderEngine.addDays(localDateString(), 45), visibleEnd, selectedDateStr].sort().at(-1);
}
function buildSlaReminderSchedule(snapshot = null, config) {
    const result = SlaReminderEngine.reconcile(STORAGE_CORE, snapshot, { today: localDateString(), to: reminderPlanningEnd(), config });
    if (result.changed) persist('自动更新单据提醒日程', false);
    renderSlaReminderStatus();
    return result;
}
function renderSlaReminderStatus() {
    const zh = currentLang !== 'en';
    const meta = STORAGE_CORE[SlaReminderEngine.META_KEY];
    const config = SlaReminderEngine.settings(meta?.config);
    if (!document.getElementById('sla-settings-dialog').open) {
        document.getElementById('sla-reminder-enabled').checked = config.enabled;
        document.getElementById('sla-first-days').value = config.firstDays;
        document.getElementById('sla-second-days').value = config.secondDays;
    }
    document.getElementById('sla-settings-btn').textContent = zh ? '⚙️ 提醒设置' : '⚙️ Reminders';
    document.getElementById('sla-settings-close').textContent = zh ? '关闭' : 'Close';
    document.getElementById('sla-reminder-title').textContent = zh ? '单据智能提醒' : 'Ticket reminder planning';
    document.getElementById('sla-enabled-label').textContent = zh ? '自动编排' : 'Auto plan';
    document.getElementById('sla-first-label').textContent = zh ? '第一次：提前天数' : 'First: days before due';
    document.getElementById('sla-second-label').textContent = zh ? '第二次：提前天数' : 'Second: days before due';
    document.getElementById('sla-policy-save').textContent = zh ? '应用规则' : 'Apply rules';
    document.getElementById('sla-source-refresh').textContent = zh ? '刷新快照' : 'Refresh snapshot';
    document.getElementById('sla-policy-help').textContent = zh
        ? '到期当天第三次重要提醒，超期后每天提醒。按自然日安排，避开已有日程与午休；任务多时自动缩短时长。最新快照移除或退出提醒范围后自动完成。页面打开时每 2 分钟检查新快照。'
        : 'Third important reminder on the due date, then daily overdue reminders. Uses calendar days, avoids existing events and lunch, and shortens slots when busy. New snapshots resolve removed / out-of-scope tickets. Checks every 2 minutes while open.';
    const status = document.getElementById('sla-source-status');
    if (!meta?.snapshotTimestamp) {
        status.textContent = slaSourceError ? (zh ? '快照读取失败，保留现有日程' : 'Snapshot unavailable; existing schedule retained') :
            (zh ? '暂无导入快照；导入 SLA 数据后自动生成提醒' : 'No import snapshot; import SLA data to generate reminders');
    } else {
        const overdue = meta.tickets.filter(ticket => ticket.dueDate < localDateString()).length;
        const estimated = meta.tickets.filter(ticket => ticket.estimated).length;
        const backlog = (STORAGE_CORE[selectedDateStr] || []).filter(event => event.slaReminder && event.status === 'pending' && event.unplanned).length;
        status.textContent = zh
            ? `快照 ${new Date(meta.snapshotTimestamp).toLocaleString()} · 跟进 ${meta.tickets.length} 单 / 超期 ${overdue} 单${estimated ? ` · ${estimated} 单日期估算` : ''}${meta.skipped ? ` · 排除 ${meta.skipped} 条无效/已关闭记录` : ''}${backlog ? ` · 当日 ${backlog} 单待安排时间` : ''}${slaSourceError ? ' · 读取失败，继续沿用此快照' : ''}`
            : `Snapshot ${new Date(meta.snapshotTimestamp).toLocaleString()} · ${meta.tickets.length} active / ${overdue} overdue${estimated ? ` · ${estimated} estimated dates` : ''}${meta.skipped ? ` · ${meta.skipped} invalid / closed rows excluded` : ''}${backlog ? ` · ${backlog} unscheduled today` : ''}${slaSourceError ? ' · unavailable; cached snapshot retained' : ''}`;
    }
}
async function refreshSlaReminderSource() {
    if (slaFetchInProgress) return;
    slaFetchInProgress = true;
    try {
        if (!remoteSyncEnabled) throw new Error('Schedule state is unavailable');
        const response = await fetch('/api/sla/snapshots/latest', { headers: authHeaders(), cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = await response.json();
        if (!Object.hasOwn(body, 'snapshot') || (body.snapshot && !Array.isArray(body.snapshot.expiringTickets))) throw new Error('Invalid snapshot');
        slaSourceError = false;
        buildSlaReminderSchedule(body.snapshot);
    } catch (_) {
        slaSourceError = true;
        buildSlaReminderSchedule();
    } finally {
        slaFetchInProgress = false;
        renderCalendarPart(); renderTimelineBlock(selectedDateStr); refreshConflictSummary();
        if (document.getElementById('import-panel').classList.contains('active')) renderImportTable();
    }
}
function applySlaReminderPolicy() {
    const firstDays = Number(document.getElementById('sla-first-days').value);
    const secondDays = Number(document.getElementById('sla-second-days').value);
    if (!Number.isInteger(firstDays) || !Number.isInteger(secondDays) || firstDays < 2 || firstDays > 90 || secondDays < 1 || secondDays >= firstDays) {
        showImportToast(currentLang === 'zh' ? '第一次提前天数须为 2–90，第二次须为 1 到第一次天数减 1' : 'First reminder: 2–90 days. Second: at least 1 day and before the first threshold.', 'error');
        return;
    }
    const config = { enabled: document.getElementById('sla-reminder-enabled').checked, firstDays, secondDays };
    STORAGE_CORE[SlaReminderEngine.META_KEY] ||= { tickets: [], firstTrackedDate: localDateString() };
    buildSlaReminderSchedule(null, config);
    closeSlaReminderSettings();
    renderCalendarPart(); renderTimelineBlock(selectedDateStr); refreshConflictSummary();
    showImportToast(currentLang === 'zh' ? '提醒规则已应用' : 'Reminder rules applied', 'success');
}
function startSlaReminderPolling() {
    if (slaPollingStarted) return;
    slaPollingStarted = true;
    refreshSlaReminderSource();
    setInterval(() => { if (!document.hidden) refreshSlaReminderSource(); }, 120000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshSlaReminderSource(); });
    window.addEventListener('focus', refreshSlaReminderSource);
}
function slaReminderCard(event, date) {
    if (!event.slaReminder) return '';
    const zh = currentLang !== 'en';
    const ticket = event.slaReminder.ticket;
    const complete = event.status === 'completed', reminded = event.status === 'reminded';
    const deadline = ticket.deadline && new Date(ticket.deadline);
    const dueLabel = deadline ? `${ticket.dueDate} ${String(deadline.getHours()).padStart(2, '0')}:${String(deadline.getMinutes()).padStart(2, '0')}` : ticket.dueDate;
    const fields = [[zh ? '单号' : 'Ticket', ticket.number], [zh ? '客户群' : 'Customer group', ticket.customer],
        [zh ? '产品线' : 'Product line', ticket.productLine], [zh ? '产品' : 'Product', ticket.product],
        [zh ? '责任人' : 'Owner', ticket.owner], [zh ? '截止日期' : 'Due date', dueLabel],
        [zh ? '状态' : 'Status', ticket.status], [zh ? '优先级' : 'Priority', ticket.severity]];
    const days = SlaReminderEngine.dayDiff(ticket.dueDate, date);
    const timing = days < 0 ? (zh ? `超期 ${-days} 天` : `${-days} days overdue`) : days === 0 ? (zh ? '今日到期' : 'Due today') : (zh ? `剩余 ${days} 天` : `${days} days left`);
    const reason = event.completionReason === 'rescheduled' ? (zh ? '截止日期/规则已更新，安排已替换' : 'Replaced after deadline / policy change') :
        (zh ? '新快照已移除或退出提醒范围' : 'Removed / out of scope in a newer snapshot');
    return `<section class="sla-ticket-detail">
        <div class="sla-ticket-badges"><b class="sla-state ${complete ? 'done' : reminded ? 'reminded' : ''}">${complete ? (zh ? '已完成' : 'Completed') : reminded ? (zh ? '已提醒' : 'Reminded') : timing}</b>
        <span>${escapeHtml(SlaReminderEngine.stageLabel(event.slaReminder.stage, currentLang))}</span>${ticket.estimated ? `<span>${zh ? '截止日期估算' : 'Estimated due date'}</span>` : ''}</div>
        ${ticket.subject ? `<p class="sla-ticket-subject">${escapeHtml(ticket.subject)}</p>` : ''}
        <dl class="sla-ticket-fields">${fields.filter(([, value]) => value).map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>
        ${complete ? `<p class="sla-completion-reason">${reason} · ${escapeHtml(event.completedAt || '')}</p>` : `<div class="sla-ticket-actions">
        <button type="button" data-sla-action="copy">${zh ? '复制催办内容' : 'Copy reminder'}</button>
        <button type="button" data-sla-action="reminded" ${reminded ? 'disabled' : ''}>${zh ? '标记本次已提醒' : 'Mark this reminder sent'}</button>
        ${event.unplanned ? `<span>${zh ? '当日空闲不足，请手工安排处理时间' : 'No free slot; assign a time manually'}</span>` : ''}</div>`}
        </section>`;
}
async function handleSlaReminderAction(event) {
    const button = event.target.closest('[data-sla-action]');
    if (!button) return;
    event.stopPropagation();
    const card = button.closest('.schedule-meta-card');
    const item = (STORAGE_CORE[card.dataset.date] || []).find(item => item.id === card.dataset.id);
    if (!item?.slaReminder) return;
    if (button.dataset.slaAction === 'copy') {
        const text = SlaReminderEngine.reminderText(item, currentLang);
        try {
            await navigator.clipboard.writeText(text);
            showImportToast(currentLang === 'zh' ? '催办内容已复制' : 'Reminder copied', 'success');
        } catch (_) {
            document.getElementById('entry-desc').value = text;
            openEditModalFromCard(card);
            document.getElementById('entry-desc').value = text;
            document.getElementById('entry-desc').select();
        }
    } else {
        item.status = 'reminded'; item.remindedAt = new Date().toISOString();
        persist('标记本次已提醒', false);
        renderCalendarPart(); renderTimelineBlock(selectedDateStr);
    }
}
