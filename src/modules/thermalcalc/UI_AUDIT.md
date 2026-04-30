# ColdPro UI audit

## Scope

- Checked ColdPro navigation, tabs, buttons, dialogs, route links, and browser console behavior.
- Did not change formulas, database behavior, or `thermalcalc` engines.

## Findings

- The sidebar had an `Administracao` entry pointing to `/admin`, which is not a generated route.
- The requested files `admin.revisao-tecnica.tsx`, `technical-component-detail-drawer.tsx`, and `process-unmapped-button.tsx` are not present in this checkout.
- `Banco Tecnico`, equipment detail tabs, equipment creation dialog, evaporator/condenser actions, and performance map actions have handlers or intentional placeholder content.
- Focused eslint reports formatting debt in existing ColdPro files, but no broken imports surfaced in build.

## Fixes applied

- Redirected the sidebar `Administracao` item to `/admin/coldpro-import`, an existing admin route.
- Normalized the `Banco Tecnico` database link formatting while preserving behavior.

## Validation

- `npm install`
- `npm run build`
- `npm test`
- Focused eslint over touched files
- Browser smoke test attempted; protected ColdPro routes redirect to `/auth` without a session, so authenticated interaction could not be completed in this environment.
