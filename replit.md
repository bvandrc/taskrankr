# TaskRankr
A multi-user, offline-first task manager featuring hierarchical tasks, a customizable status workflow, and per-user rank fields for task prioritization.

## Run & Operate
- **Run Development Server**: `npm run dev`
- **Build for Production**: `npm run build`
- **Typecheck**: `npm run typecheck`
- **Generate Drizzle Kit Migrations**: `drizzle-kit generate:pg`
- **Push Drizzle Kit Migrations to DB**: `drizzle-kit push:pg`
- **Environment Variables**: Replit Auth is handled automatically.

## Stack
- **Frontend**: React.js
- **Styling**: Tailwind CSS
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL (via Drizzle ORM)
- **Validation**: Zod
- **API**: `ts-rest`
- **Build Tool**: Vite
- **Runtime**: Node.js (latest LTS)

## Where things live
- **React Frontend**: `client/src/`
- **Node.js Server**: `server/`
- **Shared Code (client/server)**: `shared/`
- **UI Components**: `client/src/components/`
- **Database Schema & Migrations**: `shared/schema/` and `migrations/`
- **API Contracts**: `shared/contract.ts`
- **Authentication Handlers**: `server/replit_integrations/auth/`
- **User Settings & Local Storage**: `client/src/providers/SettingsProvider.tsx`, `client/src/lib/storage.ts`
- **Changelog**: `CHANGELOG.json`

## Architecture decisions
- **Local-first writes with background sync**: Task mutations are applied optimistically client-side and then queued for background synchronization with the server.
- **Two-context provider pattern**: Data providers expose separate contexts for reactive data access and stable mutator functions to optimize re-renders.
- **Dialog-scoped draft sessions**: Task creation/editing uses an in-memory draft session within the dialog, preventing intermediate changes from affecting the main task list until explicitly saved.
- **Stable React identity for tasks**: `clientKey` ensures consistent React component identity for tasks across client-side updates and server synchronizations, preventing unnecessary re-mounts.
- **Centralized local storage management**: All persistent client-side state uses `client/src/lib/storage.ts` for namespacing and consistency.
- **Load-time optimizations**: Inline pre-React CSS spinner in `client/index.html` (removed by `App.tsx` on mount); `React.lazy` for secondary routes (Home/Landing stay eager); manual vendor chunking in `vite.config.ts` splits `node_modules` into `vendor-react`, `vendor-radix`, `vendor-motion`, `vendor-dnd`, `vendor-query`, `vendor-icons`, `vendor-api`, plus a catch-all `vendor` — keeps the app chunk small and vendor caches stable across deploys.

## Product
- Create, read, update, and delete hierarchical tasks.
- Assign priority, ease, enjoyment, and time estimates to tasks.
- Track task status (open, in_progress, pinned, completed).
- Guest mode with local storage and demo data.
- User authentication via Replit Auth.
- Persistent user settings and task expansion state.
- Progressive Web App (PWA) support with offline capabilities.

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
- New Cypress E2E test files must be manually added to `cypress.config.ts`.
- When running Cypress E2E tests, use `cy:run:user` by default unless `cy:run:guest` is explicitly requested.
- Always add new CSS selector strings for Cypress tests to `cypress/support/constants/selectors.ts` before use.

## Pointers
- **Task Tree Utilities**: `shared/utils/task-utils.ts` (re-exported from `client/src/lib/task-tree-utils.ts`)
- **Path Aliases**: Configured in `tsconfig.json` (`@/` for `client/src/`, `~/shared/` for `shared/`).
- **Cypress E2E Tests**: `cypress/` directory, especially `cypress/support/constants/selectors.ts` for `data-testid` usage.
- **PWA Configuration**: `vite.config.ts` for `vite-plugin-pwa` and `client/src/main.tsx` for service worker registration.
- **Font Loading**: `client/index.html` and `client/src/index.css`.