#!/usr/bin/env python3
"""Generate an HTML monthly report from original Tools Platform import files.

This is a portable, dependency-free implementation. It reads XLSX first sheets
through zipfile/XML and CSV files through the standard csv module.
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import math
import re
import sys
import zipfile
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Iterable
from xml.etree import ElementTree as ET


SECTION_META = {
    "rectification": ("整改", "#1976d2"),
    "risk": ("常规风险", "#7b1fa2"),
    "special": ("CPT专项风险", "#00796b"),
    "sr": ("SR详单", "#d9480f"),
    "vulnerability": ("漏洞预警", "#c2410c"),
    "other": ("其他", "#64748b"),
}

PRIORITY_COLS = {
    "rectification": ["task_status", "task_create_time", "rectify_plan_end_time"],
    "risk": ["风险状态", "risk_status", "创单时间", "create_time", "期望关闭时间", "ticket_close_due_date", "期望关闭时间-挂起"],
    "special": ["状态-Status", "task_status_en", "task_status", "task_status_cn", "创建日期-Create Date", "create_time", "要求完成日期-Required Completion Date", "required_completion_time", "plan_complete_date"],
    "sr": ["hw_sev_name", "urgency", "sr_status_name", "open_date", "exp_close_date", "act_close_date", "overdue", "sr_num", "sr_id", "customer_name", "country_name_cn", "repoffice_name_cn"],
    "vulnerability": ["task_status", "create_time", "task_create_time", "vuln_id", "vulnerability_id", "漏洞编号", "漏洞名称", "vulnerability_name", "customer_name", "network_name"],
}

CLOSED_WORDS = ("closed", "close", "完成", "关闭", "已关闭", "已完成", "cancel", "取消", "done")


def esc(value: Any) -> str:
    return html.escape("" if value is None else str(value), quote=True)


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
                        val = excel_date(float(raw)).strftime("%Y-%m-%d")
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


def generate_schema_hash(text: str) -> str:
    h = 0
    for ch in text:
        h = ((h << 5) - h) + ord(ch)
        h &= 0xFFFFFFFF
        if h & 0x80000000:
            h -= 0x100000000
    n = abs(h)
    alphabet = "0123456789abcdefghijklmnopqrstuvwxyz"
    if n == 0:
        return "0"
    out = ""
    while n:
        n, rem = divmod(n, 36)
        out = alphabet[rem] + out
    return out


def other_base_name(filename: str) -> str:
    match = re.search(r"(.*?Latest)", filename, flags=re.I)
    if match:
        return match.group(1)
    return re.sub(r"\s*\(\d+\)$", "", re.sub(r"\.[a-zA-Z0-9]+$", "", filename))


def classify(path: Path, rows: list[dict[str, Any]]) -> str:
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
    headers = set(rows[0].keys()) if rows else set()
    best = ("other", 0)
    for sec, cols in PRIORITY_COLS.items():
        score = len(headers.intersection(cols))
        if score > best[1]:
            best = (sec, score)
    if best[1] > 0:
        return best[0]
    base = other_base_name(name)
    return "other_" + generate_schema_hash(base)


def parse_num(value: Any) -> float:
    s = str(value or "").strip().replace(",", "")
    if s.endswith("%"):
        s = s[:-1]
    m = re.search(r"-?\d+(?:\.\d+)?", s)
    return float(m.group(0)) if m else math.nan


def parse_date(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    s = str(value).strip()
    if not s:
        return None
    if re.fullmatch(r"\d+(?:\.\d+)?", s):
        try:
            n = float(s)
            if 20000 <= n <= 80000:
                return excel_date(n)
        except Exception:
            pass
    s = s.replace("/", "-").replace("T", " ")
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d", "%d-%m-%Y", "%m-%d-%Y"):
        try:
            return datetime.strptime(s[: len(fmt)], fmt)
        except Exception:
            continue
    return None


def first_value(row: dict[str, Any], names: Iterable[str]) -> Any:
    for name in names:
        if name in row and str(row[name]).strip() != "":
            return row[name]
    return ""


def customer_group(row: dict[str, Any]) -> str:
    return str(first_value(row, [
        "customer_name", "customer_name_cn", "客户群", "客户名称", "network_name",
        "repoffice_name_cn", "country_name_cn", "category", "Category",
    ]) or "未分组").strip() or "未分组"


def is_closed(value: Any) -> bool:
    s = str(value or "").strip().lower()
    return any(word in s for word in CLOSED_WORDS)


def due_date_for(sec: str, row: dict[str, Any]) -> datetime | None:
    if sec == "rectification":
        return parse_date(first_value(row, ["rectify_plan_end_time", "plan_complete_date", "要求完成日期-Required Completion Date"]))
    if sec == "risk":
        return parse_date(first_value(row, ["ticket_close_due_date", "期望关闭时间", "期望关闭时间-挂起", "required_completion_time"]))
    if sec == "special":
        return parse_date(first_value(row, ["required_completion_time", "要求完成日期-Required Completion Date", "plan_complete_date"]))
    if sec == "sr":
        return parse_date(first_value(row, ["exp_close_date", "期望关闭时间"]))
    if sec == "vulnerability":
        created = parse_date(first_value(row, ["create_time", "task_create_time", "创建时间"]))
        return created + timedelta(days=30) if created else None
    return None


def status_for(sec: str, row: dict[str, Any]) -> str:
    fields = {
        "rectification": ["task_status", "状态", "整改状态"],
        "risk": ["risk_status", "风险状态", "task_status"],
        "special": ["task_status_en", "task_status", "task_status_cn", "状态-Status"],
        "sr": ["sr_status_name", "status"],
        "vulnerability": ["task_status", "status"],
    }
    return str(first_value(row, fields.get(sec, [])) or "").strip()


def check_match(value: Any, pattern: Any) -> bool:
    s = str(value if value is not None else "").strip()
    p = str(pattern if pattern is not None else "").strip()
    if p == "[空]":
        return s == ""
    if p == "[非空]":
        return s != ""
    return p in s


def eval_rule(rule: dict[str, Any], rows: list[dict[str, Any]]) -> str:
    typ = rule.get("type")
    col_x = rule.get("colX")
    val_y = rule.get("valY")
    col_z = rule.get("colZ")
    val_k = rule.get("valK")
    if typ == "count":
        count = 0
        for row in rows:
            pass_x = True if not col_x else check_match(row.get(col_x), val_y)
            if pass_x and check_match(row.get(col_z), val_k):
                count += 1
        return str(count)
    if typ == "ratio":
        total = matched = 0
        for row in rows:
            pass_x = True if not col_x else check_match(row.get(col_x), val_y)
            if pass_x:
                total += 1
                if check_match(row.get(col_z), val_k):
                    matched += 1
        return f"{round((matched / total) * 100) if total else 0}%"
    for row in rows:
        if check_match(row.get(col_x), val_y):
            return str(row.get(col_z, "--") or "--")
    return "--"


def section_from_pref_key(key: str) -> str:
    if "rectification" in key:
        return "rectification"
    if "special" in key:
        return "special"
    if "risk" in key:
        return "risk"
    if "sr" in key:
        return "sr"
    if "vulnerability" in key:
        return "vulnerability"
    if key.startswith("sla_prefs_other_"):
        return key.replace("sla_prefs_", "", 1)
    return "other"


def collect_custom_metrics(config: dict[str, Any], grouped_rows: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    prefs = config.get("prefs") or {}
    metrics: list[dict[str, Any]] = []
    for key, pref in prefs.items():
        if not isinstance(pref, dict):
            continue
        sec = section_from_pref_key(key)
        for rule in pref.get("customMetrics") or []:
            if not isinstance(rule, dict):
                continue
            label = rule.get("label") or rule.get("colZ") or "未命名指标"
            value = eval_rule(rule, grouped_rows.get(sec, []))
            submetrics = []
            for sm in rule.get("subMetrics") or []:
                if not isinstance(sm, dict):
                    continue
                source_sec = sm.get("sourceSecId") or sec
                submetrics.append({
                    "category": sm.get("category") or "未分组",
                    "value": eval_rule(sm, grouped_rows.get(source_sec, [])),
                })
            metrics.append({
                "label": label,
                "value": value,
                "color": rule.get("color") or SECTION_META.get(sec, ("", "#64748b"))[1],
                "subMetrics": submetrics,
            })
    return metrics


def fallback_metrics(grouped_rows: dict[str, list[dict[str, Any]]], expiring: list[dict[str, Any]]) -> list[dict[str, Any]]:
    metrics = []
    for sec, rows in grouped_rows.items():
        if not rows:
            continue
        label, color = SECTION_META.get(sec, SECTION_META["other"])
        by_cat = defaultdict(int)
        for row in rows:
            by_cat[customer_group(row)] += 1
        metrics.append({
            "label": f"{label}总数",
            "value": str(len(rows)),
            "color": color,
            "subMetrics": [{"category": k, "value": str(v)} for k, v in sorted(by_cat.items())],
        })
    due_by_sec = defaultdict(int)
    for item in expiring:
        due_by_sec[item["collection"]] += 1
    for sec, count in due_by_sec.items():
        label, color = SECTION_META.get(sec, SECTION_META["other"])
        metrics.append({"label": f"{label}临期/超期数", "value": str(count), "color": color, "subMetrics": []})
    return metrics


def normalize_targets(config: dict[str, Any]) -> dict[str, Any]:
    targets = config.get("targets") or {}
    if isinstance(targets, dict):
        return targets
    return {}


def target_for_metric(targets: dict[str, Any], label: str) -> dict[str, Any] | None:
    for key, val in targets.items():
        if isinstance(val, dict) and (val.get("label") == label or key == label):
            return val
    return None


def completion_ratio(actual: float, target: float, condition: str) -> float:
    if not math.isfinite(actual) or not math.isfinite(target):
        return 0.0
    if condition == "lte":
        if actual <= target:
            return 1.0
        if actual <= 0:
            return 1.0 if target >= 0 else 0.0
        return max(0.0, min(1.0, target / actual))
    if actual >= target:
        return 1.0
    if target <= 0:
        return 1.0 if actual >= target else 0.0
    return max(0.0, min(1.0, actual / target))


def manual_score_for_category(
    cat: str,
    manual_adjust_items: list[dict[str, Any]],
    manual_adjust_data: dict[str, Any],
) -> float:
    cat_data = manual_adjust_data.get(cat) if isinstance(manual_adjust_data, dict) else {}
    if not isinstance(cat_data, dict):
        return 0.0
    total = 0.0
    for idx, item in enumerate(manual_adjust_items):
        if not isinstance(item, dict) or item.get("deleted"):
            continue
        try:
            occurrences = int(cat_data.get(str(idx), cat_data.get(idx, 0)) or 0)
        except Exception:
            occurrences = 0
        unit = float(item.get("unit") or 0)
        score = occurrences * unit
        cap = item.get("cap")
        if cap is not None:
            try:
                cap_num = float(cap)
                if score > cap_num:
                    score = cap_num
            except Exception:
                pass
        if item.get("type") == "扣分":
            score = -score
        total += score
    return round(total, 2)


def build_scores(
    metrics: list[dict[str, Any]],
    targets: dict[str, Any],
    month: int,
    manual_adjust_items: list[dict[str, Any]] | None = None,
    manual_adjust_data: dict[str, Any] | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], float]:
    cat_data: dict[str, dict[str, Any]] = {}
    metric_rows: list[dict[str, Any]] = []
    standard_total = 0.0
    for metric in metrics:
        label = str(metric.get("label") or "")
        target = target_for_metric(targets, label)
        weight = float(target.get("weight", 1) if target else 1)
        month_target = target.get(str(month)) if target else None
        if month_target is None and target:
            month_target = target.get(month)
        has_target = target is not None and month_target not in (None, "") and weight > 0
        standard_total += weight
        subs = metric.get("subMetrics") or []
        if not subs:
            subs = [{"category": "全局", "value": metric.get("value", "--")}]
        for sm in subs:
            cat = str(sm.get("category") or "未分组")
            cat_data.setdefault(cat, {
                "cat_name": cat,
                "earned_score_sum": 0.0,
                "valid_weight_sum": 0.0,
                "base_score": 0.0,
                "manual_score": 0.0,
                "final_score": 0.0,
            })
            raw = sm.get("value", "--")
            actual = parse_num(raw)
            is_failing = False
            gap = ""
            earned = 0.0
            ratio = 0.0
            prop = False
            target_str = "--"
            if has_target:
                target_num = parse_num(month_target)
                condition = target.get("type") or "gte"
                prop = bool(target.get("proportionalScoring") or target.get("proportional_scoring"))
                target_str = ("≤ " if condition == "lte" else "≥ ") + str(month_target)
                if math.isfinite(actual) and math.isfinite(target_num):
                    cat_data[cat]["valid_weight_sum"] += weight
                    if condition == "lte":
                        is_failing = actual > target_num
                        gap = f"{round(actual - target_num, 2)}" if is_failing else ""
                    else:
                        is_failing = actual < target_num
                        gap = f"{round(target_num - actual, 2)}" if is_failing else ""
                    ratio = completion_ratio(actual, target_num, condition)
                    bonus = 0.0
                    exceed_by = parse_num(target.get("exceedBy"))
                    bonus_unit = parse_num(target.get("bonus"))
                    if not is_failing and math.isfinite(exceed_by) and exceed_by > 0 and math.isfinite(bonus_unit) and bonus_unit > 0:
                        if condition == "lte" and actual < target_num:
                            bonus = math.floor((target_num - actual) / exceed_by) * bonus_unit
                        elif condition != "lte" and actual > target_num:
                            bonus = math.floor((actual - target_num) / exceed_by) * bonus_unit
                    earned = (round(weight * ratio, 4) if is_failing and prop else (0.0 if is_failing else weight)) + bonus
                    cat_data[cat]["earned_score_sum"] += earned
            metric_rows.append({
                "cat_name": cat,
                "metric_label": label,
                "weight": weight,
                "target_val": target_str,
                "raw_val": str(raw),
                "num_val": None if not math.isfinite(actual) else actual,
                "is_failing": is_failing,
                "gap": gap,
                "earned_score": earned,
                "proportional_scoring": prop,
                "completion_ratio": ratio,
            })
    for cat in cat_data.values():
        if cat["valid_weight_sum"] > 0:
            cat["base_score"] = round((cat["earned_score_sum"] / cat["valid_weight_sum"]) * standard_total, 2)
        cat["manual_score"] = manual_score_for_category(
            cat["cat_name"],
            manual_adjust_items or [],
            manual_adjust_data or {},
        )
        cat["final_score"] = round(cat["base_score"] + cat["manual_score"], 2)
    public_scores = [
        {
            "cat_name": c["cat_name"],
            "base_score": c["base_score"],
            "manual_score": c["manual_score"],
            "final_score": c["final_score"],
        }
        for c in cat_data.values()
    ]
    return sorted(public_scores, key=lambda x: x["final_score"], reverse=True), metric_rows, round(standard_total, 2)


def fallback_scores(grouped_rows: dict[str, list[dict[str, Any]]], expiring: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cats = defaultdict(lambda: {"total": 0, "due": 0})
    due_ids = set(id(item.get("data")) for item in expiring)
    for rows in grouped_rows.values():
        for row in rows:
            cat = customer_group(row)
            cats[cat]["total"] += 1
            if id(row) in due_ids:
                cats[cat]["due"] += 1
    out = []
    for cat, stat in cats.items():
        score = max(0.0, 100.0 - stat["due"] * 2)
        out.append({"cat_name": cat, "base_score": score, "manual_score": 0.0, "final_score": score})
    return sorted(out, key=lambda x: x["final_score"], reverse=True)


def find_expiring(grouped_rows: dict[str, list[dict[str, Any]]], report_date: datetime) -> list[dict[str, Any]]:
    target_date = datetime(report_date.year, report_date.month + 1, 5, 23, 59, 59) if report_date.month < 12 else datetime(report_date.year + 1, 1, 5, 23, 59, 59)
    target_days = math.ceil((target_date - report_date).total_seconds() / 86400)
    items = []
    for sec, rows in grouped_rows.items():
        for row in rows:
            status = status_for(sec, row)
            if is_closed(status):
                continue
            if sec == "vulnerability":
                vuln_status = str(first_value(row, ["task_status"]) or "")
                if vuln_status not in {"Checking", "Communication Dept", "Communication Customer"}:
                    continue
            due = due_date_for(sec, row)
            if not due:
                continue
            days = math.ceil((due - report_date).total_seconds() / 86400)
            if days <= target_days:
                items.append({
                    "collection": sec,
                    "title": SECTION_META.get(sec, SECTION_META["other"])[0],
                    "category": customer_group(row),
                    "status": status,
                    "due": due.strftime("%Y-%m-%d"),
                    "days": days,
                    "id": first_value(row, ["sr_num", "sr_id", "vuln_id", "vulnerability_id", "漏洞编号", "task_id", "ticket_id", "单号"]) or "",
                    "data": row,
                })
    return sorted(items, key=lambda x: (x["collection"], x["days"], x["category"]))


def render_html(payload: dict[str, Any]) -> str:
    cat_scores = payload["cat_scores"]
    metric_rows = payload["metric_data"]
    expiring = payload["expiringTickets"]
    grouped_rows = payload["grouped_counts"]
    failing = [m for m in metric_rows if m["is_failing"]]
    css = """
    body{margin:0;background:#f5f7fb;color:#172033;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",Arial,sans-serif}
    .page{max-width:1180px;margin:0 auto;padding:28px}
    h1{font-size:28px;margin:0 0 8px} h2{font-size:20px;margin:28px 0 12px}
    .muted{color:#667085}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{background:#fff;border:1px solid #e6eaf0;border-radius:8px;padding:14px}
    .kpi{font-size:28px;font-weight:750;margin-top:6px}.good{color:#16803c}.warn{color:#c2410c}.bad{color:#b42318}
    table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e6eaf0;border-radius:8px;overflow:hidden}
    th,td{padding:9px 10px;border-bottom:1px solid #eef1f5;text-align:left;font-size:13px;vertical-align:top}
    th{background:#f8fafc;color:#475467;font-weight:700}.pill{display:inline-block;padding:2px 7px;border-radius:999px;background:#eef2ff;color:#3538cd;font-size:12px}
    .section-title{border-left:4px solid #2563eb;padding-left:10px}.small{font-size:12px}.nowrap{white-space:nowrap}
    """
    rows_total = sum(grouped_rows.values())
    health = round(sum(c["final_score"] for c in cat_scores) / len(cat_scores), 2) if cat_scores else 0
    cards = [
        ("导入总行数", rows_total, ""),
        ("客户群数量", len(cat_scores), ""),
        ("临期/超期任务", len(expiring), "bad" if expiring else "good"),
        ("平均得分", health, "good" if health >= 90 else "warn" if health >= 75 else "bad"),
    ]
    card_html = "".join(f'<div class="card"><div class="muted">{esc(k)}</div><div class="kpi {cls}">{esc(v)}</div></div>' for k, v, cls in cards)
    cat_rows = "".join(
        f"<tr><td>{i+1}</td><td>{esc(c['cat_name'])}</td><td>{c['base_score']:.2f}</td><td>{c['manual_score']:.2f}</td><td><strong>{c['final_score']:.2f}</strong></td></tr>"
        for i, c in enumerate(cat_scores)
    )
    fail_rows = "".join(
        f"<tr><td>{esc(m['metric_label'])}</td><td>{esc(m['cat_name'])}</td><td>{esc(m['target_val'])}</td><td>{esc(m['raw_val'])}</td><td>{esc(m['gap'])}</td><td>{m['earned_score']:.2f}</td></tr>"
        for m in failing[:200]
    ) or '<tr><td colspan="6" class="good">当前无未达标指标。</td></tr>'
    exp_rows = "".join(
        f"<tr><td>{esc(e['title'])}</td><td>{esc(e['category'])}</td><td>{esc(e['id'])}</td><td>{esc(e['status'])}</td><td>{esc(e['due'])}</td><td class=\"nowrap\">{e['days']} 天</td></tr>"
        for e in expiring[:300]
    ) or '<tr><td colspan="6" class="good">当前无临期/超期任务。</td></tr>'
    metric_sample = "".join(
        f"<tr><td>{esc(m['metric_label'])}</td><td>{esc(m['cat_name'])}</td><td>{esc(m['target_val'])}</td><td>{esc(m['raw_val'])}</td><td>{'是' if m['is_failing'] else '否'}</td><td>{m['earned_score']:.2f}</td></tr>"
        for m in metric_rows[:300]
    )
    source_rows = "".join(f"<tr><td>{esc(SECTION_META.get(k, SECTION_META['other'])[0])}</td><td>{v}</td></tr>" for k, v in grouped_rows.items())
    return f"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(payload['month'])}月运营质量与合规月报</title><style>{css}</style></head>
<body><main class="page">
<h1>{esc(payload['month'])}月运营质量与合规分析报告</h1>
<div class="muted">生成时间：{esc(payload['created_at'])} · 数据来源：原始导入表格{ ' + 配置包' if payload.get('used_config') else '（未提供配置包，使用默认健康评分）' }</div>
<h2 class="section-title">一、整体状况与关键结论</h2>
<div class="grid">{card_html}</div>
<p>本次共识别 {rows_total} 行导入数据，覆盖 {len(cat_scores)} 个客户群；发现 {len(expiring)} 项临期/超期任务，未达标指标 {len(failing)} 项。</p>
<h2 class="section-title">二、数据来源</h2><table><thead><tr><th>模块</th><th>行数</th></tr></thead><tbody>{source_rows}</tbody></table>
<h2 class="section-title">三、客户群排名</h2><table><thead><tr><th>排名</th><th>客户群</th><th>基准得分</th><th>手工调整</th><th>最终得分</th></tr></thead><tbody>{cat_rows}</tbody></table>
<h2 class="section-title">四、短板矩阵</h2><table><thead><tr><th>指标</th><th>客户群</th><th>目标</th><th>实测值</th><th>差距</th><th>得分</th></tr></thead><tbody>{fail_rows}</tbody></table>
<h2 class="section-title">五、临期/超期任务</h2><table><thead><tr><th>类型</th><th>客户群</th><th>单号</th><th>状态</th><th>截止日期</th><th>剩余</th></tr></thead><tbody>{exp_rows}</tbody></table>
<h2 class="section-title">六、完整指标明细 <span class="pill">前300行</span></h2><table><thead><tr><th>指标</th><th>客户群</th><th>目标</th><th>实测值</th><th>未达标</th><th>得分</th></tr></thead><tbody>{metric_sample}</tbody></table>
</main></body></html>"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate Tools Platform HTML monthly report from original import files.")
    parser.add_argument("--input-dir", required=True, help="Directory containing XLSX/CSV import files.")
    parser.add_argument("--config", help="Optional config-bundle.json exported by export_config_bundle.py.")
    parser.add_argument("--month", type=int, required=True, help="Target month number, 1-12.")
    parser.add_argument("--output", required=True, help="Output HTML file.")
    parser.add_argument("--date", help="Report date, YYYY-MM-DD. Defaults to today.")
    parser.add_argument(
        "--manual-adjust-data",
        help="Optional JSON file with raw snapshot manualAdjustData, shaped as {category:{itemIndex:occurrences}}.",
    )
    args = parser.parse_args()

    input_dir = Path(args.input_dir).expanduser().resolve()
    if not input_dir.exists():
        print(f"Input directory not found: {input_dir}", file=sys.stderr)
        return 2
    report_date = parse_date(args.date) if args.date else datetime.now()
    if report_date is None:
        print("--date must be YYYY-MM-DD", file=sys.stderr)
        return 2
    config = load_json(args.config, {})
    grouped_rows: dict[str, list[dict[str, Any]]] = defaultdict(list)
    files = sorted([p for p in input_dir.iterdir() if p.suffix.lower() in {".xlsx", ".csv"}])
    for path in files:
        rows = read_table(path)
        sec = classify(path, rows)
        for row in rows:
            row["版本标识"] = row.get("版本标识") or path.stem
        grouped_rows[sec].extend(rows)
    expiring = find_expiring(grouped_rows, report_date)
    metrics = collect_custom_metrics(config, grouped_rows) if config else []
    if not metrics:
        metrics = fallback_metrics(grouped_rows, expiring)
    targets = normalize_targets(config)
    manual_adjust_data = load_json(args.manual_adjust_data, {})
    manual_adjust_items = (config.get("prefs") or {}).get("manualAdjustItems") or []
    cat_scores, metric_data, standard_total = build_scores(
        metrics,
        targets,
        args.month,
        manual_adjust_items=manual_adjust_items,
        manual_adjust_data=manual_adjust_data,
    )
    if not targets:
        cat_scores = fallback_scores(grouped_rows, expiring)
    payload = {
        "month": args.month,
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "files": [p.name for p in files],
        "used_config": bool(config),
        "standard_total_score": standard_total,
        "manualAdjustData": manual_adjust_data,
        "manualAdjustItems": manual_adjust_items,
        "cat_scores": cat_scores,
        "metric_data": metric_data,
        "expiringTickets": expiring,
        "grouped_counts": {k: len(v) for k, v in grouped_rows.items()},
    }
    out = Path(args.output).expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render_html(payload), encoding="utf-8")
    snapshot_path = out.with_suffix(".snapshot.json")
    snapshot_payload = dict(payload)
    snapshot_payload["expiringTickets"] = [
        {k: v for k, v in item.items() if k != "data"} for item in expiring
    ]
    snapshot_path.write_text(json.dumps(snapshot_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote HTML report: {out}")
    print(f"Wrote snapshot JSON: {snapshot_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
