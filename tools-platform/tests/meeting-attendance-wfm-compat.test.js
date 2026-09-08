const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadMeetingAttendance() {
    const htmlPath = path.resolve(__dirname, '../backend/builtin-tools/tool-msf5b7nn/index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
    assert.ok(scriptMatch, 'Script block should exist in index.html');
    const scriptContent = scriptMatch[1];

    const mockStorage = new Map();
    const mockLocalStorage = {
        getItem: key => mockStorage.get(key) || null,
        setItem: (key, val) => mockStorage.set(key, String(val)),
        removeItem: key => mockStorage.delete(key),
        clear: () => mockStorage.clear()
    };
    const mockSessionStorage = {
        getItem: key => mockStorage.get('session:' + key) || null,
        setItem: (key, val) => mockStorage.set('session:' + key, String(val)),
        removeItem: key => mockStorage.delete('session:' + key),
        clear: () => mockStorage.clear()
    };

    const mockElement = {
        classList: { toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false },
        querySelectorAll: () => [],
        querySelector: () => null,
        addEventListener: () => {},
        style: {},
        innerHTML: '',
        textContent: '',
        value: ''
    };

    const sandbox = {
        console,
        Date,
        Math,
        Number,
        String,
        Set,
        Map,
        Array,
        RegExp,
        Intl,
        JSON,
        setTimeout: () => {},
        clearTimeout: () => {},
        requestAnimationFrame: cb => cb(),
        localStorage: mockLocalStorage,
        sessionStorage: mockSessionStorage,
        document: {
            documentElement: { lang: 'zh-CN' },
            title: '',
            querySelector: () => mockElement,
            querySelectorAll: () => [],
            createElement: () => ({ ...mockElement }),
            addEventListener: () => {}
        },
        window: {}
    };
    sandbox.window = sandbox;

    vm.runInNewContext(scriptContent, sandbox);
    return sandbox.window.__meetingAttendance;
}

test('classifySheet recognises both classic and new WFM formats', () => {
    const api = loadMeetingAttendance();

    // Classic WFM format
    const classicSheet = {
        headers: ['Task ID', 'FME Name', 'Customer Group', 'BU', 'Product Line', 'Service Type', 'TD', 'PM'],
        rows: [
            ['TK20260901000001', 'Test User 12345', 'EG-Egypt Telecom', 'NIS', 'Wireless', 'Integration', '', '']
        ]
    };
    assert.equal(api.classifySheet(classicSheet), 'wfm');

    // User's new WFM table format
    const newWfmSheet = {
        headers: [
            '变更单号/Change Number', 'RFC级别/RFC Level', '操作级别/Operation Level', '操作类型/Operation Type',
            '实施任务单号/Implementation Task No', '标题/title', '创建时间/Create Time', '任务完成时间/Task Complete Time',
            '变更单状态/RFC Status', 'ICT场景/ICT Scenario', 'BU/Service Type', '是否核心网元/Key NE',
            '地区部/Region', '代表处/Rep. Office', '客户名称/Customer Name', '国家/区域/行业/Country/Region/Industry',
            '网络/Network', '大T/Tier-1 Operator', '客户分部/Branch', '子网/Subnet',
            'NA级别/NA Level', '产品线 / Product Line', '产品线-作业单 / Product Line - Ticket', 'Product Class',
            'SPDT', 'PDT', '产品/Product', '建单人/Creator',
            '实施人/Oprator', '操作单状态/Operate Progress', '高核资质是否满足/Whether The High Core Qualification Is Met',
            '资质级别/Qualification Level', '紧急程度/Urgency Level'
        ],
        rows: [
            [
                'NC20260903001738', 'Low', 'Low', 'Network Integration',
                'TK20260907007435', 'LTE integration NEW sites', '2026-09-07 12:07:41', '2026-09-07 18:59:43',
                'Implement', 'CNBG', 'NIS', '否',
                '北部非洲地区部', '埃及代表处', 'Telecom Egypt', '埃及',
                'EG-Egypt Telecom', '虚拟系统部', 'TE系统部', '埃及 Telecom',
                '', '无线', 'Wireless', '5G&LTE FDD',
                'FDD LTE', '', 'BTS3900 LTE', 'SERAG SAMIR SAAD 84347085',
                'SERAG SAMIR SAAD 84347085', '已完成', '否',
                '', '正常'
            ],
            [
                'NC20260820001451', 'High', 'High', 'Patch Update',
                'TK20260907000188', 'TE-IMS install hot Patch update for CE Switches', '2026-09-06 17:59:02', '2026-09-07 00:54:18',
                'Implement', 'CNBG', 'AMS', '否',
                '北部非洲地区部', '埃及代表处', 'Telecom Egypt', '埃及',
                'EG-Egypt Telecom', '虚拟系统部', 'TE系统部', '埃及 Telecom',
                '', '数通', 'Data Communication', '数据中心网络',
                '数据中心交换机', '', 'CE6863E-48S6CQ', 'Malak Talaat Shokry 84322814',
                'Malak Talaat Shokry 84322814', '已完成', '否',
                '', '正常'
            ]
        ]
    };
    assert.equal(api.classifySheet(newWfmSheet), 'wfm');
});

test('extractWfmPeople and extractAllPeople correctly extract and map new WFM table data', () => {
    const api = loadMeetingAttendance();

    const sampleRows = [
        [
            'NC20260903001738', 'Low', 'Low', 'Network Integration',
            'TK20260907007435', 'LTE integration NEW sites', '2026-09-07 12:07:41', '2026-09-07 18:59:43',
            'Implement', 'CNBG', 'NIS', '否',
            '北部非洲地区部', '埃及代表处', 'Telecom Egypt', '埃及',
            'EG-Egypt Telecom', '虚拟系统部', 'TE系统部', '埃及 Telecom',
            '', '无线', 'Wireless', '5G&LTE FDD',
            'FDD LTE', '', 'BTS3900 LTE', 'SERAG SAMIR SAAD 84347085',
            'SERAG SAMIR SAAD 84347085', '已完成', '否',
            '', '正常'
        ],
        [
            'NC20260820001451', 'High', 'High', 'Patch Update',
            'TK20260907000188', 'TE-IMS install hot Patch update for CE Switches', '2026-09-06 17:59:02', '2026-09-07 00:54:18',
            'Implement', 'CNBG', 'AMS', '否',
            '北部非洲地区部', '埃及代表处', 'Telecom Egypt', '埃及',
            'EG-Egypt Telecom', '虚拟系统部', 'TE系统部', '埃及 Telecom',
            '', '数通', 'Data Communication', '数据中心网络',
            '数据中心交换机', '', 'CE6863E-48S6CQ', 'Malak Talaat Shokry 84322814',
            'Malak Talaat Shokry 84322814', '已完成', '否',
            '', '正常'
        ]
    ];

    const headers = [
        '变更单号/Change Number', 'RFC级别/RFC Level', '操作级别/Operation Level', '操作类型/Operation Type',
        '实施任务单号/Implementation Task No', '标题/title', '创建时间/Create Time', '任务完成时间/Task Complete Time',
        '变更单状态/RFC Status', 'ICT场景/ICT Scenario', 'BU/Service Type', '是否核心网元/Key NE',
        '地区部/Region', '代表处/Rep. Office', '客户名称/Customer Name', '国家/区域/行业/Country/Region/Industry',
        '网络/Network', '大T/Tier-1 Operator', '客户分部/Branch', '子网/Subnet',
        'NA级别/NA Level', '产品线 / Product Line', '产品线-作业单 / Product Line - Ticket', 'Product Class',
        'SPDT', 'PDT', '产品/Product', '建单人/Creator',
        '实施人/Oprator', '操作单状态/Operate Progress', '高核资质是否满足/Whether The High Core Qualification Is Met',
        '资质级别/Qualification Level', '紧急程度/Urgency Level'
    ];

    api.state.sheets = [
        {
            id: 'sheet_1',
            category: 'wfm',
            fileName: 'wfm_new.xlsx',
            sheetName: 'Sheet1',
            headers,
            rows: sampleRows,
            visibleColumns: api.defaultColumnIndices('wfm', headers),
            page: 1,
            order: 1
        }
    ];

    const wfmPeople = api.extractWfmPeople();
    assert.equal(wfmPeople.length, 2);

    const p1 = wfmPeople.find(p => p.account === '84347085');
    assert.ok(p1, 'SERAG SAMIR SAAD 84347085 should be found');
    assert.equal(p1.role, 'FME');
    assert.equal(p1.bu, 'NIS');
    assert.equal(p1.customer, 'EG-Egypt Telecom');
    assert.equal(p1.count, 1, 'Same person in same row as both creator and operator should only count 1 task');

    const p2 = wfmPeople.find(p => p.account === '84322814');
    assert.ok(p2, 'Malak Talaat Shokry 84322814 should be found');
    assert.equal(p2.role, 'FME');
    assert.equal(p2.bu, 'AMS');
    assert.equal(p2.customer, 'EG-Egypt Telecom');
    assert.equal(p2.count, 1);

    // Test merged all-people extraction and customer mapping
    const allPeople = api.extractAllPeople([], [], wfmPeople, new Map());
    assert.equal(allPeople.length, 2);

    const mergedP1 = allPeople.find(p => p.account === '84347085');
    assert.equal(mergedP1.customer, 'TE', 'EG-Egypt Telecom should map to TE');
    assert.equal(mergedP1.bu, 'NIS');

    const mergedP2 = allPeople.find(p => p.account === '84322814');
    assert.equal(mergedP2.customer, 'TE', 'EG-Egypt Telecom should map to TE');
    assert.equal(mergedP2.bu, 'AMS');
});

test('searchRequiredRows searches across new WFM fields and returns role information', () => {
    const api = loadMeetingAttendance();

    const headers = [
        '变更单号/Change Number', 'RFC级别/RFC Level', '操作级别/Operation Level', '操作类型/Operation Type',
        '实施任务单号/Implementation Task No', '标题/title', '创建时间/Create Time', '任务完成时间/Task Complete Time',
        '变更单状态/RFC Status', 'ICT场景/ICT Scenario', 'BU/Service Type', '是否核心网元/Key NE',
        '地区部/Region', '代表处/Rep. Office', '客户名称/Customer Name', '国家/区域/行业/Country/Region/Industry',
        '网络/Network', '大T/Tier-1 Operator', '客户分部/Branch', '子网/Subnet',
        'NA级别/NA Level', '产品线 / Product Line', '产品线-作业单 / Product Line - Ticket', 'Product Class',
        'SPDT', 'PDT', '产品/Product', '建单人/Creator',
        '实施人/Oprator', '操作单状态/Operate Progress', '高核资质是否满足/Whether The High Core Qualification Is Met',
        '资质级别/Qualification Level', '紧急程度/Urgency Level'
    ];

    const row = [
        'NC20260903001738', 'Low', 'Low', 'Network Integration',
        'TK20260907007435', 'LTE integration NEW sites', '2026-09-07 12:07:41', '2026-09-07 18:59:43',
        'Implement', 'CNBG', 'NIS', '否',
        '北部非洲地区部', '埃及代表处', 'Telecom Egypt', '埃及',
        'EG-Egypt Telecom', '虚拟系统部', 'TE系统部', '埃及 Telecom',
        '', '无线', 'Wireless', '5G&LTE FDD',
        'FDD LTE', '', 'BTS3900 LTE', 'SERAG SAMIR SAAD 84347085',
        'SERAG SAMIR SAAD 84347085', '已完成', '否',
        '', '正常'
    ];

    api.state.sheets = [
        {
            id: 'sheet_1',
            category: 'wfm',
            fileName: 'wfm_new.xlsx',
            sheetName: 'Sheet1',
            headers,
            rows: [row],
            visibleColumns: api.defaultColumnIndices('wfm', headers),
            page: 1,
            order: 1
        }
    ];

    const results = api.searchRequiredRows('wfm', 'serag', new Set(['84347085']));
    assert.equal(results.length, 1);
    assert.deepEqual([...results[0].roles].sort(), ['Creator', 'FME'].sort(), 'Should match both FME and Creator roles in search');
});

test('end-to-end parses exact raw TSV sample provided by user', () => {
    const api = loadMeetingAttendance();

    const rawTsv = `变更单号/Change Number\tRFC级别/RFC Level\t操作级别/Operation Level\t操作类型/Operation Type\t实施任务单号/Implementation Task No\t标题/title\t创建时间/Create Time\t任务完成时间/Task Complete Time\t变更单状态/RFC Status\tICT场景/ICT Scenario\tBU/Service Type\t是否核心网元/Key NE\t地区部/Region\t代表处/Rep. Office\t客户名称/Customer Name\t国家/区域/行业/Country/Region/Industry\t网络/Network\t大T/Tier-1 Operator\t客户分部/Branch\t子网/Subnet\tNA级别/NA Level\t产品线 / Product Line\t产品线-作业单 / Product Line - Ticket\tProduct Class\tSPDT\tPDT\t产品/Product\t建单人/Creator\t实施人/Oprator\t操作单状态/Operate Progress\t高核资质是否满足/Whether The High Core Qualification Is Met\t资质级别/Qualification Level\t紧急程度/Urgency Level
NC20260903001738\tLow\tLow\tNetwork Integration\tTK20260907007435\tLTE integration NEW sites\t2026-09-07 12:07:41\t2026-09-07 18:59:43\tImplement\tCNBG\tNIS\t否\t北部非洲地区部\t埃及代表处\tTelecom Egypt\t埃及\tEG-Egypt Telecom\t虚拟系统部\tTE系统部\t埃及 Telecom\t\t无线\tWireless\t5G&LTE FDD\tFDD LTE\t\tBTS3900 LTE\tSERAG SAMIR SAAD 84347085\tSERAG SAMIR SAAD 84347085\t已完成\t否\t\t正常
NC20260820001451\tHigh\tHigh\tPatch Update\tTK20260907000188\tTE-IMS install hot Patch update for CE Switches\t2026-09-06 17:59:02\t2026-09-07 00:54:18\tImplement\tCNBG\tAMS\t否\t北部非洲地区部\t埃及代表处\tTelecom Egypt\t埃及\tEG-Egypt Telecom\t虚拟系统部\tTE系统部\t埃及 Telecom\t\t数通\tData Communication\t数据中心网络\t数据中心交换机\t\tCE6863E-48S6CQ\tMalak Talaat Shokry 84322814\tMalak Talaat Shokry 84322814\t已完成\t否\t\t正常`;

    const parsedMatrix = api.parseDelimited(rawTsv, '\t');
    const { headers, rows } = api.normalizeRows(parsedMatrix);

    assert.equal(headers.length, 33);
    assert.equal(rows.length, 2);

    const sheet = { name: 'WFM数据', headers, rows };
    assert.equal(api.classifySheet(sheet), 'wfm');

    const displayColumns = api.defaultColumnIndices('wfm', headers);
    const visibleNames = displayColumns.map(i => headers[i]);
    assert.ok(visibleNames.includes('实施任务单号/Implementation Task No'));
    assert.ok(visibleNames.includes('实施人/Oprator'));
    assert.ok(visibleNames.includes('建单人/Creator'));
    assert.ok(visibleNames.includes('网络/Network'));
    assert.ok(visibleNames.includes('BU/Service Type'));
    assert.ok(visibleNames.includes('产品线 / Product Line'));
    assert.ok(visibleNames.includes('操作类型/Operation Type'));

    api.state.sheets = [{
        id: 'user_tsv_sheet',
        category: 'wfm',
        fileName: 'wfm_export.tsv',
        sheetName: 'WFM数据',
        headers,
        rows,
        visibleColumns: displayColumns,
        page: 1,
        order: 1
    }];

    const wfmPeople = api.extractWfmPeople();
    assert.equal(wfmPeople.length, 2);
    const pSerag = wfmPeople.find(p => p.account === '84347085');
    assert.ok(pSerag);
    assert.equal(pSerag.name, 'SERAG SAMIR SAAD 84347085');
    assert.equal(pSerag.bu, 'NIS');
    assert.equal(pSerag.customer, 'EG-Egypt Telecom');

    const pMalak = wfmPeople.find(p => p.account === '84322814');
    assert.ok(pMalak);
    assert.equal(pMalak.name, 'Malak Talaat Shokry 84322814');
    assert.equal(pMalak.bu, 'AMS');
    assert.equal(pMalak.customer, 'EG-Egypt Telecom');
});

test('extracts both Creator and FME when they are different people in a row', () => {
    const api = loadMeetingAttendance();

    const headers = [
        '实施任务单号/Implementation Task No', 'BU/Service Type', '网络/Network', '创建时间/Create Time',
        '建单人/Creator', '实施人/Oprator'
    ];
    const rows = [
        [
            'TK20260907009999', 'AMS', 'EG-Egypt Telecom', '2026-09-07 10:00:00',
            'Creator Person 11111111', 'Operator Person 22222222'
        ]
    ];

    api.state.sheets = [{
        id: 'split_roles_sheet',
        category: 'wfm',
        fileName: 'split_roles.xlsx',
        sheetName: 'Sheet1',
        headers,
        rows,
        visibleColumns: api.defaultColumnIndices('wfm', headers),
        page: 1,
        order: 1
    }];

    const wfmPeople = api.extractWfmPeople();
    assert.equal(wfmPeople.length, 2);

    const operator = wfmPeople.find(p => p.account === '22222222');
    assert.ok(operator);
    assert.equal(operator.role, 'FME');
    assert.equal(operator.count, 1);

    const creator = wfmPeople.find(p => p.account === '11111111');
    assert.ok(creator);
    assert.equal(creator.role, 'Creator');
    assert.equal(creator.count, 1);
});
