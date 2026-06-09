# Storage Map

Use this reference when a task touches persistence, migration, or cross-module data flow.

## Relevant Databases and Files

`backend/data/tools.db`:

- `uiv_scripts`, `uiv_categories`: UIVF12 script repository.
- `upload_history`: import and operation history.
- `sla_categories`, `sla_targets`, `sla_prefs`, `sys_dictionaries`: SLA configuration, target months, column preferences, metric rules.
- `sla_groups`, `sla_group_items`: metric grouping used by SLA, report dashboard, and monthly report.
- `sla_snapshots`: imported SLA snapshots consumed by report dashboard.

`data/report.db`:

- `ReportSnapshots`: saved report snapshots and raw snapshot JSON.
- `ReportCategoryScores`: customer group scores.
- `ReportMetricData`: metric detail rows and scoring fields.
- `PlatformConfig`: report configuration.

`backend/data/*.json`:

- Legacy or fallback files for UIVF12 and SLA modules.
- Examples: `uiv_scripts.json`, `uiv_categories.json`, `sla_snapshots.json`, `sla_targets.json`, `sla_prefs.json`, `sla_groups.json`, `upload_history.json`.

`data/images`:

- Report dashboard screenshots and Excel exports.
- Served through `/api/db/images`.

## Data Flow

UIVF12:

`/uivf12` frontend -> `/api/uiv` -> `backend/data/tools.db` plus optional legacy JSON fallback.

SLA import:

`/sla` frontend -> `/api/sla` and `/api/upload` -> `backend/data/tools.db` plus optional legacy JSON fallback.

Report dashboard:

SLA snapshots/config -> `/report` frontend -> `/api/db/save` -> `data/report.db` and `data/images`.

Monthly report:

`/monthly` frontend -> `/api/db` read endpoints -> `data/report.db`, using `ReportSnapshots.raw_data_json` only as structural supplement.

## Compatibility Rules

- SQLite table JSON fields are still DB storage. Do not confuse `ReportSnapshots.raw_data_json` with old file-based JSON.
- Preserve legacy JSON fallback/source selection unless a migration is explicitly requested.
- Add DB columns compatibly. Existing deployments may already have old database files.
- Do not delete historical snapshots during feature work.

