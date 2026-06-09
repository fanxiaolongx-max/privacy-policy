# Data Import / SLA

Use this reference for `/sla` data import and SLA control center changes.

## Files

- Page: `frontend/pages/sla.html`
- Frontend scripts:
  - `frontend/js/sla/upload.js`
  - `frontend/js/sla/table.js`
  - `frontend/js/sla/metrics.js`
  - `frontend/js/sla/categories.js`
  - `frontend/js/sla/config.js`
  - `frontend/js/sla/events.js`
  - `frontend/js/sla/history.js`
  - `frontend/js/sla/prefs.js`
  - `frontend/js/sla/section.js`
- Backend routes:
  - `backend/routes/sla.js`
  - `backend/routes/upload.js`
- Repositories:
  - `backend/models/sla-categories-repository.js`
  - `backend/models/sla-groups-repository.js`
  - `backend/models/sla-prefs-repository.js`
  - `backend/models/sla-snapshots-repository.js`
  - `backend/models/sla-targets-repository.js`
  - `backend/models/upload-history-repository.js`

## Behavior

The SLA module imports and analyzes operational data:

- Import risk, rectification, CPT/special risk, SR, and vulnerability warning tables.
- Identify data type from table/file prefixes.
- Analyze due-soon, overdue, and risk items.
- Support target month switching.
- Support explicit data source selection and visible source labels, especially JSON versus SQLite.
- Persist upload history, table preferences, field widths, sort order, visible columns, metric rules, categories, groups, and targets.
- Save snapshots, read historical snapshots, and support compressed snapshot upload.
- Clean redundant historical snapshots while keeping the latest snapshot per day.

## Supported Data Type Examples

- Rectification: `PBI_自动抓取-整改详单_整改_Latest`
- Normal risk: `PBI_自动抓取-风险详单_Latest`
- CPT/special risk: `PBI_自动抓取-CPT风险详表_Latest`
- SR detail: `PBI_自动抓取-详单-SR_Latest`
- Vulnerability warning detail: `PBI_自动抓取-详单漏洞_漏洞预警_Latest`

## SR Rules

Important fields:

- `sr_status_name`: ticket status
- `open_date`: open date
- `exp_close_date`: expected close date
- `act_close_date`: actual close date
- `hw_sev_name` / `urgency`: severity / urgency
- `overdue`: upstream overdue flag

Suspended tickets can usually be ignored because the upstream expected close date is extended.

## Vulnerability Warning Rules

Important fields:

- `task_status`: current status
- `create_time`: creation time

Statuses entering the 30-day completion warning:

- `Checking`
- `Communication Dept`
- `Communication Customer`

Deadline is `create_time + 30 days`. Remaining 10 days or less is high-risk red; remaining 30 days or less is yellow reminder.

## API Surface

- `GET /api/sla/categories`
- `PUT /api/sla/categories`
- `GET /api/sla/groups`
- `PUT /api/sla/groups`
- `GET /api/sla/targets`
- `PUT /api/sla/targets`
- `GET /api/sla/snapshots`
- `POST /api/sla/snapshot`
- `PUT /api/sla/snapshots/:id`
- `DELETE /api/sla/snapshots/:id`
- `POST /api/sla/snapshots/cleanup-redundant`
- `GET /api/sla/prefs/:schemaHash`
- `PUT /api/sla/prefs/:schemaHash`
- `POST /api/sla/rename-metric`

## Storage

Primary storage is `backend/data/tools.db`:

- `upload_history`
- `sla_categories`
- `sla_targets`
- `sla_prefs`
- `sys_dictionaries`
- `sla_groups`
- `sla_group_items`
- `sla_snapshots`

Legacy/fallback JSON files may still exist under `backend/data/`:

- `upload_history.json`
- `sla_categories.json`
- `sla_targets.json`
- `sla_prefs.json`
- `sla_groups.json`
- `sla_snapshots.json`

Preserve repository-level source selection and response `X-Data-Source` behavior where present.

## Maintenance Notes

- Schema-hash-based preferences should remain compatible when import columns change.
- Snapshot payload compression is intentional; do not remove it when request payloads are large.
- If adding a metric rule, check both table analysis and report-dashboard consumption.
- Changes here often affect `/report` and `/monthly`; verify downstream assumptions.

