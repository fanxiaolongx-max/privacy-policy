# Monthly Report

Use this reference for `/monthly` changes.

## Files

- Page: `frontend/pages/monthly.html`
- Frontend script: `frontend/js/report/monthly.js`
- Backend route/data source: `backend/routes/db.js`
- Source DB: `data/report.db`

## Behavior

The monthly report page shows monthly operational quality and compliance analysis:

- Target month switching.
- Time range filtering: latest 7 days, 30 days, 90 days, all, and custom ranges.
- Trend charts.
- Customer-group rankings.
- Weakness matrix.
- Full snapshot matrix.
- Manual score adjustment details.
- Chinese/English switching.
- Long image and PDF export.

## Source of Truth

Monthly report trend, customer-group scores, and metric details primarily come from `data/report.db`.

Preferred fields for already saved metric scores:

- `ReportMetricData.earned_score`
- `ReportMetricData.proportional_scoring`
- `ReportMetricData.completion_ratio`

`ReportSnapshots.raw_data_json` is used as a structural supplement:

- Preserve complete snapshot structure.
- Support old snapshot compatibility.
- Fill display gaps that are not represented in normalized metric rows.

## Historical Consistency

The monthly page should display the result saved at report入库 time. Avoid recalculating old months from current frontend logic, current target configuration, or current scoring settings unless the user explicitly asks for retrospective recalculation.

This matters because:

- Target settings can change after a snapshot was saved.
- Proportional scoring can be introduced or toggled after older snapshots exist.
- Frontend display logic can change over time.
- Historical month reports should remain explainable and stable.

## Proportional Scoring Compatibility

New saved snapshots should include proportional scoring state, earned score, and completion ratio. Monthly display should prefer those saved fields.

For old snapshots without these fields, use compatibility display logic and make the fallback narrow. Do not backfill or mutate old snapshots unless asked.

## Maintenance Notes

- Keep report and monthly display semantics aligned.
- When changing a report save payload, check monthly parsing immediately.
- Export changes should be verified visually because long-image/PDF export can fail even when table rendering looks correct.
- Avoid making monthly depend on live SLA targets unless it is clearly a filter/control rather than historical scoring source.

