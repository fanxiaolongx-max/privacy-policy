const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const network = require('../frontend/js/expedite/network-mapping');
const page = fs.readFileSync(path.join(__dirname, '../frontend/pages/expedite.html'), 'utf8');
const inlineScript = page.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/)[1];

function createPageContext() {
    const context = {
        window: {
            ExpediteNetwork: network,
            GlobalCategories: ['ET', 'ORG', 'TE', 'VDF'],
            _distPolicy: { roster: [], assignments: { ET: ['et-owner'], ORG: ['org-owner'] }, networkMappings: {} },
            addEventListener() {},
            currentLang: 'en'
        },
        document: { addEventListener() {} },
        localStorage: { getItem() { return 'admin'; } },
        console,
        setTimeout
    };
    vm.createContext(context);
    vm.runInContext(inlineScript, context);
    context.window._distPolicy.assignments = { ET: ['et-owner'], ORG: ['org-owner'] };
    return context;
}

test('known raw network names resolve to existing metric categories, with configurable overrides', () => {
    assert.equal(network.resolveCategory('EG-Egypt ET', ['ET', 'ORG'], {}), 'ET');
    assert.equal(network.resolveCategory('EG-Egypt Orange', ['ET', 'ORG'], {}), 'ORG');
    assert.equal(network.resolveCategory('EG-Egypt ET', ['ET', 'ORG'], { 'EG-Egypt ET': 'ORG' }), 'ORG');
    assert.equal(network.resolveCategory('EG-Egypt ET', ['ET', 'ORG'], { 'EG-Egypt ET': '' }), '');
    assert.equal(network.resolveCategory('Unrecognized Network', ['ET'], {}), '');
});
test('personalized messages contain only tickets mapped to the recipient categories', () => {
    const context = createPageContext();
    const data = {
        month: 9,
        failing_metrics: { ET: [], ORG: [] },
        raw_data_json: JSON.stringify({ expiringTickets: [
            { title: '整改', data: { network_name: 'EG-Egypt ET', ticket_id: 'ET-1' } },
            { title: '整改', data: { network_name: 'EG-Egypt Orange', ticket_id: 'ORG-1' } },
            { title: '整改', data: { network_name: 'Unknown Network', ticket_id: 'OTHER-1' } }
        ] })
    };
    context.inputData = data;
    vm.runInContext('latestFailingData = inputData', context);
    const etText = vm.runInContext("generatePersonalizedText('et-owner', getDistributionCategories())", context);
    assert.match(etText, /\[ET\]/);
    assert.doesNotMatch(etText, /Network:/);
    assert.doesNotMatch(etText, /Ticket:/);
    assert.doesNotMatch(etText, /Status:/);
    assert.match(etText, /ET-1/);
    assert.doesNotMatch(etText, /ORG-1|OTHER-1/);
    const fullText = vm.runInContext('getExpiringTicketsText(latestFailingData)', context);
    assert.match(fullText, /ET-1/);
    assert.match(fullText, /ORG-1/);
    assert.match(fullText, /OTHER-1/);
    context.window._distPolicy.networkMappings['EG-Egypt ET'] = 'ORG';
    const orgText = vm.runInContext("generatePersonalizedText('org-owner', getDistributionCategories())", context);
    assert.match(orgText, /ET-1/);
    assert.match(orgText, /ORG-1/);
});

test('expiring tickets format groups same ticket types with SLA status in parentheses without redundant Ticket/Status prefixes', () => {
    const context = createPageContext();
    const data = {
        month: 9,
        failing_metrics: { ET: [] },
        raw_data_json: JSON.stringify({ expiringTickets: [
            { title: 'SR详单', _slaDays: 3, data: { network_name: 'EG-Egypt ET', sr_num: 'SR-101' } },
            { title: 'SR详单', _slaDays: -2, data: { network_name: 'EG-Egypt ET', sr_num: 'SR-102' } },
            { title: '整改', _slaDays: 0, data: { network_name: 'EG-Egypt ET', ticket_id: 'REC-201' } }
        ] })
    };
    context.inputData = data;
    vm.runInContext('latestFailingData = inputData', context);
    const fullText = vm.runInContext('getExpiringTicketsText(latestFailingData)', context);
    assert.doesNotMatch(fullText, /Network:/);
    assert.doesNotMatch(fullText, /Ticket:/);
    assert.doesNotMatch(fullText, /Status:/);
    assert.match(fullText, /\[ET\]/);
    assert.match(fullText, /↳ SR:\n\s+- SR-101 \(Due in 3 days\)\n\s+- SR-102 \(Overdue by 2 days\)/);
    assert.match(fullText, /↳ Rectification:\n\s+- REC-201 \(Due today\)/);
});
