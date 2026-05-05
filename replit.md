# TaskRankr

A multi-user, offline-first task manager featuring hierarchical tasks, a status workflow (open/in_progress/pinned/completed), and per-user rank fields (priority, ease, enjoyment, time).

## Run & Operate

- **Run**: `npm run dev`
- **Build**: `npm run build`
- **Typecheck**: `npm run typecheck`
- **Codegen (Drizzle Kit)**: `npm run db:generate` (for schema changes)
- **DB Push (Drizzle Kit)**: `npm run db:push` (applies schema changes to DB)
- **Format**: `npm run format` (biome)
- **E2E Tests**:
    - User mode: `npm run cy:run:user`
    - Guest mode: `npm run cy:run:guest`

**Environment Variables**:
- Replit Auth is used for user authentication.

## Stack

- **Frontend**: React (with `shadcn/ui` for primitives), Vite
- **Backend**: Node.js, Express
- **Database**: SQLite (via Drizzle ORM)
- **ORM**: Drizzle ORM
- **Validation**: Zod
- **API Definition**: `ts-rest`
- **Runtime**: Node.js (latest LTS)
- **Build Tool**: Vite
- **State Management**: Custom React Context Providers (offline-first, with background sync)
- **PWA**: `vite-plugin-pwa` (Workbox)
- **Testing**: Cypress (E2E)

## Where things live

- **React Frontend**: `client/`
- **Node.js Backend**: `server/`
- **Shared Code (Schemas, Utils, API Contract)**: `shared/`
- **Database Schema**: `shared/schema/` (source of truth for data model)
- **API Contracts**: `shared/contract.ts`
- **Replit Auth Integration**: `server/replit_integrations/auth/`
- **Database Migrations**: `migrations/`
- **Local Storage Management**: `client/src/lib/storage.ts`
- **Changelog Entries**: `CHANGELOG.json`

## Architecture decisions

- **Local-first writes with background sync**: Task mutations update the UI synchronously and enqueue operations for background synchronization, eliminating `isPending` states in the UI.
- **Coalesced settings sync**: Settings updates are batched into a single `pendingSettingsSync` pointer for efficient, idempotent partial merges, separate from the task queue.
- **Two-context provider pattern**: Data providers expose separate contexts for reactive data (`useTasks`) and stable mutators (`useTaskMutations`) to optimize re-renders.
- **Dialog-scoped draft sessions**: Task form draft states are isolated within their dialog's `DraftSessionProvider` to prevent UI churn in the main task list.
- **Stable React identity for tasks**: `clientKey` UUIDs are used for task identity in the UI (`LocalTask`), ensuring stable component keys across sync operations and data re-fetches without remounts.

## Product

- **Hierarchical Tasks**: Users can create tasks and subtasks.
- **Status Workflow**: Tasks progress through `open`, `in_progress`, `pinned`, and `completed` states.
- **Per-User Rank Fields**: Customizable `priority`, `ease`, `enjoyment`, and `time` fields for each task, allowing personalized sorting and filtering.
- **Offline-First**: Users can create and modify tasks without an internet connection; changes sync in the background when connectivity is restored.
- **Guest Mode**: Unauthenticated users can use the app with local storage and demo data.
- **PWA Support**: Installable as a Progressive Web App for an app-like experience.
- **Changelog**: Notifies users of new features and updates automatically.

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

- **Cypress E2E Tests**: New test files must be manually added to `cypress.config.ts`.
- **Selectors in E2E Tests**: Always define `data-testid` selectors in `cypress/support/constants/selectors.ts` and import them; never use raw selector strings directly in test files.
- **Font Loading**: Only Inter and Outfit fonts are permitted. Do not re-add the massive multi-font `<link>` tag.
- **Changelog**: Before every publish, add a new entry to `CHANGELOG.json` and bump the version.

## Pointers

- **Drizzle ORM Documentation**: _Populate as you build_
- **ts-rest Documentation**: _Populate as you build_
- **React Query Documentation**: _Populate as you build_
- **shadcn/ui Documentation**: _Populate as you build_
- **Vite Documentation**: _Populate as you build_
- **Cypress Documentation**: _Populate as you build_
- **Workbox Documentation**: _Populate as you build_
- **Biome Formatting Documentation**: _Populate as you build_
- **es-toolkit Documentation**: _Populate as you build_