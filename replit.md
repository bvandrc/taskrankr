# TaskRankr

A multi-user, offline-first task manager featuring hierarchical tasks, a status workflow, and customizable per-user rank fields.

## Run & Operate

- **Run Dev Server**: `npm run dev`
- **Build**: `npm run build` (runs `script/build.ts`)
- **Start (production)**: `npm run prod:start`
- **Typecheck**: `npm run ts:check` (or `npm run check` for ts + cypress ts + lint)
- **Lint / Format**: `npm run lint` / `npm run format` (Biome)
- **DB Push / Generate / Migrate**: `npm run db:push` / `npm run db:generate` / `npm run db:migrate`
- **E2E**: `npm run cy:run:user`, `npm run cy:run:guest`, `npm run cy:open:user`, `npm run cy:open:guest`
- **Required Env Vars**: Replit Auth environment variables are managed by Replit.

## Stack

- **Frontend**: React
- **Styling**: Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express (via `ts-rest`)
- **Database**: PostgreSQL (via Drizzle ORM)
- **Runtime**: Node.js (latest LTS)
- **Validation**: Zod
- **Build Tool**: Vite
- **Lint / Format**: Biome (`biome.jsonc`)
- **Drag & Drop**: `@dnd-kit`
- **State Management**: Custom React Context providers (offline-first, background sync)
- **API**: `ts-rest` (client and server)
- **Testing**: Cypress (E2E)

## Where things live

- **React Frontend**: `client/`
- **Node.js Backend**: `server/`
- **Shared Code (Schema, Utils, API Contract)**: `shared/`
- **Database Schema & Zod Schemas**: `shared/schema/` (`tasks.zod.ts`, `settings.zod.ts`, `common.ts`, `drizzle-utils.ts`)
- **Shared Domain Models**: `shared/models/` (e.g., `auth.ts`)
- **API Contract**: `shared/contract.ts`
- **Build Scripts**: `script/` (e.g., `build.ts`)
- **UI Components**: `client/src/components/`
- **React Hooks**: `client/src/hooks/`
- **React Providers**: `client/src/providers/` (See State Management section)
- **Global Constants**: `client/src/lib/constants.ts`
- **Local Storage Utilities**: `client/src/lib/storage.ts`
- **E2E Tests**: `cypress/`
- **DB Migrations**: `migrations/`
- **Changelog**: `CHANGELOG.json`

## Architecture decisions

- **Local-first writes with background sync**: All task mutations are applied locally first for immediate UI feedback, then queued for background synchronization with the server. No `useMutation` hooks are used.
- **Two-context provider pattern**: Key providers (e.g., `TasksProvider`) expose separate contexts for reactive data views and stable mutator functions, optimizing re-renders.
- **Dialog-scoped draft sessions**: Task form draft state is isolated to the dialog's subtree using `DraftSessionProvider` to prevent unnecessary re-renders of the main task list during editing.
- **Stable React identity for tasks**: `clientKey` (UUID) is used as the React `key` for tasks, ensuring stable component identity across sync operations and reloads, even when temporary IDs are swapped for real ones.
- **Coalesced settings sync**: Settings updates are batched and synchronized as a single, idempotent partial merge rather than via the task queue, optimizing network calls.

## Product

- **Hierarchical Tasks**: Organize tasks with parent-child relationships.
- **Status Workflow**: Tasks can be `open`, `in_progress`, `pinned`, or `completed`.
- **User-Specific Rank Fields**: Tasks have `priority`, `ease`, `enjoyment`, and `time` fields, customizable per user.
- **Offline-First**: Users can continue working without an internet connection; changes sync when online.
- **Guest Mode**: Local storage-based guest mode with demo data for unauthenticated users.
- **Replit Auth Integration**: Secure user authentication via Replit's authentication service.
- **PWA Support**: Installable as a Progressive Web App for an app-like experience.

## User preferences

- Preferred communication style: Simple, everyday language.
- File naming: kebab-case for utility/helper files (e.g., `auth-utils.ts`), PascalCase for component primitives (e.g., `DropdownMenu.tsx`, `AlertDialog.tsx`), camelCase for hooks (e.g., `useAuth.ts`, `useSettings.ts`)
- Icon helper: Use `Icon` component from `LucideIcon.tsx` only for conditional/dynamic icons (ternary cases), not for single static icons
- Code comments & JSDoc: Comments and docstrings describe a function/module from the perspective of its API — *what* it does for callers and *why*, when the design is unique or non-obvious. Trust the code to be self-explanatory for the *how*: do not restate the implementation, avoid pasting code snippets that mirror what's right below, and do not narrate steps a reader can see. Skip hedge prefixes ("Derived predicate:", "Translates X into Y:") and lead with the claim. Don't restate what the type signature already conveys (optionality, parameter types, return types). For multi-branch behavior, prefer a one-line summary plus a tight bullet list ("including: ...") over branch-by-branch prose. Keep descriptions concise (1-2 lines for most things; longer only when there's genuine "why" to explain). Prefer renaming a variable/prop to inserting an inline comment that explains what it *is*. Use exact package names as imported (e.g., `@radix-ui` not "Radix UI").
- Terminology: "Rank fields" refers to the 4 sortable fields with badges: priority, ease, enjoyment, time (distinct from text fields like name/description)
- Test IDs: Use `data-testid` as the prop name, not `testId`
- Icon Sizing: Use `size-X` tailwind class instead of `w-X h-X`
- es-toolkit: Use `es-toolkit` helper functions when we can greatly simplify something. For example, when copying many same-named properties from one object to another, use `omit` or `pick` from `es-toolkit` instead of enumerating every field by hand. Example: `createTask({ ...omit(draft, ['id', 'userId']), parentId: resolved })` rather than listing all 14 fields explicitly.
- Formatting: Run `npm run format` (biome) before every commit/checkpoint so the code in checkpoints is always formatted.
- Documentation: Keep `replit.md` focused on cross-cutting architecture and conventions. File-level mechanics, function signatures, and internal helpers belong in the relevant file's docstring, not here.

## Gotchas

- **Selector Consistency**: Always define new CSS selectors (`data-testid`) in `cypress/support/constants/selectors.ts` before using them in Cypress tests.
- **Cypress Test Files**: New E2E test files must be manually added to `cypress.config.ts`.
- **Font Imports**: Do not re-add the massive multi-font `<link>` tag; only Inter and Outfit are approved fonts.
- **Post-install app crashes (duplicate React / Invalid hook call)**: After installing a new npm package, the dev server can land in a dirty state mid-install, producing alarming browser errors. Always restart the workflow first before debugging — a clean restart may resolve it with no code changes needed.
- **Vite duplicate-React / Invalid hook call**: `vite.config.ts` sets `resolve.dedupe: ['react', 'react-dom']` and `optimizeDeps.include: ['workbox-window']`. Root cause: `workbox-window` is not discovered during Vite's initial module-graph crawl (it's only used by the PWA service worker), so without pre-including it Vite triggers a mid-session full-page reload + re-bundle the first time the service worker runs. That reload races with module loading and can land two React instances in the graph simultaneously (causing "Invalid hook call" errors and aborting in-flight Cypress requests). Pre-including it prevents the mid-session reload entirely. Do not remove this option. If a new package causes the same symptom, add it to `optimizeDeps.include` — but prefer rewriting the import to not need `compat` sub-paths (e.g. use native `??` instead of `defaults` from `es-toolkit/compat`).

## Pointers

- **Replit Auth**: [Replit Auth documentation](https://docs.replit.com/repls/replit-auth)
- **Drizzle ORM**: [Drizzle ORM documentation](https://orm.drizzle.team/docs/overview)
- **Tailwind CSS**: [Tailwind CSS documentation](https://tailwindcss.com/docs)
- **shadcn/ui**: [shadcn/ui documentation](https://ui.shadcn.com/)
- **ts-rest**: [ts-rest documentation](https://ts-rest.com/docs/introduction)
- **Vite PWA Plugin**: [vite-plugin-pwa documentation](https://vite-pwa-org.netlify.app/guide/)
- **Cypress**: [Cypress documentation](https://docs.cypress.io/)
- **Shared Task Utilities**: `shared/utils/task-utils.ts` and `client/src/lib/task-tree-utils.ts`