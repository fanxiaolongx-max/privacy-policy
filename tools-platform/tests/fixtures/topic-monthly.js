function netcare() {
    return {
        schema: 'uivf12-topic-snapshot', version: 1, platform: 'netcare',
        capturedAt: '2026-09-22T09:00:00.000Z', exportedAt: '2026-09-22T09:00:00.000Z',
        settings: { year: 2026, month: 9, eos: { targets: { product: 40, version: 80 }, plans: {} } },
        data: {
            certificate: [
                { customer_name: 'Customer A', product_line_name: 'Wireless', product_name: 'P1', task_id: 'C1', need_reduce_cnt: 20, reduced_cnt: 5 },
                { customer_name: 'Customer B', product_line_name: 'IP', product_name: 'P2', task_id: 'C2', need_reduce_cnt: 30, reduced_cnt: 25 }
            ],
            eosProduct: [{ customer_name: 'Customer A', product_name: 'P1', incorporation_total_nes: 20, incorporated_nes: 5, to_be_incorporated_nes: 15 }],
            eosVersion: [{ customer_name: 'Customer A', product_name: 'P1', software_version: 'V1', incorporation_total_nes: 10, incorporated_nes: 8, to_be_incorporated_nes: 2 }],
            change: { currentYear: 2026, previousYear: 2025, currentMonth: 8, rows: [
                { scope: 'TOTAL', year: 2026, month: 1, task_count: 100, operation_success_rate: 0.9, rollback_count: 10, high_core_total_count: 8 },
                { scope: 'TOTAL', year: 2026, month: 8, task_count: 300, operation_success_rate: 1, rollback_count: 0, high_core_total_count: 2 },
                { scope: 'CNBG', year: 2026, month: 8, task_count: 250, operation_success_rate: 1, rollback_count: 0, high_core_total_count: 2 },
                { scope: 'TOTAL', year: 2025, month: 8, task_count: 200, operation_success_rate: 1 }
            ] },
            interception: { currentYear: 2026, previousYear: 2025, currentMonth: 9, rows: [
                { scope: 'TOTAL', year: 2026, month: 9, interception_cnt: 40, commands_interception_cnt: 30, graphical_interception_cnt: 10 },
                { scope: 'CNBG', year: 2026, month: 9, interception_cnt: 35, commands_interception_cnt: 25, graphical_interception_cnt: 10 },
                { scope: 'TOTAL', year: 2025, month: 9, interception_cnt: 0 }
            ] },
            sr: { currentYear: 2026, previousYear: 2025, currentMonth: 9, summary: [
                { scope: 'TOTAL', period: 'currentYtd', sr_total: 110, sr_frt: 0.99, unclose_sr_cnt: 10, overdue_sr_cnt: 2, major_sr_cnt: 3, critical_sr_cnt: 1 },
                { scope: 'TOTAL', period: 'previousYtd', sr_total: 100, sr_frt: 0.95, unclose_sr_cnt: 4, overdue_sr_cnt: 1 },
                { scope: 'CNBG', period: 'currentYtd', sr_total: 100, sr_frt: 0.99 }
            ], monthly: [
                { year: 2026, month: 8, sr_total: 80, sr_frt: 1, unclose_sr_cnt: 5, overdue_sr_cnt: 1, major_sr_cnt: 2, critical_sr_cnt: 0 },
                { year: 2026, month: 9, sr_total: 30, sr_frt: 0.95, unclose_sr_cnt: 5, overdue_sr_cnt: 1, major_sr_cnt: 1, critical_sr_cnt: 1 }
            ] }
        }
    };
}
function datafab() {
    return {
        schema: 'uivf12-topic-snapshot', version: 1, platform: 'datafab', capturedAt: '2026-09-22T09:00:00.000Z', exportedAt: '2026-09-22T09:00:00.000Z',
        settings: { year: 2026, month: 9, excludeIct: true, excludePendingScore: true, targets: { returnRate: 95, recordRate: 10 } },
        data: { months: [
            { year: 2026, month: 8, required: 50, returned: 45, pending: 5, returnRate: 90, recorded: 5, recordRate: 10 },
            { year: 2026, month: 9, required: 100, returned: 90, pending: 10, returnRate: 90, recorded: 20, recordRate: 20, productLines: [{ key: 'IP', labelZh: '数通', labelEn: 'IP', required: 100, returned: 90, pending: 10, rate: 90 }] }
        ], detail: [{ '备案原因': 'old month must not be used' }], detailsByMonth: { 9: [
            { '任务单号': 'D1', '备案原因': '客户限制', '产品线': '数通', '评分任务状态': '已完成' },
            { '任务单号': 'D2', '备案原因': '客户限制', '产品线': '数通', '评分任务状态': '已完成' },
            { '任务单号': 'D3', '备案原因': '待评分应剔除', '产品线': '数通', '评分任务状态': '待评分' },
            { '任务单号': 'D4', '备案原因': 'ICT应剔除', '产品线': 'ICT服务与软件', '评分任务状态': '已完成' },
            { '任务单号': 'D5', '备案原因': '', '产品线': '数通', '评分任务状态': '已完成' }
        ] } }
    };
}
module.exports = { netcare, datafab };
