# TaskRankr

A multi-user, offline-first task manager featuring hierarchical tasks, a status workflow (open/in_progress/pinned/completed), and per-user rank fields (priority, ease, enjoyment, time), with Replit Auth and a guest mode.

## Run & Operate

- **Run:** `npm run dev`
- **Build:** `npm run build`
- **Typecheck:** `npm run typecheck`
- **Codegen:** `npm run generate-drizzle` (for Drizzle ORM)
- **DB Push:** `npm run db:push` (applies schema changes to the database)
- **Env Vars:** Replit Auth is configured via platform integrations.

## Stack

- **Frontend:** React, Shadcn/ui, Tailwind CSS
- **Backend:** Node.js, Express
- **Runtime:** Node.js (latest LTS)
- **ORM:** Drizzle ORM
- **Validation:** Zod
- **Build Tool:** Vite
- **API:** `ts-rest` (for type-safe API contracts)

## Where things live

- **Client Source:** `client/src/`
- **Server Source:** `server/`
- **Database Schema:** `shared/schema/`
- **API Contracts:** `shared/contract.ts`
- **UI Components:** `client/src/components/`
- **State Management Providers:** `client/src/providers/`
- **Shared Utilities (client/server):** `shared/utils/`
- **Cypress E2E Tests:** `cypress/e2e/`
- **Changelog:** `CHANGELOG.json`

## Architecture decisions

- **Local-first writes with background sync:** Task mutations are applied optimistically client-side and then queued for background synchronization with the server, ensuring a responsive UI.
- **Two-context provider pattern:** Data providers expose separate contexts for reactive views and stable mutators, optimizing re-renders by preventing components that only trigger actions from reacting to data changes.
- **Dialog-scoped draft sessions:** Task form dialogs manage in-memory draft states (`DraftSessionProvider`) isolated from the main task list, ensuring draft changes don't cause widespread UI churn until explicitly saved.
- **Stable React identity for tasks:** Client tasks use a `clientKey` UUID for stable React `key` props, preserving component identity across sync operations (e.g., local temp-ID to server-ID swap) and preventing unnecessary re-mounts.
- **Namespaced localStorage:** All persistent client-side state is managed through `client/src/lib/storage.ts` to enforce namespacing and provide a centralized interface, preventing direct `localStorage` access.

## Product

- **Hierarchical Tasks:** Users can create tasks and subtasks to organize work.
- **Offline-first Capability:** Allows users to manage tasks without an active internet connection, syncing changes when online.
- **Guest Mode:** Provides a local storage-based experience with demo data for unauthenticated users.
- **Personalized Task Ranking:** Users can assign custom priority, ease, enjoyment, and time values to tasks, influencing sorting.
- **Status Workflow:** Tasks progress through defined statuses: open, in progress, pinned, and completed.
- **PWA Support:** Installable Progressive Web App for an app-like experience.

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

- **Cypress Test File Registration:** New Cypress test files must be manually added to `cypress.config.ts`.
- **Selector Usage in Cypress:** Always define new `data-testid` (and other) selectors in `cypress/support/constants/selectors.ts` before use in test files.
- **Font Loading:** Avoid adding additional font families beyond Inter and Outfit, as this can negatively impact load performance.
- **Changelog Updates:** Remember to add a new changelog entry in `CHANGELOG.json` and bump the version before every publish.

## Pointers

- **Replit Auth Docs:** _Populate as you build_
- **Drizzle ORM Docs:** _Populate as you build_
- **ts-rest Docs:** _Populate as you build_
- **Cypress Best Practices:** _Populate as you build_
- **Vite PWA Plugin Docs:** _Populate as you build_