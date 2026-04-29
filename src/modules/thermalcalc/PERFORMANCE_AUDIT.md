# ColdPro / ThermalCalc performance audit

## Validation baseline

- `npm test`: pass.
- `npm run build`: pass.
- `npm run lint`: fails on pre-existing repository-wide Prettier/lint findings outside the optimized query paths.
- Focused eslint over touched ColdPro/ThermalCalc files is used after changes.

## Heaviest pages reviewed

- Banco de Dados: previously loaded up to 2000 `coil_geometry_factors` rows with `select("*")`, including `raw_json`, then filtered client-side.
- Coil Simulator: simulation history loaded `inputs` and full `outputs` JSON for a summary list.
- Revisao Tecnica / CalibrationPanel: calibration history loaded snapshot JSON via `select("*")`.
- Performance maps: list loaded `input_grid_json` and `results_json` even though the table only renders summary fields.
- Equipamentos / dashboards: project list had no limit and loaded every project.
- Importacao: import and mapper paths intentionally read/write raw JSON; primary risk is server memory during large mapping batches, not UI rendering.

## Applied actions

- Banco de Dados now uses explicit list columns, server-side pagination (`PAGE_SIZE = 100`), server-side search, and 300 ms debounce.
- Equipment project list now filters archived projects server-side, selects summary columns only, and limits to 100 rows by default.
- Coil Simulator history list no longer fetches saved `inputs`.
- Calibration history list no longer fetches `inputs_snapshot`, `outputs_snapshot`, or reference/result JSON snapshots.
- Performance map list no longer fetches full grid/results JSON.
- `findGeometryFactor` now orders deterministic single-row lookups.
- Added safe `IF NOT EXISTS` indexes for high-traffic list/history lookups and fan/compressor/unilab lookup paths.

## Index recommendations / status

- Added indexes for `coil_geometry_factors(mode, sigla)`, `(mode, geometry_code)`, `(mode, source_table)`.
- Added history indexes for `coil_simulations`, `coil_calibrations`, and `coil_performance_maps`.
- Added `equipment_projects(status, updated_at DESC)`.
- Added `compressor_models(manufacturer, model)`, `fan_models(manufacturer, model)`, `fan_curves(fan_id)`, and `unilab_geometries(geometry_code, mode)`.
- Requested `technical_*` tables are not present in this schema; closest bulk tables are `unilab_source_rows`, `coil_geometry_factors`, `component_items`, compressor/fan tables, and Unilab geometry tables.

## Duplicate / integrity risks

- `compressor_polynomials` has overlapping indexes on `(compressor_id, curve_type)` (`idx_cp_comp` and a unique index).
- `compressor_models(source_table_key)` has both non-unique and unique index history; keep the unique path if inserts consistently populate this key.
- Destructive mapper flows delete/reinsert compressor, fan, and refrigerant data; verify FK expectations before production remaps.
- `findGeometryFactor` was nondeterministic with `limit(1)`; ordering was added.

## Remaining risks

- Some detail paths still legitimately load raw JSON when needed for mapping/import detail.
- Search on `coil_geometry_factors` uses `ilike`; large datasets may need trigram indexes if substring search becomes slow.
- Full lint remains blocked by formatting debt outside this scoped performance pass.
