const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../frontend/js/report/monthly.js'), 'utf8');
const network = require('../frontend/js/expedite/network-mapping');

function createContext() {
    const context = {
        window: { ExpediteNetwork: network, _categories: ['ET', 'ORG'], _monthlyNetworkMappings: {}, addEventListener() {} },
        document: { addEventListener() {} },
        console
    };
    vm.createContext(context);
    vm.runInContext(source, context);
    return context;
}

test('monthly warning uses compact network groups and due dates', () => {
    const context = createContext();
    assert.equal(vm.runInContext('renderMonthlyExpiringTickets([])', context), '');
    context.tickets = [
        { title: '整改', _slaDays: 6, data: { network_name: 'EG-Egypt ET', ticket_id: 'ET-1' } },
        { title: '整改', _slaDays: 10, data: { network_name: 'EG-Egypt ET', ticket_id: 'ET-2' } },
        { title: '整改', _slaDays: 11, data: { network_name: 'EG-Egypt ET', ticket_id: 'ET-3' } },
        { title: '整改', _slaDays: 15, data: { network_name: 'EG-Egypt ET', ticket_id: 'ET-4' } },
        { title: 'SR详单', _slaDays: -8, data: { network_name: 'EG-Egypt Orange', ticket_id: 'ORG-1' } },
        { title: '风险', _slaDays: 0, data: { network_name: 'Other Network', ticket_id: '<unsafe>' } }
    ];
    const zh = vm.runInContext('renderMonthlyExpiringTickets(tickets)', context);
    assert.match(zh, /class="monthly-ticket-grid"/);
    assert.equal((zh.match(/class="monthly-ticket-network-group"/g) || []).length, 3);
    assert.match(zh, /class="monthly-ticket-network">\[ET\]/);
    assert.match(zh, /class="monthly-ticket-network">\[ORG\]/);
    assert.match(zh, /正数=剩余天数，0=今日到期，负数=超期天数/);
    assert.equal((zh.match(/class="monthly-ticket-type">\[整改\]/g) || []).length, 1);
    assert.match(zh, /class="is-imminent">↳ ET-1 · 6/);
    assert.match(zh, /class="is-imminent">↳ ET-2 · 10/);
    assert.match(zh, /<li>↳ ET-3 · 11/);
    assert.match(zh, /<li>↳ ET-4 · 15/);
    assert.match(zh, /↳ ORG-1 · -8/);
    assert.match(zh, /↳ &lt;unsafe&gt; · 0/);
    assert.doesNotMatch(zh, /单号:|状态:|网络:/);
    assert.doesNotMatch(zh, /天后到期|已超期|周/);
    assert.match(zh, /Other Network \(未映射\)/);
    assert.match(zh, /&lt;unsafe&gt;/);
    assert.doesNotMatch(zh, /<unsafe>/);

    context.window.currentLang = 'en';
    const en = vm.runInContext('renderMonthlyExpiringTickets(tickets)', context);
    assert.match(en, /class="monthly-ticket-network">\[ET\]/);
    assert.doesNotMatch(en, /Ticket:|Status:|Network:/);
    assert.match(en, /positive = days left, 0 = due today, negative = days overdue/);
    assert.match(en, /↳ ET-1 · 6/);
    assert.match(en, /↳ ORG-1 · -8/);
    context.window._monthlyNetworkMappings['Other Network'] = 'ET';
    const mapped = vm.runInContext('renderMonthlyExpiringTickets(tickets)', context);
    assert.doesNotMatch(mapped, /unmapped/);
    context.sentinelTicket = { _slaDays: 999997, _slaCleanText: '已关单 (Closed)' };
    assert.doesNotMatch(vm.runInContext('formatMonthlySlaStatus(sentinelTicket)', context), /month|day/);
    context.fallbackTicket = { _slaCleanText: 'SR预警 (剩余 4 天)' };
    assert.equal(vm.runInContext('formatMonthlySlaStatus(fallbackTicket)', context), '4');
    context.fallbackOverdue = { _slaCleanText: '已超期 3 天' };
    assert.equal(vm.runInContext('formatMonthlySlaStatus(fallbackOverdue)', context), '-3');
    context.fallbackWeeks = { _slaCleanText: 'Due in 2 weeks 1 day' };
    assert.equal(vm.runInContext('formatMonthlySlaStatus(fallbackWeeks)', context), '15');
    context.fallbackOverdueWeeks = { _slaCleanText: 'Overdue by 1 week 1 day' };
    assert.equal(vm.runInContext('formatMonthlySlaStatus(fallbackOverdueWeeks)', context), '-8');
});
