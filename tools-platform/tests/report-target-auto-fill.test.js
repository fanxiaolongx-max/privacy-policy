const test = require('node:test');
const assert = require('node:assert/strict');
const { inheritLatestTargets } = require('../frontend/js/report/target-auto-fill');

test('inherits the latest earlier common target and category targets', () => {
    const target = {
        autoFill: true,
        3: '90',
        5: '95',
        categoryTargets: {
            2: { TE: '80', ORG: '81' },
            4: { TE: '92' },
            5: { ORG: '93' }
        }
    };

    const result = inheritLatestTargets(target, 6, ['TE', 'ORG', 'VDF']);

    assert.equal(result.changed, true);
    assert.equal(target[6], '95');
    assert.deepEqual(target.categoryTargets[6], { TE: '92', ORG: '93' });
    assert.equal(result.commonSourceMonth, '5');
    assert.deepEqual(result.categorySourceMonths, { TE: '4', ORG: '5' });
});

test('preserves values already configured for the current month', () => {
    const target = {
        autoFill: true,
        5: '95',
        6: '98',
        categoryTargets: {
            5: { TE: '92', ORG: '93' },
            6: { TE: '99' }
        }
    };

    inheritLatestTargets(target, 6, ['TE', 'ORG']);

    assert.equal(target[6], '98');
    assert.deepEqual(target.categoryTargets[6], { TE: '99', ORG: '93' });
});

test('does not inherit future months or targets with auto fill disabled', () => {
    const januaryTarget = { autoFill: true, 12: '99', categoryTargets: { 12: { TE: '98' } } };
    const disabledTarget = { autoFill: false, 5: '95' };

    assert.equal(inheritLatestTargets(januaryTarget, 1, ['TE']).changed, false);
    assert.equal(januaryTarget[1], undefined);
    assert.equal(inheritLatestTargets(disabledTarget, 6, ['TE']).changed, false);
    assert.equal(disabledTarget[6], undefined);
});
