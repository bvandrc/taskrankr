# TaskRankr — Claude Code Reference

A multi-user, offline-first task manager with hierarchical tasks, a status workflow, and customizable per-user rank fields (priority, ease, enjoyment, time).

## Local Dev Setup

**Prerequisites**: Docker Desktop, Node.js 24+

```bash
# First time only — copy and fill in your env:
cp .env.local.example .env.local   # set DATABASE_URL and SESSION_SECRET

# Start Postgres
npm run local:db:up

# Run migrations (first time, or after schema changes)
npm run db:migrate

# Start dev server → http://localhost:5000
npm run dev
```

In **development mode** (`npm run dev`), the Log In button auto-logs you in as the built-in test user — Replit Auth is bypassed. Use `npm run build && npm run prod:preview` to run in full production mode (auth required).

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server (test login enabled) |
| `npm run build` | Build to `dist/` |
| `npm run prod:preview` | Production preview (real auth) |
| `npm run local:preview` | Preview built bundle locally, test login enabled |
| `npm run local:db:up` / `local:db:down` | Start / stop Docker Postgres |
| `npm run db:migrate` | Run DB migrations |
| `npm run db:generate -- --name <desc>` | Generate migration — always pass `--name` with a descriptive slug (e.g. `add_task_schedule`) |
| `npm run db:push` | Push schema directly (no migration file) |
| `npm run format` | Biome format — **run before every commit** |
| `npm run lint` | Biome lint |
| `npm run ts:check` | TypeScript check |
| `npm run check` | ts + cypress ts + lint |
| `npm run cy:run:user` | Cypress E2E (authenticated user) |
| `npm run cy:run:guest` | Cypress E2E (guest mode) |
| `npm run cy:open:user` | Cypress interactive (authenticated) |
| `npm run cy:open:guest` | Cypress interactive (guest) |

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS v4, Framer Motion
- **Backend**: Node.js, Express, TypeScript
- **API**: `ts-rest` (end-to-end type-safe contract in `shared/contract.ts`)
- **Database**: PostgreSQL via Drizzle ORM
- **Auth**: Replit Auth (OpenID Connect via `openid-client` + `passport`); bypassed in dev
- **UI Components**: shadcn/ui (`@radix-ui` primitives) + Lucide icons
- **Drag & Drop**: `@dnd-kit`
- **State**: Custom React Context providers (offline-first, background sync)
- **Validation**: Zod
- **Build**: Vite (client), esbuild (server via `script/build.ts`)
- **Lint/Format**: Biome (`biome.jsonc`)
- **Testing**: Cypress E2E

## Directory Layout

```
client/          React frontend
  src/
    components/  UI components
    hooks/       React hooks (e.g. useAuth.tsx, useSettings.ts)
    providers/   Context providers (e.g. TasksProvider)
    lib/
      constants.ts
      storage.ts
      task-tree-utils.ts
server/          Node.js/Express backend
  constants.ts   IS_PROD export (runtime flag for prod:preview)
shared/
  contract.ts    ts-rest API contract
  schema/        Drizzle + Zod schemas (tasks.zod.ts, settings.zod.ts, ...)
  models/        Domain models (e.g. auth.ts)
  utils/         Shared utilities (e.g. task-utils.ts)
script/          Build scripts (build.ts)
cypress/         E2E tests
  support/constants/selectors.ts   All data-testid selectors defined here
migrations/      Drizzle migration files
```

## Architecture

- **Local-first writes with background sync**: Mutations apply locally first for immediate UI, then queue for background sync with the server.
- **Two-context provider pattern**: Key providers (e.g. `TasksProvider`) expose separate contexts for reactive data and stable mutators to optimize re-renders.
- **Dialog-scoped draft sessions**: `DraftSessionProvider` isolates form draft state to the dialog subtree.
- **Stable React identity**: `clientKey` (UUID) is the React `key` for tasks — stable across sync and temp-ID swaps.
- **Coalesced settings sync**: Settings updates batch as a single idempotent partial merge (not via task queue).
- **Auth as context**: `AuthProvider` wraps the app tree (`App.tsx`); call `useAuth()` to read session state.

## Conventions

- **File naming**: kebab-case for utils (`auth-utils.ts`), PascalCase for component primitives (`DropdownMenu.tsx`), camelCase for hooks (`useAuth.tsx`, `useSettings.ts`); use `.tsx` when the file exports JSX.
- **Icons**: Use `Icon` component from `LucideIcon.tsx` only for conditional/dynamic icons — not for single static icons.
- **Comments/JSDoc**: Describe *what* and *why* from the caller's perspective. Don't restate implementation. Keep to 1–2 lines. No hedge prefixes. Don't repeat what the type signature conveys.
- **Terminology**: "Rank fields" = the 4 sortable badge fields: priority, ease, enjoyment, time.
- **Test IDs**: Use `data-testid` (not `testId`). Define all selectors in `cypress/support/constants/selectors.ts` before use.
- **Icon sizing**: Use `size-X` Tailwind class, not `w-X h-X`.
- **es-toolkit**: Use `omit`/`pick` from `es-toolkit` to avoid enumerating large object spreads by hand.
- **Formatting**: Run `npm run format` before every commit.

## Gotchas

- **Cypress selectors**: Always add new `data-testid` values to `cypress/support/constants/selectors.ts` before using them in tests.
- **Cypress config**: New test files must be manually added to `cypress.config.ts`.
- **Fonts**: Only Inter and Outfit are approved. Do not re-add the massive multi-font `<link>` tag.
- **Stale dev server after `npm install`**: Restart the server before debugging "Invalid hook call" errors — a clean restart often fixes it.
- **Vite dedupe**: `vite.config.ts` sets `resolve.dedupe: ['react', 'react-dom']` and `optimizeDeps.include: ['workbox-window']`. Don't remove these; avoid editing `vite.config.ts` when a client-side change suffices. If a new package causes duplicate-React errors, add it to `optimizeDeps.include`.
- **Service worker in dev**: Disabled (`devOptions.enabled: false`). Do not re-enable — a stale SW intercepts Vite module requests and breaks HMR.
- **esbuild bakes `NODE_ENV`**: `process.env.NODE_ENV` is replaced statically at build time. For conditions that must stay live at runtime (e.g. test routes, cookie `secure` flag), use `IS_PROD` from `server/constants.ts` — it reads `process.env.IS_PROD`, which esbuild cannot bake. `prod:preview` sets `IS_PROD=true`; `dev` and `local:preview` leave it unset.

## Key Docs

- [replit.md](replit.md) — Full architecture reference and user preferences
- [design_guidelines.md](design_guidelines.md) — Visual design system
- [Drizzle ORM](https://orm.drizzle.team/docs/overview)
- [ts-rest](https://ts-rest.com/docs/introduction)
- [shadcn/ui](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/guide/)
- [Cypress](https://docs.cypress.io/)
