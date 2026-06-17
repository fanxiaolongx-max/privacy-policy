const fs = require('fs');

async function test() {
    const payload = {
        metrics: [
            {
                label: '全量EOS-产品',
                target: '123',
                TE: { achv: '99', score: 10 },
                ORG: { achv: '99', score: 10 },
                ET: { achv: '99', score: 10 },
                VDF: { achv: '99', score: 10 }
            },
            {
                label: '全量EOS-版本',
                target: '456',
                TE: { achv: '88', score: 20 },
                ORG: { achv: '88', score: 20 },
                ET: { achv: '88', score: 20 },
                VDF: { achv: '88', score: 20 }
            }
        ],
        adjustments: [],
        totals: {
            subTotal: { TE: 0, ORG: 0, ET: 0, VDF: 0 },
            adjustTotal: { TE: 0, ORG: 0, ET: 0, VDF: 0 },
            weightInMonth: { TE: 0, ORG: 0, ET: 0, VDF: 0 },
            finalResult: { TE: 0, ORG: 0, ET: 0, VDF: 0 }
        }
    };

    const res = await fetch('http://127.0.0.1:4000/api/sla/export-yuxiang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    if (res.ok) {
        console.log("Success! Got blob");
        const blob = await res.blob();
        const buffer = await blob.arrayBuffer();
        fs.writeFileSync('export_test.xlsx', Buffer.from(buffer));
        console.log("Written export_test.xlsx");
    } else {
        console.log("Failed:", await res.text());
    }
}
test();
