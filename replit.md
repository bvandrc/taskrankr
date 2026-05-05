# TaskRankr
A multi-user, offline-first task manager featuring hierarchical tasks, a customizable status workflow, and per-user rank fields for priority, ease, enjoyment, and time.

## Run & Operate
- **Run Dev Server**: `npm run dev`
- **Build**: `npm run build`
- **Typecheck**: `npm run typecheck`
- **Codegen (Drizzle Kit)**: `npm run generate-drizzle` (for schema changes)
- **DB Push (Drizzle Kit)**: `npm run db:push` (applies schema changes to DB)
- **Required Env Vars**:
    - `VITE_AUTH_DOMAIN`
    - `VITE_AUTH_CLIENT_ID`
    - `VITE_AUTH_REDIRECT_URI`
    - `VITE_AUTH_LOGOUT_REDIRECT_URI`

## Stack
- **Frontend**: React
- **Styling**: Tailwind CSS, shadcn/ui
- **Runtime**: Node.js
- **Database**: PostgreSQL (via Drizzle ORM)
- **API**: `ts-rest`
- **Validation**: Zod
- **Build Tool**: Vite
- **Testing**: Cypress (E2E), Vitest (Unit - _Populate as you build_)

## Where things live
- **React Frontend**: `client/`
- **Node.js Server**: `server/`
- **Shared Code (Schemas, Utils, API Contract)**: `shared/`
- **Database Schema (Source of Truth)**: `shared/schema/`
- **API Contract**: `shared/contract.ts`
- **UI Components**: `client/src/components/`
- **React Hooks**: `client/src/hooks/`
- **React Context Providers**: `client/src/providers/`
- **Client-side Utilities**: `client/src/lib/`
- **Cypress E2E Tests**: `cypress/e2e/`
- **Cypress Selectors**: `cypress/support/constants/selectors.ts`
- **PWA Configuration**: `vite.config.ts`

## Architecture decisions
- **Local-first writes + background sync**: All task mutations write synchronously to local state and are then queued for background synchronization, ensuring a responsive UI.
- **Two-context provider pattern**: Data providers (e.g., `TasksProvider`) expose separate contexts for reactive data views and stable mutators, optimizing re-renders.
- **Dialog-scoped draft sessions**: Task form draft state is isolated to the dialog subtree, preventing unrelated UI components from re-rendering during draft changes.
- **Stable React identity for tasks**: `clientKey` ensures tasks maintain their React identity across state changes (e.g., temporary ID to real ID after sync) without remounting.
- **localStorage namespacing**: All persistent user state interacts with `localStorage` exclusively through `client/src/lib/storage.ts` for consistency and isolation.

## Product
- **Task Management**: Create, edit, and organize hierarchical tasks.
- **Status Workflow**: Tasks progress through `open`, `in_progress`, `pinned`, and `completed` states.
- **Rank Fields**: Users can prioritize tasks using `priority`, `ease`, `enjoyment`, and `time` fields.
- **Offline-First**: Supports creating and modifying tasks while offline, with background synchronization when connectivity returns.
- **Guest Mode**: Allows unauthenticated use with local storage for data and demo content.
- **User Authentication**: Integrates with Replit Auth for user management.
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
- **Cypress E2E Tests**: New test files must be manually added to `cypress.config.ts`.
- **Cypress Test Execution**: By default, run `cy:run:user` unless `cy:run:guest` is explicitly requested.
- **Selectors in Cypress**: Always define new `data-testid` selectors in `cypress/support/constants/selectors.ts` before using them in tests.
- **Font Loading**: Avoid re-adding large, multi-font `<link>` tags; only Inter and Outfit are intended.

## Pointers
- **Replit Auth Documentation**: `replit_integrations/auth/`
- **Drizzle ORM Documentation**: Refer to Drizzle's official documentation for advanced schema and migration patterns.
- **ts-rest Documentation**: Refer to `ts-rest` official documentation for API contract definition and client usage.
- **Cypress Documentation**: For writing and debugging E2E tests.
- **Vite PWA Plugin Documentation**: For service worker and PWA configuration.
- **Tailwind CSS Documentation**: For utility-first styling.
- **shadcn/ui Documentation**: For primitive UI components.