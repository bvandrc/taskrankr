# TaskRankr

A multi-user, offline-first task manager featuring hierarchical tasks, a status workflow, and per-user customizable rank fields.

## Run & Operate

**Required Environment Variables:**
- `VITE_REPLIT_APP_URL`: URL of the Replit app for authentication callbacks.

## Stack

- **Frontend:** React, Vite, shadcn/ui, Tailwind CSS
- **Backend:** Node.js, Express
- **Database:** Drizzle ORM (SQLite)
- **Validation:** Zod
- **API Layer:** `ts-rest`
- **State Management:** Custom React Context Providers (offline-first, background sync)
- **Runtime:** Node.js (latest LTS recommended)

## Where things live

- `client/`: React frontend application.
  - `client/src/components/`: Reusable UI components.
  - `client/src/hooks/`: Custom React hooks.
  - `client/src/pages/`: Top-level application pages.
  - `client/src/providers/`: Core state management providers.
  - `client/src/lib/`: Utility functions and client-side logic.
  - `client/src/App.tsx`: Main application router and provider composition.
- `server/`: Node.js backend.
  - `server/index.ts`: Server entry point.
  - `server/routes.ts`: API route handlers.
  - `server/storage.ts`: Database access layer.
  - `server/db.ts`: Database connection setup.
- `shared/`: Code shared between client and server.
  - `shared/schema/`: **Source of truth for DB schema and Zod validation schemas.**
  - `shared/utils/`: Shared utility functions.
  - `shared/contract.ts`: **Source of truth for `ts-rest` API contract.**
- `cypress/`: End-to-end tests.
  - `cypress/e2e/`: Test files.
  - `cypress/support/`: Test utilities and selectors.
- `migrations/`: Database migration scripts.
- `CHANGELOG.json`: **Source of truth for user-facing release notes.**

## Architecture decisions

- **Offline-first with background sync:** All task mutations are applied immediately locally and then queued for background synchronization with the server. No `useMutation` or `isPending` states are exposed to the UI.
- **Two-context provider pattern:** Core data providers (e.g., `TasksProvider`) expose separate contexts for reactive data views and stable mutator functions to optimize re-renders.
- **Dialog-scoped draft sessions:** Task creation/editing uses in-memory draft sessions within dialogs, preventing partial changes from affecting the main task list until explicitly saved.
- **Stable React identity for tasks:** Client tasks include a `clientKey` UUID for stable React `key` props, ensuring UI elements don't remount during ID changes after server sync.
- **Namespaced localStorage:** All persistent client-side data is managed through `client/src/lib/storage.ts` to ensure consistent namespacing.

## Product

- Hierarchical task organization with infinite nesting.
- Four status states per task: `open`, `in_progress`, `pinned`, `completed`.
- Customizable per-user rank fields: `priority`, `ease`, `enjoyment`, `time`.
- Offline support with background synchronization.
- Guest mode with local storage and demo data.
- User authentication via Replit Auth.
- PWA installability with offline capabilities.
- "What's New" dialog for new version features.

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

- **Cypress E2E tests:** New test files must be manually added to `cypress.config.ts`.
- **Cypress selectors:** Always define and import selectors from `cypress/support/constants/selectors.ts` instead of using raw `data-testid` strings directly in test files.
- **Font loading:** Only Inter and Outfit fonts are used. Avoid adding additional font families.
- **PWA Service Worker:** The service worker checks for updates hourly.

## Pointers

- **Replit Auth:** See `server/replit_integrations/auth/` for Replit OIDC implementation.
- **Drizzle ORM:** Refer to `shared/schema/` for database schema definitions.
- **`ts-rest`:** See `shared/contract.ts` for API contract definition.
- **Task Utility Functions:** Refer to `shared/utils/task-utils.ts` for shared task manipulation helpers.
- **PWA Configuration:** See `vite.config.ts` for `vite-plugin-pwa` setup.
- **Client-side Storage:** Refer to `client/src/lib/storage.ts` for `localStorage` interactions.
- **Cypress Testing:** Consult `cypress/` directory for E2E tests and helper functions.