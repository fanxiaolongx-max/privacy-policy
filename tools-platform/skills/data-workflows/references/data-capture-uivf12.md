# Data Capture / UIVF12

Use this reference for `/uivf12` changes.

## Files

- Page: `frontend/pages/uivf12.html`
- Frontend scripts:
  - `frontend/js/uivf12/workbench.js`
  - `frontend/js/uivf12/generator.js`
  - `frontend/js/uivf12/save.js`
  - `frontend/js/uivf12/sidebar.js`
  - `frontend/js/uivf12/copy.js`
  - `frontend/js/uivf12/genlog.js`
- Backend route: `backend/routes/uiv.js`
- Repositories:
  - `backend/models/uiv-scripts-repository.js`
  - `backend/models/uiv-categories-repository.js`

## Behavior

The UIVF12 module manages a script repository:

- Generate, save, categorize, move, delete, copy, and browse scripts.
- Support a sidebar script repository.
- Support script categories.
- Use detailed frontend console logging in the save path to diagnose 403, body size, duplicate names, and upload failures.
- If normal upload fails because the request body is too large or unstable, preserve the gzip compressed fallback path.

## API Surface

- `GET /api/uiv/scripts`
- `POST /api/uiv/scripts`
- `DELETE /api/uiv/scripts/:id`
- `PATCH /api/uiv/scripts/:id/category`
- `POST /api/uiv/categories`
- `DELETE /api/uiv/categories/:name`
- `GET /api/uiv/backup`
- `POST /api/uiv/backup`

## Storage

Primary storage is `backend/data/tools.db`:

- `uiv_scripts`
- `uiv_categories`

Legacy/fallback JSON files may still exist under `backend/data/`:

- `uiv_scripts.json`
- `uiv_categories.json`

When changing read/write behavior, check whether the repository exposes a source mode or fallback behavior. Preserve source labels and compatibility unless the user asks to remove legacy JSON support.

## Maintenance Notes

- Keep route validation and repository normalization aligned.
- Avoid changing script identity semantics casually; duplicate detection and category movement depend on stable IDs/names.
- If adding metadata, make it optional for old rows and old JSON records.

