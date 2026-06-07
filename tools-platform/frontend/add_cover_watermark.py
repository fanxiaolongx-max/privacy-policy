import re
from pathlib import Path

TARGET = Path(__file__).resolve().parent / 'css' / 'pages' / 'praudit.css'

with open(TARGET, 'r') as f:
    content = f.read()

# Add new CSS classes for cover page, watermark, and kpi-label
new_classes = """
        .print-cover-page, #printReport .print-cover-page {
            height: 1050px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            page-break-after: always;
            position: relative;
        }

        .print-cover-title, #printReport .print-cover-title {
            font-size: 38px;
            font-weight: 700;
            color: #c8102e;
            margin-bottom: 20px;
            text-align: center;
            letter-spacing: 2px;
            border-bottom: 3px solid #c8102e;
            padding-bottom: 20px;
        }
        
        .print-cover-subtitle, #printReport .print-cover-subtitle {
            font-size: 18px;
            color: #555;
            letter-spacing: 1px;
            margin-bottom: 80px;
        }

        .print-cover-meta, #printReport .print-cover-meta {
            font-size: 14px;
            color: #333;
            text-align: center;
            line-height: 2;
        }

        .kpi-label, #printReport .kpi-label {
            color: #666;
            font-size: 12px;
            font-weight: 600;
        }

        .exec-summary-box, #printReport .exec-summary-box {
            background: #f4f5f6;
            padding: 20px;
            border-left: 4px solid #c8102e;
            margin-bottom: 30px;
            font-size: 14px;
            line-height: 1.6;
        }

        .watermark {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 9999;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' transform='rotate(-45, 200, 200)' font-family='Arial' font-size='24' fill='rgba(200,200,200,0.15)' font-weight='bold'%3E仅限内部传阅 / Internal Use Only%3C/text%3E%3C/svg%3E");
        }
"""

content = content.replace("/* ======= HUAWEI STYLE PRINT & PDF RENDERING ======= */", "/* ======= HUAWEI STYLE PRINT & PDF RENDERING ======= */\n" + new_classes)

with open(TARGET, 'w') as f:
    f.write(content)
