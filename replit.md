# TaskRankr
TaskRankr is a multi-user, offline-first task manager featuring hierarchical tasks, a status workflow, and customizable rank fields for priority, ease, enjoyment, and time.

## Run & Operate
- **Run Dev Server**: `npm run dev`
- **Build**: `npm run build`
- **Typecheck**: `npm run typecheck`
- **Codegen (Drizzle Kit)**: `npm run generate`
- **DB Push (Drizzle Kit)**: `npm run db:push`
- **Required Env Vars**:
    - `VITE_REPLIT_APP_URL`
    - `VITE_REPLIT_AUTH_REDIRECT_URL`

## Stack
- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express
- **Runtime**: Node.js (latest LTS)
- **ORM**: Drizzle ORM
- **Validation**: Zod
- **Build Tool**: Vite
- **API**: `ts-rest`
- **State Management**: Custom React Context Providers (offline-first with background sync)

## Where things live
- **Client Source**: `client/src/`
- **Server Source**: `server/`
- **Shared Utilities/Schema**: `shared/`
- **DB Schema**: `shared/schema/`
- **API Contracts**: `shared/contract.ts`
- **Database Migrations**: `migrations/`
- **User Settings Provider**: `client/src/providers/SettingsProvider.tsx`
- **Task Sync Queue Provider**: `client/src/providers/TaskSyncQueueProvider.tsx`
- **Tasks Provider (Local-first state)**: `client/src/providers/TasksProvider.tsx`
- **Background Sync Orchestrator**: `client/src/providers/SyncProvider.tsx`
- **Cypress E2E Tests**: `cypress/e2e/`
- **Cypress Selectors**: `cypress/support/constants/selectors.ts`

## Architecture decisions
- **Local-first writes + background sync**: All task mutations write synchronously to the local state and are then queued for background synchronization, ensuring immediate UI feedback without `isPending` states.
- **Two-context provider pattern**: Key providers (e.g., `TasksProvider`) expose separate contexts for reactive data views and stable mutator functions, optimizing re-renders by allowing components to subscribe only to necessary state.
- **Dialog-scoped draft sessions**: Task form draft state is isolated to the dialog's lifecycle, preventing incomplete changes from affecting the main task list until explicitly saved or discarded.
- **Stable React identity for tasks**: Client-side tasks (`LocalTask`) include a `clientKey` UUID for stable React component identity across sync operations and reloads, preventing UI churn during temporary ID resolution or re-fetches.
- **`localStorage` namespacing**: All persistent client-side state uses a centralized `client/src/lib/storage.ts` utility for consistent namespacing and serialization, disallowing direct `localStorage` access elsewhere.

## Product
- Hierarchical task organization (subtasks).
- Four-state task workflow: open, in_progress, pinned, completed.
- Per-user customizable rank fields: priority, ease, enjoyment, time.
- Guest mode with local storage and demo data.
- User authentication via Replit Auth.
- PWA support for offline access and installability.
- "What's New" changelog dialog on version updates.

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
- **Cypress Test Files**: New E2E test files must be manually added to `cypress.config.ts`.
- **Cypress Selectors**: Always define `data-testid` selectors in `cypress/support/constants/selectors.ts` and import them; never use raw selector strings in test files.
- **Font Loading**: Only Inter and Outfit fonts are permitted; avoid re-adding large multi-font `<link>` tags.

## Pointers
- **Cypress E2E Tests**: Refer to `cypress/e2e/` for test implementations and `cypress/support/` for utilities.
- **Task Utilities**: Consult `shared/utils/task-utils.ts` and `client/src/lib/task-tree-utils.ts` for common task manipulation helpers.
- **PWA Configuration**: See `vite.config.ts` for Workbox service worker setup and `client/src/main.tsx` for registration.
- **Replit Auth Integration**: `server/replit_integrations/auth/` contains the Replit Auth (OIDC) setup.
- **shadcn/ui Documentation**: _Populate as you build_
- **ts-rest Documentation**: _Populate as you build_
- **Drizzle ORM Documentation**: _Populate as you build_