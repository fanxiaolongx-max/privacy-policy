#!/usr/bin/env python3
"""Export Tools Platform SLA/report configuration into a portable JSON bundle.

The script intentionally uses only Python standard-library modules so the skill
can travel between agents without a package install step.
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


JSON_FILES = {
    "targets": "sla_targets.json",
    "prefs": "sla_prefs.json",
    "groups": "sla_groups.json",
    "categories": "sla_categories.json",
}


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def table_exists(conn: sqlite3.Connection, table: str) -> bool:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table,),
    ).fetchone()
    return bool(row)


def rows_as_dicts(conn: sqlite3.Connection, table: str) -> list[dict[str, Any]]:
    if not table_exists(conn, table):
        return []
    cur = conn.execute(f"SELECT * FROM {table}")
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def maybe_json(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    s = value.strip()
    if not s or s[0] not in "[{":
        return value
    try:
        return json.loads(s)
    except Exception:
        return value


def overlay_sqlite_config(bundle: dict[str, Any], db_path: Path) -> None:
    if not db_path.exists():
        return
    conn = sqlite3.connect(str(db_path))
    try:
        sqlite_rows: dict[str, list[dict[str, Any]]] = {}
        for table in (
            "sla_targets",
            "sla_prefs",
            "sla_categories",
            "sla_groups",
            "sla_group_items",
            "sys_dictionaries",
        ):
            rows = rows_as_dicts(conn, table)
            if not rows:
                continue
            sqlite_rows[table] = [
                {k: maybe_json(v) for k, v in row.items()} for row in rows
            ]
            bundle.setdefault("sqlite", {})[table] = sqlite_rows[table]

        if sqlite_rows.get("sla_targets"):
            bundle["targets"] = targets_from_sqlite(sqlite_rows["sla_targets"])
            bundle["source"] = "sqlite"

        if sqlite_rows.get("sla_prefs") or sqlite_rows.get("sys_dictionaries"):
            bundle["prefs"] = prefs_from_sqlite(
                sqlite_rows.get("sla_prefs", []),
                sqlite_rows.get("sys_dictionaries", []),
            )
            bundle["source"] = "sqlite"

        if sqlite_rows.get("sla_groups"):
            bundle["groups"] = groups_from_sqlite(
                sqlite_rows["sla_groups"],
                sqlite_rows.get("sla_group_items", []),
            )
            bundle["source"] = "sqlite"

        if sqlite_rows.get("sla_categories"):
            bundle["categories"] = [
                str(row.get("name") or "").strip()
                for row in sqlite_rows["sla_categories"]
                if str(row.get("name") or "").strip()
            ]
            bundle["source"] = "sqlite"
    finally:
        conn.close()

def overlay_report_sqlite_config(bundle: dict[str, Any], db_path: Path) -> None:
    if not db_path.exists():
        return
    conn = sqlite3.connect(str(db_path))
    try:
        if not table_exists(conn, "PlatformConfig"):
            return
        cur = conn.execute("SELECT key_name, value_json FROM PlatformConfig WHERE key_name IN ('welink_policy_v2', 'welink_template_config')")
        for row in cur.fetchall():
            key, val = row
            bundle.setdefault("report_config", {})[key] = maybe_json(val)
    finally:
        conn.close()


def targets_from_sqlite(rows: list[dict[str, Any]]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for row in rows:
        key = row.get("target_key")
        if not key:
            continue
        extra = row.get("extra_config_json")
        if isinstance(extra, str):
            try:
                extra = json.loads(extra or "{}")
            except Exception:
                extra = {}
        if not isinstance(extra, dict):
            extra = {}
        item = dict(extra)
        if row.get("label") is not None:
            item["label"] = row.get("label")
        if row.get("target_type") is not None:
            item["type"] = row.get("target_type")
        if row.get("weight") is not None:
            item["weight"] = row.get("weight")
        if row.get("auto_fill") is not None:
            item["autoFill"] = bool(row.get("auto_fill"))
        if row.get("is_percent") is not None:
            item["isPercent"] = bool(row.get("is_percent"))
        if row.get("exceed_by") is not None:
            item["exceedBy"] = row.get("exceed_by")
        if row.get("bonus") is not None:
            item["bonus"] = row.get("bonus")
        out[str(key)] = item
    return out


def prefs_from_sqlite(pref_rows: list[dict[str, Any]], dict_rows: list[dict[str, Any]]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for row in pref_rows:
        key = row.get("pref_key")
        if not key:
            continue
        payload = row.get("payload_json")
        if isinstance(payload, str):
            try:
                payload = json.loads(payload or "null")
            except Exception:
                payload = None
        out[str(key)] = payload
    i18n = {}
    for row in dict_rows:
        if row.get("category") == "i18n" or row.get("category") is None:
            i18n[str(row.get("dict_key"))] = str(row.get("dict_value", ""))
    if i18n:
        out["i18nMap"] = i18n
    return out


def groups_from_sqlite(group_rows: list[dict[str, Any]], item_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    item_map: dict[Any, list[tuple[int, str]]] = {}
    for row in item_rows:
        gid = row.get("group_id")
        item_map.setdefault(gid, []).append((int(row.get("item_sort_order") or 0), str(row.get("item_name") or "")))
    out = []
    for group in sorted(group_rows, key=lambda r: (int(r.get("sort_order") or 0), int(r.get("id") or 0))):
        gid = group.get("id")
        items = [name for _, name in sorted(item_map.get(gid, []))]
        out.append({
            "id": group.get("group_key") or f"group_{gid}",
            "name": group.get("name") or "",
            "metrics": items,
        })
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="Export Tools Platform config bundle.")
    parser.add_argument("--project-root", required=True, help="Path to tools-platform project root.")
    parser.add_argument("--output", required=True, help="Output JSON bundle path.")
    args = parser.parse_args()

    project_root = Path(args.project_root).expanduser().resolve()
    backend_data = project_root / "backend" / "data"

    bundle: dict[str, Any] = {
        "schema": "tools-platform-data-workflows-config-v1",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "project_root": str(project_root),
        "targets": {},
        "prefs": {},
        "groups": [],
        "categories": [],
        "sqlite": {},
    }

    for key, filename in JSON_FILES.items():
        default: Any = [] if key in {"groups", "categories"} else {}
        bundle[key] = read_json(backend_data / filename, default)

    overlay_sqlite_config(bundle, backend_data / "tools.db")
    overlay_report_sqlite_config(bundle, project_root / "data" / "report.db")


    # Map metric IDs back to labels for targets
    metric_labels = {}
    for key, payload in bundle["prefs"].items():
        if isinstance(payload, dict) and "customMetrics" in payload:
            for metric in payload["customMetrics"]:
                if isinstance(metric, dict) and "id" in metric and "label" in metric:
                    sec_id = key.replace("sla_prefs_", "")
                    full_id = f"{sec_id}_{metric['id']}"
                    metric_labels[full_id] = metric["label"]

    for t_id, t_data in bundle["targets"].items():
        if t_id in metric_labels and "label" not in t_data:
            t_data["label"] = metric_labels[t_id]


    # Create mappings for agents
    bundle["mappings"] = {
        "files_to_hash_hint": "独立表的文件名（去掉_Latest.xlsx后）使用 generate_schema_hash 生成 other_<hash> 作为 secId。例如 PBI_重急EOS 映射到 other_36ksoy。",
        "metric_id_to_label": metric_labels
    }

    out = Path(args.output).expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(bundle, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote config bundle: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
