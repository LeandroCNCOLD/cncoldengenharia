# AGENTS.md

## Cursor Cloud specific instructions

### Stack overview

- **React 19 + TypeScript 5.8** with **TanStack Router/Start** and **Vite 7**
- **Tailwind CSS v4**, **Radix UI**, **shadcn-style** component library
- **Supabase** for auth/database, **Cloudflare Workers** for deployment
- Package manager: **npm** (lockfile: `package-lock.json`)

### Key commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` (serves on `:8080`) |
| Type-check | `npx tsc --noEmit` |
| Lint | `npm run lint` |
| Format | `npm run format` |
| Build | `npm run build` |

### Module layout

- `src/modules/coldpro/` — ColdPro V1 (production, do not modify)
- `src/modules/coldpro_v2/` — ColdPro V2 (isolated, new architecture)
- `src/modules/thermalcalc/` — Legacy thermal calc engines

### Gotchas

- Node.js is not pre-installed in the VM; the update script installs it via NodeSource.
- The Vite config is provided by `@lovable.dev/vite-tanstack-config` — do **not** add duplicate plugins (React, Tailwind, TanStack Start, etc.) in `vite.config.ts`.
- There is no test runner (Vitest/Jest) configured. Use `npx tsc --noEmit` for type-checking validation.
- The project uses Prettier with double-quote style. Run `npm run format` before committing to avoid lint errors.
