const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const page = fs.readFileSync(
    path.join(__dirname, '..', 'backend', 'builtin-tools', 'tool-ms4xb66s', 'index.html'),
    'utf8'
);
const toolScript = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];

function createToolRuntime(savedRules = null) {
    const elements = new Map();
    function element(id) {
        if (elements.has(id)) return elements.get(id);
        const classes = new Set();
        const value = {
            id,
            value: '',
            checked: false,
            disabled: false,
            hidden: false,
            innerHTML: '',
            textContent: '',
            style: {},
            dataset: {},
            classList: {
                add: (...names) => names.forEach(name => classes.add(name)),
                remove: (...names) => names.forEach(name => classes.delete(name)),
                toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
                contains: name => classes.has(name)
            },
            addEventListener() {},
            setAttribute() {},
            scrollIntoView() {},
            getBoundingClientRect() { return { width: 100, height: 40, left: 0, top: 0, bottom: 40 }; },
            getContext() { return {}; }
        };
        elements.set(id, value);
        return value;
    }

    const storage = new Map();
    if (savedRules) storage.set('nightAllowanceRulesV1', JSON.stringify(savedRules));
    const document = {
        getElementById: element,
        querySelectorAll() { return []; },
        querySelector() { return null; },
        body: { classList: element('body').classList }
    };
    const context = {
        console,
        document,
        alert() {},
        requestAnimationFrame() {},
        setTimeout() {},
        clearTimeout() {},
        structuredClone,
        innerWidth: 1200,
        innerHeight: 800,
        localStorage: {
            getItem: key => storage.get(key) || null,
            setItem: (key, value) => storage.set(key, value),
            removeItem: key => storage.delete(key)
        },
        window: { XLSX: null, devicePixelRatio: 1, addEventListener() {}, scrollTo() {} }
    };
    vm.createContext(context);
    vm.runInContext(toolScript, context);
    return { context, element, storage };
}

function evaluate(runtime, source) {
    return JSON.parse(JSON.stringify(vm.runInContext(source, runtime.context)));
}

test('incentive defaults use the revised amounts and all-day operation scope', () => {
    assert.match(page, /feeLow:50,feeMedium:180,feeHigh:280,feeFatal:600/);
    assert.match(page, /nightOnly:false,verifyMode:'time'/);
    assert.match(page, /id="nightOnly" type="checkbox"/);
    assert.match(page, /操作时间：全天/);
    assert.match(page, /if\(enabled&&fillNightRange\)\{\$\('nightStart'\)\.value='22:00';\$\('nightEnd'\)\.value='06:00'/);
    assert.match(page, /if\(nightOnly\)nightOk=/);
});

test('operator rows are split into WX and non-WX scopes with non-WX selected by default', () => {
    assert.match(page, /activeOperatorGroup='nonwx'/);
    assert.match(page, /function operatorGroup\(person\)\{return clean\(person\)\.toLowerCase\(\)\.includes\('wx'\)\?'wx':'nonwx'\}/);
    assert.match(page, /data-operator-group="nonwx"[^>]*>非 WX 操作人/);
    assert.match(page, /data-operator-group="wx"[^>]*>WX 操作人/);
    assert.match(page, /const groupRows=validRows\.filter\(operatorMatchesGroup\)/);
    assert.match(page, /return operatorMatchesGroup\(r\)&&inQuick/);
    assert.match(page, /activeOperatorGroup==='wx'\?'WX':'非WX'/);
});

test('nighttime calculation rejects daytime rows when one endpoint is missing', () => {
    const runtime = createToolRuntime();
    runtime.context.fixtureRows = [
        { task_status: 'completed', complete_operator: 'A100', '当地开始时间': '2026-09-01 10:00', operate_level: 'Low' },
        { task_status: 'completed', complete_operator: 'WX100', '当地开始时间': '2026-09-01 23:00', operate_level: 'Medium' }
    ];
    const result = evaluate(runtime, `
        $('nightOnly').checked=true;
        rawRows=fixtureRows;
        recalculate();
        ({valid:validRows.map(r=>r.__person),excluded:excludedRows.map(r=>r.__person)});
    `);
    assert.deepEqual(result, { valid: ['WX100'], excluded: ['A100'] });
});

test('operator identification falls back from an empty preferred field', () => {
    const runtime = createToolRuntime();
    runtime.context.fixtureRows = [{
        task_status: 'completed',
        complete_operator: '',
        '方案实施人工号': 'WX900',
        '当地开始时间': '2026-09-01 10:00',
        operate_level: 'High'
    }];
    const result = evaluate(runtime, `
        rawRows=fixtureRows;
        recalculate();
        activeOperatorGroup='wx';
        ({person:validRows[0].__person,group:validRows[0].__operatorGroup,count:filtered().length});
    `);
    assert.deepEqual(result, { person: 'WX900', group: 'wx', count: 1 });
});

test('legacy saved rules retain custom amounts and preserve their nighttime behavior', () => {
    const runtime = createToolRuntime({
        feeLow: 111,
        feeMedium: 222,
        feeHigh: 333,
        feeFatal: 444,
        nightStart: '21:00',
        nightEnd: '05:00',
        verifyMode: 'time',
        personField: 'complete_operator'
    });
    const values = evaluate(runtime, `({rules:getRuleValues(),saved:JSON.parse(localStorage.getItem(RULE_STORAGE_KEY))})`);
    assert.deepEqual(values.rules, {
        rulesVersion: 2,
        feeLow: 111,
        feeMedium: 222,
        feeHigh: 333,
        feeFatal: 444,
        nightStart: '21:00',
        nightEnd: '05:00',
        nightOnly: true,
        verifyMode: 'time',
        personField: 'complete_operator'
    });
    assert.equal(values.saved.rulesVersion, 2);
    assert.equal(values.saved.nightOnly, true);
});

test('legacy default amounts migrate to the revised defaults', () => {
    const runtime = createToolRuntime({
        feeLow: 100,
        feeMedium: 200,
        feeHigh: 300,
        feeFatal: 400,
        nightStart: '22:00',
        nightEnd: '06:00',
        verifyMode: 'warn',
        personField: 'complete_operator'
    });
    const values = evaluate(runtime, 'getRuleValues()');
    assert.deepEqual(
        [values.feeLow, values.feeMedium, values.feeHigh, values.feeFatal],
        [50, 180, 280, 600]
    );
    assert.equal(values.nightOnly, true);
});
