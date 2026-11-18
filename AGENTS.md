# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is **ColdPro / Coldbase Hub** — a refrigeration engineering platform (React SPA, all UI in Portuguese). It uses:
- **Bun** as the primary package manager and runtime (`bun.lockb`)
- **Vite 7** dev server (via `@lovable.dev/vite-tanstack-config`)
- **React 19** + TanStack Start/Router + shadcn/ui + Tailwind CSS 4
- **Supabase** (hosted) for database and auth
- **Vitest** for unit tests (thermodynamic engine tests in `src/modules/coldpro_v2/__tests__/`)

### Dev Auth Bypass

In dev mode (`import.meta.env.DEV`), authentication is **completely bypassed**. A hardcoded dev user with `admin` + `engenheiro` roles is auto-injected (see `src/lib/auth.tsx`). No Supabase credentials or login are required for local development.

### Running the Application

```bash
bun run dev        # Starts Vite dev server on port 8080
```

The port is configured by `@lovable.dev/vite-tanstack-config` (defaults to 8080).

### Commands

| Task | Command |
|------|---------|
| Install deps | `bun install` |
| Dev server | `bun run dev` |
| Lint | `bun run lint` |
| Format | `bun run format` |
| Tests | `bun run vitest run` (or `bunx vitest run`) |
| Type check | `bunx tsc --noEmit` |
| Build | `bun run build` |

### Key Caveats

- The `.env` file is committed and contains only public Supabase anon keys — no secrets are needed for dev.
- ESLint has pre-existing prettier formatting errors in auto-generated Supabase integration files (`src/integrations/supabase/`). These are not regressions.
- The Vite config at `vite.config.ts` uses `@lovable.dev/vite-tanstack-config` which bundles many plugins (React, Tailwind, TanStack, Cloudflare, path aliases). Do NOT add duplicate plugins manually.
- Large JSON catalog files live in `public/data/` and are fetched at runtime — they are not bundled.
- Bun is required (not npm/yarn/pnpm). The `bun.lockb` is the source of truth for dependency resolution.

## Economia de contexto

- Comece pela tela, rota, símbolo ou arquivo da tarefa. Use `rg` e leia os trechos relevantes antes de ampliar a busca. Carregue o procedimento específico só quando for necessário.
- Para diffs, testes e logs extensos, use RTK quando instalado e compatível com o comando. Exemplos: `rtk git diff`, `rtk npm test` e `rtk pytest`. Use o comando original se o RTK estiver indisponível ou se o resumo omitir evidências necessárias.
- Reaproveite verificações do mesmo commit e ambiente quando a mudança não as invalidar. Registre commit, arquivos alterados, testes e pendências para retomar o trabalho com um resumo curto.
