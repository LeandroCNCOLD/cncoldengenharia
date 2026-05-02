# AGENTS.md

## Cursor Cloud specific instructions

### Overview

ColdPro (CN Cold Engineering) is a single-package TypeScript/React 19 app using TanStack Start (SSR) with Vite 7, backed by a remote hosted Supabase instance. No local database or Docker is needed.

### Commands

| Action | Command |
|--------|---------|
| Install deps | `npm install` |
| Dev server | `npm run dev` (Vite on port 8080) |
| Lint | `npm run lint` |
| Format | `npm run format` |
| Build | `npm run build` |
| Preview | `npm run preview` |

### Caveats

- The dev server starts on **port 8080** (configured by `@lovable.dev/vite-tanstack-config`), not the default Vite port 5173.
- `npm run lint` will report pre-existing **prettier/prettier** formatting errors in several files. These are part of the existing codebase and should not block work.
- The app depends on a **remote Supabase** instance (`tqdrbfvtvmrtontibvzg.supabase.co`). Credentials are in `.env`. No `SUPABASE_SERVICE_ROLE_KEY` is committed; SSR admin operations that require it will fail without that secret.
- `vite.config.ts` uses `@lovable.dev/vite-tanstack-config` which bundles many plugins (React, Tailwind, Cloudflare, TanStack Router, etc.). Do not add duplicate plugins manually.
- The `src/modules/coldpro_v2/` module is a placeholder for a future thermodynamic calculation engine — it has no runnable code yet.
