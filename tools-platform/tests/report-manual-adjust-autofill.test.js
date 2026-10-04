const test = require('node:test');
const assert = require('node:assert/strict');
const autofill = require('../frontend/js/report/manual-adjust-autofill');

test('ReportManualAdjustAutoFill: auto-fills occurrences, reasons and attachments from previous snapshot', () => {
    const categories = ['TE', 'ORG'];
    const manualAdjustItems = [
        { type: '加分', name: '客户专项表彰', unit: 2, autoFill: true },
        { type: '扣分', name: '违规通报', unit: 1, autoFill: false }
    ];

    const sourceSnapshot = {
        id: 'snap-2026-02',
        timestamp: '2026-02-28 18:00',
        manualAdjustData: {
            TE: { '0': 2 },
            ORG: { '0': 1 }
        },
        manualAdjustDetails: {
            TE: {
                '0': {
                    records: [
                        {
                            id: 'old-rec-1',
                            occurredAt: '2026-02-10',
                            recorder: 'Alice',
                            reason: '高质量交付客户重大项目',
                            attachments: [
                                {
                                    url: '/api/db/images/cert-1.png',
                                    name: '交付感谢信.png',
                                    size: 204800,
                                    type: 'image/png'
                                }
                            ]
                        },
                        {
                            id: 'old-rec-2',
                            occurredAt: '2026-02-20',
                            recorder: 'Bob',
                            reason: '主动排查重大安全隐患',
                            attachments: [
                                {
                                    url: '/api/db/images/fix-proof.pdf',
                                    name: '隐患排查报告.pdf',
                                    size: 1048576,
                                    type: 'application/pdf'
                                }
                            ]
                        }
                    ]
                }
            },
            ORG: {
                '0': {
                    records: [
                        {
                            id: 'old-rec-3',
                            occurredAt: '2026-02-15',
                            recorder: 'Charlie',
                            reason: '组织内跨部门协作标兵',
                            attachments: []
                        }
                    ]
                }
            }
        }
    };

    const currentSnapshot = {
        id: 'snap-2026-03',
        timestamp: '2026-03-31 18:00',
        manualAdjustData: {},
        manualAdjustDetails: {}
    };

    const snapshots = [currentSnapshot, sourceSnapshot];

    const result = autofill.applyAutoFill({
        snapshot: currentSnapshot,
        snapshots,
        categories,
        manualAdjustItems,
        prefs: {},
        formatTime: s => s.timestamp
    });

    assert.equal(result.changed, true);
    assert.deepEqual(result.filledIndices, ['0']);

    // 验证 TE 的发生次数与详情
    assert.equal(currentSnapshot.manualAdjustData.TE['0'], 2);
    const teRecords = currentSnapshot.manualAdjustDetails.TE['0'].records;
    assert.equal(teRecords.length, 2);
    assert.equal(teRecords[0].reason, '高质量交付客户重大项目');
    assert.equal(teRecords[0].recorder, 'Alice');
    assert.equal(teRecords[0].occurredAt, '2026-02-10');
    assert.notEqual(teRecords[0].id, 'old-rec-1'); // 新生成的独立 ID
    assert.equal(teRecords[0].attachments.length, 1);
    assert.equal(teRecords[0].attachments[0].url, '/api/db/images/cert-1.png');
    assert.equal(teRecords[0].attachments[0].name, '交付感谢信.png');
    assert.equal(teRecords[0].attachments[0].size, 204800);
    assert.equal(teRecords[0].attachments[0].type, 'image/png');

    assert.equal(teRecords[1].reason, '主动排查重大安全隐患');
    assert.equal(teRecords[1].attachments[0].url, '/api/db/images/fix-proof.pdf');

    // 验证 ORG 的发生次数与详情
    assert.equal(currentSnapshot.manualAdjustData.ORG['0'], 1);
    const orgRecords = currentSnapshot.manualAdjustDetails.ORG['0'].records;
    assert.equal(orgRecords.length, 1);
    assert.equal(orgRecords[0].reason, '组织内跨部门协作标兵');

    // 验证来源追踪信息
    assert.deepEqual(currentSnapshot.manualAdjustAutoFillSources['0'], {
        snapshotId: 'snap-2026-02',
        timestamp: '2026-02-28 18:00',
        label: '2026-02-28 18:00'
    });

    // 验证变更审计日志存在
    assert.match(currentSnapshot.manualAdjustDetails.TE['0'].changeLog[0].summary, /2026-02-28 18:00/);
});

test('ReportManualAdjustAutoFill: preserves existing user edits and does not overwrite', () => {
    const categories = ['TE'];
    const manualAdjustItems = [
        { type: '加分', name: '客户专项表彰', unit: 2, autoFill: true }
    ];

    const sourceSnapshot = {
        id: 'snap-1',
        timestamp: '2026-01-31',
        manualAdjustData: { TE: { '0': 5 } },
        manualAdjustDetails: {
            TE: {
                '0': {
                    records: [{ id: 'src-1', reason: '历史理由', attachments: [] }]
                }
            }
        }
    };

    const currentSnapshot = {
        id: 'snap-2',
        timestamp: '2026-02-28',
        manualAdjustData: {
            TE: { '0': 1 }
        },
        manualAdjustDetails: {
            TE: {
                '0': {
                    records: [{ id: 'cur-1', reason: '当前快照用户手动填写的理由', attachments: [] }]
                }
            }
        }
    };

    const snapshots = [currentSnapshot, sourceSnapshot];

    const result = autofill.applyAutoFill({
        snapshot: currentSnapshot,
        snapshots,
        categories,
        manualAdjustItems,
        prefs: { '0': true }
    });

    assert.equal(result.changed, false);
    assert.equal(currentSnapshot.manualAdjustData.TE['0'], 1);
    assert.equal(currentSnapshot.manualAdjustDetails.TE['0'].records[0].reason, '当前快照用户手动填写的理由');
});

test('ReportManualAdjustAutoFill: works with globalConfig prefs toggle', () => {
    const categories = ['TE'];
    const manualAdjustItems = [
        { type: '加分', name: '客户专项表彰', unit: 2, autoFill: false } // item 本身 false
    ];

    const sourceSnapshot = {
        id: 'snap-1',
        timestamp: '2026-01-31',
        manualAdjustData: { TE: { '0': 3 } },
        manualAdjustDetails: {
            TE: {
                '0': {
                    records: [{ id: 'src-1', reason: '来源快照理由', attachments: [{ url: '/img/1.png', name: '1.png' }] }]
                }
            }
        }
    };

    const currentSnapshot = {
        id: 'snap-2',
        timestamp: '2026-02-28',
        manualAdjustData: {},
        manualAdjustDetails: {}
    };

    // 当 prefs['0'] 为 true 时应触发
    const result = autofill.applyAutoFill({
        snapshot: currentSnapshot,
        snapshots: [currentSnapshot, sourceSnapshot],
        categories,
        manualAdjustItems,
        prefs: { '0': true }
    });

    assert.equal(result.changed, true);
    assert.equal(currentSnapshot.manualAdjustData.TE['0'], 3);
    assert.equal(currentSnapshot.manualAdjustDetails.TE['0'].records[0].reason, '来源快照理由');
    assert.equal(currentSnapshot.manualAdjustDetails.TE['0'].records[0].attachments[0].name, '1.png');
});

test('ReportManualAdjustAutoFill: handles legacy note/attachments format correctly', () => {
    const categories = ['TE'];
    const manualAdjustItems = [
        { type: '加分', name: '老数据项', unit: 1, autoFill: true }
    ];

    const sourceSnapshot = {
        id: 'snap-old',
        timestamp: '2026-01-01',
        manualAdjustData: { TE: { '0': 1 } },
        manualAdjustDetails: {
            TE: {
                '0': {
                    note: '老版本单一备注内容',
                    attachments: [{ url: '/old/att.jpg', name: 'att.jpg' }]
                }
            }
        }
    };

    const currentSnapshot = {
        id: 'snap-new',
        timestamp: '2026-02-01',
        manualAdjustData: {},
        manualAdjustDetails: {}
    };

    const result = autofill.applyAutoFill({
        snapshot: currentSnapshot,
        snapshots: [currentSnapshot, sourceSnapshot],
        categories,
        manualAdjustItems
    });

    assert.equal(result.changed, true);
    assert.equal(currentSnapshot.manualAdjustDetails.TE['0'].records[0].reason, '老版本单一备注内容');
    assert.equal(currentSnapshot.manualAdjustDetails.TE['0'].records[0].attachments[0].url, '/old/att.jpg');
});
