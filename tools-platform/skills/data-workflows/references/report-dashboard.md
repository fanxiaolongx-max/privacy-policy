# Report Dashboard

Use this reference for `/report` changes.

## Files

- Page: `frontend/pages/report.html`
- Frontend script: `frontend/js/report/report.js`
- Backend route: `backend/routes/db.js`
- Related upstream module: `/sla`

## Behavior

The report dashboard turns SLA snapshots into customer-group KPI reporting:

- Generate customer-group KPI dashboards from SLA snapshots.
- Support target month switching.
- Generate ranking views by customer group, metric, and group.
- Support manual metric filling.
- Support metric grouping, weights, target configuration, and manual score adjustments.
- Detect due-soon records before unified save.
- Export Excel.
- Save report snapshots, category scores, and metric details into `data/report.db`.

## Matrix View

The weakness/perspective matrix shows:

- Global overall target status.
- Metric values by customer group.
- Scores by customer group.
- Metric groups.
- Header filtering.
- Per-metric proportional scoring switches.

## Proportional Scoring

Rules:

- Default is off.
- Users enable it per metric.
- When enabled, a failing customer group does not directly receive 0.
- For `>= target` metrics, score ratio is `actual / target`.
- For `<= target` metrics, score ratio is `target / actual`.
- Earned score is capped by the metric weight.
- Switch state persists into that metric's target configuration.

When saving a snapshot, preserve proportional scoring fields so monthly reports can display historical results without recalculating:

- `earned_score`
- `proportional_scoring`
- `completion_ratio`

## API Surface

The main backend route is mounted under `/api/db`.

Important behavior in `backend/routes/db.js`:

- `POST /api/db/save` accepts normal or compressed report payloads.
- Static image and Excel exports are stored under `data/images`.
- Existing rows for the same `snapshot_id` and `month` are deleted before re-saving that snapshot/month pair.

Check the route file for all current read endpoints before changing monthly or dashboard queries.

## Storage

Primary DB: `data/report.db`

Tables:

- `ReportSnapshots`: snapshot ID, target month, created time, standard total score, raw snapshot JSON, image path, Excel path.
- `ReportCategoryScores`: customer group, base score, manual score, final score.
- `ReportMetricData`: customer group, metric, weight, target, raw value, numeric value, fail flag, gap, earned score, proportional scoring state, completion ratio.
- `PlatformConfig`: report configuration.

Important distinction:

- `ReportSnapshots.raw_data_json` is a JSON string stored in SQLite.
- It is not the same thing as legacy file-based JSON storage under `backend/data/*.json`.

## Maintenance Notes

- Report dashboard changes can break monthly reports. Preserve入库 payload fields and saved result semantics.
- If a display calculation changes, decide whether it should affect only live dashboard display or also saved historical monthly output.
- If DB schema changes are needed, add `ALTER TABLE ... ADD COLUMN` compatibility calls.
- Keep `snapshot_id + month` behavior stable unless the user explicitly asks to change snapshot identity.

