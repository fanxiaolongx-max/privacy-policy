#!/usr/bin/env python3
"""Risk & Overdue Extractor.

Standalone script to parse Tools Platform raw Excel/CSV exports and extract
high-risk or overdue records based on SLA rules, bypassing the Web UI.
Outputs a structured JSON report.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
import zipfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET

# === Helper Parsing Functions from monthly report script ===

def load_json(path: str | None, default: Any) -> Any:
    if not path:
        return default
    p = Path(path).expanduser()
    if not p.exists():
        return default
    return json.loads(p.read_text(encoding="utf-8"))

def read_csv(path: Path) -> list[dict[str, Any]]:
    for enc in ("utf-8-sig", "gb18030", "utf-8"):
        try:
            with path.open("r", encoding=enc, newline="") as f:
                return [dict(row) for row in csv.DictReader(f)]
        except UnicodeDecodeError:
            continue
    return []

def xlsx_col_to_index(cell_ref: str) -> int:
    letters = re.sub(r"[^A-Z]", "", cell_ref.upper())
    n = 0
    for ch in letters:
        n = n * 26 + ord(ch) - ord("A") + 1
    return n - 1

def excel_date(serial: float) -> datetime:
    return datetime(1899, 12, 30) + timedelta(days=float(serial))

def read_xlsx(path: Path) -> list[dict[str, Any]]:
    ns = {
        "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
        "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
        "officeRel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    }
    with zipfile.ZipFile(path) as zf:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in zf.namelist():
            root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            for si in root.findall("main:si", ns):
                parts = [t.text or "" for t in si.findall(".//main:t", ns)]
                shared.append("".join(parts))

        date_styles = set()
        if "xl/styles.xml" in zf.namelist():
            styles = ET.fromstring(zf.read("xl/styles.xml"))
            custom_date_numfmts = set()
            numfmts = styles.find("main:numFmts", ns)
            if numfmts is not None:
                for fmt in numfmts.findall("main:numFmt", ns):
                    code = (fmt.attrib.get("formatCode") or "").lower()
                    if any(token in code for token in ("yy", "mm", "dd", "日期")):
                        custom_date_numfmts.add(fmt.attrib.get("numFmtId"))
            builtin_date_ids = {str(i) for i in range(14, 23)} | {"45", "46", "47"}
            cellxfs = styles.find("main:cellXfs", ns)
            if cellxfs is not None:
                for idx, xf in enumerate(cellxfs.findall("main:xf", ns)):
                    num_id = xf.attrib.get("numFmtId")
                    if num_id in builtin_date_ids or num_id in custom_date_numfmts:
                        date_styles.add(str(idx))

        workbook = ET.fromstring(zf.read("xl/workbook.xml"))
        first_sheet = workbook.find("main:sheets/main:sheet", ns)
        if first_sheet is None:
            return []
        rel_id = first_sheet.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
        rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
        target = None
        for rel in rels.findall("rel:Relationship", ns):
            if rel.attrib.get("Id") == rel_id:
                target = rel.attrib.get("Target")
                break
        sheet_path = "xl/" + (target or "worksheets/sheet1.xml").lstrip("/")
        sheet = ET.fromstring(zf.read(sheet_path))

        rows: list[list[Any]] = []
        for row in sheet.findall(".//main:sheetData/main:row", ns):
            values: list[Any] = []
            for cell in row.findall("main:c", ns):
                idx = xlsx_col_to_index(cell.attrib.get("r", "A1"))
                while len(values) <= idx:
                    values.append("")
                typ = cell.attrib.get("t")
                style = cell.attrib.get("s")
                value_el = cell.find("main:v", ns)
                inline_el = cell.find("main:is", ns)
                raw = value_el.text if value_el is not None else None
                if typ == "s" and raw is not None:
                    val = shared[int(raw)] if raw.isdigit() and int(raw) < len(shared) else ""
                elif typ == "inlineStr" and inline_el is not None:
                    val = "".join(t.text or "" for t in inline_el.findall(".//main:t", ns))
                elif raw is None:
                    val = ""
                elif style in date_styles:
                    try:
                        val = excel_date(float(raw)).strftime("%Y-%m-%d %H:%M:%S")
                    except Exception:
                        val = raw
                else:
                    val = raw
                values[idx] = val
            if any(str(v).strip() for v in values):
                rows.append(values)
        if not rows:
            return []
        headers = [str(h).strip() or f"col_{i+1}" for i, h in enumerate(rows[0])]
        out = []
        for row in rows[1:]:
            item = {headers[i]: row[i] if i < len(row) else "" for i in range(len(headers))}
            if any(str(v).strip() for v in item.values()):
                out.append(item)
        return out

def read_table(path: Path) -> list[dict[str, Any]]:
    if path.suffix.lower() == ".xlsx":
        return read_xlsx(path)
    if path.suffix.lower() == ".csv":
        return read_csv(path)
    return []

def classify(path: Path) -> str:
    name = path.name
    lower = name.lower()
    if name.startswith("PBI_自动抓取-整改详单_整改_Latest"):
        return "rectification"
    if name.startswith("PBI_自动抓取-CPT风险详表_Latest"):
        return "special"
    if name.startswith("PBI_自动抓取-风险详单_Latest"):
        return "risk"
    if name.startswith("PBI_自动抓取-详单-SR_Latest"):
        return "sr"
    if name.startswith("PBI_自动抓取-详单漏洞_漏洞预警_Latest"):
        return "vulnerability"
    if "sr" in lower or "详单-sr" in lower:
        return "sr"
    if "漏洞" in lower or "vuln" in lower:
        return "vulnerability"
    if "cpt" in lower or "专项" in lower:
        return "special"
    if "整改" in lower or "rect" in lower:
        return "rectification"
    if "风险" in lower or "risk" in lower:
        return "risk"
    return "other"

# === Risk Analysis Logic (Python Port) ===

def get_compatible_val(row: dict[str, Any], keys: list[str]) -> str:
    for key in keys:
        if key in row and row[key] is not None and str(row[key]).strip() != "":
            return str(row[key]).strip()
    return ""

def parse_flexible_date(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    raw = str(value).strip()
    if not raw:
        return None
    normalized = raw.replace("\u00a0", " ").replace(".", "-").replace("/", "-").replace("T", " ")
    normalized = re.sub(r"Z$", "", normalized)
    try:
        if len(normalized) > 10:
            return datetime.strptime(normalized[:19], "%Y-%m-%d %H:%M:%S")
        else:
            return datetime.strptime(normalized[:10], "%Y-%m-%d")
    except ValueError:
        try:
            return datetime.strptime(normalized[:16], "%Y-%m-%d %H:%M")
        except ValueError:
            return None

def is_sr_closed_status(status_text: str) -> bool:
    s = str(status_text).lower()
    return any(t in s for t in ["closed", "resolved", "canceled", "cancelled"])

def is_sr_pending_status(status_text: str) -> bool:
    s = str(status_text).lower()
    return any(t in s for t in ["pending", "suspend", "suspended", "hold", "挂起"])

def get_sr_severity(row: dict[str, Any]) -> str:
    sev = get_compatible_val(row, ["hw_sev_name", "urgency"]).lower()
    if "critical" in sev or "schedule action" in sev or "immediate action" in sev:
        return "critical"
    if "major" in sev:
        return "major"
    if "minor" in sev:
        return "minor"
    return "normal"

def format_sr_duration(hours: int) -> str:
    abs_hours = abs(math.ceil(hours))
    if abs_hours <= 48:
        return f"{abs_hours} 小时"
    days = math.ceil(abs_hours / 24)
    if days < 7:
        return f"{days} 天"
    if days < 30:
        weeks = days // 7
        remain = days % 7
        return f"{weeks}周{remain}天" if remain else f"{weeks}周"
    months = days // 30
    remain = days % 30
    return f"{months}月{remain}天" if remain else f"{months}月"

def analyze_row(row: dict[str, Any], mode: str, now: datetime) -> dict[str, Any]:
    _sla_days = 999999
    _sla_text = "-"
    _row_class = ""
    
    if mode == "rectification":
        status = str(row.get("task_status", "")).strip()
        if status == "Checking":
            ct = parse_flexible_date(row.get("task_create_time"))
            if ct:
                dl = ct + timedelta(days=30)
                _sla_days = math.ceil((dl - now).total_seconds() / 86400)
                _sla_text = f"Checking剩余 {_sla_days} 天"
                if _sla_days <= 10:
                    _row_class = "danger-row"
                elif _sla_days < 30:
                    _row_class = "warning-row"
        elif status == "Rectification Implementation":
            ret = parse_flexible_date(row.get("rectify_plan_end_time"))
            if ret:
                _sla_days = math.ceil((ret - now).total_seconds() / 86400)
                _sla_text = f"整改剩余 {_sla_days} 天"
                if _sla_days <= 10:
                    _row_class = "danger-row"
                elif _sla_days < 82:
                    _row_class = "warning-row"

    elif mode == "risk":
        status = get_compatible_val(row, ["风险状态", "risk_status"])
        if status == "Risk Confirming":
            ct = parse_flexible_date(get_compatible_val(row, ["创单时间", "create_time_new", "create_time"]))
            if ct:
                dl = ct + timedelta(days=30)
                _sla_days = math.ceil((dl - now).total_seconds() / 86400)
                _sla_text = f"Confirm剩余 {_sla_days} 天"
                if _sla_days <= 10:
                    _row_class = "danger-row"
                elif _sla_days < 30:
                    _row_class = "warning-row"
        elif status == "Risk Open":
            ec = parse_flexible_date(get_compatible_val(row, ["期望关闭时间", "ticket_close_due_date", "due_time"]))
            if ec:
                _sla_days = math.ceil((ec - now).total_seconds() / 86400)
                _sla_text = f"Open剩余 {_sla_days} 天"
                if _sla_days <= 10:
                    _row_class = "danger-row"
                elif _sla_days < 30:
                    _row_class = "warning-row"
        elif status == "Risk Suspended":
            ss = parse_flexible_date(get_compatible_val(row, ["期望关闭时间-挂起", "suspend_due_date"]))
            if ss:
                _sla_days = math.ceil((ss - now).total_seconds() / 86400)
                _sla_text = f"Suspend剩余 {_sla_days} 天"
                if _sla_days <= 10:
                    _row_class = "danger-row"
                elif _sla_days < 30:
                    _row_class = "warning-row"

    elif mode == "special":
        status = get_compatible_val(row, ["状态-Status", "task_status_en", "task_status", "task_status_cn"])
        if status in ["待确认", "草稿", "Draft", "To Be Confirmed"]:
            ct = parse_flexible_date(get_compatible_val(row, ["创建日期-Create Date", "create_time"]))
            if ct:
                dl = ct + timedelta(days=30)
                _sla_days = math.ceil((dl - now).total_seconds() / 86400)
                _sla_text = f"确认剩余 {_sla_days} 天"
                if _sla_days <= 10:
                    _row_class = "danger-row"
                elif _sla_days < 30:
                    _row_class = "warning-row"
        elif status in ["处理中", "评审中", "Processing", "Reviewing"]:
            ec = parse_flexible_date(get_compatible_val(row, ["要求完成日期-Required Completion Date", "required_completion_time", "plan_complete_date"]))
            if ec:
                _sla_days = math.ceil((ec - now).total_seconds() / 86400)
                _sla_text = f"处理剩余 {_sla_days} 天"
                if _sla_days <= 10:
                    _row_class = "danger-row"
                elif _sla_days < 30:
                    _row_class = "warning-row"

    elif mode == "vulnerability":
        status = get_compatible_val(row, ["task_status"])
        if status in ["Checking", "Communication Dept", "Communication Customer"]:
            ct = parse_flexible_date(get_compatible_val(row, ["create_time", "task_create_time"]))
            if ct:
                dl = ct + timedelta(days=30)
                _sla_days = math.ceil((dl - now).total_seconds() / 86400)
                _sla_text = f"漏洞剩余 {_sla_days} 天"
                if _sla_days <= 10:
                    _row_class = "danger-row"
                elif _sla_days < 30:
                    _row_class = "warning-row"

    elif mode == "sr":
        status = get_compatible_val(row, ["sr_status_name"])
        overdue_flag = get_compatible_val(row, ["overdue"]).lower()
        severity = get_sr_severity(row)
        open_date = parse_flexible_date(get_compatible_val(row, ["open_date"]))
        exp_close_date = parse_flexible_date(get_compatible_val(row, ["exp_close_date"]))
        act_close_date = parse_flexible_date(get_compatible_val(row, ["act_close_date"]))
        
        if is_sr_pending_status(status):
            _sla_text = "挂起忽略"
        elif is_sr_closed_status(status):
            if (act_close_date and exp_close_date and act_close_date > exp_close_date) or overdue_flag == 'y':
                overdue_hours = math.ceil((act_close_date - exp_close_date).total_seconds() / 3600) if (act_close_date and exp_close_date) else 0
                _row_class = "danger-row"
                _sla_text = f"历史超期: 已超 {format_sr_duration(overdue_hours)}" if overdue_hours > 0 else "已触发上游超期标识"
            else:
                _sla_text = "已正常关单"
        elif open_date and exp_close_date:
            total_sec = (exp_close_date - open_date).total_seconds()
            consumed_sec = (now - open_date).total_seconds()
            remaining_sec = (exp_close_date - now).total_seconds()
            remaining_hours = math.ceil(remaining_sec / 3600)
            consume_rate = (consumed_sec / total_sec * 100) if total_sec > 0 else 100
            
            if remaining_sec < 0 or overdue_flag == 'y':
                _row_class = "danger-row"
                _sla_text = f"SR超期: 已超 {format_sr_duration(abs(remaining_hours))}"
            elif severity == "critical":
                if consume_rate > 85 or remaining_hours < 12:
                    _row_class = "danger-row"
                    _sla_text = f"Critical高危 (剩 {format_sr_duration(remaining_hours)} / 耗 {consume_rate:.0f}%)"
                elif consume_rate > 70 and remaining_hours < 48:
                    _row_class = "warning-row"
                    _sla_text = f"Critical预警 (剩 {format_sr_duration(remaining_hours)} / 耗 {consume_rate:.0f}%)"
            else:
                if consume_rate > 95:
                    _row_class = "danger-row"
                    _sla_text = f"SR高危 (剩 {format_sr_duration(remaining_hours)} / 耗 {consume_rate:.0f}%)"
                elif consume_rate > 80:
                    _row_class = "warning-row"
                    _sla_text = f"SR预警 (剩 {format_sr_duration(remaining_hours)} / 耗 {consume_rate:.0f}%)"

    return {
        **row,
        "_slaClass": _row_class,
        "_slaText": _sla_text
    }

def main():
    parser = argparse.ArgumentParser(description="Extract SLA Risks and Overdue items.")
    parser.add_argument("--input-dir", required=True, help="Directory containing raw import XLSX/CSV files.")
    parser.add_argument("--output", default="risk_report.json", help="Output JSON file for the report.")
    parser.add_argument("--report-date", help="Optional reference date (YYYY-MM-DD), default is now.")
    args = parser.parse_args()

    input_dir = Path(args.input_dir).expanduser()
    if not input_dir.is_dir():
        print(f"Error: {input_dir} is not a directory.")
        return 1

    if args.report_date:
        try:
            now = datetime.strptime(args.report_date, "%Y-%m-%d")
        except ValueError:
            print("Error: --report-date must be YYYY-MM-DD")
            return 1
    else:
        now = datetime.now()

    report = {}

    for file_path in input_dir.glob("*.*"):
        if file_path.name.startswith("~") or file_path.suffix.lower() not in [".xlsx", ".csv"]:
            continue

        mode = classify(file_path)
        print(f"Processing {file_path.name} (mode: {mode})...")
        rows = read_table(file_path)

        danger_items = []
        warning_items = []

        for row in rows:
            analyzed = analyze_row(row, mode, now)
            cls = analyzed.get("_slaClass")
            if cls == "danger-row":
                danger_items.append(analyzed)
            elif cls == "warning-row":
                warning_items.append(analyzed)

        if danger_items or warning_items:
            report[file_path.name] = {
                "mode": mode,
                "total_rows": len(rows),
                "danger_count": len(danger_items),
                "warning_count": len(warning_items),
                "danger_items": danger_items,
                "warning_items": warning_items
            }

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Analysis complete based on reference date {now.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 50)
    for k, v in report.items():
        print(f"📄 {k}")
        print(f"   🔴 高危/超期 (Danger): {v['danger_count']} 条")
        print(f"   🟠 预警/临期 (Warning): {v['warning_count']} 条")
    print("=" * 50)
    print(f"Full detailed report saved to {args.output}")

if __name__ == "__main__":
    main()
